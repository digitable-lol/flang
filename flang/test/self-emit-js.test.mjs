/**
 * Печать flang → JavaScript, написанная на самом flang (`flang/self/emit-js.flang`).
 *
 * Проверка здесь одна и она дифференциальная: для каждой программы репозитория
 * файл, который печатает «Печать программы» на flang, обязан совпасть с тем,
 * что печатает эталон `flang/src/emit/js.mjs`, **побайтово** — включая
 * комментарии, пробелы, порядок временных имён и нумерацию.
 *
 * Слабее критерий делать нельзя. «Компилируется и работает» не отличает
 * правильную печать от случайно похожей: два бэкенда могут давать разный
 * JavaScript, который одинаково проходит сетку входов, и разойтись на первом же
 * входе, которого в сетке не было. Побайтовое совпадение исключает это по
 * построению.
 *
 * ── Пока работа не кончена, тест обязан МЕРИТЬ ─────────────────────────────
 * Красный тест, который говорит «не совпало», бесполезен: по нему не видно,
 * растёт ли доля совпавшего. Поэтому сверка корпуса печатает число совпавших
 * программ, число разошедшихся и первое расхождение текстом, а падает только
 * тогда, когда совпало меньше, чем уже было достигнуто (`ПОРОГ`). Порог
 * поднимается вместе с работой и вниз не ходит — это и есть храповик.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { fromFtsDocument } from "../src/compat.mjs"
import { emitJs } from "../src/emit/js.mjs"
import { evaluate } from "../src/interpret.mjs"
import { linkProgram } from "../src/link.mjs"
import { parse } from "../src/parser.mjs"
import { checkTotality } from "../src/totality.mjs"
import { checkTypes } from "../src/types.mjs"
import { globSync } from "./glob.mjs"

const корень = fileURLToPath(new URL("../..", import.meta.url))
const файл = fileURLToPath(new URL("../self/emit-js.flang", import.meta.url))
const исходник = readFileSync(файл, "utf8")

const свой = parse(исходник, "self/emit-js.flang")
const связано = await linkProgram(файл, исходник, parse)
const { diagnostics: диагностикиСвязывания, ...программа } = связано
const типы = checkTypes(программа)
const тотальность = checkTotality(программа)

/**
 * Лимит шагов поднят с миллиона до ста: печать — работа с целым AST сразу, и
 * самые большие программы репозитория укладываются между шестьюдесятью и ста
 * миллионами шагов. Лимит здесь не формальность: он ловит превращение печати в
 * перебор. Глубина — по вложенности AST, а не по числу узлов.
 */
const ШАГИ = { maxSteps: 100_000_000, maxDepth: 10_000 }
const вызвать = (имя, аргументы) => evaluate(программа, имя, аргументы, ШАГИ)

/* ─────────────────── перевод AST в значения flang ─────────────────── */

/* Механический перевод JSON → «Значение» из `flang/core/json.flang`: повторяет
   форму и порядок ключей и ничего не решает сам. Иначе тест проверял бы себя. */
const вариантЗначения = (имя, поля = {}) => ({ variant: имя, fields: поля })

function скаляр(значение) {
  if (значение === null) return вариантЗначения("Скаляр ничто")
  if (typeof значение === "string") return вариантЗначения("Скаляр строка", { значение })
  if (typeof значение === "number") return вариантЗначения("Скаляр число", { значение })
  if (typeof значение === "boolean") return вариантЗначения("Скаляр признак", { значение })
  throw new Error(`не скаляр: ${String(значение)}`)
}

/* `undefined` пропускается ровно там, где его пропустил бы JSON.stringify:
   ключа нет — это не «ключ со значением ничто», и эталон их различает. */
function значение(узел) {
  if (узел === undefined) return вариантЗначения("Значение скаляра", { скаляр: скаляр(null) })
  if (Array.isArray(узел)) return вариантЗначения("Значение списка", { элементы: узел.map(значение) })
  if (узел !== null && typeof узел === "object") {
    return вариантЗначения("Значение записи", {
      поля: Object.entries(узел)
        .filter(([, вложенное]) => вложенное !== undefined)
        .map(([ключ, вложенное]) => ({ ключ, значение: значение(вложенное) })),
    })
  }
  return вариантЗначения("Значение скаляра", { скаляр: скаляр(узел) })
}

