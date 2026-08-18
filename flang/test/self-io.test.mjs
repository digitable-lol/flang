/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Проверка объявления `план`, написанная на самом flang — `flang/self/io.flang`.
 *
 * Сверка одна и она дифференциальная: для каждой программы корпуса множество
 * диагностик `FLANG_PLAN`, выданное слоем на flang, обязано совпасть с тем, что
 * даёт эталонный `checkPlans` из `flang/src/io.mjs` — код, текст сообщения и
 * место (строка и столбец), в том же порядке. Не «ловит те же ошибки» и не
 * «столько же диагностик»: одинаковый набор кодов при разном тексте — это уже
 * расхождение, потому что текст диагностики и есть то, что читает человек.
 *
 * ЭТАЛОН СПРАШИВАЕТСЯ ЧЕРЕЗ `checkTypes`, а не напрямую, и это не обход:
 * `FLANG_PLAN` во всём компиляторе поднимает только `checkPlans`
 * (проверено `grep`-ом: двенадцать мест, все в `io.mjs`), поэтому фильтр по коду
 * и есть его выход, взятый ровно в том порядке и с теми же местами, в каких его
 * увидит человек, запустивший `flang check`.
 *
 * ── Почему корпус, а не «все .flang репозитория» ────────────────────────────
 *
 * Потому что программ со словом `план` в дереве ОДНА, и она целая. Сверка на
 * ней одной была бы зелёной у близнеца, который не делает ничего: «диагностик
 * нет» выдаёт любая функция, которая молчит. Корпус
 * (`flang/test/corpus-plans.mjs`) заведён отдельным заходом и отдельно
 * проверен на различимость — `flang/test/plans-corpus.test.mjs`.
 *
 * Чистые файлы репозитория здесь тоже гоняются, но за другим утверждением: они
 * ловят близнеца, который жалуется ТАМ, ГДЕ ЖАЛОВАТЬСЯ НЕ НА ЧТО.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { evaluate } from "../src/interpret.mjs"
import { linkProgram } from "../src/link.mjs"
import { parse } from "../src/parser.mjs"
import { checkTotality } from "../src/totality.mjs"
import { checkTypes } from "../src/types.mjs"
import { корпусПланов } from "./corpus-plans.mjs"

const корень = fileURLToPath(new URL("../..", import.meta.url))
const файл = fileURLToPath(new URL("../self/io.flang", import.meta.url))
const исходник = readFileSync(файл, "utf8")

const свой = parse(исходник, "self/io.flang")
const связано = await linkProgram(файл, исходник, parse)
const { diagnostics: диагностикиСвязывания, ...программа } = связано
const типы = checkTypes(программа)
const тотальность = checkTotality(программа)

const ШАГИ = { maxSteps: 400_000_000, maxDepth: 20_000 }
const вызвать = (имя, аргументы) => evaluate(программа, имя, аргументы, ШАГИ)

/* ─────────────────── перевод AST в значения flang ─────────────────── */

/* Механический перевод JSON → «Значение» из `flang/core/json.flang`: повторяет
   форму и порядок ключей и ничего не решает сам. Иначе тест проверял бы себя.
   Взят дословно у `self-types.test.mjs` — второй его редакции здесь быть не
   должно, но и общего места для него в дереве пока нет. */
const вариантЗначения = (имя, поля = {}) => ({ variant: имя, fields: поля })

function скаляр(значение) {
  if (значение === null) return вариантЗначения("Скаляр ничто")
  if (typeof значение === "string") return вариантЗначения("Скаляр строка", { значение })
  if (typeof значение === "number") return вариантЗначения("Скаляр число", { значение })
  if (typeof значение === "boolean") return вариантЗначения("Скаляр признак", { значение })
  throw new Error(`не скаляр: ${String(значение)}`)
}

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

/** Диагностика эталона и диагностика на flang, приведённые к одной форме. */
const образцовая = (д) => [д.code, д.message, д.span?.line ?? null, д.span?.column ?? null]
const наша = (д) => [
  д["код"],
  д["сообщение"],
  д["место"]["есть"] ? д["место"]["строка"] : null,
  д["место"]["есть"] ? д["место"]["столбец"] : null,
]

const эталонные = (ast) => checkTypes(ast).diagnostics.filter((д) => д.code === "FLANG_PLAN").map(образцовая)
const наши = (ast) => вызвать("Проверить планы", { программа: значение(ast) }).map(наша)

/** Первое расхождение или null. Сравниваются код, текст, место и порядок. */
function расхождение(ast) {
  const эталон = эталонные(ast)
  const свои = наши(ast)
  for (let индекс = 0; индекс < Math.max(эталон.length, свои.length); индекс += 1) {
    if (эталон[индекс] === undefined) return `лишняя диагностика ${индекс}: ${JSON.stringify(свои[индекс])}`
    if (свои[индекс] === undefined) return `нет диагностики ${индекс}: ${JSON.stringify(эталон[индекс])}`
    const ждём = JSON.stringify(эталон[индекс])
    const есть = JSON.stringify(свои[индекс])
    if (ждём !== есть) return `диагностика ${индекс}: ${есть} ≠ ${ждём}`
  }
  return null
}

