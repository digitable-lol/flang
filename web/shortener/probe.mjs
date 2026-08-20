/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * probe.mjs — приложение в НАСТОЯЩЕМ браузере, поверх настоящей службы, без рук.
 *
 * Проверка `flang/test/app-shortener.test.mjs` подставляет документ и сеть и
 * потому гоняется в `npm test` на каждый коммит; она доказывает логику
 * приложения и хозяина. Чего она не доказывает — что настоящий браузер съест
 * программу на flang, что настоящий `addEventListener` разбудит план и что
 * настоящий `fetch` донесёт до службы то, что программа просила. Это
 * доказывается здесь, нажатиями, которые делает не человек.
 *
 * Стенд поднимается сам, отдельной командой запускать не надо. Служба при этом
 * НАСТОЯЩАЯ: `flang/examples/web/shortener/service.flang`, та самая, у которой
 * все 83 функции с доказанным завершением.
 *
 * Устройство взято у `web/app/probe.mjs`: Playwright в зависимости flang не
 * входит и не войдёт (ядро без зависимостей), путь берётся из окружения.
 *
 *   PLAYWRIGHT=/путь/к/node_modules/playwright/index.mjs \
 *   ХРОМ=/usr/bin/google-chrome \
 *   node web/shortener/probe.mjs
 */
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"

const playwright = process.env.PLAYWRIGHT
if (playwright === undefined) {
  console.error("нужен PLAYWRIGHT=<путь к playwright/index.mjs>")
  process.exit(2)
}

const порт = Number(process.env.ПОРТ ?? 8912)
const адрес = `http://127.0.0.1:${порт}/web/shortener/index.html`
const стенд = fileURLToPath(new URL("./stend.mjs", import.meta.url))

/* Стенд поднимается своим процессом: прогон в одну команду ценнее, чем
   инструкция из двух строк, которую забудут выполнить. */
const служба = spawn(process.execPath, [стенд, String(порт)], {
  stdio: ["ignore", "pipe", "inherit"],
  env: { ...process.env, LC_ALL: "C.UTF-8" },
})
await new Promise((готово, беда) => {
  служба.stdout.on("data", (кусок) => {
    if (String(кусок).includes("стенд:")) готово()
  })
  служба.on("exit", (код) => беда(new Error(`стенд не поднялся, код ${код}`)))
  setTimeout(() => беда(new Error("стенд не поднялся за 60 с")), 60_000)
})

const { chromium } = await import(playwright)
const browser = await chromium.launch({ executablePath: process.env.ХРОМ ?? "/usr/bin/google-chrome" })
const page = await browser.newPage()
const экран = () => page.textContent('[данные-место="экран"]')

let неудач = 0
const сверить = async (что, ожидается) => {
  const было = await экран()
  const сошлось = было === ожидается
  if (!сошлось) неудач += 1
  console.log(`${сошлось ? "✔" : "✘"} ${что}`)
  if (!сошлось) console.log(`   ждали: ${JSON.stringify(ожидается)}\n   вышло: ${JSON.stringify(было)}`)
}
const дождаться = (кусок, срок = 15_000) =>
  page.waitForFunction(
    `document.querySelector('[данные-место="экран"]').textContent.includes(${JSON.stringify(кусок)})`,
    null,
    { timeout: срок },
  )

/* Сокращается АДРЕС ТОГО ЖЕ СТЕНДА, и это не хитрость, а единственный способ
   проверить переход целиком. Служба на короткую ссылку отвечает переездом, а
   уезжает по нему сам браузер; уехать на чужой хост он из вкладки не сможет —
   там ни разрешённого источника, ни доступной сети. Свой же адрес разрешается
   и отвечает. */
const длинный = `http://127.0.0.1:${порт}/здоровье`

