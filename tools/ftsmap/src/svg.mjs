/**
 * Печать карты покрытия в SVG — текстом, без единой библиотеки.
 *
 * Три вида диаграмм и почему их именно три.
 *
 * 1. ОСЬ. Одно числовое поле — это прямая. Правила рисуются дорожками над ней,
 *    пороги подписаны, под осью идёт полоса покрытия: где сработало одно
 *    правило, где несколько, где НИ ОДНОГО.
 *
 * 2. ПЛОСКОСТЬ. Два числовых поля — сетка прямоугольников из того же разбиения
 *    на клетки. Область правила — объединение клеток, наложение — штриховка,
 *    дыра — отдельная штриховка с подписью.
 *
 * 3. РЕШЁТКА (small multiples). Больше двух полей или признаки в наборе: по
 *    строкам — значения признаков и строк, по столбцам — пары числовых полей.
 *    Рисовать N измерений в одной картинке нельзя честно: любая проекция
 *    что-то склеивает. Поэтому склейка происходит явно — там, где под одной
 *    клеткой картинки лежит несколько клеток разбиения с разным статусом,
 *    рисуется «смешанно», а не средний по больнице цвет.
 *
 * Читаемость без интерактива. Статус кодируется дважды — цветом И рисунком
 * (штриховка/подпись), потому что цвет не различают примерно 8 % мужчин, а
 * дыра — главное, что карта обязана показать. Палитра синий/оранжевый/
 * фиолетовый/бирюзовый различима при всех типах дальтонизма; красно-зелёная
 * пара не используется нигде.
 *
 * Детерминированность. Ни дат, ни случайных идентификаторов, ни хешей: один и
 * тот же анализ даёт байт-в-байт один и тот же файл. Числа округляются до
 * сотых при печати, поэтому разрядность не зависит от платформы.
 */
import { NUMBER, formatValue } from "../../ftspec/src/intervals.mjs"

const WIDTH = 1000
const PAD = 24
const GUTTER = 210
const LANE_H = 18
const LANE_GAP = 5
const STRIP_H = 22
const AXIS_H = 40
const PROP_H = 20
const ROW_GAP = 18
const PANEL_GAP = 16
const MAX_ROWS = 8
const MAX_PAIRS = 3
const RULE_COLORS = 6

/* ────────────────────────────── примитивы ───────────────────────────────── */

const esc = (value) =>
  String(value)
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")

/** Округление до сотых: избавляет вывод от «0.30000000000000004». */
const n = (value) => {
  const rounded = Math.round(value * 100) / 100
  return Object.is(rounded, -0) ? "0" : String(rounded)
}

const clip = (value, length) => {
  const text = String(value)
  return text.length <= length ? text : `${text.slice(0, Math.max(length - 1, 1))}…`
}

/** Перенос по словам: подписи под диаграммой не должны уезжать за край листа. */
function wrapText(value, maxChars) {
  const words = String(value).split(" ")
  const lines = []
  let current = ""
  for (const word of words) {
    if (!current) {
      current = word
      continue
    }
    if (`${current} ${word}`.length > maxChars) {
      lines.push(current)
      current = word
    } else current = `${current} ${word}`
  }
  if (current) lines.push(current)
  return lines.length ? lines : [""]
}

const charsFor = (width) => Math.max(24, Math.floor(width / 5.9))

const text = (x, y, value, cls, anchor = "start") =>
  `<text x="${n(x)}" y="${n(y)}" class="${cls}" text-anchor="${anchor}">${esc(value)}</text>`

const rect = (x, y, w, h, cls, extra = "") =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(Math.max(w, 0))}" height="${n(Math.max(h, 0))}" class="${cls}"${extra}/>`

/** Подпись поверх штриховки: без подложки она сливается с рисунком. */
const chip = (cx, cy, value, parts) => {
  const w = String(value).length * 6.2 + 10
  parts.push(rect(cx - w / 2, cy - 10, w, 13, "chip"))
  parts.push(text(cx, cy, value, "mark-lbl", "middle"))
}

const line = (x1, y1, x2, y2, cls) =>
  `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" class="${cls}"/>`

