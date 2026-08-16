/**
 * Печать документа FTS в JSON на flang (`flang/core/json.flang`).
 *
 * Главная проверка здесь одна и она дифференциальная: для каждой модели `.fts`
 * репозитория (и внешних каталогов, если они перечислены в `FTS_MODEL_PATH`)
 * документ, полученный настоящим ядром на TypeScript (`compile` из `dist/`),
 * печатается функцией «Печать документа» — и обязан совпасть с `JSON.stringify`
 * того же документа **побайтово**. Не «эквивалентный JSON», а тот же байт:
 * порядок ключей, экранирование, запись чисел (flang/core/SPEC.md, раздел 5).
 *
 * Документ ядра — это обычный JSON, а значения flang — записи и варианты сумм,
 * поэтому между ними стоит перевод (`документ` и его помощники ниже). Перевод
 * намеренно механический: он повторяет форму значения и порядок ключей, каким
 * его отдал ядро (`Object.entries`), и не знает ни про экранирование, ни про
 * запись чисел, ни про то, какие ключи бывают необязательными, — всё это решает
 * сама программа на flang. Иначе тест проверял бы себя, а не её.
 *
 * Остальные проверки закрывают то, чего в моделях репозитория не встречается:
 * управляющие символы, суррогатные пары, дробные числа и экспоненту, пустые
 * списки, вложенность. Оракул везде один и тот же — `JSON.stringify`.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { valuesEqual } from "../src/builtins.mjs"
import { evaluate } from "../src/interpret.mjs"
import { parse } from "../src/parser.mjs"
import { checkTotality } from "../src/totality.mjs"
import { checkTypes } from "../src/types.mjs"
import * as core from "./fts-oracle.mjs"
import { строкиОхвата, текстМодели, файлыКорпуса } from "./corpus.mjs"

const source = readFileSync(new URL("../core/json.flang", import.meta.url), "utf8")
const program = parse(source, "json.flang")
const types = checkTypes(program)
const totality = checkTotality(program)


/**
 * Лимиты интерпретатора не поднимаются: печать самой большой модели
 * репозитория укладывается в стандартный миллион шагов. Это заодно проверка
 * того, что экранирование свёрткой по таблице замен не превращает печать
 * документа в перебор, который пришлось бы оправдывать особыми настройками.
 */
const вызвать = (name, args) => evaluate(program, name, args)

/* ─────────────────── перевод значений ядра в значения flang ─────────────── */

const вариант = (name, fields = {}) => ({ variant: name, fields })

function скаляр(value) {
  if (value === null) return вариант("Скаляр ничто")
  if (typeof value === "string") return вариант("Скаляр строка", { значение: value })
  if (typeof value === "number") return вариант("Скаляр число", { значение: value })
  if (typeof value === "boolean") return вариант("Скаляр признак", { значение: value })
  throw new Error(`не скаляр: ${String(value)}`)
}

function значение(value) {
  if (Array.isArray(value)) return вариант("Значение списка", { элементы: value.map(значение) })
  if (value !== null && typeof value === "object") {
    return вариант("Значение записи", {
      поля: Object.entries(value).map(([ключ, вложенное]) => ({ ключ, значение: значение(вложенное) })),
    })
  }
  return вариант("Значение скаляра", { скаляр: скаляр(value) })
}

/* Ключ отсутствует ровно тогда, когда его пропустил бы и JSON.stringify. */
const мбСтрока = (value) =>
  value === undefined ? вариант("Нет строки") : вариант("Есть строка", { значение: value })
const мбЗначение = (value) =>
  value === undefined ? вариант("Нет значения") : вариант("Есть значение", { значение: значение(value) })

