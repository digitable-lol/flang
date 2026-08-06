/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Типы FTS → типы Elixir.
 *
 * Правила совпадают с `ts_compat` ядра (см. src/utility.ts,
 * функция typescriptType): «Строка»/«Дата» — строка, «Число»/«Деньги» —
 * число, «Признак» — булево. Это тот же взгляд на типы, что уже проверен
 * ядром, просто напечатанный другим синтаксисом.
 *
 * Именованные состояния (любое имя типа вне этого набора, например «Готов к
 * отгрузке» в test/fixtures/shipment.ir.json) в IR не несут перечисления
 * значений — только имя. Ядро (ts_compat) в этом случае честно печатает
 * `unknown` и ничего не проверяет во время выполнения. Мы поступаем чуть
 * строже: witness в той же фикстуре показывает, что рантайм-значение такого
 * поля — булево (`"value": true`), поэтому представляем именованное состояние
 * как `boolean()` — это ближе к истине, чем `any`/`term()`, и не ломает ни
 * одну из четырёх фикстур. Компилятор ftsc проверяет содержательность
 * состояний на уровне типов раньше нас; наша задача — напечатать код, а не
 * переизобретать эту проверку.
 */
import { quote } from "../../naming.mjs"

const OPTIONAL_SUFFIX = /\s*\|\s*undefined\s*$/u

/** Разбирает строку типа FTS на опциональность и базовое имя. */
export function parseType(ftsType) {
  const optional = OPTIONAL_SUFFIX.test(ftsType)
  const base = ftsType.replace(OPTIONAL_SUFFIX, "").trim()
  let kind
  if (base === "Строка" || base === "Дата") kind = "string"
  else if (base === "Число" || base === "Деньги") kind = "number"
  else if (base === "Признак") kind = "boolean"
  else kind = "state"
  return { optional, base, kind }
}

function specForKind(kind) {
  switch (kind) {
    case "string":
      return "String.t()"
    case "number":
      return "number()"
    case "boolean":
    case "state":
      return "boolean()"
    default:
      throw new Error(`неизвестный вид типа: ${kind}`)
  }
}

/** `@type`-спецификация Elixir для типа FTS, с учётом «X | undefined». */
export function typeSpec(ftsType) {
  return specFromParsed(parseType(ftsType))
}

/** То же самое, но из уже разобранного типа ({ kind, optional }) — чтобы не
    парсить строку типа повторно там, где разбор уже сделан один раз при
    построении реестра модулей. */
export function specFromParsed({ kind, optional }) {
  const spec = specForKind(kind)
  return optional ? `${spec} | nil` : spec
}

function formatNumber(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`ожидалось конечное число, получено: ${JSON.stringify(value)}`)
  }
  const text = String(value)
  if (text.includes("e") || text.includes("E")) {
    throw new Error(`число вне диапазона обычной десятичной записи Elixir: ${text}`)
  }
  return text
}

/**
 * Литерал Elixir для значения примера/константы данного вида типа.
 * `undefined`/`null` — это отсутствующее опциональное поле → `nil`.
 */
export function literalFor(kind, value) {
  if (value === undefined || value === null) return "nil"
  switch (kind) {
    case "string":
      return quote(String(value))
    case "number":
      return formatNumber(value)
    case "boolean":
    case "state":
      if (typeof value === "boolean") return value ? "true" : "false"
      /* Именованное состояние, чьё значение в примере оказалось не булевым —
         честно печатаем как строку, чтобы не потерять данные примера. */
      return quote(String(value))
    default:
      throw new Error(`неизвестный вид типа: ${kind}`)
  }
}

/** Вид значения JS-литерала (для операндов kind:"value" в правилах/свойствах). */
export function kindOfLiteral(value) {
  if (typeof value === "boolean") return "boolean"
  if (typeof value === "string") return "string"
  if (typeof value === "number") return "number"
  throw new Error(`операнд-значение неподдерживаемого типа: ${JSON.stringify(value)}`)
}

/* Ключевые слова и псевдо-ключевые слова Elixir: если транслитерация имени
   FTS даст одно из них, это должно упасть как ошибка сборки (см.
   naming.mjs:createNamer), а не превратиться в тихо сломанный код. */
export const RESERVED_KEYWORDS = [
  "true",
  "false",
  "nil",
  "when",
  "and",
  "or",
  "not",
  "in",
  "do",
  "end",
  "fn",
  "catch",
  "rescue",
  "after",
  "else",
  "cond",
  "case",
  "if",
  "unless",
  "for",
  "with",
  "quote",
  "unquote",
  "unquote_splicing",
  "super",
  "import",
  "require",
  "alias",
  "use",
  "def",
  "defp",
  "defmodule",
  "defstruct",
  "defexception",
  "defmacro",
  "defmacrop",
  "defprotocol",
  "defimpl",
  "defdelegate",
  "defguard",
  "defguardp",
  "defoverridable",
  "receive",
  "try",
  "raise",
]

/* Модули стандартной библиотеки/самого рантайма ftsc, с которыми имя FTS не
   должно столкнуться на уровне `Project.Name`. */
export const RESERVED_MODULES = [
  "Kernel",
  "Map",
  "Enum",
  "String",
  "Integer",
  "Float",
  "Date",
  "DateTime",
  "List",
  "Tuple",
  "Atom",
  "Access",
  "Application",
  "Process",
  "Task",
  "Agent",
  "GenServer",
  "Supervisor",
  "Registry",
  "Keyword",
  "MapSet",
  "Range",
  "Regex",
  "IO",
  "File",
  "Path",
  "System",
  "Node",
  "Port",
  "Reference",
  "Function",
  "Exception",
  "ArgumentError",
  "RuntimeError",
  "Elixir",
]