/* Планировщик конкурентности — настоящий .js рядом, и приходит параметром:
   читать файлы язык не умеет и не должен. Берём тот же файл, что берёт эталон. */
const ПЛАНИРОВЩИК = readFileSync(new URL("../src/emit/js/flang_conc.js", import.meta.url), "utf8")

function настройки(опции = {}) {
  return {
    "путь": опции.path ?? "",
    "есть путь": опции.path !== undefined,
    "база": опции.indexBase === 0 ? 0 : 1,
    "предел глубины": Number.isInteger(опции.maxDepth) && опции.maxDepth > 0 ? опции.maxDepth : 10_000,
    "предел шагов": Number.isInteger(опции.maxSteps) && опции.maxSteps > 0 ? опции.maxSteps : 1_000_000,
    "исходник планировщика": ПЛАНИРОВЩИК,
  }
}

/** Печать на flang: список файлов в той же форме, что у эталона. */
function напечатать(ast, опции = {}) {
  const итог = вызвать("Печать программы", { "программа": значение(ast), "настройки": настройки(опции) })
  return { files: итог.файлы.map((файл) => ({ path: файл.путь, content: файл.содержимое })), error: итог.ошибка }
}

/** Первое расхождение двух текстов — номер строки и обе строки. */
function расхождение(эталон, наш) {
  const слева = эталон.split("\n")
  const справа = наш.split("\n")
  let строка = 0
  while (строка < слева.length && строка < справа.length && слева[строка] === справа[строка]) строка += 1
  return {
    строка: строка + 1,
    эталон: слева[строка] ?? "<конец файла>",
    наш: справа[строка] ?? "<конец файла>",
  }
}

/**
 * Сверка одной программы. Возвращает `null` при побайтовом совпадении, иначе
 * запись о первом расхождении — тест сам решает, падать или считать.
 */
function сверить(имя, ast, опции = {}) {
  let эталон
  try {
    эталон = emitJs(ast, опции)
  } catch (ошибка) {
    return { имя, вид: "эталон отказал", текст: String(ошибка.message) }
  }
  let мой
  try {
    мой = напечатать(ast, опции)
  } catch (ошибка) {
    return { имя, вид: "печать на flang упала", текст: String(ошибка.message) }
  }
  if (мой.error !== "") return { имя, вид: "печать на flang отказала", текст: мой.error }
  const пути = мой.files.map((файл) => файл.path)
  const ожидаемые = эталон.files.map((файл) => файл.path)
  if (пути.join("|") !== ожидаемые.join("|")) {
    return { имя, вид: "набор файлов", текст: `эталон ${ожидаемые.join(", ")}; flang ${пути.join(", ")}` }
  }
  for (const [индекс, файл] of эталон.files.entries()) {
    const наш = мой.files[индекс].content
    if (наш === файл.content) continue
    const где = расхождение(файл.content, наш)
    return {
      имя,
      вид: "байты",
      файл: файл.path,
      строка: где.строка,
      текст: `${файл.path}:${где.строка}\n    эталон: ${JSON.stringify(где.эталон)}\n    flang:  ${JSON.stringify(где.наш)}`,
    }
  }
  return null
}

/** Отказ печати: текст обязан совпасть с тем, что бросает эталон. */
function сверитьОтказ(имя, ast) {
  let ожидаемое = null
  try {
    emitJs(ast)
  } catch (ошибка) {
    ожидаемое = ошибка.message
  }
  assert.notEqual(ожидаемое, null, `${имя}: эталон не отказал, сверять нечего`)
  assert.equal(напечатать(ast).error, ожидаемое, `${имя}: текст отказа разошёлся`)
}

/* ─────────────────── программы репозитория ─────────────────── */

