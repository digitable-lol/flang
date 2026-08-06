// Тесты встроенных форм flang.
import assert from "node:assert/strict"
import { test } from "node:test"

import {
  BUILTIN_NAMES,
  callBuiltin,
  describeValue,
  FlangError,
  hasBuiltin,
  percentOf,
  typeName,
  valuesEqual,
  variant,
} from "../src/builtins.mjs"

// Помощник: перехватить ошибку (assert.throws её не возвращает).
function перехват(действие) {
  try {
    действие()
  } catch (error) {
    return error
  }
  assert.fail("ожидалась ошибка, но вычисление завершилось успешно")
}

// Помощник: ждём именно диагностику flang с нужным кодом.
function ожидаемКод(код, действие) {
  const error = перехват(действие)
  assert.ok(error instanceof FlangError, `ожидалась FlangError, получено ${error}`)
  assert.equal(error.code, код, `ожидался код ${код}, получен ${error.code}: ${error.message}`)
  assert.equal(error.diagnostics[0].code, код)
  assert.equal(error.diagnostics[0].severity, "error")
  return error
}

const вызов = (имя, ...аргументы) => callBuiltin(имя, аргументы)

// ───────────────────────────── строки ─────────────────────────────

test("длина считает кодовые точки, а не единицы UTF-16", () => {
  assert.equal(вызов("длина", "привет"), 6)
  assert.equal(вызов("длина", ""), 0)
  assert.equal(вызов("длина", "мир🙂"), 4)
  assert.equal(вызов("длина", "ёжик"), 4)
})

test("длина работает и для списка", () => {
  assert.equal(вызов("длина", []), 0)
  assert.equal(вызов("длина", [1, 2, 3]), 3)
})

test("длина отвергает не строку и не список", () => {
  ожидаемКод("FLANG_BUILTIN_ARGS", () => вызов("длина", 42))
  ожидаемКод("FLANG_BUILTIN_ARGS", () => вызов("длина"))
})

test("символ индексируется от единицы и знает кириллицу", () => {
  assert.equal(вызов("символ", 1, "мир"), "м")
  assert.equal(вызов("символ", 3, "мир"), "р")
  assert.equal(вызов("символ", 4, "мир🙂"), "🙂")
})

test("символ за границей строки — ошибка, а не undefined", () => {
  ожидаемКод("FLANG_BUILTIN_ARGS", () => вызов("символ", 0, "мир"))
  ожидаемКод("FLANG_BUILTIN_ARGS", () => вызов("символ", 4, "мир"))
  ожидаемКод("FLANG_BUILTIN_ARGS", () => вызов("символ", 1, ""))
  ожидаемКод("FLANG_BUILTIN_ARGS", () => вызов("символ", 1.5, "мир"))
})

test("символ уважает нулевую базу индексов", () => {
  assert.equal(callBuiltin("символ", [0, "мир"], undefined, { indexBase: 0 }), "м")
  ожидаемКод("FLANG_BUILTIN_ARGS", () => callBuiltin("символ", [3, "мир"], undefined, { indexBase: 0 }))
})

test("подстрока берёт границы включительно", () => {
  assert.equal(вызов("подстрока", "привет", 2, 4), "рив")
  assert.equal(вызов("подстрока", "привет", 1, 6), "привет")
  assert.equal(вызов("подстрока", "привет", 1, 0), "")
  assert.equal(вызов("подстрока", "", 1, 0), "")
})

test("подстрока за границами — ошибка", () => {
  ожидаемКод("FLANG_BUILTIN_ARGS", () => вызов("подстрока", "привет", 0, 3))
  ожидаемКод("FLANG_BUILTIN_ARGS", () => вызов("подстрока", "привет", 2, 7))
  ожидаемКод("FLANG_BUILTIN_ARGS", () => вызов("подстрока", "привет", 4, 2))
})

test("соединить склеивает строки и собирает список через разделитель", () => {
  assert.equal(вызов("соединить", "при", "вет"), "привет")
  assert.equal(вызов("соединить", ["а", "б", "в"], ", "), "а, б, в")
  assert.equal(вызов("соединить", [], ", "), "")
  assert.equal(вызов("соединить", ["один"], ", "), "один")
  ожидаемКод("FLANG_BUILTIN_ARGS", () => вызов("соединить", ["а", 1], ", "))
})

