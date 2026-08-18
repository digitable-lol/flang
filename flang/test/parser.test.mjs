import assert from "node:assert/strict"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { fileURLToPath } from "node:url"
import test from "node:test"

import { FlangError, parse } from "../src/parser.mjs"

const repository = fileURLToPath(new URL("../../", import.meta.url))

/** Спаны проверяются отдельно; в сравнении форм узлов они только мешают. */
function bare(value) {
  if (Array.isArray(value)) return value.map(bare)
  if (value === null || typeof value !== "object") return value
  const result = {}
  for (const [key, item] of Object.entries(value)) {
    if (key === "span") continue
    result[key] = bare(item)
  }
  return result
}

const program = (source) => bare(parse(source))
const body = (source) => program(source).functions[0].body

/**
 * Функция-обёртка: тело — единственное, что различается между примерами.
 * Параметры объявлены заранее, потому что имена в теле обязаны быть связаны
 * (SPEC, раздел 4: «Имена и падежи»).
 */
const PARAMS = [
  "элементы: список числа",
  "позиции: список «Позиция»",
  "позиция: «Позиция»",
  "хвост: список числа",
  "имя: строка",
  "сумма: число",
  "x: число",
  "a: число",
  "b: число",
].join(", ")

const wrap = (expression, returns = "число", params = PARAMS) =>
  `функция «Ф»\n  принимает ${params}\n  возвращает ${returns}\n  ${expression}\n`

function parseError(source) {
  try {
    parse(source)
  } catch (error) {
    assert.ok(error instanceof FlangError, `ожидалась FlangError, получено ${error}`)
    return error.diagnostics[0]
  }
  return assert.fail(`ожидалась ошибка разбора для:\n${source}`)
}

function ftsFiles(directory) {
  const found = []
  for (const entry of readdirSync(directory)) {
    const full = `${directory}/${entry}`
    if (statSync(full).isDirectory()) found.push(...ftsFiles(full))
    else if (entry.endsWith(".fts")) found.push(full)
  }
  return found.sort()
}

// ── форма программы ─────────────────────────────────────────────────────────

test("программа выдаёт контракт из SPEC, раздел 5", () => {
  const result = program("объект «Позиция»\n  цена является числом\n")
  assert.deepEqual(Object.keys(result), ["flang", "module", "types", "functions"])
  assert.equal(result.flang, 1)
})

test("категория задаёт имя модуля", () => {
  assert.equal(program("категория «Продажи»\n  объект X\n    цена является числом\n").module, "Продажи")
})

// ── объявления типов ────────────────────────────────────────────────────────

test("узел types: record", () => {
  const result = program("объект «Позиция»\n  цена является числом\n  «срок оплаты» иногда является датой\n")
  assert.deepEqual(result.types[0], {
    kind: "record",
    name: "Позиция",
    fields: [
      { name: "цена", type: { kind: "number" }, fts: "Число" },
      { name: "срок оплаты", type: { kind: "string", fts: "Дата" }, fts: "Дата | undefined", optional: true },
    ],
  })
})

test("узел types: sum", () => {
  const result = program(
    "тип «Токен»\n  вариант Слово содержит текст: строка\n  вариант Число содержит значение: число\n  вариант Конец\n",
  )
  assert.deepEqual(result.types[0], {
    kind: "sum",
    name: "Токен",
    variants: [
      { name: "Слово", fields: [{ name: "текст", type: { kind: "string" } }] },
      { name: "Число", fields: [{ name: "значение", type: { kind: "number" } }] },
      { name: "Конец", fields: [] },
    ],
  })
})

test("узел types: alias для коллекции", () => {
  assert.deepEqual(program("тип «Строка счёта» это список «Позиция»\n").types[0], {
    kind: "alias",
    name: "Строка счёта",
    of: { kind: "list", of: { kind: "named", name: "Позиция" } },
  })
})

test("вложенный объект остаётся полем-ссылкой", () => {
  const result = program("объект Заказ\n  вложен объект «Адрес доставки»\n")
  assert.deepEqual(result.types[0].fields, [
    { name: "Адрес доставки", type: { kind: "named", name: "Адрес доставки" }, fts: "Адрес доставки" },
  ])
})

test("состояние FTS читается как именованный тип", () => {
  const result = program("объект Заказ\n  «готов к отгрузке» является состоянием «Готов к отгрузке»\n")
  assert.deepEqual(result.types[0].fields[0].type, { kind: "named", name: "Готов к отгрузке", state: true })
})

// ── функции ─────────────────────────────────────────────────────────────────

