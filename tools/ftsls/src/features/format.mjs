/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * `textDocument/formatting` — нормализация отступов.
 *
 * Форматирование сознательно ограничено: два пробела на уровень вложенности
 * и снятие хвостовых пробелов. Имена, кавычки, порядок строк и текст
 * комментариев не трогаются — в языке, где отступ и есть синтаксис, любое
 * «умное» переписывание меняло бы смысл.
 *
 * Уровень берётся из относительных отступов исходника, а не из ключевых
 * слов: файл с ошибкой всё равно переформатируется предсказуемо.
 */

/**
 * @param {{ outline: any }} analysis
 * @param {string} text
 * @param {{ tabSize?: number, insertSpaces?: boolean }} [options]
 */
export function formatDocument(analysis, text, options = {}) {
  const { outline } = analysis
  if (outline.surface !== "natural") return [] /* скобочную поверхность не форматируем */

  const unit = options.insertSpaces === false ? "\t" : " ".repeat(options.tabSize && options.tabSize > 0 ? options.tabSize : 2)
  const original = text.split(/\r?\n/u)
  const stack = []
  const formatted = original.map((line, index) => {
    const scanned = outline.lines[index]
    const leading = /^[ \t]*/u.exec(line)?.[0] ?? ""
    const body = line.slice(leading.length).replace(/[ \t]+$/u, "")
    /* Пустая по смыслу строка: пусто или содержимое блочного комментария.
       Такие строки не переносим по уровням — только чистим хвост. */
    if (!scanned || scanned.text.length === 0) return line.replace(/[ \t]+$/u, "")
    while (stack.length > 0 && scanned.indent <= stack[stack.length - 1]) stack.pop()
    const level = stack.length
    stack.push(scanned.indent)
    return unit.repeat(level) + body
  })

  const result = formatted.join("\n")
  if (result === text) return []
  const last = original.length - 1
  return [
    {
      range: {
        start: { line: 0, character: 0 },
        end: { line: last, character: original[last].length },
      },
      newText: result,
    },
  ]
}
