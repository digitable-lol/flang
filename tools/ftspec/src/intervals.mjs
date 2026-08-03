/**
 * Интервальный анализ условий правил FTS.
 *
 * Почему это разрешимо без SMT. Условие правила в ядре — конъюнкция сравнений
 * ПОЛЯ с ОПЕРАНДОМ, а сравнения бывают ровно шести видов: eq, neq, gte, lte,
 * gt, lt. Если операнд — константа, то конъюнкция распадается по полям: разные
 * поля независимы, поэтому пересечение двух условий непусто тогда и только
 * тогда, когда по каждому полю непусто пересечение его ограничений. А
 * ограничение на одно поле — это либо отрезок с выколотыми точками (число),
 * либо подмножество {да, нет} (признак), либо «всё, кроме перечисленного»
 * (строка). Все три задачи решаются точно и за линейное время.
 *
 * Что сюда НЕ попадает: условия, где операнд — другое поле, процент от поля
 * или накопленный результат. Такие сравнения связывают поля между собой, и
 * задача перестаёт быть покоординатной. Мы их честно помечаем как
 * непроанализированные, а не делаем вид, что проверили.
 */

export const NUMBER = "число"
export const BOOLEAN = "признак"
export const STRING = "строка"
export const OTHER = "прочее"

/** Тип поля модели → род области значений, в которой мы умеем считать. */
export function typeKind(type) {
  const bare = String(type ?? "")
    .replace(/\s*\|\s*undefined\s*/gu, "")
    .trim()
  if (bare === "Число" || bare === "Деньги" || bare === "number") return NUMBER
  if (bare === "Признак" || bare === "boolean") return BOOLEAN
  if (bare === "Строка" || bare === "Дата" || bare === "string") return STRING
  return OTHER
}

/** Печать константы в тех же словах, в которых её пишут в .fts. */
export function formatValue(value) {
  if (value === true) return "да"
  if (value === false) return "нет"
  if (value === null) return "ничто"
  if (typeof value === "number") return String(value)
  return `«${value}»`
}

const OPERATOR_TEXT = { eq: "=", neq: "≠", gte: "≥", lte: "≤", gt: ">", lt: "<" }

function valueFitsKind(value, kind) {
  if (kind === NUMBER) return typeof value === "number"
  if (kind === BOOLEAN) return typeof value === "boolean"
  if (kind === STRING) return typeof value === "string"
  return true
}

const empty = (reason) => ({ empty: true, reason })

function inside(value, lo, loOpen, hi, hiOpen) {
  if (typeof value !== "number") return false
  if (loOpen ? !(value > lo) : !(value >= lo)) return false
  if (hiOpen ? !(value < hi) : !(value <= hi)) return false
  return true
}

function intervalText(lo, loOpen, hi, hiOpen) {
  const left = lo === -Infinity ? "(−∞" : `${loOpen ? "(" : "["}${lo}`
  const right = hi === Infinity ? "+∞)" : `${hi}${hiOpen ? ")" : "]"}`
  return `${left}, ${right}`
}

/**
 * Представитель непустого числового множества «отрезок минус конечное число
 * точек». Кандидаты берём из самих границ и середин между выколотыми точками:
 * если множество непусто, среди них обязательно найдётся допустимое значение.
 */
function pickNumber(lo, loOpen, hi, hiOpen, holes) {
  const marks = [...holes]
  if (Number.isFinite(lo)) marks.push(lo)
  if (Number.isFinite(hi)) marks.push(hi)
  marks.sort((a, b) => a - b)

  const candidates = []
  if (Number.isFinite(lo) && !loOpen) candidates.push(lo)
  if (Number.isFinite(hi) && !hiOpen) candidates.push(hi)
  for (let index = 0; index + 1 < marks.length; index += 1) candidates.push((marks[index] + marks[index + 1]) / 2)
  if (marks.length === 0) candidates.push(0)
  else {
    candidates.push(marks[0] - 1, marks[marks.length - 1] + 1, marks[0] - 0.5, marks[marks.length - 1] + 0.5)
  }
  candidates.push(0, 1, -1)

  for (const candidate of candidates) {
    if (!Number.isFinite(candidate)) continue
    if (!inside(candidate, lo, loOpen, hi, hiOpen)) continue
    if (holes.some((hole) => Object.is(hole, candidate))) continue
    return candidate
  }
  return undefined
}

function pickString(forbidden) {
  for (const candidate of ["", "значение", "иное", "x"]) {
    if (!forbidden.some((item) => Object.is(item, candidate))) return candidate
  }
  return `${forbidden.length}`
}

/**
 * Решает систему сравнений по ОДНОМУ полю.
 *
 * @param {string} kind род области значений поля (NUMBER | BOOLEAN | STRING | OTHER)
 * @param {Array<{operator: string, value: unknown}>} comparisons конъюнкция сравнений с константами
 * @returns {{empty: true, reason: string} | {empty: false, kind: string, sample: unknown, text: string}}
 */
