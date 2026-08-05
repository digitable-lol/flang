import type { Diagnostic } from "./diagnostics.js"
import type {
  FtsDocument,
  FtsScalar,
  FtsStructure,
  FtsUtility,
  FtsUtilityComparison,
  FtsUtilityCondition,
  FtsUtilityOperand,
  FtsUtilityProperty,
  FtsUtilityRule,
  SourceSpan,
} from "./model.js"
import { spanOf } from "./spans.js"
import { compareValues, propertyLimit, traceUtility } from "./utility.js"

/**
 * Judgement analysis: what the rules of a utility actually cover, and what the
 * author's declared limits actually constrain.
 *
 * Every other check in this file's neighbourhood reads the rules and asks
 * whether each one is well formed. This one reads the INPUT SPACE and asks
 * which rules apply where — so it sees what is missing from the rules
 * altogether: regions where nothing fires and the result stays at its initial
 * value, regions where two rules both apply and the later declaration silently
 * wins, and properties whose limit no input ever reaches, which therefore
 * constrain nothing and could be tightened twofold without a single example
 * changing.
 *
 * Three decisions carry the method.
 *
 * 1. THE PARTITION. A rule condition is a conjunction of comparisons between a
 *    field and an operand. When the operand is a constant, the truth of
 *    `field op constant` changes only at that constant. Collecting, per
 *    numeric field, the constants of its conditions partitions the axis into
 *    alternating pieces: open interval, threshold point, open interval, …
 *    Inside a cell of the product of such pieces the behaviour of any
 *    analysable condition is constant. Cells are finite, and everything —
 *    rule regions, overlaps, holes, property reachability — is computed on
 *    them at once.
 *
 * 2. ZERO IS ALWAYS A THRESHOLD. An operand "percent of a field" changes sign
 *    with the field, so the boundary `field < 0 / field > 0` separates
 *    qualitatively different regimes even when no condition mentions zero.
 *    Without that threshold the hole on negative amounts merges into an
 *    ordinary region and stops being visible — precisely the defect this
 *    analysis exists to find.
 *
 * 3. EXECUTION, NOT A SECOND SEMANTICS. Whether a rule fires in a cell, and
 *    what the result is, come from `traceUtility` — the evaluator itself. The
 *    interval arithmetic below decides only one thing: whether a condition is
 *    satisfiable at all. Conditions the interval method honestly cannot take
 *    (operand is another field, a percentage, the accumulated result) are
 *    reported as such instead of being passed off as proven.
 *
 * What it does not see: dependencies between fields, non-linearity between the
 * representatives of a cell, nested objects. A hole it reports is real — it
 * comes with a witness the core accepts. The absence of holes in a report does
 * not prove there are none. The full treatment, with maps and diagrams, is
 * `tools/ftsmap`; this is the part that is cheap enough to run on every check.
 */

export const coverageCodes = {
  hole: "FTS_COVERAGE_HOLE",
  overlap: "FTS_RULE_OVERLAP",
  overlapOrder: "FTS_RULE_OVERLAP_ORDER",
  unreachableRule: "FTS_RULE_UNREACHABLE",
  unanalyzedRule: "FTS_RULE_UNANALYZED",
  propertyUnattainable: "FTS_PROPERTY_UNATTAINABLE",
  propertyViolated: "FTS_PROPERTY_VIOLATED",
  truncated: "FTS_COVERAGE_TRUNCATED",
  skipped: "FTS_COVERAGE_SKIPPED",
} as const

export interface CoverageBudget {
  /** Upper bound on the cells of the partition. */
  cells: number
  /** Upper bound on the representative points sampled inside one cell. */
  samplesPerCell: number
  /** Upper bound on the thresholds kept for one axis. */
  valuesPerAxis: number
  /**
   * Upper bound on rule evaluations for one utility. Cells and samples alone
   * bound the number of inputs, not the work: a utility with fifty rules costs
   * fifty times as much per input. This is the bound that actually holds the
   * wall clock, and it is what makes the analysis affordable on every check.
   */
  evaluations: number
}

/**
 * Budgets chosen so that `check` stays interactive: the analysis runs on every
 * keystroke in the language server. They are deliberately tighter than the
 * budgets of `tools/ftsmap`, which draws a map once, on request.
 */
export const defaultCoverageBudget: CoverageBudget = {
  cells: 512,
  samplesPerCell: 27,
  valuesPerAxis: 8,
  evaluations: 40000,
}

/** Reports every judgement finding of the document, in declaration order. */
export function analyzeCoverage(document: FtsDocument, budget: Partial<CoverageBudget> = {}): Diagnostic[] {
  const limits = { ...defaultCoverageBudget, ...budget }
  const diagnostics: Diagnostic[] = []
  for (const utility of document.utilities ?? []) {
    const structure = document.structures.find((item) => item.name === utility.input)
    if (!structure) continue
    try {
      analyzeUtility(utility, structure, limits, diagnostics)
    } catch (error) {
      /* The analysis is advisory: a model it cannot digest must still check. */
      diagnostics.push({
        code: coverageCodes.skipped,
        message:
          `разбор области входов утилиты «${utility.name}» не выполнен: ` +
          (error instanceof Error ? error.message : String(error)),
        severity: "info",
        ...spanFields(spanOf(utility)),
      })
    }
  }
  return diagnostics
}

/* ───────────────────────────── field domains ───────────────────────────── */

type FieldKind = "number" | "boolean" | "string" | "other"

const kindNames: Record<FieldKind, string> = {
  number: "число",
  boolean: "признак",
  string: "строка",
  other: "прочее",
}

