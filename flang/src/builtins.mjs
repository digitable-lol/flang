/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
// Встроенные формы flang: строки, списки, числа.
//
// Здесь же живут представление значений (вариант суммы типов) и представление
// ошибок. Почему именно здесь: интерпретатор импортирует builtins, обратной
// зависимости нет — общий модуль без цикла получается только так, а заводить
// третий файл нельзя (граница ответственности этого слоя — два файла).
//
// Модуль детерминирован: ни времени, ни случайности, ни ввода-вывода.

// ───────────────────────────── ошибки ─────────────────────────────

// Формат ядра FTS: { code, message, severity, span } внутри массива diagnostics.
// Наружу дублируем code/span полями, чтобы вызывающему не приходилось
// разворачивать массив ради одной диагностики.
export class FlangError extends Error {
  constructor(code, message, span) {
    super(message)
    this.name = "FlangError"
    this.code = code
    const diagnostic = { code, message, severity: "error" }
    if (span !== undefined && span !== null) {
      diagnostic.span = span
      this.span = span
    }
    this.diagnostics = [diagnostic]
  }
}

export function flangError(code, message, span) {
  return new FlangError(code, message, span)
}

// ─────────────────────── отказ, ставший значением ───────────────────────
//
// ПОЧЕМУ ЭТО ВООБЩЕ ЕСТЬ. Отказ встроенной формы прекращает вычисление целиком,
// и перехватить его нечем — исключений в языке нет и не будет. Поэтому
// пригодность аргумента проверяют ДО опасного места. Для всех встроенных форм,
// кроме одной, такая проверка стоит одной строки и ничего не повторяет: «голова»
// и «хвост» закрываются разбором `случай пусто`, «символ» и «подстрока» —
// сравнением с «длина», «разделить» — проверкой разделителя на пустоту.
//
// Особняком стоит «к числу», и вот чем именно. Проверить её пригодность заранее
// МОЖНО — но только ПОВТОРИВ её саму. Форма принимает строку, если та после
// `String.prototype.trim` укладывается в `[+-]?(цифры[.цифры]|.цифры)[eE[+-]цифры]`
// И результат конечен. Значит повторить придётся ДВА чужих решения: набор
// пробельных кодовых точек JS (измерено перебором: их 25, среди них U+00A0,
// U+3000 и U+FEFF — «к числу» их прощает) и границу IEEE-754, за которой `1e999`
// перестаёт быть конечным числом.
//
// И вот чего в языке нет: способа СВЕРИТЬ повторение с оригиналом. Разошлись —
// узнаешь падением на пользовательских данных, потому что единственный вопрос,
// на который язык отвечает точно, — «а что скажет сама форма», и задать его
// значит вызвать её, то есть сделать ровно то, чего проверка и должна была
// избежать. Строже повторения — программа теряет числа, которые язык принимает;
// слабее — программа падает. Приблизиться к набору пробельных точек нечем даже
// грубо: формы «код символа» в языке нет вовсе.
//
// Сколько это стоит на практике — измерено, и измерение лежало в репозитории
// задолго до этой правки: единственный разбор строки в число, написанный здесь
// безопасно, это «Разобрать цифру» в `flang/stdlib/result.flang`, и он
// разбирает РОВНО ОДНУ цифру. Не по скромности задачи — в шапке той функции так
// и записано: «Проверить можно только то, что выразимо без обхода символов».
//
// У остальных встроенных форм проверка ничего не повторяет: она отвечает на
// вопрос, который язык и так умеет задать точно.
//
// РЕШЕНИЕ — В ДУХЕ ВВОДА-ВЫВОДА (`io.mjs`): отказ не бросается, а ОПИСЫВАЕТСЯ
// значением. `к числу или беда` не может отказать вовсе: она возвращает
// «Разобрано» со значением либо «Не разобрано» с кодом и текстом — ровно теми,
// какие бросила бы «к числу». Не «похожими»: реализация буквально вызывает «к
// числу» и превращает её отказ в значение, поэтому разойтись тексты не могут ни
// здесь, ни в одной из восьми целей печати.
//
// ПОЧЕМУ СУММА, А НЕ ПРИЗНАК. Признак «годится к числу» закрыл бы ту же дыру
// вдвое дешевле, но потерял бы ПРИЧИНУ: «не число» и «не конечное число» —
// разные отказы, и программа, пишущая отчёт о непригодной строке, обязана уметь
// их назвать. Та же причина, по которой хозяин ввода-вывода отвечает вариантом
// «Сбой» с кодом и сообщением, а не словом «нет».
//
// ПОЧЕМУ ТИП ПРИПИСЫВАЕТ ЯЗЫК, А НЕ ОБЪЯВЛЯЕТ АВТОР. Та же причина, что у
// словаря поручений (`io.mjs`) и словаря действий (`conc.mjs`): исход встроенной
// формы — КОНТРАКТ между языком и программой, а не выбор автора. Объявляй его
// каждая программа заново — две программы назвали бы отказ по-разному, и восемь
// напечатанных рантаймов не смогли бы построить одно значение.
//
// ПОЧЕМУ ТИП НЕ ПАРАМЕТРИЧЕСКИЙ. Параметр с единственной подстановкой — это
// неиспользуемая общность. Форма сегодня одна, и набор ЗАКРЫТ по той же причине,
// по которой закрыт набор поручений: каждая новая обязана быть напечатана во все
// восемь целей. Появится вторая — тогда и станет видно, один ли у них исход;
// сегодня утверждать это было бы обещанием без измерения.
export const OUTCOME_TYPE_NAME = "Исход числа"
/** Разбор удался: вот число. */
export const OUTCOME_PARSED = "Разобрано"
/** Разбор не удался: вот код и текст, которыми отказала бы «к числу». */
export const OUTCOME_FAILED = "Не разобрано"

