/**
 * Бэкенд кодогенерации ftsc → Rust.
 *
 * Что печатается и почему именно так:
 *
 * 1. **Крейт без зависимостей.** Один крейт на проект: `Cargo.toml`, `src/lib.rs`
 *    и по файлу `src/<категория>.rs` на модуль IR. Только `std` — модель FTS
 *    описывает данные и чистые вычисления, ничего внешнего ей не нужно, а лишняя
 *    зависимость сделала бы сгенерированный код непроверяемым в офлайне.
 *
 * 2. **Свойство — это `Result`, а не `panic!`.** Нарушенное свойство в FTS —
 *    нормальный ответ модели («такая скидка недопустима»), а не баг программы.
 *    `panic!` в Rust означает «инвариант программы сломан, продолжать нельзя»;
 *    для доменного отказа это неверный жанр: его нельзя обработать вызывающим
 *    кодом, он разворачивает стек и в `panic = "abort"` убивает процесс. Поэтому
 *    каждая утилита возвращает `Result<T, FtsError>`, а вариант
 *    `FtsError::PropertyViolated` несёт имя свойства и имя утилиты и отдаёт код
 *    `FTS_UTILITY_PROPERTY` — тот же, что у ядра FTS.
 *    Утилиты без свойств тоже возвращают `Result`: единообразие подписи важнее
 *    экономии, иначе добавление свойства в модель ломало бы все места вызова.
 *
 * 3. **Опциональное поле — `Option<T>`.** `иногда является` → `Option<T>`.
 *    Ядро при обращении к отсутствующему полю прекращает вычисление ошибкой
 *    `FTS_UTILITY_INPUT`; в Rust это `ok_or(...)?` ровно в том месте, где поле
 *    читается, — короткое замыкание `&&` сохраняет ленивость условий ядра.
 *
 * 4. **Именованное состояние — newtype над `bool`.** У FTS состояние либо
 *    достигнуто, либо нет (свидетельство теоремы — `значение: да`), поэтому
 *    носитель ровно один бит. Взят newtype, а не голый `bool` и не enum:
 *    newtype не даёт перепутать «Готов к отгрузке» с обычным признаком или с
 *    другим состоянием (это разные типы), стоит ноль байт и позволяет
 *    морфизму иметь честную сигнатуру `fn(&A) -> Option<B>`.
 *
 * 5. **Деньги и Число — `f64`.** Ядро FTS считает в double, а примеры обязаны
 *    совпасть с ним бит в бит; decimal-тип потребовал бы внешнего крейта, что
 *    запрещено. Выражения печатаются в том же порядке операций, что и в ядре
 *    (`(процент / 100) * поле`), иначе округление разойдётся.
 *
 * 6. **`#![deny(warnings)]` в сгенерированный код не ставится.** Атрибут внутри
 *    файла означает «сборка приложения сломается, когда новый rustc добавит
 *    новый lint» — это не то, что можно навязывать чужому проекту. Вместо этого
 *    код печатается так, чтобы быть чистым под `-D warnings`, и тест бэкенда
 *    собирает его именно с этим ключом. Единственное послабление —
 *    `#![cfg_attr(test, allow(dead_code))]` в `lib.rs`: под `rustc --test` крейт
 *    компилируется как бинарник, где публичный API, не тронутый тестами,
 *    выглядит мёртвым кодом; в обычной сборке библиотеки этот allow не действует.
 *
 * Детерминированность: ни дат, ни счётчиков, ни обхода хеш-таблиц — порядок
 * всегда берётся из IR (массивы модулей, структур, полей, правил).
 */

import { createNamer, pascal, quote, snake } from "../naming.mjs"
import { escapeBidiBraced, escapeBidiInFiles } from "../bidi.mjs"

export const target = {
  id: "rust",
  name: "Rust",
  extension: ".rs",
  /* Проверять сгенерированное удобно двумя способами. `cargo test --offline`
     работает в каталоге --out как есть (Cargo.toml печатается рядом) и потому
     стоит в контракте. Тест самого бэкенда вместо cargo зовёт
     `rustc --edition 2021 --test src/lib.rs`: это на порядок быстрее, не создаёт
     target/ и не трогает реестр пакетов вовсе. */
  toolchain: { probe: ["rustc", "--version"], test: ["cargo", "test", "--offline"] },
}

/* Ключевые слова Rust (2015/2018/2021 + зарезервированные на будущее). Почти все
   можно записать сырым идентификатором `r#type`, и это лучше переименования:
   имя модели сохраняется дословно. */
