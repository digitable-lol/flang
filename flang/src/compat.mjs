/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Мост совместимости: FtsDocument → программа flang.
 *
 * Обещание языка (SPEC §1, §9): любая существующая FTS-модель — валидная
 * программа flang, целиком лежащая в тотальном классе, и оба движка обязаны
 * считать её одинаково. Этот модуль — доказательство обещания, поэтому он
 * повторяет семантику `src/utility.ts` буквально, а не «по смыслу»:
 *
 *   • порядок правил сохраняется, и выполняются ВСЕ правила с истинными
 *     условиями (это не `else if`) — отсюда цепочка независимых `let`/`if`;
 *   • условия внутри правила соединяются коротким замыканием, потому что ядро
 *     использует `Array.every`: он останавливается на первом `false` и потому
 *     не спотыкается о второе условие, которое упало бы на типе;
 *   • арифметика процентов записана ровно как в ядре: `(процент / 100) * поле`;
 *   • свойства проверяются ПОСЛЕ всех правил, по порядку, и нарушение даёт тот
 *     же код `FTS_UTILITY_PROPERTY` и тот же текст сообщения.
 *
 * Код и текст ошибки свойства едут в AST как ДАННЫЕ (поле `postconditions`
 * функции), а не как знание, зашитое в конкретный интерпретатор. Иначе
 * совпадение кодов ошибок зависело бы от реализации `interpret.mjs`, то есть
 * было бы случайным.
 */
import { FlangError, flangError, reifyValue, valuesEqual } from "./builtins.mjs"
import { runConcurrentExamples } from "./conc.mjs"
import { evaluate as interpret } from "./interpret.mjs"

export { FlangError, flangError }

/** Имя единственного параметра функции, полученной из утилиты FTS. */
export const INPUT_PARAM = "вход"

/** Имя, под которым постусловие видит результат функции. */
export const RESULT_BINDING = "результат"

/** Код диагностики у любой ошибки — своей, интерпретатора или ядра FTS. */
export function errorCode(error) {
  if (error && Array.isArray(error.diagnostics) && error.diagnostics[0]?.code) return error.diagnostics[0].code
  if (error && typeof error.code === "string") return error.code
  return undefined
}

/* ────────────────────────────── перевод типов ───────────────────────────── */

/**
 * FTS описывает типы строками («Деньги», «Признак», «Дата», «Скоринг пройден»).
 * Скаляры переводятся один в один. Имена состояний («Скоринг пройден») — это
 * маркеры доказательств, а не значения: в языке значений им соответствия нет,
 * поэтому они сохраняются как `unknown` с исходным именем. Ядро ведёт себя так
 * же — `matchesRuntimeType` пропускает такие поля без проверки.
 */
export function flangType(ftsType) {
  const optional = /\|\s*undefined/u.test(ftsType)
  const base = ftsType.replace(/\s*\|\s*undefined/gu, "").trim()
  const scalar =
    base === "Строка" || base === "Дата" || base === "string"
      ? { kind: "string" }
      : base === "Число" || base === "Деньги" || base === "number"
        ? { kind: "number" }
        : base === "Признак" || base === "boolean"
          ? { kind: "boolean" }
          : { kind: "unknown", name: base }
  return optional ? { ...scalar, optional: true } : scalar
}

/* ─────────────────────────────── перевод AST ────────────────────────────── */

/**
 * @param {object} document FtsDocument (результат `compile` ядра)
 * @returns {object} программа flang по SPEC §5
 */
export function fromFtsDocument(document) {
  if (document === null || typeof document !== "object") {
    throw flangError("FLANG_COMPAT", "ожидался документ FTS")
  }
  const structures = document.structures ?? []
  const utilities = document.utilities ?? []
  const byName = new Map(structures.map((structure) => [structure.name, structure]))

  const types = structures.map((structure) => ({
    kind: "record",
    name: structure.name,
    fields: structure.fields.map((field) => ({ name: field.name, type: flangType(field.type) })),
    /* Исходные строки типов FTS сохраняются: генераторы кода и `ts_compat`
       опираются на них, и терять их при переводе нельзя. */
    meta: { fts: Object.fromEntries(structure.fields.map((field) => [field.name, field.type])) },
  }))

  return {
    flang: 1,
    module: document.category,
    types,
    functions: utilities.map((utility) => utilityToFunction(utility, byName.get(utility.input))),
    /**
     * Морфизмы и теорема остаются метаданными. Это не лень, а честность:
     * морфизм в FTS — импликация между состояниями («если Скоринг пройден,
     * то Риск-проверка разрешена»), а теорема — запрос к доказателю. Ни у
     * того, ни у другого нет ВЫЧИСЛИТЕЛЬНОГО аналога в flang: язык считает
     * значения, а не доказывает пропозиции, и функций-значений в нём нет
     * (SPEC §3). Выдумать им «функцию» значило бы придумать семантику,
     * которой в ядре нет, и сломать главное требование — совпадение
     * результатов. Поэтому они переносятся дословно: проверяющий их слой
     * (`prove`/`certify` ядра) читает ровно эти данные.
     */
    meta: {
      fts: {
        category: document.category,
        functors: document.functors ?? [],
        proposition: document.proposition ?? null,
        ts_compat: document.ts_compat ?? {},
      },
    },
  }
}

