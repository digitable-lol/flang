/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * totality.mjs — анализ структурного убывания для `тотальных` функций flang.
 *
 * Задача модуля: превратить обещание «эта функция завершается» в проверенный
 * факт. Пометка `тотальная` ничего не гарантирует сама по себе — гарантию даёт
 * это доказательство (SPEC, раздел 1).
 *
 * ── Как устроено доказательство ────────────────────────────────────────────
 *
 * Значения flang — конечные деревья (SPEC, раздел 2): список, запись, вариант,
 * скаляр. Значит, отношение «часть значения» вполне обосновано: бесконечной
 * убывающей цепочки частей не бывает. Поэтому достаточно показать, что вдоль
 * любой цепочки рекурсивных вызовов один и тот же аргумент строго убывает по
 * этому отношению.
 *
 * Каждому выражению внутри тотальной функции сопоставляется «происхождение» —
 * ответ на вопрос «частью какого параметра это значение является и насколько
 * глубоко разобранной частью»:
 *
 *   null                                 — про значение ничего не известно
 *   { param: i, name: "элементы", depth: 0 }  — это сам параметр i
 *   { param: i, name: "элементы", depth: k }  — часть параметра i, k разборов вглубь
 *
 * Происхождение растёт вглубь (`depth + 1`) там, где значение достаётся
 * из значения: `хвост`/`голова` от списка, привязки образца
 * «голова и хвост», поля варианта в образце, поле записи, элемент коллекции
 * в `отобразить`/`отфильтровать`/`свёртка`. Оно теряется (`null`) там, где
 * значение строится: конструктор варианта, литерал списка, `добавить … к …`,
 * арифметика, результат любого вызова. `пусть` переносит происхождение
 * значения на имя; `если` и `разбор` объединяют ветви, беря минимальную
 * глубину при совпадающем параметре.
 *
 * Вызов f → g убывает на позиции j, если j-й аргумент имеет происхождение
 * `{ param: j, depth ≥ 1 }`: то есть на месте j-го параметра g стоит
 * собственная часть j-го параметра f.
 *
 * ── Циклы ──────────────────────────────────────────────────────────────────
 *
 * Граф вызовов между тотальными функциями раскладывается на компоненты
 * сильной связности. Компонента с внутренним циклом принимается, если
 * существует **одна и та же** позиция аргумента, убывающая на **каждом**
 * ребре компоненты. Требование единой позиции — не лень, а необходимость:
 * правило «каждое ребро убывает хоть где-нибудь» неверно. Контрпример:
 *
 *   «А»(a, b) вызывает «Б»(хвост a, добавить x к b)   — убывает на позиции 1
 *   «Б»(a, b) вызывает «А»(добавить x к a, хвост b)   — убывает на позиции 2
 *
 * Каждое ребро где-то убывает, но пара (a, b) по кругу растёт, и цикл
 * бесконечен. Единая позиция даёт настоящую убывающую цепочку частей одного
 * значения, а она обязана оборваться.
 *
 * ── Высший порядок: дефункционализация вместо неразрешимости ───────────────
 *
 * При настоящих функциях первого класса вопрос «кто кого зовёт» неразрешим, и
 * весь разбор выше рухнул бы вместе с ним: граф вызовов перестал бы быть
 * известным. Поэтому функция-значение в flang — это ТЕГ (Reynolds, 1972):
 * `функция «Удвоить»` не строит замыкания, а называет объявленную функцию, а
 * `ф от х` — это `применить(тег, х)`, то есть один диспетчер с конечным
 * списком случаев (flang/cat/HOF.md).
 *
 * Отсюда анализ не меняется ни на строку — меняется только то, ЧЕМ он
 * питается. Применение разворачивается в столько обычных рёбер `f → g`,
 * сколько тегов может прийти в это применение, и дальше работает всё то же:
 * компоненты сильной связности, единая убывающая позиция, заразность
 * недоказанности. Диспетчер в граф не вводится намеренно: он тождественная
 * пересылка аргументов, и отдельным узлом он слил бы в одну компоненту всё
 * высшего порядка сразу.
 *
 * Откуда берётся конечный список тегов. Тег строится РОВНО одной формой —
 * `функция «Имя»`, — а программу компилятор видит целиком (раздельной
 * компиляции у языка нет и не планируется, PLAN.md). Значит множество тегов
 * программы — это множество мест, где эта форма написана, плюс теги, стоящие
 * в значениях примеров. Ровно эти случаи и попадут в напечатанный `switch`:
 * тег, которого не строит ни одно место программы, в напечатанном коде не
 * существует, поэтому и здесь его нет.
 *
 * Точность. Какой именно тег придёт в данное применение, анализ не отслеживает
 * — кроме случая, когда тег применён на месте (`(функция «Удвоить») от 5`).
 * Во всех остальных берутся ВСЕ теги программы подходящей арности. Это
 * консервативно (лишние рёбра только мешают доказать, а не помогают), но
 * огрубляет: два независимых применения в одном модуле видят теги друг друга и
 * могут дать цикл, которого в программе нет. Уточнение — прослеживание тегов
 * по параметрам — записано в `flang/cat/HOF.md` как следующая фаза.
 *
 * ── Чего анализ не умеет (сознательно) ─────────────────────────────────────
 *
 * Лексикографическое убывание (Аккерман), убывание по числовому счётчику
 * (`n − 1`), убывание через результат другой функции («хвост от «Отсортировать»
 * от списка») и разные убывающие позиции у разных рекурсивных вызовов одной
 * функции — всё это отвергается. Анализ консервативен по построению: он
 * никогда не признаёт тотальной функцию, которая может зациклиться, и цена
 * этому — отказ части действительно завершающихся программ.
 */

