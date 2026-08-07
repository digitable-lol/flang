/**
 * Связывание модулей: `использует «Модуль» из "путь"`.
 *
 * До появления link.mjs эта конструкция разбиралась, но не действовала: имена
 * из другого файла оставались несвязанными. Из-за этого stdlib нельзя было
 * использовать из решений, а ядро FTS, разложенное по слоям, не собиралось в
 * одну программу. Тесты ниже фиксируют и то, что импорт работает, и то, что он
 * отказывается работать молча — на цикле, на пропавшем файле, на конфликте.
 */
import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, test } from "node:test"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import { importsOf, linkProgram } from "../src/link.mjs"
import { parse } from "../src/parser.mjs"
import { checkTypes } from "../src/types.mjs"

const run = promisify(execFile)
const cli = fileURLToPath(new URL("../bin/flang.mjs", import.meta.url))
const stdlib = fileURLToPath(new URL("../stdlib/", import.meta.url))

const dirs = []
async function sandbox(files) {
  const dir = await mkdtemp(join(tmpdir(), "flang-link-"))
  dirs.push(dir)
  for (const [name, text] of Object.entries(files)) await writeFile(join(dir, name), text, "utf8")
  return dir
}
after(async () => {
  for (const dir of dirs) await rm(dir, { recursive: true, force: true })
})

/** Связывание без CLI: сразу видно, что попало в объединённую программу. */
function link(entry, source) {
  return linkProgram(entry, source, parse)
}

/* ────────────────────────────── импорт работает ─────────────────────────── */

test("функция из импортированного модуля становится вызываемой", async () => {
  const dir = await sandbox({
    "числа.flang": `модуль «Числа»

тотальная функция «Удвоить»
  принимает значение: число
  возвращает число
  значение умножить на 2
`,
    "главный.flang": `модуль «Главный»
  использует «Числа» из "числа.flang"

тотальная функция «Учетверить»
  принимает значение: число
  возвращает число
  «Удвоить» от («Удвоить» от значение)
`,
  })
  const { stdout } = await run("node", [
    cli,
    "run",
    join(dir, "главный.flang"),
    "--function",
    "Учетверить",
    "--args",
    JSON.stringify({ значение: 5 }),
  ])
  assert.equal(JSON.parse(stdout).result, 20)
})

test("импорт транзитивен: модуль через модуль", async () => {
  const dir = await sandbox({
    "а.flang": `модуль «А»

тотальная функция «Один»
  возвращает число
  1
`,
    "б.flang": `модуль «Б»
  использует «А» из "а.flang"

тотальная функция «Два»
  возвращает число
  «Один» плюс 1
`,
    "в.flang": `модуль «В»
  использует «Б» из "б.flang"

тотальная функция «Три»
  возвращает число
  «Два» плюс «Один»
`,
  })
  const { stdout } = await run("node", [cli, "run", join(dir, "в.flang"), "--function", "Три", "--args", "{}"])
  assert.equal(JSON.parse(stdout).result, 3)
})

test("настоящий stdlib подключается из чужого каталога", async () => {
  const dir = await sandbox({
    "решение.flang": `модуль «Решение»
  использует «Списки» из ${JSON.stringify(join(stdlib, "lists.flang"))}

тотальная функция «Сумма списка»
  принимает элементы: список числа
  возвращает число
  «Сумма» от элементы
`,
  })
  const { stdout } = await run("node", [
    cli,
    "run",
    join(dir, "решение.flang"),
    "--function",
    "Сумма списка",
    "--args",
    JSON.stringify({ элементы: [1, 2, 3, 40] }),
  ])
  assert.equal(JSON.parse(stdout).result, 46)
})

test("типы импортируются вместе с функциями", async () => {
  const dir = await sandbox({
    "типы.flang": `модуль «Типы»

тип «Ответ»
  вариант Верх
  вариант Низ

тотальная функция «Положительный»
  принимает значение: число
  возвращает «Ответ»
  если значение больше 0 то вариант Верх иначе вариант Низ
`,
    "польза.flang": `модуль «Польза»
  использует «Типы» из "типы.flang"

тотальная функция «Знак словом»
  принимает значение: число
  возвращает строка
  разбор «Положительный» от значение
    случай Верх
      то "плюс"
    случай Низ
      то "минус"
`,
  })
  const { stdout } = await run("node", [
    cli,
    "run",
    join(dir, "польза.flang"),
    "--function",
    "Знак словом",
    "--args",
    JSON.stringify({ значение: 7 }),
  ])
  assert.equal(JSON.parse(stdout).result, "плюс")
})

