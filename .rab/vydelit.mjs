/* Выделяет функцию из flang/stdlib вместе с типами и вызываемыми функциями,
   убирая примеры автора. Копирование в измеренные строки не входит — как и в
   прошлом замере. */
import { readFileSync, writeFileSync } from "node:fs"
const КОРЕНЬ = "/home/a/projects/flang/.claude/worktrees/agent-a4daa59c6b3b8bbfc"
const { parse } = await import(КОРЕНЬ + "/flang/src/parser.mjs")

const [, , файл, имяФункции, выход, модуль] = process.argv
const путь = КОРЕНЬ + "/flang/stdlib/" + файл
const текст = readFileSync(путь, "utf8")
const строки = текст.split("\n")
const ast = parse(текст, файл)

const начала = [
  ...(ast.types ?? []).map((т) => т.span.line),
  ...ast.functions.map((ф) => ф.span.line),
  ...(ast.legacy ?? []).map((л) => л.span?.line).filter(Boolean),
].sort((а, б) => а - б)

function кусок(строкаЗаголовка) {
  const и = начала.indexOf(строкаЗаголовка)
  if (и < 0) throw new Error("нет объявления на строке " + строкаЗаголовка)
  let конец = и + 1 < начала.length ? начала[и + 1] - 1 : строки.length
  /* пустые строки и комментарии перед следующим объявлением — его, не наши */
  while (конец > строкаЗаголовка && (строки[конец - 1].trim() === "" || строки[конец - 1].trimStart().startsWith("//"))) конец--
  return строки.slice(строкаЗаголовка - 1, конец)
}
function безПримеров(куски) {
  const вон = []
  let вПримере = false
  for (const с of куски) {
    if (/^\s*пример\s/.test(с)) { вПримере = true; continue }
    if (вПримере) {
      if (/^\s{4,}(дано|ожидается)/.test(с)) continue
      вПримере = false
    }
    вон.push(с)
  }
  return вон
}

const функции = new Map(ast.functions.map((ф) => [ф.name, ф]))
const типы = new Map((ast.types ?? []).map((т) => [т.name, т]))

const нужныеФ = []
const виделиФ = new Set()
const виделиТ = new Set()
function собрать(имя) {
  if (виделиФ.has(имя)) return
  виделиФ.add(имя)
  const ф = функции.get(имя)
  if (!ф) return
  const текстФ = кусок(ф.span.line).join("\n")
  for (const м of текстФ.matchAll(/«([^»]+)»\s+от/g)) собрать(м[1])
  for (const м of текстФ.matchAll(/«([^»]+)»/g)) if (типы.has(м[1])) виделиТ.add(м[1])
  нужныеФ.push(ф)
}
собрать(имяФункции)
нужныеФ.sort((а, б) => а.span.line - б.span.line)
const нужныеТ = [...виделиТ].map((и) => типы.get(и)).sort((а, б) => а.span.line - б.span.line)

const части = [
  "модуль «" + модуль + "»",
  "",
  "// Функция и её зависимости перенесены из flang/stdlib/" + файл + " ДОСЛОВНО;",
  "// примеры автора убраны. Копирование в измеренные строки не входит.",
  "",
]
for (const т of нужныеТ) части.push(кусок(т.span.line).join("\n"), "")
for (const ф of нужныеФ) части.push(безПримеров(кусок(ф.span.line)).join("\n"), "")
writeFileSync(КОРЕНЬ + "/" + выход, части.join("\n").replace(/\n{3,}/g, "\n\n"))
console.log(выход, "— функций", нужныеФ.length, "(" + нужныеФ.map((ф) => ф.name).join(", ") + ")", "типов", нужныеТ.length)