import { programTags } from "./tags.mjs"

/** Формы, которые достают часть значения: результат строго меньше аргумента. */
const DESTRUCTORS = new Map([
  ["хвост", 0], ["tail", 0],
  ["голова", 0], ["head", 0],
])

/**
 * Анализ завершаемости программы.
 *
 * @param {object} program AST модуля (SPEC, раздел 5)
 * @returns {{ ok: boolean, diagnostics: object[], total: Set<string> }}
 *   `total` — функции, помеченные `тотальная`, для которых завершение
 *   доказано. Непомеченные функции не анализируются (за них отвечает лимит
 *   шагов интерпретатора), поэтому их в множестве нет никогда.
 */
export function checkTotality(program) {
  const diagnostics = []
  const report = (code, message, node) => {
    diagnostics.push({ code, message, severity: "error", span: spanOf(node) })
  }

  const functions = new Map()
  for (const fn of Array.isArray(program?.functions) ? program.functions : []) {
    if (typeof fn?.name === "string" && fn.name.length > 0 && !functions.has(fn.name)) functions.set(fn.name, fn)
  }

  const totalNames = new Set()
  for (const [name, fn] of functions) if (fn.total === true) totalNames.add(name)

  /* Теги программы по арности — конечный список случаев диспетчера
     `применить`. Считается один раз на всю программу (место, где тег построен,
     к тому, где он применён, отношения не имеет) и ЛЕНИВО: сбор требует обхода
     всей программы, а спрашивают о нём только применения. Программа без
     функций-значений не платит за них ни миллисекунды — на связанном
     компиляторе из 1275 функций это разница между 40 мс и 140 мс. */
  let tagTable = null
  const tags = () => (tagTable ??= tagsByArity(program, functions))

  // Собираем вызовы только из тотальных функций: обычные не анализируются.
  const calls = []
  for (const name of totalNames) {
    const fn = functions.get(name)
    const params = paramNames(fn)
    const env = new Map()
    params.forEach((paramName, index) => env.set(paramName, { param: index, name: paramName, depth: 0 }))
    collectCalls(fn.body, env, { from: name, params, calls, tags, functions })
  }

  const failed = new Set()
  const edges = []

  for (const call of calls) {
    const callee = functions.get(call.to)
    if (!callee) {
      // Неизвестное имя — отдельная беда (её называет types.mjs), но для нас
      // важно другое: про завершение такой функции сказать нечего.
      report("FLANG_NOT_TOTAL", `тотальная функция «${call.from}» вызывает неизвестную функцию «${call.to}»: завершение доказать нельзя`, call.node)
      failed.add(call.from)
      continue
    }
    if (!totalNames.has(call.to)) {
      /* Через применение беда та же, а починка другая: «пометьте вызываемую
         тотальной» верно и здесь, но человеку надо знать, что путь идёт через
         значение-функцию, — иначе он будет искать вызов и не найдёт его. */
      report(
        "FLANG_NOT_TOTAL",
        call.applied === true
          ? `тотальная функция «${call.from}» применяет значение-функцию «${call.to}», а «${call.to}» обычная: она может не завершиться, и гарантия «${call.from}» становится пустой. Пометьте «${call.to}» как тотальную или снимите «тотальная» с «${call.from}»`
          : `тотальная функция «${call.from}» вызывает обычную функцию «${call.to}»: обычная функция может не завершиться, и гарантия «${call.from}» становится пустой. Пометьте «${call.to}» как тотальную или снимите «тотальная» с «${call.from}»`,
        call.node,
      )
      failed.add(call.from)
      continue
    }
    edges.push({ ...call, calleeParams: paramNames(callee) })
  }

  for (const component of stronglyConnectedComponents([...totalNames], edges)) {
    checkComponent(component, edges, failed, report)
  }

  // Недоказанность заразна: если «А» зовёт «Б», а «Б» не доказана, то и
  // «А» не доказана. Диагностику при этом не дублируем — причина названа
  // один раз, в месте, где её можно починить.
  let growing = true
  while (growing) {
    growing = false
    for (const edge of edges) {
      if (failed.has(edge.to) && !failed.has(edge.from)) {
        failed.add(edge.from)
        growing = true
      }
    }
  }

  const total = new Set([...totalNames].filter((name) => !failed.has(name)))
  return { ok: diagnostics.length === 0, diagnostics, total }
}

