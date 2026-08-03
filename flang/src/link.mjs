/**
 * Связывание модулей flang: `использует «Модуль» из "путь"`.
 *
 * До этого файла импорт разбирался, но не действовал: parser.mjs складывал
 * `{ category, from }` в `legacy`, а имена из другого файла оставались
 * несвязанными — `FLANG_UNKNOWN_NAME` на первом же вызове. Из-за этого stdlib
 * нельзя было использовать из решений, а ядро FTS, разложенное по слоям
 * (лексер, парсер, вычислитель, печать), не собиралось в одну программу.
 *
 * Решение намеренно простое: импорт — это слияние объявлений, а не пространство
 * имён. Языку без экспоненциалов и с уникальными именами вариантов
 * пространства имён дали бы больше сложности, чем пользы: пришлось бы решать,
 * как выглядит квалифицированное имя по-русски («Списки.Сумма»? «Сумма из
 * Списки»?), и тащить это решение во все восемь бэкендов. Слияние же печатается
 * в любой целевой язык одинаково — как один набор функций.
 *
 * Цена решения — конфликт имён становится ошибкой, а не перекрытием. Это
 * осознанно: молчаливое перекрытие функции из другого файла — источник ошибок,
 * которые невозможно объяснить, глядя на один файл.
 */

import { readFile } from "node:fs/promises"
import { dirname, isAbsolute, resolve } from "node:path"

/** Ошибка связывания в том же формате, что остальные диагностики языка. */
function diagnostic(code, message, span) {
  return span === undefined ? { code, message, severity: "error" } : { code, message, severity: "error", span }
}

/** Импорты лежат в legacy — там же, куда их кладёт parseModuleHeader. */
export function importsOf(program) {
  const header = (program?.legacy ?? []).find((node) => node?.construct === "moduleHeader")
  return header?.value?.imports ?? []
}

/** `экспортирует` ограничивает видимое; без него виден весь модуль. */
function exportsOf(program) {
  const header = (program?.legacy ?? []).find((node) => node?.construct === "moduleHeader")
  const names = header?.value?.exports
  return Array.isArray(names) && names.length > 0 ? new Set(names) : null
}

/**
 * Загружает файл и все его импорты, сливая объявления в одну программу.
 *
 * `parse` передаётся снаружи, а не импортируется здесь: bin/flang.mjs уже умеет
 * находить функцию разбора среди нескольких возможных имён, и дублировать этот
 * выбор значит однажды разойтись с ним.
 */
