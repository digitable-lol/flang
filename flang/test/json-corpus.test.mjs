/**
 * Корпус json: 91 вход, из них 51 составлен нарочно против разбора.
 *
 * Файл `json-corpus.json` написан РАНЬШЕ `flang/stdlib/json.flang` и
 * задаёт, что считается верным ответом. Здесь он гоняется тем же
 * вычислителем, каким язык гоняет любую программу.
 *
 * Проверяется три вещи, и третья — главная:
 *   1. вход из «печать» разбирается и печатается указанной строкой;
 *   2. вход из «отказ» НЕ разбирается — молчание и есть верный ответ;
 *   3. разбор напечатанного даёт то же значение (тождество на ЗНАЧЕНИИ,
 *      не на тексте: почему не на тексте — в шапке «Напечатать строку json»).
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import test from "node:test"

import { valuesEqual } from "../src/builtins.mjs"
import { evaluate } from "../src/interpret.mjs"
import { parse } from "../src/parser.mjs"

const корпус = JSON.parse(readFileSync(fileURLToPath(new URL("./json-corpus.json", import.meta.url)), "utf8"))
const программа = parse(readFileSync(fileURLToPath(new URL("../stdlib/json.flang", import.meta.url)), "utf8"), "json.flang")

/** Раскрывает `@имя:N` — входы, которые в файл руками не выписать. */
function раскрыть(текст) {
  const м = /^@([а-яё-]+):(\d+)$/u.exec(текст)
  if (!м) return текст
  const [, имя, счёт] = м
  const н = Number(счёт)
  if (имя === "глубокий-массив" || имя === "глубокий-массив-ответ") return "[".repeat(н) + "]".repeat(н)
  if (имя === "глубокий-объект" || имя === "глубокий-объект-ответ") return '{"а":'.repeat(н) + "null" + "}".repeat(н)
  if (имя === "глубокий-обрыв") return "[".repeat(н)
  if (имя === "закрывашки") return "]".repeat(н)
  if (имя === "запятые") return ",".repeat(н)
  throw new Error(`неизвестный образец корпуса: ${имя}`)
}

const настройки = { maxSteps: 200_000_000, maxDepth: 100_000 }
const разобрать = (текст) => evaluate(программа, "Разобрать json", [текст], настройки)
const напечатать = (значение) => evaluate(программа, "Напечатать json", [значение], настройки)

test("корпус json: 91 вход, 51 злонамеренный", () => {
  assert.equal(корпус.входы.length, 91)
  assert.equal(корпус.входы.filter((в) => в.злой).length, 51)
})

for (const вход of корпус.входы) {
  test(`корпус json: ${вход.имя}`, () => {
    const текст = раскрыть(вход.текст)
    const итог = разобрать(текст)
    if (вход.ждём === "отказ") {
      assert.equal(итог.variant, "Не разобран json", `ждали отказа, а разбор дал значение: ${JSON.stringify(итог).slice(0, 200)}`)
      assert.ok(итог.fields.причина.length > 0, "у отказа обязана быть названная причина")
      return
    }
    assert.equal(итог.variant, "Разобран json", `ждали значения, а вышел отказ: ${итог.fields?.причина}`)
    const напечатанное = напечатать(итог.fields.значение)
    assert.equal(напечатанное, раскрыть(вход.ответ))
    /* Тождество на значении: разбор напечатанного даёт то же самое. */
    const снова = разобрать(напечатанное)
    assert.equal(снова.variant, "Разобран json")
    /* На тысяче уровней `valuesEqual` роняет стек НОДЫ, а не библиотеку:
       сравнение свидетеля рекурсивно по полям. Поэтому у глубоких входов
       тождество сверяется повторной печатью — она в языке и цикла не знает. */
    if (вход.текст.startsWith("@")) assert.equal(напечатать(снова.fields.значение), напечатанное)
    else assert.ok(valuesEqual(снова.fields.значение, итог.fields.значение), "разбор напечатанного дал другое значение")
  })
}
