/**
 * Печать flang → C, написанная на самом flang (`flang/self/emit-c.flang`).
 *
 * Проверка здесь одна и она дифференциальная: для каждой программы репозитория
 * файлы, которые печатает «Печать программы» на flang, обязаны совпасть с тем,
 * что печатает эталон `flang/src/emit/c.mjs`, **побайтово** — включая
 * комментарии, пробелы, порядок временных имён и нумерацию констант файла.
 *
 * Слабее критерий делать нельзя. «Компилируется и работает» не отличает
 * правильную печать от случайно похожей: два бэкенда могут давать разный C,
 * который одинаково проходит сетку входов, и разойтись на первом же входе,
 * которого в сетке не было. Побайтовое совпадение исключает это по построению.
 *
 * Что покрывается сверх программ репозитория:
 *   • все модели `.fts` через `compat.mjs` — там живут постусловия, которых в
 *     `.flang` репозитория нет;
 *   • взаимная хвостовая рекурсия (батут), в том числе без параметров;
 *   • одноимённые вариант суммы и функция — тот самый случай, ради которого в
 *     имя вошла роль («вариант X» против «создать X»);
 *   • литералы всех видов, включая NaN, бесконечности, минус ноль и 1e21;
 *   • настройки печати: свой путь, база индексации 0, свой предел глубины,
 *     печать без прогонщика;
 *   • диагностики — код и текст сообщения, а не только факт отказа.
 *
 * Отдельно проверяется то, ради чего бэкенд существует: напечатанный C
 * собирается `cc -std=c99 -Wall -Wextra -Werror -pedantic` без единого
 * предупреждения — включая C, напечатанный для самого `self/emit-c.flang`.
 */
import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { fromFtsDocument } from "../src/compat.mjs"
import { emitC } from "../src/emit/c.mjs"
import { evaluate } from "../src/interpret.mjs"
import { linkProgram } from "../src/link.mjs"
import { parse } from "../src/parser.mjs"
import { checkTotality } from "../src/totality.mjs"
import { checkTypes } from "../src/types.mjs"
import { globSync } from "./glob.mjs"

const корень = fileURLToPath(new URL("../..", import.meta.url))
const файл = fileURLToPath(new URL("../self/emit-c.flang", import.meta.url))
const исходник = readFileSync(файл, "utf8")

const свой = parse(исходник, "self/emit-c.flang")
const связано = await linkProgram(файл, исходник, parse)
const { diagnostics: диагностикиСвязывания, ...программа } = связано
const типы = checkTypes(программа)
const тотальность = checkTotality(программа)

/**
 * Лимит шагов поднят с миллиона до ста: печать в C — работа с целым AST сразу,
 * и самая большая программа репозитория (`flang/self/emit-c.flang`, 3300 строк,
 * 100 КБ напечатанного C) укладывается между шестьюдесятью и ста миллионами
 * шагов. Лимит здесь не формальность: он ловит превращение печати в перебор.
 * Глубина — по вложенности AST, а не по числу узлов, поэтому её хватает штатной.
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

/* Рантайм печатается дословно и приходит параметром: читать файлы язык не
   умеет и не должен. Берём те же самые файлы, что берёт эталон. */
const рантайм = (имя) => readFileSync(new URL(`../src/emit/c/${имя}`, import.meta.url), "utf8")
const РАНТАЙМ = {
  "рантайм заголовок": рантайм("flang_runtime.h"),
  "рантайм исходник": рантайм("flang_runtime.c"),
  "исходник прогонщика": рантайм("flang_cli.c"),
  "исходник оболочки": рантайм("flang_repl.c"),
}

function настройки(опции = {}) {
  return {
    "путь": опции.path ?? "",
    "есть путь": опции.path !== undefined,
    "база": опции.indexBase === 0 ? 0 : 1,
    "предел глубины": опции.maxDepth ?? 10_000,
    "предел шагов": опции.maxSteps ?? 1_000_000,
    "прогонщик": опции.cli !== false,
    "оболочка": опции.repl === true,
    ...РАНТАЙМ,
  }
}

/** Печать на flang: список файлов в той же форме, что у эталона. */
function напечатать(ast, опции = {}) {
  const итог = вызвать("Печать программы", { "программа": значение(ast), "настройки": настройки(опции) })
  return { files: итог.файлы.map((файл) => ({ path: файл.путь, content: файл.содержимое })), error: итог.ошибка }
}

/** Файл реализации модуля: единственный .c, который не принадлежит рантайму. */
function исходникМодуля(файлы) {
  return файлы.find((файл) => файл.path.endsWith(".c") && !файл.path.startsWith("flang_")).content
}

/** Заголовок модуля: единственный .h, который не принадлежит рантайму. */
function заголовокМодуля(файлы) {
  return файлы.find((файл) => файл.path.endsWith(".h") && !файл.path.startsWith("flang_")).content
}