test("функция несёт total, params, returns, body и examples", () => {
  const source = [
    "тотальная функция «Длина»",
    "  принимает элементы: список числа",
    "  возвращает число",
    "  пример «Два элемента»",
    "    дано элементы равно [1, 2]",
    "    ожидается 2",
    "  разбор элементов",
    "    случай пусто",
    "      то 0",
    "    случай голова и хвост",
    "      то 1 плюс «Длина» от хвоста",
    "",
  ].join("\n")
  const declared = program(source).functions[0]
  assert.deepEqual(declared.body.target, { kind: "var", name: "элементы" })
  assert.equal(declared.name, "Длина")
  assert.equal(declared.total, true)
  assert.deepEqual(declared.params, [{ name: "элементы", type: { kind: "list", of: { kind: "number" } } }])
  assert.deepEqual(declared.returns, { kind: "number" })
  assert.deepEqual(declared.examples, [{ name: "Два элемента", args: { элементы: [1, 2] }, expected: 2 }])
  assert.equal(declared.body.kind, "match")
})

test("несколько параметров пишутся через запятую или отдельными строками", () => {
  const commas = program("функция «Ф»\n  принимает a: число, b: строка\n  возвращает число\n  a\n")
  const lines = program("функция «Ф»\n  принимает a: число\n  принимает b: строка\n  возвращает число\n  a\n")
  assert.deepEqual(commas.functions[0].params, lines.functions[0].params)
  assert.equal(commas.functions[0].params.length, 2)
})

test("обычная функция не тотальна", () => {
  assert.equal(program(wrap("1")).functions[0].total, false)
})

// ── выражения: по узлу на каждый вид ────────────────────────────────────────

test("узел literal", () => {
  assert.deepEqual(body(wrap("42")), { kind: "literal", value: 42 })
  assert.deepEqual(body(wrap('"текст"', "строка")), { kind: "literal", value: "текст" })
  assert.deepEqual(body(wrap("да", "признак")), { kind: "literal", value: true })
  assert.deepEqual(body(wrap("нет", "признак")), { kind: "literal", value: false })
  assert.deepEqual(body(wrap("ничто", "ничто")), { kind: "literal", value: null })
})

test("узел var", () => {
  assert.deepEqual(body(wrap("элементы")), { kind: "var", name: "элементы" })
})

test("узел field", () => {
  assert.deepEqual(body(wrap("позиция.цена")), {
    kind: "field",
    target: { kind: "var", name: "позиция" },
    field: "цена",
  })
  assert.deepEqual(body(wrap("поле «цена» у позиция")), {
    kind: "field",
    target: { kind: "var", name: "позиция" },
    field: "цена",
  })
})

test("узел let", () => {
  assert.deepEqual(body("функция «Ф»\n  возвращает число\n  пусть x равно 1\n  x плюс 2\n"), {
    kind: "let",
    name: "x",
    value: { kind: "literal", value: 1 },
    in: {
      kind: "binary",
      op: "add",
      left: { kind: "var", name: "x" },
      right: { kind: "literal", value: 2 },
    },
  })
})

test("узел if — в строку и отступным блоком", () => {
  const inline = body(wrap("если x больше 0 то 1 иначе 2"))
  const block = body(wrap("если x больше 0\n    то 1\n    иначе 2"))
  assert.deepEqual(inline, block)
  assert.equal(inline.kind, "if")
  assert.deepEqual(inline.then, { kind: "literal", value: 1 })
  assert.deepEqual(inline.else, { kind: "literal", value: 2 })
})

test("узел call", () => {
  assert.deepEqual(body(wrap("«Длина» от хвоста")), {
    kind: "call",
    name: "Длина",
    args: [{ kind: "var", name: "хвост" }],
  })
  assert.equal(body(wrap("«Сумма» от a и b")).args.length, 2)
})

test("узел binary: арифметика и сравнения", () => {
  const operators = [
    ["1 плюс 2", "add"],
    ["1 минус 2", "sub"],
    ["1 умножить на 2", "mul"],
    ["1 делить на 2", "div"],
    ["1 остаток от 2", "mod"],
    ["10 процентов от сумма", "percent"],
    ["1 равен 2", "eq"],
    ["1 не равен 2", "neq"],
    ["1 больше 2", "gt"],
    ["1 меньше 2", "lt"],
    ["1 не меньше 2", "gte"],
    ["1 не больше 2", "lte"],
  ]
  for (const [source, op] of operators) {
    const node = body(wrap(source))
    assert.equal(node.kind, "binary", source)
    assert.equal(node.op, op, source)
  }
  assert.equal(body(wrap("соединить a с b", "строка")).op, "concat")
})

test("умножение связывает сильнее сложения", () => {
  const node = body(wrap("1 плюс 2 умножить на 3"))
  assert.equal(node.op, "add")
  assert.equal(node.right.op, "mul")
})

test("узел construct", () => {
  const explicit = body(wrap('вариант Слово с текст равным "a"', "«Токен»"))
  const short = body(wrap('Слово с текст равным "a"', "«Токен»"))
  assert.deepEqual(explicit, short)
  assert.deepEqual(explicit, { kind: "construct", variant: "Слово", fields: { текст: { kind: "literal", value: "a" } } })
  assert.deepEqual(body(wrap("вариант Конец", "«Токен»")), { kind: "construct", variant: "Конец", fields: {} })
})

