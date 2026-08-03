/**
 * Свойства источника случайности.
 *
 * Проверяется не «похоже на случайное», а ровно то, на чём стоит
 * воспроизводимость: одинаковое семя даёт одинаковую выдачу, разные имена
 * потоков дают разные выдачи, а расщепление не зависит от порядка.
 */
import assert from "node:assert/strict"
import { test } from "node:test"

import { createStream, normalizeSeed } from "../src/random.mjs"

const take = (stream, count) => Array.from({ length: count }, () => stream.nextUint64().toString(16))

test("одно семя — одна и та же выдача", () => {
  assert.deepEqual(take(createStream(42), 8), take(createStream(42), 8))
})

test("разные семена — разная выдача", () => {
  assert.notDeepEqual(take(createStream(42), 8), take(createStream(43), 8))
})

test("подпоток определяется именем, а не порядком расщепления", () => {
  const root = createStream(2024)
  // Слева сначала спрашиваем «б» и только потом «а», справа — сразу «а».
  // Если бы fork зависел от истории обращений, эти два «а» разошлись бы.
  root.fork("б")
  const left = root.fork("а")
  const right = createStream(2024).fork("а")
  assert.deepEqual(take(left, 4), take(right, 4))
})

test("подпоток не зависит от того, сколько чисел взял родитель", () => {
  const root = createStream(11)
  const before = take(root.fork("особь:3"), 4)
  for (let index = 0; index < 100; index += 1) root.nextUint64()
  assert.deepEqual(take(root.fork("особь:3"), 4), before)
})

test("разные имена дают независимые потоки", () => {
  const root = createStream(5)
  assert.notDeepEqual(take(root.fork("особь:1"), 6), take(root.fork("особь:2"), 6))
})

test("вложенные имена образуют путь", () => {
  const path = (generation) => createStream(9).fork(`поколение:${generation}`).fork("мутация")
  assert.deepEqual(take(path(3), 4), take(path(3), 4))
  assert.notDeepEqual(take(path(3), 4), take(path(4), 4))
})

test("nextInt не выходит за границы и покрывает их", () => {
  const stream = createStream(77).fork("целые")
  const seen = new Set()
  for (let index = 0; index < 5000; index += 1) {
    const value = stream.nextInt(-3, 4)
    assert.ok(Number.isInteger(value) && value >= -3 && value <= 4, `вышли за границы: ${value}`)
    seen.add(value)
  }
  assert.equal(seen.size, 8, "не все значения диапазона встретились")
})

test("nextInt на вырожденном диапазоне возвращает единственное значение", () => {
  const stream = createStream(1).fork("точка")
  assert.equal(stream.nextInt(7, 7), 7)
})

test("nextFloat лежит в [0, 1)", () => {
  const stream = createStream(3).fork("равномерное")
  let sum = 0
  for (let index = 0; index < 20000; index += 1) {
    const value = stream.nextFloat()
    assert.ok(value >= 0 && value < 1)
    sum += value
  }
  assert.ok(Math.abs(sum / 20000 - 0.5) < 0.02, "среднее равномерного далеко от 0.5")
})

test("nextGaussian даёт нулевое среднее и единичную дисперсию", () => {
  const stream = createStream(4).fork("нормаль")
  let sum = 0
  let squares = 0
  const count = 20000
  for (let index = 0; index < count; index += 1) {
    const value = stream.nextGaussian()
    sum += value
    squares += value * value
  }
  assert.ok(Math.abs(sum / count) < 0.05, "среднее нормали далеко от нуля")
  assert.ok(Math.abs(squares / count - 1) < 0.05, "дисперсия нормали далека от единицы")
})

test("семя приводится к 64 битам и принимает строку", () => {
  assert.equal(normalizeSeed(-1), (1n << 64n) - 1n)
  assert.equal(typeof normalizeSeed("прогон"), "bigint")
  assert.throws(() => normalizeSeed(1.5), /целым/u)
})
