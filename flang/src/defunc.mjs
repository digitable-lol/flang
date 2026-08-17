/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * defunc.mjs — понижение: ОДИН проход перед печатью на все восемь целей.
 *
 * Понижений здесь два, и оба ставят в программу то, чего в исходнике не было:
 * сторож меры (`guardDescent`) и дефункционализация (`defunctionalize`).
 * Общего у них не тема, а место: печать зовёт их одной строкой на бэкенд, и
 * поэтому восемь целей получают обоих разом, а не восемью реализациями.
 * Вычислитель (`interpret.mjs`) зовёт отсюда же сторожа — иначе его отказ и
 * отказ напечатанного кода совпадали бы случайно, а не по построению.
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
 * Совпасть они не могут, и причина не в лени. Отказ с выбранными кодом и
 * текстом в языке выразим ровно одним способом — постусловием: код и текст
 * едут в AST данными, и оба движка читают одно и то же поле. Этим способом
 * пользуется сторож меры ниже. Но постусловие проверяет РЕЗУЛЬТАТ функции, а
 * здесь отказать надо ВНУТРИ тела, там, где `разбор` не нашёл случая, — и
 * туда постусловие не дотягивается. Остальное потребовало бы новой встроенной
 * формы, то есть правки `builtins.mjs` и по правке в каждом из восьми
 * рантаймов — ровно те восемь правок, ради отсутствия которых написан этот
 * проход. Расхождение поэтому названо, а не спрятано: оно случается ТОЛЬКО на
 * входе, который проверка типов не пропустила бы (значение не того типа,
 * пришедшее снаружи), обе стороны на нём отказывают, и ни на одном входе,
 * который программа способна построить сама, его нет. Проверяется это в
 * `flang/test/hof-emit.test.mjs`.
 */

import { flangError } from "./builtins.mjs"
import { programTags, tagKey, tagVariant } from "./tags.mjs"
import { MEASURE_CODE } from "./totality.mjs"

/**
 * Первопорядковый вид программы со сторожами меры на месте.
 *
 * Два понижения подряд, и порядок между ними не свободен: сторож ставится
 * ПЕРВЫМ, пока применение ещё видно применением. После дефункционализации на
 * его месте стоит вызов диспетчера, отметка меры уехала бы внутрь чужих
 * аргументов, и позиция в ней перестала бы означать то, что означала у
 * анализа.
 *
 * @param {object} program AST модуля (SPEC, раздел 5)
 * @returns {object} та же программа, если стеречь и понижать в ней нечего
 */
export function defunctionalize(program) {
  if (program === null || typeof program !== "object" || Array.isArray(program)) return program
  const guarded = guardDescent(program)
  /* Ни одной новой формы — печатать нечего. Возвращается тот же объект: см.
     шапку, «тождественность» здесь не свойство обхода, а его отсутствие. */
  if (!hasHigherOrder(guarded)) return guarded
  return liftHigherOrder(guarded)
}

