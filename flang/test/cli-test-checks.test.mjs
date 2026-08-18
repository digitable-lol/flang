/**
 * `flang test` проверяет программу перед тем, как прогонять её примеры.
 *
 * ── Что здесь ловится ───────────────────────────────────────────────────────
 *
 * До этой правки две команды на одной и той же программе давали разный ответ, и
 * тот из них, который читается легче, был неверным:
 *
 *   $ flang check дырка.flang
 *   {"valid":false, … "code":"FLANG_TYPE","message":"правый операнд «add»: …"}
 *   $ flang test дырка.flang
 *   {"valid":true,"total":1,"passed":1,"failed":0, …}
 *
 * Причина простая и вся в устройстве: примеры вычисляются напрямую, мимо
 * `checkTypes`. Ошибка типов в функции БЕЗ примеров прогону примеров ОСТАЛЬНЫХ
 * функций не мешает — они досчитываются и сходятся, и команда честно про них
 * сообщает. Беда в слове: `valid` читается как приговор ВСЕЙ программе, а не как
 * «примеры досчитались». Зелёный `test` давал ложный покой ровно там, где язык
 * обещает обратное, и обещание про «компилятор не соберёт негодную программу»
 * упиралось в то, что до компилятора автор доходил не всегда.
 *
 * ── Почему изъятием, а не выдумкой ──────────────────────────────────────────
 *
 * Улика ниже строится ИЗЪЯТИЕМ из живого файла репозитория: у `stdlib/lists.flang`
 * подменяется один операнд. Выдуманная программа доказывала бы, что дыра бывает;
 * изъятие доказывает, что она есть на том коде, который лежит в дереве. И обе
 * половины изъятия проверяются: целый файл обязан проходить `test` — иначе тест
 * зеленел бы от того, что не проходит ничего.
 *
 * ── Чего этот тест НЕ утверждает ────────────────────────────────────────────
 *
 * Он не утверждает, что примеры перестали быть нужны. Проверка типов говорит,
 * что функция не сложит число со строкой; что она складывает ТО, ЧТО НАДО, не
 * говорит ни она, ни доказательство тотальности. Это и остаётся работой
 * примеров — здесь лишь закрыт зазор, в котором их зелень значила больше, чем
 * стоила.
 */

import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import { рабочийКаталог, средаСборки } from "./tempdir.mjs"

const run = promisify(execFile)
const cli = fileURLToPath(new URL("../bin/flang.mjs", import.meta.url))
const lists = fileURLToPath(new URL("../stdlib/lists.flang", import.meta.url))

const workdir = рабочийКаталог("cli-test")

let counter = 0
async function песочница(имя, текст) {
  const каталог = join(workdir, `s${(counter += 1)}`)
  await mkdir(каталог, { recursive: true })
  const путь = join(каталог, имя)
  await writeFile(путь, текст, "utf8")
  return путь
}

/** Успешный прогон: JSON из stdout, ничего в stderr. */
async function тест(аргументы) {
  const { stdout, stderr } = await run("node", [cli, "test", ...аргументы], { maxBuffer: 64 * 1024 * 1024 })
  assert.equal(stderr, "", "успешный прогон не пишет в stderr")
  return JSON.parse(stdout)
}

/** Отказ: код возврата и разобранный отчёт из stderr. */
async function отказ(аргументы) {
  try {
    await run("node", [cli, ...аргументы], { maxBuffer: 64 * 1024 * 1024 })
  } catch (error) {
    return { code: error.code, stdout: error.stdout, report: JSON.parse(error.stderr) }
  }
  assert.fail(`вызов ${аргументы.join(" ")} обязан был отказать`)
}

/**
 * Изъятие: у первой функции с телом-сложением правый операнд подменяется на
 * строку. Меняется ОДИН операнд, всё остальное остаётся тем же файлом.
 */
