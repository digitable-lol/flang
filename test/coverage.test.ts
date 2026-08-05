import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import { analyzeCoverage, defaultCoverageBudget } from "../src/coverage.js"
import type { Diagnostic } from "../src/diagnostics.js"
import { compile } from "../src/parser.js"
import { assertValid, validate } from "../src/validate.js"

const discount = (): Promise<string> => readFile(new URL("../../examples/utilities/discount.fts", import.meta.url), "utf8")

const find = (diagnostics: Diagnostic[], code: string): Diagnostic | undefined =>
  diagnostics.find((item) => item.code === code)

describe("input-space analysis in check", () => {
  it("reports the hole, the overlap and the unreachable limit of the discount model", async () => {
    const result = validate(compile(await discount()))

    /* The document is well formed, and none of these findings changes that:
       a model with an unreachable property limit is a valid model. */
    assert.equal(result.valid, true)
    assert.equal(result.diagnostics.some((item) => item.severity === "error"), false)

    const hole = find(result.diagnostics, "FTS_COVERAGE_HOLE")
    assert.ok(hole)
    assert.equal(hole.severity, "warning")
    assert.match(hole.message, /«сумма» ∈ \(−∞, 10000\)/u)
    assert.match(hole.message, /результат остаётся начальным \(0\)/u)

    /* Both rules add, so their overlap cannot depend on declaration order:
       true, worth printing, and not a defect. */
    const overlap = find(result.diagnostics, "FTS_RULE_OVERLAP")
    assert.ok(overlap)
    assert.equal(overlap.severity, "info")
    assert.match(overlap.message, /порядок не важен/u)

    const unattainable = result.diagnostics.filter((item) => item.code === "FTS_PROPERTY_UNATTAINABLE")
    assert.equal(unattainable.length, 2, "оба свойства модели ничего не ограничивают")
    const capped = unattainable.find((item) => item.message.includes("Скидка ограничена"))
    assert.ok(capped)
    assert.match(capped.message, /ближайший подход — 75 % от предела/u)
  })

  it("says what to do, in numbers", async () => {
    const diagnostics = analyzeCoverage(compile(await discount()))
    const capped = diagnostics.find(
      (item) => item.code === "FTS_PROPERTY_UNATTAINABLE" && item.message.includes("Скидка ограничена"),
    )

    /* The rules give at most 10 % + 5 % = 15 %, so a limit of 20 % is checked
       by nothing. The hint is that arithmetic, done for the author. */
    assert.ok(capped?.hint)
    assert.match(capped.hint, /правила дотягивают до 15 % от поля «сумма»/u)

    const hole = diagnostics.find((item) => item.code === "FTS_COVERAGE_HOLE")
    assert.ok(hole?.hint)
    assert.match(hole.hint, /ожидается результат равен 0/u, "предлагает готовый пример")
    assert.match(hole.hint, /«сумма» меньше 10000/u, "и готовое условие правила")
  })

  it("puts every finding on the line that declares it", async () => {
    const source = await discount()
    const lines = source.split("\n")
    const diagnostics = analyzeCoverage(compile(source))
    assert.ok(diagnostics.length > 0)

    for (const diagnostic of diagnostics) {
      assert.ok(diagnostic.span, `${diagnostic.code} без span`)
      const line = lines[diagnostic.span.start.line - 1]!
      assert.equal(
        line.slice(diagnostic.span.start.column - 1, diagnostic.span.end.column - 1),
        line.trim(),
        `${diagnostic.code} подчёркивает не тот текст`,
      )
    }

    const property = diagnostics.find((item) => item.message.includes("Скидка ограничена"))!
    assert.match(lines[property.span!.start.line - 1]!, /свойство «Скидка ограничена»/u)

    const hole = find(diagnostics, "FTS_COVERAGE_HOLE")!
    assert.match(lines[hole.span!.start.line - 1]!, /утилита «Рассчитать скидку»/u)
  })

  it("names the edit that removes an order-dependent overlap", () => {
    const document = compile(`категория «Заказы»

  объект Заказ
    сумма является деньгами

  утилита «Назначить купон»
    принимает Заказ
    возвращает число
    начинает с 0

    правило «Крупный заказ»
      если сумма не меньше 5000
      то результат равен 500

    правило «Очень крупный заказ»
      если сумма не меньше 100000
      то результат равен 900
`)
    const diagnostics = analyzeCoverage(document)
    const overlap = find(diagnostics, "FTS_RULE_OVERLAP_ORDER")

    assert.ok(overlap)
    assert.equal(overlap.severity, "warning")
    assert.match(overlap.message, /побеждает объявленное ниже/u)
    /* Adding the negation of any one condition of the lower rule to the upper
       one makes the regions disjoint — so the advice is a line to paste. */
    assert.match(overlap.hint!, /если «сумма» меньше 100000/u)
    assert.match(overlap.hint!, /либо объявите «Очень крупный заказ» выше/u)
  })

  it("reports a rule no input can ever satisfy", () => {
    const diagnostics = analyzeCoverage(
      compile(`категория «Склад»

  объект Позиция
    остаток является числом

  утилита «Оценить»
    принимает Позиция
    возвращает число
    начинает с 0

    правило «Невозможное»
      если остаток больше 100
      и остаток меньше 10
      то добавить 1
`),
    )
    const dead = find(diagnostics, "FTS_RULE_UNREACHABLE")
    assert.ok(dead)
    assert.equal(dead.severity, "warning")
    assert.match(dead.message, /правило «Невозможное» не срабатывает никогда/u)
    assert.match(dead.hint!, /исправьте или уберите одно из сравнений/u)
  })

  it("admits which conditions it could not prove", () => {
    const diagnostics = analyzeCoverage(
      compile(`категория «Кредиты»

  объект Заявка
    доход является деньгами
    платёж является деньгами

  утилита «Оценить риск»
    принимает Заявка
    возвращает число
    начинает с 0

    правило «Платёж больше дохода»
      если платёж больше поле доход
      то добавить 10
`),
    )
    const unanalyzed = find(diagnostics, "FTS_RULE_UNANALYZED")
    assert.ok(unanalyzed, "сравнение поля с полем названо непроверенным, а не выдано за проверенное")
    assert.equal(unanalyzed.severity, "info")
    assert.match(unanalyzed.message, /не с константой/u)
  })

  it("can be switched off, and is off where nothing reads it", async () => {
    const document = compile(await discount())

    const off = validate(document, { coverage: false })
    assert.equal(off.valid, true)
    assert.deepEqual(off.diagnostics, [], "с --no-coverage check молчит о суждениях")

    /* `assertValid` is the hot path of prove/certify/generate/run. Skipping
       the analysis there changes no outcome: it never yields an error. */
    assert.equal(validate(document).valid, validate(document, { coverage: false }).valid)
    assert.doesNotThrow(() => assertValid(document))
  })

  it("stays inside its budget on a model with many numeric fields", () => {
    const fields = ["a", "b", "c", "d", "e"]
    const document = compile(`категория «Нагрузка»

  объект Заявка
${fields.map((field) => `    ${field} является числом`).join("\n")}

  утилита «Оценить»
    принимает Заявка
    возвращает число
    начинает с 0

${fields.map((field, index) => `    правило «Правило ${field}»\n      если ${field} не меньше ${index + 1}0\n      то добавить 1`).join("\n\n")}
`)

    const diagnostics = analyzeCoverage(document)

    /* The partition had to be cut, and the report says so instead of passing
       a sampled subspace off as the whole of it. */
    const truncated = find(diagnostics, "FTS_COVERAGE_TRUNCATED")
    assert.ok(truncated)
    assert.equal(truncated.severity, "info")
    assert.match(truncated.hint!, /ftsmap/u)

    /* Wall time is not asserted here — a loaded machine would make that test
       lie in both directions. What is asserted is the bound that keeps the
       wall time down: the budget cuts the partition, so the work cannot grow
       with the model. The measured cost of the analysis is fractions of a
       millisecond on ordinary models and single milliseconds on this one. */
    const budget = defaultCoverageBudget
    assert.ok(budget.cells * budget.samplesPerCell >= 1)
    assert.ok(budget.evaluations <= budget.cells * budget.samplesPerCell * 8)
  })

  it("keeps a table of many overlapping rules from flooding the report", () => {
    const rules = Array.from(
      { length: 40 },
      (_, index) => `    правило «Порог ${index}»\n      если сумма не меньше ${index * 10}\n      то результат равен ${index}`,
    )
    const diagnostics = analyzeCoverage(
      compile(`категория «Тариф»

  объект Счёт
    сумма является деньгами

  утилита «Ставка»
    принимает Счёт
    возвращает число
    начинает с 0

${rules.join("\n\n")}
`),
    )

    /* 40 rules overlap in 780 pairs; 780 diagnostics are no more readable than
       none. What does not fit is counted, not dropped in silence. */
    assert.ok(diagnostics.length <= 20, `находок ${diagnostics.length}`)
    const withheld = find(diagnostics, "FTS_COVERAGE_TRUNCATED")
    assert.ok(withheld)
    assert.match(withheld.message, /показаны не все находки/u)
    assert.match(withheld.message, /перекрывающихся правил/u)
  })

  it("keeps every finding machine-readable", async () => {
    const diagnostics = analyzeCoverage(compile(await discount()))
    const codes = new Set(diagnostics.map((item) => item.code))

    /* Separate codes per kind of finding is the point: a machine decides what
       to fix by the code, not by parsing Russian prose. */
    assert.ok(codes.has("FTS_COVERAGE_HOLE"))
    assert.ok(codes.has("FTS_RULE_OVERLAP"))
    assert.ok(codes.has("FTS_PROPERTY_UNATTAINABLE"))
    assert.ok(codes.has("FTS_PROPERTY_VIOLATED"))
    for (const code of codes) assert.doesNotMatch(code, /^FTS_UTILITY_/u, "не общий FTS_UTILITY_*")

    for (const diagnostic of diagnostics) {
      assert.equal(typeof diagnostic.code, "string")
      assert.equal(typeof diagnostic.message, "string")
      assert.ok(["warning", "info"].includes(diagnostic.severity), "разбор суждений не выносит ошибок")
      assert.ok(diagnostic.span)
      assert.equal(typeof JSON.parse(JSON.stringify(diagnostic)).span.start.line, "number")
    }
  })

  it("leaves the canonical document and its digest untouched", async () => {
    const source = await discount()
    const document = compile(source)
    const { digest } = await import("../src/certificate.js")

    /* Positions live beside the document, not in it: the published schema
       forbids extra fields on a utility and the digest is taken over this very
       JSON. A span that leaked into it would change both. */
    const json = JSON.parse(JSON.stringify(document))
    assert.equal("span" in json.utilities[0], false)
    assert.equal("span" in json.utilities[0].rules[0], false)
    assert.equal("span" in json.utilities[0].properties[0], false)
    assert.equal(digest(document), digest(json))
  })
})