/* ─────────────────────────── геометрия разбиения ────────────────────────── */

/** Ширины клеток оси: пороги узкие, интервалы широкие; сумма ровно `width`. */
function scaleFor(axis, x0, width) {
  const weights = axis.cells.map((cell) => (cell.kind === "point" ? 22 : 68))
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let x = x0
  return axis.cells.map((cell, index) => {
    const w = (weights[index] / total) * width
    const span = { x, w, center: x + w / 2, cell }
    x += w
    return span
  })
}

const numericLabel = (value) => (value === -Infinity ? "−∞" : value === Infinity ? "+∞" : n(value))

/** Подпись клетки оси в подвале решётки. */
function cellLabel(axis, cell) {
  if (cell.kind === "point") return numericLabel(cell.value)
  if (cell.kind === "value") return formatValue(cell.value)
  if (cell.kind === "other") return "иное"
  if (cell.kind === "any") return "любое"
  return `${cell.lo === -Infinity ? "(−∞" : `(${numericLabel(cell.lo)}`}, ${cell.hi === Infinity ? "+∞)" : `${numericLabel(cell.hi)})`}`
}

/* ─────────────────────────── статусы проекций ───────────────────────────── */

function sliceCells(cells, assignment) {
  const pairs = [...assignment]
  return cells.filter((cell) => pairs.every(([axis, index]) => cell.coords[axis] === index))
}

/** Статус пятна картинки, под которым лежит одна или несколько клеток. */
function statusOf(cells) {
  if (!cells.length) return { kind: "none", label: "" }
  const holes = cells.filter((cell) => cell.hole).length
  const many = cells.filter((cell) => cell.firing.length + cell.partial.length >= 2).length
  const undecided = cells.filter((cell) => cell.undecided).length
  const uneven = cells.filter((cell) => cell.mixed).length
  const width = Math.max(...cells.map((cell) => cell.firing.length + cell.partial.length))
  if (holes === cells.length) return { kind: "hole", label: "дыра" }
  if (undecided === cells.length) return { kind: "unknown", label: "?" }
  if (holes > 0) return { kind: "mixed", label: "смешанно" }
  /* Клетка, внутри которой правило ведёт себя по-разному, — не «покрыто»
     и не «пересечение», а честное «не знаем»: разбиение оказалось грубым. */
  if (uneven > 0) return { kind: "mixed", label: "смешанно" }
  if (many === cells.length) return { kind: "overlap", label: `×${width}` }
  if (many > 0) return { kind: "mixed", label: "смешанно" }
  return { kind: "covered", label: "" }
}

const STATUS_CLASS = {
  hole: "fill-hole",
  overlap: "fill-over",
  mixed: "fill-mix",
  unknown: "fill-mix",
  covered: "fill-cov",
  none: "fill-none",
}

function ruleCover(cells, index) {
  if (!cells.length) return "none"
  if (cells.every((cell) => cell.firing.includes(index))) return "full"
  if (cells.some((cell) => cell.firing.includes(index) || cell.partial.includes(index))) return "partial"
  return "none"
}

const PROPERTY_RANK = { violated: 3, tight: 2, undecided: 1, slack: 0 }
const PROPERTY_MARK = { violated: "✕", tight: "=", undecided: "?", slack: "·" }
const PROPERTY_CLASS = { violated: "mark-bad", tight: "mark-tight", undecided: "mark-mix", slack: "mark-ok" }

function propertyStatus(property, cells) {
  let worst = "slack"
  let seen = false
  for (const cell of cells) {
    const status = property.statusByCell?.[cell.index]
    if (!status) continue
    seen = true
    if (PROPERTY_RANK[status] > PROPERTY_RANK[worst]) worst = status
  }
  return seen ? worst : null
}

/* ──────────────────────────── панель «ось» ──────────────────────────────── */

