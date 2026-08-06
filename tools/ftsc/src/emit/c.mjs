/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Бэкенд кодогенерации C для ftsc.
 *
 * Вход — IR из SPEC.md, выход — самодостаточный набор файлов на C11 без единой
 * зависимости кроме стандартной библиотеки: заголовок рантайма, пара .h/.c на
 * каждый модуль, файл функторов и один исполняемый тест примеров.
 *
 * Три решения, которые определяют весь остальной код:
 *
 * 1. Свойства модели — постусловия, а в C нет исключений. Утилита возвращает
 *    `ftsc_status`, результат отдаёт через указатель и при нарушении свойства НЕ
 *    трогает `*result`: вычисление прекращается ошибкой, а не «чинится».
 * 2. Опциональное поле — пара `bool has_x` + значение, а не указатель. Структуры
 *    остаются копируемыми по значению и не заводят вопрос о владении памятью;
 *    указатель потребовал бы хранилища под каждое значение и разговора о том,
 *    кто его освобождает, — для чистых вычислений это лишняя сущность.
 * 3. Числа сравниваются с допуском (см. runtime.mjs), потому что «деньги» модели
 *    десятичные, а double — нет.
 *
 * Все имена идентификаторов выдаёт createNamer из naming.mjs: коллизия
 * транслитерации обязана быть ошибкой сборки, а не молчаливым переименованием.
 */
import { createNamer, pascal, quote, screaming, snake } from "../naming.mjs"
import { escapeBidiInFiles, escapeBidiOctalBytes } from "../bidi.mjs"
import { RUNTIME_HEADER } from "./c/runtime.mjs"

export const target = {
  id: "c",
  name: "C",
  extension: ".c",
  /* `cc` есть в любой POSIX-системе; тесты примеров собираются и запускаются
     сгенерированным Makefile — он же документирует обязательные флаги. */
  toolchain: { probe: ["cc", "--version"], test: ["make", "test"] },
}

/* Ключевые слова C11 плюс имена, занятые рантаймом: попадание модели в этот
   список — ошибка сборки от createNamer, а не тихая порча кода. */
const RESERVED = [
  "alignas",
  "alignof",
  "auto",
  "bool",
  "break",
  "case",
  "char",
  "complex",
  "const",
  "continue",
  "default",
  "do",
  "double",
  "else",
  "enum",
  "extern",
  "false",
  "float",
  "for",
  "generic",
  "goto",
  "if",
  "imaginary",
  "inline",
  "int",
  "long",
  "noreturn",
  "register",
  "restrict",
  "return",
  "short",
  "signed",
  "sizeof",
  "static",
  "static_assert",
  "struct",
  "switch",
  "thread_local",
  "true",
  "typedef",
  "union",
  "unsigned",
  "void",
  "volatile",
  "while",
  "main",
  "ftsc_status",
  "ftsc_percent",
  "ftsc_check",
  "NULL",
]

const FILE_RESERVED = [...RESERVED, "ftsc_runtime", "ftsc_functors", "ftsc_tests"]

const ORDER_OPERATORS = { gte: "ftsc_number_gte", lte: "ftsc_number_lte", gt: "ftsc_number_gt", lt: "ftsc_number_lt" }

/**
 * @param {object} program IR проекта
 * @param {{ projectName?: string }} [options]
 * @returns {Array<{ path: string, content: string }>}
 */
export function emit(program, options = {}) {
  const project = options.projectName ?? program.project ?? "ftsc"
  const scope = buildScope(program)
  const files = [
    { path: "ftsc_runtime.h", content: `${banner(project, "рантайм: статусы, сравнение чисел, процент")}\n${RUNTIME_HEADER}` },
  ]

  for (const module of scope.modules) {
    files.push({ path: `${module.file}.h`, content: renderModuleHeader(project, module, scope) })
    files.push({ path: `${module.file}.c`, content: renderModuleSource(project, module) })
  }

  if (scope.functors.length > 0) {
    files.push({ path: "ftsc_functors.h", content: renderFunctorsHeader(project, scope) })
    files.push({ path: "ftsc_functors.c", content: renderFunctorsSource(project, scope) })
  }

  files.push({ path: "ftsc_tests.c", content: renderTests(project, scope) })
  files.push({ path: "Makefile", content: renderMakefile(project, scope) })
  /* Последний шаг печати — снять сырые двунаправленные управляющие со всего
     вывода (../bidi.mjs). Имя FTS (правила, свойства, примера, категории) уезжает
     и в комментарий («правило «…»»), и в строковый литерал (ftsc_check в
     прогонщике примеров, имя нарушенного свойства в *violation), а комментарий
     читают первым и проверить исполнением не могут. gcc 13 под -Werror
     останавливает сборку на НЕПАРНОМ управляющем (в комментарии тоже), а парную
     пару RLO…PDF пропускает молча: его молчание не доказательство. Форма для C —
     байты UTF-8 восьмеричными: в C99 узкая строка байт-точна только так. */
  return escapeBidiInFiles(files, escapeBidiOctalBytes)
}

