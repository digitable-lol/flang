/**
 * Бэкенд ftsc: печатает Python 3.12 для IR компилятора (см. tools/ftsc/SPEC.md,
 * раздел 5).
 *
 * Как и Go-бэкенд (см. emit/go.mjs), утилиты печатаются прямыми
 * последовательными операторами (`if <условие>: result += ...`) в порядке
 * объявления правил — это ровно та стратегия, которую использует
 * reference-реализация TypeScript в src/utility.ts
 * (renderImplementation/resolveOperand), просто на другом целевом языке.
 *
 * Один модуль IR → один файл Python внутри пакета проекта; один функтор между
 * категориями → отдельный файл с функцией(ями) преобразования «объект домена →
 * объект кодомена». Свойства (постусловия) утилит бросают общее исключение
 * FtsPropertyViolation из одного файла errors.py на весь проект.
 */
import { createNamer, pascal, quote, snake } from "../naming.mjs"
import { escapeBidiInFiles, escapeBidiUnicode4 } from "../bidi.mjs"

export const target = {
  id: "python",
  name: "Python",
  extension: ".py",
  toolchain: { probe: ["python3", "--version"], test: ["python3", "-m", "unittest", "discover"] },
}

/* Ключевые слова Python 3.12 — коллизия модельного имени с одним из них обязана
   быть ошибкой сборки, а не молчаливым переименованием. */
const PY_RESERVED = [
  "False",
  "None",
  "True",
  "and",
  "as",
  "assert",
  "async",
  "await",
  "break",
  "class",
  "continue",
  "def",
  "del",
  "elif",
  "else",
  "except",
  "finally",
  "for",
  "from",
  "global",
  "if",
  "import",
  "in",
  "is",
  "lambda",
  "nonlocal",
  "not",
  "or",
  "pass",
  "raise",
  "return",
  "try",
  "while",
  "with",
  "yield",
  "self",
]

const COMPARE_OPS = { eq: "==", neq: "!=", gte: ">=", lte: "<=", gt: ">", lt: "<" }

/* Идентификатор Python не может начинаться с цифры. */
function safeIdent(identifier) {
  return /^[0-9]/.test(identifier) ? `_${identifier}` : identifier
}

function wrapNamer(namer) {
  return (value) => safeIdent(namer(value))
}

/**
 * Тип поля/вывода FTS → представление в Python. Именованное состояние (всё,
 * что не входит в пятёрку базовых типов ядра) наблюдается в IR только как
 * bool (order-shipment.fts: «готов к отгрузке» — да/нет), поэтому
 * представлено как typing.NewType поверх bool: отдельный узнаваемый тип без
 * рантайм-проверок, которых сам язык не даёт бесплатно.
 */
function resolveType(raw) {
  const normalized = raw.replace(/\s*\|\s*undefined/gu, "").trim()
  const optional = normalized !== raw.trim()
  switch (normalized) {
    case "Строка":
      return { kind: "string", optional }
    case "Число":
    case "Деньги":
      return { kind: "number", optional }
    case "Признак":
      return { kind: "bool", optional }
    case "Дата":
      return { kind: "date", optional }
    default:
      return { kind: "state", optional, stateOriginal: normalized }
  }
}

function pyBaseTypeName(info, stateRegistry) {
  switch (info.kind) {
    case "string":
      return "str"
    case "number":
      return "float"
    case "bool":
      return "bool"
    case "date":
      return "str"
    case "state": {
      const entry = stateRegistry.get(info.stateOriginal)
      if (!entry) throw new Error(`внутренняя ошибка ftsc: неизвестное именованное состояние «${info.stateOriginal}»`)
      return entry.ident
    }
    default:
      throw new Error(`неизвестный вид типа «${info.kind}»`)
  }
}

function pyTypeName(info, stateRegistry) {
  const base = pyBaseTypeName(info, stateRegistry)
  return info.optional ? `${base} | None` : base
}

