/**
 * Карта покрытия правил: что срабатывает, где правила накладываются и — главное —
 * где не срабатывает НИЧЕГО.
 *
 * Вопрос, на который отвечает файл: «как выглядит пространство входов утилиты,
 * если раскрасить его по тому, какие правила там применимы?» Обычные проверки
 * идут от правил («покрыто ли правило примером»); карта идёт от ВХОДОВ и
 * поэтому видит то, чего в правилах нет вовсе: области, где результат остаётся
 * начальным, потому что автор о них не подумал.
 *
 * Три не-очевидных решения.
 *
 * 1. РАЗБИЕНИЕ НА КЛЕТКИ. Условие правила — конъюнкция сравнений поля с
 *    константой (см. `tools/ftspec/src/intervals.mjs`). Значит истинность
 *    каждого атомарного сравнения `поле op константа` меняется только в самих
 *    константах. Собрав по каждому числовому полю все константы его условий,
 *    получаем разбиение оси на чередующиеся куски: открытый интервал, точка‑
 *    порог, открытый интервал, … Внутри клетки произведения таких кусков
 *    поведение любого анализируемого условия ПОСТОЯННО. Клеток конечное число,
 *    и на них считается всё сразу: области правил, пересечения, дыры.
 *
 * 2. НОЛЬ — ВСЕГДА ПОРОГ. Операнды вида «процент от поля» меняют знак вместе с
 *    полем, поэтому граница «поле < 0 / поле > 0» отделяет качественно разные
 *    режимы, даже если в условиях нуля нет. Без этого порога дыра на
 *    отрицательных суммах сливается с обычной областью и перестаёт быть видна —
 *    ровно тот случай, ради которого карта и делается.
 *
 * 3. ЧТО СЧИТАЕТСЯ ИСПОЛНЕНИЕМ, А ЧТО — АНАЛИЗОМ. Область правила берётся из
 *    интервального анализа (единственный источник истины о том, разрешимо ли
 *    условие вообще). А срабатывание в клетке и значение результата берутся
 *    ИСПОЛНЕНИЕМ через ядро: только так корректно учитываются условия, которые
 *    интервальный анализ честно не берёт (операнд-поле, процент, накопленный
 *    результат). Если правило в одной клетке ведёт себя по-разному на разных
 *    представителях, клетка помечается «смешанной», а не выдаётся за
 *    проверенную.
 *
 * Чего метод не видит — см. README: зависимости между полями, нелинейности,
 * значения между представителями клетки. Это выборка, а не доказательство.
 */
import { evaluateUtility } from "../../../dist/src/index.js"
import { ruleFires } from "../../ftspec/src/coverage.mjs"
import {
  BOOLEAN,
  NUMBER,
  OTHER,
  STRING,
  formatValue,
  isConstantOperand,
  intersectConditions,
  solveConditions,
  typeKind,
} from "../../ftspec/src/intervals.mjs"

export const codes = {
  hole: "FTSMAP_HOLE",
  overlap: "FTSMAP_OVERLAP",
  overlapOrder: "FTSMAP_OVERLAP_ORDER",
  deadRule: "FTSMAP_DEAD_RULE",
  propertyViolated: "FTSMAP_PROPERTY_VIOLATED",
  propertyUnattainable: "FTSMAP_PROPERTY_UNATTAINABLE",
  unanalyzed: "FTSMAP_UNANALYZED",
  truncated: "FTSMAP_TRUNCATED",
  noUtilities: "FTSMAP_NO_UTILITIES",
  unknownUtility: "FTSMAP_UNKNOWN_UTILITY",
  noStructure: "FTSMAP_NO_STRUCTURE",
}

/** Бюджеты: карта обязана строиться за предсказуемое время на любой модели. */
export const limits = {
  cells: 4096,
  samplesPerCell: 27,
  valuesPerAxis: 12,
  mergeBoxes: 256,
}

/* ────────────────────────────── общие мелочи ────────────────────────────── */

const unminus = (value) => (Object.is(value, -0) ? 0 : value)

const isOptional = (type) => String(type).includes("undefined")

const numberText = (value) =>
  value === -Infinity ? "−∞" : value === Infinity ? "+∞" : String(unminus(value))