/* ------------------------------------------------------------------ разбор IR */

/**
 * Единый проход по IR: имена, структуры, утилиты, морфизмы, функторы.
 * Собирается заранее, чтобы генерация текста уже ничего не решала — иначе
 * порядок обхода начал бы влиять на выданные идентификаторы.
 */
function buildScope(program) {
  const typeName = createNamer(pascal, RESERVED)
  const functionName = createNamer(snake, RESERVED)
  const fileNameOf = createNamer(snake, FILE_RESERVED)

  const modules = orderModules(program).map((module) => ({
    name: module.name ?? module.category,
    category: module.category ?? module.name,
    source: module.source ?? null,
    imports: module.imports ?? [],
    exports: module.exports ?? null,
    document: module.document ?? {},
    file: fileNameOf(module.name ?? module.category),
    structures: [],
    utilities: [],
    morphisms: [],
    proposition: (module.document ?? {}).proposition ?? null,
  }))

  const structures = new Map()
  for (const module of modules) {
    for (const structure of module.document.structures ?? []) {
      const previous = structures.get(structure.name)
      if (previous !== undefined) {
        throw new Error(
          `объект «${structure.name}» объявлен в модулях «${previous.module.name}» и «${module.name}» — ` +
            "в C одно пространство имён типов, переименуйте один из объектов в модели",
        )
      }
      const declared = { fts: structure.name, c: typeName(structure.name), module, fields: [], raw: structure }
      structures.set(structure.name, declared)
    }
  }

  /* Поля описываются вторым проходом: поле может ссылаться на объект,
     объявленный ниже по файлу или в соседнем модуле. */
  for (const declared of structures.values()) {
    const fieldName = createNamer(snake, RESERVED)
    declared.fields = (declared.raw.fields ?? []).map((field) => ({
      fts: field.name,
      c: fieldName(field.name),
      type: describeType(field.type, structures, `поле «${field.name}» объекта «${declared.fts}»`),
      declared: field.type,
    }))
    declared.module.structures.push(declared)
  }
  for (const module of modules) {
    module.structures = sortByDependency(module.structures)
  }

  for (const module of modules) {
    for (const utility of module.document.utilities ?? []) {
      module.utilities.push(buildUtility(utility, module, structures, functionName))
    }
    /* В документе ядра морфизмы исторически лежат в поле functors — это не
       функторы IR между категориями. */
    for (const morphism of module.document.functors ?? []) {
      module.morphisms.push({
        fts: morphism.name,
        c: functionName(morphism.name),
        domain: morphism.domain,
        codomain: morphism.codomain,
        law: morphism.law ?? "morphism.declared",
      })
    }
  }

  const functors = (program.functors ?? []).map((functor) => buildFunctor(functor, modules, structures, functionName))
  return { modules, structures, functors }
}

/** Топологический порядок из IR; при его отсутствии — порядок объявления. */
function orderModules(program) {
  const modules = program.modules ?? []
  const order = program.order ?? []
  if (order.length === 0) return modules
  const rank = new Map(order.map((name, index) => [name, index]))
  return modules
    .map((module, index) => ({ module, index }))
    .sort((left, right) => {
      const leftRank = rank.get(left.module.name ?? left.module.category) ?? Number.MAX_SAFE_INTEGER
      const rightRank = rank.get(right.module.name ?? right.module.category) ?? Number.MAX_SAFE_INTEGER
      return leftRank - rightRank || left.index - right.index
    })
    .map((entry) => entry.module)
}

