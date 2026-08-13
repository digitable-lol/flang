/**
 * Тесты интерактивной оболочки flang (`flang repl`).
 *
 * Оболочка разложена на две части, и проверяется здесь та, в которой есть что
 * ломать: ядро сессии из `src/repl.mjs` — «строка на входе, результат на
 * выходе». Терминал (readline, приглашения, история) остаётся в
 * `bin/flang.mjs` и проверяется одним сквозным прогоном под конвейером: если бы
 * ядро требовало терминала, эти тесты нельзя было бы написать вовсе.
 *
 * Проверяется не «оболочка что-то напечатала», а четыре обещания, каждое из
 * которых способно тихо сломаться:
 *
 *   1. СЕССИЯ НАКАПЛИВАЕТСЯ. Объявленная функция видна следующему выражению,
 *      переобъявление заменяет прежнюю, а отвергнутое объявление не оставляет
 *      следов: сессия после отказа обязана быть точно такой, какой была.
 *
 *   2. ПРОВЕРКИ ТЕ ЖЕ, ЧТО У `flang check`. Тип, завершаемость, разбор — с тем
 *      же кодом. Оболочка, принимающая программу, которую компилятор
 *      отвергает, — это не удобство, а ложь.
 *
 *   3. МЕСТО ОШИБКИ — СТРОКА ВВОДА. Пользователь набрал четыре строки; «ошибка
 *      в строке 47» собранного исходника ему бесполезна. Поэтому строка и
 *      столбец сверяются точно, а не «где-то там».
 *
 *   4. ЧЕСТНОСТЬ ПРО ЗАВЕРШЕНИЕ. Обычная функция может не завершиться, и
 *      оболочка обязана сказать это ровно тем же FLANG_RECURSION_LIMIT, что и
 *      обычный запуск, — текст сообщения сверяется с текстом интерпретатора.
 *
 * Запуск: node --test flang/test/repl.test.mjs
 */
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { evaluate } from "../src/interpret.mjs"
import { parse } from "../src/parser.mjs"
import { createSession, formatDiagnostic, formatResult, formatValue, needsMoreInput } from "../src/repl.mjs"

const каталог = fileURLToPath(new URL("../", import.meta.url))
const cli = fileURLToPath(new URL("../bin/flang.mjs", import.meta.url))

/** Сессия с файловой системой в памяти: тест не трогает диск и не зависит от него. */
function сессия(файлы = {}, настройки = {}) {
  const диск = new Map(Object.entries(файлы).map(([имя, текст]) => [join(каталог, имя), текст]))
  const оболочка = createSession({
    base: каталог,
    readFile: async (путь) => {
      if (!диск.has(путь)) throw new Error(`ENOENT: no such file or directory, open '${путь}'`)
      return диск.get(путь)
    },
    writeFile: async (путь, текст) => {
      диск.set(путь, текст)
    },
    ...настройки,
  })
  return { оболочка, диск }
}

const УДВОИТЬ = `тотальная функция «Удвоить»
  принимает х: число
  возвращает число
  х умножить на 2`

const ДЛИНА = `тотальная функция «Длина»
  принимает элементы: список числа
  возвращает число
  разбор элементов
    случай пусто
      то 0
    случай голова и хвост
      то 1 плюс «Длина» от хвоста`

const ВЕЧНОСТЬ = `функция «Вечность»
  принимает н: число
  возвращает число
  «Вечность» от (н плюс 1)`

const коды = (результат) => результат.diagnostics.map((диагностика) => диагностика.code)

/* ================================================================== */
/* Выражения                                                           */
/* ================================================================== */

test("выражение вычисляется сразу", async () => {
  const { оболочка } = сессия()
  const результат = await оболочка.submit("2 плюс 3")
  assert.equal(результат.kind, "value")
  assert.equal(результат.value, 5)
  assert.equal(результат.text, "5")
})

test("многострочное выражение вычисляется целиком", async () => {
  const { оболочка } = сессия()
  const результат = await оболочка.submit('если 1 больше 2\n  то "да"\n  иначе "нет"')
  assert.equal(результат.value, "нет")
})

test("пустой ввод ничего не делает", async () => {
  const { оболочка } = сессия()
  assert.equal((await оболочка.submit("   \n  ")).kind, "empty")
})