/* ─────────────────────────── импорт отказывает громко ───────────────────── */

test("пропавший файл — FLANG_IMPORT_NOT_FOUND, а не несвязанное имя", async () => {
  const dir = await sandbox({
    "главный.flang": `модуль «Главный»
  использует «Нет такого» из "нет-такого.flang"

тотальная функция «Ноль»
  возвращает число
  0
`,
  })
  const result = await link(join(dir, "главный.flang"), await readEntry(dir, "главный.flang"))
  assert.equal(result.diagnostics.length, 1)
  assert.equal(result.diagnostics[0].code, "FLANG_IMPORT_NOT_FOUND")
  assert.match(result.diagnostics[0].message, /Нет такого/)
})

test("циклический импорт — диагностика, а не бесконечная загрузка", async () => {
  const dir = await sandbox({
    "а.flang": `модуль «А»
  использует «Б» из "б.flang"

тотальная функция «ИзА»
  возвращает число
  1
`,
    "б.flang": `модуль «Б»
  использует «А» из "а.flang"

тотальная функция «ИзБ»
  возвращает число
  2
`,
  })
  const result = await link(join(dir, "а.flang"), await readEntry(dir, "а.flang"))
  const cycle = result.diagnostics.find((item) => item.code === "FLANG_IMPORT_CYCLE")
  assert.notEqual(cycle, undefined, `ожидался FLANG_IMPORT_CYCLE, получено ${JSON.stringify(result.diagnostics)}`)
})

test("одно имя в двух модулях — FLANG_DUPLICATE_NAME с обоими файлами", async () => {
  const dir = await sandbox({
    "первый.flang": `модуль «Первый»

тотальная функция «Общая»
  возвращает число
  1
`,
    "второй.flang": `модуль «Второй»

тотальная функция «Общая»
  возвращает число
  2
`,
    "главный.flang": `модуль «Главный»
  использует «Первый» из "первый.flang"
  использует «Второй» из "второй.flang"

тотальная функция «Позвать»
  возвращает число
  «Общая»
`,
  })
  const result = await link(join(dir, "главный.flang"), await readEntry(dir, "главный.flang"))
  const clash = result.diagnostics.find((item) => item.code === "FLANG_DUPLICATE_NAME")
  assert.notEqual(clash, undefined, `ожидался FLANG_DUPLICATE_NAME, получено ${JSON.stringify(result.diagnostics)}`)
  assert.match(clash.message, /первый\.flang/)
  assert.match(clash.message, /второй\.flang/)
})

test("имя модуля в «использует» обязано совпадать с заголовком файла", async () => {
  const dir = await sandbox({
    "числа.flang": `модуль «Числа»

тотальная функция «Один»
  возвращает число
  1
`,
    "главный.flang": `модуль «Главный»
  использует «Цифры» из "числа.flang"

тотальная функция «Позвать»
  возвращает число
  «Один»
`,
  })
  const result = await link(join(dir, "главный.flang"), await readEntry(dir, "главный.flang"))
  const mismatch = result.diagnostics.find((item) => item.code === "FLANG_IMPORT_NAME")
  assert.notEqual(mismatch, undefined, `ожидался FLANG_IMPORT_NAME, получено ${JSON.stringify(result.diagnostics)}`)
})

/* ───────────────────────────── границы видимости ────────────────────────── */

test("«экспортирует» ограничивает видимое, остальное остаётся внутренним", async () => {
  const dir = await sandbox({
    "модуль.flang": `модуль «Модуль»
  экспортирует «Наружу»

тотальная функция «Наружу»
  возвращает число
  1

тотальная функция «Внутри»
  возвращает число
  2
`,
    "главный.flang": `модуль «Главный»
  использует «Модуль» из "модуль.flang"

тотальная функция «Позвать»
  возвращает число
  «Наружу»
`,
  })
  const result = await link(join(dir, "главный.flang"), await readEntry(dir, "главный.flang"))
  const names = result.functions.map((fn) => fn.name)
  assert.ok(names.includes("Наружу"), "экспортированное имя обязано быть видно")
  assert.ok(!names.includes("Внутри"), "неэкспортированное имя не должно утекать наружу")
})

