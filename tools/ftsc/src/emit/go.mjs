/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Бэкенд ftsc: печатает Go для IR компилятора (см. tools/ftsc/SPEC.md, раздел 5).
 *
 * Стратегия кодогенерации сознательно повторяет reference-реализацию TypeScript
 * из src/utility.ts (renderImplementation/resolveOperand): каждое
 * правило утилиты печатается прямой строкой Go (`if <условие> { result += ... }`),
 * а не интерпретируется рантаймом — так получается идиоматичный, читаемый Go без
 * собственного мини-движка внутри сгенерированного пакета.
 *
 * Один модуль IR → один пакет Go (каталог с одним файлом реализации и, если у
 * утилит есть примеры, файлом *_test.go). Один функтор между категориями →
 * отдельный пакет с функцией(ями) преобразования «объект домена → объект кодомена».
 */
import { spawnSync } from "node:child_process"

import { camel, createNamer, pascal, quote, snake } from "../naming.mjs"
import { escapeBidiInFiles, escapeBidiUnicode4 } from "../bidi.mjs"
import { findExecutable } from "../toolchain.mjs"

export const target = {
  id: "go",
  name: "Go",
  extension: ".go",
  toolchain: { probe: ["go", "version"], test: ["go", "test", "./..."] },
}

/* Ключевые слова и предобъявленные идентификаторы Go: модельное имя, которое
   транслитерируется в одно из них, обязано считаться коллизией, а не молча
   получить какой-нибудь суффикс. */
const GO_RESERVED = [
  "break",
  "default",
  "func",
  "interface",
  "select",
  "case",
  "defer",
  "go",
  "map",
  "struct",
  "chan",
  "else",
  "goto",
  "package",
  "switch",
  "const",
  "fallthrough",
  "if",
  "range",
  "type",
  "continue",
  "for",
  "import",
  "return",
  "var",
  "bool",
  "byte",
  "complex64",
  "complex128",
  "error",
  "float32",
  "float64",
  "int",
  "int8",
  "int16",
  "int32",
  "int64",
  "rune",
  "string",
  "uint",
  "uint8",
  "uint16",
  "uint32",
  "uint64",
  "uintptr",
  "true",
  "false",
  "iota",
  "nil",
  "append",
  "cap",
  "close",
  "complex",
  "copy",
  "delete",
  "imag",
  "len",
  "make",
  "new",
  "panic",
  "print",
  "println",
  "real",
  "recover",
]

const COMPARE_OPS = { eq: "==", neq: "!=", gte: ">=", lte: "<=", gt: ">", lt: "<" }

/* Go-идентификатор не может начинаться с цифры; ни одна из фикстур этого не
   порождает, но бэкенд обязан пережить это, а не выдать невалидный исходник. */
function safeIdent(identifier) {
  return /^[0-9]/.test(identifier) ? `_${identifier}` : identifier
}

function wrapNamer(namer) {
  return (value) => safeIdent(namer(value))
}

/**
 * Тип поля/вывода FTS → представление в Go.
 * «X | undefined» — опциональность; именованное состояние — всё, что не входит
 * в пятёрку базовых типов ядра, представлено как defined-тип поверх bool (в IR
 * оно и наблюдается только как bool — см. order-shipment.fts: «готов к
 * отгрузке» получает значение да/нет).
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

function goBaseTypeName(info, stateRegistry) {
  switch (info.kind) {
    case "string":
      return "string"
    case "number":
      return "float64"
    case "bool":
      return "bool"
    case "date":
      return "string"
    case "state": {
      const entry = stateRegistry.get(info.stateOriginal)
      if (!entry) throw new Error(`внутренняя ошибка ftsc: неизвестное именованное состояние «${info.stateOriginal}»`)
      return entry.ident
    }
    default:
      throw new Error(`неизвестный вид типа «${info.kind}»`)
  }
}

function goTypeName(info, stateRegistry) {
  const base = goBaseTypeName(info, stateRegistry)
  /* Опциональное поле — указатель, а не отдельный bool-флаг: тип поля и так
     несёт значение отсутствия (nil) без второго поля-спутника в структуре, и
     идиоматичный Go читает `*T` как «может отсутствовать» без пояснений. */
  return info.optional ? `*${base}` : base
}

