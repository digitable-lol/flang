/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Плагин asdf живёт в двух местах, и они обязаны совпадать побайтово.
 *
 * ── Зачем ───────────────────────────────────────────────────────────────────
 * Правится плагин здесь, в `packaging/asdf/`, рядом с формулой Homebrew: две
 * упаковки одного релиза удобнее держать вместе. А работать он обязан КОРНЕМ
 * отдельного репозитория `digitable-lol/asdf-flang` — так устроен asdf, он
 * клонирует плагин целиком и зовёт `bin/list-all`, `bin/download`, `bin/install`
 * оттуда. Значит копий две, и правка здесь до пользователя сама не доходит.
 *
 * Чем это кончается, в этом проекте уже измерено дважды, и оба раза дорого:
 *   • формула Homebrew правилась в репозитории, а `brew install` читал tap —
 *     и три релиза подряд ставил 0.4.7, пока репозиторий обещал 0.5.0;
 *   • README плагина звал `asdf plugin add flang .../asdf-flang.git`, а такого
 *     репозитория не существовало вовсе: адрес отвечал 404.
 *
 * Оба раза беда была не в коде, а в том, что копия отстала от источника молча.
 * Этот файл делает молчание невозможным.
 *
 * ── Как сверяется ───────────────────────────────────────────────────────────
 * Через git-хеши объектов, а не через скачивание файлов. У git имя объекта —
 * это sha1 от «blob ДЛИНА\0СОДЕРЖИМОЕ», то есть само содержимое и есть имя:
 * совпали хеши — совпали байты, без исключений. Поэтому хватает ОДНОГО запроса
 * к API за деревом, и сверка выходит точной, а не «на глаз по размеру».
 *
 * Дерево берётся из API, а не с raw.githubusercontent.com, намеренно: raw отдаёт
 * `vary: Accept-Encoding` при `max-age=300`, и сжатый вариант там живёт своей
 * жизнью. Измерено 18 августа 2026 на соседней проверке: через три минуты после
 * push `curl` уже видел новое, а `fetch` из Node — ещё старое. Сверка свежести
 * не имеет права читать из кеша.
 *
 * Заодно проверяется исполняемый бит. Скрипт плагина без него asdf не запустит,
 * а по содержимому такую беду не увидеть: байты те же, режим другой.
 *
 * Запуск:  node --test flang/test/asdf-plugin-published.test.mjs
 * Заглушить намеренно (без сети в CI):  FLANG_SKIP_RELEASE_CHECK=1
 */
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const корень = fileURLToPath(new URL("../../", import.meta.url))
const ИСТОЧНИК = join(корень, "packaging/asdf")
const ПЛАГИН = "digitable-lol/asdf-flang"
const ЖДАТЬ = 15000

/* LICENSE лежит только в опубликованном репозитории, и это осознанно: пункт 1
   BSD-2-Clause требует сохранять уведомление при распространении исходников, а
   отдельный репозиторий — ровно распространение. Внутри flang он уже есть в
   корне, второй копии в packaging/asdf не нужно. Список закрытый: всё, что
   появится в плагине сверх него, — расхождение, а не «мелочь». */
const РАЗРЕШЕНО_СВЕРХ = new Set(["LICENSE"])

/** Имя объекта git для содержимого файла: sha1("blob ДЛИНА\0" + байты). */
export function хешОбъекта(байты) {
  const шапка = Buffer.from(`blob ${байты.length}\0`, "utf8")
  return createHash("sha1").update(Buffer.concat([шапка, байты])).digest("hex")
}

/** Все файлы источника: путь относительно packaging/asdf, хеш и исполнимость. */
export function файлыИсточника(каталог = ИСТОЧНИК) {
  const собрано = new Map()
  const обойти = (место) => {
    for (const запись of readdirSync(место, { withFileTypes: true })) {
      const путь = join(место, запись.name)
      if (запись.isDirectory()) {
        обойти(путь)
        continue
      }
      if (!запись.isFile()) continue
      const имя = relative(каталог, путь).split(sep).join("/")
      собрано.set(имя, {
        хеш: хешОбъекта(readFileSync(путь)),
        исполняемый: (statSync(путь).mode & 0o111) !== 0,
      })
    }
  }
  обойти(каталог)
  return собрано
}

const списком = (имена) => (имена.length === 0 ? "(пусто)" : [...имена].sort().join(", "))

