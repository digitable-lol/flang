/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * totality.mjs — анализ завершаемости для `тотальных` функций flang.
 *
 * Задача модуля: превратить обещание «эта функция завершается» в проверенный
 * факт. Пометка `тотальная` ничего не гарантирует сама по себе — гарантию даёт
 * это доказательство (SPEC, раздел 1).
 *
 * Доказательств здесь два, и они независимы: структурное убывание (часть
 * значения меньше значения) и убывание по числовой мере (число уменьшается на
 * постоянный шаг и снизу ограничено). Общего у них одно — оба дают вполне
 * обоснованный порядок, по которому цепочка вызовов обязана оборваться.
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
 * ответ на два вопроса сразу: «частью какого параметра это значение является и
 * насколько глубоко разобранной частью» и «насколько это значение меньше
 * своего параметра как число»:
 *
 *   null                                        — про значение ничего не известно
 *   { param: i, depth: 0, step: 0 }             — это сам параметр i
 *   { param: i, depth: k, step: null }          — часть параметра i, k разборов вглубь
 *   { param: i, depth: null, step: −c }         — это `параметр i − c`, где c — число
 *
 * `depth` растёт (`depth + 1`) там, где значение достаётся из значения:
 * `хвост`/`голова` от списка, привязки образца «голова и хвост», поля варианта
 * в образце, поле записи, элемент коллекции в
 * `отобразить`/`отфильтровать`/`свёртка`. Оно теряется (`null`) там, где
 * значение строится: конструктор варианта, литерал списка, `добавить … к …`,
 * арифметика, результат любого вызова. `пусть` переносит происхождение
 * значения на имя; `если` и `разбор` объединяют ветви, беря минимальную
 * глубину при совпадающем параметре.
 *
 * `step` двигается на `± литерал` в `плюс` и `минус` и теряется во всём
 * остальном: разбор значения, умножение, деление, второй параметр вместо
 * литерала. `если` и `разбор` берут по ветвям МАКСИМАЛЬНЫЙ шаг — то есть самое
 * слабое из обещаний.
 *
 * Вызов f → g убывает на позиции j, если на месте j-го параметра g стоит
 * либо собственная ЧАСТЬ j-го параметра f (`{ param: j, depth ≥ 1 }`), либо
 * j-й параметр f, уменьшенный на постоянный шаг (`{ param: j, step < 0 }`) —
 * и во втором случае при условии, что этот параметр ограничен снизу (ниже).
 *
 * ── Числовая мера: почему одного шага мало ─────────────────────────────────
 *
 * Структурное убывание самодостаточно: значения — конечные деревья, и цепочка
 * частей обязана оборваться сама. У числа такого дна нет. `«Ф» от (н минус 1)`
 * уменьшает н сколько угодно раз и не останавливается никогда: −1, −2, −3 …
 * Поэтому одного шага для доказательства мало, и нужны ДВА условия сразу:
 *
 *   1. шаг строго отрицательный и ПОСТОЯННЫЙ (`минус <литерал>`);
 *   2. в точке вызова параметр ограничен снизу числом.
 *
 * Тогда цепочка v₀ > v₁ > … с шагом ≥ δ > 0 и дном K оборвётся не позже чем
 * через (v₀ − K)/δ вызовов. Убери любое условие — доказательства нет:
 * без дна цепочка уходит в минус бесконечность, без постоянного шага
 * (`н минус ш`, где ш — параметр) шаг может оказаться нулевым или
 * отрицательным, и цепочка не убывает вовсе.
 *
 * Дно берётся из `если`: сравнение параметра с числовым литералом даёт в одной
 * из ветвей нижнюю границу, и в этой ветви параметр помечается ограниченным.
 * `н больше 0` и `н не меньше 0` дают границу в ветви `то`; `н меньше 0` и
 * `н не больше 0` — в ветви `иначе`. Пометка ставится на ВСЕ имена, выведенные
 * из того же параметра, потому что граница — свойство параметра, а не имени:
 * после `пусть м равно (н минус 1)` в ветви с `н > 0` про `м` известно ровно
 * столько же.
 *
 * РАВЕНСТВО границы не даёт, и это не упущение. База `если н равно 0` при шаге
 * −1 завершается только для целого НЕОТРИЦАТЕЛЬНОГО входа: `«Ф» от (−5)` уйдёт
 * в −6, −7, … мимо нуля, а `«Ф» от 0.5` — в −0.5, −1.5 … тоже мимо. Дробный
 * шаг ломается ровно так же: `н минус 0.5` при базе `н равно 0` не завершается
 * на входе 0.75.
 * Отсюда решение: дело не в дробности шага, а в форме базы. Любой постоянный
 * отрицательный шаг, включая `минус 0.5`, доказывается при базе-НЕРАВЕНСТВЕ, и
 * никакой шаг не доказывается при базе-равенстве.
 *
 * ── Где это доказательство упирается в IEEE-754, и чем оно там подпёрто ─────
 *
 * Рассуждение выше верно для вещественных чисел. Числа flang — IEEE-754 double
 * (SPEC, раздел 2), и там `x − 1` иногда равен `x`: при большом |x| единица не
 * помещается в мантиссу. Мерено: 18014398509481988 − 1 даёт то же число, 1e308
 * − 1 тоже; `«До нуля»` от них не спускался никуда. То же на ±∞ и на NaN.
 *
 * Анализом это не закрыть: понадобилась бы верхняя граница на параметр, а её в
 * `если н не больше 0` нет и взяться ей неоткуда. Поэтому доказательство здесь
 * не отказывается от меры и не притворяется полным — оно ТРЕБУЕТ СТОРОЖА и
 * говорит, где его поставить. Каждый вызов, чьё завершение держится на мере,
 * помечается (`markMeasureGuards`), а понижение перед печатью ставит на
 * отмеченном аргументе проверку «шаг меньше меры» (`defunc.mjs`,
 * `guardDescent`). Не убыло — отказ `FLANG_MEASURE`, одинаковый у вычислителя и
 * у всех восьми целей, потому что код и текст едут в AST данными.
 *
 * Что от этого стало правдой. `тотальная` снова означает «не зациклится»: либо
 * программа завершается, либо честно отказывает. Отказ приходит РОВНО на тех
 * входах, где шаг физически ничего не изменил, — на 1e10 сторож пропускает
 * каждый виток, и функция просто считает свои 10¹⁰ шагов. Медленно — не то же
 * самое, что бесконечно, и различает их здесь измерение, а не оценка.
 *
 * Цена — связка, сравнение и ветка на виток; сам сторож зовётся только тогда,
 * когда шаг ничего не изменил, то есть один раз перед отказом. Ровно десять
 * шагов вычислителя на виток, и это проверяется числом в
 * `flang/test/totality.test.mjs`.
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
 * Способ убывания на общей позиции обязан совпадать тоже: структурная цепочка
 * и числовая — разные порядки, и «часть на одном ребре, число на другом» не
 * складывается ни в один из них. В типизированной программе такого не бывает
 * (позиция не может быть и списком, и числом), но анализ завершаемости типов
 * не читает и полагаться на них не вправе.
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
 * Лексикографическое убывание (Аккерман), убывание через результат другой
 * функции («хвост от «Отсортировать» от списка») и разные убывающие позиции у
 * разных рекурсивных вызовов одной функции — всё это отвергается. Из числовых
 * мер отвергается всё, кроме постоянного шага: `н минус ш` с параметром ш,
 * Евклид (`остаток от`), двоичный поиск (`(низ плюс верх) делить на 2`) —
 * шаг там не постоянен, и одного знака у него нет. Анализ консервативен по
 * построению: он никогда не признаёт тотальной функцию, которая может
 * зациклиться, и цена этому — отказ части действительно завершающихся
 * программ.
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
    params.forEach((paramName, index) => env.set(paramName, parameterOrigin(index, paramName)))
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

  const guards = []
  for (const component of stronglyConnectedComponents([...totalNames], edges)) {
    checkComponent(component, edges, failed, report, guards)
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
  /* Стеречь незачем то, что и так не доказано: у недоказанной функции гарантии
     нет, и завершение ей обеспечивает лимит шагов, а не мера. */
  return { ok: diagnostics.length === 0, diagnostics, total, guards: guards.filter((guard) => total.has(guard.from)) }
}

