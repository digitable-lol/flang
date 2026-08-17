/**
 * Прогон примера «библиотека» целиком: модели, модули языка и живой сервер.
 *
 * Тест лежит внутри проекта, а не в flang/test, потому что он про проект, а
 * не про язык: переехав, проект унесёт свои проверки с собой. В общий набор он
 * подключён файлом-переходником flang/test/example-library-api.test.mjs —
 * образец в package.json смотрит только в flang/test, и заводить ради одного
 * примера второй образец значило бы править файл, который правят все.
 *
 * Проверяется ровно то, что обещано в README проекта: команды из README
 * отрабатывают, каждый модуль проходит check без диагностик и сходится со
 * своими примерами, а маршруты отвечают тем, что написано в модулях языка.
 */
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { after, before, describe, it } from "node:test"
import { создатьСервер } from "../host/server.mjs"

const корень = fileURLToPath(new URL("../../../", import.meta.url))
const проект = fileURLToPath(new URL("../", import.meta.url))

const МОДУЛИ = [
  "stdlib/text.flang",
  "lib/isbn.flang",
  "lib/query.flang",
  "lib/catalog.flang",
  "lib/fine.flang",
  "lib/loan.flang",
  "lib/api.flang",
]

/** `node flang/bin/flang.mjs <команда> <файл>` — та же команда, что в README. */
function flang(команда, файл) {
  const итог = spawnSync(process.execPath, ["flang/bin/flang.mjs", команда, `${проект}${файл}`], {
    cwd: корень,
    encoding: "utf8",
  })
  assert.equal(итог.status, 0, `flang ${команда} ${файл}: ${итог.stderr}`)
  return JSON.parse(итог.stdout)
}

describe("пример «библиотека»: модули flang", () => {
  for (const файл of МОДУЛИ) {
    it(`${файл} проходит check без диагностик`, () => {
      const итог = flang("check", файл)
      assert.equal(итог.valid, true)
      assert.deepEqual(итог.diagnostics, [])
    })

    it(`${файл} сходится со своими примерами`, () => {
      const итог = flang("test", файл)
      assert.equal(итог.valid, true, JSON.stringify(итог.results?.filter((строка) => !строка.passed)))
      assert.ok(итог.total > 0, "модуль без примеров проверять нечем")
    })
  }

  it("входной модуль тянет за собой все остальные", () => {
    const имена = flang("check", "lib/api.flang").functions.map((функция) => функция.name)
    /* По одному имени из каждого файла проекта, одно из библиотеки проекта и
       одно из flang/stdlib: связывание обязано собрать всю программу, а не
       только входной файл. */
    for (const имя of ["Отобрать", "Карточка", "Разобрать запрос", "Код верен", "Первая часть", "Сумма"]) {
      assert.ok(имена.includes(имя), `в собранной программе нет «${имя}»`)
    }
  })

  it("все функции проекта тотальны", () => {
    for (const функция of flang("check", "lib/api.flang").functions) {
      assert.equal(функция.total, true, `«${функция.name}» не тотальна`)
    }
  })

  it("библиотека проекта печатается во все восемь целевых языков", () => {
    /* Обещание README проекта: `host/` привязан к Node, библиотека — нет.
       Проверяется печатью, а не верой: бэкенды берутся из каталога
       flang/src/emit, поэтому новая цель попадёт сюда сама. */
    const цели = ["c", "go", "rust", "python", "java", "csharp", "elixir", "js"]
    for (const цель of цели) {
      const итог = spawnSync(
        process.execPath,
        ["flang/bin/flang.mjs", "emit", `${проект}lib/api.flang`, "--target", цель],
        { cwd: корень, encoding: "utf8" },
      )
      assert.equal(итог.status, 0, `emit --target ${цель}: ${итог.stderr}`)
      assert.ok(JSON.parse(итог.stdout).files.length > 0, `цель ${цель} ничего не напечатала`)
    }
  })

  it("у каждой функции собранной программы есть хотя бы один пример", () => {
    const без = flang("ast", "lib/api.flang")
      .functions.filter((функция) => (функция.examples ?? []).length === 0)
      .map((функция) => функция.name)
    assert.deepEqual(без, [], `функции без примеров: ${без.join(", ")}`)
  })
})