function panelLine(utility, { axisIndex, assignment, x, y, width, title }) {
  const parts = []
  const axes = utility.internal.axes
  const axis = axes[axisIndex]
  const cells = utility.internal.cells
  const plotX = x + GUTTER
  const plotW = width - GUTTER
  const spans = scaleFor(axis, plotX, plotW)
  let top = y

  if (title) {
    parts.push(text(x, top + 11, title, "h2"))
    top += 20
  }

  const slices = axis.cells.map((_, index) => sliceCells(cells, new Map([...assignment, [axisIndex, index]])))

  /* дорожки правил */
  utility.rules.forEach((rule, index) => {
    const cls = `r${index % RULE_COLORS}`
    parts.push(rect(x, top, GUTTER - 10, LANE_H, "lane-bg"))
    parts.push(rect(x, top, 4, LANE_H, `fill-${cls}`))
    parts.push(text(x + 10, top + 13, clip(rule.name, 26), "lbl-strong"))
    slices.forEach((slice, cellIndex) => {
      const cover = ruleCover(slice, index)
      if (cover === "none") return
      const span = spans[cellIndex]
      parts.push(
        rect(span.x, top, span.w, LANE_H, cover === "full" ? `fill-${cls}` : "fill-mix", ' opacity="0.9"'),
      )
    })
    top += LANE_H + LANE_GAP
  })

  if (!utility.rules.length) {
    parts.push(text(x, top + 13, "правил нет", "lbl"))
    top += LANE_H + LANE_GAP
  }

  /* полоса покрытия */
  parts.push(text(x + 10, top + 15, "покрытие", "lbl-strong"))
  slices.forEach((slice, cellIndex) => {
    const status = statusOf(slice)
    const span = spans[cellIndex]
    parts.push(rect(span.x, top, span.w, STRIP_H, STATUS_CLASS[status.kind]))
    parts.push(rect(span.x, top, span.w, STRIP_H, "cell-edge"))
    if (status.label && span.w > 26) chip(span.center, top + 15, status.label, parts)
  })
  top += STRIP_H

  /* ось со шкалой */
  parts.push(line(plotX, top + 8, plotX + plotW, top + 8, "axis"))
  parts.push(text(x + 10, top + 12, `«${clip(axis.field, 24)}»`, "lbl-strong"))
  let alternate = 0
  spans.forEach((span) => {
    if (span.cell.kind === "point" || span.cell.kind === "value" || span.cell.kind === "other") {
      parts.push(line(span.center, top + 4, span.center, top + 12, "tick"))
      const dy = alternate % 2 === 0 ? 24 : 36
      alternate += 1
      parts.push(text(span.center, top + dy, cellLabel(axis, span.cell), "val", "middle"))
    }
  })
  if (axis.kind === NUMBER) {
    parts.push(text(plotX, top + 12 + 6, "−∞", "lbl", "start"))
    parts.push(text(plotX + plotW, top + 12 + 6, "+∞", "lbl", "end"))
  }
  top += AXIS_H

  /* полосы свойств */
  utility.properties.forEach((property) => {
    parts.push(
      text(x + 10, top + 13, clip(`${property.unattainable ? "◇ " : ""}${property.name}`, 26), "lbl-strong"),
    )
    slices.forEach((slice, cellIndex) => {
      const status = propertyStatus(property, slice)
      if (!status) return
      const span = spans[cellIndex]
      parts.push(rect(span.x, top, span.w, PROP_H - 4, "cell-edge"))
      parts.push(text(span.center, top + 12, PROPERTY_MARK[status], PROPERTY_CLASS[status], "middle"))
    })
    top += PROP_H
  })

  return { parts, height: top - y }
}

/* ─────────────────────────── панель «плоскость» ─────────────────────────── */

