/**
 * Разбор заголовка модуля и файла-функтора.
 *
 * Ядро FTS ничего не знает про модульность: оно компилирует один документ,
 * начинающийся со слова «категория». Поэтому ftsc снимает с файла свой
 * заголовок, а всё остальное отдаёт компилятору ядра дословно — любой
 * существующий .fts остаётся валидным модулем без единой правки.
 */
import { codes, fail } from "./diagnostics.mjs"

/* \b в JavaScript определяется по латинице, поэтому границу кириллического
   ключевого слова приходится задавать явно. */
const KEYWORD = (words) => new RegExp(`^\\s*(?:${words.join("|")})(?![\\p{L}])`, "u")

const HEADER_LINE = KEYWORD(["модуль", "использует", "экспортирует", "module", "uses", "exports"])
const FUNCTOR_LINE = KEYWORD(["функтор", "functor"])
const CATEGORY_LINE = KEYWORD(["категория", "category"])

/** Имя: «ёлочки», обычные кавычки или одно слово без пробелов. */
const NAME = '(?:«([^»]+)»|"([^"]+)"|([^\\s,«»"]+))'
const nameOf = (match, offset) => match[offset] ?? match[offset + 1] ?? match[offset + 2]

const MODULE = new RegExp(`^\\s*(?:модуль|module)\\s+${NAME}\\s*$`, "u")
const USES = new RegExp(`^\\s*(?:использует|uses)\\s+${NAME}\\s+(?:из|from)\\s+${NAME}\\s*$`, "u")
const EXPORTS = /^\s*(?:экспортирует|exports)\s+(.+)$/u
const FUNCTOR = new RegExp(`^\\s*(?:функтор|functor)\\s+${NAME}\\s+(?:из|from)\\s+${NAME}\\s+(?:в|to|into)\\s+${NAME}\\s*$`, "u")
const OBJECT_MAP = new RegExp(`^\\s*(?:объект|object)\\s+${NAME}\\s+(?:отображается в|maps to)\\s+${NAME}\\s*$`, "u")
const FIELD_MAP = new RegExp(`^\\s*(?:поле|field)\\s+${NAME}\\s+(?:отображается в поле|maps to field)\\s+${NAME}\\s*$`, "u")
const MORPHISM_MAP = new RegExp(
  `^\\s*(?:морфизм|morphism)\\s+${NAME}\\s+(?:отображается в морфизм|maps to morphism)\\s+${NAME}\\s*$`,
  "u",
)

const names = (list) =>
  list
    .split(",")
    .map((item) =>
      item
        .trim()
        .replace(/^[«"]|[»"]$/gu, "")
        .trim(),
    )
    .filter(Boolean)

/**
 * @returns {{ kind: 'module', name: string|null, imports: Array, exports: object|null, body: string }
 *          |{ kind: 'functor', name: string, from: string, to: string, imports: Array, objects: Array, morphisms: Array }}
 */
export function parseModuleFile(source, file) {
  const lines = source.split("\n")
  return FUNCTOR_LINE.test(firstMeaningful(lines)) ? parseFunctor(lines, file) : parseModule(lines, file)
}

function parseModule(lines, file) {
  const header = []
  let index = 0
  for (; index < lines.length; index += 1) {
    const line = lines[index]
    if (!line.trim() || /^\s*\/\//u.test(line)) {
      header.push(line)
      continue
    }
    if (CATEGORY_LINE.test(line)) break
    if (!HEADER_LINE.test(line)) break
    header.push(line)
  }

  let name = null
  const imports = []
  let exported = null

  for (const line of header) {
    if (!line.trim() || /^\s*\/\//u.test(line)) continue
    const module = MODULE.exec(line)
    if (module) {
      name = nameOf(module, 1)
      continue
    }
    const uses = USES.exec(line)
    if (uses) {
      imports.push({ category: nameOf(uses, 1), from: nameOf(uses, 4) })
      continue
    }
    const exports = EXPORTS.exec(line)
    if (exports) {
      exported = [...(exported ?? []), ...names(exports[1])]
      continue
    }
    throw fail(codes.moduleHeader, `не понимаю строку заголовка модуля: ${line.trim()}`, file)
  }

  /* Тело отдаётся ядру ровно как есть — включая переводы строк, чтобы номера
     строк в диагностиках ядра не разъезжались с исходным файлом. */
  const body = lines
    .slice(0, index)
    .map(() => "")
    .concat(lines.slice(index))
    .join("\n")
  return { kind: "module", name, imports, exports: exported, body }
}

function parseFunctor(lines, file) {
  let head = null
  const imports = []
  const objects = []
  const morphisms = []
  let current = null

  for (const line of lines) {
    if (!line.trim() || /^\s*\/\//u.test(line)) continue

    const functor = FUNCTOR.exec(line)
    if (functor) {
      if (head) throw fail(codes.functorHeader, "в одном файле объявлено больше одного функтора", file)
      head = { name: nameOf(functor, 1), from: nameOf(functor, 4), to: nameOf(functor, 7) }
      continue
    }
    if (!head) throw fail(codes.functorHeader, `перед объявлением функтора встретилась строка: ${line.trim()}`, file)

    const uses = USES.exec(line)
    if (uses) {
      imports.push({ category: nameOf(uses, 1), from: nameOf(uses, 4) })
      continue
    }
    const object = OBJECT_MAP.exec(line)
    if (object) {
      current = { from: nameOf(object, 1), to: nameOf(object, 4), fields: [] }
      objects.push(current)
      continue
    }
    const field = FIELD_MAP.exec(line)
    if (field) {
      if (!current) throw fail(codes.functorHeader, "отображение поля вне объекта", file)
      current.fields.push({ from: nameOf(field, 1), to: nameOf(field, 4) })
      continue
    }
    const morphism = MORPHISM_MAP.exec(line)
    if (morphism) {
      morphisms.push({ from: nameOf(morphism, 1), to: nameOf(morphism, 4) })
      current = null
      continue
    }
    throw fail(codes.functorHeader, `не понимаю строку функтора: ${line.trim()}`, file)
  }

  if (!head) throw fail(codes.functorHeader, "файл не содержит объявления функтора", file)
  return { kind: "functor", ...head, imports, objects, morphisms }
}

/* Первая значащая строка — первая, которая не пуста и не комментарий: файлы в
   этом репозитории принято начинать с шапки из //-комментариев. */
const firstMeaningful = (lines) => lines.find((line) => line.trim() && !/^\s*\/\//u.test(line)) ?? ""

export const isFunctorFile = (source) => FUNCTOR_LINE.test(firstMeaningful(source.split("\n")))
