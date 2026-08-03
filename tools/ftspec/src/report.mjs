/**
 * Человекочитаемый отчёт.
 *
 * Отдельный файл, потому что формат отчёта — вопрос читателя, а не проверки.
 * Проверка всегда возвращает одну и ту же структуру; markdown — лишь её вид.
 */
const SEVERITY = { error: "ошибка", warning: "предупреждение", info: "заметка" }

const TITLES = {
  FTSPEC_RULE_CONFLICT: "Конфликты правил",
  FTSPEC_CONSTITUTION: "Нарушения конституции",
  FTSPEC_RULE_DUPLICATE: "Дублирование правил",
  FTSPEC_UNCOVERED: "Разрывы покрытия",
  FTSPEC_MEMORY_STALE: "Осиротевшие решения",
}

export function markdown(result) {
  const lines = []
  const title = result.admit ? `Допуск спеки «${result.admit}»` : `Проверка корпуса «${result.project}»`
  lines.push(`# ${title}`, "")

  const verdict = result.admit
    ? result.accepted
      ? "**Принято.** Требование не конфликтует с корпусом."
      : "**Отклонено.** Требование конфликтует с корпусом."
    : result.ok
      ? "**Корпус согласован.** Блокирующих конфликтов нет."
      : "**Корпус несогласован.** Есть блокирующие конфликты."
  lines.push(verdict, "")

  if (result.corpus) {
    lines.push("## Корпус", "")
    lines.push(`- конституция: ${result.corpus.constitution ?? "— (не найдена)"}`)
    lines.push(`- спеки: ${result.corpus.specs.map((spec) => spec.id).join(", ") || "—"}`)
    lines.push(`- решения в памяти: ${result.corpus.memory.map((item) => item.source).join(", ") || "—"}`)
    lines.push(`- функторы: ${result.corpus.functors.join(", ") || "—"}`)
    lines.push("")
  }

  const errors = result.diagnostics.filter((item) => item.severity === "error").length
  const warnings = result.diagnostics.length - errors
  lines.push(`## Итог: ошибок ${errors}, предупреждений ${warnings}`, "")
  if (typeof result.others === "number" && result.others > 0) {
    lines.push(`_Ещё ${result.others} диагностик корпуса не касаются этой спеки и на решение не влияют._`, "")
  }

  const groups = new Map()
  for (const diagnostic of result.diagnostics) {
    if (!groups.has(diagnostic.code)) groups.set(diagnostic.code, [])
    groups.get(diagnostic.code).push(diagnostic)
  }

  for (const [code, items] of groups) {
    lines.push(`### ${TITLES[code] ?? code} (\`${code}\`)`, "")
    for (const item of items) {
      lines.push(`- **${SEVERITY[item.severity] ?? item.severity}** — ${item.message}`)
      if (item.path) lines.push(`  - где: \`${item.path}\``)
      if (item.details?.overlap) lines.push(`  - пересечение условий: ${item.details.overlap}`)
      if (item.details?.witness) lines.push(`  - пример входа: \`${JSON.stringify(item.details.witness)}\``)
      if (item.details?.input) lines.push(`  - вход: \`${JSON.stringify(item.details.input)}\``)
    }
    lines.push("")
  }

  if (!result.diagnostics.length) lines.push("Диагностик нет.", "")

  if (result.summary?.examples?.length) {
    lines.push("## Примеры моделей", "")
    for (const item of result.summary.examples) {
      lines.push(`- \`${item.source}\`: ${item.passed}/${item.total}${item.note ? ` — ${item.note}` : ""}`)
    }
    lines.push("")
  }

  if (result.summary?.gridPoints !== undefined) {
    lines.push("## Объём проверки", "")
    lines.push(`- правил: ${result.summary.rules}, из них покрыто примерами: ${result.summary.rulesCovered}`)
    lines.push(`- инвариантов конституции: ${result.summary.invariants}`)
    lines.push(`- точек сетки входов: ${result.summary.gridPoints}`)
    if (result.summary.skippedPairs) {
      lines.push(`- пар правил вне интервального анализа: ${result.summary.skippedPairs}`)
    }
    lines.push("")
  }

  return lines.join("\n")
}