function pyLiteral(value) {
  if (typeof value === "boolean") return value ? "True" : "False"
  if (typeof value === "string") return quote(value)
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`нечисловое значение ${value} нельзя напечатать в Python`)
    return String(value)
  }
  throw new Error(`неподдерживаемый литерал ${JSON.stringify(value)}`)
}

function pyOperand(operand, fields, resultVar, inputVar) {
  switch (operand.kind) {
    case "value":
      return pyLiteral(operand.value)
    case "field": {
      const info = fields.get(operand.field)
      if (!info) throw new Error(`операнд ссылается на неизвестное поле «${operand.field}»`)
      return `${inputVar}.${info.ident}`
    }
    case "result":
      return resultVar
    case "percent": {
      const info = fields.get(operand.field)
      if (!info) throw new Error(`операнд «процент» ссылается на неизвестное поле «${operand.field}»`)
      /* В Python `/` — всегда истинное деление, целочисленного деления (как в
         Go для нетипизированных констант) можно не опасаться. */
      return `(${pyLiteral(operand.percent)} / 100) * ${inputVar}.${info.ident}`
    }
    default:
      throw new Error(`неизвестный вид операнда «${operand.kind}»`)
  }
}

function pyConditionTerm(term, fields, resultVar, inputVar) {
  const info = fields.get(term.field)
  if (!info) throw new Error(`условие ссылается на неизвестное поле «${term.field}»`)
  const left = `${inputVar}.${info.ident}`
  if (
    info.kind === "bool" &&
    term.value.kind === "value" &&
    typeof term.value.value === "boolean" &&
    (term.operator === "eq" || term.operator === "neq")
  ) {
    const wantTrue = term.operator === "eq" ? term.value.value : !term.value.value
    return wantTrue ? left : `not ${left}`
  }
  const right = pyOperand(term.value, fields, resultVar, inputVar)
  return `${left} ${COMPARE_OPS[term.operator]} ${right}`
}

function pyCondition(when, fields, resultVar, inputVar) {
  if (!when.length) return "True"
  return when.map((term) => pyConditionTerm(term, fields, resultVar, inputVar)).join(" and ")
}

function indentBlock(lines, indent = "    ") {
  return lines.map((line) => (line ? `${indent}${line}` : line))
}

function buildDataclass(structure, ident, stateRegistry) {
  const fieldNamer = wrapNamer(createNamer(snake, PY_RESERVED))
  const fieldsByOriginal = new Map()
  const body = []
  let needsFieldHelper = false
  for (const field of structure.fields) {
    const info = resolveType(field.type)
    const fieldIdent = fieldNamer(field.name)
    fieldsByOriginal.set(field.name, { ident: fieldIdent, kind: info.kind, optional: info.optional, info })
    body.push(`# ${field.name}`)
    /* Необязательное поле модели («иногда является») обязано иметь умолчание:
       иначе dataclass требует его в конструкторе, и пример утилиты, который
       про это поле ничего не знает, падает с TypeError. Умолчание пишется через
       field(kw_only=True), а не голым `= None`, потому что порядок полей в
       классе повторяет порядок модели: без kw_only обязательное поле после
       необязательного нарушило бы правило Python «аргумент без умолчания не
       может идти за аргументом с умолчанием» — и класс не создался бы вовсе. */
    if (info.optional) {
      needsFieldHelper = true
      body.push(`${fieldIdent}: ${pyTypeName(info, stateRegistry)} = field(default=None, kw_only=True)`)
    } else {
      body.push(`${fieldIdent}: ${pyTypeName(info, stateRegistry)}`)
    }
  }
  const lines = [
    "@dataclass(frozen=True)",
    `class ${ident}:`,
    `    """Исходный объект «${structure.name}»."""`,
    "",
    ...indentBlock(body),
  ]
  return { original: structure.name, ident, fieldsByOriginal, needsFieldHelper, text: lines.join("\n") }
}