/* ------------------------------------------------------------------ */
/* Отметка меры: что анализ поручает стеречь понижению                 */
/* ------------------------------------------------------------------ */

/** Код отказа, когда доказанная мера на самом деле не убыла. */
export const MEASURE_CODE = "FLANG_MEASURE"

/**
 * Программа с отметками на тех вызовах, чьё доказательство держится на мере.
 *
 * Возвращается ТОТ ЖЕ объект, если стеречь нечего: отметка обязана быть
 * невидимой на программах без числовой меры, иначе печать разошлась бы там,
 * где ничего не менялось.
 *
 * Почему отметка, а не готовый сторож. Поставить сторожа — работа понижения
 * (`defunc.mjs`), потому что понижений ДВА: эталон на JavaScript и копия на
 * самом языке (`self/defunc.flang`), и они обязаны давать побайтово одно и то
 * же. Копия на языке анализа завершаемости позвать не может — `totality.flang`
 * сам импортирует `emit-c.flang`, а тот импортирует `defunc.flang`, и
 * связывание такой круг отвергает (`FLANG_IMPORT_CYCLE`). Поэтому слои
 * разделены по знанию: анализ ЗНАЕТ, какая позиция несёт доказательство, и
 * говорит это отметкой; понижение отметку читает и ставит сторожа, ничего не
 * доказывая. Обе стороны понижения читают одну и ту же отметку — значит и
 * печатают одно и то же.
 *
 * Отметка не меняет ни одного вывода анализа: она — лишнее поле на узле
 * вызова, а разбор происхождения смотрит на `args`. Поэтому пометить дважды
 * так же безвредно, как один раз.
 */
