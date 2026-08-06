/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Встраиваемый факт-чекинг (SPEC §8).
 *
 * Правила режима — не пожелания, а условия применимости. Система, отвечающая
 * «факт подтверждён или нет», не имеет права зависнуть, соврать по-разному в
 * двух прогонах или сходить в сеть за «уточнением». Отсюда четыре гарантии,
 * каждая обеспечена конструкцией, а не дисциплиной:
 *
 *   1. ТОЛЬКО ТОТАЛЬНЫЕ ФУНКЦИИ. Перед вычислением считается транзитивное
 *      замыкание вызовов. Если хоть одна функция в нём не помечена `тотальная`
 *      — отказ с объяснением. Не «попробуем и посмотрим»: попытка исполнить
 *      нетотальную функцию и есть тот риск, ради которого введены два класса.
 *   2. ЖЁСТКИЙ ЛИМИТ ШАГОВ. Даже тотальная программа может считать долго;
 *      бюджет шагов делает время ответа предсказуемым.
 *   3. НИКАКИХ ЭФФЕКТОВ. Модуль не читает файлы, не ходит в сеть, не смотрит
 *      на часы и не бросает кости. Все зависимости — аргументы функции.
 *   4. ДЕТЕРМИНИЗМ. Факты замораживаются копией, порядок обхода — порядок
 *      объявления, ответ зависит только от (program, facts, claims, limits).
 *
 * Это библиотека: ни `process.exit`, ни вывода в консоль — только возвращаемое
 * значение.
 */
import { errorCode, evaluateFlang, flangError } from "./compat.mjs"

const DEFAULT_STEPS = 10000
const DEFAULT_DEPTH = 100

/**
 * @param {object} program программа flang (SPEC §5)
 * @param {{ facts?: object, claims?: string[], limits?: object }} options
 * @returns {{ ok: boolean, results: Array<{claim, holds, why, steps, status}> }}
 */
export function checkFacts(program, options = {}) {
  const claims = Array.isArray(options.claims) ? options.claims : []
  const limits = {
    steps: normalizeLimit(options.limits?.steps, DEFAULT_STEPS),
    depth: normalizeLimit(options.limits?.depth, DEFAULT_DEPTH),
  }
  const evaluate = typeof options.evaluate === "function" ? options.evaluate : evaluateFlang

  const programError = validateProgram(program)
  const facts = programError === null ? freeze(clone(options.facts ?? {})) : {}
  const totality = programError === null ? new TotalityAnalysis(program) : null

  const results = claims.map((claim) =>
    programError === null
      ? checkClaim({ program, facts, limits, evaluate, totality }, claim)
      : refuse(String(claim), programError),
  )
  return { ok: results.every((result) => result.holds), results }
}

function normalizeLimit(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback
}

function validateProgram(program) {
  if (program === null || typeof program !== "object") return "программа не передана"
  if (!Array.isArray(program.functions)) return "в программе нет списка функций"
  return null
}

function refuse(claim, why, steps = []) {
  return { claim, holds: false, why, steps, status: "refused" }
}

/* ───────────────────────────── тотальность ──────────────────────────────── */

/**
 * Транзитивное замыкание вызовов. Функция годится для факт-чекинга, только
 * если тотальна она сама и всё, до чего она дотягивается. Иначе гарантия
 * завершения ничем не отличается от обещания в документации.
 */
class TotalityAnalysis {
  constructor(program) {
    this.functions = new Map((program.functions ?? []).map((fn) => [fn.name, fn]))
    this.cache = new Map()
  }

  /** @returns {{ ok: boolean, reason?: string, chain: string[] }} */
  check(name) {
    if (this.cache.has(name)) return this.cache.get(name)
    const visited = new Set()
    const verdict = this.walk(name, visited, [])
    const result = { ...verdict, chain: [...visited] }
    this.cache.set(name, result)
    return result
  }