test("узел record", () => {
  assert.deepEqual(body(wrap("запись «Позиция» с цена равным 10", "«Позиция»")), {
    kind: "record",
    type: "Позиция",
    fields: { цена: { kind: "literal", value: 10 } },
  })
})

test("узел list", () => {
  const brackets = body(wrap("[1, 2]", "список числа"))
  const words = body(wrap("список из 1, 2", "список числа"))
  assert.deepEqual(brackets, words)
  assert.deepEqual(brackets, { kind: "list", items: [{ kind: "literal", value: 1 }, { kind: "literal", value: 2 }] })
  assert.deepEqual(body(wrap("пустой список", "список числа")), { kind: "list", items: [] })
})

test("узел match со всеми видами образцов", () => {
  const source = [
    "функция «Ф»",
    "  принимает т: «Токен»",
    "  возвращает число",
    "  разбор т",
    "    случай пусто",
    "      то 0",
    "    случай голова и хвост",
    "      то 1",
    "    случай голова г и хвост х",
    "      то 2",
    "    случай вариант Слово с текст как т",
    "      то 3",
    "    случай 5",
    "      то 4",
    "    случай любое остальное",
    "      то 5",
    "",
  ].join("\n")
  const node = body(source)
  assert.equal(node.kind, "match")
  assert.deepEqual(
    node.cases.map((item) => item.pattern),
    [
      { kind: "empty" },
      { kind: "cons", head: "голова", tail: "хвост" },
      { kind: "cons", head: "г", tail: "х" },
      { kind: "variant", name: "Слово", bind: { текст: "т" } },
      { kind: "literal", value: 5 },
      { kind: "any", bind: "остальное" },
    ],
  )
})

test("образец с именем со строчной буквы связывает, с прописной — вариант", () => {
  const node = body(
    "функция «Ф»\n  принимает т: «Токен»\n  возвращает число\n  разбор т\n    случай Конец\n      то 0\n    случай прочее\n      то 1\n",
  )
  assert.deepEqual(node.cases[0].pattern, { kind: "variant", name: "Конец", bind: {} })
  assert.deepEqual(node.cases[1].pattern, { kind: "any", bind: "прочее" })
})

test("узел fold", () => {
  assert.deepEqual(body(wrap("свёртка позиции начиная с 0 как сумма и поз → сумма плюс поз.цена")), {
    kind: "fold",
    over: { kind: "var", name: "позиции" },
    init: { kind: "literal", value: 0 },
    acc: "сумма",
    item: "поз",
    body: {
      kind: "binary",
      op: "add",
      left: { kind: "var", name: "сумма" },
      right: { kind: "field", target: { kind: "var", name: "поз" }, field: "цена" },
    },
  })
})

test("узел map", () => {
  assert.deepEqual(body(wrap("отобразить позиции как поз → поз.цена", "список числа")), {
    kind: "map",
    over: { kind: "var", name: "позиции" },
    item: "поз",
    body: { kind: "field", target: { kind: "var", name: "поз" }, field: "цена" },
  })
})

test("узел filter", () => {
  const node = body(wrap("отфильтровать позиции где поз → поз.цена больше 0", "список «Позиция»"))
  assert.equal(node.kind, "filter")
  assert.equal(node.item, "поз")
  assert.equal(node.body.op, "gt")
})

test("тело встроенной формы можно писать отступным блоком", () => {
  const inline = body(wrap("отобразить позиции как поз → поз.цена", "список числа"))
  const block = body(wrap("отобразить позиции как поз\n    поз.цена", "список числа"))
  assert.deepEqual(inline, block)
})

test("узел builtin: строки и списки", () => {
  const cases = [
    ['длина имя', "длина", 1],
    ['символ 0 в имя', "символ", 2],
    ['подстрока имя с 1 по 3', "подстрока", 3],
    ['разделить имя по ","', "разделить", 2],
    ['имя содержит "а"', "содержит", 2],
    ['имя начинается с "а"', "начинается с", 2],
    ['к числу имя', "к числу", 1],
    ['к строке имя', "к строке", 1],
    ["голова элементы", "голова", 1],
    ["хвост элементы", "хвост", 1],
    ["добавить 1 к элементы", "добавить", 2],
    ["приписать 1 к элементы", "приписать", 2],
  ]
  for (const [source, name, arity] of cases) {
    const node = body(wrap(source, "строка"))
    assert.equal(node.kind, "builtin", source)
    assert.equal(node.name, name, source)
    assert.equal(node.args.length, arity, source)
  }
})