export function markMeasureGuards(program) {
  if (program === null || typeof program !== "object" || Array.isArray(program)) return program
  return markGuards(program, checkTotality(program).guards)
}

/**
 * То же самое для тех, кто анализ уже позвал.
 *
 * Оболочка и языковой сервер проверяют каждый ввод целиком, и второй прогон
 * анализа ради одной отметки был бы платой ни за что: на связанном компиляторе
 * из 1275 функций это 40 мс на нажатие.
 */
export function markGuards(program, guards) {
  if (program === null || typeof program !== "object" || Array.isArray(program)) return program
  if (!Array.isArray(guards) || guards.length === 0) return program

  const marks = new Map()
  const measures = []
  for (const guard of guards) {
    /* Помечается САМ АРГУМЕНТ, а не вызов с номером позиции. Номер пришлось бы
       понижению искать в списке, а список в flang читается только с головы —
       копия прохода на самом языке считала бы элементы вручную, и первое же
       расхождение в счёте разошлось бы байтами. Узел аргумента у каждого места
       свой, и подменить его можно там же, где обход до него дошёл. */
    if (guard.arg === null || typeof guard.arg !== "object" || marks.has(guard.arg)) continue
    const message = measureMessage(guard)
    if (!measures.includes(message)) measures.push(message)
    marks.set(guard.arg, { param: guard.param, message })
  }

  /* Тексты отказов повторены на программе списком, и это не дублирование, а
     ЦЕНА ОБХОДА. Сторожу нужно по функции на текст, а собрать тексты можно
     было бы и обходом всей программы — эталон на JavaScript так и делал.
     Копия на самом языке платит за такой обход шагами вычислителя: печать
     `self/emit-c.flang` (3300 строк) вышла за сто миллионов шагов ровно на нём,
     и лишний полный обход платили ВСЕ программы, включая те, где меры нет
     вовсе. Список здесь читается одним полем: программа без меры не обходится
     ни разу, а порядок текстов задаёт анализ, а не порядок чужого обхода. */
  return { ...applyMarks(program, marks), measures }
}

/**
 * Текст отказа. Пишется здесь, а не в понижении, по той же причине, по какой
 * здесь стоит отметка: почему доказательство держалось на этом аргументе,
 * знает только анализ. Понижение переносит текст в постусловие дословно.
 */
function measureMessage(guard) {
  return `тотальная функция «${guard.from}»: мера не убыла — аргумент ${guard.position + 1} `
    + `${guard.applied === true ? "применения" : "вызова"} «${guard.to}» не стал меньше параметра «${guard.param}». `
    + `Завершение доказано убыванием этой меры, а числа flang — IEEE-754 double: при большом |«${guard.param}»| `
    + "постоянный шаг не меняет значение, и спуск не идёт. Отказ здесь честнее зацикливания"
}

