/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * defunc.mjs — дефункционализация: ОДИН проход перед печатью на все восемь целей.
 *
 * Фаза 3 из `flang/cat/HOF.md`. Первая фаза научила язык функциям-значениям
 * (`функция «Удвоить»`, `функция из числа в число`, `ф от 5`) в разборе, типах,
 * завершаемости и вычислителе — а восемь бэкендов отказывались громко:
 * `FLANG_PARSE: неизвестный вид выражения «apply»`. Здесь отказ снимается, и
 * снимается он НЕ в бэкендах.
 *
 * ── Что делает проход ───────────────────────────────────────────────────────
 *
 *     функция «Удвоить»     →  вариант «Удвоить»              (тег — это вариант)
 *     ф от 5                →  «применить 1» от ф и 5         (один диспетчер)
 *
 * плюс на программу добавляется сумма тегов и по одной функции-диспетчеру на
 * каждую арность, какая встретилась в применении:
 *
 *     тотальная функция «применить 1»
 *       принимает тег, а1
 *       разбор тег
 *         случай вариант «Удвоить» → «Удвоить» от а1
 *         случай вариант «Утроить» → «Утроить» от а1
 *
 * На выходе программа СНОВА ПЕРВОПОРЯДКОВАЯ: ни `fnref`, ни `apply` в ней не
 * остаётся, и бэкенды печатают её теми же узлами (`construct`, `match`, `call`),
 * какими печатают всё остальное с первого дня. Это и есть весь смысл приёма
 * (Reynolds, 1972): высший порядок исчезает ДО печати, а не восемь раз внутри
 * неё.
 *
 * ── Почему проход общий, и что в бэкендах всё-таки пришлось тронуть ─────────
 *
 * Требование записано в HOF.md дословно: «дороже всего не сам проход, а то, что
 * он обязан быть ОДИН на восемь бэкендов — иначе восемь реализаций разойдутся».
 * Реализация здесь одна. Но общей ТОЧКИ ВХОДА у печати нет: восемь бэкендов —
 * это восемь экспортов `emitC`/`emitGo`/…, которые CLI и тесты зовут напрямую,
 * и даже `prepare()` у каждого свой. Поэтому в каждом бэкенде стоит ровно одна
 * строка — `prepare(defunctionalize(program))`, — а логики там нет ни одной.
 *
 * Забыть эту строку нельзя молча: `flang/test/hof-emit.test.mjs` печатает
 * модуль с функциями-значениями во все восемь целей, и бэкенд без прохода
 * упадёт там на `неизвестный вид выражения «apply»` — ровно тем отказом, ради
 * снятия которого проход написан.
 *
 * ── Почему проход обязан быть тождественным на программах без высшего порядка ─
 *
 * Печать в C — часть самоприменения: `self/*.flang` печатается этим же бэкендом,
 * и неподвижная точка сверяется побайтово (`self-bootstrap.test.mjs`). Значит
 * проход, изменивший хоть байт там, где высшего порядка нет, ломает сходимость.
 * Поэтому первое, что он делает, — проверяет, есть ли в программе `fnref` или
 * `apply`, и если нет, возвращает ТОТ ЖЕ объект, а не копию. Байт не меняется
 * не «по построению обхода», а потому, что обхода не было вовсе.
 *
 * Ровно так же устроена копия внутри: узел, в котором ничего не переписалось,
 * возвращается как есть. Копируется только путь от корня до переписанного
 * места.
 *
 * ── Откуда берётся список случаев диспетчера ───────────────────────────────
 *
 * Оттуда же, откуда его берут анализ завершаемости и вычислитель, — из
 * `tags.mjs`. Это не ради краткости: `totality.mjs` доказал завершение,
 * развернув применение в рёбра ПО ЭТОМУ списку, а `interpret.mjs` по нему же
 * отказывается применять чужой тег. Возьми печать другой список — и
 * напечатанная программа считала бы не то, что доказано, либо принимала бы
 * тег, который интерпретатор отвергает. Один список на три слоя делает такое
 * расхождение невозможным, а не маловероятным.
 *
 * ── Что остаётся расхождением и почему его нельзя закрыть здесь ────────────
 *
 * Тег, которого программа не строит, можно подать снаружи — и вычислителю
 * (`evaluate`), и напечатанному прогонщику (`flang_cli` читает значения из
 * JSON). Вычислитель отвечает `FLANG_APPLY` с текстом про отсутствующий случай
 * диспетчера. Напечатанный код отвечает отказом разбора: у `разбор` нет ветви
 * `любое`, и это тот же самый отказ по смыслу — «случая нет», — но другими
 * словом и кодом.
 *
 * Совпасть они не могут, и причина не в лени: выразить «отказать вот с этим
 * кодом и текстом» в языке нечем — формы «возбудить ошибку» в flang нет вовсе.
 * Завести её значило бы новую встроенную форму, то есть правку `builtins.mjs`
 * и по правке в каждом из восьми рантаймов — ровно те восемь правок, ради
 * отсутствия которых написан этот проход. Расхождение поэтому названо, а не
 * спрятано: оно случается ТОЛЬКО на входе, который проверка типов не
 * пропустила бы (значение не того типа, пришедшее снаружи), обе стороны на нём
 * отказывают, и ни на одном входе, который программа способна построить сама,
 * его нет. Проверяется это в `flang/test/hof-emit.test.mjs`.
 */