/** Вложенный объект обязан быть объявлен раньше — иначе C не примет typedef. */
function sortByDependency(structures) {
  const byName = new Map(structures.map((structure) => [structure.fts, structure]))
  const emitted = new Set()
  const result = []
  const visit = (structure, stack) => {
    if (emitted.has(structure.fts)) return
    if (stack.has(structure.fts)) {
      throw new Error(`объект «${structure.fts}» вложен сам в себя — в C это тип бесконечного размера`)
    }
    stack.add(structure.fts)
    for (const field of structure.fields) {
      const nested = field.type.kind === "struct" ? byName.get(field.type.base) : undefined
      if (nested !== undefined) visit(nested, stack)
    }
    stack.delete(structure.fts)
    emitted.add(structure.fts)
    result.push(structure)
  }
  for (const structure of structures) visit(structure, new Set())
  return result
}

/**
 * Тип поля FTS → тип C. Именованное состояние («является состоянием «Готов к
 * отгрузке»») — bool: состояние либо достигнуто, либо нет, третьего в модели
 * нет, а имя состояния сохраняется в комментарии рядом с полем.
 */
function describeType(declared, structures, where) {
  const optional = /\|\s*undefined/u.test(String(declared))
  const base = String(declared)
    .replace(/\s*\|\s*undefined/gu, "")
    .trim()
  if (base === "Число" || base === "Деньги" || base === "number") {
    return { kind: "number", c: "double", optional, base }
  }
  if (base === "Строка" || base === "Дата" || base === "string") {
    return { kind: "text", c: "const char *", optional, base }
  }
  if (base === "Признак" || base === "boolean") {
    return { kind: "flag", c: "bool", optional, base }
  }
  if (structures.has(base)) {
    if (optional) {
      throw new Error(`${where}: опциональный вложенный объект «${base}» пока не поддержан бэкендом C`)
    }
    return { kind: "struct", c: structures.get(base).c, optional, base }
  }
  return { kind: "flag", c: "bool", optional, base, state: true }
}

function buildUtility(utility, module, structures, functionName) {
  const input = structures.get(utility.input)
  if (input === undefined) {
    throw new Error(`утилита «${utility.name}» ссылается на неизвестный объект «${utility.input}»`)
  }
  const output = describeType(utility.output, structures, `результат утилиты «${utility.name}»`)
  if (output.kind === "struct") {
    throw new Error(
      `утилита «${utility.name}» возвращает объект «${utility.output}» — бэкенд C поддерживает только скалярный результат`,
    )
  }
  const fields = new Map(input.fields.map((field) => [field.fts, field]))
  return {
    fts: utility.name,
    c: functionName(utility.name),
    module,
    input,
    output,
    fields,
    initial: utility.initial,
    rules: utility.rules ?? [],
    properties: utility.properties ?? [],
    examples: utility.examples ?? [],
  }
}

function buildFunctor(functor, modules, structures, functionName) {
  const objects = (functor.objects ?? []).map((mapping) => {
    const from = structures.get(mapping.from)
    const to = structures.get(mapping.to)
    if (from === undefined) throw new Error(`функтор «${functor.name}»: неизвестен объект домена «${mapping.from}»`)
    if (to === undefined) throw new Error(`функтор «${functor.name}»: неизвестен объект кодомена «${mapping.to}»`)
    const targetFields = new Map(to.fields.map((field) => [field.fts, field]))
    const sourceFields = new Map(from.fields.map((field) => [field.fts, field]))
    const fields = (mapping.fields ?? []).map((pair) => {
      const source = sourceFields.get(pair.from)
      const image = targetFields.get(pair.to)
      if (source === undefined) throw new Error(`функтор «${functor.name}»: у объекта «${from.fts}» нет поля «${pair.from}»`)
      if (image === undefined) throw new Error(`функтор «${functor.name}»: у объекта «${to.fts}» нет поля «${pair.to}»`)
      if (source.type.kind !== image.type.kind) {
        throw new Error(
          `функтор «${functor.name}»: поле «${pair.from}» (${source.declared}) не переносится в «${pair.to}» (${image.declared})`,
        )
      }
      if (source.type.optional && !image.type.optional) {
        throw new Error(`функтор «${functor.name}»: поле «${pair.from}» опционально, а его образ «${pair.to}» — нет`)
      }
      return { source, image }
    })
    return {
      from,
      to,
      fields,
      c: functionName(`${functor.name} ${mapping.from}`),
    }
  })
  return {
    fts: functor.name,
    from: functor.from,
    to: functor.to,
    objects,
    morphisms: functor.morphisms ?? [],
    modules: modules.filter((module) => module.name === functor.from || module.name === functor.to),
  }
}

/* --------------------------------------------------------- выражения утилиты */

