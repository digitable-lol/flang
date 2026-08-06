#!/usr/bin/env node
/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * ftspec — проверка целостности бизнес-требований до реализации.
 *
 * Контракт вывода тот же, что у ядра FTS и у ftsc: результат — JSON в stdout,
 * диагностики — в stderr, ненулевой код возврата при конфликтах. Поэтому
 * ftspec встраивается в CI и в агентов ровно как ftsc.
 */
import { admit, check, normalizeSpecId } from "../src/check.mjs"
import { markdown } from "../src/report.mjs"

const argv = process.argv.slice(2)
const command = argv[0]

function option(name, fallback = null) {
  const index = argv.indexOf(`--${name}`)
  return index === -1 ? fallback : (argv[index + 1] ?? fallback)
}

const positional = argv.slice(1).filter((item, index, list) => !item.startsWith("--") && !list[index - 1]?.startsWith("--"))
const directory = positional[0] ?? "."

const out = (value) => process.stdout.write(`${typeof value === "string" ? value : JSON.stringify(value, null, 2)}\n`)

function finish(result) {
  if (result.diagnostics.length) {
    process.stderr.write(
      `${JSON.stringify({ diagnostics: result.diagnostics.map(({ specs, details, ...core }) => core) }, null, 2)}\n`,
    )
  }
  process.exit(result.ok ? 0 : 1)
}

const usage = [
  "ftspec — проверка целостности бизнес-требований до реализации",
  "",
  "  ftspec check <dir>                         полная проверка корпуса",
  "  ftspec admit <dir> --spec specs/003-x      допуск одной новой спеки к остальному корпусу",
  "  ftspec report <dir> [--format md|json]     человекочитаемый отчёт",
  "  ftspec report <dir> --spec specs/003-x     отчёт о допуске",
  "",
  "  --step <n>      шаг сетки входов для инвариантов конституции (по умолчанию 1)",
  "  --project <имя> имя корпуса в отчёте",
  "",
].join("\n")

try {
  const options = { project: option("project", "корпус"), step: Number(option("step", "1")) || 1 }
  const spec = option("spec")

  switch (command) {
    case "check": {
      const result = await check(directory, options)
      out(result)
      finish(result)
      break
    }

    case "admit": {
      if (!spec) throw new Error("укажите --spec <каталог спеки>")
      const result = await admit(directory, normalizeSpecId(spec), options)
      out(result)
      finish(result)
      break
    }

    case "report": {
      const result = spec ? await admit(directory, normalizeSpecId(spec), options) : await check(directory, options)
      out(option("format", "md") === "json" ? result : markdown(result))
      process.exit(result.ok ? 0 : 1)
      break
    }

    default:
      process.stderr.write(usage)
      process.exit(2)
  }
} catch (error) {
  const diagnostics = error.diagnostics ?? [{ code: "FTSPEC_INTERNAL", message: error.message, severity: "error" }]
  process.stderr.write(`${JSON.stringify({ error: error.message, diagnostics }, null, 2)}\n`)
  process.exit(1)
}
