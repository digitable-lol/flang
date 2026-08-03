/**
 * Бенчмарк должен запускаться и возвращать числа.
 *
 * Здесь сознательно нет утверждений вида «JIT быстрее в N раз»: скорость
 * зависит от машины, версии V8 и соседей по процессору, и тест, требующий
 * конкретного ускорения, был бы не проверкой, а генератором ложных падений.
 * Проверяется то, что от бенчмарка действительно требуется: он отрабатывает,
 * меряет все три движка и выдаёт конечные положительные числа — а ещё что
 * контрольные суммы движков совпали, то есть мерили одно и то же вычисление.
 */
import assert from "node:assert/strict"
import { test } from "node:test"

import { runBenchmark } from "../bench.mjs"

test("бенчмарк запускается и возвращает числа", async () => {
  // Маленькие батчи и мало повторов: тесту нужна работоспособность
  // харнесса, а не точность измерения.
  const report = await runBenchmark({ scales: [200], repeats: () => 3 })

  assert.equal(report.schema, "ftsvm-benchmark/1")
  assert.ok(report.results.length > 0)

  const engines = new Set(report.results.map((row) => row.engine))
  assert.deepEqual([...engines].sort(), ["JIT", "интерпретатор", "ядро"])

  for (const row of report.results) {
    assert.ok(Number.isFinite(row.median_batch_ms) && row.median_batch_ms > 0, `медиана: ${row.median_batch_ms}`)
    assert.ok(Number.isFinite(row.ns_per_call) && row.ns_per_call > 0, `нс/вызов: ${row.ns_per_call}`)
    assert.ok(Number.isInteger(row.ops_per_second) && row.ops_per_second > 0, `опс/с: ${row.ops_per_second}`)
    assert.equal(row.calls, 200)
  }

  for (const row of report.speedups) {
    assert.equal(row.checksums_equal, true, `движки посчитали разное: ${row.scenario}`)
    assert.ok(Number.isFinite(row.jit_vs_core) && row.jit_vs_core > 0)
    assert.ok(Number.isFinite(row.jit_vs_interpreter) && row.jit_vs_interpreter > 0)
    assert.ok(Number.isFinite(row.interpreter_vs_core) && row.interpreter_vs_core > 0)
  }

  for (const row of report.compilation) {
    assert.ok(Number.isFinite(row.median_us) && row.median_us > 0, `мкс/компиляцию: ${row.median_us}`)
    assert.ok(row.generated_bytes > 0)
  }
})
