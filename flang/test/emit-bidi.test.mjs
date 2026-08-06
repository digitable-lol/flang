/**
 * Двунаправленные управляющие символы — общая проверка ВСЕХ целей печати.
 *
 * Правило одно на все бэкенды: двунаправленные управляющие символы Unicode
 * (U+061C, U+200E, U+200F, U+202A…U+202E, U+2066…U+2069) нельзя печатать в
 * целевой код сырыми. Места они не занимают, а раскладку текста меняют, поэтому
 * файл читается не так, как исполняется, — это «Trojan Source»
 * (CVE-2021-42574). Практических следствий три, и все три наблюдаемы:
 *
 *   • gcc 13 под `-Werror` отказывается собирать: непарные управляющие он ловит
 *     сам (`-Wbidi-chars=unpaired` включён по умолчанию), любые — под
 *     `-Wbidi-chars=any`;
 *   • rustc отвергает любые: `text_direction_codepoint_in_literal` —
 *     deny-by-default, и это ошибка, а не предупреждение;
 *   • elixirc отказывается разбирать файл вовсе: «invalid bidirectional
 *     formatting character in string».
 *
 * А javac собирает такой файл молча даже под `-Xlint:all -Werror`, и это не
 * смягчающее обстоятельство, а отягчающее: ровно ради этого молчания атаку и
 * придумали. Как ведёт себя Roslyn, здесь не проверено — тулчейна .NET на
 * машине не было, — и полагаться на него всё равно нельзя.
 *
 * В литерал эти символы попадают законно, без всякой атаки: таблица блоков
 * лексера (flang/self/lexer.flang) перечисляет весь блок U+2000…U+207F подряд,
 * и одиннадцать из двенадцати — как раз оттуда.
 *
 * ── Почему тест общий, а не по бэкенду ──────────────────────────────────────
 * Проверка была ровно одна, у бэкенда C (flang/test/emit-c.test.mjs), — и
 * поэтому три цели, добавленные позже (java, csharp, elixir), правило не
 * унаследовали: печатали сырыми, и никто не падал. Тест на бэкенд ловит только
 * те бэкенды, о которых кто-то вспомнил.
 *
 * Поэтому здесь перебор идёт ПО РЕЕСТРУ ЦЕЛЕЙ, а реестр — сам каталог
 * `flang/src/emit` (`emitTargets()` из bin/flang.mjs), тот же, по которому
 * работает `flang emit --target`. Девятая цель попадает под проверку тем, что
 * её модуль положили в каталог: списка целей, который можно забыть пополнить, в
 * этом файле нет. Файл подхватывается прогоном `npm run test:flang`
 * (`node --test flang/test/*.test.mjs`) — списка тестов, который тоже можно
 * забыть пополнить, там нет тоже.
 *
 * ── Что именно проверяется ──────────────────────────────────────────────────
 *   1. НИ ОДНОГО СЫРОГО СИМВОЛА ни в одном напечатанном файле. Это то, из-за
 *      чего отказывают компиляторы и из-за чего врёт ревью.
 *   2. ЗНАЧЕНИЕ НЕ ИЗМЕНИЛОСЬ. Экранирование, потерявшее символ или подменившее
 *      кодовую точку, «чинит» предупреждение ценой чужой программы. Поэтому
 *      напечатанный литерал разбирается обратно — в БАЙТЫ, а не в символы (у C
 *      экранирован каждый байт UTF-8 отдельно) — и сверяется с тем, что на этой
 *      же программе даёт интерпретатор.
 *
 * Формы экранирования у целей разные и общими быть не могут: `\NNN` побайтно в
 * C (в узкой строке C99 нет `\u`), `\uXXXX` в Java, C#, Go, Python и JS,
 * `\u{X…}` в Rust и Elixir. Общее — результат, и сверяется здесь именно он.
 *
 * Проверяется путь СТРОКОВОГО ЛИТЕРАЛА: это тот путь, по которому символ из
 * разбираемого текста попадает в целевой код. Имена FTS, уезжающие в
 * комментарии напечатанного кода, этим тестом не покрыты — там сырыми их
 * печатают все восемь целей одинаково, и это отдельная история.
 *
 * Сам этот файл сырых двунаправленных не содержит: и в исходнике flang, и в
 * ожидаемом значении они заданы кодами, а не символами, — иначе тест
 * воспроизводил бы ровно ту беду, от которой стережёт.
 */