/*
 * Имена проверены `grep`-ом по всем `.flang` и `.fts` репозитория, как того
 * требует правило из `io.mjs`: «Исход числа» — 0 вхождений, «Разобрано» — 0,
 * «Не разобрано» — 0. Имена вариантов обязаны быть уникальны на модуль
 * (`types.mjs`), а словарь приписывается поверх чужого кода, поэтому проверка
 * тут не формальность.
 */
const OUTCOME_TYPE = Object.freeze({
  kind: "sum",
  name: OUTCOME_TYPE_NAME,
  builtin: true,
  variants: [
    { name: OUTCOME_PARSED, fields: [{ name: "значение", type: { kind: "number" } }] },
    {
      name: OUTCOME_FAILED,
      fields: [
        { name: "код", type: { kind: "string" } },
        { name: "сообщение", type: { kind: "string" } },
      ],
    },
  ],
})

/**
 * Приписать тип исхода программе. Идемпотентно и с той же уступкой, что
 * `withIoTypes`: имя, уже занятое собственным объявлением, не переопределяется
 * молча — программа получит честную диагностику «неизвестный тип» вместо тихой
 * подмены смысла.
 */
export function withOutcomeType(program) {
  const types = Array.isArray(program?.types) ? program.types : []
  const занято = new Set()
  for (const тип of types) {
    if (typeof тип?.name === "string") занято.add(тип.name)
    for (const в of тип?.variants ?? []) if (typeof в?.name === "string") занято.add(в.name)
  }
  if (занято.has(OUTCOME_TYPE_NAME) || OUTCOME_TYPE.variants.some((в) => занято.has(в.name))) return program
  return { ...program, types: [...types, structuredClone(OUTCOME_TYPE)] }
}

// ───────────────────────────── значения ─────────────────────────────

// Вариант суммы типов — отдельный класс, а не объект с меткой: запись flang
// это обычный JS-объект (так значения совпадают с FtsValue ядра и сериализуются
// в JSON без потерь), поэтому служебное поле-метка могло бы столкнуться с
// пользовательским полем.
export class FlangVariant {
  constructor(name, fields = {}) {
    this.variant = name
    this.fields = fields
  }
}

