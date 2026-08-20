/**
 * Драйвер PostgreSQL на flang — прогон по НАСТОЯЩЕЙ базе.
 *
 * Разбор протокола, проверенный только на выдуманных байтах, ничего не значит:
 * половина беды этого драйвера — в том, что делает с байтами ХОЗЯИН, и увидеть
 * это можно лишь на живом сервере. Поэтому здесь поднимается настоящий кластер
 * PostgreSQL (`initdb` с входом по доверию), план `flang/examples/db/postgres-plan.flang`
 * гоняется тем же `runPlan`, каким гоняется служба сокращателя, и ответы
 * сверяются с ожидаемыми.
 *
 * Кластер поднимается на порту 55432 — том самом, который назван в плане
 * (`«Порт базы»`). У плана нет аргументов: `начинает с` — функция без
 * параметров, и окружения программа не видит.
 *
 * Если в системе нет `initdb`, или порт занят, проверка пропускается: чужая
 * машина не обязана держать PostgreSQL. Пропуск говорит об этом словами, а не
 * зеленеет молча.
 *
 * ВТОРАЯ ПОЛОВИНА ФАЙЛА — ЗАМЕР ГРАНИЦЫ. Он не про драйвер, а про хозяина:
 * сколько октетов настоящей сессии переживает `сокет.setEncoding("utf8")` и
 * какие именно сообщения гибнут. Числа печатаются, а не проверяются порогом:
 * порог зависел бы от версии сервера, а число — улика.
 */
import assert from "node:assert/strict"
import { execFile, spawn } from "node:child_process"
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs"
import { connect } from "node:net"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { StringDecoder } from "node:string_decoder"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

import { loadProgram } from "../bin/flang.mjs"
import { nodeHost } from "../src/host/node.mjs"
import { runPlan } from "../src/io.mjs"

const выполнить = promisify(execFile)
const здесь = fileURLToPath(new URL(".", import.meta.url))
const ПОРТ = 55432

/** Где лежит initdb: сперва PATH, потом обычные места дистрибутивов. */
function найтиИнструменты() {
  const места = ["/usr/lib/postgresql", "/usr/local/pgsql/bin", "/opt/homebrew/opt/postgresql@17/bin"]
  for (const место of места) {
    if (!existsSync(место)) continue
    if (existsSync(join(место, "initdb"))) return место
    for (const версия of readdirSync(место).sort().reverse()) {
      const bin = join(место, версия, "bin")
      if (existsSync(join(bin, "initdb"))) return bin
    }
  }
  return null
}

/** Занят ли порт: если да, кластер поднимать некуда и проверка пропускается. */
const портСвободен = () =>
  new Promise((готово) => {
    const сокет = connect(ПОРТ, "127.0.0.1")
    сокет.on("connect", () => { сокет.destroy(); готово(false) })
    сокет.on("error", () => готово(true))
  })

async function поднятьКластер(bin) {
  const каталог = mkdtempSync(join(tmpdir(), "flang-pg-"))
  const данные = join(каталог, "data")
  /* Сокет домена Unix кладётся в короткий путь: у него предел 107 байтов, а
     каталог временных файлов бывает длиннее. */
  const сокеты = mkdtempSync(join(tmpdir(), "fpg-"))
  await выполнить(join(bin, "initdb"), ["-D", данные, "-U", "flang", "--auth=trust", "-E", "UTF8", "--locale=C"])
  const сервер = spawn(join(bin, "postgres"), [
    "-D", данные,
    "-p", String(ПОРТ),
    "-k", сокеты,
    "-c", "listen_addresses=127.0.0.1",
  ], { stdio: "ignore" })
  for (let попытка = 0; попытка < 100; попытка += 1) {
    await new Promise((готово) => setTimeout(готово, 200))
    const занят = !(await портСвободен())
    if (занят) break
  }
  return {
    остановить: () => {
      сервер.kill("SIGQUIT")
      rmSync(каталог, { recursive: true, force: true })
      rmSync(сокеты, { recursive: true, force: true })
    },
  }
}

const bin = найтиИнструменты()

