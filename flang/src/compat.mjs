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
 *
 * ── У ПЕРЕВОДА БОЛЬШЕ НЕТ НИ ОДНОГО ВЫЗЫВАЮЩЕГО, и это надо знать ───────────
 * 16 августа 2026 старый проект вынесен из репозитория (тег
 * `fts-pered-udaleniem`, дом — github.com/digitable-lol/fts). `FtsDocument`
 * строило его ядро на TypeScript, и построить его в этом дереве больше нечем:
 * `fromFtsDocument` вызывать неоткуда. Прогон это подтверждает — грепом по
 * дереву вызовов ноль.
 *
 * Почему перевод всё-таки оставлен, а не удалён вместе с остальным. Поверхность
 * FTS осталась В САМОМ ЯЗЫКЕ: разборщик читает `категория`/`объект`/`утилита`
 * в узлы `ftsLegacy`, поле `fts` живёт в типах, вид типа `unknown` заведён под
 * имена состояний. И тринадцать мест в `parser.mjs` и `types.mjs` объясняют
 * СВОЁ устройство ссылкой на этот перевод — «мост из FTS приносит типы
 * строками», «мост ставит optional на сам тип». Удалить перевод, не переписав
 * эти тринадцать объяснений, значит оставить прозу, пережившую код, — ровно ту
 * беду, от которой в этом дереве заведены сторожа. Работа отдельная и своя;
 * здесь она названа, а не сделана молча.
 *
 * Обратный ход при этом ЕСТЬ и он дешевле, чем кажется: разборщик языка сам
 * раскладывает утилиту наследия до правил, свойств и примеров (проверено:
 * `flang ast` на модели даёт узел `ftsLegacy` с полным содержимым). Захочется
 * вернуть чтение моделей — переводить надо из этого узла, а не из документа
 * чужого ядра.
 */
import { FlangError, flangError, reifyValue, valuesEqual } from "./builtins.mjs"
import { runConcurrentExamples } from "./conc.mjs"
import { DEFAULT_MAX_STEPS, evaluate as interpret } from "./interpret.mjs"

export { FlangError, flangError }

/** Имя единственного параметра функции, полученной из утилиты FTS. */
export const INPUT_PARAM = "вход"

/** Имя, под которым постусловие видит результат функции. */
export const RESULT_BINDING = "результат"

/**
 * Предел шагов, под которым считается ЗАКОН при стрелке.
 *
 * Число то же, что у вычислителя по умолчанию, и меняться ему незачем — но
 * НАЗВАНО оно здесь, и это не украшение импорта. Контракт (`flang/cat/SPEC.md`,
 * принятое решение 5) обещает, что закон у нетотального морфизма проверяется
 * «под лимитом шагов». Пока предел был умолчанием вычислителя, обещание
 * держалось случайно: смени кто-нибудь умолчание — и проверка закона поехала бы
 * следом, ничего об этом не сказав. Тот же довод записан в `interpret.mjs` про
 * предел глубины: число, которое нельзя назвать, свести не с чем.
 */
export const LAW_MAX_STEPS = DEFAULT_MAX_STEPS

/**
 * «Закон не досчитан» — код отдельный, и в этом всё дело.
 *
 * Закон говорит о равенстве вычислений, а морфизму разрешено быть нетотальным
 * (контракт, решение 5: HTTP-обработчик редко тотален, а закон при нём нужен
 * именно там). Значит проверка закона может кончиться тремя разными исходами, а
 * не двумя: сошлось, не сошлось — и НЕ ДОСЧИТАЛОСЬ. Третий исход не «закон
 * нарушен»: про закон в этом случае не известно ничего, и назвать его
 * нарушенным значило бы утверждать больше, чем видели.
 *
 * До этого кода упор в предел приезжал в отчёт обычным `FLANG_RECURSION_LIMIT` —
 * тем же, каким падает зациклившийся пример обычной функции. Прогон это и
 * предъявил: морфизм с нетотальной реализацией давал
 * `passed: false, code: FLANG_RECURSION_LIMIT`, и по отчёту нельзя было
 * отличить опровергнутый закон от непроверенного.
 *
 * Молчаливым успехом это не становится и не должно: `passed` остаётся `false`,
 * `flang test` по-прежнему кончается кодом 1. Не досчитанный закон — не
 * пройденная проверка, а не «ну и ладно».
 */