test("голова и хвост без аргумента — это имена, связанные образцом", () => {
  const node = body(wrap("разбор элементы\n    случай голова и хвост\n      то голова"))
  assert.deepEqual(node.cases[0].body, { kind: "var", name: "голова" })
})

/**
 * «соединить» — две формы, как в `builtins.mjs`: склейка двух строк и список с
 * разделителем. Предлог «по» у списочной формы тот же, что у обратной операции
 * «разделить текст по разделителю», поэтому пара читается как пара. До его
 * появления списочная форма существовала в трёх исполнителях сразу, а пути к
 * ней из грамматики не было.
 */
test("«соединить X с Y» — склейка строк, «соединить X по Y» — список с разделителем", () => {
  const склейка = body(wrap('соединить имя с "!"', "строка"))
  assert.equal(склейка.kind, "binary")
  assert.equal(склейка.op, "concat")

  const список = body(wrap('соединить элементы по ", "', "строка"))
  assert.equal(список.kind, "builtin")
  assert.equal(список.name, "соединить")
  assert.equal(список.args.length, 2)

  assert.deepEqual(body(wrap('join элементы by ", "', "строка")), список)
})

/**
 * «пусто» — два слова в одной поверхности: литерал пустого списка и встроенная
 * проверка пустоты. Различаются наличием аргумента, ровно как у одноместных
 * форм вроде «длина». Без этого проверка пустоты была недостижима и её
 * приходилось писать как «(длина x) равен 0».
 */
test("«пусто X» — проверка пустоты, «пусто» без аргумента — пустой список", () => {
  const проверка = body(wrap("пусто элементы", "признак"))
  assert.deepEqual(проверка, { kind: "builtin", name: "пусто", args: [{ kind: "var", name: "элементы" }] })

  assert.deepEqual(body(wrap("пусто", "список числа")), { kind: "list", items: [] })
  assert.deepEqual(body(wrap("пустой список", "список числа")), { kind: "list", items: [] })
  /* «пустой список» однозначен всегда: за ним может стоять что угодно. */
  assert.deepEqual(body(wrap("пустой список", "список числа")), body(wrap("пусто", "список числа")))
})

test("«пусто» в образце по-прежнему разбирает пустой список", () => {
  const node = body(wrap("разбор элементы\n    случай пусто\n      то 0\n    случай голова и хвост\n      то голова"))
  assert.deepEqual(node.cases[0].pattern, { kind: "empty" })
})

/**
 * Применение функции без аргументов. Отдельного слова для него не нужно: имя
 * функции в позиции выражения и означает её применение, потому что функции в
 * flang не являются значениями (SPEC, раздел 3) и означать что-либо другое имя
 * функции не может. Раньше такое имя читалось как `var` и упиралось в «имя не
 * связано»: функцию без параметров нельзя было вызвать вовсе.
 */
test("имя объявленной функции без аргументов — вызов, в том числе вперёд по файлу", () => {
  const result = program('функция «Дважды»\n  возвращает число\n  «Пи» плюс «Пи»\n\nфункция «Пи»\n  возвращает число\n  3\n')
  const левый = result.functions[0].body.left
  assert.deepEqual(левый, { kind: "call", name: "Пи", args: [] })
  assert.deepEqual(Object.keys(parse('функция «Пи»\n  возвращает число\n  3\n\nфункция «Д»\n  возвращает число\n  «Пи»\n').functions[1].body), ["kind", "name", "args", "span"])
})

test("имя без объявленной функции остаётся именем: разрешает его проверка типов", () => {
  assert.deepEqual(body('функция «Ф»\n  возвращает число\n  «Питон»\n', ""), { kind: "var", name: "Питон" })
})

test("локальное имя не превращается в вызов одноимённой функции", () => {
  const result = program('функция «Предел»\n  возвращает число\n  10\n\nфункция «Ф»\n  принимает Предел: число\n  возвращает число\n  Предел\n')
  assert.deepEqual(result.functions[1].body, { kind: "var", name: "Предел" })
})

/**
 * Значение примера: конструктор варианта разворачивается в { variant, fields } —
 * ту самую запись значения в JSON, которую печатает `JSON.stringify` над
 * `FlangVariant` и читает `reifyValue`. Раньше здесь получалась запись из полей
 * варианта, а его имя терялось: пример нельзя было написать ни функции,
 * принимающей сумму типов, ни функции, её возвращающей.
 */
test("значение примера: конструктор варианта сохраняет имя варианта", () => {
  const source = `тип «Число или ничто»
  вариант «Есть число» содержит значение: число
  вариант «Нет числа»

функция «Обернуть»
  принимает значение: число
  возвращает «Число или ничто»
  пример «Семь»
    дано значение равно 7
    ожидается вариант «Есть число» с значение равным 7
  пример «Ничего»
    дано значение равно 0
    ожидается вариант «Нет числа»
  вариант «Есть число» с значение равным значение
`
  const [первый, второй] = program(source).functions[0].examples
  assert.deepEqual(первый.expected, { variant: "Есть число", fields: { значение: 7 } })
  assert.deepEqual(второй.expected, { variant: "Нет числа", fields: {} })
})

