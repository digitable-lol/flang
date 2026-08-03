/**
 * Примитивы поверхности: строки, имена, ключевые фразы, заголовок модуля.
 *
 * Всё, что здесь есть, повторяет правила ядра дословно и намеренно:
 * `sourceLines` из `src/natural-parser.ts` (блочные комментарии заменяются
 * пробелами, строчные срезаются, табуляция считается за два) и `readName`
 * оттуда же. Расхождение здесь означает, что нумерация узлов разметки
 * разойдётся с нумерацией канонической модели, и указатель
 * `$.utilities[0].rules[1]` подчеркнёт не ту строку.
 *
 * Отличие одно и оно осознанное: ядро выбрасывает пустые строки и считает их
 * с единицы, здесь строки сохраняются все и нумеруются с нуля — так их можно
 * адресовать индексом массива, а перевод в нумерацию ядра делает `locate`.
 */

const NAME_PATTERN = new RegExp("^[\\p{ID_Start}_$][\\p{ID_Continue}$\\u200C\\u200D-]*", "u")

/** Ключевые фразы обеих поверхностей: русская первой, английская второй. */
export const PHRASES = {
  category: ["категория", "category"],
  object: ["объект", "структура", "object", "structure"],
  morphism: ["морфизм", "morphism"],
  theorem: ["теорема", "theorem"],
  utility: ["утилита", "utility"],
  rule: ["правило", "rule"],
  property: ["свойство", "property"],
  example: ["пример", "example"],
  accepts: ["принимает", "accepts"],
  returns: ["возвращает", "returns"],
  starts: ["начинает с", "starts with"],
  nested: ["вложен объект", "вложена структура", "nested object", "nested structure"],
  law: ["по закону", "under law"],
  dataLookup: ["в данных", "in data"],
  byMorphism: [
    "затем по морфизму",
    "затем применить морфизм",
    "по морфизму",
    "применить морфизм",
    "then by morphism",
    "then apply morphism",
    "by morphism",
    "apply morphism",
  ],
  therefore: ["следовательно", "получаем", "therefore"],
  given: ["дано", "given"],
  expected: ["ожидается", "expected"],
  result: ["результат", "result"],
  thenAdd: ["то добавить", "then add"],
  thenResult: ["то результат", "then result"],
  then: ["то", "then"],
  if: ["если", "if"],
  and: ["и", "and"],
  from: ["из", "from"],
  to: ["в", "to"],
  field: ["поле", "field"],
}

/** Формы объявления типа поля. */
export const FIELD_COPULAS = [
  { phrase: "иногда является", optional: true },
  { phrase: "является", optional: false },
  { phrase: "may be", optional: true },
  { phrase: "is state", optional: false, state: true },
  { phrase: "is", optional: false },
]

export const STATE_MARKERS = ["состоянием", "state"]

/** Встроенные типы: обе поверхности приводятся к каноническим русским именам. */
export const BUILTIN_TYPES = {
  строкой: "Строка",
  текстом: "Строка",
  числом: "Число",
  датой: "Дата",
  деньгами: "Деньги",
  признаком: "Признак",
  строку: "Строка",
  число: "Число",
  дату: "Дата",
  деньги: "Деньги",
  признак: "Признак",
  string: "Строка",
  text: "Строка",
  number: "Число",
  date: "Дата",
  money: "Деньги",
  boolean: "Признак",
}

/** Сравнения: фраза → канонический оператор ядра. Длинные фразы идут первыми. */
export const COMPARISONS = [
  ["не меньше", "gte"],
  ["не больше", "lte"],
  ["не равен", "neq"],
  ["не равна", "neq"],
  ["не равно", "neq"],
  ["равен", "eq"],
  ["равна", "eq"],
  ["равно", "eq"],
  ["равное", "eq"],
  ["больше", "gt"],
  ["меньше", "lt"],
  ["is at least", "gte"],
  ["is at most", "lte"],
  ["is not equal to", "neq"],
  ["is greater than", "gt"],
  ["is less than", "lt"],
  ["equals", "eq"],
  ["equal to", "eq"],
]

/* Заголовок модуля понимает ftsc, а не ядро (см. tools/ftsc/src/parse-module.mjs).
   Границу кириллического слова приходится задавать явно: \b в JavaScript
   определяется по латинице. */
const MODULE_HEADER = /^\s*(?:модуль|использует|экспортирует|module|uses|exports)(?![\p{L}])/u
const FUNCTOR_HEADER = /^\s*(?:функтор|functor)(?![\p{L}])/u
const COMMENT_LINE = /^\s*\/\//u

/**
 * Снять заголовок модуля ftsc, сохранив нумерацию строк.
 *
 * Строки заголовка не удаляются, а заменяются пустыми. Это и есть требование
 * «координаты исходного файла»: ядро компилирует текст без заголовка, но
 * считает строки по тому же файлу, что видит человек в редакторе и что
 * подчёркивает CI. Если бы строки вырезались, каждая диагностика ниже
 * заголовка съезжала бы вверх на его высоту.
 *
 * @param {string} text
 * @returns {{ source: string, kind: "document" | "functor", header: number }}
 */