/** Копия по пути до отмеченных узлов; всё остальное — тот же объект. */
function applyMarks(node, marks) {
  if (Array.isArray(node)) {
    let changed = false
    const items = node.map((item) => {
      const next = applyMarks(item, marks)
      if (next !== item) changed = true
      return next
    })
    return changed ? items : node
  }
  if (node === null || typeof node !== "object") return node

  let changed = false
  const copy = {}
  for (const [key, value] of Object.entries(node)) {
    const next = applyMarks(value, marks)
    if (next !== value) changed = true
    copy[key] = next
  }
  const mark = marks.get(node)
  if (mark === undefined) return changed ? copy : node
  return { ...(changed ? copy : node), measure: mark }
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

function checkComponent(component, edges, failed, report, guards) {
  const members = new Set(component)
  const inner = edges.filter((edge) => members.has(edge.from) && members.has(edge.to))
  // Компонента из одной функции без самовызова — не цикл: доказывать нечего.
  if (inner.length === 0) return

  const decreasing = inner.map((edge) => ({ edge, positions: decreasingPositions(edge) }))
  const silent = decreasing.filter((item) => item.positions.length === 0)

  if (silent.length > 0) {
    for (const { edge } of silent) {
      report("FLANG_NOT_TOTAL", explainNoDescent(edge, component), edge.node)
      failed.add(edge.from)
    }
    for (const name of component) failed.add(name)
    return
  }

  /* Общая позиция ищется отдельно среди структурных убываний и отдельно среди
     мер: смешать их значило бы склеить два несовместимых порядка (см. шапку). */
  if (commonPositions(decreasing, false).length > 0) return

  /* Доказано мерой — значит доказано на числах, а не на double. Разница между
     ними наблюдаема (шапка, «Где это доказательство упирается в IEEE-754»),
     поэтому позиция, на которой держится доказательство, называется наружу:
     понижение поставит на ней сторожа, и обещание станет проверяемым в самой
     программе, а не только на бумаге. Берётся ПЕРВАЯ общая позиция — их может
     быть несколько, но доказательство держится на любой одной, и сторожить
     остальные значило бы платить за то же обещание дважды. */
  const мерой = commonPositions(decreasing, true)
  if (мерой.length > 0) {
    const position = мерой[0]
    for (const { edge } of decreasing) {
      guards.push({
        node: edge.node,
        position,
        from: edge.from,
        to: edge.to,
        param: edge.params[position],
        arg: edge.args[position],
        applied: edge.applied === true,
      })
    }
    return
  }

  // Каждое ребро где-то убывает, но общей позиции нет — см. контрпример
  // в шапке файла: такой цикл может быть бесконечным.
  const detail = decreasing
    .map(({ edge, positions }) => `«${edge.from}» → «${edge.to}» убывает по ${positions.map((item) => argumentLabel(edge, item.position)).join(", ")}`)
    .join("; ")
  report(
    "FLANG_NOT_TOTAL",
    `в цикле ${component.map((name) => `«${name}»`).join(" → ")} нет аргумента, который убывает на каждом вызове: ${detail}. Нужен один и тот же убывающий аргумент на всех рёбрах цикла`,
    decreasing[0].edge.node,
  )
  for (const name of component) failed.add(name)
}

/**
 * Позиции, на которых вызов строго убывает, вместе со способом убывания:
 * `measure: false` — часть значения, `measure: true` — числовая мера.
 */
function decreasingPositions(edge) {
  const positions = []
  edge.origins.forEach((origin, index) => {
    if (!origin) return
    if (origin.param !== index) return          // убывать обязан аргумент на своей позиции
    if (index >= edge.calleeParams.length) return
    if (origin.depth !== null && origin.depth >= 1) positions.push({ position: index, measure: false })
    /* Мера без нижней границы убыванием не считается: цепочка «минус один»
       без дна бесконечна (шапка файла, «Числовая мера»). Мера, за которой
       нельзя поставить сторожа, — тоже: доказательство по мере верно только
       вместе с ним (см. `visibleParams`). */
    else if (origin.step !== null && origin.step < 0 && origin.bounded && edge.visible?.[index] === true) {
      positions.push({ position: index, measure: true })
    }
  })
  return positions
}

/** Позиции заданного способа, убывающие на КАЖДОМ ребре компоненты. */
function commonPositions(decreasing, measure) {
  return decreasing[0].positions
    .filter((item) => item.measure === measure)
    .map((item) => item.position)
    .filter((position) => decreasing.every(({ positions }) =>
      positions.some((item) => item.measure === measure && item.position === position)))
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
    const выведено = origin.depth !== null ? "часть" : "мера"
    if (origin.param !== index) {
      return `аргумент ${index + 1} (${shown}) — ${выведено} параметра «${origin.name}», а сравнивается с параметром «${callerParam ?? "?"}» на своей позиции`
    }
    if (origin.depth !== null) {
      if (origin.depth === 0) return `аргумент ${index + 1} (${shown}) — это сам параметр «${origin.name}», а не его часть`
      return `аргумент ${index + 1} (${shown}) убывает`
    }
    return measureReason(origin, index, shown)
  })
  const действие = edge.applied === true ? "применение значения-функции" : "вызов"
  const cycle = edge.from === edge.to
    ? (edge.applied === true ? `применение значения-функции «${edge.to}» к самой себе` : `рекурсивный вызов «${edge.to}»`)
    : `${действие} «${edge.to}» в цикле ${component.map((name) => `«${name}»`).join(" → ")}`
  const hint = "Передавайте часть аргумента: хвост списка из образца «голова и хвост», поле варианта из образца, поле записи или элемент коллекции"
  return `тотальная функция «${edge.from}»: ${cycle} не убывает — ${reasons.join("; ") || "у вызова нет аргументов"}. ${hint}`
}

