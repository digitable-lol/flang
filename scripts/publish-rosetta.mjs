/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Выкладка решений на Rosetta Code — вашей учётной записью, вашим паролем.
 *
 * ПОЧЕМУ ЭТО СКРИПТ, А НЕ РУЧНАЯ РАБОТА. Пятнадцать задач, у каждой свой
 * английский текст и свой код, из которого надо снять русские комментарии-шапки
 * (на вики им не место — там та же мысль сказана по-английски). Руками это
 * пятнадцать шансов ошибиться, причём молча: лишняя строка комментария на вики
 * заметна только читателю.
 *
 * ПОЧЕМУ ПАРОЛЬ, А НЕ ТОКЕН В КОМАНДНОЙ СТРОКЕ. Пароль спрашивается здесь и
 * никуда не записывается: ни в историю оболочки, ни в переменные окружения, ни
 * в файл. Скрипт получает от сайта временный токен правки и держит его в
 * памяти процесса. Заведите ботопароль (Special:BotPasswords) — тогда даже этот
 * пароль будет ограничен правом «править существующие страницы» и отзывается
 * одной кнопкой, не трогая основную учётку.
 *
 * ЧТО ОН ДЕЛАЕТ И ЧЕГО НЕ ДЕЛАЕТ. Дописывает раздел языка в конец страницы
 * задачи (`appendtext`) — так чужие решения не могут пострадать даже при
 * ошибке. Не создаёт страниц, не удаляет, не правит чужой текст. Перед каждой
 * правкой проверяет, нет ли на странице раздела flang уже: повторный запуск
 * ничего не задваивает.
 *
 * Запуск:
 *   node scripts/publish-rosetta.mjs --dry-run     показать, что уйдёт, и выйти
 *   node scripts/publish-rosetta.mjs --only FizzBuzz   одна задача
 *   node scripts/publish-rosetta.mjs               все, по одной, с паузой
 */
import { readFileSync } from "node:fs"
import { createInterface } from "node:readline/promises"
import { fileURLToPath } from "node:url"

const САЙТ = "https://rosettacode.org/w/api.php"
const КАТАЛОГ = fileURLToPath(new URL("../flang/examples/rosetta/", import.meta.url))

/*
 * Соответствие «страница задачи → файл решения». Имена страниц взяты с самого
 * сайта и обязаны совпадать посимвольно: Rosetta Code различает регистр после
 * первой буквы, и «Sorting algorithms/Quicksort» — не то же, что «/QuickSort».
 *
 * У каждой задачи есть `ещё` — та же программа на английской поверхности.
 * Причина не в вежливости к читателю, а в том, что он увидит без второго
 * листинга: страницу, набранную словами, которых он не знает, и вывод, что
 * язык ему недоступен. Русская запись — это ВЫБОР, а не ограничение, и
 * показать это можно только двумя листингами рядом.
 *
 * Что оба листинга суть одна программа, проверено не глазами: сверкой деревьев
 * в `flang/test/rosetta.test.mjs` (см. `flang/test/surface-pair.mjs`). Без неё
 * правка одного файла молча разошлась бы со вторым, и на вики уехали бы две
 * разные программы под видом одной.
 *
 * Римские числа стоят дважды — Encode и Decode решает один файл, и английская
 * пара у них тоже одна.
 */