test("у входного файла видно всё, даже если он сам что-то экспортирует", async () => {
  const dir = await sandbox({
    "главный.flang": `модуль «Главный»
  экспортирует «Наружу»

тотальная функция «Наружу»
  возвращает число
  1

тотальная функция «Внутри»
  возвращает число
  2
`,
  })
  const result = await link(join(dir, "главный.flang"), await readEntry(dir, "главный.flang"))
  const names = result.functions.map((fn) => fn.name)
  assert.deepEqual(names.sort(), ["Внутри", "Наружу"])
})

/* ─────────────────────────── выборочный импорт ──────────────────────────── */

test("«только» берёт названные имена и не тащит остальные", async () => {
  const dir = await sandbox({
    "решение.flang": `модуль «Решение»
  использует «Списки» из ${JSON.stringify(join(stdlib, "lists.flang"))} только «Сумма», «Длина»

тотальная функция «Среднее»
  принимает элементы: список числа
  возвращает число
  «Сумма» от элементы делить на «Длина» от элементы
`,
  })
  const result = await link(join(dir, "решение.flang"), await readEntry(dir, "решение.flang"))
  assert.deepEqual(result.functions.map((fn) => fn.name).sort(), ["Длина", "Среднее", "Сумма"])

  const { stdout } = await run("node", [
    cli,
    "run",
    join(dir, "решение.flang"),
    "--function",
    "Среднее",
    "--args",
    JSON.stringify({ элементы: [2, 4, 6] }),
  ])
  assert.equal(JSON.parse(stdout).result, 4)
})

test("«только» снимает конфликт: одноимённую функцию можно не брать", async () => {
  const dir = await sandbox({
    "чужой.flang": `модуль «Чужой»

тотальная функция «Нужная»
  возвращает число
  1

тотальная функция «Общая»
  возвращает число
  2
`,
    "главный.flang": `модуль «Главный»
  использует «Чужой» из "чужой.flang" только «Нужная»

тотальная функция «Общая»
  возвращает число
  3

тотальная функция «Позвать»
  возвращает число
  «Нужная» плюс «Общая»
`,
  })
  const result = await link(join(dir, "главный.flang"), await readEntry(dir, "главный.flang"))
  assert.deepEqual(
    result.diagnostics,
    [],
    `конфликта быть не должно: одноимённая функция не импортировалась, получено ${JSON.stringify(result.diagnostics)}`,
  )
  const { stdout } = await run("node", [cli, "run", join(dir, "главный.flang"), "--function", "Позвать", "--args", "{}"])
  assert.equal(JSON.parse(stdout).result, 4)
})

test("«только» не расширяет видимое сверх «экспортирует»", async () => {
  const dir = await sandbox({
    "модуль.flang": `модуль «Модуль»
  экспортирует «Наружу»

тотальная функция «Наружу»
  возвращает число
  1

тотальная функция «Внутри»
  возвращает число
  2
`,
    "главный.flang": `модуль «Главный»
  использует «Модуль» из "модуль.flang" только «Внутри»

тотальная функция «Ноль»
  возвращает число
  0
`,
  })
  const result = await link(join(dir, "главный.flang"), await readEntry(dir, "главный.flang"))
  assert.ok(
    !result.functions.some((fn) => fn.name === "Внутри"),
    "неэкспортированное имя не должно приходить по просьбе",
  )
})

/* ──────────────────── файл без импортов не меняется вовсе ───────────────── */

test("без «использует» разбор остаётся прежним: связывание ничего не подменяет", async () => {
  const source = `модуль «Одинокий»

тотальная функция «Ответ»
  возвращает число
  42
`
  const dir = await sandbox({ "одинокий.flang": source })
  const direct = parse(source, join(dir, "одинокий.flang"))
  assert.equal(importsOf(direct).length, 0)

  const { stdout } = await run("node", [cli, "ast", join(dir, "одинокий.flang")])
  assert.deepEqual(JSON.parse(stdout), JSON.parse(JSON.stringify(direct)))
})

/* ────────────────────── теоркат переезжает через границу ────────────────── */

/**
 * Композиция морфизмов — одно из немногих мест, где компилятор ДОКАЗЫВАЕТ, а не
 * проверяет на сетке входов. Терять такое доказательство на границе файлов
 * особенно дорого: `flang check` на самом модуле отказывал, а на том, кто этот
 * модуль использует, молчал с кодом 0 (DGT-FLANG-17).
 *
 * Причина была в одной строке: связывание переносило `processes`, `supervisors`,
 * `runs` и `plans` — и ни одного объявления теорката. `checkMorphisms` получал
 * пустой список, и проверять ему было нечего. Стрелка, изоморфизм, бифунктор и
 * моноид принадлежат модулю, а не программе целиком, поэтому они сливаются, как
 * типы и функции, а не берутся у входного файла, как процессы.
 *
 * Тесты ниже держат обе стороны сразу: несостыковка обязана всплывать через
 * границу, а законная композиция — собираться. Одного «стало падать» мало:
 * проверка, которая ругается всегда, не лучше проверки, которая молчит всегда.
 */

