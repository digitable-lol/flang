/**
 * Синтетические сценарии планирования итерации.
 *
 * Источник: раздел 3.3.1 диссертации — три класса сценариев
 * (`dense_dependencies`, `priority_changes`, `noisy_inputs`), три размерности
 * S/M/L и таблица интенсивностей возмущения. Плотность зависимостей 0,10 для
 * первого класса и 0,04 для двух остальных — оттуда же.
 *
 * ЧЕСТНОСТЬ ДАННЫХ. Данные синтетические, и это не смягчающее обстоятельство,
 * а условие эксперимента: раздел 3.3 прямо говорит, что цель — проверить
 * свойства модели и алгоритма, а не заявить промышленную экономию. Ни один
 * вывод, полученный на этих сценариях, не переносится на реальный проектный
 * контур.
 *
 * ДИСЦИПЛИНА СЛУЧАЙНОСТИ. Каждая сущность получает подпоток от своего ИМЕНИ,
 * а не от порядкового номера обращения (см. gasearch/src/random.mjs). Поэтому
 * сценарий не изменится, если завтра переставить местами генерацию задач и
 * генерацию исполнителей, и семя 42 всегда даёт один и тот же экземпляр.
 */

import { createStream } from "../../gasearch/src/random.mjs"

/** Число компетенций в модели. Малое K делает нарушения компетенций частыми, а значит наблюдаемыми. */
export const COMPETENCES = 4

/**
 * Размерности из таблицы раздела 3.3.1.
 *
 * Столбцы «изменение приоритета», «изменение ёмкости», «ошибка трудоёмкости»
 * и «ошибка компетенций» — интенсивности возмущения, растущие от S к L.
 */
export const SIZES = {
  S: { "задач": 30, "исполнителей": 5, "изменение приоритета": 0.20, "изменение ёмкости": 0.10, "ошибка трудоёмкости": 0.10, "ошибка компетенций": 0.05 },
  M: { "задач": 100, "исполнителей": 10, "изменение приоритета": 0.30, "изменение ёмкости": 0.15, "ошибка трудоёмкости": 0.20, "ошибка компетенций": 0.10 },
  L: { "задач": 200, "исполнителей": 20, "изменение приоритета": 0.40, "изменение ёмкости": 0.20, "ошибка трудоёмкости": 0.30, "ошибка компетенций": 0.15 },
}

/**
 * Классы сценариев.
 *
 * Возмущение применяется ПОСЛЕ назначения сроков по опорному расписанию.
 * Смысл в этом и состоит: сценарий описывает состояние контура уже после
 * изменения, когда действующий план перестал соответствовать обстановке и
 * требуется перепланирование. Если возмущать до расчёта сроков, получится
 * просто другой случайный экземпляр, а не задача перепланирования.
 */
export const CLASSES = {
  dense_dependencies: { "плотность зависимостей": 0.10, "возмущение": "нет", "описание": "повышенное число отношений предшествования" },
  priority_changes: { "плотность зависимостей": 0.04, "возмущение": "приоритеты", "описание": "изменение приоритетов и доступной ёмкости" },
  noisy_inputs: { "плотность зависимостей": 0.04, "возмущение": "данные", "описание": "ошибки в оценках трудоёмкости и матрице компетенций" },
}

export function classNames() {
  return Object.keys(CLASSES)
}

export function sizeNames() {
  return Object.keys(SIZES)
}

/** Есть ли у исполнителя компетенция: маска битов, компетенция — номер бита. */
export function hasCompetence(mask, competence) {
  return (mask & (1 << competence)) !== 0
}

/**
 * Построение экземпляра сценария.
 *
 * @param options.class класс сценария (см. CLASSES)
 * @param options.size  размерность S/M/L
 * @param options.seed  целое семя экземпляра
 */
