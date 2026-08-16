/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Замороженные ответы эталона FTS — вторая сторона сверок ядра, написанного на flang.
 *
 * ── Что произошло и почему ──────────────────────────────────────────────────
 * Четыре проверки — `core-lexer`, `core-parser`, `core-json`, `core-evaluate` —
 * сверяли программы `flang/core/*.flang` с эталоном на TypeScript побайтово.
 * Эталон вынесен из репозитория (тег `fts-pered-udaleniem`), и второй стороны у
 * сверки не стало.
 *
 * Выбор был из двух: выбросить сверки или заморозить их вторую сторону. Выбрано
 * второе, потому что вместе со сверками ушёл бы ЕДИНСТВЕННЫЙ прогон самых
 * больших программ дерева. `core/parser.flang` — 262 КБ; все остальные проверки
 * её только разбирают, типизируют и печатают, а ВЫЧИСЛЯЮТ — эти четыре.
 *
 * ── Чем проверка стала слабее, и это надо знать ─────────────────────────────
 * Была дифференциальной: «две независимые реализации согласны». Стала золотой:
 * «программа на flang даёт те же байты, что давала в день заморозки».
 * Расхождение двух реализаций она больше не поймает — ловить нечего. Регресс в
 * `core/*.flang` ловит по-прежнему, байт в байт.
 *
 * ── Почему промах — падение, а не пропуск ───────────────────────────────────
 * Проверка, переставшая сравнивать, продолжает зеленеть. Поэтому вход, ответа
 * на который в таблице нет, — это ошибка с текстом, а не тихий `skip`: иначе
 * правка теста, поменявшая входы, молча выключила бы сверку.
 *
 * ── Как перезаписать таблицу ────────────────────────────────────────────────
 * Только на дереве, где эталон ещё есть, — тег `fts-pered-udaleniem`:
 *
 *     npm run build
 *     FLANG_FTS_ORACLE=record node --test flang/test/core-*.test.mjs
 *
 * ── Почему формат такой ─────────────────────────────────────────────────────
 * Ключ — хеш входа: сеткой `core-evaluate` идут двадцать с лишним тысяч
 * вызовов, и таблица с полными входами весила бы больше корпуса. Значение
 * пишется без отступов, но каждая запись — своя строка: одна строка на 5 МБ не
 * читается ни глазом, ни `git diff`.
 */
import { createHash } from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const ФАЙЛ = fileURLToPath(new URL("./fixtures/fts-oracle.json", import.meta.url))
const ЗАПИСЬ = process.env.FLANG_FTS_ORACLE === "record"

const пусто = { "compile": {}, "evaluateUtility": {} }
const таблица = existsSync(ФАЙЛ) ? JSON.parse(readFileSync(ФАЙЛ, "utf8")) : пусто

/* Настоящее ядро подключается ТОЛЬКО в режиме записи: в обычном прогоне его в
   дереве нет, и импорт уронил бы файл целиком. */
const настоящее = ЗАПИСЬ ? await import(new URL("../../dist/src/index.js", import.meta.url).href) : null

/**
 * Подпись входа для ключа — СВОЯ, а не `JSON.stringify`, и это не украшение.
 *
 * `JSON.stringify(-0)` даёт `"0"`. Значит вход `{сумма: -0}` и вход `{сумма: 0}`
 * получали ОДИН ключ, вторая запись затирала первую, и проверка «ноль не равен
 * минус нулю» краснела на подменённом ответе. Поймано прогоном сразу после
 * заморозки — ровно тем, что промах и подмена здесь падают, а не молчат.
 *
 * NaN и бесконечности `JSON.stringify` превращает в `null`, то есть склеивает
 * их и между собой, и с `ничто`; здесь они названы поимённо. Порядок ключей
 * записи сохраняется — тот же, что у `JSON.stringify`.
 */
function подпись(значение) {
  if (Object.is(значение, -0)) return "-0"
  if (значение === undefined) return "#undefined"
  if (typeof значение === "number") return Number.isFinite(значение) ? String(значение) : `#${значение}`
  if (значение === null || typeof значение !== "object") return JSON.stringify(значение)
  if (Array.isArray(значение)) return `[${значение.map(подпись).join(",")}]`
  return `{${Object.entries(значение).map(([имя, поле]) => `${JSON.stringify(имя)}:${подпись(поле)}`).join(",")}}`
}

const ключ = (...части) => createHash("sha256").update(части.join(" ")).digest("hex").slice(0, 24)

/* Таблица пишется один раз на выходе, а не на каждый ответ: двадцать тысяч
   записей на каждый вызов — это квадрат, и прогон встал бы. */
let грязно = false
if (ЗАПИСЬ) process.on("exit", сохранить)

function сохранить() {
  if (!грязно) return
  const раздел = (имя) =>
    Object.keys(таблица[имя])
      .sort()
      .map((k) => `${JSON.stringify(k)}:${JSON.stringify(таблица[имя][k])}`)
      .join(",\n")
  writeFileSync(ФАЙЛ, `{\n"compile":{\n${раздел("compile")}\n},\n"evaluateUtility":{\n${раздел("evaluateUtility")}\n}\n}\n`)
}