/* ─────────────────────────── слой: программа на flang ───────────────────── */

test("io.flang: разбор даёт контракт SPEC, раздел 5", () => {
  assert.equal(свой.flang, 1)
  assert.equal(свой.module, "Проверка планов")
  assert.ok(Array.isArray(свой.functions))
  assert.ok(свой.functions.length > 0)
  assert.equal(JSON.stringify(parse(исходник, "self/io.flang")), JSON.stringify(свой))
})

test("io.flang: связывание с соседними слоями без диагностик", () => {
  assert.deepEqual(диагностикиСвязывания, [])
})

test("io.flang: типы без диагностик", () => {
  assert.deepEqual(типы.diagnostics, [])
})

test("io.flang: тотальность без диагностик", () => {
  assert.deepEqual(тотальность.diagnostics, [])
})

test("io.flang: навигация по AST приезжает связыванием, а не копированием", () => {
  const свои = new Set(свой.functions.map((функция) => функция.name))
  for (const имя of ["Взять поле", "Элементы поля", "Вид узла", "Место узла", "Сказать"]) {
    assert.ok(!свои.has(имя), `«${имя}» объявлена здесь, а должна приходить импортом`)
    assert.ok(
      программа.functions.some((функция) => функция.name === имя),
      `«${имя}» не приехала связыванием`,
    )
  }
})

test("io.flang: примеры всех своих функций сходятся", () => {
  let счёт = 0
  for (const функция of свой.functions) {
    for (const пример of функция.examples ?? []) {
      счёт += 1
      const получено = evaluate(программа, функция.name, пример.args, ШАГИ)
      /* Вариант приезжает объектом класса `FlangVariant`, а ожидание примера —
         голой записью AST: сравниваются они по содержимому, а не по классу. */
      assert.deepEqual(
        JSON.parse(JSON.stringify(получено)),
        JSON.parse(JSON.stringify(пример.expected)),
        `«${функция.name}» / «${пример.name}»`,
      )
    }
  }
  assert.ok(счёт >= 5, `примеров всего ${счёт}`)
})

/* ─────────────── дифференциальная сверка: корпус сломанных ──────────────── */

const случаи = корпусПланов()

test("корпус планов: каждый случай даёт те же диагностики, что и эталон", () => {
  assert.ok(случаи.length >= 17, `случаев всего ${случаи.length}`)
  for (const случай of случаи) {
    const беда = расхождение(случай.ast)
    assert.equal(беда, null, `${случай.имя}: ${беда}`)
  }
})

test("корпус планов: сверка не пуста — эталон на нём поднимает шестнадцать диагностик", () => {
  const всего = случаи.reduce((сумма, случай) => сумма + эталонные(случай.ast).length, 0)
  assert.equal(всего, 16, `эталон поднял ${всего}`)
})

/* ─────────── настоящая программа дерева и программы без планов ─────────── */

const НАСТОЯЩАЯ = "flang/examples/io/link-report.flang"

test("настоящая программа с планом сверяется с эталоном", async () => {
  const путь = `${корень}${НАСТОЯЩАЯ}`
  const { diagnostics: _, ...ast } = await linkProgram(путь, readFileSync(путь, "utf8"), parse)
  assert.equal(расхождение(ast), null, НАСТОЯЩАЯ)
  /* Она ЦЕЛАЯ, и это половина утверждения: правильный план обязан молчать. */
  assert.deepEqual(эталонные(ast), [])
  assert.deepEqual(наши(ast), [])
})

/**
 * Программы БЕЗ планов — против близнеца, который жалуется на пустом месте.
 * Взяты крупные файлы дерева: у них есть и записи, и суммы, и сигнатуры, то
 * есть всё, что читают таблицы, — нет только объявления `план`.
 */
const БЕЗ_ПЛАНОВ = [
  "flang/stdlib/lists.flang",
  "flang/stdlib/strings.flang",
  "flang/core/json.flang",
  "flang/examples/leetcode/001-two-sum.flang",
]

test("программы без планов не поднимают ни одной диагностики ни у эталона, ни у близнеца", async () => {
  for (const путь of БЕЗ_ПЛАНОВ) {
    const текст = readFileSync(`${корень}${путь}`, "utf8")
    const { diagnostics: _, ...ast } = await linkProgram(`${корень}${путь}`, текст, parse)
    assert.deepEqual(эталонные(ast), [], `${путь}: эталон`)
    assert.deepEqual(наши(ast), [], `${путь}: близнец`)
  }
})