export function createScenario({ class: className = "dense_dependencies", size = "S", seed = 1 } = {}) {
  const shape = CLASSES[className]
  if (!shape) throw new Error(`неизвестный класс сценария «${className}»; доступны: ${classNames().join(", ")}`)
  const dimension = SIZES[size]
  if (!dimension) throw new Error(`неизвестная размерность «${size}»; доступны: ${sizeNames().join(", ")}`)

  const n = dimension["задач"]
  const executorCount = dimension["исполнителей"]
  const root = createStream(seed).fork(`сценарий:${className}:${size}`)

  // --- Исполнители ---------------------------------------------------------
  // Компетенция (m mod K) выдаётся гарантированно: иначе при неудачном
  // жребии какая-то компетенция осталась бы непокрытой, и НИ ОДИН план не был
  // бы допустим. Сценарий без допустимых решений ничего не измеряет — он лишь
  // сравнивает, кто аккуратнее проигрывает.
  const executorStream = root.fork("исполнители")
  const executors = Array.from({ length: executorCount }, (_unused, m) => {
    const own = executorStream.fork(`исполнитель:${m}`)
    let mask = 1 << (m % COMPETENCES)
    for (let k = 0; k < COMPETENCES; k += 1) {
      if (own.fork(`компетенция:${k}`).nextBool(0.35)) mask |= 1 << k
    }
    return { "номер": m, "компетенции": mask, "загрузка": own.fork("загрузка").nextInt(0, 3) }
  })

  // --- Задачи --------------------------------------------------------------
  const taskStream = root.fork("задачи")
  const tasks = Array.from({ length: n }, (_unused, j) => {
    const own = taskStream.fork(`задача:${j}`)
    return {
      "номер": j,
      "трудоёмкость": own.fork("трудоёмкость").nextInt(1, 10),
      "приоритет": own.fork("приоритет").nextInt(1, 5),
      "компетенция": own.fork("компетенция").nextInt(0, COMPETENCES - 1),
      "блокирующая": own.fork("блокировка").nextBool(0.10),
      "риск": Number(own.fork("риск").nextFloat().toFixed(4)),
      "срок": 0,
    }
  })

  // --- Зависимости ---------------------------------------------------------
  // Рёбра проводятся только «слева направо» по номерам задач, поэтому граф
  // ациклический по построению и топологический порядок — это порядок
  // номеров. Отдельная топологическая сортировка не нужна и не может
  // разойтись с данными.
  const dependencyStream = root.fork("зависимости")
  const density = shape["плотность зависимостей"]
  const predecessors = Array.from({ length: n }, () => [])
  for (let j = 1; j < n; j += 1) {
    const own = dependencyStream.fork(`задача:${j}`)
    for (let i = 0; i < j; i += 1) {
      if (own.fork(`предшественник:${i}`).nextBool(density)) predecessors[j].push(i)
    }
  }
  const order = Array.from({ length: n }, (_unused, j) => j)

  const scenario = {
    "класс": className,
    "размер": size,
    "семя": seed,
    "задач": n,
    "исполнителей": executorCount,
    "плотность зависимостей": density,
    "задачи": tasks,
    "исполнители": executors,
    "предшественники": predecessors,
    "порядок": order,
    "ёмкости": null,
    "действующий план": null,
    "опорные величины": null,
  }

  // --- Ёмкости -------------------------------------------------------------
  // Суммарная ёмкость на 15% больше суммарной трудоёмкости. Меньший запас
  // сделал бы перегрузку неизбежной и превратил V_over в константу; больший
  // сделал бы ограничение ёмкости незначащим. И то и другое убрало бы из
  // сравнения одну из компонент Δ.
  const totalEffort = tasks.reduce((sum, task) => sum + task["трудоёмкость"], 0)
  const capacityStream = root.fork("ёмкости")
  const shares = executors.map((executor) => 0.7 + capacityStream.fork(`исполнитель:${executor["номер"]}`).nextFloat() * 0.6)
  const shareSum = shares.reduce((sum, value) => sum + value, 0)
  scenario["ёмкости"] = shares.map((share) => Math.max(1, Math.round((share / shareSum) * totalEffort * 1.15)))

  // --- Сроки по опорному расписанию ----------------------------------------
  // Сроки назначаются по расписанию жадного плана: так они заведомо
  // достижимы в принципе, но не бесплатно. Множитель от 0,9 до 1,4 даёт смесь
  // напряжённых и свободных сроков — иначе просрочка T была бы либо нулём,
  // либо константой.
  const reference = greedyAssignment(scenario)
  const referenceSchedule = buildSchedule(scenario, reference)
  const deadlineStream = root.fork("сроки")
  tasks.forEach((task, j) => {
    const slack = 0.9 + deadlineStream.fork(`задача:${j}`).nextFloat() * 0.5
    task["срок"] = Math.max(task["трудоёмкость"], Math.round(referenceSchedule["завершение"][j] * slack))
  })

  // --- Действующий план ----------------------------------------------------
  // Тот план, относительно которого считается H (доля переназначений).
  // Он намеренно посредственный: компетентный исполнитель выбирается лишь в
  // 60% случаев. Иначе H и качество были бы одним и тем же показателем.
  const currentStream = root.fork("действующий план")
  scenario["действующий план"] = tasks.map((task, j) => {
    const own = currentStream.fork(`задача:${j}`)
    const competent = executors.filter((executor) => hasCompetence(executor["компетенции"], task["компетенция"]))
    if (competent.length > 0 && own.fork("компетентный").nextBool(0.6)) {
      return own.fork("выбор").pick(competent)["номер"]
    }
    return own.fork("выбор").nextInt(0, executorCount - 1)
  })

  // --- Возмущение ----------------------------------------------------------
  applyPerturbation(scenario, shape["возмущение"], dimension, root.fork("возмущение"))

  // --- Опорные величины нормировки -----------------------------------------
  // Раздел 2.3: B_ref — «фиксированное опорное значение сценария». Все три
  // опорных числа считаются ОДИН раз по сценарию и не зависят от плана,
  // иначе нормировка сама стала бы предметом оптимизации.
  const effortAfter = scenario["задачи"].reduce((sum, task) => sum + task["трудоёмкость"], 0)
  const meanLoad = effortAfter / executorCount
  scenario["опорные величины"] = {
    "B_ref": Math.max(1e-9, meanLoad * meanLoad),
    "R_ref": Math.max(1e-9, effortAfter + Math.max(...executors.map((executor) => executor["загрузка"]))),
    "T_ref": Math.max(1e-9, scenario["задачи"].reduce((sum, task) => sum + task["приоритет"] * task["трудоёмкость"], 0)),
    "ёмкость всего": Math.max(1e-9, scenario["ёмкости"].reduce((sum, value) => sum + value, 0)),
  }

  return scenario
}