function утверждение(предложение) {
  const описание = мбСтрока(предложение.detail)
  if (предложение.kind === "witness") {
    return вариант("Свидетельство", {
      структура: предложение.structure,
      поле: предложение.field,
      селектор: мбЗначение(предложение.selector),
      значение: мбЗначение(предложение.value),
      путь: мбЗначение(предложение.path),
      описание,
    })
  }
  if (предложение.kind === "apply") {
    return вариант("Применение", {
      функтор: предложение.functor,
      аргумент: утверждение(предложение.arg),
      описание,
    })
  }
  if (предложение.kind === "compose") {
    return вариант("Композиция", {
      функторы: предложение.functors,
      аргумент: утверждение(предложение.arg),
      описание,
    })
  }
  throw new Error(`неизвестный вид утверждения: ${String(предложение.kind)}`)
}

const СРАВНЕНИЯ = {
  eq: "Равно",
  neq: "Не равно",
  gte: "Не меньше",
  lte: "Не больше",
  gt: "Больше",
  lt: "Меньше",
}

const сравнение = (operator) => {
  const имя = СРАВНЕНИЯ[operator]
  if (имя === undefined) throw new Error(`неизвестное сравнение: ${String(operator)}`)
  return вариант(имя)
}

function операнд(value) {
  if (value.kind === "value") return вариант("Значение операнда", { скаляр: скаляр(value.value) })
  if (value.kind === "field") return вариант("Поле операнда", { поле: value.field })
  if (value.kind === "percent") return вариант("Процент операнда", { процент: value.percent, поле: value.field })
  if (value.kind === "result") return вариант("Результат операнда")
  throw new Error(`неизвестный операнд: ${String(value.kind)}`)
}

const условие = (item) => ({
  поле: item.field,
  сравнение: сравнение(item.operator),
  операнд: операнд(item.value),
})

const действие = (item) =>
  item.kind === "set"
    ? вариант("Присвоить", { операнд: операнд(item.value) })
    : вариант("Добавить", { операнд: операнд(item.value) })

const правило = (item) => ({
  имя: item.name,
  условия: item.when.map(условие),
  действие: действие(item.action),
})

const свойство = (item) => ({
  имя: item.name,
  сравнение: сравнение(item.operator),
  операнд: операнд(item.value),
})

const пример = (item) => ({
  имя: item.name,
  вход: Object.entries(item.input).map(([имя, value]) => ({ имя, значение: скаляр(value) })),
  ожидается: скаляр(item.expected),
})

const утилита = (item) => ({
  имя: item.name,
  принимает: item.input,
  возвращает: item.output,
  начальное: скаляр(item.initial),
  правила: item.rules.map(правило),
  свойства: item.properties.map(свойство),
  примеры: item.examples.map(пример),
})

const структура = (item) => ({
  имя: item.name,
  поля: item.fields.map((поле) => ({ имя: поле.name, тип: поле.type })),
  совместимость: мбСтрока(item.ts_compat),
})

const функтор = (item) => ({
  имя: item.name,
  домен: item.domain,
  кодомен: item.codomain,
  закон: мбСтрока(item.law),
})

const документ = (doc) => ({
  категория: doc.category,
  структуры: doc.structures.map(структура),
  функторы: doc.functors.map(функтор),
  утверждение:
    doc.proposition === null || doc.proposition === undefined
      ? вариант("Нет утверждения")
      : вариант("Есть утверждение", { утверждение: утверждение(doc.proposition) }),
  совместимость: Object.entries(doc.ts_compat).map(([ключ, значение]) => ({ ключ, значение })),
  утилиты:
    doc.utilities === undefined
      ? вариант("Нет утилит")
      : вариант("Есть утилиты", { утилиты: doc.utilities.map(утилита) }),
})

const печать = (doc) => вызвать("Печать документа", { документ: документ(doc) })

/* ───────────────────────────── слои модуля ──────────────────────────────── */

test("json.flang: разбор даёт контракт SPEC, раздел 5", () => {
  assert.equal(program.flang, 1)
  assert.equal(typeof program.module, "string")
  assert.ok(Array.isArray(program.functions))
  assert.ok(program.functions.length >= 25, `функций: ${program.functions.length}`)
  assert.ok(Array.isArray(program.types))
  /* Детерминированность: повторный разбор даёт побайтово тот же AST. */
  assert.equal(JSON.stringify(parse(source, "json.flang")), JSON.stringify(program))
})

