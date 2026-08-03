/**
 * Инвариант нумерации: разметка считает так же, как считает ядро.
 *
 * Это единственное, что разметка обязана делать безошибочно. Указатель
 * `$.utilities[0].rules[1].when[0].field` не содержит ни имён, ни координат —
 * только номера. Если разметка пронумерует правила или примеры иначе, чем
 * `compile()`, диагностика молча подчеркнёт не ту строку, и заметить это
 * будет некому.
 *
 * Поэтому инвариант не подразумевается, а проверяется — и не на одном
 * образце, а на всех `.fts` репозитория: любой новый пример становится
 * тестом сам по себе.
 *
 * Запуск: node --test tools/locate/test/invariant.test.mjs
 */
import assert from "node:assert/strict"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join, relative, resolve } from "node:path"
import { test } from "node:test"

import { compile } from "../../../dist/src/index.js"
import { outline, resolvePath } from "../index.mjs"

const repo = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..")
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "output"])

function everyFtsFile(directory = repo, found = []) {
  for (const entry of readdirSync(directory)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(directory, entry)
    if (statSync(full).isDirectory()) everyFtsFile(full, found)
    else if (entry.endsWith(".fts")) found.push(full)
  }
  return found
}

const files = everyFtsFile()

test("в репозитории есть на чём проверять инвариант", () => {
  assert.ok(files.length >= 40, `найдено ${files.length} файлов .fts`)
})

test("нумерация объектов, утилит, правил и примеров совпадает с compile()", () => {
  let checked = 0
  const skipped = []

  for (const file of files) {
    const name = relative(repo, file)
    const source = readFileSync(file, "utf8")
    const view = outline(source)

    /* Файл-функтор ftsc ядру не документ, а скобочную поверхность разметка
       намеренно не индексирует: у неё есть настоящий span. */
    if (view.kind === "functor" || view.surface !== "natural") {
      skipped.push(`${name} (${view.kind === "functor" ? "функтор" : view.surface})`)
      continue
    }

    let document
    try {
      document = compile(view.compileSource)
    } catch {
      /* Заведомо сломанные образцы существуют нарочно (фикстуры CI). */
      skipped.push(`${name} (не компилируется)`)
      continue
    }
    checked += 1

    assert.equal(view.category.name, document.category, `категория в ${name}`)

    assert.deepEqual(
      view.objects.map((item) => item.name),
      document.structures.map((item) => item.name),
      `порядок объектов в ${name}`,
    )
    view.objects.forEach((object, index) => {
      assert.deepEqual(
        object.fields.map((field) => ({ name: field.name, type: field.type })),
        document.structures[index].fields.map((field) => ({ name: field.name, type: field.type })),
        `поля объекта ${index} в ${name}`,
      )
    })

    assert.deepEqual(
      view.morphisms.map((item) => item.name),
      document.functors.map((item) => item.name),
      `порядок морфизмов в ${name}`,
    )

    assert.deepEqual(
      view.utilities.map((item) => item.name),
      (document.utilities ?? []).map((item) => item.name),
      `порядок утилит в ${name}`,
    )

    view.utilities.forEach((utility, utilityIndex) => {
      const model = document.utilities[utilityIndex]
      const where = `${name} → утилита ${utilityIndex}`
      assert.equal(utility.input, model.input, `принимает, ${where}`)
      assert.equal(utility.output, model.output, `возвращает, ${where}`)

      assert.deepEqual(
        utility.rules.map((item) => item.name),
        model.rules.map((item) => item.name),
        `порядок правил, ${where}`,
      )
      utility.rules.forEach((rule, ruleIndex) => {
        const modelRule = model.rules[ruleIndex]
        assert.equal(rule.conditions.length, modelRule.when.length, `число условий правила ${ruleIndex}, ${where}`)
        rule.conditions.forEach((condition, conditionIndex) => {
          const modelCondition = modelRule.when[conditionIndex]
          assert.equal(condition.name, modelCondition.field, `поле условия ${conditionIndex}, ${where}`)
          assert.equal(condition.operator, modelCondition.operator, `сравнение условия ${conditionIndex}, ${where}`)
        })
      })

      assert.deepEqual(
        utility.properties.map((item) => item.name),
        model.properties.map((item) => item.name),
        `порядок свойств, ${where}`,
      )

      assert.deepEqual(
        utility.examples.map((item) => item.name),
        model.examples.map((item) => item.name),
        `порядок примеров, ${where}`,
      )
      utility.examples.forEach((example, exampleIndex) => {
        assert.equal(
          example.input.length,
          Object.keys(model.examples[exampleIndex].input).length,
          `число входов примера ${exampleIndex}, ${where}`,
        )
      })
    })
  }

  assert.ok(checked >= 20, `проверено ${checked} моделей, пропущено ${skipped.length}`)
})

