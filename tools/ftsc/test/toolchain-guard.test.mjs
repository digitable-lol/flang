/**
 * Тесты сторожа пропусков.
 *
 * На этот механизм опираются все восемь бэкенд-тестов: он один решает, чем
 * обернётся отсутствие компилятора — честным пропуском или падением. Ошибка
 * здесь вернула бы ровно ту болезнь, ради которой сторож и написан: зелёный
 * набор, который ничего не проверил. Поэтому механизм проверяется отдельно и
 * без единого настоящего тулчейна.
 */
import test from "node:test"
import assert from "node:assert/strict"

import { missingToolchain, requiredToolchains, toolchainRequired } from "./toolchain-guard.mjs"

/** Прогоняет тело при заданном значении переменной и возвращает окружение назад. */
function withEnv(value, body) {
  const saved = process.env.FTS_REQUIRE_TOOLCHAINS
  if (value === null) delete process.env.FTS_REQUIRE_TOOLCHAINS
  else process.env.FTS_REQUIRE_TOOLCHAINS = value
  try {
    return body()
  } finally {
    if (saved === undefined) delete process.env.FTS_REQUIRE_TOOLCHAINS
    else process.env.FTS_REQUIRE_TOOLCHAINS = saved
  }
}

/** Двойник контекста node:test: запоминает, звали ли skip и с чем. */
function fakeContext() {
  const calls = []
  return { calls, skip: (reason) => calls.push(reason) }
}

test("переменная не задана — прежнее поведение: пропуск, а не падение", () => {
  withEnv(null, () => {
    assert.deepEqual(requiredToolchains(), [])
    assert.equal(toolchainRequired("rust"), false)
    const context = fakeContext()
    missingToolchain(context, "rust", "rustc не найден")
    assert.deepEqual(context.calls, ["rustc не найден"])
  })
})

test("FTS_REQUIRE_TOOLCHAINS=1 делает обязательными все бэкенды", () => {
  withEnv("1", () => {
    for (const id of ["c", "csharp", "elixir", "go", "java", "python", "rust", "typescript"]) {
      assert.equal(toolchainRequired(id), true, `${id} обязан считаться требуемым`)
      const context = fakeContext()
      assert.throws(() => missingToolchain(context, id, "тулчейна нет"), new RegExp(`тулчейн «${id}»`, "u"))
      assert.deepEqual(context.calls, [], `${id}: пропуск вместо падения`)
    }
  })
})

test("список требует ровно перечисленное: чужой отсутствующий тулчейн джобу не красит", () => {
  withEnv("rust, go", () => {
    assert.deepEqual(requiredToolchains(), ["rust", "go"])
    assert.equal(toolchainRequired("rust"), true)
    assert.equal(toolchainRequired("go"), true)
    assert.equal(toolchainRequired("elixir"), false)

    assert.throws(() => missingToolchain(fakeContext(), "go", "go не найден"), /тулчейн «go»/u)

    const context = fakeContext()
    missingToolchain(context, "elixir", "elixir не найден")
    assert.deepEqual(context.calls, ["elixir не найден"])
  })
})

test("сообщение об ошибке называет язык, причину и способ починки", () => {
  withEnv("elixir", () => {
    assert.throws(
      () => missingToolchain(fakeContext(), "elixir", "тулчейн Elixir не найден — пропуск"),
      (error) => {
        assert.match(error.message, /тулчейн «elixir» обязан быть в этой джобе/u)
        assert.match(error.message, /FTS_REQUIRE_TOOLCHAINS=elixir/u)
        assert.match(error.message, /тулчейн Elixir не найден — пропуск/u)
        assert.match(error.message, /FTS_TOOLCHAIN_PATH/u)
        return true
      },
    )
  })
})

test("регистр и лишние пробелы значения не меняют смысла", () => {
  withEnv("  Rust ,, GO  ", () => {
    assert.deepEqual(requiredToolchains(), ["rust", "go"])
    assert.equal(toolchainRequired("Rust"), true)
    assert.equal(toolchainRequired("java"), false)
  })
})
