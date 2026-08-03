/**
 * Модульные случаи интервального анализа.
 *
 * Проверяется ровно то, на чём стоит вся проверка конфликтов: пересечение
 * условий вычисляется точно, а не «примерно». Поэтому здесь есть и открытые
 * границы, и выколотые точки, и признаки, и поля без ограничений.
 */
import assert from "node:assert/strict"
import { test } from "node:test"

import { BOOLEAN, NUMBER, STRING, solveConditions, solveField } from "../src/intervals.mjs"

const value = (raw) => ({ kind: "value", value: raw })
const at = (field, operator, raw) => ({ field, operator, value: value(raw) })
const kinds = (entries) => new Map(Object.entries(entries))

test("числовое поле: два нижних порога дают более сильный из них", () => {
  const solved = solveField(NUMBER, [
    { operator: "gte", value: 500 },
    { operator: "gte", value: 1000 },
  ])
  assert.equal(solved.empty, false)
  assert.equal(solved.sample, 1000)
  assert.match(solved.text, /\[1000, \+∞\)/u)
})

test("числовое поле: нижний порог выше верхнего — пересечение пусто", () => {
  const solved = solveField(NUMBER, [
    { operator: "gte", value: 1000 },
    { operator: "lte", value: 500 },
  ])
  assert.equal(solved.empty, true)
  assert.match(solved.reason, /пустой интервал/u)
})

test("числовое поле: строгие границы сходятся в точку и потому пусты", () => {
  const solved = solveField(NUMBER, [
    { operator: "gt", value: 5 },
    { operator: "lt", value: 5 },
  ])
  assert.equal(solved.empty, true)
})

test("числовое поле: строгое и нестрогое сравнение с одним числом оставляют границу открытой", () => {
  const solved = solveField(NUMBER, [
    { operator: "gt", value: 5 },
    { operator: "gte", value: 5 },
  ])
  assert.equal(solved.empty, false)
  assert.ok(solved.sample > 5, `представитель ${solved.sample} обязан быть строго больше 5`)
  assert.match(solved.text, /\(5, \+∞\)/u)
})

test("числовое поле: замкнутый отрезок из одной точки непуст", () => {
  const solved = solveField(NUMBER, [
    { operator: "gte", value: 5 },
    { operator: "lte", value: 5 },
  ])
  assert.equal(solved.empty, false)
  assert.equal(solved.sample, 5)
})

test("числовое поле: открытая граница против замкнутой в той же точке — пусто", () => {
  const solved = solveField(NUMBER, [
    { operator: "gt", value: 5 },
    { operator: "lte", value: 5 },
  ])
  assert.equal(solved.empty, true)
})

test("числовое поле: равенство вне интервала — пусто", () => {
  const solved = solveField(NUMBER, [
    { operator: "eq", value: 0 },
    { operator: "gte", value: 500 },
  ])
  assert.equal(solved.empty, true)
  assert.match(solved.reason, /вне/u)
})

test("числовое поле: равенство внутри интервала даёт именно это значение", () => {
  const solved = solveField(NUMBER, [
    { operator: "gte", value: 1 },
    { operator: "lte", value: 10 },
    { operator: "eq", value: 5 },
  ])
  assert.equal(solved.empty, false)
  assert.equal(solved.sample, 5)
})

test("числовое поле: равенство и неравенство с одним числом — пусто", () => {
  const solved = solveField(NUMBER, [
    { operator: "eq", value: 7 },
    { operator: "neq", value: 7 },
  ])
  assert.equal(solved.empty, true)
})

test("числовое поле: выколотые концы отрезка не делают его пустым", () => {
  const solved = solveField(NUMBER, [
    { operator: "gte", value: 0 },
    { operator: "lte", value: 10 },
    { operator: "neq", value: 0 },
    { operator: "neq", value: 10 },
  ])
  assert.equal(solved.empty, false)
  assert.ok(solved.sample > 0 && solved.sample < 10, `представитель ${solved.sample} обязан лежать строго внутри`)
  assert.match(solved.text, /кроме/u)
})