function panelPlane(utility, { xAxisIndex, yAxisIndex, assignment, x, y, width, title }) {
  const parts = []
  const axes = utility.internal.axes
  const xAxis = axes[xAxisIndex]
  const yAxis = axes[yAxisIndex]
  const cells = utility.internal.cells
  const left = x + 78
  const plotW = width - 78
  const spans = scaleFor(xAxis, left, plotW)
  const rowH = 24
  let top = y

  if (title) {
    parts.push(text(x, top + 11, title, "h2"))
    top += 20
  }
  parts.push(text(x, top + 11, `↑ «${clip(yAxis.field, 12)}»`, "lbl-strong"))
  top += 16

  const rows = [...yAxis.cells].map((_, index) => index).reverse()
  rows.forEach((yIndex, position) => {
    const rowY = top + position * rowH
    parts.push(text(x + 72, rowY + 16, clip(cellLabel(yAxis, yAxis.cells[yIndex]), 12), "val", "end"))
    xAxis.cells.forEach((_, xIndex) => {
      const slice = sliceCells(cells, new Map([...assignment, [xAxisIndex, xIndex], [yAxisIndex, yIndex]]))
      const status = statusOf(slice)
      const span = spans[xIndex]
      parts.push(rect(span.x, rowY, span.w, rowH - 2, status.kind === "hole" ? "fill-hole" : "fill-cov"))
      /* Правила рисуются ПОД штриховкой статуса: иначе цвет правила закрыл бы
         главное — что клетка дырявая или спорная. Поэтому наложение и
         «смешанно» печатаются прозрачным вариантом того же рисунка. */
      const firing = utility.rules
        .map((_, index) => ({ cover: ruleCover(slice, index), index }))
        .filter((item) => item.cover !== "none")
      firing.forEach((item, order) => {
        const bandH = (rowH - 2) / Math.max(firing.length, 1)
        parts.push(
          rect(
            span.x,
            rowY + order * bandH,
            span.w,
            bandH,
            `fill-r${item.index % RULE_COLORS}`,
            ` opacity="${item.cover === "full" ? "0.6" : "0.28"}"`,
          ),
        )
      })
      if (status.kind === "overlap") parts.push(rect(span.x, rowY, span.w, rowH - 2, "fill-over-t"))
      if (status.kind === "mixed" || status.kind === "unknown") {
        parts.push(rect(span.x, rowY, span.w, rowH - 2, "fill-mix-t"))
      }
      parts.push(rect(span.x, rowY, span.w, rowH - 2, "cell-edge"))
      if (status.label && span.w > 26) chip(span.center, rowY + 15, status.label, parts)
      /* Свойства на плоскости показываются знаком прямо в клетке: отдельной
         полосы под осью не хватило бы — по вертикали тоже есть измерение. */
      const worst = utility.properties
        .map((property) => propertyStatus(property, slice))
        .filter((item) => item === "violated" || item === "tight")
        .sort((left, right) => PROPERTY_RANK[right] - PROPERTY_RANK[left])[0]
      if (worst) parts.push(text(span.x + 7, rowY + 16, PROPERTY_MARK[worst], PROPERTY_CLASS[worst]))
    })
  })
  top += rows.length * rowH + 4

  parts.push(line(left, top, left + plotW, top, "axis"))
  let alternate = 0
  spans.forEach((span) => {
    if (span.cell.kind !== "interval" || xAxis.kind !== NUMBER) {
      parts.push(line(span.center, top - 4, span.center, top + 4, "tick"))
    }
    if (span.cell.kind === "point" || span.cell.kind === "value" || span.cell.kind === "other") {
      const dy = alternate % 2 === 0 ? 16 : 28
      alternate += 1
      parts.push(text(span.center, top + dy, cellLabel(xAxis, span.cell), "val", "middle"))
    }
  })
  parts.push(text(left + plotW, top + 40, `«${clip(xAxis.field, 18)}» →`, "lbl-strong", "end"))
  top += 48

  return { parts, height: top - y }
}

/* ──────────────────────────── выбор вида ────────────────────────────────── */

export function chooseMode(utility) {
  const axes = utility.internal.axes
  const numeric = axes.map((axis, index) => ({ axis, index })).filter((item) => item.axis.kind === NUMBER && !item.axis.free)
  const categorical = axes
    .map((axis, index) => ({ axis, index }))
    .filter((item) => !item.axis.free && item.axis.kind !== NUMBER && item.axis.cells.length > 1)
  if (!categorical.length && numeric.length === 1) return { mode: "line", numeric, categorical }
  if (!categorical.length && numeric.length === 2) return { mode: "plane", numeric, categorical }
  return { mode: "grid", numeric, categorical }
}