/* ------------------------------------------------------------------ */
/* Дефункционализация: конечный список тегов программы                 */
/* ------------------------------------------------------------------ */

/**
 * Теги программы, разложенные по арности: `арность → [имена функций]`.
 *
 * Это и есть список случаев диспетчера `применить`. Он конечен по построению —
 * тег называет объявленную функцию, а функций в программе конечное число, — и
 * собирается по всей программе, а не только по тотальным функциям: тег, зачем-то
 * построенный в обычной функции, может уехать в тотальную аргументом.
 *
 * По арности, а не по типу: `totality.mjs` объявленных типов не читает вообще
 * (0 мест, измерено в flang/cat/POLY.md), и заводить это ради одной проверки
 * значило бы связать анализ завершаемости с проверкой типов. Арность — то же
 * различение, но синтаксическое: у значения-функции столько аргументов, сколько
 * параметров у названной функции.
 *
 * Сам список тегов приходит из `tags.mjs` — оттуда же, откуда его берёт
 * вычислитель, отказываясь применять тег, которого программа не строит. Это не
 * ради краткости: два списка разошлись бы, и доказанное перестало бы совпадать
 * с исполняемым.
 */
function tagsByArity(program, functions) {
  const byArity = new Map()
  for (const name of programTags(program, (имя) => functions.has(имя))) {
    const arity = paramNames(functions.get(name)).length
    if (!byArity.has(arity)) byArity.set(arity, [])
    byArity.get(arity).push(name)
  }
  for (const names of byArity.values()) names.sort()
  return byArity
}

/**
 * Кого может позвать это применение.
 *
 * Тег, применённый на месте (`(функция «Удвоить») от 5`), известен точно — и
 * это не оптимизация, а тот самый случай, ради которого дефункционализация
 * называется дефункционализацией: диспетчер здесь вырождается в один вызов.
 * Во всех прочих случаях берутся все теги подходящей арности.
 */