test("НАСТОЯЩАЯ БАЗА: план на flang создаёт таблицу, вставляет с параметрами, выбирает и получает отказ", async (t) => {
  if (bin === null) return t.skip("в системе нет initdb: настоящую базу поднять нечем")
  if (!(await портСвободен())) return t.skip(`порт ${ПОРТ} занят: настоящую базу поднять некуда`)

  const кластер = await поднятьКластер(bin)
  const хозяин = nodeHost({})
  try {
    const программа = await loadProgram(resolve(здесь, "../examples/db/postgres-plan.flang"))
    const итог = await runPlan(программа, "Поговорить с постгресом", хозяин, { maxSteps: 200_000_000 })
    const строки = String(итог.значение).split("\n")
    for (const строка of строки) t.diagnostic(строка)

    assert.equal(строки.length, 5, итог.значение)

    /* 1. Вход. Настройки сервера прочитаны — значит разбор сообщения `S`
       работает; обрыв на `K` назван, а не проглочен. */
    assert.match(строки[0], /^1 пуск: /)
    assert.match(строки[0], /server_encoding=UTF8/)
    assert.match(строки[0], /ОБРЫВ: в теле сообщения «K»/)

    /* 2. Создание таблицы простым запросом. */
    assert.match(строки[1], /^2 создание: INSERT 0 1\|/)

    /* 3. Вставка РАСШИРЕННЫМ запросом с параметрами $1 и $2. */
    assert.match(строки[2], /^3 вставка с параметрами: INSERT 0 1\|/)

    /* 4. Выборка. Две строки, и вторая с кириллицей: длина кадра считается в
       октетах, а строка идёт знаками — если бы эти две меры спутались, ответ
       развалился бы именно здесь. */
    assert.match(строки[3], /^4 выборка: SELECT 2\|/)
    assert.match(строки[3], /1\tМир/)
    assert.match(строки[3], /2\tdva/)

    /* 5. Отказ базы — обычное значение, а не исключение. */
    assert.match(строки[4], /^5 отказ: \| ERROR 42703 column "netakoykolonki" does not exist/)

    /* И то же самое, спрошенное у базы напрямую: строка правда легла. */
    const { stdout } = await выполнить(join(bin, "psql"), [
      "-h", "127.0.0.1", "-p", String(ПОРТ), "-U", "flang", "-d", "postgres",
      "-tAc", "select id || ':' || imya || ':' || octet_length(imya) from flang_proba order by id",
    ])
    assert.equal(stdout.trim().split("\n").map((с) => с.trim()).join(" "), "1:Мир:6 2:dva:3")
  } finally {
    хозяин.закрыть()
    кластер.остановить()
  }
})

test("ЗАМЕР ГРАНИЦЫ: сколько октетов настоящей сессии переживает utf8-раскодирование хозяина", async (t) => {
  if (bin === null) return t.skip("в системе нет initdb: мерить нечего")
  if (!(await портСвободен())) return t.skip(`порт ${ПОРТ} занят: мерить негде`)

  const кластер = await поднятьКластер(bin)
  try {
    const с32 = (н) => Buffer.from([(н >>> 24) & 255, (н >>> 16) & 255, (н >>> 8) & 255, н & 255])
    const кадр = (буква, тело) => Buffer.concat([Buffer.from(буква, "latin1"), с32(тело.length + 4), тело])
    const строка = (т) => Buffer.concat([Buffer.from(т, "utf8"), Buffer.from([0])])

    const пришло = []
    const сокет = connect(ПОРТ, "127.0.0.1")
    сокет.on("data", (кусок) => пришло.push(кусок))
    await new Promise((готово) => сокет.once("connect", готово))
    const пуск = Buffer.concat([
      Buffer.from([0, 3, 0, 0]),
      строка("user"), строка("flang"), строка("database"), строка("postgres"), Buffer.from([0]),
    ])
    const послать = (б) => new Promise((готово) => сокет.write(б, готово))
    await послать(Buffer.concat([с32(пуск.length + 4), пуск]))
    await new Promise((готово) => setTimeout(готово, 400))
    await послать(кадр("Q", строка("select 1 as n")))
    await new Promise((готово) => setTimeout(готово, 400))
    сокет.destroy()

    const байты = Buffer.concat(пришло)
    let место = 0
    let всего = 0
    let целых = 0
    const битые = []
    while (место + 5 <= байты.length) {
      const буква = String.fromCharCode(байты[место])
      const длина = байты.readInt32BE(место + 1)
      if (длина < 4 || место + 1 + длина > байты.length) break
      const кусок = байты.subarray(место, место + 1 + длина)
      const раскодировать = new StringDecoder("utf8")
      const текст = раскодировать.write(кусок) + раскодировать.end()
      всего += 1
      if (Buffer.compare(Buffer.from(текст, "utf8"), кусок) === 0) целых += 1
      else битые.push(`${буква} длиной ${1 + длина}`)
      место += 1 + длина
    }
    const раскодировать = new StringDecoder("utf8")
    const текст = раскодировать.write(байты) + раскодировать.end()
    const замен = [...текст].filter((з) => з.codePointAt(0) === 0xfffd).length

    t.diagnostic(`октетов от сервера: ${байты.length}`)
    t.diagnostic(`знаков замены U+FFFD (невосстановимая порча): ${замен}`)
    t.diagnostic(`сообщений: ${всего}, уцелело ${целых}, испорчено ${всего - целых}`)
    t.diagnostic(`испорчены: ${битые.join(", ")}`)

    /* Единственное, что здесь УТВЕРЖДАЕТСЯ: порча есть и она не случайна.
       Ключ отмены (`K`) несёт случайное число и потому гибнет почти всегда;
       описание строк (`T`) несёт модификатор типа −1 и гибнет ВСЕГДА. Если
       однажды не испортится ничего — значит хозяин перестал раскодировать
       сокет как UTF-8, и этот файл надо переписать, а не подправить порог. */
    assert.ok(замен > 0, "порчи не нашлось: хозяин больше не раскодирует сокет как UTF-8?")
    assert.ok(битые.some((имя) => имя.startsWith("T ")), `описание строк уцелело: ${битые.join(", ")}`)
  } finally {
    кластер.остановить()
  }
})