/**
 * Имя типа поля так, как его видит чужой пакет: именованное состояние живёт в
 * пакете своей категории и снаружи пишется с квалификатором. Базовые типы ядра
 * (float64/bool/string) у всех категорий одни и те же и квалификатора не имеют —
 * поэтому у одинаковых по смыслу полей совпадает и текст типа.
 */
function goQualifiedBase(info, packageIdent, stateRegistry) {
  const base = goBaseTypeName(info, stateRegistry)
  return info.kind === "state" ? `${packageIdent}.${base}` : base
}

function goZeroValue(info) {
  if (info.optional) return "nil"
  switch (info.kind) {
    case "number":
      return "0"
    case "bool":
    case "state":
      return "false"
    case "string":
    case "date":
      return '""'
    default:
      return "0"
  }
}

function goLiteral(value) {
  if (typeof value === "boolean") return value ? "true" : "false"
  if (typeof value === "string") return quote(value)
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`нечисловое значение ${value} нельзя напечатать в Go`)
    return String(value)
  }
  throw new Error(`неподдерживаемый литерал ${JSON.stringify(value)}`)
}

/* `10 / 100 * значение` в Go — целочисленное деление untyped-констант (даёт 0),
   если ни одна из констант не помечена как float. Явная `.0` у числителя
   переводит всё выражение в плавающую арифметику, как и рассчитывает модель. */
function goFloatForce(value) {
  const literal = goLiteral(value)
  return /[.eE]/.test(literal) ? literal : `${literal}.0`
}

function goOperand(operand, fields, resultVar, inputVar) {
  switch (operand.kind) {
    case "value":
      return goLiteral(operand.value)
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
      return `(${goFloatForce(operand.percent)} / 100 * ${inputVar}.${info.ident})`
    }
    default:
      throw new Error(`неизвестный вид операнда «${operand.kind}»`)
  }
}

function goConditionTerm(term, fields, resultVar, inputVar) {
  const info = fields.get(term.field)
  if (!info) throw new Error(`условие ссылается на неизвестное поле «${term.field}»`)
  const left = `${inputVar}.${info.ident}`
  /* «X равен да» / «X равен нет» на bool-поле читается как `in.X` / `!in.X`,
     а не `in.X == true` — то, как сам Go предпочитает сравнивать булевы. */
  if (
    info.kind === "bool" &&
    term.value.kind === "value" &&
    typeof term.value.value === "boolean" &&
    (term.operator === "eq" || term.operator === "neq")
  ) {
    const wantTrue = term.operator === "eq" ? term.value.value : !term.value.value
    return wantTrue ? left : `!${left}`
  }
  const right = goOperand(term.value, fields, resultVar, inputVar)
  return `${left} ${COMPARE_OPS[term.operator]} ${right}`
}

function goCondition(when, fields, resultVar, inputVar) {
  if (!when.length) return "true"
  return when.map((term) => goConditionTerm(term, fields, resultVar, inputVar)).join(" && ")
}

function buildStruct(structure, ident, stateRegistry) {
  const fieldNamer = wrapNamer(createNamer(pascal, []))
  const fieldsByOriginal = new Map()
  const lines = []
  for (const field of structure.fields) {
    const info = resolveType(field.type)
    const fieldIdent = fieldNamer(field.name)
    /* Полное описание типа (`info`) остаётся с полем: функтору нужно знать не
       только идентификатор, но и то, какой именно тип у поля образа — иначе
       перенос печатается присваиванием между разными типами Go. */
    fieldsByOriginal.set(field.name, { ident: fieldIdent, kind: info.kind, optional: info.optional, info })
    lines.push(`\t// ${field.name}`)
    lines.push(`\t${fieldIdent} ${goTypeName(info, stateRegistry)}`)
  }
  const text = [`// ${ident} — исходный объект «${structure.name}».`, `type ${ident} struct {`, ...lines, "}"].join("\n")
  return { original: structure.name, ident, fieldsByOriginal, text }
}

