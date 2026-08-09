/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * flang — парсер: токены → AST из `flang/SPEC.md`, раздел 5.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Таблица ключевых слов (русская и английская поверхности равноправны и дают
 * один и тот же AST). Канонический идентификатор берётся из `KEYWORDS` в
 * `lexer.mjs`; здесь она повторена целиком, чтобы читать грамматику, не
 * переключая файл.
 *
 *   документ      модуль/module, экспортирует/exports, использует/uses,
 *                 категория/category, объект|структура/object|structure,
 *                 запись/record, тип/type, вариант/variant, это/is,
 *                 вложен объект|вложена структура / nested object|nested structure
 *   функции       тотальная/total, функция/function, принимает/accepts,
 *                 возвращает/returns, пример/example, дано/given, ожидается/expected
 *   выражения     пусть/let, если/if, то/then, иначе/else, разбор/match,
 *                 случай/case, от/of, и/and, с/with, из/from, в|к/to|into|in,
 *                 по/by, у/at, как/as, где/where, начиная с/starting with
 *   встроенные    отобразить/map, отфильтровать/filter, свёртка/fold,
 *                 длина/length, символ/char, подстрока/substring,
 *                 соединить/join, разделить/split, содержит/contains,
 *                 начинается с/begins with, к числу/to number,
 *                 к числу или беда/to number or failure, к строке/to text,
 *                 голова/head, хвост/tail, голова и хвост/head and tail,
 *                 пусто/empty, пустой список/empty list, список из/list of,
 *                 список/list, добавить/add, любое/any
 *   арифметика    плюс/plus, минус/minus, умножить на/times|multiplied by,
 *                 делить на/divided by, остаток от/modulo,
 *                 процентов|процента|процент / percent|percents
 *   сравнения     равен|равна|равно|равным|равной|равное / equals|equal to,
 *                 не равен/is not equal to, больше/is greater than,
 *                 меньше/is less than, не больше/is at most, не меньше/is at least
 *   значения      да/true|yes, нет/false|no, ничто/null,
 *                 число/number, строка|текст/string|text, признак/boolean|flag,
 *                 деньги/money, дата/date, состоянием/state,
 *                 является/is, иногда является/may be
 *   наследие FTS  утилита/utility, правило/rule, свойство/property,
 *                 результат/result, начинает с/starts with, поле/field,
 *                 морфизм/morphism, теорема/theorem, функтор/functor,
 *                 утверждение/proposition, имеет/has, в данных/in data,
 *                 найти где/find where, по морфизму|затем по морфизму|
 *                 применить морфизм / by morphism|then by morphism|apply morphism,
 *                 следовательно|получаем/therefore, по закону/under law,
 *                 отображается в|отображаются в|в поле|в морфизм /
 *                 maps to|map to|to field|to morphism
 *   теоркат       после/after, цепочка/chain, сначала/first, затем/next,
 *                 единица/identity, моноид/monoid, носитель/carrier,
 *                 операция/operation, обратный элемент/inverse element,
 *                 изоморфизм/isomorphism, прямой морфизм/forward morphism,
 *                 обратный морфизм/inverse morphism, бифунктор/bifunctor,
 *                 объекты/objects, морфизмы/morphisms,
 *                 монада/monad, возврат/return, соединение/flatten,
 *                 в монаде/in monad
 *   конкурентность процесс/process, обрабатывает/handles, с запасом/with budget,
 *                 надзор/supervision, стратегия/strategy,
 *                 порог отказов/failure threshold, прогон/run, семя/seed
 *
 * Начальное состояние процесса называется уже занятым `начинает с`, а тип
 * состояния — уже занятым `состояние`: слова «начальное» и «порог» из контракта
 * конкурентности в языке заняты именами переменных репозитория, и заводить их
 * ключевыми значило бы сломать чужие файлы (подробности — в `lexer.mjs`).
 *
 * Английское `starts with` закреплено за утилитой FTS (`начинает с`), поэтому
 * строковая встроенная форма `начинается с` по-английски пишется `begins with`:
 * иначе одна и та же фраза означала бы две разные конструкции.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Одно слово в трёх ролях: `функция` (flang/cat/HOF.md).
 *
 *   функция «Ф»                     объявление       — начало декларации
 *   принимает ф: функция из … в …   тип функции      — позиция типа
 *   «Применить» от функция «Ф»      значение (тег)   — позиция выражения
 *
 * Различает позиция, и другого способа не нужно: в позиции типа и в позиции
 * выражения слово `функция` до этой работы всегда было ошибкой разбора, значит
 * ни одна существующая программа новых форм не заметит. Новых ключевых слов не
 * заведено ни одного — `функция`, `из`, `и`, `в`, `от` в таблице с первого дня.
 *
 * Так же разведено `от`: слева от него либо имя функции (не связано ничем
 * локальным, пишется с прописной) — вызов, — либо значение (связанное имя, поле
 * записи, результат применения) — применение значения-функции.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Что делаем с конструкциями FTS, у которых нет узла в AST flang.
 *
 * `утилита`, `правило`, `свойство`, `морфизм`, `теорема`, `функтор`, заголовок
 * `модуль`, а также старая скобочная поверхность (`category X { … }`) не имеют
 * прямого соответствия в разделе 5 SPEC. Ронять на них парсер нельзя: любой
 * существующий `.fts` обязан разбираться. Поэтому такая конструкция полностью
 * разбирается и складывается в массив `legacy` программы отдельным узлом
 *
 *     { "kind": "ftsLegacy", "construct": "utility", "value": { … }, "span": … }
 *
 * где `value` повторяет форму канонической модели ядра (`src/model.ts`:
 * `FtsUtility`, `FtsFunctor`, `FtsProposition`), чтобы `compat.mjs` строил из
 * него эквивалент без повторного разбора текста. Поле `legacy` появляется
 * только когда такие конструкции в файле есть — чистая программа flang даёт
 * ровно `{ flang, module, types, functions }` из SPEC.
 *
 * `объект`/`структура` — исключение: запись уже является частью flang, поэтому
 * она попадает в `types` настоящим узлом `{ kind: "record" }` (и дополнительно
 * несёт `fts` — исходную строку типа ядра, чтобы `compat.mjs` не угадывал
 * «Деньги» по `{ kind: "number" }`).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Имена и падежи (SPEC, раздел 4).
 *
 * Парсер — единственный слой, который видит поверхность, поэтому падежи снимает
 * он, а в AST кладёт **каноническое имя**: `разбор элементов` при параметре
 * `элементы` даёт `{ kind: "var", name: "элементы" }`. Порядок ровно такой:
 *
 *   1. точное совпадение среди связанных локальных имён — основной путь;
 *   2. иначе — сопоставление по неизменяемой основе (обрезаем русские
 *      окончания) среди тех же локальных имён;
 *   3. ровно один кандидат — связываем; несколько — `FLANG_AMBIGUOUS_NAME`;
 *      ни одного — `FLANG_UNKNOWN_NAME`.
 *
 * Локальные имена — это параметры функции, `пусть` и привязки образцов,
 * `отобразить`/`отфильтровать`/`свёртка`. Имена функций, типов, вариантов и
 * полей записей склонению не подлежат: они часть контракта, и подбор основы
 * сделал бы диагностику непредсказуемой. Поэтому имя с прописной буквы (тип,
 * вариант, функция) и позиция применения `«Имя» от …` разрешаются точно.
 * Английской поверхности правило не мешает: латинские окончания не обрезаются.
 */

import { withOutcomeType } from "./builtins.mjs"
import { ACTION_TYPE } from "./conc.mjs"
import { IO_TYPE_NAMES, IO_VARIANT_OWNER, withIoTypes } from "./io.mjs"
import { FlangError, flangError, keywordId, surfaceOfTokens, tokenize, wordOn } from "./lexer.mjs"
import { expandMonads } from "./monad.mjs"

export { FlangError, flangError, tokenize }

const BINARY_OPS = {
  opAdd: "add",
  opSub: "sub",
  opMul: "mul",
  opDiv: "div",
  opMod: "mod",
  opPercent: "percent",
}

const COMPARISONS = {
  cmpEq: "eq",
  cmpNeq: "neq",
  cmpGt: "gt",
  cmpLt: "lt",
  cmpGte: "gte",
  cmpLte: "lte",
}

/** Сравнения ядра FTS называются иначе — но совпадают один в один. */
const FTS_COMPARISONS = COMPARISONS

const SCALAR_TYPES = {
  tNumber: { kind: "number" },
  tString: { kind: "string" },
  tFlag: { kind: "flag" },
  tMoney: { kind: "number", fts: "Деньги" },
  tDate: { kind: "string", fts: "Дата" },
  litNull: { kind: "nothing" },
}

const FTS_TYPE_NAMES = {
  tNumber: "Число",
  tString: "Строка",
  tFlag: "Признак",
  tMoney: "Деньги",
  tDate: "Дата",
}

/** Слова, которые никогда не начинают выражение: на них тело функции кончается. */
const NOT_EXPRESSION = new Set([
  "accepts",
  "returns",
  "example",
  "utility",
  "rule",
  "property",
  /* Конкурентность: объявления, а не выражения. Без них тело функции,
     упершееся в `процесс` соседнего объявления, сообщало бы «неожиданное», не
     называя слова. */
  "process",
  "supervision",
  "run",
  "handles",
  "strategy",
  "failureThreshold",
  "seed",
  "budget",
  /* Ввод-вывод: `план` — объявление, а не выражение. Без него тело функции,
     упершееся в соседний план, жаловалось бы на «неожиданное», не назвав слова. */
  "plan",
  /* Монада — объявление; `возврат` и `соединение` живут только внутри своих
     блоков. Без этих трёх записей тело функции, упершееся в соседнюю монаду
     или написавшее `возврат` вне блока, жаловалось бы на «неожиданное». */
  "monad",
  "monadUnit",
  "monadJoin",
])

/** Ключевые слова, которые в позиции выражения читаются как обычные имена. */
const SOFT_NAMES = new Set(["tNumber", "tString", "tFlag", "tMoney", "tDate", "litNull", "total"])

/** Ключевые слова, с которых выражение начаться может. */
const EXPRESSION_START = new Set([
  "litTrue",
  "litFalse",
  "litNull",
  "empty",
  "emptyList",
  "listOf",
  "length",
  "head",
  "tail",
  "toNumber",
  "toNumberOrFail",
  "toText",
  "char",
  "item",
  "substring",
  "join",
  "split",
  "add",
  "variant",
  "record",
  "field",
  "result",
  "if",
  "match",
  "map",
  "filter",
  "fold",
  "let",
])

/**
 * `external` — имена функций из импортированных модулей.
 *
 * Имя функции без аргументов становится вызовом только если такая функция
 * объявлена (см. bindNullaryCalls). Пока разбирался один файл, «объявлена»
 * значило «объявлена здесь»; со связыванием модулей (src/link.mjs) функция
 * может прийти из другого файла, и без этого списка её вызов остался бы
 * несвязанным именем. Список передаётся снаружи, а не вычисляется здесь,
 * потому что парсер не читает файлы — это работа загрузчика.
 */
export function parse(source, file, external) {
  return new Parser(tokenize(source), external).parseProgram()
}

/**
 * Русские окончания, которые снимаются при поиске основы. Список закрытый и
 * упорядочен от длинных к коротким — иначе разбор перестал бы быть
 * детерминированным, а именно детерминированность и отличает это правило от
 * угадывания.
 */
const ENDINGS = [
  "ями",
  "ами",
  "ыми",
  "ими",
  "ого",
  "его",
  "ому",
  "ему",
  "ов",
  "ев",
  "ёв",
  "ей",
  "ий",
  "ый",
  "ая",
  "яя",
  "ое",
  "ее",
  "ую",
  "юю",
  "ых",
  "их",
  "ах",
  "ях",
  "ам",
  "ям",
  "ом",
  "ем",
  "ём",
  "ой",
  "а",
  "я",
  "у",
  "ю",
  "ы",
  "и",
  "е",
  "о",
]

const MINIMAL_STEM = 3

/** Неизменяемая основа имени: короткие имена (`х`, `поз`) не трогаем вовсе. */
function stem(name) {
  const lower = name.toLowerCase()
  for (const ending of ENDINGS) {
    if (lower.endsWith(ending) && lower.length - ending.length >= MINIMAL_STEM) {
      return lower.slice(0, lower.length - ending.length)
    }
  }
  return lower
}

class Parser {
  constructor(tokens, external) {
    this.external = external instanceof Set ? external : new Set(external ?? [])
    this.tokens = tokens
    this.index = 0
    /* Поверхность файла — чтобы диагностика цитировала те слова, которые автор
       мог написать. Считается один раз по всему потоку: разбор идёт слева
       направо, а первая же ошибка бывает и на первой строке, когда «сколько
       чего в файле» ещё неизвестно. */
    this.surface = surfaceOfTokens(tokens)
    this.types = []
    /* Стрелки категорий и их композиции: отдельный список, потому что они
       проверяются иначе, чем функции, — стыковкой домена с кодоменом. */
    this.morphisms = []
    /* Изоморфизм и бифунктор — тоже объявления времени компиляции, и лежат
       отдельно от стрелок по той же причине: проверяются они не стыковкой
       одной пары концов, а сличением нескольких объявлений между собой. */
    this.isomorphisms = []
    this.bifunctors = []
    this.monoids = []
    /* Монада — объявление времени компиляции, как моноид. Форма `в монаде`
       разворачивается в обычные вызовы ДО того, как программа уйдёт из
       парсера, поэтому список нужен здесь: разворачивание читает его.
       `blocksInMonad` — счётчик написанных блоков: по нулю видно, что
       разворачивать нечего, и программа уходит нетронутой. */
    this.monads = []
    this.blocksInMonad = 0
    this.functions = []
    /* Конкурентность (flang/conc/SPEC.md): процесс — объявление, а не значение,
       поэтому у него собственный список, как у типов и функций. */
    this.processes = []
    this.supervisors = []
    this.runs = []
    /* Ввод-вывод (flang/cat/SPEC.md): план — тоже объявление. Признак
       `usesIo` ставится там, где в тексте встретилось имя из словаря
       ввода-вывода; по нему словарь приписывается программе, и только по нему.
       Программа без ввода-вывода обязана остаться побайтово прежней — иначе
       неподвижная точка самоприменения сошлась бы к другому AST. */
    this.plans = []
    this.usesIo = false
    /* Тип исхода `«Исход числа»` приписывается по тому же правилу и по той же
       причине, что словарь ввода-вывода, — и с тем же условием: программа, в
       которой формы `к числу или беда` нет, обязана дать побайтово прежний AST. */
    this.usesOutcome = false
    this.legacy = []
    this.module = ""
    /* Стек областей видимости локальных имён и множество узлов `var`,
       которые ещё ждут разрешения (имя функции разрешать не нужно). */
    this.scopes = []
    this.pending = new WeakSet()
    /* Узлы `var`, чьё имя не связано ничем локальным. Разрешаются после
       разбора всего файла — см. `bindNullaryCalls`. */
    this.free = []
  }

  // ── локальные имена ───────────────────────────────────────────────────────

  pushScope(names) {
    this.scopes.push([...names])
  }

  popScope() {
    this.scopes.pop()
  }

  bind(name) {
    const scope = this.scopes[this.scopes.length - 1]
    if (scope !== undefined && !scope.includes(name)) scope.push(name)
  }

  locals() {
    const names = []
    for (const scope of this.scopes) for (const name of scope) if (!names.includes(name)) names.push(name)
    return names
  }

  /** `var`, помеченный к разрешению, получает каноническое имя своей привязки. */
  resolved(expression) {
    if (expression.kind !== "var" || !this.pending.has(expression)) return expression
    const name = this.resolveLocal(expression.name, expression.span)
    const node = { kind: "var", name, span: expression.span }
    /* Имя, не связанное ничем локальным, — кандидат в вызов функции без
       аргументов: `resolveLocal` пропускает такие (тип, вариант и функция
       пишутся с прописной и не склоняются). Решить сейчас нельзя — функция
       может быть объявлена ниже по файлу, поэтому узел запоминается. */
    if (!this.locals().includes(name)) this.free.push(node)
    return node
  }

