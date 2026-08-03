/**
 * Локальная доводка — меметическая часть поиска.
 *
 * Эволюция хорошо находит *структуру*: сколько правил, по каким полям, в каком
 * порядке. Числа она подбирает расточительно: чтобы порог сошёлся на 10000, а
 * процент — на 10, нужно, чтобы случайная мутация попала точно и отбор её
 * сохранил, а промежуточные значения часто хуже обоих соседей.
 *
 * Поэтому к лидеру каждого поколения применяются: покоординатный спуск по
 * числовым параметрам, перебор действия правила, перестановка соседних правил
 * и попытка выбросить каждое правило. Последнее — прямая реализация бритвы:
 * правило, без которого не хуже, из политики удаляется.
 *
 * Оператор остаётся чистым и работает через тот же критерий сравнения, что и
 * отбор: во взвешенном режиме — свёртка, в парето — доминирование. Никаких
 * скрытых весов внутри доводки нет.
 */
import { cloneIndividual } from "./individual.mjs"

/*
 * Шаги спуска: мелкие соседи плюс дальние прыжки.
 *
 * Только мелкие шаги — и порог доползает от случайного значения до нужного за
 * десяток проходов, а промежуточные значения нередко хуже обоих концов, и
 * спуск останавливается. Дальние прыжки делают из спуска дешёвый одномерный
 * поиск по лестнице кандидатов.
 */
const NUMERIC_STEPS = [-16, -8, -4, -2, -1, 1, 2, 4, 8, 16]

export function refine(individual, space, evaluate, isBetter, sweeps = 3) {
  let current = individual
  let score = evaluate(current)
  for (let sweep = 0; sweep < sweeps; sweep += 1) {
    let improved = false
    for (const knob of knobs(current, space)) {
      for (const trial of knob(current)) {
        const candidate = evaluate(trial)
        if (isBetter(candidate, score)) {
          current = trial
          score = candidate
          improved = true
        }
      }
    }
    if (!improved) break
  }
  return current
}

function knobs(individual, space) {
  const list = []
  individual.rules.forEach((rule, ruleIndex) => {
    rule.when.forEach((condition, conditionIndex) => {
      const field = space.fields.find((item) => item.name === condition.field)
      if (field?.kind !== "number" || condition.value.kind !== "value") return
      list.push((current) => neighbours(
        current,
        (next) => next.rules[ruleIndex]?.when[conditionIndex],
        (target) => field.thresholds.indexOf(target.value.value),
        (target, value) => { target.value = { kind: "value", value } },
        field.thresholds,
      ))
      // Строгое и нестрогое сравнение различаются ровно на одну точку сетки —
      // отдельной мутацией этот шаг делается редко, а здесь он бесплатен.
      list.push((current) => flips(current, ruleIndex, conditionIndex))
    })
    list.push((current) => actionNeighbours(current, ruleIndex, space))
    // Самый важный локальный ход. `то добавить` и `то результат равен`
    // отличаются одним словом, но эволюции этот шаг почти недоступен: в
    // модели, где все правила задают результат, переключение одного правила
    // на сложение сразу портит фитнес — исправить нужно все сразу. Спуск
    // проходит эту долину по одному правилу за проход.
    list.push((current) => switchKind(current, ruleIndex, space))
    // Порядок значим только для `то результат равен`; перестановка соседей —
    // ход, который мутация делает с вероятностью 3%.
    list.push((current) => (ruleIndex + 1 < current.rules.length ? [swapped(current, ruleIndex)] : []))
    list.push((current) => (current.rules.length > 1 ? [without(current, ruleIndex)] : []))
  })
  return list
}

/*
 * Полная замена действия правила: перебор «сложить/задать» на «круглом»
 * множестве операндов.
 *
 * Это лечит самый частый и самый упрямый промах синтеза. Эволюция находит
 * правильные условия («объём не меньше 50 и сумма не меньше 5000»), но
 * прикрепляет к ним `то результат равен 12 процентов от поля сумма` вместо
 * `то добавить 500`. Перейти от одного к другому нужно за один ход: и
 * `то добавить 12 процентов`, и `то результат равен 500` по отдельности хуже
 * обоих, поэтому ни мутация, ни покоординатный спуск эту долину не проходят.
 *
 * Перебор выглядит дорогим, но популяция сходится, лидер от поколения к
 * поколению тот же, а оценки кешируются по генотипу — фактически он
 * оплачивается один раз.
 */
const ROUND_PERCENTS = [1, 2, 3, 5, 10, 15, 20, 25, 30, 50]

function switchKind(individual, ruleIndex, space) {
  const action = individual.rules[ruleIndex]?.action
  if (!action) return []
  const kinds = space.outputKind === "number" ? ["add", "set"] : ["set"]
  const operands = space.constants.map((value) => ({ kind: "value", value }))
  if (space.outputKind === "number") {
    for (const field of space.numericFields) {
      for (const percent of ROUND_PERCENTS) operands.push({ kind: "percent", percent, field: field.name })
    }
  }
  const result = []
  for (const kind of kinds) {
    for (const value of operands) {
      if (kind === action.kind && sameOperand(value, action.value)) continue
      const next = cloneIndividual(individual)
      next.rules[ruleIndex].action = { kind, value }
      result.push(next)
    }
  }
  return result
}

function sameOperand(left, right) {
  return left.kind === right.kind
    && left.value === right.value
    && left.percent === right.percent
    && left.field === right.field
}

function swapped(individual, ruleIndex) {
  const next = cloneIndividual(individual)
  const swap = next.rules[ruleIndex]
  next.rules[ruleIndex] = next.rules[ruleIndex + 1]
  next.rules[ruleIndex + 1] = swap
  return next
}

function neighbours(individual, locate, indexOf, assign, ladder) {
  const anchor = locate(individual)
  if (!anchor) return []
  const current = indexOf(anchor)
  if (current < 0) return []
  const result = []
  for (const step of NUMERIC_STEPS) {
    const moved = current + step
    if (moved < 0 || moved >= ladder.length) continue
    const next = cloneIndividual(individual)
    const target = locate(next)
    if (!target) continue
    assign(target, ladder[moved])
    result.push(next)
  }
  return result
}

function flips(individual, ruleIndex, conditionIndex) {
  const condition = individual.rules[ruleIndex]?.when[conditionIndex]
  if (!condition) return []
  const pairs = { gte: "gt", gt: "gte", lte: "lt", lt: "lte" }
  const other = pairs[condition.operator]
  if (!other) return []
  const next = cloneIndividual(individual)
  next.rules[ruleIndex].when[conditionIndex].operator = other
  return [next]
}

function actionNeighbours(individual, ruleIndex, space) {
  const action = individual.rules[ruleIndex]?.action
  if (!action) return []
  if (action.value.kind === "percent") {
    return neighbours(
      individual,
      (next) => next.rules[ruleIndex]?.action,
      (target) => space.percents.indexOf(target.value.percent),
      (target, percent) => { target.value = { ...target.value, percent } },
      space.percents,
    )
  }
  if (action.value.kind === "value" && typeof action.value.value === "number") {
    return neighbours(
      individual,
      (next) => next.rules[ruleIndex]?.action,
      (target) => space.constants.indexOf(target.value.value),
      (target, value) => { target.value = { kind: "value", value } },
      space.constants,
    )
  }
  return []
}

function without(individual, ruleIndex) {
  const next = cloneIndividual(individual)
  next.rules.splice(ruleIndex, 1)
  return next
}