function liftHigherOrder(program) {
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
  const paramsOf = (name) => (functions.has(name) ? paramNamesOf(functions.get(name)) : null)
  const found = programTags(program, paramsOf)
  /* Внутри одной функции теги идут в порядке ПЕРВОГО ПОЯВЛЕНИЯ в программе:
     `programTags` отдаёт их обходом, а обход у обеих сторон один и тот же.
     Сортировать их между собой нечем — captured это строки, а сравнения строк
     по порядку в языке нет. */
  const tags = []
  for (const name of functions.keys()) {
    for (const тег of found.values()) if (тег.name === name) tags.push(тег)
  }
  const byArity = new Map()
  for (const тег of tags) {
    /* Арность ОСТАВШАЯСЯ: захваченное уже лежит полем тега, и диспетчер получит
       только то, чего в теге нет. Та же арность, по которой раскладывает теги
       анализ завершаемости, — списки случаев обязаны совпасть. */
    const arity = arityOf(functions.get(тег.name)) - тег.captured.length
    if (!byArity.has(arity)) byArity.set(arity, [])
    byArity.get(arity).push(тег)
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
  const fresh = tags.filter((тег) => !declaredVariants.has(tagVariant(тег.name, тег.captured)))
  if (fresh.length > 0) итог.types = [...(rewritten.types ?? []), tagSum(fresh, program, functions)]
  return итог
}

/** Имена параметров объявленной функции — в объявленном порядке. */
function paramNamesOf(fn) {
  if (!Array.isArray(fn?.params)) return []
  return fn.params.map((param) => (typeof param === "string" ? param : param?.name)).filter((имя) => typeof имя === "string")
}

/* ── сторож меры ──────────────────────────────────────────────────────────── */

/** Основа имени сторожа. Занято — уступает, ровно как имя диспетчера. */
const GUARD_NAME = "мера убывает"

/** Имя, под которым постусловие сторожа видит его результат. */
const GUARD_RESULT = "результат"

/** Имя связки, в которую попадает посчитанный шаг меры. */
const GUARD_STEP = "шаг"

/** Основа имени сторожа ОБЪЯВЛЕННОЙ меры — он другой, поэтому и имя другое. */
const DESCENT_NAME = "объявленная мера убывает"

/** Имена связок сторожа объявленной меры. */
const DESCENT_NEXT = "мера шага"
const DESCENT_CURRENT = "мера витка"
const DESCENT_ARG = "довод"

/** Имя параметра типа полиморфного сторожа объявленной меры. */
const DESCENT_TYPE = "Значение под сторожем"

/**
 * Сторож на каждом вызове, чьё завершение доказано числовой мерой.
 *
 *     «До нуля» от (н минус 1)
 *       →
 *     «До нуля» от (пусть шаг равно (н минус 1)
 *                   если шаг меньше н то шаг иначе («мера убывает» от шаг и н))
 *
 * и на программу добавляется по одной функции на каждый отмеченный текст:
 *
 *     тотальная функция «мера убывает»
 *       принимает шаг: число, мера: число
 *       возвращает число
 *       свойство «мера убывает»: результат меньше мера
 *       шаг
 *
 * ── Зачем это вообще ───────────────────────────────────────────────────────
 *
 * Доказательство по мере (`totality.mjs`, «Числовая мера») верно для
 * вещественных чисел: шаг −1 с дном обязан упереться в дно. Числа flang —
 * IEEE-754 double, и там `x минус 1` при |x| ≥ 2⁵⁴ равен x: шаг не меняет
 * значение, спуск не идёт, а `тотальная` уже пообещала завершение. Обещание
 * было ложным ровно на этих входах, и закрыть дыру анализом нельзя —
 * понадобилась бы верхняя граница на параметр, а её в `если н не больше 0`
 * взяться неоткуда.
 *
 * Сторож переводит ложь в отказ: программа либо завершается, либо отказывает
 * с кодом `FLANG_MEASURE`, но не виснет. Отказ в этом языке уже часть модели —
 * отказ встроенной формы прекращает вычисление и не перехватывается.
 *
 * ── Почему постусловие, а не новая форма ───────────────────────────────────
 *
 * Формы «возбудить ошибку» в flang нет, и заводить её значило бы правку
 * `builtins.mjs` и по правке в каждом из восьми рантаймов. Постусловие даёт
 * ровно нужное и уже есть везде: код и текст едут в AST ДАННЫМИ
 * (`compat.mjs`, шапка), интерпретатор бросает `flangError(code, message)`,
 * напечатанный C — `fl_fail(ctx, error, code, "%s", message)`. Совпадение
 * кода и текста здесь не совпадение, а то же самое поле AST, прочитанное
 * двумя движками; дифференциальная сверка (`emit-c.test.mjs`) сравнивает
 * именно их.
 *
 * Сторож — отдельная функция, а не постусловие на самой рекурсивной функции,
 * по двум причинам. Постусловие проверяет РЕЗУЛЬТАТ, а стеречь надо аргумент.
 * И функция с постусловиями не получает хвостовых вызовов ни у одного из
 * восьми бэкендов — повесив его на «До нуля», мы разменяли бы зацикливание на
 * переполнение стека. Сторож же — лист: он не рекурсивен, и его собственный
 * кадр живёт один вызов.
 *
 * ── Почему сравнение с параметром по имени ─────────────────────────────────
 *
 * `шаг меньше мера` — это `(н минус 1) меньше н`, то есть дословно то, что
 * доказывал анализ. Имя параметра приезжает в отметке, и анализ отмечает
 * только те позиции, где имя в точке вызова не перекрыто (`visibleParams`).
 *
 * ── Одна функция на текст, а не на вызов ───────────────────────────────────
 *
 * Текст отказа называет вызывающую функцию, вызываемую и параметр — иначе
 * человеку негде искать. Значит одинаковых текстов у разных мест не бывает, а
 * одинаковые тексты у одного места (то же ребро, отмеченное дважды) обязаны
 * дать одну функцию. Отсюда ключ — текст, а список текстов приезжает полем
 * `measures` от анализа: собирать его обходом значило бы платить полным
 * обходом за КАЖДУЮ программу, включая те, где меры нет, — и печать
 * `self/emit-c.flang` на этом вышла за сто миллионов шагов.
 */
export function guardDescent(program) {
  if (program === null || typeof program !== "object" || Array.isArray(program)) return program
  /* Ни одного текста — стеречь нечего, и программа даже не обходится.
     Возвращается ТОТ ЖЕ объект: без этого проход менял бы байты там, где
     числовой меры нет вовсе, и побайтовое совпадение самоприменения рухнуло бы
     на первой же программе. Список приезжает полем от анализа, а не собирается
     обходом: обход платили бы все программы, а не только стережённые. */
  const messages = measuresOf(program)
  const declared = descentTextsOf(program)
  if (messages.length === 0 && declared.length === 0) return program

  const taken = new Set()
  for (const fn of program.functions ?? []) {
    if (fn !== null && typeof fn === "object" && typeof fn.name === "string") taken.add(fn.name)
  }
  const выбрать = (основа) => {
    let name = основа
    for (let suffix = 2; taken.has(name); suffix += 1) name = `${основа} ${suffix}`
    taken.add(name)
    return name
  }
  const names = new Map()
  for (const message of messages) names.set(message, выбрать(GUARD_NAME))
  const descentNames = new Map()
  for (const messages of declared) descentNames.set(JSON.stringify(messages), выбрать(DESCENT_NAME))

  /* Поручение израсходовано — и списки, и отметки на узлах снимаются. Оставь
     их, и второй проход обернул бы сторожа сторожем. */
  const { measures: _spent, descents: _spentDeclared, ...rewritten } = installGuards(program, names, descentNames)
  return {
    ...rewritten,
    functions: [
      ...(rewritten.functions ?? []),
      ...messages.map((message) => renderGuard(names.get(message), message)),
      ...declared.map((messages) => renderDescentGuard(descentNames.get(JSON.stringify(messages)), messages)),
    ],
  }
}

/**
 * Отметка анализа на узле аргумента — или `null`.
 *
 * Проверяется по полям, а не по наличию: отметку кладёт `totality.mjs`, но
 * AST приходит и из `.json`, написанного руками, и оттуда может прийти что
 * угодно. Кривая отметка — это отсутствие отметки, а не отказ печати: сторожа
 * не будет, и это ровно то состояние, в котором язык жил до сегодня.
 */
function measureOf(node) {
  const mark = node.measure
  if (mark === null || typeof mark !== "object" || Array.isArray(mark)) return null
  if (typeof mark.param !== "string" || typeof mark.message !== "string") return null
  return mark
}

/**
 * Тексты отказов, которые анализ поручил стеречь, — по одной функции на текст.
 *
 * Порядок — тот, в каком их назвал анализ; он наблюдаем в напечатанном C
 * (какой сторож получит имя без номера) и потому не сортируется здесь заново:
 * сортировки строк в языке нет вовсе, и копия прохода на flang её повторить не
 * смогла бы.
 */
function measuresOf(program) {
  return listOfTexts(program.measures)
}

/**
 * Тройки текстов объявленной меры, без повторов.
 *
 * Тройкой, а не строкой: у сторожа объявленной меры три постусловия, и текст у
 * каждого свой — «не убыла», «ушла ниже нуля», «перестала быть целой». Чинятся
 * они разным, поэтому и говорятся врозь.
 */
function descentTextsOf(program) {
  const list = program.descents
  if (!Array.isArray(list)) return []
  const found = []
  const seen = new Set()
  for (const item of list) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue
    if (typeof item.less !== "string" || typeof item.bound !== "string" || typeof item.whole !== "string") continue
    const key = JSON.stringify(item)
    if (seen.has(key)) continue
    seen.add(key)
    found.push({ less: item.less, bound: item.bound, whole: item.whole })
  }
  return found
}

