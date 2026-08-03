/**
 * Бэкенд кодогенерации ftsc → C#.
 *
 * В системе, где собирается ftsc, нет ни dotnet SDK, ни mono (см. проверку в
 * tools/ftsc/test/emit-csharp.test.mjs) — тест компиляции честно пропускается
 * там, где тулчейна нет, а не притворяется, что проверил. Здесь, в самом
 * бэкенде, это ни на что не влияет: мы просто печатаем текст на C#.
 *
 * Ключевое архитектурное отличие от TypeScript-бэкенда: TS разрешает любую
 * строку в качестве имени свойства объектного литерала, поэтому там поля
 * остаются кириллическими строковыми ключами. C# — нет, имя свойства record'а
 * обязано быть валидным идентификатором. Поэтому здесь ПОЛЯ тоже проходят
 * через транслитерацию (naming.mjs:pascal), а исходное имя FTS остаётся рядом
 * в XML-комментарии `<summary>`.
 *
 * Именованные состояния (`«поле» является состоянием «Х»`) на рантайме — это
 * булев признак: движок ядра хранит и сверяет их как true/false (см.
 * src/natural-parser.ts:parseField/parseMorphism и
 * witness.value в IR фикстуры shipment). В C# для этого используется
 * директива `using Имя = System.Boolean;` — настоящий алиас типа: он даёт
 * состоянию собственное читаемое имя в сигнатурах, но не создаёт рантайм-
 * обёртки, которой в модели нет, и не требует приведений типов при работе с
 * булевыми литералами.
 */
import { createNamer, pascal, quote } from "../naming.mjs"

export const target = {
  id: "csharp",
  name: "C#",
  extension: ".cs",
  /* Тулчейна для проверки в этой системе, скорее всего, нет — тест эмиттера
     сначала проверяет `command -v dotnet csc mcs mono` и честно пропускает
     компиляцию, если ничего не нашлось. */
  toolchain: { probe: ["dotnet", "--version"], test: ["dotnet", "run"] },
}

const BASE_TYPES = new Set(["Строка", "Число", "Деньги", "Признак", "Дата"])

/** «Арифметический вид» типа: определяет, какие литералы и операторы допустимы. */
function csKind(base) {
  if (base === "Деньги") return "decimal"
  if (base === "Число") return "double"
  if (base === "Строка" || base === "Дата") return "string"
  if (base === "Признак") return "bool"
  return "bool" // именованное состояние — булев признак
}

function csKeyword(kind) {
  return kind // decimal/double/bool/string — уже валидные ключевые слова C#
}

function splitType(rawType) {
  const optional = /\|\s*undefined\s*$/u.test(rawType)
  const base = rawType.replace(/\s*\|\s*undefined\s*$/u, "").trim()
  return { base, optional }
}

function resolveCsType(rawType, structInfo, stateAliases) {
  const { base, optional } = splitType(rawType)
  const inner = BASE_TYPES.has(base)
    ? csKeyword(csKind(base))
    : structInfo.has(base)
      ? structInfo.get(base).ident
      : stateAliases.has(base)
        ? stateAliases.get(base)
        : "object"
  return optional ? `${inner}?` : inner
}

/** Литерал значения в заданном арифметическом виде (см. csKind). */
function renderLiteral(value, kind) {
  if (kind === "decimal") return `${String(value)}m`
  if (kind === "double") return Number.isInteger(value) ? `${value}.0` : String(value)
  if (kind === "bool") return value ? "true" : "false"
  return quote(value)
}

const COMPARISON_OPERATORS = { eq: "==", neq: "!=", gte: ">=", lte: "<=", gt: ">", lt: "<" }

function renderComparison(left, operator, right) {
  return `${left} ${COMPARISON_OPERATORS[operator]} ${right}`
}

/**
 * Операнд действия/условия. `kind` — арифметический вид, в котором операнд
 * должен оказаться (вид переменной `result` для действий и свойств, вид
 * сравниваемого поля для условий правил): им же определяются суффиксы
 * числовых литералов, а при обращении к полю другого вида добавляется явное
 * приведение — без этого `10 / 100` в C# посчитается целочисленно и всегда
 * даст 0, в отличие от JS, где все числа — double.
 */
