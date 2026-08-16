/**
 * Тесты проверки типов flang.
 *
 * AST собран руками по SPEC.md, раздел 5: парсер пишется параллельно, а
 * контракт между слоями — именно AST, поэтому тесты опираются на него, а не
 * на поверхностный синтаксис. Когда появится `flang/src/parser.mjs`, эти же
 * ожидания можно будет прогнать через разобранный исходник, ничего не меняя.
 *
 * Запуск: node --test flang/test/types.test.mjs
 */
import assert from "node:assert/strict"
import { test } from "node:test"

import { parse } from "../src/parser.mjs"
import { checkArguments, checkTypes } from "../src/types.mjs"

/* ---- сокращения для AST ------------------------------------------- */

const число = { kind: "number" }
const строка = { kind: "string" }
const признак = { kind: "boolean" }
const список = (of) => ({ kind: "list", of })
const имя = (name) => ({ kind: "named", name })

const лит = (value) => ({ kind: "literal", value })
const пер = (name, span) => (span ? { kind: "var", name, span } : { kind: "var", name })
const оп = (op, left, right) => ({ kind: "binary", op, left, right })
const вызов = (name, ...args) => ({ kind: "call", name, args })
const форма = (name, ...args) => ({ kind: "builtin", name, args })

const функция = (fn) => ({ examples: [], ...fn })
const программа = (types, functions) => ({ flang: 1, module: "Тест", types, functions })

const коды = (result) => result.diagnostics.map((diagnostic) => diagnostic.code)

/* ---- общие объявления --------------------------------------------- */

const позиция = {
  kind: "record",
  name: "Позиция",
  fields: [{ name: "цена", type: число }, { name: "название", type: строка }],
}

const токен = {
  kind: "sum",
  name: "Токен",
  variants: [
    { name: "Слово", fields: [{ name: "текст", type: строка }] },
    { name: "Число", fields: [{ name: "значение", type: число }] },
    { name: "Конец", fields: [] },
  ],
}

/** Каноническая «Длина» из SPEC, раздел 4. */
const длина = функция({
  name: "Длина",
  total: true,
  params: [{ name: "элементы", type: список(число) }],
  returns: число,
  body: {
    kind: "match",
    target: пер("элементы"),
    cases: [
      { pattern: { kind: "empty" }, body: лит(0) },
      { pattern: { kind: "cons", head: "г", tail: "х" }, body: оп("add", лит(1), вызов("Длина", пер("х"))) },
    ],
  },
  examples: [{ name: "два элемента", args: { элементы: [1, 2] }, expected: 2 }],
})

/* ---- принимаемые программы ---------------------------------------- */

test("каноническая «Длина» типизируется, сигнатура попадает в таблицу", () => {
  const result = checkTypes(программа([], [длина]))
  assert.deepEqual(result.diagnostics, [])
  assert.equal(result.ok, true)
  const signature = result.types.get("Длина")
  assert.equal(signature.total, true)
  assert.deepEqual(signature.returns, { kind: "number" })
  assert.deepEqual(signature.params, [{ name: "элементы", type: { kind: "list", of: { kind: "number" } } }])
})

test("тип пустого списка выводится из контекста", () => {
  const result = checkTypes(программа([], [
    функция({
      name: "Пустые слова",
      params: [],
      returns: список(строка),
      body: { kind: "list", items: [] },
    }),
    функция({
      name: "Сколько",
      params: [],
      returns: число,
      // Пустой список без аннотации — аргумент «список числа»: контекст даёт тип.
      body: вызов("Длина", { kind: "list", items: [] }),
    }),
    длина,
  ]))
  assert.deepEqual(result.diagnostics, [])
})

test("запись, разбор суммы и встроенные формы над строками проходят проверку", () => {
  const result = checkTypes(программа([позиция, токен], [
    функция({
      name: "Показать",
      params: [{ name: "т", type: имя("Токен") }, { name: "п", type: имя("Позиция") }],
      returns: строка,
      body: {
        kind: "match",
        target: пер("т"),
        cases: [
          { pattern: { kind: "variant", name: "Слово", bind: { текст: "с" } }, body: оп("concat", пер("с"), { kind: "field", target: пер("п"), field: "название" }) },
          { pattern: { kind: "variant", name: "Число", bind: { значение: "з" } }, body: форма("к строке", пер("з")) },
          { pattern: { kind: "variant", name: "Конец" }, body: форма("соединить", { kind: "list", items: [лит("конец")] }, лит(" ")) },
        ],
      },
    }),
  ]))
  assert.deepEqual(result.diagnostics, [])
})

test("свёртка, отображение и фильтр согласованы по типам элемента и накопителя", () => {
  const result = checkTypes(программа([позиция], [
    функция({
      name: "Сумма дорогих",
      params: [{ name: "позиции", type: список(имя("Позиция")) }],
      returns: число,
      body: {
        kind: "fold",
        over: {
          kind: "filter",
          over: пер("позиции"),
          item: "п",
          body: оп("gt", { kind: "field", target: пер("п"), field: "цена" }, лит(100)),
        },
        init: лит(0),
        acc: "сумма",
        item: "поз",
        body: оп("add", пер("сумма"), { kind: "field", target: пер("поз"), field: "цена" }),
      },
    }),
    функция({
      name: "Названия",
      params: [{ name: "позиции", type: список(имя("Позиция")) }],
      returns: список(строка),
      body: { kind: "map", over: пер("позиции"), item: "п", body: { kind: "field", target: пер("п"), field: "название" } },
    }),
  ]))
  assert.deepEqual(result.diagnostics, [])
})