import { flangError } from "./builtins.mjs"
import { programTags } from "./tags.mjs"

/**
 * Первопорядковый вид программы: теги — варианты, применение — вызов диспетчера.
 *
 * @param {object} program AST модуля (SPEC, раздел 5)
 * @returns {object} та же программа, если высшего порядка в ней нет
 */
export function defunctionalize(program) {
  if (program === null || typeof program !== "object" || Array.isArray(program)) return program
  /* Ни одной новой формы — печатать нечего. Возвращается тот же объект: см.
     шапку, «тождественность» здесь не свойство обхода, а его отсутствие. */
  if (!hasHigherOrder(program)) return program

  const functions = new Map()
  for (const fn of program.functions ?? []) {
    if (fn !== null && typeof fn === "object" && typeof fn.name === "string" && !functions.has(fn.name)) {
      functions.set(fn.name, fn)
    }
  }

  /* Теги программы — те же, что видят завершаемость и вычислитель.
   *
   * Порядок — ПО ОБЪЯВЛЕНИЮ функций, а не по алфавиту, и это решение, а не
   * мелочь: он наблюдаем в случаях диспетчера и в вариантах суммы тегов, то
   * есть в напечатанном C. Здесь стоял `Array::sort`, и самоприменение
   * (`flang/self/defunc.flang`) повторить его не может — сравнения строк по
   * порядку в языке нет вовсе («сравнения порядка допустимы только для
   * чисел»), а кода символа нет тоже, значит лексикографию UTF-16 выразить
   * нечем. Порядок объявления обе стороны считают одинаково и без единой
   * новой формы. Тот же приём и по той же причине уже применён в
   * `self/totality.flang`: результат Тарьяна приводится к порядку объявления,
   * потому что порядок диагностик наблюдаем. */
  const found = programTags(program, (name) => functions.has(name))
  const tags = [...functions.keys()].filter((name) => found.has(name))
  const byArity = new Map()
  for (const name of tags) {
    const arity = arityOf(functions.get(name))
    if (!byArity.has(arity)) byArity.set(arity, [])
    byArity.get(arity).push(name)
  }

  const ctx = {
    functions,
    byArity,
    /* Имя диспетчера обязано быть свободным среди функций: две функции с одним
       именем — «объявлена дважды» у любого бэкенда. */
    taken: new Set(functions.keys()),
    dispatchers: new Map(),
  }

  const rewritten = rewrite(program, ctx)
  const declaredVariants = new Set()
  for (const type of program.types ?? []) {
    if (type !== null && typeof type === "object" && type.kind === "sum") {
      for (const item of type.variants ?? []) {
        if (item !== null && typeof item === "object" && typeof item.name === "string") declaredVariants.add(item.name)
      }
    }
  }

  const added = [...ctx.dispatchers.values()].sort((left, right) => left.arity - right.arity)
  const итог = {
    ...rewritten,
    functions: [...(rewritten.functions ?? []), ...added.map((item) => renderDispatcher(item, ctx))],
  }

  /* Сумма приписывается, только если объявлять есть что: пустого `types` там,
     где его не было, появиться не должно — печать читает поля по наличию. */
  const fresh = tags.filter((name) => !declaredVariants.has(name))
  if (fresh.length > 0) итог.types = [...(rewritten.types ?? []), tagSum(fresh, program)]
  return итог
}