function buildUtilityFunction(utility, ident, structsByOriginal, stateRegistry) {
  const inputStruct = structsByOriginal.get(utility.input)
  if (!inputStruct) throw new Error(`утилита «${utility.name}» ссылается на неизвестную структуру «${utility.input}»`)
  const outputInfo = resolveType(utility.output)
  const outType = pyTypeName(outputInfo, stateRegistry)
  const fields = inputStruct.fieldsByOriginal
  const paramName = safeIdent(snake(inputStruct.original))

  const body = []
  body.push(`"""Утилита «${utility.name}»: выполняются все правила с истинным условием, по порядку объявления."""`)
  body.push(`result = ${pyLiteral(utility.initial)}`)
  for (const rule of utility.rules) {
    const condition = pyCondition(rule.when, fields, "result", paramName)
    const operand = pyOperand(rule.action.value, fields, "result", paramName)
    body.push(`# правило «${rule.name}»`)
    body.push(`if ${condition}:`)
    body.push(...indentBlock([rule.action.kind === "set" ? `result = ${operand}` : `result += ${operand}`]))
  }
  for (const property of utility.properties) {
    const right = pyOperand(property.value, fields, "result", paramName)
    body.push(`if not (result ${COMPARE_OPS[property.operator]} ${right}):`)
    body.push(...indentBlock([`raise FtsPropertyViolation(${quote(property.name)}, ${quote(utility.name)})`]))
  }
  body.push("return result")

  const lines = [`def ${ident}(${paramName}: ${inputStruct.ident}) -> ${outType}:`, ...indentBlock(body)]
  return {
    original: utility.name,
    ident,
    inputStruct,
    outType,
    paramName,
    text: lines.join("\n"),
    examples: utility.examples ?? [],
  }
}

function buildDocumentNotes(doc) {
  const lines = []
  for (const morphism of doc.functors ?? []) {
    lines.push(
      `# Морфизм «${morphism.name}»: «${morphism.domain}» -> «${morphism.codomain}» (закон: ${morphism.law}; доказан компилятором ядра).`,
    )
  }
  if (doc.proposition) {
    lines.push(
      "# Теорема доказана компилятором ядра при сборке модели; в сгенерированном коде она не перепроверяется во время выполнения.",
    )
    if (doc.proposition.detail) lines.push(`# ${doc.proposition.detail}`)
  }
  return lines
}