/** Строки решётки: все сочетания значений признаков и строковых полей. */
function gridRows(categorical) {
  let rows = [{ assignment: [], label: [] }]
  for (const item of categorical) {
    const next = []
    for (const row of rows) {
      item.axis.cells.forEach((cell, index) => {
        next.push({
          assignment: [...row.assignment, [item.index, index]],
          label: [...row.label, `«${item.axis.field}» = ${cellLabel(item.axis, cell)}`],
        })
      })
    }
    rows = next
  }
  return rows
}

/* ──────────────────────────── сборка утилиты ────────────────────────────── */

function renderUtility(utility, y, width) {
  const parts = []
  const x = PAD
  let top = y

  const holes = utility.holes?.length ?? 0
  const overlaps = utility.overlaps?.length ?? 0
  const unattainable = (utility.properties ?? []).filter((property) => property.unattainable).length
  parts.push(text(x, top + 14, `Утилита «${utility.name}»`, "h1"))
  top += 22
  parts.push(
    text(
      x,
      top + 11,
      `объект «${utility.input}» · начальное значение ${formatValue(utility.initial)} · ` +
        `клеток ${utility.summary.cells} · дыр ${holes} · пересечений ${overlaps} · недостижимых свойств ${unattainable}`,
      "lbl",
    ),
  )
  top += 18

  const { mode, numeric, categorical } = chooseMode(utility)
  const modeText =
    mode === "line"
      ? `вид: числовая ось «${numeric[0].axis.field}»`
      : mode === "plane"
        ? `вид: плоскость «${numeric[0].axis.field}» × «${numeric[1].axis.field}»`
        : `вид: решётка — строки по признакам, столбцы по числовым полям`
  parts.push(text(x, top + 11, modeText, "lbl"))
  top += 20

  if (mode === "line") {
    const panel = panelLine(utility, { axisIndex: numeric[0].index, assignment: new Map(), x, y: top, width })
    parts.push(...panel.parts)
    top += panel.height
  } else if (mode === "plane") {
    const panel = panelPlane(utility, {
      xAxisIndex: numeric[0].index,
      yAxisIndex: numeric[1].index,
      assignment: new Map(),
      x,
      y: top,
      width,
    })
    parts.push(...panel.parts)
    top += panel.height
  } else {
    const rows = gridRows(categorical)
    const shown = rows.slice(0, MAX_ROWS)
    const pairs = []
    for (let a = 0; a < numeric.length; a += 1) {
      for (let b = a + 1; b < numeric.length; b += 1) pairs.push([numeric[a], numeric[b]])
    }
    const columns = numeric.length >= 2 ? pairs.slice(0, MAX_PAIRS) : numeric.length === 1 ? [[numeric[0]]] : []

    if (!columns.length) {
      parts.push(text(x, top + 11, "числовых полей нет — показаны только сочетания признаков", "lbl"))
      top += 18
    }

    for (const row of shown) {
      const title = row.label.join(", ") || "все входы"
      if (!columns.length) {
        const slice = sliceCells(utility.internal.cells, new Map(row.assignment))
        const status = statusOf(slice)
        parts.push(rect(x, top, 14, 14, STATUS_CLASS[status.kind]))
        parts.push(rect(x, top, 14, 14, "cell-edge"))
        parts.push(text(x + 22, top + 12, `${title} — ${status.label || "покрыто"}`, "val"))
        top += 20
        continue
      }
      if (columns.length === 1 && columns[0].length === 1) {
        const panel = panelLine(utility, {
          axisIndex: columns[0][0].index,
          assignment: new Map(row.assignment),
          x,
          y: top,
          width,
          title,
        })
        parts.push(...panel.parts)
        top += panel.height + ROW_GAP
        continue
      }
      const columnWidth = (width - (columns.length - 1) * PANEL_GAP) / columns.length
      let tallest = 0
      columns.forEach((pair, index) => {
        const panel = panelPlane(utility, {
          xAxisIndex: pair[0].index,
          yAxisIndex: pair[1].index,
          assignment: new Map(row.assignment),
          x: x + index * (columnWidth + PANEL_GAP),
          y: top,
          width: columnWidth,
          title: index === 0 ? title : " ",
        })
        parts.push(...panel.parts)
        tallest = Math.max(tallest, panel.height)
      })
      top += tallest + ROW_GAP
    }

    if (rows.length > shown.length) {
      parts.push(text(x, top + 11, `показаны ${shown.length} строки из ${rows.length}`, "lbl"))
      top += 18
    }
  }

  /* правила: цвет, действие, доказанная область */
  top += 6
  const ruleChars = charsFor(width - 34)
  utility.rules.forEach((rule, index) => {
    parts.push(rect(x, top, 14, 12, `fill-r${index % RULE_COLORS}`))
    parts.push(rect(x, top, 14, 12, "cell-edge"))
    const region = rule.empty
      ? `нигде: ${rule.reason}`
      : rule.regions.length
        ? rule.regions.join(" ∪ ")
        : "нигде на разбиении"
    const chunks = wrapText(`«${rule.name}» → ${rule.action.text} · область: ${region}`, ruleChars)
    chunks.forEach((chunk, order) => parts.push(text(x + 22, top + 10 + order * 14, chunk, "note")))
    top += chunks.length * 14 + 2
  })

  /* итоги по свойствам и честные оговорки */
  top += 4
  const maxChars = charsFor(width - 20)
  const note = (mark, cls, message) => {
    const lines = wrapText(message, maxChars)
    parts.push(text(x, top + 11, mark, cls))
    lines.forEach((chunk, index) => parts.push(text(x + 18, top + 11 + index * 14, chunk, "note")))
    top += lines.length * 14 + 4
  }

  for (const property of utility.properties ?? []) {
    const mark = property.violatedCount ? "✕" : property.unattainable ? "◇" : "="
    const cls = property.violatedCount ? "mark-bad" : property.unattainable ? "mark-tight" : "mark-ok"
    note(mark, cls, `свойство «${property.name}» (${property.limitText}): ${property.message}`)
  }
  for (const hole of utility.holes ?? []) {
    note("▨", "mark-bad", `дыра: при ${hole.where} результат остаётся ${formatValue(hole.result)}`)
  }
  for (const rule of utility.rules ?? []) {
    if (rule.analyzable && !rule.empty) continue
    note(
      "?",
      "mark-mix",
      rule.empty
        ? `правило «${rule.name}» не срабатывает никогда: ${rule.reason}`
        : `правило «${rule.name}»: условие по полю «${rule.unanalyzedField}» не интервальное — ` +
          "область получена исполнением на представителях клеток, не доказана",
    )
  }

  return { parts, height: top - y + 12 }
}