/* ── что считать высшим порядком ──────────────────────────────────────────── */

/**
 * Есть ли в программе хоть одна новая форма.
 *
 * Проверяется дословно тем же различением, каким переписывается ниже, — иначе
 * нашлась бы программа, которую проход считает первопорядковой, а обход
 * переписывает.
 */
function hasHigherOrder(node) {
  if (Array.isArray(node)) return node.some(hasHigherOrder)
  if (node === null || typeof node !== "object") return false
  if (isFnRef(node) || isApply(node)) return true
  return Object.values(node).some(hasHigherOrder)
}

function isFnRef(node) {
  return node.kind === "fnref"
}

/**
 * Применение значения-функции — и НЕ утверждение теорката.
 *
 * Узлов с `kind: "apply"` в AST два, и это не оплошность, а два разных языка в
 * одном файле: `ф от 5` даёт `{ kind, fn, args }`, а фигурное утверждение
 * `применить { функтор … }` (`parser.mjs`, `parseBracedProposition`) даёт
 * `{ kind, functor, arg }`. Обход здесь общий — тег законен всюду, где законно
 * выражение, — поэтому различать их приходится полем, а не местом. Спутай их —
 * и теоркат-утверждение молча превратилось бы в вызов диспетчера.
 */
function isApply(node) {
  return node.kind === "apply" && Object.hasOwn(node, "fn")
}

function arityOf(fn) {
  return Array.isArray(fn?.params) ? fn.params.length : 0
}

/* ── переписывание ────────────────────────────────────────────────────────── */

function rewrite(node, ctx) {
  if (Array.isArray(node)) {
    let changed = false
    const items = node.map((item) => {
      const next = rewrite(item, ctx)
      if (next !== item) changed = true
      return next
    })
    return changed ? items : node
  }
  if (node === null || typeof node !== "object") return node

  if (isFnRef(node)) return tagValue(node, ctx)
  if (isApply(node)) {
    const args = Array.isArray(node.args) ? node.args : []
    /* Применяемое считается первым, аргументы за ним: у вызова по имени
       аргументы вычисляются слева направо, и `[применяемое, …аргументы]`
       повторяет тот же порядок, в каком их считает `interpret.mjs`. */
    return {
      kind: "call",
      name: dispatcherName(args.length, ctx),
      args: [rewrite(node.fn, ctx), ...args.map((arg) => rewrite(arg, ctx))],
      span: node.span,
    }
  }

  let changed = false
  const copy = {}
  for (const [key, value] of Object.entries(node)) {
    const next = rewrite(value, ctx)
    if (next !== value) changed = true
    copy[key] = next
  }
  return changed ? copy : node
}

/**
 * Тег — вариант без полей, ровно как его строит вычислитель
 * (`variant(имя, {})`). Захватывать нечего: замыканий в языке нет, и поля тега
 * появятся только в фазе частичного применения.
 */