/**
 * Почему числовая мера не доказывает завершение. Разбор идёт по шагу, а не по
 * границе, потому что чинить надо разное: нулевой и растущий шаг — это
 * переписать вызов, отсутствие границы — дописать проверку.
 */
function measureReason(origin, index, shown) {
  if (origin.step < 0) {
    if (origin.bounded) return `аргумент ${index + 1} (${shown}) убывает по мере`
    return `аргумент ${index + 1} (${shown}) уменьшает параметр «${origin.name}», но снизу «${origin.name}» ничем не ограничен: добавьте проверку вида «если ${origin.name} не больше 0»`
  }
  if (origin.step > 0) return `аргумент ${index + 1} (${shown}) увеличивает параметр «${origin.name}»`
  return `аргумент ${index + 1} (${shown}) не уменьшает параметр «${origin.name}»: шаг нулевой`
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

/** Параметр целиком: он и сам себе часть глубины ноль, и мера с шагом ноль. */
function parameterOrigin(param, name) {
  return { param, name, depth: 0, step: 0, bounded: false }
}

/**
 * Разбор вглубь: результат строго меньше разбираемого значения. Числовая мера
 * при этом теряется — про поле записи неизвестно, насколько оно меньше самой
 * записи как ЧИСЛО, да и числом оно быть не обязано.
 */
function deeper(origin) {
  if (!origin || origin.depth === null) return null
  return { param: origin.param, name: origin.name, depth: origin.depth + 1, step: null, bounded: false }
}

/**
 * Сдвиг меры на постоянное число. Структурное происхождение при этом теряется:
 * `н минус 1` частью `н` не является. Признак «ограничен снизу» переезжает —
 * он про ПАРАМЕТР, а не про выражение, и в этой точке программы он всё тот же.
 */
function shifted(origin, delta) {
  if (!origin || origin.step === null) return null
  return { param: origin.param, name: origin.name, depth: null, step: origin.step + delta, bounded: origin.bounded }
}

/** Объединение ветвей: общее происхождение — самое слабое из двух. */
function join(left, right) {
  if (!left || !right) return null
  if (left.param !== right.param) return null
  const depth = left.depth !== null && right.depth !== null
    ? (left.depth < right.depth ? left.depth : right.depth)
    : null
  /* Самый слабый шаг — наибольший: если одна ветвь уменьшает на 3, а другая
     на 1, обещать можно только «на 1». */
  const step = left.step !== null && right.step !== null
    ? (left.step > right.step ? left.step : right.step)
    : null
  if (depth === null && step === null) return null
  return { param: left.param, name: left.name, depth, step, bounded: left.bounded && right.bounded }
}

/**
 * Конечное число из литерала — или `null`, если это не литерал, не число или
 * не конечное число.
 *
 * Конечность проверяется как `x − x === 0`: у ±∞ и NaN разность с самой собой
 * не ноль. Это не красивость, а необходимость. `если н не больше NaN` ложно
 * ВСЕГДА, значит ветвь `иначе` берётся всегда, и граница оттуда была бы
 * выдумкой; `н не больше ∞` истинно для всех конечных, значит `иначе` берётся
 * только на NaN, и граница снова была бы выдумкой.
 */
function finiteLiteral(expr) {
  if (!expr || typeof expr !== "object" || expr.kind !== "literal") return null
  const value = expr.value
  if (typeof value !== "number") return null
  return value - value === 0 ? value : null
}

/**
 * Сдвиг меры арифметикой: `н минус 1`, `н плюс 1`, `1 плюс н`.
 *
 * `1 минус н` сюда не попадает намеренно: это не сдвиг `н`, а его отражение, и
 * повторное применение меру не уменьшает. Умножение и деление тоже не сдвиги:
 * `н делить на 2` при `н больше 0` не доходит до нуля никогда.
 */
function arithmeticShift(expr, left, right) {
  if (expr.op === "sub") {
    const value = finiteLiteral(expr.right)
    return value === null ? null : shifted(left, 0 - value)
  }
  if (expr.op === "add") {
    const value = finiteLiteral(expr.right)
    if (value !== null) return shifted(left, value)
    const first = finiteLiteral(expr.left)
    return first === null ? null : shifted(right, first)
  }
  return null
}

/**
 * Нижняя граница из условия `если`: `{ param, branch }` или `null`.
 *
 * Сравниваться обязаны ИМЯ и числовой литерал. Имя — потому что происхождение
 * условия здесь не вычисляется заново (обход условия уже прошёл, и второй
 * обход удвоил бы собранные вызовы); литерал — потому что `н больше м` границы
 * не даёт: м само меняется от вызова к вызову.
 *
 * Равенство и неравенство в список не входят: `н равно 0` не ограничивает н
 * ни с какой стороны (шапка файла, «Числовая мера»).
 */
function lowerBoundGuard(cond, env) {
  if (!cond || typeof cond !== "object" || cond.kind !== "binary") return null
  let name = null
  let branch = null
  if (cond.left?.kind === "var" && finiteLiteral(cond.right) !== null) {
    name = cond.left.name
    if (cond.op === "gt" || cond.op === "gte") branch = "then"
    else if (cond.op === "lt" || cond.op === "lte") branch = "else"
  } else if (cond.right?.kind === "var" && finiteLiteral(cond.left) !== null) {
    name = cond.right.name
    if (cond.op === "lt" || cond.op === "lte") branch = "then"
    else if (cond.op === "gt" || cond.op === "gte") branch = "else"
  }
  if (branch === null) return null
  const origin = env.get(name) ?? null
  /* Сравнивалась мера — значит ограничен параметр, из которого она выведена.
     Часть значения границы параметру не даёт: `голова список больше 0` — про
     голову, а не про список. */
  if (!origin || origin.step === null) return null
  return { param: origin.param, branch }
}

/**
 * Область видимости, в которой параметр помечен ограниченным снизу.
 *
 * Помечаются ВСЕ имена того же параметра: граница — свойство параметра в этой
 * точке программы, и `пусть м равно (н минус 1)`, написанное до `если`, знает
 * про `н больше 0` ровно столько же, сколько сам `н`.
 */
function boundedEnv(env, param) {
  const inner = new Map()
  for (const [name, origin] of env) {
    inner.set(name, origin && origin.param === param ? { ...origin, bounded: true } : origin)
  }
  return inner
}

/**
 * Видно ли в этой точке каждый параметр под своим именем.
 *
 * Спрашивается ради сторожа, а не ради доказательства. Сторож сравнивает
 * аргумент с параметром ПО ИМЕНИ (`шаг меньше н`), а имя параметра можно
 * перекрыть: `пусть н равно "…"` внутри тела законен, и после него `н` — уже
 * не тот `н`. Сравнение с чужим значением не доказывает ничего, поэтому
 * позиция, где имя перекрыто, мерой убывающей не считается — лучше отказать в
 * доказательстве, чем поставить сторожа, который смотрит не туда.
 */
function visibleParams(env, params) {
  return params.map((name, index) => {
    const origin = env.get(name)
    return origin !== undefined && origin !== null && origin.param === index
      && origin.depth === 0 && origin.step === 0
  })
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
      /* Условие даёт нижнюю границу ровно одной ветви — в другой известно
         только отрицание, а оно границы не даёт. */
      const guard = lowerBoundGuard(expr.cond, env)
      const thenEnv = guard?.branch === "then" ? boundedEnv(env, guard.param) : env
      const elseEnv = guard?.branch === "else" ? boundedEnv(env, guard.param) : env
      return join(collectCalls(expr.then, thenEnv, state), collectCalls(expr.else, elseEnv, state))
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
        visible: visibleParams(env, state.params),
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
      const visible = visibleParams(env, state.params)
      for (const to of applyTargets(expr, args.length, state)) {
        state.calls.push({
          from: state.from,
          to,
          node: expr,
          params: state.params,
          args,
          origins,
          visible,
          applied: true,
        })
      }
      return null
    }
    case "binary": {
      const left = collectCalls(expr.left, env, state)
      const right = collectCalls(expr.right, env, state)
      return arithmeticShift(expr, left, right)
    }
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