function buildModule(mod, moduleFileName) {
  const doc = mod.document
  const typeNamer = wrapNamer(createNamer(pascal, PY_RESERVED))
  const funcNamer = wrapNamer(createNamer(snake, PY_RESERVED))
  const needsErrorType = (doc.utilities ?? []).some((u) => (u.properties ?? []).length > 0)

  const stateOrder = []
  const seen = new Set()
  for (const structure of doc.structures) {
    for (const field of structure.fields) {
      const info = resolveType(field.type)
      if (info.kind === "state" && !seen.has(info.stateOriginal)) {
        seen.add(info.stateOriginal)
        stateOrder.push(info.stateOriginal)
      }
    }
  }
  /* Модуль Python — один словарь имён: класс, функция, псевдоним типа и
     импортированное имя живут в нём вместе, и повторное объявление не ошибка, а
     молчаливое затирание. Модель же вправе назвать состояние так же, как объект
     или утилиту, — тогда из двух объявлений уцелело бы последнее. Раздаём имена
     из общей таблицы теми же правилами, что и бэкенд Go: объект и утилита
     держат прямое имя, состояние при конфликте получает суффикс State. */
  const declared = new Map([
    ["dataclass", "импорта dataclasses"],
    ["field", "импорта dataclasses"],
    ["NewType", "импорта typing"],
    ["FtsPropertyViolation", "импорта исключения свойств"],
  ])
  const claim = (ident, owner) => {
    const previous = declared.get(ident)
    if (previous !== undefined)
      throw new Error(
        `имя «${ident}» модуля Python занято (${previous}) и запрошено для ${owner} — переименуйте одно из имён в модели`,
      )
    declared.set(ident, owner)
    return ident
  }

  const structIdents = doc.structures.map((structure) => claim(typeNamer(structure.name), `объекта «${structure.name}»`))
  const utilityIdents = (doc.utilities ?? []).map((utility) => claim(funcNamer(utility.name), `утилиты «${utility.name}»`))

  const stateRegistry = new Map()
  for (const name of stateOrder) {
    const base = typeNamer(name)
    const taken = declared.get(base)
    const ident = taken === undefined ? claim(base, `состояния «${name}»`) : claim(`${base}State`, `состояния «${name}»`)
    stateRegistry.set(name, { ident, renamedFrom: taken === undefined ? null : taken })
  }

  const structsByOriginal = new Map()
  const structBlocks = []
  let needsFieldHelper = false
  doc.structures.forEach((structure, index) => {
    const built = buildDataclass(structure, structIdents[index], stateRegistry)
    structsByOriginal.set(structure.name, built)
    structBlocks.push(built.text)
    needsFieldHelper = needsFieldHelper || built.needsFieldHelper
  })

  const utilities = (doc.utilities ?? []).map((utility, index) =>
    buildUtilityFunction(utility, utilityIdents[index], structsByOriginal, stateRegistry),
  )

  const stateBlocks = stateOrder.map((name) => {
    const entry = stateRegistry.get(name)
    const note = entry.renamedFrom
      ? `  # именованное состояние «${name}»; суффикс State: прямое имя занято (${entry.renamedFrom})`
      : `  # именованное состояние «${name}»`
    return `${entry.ident} = NewType(${quote(entry.ident)}, bool)${note}`
  })

  const noteLines = buildDocumentNotes(doc)

  const parts = []
  parts.push('"""')
  parts.push(`Сгенерировано ftsc из модуля «${mod.name}» (категория «${mod.category}», ${mod.source}).`)
  parts.push("Не редактировать вручную.")
  parts.push('"""')
  parts.push("")
  const imports = []
  /* `field` импортируется только там, где есть необязательные поля: лишний
     импорт в модуле без них — мёртвая строка в сгенерированном файле. */
  if (structBlocks.length) imports.push(`from dataclasses import dataclass${needsFieldHelper ? ", field" : ""}`)
  if (stateBlocks.length) imports.push("from typing import NewType")
  if (needsErrorType) imports.push(`from .errors import FtsPropertyViolation`)
  if (imports.length) {
    parts.push(...imports)
    parts.push("")
  }
  if (noteLines.length) {
    parts.push(...noteLines)
    parts.push("")
  }
  for (const block of stateBlocks) {
    parts.push(block)
  }
  if (stateBlocks.length) parts.push("")
  for (const block of structBlocks) {
    parts.push(block, "", "")
  }
  for (const utility of utilities) {
    parts.push(utility.text, "", "")
  }

  const content = `${parts.join("\n").replace(/\n+$/u, "")}\n`
  return { moduleFileName, content, structsByOriginal, utilities, needsErrorType }
}