  walk(name, visited, path) {
    if (visited.has(name)) return { ok: true }
    visited.add(name)
    const fn = this.functions.get(name)
    if (fn === undefined) {
      return { ok: false, reason: `функция «${name}» не найдена в программе` }
    }
    if (fn.total !== true) {
      const via = path.length === 0 ? "" : ` (через ${path.map((item) => `«${item}»`).join(" → ")})`
      return {
        ok: false,
        reason:
          `функция «${name}» не помечена как «тотальная»${via}; ` +
          "факт-чекинг допускает только тотальные функции — иначе ответ может не наступить",
      }
    }
    for (const callee of callees(fn.body)) {
      const verdict = this.walk(callee, visited, [...path, name])
      if (!verdict.ok) return verdict
    }
    return { ok: true }
  }
}

function callees(node, found = []) {
  if (node === null || typeof node !== "object") return found
  if (Array.isArray(node)) {
    for (const item of node) callees(item, found)
    return found
  }
  if (node.kind === "call" && typeof node.name === "string") found.push(node.name)
  for (const [key, value] of Object.entries(node)) {
    if (key === "meta" || key === "span") continue
    if (value !== null && typeof value === "object") callees(value, found)
  }
  return found
}

/* ────────────────────────── язык утверждений ────────────────────────────── */

/*
 * Утверждение — строка, потому что вызывающая сторона (агент, форма, лог)
 * оперирует текстом. Грамматика намеренно крошечная и без вычислений: всё
 * «интересное» считают функции программы, утверждение лишь указывает, что с
 * чем сравнить. Обе поверхности — русская и английская — как и в самом языке.
 *
 *   «Рассчитать скидку» от «покупка» равно 3000
 *   «Рассчитать скидку» от «покупка» не больше 4000
 *   поле сумма факта «покупка» больше 10000
 *   "Calculate discount" of "purchase" is at most 4000
 */
const OPERATORS = [
  ["не равно", "neq"],
  ["не равен", "neq"],
  ["не равна", "neq"],
  ["не больше", "lte"],
  ["не меньше", "gte"],
  ["равно", "eq"],
  ["равен", "eq"],
  ["равна", "eq"],
  ["больше", "gt"],
  ["меньше", "lt"],
  ["does not equal", "neq"],
  ["is at most", "lte"],
  ["is at least", "gte"],
  ["is greater than", "gt"],
  ["is less than", "lt"],
  ["equals", "eq"],
]

const OPERATOR_NAMES = {
  eq: "равно",
  neq: "не равно",
  gt: "больше",
  lt: "меньше",
  gte: "не меньше",
  lte: "не больше",
}

const NAME = "(?:«([^»]+)»|\"([^\"]+)\"|([^\\s,«»\"]+))"
const CALL = new RegExp(`^${NAME}\\s+(?:от|of)\\s+(.+)$`, "u")
const FIELD_OF_FACT = new RegExp(`^(?:поле|field)\\s+${NAME}\\s+(?:факта|of fact)\\s+${NAME}$`, "u")
const FACT = new RegExp(`^(?:факт|fact)\\s+${NAME}$`, "u")

const pickName = (match, offset) => match[offset] ?? match[offset + 1] ?? match[offset + 2]

function splitClaim(claim) {
  for (const [word, operator] of OPERATORS) {
    const pattern = new RegExp(`^(.*?)\\s+${word}\\s+(.*)$`, "u")
    const match = pattern.exec(claim)
    if (match !== null && match[1].trim() !== "" && match[2].trim() !== "") {
      return { left: match[1].trim(), operator, right: match[2].trim(), word }
    }
  }
  return null
}

function parseTerm(text) {
  const fieldMatch = FIELD_OF_FACT.exec(text)
  if (fieldMatch !== null) {
    return { kind: "field", field: pickName(fieldMatch, 1), fact: pickName(fieldMatch, 4) }
  }
  const factMatch = FACT.exec(text)
  if (factMatch !== null) return { kind: "fact", fact: pickName(factMatch, 1) }

  const callMatch = CALL.exec(text)
  if (callMatch !== null) {
    const args = callMatch[4]
      .split(",")
      .map((item) => item.trim().replace(/^[«"]|[»"]$/gu, "").trim())
      .filter(Boolean)
    if (args.length > 0) return { kind: "call", function: pickName(callMatch, 1), facts: args }
  }

  const literal = parseLiteral(text)
  if (literal !== null) return literal
  return null
}