import assert from "node:assert/strict"
import { test } from "node:test"

import { emitTargets, loadEmitter } from "../bin/flang.mjs"
import { evaluate as interpret } from "../src/interpret.mjs"
import { parse } from "../src/parser.mjs"

/* Все двенадцать: восемь из блока U+2000…U+207F, ALM из арабского блока и
   изоляты. Программа ниже содержит их все, поэтому цель, экранировавшая только
   часть набора, здесь и падает. */
const BIDI_CONTROLS = [0x061c, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069]

/* Цели, существовавшие в день написания теста. Перебор идёт НЕ по этому списку,
   а по реестру: список держится только как нижняя граница. `emitTargets()`
   возвращает пустой список, если каталога нет (переехал, переименован), и без
   этой проверки перебор по пустому реестру выглядел бы успехом. */
const ИЗВЕСТНЫЕ = ["c", "csharp", "elixir", "go", "java", "js", "python", "rust"]

/* Якоря чисто из ASCII-букв: их не экранирует ни одна цель, поэтому тело
   литерала между ними находится в напечатанном файле без знания языка.
   Закрывающий начинается с «Z» намеренно: это не шестнадцатеричная и не
   восьмеричная цифра, и к экранированию перед ним ничего не приклеится — иначе
   тест ловил бы собственный якорь вместо ошибки бэкенда. */
const НАЧАЛО = "bidiA"
const КОНЕЦ = "Zbidi"

const source = [
  "модуль «Двунаправленные»",
  "",
  "тотальная функция «Метка»",
  "  возвращает строка",
  `  "${НАЧАЛО}${BIDI_CONTROLS.map((code) => `\\u${code.toString(16).padStart(4, "0")}`).join("")}${КОНЕЦ}"`,
].join("\n")

const program = parse(source)

/* Источник истины — интерпретатор, а не константа в тесте: сверять печать с
   переписанным от руки ожиданием значило бы проверять, что автор теста и автор
   бэкенда одинаково поняли исходник. */
const ожидаемое = interpret(program, "Метка", [])

/**
 * Обратный разбор экранирований: из записи целевого языка — в байты UTF-8.
 *
 * Собираются именно байты: у C экранирован каждый байт UTF-8 по отдельности, и
 * разбор по кодовым точкам прошёл бы мимо порчи кодировки. Готовое
 * декодируется строгим декодером — испорченная последовательность обязана не
 * «почти совпасть», а упасть.
 *
 * `\xNN` намеренно не поддержан: в C и Go это байт, в Python — кодовая точка, и
 * разобрать его однозначно нельзя. Целям он для двунаправленных и не нужен — в
 * C он к тому же жадный (ест сколько угодно цифр подряд), ради чего C и печатает
 * восьмеричными.
 */
function decodeEscapes(text) {
  const utf8 = new TextEncoder()
  const bytes = []
  let position = 0
  while (position < text.length) {
    if (text[position] !== "\\") {
      /* По кодовым точкам, а не по единицам UTF-16: суррогатная пара обязана
         уехать в байты парой. */
      const character = String.fromCodePoint(text.codePointAt(position))
      bytes.push(...utf8.encode(character))
      position += character.length
      continue
    }
    const rest = text.slice(position)
    const kind = text[position + 1]
    let match = null
    if (kind === "u" && text[position + 2] === "{") {
      match = /^\\u\{([0-9a-fA-F]{1,6})\}/u.exec(rest)
      if (match !== null) bytes.push(...utf8.encode(String.fromCodePoint(Number.parseInt(match[1], 16))))
    } else if (kind === "u" || kind === "U") {
      match = kind === "u" ? /^\\u([0-9a-fA-F]{4})/u.exec(rest) : /^\\U([0-9a-fA-F]{8})/u.exec(rest)
      if (match !== null) bytes.push(...utf8.encode(String.fromCodePoint(Number.parseInt(match[1], 16))))
    } else if (kind >= "0" && kind <= "7") {
      match = /^\\([0-7]{1,3})/u.exec(rest)
      if (match !== null) bytes.push(Number.parseInt(match[1], 8))
    }
    assert.ok(
      match !== null,
      `не опознана форма экранирования «${rest.slice(0, 8)}»: разбор знает \\uXXXX, \\u{X…}, \\UXXXXXXXX и ` +
        "восьмеричное \\NNN. Новая цель вправе выбрать свою форму — тогда её надо добавить сюда, а не выключить проверку",
    )
    position += match[0].length
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bytes))
}

