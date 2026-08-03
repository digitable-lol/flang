/**
 * Операторы над особями.
 *
 * Каждый оператор — чистая функция `(особь, пространство, поток) -> особь`:
 * вход не мутируется, результат всегда новый объект. Это не эстетика.
 * Элита переносится в следующее поколение по ссылке, и оператор, меняющий
 * аргумент на месте, тихо испортил бы уже оценённую особь — такой баг
 * невоспроизводим и его невозможно поймать по фитнесу.
 *
 * Второй инвариант: ни один оператор не может породить особь, которая не
 * компилируется. Все значения берутся из кандидатов пространства поиска, типы
 * условий и действий сохраняются, число правил и условий держится в границах.
 */
import {
  cloneIndividual,
  randomAction,
  randomCondition,
  randomNumericOperand,
  randomRule,
} from "./individual.mjs"

export const MUTATIONS = [
  ["сдвинуть порог", shiftThreshold],
  ["сменить сравнение", changeComparison],
  ["изменить действие", tweakAction],
  ["добавить условие", addCondition],
  ["убрать условие", removeCondition],
  ["добавить правило", addRule],
  ["убрать правило", removeRule],
  ["переставить правила", swapRules],
  ["изменить начальное значение", changeInitial],
]

/**
 * Одна мутация случайного вида. Веса намеренно смещены к тонкой настройке
 * (порог, сравнение, действие): грубые структурные ходы нужны редко, но без
 * них поиск застревает в локальном оптимуме на фиксированном числе правил.
 */
export function mutate(individual, space, rng) {
  // Иногда за один ход делается несколько мутаций. Одиночная мутация не может
  // одновременно добавить правило и настроить его действие, а по отдельности
  // каждый из этих ходов ухудшает фитнес — отбор их отбрасывает, и целые
  // области пространства становятся недостижимыми.
  let next = mutateOnce(individual, space, rng)
  let extra = 0
  while (extra < 2 && rng.chance(0.3)) {
    next = mutateOnce(next, space, rng)
    extra += 1
  }
  return next
}

export function mutateOnce(individual, space, rng) {
  const weights = [22, 12, 26, 9, 9, 9, 7, 3, 3]
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let ticket = rng.next() * total
  for (let index = 0; index < MUTATIONS.length; index += 1) {
    ticket -= weights[index]
    if (ticket <= 0) return MUTATIONS[index][1](individual, space, rng)
  }
  return tweakAction(individual, space, rng)
}

export function shiftThreshold(individual, space, rng) {
  const targets = []
  individual.rules.forEach((rule, ruleIndex) => {
    rule.when.forEach((condition, conditionIndex) => {
      const field = space.fields.find((item) => item.name === condition.field)
      if (field?.kind === "number" && condition.value.kind === "value") targets.push([ruleIndex, conditionIndex])
    })
  })
  if (targets.length === 0) return changeComparison(individual, space, rng)
  const [ruleIndex, conditionIndex] = rng.pick(targets)
  const next = cloneIndividual(individual)
  const condition = next.rules[ruleIndex].when[conditionIndex]
  const field = space.fields.find((item) => item.name === condition.field)
  const current = field.thresholds.indexOf(condition.value.value)
  const step = rng.pick([-3, -2, -1, -1, 1, 1, 2, 3])
  const moved = current < 0 ? rng.int(field.thresholds.length) : clamp(current + step, 0, field.thresholds.length - 1)
  condition.value = { kind: "value", value: field.thresholds[moved] }
  return next
}

export function changeComparison(individual, space, rng) {
  const targets = collect(individual, () => true)
  if (targets.length === 0) return addRule(individual, space, rng)
  const [ruleIndex, conditionIndex] = rng.pick(targets)
  const next = cloneIndividual(individual)
  const condition = next.rules[ruleIndex].when[conditionIndex]
  const field = space.fields.find((item) => item.name === condition.field)
  // Порядковые сравнения ядро допускает только для чисел — иначе особь
  // перестала бы проходить `validate`.
  const options = field?.kind === "number" ? ["eq", "neq", "gte", "lte", "gt", "lt"] : ["eq", "neq"]
  const rest = options.filter((operator) => operator !== condition.operator)
  condition.operator = rng.pick(rest)
  return next
}

export function tweakAction(individual, space, rng) {
  const ruleIndex = rng.int(individual.rules.length)
  const next = cloneIndividual(individual)
  const action = next.rules[ruleIndex].action
  if (space.outputKind !== "number") {
    action.value = { kind: "value", value: rng.pick(space.constants) }
    return next
  }
  if (rng.chance(0.12)) {
    action.kind = action.kind === "add" ? "set" : "add"
    return next
  }
  if (action.value.kind === "percent" && rng.chance(0.8)) {
    const current = space.percents.indexOf(action.value.percent)
    const step = rng.pick([-5, -2, -1, -1, 1, 1, 2, 5])
    const moved = current < 0 ? rng.int(space.percents.length) : clamp(current + step, 0, space.percents.length - 1)
    action.value = { ...action.value, percent: space.percents[moved] }
    return next
  }
  if (action.value.kind === "value" && rng.chance(0.8)) {
    const current = space.constants.indexOf(action.value.value)
    const step = rng.pick([-2, -1, -1, 1, 1, 2])
    const moved = current < 0 ? rng.int(space.constants.length) : clamp(current + step, 0, space.constants.length - 1)
    action.value = { kind: "value", value: space.constants[moved] }
    return next
  }
  action.value = randomNumericOperand(space, rng)
  return next
}

