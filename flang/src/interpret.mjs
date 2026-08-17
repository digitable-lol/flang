/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
// interpret.mjs — вычисление AST flang (SPEC.md, раздел 5).
//
// ── Почему явный стек, а не рекурсия по стеку JS ──────────────────────────
// Обычные (не тотальные) функции flang могут не завершаться, и единственная
// защита от этого — лимит шагов и глубины. Если бы вычислитель рекурсивно
// вызывал сам себя, то раньше нашего лимита сработал бы RangeError движка
// («Maximum call stack size exceeded»), причём непредсказуемо: глубина стека JS
// зависит от размера кадров, флагов запуска и платформы. Поймать его нельзя
// надёжно (движок может упасть уже внутри обработчика), а диагностика вышла бы
// не FLANG_RECURSION_LIMIT.
//
// Поэтому вычисление — цикл над явным стеком кадров (машина «кадр → значение»).
// Стек живёт в куче, глубина ограничена только лимитом и памятью, а счётчик
// шагов инкрементируется на каждой итерации цикла — то есть срабатывает и там,
// где рекурсия хвостовая и глубина не растёт вовсе.
//
// Хвостовые вызовы не увеличивают глубину: перед вызовом мы смотрим, стоит ли
// сразу за нами кадр возврата без постусловий, и переиспользуем его. Значит
// «пока не кончится список» пишется рекурсивно и работает в постоянной глубине.
//
// Рекурсия по JS остаётся только в двух местах, и обе — рекурсии по данным,
// а не по программе: сравнение значений (valuesEqual) и сопоставление образца
// со значением. Их глубина ограничена вложенностью самого значения.

import {
  callBuiltin,
  describeValue,
  длинаСписка,
  ячейкиСписка,
  элементСписка,
  элементыСписка,
  flangError,
  FlangError,
  FlangVariant,
  hasBuiltin,
  isList,
  isRecord,
  isScalar,
  isVariant,
  материализовать,
  percentOf,
  reifyValue,
  remainderOf,
  typeName,
  valuesEqual,
  variant,
} from "./builtins.mjs"
import { guardDescent } from "./defunc.mjs"
import { programTags } from "./tags.mjs"

export { FlangError, FlangVariant, flangError, variant, valuesEqual, reifyValue }

// Значения по умолчанию. Шагов — миллион: этого хватает на любую разумную
// программу (обход списка в 10⁴ элементов укладывается в сотни тысяч шагов),
// но зациклившаяся функция упирается в лимит за доли секунды. Глубина — 10⁴:
// заведомо ниже предела движка мы держаться не обязаны (стек в куче), но
// осмысленная нехвостовая рекурсия глубже 10⁴ почти всегда означает ошибку.
//
// Оба ВЫПУЩЕНЫ НАРУЖУ, и это не удобство импорта. Предел глубины был спрятан
// здесь, и ровно поэтому `failures.mjs` сводил оценку витков обработчика с одним
// только пределом ШАГОВ: он был единственным, который можно было назвать. Дыру
// предъявил прогон — обработчик с ПОСТОЯННОЙ оценкой в 260 036 витков анализ
// объявлял безотказным, а вычислитель ронял процесс `FLANG_RECURSION_LIMIT` на
// глубине 10 001. Число, которое нельзя назвать, свести не с чем; поэтому оба
// предела теперь имена, а не литералы (`flang/test/failures.test.mjs`).
export const DEFAULT_MAX_STEPS = 1_000_000
export const DEFAULT_MAX_DEPTH = 10_000

const DEFAULT_RESULT_BINDING = "результат"

/**
 * «Работа не кончилась, кончился отпущенный на неё квант витков».
 *
 * Заведено ради потолка задержки (`conc.mjs`, шаг В4 карты): планировщик обязан
 * уметь ОСТАНОВИТЬ пробег на середине и вернуться к нему позже, а не только
 * бросить его и переиграть заново (В2). Возможно это здесь и только здесь по
 * одной причине, названной в шапке файла: вычисление — цикл над ЯВНЫМ стеком
 * кадров, а не рекурсия по стеку JS. Значит «сохранить стек пробега» — это не
 * `swapcontext` за 278 нс и не 290 байт на виток глубины (замер В1), а просто
 * НЕ ВЫБРАСЫВАТЬ объект машины, который и так уже существует.
 *
 * Символ, а не `null` и не особая запись: значением flang символ быть не может
 * ни при каком вычислении, поэтому спутать «пробег снят» с «пробег вернул
 * значение» нельзя даже случайно.
 */
const СНЯТО = Symbol("flang.снято по кванту")

// ───────────────────────────── публичный интерфейс ─────────────────────────────