/* ---- несовпадение типов ------------------------------------------- */

test("арифметика над строкой отвергается", () => {
  const result = checkTypes(программа([], [
    функция({
      name: "Плохая сумма",
      params: [{ name: "с", type: строка }],
      returns: число,
      body: оп("add", лит(1), пер("с")),
    }),
  ]))
  assert.deepEqual(коды(result), ["FLANG_TYPE"])
  assert.match(result.diagnostics[0].message, /правый операнд «add»/u)
})

test("конкатенация числа отвергается", () => {
  const result = checkTypes(программа([], [
    функция({ name: "Склейка", params: [], returns: строка, body: оп("concat", лит("а"), лит(2)) }),
  ]))
  assert.deepEqual(коды(result), ["FLANG_TYPE"])
})

test("сравнение числа со строкой отвергается", () => {
  const result = checkTypes(программа([], [
    функция({ name: "Равно ли", params: [], returns: признак, body: оп("eq", лит(1), лит("1")) }),
  ]))
  assert.deepEqual(коды(result), ["FLANG_TYPE"])
})

test("«больше» над списками отвергается: порядка на структурах нет", () => {
  const result = checkTypes(программа([], [
    функция({
      name: "Больше ли",
      params: [{ name: "а", type: список(число) }, { name: "б", type: список(число) }],
      returns: признак,
      body: оп("gt", пер("а"), пер("б")),
    }),
  ]))
  assert.deepEqual(коды(result), ["FLANG_TYPE", "FLANG_TYPE"])
})

/**
 * Порядок — только для чисел, и это не решение проверки типов, а факт про
 * язык: `compare` ядра FTS (`src/utility.ts`), `order` интерпретатора и `$ord`
 * печати в JS отказывают на всём, кроме чисел, одним и тем же текстом. Пока
 * проверка пропускала сюда строки, она обещала то, чего ни один исполнитель не
 * умеет: программа проходила `check` и падала при запуске.
 */
test("«больше» над строками отвергается: порядок в языке только для чисел", () => {
  const result = checkTypes(программа([], [
    функция({
      name: "Первее",
      params: [{ name: "а", type: строка }, { name: "б", type: строка }],
      returns: признак,
      body: оп("lt", пер("а"), пер("б")),
    }),
  ]))
  assert.deepEqual(коды(result), ["FLANG_TYPE", "FLANG_TYPE"])
  assert.match(result.diagnostics[0].message, /сравнения порядка допустимы только для чисел/u)
})

test("«больше» над признаками и «ничто» отвергается тоже", () => {
  for (const тип of [признак, { kind: "null" }]) {
    const result = checkTypes(программа([], [
      функция({
        name: "Больше ли",
        params: [{ name: "а", type: тип }, { name: "б", type: тип }],
        returns: признак,
        body: оп("gte", пер("а"), пер("б")),
      }),
    ]))
    assert.deepEqual(коды(result), ["FLANG_TYPE", "FLANG_TYPE"])
  }
})

test("«символ» принимает номер и строку — в порядке поверхности «символ N в текст»", () => {
  const верно = checkTypes(программа([], [
    функция({
      name: "Первая",
      params: [{ name: "текст", type: строка }],
      returns: строка,
      body: форма("символ", лит(1), пер("текст")),
    }),
  ]))
  assert.deepEqual(верно.diagnostics, [])

  const наоборот = checkTypes(программа([], [
    функция({
      name: "Первая",
      params: [{ name: "текст", type: строка }],
      returns: строка,
      body: форма("символ", пер("текст"), лит(1)),
    }),
  ]))
  assert.deepEqual(коды(наоборот), ["FLANG_BUILTIN_ARGS", "FLANG_BUILTIN_ARGS"])
})

/*
 * «элемент» повторяет порядок «символ» — сначала номер, потом то, из чего
 * берём, — и это не украшение: перепутай порядок, и ни один настоящий вызов не
 * пройдёт проверку. Проверяются обе стороны сразу.
 *
 * Третья часть важнее двух первых: тип элемента берётся ИЗ СПИСКА, а не
 * сверяется со скаляром, поэтому форма проходит и над `список «А»`. Этим она
 * отличается от `равен`, который над параметром типа отвергается, — и ровно
 * это делает индексный доступ пригодным для полиморфной библиотеки.
 */