/** Побайтовая сверка с эталоном; при расхождении показывает первую строку. */
function сверить(имя, ast, опции = {}) {
  const эталон = emitC(ast, опции)
  const мой = напечатать(ast, опции)
  assert.equal(мой.error, "", `${имя}: печать на flang отказала: ${мой.error}`)
  assert.deepEqual(
    мой.files.map((файл) => файл.path),
    эталон.files.map((файл) => файл.path),
    `${имя}: набор файлов не совпал`,
  )
  for (const [индекс, файл] of эталон.files.entries()) {
    const наш = мой.files[индекс].content
    if (наш === файл.content) continue
    const слева = файл.content.split("\n")
    const справа = наш.split("\n")
    let строка = 0
    while (строка < слева.length && строка < справа.length && слева[строка] === справа[строка]) строка += 1
    assert.fail(
      `${имя}: ${файл.path} разошёлся на строке ${строка + 1}\n` +
        `  эталон: ${JSON.stringify(слева[строка])}\n` +
        `  flang:  ${JSON.stringify(справа[строка])}`,
    )
  }
}

/** Отказ печати: код и текст обязаны совпасть с тем, что бросает эталон. */
function сверитьОтказ(имя, ast) {
  let ожидаемое = null
  try {
    emitC(ast)
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
].sort()

/* ─────────────────── проверки самой программы ─────────────────── */

test("программа на flang разбирается, связывается, проходит типы и тотальность", () => {
  assert.deepEqual(диагностикиСвязывания, [], "связывание с core/json.flang дало диагностики")
  assert.deepEqual(типы.diagnostics ?? [], [], "проверка типов дала диагностики")
  assert.deepEqual(тотальность.diagnostics ?? [], [], "анализ тотальности дал диагностики")
  assert.equal(свой.module, "Печать в C")
  /* Тотальность здесь не обязательна (flang/self/SPEC.md), но большинство
     функций всё же доказаны — обратное означало бы, что состояние протекло
     всюду. Проверяем это числом, чтобы регресс был виден. */
  const свои = new Set(свой.functions.map((функция) => функция.name))
  const доказанные = свой.functions.filter((функция) => функция.total === true)
  assert.ok(свои.size >= 300, `функций стало ${свои.size} — файл подменили?`)
  assert.ok(доказанные.length * 2 > свои.size, "тотальных функций стало меньше половины")
})

test("переиспользование core/json.flang, а не вторая печать строк и чисел", () => {
  /* Экранирование и запись чисел уже доказаны побайтово на 56 моделях. Второй
     реализации быть не должно: она разошлась бы на первом же краевом входе. */
  assert.match(исходник, /использует «Печать JSON» из "\.\.\/core\/json\.flang" только /u)
  const свои = new Set(свой.functions.map((функция) => функция.name))
  for (const имя of ["Заменить всё", "Экранировать", "Печать строки", "Печать массива"]) {
    assert.ok(!свои.has(имя), `«${имя}» переписана заново вместо импорта`)
    assert.ok(программа.functions.some((функция) => функция.name === имя), `«${имя}» не приехала импортом`)
  }
})

/* ─────────────────── дифференциальная сверка ─────────────────── */

test("программы репозитория: C совпадает с эталоном побайтово", async () => {
  assert.ok(программыРепозитория.length >= 30, "программ стало подозрительно мало")
  for (const относительный of программыРепозитория) {
    сверить(относительный, await разобрать(относительный))
  }
})

test("сам эмиттер: печать своего собственного исходника совпадает побайтово", async () => {
  /* Единственная программа, где печать работает над своим же текстом. Если
     самоприменение однажды разойдётся, разойдётся именно здесь. */
  сверить("flang/self/emit-c.flang", await разобрать("flang/self/emit-c.flang"))
})

test("модели FTS через compat: постусловия печатаются так же", async () => {
  const ядро = await import(new URL("../../dist/src/index.js", import.meta.url).href)
  const { parseModuleFile } = await import(new URL("../../tools/ftsc/src/parse-module.mjs", import.meta.url).href)
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
    сверить(файлМодели, fromFtsDocument(документ))
    сверено += 1
  }
  assert.ok(сверено >= 10, `моделей с утилитами сверено ${сверено} — слишком мало`)
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
  const исходникC = исходникМодуля(напечатать(батут).files)
  assert.ok(исходникC.includes("fl_trampoline(ctx, chyotnost_chyotnoe_step"), "батута в выдаче нет")
  assert.ok(исходникC.includes("bounce->next = chyotnost_nechyotnoe_step;"), "отскока в выдаче нет")
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
  assert.ok(исходникМодуля(напечатать(программаБезПараметров).files).includes("(void)args;"), "args не погашен")
})