export function createRuntime(program, options = {}) {
  const checked = prepareProgram(program)
  const limits = {
    maxSteps: positiveLimit(options.maxSteps, DEFAULT_MAX_STEPS, "maxSteps"),
    maxDepth: positiveLimit(options.maxDepth, DEFAULT_MAX_DEPTH, "maxDepth"),
  }
  const builtinOptions = { indexBase: options.indexBase === 0 ? 0 : 1 }
  const runtime = { ...checked, limits, builtinOptions }

  const сПределами = (callOptions) =>
    callOptions
      ? {
        ...runtime,
        limits: {
          maxSteps: positiveLimit(callOptions.maxSteps, limits.maxSteps, "maxSteps"),
          maxDepth: positiveLimit(callOptions.maxDepth, limits.maxDepth, "maxDepth"),
        },
      }
      : runtime

  return {
    call(name, args, callOptions) {
      return callFunction(сПределами(callOptions), name, args, callOptions?.отчёт)
    },
    /**
     * Завести вызов, НЕ выполняя его: возвращается машина, которую дальше
     * крутит `доиграть`.
     *
     * Ради потолка задержки (`conc.mjs`, шаг В4 карты). Всё, что делается здесь
     * и не делается в `доиграть`, делается ровно один раз на вызов: связывание
     * аргументов и предусловия на границе программы. Витков это не стоит —
     * `applyFunction` только кладёт кадры на стек, — поэтому первый квант
     * достаётся телу целиком.
     *
     * Машина держит `rt` СВОЙ, тот, что был на момент завода. Это не деталь
     * реализации: горячая замена (Е1) меняет программу между пробегами, а
     * начатый пробег обязан доиграть тем видом кода, которым начат.
     */
    начать(name, args, callOptions) {
      const local = сПределами(callOptions)
      const fn = local.functions.get(name)
      if (!fn) throw flangError("FLANG_UNKNOWN_NAME", `не найдена функция «${name}»`)
      const values = bindArguments(fn, args)
      checkPreconditions(local, fn, values)
      const machine = { work: [], value: null, steps: 0, depth: 0, current: fn.name, rt: local, потолок: 0 }
      applyFunction(machine, fn, values, fn.span)
      return machine
    },
    /**
     * Крутить заведённую машину не дольше `витков`.
     *
     * `{ готово: true, значение }` — вызов кончился; `{ готово: false }` — квант
     * кончился раньше, и ту же машину можно подать сюда снова. Отказ уходит
     * исключением, ровно как из `call`: у пробега, который упал, и у пробега,
     * который снят, разные исходы, и путать их нельзя.
     *
     * `отчёт.витки` — витки ЭТОЙ дольки, а не всего вызова: планировщик считает
     * задержку по пробегу, и накопленная сумма ответила бы не на тот вопрос.
     * `отчёт.всего` — накопленное, оно нужно для сведения с запасом.
     */
    доиграть(machine, callOptions) {
      const витков = callOptions?.витков ?? 0
      const было = machine.steps
      machine.потолок = витков > 0 ? machine.steps + витков : 0
      const отчёт = callOptions?.отчёт
      try {
        const итог = run(machine)
        if (итог === СНЯТО) return { готово: false }
        return { готово: true, значение: материализовать(итог) }
      } finally {
        if (отчёт !== undefined && отчёт !== null) {
          отчёт.витки = machine.steps - было
          отчёт.всего = machine.steps
          /* Цена потолка задержки, названная СЧЁТОМ, а не измерением: сколько
             кадров стека пробег держит между дольками. Ноль — пробег кончился и
             не держит ничего. Это ровно та величина, которой у переигрывания
             (В2) нет и не бывает, и ровно её замер В1 назвал в C «около 290
             байт на виток глубины». Считать её надо здесь: снаружи стек машины
             не виден, а прикидывать цену по памяти процесса значило бы мерить
             сборщик мусора JS. */
          отчёт.кадров = machine.work.length
        }
      }
    },
    listFunctions() {
      return [...checked.functions.values()].map((fn) => ({
        name: fn.name,
        total: fn.total === true,
        params: fn.params.map((param) => param.name),
        returns: fn.returns ?? null,
      }))
    },
  }
}

export function evaluate(program, functionName, args, options = {}) {
  return createRuntime(program, options).call(functionName, args)
}

// ───────────────────────────── подготовка программы ─────────────────────────────

function prepareProgram(источник) {
  if (источник === null || typeof источник !== "object" || Array.isArray(источник)) {
    throw flangError("FLANG_PARSE", "программа должна быть объектом AST flang")
  }
  /* Сторожа меры ставит то же понижение, что зовут все восемь бэкендов
     (`defunc.mjs`). Здесь оно позвано ради одного: вычислитель обязан
     отказывать теми же кодом и текстом, что напечатанный код, — а
     единственный способ добиться этого наверняка — считать одну и ту же
     программу, а не две похожие. Программа без отметок меры проходит насквозь
     тем же объектом. */
  const program = guardDescent(источник)
  const functionList = program.functions ?? []
  if (!Array.isArray(functionList)) {
    throw flangError("FLANG_PARSE", "поле «functions» программы должно быть списком")
  }

  const functions = new Map()
  for (const fn of functionList) {
    if (fn === null || typeof fn !== "object" || typeof fn.name !== "string") {
      throw flangError("FLANG_PARSE", "функция должна быть объектом с полем «name»")
    }
    if (functions.has(fn.name)) {
      throw flangError("FLANG_PARSE", `функция «${fn.name}» объявлена дважды`, fn.span)
    }
    if (fn.body === undefined || fn.body === null) {
      throw flangError("FLANG_PARSE", `у функции «${fn.name}» нет тела`, fn.span)
    }
    functions.set(fn.name, {
      name: fn.name,
      total: fn.total === true,
      params: normalizeParams(fn),
      returns: fn.returns,
      body: fn.body,
      // Постусловия — расширение поверх раздела 5: compat.mjs обязан отобразить
      // «свойства» утилиты FTS в постусловия функции (SPEC, раздел 9), иначе
      // нарушение свойства невозможно выразить. Если поля нет — список пуст.
      postconditions: normalizePostconditions(fn),
      // Предусловия здесь ТОЛЬКО ради границы программы (`callFunction` ниже).
      // Внутри программы их снимает вызывающий на проверке, и проверять их во
      // время работы значило бы проверять доказанное — поэтому ни `applyFunction`,
      // ни один из восьми бэкендов их не печатает. Снаружи доказывать нечего:
      // значение пришло из JSON, и единственное, что о нём известно, — это то,
      // что оно посчитается прямо сейчас.
      preconditions: normalizePreconditions(fn),
      span: fn.span,
    })
  }

  const records = new Map()
  const variants = new Map()
  for (const type of program.types ?? []) {
    if (type === null || typeof type !== "object") continue
    if (type.kind === "record") records.set(type.name, type)
    if (type.kind === "sum") {
      for (const item of type.variants ?? []) variants.set(item.name, { sum: type.name, ...item })
    }
  }

  /* Теги, которые программа умеет строить (flang/src/tags.mjs). Считается
     лениво: спрашивает о них только применение, а программ без функций-значений
     подавляющее большинство. */
  let tags = null
  const knownTags = () => (tags ??= programTags(program, (name) => functions.has(name)))

  return { functions, records, variants, knownTags }
}