/**
 * Операнд FTS → выражение C вместе с его типом: тип нужен, чтобы выбрать
 * сравнение (числа с допуском, строки через strcmp, признаки через ==).
 * Прочитанные опциональные поля складываются в `touched` — по ним генератор
 * потом ставит проверки наличия.
 */
function renderOperand(operand, utility, touched) {
  if (operand.kind === "value") {
    return { code: literal(operand.value, `значение правила утилиты «${utility.fts}»`), kind: kindOf(operand.value) }
  }
  if (operand.kind === "result") {
    return { code: "value", kind: utility.output.kind }
  }
  if (operand.kind === "field") {
    const field = fieldOf(utility, operand.field)
    if (field.type.optional) touched.add(field)
    return { code: `input->${field.c}`, kind: field.type.kind }
  }
  if (operand.kind === "percent") {
    const field = fieldOf(utility, operand.field)
    if (field.type.kind !== "number") {
      throw new Error(
        `утилита «${utility.fts}»: процент можно взять только от числового поля, а «${operand.field}» — ${field.declared}`,
      )
    }
    if (field.type.optional) touched.add(field)
    return { code: `ftsc_percent(${number(operand.percent)}, input->${field.c})`, kind: "number" }
  }
  throw new Error(`утилита «${utility.fts}»: неизвестный вид операнда «${operand.kind}»`)
}

function renderComparison(left, operator, right, where) {
  if (left.kind !== right.kind) {
    throw new Error(`${where}: сравниваются несовместимые типы (${left.kind} и ${right.kind})`)
  }
  if (operator === "eq" || operator === "neq") {
    const suffix = operator === "eq" ? "eq" : "neq"
    if (left.kind === "number") return `ftsc_number_${suffix}(${left.code}, ${right.code})`
    if (left.kind === "text") return `ftsc_text_${suffix}(${left.code}, ${right.code})`
    /* Без скобок: `==` связывает сильнее `&&`, а отрицание в свойстве
       генератор всегда ставит как `!(...)`. */
    return `${left.code} ${operator === "eq" ? "==" : "!="} ${right.code}`
  }
  const helper = ORDER_OPERATORS[operator]
  if (helper === undefined) throw new Error(`${where}: неизвестный оператор «${operator}»`)
  if (left.kind !== "number") {
    throw new Error(`${where}: сравнения порядка допустимы только для чисел`)
  }
  return `${helper}(${left.code}, ${right.code})`
}

function fieldOf(utility, name) {
  const field = utility.fields.get(name)
  if (field === undefined) {
    throw new Error(`утилита «${utility.fts}»: у объекта «${utility.input.fts}» нет поля «${name}»`)
  }
  return field
}

function kindOf(value) {
  if (typeof value === "number") return "number"
  if (typeof value === "boolean") return "flag"
  if (typeof value === "string") return "text"
  throw new Error(`значение ${JSON.stringify(value)} не выражается типом C`)
}

function literal(value, where) {
  if (typeof value === "number") return number(value, where)
  if (typeof value === "boolean") return value ? "true" : "false"
  if (typeof value === "string") return quote(value)
  throw new Error(`${where}: значение ${JSON.stringify(value)} не выражается литералом C`)
}

