/**
 * Текстовый отчёт для терминала и CI.
 *
 * Отчёт устроен так, чтобы читаться сверху вниз и заканчиваться самым важным:
 * сначала что вообще есть в модели, потом покрытие, потом дыры, потом
 * достижимость свойств. Никаких цветов и escape-последовательностей: вывод
 * попадает в логи CI, где они превращаются в мусор.
 */
import { formatValue } from "../../ftspec/src/intervals.mjs"

const bullet = (text) => `  • ${text}`

const witnessText = (witness) =>
  witness
    ? Object.entries(witness)
        .map(([field, value]) => `«${field}» = ${formatValue(value)}`)
        .join(", ")
    : "—"

/**
 * @param {object} analysis результат `analyzeDocument`
 * @returns {string}
 */
export function textReport(analysis) {
  const lines = []
  lines.push(`Карта покрытия правил · категория «${analysis.category}»`)
  lines.push(
    `утилит ${analysis.summary.utilities}, дыр ${analysis.summary.holes}, пересечений ${analysis.summary.overlaps}, ` +
      `недостижимых свойств ${analysis.summary.unattainable}, нарушенных свойств ${analysis.summary.violated}`,
  )

  if (!analysis.utilities.length) {
    lines.push("")
    lines.push("В модели нет утилит — картировать нечего.")
    return `${lines.join("\n")}\n`
  }

  for (const utility of analysis.utilities) {
    lines.push("")
    lines.push(`── Утилита «${utility.name}» ──`)
    if (!utility.analyzed) {
      lines.push(`  не проанализирована: входная структура «${utility.input}» не найдена`)
      continue
    }

    lines.push(
      `объект «${utility.input}», начальное значение ${formatValue(utility.initial)}, ` +
        `клеток разбиения ${utility.summary.cells} (покрыто ${utility.summary.cellsCovered}, ` +
        `дыр ${utility.summary.cellsHoles}, с пересечением ${utility.summary.cellsOverlapping})`,
    )

    lines.push("")
    lines.push("Поля входа")
    for (const axis of utility.axes) {
      const thresholds = axis.thresholds.length
        ? `пороги: ${axis.thresholds.map((value) => formatValue(value)).join(", ")}`
        : "порогов нет"
      const free = axis.free ? ", свободно — ни одно правило его не упоминает" : ""
      lines.push(bullet(`«${axis.field}» (${axis.type}, ${axis.kind}) — ${thresholds}${free}`))
    }

    lines.push("")
    lines.push("Области правил")
    if (!utility.rules.length) lines.push(bullet("правил нет"))
    for (const rule of utility.rules) {
      if (rule.empty) {
        lines.push(bullet(`«${rule.name}» — НЕ СРАБАТЫВАЕТ НИКОГДА: ${rule.reason}`))
        continue
      }
      const region = rule.regions.length ? rule.regions.join(" ∪ ") : "нигде на разбиении"
      lines.push(bullet(`«${rule.name}» → ${rule.action.text}`))
      lines.push(`      область: ${region}`)
      if (rule.free.length) lines.push(`      не ограничивает: ${rule.free.map((field) => `«${field}»`).join(", ")}`)
      if (!rule.analyzable) {
        lines.push(
          `      ⚠ условие по полю «${rule.unanalyzedField}» сравнивает не с константой: ` +
            "область получена исполнением на представителях клеток, не доказана",
        )
      }
    }

    lines.push("")
    lines.push("Пересечения")
    if (!utility.overlaps.length) lines.push(bullet("нет: никакие два правила не применимы одновременно"))
    for (const overlap of utility.overlaps) {
      lines.push(bullet(`«${overlap.names[0]}» + «${overlap.names[1]}» при ${overlap.regions.join("; ")}`))
      lines.push(`      действия: ${overlap.actions.join(" / ")} — ${overlap.note}`)
      lines.push(`      свидетель: ${witnessText(overlap.witness)}`)
    }

    lines.push("")
    lines.push("Дыры (не срабатывает ни одно правило)")
    if (!utility.holes.length) lines.push(bullet("нет: каждая клетка разбиения покрыта хотя бы одним правилом"))
    for (const hole of utility.holes) {
      lines.push(bullet(`${hole.where} → результат остаётся ${formatValue(hole.result)}`))
      lines.push(`      свидетель: ${witnessText(hole.witness)}`)
    }

    lines.push("")
    lines.push("Достижимость свойств")
    if (!utility.properties.length) lines.push(bullet("свойств нет"))
    for (const property of utility.properties) {
      const mark = property.violatedCount ? "НАРУШЕНО" : property.unattainable ? "НЕДОСТИЖИМО" : "достижимо"
      lines.push(bullet(`«${property.name}» (${property.limitText}) — ${mark}`))
      lines.push(`      ${property.message}`)
      if (property.violated.length) {
        const first = property.violated[0]
        lines.push(
          `      свидетель нарушения: ${witnessText(first.input)} → результат ${formatValue(first.result)}, предел ${formatValue(first.limit)}`,
        )
      }
      if (property.slackRegions.length) {
        lines.push(`      с запасом (предел ничего не ограничивает): ${property.slackRegions.join("; ")}`)
      }
      if (property.undecidedCount) lines.push(`      не определено в ${property.undecidedCount} точках выборки`)
    }

    const notes = utility.diagnostics.filter((item) => item.code === "FTSMAP_UNANALYZED" || item.code === "FTSMAP_TRUNCATED")
    if (notes.length || utility.summary.cellsMixed || utility.summary.cellsUndecided) {
      lines.push("")
      lines.push("Что НЕ проанализировано")
      for (const note of notes) lines.push(bullet(note.message))
      if (utility.summary.cellsMixed) {
        lines.push(bullet(`${utility.summary.cellsMixed} клеток «смешанные»: правило внутри клетки ведёт себя по-разному`))
      }
      if (utility.summary.cellsUndecided) {
        lines.push(bullet(`${utility.summary.cellsUndecided} клеток не определены: ядро отвергло входы-представители`))
      }
    }
  }

  lines.push("")
  lines.push("Диагностики")
  if (!analysis.diagnostics.length) lines.push(bullet("нет"))
  for (const diagnostic of analysis.diagnostics) {
    lines.push(bullet(`[${diagnostic.severity}] ${diagnostic.code}: ${diagnostic.message}`))
  }

  return `${lines.join("\n")}\n`
}