export function variant(name, fields = {}) {
  return new FlangVariant(name, fields)
}

export function isVariant(value) {
  return value instanceof FlangVariant
}

export function isList(value) {
  return Array.isArray(value)
}

export function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof FlangVariant)
}

// Значение варианта в JSON. Классов JSON не знает, а значения ходят через JSON
// сразу в трёх местах: значение примера в AST («пример … ожидается вариант …»),
// `--args` командной строки и факты для факт-чекинга. Поэтому у варианта есть
// ровно одна запись — { "variant": "Имя", "fields": { … } }, и это в точности
// то, что даёт JSON.stringify(new FlangVariant(…)): печать и чтение обратны
// друг другу, а не «похожи».
//
// Форма узнаётся строго: объект ровно с двумя полями, «variant» — непустая
// строка, «fields» — запись. Запись программы ровно с такими двумя полями от
// варианта неотличима — это цена одного представления вместо двух; заводить
// служебную метку внутри записи нельзя по причине из шапки модуля (запись
// flang — обычный объект JS, метка столкнулась бы с полем пользователя).
function encodedVariant(value) {
  if (!isRecord(value)) return null
  const keys = Object.keys(value)
  if (keys.length !== 2 || !keys.includes("variant") || !keys.includes("fields")) return null
  if (typeof value.variant !== "string" || value.variant === "" || !isRecord(value.fields)) return null
  return value
}

// JSON-значение → значение времени выполнения. Скаляр возвращается как есть
// (это подавляющее большинство вызовов), составное обходится вглубь и
// пересобирается, только если внутри что-то изменилось: иначе каждый литерал
// в теле функции копировал бы свой список на каждом шаге.
//
// Рекурсия по данным, как и у valuesEqual: её глубина ограничена вложенностью
// значения, а не длиной вычисления, поэтому стек JS ей не грозит.
export function reifyValue(value) {
  if (value === undefined) return null
  if (isScalar(value) || isVariant(value)) return value
  if (isList(value)) {
    let changed = false
    const items = value.map((item) => {
      const next = reifyValue(item)
      if (next !== item) changed = true
      return next
    })
    return changed ? items : value
  }
  if (!isRecord(value)) return value
  const encoded = encodedVariant(value)
  if (encoded !== null) {
    const fields = {}
    for (const [name, field] of Object.entries(encoded.fields)) fields[name] = reifyValue(field)
    return new FlangVariant(encoded.variant, fields)
  }
  let changed = false
  const record = {}
  for (const [name, field] of Object.entries(value)) {
    record[name] = reifyValue(field)
    if (record[name] !== field) changed = true
  }
  return changed ? record : value
}

export function isScalar(value) {
  return value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean"
}

export function typeName(value) {
  if (value === null) return "ничто"
  if (typeof value === "string") return "строка"
  if (typeof value === "number") return "число"
  if (typeof value === "boolean") return "признак"
  if (isList(value)) return "список"
  if (isVariant(value)) return `вариант «${value.variant}»`
  if (isRecord(value)) return "запись"
  return "неизвестное значение"
}

// Короткое описание значения для сообщений об ошибках.
export function describeValue(value) {
  if (typeof value === "string") return JSON.stringify(value)
  if (isVariant(value)) {
    const fields = Object.keys(value.fields)
    return fields.length === 0 ? value.variant : `${value.variant}(${fields.join(", ")})`
  }
  if (isList(value)) return `список из ${value.length}`
  if (isRecord(value)) return `запись {${Object.keys(value).join(", ")}}`
  if (value === null) return "ничто"
  if (value === true) return "да"
  if (value === false) return "нет"
  return String(value)
}

