/**
 * Тесты анализа завершаемости flang.
 *
 * Каждая программа собрана руками по SPEC.md, раздел 5. Отвергнутые
 * программы проверяются не «отказом вообще», а кодом диагностики и тем,
 * что в сообщении названо конкретное место: без этого отказ бесполезен —
 * автор не узнает, какой именно вызов не убывает.
 *
 * Запуск: node --test flang/test/totality.test.mjs
 */
import assert from "node:assert/strict"
import { test } from "node:test"

import { parse } from "../src/parser.mjs"
import { checkTotality } from "../src/totality.mjs"

/* ---- сокращения для AST ------------------------------------------- */

const число = { kind: "number" }
const список = (of) => ({ kind: "list", of })
const имя = (name) => ({ kind: "named", name })

const лит = (value) => ({ kind: "literal", value })
const пер = (name) => ({ kind: "var", name })
const оп = (op, left, right) => ({ kind: "binary", op, left, right })
const вызов = (name, ...args) => ({ kind: "call", name, args })
const форма = (name, ...args) => ({ kind: "builtin", name, args })
const разбор = (target, ...cases) => ({ kind: "match", target, cases })
const пусто = (body) => ({ pattern: { kind: "empty" }, body })
const голова_и_хвост = (head, tail, body) => ({ pattern: { kind: "cons", head, tail }, body })

const программа = (functions, types = []) => ({ flang: 1, module: "Тест", types, functions })
const коды = (result) => result.diagnostics.map((diagnostic) => diagnostic.code)

/** «Длина» из SPEC, раздел 4: убывание по хвосту списка. */
const длина = {
  name: "Длина",
  total: true,
  params: [{ name: "элементы", type: список(число) }],
  returns: число,
  body: разбор(
    пер("элементы"),
    пусто(лит(0)),
    голова_и_хвост("г", "х", оп("add", лит(1), вызов("Длина", пер("х")))),
  ),
}

/* ================================================================== */
/* Принимаются                                                         */
/* ================================================================== */

test("длина списка через хвост признаётся тотальной", () => {
  const result = checkTotality(программа([длина]))
  assert.deepEqual(result.diagnostics, [])
  assert.equal(result.ok, true)
  assert.deepEqual([...result.total], ["Длина"])
})

test("хвост через встроенную форму, а не через образец, тоже убывает", () => {
  const result = checkTotality(программа([{
    name: "Сумма",
    total: true,
    params: [{ name: "э", type: список(число) }],
    returns: число,
    body: {
      kind: "if",
      cond: форма("пусто", пер("э")),
      then: лит(0),
      else: оп("add", форма("голова", пер("э")), вызов("Сумма", форма("хвост", пер("э")))),
    },
  }]))
  assert.deepEqual(result.diagnostics, [])
  assert.deepEqual([...result.total], ["Сумма"])
})

test("«пусть» переносит происхождение значения на имя", () => {
  const result = checkTotality(программа([{
    name: "Считать",
    total: true,
    params: [{ name: "э", type: список(число) }],
    returns: число,
    body: разбор(
      пер("э"),
      пусто(лит(0)),
      голова_и_хвост("г", "х", {
        kind: "let",
        name: "остаток",
        value: пер("х"),
        in: оп("add", лит(1), вызов("Считать", пер("остаток"))),
      }),
    ),
  }]))
  assert.deepEqual(result.diagnostics, [])
  assert.deepEqual([...result.total], ["Считать"])
})

test("свёртка по конечной коллекции сама по себе не мешает тотальности", () => {
  const result = checkTotality(программа([{
    name: "Сумма",
    total: true,
    params: [{ name: "э", type: список(число) }],
    returns: число,
    body: { kind: "fold", over: пер("э"), init: лит(0), acc: "сумма", item: "поз", body: оп("add", пер("сумма"), пер("поз")) },
  }]))
  assert.deepEqual(result.diagnostics, [])
  assert.deepEqual([...result.total], ["Сумма"])
})

test("обход дерева: рекурсия по полям варианта убывает", () => {
  const дерево = {
    kind: "sum",
    name: "Дерево",
    variants: [
      { name: "Лист", fields: [] },
      { name: "Узел", fields: [{ name: "значение", type: число }, { name: "левое", type: имя("Дерево") }, { name: "правое", type: имя("Дерево") }] },
    ],
  }
  const result = checkTotality(программа([{
    name: "Сумма дерева",
    total: true,
    params: [{ name: "д", type: имя("Дерево") }],
    returns: число,
    body: разбор(
      пер("д"),
      { pattern: { kind: "variant", name: "Лист" }, body: лит(0) },
      {
        pattern: { kind: "variant", name: "Узел", bind: { значение: "з", левое: "л", правое: "п" } },
        body: оп("add", пер("з"), оп("add", вызов("Сумма дерева", пер("л")), вызов("Сумма дерева", пер("п")))),
      },
    ),
  }], [дерево]))
  assert.deepEqual(result.diagnostics, [])
  assert.deepEqual([...result.total], ["Сумма дерева"])
})