test("значения печатаются поверхностью языка", () => {
  assert.equal(formatValue(3), "3")
  assert.equal(formatValue(-0), "-0")
  assert.equal(formatValue("текст"), '"текст"')
  assert.equal(formatValue(true), "да")
  assert.equal(formatValue(false), "нет")
  assert.equal(formatValue(null), "ничто")
  assert.equal(formatValue([]), "пустой список")
  assert.equal(formatValue([1, [2], "а"]), '[1, [2], "а"]')
  assert.equal(formatValue({ х: 1, у: 2 }), "{х: 1, у: 2}")
})

test("вариант печатается именем и полями, запись — полями", async () => {
  const { оболочка } = сессия()
  await оболочка.submit("тип «Дерево»\n  вариант Лист\n  вариант Узел содержит значение: число")
  assert.equal((await оболочка.submit("вариант Лист")).text, "Лист")
  assert.equal((await оболочка.submit("вариант Узел с значение равно 5")).text, "Узел(значение: 5)")
  assert.equal((await оболочка.submit("запись «Пара» с «а» равно 1")).kind, "diagnostics")
})

/* ================================================================== */
/* Накопление сессии                                                   */
/* ================================================================== */

test("объявленная функция доступна следующему выражению", async () => {
  const { оболочка } = сессия()
  const объявление = await оболочка.submit(ДЛИНА)
  assert.equal(объявление.kind, "declared")
  assert.deepEqual(объявление.declared.map((о) => о.name), ["Длина"])
  assert.equal(объявление.declared[0].total, true, "завершение «Длины» доказано, а не объявлено")

  const результат = await оболочка.submit("«Длина» от [1, 2, 3]")
  assert.equal(результат.value, 3)
})

test("объявления накапливаются и видят друг друга", async () => {
  const { оболочка } = сессия()
  await оболочка.submit(ДЛИНА)
  await оболочка.submit(`тотальная функция «Вдвое длиннее»
  принимает элементы: список числа
  возвращает число
  «Длина» от элементов умножить на 2`)
  assert.equal((await оболочка.submit("«Вдвое длиннее» от [1, 2]")).value, 4)
})

test("переобъявление заменяет прежнее, а не спорит с ним", async () => {
  const { оболочка } = сессия()
  await оболочка.submit(УДВОИТЬ)
  const второе = await оболочка.submit(`тотальная функция «Удвоить»
  принимает х: число
  возвращает число
  х плюс х плюс 1`)
  assert.equal(второе.kind, "declared")
  assert.deepEqual(второе.replaced, ["тотальная функция «Удвоить»"])
  assert.equal((await оболочка.submit("«Удвоить» от 10")).value, 21)
  assert.equal(оболочка.declarations().length, 1, "заменённое объявление не осталось вторым экземпляром")
})

test("объявление, не прошедшее проверку, не меняет сессию", async () => {
  const { оболочка } = сессия()
  await оболочка.submit(УДВОИТЬ)
  const было = оболочка.source()

  const отказ = await оболочка.submit(`тотальная функция «Удвоить»
  принимает х: число
  возвращает число
  х умножить на "два"`)
  assert.equal(отказ.kind, "diagnostics")
  assert.deepEqual(коды(отказ), ["FLANG_TYPE"])
  assert.equal(оболочка.source(), было, "сессия обязана остаться прежней")
  assert.equal((await оболочка.submit("«Удвоить» от 10")).value, 20, "прежнее объявление продолжает работать")
})

test("исходник сессии — это программа, которую примет разбор", async () => {
  const { оболочка } = сессия()
  await оболочка.submit(ДЛИНА)
  await оболочка.submit(УДВОИТЬ)
  const программа = parse(оболочка.source(), "-")
  assert.deepEqual(программа.functions.map((fn) => fn.name), ["Длина", "Удвоить"])
})

/* ================================================================== */
/* Проверки те же, что у `flang check`                                 */
/* ================================================================== */

test("ошибка типа называет код и точное место во вводе", async () => {
  const { оболочка } = сессия()
  const результат = await оболочка.submit('1 плюс "а"')
  assert.equal(результат.kind, "diagnostics")
  assert.deepEqual(коды(результат), ["FLANG_TYPE"])
  /* Столбец 8 — сама строка «а»: обёртка выражения в функцию сдвигает исходник
     на строку и два пробела, и этот сдвиг обязан быть снят. */
  assert.deepEqual(результат.diagnostics[0].at, { where: "ввод", name: null, line: 1, column: 8 })
})