function renderOperand(operand, kind, fieldKinds, fieldIdents) {
  switch (operand.kind) {
    case "value":
      return renderLiteral(operand.value, kind)
    case "result":
      return "result"
    case "field": {
      const access = `input.${fieldIdents.get(operand.field)}`
      const fieldKind = fieldKinds.get(operand.field) ?? kind
      return fieldKind === kind ? access : `(${csKeyword(kind)})${access}`
    }
    case "percent": {
      const access = `input.${fieldIdents.get(operand.field)}`
      const fieldKind = fieldKinds.get(operand.field) ?? kind
      const casted = fieldKind === kind ? access : `(${csKeyword(kind)})${access}`
      const percentLiteral = renderLiteral(operand.percent, kind === "bool" || kind === "string" ? "double" : kind)
      const hundredLiteral = renderLiteral(100, kind === "bool" || kind === "string" ? "double" : kind)
      return `((${percentLiteral} / ${hundredLiteral}) * ${casted})`
    }
    default:
      throw new Error(`неизвестный вид операнда «${operand.kind}»`)
  }
}

function renderStateAliasUsing(originalName, ident) {
  return `using ${ident} = System.Boolean; // именованное состояние FTS «${originalName}»`
}

/** Печатает структуру как record с init-свойствами; возвращает и текст, и карты полей для рендера утилит. */
function renderStructure(structure, structInfo, stateAliases) {
  const info = structInfo.get(structure.name)
  const fieldNamer = createNamer(pascal, [])
  const idents = new Map()
  const kinds = new Map()
  const lines = [`/// <summary>Объект FTS «${structure.name}».</summary>`, `public sealed record ${info.ident}`, "{"]
  for (const field of structure.fields) {
    const ident = fieldNamer(field.name)
    idents.set(field.name, ident)
    const { base } = splitType(field.type)
    kinds.set(field.name, BASE_TYPES.has(base) ? csKind(base) : "bool")
    const csType = resolveCsType(field.type, structInfo, stateAliases)
    lines.push(`    /// <summary>${field.name}</summary>`)
    lines.push(`    public ${csType} ${ident} { get; init; }`)
  }
  lines.push("}")
  info.idents = idents
  info.kinds = kinds
  return lines.join("\n")
}

function renderUtility(utility, structInfo, stateAliases, methodIdent) {
  const inputInfo = structInfo.get(utility.input)
  if (!inputInfo) throw new Error(`утилита «${utility.name}» ссылается на неизвестную структуру «${utility.input}»`)
  const { base: outputBase } = splitType(utility.output)
  if (!BASE_TYPES.has(outputBase)) {
    throw new Error(`утилита «${utility.name}»: возвращаемый тип «${utility.output}» должен быть одним из базовых типов FTS`)
  }
  const outputKind = csKind(outputBase)
  const outputType = resolveCsType(utility.output, structInfo, stateAliases)
  const fieldKinds = inputInfo.kinds
  const fieldIdents = inputInfo.idents

  const lines = [
    `/// <summary>Утилита FTS «${utility.name}»: ${utility.input} → ${utility.output}. Выполняются все правила с истинным условием, по порядку объявления — это не if/else.</summary>`,
    `public static ${outputType} ${methodIdent}(${inputInfo.ident} input)`,
    "{",
    `    ${csKeyword(outputKind)} result = ${renderLiteral(utility.initial, outputKind)};`,
  ]
  for (const rule of utility.rules) {
    const condition =
      rule.when
        .map((item) => {
          const fieldKind = fieldKinds.get(item.field)
          if (fieldKind === undefined) throw new Error(`правило «${rule.name}» ссылается на неизвестное поле «${item.field}»`)
          return renderComparison(
            `input.${fieldIdents.get(item.field)}`,
            item.operator,
            renderOperand(item.value, fieldKind, fieldKinds, fieldIdents),
          )
        })
        .join(" && ") || "true"
    lines.push(`    // правило «${rule.name}»`)
    lines.push(`    if (${condition})`)
    lines.push("    {")
    const operand = renderOperand(rule.action.value, outputKind, fieldKinds, fieldIdents)
    lines.push(`        ${rule.action.kind === "add" ? `result += ${operand};` : `result = ${operand};`}`)
    lines.push("    }")
  }
  for (const property of utility.properties) {
    const comparison = renderComparison(
      "result",
      property.operator,
      renderOperand(property.value, outputKind, fieldKinds, fieldIdents),
    )
    lines.push(
      `    if (!(${comparison})) throw new global::Fts.Runtime.FtsPropertyViolationException(${quote(utility.name)}, ${quote(property.name)});`,
    )
  }
  lines.push("    return result;", "}")
  return lines.join("\n")
}

