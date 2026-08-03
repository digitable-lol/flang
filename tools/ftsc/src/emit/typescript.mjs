/**
 * Бэкенд кодогенерации ftsc → TypeScript.
 *
 * Вход — многомодульный IR (см. tools/ftsc/SPEC.md, раздел 4). Один модуль IR
 * даёт один файл `.ts`; общий `index.ts` реэкспортирует модули через
 * namespace-обёртку (`export * as Имя from './файл'`), а не плоско —
 * плоский реэкспорт из независимо транслитерированных модулей может дать два
 * одинаковых идентификатора на верхнем уровне, а именно это раздел 5.7
 * запрещает делать молча.
 *
 * Почему поля структур остаются кириллическими строковыми ключами
 * (`"сумма": number`), а не транслитерируются: TypeScript/JS разрешают любой
 * строковый литерал в качестве имени свойства, и ядро FTS уже проверяет
 * такой подход (см. src/utility.ts:generateTypeScript) —
 * он проще и не создаёт лишнего пространства коллизий там, где его не
 * требует ни один компилятор. Транслитерация обязательна ровно там, где
 * целевой язык требует настоящий идентификатор: имена типов (interface),
 * имена функций (утилиты, морфизмы, функторы) и имена модулей.
 */
import { createNamer, pascal, camel, snake, quote } from "../naming.mjs"

export const target = {
  id: "typescript",
  name: "TypeScript",
  extension: ".ts",
  /* Тулчейн проверяется тестом эмиттера: ставим typescript во временный
     каталог (в репозитории зависимости не добавляем) и компилируем им. */
  toolchain: { probe: ["npx", "--yes", "tsc", "--version"], test: ["node", "--test"] },
}

/* Пять базовых типов FTS. Всё остальное, что встречается в качестве типа
   поля или домена/кодомена морфизма, — именованное состояние: по факту
   работы ядра (natural-parser.js: parseField/parseMorphism) такие значения
   всегда булевы (свидетель теоремы хранит true/false), поэтому состояние
   транслируется в дистинктный алиас `boolean` — сохраняет читаемое имя типа,
   но не создаёt рантайм-обёртки, которой в модели нет. */
const BASE_TYPES = new Set(["Строка", "Число", "Деньги", "Признак", "Дата"])

function tsBaseType(base) {
  if (base === "Строка" || base === "Дата") return "string"
  if (base === "Число" || base === "Деньги") return "number"
  return "boolean" // Признак
}

function splitType(rawType) {
  const optional = /\|\s*undefined\s*$/u.test(rawType)
  const base = rawType.replace(/\s*\|\s*undefined\s*$/u, "").trim()
  return { base, optional }
}

function resolveTsType(rawType, structInfo, stateAliases) {
  const { base, optional } = splitType(rawType)
  const inner = BASE_TYPES.has(base)
    ? tsBaseType(base)
    : structInfo.has(base)
      ? structInfo.get(base).ident
      : stateAliases.has(base)
        ? stateAliases.get(base)
        : "unknown"
  return optional ? `${inner} | undefined` : inner
}

function renderScalar(value) {
  return JSON.stringify(value)
}

const COMPARISON_OPERATORS = { eq: "===", neq: "!==", gte: ">=", lte: "<=", gt: ">", lt: "<" }

function renderComparison(left, operator, right) {
  return `${left} ${COMPARISON_OPERATORS[operator]} ${right}`
}

function renderOperand(operand) {
  switch (operand.kind) {
    case "value":
      return renderScalar(operand.value)
    case "result":
      return "result"
    case "field":
      return `input[${JSON.stringify(operand.field)}]`
    case "percent":
      return `((${operand.percent} / 100) * input[${JSON.stringify(operand.field)}])`
    default:
      throw new Error(`неизвестный вид операнда «${operand.kind}»`)
  }
}

function renderCondition(item) {
  return renderComparison(`input[${JSON.stringify(item.field)}]`, item.operator, renderOperand(item.value))
}

/** Шапка сгенерированного файла: источник, предупреждение, не редактировать руками. */
function header(lines) {
  return [`// Сгенерировано ftsc (бэкенд TypeScript). Не редактировать руками.`, ...lines.map((line) => `// ${line}`), ""].join(
    "\n",
  )
}