function typeKind(type: string): FieldKind {
  const bare = String(type ?? "").replace(/\s*\|\s*undefined\s*/gu, "").trim()
  if (bare === "Число" || bare === "Деньги" || bare === "number") return "number"
  if (bare === "Признак" || bare === "boolean") return "boolean"
  if (bare === "Строка" || bare === "Дата" || bare === "string") return "string"
  return "other"
}

/** Prints a constant in the words it is written with in `.fts`. */
function formatValue(value: FtsScalar): string {
  if (value === true) return "да"
  if (value === false) return "нет"
  if (value === null) return "ничто"
  if (typeof value === "number") return String(unminus(value))
  return `«${value}»`
}

const unminus = (value: number): number => (Object.is(value, -0) ? 0 : value)

const operatorText: Record<FtsUtilityComparison, string> = {
  eq: "=",
  neq: "≠",
  gte: "≥",
  lte: "≤",
  gt: ">",
  lt: "<",
}

/** The surface phrase for a comparison, as the author would type it. */
const operatorPhrase: Record<FtsUtilityComparison, string> = {
  eq: "равно",
  neq: "не равно",
  gte: "не меньше",
  lte: "не больше",
  gt: "больше",
  lt: "меньше",
}

/** The comparison that is true exactly when this one is false. */
const negated: Record<FtsUtilityComparison, FtsUtilityComparison> = {
  eq: "neq",
  neq: "eq",
  gte: "lt",
  lte: "gt",
  gt: "lte",
  lt: "gte",
}

function operandText(operand: FtsUtilityOperand): string {
  if (operand.kind === "value") return formatValue(operand.value)
  if (operand.kind === "field") return `поле «${operand.field}»`
  if (operand.kind === "percent") return `${operand.percent} % от поля «${operand.field}»`
  return "результат"
}

/** The same operand as it is written in the indented surface. */
function operandSurface(operand: FtsUtilityOperand): string {
  if (operand.kind === "value") return formatValue(operand.value)
  if (operand.kind === "field") return `поле «${operand.field}»`
  if (operand.kind === "percent") return `${operand.percent} процентов от поля «${operand.field}»`
  return "результат"
}

const actionText = (rule: FtsUtilityRule): string =>
  `${rule.action.kind === "set" ? "положить" : "добавить"} ${operandText(rule.action.value)}`

/* ──────────────────────── interval arithmetic ──────────────────────────── */

/**
 * Is the conjunction of comparisons on ONE field satisfiable?
 *
 * The method and its justification are `tools/ftspec/src/intervals.mjs`: with
 * a constant operand the conjunction splits by field, and the constraint on a
 * single field is a segment minus finitely many points (number), a subset of
 * {да, нет} (boolean) or "anything but the listed" (string). All three are
 * decided exactly, in linear time. Only emptiness and its reason are needed
 * here; witnesses come from the cell partition below.
 */
function solveField(
  kind: FieldKind,
  comparisons: Array<{ operator: FtsUtilityComparison; value: FtsScalar }>,
): { empty: true; reason: string } | { empty: false } {
  let lo = -Infinity
  let loOpen = true
  let hi = Infinity
  let hiOpen = true
  let ordered = false
  let exact: FtsScalar | undefined
  let hasExact = false
  const forbidden: FtsScalar[] = []

  for (const comparison of comparisons) {
    const value = comparison.value
    if (comparison.operator === "eq") {
      if (hasExact && !Object.is(exact, value)) {
        return { empty: true, reason: `требуется одновременно = ${formatValue(exact!)} и = ${formatValue(value)}` }
      }
      exact = value
      hasExact = true
      continue
    }
    if (comparison.operator === "neq") {
      if (!forbidden.some((item) => Object.is(item, value))) forbidden.push(value)
      continue
    }

    /* The core allows order comparisons only over numbers (see `compare` in
       utility.ts). Order over a boolean or a string is therefore not a rare
       case but a condition no input can satisfy. */
    ordered = true
    if (kind !== "number" && kind !== "other") {
      return {
        empty: true,
        reason: `сравнение порядка «${operatorText[comparison.operator]}» над полем типа «${kindNames[kind]}»`,
      }
    }
    if (typeof value !== "number") {
      return { empty: true, reason: `сравнение порядка с нечисловой константой ${formatValue(value)}` }
    }
    if (comparison.operator === "gte") {
      if (value > lo) {
        lo = value
        loOpen = false
      }
    } else if (comparison.operator === "gt") {
      if (value > lo) {
        lo = value
        loOpen = true
      } else if (value === lo) loOpen = true
    } else if (comparison.operator === "lte") {
      if (value < hi) {
        hi = value
        hiOpen = false
      }
    } else {
      if (value < hi) {
        hi = value
        hiOpen = true
      } else if (value === hi) hiOpen = true
    }
  }

  if (hasExact) {
    if (!valueFitsKind(exact!, kind)) {
      return { empty: true, reason: `значение ${formatValue(exact!)} не бывает у поля типа «${kindNames[kind]}»` }
    }
    if (ordered && !inside(exact!, lo, loOpen, hi, hiOpen)) {
      return { empty: true, reason: `${formatValue(exact!)} вне ${intervalText(lo, loOpen, hi, hiOpen)}` }
    }
    if (forbidden.some((item) => Object.is(item, exact))) {
      return { empty: true, reason: `требуется одновременно = ${formatValue(exact!)} и ≠ ${formatValue(exact!)}` }
    }
    return { empty: false }
  }

  if (kind === "boolean") {
    const allowed = [true, false].filter((value) => !forbidden.some((item) => Object.is(item, value)))
    if (!allowed.length) return { empty: true, reason: "исключены оба значения признака" }
    return { empty: false }
  }

  if (kind === "number" || (kind === "other" && ordered)) {
    if (lo > hi || (lo === hi && (loOpen || hiOpen))) {
      return { empty: true, reason: `пустой интервал ${intervalText(lo, loOpen, hi, hiOpen)}` }
    }
    if (lo === hi && forbidden.some((value) => Object.is(value, lo))) {
      return { empty: true, reason: `единственное значение ${lo} исключено условием ≠ ${lo}` }
    }
  }

  return { empty: false }
}

