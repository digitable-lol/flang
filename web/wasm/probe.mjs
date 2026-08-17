/**
 * Прогон web/wasm/demo в НАСТОЯЩЕМ браузере и печать чисел.
 *
 * Зачем отдельный прогонщик, а не «откройте страницу и посмотрите». Затем, что
 * два случая из восьми РОНЯЮТ ВКЛАДКУ, и в открытой руками странице это выглядит
 * как «ничего не произошло». Здесь каждый случай грузится своей страницей, и
 * падение вкладки — такой же результат прогона, как ответ: оно печатается
 * строкой «ВКЛАДКА УПАЛА» и относится к тому случаю, который её уронил.
 *
 * Playwright в зависимостях flang нет и не будет (ядро без зависимостей), путь к
 * нему берётся из переменной окружения:
 *
 *   python3 -m http.server 8907 --directory web/wasm/demo &
 *   PLAYWRIGHT=/путь/к/node_modules/playwright/index.mjs node web/wasm/probe.mjs
 */
const адрес = process.env.ДЕМО ?? "http://127.0.0.1:8907/index.html"
const playwright = process.env.PLAYWRIGHT
if (playwright === undefined) {
  console.error("нужен PLAYWRIGHT=<путь к playwright/index.mjs>")
  process.exit(2)
}

const { chromium } = await import(playwright)
const browser = await chromium.launch()

const первая = await browser.newPage()
console.log("браузер:", await первая.evaluate(() => navigator.userAgent))
await первая.close()

let неудач = 0
for (let i = 0; i < 8; i += 1) {
  const page = await browser.newPage()
  try {
    await page.goto(`${адрес}?case=${i}`, { waitUntil: "load", timeout: 20000 })
    await page.waitForFunction("window.__done === true", null, { timeout: 20000 })
    const отчёт = JSON.parse(await page.textContent("#machine"))
    const строка = отчёт.rows[0]
    console.log(`${i}. ${строка.label}`)
    console.log(`   ${отчёт.bytes} байт · загрузка ${отчёт.tFetch.toFixed(1)} мс · compile ${отчёт.tCompile.toFixed(1)} мс · instantiate ${строка.tInst} мс · run ${строка.tRun} мс`)
    console.log(`   ${строка.out || "(пусто)"}${строка.verdict ? `  ${строка.verdict}` : ""}`)
  } catch (ошибка) {
    /*
     * «Вкладка упала» говорится ТОЛЬКО про упавшую вкладку. Раньше здесь стояла
     * одна строка на любую беду, и погашенный сервер печатался как восемь
     * смертей подряд — то есть прогонщик выдавал свою поломку за улику. Улика,
     * которую нельзя отличить от опечатки в настройке, уликой не является.
     */
    const чем = String(ошибка.message).split("\n")[0]
    const упала = /Target crashed|Target closed|browser has been closed/iu.test(чем)
    console.log(`${i}. ${упала ? "ВКЛАДКА УПАЛА" : "ПРОГОН НЕ СОСТОЯЛСЯ"} — ${чем}`)
    if (!упала) неудач += 1
  }
  await page.close().catch(() => {})
}

await browser.close()

/* Не состоявшийся прогон — не результат замера, и молчать о нём нельзя: код
   возврата отличает «замерили» от «замерить не вышло». */
if (неудач > 0) {
  console.error(`прогон не состоялся в ${неудач} случаях из 8 — числа ниже не замер`)
  process.exitCode = 1
}
