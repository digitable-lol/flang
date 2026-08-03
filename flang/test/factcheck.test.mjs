/**
 * Встраиваемый факт-чекинг (SPEC §8) и команда `flang facts`.
 *
 * Проверяется не «работает ли функция», а выполняются ли гарантии режима:
 * только тотальные функции, жёсткий лимит шагов, отсутствие эффектов,
 * детерминизм и объяснимость отказа. Гарантия, которую нельзя проверить
 * тестом, — это обещание, а не гарантия.
 */
import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import { after, test } from "node:test"
import { checkFacts } from "../src/factcheck.mjs"
import { fromFtsDocument } from "../src/compat.mjs"

const core = await import(new URL("../../dist/src/index.js", import.meta.url).href)
const CLI = fileURLToPath(new URL("../bin/flang.mjs", import.meta.url))
const run = promisify(execFile)

const discountSource = await readFile(new URL("../../examples/utilities/discount.fts", import.meta.url), "utf8")
const discount = fromFtsDocument(core.compile(discountSource))
const discountEn = fromFtsDocument(
  core.compile(await readFile(new URL("../../examples/utilities/discount.en.fts", import.meta.url), "utf8")),
)

const FACTS = {
  "покупка": { "сумма": 20000, "постоянный клиент": true },
  "мелкая покупка": { "сумма": 5000, "постоянный клиент": false },
}

/* Программа с нетотальной функцией: класс объявлен в AST, а не выведен из
   названия, — именно это и обязан заметить факт-чекинг. */
const withPartial = {
  flang: 1,
  module: "Смешанная",
  types: [],
  functions: [
    {
      name: "Бесконечность",
      total: false,
      params: [{ name: "n", type: { kind: "number" } }],
      returns: { kind: "number" },
      body: { kind: "call", name: "Бесконечность", args: [{ kind: "var", name: "n" }] },
    },
    {
      name: "Через посредника",
      total: true,
      params: [{ name: "n", type: { kind: "number" } }],
      returns: { kind: "number" },
      body: { kind: "call", name: "Бесконечность", args: [{ kind: "var", name: "n" }] },
    },
    {
      name: "Удвоить",
      total: true,
      params: [{ name: "n", type: { kind: "number" } }],
      returns: { kind: "number" },
      body: { kind: "binary", op: "add", left: { kind: "var", name: "n" }, right: { kind: "var", name: "n" } },
    },
  ],
}

/* Тотальная, но не бесплатная: свёртка по списку упирается в лимит шагов. */
const heavy = {
  flang: 1,
  module: "Тяжёлая",
  types: [],
  functions: [
    {
      name: "Сумма",
      total: true,
      params: [{ name: "элементы", type: { kind: "list", of: { kind: "number" } } }],
      returns: { kind: "number" },
      body: {
        kind: "fold",
        over: { kind: "var", name: "элементы" },
        init: { kind: "literal", value: 0 },
        acc: "сумма",
        item: "элемент",
        body: { kind: "binary", op: "add", left: { kind: "var", name: "сумма" }, right: { kind: "var", name: "элемент" } },
      },
    },
  ],
}

const longList = Array.from({ length: 500 }, (_, index) => index + 1)

/* ────────────────────────────── подтверждение ───────────────────────────── */

test("подтверждаемое утверждение подтверждается и объясняется", () => {
  const verdict = checkFacts(discount, {
    facts: FACTS,
    claims: ["«Рассчитать скидку» от «покупка» равно 3000"],
  })
  assert.equal(verdict.ok, true)
  const [result] = verdict.results
  assert.equal(result.holds, true)
  assert.equal(result.status, "verified")
  assert.match(result.why, /= 3000/u)
  /* Шаги — это след вычисления, а не украшение: по ним видно, что считалось. */
  assert.deepEqual(
    result.steps.map((step) => step.kind),
    ["разбор", "тотальность", "факт", "вычисление", "сравнение"],
  )
  assert.equal(result.steps.at(-1).holds, true)
})

test("утверждение о поле факта не требует вычислений", () => {
  const verdict = checkFacts(discount, {
    facts: FACTS,
    claims: ["поле сумма факта «покупка» больше 10000"],
  })
  assert.equal(verdict.ok, true)
  assert.deepEqual(verdict.results[0].steps.map((step) => step.kind), ["разбор", "поле факта", "сравнение"])
})

test("английская поверхность утверждений равноправна русской", () => {
  const verdict = checkFacts(discountEn, {
    facts: { purchase: { amount: 20000, "loyal customer": true } },
    claims: ['"Calculate discount" of "purchase" is at most 4000'],
  })
  assert.equal(verdict.ok, true)
})

/* ─────────────────────────────── опровержение ───────────────────────────── */

