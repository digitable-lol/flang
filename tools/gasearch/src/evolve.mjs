/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Цикл поколений.
 *
 * Это самая обыкновенная часть инструмента, и так и задумано: эволюция —
 * обычный код, проверяемая часть вынесена в FTS. Единственное, что здесь
 * действительно требует внимания, — дисциплина потоков случайности.
 *
 * Правило именования потоков (нарушать его нельзя, иначе развалится
 * воспроизводимость):
 *
 *   корень
 *     └ "начальная популяция" ─ "особь:i"        инициализация
 *     └ "поколение:g"
 *          └ "пара:j"
 *               ├ "родитель:1" / "родитель:2"    отбор
 *               ├ "кроссовер"                    рекомбинация
 *               └ "мутация:1" / "мутация:2"      мутация
 *
 * Имя потока — путь в этом дереве, а не порядковый номер обращения. Поэтому
 * ответ не зависит ни от порядка обхода пар, ни от того, сколько чисел
 * израсходовал соседний оператор, ни от кэша фитнеса.
 */

import { createStream } from "./random.mjs"
import { createPopulation, cloneIndividual, individualKey } from "./population.mjs"
import { CROSSOVERS, mutate, rankPopulation, rouletteSelection, tournamentSelection } from "./operators.mjs"

export const DEFAULTS = {
  populationSize: 50,
  generations: 100,
  elite: 2,
  selection: "турнирная",
  tournamentSize: 3,
  crossover: "равномерный",
  crossoverRate: 0.9,
  mutationRate: 0.15,
  mutationSigma: 0.15,
  stagnation: 0,
}

function selector(name) {
  if (name === "турнирная") return (evaluated, options, stream) => tournamentSelection(evaluated, options.tournamentSize, stream)
  if (name === "рулетка") return (evaluated, _options, stream) => rouletteSelection(evaluated, stream)
  throw new Error(`неизвестная селекция «${name}»; доступны: турнирная, рулетка`)
}

function crossoverByName(name) {
  const operator = CROSSOVERS[name]
  if (!operator) throw new Error(`неизвестный кроссовер «${name}»; доступны: ${Object.keys(CROSSOVERS).join(", ")}`)
  return operator
}

function summarize(generation, evaluated) {
  const feasible = evaluated.filter((entry) => entry.feasible)
  const best = rankPopulation(evaluated)[0]
  const mean = feasible.length === 0 ? null : feasible.reduce((sum, entry) => sum + entry.score, 0) / feasible.length
  return {
    "поколение": generation,
    "лучший фитнес": best.fitness,
    "лучшая оценка": best.score,
    "средняя оценка допустимых": mean,
    "допустимых": feasible.length,
    "всего": evaluated.length,
  }
}

/**
 * Прогон эволюции.
 *
 * @param options.spec     спецификация генов (population.mjs)
 * @param options.evaluate функция оценки (fitness.mjs)
 * @param options.seed     целое семя прогона
 * @param options.options  параметры поиска, см. DEFAULTS
 */
export function evolve({ spec, evaluate, seed, options = {} }) {
  const settings = { ...DEFAULTS, ...options }
  const select = selector(settings.selection)
  const recombine = crossoverByName(settings.crossover)
  if (settings.elite < 0 || settings.elite >= settings.populationSize) {
    throw new Error("элита должна быть неотрицательной и меньше размера популяции")
  }

  const root = createStream(seed)

  // Кэш оценок. Фитнес — чистая функция, поэтому запоминание не меняет
  // результат ни на бит; оно лишь показывает, сколько РАЗНЫХ особей поиск
  // на самом деле посмотрел. Для дорогого фитнеса эта цифра была бы главной.
  const cache = new Map()
  let utilityCalls = 0
  const scoreOf = (genes) => {
    const key = individualKey(spec, genes)
    const cached = cache.get(key)
    if (cached) return { ...cached, genes }
    utilityCalls += 1
    const fresh = evaluate(genes)
    cache.set(key, fresh)
    return fresh
  }

  let population = createPopulation(spec, settings.populationSize, root.fork("начальная популяция"))
  let evaluated = population.map(scoreOf)
  let champion = rankPopulation(evaluated)[0]
  const history = [summarize(0, evaluated)]

  let stop = "исчерпаны поколения"
  let lastImprovement = 0
  let generation = 0

  for (generation = 1; generation <= settings.generations; generation += 1) {
    const generationStream = root.fork(`поколение:${generation}`)
    const ranked = rankPopulation(evaluated)
    const next = ranked.slice(0, settings.elite).map((entry) => cloneIndividual(spec, entry.genes))

    let pair = 0
    while (next.length < settings.populationSize) {
      const pairStream = generationStream.fork(`пара:${pair}`)
      pair += 1

      const first = select(evaluated, settings, pairStream.fork("родитель:1")).genes
      const second = select(evaluated, settings, pairStream.fork("родитель:2")).genes

      const crossoverStream = pairStream.fork("кроссовер")
      // Поток кроссовера расходуется всегда, даже когда рекомбинация не
      // происходит: иначе изменение crossoverRate сдвигало бы всю дальнейшую
      // выдачу, и сравнивать два прогона было бы не с чем.
      const doCross = crossoverStream.nextBool(settings.crossoverRate)
      const [childA, childB] = doCross
        ? recombine(spec, first, second, crossoverStream)
        : [cloneIndividual(spec, first), cloneIndividual(spec, second)]

      const mutationOptions = { rate: settings.mutationRate, sigma: settings.mutationSigma }
      next.push(mutate(spec, childA, mutationOptions, pairStream.fork("мутация:1")))
      if (next.length < settings.populationSize) {
        next.push(mutate(spec, childB, mutationOptions, pairStream.fork("мутация:2")))
      }
    }

    population = next
    evaluated = population.map(scoreOf)
    const best = rankPopulation(evaluated)[0]
    if (best.fitness > champion.fitness) {
      champion = best
      lastImprovement = generation
    }
    history.push(summarize(generation, evaluated))

    if (settings.stagnation > 0 && generation - lastImprovement >= settings.stagnation) {
      stop = `стагнация ${settings.stagnation} поколений`
      break
    }
  }

  const completed = Math.min(generation, settings.generations)
  return {
    "семя": String(seed),
    "поколений": completed,
    "останов": stop,
    "лучшая особь": {
      "гены": cloneIndividual(spec, champion.genes),
      "оценка": champion.score,
      "фитнес": champion.fitness,
      "допустима": champion.feasible,
      "причина недопустимости": champion.reason,
    },
    "найдено в поколении": lastImprovement,
    "разных особей": cache.size,
    "вызовов утилиты FTS": utilityCalls,
    "история": history,
    "параметры": settings,
  }
}