/** Программа со связанными импортами: без них имена соседних модулей висят. */
async function разобрать(относительный) {
  const путь = join(корень, относительный)
  const текст = readFileSync(путь, "utf8")
  const связанное = await linkProgram(путь, текст, parse)
  const { diagnostics: диагностики, ...ast } = связанное
  assert.deepEqual(диагностики, [], `${относительный}: не связалось`)
  return ast
}

const программыРепозитория = [
  ...globSync("flang/stdlib/*.flang", { cwd: корень }),
  ...globSync("flang/examples/*.flang", { cwd: корень }),
  ...globSync("flang/examples/leetcode/*.flang", { cwd: корень }),
  ...globSync("flang/core/*.flang", { cwd: корень }),
  "flang/self/emit-js.flang",
].sort()

/**
 * Храповик. Число — сколько программ корпуса уже печатается побайтово. Работа
 * не кончена, пока оно меньше длины корпуса; ронять его нельзя.
 */
const ПОРОГ = 100

/* ─────────────────── проверки самой программы ─────────────────── */

test("программа на flang разбирается, связывается, проходит типы и тотальность", () => {
  assert.deepEqual(диагностикиСвязывания, [], "связывание дало диагностики")
  assert.deepEqual(типы.diagnostics ?? [], [], "проверка типов дала диагностики")
  assert.deepEqual(тотальность.diagnostics ?? [], [], "анализ тотальности дал диагностики")
  assert.equal(свой.module, "Печать в JavaScript")
  const свои = new Set(свой.functions.map((функция) => функция.name))
  const доказанные = свой.functions.filter((функция) => функция.total === true)
  assert.ok(свои.size >= 150, `функций стало ${свои.size} — файл подменили?`)
  assert.ok(доказанные.length * 2 > свои.size, "тотальных функций стало меньше половины")
})

test("переиспользование соседних слоёв, а не вторая печать строк и вторая навигация", () => {
  /* Экранирование строк уже доказано побайтово на моделях, а Тарьян — на
     печати в C. Вторая реализация разошлась бы на первом же краевом входе, и
     порядок имён внутри компоненты ВИДЕН в печати. */
  assert.match(исходник, /использует «Печать JSON» из "\.\.\/core\/json\.flang" только /u)
  assert.match(исходник, /использует «Печать в C» из "emit-c\.flang" только /u)
  const свои = new Set(свой.functions.map((функция) => функция.name))
  for (const имя of ["Печать строки", "Компоненты связности", "Змейка", "Транслитерировать"]) {
    assert.ok(!свои.has(имя), `«${имя}» переписана заново вместо импорта`)
    assert.ok(программа.functions.some((функция) => функция.name === имя), `«${имя}» не приехала импортом`)
  }
})

/* ─────────────────── дифференциальная сверка ─────────────────── */

test("программы репозитория: JavaScript совпадает с эталоном побайтово", async (t) => {
  assert.ok(программыРепозитория.length >= 30, "программ стало подозрительно мало")
  const расхождения = []
  let совпало = 0
  for (const относительный of программыРепозитория) {
    const беда = сверить(относительный, await разобрать(относительный))
    if (беда === null) совпало += 1
    else расхождения.push(беда)
  }
  const всего = программыРепозитория.length
  t.diagnostic(`побайтово совпало ${совпало} из ${всего}, разошлось ${расхождения.length}`)
  if (расхождения.length > 0) {
    const первое = расхождения[0]
    t.diagnostic(`первое расхождение — ${первое.имя}: ${первое.вид}`)
    t.diagnostic(первое.текст)
    /* Раскладка по глубине совпавшего префикса: она растёт раньше, чем число
       совпавших целиком программ, и потому мерит работу честнее. */
    const байтовые = расхождения.filter((беда) => беда.вид === "байты").map((беда) => беда.строка)
    if (байтовые.length > 0) {
      const среднее = Math.round(байтовые.reduce((сумма, номер) => сумма + номер, 0) / байтовые.length)
      t.diagnostic(
        `из ${байтовые.length} байтовых расхождений первое приходится в среднем на строку ${среднее}, ` +
          `самое раннее — на ${Math.min(...байтовые)}, самое позднее — на ${Math.max(...байтовые)}`,
      )
    }
  }
  assert.ok(
    совпало >= ПОРОГ,
    `побайтово совпало ${совпало} из ${всего} при пороге ${ПОРОГ} — доля упала`,
  )
  assert.equal(совпало, всего, `не совпало ${расхождения.length} программ из ${всего}`)
})

