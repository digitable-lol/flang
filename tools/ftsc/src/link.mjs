/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Линковка проекта: порядок модулей, проверка экспортов и законов функторов.
 *
 * Функтор в теории категорий обязан сохранять структуру: у каждого объекта есть
 * образ, у каждого морфизма — образ с согласованными доменом и кодоменом, а
 * композиция морфизмов переходит в композицию образов. Проверяемо машиной
 * ровно это — форма отображения. Верность бизнес-смысла остаётся на человеке,
 * как и закон морфизма в ядре языка.
 */
import { codes, failAll } from "./diagnostics.mjs"

const structureOf = (document, name) => document.structures.find((item) => item.name === name)
const morphismOf = (document, name) => (document.functors ?? []).find((item) => item.name === name)

/** Тип поля без пометки опциональности: сравнивать имеет смысл именно его. */
const bareType = (type) =>
  String(type)
    .replace(/\s*\|\s*undefined\s*/gu, "")
    .trim()
const isOptional = (type) => String(type).includes("undefined")

/* Встроенные формы данных. Всё остальное в типе поля — имя состояния, то есть
   тип факта, а не значения. */
const BUILTIN = new Set(["Строка", "Число", "Деньги", "Признак", "Дата", "String", "Number", "Money", "Boolean", "Date"])
const isState = (type) => !BUILTIN.has(bareType(type))

/**
 * Карта состояний функтора выводится из отображения полей: если поле-состояние
 * «Запрос проверен» отображено в поле-состояние «Условие проверено», то это и
 * есть образ состояния под F. Требовать одинаковых имён состояний в разных
 * категориях бессмысленно — именно ради переименования функтор и нужен.
 */
function stateMapping(functor, from, to, problems) {
  const states = new Map()
  for (const mapping of functor.objects) {
    const source = structureOf(from.document, mapping.from)
    const image = structureOf(to.document, mapping.to)
    if (!source || !image) continue
    for (const field of mapping.fields) {
      const sourceField = source.fields.find((item) => item.name === field.from)
      const imageField = image.fields.find((item) => item.name === field.to)
      if (!sourceField || !imageField) continue
      if (!isState(sourceField.type) || !isState(imageField.type)) continue

      const sourceState = bareType(sourceField.type)
      const imageState = bareType(imageField.type)
      const known = states.get(sourceState)
      if (known && known !== imageState) {
        problems.push({
          code: codes.functorStateConflict,
          message:
            `функтор «${functor.name}»: состояние «${sourceState}» отображается сразу в «${known}» и «${imageState}» — ` +
            "у функтора не может быть двух образов одного состояния",
          severity: "error",
          path: functor.source,
        })
        continue
      }
      states.set(sourceState, imageState)
    }
  }
  return states
}

function orderModules(modules, problems) {
  const byName = new Map(modules.map((module) => [module.name, module]))
  const state = new Map()
  const order = []

  const visit = (module, stack) => {
    const status = state.get(module.name)
    if (status === "done") return
    if (status === "active") {
      problems.push({
        code: codes.cycle,
        message: `циклический импорт: ${[...stack, module.name].join(" → ")}`,
        severity: "error",
        path: module.source,
      })
      return
    }
    state.set(module.name, "active")
    for (const dependency of module.imports) {
      const target = byName.get(dependency.module)
      if (target) visit(target, [...stack, module.name])
    }
    state.set(module.name, "done")
    order.push(module.name)
  }

  for (const module of modules) visit(module, [])
  return order
}

function checkExports(module, problems) {
  if (!module.exports) return
  const known = new Set([
    ...module.document.structures.map((item) => item.name),
    ...(module.document.utilities ?? []).map((item) => item.name),
    ...(module.document.functors ?? []).map((item) => item.name),
  ])
  for (const name of module.exports) {
    if (known.has(name)) continue
    problems.push({
      code: codes.exportUnknown,
      message: `модуль «${module.name}» экспортирует «${name}», которого в нём нет`,
      severity: "error",
      path: module.source,
    })
  }
}

/** Импортирующий модуль имеет право видеть только экспортированное. */
function checkImportVisibility(module, byName, problems) {
  for (const dependency of module.imports) {
    const target = byName.get(dependency.module)
    if (!target || !target.exports || target.exports.length) continue
    problems.push({
      code: codes.notExported,
      message: `модуль «${target.name}» не экспортирует ничего, но импортируется из «${module.name}»`,
      severity: "error",
      path: module.source,
    })
  }
}