/* ─────────────────────────────── легенда ────────────────────────────────── */

function renderLegend(y, width) {
  const parts = []
  const x = PAD
  let top = y
  parts.push(line(x, top, x + width, top, "axis"))
  top += 16
  parts.push(text(x, top + 11, "Как читать", "h2"))
  top += 20

  const items = [
    ["fill-cov", "покрыто — сработало ровно одно правило"],
    ["fill-over", "пересечение — сработало несколько правил (подпись ×N)"],
    ["fill-hole", "дыра — не сработало ни одно правило, результат остаётся начальным"],
    ["fill-mix", "смешанно — под пятном лежат клетки с разным поведением или условие не разобрано"],
  ]
  for (const [cls, label] of items) {
    parts.push(rect(x, top, 22, 14, cls))
    parts.push(rect(x, top, 22, 14, "cell-edge"))
    parts.push(text(x + 30, top + 11, label, "note"))
    top += 18
  }

  const marks = [
    ["mark-bad", "✕", "свойство нарушено на входе из этой клетки"],
    ["mark-tight", "=", "предел свойства достигнут точно"],
    ["mark-ok", "·", "свойство выполнено с запасом — предел ничего не ограничивает"],
    ["mark-mix", "?", "определить не удалось: ядро отвергло вход"],
  ]
  for (const [cls, glyph, label] of marks) {
    parts.push(text(x + 8, top + 11, glyph, cls))
    parts.push(text(x + 30, top + 11, label, "note"))
    top += 18
  }

  const maxChars = charsFor(width)
  const footnotes = [
    "Насыщенная заливка правила — оно срабатывает во всей клетке; бледная — только на части представителей (условие сравнивает поля между собой).",
    "Ось не в масштабе: между порогами равные промежутки, у самого порога — узкая клетка-точка. Ромб ◇ у имени свойства значит «предел недостижим».",
    "Метод покоординатный: зависимости между полями и нелинейности внутри клетки он не видит. Это выборка на представителях клеток, а не доказательство.",
  ]
  for (const footnote of footnotes) {
    for (const chunk of wrapText(footnote, maxChars)) {
      parts.push(text(x, top + 11, chunk, "note"))
      top += 14
    }
    top += 4
  }
  top += 4

  return { parts, height: top - y }
}

