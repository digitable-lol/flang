/**
 * Бэкенд кодогенерации ftsc → Java (JDK 25).
 *
 * Решения и их обоснование:
 *
 * 1. **Объект → `record`.** Объект FTS — это неизменяемые данные с равенством по
 *    значению и без собственного поведения; ровно это и есть Java `record`:
 *    конструктор, аксессоры, `equals`/`hashCode`/`toString` печатает компилятор,
 *    а нам не нужно решать, что переопределять руками.
 *
 * 2. **Опциональное поле (`X | undefined`) → `Optional<T>` как тип компонента
 *    записи**, а не nullable-поле с аннотацией. У аннотаций (`@Nullable` и т.п.)
 *    нет стандартной реализации в JDK — пришлось бы тащить библиотеку ради
 *    заметки для линтера, а сама проверка осталась бы на совести вызывающего
 *    (аннотация не запрещает передать null). `Optional` — часть стандартной
 *    библиотеки, отсутствие значения видно в сигнатуре аксессора и обязано быть
 *    обработано explicit-но. Антипаттерн «Optional как поле» из Effective Java
 *    здесь неприменим: объекты FTS — не DTO для JSON/JPA и не сериализуются
 *    напрямую, это чистые модели предметной области, для которых Optional в
 *    публичном API аксессора как раз и предназначен.
 *
 *    Более того, `Optional` даёт бесплатно ровно то поведение, которое требует
 *    ядро FTS: если правило или свойство утилиты обращается к отсутствующему
 *    опциональному полю, вычисление обязано прерваться в момент чтения поля, а
 *    не тихо взять umolчальное значение. `Optional.orElseThrow()` делает это
 *    без единой строчки собственного кода, бросая стандартный
 *    `NoSuchElementException` — отдельный от `FtsPropertyViolation`, потому что
 *    это разные отказы: там нарушен постуловие модели (нормальный доменный
 *    исход), здесь — не выполнен контракт вызова утилиты (входные данные не
 *    поддерживают то, что от них требует правило).
 *
 * 3. **Свойство → `FtsPropertyViolation extends RuntimeException`.** Свойство —
 *    постусловие: как только оно нарушено, результату нельзя доверять. Java не
 *    умеет `Result<T, E>` без сторонней библиотеки (запрещено п. 5 контракта
 *    бэкенда — «ноль зависимостей»), а собственный код возврата означало бы,
 *    что вызывающий код может забыть его проверить — компилятор Java не заставит.
 *    Непойманное unchecked-исключение прерывает выполнение немедленно и печатает
 *    стек вызовов; оно не требует объявления в сигнатуре `throws` (проверяемое
 *    исключение раздуло бы сигнатуру каждой утилиты и незакономерно требовало бы
 *    `try/catch` там, где нарушение постусловия — это, как правило, ошибка
 *    модели или её входа, а не ожидаемая бизнес-ветка).
 *
 * 4. **Именованное состояние → `boolean`.** В IR у поля/домена морфизма может
 *    стоять произвольное имя, которого нет среди структур модуля (например,
 *    «Готов к отгрузке» в фикстуре shipment). Ядро FTS хранит свидетельство
 *    такого состояния как да/нет (см. `proposition.arg.value` в IR: `true`),
 *    значит носитель — ровно один бит. Обёртка (класс-маркер) добавила бы
 *    файл и коллизию имён там, где IR не даёт ни одного дополнительного факта
 *    о состоянии, кроме имени; поэтому состояние транслируется в `boolean` с
 *    исходным именем в javadoc — как это делают соседние бэкенды (typescript.mjs
 *    делает то же самое по той же причине).
 *
 * 5. **Пакеты.** Модуль IR → пакет `<проект>.<модуль>` (пример из SPEC.md:
 *    `shop.prodazhi`). Внутри пакета — по файлу на класс, потому что это
 *    единственная раскладка, которую понимает `javac`: имя публичного типа
 *    обязано совпасть с именем файла.
 *
 * 6. **Ссылки между пакетами — по полному имени, без `import`.** Один файл —
 *    один класс, поэтому `import`-ов было бы много и почти все — с одного
 *    использования; полное имя (`shop.prodazhi.Pokupka`) короче, чем сам
 *    список правил именования импортов, и не может столкнуться с другим
 *    классом с тем же простым именем в другом пакете.
 *
 * Детерминированность: ни `Date`, ни случайных имён, ни обхода `Map`/`Set` в
 * порядке, отличном от вставки, — весь порядок берётся из массивов IR (модули,
 * структуры, поля, правила, примеры, функторы) в порядке их следования.
 */
import { camel, createNamer, pascal, quote, snake } from "../naming.mjs"
import { escapeBidiInFiles, escapeBidiUnicode4 } from "../bidi.mjs"