test("числовое поле: единственная точка отрезка выколота — пусто", () => {
  const solved = solveField(NUMBER, [
    { operator: "gte", value: 5 },
    { operator: "lte", value: 5 },
    { operator: "neq", value: 5 },
  ])
  assert.equal(solved.empty, true)
  assert.match(solved.reason, /исключено/u)
})

test("числовое поле: два разных равенства — пусто", () => {
  const solved = solveField(NUMBER, [
    { operator: "eq", value: 1 },
    { operator: "eq", value: 2 },
  ])
  assert.equal(solved.empty, true)
})

test("признак: да и нет одновременно — пусто", () => {
  const solved = solveField(BOOLEAN, [
    { operator: "eq", value: true },
    { operator: "eq", value: false },
  ])
  assert.equal(solved.empty, true)
})

test("признак: исключены оба значения — пусто", () => {
  const solved = solveField(BOOLEAN, [
    { operator: "neq", value: true },
    { operator: "neq", value: false },
  ])
  assert.equal(solved.empty, true)
})

test("признак: исключено одно значение — остаётся второе", () => {
  const solved = solveField(BOOLEAN, [{ operator: "neq", value: false }])
  assert.equal(solved.empty, false)
  assert.equal(solved.sample, true)
})

test("признак: порядковое сравнение невыполнимо ни на каком входе", () => {
  const solved = solveField(BOOLEAN, [{ operator: "gte", value: 1 }])
  assert.equal(solved.empty, true)
  assert.match(solved.reason, /сравнение порядка/u)
})

test("числовое поле: равенство признаку не бывает", () => {
  const solved = solveField(NUMBER, [{ operator: "eq", value: true }])
  assert.equal(solved.empty, true)
})

test("строка: конечный список запретов множество не исчерпывает", () => {
  const solved = solveField(STRING, [
    { operator: "neq", value: "" },
    { operator: "neq", value: "значение" },
  ])
  assert.equal(solved.empty, false)
  assert.ok(!["", "значение"].includes(solved.sample))
})

test("строка: два разных равенства — пусто", () => {
  const solved = solveField(STRING, [
    { operator: "eq", value: "а" },
    { operator: "eq", value: "б" },
  ])
  assert.equal(solved.empty, true)
})

test("поле без ограничений в пересечение не входит и его не сужает", () => {
  const solved = solveConditions([at("сумма", "gte", 1000)], kinds({ сумма: NUMBER, скидка: NUMBER }))
  assert.equal(solved.empty, false)
  assert.deepEqual(Object.keys(solved.witness), ["сумма"])
  assert.equal(solved.fields.has("скидка"), false)
})

test("разные поля независимы: пересечение непусто, свидетель заполняет оба", () => {
  const solved = solveConditions(
    [at("сумма", "gte", 1000), at("постоянный", "eq", true), at("сумма", "lte", 5000)],
    kinds({ сумма: NUMBER, постоянный: BOOLEAN }),
  )
  assert.equal(solved.empty, false)
  assert.equal(solved.witness.постоянный, true)
  assert.ok(solved.witness.сумма >= 1000 && solved.witness.сумма <= 5000)
})

test("противоречие по одному полю делает пустой всю конъюнкцию", () => {
  const solved = solveConditions(
    [at("сумма", "gte", 1000), at("постоянный", "eq", true), at("постоянный", "eq", false)],
    kinds({ сумма: NUMBER, постоянный: BOOLEAN }),
  )
  assert.equal(solved.empty, true)
  assert.equal(solved.field, "постоянный")
})

test("сравнение поля не с константой честно помечается как непроанализированное", () => {
  const solved = solveConditions(
    [{ field: "скидка", operator: "gt", value: { kind: "percent", percent: 30, field: "сумма" } }],
    kinds({ скидка: NUMBER, сумма: NUMBER }),
  )
  assert.equal(solved.analyzable, false)
  assert.equal(solved.field, "скидка")
})