function valueFitsKind(value: FtsScalar, kind: FieldKind): boolean {
  if (kind === "number") return typeof value === "number"
  if (kind === "boolean") return typeof value === "boolean"
  if (kind === "string") return typeof value === "string"
  return true
}

function inside(value: FtsScalar, lo: number, loOpen: boolean, hi: number, hiOpen: boolean): boolean {
  if (typeof value !== "number") return false
  if (loOpen ? !(value > lo) : !(value >= lo)) return false
  if (hiOpen ? !(value < hi) : !(value <= hi)) return false
  return true
}

const isConstant = (operand: FtsUtilityOperand): operand is { kind: "value"; value: FtsScalar } =>
  operand?.kind === "value"

/** Solves a whole conjunction; unanalysable as soon as one operand is not a constant. */
function solveConditions(
  conditions: FtsUtilityCondition[],
  kinds: Map<string, FieldKind>,
): { analyzable: false; field: string } | { analyzable: true; empty: boolean; reason?: string } {
  const byField = new Map<string, Array<{ operator: FtsUtilityComparison; value: FtsScalar }>>()
  for (const condition of conditions) {
    if (!isConstant(condition.value)) return { analyzable: false, field: condition.field }
    const list = byField.get(condition.field) ?? []
    list.push({ operator: condition.operator, value: condition.value.value })
    byField.set(condition.field, list)
  }

  for (const [field, comparisons] of byField) {
    const solved = solveField(kinds.get(field) ?? "other", comparisons)
    if (solved.empty) return { analyzable: true, empty: true, reason: solved.reason }
  }
  return { analyzable: true, empty: false }
}

/* ────────────────────────────── the partition ──────────────────────────── */

type Cell =
  | { kind: "any" }
  | { kind: "point"; value: number }
  | { kind: "interval"; lo: number; loOpen: boolean; hi: number; hiOpen: boolean }
  | { kind: "value"; value: FtsScalar }
  | { kind: "other" }

interface Axis {
  field: string
  kind: FieldKind
  cells: Cell[]
  samples: FtsScalar[][]
}

/** Fields the utility depends on at all: conditions, actions, properties. */
function mentionedFields(utility: FtsUtility): Set<string> {
  const seen = new Set<string>()
  const operand = (value: FtsUtilityOperand | undefined): void => {
    if (value?.kind === "field" || value?.kind === "percent") seen.add(value.field)
  }
  for (const rule of utility.rules ?? []) {
    for (const condition of rule.when) {
      seen.add(condition.field)
      operand(condition.value)
    }
    operand(rule.action?.value)
  }
  for (const property of utility.properties ?? []) operand(property.value)
  return seen
}

function conditionConstants(utility: FtsUtility, field: string): FtsScalar[] {
  const values: FtsScalar[] = []
  for (const rule of utility.rules ?? []) {
    for (const condition of rule.when) {
      if (condition.field !== field) continue
      if (!isConstant(condition.value)) continue
      values.push(condition.value.value)
    }
  }
  return values
}

function numericCells(thresholds: number[]): Cell[] {
  const cells: Cell[] = [{ kind: "interval", lo: -Infinity, loOpen: true, hi: thresholds[0] ?? Infinity, hiOpen: true }]
  thresholds.forEach((threshold, index) => {
    cells.push({ kind: "point", value: threshold })
    cells.push({ kind: "interval", lo: threshold, loOpen: true, hi: thresholds[index + 1] ?? Infinity, hiOpen: true })
  })
  return cells
}

/**
 * Representatives of a numeric cell.
 *
 * A point stands for itself. A bounded interval gives its quarters and middle.
 * A half-infinite one gives three points of growing distance: a property like
 * "the result is at most a percentage of a field" breaks not at the boundary
 * but on growth, and one point near the threshold would miss it.
 */
function numericSamples(cell: Cell): number[] {
  if (cell.kind === "point") return [unminus(cell.value)]
  if (cell.kind !== "interval") return [0]
  const { lo, hi } = cell
  let raw: number[]
  if (lo === -Infinity && hi === Infinity) raw = [-1000000, 0, 1000000]
  else if (lo === -Infinity) raw = [hi - 1, hi - 1000, hi - 1000000]
  else if (hi === Infinity) raw = [lo + 1, lo + 1000, lo + 1000000]
  else raw = [lo + (hi - lo) / 4, (lo + hi) / 2, hi - (hi - lo) / 4]
  const within = raw.map(unminus).filter((value) => Number.isFinite(value) && value > lo && value < hi)
  const unique = [...new Set(within)].sort((left, right) => left - right)
  if (unique.length) return unique
  const middle = (lo + hi) / 2
  return Number.isFinite(middle) ? [unminus(middle)] : []
}

function defaultValue(kind: FieldKind): FtsScalar {
  if (kind === "number") return 0
  if (kind === "boolean") return false
  if (kind === "string") return ""
  return null
}