function buildUtility(utility, ident, structsByOriginal, stateRegistry) {
  const inputStruct = structsByOriginal.get(utility.input)
  if (!inputStruct) throw new Error(`утилита «${utility.name}» ссылается на неизвестную структуру «${utility.input}»`)
  const outputInfo = resolveType(utility.output)
  const outType = goTypeName(outputInfo, stateRegistry)
  const fields = inputStruct.fieldsByOriginal

  const lines = []
  lines.push(`// ${ident} — утилита «${utility.name}» категории (правила выполняются все по порядку, без else).`)
  lines.push(`func ${ident}(in ${inputStruct.ident}) (${outType}, error) {`)
  lines.push(`\tvar result ${outType} = ${goLiteral(utility.initial)}`)
  for (const rule of utility.rules) {
    const condition = goCondition(rule.when, fields, "result", "in")
    const operand = goOperand(rule.action.value, fields, "result", "in")
    lines.push(`\t// правило «${rule.name}»`)
    lines.push(`\tif ${condition} {`)
    lines.push(rule.action.kind === "set" ? `\t\tresult = ${operand}` : `\t\tresult += ${operand}`)
    lines.push("\t}")
  }
  for (const property of utility.properties) {
    const right = goOperand(property.value, fields, "result", "in")
    lines.push(`\tif !(result ${COMPARE_OPS[property.operator]} ${right}) {`)
    lines.push(
      `\t\treturn ${goZeroValue(outputInfo)}, &PropertyViolation{Property: ${quote(property.name)}, Utility: ${quote(utility.name)}}`,
    )
    lines.push("\t}")
  }
  lines.push("\treturn result, nil")
  lines.push("}")
  return { original: utility.name, ident, inputStruct, outType, text: lines.join("\n"), examples: utility.examples ?? [] }
}

function buildDocumentNotes(doc) {
  const lines = []
  for (const morphism of doc.functors ?? []) {
    lines.push(
      `// Морфизм «${morphism.name}»: «${morphism.domain}» → «${morphism.codomain}» (закон: ${morphism.law}; доказан компилятором ядра).`,
    )
  }
  if (doc.proposition) {
    lines.push(
      "// Теорема доказана компилятором ядра при сборке модели; в сгенерированном коде она не перепроверяется во время выполнения.",
    )
    if (doc.proposition.detail) lines.push(`// ${doc.proposition.detail}`)
  }
  return lines
}