export const target = {
  id: "java",
  name: "Java",
  extension: ".java",
  /* Реальная проверка — двухшаговая (javac, затем java с раннером примеров) и
     живёт в tools/ftsc/test/emit-java.test.mjs; здесь — только то, чем можно
     убедиться, что тулчейн вообще доступен, и представление «test» из
     контракта бэкенда (раздел 5 SPEC.md). */
  toolchain: { probe: ["javac", "--version"], test: ["javac", "-Xlint:all", "-Werror"] },
}

const fail = (message) => {
  throw new Error(`бэкенд java: ${message}`)
}

/* Ключевые слова и литералы Java (включая контекстные: var, record, yield,
   sealed, permits — с JDK 25 все они уже действуют в соответствующих позициях)
   плюс модульные слова (module-info) на случай, если модель когда-нибудь
   назовёт модуль так, что его пакет-сегмент совпадёт буквально. */
const JAVA_KEYWORDS = [
  "abstract",
  "assert",
  "boolean",
  "break",
  "byte",
  "case",
  "catch",
  "char",
  "class",
  "const",
  "continue",
  "default",
  "do",
  "double",
  "else",
  "enum",
  "extends",
  "final",
  "finally",
  "float",
  "for",
  "goto",
  "if",
  "implements",
  "import",
  "instanceof",
  "int",
  "interface",
  "long",
  "native",
  "new",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "short",
  "static",
  "strictfp",
  "super",
  "switch",
  "synchronized",
  "this",
  "throw",
  "throws",
  "transient",
  "try",
  "void",
  "volatile",
  "while",
  "true",
  "false",
  "null",
  "var",
  "record",
  "yield",
  "sealed",
  "permits",
  "open",
  "module",
  "requires",
  "exports",
  "opens",
  "uses",
  "provides",
  "to",
  "with",
  "transitive",
  "_",
]

/* Простые имена из java.lang/java.util, которые бэкенд использует без импорта
   (в т.ч. неявный java.lang.*). Если структура или утилита модели
   транслитерируется в одно из этих имён, бэкенд обязан отказать сборкой, а не
   молча породить файл, ломающий все остальные файлы того же пакета: голое имя
   «String» в любом другом файле пакета стало бы ссылаться на локальный класс
   вместо java.lang.String. */
const OCCUPIED_TYPE_NAMES = [
  "String",
  "Object",
  "Boolean",
  "Double",
  "Number",
  "Exception",
  "RuntimeException",
  "Optional",
  "LocalDate",
  "Override",
  "FtsPropertyViolation",
]

/* Имена методов Object: аксессор record-компонента с таким именем и другим
   типом возврата не компилируется («cannot override ... incompatible return
   type»), поэтому это тоже коллизия сборки, а не косметика. */
const FIELD_OCCUPIED_NAMES = ["hashCode", "equals", "toString", "getClass", "wait", "notify", "notifyAll", "clone", "finalize"]

/* Java допускает Unicode-идентификаторы, но не идентификатор, начинающийся с
   цифры. naming.mjs транслитерирует кириллицу, но если после этого первым
   символом окажется цифра (имя модели начиналось с числа), результат остаётся
   синтаксически невалидным — подстрахуемся здесь же, а не полагаясь на то,
   что модель никогда так не назовёт что-либо. */
const safe = (style) => (value) => {
  const identifier = style(value)
  return /^[0-9]/u.test(identifier) ? `_${identifier}` : identifier
}

const safePascal = safe(pascal)
const safeCamel = safe(camel)
const safeSnake = safe(snake)

/** Экранирует «* /»-последовательность внутри javadoc/комментария — иначе исходное имя из модели могло бы закрыть комментарий раньше времени. */
function docEscape(text) {
  return String(text).replace(/\*\//gu, "* /")
}

const pkgPath = (pkg) => pkg.split(".").join("/")

/** Литерал double. Java требует десятичную точку либо суффикс — иначе `10000` в контексте double компилируется только за счёт неявного расширения int→double, что работает, но точку явно печатать надёжнее и читаемее. */
function numberLiteral(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(`число ${JSON.stringify(value)} не может быть представлено литералом double`)
  }
  if (Number.isInteger(value)) return `${value}.0`
  const text = String(value)
  if (/e/iu.test(text)) {
    /* Резервный путь для очень больших/малых значений; ни одна из фикстур
       такого не порождает (проценты и суммы — обычные десятичные дроби), но
       результат обязан остаться валидным литералом double, а не сломаться
       на числах вроде 1e-7. */
    return text.includes(".") ? text : text.replace(/e/iu, ".0e")
  }
  return text
}