function outsider(taken: string[]): string {
  for (const candidate of ["иное", "прочее", "x"]) if (!taken.includes(candidate)) return candidate
  return `иное-${taken.length}`
}

/**
 * One axis per field of the input object. A field mentioned nowhere collapses
 * into a single cell: the result cannot depend on it, and extra cells only
 * inflate the partition.
 */
function buildAxes(structure: FtsStructure, utility: FtsUtility, limits: CoverageBudget): Axis[] {
  const used = mentionedFields(utility)
  const axes: Axis[] = []

  for (const field of structure.fields) {
    const kind = typeKind(field.type)
    if (!used.has(field.name) || kind === "other") {
      axes.push({ field: field.name, kind, cells: [{ kind: "any" }], samples: [[defaultValue(kind)]] })
      continue
    }

    if (kind === "number") {
      const numbers = new Set<number>([0])
      for (const value of conditionConstants(utility, field.name)) {
        if (typeof value === "number" && Number.isFinite(value)) numbers.add(unminus(value))
      }
      const thresholds = [...numbers].sort((left, right) => left - right).slice(0, limits.valuesPerAxis)
      const cells = numericCells(thresholds)
      axes.push({ field: field.name, kind, cells, samples: cells.map(numericSamples) })
      continue
    }

    if (kind === "boolean") {
      const cells: Cell[] = [{ kind: "value", value: false }, { kind: "value", value: true }]
      axes.push({ field: field.name, kind, cells, samples: [[false], [true]] })
      continue
    }

    const strings = [...new Set(conditionConstants(utility, field.name).filter((value) => typeof value === "string"))]
      .sort()
      .slice(0, limits.valuesPerAxis) as string[]
    const cells: Cell[] = strings.map((value) => ({ kind: "value", value }))
    cells.push({ kind: "other" })
    axes.push({
      field: field.name,
      kind,
      cells,
      samples: [...strings.map((value) => [value as FtsScalar]), [outsider(strings)]],
    })
  }

  return axes
}

/**
 * The product of axis cells. The budget is cut deterministically: the widest
 * axis loses its tail until the product fits, so a repeated run gives the same
 * partition.
 */
function buildCells(axes: Axis[], limits: CoverageBudget, rules: number): { coords: number[][]; trimmed: string[] } {
  const budget = Math.max(
    1,
    Math.min(limits.cells, Math.floor(limits.evaluations / (limits.samplesPerCell * Math.max(rules, 1)))),
  )
  const widths = axes.map((axis) => axis.cells.length)
  const trimmed: string[] = []
  const size = (): number => widths.reduce((total, width) => total * Math.max(width, 1), 1)
  for (let guard = 0; size() > budget && guard < 10000; guard += 1) {
    let widest = 0
    for (let index = 1; index < widths.length; index += 1) if (widths[index]! > widths[widest]!) widest = index
    if (widths[widest]! <= 1) break
    widths[widest]! -= 1
    if (!trimmed.includes(axes[widest]!.field)) trimmed.push(axes[widest]!.field)
  }

  let coords: number[][] = [[]]
  axes.forEach((_, index) => {
    const next: number[][] = []
    for (const prefix of coords) for (let cell = 0; cell < widths[index]!; cell += 1) next.push([...prefix, cell])
    coords = next
  })
  return { coords, trimmed }
}

function cellSamples(axes: Axis[], coords: number[], limits: CoverageBudget): Array<Record<string, FtsScalar>> {
  let lists = axes.map((axis, index) => axis.samples[coords[index]!] ?? [defaultValue(axis.kind)])
  const size = (): number => lists.reduce((total, list) => total * Math.max(list.length, 1), 1)
  for (let guard = 0; size() > limits.samplesPerCell && guard < 1000; guard += 1) {
    let widest = 0
    for (let index = 1; index < lists.length; index += 1) if (lists[index]!.length > lists[widest]!.length) widest = index
    if (lists[widest]!.length <= 1) break
    /* Drops the middle representative, never the extremes: the far point is
       what catches a property that breaks on growth. */
    lists = lists.map((list, index) => (index === widest ? [...list.slice(0, -2), list[list.length - 1]!] : list))
  }

  let points: Array<Record<string, FtsScalar>> = [{}]
  axes.forEach((axis, index) => {
    const next: Array<Record<string, FtsScalar>> = []
    for (const point of points) for (const value of lists[index]!) next.push({ ...point, [axis.field]: value })
    points = next
  })
  return points
}

/* ─────────────────────── merging cells into boxes ──────────────────────── */

type Box = Array<[number, number]>

/**
 * Merge cells into few rectangular regions — for reading, not for counting.
 *
 * "«сумма» ∈ (−∞, 10000), «постоянный клиент» = нет" is one sentence; the
 * three cells it stands for are three. The merge sweeps one axis at a time:
 * cells that agree on every other axis are sorted along this one and joined
 * where they touch. That is O(axes · n log n), against the O(n²) per merge of
 * comparing every box with every other — on a five-field model the difference
 * is half a second against a millisecond, on every keystroke.
 *
 * The decomposition it finds is good, not minimal; a minimal one is neither
 * cheap nor needed to read a region out loud.
 */