/* ──────────────────────────────── документ ──────────────────────────────── */

/**
 * Палитры.
 *
 * Тёмная взята из фирменных токенов (`digitable.tokens.css`), светлая —
 * затемнённые аналоги тех же тонов, чтобы контраст к белому был не ниже 4.5:1.
 * Пары различимы при протанопии, дейтеранопии и тританопии: красно-зелёной
 * оппозиции в наборе нет вовсе, а статусы дополнительно кодируются штриховкой.
 */
const LIGHT = {
  bg: "#ffffff",
  fg: "#12202c",
  muted: "#55677a",
  line: "#b9c6d2",
  panel: "#f4f7fa",
  panel2: "#e6edf4",
  hole: "#b3261e",
  over: "#6a3fb5",
  ok: "#00706a",
  rules: ["#1f6fd0", "#b85c00", "#7b3fc4", "#00706a", "#7d6200", "#a3006e"],
}

const DARK = {
  bg: "#05080d",
  fg: "#f5f7fa",
  muted: "#9baab8",
  line: "#2a4655",
  panel: "#0b111a",
  panel2: "#132330",
  hole: "#ff5b5b",
  over: "#b65cff",
  ok: "#00e5e5",
  rules: ["#3ca9ff", "#ff8a2a", "#b65cff", "#00e5e5", "#ffc247", "#ff7ad1"],
}

/**
 * Правила стиля для одной палитры.
 *
 * Пользовательские свойства CSS (`var(--x)`) сознательно НЕ используются: их не
 * понимают librsvg и часть просмотрщиков, и файл превращается в чёрный
 * прямоугольник. Поэтому цвета печатаются литералами дважды — в базовом наборе
 * и внутри `@media (prefers-color-scheme: dark)`.
 */
const paletteRules = (palette) =>
  [
    `.page{fill:${palette.bg}}`,
    `.h1{fill:${palette.fg};font-size:15px;font-weight:600}`,
    `.h2{fill:${palette.fg};font-size:12px;font-weight:600}`,
    `.lbl{fill:${palette.muted};font-size:11px}`,
    `.lbl-strong{fill:${palette.fg};font-size:11px;font-weight:600}`,
    `.val{fill:${palette.fg};font-size:10px}`,
    `.note{fill:${palette.muted};font-size:11px}`,
    `.axis{stroke:${palette.line};stroke-width:1;fill:none}`,
    `.tick{stroke:${palette.line};stroke-width:1;fill:none}`,
    `.lane-bg{fill:${palette.panel}}`,
    `.cell-edge{fill:none;stroke:${palette.line};stroke-width:0.75}`,
    `.fill-none{fill:${palette.panel}}`,
    `.fill-cov{fill:${palette.panel2}}`,
    ...palette.rules.map((color, index) => `.fill-r${index}{fill:${color}}`),
    `.pat-bg{fill:${palette.panel}}`,
    `.pat-hole{stroke:${palette.hole};stroke-width:3;fill:none}`,
    `.pat-over{stroke:${palette.over};stroke-width:2;fill:none}`,
    `.pat-mix{stroke:${palette.muted};stroke-width:1.2;fill:none}`,
    `.chip{fill:${palette.bg};opacity:0.85}`,
    `.mark-lbl{fill:${palette.fg};font-size:10px;font-weight:600}`,
    `.mark-bad{fill:${palette.hole};font-size:12px;font-weight:700}`,
    `.mark-tight{fill:${palette.over};font-size:12px;font-weight:700}`,
    `.mark-ok{fill:${palette.ok};font-size:12px;font-weight:700}`,
    `.mark-mix{fill:${palette.muted};font-size:12px;font-weight:700}`,
  ].join("")