test("рекурсия внутри свёртки по полю записи убывает", () => {
  const узел = { kind: "record", name: "Узел", fields: [{ name: "вес", type: число }, { name: "дети", type: список(имя("Узел")) }] }
  const result = checkTotality(программа([{
    name: "Вес",
    total: true,
    params: [{ name: "у", type: имя("Узел") }],
    returns: число,
    body: оп("add", { kind: "field", target: пер("у"), field: "вес" }, {
      kind: "fold",
      over: { kind: "field", target: пер("у"), field: "дети" },
      init: лит(0),
      acc: "сумма",
      item: "ребёнок",
      body: оп("add", пер("сумма"), вызов("Вес", пер("ребёнок"))),
    }),
  }], [узел]))
  assert.deepEqual(result.diagnostics, [])
  assert.deepEqual([...result.total], ["Вес"])
})

test("взаимная рекурсия с убыванием на общей позиции принимается", () => {
  const узел = { kind: "record", name: "Узел", fields: [{ name: "дети", type: список(имя("Узел")) }] }
  const result = checkTotality(программа([
    {
      name: "Размер узла",
      total: true,
      params: [{ name: "у", type: имя("Узел") }],
      returns: число,
      body: оп("add", лит(1), вызов("Размер леса", { kind: "field", target: пер("у"), field: "дети" })),
    },
    {
      name: "Размер леса",
      total: true,
      params: [{ name: "лес", type: список(имя("Узел")) }],
      returns: число,
      body: разбор(
        пер("лес"),
        пусто(лит(0)),
        голова_и_хвост("г", "х", оп("add", вызов("Размер узла", пер("г")), вызов("Размер леса", пер("х")))),
      ),
    },
  ], [узел]))
  assert.deepEqual(result.diagnostics, [])
  assert.deepEqual([...result.total].sort(), ["Размер леса", "Размер узла"])
})

test("тотальная может звать тотальную без рекурсии", () => {
  const result = checkTotality(программа([
    длина,
    { name: "Пусто ли", total: true, params: [{ name: "э", type: список(число) }], returns: число, body: вызов("Длина", пер("э")) },
  ]))
  assert.deepEqual(result.diagnostics, [])
  assert.deepEqual([...result.total].sort(), ["Длина", "Пусто ли"])
})

test("обычные функции не анализируются: бесконечная рекурсия в них не ошибка", () => {
  const result = checkTotality(программа([{
    name: "Вечность",
    params: [{ name: "н", type: число }],
    returns: число,
    body: вызов("Вечность", пер("н")),
  }]))
  assert.deepEqual(result.diagnostics, [])
  assert.equal(result.ok, true)
  assert.deepEqual([...result.total], [])
})

test("отображение и фильтр над параметром не считаются источником незавершаемости", () => {
  const result = checkTotality(программа([{
    name: "Удвоить",
    total: true,
    params: [{ name: "э", type: список(число) }],
    returns: список(число),
    body: { kind: "map", over: { kind: "filter", over: пер("э"), item: "п", body: оп("gt", пер("п"), лит(0)) }, item: "п", body: оп("mul", пер("п"), лит(2)) },
  }]))
  assert.deepEqual(result.diagnostics, [])
  assert.deepEqual([...result.total], ["Удвоить"])
})

/* ================================================================== */
/* Отвергаются                                                         */
/* ================================================================== */

test("вызов с тем же аргументом отвергается и сообщение называет параметр", () => {
  const result = checkTotality(программа([{
    name: "Длина",
    total: true,
    params: [{ name: "элементы", type: список(число) }],
    returns: число,
    body: разбор(
      пер("элементы"),
      пусто(лит(0)),
      голова_и_хвост("г", "х", оп("add", лит(1), вызов("Длина", пер("элементы")))),
    ),
  }]))
  assert.deepEqual(коды(result), ["FLANG_NOT_TOTAL"])
  assert.match(result.diagnostics[0].message, /рекурсивный вызов «Длина» не убывает/u)
  assert.match(result.diagnostics[0].message, /это сам параметр «элементы», а не его часть/u)
  assert.match(result.diagnostics[0].message, /хвост списка/u)
  assert.deepEqual([...result.total], [])
})