function buildModulePackage(mod, packageIdent) {
  const doc = mod.document
  const typeNamer = wrapNamer(createNamer(pascal, GO_RESERVED))
  const needsErrorType = (doc.utilities ?? []).some((u) => (u.properties ?? []).length > 0)

  /* У пакета Go одно пространство имён на все объявления верхнего уровня: тип и
     функция с одним идентификатором — переобъявление, а не перегрузка. В модели
     же имя утилиты законно совпадает с именем состояния, которое эта утилита и
     вычисляет (patterns/retry.fts: состояние «Повтор разрешён» и утилита
     «Повтор разрешён»), а createNamer видит одно и то же имя модели и молча
     выдаёт один идентификатор обоим. Поэтому идентификаторы пакета раздаются из
     общей таблицы: объект и утилита — экспортируемое API модуля — держат прямое
     имя, а тип состояния (внутреннее представление поля) при конфликте получает
     суффикс. */
  const declared = new Map()
  const claim = (ident, owner) => {
    const previous = declared.get(ident)
    if (previous !== undefined)
      throw new Error(
        `в пакете «${packageIdent}» идентификатор «${ident}» занят (${previous}) и запрошен для ${owner} — ` +
          "переименуйте одно из имён в модели",
      )
    declared.set(ident, owner)
    return ident
  }

  if (needsErrorType) claim(typeNamer("PropertyViolation"), "типа ошибки свойства")

  const structIdents = doc.structures.map((structure) => claim(typeNamer(structure.name), `объекта «${structure.name}»`))
  const utilityIdents = (doc.utilities ?? []).map((utility) => claim(typeNamer(utility.name), `утилиты «${utility.name}»`))

  /* Именованные состояния объявляются один раз, в порядке первого появления
     среди полей структур — детерминированно, без хеш-таблиц. */
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
  const stateRegistry = new Map()
  for (const name of stateOrder) {
    const base = typeNamer(name)
    const taken = declared.get(base)
    const ident = taken === undefined ? claim(base, `состояния «${name}»`) : claim(`${base}State`, `состояния «${name}»`)
    stateRegistry.set(name, { ident, renamedFrom: taken === undefined ? null : taken })
  }

  const structsByOriginal = new Map()
  const structBlocks = []
  doc.structures.forEach((structure, index) => {
    const built = buildStruct(structure, structIdents[index], stateRegistry)
    structsByOriginal.set(structure.name, built)
    structBlocks.push(built.text)
  })

  const utilities = (doc.utilities ?? []).map((utility, index) =>
    buildUtility(utility, utilityIdents[index], structsByOriginal, stateRegistry),
  )

  const stateBlocks = stateOrder.map((name) => {
    const entry = stateRegistry.get(name)
    const lines = [`// ${entry.ident} — именованное состояние «${name}».`]
    /* Переименование объясняется на месте: иначе читатель сгенерированного кода
       не поймёт, откуда взялся суффикс, которого нет в модели. */
    if (entry.renamedFrom) lines.push(`// Суффикс State: прямое имя занято другим объявлением пакета (${entry.renamedFrom}).`)
    lines.push(`type ${entry.ident} bool`)
    return lines.join("\n")
  })

  const noteLines = buildDocumentNotes(doc)

  const parts = []
  parts.push(`// Package ${packageIdent} сгенерирован ftsc из модуля «${mod.name}» (категория «${mod.category}», ${mod.source}).`)
  parts.push("// Не редактировать вручную.")
  parts.push(`package ${packageIdent}`)
  parts.push("")
  if (needsErrorType) {
    parts.push('import "fmt"')
    parts.push("")
  }
  if (noteLines.length) {
    parts.push(...noteLines)
    parts.push("")
  }
  if (needsErrorType) {
    parts.push("// PropertyViolation — нарушено постусловие (свойство) утилиты FTS.")
    parts.push("// Идиоматичный Go возвращает ошибку значением, а не паникует.")
    parts.push("type PropertyViolation struct {")
    parts.push("\tProperty string")
    parts.push("\tUtility  string")
    parts.push("}")
    parts.push("")
    parts.push("func (e *PropertyViolation) Error() string {")
    parts.push('\treturn fmt.Sprintf("нарушено свойство «%s» утилиты «%s»", e.Property, e.Utility)')
    parts.push("}")
    parts.push("")
  }
  for (const block of stateBlocks) {
    parts.push(block, "")
  }
  for (const block of structBlocks) {
    parts.push(block, "")
  }
  for (const utility of utilities) {
    parts.push(utility.text, "")
  }

  const content = `${parts.join("\n").replace(/\n+$/u, "")}\n`
  return { packageIdent, content, structsByOriginal, utilities, stateRegistry }
}

function buildTestFile(packageIdent, utilities) {
  const withExamples = utilities.filter((u) => u.examples.length > 0)
  if (!withExamples.length) return null
  const testNamer = wrapNamer(createNamer(pascal, []))
  const lines = []
  lines.push(`// Тесты примеров утилит пакета ${packageIdent}. Сгенерировано ftsc, не редактировать вручную.`)
  lines.push(`package ${packageIdent}`)
  lines.push("")
  lines.push('import "testing"')
  lines.push("")
  for (const utility of withExamples) {
    for (const example of utility.examples) {
      const testIdent = `Test${testNamer(`${utility.original} ${example.name}`)}`
      lines.push(`// ${testIdent} — пример «${example.name}» утилиты «${utility.original}».`)
      lines.push(`func ${testIdent}(t *testing.T) {`)
      lines.push(`\tin := ${utility.inputStruct.ident}{`)
      for (const [fieldName, value] of Object.entries(example.input)) {
        const info = utility.inputStruct.fieldsByOriginal.get(fieldName)
        if (!info)
          throw new Error(`пример «${example.name}» утилиты «${utility.original}» ссылается на неизвестное поле «${fieldName}»`)
        lines.push(`\t\t${info.ident}: ${goLiteral(value)},`)
      }
      lines.push("\t}")
      lines.push(`\tgot, err := ${utility.ident}(in)`)
      lines.push("\tif err != nil {")
      lines.push('\t\tt.Fatalf("неожиданная ошибка: %v", err)')
      lines.push("\t}")
      /* Явная аннотация типа: нетипизированная целая константа вроде 2000
         иначе выводится компилятором как int, а не как тип утилиты (float64),
         и `got != want` не скомпилируется из-за несовпадения типов. */
      lines.push(`\tvar want ${utility.outType} = ${goLiteral(example.expected)}`)
      lines.push("\tif got != want {")
      lines.push('\t\tt.Fatalf("получено %v, ожидалось %v", got, want)')
      lines.push("\t}")
      lines.push("}")
      lines.push("")
    }
  }
  return `${lines.join("\n").replace(/\n+$/u, "")}\n`
}