describe("пример «библиотека»: живой сервер", () => {
  let сервер
  let адрес

  before(async () => {
    сервер = await создатьСервер()
    /* Порт 0 — ядро выдаёт свободный. Фиксированный номер сделал бы тест
       непрогоняемым рядом с работающим сервером примера. */
    await new Promise((готово) => сервер.listen(0, "127.0.0.1", готово))
    адрес = `http://127.0.0.1:${сервер.address().port}`
  })

  after(async () => {
    await new Promise((готово) => сервер.close(готово))
  })

  const взять = async (путь, настройки) => {
    const ответ = await fetch(`${адрес}${путь}`, настройки)
    return { код: ответ.status, тело: await ответ.json() }
  }

  const послать = (путь, тело) =>
    взять(путь, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(тело) })

  it("GET /health отвечает и сообщает, сколько примеров прогнал на старте", async () => {
    const { код, тело } = await взять("/health")
    assert.equal(код, 200)
    assert.equal(тело.ok, true)
    assert.ok(тело.примеров > 0)
  })

  it("GET /books отдаёт каталог и карточки из lib/catalog.flang", async () => {
    const { код, тело } = await взять("/books")
    assert.equal(код, 200)
    assert.equal(тело.книги.length, 3)
    assert.equal(тело.карточки[0], "Стругацкие. Пикник на обочине (1972)")
  })

  it("GET /books отбирает по автору и по полке — отбор считает flang", async () => {
    const автор = await взять(`/books?author=${encodeURIComponent("Стругацкие")}`)
    assert.equal(автор.тело.книги.length, 2)

    const наПолке = await взять(`/books?author=${encodeURIComponent("Стругацкие")}&shelf=yes`)
    assert.equal(наПолке.тело.книги.length, 1)
    assert.equal(наПолке.тело.книги[0]["название"], "Пикник на обочине")
  })

  it("GET /books/summary считает сводку", async () => {
    const { тело } = await взять("/books/summary")
    assert.deepEqual(тело, { всего: 3, "на полке": 2, "свежий год": 1972, "средний год": 1968 })
  })

  it("POST /books отвергает ISBN с испорченной контрольной цифрой", async () => {
    const { код, тело } = await послать("/books", {
      код: "978-5-17-114589-8",
      автор: "Стругацкие",
      название: "Улитка на склоне",
      год: 1968,
    })
    assert.equal(код, 422)
    assert.match(тело.ошибка, /контрольной цифры/u)
  })

  it("POST /books принимает годный ISBN и нормализует его в ключ", async () => {
    const { код, тело } = await послать("/books", {
      код: "978-5-17-114589-7",
      автор: "Стругацкие",
      название: "Улитка на склоне",
      год: 1968,
    })
    assert.equal(код, 201)
    assert.equal(тело.книга["код"], "9785171145897")
    assert.equal(тело.карточка, "Стругацкие. Улитка на склоне (1968)")
  })

  it("POST /loans выдаёт книгу, когда правило языка разрешило", async () => {
    const { код, тело } = await послать("/loans", {
      номер: "ВД-19",
      читатель: "Ковалёва А. П.",
      книга: "978-5-17-118366-0",
      "долгов нет": true,
      "читатель допущен": true,
    })
    assert.equal(код, 201)
    /* Раньше ответ нёс СЕРТИФИКАТ: имя выведенной команды и отпечаток sha256.
       Сертификатов язык не строит — правило стало обычной функцией
       `Выдача разрешена` (lib/loan.flang). Что при этом потеряно, записано в
       шапке того модуля, а не спрятано здесь. */
    assert.equal(тело.разрешено, true)

    const полка = await взять("/books?shelf=yes")
    assert.equal(
      полка.тело.книги.some((книга) => книга["код"] === "9785171183660"),
      false,
      "выданная книга обязана уйти с полки",
    )
  })

  it("POST /loans отказывает, когда правило языка не разрешило", async () => {
    const { код, тело } = await послать("/loans", {
      номер: "ВД-20",
      читатель: "Петров И. С.",
      книга: "978-5-04-089283-9",
      "долгов нет": false,
      "читатель допущен": false,
    })
    assert.equal(код, 403)
    assert.equal(тело.разрешено, false)
    /* Раньше здесь сверялась причина отказа, названная СЕРТИФИКАТОМ («witness
       does not match context»). Сертификатов язык не строит: правило стало
       обычной функцией `Выдача разрешена` (lib/loan.flang), и отказ у неё
       ровно один — «не разрешена». Что при этом потеряно, записано в шапке
       того модуля. */
    assert.equal(тело.ошибка, "выдача не разрешена")
  })

  it("POST /returns берёт штраф ровно по lib/fine.flang", async () => {
    const вовремя = await послать("/returns", { книга: "9785171183660", "дней просрочки": 0, "книга редкая": false })
    assert.equal(вовремя.код, 200)
    assert.equal(вовремя.тело.штраф, 0)

    const просрочка = await послать("/returns", { книга: "9785171183660", "дней просрочки": 3, "книга редкая": false })
    assert.equal(просрочка.тело.штраф, 50)

    const редкая = await послать("/returns", { книга: "9785171183660", "дней просрочки": 14, "книга редкая": true })
    assert.equal(редкая.тело.штраф, 500)
  })

  it("неизвестный маршрут отвечает 404 и перечисляет известные", async () => {
    const { код, тело } = await взять("/несуществующее")
    assert.equal(код, 404)
    assert.ok(тело.маршруты.includes("GET /books"))
  })
})
