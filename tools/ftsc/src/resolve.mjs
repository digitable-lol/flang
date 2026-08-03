/**
 * Обход дерева проекта: читает .fts, снимает заголовки, компилирует тела ядром.
 *
 * Здесь нет ни одного решения о корректности проекта — только сбор фактов.
 * Решение принимается дальше, в link.mjs и self-check (модели FTS).
 */
import { readdir, readFile, stat } from "node:fs/promises"
import { existsSync } from "node:fs"
import { extname, join, relative, resolve as resolvePath } from "node:path"

import { compile } from "../../../dist/src/index.js"
import { codes, fail } from "./diagnostics.mjs"
import { parseModuleFile } from "./parse-module.mjs"

const IGNORED = new Set(["node_modules", ".git", "dist", "generated"])

async function collect(directory, found = []) {
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith(".") || IGNORED.has(entry.name)) continue
    const full = join(directory, entry.name)
    if (entry.isDirectory()) await collect(full, found)
    else if (extname(entry.name) === ".fts") found.push(full)
  }
  return found
}

/** `использует ... из «путь»` принимает и файл, и каталог с единственным .fts. */
async function resolveImportPath(fromFile, target, root) {
  const base = resolvePath(fromFile, "..")
  const candidates = [resolvePath(base, target), resolvePath(base, `${target}.fts`), resolvePath(root, target)]
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue
    if ((await stat(candidate)).isDirectory()) {
      const inside = (await collect(candidate)).filter((file) => !file.includes("/test/"))
      if (inside.length === 1) return inside[0]
      continue
    }
    return candidate
  }
  return null
}

export async function resolveProject(rootDirectory) {
  const root = resolvePath(process.cwd(), rootDirectory)
  const files = await collect(root)
  if (!files.length) throw fail(codes.empty, `в ${rootDirectory} не найдено ни одного .fts`, rootDirectory)

  const modules = []
  const functors = []

  for (const file of files) {
    const source = await readFile(file, "utf8")
    const parsed = parseModuleFile(source, relative(root, file))

    if (parsed.kind === "functor") {
      functors.push({ ...parsed, file, source: relative(root, file) })
      continue
    }

    let document
    try {
      document = compile(parsed.body)
    } catch (error) {
      /* Диагностику ядра не переписываем: у неё уже есть код и место ошибки. */
      error.message = `${relative(root, file)}: ${error.message}`
      throw error
    }

    modules.push({
      name: parsed.name ?? document.category,
      category: document.category,
      file,
      source: relative(root, file),
      importsRaw: parsed.imports,
      exports: parsed.exports,
      document,
    })
  }

  /* Импорт указывает на файл, а связывать удобнее по имени модуля: переводим
     пути в имена сразу, чтобы дальше работать только с графом имён. */
  const byFile = new Map(modules.map((module) => [module.file, module]))
  for (const holder of [...modules, ...functors]) {
    holder.imports = []
    for (const entry of holder.importsRaw ?? holder.imports ?? []) {
      const path = await resolveImportPath(holder.file, entry.from, root)
      if (!path) throw fail(codes.importNotFound, `${holder.source}: не найден модуль «${entry.from}»`, holder.source)
      const target = byFile.get(path)
      if (!target) throw fail(codes.importNotFound, `${holder.source}: «${entry.from}» не является модулем`, holder.source)
      if (target.category !== entry.category && target.name !== entry.category) {
        throw fail(
          codes.importCategory,
          `${holder.source}: файл «${entry.from}» содержит категорию «${target.category}», а импортируется «${entry.category}»`,
          holder.source,
        )
      }
      holder.imports.push({ category: target.category, module: target.name })
    }
    delete holder.importsRaw
  }

  for (const functor of functors) delete functor.file
  return { root, modules, functors }
}