// Равенство. Скаляры сравниваем через Object.is — ровно как compare() ядра
// (src/utility.ts): NaN равен NaN, 0 не равен -0. Составные значения ядро не
// сравнивает вовсе, поэтому здесь мы расширяем семантику структурно.
// Рекурсия по данным (не по программе) — её глубина ограничена вложенностью
// значения, а не длиной вычисления, поэтому стек JS ей не грозит.
export function valuesEqual(left, right) {
  if (isScalar(left) || isScalar(right)) {
    if (!isScalar(left) || !isScalar(right)) return false
    return Object.is(left, right)
  }
  if (isList(left) && isList(right)) {
    if (left.length !== right.length) return false
    for (let index = 0; index < left.length; index += 1) {
      if (!valuesEqual(left[index], right[index])) return false
    }
    return true
  }
  if (isVariant(left) && isVariant(right)) {
    if (left.variant !== right.variant) return false
    return recordsEqual(left.fields, right.fields)
  }
  if (isRecord(left) && isRecord(right)) return recordsEqual(left, right)
  return false
}

function recordsEqual(left, right) {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) return false
  return leftKeys.every((key) => key in right && valuesEqual(left[key], right[key]))
}

// ───────────────────────────── числа ─────────────────────────────

// Порядок операций скопирован из src/utility.ts: (percent / 100) * value.
// Переписать в value * percent / 100 нельзя — меняется последний бит мантиссы,
// и совместимость с уже сгенерированным кодом ломается.
export function percentOf(percent, value) {
  return (percent / 100) * value
}

// Остаток — обычный оператор JS: печать в JS должна давать тот же результат,
// поэтому деление на ноль здесь даёт NaN, а не ошибку (это значение IEEE-754,
// а не «забыли обработать»).
export function remainderOf(left, right) {
  return left % right
}

// ───────────────────────────── проверка аргументов ─────────────────────────────

function plural(count, one, few, many) {
  const mod100 = Math.abs(count) % 100
  const mod10 = mod100 % 10
  if (mod100 >= 11 && mod100 <= 14) return many
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}

function expectArity(name, args, count, span) {
  if (args.length !== count) {
    const word = plural(count, "аргумент", "аргумента", "аргументов")
    throw flangError(
      "FLANG_BUILTIN_ARGS",
      `«${name}» ожидает ${count} ${word}, получено ${args.length}`,
      span,
    )
  }
}

function expectString(name, value, role, span) {
  if (typeof value !== "string") {
    throw flangError("FLANG_BUILTIN_ARGS", `«${name}»: ${role} должна быть строкой, получено ${typeName(value)}`, span)
  }
  return value
}

function expectNumber(name, value, role, span) {
  if (typeof value !== "number") {
    throw flangError("FLANG_BUILTIN_ARGS", `«${name}»: ${role} должно быть числом, получено ${typeName(value)}`, span)
  }
  return value
}

function expectInteger(name, value, role, span) {
  expectNumber(name, value, role, span)
  if (!Number.isInteger(value)) {
    throw flangError("FLANG_BUILTIN_ARGS", `«${name}»: ${role} должно быть целым числом, получено ${value}`, span)
  }
  return value
}

function expectList(name, value, role, span) {
  if (!isList(value)) {
    throw flangError("FLANG_BUILTIN_ARGS", `«${name}»: ${role} должен быть списком, получено ${typeName(value)}`, span)
  }
  return value
}

// Индексация человекочитаемая — от 1 и включительно с обоих концов: язык пишут
// на русском, «символ 1 в строке» читается как первый символ. Ноль-базовую
// схему можно включить через options.indexBase = 0 (тогда «по» — исключающая
// граница, как в JS slice).
function indexBase(options) {
  return options && options.indexBase === 0 ? 0 : 1
}

// ───────────────────────────── реализации ─────────────────────────────