/** Все вхождения тела литерала между якорями — по всем напечатанным файлам. */
function literalBodies(files) {
  const found = []
  for (const file of files) {
    let from = 0
    for (;;) {
      const start = file.content.indexOf(НАЧАЛО, from)
      if (start === -1) break
      const end = file.content.indexOf(КОНЕЦ, start + НАЧАЛО.length)
      assert.notEqual(end, -1, `${file.path}: литерал начат якорем «${НАЧАЛО}» и не закончен «${КОНЕЦ}»`)
      found.push({ path: file.path, body: file.content.slice(start + НАЧАЛО.length, end) })
      from = end + КОНЕЦ.length
    }
  }
  return found
}

/** Файлы бэкенда: и `{ files }`, и голый список — обе формы CLI принимает. */
function emittedFiles(emitted, target) {
  const files = Array.isArray(emitted) ? emitted : emitted?.files
  assert.ok(
    Array.isArray(files) && files.every((file) => typeof file?.path === "string" && typeof file?.content === "string"),
    `бэкенд «${target}» вернул не список файлов {path, content}`,
  )
  return files
}

/** Сырые двунаправленные с координатами: строка, столбец, кодовая точка. */
function rawControls(files) {
  const found = []
  for (const file of files) {
    file.content.split("\n").forEach((line, index) => {
      ;[...line].forEach((character, column) => {
        const code = character.codePointAt(0)
        if (BIDI_CONTROLS.includes(code)) {
          found.push(`${file.path}:${index + 1}:${column + 1} — U+${code.toString(16).toUpperCase().padStart(4, "0")}`)
        }
      })
    })
  }
  return found
}

test("ни одна цель печати не выводит двунаправленные управляющие сырыми", async (t) => {
  /* Программа обязана содержать весь набор: иначе цель, экранировавшая только
     часть, прошла бы проверку на остальных. */
  const вЛитерале = [...ожидаемое].filter((c) => BIDI_CONTROLS.includes(c.codePointAt(0)))
  assert.equal(вЛитерале.length, BIDI_CONTROLS.length, "в литерале обязаны быть все двенадцать управляющих")

  const targets = await emitTargets()
  for (const known of ИЗВЕСТНЫЕ) {
    assert.ok(targets.includes(known), `реестр целей потерял «${known}»: перебирать нечего, проверка не состоялась`)
  }

  for (const target of targets) {
    await t.test(`цель «${target}»`, async () => {
      const backend = await loadEmitter(target, targets)
      const files = emittedFiles(backend.emit(program, {}), target)

      const raw = rawControls(files)
      assert.deepEqual(
        raw,
        [],
        `цель «${target}» печатает двунаправленные управляющие сырыми:\n  ${raw.join("\n  ")}\n` +
          "Экранировать их обязан строковый литерал бэкенда — форма своя у каждого языка " +
          "(\\NNN побайтно в C, \\uXXXX в Java, C#, Go, Python и JS, \\u{X…} в Rust и Elixir)",
      )

      /* Отсутствие сырых символов само по себе ещё не победа: цель, потерявшая
         их при печати, тоже «чиста». Поэтому литерал ищется и разбирается
         обратно. */
      const bodies = literalBodies(files)
      assert.ok(bodies.length > 0, `цель «${target}» не напечатала литерал вовсе: якорь «${НАЧАЛО}» не найден`)
      for (const { path, body } of bodies) {
        assert.equal(
          `${НАЧАЛО}${decodeEscapes(body)}${КОНЕЦ}`,
          ожидаемое,
          `цель «${target}», файл ${path}: экранирование изменило значение литерала — ` +
            "байты и кодовые точки обязаны остаться теми же, что у интерпретатора",
        )
      }
    })
  }
})