test("модели FTS через compat: постусловия печатаются так же", async (t) => {
  const ядро = await import(new URL("../../dist/src/index.js", import.meta.url).href)
  const { parseModuleFile } = await import(new URL("../../tools/ftsc/src/parse-module.mjs", import.meta.url).href)
  const расхождения = []
  let совпало = 0
  for (const файлМодели of globSync("**/*.fts", { cwd: корень }).sort()) {
    if (файлМодели.includes("node_modules")) continue
    let документ
    try {
      документ = ядро.compile(
        parseModuleFile(join(корень, файлМодели)).source ?? readFileSync(join(корень, файлМодели), "utf8"),
      )
    } catch {
      continue
    }
    if (!Array.isArray(документ?.utilities) || документ.utilities.length === 0) continue
    const беда = сверить(файлМодели, fromFtsDocument(документ))
    if (беда === null) совпало += 1
    else расхождения.push(беда)
  }
  const всего = совпало + расхождения.length
  assert.ok(всего >= 10, `моделей с утилитами сверено ${всего} — слишком мало`)
  t.diagnostic(`модели: побайтово совпало ${совпало} из ${всего}`)
  if (расхождения.length > 0) t.diagnostic(`первое расхождение — ${расхождения[0].имя}: ${расхождения[0].текст}`)
  assert.equal(совпало, всего, `не совпало ${расхождения.length} моделей из ${всего}`)
})

/* ─────────────────── случаи, которых в репозитории нет ─────────────────── */

const имя = (name) => ({ kind: "var", name })
const лит = (value) => ({ kind: "literal", value })

/** Обёртка для точечных случаев: здесь расхождение — сразу падение. */
function требовать(название, ast, опции = {}) {
  const беда = сверить(название, ast, опции)
  assert.equal(беда, null, беда === null ? "" : `${название}: ${беда.вид}\n  ${беда.текст}`)
}

const батут = {
  flang: 1,
  module: "Чётность",
  functions: [
    {
      name: "Чётное",
      total: true,
      params: [{ name: "н", type: { kind: "number" } }],
      returns: { kind: "boolean" },
      body: {
        kind: "if",
        cond: { kind: "binary", op: "eq", left: имя("н"), right: лит(0) },
        then: лит(true),
        else: { kind: "call", name: "Нечётное", args: [{ kind: "binary", op: "sub", left: имя("н"), right: лит(1) }] },
      },
    },
    {
      name: "Нечётное",
      total: true,
      params: [{ name: "н", type: { kind: "number" } }],
      returns: { kind: "boolean" },
      body: {
        kind: "if",
        cond: { kind: "binary", op: "eq", left: имя("н"), right: лит(0) },
        then: лит(false),
        else: { kind: "call", name: "Чётное", args: [{ kind: "binary", op: "sub", left: имя("н"), right: лит(1) }] },
      },
    },
  ],
}

test("взаимная хвостовая рекурсия: батут печатается так же", () => {
  требовать("батут", батут)
  const текст = напечатать(батут).files[0].content
  assert.ok(текст.includes("$trampoline(chyotnoe$step("), "батута в выдаче нет")
  assert.ok(текст.includes("return new $Bounce(nechyotnoe$step,"), "отскока в выдаче нет")
})

test("хвостовой самовызов разворачивается в цикл с переприсваиванием", () => {
  const обмен = {
    flang: 1,
    module: "Обмен",
    functions: [
      {
        name: "Обмен",
        params: [{ name: "а" }, { name: "б" }],
        returns: { kind: "number" },
        body: {
          kind: "if",
          cond: { kind: "binary", op: "lte", left: имя("а"), right: лит(0) },
          then: имя("б"),
          else: { kind: "call", name: "Обмен", args: [имя("б"), имя("а")] },
        },
      },
    ],
  }
  требовать("самовызов в цикл", обмен)
  const текст = напечатать(обмен).files[0].content
  assert.ok(текст.includes("for (;;) {"), "цикла нет")
  assert.ok(текст.includes("continue"), "переприсваивания нет")
})

