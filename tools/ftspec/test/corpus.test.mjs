/**
 * Проверки на живом корпусе из examples/.
 *
 * Тесты намеренно смотрят не только на код диагностики, но и на то, ЧТО в ней
 * написано: инструмент полезен ровно настолько, насколько точно он называет
 * место конфликта.
 */
import assert from "node:assert/strict"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { compile, testUtilities } from "../../../dist/src/index.js"
import { parseModuleFile } from "../../ftsc/src/parse-module.mjs"
import { admit, check } from "../src/check.mjs"
import { listSpecFiles } from "../src/corpus.mjs"
import { buildGrid } from "../src/constitution.mjs"
import { readFile } from "node:fs/promises"

const at = (relative) => fileURLToPath(new URL(relative, import.meta.url))
const SHOP = at("../examples/shop")
const CLEAN = at("../examples/clean")
const STALE = at("../examples/stale")

const byCode = (result, code) => result.diagnostics.filter((diagnostic) => diagnostic.code === code)

test("чистый корпус проходит без единой диагностики", async () => {
  const result = await check(CLEAN)
  assert.equal(result.ok, true)
  assert.deepEqual(result.diagnostics, [])
  assert.equal(result.summary.rules, result.summary.rulesCovered)
})

test("конфликтующая спека даёт FTSPEC_RULE_CONFLICT с обеими спеками и пересечением условий", async () => {
  const result = await check(SHOP)
  assert.equal(result.ok, false)

  const conflicts = byCode(result, "FTSPEC_RULE_CONFLICT")
  assert.ok(conflicts.length >= 1)

  const main = conflicts.find((item) => item.message.includes("Давнему подписчику сорок процентов"))
  assert.ok(main, "ожидался конфликт правил о скидке постоянному клиенту и подписчику")

  /* обе спеки названы — иначе диагностику некому чинить */
  assert.deepEqual(main.specs.slice().sort(), ["001-скидка-постоянному-клиенту", "002-подписка-со-скидкой"])
  assert.match(main.message, /specs\/001-скидка-постоянному-клиенту\/spec\.fts/u)
  assert.match(main.message, /specs\/002-подписка-со-скидкой\/spec\.fts/u)

  /* конкретное пересечение условий, а не «где-то что-то пересеклось» */
  assert.equal(main.details.overlap, "«давний подписчик» = да, «сумма» ∈ [1000, +∞)")
  assert.equal(main.details.witness["давний подписчик"], true)
  assert.ok(main.details.witness["сумма"] >= 1000)
  assert.equal(main.details.object, "Подписка")
})

test("конфликт «задать результат» против «добавить» находится на непересекающихся по признаку правилах", async () => {
  const result = await check(SHOP)
  const conflict = byCode(result, "FTSPEC_RULE_CONFLICT").find((item) => item.message.includes("Крупная подписка"))
  assert.ok(conflict, "ожидался конфликт set против add")
  assert.match(conflict.message, /зависит от порядка/u)
  /* поле «давний подписчик» ограничено только одним из правил — второе его не упоминает */
  assert.equal(conflict.details.overlap, "«давний подписчик» = да, «сумма» ∈ (100000, +∞)")
})

test("нарушение конституции называет инвариант и вход, на котором он сломался", async () => {
  const result = await check(SHOP)
  const violations = byCode(result, "FTSPEC_CONSTITUTION")
  assert.equal(violations.length, 1)

  const [violation] = violations
  assert.equal(violation.details.invariant, "Предельная скидка")
  assert.equal(violation.details.utility, "Скидка подписчику")
  assert.deepEqual(violation.details.input, { сумма: 500, "давний подписчик": true })
  assert.equal(violation.details.outcome, 200)
  /* 200 действительно больше 30 процентов от 500 — диагностика не выдумана */
  assert.ok(violation.details.outcome > 0.3 * violation.details.input["сумма"])
  assert.match(violation.message, /«сумма» = 500/u)
})