async function деревоПлагина() {
  const заголовки = { accept: "application/vnd.github+json", "user-agent": "flang-asdf-plugin-check" }
  const токен = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? process.env.GITHUB_API_TOKEN
  if (токен) заголовки.authorization = `Bearer ${токен}`
  const ответ = await fetch(`https://api.github.com/repos/${ПЛАГИН}/git/trees/HEAD?recursive=1`, {
    headers: заголовки,
    signal: AbortSignal.timeout(ЖДАТЬ),
  })
  if (ответ.status === 403 || ответ.status === 429) {
    return { да: false, почему: `API GitHub ответил ${ответ.status} (лимит запросов)` }
  }
  if (ответ.status === 404) {
    /* Красное, а не пропуск: репозитория нет — это ровно та беда, из-за которой
       README звал по адресу, отвечавшему 404. */
    return { да: true, нет: true }
  }
  if (!ответ.ok) return { да: false, почему: `API GitHub ответил ${ответ.status}` }
  return { да: true, дерево: await ответ.json() }
}

test("опубликованный плагин asdf совпадает с packaging/asdf", async (t) => {
  if (process.env.FLANG_SKIP_RELEASE_CHECK) {
    t.skip("проверка выключена намеренно: FLANG_SKIP_RELEASE_CHECK")
    return
  }
  let ответ
  try {
    ответ = await деревоПлагина()
  } catch (беда) {
    t.skip(`до api.github.com не достучались, плагин НЕ ПРОВЕРЕН — ${беда.message}`)
    return
  }
  if (!ответ.да) {
    t.skip(`GitHub недоступен, плагин НЕ ПРОВЕРЕН — ${ответ.почему}`)
    return
  }
  assert.ok(
    !ответ.нет,
    `репозитория ${ПЛАГИН} не существует (API ответил 404), а README плагина зовёт ` +
      `«asdf plugin add flang https://github.com/${ПЛАГИН}.git». Обещание установки, ` +
      `за которым нет репозитория, — ложь: команда падает у первого же человека.`,
  )

  const свои = файлыИсточника()
  const чужие = new Map(
    (ответ.дерево.tree ?? [])
      .filter((узел) => узел.type === "blob")
      .map((узел) => [узел.path, { хеш: узел.sha, исполняемый: узел.mode === "100755" }]),
  )

  /* 1. Ничего не потеряно. */
  const пропали = [...свои.keys()].filter((имя) => !чужие.has(имя))
  assert.deepEqual(
    пропали,
    [],
    `в packaging/asdf есть файлы, которых нет в ${ПЛАГИН}: ${списком(пропали)}. ` +
      `Здесь ${свои.size}: ${списком([...свои.keys()])}. ` +
      `Опубликовано ${чужие.size}: ${списком([...чужие.keys()])}. ` +
      `Скопируйте: cp -R packaging/asdf/. ../asdf-flang/`,
  )

  /* 2. Ничего лишнего, кроме заранее названного. */
  const лишние = [...чужие.keys()].filter((имя) => !свои.has(имя) && !РАЗРЕШЕНО_СВЕРХ.has(имя))
  assert.deepEqual(
    лишние,
    [],
    `в ${ПЛАГИН} появились файлы, которых нет в packaging/asdf: ${списком(лишние)}. ` +
      `Сверх источника разрешено только ${списком([...РАЗРЕШЕНО_СВЕРХ])}. ` +
      `Опубликовано ${чужие.size}: ${списком([...чужие.keys()])}.`,
  )

  /* 3. Совпадает содержимое — побайтово, через имя объекта git. */
  const разошлись = [...свои.entries()]
    .filter(([имя, наш]) => чужие.has(имя) && чужие.get(имя).хеш !== наш.хеш)
    .map(([имя]) => имя)
  assert.deepEqual(
    разошлись,
    [],
    `содержимое разошлось у ${разошлись.length} файлов из ${свои.size}: ${списком(разошлись)}. ` +
      `«asdf plugin add flang» привезёт человеку версию из ${ПЛАГИН}, а не эту, — ` +
      `правка в packaging/asdf до него не дойдёт. Ровно так формула Homebrew отстала на три релиза. ` +
      `Скопируйте: cp -R packaging/asdf/. ../asdf-flang/`,
  )

  /* 4. Скрипты остались исполняемыми: без бита asdf их не запустит. */
  const неИсполняемые = [...свои.entries()]
    .filter(([имя, наш]) => наш.исполняемый && чужие.has(имя) && !чужие.get(имя).исполняемый)
    .map(([имя]) => имя)
  assert.deepEqual(
    неИсполняемые,
    [],
    `в ${ПЛАГИН} потерян исполняемый бит у ${неИсполняемые.length} файлов: ${списком(неИсполняемые)}. ` +
      `Байты те же, но asdf такой скрипт не запустит. Верните режим 100755.`,
  )
})