const ЗАДАЧИ = [
  { страница: "FizzBuzz", файл: "fizzbuzz.flang", ещё: "fizzbuzz-english.flang" },
  { страница: "Fibonacci sequence", файл: "fibonacci.flang", ещё: "fibonacci-english.flang" },
  { страница: "Factorial", файл: "factorial.flang", ещё: "factorial-english.flang" },
  { страница: "Towers of Hanoi", файл: "towers-of-hanoi.flang", ещё: "towers-of-hanoi-english.flang" },
  { страница: "100 doors", файл: "hundred-doors.flang", ещё: "hundred-doors-english.flang" },
  { страница: "Roman numerals/Encode", файл: "roman-numerals.flang", ещё: "roman-numerals-english.flang" },
  { страница: "Roman numerals/Decode", файл: "roman-numerals.flang", ещё: "roman-numerals-english.flang" },
  { страница: "Run-length encoding", файл: "run-length-encoding.flang", ещё: "run-length-encoding-english.flang" },
  { страница: "Levenshtein distance", файл: "levenshtein-distance.flang", ещё: "levenshtein-distance-english.flang" },
  { страница: "Sequence of primes by trial division", файл: "primes-by-trial-division.flang", ещё: "primes-by-trial-division-english.flang" },
  { страница: "Sorting algorithms/Quicksort", файл: "quicksort.flang", ещё: "quicksort-english.flang" },
  { страница: "Sorting algorithms/Merge sort", файл: "merge-sort.flang", ещё: "merge-sort-english.flang" },
  { страница: "Reverse a string", файл: "reverse-string.flang", ещё: "reverse-string-english.flang" },
  { страница: "Palindrome detection", файл: "palindrome.flang", ещё: "palindrome-english.flang" },
  { страница: "Ackermann function", файл: "ackermann-function.flang", ещё: "ackermann-function-english.flang" },
]

/**
 * Английская проза к задаче — из WIKI.en.md, раздел с тем же именем файла.
 *
 * Текст лежит там цитатой («> ...»), потому что в самом файле он пояснение, а
 * не разметка. Здесь цитатные знаки снимаются: на вики это обычный абзац.
 */