test("json.flang: типы без диагностик", () => {
  assert.deepEqual(types.diagnostics, [])
})

test("json.flang: тотальность без диагностик", () => {
  assert.deepEqual(totality.diagnostics, [])
})

test("json.flang: каждая функция помечена «тотальная» и доказана", () => {
  for (const fn of program.functions) {
    assert.equal(fn.total, true, `«${fn.name}» не помечена тотальной`)
    assert.ok(totality.total.has(fn.name), `«${fn.name}» помечена тотальной, но не доказана`)
  }
})

test("json.flang: примеры сходятся", () => {
  let count = 0
  for (const fn of program.functions) {
    for (const example of fn.examples ?? []) {
      count += 1
      const actual = вызвать(fn.name, example.args)
      assert.ok(
        valuesEqual(actual, example.expected),
        `«${fn.name}» / «${example.name}»: ожидалось ${JSON.stringify(example.expected)}, получено ${JSON.stringify(actual)}`,
      )
    }
  }
  assert.ok(count >= 15, `примеров: ${count}`)
})

/* ──────────────────────────── экранирование ─────────────────────────────── */

const строка = (текст) => вызвать("Печать строки", { текст })

test("экранирование: кавычка и обратный слеш", () => {
  for (const текст of ['"', "\\", '\\"', 'а"б\\в', '""', "\\\\", 'путь "C:\\\\tmp"']) {
    assert.equal(строка(текст), JSON.stringify(текст), `на ${JSON.stringify(текст)}`)
  }
})

test("экранирование: все управляющие символы 0x00–0x1F", () => {
  for (let code = 0; code < 0x20; code += 1) {
    const текст = String.fromCharCode(code)
    assert.equal(строка(текст), JSON.stringify(текст), `код ${code}`)
    const внутри = `а${текст}б`
    assert.equal(строка(внутри), JSON.stringify(внутри), `код ${code} внутри строки`)
  }
})

test("экранирование: короткие формы \\b \\t \\n \\f \\r", () => {
  assert.equal(строка("\b\t\n\f\r"), '"\\b\\t\\n\\f\\r"')
  assert.equal(строка("\b\t\n\f\r"), JSON.stringify("\b\t\n\f\r"))
})

test("экранирование: DEL и неразрывный пробел не экранируются", () => {
  for (const текст of ["\u007f", "\u00a0", "\u2028", "\u2029"]) {
    assert.equal(строка(текст), JSON.stringify(текст), `на кодовой точке ${текст.codePointAt(0)}`)
  }
})

test("экранирование: кириллица едет как есть, а не \\u04xx", () => {
  const текст = "Скидка постоянному клиенту — не больше 20 процентов"
  assert.equal(строка(текст), JSON.stringify(текст))
  assert.equal(строка(текст), `"${текст}"`)
  assert.ok(!строка(текст).includes("\\u"))
})

test("экранирование: эмодзи (суррогатная пара) едет как есть", () => {
  for (const текст of ["🙂", "а🙂б", "𝄞"]) {
    assert.equal(строка(текст), JSON.stringify(текст), `на ${текст}`)
  }
})

test("экранирование: сплошной перебор кодовых точек 0x00–0x2FF", () => {
  for (let code = 0; code <= 0x2ff; code += 1) {
    const текст = `x${String.fromCodePoint(code)}y`
    assert.equal(строка(текст), JSON.stringify(текст), `код ${code}`)
  }
})

test("экранирование: пустая строка и строка из одних кавычек", () => {
  assert.equal(строка(""), '""')
  assert.equal(строка('"""'), JSON.stringify('"""'))
})