test("литералы всех видов: NaN, бесконечности, минус ноль, 1e21, вложенное", () => {
  требовать("литералы", {
    flang: 1,
    module: "Литералы",
    types: [
      { kind: "record", name: "Точка", fields: [{ name: "х", type: { kind: "number" } }] },
      { kind: "record", name: "Пустая", fields: [] },
      { kind: "sum", name: "Сумма", variants: [{ name: "Нет", fields: [] }] },
    ],
    functions: [
      {
        name: "Всё",
        params: [],
        returns: { kind: "nothing" },
        body: {
          kind: "list",
          items: [
            лит(Number.NaN),
            лит(Number.POSITIVE_INFINITY),
            лит(Number.NEGATIVE_INFINITY),
            лит(-0),
            лит(1e21),
            лит(0.1),
            лит(null),
            лит(true),
            лит(false),
            лит('а"б\\в?г '),
            лит([1, [2, 3], { "поле": "значение" }]),
            { kind: "record", type: "Точка", fields: { "х": лит(1) } },
            { kind: "record", type: "Пустая", fields: {} },
            { kind: "construct", variant: "Нет", fields: {} },
            { kind: "list", items: [] },
          ],
        },
      },
    ],
  })
})

test("формы, свёртки, отображения, фильтры и все виды образцов", () => {
  требовать("формы и циклы", {
    flang: 1,
    module: "Формы",
    functions: [
      {
        name: "Всё",
        params: [
          { name: "с", type: { kind: "list", of: { kind: "number" } } },
          { name: "т", type: { kind: "string" } },
        ],
        returns: { kind: "number" },
        body: {
          kind: "let",
          name: "сумма",
          value: {
            kind: "fold",
            over: имя("с"),
            init: лит(0),
            acc: "а",
            item: "э",
            body: { kind: "binary", op: "add", left: имя("а"), right: имя("э") },
          },
          in: {
            kind: "let",
            name: "удв",
            value: {
              kind: "map",
              over: имя("с"),
              item: "э",
              body: { kind: "binary", op: "mul", left: имя("э"), right: лит(2) },
            },
            in: {
              kind: "let",
              name: "чёт",
              value: {
                kind: "filter",
                over: имя("с"),
                item: "э",
                body: {
                  kind: "binary",
                  op: "eq",
                  left: { kind: "binary", op: "mod", left: имя("э"), right: лит(2) },
                  right: лит(0),
                },
              },
              in: {
                kind: "match",
                target: имя("с"),
                cases: [
                  { pattern: { kind: "empty" }, body: { kind: "builtin", name: "длина", args: [имя("т")] } },
                  { pattern: { kind: "literal", value: [1] }, body: лит(1) },
                  {
                    pattern: { kind: "cons", head: "г", tail: "х" },
                    body: {
                      kind: "binary",
                      op: "concat",
                      left: { kind: "builtin", name: "к строке", args: [имя("сумма")] },
                      right: { kind: "builtin", name: "подстрока", args: [имя("т"), лит(1), лит(1)] },
                    },
                  },
                  { pattern: { kind: "any", bind: "прочее" }, body: имя("сумма") },
                ],
              },
            },
          },
        },
      },
    ],
  })
})

test("постусловия: свой код, своё сообщение и текст по умолчанию", () => {
  требовать("постусловия", {
    flang: 1,
    module: "Свойства",
    functions: [
      {
        name: "Скидка",
        params: [{ name: "с", type: { kind: "number" } }],
        returns: { kind: "number" },
        body: { kind: "binary", op: "percent", left: лит(10), right: имя("с") },
        postconditions: [
          {
            name: "Не больше суммы",
            expr: { kind: "binary", op: "lte", left: имя("результат"), right: имя("с") },
            code: "FTS_UTILITY_PROPERTY",
            message: "скидка больше суммы",
          },
          { name: "Неотрицательна", expr: { kind: "binary", op: "gte", left: имя("результат"), right: лит(0) } },
        ],
      },
    ],
  })
})