function buildFunctorPackage(functor, packageIdent, projectIdent, moduleInfoByCategory, packageIdentByCategory) {
  const fromInfo = moduleInfoByCategory.get(functor.from)
  const toInfo = moduleInfoByCategory.get(functor.to)
  if (!fromInfo || !toInfo)
    throw new Error(`функтор «${functor.name}» ссылается на неизвестную категорию (${functor.from} → ${functor.to})`)
  const fromPkg = packageIdentByCategory.get(functor.from)
  const toPkg = packageIdentByCategory.get(functor.to)
  const typeNamer = wrapNamer(createNamer(pascal, GO_RESERVED))

  const funcs = []
  for (const object of functor.objects ?? []) {
    const fromStruct = fromInfo.structsByOriginal.get(object.from)
    const toStruct = toInfo.structsByOriginal.get(object.to)
    if (!fromStruct || !toStruct) throw new Error(`функтор «${functor.name}»: не найден объект «${object.from}» → «${object.to}»`)
    /* Составное имя строится из уже транслитерированных идентификаторов
       объектов, а не заново из кириллицы — pascal() на чистой латинице без
       разделителей идемпотентна, так что коллизии всё равно ловятся namer'ом. */
    const fnIdent = typeNamer(`Transform${fromStruct.ident}To${toStruct.ident}`)
    /* Временные переменные нужны, когда образа нельзя получить одним выражением
       (см. ниже случай «обязательное → необязательное с приведением»). */
    const prelude = []
    const assignments = (object.fields ?? []).map((mapping) => {
      const from = fromStruct.fieldsByOriginal.get(mapping.from)
      const to = toStruct.fieldsByOriginal.get(mapping.to)
      if (!from || !to) throw new Error(`функтор «${functor.name}»: поле «${mapping.from}» → «${mapping.to}» не найдено`)
      const fromBase = goQualifiedBase(from.info, fromPkg, fromInfo.stateRegistry)
      const toBase = goQualifiedBase(to.info, toPkg, toInfo.stateRegistry)
      /* Прообраз и образ — разные именованные типы Go: состояние «Запрос
         страницы проверен» пакета домена и состояние «Условие проверено» пакета
         кодомена оба объявлены как `bool`, но присвоить одно другому нельзя.
         Смысл переноса задан моделью и проверен линковкой (карта состояний
         функтора), Go же требует сказать это явным приведением. Базовые типы
         ядра совпадают текстуально — там приведение не печатается. */
      if (from.info.optional && !to.info.optional)
        throw new Error(
          `функтор «${functor.name}»: необязательное поле «${mapping.from}» нельзя перенести в обязательное «${mapping.to}»`,
        )
      if (!from.info.optional && to.info.optional) {
        /* Образ необязателен — нужен указатель. Поле аргумента адресуемо, но
           результат приведения — нет, поэтому при смене типа заводится
           именованное значение. */
        if (fromBase === toBase) return `\t\t${to.ident}: &in.${from.ident},`
        const local = `${camel(to.ident)}Value`
        prelude.push(`\t${local} := ${toBase}(in.${from.ident})`)
        return `\t\t${to.ident}: &${local},`
      }
      if (fromBase === toBase) return `\t\t${to.ident}: in.${from.ident},`
      /* Приведение указателя пишется со скобками вокруг типа: `*T(x)` Go читает
         как разыменование результата, а не как преобразование к `*T`. */
      const cast = to.info.optional ? `(*${toBase})` : toBase
      return `\t\t${to.ident}: ${cast}(in.${from.ident}),`
    })
    funcs.push(
      [
        `// ${fnIdent} — функтор «${functor.name}»: объект «${object.from}» → «${object.to}».`,
        `func ${fnIdent}(in ${fromPkg}.${fromStruct.ident}) ${toPkg}.${toStruct.ident} {`,
        ...prelude,
        `\treturn ${toPkg}.${toStruct.ident}{`,
        ...assignments,
        "\t}",
        "}",
      ].join("\n"),
    )
  }

  const lines = []
  lines.push(
    `// Package ${packageIdent} сгенерирован ftsc: функтор «${functor.name}» из категории «${functor.from}» в категорию «${functor.to}».`,
  )
  lines.push("// Не редактировать вручную.")
  lines.push(`package ${packageIdent}`)
  lines.push("")
  lines.push("import (")
  lines.push(`\t"${projectIdent}/${fromPkg}"`)
  lines.push(`\t"${projectIdent}/${toPkg}"`)
  lines.push(")")
  lines.push("")
  for (const morphism of functor.morphisms ?? []) {
    lines.push(`// Функтор сохраняет морфизм «${morphism.from}» → «${morphism.to}» (проверено компилятором ядра).`)
  }
  if ((functor.morphisms ?? []).length) lines.push("")
  for (const fn of funcs) lines.push(fn, "")

  return `${lines.join("\n").replace(/\n+$/u, "")}\n`
}