  /**
   * Что применяется к аргументу: значение-функция или всё-таки имя функции.
   *
   * Возвращает выражение-значение либо `null` — «это имя функции, разбирай как
   * вызов». Правило одно: значением может быть связанное локальное имя (сам
   * параметр, `пусть`, привязка образца, элемент коллекции) или составное
   * выражение — поле записи, результат вызова, ещё одно применение. Свободное
   * имя и строка в кавычках остаются вызовом по имени, как были: иначе
   * `«Длина» от хвоста` и `"Длина" от хвоста` перестали бы разбираться.
   *
   * Литерал не применяется намеренно: `5 от 3` сегодня даёт понятную ошибку
   * разбора, и превращать её в ошибку типов значило бы сказать хуже.
   */
  appliedValue(expression) {
    if (expression.kind === "literal") return null
    if (expression.kind !== "var") return this.resolved(expression)
    if (!this.pending.has(expression)) return null
    const name = this.localName(expression.name)
    return name === null ? null : { kind: "var", name, span: expression.span }
  }

  /** Каноническое имя локальной привязки или `null`. То же правило, что в
   *  `resolveLocal`, но без отказа: здесь промах — не ошибка, а ответ. */
  localName(name) {
    const locals = this.locals()
    if (locals.includes(name)) return name
    if (/^\p{Lu}/u.test(name)) return null
    const target = stem(name)
    const matches = locals.filter((local) => stem(local) === target)
    return matches.length === 1 ? matches[0] : null
  }

  resolveLocal(name, span) {
    if (this.scopes.length === 0) return name
    const locals = this.locals()
    if (locals.includes(name)) return name
    /* Тип, вариант и функция пишутся с прописной — они не склоняются. */
    if (/^\p{Lu}/u.test(name)) return name
    const target = stem(name)
    const matches = locals.filter((local) => stem(local) === target)
    if (matches.length === 1) return matches[0]
    if (matches.length > 1) {
      throw flangError(
        "FLANG_AMBIGUOUS_NAME",
        `имя «${name}» подходит сразу нескольким связанным: ${matches.map((item) => `«${item}»`).join(", ")}`,
        span,
      )
    }
    throw flangError("FLANG_UNKNOWN_NAME", `имя «${name}» не связано`, span)
  }

  /** Имена, которые вводит образец случая. */
  patternBindings(pattern) {
    if (pattern.kind === "cons") return [pattern.head, pattern.tail]
    if (pattern.kind === "variant") return Object.values(pattern.bind)
    if (pattern.kind === "any" && pattern.bind !== undefined) return [pattern.bind]
    return []
  }

  // ── поток токенов ─────────────────────────────────────────────────────────

  peek(ahead = 0) {
    return this.tokens[Math.min(this.index + ahead, this.tokens.length - 1)]
  }

  next() {
    const token = this.peek()
    if (this.index < this.tokens.length - 1) this.index += 1
    return token
  }

  at(kind, ahead = 0) {
    return this.peek(ahead).kind === kind
  }

  atKw(id, ahead = 0) {
    const token = this.peek(ahead)
    return token.kind === "keyword" && token.value === id
  }

  atAnyKw(ids, ahead = 0) {
    const token = this.peek(ahead)
    return token.kind === "keyword" && ids.includes(token.value)
  }

  atPunct(value, ahead = 0) {
    const token = this.peek(ahead)
    return token.kind === "punct" && token.value === value
  }

  eatKw(id) {
    if (!this.atKw(id)) return false
    this.next()
    return true
  }

  eatPunct(value) {
    if (!this.atPunct(value)) return false
    this.next()
    return true
  }

  expectKw(id, message) {
    if (!this.atKw(id)) this.fail(message ?? `ожидалось ключевое слово «${this.kw(id)}»`)
    return this.next()
  }

  expectPunct(value) {
    if (!this.atPunct(value)) this.fail(`ожидался знак '${value}'`)
    return this.next()
  }

  /** Слово понятия на поверхности файла; на своей поверхности — оно же. */
  kw(id) {
    return wordOn(id, this.surface ?? "ru") ?? wordOn(id, "ru") ?? id
  }