function mergeBoxes(list: number[][]): Box[] {
  let boxes: Box[] = list.map((coords) => coords.map((index) => [index, index] as [number, number]))
  const axes = boxes[0]?.length ?? 0

  for (let axis = 0; axis < axes; axis += 1) {
    const groups = new Map<string, Box[]>()
    for (const box of boxes) {
      const key = box.map((range, index) => (index === axis ? "*" : `${range[0]}:${range[1]}`)).join("|")
      const group = groups.get(key)
      if (group) group.push(box)
      else groups.set(key, [box])
    }

    const merged: Box[] = []
    for (const group of groups.values()) {
      group.sort((left, right) => left[axis]![0] - right[axis]![0])
      let current = group[0]!
      for (let index = 1; index < group.length; index += 1) {
        const box = group[index]!
        if (box[axis]![0] === current[axis]![1] + 1) current[axis]![1] = box[axis]![1]
        else {
          merged.push(current)
          current = box
        }
      }
      merged.push(current)
    }
    boxes = merged
  }

  return boxes
}

/**
 * How many findings of one kind one utility may report.
 *
 * A bound on output, not on analysis: everything is still computed, and what
 * does not fit is counted and named as withheld rather than dropped in
 * silence.
 */
const reportLimit = 8

/** Regions in a message, capped: a diagnostic must stay a sentence. */
function describeRegions(axes: Axis[], boxes: Box[]): string {
  const shown = boxes.slice(0, 3).map((box) => describeBox(axes, box))
  const rest = boxes.length - shown.length
  return rest > 0 ? `${shown.join("; ")} и ещё ${rest} ${plural(rest, "область", "области", "областей")}` : shown.join("; ")
}

function plural(count: number, one: string, few: string, many: string): string {
  const tail = count % 100
  if (tail > 10 && tail < 20) return many
  if (count % 10 === 1) return one
  if (count % 10 >= 2 && count % 10 <= 4) return few
  return many
}

const numberText = (value: number): string =>
  value === -Infinity ? "−∞" : value === Infinity ? "+∞" : String(unminus(value))

function intervalText(lo: number, loOpen: boolean, hi: number, hiOpen: boolean): string {
  const left = lo === -Infinity ? "(−∞" : `${loOpen ? "(" : "["}${numberText(lo)}`
  const right = hi === Infinity ? "+∞)" : `${numberText(hi)}${hiOpen ? ")" : "]"}`
  return `${left}, ${right}`
}

/** The numeric bounds a range of cells of one axis stands for. */
function rangeBounds(axis: Axis, [from, to]: [number, number]): { lo: number; loOpen: boolean; hi: number; hiOpen: boolean } {
  const first = axis.cells[from]!
  const last = axis.cells[to]!
  const lo = first.kind === "point" ? first.value : first.kind === "interval" ? first.lo : -Infinity
  const loOpen = first.kind === "point" ? false : first.kind === "interval" ? first.loOpen : true
  const hi = last.kind === "point" ? last.value : last.kind === "interval" ? last.hi : Infinity
  const hiOpen = last.kind === "point" ? false : last.kind === "interval" ? last.hiOpen : true
  return { lo, loOpen, hi, hiOpen }
}

function describeRange(axis: Axis, range: [number, number]): string | null {
  const [from, to] = range
  if (from === 0 && to === axis.cells.length - 1) return null
  if (axis.kind === "number") {
    const { lo, loOpen, hi, hiOpen } = rangeBounds(axis, range)
    if (lo === hi) return `= ${numberText(lo)}`
    return `∈ ${intervalText(lo, loOpen, hi, hiOpen)}`
  }
  const values = axis.cells.slice(from, to + 1).map((cell) => (cell.kind === "value" ? formatValue(cell.value) : "иное"))
  if (values.length === 1) return `= ${values[0]}`
  return `∈ {${values.join(", ")}}`
}

function describeBox(axes: Axis[], box: Box): string {
  const parts: string[] = []
  axes.forEach((axis, index) => {
    if (axis.cells.length === 1) return
    const text = describeRange(axis, box[index]!)
    if (text) parts.push(`«${axis.field}» ${text}`)
  })
  return parts.length ? parts.join(", ") : "любой вход"
}

/** The same box written as surface conditions, ready to paste into a rule. */
function boxConditions(axes: Axis[], box: Box): string[] {
  const parts: string[] = []
  axes.forEach((axis, index) => {
    if (axis.cells.length === 1) return
    const range = box[index]!
    if (range[0] === 0 && range[1] === axis.cells.length - 1) return
    if (axis.kind === "number") {
      const { lo, loOpen, hi, hiOpen } = rangeBounds(axis, range)
      if (lo === hi) {
        parts.push(`«${axis.field}» равно ${numberText(lo)}`)
        return
      }
      if (Number.isFinite(lo)) parts.push(`«${axis.field}» ${loOpen ? "больше" : "не меньше"} ${numberText(lo)}`)
      if (Number.isFinite(hi)) parts.push(`«${axis.field}» ${hiOpen ? "меньше" : "не больше"} ${numberText(hi)}`)
      return
    }
    const cells = axis.cells.slice(range[0], range[1] + 1)
    if (cells.length === 1 && cells[0]!.kind === "value") {
      parts.push(`«${axis.field}» равно ${formatValue((cells[0] as { value: FtsScalar }).value)}`)
    }
  })
  return parts
}

/** A witness written the way an example writes its input. */
function witnessText(witness: Record<string, FtsScalar>): string {
  return Object.entries(witness)
    .map(([field, value]) => `«${field}» = ${formatValue(value)}`)
    .join(", ")
}

function exampleText(witness: Record<string, FtsScalar>, expected: FtsScalar): string {
  const given = Object.entries(witness).map(([field, value]) => `дано «${field}» равно ${formatValue(value)}`)
  return `${given.join("; ")}; ожидается результат равен ${formatValue(expected)}`
}

/* ─────────────────────────── analysis of a utility ─────────────────────── */