function tagValue(node, ctx) {
  if (typeof node.name !== "string" || !ctx.functions.has(node.name)) {
    /* Текст — тот же, что у проверки типов на этой же беде (`fnrefType`):
       печать не имеет права называть одну и ту же беду другими словами. */
    throw flangError("FLANG_UNKNOWN_NAME", `неизвестная функция «${String(node.name)}»`, node.span)
  }
  return { kind: "construct", variant: node.name, fields: {}, span: node.span }
}

/* ── диспетчер ────────────────────────────────────────────────────────────── */

/**
 * По диспетчеру на арность, а не один на всё.
 *
 * Функция в flang принимает столько аргументов, сколько объявлено, — каррирования
 * нет (HOF.md, «чего решено не делать никогда»), — значит у диспетчера столько
 * же параметров, сколько у применения аргументов, и одним его не сделать. По
 * арности же раскладывает случаи и анализ завершаемости (`totality.mjs`,
 * `tagsByArity`): списки случаев обязаны совпасть, иначе напечатанный `switch`
 * позовёт то, чего анализ не разворачивал в ребро.
 */
function dispatcherName(arity, ctx) {
  const known = ctx.dispatchers.get(arity)
  if (known !== undefined) return known.name

  let name = `применить ${arity}`
  for (let suffix = 2; ctx.taken.has(name); suffix += 1) name = `применить ${arity} ${suffix}`
  ctx.taken.add(name)
  ctx.dispatchers.set(arity, { arity, name })
  return name
}

function renderDispatcher({ arity, name }, ctx) {
  const params = [{ name: "тег" }]
  for (let index = 1; index <= arity; index += 1) params.push({ name: `а${index}` })

  const cases = (ctx.byArity.get(arity) ?? []).map((tag) => ({
    pattern: { kind: "variant", name: tag, bind: {} },
    body: {
      kind: "call",
      name: tag,
      args: params.slice(1).map((param) => ({ kind: "var", name: param.name })),
    },
  }))

  return {
    name,
    /* Диспетчер — тождественная пересылка, поэтому он тотален ровно настолько,
       насколько тотальны его случаи (у пустого диспетчера случаев нет вовсе, и
       тотален он вырожденно — применять им нечего). Признак не украшение: у
       всех восьми целей он печатается комментарием о функции, а печать
       процессов в Elixir читает его же. */
    total: cases.every((branch) => ctx.functions.get(branch.body.name)?.total === true),
    params,
    /* Ветви `любое` нет намеренно: у диспетчера есть случай ровно на тот тег,
       который программа где-то строит. Тег, которого она не строит, — это
       значение, пришедшее снаружи мимо проверки типов, и отказ на нём обязан
       быть, а не молчание. Почему текст этого отказа не совпадает с текстом
       вычислителя — в шапке файла. */
    body: { kind: "match", target: { kind: "var", name: "тег" }, cases },
    examples: [],
  }
}

/**
 * Сумма тегов: объявление, без которого напечатанный конструктор варианта не
 * пройдёт проверку «неизвестный вариант» ни у одного из восьми бэкендов.
 *
 * Объявляются только те теги, которых в программе ещё нет вариантом. Совпадение
 * имени функции и имени варианта законно — пространства имён разные (HOF.md,
 * решение 2), — и объявить второй раз значило бы напечатать две фабрики с одним
 * именем, то есть несобираемый C. Значение при этом одно и то же: `{ variant,
 * fields }` у тега и у варианта без полей неотличимы и в вычислителе.
 */
function tagSum(names, program) {
  const taken = new Set()
  for (const type of program.types ?? []) {
    if (type !== null && typeof type === "object" && typeof type.name === "string") taken.add(type.name)
  }
  let name = "Функция"
  for (let suffix = 2; taken.has(name); suffix += 1) name = `Функция ${suffix}`
  return { kind: "sum", name, variants: names.map((item) => ({ name: item, fields: [] })) }
}