test("«элемент» принимает номер и список — в порядке поверхности «элемент N в списке»", () => {
  const верно = checkTypes(программа([], [
    функция({
      name: "Взять",
      params: [{ name: "элементы", type: список(число) }, { name: "н", type: число }],
      returns: число,
      body: форма("элемент", пер("н"), пер("элементы")),
    }),
  ]))
  assert.deepEqual(верно.diagnostics, [])

  const наоборот = checkTypes(программа([], [
    функция({
      name: "Взять",
      params: [{ name: "элементы", type: список(число) }, { name: "н", type: число }],
      returns: число,
      body: форма("элемент", пер("элементы"), пер("н")),
    }),
  ]))
  assert.deepEqual(коды(наоборот), ["FLANG_BUILTIN_ARGS", "FLANG_BUILTIN_ARGS"])

  const строкой = checkTypes(программа([], [
    функция({
      name: "Взять",
      params: [{ name: "текст", type: строка }, { name: "н", type: число }],
      returns: число,
      body: форма("элемент", пер("н"), пер("текст")),
    }),
  ]))
  assert.deepEqual(коды(строкой), ["FLANG_BUILTIN_ARGS"])

  const полиморфно = checkTypes(программа([], [
    функция({
      name: "Взять",
      typeParams: ["А"],
      params: [{ name: "элементы", type: список(имя("А")) }, { name: "н", type: число }],
      returns: имя("А"),
      body: форма("элемент", пер("н"), пер("элементы")),
    }),
  ]))
  assert.deepEqual(полиморфно.diagnostics, [])
})

/**
 * Псевдоним — не новый тип, а второе имя уже существующего, и разворачиваться
 * он обязан всюду, где стоит его имя. Раньше он попадал в таблицу записей и
 * притворялся записью без полей: значение объявленного им типа не было ни
 * списком, ни числом — ничем.
 */
test("псевдоним разворачивается в свой тип, а не становится пустой записью", () => {
  const числа = { kind: "alias", name: "Числа", of: список(число) }
  const result = checkTypes(программа([числа], [
    функция({
      name: "Первое",
      params: [{ name: "элементы", type: имя("Числа") }],
      returns: число,
      body: форма("голова", пер("элементы")),
    }),
  ]))
  assert.deepEqual(result.diagnostics, [])
  assert.deepEqual(result.types.get("Первое").params[0].type, { kind: "list", of: { kind: "number" } })
})

test("псевдоним псевдонима разворачивается до конца, объявленный в любом порядке", () => {
  const первый = { kind: "alias", name: "Ряд", of: имя("Числа") }
  const второй = { kind: "alias", name: "Числа", of: список(число) }
  const result = checkTypes(программа([первый, второй], [
    функция({ name: "Пусто", params: [{ name: "р", type: имя("Ряд") }], returns: число, body: форма("длина", пер("р")) }),
  ]))
  assert.deepEqual(result.diagnostics, [])
  assert.deepEqual(result.types.get("Пусто").params[0].type, { kind: "list", of: { kind: "number" } })
})

test("псевдоним через самого себя — диагностика, а не бесконечное развёртывание", () => {
  const а = { kind: "alias", name: "А", of: список(имя("Б")) }
  const б = { kind: "alias", name: "Б", of: список(имя("А")) }
  const result = checkTypes(программа([а, б], []))
  assert.deepEqual(коды(result), ["FLANG_TYPE"])
  assert.match(result.diagnostics[0].message, /определён через самого себя/u)
})

test("псевдоним на запись остаётся той же записью: поля видны", () => {
  const место = { kind: "alias", name: "Место", of: имя("Позиция") }
  const result = checkTypes(программа([позиция, место], [
    функция({
      name: "Цена",
      params: [{ name: "м", type: имя("Место") }],
      returns: число,
      body: { kind: "field", target: пер("м"), field: "цена" },
    }),
  ]))
  assert.deepEqual(result.diagnostics, [])
})

test("условие «если» должно быть признаком, а ветви — одного типа", () => {
  const result = checkTypes(программа([], [
    функция({
      name: "Ветви",
      params: [{ name: "н", type: число }],
      returns: число,
      body: { kind: "if", cond: пер("н"), then: лит(1), else: лит("два") },
    }),
  ]))
  assert.deepEqual(коды(result), ["FLANG_TYPE", "FLANG_TYPE"])
  assert.match(result.diagnostics[1].message, /ветви «если» разных типов/u)
})

test("список обязан быть однородным", () => {
  const result = checkTypes(программа([], [
    функция({
      name: "Смесь",
      params: [],
      returns: список(число),
      body: { kind: "list", items: [лит(1), лит("два"), лит(3)] },
    }),
  ]))
  assert.deepEqual(коды(result), ["FLANG_TYPE"])
  assert.match(result.diagnostics[0].message, /список неоднороден: элемент 2/u)
})

test("тело функции обязано совпасть с объявленным типом возврата", () => {
  const result = checkTypes(программа([], [
    функция({ name: "Врёт", params: [], returns: число, body: лит("не число") }),
  ]))
  assert.deepEqual(коды(result), ["FLANG_TYPE"])
  assert.match(result.diagnostics[0].message, /объявлена как число, а тело даёт строка/u)
})

/* ---- имена, поля, конструкторы ------------------------------------ */

test("несвязанное имя — FLANG_UNKNOWN_NAME, и span доходит до диагностики", () => {
  const result = checkTypes(программа([], [
    функция({ name: "Мимо", params: [], returns: число, body: пер("нету", { line: 7, column: 3 }) }),
  ]))
  assert.deepEqual(коды(result), ["FLANG_UNKNOWN_NAME"])
  assert.deepEqual(result.diagnostics[0], {
    code: "FLANG_UNKNOWN_NAME",
    message:
      "имя «нету» не связано: имя вводят 'принимает', 'пусть' или образец 'случай'; "
      + "а действия языка ('плюс', 'минус', 'умножить на', 'делить на', 'остаток от') пишутся МЕЖДУ "
      + "значениями — «3.14 умножить на р», а не «умножить 3.14 на р»",
    severity: "error",
    span: { line: 7, column: 3 },
  })
})