const KEYWORDS = new Set([
  "as",
  "break",
  "const",
  "continue",
  "dyn",
  "else",
  "enum",
  "extern",
  "false",
  "fn",
  "for",
  "if",
  "impl",
  "in",
  "let",
  "loop",
  "match",
  "mod",
  "move",
  "mut",
  "pub",
  "ref",
  "return",
  "static",
  "struct",
  "trait",
  "true",
  "type",
  "unsafe",
  "use",
  "where",
  "while",
  "async",
  "await",
  "try",
  "abstract",
  "become",
  "box",
  "do",
  "final",
  "macro",
  "override",
  "priv",
  "typeof",
  "unsized",
  "virtual",
  "yield",
])

/* Эти сырым идентификатором не записываются — коллизия с ними обязана быть
   ошибкой сборки, а не молчаливым переименованием. */
const NON_RAW = ["crate", "self", "Self", "super", "_"]

/* Имена собственных типов бэкенда: доменный тип с таким именем сделал бы файл
   неоднозначным для читателя. */
const OCCUPIED = ["FtsError"]

const fail = (message) => {
  throw new Error(`бэкенд rust: ${message}`)
}

/** Оставляем только то, что Rust примет как идентификатор из ASCII. */
function ascii(identifier, original) {
  const cleaned = identifier.replace(/[^A-Za-z0-9_]/g, "")
  if (cleaned === "") fail(`имя «${original}» не даёт ни одного латинского символа — переименуйте его в модели`)
  return /^[0-9]/.test(cleaned) ? `_${cleaned}` : cleaned
}

const rustSnake = (value) => {
  const identifier = ascii(snake(value), value)
  return KEYWORDS.has(identifier) ? `r#${identifier}` : identifier
}

const rustPascal = (value) => ascii(pascal(value), value)

/* Тип поля модели → тип Rust. `Дата` — строка: ядро FTS проверяет дату как
   строку, а типизированная дата в Rust потребовала бы внешнего крейта. */
function baseType(name) {
  if (name === "Строка" || name === "Дата") return { kind: "string", rust: "String" }
  if (name === "Число" || name === "Деньги") return { kind: "number", rust: "f64" }
  if (name === "Признак") return { kind: "bool", rust: "bool" }
  return { kind: "state", rust: null, state: name }
}

/** Разбор типа поля IR: «Деньги», «Строка | undefined», имя состояния. */
function parseType(declared, typeName) {
  const optional = /\|\s*undefined/u.test(declared)
  const bare = declared.replace(/\s*\|\s*undefined/gu, "").trim()
  const base = baseType(bare)
  const rust = base.kind === "state" ? typeName(bare) : base.rust
  return { ...base, name: bare, rust, optional, declaration: optional ? `Option<${rust}>` : rust }
}

/** Литерал f64 в форме, которую Rust читает как число с плавающей точкой. */
function numberLiteral(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(`число ${JSON.stringify(value)} невыразимо литералом f64`)
  }
  const text = String(value)
  return /[.eE]/.test(text) ? text : `${text}.0`
}

/** Скалярный литерал модели под ожидаемый тип поля/результата. */
function scalarLiteral(value, type, what) {
  if (type.kind === "number") return numberLiteral(value)
  if (type.kind === "bool") {
    if (typeof value !== "boolean") fail(`${what}: ожидался признак, а не ${JSON.stringify(value)}`)
    return String(value)
  }
  if (type.kind === "string") {
    if (typeof value !== "string") fail(`${what}: ожидалась строка, а не ${JSON.stringify(value)}`)
    return `String::from(${quote(value)})`
  }
  /* Состояние во входных данных задаётся признаком «достигнуто/нет». */
  if (typeof value !== "boolean") fail(`${what}: состояние «${type.name}» задаётся да/нет, а не ${JSON.stringify(value)}`)
  return `${type.rust}(${value})`
}

const OPERATORS = { eq: "==", neq: "!=", gte: ">=", lte: "<=", gt: ">", lt: "<" }

/** Doc-комментарий с исходным именем FTS: без него сгенерированный код не читается рядом с моделью. */
const doc = (lines, indent = "") =>
  lines.flatMap((line) => String(line).split("\n")).map((line) => `${indent}///${line === "" ? "" : ` ${line}`}`)

/**
 * Контекст одной утилиты: как обратиться к полю входа и какой у него тип.
 * Отсутствующее опциональное поле прекращает вычисление ошибкой ровно там, где
 * поле читается, — как в ядре.
 */