test("опровергаемое утверждение объясняет, что и на каком факте не сошлось", () => {
  const verdict = checkFacts(discount, {
    facts: FACTS,
    claims: ["«Рассчитать скидку» от «мелкая покупка» больше 0"],
  })
  assert.equal(verdict.ok, false)
  const [result] = verdict.results
  assert.equal(result.holds, false)
  assert.equal(result.status, "refuted")
  /* «why» обязано назвать полученное значение, требование и исходный факт. */
  assert.match(result.why, /= 0/u)
  assert.match(result.why, /требует «больше 0»/u)
  assert.match(result.why, /«мелкая покупка»: сумма = 5000/u)
})

test("нарушение свойства утилиты объясняется, а не выдаётся за «ложь»", () => {
  const verdict = checkFacts(discount, {
    facts: { "странная": { "сумма": -100, "постоянный клиент": true } },
    claims: ["«Рассчитать скидку» от «странная» равно 0"],
  })
  assert.equal(verdict.ok, false)
  const [result] = verdict.results
  assert.equal(result.status, "refused")
  assert.match(result.why, /нарушено свойство «Скидка неотрицательна»/u)
  assert.match(result.why, /FTS_UTILITY_PROPERTY/u)
})

/* ──────────────────────────────── тотальность ───────────────────────────── */

test("нетотальная функция — отказ, а не попытка выполнить", () => {
  const verdict = checkFacts(withPartial, {
    facts: { "число": 1 },
    claims: ["«Бесконечность» от «число» равно 1"],
  })
  assert.equal(verdict.ok, false)
  const [result] = verdict.results
  assert.equal(result.status, "refused")
  assert.match(result.why, /не помечена как «тотальная»/u)
  /* Отказ случился ДО вычисления: шага «вычисление» в следе нет. */
  assert.equal(result.steps.some((step) => step.kind === "вычисление"), false)
})

test("тотальная функция, зовущая нетотальную, тоже отклоняется", () => {
  const verdict = checkFacts(withPartial, {
    facts: { "число": 1 },
    claims: ["«Через посредника» от «число» равно 1"],
  })
  assert.equal(verdict.results[0].status, "refused")
  assert.match(verdict.results[0].why, /через «Через посредника»/u)
  assert.equal(verdict.results[0].steps.some((step) => step.kind === "вычисление"), false)
})

test("тотальная функция в той же программе продолжает работать", () => {
  const verdict = checkFacts(withPartial, { facts: { "число": 21 }, claims: ["«Удвоить» от «число» равно 42"] })
  assert.equal(verdict.ok, true)
})

/* ───────────────────────────── лимит и эффекты ──────────────────────────── */

test("лимит шагов соблюдается и называется в объяснении", () => {
  const verdict = checkFacts(heavy, {
    facts: { "список": longList },
    claims: ["«Сумма» от «список» равно 125250"],
    limits: { steps: 50 },
  })
  assert.equal(verdict.ok, false)
  assert.equal(verdict.results[0].status, "refused")
  assert.match(verdict.results[0].why, /лимит/u)
})

test("с достаточным бюджетом то же утверждение подтверждается", () => {
  const verdict = checkFacts(heavy, {
    facts: { "список": longList },
    claims: ["«Сумма» от «список» равно 125250"],
    limits: { steps: 100000 },
  })
  assert.equal(verdict.ok, true)
})

test("факты не изменяются вычислением", () => {
  const facts = { "покупка": { "сумма": 20000, "постоянный клиент": true } }
  const snapshot = JSON.parse(JSON.stringify(facts))
  checkFacts(discount, { facts, claims: ["«Рассчитать скидку» от «покупка» равно 3000"] })
  assert.deepEqual(facts, snapshot)
})

test("модуль факт-чекинга не обращается к файлам, сети, времени и случайности", async () => {
  const source = await readFile(new URL("../src/factcheck.mjs", import.meta.url), "utf8")
  const code = source.replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/.*$/gmu, "$1")
  for (const forbidden of ["Date", "Math.random", "fetch", "node:fs", "node:net", "process.", "performance"]) {
    assert.equal(code.includes(forbidden), false, `в коде встретилось «${forbidden}»`)
  }
})

/* ──────────────────────────────── детерминизм ───────────────────────────── */

test("двойной прогон даёт побайтово одинаковый ответ", () => {
  const claims = [
    "«Рассчитать скидку» от «покупка» равно 3000",
    "«Рассчитать скидку» от «мелкая покупка» больше 0",
    "поле «постоянный клиент» факта «покупка» равно да",
    "«Нет такой функции» от «покупка» равно 1",
    "не утверждение вовсе",
  ]
  const first = checkFacts(discount, { facts: FACTS, claims })
  const second = checkFacts(discount, { facts: FACTS, claims })
  assert.deepEqual(first, second)
  assert.equal(JSON.stringify(first), JSON.stringify(second))
  /* Порядок ответов — порядок утверждений, а не порядок их вычисления. */
  assert.deepEqual(first.results.map((result) => result.claim), claims)
})