/** Непустые неповторяющиеся строки списка — или пусто, если это не список. */
function listOfTexts(list) {
  if (!Array.isArray(list)) return []
  const found = []
  for (const item of list) {
    if (typeof item === "string" && item.length > 0 && !found.includes(item)) found.push(item)
  }
  return found
}

/**
 * Отметка объявленной меры на узле вызова — или `null`.
 *
 * Проверяется по полям ровно так же, как отметка постоянного шага, и по той же
 * причине: AST приходит и из `.json`, написанного руками. Кривая отметка — это
 * отсутствие отметки, а не отказ печати.
 */
function descentOf(node) {
  const mark = node.descent
  if (mark === null || typeof mark !== "object" || Array.isArray(mark)) return null
  const messages = mark.messages
  if (messages === null || typeof messages !== "object" || Array.isArray(messages)) return null
  if (typeof messages.less !== "string" || typeof messages.bound !== "string" || typeof messages.whole !== "string") return null
  if (mark.current === null || typeof mark.current !== "object") return null
  if (mark.next === null || typeof mark.next !== "object") return null
  if (!Array.isArray(mark.calleeParams)) return null
  return mark
}

/**
 * Обёртывание отмеченного аргумента. Копируется только путь до отметки —
 * как и в дефункционализации, и по той же причине.
 *
 * Отметка снимается: она поручение понижению, а не часть программы. Оставь её
 * — и второй проход обернул бы сторожа сторожем.
 */
