/**
 * Оркестрация проверок корпуса.
 *
 * Порядок неслучаен: сначала то, что делает корпус нечитаемым (устаревшая
 * память, ошибки связывания), потом смысловые проверки. Если корпус не
 * собирается, рассуждать о противоречиях между требованиями бессмысленно.
 */
import { testUtilities } from "../../../dist/src/index.js"

import { checkMemory, codes, loadCorpus } from "./corpus.mjs"
import { checkConflicts } from "./conflicts.mjs"
import { checkConstitution } from "./constitution.mjs"
import { checkCoverage } from "./coverage.mjs"

const ORDER = [codes.memoryStale, codes.ruleConflict, codes.constitution, codes.uncovered, codes.ruleDuplicate]

/** Детерминированный порядок: сначала по коду, внутри кода — по пути и тексту. */
export function sortDiagnostics(diagnostics) {
  return diagnostics.slice().sort((a, b) => {
    const byCode = (ORDER.indexOf(a.code) + 1 || 99) - (ORDER.indexOf(b.code) + 1 || 99)
    if (byCode) return byCode
    if (a.code !== b.code) return a.code < b.code ? -1 : 1
    const byPath = String(a.path ?? "").localeCompare(String(b.path ?? ""))
    return byPath || a.message.localeCompare(b.message)
  })
}

const hasErrors = (diagnostics) => diagnostics.some((diagnostic) => diagnostic.severity === "error")

function exampleReport(corpus) {
  const results = []
  for (const module of corpus.modules) {
    if (!(module.document.utilities ?? []).length) continue
    try {
      const outcome = testUtilities(module.document)
      results.push({ source: module.source, total: outcome.total, passed: outcome.passed, failed: outcome.failed })
    } catch (error) {
      results.push({ source: module.source, total: 0, passed: 0, failed: 0, note: error.message })
    }
  }
  return results
}

/**
 * Полная проверка корпуса.
 *
 * @param {string} directory корень корпуса
 * @returns {Promise<object>} отчёт: `{ ok, diagnostics, corpus, summary }`
 */
export async function check(directory, { project = "корпус", step = 1 } = {}) {
  const stale = await checkMemory(directory)
  if (stale.length) {
    return {
      ok: false,
      project,
      corpus: null,
      diagnostics: sortDiagnostics(stale),
      summary: { stage: "память проекта" },
    }
  }

  const corpus = await loadCorpus(directory, { project })
  if (corpus.linkDiagnostics.length) {
    return {
      ok: false,
      project,
      corpus: describe(corpus),
      diagnostics: sortDiagnostics(corpus.linkDiagnostics),
      summary: { stage: "связывание (ftsc link)" },
    }
  }

  const conflicts = checkConflicts(corpus)
  const constitution = checkConstitution(corpus, { step })
  const coverage = checkCoverage(corpus)

  const diagnostics = sortDiagnostics([...conflicts.diagnostics, ...constitution.diagnostics, ...coverage.diagnostics])

  return {
    ok: !hasErrors(diagnostics),
    project,
    corpus: describe(corpus),
    diagnostics,
    summary: {
      stage: "полная проверка",
      specs: corpus.specs.length,
      constitution: corpus.constitution ? corpus.constitution.source : null,
      invariants: constitution.stats.invariants,
      gridPoints: constitution.stats.points,
      gridTruncated: constitution.stats.truncated,
      rules: coverage.stats.rules,
      rulesCovered: coverage.stats.covered,
      skippedPairs: conflicts.skipped.length,
      examples: exampleReport(corpus),
    },
  }
}

function describe(corpus) {
  return {
    root: corpus.root,
    constitution: corpus.constitution?.source ?? null,
    specs: corpus.specs.map((spec) => ({ id: spec.specId, source: spec.source, category: spec.category })),
    memory: corpus.memory.map((module) => ({ source: module.source, category: module.category })),
    functors: corpus.functors.map((functor) => `${functor.from} → ${functor.to} (${functor.name})`),
  }
}

/**
 * Допуск одной спеки: те же проверки, но в ответе остаются только диагностики,
 * в которых участвует сама спека.
 *
 * Так и работает приёмка требования: корпус может годами жить с известным
 * техдолгом, и это не повод отклонять НОВОЕ требование, если оно ничего не
 * ломает. Отклоняем только за то, что принесла именно эта спека.
 */
export async function admit(directory, specId, options = {}) {
  const full = await check(directory, options)
  const known = new Set((full.corpus?.specs ?? []).map((spec) => spec.id))

  if (full.corpus && !known.has(specId)) {
    const guess = [...known].find((id) => id.includes(specId) || specId.includes(id))
    if (!guess) {
      return {
        ...full,
        admit: specId,
        accepted: false,
        diagnostics: [
          {
            code: codes.specUnknown,
            message: `в корпусе нет спеки «${specId}»; есть: ${[...known].join(", ") || "—"}`,
            severity: "error",
            path: directory,
            specs: [specId],
          },
        ],
      }
    }
    specId = guess
  }

  const involved = full.diagnostics.filter((diagnostic) => (diagnostic.specs ?? []).includes(specId))
  return {
    ...full,
    admit: specId,
    accepted: full.corpus !== null && !hasErrors(involved),
    ok: full.corpus !== null && !hasErrors(involved),
    diagnostics: involved,
    others: full.diagnostics.length - involved.length,
  }
}

/** Нормализация `--spec specs/003-x` или `003-x` в идентификатор спеки. */
export function normalizeSpecId(value) {
  const parts = String(value).replace(/\/+$/u, "").split("/")
  if (parts[0] === "specs" || parts[0] === "спеки") parts.shift()
  return parts[0] ?? String(value)
}
