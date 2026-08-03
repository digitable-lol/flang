/**
 * Эволюционный цикл.
 *
 * Два режима отбора:
 *
 *  - «взвешенный»: критерии свёрнуты в одно число с явными весами. Быстро,
 *    даёт один ответ, но веса — это уже принятое за аналитика решение о том,
 *    сколько точности стоит одно лишнее правило.
 *  - «парето»: недоминируемая сортировка (NSGA-II). Отбор ничего не
 *    взвешивает и возвращает фронт компромиссов; выбор одной модели остаётся
 *    за человеком. В SBSE это стандарт именно потому, что честнее.
 *
 * Разбиение на обучение и контроль делается до первого поколения и от
 * отдельного потока случайных чисел: иначе изменение параметров поиска
 * незаметно меняло бы выборку, и сравнение прогонов теряло бы смысл.
 */
import { createRng } from "./prng.mjs"
import { buildSpace } from "./schema.mjs"
import { cloneIndividual, randomIndividual } from "./individual.mjs"
import { crossover, mutate } from "./operators.mjs"
import { createScorer, crowdingDistance, dominates, keyOf, nonDominatedSort, objectiveVector } from "./fitness.mjs"
import { refine } from "./refine.mjs"

export const DEFAULTS = {
  seed: 42,
  generations: 600,
  population: 120,
  holdout: 0.3,
  elite: 4,
  tournament: 3,
  crossoverRate: 0.6,
  mutationRate: 0.9,
  patience: 30,
  pareto: false,
}

export function splitRows(rows, seed, holdout) {
  const rng = createRng(`split:${seed}`)
  const order = rng.shuffled(rows.map((_, index) => index))
  const count = Math.min(Math.max(1, Math.round(rows.length * holdout)), rows.length - 1)
  const held = new Set(order.slice(0, count))
  return {
    обучение: rows.filter((_, index) => !held.has(index)),
    контроль: rows.filter((_, index) => held.has(index)),
  }
}

export function synthesize(dataset, options = {}) {
  const settings = { ...DEFAULTS, ...options }
  const space = buildSpace(dataset, settings)
  const split = splitRows(dataset["наблюдения"], settings.seed, settings.holdout)
  const scorer = createScorer(space, split["обучение"], { weights: settings.weights })
  const rng = createRng(`ga:${settings.seed}`)
  const observe = settings.onIndividual ?? (() => {})

  let population = Array.from({ length: settings.population }, () => {
    const individual = randomIndividual(space, rng)
    observe(individual, 0)
    return individual
  })

  let best = null
  let bestGeneration = 0
  let bestFoundAt = 0
  let restarts = 0
  const history = []
  // Архив недоминируемых моделей. Популяция после перезапуска не помнит
  // прошлых компромиссов, а фронт обязан их пережить.
  let archive = []

  // Критерий «лучше» для локальной доводки — тот же, что у отбора.
  const isBetter = settings.pareto
    ? (candidate, current) => dominates(objectiveVector(candidate), objectiveVector(current))
    : (candidate, current) => candidate["фитнес"] < current["фитнес"]

  for (let generation = 1; generation <= settings.generations; generation += 1) {
    const rough = population.map((individual) => ({ individual, score: scorer.objectives(individual) }))
    // Доводится только лидер поколения: полный меметический прогон по всей
    // популяции стоит вдесятеро дороже и убивает разнообразие. Доведённая
    // особь занимает место худшей — это ламарковская схема, найденное
    // локальным поиском наследуется.
    const polished = refine(
      (settings.pareto ? paretoLeader(rough) : weightedLeader(rough)).individual,
      space,
      scorer.objectives,
      isBetter,
      settings.sweeps ?? 5,
    )
    observe(polished, generation)
    const ranked = settings.pareto ? paretoRanking(rough) : weightedRanking(rough)
    population = [...ranked.slice(0, population.length - 1).map((entry) => entry.individual), polished]
    const scored = population.map((individual) => ({ individual, score: scorer.objectives(individual) }))
    const leader = settings.pareto ? paretoLeader(scored) : weightedLeader(scored)
    if (best === null || better(leader.score, best.score, settings.pareto)) {
      best = { individual: cloneIndividual(leader.individual), score: leader.score }
      bestGeneration = generation
      bestFoundAt = generation
    }
    history.push({ поколение: generation, фитнес: leader.score["фитнес"], ошибка: leader.score["ошибка"], правил: leader.score["правил"] })
    if (settings.pareto) archive = mergeArchive(archive, population, scorer)

    if (generation === settings.generations) break

    const parents = settings.pareto ? paretoRanking(scored) : weightedRanking(scored)
    const offspring = []
    while (offspring.length < settings.population - settings.elite) {
      const first = tournament(parents, rng, settings.tournament)
      let child = first
      if (rng.chance(settings.crossoverRate)) {
        const second = tournament(parents, rng, settings.tournament)
        child = crossover(first, second, space, rng)
      }
      if (rng.chance(settings.mutationRate)) child = mutate(child, space, rng)
      if (child === first) child = cloneIndividual(first)
      observe(child, generation)
      offspring.push(child)
    }

    const elite = parents.slice(0, settings.elite).map((entry) => entry.individual)
    population = [...elite, ...offspring]

    /*
     * Перезапуск при застое.
     *
     * Популяция правил сходится к одному генотипу за несколько десятков
     * поколений: мутация перестаёт находить что-либо новое, а кроссовер
     * скрещивает копии. Подмешивать свежих особей в сошедшуюся популяцию
     * бесполезно — отбор выбивает их за два поколения, не дав им дойти до
     * конкурентного качества.
     *
     * Поэтому при застое популяция заменяется целиком. Лучшая найденная модель
     * живёт вне популяции (зал славы) и не мешает новому старту искать в
     * другом бассейне притяжения. Это классический multi-start, и в рамках
     * одного семени он остаётся полностью воспроизводимым.
     */
    if (generation - bestGeneration >= settings.patience) {
      population = Array.from({ length: settings.population }, () => {
        const individual = randomIndividual(space, rng)
        observe(individual, generation)
        return individual
      })
      bestGeneration = generation
      restarts += 1
    }
  }

  return {
    space,
    split,
    best: best.individual,
    обучение: scorer.measure(best.individual, split["обучение"]),
    контроль: scorer.measure(best.individual, split["контроль"]),
    фитнес: best.score["фитнес"],
    поколений: settings.generations,
    "найдено на поколении": bestFoundAt,
    "перезапусков": restarts,
    режим: settings.pareto ? "парето" : "взвешенный",
    веса: scorer.weights,
    история: history,
    фронт: settings.pareto ? describeFront(archive, scorer, split) : null,
  }
}