function renderStateAlias(originalName, ident) {
  return [
    `/** Именованное состояние FTS «${originalName}». Хранится как булев признак: наличие/отсутствие состояния. */`,
    `export type ${ident} = boolean;`,
  ].join("\n")
}

function renderStructure(structure, structInfo, stateAliases) {
  const info = structInfo.get(structure.name)
  const lines = [`/** Объект FTS «${structure.name}». */`, `export interface ${info.ident} {`]
  for (const field of structure.fields) {
    const { optional } = splitType(field.type)
    const tsType = resolveTsType(field.type, structInfo, stateAliases)
    lines.push(`  ${JSON.stringify(field.name)}${optional ? "?" : ""}: ${tsType};`)
  }
  lines.push("}")
  return lines.join("\n")
}

function renderUtility(utility, structInfo, stateAliases, funcIdent) {
  const inputType = structInfo.has(utility.input)
    ? structInfo.get(utility.input).ident
    : resolveTsType(utility.input, structInfo, stateAliases)
  const outputType = resolveTsType(utility.output, structInfo, stateAliases)
  const lines = [
    `/** Утилита FTS «${utility.name}»: ${utility.input} → ${utility.output}. Выполняются все правила с истинным условием, по порядку объявления — это не if/else. */`,
    `export function ${funcIdent}(input: ${inputType}): ${outputType} {`,
    `  let result: ${outputType} = ${renderScalar(utility.initial)};`,
  ]
  for (const rule of utility.rules) {
    const condition = rule.when.map(renderCondition).join(" && ") || "true"
    lines.push(`  // правило «${rule.name}»`)
    lines.push(`  if (${condition}) {`)
    const operand = renderOperand(rule.action.value)
    lines.push(`    ${rule.action.kind === "add" ? `result += ${operand};` : `result = ${operand};`}`)
    lines.push("  }")
  }
  for (const property of utility.properties) {
    const comparison = renderComparison("result", property.operator, renderOperand(property.value))
    lines.push(`  if (!(${comparison})) throw new FtsPropertyViolationError(${quote(utility.name)}, ${quote(property.name)});`)
  }
  lines.push("  return result;", "}")
  return lines.join("\n")
}

function describeProposition(proposition) {
  if (proposition.kind === "witness") {
    const selector = JSON.stringify(proposition.selector ?? {})
    return `свидетель: структура «${proposition.structure}», поле «${proposition.field}» = ${JSON.stringify(proposition.value)} при выборке ${selector}`
  }
  if (proposition.kind === "apply") {
    return `применение морфизма «${proposition.functor}» к (${describeProposition(proposition.arg)})`
  }
  if (proposition.kind === "compose") {
    return `композиция морфизмов [${proposition.functors.join(" ∘ ")}] применена к (${describeProposition(proposition.arg)})`
  }
  return "тривиальная теорема (⊤)"
}

function renderMorphism(morphism, structInfo, stateAliases, funcIdent) {
  const domainType = resolveTsType(morphism.domain, structInfo, stateAliases)
  const codomainType = resolveTsType(morphism.codomain, structInfo, stateAliases)
  return [
    `/** Морфизм FTS «${morphism.name}»: ${morphism.domain} → ${morphism.codomain} (закон: ${morphism.law}). */`,
    `export function ${funcIdent}(proof: ${domainType}): ${codomainType} {`,
    `  // Закон морфизма объявлен и проверен на входе в ftsc («${morphism.law}»); здесь мы лишь`,
    `  // переносим уже установленное свидетельство домена в свидетельство кодомена.`,
    "  return proof;",
    "}",
  ].join("\n")
}

function renderProposition(proposition) {
  return [
    "/**",
    " * Теорема модуля. Доказана компилятором ядра FTS до генерации кода —",
    " * ftsc не перепроверяет доказательство, а лишь документирует уже проверенный факт.",
    ` * ${describeProposition(proposition)}`,
    proposition.detail ? ` * ${proposition.detail}` : null,
    " */",
  ]
    .filter((line) => line !== null)
    .join("\n")
}

