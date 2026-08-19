/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * `flang/stdlib/sha256.flang` — сверка с эталоном на корпусе и на официальных
 * векторах.
 *
 * ЗАЧЕМ ЭТОТ ФАЙЛ ЕСТЬ. Хеш — это не «работает или нет», а «совпадает байт в
 * байт или бесполезен». Сторона на flang пишется ПАРОЙ к стороне на C99
 * (двоичный компилятор считает адрес модуля как `sha256("flang-lock-2 " +
 * исходник)`, см. `flang/src/lockfile.mjs`), и пара имеет смысл ровно тогда,
 * когда обе стороны сверены с одним эталоном на одном корпусе. Эталон здесь —
 * `node:crypto`, `createHash("sha256")`.
 *
 * ЧТО СВЕРЯЕТСЯ И НА СКОЛЬКИХ СЛУЧАЯХ:
 *
 *   • ВСЕ ПЯТЬ официальных векторов FIPS 180-4 / NIST CAVP, включая миллион
 *     букв «a» (15 625 блоков) — он и проверяет потоковую набивку на длине,
 *     где ошибка в счётчике длины видна, а на коротких входах не видна;
 *   • длины 0…200 подряд — все границы набивки: 55, 56, 63, 64, 119, 120;
 *   • все нули и все 255 на длинах 0…70;
 *   • все 256 однобайтовых сообщений;
 *   • 300 случайных наборов длиной 0…300;
 *   • пара с UTF-8: `sha256("flang-lock-2 " + текст)` через «Байты текста» из
 *     `flang/stdlib/utf8.flang` — ровно та формула, которой считает замок.
 *
 * ЗАМЕР ЦЕНЫ, И ОН НЕ УКРАШЕНИЕ. Один блок стоит интерпретатору 925 195 шагов
 * при пределе по умолчанию 1 000 000 (двоичный поиск по `flang run --max-steps`
 * на входе `[97, 98, 99]`). Запас — 7,5 %, и он в одну сторону: примером в
 * модуле может быть сообщение НЕ ДЛИННЕЕ ОДНОГО БЛОКА, а всё остальное живёт
 * здесь, где предела нет. Если предел или учёт шагов сдвинется, красным станет
 * `flang check flang/stdlib/sha256.flang` с кодом FLANG_EXAMPLE, а не этот файл.
 */
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { writeFile } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath, pathToFileURL } from "node:url"

import { emitJs } from "../src/emit/js.mjs"
import { parse } from "../src/parser.mjs"
import { рабочийКаталог } from "./tempdir.mjs"

const каталог = рабочийКаталог("sha256")

async function собрать(имя) {
  const источник = fileURLToPath(new URL(`../stdlib/${имя}.flang`, import.meta.url))
  const напечатано = emitJs(parse(readFileSync(источник, "utf8"), `${имя}.flang`), { cli: false })
  const путь = join(каталог, напечатано.files[0].path)
  await writeFile(путь, напечатано.files[0].content, "utf8")
  return import(pathToFileURL(путь).href)
}

const sha = await собрать("sha256")
const utf8 = await собрать("utf8")

const эталон = (байты) => createHash("sha256").update(Buffer.from(байты)).digest("hex")

/** Расхождения копятся списком: одно имя проверки — одно число. */
function сверить(имя, входы, наш = sha.heshBaytov) {
  const расхождения = []
  for (const байты of входы) {
    const ждали = эталон(байты)
    const дали = наш(байты)
    if (ждали !== дали) расхождения.push({ длина: байты.length, ждали, дали })
  }
  test(`${имя}: ${входы.length} случаев, расхождений с node:crypto 0`, () => {
    assert.deepEqual(расхождения.slice(0, 3), [], `расхождений ${расхождения.length} из ${входы.length}`)
  })
}

/* ── официальные векторы: они и решают, годится ли сторона пары ──────────── */