test("разделить по отсутствующему разделителю даёт список из одной строки", () => {
  assert.deepEqual(вызов("разделить", "а,б,в", ","), ["а", "б", "в"])
  assert.deepEqual(вызов("разделить", "абв", ","), ["абв"])
  assert.deepEqual(вызов("разделить", "", ","), [""])
  assert.deepEqual(вызов("разделить", "а,,б", ","), ["а", "", "б"])
  ожидаемКод("FLANG_BUILTIN_ARGS", () => вызов("разделить", "абв", ""))
})

test("содержит работает для строк и для списков", () => {
  assert.equal(вызов("содержит", "привет мир", "вет"), true)
  assert.equal(вызов("содержит", "привет", "Привет"), false)
  assert.equal(вызов("содержит", [1, 2, 3], 2), true)
  assert.equal(вызов("содержит", [1, 2, 3], 4), false)
  assert.equal(вызов("содержит", [["а"], ["б"]], ["б"]), true)
})

test("начинается с сравнивает префикс", () => {
  assert.equal(вызов("начинается с", "привет", "при"), true)
  assert.equal(вызов("начинается с", "привет", "вет"), false)
  assert.equal(вызов("начинается", "привет", ""), true)
})

test("к числу разбирает строго", () => {
  assert.equal(вызов("к числу", "42"), 42)
  assert.equal(вызов("к числу", " -3.5 "), -3.5)
  assert.equal(вызов("к числу", "1e3"), 1000)
  ожидаемКод("FLANG_BUILTIN_ARGS", () => вызов("к числу", ""))
  ожидаемКод("FLANG_BUILTIN_ARGS", () => вызов("к числу", "сорок два"))
  ожидаемКод("FLANG_BUILTIN_ARGS", () => вызов("к числу", "0x10"))
  ожидаемКод("FLANG_BUILTIN_ARGS", () => вызов("к числу", "Infinity"))
  ожидаемКод("FLANG_BUILTIN_ARGS", () => вызов("к числу", "1e400"))
})

test("к строке печатает признак по-русски", () => {
  assert.equal(вызов("к строке", 42), "42")
  assert.equal(вызов("к строке", 0.1), "0.1")
  assert.equal(вызов("к строке", true), "да")
  assert.equal(вызов("к строке", false), "нет")
  assert.equal(вызов("к строке", null), "ничто")
  assert.equal(вызов("к строке", "уже строка"), "уже строка")
  ожидаемКод("FLANG_BUILTIN_ARGS", () => вызов("к строке", [1]))
})

// ───────────────────────────── списки ─────────────────────────────

test("пусто различает пустой и непустой список", () => {
  assert.equal(вызов("пусто", []), true)
  assert.equal(вызов("пусто", [0]), false)
  assert.equal(вызов("пусто", ""), true)
  ожидаемКод("FLANG_BUILTIN_ARGS", () => вызов("пусто", 0))
})

test("голова и хвост требуют непустого списка", () => {
  assert.equal(вызов("голова", [1, 2, 3]), 1)
  assert.deepEqual(вызов("хвост", [1, 2, 3]), [2, 3])
  assert.deepEqual(вызов("хвост", [1]), [])
  ожидаемКод("FLANG_BUILTIN_ARGS", () => вызов("голова", []))
  ожидаемКод("FLANG_BUILTIN_ARGS", () => вызов("хвост", []))
  ожидаемКод("FLANG_BUILTIN_ARGS", () => вызов("голова", "строка"))
})

test("добавить не изменяет исходный список", () => {
  const исходный = [1, 2]
  assert.deepEqual(вызов("добавить", 3, исходный), [1, 2, 3])
  assert.deepEqual(исходный, [1, 2], "значения flang неизменяемы")
  assert.deepEqual(вызов("добавить", "а", []), ["а"])
  assert.deepEqual(вызов("добавить", [1], [[2]]), [[2], [1]])
  ожидаемКод("FLANG_BUILTIN_ARGS", () => вызов("добавить", 1, "не список"))
})

test("вложенные списки сравниваются структурно", () => {
  assert.equal(valuesEqual([[1], [2, [3]]], [[1], [2, [3]]]), true)
  assert.equal(valuesEqual([[1]], [[2]]), false)
  assert.equal(valuesEqual([], []), true)
})

// ───────────────────────────── числа ─────────────────────────────