/**
 * Известный долг (flang/core/SPEC.md, раздел «Долги», пункт 1): одинокий
 * суррогат `JSON.stringify` экранирует (`"\ud800"`), а «Экранировать» — нет.
 * Тест закрепляет текущее поведение, чтобы долг был виден и чтобы его
 * закрытие не прошло молча: когда в языке появится «код символа», этот тест
 * обязан упасть и превратиться в проверку совпадения.
 */
test("известный долг: одинокий суррогат не экранируется", () => {
  for (const текст of ["\ud800", "a\udfffb"]) {
    assert.notEqual(строка(текст), JSON.stringify(текст))
    assert.equal(строка(текст), `"${текст}"`)
  }
  /* Правильная пара суррогатов долгом не затронута. */
  assert.equal(строка("🙂"), JSON.stringify("🙂"))
})

/* ──────────────────────────────── числа ─────────────────────────────────── */

const число = (значение) => вызвать("Печать числа", { значение })

test("числа: целые печатаются без дробной части", () => {
  for (const value of [0, 1, -1, 42, -42, 1000000, Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER]) {
    assert.equal(число(value), JSON.stringify(value), `на ${value}`)
  }
})

test("числа: минус ноль печатается как 0", () => {
  assert.equal(число(-0), "0")
  assert.equal(число(-0), JSON.stringify(-0))
  assert.ok(Object.is(-0, -0))
})

test("числа: дроби", () => {
  for (const value of [0.1, -0.1, 0.5, 1 / 3, 0.30000000000000004, 1.5, 2.675, 1e-7, 5e-324]) {
    assert.equal(число(value), JSON.stringify(value), `на ${value}`)
  }
})

test("числа: экспонента", () => {
  for (const value of [1e21, -1e21, 1e-7, 1e100, 1.7976931348623157e308, 123456789012345680000]) {
    assert.equal(число(value), JSON.stringify(value), `на ${value}`)
  }
})

test("числа: NaN и бесконечности печатаются как null", () => {
  for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.equal(число(value), "null", `на ${value}`)
    assert.equal(число(value), JSON.stringify(value), `на ${value}`)
  }
})

/**
 * Псевдослучайные double — генератор с постоянным зерном, чтобы падение
 * воспроизводилось. Оракул тот же `JSON.stringify`: это и есть проверка того,
 * что «к строке» от числа — Number::toString, а не что-нибудь похожее.
 */
test("числа: 2000 псевдослучайных double против JSON.stringify", () => {
  let seed = 20240517
  const следующее = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed / 2147483648
  }
  for (let index = 0; index < 2000; index += 1) {
    const мантисса = следующее() * 2 - 1
    const порядок = Math.trunc(следующее() * 40) - 20
    const value = мантисса * 10 ** порядок
    assert.equal(число(value), JSON.stringify(value), `на ${value}`)
  }
})

/* ─────────────────────────── скаляры и значения ─────────────────────────── */

const скалярно = (value) => вызвать("Печать скаляра", { скаляр: скаляр(value) })
const значенно = (value) => вызвать("Печать значения", { значение: значение(value) })

test("скаляры: строка, число, признак, ничто", () => {
  for (const value of ["текст", 7, -0.5, true, false, null]) {
    assert.equal(скалярно(value), JSON.stringify(value), `на ${JSON.stringify(value)}`)
  }
})

test("признак едет булевым литералом, а не «да»/«нет»", () => {
  assert.equal(вызвать("Печать признака", { значение: true }), "true")
  assert.equal(вызвать("Печать признака", { значение: false }), "false")
})

test("значения: пустые список и запись", () => {
  assert.equal(значенно([]), "[]")
  assert.equal(значенно({}), "{}")
  assert.equal(значенно([[], {}]), "[[],{}]")
})

test("значения: вложенность", () => {
  const value = { a: [1, [2, [3, []]]], b: { c: { d: null } }, e: [{ f: true }] }
  assert.equal(значенно(value), JSON.stringify(value))
})

test("значения: порядок ключей — вставки, а не алфавита", () => {
  const value = { я: 1, б: 2, а: 3 }
  assert.equal(значенно(value), '{"я":1,"б":2,"а":3}')
  assert.equal(значенно(value), JSON.stringify(value))
})