function checkFunctor(functor, byCategory, problems) {
  const from = byCategory.get(functor.from)
  const to = byCategory.get(functor.to)
  const at = functor.source

  if (!from || !to) {
    problems.push({
      code: codes.functorCategory,
      message: `функтор «${functor.name}»: неизвестна категория «${from ? functor.to : functor.from}»`,
      severity: "error",
      path: at,
    })
    return
  }

  const objectMap = new Map(functor.objects.map((entry) => [entry.from, entry]))
  const stateMap = stateMapping(functor, from, to, problems)

  for (const structure of from.document.structures) {
    const mapping = objectMap.get(structure.name)
    if (!mapping) {
      problems.push({
        code: codes.functorObjectMissing,
        message: `функтор «${functor.name}»: объект «${structure.name}» категории «${functor.from}» не отображён`,
        severity: "error",
        path: at,
      })
      continue
    }

    const image = structureOf(to.document, mapping.to)
    if (!image) {
      problems.push({
        code: codes.functorTargetUnknown,
        message: `функтор «${functor.name}»: в категории «${functor.to}» нет объекта «${mapping.to}»`,
        severity: "error",
        path: at,
      })
      continue
    }

    const fieldMap = new Map(mapping.fields.map((field) => [field.from, field.to]))
    for (const field of structure.fields) {
      const target = fieldMap.get(field.name)
      if (!target) {
        problems.push({
          code: codes.functorFieldMissing,
          message: `функтор «${functor.name}»: поле «${structure.name}».«${field.name}» не отображено`,
          severity: "error",
          path: at,
        })
        continue
      }
      const imageField = image.fields.find((item) => item.name === target)
      if (!imageField) {
        problems.push({
          code: codes.functorFieldUnknown,
          message: `функтор «${functor.name}»: в объекте «${image.name}» нет поля «${target}»`,
          severity: "error",
          path: at,
        })
        continue
      }
      /* Тип образа обязан совпадать: иначе преобразование пришлось бы «чинить»
         в сгенерированном коде, а это уже не функтор, а ручной адаптер.
         Обязательное поле разрешено отображать в необязательное, но не наоборот. */
      /* Состояние сравнивается через карту образов: «Запрос проверен» законно
         становится «Условие проверено». Форма данных — только точным совпадением. */
      const expected = isState(field.type) ? (stateMap.get(bareType(field.type)) ?? bareType(field.type)) : bareType(field.type)
      if (bareType(imageField.type) !== expected) {
        problems.push({
          code: codes.functorFieldType,
          message:
            `функтор «${functor.name}»: «${structure.name}».«${field.name}» имеет тип «${field.type}», ` +
            `а образ «${image.name}».«${target}» — «${imageField.type}»`,
          severity: "error",
          path: at,
        })
      } else if (isOptional(field.type) && !isOptional(imageField.type)) {
        problems.push({
          code: codes.functorFieldType,
          message: `функтор «${functor.name}»: необязательное поле «${field.name}» отображено в обязательное «${target}»`,
          severity: "error",
          path: at,
        })
      }
    }
  }

  const morphismMap = new Map(functor.morphisms.map((entry) => [entry.from, entry.to]))
  for (const morphism of from.document.functors ?? []) {
    const target = morphismMap.get(morphism.name)
    if (!target) continue /* морфизмы отображать необязательно: функтор может быть частичным по морфизмам */

    const image = morphismOf(to.document, target)
    if (!image) {
      problems.push({
        code: codes.functorTargetUnknown,
        message: `функтор «${functor.name}»: в категории «${functor.to}» нет морфизма «${target}»`,
        severity: "error",
        path: at,
      })
      continue
    }

    /* Закон F(f): F(a) → F(b). Состояния в ядре — это типы фактов, поэтому
       согласованность проверяется по именам домена и кодомена через ту же
       карту объектов, дополненную тождеством для состояний. */
    const mapState = (state) => objectMap.get(state)?.to ?? stateMap.get(state) ?? state
    if (mapState(morphism.domain) !== image.domain || mapState(morphism.codomain) !== image.codomain) {
      problems.push({
        code: codes.functorMorphismShape,
        message:
          `функтор «${functor.name}»: образ морфизма «${morphism.name}» должен вести ` +
          `«${mapState(morphism.domain)}» → «${mapState(morphism.codomain)}», ` +
          `а «${target}» ведёт «${image.domain}» → «${image.codomain}»`,
        severity: "error",
        path: at,
      })
    }
  }

  /* Сохранение композиции: если в домене есть пара f: a→b, g: b→c и обе
     отображены, то в кодомене образы обязаны компоноваться так же. */
  const domainMorphisms = from.document.functors ?? []
  for (const first of domainMorphisms) {
    for (const second of domainMorphisms) {
      if (first.codomain !== second.domain) continue
      const firstImage = morphismMap.get(first.name)
      const secondImage = morphismMap.get(second.name)
      if (!firstImage || !secondImage) continue
      const a = morphismOf(to.document, firstImage)
      const b = morphismOf(to.document, secondImage)
      if (!a || !b || a.codomain === b.domain) continue
      problems.push({
        code: codes.functorComposition,
        message:
          `функтор «${functor.name}»: композиция «${first.name}» ∘ «${second.name}» не сохраняется — ` +
          `образы «${firstImage}» и «${secondImage}» не компонуются`,
        severity: "error",
        path: at,
      })
    }
  }
}

export function link({ modules, functors }, { project = "project" } = {}) {
  const problems = []
  const byName = new Map(modules.map((module) => [module.name, module]))
  const byCategory = new Map(modules.map((module) => [module.category, module]))

  const seen = new Map()
  for (const module of modules) {
    const previous = seen.get(module.name)
    if (previous) {
      problems.push({
        code: codes.duplicateModule,
        message: `модуль «${module.name}» объявлен дважды: ${previous} и ${module.source}`,
        severity: "error",
        path: module.source,
      })
    }
    seen.set(module.name, module.source)
    checkExports(module, problems)
    checkImportVisibility(module, byName, problems)
  }

  const order = orderModules(modules, problems)
  for (const functor of functors) checkFunctor(functor, byCategory, problems)

  if (problems.length) throw failAll(problems)

  return {
    ir: 1,
    project,
    modules: modules
      .slice()
      .sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name))
      .map((module) => ({
        name: module.name,
        category: module.category,
        source: module.source,
        imports: module.imports,
        exports: module.exports
          ? {
              structures: module.exports.filter((name) => structureOf(module.document, name)),
              utilities: module.exports.filter((name) => (module.document.utilities ?? []).some((u) => u.name === name)),
            }
          : null,
        document: module.document,
      })),
    functors: functors.map((functor) => ({
      name: functor.name,
      from: functor.from,
      to: functor.to,
      source: functor.source,
      objects: functor.objects,
      morphisms: functor.morphisms,
    })),
    order,
  }
}