function buildTestModule(moduleFileName, projectPkg, utilities) {
  const withExamples = utilities.filter((u) => u.examples.length > 0)
  if (!withExamples.length) return null
  const classNamer = wrapNamer(createNamer(pascal, PY_RESERVED))
  const lines = []
  lines.push(`"""Тесты примеров утилит модуля ${projectPkg}.${moduleFileName}. Сгенерировано ftsc, не редактировать вручную."""`)
  lines.push("")
  lines.push("import unittest")
  lines.push("")
  const names = withExamples.map((u) => u.ident)
  const structNames = [...new Set(withExamples.map((u) => u.inputStruct.ident))]
  lines.push(`from ${projectPkg}.${moduleFileName} import ${[...structNames, ...names].join(", ")}`)
  lines.push("")
  lines.push("")
  for (const utility of withExamples) {
    const className = `${classNamer(utility.original)}Tests`
    const methodNamer = wrapNamer(createNamer(snake, []))
    lines.push(`class ${className}(unittest.TestCase):`)
    lines.push(`    """Примеры утилиты «${utility.original}»."""`)
    lines.push("")
    for (const example of utility.examples) {
      const methodName = `test_${methodNamer(example.name)}`
      lines.push(`    def ${methodName}(self) -> None:`)
      lines.push(`        """${example.name}"""`)
      const args = Object.entries(example.input).map(([fieldName, value]) => {
        const info = utility.inputStruct.fieldsByOriginal.get(fieldName)
        if (!info)
          throw new Error(`пример «${example.name}» утилиты «${utility.original}» ссылается на неизвестное поле «${fieldName}»`)
        return `${info.ident}=${pyLiteral(value)}`
      })
      lines.push(`        result = ${utility.ident}(${utility.inputStruct.ident}(${args.join(", ")}))`)
      lines.push(`        self.assertEqual(result, ${pyLiteral(example.expected)})`)
      lines.push("")
    }
  }
  return `${lines.join("\n").replace(/\n+$/u, "")}\n`
}

function buildFunctorModule(functor, moduleInfoByCategory) {
  const fromInfo = moduleInfoByCategory.get(functor.from)
  const toInfo = moduleInfoByCategory.get(functor.to)
  if (!fromInfo || !toInfo)
    throw new Error(`функтор «${functor.name}» ссылается на неизвестную категорию (${functor.from} → ${functor.to})`)
  const funcNamer = wrapNamer(createNamer(snake, PY_RESERVED))

  const funcs = []
  for (const object of functor.objects ?? []) {
    const fromStruct = fromInfo.structsByOriginal.get(object.from)
    const toStruct = toInfo.structsByOriginal.get(object.to)
    if (!fromStruct || !toStruct) throw new Error(`функтор «${functor.name}»: не найден объект «${object.from}» → «${object.to}»`)
    const fnIdent = funcNamer(`transform_${fromStruct.ident}_to_${toStruct.ident}`)
    const paramName = safeIdent(snake(fromStruct.original))
    const assignments = (object.fields ?? []).map((mapping) => {
      const from = fromStruct.fieldsByOriginal.get(mapping.from)
      const to = toStruct.fieldsByOriginal.get(mapping.to)
      if (!from || !to) throw new Error(`функтор «${functor.name}»: поле «${mapping.from}» → «${mapping.to}» не найдено`)
      return `${to.ident}=${paramName}.${from.ident},`
    })
    const lines = [
      `def ${fnIdent}(${paramName}: ${fromStruct.ident}) -> ${toStruct.ident}:`,
      `    """Функтор «${functor.name}»: объект «${object.from}» -> «${object.to}»."""`,
      `    return ${toStruct.ident}(`,
      ...indentBlock(assignments, "        "),
      "    )",
    ]
    funcs.push(lines.join("\n"))
  }

  const parts = []
  parts.push('"""')
  parts.push(`Функтор «${functor.name}» из категории «${functor.from}» в категорию «${functor.to}».`)
  parts.push("Сгенерировано ftsc. Не редактировать вручную.")
  parts.push('"""')
  parts.push("")
  const fromImports = []
  const toImports = []
  for (const object of functor.objects ?? []) {
    const fromStruct = fromInfo.structsByOriginal.get(object.from)
    const toStruct = toInfo.structsByOriginal.get(object.to)
    if (fromStruct && !fromImports.includes(fromStruct.ident)) fromImports.push(fromStruct.ident)
    if (toStruct && !toImports.includes(toStruct.ident)) toImports.push(toStruct.ident)
  }
  /* Функтор — модуль внутри того же пакета, что и категории-модули, поэтому
     относительный импорт (как «.errors» у обычных модулей) — тот же приём, а
     не абсолютный путь через имя пакета. */
  if (fromImports.length) parts.push(`from .${fromInfo.moduleFileName} import ${fromImports.join(", ")}`)
  if (toImports.length) parts.push(`from .${toInfo.moduleFileName} import ${toImports.join(", ")}`)
  parts.push("")
  for (const morphism of functor.morphisms ?? []) {
    parts.push(`# Функтор сохраняет морфизм «${morphism.from}» -> «${morphism.to}» (проверено компилятором ядра).`)
  }
  if ((functor.morphisms ?? []).length) parts.push("")
  for (const fn of funcs) parts.push(fn, "", "")

  const content = `${parts.join("\n").replace(/\n+$/u, "")}\n`
  return content
}