function parseLiteral(text) {
  if (/^-?\d+(?:\.\d+)?$/u.test(text)) return { kind: "literal", value: Number(text) }
  if (text === "да" || text === "true") return { kind: "literal", value: true }
  if (text === "нет" || text === "false") return { kind: "literal", value: false }
  if (text === "ничто" || text === "nothing" || text === "null") return { kind: "literal", value: null }
  const quoted = /^(?:«([^»]*)»|"([^"]*)")$/u.exec(text)
  if (quoted !== null) return { kind: "literal", value: quoted[1] ?? quoted[2] }
  return null
}

/* ─────────────────────────── проверка утверждения ───────────────────────── */

function checkClaim(context, rawClaim) {
  const claim = String(rawClaim)
  const steps = []
  const parts = splitClaim(claim)
  if (parts === null) {
    return refuse(
      claim,
      "не удалось разобрать утверждение: ожидалось «<что-то> <оператор> <что-то>», " +
        `оператор — один из: ${Object.values(OPERATOR_NAMES).join(", ")}`,
      steps,
    )
  }
  const left = parseTerm(parts.left)
  const right = parseTerm(parts.right)
  if (left === null || right === null) {
    const bad = left === null ? parts.left : parts.right
    return refuse(claim, `не удалось разобрать часть утверждения «${bad}»`, steps)
  }
  steps.push({ kind: "разбор", left, operator: OPERATOR_NAMES[parts.operator], right })

  const leftValue = resolveTerm(context, left, steps)
  if (leftValue.error !== undefined) return refuse(claim, leftValue.error, steps)
  const rightValue = resolveTerm(context, right, steps)
  if (rightValue.error !== undefined) return refuse(claim, rightValue.error, steps)

  let holds
  try {
    holds = compare(leftValue.value, parts.operator, rightValue.value)
  } catch (error) {
    return {
      claim,
      holds: false,
      why:
        `сравнение невозможно: ${error.message}. ` +
        `слева ${describe(leftValue.value)}, справа ${describe(rightValue.value)}`,
      steps,
      status: "error",
    }
  }
  steps.push({
    kind: "сравнение",
    operator: OPERATOR_NAMES[parts.operator],
    left: leftValue.value,
    right: rightValue.value,
    holds,
  })

  /* Объяснение обязано назвать конкретное значение и конкретный факт: «ложно»
     без причины ничем не лучше молчания. */
  const requirement = `${OPERATOR_NAMES[parts.operator]} ${describe(rightValue.value)}`
  const subject = `${describeTerm(left)} = ${describe(leftValue.value)}`
  const source = right.kind === "literal" ? "" : `; правая часть — ${describeTerm(right)}`
  const why = holds
    ? `${subject}; требование «${requirement}» выполнено`
    : `${subject}, а утверждение требует «${requirement}»${source}${explainFacts(context, [left, right])}`
  return { claim, holds, why, steps, status: holds ? "verified" : "refuted" }
}

