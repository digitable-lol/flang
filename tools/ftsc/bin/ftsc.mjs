#!/usr/bin/env node
/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * ftsc — компилятор проекта на FTS.
 *
 * Контракт вывода тот же, что у ядра: результат — JSON в stdout, диагностики —
 * в stderr, ненулевой код возврата при ошибке. Поэтому ftsc так же встраивается
 * в CI, редакторы и агентов, как `fts`.
 */
import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"

import { FtscError } from "../src/diagnostics.mjs"
import { resolveProject } from "../src/resolve.mjs"
import { link } from "../src/link.mjs"
import { loadTarget, loadTargets, probeToolchain } from "../src/targets.mjs"
import { mermaid } from "../src/graph.mjs"

const argv = process.argv.slice(2)
const command = argv[0]

function option(name, fallback = null) {
  const index = argv.indexOf(`--${name}`)
  return index === -1 ? fallback : (argv[index + 1] ?? fallback)
}
const flag = (name) => argv.includes(`--${name}`)

const positional = argv.slice(1).filter((item, index, list) => !item.startsWith("--") && !list[index - 1]?.startsWith("--"))
const directory = positional[0] ?? "."

function print(value) {
  process.stdout.write(`${typeof value === "string" ? value : JSON.stringify(value, null, 2)}\n`)
}

function bail(error) {
  const diagnostics = error instanceof FtscError ? error.diagnostics : (error.diagnostics ?? [])
  process.stderr.write(`${JSON.stringify({ error: error.message, diagnostics }, null, 2)}\n`)
  process.exit(1)
}

async function buildProgram() {
  const project = await resolveProject(directory)
  return link(project, { project: option("project", "project") })
}

/* Проверка допуска написана на самом FTS (tools/ftsc/self). Если модели решили
   «нет», сборка не начинается — иначе bootstrap был бы декоративным. */
async function admit(program) {
  if (flag("skip-self-check")) return null
  /* Модели допуска — отдельная часть компилятора; если её ещё нет в дереве,
     сборка не обязана падать. */
  const module = await import("../src/self-check.mjs").catch(() => null)
  if (!module?.selfCheck) return null
  const verdict = await module.selfCheck(program).catch(() => null)
  if (verdict && verdict.allowed === false) {
    process.stderr.write(`${JSON.stringify({ error: "проект не допущен к сборке", verdict }, null, 2)}\n`)
    process.exit(1)
  }
  return verdict
}

async function writeFiles(files, out) {
  for (const file of files) {
    const target = resolve(process.cwd(), out, file.path)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, file.content, "utf8")
  }
}

try {
  switch (command) {
    case "check": {
      const program = await buildProgram()
      const verdict = await admit(program)
      print({
        project: program.project,
        modules: program.modules.map((module) => ({ name: module.name, category: module.category, source: module.source })),
        functors: program.functors.map((functor) => `${functor.from} → ${functor.to} (${functor.name})`),
        order: program.order,
        selfCheck: verdict ? { allowed: verdict.allowed, blocking: verdict.blocking } : "пропущена",
      })
      break
    }

    case "ir": {
      print(await buildProgram())
      break
    }

    case "graph": {
      print(mermaid(await buildProgram()))
      break
    }

    case "targets": {
      const targets = await loadTargets()
      print(
        targets.map((target) => {
          const toolchain = probeToolchain(target)
          return {
            id: target.id,
            name: target.name,
            toolchain: toolchain.available === null ? "не требуется" : toolchain.available ? toolchain.version : "недоступен",
          }
        }),
      )
      break
    }

    case "build": {
      const program = await buildProgram()
      await admit(program)
      const out = option("out", "generated")
      const ids = flag("all") ? (await loadTargets()).map((target) => target.id) : [option("target")].filter(Boolean)
      if (!ids.length) throw new Error("укажите --target <язык> или --all")

      const written = []
      for (const id of ids) {
        const target = await loadTarget(id)
        const files = target.emit(program, { projectName: program.project })
        await writeFiles(files, resolve(out, id))
        written.push({ target: id, files: files.length, out: resolve(out, id) })
      }
      print(written)
      break
    }

    default:
      process.stderr.write(
        [
          "ftsc — компилятор проекта на FTS",
          "",
          "  ftsc check <dir>                      разобрать, слинковать, проверить функторы и допуск",
          "  ftsc build <dir> --target <язык> [--out generated]",
          "  ftsc build <dir> --all --out generated",
          "  ftsc targets                          список бэкендов и доступность тулчейнов",
          "  ftsc graph <dir>                      категории и функторы диаграммой mermaid",
          "  ftsc ir <dir>                         промежуточное представление (для отладки бэкенда)",
          "",
          "  --skip-self-check                     не спрашивать модели допуска из tools/ftsc/self",
          "",
        ].join("\n"),
      )
      process.exit(2)
  }
} catch (error) {
  bail(error)
}