const percentLiteral = (percent) => numberLiteral(percent / 100)

/** Один из пяти базовых типов FTS → тип Java. Всё остальное — не примитив (см. resolveBase). */
function primitiveType(name) {
  switch (name) {
    case "Строка":
      return { kind: "string", javaType: "String" }
    case "Число":
    case "Деньги":
      return { kind: "double", javaType: "double" }
    case "Признак":
      return { kind: "boolean", javaType: "boolean" }
    case "Дата":
      return { kind: "date", javaType: "java.time.LocalDate" }
    default:
      return null
  }
}

/** Boxed-тип для Optional<T>: примитивы упаковываются, ссылочные типы остаются собой. */
function boxed(javaType, kind) {
  if (kind === "double") return "Double"
  if (kind === "boolean" || kind === "state") return "Boolean"
  return javaType
}

/**
 * Тип поля/результата без учёта «| undefined»: один из пяти примитивов FTS,
 * объект (структура своего модуля или другой категории программы) либо
 * именованное состояние — имя, которое не примитив и не структура (см. п.4 в
 * шапке файла). Используется и для полей структур, и для входа/выхода
 * утилиты, и в раннере примеров — везде одно и то же правило разрешения типа.
 */
function resolveBase(base, m, globalStructures) {
  const prim = primitiveType(base)
  if (prim) return prim
  const local = m.structures.get(base)
  if (local) return { kind: "record", javaType: local.className, info: local }
  const cross = globalStructures.get(base)
  if (cross) return { kind: "record", javaType: `${cross.pkg}.${cross.className}`, info: cross }
  return { kind: "state", javaType: "boolean", stateName: base }
}

/** Полный тип поля/результата с учётом опциональности («X | undefined» → Optional<Boxed(X)>). */
function resolveType(raw, m, globalStructures) {
  const optional = /\|\s*undefined\s*$/u.test(raw)
  const base = raw.replace(/\s*\|\s*undefined\s*$/u, "").trim()
  const inner = resolveBase(base, m, globalStructures)
  if (!optional) return inner
  return { kind: "optional", javaType: `java.util.Optional<${boxed(inner.javaType, inner.kind)}>`, inner }
}

/** Скалярный литерал JS-значения операнда {kind:"value", value}. Тип определяется по typeof: IR не размечает его отдельно. */
function valueLiteral(value) {
  if (typeof value === "number") return { expr: numberLiteral(value), kind: "double" }
  if (typeof value === "boolean") return { expr: value ? "true" : "false", kind: "boolean" }
  if (typeof value === "string") return { expr: quote(value), kind: "string" }
  fail(`значение ${JSON.stringify(value)} не имеет литерала в Java`)
  return null
}

/** Литерал значения по УЖЕ известному виду поля — используется для входов примеров, где вид диктует структура, а не typeof. */
function literalForKind(kind, value) {
  switch (kind) {
    case "double":
      return numberLiteral(value)
    case "boolean":
    case "state":
      return value ? "true" : "false"
    case "string":
      return quote(value)
    case "date":
      return `java.time.LocalDate.parse(${quote(value)})`
    default:
      fail(`значение вида «${kind}» не имеет литерала-примера`)
      return null
  }
}

/** Сравнение «result/поле OP операнд» под конкретный вид левой части. */
function comparisonExpr(left, operator, rightExpr) {
  if (left.kind === "string") {
    switch (operator) {
      case "eq":
        return `${left.expr}.equals(${rightExpr})`
      case "neq":
        return `!${left.expr}.equals(${rightExpr})`
      case "gte":
        return `${left.expr}.compareTo(${rightExpr}) >= 0`
      case "lte":
        return `${left.expr}.compareTo(${rightExpr}) <= 0`
      case "gt":
        return `${left.expr}.compareTo(${rightExpr}) > 0`
      case "lt":
        return `${left.expr}.compareTo(${rightExpr}) < 0`
      default:
        fail(`неизвестный оператор условия «${operator}»`)
    }
  }
  if (left.kind === "date") {
    switch (operator) {
      case "eq":
        return `${left.expr}.isEqual(${rightExpr})`
      case "neq":
        return `!${left.expr}.isEqual(${rightExpr})`
      case "gte":
        return `!${left.expr}.isBefore(${rightExpr})`
      case "lte":
        return `!${left.expr}.isAfter(${rightExpr})`
      case "gt":
        return `${left.expr}.isAfter(${rightExpr})`
      case "lt":
        return `${left.expr}.isBefore(${rightExpr})`
      default:
        fail(`неизвестный оператор условия «${operator}»`)
    }
  }
  if (left.kind === "boolean" || left.kind === "state") {
    if (operator !== "eq" && operator !== "neq") {
      fail(`признак/состояние нельзя сравнивать оператором «${operator}» — допустимы только eq/neq`)
    }
    return `${left.expr} ${operator === "eq" ? "==" : "!="} ${rightExpr}`
  }
  const SYMBOLS = { eq: "==", neq: "!=", gte: ">=", lte: "<=", gt: ">", lt: "<" }
  const symbol = SYMBOLS[operator]
  if (!symbol) fail(`неизвестный оператор условия «${operator}»`)
  return `${left.expr} ${symbol} ${rightExpr}`
}