/**
 * Возмущение сценария после назначения сроков.
 *
 * `приоритеты` — класс priority_changes: часть приоритетов переписывается,
 * часть ёмкостей меняется. `данные` — класс noisy_inputs: искажаются
 * наблюдаемые трудоёмкости и матрица компетенций.
 *
 * Наблюдаемые значения — единственные, по которым считается J_p (раздел
 * 3.3.1: «Операционное значение J_p вычисляется по наблюдаемым данным»).
 * Отдельной серии «наблюдаемое против истинного» здесь нет — см. README.
 */
function applyPerturbation(scenario, kind, dimension, stream) {
  if (kind === "нет") return

  if (kind === "приоритеты") {
    const rate = dimension["изменение приоритета"]
    scenario["задачи"].forEach((task, j) => {
      const own = stream.fork(`задача:${j}`)
      if (own.fork("менять").nextBool(rate)) task["приоритет"] = own.fork("значение").nextInt(1, 5)
    })
    const capacityRate = dimension["изменение ёмкости"]
    scenario["ёмкости"] = scenario["ёмкости"].map((value, m) => {
      const own = stream.fork(`ёмкость:${m}`)
      if (!own.fork("менять").nextBool(capacityRate)) return value
      const factor = 0.6 + own.fork("значение").nextFloat() * 0.6
      return Math.max(1, Math.round(value * factor))
    })
    return
  }

  if (kind === "данные") {
    const effortRate = dimension["ошибка трудоёмкости"]
    scenario["задачи"].forEach((task, j) => {
      const own = stream.fork(`задача:${j}`)
      if (own.fork("трудоёмкость").nextBool(effortRate)) {
        const factor = 0.5 + own.fork("искажение").nextFloat() * 1.0
        task["трудоёмкость"] = Math.max(1, Math.round(task["трудоёмкость"] * factor))
      }
    })
    const skillRate = dimension["ошибка компетенций"]
    scenario["исполнители"].forEach((executor) => {
      const own = stream.fork(`исполнитель:${executor["номер"]}`)
      for (let k = 0; k < COMPETENCES; k += 1) {
        if (own.fork(`компетенция:${k}`).nextBool(skillRate)) executor["компетенции"] ^= 1 << k
      }
    })
    // Если после искажения какая-то компетенция осталась непокрытой,
    // допустимых планов не существует и сравнение вырождается. Возвращаем
    // покрытие принудительно и записываем это в сценарий — молча чинить
    // данные нельзя, иначе искажение перестанет быть измеримым.
    const repaired = []
    for (let k = 0; k < COMPETENCES; k += 1) {
      if (scenario["исполнители"].some((executor) => hasCompetence(executor["компетенции"], k))) continue
      const owner = k % scenario["исполнителей"]
      scenario["исполнители"][owner]["компетенции"] |= 1 << k
      repaired.push(k)
    }
    if (repaired.length > 0) scenario["восстановленные компетенции"] = repaired
    return
  }

  throw new Error(`неизвестный вид возмущения «${kind}»`)
}