export function addCondition(individual, space, rng) {
  const ruleIndex = rng.int(individual.rules.length)
  if (individual.rules[ruleIndex].when.length >= space.maxConditions) return shiftThreshold(individual, space, rng)
  const condition = randomCondition(space, rng)
  if (individual.rules[ruleIndex].when.some((item) => item.field === condition.field)) {
    return shiftThreshold(individual, space, rng)
  }
  const next = cloneIndividual(individual)
  next.rules[ruleIndex].when.push(condition)
  return next
}

export function removeCondition(individual, space, rng) {
  const targets = individual.rules
    .map((rule, index) => [index, rule.when.length])
    .filter(([, length]) => length > 1)
  // Правило без условий ядро отвергает («требует условие если»), поэтому
  // последнее условие не удаляем — удаляем правило целиком.
  if (targets.length === 0) return removeRule(individual, space, rng)
  const [ruleIndex] = rng.pick(targets)
  const next = cloneIndividual(individual)
  next.rules[ruleIndex].when.splice(rng.int(next.rules[ruleIndex].when.length), 1)
  return next
}

export function addRule(individual, space, rng) {
  if (individual.rules.length >= space.maxRules) return tweakAction(individual, space, rng)
  const next = cloneIndividual(individual)
  // Порядок значим: правило `то результат равен` перекрывает предыдущие.
  next.rules.splice(rng.between(0, next.rules.length), 0, randomRule(space, rng))
  return next
}

export function removeRule(individual, space, rng) {
  if (individual.rules.length <= 1) return addRule(individual, space, rng)
  const next = cloneIndividual(individual)
  next.rules.splice(rng.int(next.rules.length), 1)
  return next
}

export function swapRules(individual, space, rng) {
  if (individual.rules.length < 2) return addRule(individual, space, rng)
  const next = cloneIndividual(individual)
  const left = rng.int(next.rules.length)
  const right = rng.int(next.rules.length)
  const swap = next.rules[left]
  next.rules[left] = next.rules[right]
  next.rules[right] = swap
  return next
}

export function changeInitial(individual, space, rng) {
  const next = cloneIndividual(individual)
  next.initial = rng.pick(space.initials)
  return next
}

/**
 * Одноточечный кроссовер по списку правил: голова одной политики, хвост другой.
 * Порядок правил несёт смысл, поэтому режем список, а не перемешиваем его.
 */
export function crossoverRules(first, second, space, rng) {
  const cutFirst = rng.between(0, first.rules.length)
  const cutSecond = rng.between(0, second.rules.length)
  const rules = [...first.rules.slice(0, cutFirst), ...second.rules.slice(cutSecond)]
    .slice(0, space.maxRules)
    .map((rule) => ({
      when: rule.when.map((condition) => ({ ...condition, value: { ...condition.value } })),
      action: { kind: rule.action.kind, value: { ...rule.action.value } },
    }))
  if (rules.length === 0) rules.push(randomRule(space, rng))
  return { initial: rng.chance(0.5) ? first.initial : second.initial, rules }
}

/**
 * Обмен условиями внутри соответствующих правил. Кроссовер по списку правил
 * переносит блоки целиком и не умеет комбинировать посылки; этот оператор
 * добирает именно комбинирование условий двух похожих правил.
 */
export function crossoverConditions(first, second, space, rng) {
  const shared = Math.min(first.rules.length, second.rules.length)
  if (shared === 0) return cloneIndividual(first)
  const index = rng.int(shared)
  const next = cloneIndividual(first)
  const donor = second.rules[index].when
  const pool = [...next.rules[index].when, ...donor.map((condition) => ({ ...condition, value: { ...condition.value } }))]
  const chosen = []
  for (const condition of rng.shuffled(pool)) {
    if (chosen.length >= space.maxConditions) break
    if (!chosen.some((item) => item.field === condition.field)) chosen.push(condition)
  }
  next.rules[index].when = chosen.length > 0 ? chosen : next.rules[index].when
  return next
}

export function crossover(first, second, space, rng) {
  return rng.chance(0.7)
    ? crossoverRules(first, second, space, rng)
    : crossoverConditions(first, second, space, rng)
}

function collect(individual, predicate) {
  const targets = []
  individual.rules.forEach((rule, ruleIndex) => {
    rule.when.forEach((condition, conditionIndex) => {
      if (predicate(condition)) targets.push([ruleIndex, conditionIndex])
    })
  })
  return targets
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}