/** Число всегда печатается как double: `10000` в C — int, а результат — double. */
function number(value, where = "число") {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${where}: ${JSON.stringify(value)} не является конечным числом`)
  }
  const text = String(value)
  return /[.eE]/u.test(text) ? text : `${text}.0`
}

/* ------------------------------------------------------------- печать модулей */

function banner(project, what) {
  return [
    "/*",
    ` * Сгенерировано ftsc (бэкенд C) для проекта «${project}»: ${what}.`,
    " * Не редактировать руками: правьте модель .fts и перегенерируйте.",
    " */",
  ].join("\n")
}

function moduleBanner(project, module, what) {
  const from = module.source === null ? `модуля «${module.name}»` : `модуля «${module.name}» (${module.source})`
  return [
    "/*",
    ` * Сгенерировано ftsc (бэкенд C) для проекта «${project}» из ${from}: ${what}.`,
    " * Не редактировать руками: правьте модель .fts и перегенерируйте.",
    " */",
  ].join("\n")
}

function renderModuleHeader(project, module, scope) {
  const guard = `FTSC_${screaming(module.name)}_H`
  const lines = [
    moduleBanner(project, module, "типы, утилиты и морфизмы"),
    "",
    `#ifndef ${guard}`,
    `#define ${guard}`,
    "",
    '#include "ftsc_runtime.h"',
  ]

  const included = new Set()
  for (const imported of module.imports) {
    const source = scope.modules.find((candidate) => candidate.name === (imported.module ?? imported.category))
    if (source !== undefined && source !== module && !included.has(source.file)) {
      included.add(source.file)
      lines.push(`#include "${source.file}.h" /* использует «${source.name}» */`)
    }
  }
  lines.push("", `/* категория «${module.category}» */`)
  /* Список экспорта из модели — комментарием: в C нет модульной видимости, а
     терять решение автора модели о границе модуля нельзя. */
  if (module.exports !== null) {
    const exported = [
      ...(module.exports.structures ?? []).map((name) => `объект «${name}»`),
      ...(module.exports.utilities ?? []).map((name) => `утилита «${name}»`),
    ]
    if (exported.length > 0) lines.push(`/* модуль экспортирует: ${exported.join(", ")} */`)
  }

  for (const structure of module.structures) {
    lines.push("", `/* объект «${structure.fts}» */`, "typedef struct {")
    for (const field of structure.fields) {
      /* Опциональность — пара флаг + значение: см. решение 2 в шапке бэкенда. */
      if (field.type.optional) {
        lines.push(`  bool has_${field.c}; /* поле «${field.fts}» задано? (${field.declared}) */`)
      }
      lines.push(`  ${declaration(field.type.c, field.c)}; /* «${field.fts}» — ${describeDeclared(field)} */`)
    }
    lines.push(`} ${structure.c};`)
  }

  for (const morphism of module.morphisms) {
    lines.push(
      "",
      `/* морфизм «${morphism.fts}»: «${morphism.domain}» → «${morphism.codomain}» (закон ${morphism.law}) */`,
      `bool ${morphism.c}(bool ${stateArgument(morphism.domain)});`,
    )
  }

  for (const utility of module.utilities) {
    lines.push("", ...utilityComment(utility), `${signature(utility)};`)
  }

  lines.push("", `#endif /* ${guard} */`, "")
  return lines.join("\n")
}

/* Имя параметра-состояния: если транслитерация упёрлась в ключевое слово C,
   уходим под префикс — параметр не участвует в публичном контракте. */
function stateArgument(state) {
  const name = snake(state)
  return RESERVED.includes(name) ? `state_${name}` : name
}

function describeDeclared(field) {
  if (field.type.state === true) return `состояние «${field.type.base}»`
  return field.declared
}

/** `const char *name`, а не `const char * name`: звёздочка липнет к имени. */
function declaration(type, name) {
  return type.endsWith("*") ? `${type}${name}` : `${type} ${name}`
}

function utilityComment(utility) {
  return [
    `/* утилита «${utility.fts}»: «${utility.input.fts}» → ${utility.output.base}.`,
    "   Выполняются ВСЕ правила, чьи условия истинны, в порядке объявления. */",
  ]
}

function signature(utility) {
  return `ftsc_status ${utility.c}(const ${utility.input.c} *input, ${declaration(utility.output.c, "*result")}, const char **violation)`
}

function renderModuleSource(project, module) {
  const lines = [moduleBanner(project, module, "реализация утилит и морфизмов"), "", `#include "${module.file}.h"`]

  if (module.morphisms.length === 0 && module.utilities.length === 0) {
    lines.push("", "/* В модуле нет ни утилит, ни морфизмов — только типы из заголовка. */")
    if (module.structures.length === 0) {
      /* -pedantic требует хотя бы одну декларацию в единице трансляции, а
         заголовок пустого модуля её не даёт. */
      lines.push("typedef int ftsc_translation_unit_not_empty;")
    }
    lines.push("")
    return lines.join("\n")
  }

  for (const morphism of module.morphisms) {
    const argument = stateArgument(morphism.domain)
    lines.push(
      "",
      `/* морфизм «${morphism.fts}»: «${morphism.domain}» → «${morphism.codomain}» (закон ${morphism.law}) */`,
      `bool ${morphism.c}(bool ${argument}) {`,
      "  /* Морфизм объявлен моделью: из состояния-домена следует состояние-кодомен.",
      "     Доказательство живёт в модели, C лишь переносит истинность посылки. */",
      `  return ${argument};`,
      "}",
    )
  }

  for (const utility of module.utilities) {
    lines.push("", ...renderUtility(utility))
  }

  lines.push("")
  return lines.join("\n")
}