/* JSON не знает ни -0, ни NaN, ни бесконечностей, а сверка идёт `Object.is`:
   потерять -0 значило бы сделать зелёной ровно ту проверку, которая заведена
   про минус ноль. Отказ и особое значение помечаются ключом, которого у
   скаляра быть не может: скаляры FTS — число, строка, признак или ничто. */
function закодировать(значение) {
  if (Object.is(значение, -0)) return { "#": "-0" }
  if (значение === undefined) return { "#": "undefined" }
  if (typeof значение === "number" && !Number.isFinite(значение)) return { "#": String(значение) }
  return значение
}

function раскодировать(записанное) {
  if (записанное === null || typeof записанное !== "object") return записанное
  switch (записанное["#"]) {
    case "-0": return -0
    case "NaN": return Number.NaN
    case "Infinity": return Number.POSITIVE_INFINITY
    case "-Infinity": return Number.NEGATIVE_INFINITY
    case "undefined": return undefined
    default: throw new Error(`неизвестная пометка в таблице: ${JSON.stringify(записанное)}`)
  }
}

const отказ = (ошибка) => ({
  "!": ошибка?.message ?? String(ошибка),
  ...(Array.isArray(ошибка?.diagnostics) ? { "д": ошибка.diagnostics } : {}),
  ...(typeof ошибка?.code === "string" ? { "к": ошибка.code } : {}),
})

const этоОтказ = (записанное) => записанное !== null && typeof записанное === "object" && typeof записанное["!"] === "string"

function бросить(записанное) {
  const ошибка = new Error(записанное["!"])
  if (записанное["д"] !== undefined) ошибка.diagnostics = записанное["д"]
  if (записанное["к"] !== undefined) ошибка.code = записанное["к"]
  throw ошибка
}

function промах(вид, подробности) {
  throw new Error(
    `замороженного ответа эталона FTS нет: ${вид}, ${подробности}. Эталон вынесен из репозитория, ` +
      `и придумать ответ здесь неоткуда. Либо верните вход в прежний набор, либо перезапишите таблицу ` +
      `на дереве с тегом fts-pered-udaleniem: FLANG_FTS_ORACLE=record node --test flang/test/core-*.test.mjs`,
  )
}

/**
 * `compile(текст)` эталона.
 *
 * Документ хранится СТРОКОЙ, а не объектом: сверка в `core-json` и `core-parser`
 * побайтовая, и сравнивает она именно `JSON.stringify(документ)`. Храни мы
 * объект — порядок ключей задавал бы уже наш `JSON.parse`, и сверка сравнивала
 * бы себя с собой.
 */
export function compile(текст) {
  const k = ключ("compile", текст)
  if (ЗАПИСЬ) {
    грязно = true
    try {
      const документ = настоящее.compile(текст)
      const json = JSON.stringify(документ)
      /* Круговой обход обязан быть побайтовым. Не побайтовый — значит в
         документе есть ключ, который `JSON.parse` переставляет (числовой), и
         замораживать нельзя: сверка стала бы врать. */
      if (JSON.stringify(JSON.parse(json)) !== json) {
        throw new Error("документ не переживает JSON.parse побайтово — замораживать нельзя")
      }
      таблица["compile"][k] = json
      return документ
    } catch (ошибка) {
      if (!Array.isArray(ошибка?.diagnostics)) throw ошибка
      таблица["compile"][k] = отказ(ошибка)
      throw ошибка
    }
  }
  const записанное = таблица["compile"][k]
  if (записанное === undefined) {
    промах("compile", `${текст.length} байт, начало «${текст.slice(0, 60).replace(/\n/gu, "⏎")}»`)
  }
  if (этоОтказ(записанное)) бросить(записанное)
  return JSON.parse(записанное)
}

/** `evaluateUtility(утилита, вход)` эталона. */
export function evaluateUtility(утилита, вход) {
  const k = ключ("evaluateUtility", подпись(утилита), подпись(вход))
  if (ЗАПИСЬ) {
    грязно = true
    try {
      const значение = настоящее.evaluateUtility(утилита, вход)
      таблица["evaluateUtility"][k] = закодировать(значение)
      return значение
    } catch (ошибка) {
      таблица["evaluateUtility"][k] = отказ(ошибка)
      throw ошибка
    }
  }
  const записанное = таблица["evaluateUtility"][k]
  if (записанное === undefined) промах("evaluateUtility", `«${утилита?.name}» на ${JSON.stringify(вход)}`)
  if (этоОтказ(записанное)) бросить(записанное)
  return раскодировать(записанное)
}

/** Сколько ответов заморожено — чтобы охват было видно в выводе проверок. */
export const размерТаблицы = () =>
  Object.keys(таблица["compile"]).length + Object.keys(таблица["evaluateUtility"]).length
