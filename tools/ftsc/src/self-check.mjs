/**
 * Мост между IR и той частью компилятора, которая написана на самом FTS.
 *
 * Разделение обязанностей здесь принципиальное, а не косметическое:
 *
 *   JavaScript  — читает файлы, разбирает IR и **считает факты**: сколько в
 *                 модуле утилит без примеров, сколько примеров не сошлось,
 *                 сколько полей функтора осталось без образа. Это сбор данных;
 *                 ни одно из этих чисел само по себе ничего не запрещает.
 *   FTS         — по этим фактам **принимает решение**: сколько блокирующих
 *                 проблем в модуле и функторе и допускать ли проект к
 *                 кодогенерации. Правила лежат в `../self/admission.fts` и
 *                 исполняются движком FTS через `executeUtility`.
 *
 * Проверяемое утверждение о bootstrap: в этом файле нет ни одного порога и ни
 * одного «если проблема, то запретить». Поменяйте правило в `admission.fts` —
 * поменяется решение `selfCheck` на том же самом IR, без правки JavaScript.
 * Тест `test/self-check.test.mjs` («решение принимает модель...») подставляет
 * изменённую копию модели и требует, чтобы вердикт изменился.
 *
 * Отчёт о причинах блокировки тоже не дублирует правила: чтобы узнать, какой
 * факт дал блокировку, мост спрашивает ту же модель — подставляет факты, в
 * которых обнулено всё, кроме одного счётчика, и смотрит, что вернёт FTS.
 */

import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"

import { compile, evaluateUtility, executeUtility, validate } from "../../../dist/src/index.js"

const here = fileURLToPath(new URL(".", import.meta.url))

/** Каталог с моделями компилятора, написанными на FTS. */
export const MODELS_DIR = resolve(here, "../self")

const META = "meta.fts"
const ADMISSION = "admission.fts"

const MODULE_UTILITY = "Оценить готовность модуля"
const FUNCTOR_UTILITY = "Оценить готовность функтора"
const PROJECT_UTILITY = "Решить о допуске проекта"
const ELEMENTS_UTILITY = "Посчитать элементы модуля"
const SELF_DESCRIPTION_UTILITY = "Оценить самоописание модуля"

/**
 * Компилирует модели из каталога и проверяет их валидность.
 *
 * Испорченная модель обязана падать здесь, а не молча пропускать проект к
 * сборке: сломанное правило допуска — это отсутствующее правило допуска.
 *
 * @param {string} [directory] каталог с `meta.fts` и `admission.fts`
 * @returns {Promise<{ meta: object, admission: object, directory: string }>}
 */
export async function loadModels(directory = MODELS_DIR) {
  const [meta, admission] = await Promise.all([
    compileModel(resolve(directory, META)),
    compileModel(resolve(directory, ADMISSION)),
  ])
  return { meta, admission, directory }
}

async function compileModel(path) {
  const document = compile(await readFile(path, "utf8"))
  const report = validate(document)
  if (!report.valid) {
    const detail = report.diagnostics.map((item) => `${item.code} ${item.message}`).join("; ")
    throw new Error(`модель компилятора «${path}» невалидна: ${detail}`)
  }
  return report.document
}

/**
 * Решает, допускать ли проект к кодогенерации.
 *
 * @param {object} program IR по SPEC.md, раздел 4
 * @param {{ modelsDir?: string, models?: object }} [options]
 * @returns {Promise<{
 *   allowed: boolean,
 *   verdict: number,
 *   blocking: number,
 *   modules: Array<object>,
 *   functors: Array<object>,
 *   report: string[],
 *   modelsDir: string,
 * }>}
 */
