/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * ПАКЕТ — проверки того единственного утверждения, ради которого он заводился:
 * **чужой модуль подключается одной строкой, и программа собирается там, где
 * исходников этого модуля нет вовсе.**
 *
 * Проверка устроена подделкой, а не осмотром. Настоящая библиотека
 * (`docs/examples/package/discount.flang`) собирается в пакет, программа
 * потребителя копируется в ПУСТОЙ каталог вместе с одним файлом пакета, и
 * `flang check`, `flang test`, `flang emit` обязаны отдать то же самое, что
 * отдали бы по исходникам, — байт в байт. Контрольный опыт стоит рядом и
 * обязателен: тот же каталог без файла пакета обязан отказать. Иначе проверка
 * доказывала бы не работу пакета, а то, что библиотека где-то нашлась.
 *
 * Отдельно проверяется то, чего пакет НЕ делает и делать не должен:
 * предусловие библиотечной функции обязано оплачиваться на КАЖДОМ месте
 * вызова у того, кто пакет подключил. Пакет, который вёз бы предусловие
 * снятым, был бы аксиомой под другим именем.
 *
 * Запуск: node --test flang/test/package.test.mjs
 */
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { СХЕМА_ПАКЕТА, модулиПакета, печатьПакета, разобратьОбъявление, собратьПакет } from "../src/package.mjs"
import { parse } from "../src/parser.mjs"

const корень = fileURLToPath(new URL("../..", import.meta.url))
const CLI = join(корень, "flang", "bin", "flang.mjs")
const ПАКЕТ_ИСХОДНИК = join(корень, "docs", "examples", "package", "discount.flang")
const ПОТРЕБИТЕЛЬ = join(корень, "docs", "examples", "package", "shop", "shop.flang")
const ОБЪЯВЛЕНИЕ = { имя: "Скидка", версия: "1.0.0", источник: "https://github.com/digitable-lol/flang" }