function installGuards(node, names, descentNames = new Map()) {
  if (Array.isArray(node)) {
    let changed = false
    const items = node.map((item) => {
      const next = installGuards(item, names, descentNames)
      if (next !== item) changed = true
      return next
    })
    return changed ? items : node
  }
  if (node === null || typeof node !== "object") return node

  const mark = measureOf(node)
  const descent = descentOf(node)
  let changed = false
  const copy = {}
  for (const [key, value] of Object.entries(node)) {
    if ((key === "measure" && mark !== null) || (key === "descent" && descent !== null)) {
      changed = true
      continue
    }
    const next = installGuards(value, names, descentNames)
    if (next !== value) changed = true
    copy[key] = next
  }
  if (descent !== null) return wrapDescent(copy, descent, descentNames.get(JSON.stringify(descent.messages)))
  if (mark === null) return changed ? copy : node

  /* Имя связки обязано отличаться от имени параметра — иначе `пусть шаг равно
     (шаг минус 1)` закрыло бы собой то самое значение, с которым сравниваем. */
  let step = GUARD_STEP
  for (let suffix = 2; step === mark.param; suffix += 1) step = `${GUARD_STEP} ${suffix}`
  const шаг = { kind: "var", name: step }
  const мера = { kind: "var", name: mark.param }
  return {
    kind: "let",
    name: step,
    value: copy,
    in: {
      kind: "if",
      cond: { kind: "binary", op: "lt", left: шаг, right: мера },
      then: шаг,
      /* Вызов стоит в ветви, куда попадают только тогда, когда шаг ничего не
         изменил. На каждом витке платится сравнение и предсказуемая ветка, а
         не кадр вызова: в вычислителе разница между этим и «звать сторожа
         всегда» — девятикратная (замер в `flang/test/totality.test.mjs`). */
      else: {
        kind: "call",
        name: names.get(mark.message),
        args: [шаг, мера],
        span: node.span,
      },
      span: node.span,
    },
    span: node.span,
  }
}

function renderGuard(name, message) {
  return {
    name,
    /* Сторож тотален: он лист, возвращает свой первый аргумент и не зовёт
       никого. Признак не украшение — по нему печатают комментарий все восемь
       целей, а Elixir ещё и решает, чем становится функция. */
    total: true,
    params: [
      { name: "шаг", type: { kind: "number" } },
      { name: "мера", type: { kind: "number" } },
    ],
    returns: { kind: "number" },
    postconditions: [
      {
        name: GUARD_NAME,
        bind: GUARD_RESULT,
        /* Строго меньше, а не «не больше»: доказательство обещало СТРОГОЕ
           убывание, и цепочка с равенством — это ровно та цепочка, которая не
           заканчивается. Заодно отсюда отказ на NaN: сравнение с NaN ложно, и
           `«До нуля» от NaN` перестаёт быть вечным. */
        expr: {
          kind: "binary",
          op: "lt",
          left: { kind: "var", name: GUARD_RESULT },
          right: { kind: "var", name: "мера" },
        },
        code: MEASURE_CODE,
        message,
      },
    ],
    body: { kind: "var", name: "шаг" },
    examples: [],
  }
}