/** Заголовок сгенерированного файла: чем сгенерирован, из чего, запрет правок руками (см. SPEC.md, раздел 5.7). */
function fileHeader(description, source) {
  const lines = [`// Сгенерировано ftsc, бэкенд Java — ${description}.`]
  if (source) lines.push(`// Источник: ${source}.`)
  lines.push("// Не редактировать руками: правки будут потеряны при следующей генерации, меняйте .fts-модель.")
  return lines.join("\n")
}

/**
 * @param {object} program — IR проекта ftsc (см. tools/ftsc/SPEC.md, раздел 4)
 * @param {{ projectName?: string }} [options]
 * @returns {Array<{ path: string, content: string }>} пути относительно --out
 */
export function emit(program, options = {}) {
  if (!program || !Array.isArray(program.modules)) fail("IR не содержит списка модулей")
  const projectName = options.projectName ?? program.project ?? "fts"
  const rootPackage = safeSnake(projectName) || "fts"

  /* Пакет-сегмент на модуль. «functors» зарезервирован заранее: под ним лежит
     файл функторов между категориями, и модуль не должен получить то же имя. */
  const modulePackageNamer = createNamer(safeSnake, [...JAVA_KEYWORDS, "functors"])
  const modules = program.modules.map((mod) => {
    const pkgSegment = modulePackageNamer(mod.name)
    return { mod, pkg: `${rootPackage}.${pkgSegment}`, structures: new Map(), utilities: new Map() }
  })

  /* ПРОХОД 1: имена классов. Структуры и утилиты одного модуля живут в одном
     каталоге (один пакет — одно пространство имён файлов), поэтому у них один
     общий namer; названия классов нужны целиком до разрешения полей — поле
     одной структуры может ссылаться на другую структуру того же модуля,
     объявленную ниже. */
  for (const m of modules) {
    const typeNamer = createNamer(safePascal, [...JAVA_KEYWORDS, ...OCCUPIED_TYPE_NAMES])
    for (const structure of m.mod.document.structures ?? []) {
      m.structures.set(structure.name, {
        original: structure.name,
        className: typeNamer(structure.name),
        pkg: m.pkg,
        fields: null,
        raw: structure,
      })
    }
    for (const utility of m.mod.document.utilities ?? []) {
      m.utilities.set(utility.name, {
        original: utility.name,
        className: typeNamer(utility.name),
        pkg: m.pkg,
        raw: utility,
      })
    }
  }

  /* Реестр структур по исходному имени через ВСЕ модули — нужен полям, что
     ссылаются на объект другой категории, и функторам между модулями. Первое
     совпадение по порядку program.modules побеждает: коллизии одноимённых
     структур в разных модулях — редкость, которую фронтенд уже допустил, а
     не то, что обязан решать бэкенд. */
  const globalStructures = new Map()
  for (const m of modules) {
    for (const [name, info] of m.structures) {
      if (!globalStructures.has(name)) globalStructures.set(name, info)
    }
  }

  /* ПРОХОД 2: поля структур — теперь, когда имена всех классов известны. */
  for (const m of modules) {
    for (const info of m.structures.values()) {
      const fieldNamer = createNamer(safeCamel, [...JAVA_KEYWORDS, ...FIELD_OCCUPIED_NAMES])
      info.fields = (info.raw.fields ?? []).map((field) => ({
        original: field.name,
        javaName: fieldNamer(field.name),
        type: resolveType(field.type, m, globalStructures),
      }))
    }
  }

  const files = []
  let anyUtility = false

  for (const m of modules) {
    const info = emitPackageInfo(m)
    if (info) files.push(info)
    for (const structInfo of m.structures.values()) {
      files.push(emitStructureFile(m, structInfo))
    }
    for (const utilInfo of m.utilities.values()) {
      anyUtility = true
      files.push(emitUtilityFile(m, utilInfo, rootPackage, globalStructures))
    }
  }

  files.push(...emitFunctors(program, rootPackage, globalStructures))

  if (anyUtility) {
    files.push(emitExceptionFile(rootPackage))
    const runner = emitRunner(modules, rootPackage, projectName, globalStructures)
    if (runner) files.push(runner)
  }

  /* Последний шаг печати — снять сырые двунаправленные управляющие со всего
     вывода (../bidi.mjs). Имя FTS (правила, свойства, примера, категории) уезжает
     и в комментарий («правило «…»»), и в строковый литерал (System.out.println
     прогонщика примеров, имя свойства в FtsPropertyViolation), а комментарий читают
     первым и проверить исполнением не могут: javac собирает такой файл молча даже
     под -Xlint:all -Werror — ровно ради этого молчания атаку и придумали. Форма
     Java — `\uXXXX`; другой для этих кодовых точек у языка нет вовсе. */
  return escapeBidiInFiles(files, escapeBidiUnicode4)
}