function describeProposition(proposition) {
  if (proposition.kind === "witness") {
    return `свидетель: структура «${proposition.structure}», поле «${proposition.field}» = ${JSON.stringify(proposition.value)}, выборка ${JSON.stringify(proposition.selector ?? {})}`
  }
  if (proposition.kind === "apply") {
    return `применение морфизма «${proposition.functor}» к (${describeProposition(proposition.arg)})`
  }
  if (proposition.kind === "compose") {
    return `композиция морфизмов [${proposition.functors.join(" ∘ ")}] к (${describeProposition(proposition.arg)})`
  }
  return "тривиальная теорема (⊤)"
}

function renderMorphism(morphism, structInfo, stateAliases, methodIdent) {
  const domainType = resolveCsType(morphism.domain, structInfo, stateAliases)
  const codomainType = resolveCsType(morphism.codomain, structInfo, stateAliases)
  return [
    `/// <summary>Морфизм FTS «${morphism.name}»: ${morphism.domain} → ${morphism.codomain} (закон: ${morphism.law}).</summary>`,
    `public static ${codomainType} ${methodIdent}(${domainType} proof)`,
    "{",
    "    // Закон морфизма объявлен и проверен на входе в ftsc; здесь мы лишь переносим",
    "    // уже установленное свидетельство домена в свидетельство кодомена.",
    "    return proof;",
    "}",
  ].join("\n")
}

function header(lines) {
  return ["// Сгенерировано ftsc (бэкенд C#). Не редактировать руками.", ...lines.map((line) => `// ${line}`)].join("\n")
}

/** Собирает идентификаторы структур и алиасы именованных состояний модуля. */
function planModuleTypes(document, typeNamer) {
  const structures = document.structures ?? []
  const morphisms = document.functors ?? []
  const structInfo = new Map()
  for (const structure of structures) structInfo.set(structure.name, { ident: typeNamer(structure.name) })
  const stateAliases = new Map()
  const registerState = (base) => {
    if (!BASE_TYPES.has(base) && !structInfo.has(base) && !stateAliases.has(base)) stateAliases.set(base, typeNamer(base))
  }
  for (const structure of structures) for (const field of structure.fields) registerState(splitType(field.type).base)
  for (const morphism of morphisms) {
    registerState(morphism.domain)
    registerState(morphism.codomain)
  }
  return { structInfo, stateAliases }
}

function emitModule(mod, namespaceNamer) {
  const doc = mod.document
  const structures = doc.structures ?? []
  const utilities = doc.utilities ?? []
  const morphisms = doc.functors ?? []
  const proposition = doc.proposition ?? null

  /* Тип-уровневый неймер зарезервировал «Utilities»/«Morphisms»: это имена
     статических классов ниже, и структура FTS, случайно названная так же,
     обязана обнаружиться как коллизия, а не молча срастись с ними. */
  const typeNamer = createNamer(pascal, ["Utilities", "Morphisms"])
  const { structInfo, stateAliases } = planModuleTypes(doc, typeNamer)

  const namespaceIdent = namespaceNamer(mod.name)

  const usings = ["#nullable enable", "using System;", "using global::Fts.Runtime;"]
  for (const [original, ident] of stateAliases) usings.push(renderStateAliasUsing(original, ident))

  const body = []
  for (const structure of structures) body.push(renderStructure(structure, structInfo, stateAliases))

  const methodIdents = new Map()
  if (utilities.length > 0) {
    const utilityNamer = createNamer(pascal, [])
    const utilityLines = ["public static class Utilities", "{"]
    utilities.forEach((utility, index) => {
      const ident = utilityNamer(utility.name)
      methodIdents.set(utility.name, ident)
      if (index > 0) utilityLines.push("")
      utilityLines.push(indent(renderUtility(utility, structInfo, stateAliases, ident)))
    })
    utilityLines.push("}")
    body.push(utilityLines.join("\n"))
  }
  if (morphisms.length > 0) {
    const morphismNamer = createNamer(pascal, [])
    const morphismLines = ["public static class Morphisms", "{"]
    morphisms.forEach((morphism, index) => {
      const ident = morphismNamer(morphism.name)
      if (index > 0) morphismLines.push("")
      morphismLines.push(indent(renderMorphism(morphism, structInfo, stateAliases, ident)))
    })
    morphismLines.push("}")
    body.push(morphismLines.join("\n"))
  }
  if (proposition) {
    body.push(
      [
        "/*",
        " * Теорема модуля. Доказана компилятором ядра FTS до генерации кода —",
        " * ftsc не перепроверяет доказательство, а лишь документирует уже проверенный факт.",
        ` * ${describeProposition(proposition)}`,
        proposition.detail ? ` * ${proposition.detail}` : null,
        " */",
      ]
        .filter((line) => line !== null)
        .join("\n"),
    )
  }

  const content = assembleFile(
    [`Модуль FTS: «${mod.name}» (категория «${mod.category}»)`, `Источник: ${mod.source}`],
    usings,
    namespaceIdent,
    body,
  )

  return { namespaceIdent, content, structInfo, stateAliases, utilities, methodIdents }
}

