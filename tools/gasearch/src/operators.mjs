/**
 * Генетические операторы: отбор, кроссовер, мутация.
 *
 * Все они — чистые функции вида «(вход, поток случайных чисел) → выход». Это
 * не эстетика: именно отсюда берётся воспроизводимость. Оператор не читает
 * глобальный генератор, не смотрит на счётчик поколений, не кэширует ничего
 * между вызовами. Дайте ему тех же родителей и поток с тем же именем — он
 * вернёт тех же потомков, независимо от того, что происходило в остальной
 * популяции и в каком порядке.
 *
 * Кандидаты на переезд в flang: кроссовер и мутация — это чистые
 * преобразования списков полей, то есть ровно то, для чего в flang есть
 * `отобразить` и списочные типы. Отбор потребует свёртки по популяции —
 * тоже встроенная форма. Пока коллекций в FTS нет, они живут здесь.
 */

import { BOOLEAN, cloneIndividual, quantize } from "./population.mjs"

/**
 * Турнирная селекция.
 *
 * Берём k случайных особей и возвращаем лучшую. Давление отбора регулируется
 * одним понятным числом k, а не температурой и не масштабом фитнеса — поэтому
 * турнир и стоит здесь умолчанием. Отдельно важно, что турнир не требует
 * положительности фитнеса: наши оценки бывают отрицательными.
 */
export function tournamentSelection(evaluated, tournamentSize, stream) {
  if (evaluated.length === 0) throw new Error("отбор из пустой популяции")
  const size = Math.max(2, Math.min(tournamentSize, evaluated.length))
  let champion = evaluated[stream.nextInt(0, evaluated.length - 1)]
  for (let round = 1; round < size; round += 1) {
    const challenger = evaluated[stream.nextInt(0, evaluated.length - 1)]
    if (better(challenger, champion)) champion = challenger
  }
  return champion
}

/**
 * Рулетка, пропорциональная фитнесу.
 *
 * Фитнес сдвигается так, чтобы худшая особь получила нулевой вес: иначе
 * отрицательные оценки дали бы отрицательные вероятности. Ко всем весам
 * добавляется малая доля размаха — без неё вырожденная популяция (все оценки
 * равны) обнулила бы сумму и рулетка перестала бы вращаться.
 *
 * Рулетка оставлена как альтернатива, а не как умолчание: она чувствительна к
 * масштабу фитнеса, и на моделях со ступенчатой оценкой ведёт себя заметно
 * хуже турнира. Это видно на прогонах и честно сказано в README.
 */
export function rouletteSelection(evaluated, stream) {
  if (evaluated.length === 0) throw new Error("отбор из пустой популяции")
  const values = evaluated.map((entry) => entry.fitness)
  const worst = Math.min(...values)
  const best = Math.max(...values)
  const floor = (best - worst) * 0.01 + Number.EPSILON
  const weights = values.map((value) => value - worst + floor)
  const total = weights.reduce((sum, weight) => sum + weight, 0)

  let ticket = stream.nextFloat() * total
  for (let index = 0; index < evaluated.length; index += 1) {
    ticket -= weights[index]
    if (ticket <= 0) return evaluated[index]
  }
  return evaluated[evaluated.length - 1]
}

/**
 * Одноточечный кроссовер.
 *
 * Точка разреза выбирается среди внутренних границ полей, поэтому потомок
 * всегда отличается от обоих родителей хотя бы возможностью отличаться:
 * разрез «до первого поля» или «после последнего» просто копировал бы
 * родителей и тратил поколение впустую.
 */
export function onePointCrossover(spec, first, second, stream) {
  const names = spec.genes.map((gene) => gene.name)
  if (names.length < 2) return [cloneIndividual(spec, first), cloneIndividual(spec, second)]
  const cut = stream.nextInt(1, names.length - 1)
  const left = {}
  const right = {}
  names.forEach((name, index) => {
    const fromFirst = index < cut
    left[name] = fromFirst ? first[name] : second[name]
    right[name] = fromFirst ? second[name] : first[name]
  })
  return [left, right]
}

/**
 * Равномерный кроссовер: каждое поле независимо берётся у одного из родителей.
 *
 * Он не сохраняет «сцепление» соседних полей — и это плюс, потому что порядок
 * полей в объекте FTS задан читаемостью спецификации, а не близостью их
 * влияния на оценку. Одноточечный кроссовер такому порядку доверяет,
 * равномерный — нет; поэтому оба и оставлены.
 */
export function uniformCrossover(spec, first, second, stream) {
  const left = {}
  const right = {}
  for (const gene of spec.genes) {
    const swap = stream.fork(`поле:${gene.name}`).nextBool()
    left[gene.name] = swap ? second[gene.name] : first[gene.name]
    right[gene.name] = swap ? first[gene.name] : second[gene.name]
  }
  return [left, right]
}

export const CROSSOVERS = {
  "одноточечный": onePointCrossover,
  "равномерный": uniformCrossover,
}

/**
 * Мутация: гауссова для чисел, переворот для признаков.
 *
 * Сигма задаётся долей размаха поля, а не абсолютным числом: у «таймаута»
 * размах 2950 мс, у «резервных смен» — 6, и одна и та же абсолютная сигма
 * означала бы для них совершенно разное. После сдвига значение обязательно
 * возвращается на сетку и в границы — иначе особь стала бы неотличима от
 * ошибки типа на входе утилиты FTS.
 *
 * Зажим, а не отражение и не заворачивание: границы поля здесь — это
 * эксплуатационные пределы («пул не бывает отрицательным»), и решение,
 * прижатое к границе, остаётся осмысленным ответом, тогда как завёрнутое
 * с одного конца на другой — уже нет.
 */
export function mutate(spec, genes, options, stream) {
  const rate = options?.rate ?? 0.1
  const sigmaFraction = options?.sigma ?? 0.15
  const mutated = {}
  for (const gene of spec.genes) {
    const geneStream = stream.fork(`мутация:${gene.name}`)
    if (!geneStream.nextBool(rate)) {
      mutated[gene.name] = genes[gene.name]
      continue
    }
    if (gene.kind === BOOLEAN) {
      mutated[gene.name] = !genes[gene.name]
      continue
    }
    const sigma = Math.max(gene.step, (gene.max - gene.min) * sigmaFraction)
    mutated[gene.name] = quantize(gene, genes[gene.name] + geneStream.nextGaussian() * sigma)
  }
  return mutated
}

/**
 * Порядок «лучше — хуже» на оценённых особях.
 *
 * Сравнение идёт по одному числу `fitness`, в которое уже вложено правило
 * обращения с недопустимыми особями (см. fitness.mjs). При равенстве побеждает
 * действующий чемпион — так сравнение остаётся детерминированным и не зависит
 * от того, в каком порядке равные особи попали в массив.
 */
export function better(candidate, current) {
  return candidate.fitness > current.fitness
}

/** Сортировка популяции от лучшей к худшей. Стабильна, поэтому воспроизводима. */
export function rankPopulation(evaluated) {
  return [...evaluated].sort((left, right) => right.fitness - left.fitness)
}
