/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Загрузка корпуса спецификаций.
 *
 * ftspec ничего не парсит сам: разбор и связывание — работа ftsc
 * (`resolveProject` + `link`), а компиляция тела модуля — работа ядра FTS.
 * Здесь мы добавляем ровно одно: РОЛЬ файла в корпусе. Роль определяется
 * положением в дереве, потому что корпус требований — это в первую очередь
 * договорённость людей о том, где что лежит, и машине незачем её угадывать.
 */
import { readdir, readFile, stat } from "node:fs/promises"
import { existsSync } from "node:fs"
import { extname, join, relative, resolve as resolvePath } from "node:path"

import { resolveProject } from "../../ftsc/src/resolve.mjs"
import { link } from "../../ftsc/src/link.mjs"
import { parseModuleFile } from "../../ftsc/src/parse-module.mjs"

export const codes = {
  ruleConflict: "FTSPEC_RULE_CONFLICT",
  constitution: "FTSPEC_CONSTITUTION",
  ruleDuplicate: "FTSPEC_RULE_DUPLICATE",
  uncovered: "FTSPEC_UNCOVERED",
  memoryStale: "FTSPEC_MEMORY_STALE",
  corpusEmpty: "FTSPEC_CORPUS_EMPTY",
  specUnknown: "FTSPEC_SPEC_UNKNOWN",
}

/** Поле входа инварианта, в которое подставляется результат проверяемой утилиты. */
export const RESULT_FIELD = "итог"

const IGNORED = new Set(["node_modules", ".git", "dist", "generated"])

const CATEGORY_LINE = /^[ \t]*(?:категория|category)\s+(?:«([^»]+)»|"([^"]+)"|(\S+))/mu

export async function listSpecFiles(root, directory = root, found = []) {
  const entries = (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))
  for (const entry of entries) {
    if (entry.name.startsWith(".") || IGNORED.has(entry.name)) continue
    const full = join(directory, entry.name)
    if (entry.isDirectory()) await listSpecFiles(root, full, found)
    else if (extname(entry.name) === ".fts") found.push(full)
  }
  return found
}

/** Роль файла в корпусе: конституция, решение, спека, отображение. */
export function roleOf(source) {
  const parts = source.split("/")
  const base = parts[parts.length - 1]
  if (parts.length === 1 && /^(constitution|конституция)\.fts$/u.test(base)) return "constitution"
  const top = parts[0]
  if (top === "memory" || top === "память") return "memory"
  if (top === "specs" || top === "спеки") return "spec"
  if (top === "mapping" || top === "отображения") return "mapping"
  return "other"
}

/** Идентификатор спеки — имя её каталога: `specs/002-подписки/spec.fts` → `002-подписки`. */
export function specIdOf(source) {
  const parts = source.split("/")
  return parts.length > 2 ? parts[1] : parts[parts.length - 1].replace(/\.fts$/u, "")
}

/* Повторяет разрешение путей из ftsc/resolve.mjs: `использует ... из «путь»`
   принимает и файл, и каталог с единственным .fts. Дублирование намеренное —
   пред-проход обязан работать ДО resolveProject, который на битой ссылке
   бросает исключение и не даёт сказать, что именно устарело. */
async function locate(fromFile, target, root) {
  const base = resolvePath(fromFile, "..")
  for (const candidate of [resolvePath(base, target), resolvePath(base, `${target}.fts`), resolvePath(root, target)]) {
    if (!existsSync(candidate)) continue
    if ((await stat(candidate)).isDirectory()) {
      const inside = await listSpecFiles(candidate, candidate)
      if (inside.length === 1) return inside[0]
      continue
    }
    return candidate
  }
  return null
}

/**
 * Осиротевшие решения: модель в `memory/`, которая ссылается на категорию,
 * которой в корпусе больше нет.
 *
 * Проверяется до `resolveProject`, потому что битая ссылка в памяти проекта —
 * это не поломка сборки, а сигнал «решение устарело»: его надо перечитать
 * человеку, а не чинить импорт.
 */