test("четыре коротких официальных вектора FIPS 180-4 совпадают знак в знак", () => {
  const векторы = [
    ["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
    ["abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
    [
      "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
    ],
    [
      "abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu",
      "cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1",
    ],
  ]
  for (const [текст, ждали] of векторы) {
    assert.equal(sha.heshBaytov([...Buffer.from(текст, "utf8")]), ждали, `вектор «${текст.slice(0, 24)}…»`)
  }
})

test("пятый официальный вектор: миллион букв «a» — 15 625 блоков подряд", () => {
  assert.equal(
    sha.heshBaytov(new Array(1000000).fill(97)),
    "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0",
  )
})

/* ── корпус ─────────────────────────────────────────────────────────────── */

const попорядку = []
for (let длина = 0; длина <= 200; длина += 1) {
  const байты = []
  for (let место = 0; место < длина; место += 1) байты.push(место % 256)
  попорядку.push(байты)
}
сверить("длины 0…200 подряд — все границы набивки", попорядку)

const края = []
for (let длина = 0; длина <= 70; длина += 1) {
  края.push(new Array(длина).fill(0))
  края.push(new Array(длина).fill(255))
}
сверить("все нули и все 255 на длинах 0…70", края)

сверить("все 256 однобайтовых сообщений", Array.from({ length: 256 }, (_, байт) => [байт]))

let семя = 987654321
const случайное = () => (семя = (семя * 1103515245 + 12345) % 2147483648) / 2147483648
const наугад = []
for (let раз = 0; раз < 300; раз += 1) {
  const длина = Math.floor(случайное() * 301)
  const байты = []
  for (let место = 0; место < длина; место += 1) байты.push(Math.floor(случайное() * 256))
  наугад.push(байты)
}
сверить("300 случайных наборов длиной 0…300", наугад)

/* ── пара с UTF-8: та самая формула замка ───────────────────────────────── */

test("адрес модуля: sha256(\"flang-lock-2 \" + исходник) совпадает с lockfile.mjs", () => {
  const исходники = [
    "",
    "модуль «Проба»\n",
    "flang-lock-2 ",
    "Мир",
    String.fromCodePoint(0x1f600),
    readFileSync(fileURLToPath(new URL("../stdlib/logic.flang", import.meta.url)), "utf8"),
  ]
  for (const исходник of исходники) {
    const груз = `flang-lock-2 ${исходник}`
    assert.equal(
      sha.heshBaytov(utf8.baytyTeksta(груз)),
      createHash("sha256").update(груз, "utf8").digest("hex"),
      `груз длиной ${груз.length}`,
    )
  }
})

/* ── что делается с не-байтом: решение названо и проверено ───────────────── */

test("не-байт — ноль, и «Это байты» говорит об этом заранее", () => {
  assert.equal(sha.etoBayty([0, 77, 255]), true)
  assert.equal(sha.etoBayty([256]), false)
  assert.equal(sha.etoBayty([-1]), false)
  assert.equal(sha.etoBayty([1.5]), false)
  assert.equal(sha.etoBayty([Number.NaN]), false)
  /* Вне договора обе стороны пары вольны: наша отвечает нулём, C обрезал бы по
     модулю (`(uint8_t)300` там даёт 44). Разница названа в шапке модуля, и вот
     она числом — 300, а не 256: на 256 обе развязки дают ноль и проверка была
     бы слепа. Так и было в первой редакции этого файла, и подделка «обрезать
     как в C» её прошла. */
  assert.equal(sha.heshBaytov([300]), sha.heshBaytov([0]))
  assert.equal(sha.heshBaytov([Number.NaN]), sha.heshBaytov([0]))
  assert.notEqual(sha.heshBaytov([300]), sha.heshBaytov([44]))
})

test("длина сообщения занимает все 64 разряда, а не младшие 32", () => {
  /* Сообщения на 512 МБ в корпусе нет и быть не может — миллион букв «a» и то
     считается 24 секунды, — поэтому верхняя половина поля длины проверяется
     прямо, на «Байты длины». Подделка «писать верхние четыре байта нулями»
     иначе проходит весь корпус целиком: она измерена, и вот чем закрыта. */
  assert.deepEqual(sha.baytyDliny(24), [0, 0, 0, 0, 0, 0, 0, 24])
  assert.deepEqual(sha.baytyDliny(2 ** 32), [0, 0, 0, 1, 0, 0, 0, 0])
  assert.deepEqual(sha.baytyDliny(2 ** 32 * 258 + 0x01020304), [0, 0, 1, 2, 1, 2, 3, 4])
  assert.deepEqual(sha.baytyDliny(2 ** 53 - 8), [0, 31, 255, 255, 255, 255, 255, 248])
})

test("поразрядные операции совпадают с побитовыми операциями JavaScript", () => {
  const слово = (х) => х >>> 0
  const пары = [0, 1, 5, 255, 65535, 0x12345678, 0x9abcdef0, 0xffffffff, 2147483648]
  for (const а of пары) {
    for (const б of пары) {
      for (const ц of пары) {
        assert.equal(sha.isklyuchayuscheeIliTryoh(а, б, ц), слово(а ^ б ^ ц), `xor3 ${а} ${б} ${ц}`)
        assert.equal(sha.vybor(а, б, ц), слово((а & б) ^ (~а & ц)), `Ch ${а} ${б} ${ц}`)
        assert.equal(sha.bolshinstvo(а, б, ц), слово((а & б) ^ (а & ц) ^ (б & ц)), `Maj ${а} ${б} ${ц}`)
      }
    }
  }
  for (const х of пары) {
    for (const k of [1, 2, 3, 6, 7, 10, 11, 13, 17, 18, 19, 22, 25, 31]) {
      assert.equal(sha.povorotVpravo(х, 2 ** k), слово((х >>> k) | (х << (32 - k))), `поворот ${х} на ${k}`)
      assert.equal(sha.sdvigVpravo(х, 2 ** k), х >>> k, `сдвиг ${х} на ${k}`)
    }
  }
})