  /**
   * Цитаты в диагностике — на поверхности файла, а не на русской.
   *
   * ЗАЧЕМ. Сообщение «у 'если' нет ветки 'то'» верно ровно для того, кто писал
   * `если`. Автору китайского файла оно называет два слова, которых в его
   * файле нет и быть не может: он писал `如果`, а `то` на его поверхности —
   * `那么`. Диагностика, называющая слово с ЧУЖОЙ поверхности, не просто
   * непереведена — она указывает не туда, и починить по ней нельзя.
   *
   * КАК. Правится не проза, а цитата. Слова поверхности в сообщениях парсера
   * стоят в апострофах (`'если'`), имена и образцы записи — в ёлочках
   * (`«Процесс»`, `«поле»`); поэтому переписываются ровно апострофы и ровно те
   * из них, что целиком являются фразой таблицы. Всё остальное — образцы
   * строк вроде `'ожидается «Процесс» равен значение'` — остаётся как есть:
   * это не цитата одного слова, а показанная целиком строка исходника, и
   * переписывать её по кускам значило бы выдумать её перевод.
   *
   * ЧТО ЭТО НЕ ДЕЛАЕТ. Прозу вокруг цитаты — «у … нет ветки …» — не переводит
   * ничего. Язык диагностики в этом репозитории русский, и выбор другого — это
   * решение владельца, а не следствие того, что в таблицу дописали столбец.
   * Здесь исправлено то, что было ПРОСТО НЕВЕРНО: цитата чужого слова.
   */
  onSurface(message) {
    if (this.surface === null || this.surface === "ru") return message
    return message.replace(/'([^']{1,40})'/gu, (целиком, фраза) => {
      const id = keywordId(фраза)
      if (id === null) return целиком
      const слово = wordOn(id, this.surface)
      return слово === null ? целиком : `'${слово}'`
    })
  }

  fail(message, token = this.peek()) {
    throw flangError("FLANG_PARSE", this.onSurface(message), token.span)
  }

  /** Имя: «ёлочки», обычные кавычки или слово. Ключевое слово в позиции имени
   *  возвращает исходный текст — иначе поле с именем `результат` стало бы
   *  синтаксической ошибкой в моделях, которые уже написаны. */
  expectNameToken(message) {
    const token = this.peek()
    if (token.kind === "name" || token.kind === "string") {
      this.next()
      return token
    }
    if (token.kind === "keyword") {
      this.next()
      return { ...token, kind: "name", value: token.text }
    }
    this.fail(message ?? "ожидалось имя")
  }

  expectName(message) {
    return this.expectNameToken(message).value.normalize("NFC")
  }

  atName() {
    return this.at("name") || this.at("string")
  }

  endLine() {
    if (this.at("newline")) this.next()
  }

  skipNewlines() {
    while (this.at("newline")) this.next()
  }

  /** Вход в отступной блок: `newline indent`. */
  enterBlock() {
    this.endLine()
    if (!this.at("indent")) return false
    this.next()
    return true
  }

  exitBlock() {
    this.skipNewlines()
    if (this.at("dedent")) {
      this.next()
      return
    }
    if (this.at("eof")) return
    this.fail("не разобрана конструкция: ожидался конец блока")
  }

  atBlockEnd() {
    return this.at("dedent") || this.at("eof")
  }

  // ── программа ─────────────────────────────────────────────────────────────

  parseProgram() {
    this.skipNewlines()
    if (this.looksBraced()) {
      this.parseBracedDocument()
    } else {
      this.parseDeclarations()
    }
    this.skipNewlines()
    if (!this.at("eof")) this.fail("не разобрана конструкция: лишний текст после объявлений")
    this.bindNullaryCalls()

    /* Словарь действий вводится языком, а не пользователем: обработчик обязан
       вернуть значение объявленного типа, а объявлять «отправить» в каждой
       программе заново значило бы дать двум программам называть отправку
       по-разному — и планировщику пришлось бы угадывать. Приписывается только
       там, где процесс есть: чистая программа без конкурентности остаётся
       побайтово прежней (см. conc.mjs, «Почему словарь действий встроенный»). */
    if (this.processes.length > 0 && !this.types.some((type) => type.name === ACTION_TYPE.name)) {
      /* Копия, а не сам образец: узел уходит в `types` разобранной программы, а
         оттуда — куда угодно, и один общий объект на все программы сразу стал бы
         общим состоянием между разборами. */
      this.types.push(structuredClone(ACTION_TYPE))
    }

    const program = { flang: 1, module: this.module, types: this.types, functions: this.functions }
    if (this.morphisms.length > 0) program.morphisms = this.morphisms
    if (this.isomorphisms.length > 0) program.isomorphisms = this.isomorphisms
    if (this.bifunctors.length > 0) program.bifunctors = this.bifunctors
    if (this.monoids.length > 0) program.monoids = this.monoids
    if (this.monads.length > 0) program.monads = this.monads
    if (this.processes.length > 0) program.processes = this.processes
    if (this.supervisors.length > 0) program.supervisors = this.supervisors
    if (this.runs.length > 0) program.runs = this.runs
    if (this.plans.length > 0) program.plans = this.plans
    if (this.legacy.length > 0) program.legacy = this.legacy

    /* Словарь ввода-вывода приписывается по тому же правилу и по той же
       причине, что словарь действий выше: поручение — контракт между языком и
       хозяином, а не объявление автора. Разница одна — признак использования
       здесь считается по именам в тексте, а не по наличию объявления: функция,
       строящая поручение, обязана проверяться примерами и БЕЗ всякого плана. */
    const сИсходом = this.usesOutcome ? withOutcomeType(program) : program
    const готово = this.usesIo ? withIoTypes(сИсходом) : сИсходом

    /* Разворачивание `в монаде` — последним шагом разбора и внутри него.
       Место выбрано не для удобства: на выходе парсера обязана лежать
       ПЕРВОПОРЯДКОВАЯ программа из раздела 5 SPEC, и тогда форму бесплатно
       получают все восемь бэкендов, анализ завершаемости и обе реализации
       самоприменения — им не нужно знать о ней ни строчки.

       Признак считается разбором, а не обходом готового AST, — по тому же
       правилу, что `usesIo` выше: программа без блоков обязана не платить за
       форму ни одного лишнего обхода и вернуться ТЕМ ЖЕ объектом. */
    return this.blocksInMonad > 0 ? expandMonads(готово) : готово
  }

  /** Имя из словаря ввода-вывода в тексте — признак того, что словарь нужен. */
  noteIoType(name) {
    if (IO_TYPE_NAMES.has(name)) this.usesIo = true
    return name
  }

  noteIoVariant(name) {
    if (IO_VARIANT_OWNER.has(name)) this.usesIo = true
    return name
  }

  /**
   * Применение функции без аргументов.
   *
   * Единственной формой применения было «Имя» от аргумента, и функцию без
   * параметров вызвать было нечем: её имя в позиции выражения читалось как
   * `var` и упиралось в «имя не связано». Отдельного слова для этого заводить
   * не нужно — имя функции в позиции выражения и означает её применение.
   *
   * С появлением функций-значений (flang/cat/HOF.md) у голого имени появился
   * второй возможный смысл — «сама функция», — и он отдан НЕ ему: значение
   * пишется явно, `функция «Имя»`. Иначе `«Постоянная» плюс 1` в одних
   * программах означало бы вызов, а в других — тег, и разбирался бы этот выбор
   * по типу, которого у парсера нет. Форма из двух слов различает их всегда.
   *
   * Проход отложен до конца файла ровно по одной причине: функция может быть
   * объявлена ниже того места, где вызвана. Локальные имена уже разобраны на
   * своих местах, поэтому затенения здесь быть не может — в `free` попадают
   * только имена, не связанные ничем локальным.
   */
  bindNullaryCalls() {
    if (this.free.length === 0) return
    const declared = new Set(this.functions.map((fn) => fn.name))
    for (const name of this.external) declared.add(name)
    for (const node of this.free) {
      if (!declared.has(node.name)) continue
      /* Узел уже вложен в AST, поэтому переписывается на месте. Поля
         переставляются в порядок обычного `call` — AST разбирается в тот же
         JSON, что и вызов с аргументами, и различить их по форме нельзя. */
      const { name, span } = node
      delete node.name
      delete node.span
      node.kind = "call"
      node.name = name
      node.args = []
      node.span = span
    }
  }

  /** Старая скобочная поверхность ядра: `category X { … }`. */
  looksBraced() {
    for (let ahead = 0; ; ahead += 1) {
      const token = this.peek(ahead)
      if (token.kind === "eof" || token.kind === "newline") return false
      if (token.kind === "punct" && token.value === "{") return true
    }
  }

  parseDeclarations() {
    for (;;) {
      this.skipNewlines()
      if (this.atBlockEnd()) return
      this.parseDeclaration()
    }
  }

  parseDeclaration() {
    const token = this.peek()
    if (token.kind !== "keyword") this.fail(`не разобрана конструкция: неожиданное '${token.value}'`)

    switch (token.value) {
      case "module":
        return this.parseModuleHeader()
      case "exports":
      case "uses":
        return this.parseLooseModuleLine()
      case "category":
        return this.parseCategory()
      case "object":
      case "record":
        return this.types.push(this.parseRecord())
      case "type":
        return this.types.push(this.parseTypeDeclaration())
      case "total":
      case "function":
        return this.functions.push(this.parseFunction())
      case "utility":
        return this.legacy.push(this.parseUtility())
      case "morphism": {
        /* Стрелка и композиция уже уложены в this.morphisms и вернули null;
           утверждение FTS по-прежнему едет в legacy. */
        const узел = this.parseMorphism()
        return узел === null ? undefined : this.legacy.push(узел)
      }
      case "chain":
        return this.parseChain()
      case "identity":
        return this.parseIdentity()
      case "isomorphism":
        return this.isomorphisms.push(this.parseIsomorphism())
      case "bifunctor":
        return this.bifunctors.push(this.parseBifunctor())
      case "monoid":
        return this.monoids.push(this.parseMonoid())
      case "monad":
        return this.monads.push(this.parseMonad())
      case "process":
        return this.processes.push(this.parseProcess())
      case "supervision":
        return this.supervisors.push(this.parseSupervision())
      case "run":
        return this.runs.push(this.parseRun())
      case "plan":
        return this.plans.push(this.parsePlan())
      case "theorem":
        return this.legacy.push(this.parseTheorem())
      case "functor":
        return this.legacy.push(this.parseFunctorFile())
      default:
        return this.fail(`не разобрана конструкция: неожиданное '${token.text ?? token.value}'`)
    }
  }

  parseModuleHeader() {
    const start = this.next()
    const name = this.expectName("ожидалось имя модуля")
    const value = { name, imports: [], exports: null }
    if (this.module === "") this.module = name
    if (this.enterBlock()) {
      while (!this.atBlockEnd()) {
        this.skipNewlines()
        if (this.atBlockEnd()) break
        this.readModuleLine(value)
      }
      this.exitBlock()
    }
    this.legacy.push({ kind: "ftsLegacy", construct: "moduleHeader", value, span: start.span })
  }

  /** `экспортирует`/`использует` без отступа под `модуль` — так тоже пишут. */
  parseLooseModuleLine() {
    const last = [...this.legacy].reverse().find((node) => node.construct === "moduleHeader")
    if (last === undefined) this.fail("не разобрана конструкция: строка заголовка без объявления модуля")
    this.readModuleLine(last.value)
  }

  readModuleLine(value) {
    if (this.eatKw("exports")) {
      const names = [this.expectName("ожидалось экспортируемое имя")]
      while (this.eatPunct(",")) names.push(this.expectName("ожидалось экспортируемое имя"))
      value.exports = [...(value.exports ?? []), ...names]
      this.endLine()
      return
    }
    if (this.eatKw("uses")) {
      const category = this.expectName("ожидалось имя категории")
      this.expectKw("from", "после имени категории ожидалось 'из'")
      const from = this.expectName("ожидался путь")
      /* `только «А», «Б»` — выборочный импорт. Без него модуль вносит все свои
         имена, и достаточно одного совпадения, чтобы связывание отказало:
         именно так лексеру ядра пришлось дублировать четыре функции stdlib
         из-за одной одноимённой. Выбор имён — способ сказать «мне нужна вот
         эта функция», не переименовывая чужой модуль. */
      const entry = { category, from }
      if (this.eatKw("only")) {
        const names = [this.expectName("ожидалось имя, которое нужно импортировать")]
        while (this.eatPunct(",")) names.push(this.expectName("ожидалось имя, которое нужно импортировать"))
        entry.only = names
      }
      value.imports.push(entry)
      this.endLine()
      return
    }
    this.fail("не разобрана конструкция: ожидались 'экспортирует' или 'использует'")
  }

  parseCategory() {
    const start = this.next()
    const name = this.expectName("ожидалось имя категории")
    if (this.module === "") this.module = name
    this.legacy.push({ kind: "ftsLegacy", construct: "category", value: { name }, span: start.span })
    if (this.enterBlock()) {
      this.parseDeclarations()
      this.exitBlock()
    }
  }

  // ── типы ──────────────────────────────────────────────────────────────────

  parseRecord() {
    const start = this.next()
    const name = this.expectName("ожидалось имя объекта")
    const typeParams = this.parseTypeParams()
    const fields = []
    if (this.enterBlock()) {
      while (!this.atBlockEnd()) {
        this.skipNewlines()
        if (this.atBlockEnd()) break
        fields.push(this.parseRecordField())
      }
      this.exitBlock()
    }
    const node = { kind: "record", name, fields, span: start.span }
    if (typeParams.length > 0) node.typeParams = typeParams
    return node
  }

  /**
   * Параметры типа у объявления: `тип «Возможно» от «А»`, `объект «Пара» от
   * «А» и «Б»`, `функция «Обернуть» от «А»`.
   *
   * Новых ключевых слов здесь нет ни одного, и это решение, а не удача. `от`
   * (`of`) и `и` (`and`) уже в таблице — значит ни одно имя в существующих
   * .flang и .fts не перестаёт разбираться. Цену занятого слова репозиторий
   * уже платил: «символы», «группа», «обратный», «на», «начальное», «порог» —
   * каждое стоило переделки конструкции. Здесь платить нечем.
   *
   * Позиция однозначна: после имени объявления `от` сегодня не встречается
   * нигде — там либо `это`, либо конец строки, либо блок. Поэтому старые
   * исходники разбираются ровно как раньше, до последнего байта AST: поле
   * `typeParams` появляется только когда параметры написаны.
   */
  parseTypeParams() {
    if (!this.atKw("of")) return []
    this.next()
    const names = [this.expectName("ожидалось имя параметра типа")]
    while (this.eatKw("and")) names.push(this.expectName("ожидалось имя параметра типа"))
    return names
  }

  /**
   * Аргументы типа при применении: `«Возможно» от числа`, `«Пара» от «А» и «Б»`.
   *
   * Разделитель `и` сталкивается с `и` — разделителем полей варианта
   * (`вариант «В» содержит п: «Пара» от «А» и второе: строка`). Разводится
   * заглядыванием на два токена: `и имя :` начинает новое поле, всё остальное
   * — очередной аргумент типа. Спутать нельзя: за аргументом-типом двоеточие
   * не идёт никогда, а за именем поля идёт всегда.
   */
  parseTypeArguments() {
    const args = [this.parseTypeExpression()]
    while (this.atKw("and") && !this.fieldFollowsAnd()) {
      this.next()
      args.push(this.parseTypeExpression())
    }
    return args
  }

  fieldFollowsAnd() {
    return (this.at("name", 1) || this.at("string", 1)) && this.atPunct(":", 2)
  }

  parseRecordField() {
    if (this.atKw("nested")) {
      const start = this.next()
      const name = this.expectName("ожидалось имя вложенного объекта")
      this.endLine()
      return { name, type: { kind: "named", name }, fts: name, span: start.span }
    }

    const nameToken = this.expectNameToken("ожидалось имя поля")
    let optional = false
    if (this.eatKw("maybeIs")) optional = true
    else if (this.eatKw("is")) optional = false
    else if (this.eatPunct(":")) optional = false
    else this.fail("поле записывается как '«имя» является типом'")

    const { type, fts } = this.parseFieldType()
    this.endLine()
    const field = { name: nameToken.value.normalize("NFC"), type, fts, span: nameToken.span }
    if (optional) {
      field.optional = true
      field.fts = `${fts} | undefined`
    }
    return field
  }

  parseFieldType() {
    if (this.atKw("state")) {
      this.next()
      const name = this.expectName("ожидалось имя состояния")
      return { type: { kind: "named", name, state: true }, fts: name }
    }
    const token = this.peek()
    const type = this.parseTypeExpression()
    const fts =
      token.kind === "keyword" && FTS_TYPE_NAMES[token.value] !== undefined
        ? FTS_TYPE_NAMES[token.value]
        : ftsTypeString(type)
    return { type, fts }
  }

  /**
   * Тип функции: `функция из числа в число`, `функция из числа и строки в
   * признак`, `функция в число` — совсем без аргументов.
   *
   * Новых ключевых слов нет ни одного: `функция`, `из`, `и` и `в` в таблице с
   * первого дня, и ни одно имя в 118 исходниках репозитория от них не
   * страдает — имя в «ёлочках» ключевым словом не становится никогда
   * (`«функция»` встречается в `self/` 173 раза и остаётся именем).
   *
   * Позиция однозначна: `функция` в позиции типа сегодня всегда ошибка разбора
   * («не разобрана конструкция: ожидался тип»), значит ни одна существующая
   * программа этого не заметит.
   *
   * Список аргументов разбирается тем же `parseTypeArguments`, что и аргументы
   * параметрического типа, — с тем же заглядыванием на `и имя :`. Отсюда одна
   * двусмысленность, разрешённая жадностью внутреннего применения:
   * `функция из «Возможно» от числа и строки в признак` отдаёт `и строки`
   * применению «Возможно», а не второму аргументу. Пишется скобками —
   * `функция из («Возможно» от числа) и строки в признак`, — и то же верно для
   * вложенного типа функции: `функция из (функция из числа в число) в число`.
   */
  parseFunctionType() {
    const start = this.next()
    const params = this.eatKw("from") ? this.parseTypeArguments() : []
    if (!this.eatKw("to")) this.fail("у типа «функция» ожидалось 'в' и тип результата", start)
    return { kind: "fn", params, returns: this.parseTypeExpression() }
  }

  parseTypeExpression() {
    let type
    /* Скобки в типе. `«Возможно» от «Возможно» от числа` разбирается и без
       них — применение правоассоциативно, — но читается скобками, и цена им
       ноль: `(` в позиции типа сегодня всегда ошибка разбора, значит ни одна
       существующая программа этого не заметит. */
    if (this.atPunct("(")) {
      this.next()
      type = this.parseTypeExpression()
      this.expectPunct(")")
    } else if (this.atKw("function")) {
      type = this.parseFunctionType()
    } else if (this.atKw("list") || this.atKw("listOf")) {
      this.next()
      type = { kind: "list", of: this.parseTypeExpression() }
    } else if (this.atKw("state")) {
      this.next()
      type = { kind: "named", name: this.expectName("ожидалось имя состояния"), state: true }
    } else if (this.peek().kind === "keyword" && SCALAR_TYPES[this.peek().value] !== undefined) {
      type = { ...SCALAR_TYPES[this.next().value] }
    } else if (this.atName()) {
      /* Две правки, легшие в одно место, и обе нужны целиком.

         `noteIoType` помечает типы ввода-вывода, чтобы проверка плана знала,
         на что смотреть. Применение параметрического типа (`«Возможно» от
         числа`) дописывает `args` только когда аргументы написаны — поэтому
         AST всех существующих программ не меняется ни на байт. */
      type = { kind: "named", name: this.noteIoType(this.expectName("ожидался тип")) }
      if (this.atKw("of")) {
        this.next()
        type.args = this.parseTypeArguments()
      }
    } else {
      this.fail("не разобрана конструкция: ожидался тип")
    }

    /*
     * Стрелочная запись того же типа функции: `число → строка`. Форма была в
     * SPEC с первого дня, и узел у неё СВОЙ — `{ from, to }`, — хотя словесная
     * запись даёт `{ params, returns }`.
     *
     * Два узла на один тип — долг, и он назван. Убрать его пытались: узлы
     * сведены к одному, и `flang/test/self-parser.test.mjs` покраснел на
     * краевом случае `«ф»: число → строка`, потому что AST сверяется побайтово
     * с тем, что строит `self/parser.flang`, а тот новой формы не знает.
     * Трогать `self/` в этой фазе нельзя (flang/cat/HOF.md, «Граница фазы»),
     * значит и AST стрелки менять нельзя.
     *
     * Наружу долг не течёт: `normalizeType` в `types.mjs` принимает обе записи
     * и даёт один тип, поэтому сравнение, печать и подстановка про две формы
     * не знают. Сводятся узлы в фазе самоприменения, вместе с `self/parser.flang`.
     */
    if (this.at("arrow")) {
      this.next()
      return { kind: "fn", from: type, to: this.parseTypeExpression() }
    }
    return type
  }

  /** `тип «Токен» вариант …` — сумма; `тип «X» это список «Y»` — псевдоним. */
  parseTypeDeclaration() {
    const start = this.next()
    const name = this.expectName("ожидалось имя типа")
    const typeParams = this.parseTypeParams()

    if (this.atKw("alias") || this.atKw("is") || this.atPunct("=")) {
      this.next()
      const of = this.parseTypeExpression()
      this.endLine()
      const alias = { kind: "alias", name, of, span: start.span }
      if (typeParams.length > 0) alias.typeParams = typeParams
      return alias
    }

    const variants = []
    if (this.enterBlock()) {
      while (!this.atBlockEnd()) {
        this.skipNewlines()
        if (this.atBlockEnd()) break
        variants.push(this.parseVariantDeclaration())
      }
      this.exitBlock()
    }
    if (variants.length === 0) this.fail("не разобрана конструкция: тип без вариантов и без 'это'", start)
    const node = { kind: "sum", name, variants, span: start.span }
    if (typeParams.length > 0) node.typeParams = typeParams
    return node
  }

  parseVariantDeclaration() {
    const start = this.expectKw("variant", "ожидалось слово 'вариант'")
    const name = this.expectName("ожидалось имя варианта")
    const fields = []
    if (this.eatKw("contains") || this.eatKw("with")) {
      do {
        const fieldName = this.expectName("ожидалось имя поля варианта")
        this.expectPunct(":")
        fields.push({ name: fieldName, type: this.parseTypeExpression() })
      } while (this.eatPunct(",") || this.eatKw("and"))
    }
    this.endLine()
    return { name, fields, span: start.span }
  }

  // ── функции ───────────────────────────────────────────────────────────────

  parseFunction() {
    const start = this.peek()
    const total = this.eatKw("total")
    this.expectKw("function", "ожидалось слово 'функция'")
    const name = this.expectName("ожидалось имя функции")
    /* Параметры типа объявляются явно — `функция «Обернуть» от «А»`, — а не
       выводятся из сигнатуры. Неявное правило «незнакомое имя типа считается
       параметром» превращало бы опечатку в имени типа в молчаливо принятую
       программу: `возвращает «Возможо»` перестало бы быть ошибкой. */
    const typeParams = this.parseTypeParams()

    const params = []
    const examples = []
    let returns = null
    let body = null

    this.pushScope([])
    if (this.enterBlock()) {
      while (!this.atBlockEnd()) {
        this.skipNewlines()
        if (this.atBlockEnd()) break
        if (this.atKw("accepts")) {
          this.next()
          do {
            const parameter = this.parseParameter()
            params.push(parameter)
            this.bind(parameter.name)
          } while (this.eatPunct(","))
          this.endLine()
          continue
        }
        if (this.atKw("returns")) {
          this.next()
          returns = this.parseTypeExpression()
          this.endLine()
          continue
        }
        if (this.atKw("example")) {
          examples.push(this.parseExample())
          continue
        }
        if (body !== null) this.fail("не разобрана конструкция: у функции больше одного тела")
        body = this.parseStatements()
      }
      this.exitBlock()
    }
    this.popScope()

    if (body === null) this.fail(`функция «${name}» не содержит тела`, start)
    const node = { name, total, params, returns, body, examples }
    if (typeParams.length > 0) node.typeParams = typeParams
    node.span = start.span
    return node
  }

  parseParameter() {
    const nameToken = this.expectNameToken("ожидалось имя параметра")
    if (this.eatPunct(":") || this.eatKw("is")) {
      return { name: nameToken.value.normalize("NFC"), type: this.parseTypeExpression(), span: nameToken.span }
    }
    /* `принимает Покупка` — форма утилиты FTS: имя объекта вместо пары
       «имя: тип». Тип известен, имя параметра совпадает с именем записи. */
    return {
      name: nameToken.value.normalize("NFC"),
      type: { kind: "named", name: nameToken.value.normalize("NFC") },
      span: nameToken.span,
    }
  }

  parseExample() {
    const start = this.next()
    const name = this.expectName("ожидалось имя примера")
    const args = {}
    let expected
    let hasExpected = false

    if (this.enterBlock()) {
      while (!this.atBlockEnd()) {
        this.skipNewlines()
        if (this.atBlockEnd()) break
        if (this.eatKw("given")) {
          const field = this.expectName("ожидалось имя аргумента")
          this.expectComparison("cmpEq", "аргумент примера задаётся как 'дано имя равно значению'")
          args[field] = this.parseLiteralValue()
          this.endLine()
          continue
        }
        if (this.eatKw("expected")) {
          this.eatKw("result")
          this.eatAnyComparison()
          expected = this.parseLiteralValue()
          hasExpected = true
          this.endLine()
          continue
        }
        this.fail("не разобрана конструкция: в примере ожидаются 'дано' или 'ожидается'")
      }
      this.exitBlock()
    }
    if (!hasExpected) this.fail(`пример «${name}» требует строку 'ожидается'`, start)
    return { name, args, expected, span: start.span }
  }

  expectComparison(id, message) {
    if (!this.atKw(id)) this.fail(message)
    return this.next()
  }

  eatAnyComparison() {
    if (this.peek().kind === "keyword" && COMPARISONS[this.peek().value] !== undefined) return this.next()
    return null
  }

  /** Значение примера: только литералы — примеры не вычисляются парсером. */
  parseLiteralValue() {
    const token = this.peek()
    const expression = this.parseExpression()
    return literalValue(expression, () => this.fail("не разобрана конструкция: ожидалось литеральное значение", token))
  }

  // ── выражения ─────────────────────────────────────────────────────────────

  /**
   * Последовательность строк блока: `пусть` связывает и вкладывает остаток
   * блока в своё `in`, последняя строка — результат.
   */
  parseStatements() {
    if (this.atKw("let")) {
      const start = this.next()
      const name = this.expectName("ожидалось имя связывания")
      if (!this.eatKw("cmpEq") && !this.eatKw("is") && !this.eatPunct("=")) {
        this.fail("после имени в 'пусть' ожидалось 'равно'")
      }
      /* Значение считается до связывания: `пусть x равно x` — не рекурсия. */
      const value = this.parseExpression()
      this.endLine()
      this.skipNewlines()
      if (this.atBlockEnd()) this.fail("не разобрана конструкция: после 'пусть' нужна строка-результат")
      this.pushScope([name])
      const inner = this.parseStatements()
      this.popScope()
      return { kind: "let", name, value, in: inner, span: start.span }
    }
    const expression = this.parseExpression()
    this.endLine()
    return expression
  }

  parseExpression() {
    const token = this.peek()
    if (token.kind === "keyword") {
      if (NOT_EXPRESSION.has(token.value)) this.fail(`не разобрана конструкция: '${token.text}' не начинает выражение`)
      if (token.value === "if") return this.parseIf()
      if (token.value === "match") return this.parseMatch()
      if (token.value === "map") return this.parseMap()
      if (token.value === "filter") return this.parseFilter()
      if (token.value === "fold") return this.parseFold()
      if (token.value === "let") return this.parseStatements()
      if (token.value === "inMonad") return this.parseInMonad()
    }
    return this.parseComparison()
  }

  parseIf() {
    const start = this.next()
    const cond = this.parseComparison()
    let then
    let alternative

    if (this.eatKw("then")) {
      then = this.parseBranchBody()
      this.skipNewlines()
      this.expectKw("else", "у 'если' нет ветки 'иначе'")
      alternative = this.parseBranchBody()
    } else {
      if (!this.enterBlock()) this.fail("у 'если' нет ветки 'то'")
      this.skipNewlines()
      this.expectKw("then", "у 'если' нет ветки 'то'")
      then = this.parseBranchBody()
      this.skipNewlines()
      this.expectKw("else", "у 'если' нет ветки 'иначе'")
      alternative = this.parseBranchBody()
      this.exitBlock()
    }
    return { kind: "if", cond, then, else: alternative, span: start.span }
  }

  /** Тело ветки: на той же строке или отступным блоком ниже. */
  parseBranchBody() {
    if (this.at("newline") && this.at("indent", 1)) {
      this.next()
      this.next()
      const body = this.parseStatements()
      this.exitBlock()
      return body
    }
    const body = this.parseExpression()
    this.endLine()
    return body
  }

  parseMatch() {
    const start = this.next()
    const target = this.parseComparison()
    const cases = []
    if (!this.enterBlock()) this.fail("у 'разбор' нет ни одного 'случай'")
    while (!this.atBlockEnd()) {
      this.skipNewlines()
      if (this.atBlockEnd()) break
      const caseStart = this.expectKw("case", "не разобрана конструкция: ожидалось 'случай'")
      const pattern = this.parsePattern()
      let body
      this.pushScope(this.patternBindings(pattern))
      if (this.eatKw("then")) {
        body = this.parseBranchBody()
      } else if (this.enterBlock()) {
        this.skipNewlines()
        this.eatKw("then")
        body = this.parseStatements()
        this.exitBlock()
      } else {
        this.fail("у 'случай' нет тела 'то'", caseStart)
      }
      this.popScope()
      cases.push({ pattern, body })
    }
    this.exitBlock()
    if (cases.length === 0) this.fail("у 'разбор' нет ни одного 'случай'", start)
    return { kind: "match", target, cases, span: start.span }
  }

  parsePattern() {
    const token = this.peek()

    if (this.atKw("empty")) {
      this.next()
      return { kind: "empty" }
    }
    if (this.atKw("headTail")) {
      const words = this.next().text.split(" ")
      return { kind: "cons", head: words[0], tail: words[words.length - 1] }
    }
    if (this.atKw("head")) {
      this.next()
      const head = this.expectName("ожидалось имя головы")
      this.expectKw("and", "между головой и хвостом ожидалось 'и'")
      this.expectKw("tail", "ожидалось слово 'хвост'")
      const tail = this.expectName("ожидалось имя хвоста")
      return { kind: "cons", head, tail }
    }
    if (this.atKw("any")) {
      this.next()
      const pattern = { kind: "any" }
      if (this.atName()) pattern.bind = this.expectName()
      return pattern
    }
    if (this.atKw("variant")) {
      this.next()
      const name = this.noteIoVariant(this.expectName("ожидалось имя варианта"))
      return { kind: "variant", name, bind: this.parsePatternBind() }
    }
    if (this.at("number") || this.at("string")) {
      const value = this.next()
      return { kind: "literal", value: value.value }
    }
    if (this.atKw("litTrue") || this.atKw("litFalse") || this.atKw("litNull")) {
      return { kind: "literal", value: literalOfKeyword(this.next().value) }
    }
    if (this.at("name")) {
      const name = this.expectName()
      /* Имя с прописной — вариант суммы, со строчной — связывание `любое`.
         Так же различает имена сам FTS: типы пишутся с прописной. */
      if (/^\p{Lu}/u.test(name)) {
        return { kind: "variant", name: this.noteIoVariant(name), bind: this.parsePatternBind() }
      }
      return { kind: "any", bind: name }
    }
    return this.fail("не разобрана конструкция: ожидался образец", token)
  }

  parsePatternBind() {
    const bind = {}
    if (!this.atKw("with") && !this.atKw("contains")) return bind
    this.next()
    do {
      const field = this.expectName("ожидалось имя поля варианта")
      this.expectKw("as", "после имени поля ожидалось 'как'")
      bind[field] = this.expectName("ожидалось имя связывания")
    } while (this.eatKw("and") || this.eatPunct(","))
    return bind
  }

  parseMap() {
    const start = this.next()
    const over = this.parseComparison()
    this.expectKw("as", "у 'отобразить' ожидалось 'как имя'")
    const item = this.expectName("ожидалось имя элемента")
    return { kind: "map", over, item, body: this.parseScopedBody([item]), span: start.span }
  }

  parseFilter() {
    const start = this.next()
    const over = this.parseComparison()
    this.expectKw("where", "у 'отфильтровать' ожидалось 'где имя'")
    const item = this.expectName("ожидалось имя элемента")
    return { kind: "filter", over, item, body: this.parseScopedBody([item]), span: start.span }
  }

  parseFold() {
    const start = this.next()
    const over = this.parseComparison()
    this.expectKw("startingWith", "у 'свёртка' ожидалось 'начиная с'")
    const init = this.parseComparison()
    this.expectKw("as", "у 'свёртка' ожидалось 'как накопитель и элемент'")
    const acc = this.expectName("ожидалось имя накопителя")
    this.expectKw("and", "между накопителем и элементом ожидалось 'и'")
    const item = this.expectName("ожидалось имя элемента")
    return { kind: "fold", over, init, acc, item, body: this.parseScopedBody([acc, item]), span: start.span }
  }

  parseScopedBody(names) {
    this.pushScope(names)
    const body = this.parseLambdaBody()
    this.popScope()
    return body
  }

  /** Тело встроенной формы: после `→`/`:` на строке либо отступным блоком. */
  parseLambdaBody() {
    if (this.at("arrow") || this.atPunct(":")) {
      this.next()
      return this.parseExpression()
    }
    if (this.enterBlock()) {
      const body = this.parseStatements()
      this.exitBlock()
      return body
    }
    return this.fail("не разобрана конструкция: у встроенной формы нет тела")
  }

  parseComparison() {
    const left = this.parseAdditive()
    const token = this.peek()
    if (token.kind === "keyword" && COMPARISONS[token.value] !== undefined) {
      this.next()
      return { kind: "binary", op: COMPARISONS[token.value], left, right: this.parseAdditive(), span: token.span }
    }
    if (this.atKw("contains")) {
      this.next()
      return { kind: "builtin", name: "содержит", args: [left, this.parseAdditive()], span: token.span }
    }
    if (this.atKw("beginsWith")) {
      this.next()
      return { kind: "builtin", name: "начинается с", args: [left, this.parseAdditive()], span: token.span }
    }
    return left
  }

  parseAdditive() {
    let left = this.parseMultiplicative()
    while (this.atKw("opAdd") || this.atKw("opSub")) {
      const token = this.next()
      left = { kind: "binary", op: BINARY_OPS[token.value], left, right: this.parseMultiplicative(), span: token.span }
    }
    return left
  }

  parseMultiplicative() {
    let left = this.parsePostfix()
    for (;;) {
      if (this.atKw("opMul") || this.atKw("opDiv") || this.atKw("opMod")) {
        const token = this.next()
        left = { kind: "binary", op: BINARY_OPS[token.value], left, right: this.parsePostfix(), span: token.span }
        continue
      }
      if (this.atKw("opPercent")) {
        const token = this.next()
        /* `10 процентов от поля сумма` — `от` и `поле` здесь служебные. */
        this.eatKw("of")
        this.eatKw("field")
        left = { kind: "binary", op: "percent", left, right: this.parsePostfix(), span: token.span }
        continue
      }
      return left
    }
  }

  parsePostfix() {
    let expression = this.parsePrimary()
    for (;;) {
      if (this.atPunct(".")) {
        const token = this.next()
        /* Имя поля записи — часть контракта, поэтому берётся точно как в тексте. */
        const target = this.resolved(expression)
        expression = { kind: "field", target, field: this.expectName("ожидалось имя поля"), span: token.span }
        continue
      }
      if (this.atKw("of")) {
        const token = this.next()
        /* Применение значения-функции — то же слово `от`, что и у вызова по
           имени, и различает их ПОЗИЦИЯ, ровно как в полиморфизме `от` в типе
           и `от` в выражении. Слева от `от` стоит либо имя функции (оно не
           связано ничем локальным и пишется с прописной), либо значение —
           связанное имя, поле записи, результат другого применения. Первое —
           вызов, второе — применение. Спутать нельзя: имя функции локальным
           связыванием не бывает, иначе оно затенило бы вызов уже сегодня. */
        const value = this.appliedValue(expression)
        if (value !== null) {
          const args = [this.parsePostfix()]
          while (this.eatKw("and")) args.push(this.parsePostfix())
          expression = { kind: "apply", fn: value, args, span: expression.span ?? token.span }
          continue
        }
        /* `"Длина" от хвоста`: в обычных кавычках ядро FTS пишет имена, поэтому
           перед `от` строка читается как имя функции, а не как данные.

           Текст отказа не меняется ни на букву: он сверяется дословно с тем,
           что говорит `self/parser.flang` (`flang/test/self-parser.test.mjs`),
           а `self/` в этой фазе не трогается. Правда от этого не страдает — сюда
           доходят только литералы, а литерал и правда не функция. */
        const name =
          expression.kind === "var"
            ? expression.name
            : expression.kind === "literal" && typeof expression.value === "string"
              ? expression.value
              : this.fail("применять можно только именованную функцию", token)
        const args = [this.parsePostfix()]
        while (this.eatKw("and")) args.push(this.parsePostfix())
        expression = { kind: "call", name, args, span: expression.span ?? token.span }
        continue
      }
      return this.resolved(expression)
    }
  }

  parsePrimary() {
    const token = this.peek()

    if (token.kind === "number") {
      this.next()
      return { kind: "literal", value: token.value, span: token.span }
    }
    if (token.kind === "string") {
      this.next()
      return { kind: "literal", value: token.value, span: token.span }
    }
    if (token.kind === "name") {
      this.next()
      if (this.looksLikeConstruct()) {
        return {
          kind: "construct",
          variant: this.noteIoVariant(token.value),
          fields: this.parseFieldAssignments(),
          span: token.span,
        }
      }
      return this.localVar(token.value, token.span)
    }
    if (this.atPunct("(")) {
      this.next()
      const inner = this.parseExpression()
      this.expectPunct(")")
      return inner
    }
    if (this.atPunct("[")) {
      const start = this.next()
      const items = []
      while (!this.atPunct("]")) {
        this.skipNewlines()
        if (this.atPunct("]")) break
        items.push(this.parseExpression())
        /* Разделитель — запятая или `и`, как у `список из a, b и c`: одна и та
           же мысль записывается одинаково в обеих формах списка. Запятая до
           сюда доходит ВСЕГДА: полям конструктора она больше не принадлежит
           (`parseFieldAssignments`). `и` — только тогда, когда выражение
           элемента уже остановилось: внутренние формы (аргументы вызова, поля
           конструктора) съедают его раньше, и это правило «внутренний уровень
           первым» единственное, каким `и` и разводится. */
        if (!this.eatPunct(",") && !this.eatKw("and")) this.skipNewlines()
      }
      this.expectPunct("]")
      return { kind: "list", items, span: start.span }
    }

    if (token.kind !== "keyword") return this.fail(`не разобрана конструкция: неожиданное '${token.value}'`)

    switch (token.value) {
      case "litTrue":
      case "litFalse":
      case "litNull":
        this.next()
        return { kind: "literal", value: literalOfKeyword(token.value), span: token.span }
      case "empty": {
        this.next()
        /* «пусто» — два разных слова в одной поверхности: образец/литерал
           пустого списка и встроенная проверка пустоты. Различаем ровно так
           же, как одноместные формы вроде «длина» (parseUnaryBuiltin): есть
           аргумент — форма, нет аргумента — значение. Без этого проверка
           пустоты была недостижима, и её приходилось писать как
           «(длина x) равен 0». Однозначное «пустой список» не трогаем: оно
           всегда значение, чем бы за ним ни следовало. */
        if (!this.startsExpression()) return { kind: "list", items: [], span: token.span }
        return { kind: "builtin", name: "пусто", args: [this.parsePostfix()], span: token.span }
      }
      case "emptyList":
        this.next()
        return { kind: "list", items: [], span: token.span }
      case "listOf": {
        this.next()
        const items = [this.parseAdditive()]
        while (this.eatPunct(",") || this.eatKw("and")) items.push(this.parseAdditive())
        return { kind: "list", items, span: token.span }
      }
      case "length":
        return this.parseUnaryBuiltin("длина")
      case "head":
        return this.parseUnaryBuiltin("голова")
      case "tail":
        return this.parseUnaryBuiltin("хвост")
      case "toNumber":
        return this.parseUnaryBuiltin("к числу")
      case "toNumberOrFail": {
        /* Не через parseUnaryBuiltin: у той формы «нет аргумента» значит «это
           имя переменной», а фразой из четырёх слов переменную не назвать —
           значит одинокая фраза это опечатка, и молчать о ней нельзя. */
        const начало = this.next()
        if (!this.startsExpression()) this.fail("у 'к числу или беда' ожидался аргумент")
        this.usesOutcome = true
        return { kind: "builtin", name: "к числу или беда", args: [this.parsePostfix()], span: начало.span }
      }
      case "toText":
        return this.parseUnaryBuiltin("к строке")
      case "char": {
        this.next()
        const position = this.parsePostfix()
        this.expectKw("to", "у 'символ' ожидалось 'в строке'")
        return { kind: "builtin", name: "символ", args: [position, this.parsePostfix()], span: token.span }
      }
      /* Порядок аргументов и предлог — как у «символ»: сначала номер, потом
         то, из чего берём. Одно понятие — один оборот, и разойтись им негде,
         потому что и здесь, и там дальше идёт `expectKw("to")`. */
      case "item": {
        this.next()
        const position = this.parsePostfix()
        this.expectKw("to", "у 'элемент' ожидалось 'в списке'")
        return { kind: "builtin", name: "элемент", args: [position, this.parsePostfix()], span: token.span }
      }
      case "decompose": {
        this.next()
        const text = this.parsePostfix()
        this.expectKw("intoCharacters", "у 'разложить' ожидалось 'на символы'")
        return { kind: "builtin", name: "символы", args: [text], span: token.span }
      }
      case "substring": {
        this.next()
        const text = this.parsePostfix()
        if (!this.eatKw("with") && !this.eatKw("from")) this.fail("у 'подстрока' ожидалось 'с'")
        const from = this.parsePostfix()
        if (!this.eatKw("by") && !this.eatKw("to")) this.fail("у 'подстрока' ожидалось 'по'")
        return { kind: "builtin", name: "подстрока", args: [text, from, this.parsePostfix()], span: token.span }
      }
      case "join": {
        this.next()
        const left = this.parsePostfix()
        /* Две формы, как в `builtins.mjs`. «соединить X с Y» — склейка двух
           строк (узел binary/concat). «соединить части по разделитель» —
           списочная форма; предлог тот же, что у обратной операции
           «разделить текст по разделитель», поэтому пара читается как пара.
           До появления «по» списочная форма существовала в трёх исполнителях
           сразу, но пути к ней из грамматики не было. */
        if (this.eatKw("by")) {
          return { kind: "builtin", name: "соединить", args: [left, this.parsePostfix()], span: token.span }
        }
        if (!this.eatKw("with") && !this.eatKw("to")) this.fail("у 'соединить' ожидалось 'с' или 'по'")
        return { kind: "binary", op: "concat", left, right: this.parsePostfix(), span: token.span }
      }
      case "split": {
        this.next()
        const text = this.parsePostfix()
        if (!this.eatKw("by") && !this.eatKw("with")) this.fail("у 'разделить' ожидалось 'по'")
        return { kind: "builtin", name: "разделить", args: [text, this.parsePostfix()], span: token.span }
      }
      case "add": {
        this.next()
        const item = this.parsePostfix()
        this.expectKw("to", "у 'добавить' ожидалось 'к'")
        return { kind: "builtin", name: "добавить", args: [item, this.parsePostfix()], span: token.span }
      }
      /* Значение-функция: `функция «Удвоить»`. Слово то же, что у объявления и
         у типа, и это не экономия, а параллель — `вариант «Есть» с …` и
         `запись «Точка» с …` называют вид значения тем же словом, каким этот
         вид объявлен. Голое `«Удвоить»` значением стать не могло: имя функции в
         позиции выражения уже занято вызовом без аргументов
         (см. `bindNullaryCalls`), и отнять это значило бы сломать написанное. */
      case "function": {
        this.next()
        return { kind: "fnref", name: this.expectName("ожидалось имя функции"), span: token.span }
      }
      case "variant": {
        this.next()
        const name = this.noteIoVariant(this.expectName("ожидалось имя варианта"))
        return { kind: "construct", variant: name, fields: this.parseFieldAssignments(), span: token.span }
      }
      case "record": {
        this.next()
        const name = this.expectName("ожидалось имя записи")
        return { kind: "record", type: name, fields: this.parseFieldAssignments(), span: token.span }
      }
      case "field": {
        this.next()
        const name = this.expectName("ожидалось имя поля")
        if (this.eatKw("at") || this.eatKw("from")) {
          return { kind: "field", target: this.parsePostfix(), field: name, span: token.span }
        }
        return this.localVar(name, token.span)
      }
      case "result":
        this.next()
        return { kind: "var", name: "результат", span: token.span }
      case "if":
      case "match":
      case "map":
      case "filter":
      case "fold":
      case "let":
        return this.parseExpression()
      default:
        /* Названия типов — самые частые имена полей («число», «дата», «деньги»),
           а `total` — самое естественное имя накопителя свёртки по-английски.
           В позиции выражения такие слова читаются как имена, а не как ключевые. */
        if (SOFT_NAMES.has(token.value)) {
          this.next()
          return this.localVar(token.text, token.span)
        }
        return this.fail(`не разобрана конструкция: неожиданное '${token.text}'`)
    }
  }

  /**
   * Одноместная встроенная форма. Если аргумента нет, слово читается как имя:
   * образец `голова и хвост` связывает именно `голова` и `хвост`, и тело случая
   * обязано иметь право на них сослаться.
   */
  parseUnaryBuiltin(name) {
    const token = this.next()
    if (!this.startsExpression()) return this.localVar(token.text, token.span)
    return { kind: "builtin", name, args: [this.parsePostfix()], span: token.span }
  }

  /** Узел `var`, который ещё предстоит связать с локальным именем. */
  localVar(name, span) {
    const node = { kind: "var", name, span }
    this.pending.add(node)
    return node
  }

  startsExpression() {
    const token = this.peek()
    if (token.kind === "number" || token.kind === "string" || token.kind === "name") return true
    if (token.kind === "punct") return token.value === "(" || token.value === "["
    if (token.kind !== "keyword") return false
    return EXPRESSION_START.has(token.value) || SOFT_NAMES.has(token.value)
  }

  /** `Слово с текст равным …` — конструктор; `соединить a с b` — нет. */
  looksLikeConstruct() {
    if (!this.atKw("with")) return false
    return (this.at("name", 1) || this.at("string", 1)) && this.atKw("cmpEq", 2)
  }

  /**
   * Присвоения полей конструктора: `с имя равным "а" и год равным 2026`.
   *
   * Поля продолжает ТОЛЬКО `и`. Запятая их закрывает всегда и принадлежит тому,
   * кто нас позвал, — списочному литералу.
   *
   * Так не было. Запятая разделяла и поля конструктора, и элементы списка, и
   * `[вариант «М» с а равным 1, б равен 2]` читалось двояко: один конструктор с
   * полями `а` и `б` — или два элемента, конструктор и сравнение `б равен 2`.
   * Обе записи законны, обе встречаются, а `равным` и `равен` — один токен
   * `cmpEq`, так что различить их нечем. Разбор выбирал первое чтение по
   * догадке (заглядыванию на два токена) и второе не давал написать вовсе.
   *
   * Догадка убрана разделением: у запятой остался один смысл — списочный.
   * Оба чтения теперь записываются, и ни одно не требуется угадывать:
   *
   * ```
   * [вариант «М» с а равным 1 и б равным 2]   один элемент, два поля
   * [вариант «М» с а равным 1, б равен 2]     два элемента: он и сравнение
   * ```
   *
   * Цена измерена разбором всех 149 программ репозитория до и после — 91 на
   * flang и 58 на поверхности FTS, которую читает этот же разборщик: запятая
   * продолжала поля в СЕМИ местах двух файлов
   * (`flang/examples/web/orders-api.flang`, `flang/stdlib/dictionary.flang`),
   * и все семь переписаны на `и` в том же коммите. Внутри списочного литерала
   * таких мест не было ни одного — значит ни одна программа не сменила смысл
   * молча: где запятую больше не съедают поля, там её некому съесть, и старый
   * текст отказывает вслух. После переписи деревья всех 149 совпадают узел в
   * узел, расходятся только колонки мест.
   *
   * Отвергнутое стоило дороже: обязательные скобки вокруг конструктора-элемента
   * — 62 места в 9 файлах (ещё 440 таких элементов уже в скобках), отдельный
   * знак между полями — 1665 конструкторов в 45 файлах, разбор по объявленным
   * именам полей — ноль правок, но неоднозначность он не снимает, а заменяет
   * одну догадку другой и ставит разбор файла в зависимость от подключений.
   *
   * За `и` остаётся взгляд на два токена: он же разделяет аргументы вызова
   * (`«Ф» от вариант «М» с а равным 1 и х`), и там продолжением полей он не
   * является. Поля выигрывают, только если дальше и правда `имя равным`.
   */
  parseFieldAssignments() {
    const fields = {}
    if (!this.eatKw("with") && !this.eatKw("contains")) return fields
    for (;;) {
      const name = this.expectName("ожидалось имя поля")
      this.expectKw("cmpEq", "после имени поля ожидалось 'равным'")
      fields[name] = this.parseAdditive()
      if (!this.atFieldSeparator()) return fields
      this.next()
    }
  }

  /** `и`, за которым и правда ещё одно присвоение поля: `… равным`. */
  atFieldSeparator() {
    if (!this.atKw("and")) return false
    return this.atKw("cmpEq", 2)
  }

  // ── конкурентность: процесс, надзор, прогон ───────────────────────────────

  /**
   * Процесс — объявление, а не значение.
   *
   * ```
   * процесс «Счётчик»
   *   состояние «Счёт»
   *   начинает с «пустой счёт»
   *   принимает «Команда счёта»
   *   обрабатывает «шаг счёта» с запасом 100000 витков
   * ```
   *
   * Три из пяти слов уже были в языке: `состояние` (оно же в «является
   * состоянием «X»»), `начинает с` (начальное значение утилиты FTS) и
   * `принимает` (параметры функции). Это не экономия ради экономии: каждое
   * новое ключевое слово запрещает одноимённую переменную во всех файлах
   * репозитория, и цену этому уже платили — см. комментарий про «символы» в
   * `lexer.mjs`. Контрактное «начальное» как раз и не заводится потому, что
   * такая переменная в репозитории есть.
   */
  parseProcess() {
    const start = this.next()
    const name = this.expectName("ожидалось имя процесса")
    const node = {
      kind: "process",
      name,
      state: null,
      initial: null,
      accepts: null,
      handler: null,
      budget: null,
      span: start.span,
    }

    if (this.enterBlock()) {
      while (!this.atBlockEnd()) {
        this.skipNewlines()
        if (this.atBlockEnd()) break
        if (this.eatKw("state")) {
          node.state = this.expectName("ожидался тип состояния процесса")
          this.endLine()
          continue
        }
        if (this.eatKw("startsWith")) {
          node.initial = this.expectName("ожидалось имя начального состояния")
          this.endLine()
          continue
        }
        if (this.eatKw("accepts")) {
          node.accepts = this.expectName("ожидался тип сообщения процесса")
          this.endLine()
          continue
        }
        if (this.eatKw("handles")) {
          node.handler = this.expectName("ожидалось имя обработчика")
          if (this.eatKw("budget")) {
            node.budget = this.expectNumber("после 'с запасом' ожидалось число витков")
            this.skipFillerWords()
          }
          this.endLine()
          continue
        }
        this.fail(
          "не разобрана конструкция: в процессе ожидаются 'состояние', 'начинает с', 'принимает' или 'обрабатывает'",
        )
      }
      this.exitBlock()
    }

    for (const [поле, слово] of [
      ["state", "состояние"],
      ["initial", "начинает с"],
      ["accepts", "принимает"],
      ["handler", "обрабатывает"],
    ]) {
      if (node[поле] === null) this.fail(`процесс «${name}» требует строку '${слово}'`, start)
    }
    return node
  }

  /**
   * Надзор объявляется данными, а не кодом.
   *
   * ```
   * надзор «Приём заказов»
   *   процесс «Счётчик» стратегия «перезапустить»
   *   надзор «Отгрузка» стратегия «перезапустить»
   *   порог отказов 3 за 5000 миллисекунд иначе «передать выше»
   * ```
   *
   * Стратегия пишется в ёлочках, а не словом: ключевое слово «остановить»
   * столкнулось бы с действием «остановить», а «передать выше» пришлось бы
   * занимать двумя словами ради одной строки объявления.
   *
   * Строка `надзор «X» стратегия «…»` внутри надзора — то, без чего стратегия
   * «передать выше» не имеет смысла: передавать некому, пока надзор плоский.
   * Новых слов она не занимает вовсе — `надзор` и `стратегия` уже ключевые, —
   * и повторяет устройство OTP: супервизор надзирает за супервизорами, и
   * перезапуск такого ребёнка перезапускает всё его поддерево.
   */
  /**
   * Моноид: носитель, операция, единица — и необязательное обращение.
   *
   * Группы отдельной конструкцией нет намеренно. Группа — это моноид, у
   * которого есть обращение, и заводить для неё второе слово значило бы
   * развести две проверки, которые обязаны совпадать во всём, кроме одного
   * закона. Здесь `обратный элемент` просто добавляет закон обратимости к
   * уже проверяемым ассоциативности и нейтральности.
   *
   * Законы писать не нужно: их знает сам вид конструкции. Это и есть довод в
   * пользу отдельного объявления вместо трёх функций с примерами — объявив
   * моноид, автор получает проверку, о которой не просил отдельно и о которой
   * легко забыть.
   */
  parseMonoid() {
    const start = this.next()
    const name = this.expectName("ожидалось имя моноида")
    const node = { kind: "monoid", name, carrier: null, operation: null, unit: null, inverse: null, span: start.span }
    this.endLine()

    if (this.enterBlock()) {
      while (!this.atBlockEnd()) {
        this.skipNewlines()
        if (this.atBlockEnd()) break
        if (this.atKw("carrier")) {
          const at = this.next()
          if (node.carrier !== null) this.fail(`у моноида «${name}» больше одного носителя`, at)
          node.carrier = this.parseTypeExpression()
          this.endLine()
          continue
        }
        if (this.atKw("operation")) {
          const at = this.next()
          if (node.operation !== null) this.fail(`у моноида «${name}» больше одной операции`, at)
          node.operation = this.expectName("ожидалось имя функции-операции")
          this.endLine()
          continue
        }
        if (this.atKw("identity")) {
          const at = this.next()
          if (node.unit !== null) this.fail(`у моноида «${name}» больше одной единицы`, at)
          node.unit = this.parseExpression()
          this.endLine()
          continue
        }
        if (this.atKw("inverseElement")) {
          const at = this.next()
          if (node.inverse !== null) this.fail(`у моноида «${name}» больше одного обращения`, at)
          node.inverse = this.expectName("ожидалось имя функции обращения")
          this.endLine()
          continue
        }
        this.fail("не разобрана конструкция: в моноиде ожидаются 'носитель', 'операция', 'единица' или 'обратный элемент'")
      }
      this.exitBlock()
    }

    /* Без любой из трёх частей это не моноид, и молчать об этом нельзя:
       объявление, которое ничего не обещает, хуже отсутствующего. */
    for (const [часть, значение] of [["носитель", node.carrier], ["операция", node.operation], ["единица", node.unit]]) {
      if (значение === null) this.fail(`у моноида «${name}» не указан(а) ${часть}`, start)
    }
    return node
  }

  /**
   * Монада: тип, параметр, по которому она монада, и две функции.
   *
   * ```
   * монада «Возможно» от «А»
   *   возврат «Обернуть»
   *   соединение «Сплющить»
   * ```
   *
   * Имя монады — это имя ТИПА, а не отдельное имя, как у моноида. Довод не в
   * экономии строки: `в монаде «Возможно»` обязано однозначно называть, по
   * какому типу связывать, и совпадение имён делает это очевидным без второй
   * строки `эндофунктор «Возможно»`, которая стояла в контракте и повторяла бы
   * имя строкой выше. Цена названа честно: два разных монадических устройства
   * на одном типе объявить нельзя. Такого в репозитории нет, а понадобится —
   * добавится строкой `носитель`, не ломая написанного.
   *
   * `от «А»` обязательно и при одном параметре. Угадывать «единственный
   * параметр и есть тот самый» дешевле на один токен, но `«Результат» от
   * «Значение» и «Беда»` — монада по ПЕРВОМУ параметру, а у соседнего языка с
   * тем же типом первый — ошибка. Соглашение, которое в половине случаев
   * неверно, хуже одного написанного слова.
   */
  parseMonad() {
    const start = this.next()
    const name = this.expectName("ожидалось имя типа монады")
    this.expectKw("of", `у монады «${name}» не назван параметр: 'монада «${name}» от «А»'`)
    const param = this.expectName("ожидалось имя параметра типа")
    const node = { kind: "monad", name, param, unit: null, join: null, span: start.span }
    this.endLine()

    if (this.enterBlock()) {
      while (!this.atBlockEnd()) {
        this.skipNewlines()
        if (this.atBlockEnd()) break
        if (this.atKw("monadUnit")) {
          const at = this.next()
          if (node.unit !== null) this.fail(`у монады «${name}» больше одного возврата`, at)
          node.unit = this.expectName("ожидалось имя функции возврата")
          this.endLine()
          continue
        }
        if (this.atKw("monadJoin")) {
          const at = this.next()
          if (node.join !== null) this.fail(`у монады «${name}» больше одного соединения`, at)
          node.join = this.expectName("ожидалось имя функции соединения")
          this.endLine()
          continue
        }
        this.fail("не разобрана конструкция: в монаде ожидаются 'возврат' или 'соединение'")
      }
      this.exitBlock()
    }

    /* Без любой из двух функций это не монада: η и μ — и есть вся конструкция,
       а объявление, которое ничего не обещает, хуже отсутствующего. */
    for (const [часть, значение] of [["возврат", node.unit], ["соединение", node.join]]) {
      if (значение === null) this.fail(`у монады «${name}» не указан(о) ${часть}`, start)
    }
    return node
  }

  /**
   * Блок `в монаде` — связывание словами, оно же do-нотация.
   *
   * ```
   * в монаде «Возможно»
   *   пусть заказ равно «Найти заказ» от номер
   *   пусть остаток равно «Проверить остаток» от заказ
   *   возврат «Отгрузить» от заказ и остаток
   * ```
   *
   * Каждое `пусть` — связывание: справа стоит значение В МОНАДЕ, а слева имя
   * получает то, что лежит ВНУТРИ. Последняя строка `возврат` — то самое η,
   * которое объявлено у монады: одно понятие названо одним словом в обоих
   * местах, поэтому отдельное `вернуть` не заводится. Оно и не могло бы:
   * `пусть вернуть равно …` стоит голым в `examples/rosetta/towers-of-hanoi.flang`,
   * и ключевое слово сломало бы этот файл (см. таблицу в `lexer.mjs`).
   *
   * Узел `inMonad` — временный: он живёт от конца этой функции до конца
   * `parseProgram`, где `expandMonads` заменяет его обычными вызовами. Наружу
   * парсера он не выходит НИКОГДА, и это главное свойство формы: ни проверка
   * типов, ни завершаемость, ни восемь бэкендов, ни самоприменение о нём не
   * знают и знать не обязаны.
   */
  parseInMonad() {
    const start = this.next()
    const monad = this.expectName("ожидалось имя монады")
    this.endLine()
    if (!this.enterBlock()) this.fail(`у блока «в монаде «${monad}»» нет ни одной строки`, start)

    const binds = []
    let result = null
    let глубина = 0
    while (!this.atBlockEnd()) {
      this.skipNewlines()
      if (this.atBlockEnd()) break
      if (result !== null) this.fail("после 'возврат' блок 'в монаде' заканчивается")
      if (this.atKw("let")) {
        const at = this.next()
        const name = this.expectName("ожидалось имя связывания")
        if (!this.eatKw("cmpEq") && !this.eatKw("is") && !this.eatPunct("=")) {
          this.fail("после имени в 'пусть' ожидалось 'равно'")
        }
        /* Значение считается ДО связывания — как в обычном `пусть`: имя
           появляется в области видимости только для строк ниже. */
        const value = this.parseExpression()
        this.endLine()
        binds.push({ name, value, span: at.span })
        this.pushScope([name])
        глубина += 1
        continue
      }
      if (this.atKw("monadUnit")) {
        this.next()
        result = this.parseExpression()
        this.endLine()
        continue
      }
      this.fail("не разобрана конструкция: в блоке 'в монаде' ожидаются 'пусть' или 'возврат'")
    }
    for (let шаг = 0; шаг < глубина; шаг += 1) this.popScope()
    this.exitBlock()

    /* Блок без `возврат` не собирается, и это доказывается разбором, а не
       проверяется на входах: `пусть` даёт связывание, а результата у блока не
       было бы вовсе — выражение обязано иметь значение. */
    if (result === null) this.fail(`в блоке «в монаде «${monad}»» нет строки 'возврат'`, start)
    this.blocksInMonad += 1
    return { kind: "inMonad", monad, binds, result, span: start.span }
  }

  parseSupervision() {
    const start = this.next()
    const name = this.expectName("ожидалось имя надзора")
    const node = { kind: "supervisor", name, watch: [], nested: [], threshold: null, span: start.span }

    if (this.enterBlock()) {
      while (!this.atBlockEnd()) {
        this.skipNewlines()
        if (this.atBlockEnd()) break
        if (this.atKw("process")) {
          const at = this.next()
          const process = this.expectName("ожидалось имя процесса под надзором")
          this.expectKw("strategy", "после имени процесса ожидалось 'стратегия'")
          const strategy = this.expectName("ожидалось имя стратегии")
          node.watch.push({ process, strategy, span: at.span })
          this.endLine()
          continue
        }
        if (this.atKw("supervision")) {
          const at = this.next()
          const supervisor = this.expectName("ожидалось имя надзора под надзором")
          this.expectKw("strategy", "после имени надзора ожидалось 'стратегия'")
          const strategy = this.expectName("ожидалось имя стратегии")
          node.nested.push({ supervisor, strategy, span: at.span })
          this.endLine()
          continue
        }
        if (this.atKw("failureThreshold")) {
          const at = this.next()
          if (node.threshold !== null) this.fail(`у надзора «${name}» больше одного порога отказов`, at)
          const failures = this.expectNumber("после 'порог отказов' ожидалось число отказов")
          this.skipFillerWords()
          const window = this.expectNumber("после числа отказов ожидалось окно в миллисекундах")
          this.skipFillerWords()
          this.expectKw("else", "порог отказов заканчивается на 'иначе «стратегия»'")
          const otherwise = this.expectName("ожидалось имя стратегии после 'иначе'")
          node.threshold = { failures, window, otherwise, span: at.span }
          this.endLine()
          continue
        }
        this.fail(
          "не разобрана конструкция: в надзоре ожидаются 'процесс … стратегия …', " +
            "'надзор … стратегия …' или 'порог отказов …'",
        )
      }
      this.exitBlock()
    }
    if (node.watch.length === 0 && node.nested.length === 0) {
      this.fail(`надзор «${name}» не называет ни одного процесса и ни одного надзора`, start)
    }
    return node
  }

  /**
   * Прогон — пример конкурентной программы: семя, входные сообщения, итог.
   *
   * ```
   * прогон «два прибавления»
   *   семя 4172
   *   дано «Счётчик» принимает (вариант «прибавить» с «сколько» равным 2)
   *   ожидается «Счётчик» равен (запись «Счёт» с «всего» равным 5)
   *   ожидается «Счётчик» стратегия «перезапустить» 1 раз
   * ```
   *
   * Слова `дано`, `ожидается` и `равен` — те же, что у обычного `пример`, и это
   * не сходство, а тождество: конкурентная программа проверяется тем же
   * аппаратом, что и остальной язык. Отличие ровно одно — `семя`: без него
   * «ожидаемый итог» не имел бы смысла, потому что итогов у конкурентной
   * программы столько, сколько чередований.
   *
   * Вторая форма ожидания — про надзор. Одного состояния мало: «состояние равно
   * начальному» верно и для процесса, которому вообще ничего не приходило, так
   * что перезапуск по нему не отличить от бездействия. Форма `стратегия «X» N`
   * называет, сколько раз надзор принял о процессе решение X, и новых слов не
   * занимает: `стратегия` уже ключевое, «раз» — слово-пояснение.
   *
   * ── Сетка семян (шаг 5) ─────────────────────────────────────────────────
   *
   * ```
   * прогон «счёт не зависит от чередования, а порядок в журнале — зависит»
   *   семя от 1 до 1000
   *   дано «Счётчик» принимает (вариант «прибавить» с «сколько» равным 2)
   *   ожидается «Счётчик» равен (запись «Счёт» с «всего» равным 5)
   *   ожидается «Журнал» любое из [(запись «Записи» …), (запись «Записи» …)]
   * ```
   *
   * На сетке `равен` становится ИНВАРИАНТОМ («при любом чередовании выходит
   * вот это»), а `любое из` называет множество достижимых итогов там, где итог
   * от чередования зависеть вправе.
   *
   * Одно семя проверяет ОДНО чередование, а семантика модели — любое (контракт,
   * «Семантика»). Утверждение «состояние не рассыпается ни при каком порядке» на
   * одном семени поэтому не проверяется вовсе, и сетка семян — не украшение, а
   * то единственное, чем оно проверяется в исходнике.
   *
   * Новых ключевых слов сетка не занимает НИ ОДНОГО, и это не случайность, а
   * условие: таблица слов лежит в двух местах (`src/lexer.mjs` и
   * `self/lexer.flang`), сверяется тестом, и каждое новое слово запрещает
   * одноимённую переменную во всех файлах репозитория. `от` — то же `of`, каким
   * пишется применение функции; `до` и «семян» — слова-пояснения, которые
   * парсер пропускает так же, как «витков» и «миллисекунд»; `любое` — тот же
   * джокер `любое`, а `из` — тот же предлог, каким берут из списка.
   */
  parseRun() {
    const start = this.next()
    const name = this.expectName("ожидалось имя прогона")
    const node = { kind: "run", name, seed: null, seedTo: null, inbox: [], expected: [], span: start.span }

    if (this.enterBlock()) {
      while (!this.atBlockEnd()) {
        this.skipNewlines()
        if (this.atBlockEnd()) break
        if (this.atKw("seed")) {
          const at = this.next()
          if (node.seed !== null) this.fail(`у прогона «${name}» больше одного семени`, at)
          /* `семя от N до M` — сетка; `семя N` — одно чередование. Различает их
             предлог, а не отдельное слово: одно понятие называется одним словом,
             и «семя» остаётся одним словом и для одного семени, и для набора. */
          const сетка = this.eatKw("of")
          node.seed = this.expectNumber("после 'семя' ожидалось число")
          if (сетка) {
            this.skipFillerWords()
            node.seedTo = this.expectNumber("после 'семя от N' ожидалось верхнее семя: 'семя от N до M'")
            this.skipFillerWords()
          }
          this.endLine()
          continue
        }
        if (this.atKw("given")) {
          const at = this.next()
          const process = this.expectName("ожидалось имя процесса-получателя")
          this.expectKw("accepts", "после имени процесса ожидалось 'принимает'")
          node.inbox.push({ process, message: this.parseLiteralValue(), span: at.span })
          this.endLine()
          continue
        }
        if (this.atKw("expected")) {
          const at = this.next()
          const process = this.expectName("ожидалось имя процесса")
          if (this.eatKw("strategy")) {
            const strategy = this.expectName("ожидалось имя стратегии")
            const times = this.expectNumber("после имени стратегии ожидалось, сколько раз она применялась")
            this.skipFillerWords()
            node.expected.push({ kind: "strategy", process, strategy, times, span: at.span })
            this.endLine()
            continue
          }
          /* Третья форма — множество допустимых итогов. Нужна там, где итог от
             чередования ЗАВИСИТ и зависеть вправе: у гонки порядок в сборщике
             свой на каждое чередование, и «равен» тут пришлось бы писать по
             строке на семя. Множество называется списком, потому что список в
             языке уже есть, а состояние процесса списком быть не может (тип
             состояния — всегда объявленное имя), так что спутать нечего. */
          if (this.eatKw("any")) {
            this.expectKw("from", "после 'любое' ожидалось 'из': 'ожидается «Процесс» любое из [значение, …]'")
            node.expected.push({ kind: "oneOf", process, states: this.parseLiteralValue(), span: at.span })
            this.endLine()
            continue
          }
          if (!this.eatKw("cmpEq")) {
            this.fail(
              "ожидание записывается как 'ожидается «Процесс» равен значение', " +
                "'ожидается «Процесс» любое из [значение, …]' " +
                "или 'ожидается «Процесс» стратегия «…» N раз'",
            )
          }
          node.expected.push({ kind: "state", process, state: this.parseLiteralValue(), span: at.span })
          this.endLine()
          continue
        }
        this.fail("не разобрана конструкция: в прогоне ожидаются 'семя', 'дано' или 'ожидается'")
      }
      this.exitBlock()
    }

    if (node.seed === null) this.fail(`прогон «${name}» требует строку 'семя'`, start)
    if (node.expected.length === 0) this.fail(`прогон «${name}» требует хотя бы одну строку 'ожидается'`, start)
    return node
  }

  // ── ввод-вывод: план ──────────────────────────────────────────────────────

  /**
   * План — объявление, а не значение, и три его строки уже знакомы читателю.
   *
   * ```
   * план «Отчёт о ссылке»
   *   состояние «Ход»
   *   начинает с «Начать»
   *   обрабатывает «Дальше»
   * ```
   *
   * Ровно та же форма, что у процесса, минус `принимает`: тип сообщения плану
   * называть не нужно — он всегда `«Отклик»`, потому что набор поручений закрыт
   * (см. `src/io.mjs`). Из четырёх слов новое только `план`; остальные три —
   * те же, что у процесса, и это не экономия, а утверждение: план и процесс
   * устроены одинаково, и читать их надо одинаково.
   */
  parsePlan() {
    const start = this.next()
    const name = this.expectName("ожидалось имя плана")
    /* План — это и есть использование ввода-вывода: словарь приписывается даже
       тогда, когда ни одно имя из него в тексте не встретилось (шаг может
       лежать в импортированном модуле). */
    this.usesIo = true
    const node = { kind: "plan", name, state: null, initial: null, handler: null, span: start.span }

    if (this.enterBlock()) {
      while (!this.atBlockEnd()) {
        this.skipNewlines()
        if (this.atBlockEnd()) break
        if (this.atKw("state")) {
          const at = this.next()
          if (node.state !== null) this.fail(`у плана «${name}» больше одного состояния`, at)
          node.state = this.expectName("ожидался тип состояния плана")
          this.endLine()
          continue
        }
        if (this.atKw("startsWith")) {
          const at = this.next()
          if (node.initial !== null) this.fail(`у плана «${name}» больше одного начального состояния`, at)
          node.initial = this.expectName("ожидалось имя начального состояния")
          this.endLine()
          continue
        }
        if (this.atKw("handles")) {
          const at = this.next()
          if (node.handler !== null) this.fail(`у плана «${name}» больше одной функции шага`, at)
          node.handler = this.expectName("ожидалось имя функции шага")
          this.endLine()
          continue
        }
        this.fail("не разобрана конструкция: в плане ожидаются 'состояние', 'начинает с' или 'обрабатывает'")
      }
      this.exitBlock()
    }

    for (const [поле, слово] of [
      ["state", "состояние"],
      ["initial", "начинает с"],
      ["handler", "обрабатывает"],
    ]) {
      if (node[поле] === null) this.fail(`план «${name}» требует строку '${слово}'`, start)
    }
    return node
  }

  expectNumber(message) {
    if (!this.at("number")) this.fail(message)
    return this.next().value
  }

  /**
   * Слова-пояснения: `витков`, `отказов`, `за`, `миллисекунд`.
   *
   * Они читаются глазами и пропускаются парсером. Резервировать под них
   * ключевые слова значило бы запретить четыре существительных в качестве имён
   * во всех файлах репозитория — цена, несопоставимая с пользой. Закавыченное
   * имя не пропускается никогда: `«витков»` — это имя, а не пояснение.
   */
  skipFillerWords() {
    while (this.at("name") && this.peek().quoted !== true) this.next()
  }

  // ── наследие FTS: утилиты, морфизмы, теоремы, функторы ────────────────────

  parseUtility() {
    const start = this.next()
    const name = this.expectName("ожидалось имя утилиты")
    const value = { name, input: null, output: null, initial: null, rules: [], properties: [], examples: [] }

    if (this.enterBlock()) {
      while (!this.atBlockEnd()) {
        this.skipNewlines()
        if (this.atBlockEnd()) break
        if (this.eatKw("accepts")) {
          value.input = this.expectName("ожидалось имя входного объекта")
          this.endLine()
          continue
        }
        if (this.eatKw("returns")) {
          value.output = this.parseFtsTypeName()
          this.endLine()
          continue
        }
        if (this.eatKw("startsWith")) {
          value.initial = this.parseScalar()
          this.endLine()
          continue
        }
        if (this.atKw("rule")) {
          value.rules.push(this.parseUtilityRule())
          continue
        }
        if (this.atKw("property")) {
          value.properties.push(this.parseUtilityProperty())
          continue
        }
        if (this.atKw("example")) {
          value.examples.push(this.parseUtilityExample())
          continue
        }
        this.fail("не разобрана конструкция: ожидались принимает, возвращает, начинает с, правило, свойство или пример")
      }
      this.exitBlock()
    }
    return { kind: "ftsLegacy", construct: "utility", value, span: start.span }
  }

  parseFtsTypeName() {
    const token = this.peek()
    if (token.kind === "keyword" && FTS_TYPE_NAMES[token.value] !== undefined) {
      this.next()
      return FTS_TYPE_NAMES[token.value]
    }
    return this.expectName("ожидался тип результата")
  }

  parseUtilityRule() {
    const start = this.next()
    const name = this.expectName("ожидалось имя правила")
    const when = []
    let action = null

    if (this.enterBlock()) {
      while (!this.atBlockEnd()) {
        this.skipNewlines()
        if (this.atBlockEnd()) break
        if (this.eatKw("if") || this.eatKw("and")) {
          when.push(this.parseUtilityCondition())
          this.endLine()
          continue
        }
        if (this.eatKw("then")) {
          if (this.eatKw("add")) {
            action = { kind: "add", value: this.parseUtilityOperand() }
          } else if (this.eatKw("result")) {
            this.expectComparison("cmpEq", "результат правила задаётся через 'равен'")
            action = { kind: "set", value: this.parseUtilityOperand() }
          } else {
            this.fail("не разобрана конструкция: после 'то' ожидались 'добавить' или 'результат'")
          }
          this.endLine()
          continue
        }
        this.fail("не разобрана конструкция: в правиле ожидаются если, и или то")
      }
      this.exitBlock()
    }
    if (when.length === 0) this.fail(`правило «${name}» требует условие 'если'`, start)
    if (action === null) this.fail(`правило «${name}» требует действие 'то'`, start)
    return { name, when, action }
  }

  parseUtilityCondition() {
    this.eatKw("field")
    const field = this.expectName("ожидалось имя поля")
    const operator = this.expectAnyComparison()
    return { field, operator, value: this.parseUtilityOperand() }
  }

  expectAnyComparison() {
    const token = this.peek()
    if (token.kind !== "keyword" || FTS_COMPARISONS[token.value] === undefined) {
      this.fail("ожидалось сравнение: равен, не равен, больше, меньше, не больше или не меньше")
    }
    this.next()
    return FTS_COMPARISONS[token.value]
  }

  parseUtilityOperand() {
    if (this.eatKw("result")) return { kind: "result" }
    if (this.at("number") && this.atKw("opPercent", 1)) {
      const percent = this.next().value
      this.next()
      this.eatKw("of")
      this.eatKw("field")
      return { kind: "percent", percent, field: this.expectName("ожидалось имя поля") }
    }
    if (this.eatKw("field")) return { kind: "field", field: this.expectName("ожидалось имя поля") }
    return { kind: "value", value: this.parseScalar() }
  }

  parseScalar() {
    const token = this.peek()
    if (token.kind === "number" || token.kind === "string") {
      this.next()
      return token.value
    }
    if (token.kind === "keyword" && ["litTrue", "litFalse", "litNull"].includes(token.value)) {
      this.next()
      return literalOfKeyword(token.value)
    }
    return this.expectName("ожидалось значение")
  }

  parseUtilityProperty() {
    const start = this.next()
    const name = this.expectName("ожидалось имя свойства")
    let operator = null
    let value = null

    if (this.enterBlock()) {
      while (!this.atBlockEnd()) {
        this.skipNewlines()
        if (this.atBlockEnd()) break
        this.expectKw("result", `свойство «${name}» должно содержать сравнение результата`)
        operator = this.expectAnyComparison()
        value = this.parseUtilityOperand()
        this.endLine()
      }
      this.exitBlock()
    }
    if (operator === null) this.fail(`свойство «${name}» должно содержать сравнение результата`, start)
    return { name, operator, value }
  }

  parseUtilityExample() {
    const start = this.next()
    const name = this.expectName("ожидалось имя примера")
    const input = {}
    let expected
    let hasExpected = false

    if (this.enterBlock()) {
      while (!this.atBlockEnd()) {
        this.skipNewlines()
        if (this.atBlockEnd()) break
        if (this.eatKw("given")) {
          this.eatKw("field")
          const field = this.expectName("ожидалось имя поля")
          this.expectComparison("cmpEq", "пример задаёт вход как 'дано поле равно значению'")
          input[field] = this.parseScalar()
          this.endLine()
          continue
        }
        if (this.eatKw("expected")) {
          this.eatKw("result")
          this.expectComparison("cmpEq", "ожидание задаётся как 'ожидается результат равен значению'")
          expected = this.parseScalar()
          hasExpected = true
          this.endLine()
          continue
        }
        this.fail("не разобрана конструкция: в примере ожидаются строки 'дано' или 'ожидается'")
      }
      this.exitBlock()
    }
    if (!hasExpected) this.fail(`пример «${name}» требует строку 'ожидается'`, start)
    return { name, input, expected }
  }

  /**
   * Морфизм.
   *
   * Две формы, и различает их то, что идёт сразу за именем.
   *
   * `морфизм «имя» из «А» в «Б»` — стрелка категории: у неё есть домен и
   * кодомен, и она попадает в AST отдельным узлом, потому что композиция
   * обязана проверяться компилятором. Сюда же `морфизм «в» это «б» после «а»` —
   * композиция в математическом порядке: правая применяется первой.
   *
   * `морфизм «имя»` с блоком `если … то …` — утверждение FTS, каким морфизм был
   * всегда: без входа и выхода, импликация, которую применяет теорема. Оно
   * остаётся в legacy и работает как прежде — обратная совместимость здесь не
   * пожелание, а условие: 24 морфизма в моделях репозитория написаны так.
   *
   * Согласовано с владельцем: морфизм — «и то и другое», стрелка и утверждение
   * одновременно (flang/cat/SPEC.md, «Решение о морфизме»). Стрелка и
   * композиция сделаны первым шагом; здесь к стрелке добавляется закон.
   *
   * ```flang
   * морфизм «отгрузить» из «Заказ» в «Отгрузка»
   *   даёт «Отгрузить заказ»
   *   закон «номер берётся из суммы»
   *     пример «обычный»
   *       дано заказ равно запись «Заказ» с сумма равным 5
   *       ожидается запись «Отгрузка» с номер равным 5
   * ```
   *
   * Блок необязателен, и это не мелочь: стрелка без него остаётся ровно тем,
   * чем была, — объявлением без вычисления. Поэтому ключи `gives` и `laws`
   * появляются в узле ТОЛЬКО когда написаны. Иначе AST каждой существующей
   * стрелки поменялся бы на два поля, а его сверяет побайтово неподвижная
   * точка самоприменения.
   *
   * Примеры закона разбираются тем же `parseExample`, каким разбираются
   * примеры функции, — второй разбор примеров означал бы второе понимание слов
   * «дано» и «ожидается», то есть ровно то расхождение, которого язык избегает.
   */
  parseMorphism() {
    const start = this.next()
    const name = this.expectName("ожидалось имя морфизма")

    /* Стрелка: `из «А» в «Б»` прямо в строке объявления. */
    if (this.atKw("from")) {
      this.next()
      const domain = this.expectName("ожидался домен морфизма")
      this.expectKw("to", "после домена ожидалось 'в'")
      const codomain = this.expectName("ожидался кодомен морфизма")
      this.endLine()
      const arrow = { kind: "morphism", name, domain, codomain, span: start.span }
      const laws = []
      let gives = null

      if (this.enterBlock()) {
        while (!this.atBlockEnd()) {
          this.skipNewlines()
          if (this.atBlockEnd()) break
          if (this.eatKw("gives")) {
            if (gives !== null) this.fail(`у морфизма «${name}» больше одного 'даёт'`, start)
            gives = this.expectName("ожидалось имя функции после 'даёт'")
            this.endLine()
            continue
          }
          if (this.atKw("lawBlock")) {
            laws.push(this.parseMorphismLaw())
            continue
          }
          this.fail("не разобрана конструкция: у стрелки ожидаются 'даёт' и 'закон'")
        }
        this.exitBlock()
      }

      if (gives !== null) arrow.gives = gives
      if (laws.length > 0) {
        /* Закон без `даёт` проверить не на чем: примеры сравнивают то, что
           стрелка вычислила, а вычислять нечем. Отказ здесь, в разборе, а не
           молчаливое «ноль проверок» при `flang test`: объявление, которое
           ничего не обещает, хуже отсутствующего. */
        if (gives === null) {
          this.fail(`у морфизма «${name}» есть закон, но нет 'даёт': проверять закон не на чем`, start)
        }
        arrow.laws = laws
      }

      this.morphisms.push(arrow)
      return null
    }

    /* Композиция: `это «б» после «а»`. */
    if (this.atKw("alias")) {
      this.next()
      const left = this.expectName("ожидалось имя морфизма слева от 'после'")
      this.expectKw("after", "ожидалось 'после'")
      const right = this.expectName("ожидалось имя морфизма справа от 'после'")
      this.endLine()
      /* Порядок математический: правая применяется первой. Домен и кодомен
         выводятся при проверке типов — там же, где стыковка и проверяется. */
      const composed = { kind: "composition", name, left, right, span: start.span }
      this.morphisms.push(composed)
      return null
    }

    const value = { name, domain: null, codomain: null, law: "morphism.declared" }

    if (this.enterBlock()) {
      while (!this.atBlockEnd()) {
        this.skipNewlines()
        if (this.atBlockEnd()) break
        if (this.eatKw("if") || this.eatKw("from")) value.domain = this.expectName("ожидался домен морфизма")
        else if (this.eatKw("then") || this.eatKw("to")) value.codomain = this.expectName("ожидался кодомен морфизма")
        else if (this.eatKw("law")) value.law = this.expectName("ожидался закон морфизма")
        else this.fail("не разобрана конструкция: в морфизме ожидаются 'если', 'то' или 'по закону'")
        this.endLine()
      }
      this.exitBlock()
    }
    if (value.domain === null || value.codomain === null) {
      this.fail(`морфизм «${name}» требует строки 'если' и 'то'`, start)
    }
    return { kind: "ftsLegacy", construct: "morphism", value, span: start.span }
  }

  /**
   * Закон при стрелке: имя и примеры, на которых обещание проверяется.
   *
   * Имя обязательно, и не для красоты: отчёт `flang test` называет
   * нарушенное обещание словами автора, а «закон номер два морфизма
   * «отгрузить»» не сказало бы читателю ничего.
   *
   * Закон без единого примера отвергается разбором. Пустой закон — это
   * объявление, которое обещает и не проверяет ничего, а такое объявление
   * хуже отсутствующего: оно читается как гарантия.
   */
  parseMorphismLaw() {
    const start = this.next()
    const name = this.expectName("ожидалось имя закона морфизма")
    const examples = []

    if (this.enterBlock()) {
      while (!this.atBlockEnd()) {
        this.skipNewlines()
        if (this.atBlockEnd()) break
        if (this.atKw("example")) {
          examples.push(this.parseExample())
          continue
        }
        this.fail("не разобрана конструкция: в законе морфизма ожидается 'пример'")
      }
      this.exitBlock()
    }

    if (examples.length === 0) this.fail(`закон «${name}» требует хотя бы одного примера`, start)
    return { name, examples, span: start.span }
  }

  /**
   * Цепочка — та же композиция, записанная в порядке чтения.
   *
   * `«в» после («б» после «а»)` читается наизнанку, и на четырёх звеньях это
   * уже нечитаемо. Цепочка разворачивается в те же узлы композиции, то есть
   * ничего нового в семантику не вносит: сахар, но сахар ради того, ради чего
   * весь язык — чтобы написанное читалось как мысль.
   *
   * Промежуточные звенья получают служебные имена: они нужны стыковке, но в
   * пространстве имён морфизмов их быть не должно — иначе цепочка из трёх
   * шагов молча занимала бы два лишних имени.
   */
  parseChain() {
    const start = this.next()
    const name = this.expectName("ожидалось имя цепочки")
    const шаги = []

    if (this.enterBlock()) {
      while (!this.atBlockEnd()) {
        this.skipNewlines()
        if (this.atBlockEnd()) break
        if (this.eatKw("firstStep")) {
          if (шаги.length > 0) this.fail("в цепочке 'сначала' идёт первым и только раз", start)
          шаги.push(this.expectName("ожидалось имя морфизма после 'сначала'"))
        } else if (this.eatKw("nextStep")) {
          if (шаги.length === 0) this.fail("в цепочке 'затем' идёт после 'сначала'", start)
          шаги.push(this.expectName("ожидалось имя морфизма после 'затем'"))
        } else {
          this.fail("не разобрана конструкция: в цепочке ожидаются 'сначала' и 'затем'")
        }
        this.endLine()
      }
      this.exitBlock()
    }

    if (шаги.length < 2) this.fail(`цепочка «${name}» требует хотя бы двух шагов`, start)

    /* Разворачиваем слева направо: сначала «а», затем «б» — это «б» после «а». */
    let текущий = шаги[0]
    for (let i = 1; i < шаги.length; i += 1) {
      const последний = i === шаги.length - 1
      const имя = последний ? name : `${name} · шаг ${i}`
      this.morphisms.push({
        kind: "composition",
        name: имя,
        left: шаги[i],
        right: текущий,
        internal: !последний,
        span: start.span,
      })
      текущий = имя
    }
    return undefined
  }

  /**
   * Тождественный морфизм объекта: `единица «Заказ»`.
   *
   * Нужен не для украшения, а потому что без него не выразить законы: у
   * функтора обязано быть `F(единица) = единица`, и на что-то это равенство
   * должно ссылаться.
   */
  parseIdentity() {
    const start = this.next()
    const object = this.expectName("ожидалось имя объекта после 'единица'")
    this.endLine()
    this.morphisms.push({
      kind: "morphism",
      name: `единица ${object}`,
      domain: object,
      codomain: object,
      identity: true,
      span: start.span,
    })
    return undefined
  }

  /**
   * Изоморфизм: пара стрелок туда и обратно.
   *
   * ```flang
   * изоморфизм «Заказ и накладная» из «Заказ» в «Накладная»
   *   прямой морфизм «выписать»
   *   обратный морфизм «по накладной»
   * ```
   *
   * Почему `из … в …`, а не «между … и …». Концы у изоморфизма ровно те же, что
   * у морфизма и функтора, и называть их третьим оборотом значило бы завести
   * второе имя одному понятию. Порядок при этом значим: `прямой` ведёт из
   * первого объекта во второй, `обратный` — обратно, и перепутать их нельзя,
   * потому что проверка сличает концы (`checkIsomorphisms` в types.mjs).
   *
   * Почему `прямой морфизм` и `обратный морфизм` — фразы, а не слова «туда» и
   * «обратно». Наречия сегодня свободны, но свободны случайно: это обычные
   * слова языка, и ключевым делать их — значит запретить их в качестве имени
   * навсегда ради двух строк объявления. Довод тот же, по которому в языке
   * стоят `обратный элемент` и `разложить … на символы`.
   *
   * Строк `сохраняет …` здесь нет намеренно, ровно как у функтора: пара,
   * которая не обращается, изоморфизмом не является, и разрешение на проверку
   * закона продавало бы имя вместо содержания.
   */
  parseIsomorphism() {
    const start = this.next()
    const name = this.expectName("ожидалось имя изоморфизма")
    this.expectKw("from", "у изоморфизма ожидалось 'из'")
    const from = this.expectName("ожидался первый объект изоморфизма")
    this.expectKw("to", "после первого объекта изоморфизма ожидалось 'в'")
    const to = this.expectName("ожидался второй объект изоморфизма")
    this.endLine()

    const node = { kind: "isomorphism", name, from, to, forward: null, backward: null, span: start.span }
    if (this.enterBlock()) {
      while (!this.atBlockEnd()) {
        this.skipNewlines()
        if (this.atBlockEnd()) break
        if (this.atKw("forwardMorphism")) {
          const at = this.next()
          if (node.forward !== null) this.fail(`у изоморфизма «${name}» больше одного прямого морфизма`, at)
          node.forward = this.expectName("ожидалось имя прямого морфизма")
          this.endLine()
          continue
        }
        if (this.atKw("inverseMorphism")) {
          const at = this.next()
          if (node.backward !== null) this.fail(`у изоморфизма «${name}» больше одного обратного морфизма`, at)
          node.backward = this.expectName("ожидалось имя обратного морфизма")
          this.endLine()
          continue
        }
        this.fail("не разобрана конструкция: в изоморфизме ожидаются 'прямой морфизм' и 'обратный морфизм'")
      }
      this.exitBlock()
    }

    /* Одной стрелки мало по определению: изоморфизм — это ПАРА, и объявление с
       одной половиной обещает обратимость, ничем её не подкрепляя. */
    for (const [часть, значение] of [["прямой морфизм", node.forward], ["обратный морфизм", node.backward]]) {
      if (значение === null) this.fail(`у изоморфизма «${name}» не указан ${часть}`, start)
    }
    return node
  }

  parseTheorem() {
    const start = this.next()
    const value = {
      title: this.expectName("ожидалось название теоремы"),
      structure: null,
      field: null,
      expected: null,
      collection: null,
      selectorField: null,
      selectorValue: null,
      morphisms: [],
      conclusion: null,
    }

    if (this.enterBlock()) {
      while (!this.atBlockEnd()) {
        this.skipNewlines()
        if (this.atBlockEnd()) break
        if (this.eatKw("given")) {
          value.structure = this.expectName("ожидалось имя объекта")
          this.expectKw("has", "ожидалось 'дано «Объект» имеет «поле» равное значение'")
          value.field = this.expectName("ожидалось имя поля")
          this.expectComparison("cmpEq", "после поля ожидалось слово 'равное'")
          value.expected = this.parseScalar()
        } else if (this.eatKw("inData")) {
          value.collection = this.expectName("ожидалось имя коллекции")
          this.expectKw("findWhere", "ожидалось 'найти где'")
          value.selectorField = this.expectName("ожидалось имя поля")
          this.expectComparison("cmpEq", "после поля selector ожидалось слово 'равен'")
          value.selectorValue = this.parseScalar()
        } else if (this.eatKw("byMorphism")) {
          value.morphisms.push(this.expectName("ожидалось имя морфизма"))
        } else if (this.eatKw("therefore")) {
          value.conclusion = this.expectName("ожидался вывод теоремы")
        } else {
          this.fail("не разобрана конструкция: неизвестная строка теоремы")
        }
        this.endLine()
      }
      this.exitBlock()
    }
    return { kind: "ftsLegacy", construct: "theorem", value, span: start.span }
  }

  /** Файл-функтор ftsc: `функтор «X» из «A» в «B»` и отображения под ним. */
  parseFunctorFile() {
    const start = this.next()
    const name = this.expectName("ожидалось имя функтора")
    this.expectKw("from", "у функтора ожидалось 'из'")
    const from = this.expectName("ожидалась исходная категория")
    this.expectKw("to", "у функтора ожидалось 'в'")
    const to = this.expectName("ожидалась целевая категория")
    const value = { name, from, to, imports: [], objects: [], morphisms: [] }

    if (this.enterBlock()) {
      while (!this.atBlockEnd()) {
        this.skipNewlines()
        if (this.atBlockEnd()) break
        if (this.eatKw("uses")) {
          const category = this.expectName("ожидалось имя категории")
          this.expectKw("from", "после имени категории ожидалось 'из'")
          value.imports.push({ category, from: this.expectName("ожидался путь") })
          this.endLine()
          continue
        }
        if (this.eatKw("object")) {
          const objectFrom = this.expectName("ожидалось имя объекта")
          this.expectKw("mapsTo", "ожидалось 'отображается в'")
          const mapping = { from: objectFrom, to: this.expectName("ожидался образ объекта"), fields: [] }
          if (this.enterBlock()) {
            while (!this.atBlockEnd()) {
              this.skipNewlines()
              if (this.atBlockEnd()) break
              this.expectKw("field", "ожидалось 'поле'")
              const fieldFrom = this.expectName("ожидалось имя поля")
              this.expectKw("mapsToField", "ожидалось 'отображается в поле'")
              mapping.fields.push({ from: fieldFrom, to: this.expectName("ожидался образ поля") })
              this.endLine()
            }
            this.exitBlock()
          }
          value.objects.push(mapping)
          continue
        }
        if (this.eatKw("morphism")) {
          const morphismFrom = this.expectName("ожидалось имя морфизма")
          this.expectKw("mapsToMorphism", "ожидалось 'отображается в морфизм'")
          value.morphisms.push({ from: morphismFrom, to: this.expectName("ожидался образ морфизма") })
          this.endLine()
          continue
        }
        this.fail("не разобрана конструкция: непонятная строка функтора")
      }
      this.exitBlock()
    }
    if (this.module === "") this.module = name
    return { kind: "ftsLegacy", construct: "functorFile", value, span: start.span }
  }

  /**
   * Бифунктор: функтор от двух входов сразу.
   *
   * ```flang
   * бифунктор «Пара» из «Заказы» и «Счета» в «Пары»
   *   объекты «Заказ» и «Счёт» отображаются в «Пара заказа и счёта»
   *   морфизмы «отгрузить» и «выставить» отображаются в морфизм «пара отгрузки и выставления»
   * ```
   *
   * Отличие от функтора ровно одно: ключ отображения — ПАРА, а не одно имя.
   * Всё остальное — те же слова (`из … в …`, `отображается в`), и это не
   * экономия, а условие читаемости: два похожих объявления обязаны читаться
   * похоже, иначе разницу между ними начинают искать там, где её нет.
   *
   * Чего в объявлении НЕТ и почему. В контракте (flang/cat/SPEC.md) бифунктор
   * записан в общем виде — `из «Значения» и «Значения» в «Значения»` с образом
   * `«Пара А Б»`, где «А» и «Б» переменные типа. Так записать нельзя: в языке
   * нет параметрических типов, и «Пара А Б» — это имя одной записи, а не
   * семейство. Поэтому пары здесь конкретные, как конкретны объекты у функтора.
   * Ограничение не бифунктора, а языка, и снимется оно вместе с параметрическим
   * полиморфизмом; законы от этого не меняются ни одним словом.
   */
  parseBifunctor() {
    const start = this.next()
    const name = this.expectName("ожидалось имя бифунктора")
    this.expectKw("from", "у бифунктора ожидалось 'из'")
    const first = this.expectName("ожидалась первая исходная категория")
    this.expectKw("and", "между исходными категориями бифунктора ожидалось 'и'")
    const second = this.expectName("ожидалась вторая исходная категория")
    this.expectKw("to", "у бифунктора ожидалось 'в'")
    const to = this.expectName("ожидалась целевая категория")
    this.endLine()

    const node = { kind: "bifunctor", name, from: [first, second], to, objects: [], morphisms: [], span: start.span }
    if (this.enterBlock()) {
      while (!this.atBlockEnd()) {
        this.skipNewlines()
        if (this.atBlockEnd()) break
        if (this.eatKw("objectPair")) {
          const левый = this.expectName("ожидалось имя первого объекта пары")
          this.expectKw("and", "между объектами пары ожидалось 'и'")
          const правый = this.expectName("ожидалось имя второго объекта пары")
          this.expectKw("mapsTo", "ожидалось 'отображаются в'")
          node.objects.push({ from: [левый, правый], to: this.expectName("ожидался образ пары объектов") })
          this.endLine()
          continue
        }
        if (this.eatKw("morphismPair")) {
          const левый = this.expectName("ожидалось имя первого морфизма пары")
          this.expectKw("and", "между морфизмами пары ожидалось 'и'")
          const правый = this.expectName("ожидалось имя второго морфизма пары")
          this.expectKw("mapsToMorphism", "ожидалось 'отображаются в морфизм'")
          node.morphisms.push({ from: [левый, правый], to: this.expectName("ожидался образ пары морфизмов") })
          this.endLine()
          continue
        }
        this.fail("не разобрана конструкция: в бифункторе ожидаются строки 'объекты … и …' и 'морфизмы … и …'")
      }
      this.exitBlock()
    }
    return node
  }

  // ── наследие FTS: скобочная поверхность ───────────────────────────────────

  parseBracedDocument() {
    const start = this.expectKw("category", "документ должен начинаться со слова 'категория'")
    const category = this.expectName("ожидалось имя категории")
    this.expectPunct("{")
    const value = { category, structures: [], functors: [], proposition: null }
    if (this.module === "") this.module = category

    while (!this.atPunct("}") && !this.at("eof")) {
      this.skipSeparators()
      if (this.atPunct("}")) break
      if (this.atKw("object")) {
        const structure = this.parseBracedStructure()
        value.structures.push(structure)
        this.types.push({
          kind: "record",
          name: structure.name,
          fields: structure.fields.map((field) => ({ name: field.name, type: { kind: "named", name: field.type }, fts: field.type })),
        })
        continue
      }
      if (this.atKw("functor")) {
        value.functors.push(this.parseBracedFunctor())
        continue
      }
      if (this.atKw("proposition")) {
        if (value.proposition !== null) this.fail("категория допускает только одно утверждение")
        value.proposition = this.parseBracedProposition(true)
        continue
      }
      this.fail(`не разобрана конструкция: неожиданное '${this.peek().text ?? this.peek().value}' в категории`)
    }
    this.expectPunct("}")
    this.skipSeparators()
    this.legacy.push({ kind: "ftsLegacy", construct: "bracedDocument", value, span: start.span })
  }

  skipSeparators() {
    while (this.at("newline") || this.atPunct(";") || this.atPunct(",")) this.next()
  }

  parseBracedStructure() {
    this.next()
    const name = this.expectName("ожидалось имя структуры")
    this.expectPunct("{")
    const fields = []
    while (!this.atPunct("}") && !this.at("eof")) {
      this.skipSeparators()
      if (this.atPunct("}")) break
      const field = this.expectName("ожидалось имя поля")
      const optional = this.eatPunct("?")
      this.expectPunct(":")
      const parts = []
      let generic = 0
      while (!this.at("eof")) {
        const token = this.peek()
        if (token.kind === "punct" && token.value === "<") generic += 1
        if (token.kind === "punct" && token.value === ">") generic -= 1
        if (generic <= 0 && (token.kind === "newline" || (token.kind === "punct" && (token.value === ";" || token.value === "}")))) break
        parts.push(tokenText(this.next()))
      }
      if (parts.length === 0) this.fail(`поле '${field}' требует тип`)
      fields.push({ name: field, type: formatType(parts) + (optional ? " | undefined" : "") })
      this.skipSeparators()
    }
    this.expectPunct("}")
    return { name, fields }
  }

  parseBracedFunctor() {
    this.next()
    const name = this.expectName("ожидалось имя функтора")
    this.expectPunct(":")
    const domain = []
    while (!this.at("arrow") && !this.at("newline") && !this.at("eof")) domain.push(tokenText(this.next()))
    if (!this.at("arrow")) this.fail("в объявлении функтора ожидалась стрелка '->'")
    this.next()
    const codomain = []
    while (!this.at("newline") && !this.at("eof") && !this.atPunct(";") && !this.atPunct("}")) {
      codomain.push(tokenText(this.next()))
    }
    if (domain.length === 0 || codomain.length === 0) this.fail(`функтор '${name}' требует домен и кодомен`)
    this.skipSeparators()
    return { name, domain: formatType(domain), codomain: formatType(codomain), law: "functor.arrow" }
  }

  parseBracedProposition(prefixed) {
    if (prefixed) this.next()
    const kindToken = this.expectNameToken("ожидался вид утверждения")
    const kind = propositionKind(kindToken.value)
    if (kind === "witness") {
      const structure = this.expectName("утверждение требует «Структура».«поле»")
      this.expectPunct(".")
      const field = this.expectName("утверждение требует «Структура».«поле»")
      const body = this.parseBracedPropositionBody()
      const proposition = { kind: "witness", structure, field }
      if (isRecord(body.selector)) proposition.selector = body.selector
      if (body.value !== undefined) proposition.value = body.value
      if (Array.isArray(body.path)) proposition.path = body.path
      if (typeof body.detail === "string") proposition.detail = body.detail
      return proposition
    }
    if (kind === "apply") {
      let inline
      if ((this.atName() || this.at("keyword")) && this.atPunct("{", 1)) inline = this.expectName()
      const body = this.parseBracedPropositionBody()
      const functor = inline ?? (typeof body.functor === "string" ? body.functor : undefined)
      if (functor === undefined) this.fail("утверждение 'применить' требует функтор", kindToken)
      const proposition = { kind: "apply", functor, arg: body.arg }
      if (typeof body.detail === "string") proposition.detail = body.detail
      return proposition
    }
    if (kind === "compose") {
      let inline
      if (this.atPunct("[")) inline = this.parseBracedValue()
      const body = this.parseBracedPropositionBody()
      const functors = inline ?? body.functors
      if (!Array.isArray(functors) || functors.length === 0) {
        this.fail("утверждение 'композиция' требует список функторов", kindToken)
      }
      const proposition = { kind: "compose", functors: functors.map((item) => String(item).normalize("NFC")), arg: body.arg }
      if (typeof body.detail === "string") proposition.detail = body.detail
      return proposition
    }
    return this.fail(`неизвестный вид утверждения '${kindToken.value}'`, kindToken)
  }

  parseBracedPropositionBody() {
    this.expectPunct("{")
    const body = {}
    while (!this.atPunct("}") && !this.at("eof")) {
      this.skipSeparators()
      if (this.atPunct("}")) break
      if (this.atKw("proposition")) {
        body.arg = this.parseBracedProposition(true)
        continue
      }
      if ((this.atName() || this.at("keyword")) && propositionKind(tokenText(this.peek())) !== null && !this.atPunct(":", 1)) {
        body.arg = this.parseBracedProposition(false)
        continue
      }
      const key = propositionProperty(this.expectName("ожидалось свойство утверждения"))
      this.eatPunct(":")
      body[key] = this.parseBracedValue()
      this.skipSeparators()
    }
    this.expectPunct("}")
    return body
  }

  parseBracedValue() {
    const token = this.peek()
    if (token.kind === "string" || token.kind === "number") {
      this.next()
      return token.value
    }
    if (token.kind === "keyword" && ["litTrue", "litFalse", "litNull"].includes(token.value)) {
      this.next()
      return literalOfKeyword(token.value)
    }
    if (token.kind === "name" || token.kind === "keyword") {
      this.next()
      return tokenText(token)
    }
    if (this.atPunct("[")) {
      this.next()
      const items = []
      while (!this.atPunct("]") && !this.at("eof")) {
        this.skipSeparators()
        if (this.atPunct("]")) break
        items.push(this.parseBracedValue())
        this.eatPunct(",")
      }
      this.expectPunct("]")
      return items
    }
    if (this.atPunct("{")) {
      this.next()
      const result = {}
      while (!this.atPunct("}") && !this.at("eof")) {
        this.skipSeparators()
        if (this.atPunct("}")) break
        const key = this.expectName("ожидался ключ объекта")
        this.expectPunct(":")
        result[key] = this.parseBracedValue()
        this.eatPunct(",")
      }
      this.expectPunct("}")
      return result
    }
    return this.fail(`не разобрана конструкция: ожидалось значение, получено '${token.value}'`)
  }
}