test("одноимённые вариант и функция дают разные идентификаторы", () => {
  /* Тот самый дефект, из-за которого бэкенд печатал некомпилируемый C: без
     роли в имени «Значение операнда» как вариант и как функция сходились в один
     идентификатор. Роль обязана остаться и в этой печати. */
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
  const заголовок = заголовокМодуля(напечатать(программаСтолкновения).files)
  assert.ok(заголовок.includes("vychislitel_variant_znachenie_operanda("), "конструктор варианта потерял роль")
  assert.ok(заголовок.includes("vychislitel_znachenie_operanda("), "функция потеряла своё имя")
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
  const исходникC = исходникМодуля(напечатать(обмен).files)
  assert.ok(исходникC.includes("for (;;) {"), "цикла нет")
  assert.ok(исходникC.includes("continue;"), "переприсваивания нет")
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
            лит('а"б\\в?г '),
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
  сверить("свой путь и база 0", { flang: 1, module: "Имя", functions: [] }, { path: "своё", indexBase: 0, maxDepth: 7 })
  const свои = напечатать({ flang: 1, module: "Имя", functions: [] }, { path: "своё", indexBase: 0, maxDepth: 7 })
  const заголовокРантайма = свои.files.find((файл) => файл.path === "flang_runtime.h").content
  assert.ok(заголовокРантайма.includes("#define FL_INDEX_BASE 0\n#define FL_MAX_DEPTH 7\n"), "настройки не доехали")
  assert.ok(заголовокМодуля(свои.files).includes("#ifndef SVOYO_H"), "страж заголовка не транслитерирован")
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
})

/* ─────────────────── сборка напечатанного ─────────────────── */

const CFLAGS = ["-std=c99", "-Wall", "-Wextra", "-Werror", "-pedantic"]

/** Собирает ровно то, что напечатано, в пустом каталоге и убирает за собой. */
function собрать(файлы) {
  const каталог = mkdtempSync(join(tmpdir(), "self-emit-c-"))
  try {
    for (const файл of файлы) writeFileSync(join(каталог, файл.path), файл.content, "utf8")
    const исходники = файлы.filter((файл) => файл.path.endsWith(".c")).map((файл) => файл.path)
    execFileSync("cc", [...CFLAGS, "-c", ...исходники], { cwd: каталог, stdio: "pipe" })
    return null
  } catch (ошибка) {
    return String(ошибка.stderr ?? ошибка)
  } finally {
    rmSync(каталог, { recursive: true, force: true })
  }
}

const естьCC = spawnSync("cc", ["--version"], { encoding: "utf8" }).status === 0

test("напечатанный C собирается cc -std=c99 -Wall -Wextra -Werror -pedantic", async (t) => {
  if (!естьCC) {
    t.diagnostic("компилятора cc в системе нет — проверка пропущена")
    return
  }
  for (const относительный of ["flang/stdlib/lists.flang", "flang/stdlib/strings.flang", "flang/examples/leetcode/020-valid-parentheses.flang"]) {
    const жалоба = собрать(напечатать(await разобрать(относительный)).files)
    assert.equal(жалоба, null, `${относительный}: ${жалоба}`)
  }
  assert.equal(собрать(напечатать(батут).files), null, "батут не собрался")
})

test("самоприменение: C, напечатанный для собственного исходника, собирается", async (t) => {
  if (!естьCC) {
    t.diagnostic("компилятора cc в системе нет — проверка пропущена")
    return
  }
  const жалоба = собрать(напечатать(await разобрать("flang/self/emit-c.flang")).files)
  assert.equal(жалоба, null, `собственный исходник не собрался: ${жалоба}`)
})

test("шаг батута без единого значения в хвосте гасит result и собирается", (t) => {
  /* Регрессия на дефект, который эта печать нашла в эталоне на собственном
     исходнике. Компонента взаимной хвостовой рекурсии, у которой ВСЕ хвостовые
     позиции — отскоки, даёт шаг батута, ни разу не пишущий в *result. Эталон
     гасил `ctx`, `error`, `bounce` и параметры, но не его, и с -Wextra под
     -Werror такой C не собирался вовсе.

     На программах репозитория этот случай не возникает — потому дефект и дожил
     до печати, написанной на самом языке. Исправлено в обеих реализациях
     одинаково; тест держит их вместе: `сверить` требует побайтового совпадения
     с эталоном, а сборка — что результат вообще компилируется. */
  const кольцо = {
    flang: 1,
    module: "Кольцо",
    functions: [
      { name: "А", params: [{ name: "х" }], returns: {}, body: { kind: "call", name: "Б", args: [имя("х")] } },
      { name: "Б", params: [{ name: "х" }], returns: {}, body: { kind: "call", name: "А", args: [имя("х")] } },
    ],
  }
  сверить("кольцо отскоков", кольцо)
  const напечатанный = напечатать(кольцо)
  const текст = напечатанный.files.map((файл) => файл.content).join("\n")
  assert.match(текст, /\(void\)result;/u, "шаг батута обязан гасить result, иначе -Wextra ломает сборку")
  if (!естьCC) {
    t.diagnostic("компилятора cc в системе нет — проверка сборки пропущена")
    return
  }
  const жалоба = собрать(напечатанный.files)
  assert.equal(жалоба, null, `кольцо отскоков не собралось: ${жалоба}`)
})