function fieldAccess(context, fieldName) {
  const field = context.fields.get(fieldName)
  if (field === undefined) {
    fail(`утилита «${context.utility}»: структура «${context.structure}» не содержит поле «${fieldName}»`)
  }
  const path = `input.${field.identifier}`
  if (!field.type.optional) {
    return { expr: path, type: field.type, owned: field.type.kind !== "string" }
  }
  const miss = `FtsError::MissingField { utility: ${quote(context.utility)}, field: ${quote(fieldName)} }`
  const borrowed = field.type.kind === "string" ? `${path}.as_deref()` : field.type.kind === "state" ? `${path}.as_ref()` : path
  return {
    expr: `${borrowed}.ok_or(${miss})?`,
    type: field.type,
    owned: field.type.kind === "number" || field.type.kind === "bool",
  }
}

/** Операнд правила/свойства: значение, поле, процент от поля или текущий результат. */
function operand(value, context) {
  if (value.kind === "value") {
    return { expr: scalarLiteral(value.value, context.output, `утилита «${context.utility}»`), type: context.output, owned: true }
  }
  if (value.kind === "result") return { expr: "result", type: context.output, owned: true }
  if (value.kind === "field") return fieldAccess(context, value.field)
  if (value.kind === "percent") {
    const field = fieldAccess(context, value.field)
    if (field.type.kind !== "number") {
      fail(
        `утилита «${context.utility}»: процент можно взять только от числового поля, а «${value.field}» — «${field.type.name}»`,
      )
    }
    /* Порядок операций тот же, что в ядре: (процент / 100) * поле. */
    return { expr: `(${numberLiteral(value.percent)} / 100.0) * ${field.expr}`, type: field.type, owned: true }
  }
  return fail(`неизвестный вид операнда «${value.kind}»`)
}

/** Операнд в сравнении с уже известным левым типом (условие правила). */
function comparisonOperand(value, context, left) {
  if (value.kind === "value") {
    /* В сравнении строке хватает литерала: `String` умеет сравниваться с `&str`,
       а `String::from` здесь означал бы лишнюю аллокацию на каждый вызов. */
    if (left.type.kind === "string" && typeof value.value === "string") return quote(value.value)
    return scalarLiteral(value.value, left.type, `утилита «${context.utility}», сравнение с полем`)
  }
  const right = operand(value, context)
  if (right.type.kind === "string" && right.owned) return `${right.expr}.as_str()`
  return right.expr
}

function renderCondition(condition, context) {
  const left = fieldAccess(context, condition.field)
  const { operator } = condition
  if (OPERATORS[operator] === undefined) fail(`неизвестный оператор «${operator}»`)
  if (operator !== "eq" && operator !== "neq" && left.type.kind !== "number") {
    /* Ядро: сравнения порядка допустимы только для чисел (FTS_UTILITY_COMPARE_TYPE). */
    fail(`утилита «${context.utility}»: поле «${condition.field}» типа «${left.type.name}» нельзя сравнивать по порядку`)
  }
  /* Признак читается лучше без `== true`, а смысл тот же. */
  if (left.type.kind === "bool" && condition.value.kind === "value" && typeof condition.value.value === "boolean") {
    const positive = condition.value.value === (operator === "eq")
    return positive ? left.expr : `!(${left.expr})`
  }
  const leftExpr = left.type.kind === "string" && left.owned ? `${left.expr}.as_str()` : left.expr
  return `${leftExpr} ${OPERATORS[operator]} ${comparisonOperand(condition.value, context, left)}`
}