test("неизвестное поле записи отвергается", () => {
  const result = checkTypes(программа([позиция], [
    функция({
      name: "Скидка",
      params: [{ name: "п", type: имя("Позиция") }],
      returns: число,
      body: { kind: "field", target: пер("п"), field: "скидка" },
    }),
  ]))
  assert.deepEqual(коды(result), ["FLANG_TYPE"])
  assert.match(result.diagnostics[0].message, /запись «Позиция» не имеет поля «скидка»/u)
})

test("запись требует все поля и не терпит лишних", () => {
  const result = checkTypes(программа([позиция], [
    функция({
      name: "Собрать",
      params: [],
      returns: имя("Позиция"),
      body: { kind: "record", type: "Позиция", fields: { цена: лит(10), лишнее: лит(1) } },
    }),
  ]))
  assert.deepEqual(коды(result), ["FLANG_TYPE", "FLANG_TYPE"])
})

test("неизвестный конструктор варианта — FLANG_UNKNOWN_NAME", () => {
  const result = checkTypes(программа([токен], [
    функция({
      name: "Собрать токен",
      params: [],
      returns: имя("Токен"),
      body: { kind: "construct", variant: "Пробел", fields: {} },
    }),
  ]))
  assert.deepEqual(коды(result), ["FLANG_UNKNOWN_NAME"])
})

test("конструктор варианта с полем неверного типа отвергается", () => {
  const result = checkTypes(программа([токен], [
    функция({
      name: "Собрать слово",
      params: [],
      returns: имя("Токен"),
      body: { kind: "construct", variant: "Слово", fields: { текст: лит(42) } },
    }),
  ]))
  assert.deepEqual(коды(result), ["FLANG_TYPE"])
  assert.match(result.diagnostics[0].message, /поле «текст» варианта «Слово»/u)
})

/* ---- вызовы -------------------------------------------------------- */

test("неверная арность вызова отвергается", () => {
  const result = checkTypes(программа([], [
    длина,
    функция({
      name: "Дважды",
      params: [{ name: "э", type: список(число) }],
      returns: число,
      body: вызов("Длина", пер("э"), лит(1)),
    }),
  ]))
  assert.deepEqual(коды(result), ["FLANG_TYPE"])
  assert.match(result.diagnostics[0].message, /принимает 1 арг.*вызвана с 2/u)
})

test("неверный тип аргумента отвергается", () => {
  const result = checkTypes(программа([], [
    длина,
    функция({
      name: "Не тот список",
      params: [{ name: "с", type: список(строка) }],
      returns: число,
      body: вызов("Длина", пер("с")),
    }),
  ]))
  assert.deepEqual(коды(result), ["FLANG_TYPE"])
  assert.match(result.diagnostics[0].message, /ожидался список числа, получен список строки/u)
})

test("неизвестная функция — FLANG_UNKNOWN_NAME", () => {
  const result = checkTypes(программа([], [
    функция({ name: "Зовёт", params: [], returns: число, body: вызов("Нету", лит(1)) }),
  ]))
  assert.deepEqual(коды(result), ["FLANG_UNKNOWN_NAME"])
})

/* ---- исчерпывающность разбора ------------------------------------- */

test("разбор суммы обязан покрыть все варианты", () => {
  const result = checkTypes(программа([токен], [
    функция({
      name: "Текст",
      params: [{ name: "т", type: имя("Токен") }],
      returns: строка,
      body: {
        kind: "match",
        target: пер("т"),
        cases: [{ pattern: { kind: "variant", name: "Слово", bind: { текст: "с" } }, body: пер("с") }],
      },
    }),
  ]))
  assert.deepEqual(коды(result), ["FLANG_MATCH_NOT_EXHAUSTIVE"])
  assert.match(result.diagnostics[0].message, /не покрывает «Число», «Конец»/u)
})

test("разбор списка обязан покрыть «пусто»", () => {
  const result = checkTypes(программа([], [
    функция({
      name: "Первый",
      params: [{ name: "э", type: список(число) }],
      returns: число,
      body: {
        kind: "match",
        target: пер("э"),
        cases: [{ pattern: { kind: "cons", head: "г", tail: "х" }, body: пер("г") }],
      },
    }),
  ]))
  assert.deepEqual(коды(result), ["FLANG_MATCH_NOT_EXHAUSTIVE"])
  assert.match(result.diagnostics[0].message, /не покрывает «пусто»/u)
})

test("случай после «любое» недостижим", () => {
  const result = checkTypes(программа([], [
    функция({
      name: "Сколько",
      params: [{ name: "э", type: список(число) }],
      returns: число,
      body: {
        kind: "match",
        target: пер("э"),
        cases: [
          { pattern: { kind: "any", bind: "всё" }, body: лит(1) },
          { pattern: { kind: "empty" }, body: лит(0) },
        ],
      },
    }),
  ]))
  assert.deepEqual(коды(result), ["FLANG_MATCH_UNREACHABLE"])
})

