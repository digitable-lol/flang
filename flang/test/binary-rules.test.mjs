/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * ПОДДЕЛКА НА КАЖДОЕ ОБЪЯВЛЕНИЕ: программа, пытающаяся проехать сломанной,
 * обязана быть отвергнута — и свидетелем на Node, и бинарником.
 *
 * ── Улика, ради которой файл написан ────────────────────────────────────────
 *
 * Собранный бинарник (тот, что раздаёт Homebrew) МОЛЧА ПРИНИМАЛ сломанные
 * программы. Замер на `github/main` d3e27dad, бинарник собран из `bootstrap/`:
 * тринадцать подделок, по одной на объявление языка. Свидетель отверг ВСЕ 13 с
 * названным кодом; бинарник ответил «проверено — разбор, типы, завершаемость,
 * ядро и примеры; замечаний нет» и кодом 0 на ВСЕХ 13.
 *
 *   подделка                        свидетель                    бинарник до
 *   morphism-compose                FLANG_COMPOSE_MISMATCH       0, «замечаний нет»
 *   category-not-closed             FLANG_CATEGORY_NOT_CLOSED    0, «замечаний нет»
 *   functor-arrow                   FLANG_FUNCTOR_ARROW_MISMATCH 0, «замечаний нет»
 *   bifunctor-object-missing        FLANG_BIFUNCTOR_OBJECT_MISSING 0, «замечаний нет»
 *   transform-not-total             FLANG_TRANSFORM_NOT_TOTAL    0, «замечаний нет»
 *   iso-mismatch                    FLANG_ISO_MISMATCH           0, «замечаний нет»
 *   monoid-assoc                    FLANG_MONOID_ASSOC           0, «замечаний нет»
 *   monad-left-unit                 FLANG_MONAD_LEFT_UNIT        0, «замечаний нет»
 *   property-not-commutative        FLANG_NOT_COMMUTATIVE        0, «замечаний нет»
 *   embedding-not-injective         FLANG_EMBED_NOT_INJECTIVE    0, «замечаний нет»
 *   meet-same-side                  FLANG_MEET_SAME_SIDE         0, «замечаний нет»
 *   scale-mismatch                  FLANG_SCALE                  0, «замечаний нет»
 *   handler-without-budget          FLANG_HANDLER_NOT_TOTAL      0, «замечаний нет»
 *
 * ── Что здесь проверяется ───────────────────────────────────────────────────
 *
 * Двумя половинами, и обе прогоном, а не чтением.
 *
 * ПЕРВАЯ: свидетель правда отвергает каждую подделку и называет её своим кодом.
 * Без этого вторая половина проверяла бы согласие двух молчаний.
 *
 * ВТОРАЯ: слой на flang, который бинарник спрашивает шестым шагом проверки
 * («Что бинарник не судил» в `flang/self/bootstrap/compiler.flang`), НАЗЫВАЕТ
 * поверхность каждой подделки. Считается он тем же вычислителем, каким его
 * считает сам бинарник, — компилятора C для этого не нужно.
 *
 * ── Названный зазор, и он ровно один ────────────────────────────────────────
 *
 * `scale-mismatch` бинарник по-прежнему пропускает, и это НЕ недосмотр, а
 * измеренная граница: уточнённые числовые типы (`сотых`, `тысячных`, `вес`)
 * стоят ТИПОМ в подписи, а не отдельной строкой, и по верхним ключам AST такую
 * программу от обычной не отличить. Значит бинарник не может даже назвать своё
 * незнание — а раз не может, оно названо в справке (`HELP_CHECK`) и в
 * `binary-rules-guard.mjs` записью с доводом. Тест держит зазор ИМЕННО ОДНИМ:
 * подделка, переставшая проезжать, красит его — долг закрыт, снимайте запись.
 */
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { globSync } from "./glob.mjs"

import { вЗначение } from "../src/bridge.mjs"
import { evaluate } from "../src/interpret.mjs"
import { linkProgram } from "../src/link.mjs"
import { parse } from "../src/parser.mjs"
import { РАЗНИЦА } from "../scripts/binary-rules-guard.mjs"
import { ВХОД, ПРЕДЕЛЫ } from "../../scripts/bootstrap-c.mjs"

const корень = fileURLToPath(new URL("../..", import.meta.url))
const КАТАЛОГ = "flang/test/fixtures/binary-rules"

/**
 * Подделки: имя файла → код, которым его обязан отвергнуть свидетель, и
 * поверхность, которую обязан назвать бинарник.
 *
 * `handler-without-budget` лежит не здесь, а в примерах: он написан как улика
 * задолго до этой работы («эта программа НЕ СОБИРАЕТСЯ, и в этом весь её
 * смысл»), и копия под другим именем была бы вторым местом, где та же улика
 * может протухнуть.
 */