function utilityToFunction(utility, structure) {
  if (structure === undefined) {
    throw flangError("FTS_UTILITY_INPUT", `не найдена входная структура «${utility.input}»`)
  }

  /* Правила разворачиваются в цепочку связываний: результат0 — начальное
     значение, результатN+1 — состояние после N-го правила. Отдельные имена
     вместо затенения одного «результат» делают AST читаемым и проверяемым:
     видно, что каждое правило зависит от предыдущего состояния, а не заменяет
     собой предыдущее правило. */
  const resultVar = (index) => ({ kind: "var", name: `результат${index}` })
  const bindings = utility.rules.map((rule, index) => ({
    name: `результат${index + 1}`,
    value: {
      kind: "if",
      cond: conditionsToExpr(rule.when, resultVar(index)),
      then: actionToExpr(rule, resultVar(index)),
      else: resultVar(index),
    },
  }))

  let body = resultVar(bindings.length)
  for (let index = bindings.length - 1; index >= 0; index -= 1) {
    body = { kind: "let", name: bindings[index].name, value: bindings[index].value, in: body }
  }
  body = { kind: "let", name: "результат0", value: { kind: "literal", value: utility.initial }, in: body }

  return {
    name: utility.name,
    /* Утилита FTS не рекурсивна и не имеет циклов — конечная цепочка `if`.
       Завершаемость видна структурно, поэтому класс «тотальная» (SPEC §1),
       и именно поэтому любая модель FTS годится для факт-чекинга. */
    total: true,
    params: [{ name: INPUT_PARAM, type: { kind: "record", name: utility.input } }],
    returns: flangType(utility.output),
    body,
    /* Свойства — постусловия: проверяются после тела, в объявленном порядке,
       и нарушение первого же прерывает вычисление. Код и текст заданы явно,
       чтобы ошибка была неотличима от ошибки ядра. */
    postconditions: utility.properties.map((property) => ({
      name: property.name,
      bind: RESULT_BINDING,
      expr: {
        kind: "binary",
        op: property.operator,
        left: { kind: "var", name: RESULT_BINDING },
        right: operandToExpr(property.value, { kind: "var", name: RESULT_BINDING }),
      },
      code: "FTS_UTILITY_PROPERTY",
      message: `нарушено свойство «${property.name}» утилиты «${utility.name}»`,
    })),
    examples: utility.examples.map((example) => ({
      name: example.name,
      args: { [INPUT_PARAM]: exampleRecord(structure, example.input) },
      expected: example.expected,
    })),
    meta: { fts: { utility: utility.name, input: utility.input, output: utility.output } },
  }
}

/**
 * Вход утилиты в FTS — частичная карта: необязательное поле («иногда является
 * состоянием …») в примере просто отсутствует. Запись flang, наоборот,
 * тотальна: у неё есть все объявленные поля. Правильный перевод отсутствия —
 * `ничто` (SPEC §2), а не дырка в записи. Значение при этом не меняется:
 * ядро на такие поля всё равно не смотрит (`matchesRuntimeType` пропускает
 * состояния, а правила на них не ссылаются).
 */
function exampleRecord(structure, input) {
  const record = {}
  for (const field of structure.fields) {
    if (field.name in input) record[field.name] = input[field.name]
    else if (field.type.includes("undefined")) record[field.name] = null
    /* Отсутствие обязательного поля — ошибка входа; сохраняем её как есть,
       чтобы оба движка одинаково на неё пожаловались. */
  }
  for (const [name, value] of Object.entries(input)) {
    if (!(name in record)) record[name] = value
  }
  return record
}

function conditionsToExpr(conditions, resultExpr) {
  if (conditions.length === 0) return { kind: "literal", value: true }
  /* Ядро соединяет условия через `Array.every` — короткое замыкание. Вложенный
     `if` воспроизводит его буквально: второе условие даже не вычисляется, если
     первое ложно, и потому не может бросить ошибку сравнения типов. */
  let expr = conditionToExpr(conditions[conditions.length - 1], resultExpr)
  for (let index = conditions.length - 2; index >= 0; index -= 1) {
    expr = {
      kind: "if",
      cond: conditionToExpr(conditions[index], resultExpr),
      then: expr,
      else: { kind: "literal", value: false },
    }
  }
  return expr
}

function conditionToExpr(condition, resultExpr) {
  return {
    kind: "binary",
    op: condition.operator,
    /* Слева в условии FTS всегда поле входа, а не результат. */
    left: fieldExpr(condition.field),
    right: operandToExpr(condition.value, resultExpr),
  }
}

