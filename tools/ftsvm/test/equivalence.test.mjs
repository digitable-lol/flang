/**
 * Главный тест ftsvm: ядро, интерпретатор и JIT обязаны быть неразличимы.
 *
 * Проверка идёт по сетке входов, а не по паре примеров. Пара примеров ловит
 * только то, о чём автор уже подумал; сетка ловит границы, о которых он не
 * подумал: ровно на пороге правила, ноль, отрицательное, минус ноль, чужой
 * тип, отсутствующее поле, лишнее поле. Совпадать обязаны и результаты,
 * и отказы — код диагностики и текст.
 */
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"

import { executeUtility } from "../../../dist/src/index.js"

import { compileUtility, errorCode, listUtilities, run } from "../src/index.mjs"

const repo = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..")

const fixture = async (name) => JSON.parse(await readFile(resolve(repo, `tools/ftsc/test/fixtures/${name}.ir.json`), "utf8"))

/**
 * Один исход исполнения: значение или отказ. Ошибка сводится к паре
 * «код + текст» — именно это видит вызывающий код, и именно это обязано
 * совпадать у трёх движков.
 */
function probe(call) {
  try {
    return { kind: "value", value: call() }
  } catch (error) {
    return { kind: "error", code: errorCode(error), message: error.message }
  }
}

/**
 * Сверяет три движка на одном входе.
 * @param {object} program
 * @param {string} moduleName
 * @param {string} utilityName
 * @param {Record<string, unknown>} input
 */
function compareEngines(program, moduleName, utilityName, input) {
  const document = program.modules.find((item) => item.name === moduleName).document
  const compiled = compileUtility(program, moduleName, utilityName)
  const core = probe(() => executeUtility(document, utilityName, input))
  const interpreted = probe(() => run(program, moduleName, utilityName, input))
  const jitted = probe(() => compiled(input))
  const where = `${utilityName} ${JSON.stringify(input)}`
  assert.deepEqual(interpreted, core, `интерпретатор разошёлся с ядром: ${where}`)
  assert.deepEqual(jitted, core, `JIT разошёлся с ядром: ${where}`)
  // Ноль и минус ноль равны по ==, но это разные результаты вычисления:
  // сверка через Object.is не даёт им слиться.
  if (core.kind === "value") {
    assert.ok(Object.is(interpreted.value, core.value), `интерпретатор: ${where}`)
    assert.ok(Object.is(jitted.value, core.value), `JIT: ${where}`)
  }
  return core
}

/** Декартово произведение значений полей — детерминированная сетка. */
function grid(spec) {
  const names = Object.keys(spec)
  return names.reduce((rows, name) => rows.flatMap((row) => spec[name].map((value) => ({ ...row, [name]: value }))), [{}])
}

/**
 * Из корректного входа делает набор испорченных: без каждого поля и с чужим
 * полем. Это самые частые дефекты вызывающей стороны, и три движка обязаны
 * отвергать их одинаково — с одним и тем же кодом и текстом.
 */
function damaged(input) {
  const variants = [{ ...input, "посторонний факт": 1 }]
  for (const name of Object.keys(input)) {
    const copy = { ...input }
    delete copy[name]
    variants.push(copy)
  }
  return variants
}

test("discount: ядро, интерпретатор и JIT совпадают на сетке входов", async () => {
  const program = await fixture("discount")
  const inputs = grid({
    сумма: [0, 1, 999.99, 5000, 9999.999, 10000, 10000.01, 20000, -5000, -0, Number.NaN, Number.POSITIVE_INFINITY, "много"],
    "постоянный клиент": [true, false, "да", 0, null],
  })
  assert.equal(inputs.length, 65)
  let executed = 0
  for (const input of inputs) {
    if (compareEngines(program, "Продажи", "Рассчитать скидку", input).kind === "value") executed += 1
  }
  // Сетка обязана содержать и успешные исходы: тест, где всё падает
  // одинаково, ничего не доказывает про вычисления.
  // 8 допустимых сумм × 2 признака: девятая сумма (-5000) нарушает свойство
  // «Скидка ограничена» при любом признаке — 20 % от отрицательной суммы
  // меньше самой скидки, — и это законный отказ, а не дефект сетки.
  assert.equal(executed, 16)
})