function normalizeParams(fn) {
  const params = fn.params ?? []
  if (!Array.isArray(params)) {
    throw flangError("FLANG_PARSE", `поле «params» функции «${fn.name}» должно быть списком`, fn.span)
  }
  return params.map((param) => {
    if (typeof param === "string") return { name: param }
    if (param === null || typeof param !== "object" || typeof param.name !== "string") {
      throw flangError("FLANG_PARSE", `параметр функции «${fn.name}» должен иметь имя`, fn.span)
    }
    return param
  })
}

function normalizePostconditions(fn) {
  const list = fn.postconditions ?? []
  if (!Array.isArray(list)) {
    throw flangError("FLANG_PARSE", `поле «postconditions» функции «${fn.name}» должно быть списком`, fn.span)
  }
  return list.map((item) => {
    if (item === null || typeof item !== "object" || item.expr === undefined) {
      throw flangError("FLANG_PARSE", `постусловие функции «${fn.name}» должно содержать «expr»`, fn.span)
    }
    return {
      name: item.name ?? "",
      expr: item.expr,
      bind: typeof item.bind === "string" ? item.bind : DEFAULT_RESULT_BINDING,
      code: typeof item.code === "string" ? item.code : "FLANG_PROPERTY",
      message: typeof item.message === "string" ? item.message : null,
      span: item.span,
    }
  })
}

function normalizePreconditions(fn) {
  const list = fn.preconditions ?? []
  if (!Array.isArray(list)) {
    throw flangError("FLANG_PARSE", `поле «preconditions» функции «${fn.name}» должно быть списком`, fn.span)
  }
  return list.map((item) => {
    if (item === null || typeof item !== "object" || item.expr === undefined) {
      throw flangError("FLANG_PARSE", `предусловие функции «${fn.name}» должно содержать «expr»`, fn.span)
    }
    return {
      name: item.name ?? "",
      expr: item.expr,
      /* `bind` у предусловия нет и быть не может: оно говорит о том, что было
         ДО вызова, а результата до вызова не существует. Это единственное
         поле, которым запись предусловия отличается от записи постусловия, и
         отличие содержательное. */
      code: typeof item.code === "string" ? item.code : "FLANG_PRECONDITION",
      message: typeof item.message === "string" ? item.message : null,
      span: item.span,
    }
  })
}

function positiveLimit(value, fallback, label) {
  if (value === undefined || value === null) return fallback
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw flangError("FLANG_BUILTIN_ARGS", `значение «${label}» должно быть положительным числом`)
  }
  return Math.floor(value)
}

// ───────────────────────────── вход в вычисление ─────────────────────────────

/**
 * Вызов функции.
 *
 * `отчёт` — необязательный объект, в который кладётся число сделанных витков.
 * Заведён ради вытеснения (`conc.mjs`, шаг В2 карты): планировщику надо знать не
 * только «упёрлось в предел», но и сколько именно витков пробег успел, — иначе
 * задержку, ради которой вытеснение и делается, нечем измерить. Пишется в
 * `finally`, а не после `run`: витки, потраченные пробегом, который упал, — это
 * ровно те витки, которые интересны больше всего.
 */
function callFunction(rt, name, args, отчёт) {
  const fn = rt.functions.get(name)
  if (!fn) throw flangError("FLANG_UNKNOWN_NAME", `не найдена функция «${name}»`)
  const values = bindArguments(fn, args)
  checkPreconditions(rt, fn, values)

  const machine = {
    work: [],
    value: null,
    steps: 0,
    depth: 0,
    current: fn.name,
    rt,
  }
  try {
    applyFunction(machine, fn, values, fn.span)
    /* Граница машины: наружу уходят обычные массивы, а не списки с запасом
       (`builtins.mjs`, «Список с запасом»). Вид — приём вычислителя, и знать о
       нём читателям значений не положено: сверка с восемью целями печати,
       `flang run`, факт-чекинг и тесты сравнивают ЗНАЧЕНИЯ. */
    return материализовать(run(machine))
  } finally {
    if (отчёт !== undefined && отчёт !== null) отчёт.витки = machine.steps
  }
}

function bindArguments(fn, args) {
  if (args === undefined || args === null) return bindArguments(fn, [])
  if (Array.isArray(args)) {
    if (args.length !== fn.params.length) {
      throw flangError(
        "FLANG_TYPE",
        `функция «${fn.name}» принимает ${fn.params.length} аргум., получено ${args.length}`,
        fn.span,
      )
    }
    return args.map(normalizeInput)
  }
  if (typeof args !== "object") {
    throw flangError("FLANG_TYPE", `аргументы функции «${fn.name}» должны быть списком или записью`, fn.span)
  }
  return fn.params.map((param) => {
    if (!Object.hasOwn(args, param.name)) {
      throw flangError("FLANG_UNKNOWN_NAME", `не задан аргумент «${param.name}» функции «${fn.name}»`, fn.span)
    }
    return normalizeInput(args[param.name])
  })
}