function emitFunctor(functor, registry, namespaceNamer) {
  const fromModule = registry.get(functor.from)
  const toModule = registry.get(functor.to)
  if (!fromModule || !toModule) {
    throw new Error(`функтор «${functor.name}» ссылается на неизвестный модуль (${functor.from} → ${functor.to})`)
  }
  const namespaceIdent = namespaceNamer(functor.name)
  const methodNamer = createNamer(pascal, [])

  const classLines = ["public static class Transform", "{"]
  functor.objects.forEach((object, index) => {
    const fromStruct = fromModule.structInfo.get(object.from)
    const toStruct = toModule.structInfo.get(object.to)
    if (!fromStruct || !toStruct) {
      throw new Error(`функтор «${functor.name}»: объект «${object.from}» → «${object.to}» ссылается на неизвестную структуру`)
    }
    const method = methodNamer(`${object.from} к ${object.to}`)
    if (index > 0) classLines.push("")
    const lines = [
      `/// <summary>Функтор FTS «${functor.name}»: объект «${object.from}» → «${object.to}». Отображение объекта категории-домена в объект категории-кодомена.</summary>`,
      `public static global::${toModule.namespaceIdent}.${toStruct.ident} ${method}(global::${fromModule.namespaceIdent}.${fromStruct.ident} input)`,
      "{",
      `    return new global::${toModule.namespaceIdent}.${toStruct.ident}`,
      "    {",
      ...object.fields.map(
        (fieldMap) => `        ${toStruct.idents.get(fieldMap.to)} = input.${fromStruct.idents.get(fieldMap.from)},`,
      ),
      "    };",
      "}",
    ]
    classLines.push(indent(lines.join("\n")))
  })
  classLines.push("}")

  if (functor.morphisms.length > 0) {
    const comment = functor.morphisms.map((m) => `«${m.from}» (домен) сохраняется как «${m.to}» (кодомен)`).join("; ")
    classLines.push("", `/* Сохранение морфизмов проверено фронтендом ftsc (FTSC_FUNCTOR_MORPHISM_SHAPE): ${comment}. */`)
  }

  const content = assembleFile(
    [`Функтор FTS: «${functor.name}» из «${functor.from}» в «${functor.to}»`],
    ["#nullable enable", "using System;"],
    namespaceIdent,
    [classLines.join("\n")],
  )

  return { namespaceIdent, content }
}

/** Собирает файл .cs: шапка, using-директивы, затем `namespace X { ... }` без лишних пустых строк. */
function assembleFile(headerLines, usingLines, namespaceIdent, bodySections) {
  return `${[
    header(headerLines),
    usingLines.join("\n"),
    [`namespace ${namespaceIdent}`, "{", indent(bodySections.join("\n\n")), "}"].join("\n"),
  ].join("\n\n")}\n`
}

function indent(text, level = 1) {
  const prefix = "    ".repeat(level)
  return text
    .split("\n")
    .map((line) => (line.length > 0 ? prefix + line : line))
    .join("\n")
}

const RUNTIME_CONTENT = `${header(["Общая для всех модулей часть рантайма ftsc."])}
#nullable enable
using System;

namespace Fts.Runtime
{
    /// <summary>
    /// Свойство утилиты FTS — это постусловие: нарушение обязано прекратить
    /// выполнение способом, родным для языка (SPEC.md, раздел 5.3). Родной способ
    /// в C# — исключение с именем утилиты и свойства.
    /// </summary>
    public sealed class FtsPropertyViolationException : Exception
    {
        public string Utility { get; }
        public string Property { get; }

        public FtsPropertyViolationException(string utility, string property)
            : base($"нарушено свойство «{property}» утилиты «{utility}»")
        {
            Utility = utility;
            Property = property;
        }
    }
}
`