test("ошибка внутри объявления указывает на строку ввода, а не сессии", async () => {
  const { оболочка } = сессия()
  await оболочка.submit(ДЛИНА)
  await оболочка.submit(УДВОИТЬ)
  const результат = await оболочка.submit(`тотальная функция «Третья»
  принимает х: число
  возвращает число
  х плюс "а"`)
  assert.deepEqual(коды(результат), ["FLANG_TYPE"])
  assert.equal(результат.diagnostics[0].at.where, "ввод")
  assert.equal(результат.diagnostics[0].at.line, 4)
  assert.equal(результат.diagnostics[0].at.column, 10)
})

test("недоказанная тотальность отвергается тем же кодом, что и в check", async () => {
  const { оболочка } = сессия()
  const результат = await оболочка.submit(`тотальная функция «Зацикленная»
  принимает н: число
  возвращает число
  «Зацикленная» от н`)
  assert.deepEqual(коды(результат), ["FLANG_NOT_TOTAL"])
  assert.equal(оболочка.declarations().length, 0, "непроверенная функция в сессию не попадает")
})

test("неизвестное имя — ошибка разбора, а не молчание", async () => {
  const { оболочка } = сессия()
  const результат = await оболочка.submit("«Нетакой» от 1")
  assert.deepEqual(коды(результат), ["FLANG_UNKNOWN_NAME"])
})

test("ошибка разбора не роняет оболочку и оставляет её пригодной", async () => {
  const { оболочка } = сессия()
  const результат = await оболочка.submit("2 плюс")
  assert.equal(результат.kind, "diagnostics")
  assert.deepEqual(коды(результат), ["FLANG_PARSE"])
  assert.equal((await оболочка.submit("2 плюс 2")).value, 4)
})

/* ================================================================== */
/* Честность про завершение                                            */
/* ================================================================== */

test("обычная функция объявляется без обещания завершения", async () => {
  const { оболочка } = сессия()
  const результат = await оболочка.submit(ВЕЧНОСТЬ)
  assert.equal(результат.declared[0].total, false)
  assert.match(formatResult(результат), /завершение не доказано/u)
})

test("лимит шагов сообщается тем же FLANG_RECURSION_LIMIT, что и обычный запуск", async () => {
  const { оболочка } = сессия({}, { maxSteps: 500 })
  await оболочка.submit(ВЕЧНОСТЬ)
  const результат = await оболочка.submit("«Вечность» от 1")
  assert.equal(результат.kind, "diagnostics")
  assert.deepEqual(коды(результат), ["FLANG_RECURSION_LIMIT"])

  /* Сообщение сверяется с сообщением интерпретатора на той же программе: если
     оболочка начнёт пересказывать его своими словами, разойдутся диагностики
     двух путей запуска одной и той же функции. */
  const программа = parse(`${ВЕЧНОСТЬ}\n\nфункция «Проба»\n  «Вечность» от 1\n`, "-")
  let ожидаемое = null
  try {
    evaluate(программа, "Проба", {}, { maxSteps: 500 })
  } catch (ошибка) {
    ожидаемое = ошибка.diagnostics[0]
  }
  assert.notEqual(ожидаемое, null, "интерпретатор обязан упереться в лимит")
  assert.equal(результат.diagnostics[0].message, ожидаемое.message)
  assert.equal(результат.diagnostics[0].code, ожидаемое.code)
})

test("глубина вызовов ограничена так же, как в интерпретаторе", async () => {
  const { оболочка } = сессия({}, { maxDepth: 8 })
  await оболочка.submit(ДЛИНА)
  const результат = await оболочка.submit("«Длина» от [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]")
  assert.deepEqual(коды(результат), ["FLANG_RECURSION_LIMIT"])
  assert.match(результат.diagnostics[0].message, /предел глубины вызовов \(8\)/u)
})

/* ================================================================== */
/* Продолжение ввода                                                   */
/* ================================================================== */

test("заголовок объявления ждёт продолжения, пустая строка его заканчивает", () => {
  assert.equal(needsMoreInput("тотальная функция «Удвоить»"), true)
  assert.equal(needsMoreInput("тотальная функция «Удвоить»\n  принимает х: число"), true)
  assert.equal(needsMoreInput(`${УДВОИТЬ}\n`), false, "пустая строка заканчивает ввод всегда")
})

test("законченная строка отправляется сразу", () => {
  assert.equal(needsMoreInput("2 плюс 3"), false)
  assert.equal(needsMoreInput("«Удвоить» от 21"), false)
  assert.equal(needsMoreInput("тип «Метр» это число"), false, "у псевдонима блока не бывает")
  assert.equal(needsMoreInput("запись «Точка» с «х» равно 1"), false, "это литерал записи, а не объявление типа")
  assert.equal(needsMoreInput("запись «Точка»"), true, "а это объявление, у него будут поля")
})

