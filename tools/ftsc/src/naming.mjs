/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Имена FTS → идентификаторы целевых языков.
 *
 * В моделях имена кириллические и с пробелами: «Рассчитать скидку», «сумма без
 * НДС». Ни один из целевых языков такого не примет, а восемь бэкендов не должны
 * изобретать восемь разных транслитераций — иначе один и тот же объект в C и в
 * Rust назовётся по-разному, и сгенерированный код перестанет читаться как одна
 * система.
 *
 * Коллизия после транслитерации — ошибка сборки, а не молчаливое переименование:
 * «счёт» и «счет» обязаны остаться различимыми для человека, который читает
 * сгенерированный код рядом с моделью.
 */

const CYRILLIC = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "yo",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "c",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
}

export function transliterate(value) {
  let result = ""
  for (const character of String(value).normalize("NFC")) {
    const lower = character.toLowerCase()
    const mapped = CYRILLIC[lower]
    if (mapped === undefined) {
      result += character
      continue
    }
    /* Заглавная кириллическая буква остаётся заглавной: «НДС» → «NDS», а не «nds». */
    result += character === lower ? mapped : mapped.charAt(0).toUpperCase() + mapped.slice(1)
  }
  return result
}

const words = (value) =>
  transliterate(value)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)

export function snake(value) {
  return (
    words(value)
      .map((word) => word.toLowerCase())
      .join("_") || "value"
  )
}

export function pascal(value) {
  return (
    words(value)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join("") || "Value"
  )
}

export function camel(value) {
  const name = pascal(value)
  return name.charAt(0).toLowerCase() + name.slice(1)
}

export function screaming(value) {
  return snake(value).toUpperCase()
}

/**
 * Именователь с защитой от коллизий: помнит выданные идентификаторы и бросает
 * ошибку, если два разных имени модели дали один и тот же идентификатор.
 */
export function createNamer(style, reserved = []) {
  const taken = new Map(reserved.map((word) => [word, `зарезервировано в целевом языке: ${word}`]))
  return (value) => {
    const identifier = style(value)
    const previous = taken.get(identifier)
    if (previous !== undefined && previous !== value) {
      throw new Error(
        `имена «${value}» и «${previous}» дают один идентификатор «${identifier}» — переименуйте одно из них в модели`,
      )
    }
    taken.set(identifier, value)
    return identifier
  }
}

/** Экранирование строки FTS для литерала в C-подобных языках. */
export function quote(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`
}