/**
 * Расписание S(X): детерминированная развёртка назначения во времени.
 *
 * Раздел 2.3: «S(X) — календарный план, детерминированно построенный по
 * топологическому порядку зависимостей, доступной ёмкости и оценкам
 * трудоёмкости». Детерминированность здесь принципиальна: если бы расписание
 * строилось эвристикой с собственной случайностью, одно и то же назначение
 * получало бы разные оценки, и сравнение режимов измеряло бы шум расписания.
 */
export function buildSchedule(scenario, assignment) {
  const n = scenario["задач"]
  const tasks = scenario["задачи"]
  const predecessors = scenario["предшественники"]
  const finish = new Float64Array(n)
  const free = Float64Array.from(scenario["исполнители"].map((executor) => executor["загрузка"]))
  const loads = new Float64Array(scenario["исполнителей"])
  let makespan = 0

  for (const j of scenario["порядок"]) {
    let ready = 0
    for (const predecessor of predecessors[j]) {
      if (finish[predecessor] > ready) ready = finish[predecessor]
    }
    const executor = assignment[j]
    const start = Math.max(ready, free[executor])
    const completion = start + tasks[j]["трудоёмкость"]
    finish[j] = completion
    free[executor] = completion
    loads[executor] += tasks[j]["трудоёмкость"]
    if (completion > makespan) makespan = completion
  }

  return { "завершение": finish, "загрузки": loads, "длительность": makespan }
}

/**
 * Жадное конструктивное назначение — базовая эвристика (`greedy`, раздел 2.4.4).
 *
 * Задачи разбираются в топологическом порядке; выигрывает компетентный
 * исполнитель с наименьшей текущей загрузкой, при равенстве — с меньшим
 * номером. Никакой случайности: эвристика обязана давать один и тот же ответ
 * при любом seed, иначе её нельзя использовать как границу сравнения.
 */
export function greedyAssignment(scenario) {
  const executors = scenario["исполнители"]
  const capacities = scenario["ёмкости"]
  const loads = new Float64Array(executors.length)
  const assignment = new Array(scenario["задач"]).fill(0)

  for (const j of scenario["порядок"]) {
    const task = scenario["задачи"][j]
    let choice = -1
    let bestKey = Infinity
    for (const executor of executors) {
      const m = executor["номер"]
      const competent = hasCompetence(executor["компетенции"], task["компетенция"])
      // Некомпетентный исполнитель штрафуется сдвигом на заведомо большую
      // величину, а не исключается: если компетентных нет вовсе, план всё
      // равно должен быть построен и предъявлен с нарушением.
      const capacity = capacities ? capacities[m] : 1
      const key = (competent ? 0 : 1e6) + (loads[m] + task["трудоёмкость"]) / Math.max(1, capacity)
      if (key < bestKey) {
        bestKey = key
        choice = m
      }
    }
    assignment[j] = choice
    loads[choice] += task["трудоёмкость"]
  }
  return assignment
}

/** Краткая сводка сценария для протокола прогона. */
export function describeScenario(scenario) {
  return {
    "класс": scenario["класс"],
    "размер": scenario["размер"],
    "семя": scenario["семя"],
    "задач": scenario["задач"],
    "исполнителей": scenario["исполнителей"],
    "плотность зависимостей": scenario["плотность зависимостей"],
    "рёбер": scenario["предшественники"].reduce((sum, list) => sum + list.length, 0),
    "суммарная трудоёмкость": scenario["задачи"].reduce((sum, task) => sum + task["трудоёмкость"], 0),
    "суммарная ёмкость": scenario["ёмкости"].reduce((sum, value) => sum + value, 0),
  }
}