test("discount: испорченный вход отвергается одинаково", async () => {
  const program = await fixture("discount")
  for (const input of damaged({ сумма: 5000, "постоянный клиент": true })) {
    const outcome = compareEngines(program, "Продажи", "Рассчитать скидку", input)
    assert.equal(outcome.kind, "error")
  }
})

test("delivery: ядро, интерпретатор и JIT совпадают на сетке входов", async () => {
  const program = await fixture("delivery")
  const inputs = grid({
    вес: [0, 10, 10.0001, 18, -3],
    расстояние: [0, 499.99, 500, 900],
    "срочная доставка": [true, false],
    "страховая сумма": [0, -1, 1, 50000],
  })
  assert.equal(inputs.length, 160)
  let executed = 0
  for (const input of inputs) {
    if (compareEngines(program, "Логистика", "Рассчитать доставку", input).kind === "value") executed += 1
  }
  assert.equal(executed, 160)
})

test("delivery: чужие типы и испорченный вход отвергаются одинаково", async () => {
  const program = await fixture("delivery")
  const base = { вес: 4, расстояние: 60, "срочная доставка": true, "страховая сумма": 50000 }
  const wrong = [
    { ...base, вес: "4" },
    { ...base, вес: -0 },
    { ...base, расстояние: Number.NaN },
    { ...base, "срочная доставка": 1 },
    { ...base, "страховая сумма": undefined },
    ...damaged(base),
  ]
  for (const input of wrong) {
    assert.equal(compareEngines(program, "Логистика", "Рассчитать доставку", input).kind, "error")
  }
})

test("delivery: имя модуля можно не указывать", async () => {
  const program = await fixture("delivery")
  const input = { вес: 18, расстояние: 900, "срочная доставка": false, "страховая сумма": 0 }
  assert.equal(run(program, null, "Рассчитать доставку", input), 950)
  assert.equal(compileUtility(program, null, "Рассчитать доставку")(input), 950)
})

test("shipment: программа без утилит не роняет исполнитель", async () => {
  const program = await fixture("shipment")
  // Морфизмы и теорема без единой утилиты — законная модель: исполнять
  // в ней нечего, и это не поломка, а пустой список.
  assert.deepEqual(listUtilities(program), [])
  assert.deepEqual(listUtilities(program, "Исполнение заказа"), [])

  for (const call of [
    () => run(program, "Исполнение заказа", "Отгрузить", {}),
    () => compileUtility(program, "Исполнение заказа", "Отгрузить"),
    () => run(program, null, "Отгрузить", {}),
  ]) {
    const outcome = probe(call)
    assert.equal(outcome.kind, "error")
    assert.equal(outcome.code, "FTS_UNKNOWN_UTILITY")
    assert.equal(outcome.message, "не найдена утилита «Отгрузить»")
  }

  const unknownModule = probe(() => run(program, "Склад", "Отгрузить", {}))
  assert.equal(unknownModule.code, "FTSVM_UNKNOWN_MODULE")
})

/*
 * Документы ниже собраны руками и НЕ проходят validate ядра: в них
 * намеренно есть операции над несовместимыми типами. Это не пример того,
 * как надо писать модели, — это проверка того, что при непроверенном IR
 * три движка ломаются одинаково, а не расходятся молча. JIT в таких местах
 * не может доказать тип и обязан напечатать вызов помощника с той же
 * проверкой, что делает ядро.
 */