export async function linkProgram(entryFile, source, parse, options = {}) {
  const readSource = options.readFile ?? ((file) => readFile(file, "utf8"))
  const diagnostics = []
  const types = []
  const functions = []
  /* Откуда пришло имя — нужно, чтобы конфликт назвал оба файла, а не только
     тот, который загрузился вторым. */
  const originOfType = new Map()
  const originOfFunction = new Map()
  const loaded = new Set()
  const loading = []
  /* Тексты файлов и признак «в файле есть импорты» — для второго прохода,
     который доразрешает вызовы функций без аргументов. */
  const sources = new Map()
  const withImports = new Set()

  /**
   * Пересечение «что модуль отдаёт» и «что у него просят».
   *
   * Просьба не расширяет видимое: `только «Внутри»` для неэкспортированного
   * имени ничего не даёт — иначе `экспортирует` перестал бы что-либо значить.
   */
  const narrow = (exported, requested) => {
    if (requested === undefined || requested === null) return exported
    if (exported === null) return requested
    return new Set([...requested].filter((name) => exported.has(name)))
  }

  const merge = (program, file, visible) => {
    for (const type of program.types ?? []) {
      if (visible !== null && !visible.has(type.name)) continue
      const previous = originOfType.get(type.name)
      if (previous !== undefined) {
        if (previous !== file) {
          diagnostics.push(
            diagnostic(
              "FLANG_DUPLICATE_NAME",
              `тип «${type.name}» объявлен в двух модулях: ${previous} и ${file}`,
              type.span,
            ),
          )
        }
        continue
      }
      originOfType.set(type.name, file)
      types.push(type)
    }
    for (const fn of program.functions ?? []) {
      if (visible !== null && !visible.has(fn.name)) continue
      const previous = originOfFunction.get(fn.name)
      if (previous !== undefined) {
        if (previous !== file) {
          diagnostics.push(
            diagnostic(
              "FLANG_DUPLICATE_NAME",
              `функция «${fn.name}» объявлена в двух модулях: ${previous} и ${file}`,
              fn.span,
            ),
          )
        }
        continue
      }
      originOfFunction.set(fn.name, file)
      functions.push(fn)
    }
  }

  /* Что именно берём из каждого файла: `null` — всё видимое, иначе набор имён
     из `только`. Пересечение с `экспортирует` считается в merge. */
  const wanted = new Map()

  const load = async (file, text, isEntry) => {
    if (loaded.has(file)) return null
    /* Цикл импортов — ошибка, а не молчаливая остановка: иначе часть объявлений
       окажется недоступной, и виноват будет порядок обхода. */
    if (loading.includes(file)) {
      diagnostics.push(
        diagnostic("FLANG_IMPORT_CYCLE", `циклический импорт: ${[...loading, file].join(" → ")}`),
      )
      return null
    }
    loading.push(file)

    sources.set(file, text)

    let program
    try {
      program = parse(text, file)
    } catch (error) {
      /* У ошибки разбора уже есть код и место — заворачивать её своим текстом
         значит потерять строку, на которой всё сломалось. */
      const wrapped = error?.diagnostics ?? [
        diagnostic("FLANG_PARSE", error instanceof Error ? error.message : String(error)),
      ]
      diagnostics.push(...wrapped)
      loading.pop()
      loaded.add(file)
      return null
    }

    if (importsOf(program).length > 0) withImports.add(file)

    for (const entry of importsOf(program)) {
      const target = isAbsolute(entry.from) ? entry.from : resolve(dirname(file), entry.from)
      if (loaded.has(target) || loading.includes(target)) {
        if (loading.includes(target)) {
          diagnostics.push(
            diagnostic("FLANG_IMPORT_CYCLE", `циклический импорт: ${[...loading, target].join(" → ")}`),
          )
        }
        continue
      }
      let imported
      try {
        imported = await readSource(target)
      } catch (error) {
        diagnostics.push(
          diagnostic(
            "FLANG_IMPORT_NOT_FOUND",
            `не найден модуль «${entry.category}»: ${target} (${error instanceof Error ? error.message : String(error)})`,
          ),
        )
        continue
      }
      if (Array.isArray(entry.only)) {
        const already = wanted.get(target)
        wanted.set(target, already === undefined ? new Set(entry.only) : new Set([...already, ...entry.only]))
      } else {
        wanted.set(target, null)
      }
      const child = await load(target, imported, false)
      /* Имя модуля в `использует` обязано совпадать с его заголовком: иначе
         читатель видит одно имя, а получает объявления из другого файла. */
      if (child !== null && child.module !== "" && child.module !== entry.category) {
        diagnostics.push(
          diagnostic(
            "FLANG_IMPORT_NAME",
            `модуль в ${target} называется «${child.module}», а импортируется как «${entry.category}»`,
          ),
        )
      }
    }

    loading.pop()
    loaded.add(file)
    merge(program, file, isEntry ? null : narrow(exportsOf(program), wanted.get(file)))
    return program
  }

  const entry = await load(resolve(entryFile), source, true)

  /**
   * Второй проход: имя функции без аргументов становится вызовом только если
   * такая функция объявлена, а на первом проходе каждый файл знал лишь свои
   * объявления — вызов импортированной функции без аргументов оставался
   * несвязанным именем. Теперь полный набор имён известен, и файлы, у которых
   * есть импорты, разбираются заново уже с ним.
   *
   * Перебор ограничен файлами с импортами: у остальных внешних имён нет, и
   * повторный разбор дал бы тот же результат.
   */
  const names = new Set(functions.map((fn) => fn.name))
  const reparsed = new Map()
  for (const [file, text] of sources) {
    if (!withImports.has(file)) continue
    try {
      reparsed.set(file, parse(text, file, names))
    } catch {
      /* Файл уже разобрался на первом проходе, значит второй провалиться не
         может; но если это случилось — оставляем результат первого прохода,
         а не роняем всё связывание. */
    }
  }
  if (reparsed.size > 0) {
    for (const [file, program] of reparsed) {
      const visible = file === resolve(entryFile) ? null : exportsOf(program)
      for (const fn of program.functions ?? []) {
        if (visible !== null && !visible.has(fn.name)) continue
        const at = functions.findIndex((item) => item.name === fn.name)
        /* Заменяем только своё: функция с тем же именем из другого файла — это
           конфликт, о котором уже сказано выше, и подменять её здесь значило
           бы решать конфликт молча. */
        if (at !== -1 && originOfFunction.get(fn.name) === file) functions[at] = fn
      }
    }
  }

  return {
    flang: 1,
    module: entry?.module ?? "",
    types,
    functions,
    legacy: entry?.legacy ?? [],
    diagnostics,
  }
}