try {
  const начало = Date.now()
  await page.goto(адрес, { waitUntil: "load", timeout: 30_000 })
  /* Приложение показывает себя само, без нажатия: первое поручение всякого
     витка — «Показать». Дождаться этого — значит дождаться, что план поехал. */
  await дождаться("адрес:", 30_000)
  console.log(`браузер: ${await page.evaluate(() => navigator.userAgent)}`)
  console.log(`план поехал за ${Date.now() - начало} мс от goto\n`)

  /* Первый виток уже сходил в сеть: «Начать» задумывает список, и это видно на
     экране до всякого нажатия. */
  await дождаться("список свежий")
  await сверить(
    "открылось и само спросило у службы список",
    "адрес:  \nкод:    \nссылок: 0\n\n  (ссылок пока нет)\n\nсписок свежий: ссылок 0",
  )

  await page.fill('[данные-событие="адрес"]', длинный)
  await дождаться(длинный)
  await сверить(
    "набранный адрес доехал до программы целиком",
    `адрес:  ${длинный}\nкод:    \nссылок: 0\n\n  (ссылок пока нет)\n\nсписок свежий: ссылок 0`,
  )

  await page.click('[данные-значение="сократить"]')
  await дождаться("список свежий: ссылок 1")
  await сверить(
    "служба выдала код, и список обновился тем же ходом",
    `адрес:  \nкод:    к1\nссылок: 1\n\n  к1   →  ${длинный}   (переходов 0)\n\nсписок свежий: ссылок 1`,
  )

  await page.fill('[данные-событие="код"]', "к1")
  await дождаться("код:    к1")
  await page.click('[данные-значение="перейти"]')
  await дождаться("(переходов 1)")
  await сверить(
    "переход по короткой ссылке двинул счётчик службы",
    `адрес:  \nкод:    к1\nссылок: 1\n\n  к1   →  ${длинный}   (переходов 1)\n\nсписок свежий: ссылок 1`,
  )

  /* Отказ службы — ОТВЕТ, а не поломка, и вкладка обязана его пережить.
     `javascript:` служба отвергает кодом 422, и это её решение, не наше. */
  await page.fill('[данные-событие="адрес"]', "javascript:alert(1)")
  await page.click('[данные-значение="сократить"]')
  await дождаться("служба отказала (422)")
  await сверить(
    "злой адрес отвергнут службой, приложение живо",
    "адрес:  javascript:alert(1)\nкод:    к1\nссылок: 1\n" +
      `\n  к1   →  ${длинный}   (переходов 1)\n\nслужба отказала (422): адрес принимается только по http и https`,
  )

  await page.click('[данные-значение="очистить"]')
  await дождаться("очищено")
  await page.click('[данные-значение="обновить"]')
  await дождаться("список свежий: ссылок 1")
  await сверить(
    "вкладка жива после шести витков: обновление сработало",
    `адрес:  \nкод:    \nссылок: 1\n\n  к1   →  ${длинный}   (переходов 1)\n\nсписок свежий: ссылок 1`,
  )

  await page.screenshot({ path: process.env.СНИМОК ?? "/tmp/stoyka.png", fullPage: true })
  console.log(`\nснимок: ${process.env.СНИМОК ?? "/tmp/stoyka.png"}`)

  const отказ = await page.textContent('[данные-место="итог"]')
  if (отказ !== "") {
    неудач += 1
    console.log(`✘ план отказался: ${отказ}`)
  }
} catch (ошибка) {
  const чем = String(ошибка.message).split("\n")[0]
  const упала = /Target crashed|Target closed|browser has been closed/iu.test(чем)
  console.log(`${упала ? "ВКЛАДКА УПАЛА" : "ПРОГОН НЕ СОСТОЯЛСЯ"} — ${чем}`)
  console.log(`   экран был: ${JSON.stringify(await экран().catch(() => null))}`)
  неудач += 1
}

await browser.close()
служба.kill()
console.log(`\nнесошлось: ${неудач}`)
if (неудач > 0) process.exitCode = 1