/** Печать интервала теми же скобками, что и в интервальном анализе. */
function intervalText(lo, loOpen, hi, hiOpen) {
  const left = lo === -Infinity ? "(−∞" : `${loOpen ? "(" : "["}${numberText(lo)}`
  const right = hi === Infinity ? "+∞)" : `${numberText(hi)}${hiOpen ? ")" : "]"}`
  return `${left}, ${right}`
}

const structureOf = (document, name) => (document.structures ?? []).find((item) => item.name === name)

/* ────────────────────────────────── оси ─────────────────────────────────── */

/** Поля, от которых утилита вообще зависит: условия, действия, свойства. */
function mentionedFields(utility) {
  const seen = new Set()
  const operand = (value) => {
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

/** Константы условий по полю — те точки, в которых меняется истинность сравнений. */
function conditionConstants(utility, field) {
  const values = []
  for (const rule of utility.rules ?? []) {
    for (const condition of rule.when) {
      if (condition.field !== field) continue
      if (!isConstantOperand(condition.value)) continue
      values.push(condition.value.value)
    }
  }
  return values
}

function numericCells(thresholds) {
  const cells = [{ kind: "interval", lo: -Infinity, loOpen: true, hi: thresholds[0], hiOpen: true }]
  thresholds.forEach((threshold, index) => {
    cells.push({ kind: "point", value: threshold })
    const next = thresholds[index + 1]
    cells.push({ kind: "interval", lo: threshold, loOpen: true, hi: next ?? Infinity, hiOpen: true })
  })
  return cells
}

/**
 * Представители клетки числовой оси.
 *
 * Для точки — она сама. Для ограниченного интервала — четверти и середина.
 * Для полубесконечного — три точки с растущим удалением: свойства вида
 * «результат не больше процента от поля» ломаются не у границы, а на росте,
 * и одной точки рядом с порогом для них мало.
 */
function numericSamples(cell) {
  if (cell.kind === "point") return [unminus(cell.value)]
  const { lo, hi } = cell
  let raw
  if (lo === -Infinity && hi === Infinity) raw = [-1000000, 0, 1000000]
  else if (lo === -Infinity) raw = [hi - 1, hi - 1000, hi - 1000000]
  else if (hi === Infinity) raw = [lo + 1, lo + 1000, lo + 1000000]
  else raw = [lo + (hi - lo) / 4, (lo + hi) / 2, hi - (hi - lo) / 4]
  const inside = raw.map(unminus).filter((value) => Number.isFinite(value) && value > lo && value < hi)
  const unique = [...new Set(inside)].sort((a, b) => a - b)
  if (unique.length) return unique
  const mid = (lo + hi) / 2
  return Number.isFinite(mid) ? [unminus(mid)] : []
}

/**
 * Оси карты: по одной на поле объекта.
 *
 * Поле, которое нигде не упоминается, схлопывается в одну клетку «любое»: от
 * него результат зависеть не может, а лишние клетки только раздувают разбиение.
 */
export function buildAxes(structure, utility) {
  const used = mentionedFields(utility)
  const axes = []

  for (const field of structure?.fields ?? []) {
    const kind = typeKind(field.type)
    const free = !used.has(field.name)
    const base = {
      field: field.name,
      type: field.type,
      kind,
      free,
      optional: isOptional(field.type),
    }

    if (free || kind === OTHER) {
      axes.push({ ...base, free: true, cells: [{ kind: "any" }], samples: [[defaultValue(kind)]] })
      continue
    }

    if (kind === NUMBER) {
      const numbers = new Set([0])
      for (const value of conditionConstants(utility, field.name)) {
        if (typeof value === "number" && Number.isFinite(value)) numbers.add(unminus(value))
      }
      const thresholds = [...numbers].sort((a, b) => a - b).slice(0, limits.valuesPerAxis)
      const cells = numericCells(thresholds)
      axes.push({ ...base, thresholds, cells, samples: cells.map(numericSamples) })
      continue
    }

    if (kind === BOOLEAN) {
      const cells = [
        { kind: "value", value: false },
        { kind: "value", value: true },
      ]
      axes.push({ ...base, thresholds: [], cells, samples: cells.map((cell) => [cell.value]) })
      continue
    }

    const strings = [...new Set(conditionConstants(utility, field.name).filter((value) => typeof value === "string"))]
      .sort()
      .slice(0, limits.valuesPerAxis)
    const cells = strings.map((value) => ({ kind: "value", value }))
    cells.push({ kind: "other", exclude: strings })
    axes.push({
      ...base,
      thresholds: strings,
      cells,
      samples: cells.map((cell) => [cell.kind === "value" ? cell.value : outsider(strings)]),
    })
  }

  return axes
}

function defaultValue(kind) {
  if (kind === NUMBER) return 0
  if (kind === BOOLEAN) return false
  if (kind === STRING) return ""
  return null
}

function outsider(taken) {
  for (const candidate of ["иное", "прочее", "x"]) if (!taken.includes(candidate)) return candidate
  return `иное-${taken.length}`
}

/* ───────────────────────────────── клетки ───────────────────────────────── */

/**
 * Произведение клеток осей. Бюджет режется детерминированно: у самой широкой
 * оси отрезается хвост, пока произведение не влезет; повторный запуск даёт то
 * же разбиение (приём взят из `ftspec/src/constitution.mjs`).
 */
export function buildCells(axes) {
  const widths = axes.map((axis) => axis.cells.length)
  const trimmed = []
  const size = () => widths.reduce((total, width) => total * Math.max(width, 1), 1)
  for (let guard = 0; size() > limits.cells && guard < 10000; guard += 1) {
    let widest = 0
    for (let index = 1; index < widths.length; index += 1) if (widths[index] > widths[widest]) widest = index
    if (widths[widest] <= 1) break
    widths[widest] -= 1
    if (!trimmed.includes(axes[widest].field)) trimmed.push(axes[widest].field)
  }

  let coords = [[]]
  axes.forEach((axis, index) => {
    const next = []
    for (const prefix of coords) for (let cell = 0; cell < widths[index]; cell += 1) next.push([...prefix, cell])
    coords = next
  })

  return { coords, trimmed, widths }
}

/** Точки-представители клетки: произведение представителей по осям, с бюджетом. */
function cellSamples(axes, coords) {
  let lists = axes.map((axis, index) => axis.samples[coords[index]] ?? [defaultValue(axis.kind)])
  const size = () => lists.reduce((total, list) => total * Math.max(list.length, 1), 1)
  for (let guard = 0; size() > limits.samplesPerCell && guard < 1000; guard += 1) {
    let widest = 0
    for (let index = 1; index < lists.length; index += 1) if (lists[index].length > lists[widest].length) widest = index
    if (lists[widest].length <= 1) break
    lists = lists.map((list, index) => (index === widest ? list.slice(0, -1) : list))
  }

  let points = [{}]
  axes.forEach((axis, index) => {
    const next = []
    for (const point of points) for (const value of lists[index]) next.push({ ...point, [axis.field]: value })
    points = next
  })
  return points
}

/* ─────────────────────────── склейка клеток в боксы ─────────────────────── */

function tryMerge(left, right) {
  let axis = -1
  for (let index = 0; index < left.length; index += 1) {
    if (left[index][0] === right[index][0] && left[index][1] === right[index][1]) continue
    if (axis !== -1) return null
    axis = index
  }
  if (axis === -1) return left
  const [leftLo, leftHi] = left[axis]
  const [rightLo, rightHi] = right[axis]
  if (leftHi + 1 !== rightLo && rightHi + 1 !== leftLo) return null
  const merged = left.map((range) => [...range])
  merged[axis] = [Math.min(leftLo, rightLo), Math.max(leftHi, rightHi)]
  return merged
}

/**
 * Склейка списка клеток в минимальное (жадно) число прямоугольных областей.
 * Нужна только для чтения человеком: «сумма ∈ (−∞, 10000) и клиент = нет»
 * понятнее, чем три отдельные клетки.
 */
export function mergeBoxes(list) {
  const boxes = list.map((coords) => coords.map((index) => [index, index]))
  if (boxes.length > limits.mergeBoxes) return boxes
  let changed = true
  while (changed) {
    changed = false
    search: for (let a = 0; a < boxes.length; a += 1) {
      for (let b = a + 1; b < boxes.length; b += 1) {
        const merged = tryMerge(boxes[a], boxes[b])
        if (!merged) continue
        boxes[a] = merged
        boxes.splice(b, 1)
        changed = true
        break search
      }
    }
  }
  return boxes
}

/** Описание диапазона клеток одной оси; `null` — ось не ограничена вовсе. */
export function describeRange(axis, [from, to]) {
  if (from === 0 && to === axis.cells.length - 1) return null
  const cells = axis.cells.slice(from, to + 1)

  if (axis.kind === NUMBER) {
    const first = cells[0]
    const last = cells[cells.length - 1]
    const lo = first.kind === "point" ? first.value : first.lo
    const loOpen = first.kind === "point" ? false : first.loOpen
    const hi = last.kind === "point" ? last.value : last.hi
    const hiOpen = last.kind === "point" ? false : last.hiOpen
    if (lo === hi) return `= ${numberText(lo)}`
    return `∈ ${intervalText(lo, loOpen, hi, hiOpen)}`
  }

  const values = cells.map((cell) => (cell.kind === "value" ? formatValue(cell.value) : "иное"))
  if (values.length === 1) return `= ${values[0]}`
  return `∈ {${values.join(", ")}}`
}

/** Человекочитаемое описание бокса. */
export function describeBox(axes, box) {
  const parts = []
  axes.forEach((axis, index) => {
    if (axis.cells.length === 1) return
    const text = describeRange(axis, box[index])
    if (text) parts.push(`«${axis.field}» ${text}`)
  })
  return parts.length ? parts.join(", ") : "любой вход"
}

/* ──────────────────────────── анализ утилиты ────────────────────────────── */

const withoutProperties = (utility) => ({ ...utility, properties: [] })

const propertyErrorCode = (error) => error?.diagnostics?.[0]?.code ?? null

/**
 * Предел свойства при данном входе.
 *
 * Приём: добавляем в конец утилиты правило без условий, которое КЛАДЁТ в
 * результат операнд свойства. Ядро само разрешит и «процент от поля», и
 * «накопленный результат» — своей же семантикой, без второй реализации.
 */
function limitAt(utility, property, input) {
  const probe = {
    ...utility,
    properties: [],
    rules: [...utility.rules, { name: "ftsmap:предел", when: [], action: { kind: "set", value: property.value } }],
  }
  try {
    return { ok: true, value: evaluateUtility(probe, input) }
  } catch (error) {
    return { ok: false, reason: error.message }
  }
}

/** Держится ли свойство — проверяем самим ядром: оно бросает ровно тогда, когда нарушено. */
function holdsAt(utility, property, input) {
  try {
    evaluateUtility({ ...utility, properties: [property] }, input)
    return true
  } catch (error) {
    if (propertyErrorCode(error) === "FTS_UTILITY_PROPERTY") return false
    return null
  }
}

function operandText(operand) {
  if (operand.kind === "value") return formatValue(operand.value)
  if (operand.kind === "field") return `поле «${operand.field}»`
  if (operand.kind === "percent") return `${operand.percent} % от поля «${operand.field}»`
  return "результат"
}

const actionText = (action) => `${action.kind === "set" ? "положить" : "добавить"} ${operandText(action.value)}`

const OPERATOR_TEXT = { eq: "=", neq: "≠", gte: "≥", lte: "≤", gt: ">", lt: "<" }

/** Непроанализируемые сравнения — те, где операнд не константа. */
function unanalyzedConditions(rule) {
  return rule.when
    .filter((condition) => !isConstantOperand(condition.value))
    .map((condition) => ({
      field: condition.field,
      operator: condition.operator,
      operand: condition.value.kind,
      text: `«${condition.field}» ${OPERATOR_TEXT[condition.operator]} ${operandText(condition.value)}`,
    }))
}

/**
 * Полный анализ одной утилиты.
 *
 * @param {object} document документ ядра
 * @param {object} utility утилита из документа
 */
export function analyzeUtility(document, utility) {
  const diagnostics = []
  const structure = structureOf(document, utility.input)
  if (!structure) {
    diagnostics.push({
      code: codes.noStructure,
      message: `у утилиты «${utility.name}» не найдена входная структура «${utility.input}»`,
      severity: "error",
    })
    return { name: utility.name, input: utility.input, analyzed: false, diagnostics }
  }

  const kinds = new Map(structure.fields.map((field) => [field.name, typeKind(field.type)]))
  const axes = buildAxes(structure, utility)
  const { coords, trimmed } = buildCells(axes)

  /* ── области правил из интервального анализа ── */
  const rules = (utility.rules ?? []).map((rule, index) => {
    const solved = solveConditions(rule.when, kinds)
    const unanalyzed = unanalyzedConditions(rule)
    const entry = {
      index,
      name: rule.name,
      action: { kind: rule.action.kind, text: actionText(rule.action) },
      conditions: rule.when.length,
      analyzable: solved.analyzable,
      empty: Boolean(solved.analyzable && solved.empty),
      unanalyzed,
      constrains: solved.analyzable && !solved.empty ? [...solved.fields.keys()] : [],
      free: [],
      conditionText: solved.analyzable && !solved.empty ? solved.text : null,
      witness: solved.analyzable && !solved.empty ? solved.witness : null,
      reason: solved.analyzable && solved.empty ? solved.reason : null,
      unanalyzedField: solved.analyzable ? null : solved.field,
      cells: [],
      partialCells: [],
      regions: [],
    }
    /* «Свободные» поля называем только там, где область ДОКАЗАНА: иначе
       список «правило не ограничивает ничего» врал бы про непроверенное. */
    entry.free =
      solved.analyzable && !solved.empty
        ? axes.map((axis) => axis.field).filter((field) => !entry.constrains.includes(field))
        : []

    if (entry.empty) {
      diagnostics.push({
        code: codes.deadRule,
        message: `правило «${rule.name}» не срабатывает никогда: ${solved.reason}`,
        severity: "error",
        details: { rule: rule.name, index, reason: solved.reason },
      })
    }
    if (!solved.analyzable) {
      diagnostics.push({
        code: codes.unanalyzed,
        message:
          `условие правила «${rule.name}» сравнивает поле «${solved.field}» не с константой — ` +
          "область правила определена исполнением на представителях клеток, а не доказана",
        severity: "warning",
        details: { rule: rule.name, index, field: solved.field },
      })
    }
    return entry
  })

  /* ── клетки: кто срабатывает, где дыры ── */
  const cells = []
  let mixedCells = 0
  let undecidedCells = 0

  for (const coord of coords) {
    const points = cellSamples(axes, coord)
    const fired = rules.map(() => 0)
    const failed = rules.map(() => 0)
    const unknown = rules.map(() => 0)
    const results = []
    let broken = 0

    for (const input of points) {
      rules.forEach((_, index) => {
        const outcome = ruleFires(utility, index, input)
        if (outcome === null) unknown[index] += 1
        else if (outcome) fired[index] += 1
        else failed[index] += 1
      })
      try {
        results.push({ input, result: evaluateUtility(withoutProperties(utility), input) })
      } catch (error) {
        broken += 1
        results.push({ input, result: undefined, error: error.message })
      }
    }

    const always = []
    const sometimes = []
    rules.forEach((_, index) => {
      if (fired[index] === 0) return
      if (failed[index] === 0 && unknown[index] === 0) always.push(index)
      else sometimes.push(index)
    })

    const mixed = sometimes.length > 0
    if (mixed) mixedCells += 1
    if (broken) undecidedCells += 1

    cells.push({
      index: cells.length,
      coords: coord,
      where: describeBox(axes, coord.map((index) => [index, index])),
      firing: always,
      partial: sometimes,
      hole: always.length === 0 && sometimes.length === 0 && broken < points.length,
      mixed,
      undecided: broken > 0,
      points,
      results,
    })
  }

  const cellAt = new Map(cells.map((cell) => [cell.coords.join(","), cell]))

  rules.forEach((rule) => {
    rule.cells = cells.filter((cell) => cell.firing.includes(rule.index)).map((cell) => cell.coords)
    rule.partialCells = cells.filter((cell) => cell.partial.includes(rule.index)).map((cell) => cell.coords)
    rule.regions = mergeBoxes(rule.cells).map((box) => describeBox(axes, box))
  })

  /* ── дыры ── */
  const holeCells = cells.filter((cell) => cell.hole)
  const holes = mergeBoxes(holeCells.map((cell) => cell.coords)).map((box) => ({
    box,
    where: describeBox(axes, box),
    result: utility.initial,
    witness: witnessOf(axes, box, cellAt),
  }))
  for (const hole of holes) {
    diagnostics.push({
      code: codes.hole,
      message:
        `при ${hole.where} не срабатывает ни одно правило — ` +
        `результат остаётся начальным (${formatValue(utility.initial)})`,
      severity: "warning",
      details: { where: hole.where, initial: utility.initial, witness: hole.witness },
    })
  }

  /* ── пересечения ── */
  const overlaps = []
  for (let a = 0; a < rules.length; a += 1) {
    for (let b = a + 1; b < rules.length; b += 1) {
      const shared = cells.filter(
        (cell) =>
          (cell.firing.includes(a) || cell.partial.includes(a)) && (cell.firing.includes(b) || cell.partial.includes(b)),
      )
      if (!shared.length) continue

      const solved = intersectConditions(utility.rules[a].when, utility.rules[b].when, kinds)
      const left = utility.rules[a].action
      const right = utility.rules[b].action
      const kind = classifyActions(left, right)
      const regions = mergeBoxes(shared.map((cell) => cell.coords)).map((box) => describeBox(axes, box))
      const overlap = {
        rules: [a, b],
        names: [rules[a].name, rules[b].name],
        regions,
        cells: shared.map((cell) => cell.coords),
        proven: solved.analyzable && !solved.empty,
        conditionText: solved.analyzable && !solved.empty ? solved.text : null,
        witness: solved.analyzable && !solved.empty ? solved.witness : (shared[0]?.points?.[0] ?? null),
        actions: [rules[a].action.text, rules[b].action.text],
        kind: kind.kind,
        orderDependent: kind.orderDependent,
        note: kind.note,
      }
      overlaps.push(overlap)

      diagnostics.push({
        code: kind.orderDependent ? codes.overlapOrder : codes.overlap,
        message:
          `правила «${rules[a].name}» и «${rules[b].name}» применимы одновременно при ${regions.join("; ")}: ` +
          kind.note,
        severity: kind.orderDependent ? "warning" : "info",
        details: { rules: [rules[a].name, rules[b].name], regions, kind: kind.kind },
      })
    }
  }

  /* ── достижимость свойств ── */
  const properties = (utility.properties ?? []).map((property) =>
    analyzeProperty(utility, property, axes, cells, diagnostics),
  )

  if (trimmed.length) {
    diagnostics.push({
      code: codes.truncated,
      message: `разбиение усечено по бюджету клеток по полям: ${trimmed.map((field) => `«${field}»`).join(", ")}`,
      severity: "warning",
      details: { fields: trimmed, budget: limits.cells },
    })
  }

  const coveredCells = cells.filter((cell) => !cell.hole && !cell.undecided).length

  return {
    name: utility.name,
    input: utility.input,
    output: utility.output,
    initial: utility.initial,
    analyzed: true,
    axes: axes.map((axis) => ({
      field: axis.field,
      type: axis.type,
      kind: axis.kind,
      free: axis.free,
      optional: axis.optional,
      thresholds: axis.thresholds ?? [],
      cells: axis.cells,
    })),
    rules,
    cells: cells.map(({ points, results, ...core }) => core),
    holes,
    overlaps,
    properties,
    summary: {
      fields: axes.length,
      freeFields: axes.filter((axis) => axis.free).map((axis) => axis.field),
      cells: cells.length,
      cellsCovered: coveredCells,
      cellsHoles: holeCells.length,
      cellsOverlapping: cells.filter((cell) => cell.firing.length + cell.partial.length > 1).length,
      cellsMixed: mixedCells,
      cellsUndecided: undecidedCells,
      rulesDead: rules.filter((rule) => rule.empty).length,
      rulesUnanalyzed: rules.filter((rule) => !rule.analyzable).length,
      truncated: trimmed,
    },
    diagnostics,
    /* Внутреннее — для отрисовки; в JSON-отчёт не попадает. */
    internal: { axes, cells, kinds },
  }
}

function witnessOf(axes, box, cellAt) {
  const coords = box.map(([from]) => from)
  const cell = cellAt.get(coords.join(","))
  return cell?.points?.[0] ?? null
}

/**
 * Совместимость действий. Внутри ОДНОЙ утилиты порядок правил определён
 * (объявление сверху вниз), поэтому «конфликт» тут мягче, чем между спеками:
 * это не неопределённость, а зависимость итога от порядка строк в файле.
 */
function classifyActions(left, right) {
  const key = (operand) => JSON.stringify([operand.kind, operand.value ?? null, operand.field ?? null, operand.percent ?? null])
  if (left.kind === "add" && right.kind === "add") {
    return { kind: "накопление", orderDependent: false, note: "оба добавляют — вклады складываются, порядок не важен" }
  }
  if (left.kind === "set" && right.kind === "set") {
    if (key(left.value) === key(right.value)) {
      return { kind: "одинаковое присваивание", orderDependent: false, note: "оба кладут одно и то же значение" }
    }
    return {
      kind: "перезапись",
      orderDependent: true,
      note: "оба кладут результат, но разные значения — побеждает объявленное ниже",
    }
  }
  return {
    kind: "присваивание против добавления",
    orderDependent: true,
    note: "одно кладёт результат целиком, другое добавляет — итог зависит от порядка объявления",
  }
}

/**
 * Достижимость свойства.
 *
 * Вопрос ставится так, как он важен на практике: не «выполняется ли свойство»
 * (оно почти всегда выполняется — иначе модель не работала бы), а «БЫВАЕТ ли
 * вход, на котором свойство хоть что-то ограничивает». Свойство, до предела
 * которого правила не дотягивают ни на одном входе, не проверено ничем: его
 * можно ужесточить вдвое и ни один пример не изменится.
 *
 * Равенство результата начальному значению считается вырожденным касанием:
 * «0 ≤ 20 % от 0» — правда, но про правила она ничего не говорит.
 */
function analyzeProperty(utility, property, axes, cells, diagnostics) {
  const violated = []
  const attained = []
  const slack = []
  const undecided = []
  let maxRatio = null
  let firingPoints = 0
  const statusByCell = []

  cells.forEach((cell, cellIndex) => {
    const firing = cell.firing.length + cell.partial.length > 0
    const seen = { violated: 0, tight: 0, slack: 0, undecided: 0 }
    for (const input of cell.points) {
      const holds = holdsAt(utility, property, input)
      const limit = limitAt(utility, property, input)
      const outcome = cell.results.find((item) => item.input === input)
      const record = {
        where: cell.where,
        input: { ...input },
        result: outcome?.result ?? null,
        limit: limit.ok ? limit.value : null,
        firing: [...cell.firing, ...cell.partial],
      }

      if (holds === null || !limit.ok || outcome?.error) {
        undecided.push({ ...record, reason: outcome?.error ?? limit.reason ?? "ядро отвергло вход" })
        seen.undecided += 1
        continue
      }
      if (firing) firingPoints += 1

      if (!holds) {
        violated.push(record)
        seen.violated += 1
        continue
      }
      const tight = Object.is(record.result, record.limit)
      if (tight) {
        attained.push({ ...record, degenerate: Object.is(record.result, utility.initial) })
        seen.tight += 1
        continue
      }
      if (
        typeof record.result === "number" &&
        typeof record.limit === "number" &&
        record.limit !== 0 &&
        Number.isFinite(record.result / record.limit)
      ) {
        const ratio = record.result / record.limit
        if (maxRatio === null || ratio > maxRatio) maxRatio = ratio
      }
      slack.push(record)
      seen.slack += 1
    }

    /* Статус клетки — худшее, что в ней встретилось: нарушение важнее касания,
       касание важнее запаса. Иначе одна плохая точка потерялась бы в картинке. */
    statusByCell[cellIndex] = seen.violated
      ? "violated"
      : seen.tight
        ? "tight"
        : seen.slack
          ? "slack"
          : "undecided"
  })

  const realAttainment = attained.filter((item) => !item.degenerate && item.firing.length > 0)
  const unattainable = realAttainment.length === 0 && violated.length + attained.length + slack.length > 0

  const limitText = `результат ${OPERATOR_TEXT[property.operator]} ${operandText(property.value)}`
  const near = maxRatio === null ? "" : `, ближайший подход — ${formatRatio(maxRatio)} от предела`
  const equality = attained.length
    ? `равенство встречается только там, где результат остаётся начальным (${formatValue(utility.initial)})`
    : "равенство не встретилось ни в одной точке выборки"
  const message = unattainable
    ? `предел недостижим на области, где правила меняют результат: ${equality}${near}` +
      (violated.length ? `; при этом свойство нарушается при ${violated[0].where}` : "")
    : violated.length
      ? `нарушается при ${violated[0].where}`
      : `предел достигается при ${realAttainment[0]?.where ?? attained[0]?.where}`

  if (violated.length) {
    diagnostics.push({
      code: codes.propertyViolated,
      message: `свойство «${property.name}» нарушается при ${violated[0].where}: результат ${formatValue(violated[0].result)} против предела ${formatValue(violated[0].limit)}`,
      severity: "error",
      details: { property: property.name, where: violated[0].where, witness: violated[0].input, result: violated[0].result, limit: violated[0].limit },
    })
  }
  if (unattainable) {
    diagnostics.push({
      code: codes.propertyUnattainable,
      message: `свойство «${property.name}» недостижимо: ${message}`,
      severity: "warning",
      details: { property: property.name, maxRatio, checkedPoints: firingPoints },
    })
  }

  return {
    name: property.name,
    operator: property.operator,
    limit: operandText(property.value),
    limitText,
    unattainable,
    attainedOnlyDegenerately: unattainable && attained.length > 0,
    maxRatio,
    message,
    statusByCell,
    violated: violated.slice(0, 8),
    violatedCount: violated.length,
    attained: attained.slice(0, 8),
    attainedCount: attained.length,
    slackCount: slack.length,
    undecided: undecided.slice(0, 8),
    undecidedCount: undecided.length,
    /* Области, где свойство заведомо ничего не ограничивает — по клеткам. */
    slackRegions: regionsOf(axes, cells, slack),
    violatedRegions: regionsOf(axes, cells, violated),
  }
}

function regionsOf(axes, cells, records) {
  const wanted = new Set(records.map((record) => record.where))
  const coords = cells.filter((cell) => wanted.has(cell.where)).map((cell) => cell.coords)
  if (!coords.length) return []
  return mergeBoxes(coords).map((box) => describeBox(axes, box))
}

function formatRatio(ratio) {
  const percent = ratio * 100
  const rounded = Math.round(percent * 100) / 100
  return `${String(rounded).replace(".", ",")} %`
}

/* ─────────────────────────── анализ документа ───────────────────────────── */

/**
 * Карта покрытия для модели целиком.
 *
 * @param {object} document документ ядра
 * @param {{utility?: string}} [options]
 */
export function analyzeDocument(document, options = {}) {
  const all = document.utilities ?? []
  const diagnostics = []

  let chosen = all
  if (options.utility) {
    chosen = all.filter((utility) => utility.name === options.utility)
    if (!chosen.length) {
      throw Object.assign(new Error(`в модели нет утилиты «${options.utility}»`), {
        diagnostics: [
          {
            code: codes.unknownUtility,
            message: `в модели нет утилиты «${options.utility}» (есть: ${all.map((item) => `«${item.name}»`).join(", ") || "ни одной"})`,
            severity: "error",
          },
        ],
      })
    }
  }

  if (!all.length) {
    diagnostics.push({
      code: codes.noUtilities,
      message: "модель не содержит утилит — картировать нечего",
      severity: "warning",
    })
  }

  const utilities = chosen.map((utility) => analyzeUtility(document, utility))
  for (const utility of utilities) diagnostics.push(...utility.diagnostics.map((item) => ({ ...item, utility: utility.name })))

  const ok = !diagnostics.some((item) => item.severity === "error")
  return {
    category: document.category,
    utilities,
    diagnostics,
    ok,
    summary: {
      utilities: utilities.length,
      holes: utilities.reduce((total, item) => total + (item.holes?.length ?? 0), 0),
      overlaps: utilities.reduce((total, item) => total + (item.overlaps?.length ?? 0), 0),
      unattainable: utilities.reduce(
        (total, item) => total + (item.properties ?? []).filter((property) => property.unattainable).length,
        0,
      ),
      violated: utilities.reduce(
        (total, item) => total + (item.properties ?? []).filter((property) => property.violatedCount > 0).length,
        0,
      ),
    },
  }
}

/** Отчёт без служебных полей отрисовки — то, что уходит в `--json`. */
export function reportOf(analysis) {
  return {
    ...analysis,
    utilities: analysis.utilities.map(({ internal, ...core }) => core),
  }
}