/** Утилита — чистая функция: initial и затем ВСЕ правила с истинным условием, по порядку. */
function renderUtility(utility, scope) {
  const structure = scope.structures.get(utility.input)
  if (structure === undefined) fail(`утилита «${utility.name}»: не найдена входная структура «${utility.input}»`)
  const output = parseType(utility.output, scope.typeName)
  if (output.kind === "state")
    fail(`утилита «${utility.name}» возвращает состояние «${utility.output}» — такой результат бэкенд не печатает`)
  const context = { utility: utility.name, structure: structure.name, fields: structure.fields, output }

  const body = []
  const rules = utility.rules ?? []
  const properties = utility.properties ?? []
  body.push(
    `    let ${rules.length > 0 ? "mut " : ""}result: ${output.rust} = ${scalarLiteral(utility.initial, output, `утилита «${utility.name}», начальное значение`)};`,
  )

  for (const rule of rules) {
    body.push("")
    body.push(`    /* правило «${rule.name}» */`)
    const conditions = (rule.when ?? []).map((condition) => renderCondition(condition, context))
    const value = operand(rule.action.value, context)
    if (rule.action.kind === "add" && output.kind !== "number") {
      fail(`правило «${rule.name}» утилиты «${utility.name}» складывает не числа`)
    }
    const owned = output.kind === "string" && !value.owned ? `${value.expr}.to_string()` : value.expr
    const statement = rule.action.kind === "add" ? `result += ${owned};` : `result = ${owned};`
    if (conditions.length === 0) {
      body.push(`    ${statement}`)
      continue
    }
    body.push(`    if ${conditions.join(" && ")} {`)
    body.push(`        ${statement}`)
    body.push("    }")
  }

  for (const property of properties) {
    body.push("")
    body.push(`    /* свойство «${property.name}» — постусловие, а не поправка результата */`)
    const limit = operand(property.value, context)
    const limitExpr = limit.type.kind === "string" && limit.owned ? `${limit.expr}.as_str()` : limit.expr
    const resultExpr = output.kind === "string" ? "result.as_str()" : "result"
    if (property.operator !== "eq" && property.operator !== "neq" && output.kind !== "number") {
      fail(`свойство «${property.name}» утилиты «${utility.name}»: сравнение по порядку допустимо только для чисел`)
    }
    body.push(`    if !(${resultExpr} ${OPERATORS[property.operator]} ${limitExpr}) {`)
    body.push(
      `        return Err(FtsError::PropertyViolated { utility: ${quote(utility.name)}, property: ${quote(property.name)} });`,
    )
    body.push("    }")
  }

  body.push("")
  body.push("    Ok(result)")

  const text = body.join("\n")
  /* Неиспользованный параметр — предупреждение rustc, поэтому имя с подчёркиванием. */
  const parameter = text.includes("input.") ? "input" : "_input"
  const lines = [
    ...doc([
      `утилита «${utility.name}»`,
      "",
      `Принимает «${utility.input}», возвращает «${utility.output}».`,
      "Выполняются все правила, чьи условия истинны, в порядке объявления, — это не цепочка if/else.",
      ...(properties.length > 0 ? ["Нарушенное свойство прекращает вычисление ошибкой и не чинит результат."] : []),
    ]),
    `pub fn ${scope.functionName(utility.name)}(${parameter}: &${structure.identifier}) -> Result<${output.rust}, FtsError> {`,
    text,
    "}",
  ]
  return { lines, output, structure, context }
}

/** Пример модели → `#[test]`. Тест обязан реально проходить, поэтому сравнение точное. */
function renderExample(utility, example, prepared, scope) {
  const { structure, output } = prepared
  for (const given of Object.keys(example.input ?? {})) {
    if (!structure.fields.has(given)) {
      fail(`пример «${example.name}»: структура «${structure.name}» не содержит поле «${given}»`)
    }
  }
  /* Поля перечисляются в порядке структуры, а не в порядке ключей примера:
     обход объекта JSON не должен влиять на байты вывода. */
  const assignments = []
  for (const [name, field] of structure.fields) {
    const has = Object.prototype.hasOwnProperty.call(example.input ?? {}, name)
    if (!has && !field.type.optional) fail(`пример «${example.name}»: не задано обязательное поле «${name}»`)
    const value = has ? scalarLiteral(example.input[name], field.type, `пример «${example.name}», поле «${name}»`) : "None"
    assignments.push(`            ${field.identifier}: ${has && field.type.optional ? `Some(${value})` : value},`)
  }
  const expected = scalarLiteral(example.expected, output, `пример «${example.name}», ожидаемый результат`)
  return [
    ...doc([`пример «${example.name}» утилиты «${utility.name}»`], "    "),
    "    #[test]",
    `    fn ${scope.testName(`${utility.name} ${example.name}`)}() {`,
    `        let input = ${structure.identifier} {`,
    ...assignments,
    "        };",
    `        let actual = ${scope.functionName(utility.name)}(&input)`,
    `            .expect(${quote(`пример «${example.name}»: нарушено свойство утилиты «${utility.name}»`)});`,
    `        assert_eq!(actual, ${expected});`,
    "    }",
  ]
}