test("вызов с увеличенным аргументом («добавить … к хвосту») отвергается", () => {
  const result = checkTotality(программа([{
    name: "Растить",
    total: true,
    params: [{ name: "э", type: список(число) }],
    returns: число,
    body: разбор(
      пер("э"),
      пусто(лит(0)),
      голова_и_хвост("г", "х", вызов("Растить", форма("добавить", пер("г"), форма("добавить", пер("г"), пер("х"))))),
    ),
  }]))
  assert.deepEqual(коды(result), ["FLANG_NOT_TOTAL"])
  assert.match(result.diagnostics[0].message, /не выведен ни из одного параметра/u)
  assert.deepEqual([...result.total], [])
})

test("результат чужого вызова не считается меньшим: анализ консервативен", () => {
  const result = checkTotality(программа([
    { name: "Развернуть", total: true, params: [{ name: "э", type: список(число) }], returns: список(число), body: пер("э") },
    {
      name: "Обход",
      total: true,
      params: [{ name: "э", type: список(число) }],
      returns: число,
      body: разбор(
        пер("э"),
        пусто(лит(0)),
        голова_и_хвост("г", "х", вызов("Обход", вызов("Развернуть", пер("х")))),
      ),
    },
  ]))
  assert.deepEqual(коды(result), ["FLANG_NOT_TOTAL"])
  assert.match(result.diagnostics[0].message, /«Развернуть» от «х»/u)
  assert.deepEqual([...result.total], ["Развернуть"])
})

test("взаимная рекурсия без убывания отвергается с указанием цикла", () => {
  const result = checkTotality(программа([
    { name: "Чётное", total: true, params: [{ name: "н", type: число }], returns: число, body: вызов("Нечётное", пер("н")) },
    { name: "Нечётное", total: true, params: [{ name: "н", type: число }], returns: число, body: вызов("Чётное", пер("н")) },
  ]))
  assert.deepEqual(коды(result), ["FLANG_NOT_TOTAL", "FLANG_NOT_TOTAL"])
  assert.match(result.diagnostics[0].message, /вызов «Нечётное» в цикле «Чётное» → «Нечётное»/u)
  assert.deepEqual([...result.total], [])
})

test("убывание на разных позициях в цикле не доказывает завершение", () => {
  // Классический контрпример: каждое ребро где-то убывает, но пара
  // аргументов по кругу растёт.
  const result = checkTotality(программа([
    {
      name: "А",
      total: true,
      params: [{ name: "а", type: список(число) }, { name: "б", type: список(число) }],
      returns: число,
      body: разбор(
        пер("а"),
        пусто(лит(0)),
        голова_и_хвост("г", "х", вызов("Б", пер("х"), форма("добавить", пер("г"), пер("б")))),
      ),
    },
    {
      name: "Б",
      total: true,
      params: [{ name: "а", type: список(число) }, { name: "б", type: список(число) }],
      returns: число,
      body: разбор(
        пер("б"),
        пусто(лит(0)),
        голова_и_хвост("г", "х", вызов("А", форма("добавить", пер("г"), пер("а")), пер("х"))),
      ),
    },
  ]))
  assert.deepEqual(коды(result), ["FLANG_NOT_TOTAL"])
  assert.match(result.diagnostics[0].message, /нет аргумента, который убывает на каждом вызове/u)
  assert.match(result.diagnostics[0].message, /«А» → «Б» убывает по аргументу 1/u)
  assert.deepEqual([...result.total], [])
})

test("разные убывающие позиции у двух самовызовов отвергаются честно, а не молча", () => {
  const result = checkTotality(программа([{
    name: "Слияние",
    total: true,
    params: [{ name: "а", type: список(число) }, { name: "б", type: список(число) }],
    returns: число,
    body: разбор(
      пер("а"),
      пусто(лит(0)),
      голова_и_хвост("га", "ха", разбор(
        пер("б"),
        пусто(лит(0)),
        голова_и_хвост("гб", "хб", оп("add", вызов("Слияние", пер("ха"), пер("б")), вызов("Слияние", пер("а"), пер("хб")))),
      )),
    ),
  }]))
  assert.deepEqual(коды(result), ["FLANG_NOT_TOTAL"])
  assert.match(result.diagnostics[0].message, /нет аргумента, который убывает на каждом вызове/u)
})

test("тотальная функция не может вызывать обычную", () => {
  const result = checkTotality(программа([
    { name: "Считать", total: true, params: [{ name: "э", type: список(число) }], returns: число, body: вызов("Крутить", пер("э")) },
    { name: "Крутить", params: [{ name: "э", type: список(число) }], returns: число, body: вызов("Крутить", пер("э")) },
  ]))
  assert.deepEqual(коды(result), ["FLANG_NOT_TOTAL"])
  assert.match(result.diagnostics[0].message, /«Считать» вызывает обычную функцию «Крутить»/u)
  assert.match(result.diagnostics[0].message, /Пометьте «Крутить» как тотальную/u)
  assert.deepEqual([...result.total], [])
})