/** Раннер тестов примеров: самостоятельный класс с Main, без внешних фреймворков (xUnit тянуть неоткуда). */
function emitTestRunner(program, registry) {
  const modulesWithExamples = program.modules
    .map((mod) => registry.get(mod.name))
    .filter((emitted) => emitted.utilities.some((utility) => (utility.examples ?? []).length > 0))

  const bodyLines = ["int passed = 0;", "int total = 0;", ""]
  for (const emitted of modulesWithExamples) {
    for (const utility of emitted.utilities) {
      const { base: outputBase } = splitType(utility.output)
      const outputKind = csKind(outputBase)
      const method = emitted.methodIdents.get(utility.name)
      const structName = utility.input
      const structInfo = emitted.structInfo.get(structName)
      for (const example of utility.examples ?? []) {
        const fields = structInfo.idents
          ? [...structInfo.idents.entries()]
              .map(([original, ident]) => `${ident} = ${renderLiteral(example.input[original], structInfo.kinds.get(original))}`)
              .join(", ")
          : ""
        const expected = renderLiteral(example.expected, outputKind)
        bodyLines.push("total++;")
        bodyLines.push("try")
        bodyLines.push("{")
        bodyLines.push(
          `    var actual = global::${emitted.namespaceIdent}.Utilities.${method}(new global::${emitted.namespaceIdent}.${structInfo.ident} { ${fields} });`,
        )
        bodyLines.push(`    if (actual == ${expected})`)
        bodyLines.push("    {")
        bodyLines.push("        passed++;")
        bodyLines.push("    }")
        bodyLines.push("    else")
        bodyLines.push("    {")
        bodyLines.push(
          `        Console.WriteLine(${quote(`FAIL ${utility.name}: ${example.name} — ожидалось `)} + ${expected} + " получено " + actual);`,
        )
        bodyLines.push("    }")
        bodyLines.push("}")
        bodyLines.push("catch (Exception ex)")
        bodyLines.push("{")
        bodyLines.push(`    Console.WriteLine(${quote(`FAIL ${utility.name}: ${example.name} — исключение `)} + ex.Message);`)
        bodyLines.push("}")
        bodyLines.push("")
      }
    }
  }
  bodyLines.push('Console.WriteLine($"{passed}/{total} passed");')
  bodyLines.push("return passed == total ? 0 : 1;")

  const content = assembleFile(
    ["Самостоятельный раннер тестов примеров (без xUnit — тянуть неоткуда)."],
    ["#nullable enable", "using System;"],
    "FtsGenerated.Tests",
    [
      [
        "/// <summary>Точка входа: прогоняет все примеры FTS и печатает «N/M passed».</summary>",
        "public static class Program",
        "{",
        indent(["public static int Main(string[] args)", "{", indent(bodyLines.join("\n")), "}"].join("\n")),
        "}",
      ].join("\n"),
    ],
  )
  return { path: "FtsTests.cs", content }
}

/**
 * @param {object} program — IR проекта ftsc (см. SPEC.md, раздел 4).
 * @param {{ projectName?: string }} [options]
 * @returns {Array<{ path: string, content: string }>}
 */
export function emit(program, options = {}) {
  /* Файл называется как namespace — обычная конвенция C#. Отдельный неймер
     для файлов не нужен: namespaceNamer уже гарантирует уникальность
     идентификатора, а значит и уникальность производного от него имени файла. */
  const namespaceNamer = createNamer(pascal, ["FtsGenerated", "Fts"])

  const files = [{ path: "FtsRuntime.cs", content: RUNTIME_CONTENT }]
  const registry = new Map()

  for (const mod of program.modules) {
    const emitted = emitModule(mod, namespaceNamer)
    registry.set(mod.name, emitted)
    files.push({ path: `${emitted.namespaceIdent}.cs`, content: emitted.content })
  }

  for (const functor of program.functors ?? []) {
    const emitted = emitFunctor(functor, registry, namespaceNamer)
    files.push({ path: `${emitted.namespaceIdent}.cs`, content: emitted.content })
  }

  const hasExamples = program.modules.some((mod) =>
    (registry.get(mod.name).utilities ?? []).some((utility) => (utility.examples ?? []).length > 0),
  )
  if (hasExamples) {
    files.push(emitTestRunner(program, registry))
  }

  void options // имя проекта не влияет на C#-вывод: у него нет отдельного индекс-файла, роль индекса играют namespace'ы

  return files
}