let cachedGofmt
function gofmtPath() {
  if (cachedGofmt === undefined) cachedGofmt = findExecutable("gofmt")
  return cachedGofmt
}

/* Ручное выравнивание полей структур/литералов один-в-один с gofmt — хрупкая
   затея (табличный алгоритм gofmt меняется между версиями). Надёжнее печатать
   синтаксически корректный Go и, если тулчейн доступен прямо сейчас, прогнать
   через настоящий `gofmt`: результат детерминирован (тот же вход — тот же
   выход) и гарантированно каноничен. Без тулчейна emit() всё равно возвращает
   валидный, хоть и не идеально выровненный, Go — determinism не страдает. */
function formatGo(source) {
  const gofmt = gofmtPath()
  if (!gofmt) return source
  const result = spawnSync(gofmt, [], { input: source, encoding: "utf8" })
  if (result.error || result.status !== 0 || !result.stdout) return source
  return result.stdout
}

export function emit(program, options = {}) {
  const projectIdent = snake(options.projectName ?? program.project ?? "project") || "project"
  const packageNamer = wrapNamer(createNamer(snake, []))
  const files = []
  const moduleInfoByCategory = new Map()
  const packageIdentByCategory = new Map()

  for (const mod of program.modules ?? []) {
    const packageIdent = packageNamer(mod.name)
    packageIdentByCategory.set(mod.category, packageIdent)
    const built = buildModulePackage(mod, packageIdent)
    moduleInfoByCategory.set(mod.category, built)
    files.push({ path: `${packageIdent}/${packageIdent}.go`, content: formatGo(built.content) })
    const testContent = buildTestFile(packageIdent, built.utilities)
    if (testContent) files.push({ path: `${packageIdent}/${packageIdent}_test.go`, content: formatGo(testContent) })
  }

  for (const functor of program.functors ?? []) {
    const packageIdent = packageNamer(functor.name)
    const content = buildFunctorPackage(functor, packageIdent, projectIdent, moduleInfoByCategory, packageIdentByCategory)
    files.push({ path: `${packageIdent}/${packageIdent}.go`, content: formatGo(content) })
  }

  files.push({ path: "go.mod", content: `module ${projectIdent}\n\ngo 1.21\n` })

  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  /* Последний шаг печати — снять сырые двунаправленные управляющие со всего
     вывода (../bidi.mjs). Имя FTS (правила, свойства, примера, категории) уезжает
     и в комментарий («правило «…»», подпись теста), и в строковый литерал (имя
     свойства в PropertyViolation), а комментарий читают первым и проверить
     исполнением не могут: go vet о таком не предупреждает. Молчание тулчейна здесь
     и есть беда, а не оправдание. Форма Go — `\uXXXX`. */
  return escapeBidiInFiles(files, escapeBidiUnicode4)
}
