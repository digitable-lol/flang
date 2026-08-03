#!/usr/bin/env node
/**
 * ftsvm — исполнитель программ FTS.
 *
 * Контракт вывода тот же, что у ядра, ftsc и ftspec: результат — JSON в stdout,
 * диагностики — в stderr, ненулевой код возврата при ошибке. Поэтому ftsvm
 * встраивается в CI и в агентов ровно так же.
 *
 * Исполнитель ничего не знает про `.fts`: его вход — IR. CLI берёт на себя
 * только загрузку — либо готовый IR (`--ir program.json`, например вывод
 * `ftsc ir`), либо файлы `.fts`, которые компилирует ядро.
 */
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

import { compileUtility, listUtilities, run } from "../src/index.mjs"
import { loadProgram } from "../src/load-fts.mjs"

const argv = process.argv.slice(2)
const command = argv[0]

function option(name, fallback = null) {
  const index = argv.indexOf(`--${name}`)
  return index === -1 ? fallback : (argv[index + 1] ?? fallback)
}
const flag = (name) => argv.includes(`--${name}`)

const positional = argv.slice(1).filter((item, index, list) => !item.startsWith("--") && !list[index - 1]?.startsWith("--"))

const print = (value) => process.stdout.write(`${typeof value === "string" ? value : JSON.stringify(value, null, 2)}\n`)

/* Программа приходит либо готовым IR, либо исходниками `.fts`. */
async function loadInput() {
  const ir = option("ir")
  if (ir) return JSON.parse(await readFile(resolve(ir), "utf8"))
  if (!positional.length) throw new Error("укажите файлы .fts или --ir <файл>")
  return loadProgram(
    positional.map((file) => resolve(file)),
    { project: option("project", "ftsvm") },
  )
}

const usage = [
  "ftsvm — исполнитель программ FTS",
  "",
  "  ftsvm list <файлы.fts...> | --ir program.json      что в программе исполнимо",
  "  ftsvm run  <файлы.fts...> --utility «имя» --input вход.json",
  "  ftsvm bench [--quick] [--json]                     ядро против интерпретатора против JIT",
  "",
  "  --module «имя»   модуль, если утилит с одним именем несколько",
  "  --jit            исполнить скомпилированной функцией вместо интерпретации",
  "  --ir <файл>      готовое IR (например, вывод `ftsc ir`)",
  "",
].join("\n")

try {
  switch (command) {
    case "list": {
      print(listUtilities(await loadInput(), option("module")))
      break
    }

    case "run": {
      const utility = option("utility")
      if (!utility) throw new Error("укажите --utility «имя»")
      const inputFile = option("input")
      if (!inputFile) throw new Error("укажите --input <файл.json>")
      const program = await loadInput()
      const input = JSON.parse(await readFile(resolve(inputFile), "utf8"))
      const moduleName = option("module")
      const result = flag("jit") ? compileUtility(program, moduleName, utility)(input) : run(program, moduleName, utility, input)
      print({ utility, module: moduleName, engine: flag("jit") ? "jit" : "interpreter", result })
      break
    }

    case "bench": {
      /* Бенчмарк тянет фикстуры и модели, поэтому импортируется по требованию:
         `ftsvm run` не должен платить за то, чем не пользуется. */
      const { printReport, runBenchmark } = await import("../bench.mjs")
      const report = await runBenchmark(flag("quick") ? { scales: [1000, 10000], repeats: () => 5 } : {})
      if (flag("json")) print(report)
      else printReport(report)
      break
    }

    default:
      process.stderr.write(usage)
      process.exit(2)
  }
} catch (error) {
  const diagnostics = error.diagnostics ?? [{ code: error.code ?? "FTSVM_INTERNAL", message: error.message, severity: "error" }]
  process.stderr.write(`${JSON.stringify({ error: error.message, diagnostics }, null, 2)}\n`)
  process.exit(1)
}