/** Доступ к полю входной структуры утилиты: снимает Optional через orElseThrow() — см. п.2 в шапке файла. */
function fieldAccess(ctx, name) {
  const field = ctx.fields.get(name)
  if (!field) fail(`утилита «${ctx.utilityName}»: структура «${ctx.inputStructName}» не содержит поле «${name}»`)
  const base = `${ctx.inputVar}.${field.javaName}()`
  if (field.type.kind === "optional") {
    return { expr: `${base}.orElseThrow()`, kind: field.type.inner.kind }
  }
  return { expr: base, kind: field.type.kind }
}

/** Операнд правила/свойства: значение, поле, процент от поля или текущий результат. */
function operandExpr(operand, ctx) {
  switch (operand.kind) {
    case "value":
      return valueLiteral(operand.value)
    case "result":
      return { expr: ctx.resultVar, kind: ctx.resultKind }
    case "field":
      return fieldAccess(ctx, operand.field)
    case "percent": {
      const field = fieldAccess(ctx, operand.field)
      if (field.kind !== "double") {
        fail(`утилита «${ctx.utilityName}»: процент можно взять только от числового поля, а «${operand.field}» — другого вида`)
      }
      return { expr: `(${field.expr} * ${percentLiteral(operand.percent)})`, kind: "double" }
    }
    default:
      fail(`утилита «${ctx.utilityName}»: неизвестный вид операнда «${operand.kind}»`)
      return null
  }
}

/** Условие `when`: элементы соединены логическим И (см. SPEC.md — это не if/else-цепочка внутри правила). */
function renderWhen(when, ctx) {
  if (!when || when.length === 0) return "true"
  return when
    .map((item) => {
      const left = fieldAccess(ctx, item.field)
      const right = operandExpr(item.value, ctx)
      return comparisonExpr(left, item.operator, right.expr)
    })
    .join(" && ")
}

function renderRule(rule, ctx) {
  const condition = renderWhen(rule.when, ctx)
  const value = operandExpr(rule.action.value, ctx)
  if (rule.action.kind === "add" && ctx.resultKind !== "double") {
    fail(
      `утилита «${ctx.utilityName}»: правило «${rule.name}» складывает результат вида «${ctx.resultKind}» — сложение определено только для чисел`,
    )
  }
  let statement
  if (rule.action.kind === "add") statement = `${ctx.resultVar} += ${value.expr};`
  else if (rule.action.kind === "set") statement = `${ctx.resultVar} = ${value.expr};`
  else {
    fail(`утилита «${ctx.utilityName}»: неизвестный вид действия «${rule.action.kind}»`)
  }
  return [`        // правило «${docEscape(rule.name)}»`, `        if (${condition}) {`, `            ${statement}`, "        }"]
}

function renderProperty(property, ctx) {
  const right = operandExpr(property.value, ctx)
  const check = comparisonExpr({ expr: ctx.resultVar, kind: ctx.resultKind }, property.operator, right.expr)
  return [
    `        // свойство «${docEscape(property.name)}» — постусловие; нарушение прекращает выполнение`,
    `        if (!(${check})) {`,
    `            throw new ${ctx.exceptionFqcn}(${quote(ctx.utilityName)}, ${quote(property.name)});`,
    "        }",
  ]
}

/** Javadoc-заметка о виде поля рядом с его аксессором — исходное имя FTS обязано остаться читаемым. */
function fieldJavadoc(field) {
  let note = ""
  if (field.type.kind === "state") {
    note = ` — именованное состояние «${docEscape(field.type.stateName)}» (хранится как Признак/boolean)`
  } else if (field.type.kind === "optional") {
    note = " — необязательное поле FTS («X | undefined»)"
  } else if (field.type.kind === "record") {
    note = ` — ссылка на объект «${docEscape(field.type.info.original)}»`
  }
  return ` * @param ${field.javaName} «${docEscape(field.original)}»${note}`
}