/**
 * Предусловия на ГРАНИЦЕ ПРОГРАММЫ — единственное место, где они считаются.
 *
 * ── Почему здесь и только здесь ─────────────────────────────────────────────
 * Предусловие снимает вызывающий: у каждого вызова ВНУТРИ программы оно уже
 * доказано на проверке (`proofterm.mjs`, `снятьПредусловия`), и считать его во
 * время работы значило бы считать доказанное — поэтому `applyFunction` о
 * предусловиях не знает ничего, и ни один из восьми бэкендов их не печатает.
 * Ровно в этом и состоит цена нововведения: ноль строк в рантайме.
 *
 * Но `callFunction` — не вызов внутри программы. Это ГРАНИЦА: сюда приходит
 * `--args` из командной строки, значения примеров из `flang test` и всё, что
 * связывает программу с внешним миром. Доказывать здесь нечего: значение
 * пришло из JSON, вызывающего у него нет, и единственное, что о нём известно, —
 * что оно посчитается прямо сейчас. Поэтому здесь стоит проверка, а отказ
 * называет требование по имени.
 *
 * Граница ровно одна — та же, о которой говорит `normalizeInput` ниже, — и
 * поэтому проверка ровно одна. Внутренние вызовы идут через `applyFunction` и
 * сюда не заходят: это видно по тому, что `callFunction` зовут только
 * `createRuntime().call` и ничего больше.
 *
 * ПОЧЕМУ СВОЯ МАШИНА, А НЕ КАДР. Кадр `pre` пришлось бы вплести в возврат и в
 * хвостовую оптимизацию — то есть в те самые места, которые предусловие
 * обязано было оставить нетронутыми. Здесь же считается замкнутое выражение при
 * известном окружении, до того как тело начало работать: своя машина на это и
 * заводится, и живёт она ровно один прогон.
 */
function checkPreconditions(rt, fn, values) {
  const list = fn.preconditions ?? []
  if (list.length === 0) return
  const env = Object.create(null)
  fn.params.forEach((param, index) => {
    env[param.name] = values[index]
  })
  for (const property of list) {
    const machine = { work: [], value: null, steps: 0, depth: 0, current: fn.name, rt }
    pushEval(machine, property.expr, env, property.span)
    const holds = run(machine)
    if (typeof holds !== "boolean") {
      throw flangError(
        "FLANG_TYPE",
        `предусловие «${property.name}» функции «${fn.name}» должно давать признак, получено ${typeName(holds)}`,
        property.span,
      )
    }
    if (!holds) {
      const message = property.message ?? `не выполнено требование «${property.name}» функции «${fn.name}»`
      throw flangError(property.code, message, property.span)
    }
  }
}

// Граница между JSON и машиной, и она ровно одна: сюда приходят аргументы
// вызова, значения примеров и литералы из AST.
//
// Две поправки. Первая: undefined в flang нет, «ничто» — это null; иначе «имя
// не связано» перестало бы отличаться от «связано с undefined». Вторая:
// вариант в JSON записан как { variant, fields } (классов JSON не знает), и
// внутрь машины он обязан войти уже FlangVariant — иначе `разбор` не
// сопоставит его ни с одним образцом, а сообщит «разбор не покрывает значение
// запись {…}». Именно из-за этого функции, принимающие или возвращающие сумму
// типов, до сих пор оставались без примеров.
function normalizeInput(value) {
  return reifyValue(value)
}

// ───────────────────────────── машина ─────────────────────────────

function run(machine) {
  const { maxSteps } = machine.rt.limits
  /* Потолок этой ДОЛЬКИ: абсолютный номер витка, дальше которого крутить не
     велено. Ноль — потолка нет, и тогда цикл ниже байт в байт тот же, каким был
     всегда: у машины, заведённой `callFunction` или `checkPreconditions`, поля
     `потолок` нет вовсе, значит и ветви этой нет. */
  const потолок = machine.потолок ?? 0
  while (machine.work.length > 0) {
    if (потолок > 0 && machine.steps >= потолок) return СНЯТО
    machine.steps += 1
    if (machine.steps > maxSteps) {
      throw flangError(
        "FLANG_RECURSION_LIMIT",
        `функция «${machine.current}» исчерпала лимит шагов (${maxSteps}) на глубине вызовов ${machine.depth}`,
      )
    }
    step(machine, machine.work.pop())
  }
  return machine.value
}

function push(machine, frame) {
  machine.work.push(frame)
}

function pushEval(machine, expr, env, span) {
  if (expr === undefined || expr === null || typeof expr !== "object" || Array.isArray(expr)) {
    throw flangError("FLANG_PARSE", `ожидалось выражение, получено ${JSON.stringify(expr) ?? "undefined"}`, span)
  }
  machine.work.push({ op: "eval", expr, env })
}

// Имя связывания обязано быть строкой: иначе в окружении появился бы ключ
// «undefined», и промах по имени выглядел бы как успешное связывание.
// Окружения строятся от Object.create(null), поэтому имя «__proto__» здесь
// безопасно — акцессора Object.prototype в цепочке нет.
function requireName(name, kind, field, span) {
  if (typeof name !== "string" || name.length === 0) {
    throw flangError("FLANG_PARSE", `узел «${kind}» требует непустое имя в поле «${field}»`, span)
  }
}