// Строки режем по кодовым точкам (Array.from), а не по UTF-16: язык русский,
// и «длина» для «привет» обязана быть 6, а для суррогатных пар — числом
// символов, а не единиц кодирования.
const IMPLEMENTATIONS = {
  "длина": (args, span) => {
    expectArity("длина", args, 1, span)
    const value = args[0]
    if (typeof value === "string") return Array.from(value).length
    if (isList(value)) return value.length
    throw flangError("FLANG_BUILTIN_ARGS", `«длина»: ожидается строка или список, получено ${typeName(value)}`, span)
  },

  "символ": (args, span, options) => {
    expectArity("символ", args, 2, span)
    const index = expectInteger("символ", args[0], "индекс", span)
    const text = expectString("символ", args[1], "строка", span)
    const chars = Array.from(text)
    const at = index - indexBase(options)
    if (at < 0 || at >= chars.length) {
      throw flangError(
        "FLANG_BUILTIN_ARGS",
        `«символ»: индекс ${index} вне строки длиной ${chars.length}`,
        span,
      )
    }
    return chars[at]
  },

  /*
   * Разложение строки в список односимвольных строк — по кодовым точкам, как и
   * всё остальное в этом файле.
   *
   * Пустая строка даёт пустой список, а не список из одной пустой строки: иначе
   * «Длина» от «символы» разошлась бы с «длина» от самой строки на пустом
   * входе, и всякая свёртка по символам получила бы лишний виток из ниоткуда.
   */
  "символы": (args, span) => {
    expectArity("символы", args, 1, span)
    const text = expectString("символы", args[0], "строка", span)
    return Array.from(text)
  },

  "подстрока": (args, span, options) => {
    expectArity("подстрока", args, 3, span)
    const text = expectString("подстрока", args[0], "строка", span)
    const from = expectInteger("подстрока", args[1], "начало", span)
    const to = expectInteger("подстрока", args[2], "конец", span)
    const chars = Array.from(text)
    // При базе 1 «по» включительно, при базе 0 — исключительно; в обоих случаях
    // исключающая граница совпадает с самим «по», сдвигается только начало.
    const start = from - indexBase(options)
    const end = to
    if (start < 0 || start > chars.length) {
      throw flangError("FLANG_BUILTIN_ARGS", `«подстрока»: начало ${from} вне строки длиной ${chars.length}`, span)
    }
    if (end < start || end > chars.length) {
      throw flangError("FLANG_BUILTIN_ARGS", `«подстрока»: конец ${to} вне диапазона [${from}, ${chars.length}]`, span)
    }
    return chars.slice(start, end).join("")
  },

  "соединить": (args, span) => {
    expectArity("соединить", args, 2, span)
    // Две формы: «соединить строку с строкой» и «соединить список с
    // разделителем». Различаем по типу первого аргумента.
    if (isList(args[0])) {
      const separator = expectString("соединить", args[1], "разделитель", span)
      const parts = args[0].map((item, index) => {
        if (typeof item !== "string") {
          throw flangError(
            "FLANG_BUILTIN_ARGS",
            `«соединить»: элемент ${index + 1} списка должен быть строкой, получено ${typeName(item)}`,
            span,
          )
        }
        return item
      })
      return parts.join(separator)
    }
    const left = expectString("соединить", args[0], "первая строка", span)
    const right = expectString("соединить", args[1], "вторая строка", span)
    return left + right
  },

  "разделить": (args, span) => {
    expectArity("разделить", args, 2, span)
    const text = expectString("разделить", args[0], "строка", span)
    const separator = expectString("разделить", args[1], "разделитель", span)
    if (separator === "") {
      throw flangError("FLANG_BUILTIN_ARGS", "«разделить»: разделитель не может быть пустым", span)
    }
    return text.split(separator)
  },

  "содержит": (args, span) => {
    expectArity("содержит", args, 2, span)
    if (isList(args[0])) return args[0].some((item) => valuesEqual(item, args[1]))
    const text = expectString("содержит", args[0], "строка или список", span)
    const part = expectString("содержит", args[1], "искомая подстрока", span)
    return text.includes(part)
  },

  "начинается с": (args, span) => {
    expectArity("начинается с", args, 2, span)
    const text = expectString("начинается с", args[0], "строка", span)
    const prefix = expectString("начинается с", args[1], "префикс", span)
    return text.startsWith(prefix)
  },

  "к числу": (args, span) => {
    expectArity("к числу", args, 1, span)
    const text = expectString("к числу", args[0], "строка", span)
    const trimmed = text.trim()
    // Строгий разбор: без Infinity, NaN, шестнадцатеричных и пустой строки —
    // иначе «к числу» молча превращает мусор в значение.
    if (!/^[+-]?(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?$/u.test(trimmed)) {
      throw flangError("FLANG_BUILTIN_ARGS", `«к числу»: строка ${JSON.stringify(text)} не является числом`, span)
    }
    const result = Number(trimmed)
    if (!Number.isFinite(result)) {
      throw flangError("FLANG_BUILTIN_ARGS", `«к числу»: строка ${JSON.stringify(text)} не является конечным числом`, span)
    }
    return result
  },

  /*
   * «к числу», чей отказ стал значением. Обоснование формы — в шапке модуля,
   * раздел «отказ, ставший значением».
   *
   * Тело здесь буквально одно: вызвать «к числу» и перевести её отказ в
   * вариант. Переписывать разбор второй раз было бы дефектом по построению —
   * два разбора одной строки рано или поздно разошлись бы, а обещано ровно
   * обратное: те же значения и те же тексты.
   *
   * Ловится ЛЮБОЙ отказ «к числу», включая «аргумент не строка». Так форма
   * действительно не может отказать — а «почти не может» здесь ничем не лучше
   * прежнего: программа снова не знала бы, надо ли проверять заранее.
   */
  "к числу или беда": (args, span) => {
    expectArity("к числу или беда", args, 1, span)
    try {
      return variant(OUTCOME_PARSED, { значение: IMPLEMENTATIONS["к числу"](args, span) })
    } catch (беда) {
      return variant(OUTCOME_FAILED, {
        код: беда?.code ?? "FLANG_BUILTIN_ARGS",
        сообщение: String(беда?.message ?? ""),
      })
    }
  },

  "к строке": (args, span) => {
    expectArity("к строке", args, 1, span)
    const value = args[0]
    if (typeof value === "string") return value
    if (typeof value === "number") return String(value)
    // Признак печатаем по-русски: поверхность языка знает «да» и «нет», а не
    // true и false.
    if (typeof value === "boolean") return value ? "да" : "нет"
    if (value === null) return "ничто"
    throw flangError("FLANG_BUILTIN_ARGS", `«к строке»: ожидается скаляр, получено ${typeName(value)}`, span)
  },

  "пусто": (args, span) => {
    expectArity("пусто", args, 1, span)
    const value = args[0]
    if (isList(value)) return value.length === 0
    if (typeof value === "string") return Array.from(value).length === 0
    throw flangError("FLANG_BUILTIN_ARGS", `«пусто»: ожидается строка или список, получено ${typeName(value)}`, span)
  },

  "голова": (args, span) => {
    expectArity("голова", args, 1, span)
    const list = expectList("голова", args[0], "аргумент", span)
    if (list.length === 0) throw flangError("FLANG_BUILTIN_ARGS", "«голова»: список пуст", span)
    return list[0]
  },

  // «хвост» копирует: список flang — массив JS (так значения совпадают с
  // FtsValue ядра и сериализуются в JSON), а массив нельзя разделить с
  // суффиксом без копирования. Значит рекурсия «голова и хвост» по длинному
  // списку квадратична; для больших данных язык даёт линейные «свёртка»,
  // «отобразить» и «отфильтровать», которые ничего не копируют.
  "хвост": (args, span) => {
    expectArity("хвост", args, 1, span)
    const list = expectList("хвост", args[0], "аргумент", span)
    if (list.length === 0) throw flangError("FLANG_BUILTIN_ARGS", "«хвост»: список пуст", span)
    return list.slice(1)
  },

  /*
   * Элемент по номеру. Индексация с 1 и включительно — та же, что у «символ»,
   * и по той же причине: язык пишут по-русски, «элемент 1 в списке» читается
   * как первый.
   *
   * ЧТО ЭТА ФОРМА ОБЕЩАЕТ, А ЧТО НЕТ. Обещает она ЗНАЧЕНИЕ, а не стоимость:
   * «взять N-й» без обхода — это свойство представления списка в цели печати,
   * а не языка. Здесь, в вычислителе, список — массив JS, и обращение стоит
   * одного шага; в семи целях из восьми — тоже (массив в C, срез в Go, `Vec` с
   * началом в Rust, `list` в Python, массивы в Java и C#, массив в JS). В
   * восьмой, Elixir, список BEAM односвязный, и обращение к N-му стоит N
   * переходов; там же и `длина` стоит обхода. Цифры измерены и записаны в
   * SPEC, раздел «Стоимость встроенных форм» — обещать «быстро» там, где цель
   * этого не даёт, значит врать одному из восьми читателей.
   *
   * ОТКАЗ. Номер вне списка прекращает вычисление, как и у «символ»: проверка
   * заранее здесь ничего не повторяет — `не больше (длина элементы)` выразимо
   * одной строкой, и это ровно тот случай, о котором сказано в шапке файла.
   */
  "элемент": (args, span, options) => {
    expectArity("элемент", args, 2, span)
    const index = expectInteger("элемент", args[0], "индекс", span)
    const list = expectList("элемент", args[1], "список", span)
    const at = index - indexBase(options)
    if (at < 0 || at >= list.length) {
      throw flangError("FLANG_BUILTIN_ARGS", `«элемент»: индекс ${index} вне списка длиной ${list.length}`, span)
    }
    return list[at]
  },

  "добавить": (args, span) => {
    expectArity("добавить", args, 2, span)
    const list = expectList("добавить", args[1], "второй аргумент", span)
    // «добавить x к списку» читается как дописать в конец; исходный список не
    // изменяется — значения flang неизменяемы.
    return [...list, args[0]]
  },

  "остаток от": (args, span) => {
    expectArity("остаток от", args, 2, span)
    const left = expectNumber("остаток от", args[0], "делимое", span)
    const right = expectNumber("остаток от", args[1], "делитель", span)
    return remainderOf(left, right)
  },

  "процентов от": (args, span) => {
    expectArity("процентов от", args, 2, span)
    const percent = expectNumber("процентов от", args[0], "процент", span)
    const value = expectNumber("процентов от", args[1], "значение", span)
    return percentOf(percent, value)
  },
}

// Синонимы: парсер может отдавать как краткую, так и полную форму имени.
const ALIASES = new Map([
  ["символ в", "символ"],
  ["элемент в", "элемент"],
  ["начинается", "начинается с"],
  ["остаток", "остаток от"],
  ["процентов", "процентов от"],
  ["к_числу", "к числу"],
  ["к_числу_или_беда", "к числу или беда"],
  ["к_строке", "к строке"],
])

export const BUILTIN_NAMES = Object.freeze(Object.keys(IMPLEMENTATIONS))

export function canonicalBuiltinName(name) {
  return ALIASES.get(name) ?? name
}

export function hasBuiltin(name) {
  return Object.hasOwn(IMPLEMENTATIONS, canonicalBuiltinName(name))
}

export function callBuiltin(name, args, span, options) {
  const canonical = canonicalBuiltinName(name)
  if (!Object.hasOwn(IMPLEMENTATIONS, canonical)) {
    throw flangError("FLANG_UNKNOWN_NAME", `неизвестная встроенная форма «${name}»`, span)
  }
  if (!Array.isArray(args)) {
    throw flangError("FLANG_BUILTIN_ARGS", `«${name}»: аргументы должны быть списком`, span)
  }
  return IMPLEMENTATIONS[canonical](args, span, options ?? {})
}
