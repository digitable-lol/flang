/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * fts-legacy.mjs — перевод модели FTS в программу flang. ТОЛЬКО для проверок.
 *
 * ── Почему это отдельный файл ───────────────────────────────────────────────
 * Половина `src/compat.mjs` переводила документ чужого ядра (`FtsDocument`) в
 * AST языка. Строить такой документ в этом дереве НЕЧЕМ: старый проект вынесен
 * из репозитория 16 августа 2026 (тег `fts-pered-udaleniem`), и единственный,
 * кто зовёт `fromFtsDocument`, — проверка `flang/test/self-factcheck.test.mjs`,
 * которая строит им свои входы.
 *
 * Пока эти двести с лишним строк лежали в `compat.mjs`, они приезжали в рабочий
 * путь `flang check` вместе со всем файлом — потому что из `compat.mjs` берут
 * три ЖИВЫХ имени (`errorCode`, `evaluateFlang`, `flangError`) факт-чекинг и
 * оболочка. Ни одно из них к переводу моделей отношения не имеет.
 *
 * Это тот же приём, каким из пути вышел `src/obligations.mjs`: не переключение
 * слоя, а РАЗДЕЛЕНИЕ. Эталона на flang здесь нет и не будет — переводить нечего:
 * язык, из которого переводили, в дереве больше не живёт, и новых моделей не
 * появится.
 *
 * ── Чего здесь нет ──────────────────────────────────────────────────────────
 * Обратного хода — из flang в FTS. Он не нужен и назван в `compat.mjs`:
 * разборщик языка сам раскладывает утилиту наследия до правил, свойств и
 * примеров (узел `ftsLegacy`), и вернуть чтение моделей надо будет ИЗ НЕГО, а не
 * из документа чужого ядра.
 *
 * ── Что перенесено знак в знак ──────────────────────────────────────────────
 * Всё, что ниже, вырезано из `compat.mjs`, а не переписано, вместе со своими
 * доводами: покрасневшая после такого проверка не отличима от проверки,
 * сломанной переписыванием.
 */
import { flangError } from "./builtins.mjs"


/** Имя единственного параметра функции, полученной из утилиты FTS. */
export const INPUT_PARAM = "вход"

/** Имя, под которым постусловие видит результат функции. */
export const RESULT_BINDING = "результат"
/* ────────────────────────────── перевод типов ───────────────────────────── */

/**
 * FTS описывает типы строками («Деньги», «Признак», «Дата», «Скоринг пройден»).
 * Скаляры переводятся один в один. Имена состояний («Скоринг пройден») — это
 * маркеры доказательств, а не значения: в языке значений им соответствия нет,
 * поэтому они сохраняются как `unknown` с исходным именем. Ядро ведёт себя так
 * же — `matchesRuntimeType` пропускает такие поля без проверки.
 */
export function flangType(ftsType) {
  const optional = /\|\s*undefined/u.test(ftsType)
  const base = ftsType.replace(/\s*\|\s*undefined/gu, "").trim()
  const scalar =
    base === "Строка" || base === "Дата" || base === "string"
      ? { kind: "string" }
      : base === "Число" || base === "Деньги" || base === "number"
        ? { kind: "number" }
        : base === "Признак" || base === "boolean"
          ? { kind: "boolean" }
          : { kind: "unknown", name: base }
  return optional ? { ...scalar, optional: true } : scalar
}

/* ─────────────────────────────── перевод AST ────────────────────────────── */

/**
 * @param {object} document FtsDocument (результат `compile` ядра)
 * @returns {object} программа flang по SPEC §5
 */
export function fromFtsDocument(document) {
  if (document === null || typeof document !== "object") {
    throw flangError("FLANG_COMPAT", "ожидался документ FTS")
  }
  const structures = document.structures ?? []
  const utilities = document.utilities ?? []
  const byName = new Map(structures.map((structure) => [structure.name, structure]))

  const types = structures.map((structure) => ({
    kind: "record",
    name: structure.name,
    fields: structure.fields.map((field) => ({ name: field.name, type: flangType(field.type) })),
    /* Исходные строки типов FTS сохраняются: генераторы кода и `ts_compat`
       опираются на них, и терять их при переводе нельзя. */
    meta: { fts: Object.fromEntries(structure.fields.map((field) => [field.name, field.type])) },
  }))

  return {
    flang: 1,
    module: document.category,
    types,
    functions: utilities.map((utility) => utilityToFunction(utility, byName.get(utility.input))),
    /**
     * Морфизмы и теорема остаются метаданными. Это не лень, а честность:
     * морфизм в FTS — импликация между состояниями («если Скоринг пройден,
     * то Риск-проверка разрешена»), а теорема — запрос к доказателю. Ни у
     * того, ни у другого нет ВЫЧИСЛИТЕЛЬНОГО аналога в flang: язык считает
     * значения, а не доказывает пропозиции, и функций-значений в нём нет
     * (SPEC §3). Выдумать им «функцию» значило бы придумать семантику,
     * которой в ядре нет, и сломать главное требование — совпадение
     * результатов. Поэтому они переносятся дословно: проверяющий их слой
     * (`prove`/`certify` ядра) читает ровно эти данные.
     */
    meta: {
      fts: {
        category: document.category,
        functors: document.functors ?? [],
        proposition: document.proposition ?? null,
        ts_compat: document.ts_compat ?? {},
      },
    },
  }
}