/**
 * JS выносит целочисленные ключи вперёд и сортирует их по возрастанию — это
 * не порядок вставки. Список пар в flang такого правила не знает и печатает
 * ровно тот порядок, который ему дали; совпадение получается потому, что
 * порядок берётся из `Object.entries`, то есть из того же правила.
 */
test("значения: целочисленные ключи идут первыми, как в JS", () => {
  const value = { 2: "два", 1: "один", я: "буква" }
  assert.equal(значенно(value), JSON.stringify(value))
  assert.equal(значенно(value), '{"1":"один","2":"два","я":"буква"}')
  const смешанные = { "01": 1, 10: 2, 9: 3 }
  assert.equal(значенно(смешанные), JSON.stringify(смешанные))
})

test("значения: ключи и строки экранируются", () => {
  const value = { 'ключ "в кавычках"': 'значение\\со\\слешами', "\t": "\n" }
  assert.equal(значенно(value), JSON.stringify(value))
})

test("значения: 500 псевдослучайных деревьев против JSON.stringify", () => {
  let seed = 987654321
  const следующее = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed / 2147483648
  }
  const буквы = ["а", "b", '"', "\\", "\n", "мир", "", "🙂"]
  const дерево = (глубина) => {
    const выбор = следующее()
    if (глубина <= 0 || выбор < 0.45) {
      const вид = следующее()
      if (вид < 0.25) return буквы[Math.trunc(следующее() * буквы.length)]
      if (вид < 0.5) return Math.trunc(следующее() * 2000) - 1000
      if (вид < 0.7) return (следующее() * 2 - 1) * 10 ** (Math.trunc(следующее() * 12) - 6)
      if (вид < 0.85) return следующее() < 0.5
      return null
    }
    const размер = Math.trunc(следующее() * 4)
    if (выбор < 0.75) return Array.from({ length: размер }, () => дерево(глубина - 1))
    const запись = {}
    for (let index = 0; index < размер; index += 1) {
      запись[`${буквы[Math.trunc(следующее() * буквы.length)]}${index}`] = дерево(глубина - 1)
    }
    return запись
  }
  for (let index = 0; index < 500; index += 1) {
    const value = дерево(3)
    assert.equal(значенно(value), JSON.stringify(value), `на ${JSON.stringify(value)}`)
  }
})

/* ──────────────────── документы, собранные руками ───────────────────────── */

const ПУСТОЙ = {
  category: "Пусто",
  structures: [],
  functors: [],
  proposition: null,
  ts_compat: {},
}

test("документ: минимальный", () => {
  assert.equal(печать(ПУСТОЙ), JSON.stringify(ПУСТОЙ))
  assert.equal(
    печать(ПУСТОЙ),
    '{"category":"Пусто","structures":[],"functors":[],"proposition":null,"ts_compat":{}}',
  )
})

test("документ: ключа utilities нет, когда утилит нет", () => {
  assert.ok(!печать(ПУСТОЙ).includes("utilities"))
  const сУтилитами = { ...ПУСТОЙ, utilities: [] }
  assert.equal(печать(сУтилитами), JSON.stringify(сУтилитами))
  assert.ok(печать(сУтилитами).endsWith('"utilities":[]}'))
})

test("документ: структуры с ts_compat и без него", () => {
  const doc = {
    ...ПУСТОЙ,
    structures: [
      { name: "Покупка", fields: [{ name: "сумма", type: "Деньги" }] },
      {
        name: "Клиент",
        fields: [{ name: "имя", type: "string" }, { name: "постоянный", type: "boolean" }],
        ts_compat: "interface Клиент { имя: string; постоянный: boolean }",
      },
      { name: "Пустая", fields: [] },
    ],
  }
  assert.equal(печать(doc), JSON.stringify(doc))
})