export async function selfCheck(program, options = {}) {
  const models = options.models ?? (await loadModels(options.modelsDir))
  const { meta, admission } = models

  const modules = program?.modules ?? []
  const functors = program?.functors ?? []

  const moduleResults = modules.map((module) => {
    const facts = moduleFacts(module, functors)
    return {
      name: module.name ?? module.category ?? "",
      blocking: executeUtility(admission, MODULE_UTILITY, facts),
      facts,
      causes: attribute(admission, MODULE_UTILITY, facts),
      meta: metaObservation(meta, module),
    }
  })

  const functorResults = functors.map((functor) => {
    const facts = functorFacts(functor, modules)
    return {
      name: functor.name ?? "",
      from: functor.from ?? null,
      to: functor.to ?? null,
      blocking: executeUtility(admission, FUNCTOR_UTILITY, facts),
      facts,
      causes: attribute(admission, FUNCTOR_UTILITY, facts),
    }
  })

  /* Сложение — арифметика над уже принятыми решениями, а не решение: в ядре
     FTS нет свёртки по списку, поэтому сумму по модулям считает JavaScript. */
  const blocking =
    moduleResults.reduce((total, item) => total + item.blocking, 0) +
    functorResults.reduce((total, item) => total + item.blocking, 0)

  const verdict = executeUtility(admission, PROJECT_UTILITY, {
    "блокирующих проблем": blocking,
    модулей: moduleResults.length,
    функторов: functorResults.length,
  })

  return {
    allowed: verdict === 1,
    verdict,
    blocking,
    modules: moduleResults,
    functors: functorResults,
    report: buildReport(moduleResults, functorResults, blocking, verdict),
    modelsDir: models.directory,
  }
}

/* ------------------------------------------------------------------ факты */

/**
 * Факты о модуле. Каждое число — счётчик проблем, ноль означает «в порядке».
 * Что из этого блокирует сборку, решает `admission.fts`.
 */
export function moduleFacts(module, functors = []) {
  const document = module?.document ?? {}
  const utilities = document.utilities ?? []
  const structures = document.structures ?? []

  let withoutExamples = 0
  let notConverging = 0
  for (const utility of utilities) {
    const examples = utility.examples ?? []
    if (examples.length === 0) {
      withoutExamples += 1
      continue
    }
    for (const example of examples) {
      if (!converges(utility, example)) notConverging += 1
    }
  }

  const untyped = structures
    .flatMap((structure) => structure.fields ?? [])
    .filter((field) => typeof field.type !== "string" || field.type.trim() === "").length

  return {
    утилит: utilities.length,
    "утилит без примеров": withoutExamples,
    "примеров не сошлось": notConverging,
    "полей без типа": untyped,
    "объектов вне экспорта": unexportedCount(module, functors),
  }
}

/**
 * Пример утилиты — исполняемый тест. Мост исполняет его тем же движком, что и
 * `fts test`, поэтому «пример не сошёлся» здесь означает ровно то же, что в
 * ядре: правила дали не тот результат, который объявлен в модели.
 */
function converges(utility, example) {
  try {
    return Object.is(evaluateUtility(utility, example.input ?? {}), example.expected)
  } catch {
    /* Нарушенное свойство и отсутствующее во входе поле — тоже несошедшийся
       пример: модель обещала результат, которого не получилось. */
    return false
  }
}

/**
 * Объекты, которые нужны функтору проекта, но не перечислены в `экспортирует`.
 * Модуль без строки экспорта экспортирует всё (SPEC.md, раздел 2), поэтому там
 * проблемы быть не может.
 */
function unexportedCount(module, functors) {
  const exported = module?.exports?.structures
  if (!Array.isArray(exported)) return 0
  const names = new Set(exported)
  const required = new Set()
  for (const functor of functors) {
    for (const object of functor.objects ?? []) {
      if (matchesModule(module, functor.from)) required.add(object.from)
      if (matchesModule(module, functor.to)) required.add(object.to)
    }
  }
  const structures = new Set((module?.document?.structures ?? []).map((structure) => structure.name))
  return [...required].filter((name) => structures.has(name) && !names.has(name)).length
}

function matchesModule(module, reference) {
  return reference !== undefined && (module?.name === reference || module?.category === reference)
}

/**
 * Факты о функторе — числовое выражение законов из SPEC.md, раздел 3.
 *
 * Мост проверяет форму отображения: существование категорий, тотальность на
 * объектах и полях, существование образов морфизмов. Смысл отображения он не
 * проверяет — ровно как теорема в ядре проверяет вывод, а не намерение.
 */