function step(machine, frame) {
  switch (frame.op) {
    case "eval":
      return evalExpr(machine, frame.expr, frame.env)
    case "seq":
      return stepSeq(machine, frame)
    case "field":
      return stepField(machine, frame)
    case "let":
      return stepLet(machine, frame)
    case "if":
      return stepIf(machine, frame)
    case "match":
      return stepMatch(machine, frame)
    case "foldOver":
      return stepFoldOver(machine, frame)
    case "foldInit":
      return stepFoldInit(machine, frame)
    case "foldStep":
      return stepFold(machine, frame)
    case "loopOver":
      return stepLoopOver(machine, frame)
    case "loopStep":
      return stepLoop(machine, frame)
    case "return":
      return stepReturn(machine, frame)
    case "post":
      return stepPost(machine, frame)
    default:
      throw flangError("FLANG_PARSE", `неизвестный кадр вычислителя «${frame.op}»`)
  }
}

function evalExpr(machine, expr, env) {
  switch (expr.kind) {
    case "literal": {
      machine.value = normalizeInput(expr.value)
      return
    }
    case "var": {
      if (!(expr.name in env)) {
        throw flangError("FLANG_UNKNOWN_NAME", `имя «${expr.name}» не связано`, expr.span)
      }
      machine.value = env[expr.name]
      return
    }
    case "field": {
      push(machine, { op: "field", field: expr.field, span: expr.span })
      pushEval(machine, expr.target, env, expr.span)
      return
    }
    case "let": {
      requireName(expr.name, "let", "name", expr.span)
      push(machine, { op: "let", name: expr.name, body: expr.in ?? expr.body, env, span: expr.span })
      pushEval(machine, expr.value, env, expr.span)
      return
    }
    case "if": {
      push(machine, { op: "if", then: expr.then, otherwise: expr.else, env, span: expr.span })
      pushEval(machine, expr.cond, env, expr.span)
      return
    }
    case "call": {
      startSeq(machine, expr.args ?? [], env, { kind: "call", name: expr.name, span: expr.span }, expr.span)
      return
    }
    /*
     * Функции первого класса — дефункционализация (flang/cat/HOF.md).
     *
     * Значение-функция это ТЕГ, и представлен он вариантом без полей: захватывать
     * в первой фазе нечего (замыканий в языке нет), а отдельный вид значения
     * пришлось бы научить сериализации, сравнению и печати — при том что тег и
     * есть вариант по смыслу, а не по совпадению. Ровно этим он станет в
     * напечатанном C: структура с тегом и `switch` в `применить`.
     */
    case "fnref": {
      requireName(expr.name, "fnref", "name", expr.span)
      machine.value = variant(expr.name, {})
      return
    }
    case "apply": {
      /* Применяемое считается первым, аргументы за ним — тот же строгий порядок
         слева направо, что у вызова по имени. */
      const args = expr.args ?? []
      /* Проверка стоит ДО развёртки, и это не перестраховка. `startSeq` ловит
         не-список у всех прочих видов узла, а здесь развёртка `...` случилась бы
         раньше него — и на `args: 5` наружу уходил бы `TypeError: 5 is not
         iterable`, то есть отказ ЧУЖОГО движка вместо диагностики flang. На
         правильной программе это не видно вовсе (`args` там всегда список), и
         нашлось чтением рядом с копией на flang: копия обязана отвечать тем же
         кодом, а кода у падения движка нет. */
      if (!Array.isArray(args)) {
        throw flangError("FLANG_PARSE", "аргументы выражения должны быть списком", expr.span)
      }
      startSeq(machine, [expr.fn, ...args], env, { kind: "apply", span: expr.span }, expr.span)
      return
    }
    case "builtin": {
      if (!hasBuiltin(expr.name)) {
        throw flangError("FLANG_UNKNOWN_NAME", `неизвестная встроенная форма «${expr.name}»`, expr.span)
      }
      startSeq(machine, expr.args ?? [], env, { kind: "builtin", name: expr.name, span: expr.span }, expr.span)
      return
    }
    case "binary": {
      startSeq(machine, [expr.left, expr.right], env, { kind: "binary", op: expr.op, span: expr.span }, expr.span)
      return
    }
    case "list": {
      startSeq(machine, expr.items ?? [], env, { kind: "list", span: expr.span }, expr.span)
      return
    }
    case "record": {
      const fields = expr.fields ?? {}
      const keys = Object.keys(fields)
      checkRecordType(machine, expr)
      startSeq(machine, keys.map((key) => fields[key]), env, { kind: "record", keys, span: expr.span }, expr.span)
      return
    }
    case "construct": {
      const fields = expr.fields ?? {}
      const keys = Object.keys(fields)
      checkVariantName(machine, expr)
      startSeq(machine, keys.map((key) => fields[key]), env, { kind: "construct", name: expr.variant, keys, span: expr.span }, expr.span)
      return
    }
    case "match": {
      push(machine, { op: "match", cases: expr.cases ?? [], env, span: expr.span })
      pushEval(machine, expr.target, env, expr.span)
      return
    }
    case "fold": {
      requireName(expr.acc, "fold", "acc", expr.span)
      requireName(expr.item, "fold", "item", expr.span)
      push(machine, { op: "foldOver", node: expr, env })
      pushEval(machine, expr.over, env, expr.span)
      return
    }
    case "map":
    case "filter": {
      requireName(expr.item, expr.kind, "item", expr.span)
      push(machine, { op: "loopOver", node: expr, env, mode: expr.kind })
      pushEval(machine, expr.over, env, expr.span)
      return
    }
    default:
      throw flangError("FLANG_PARSE", `неизвестный вид выражения «${expr.kind}»`, expr.span)
  }
}

// ── последовательное (строгое, слева направо) вычисление списка выражений ──

function startSeq(machine, exprs, env, done, span) {
  if (!Array.isArray(exprs)) {
    throw flangError("FLANG_PARSE", "аргументы выражения должны быть списком", span)
  }
  stepSeq(machine, { op: "seq", exprs, env, index: 0, acc: [], done })
}