function actionToExpr(rule, previous) {
  const value = operandToExpr(rule.action.value, previous)
  if (rule.action.kind === "set") return value
  return { kind: "binary", op: "add", left: previous, right: value }
}

function operandToExpr(operand, resultExpr) {
  switch (operand.kind) {
    case "value":
      return { kind: "literal", value: operand.value }
    case "field":
      return fieldExpr(operand.field)
    case "result":
      return resultExpr
    case "percent":
      /* Ровно порядок ядра: (процент / 100) * поле. Умножение и деление в
         IEEE-754 не ассоциативны, переставлять множители нельзя. */
      return {
        kind: "binary",
        op: "percent",
        left: { kind: "literal", value: operand.percent },
        right: fieldExpr(operand.field),
      }
    default:
      throw flangError("FLANG_COMPAT", `неизвестный операнд «${String(operand.kind)}»`)
  }
}

function fieldExpr(field) {
  return { kind: "field", target: { kind: "var", name: INPUT_PARAM }, field }
}

/* ──────────────────────────────── исполнение ────────────────────────────── */

/**
 * Вычисление функции flang. Тонкая обёртка над `interpret.mjs`: мост не заводит
 * собственный вычислитель, потому что второй вычислитель — это второй набор
 * округлений и второй набор кодов ошибок, то есть ровно то расхождение, ради
 * отсутствия которого мост и написан.
 *
 * Лимиты принимаются в обоих написаниях: `steps`/`depth` (как их называет
 * факт-чекинг) и `maxSteps`/`maxDepth` (как их называет интерпретатор).
 */
export function evaluateFlang(program, functionName, args, options = {}) {
  const limits = {}
  const steps = options.maxSteps ?? options.steps
  const depth = options.maxDepth ?? options.depth
  if (steps !== undefined) limits.maxSteps = steps
  if (depth !== undefined) limits.maxDepth = depth
  return interpret(program, functionName, args ?? {}, limits)
}

/**
 * Прогон примеров всех функций программы — аналог `testUtilities` ядра.
 *
 * Сверка структурная, тем же `valuesEqual`, которым язык сравнивает значения
 * внутри программ. Здесь стояло `Object.is`, и этого хватало ровно до тех пор,
 * пока функции возвращали скаляры: утилита FTS иначе и не умеет. Но функция
 * flang возвращает список, запись или вариант, а два структурно равных списка —
 * это два разных объекта, и `Object.is` о них говорит «не равны». Из-за этого
 * `flang test` объявлял провалившимся каждый второй файл библиотеки, будучи
 * при этом полностью прав арифметически. Второе сравнение писать нельзя:
 * разойдясь на любой мелочи (NaN, -0, порядок полей), оно сделало бы «пример
 * сошёлся» и «значения равны» разными утверждениями.
 *
 * `reifyValue` нужен по той же причине, что и в интерпретаторе: значение
 * варианта в AST записано как `{ variant, fields }` (JSON не знает классов),
 * а вычисление даёт `FlangVariant`.
 */
export function runExamples(program, evaluate = evaluateFlang) {
  const results = []
  for (const fn of program.functions ?? []) {
    for (const example of fn.examples ?? []) {
      try {
        const actual = evaluate(program, fn.name, example.args)
        results.push({
          function: fn.name,
          example: example.name,
          passed: valuesEqual(actual, reifyValue(example.expected)),
          expected: example.expected,
          actual,
        })
      } catch (error) {
        results.push({
          function: fn.name,
          example: example.name,
          passed: false,
          expected: example.expected,
          error: error instanceof Error ? error.message : String(error),
          code: errorCode(error),
        })
      }
    }
  }
  /* Прогон конкурентной программы — такой же пример, как всякий другой: семя,
     входные сообщения, ожидаемый итог. Он идёт в тот же список результатов
     намеренно: иначе конкурентность стала бы местом, где `flang test` молчит, а
     проверять её пришлось бы отдельным инструментом. Записи появляются только у
     программы с прогонами, поэтому вывод остальных файлов не меняется. */
  for (const прогон of runConcurrentExamples(program)) {
    /* Сетка семян называется в отчёте так же, как в исходнике: «семя от 1 до
       1000», а не «семя 1». Иначе прогон, проверивший тысячу чередований, и
       прогон, проверивший одно, выглядели бы в выводе одинаково — а это ровно та
       разница, ради которой сетка заведена. */
    const подпись = прогон.доСемени === undefined
      ? `семя ${прогон.seed}`
      : `семя от ${прогон.seed} до ${прогон.доСемени}`
    results.push({ function: `прогон «${прогон.run}»`, example: подпись, ...прогон })
  }

  const passed = results.filter((result) => result.passed).length
  return { valid: passed === results.length, total: results.length, passed, failed: results.length - passed, results }
}