function emitStructureFile(m, info) {
  const header = fileHeader(`модуль «${m.mod.name}» (категория «${m.mod.category}»)`, m.mod.source)
  const components = info.fields.map((f) => `${f.type.javaType} ${f.javaName}`).join(", ")
  const paramDocs = info.fields.map(fieldJavadoc).join("\n")
  const content = `${header}

package ${m.pkg};

/**
 * FTS-объект «${docEscape(info.original)}» из категории «${docEscape(m.mod.category)}».
 *
${paramDocs || " * (объект без полей)"}
 */
public record ${info.className}(${components}) {
}
`
  return { path: `${pkgPath(m.pkg)}/${info.className}.java`, content }
}

function emitUtilityFile(m, info, rootPackage, globalStructures) {
  const header = fileHeader(`модуль «${m.mod.name}» (категория «${m.mod.category}»)`, m.mod.source)
  const u = info.raw
  // Входная структура утилиты ищется сначала в своём модуле, затем — как и
  // поля структур — во всей программе (утилита вправе принимать объект,
  // импортированный из другой категории).
  const resolvedInput = m.structures.get(u.input) ?? globalStructures.get(u.input)
  if (!resolvedInput) fail(`утилита «${u.name}»: входная структура «${u.input}» не найдена`)

  const outputType = resolveType(u.output, m, globalStructures)
  if (outputType.kind === "record" || outputType.kind === "optional") {
    fail(
      `утилита «${u.name}»: результат вида «${u.output}» не поддержан бэкендом Java (нужен Строка/Число/Деньги/Признак/состояние)`,
    )
  }

  const fieldsMap = new Map(resolvedInput.fields.map((f) => [f.original, f]))
  const ctx = {
    inputVar: "input",
    resultVar: "result",
    utilityName: u.name,
    inputStructName: u.input,
    fields: fieldsMap,
    resultKind: outputType.kind,
    exceptionFqcn: `${rootPackage}.FtsPropertyViolation`,
  }

  const initial = valueLiteral(u.initial)
  const bodyLines = [`        ${outputType.javaType} ${ctx.resultVar} = ${initial.expr};`]
  for (const rule of u.rules ?? []) {
    bodyLines.push("", ...renderRule(rule, ctx))
  }
  for (const property of u.properties ?? []) {
    bodyLines.push("", ...renderProperty(property, ctx))
  }
  bodyLines.push("", `        return ${ctx.resultVar};`)

  const inputTypeSyntax =
    resolvedInput.pkg === m.pkg ? resolvedInput.className : `${resolvedInput.pkg}.${resolvedInput.className}`

  const content = `${header}

package ${m.pkg};

/**
 * FTS-утилита «${docEscape(u.name)}»: «${docEscape(u.input)}» → «${docEscape(u.output)}».
 * Выполняются ВСЕ правила, чьи условия истинны, в порядке объявления — это не if/else.
 */
public final class ${info.className} {

    private ${info.className}() {
    }

    /** Вычисляет «${docEscape(u.name)}» для «${docEscape(u.input)}». */
    public static ${outputType.javaType} apply(${inputTypeSyntax} input) {
${bodyLines.join("\n")}
    }
}
`
  return { path: `${pkgPath(m.pkg)}/${info.className}.java`, content }
}

function emitPackageInfo(m) {
  const doc = m.mod.document
  const morphisms = doc.functors ?? []
  const proposition = doc.proposition ?? null
  if (morphisms.length === 0 && proposition === null) return null

  const header = fileHeader(`модуль «${m.mod.name}» (категория «${m.mod.category}»)`, m.mod.source)
  const lines = ["/**", ` * Модуль «${docEscape(m.mod.name)}» (категория «${docEscape(m.mod.category)}»).`]
  if (morphisms.length > 0) {
    lines.push(" *")
    lines.push(" * <p>Морфизмы категории (доказаны компилятором ядра FTS до генерации кода — здесь только документируются):")
    lines.push(" * <ul>")
    for (const morphism of morphisms) {
      lines.push(
        `  *   <li>«${docEscape(morphism.name)}»: «${docEscape(morphism.domain)}» &rarr; «${docEscape(morphism.codomain)}»</li>`,
      )
    }
    lines.push(" * </ul>")
  }
  if (proposition !== null) {
    lines.push(" *")
    lines.push(" * <p>Теорема модуля доказана компилятором ядра до генерации кода; ftsc не")
    lines.push(" * перепроверяет доказательство в рантайме, а лишь документирует уже проверенный факт.")
    if (proposition.detail) lines.push(` * <p>{@code ${docEscape(proposition.detail)}}`)
  }
  lines.push(" */")
  const content = `${header}\n\n${lines.join("\n")}\npackage ${m.pkg};\n`
  return { path: `${pkgPath(m.pkg)}/package-info.java`, content }
}

