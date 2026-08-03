/**
 * Приведение диагностики к координатам в файле.
 *
 * Источников координат четыре, и они не равноценны:
 *
 *   1. `span` — скобочная поверхность (`src/parser.ts`). Настоящие строка и
 *      колонка, обе с единицы. Единственный полный источник.
 *   2. `path: "строка 13"` — отступная поверхность (`src/natural-parser.ts`).
 *      Строка есть, колонки нет: берём её по содержимому строки, без отступа
 *      и без комментария.
 *   3. `path: "$.utilities[0].rules[0].when[0].field"` — проверка
 *      (`src/validate.ts`). Координат нет вовсе: указатель по канонической
 *      модели ищется в разметке. Неизвестный хвост не отбрасывает всю
 *      диагностику, а сползает к ближайшему известному предку.
 *   4. `{ utility, example, expected, actual }` — `testUtilities`. Ни пути,
 *      ни координат: узел ищется по именам, и подчёркивается строка
 *      `ожидается` — та, где записано неоправдавшееся ожидание.
 *
 * И пятый случай, который выглядит как третий, но им не является: у `ftsc` и
 * `ftspec` в `path` лежит настоящий путь к файлу. Их нельзя разрешать по
 * разметке — иначе диагностика о соседнем модуле подчеркнёт случайную строку
 * этого. Такие диагностики `locate` возвращает как `null`: координат внутри
 * документа у них нет, а файл — дело вызывающего.
 *
 * Возвращаемые координаты — с единицы, как `span` ядра и как аннотации
 * GitHub. Редакторам нужна нумерация с нуля: для них есть `toLspRange`.
 */

const SOURCE_LINE = /^(?:строка|line)\s+(\d+)$/u

/**
 * Корни канонической модели — ключи `FtsDocument` (см. src/model.ts), по
 * которым `validate`, `interpreter` и `certificate` строят свои указатели.
 */
const MODEL_ROOTS = new Set(["category", "structures", "functors", "proposition", "utilities", "ts_compat"])