const СО_СТРОКОЙ = (исходник) => {
  const строки = исходник.split("\n")
  const место = строки.findIndex((строка) => /^\s+пусть .+ плюс \S+$/u.test(строка) && !строка.trimStart().startsWith("//"))
  assert.notEqual(место, -1, "в lists.flang не стало связывания со сложением — изъятию нечего портить")
  строки[место] = строки[место].replace(/плюс \S+$/u, 'плюс "строка"')
  return строки.join("\n")
}

test("программу, которую check отвергает, test не прогоняет вовсе", async () => {
  /* Половина изъятия, без которой вторая ничего не значит: ЦЕЛЫЙ файл проходит
     и примеры у него есть. Иначе отказ ниже мог бы случиться по любой причине. */
  const исходник = await readFile(lists, "utf8")
  const целое = await тест([lists])
  assert.equal(целое.valid, true, "stdlib/lists.flang обязан проходить свои примеры")
  assert.ok(целое.total > 0, "в lists.flang не стало примеров — мерить нечего")

  const порченый = await песочница("списки.flang", СО_СТРОКОЙ(исходник))
  const { code, stdout, report } = await отказ(["test", порченый])
  assert.equal(code, 1, "ошибка модели, а не вызова — код 1")
  assert.equal(stdout, "", "отказ не имеет права оставить в stdout зелёный отчёт")
  assert.equal(report.valid, false)
  assert.ok(
    report.diagnostics.some((беда) => беда.code === "FLANG_TYPE"),
    `в диагностике нет ошибки типа: ${report.diagnostics.map((б) => б.code).join(", ")}`,
  )
  /* Счётчики обязаны быть нулевыми и отличимыми от «смотрели, все прошли»:
     примеров не запускали ни одного, и отчёт не имеет права это скрыть. */
  assert.equal(report.total, 0)
  assert.equal(report.passed, 0)
  assert.deepEqual(report.results, [])
})

test("отказ test называет ТЕ ЖЕ диагностики, что и check, — а не свои", async () => {
  /* Второе место, где решают, годна ли программа, разошлось бы с первым молча. */
  const порченый = await песочница("списки.flang", СО_СТРОКОЙ(await readFile(lists, "utf8")))
  const { report } = await отказ(["test", порченый])
  const проверка = (await отказ(["check", порченый])).report
  assert.deepEqual(
    report.diagnostics.map((беда) => [беда.code, беда.message]),
    проверка.diagnostics.map((беда) => [беда.code, беда.message]),
  )
})

test("--no-check прогоняет примеры непроверенного — и прогоняет ТЕ ЖЕ, что прогонял до правки", async () => {
  /* Ключ существует, чтобы смотреть на поведение примеров, пока программа ещё в
     правке. Проверяется не «команда не упала», а то, что снята РОВНО проверка:
     отчёт совпадает с тем, что команда давала на этой программе прежде, когда
     проверок не звала вовсе. Разойдись они — ключ был бы не отладочным
     режимом, а вторым способом прогонять примеры. */
  const порченый = await песочница("списки.flang", СО_СТРОКОЙ(await readFile(lists, "utf8")))
  const { runExamples } = await import(new URL("../src/compat.mjs", import.meta.url).href)
  const { loadProgram } = await import(new URL("../bin/flang.mjs", import.meta.url).href)
  const свой = runExamples(await loadProgram(порченый))

  if (свой.valid) {
    const через_cli = await тест([порченый, "--no-check"])
    assert.deepEqual(через_cli, свой)
  } else {
    const { report } = await отказ(["test", порченый, "--no-check"])
    assert.deepEqual(report, свой)
  }
  /* И главное про этот ключ: он снимает проверку, а не подменяет её выводом.
     Без ключа та же программа отказывает — значит зелень выше куплена явно. */
  assert.equal((await отказ(["test", порченый])).report.valid, false)
})

test("на целой программе проверка ничего не меняет: отчёт тот же, что и без неё", async () => {
  /* Цена правки: ни один сегодня зелёный прогон не имеет права покраснеть или
     изменить свой ответ. Сверяется весь отчёт целиком, а не только `valid`. */
  const с_проверкой = await тест([lists])
  const без_проверки = await тест([lists, "--no-check"])
  assert.deepEqual(с_проверкой, без_проверки)
})