test("значение примера: запись остаётся записью, список — списком", () => {
  const source = `объект «Точка»
  х является числом

функция «Сдвиг»
  принимает х: число
  возвращает «Точка»
  пример «Единица»
    дано х равно 1
    ожидается запись «Точка» с х равным 1
  запись «Точка» с х равным х
`
  assert.deepEqual(program(source).functions[0].examples[0].expected, { х: 1 })
  const списком = `функция «Пара»
  принимает х: число
  возвращает список числа
  пример «Два»
    дано х равно 1
    ожидается [1, 2]
  список из х, 2
`
  assert.deepEqual(program(списком).functions[0].examples[0].expected, [1, 2])
})

/**
 * Список из нескольких конструкторов: у запятой один смысл, у `и` — другой.
 *
 * Запятая разделяла и поля конструктора, и элементы списочного литерала, и
 * `[вариант «М» с а равным 1, б равен 2]` читалось двояко: один конструктор с
 * двумя полями — или два элемента, конструктор и сравнение. `равным` и `равен`
 * — один токен, различить чтения нечем, и разбор выбирал первое догадкой.
 *
 * Теперь запятая поля закрывает всегда, а продолжает их только `и`. Оба чтения
 * записываются, ни одно не угадывается. Проверяются обе стороны: и то, что `и`
 * поля ПРОДОЛЖАЕТ (иначе правило прошло бы и на грамматике без разделителя
 * полей вовсе), и то, что запятая их ЗАКРЫВАЕТ.
 */
test("запятая закрывает поля конструктора, `и` их продолжает", () => {
  const без = (узел) => JSON.parse(JSON.stringify(узел, (ключ, значение) => (ключ === "span" ? undefined : значение)))

  /* Разделитель элементов: и запятая, и `и` дают список из двух конструкторов,
     потому что за ними стоит не `имя равным`, а слово `вариант`. */
  for (const разделитель of [",", " и"]) {
    const узел = без(
      body(`функция «Ф»\n  возвращает число\n  [вариант «М» с имя равным "а"${разделитель} вариант «М» с имя равным "б"]\n`),
    )
    assert.equal(узел.kind, "list", `разделитель «${разделитель}»`)
    assert.equal(узел.items.length, 2, `разделитель «${разделитель}»`)
    assert.deepEqual(узел.items[0].fields.имя, { kind: "literal", value: "а" })
    assert.deepEqual(узел.items[1].fields.имя, { kind: "literal", value: "б" })
    assert.deepEqual([узел.items[0].variant, узел.items[1].variant], ["М", "М"])
  }

  /* Спорное место. Раньше обе записи давали ОДИН конструктор с двумя полями, и
     второго чтения не существовало. Теперь их два, и выбирает их автор. */
  const голова = "функция «Ф»\n  принимает год: число\n  возвращает число\n  "
  const слитно = без(body(`${голова}[вариант «М» с имя равным "а" и год равным 2026]\n`))
  assert.equal(слитно.items.length, 1)
  assert.deepEqual(Object.keys(слитно.items[0].fields), ["имя", "год"])

  const раздельно = без(body(`${голова}[вариант «М» с имя равным "а", год равным 2026]\n`))
  assert.equal(раздельно.items.length, 2)
  assert.deepEqual(Object.keys(раздельно.items[0].fields), ["имя"])
  assert.deepEqual(раздельно.items[1], {
    kind: "binary",
    op: "eq",
    left: { kind: "var", name: "год" },
    right: { kind: "literal", value: 2026 },
  })

  /* Вне списка запятая после значения поля больше не съедается никем — и это
     ОТКАЗ, а не другой разбор: молча сменить смысл написанному нечем. */
  assert.throws(
    () => body('функция «Ф»\n  возвращает «О»\n  вариант «О» с код равным 400, тело равным "нет"\n'),
    (беда) => беда.diagnostics?.[0]?.code === "FLANG_PARSE",
  )

  /* И в примере — ровно та запись, ради которой всё это делалось. */
  const пример = program(
    'тип «М»\n  вариант «М» содержит имя: строка\n\nфункция «Сколько»\n  принимает метки: список «М»\n' +
      '  возвращает число\n  пример «Две»\n    дано метки равно [вариант «М» с имя равным "а", вариант «М» с имя равным "б"]\n' +
      "    ожидается 2\n  свёртка метки начиная с 0 как сколько и м → сколько плюс 1\n",
  )
  assert.deepEqual(пример.functions[0].examples[0].args.метки, [
    { variant: "М", fields: { имя: "а" } },
    { variant: "М", fields: { имя: "б" } },
  ])
})