test("недописанное выражение продолжается, команда — никогда", () => {
  assert.equal(needsMoreInput("2 плюс"), true)
  assert.equal(needsMoreInput("[1,"), true)
  assert.equal(needsMoreInput(".помощь"), false)
  assert.equal(needsMoreInput("   "), false)
})

test("общий отступ вставленного куска снимается", async () => {
  const { оболочка } = сессия()
  const результат = await оболочка.submit(`    тотальная функция «Втрое»
      принимает х: число
      возвращает число
      х умножить на 3`)
  assert.equal(результат.kind, "declared")
  assert.equal((await оболочка.submit("«Втрое» от 3")).value, 9)
})

/* ================================================================== */
/* Команды                                                             */
/* ================================================================== */

test("справка и выход отвечают, неизвестная команда — отказ", async () => {
  const { оболочка } = сессия()
  assert.match((await оболочка.submit(".помощь")).text, /Оболочка flang/u)
  assert.match((await оболочка.submit(".help")).text, /Оболочка flang/u)
  assert.equal((await оболочка.submit(".выход")).kind, "quit")
  assert.equal((await оболочка.submit(".quit")).kind, "quit")

  const отказ = await оболочка.submit(".чепуха")
  assert.deepEqual(коды(отказ), ["FLANG_CLI"])
  assert.match(отказ.diagnostics[0].message, /неизвестная команда/u)
})

test("«.объявления» перечисляет объявленное и говорит о завершении", async () => {
  const { оболочка } = сессия()
  assert.match((await оболочка.submit(".объявления")).text, /ничего не объявлено/u)
  await оболочка.submit(ДЛИНА)
  await оболочка.submit(ВЕЧНОСТЬ)
  const список = (await оболочка.submit(".объявления")).text
  assert.match(список, /тотальная функция «Длина» — завершение доказано/u)
  assert.match(список, /функция «Вечность» — обычная: завершение не доказано/u)
})

test("«.сбросить» забывает всё объявленное", async () => {
  const { оболочка } = сессия()
  await оболочка.submit(УДВОИТЬ)
  await оболочка.submit(".сбросить")
  assert.equal(оболочка.declarations().length, 0)
  assert.deepEqual(коды(await оболочка.submit("«Удвоить» от 1")), ["FLANG_UNKNOWN_NAME"])
})

test("сохранённая сессия загружается обратно и работает", async () => {
  const { оболочка, диск } = сессия()
  await оболочка.submit(ДЛИНА)
  await оболочка.submit(УДВОИТЬ)
  const записано = await оболочка.submit(".сохранить сессия.flang")
  assert.equal(записано.kind, "message")

  const текст = диск.get(join(каталог, "сессия.flang"))
  assert.notEqual(текст, undefined, "файл записан туда, куда просили")
  assert.deepEqual(parse(текст, "-").functions.map((fn) => fn.name), ["Длина", "Удвоить"])

  const вторая = сессия({ "сессия.flang": текст })
  const загружено = await вторая.оболочка.submit(".загрузить сессия.flang")
  assert.equal(загружено.kind, "declared")
  assert.deepEqual(загружено.declared.map((о) => о.name), ["Длина", "Удвоить"])
  assert.equal((await вторая.оболочка.submit("«Удвоить» от «Длина» от [1, 2, 3]")).value, 6)
})

test("загрузка режет файл на отдельные объявления — их можно переобъявить поодиночке", async () => {
  const { оболочка } = сессия({ "две.flang": `${ДЛИНА}\n\n${УДВОИТЬ}\n` })
  await оболочка.submit(".загрузить две.flang")
  assert.deepEqual(оболочка.declarations().map((о) => о.names[0]), ["Длина", "Удвоить"])

  const замена = await оболочка.submit(`тотальная функция «Удвоить»
  принимает х: число
  возвращает число
  х плюс х`)
  assert.deepEqual(замена.replaced, ["тотальная функция «Удвоить»"])
  assert.equal(оболочка.declarations().length, 2, "заменено одно объявление, а не оба")
})

test("загрузка несуществующего файла и не-исходника — понятный отказ", async () => {
  const { оболочка } = сессия()
  const нет = await оболочка.submit(".загрузить нету.flang")
  assert.deepEqual(коды(нет), ["FLANG_CLI"])
  assert.match(нет.diagnostics[0].message, /не удалось прочитать/u)

  const json = await оболочка.submit(".загрузить модель.json")
  assert.deepEqual(коды(json), ["FLANG_CLI"])
  assert.match(json.diagnostics[0].message, /flang check/u)

  assert.deepEqual(коды(await оболочка.submit(".сохранить")), ["FLANG_CLI"])
})