test("связывание полей варианта списком имён, а не записью", () => {
  требовать("связка списком", {
    flang: 1,
    module: "Списком",
    types: [{ kind: "sum", name: "С", variants: [{ name: "А", fields: [{ name: "поле", type: { kind: "number" } }] }] }],
    functions: [
      {
        name: "Ф",
        params: [{ name: "х" }],
        returns: {},
        body: {
          kind: "match",
          target: имя("х"),
          cases: [{ pattern: { kind: "variant", name: "А", bind: ["поле"] }, body: имя("поле") }],
        },
      },
    ],
  })
})

test("настройки печати: путь, база индексации, предел глубины", () => {
  требовать("без модуля", { flang: 1, functions: [] })
  требовать("свой путь и база 0", { flang: 1, module: "Имя", functions: [] }, { path: "своё.js", indexBase: 0, maxDepth: 7 })
})

test("одноимённые вариант и функция дают разные идентификаторы", () => {
  /* Вариант получает Pascal, функция — camel, поэтому «Значение операнда» как
     вариант и как функция расходятся сами собой. Проверка на то и стоит, что
     раздача имён у трёх пространств разная. */
  требовать("вариант и функция одного имени", {
    flang: 1,
    module: "Вычислитель",
    types: [
      {
        kind: "sum",
        name: "Операнд",
        variants: [
          { name: "Значение операнда", fields: [{ name: "скаляр", type: { kind: "number" } }] },
          { name: "Пусто", fields: [] },
        ],
      },
    ],
    functions: [
      {
        name: "Значение операнда",
        total: true,
        params: [{ name: "о", type: { kind: "name", name: "Операнд" } }],
        returns: { kind: "number" },
        body: {
          kind: "match",
          target: имя("о"),
          cases: [
            { pattern: { kind: "variant", name: "Значение операнда", bind: { "скаляр": "с" } }, body: имя("с") },
            { pattern: { kind: "variant", name: "Пусто", bind: {} }, body: лит(0) },
          ],
        },
      },
    ],
  })
})

/* ─────────────────── диагностики ─────────────────── */

test("отказы печати: те же тексты, что у эталона", () => {
  const тело = (body) => ({ flang: 1, module: "М", functions: [{ name: "Ф", params: [], returns: {}, body }] })
  сверитьОтказ("неизвестное имя", тело(имя("нет такого")))
  сверитьОтказ("неизвестная функция", тело({ kind: "call", name: "Нету", args: [] }))
  сверитьОтказ("неизвестная форма", тело({ kind: "builtin", name: "нету", args: [] }))
  сверитьОтказ("арность формы", тело({ kind: "builtin", name: "подстрока", args: [лит("а")] }))
  сверитьОтказ("неизвестная операция", тело({ kind: "binary", op: "xor", left: лит(1), right: лит(2) }))
  сверитьОтказ("неизвестный вид выражения", тело({ kind: "нечто" }))
  сверитьОтказ("неверная арность вызова", {
    flang: 1,
    module: "М",
    functions: [{ name: "Ф", params: [{ name: "а" }], returns: {}, body: { kind: "call", name: "Ф", args: [] } }],
  })
  сверитьОтказ("неизвестный вариант", {
    flang: 1,
    module: "М",
    types: [{ kind: "sum", name: "С", variants: [{ name: "А", fields: [] }] }],
    functions: [{ name: "Ф", params: [], returns: {}, body: { kind: "construct", variant: "Б", fields: {} } }],
  })
  сверитьОтказ("неизвестная запись", {
    flang: 1,
    module: "М",
    types: [{ kind: "record", name: "Р", fields: [] }],
    functions: [{ name: "Ф", params: [], returns: {}, body: { kind: "record", type: "Х", fields: {} } }],
  })
  сверитьОтказ("столкновение после транслитерации", {
    flang: 1,
    module: "М",
    functions: [
      { name: "Цена", params: [], returns: {}, body: лит(1) },
      { name: "цена", params: [], returns: {}, body: лит(2) },
    ],
  })
})