function resolveTerm(context, term, steps) {
  if (term.kind === "literal") return { value: term.value }

  if (term.kind === "fact" || term.kind === "field") {
    if (!(term.fact in context.facts)) return { error: `не передан факт «${term.fact}»` }
    const fact = context.facts[term.fact]
    if (term.kind === "fact") {
      steps.push({ kind: "факт", name: term.fact, value: fact })
      return { value: fact }
    }
    if (fact === null || typeof fact !== "object" || !(term.field in fact)) {
      return { error: `у факта «${term.fact}» нет поля «${term.field}»` }
    }
    steps.push({ kind: "поле факта", fact: term.fact, field: term.field, value: fact[term.field] })
    return { value: fact[term.field] }
  }

  /* Вызов: сперва тотальность, только потом вычисление. */
  const verdict = context.totality.check(term.function)
  steps.push({ kind: "тотальность", function: term.function, ok: verdict.ok, reason: verdict.reason })
  if (!verdict.ok) return { error: verdict.reason }

  const fn = context.totality.functions.get(term.function)
  const params = fn.params ?? []
  if (params.length !== term.facts.length) {
    return {
      error: `функция «${term.function}» принимает ${params.length} аргумент(ов), а в утверждении их ${term.facts.length}`,
    }
  }
  const args = {}
  for (const [index, param] of params.entries()) {
    const name = term.facts[index]
    if (!(name in context.facts)) return { error: `не передан факт «${name}» для аргумента «${param.name}»` }
    args[param.name] = context.facts[name]
    steps.push({ kind: "факт", name, value: context.facts[name] })
  }

  try {
    const value = context.evaluate(context.program, term.function, args, {
      steps: context.limits.steps,
      depth: context.limits.depth,
    })
    steps.push({ kind: "вычисление", function: term.function, args, value })
    return { value }
  } catch (error) {
    const code = errorCode(error)
    steps.push({ kind: "вычисление", function: term.function, args, error: error.message, code })
    if (code === "FLANG_STEP_LIMIT" || code === "FLANG_RECURSION_LIMIT") {
      return {
        error: `вычисление «${term.function}» прервано лимитом: ${error.message}. Ответ не может быть дан за отведённый бюджет`,
      }
    }
    return { error: `вычисление «${term.function}» остановлено: ${error.message}${code ? ` [${code}]` : ""}` }
  }
}

function compare(left, operator, right) {
  if (operator === "eq") return Object.is(left, right)
  if (operator === "neq") return !Object.is(left, right)
  if (typeof left !== "number" || typeof right !== "number") {
    throw flangError("FLANG_TYPE", "сравнения порядка допустимы только для чисел")
  }
  if (operator === "gte") return left >= right
  if (operator === "lte") return left <= right
  if (operator === "gt") return left > right
  return left < right
}

/* ───────────────────────────── объяснения ───────────────────────────────── */

function describeTerm(term) {
  if (term.kind === "literal") return describe(term.value)
  if (term.kind === "fact") return `факт «${term.fact}»`
  if (term.kind === "field") return `поле «${term.field}» факта «${term.fact}»`
  return `«${term.function}» от ${term.facts.map((name) => `факта «${name}»`).join(", ")}`
}

function describe(value) {
  if (value === null) return "ничто"
  if (value === true) return "да"
  if (value === false) return "нет"
  if (typeof value === "string") return `«${value}»`
  if (typeof value === "number") return String(value)
  return JSON.stringify(value)
}

/** Объяснение обязано назвать факт, на котором утверждение споткнулось. */
function explainFacts(context, terms) {
  const names = new Set()
  for (const term of terms) {
    if (term.kind === "fact" || term.kind === "field") names.add(term.fact)
    if (term.kind === "call") for (const name of term.facts) names.add(name)
  }
  if (names.size === 0) return ""
  const rendered = [...names].map((name) => `«${name}»: ${describeFact(context.facts[name])}`)
  return `. Исходные факты — ${rendered.join("; ")}`
}

function describeFact(fact) {
  if (fact === null || typeof fact !== "object" || Array.isArray(fact)) return describe(fact)
  return Object.entries(fact)
    .map(([name, value]) => `${name} = ${describe(value)}`)
    .join(", ")
}

/* ──────────────────────── неизменяемость фактов ─────────────────────────── */

/* Копия + заморозка: вычисление физически не может изменить входные факты,
   поэтому второй прогон с теми же аргументами видит ровно то же самое. */
function clone(value) {
  if (Array.isArray(value)) return value.map(clone)
  if (value !== null && typeof value === "object") {
    const copy = {}
    for (const [name, item] of Object.entries(value)) copy[name] = clone(item)
    return copy
  }
  return value
}

function freeze(value) {
  if (value !== null && typeof value === "object") {
    for (const item of Object.values(value)) freeze(item)
    Object.freeze(value)
  }
  return value
}