test("документ: функторы с законом и без", () => {
  const doc = {
    ...ПУСТОЙ,
    functors: [
      { name: "цена", domain: "Покупка", codomain: "Деньги", law: "functor.arrow" },
      { name: "без закона", domain: "А", codomain: "Б" },
    ],
  }
  assert.equal(печать(doc), JSON.stringify(doc))
})

test("документ: утверждение-свидетельство со всеми необязательными ключами", () => {
  const doc = {
    ...ПУСТОЙ,
    proposition: {
      kind: "witness",
      structure: "Заказ",
      field: "оплачен",
      selector: { номер: "A-1" },
      value: true,
      path: ["заказы", { номер: "A-1" }, "оплачен"],
      detail: "Заказ A-1 оплачен",
    },
  }
  assert.equal(печать(doc), JSON.stringify(doc))
})

test("документ: утверждение-свидетельство без необязательных ключей", () => {
  const doc = { ...ПУСТОЙ, proposition: { kind: "witness", structure: "Заказ", field: "оплачен" } }
  assert.equal(печать(doc), JSON.stringify(doc))
  assert.ok(!печать(doc).includes("selector"))
  assert.ok(!печать(doc).includes("detail"))
})

test("документ: применение и композиция вложены рекурсивно", () => {
  const свидетельство = {
    kind: "witness",
    structure: "Заказ",
    field: "сумма",
    selector: { id: "1" },
    value: 100,
    path: ["заказы", { id: "1" }, "сумма"],
    detail: "деталь",
  }
  const применение = { ...ПУСТОЙ, proposition: { kind: "apply", functor: "скидка", arg: свидетельство, detail: "теорема" } }
  assert.equal(печать(применение), JSON.stringify(применение))
  const композиция = {
    ...ПУСТОЙ,
    proposition: { kind: "compose", functors: ["скидка", "налог"], arg: свидетельство, detail: "теорема" },
  }
  assert.equal(печать(композиция), JSON.stringify(композиция))
  const вложенное = {
    ...ПУСТОЙ,
    proposition: { kind: "apply", functor: "внешний", arg: композиция.proposition },
  }
  assert.equal(печать(вложенное), JSON.stringify(вложенное))
})

test("документ: ts_compat как словарь с порядком вставки", () => {
  const doc = { ...ПУСТОЙ, ts_compat: { Я: "type Я = {}", А: "type А = {}" } }
  assert.equal(печать(doc), JSON.stringify(doc))
  assert.ok(печать(doc).includes('"ts_compat":{"Я":"type Я = {}","А":"type А = {}"}'))
})

test("документ: утилита со всеми видами операндов и сравнений", () => {
  const doc = {
    ...ПУСТОЙ,
    utilities: [
      {
        name: "Скидка",
        input: "Покупка",
        output: "Деньги",
        initial: 0,
        rules: [
          {
            name: "Постоянному клиенту",
            when: [
              { field: "постоянный клиент", operator: "eq", value: { kind: "value", value: true } },
              { field: "сумма", operator: "gte", value: { kind: "value", value: 1000 } },
              { field: "бонус", operator: "lt", value: { kind: "field", field: "сумма" } },
              { field: "порог", operator: "neq", value: { kind: "percent", percent: 10, field: "сумма" } },
              { field: "итог", operator: "gt", value: { kind: "result" } },
              { field: "метка", operator: "lte", value: { kind: "value", value: "строка" } },
              { field: "пусто", operator: "eq", value: { kind: "value", value: null } },
            ],
            action: { kind: "set", value: { kind: "percent", percent: 10, field: "сумма" } },
          },
          {
            name: "Добавка",
            when: [{ field: "срочно", operator: "eq", value: { kind: "value", value: false } }],
            action: { kind: "add", value: { kind: "value", value: 50 } },
          },
        ],
        properties: [
          { name: "Предел", operator: "lte", value: { kind: "percent", percent: 20, field: "сумма" } },
          { name: "Неотрицательна", operator: "gte", value: { kind: "value", value: 0 } },
        ],
        examples: [
          { name: "Обычный", input: { сумма: 100, "постоянный клиент": false }, expected: 0 },
          { name: "Пустой вход", input: {}, expected: true },
        ],
      },
      {
        name: "Без правил",
        input: "Пусто",
        output: "Признак",
        initial: null,
        rules: [],
        properties: [],
        examples: [],
      },
    ],
  }
  assert.equal(печать(doc), JSON.stringify(doc))
})

