/**
 * Чем проверяют, что двунаправленные управляющие не уехали в целевой код сырыми.
 *
 * Помощник общий на оба компилятора репозитория: правило одно — «ни один
 * бэкенд не печатает двунаправленные управляющие сырыми», — и способ его
 * проверить тоже обязан быть один. Пользуются им два общих теста:
 * flang/test/emit-bidi.test.mjs (восемь целей flang) и
 * tools/ftsc/test/emit-bidi.test.mjs (восемь целей ftsc). Программу и источник
 * истины каждый из них приносит свои — общий здесь только инструмент.
 * (Тем же способом тесты flang уже берут отсюда toolchain-guard.mjs.)
 *
 * Набор кодовых точек здесь СВОЙ, а не импортированный из src/bidi.mjs, и это
 * принципиально: тест обязан утверждать правило независимо от того, как оно
 * реализовано. Импортируй он набор у проверяемого кода — кодовая точка,
 * выпавшая из набора, исчезла бы разом и из бэкендов, и из проверки, и оба
 * согласованно молчали бы.
 *
 * Сырых двунаправленных в этом файле нет: набор задан кодами, а не символами.
 */
import assert from "node:assert/strict"

/**
 * Двенадцать управляющих: ALM из арабского блока, восемь из блока
 * U+2000…U+207F и четыре изолята. Тот же набор перечислен в CVE-2021-42574 и в
 * диагностиках rustc, gcc и elixirc.
 */
export const BIDI_CONTROLS = [0x061c, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069]

/** Те же двенадцать подряд как строка — полезная нагрузка проверяемых программ. */
export const УПРАВЛЯЮЩИЕ = BIDI_CONTROLS.map((code) => String.fromCodePoint(code)).join("")

const назвать = (code) => `U+${code.toString(16).toUpperCase().padStart(4, "0")}`

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
export function decodeEscapes(text) {
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

/**
 * Сырые двунаправленные во всём выводе бэкенда — с координатами.
 *
 * Смотрится ВЕСЬ файл, а не найденный в нём литерал: имя FTS уезжает ещё и в
 * комментарии (шапка файла, документация функции, подпись правила), а
 * комментарий не исполняется — его читают первым и проверить исполнением не
 * могут. Имя файла проверяется наравне с содержимым: путь с управляющим — тот
 * же обман, только в списке файлов, и экранировать его нельзя (компилятор и
 * Makefile ждут имя дословно), значит замечен он обязан быть здесь.
 */
export function rawControls(files) {
  const found = []
  for (const file of files) {
    for (const character of file.path) {
      const code = character.codePointAt(0)
      if (BIDI_CONTROLS.includes(code)) found.push(`${file.path} (ИМЯ ФАЙЛА) — ${назвать(code)}`)
    }
    file.content.split("\n").forEach((line, index) => {
      ;[...line].forEach((character, column) => {
        const code = character.codePointAt(0)
        if (BIDI_CONTROLS.includes(code)) found.push(`${file.path}:${index + 1}:${column + 1} — ${назвать(code)}`)
      })
    })
  }
  return found
}

/**
 * Все вхождения текста между парой якорей — по всем напечатанным файлам.
 *
 * Якоря нужны, потому что отсутствие сырых символов само по себе ещё не победа:
 * цель, потерявшая их при печати, тоже «чиста». По якорям тело находится в
 * файле без знания целевого языка, разбирается обратно и сверяется с
 * источником истины.
 */
export function bodiesBetween(files, открывающий, закрывающий) {
  const found = []
  for (const file of files) {
    let from = 0
    for (;;) {
      const start = file.content.indexOf(открывающий, from)
      if (start === -1) break
      const end = file.content.indexOf(закрывающий, start + открывающий.length)
      assert.notEqual(end, -1, `${file.path}: якорь «${открывающий}» открыт и не закрыт якорем «${закрывающий}»`)
      found.push({ path: file.path, body: file.content.slice(start + открывающий.length, end) })
      from = end + закрывающий.length
    }
  }
  return found
}

/** Файлы бэкенда: и `{ files }`, и голый список — обе формы в репозитории есть. */
export function emittedFiles(emitted, target) {
  const files = Array.isArray(emitted) ? emitted : emitted?.files
  assert.ok(
    Array.isArray(files) && files.every((file) => typeof file?.path === "string" && typeof file?.content === "string"),
    `бэкенд «${target}» вернул не список файлов {path, content}`,
  )
  return files
}
