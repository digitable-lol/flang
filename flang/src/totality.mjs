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
 * ── Чего анализ не умеет (сознательно) ─────────────────────────────────────
 *
 * Лексикографическое убывание (Аккерман), убывание по числовому счётчику
 * (`n − 1`), убывание через результат другой функции («хвост от «Отсортировать»
 * от списка») и разные убывающие позиции у разных рекурсивных вызовов одной
 * функции — всё это отвергается. Анализ консервативен по построению: он
 * никогда не признаёт тотальной функцию, которая может зациклиться, и цена
 * этому — отказ части действительно завершающихся программ.
 */

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

  // Собираем вызовы только из тотальных функций: обычные не анализируются.
  const calls = []
  for (const name of totalNames) {
    const fn = functions.get(name)
    const params = paramNames(fn)
    const env = new Map()
    params.forEach((paramName, index) => env.set(paramName, { param: index, name: paramName, depth: 0 }))
    collectCalls(fn.body, env, { from: name, params, calls })
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
      report(
        "FLANG_NOT_TOTAL",
        `тотальная функция «${call.from}» вызывает обычную функцию «${call.to}»: обычная функция может не завершиться, и гарантия «${call.from}» становится пустой. Пометьте «${call.to}» как тотальную или снимите «тотальная» с «${call.from}»`,
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
  const cycle = edge.from === edge.to
    ? `рекурсивный вызов «${edge.to}»`
    : `вызов «${edge.to}» в цикле ${component.map((name) => `«${name}»`).join(" → ")}`
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
