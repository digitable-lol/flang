/**
 * Собирает фикстуры IR из моделей репозитория.
 *
 * Бэкенды кодогенерации не читают .fts и ничего не знают о путях: их вход —
 * IR из SPEC.md. Фикстуры позволяют разрабатывать и тестировать бэкенд
 * независимо от фронтенда компилятора.
 *
 * Запуск: node tools/ftsc/test/make-fixtures.mjs
 */
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"

import { compile } from "../../../dist/src/index.js"

const here = fileURLToPath(new URL(".", import.meta.url))
const repo = resolve(here, "../../..")
const fixtures = resolve(here, "fixtures")

/* Заголовок модуля разбирает ftsc, ядро его не знает. \b в JavaScript
   определяется по латинице, поэтому граница слова задаётся явно. */
const HEADER = /^\s*(модуль|использует|экспортирует|module|uses|exports)(?![\p{L}])/u

async function documentOf(file) {
  const raw = await readFile(resolve(repo, file), "utf8")
  return compile(
    raw
      .split("\n")
      .filter((line) => !HEADER.test(line))
      .join("\n")
      .trim(),
  )
}

async function moduleOf({ name, source, imports = [], exports: exported = null }) {
  const document = await documentOf(source)
  return { name: name ?? document.category, category: document.category, source, imports, exports: exported, document }
}

await mkdir(fixtures, { recursive: true })

/* Одна утилита с правилами, свойством и примерами — минимальный полезный вход
   для любого бэкенда. */
const discount = {
  ir: 1,
  project: "discount",
  modules: [await moduleOf({ source: "examples/utilities/discount.fts" })],
  functors: [],
  order: ["Продажи"],
}

/* Четыре поля разных типов и четыре правила: проверяет работу с числами,
   признаками и процентами от поля. */
const delivery = {
  ir: 1,
  project: "delivery",
  modules: [await moduleOf({ source: "tools/ftsc/examples/models/delivery-price.fts" })],
  functors: [],
  order: ["Логистика"],
}

/* Морфизмы и теорема без единой утилиты: бэкенд обязан пережить отсутствие
   вычислений и напечатать только типы и состояния. */
const shipment = {
  ir: 1,
  project: "shipment",
  modules: [await moduleOf({ source: "examples/real-world/order-shipment.fts" })],
  functors: [],
  order: ["Исполнение заказа"],
}

/* Многомодульный проект с функтором между категориями. */
const shop = {
  ir: 1,
  project: "shop",
  modules: [
    await moduleOf({
      name: "Продажи",
      source: "tools/ftsc/examples/shop/sales/purchase.fts",
      exports: { structures: ["Покупка"], utilities: ["Рассчитать скидку"] },
    }),
    await moduleOf({
      name: "Биллинг",
      source: "tools/ftsc/examples/shop/billing/invoice.fts",
      exports: { structures: ["Счёт"], utilities: ["Рассчитать НДС"] },
    }),
  ],
  functors: [
    {
      name: "Заказ в счёт",
      from: "Продажи",
      to: "Биллинг",
      objects: [
        {
          from: "Покупка",
          to: "Счёт",
          fields: [
            { from: "сумма", to: "сумма без НДС" },
            { from: "постоянный клиент", to: "лояльный" },
          ],
        },
      ],
      morphisms: [],
    },
  ],
  order: ["Продажи", "Биллинг"],
}

for (const program of [discount, delivery, shipment, shop]) {
  await writeFile(resolve(fixtures, `${program.project}.ir.json`), `${JSON.stringify(program, null, 2)}\n`, "utf8")
}

console.log(`ftsc fixtures: ${["discount", "delivery", "shipment", "shop"].join(", ")}`)