function mergeArchive(archive, population, scorer) {
  const unique = new Map()
  for (const individual of [...archive, ...population]) unique.set(keyOf(individual), individual)
  const candidates = [...unique.values()]
  const points = candidates.map((individual) => objectiveVector(scorer.objectives(individual)))
  const front = nonDominatedSort(points)[0] ?? []
  return front.map((index) => candidates[index])
}

function describeFront(archive, scorer, split) {
  // Разные генотипы с одинаковыми оценками остаются недоминируемыми и
  // заполняют фронт копиями. Аналитику нужен один представитель компромисса.
  const unique = new Map()
  for (const individual of archive) {
    const score = scorer.objectives(individual)
    const signature = objectiveVector(score).map((value) => value.toFixed(9)).join("|")
    if (!unique.has(signature)) unique.set(signature, individual)
  }
  return [...unique.values()]
    .map((individual) => ({ individual, score: scorer.objectives(individual) }))
    .sort((left, right) => left.score["ошибка"] - right.score["ошибка"] || left.score["сложность"] - right.score["сложность"])
    .map((entry) => ({
      правил: entry.score["правил"],
      условий: entry.score["условий"],
      "ошибка на обучении": entry.score["ошибка"],
      "ошибка на контроле": scorer.measure(entry.individual, split["контроль"])["ошибка"],
      нарушения: entry.score["нарушения"],
      особь: entry.individual,
    }))
}

function weightedRanking(scored) {
  return scored.slice().sort((left, right) => left.score["фитнес"] - right.score["фитнес"])
}

function weightedLeader(scored) {
  return weightedRanking(scored)[0]
}

/**
 * Ранжирование по Парето: сначала ранг фронта, внутри фронта — скученность
 * (чем изолированнее особь, тем ценнее: она держит разнообразие фронта).
 */
function paretoRanking(scored) {
  const points = scored.map((entry) => objectiveVector(entry.score))
  const fronts = nonDominatedSort(points)
  const ranked = []
  for (const front of fronts) {
    const distance = crowdingDistance(points, front)
    const sorted = front.slice().sort((left, right) => distance.get(right) - distance.get(left))
    for (const index of sorted) ranked.push(scored[index])
  }
  return ranked
}

/**
 * Из фронта нужно вернуть одну модель. Правило выбора объявлено явно: сначала
 * отбрасываются модели, нарушающие свойства, затем берётся точнейшая, а при
 * равной точности — простейшая. Весь фронт остаётся в отчёте `--json`.
 */
function paretoLeader(scored) {
  const points = scored.map((entry) => objectiveVector(entry.score))
  const front = nonDominatedSort(points)[0] ?? scored.map((_, index) => index)
  const candidates = front.map((index) => scored[index])
  const clean = candidates.filter((entry) => entry.score["нарушения"] === 0)
  const pool = clean.length > 0 ? clean : candidates
  return pool.slice().sort((left, right) =>
    left.score["нарушения"] - right.score["нарушения"]
    || left.score["ошибка"] - right.score["ошибка"]
    || left.score["сложность"] - right.score["сложность"])[0]
}

function better(candidate, current, pareto) {
  if (!pareto) return candidate["фитнес"] < current["фитнес"]
  if (candidate["нарушения"] !== current["нарушения"]) return candidate["нарушения"] < current["нарушения"]
  if (candidate["ошибка"] !== current["ошибка"]) return candidate["ошибка"] < current["ошибка"]
  return candidate["сложность"] < current["сложность"]
}

function tournament(ranked, rng, size) {
  let winner = rng.int(ranked.length)
  for (let index = 1; index < size; index += 1) winner = Math.min(winner, rng.int(ranked.length))
  return ranked[winner].individual
}