export function stripModuleHeader(text) {
  const lines = text.split(/\r?\n/u)
  const first = lines.find((line) => line.trim() && !COMMENT_LINE.test(line)) ?? ""
  if (FUNCTOR_HEADER.test(first)) return { source: text, kind: "functor", header: 0 }

  const stripped = [...lines]
  let header = 0
  for (let index = 0; index < stripped.length; index += 1) {
    const line = stripped[index]
    if (!line.trim() || COMMENT_LINE.test(line)) continue
    if (!MODULE_HEADER.test(line)) break
    stripped[index] = ""
    header += 1
  }
  return { source: stripped.join("\n"), kind: "document", header }
}

/**
 * Разбить исходник на строки с координатами.
 *
 * BOM заменяется пробелом, а не срезается: позиции LSP считаются в кодовых
 * единицах UTF-16 исходной строки, и сдвиг на один символ увёл бы колонки
 * первой строки. CRLF снимается вместе с переводом строки — `raw` его уже
 * не содержит, поэтому `endChar` не включает невидимый возврат каретки.
 *
 * @param {string} source
 */
export function scanLines(source) {
  /* Блочные комментарии заменяются пробелами — колонки остаются на месте. */
  const withoutBlocks = source
    .replace(/^﻿/u, " ")
    .replace(/\/\*[\s\S]*?\*\//gu, (comment) => comment.replace(/[^\n]/gu, " "))
  return withoutBlocks.split(/\r?\n/u).map((raw, index) => {
    const stripped = stripLineComment(raw)
    const prefix = /^[ \t]*/u.exec(stripped)?.[0] ?? ""
    const text = stripped.trim()
    const indent = [...prefix].reduce((total, character) => total + (character === "\t" ? 2 : 1), 0)
    return { number: index, indent, text, startChar: prefix.length, endChar: prefix.length + text.length, raw }
  })
}

function stripLineComment(line) {
  let quote
  for (let index = 0; index < line.length - 1; index += 1) {
    const character = line[index]
    if (quote === undefined && (character === '"' || character === "'" || character === "«")) {
      quote = character === "«" ? "»" : character
    } else if (quote !== undefined && character === quote) {
      quote = undefined
    } else if (quote === undefined && character === "/" && line[index + 1] === "/") {
      return line.slice(0, index)
    }
  }
  return line
}

/**
 * Прочитать имя так же, как `readName` ядра: «ёлочки», кавычки или слово.
 * @param {string} text
 * @param {number} [from]
 */
export function readName(text, from = 0) {
  let index = from
  while (index < text.length && (text[index] === " " || text[index] === "\t")) index += 1
  const start = index
  const character = text[index]
  if (character === "«") {
    const end = text.indexOf("»", index + 1)
    if (end < 0) return null
    return finish(text, text.slice(index + 1, end), start, end + 1)
  }
  if (character === '"' || character === "'") {
    let value = ""
    for (let cursor = index + 1; cursor < text.length; cursor += 1) {
      if (text[cursor] === character) return finish(text, value, start, cursor + 1)
      if (text[cursor] === "\\" && cursor + 1 < text.length) value += text[++cursor]
      else value += text[cursor]
    }
    return null
  }
  const match = NAME_PATTERN.exec(text.slice(index))
  if (!match) return null
  return finish(text, match[0], start, index + match[0].length)
}

function finish(text, value, start, end) {
  const rest = text.slice(end)
  const trimmed = rest.trimStart()
  return {
    value: value.normalize("NFC"),
    start,
    end,
    rest: trimmed.trimEnd(),
    restStart: end + (rest.length - trimmed.length),
  }
}

/**
 * Сопоставить начало строки с одной из фраз.
 * @param {string} text
 * @param {string[]} phrases
 */
export function matchPhrase(text, phrases) {
  for (const phrase of phrases) {
    if (text === phrase) return { phrase, rest: "", restStart: text.length }
    if (text.startsWith(`${phrase} `)) {
      const after = phrase.length + 1
      const rest = text.slice(after)
      const trimmed = rest.trimStart()
      return { phrase, rest: trimmed.trimEnd(), restStart: after + (rest.length - trimmed.length) }
    }
  }
  return null
}

/** Разбить сравнение: `не меньше 10000` → оператор и операнд. */
export function matchComparison(text, offset = 0) {
  for (const [phrase, operator] of COMPARISONS) {
    const found = matchPhrase(text, [phrase])
    if (found) return { operator, phrase, value: found.rest, valueStart: offset + found.restStart }
  }
  return null
}

/** Каноническое имя типа по слову поверхности. */
export function canonicalType(word) {
  return BUILTIN_TYPES[word] ?? null
}
