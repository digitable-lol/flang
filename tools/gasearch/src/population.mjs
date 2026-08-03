/**
 * Особь и популяция.
 *
 * Особь здесь — это ровно запись полей входного объекта FTS-утилиты, без
 * лишнего слоя «хромосома → декодирование». Почему так: как только между
 * генотипом и входом утилиты появляется кодировка, фитнес перестаёт быть
 * читаемым — заказчик видит биты, а не «8 дневных смен». Прямое соответствие
 * «поле объекта = ген» сохраняет главное свойство затеи: спецификацию фитнеса
 * можно прочитать и обсудить до запуска поиска.
 *
 * Плата за это — ограниченный набор типов генов: число (с диапазоном и шагом)
 * и признак. Ровно то, что умеет объект FTS.
 */

export const NUMBER = "число"
export const BOOLEAN = "признак"

/** Тип поля канонической модели FTS → род гена. */
export function geneKind(type) {
  const bare = String(type ?? "").replace(/\s*\|\s*undefined\s*/gu, "").trim()
  if (bare === "Число" || bare === "Деньги") return NUMBER
  if (bare === "Признак") return BOOLEAN
  return null
}

/**
 * Спецификация генов: имена и роды берутся ИЗ модели, границы — из каталога.
 *
 * Разделение неслучайно. Род гена — факт о модели, и выдумывать его движку
 * нельзя: если в объекте написано «является признаком», гауссова мутация к
 * этому полю неприменима, и это должно всплыть как ошибка, а не как молчаливое
 * приведение типа. Границы же — свойство прикладной задачи («пул не больше
 * 64 соединений»), в модели FTS их выразить нечем, поэтому они приходят извне.
 */
export function buildSpec(document, structureName, ranges) {
  const structure = document.structures.find((item) => item.name === structureName)
  if (!structure) throw new Error(`в модели нет объекта «${structureName}»`)

  const genes = structure.fields.map((field) => {
    const kind = geneKind(field.type)
    if (kind === null) throw new Error(`поле «${field.name}» имеет тип «${field.type}», непригодный как ген`)
    if (field.type.includes("undefined")) throw new Error(`поле «${field.name}» необязательно; такие поля пока не поддерживаются`)

    if (kind === BOOLEAN) return { name: field.name, kind }

    const range = ranges?.[field.name]
    if (!range) throw new Error(`для числового поля «${field.name}» не задан диапазон`)
    const { min, max, step = 1 } = range
    if (!Number.isFinite(min) || !Number.isFinite(max)) throw new Error(`диапазон поля «${field.name}» не является конечным`)
    if (max < min) throw new Error(`диапазон поля «${field.name}» вывернут наизнанку`)
    if (!(step > 0)) throw new Error(`шаг поля «${field.name}» должен быть положительным`)
    return { name: field.name, kind, min, max, step }
  })

  const unknown = Object.keys(ranges ?? {}).filter((name) => !genes.some((gene) => gene.name === name))
  if (unknown.length > 0) throw new Error(`диапазоны заданы для полей, которых нет в объекте: ${unknown.join(", ")}`)

  return { structure: structureName, genes }
}

/**
 * Приведение числа к сетке поля.
 *
 * Округление к ближайшему узлу сетки, затем зажим в границы — именно в этом
 * порядке. Обратный порядок мог бы вытолкнуть значение за границу: округление
 * границы 3000 при шаге 400 дало бы 3200.
 */
export function quantize(gene, value) {
  const steps = Math.round((value - gene.min) / gene.step)
  const snapped = gene.min + steps * gene.step
  if (snapped < gene.min) return gene.min
  if (snapped > gene.max) return gene.max - ((gene.max - gene.min) % gene.step)
  return snapped
}

/** Случайная особь. Числа — по узлам сетки, признаки — честной монетой. */
export function randomIndividual(spec, stream) {
  const genes = {}
  for (const gene of spec.genes) {
    if (gene.kind === BOOLEAN) {
      genes[gene.name] = stream.fork(`ген:${gene.name}`).nextBool()
      continue
    }
    const nodes = Math.floor((gene.max - gene.min) / gene.step)
    genes[gene.name] = gene.min + stream.fork(`ген:${gene.name}`).nextInt(0, nodes) * gene.step
  }
  return genes
}

/**
 * Начальная популяция.
 *
 * Каждой особи — собственный подпоток по её номеру. Поэтому популяция из 50
 * особей и первые 50 особей популяции из 200 совпадают при одном семени: это
 * удобно при отладке и, что важнее, доказывает, что порядок здесь ни на что
 * не влияет.
 */
export function createPopulation(spec, size, stream) {
  if (!Number.isInteger(size) || size < 2) throw new Error("популяция должна содержать не меньше двух особей")
  return Array.from({ length: size }, (_unused, index) => randomIndividual(spec, stream.fork(`особь:${index}`)))
}

/** Копия генов в каноническом порядке полей — от него зависит стабильность JSON. */
export function cloneIndividual(spec, genes) {
  const copy = {}
  for (const gene of spec.genes) copy[gene.name] = genes[gene.name]
  return copy
}

/** Строковый ключ особи: сравнение на равенство и дедупликация без глубокого обхода. */
export function individualKey(spec, genes) {
  return spec.genes.map((gene) => `${gene.name}=${String(genes[gene.name])}`).join("|")
}

/** Все особи внутри границ и на сетке — инвариант, который проверяют тесты. */
export function withinBounds(spec, genes) {
  return spec.genes.every((gene) => {
    const value = genes[gene.name]
    if (gene.kind === BOOLEAN) return typeof value === "boolean"
    if (typeof value !== "number" || !Number.isFinite(value)) return false
    if (value < gene.min || value > gene.max) return false
    const steps = (value - gene.min) / gene.step
    return Math.abs(steps - Math.round(steps)) < 1e-9
  })
}