interface CellReport {
  coords: number[]
  /** Rules that fired on every representative of the cell. */
  firing: number[]
  /** Rules that fired on some representatives only. */
  partial: number[]
  hole: boolean
  points: Array<{ input: Record<string, FtsScalar>; result: FtsScalar; ok: boolean }>
}

function analyzeUtility(
  utility: FtsUtility,
  structure: FtsStructure,
  limits: CoverageBudget,
  diagnostics: Diagnostic[],
): void {
  const kinds = new Map(structure.fields.map((field) => [field.name, typeKind(field.type)]))
  const axes = buildAxes(structure, utility, limits)
  const rules = utility.rules ?? []
  const { coords, trimmed } = buildCells(axes, limits, rules.length)

  if (trimmed.length) {
    diagnostics.push({
      code: coverageCodes.truncated,
      message:
        `разбиение утилиты «${utility.name}» усечено по бюджету по полям ${trimmed.map((field) => `«${field}»`).join(", ")} — ` +
        "часть области входов не разобрана, находок может быть больше",
      severity: "info",
      hint: `полный разбор без бюджета: node tools/ftsmap/bin/ftsmap.mjs <файл> --utility «${utility.name}» --text`,
      ...spanFields(spanOf(utility)),
    })
  }

  /* ── rule regions from interval arithmetic: only emptiness is proven here ── */
  const dead = new Set<number>()
  rules.forEach((rule, index) => {
    const solved = solveConditions(rule.when, kinds)
    if (!solved.analyzable) {
      diagnostics.push({
        code: coverageCodes.unanalyzedRule,
        message:
          `условие правила «${rule.name}» сравнивает поле «${solved.field}» не с константой — ` +
          "область правила определена исполнением на представителях, а не доказана",
        severity: "info",
        hint: `находки об этом правиле проверяйте свидетелями; полный разбор — tools/ftsmap`,
        ...spanFields(spanOf(rule)),
      })
      return
    }
    if (!solved.empty) return
    dead.add(index)
    diagnostics.push({
      code: coverageCodes.unreachableRule,
      message: `правило «${rule.name}» не срабатывает никогда: ${solved.reason}`,
      severity: "warning",
      hint: `условие невыполнимо ни на одном входе — исправьте или уберите одно из сравнений «если» правила «${rule.name}»`,
      ...spanFields(spanOf(rule)),
    })
  })

  /* ── cells: who fires, where nothing does ── */
  const cells: CellReport[] = []
  for (const coord of coords) {
    const points = cellSamples(axes, coord, limits)
    const fired = rules.map(() => 0)
    const decided = rules.map(() => 0)
    const results: CellReport["points"] = []

    for (const input of points) {
      const trace = traceUtility(utility, input)
      results.push({ input, result: trace.result, ok: trace.ok })
      if (!trace.ok) continue
      rules.forEach((_, index) => {
        decided[index]! += 1
        if (trace.fired[index]) fired[index]! += 1
      })
    }

    const firing: number[] = []
    const partial: number[] = []
    rules.forEach((_, index) => {
      if (fired[index] === 0) return
      if (fired[index] === decided[index]) firing.push(index)
      else partial.push(index)
    })

    cells.push({
      coords: coord,
      firing,
      partial,
      hole: firing.length === 0 && partial.length === 0 && results.some((point) => point.ok),
      points: results,
    })
  }

  /* ── holes ── */
  const holes = mergeBoxes(cells.filter((cell) => cell.hole).map((cell) => cell.coords))
  for (const box of holes.slice(0, reportLimit)) {
    const where = describeBox(axes, box)
    const witness = witnessOf(cells, box)
    const conditions = boxConditions(axes, box)
    const rule = conditions.length ? `правило с условиями «${conditions.join("», «")}»` : "правило, покрывающее эту область"
    diagnostics.push({
      code: coverageCodes.hole,
      message:
        `при ${where} не срабатывает ни одно правило — результат остаётся начальным (${formatValue(utility.initial)})`,
      severity: "warning",
      hint:
        witness === null
          ? `добавьте ${rule} — либо закрепите начальное значение примером на этой области`
          : `если ${formatValue(utility.initial)} здесь верно — закрепите это примером «${exampleText(witness, utility.initial)}»; ` +
            `если нет — добавьте ${rule}`,
      ...spanFields(spanOf(utility)),
    })
  }

  /* ── overlaps ── */
  let reportedOrder = 0
  let reportedPlain = 0
  let hiddenOverlaps = 0
  for (let a = 0; a < rules.length; a += 1) {
    if (dead.has(a)) continue
    for (let b = a + 1; b < rules.length; b += 1) {
      if (dead.has(b)) continue
      const shared = cells.filter(
        (cell) =>
          (cell.firing.includes(a) || cell.partial.includes(a)) && (cell.firing.includes(b) || cell.partial.includes(b)),
      )
      if (!shared.length) continue

      const kind = classifyActions(rules[a]!, rules[b]!)
      /* A table of fifty rules overlaps in a thousand pairs, and a thousand
         diagnostics are no more readable than none. Order-dependent pairs are
         reported first because those are the ones where the outcome is at
         stake; the rest is counted, not printed. */
      const reported = kind.orderDependent ? reportedOrder : reportedPlain
      if (reported >= reportLimit) {
        hiddenOverlaps += 1
        continue
      }
      if (kind.orderDependent) reportedOrder += 1
      else reportedPlain += 1

      const regions = describeRegions(axes, mergeBoxes(shared.map((cell) => cell.coords)))
      diagnostics.push({
        code: kind.orderDependent ? coverageCodes.overlapOrder : coverageCodes.overlap,
        message:
          `правила «${rules[a]!.name}» и «${rules[b]!.name}» применимы одновременно при ${regions}: ${kind.note}`,
        severity: kind.orderDependent ? "warning" : "info",
        ...(kind.orderDependent ? { hint: overlapHint(rules[a]!, rules[b]!) } : {}),
        ...spanFields(spanOf(rules[a]!)),
      })
    }
  }

  const hiddenHoles = Math.max(holes.length - reportLimit, 0)
  if (hiddenOverlaps + hiddenHoles > 0) {
    const parts: string[] = []
    if (hiddenHoles) parts.push(`${hiddenHoles} ${plural(hiddenHoles, "область", "области", "областей")} без правил`)
    if (hiddenOverlaps) parts.push(`${hiddenOverlaps} ${plural(hiddenOverlaps, "пара", "пары", "пар")} перекрывающихся правил`)
    diagnostics.push({
      code: coverageCodes.truncated,
      message: `у утилиты «${utility.name}» показаны не все находки: осталось ещё ${parts.join(" и ")}`,
      severity: "info",
      hint: `полный список: node tools/ftsmap/bin/ftsmap.mjs <файл> --utility «${utility.name}» --text`,
      ...spanFields(spanOf(utility)),
    })
  }

  /* ── property reachability ── */
  for (const property of utility.properties ?? []) {
    analyzeProperty(utility, property, axes, cells, diagnostics)
  }
}