function renderUtility(utility) {
  const lines = [...utilityComment(utility), `${signature(utility)} {`]
  lines.push(`  ${declaration(utility.output.c, "value")};`)
  lines.push("  if (input == NULL || result == NULL) {")
  lines.push("    return FTSC_INVALID_ARGUMENT;")
  lines.push("  }")
  lines.push("  if (violation != NULL) {")
  lines.push("    *violation = NULL;")
  lines.push("  }")
  lines.push(`  value = ${literal(utility.initial, `начальное значение утилиты «${utility.fts}»`)}; /* «начальное значение» */`)

  const guarded = new Set()
  const guards = (touched, why) => {
    const emitted = []
    for (const field of touched) {
      if (guarded.has(field)) continue
      guarded.add(field)
      /* Ядро бросает FTS_UTILITY_INPUT в момент чтения отсутствующего поля;
         в C проверка ставится перед фрагментом, который это поле читает. */
      emitted.push(`  /* ${why} читает опциональное поле «${field.fts}» */`)
      emitted.push(`  if (!input->has_${field.c}) {`)
      emitted.push("    return FTSC_UTILITY_INPUT;")
      emitted.push("  }")
    }
    return emitted
  }

  for (const rule of utility.rules) {
    const touched = new Set()
    const conditions = (rule.when ?? []).map((condition) => {
      const field = fieldOf(utility, condition.field)
      if (field.type.optional) touched.add(field)
      const left = { code: `input->${field.c}`, kind: field.type.kind }
      const right = renderOperand(condition.value, utility, touched)
      return renderComparison(left, condition.operator, right, `правило «${rule.name}» утилиты «${utility.fts}»`)
    })
    const action = renderAction(rule, utility, touched)
    lines.push("", ...guards(touched, `правило «${rule.name}»`))
    /* else здесь не бывает никогда: срабатывают ВСЕ правила с истинным
       условием, в порядке объявления. Правило без условий безусловно. */
    if (conditions.length === 0) {
      lines.push(`  /* правило «${rule.name}»: без условий, выполняется всегда */`)
      lines.push(...action.map((line) => `  ${line}`))
    } else {
      lines.push(`  /* правило «${rule.name}» */`)
      lines.push(`  if (${conditions.join(" && ")}) {`)
      lines.push(...action.map((line) => `    ${line}`))
      lines.push("  }")
    }
  }

  for (const property of utility.properties) {
    const touched = new Set()
    const limit = renderOperand(property.value, utility, touched)
    const comparison = renderComparison(
      { code: "value", kind: utility.output.kind },
      property.operator,
      limit,
      `свойство «${property.name}» утилиты «${utility.fts}»`,
    )
    lines.push("", ...guards(touched, `свойство «${property.name}»`))
    lines.push(`  /* свойство «${property.name}»: постусловие, нарушение прекращает вычисление */`)
    lines.push(`  if (!(${comparison})) {`)
    lines.push("    if (violation != NULL) {")
    lines.push(`      *violation = ${quote(property.name)};`)
    lines.push("    }")
    lines.push("    return FTSC_UTILITY_PROPERTY;")
    lines.push("  }")
  }

  lines.push("", "  *result = value;", "  return FTSC_OK;", "}")
  return lines
}

function renderAction(rule, utility, touched) {
  const action = rule.action ?? {}
  const operand = renderOperand(action.value, utility, touched)
  if (action.kind === "add") {
    if (utility.output.kind !== "number" || operand.kind !== "number") {
      throw new Error(`правило «${rule.name}» утилиты «${utility.fts}» складывает нечисловые значения`)
    }
    return [`value += ${operand.code};`]
  }
  if (action.kind !== "set") {
    throw new Error(`правило «${rule.name}» утилиты «${utility.fts}»: неизвестное действие «${action.kind}»`)
  }
  if (operand.kind !== utility.output.kind) {
    throw new Error(`правило «${rule.name}» утилиты «${utility.fts}» присваивает результату значение другого типа`)
  }
  if (operand.code === "value") {
    /* `value = value;` — самоприсваивание, на которое ругаются компиляторы; в
       модели это правило, которое ничего не меняет. */
    return ["/* правило присваивает результату его же значение — ничего не меняем */"]
  }
  return [`value = ${operand.code};`]
}

/* ------------------------------------------------------------------ функторы */