test("вызов неизвестной функции из тотальной не даёт доказательства", () => {
  const result = checkTotality(программа([
    { name: "Считать", total: true, params: [], returns: число, body: вызов("Нету") },
  ]))
  assert.deepEqual(коды(result), ["FLANG_NOT_TOTAL"])
  assert.match(result.diagnostics[0].message, /вызывает неизвестную функцию «Нету»/u)
})

test("недоказанность распространяется по графу вызовов, но диагностика не дублируется", () => {
  const result = checkTotality(программа([
    {
      name: "Верхняя",
      total: true,
      params: [{ name: "э", type: список(число) }],
      returns: число,
      body: вызов("Нижняя", пер("э")),
    },
    {
      name: "Нижняя",
      total: true,
      params: [{ name: "э", type: список(число) }],
      returns: число,
      body: вызов("Нижняя", пер("э")),
    },
  ]))
  assert.deepEqual(коды(result), ["FLANG_NOT_TOTAL"])
  assert.match(result.diagnostics[0].message, /«Нижняя»/u)
  // «Верхняя» сама по себе не рекурсивна, но её гарантия опирается на «Нижнюю».
  assert.deepEqual([...result.total], [])
})

test("рекурсия по накопителю свёртки не считается убыванием", () => {
  const result = checkTotality(программа([{
    name: "Сложить",
    total: true,
    params: [{ name: "э", type: список(число) }],
    returns: число,
    body: { kind: "fold", over: пер("э"), init: лит(0), acc: "сумма", item: "поз", body: вызов("Сложить", пер("э")) },
  }]))
  assert.deepEqual(коды(result), ["FLANG_NOT_TOTAL"])
  assert.match(result.diagnostics[0].message, /это сам параметр «э»/u)
})

test("«любое» не разбирает значение, поэтому убывания не даёт", () => {
  const result = checkTotality(программа([{
    name: "Крутить",
    total: true,
    params: [{ name: "э", type: список(число) }],
    returns: число,
    body: разбор(пер("э"), { pattern: { kind: "any", bind: "всё" }, body: вызов("Крутить", пер("всё")) }),
  }]))
  assert.deepEqual(коды(result), ["FLANG_NOT_TOTAL"])
  assert.match(result.diagnostics[0].message, /это сам параметр «э», а не его часть/u)
})

test("убывание не на своей позиции не принимается", () => {
  const result = checkTotality(программа([{
    name: "Перестановка",
    total: true,
    params: [{ name: "а", type: список(число) }, { name: "б", type: список(число) }],
    returns: число,
    body: разбор(
      пер("а"),
      пусто(лит(0)),
      // Хвост первого параметра приходит на место второго: цепочка частей
      // одного значения не образуется.
      голова_и_хвост("г", "х", вызов("Перестановка", пер("б"), пер("х"))),
    ),
  }]))
  assert.deepEqual(коды(result), ["FLANG_NOT_TOTAL"])
  assert.match(result.diagnostics[0].message, /сравнивается с параметром «б» на своей позиции/u)
})

/* ================================================================== */
/* Сквозной прогон через парсер                                        */
/* ================================================================== */

test("исходник flang из SPEC: «Длина» доказана тотальной", () => {
  const source = `модуль «Т»

тотальная функция «Длина»
  принимает элементы: список числа
  возвращает число
  разбор элементы
    случай пусто
      то 0
    случай голова и хвост
      то 1 плюс «Длина» от хвост
`
  const result = checkTotality(parse(source))
  assert.deepEqual(result.diagnostics, [])
  assert.deepEqual([...result.total], ["Длина"])
})

test("исходник flang: «добавить голова к хвост» отвергается на разобранном AST", () => {
  const source = `модуль «Т»

тотальная функция «Крутить»
  принимает элементы: список числа
  возвращает число
  разбор элементы
    случай пусто
      то 0
    случай голова и хвост
      то 1 плюс «Крутить» от добавить голова к хвост
`
  const result = checkTotality(parse(source))
  assert.deepEqual(коды(result), ["FLANG_NOT_TOTAL"])
  assert.match(result.diagnostics[0].message, /не выведен ни из одного параметра/u)
  assert.deepEqual(result.diagnostics[0].span, { line: 10, column: 17 })
})

test("span вызова доходит до диагностики", () => {
  const call = { kind: "call", name: "Крутить", args: [пер("э")], span: { line: 12, column: 9 } }
  const result = checkTotality(программа([
    { name: "Крутить", total: true, params: [{ name: "э", type: список(число) }], returns: число, body: call },
  ]))
  assert.deepEqual(result.diagnostics[0].span, { line: 12, column: 9 })
  assert.equal(result.diagnostics[0].severity, "error")
})