function applyTargets(expr, arity, state) {
  const прямо = expr?.fn
  if (прямо?.kind === "fnref" && state.functions.has(прямо.name)) return [прямо.name]
  return state.tags().get(arity) ?? []
}

/* ------------------------------------------------------------------ */
/* Компоненты сильной связности и проверка цикла                       */
/* ------------------------------------------------------------------ */

function checkComponent(component, edges, failed, report) {
  const members = new Set(component)
  const inner = edges.filter((edge) => members.has(edge.from) && members.has(edge.to))
  // Компонента из одной функции без самовызова — не цикл: доказывать нечего.
  if (inner.length === 0) return

  const decreasing = inner.map((edge) => ({ edge, positions: decreasingPositions(edge) }))
  const silent = decreasing.filter((item) => item.positions.size === 0)

  if (silent.length > 0) {
    for (const { edge } of silent) {
      report("FLANG_NOT_TOTAL", explainNoDescent(edge, component), edge.node)
      failed.add(edge.from)
    }
    for (const name of component) failed.add(name)
    return
  }

  const common = [...decreasing[0].positions].filter((position) => decreasing.every((item) => item.positions.has(position)))
  if (common.length > 0) return

  // Каждое ребро где-то убывает, но общей позиции нет — см. контрпример
  // в шапке файла: такой цикл может быть бесконечным.
  const detail = decreasing
    .map(({ edge, positions }) => `«${edge.from}» → «${edge.to}» убывает по ${[...positions].map((position) => argumentLabel(edge, position)).join(", ")}`)
    .join("; ")
  report(
    "FLANG_NOT_TOTAL",
    `в цикле ${component.map((name) => `«${name}»`).join(" → ")} нет аргумента, который убывает на каждом вызове: ${detail}. Нужен один и тот же убывающий аргумент на всех рёбрах цикла`,
    decreasing[0].edge.node,
  )
  for (const name of component) failed.add(name)
}

/** Позиции, на которых вызов строго убывает. */
function decreasingPositions(edge) {
  const positions = new Set()
  edge.origins.forEach((origin, index) => {
    if (!origin || origin.depth < 1) return
    if (origin.param !== index) return          // убывать обязан аргумент на своей позиции
    if (index >= edge.calleeParams.length) return
    positions.add(index)
  })
  return positions
}

function argumentLabel(edge, position) {
  const caller = edge.params[position] ?? `#${position + 1}`
  return `аргументу ${position + 1} (параметр «${caller}»)`
}

function explainNoDescent(edge, component) {
  const reasons = edge.origins.map((origin, index) => {
    const shown = describeExpr(edge.args[index])
    const callerParam = edge.params[index]
    if (!origin) return `аргумент ${index + 1} (${shown}) не выведен ни из одного параметра`
    const source = `параметра «${origin.name}»`
    if (origin.param !== index) {
      return `аргумент ${index + 1} (${shown}) — часть ${source}, а сравнивается с параметром «${callerParam ?? "?"}» на своей позиции`
    }
    if (origin.depth === 0) return `аргумент ${index + 1} (${shown}) — это сам параметр «${origin.name}», а не его часть`
    return `аргумент ${index + 1} (${shown}) убывает`
  })
  const действие = edge.applied === true ? "применение значения-функции" : "вызов"
  const cycle = edge.from === edge.to
    ? (edge.applied === true ? `применение значения-функции «${edge.to}» к самой себе` : `рекурсивный вызов «${edge.to}»`)
    : `${действие} «${edge.to}» в цикле ${component.map((name) => `«${name}»`).join(" → ")}`
  const hint = "Передавайте часть аргумента: хвост списка из образца «голова и хвост», поле варианта из образца, поле записи или элемент коллекции"
  return `тотальная функция «${edge.from}»: ${cycle} не убывает — ${reasons.join("; ") || "у вызова нет аргументов"}. ${hint}`
}

/**
 * Компоненты сильной связности. Замыкание достижимости, а не алгоритм
 * Тарьяна: функций в модуле десятки, зато код очевидно верен и читается
 * без разбора стека.
 */