/** Теорема ядра — текст: её доказал компилятор, в рантайме доказывать нечего. */
function describeProposition(proposition, lines = []) {
  if (proposition === null || typeof proposition !== "object") return lines
  if (proposition.kind === "witness") {
    const selector = proposition.selector === undefined ? "" : ` при ${JSON.stringify(proposition.selector)}`
    lines.push(
      `свидетельство: «${proposition.structure}».«${proposition.field}» = ${JSON.stringify(proposition.value ?? true)}${selector}`,
    )
    return lines
  }
  if (proposition.kind === "apply") {
    lines.push(`по морфизму «${proposition.functor}»`)
    return describeProposition(proposition.arg, lines)
  }
  if (proposition.kind === "compose") {
    lines.push(`по композиции морфизмов: ${(proposition.functors ?? []).map((name) => `«${name}»`).join(" ∘ ")}`)
    return describeProposition(proposition.arg, lines)
  }
  return lines
}

const header = (what, source) => [
  `// Сгенерировано ftsc, бэкенд rust — ${what}.`,
  ...(source === undefined ? [] : [`// Источник: ${source}`]),
  "// Не редактировать руками: правки исчезнут при следующей сборке, меняйте модель .fts.",
  "",
]

/** Файл одного модуля IR: типы категории, морфизмы, утилиты и тесты примеров. */
function renderModule(module, moduleName) {
  const document = module.document ?? {}
  const typeName = createNamer(rustPascal, [...NON_RAW, ...OCCUPIED])
  const functionName = createNamer(rustSnake, NON_RAW)
  const testName = createNamer(rustSnake, NON_RAW)

  /* Состояния объявляются в порядке первой встречи: сперва поля структур, потом
     морфизмы. Map хранит порядок вставки, значит вывод детерминирован. */
  const states = new Map()
  const useState = (name) => {
    if (!states.has(name)) states.set(name, typeName(name))
    return states.get(name)
  }
  const typeOf = (declared) => parseType(declared, useState)

  const structures = new Map()
  for (const structure of document.structures ?? []) {
    const identifier = typeName(structure.name)
    const fields = new Map()
    const fieldName = createNamer(rustSnake, NON_RAW)
    for (const field of structure.fields ?? []) {
      fields.set(field.name, { name: field.name, identifier: fieldName(field.name), type: typeOf(field.type) })
    }
    structures.set(structure.name, { name: structure.name, identifier, fields })
  }

  const morphisms = (document.functors ?? []).map((morphism) => ({
    name: morphism.name,
    identifier: functionName(morphism.name),
    domain: useState(morphism.domain),
    domainName: morphism.domain,
    codomain: useState(morphism.codomain),
    codomainName: morphism.codomain,
  }))

  /* Утилита видит структуры категории, объявляет состояния через тот же реестр
     и берёт имена функций из общего с морфизмами именователя. */
  const scope = { structures, typeName: useState, functionName }
  const utilities = (document.utilities ?? []).map((utility) => ({ utility, prepared: renderUtility(utility, scope) }))

  const exported = module.exports
  const lines = [
    ...header(`модуль «${module.name}»`, module.source),
    `//! Категория «${document.category ?? module.category ?? module.name}».`,
  ]
  if (exported && (exported.structures?.length || exported.utilities?.length)) {
    lines.push("//!")
    lines.push(
      `//! Экспортирует: ${[...(exported.structures ?? []), ...(exported.utilities ?? [])].map((name) => `«${name}»`).join(", ")}.`,
    )
  }
  if ((module.imports ?? []).length > 0) {
    lines.push("//!")
    lines.push(`//! Использует: ${module.imports.map((item) => `«${item.category}»`).join(", ")}.`)
  }
  const theorem = describeProposition(document.proposition ?? null)
  if (theorem.length > 0) {
    lines.push("//!")
    lines.push(
      `//! Теорема${document.proposition.detail ? ` «${document.proposition.detail}»` : ""} доказана компилятором FTS во время сборки:`,
    )
    for (const line of theorem) lines.push(`//! - ${line}`)
    lines.push("//! В рантайме доказывать нечего, поэтому теорема не порождает кода.")
  }
  lines.push("")

  if (utilities.length > 0) {
    lines.push("use crate::FtsError;")
    lines.push("")
  }

  for (const [name, identifier] of states) {
    lines.push(
      ...doc([
        `состояние «${name}»`,
        "",
        "Состояние либо достигнуто, либо нет; newtype не даёт перепутать его с обычным признаком.",
      ]),
    )
    lines.push("#[derive(Debug, Clone, Copy, PartialEq, Eq)]")
    lines.push(`pub struct ${identifier}(pub bool);`)
    lines.push("")
  }

  for (const structure of structures.values()) {
    lines.push(...doc([`объект «${structure.name}»`]))
    lines.push("#[derive(Debug, Clone, PartialEq)]")
    lines.push(`pub struct ${structure.identifier} {`)
    for (const field of structure.fields.values()) {
      lines.push(`    /// поле «${field.name}»${field.type.optional ? " (иногда является)" : ""}`)
      lines.push(`    pub ${field.identifier}: ${field.type.declaration},`)
    }
    lines.push("}")
    lines.push("")
  }

  for (const morphism of morphisms) {
    lines.push(
      ...doc([
        `морфизм «${morphism.name}»: «${morphism.domainName}» → «${morphism.codomainName}»`,
        "",
        "Морфизм — импликация: из свидетельства, что состояние домена достигнуто, следует состояние кодомена.",
        "Про недостигнутый домен морфизм не утверждает ничего, поэтому результат — `Option`, а не `bool`.",
      ]),
    )
    lines.push(`pub fn ${morphism.identifier}(domain: &${morphism.domain}) -> Option<${morphism.codomain}> {`)
    lines.push("    if domain.0 {")
    lines.push(`        Some(${morphism.codomain}(true))`)
    lines.push("    } else {")
    lines.push("        None")
    lines.push("    }")
    lines.push("}")
    lines.push("")
  }

  for (const { prepared } of utilities) {
    lines.push(...prepared.lines)
    lines.push("")
  }

  const tests = []
  for (const { utility, prepared } of utilities) {
    for (const example of utility.examples ?? []) {
      if (tests.length > 0) tests.push("")
      tests.push(...renderExample(utility, example, prepared, { functionName, testName }))
    }
  }
  if (tests.length > 0) {
    lines.push("#[cfg(test)]")
    lines.push("mod tests {")
    lines.push("    use super::*;")
    lines.push("")
    lines.push(...tests)
    lines.push("}")
    lines.push("")
  }

  return {
    path: `src/${moduleName}.rs`,
    content: `${lines.join("\n").replace(/\n+$/, "")}\n`,
    structures,
    hasUtilities: utilities.length > 0,
  }
}

