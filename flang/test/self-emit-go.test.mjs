/**
 * Печать flang → Go, написанная на самом flang (`flang/self/emit-go.flang`).
 *
 * Проверка здесь одна и она дифференциальная: для каждой программы репозитория
 * файлы, которые печатает «Печать программы в Go» на flang, обязаны совпасть с
 * тем, что печатает эталон `flang/src/emit/go.mjs`, **побайтово** — включая
 * комментарии, пробелы, порядок временных имён и имена переменных ошибки.
 *
 * Слабее критерий делать нельзя, и причина та же, что записана в шапке
 * `self-emit-c.test.mjs`: «компилируется и работает» не отличает правильную
 * печать от случайно похожей. Два бэкенда могут давать разный Go, который
 * одинаково проходит сетку входов, и разойтись на первом же входе, которого в
 * сетке не было. Побайтовое совпадение исключает это по построению.
 *
 * Сборки настоящим тулчейном Go здесь НЕТ намеренно: её делает
 * `flang/test/emit-go.test.mjs` для эталона, а этот тест сравнивает две печати
 * между собой — ему нужен только Node.
 *
 * ── Тест обязан МЕРЯТЬ, а не только падать ──────────────────────────────────
 * Пока близнец не дописан, «упало» — бесполезный ответ: он одинаков и когда
 * готово 3 программы из 94, и когда 93. Поэтому сверка считает совпавшие и
 * разошедшиеся и печатает числа диагностикой, а падает уже с первым
 * расхождением поимённо: файл, строка, обе версии строки.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { fromFtsDocument } from "../src/compat.mjs"
import { emitGo } from "../src/emit/go.mjs"
import { evaluate } from "../src/interpret.mjs"
import { linkProgram } from "../src/link.mjs"
import { parse } from "../src/parser.mjs"
import { checkTotality, markMeasureGuards } from "../src/totality.mjs"
import { checkTypes } from "../src/types.mjs"
import { globSync } from "./glob.mjs"

const корень = fileURLToPath(new URL("../..", import.meta.url))
const файл = fileURLToPath(new URL("../self/emit-go.flang", import.meta.url))
const исходник = readFileSync(файл, "utf8")

const свой = parse(исходник, "self/emit-go.flang")
const связано = await linkProgram(файл, исходник, parse)
const { diagnostics: диагностикиСвязывания, ...программа } = связано
const типы = checkTypes(программа)
const тотальность = checkTotality(программа)

/**
 * Лимит шагов тот же, что у печати в C: сто миллионов. Он здесь не
 * формальность, а сторож — ловит превращение печати в перебор.
 *
 * Одной программе он мал, и это измерено, а не предположено: собственный
 * исходник этой печати — самая большая программа репозитория (после связывания
 * 606 функций против 425 у `emit-c.flang`), и укладывается она между 130 и 160
 * миллионами шагов. Ей выдан свой бюджет с запасом; остальные сто программ
 * считаются под общим лимитом, поэтому сторож остаётся на месте.
 */