/**
 * Тот же разбор, но для конструктора-ЗАПИСИ: правило одно на оба конструктора,
 * потому что присвоения полей у них разбирает одна и та же форма.
 */
test("у записи запятая тоже закрывает поля", () => {
  const без = (узел) => JSON.parse(JSON.stringify(узел, (ключ, значение) => (ключ === "span" ? undefined : значение)))
  const голова = "функция «Ф»\n  принимает игрек: число\n  возвращает число\n  "
  const слитно = без(body(`${голова}[запись «Т» с х равным 1 и игрек равным 2]\n`))
  assert.equal(слитно.items.length, 1)
  assert.deepEqual(Object.keys(слитно.items[0].fields), ["х", "игрек"])

  const раздельно = без(body(`${голова}[запись «Т» с х равным 1, игрек равным 2]\n`))
  assert.equal(раздельно.items.length, 2)
  assert.equal(раздельно.items[0].kind, "record")
  assert.equal(раздельно.items[1].op, "eq")
})

// ── имена и падежи (SPEC, раздел 4) ─────────────────────────────────────────

test("падежная форма параметра связывается и кладёт в AST каноническое имя", () => {
  const node = body("функция «Ф»\n  принимает элементы: список числа\n  возвращает число\n  длина элементов\n")
  assert.deepEqual(node.args[0], { kind: "var", name: "элементы" })
})

test("падежная форма привязки образца связывается с канонической", () => {
  const node = body(wrap("разбор элементы\n    случай голова и хвост\n      то «Длина» от хвоста"))
  assert.deepEqual(node.cases[0].body.args[0], { kind: "var", name: "хвост" })
})

test("точное совпадение всегда важнее сопоставления по основе", () => {
  const node = body("функция «Ф»\n  принимает сумма: число, сумм: число\n  возвращает число\n  сумма\n")
  assert.deepEqual(node, { kind: "var", name: "сумма" })
})

test("две локальные основы совпали — FLANG_AMBIGUOUS_NAME со списком кандидатов", () => {
  const source = "функция «Ф»\n  принимает элемент: число, элементы: список числа\n  возвращает число\n  элементов\n"
  const diagnostic = parseError(source)
  assert.equal(diagnostic.code, "FLANG_AMBIGUOUS_NAME")
  assert.match(diagnostic.message, /«элемент»/u)
  assert.match(diagnostic.message, /«элементы»/u)
  assert.deepEqual(diagnostic.span, { line: 4, column: 3 })
})

test("несвязанное имя — FLANG_UNKNOWN_NAME со своим местом", () => {
  const diagnostic = parseError("функция «Ф»\n  принимает элементы: список числа\n  возвращает число\n  цена\n")
  assert.equal(diagnostic.code, "FLANG_UNKNOWN_NAME")
  assert.deepEqual(diagnostic.span, { line: 4, column: 3 })
})

test("имя функции не склоняется — берётся точно как написано", () => {
  const node = body(wrap("«Длины» от хвоста"))
  assert.equal(node.kind, "call")
  assert.equal(node.name, "Длины")
})

test("имя поля записи не склоняется — берётся точно как написано", () => {
  assert.equal(body(wrap("позиция.цены")).field, "цены")
  assert.equal(body(wrap("поле «цены» у позиция")).field, "цены")
})

test("правило падежей не действует на локальные имена вне области видимости", () => {
  const node = body(wrap("отобразить позиции как поз → поз.цена", "список числа"))
  assert.equal(node.body.target.name, "поз")
})

test("английская поверхность склонений не знает: item и items — разные имена", () => {
  const bound = body('function "F"\n  accepts items: list of number\n  returns number\n  length items\n')
  assert.deepEqual(bound.args[0], { kind: "var", name: "items" })
  const diagnostic = parseError('function "F"\n  accepts item: number\n  returns number\n  items\n')
  assert.equal(diagnostic.code, "FLANG_UNKNOWN_NAME")
})

// ── английская поверхность ──────────────────────────────────────────────────

test("английские ключевые слова дают тот же AST, что русские", () => {
  const russian = [
    "тотальная функция «Длина»",
    "  принимает элементы: список числа",
    "  возвращает число",
    "  разбор элементы",
    "    случай пусто",
    "      то 0",
    "    случай голова г и хвост х",
    "      то 1 плюс «Длина» от х",
    "",
  ].join("\n")
  const english = [
    'total function "Длина"',
    "  accepts элементы: list of number",
    "  returns number",
    "  match элементы",
    "    case empty",
    "      then 0",
    "    case head г and tail х",
    '      then 1 plus "Длина" of х',
    "",
  ].join("\n")
  assert.deepEqual(program(english), program(russian))
})

test("английская и русская запись объекта совпадают", () => {
  const russian = program("объект «Покупка»\n  сумма является деньгами\n  «клиент» иногда является строкой\n")
  const english = program('object "Покупка"\n  сумма is money\n  "клиент" may be string\n')
  assert.deepEqual(english, russian)
})