test("повторный вариант недостижим", () => {
  const result = checkTypes(программа([токен], [
    функция({
      name: "Метка",
      params: [{ name: "т", type: имя("Токен") }],
      returns: число,
      body: {
        kind: "match",
        target: пер("т"),
        cases: [
          { pattern: { kind: "variant", name: "Слово", bind: {} }, body: лит(1) },
          { pattern: { kind: "variant", name: "Слово", bind: {} }, body: лит(2) },
          { pattern: { kind: "variant", name: "Число", bind: {} }, body: лит(3) },
          { pattern: { kind: "variant", name: "Конец" }, body: лит(4) },
        ],
      },
    }),
  ]))
  assert.deepEqual(коды(result), ["FLANG_MATCH_UNREACHABLE"])
  assert.match(result.diagnostics[0].message, /«Слово».*уже разобран/u)
})

test("вариант чужой суммы в образце отвергается", () => {
  const другой = { kind: "sum", name: "Ответ", variants: [{ name: "Да", fields: [] }, { name: "Нет", fields: [] }] }
  const result = checkTypes(программа([токен, другой], [
    функция({
      name: "Странно",
      params: [{ name: "т", type: имя("Токен") }],
      returns: число,
      body: {
        kind: "match",
        target: пер("т"),
        cases: [
          { pattern: { kind: "variant", name: "Да", bind: {} }, body: лит(1) },
          { pattern: { kind: "any" }, body: лит(0) },
        ],
      },
    }),
  ]))
  assert.deepEqual(коды(result), ["FLANG_TYPE"])
  assert.match(result.diagnostics[0].message, /принадлежит типу «Ответ»/u)
})

test("случаи разбора обязаны быть одного типа", () => {
  const result = checkTypes(программа([], [
    функция({
      name: "Разнобой",
      params: [{ name: "э", type: список(число) }],
      returns: число,
      body: {
        kind: "match",
        target: пер("э"),
        cases: [
          { pattern: { kind: "empty" }, body: лит(0) },
          { pattern: { kind: "cons", head: "г", tail: "х" }, body: лит("много") },
        ],
      },
    }),
  ]))
  assert.deepEqual(коды(result), ["FLANG_TYPE"])
})

/* ---- встроенные формы ---------------------------------------------- */

test("тип накопителя свёртки проверяется по начальному значению", () => {
  const result = checkTypes(программа([], [
    функция({
      name: "Свёртка врёт",
      params: [{ name: "э", type: список(число) }],
      returns: число,
      body: { kind: "fold", over: пер("э"), init: лит(0), acc: "сумма", item: "поз", body: лит("строка") },
    }),
  ]))
  assert.deepEqual(коды(result), ["FLANG_BUILTIN_ARGS"])
  assert.match(result.diagnostics[0].message, /накопитель «сумма» — число/u)
})

test("тело фильтра обязано давать признак", () => {
  const result = checkTypes(программа([], [
    функция({
      name: "Фильтр врёт",
      params: [{ name: "э", type: список(число) }],
      returns: список(число),
      body: { kind: "filter", over: пер("э"), item: "п", body: лит(1) },
    }),
  ]))
  assert.deepEqual(коды(result), ["FLANG_BUILTIN_ARGS"])
})

test("отображение по не-списку отвергается", () => {
  const result = checkTypes(программа([], [
    функция({
      name: "Не список",
      params: [{ name: "н", type: число }],
      returns: список(число),
      body: { kind: "map", over: пер("н"), item: "п", body: лит(1) },
    }),
  ]))
  assert.deepEqual(коды(result), ["FLANG_BUILTIN_ARGS"])
})

test("арность встроенной формы проверяется", () => {
  const result = checkTypes(программа([], [
    функция({ name: "Кусок", params: [], returns: строка, body: форма("подстрока", лит("абв")) }),
  ]))
  assert.deepEqual(коды(result), ["FLANG_BUILTIN_ARGS"])
  assert.match(result.diagnostics[0].message, /принимает 3 арг.*получила 1/u)
})

test("«добавить» проверяет тип элемента относительно списка", () => {
  const result = checkTypes(программа([], [
    функция({
      name: "Добавить не то",
      params: [{ name: "э", type: список(число) }],
      returns: список(число),
      body: форма("добавить", лит("строка"), пер("э")),
    }),
  ]))
  assert.deepEqual(коды(result), ["FLANG_BUILTIN_ARGS"])
})

/* ---- примеры -------------------------------------------------------- */

test("пример с ожидаемым значением не того типа отвергается", () => {
  const плохой = функция({
    ...длина,
    examples: [{ name: "плохой", args: { элементы: [1, 2] }, expected: "два" }],
  })
  const result = checkTypes(программа([], [плохой]))
  assert.deepEqual(коды(result), ["FLANG_TYPE"])
  assert.match(result.diagnostics[0].message, /ожидаемое значение не соответствует типу число/u)
})

test("пример с аргументом не того типа отвергается", () => {
  const плохой = функция({
    ...длина,
    examples: [{ name: "строки", args: { элементы: ["а"] }, expected: 1 }],
  })
  const result = checkTypes(программа([], [плохой]))
  assert.deepEqual(коды(result), ["FLANG_TYPE"])
  assert.match(result.diagnostics[0].message, /аргумент «элементы»\[0\]/u)
})