/* ── сторож ОБЪЯВЛЕННОЙ меры ──────────────────────────────────────────────── */

const ЧИСЛО = (значение) => ({ kind: "literal", value: значение })
const ИМЯ = (имя) => ({ kind: "var", name: имя })
const ДВУЧЛЕН = (op, left, right) => ({ kind: "binary", op, left, right })

/**
 * Условие «мера убыла» — три проверки, и каждая обязательна.
 *
 *   шаг < мера      строгое убывание: цепочка с равенством не заканчивается;
 *   шаг ≥ 0         дно: без него цепочка уходит в минус бесконечность;
 *   шаг целое       вполне обоснованность: строго убывающая цепочка ЦЕЛЫХ
 *                   неотрицательных чисел не длиннее своего первого члена, а
 *                   дробная — обрывается только на зернистости double, то есть
 *                   через десятки квинтиллионов витков. Ровно этим Евклид и был
 *                   отвергнут раньше: остатки пары (φ, 1) убывают и не кончаются.
 *
 * Целость записана как `шаг минус (шаг остаток от 1) равно шаг`, а не
 * округлением: округления в языке нет, а эта запись верна на всех конечных
 * double и ложна на всех дробных. На NaN и ±бесконечности ложно уже первое
 * сравнение, поэтому до неё дело не доходит.
 *
 * Записано вложенными `если`, а не конъюнкцией, по прозаичной причине:
 * инфиксного `и` в языке нет (`flang/stdlib/logic.flang`), а вызывать
 * `«Оба верны»` из напечатанного сторожа значило бы тащить в него зависимость
 * от стандартной библиотеки.
 */
function descends(шаг, мера) {
  const целое = ДВУЧЛЕН("eq", ДВУЧЛЕН("sub", шаг, ДВУЧЛЕН("mod", шаг, ЧИСЛО(1))), шаг)
  const неотрицательна = { kind: "if", cond: ДВУЧЛЕН("gte", шаг, ЧИСЛО(0)), then: целое, else: ЧИСЛО(false) }
  return { kind: "if", cond: ДВУЧЛЕН("lt", шаг, мера), then: неотрицательна, else: ЧИСЛО(false) }
}

/** Свежее имя: то же правило уступки, что у имени сторожа и диспетчера. */
function freshName(основа, taken) {
  let имя = основа
  for (let suffix = 2; taken.has(имя); suffix += 1) имя = `${основа} ${suffix}`
  taken.add(имя)
  return имя
}

/** Все имена, встречающиеся в поддереве, — чтобы связка их не перекрыла. */
function varNames(node, found = new Set()) {
  if (Array.isArray(node)) {
    for (const item of node) varNames(item, found)
    return found
  }
  if (node === null || typeof node !== "object") return found
  if (node.kind === "var" && typeof node.name === "string") found.add(node.name)
  for (const [key, value] of Object.entries(node)) {
    if (key === "span") continue
    varNames(value, found)
  }
  return found
}

/** Переименование `var` по словарю. Мера состоит только из имён параметров. */
function renameVars(node, mapping) {
  if (Array.isArray(node)) return node.map((item) => renameVars(item, mapping))
  if (node === null || typeof node !== "object") return node
  if (node.kind === "var" && mapping.has(node.name)) return { ...node, name: mapping.get(node.name) }
  const copy = {}
  for (const [key, value] of Object.entries(node)) copy[key] = renameVars(value, mapping)
  return copy
}