/**
 * A representative of the box to show the author.
 *
 * Every point of a hole box is an equally valid witness, so the choice is one
 * of readability: the smallest numbers win. "«сумма» = 0" is a witness a
 * reader can check in their head; "«сумма» = -1000000" is the same fact
 * written so that it looks like a corner case.
 */
function witnessOf(cells: CellReport[], box: Box): Record<string, FtsScalar> | null {
  let best: Record<string, FtsScalar> | null = null
  let bestScore = Infinity
  for (const cell of cells) {
    if (!cell.coords.every((index, axis) => index >= box[axis]![0] && index <= box[axis]![1])) continue
    for (const point of cell.points) {
      if (!point.ok) continue
      const score = Object.values(point.input).reduce<number>(
        (total, value) => total + (typeof value === "number" ? Math.abs(value) : 0),
        0,
      )
      if (score >= bestScore) continue
      bestScore = score
      best = point.input
    }
  }
  return best
}

/**
 * Compatibility of two actions. Inside ONE utility the order of rules is
 * defined — top to bottom — so an overlap is not ambiguity but a dependency of
 * the result on the order of lines in the file.
 */
function classifyActions(left: FtsUtilityRule, right: FtsUtilityRule): { orderDependent: boolean; note: string } {
  const key = (operand: FtsUtilityOperand): string => JSON.stringify(operand)
  if (left.action.kind === "add" && right.action.kind === "add") {
    return { orderDependent: false, note: "оба добавляют — вклады складываются, порядок не важен" }
  }
  if (left.action.kind === "set" && right.action.kind === "set") {
    if (key(left.action.value) === key(right.action.value)) {
      return { orderDependent: false, note: "оба кладут одно и то же значение" }
    }
    return { orderDependent: true, note: "оба кладут результат, но разные значения — побеждает объявленное ниже" }
  }
  return {
    orderDependent: true,
    note: "одно кладёт результат целиком, другое добавляет — итог зависит от порядка объявления",
  }
}

/**
 * How to make an order-dependent overlap impossible.
 *
 * Adding to the upper rule the negation of ANY ONE condition of the lower rule
 * makes their regions disjoint: on the intersection that condition would have
 * to hold and not hold at once. So the advice is a single line the author can
 * paste, not "review the logic".
 */
function overlapHint(upper: FtsUtilityRule, lower: FtsUtilityRule): string {
  const condition = lower.when.find((item) => isConstant(item.value))
  const reorder = `либо объявите «${lower.name}» выше «${upper.name}», если побеждать должно оно`
  if (!condition) {
    return `сузьте условие одного из правил так, чтобы области не пересекались, ${reorder}`
  }
  const negation = `если «${condition.field}» ${operatorPhrase[negated[condition.operator]]} ${operandSurface(condition.value)}`
  return `добавьте в «${upper.name}» условие «${negation}» — отрицание условия «${lower.name}», области перестанут пересекаться; ${reorder}`
}

/**
 * Reachability of a property.
 *
 * The question is put the way it matters in practice: not "does the property
 * hold" (it almost always holds, otherwise the model would not run) but "is
 * there an input on which the property constrains anything at all". A property
 * whose limit the rules never reach is checked by nothing: it could be
 * tightened twofold and not one example would change.
 *
 * Equality with the initial value counts as a degenerate touch: "0 ≤ 20 % of 0"
 * is true and says nothing about the rules.
 */