test("пример со значением-вариантом проверяется по объявленным полям", () => {
  const описать = функция({
    name: "Описать",
    params: [{ name: "т", type: имя("Токен") }],
    returns: строка,
    body: {
      kind: "match",
      target: пер("т"),
      cases: [
        { pattern: { kind: "variant", name: "Слово", bind: { текст: "с" } }, body: пер("с") },
        { pattern: { kind: "any" }, body: лит("прочее") },
      ],
    },
    examples: [
      { name: "слово", args: { т: { вариант: "Слово", текст: "да" } }, expected: "да" },
      { name: "число", args: { т: { вариант: "Число", значение: "не число" } }, expected: "прочее" },
    ],
  })
  const result = checkTypes(программа([токен], [описать]))
  assert.deepEqual(коды(result), ["FLANG_TYPE"])
  assert.match(result.diagnostics[0].message, /аргумент «т».значение/u)
})

test("пример без обязательного аргумента отвергается", () => {
  const плохой = функция({ ...длина, examples: [{ name: "пустой", args: {}, expected: 0 }] })
  const result = checkTypes(программа([], [плохой]))
  assert.deepEqual(коды(result), ["FLANG_TYPE"])
  assert.match(result.diagnostics[0].message, /не задаёт аргумент «элементы»/u)
})

/* ---- объявления ----------------------------------------------------- */

test("неизвестный тип в сигнатуре — FLANG_UNKNOWN_NAME", () => {
  const result = checkTypes(программа([], [
    функция({ name: "Мимо типа", params: [{ name: "п", type: имя("Нету") }], returns: число, body: лит(0) }),
  ]))
  assert.deepEqual(коды(result), ["FLANG_UNKNOWN_NAME"])
})

test("необязательное поле и тип-маркер из FTS не ломают проверку", () => {
  // Так выглядит запись после моста `compat.mjs`: «Строка | undefined»
  // становится необязательным полем, а имя состояния — типом, о котором
  // сказать нечего. Обе формы обязаны приниматься (SPEC, раздел 9).
  const заявка = {
    kind: "record",
    name: "Заявка",
    fields: [
      { name: "сумма", type: число },
      { name: "комментарий", type: { kind: "string", optional: true } },
      { name: "статус", type: { kind: "unknown", name: "Скоринг пройден" } },
    ],
  }
  const result = checkTypes(программа([заявка], [
    функция({
      name: "Сумма заявки",
      params: [{ name: "з", type: имя("Заявка") }],
      returns: число,
      body: { kind: "field", target: пер("з"), field: "сумма" },
      examples: [{ name: "без комментария", args: { з: { сумма: 10, статус: "пройден" } }, expected: 10 }],
    }),
  ]))
  assert.deepEqual(result.diagnostics, [])
})

test("необязательное поле неизвестного типа не становится обязательным", () => {
  // `проверен иногда является состоянием «Скоринг пройден»`: мост из FTS даёт
  // `{ kind: "unknown", optional: true }`. Два утверждения независимы — про
  // сам тип сказать нечего, но поля может не быть, — и потеря второго
  // превращала необязательное поле в обязательное.
  const заявка = (маркер) => ({
    kind: "record",
    name: "Заявка",
    fields: [{ name: "сумма", type: число }, { name: "проверен", type: маркер }],
  })
  const модель = (запись, значение) => программа([запись], [
    функция({
      name: "Сумма заявки",
      params: [{ name: "з", type: имя("Заявка") }],
      returns: число,
      body: { kind: "field", target: пер("з"), field: "сумма" },
      examples: [{ name: "пример", args: { з: значение }, expected: 10 }],
    }),
  ])

  const мост = { kind: "unknown", name: "Скоринг пройден", optional: true }
  const парсер = { kind: "named", name: "Скоринг пройден", state: true, optional: true }
  const обязательный = { kind: "unknown", name: "Скоринг пройден" }

  // Поля нет — принимается.
  assert.deepEqual(checkTypes(модель(заявка(мост), { сумма: 10 })).diagnostics, [])
  // Поле есть — тоже принимается: проверять по маркеру нечего.
  assert.deepEqual(checkTypes(модель(заявка(мост), { сумма: 10, проверен: "да" })).diagnostics, [])
  // Та же пара для формы, которую даёт парсер («иногда является состоянием»).
  assert.deepEqual(checkTypes(модель(заявка(парсер), { сумма: 10 })).diagnostics, [])
  assert.deepEqual(checkTypes(модель(заявка(парсер), { сумма: 10, проверен: "да" })).diagnostics, [])

  // Обязательное поле того же вида без значения — по-прежнему ошибка.
  const строгий = checkTypes(модель(заявка(обязательный), { сумма: 10 }))
  assert.deepEqual(коды(строгий), ["FLANG_TYPE"])
  assert.match(строгий.diagnostics[0].message, /не задано поле «проверен» записи «Заявка»/u)
})

test("конструктор записи не требует необязательное поле неизвестного типа", () => {
  const заявка = (маркер) => ({
    kind: "record",
    name: "Заявка",
    fields: [{ name: "сумма", type: число }, { name: "проверен", type: маркер }],
  })
  const модель = (запись) => программа([запись], [
    функция({
      name: "Создать",
      params: [],
      returns: имя("Заявка"),
      body: { kind: "record", type: "Заявка", fields: { сумма: лит(10) } },
    }),
  ])

  assert.deepEqual(checkTypes(модель(заявка({ kind: "unknown", optional: true }))).diagnostics, [])
  assert.deepEqual(коды(checkTypes(модель(заявка({ kind: "unknown" })))), ["FLANG_TYPE"])
})