const ПОДДЕЛКИ = Object.freeze([
  { файл: `${КАТАЛОГ}/morphism-compose.flang`, код: "FLANG_COMPOSE_MISMATCH", поверхность: "morphisms" },
  { файл: `${КАТАЛОГ}/category-not-closed.flang`, код: "FLANG_CATEGORY_NOT_CLOSED", поверхность: "categories" },
  { файл: `${КАТАЛОГ}/functor-arrow.flang`, код: "FLANG_FUNCTOR_ARROW_MISMATCH", поверхность: "functors" },
  { файл: `${КАТАЛОГ}/bifunctor-object-missing.flang`, код: "FLANG_BIFUNCTOR_OBJECT_MISSING", поверхность: "bifunctors" },
  { файл: `${КАТАЛОГ}/transform-not-total.flang`, код: "FLANG_TRANSFORM_NOT_TOTAL", поверхность: "transformations" },
  { файл: `${КАТАЛОГ}/iso-mismatch.flang`, код: "FLANG_ISO_MISMATCH", поверхность: "isomorphisms" },
  { файл: `${КАТАЛОГ}/monoid-assoc.flang`, код: "FLANG_MONOID_ASSOC", поверхность: "monoids" },
  { файл: `${КАТАЛОГ}/monad-left-unit.flang`, код: "FLANG_MONAD_LEFT_UNIT", поверхность: "monads" },
  { файл: `${КАТАЛОГ}/property-not-commutative.flang`, код: "FLANG_NOT_COMMUTATIVE", поверхность: "properties" },
  { файл: `${КАТАЛОГ}/embedding-not-injective.flang`, код: "FLANG_EMBED_NOT_INJECTIVE", поверхность: "embeddings" },
  { файл: `${КАТАЛОГ}/meet-same-side.flang`, код: "FLANG_MEET_SAME_SIDE", поверхность: "intersections" },
  { файл: "flang/examples/web/shortener/handler-without-budget.flang", код: "FLANG_HANDLER_NOT_TOTAL", поверхность: "processes" },
])

/** Подделка, которую бинарник по-прежнему пропускает, — поимённо и одна. */
const ЗАЗОР = Object.freeze([{ файл: `${КАТАЛОГ}/scale-mismatch.flang`, код: "FLANG_SCALE" }])

/* ── связанный компилятор: тот же, что печатается в `bootstrap/` ── */

const исходникВхода = readFileSync(join(корень, ВХОД), "utf8")
const { diagnostics: _бедыСвязывания, ...компилятор } = await linkProgram(join(корень, ВХОД), исходникВхода, parse)

/** Имена поверхностей, которые слой назовёт у этой программы. */
function поверхности(путь) {
  const текст = readFileSync(join(корень, путь), "utf8")
  const разобранная = parse(текст, путь)
  const строка = evaluate(
    компилятор,
    "Названия двух",
    { связанная: вЗначение(разобранная), разобранная: вЗначение(разобранная) },
    { maxSteps: ПРЕДЕЛЫ.maxSteps, maxDepth: ПРЕДЕЛЫ.maxDepth },
  )
  return строка === "" ? [] : строка.split(", ")
}

/**
 * Ответ свидетеля — НАСТОЯЩЕЙ КОМАНДОЙ, а не пересказом её из кусков.
 *
 * Пересказ здесь и стоял: `linkProgram` плюс `checkTypes` плюс перечисленные
 * поимённо слои законов. Он врал — ровно тем же способом, каким врала сверка
 * двух реализаций (см. шапку `flang/scripts/binary-rules-guard.mjs`). Свидетель
 * файл БЕЗ единого `использует` не связывает вовсе, а `linkProgram` связывает
 * всегда и теряет при этом свойства и преобразования; собранный из кусков
 * «свидетель» отвечал на `transform-not-total.flang` пустым списком там, где
 * настоящая команда отвечает `FLANG_TRANSFORM_NOT_TOTAL`.
 *
 * Цена — запуск процесса на подделку (около двух секунд). Она того стоит: это
 * ровно та команда, которую набирает человек.
 */