test("каждый указатель, который может выдать проверка, разрешается точно", () => {
  /* Форма указателей взята из src/validate.ts: именно эти пути ядро строит
     по канонической модели.
     Проверять «разрешился хоть во что-то» здесь бесполезно: сползание к
     предку (требование само по себе верное) сделало бы такую проверку
     всегда истинной — указатель на несуществующее правило молча съехал бы
     на заголовок утилиты и тест бы этого не заметил. Поэтому проверяется
     точное попадание: узел зарегистрирован ровно под этим путём. */
  let resolved = 0

  for (const file of files) {
    const name = relative(repo, file)
    const view = outline(readFileSync(file, "utf8"))
    if (view.kind === "functor" || view.surface !== "natural") continue

    let document
    try {
      document = compile(view.compileSource)
    } catch {
      continue
    }

    const paths = ["$.category"]
    document.structures.forEach((structure, index) => {
      paths.push(`$.structures[${index}].name`)
      structure.fields.forEach((_, fieldIndex) => {
        paths.push(`$.structures[${index}].fields[${fieldIndex}].name`)
        paths.push(`$.structures[${index}].fields[${fieldIndex}].type`)
      })
    })
    document.functors.forEach((_, index) => {
      paths.push(`$.functors[${index}].name`)
      paths.push(`$.functors[${index}].domain`)
      paths.push(`$.functors[${index}].codomain`)
    })
    ;(document.utilities ?? []).forEach((utility, index) => {
      const base = `$.utilities[${index}]`
      paths.push(`${base}.name`, `${base}.input`, `${base}.output`, `${base}.initial`)
      utility.rules.forEach((rule, ruleIndex) => {
        paths.push(`${base}.rules[${ruleIndex}].name`, `${base}.rules[${ruleIndex}].action.value`)
        rule.when.forEach((_, conditionIndex) => {
          paths.push(`${base}.rules[${ruleIndex}].when[${conditionIndex}].field`)
          paths.push(`${base}.rules[${ruleIndex}].when[${conditionIndex}].value`)
        })
      })
      utility.properties.forEach((_, propertyIndex) => {
        paths.push(`${base}.properties[${propertyIndex}].name`, `${base}.properties[${propertyIndex}].value`)
      })
      utility.examples.forEach((example, exampleIndex) => {
        paths.push(`${base}.examples[${exampleIndex}].name`, `${base}.examples[${exampleIndex}].expected`)
        for (const field of Object.keys(example.input)) {
          paths.push(`${base}.examples[${exampleIndex}].input.${field}`)
        }
      })
    })

    for (const path of paths) {
      assert.ok(view.byPath.has(path), `${path} не размечен в ${name}`)
      const range = resolvePath(view, path)
      assert.equal(range, view.byPath.get(path).lineRange ?? view.byPath.get(path).range, `${path} в ${name}`)
      assert.ok(range.start.line < view.lines.length, `${path} указывает за пределы ${name}`)
      resolved += 1
    }
  }

  assert.ok(resolved > 500, `разрешено ${resolved} указателей`)
})

/** Снять «ёлочки» или кавычки, которыми имя записано на поверхности. */
function unquote(text) {
  return /^[«"'].*[»"']$/u.test(text) ? text.slice(1, -1) : text
}

test("указатель приводит к тому самому имени, которое стоит в модели ядра", () => {
  /* Самая строгая связь разметки с `compile()`: мало пронумеровать узлы
     подряд — по номеру должно находиться то же имя, что ядро положило в
     модель под этим номером. Сдвиг нумерации на единицу здесь виден сразу:
     указатель на правило 0 приведёт к имени правила 1. */
  let compared = 0

  for (const file of files) {
    const name = relative(repo, file)
    const source = readFileSync(file, "utf8")
    const view = outline(source)
    if (view.kind === "functor" || view.surface !== "natural") continue

    let document
    try {
      document = compile(view.compileSource)
    } catch {
      continue
    }

    const lines = source.split(/\r?\n/u)

    /* Проверяется вхождение, а не равенство: одни указатели подчёркивают
       ровно имя (`правило «Большая покупка»` → `«Большая покупка»`), другие —
       строку целиком (`принимает Покупка`, `сумма является деньгами`), и
       ширина подчёркивания — вопрос вкуса, а не правильности. Сдвиг
       нумерации ловится одинаково в обоих случаях: указатель на элемент j
       привёл бы к строке элемента j+1, где стоит другое имя. */
    const locates = (path, expected, what) => {
      const range = resolvePath(view, path)
      const text = unquote(lines[range.start.line].slice(range.start.character, range.end.character))
      assert.ok(
        text === expected || text.includes(expected),
        `${what} в ${name}: указатель ${path} привёл к «${text}», а в модели «${expected}»`,
      )
      compared += 1
    }

    document.structures.forEach((structure, index) => {
      locates(`$.structures[${index}].name`, structure.name, `имя объекта ${index}`)
      structure.fields.forEach((field, fieldIndex) => {
        locates(`$.structures[${index}].fields[${fieldIndex}].name`, field.name, `поле ${fieldIndex} объекта ${index}`)
      })
    })

    document.functors.forEach((functor, index) => {
      locates(`$.functors[${index}].name`, functor.name, `имя морфизма ${index}`)
    })

    ;(document.utilities ?? []).forEach((utility, index) => {
      const base = `$.utilities[${index}]`
      locates(`${base}.name`, utility.name, `имя утилиты ${index}`)
      locates(`${base}.input`, utility.input, `вход утилиты ${index}`)

      utility.rules.forEach((rule, ruleIndex) => {
        locates(`${base}.rules[${ruleIndex}].name`, rule.name, `имя правила ${ruleIndex}`)
        rule.when.forEach((condition, conditionIndex) => {
          locates(
            `${base}.rules[${ruleIndex}].when[${conditionIndex}].field`,
            condition.field,
            `поле условия ${conditionIndex} правила ${ruleIndex}`,
          )
        })
      })

      utility.properties.forEach((property, propertyIndex) => {
        locates(`${base}.properties[${propertyIndex}].name`, property.name, `имя свойства ${propertyIndex}`)
      })

      utility.examples.forEach((example, exampleIndex) => {
        locates(`${base}.examples[${exampleIndex}].name`, example.name, `имя примера ${exampleIndex}`)
        if (typeof example.expected === "number" || typeof example.expected === "string") {
          locates(
            `${base}.examples[${exampleIndex}].expected`,
            String(example.expected),
            `ожидание примера ${exampleIndex}`,
          )
        }
      })
    })
  }

  assert.ok(compared > 200, `сверено ${compared} имён`)
})