/*
 * Две дороги пометки «может отсутствовать» — и обе обязаны кончиться одним.
 *
 * Тесты выше собирают AST руками и ставят `optional: true` на САМ ТИП поля —
 * так его приносит мост из FTS (`Телефон | undefined`). Парсер flang делает
 * иначе: `телефон иногда является строкой` ставит пометку на САМО ПОЛЕ, потому
 * что тип поля в AST — общее выражение типа, а «иногда» сказано не про строку,
 * а про наличие поля. Вторую дорогу здесь не проверял никто, и она была
 * СЛОМАНА: `fieldMap` нормализовал `field.type` и пометку терял, после чего
 * `checkValue` требовал необязательное поле как обязательное.
 *
 * Улика, снятая до правки на разобранном исходнике (она же — наружу, через
 * `flang run --args`, см. cli-args.test.mjs):
 *
 *   пример «Без комментария»: аргумент «а»: не задано поле «комментарий»
 *   записи «Анкета»
 *
 * Отказ на значении, которое объявлению не противоречит ничем.
 */
test("исходник flang: «иногда является» не требуется, но и не принимает ложь", () => {
  const источник = (значение) => `модуль «Анкета»

объект «Анкета»
  сумма является числом
  комментарий иногда является строкой

тотальная функция «Сумма анкеты»
  принимает а: «Анкета»
  возвращает число
  пример «Пример»
    дано а равно ${значение}
    ожидается 10
  а.сумма
`
  const разбор = (значение) => checkTypes(parse(источник(значение)))

  // Необязательного поля нет — принимается.
  assert.deepEqual(разбор("запись «Анкета» с сумма равным 10").diagnostics, [])
  // Оно же явным «ничто» — принимается.
  assert.deepEqual(разбор("запись «Анкета» с сумма равным 10 и комментарий равным ничто").diagnostics, [])
  // Оно же со значением своего типа — принимается.
  assert.deepEqual(разбор("запись «Анкета» с сумма равным 10 и комментарий равным \"ок\"").diagnostics, [])

  // «Можно не задавать» не значит «можно соврать»: тип поля проверяется.
  const ложь = разбор("запись «Анкета» с сумма равным 10 и комментарий равным 5")
  assert.deepEqual(коды(ложь), ["FLANG_TYPE"])
  assert.match(ложь.diagnostics[0].message, /комментарий.*строк/u)

  // Обязательное поле без значения — по-прежнему отказ.
  const без = разбор("запись «Анкета» с комментарий равным \"ок\"")
  assert.ok(коды(без).includes("FLANG_TYPE"))
  assert.ok(
    без.diagnostics.some((беда) => /требует поле «сумма»|не задано поле «сумма»/u.test(беда.message)),
    `обязательное поле обязано требоваться: ${без.diagnostics.map((беда) => беда.message).join("; ")}`,
  )
})

test("исходник flang: «иногда является» не открывает запись для лишних полей", () => {
  /* Отвергать лишнее поле записи — поведение отдельное от необязательности, и
     оно обязано пережить правку: «поля может не быть» не равно «полей может
     быть сколько угодно». */
  const источник = `модуль «Анкета»

объект «Анкета»
  сумма является числом
  комментарий иногда является строкой

тотальная функция «Сумма анкеты»
  принимает а: «Анкета»
  возвращает число
  а.сумма
`
  const программа = parse(источник)
  assert.deepEqual(checkTypes(программа).diagnostics, [])

  const дверь = checkArguments(программа, "Сумма анкеты", { а: { сумма: 10 } })
  assert.equal(дверь.ok, true, "необязательное поле можно не задавать и на границе входа")

  const лишнее = checkArguments(программа, "Сумма анкеты", { а: { сумма: 10, привет: 1 } })
  assert.equal(лишнее.ok, false)
  assert.equal(лишнее.diagnostics[0].code, "FLANG_TYPE")
  assert.match(лишнее.diagnostics[0].message, /запись «Анкета» не имеет поля «привет»/u)
})

test("необязательный аргумент можно не задавать в примере, обязательный — нельзя", () => {
  const модель = (тип) => программа([], [
    функция({
      name: "Показать",
      params: [{ name: "н", type: число }, { name: "подпись", type: тип }],
      returns: число,
      body: пер("н"),
      examples: [{ name: "без подписи", args: { н: 1 }, expected: 1 }],
    }),
  ])
  assert.deepEqual(checkTypes(модель({ kind: "string", optional: true })).diagnostics, [])
  assert.deepEqual(коды(checkTypes(модель(строка))), ["FLANG_TYPE"])
})

/* ---- сквозной прогон через парсер ---------------------------------- */