/** Функтор IR — функция преобразования объекта домена в объект кодомена. */
function renderFunctors(program, modules) {
  const functionName = createNamer(rustSnake, NON_RAW)
  const lines = [
    ...header("функторы между категориями"),
    "//! Функтор переносит объект одной категории в объект другой. `ftsc` проверил",
    "//! форму отображения (тотальность на объектах и полях, согласованность типов);",
    "//! здесь печатается сама функция переноса.",
    "//!",
    "//! Типы пишутся полным путём `crate::категория::Тип`, а не через `use`: две",
    "//! категории вправе иметь одноимённые объекты и состояния, и импорт таких",
    "//! имён в один файл был бы конфликтом на ровном месте.",
    "",
  ]
  const bodies = []

  for (const functor of program.functors) {
    const from = modules.get(functor.from)
    const to = modules.get(functor.to)
    if (from === undefined) fail(`функтор «${functor.name}»: неизвестная категория-домен «${functor.from}»`)
    if (to === undefined) fail(`функтор «${functor.name}»: неизвестная категория-кодомен «${functor.to}»`)

    for (const object of functor.objects ?? []) {
      const source = from.rendered.structures.get(object.from)
      const image = to.rendered.structures.get(object.to)
      if (source === undefined) fail(`функтор «${functor.name}»: в категории «${functor.from}» нет объекта «${object.from}»`)
      if (image === undefined) fail(`функтор «${functor.name}»: в категории «${functor.to}» нет объекта «${object.to}»`)
      const sourcePath = `crate::${from.identifier}::${source.identifier}`
      const imagePath = `crate::${to.identifier}::${image.identifier}`
      /* Состояние кодомена — тип чужого модуля, поэтому конструктор тоже по полному пути. */
      const imageState = (name) => `crate::${to.identifier}::${name}`

      const assigned = new Map()
      for (const mapping of object.fields ?? []) {
        const sourceField = source.fields.get(mapping.from)
        const imageField = image.fields.get(mapping.to)
        if (sourceField === undefined) fail(`функтор «${functor.name}»: у объекта «${object.from}» нет поля «${mapping.from}»`)
        if (imageField === undefined) fail(`функтор «${functor.name}»: у объекта «${object.to}» нет поля «${mapping.to}»`)
        assigned.set(mapping.to, { sourceField, imageField, from: mapping.from })
      }
      for (const name of image.fields.keys()) {
        if (!assigned.has(name)) fail(`функтор «${functor.name}»: поле «${name}» объекта «${object.to}» не получает значения`)
      }

      const assignments = []
      for (const [name, { sourceField, imageField, from: fromName }] of assigned) {
        assignments.push(`        /* «${fromName}» → «${name}» */`)
        assignments.push(
          `        ${imageField.identifier}: ${convert(sourceField, imageField, functor, fromName, name, imageState)},`,
        )
      }

      bodies.push([
        ...doc([
          `функтор «${functor.name}»: «${object.from}» → «${object.to}»`,
          "",
          `Категории: «${functor.from}» → «${functor.to}».`,
          ...(functor.morphisms ?? []).map((morphism) => `Морфизм «${morphism.from}» отображается в «${morphism.to}».`),
        ]),
        `pub fn ${functionName(`${functor.name} ${object.from}`)}(source: &${sourcePath}) -> ${imagePath} {`,
        `    ${imagePath} {`,
        ...assignments,
        "    }",
        "}",
      ])
    }
  }

  return {
    path: "src/functors.rs",
    content: `${[...lines, ...bodies.flatMap((body, index) => (index === 0 ? body : ["", ...body]))].join("\n")}\n`,
  }
}