// ── вспомогательное ─────────────────────────────────────────────────────────

function literalOfKeyword(id) {
  if (id === "litTrue") return true
  if (id === "litFalse") return false
  return null
}

function tokenText(token) {
  if (token.kind === "keyword") return token.text
  if (token.kind === "number") return token.text ?? String(token.value)
  return String(token.value)
}

function ftsTypeString(type) {
  if (type.fts !== undefined) return type.fts
  if (type.kind === "number") return "Число"
  if (type.kind === "string") return "Строка"
  if (type.kind === "flag") return "Признак"
  if (type.kind === "nothing") return "Ничто"
  if (type.kind === "named") return type.name
  if (type.kind === "list") return `список ${ftsTypeString(type.of)}`
  /* У FTS типа функции нет и быть не может — ядро знает только скаляры,
     списки и объекты. Слово даётся ради читаемости комментария в напечатанном
     коде: пустая строка выглядела бы как потерянный тип. */
  if (type.kind === "fn") return "функция"
  return type.kind
}

/**
 * Значение примера: разворачиваем литеральное выражение в обычное значение.
 *
 * Конструктор варианта даёт не запись из его полей, а `{ variant, fields }` —
 * ту самую запись значения в JSON, которую читает `reifyValue` (builtins.mjs)
 * и которую печатает `JSON.stringify` над `FlangVariant`. Раньше здесь
 * конструктор сворачивался в запись и имя варианта терялось: пример у функции,
 * работающей с суммой типов, записать было нечем — значение не проходило
 * проверку типов и не сопоставлялось ни с одним образцом.
 */