/**
 * Обёртка вызова, чьё завершение держится на ОБЪЯВЛЕННОЙ мере.
 *
 * ── Почему оборачивается вызов, а не аргумент ──────────────────────────────
 *
 * Сторож постоянного шага оборачивает АРГУМЕНТ: там убывает сам аргумент, он
 * число, и сравнить его с параметром можно на месте. У объявленной меры
 * убывает ВЫРАЖЕНИЕ от всех аргументов сразу, и ни на одном из них оно не
 * лежит. Поэтому обёртка охватывает вызов целиком.
 *
 * ── Почему аргументы сперва связываются ────────────────────────────────────
 *
 * Мера следующего витка считается ОТ АРГУМЕНТОВ. Подставь в неё сами
 * выражения — и каждый аргумент вычислялся бы дважды: один раз в мере, второй
 * раз в вызове. На `а остаток от б` это мелочь, а на аргументе, внутри
 * которого стоит ещё один рекурсивный вызов, — удвоение работы на каждом
 * витке, то есть экспонента. Связка считает каждый аргумент ровно один раз, и
 * мера с вызовом читают уже посчитанное.
 *
 * ── Почему сторож полиморфный ──────────────────────────────────────────────
 *
 * Ветка `иначе` обязана дать значение ТОГО ЖЕ типа, что и ветка `то`, а тип
 * этот — тип аргумента, и он какой угодно. Числовой сторож постоянного шага
 * сюда не годится. Полиморфный годится: параметр типа выводится из третьего
 * аргумента (`значение: «…»`), и вернуть сторож обязан его же.
 *
 * Отказ приходит не из тела сторожа, а из его ПОСТУСЛОВИЯ — тем же приёмом,
 * каким устроен сторож постоянного шага: код и текст едут в AST данными, и
 * потому одинаковы у вычислителя и у всех восьми целей печати. Тело сторожа —
 * тождество, и на исправном витке он не зовётся вовсе: вызов стоит в ветви,
 * куда попадают только тогда, когда мера не убыла.
 */
function wrapDescent(call, descent, guardName) {
  const args = Array.isArray(call.args) ? call.args : []
  /* Арность не сошлась — про это говорит `types.mjs`, а стеречь несобранную
     программу нечем: подставлять в меру нечего. */
  if (typeof guardName !== "string" || args.length === 0 || args.length !== descent.calleeParams.length) return call

  const taken = varNames(call)
  varNames(descent.current, taken)
  varNames(descent.next, taken)
  for (const имя of descent.calleeParams) if (typeof имя === "string") taken.add(имя)

  const связки = args.map((_, index) => freshName(`${DESCENT_ARG} ${index + 1}`, taken))
  const витка = freshName(DESCENT_CURRENT, taken)
  const шага = freshName(DESCENT_NEXT, taken)

  const подстановка = new Map()
  descent.calleeParams.forEach((имя, index) => {
    if (typeof имя === "string") подстановка.set(имя, связки[index])
  })

  const шаг = ИМЯ(шага)
  const мера = ИМЯ(витка)
  const первый = ИМЯ(связки[0])
  /* Стережётся ПЕРВЫЙ аргумент, и это не выбор из нескольких: доказательство
     держится на мере, а не на позиции, поэтому позиция здесь — просто место,
     куда встаёт проверка. Первая занята потому, что она есть всегда. */
  const стережённый = {
    kind: "if",
    cond: descends(шаг, мера),
    then: первый,
    else: { kind: "call", name: guardName, args: [шаг, мера, первый], span: call.span },
    span: call.span,
  }

  let тело = { ...call, args: связки.map((имя, index) => (index === 0 ? стережённый : ИМЯ(имя))) }
  тело = { kind: "let", name: шага, value: renameVars(descent.next, подстановка), in: тело, span: call.span }
  тело = { kind: "let", name: витка, value: descent.current, in: тело, span: call.span }
  for (let index = args.length - 1; index >= 0; index -= 1) {
    тело = { kind: "let", name: связки[index], value: args[index], in: тело, span: call.span }
  }
  return тело
}

/**
 * Сторож объявленной меры: тождество с постусловием.
 *
 * Тотален и лист — как и сторож постоянного шага, и по той же причине: по
 * признаку `total` восемь целей печатают комментарий, а Elixir ещё и решает,
 * чем становится функция.
 */