function stronglyConnectedComponents(nodes, edges) {
  const reach = new Map(nodes.map((node) => [node, new Set()]))
  for (const edge of edges) reach.get(edge.from)?.add(edge.to)
  let growing = true
  while (growing) {
    growing = false
    for (const node of nodes) {
      for (const middle of [...reach.get(node)]) {
        for (const far of reach.get(middle) ?? []) {
          if (!reach.get(node).has(far)) {
            reach.get(node).add(far)
            growing = true
          }
        }
      }
    }
  }
  const seen = new Set()
  const components = []
  for (const node of nodes) {
    if (seen.has(node)) continue
    const component = nodes.filter((other) => other === node
      || (reach.get(node).has(other) && reach.get(other).has(node)))
    for (const member of component) seen.add(member)
    components.push(component)
  }
  return components
}

/* ------------------------------------------------------------------ */
/* Происхождение значений                                              */
/* ------------------------------------------------------------------ */

function deeper(origin) {
  return origin ? { param: origin.param, name: origin.name, depth: origin.depth + 1 } : null
}

/** Объединение ветвей: общее происхождение — самое слабое из двух. */
function join(left, right) {
  if (!left || !right) return null
  if (left.param !== right.param) return null
  return { param: left.param, name: left.name, depth: Math.min(left.depth, right.depth) }
}

/**
 * Обход тела: возвращает происхождение значения выражения и попутно
 * складывает в `state.calls` все вызовы вместе с происхождением аргументов.
 */
function collectCalls(expr, env, state) {
  if (!expr || typeof expr !== "object") return null
  switch (expr.kind) {
    case "literal":
      return null
    case "var":
      return env.get(expr.name) ?? null
    case "field":
      // Поле — часть значения: любое поле конечного значения строго меньше
      // самого значения.
      return deeper(collectCalls(expr.target, env, state))
    case "let": {
      const value = collectCalls(expr.value, env, state)
      const inner = new Map(env)
      if (typeof expr.name === "string") inner.set(expr.name, value)
      return collectCalls(expr.in, inner, state)
    }
    case "if": {
      collectCalls(expr.cond, env, state)
      return join(collectCalls(expr.then, env, state), collectCalls(expr.else, env, state))
    }
    case "call": {
      const args = Array.isArray(expr.args) ? expr.args : []
      const origins = args.map((arg) => collectCalls(arg, env, state))
      state.calls.push({
        from: state.from,
        to: expr.name,
        node: expr,
        params: state.params,
        args,
        origins,
      })
      return null
    }
    case "fnref":
      /* Тег — построенное значение, а не часть параметра: `функция «Ф»` не
         достаёт ничего ни из чего. Само по себе построение тега вызовом не
         является — вызов случится там, где тег применят. */
      return null
    case "apply": {
      const args = Array.isArray(expr.args) ? expr.args : []
      /* Применяемое обходится ради вызовов внутри него (`(«Выбрать» от 1) от 5`),
         но происхождением аргумента не становится: аргументы — только `args`,
         ровно как у вызова по имени. */
      collectCalls(expr.fn, env, state)
      const origins = args.map((arg) => collectCalls(arg, env, state))
      /* Диспетчер разворачивается здесь: одно применение — столько рёбер,
         сколько случаев у `применить` подходящей арности. Ни одного случая —
         ни одного ребра: тега такой арности программа не строит, значит в
         напечатанном `switch` его нет и попасть сюда нечему. */
      for (const to of applyTargets(expr, args.length, state)) {
        state.calls.push({
          from: state.from,
          to,
          node: expr,
          params: state.params,
          args,
          origins,
          applied: true,
        })
      }
      return null
    }
    case "binary":
      collectCalls(expr.left, env, state)
      collectCalls(expr.right, env, state)
      return null
    case "construct":
    case "record":
      for (const value of Object.values(expr.fields ?? {})) collectCalls(value, env, state)
      return null
    case "list":
      for (const item of expr.items ?? []) collectCalls(item, env, state)
      return null
    case "match": {
      const target = collectCalls(expr.target, env, state)
      let result = undefined
      for (const branch of expr.cases ?? []) {
        const inner = bindPattern(branch?.pattern, target, env)
        const body = collectCalls(branch?.body, inner, state)
        result = result === undefined ? body : join(result, body)
      }
      return result === undefined ? null : result
    }
    case "fold": {
      const over = collectCalls(expr.over, env, state)
      collectCalls(expr.init, env, state)
      const inner = new Map(env)
      // Элемент конечной коллекции — её часть; накопитель строится на ходу,
      // про него ничего не известно. Сама свёртка конечна по построению,
      // поэтому источником незавершаемости она быть не может.
      if (typeof expr.item === "string") inner.set(expr.item, deeper(over))
      if (typeof expr.acc === "string") inner.set(expr.acc, null)
      collectCalls(expr.body, inner, state)
      return null
    }
    case "map":
    case "filter": {
      const over = collectCalls(expr.over, env, state)
      const inner = new Map(env)
      if (typeof expr.item === "string") inner.set(expr.item, deeper(over))
      collectCalls(expr.body, inner, state)
      // Результат — новый список: `отобразить` меняет элементы, а
      // `отфильтровать` в худшем случае возвращает исходный список целиком,
      // то есть строго меньше он не становится.
      return null
    }
    case "builtin": {
      const args = Array.isArray(expr.args) ? expr.args : []
      const origins = args.map((arg) => collectCalls(arg, env, state))
      const destructed = DESTRUCTORS.get(expr.name)
      return destructed === undefined ? null : deeper(origins[destructed] ?? null)
    }
    default:
      return null
  }
}