/** Перенос значения поля: типы уже проверены фронтендом, здесь только форма. */
function convert(sourceField, imageField, functor, fromName, toName, imageState) {
  const source = sourceField.type
  const image = imageField.type
  const mismatch = () =>
    fail(
      `функтор «${functor.name}»: поле «${fromName}» типа «${source.declaration}» не переносится в «${toName}» типа «${image.declaration}»`,
    )
  if (source.optional && !image.optional) mismatch()
  if (source.kind !== image.kind) mismatch()

  const path = `source.${sourceField.identifier}`
  if (source.kind === "state") {
    /* Состояния разных категорий — разные типы Rust; переносится свидетельство. */
    const constructor = imageState(image.rust)
    if (source.optional) return `${path}.map(|state| ${constructor}(state.0))`
    return image.optional ? `Some(${constructor}(${path}.0))` : `${constructor}(${path}.0)`
  }
  /* Копируется всё, что копируется: `clone()` нужен только строкам. */
  if (source.optional) return source.kind === "string" ? `${path}.clone()` : path
  const value = source.kind === "string" ? `${path}.clone()` : path
  return image.optional ? `Some(${value})` : value
}

/**
 * @param {object} program — IR
 * @param {{ projectName?: string }} [options]
 * @returns {Array<{ path: string, content: string }>} пути относительно --out
 */