test("порядок фактов во входе не влияет на ответ", () => {
  const claims = ["«Рассчитать скидку» от «покупка» равно 3000"]
  const straight = checkFacts(discount, { facts: FACTS, claims })
  const reversed = checkFacts(discount, {
    facts: Object.fromEntries(Object.entries(FACTS).reverse()),
    claims,
  })
  assert.deepEqual(straight, reversed)
})

/* ─────────────────────────────── отказы разбора ─────────────────────────── */

test("неразобранное утверждение — отказ с указанием ожидаемой формы", () => {
  const verdict = checkFacts(discount, { facts: FACTS, claims: ["сколько будет скидка?"] })
  assert.equal(verdict.results[0].status, "refused")
  assert.match(verdict.results[0].why, /не удалось разобрать утверждение/u)
})

test("отсутствующий факт назван по имени", () => {
  const verdict = checkFacts(discount, { facts: {}, claims: ["«Рассчитать скидку» от «покупка» равно 3000"] })
  assert.match(verdict.results[0].why, /не передан факт «покупка»/u)
})

test("пустой список утверждений — ответ ok без результатов", () => {
  assert.deepEqual(checkFacts(discount, { facts: FACTS, claims: [] }), { ok: true, results: [] })
})

test("сломанная программа не роняет библиотеку, а даёт отказ", () => {
  const verdict = checkFacts(null, { facts: {}, claims: ["«Что-то» от «факт» равно 1"] })
  assert.equal(verdict.ok, false)
  assert.equal(verdict.results[0].status, "refused")
  assert.match(verdict.results[0].why, /программа не передана/u)
})

/* ─────────────────────────────── CLI: facts ─────────────────────────────── */

const temporary = await mkdtemp(join(tmpdir(), "flang-facts-"))
after(() => rm(temporary, { recursive: true, force: true }))

async function cli(args) {
  try {
    const { stdout, stderr } = await run(process.execPath, [CLI, ...args])
    return { code: 0, stdout, stderr }
  } catch (error) {
    return { code: error.code ?? 1, stdout: error.stdout ?? "", stderr: error.stderr ?? "" }
  }
}

test("flang facts: подтверждённое утверждение — JSON в stdout и код 0", async () => {
  const model = join(temporary, "discount.fts")
  const factsFile = join(temporary, "facts.json")
  await writeFile(model, discountSource)
  await writeFile(factsFile, JSON.stringify(FACTS))
  const result = await cli([
    "facts",
    model,
    "--facts",
    factsFile,
    "--claims",
    JSON.stringify(["«Рассчитать скидку» от «покупка» равно 3000"]),
  ])
  assert.equal(result.code, 0)
  assert.equal(result.stderr, "")
  const verdict = JSON.parse(result.stdout)
  assert.equal(verdict.ok, true)
  assert.equal(verdict.results[0].holds, true)
})

test("flang facts: опровергнутое утверждение — код 1, но JSON всё равно в stdout", async () => {
  const model = join(temporary, "discount.fts")
  const factsFile = join(temporary, "facts.json")
  const result = await cli([
    "facts",
    model,
    "--facts",
    factsFile,
    "--claims",
    JSON.stringify(["«Рассчитать скидку» от «покупка» равно 1"]),
  ])
  assert.equal(result.code, 1)
  const verdict = JSON.parse(result.stdout)
  assert.equal(verdict.ok, false)
  assert.match(verdict.results[0].why, /требует «равно 1»/u)
})

test("flang facts: лимит шагов передаётся ключом --steps", async () => {
  const model = join(temporary, "heavy.json")
  const factsFile = join(temporary, "heavy-facts.json")
  await writeFile(model, JSON.stringify(heavy))
  await writeFile(factsFile, JSON.stringify({ "список": longList }))
  const result = await cli([
    "facts",
    model,
    "--facts",
    factsFile,
    "--claims",
    JSON.stringify(["«Сумма» от «список» равно 125250"]),
    "--steps",
    "50",
  ])
  assert.equal(result.code, 1)
  assert.match(JSON.parse(result.stdout).results[0].why, /лимит/u)
})

test("flang facts: без --claims — диагностика в stderr и код 2", async () => {
  const model = join(temporary, "discount.fts")
  const result = await cli(["facts", model])
  assert.equal(result.code, 2)
  assert.equal(result.stdout, "")
  const diagnostics = JSON.parse(result.stderr)
  assert.equal(diagnostics.diagnostics[0].code, "FLANG_CLI")
})

test("flang facts: неверный JSON в --claims — код 2 и внятная диагностика", async () => {
  const model = join(temporary, "discount.fts")
  const result = await cli(["facts", model, "--claims", "[не json"])
  assert.equal(result.code, 2)
  assert.match(JSON.parse(result.stderr).error, /неверный JSON/u)
})