const СТРЕЛКИ = `модуль «Стрелки»

объект «А»
  «х»: число
объект «Б»
  «у»: число
объект «В»
  «z»: число

морфизм «эф» из «А» в «Б»
морфизм «же» из «Б» в «В»
`

/** Проверка типов поверх связанной программы: связывание отдаёт лишний ключ. */
function проверитьСвязанное(связано) {
  const { diagnostics: _беды, ...программа } = связано
  return checkTypes(программа)
}

test("морфизмы импортированного модуля попадают в связанную программу", async () => {
  const dir = await sandbox({
    "стрелки.flang": СТРЕЛКИ,
    "главный.flang": `модуль «Главный»
  использует «Стрелки» из "стрелки.flang"

тотальная функция «Ноль»
  возвращает число
  0
`,
  })
  const result = await link(join(dir, "главный.flang"), await readEntry(dir, "главный.flang"))
  assert.deepEqual(
    (result.morphisms ?? []).map((м) => м.name),
    ["эф", "же"],
    "стрелки обязаны переехать через границу вместе с объектами",
  )
})

test("несостыкованная композиция из импортированного модуля не теряется", async () => {
  const dir = await sandbox({
    "стрелки.flang": `${СТРЕЛКИ}морфизм «плохая» это «эф» после «же»\n`,
    "главный.flang": `модуль «Главный»
  использует «Стрелки» из "стрелки.flang"

тотальная функция «Ноль»
  возвращает число
  0
`,
  })
  const result = await link(join(dir, "главный.flang"), await readEntry(dir, "главный.flang"))
  const итог = проверитьСвязанное(result)
  const беда = итог.diagnostics.find((item) => item.code === "FLANG_COMPOSE_MISMATCH")
  assert.notEqual(беда, undefined, `ожидался FLANG_COMPOSE_MISMATCH, получено ${JSON.stringify(итог.diagnostics)}`)
})

test("композиция вправе собрать стрелки, объявленные в другом модуле", async () => {
  const dir = await sandbox({
    "стрелки.flang": СТРЕЛКИ,
    "главный.flang": `модуль «Главный»
  использует «Стрелки» из "стрелки.flang"

морфизм «хорошая» это «же» после «эф»
`,
  })
  const result = await link(join(dir, "главный.flang"), await readEntry(dir, "главный.flang"))
  const итог = проверитьСвязанное(result)
  assert.deepEqual(итог.diagnostics, [], "законная композиция через границу обязана собираться молча")
})

test("теоркат входного файла не пропадает из-за постороннего импорта", async () => {
  /* Самая злая форма беды: морфизмы написаны ровно в том файле, который
     проверяют, а исчезают они потому, что рядом стоит `использует` о другом. */
  const dir = await sandbox({
    "числа.flang": `модуль «Числа»

тотальная функция «Один»
  возвращает число
  1
`,
    "главный.flang": `модуль «Главный»
  использует «Числа» из "числа.flang"

объект «А»
  «х»: число
объект «Б»
  «у»: число
объект «В»
  «z»: число

морфизм «эф» из «А» в «Б»
морфизм «же» из «В» в «А»
морфизм «плохая» это «же» после «эф»
`,
  })
  const result = await link(join(dir, "главный.flang"), await readEntry(dir, "главный.flang"))
  const итог = проверитьСвязанное(result)
  const беда = итог.diagnostics.find((item) => item.code === "FLANG_COMPOSE_MISMATCH")
  assert.notEqual(беда, undefined, `ожидался FLANG_COMPOSE_MISMATCH, получено ${JSON.stringify(итог.diagnostics)}`)
})