export function functorFacts(functor, modules = []) {
  const domain = modules.find((module) => matchesModule(module, functor?.from))
  const codomain = modules.find((module) => matchesModule(module, functor?.to))
  const objects = functor?.objects ?? []

  const domainStructures = domain?.document?.structures ?? []
  const codomainNames = new Set((codomain?.document?.structures ?? []).map((structure) => structure.name))
  const mapped = new Set(objects.map((object) => object.from))

  let fieldsWithoutImage = 0
  for (const object of objects) {
    const source = domainStructures.find((structure) => structure.name === object.from)
    if (!source) continue
    const images = new Set((object.fields ?? []).map((field) => field.from))
    fieldsWithoutImage += (source.fields ?? []).filter((field) => !images.has(field.name)).length
  }

  const domainMorphisms = new Set((domain?.document?.functors ?? []).map((morphism) => morphism.name))
  const codomainMorphisms = new Set((codomain?.document?.functors ?? []).map((morphism) => morphism.name))
  const inconsistent = (functor?.morphisms ?? []).filter(
    (morphism) => !domainMorphisms.has(morphism.from) || !codomainMorphisms.has(morphism.to),
  ).length

  return {
    "категорий не найдено": (domain ? 0 : 1) + (codomain ? 0 : 1),
    "объектов без образа": domainStructures.filter((structure) => !mapped.has(structure.name)).length,
    "образов вне кодомена": objects.filter((object) => !codomainNames.has(object.to)).length,
    "полей без образа": fieldsWithoutImage,
    "несогласованных морфизмов": inconsistent,
  }
}

/** Наблюдение метамодели: размер модуля и уровень его самоописания. */
function metaObservation(meta, module) {
  const document = module?.document ?? {}
  const utilities = document.utilities ?? []
  const facts = {
    объектов: (document.structures ?? []).length,
    утилит: utilities.length,
    правил: utilities.reduce((total, utility) => total + (utility.rules ?? []).length, 0),
    примеров: utilities.reduce((total, utility) => total + (utility.examples ?? []).length, 0),
    морфизмов: (document.functors ?? []).length,
    "теорема доказана": (document.proposition ?? null) !== null,
  }
  return {
    facts,
    elements: executeUtility(meta, ELEMENTS_UTILITY, facts),
    selfDescription: executeUtility(meta, SELF_DESCRIPTION_UTILITY, facts),
  }
}

/* --------------------------------------------------------------- причины */

/**
 * Какой факт дал блокировку — спрашиваем у самой модели.
 *
 * Мост подставляет факты, в которых обнулено всё, кроме одного счётчика, и
 * смотрит, сколько блокирующих проблем вернёт FTS. Здесь нет знания о том,
 * какие правила существуют: если правило удалить из `.fts`, факт перестанет
 * появляться в отчёте автоматически.
 */
function attribute(document, utility, facts) {
  const zero = Object.fromEntries(Object.keys(facts).map((key) => [key, 0]))
  const causes = []
  for (const [key, value] of Object.entries(facts)) {
    if (value === 0) continue
    const blocking = executeUtility(document, utility, { ...zero, [key]: value })
    if (blocking > 0) causes.push({ fact: key, value, blocking })
  }
  return causes
}

/* ----------------------------------------------------------------- отчёт */

function buildReport(modules, functors, blocking, verdict) {
  const lines = []
  for (const module of modules) {
    lines.push(
      `модуль «${module.name}»: блокирующих проблем ${module.blocking}` +
        `; объявлений ${module.meta.elements}, самоописание ${module.meta.selfDescription} из 3` +
        causeSuffix(module),
    )
  }
  for (const functor of functors) {
    lines.push(
      `функтор «${functor.name}» из «${functor.from}» в «${functor.to}»: блокирующих проблем ${functor.blocking}` +
        causeSuffix(functor),
    )
  }
  lines.push(
    `итог: блокирующих проблем ${blocking}; модель «Допуск к сборке» вернула ${verdict} — ` +
      (verdict === 1 ? "проект допущен к кодогенерации" : "сборка запрещена"),
  )
  return lines
}

function causeSuffix(item) {
  if (item.causes.length === 0) return ""
  const listed = item.causes.map((cause) => `«${cause.fact}» = ${cause.value} (+${cause.blocking})`).join("; ")
  const attributed = item.causes.reduce((total, cause) => total + cause.blocking, 0)
  const rest = item.blocking - attributed
  /* Правило, читающее сразу несколько фактов, не отнести к одному счётчику.
     Такую разницу отчёт называет вслух, а не прячет. */
  return ` — ${listed}${rest > 0 ? `; ещё ${rest} по совокупности фактов` : ""}`
}