function analyzeProperty(
  utility: FtsUtility,
  property: FtsUtilityProperty,
  axes: Axis[],
  cells: CellReport[],
  diagnostics: Diagnostic[],
): void {
  const violatedCells: number[][] = []
  let violation: { where: number[]; input: Record<string, FtsScalar>; result: FtsScalar; limit: FtsScalar } | null = null
  let attained = 0
  let realAttainment = 0
  let considered = 0
  let maxRatio: number | null = null

  for (const cell of cells) {
    const firing = cell.firing.length + cell.partial.length > 0
    let violatedHere = false
    for (const point of cell.points) {
      if (!point.ok) continue
      let limit: FtsScalar
      let holds: boolean
      try {
        limit = propertyLimit(property, point.input, point.result)
        holds = compareValues(point.result, property.operator, limit)
      } catch {
        continue
      }
      considered += 1

      if (!holds) {
        violatedHere = true
        if (violation === null) violation = { where: cell.coords, input: point.input, result: point.result, limit }
        continue
      }
      if (Object.is(point.result, limit)) {
        attained += 1
        if (firing && !Object.is(point.result, utility.initial)) realAttainment += 1
        continue
      }
      if (
        typeof point.result === "number" &&
        typeof limit === "number" &&
        limit !== 0 &&
        Number.isFinite(point.result / limit)
      ) {
        const ratio = point.result / limit
        if (maxRatio === null || ratio > maxRatio) maxRatio = ratio
      }
    }
    if (violatedHere) violatedCells.push(cell.coords)
  }

  if (violation !== null) {
    const where = describeBox(axes, mergeBoxes(violatedCells)[0] ?? violation.where.map((index) => [index, index]))
    diagnostics.push({
      code: coverageCodes.propertyViolated,
      message:
        `свойство «${property.name}» нарушается при ${where}: ` +
        `результат ${formatValue(violation.result)} против предела ${formatValue(violation.limit)}`,
      severity: "warning",
      hint: violationHint(utility, property, violation),
      ...spanFields(spanOf(property)),
    })
  }

  const unattainable = realAttainment === 0 && considered > 0
  if (!unattainable) return

  /* A ratio only reads as "how close the rules got" for an upper bound. For a
     floor, result/limit above one says nothing about approach, so it is not
     printed rather than printed as a number that means nothing. */
  const near = isUpperBound(property) && maxRatio !== null && maxRatio > 0 && maxRatio < 1
    ? `; ближайший подход — ${formatRatio(maxRatio)} от предела`
    : ""
  const equality = attained
    ? `равенство встречается только там, где результат остаётся начальным (${formatValue(utility.initial)})`
    : "равенство не встретилось ни в одной точке выборки"
  diagnostics.push({
    code: coverageCodes.propertyUnattainable,
    message:
      `свойство «${property.name}» недостижимо: предел «результат ${operatorText[property.operator]} ` +
      `${operandText(property.value)}» не берётся нигде, где правила меняют результат — ${equality}${near}`,
    severity: "warning",
    hint: unattainableHint(utility, property, maxRatio, attained > 0),
    ...spanFields(spanOf(property)),
  })
}

const isUpperBound = (property: FtsUtilityProperty): boolean =>
  property.operator === "lte" || property.operator === "lt"

/**
 * What to tighten, in numbers.
 *
 * When the limit is an upper bound the rules approach but never reach, the
 * ratio says exactly how far they get: a limit of 20 % that the rules touch at
 * 75 % is really a limit of 15 %. That number is the advice.
 */
function unattainableHint(
  utility: FtsUtility,
  property: FtsUtilityProperty,
  maxRatio: number | null,
  touchedInitial: boolean,
): string {
  if (isUpperBound(property) && maxRatio !== null && maxRatio > 0 && maxRatio < 1) {
    const operand = property.value
    if (operand.kind === "value" && typeof operand.value === "number") {
      return (
        `правила дотягивают до ${round(operand.value * maxRatio)} — ужесточите предел до этого значения ` +
        `(ни один пример не изменится) либо добавьте правило, которое доходит до ${formatValue(operand.value)}`
      )
    }
    if (operand.kind === "percent") {
      return (
        `правила дотягивают до ${round(operand.percent * maxRatio)} % от поля «${operand.field}» — ` +
        `запишите пределом это значение (ни один пример не изменится) либо добавьте правило, ` +
        `доходящее до ${operand.percent} %`
      )
    }
  }
  if (!isUpperBound(property) && touchedInitial) {
    return (
      `нижняя граница берётся только там, где результат остался начальным (${formatValue(utility.initial)}), ` +
      "и потому не проверяет ни одного правила: поднимите её выше начального значения либо перенесите " +
      "ограничение в условия правил («если поле больше 0»)"
    )
  }
  return (
    `свойство «${property.name}» сейчас не проверяет ни одного правила: подвиньте предел к значению, ` +
    "которого результат действительно достигает, либо добавьте правило и пример, доводящие его до предела"
  )
}

/** What to do about an input on which the core will refuse to run. */
function violationHint(
  utility: FtsUtility,
  property: FtsUtilityProperty,
  violation: { input: Record<string, FtsScalar>; result: FtsScalar; limit: FtsScalar },
): string {
  const witness = witnessText(violation.input)
  if (property.value.kind === "percent") {
    const field = property.value.field
    const value = violation.input[field]
    if (typeof value === "number" && value < 0) {
      return (
        `предел «${operandText(property.value)}» меняет знак вместе с полем «${field}»: при «${field}» = ${formatValue(value)} ` +
        `он равен ${formatValue(violation.limit)}. Задайте предел числом либо добавьте в правила условие «${field}» больше 0`
      )
    }
  }
  return (
    `ядро откажет на входе ${witness} с кодом FTS_UTILITY_PROPERTY: ` +
    `закройте эту область правилом либо перепишите предел свойства «${property.name}» так, чтобы он выполнялся и здесь`
  )
}

function formatRatio(ratio: number): string {
  return `${String(round(ratio * 100)).replace(".", ",")} %`
}

function round(value: number): number {
  return Math.round(value * 1e6) / 1e6
}

function spanFields(span: SourceSpan | undefined): { span?: SourceSpan } {
  return span === undefined ? {} : { span }
}