export function emit(program, options = {}) {
  if (!program || !Array.isArray(program.modules)) fail("IR не содержит списка модулей")
  const projectName = options.projectName ?? program.project ?? "fts"
  const crate = ascii(snake(projectName), projectName)

  /* Порядок модулей — топологический из IR: он же порядок объявления mod. */
  const order = Array.isArray(program.order) ? program.order : []
  const position = new Map(order.map((name, index) => [name, index]))
  const ordered = program.modules
    .map((module, index) => ({ module, index }))
    .sort((left, right) => {
      const leftPlace = position.get(left.module.name) ?? position.get(left.module.category) ?? order.length + left.index
      const rightPlace = position.get(right.module.name) ?? position.get(right.module.category) ?? order.length + right.index
      return leftPlace - rightPlace || left.index - right.index
    })
    .map(({ module }) => module)

  const moduleName = createNamer(rustSnake, [...NON_RAW, "error", "functors", "tests"])
  const modules = new Map()
  const files = []

  for (const module of ordered) {
    const identifier = moduleName(module.name ?? module.category)
    const rendered = renderModule(module, identifier)
    modules.set(module.category ?? module.name, { identifier, module, rendered })
    if (module.name !== module.category) modules.set(module.name, { identifier, module, rendered })
    files.push({ path: rendered.path, content: rendered.content })
  }

  const functors = Array.isArray(program.functors) ? program.functors : []
  if (functors.length > 0) files.push(renderFunctors({ ...program, functors }, modules))

  const lib = [
    ...header(`проект «${projectName}»`),
    `//! Крейт собран из ${ordered.length === 1 ? "модуля" : `модулей (${ordered.length})`} FTS: категория — модуль Rust.`,
    "//! Зависимостей нет: только `std`.",
    "",
    "/* Под `rustc --test` крейт компилируется как бинарник, и публичный API, не",
    "   тронутый тестами примеров, выглядит мёртвым кодом. В обычной сборке",
    "   библиотеки этот allow не действует и предупреждения остаются на месте. */",
    "#![cfg_attr(test, allow(dead_code))]",
    "",
    "mod error;",
    "pub use error::FtsError;",
    "",
  ]
  for (const module of ordered) {
    const entry = modules.get(module.category ?? module.name)
    lib.push(...doc([`категория «${module.category ?? module.name}»${module.source ? ` — ${module.source}` : ""}`]))
    lib.push(`pub mod ${entry.identifier};`)
    lib.push("")
  }
  if (functors.length > 0) {
    lib.push(...doc(["функторы между категориями проекта"]))
    lib.push("pub mod functors;")
    lib.push("")
  }

  files.unshift({ path: "src/lib.rs", content: `${lib.join("\n").replace(/\n+$/, "")}\n` })
  files.unshift({ path: "src/error.rs", content: errorModule() })
  files.unshift({
    path: "Cargo.toml",
    content: [
      `# Сгенерировано ftsc, бэкенд rust — проект «${projectName}». Не редактировать руками.`,
      "[package]",
      `name = ${quote(crate)}`,
      'version = "0.0.0"',
      'edition = "2021"',
      "",
      "[lib]",
      'path = "src/lib.rs"',
      "",
      "# Модель FTS описывает данные и чистые вычисления: внешних зависимостей нет и не будет.",
      "[dependencies]",
      "",
    ].join("\n"),
  })
  /* Последний шаг печати — снять сырые двунаправленные управляющие со всего
     вывода (../bidi.mjs). Имя FTS (правила, свойства, примера, категории) уезжает
     и в комментарий (блочный над правилом, `///` над примером), и в строковый литерал
     (.expect у примера, имя свойства в FtsError). Для rustc это не придирка:
     `text_direction_codepoint_in_comment` и `…_in_literal` — deny-by-default, и до
     этого фильтра напечатанный крейт с таким именем не собирался вовсе. Форма
     Rust — `\u{X…}`, её же предлагает сам rustc в тексте отказа. */
  return escapeBidiInFiles(files, escapeBidiBraced)
}

/** Тип ошибки: доменный отказ модели, а не паника программы. */
function errorModule() {
  return `${[
    ...header("тип ошибки"),
    "use std::fmt;",
    "",
    ...doc([
      "Отказ модели FTS.",
      "",
      "Нарушение свойства и отсутствие обязательного поля — нормальные ответы модели,",
      "а не сломанные инварианты программы, поэтому здесь `Result`, а не `panic!`:",
      "вызывающий код обязан их обработать, а не умереть.",
    ]),
    "#[derive(Debug, Clone, PartialEq, Eq)]",
    "pub enum FtsError {",
    "    /// Нарушено свойство утилиты (код ядра FTS: `FTS_UTILITY_PROPERTY`).",
    "    PropertyViolated {",
    "        /// Имя утилиты в модели.",
    "        utility: &'static str,",
    "        /// Имя свойства в модели.",
    "        property: &'static str,",
    "    },",
    "    /// Во входных данных нет значения опционального поля (код ядра FTS: `FTS_UTILITY_INPUT`).",
    "    MissingField {",
    "        /// Имя утилиты в модели.",
    "        utility: &'static str,",
    "        /// Имя поля в модели.",
    "        field: &'static str,",
    "    },",
    "}",
    "",
    "impl FtsError {",
    "    /// Код диагностики ядра FTS — тот же, что печатает компилятор.",
    "    pub fn code(&self) -> &'static str {",
    "        match self {",
    '            FtsError::PropertyViolated { .. } => "FTS_UTILITY_PROPERTY",',
    '            FtsError::MissingField { .. } => "FTS_UTILITY_INPUT",',
    "        }",
    "    }",
    "}",
    "",
    "impl fmt::Display for FtsError {",
    "    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {",
    "        match self {",
    "            FtsError::PropertyViolated { utility, property } => write!(",
    "                formatter,",
    '                "нарушено свойство «{property}» утилиты «{utility}»"',
    "            ),",
    "            FtsError::MissingField { utility, field } => write!(",
    "                formatter,",
    '                "утилита «{utility}»: во входных данных отсутствует поле «{field}»"',
    "            ),",
    "        }",
    "    }",
    "}",
    "",
    "impl std::error::Error for FtsError {}",
  ].join("\n")}\n`
}
