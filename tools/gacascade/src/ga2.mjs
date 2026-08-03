/**
 * Уровень GA2 — поиск плана назначений.
 *
 * Источник: раздел 2.4.1 диссертации. Дословно оттуда:
 *
 *   «Хромосома A = (a_1,…,a_n) задаёт исполнителя каждой задачи. По ней
 *    детерминированно строится расписание и вычисляется J_p. Начальная
 *    популяция содержит случайные и конструктивные назначения. На каждом
 *    поколении выполняются турнирная селекция, сохранение элиты,
 *    одноточечный или масочный кроссовер и мутация исполнителя.»
 *
 * и список действий при фиксированной θ = (N_pop, p_mut, p_cross):
 *
 *   1) сформировать N_pop назначений и оценить их;
 *   2) сохранить не менее двух лучших назначений;
 *   3) выбрать родителей турниром по минимальному J_p;
 *   4) применить кроссовер и мутацию;
 *   5) построить расписание и заново вычислить Q и J_p;
 *   6) сохранить лучшее назначение и траекторию J_p.
 *
 * ЧТО ВЗЯТО ИЗ gasearch И ПОЧЕМУ. Отбор, кроссоверы, ранжирование, сравнение
 * особей, генерация случайной особи, клонирование и ключ особи импортированы
 * из tools/gasearch: это ровно те чистые функции, которые описывает автор, и
 * переписывать их значило бы завести вторую реализацию воспроизводимости.
 * Дисциплина имён потоков скопирована из gasearch/src/evolve.mjs дословно:
 *
 *   корень
 *     └ "начальная популяция" ─ "особь:i"
 *     └ "поколение:g"
 *          └ "пара:j"
 *               ├ "родитель:1" / "родитель:2"
 *               ├ "кроссовер"
 *               └ "мутация:1" / "мутация:2"
 *
 * ЧТО НЕ ВЗЯТО. Мутация. В gasearch числовой ген мутируется гауссовым сдвигом
 * с зажимом в границы — это правильно для «размера пула» и «таймаута», где
 * соседние значения близки по смыслу. Номер исполнителя — величина
 * НОМИНАЛЬНАЯ: исполнитель 3 не «между» исполнителями 2 и 4, и гауссов сдвиг
 * означал бы выдуманное отношение соседства. Автор пишет «мутация
 * исполнителя», то есть замена на другого исполнителя. Она реализована здесь
 * (`mutateAssignment`) с той же дисциплиной потоков, что у gasearch.
 *
 * Цикл поколений тоже свой, а не `evolve` из gasearch: там останов бывает
 * только по числу поколений или по стагнации, а GA2 обязан останавливаться по
 * ИСЧЕРПАНИЮ БЮДЖЕТА ОЦЕНОК и допускать вмешательство GA0 после каждого
 * поколения.
 */

import { NUMBER, cloneIndividual, individualKey, randomIndividual } from "../../gasearch/src/population.mjs"
import { CROSSOVERS, better, rankPopulation, tournamentSelection } from "../../gasearch/src/operators.mjs"
import { median, readiness, WINDOW } from "./readiness.mjs"
import { greedyAssignment } from "./scenario.mjs"

/**
 * Три конфигурации GA1 — таблица раздела 2.4.2.
 *
 * Значения зафиксированы до основной серии (раздел 3.3.1) и не подбирались
 * под результат: они переписаны из диссертации как есть.
 */
export const CONFIGURATIONS = {
  compact: { "N_pop": 32, "p_mut": 0.06, "p_cross": 0.80 },
  balanced: { "N_pop": 48, "p_mut": 0.10, "p_cross": 0.82 },
  exploratory: { "N_pop": 64, "p_mut": 0.18, "p_cross": 0.85 },
}

/** Конфигурация одноуровневого режима и финального GA2 по умолчанию — раздел 2.4.4: «фиксированная balanced». */
export const DEFAULT_CONFIGURATION = "balanced"

export const GA2_DEFAULTS = {
  "элита": 2,
  "размер турнира": 3,
  "кроссовер": "равномерный",
}

export function configurationNames() {
  return Object.keys(CONFIGURATIONS)
}

/** Имя гена задачи. Хромосома — объект, чтобы операторы gasearch применялись без переходников. */
export function geneName(index) {
  return `задача:${index}`
}

/** Спецификация генов для сценария: n номинальных полей со значениями 0…M−1. */
export function buildAssignmentSpec(scenario) {
  const executors = scenario["исполнителей"]
  return {
    structure: "Назначение задач",
    genes: Array.from({ length: scenario["задач"] }, (_unused, index) => ({
      name: geneName(index),
      kind: NUMBER,
      min: 0,
      max: executors - 1,
      step: 1,
    })),
  }
}