test("английские встроенные формы совпадают с русскими", () => {
  const russian = body(wrap("свёртка xs начиная с 0 как acc и it → acc плюс it", "число", "xs: список числа"))
  const english = body(
    'function "Ф"\n  accepts xs: list of number\n  returns number\n  fold xs starting with 0 as acc and it -> acc plus it\n',
  )
  assert.deepEqual(english, russian)
})

// ── диагностика ─────────────────────────────────────────────────────────────

test("недоразобранная конструкция даёт FLANG_PARSE с точным span", () => {
  const diagnostic = parseError("объект «Позиция»\n  цена 42\n")
  assert.equal(diagnostic.code, "FLANG_PARSE")
  assert.equal(diagnostic.severity, "error")
  assert.deepEqual(diagnostic.span, { line: 2, column: 8 })
})

test("незнакомое объявление не проходит молча", () => {
  const diagnostic = parseError("непонятно «Что-то»\n")
  assert.equal(diagnostic.code, "FLANG_PARSE")
  assert.deepEqual(diagnostic.span, { line: 1, column: 1 })
})

test("'если' без 'иначе' — ошибка с местом", () => {
  const diagnostic = parseError(wrap("если x больше 0 то 1"))
  assert.equal(diagnostic.code, "FLANG_PARSE")
  assert.match(diagnostic.message, /иначе/u)
  assert.ok(diagnostic.span.line >= 3, `место ошибки: ${JSON.stringify(diagnostic.span)}`)
})

test("'разбор' без единого 'случай' — ошибка", () => {
  assert.equal(parseError(wrap("разбор x")).code, "FLANG_PARSE")
})

test("функция без тела — ошибка с местом объявления", () => {
  const diagnostic = parseError("функция «Ф»\n  возвращает число\n")
  assert.match(diagnostic.message, /не содержит тела/u)
  assert.deepEqual(diagnostic.span, { line: 1, column: 1 })
})

test("пример без 'ожидается' — ошибка", () => {
  const source = "функция «Ф»\n  возвращает число\n  пример «П»\n    дано x равно 1\n  1\n"
  assert.match(parseError(source).message, /ожидается/u)
})

test("лексическая ошибка приходит с кодом FLANG_LEX", () => {
  const diagnostic = parseError("объект X\n    цена является числом\n  вес является числом\n")
  assert.equal(diagnostic.code, "FLANG_LEX")
})

// ── наследие FTS ────────────────────────────────────────────────────────────

test("утилита сохраняется узлом ftsLegacy в форме модели ядра", () => {
  const source = [
    "категория «Продажи»",
    "  объект Покупка",
    "    сумма является деньгами",
    "  утилита «Рассчитать скидку»",
    "    принимает Покупка",
    "    возвращает деньги",
    "    начинает с 0",
    "    правило «Большая покупка»",
    "      если сумма не меньше 10000",
    "      то добавить 10 процентов от поля сумма",
    "    свойство «Скидка неотрицательна»",
    "      результат не меньше 0",
    "    пример «Обычная покупка»",
    "      дано сумма равна 5000",
    "      ожидается результат равен 0",
    "",
  ].join("\n")
  const utility = program(source).legacy.find((node) => node.construct === "utility")
  assert.equal(utility.kind, "ftsLegacy")
  assert.deepEqual(utility.value, {
    name: "Рассчитать скидку",
    input: "Покупка",
    output: "Деньги",
    initial: 0,
    rules: [
      {
        name: "Большая покупка",
        when: [{ field: "сумма", operator: "gte", value: { kind: "value", value: 10000 } }],
        action: { kind: "add", value: { kind: "percent", percent: 10, field: "сумма" } },
      },
    ],
    properties: [{ name: "Скидка неотрицательна", operator: "gte", value: { kind: "value", value: 0 } }],
    examples: [{ name: "Обычная покупка", input: { сумма: 5000 }, expected: 0 }],
  })
})

test("морфизм и теорема сохраняются узлами ftsLegacy", () => {
  const source = [
    "категория «Исполнение заказа»",
    "  объект Заказ",
    "    номер является строкой",
    "  морфизм «Готовый заказ можно отгрузить»",
    "    если «Готов к отгрузке»",
    "    то «Отгрузить заказ разрешено»",
    "  теорема «Заказ ЗК-7781 можно отгрузить»",
    "    дано Заказ имеет «готов к отгрузке» равное да",
    "    в данных заказы найти где номер равен «ЗК-7781»",
    "    по морфизму «Готовый заказ можно отгрузить»",
    "    следовательно «Отгрузить заказ разрешено»",
    "",
  ].join("\n")
  const result = program(source)
  const morphism = result.legacy.find((node) => node.construct === "morphism")
  assert.deepEqual(morphism.value, {
    name: "Готовый заказ можно отгрузить",
    domain: "Готов к отгрузке",
    codomain: "Отгрузить заказ разрешено",
    law: "morphism.declared",
  })
  const theorem = result.legacy.find((node) => node.construct === "theorem")
  assert.equal(theorem.value.structure, "Заказ")
  assert.equal(theorem.value.field, "готов к отгрузке")
  assert.equal(theorem.value.expected, true)
  assert.equal(theorem.value.collection, "заказы")
  assert.deepEqual(theorem.value.morphisms, ["Готовый заказ можно отгрузить"])
  assert.equal(theorem.value.conclusion, "Отгрузить заказ разрешено")
})