function stepSeq(machine, frame) {
  if (frame.index > 0) frame.acc.push(machine.value)
  if (frame.index < frame.exprs.length) {
    const next = frame.exprs[frame.index]
    frame.index += 1
    push(machine, frame)
    pushEval(machine, next, frame.env, frame.done.span)
    return
  }
  finishSeq(machine, frame.done, frame.acc)
}

function finishSeq(machine, done, values) {
  switch (done.kind) {
    case "list": {
      machine.value = values
      return
    }
    case "record": {
      const record = {}
      done.keys.forEach((key, index) => {
        record[key] = values[index]
      })
      machine.value = record
      return
    }
    case "construct": {
      const fields = {}
      done.keys.forEach((key, index) => {
        fields[key] = values[index]
      })
      machine.value = variant(done.name, fields)
      return
    }
    case "binary": {
      machine.value = applyBinary(done.op, values[0], values[1], done.span)
      return
    }
    case "builtin": {
      machine.value = callBuiltin(done.name, values, done.span, machine.rt.builtinOptions)
      return
    }
    case "call": {
      const fn = machine.rt.functions.get(done.name)
      if (!fn) throw flangError("FLANG_UNKNOWN_NAME", `не найдена функция «${done.name}»`, done.span)
      if (values.length !== fn.params.length) {
        throw flangError(
          "FLANG_TYPE",
          `функция «${fn.name}» принимает ${fn.params.length} аргум., передано ${values.length}`,
          done.span,
        )
      }
      applyFunction(machine, fn, values, done.span)
      return
    }
    /* Диспетчер `применить(тег, аргументы)`. Тут он один на всю программу и
       разбирает тег таблицей функций — в напечатанном C на его месте будет
       `switch` по тем тегам, которые программа строит. */
    case "apply": {
      const [tag, ...args] = values
      if (!isVariant(tag)) {
        throw flangError("FLANG_APPLY", `применять можно только функцию, а получено ${describeValue(tag)}`, done.span)
      }
      const fn = machine.rt.functions.get(tag.variant)
      if (!fn) throw flangError("FLANG_UNKNOWN_NAME", `не найдена функция «${tag.variant}»`, done.span)
      /* Тег, которого программа не строит, применить нельзя — обоснование в
         `tags.mjs`. Это не придирка: снаружи можно подать тег обычной функции
         или комбинатор Ω, и доказанная тотальность стала бы неправдой. */
      if (!machine.rt.knownTags().has(tag.variant)) {
        throw flangError(
          "FLANG_APPLY",
          `применить «${tag.variant}» нельзя: ни одно место программы не берёт эту функцию значением ` +
            `(формой «функция «${tag.variant}»»), значит у диспетчера нет такого случая`,
          done.span,
        )
      }
      if (args.length !== fn.params.length) {
        throw flangError(
          "FLANG_APPLY",
          `функция «${fn.name}» принимает ${fn.params.length} аргум., применена к ${args.length}`,
          done.span,
        )
      }
      applyFunction(machine, fn, args, done.span)
      return
    }
    default:
      throw flangError("FLANG_PARSE", `неизвестное завершение «${done.kind}»`)
  }
}

// ── вызов функции и возврат ──

function applyFunction(machine, fn, values, span) {
  const env = Object.create(null)
  fn.params.forEach((param, index) => {
    env[param.name] = values[index]
  })

  // Хвостовой вызов: если следующий кадр — возврат без постусловий, то после
  // нашего результата в вызывающей функции делать уже нечего. Забираем её кадр
  // себе, и глубина не растёт. Кадр с постусловиями трогать нельзя: они обязаны
  // проверить именно свой результат.
  const top = machine.work[machine.work.length - 1]
  let previous = machine.current
  let restoreDepth = machine.depth
  if (top !== undefined && top.op === "return" && top.post.length === 0) {
    machine.work.pop()
    previous = top.previous
    restoreDepth = top.restoreDepth
  } else {
    machine.depth += 1
    if (machine.depth > machine.rt.limits.maxDepth) {
      throw flangError(
        "FLANG_RECURSION_LIMIT",
        `функция «${fn.name}» превысила предел глубины вызовов (${machine.rt.limits.maxDepth}) на глубине ${machine.depth}`,
        span,
      )
    }
  }

  machine.current = fn.name
  push(machine, {
    op: "return",
    name: fn.name,
    previous,
    restoreDepth,
    post: fn.postconditions,
    env,
  })
  pushEval(machine, fn.body, env, span)
}

function stepReturn(machine, frame) {
  machine.depth = frame.restoreDepth
  machine.current = frame.previous
  if (frame.post.length === 0) return
  // Постусловия проверяем после тела: результат уже в machine.value.
  push(machine, {
    op: "post",
    name: frame.name,
    env: frame.env,
    post: frame.post,
    index: 0,
    started: false,
    result: machine.value,
  })
}

function stepPost(machine, frame) {
  if (frame.started) {
    const holds = machine.value
    const property = frame.post[frame.index]
    if (typeof holds !== "boolean") {
      throw flangError(
        "FLANG_TYPE",
        `постусловие «${property.name}» функции «${frame.name}» должно давать признак, получено ${typeName(holds)}`,
        property.span,
      )
    }
    if (!holds) {
      const message = property.message
        ?? `нарушено свойство «${property.name}» функции «${frame.name}»`
      throw flangError(property.code, message, property.span)
    }
    frame.index += 1
  }
  frame.started = true

  if (frame.index >= frame.post.length) {
    machine.value = frame.result
    return
  }
  const property = frame.post[frame.index]
  const env = Object.create(frame.env)
  env[property.bind] = frame.result
  push(machine, frame)
  pushEval(machine, property.expr, env, property.span)
}