test("загруженный файл с ошибкой не попадает в сессию", async () => {
  const { оболочка } = сессия({ "битая.flang": "тотальная функция «Кривая»\n  принимает х: число\n  возвращает число\n  х плюс \"а\"\n" })
  await оболочка.submit(УДВОИТЬ)
  const результат = await оболочка.submit(".загрузить битая.flang")
  assert.deepEqual(коды(результат), ["FLANG_TYPE"])
  assert.deepEqual(оболочка.declarations().map((о) => о.names[0]), ["Удвоить"])
})

/* ================================================================== */
/* Модули                                                              */
/* ================================================================== */

test("«использует» подключает модуль строкой языка, а не командой", async () => {
  /* Файлы настоящие: смысл проверки в том, что относительный путь считается от
     каталога сессии, и связывание идёт тем же link.mjs, что у `flang check`. */
  const оболочка = createSession({ base: каталог })
  const подключено = await оболочка.submit('использует «Списки» из "stdlib/lists.flang"')
  assert.equal(подключено.kind, "message")
  assert.match(подключено.text, /стало видно функций: \d+/u)
  assert.equal((await оболочка.submit("«Сумма» от [1, 2, 3]")).value, 6)

  const своя = await оболочка.submit(`тотальная функция «Среднее»
  принимает элементы: список числа
  возвращает число
  «Сумма» от элементов делить на «Длина» от элементов`)
  assert.equal(своя.kind, "declared")
  assert.equal((await оболочка.submit("«Среднее» от [2, 4]")).value, 3)
})

test("конфликт имён с подключаемым модулем виден сразу и не ломает сессию", async () => {
  const оболочка = createSession({ base: каталог })
  await оболочка.submit(ДЛИНА)
  const результат = await оболочка.submit('использует «Списки» из "stdlib/lists.flang"')
  assert.deepEqual(коды(результат), ["FLANG_DUPLICATE_NAME"])
  assert.equal((await оболочка.submit("«Длина» от [1, 2]")).value, 2, "своя «Длина» на месте")
})

/* ================================================================== */
/* Печать ответа                                                       */
/* ================================================================== */

test("диагностика печатается кодом, местом и сообщением", () => {
  assert.equal(
    formatDiagnostic({ code: "FLANG_TYPE", message: "сообщение", at: { where: "ввод", name: null, line: 2, column: 5 } }),
    "FLANG_TYPE, строка 2, столбец 5: сообщение",
  )
  assert.equal(formatDiagnostic({ code: "FLANG_RECURSION_LIMIT", message: "лимит" }), "FLANG_RECURSION_LIMIT: лимит")
})

/* ================================================================== */
/* Терминал                                                            */
/* ================================================================== */

test("`flang repl` под конвейером считает, объявляет и разделяет потоки", () => {
  const ввод = [
    "2 плюс 3",
    ...УДВОИТЬ.split("\n"),
    "",
    "«Удвоить» от 21",
    '1 плюс "а"',
    ".выход",
    "",
  ].join("\n")
  let stdout = ""
  let stderr = ""
  let код = 0
  try {
    stdout = execFileSync("node", [cli, "repl"], { input: ввод, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })
  } catch (ошибка) {
    stdout = ошибка.stdout
    stderr = ошибка.stderr
    код = ошибка.status
  }
  assert.match(stdout, /^5$/mu)
  assert.match(stdout, /объявлено: тотальная функция «Удвоить» — завершение доказано/u)
  assert.match(stdout, /^42$/mu)
  assert.doesNotMatch(stdout, /^» /mu, "приглашения печатаются только человеку")
  assert.doesNotMatch(stdout, /Оболочка flang/u, "и приветствие тоже")
  assert.match(stderr, /FLANG_TYPE, строка 1, столбец 8/u)
  assert.equal(код, 1, "прогон сценария с диагностикой не имеет права вернуть 0")
})

test("`flang repl <файл>` загружает файл в сессию при запуске", () => {
  const stdout = execFileSync("node", [cli, "repl", "flang/stdlib/lists.flang"], {
    input: "«Сумма» от [1, 2, 3]\n.выход\n",
    encoding: "utf8",
    cwd: fileURLToPath(new URL("../../", import.meta.url)),
  })
  assert.match(stdout, /загружено из flang\/stdlib\/lists.flang/u)
  assert.match(stdout, /^6$/mu)
})