test("документ: кириллица и кавычки в именах не ломают печать", () => {
  const doc = {
    category: 'Категория "в кавычках"',
    structures: [{ name: "Объект\\с\\слешами", fields: [{ name: "поле\nс переводом", type: "Строка" }] }],
    functors: [],
    proposition: null,
    ts_compat: { 'ключ "к"': "значение\t" },
    utilities: [],
  }
  assert.equal(печать(doc), JSON.stringify(doc))
})

/* ─────────────────── дифференциальная сверка на моделях ─────────────────── */

/**
 * Корпус: модели `.fts` из фикстур языка. Состав корпуса печатается ниже
 * отдельным тестом: охват сверки обязан быть виден в выводе, а не
 * подразумеваться (почему именно так — `flang/test/corpus.mjs`).
 */
function модели() {
  /* Отбора «а вдруг это не документ» здесь больше НЕТ, и это усиление, а не
     упрощение. Раньше `catch { }` глотал любой отказ ядра, и модель, переставшая
     компилироваться, просто исчезала из сверки: красных не прибавлялось,
     прибавлялось молчание. Прогон это и предъявил — убранная из замороженной
     таблицы запись давала «прошло 92, упало 0» вместо падения.

     Сегодня отбор сделан ОДИН РАЗ, при переносе корпуса в фикстуры: все файлы
     там — документы ядра. Значит отказ здесь означает не «чужой диалект», а
     поломку, и он обязан быть виден. */
  return файлы.map((запись) => ({
    имя: запись.имя,
    источник: запись.источник,
    документ: core.compile(текстМодели(запись)),
  }))
}

const файлы = файлыКорпуса()
const корпус = модели()
const охват = строкиОхвата(корпус, файлы)

/* Число моделей стоит прямо в имени теста, источники — в диагностике: по
   выводу должно быть видно, каким был охват именно этого прогона. */
test(`корпус моделей найден — ${охват[0]}`, (t) => {
  for (const строка of охват) t.diagnostic(строка)
  assert.ok(корпус.length >= 40, `моделей: ${корпус.length}`)
})

for (const { имя, документ: doc } of корпус) {
  test(`${имя}: печать на flang байт в байт совпадает с JSON.stringify ядра`, () => {
    const ожидается = JSON.stringify(doc)
    const получено = печать(doc)
    if (получено !== ожидается) {
      /* Место первого расхождения — иначе разница на 40 КБ нечитаема. */
      let index = 0
      while (index < ожидается.length && ожидается[index] === получено[index]) index += 1
      assert.fail(
        `расхождение с ${index}-го байта\n  ядро:  …${ожидается.slice(Math.max(0, index - 40), index + 40)}…\n  flang: …${получено.slice(Math.max(0, index - 40), index + 40)}…`,
      )
    }
    assert.equal(получено, ожидается)
  })
}

test("сверка идёт по документам, а не по пустышкам", () => {
  const непустые = корпус.filter(({ документ: doc }) => doc.structures.length > 0 || (doc.utilities ?? []).length > 0)
  assert.ok(непустые.length >= 30, `непустых моделей: ${непустые.length}`)
  const сУтилитами = корпус.filter(({ документ: doc }) => (doc.utilities ?? []).length > 0)
  assert.ok(сУтилитами.length >= 10, `моделей с утилитами: ${сУтилитами.length}`)
  const сУтверждением = корпус.filter(({ документ: doc }) => doc.proposition !== null)
  assert.ok(сУтверждением.length >= 5, `моделей с утверждением: ${сУтверждением.length}`)
})