export function emit(program, options = {}) {
  const projectPkg = safeIdent(snake(options.projectName ?? program.project ?? "project") || "project")
  const fileNamer = wrapNamer(createNamer(snake, ["errors", "__init__"]))
  const files = []
  const moduleInfoByCategory = new Map()

  let hasTests = false
  for (const mod of program.modules ?? []) {
    const moduleFileName = fileNamer(mod.name)
    const built = buildModule(mod, moduleFileName)
    moduleInfoByCategory.set(mod.category, built)
    files.push({ path: `${projectPkg}/${moduleFileName}.py`, content: built.content })
    const testContent = buildTestModule(moduleFileName, projectPkg, built.utilities)
    if (testContent) {
      files.push({ path: `tests/test_${moduleFileName}.py`, content: testContent })
      hasTests = true
    }
  }
  /* Без __init__.py каталог tests/ — namespace-пакет, а не обычный, и
     `python3 -m unittest discover` (без -s/-t) в некоторых конфигурациях
     отказывается считать такой стартовый каталог импортируемым. Обычный
     пакет с явным __init__.py работает предсказуемо в любой раскладке. */
  if (hasTests) files.push({ path: "tests/__init__.py", content: '"""Тесты примеров утилит. Сгенерировано ftsc."""\n' })

  for (const functor of program.functors ?? []) {
    const functorFileName = fileNamer(functor.name)
    const content = buildFunctorModule(functor, moduleInfoByCategory)
    files.push({ path: `${projectPkg}/${functorFileName}.py`, content })
  }

  const needsErrorType = [...moduleInfoByCategory.values()].some((m) => m.needsErrorType)
  if (needsErrorType) {
    files.push({
      path: `${projectPkg}/errors.py`,
      content: [
        '"""',
        "Общее исключение для нарушенных постусловий (свойств) утилит FTS.",
        "Сгенерировано ftsc. Не редактировать вручную.",
        '"""',
        "",
        "",
        "class FtsPropertyViolation(Exception):",
        '    """Нарушено свойство утилиты FTS — постусловие расчёта."""',
        "",
        "    def __init__(self, property_name: str, utility_name: str) -> None:",
        "        self.property_name = property_name",
        "        self.utility_name = utility_name",
        '        super().__init__(f"нарушено свойство «{property_name}» утилиты «{utility_name}»")',
        "",
      ].join("\n"),
    })
  }

  files.push({
    path: `${projectPkg}/__init__.py`,
    content: `"""Пакет «${projectPkg}», сгенерированный ftsc из проекта «${program.project ?? projectPkg}». Не редактировать вручную."""\n`,
  })

  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  /* Последний шаг печати — снять сырые двунаправленные управляющие со всего
     вывода (../bidi.mjs). Имя FTS (правила, свойства, примера, категории) уезжает
     и в комментарий («# правило «…»»), и в строку (docstring теста, имя свойства
     в исключении), а комментарий читают первым и проверить исполнением не могут:
     CPython такой файл выполнит молча. Форма Python — `\uXXXX`; в docstring она даёт
     ту же кодовую точку, что сырой символ, — документация не меняется. */
  return escapeBidiInFiles(files, escapeBidiUnicode4)
}