test("непокрытое правило находится и названо по имени", async () => {
  const result = await check(SHOP)
  const uncovered = byCode(result, "FTSPEC_UNCOVERED")
  assert.equal(uncovered.length, 1)
  assert.equal(uncovered[0].details.rule, "Крупная подписка — ещё пять процентов")
  assert.equal(uncovered[0].severity, "warning")
  assert.equal(uncovered[0].details.undecided, false)
})

test("дословный повтор правила — предупреждение, а не ошибка", async () => {
  const result = await check(SHOP)
  const duplicates = byCode(result, "FTSPEC_RULE_DUPLICATE")
  assert.equal(duplicates.length, 1)
  assert.equal(duplicates[0].severity, "warning")
  assert.match(duplicates[0].message, /вынести в общий модуль/u)
})

test("admit для совместимой спеки возвращает «принято»", async () => {
  const result = await admit(SHOP, "003-промокод")
  assert.equal(result.accepted, true)
  assert.equal(result.ok, true)
  assert.deepEqual(result.diagnostics, [])
  /* корпус при этом остаётся несогласованным — но это не вина новой спеки */
  assert.ok(result.others > 0)
})

test("admit для конфликтующей спеки отклоняет её и объясняет почему", async () => {
  const result = await admit(SHOP, "002-подписка-со-скидкой")
  assert.equal(result.accepted, false)
  const codes = new Set(result.diagnostics.map((diagnostic) => diagnostic.code))
  assert.ok(codes.has("FTSPEC_RULE_CONFLICT"))
  assert.ok(codes.has("FTSPEC_CONSTITUTION"))
})

test("admit понимает и путь, и голый идентификатор спеки", async () => {
  const byPath = await admit(SHOP, "003-промокод")
  const unknown = await admit(SHOP, "нет-такой-спеки")
  assert.equal(byPath.accepted, true)
  assert.equal(unknown.accepted, false)
  assert.equal(unknown.diagnostics[0].code, "FTSPEC_SPEC_UNKNOWN")
})

test("осиротевшее решение в memory/ ловится до сборки корпуса", async () => {
  const result = await check(STALE)
  assert.equal(result.ok, false)
  const stale = result.diagnostics.filter((diagnostic) => diagnostic.code === "FTSPEC_MEMORY_STALE")
  assert.equal(stale.length, 1)
  assert.equal(stale[0].path, "memory/002-решение-о-возвратах.fts")
  assert.match(stale[0].message, /которого больше нет/u)
})

test("сетка входов строится вокруг границ условий и детерминирована", async () => {
  const result = await check(SHOP)
  const spec = result.corpus.specs.find((item) => item.id === "002-подписка-со-скидкой")
  assert.ok(spec)

  /* пороги 0, 500 и 100000 из условий утилиты плюс их соседи */
  const source = await readFile(at("../examples/shop/specs/002-подписка-со-скидкой/spec.fts"), "utf8")
  const document = compile(parseModuleFile(source, "spec.fts").body)
  const utility = document.utilities.find((item) => item.name === "Скидка подписчику")
  const structure = document.structures.find((item) => item.name === utility.input)

  const first = buildGrid(structure, utility)
  const second = buildGrid(structure, utility)
  assert.deepEqual(first.points, second.points)
  const sums = first.axes.find((axis) => axis.field === "сумма").values
  assert.deepEqual(sums, [-1, 0, 1, 499, 500, 501, 99999, 100000, 100001])
})

test("все модели корпуса компилируются, а их примеры сходятся", async () => {
  for (const root of [SHOP, CLEAN, STALE]) {
    for (const file of await listSpecFiles(root)) {
      const parsed = parseModuleFile(await readFile(file, "utf8"), file)
      if (parsed.kind === "functor") continue
      const outcome = testUtilities(compile(parsed.body))
      assert.equal(outcome.valid, true, `${file}: примеры не сходятся`)
    }
  }
})