function literalValue(expression, onError) {
  if (expression.kind === "literal") return expression.value
  /* Значение-функция в примере — это тег, и записывается он так же, как любой
     вариант без полей: дефункционализация не «превращается» в тег при печати,
     она им и является уже здесь. Отсюда `дано ф равно функция «Удвоить»`
     сериализуется в `{ variant: "Удвоить", fields: {} }` и читается обратно
     тем же `reifyValue`, что читает варианты. */
  if (expression.kind === "fnref") return { variant: expression.name, fields: {} }
  if (expression.kind === "list") return expression.items.map((item) => literalValue(item, onError))
  if (expression.kind === "construct") {
    const fields = {}
    for (const [key, value] of Object.entries(expression.fields)) fields[key] = literalValue(value, onError)
    return { variant: expression.variant, fields }
  }
  if (expression.kind === "record") {
    const result = {}
    for (const [key, value] of Object.entries(expression.fields)) result[key] = literalValue(value, onError)
    return result
  }
  return onError()
}

function propositionKind(value) {
  const aliases = {
    witness: ["witness", "свидетельство"],
    apply: ["apply", "применить"],
    compose: ["compose", "композиция"],
  }
  for (const [kind, names] of Object.entries(aliases)) if (names.includes(value)) return kind
  return null
}

function propositionProperty(value) {
  const aliases = {
    селектор: "selector",
    значение: "value",
    путь: "path",
    описание: "detail",
    функтор: "functor",
    функторы: "functors",
    аргумент: "arg",
  }
  return aliases[value] ?? value
}

function formatType(parts) {
  return parts
    .join(" ")
    .replace(/\s+([>,.\[\]])/gu, "$1")
    .replace(/([<.\[])\s+/gu, "$1")
    .replace(/\s*\|\s*/gu, " | ")
    .replace(/\s*&\s*/gu, " & ")
    .trim()
    .normalize("NFC")
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