function renderDescentGuard(name, messages) {
  const значение = { kind: "named", name: DESCENT_TYPE }
  const шаг = ИМЯ(GUARD_STEP)
  const мера = ИМЯ("мера")
  /* Постусловия смотрят на ПАРАМЕТРЫ, а не на результат: результат здесь —
     стережённое значение какого угодно типа, и сравнивать его не с чем.
     Три условия — три постусловия, и порядок их не случаен: он тот же, в каком
     их проверяет быстрая ветвь (`descends`), поэтому нарушенным всегда
     оказывается ровно то, о котором сторож и скажет. */
  const условие = (bind, expr, message) => ({ name: DESCENT_NAME, bind, expr, code: MEASURE_CODE, message })
  return {
    name,
    total: true,
    typeParams: [DESCENT_TYPE],
    params: [
      { name: GUARD_STEP, type: { kind: "number" } },
      { name: "мера", type: { kind: "number" } },
      { name: "значение", type: значение },
    ],
    returns: значение,
    postconditions: [
      условие(GUARD_RESULT, ДВУЧЛЕН("lt", шаг, мера), messages.less),
      условие(GUARD_RESULT, ДВУЧЛЕН("gte", шаг, ЧИСЛО(0)), messages.bound),
      условие(GUARD_RESULT, ДВУЧЛЕН("eq", ДВУЧЛЕН("sub", шаг, ДВУЧЛЕН("mod", шаг, ЧИСЛО(1))), шаг), messages.whole),
    ],
    body: { kind: "var", name: "значение" },
    examples: [],
  }
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
  /* Захваченное едет полями варианта — теми же самыми, какими его несёт тег у
     вычислителя. Значения полей переписываются: внутри захвата законно всё, что
     законно в выражении, в том числе другой тег. */
  const fields = {}
  for (const [ключ, значение] of Object.entries(node.fields ?? {})) fields[ключ] = rewrite(значение, ctx)
  return {
    kind: "construct",
    variant: tagVariant(node.name, Object.keys(fields)),
    fields,
    span: node.span,
  }
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

  const cases = (ctx.byArity.get(arity) ?? []).map((тег) => {
    /* Захваченное достаётся из полей тега, остальное приходит аргументами
       диспетчера. Собирается вызов В ПОРЯДКЕ ОБЪЯВЛЕНИЯ — ровно так же, как
       собирает его вычислитель, иначе напечатанное считало бы другое.

       Имя связки — само имя параметра: поле варианта названо им же, и `разбор`
       связывает его без переименования. Столкнуться с `а1`…`аN` оно не может —
       те заняты диспетчером, а параметр с таким именем захвачен быть не может,
       не будучи при этом в `captured`. */
    const bind = {}
    for (const имя of тег.captured) bind[имя] = имя
    const остальные = params.slice(1).map((param) => ({ kind: "var", name: param.name }))
    let следующий = 0
    const args = paramNamesOf(ctx.functions.get(тег.name)).map((имя) =>
      тег.captured.includes(имя) ? { kind: "var", name: имя } : остальные[следующий++],
    )
    return {
      pattern: { kind: "variant", name: tagVariant(тег.name, тег.captured), bind },
      body: { kind: "call", name: тег.name, args },
    }
  })

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
function tagSum(tags, program, functions) {
  const taken = new Set()
  for (const type of program.types ?? []) {
    if (type !== null && typeof type === "object" && typeof type.name === "string") taken.add(type.name)
  }
  let name = "Функция"
  for (let suffix = 2; taken.has(name); suffix += 1) name = `Функция ${suffix}`
  /* Поля варианта — захваченные параметры, с ОБЪЯВЛЕННЫМИ типами: печать
     объявляет по ним поля структуры, и взять типы откуда-то ещё значило бы
     напечатать структуру, не совпадающую с тем, что в неё кладут. */
  const полем = (имяФункции, имяПоля) => {
    const fn = functions.get(имяФункции)
    const param = (Array.isArray(fn?.params) ? fn.params : []).find(
      (item) => (typeof item === "string" ? item : item?.name) === имяПоля,
    )
    return { name: имяПоля, type: typeof param === "string" ? undefined : param?.type }
  }
  return {
    kind: "sum",
    name,
    variants: tags.map((тег) => ({
      name: tagVariant(тег.name, тег.captured),
      fields: тег.captured.map((имя) => полем(тег.name, имя)),
    })),
  }
}
