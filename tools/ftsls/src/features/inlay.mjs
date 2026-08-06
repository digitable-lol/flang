/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * `textDocument/inlayHint` — фактический результат примера рядом с ожидаемым.
 *
 * Это то, ради чего сервер стоит держать открытым. Спецификация на FTS
 * исполняема, значит редактор может показать не «что автор написал», а
 * «что получилось на самом деле» — прямо в строке `ожидается`, без запуска
 * тестов и без переключения окна.
 */
import { format } from "../analysis.mjs"

/**
 * @param {{ outline: any, tests: any }} analysis
 * @param {{ start: { line: number }, end: { line: number } } | null} range
 */
export function inlayHints(analysis, range) {
  const { outline, tests } = analysis
  if (outline.surface !== "natural" || !tests) return []
  const english = outline.language === "en"
  const hints = []

  for (const utility of outline.utilities) {
    const results = tests.results.filter((item) => item.utility === utility.name)
    if (results.length === 0) continue
    const passed = results.filter((item) => item.passed).length

    hints.push({
      position: utility.lineRange.end,
      label: `${passed === results.length ? "✓" : "✗"} ${passed}/${results.length}`,
      kind: 1,
      paddingLeft: true,
      tooltip: {
        kind: "markdown",
        value: english
          ? `${passed} of ${results.length} examples converge`
          : `сходятся ${passed} из ${results.length} примеров`,
      },
    })

    for (const example of utility.examples) {
      const result = results.find((item) => item.example === example.name)
      const target = example.expectedNode
      if (!result || !target) continue
      const actual = result.error ? "⚠" : format(result.actual)
      hints.push({
        position: target.lineRange.end,
        label: `${result.passed ? "→" : "≠"} ${actual}`,
        kind: 1,
        paddingLeft: true,
        tooltip: {
          kind: "markdown",
          value: result.error
            ? result.error
            : english
              ? `expected ${format(result.expected)}, actual ${format(result.actual)}`
              : `ожидается ${format(result.expected)}, фактически ${format(result.actual)}`,
        },
      })
    }
  }

  if (!range) return hints
  return hints.filter((hint) => hint.position.line >= range.start.line && hint.position.line <= range.end.line)
}