function кодыСвидетеля(путь) {
  const итог = spawnSync(process.execPath, [join(корень, "flang/bin/flang.mjs"), "check", join(корень, путь)], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
  /* Отвергнутая программа уезжает в stderr, годная — в stdout: у команды это
     разные потоки, и брать только один значило бы читать половину ответов. */
  const ответ = JSON.parse(итог.stdout.trim() === "" ? итог.stderr : итог.stdout)
  return { коды: (ответ.diagnostics ?? []).map((б) => б.code), код: итог.status }
}

/* ── половина первая: подделка правда сломана ── */

test("свидетель отвергает КАЖДУЮ подделку и называет её своим кодом", () => {
  for (const { файл, код } of [...ПОДДЕЛКИ, ...ЗАЗОР]) {
    const { коды, код: возврат } = кодыСвидетеля(файл)
    assert.equal(возврат, 1, `${файл}: свидетель ответил кодом ${возврат}, а подделка обязана быть отвергнута`)
    assert.ok(коды.includes(код), `${файл}: свидетель дал ${JSON.stringify(коды)}, а ждали ${код}`)
  }
})

test("подделки не свалены в кучу: каждая ломает СВОЁ правило", () => {
  const коды = new Set([...ПОДДЕЛКИ, ...ЗАЗОР].map((п) => п.код))
  assert.equal(коды.size, ПОДДЕЛКИ.length + ЗАЗОР.length, "две подделки ломают одно правило — одна из них лишняя")
  const поверхностиРазницы = new Set(РАЗНИЦА.flatMap((з) => з.ключи))
  for (const { файл, поверхность } of ПОДДЕЛКИ) {
    assert.ok(поверхностиРазницы.has(поверхность), `${файл}: поверхности «${поверхность}» нет в РАЗНИЦА`)
  }
})

/* ── половина вторая: бинарник называет, чего он не судил ── */

test("слой бинарника называет поверхность КАЖДОЙ подделки", () => {
  for (const { файл, поверхность } of ПОДДЕЛКИ) {
    const названо = поверхности(файл)
    assert.ok(названо.includes(поверхность), `${файл}: слой назвал ${JSON.stringify(названо)}, а ждали «${поверхность}»`)
  }
})

test("НАЗВАННЫЙ ЗАЗОР: уточнённые числа слой не ловит, и это ровно один случай", () => {
  for (const { файл } of ЗАЗОР) {
    assert.deepEqual(
      поверхности(файл),
      [],
      `${файл}: слой научился называть эту поверхность — зазор закрыт, снимайте запись из ЗАЗОР и из binary-rules-guard.mjs`,
    )
  }
})

test("чистая программа препятствия не получает: сторож не красит всё подряд", () => {
  for (const путь of ["flang/stdlib/lists.flang", "flang/examples/leetcode/001-two-sum.flang"]) {
    assert.deepEqual(поверхности(путь), [], `${путь}: у обычной программы объявилось препятствие`)
  }
})

/* ── изъятие: сторож обязан уметь краснеть ── */

test("ИЗЪЯТИЕ: убери ключ из списка поверхностей — подделка перестаёт называться", () => {
  const путь = join(корень, ВХОД)
  const исходник = readFileSync(путь, "utf8")
  const испорчен = исходник.replace('"categories", ', "")
  assert.notEqual(испорчен, исходник, "место изъятия не найдено — тест не о том")
  const другой = linkProgram(путь, испорчен, parse)
  return другой.then((связано) => {
    const { diagnostics: _пропущено, ...программа } = связано
    const текст = readFileSync(join(корень, `${КАТАЛОГ}/category-not-closed.flang`), "utf8")
    const разобранная = вЗначение(parse(текст, "проба.flang"))
    const строка = evaluate(
      программа,
      "Названия двух",
      { связанная: разобранная, разобранная },
      { maxSteps: ПРЕДЕЛЫ.maxSteps, maxDepth: ПРЕДЕЛЫ.maxDepth },
    )
    assert.ok(
      !строка.split(", ").includes("categories"),
      "изъятие ничего не сломало: список поверхностей ни на что не влияет",
    )
  })
})

/* ── охват: подделки покрывают все поверхности, которые ловятся объявлением ── */

test("подделка есть у КАЖДОЙ поверхности, которую бинарник умеет назвать", () => {
  const покрыто = new Set(ПОДДЕЛКИ.map((п) => п.поверхность))
  const непокрыто = []
  for (const запись of РАЗНИЦА) {
    if (запись.ключи.length === 0) continue
    if (запись.ключи.some((ключ) => покрыто.has(ключ))) continue
    непокрыто.push(запись.поверхность)
  }
  assert.deepEqual(непокрыто, ["требование к функции"], "набор подделок разошёлся с составом правил")
})

test("файлы подделок не заведены впустую: каждый лежит в дереве и разбирается", () => {
  const вКаталоге = globSync("*.flang", { cwd: join(корень, КАТАЛОГ) }).sort()
  const названы = [...ПОДДЕЛКИ, ...ЗАЗОР]
    .map((п) => п.файл)
    .filter((путь) => путь.startsWith(КАТАЛОГ))
    .map((путь) => путь.slice(КАТАЛОГ.length + 1))
    .sort()
  assert.deepEqual(вКаталоге, названы, "в каталоге подделок лежит файл, которого не судит ни один тест")
})
