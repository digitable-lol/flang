/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * `flang test` УМЕЕТ КОРПУС: каталог и маску, а не один файл.
 *
 * ── Что здесь проверяется, и чего здесь нарочно нет ─────────────────────────
 *
 * Сам прогонщик написан НА FLANG (`flang/self/bootstrap/corpus.flang`), и
 * проверки его решений — тоже на flang
 * (`flang/проверки/прогонщик-корпуса.flang`, 28 утверждений). Этот файл их не
 * повторяет: он их ВОЗИТ и делает то единственное, чего вычислением не сделать
 * — запускает процесс и смотрит на код возврата. Каталога в языке нет, кода
 * возврата у вычисления нет, и подделывать их значением было бы проверкой
 * подделки.
 *
 * Поэтому здесь ровно три вещи:
 *   1. ведомость на flang прогоняется и обязана быть зелёной ЦЕЛИКОМ, причём
 *      список имён сверяется с самим файлом ведомости — файл, упавший разом,
 *      отдаёт ноль утверждений и ноль отказов, то есть выглядит как чистый;
 *   2. настоящий каталог из двух файлов, у одного пример заведомо ложен:
 *      прогонщик обязан НАЗВАТЬ упавший поимённо и вернуть НЕНУЛЕВОЙ код;
 *   3. маска берёт из того же каталога один чистый файл — и код нулевой.
 *
 * Второе и третье идут через ДВОИЧНЫЙ, потому что корпус живёт только у него:
 * в инструментарии на Node `flang test` по-прежнему берёт один файл. Нет
 * собранного двоичного — проба пропускается с диагностикой, как это заведено у
 * проб, которым нужен тулчейн; `FTS_REQUIRE_BINARY=1` превращает пропуск в
 * падение.
 */

import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const корень = fileURLToPath(new URL("../..", import.meta.url))
const свидетель = fileURLToPath(new URL("../bin/flang.mjs", import.meta.url))
const ведомость = "flang/проверки/прогонщик-корпуса.flang"
const двоичный = fileURLToPath(new URL("../../bootstrap/flang", import.meta.url))
const фикстуры = "flang/test/fixtures/korpus"

/** Имена утверждений читаются из самой ведомости: выписанный список отстаёт. */
function имена() {
  const текст = readFileSync(new URL(`../../${ведомость}`, import.meta.url), "utf8")
  return [...текст.matchAll(/«Вердикт корпуса» от "([^"]+)"/g)].map((пара) => пара[1])
}

function двоичным(t, доводы) {
  if (!existsSync(двоичный)) {
    if (process.env.FTS_REQUIRE_BINARY === "1") assert.fail(`нет двоичного ${двоичный}`)
    t.diagnostic("двоичного нет — соберите «make -C bootstrap»; проба пропущена")
    return null
  }
  return spawnSync(двоичный, доводы, { cwd: корень, encoding: "utf8", env: { ...process.env, LC_ALL: "C.UTF-8" } })
}

test("ведомость прогонщика корпуса на flang зелена целиком", (t) => {
  const вывод = execFileSync(process.execPath, [свидетель, "run", ведомость, "--function", "Ведомость прогонщика корпуса"], {
    cwd: корень,
    encoding: "utf8",
    env: { ...process.env, LC_ALL: "C.UTF-8" },
  })
  const строки = JSON.parse(вывод).result
  const ожидаемые = имена()
  assert.ok(ожидаемые.length > 0, "в ведомости не нашлось ни одного утверждения")
  assert.deepEqual(
    строки.map((строка) => строка.replace(/ — (да|НЕТ)$/, "")),
    ожидаемые,
    "список утверждений разошёлся с файлом ведомости",
  )
  assert.deepEqual(строки.filter((строка) => строка.endsWith("— НЕТ")), [], "утверждения о прогонщике разошлись")
  t.diagnostic(`утверждений о прогонщике корпуса: ${строки.length}, все сошлись`)
})

test("каталог с ложным примером: упавший назван поимённо, код ненулевой", (t) => {
  const прогон = двоичным(t, ["test", фикстуры])
  if (прогон === null) return
  assert.notEqual(прогон.status, 0, "код возврата обязан быть ненулевым: в каталоге лежит заведомо ложный пример")
  assert.match(прогон.stderr, /lozhnyy\.flang/, "упавший файл обязан быть назван поимённо")
  assert.match(прогон.stderr, /Заведомо ложный/, "упавший пример обязан быть назван поимённо")
  assert.doesNotMatch(прогон.stderr, /chistyy\.flang/, "чистый файл в замечаниях не место")
  assert.match(прогон.stdout, /файлов 2, взято 2, отказано 0, примеров 4 \(своих 4\), на чужих примерах 0, потеряно своих 0, прошло 3, не прошло 1/)
  t.diagnostic(прогон.stdout.trim())
})

test("--json: тот же итог машине, и он разбирается", (t) => {
  const прогон = двоичным(t, ["test", фикстуры, "--json"])
  if (прогон === null) return
  const свод = JSON.parse(прогон.stdout)
  assert.equal(свод.valid, false)
  assert.deepEqual(
    [свод.files, свод.taken, свод.refused, свод.total, свод.own, свод.noOwn, свод.lostOwn, свод.passed, свод.failed],
    [2, 2, 0, 4, 4, 0, 0, 3, 1],
  )
  const упавший = свод.results.find((строка) => строка.file.endsWith("lozhnyy.flang"))
  assert.equal(упавший.failures.length, 1)
  assert.equal(упавший.failures[0].example, "Заведомо ложный")
  assert.equal(упавший.failures[0].function, "Утроить в корпусе")
})

test("маска берёт из каталога один чистый файл, и код нулевой", (t) => {
  const прогон = двоичным(t, ["test", `${фикстуры}/ch*.flang`, "--json"])
  if (прогон === null) return
  const свод = JSON.parse(прогон.stdout)
  assert.equal(прогон.status, 0, "чистый корпус обязан давать ноль")
  assert.equal(свод.valid, true)
  assert.deepEqual([свод.files, свод.total, свод.own, свод.failed], [1, 2, 2, 0])
  assert.equal(свод.results[0].file, `${фикстуры}/chistyy.flang`)
})

/*
 * СВОИ примеры против ввезённых, на настоящем файле дерева.
 *
 * `flang/self/carriers.flang` — 176 строк, ни одного своего `пример`а, и при
 * этом `flang test` гоняет на нём 91 пример: все они приехали из
 * `totality.flang` по `использует`. До этой проверки прогонщик печатал про него
 * «примеров 91, прошло 91, не прошло 0» — зелёное число о том, что не проверено
 * ничем. Таких файлов в дереве девять на 11 683 строки, и пять из них — весь
 * слой доказательств.
 *
 * Проба идёт на живом файле, а не на выдумке: выдуманный доказывал бы, что так
 * БЫВАЕТ, а живой доказывает, что так ЕСТЬ.
 */
test("файл без своих примеров назван, а не засчитан чужими", (t) => {
  const прогон = двоичным(t, ["test", "flang/self/carriers.flang", "--json"])
  if (прогон === null) return
  const свод = JSON.parse(прогон.stdout)
  assert.equal(свод.own, 0, "у carriers.flang нет ни одного своего примера")
  assert.ok(свод.total > 0, "а чужих прогоняется много — иначе проверять нечего")
  assert.equal(свод.noOwn, 1, "такой файл обязан быть сосчитан отдельным числом")
  assert.equal(прогон.status, 0, "это не провал: у слоя доказательств своих примеров нет по устройству")
  t.diagnostic(`carriers.flang: прогнано ${свод.total}, из них своих ${свод.own}`)
})
