/**
 * Свойство — постусловие, а не корректор.
 *
 * Это самое лёгкое место для тихого расхождения движков: соблазн «поправить»
 * результат до допустимого велик, и если бы JIT срезал результат до потолка,
 * а ядро бросало ошибку, тесты на обычных входах этого не заметили бы.
 * Поэтому нарушение проверяется отдельно и на всех трёх движках сразу:
 * одинаковый код, одинаковый текст, никакого «исправленного» значения.
 */
import assert from "node:assert/strict"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"

import { executeUtility } from "../../../dist/src/index.js"

import { compileUtility, errorCode, run } from "../src/index.mjs"
import { loadProgram } from "../src/load-fts.mjs"

const repo = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..")
const model = resolve(repo, "tools/ftsc/stdlib/supervision/supervision.fts")

const process0 = {
  "перезапусков за окно": 1,
  "лимит перезапусков": 3,
  "окно секунд": 5,
  "секунд с первого перезапуска": 1,
  критичный: true,
  "номер попытки": 1,
  "базовая задержка": 100,
  "потолок задержки": 5000,
}

function outcomes(program, moduleName, utilityName, input) {
  const document = program.modules.find((item) => item.name === moduleName).document
  const compiled = compileUtility(program, moduleName, utilityName)
  const probe = (call) => {
    try {
      return { kind: "value", value: call() }
    } catch (error) {
      return { kind: "error", code: errorCode(error), message: error.message }
    }
  }
  return {
    core: probe(() => executeUtility(document, utilityName, input)),
    interpreter: probe(() => run(program, moduleName, utilityName, input)),
    jit: probe(() => compiled(input)),
  }
}

test("нарушение свойства: одинаковая ошибка у ядра, интерпретатора и JIT", async () => {
  const program = await loadProgram([model], { project: "supervision" })

  // Отрицательная база выдержки — не выдумка ради теста, а реальный дефект
  // конфигурации: рантайм передал бы такое число, если бы кто-то вычел
  // из базы больше, чем в ней есть. Свойство «Задержка неотрицательна»
  // обязано это остановить, а не выдать отрицательную паузу.
  const negative = { ...process0, "базовая задержка": -100, "номер попытки": 1 }
  const violated = outcomes(program, "Надзор", "Рассчитать задержку перезапуска", negative)

  assert.equal(violated.core.kind, "error")
  assert.equal(violated.core.code, "FTS_UTILITY_PROPERTY")
  assert.equal(violated.core.message, "нарушено свойство «Задержка неотрицательна» утилиты «Рассчитать задержку перезапуска»")
  assert.deepEqual(violated.interpreter, violated.core)
  assert.deepEqual(violated.jit, violated.core)
})

test("нарушение свойства обнаруживается после всех правил, а не в момент правила", async () => {
  const program = await loadProgram([model], { project: "supervision" })

  // Потолок ниже базы: после правил выдержка равна потолку, и свойство
  // выполняется. Промежуточное значение (100) потолок превышало — но
  // свойство проверяется по итогу, и «сработавшее раньше времени» свойство
  // немедленно рассорило бы движки.
  const capped = { ...process0, "базовая задержка": 100, "потолок задержки": 50, "номер попытки": 3 }
  const result = outcomes(program, "Надзор", "Рассчитать задержку перезапуска", capped)
  assert.deepEqual(result.core, { kind: "value", value: 50 })
  assert.deepEqual(result.interpreter, result.core)
  assert.deepEqual(result.jit, result.core)
})

test("свойство не правит результат: допустимое значение проходит как есть", async () => {
  const program = await loadProgram([model], { project: "supervision" })
  const grid = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 20]
  const expected = [0, 100, 200, 400, 800, 1600, 3200, 5000, 5000, 5000, 5000]
  grid.forEach((attempt, index) => {
    const input = { ...process0, "номер попытки": attempt }
    const result = outcomes(program, "Надзор", "Рассчитать задержку перезапуска", input)
    assert.deepEqual(result.core, { kind: "value", value: expected[index] })
    assert.deepEqual(result.interpreter, result.core)
    assert.deepEqual(result.jit, result.core)
  })
})