function renderFunctorsHeader(project, scope) {
  const lines = [
    banner(project, "функторы между категориями"),
    "",
    "#ifndef FTSC_FUNCTORS_H",
    "#define FTSC_FUNCTORS_H",
    "",
    '#include "ftsc_runtime.h"',
  ]
  const included = new Set()
  for (const functor of scope.functors) {
    for (const object of functor.objects) {
      for (const module of [object.from.module, object.to.module]) {
        if (included.has(module.file)) continue
        included.add(module.file)
        lines.push(`#include "${module.file}.h"`)
      }
    }
  }

  for (const functor of scope.functors) {
    lines.push("", `/* функтор «${functor.fts}»: категория «${functor.from}» → категория «${functor.to}» */`)
    for (const morphism of functor.morphisms) {
      lines.push(`/*   морфизм «${morphism.from}» отображается в «${morphism.to}» */`)
    }
    for (const object of functor.objects) {
      lines.push(
        `/* образ объекта «${object.from.fts}» — «${object.to.fts}» */`,
        `ftsc_status ${object.c}(const ${object.from.c} *input, ${object.to.c} *image);`,
      )
    }
  }

  lines.push("", "#endif /* FTSC_FUNCTORS_H */", "")
  return lines.join("\n")
}

function renderFunctorsSource(project, scope) {
  const lines = [banner(project, "функторы между категориями"), "", '#include "ftsc_functors.h"']
  for (const functor of scope.functors) {
    for (const object of functor.objects) {
      lines.push(
        "",
        `/* функтор «${functor.fts}»: «${object.from.fts}» → «${object.to.fts}».`,
        "   Переносятся только отображённые поля; остальные поля образа остаются",
        "   такими, какими их передал вызывающий. */",
        `ftsc_status ${object.c}(const ${object.from.c} *input, ${object.to.c} *image) {`,
        "  if (input == NULL || image == NULL) {",
        "    return FTSC_INVALID_ARGUMENT;",
        "  }",
      )
      for (const pair of object.fields) {
        if (pair.source.type.optional) {
          lines.push(`  image->has_${pair.image.c} = input->has_${pair.source.c};`)
        } else if (pair.image.type.optional) {
          lines.push(`  image->has_${pair.image.c} = true;`)
        }
        lines.push(`  image->${pair.image.c} = input->${pair.source.c}; /* «${pair.source.fts}» → «${pair.image.fts}» */`)
      }
      lines.push("  return FTSC_OK;", "}")
    }
  }
  lines.push("")
  return lines.join("\n")
}

/* --------------------------------------------------------------------- тесты */

/**
 * Примеры модели — исполняемый тест. Ассертов из assert.h здесь нет намеренно:
 * при -DNDEBUG они исчезают, а тест обязан падать всегда и печатать «N/N
 * passed», поэтому проверка написана явно и возвращает код процесса.
 */
function renderTests(project, scope) {
  const checks = []
  for (const module of scope.modules) {
    for (const utility of module.utilities) {
      for (const example of utility.examples) {
        checks.push(renderExample(utility, example))
      }
    }
    const theorem = renderTheorem(module)
    if (theorem !== null) checks.push(theorem)
  }

  const lines = [banner(project, "тесты примеров из моделей"), "", "#include <stdio.h>", "#include <stdlib.h>", ""]
  for (const module of scope.modules) lines.push(`#include "${module.file}.h"`)
  if (scope.functors.length > 0) lines.push('#include "ftsc_functors.h"')
  lines.push("")

  if (checks.length === 0) {
    /* Ни одного примера и ни одной теоремы: файл обязан остаться валидным и
       честно сообщить, что проверять нечего. */
    lines.push(
      "int main(void) {",
      "  /* В моделях проекта нет ни примеров, ни теорем — проверять нечего. */",
      '  printf("0/0 passed\\n");',
      "  return EXIT_SUCCESS;",
      "}",
      "",
    )
    return lines.join("\n")
  }

  lines.push(
    "static int ftsc_total = 0;",
    "static int ftsc_passed = 0;",
    "",
    "static void ftsc_check(const char *name, bool ok) {",
    "  ftsc_total += 1;",
    "  if (ok) {",
    "    ftsc_passed += 1;",
    '    printf("ok   %s\\n", name);',
    "  } else {",
    '    printf("FAIL %s\\n", name);',
    "  }",
    "}",
    "",
    "int main(void) {",
  )
  for (const check of checks) lines.push(...check.map((line) => `  ${line}`), "")
  lines.push(
    '  printf("%d/%d passed\\n", ftsc_passed, ftsc_total);',
    "  return ftsc_passed == ftsc_total ? EXIT_SUCCESS : EXIT_FAILURE;",
    "}",
    "",
  )
  return lines.join("\n")
}