// ── простые кадры ──

function stepField(machine, frame) {
  const target = machine.value
  if (isVariant(target)) {
    throw flangError(
      "FLANG_TYPE",
      `поле «${frame.field}» нельзя взять у варианта «${target.variant}» — нужен разбор`,
      frame.span,
    )
  }
  if (!isRecord(target)) {
    throw flangError("FLANG_TYPE", `поле «${frame.field}» можно взять только у записи, получено ${typeName(target)}`, frame.span)
  }
  if (!Object.hasOwn(target, frame.field)) {
    throw flangError("FLANG_UNKNOWN_NAME", `запись не содержит поле «${frame.field}»`, frame.span)
  }
  machine.value = target[frame.field]
}

function stepLet(machine, frame) {
  const env = Object.create(frame.env)
  env[frame.name] = machine.value
  pushEval(machine, frame.body, env, frame.span)
}

function stepIf(machine, frame) {
  const condition = machine.value
  if (typeof condition !== "boolean") {
    throw flangError("FLANG_TYPE", `условие «если» должно быть признаком, получено ${typeName(condition)}`, frame.span)
  }
  // Строгость с оговоркой: вычисляется ровно одна ветвь.
  pushEval(machine, condition ? frame.then : frame.otherwise, frame.env, frame.span)
}

function stepMatch(machine, frame) {
  const target = machine.value
  for (const branch of frame.cases) {
    if (branch === null || typeof branch !== "object" || branch.pattern === undefined) {
      throw flangError("FLANG_PARSE", "случай разбора должен содержать «pattern» и «body»", frame.span)
    }
    const bindings = matchPattern(branch.pattern, target, frame.span)
    if (bindings === null) continue
    const env = Object.create(frame.env)
    for (const [name, value] of bindings) env[name] = value
    pushEval(machine, branch.body, env, frame.span)
    return
  }
  throw flangError(
    "FLANG_MATCH_NOT_EXHAUSTIVE",
    `разбор не покрывает значение ${describeValue(target)}`,
    frame.span,
  )
}

// Возвращает список привязок или null. Рекурсии здесь нет: образцы flang
// (раздел 5) не вложены — вариант связывает поля именами, а не образцами.
function matchPattern(pattern, value, span) {
  switch (pattern.kind) {
    /* Строка разбирается теми же двумя образцами, что и список: пустая либо
       «первый символ и остаток». По кодовым точкам, а не по единицам UTF-16, —
       как «длина», «символ» и «символы» в builtins.mjs: иначе эмодзи
       разваливалось бы пополам, и разбор строки расходился бы с её длиной. */
    case "empty":
      if (typeof value === "string") return value.length === 0 ? [] : null
      return isList(value) && длинаСписка(value) === 0 ? [] : null
    case "cons": {
      if (typeof value === "string") {
        const points = Array.from(value)
        if (points.length === 0) return null
        const bindings = []
        if (pattern.head !== undefined && pattern.head !== null) bindings.push([pattern.head, points[0]])
        if (pattern.tail !== undefined && pattern.tail !== null) bindings.push([pattern.tail, points.slice(1).join("")])
        return bindings
      }
      if (!isList(value) || длинаСписка(value) === 0) return null
      const bindings = []
      if (pattern.head !== undefined && pattern.head !== null) bindings.push([pattern.head, элементСписка(value, 0)])
      if (pattern.tail !== undefined && pattern.tail !== null) bindings.push([pattern.tail, элементыСписка(value, 1)])
      return bindings
    }
    case "variant": {
      if (!isVariant(value) || value.variant !== pattern.name) return null
      const bind = pattern.bind ?? {}
      const bindings = []
      const entries = Array.isArray(bind) ? bind.map((field) => [field, field]) : Object.entries(bind)
      for (const [field, name] of entries) {
        if (!Object.hasOwn(value.fields, field)) {
          throw flangError(
            "FLANG_UNKNOWN_NAME",
            `вариант «${value.variant}» не содержит поле «${field}»`,
            span,
          )
        }
        bindings.push([name, value.fields[field]])
      }
      return bindings
    }
    case "literal":
      return valuesEqual(value, normalizeInput(pattern.value)) ? [] : null
    case "any":
      return typeof pattern.bind === "string" ? [[pattern.bind, value]] : []
    default:
      throw flangError("FLANG_PARSE", `неизвестный вид образца «${pattern.kind}»`, span)
  }
}

// ── свёртка ──

/*
 * Границы обхода снимаются ОДИН РАЗ, на входе, и дальше не пересматриваются.
 *
 * Это не оптимизация ради оптимизации, а обязательное свойство: тело свёртки,
 * «отобразить» и «отфильтровать» вправе позвать «добавить» — в том числе к тому
 * самому списку, по которому идёт обход. Продление занимает ячейки ЗА концом
 * вида (`builtins.mjs`, «Список с запасом»), и обход обязан их не увидеть,
 * иначе свёртка по списку из трёх элементов не кончилась бы никогда.
 *
 * Снимок — это пара «ячейки и длина», а не копия: у вида ячейки общего массива,
 * у обычного списка он сам. Копировать нечего — ячейки до конца вида не
 * переписывает никто.
 */
function снимокОбхода(list) {
  return { ячейки: ячейкиСписка(list), длина: длинаСписка(list) }
}

function stepFoldOver(machine, frame) {
  const list = requireList(machine.value, "свёртка", frame.node.span)
  push(machine, { op: "foldInit", node: frame.node, env: frame.env, обход: снимокОбхода(list) })
  pushEval(machine, frame.node.init, frame.env, frame.node.span)
}