function bindPattern(pattern, target, env) {
  const inner = new Map(env)
  switch (pattern?.kind) {
    case "cons":
      // И голова, и хвост — части разбираемого значения.
      if (typeof pattern.head === "string") inner.set(pattern.head, deeper(target))
      if (typeof pattern.tail === "string") inner.set(pattern.tail, deeper(target))
      return inner
    case "variant":
      for (const alias of Object.values(pattern.bind ?? {})) {
        if (typeof alias === "string") inner.set(alias, deeper(target))
      }
      return inner
    case "any":
      // «любое» не разбирает значение: имя означает ровно то же значение.
      if (typeof pattern.bind === "string") inner.set(pattern.bind, target)
      return inner
    default:
      return inner
  }
}

/* ------------------------------------------------------------------ */
/* Мелочи                                                              */
/* ------------------------------------------------------------------ */

function paramNames(fn) {
  return (Array.isArray(fn?.params) ? fn.params : []).map((param) => param?.name)
}

/** Короткая запись выражения для диагностики — читателю нужно узнать место. */
function describeExpr(expr) {
  if (!expr || typeof expr !== "object") return "?"
  switch (expr.kind) {
    case "literal": return JSON.stringify(expr.value ?? null)
    case "var": return `«${String(expr.name)}»`
    case "field": return `${describeExpr(expr.target)}.${String(expr.field)}`
    case "call": return `«${String(expr.name)}» от ${(expr.args ?? []).map(describeExpr).join(", ") || "ничего"}`
    case "fnref": return `функция «${String(expr.name)}»`
    case "apply": return `${describeExpr(expr.fn)} от ${(expr.args ?? []).map(describeExpr).join(", ") || "ничего"}`
    case "builtin": return `${String(expr.name)} от ${(expr.args ?? []).map(describeExpr).join(", ") || "ничего"}`
    case "binary": return `${describeExpr(expr.left)} ${String(expr.op)} ${describeExpr(expr.right)}`
    case "list": return "список"
    case "construct": return `${String(expr.variant)} с полями`
    case "record": return `запись «${String(expr.type)}»`
    case "if": return "если …"
    case "let": return `пусть «${String(expr.name)}» …`
    case "match": return "разбор …"
    case "map": return "отобразить …"
    case "filter": return "отфильтровать …"
    case "fold": return "свёртка …"
    default: return String(expr.kind)
  }
}

function spanOf(node) {
  return node && typeof node === "object" && node.span ? node.span : null
}