/** Собирает описание типов модуля: идентификаторы структур и алиасы состояний. */
function planModuleTypes(document, typeNamer) {
  const structures = document.structures ?? []
  const morphisms = document.functors ?? []
  const structInfo = new Map()
  for (const structure of structures) {
    structInfo.set(structure.name, { ident: typeNamer(structure.name) })
  }
  const stateAliases = new Map()
  const registerState = (base) => {
    if (!BASE_TYPES.has(base) && !structInfo.has(base) && !stateAliases.has(base)) {
      stateAliases.set(base, typeNamer(base))
    }
  }
  for (const structure of structures) {
    for (const field of structure.fields) registerState(splitType(field.type).base)
  }
  for (const morphism of morphisms) {
    registerState(morphism.domain)
    registerState(morphism.codomain)
  }
  return { structInfo, stateAliases }
}

function emitModule(mod, fileNamer, exportNamer) {
  const doc = mod.document
  const structures = doc.structures ?? []
  const utilities = doc.utilities ?? []
  const morphisms = doc.functors ?? []
  const proposition = doc.proposition ?? null

  const typeNamer = createNamer(pascal, [])
  const valueNamer = createNamer(camel, [])
  const { structInfo, stateAliases } = planModuleTypes(doc, typeNamer)

  const fileBase = fileNamer(mod.name)
  const exportIdent = exportNamer(mod.name)

  const sections = [header([`Модуль FTS: «${mod.name}» (категория «${mod.category}»)`, `Источник: ${mod.source}`])]
  if (utilities.length > 0) {
    sections.push(`import { FtsPropertyViolationError } from './fts-runtime';`)
  }
  for (const [original, ident] of stateAliases) sections.push(renderStateAlias(original, ident))
  for (const structure of structures) sections.push(renderStructure(structure, structInfo, stateAliases))

  const funcIdents = new Map()
  for (const utility of utilities) {
    const ident = valueNamer(utility.name)
    funcIdents.set(utility.name, ident)
    sections.push(renderUtility(utility, structInfo, stateAliases, ident))
  }
  for (const morphism of morphisms) {
    const ident = valueNamer(morphism.name)
    sections.push(renderMorphism(morphism, structInfo, stateAliases, ident))
  }
  if (proposition) sections.push(renderProposition(proposition))

  const content = `${sections.join("\n\n")}\n`

  let testContent = null
  const withExamples = utilities.filter((utility) => (utility.examples ?? []).length > 0)
  if (withExamples.length > 0) {
    const lines = [
      header([`Тесты примеров модуля «${mod.name}» (node:test).`]),
      `import assert from 'node:assert/strict';`,
      `import { test } from 'node:test';`,
      `import { ${withExamples.map((u) => funcIdents.get(u.name)).join(", ")} } from './${fileBase}';`,
      "",
    ]
    for (const utility of withExamples) {
      const ident = funcIdents.get(utility.name)
      for (const example of utility.examples) {
        lines.push(`test(${quote(`${utility.name}: ${example.name}`)}, () => {`)
        lines.push(`  const actual = ${ident}(${JSON.stringify(example.input)});`)
        lines.push(`  assert.deepEqual(actual, ${renderScalar(example.expected)});`)
        lines.push("});", "")
      }
    }
    testContent = `${lines.join("\n")}\n`
  }

  return {
    fileBase,
    exportIdent,
    content,
    testContent,
    structInfo,
    stateAliases,
  }
}