test("исходник flang: парсер → проверка типов, чистая программа", () => {
  const source = `модуль «Счёт»

объект «Позиция»
  цена: число
  название: строка

тип «Токен»
  вариант Слово содержит текст: строка
  вариант Конец

тотальная функция «Длина»
  принимает элементы: список числа
  возвращает число
  разбор элементы
    случай пусто
      то 0
    случай голова и хвост
      то 1 плюс «Длина» от хвост

функция «Итого»
  принимает позиции: список «Позиция»
  возвращает число
  свёртка позиции начиная с 0 как сумма и поз: сумма плюс поз.цена

функция «Показать»
  принимает т: «Токен»
  возвращает строка
  разбор т
    случай Слово содержит текст как слово
      то слово
    случай Конец
      то "конец"
`
  const result = checkTypes(parse(source))
  assert.deepEqual(result.diagnostics, [])
  assert.deepEqual([...result.types.keys()], ["Длина", "Итого", "Показать"])
})

test("исходник flang: неисчерпывающий разбор ловится на разобранном AST", () => {
  const source = `модуль «Т»

тип «Токен»
  вариант Слово содержит текст: строка
  вариант Число содержит значение: число
  вариант Конец

функция «Показать»
  принимает т: «Токен»
  возвращает строка
  разбор т
    случай Слово содержит текст как слово
      то слово
    случай Конец
      то "конец"
`
  const result = checkTypes(parse(source))
  assert.deepEqual(коды(result), ["FLANG_MATCH_NOT_EXHAUSTIVE"])
  assert.match(result.diagnostics[0].message, /не покрывает «Число»/u)
  assert.deepEqual(result.diagnostics[0].span, { line: 11, column: 3 })
})

test("одноимённые варианты в разных суммах отвергаются: конструктор стал бы неоднозначным", () => {
  const первая = { kind: "sum", name: "А", variants: [{ name: "Пусто", fields: [] }] }
  const вторая = { kind: "sum", name: "Б", variants: [{ name: "Пусто", fields: [] }] }
  const result = checkTypes(программа([первая, вторая], []))
  assert.deepEqual(коды(result), ["FLANG_TYPE"])
  assert.match(result.diagnostics[0].message, /объявлен и в «А», и в «Б»/u)
})

/**
 * `возвращает` обязательна: её пропуск ВЫКЛЮЧАЛ проверку, а не включал вывод.
 *
 * Улика, с которой правка началась, — программа ниже целиком. В ней три ошибки
 * сразу, и `check` не сообщал ни об одной (`valid: true`, ноль диагностик):
 *
 *   1. пример «Сумма» ожидает строку "три", а тело складывает числа;
 *   2. «Плохо» объявлена строкой, а возвращает результат «Сумма» — число;
 *   3. сама «Сумма» не говорит, что возвращает.
 *
 * Механика была такая: `normalizeType(null)` отдаёт джокер, а джокер по
 * `sameType` совместим со всем. Значит у функции без `возвращает` не сверялось
 * ни тело, ни вызовы, ни примеры — «сильная статическая типизация»
 * выключалась пропуском одной строки, и молча.
 *
 * Проверяется поэтому не только сам отказ, но и то, что после дописанной строки
 * `возвращает число` появляются ОСТАЛЬНЫЕ две диагностики: они и есть то, что
 * джокер прятал.
 */
test("функция без «возвращает» — отказ, а не молчаливый джокер", () => {
  const без = `модуль «Т»

тотальная функция «Сумма»
  принимает первый: число, второй: число
  пример «Один и два дают строку»
    дано первый равно 1
    дано второй равно 2
    ожидается "три"
  первый плюс второй

тотальная функция «Плохо»
  возвращает строка
  «Сумма» от 1 и 2
`
  const итог = checkTypes(parse(без))
  assert.ok(
    итог.diagnostics.some((д) => /не объявляет, что возвращает/u.test(д.message)),
    `ожидался отказ про «возвращает», получено ${JSON.stringify(итог.diagnostics)}`,
  )

  /* Обратная сила: с аннотацией джокер уходит и обнажаются обе спрятанные
     ошибки. Без этой половины проверку можно было бы «пройти», просто запретив
     функции без `возвращает` и не починив ничего. */
  const с = без.replace(
    "  принимает первый: число, второй: число\n",
    "  принимает первый: число, второй: число\n  возвращает число\n",
  )
  const итог2 = checkTypes(parse(с))
  assert.ok(
    итог2.diagnostics.some((д) => /не соответствует типу число/u.test(д.message)),
    `пример обязан сверяться: ${JSON.stringify(итог2.diagnostics)}`,
  )
  assert.ok(
    итог2.diagnostics.some((д) => /«Плохо» объявлена как строка/u.test(д.message)),
    `вызов обязан сверяться: ${JSON.stringify(итог2.diagnostics)}`,
  )
  assert.ok(
    итог2.diagnostics.every((д) => !/не объявляет, что возвращает/u.test(д.message)),
    "с аннотацией жалобы на её отсутствие быть не должно",
  )
})

test("джокер, записанный явно, законен: мост из FTS не ломается", () => {
  /* Разница, на которой стоит правка: «сказано, что сказать нечего» — не то же
     самое, что «не сказано ничего». Мост из FTS (`compat.mjs`) переводит имена
     состояний в `{ kind: "unknown" }`, и это маркер доказательства. Отвергай
     здесь и его — и существующие модели перестали бы собираться. */
  const результат = checkTypes(
    программа([], [функция({ name: "Состояние", params: [], returns: { kind: "unknown" }, body: лит(1) })]),
  )
  assert.deepEqual(коды(результат), [], "явный джокер — не пропуск")
})
