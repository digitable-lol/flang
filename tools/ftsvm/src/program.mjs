/**
 * Навигация по IR (tools/ftsc/SPEC.md, раздел 4) и проверка входа.
 *
 * IR — единственный контракт, который знает ftsvm: ни .fts, ни путей, ни
 * компилятора ядра. Всё, что делает этот модуль, — находит утилиту в
 * программе и проверяет входные данные ровно теми же правилами, что и
 * executeUtility ядра: недостающее поле, чужое поле, несовпадение типа.
 */
import { vmError } from "./errors.mjs"

/**
 * Модули программы.
 * @param {object} program
 */
export function listModules(program) {
  return Array.isArray(program?.modules) ? program.modules : []
}

/**
 * @param {object} program
 * @param {string} moduleName
 */
export function findModule(program, moduleName) {
  const found = listModules(program).find((item) => item.name === moduleName || item.category === moduleName)
  if (!found) throw vmError("FTSVM_UNKNOWN_MODULE", `не найден модуль «${moduleName}»`)
  return found
}

/**
 * Имена утилит: модуля, если он назван, иначе всей программы.
 * Документ без утилит (фикстура shipment — только морфизмы и теорема)
 * даёт пустой список, а не исключение: отсутствие вычислений — законное
 * состояние модели, а не поломка исполнителя.
 * @param {object} program
 * @param {string | null | undefined} moduleName
 */
export function listUtilities(program, moduleName = null) {
  const modules = moduleName == null ? listModules(program) : [findModule(program, moduleName)]
  const names = []
  for (const module of modules) {
    for (const utility of module.document?.utilities ?? []) names.push({ module: module.name, utility: utility.name })
  }
  return names
}

/**
 * Находит утилиту и её входную структуру.
 *
 * Если модуль не назван, утилита ищется по всей программе; неоднозначность
 * — ошибка, а не «первая попавшаяся»: два модуля могут объявлять утилиту с
 * одним именем, и молчаливый выбор одного из них был бы худшим из исходов.
 *
 * @param {object} program
 * @param {string | null | undefined} moduleName
 * @param {string} utilityName
 */
export function findUtility(program, moduleName, utilityName) {
  const modules = moduleName == null ? listModules(program) : [findModule(program, moduleName)]
  const matches = []
  for (const module of modules) {
    const utility = (module.document?.utilities ?? []).find((item) => item.name === utilityName)
    if (utility) matches.push({ module, utility })
  }
  if (matches.length === 0) {
    // Код и текст ядра: для вызывающего «нет такой утилиты» звучит одинаково.
    throw vmError("FTS_UNKNOWN_UTILITY", `не найдена утилита «${utilityName}»`)
  }
  if (matches.length > 1) {
    const where = matches.map((item) => `«${item.module.name}»`).join(", ")
    throw vmError("FTSVM_AMBIGUOUS_UTILITY", `утилита «${utilityName}» объявлена в нескольких модулях: ${where}`)
  }
  const [{ module, utility }] = matches
  const structure = (module.document?.structures ?? []).find((item) => item.name === utility.input)
  if (!structure) {
    throw vmError("FTS_UTILITY_INPUT", `не найдена входная структура «${utility.input}»`)
  }
  return { module, utility, structure }
}

/**
 * Проверка значения на соответствие типу FTS — копия matchesRuntimeType ядра.
 * Отдельно отвергается -0: в модели денег и счётчиков «минус ноль» не
 * значение, а след ошибки вычисления, и ядро его не пропускает.
 * @param {unknown} value
 * @param {string} type
 */
export function matchesRuntimeType(value, type) {
  const normalized = type.replace(/\s*\|\s*undefined/gu, "")
  if (normalized === "Строка" || normalized === "Дата" || normalized === "string") return typeof value === "string"
  if (normalized === "Число" || normalized === "Деньги" || normalized === "number") {
    return typeof value === "number" && Number.isFinite(value) && !Object.is(value, -0)
  }
  if (normalized === "Признак" || normalized === "boolean") return typeof value === "boolean"
  return true
}

/** Поле объявлено необязательным («иногда является»). @param {{ type: string }} field */
export function isOptional(field) {
  return field.type.includes("undefined")
}

/**
 * Проверка входа перед исполнением — тот же порядок, что в executeUtility:
 * сначала поля структуры по порядку объявления (отсутствие, затем тип),
 * потом чужие поля по порядку ключей объекта. Порядок важен: при нескольких
 * дефектах сразу оба движка обязаны сообщить об одном и том же.
 *
 * @param {{ name: string, fields: Array<{ name: string, type: string }> }} structure
 * @param {Record<string, unknown>} input
 */
export function checkInput(structure, input) {
  for (const field of structure.fields) {
    if (!(field.name in input)) {
      if (!isOptional(field)) {
        throw vmError("FTS_UTILITY_INPUT", `во входных данных отсутствует поле «${field.name}»`)
      }
      continue
    }
    if (!matchesRuntimeType(input[field.name], field.type)) {
      throw vmError("FTS_UTILITY_INPUT_TYPE", `поле «${field.name}» не соответствует типу «${field.type}»`)
    }
  }
  for (const field of Object.keys(input)) {
    if (!structure.fields.some((item) => item.name === field)) {
      throw vmError("FTS_UTILITY_INPUT_FIELD", `входная структура «${structure.name}» не содержит поле «${field}»`)
    }
  }
}