function utilityToFunction(utility, structure) {
  if (structure === undefined) {
    throw flangError("FTS_UTILITY_INPUT", `не найдена входная структура «${utility.input}»`)
  }

  /* Правила разворачиваются в цепочку связываний: результат0 — начальное
     значение, результатN+1 — состояние после N-го правила. Отдельные имена
     вместо затенения одного «результат» делают AST читаемым и проверяемым:
     видно, что каждое правило зависит от предыдущего состояния, а не заменяет
     собой предыдущее правило. */
  const resultVar = (index) => ({ kind: "var", name: `результат${index}` })
  const bindings = utility.rules.map((rule, index) => ({
    name: `результат${index + 1}`,
    value: {
      kind: "if",
      cond: conditionsToExpr(rule.when, resultVar(index)),
      then: actionToExpr(rule, resultVar(index)),
      else: resultVar(index),
    },
  }))

  let body = resultVar(bindings.length)
  for (let index = bindings.length - 1; index >= 0; index -= 1) {
    body = { kind: "let", name: bindings[index].name, value: bindings[index].value, in: body }
  }
  body = { kind: "let", name: "результат0", value: { kind: "literal", value: utility.initial }, in: body }

  return {
    name: utility.name,
    /* Утилита FTS не рекурсивна и не имеет циклов — конечная цепочка `if`.
       Завершаемость видна структурно, поэтому класс «тотальная» (SPEC §1),
       и именно поэтому любая модель FTS годится для факт-чекинга. */
    total: true,
    params: [{ name: INPUT_PARAM, type: { kind: "record", name: utility.input } }],
    returns: flangType(utility.output),
    body,
    /* Свойства — постусловия: проверяются после тела, в объявленном порядке,
       и нарушение первого же прерывает вычисление. Код и текст заданы явно,
       чтобы ошибка была неотличима от ошибки ядра. */
    postconditions: utility.properties.map((property) => ({
      name: property.name,
      bind: RESULT_BINDING,
      expr: {
        kind: "binary",
        op: property.operator,
        left: { kind: "var", name: RESULT_BINDING },
        right: operandToExpr(property.value, { kind: "var", name: RESULT_BINDING }),
      },
      code: "FTS_UTILITY_PROPERTY",
      message: `нарушено свойство «${property.name}» утилиты «${utility.name}»`,
    })),
    examples: utility.examples.map((example) => ({
      name: example.name,
      args: { [INPUT_PARAM]: exampleRecord(structure, example.input) },
      expected: example.expected,
    })),
    meta: { fts: { utility: utility.name, input: utility.input, output: utility.output } },
  }
}

/**
 * Вход утилиты в FTS — частичная карта: необязательное поле («иногда является
 * состоянием …») в примере просто отсутствует. Запись flang, наоборот,
 * тотальна: у неё есть все объявленные поля. Правильный перевод отсутствия —
 * `ничто` (SPEC §2), а не дырка в записи. Значение при этом не меняется:
 * ядро на такие поля всё равно не смотрит (`matchesRuntimeType` пропускает
 * состояния, а правила на них не ссылаются).
 */
function exampleRecord(structure, input) {
  const record = {}
  for (const field of structure.fields) {
    if (field.name in input) record[field.name] = input[field.name]
    else if (field.type.includes("undefined")) record[field.name] = null
    /* Отсутствие обязательного поля — ошибка входа; сохраняем её как есть,
       чтобы оба движка одинаково на неё пожаловались. */
  }
  for (const [name, value] of Object.entries(input)) {
    if (!(name in record)) record[name] = value
  }
  return record
}

function conditionsToExpr(conditions, resultExpr) {
  if (conditions.length === 0) return { kind: "literal", value: true }
  /* Ядро соединяет условия через `Array.every` — короткое замыкание. Вложенный
     `if` воспроизводит его буквально: второе условие даже не вычисляется, если
     первое ложно, и потому не может бросить ошибку сравнения типов. */
  let expr = conditionToExpr(conditions[conditions.length - 1], resultExpr)
  for (let index = conditions.length - 2; index >= 0; index -= 1) {
    expr = {
      kind: "if",
      cond: conditionToExpr(conditions[index], resultExpr),
      then: expr,
      else: { kind: "literal", value: false },
    }
  }
  return expr
}

function conditionToExpr(condition, resultExpr) {
  return {
    kind: "binary",
    op: condition.operator,
    /* Слева в условии FTS всегда поле входа, а не результат. */
    left: fieldExpr(condition.field),
    right: operandToExpr(condition.value, resultExpr),
  }
}

function actionToExpr(rule, previous) {
  const value = operandToExpr(rule.action.value, previous)
  if (rule.action.kind === "set") return value
  return { kind: "binary", op: "add", left: previous, right: value }
}

function operandToExpr(operand, resultExpr) {
  switch (operand.kind) {
    case "value":
      return { kind: "literal", value: operand.value }
    case "field":
      return fieldExpr(operand.field)
    case "result":
      return resultExpr
    case "percent":
      /* Ровно порядок ядра: (процент / 100) * поле. Умножение и деление в
         IEEE-754 не ассоциативны, переставлять множители нельзя. */
      return {
        kind: "binary",
        op: "percent",
        left: { kind: "literal", value: operand.percent },
        right: fieldExpr(operand.field),
      }
    default:
      throw flangError("FLANG_COMPAT", `неизвестный операнд «${String(operand.kind)}»`)
  }
}

function fieldExpr(field) {
  return { kind: "field", target: { kind: "var", name: INPUT_PARAM }, field }
}