test("заголовок модуля ftsc сохраняется целиком", () => {
  const source = [
    "модуль «Повтор»",
    "  экспортирует «Попытка», «Рассчитать задержку»",
    "  использует «Хранилище» из «../sql/storage.fts»",
    "категория «Повтор»",
    "  объект Попытка",
    "    номер является числом",
    "",
  ].join("\n")
  const header = program(source).legacy.find((node) => node.construct === "moduleHeader")
  assert.deepEqual(header.value, {
    name: "Повтор",
    imports: [{ category: "Хранилище", from: "../sql/storage.fts" }],
    exports: ["Попытка", "Рассчитать задержку"],
  })
})

test("файл-функтор ftsc сохраняется целиком", () => {
  const source = [
    "функтор «Запрос страницы в условие выборки» из «Запрос списка» в «Хранилище»",
    "  использует «Запрос списка» из «../http/query.fts»",
    "  объект «Запрос страницы» отображается в «Условие выборки»",
    "    поле «номер страницы» отображается в поле «номер страницы»",
    "  морфизм «Проверенный запрос» отображается в морфизм «Проверенное условие»",
    "",
  ].join("\n")
  const functor = program(source).legacy.find((node) => node.construct === "functorFile")
  assert.deepEqual(functor.value, {
    name: "Запрос страницы в условие выборки",
    from: "Запрос списка",
    to: "Хранилище",
    imports: [{ category: "Запрос списка", from: "../http/query.fts" }],
    objects: [
      {
        from: "Запрос страницы",
        to: "Условие выборки",
        fields: [{ from: "номер страницы", to: "номер страницы" }],
      },
    ],
    morphisms: [{ from: "Проверенный запрос", to: "Проверенное условие" }],
  })
})

test("старая скобочная поверхность разбирается в ftsLegacy", () => {
  /* Модель переехала в фикстуры языка вместе со всем корпусом .fts: старый
     проект вынесен из репозитория (тег `fts-pered-udaleniem`). */
  const source = readFileSync(`${repository}flang/test/fixtures/fts/examples/socrates.fts`, "utf8")
  const result = program(source)
  const document = result.legacy.find((node) => node.construct === "bracedDocument")
  assert.equal(document.value.category, "ClassicalLogic")
  assert.deepEqual(document.value.functors, [
    { name: "humanImpliesMortal", domain: "Human", codomain: "Mortal", law: "functor.arrow" },
  ])
  assert.equal(document.value.proposition.kind, "compose")
  assert.equal(document.value.proposition.arg.kind, "witness")
  assert.deepEqual(document.value.proposition.arg.selector, { name: "Socrates" })
  /* Структуры скобочной поверхности — тоже записи, поэтому они в types. */
  assert.equal(result.types[0].name, "Individual")
})

// ── обратная совместимость и детерминированность ────────────────────────────

/* Корпус моделей переехал в фикстуры языка: старый проект вынесен из
   репозитория (тег `fts-pered-udaleniem`), и раскладывать выборку по двум
   исчезнувшим каталогам стало нечему. Каталог тот же, что у core-*.test.mjs. */
const corpus = ftsFiles(`${repository}flang/test/fixtures/fts`)

test("в репозитории есть модели для проверки совместимости", () => {
  assert.ok(corpus.length >= 20, `найдено моделей: ${corpus.length}`)
})

for (const file of corpus) {
  const relative = file.slice(repository.length)
  test(`совместимость: ${relative}`, () => {
    const source = readFileSync(file, "utf8")
    const result = parse(source)
    assert.equal(result.flang, 1)
    assert.equal(typeof result.module, "string")
    assert.ok(Array.isArray(result.types))
    assert.ok(Array.isArray(result.functions))
    /* Детерминированность: повторный разбор даёт побайтово тот же AST. */
    assert.equal(JSON.stringify(parse(source)), JSON.stringify(result))
  })
}

test("детерминированность не зависит от порядка разбора файлов", () => {
  const first = corpus.map((file) => JSON.stringify(parse(readFileSync(file, "utf8"))))
  const second = [...corpus].reverse().map((file) => JSON.stringify(parse(readFileSync(file, "utf8")))).reverse()
  assert.deepEqual(second, first)
})