function emitFunctor(functor, registry, fileNamer, exportNamer) {
  const fromModule = registry.get(functor.from)
  const toModule = registry.get(functor.to)
  if (!fromModule || !toModule) {
    throw new Error(`функтор «${functor.name}» ссылается на неизвестный модуль (${functor.from} → ${functor.to})`)
  }
  const fileBase = fileNamer(functor.name)
  const exportIdent = exportNamer(functor.name)
  const funcNamer = createNamer(camel, [])

  const fromIdents = [...new Set(functor.objects.map((o) => fromModule.structInfo.get(o.from)?.ident).filter(Boolean))]
  const toIdents = [...new Set(functor.objects.map((o) => toModule.structInfo.get(o.to)?.ident).filter(Boolean))]
  const sections = [
    header([`Функтор FTS: «${functor.name}» из «${functor.from}» в «${functor.to}»`]),
    `import type { ${fromIdents.join(", ")} } from './${fromModule.fileBase}';`,
    `import type { ${toIdents.join(", ")} } from './${toModule.fileBase}';`,
  ]

  for (const object of functor.objects) {
    const fromStruct = fromModule.structInfo.get(object.from)
    const toStruct = toModule.structInfo.get(object.to)
    if (!fromStruct || !toStruct) {
      throw new Error(`функтор «${functor.name}»: объект «${object.from}» → «${object.to}» ссылается на неизвестную структуру`)
    }
    const fn = funcNamer(`${functor.name} ${object.from}`)
    const lines = [
      `/** Функтор FTS «${functor.name}»: объект «${object.from}» → «${object.to}». Отображение объекта категории-домена в объект категории-кодомена. */`,
      `export function ${fn}(input: ${fromStruct.ident}): ${toStruct.ident} {`,
      "  return {",
    ]
    for (const fieldMap of object.fields) {
      lines.push(`    ${JSON.stringify(fieldMap.to)}: input[${JSON.stringify(fieldMap.from)}],`)
    }
    lines.push("  };", "}")
    sections.push(lines.join("\n"))
  }

  if (functor.morphisms.length > 0) {
    const comment = functor.morphisms.map((m) => `«${m.from}» (домен) сохраняется как «${m.to}» (кодомен)`).join("; ")
    sections.push(`/* Сохранение морфизмов проверено фронтендом ftsc (закон FTSC_FUNCTOR_MORPHISM_SHAPE): ${comment}. */`)
  }

  return { fileBase, exportIdent, content: `${sections.join("\n\n")}\n` }
}

const RUNTIME_CONTENT = `${header(["Общая для всех модулей часть рантайма ftsc."])}
/**
 * Свойство утилиты FTS — это постусловие: нарушение обязано прекратить
 * выполнение способом, родным для языка (раздел 5.3 SPEC.md). В TypeScript
 * родной способ — исключение с именем утилиты и свойства, чтобы тест или
 * вызывающий код могли отличить нарушение бизнес-инварианта от обычной
 * ошибки данных.
 */
export class FtsPropertyViolationError extends Error {
  readonly utility: string;
  readonly property: string;

  constructor(utility: string, property: string) {
    super(\`нарушено свойство «\${property}» утилиты «\${utility}»\`);
    this.name = 'FtsPropertyViolationError';
    this.utility = utility;
    this.property = property;
  }
}
`

/**
 * @param {object} program — IR проекта ftsc (см. SPEC.md, раздел 4).
 * @param {{ projectName?: string }} [options]
 * @returns {Array<{ path: string, content: string }>}
 */
export function emit(program, options = {}) {
  const projectName = options.projectName ?? program.project ?? "ftsc-project"

  /* Отдельные неймеры на файловые имена (snake, независимая проверка коллизий
     по snake-форме) и на идентификаторы реэкспорта в index.ts (pascal) — два
     разных пространства имён с собственными правилами читаемости, каждое
     обязано остаться внутренне непротиворечивым. */
  const fileNamer = createNamer(snake, ["fts-runtime", "index"])
  const exportNamer = createNamer(pascal, [])

  const files = [{ path: "fts-runtime.ts", content: RUNTIME_CONTENT }]
  const registry = new Map()

  for (const mod of program.modules) {
    const emitted = emitModule(mod, fileNamer, exportNamer)
    registry.set(mod.name, emitted)
    files.push({ path: `${emitted.fileBase}.ts`, content: emitted.content })
    if (emitted.testContent) {
      files.push({ path: `${emitted.fileBase}.test.ts`, content: emitted.testContent })
    }
  }

  const functorEmits = []
  for (const functor of program.functors ?? []) {
    const emitted = emitFunctor(functor, registry, fileNamer, exportNamer)
    functorEmits.push(emitted)
    files.push({ path: `${emitted.fileBase}.ts`, content: emitted.content })
  }

  const indexLines = [
    header([`Индекс проекта «${projectName}»: реэкспорт всех модулей и функторов.`]),
    `export * from './fts-runtime';`,
  ]
  for (const mod of program.modules) {
    const emitted = registry.get(mod.name)
    indexLines.push(`export * as ${emitted.exportIdent} from './${emitted.fileBase}';`)
  }
  for (const emitted of functorEmits) {
    indexLines.push(`export * as ${emitted.exportIdent} from './${emitted.fileBase}';`)
  }
  files.push({ path: "index.ts", content: `${indexLines.join("\n")}\n` })

  return files
}