test("изоморфизм собирается из стрелок чужого модуля и ловит перепутанные концы", async () => {
  const формы = `модуль «Формы»

запись «Заказ»
  номер: строка

запись «Накладная»
  номер: строка

морфизм «выписать» из «Заказ» в «Накладная»
морфизм «по накладной» из «Накладная» в «Заказ»
единица «Заказ»
единица «Накладная»
`
  const законный = `модуль «Сборка»
  использует «Формы» из "формы.flang"

изоморфизм «Заказ и накладная» из «Заказ» в «Накладная»
  прямой морфизм «выписать»
  обратный морфизм «по накладной»
`
  const dir = await sandbox({ "формы.flang": формы, "сборка.flang": законный })
  const связано = await link(join(dir, "сборка.flang"), await readEntry(dir, "сборка.flang"))
  assert.deepEqual(
    (связано.isomorphisms ?? []).map((и) => и.name),
    ["Заказ и накладная"],
    "изоморфизм входного файла обязан пережить связывание",
  )
  assert.deepEqual(проверитьСвязанное(связано).diagnostics, [], "законный изоморфизм обязан проходить молча")

  const кривой = await sandbox({
    "формы.flang": формы,
    "сборка.flang": законный.replace(
      "  прямой морфизм «выписать»\n  обратный морфизм «по накладной»",
      "  прямой морфизм «по накладной»\n  обратный морфизм «выписать»",
    ),
  })
  const второе = await link(join(кривой, "сборка.flang"), await readEntry(кривой, "сборка.flang"))
  const коды = проверитьСвязанное(второе).diagnostics.map((item) => item.code)
  assert.ok(коды.includes("FLANG_ISO_MISMATCH"), `ожидался FLANG_ISO_MISMATCH, получено ${коды.join(", ")}`)
})

test("«экспортирует» ограничивает морфизмы так же, как типы и функции", async () => {
  /* Одно правило видимости на все объявления: у стрелки тоже есть имя, и
     `экспортирует` обязано значить для неё ровно то же, что для типа. */
  const dir = await sandbox({
    "стрелки.flang": `модуль «Стрелки»
  экспортирует «А», «Б», «эф»

объект «А»
  «х»: число
объект «Б»
  «у»: число
объект «В»
  «z»: число

морфизм «эф» из «А» в «Б»
морфизм «же» из «Б» в «В»
`,
    "главный.flang": `модуль «Главный»
  использует «Стрелки» из "стрелки.flang"

тотальная функция «Ноль»
  возвращает число
  0
`,
  })
  const result = await link(join(dir, "главный.flang"), await readEntry(dir, "главный.flang"))
  assert.deepEqual(
    (result.morphisms ?? []).map((м) => м.name),
    ["эф"],
    "неэкспортированная стрелка не должна просачиваться наружу",
  )
})

test("flang check отказывает кодом 1, когда композиция через границу не стыкуется", async () => {
  /* Сквозная сторона беды: молчание с кодом 0 и было тем, что делало её
     незаметной — в сборке никто не читает JSON, читают код возврата. */
  const dir = await sandbox({
    "стрелки.flang": `${СТРЕЛКИ}морфизм «плохая» это «эф» после «же»\n`,
    "главный.flang": `модуль «Главный»
  использует «Стрелки» из "стрелки.flang"

тотальная функция «Ноль»
  возвращает число
  0
`,
  })
  const итог = await проверитьЧерезCLI(join(dir, "главный.flang"))
  assert.equal(итог.code, 1, `ожидался код 1, получен ${итог.code}: ${итог.stdout}${итог.stderr}`)
  assert.match(`${итог.stdout}${итог.stderr}`, /FLANG_COMPOSE_MISMATCH/u)
})

test("программа без теорката не получает от связывания новых ключей", async () => {
  /* Ключ появляется только вместе с объявлениями: пять слоёв самоприменения
     сверяются побайтово, и лишнее поле увело бы неподвижную точку к другому
     AST. */
  const dir = await sandbox({
    "числа.flang": `модуль «Числа»

тотальная функция «Один»
  возвращает число
  1
`,
    "главный.flang": `модуль «Главный»
  использует «Числа» из "числа.flang"

тотальная функция «Два»
  возвращает число
  2
`,
  })
  const result = await link(join(dir, "главный.flang"), await readEntry(dir, "главный.flang"))
  for (const поле of ["morphisms", "isomorphisms", "bifunctors", "monoids"]) {
    assert.ok(!(поле in result), `ключа «${поле}» быть не должно: объявлений нет`)
  }
})

/** CLI, которому позволено отказать: execFile отклоняется на ненулевом коде. */
async function проверитьЧерезCLI(file) {
  try {
    const { stdout, stderr } = await run("node", [cli, "check", file])
    return { code: 0, stdout, stderr }
  } catch (error) {
    return { code: error.code ?? 1, stdout: error.stdout ?? "", stderr: error.stderr ?? "" }
  }
}

async function readEntry(dir, name) {
  const { readFile } = await import("node:fs/promises")
  return readFile(join(dir, name), "utf8")
}
