/**
 * Печать flang → Elixir, написанная на самом flang (`flang/self/emit-elixir.flang`).
 *
 * Проверка здесь одна и она дифференциальная: для каждой программы репозитория
 * файлы, которые печатает «Печать программы» на flang, обязаны совпасть с тем,
 * что печатает эталон `flang/src/emit/elixir.mjs`, **побайтово** — включая
 * комментарии, пробелы, порядок временных имён и приставки «_» у погашенных
 * связываний.
 *
 * Слабее критерий делать нельзя. «Компилируется и работает» не отличает
 * правильную печать от случайно похожей: два бэкенда могут давать разный Elixir,
 * который одинаково проходит сетку входов, и разойтись на первом же входе,
 * которого в сетке не было. Побайтовое совпадение исключает это по построению.
 *
 * Пока близнец не дописан, тест ЧЕСТНО КРАСЕН и при этом МЕРЯЕТ: он печатает,
 * на скольких программах совпало побайтово, на скольких разошлось, и показывает
 * первое расхождение с номером строки и обеими редакциями.
 *
 * Тулчейн Elixir здесь не нужен вовсе: сравниваются две печати, а не два
 * запуска. Сборку напечатанного проверяет `emit-elixir.test.mjs`.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { fromFtsDocument } from "../src/compat.mjs"
import { emitElixir } from "../src/emit/elixir.mjs"
import { evaluate } from "../src/interpret.mjs"
import { linkProgram } from "../src/link.mjs"
import { parse } from "../src/parser.mjs"
import { checkTotality } from "../src/totality.mjs"
import { checkTypes } from "../src/types.mjs"
import { globSync } from "./glob.mjs"

const корень = fileURLToPath(new URL("../..", import.meta.url))
const файл = fileURLToPath(new URL("../self/emit-elixir.flang", import.meta.url))
const исходник = readFileSync(файл, "utf8")

const свой = parse(исходник, "self/emit-elixir.flang")
const связано = await linkProgram(файл, исходник, parse)
const { diagnostics: диагностикиСвязывания, ...программа } = связано
const типы = checkTypes(программа)
const тотальность = checkTotality(программа)

/** Лимит шагов — как у печати в C: печать работает с целым AST сразу. */
const ШАГИ = { maxSteps: 200_000_000, maxDepth: 10_000 }
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

/* Рантайм печатается дословно и приходит параметром: читать файлы язык не
   умеет и не должен. Берём те же самые файлы, что берёт эталон. */
const рантайм = (имя) => readFileSync(new URL(`../src/emit/elixir/${имя}`, import.meta.url), "utf8")
const РАНТАЙМ = {
  "рантайм исходник": рантайм("flang_runtime.ex"),
  "исходник прогонщика": рантайм("flang_cli.ex"),
  "исходник конкурентности": рантайм("flang_conc.ex"),
}

function настройки(опции = {}) {
  return {
    "путь": опции.path ?? "",
    "есть путь": опции.path !== undefined,
    "база": опции.indexBase === 0 ? 0 : 1,
    "предел глубины": опции.maxDepth ?? 10_000,
    "предел шагов": опции.maxSteps ?? 1_000_000,
    "прогонщик": опции.cli !== false,
    ...РАНТАЙМ,
  }
}

/** Печать на flang: список файлов в той же форме, что у эталона. */
function напечатать(ast, опции = {}) {
  const итог = вызвать("Печать программы", { "программа": значение(ast), "настройки": настройки(опции) })
  return { files: итог.файлы.map((файл) => ({ path: файл.путь, content: файл.содержимое })), error: итог.ошибка }
}

/**
 * Побайтовая сверка с эталоном. Возвращает `null` при совпадении либо текст
 * первого расхождения: имя файла, номер строки и обе редакции.
 */
function расхождение(имя, ast, опции = {}) {
  let эталон
  try {
    эталон = emitElixir(ast, опции)
  } catch (ошибка) {
    return `${имя}: эталон отказал (${ошибка.message}) — сверять нечего`
  }
  let мой
  try {
    мой = напечатать(ast, опции)
  } catch (ошибка) {
    return `${имя}: печать на flang сорвалась: ${ошибка.message}`
  }
  if (мой.error !== "") return `${имя}: печать на flang отказала: ${мой.error}`
  const пути = мой.files.map((файл) => файл.path)
  const ожидаемые = эталон.files.map((файл) => файл.path)
  if (пути.join("|") !== ожидаемые.join("|")) {
    return `${имя}: набор файлов не совпал\n  эталон: ${ожидаемые.join(", ")}\n  flang:  ${пути.join(", ")}`
  }
  for (const [индекс, файл] of эталон.files.entries()) {
    const наш = мой.files[индекс].content
    if (наш === файл.content) continue
    const слева = файл.content.split("\n")
    const справа = наш.split("\n")
    let строка = 0
    while (строка < слева.length && строка < справа.length && слева[строка] === справа[строка]) строка += 1
    return (
      `${имя}: ${файл.path} разошёлся на строке ${строка + 1}\n` +
      `  эталон: ${JSON.stringify(слева[строка])}\n` +
      `  flang:  ${JSON.stringify(справа[строка])}`
    )
  }
  return null
}

/** Побайтовая сверка, падающая при первом же расхождении. */
function сверить(имя, ast, опции = {}) {
  const беда = расхождение(имя, ast, опции)
  assert.equal(беда, null, беда ?? "")
}

