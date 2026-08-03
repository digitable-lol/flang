/**
 * Модели надзора: компилируются, проходят проверку, их примеры сходятся —
 * и исполняются исполнителем ftsvm.
 *
 * Вторая половина файла — связка (часть 3 задания): факты о процессе
 * попадают в модель, модель возвращает решение, рантайм по решению делает
 * (или не делает) перезапуск. Самого перезапуска здесь нет и быть не может:
 * это эффект, он снаружи. Тест показывает границу — до неё чистое решение,
 * после неё журнал действий рантайма, записанный тестовым дублёром.
 */
import assert from "node:assert/strict"
import { readdir } from "node:fs/promises"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"

import { testUtilities, validate } from "../../../dist/src/index.js"

import { compileUtility, run } from "../src/index.mjs"
import { loadProgram } from "../src/load-fts.mjs"

const repo = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..")
const stdlib = resolve(repo, "tools/ftsc/stdlib/supervision")

async function supervisionFiles() {
  const entries = await readdir(stdlib)
  return entries
    .filter((name) => name.endsWith(".fts"))
    .sort()
    .map((name) => resolve(stdlib, name))
}

/* Коды решения. Строк как данных в языке нет, поэтому решение — число;
   расшифровка живёт здесь, в рантайме, и это честная цена ограничения. */
const ПЕРЕЗАПУСТИТЬ = 0
const ЭСКАЛИРОВАТЬ = 1
const НЕ_ПЕРЕЗАПУСКАТЬ = 2

const процесс = {
  "перезапусков за окно": 1,
  "лимит перезапусков": 3,
  "окно секунд": 5,
  "секунд с первого перезапуска": 1,
  критичный: true,
  "номер попытки": 1,
  "базовая задержка": 100,
  "потолок задержки": 5000,
}

test("модели supervision компилируются и проходят проверку ядра", async () => {
  const files = await supervisionFiles()
  assert.ok(files.length > 0, "в stdlib/supervision должна быть хотя бы одна модель")
  const program = await loadProgram(files, { project: "supervision" })
  for (const module of program.modules) {
    const report = validate(module.document)
    assert.equal(report.valid, true, JSON.stringify(report.diagnostics))
  }
})

test("примеры моделей supervision сходятся", async () => {
  const files = await supervisionFiles()
  const program = await loadProgram(files, { project: "supervision" })
  for (const module of program.modules) {
    const report = testUtilities(module.document)
    assert.equal(report.valid, true, JSON.stringify(report.results.filter((item) => !item.passed)))
    assert.ok(report.total >= 9, `ожидалось не меньше трёх примеров на каждую из трёх утилит, есть ${report.total}`)
  }
})

test("примеры моделей supervision сходятся и при исполнении ftsvm", async () => {
  const files = await supervisionFiles()
  const program = await loadProgram(files, { project: "supervision" })
  // Примеры — тесты модели. Ядро их уже прогнало; здесь их прогоняют
  // интерпретатор и JIT: примеры обязаны сходиться на любом исполнителе,
  // иначе «проверено» означало бы «проверено только одним движком».
  let checked = 0
  for (const module of program.modules) {
    for (const utility of module.document.utilities ?? []) {
      const compiled = compileUtility(program, module.name, utility.name)
      for (const example of utility.examples) {
        assert.equal(run(program, module.name, utility.name, example.input), example.expected, `${utility.name}: ${example.name}`)
        assert.equal(compiled(example.input), example.expected, `${utility.name}: ${example.name}`)
        checked += 1
      }
    }
  }
  assert.equal(checked, 11)
})

test("связка: факты о процессе → решение → действие рантайма", async () => {
  const files = await supervisionFiles()
  const program = await loadProgram(files, { project: "supervision" })

  const решить = compileUtility(program, "Надзор", "Решить о перезапуске")
  const задержка = compileUtility(program, "Надзор", "Рассчитать задержку перезапуска")
  const бюджет = compileUtility(program, "Надзор", "Оценить бюджет рестартов")

  /**
   * Тестовый дублёр рантайма. Он не перезапускает и не спит: он записывает,
   * что СЛЕДУЕТ сделать. Настоящий рантайм в этом месте вызвал бы
   * spawn/kill и setTimeout — эффекты, которых в FTS нет и не будет.
   */
  const журнал = []
  const надзор = (факты) => {
    const решение = решить(факты)
    if (решение === ПЕРЕЗАПУСТИТЬ) {
      журнал.push({ действие: "перезапустить", "через мс": задержка(факты) })
      return
    }
    if (решение === ЭСКАЛИРОВАТЬ) {
      журнал.push({ действие: "эскалировать", "бюджет исчерпан": бюджет(факты) })
      return
    }
    журнал.push({ действие: "оставить остановленным" })
  }

  надзор({ ...процесс, "перезапусков за окно": 1, "номер попытки": 1 })
  надзор({ ...процесс, "перезапусков за окно": 2, "номер попытки": 4, "секунд с первого перезапуска": 3 })
  надзор({ ...процесс, "перезапусков за окно": 4, "номер попытки": 5, "секунд с первого перезапуска": 4 })
  надзор({ ...процесс, "перезапусков за окно": 4, "номер попытки": 5, "секунд с первого перезапуска": 4, критичный: false })
  надзор({ ...процесс, "перезапусков за окно": 9, "номер попытки": 9, "секунд с первого перезапуска": 600 })

  assert.deepEqual(журнал, [
    { действие: "перезапустить", "через мс": 100 },
    { действие: "перезапустить", "через мс": 800 },
    { действие: "эскалировать", "бюджет исчерпан": true },
    { действие: "оставить остановленным" },
    { действие: "перезапустить", "через мс": 5000 },
  ])

  // Решение обязано совпадать у интерпретатора и JIT: политику надёжности
  // нельзя исполнять двумя способами с разными исходами.
  for (const запись of журнал) assert.ok(запись.действие)
  const факты = { ...процесс, "перезапусков за окно": 4, "секунд с первого перезапуска": 4 }
  assert.equal(run(program, "Надзор", "Решить о перезапуске", факты), ЭСКАЛИРОВАТЬ)
  assert.equal(решить(факты), ЭСКАЛИРОВАТЬ)
  assert.equal(run(program, "Надзор", "Решить о перезапуске", { ...факты, критичный: false }), НЕ_ПЕРЕЗАПУСКАТЬ)
})

test("решение всегда в известном множестве кодов", async () => {
  const files = await supervisionFiles()
  const program = await loadProgram(files, { project: "supervision" })
  const решить = compileUtility(program, "Надзор", "Решить о перезапуске")
  // Сетка по фактам, от которых решение зависит: свойства модели
  // («решение неотрицательно», «решение из известного множества»)
  // не должны нарушаться ни на одном сочетании.
  for (const перезапусков of [0, 1, 3, 4, 9]) {
    for (const лимит of [0, 3, 10]) {
      for (const секунд of [0, 5, 6, 600]) {
        for (const критичный of [true, false]) {
          const факты = {
            ...процесс,
            "перезапусков за окно": перезапусков,
            "лимит перезапусков": лимит,
            "секунд с первого перезапуска": секунд,
            критичный,
          }
          const решение = решить(факты)
          assert.ok([ПЕРЕЗАПУСТИТЬ, ЭСКАЛИРОВАТЬ, НЕ_ПЕРЕЗАПУСКАТЬ].includes(решение), `${решение}`)
          assert.equal(run(program, "Надзор", "Решить о перезапуске", факты), решение)
        }
      }
    }
  }
})