const POINTER_ROOT = /^\$\.([A-Za-z_][A-Za-z0-9_]*)(?:[.[]|$)/u

/**
 * К какому виду относится `diagnostic.path`.
 *
 * Признак различия — не «начинается с `$`». `$` — законный символ имени файла
 * в любой POSIX-файловой системе, и `ftsc` вполне может сообщить о файле
 * `$.fts` или о пути внутри каталога `$`; проверка по первому символу назвала
 * бы их указателями и увела бы аннотацию на чужую строку.
 *
 * Надёжный признак — то, что указатель ядра не просто начинается с `$`, а
 * начинается с `$.` и одного из шести ключей канонического документа, за
 * которым идёт `.`, `[` или конец строки. Множество ключей закрыто и задано
 * моделью, а не догадкой: других корней ядро не порождает. Поэтому
 * `$.utilities[0].examples[1].expected` — указатель, а `$.fts`, `$/models/a.fts`
 * и `specs/001/model.fts` — файлы.
 *
 * Когда вызывающий знает происхождение диагностики (а он его знает: ядро он
 * зовёт сам, `ftsc` запускает отдельным процессом), надёжнее не угадывать —
 * `options.origin` перекрывает разбор строки.
 *
 * @param {unknown} path
 * @returns {"model-pointer" | "source-line" | "file" | "none"}
 */
export function classifyPath(path) {
  if (typeof path !== "string" || path.trim().length === 0) return "none"
  const text = path.trim()
  if (SOURCE_LINE.test(text)) return "source-line"
  const root = POINTER_ROOT.exec(text)
  if (root && MODEL_ROOTS.has(root[1])) return "model-pointer"
  return "file"
}

function pathKind(path, origin) {
  const natural = classifyPath(path)
  if (natural === "none") return "none"
  /* Происхождение сильнее формы: ядро файловых путей не выдаёт, ftsc —
     только их. */
  if (origin === "tool") return "file"
  if (origin === "core" && natural === "file") return "none"
  return natural
}

/**
 * Найти диапазон по пути канонической модели.
 *
 * Неизвестный хвост отбрасывается посегментно — подчёркивание сползает к
 * ближайшему известному предку, но никогда не теряется: диагностика о поле,
 * которого нет в разметке, всё равно укажет на своё правило.
 *
 * @param {import("./outline.mjs").outline extends (s: string) => infer T ? T : any} view
 * @param {string} path
 */
export function resolvePath(view, path) {
  if (!view?.byPath || typeof path !== "string") return null
  let current = path
  while (current.length > 0) {
    const node = view.byPath.get(current)
    if (node) return node.lineRange ?? node.range
    const cut = Math.max(current.lastIndexOf("."), current.lastIndexOf("["))
    if (cut <= 0) return null
    current = current.slice(0, cut)
  }
  return null
}

/** Строка `ожидается` примера, который не сошёлся. */
function exampleRange(view, diagnostic) {
  if (typeof diagnostic.utility !== "string" || typeof diagnostic.example !== "string") return null
  const utility = view?.utilities?.find((node) => node.name === diagnostic.utility)
  if (!utility) return null
  const example = utility.examples.find((node) => node.name === diagnostic.example)
  const target = example?.expectedNode ?? example ?? utility
  return target.valueRange ?? target.lineRange ?? null
}

/**
 * Строка, найденная по имени в кавычках внутри самого сообщения.
 *
 * Часть ошибок ядра приходит вообще без координат — «не найден морфизм «X»».
 * Имя в сообщении есть, и по нему строка находится однозначно.
 */
function quotedRange(view, message) {
  const quoted = /[«"']([^«»"']+)[»"']/u.exec(message ?? "")
  if (!quoted) return null
  const line = view?.logical?.find((item) => item.text.includes(quoted[1]))
  return line ? lineRange(line) : null
}

function lineRange(line) {
  return {
    start: { line: line.number, character: line.startChar },
    end: { line: line.number, character: line.endChar },
  }
}

/** Место в нумерации ядра: строки и колонки с единицы, конец строго за началом. */
function place(line, column, endLine, endColumn) {
  const start = { line: Math.max(1, line), column: Math.max(1, column) }
  let end = { line: Math.max(1, endLine), column: Math.max(1, endColumn) }
  if (end.line < start.line || (end.line === start.line && end.column <= start.column)) {
    end = { line: start.line, column: start.column + 1 }
  }
  return { line: start.line, column: start.column, endLine: end.line, endColumn: end.column }
}

function fromSpan(span) {
  return place(span.start.line, span.start.column, span.end.line, span.end.column)
}

function fromLsp(range) {
  return place(range.start.line + 1, range.start.character + 1, range.end.line + 1, range.end.character + 1)
}

/**
 * Диагностика → координаты в файле.
 *
 * @param {object} diagnostic диагностика ядра (`src/diagnostics.ts`) либо
 *   результат примера из `testUtilities` (`{ utility, example, expected, actual }`)
 * @param {object} view разметка из `outline()`
 * @param {{ origin?: "core" | "tool", fallback?: "document" | "none" }} [options]
 *   `origin` — происхождение диагностики, если вызывающий его знает;
 *   `fallback` — искать ли место для диагностики, у которой его нет вовсе
 *   (по умолчанию искать).
 * @returns {{ line: number, column: number, endLine: number, endColumn: number } | null}
 */
export function locate(diagnostic, view, options = {}) {
  if (!diagnostic || typeof diagnostic !== "object") return null
  const { origin, fallback = "document" } = options

  if (diagnostic.span?.start && diagnostic.span?.end) return fromSpan(diagnostic.span)

  const example = exampleRange(view, diagnostic)
  if (example) return fromLsp(example)

  switch (pathKind(diagnostic.path, origin)) {
    case "source-line": {
      const number = Number(SOURCE_LINE.exec(diagnostic.path.trim())[1])
      const line = view?.lines?.[number - 1]
      if (line) return fromLsp(lineRange(line))
      break
    }
    case "model-pointer": {
      const resolved = resolvePath(view, diagnostic.path.trim())
      if (resolved) return fromLsp(resolved)
      break
    }
    case "file":
      /* Путь к файлу — не координата внутри этого документа. */
      return null
    default:
      break
  }

  if (fallback === "none") return null

  const quoted = quotedRange(view, diagnostic.message)
  if (quoted) return fromLsp(quoted)

  /* Только содержательная строка. В документе, где содержания нет вовсе,
     «первая строка» — это выдуманная координата, а не найденная: пустой
     буфер подчёркивать нечем. */
  const first = view?.logical?.[0]
  return first ? fromLsp(lineRange(first)) : null
}

/**
 * Место в нумерации LSP: строки и символы с нуля.
 * @param {{ line: number, column: number, endLine: number, endColumn: number } | null} spot
 */
export function toLspRange(spot) {
  if (!spot) return null
  return {
    start: { line: spot.line - 1, character: spot.column - 1 },
    end: { line: spot.endLine - 1, character: spot.endColumn - 1 },
  }
}