function emitExceptionFile(rootPackage) {
  const header = fileHeader(`общая инфраструктура проекта («${rootPackage}»)`)
  const content = `${header}

package ${rootPackage};

/**
 * Нарушение свойства (постусловия) FTS-утилиты.
 *
 * <p>Свойство в FTS — это постусловие, обязанное выполняться всегда; его
 * нарушение означает, что результату вычисления нельзя доверять. Unchecked
 * {@link RuntimeException} прерывает выполнение немедленно, не позволяя
 * вызывающему коду продолжить работу с некорректным значением, и при этом не
 * раздувает сигнатуру каждой утилиты декларацией {@code throws} или отдельным
 * типом результата — в отличие от кода возврата, о непойманном исключении
 * невозможно молча забыть: оно прервёт программу и напечатает стек вызовов.
 */
public final class FtsPropertyViolation extends RuntimeException {

    private static final long serialVersionUID = 1L;

    private final String utility;
    private final String property;

    /**
     * @param utility исходное имя FTS-утилиты, вычисление которой нарушило свойство
     * @param property исходное имя нарушенного FTS-свойства
     */
    public FtsPropertyViolation(String utility, String property) {
        super("свойство «" + property + "» утилиты «" + utility + "» нарушено");
        this.utility = utility;
        this.property = property;
    }

    /** Исходное имя FTS-утилиты, чьё свойство нарушено. */
    public String utility() {
        return utility;
    }

    /** Исходное имя нарушенного FTS-свойства. */
    public String property() {
        return property;
    }
}
`
  return { path: `${pkgPath(rootPackage)}/FtsPropertyViolation.java`, content }
}

/** Функторы между категориями (program.functors, верхнеуровневый IR) — п.8 контракта бэкенда: F: A → B. */
function emitFunctors(program, rootPackage, globalStructures) {
  const functors = program.functors ?? []
  if (functors.length === 0) return []

  const pkg = `${rootPackage}.functors`
  const typeNamer = createNamer(safePascal, [...JAVA_KEYWORDS, ...OCCUPIED_TYPE_NAMES])
  const header = fileHeader("функторы между категориями проекта")
  const files = []

  for (const functor of functors) {
    const className = typeNamer(functor.name)
    const methodNamer = createNamer((value) => value, JAVA_KEYWORDS)
    const methodBlocks = []

    for (const object of functor.objects ?? []) {
      const fromInfo = globalStructures.get(object.from)
      const toInfo = globalStructures.get(object.to)
      if (!fromInfo) fail(`функтор «${functor.name}»: объект-источник «${object.from}» не найден среди структур программы`)
      if (!toInfo) fail(`функтор «${functor.name}»: объект-образ «${object.to}» не найден среди структур программы`)

      const fromFqcn = `${fromInfo.pkg}.${fromInfo.className}`
      const toFqcn = `${toInfo.pkg}.${toInfo.className}`
      const methodName = methodNamer(`convert${fromInfo.className}To${toInfo.className}`)

      const bySourceExpr = new Map()
      for (const fieldMap of object.fields ?? []) {
        const sourceField = fromInfo.fields.find((f) => f.original === fieldMap.from)
        if (!sourceField) fail(`функтор «${functor.name}»: поле-источник «${fieldMap.from}» не найдено в «${object.from}»`)
        bySourceExpr.set(fieldMap.to, `source.${sourceField.javaName}()`)
      }
      const args = toInfo.fields.map((field) => {
        const expr = bySourceExpr.get(field.original)
        if (expr === undefined) {
          fail(
            `функтор «${functor.name}»: поле «${field.original}» объекта «${object.to}» не получает значения ни от одного поля-источника`,
          )
        }
        return expr
      })

      const mapping = (object.fields ?? []).map((fm) => `«${docEscape(fm.from)}» → «${docEscape(fm.to)}»`).join(", ")
      const argLines = args.map((arg, index) => `            ${arg}${index === args.length - 1 ? "" : ","}`)
      methodBlocks.push(
        [
          "    /**",
          `     * Функтор «${docEscape(functor.name)}»: «${docEscape(object.from)}» → «${docEscape(object.to)}».`,
          mapping ? `     * Соответствие полей: ${mapping}.` : null,
          "     */",
          `    public static ${toFqcn} ${methodName}(${fromFqcn} source) {`,
          `        return new ${toFqcn}(`,
          ...argLines,
          "        );",
          "    }",
        ]
          .filter((line) => line !== null)
          .join("\n"),
      )
    }

    const morphismNote =
      (functor.morphisms ?? []).length > 0
        ? ` Морфизмы: ${functor.morphisms.map((m) => `«${docEscape(m.from)}» ↦ «${docEscape(m.to)}»`).join(", ")}.`
        : ""

    const content = `${header}

package ${pkg};

/**
 * Функтор «${docEscape(functor.name)}»: категория «${docEscape(functor.from)}» → категория «${docEscape(functor.to)}».
 * Тотальность на объектах/полях и согласованность типов уже проверены компилятором ftsc
 * (см. SPEC.md, раздел 3) — здесь печатается сама функция переноса объекта.${morphismNote}
 */
public final class ${className} {

    private ${className}() {
    }

${methodBlocks.join("\n\n")}
}
`
    files.push({ path: `${pkgPath(pkg)}/${className}.java`, content })
  }

  return files
}