test("остаток от повторяет оператор JS", () => {
  assert.equal(вызов("остаток от", 7, 3), 1)
  assert.equal(вызов("остаток от", -7, 3), -1)
  assert.equal(вызов("остаток", 7.5, 2), 1.5)
  assert.ok(Number.isNaN(вызов("остаток от", 7, 0)), "деление на ноль даёт NaN, как в JS")
  ожидаемКод("FLANG_BUILTIN_ARGS", () => вызов("остаток от", "7", 3))
})

test("процентов от считает ровно как ядро: (percent / 100) * value", () => {
  // Порядок операций — компатибельная поверхность: сверяем побитово.
  for (const [процент, значение] of [[10, 20000], [5, 20000], [20, 0.1], [3, 1e-7], [7, 1234.56], [33, 1 / 3]]) {
    assert.ok(Object.is(вызов("процентов от", процент, значение), (процент / 100) * значение))
  }
  assert.equal(вызов("процентов", 10, 20000), 2000)
  ожидаемКод("FLANG_BUILTIN_ARGS", () => вызов("процентов от", 10, "20000"))
})

test("percentOf экспортирован и совпадает со встроенной формой", () => {
  assert.ok(Object.is(percentOf(10, 1 / 3), вызов("процентов от", 10, 1 / 3)))
})

// ───────────────────────────── общее ─────────────────────────────

test("неизвестная встроенная форма — FLANG_UNKNOWN_NAME", () => {
  ожидаемКод("FLANG_UNKNOWN_NAME", () => вызов("неведомая форма", 1))
  assert.equal(hasBuiltin("длина"), true)
  assert.equal(hasBuiltin("процентов"), true, "синоним тоже считается известным")
  assert.equal(hasBuiltin("нет такой"), false)
})

test("все встроенные формы из спецификации на месте", () => {
  const обязательные = [
    "длина", "символ", "символы", "подстрока", "соединить", "разделить", "содержит", "начинается с",
    "к числу", "к строке", "пусто", "голова", "хвост", "добавить", "остаток от", "процентов от",
  ]
  for (const имя of обязательные) assert.ok(BUILTIN_NAMES.includes(имя), `нет формы «${имя}»`)
  assert.equal(BUILTIN_NAMES.length, обязательные.length)
})

test("ошибка встроенной формы несёт span узла", () => {
  const span = { line: 7, column: 3 }
  const error = перехват(() => callBuiltin("голова", [[]], span))
  assert.deepEqual(error.span, span)
  assert.deepEqual(error.diagnostics[0].span, span)
})

test("равенство скаляров — как compare() ядра, через Object.is", () => {
  assert.equal(valuesEqual(Number.NaN, Number.NaN), true)
  assert.equal(valuesEqual(0, -0), false)
  assert.equal(valuesEqual(1, "1"), false)
  assert.equal(valuesEqual(null, null), true)
  assert.equal(valuesEqual(null, false), false)
})

test("варианты и записи сравниваются по имени и полям", () => {
  assert.equal(valuesEqual(variant("Слово", { текст: "а" }), variant("Слово", { текст: "а" })), true)
  assert.equal(valuesEqual(variant("Слово", { текст: "а" }), variant("Слово", { текст: "б" })), false)
  assert.equal(valuesEqual(variant("Конец", {}), variant("Слово", {})), false)
  assert.equal(valuesEqual({ цена: 1 }, { цена: 1 }), true)
  assert.equal(valuesEqual({ цена: 1 }, { цена: 1, скидка: 0 }), false)
  assert.equal(valuesEqual(variant("Конец", {}), {}), false)
})

test("typeName и describeValue дают человекочитаемые имена", () => {
  assert.equal(typeName("а"), "строка")
  assert.equal(typeName(1), "число")
  assert.equal(typeName(true), "признак")
  assert.equal(typeName(null), "ничто")
  assert.equal(typeName([]), "список")
  assert.equal(typeName({}), "запись")
  assert.equal(typeName(variant("Конец", {})), "вариант «Конец»")
  assert.equal(describeValue(variant("Слово", { текст: "а" })), "Слово(текст)")
  assert.equal(describeValue([1, 2]), "список из 2")
  assert.equal(describeValue(true), "да")
})

test("сообщение об арности склоняется по-русски", () => {
  const один = перехват(() => вызов("длина"))
  assert.match(один.message, /ожидает 1 аргумент, получено 0/u)
  const два = перехват(() => вызов("символ", 1))
  assert.match(два.message, /ожидает 2 аргумента, получено 1/u)
  const три = перехват(() => вызов("подстрока", "а"))
  assert.match(три.message, /ожидает 3 аргумента, получено 1/u)
})