const STYLE = [
  "svg{font-family:Inter,'Segoe UI',system-ui,sans-serif}",
  ".fill-hole{fill:url(#ftsmap-hole)}",
  ".fill-over{fill:url(#ftsmap-over)}",
  ".fill-mix{fill:url(#ftsmap-mix)}",
  ".fill-over-t{fill:url(#ftsmap-over-t)}",
  ".fill-mix-t{fill:url(#ftsmap-mix-t)}",
  paletteRules(LIGHT),
  "@media (prefers-color-scheme:dark){",
  paletteRules(DARK),
  "}",
].join("")

const DEFS = [
  '<defs>',
  '<pattern id="ftsmap-hole" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">',
  '<rect width="9" height="9" class="pat-bg"/><line x1="0" y1="0" x2="0" y2="9" class="pat-hole"/>',
  '</pattern>',
  '<pattern id="ftsmap-over" width="8" height="8" patternUnits="userSpaceOnUse">',
  '<rect width="8" height="8" class="pat-bg"/>',
  '<line x1="0" y1="0" x2="8" y2="8" class="pat-over"/><line x1="8" y1="0" x2="0" y2="8" class="pat-over"/>',
  '</pattern>',
  '<pattern id="ftsmap-mix" width="6" height="6" patternUnits="userSpaceOnUse">',
  '<rect width="6" height="6" class="pat-bg"/><circle cx="3" cy="3" r="1" class="pat-mix"/>',
  '</pattern>',
  '<pattern id="ftsmap-over-t" width="8" height="8" patternUnits="userSpaceOnUse">',
  '<line x1="0" y1="0" x2="8" y2="8" class="pat-over"/><line x1="8" y1="0" x2="0" y2="8" class="pat-over"/>',
  '</pattern>',
  '<pattern id="ftsmap-mix-t" width="6" height="6" patternUnits="userSpaceOnUse">',
  '<circle cx="3" cy="3" r="1" class="pat-mix"/>',
  '</pattern>',
  '</defs>',
].join("")

/**
 * Собрать SVG карты покрытия.
 *
 * @param {object} analysis результат `analyzeDocument`
 * @param {{width?: number, title?: string}} [options]
 * @returns {string}
 */
export function renderSvg(analysis, options = {}) {
  const width = options.width ?? WIDTH
  const inner = width - PAD * 2
  const parts = []
  let y = PAD

  parts.push(text(PAD, y + 16, options.title ?? `Карта покрытия правил · категория «${analysis.category}»`, "h1"))
  y += 26
  parts.push(
    text(
      PAD,
      y + 11,
      `утилит ${analysis.summary.utilities} · дыр ${analysis.summary.holes} · пересечений ${analysis.summary.overlaps} · ` +
        `недостижимых свойств ${analysis.summary.unattainable} · нарушенных свойств ${analysis.summary.violated}`,
      "lbl",
    ),
  )
  y += 24

  if (!analysis.utilities.length) {
    parts.push(text(PAD, y + 11, "в модели нет утилит — картировать нечего", "note"))
    y += 24
  }

  for (const utility of analysis.utilities) {
    if (!utility.analyzed) {
      parts.push(text(PAD, y + 11, `утилита «${utility.name}»: входная структура не найдена, анализ невозможен`, "note"))
      y += 22
      continue
    }
    const block = renderUtility(utility, y, inner)
    parts.push(...block.parts)
    y += block.height
  }

  const legend = renderLegend(y, inner)
  parts.push(...legend.parts)
  y += legend.height

  const height = Math.ceil(y + PAD)
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">`,
    `<title>${esc(options.title ?? `Карта покрытия правил · «${analysis.category}»`)}</title>`,
    `<style>${STYLE}</style>`,
    DEFS,
    rect(0, 0, width, height, "page"),
    ...parts,
    "</svg>",
    "",
  ].join("\n")
}