const ШАГИ = { maxSteps: 100_000_000, maxDepth: 10_000 }
const ШАГИ_САМОПРИМЕНЕНИЯ = { maxSteps: 250_000_000, maxDepth: 10_000 }
const САМОПРИМЕНЕНИЕ = "flang/self/emit-go.flang"
const бюджет = (имя) => (имя === САМОПРИМЕНЕНИЕ ? ШАГИ_САМОПРИМЕНЕНИЯ : ШАГИ)
const вызвать = (имя, аргументы, шаги = ШАГИ) => evaluate(программа, имя, аргументы, шаги)

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
const рантайм = (имя) => readFileSync(new URL(`../src/emit/go/${имя}`, import.meta.url), "utf8")
const РАНТАЙМ = {
  "рантайм": рантайм("flang_runtime.go"),
  "исходник прогонщика": рантайм("flang_cli.go"),
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
function напечатать(ast, опции = {}, шаги = ШАГИ) {
  const итог = вызвать("Печать программы в Go", { "программа": значение(ast), "настройки": настройки(опции) }, шаги)
  return { files: итог.файлы.map((файл) => ({ path: файл.путь, content: файл.содержимое })), error: итог.ошибка }
}

/** Файл программы: единственный .go в пакете `flang`. */
function исходникМодуля(файлы) {
  return файлы.find((файл) => файл.path.startsWith("flang/") && файл.path.endsWith(".go")).content
}

/**
 * Побайтовая сверка с эталоном.
 *
 * Возвращает `null` при совпадении и текст первого расхождения иначе — падать
 * решает вызывающий: сводной сверке нужно посчитать все программы, а точечной
 * проверке достаточно первой.
 */
function расхождение(имя, ast, опции = {}, шаги = бюджет(имя)) {
  let эталон = null
  let отказЭталона = null
  try {
    эталон = emitGo(ast, опции)
  } catch (ошибка) {
    отказЭталона = ошибка.message
  }
  let мой = null
  try {
    мой = напечатать(ast, опции, шаги)
  } catch (ошибка) {
    return `${имя}: печать на flang сорвалась: ${ошибка.message}`
  }
  if (отказЭталона !== null) {
    return мой.error === отказЭталона
      ? null
      : `${имя}: текст отказа разошёлся\n  эталон: ${JSON.stringify(отказЭталона)}\n  flang:  ${JSON.stringify(мой.error)}`
  }
  if (мой.error !== "") return `${имя}: печать на flang отказала: ${мой.error}`

  const путиЭталона = эталон.files.map((файл) => файл.path)
  const путиМои = мой.files.map((файл) => файл.path)
  if (путиЭталона.join("|") !== путиМои.join("|")) {
    return `${имя}: набор файлов не совпал\n  эталон: ${путиЭталона.join(", ")}\n  flang:  ${путиМои.join(", ")}`
  }
  for (const [индекс, файл] of эталон.files.entries()) {
    const наш = мой.files[индекс].content
    if (наш === файл.content) continue
    const слева = файл.content.split("\n")
    const справа = наш.split("\n")
    let строка = 0
    while (строка < слева.length && строка < справа.length && слева[строка] === справа[строка]) строка += 1
    return (
      `${имя}: ${файл.path} разошёлся на строке ${строка + 1} (строк: эталон ${слева.length}, flang ${справа.length})\n` +
      `  эталон: ${JSON.stringify(слева[строка])}\n` +
      `  flang:  ${JSON.stringify(справа[строка])}`
    )
  }
  return null
}

/** Побайтовая сверка, падающая на первом же расхождении. */
function сверить(имя, ast, опции = {}) {
  const беда = расхождение(имя, ast, опции)
  if (беда !== null) assert.fail(беда)
}

/** Отказ печати: код и текст обязаны совпасть с тем, что бросает эталон. */
function сверитьОтказ(имя, ast) {
  let ожидаемое = null
  try {
    emitGo(ast)
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
  "flang/self/emit-c.flang",
  "flang/self/emit-go.flang",
].sort()

/**
 * Сводная сверка: считает совпавшие и разошедшиеся и падает с первым
 * расхождением. Числа печатаются диагностикой ВСЕГДА — и при падении тоже.
 */
function свести(t, заголовок, случаи) {
  let совпало = 0
  const беды = []
  for (const [имя, ast, опции] of случаи) {
    const беда = расхождение(имя, ast, опции ?? {})
    if (беда === null) совпало += 1
    else беды.push(беда)
  }
  t.diagnostic(`${заголовок}: совпало побайтово ${совпало} из ${случаи.length}, разошлось ${беды.length}`)
  if (беды.length > 0) {
    assert.fail(`${заголовок}: разошлось ${беды.length} из ${случаи.length}; первое расхождение:\n${беды[0]}`)
  }
}

/* ─────────────────── проверки самой программы ─────────────────── */

test("программа на flang разбирается, связывается, проходит типы и тотальность", () => {
  assert.deepEqual(диагностикиСвязывания, [], "связывание дало диагностики")
  assert.deepEqual(типы.diagnostics ?? [], [], "проверка типов дала диагностики")
  assert.deepEqual(тотальность.diagnostics ?? [], [], "анализ тотальности дал диагностики")
  assert.equal(свой.module, "Печать в Go")
})

test("переиспользование, а не третья реализация обхода AST и транслитерации", () => {
  /* Разбор AST, транслитерация имён, поиск слова в тексте и компоненты
     связности уже сверены побайтово печатью в C. Второй реализации быть не
     должно: она разошлась бы на первом же краевом входе, а найти это можно было
     бы только сверкой двух бэкендов между собой. */
  assert.match(исходник, /использует «Печать в C» из "emit-c\.flang"/u)
  const свои = new Set(свой.functions.map((функция) => функция.name))
  for (const имя of ["Взять поле", "Змейка", "Транслитерировать", "Есть слово", "Компоненты связности", "Собрать функции"]) {
    assert.ok(!свои.has(имя), `«${имя}» переписана заново вместо импорта`)
    assert.ok(программа.functions.some((функция) => функция.name === имя), `«${имя}» не приехала импортом`)
  }
})

/* ─────────────────── дифференциальная сверка ─────────────────── */

test("программы репозитория: Go совпадает с эталоном побайтово", async (t) => {
  assert.ok(программыРепозитория.length >= 30, "программ стало подозрительно мало")
  const случаи = []
  for (const относительный of программыРепозитория) случаи.push([относительный, await разобрать(относительный)])
  свести(t, "программы репозитория", случаи)
})

test("сам эмиттер: печать своего собственного исходника совпадает побайтово", async () => {
  /* Единственная программа, где печать работает над своим же текстом — и над
     текстом печати в C заодно, потому что импортирует её. Если самоприменение
     однажды разойдётся, разойдётся именно здесь. */
  сверить(САМОПРИМЕНЕНИЕ, await разобрать(САМОПРИМЕНЕНИЕ))
})

test("сторож меры: обе реализации понижения ставят его одинаково", async (t) => {
  /* Программы выше приходят БЕЗ отметок: отметку кладёт анализ завершаемости
     (`markMeasureGuards`), а его в той сверке никто не звал. Здесь отметка
     ставится явно — расходиться есть чему: имена сторожей, порядок первой
     встречи текстов и место связки шага наблюдаемы в напечатанном Go. */
  const отмеченные = [
    "flang/stdlib/numbers.flang",
    "flang/stdlib/strings.flang",
    "flang/examples/leetcode/070-climbing-stairs.flang",
  ]
  const случаи = []
  let сотметкой = 0
  for (const относительный of отмеченные) {
    const ast = await разобрать(относительный)
    const помеченная = markMeasureGuards(ast)
    /* Программа без числовой меры отметки не получает — это не беда сверки, а
       свойство корпуса; считаем такие отдельно и требуем, чтобы отмеченная была
       хоть одна, иначе тест зеленел бы вхолостую. */
    if (помеченная !== ast && /FLANG_MEASURE/u.test(emitGo(помеченная).files.map((файл) => файл.content).join(""))) {
      сотметкой += 1
    }
    случаи.push([относительный, помеченная])
  }
  assert.ok(сотметкой > 0, "ни одна программа не получила сторожа меры — сверять нечего")
  t.diagnostic(`программ со сторожем меры в выдаче: ${сотметкой} из ${отмеченные.length}`)
  свести(t, "программы со сторожем меры", случаи)
})

test("модели FTS через compat: постусловия печатаются так же", async (t) => {
  const ядро = await import(new URL("../../dist/src/index.js", import.meta.url).href)
  const { parseModuleFile } = await import(new URL("../../tools/ftsc/src/parse-module.mjs", import.meta.url).href)
  const случаи = []
  for (const файлМодели of globSync("**/*.fts", { cwd: корень }).sort()) {
    if (файлМодели.includes("node_modules")) continue
    let документ
    try {
      документ = ядро.compile(parseModuleFile(join(корень, файлМодели)).source ?? readFileSync(join(корень, файлМодели), "utf8"))
    } catch {
      continue
    }
    if (!Array.isArray(документ?.utilities) || документ.utilities.length === 0) continue
    случаи.push([файлМодели, fromFtsDocument(документ)])
  }
  assert.ok(случаи.length >= 10, `моделей с утилитами набрано ${случаи.length} — слишком мало`)
  свести(t, "модели FTS", случаи)
})

/* ─────────────────── случаи, которых в репозитории нет ─────────────────── */

const имя = (name) => ({ kind: "var", name })
const лит = (value) => ({ kind: "literal", value })

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
  сверить("батут", батут)
  const исходникGo = исходникМодуля(напечатать(батут).files)
  assert.ok(исходникGo.includes("rt.Trampoline(ctx, shagChyotnoe"), "батута в выдаче нет")
  assert.ok(исходникGo.includes("bounce.Next = shagNechyotnoe"), "отскока в выдаче нет")
})