export async function checkMemory(directory) {
  /* Пути внутри сравниваются с результатом `resolve`, поэтому корень обязан
     быть абсолютным: иначе ссылка «../constitution.fts» никогда не совпадёт с
     файлом, который мы уже прочитали. */
  const root = resolvePath(process.cwd(), directory)
  const files = await listSpecFiles(root)
  const known = new Map()
  const parsed = new Map()

  for (const file of files) {
    const source = await readFile(file, "utf8")
    let head
    try {
      head = parseModuleFile(source, relative(root, file))
    } catch {
      continue /* синтаксис — забота ftsc; здесь мы только про ссылки */
    }
    parsed.set(file, head)
    if (head.kind === "module") {
      const category = CATEGORY_LINE.exec(head.body)
      const name = category ? (category[1] ?? category[2] ?? category[3]) : null
      if (name) known.set(file, name)
    }
  }

  const categories = new Set(known.values())
  const diagnostics = []

  for (const [file, head] of parsed) {
    const source = relative(root, file)
    if (roleOf(source) !== "memory") continue

    for (const entry of head.imports ?? []) {
      const target = await locate(file, entry.from, root)
      if (!target) {
        diagnostics.push({
          code: codes.memoryStale,
          message: `решение «${head.name ?? source}» ссылается на файл «${entry.from}», которого больше нет`,
          severity: "error",
          path: source,
          specs: [specIdOf(source)],
          details: { reference: entry.from, category: entry.category },
        })
        continue
      }
      const category = known.get(target)
      if (category !== entry.category) {
        diagnostics.push({
          code: codes.memoryStale,
          message:
            `решение «${head.name ?? source}» ссылается на категорию «${entry.category}», ` +
            `а файл «${entry.from}» сегодня содержит ${category ? `«${category}»` : "не категорию"}`,
          severity: "error",
          path: source,
          specs: [specIdOf(source)],
          details: { reference: entry.from, category: entry.category, actual: category ?? null },
        })
      }
    }

    if (head.kind === "functor") {
      for (const side of ["from", "to"]) {
        if (categories.has(head[side])) continue
        diagnostics.push({
          code: codes.memoryStale,
          message: `решение-функтор «${head.name}» отображает категорию «${head[side]}», которой в корпусе больше нет`,
          severity: "error",
          path: source,
          specs: [specIdOf(source)],
          details: { category: head[side] },
        })
      }
    }
  }

  return diagnostics
}

/**
 * Собирает корпус: модули с ролями, функторы, программу ftsc.
 *
 * @returns {{root, project, modules, functors, constitution, specs, program, linkDiagnostics}}
 */
export async function loadCorpus(directory, { project = "корпус" } = {}) {
  const root = resolvePath(process.cwd(), directory)
  const resolved = await resolveProject(root)

  const modules = resolved.modules.map((module) => ({
    ...module,
    role: roleOf(module.source),
    specId: specIdOf(module.source),
  }))
  const functors = resolved.functors

  let program = null
  let linkDiagnostics = []
  try {
    program = link({ modules: resolved.modules, functors }, { project })
  } catch (error) {
    linkDiagnostics = (error.diagnostics ?? [{ code: "FTSC", message: error.message, severity: "error" }]).map((diagnostic) => ({
      ...diagnostic,
      specs: diagnostic.path ? [specIdOf(diagnostic.path)] : [],
    }))
  }

  const constitution =
    modules.find((module) => module.role === "constitution") ??
    modules.find((module) => module.category === "Конституция" || module.category === "Constitution") ??
    null

  return {
    root,
    project,
    modules,
    functors,
    constitution,
    specs: modules.filter((module) => module.role === "spec"),
    memory: modules.filter((module) => module.role === "memory"),
    program,
    linkDiagnostics,
  }
}

export const structureOf = (document, name) => (document.structures ?? []).find((item) => item.name === name)

/** Карта «имя поля → род области значений» для объекта: вход интервального анализа. */
export function kindsOf(structure, kindFn) {
  return new Map((structure?.fields ?? []).map((field) => [field.name, kindFn(field.type)]))
}