/** Хромосома → массив исполнителей по задачам. */
export function toAssignment(spec, genes) {
  return spec.genes.map((gene) => genes[gene.name])
}

/** Массив исполнителей → хромосома. */
export function fromAssignment(spec, assignment) {
  const genes = {}
  spec.genes.forEach((gene, index) => {
    genes[gene.name] = assignment[index]
  })
  return genes
}

/**
 * Мутация исполнителя (раздел 2.4.1).
 *
 * Каждый ген независимо с вероятностью p_mut получает ДРУГОГО исполнителя,
 * выбранного равновероятно из остальных. Именно «другого», а не «случайного
 * из всех»: при равновероятном выборе из всех M исполнителей мутация с
 * вероятностью 1/M не меняет ничего, и фактическая интенсивность мутации
 * оказалась бы p_mut·(M−1)/M — то есть на 20% ниже заявленной при M = 5 и на
 * 5% при M = 20. Тогда конфигурации compact/balanced/exploratory сравнивались
 * бы не по тем p_mut, которые записаны в диссертации.
 *
 * Оператор чистый: результат определяется аргументами и именем потока.
 */
export function mutateAssignment(spec, genes, rate, stream) {
  const mutated = {}
  for (const gene of spec.genes) {
    const own = stream.fork(`мутация:${gene.name}`)
    const current = genes[gene.name]
    if (gene.max === gene.min || !own.nextBool(rate)) {
      mutated[gene.name] = current
      continue
    }
    const shift = own.nextInt(1, gene.max - gene.min)
    mutated[gene.name] = gene.min + (((current - gene.min) + shift) % (gene.max - gene.min + 1))
  }
  return mutated
}

/**
 * Начальная популяция: «случайные и конструктивные назначения» (раздел 2.4.1).
 *
 * Особь 0 — жадный конструктивный план, особь 1 — действующий план X_0.
 * Остальные случайны. Две конструктивные особи из 32…64 — это меньше 7%
 * популяции: достаточно, чтобы поиск не начинал с нуля, и слишком мало, чтобы
 * подменить поиск затравкой.
 */
function initialPopulation(spec, scenario, size, stream) {
  const population = []
  population.push(fromAssignment(spec, greedyAssignment(scenario)))
  if (size > 1) population.push(fromAssignment(spec, scenario["действующий план"]))
  for (let index = population.length; index < size; index += 1) {
    population.push(randomIndividual(spec, stream.fork(`особь:${index}`)))
  }
  return population
}

/**
 * Прогон GA2 при фиксированной конфигурации.
 *
 * @param options.scenario     экземпляр сценария
 * @param options.spec         спецификация генов
 * @param options.evaluatePlan оценщик плана (fitness.mjs)
 * @param options.configuration θ = (N_pop, p_mut, p_cross)
 * @param options.budget       бюджет оценок (budget.mjs); списывается по N_pop за поколение
 * @param options.stream       поток случайности этого прогона
 * @param options.cmin         порог ранней остановки GA0; null — GA0 выключен
 * @param options.options      элита, размер турнира, вид кроссовера
 */