/** Отказ печати: код и текст обязаны совпасть с тем, что бросает эталон. */
function сверитьОтказ(имя, ast) {
  let ожидаемое = null
  try {
    emitElixir(ast)
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

const обычныеПрограммы = [
  ...globSync("flang/stdlib/*.flang", { cwd: корень }),
  ...globSync("flang/examples/*.flang", { cwd: корень }),
  ...globSync("flang/examples/leetcode/*.flang", { cwd: корень }),
  ...globSync("flang/core/*.flang", { cwd: корень }),
  "flang/self/emit-c.flang",
  "flang/self/emit-elixir.flang",
].sort()

/** Программы с процессами: только у них печатается четвёртый файл. */
const программыСПроцессами = globSync("flang/conc/examples/*.flang", { cwd: корень }).sort()

/* ─────────────────── проверки самой программы ─────────────────── */

test("программа на flang разбирается, связывается, проходит типы и тотальность", () => {
  assert.deepEqual(диагностикиСвязывания, [], "связывание с core/json.flang дало диагностики")
  assert.deepEqual(типы.diagnostics ?? [], [], "проверка типов дала диагностики")
  assert.deepEqual(тотальность.diagnostics ?? [], [], "анализ тотальности дал диагностики")
  assert.equal(свой.module, "Печать в Elixir")
})

test("переиспользование core/json.flang, а не вторая печать строк и чисел", () => {
  assert.match(исходник, /использует «Печать JSON» из "\.\.\/core\/json\.flang" только /u)
  const свои = new Set(свой.functions.map((функция) => функция.name))
  for (const имя of ["Заменить всё", "Печать строки", "Печать массива"]) {
    assert.ok(!свои.has(имя), `«${имя}» переписана заново вместо импорта`)
  }
})

/* ─────────────────── дифференциальная сверка с числами ─────────────────── */

test("программы репозитория: Elixir совпадает с эталоном побайтово", async (t) => {
  const беды = []
  for (const относительный of обычныеПрограммы) {
    const беда = расхождение(относительный, await разобрать(относительный))
    if (беда !== null) беды.push(беда)
  }
  const всего = обычныеПрограммы.length
  t.diagnostic(`побайтово совпало на ${всего - беды.length} программах из ${всего}, разошлось на ${беды.length}`)
  assert.equal(
    беды.length,
    0,
    `совпало ${всего - беды.length} из ${всего}, разошлось ${беды.length}.\nПервое расхождение:\n${беды[0] ?? ""}`,
  )
})

test("программы с процессами: конкурентность печатается так же", async (t) => {
  const беды = []
  for (const относительный of программыСПроцессами) {
    const беда = расхождение(относительный, await разобрать(относительный))
    if (беда !== null) беды.push(беда)
  }
  const всего = программыСПроцессами.length
  assert.ok(всего >= 5, "программ с процессами стало подозрительно мало")
  t.diagnostic(`с процессами совпало ${всего - беды.length} из ${всего}, разошлось ${беды.length}`)
  assert.equal(
    беды.length,
    0,
    `совпало ${всего - беды.length} из ${всего}, разошлось ${беды.length}.\nПервое расхождение:\n${беды[0] ?? ""}`,
  )
})

test("модели FTS через compat: постусловия печатаются так же", async (t) => {
  const ядро = await import(new URL("../../dist/src/index.js", import.meta.url).href)
  const { parseModuleFile } = await import(new URL("../../tools/ftsc/src/parse-module.mjs", import.meta.url).href)
  const беды = []
  let сверено = 0
  for (const файлМодели of globSync("**/*.fts", { cwd: корень }).sort()) {
    if (файлМодели.includes("node_modules")) continue
    let документ
    try {
      документ = ядро.compile(parseModuleFile(join(корень, файлМодели)).source ?? readFileSync(join(корень, файлМодели), "utf8"))
    } catch {
      continue
    }
    if (!Array.isArray(документ?.utilities) || документ.utilities.length === 0) continue
    сверено += 1
    const беда = расхождение(файлМодели, fromFtsDocument(документ))
    if (беда !== null) беды.push(беда)
  }
  assert.ok(сверено >= 10, `моделей с утилитами сверено ${сверено} — слишком мало`)
  t.diagnostic(`моделей совпало ${сверено - беды.length} из ${сверено}, разошлось ${беды.length}`)
  assert.equal(
    беды.length,
    0,
    `совпало ${сверено - беды.length} из ${сверено}, разошлось ${беды.length}.\nПервое расхождение:\n${беды[0] ?? ""}`,
  )
})

/* ─────────────────── случаи, которых в репозитории нет ─────────────────── */

const имя = (name) => ({ kind: "var", name })
const лит = (value) => ({ kind: "literal", value })

test("взаимная хвостовая рекурсия: тела уезжают в loop_… одинаково", () => {
  сверить("батут", {
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
  })
})

test("одноимённые вариант и функция дают разные идентификаторы", () => {
  сверить("вариант и функция одного имени", {
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

test("литералы всех видов: NaN, бесконечности, минус ноль, 1e21, вложенное", () => {
  сверить("литералы", {
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
            лит('а"б\\в#{г} '),
            лит([1, [2, 3], { "поле": "значение" }]),
            лит({ variant: "Нет", fields: {} }),
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
  сверить("формы и циклы", {
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
  сверить("постусловия", {
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
  сверить("связка списком", {
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

test("настройки печати: путь, база индексации, предел глубины, без прогонщика", () => {
  сверить("без модуля", { flang: 1, functions: [] })
  сверить("без модуля, без прогонщика", { flang: 1, functions: [] }, { cli: false })
  сверить("свой путь и база 0", { flang: 1, module: "Имя", functions: [] }, { path: "Своё", indexBase: 0, maxDepth: 7 })
})

/* ─────────────────── диагностики ─────────────────── */

test("отказы печати: те же коды и тексты, что у эталона", () => {
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
  сверитьОтказ("имя модуля занято рантаймом", { flang: 1, module: "Flang", functions: [] })
  сверитьОтказ("файл занят рантаймом", { flang: 1, module: "flang runtime", functions: [] })
})