function mixedProgram() {
  const structure = {
    name: "Смесь",
    fields: [
      { name: "число", type: "Число" },
      { name: "флаг", type: "Признак" },
      { name: "текст", type: "Строка" },
      { name: "необязательное", type: "Число | undefined" },
    ],
  }
  const always = [{ field: "число", operator: "gte", value: { kind: "value", value: 0 } }]
  const utilities = [
    {
      name: "Процент от признака",
      input: "Смесь",
      output: "Деньги",
      initial: 0,
      rules: [
        { name: "Доля флага", when: always, action: { kind: "add", value: { kind: "percent", percent: 10, field: "флаг" } } },
      ],
      properties: [],
      examples: [],
    },
    {
      name: "Порядок на строке",
      input: "Смесь",
      output: "Число",
      initial: 0,
      rules: [
        {
          name: "Строка больше нуля",
          when: [{ field: "текст", operator: "gt", value: { kind: "value", value: 0 } }],
          action: { kind: "add", value: { kind: "value", value: 1 } },
        },
      ],
      properties: [],
      examples: [],
    },
    {
      name: "Сложение с признаком",
      input: "Смесь",
      output: "Число",
      initial: 0,
      rules: [
        {
          name: "Результат становится признаком",
          when: always,
          action: { kind: "set", value: { kind: "field", field: "флаг" } },
        },
        { name: "Прибавить единицу", when: always, action: { kind: "add", value: { kind: "value", value: 1 } } },
      ],
      properties: [],
      examples: [],
    },
    {
      name: "Чтение необязательного",
      input: "Смесь",
      output: "Число",
      initial: 0,
      rules: [
        {
          name: "Необязательное задано",
          when: [{ field: "необязательное", operator: "gte", value: { kind: "value", value: 1 } }],
          action: { kind: "add", value: { kind: "field", field: "необязательное" } },
        },
      ],
      properties: [],
      examples: [],
    },
    {
      name: "Удвоение результата",
      input: "Смесь",
      output: "Число",
      initial: 1,
      rules: [
        { name: "Удвоить", when: always, action: { kind: "add", value: { kind: "result" } } },
        {
          name: "Ещё раз удвоить",
          when: [{ field: "число", operator: "lt", value: { kind: "result" } }],
          action: { kind: "add", value: { kind: "result" } },
        },
      ],
      properties: [{ name: "Не больше числа", operator: "lte", value: { kind: "field", field: "число" } }],
      examples: [],
    },
  ]
  return {
    ir: 1,
    project: "mixed",
    modules: [
      {
        name: "Смесь",
        category: "Смесь",
        source: "test",
        imports: [],
        exports: null,
        document: { category: "Смесь", structures: [structure], functors: [], proposition: null, ts_compat: {}, utilities },
      },
    ],
    functors: [],
    order: ["Смесь"],
  }
}

test("непроверенный IR: три движка ломаются одинаково", () => {
  const program = mixedProgram()
  const inputs = grid({
    число: [0, 1, 2, 4, -1],
    флаг: [true, false],
    текст: ["да", ""],
    необязательное: [undefined, 0, 1, 5],
  }).map((row) => {
    const input = { ...row }
    // undefined в сетке означает «поля нет», а не «поле равно undefined».
    if (input.необязательное === undefined) delete input.необязательное
    return input
  })
  assert.equal(inputs.length, 80)

  const codes = new Set()
  for (const utility of [
    "Процент от признака",
    "Порядок на строке",
    "Сложение с признаком",
    "Чтение необязательного",
    "Удвоение результата",
  ]) {
    for (const input of inputs) {
      const outcome = compareEngines(program, "Смесь", utility, input)
      if (outcome.kind === "error") codes.add(outcome.code)
    }
  }
  // Сетка обязана действительно задеть все интересные отказы, иначе
  // «совпало» означало бы лишь, что ничего не проверили.
  assert.deepEqual([...codes].sort(), [
    "FTS_UTILITY_ADD_TYPE",
    "FTS_UTILITY_COMPARE_TYPE",
    "FTS_UTILITY_INPUT",
    "FTS_UTILITY_PERCENT_TYPE",
    "FTS_UTILITY_PROPERTY",
  ])
})
