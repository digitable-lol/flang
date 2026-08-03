/**
 * Загрузка моделей `.fts` в IR — тонкая обёртка над компилятором ядра.
 *
 * ftsvm исполняет IR и про `.fts` ничего не знает; но модели надёжности
 * из tools/ftsc/stdlib/supervision лежат исходниками, и тестам с бенчмарком
 * нужен способ получить из них программу. Способ ровно тот же, что у
 * tools/ftsc/test/make-fixtures.mjs: снять строки заголовка модуля (их
 * понимает ftsc, а не ядро) и скомпилировать остаток.
 *
 * Это единственное место в ftsvm, зависящее от вендорной сборки ядра,
 * и оно не участвует в исполнении: получить IR можно и от `ftsc ir`.
 */
import { readFile } from "node:fs/promises"
import { basename } from "node:path"

import { compile, validate } from "../../../dist/src/index.js"

import { vmError } from "./errors.mjs"

/* Заголовок модуля: ftsc его разбирает, компилятор ядра о нём не знает.
   \b в JavaScript определяется по латинице, поэтому граница слова задана явно. */
const HEADER = /^\s*(модуль|использует|экспортирует|module|uses|exports)(?![\p{L}])/u

/**
 * Скомпилировать исходник модуля в документ ядра.
 * @param {string} source
 */
export function compileModuleSource(source) {
  return compile(
    source
      .split("\n")
      .filter((line) => !HEADER.test(line))
      .join("\n")
      .trim(),
  )
}

/**
 * Собрать программу IR из файлов `.fts`.
 *
 * Проверка обязательна: JIT печатает код по IR и вправе доверять типам
 * полей только потому, что документ прошёл validate. Программа, не прошедшая
 * проверку, до генерации кода не доходит.
 *
 * @param {string[]} files абсолютные пути к `.fts`
 * @param {{ project?: string }} [options]
 */
export async function loadProgram(files, options = {}) {
  const modules = []
  for (const file of files) {
    const document = compileModuleSource(await readFile(file, "utf8"))
    const report = validate(document)
    if (!report.valid) {
      const detail = report.diagnostics.map((item) => `${item.code}: ${item.message}`).join("; ")
      throw vmError("FTSVM_INVALID_MODULE", `модуль «${basename(file)}» не прошёл проверку: ${detail}`)
    }
    modules.push({
      name: document.category,
      category: document.category,
      source: file,
      imports: [],
      exports: null,
      document,
    })
  }
  return {
    ir: 1,
    project: options.project ?? "ftsvm",
    modules,
    functors: [],
    order: modules.map((module) => module.name),
  }
}