export function runGA2({ scenario, spec, evaluatePlan, configuration, budget, stream, cmin = null, options = {} }) {
  const settings = { ...GA2_DEFAULTS, ...options }
  const populationSize = configuration["N_pop"]
  const mutationRate = configuration["p_mut"]
  const crossoverRate = configuration["p_cross"]
  const elite = Math.min(settings["элита"], populationSize - 1)
  const recombine = CROSSOVERS[settings["кроссовер"]]
  if (!recombine) throw new Error(`неизвестный кроссовер «${settings["кроссовер"]}»; доступны: ${Object.keys(CROSSOVERS).join(", ")}`)
  if (elite < 2 && populationSize > 2) throw new Error("раздел 2.4.1 требует сохранять не менее двух лучших назначений")

  // Кэш оценок: фитнес — чистая функция, запоминание не меняет результат ни на
  // бит. На бюджет он НЕ влияет (раздел 2.4.1: бюджет растёт ровно на размер
  // популяции), но показывает, сколько РАЗНЫХ планов поиск действительно
  // посмотрел, — это честная мера исследования пространства.
  const cache = new Map()
  let distinct = 0
  const scoreOf = (genes) => {
    const key = individualKey(spec, genes)
    const cached = cache.get(key)
    if (cached) return { ...cached, genes }
    distinct += 1
    const evaluation = evaluatePlan(toAssignment(spec, genes))
    // Фитнес — величина «больше лучше», как того ждут операторы gasearch.
    // J_p минимизируется, поэтому знак меняется здесь и больше нигде.
    const entry = { genes, ...evaluation, fitness: -evaluation["J_p"], feasible: evaluation["допустим"] }
    cache.set(key, entry)
    return entry
  }

  if (!budget.canAfford(populationSize)) {
    throw new Error(`бюджета ${budget.remaining} не хватает даже на начальную популяцию ${populationSize}`)
  }

  let population = initialPopulation(spec, scenario, populationSize, stream.fork("начальная популяция"))
  budget.spend(populationSize)
  let evaluated = population.map(scoreOf)
  let champion = rankPopulation(evaluated)[0]

  // J_p(X_0) в формуле улучшения I(t) — функционал ЛУЧШЕГО плана начальной
  // популяции (раздел 2.3: «улучшение относительно начального решения»).
  const initialJp = champion["J_p"]
  const trajectory = [initialJp]

  const history = [generationRecord(0, evaluated, champion, initialJp, trajectory, budget)]
  let stop = "исчерпан бюджет"
  let generation = 0

  while (budget.canAfford(populationSize)) {
    generation += 1
    const generationStream = stream.fork(`поколение:${generation}`)
    const ranked = rankPopulation(evaluated)
    const next = ranked.slice(0, elite).map((entry) => cloneIndividual(spec, entry.genes))

    let pair = 0
    while (next.length < populationSize) {
      const pairStream = generationStream.fork(`пара:${pair}`)
      pair += 1

      const first = tournamentSelection(evaluated, settings["размер турнира"], pairStream.fork("родитель:1")).genes
      const second = tournamentSelection(evaluated, settings["размер турнира"], pairStream.fork("родитель:2")).genes

      // Поток кроссовера расходуется всегда, даже когда рекомбинация не
      // происходит: иначе изменение p_cross сдвигало бы всю дальнейшую выдачу
      // и конфигурации GA1 нельзя было бы сравнивать на общем seed.
      const crossoverStream = pairStream.fork("кроссовер")
      const [childA, childB] = crossoverStream.nextBool(crossoverRate)
        ? recombine(spec, first, second, crossoverStream)
        : [cloneIndividual(spec, first), cloneIndividual(spec, second)]

      next.push(mutateAssignment(spec, childA, mutationRate, pairStream.fork("мутация:1")))
      if (next.length < populationSize) next.push(mutateAssignment(spec, childB, mutationRate, pairStream.fork("мутация:2")))
    }

    population = next
    budget.spend(populationSize)
    evaluated = population.map(scoreOf)
    const best = rankPopulation(evaluated)[0]
    if (better(best, champion)) champion = best
    trajectory.push(champion["J_p"])

    const record = generationRecord(generation, evaluated, champion, initialJp, trajectory, budget)
    history.push(record)

    // GA0. Раздел 2.4.3: N* = min{ N ≤ N_max | c(N) ≥ c_min }, причём условие
    // проверяется только после заполнения окна устойчивости из пяти поколений.
    if (cmin !== null && record["готовность"]["окно заполнено"] && record["готовность"]["c"] >= cmin) {
      stop = "готовность достигнута"
      break
    }
  }

  return {
    "конфигурация": configuration,
    "поколений": generation,
    "оценок": history.length * populationSize,
    "останов": stop,
    "лучший": champion,
    "J_p начальный": initialJp,
    "готовность": history[history.length - 1]["готовность"],
    "история": history,
    "разных планов": distinct,
  }
}

function generationRecord(generation, evaluated, champion, initialJp, trajectory, budget) {
  const values = evaluated.map((entry) => entry["J_p"])
  const medianJp = median(values)
  return {
    "поколение": generation,
    "J_p лучший": champion["J_p"],
    "J_p медиана": medianJp,
    "Δ лучший": champion["Δ"],
    "допустимых в популяции": evaluated.filter((entry) => entry["допустим"]).length,
    "оценок всего": budget.spent,
    // Окно устойчивости считается заполненным только начиная с пятого
    // поколения (раздел 2.4.5, шаг 5: «После пятого поколения вычислять c»).
    // Начальная популяция — поколение 0, поэтому пяти ЗАПИСЕЙ в траектории
    // мало: нужны пять ПОКОЛЕНИЙ поиска. При более мягком прочтении GA0
    // получил бы право остановиться на одно поколение раньше.
    "готовность": readiness({
      delta: champion["Δ"],
      initialJp,
      bestJp: champion["J_p"],
      medianJp,
      window: generation >= WINDOW ? trajectory.slice(-WINDOW) : [],
    }),
  }
}