export function solveField(kind, comparisons) {
  let lo = -Infinity
  let loOpen = true
  let hi = Infinity
  let hiOpen = true
  let ordered = false
  let exact
  let hasExact = false
  const forbidden = []

  for (const comparison of comparisons) {
    const value = comparison.value
    if (comparison.operator === "eq") {
      if (hasExact && !Object.is(exact, value)) {
        return empty(`требуется одновременно = ${formatValue(exact)} и = ${formatValue(value)}`)
      }
      exact = value
      hasExact = true
      continue
    }
    if (comparison.operator === "neq") {
      if (!forbidden.some((item) => Object.is(item, value))) forbidden.push(value)
      continue
    }

    /* Порядковые сравнения ядро допускает только для чисел (см. compare в
       utility.js). Значит порядок над признаком или строкой — не «редкий
       случай», а условие, истинного входа для которого не существует. */
    ordered = true
    if (kind !== NUMBER && kind !== OTHER) {
      return empty(`сравнение порядка «${OPERATOR_TEXT[comparison.operator]}» над полем типа «${kind}»`)
    }
    if (typeof value !== "number") {
      return empty(`сравнение порядка с нечисловой константой ${formatValue(value)}`)
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
    if (!valueFitsKind(exact, kind)) {
      return empty(`значение ${formatValue(exact)} не бывает у поля типа «${kind}»`)
    }
    if (ordered && !inside(exact, lo, loOpen, hi, hiOpen)) {
      return empty(`${formatValue(exact)} вне ${intervalText(lo, loOpen, hi, hiOpen)}`)
    }
    if (forbidden.some((item) => Object.is(item, exact))) {
      return empty(`требуется одновременно = ${formatValue(exact)} и ≠ ${formatValue(exact)}`)
    }
    return { empty: false, kind, sample: exact, text: `= ${formatValue(exact)}` }
  }

  if (kind === BOOLEAN) {
    const allowed = [true, false].filter((value) => !forbidden.some((item) => Object.is(item, value)))
    if (!allowed.length) return empty("исключены оба значения признака")
    return {
      empty: false,
      kind,
      sample: allowed[0],
      text: allowed.length === 2 ? "любое" : `= ${formatValue(allowed[0])}`,
    }
  }

  if (kind === NUMBER || (kind === OTHER && ordered)) {
    if (lo > hi) return empty(`пустой интервал ${intervalText(lo, loOpen, hi, hiOpen)}`)
    if (lo === hi && (loOpen || hiOpen)) {
      return empty(`пустой интервал ${intervalText(lo, loOpen, hi, hiOpen)}`)
    }
    const holes = forbidden.filter((value) => inside(value, lo, loOpen, hi, hiOpen))
    if (lo === hi && holes.length) return empty(`единственное значение ${lo} исключено условием ≠ ${lo}`)
    const sample = pickNumber(lo, loOpen, hi, hiOpen, holes)
    if (sample === undefined) return empty(`не удалось подобрать значение в ${intervalText(lo, loOpen, hi, hiOpen)}`)
    const holesText = holes.length ? `, кроме ${holes.map(formatValue).join(", ")}` : ""
    const range = lo === -Infinity && hi === Infinity ? "любое" : `∈ ${intervalText(lo, loOpen, hi, hiOpen)}`
    return { empty: false, kind, sample, text: `${range}${holesText}` }
  }

  const sample = pickString(forbidden)
  const text = forbidden.length ? `≠ ${forbidden.map(formatValue).join(", ")}` : "любое"
  return { empty: false, kind, sample, text }
}

/** Операнд условия — константа? Только такие условия участвуют в анализе. */
export const isConstantOperand = (operand) => operand?.kind === "value"

/**
 * Решает конъюнкцию условий целиком.
 *
 * @param {Array<{field: string, operator: string, value: object}>} conditions
 * @param {Map<string, string>} kinds типы полей объекта: имя → род области значений
 * @returns {{analyzable: false, field: string}
 *          |{analyzable: true, empty: true, field: string, reason: string}
 *          |{analyzable: true, empty: false, fields: Map<string, object>, witness: object, text: string}}
 */
export function solveConditions(conditions, kinds) {
  const byField = new Map()
  for (const condition of conditions) {
    if (!isConstantOperand(condition.value)) return { analyzable: false, field: condition.field }
    if (!byField.has(condition.field)) byField.set(condition.field, [])
    byField.get(condition.field).push({ operator: condition.operator, value: condition.value.value })
  }

  const fields = new Map()
  const witness = {}
  for (const [field, comparisons] of byField) {
    /* Поля, которых нет в условии, не ограничены вовсе — они просто не
       попадают в byField, и по ним пересечение автоматически непусто. */
    const solved = solveField(kinds.get(field) ?? OTHER, comparisons)
    if (solved.empty) return { analyzable: true, empty: true, field, reason: solved.reason }
    fields.set(field, solved)
    witness[field] = solved.sample
  }

  const text = [...fields].map(([field, solved]) => `«${field}» ${solved.text}`).join(", ") || "без ограничений"
  return { analyzable: true, empty: false, fields, witness, text }
}

/** Пересечение двух условий — это просто конъюнкция их сравнений. */
export function intersectConditions(left, right, kinds) {
  return solveConditions([...left, ...right], kinds)
}