function прозаДля(имяФайла, имяСтраницы) {
  const вики = readFileSync(КАТАЛОГ + "WIKI.en.md", "utf8")
  const разделы = вики.split(/^## /mu).slice(1)
  /* Сначала ищем по имени СТРАНИЦЫ: один файл может решать две задачи, и у них
     разная проза. Римские цифры — ровно этот случай: Encode и Decode приходят
     из roman-numerals.flang, но объясняются по-разному. Поиск по имени файла
     нашёл бы первый раздел для обеих и молча положил бы на две страницы один
     и тот же текст. */
  const раздел =
    разделы.find((текст) => текст.split("\n")[0].startsWith(имяСтраницы)) ??
    разделы.find((текст) => текст.split("\n")[0].includes(имяФайла))
  if (!раздел) throw new Error(`в WIKI.en.md нет раздела для ${имяСтраницы} (${имяФайла})`)
  const собрано = раздел
    .split("\n")
    .slice(1)
    .filter((строка) => строка.startsWith(">") || строка.trim() === "")
    .map((строка) => строка.replace(/^>\s?/u, ""))
    .join("\n")
    .trim()
  return вМедиавики(собрано)
}

/**
 * Разметка Markdown → разметка MediaWiki.
 *
 * Проза в WIKI.en.md написана по-Markdown, потому что живёт в репозитории и
 * читается там же. На вики Markdown не разбирается вовсе: `тотальная` осталась
 * бы с обратными кавычками, а **counting** — со звёздочками. Читатель увидел бы
 * мусор и решил, что автор не потрудился посмотреть на свою страницу.
 */
function вМедиавики(текст) {
  return текст
    .replace(/`([^`]+)`/gu, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/gu, "'''$1'''")
}

/**
 * Код без русских комментариев-шапок.
 *
 * Снимаются только строки, начинающиеся с `//`: хвостовых комментариев на
 * строках кода в этих файлах нет — проверено, и от этого зависит безопасность
 * такой обрезки.
 */
function кодИз(имяФайла) {
  const исходник = readFileSync(КАТАЛОГ + имяФайла, "utf8")
  const строки = исходник.split("\n").filter((строка) => !/^\s*\/\//u.test(строка))
  return строки.join("\n").replace(/\n{3,}/gu, "\n\n").trim()
}

function разделДля(задача) {
  const части = [`=={{header|Flang}}==`, "", прозаДля(задача.файл, задача.страница), "", `<syntaxhighlight lang="text">`, кодИз(задача.файл), `</syntaxhighlight>`]
  if (задача.ещё) {
    части.push("", "The same program on flang's English keyword surface:", "", `<syntaxhighlight lang="text">`, кодИз(задача.ещё), `</syntaxhighlight>`)
  }
  return "\n\n" + части.join("\n") + "\n"
}

/* ─────────────────────────── разговор с сайтом ─────────────────────────── */

const куки = new Map()
const значение = (з) => (з ?? "").trim()

async function запрос(параметры, метод = "GET") {
  const адрес = new URL(САЙТ)
  const тело = new URLSearchParams({ format: "json", formatversion: "2", ...параметры })
  if (метод === "GET") адрес.search = тело.toString()
  const ответ = await fetch(адрес, {
    method: метод,
    body: метод === "POST" ? тело : undefined,
    headers: {
      "user-agent": "flang-rosetta-publisher/1.0 (https://github.com/digitable-lol/flang)",
      ...(куки.size ? { cookie: [...куки].map(([к, з]) => `${к}=${з}`).join("; ") } : {}),
      ...(метод === "POST" ? { "content-type": "application/x-www-form-urlencoded" } : {}),
    },
  })
  for (const строка of ответ.headers.getSetCookie?.() ?? []) {
    const [пара] = строка.split(";")
    const [ключ, сырое] = пара.split("=")
    куки.set(ключ.trim(), значение(сырое))
  }
  return ответ.json()
}

async function войти(имя, пароль) {
  const { query } = await запрос({ action: "query", meta: "tokens", type: "login" })
  const итог = await запрос(
    { action: "login", lgname: имя, lgpassword: пароль, lgtoken: query.tokens.logintoken },
    "POST",
  )
  if (итог.login?.result !== "Success") {
    throw new Error(`вход не удался: ${итог.login?.result} ${итог.login?.reason ?? ""}`)
  }
  const { query: свои } = await запрос({ action: "query", meta: "tokens", type: "csrf" })
  return свои.tokens.csrftoken
}

/** Есть ли на странице раздел flang — чтобы повторный запуск не задваивал. */
async function ужеЕсть(страница) {
  const итог = await запрос({ action: "parse", page: страница, prop: "wikitext" })
  const текст = итог.parse?.wikitext ?? ""
  return /\{\{header\|Flang\}\}/iu.test(текст)
}

/* ─────────────────────────────── работа ─────────────────────────────── */

const аргументы = process.argv.slice(2)
const пробный = аргументы.includes("--dry-run")
const толькоОдна = аргументы.includes("--only") ? аргументы[аргументы.indexOf("--only") + 1] : null
const список = толькоОдна ? ЗАДАЧИ.filter((з) => з.страница === толькоОдна) : ЗАДАЧИ

if (список.length === 0) {
  console.error(`нет такой задачи: ${толькоОдна}`)
  console.error(`есть: ${ЗАДАЧИ.map((з) => з.страница).join(", ")}`)
  process.exit(2)
}

if (пробный) {
  for (const задача of список) {
    const текст = разделДля(задача)
    console.log(`\n${"─".repeat(70)}\n${задача.страница}  (${текст.length} байт)\n${"─".repeat(70)}`)
    console.log(текст)
  }
  console.log(`\nвсего задач: ${список.length}. Ничего не отправлено — это пробный ход.`)
  process.exit(0)
}

const консоль = createInterface({ input: process.stdin, output: process.stdout })
const имя = await консоль.question("Учётное имя на Rosetta Code: ")
const пароль = await консоль.question("Пароль (или ботопароль): ")
консоль.close()

const токен = await войти(имя.trim(), пароль)
console.log("вход выполнен\n")

let выложено = 0
let пропущено = 0
for (const задача of список) {
  if (await ужеЕсть(задача.страница)) {
    console.log(`— ${задача.страница}: раздел flang уже есть, пропускаю`)
    пропущено += 1
    continue
  }
  const итог = await запрос(
    {
      action: "edit",
      title: задача.страница,
      appendtext: разделДля(задача),
      summary: "Added Flang",
      token: токен,
      nocreate: "1",
    },
    "POST",
  )
  if (итог.edit?.result === "Success") {
    console.log(`✓ ${задача.страница}`)
    выложено += 1
  } else {
    console.log(`✗ ${задача.страница}: ${JSON.stringify(итог).slice(0, 300)}`)
  }
  /* Пауза между правками: вики не любит частых правок от новых участников, а
     терять уже сделанное из-за ограничения частоты обидно. */
  await new Promise((готово) => setTimeout(готово, 8000))
}

console.log(`\nвыложено: ${выложено}, пропущено: ${пропущено}, всего: ${список.length}`)
