#!/usr/bin/env node
/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * ftsmap — карта покрытия правил утилиты FTS.
 *
 * Контракт вывода тот же, что у ядра, ftsc и ftspec: машинный результат — в
 * stdout, диагностики — в stderr, ненулевой код возврата при ошибке. Поэтому
 * ftsmap встраивается в CI и в агентов ровно так же, как остальные инструменты.
 *
 * Коды возврата: 0 — ошибок нет; 1 — есть диагностики уровня error (нарушенное
 * свойство, мёртвое правило) или инструмент не смог отработать; 2 — неверный
 * вызов.
 */
import { writeFile } from "node:fs/promises"

import { analyzeDocument, reportOf } from "../src/coverage.mjs"
import { loadModel } from "../src/load.mjs"
import { renderSvg } from "../src/svg.mjs"
import { textReport } from "../src/text.mjs"

const argv = process.argv.slice(2)

const usage = [
  "ftsmap — карта покрытия правил: области срабатывания, пересечения, дыры, достижимость свойств",
  "",
  "  ftsmap <модель.fts> --utility «имя» --out map.svg   диаграмма в SVG",
  "  ftsmap <модель.fts> --json                          машинный отчёт в stdout",
  "  ftsmap <модель.fts> --text                          текстовый отчёт для терминала и CI",
  "",
  "  --utility «имя»  разобрать одну утилиту (по умолчанию — все)",
  "  --out <файл>     записать SVG; «-» — вывести SVG в stdout",
  "  --width <px>     ширина диаграммы (по умолчанию 1000)",
  "",
].join("\n")

function option(name, fallback = null) {
  const index = argv.indexOf(`--${name}`)
  return index === -1 ? fallback : (argv[index + 1] ?? fallback)
}

const flag = (name) => argv.includes(`--${name}`)

const positional = argv.filter((item, index, list) => !item.startsWith("--") && !list[index - 1]?.startsWith("--"))

function fail(error, code = 1) {
  const diagnostics = error.diagnostics ?? [
    { code: "FTSMAP_INTERNAL", message: error.message ?? String(error), severity: "error" },
  ]
  process.stderr.write(`${JSON.stringify({ error: error.message ?? String(error), diagnostics }, null, 2)}\n`)
  process.exit(code)
}

const model = positional[0]
if (!model || flag("help")) {
  process.stderr.write(usage)
  process.exit(model ? 0 : 2)
}

try {
  const document = await loadModel(model)
  const analysis = analyzeDocument(document, { utility: option("utility") ?? undefined })
  const report = reportOf(analysis)

  const out = option("out")
  const width = Number(option("width", "1000")) || 1000
  const wantsText = flag("text")
  const wantsJson = flag("json")

  let svg = null
  if (out) svg = renderSvg(analysis, { width })

  if (out && out === "-") {
    process.stdout.write(svg)
  } else {
    if (out) await writeFile(out, svg, "utf8")
    process.stdout.write(wantsText && !wantsJson ? textReport(report) : `${JSON.stringify(report, null, 2)}\n`)
  }

  const errors = report.diagnostics.filter((item) => item.severity === "error")
  if (errors.length) {
    process.stderr.write(`${JSON.stringify({ diagnostics: report.diagnostics }, null, 2)}\n`)
    process.exit(1)
  }
  const warnings = report.diagnostics.filter((item) => item.severity === "warning")
  if (warnings.length) process.stderr.write(`${JSON.stringify({ diagnostics: warnings }, null, 2)}\n`)
  process.exit(0)
} catch (error) {
  fail(error)
}