export const LAW_LIMIT_CODE = "FLANG_LAW_LIMIT"

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
  /* Закон при стрелке — такой же пример, как всякий другой, и потому идёт в тот
     же список. Место здесь, а не в `flang check`, выбрано не наугад: закон
     говорит о РАВЕНСТВЕ ВЫЧИСЛЕНИЙ, проверяется он на примерах автора, и
     примеры функции проверяет ровно эта команда. Ставить закон в `check`
     значило бы, что часть примеров языка проверяет одна команда, а часть —
     другая, и автор обязан помнить, какая именно.

     Устройство стрелки при этом доказано раньше и в другом месте (`types.mjs`):
     функция объявлена, вход — домен, выход — кодомен. Здесь остаётся
     единственное, что доказать нельзя, — что обещание выполняется на тех
     значениях, которые автор назвал сам.

     ── Третий исход, и он про честность отчёта ──────────────────────────────
     Реализация стрелки вправе быть НЕТОТАЛЬНОЙ, значит проверка вправе не
     кончиться. Такой пример считается под названным пределом (`LAW_MAX_STEPS`),
     а упор в предел уходит в отчёт своим кодом `FLANG_LAW_LIMIT`, а не общим
     `FLANG_RECURSION_LIMIT`: «не досчитано» и «нарушено» — разные утверждения,
     и по коду это обязано быть видно машине, а не по тексту человеку. */
  const тотальные = new Set(
    (program.functions ?? []).filter((фн) => фн?.total === true).map((фн) => фн.name),
  )
  for (const узел of program.morphisms ?? []) {
    if (узел?.kind !== "morphism") continue
    if (typeof узел.gives !== "string" || узел.gives === "") continue
    for (const закон of узел.laws ?? []) {
      /* Подпись называет и стрелку, и закон: `flang test` печатает её как есть,
         и по одной строке отчёта обязано быть видно, ЧЬЁ обещание нарушено. */
      const подпись = `морфизм «${узел.name}», закон «${закон.name}»`
      for (const пример of закон.examples ?? []) {
        try {
          const actual = evaluate(program, узел.gives, пример.args, { maxSteps: LAW_MAX_STEPS })
          results.push({
            function: подпись,
            example: пример.name,
            passed: valuesEqual(actual, reifyValue(пример.expected)),
            expected: пример.expected,
            actual,
          })
        } catch (error) {
          const код = errorCode(error)
          const текст = error instanceof Error ? error.message : String(error)
          /* Тотальность решает, чей это предел. У нетотальной реализации предел —
             единственное, чем проверка может кончиться, и это про закон. У
             ТОТАЛЬНОЙ упор в предел означает другое: доказанное завершение без
             обещанного срока, — и подменять там код значило бы прятать редкую
             беду за частой. Ровно так же различает три смысла одного и того же
             предела планировщик (`conc.mjs`, `FLANG_BUDGET_EXHAUSTED`). */
          const недосчитан = код === "FLANG_RECURSION_LIMIT" && !тотальные.has(узел.gives)
          results.push({
            function: подпись,
            example: пример.name,
            passed: false,
            expected: пример.expected,
            error: недосчитан ? `закон не досчитан, а не нарушен: ${текст}` : текст,
            code: недосчитан ? LAW_LIMIT_CODE : код,
          })
        }
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

/* ──────────────────── словарь между спеками: сверка имён ────────────────── */

/**
 * ФУНКТОР — ЭТО СЛОВАРЬ МЕЖДУ ДВУМЯ СПЕКАМИ, и до этой проверки он не значил
 * ничего.
 *
 * Замысел, ради которого слово заведено: спеки бизнес-требований лежат в разных
 * файлах, легаси-система закрыта одной спекой, новое требование пишется другой,
 * и машина обязана уметь сказать, что второе противоречит первому. Сравнивать
 * два требования можно только зная, ЧТО ЧЕМУ соответствует: в одной спеке
 * «Покупка», в другой «Счёт», и без словаря сравнивать нечего. Функтор и есть
 * этот словарь:
 *
 * ```flang
 * функтор «Заказ в счёт» из «Продажи» в «Биллинг»
 *   использует «Продажи» из «./sales/purchase.fts»
 *   использует «Биллинг» из «./billing/invoice.fts»
 *
 *   объект Покупка отображается в «Счёт»
 *     поле сумма отображается в поле «сумма без НДС»
 * ```
 *
 * ── ЧТО БЫЛО ДО ЭТОЙ ФУНКЦИИ, ЗАМЕРЕНО ПРОГОНОМ ─────────────────────────────
 *
 * Разбор строит из этих строк ПОЛНЫЙ узел: `parse` на образце
 * `flang/test/fixtures/fts-naslediye/скидки-в-подписки.fts` даёт
 * `legacy[0].value` с `imports` (две пары «категория → путь»), `objects`
 * (пары «объект → образ» и `fields` внутри) и `morphisms`. Не теряется ничего.
 *
 * Читал из этого узла кто угодно, кроме нужного. Грепом по `flang/src`:
 *   • `imports` не упоминается в `types.mjs` НИ РАЗУ — пути на спеки не
 *     открывает никто, и `link.mjs` их тоже не трогает: строка `использует`
 *     ВНУТРИ функтора уезжает в `value.imports`, а не в импорты модуля;
 *   • `fields` не упоминается в `checkFunctors` (`types.mjs`, строки 2186–2400)
 *     НИ РАЗУ.
 * Так это и записано в контракте (`flang/cat/SPEC.md`): «Полей перевода
 * компилятор не видит… согласованность перевода с ними не проверяется ничем».
 *
 * Следствие снималось одним прогоном: `flang check` на образце давал
 * `{"valid":true,"module":"Скидка в подписку","functions":[],"types":[],
 * "diagnostics":[]}` и код 0 — при том, что ОБА пути `использует` в этом файле
 * не ведут никуда (каталога `flang/test/fixtures/specs/` в дереве нет), а
 * объекты «Заказ» и «Подписка» не объявлены нигде. Словарь, который можно
 * написать на несуществующие слова, — не словарь.
 *
 * ── ЧТО ЗДЕСЬ ДОКАЗЫВАЕТСЯ ──────────────────────────────────────────────────
 *
 * Ровно и только полнота ССЫЛОК словаря, сличением объявлений, без единого
 * вычисления:
 *
 *   1. обе категории функтора ПРИВЕЗЕНЫ — у каждой есть своя строка
 *      `использует «Категория» из «путь»`. Нет строки — сверять не с чем, и
 *      молчать об этом нельзя (`FLANG_FUNCTOR_SPEC_MISSING`);
 *   2. каждый привезённый путь ЧИТАЕТСЯ и РАЗБИРАЕТСЯ. Путь в никуда — это
 *      словарь, у которого одна половина отсутствует (`FLANG_FUNCTOR_SPEC_MISSING`);
 *   3. файл объявляет ТУ САМУЮ категорию, под именем которой привезён. Иначе
 *      автор сверил бы свой словарь с чужой спекой и не узнал бы об этом
 *      (`FLANG_FUNCTOR_SPEC_NAME`);
 *   4. каждый названный объект СУЩЕСТВУЕТ — источник в исходной спеке, образ в
 *      целевой (`FLANG_FUNCTOR_DICTIONARY`);
 *   5. каждое названное поле СУЩЕСТВУЕТ у своего объекта, с обеих сторон
 *      (`FLANG_FUNCTOR_DICTIONARY`);
 *   6. типы сходятся: поле числа не переводится в поле признака
 *      (`FLANG_FUNCTOR_FIELD_TYPE`).
 *
 * ── ЧЕГО ЗДЕСЬ НЕ ДОКАЗЫВАЕТСЯ, И ЭТО НАЗВАНО ЧИСЛОМ ────────────────────────
 *
 *   • НЕ проверяется, что словарь ПОЛОН по полям: объект-источник вправе иметь
 *     поля, о которых словарь молчит, и объявлять это бедой значило бы завести
 *     политику, которой в контракте нет. Молчание при этом не бесплатное — оно
 *     СЧИТАЕТСЯ: `checked.unmapped` — сколько полей источника словарь не назвал.
 *     Ноль сравнений и «проверено» — разные вещи, и по отчёту это обязано быть
 *     видно;
 *   • НЕ проверяется, что требования не противоречат друг другу. Это следующий
 *     слой и другая работа; здесь доказано лишь то, что словарь, которым тот
 *     слой будет пользоваться, СОСТОИТ ИЗ СУЩЕСТВУЮЩИХ СЛОВ;
 *   • НЕ различаются `Деньги` и `Число`: обе поверхности FTS дают один и тот же
 *     тип языка (`{kind:"number"}`), и `sameType` в `types.mjs` тоже смотрит на
 *     вид, а не на исходную строку. Развести их здесь значило бы завести второе
 *     равенство типов, расходящееся с языковым.
 *
 * ЧТЕНИЕ И РАЗБОР ПРИНИМАЮТСЯ ИЗВНЕ, а не берутся из `node:fs` и `./parser.mjs`.
 * Довод не про вкус: этот модуль сегодня не тянет ни одного узла платформы, и
 * втащить их значило бы сделать мост непригодным там, где файловой системы нет
 * (браузерная сборка, `docs/site`), ради удобства одного вызова.
 *
 * ── ДВА РАЗНЫХ СЛОВА «ФУНКТОР», И ПОЧЕМУ ЗДЕСЬ ПРОВЕРЯЕТСЯ ОДНО ─────────────
 *
 * Одна и та же поверхность `функтор «Ф» из «А» в «Б»` несёт в корпусе две
 * разные вещи, и это замерено разбором всего дерева: 875 файлов, узлов
 * `functorFile` — 10, из них у 4 (`flang/examples/cat/natural-square.flang`,
 * `flang/examples/cat/modules/reconciliation.flang`) список `imports` ПУСТ.
 *
 *   • связь двух категорий ОДНОЙ программы: обе объявлены строкой `категория`
 *     здесь же или в модуле, привезённом обычным `использует` МОДУЛЯ. Её концы,
 *     композицию и единицы проверяет `checkFunctors` в `types.mjs`, и своих
 *     `использует` внутри блока у неё нет — их и негде взять;
 *   • СЛОВАРЬ МЕЖДУ ДВУМЯ СПЕКАМИ: категории лежат в чужих файлах, и функтор
 *     привозит их сам строками `использует «Категория» из «путь»` ВНУТРИ блока.
 *
 * Различаются они не по наличию `imports` — по такому признаку словарь, у
 * которого забыли обе строки `использует`, молча стал бы «связью внутри
 * программы» и не проверился бы ничем. Различаются по тому, ОБЪЯВЛЕНА ЛИ
 * категория в самой программе: объявленную знает `checkFunctors`, необъявленную
 * не знает никто, и привезти её обязан сам функтор.
 *
 * Имена объявленных категорий приходят ИЗВНЕ (`declared`), а не считаются
 * здесь по `program.categories`: до связывания их видно только в своём файле, а
 * проверка обязана смотреть на ту программу, которую собрал передний край.
 * Пустой `declared` — прежнее поведение слово в слово.
 *
 * @param {object} program разобранная программа (`parse`), у которой в `legacy`
 *   лежат узлы `functorFile`
 * @param {{file?: string, read: (path: string) => string,
 *   parse: (source: string, file: string) => object,
 *   declared?: Iterable<string>}} options
 * @returns {{valid: boolean, checked: object, diagnostics: object[]}}
 */
export function checkFunctorDictionary(program, options = {}) {
  const diagnostics = []
  const checked = { functors: 0, objects: 0, fields: 0, unmapped: 0, inProgram: 0 }
  const объявлены = new Set(options.declared ?? [])
  const свои = (функтор) => объявлены.has(функтор.from) && объявлены.has(функтор.to)
  const все = (Array.isArray(program?.legacy) ? program.legacy : [])
    .filter((узел) => узел?.construct === "functorFile" && узел.value !== undefined)
  const узлы = все.filter((узел) => !свои(узел.value))
  checked.inProgram = все.length - узлы.length
  if (узлы.length === 0) return { valid: true, checked, diagnostics }

  const { read, parse, file = "" } = options
  if (typeof read !== "function" || typeof parse !== "function") {
    throw flangError(
      "FLANG_COMPAT",
      "проверке словаря нужны чтение файла и разбор: без спек, названных строками"
        + " 'использует', отображение сверять не с чем",
    )
  }

  const кэш = new Map()
  const загрузить = (путь) => {
    if (кэш.has(путь)) return кэш.get(путь)
    let итог
    try {
      итог = { ok: true, program: parse(read(путь), путь) }
    } catch (error) {
      итог = { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
    кэш.set(путь, итог)
    return итог
  }

  for (const узел of узлы) {
    const функтор = узел.value
    checked.functors += 1
    const сообщить = (code, message) =>
      diagnostics.push({ code, message, severity: "error", span: узел.span })

    const пути = new Map()
    for (const запись of функтор.imports ?? []) {
      if (typeof запись?.category === "string" && !пути.has(запись.category)) {
        пути.set(запись.category, запись.from)
      }
    }

    /* Обе спеки берутся ОДНИМ проходом и до объектов: словарь, у которого нет
       одной половины, нельзя проверять по второй — вышел бы каскад из «объекта
       нет» на каждую строку при единственной настоящей беде «спеки нет». */
    const спеки = new Map()
    let обеПривезены = true
    for (const [роль, имя] of [["исходная", функтор.from], ["целевая", функтор.to]]) {
      const путь = пути.get(имя)
      if (путь === undefined) {
        обеПривезены = false
        сообщить(
          "FLANG_FUNCTOR_SPEC_MISSING",
          `функтор «${функтор.name}»: ${роль} спека «${имя}» не привезена — нет строки`
            + ` 'использует «${имя}» из «…»'; отображение сверять не с чем`,
        )
        continue
      }
      const полный = разрешитьПуть(file, путь)
      const загруженная = загрузить(полный)
      if (!загруженная.ok) {
        обеПривезены = false
        сообщить(
          "FLANG_FUNCTOR_SPEC_MISSING",
          `функтор «${функтор.name}»: ${роль} спека «${имя}» не прочитана по пути «${путь}»:`
            + ` ${загруженная.error}`,
        )
        continue
      }
      const объявлена = загруженная.program?.module
      if (объявлена !== имя) {
        обеПривезены = false
        сообщить(
          "FLANG_FUNCTOR_SPEC_NAME",
          `функтор «${функтор.name}»: спека привезена под именем «${имя}», а файл «${путь}»`
            + ` объявляет «${объявлена ?? "—"}»`,
        )
        continue
      }
      спеки.set(роль, записиСпеки(загруженная.program))
    }
    if (!обеПривезены) continue

    const слева = спеки.get("исходная")
    const справа = спеки.get("целевая")

    for (const пара of функтор.objects ?? []) {
      const источник = слева.get(пара.from)
      const образ = справа.get(пара.to)
      if (источник === undefined) {
        сообщить(
          "FLANG_FUNCTOR_DICTIONARY",
          `функтор «${функтор.name}» отображает объект «${пара.from}», но в спеке «${функтор.from}»`
            + ` такого объекта нет${подсказка(слева.keys())}`,
        )
      }
      if (образ === undefined) {
        сообщить(
          "FLANG_FUNCTOR_DICTIONARY",
          `функтор «${функтор.name}» отображает «${пара.from}» в «${пара.to}», но в спеке`
            + ` «${функтор.to}» такого объекта нет${подсказка(справа.keys())}`,
        )
      }
      if (источник === undefined || образ === undefined) continue
      checked.objects += 1

      const названы = new Set()
      for (const поле of пара.fields ?? []) {
        названы.add(поле.from)
        const типИсточника = источник.get(поле.from)
        const типОбраза = образ.get(поле.to)
        if (типИсточника === undefined) {
          сообщить(
            "FLANG_FUNCTOR_DICTIONARY",
            `функтор «${функтор.name}»: у объекта «${пара.from}» нет поля «${поле.from}»`
              + `${подсказка(источник.keys())}`,
          )
        }
        if (типОбраза === undefined) {
          сообщить(
            "FLANG_FUNCTOR_DICTIONARY",
            `функтор «${функтор.name}»: поле «${поле.from}» отображается в «${поле.to}», но у`
              + ` объекта «${пара.to}» такого поля нет${подсказка(образ.keys())}`,
          )
        }
        if (типИсточника === undefined || типОбраза === undefined) continue
        const слеваИмя = имяТипаПоля(типИсточника)
        const справаИмя = имяТипаПоля(типОбраза)
        if (слеваИмя !== справаИмя) {
          сообщить(
            "FLANG_FUNCTOR_FIELD_TYPE",
            `функтор «${функтор.name}»: поле «${пара.from}.${поле.from}» — ${слеваИмя}, а его образ`
              + ` «${пара.to}.${поле.to}» — ${справаИмя}: словарь обязан переводить значение в`
              + ` значение того же вида`,
          )
          continue
        }
        checked.fields += 1
      }
      for (const имя of источник.keys()) if (!названы.has(имя)) checked.unmapped += 1
    }
  }

  return { valid: diagnostics.length === 0, checked, diagnostics }
}

/** Объекты спеки: имя записи → (имя поля → тип поля). */
function записиСпеки(программа) {
  const записи = new Map()
  for (const тип of программа?.types ?? []) {
    if (тип?.kind !== "record" || typeof тип.name !== "string") continue
    записи.set(тип.name, new Map((тип.fields ?? []).map((поле) => [поле.name, поле.type])))
  }
  return записи
}

/**
 * Имя типа поля для сверки и для сообщения.
 *
 * Смотрит на ВИД, а не на исходную строку FTS: `Деньги` и `Число` — один и тот
 * же `{kind:"number"}`, и `sameType` в `types.mjs` считает их одним типом.
 * Второе равенство типов, расходящееся с языковым, здесь заводить нельзя.
 */
function имяТипаПоля(тип) {
  if (тип === null || typeof тип !== "object") return String(тип)
  const части = [тип.kind]
  if (typeof тип.name === "string") части.push(`«${тип.name}»`)
  if (тип.optional === true) части.push("необязательное")
  if (тип.element !== undefined) части.push(`(${имяТипаПоля(тип.element)})`)
  if (тип.key !== undefined) части.push(`[${имяТипаПоля(тип.key)}]`)
  if (тип.value !== undefined) части.push(`{${имяТипаПоля(тип.value)}}`)
  return части.join(" ")
}

/**
 * Что БЫЛО в спеке — половина находки.
 *
 * Сообщение «такого поля нет» отправляет автора открывать чужой файл и читать
 * его глазами; сообщение со списком имён показывает опечатку сразу. Список
 * ограничен восемью именами намеренно: диагностика на сорок имён не читается.
 */
function подсказка(имена) {
  const список = [...имена]
  if (список.length === 0) return ""
  const видно = список.slice(0, 8).map((имя) => `«${имя}»`).join(", ")
  return `; есть ${видно}${список.length > 8 ? ` и ещё ${список.length - 8}` : ""}`
}

/**
 * Путь спеки относительно файла функтора — своим кодом, а не `node:path`.
 *
 * Довод тот же, по какому чтение принимается извне: модуль не тянет ни одного
 * узла платформы, и ради склейки двух строк заводить зависимость незачем.
 * Разделитель `/`: пути в `использует` пишутся в исходнике и в исходнике же
 * читаются, а не собираются из имён операционной системы.
 */
function разрешитьПуть(файл, путь) {
  if (путь.startsWith("/")) return путь
  const каталог = файл.includes("/") ? файл.slice(0, файл.lastIndexOf("/")) : ""
  const части = []
  for (const часть of `${каталог}/${путь}`.split("/")) {
    if (часть === "" || часть === ".") continue
    if (часть === ".." && части.length > 0 && части[части.length - 1] !== "..") {
      части.pop()
      continue
    }
    части.push(часть)
  }
  return (файл.startsWith("/") || путь.startsWith("/") ? "/" : "") + части.join("/")
}