function compareExpr(kind, actualExpr, expectedExpr) {
  switch (kind) {
    case "double":
      return `Math.abs(${actualExpr} - ${expectedExpr}) < 1e-6`
    case "boolean":
    case "state":
      return `${actualExpr} == ${expectedExpr}`
    case "string":
      return `${actualExpr}.equals(${expectedExpr})`
    case "date":
      return `${actualExpr}.isEqual(${expectedExpr})`
    default:
      fail(`сравнение для результата вида «${kind}» не поддержано раннером примеров`)
      return null
  }
}

function exampleFieldLiteral(field, input, utilityName, exampleName) {
  const present = input !== undefined && input !== null && Object.prototype.hasOwnProperty.call(input, field.original)
  if (field.type.kind === "optional") {
    if (!present || input[field.original] === null || input[field.original] === undefined) {
      return "java.util.Optional.empty()"
    }
    return `java.util.Optional.of(${literalForKind(field.type.inner.kind, input[field.original])})`
  }
  if (!present) fail(`утилита «${utilityName}», пример «${exampleName}»: не задано обязательное поле «${field.original}»`)
  return literalForKind(field.type.kind, input[field.original])
}

/** Самостоятельный раннер примеров: без JUnit и без сети, печатает «N/M passed», код возврата ≠ 0 при провале. */
function emitRunner(modules, rootPackage, projectName, globalStructures) {
  const entries = []
  for (const m of modules) {
    for (const info of m.utilities.values()) {
      const examples = info.raw.examples ?? []
      if (examples.length > 0) entries.push({ m, info, examples })
    }
  }
  if (entries.length === 0) return null

  const className = `${pascal(projectName) || "Fts"}ExampleRunner`
  const header = fileHeader(`раннер примеров проекта «${projectName}» (node:test здесь не используется — стандартный main)`)

  const blocks = []
  for (const { m, info, examples } of entries) {
    const u = info.raw
    const inputInfo = m.structures.get(u.input) ?? globalStructures.get(u.input)
    if (!inputInfo) fail(`утилита «${u.name}»: входная структура «${u.input}» не найдена (раннер примеров)`)
    const outputType = resolveType(u.output, m, globalStructures)
    const utilFqcn = `${info.pkg}.${info.className}`
    const inputFqcn = `${inputInfo.pkg}.${inputInfo.className}`

    for (const example of examples) {
      const args = inputInfo.fields.map((field) => exampleFieldLiteral(field, example.input, u.name, example.name))
      const expected = valueLiteral(example.expected).expr
      const label = quote(`FAIL ${u.name} / ${example.name}: ожидалось `)
      blocks.push(
        [
          "        {",
          "            total++;",
          `            var input = new ${inputFqcn}(${args.join(", ")});`,
          `            ${outputType.javaType} actual = ${utilFqcn}.apply(input);`,
          `            boolean ok = ${compareExpr(outputType.kind, "actual", expected)};`,
          "            if (ok) {",
          "                passed++;",
          "            } else {",
          `                System.out.println(${label} + ${expected} + ${quote(", получено ")} + actual);`,
          "            }",
          "        }",
        ].join("\n"),
      )
    }
  }

  const content = `${header}

package ${rootPackage};

/**
 * Самостоятельный раннер примеров FTS проекта «${docEscape(projectName)}».
 * Каждый {@code пример} модели становится одной проверкой; JUnit не требуется и
 * сеть не нужна (п.4, 5 контракта бэкенда — тесты обязаны реально проходить, а
 * зависимостей быть не должно). Печатает «N/M passed» и завершает процесс кодом
 * 1, если хотя бы одна проверка провалилась.
 */
public final class ${className} {

    private ${className}() {
    }

    public static void main(String[] args) {
        int total = 0;
        int passed = 0;

${blocks.join("\n\n")}

        System.out.println(passed + "/" + total + " passed");
        if (passed != total) {
            System.exit(1);
        }
    }
}
`
  return { path: `${pkgPath(rootPackage)}/${className}.java`, content }
}
