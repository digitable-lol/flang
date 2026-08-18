/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * probe.mjs — то же приложение, но в НАСТОЯЩЕМ браузере и тоже без рук.
 *
 * Проверка `flang/test/host-browser.test.mjs` подставляет документ и потому
 * гоняется в CI на каждый коммит; она доказывает логику приложения и хозяина,
 * но не доказывает, что настоящий браузер съест цепочку из шестнадцати модулей
 * flang и что настоящий `addEventListener` разбудит план. Это доказывает
 * здесь — нажатиями, которые делает не человек.
 *
 * Устройство взято у `web/wasm/probe.mjs`: Playwright в зависимости flang не
 * входит и не войдёт (ядро без зависимостей), путь берётся из окружения.
 *
 *   python3 -m http.server 8908 &
 *   PLAYWRIGHT=/путь/к/node_modules/playwright/index.mjs node web/app/probe.mjs
 */
const адрес = process.env.ПРИЛОЖЕНИЕ ?? "http://127.0.0.1:8908/web/app/index.html"
const playwright = process.env.PLAYWRIGHT
if (playwright === undefined) {
  console.error("нужен PLAYWRIGHT=<путь к playwright/index.mjs>")
  process.exit(2)
}

const { chromium } = await import(playwright)
const browser = await chromium.launch()
const page = await browser.newPage()
const экран = () => page.textContent('[данные-место="экран"]')
const нажать = (что) => page.click(`[данные-значение="${что}"]`)

let неудач = 0
const сверить = async (что, ожидается) => {
  const было = await экран()
  const сошлось = было === ожидается
  if (!сошлось) неудач += 1
  console.log(`${сошлось ? "✔" : "✘"} ${что}`)
  if (!сошлось) console.log(`   ждали: ${JSON.stringify(ожидается)}\n   вышло: ${JSON.stringify(было)}`)
}

try {
  const начало = Date.now()
  await page.goto(адрес, { waitUntil: "load", timeout: 20000 })
  /* Приложение показывает себя само, без нажатия: первое поручение всякого
     витка — «Показать». Дождаться этого — значит дождаться, что план поехал. */
  await page.waitForFunction(
    'document.querySelector(\'[данные-место="экран"]\').textContent.startsWith("набор:")',
    null,
    { timeout: 20000 },
  )
  console.log(`браузер: ${await page.evaluate(() => navigator.userAgent)}`)
  console.log(`план поехал за ${Date.now() - начало} мс от goto\n`)

  await сверить(
    "открылось пустым и с подсказкой",
    "набор: 0\nчисло: 0\nшагов: 0\nвершина: 0\nбег: нет\nнаберите число и нажмите «пуск»",
  )

  await нажать("2")
  await нажать("7")
  await page.waitForFunction(
    'document.querySelector(\'[данные-место="экран"]\').textContent.startsWith("набор: 27")',
    null,
    { timeout: 5000 },
  )
  await сверить("две цифры набраны", "набор: 27\nчисло: 0\nшагов: 0\nвершина: 0\nбег: нет\nнабрано 27")

  await нажать("пуск")
  await page.waitForFunction(
    'document.querySelector(\'[данные-место="экран"]\').textContent.includes("число: 27")',
    null,
    { timeout: 5000 },
  )
  await сверить("пуск начал полёт", "набор: 27\nчисло: 27\nшагов: 0\nвершина: 27\nбег: нет\nготово к шагам")

  await нажать("шаг")
  await page.waitForFunction(
    'document.querySelector(\'[данные-место="экран"]\').textContent.includes("число: 82")',
    null,
    { timeout: 5000 },
  )
  await сверить("шаг двинул на такт", "набор: 27\nчисло: 82\nшагов: 1\nвершина: 82\nбег: нет\nлетим")

  /* Бег: план будят ЧАСЫ, а не человек, и это ровно то место, ради которого у
     поручения «Ждать событие» есть срок. 27 приходит к единице за 111 шагов,
     вершина 9232 — числа известны заранее, поэтому сверять есть с чем. */
  await нажать("бег")
  await page.waitForFunction(
    'document.querySelector(\'[данные-место="экран"]\').textContent.includes("пришли к единице")',
    null,
    { timeout: 90000 },
  )
  await сверить(
    "бег дошёл до единицы сам, часами",
    "набор: 27\nчисло: 1\nшагов: 111\nвершина: 9232\nбег: нет\nпришли к единице",
  )

  /* Вкладка обязана быть ЖИВОЙ всё это время: план ждал на `await`, стек был
     пуст. Нажатие после бега — проверка того, что она и правда жива. */
  await нажать("сброс")
  await page.waitForFunction(
    'document.querySelector(\'[данные-место="экран"]\').textContent.includes("наберите число")',
    null,
    { timeout: 5000 },
  )
  await сверить(
    "вкладка жива после 111 витков: сброс сработал",
    "набор: 0\nчисло: 0\nшагов: 0\nвершина: 0\nбег: нет\nнаберите число и нажмите «пуск»",
  )

  const отказ = await page.textContent('[данные-место="итог"]')
  if (отказ !== "") {
    неудач += 1
    console.log(`✘ план отказался: ${отказ}`)
  }
} catch (ошибка) {
  const чем = String(ошибка.message).split("\n")[0]
  const упала = /Target crashed|Target closed|browser has been closed/iu.test(чем)
  console.log(`${упала ? "ВКЛАДКА УПАЛА" : "ПРОГОН НЕ СОСТОЯЛСЯ"} — ${чем}`)
  неудач += 1
}

await browser.close()
console.log(`\nнесошлось: ${неудач}`)
if (неудач > 0) process.exitCode = 1