test("батут без параметров: args не объявляется, а гасится", () => {
  const программаБезПараметров = {
    flang: 1,
    module: "Пинг",
    functions: [
      { name: "Пинг", params: [], returns: { kind: "number" }, body: { kind: "call", name: "Понг", args: [] } },
      { name: "Понг", params: [], returns: { kind: "number" }, body: { kind: "call", name: "Пинг", args: [] } },
    ],
  }
  сверить("батут без параметров", программаБезПараметров)
})

test("одноимённые вариант и функция дают разные идентификаторы", () => {
  /* Тот самый дефект, ради которого в идентификатор вошла роль: без неё
     «Значение операнда» как вариант и как функция сходились в одно объявление
     пакета, то есть `redeclared in this block`. */
  const программаСтолкновения = {
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
  }
  сверить("вариант и функция одного имени", программаСтолкновения)
  const исходникGo = исходникМодуля(напечатать(программаСтолкновения).files)
  assert.ok(исходникGo.includes("func VariantZnachenieOperanda("), "конструктор варианта потерял роль")
  assert.ok(исходникGo.includes("func ZnachenieOperanda("), "функция потеряла своё имя")
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
  сверить("самовызов в цикл", обмен)
  const исходникGo = исходникМодуля(напечатать(обмен).files)
  assert.ok(исходникGo.includes("for {"), "цикла нет")
  assert.ok(исходникGo.includes("continue"), "переприсваивания нет")
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
            лит('а"б\\в?г \t\n'),
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

test("двунаправленные управляющие уезжают в \\uXXXX и в литерале, и в комментарии", () => {
  /* В корпусе таких символов нет, и это ровно та причина, по которой случай
     нужен здесь: имя flang попадает не только в строковый литерал, но и в
     комментарий («Ident — функция flang «…»»), а комментарий читают первым и
     проверить исполнением не могут (Trojan Source, CVE-2021-42574).

     Символы задаются кодами, а не буквами: иначе этот файл воспроизводил бы
     ровно ту беду, от которой стережёт. */
  const RLO = String.fromCodePoint(0x202e)
  const PDF = String.fromCodePoint(0x202c)
  const программаСБиди = {
    flang: 1,
    module: "Раскладка",
    functions: [
      {
        name: `Цена${RLO}скидки${PDF}`,
        params: [],
        returns: { kind: "string" },
        body: лит(`итог${RLO}назад${PDF}`),
      },
    ],
  }
  сверить("двунаправленные", программаСБиди)
  const текст = напечатать(программаСБиди).files.map((файл) => файл.content).join("\n")
  assert.ok(!текст.includes(RLO) && !текст.includes(PDF), "сырой двунаправленный уехал в выдачу")
  assert.ok(текст.includes("\\u202e") && текст.includes("\\u202c"), "экранированной формы в выдаче нет")
})

test("синонимы встроенных форм и «к числу или беда»: канон тот же, что у эталона", () => {
  /* Ни одного синонима корпус не пишет, а таблица у эталона на десять имён.
     «к числу или беда» тоже не встречается ни в одной программе репозитория —
     и именно поэтому обе таблицы разошлись бы молча. */
  сверить("синонимы форм", {
    flang: 1,
    module: "Синонимы",
    functions: [
      {
        name: "Всё",
        params: [{ name: "т", type: { kind: "string" } }, { name: "с" }],
        returns: {},
        body: {
          kind: "list",
          items: [
            { kind: "builtin", name: "символ в", args: [имя("т"), лит(1)] },
            { kind: "builtin", name: "элемент в", args: [имя("с"), лит(1)] },
            { kind: "builtin", name: "начинается", args: [имя("т"), лит("а")] },
            { kind: "builtin", name: "остаток", args: [лит(7), лит(2)] },
            { kind: "builtin", name: "процентов", args: [лит(10), лит(200)] },
            { kind: "builtin", name: "код_символа", args: [имя("т")] },
            { kind: "builtin", name: "charCode", args: [имя("т")] },
            { kind: "builtin", name: "к_числу", args: [имя("т")] },
            { kind: "builtin", name: "к_числу_или_беда", args: [имя("т")] },
            { kind: "builtin", name: "к_строке", args: [лит(1)] },
            { kind: "builtin", name: "к числу или беда", args: [имя("т")] },
            { kind: "field", target: имя("с"), field: "поле" },
          ],
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

test("настройки печати: путь, база индексации, пределы, без прогонщика", () => {
  сверить("без модуля", { flang: 1, functions: [] })
  сверить("без модуля, без прогонщика", { flang: 1, functions: [] }, { cli: false })
  сверить("свой путь и база 0", { flang: 1, module: "Имя", functions: [] }, { path: "своё", indexBase: 0, maxDepth: 7, maxSteps: 42 })
  const свои = напечатать({ flang: 1, module: "Имя", functions: [] }, { path: "своё", indexBase: 0, maxDepth: 7, maxSteps: 42 })
  const исходникGo = исходникМодуля(свои.files)
  assert.ok(исходникGo.includes("ctx.IndexBase = 0"), "база индексации не доехала")
  assert.ok(исходникGo.includes("ctx.MaxDepth = 7"), "предел глубины не доехал")
  assert.ok(исходникGo.includes("ctx.MaxSteps = 42"), "предел шагов не доехал")
  /* Свой путь берётся дословно и НЕ транслитерируется: `options.path` — это имя
     файла, которое назвал вызывающий, а не имя модели. */
  assert.ok(свои.files.some((файл) => файл.path === "flang/своё.go"), "свой путь не доехал")
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
  сверитьОтказ("имя модели столкнулось с ролью", {
    flang: 1,
    module: "М",
    types: [{ kind: "sum", name: "С", variants: [{ name: "Х", fields: [] }] }],
    functions: [{ name: "Вариант Х", params: [], returns: {}, body: лит(1) }],
  })
})

/* ─────────────────── измеренная граница близнеца ─────────────────── */

/**
 * Порченый AST: сюда близнец не дотягивается, и это измерено, а не сказано.
 *
 * У эталона проверки формы живут в `prepare` и `requireExpr` — «функция «Ф»
 * объявлена дважды», «поле «params» должно быть списком», «ожидалось выражение,
 * получено null». Ни печать в C на flang, ни эта их не переносят: из разборщика
 * такой AST не выходит, а приходит он только от того, кто зовёт бэкенд
 * библиотекой напрямую.
 *
 * Граница держится числом, а не словом. Тест НЕ требует нуля расхождений — он
 * требует, чтобы их не стало БОЛЬШЕ: сегодня совпадает 1 случай из 14. Закроет
 * кто-то часть — число упадёт, и тест попросит вписать новое; отвалится
 * что-то — тест покраснеет сразу.
 */
test("граница на порченом AST: расхождений не больше, чем было измерено", (t) => {
  const тело = (body) => ({ flang: 1, module: "М", functions: [{ name: "Ф", params: [], returns: {}, body }] })
  const простая = (тело) => ({ flang: 1, functions: [{ name: "Ф", params: [], body: тело }] })
  const случаи = [
    ["программа не объект", null],
    ["functions не список", { flang: 1, functions: "нет" }],
    ["функция без имени", { flang: 1, functions: [{ params: [], body: лит(1) }] }],
    ["функция объявлена дважды", { flang: 1, functions: [простая(лит(1)).functions[0], простая(лит(2)).functions[0]] }],
    ["у функции нет тела", { flang: 1, functions: [{ name: "Ф", params: [] }] }],
    ["params не список", { flang: 1, functions: [{ name: "Ф", params: "нет", body: лит(1) }] }],
    ["параметр без имени", { flang: 1, functions: [{ name: "Ф", params: [{}], body: лит(1) }] }],
    ["postconditions не список", { flang: 1, functions: [{ name: "Ф", params: [], body: лит(1), postconditions: "нет" }] }],
    ["постусловие без expr", { flang: 1, functions: [{ name: "Ф", params: [], body: лит(1), postconditions: [{ name: "П" }] }] }],
    ["ветка если равна null", тело({ kind: "if", cond: лит(true), then: null, else: лит(1) })],
    ["args формы не список", тело({ kind: "builtin", name: "длина", args: "нет" })],
    ["items списка не список", тело({ kind: "list", items: "нет" })],
    ["cases разбора не список", тело({ kind: "match", target: лит(1), cases: "нет" })],
    ["случай без pattern", тело({ kind: "match", target: лит(1), cases: [{ body: лит(1) }] })],
  ]

  let совпало = 0
  const разошлись = []
  for (const [имя, ast] of случаи) {
    let ожидалось = "НЕ ОТКАЗАЛ"
    try {
      emitGo(ast)
    } catch (ошибка) {
      ожидалось = ошибка.message
    }
    let наше = "НЕ ОТКАЗАЛ"
    try {
      наше = напечатать(ast).error || "НЕ ОТКАЗАЛ"
    } catch (ошибка) {
      наше = `СОРВАЛОСЬ: ${ошибка.message}`
    }
    if (ожидалось === наше) совпало += 1
    else разошлись.push(`${имя}: эталон «${ожидалось}», flang «${наше}»`)
  }

  t.diagnostic(`порченый AST: совпало ${совпало} из ${случаи.length}, расходится ${разошлись.length}`)
  assert.ok(
    разошлись.length <= 13,
    `расхождений стало ${разошлись.length} вместо 13 — граница поехала:\n  ${разошлись.join("\n  ")}`,
  )
  assert.ok(
    совпало >= 1,
    `совпадений стало ${совпало} вместо 1 — отвалилось то, что работало:\n  ${разошлись.join("\n  ")}`,
  )
})