const позвать = (аргументы, { ждатьОтказ = false } = {}) => {
  try {
    return execFileSync(process.execPath, [CLI, ...аргументы], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
  } catch (ошибка) {
    if (!ждатьОтказ) throw ошибка
    return `${ошибка.stdout ?? ""}${ошибка.stderr ?? ""}`
  }
}

const вовремя = () => mkdtempSync(join(tmpdir(), "flang-paket-"))

test("объявление пакета читается, а неполное — отвергается", () => {
  assert.deepEqual(разобратьОбъявление('{"имя":"А","версия":"1.0.0"}', "ф"), {
    имя: "А",
    версия: "1.0.0",
    источник: null,
  })
  assert.throws(() => разобратьОбъявление('{"имя":"А"}', "ф"), /версия/)
  assert.throws(() => разобратьОбъявление('{"версия":"1.0.0"}', "ф"), /имя/)
  assert.throws(() => разобратьОбъявление("[]", "ф"), /запись JSON/)
  assert.throws(() => разобратьОбъявление("{", "ф"), /JSON/)
})

test("имя пакета обязано совпасть с именем модуля", async () => {
  await assert.rejects(
    собратьПакет(ПАКЕТ_ИСХОДНИК, parse, { ...ОБЪЯВЛЕНИЕ, имя: "Не Скидка" }),
    /назван «Не Скидка».*называется «Скидка»/s,
  )
})

test("в пакете лежит сам модуль, а не ссылка на него", async () => {
  const пакет = await собратьПакет(ПАКЕТ_ИСХОДНИК, parse, ОБЪЯВЛЕНИЕ)
  assert.equal(пакет.схема, СХЕМА_ПАКЕТА)
  assert.equal(пакет.имя, "Скидка")
  assert.equal(пакет.версия, "1.0.0")
  assert.equal(пакет.вход, "./discount.flang")
  assert.equal(пакет.модули.length, 1)
  /* Ссылка на склад была бы короткой; здесь лежит КОД, и он длинный. Цену
     подхода надо видеть в проверке, а не только в отчёте. */
  assert.ok(пакет.модули[0].адрес.length > 400, "адрес подозрительно короток для кода модуля")
  assert.equal(модулиПакета(пакет, "/где-то/discount.flang-package").size, 1)
})

test("ПЕЧАТЬ ЗАВЕРЯЕТ ЛИЧНОСТЬ ПАКЕТА, а не только груз", async () => {
  const пакет = await собратьПакет(ПАКЕТ_ИСХОДНИК, parse, ОБЪЯВЛЕНИЕ)
  const где = "/где-то/discount.flang-package"
  assert.equal(модулиПакета(пакет, где).size, 1)
  /* Каждая из этих подмен ДО правки печати проходила молча — `flang check`
     отвечал `{"valid":true,…}`. Их пять, и каждая обязана отвергаться. */
  for (const [что, порча] of [
    ["версия", (п) => { п.версия = "9.9.9" }],
    ["имя пакета", (п) => { п.имя = "Чужой" }],
    ["источник", (п) => { п.источник = "https://chuzhoy.example" }],
    ["имя модуля", (п) => { п.модули[0].имя = "Чужой" }],
    ["число функций", (п) => { п.модули[0].функций = 999 }],
  ]) {
    const подделка = JSON.parse(JSON.stringify(пакет))
    порча(подделка)
    assert.notEqual(печатьПакета(подделка), пакет.печать, `подмена «${что}» не сдвинула печать`)
    assert.throws(() => модулиПакета(подделка, где), /печать пакета/, `подмена «${что}» не отвергнута`)
  }
  const чужаяСхема = { ...пакет, схема: СХЕМА_ПАКЕТА + 1 }
  assert.throws(() => модулиПакета(чужаяСхема, где), /схем/)
})

test("испорченный груз пакета отвергается и называет модуль", async () => {
  const пакет = await собратьПакет(ПАКЕТ_ИСХОДНИК, parse, ОБЪЯВЛЕНИЕ)
  const подделка = JSON.parse(JSON.stringify(пакет))
  const адрес = подделка.модули[0].адрес
  подделка.модули[0].адрес = адрес.slice(0, 20) + (адрес[20] === "A" ? "B" : "A") + адрес.slice(21)
  подделка.печать = печатьПакета(подделка)
  assert.throws(() => модулиПакета(подделка, "/где-то/п.flang-package"), /груз модуля «Скидка» в пакете «Скидка 1\.0\.0»/)
})

test("ВЕДОМОСТЬ пакета несёт то, что сказало ядро", () => {
  const пакет = JSON.parse(позвать(["package", ПАКЕТ_ИСХОДНИК]))
  assert.deepEqual(пакет.ведомость, [
    {
      функция: "Цена за вычетом",
      утверждение: "цена за вычетом не выходит за точный потолок",
      сила: "доказано",
    },
  ])
})

test("ГЛАВНОЕ: программа собирается в пустом каталоге, где библиотеки нет", () => {
  const где = вовремя()
  try {
    cpSync(ПОТРЕБИТЕЛЬ, join(где, "shop.flang"))
    /* Контрольный опыт: БЕЗ пакета тот же каталог обязан отказать. Без него
       проверка доказывала бы, что библиотека где-то нашлась. */
    const без = позвать(["check", join(где, "shop.flang")], { ждатьОтказ: true })
    assert.match(без, /FLANG_PACKAGE|FLANG_IMPORT_NOT_FOUND/)

    writeFileSync(join(где, "discount.flang-package"), позвать(["package", ПАКЕТ_ИСХОДНИК]))
    const с = JSON.parse(позвать(["check", join(где, "shop.flang")]))
    assert.equal(с.valid, true)
    assert.deepEqual(
      с.functions.map((ф) => ф.name).sort(),
      ["Скидка в копейках", "Сколько скинули", "Цена в витрине", "Цена за вычетом"],
    )
    const тесты = JSON.parse(позвать(["test", join(где, "shop.flang")]))
    assert.equal(тесты.valid, true)
    assert.ok(тесты.total >= 7, `примеров прогнано ${тесты.total}`)
  } finally {
    rmSync(где, { recursive: true, force: true })
  }
})

test("печать из пакета и печать из исходников совпадают побайтово", () => {
  const где = вовремя()
  try {
    /* Слева — сборка по исходникам: библиотека рядом, импорт путём.
       Справа — сборка по пакету: библиотеки нет, импорт одной строкой. */
    const слева = join(где, "istochniki")
    const справа = join(где, "paket")
    mkdirSync(слева, { recursive: true })
    mkdirSync(справа, { recursive: true })
    cpSync(ПАКЕТ_ИСХОДНИК, join(слева, "discount.flang"))
    writeFileSync(
      join(слева, "shop.flang"),
      readFileSync(ПОТРЕБИТЕЛЬ, "utf8").replace('"discount.flang-package"', '"discount.flang"'),
    )
    cpSync(ПОТРЕБИТЕЛЬ, join(справа, "shop.flang"))
    writeFileSync(join(справа, "discount.flang-package"), позвать(["package", ПАКЕТ_ИСХОДНИК]))

    const цели = позвать(["emit", join(слева, "shop.flang"), "--target", "c"])
    const целиП = позвать(["emit", join(справа, "shop.flang"), "--target", "c"])
    /* Пути в выводе печати свои у каждого каталога — сверяются БАЙТЫ кода. */
    const кодом = (текст) => JSON.parse(текст).files.map((ф) => ф.content).join("\n")
    assert.equal(кодом(целиП), кодом(цели), "печать в C из пакета разошлась с печатью из исходников")
  } finally {
    rmSync(где, { recursive: true, force: true })
  }
})

test("ПРЕДУСЛОВИЕ ПЛАТИТ ВЫЗЫВАЮЩИЙ, и пакет его не везёт", () => {
  const где = вовремя()
  try {
    /* Изъятие: у потребителя снято `требует`. Пакет вёз бы предусловие снятым
       — программа собралась бы. Она обязана НЕ собраться, и отказ обязан
       назвать и вызов, и утверждение. */
    writeFileSync(
      join(где, "shop.flang"),
      readFileSync(ПОТРЕБИТЕЛЬ, "utf8").replace("  требует «доля не больше ста» доля не больше 100\n", ""),
    )
    writeFileSync(join(где, "discount.flang-package"), позвать(["package", ПАКЕТ_ИСХОДНИК]))
    const вывод = позвать(["check", join(где, "shop.flang")], { ждатьОтказ: true })
    const итог = JSON.parse(вывод)
    assert.equal(итог.valid, false)
    const беда = итог.diagnostics.find((д) => д.code === "FLANG_PRECONDITION_CALL")
    assert.ok(беда !== undefined, `ожидался FLANG_PRECONDITION_CALL, пришло ${JSON.stringify(итог.diagnostics)}`)
    assert.match(беда.message, /«доля не больше ста»/)
  } finally {
    rmSync(где, { recursive: true, force: true })
  }
})

test("ДВУХ ВЕРСИЙ ОДНОЙ БИБЛИОТЕКИ НЕ БЫВАЕТ, и отказ называет оба пакета", () => {
  const где = вовремя()
  try {
    /* Ромб: две библиотеки тянут третью, и третья у них РАЗНАЯ. Отказ обязан
       назвать пакеты и версии, а не молча взять того, кто приехал первым. */
    for (const [имя, хвост] of [["а", ""], ["б", "\n\nтотальная функция «Лишняя»\n  принимает н: нат\n  возвращает число\n  пример «н»\n    дано н равно 0\n    ожидается 0\n  н\n"]]) {
      const каталог = join(где, имя)
      mkdirSync(каталог, { recursive: true })
      writeFileSync(join(каталог, "obshee.flang"), readFileSync(ПАКЕТ_ИСХОДНИК, "utf8") + хвост)
      writeFileSync(
        join(каталог, "lib.flang"),
        `модуль «Библиотека ${имя}»\n  экспортирует «Через ${имя}»\n  использует «Скидка» из "obshee.flang"\n\nтотальная функция «Через ${имя}»\n  принимает цена: нат, скидка: нат\n  возвращает число\n  пример «н»\n    дано цена равно 10\n    дано скидка равно 1\n    ожидается 9\n  «Цена за вычетом» от цена и скидка\n`,
      )
      writeFileSync(join(каталог, "flang.package"), JSON.stringify({ имя: `Библиотека ${имя}`, версия: "1.0.0" }))
      writeFileSync(join(где, `lib-${имя}.flang-package`), позвать(["package", join(каталог, "lib.flang")]))
    }
    writeFileSync(
      join(где, "romb.flang"),
      'модуль «Ромб»\n  использует «Библиотека а» из "lib-а.flang-package"\n  использует «Библиотека б» из "lib-б.flang-package"\n\nтотальная функция «Проба»\n  принимает н: нат\n  возвращает число\n  пример «н»\n    дано н равно 0\n    ожидается 0\n  н\n',
    )
    const вывод = позвать(["check", join(где, "romb.flang")], { ждатьОтказ: true })
    assert.match(вывод, /FLANG_PACKAGE/)
    assert.match(вывод, /Библиотека а 1\.0\.0/)
    assert.match(вывод, /Библиотека б 1\.0\.0/)
    assert.match(вывод, /поднимите обе стороны до одной версии/)
  } finally {
    rmSync(где, { recursive: true, force: true })
  }
})

test("пакет над пакетом: замыкание переезжает целиком, вложенного файла на диске нет", () => {
  const где = вовремя()
  try {
    const низ = join(где, "niz")
    const верх = join(где, "verh")
    mkdirSync(низ, { recursive: true })
    mkdirSync(верх, { recursive: true })
    cpSync(ПАКЕТ_ИСХОДНИК, join(низ, "discount.flang"))
    writeFileSync(join(низ, "flang.package"), JSON.stringify(ОБЪЯВЛЕНИЕ))
    writeFileSync(join(верх, "discount.flang-package"), позвать(["package", join(низ, "discount.flang")]))
    writeFileSync(
      join(верх, "verh.flang"),
      'модуль «Верх»\n  экспортирует «Через верх»\n  использует «Скидка» из "discount.flang-package"\n\nтотальная функция «Через верх»\n  принимает цена: нат, скидка: нат\n  возвращает число\n  пример «н»\n    дано цена равно 10\n    дано скидка равно 1\n    ожидается 9\n  «Цена за вычетом» от цена и скидка\n',
    )
    writeFileSync(join(верх, "flang.package"), JSON.stringify({ имя: "Верх", версия: "2.0.0" }))
    const свой = вовремя()
    try {
      writeFileSync(join(свой, "verh.flang-package"), позвать(["package", join(верх, "verh.flang")]))
      writeFileSync(
        join(свой, "prog.flang"),
        'модуль «Программа»\n  использует «Верх» из "verh.flang-package"\n\nтотальная функция «Проба»\n  принимает цена: нат, скидка: нат\n  возвращает число\n  пример «н»\n    дано цена равно 10\n    дано скидка равно 1\n    ожидается 9\n  «Через верх» от цена и скидка\n',
      )
      /* В каталоге ДВА файла: программа и один пакет. Вложенного
         `discount.flang-package` тут нет — он лежит грузом внутри верхнего. */
      const итог = JSON.parse(позвать(["check", join(свой, "prog.flang")]))
      assert.equal(итог.valid, true)
      assert.ok(итог.functions.some((ф) => ф.name === "Цена за вычетом"), "модуль из вложенного пакета не приехал")
      assert.equal(JSON.parse(позвать(["test", join(свой, "prog.flang")])).valid, true)
    } finally {
      rmSync(свой, { recursive: true, force: true })
    }
  } finally {
    rmSync(где, { recursive: true, force: true })
  }
})

test("пакет собирается только из проверенного", () => {
  const где = вовремя()
  try {
    writeFileSync(
      join(где, "krivoy.flang"),
      "модуль «Кривой»\n\nтотальная функция «Ф»\n  принимает н: нат\n  возвращает строка\n  пример «н»\n    дано н равно 0\n    ожидается \"\"\n  н\n",
    )
    writeFileSync(join(где, "flang.package"), JSON.stringify({ имя: "Кривой", версия: "1.0.0" }))
    const вывод = позвать(["package", join(где, "krivoy.flang")], { ждатьОтказ: true })
    assert.match(вывод, /FLANG_PACKAGE|FLANG_TYPE/)
  } finally {
    rmSync(где, { recursive: true, force: true })
  }
})

test("без объявления flang.package команда отказывает, а не выдумывает имя", () => {
  const где = вовремя()
  try {
    cpSync(ПАКЕТ_ИСХОДНИК, join(где, "discount.flang"))
    const вывод = позвать(["package", join(где, "discount.flang")], { ждатьОтказ: true })
    assert.match(вывод, /FLANG_PACKAGE/)
    assert.match(вывод, /flang\.package/)
  } finally {
    rmSync(где, { recursive: true, force: true })
  }
})

test("ПАКЕТ В ДЕРЕВЕ НЕ ПРОТУХ: собранный заново совпадает с лежащим рядом", () => {
  /* Файл `docs/examples/package/shop/discount.flang-package` — не документация,
     а груз: он лежит в дереве, и `flang check` на соседней программе собирает
     её ИМЕННО ИЗ НЕГО. Стоит разбору сдвинуться хоть одним полем — файл станет
     памятником прежнему AST, а страница «Пакеты» начнёт показывать байты,
     которых сегодняшний `flang package` уже не печатает.

     Сверка побайтовая и с ЯВНОЙ подсказкой, что делать: пересобрать. */
  const свежий = позвать(["package", ПАКЕТ_ИСХОДНИК])
  const лежит = readFileSync(
    join(корень, "docs", "examples", "package", "shop", "discount.flang-package"),
    "utf8",
  )
  assert.equal(
    свежий,
    лежит,
    "пакет в дереве отстал от исходника: пересоберите — " +
      "flang package docs/examples/package/discount.flang > docs/examples/package/shop/discount.flang-package",
  )
})