function renderExample(utility, example) {
  const input = example.input ?? {}
  for (const key of Object.keys(input)) {
    if (!utility.fields.has(key)) {
      throw new Error(
        `пример «${example.name}» утилиты «${utility.fts}»: объект «${utility.input.fts}» не содержит поля «${key}»`,
      )
    }
  }
  const initializers = []
  /* Поля перечисляются в порядке объявления объекта, а не в порядке ключей
     примера: вывод обязан быть детерминированным. */
  for (const field of utility.input.fields) {
    const has = Object.prototype.hasOwnProperty.call(input, field.fts)
    if (!has && !field.type.optional) {
      throw new Error(`пример «${example.name}» утилиты «${utility.fts}»: отсутствует обязательное поле «${field.fts}»`)
    }
    if (field.type.optional) initializers.push(`.has_${field.c} = ${has ? "true" : "false"}`)
    if (field.type.kind === "struct") {
      throw new Error(`пример «${example.name}» утилиты «${utility.fts}»: вложенные объекты в примерах пока не поддержаны`)
    }
    const value = has ? literal(input[field.fts], `поле «${field.fts}» примера «${example.name}»`) : empty(field.type)
    initializers.push(`.${field.c} = ${value}`)
  }
  const name = `${utility.fts}: ${example.name}`
  const expected = { code: literal(example.expected, `ожидание примера «${example.name}»`), kind: kindOf(example.expected) }
  const comparison = renderComparison({ code: "actual", kind: utility.output.kind }, "eq", expected, `пример «${example.name}»`)
  return [
    `/* пример «${example.name}» утилиты «${utility.fts}» */`,
    "{",
    `  const ${utility.input.c} input = { ${initializers.join(", ")} };`,
    `  ${declaration(utility.output.c, "actual")} = ${empty(utility.output)};`,
    "  const char *violation = NULL;",
    `  const ftsc_status status = ${utility.c}(&input, &actual, &violation);`,
    `  ftsc_check(${quote(name)}, status == FTSC_OK && ${comparison});`,
    "}",
  ]
}

/** Значение-заглушка: инициализируются все поля, чтобы -Wextra молчал. */
function empty(type) {
  if (type.kind === "number") return "0.0"
  if (type.kind === "text") return "NULL"
  return "false"
}

/**
 * Теорема ядра — единственная проверяемая часть без утилит: она применяет
 * морфизм к свидетелю из данных. В C это вызов функции-морфизма на значении
 * свидетеля; шире (композиции, нестандартные пропозиции) бэкенд не притворяется.
 */
function renderTheorem(module) {
  const proposition = module.proposition
  if (proposition === null || proposition.kind !== "apply") return null
  const argument = proposition.arg ?? {}
  if (argument.kind !== "witness" || typeof argument.value !== "boolean") return null
  const morphism = module.morphisms.find((candidate) => candidate.fts === proposition.functor)
  if (morphism === undefined) return null
  const detail = proposition.detail ?? argument.detail ?? proposition.functor
  return [
    `/* теорема «${detail}»: свидетель «${argument.structure}».«${argument.field}» = ${argument.value ? "да" : "нет"} */`,
    `ftsc_check(${quote(`теорема: ${detail}`)}, ${morphism.c}(${argument.value ? "true" : "false"}) == true);`,
  ]
}

/* ------------------------------------------------------------------ сборка */

function renderMakefile(project, scope) {
  const sources = [...scope.modules.map((module) => `${module.file}.c`)]
  if (scope.functors.length > 0) sources.push("ftsc_functors.c")
  sources.push("ftsc_tests.c")
  return [
    `# Сгенерировано ftsc (бэкенд C) для проекта «${project}».`,
    "# Не редактировать руками: правьте модель .fts и перегенерируйте.",
    "",
    "CC ?= cc",
    "# Флаги обязательны: сгенерированный код должен проходить их без единого предупреждения.",
    "CFLAGS ?= -std=c11 -Wall -Wextra -Werror -pedantic",
    "LDLIBS ?= -lm",
    "",
    `SOURCES = ${sources.join(" ")}`,
    "",
    ".PHONY: test clean",
    "",
    "ftsc_tests: $(SOURCES)",
    "\t$(CC) $(CFLAGS) -o $@ $(SOURCES) $(LDLIBS)",
    "",
    "test: ftsc_tests",
    "\t./ftsc_tests",
    "",
    "clean:",
    "\trm -f ftsc_tests",
    "",
  ].join("\n")
}
