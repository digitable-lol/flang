/**
 * Печать flang → Python, написанная на самом flang (`flang/self/emit-python.flang`).
 *
 * Проверка здесь одна и она дифференциальная: для каждой программы репозитория
 * файлы, которые печатает «Печать программы» на flang, обязаны совпасть с тем,
 * что печатает эталон `flang/src/emit/python.mjs`, **побайтово** — включая
 * комментарии, отступы, строки документации и порядок временных имён.
 *
 * Слабее критерий делать нельзя. «Импортируется и работает» не отличает
 * правильную печать от случайно похожей: два бэкенда могут давать разный Python,
 * который одинаково проходит сетку входов, и разойтись на первом же входе,
 * которого в сетке не было. Побайтовое совпадение исключает это по построению.
 *
 * У Python против C своя трудность, и она стоит первой: значимые отступы. Блок
 * закрывается не скобкой, а возвратом отступа, поэтому лишний или потерянный
 * пробел — не косметика, а другая программа. Побайтовая сверка ловит это сразу.
 *
 * Пока перевод не закончен, тест ЧЕСТНО КРАСНЕЕТ и при этом МЕРИТ: он печатает
 * «совпало N программ из M, файлов K из L» и показывает первое расхождение с
 * номером строки. Число совпавших программ — единственная мера готовности; по
 * ней и пишутся темы коммитов.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { fromFtsDocument } from "../src/compat.mjs"
import { emitPython } from "../src/emit/python.mjs"
import { evaluate } from "../src/interpret.mjs"
import { linkProgram } from "../src/link.mjs"
import { parse } from "../src/parser.mjs"
import { checkTotality, markMeasureGuards } from "../src/totality.mjs"
import { checkTypes } from "../src/types.mjs"
import { безГраницы, долгБылНайден } from "./entry-debt.mjs"
import { globSync } from "./glob.mjs"

const корень = fileURLToPath(new URL("../..", import.meta.url))
const файл = fileURLToPath(new URL("../self/emit-python.flang", import.meta.url))
const исходник = readFileSync(файл, "utf8")

const свой = parse(исходник, "self/emit-python.flang")
const связано = await linkProgram(файл, исходник, parse)
const { diagnostics: диагностикиСвязывания, ...программа } = связано
const типы = checkTypes(программа)
const тотальность = checkTotality(программа)

/**
 * Лимит шагов — тот же, что у печати в C: печать это работа с целым AST сразу,
 * и самая большая программа репозитория укладывается в сотню миллионов шагов.
 * Лимит здесь не формальность: он ловит превращение печати в перебор.
 */
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
const рантайм = (имя) => readFileSync(new URL(`../src/emit/python/${имя}`, import.meta.url), "utf8")
const РАНТАЙМ = {
  "рантайм исходник": рантайм("flang_runtime.py"),
  "исходник прогонщика": рантайм("flang_cli.py"),
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

/** Первое расхождение двух текстов: номер строки и обе строки. */
function расхождение(эталон, наш) {
  const слева = эталон.split("\n")
  const справа = наш.split("\n")
  let строка = 0
  while (строка < слева.length && строка < справа.length && слева[строка] === справа[строка]) строка += 1
  return `строка ${строка + 1}\n  эталон: ${JSON.stringify(слева[строка])}\n  flang:  ${JSON.stringify(справа[строка])}`
}

/**
 * Сверка одной программы. Возвращает отчёт числами, а не бросает: корпусный
 * тест обязан назвать, СКОЛЬКО совпало, а не только что что-то не совпало.
 */
function сверить(имя, ast, опции = {}) {
  const эталон = emitPython(ast, опции)
  let мой
  try {
    мой = напечатать(ast, опции)
  } catch (ошибка) {
    return { совпало: false, файлов: 0, всего: эталон.files.length, беда: `${имя}: печать отказала — ${ошибка.message}` }
  }
  if (мой.error !== "") {
    return { совпало: false, файлов: 0, всего: эталон.files.length, беда: `${имя}: печать на flang отказала: ${мой.error}` }
  }
  const пути = мой.files.map((файл) => файл.path).join(", ")
  const ожидаемые = эталон.files.map((файл) => файл.path).join(", ")
  if (пути !== ожидаемые) {
    return { совпало: false, файлов: 0, всего: эталон.files.length, беда: `${имя}: набор файлов не совпал\n  эталон: ${ожидаемые}\n  flang:  ${пути}` }
  }
  /* ДОЛГ БЛИЗНЕЦА, НАЗВАННЫЙ И ВЫЧТЕННЫЙ: печати ГРАНИЦЫ ВХОДА у него нет, а у
     эталона она появилась после того, как ветка была написана. Блок вырезается
     по двум меткам, всё остальное сверяется побайтово, и пропажа блока красит
     сверку отдельно — см. `flang/test/entry-debt.mjs`. */
  let файлов = 0
  let беда = null
  let блоков = 0
  for (const [индекс, файл] of эталон.files.entries()) {
    const { текст: ожидаемое, былаГраница, беда: сломано } = безГраницы(файл.content, "python")
    if (сломано !== null) {
      if (беда === null) беда = `${имя}: ${файл.path}: ${сломано}`
      continue
    }
    if (былаГраница) блоков += 1
    if (мой.files[индекс].content === ожидаемое) {
      файлов += 1
      continue
    }
    if (беда === null) беда = `${имя}: ${файл.path} разошёлся на ${расхождение(ожидаемое, мой.files[индекс].content)}`
  }
  const пропал = долгБылНайден(блоков, эталон.files)
  if (беда === null && пропал !== null) беда = `${имя}: ${пропал}`
  return { совпало: беда === null, файлов, всего: эталон.files.length, беда }
}

/** Отказ печати: код и текст обязаны совпасть с тем, что бросает эталон. */
function сверитьОтказ(имя, ast) {
  let ожидаемое = null
  try {
    emitPython(ast)
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
  "flang/self/emit-python.flang",
].sort()

/* ─────────────────── проверки самой программы ─────────────────── */

test("программа на flang разбирается, связывается, проходит типы и тотальность", () => {
  assert.deepEqual(диагностикиСвязывания, [], "связывание с core/json.flang дало диагностики")
  assert.deepEqual(типы.diagnostics ?? [], [], "проверка типов дала диагностики")
  assert.deepEqual(тотальность.diagnostics ?? [], [], "анализ тотальности дал диагностики")
  assert.equal(свой.module, "Печать в Python")
  const свои = new Set(свой.functions.map((функция) => функция.name))
  const доказанные = свой.functions.filter((функция) => функция.total === true)
  assert.ok(свои.size >= 250, `функций стало ${свои.size} — файл подменили?`)
  assert.ok(доказанные.length * 2 > свои.size, "тотальных функций стало меньше половины")
})

test("переиспользование core/json.flang, а не вторая печать замен", () => {
  /* Замена подстроки уже доказана побайтово на 56 моделях. Второй реализации
     быть не должно: она разошлась бы на первом же краевом входе. */
  assert.match(исходник, /использует «Печать JSON» из "\.\.\/core\/json\.flang" только /u)
  const свои = new Set(свой.functions.map((функция) => функция.name))
  assert.ok(!свои.has("Заменить всё"), "«Заменить всё» переписана заново вместо импорта")
  assert.ok(программа.functions.some((функция) => функция.name === "Заменить всё"), "«Заменить всё» не приехала импортом")
})

/* ─────────────────── дифференциальная сверка ─────────────────── */

test("программы репозитория: Python совпадает с эталоном побайтово", async (t) => {
  assert.ok(программыРепозитория.length >= 30, "программ стало подозрительно мало")
  let совпало = 0
  let файлов = 0
  let всего = 0
  const беды = []
  for (const относительный of программыРепозитория) {
    const отчёт = сверить(относительный, await разобрать(относительный))
    if (отчёт.совпало) совпало += 1
    файлов += отчёт.файлов
    всего += отчёт.всего
    if (отчёт.беда !== null && отчёт.беда !== undefined) беды.push(отчёт.беда)
  }
  t.diagnostic(`побайтово совпало программ ${совпало} из ${программыРепозитория.length}, файлов ${файлов} из ${всего}`)
  assert.equal(
    совпало,
    программыРепозитория.length,
    `совпало ${совпало} из ${программыРепозитория.length} (файлов ${файлов} из ${всего}); первое расхождение:\n${беды[0]}`,
  )
})

test("модели FTS через compat: постусловия печатаются так же", async (t) => {
  const ядро = await import(new URL("../../dist/src/index.js", import.meta.url).href)
  const { parseModuleFile } = await import(new URL("../../tools/ftsc/src/parse-module.mjs", import.meta.url).href)
  let сверено = 0
  let совпало = 0
  const беды = []
  for (const файлМодели of globSync("**/*.fts", { cwd: корень }).sort()) {
    if (файлМодели.includes("node_modules")) continue
    let документ
    try {
      документ = ядро.compile(parseModuleFile(join(корень, файлМодели)).source ?? readFileSync(join(корень, файлМодели), "utf8"))
    } catch {
      continue
    }
    if (!Array.isArray(документ?.utilities) || документ.utilities.length === 0) continue
    const отчёт = сверить(файлМодели, fromFtsDocument(документ))
    сверено += 1
    if (отчёт.совпало) совпало += 1
    else if (отчёт.беда !== null && отчёт.беда !== undefined) беды.push(отчёт.беда)
  }
  assert.ok(сверено >= 10, `моделей с утилитами сверено ${сверено} — слишком мало`)
  t.diagnostic(`моделей .fts побайтово совпало ${совпало} из ${сверено}`)
  assert.equal(совпало, сверено, `совпало ${совпало} из ${сверено}; первое расхождение:\n${беды[0]}`)
})

test("сторож меры: обе реализации понижения ставят его одинаково", async (t) => {
  /* Программы выше приходят сюда БЕЗ отметок: отметку кладёт анализ
     завершаемости (`markMeasureGuards`), а его в той сверке никто не звал.
     Здесь отметка ставится явно: расходиться есть чему — имена сторожей,
     порядок первой встречи и место связки шага видны в напечатанном Python.

     Отметок анализ кладёт ДВА вида, и берутся здесь не оба. `measures` —
     постоянный числовой шаг — есть у двух программ корпуса, и они сверяются
     побайтово. `descents` — объявленная автором мера — есть у сорока одной, и
     сторожа по ним `flang/self/defunc.flang` НЕ СТАВИТ вовсе: он читает поле
     «measures» и про «descents» не знает. Это чужой долг, не долг этой печати:
     понижение общее на все восемь целей, и ровно из-за него держится красным
     `self-emit-c.test.mjs` («сторож меры»). Закрывать его надо в defunc.flang,
     и тогда сюда войдут все сорок три. */
  const отмеченные = ["flang/stdlib/lists.flang", "flang/stdlib/strings.flang"]
  let совпало = 0
  const беды = []
  for (const относительный of отмеченные) {
    const ast = await разобрать(относительный)
    const помеченная = markMeasureGuards(ast)
    assert.notEqual(помеченная, ast, `${относительный}: числовой меры больше нет — программу переписали?`)
    assert.match(
      emitPython(помеченная).files.map((файл) => файл.content).join(""),
      /FLANG_MEASURE/u,
      `${относительный}: сторожа меры нет и в эталоне — сверять нечего`,
    )
    const отчёт = сверить(относительный, помеченная)
    if (отчёт.совпало) совпало += 1
    else if (отчёт.беда) беды.push(отчёт.беда)
  }
  t.diagnostic(`программ со сторожами совпало ${совпало} из ${отмеченные.length}`)
  assert.equal(совпало, отмеченные.length, `первое расхождение:\n${беды[0]}`)
  /* Долг назван числом, а не словом: пока `defunc.flang` не знает «descents»,
     сторожа объявленной меры не печатает ни одна цель самоприменения. Число
     упадёт до нуля в тот день, когда долг закроют, — и тест скажет об этом. */
  let сОбъявленной = 0
  for (const относительный of программыРепозитория) {
    const помеченная = markMeasureGuards(await разобрать(относительный))
    if (Array.isArray(помеченная.descents) && помеченная.descents.length > 0) сОбъявленной += 1
  }
  t.diagnostic(`программ с объявленной мерой, сторожа которой самоприменение пока не ставит: ${сОбъявленной}`)
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

/** Сверка отдельного случая: здесь падать сразу правильно — случай один. */
function сверитьСлучай(имя, ast, опции = {}) {
  const отчёт = сверить(имя, ast, опции)
  assert.ok(отчёт.совпало, отчёт.беда ?? `${имя}: не совпало`)
}

test("взаимная хвостовая рекурсия: батут печатается так же", () => {
  сверитьСлучай("батут", батут)
  const исходникPython = напечатать(батут).files.find((файл) => файл.path === "chyotnost.py").content
  assert.ok(исходникPython.includes("rt.trampoline(ctx, step_chyotnoe"), "батута в выдаче нет")
  assert.ok(исходникPython.includes("bounce.next = step_nechyotnoe"), "отскока в выдаче нет")
})

test("батут без параметров: args не распаковывается", () => {
  const программаБезПараметров = {
    flang: 1,
    module: "Пинг",
    functions: [
      { name: "Пинг", params: [], returns: { kind: "number" }, body: { kind: "call", name: "Понг", args: [] } },
      { name: "Понг", params: [], returns: { kind: "number" }, body: { kind: "call", name: "Пинг", args: [] } },
    ],
  }
  сверитьСлучай("батут без параметров", программаБезПараметров)
})

test("одноимённые вариант и функция дают разные идентификаторы", () => {
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
  сверитьСлучай("вариант и функция одного имени", программаСтолкновения)
  const текст = напечатать(программаСтолкновения).files.find((файл) => файл.path === "vychislitel.py").content
  assert.ok(текст.includes("def v_znachenie_operanda("), "конструктор варианта потерял роль")
  assert.ok(текст.includes("def fn_znachenie_operanda("), "функция потеряла свою роль")
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
  сверитьСлучай("самовызов в цикл", обмен)
  const текст = напечатать(обмен).files.find((файл) => файл.path === "obmen.py").content
  assert.ok(текст.includes("while True:"), "цикла нет")
  assert.ok(текст.includes("continue"), "переприсваивания нет")
})

test("литералы всех видов: NaN, бесконечности, минус ноль, 1e21, вложенное", () => {
  сверитьСлучай("литералы", {
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

test("целых чисел в напечатанном коде нет: каждое число — float", () => {
  /* Тот самый разлад Python с flang: `2 ** 70` в int точен, а в IEEE-754 нет.
     Литерал без точки и экспоненты сделал бы напечатанную программу другой. */
  const текст = напечатать({
    flang: 1,
    module: "Числа",
    functions: [{ name: "Ф", params: [], returns: {}, body: лит(7) }],
  }).files.find((файл) => файл.path === "chisla.py").content
  assert.ok(текст.includes("rt.number(7.0)"), "целое напечатано без дробной части")
})

test("формы, свёртки, отображения, фильтры и все виды образцов", () => {
  сверитьСлучай("формы и циклы", {
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
  сверитьСлучай("постусловия", {
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
  сверитьСлучай("связка списком", {
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

test("неиспользованное связывание гасится в «_», а не остаётся мусором", () => {
  const программаБезГоловы = {
    flang: 1,
    module: "Гашение",
    functions: [
      {
        name: "Ф",
        params: [{ name: "с" }],
        returns: {},
        body: {
          kind: "match",
          target: имя("с"),
          cases: [
            { pattern: { kind: "cons", head: "г", tail: "х" }, body: имя("х") },
            { pattern: { kind: "any" }, body: лит(0) },
          ],
        },
      },
    ],
  }
  сверитьСлучай("гашение головы", программаБезГоловы)
  const текст = напечатать(программаБезГоловы).files.find((файл) => файл.path === "gashenie.py").content
  assert.ok(текст.includes("_ = rt.chain_head"), "неиспользованная голова не погашена")
})

test("настройки печати: путь, база индексации, предел глубины, без прогонщика", () => {
  сверитьСлучай("без модуля", { flang: 1, functions: [] })
  сверитьСлучай("без модуля, без прогонщика", { flang: 1, functions: [] }, { cli: false })
  сверитьСлучай("свой путь и база 0", { flang: 1, module: "Имя", functions: [] }, { path: "своё", indexBase: 0, maxDepth: 7 })
  const свои = напечатать({ flang: 1, module: "Имя", functions: [] }, { path: "своё", indexBase: 0, maxDepth: 7 })
  const модуль = свои.files.find((файл) => файл.path === "своё.py").content
  assert.ok(модуль.includes("ctx.index_base = 0\n    ctx.max_depth = 7\n"), "настройки не доехали")
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
  сверитьОтказ("модуль занял имя рантайма", { flang: 1, module: "flang runtime", functions: [] })
})