function stepFoldInit(machine, frame) {
  push(machine, {
    op: "foldStep",
    node: frame.node,
    env: frame.env,
    обход: frame.обход,
    index: 0,
    acc: machine.value,
    started: false,
  })
}

function stepFold(machine, frame) {
  if (frame.started) {
    frame.acc = machine.value
    frame.index += 1
  }
  frame.started = true
  if (frame.index >= frame.обход.длина) {
    machine.value = frame.acc
    return
  }
  const env = Object.create(frame.env)
  env[frame.node.acc] = frame.acc
  env[frame.node.item] = frame.обход.ячейки[frame.index]
  push(machine, frame)
  pushEval(machine, frame.node.body, env, frame.node.span)
}

// ── отобразить / отфильтровать ──

function stepLoopOver(machine, frame) {
  const label = frame.mode === "map" ? "отобразить" : "отфильтровать"
  const list = requireList(machine.value, label, frame.node.span)
  push(machine, {
    op: "loopStep",
    node: frame.node,
    env: frame.env,
    mode: frame.mode,
    обход: снимокОбхода(list),
    index: 0,
    out: [],
    started: false,
  })
}

function stepLoop(machine, frame) {
  if (frame.started) {
    if (frame.mode === "map") {
      frame.out.push(machine.value)
    } else {
      const keep = machine.value
      if (typeof keep !== "boolean") {
        throw flangError(
          "FLANG_TYPE",
          `условие «отфильтровать» должно быть признаком, получено ${typeName(keep)}`,
          frame.node.span,
        )
      }
      // Тело фильтра — предикат; для отброшенных элементов ничего больше не
      // вычисляется (никакого «а вдруг пригодится»).
      if (keep) frame.out.push(frame.обход.ячейки[frame.index])
    }
    frame.index += 1
  }
  frame.started = true
  if (frame.index >= frame.обход.длина) {
    machine.value = frame.out
    return
  }
  const env = Object.create(frame.env)
  env[frame.node.item] = frame.обход.ячейки[frame.index]
  push(machine, frame)
  pushEval(machine, frame.node.body, env, frame.node.span)
}

function requireList(value, label, span) {
  if (!isList(value)) {
    throw flangError("FLANG_TYPE", `«${label}» работает только со списком, получено ${typeName(value)}`, span)
  }
  return value
}

// ───────────────────────────── операции ─────────────────────────────

function applyBinary(op, left, right, span) {
  switch (op) {
    case "add":
      return arithmetic(op, left, right, span, (a, b) => a + b)
    case "sub":
      return arithmetic(op, left, right, span, (a, b) => a - b)
    case "mul":
      return arithmetic(op, left, right, span, (a, b) => a * b)
    case "div":
      // Деление на ноль даёт Infinity — это значение IEEE-754, и печать в JS
      // обязана давать то же самое.
      return arithmetic(op, left, right, span, (a, b) => a / b)
    case "mod":
      return arithmetic(op, left, right, span, remainderOf)
    case "percent":
      // Порядок операций ядра: (percent / 100) * value.
      return arithmetic(op, left, right, span, percentOf)
    case "eq":
      return valuesEqual(left, right)
    case "neq":
      return !valuesEqual(left, right)
    case "gt":
      return order(op, left, right, span, (a, b) => a > b)
    case "lt":
      return order(op, left, right, span, (a, b) => a < b)
    case "gte":
      return order(op, left, right, span, (a, b) => a >= b)
    case "lte":
      return order(op, left, right, span, (a, b) => a <= b)
    case "concat": {
      if (typeof left !== "string" || typeof right !== "string") {
        throw flangError(
          "FLANG_TYPE",
          `«соединить» допустимо только для строк, получено ${typeName(left)} и ${typeName(right)}`,
          span,
        )
      }
      return left + right
    }
    default:
      throw flangError("FLANG_TYPE", `неизвестная операция «${op}»`, span)
  }
}

function arithmetic(op, left, right, span, apply) {
  if (typeof left !== "number" || typeof right !== "number") {
    throw flangError(
      "FLANG_TYPE",
      `операция «${op}» допустима только для чисел, получено ${typeName(left)} и ${typeName(right)}`,
      span,
    )
  }
  return apply(left, right)
}

// Сообщение дословно как в ядре (src/utility.ts, compare): порядок — только
// для чисел. Совпадение текста облегчает сверку выводов двух движков.
function order(op, left, right, span, apply) {
  if (typeof left !== "number" || typeof right !== "number") {
    throw flangError("FLANG_TYPE", "сравнения порядка допустимы только для чисел", span)
  }
  return apply(left, right)
}

// ───────────────────────────── мягкая проверка имён типов ─────────────────────────────

// Полноценная проверка типов — дело types.mjs. Здесь только защита от опечатки
// в имени конструктора: если типы объявлены, имя обязано быть среди них.
function checkVariantName(machine, expr) {
  if (machine.rt.variants.size === 0) return
  if (!machine.rt.variants.has(expr.variant)) {
    throw flangError("FLANG_UNKNOWN_NAME", `неизвестный вариант «${expr.variant}»`, expr.span)
  }
}

function checkRecordType(machine, expr) {
  if (machine.rt.records.size === 0 || expr.type === undefined) return
  if (!machine.rt.records.has(expr.type)) {
    throw flangError("FLANG_UNKNOWN_NAME", `неизвестная запись «${expr.type}»`, expr.span)
  }
}

// Экспорт помощников, полезных вызывающему коду (тесты, factcheck, CLI).
export { isList, isRecord, isScalar, isVariant, typeName, describeValue }
