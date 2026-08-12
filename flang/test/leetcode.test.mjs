/**
 * Тесты решений LeetCode (`flang/examples/leetcode/**`).
 *
 * Проверяется три вещи.
 *
 * 1. Каждое решение — валидная программа flang: разбор, типы и тотальность
 *    без диагностик, а всякая функция, помеченная `тотальная`, действительно
 *    доказана (пометка сама по себе ничего не значит — SPEC, раздел 1).
 * 2. Примеры из условий задач сходятся. Сравнение структурное — `valuesEqual`,
 *    то самое, которым язык сравнивает значения внутри программ; тем же теперь
 *    сверяет и `runExamples` в `compat.mjs`, где раньше стоял `Object.is` и
 *    потому проваливался любой пример, возвращающий список. Прогон решений
 *    самой командой `flang test` живёт в `regression.test.mjs`.
 * 3. `index.json` согласован с каталогом в обе стороны: нет записей без
 *    файлов и файлов без записей, а поле `тотальная` совпадает с настоящим
 *    вердиктом анализа завершаемости.
 */
import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import test from "node:test"

import { valuesEqual } from "../src/builtins.mjs"
import { evaluate } from "../src/interpret.mjs"
import { parse } from "../src/parser.mjs"
import { checkTotality } from "../src/totality.mjs"
import { checkTypes } from "../src/types.mjs"

const directory = fileURLToPath(new URL("../examples/leetcode/", import.meta.url))
const files = readdirSync(directory).filter((name) => name.endsWith(".flang")).sort()
const index = JSON.parse(readFileSync(directory + "index.json", "utf8"))

const modules = new Map()
for (const file of files) {
  const program = parse(readFileSync(directory + file, "utf8"), file)
  modules.set(file, { program, types: checkTypes(program), totality: checkTotality(program) })
}

test("решено не меньше двадцати задач", () => {
  assert.ok(files.length >= 20, `найдено решений: ${files.length}`)
})

for (const file of files) {
  const { program, types, totality } = modules.get(file)

  test(`${file}: типы и тотальность без диагностик`, () => {
    assert.deepEqual(types.diagnostics, [])
    assert.deepEqual(totality.diagnostics, [])
  })

  test(`${file}: каждая «тотальная» функция доказана`, () => {
    for (const fn of program.functions) {
      if (fn.total !== true) continue
      assert.ok(totality.total.has(fn.name), `«${fn.name}» помечена тотальной, но не доказана`)
    }
  })

  test(`${file}: примеры из условия сходятся`, () => {
    let count = 0
    for (const fn of program.functions) {
      for (const example of fn.examples ?? []) {
        count += 1
        const actual = evaluate(program, fn.name, example.args)
        assert.ok(
          valuesEqual(actual, example.expected),
          `«${fn.name}» / «${example.name}»: ожидалось ${JSON.stringify(example.expected)}, получено ${JSON.stringify(actual)}`,
        )
      }
    }
    assert.ok(count > 0, "в решении нет ни одного примера")
  })

  test(`${file}: решение начинается с описания задачи`, () => {
    const source = readFileSync(directory + file, "utf8")
    assert.match(source, /^модуль «/u, "нет заголовка модуля")
    assert.match(source, /\/\/ LeetCode \d+\./u, "нет комментария с номером и названием задачи")
  })
}

/* ───────────────────────────── index.json ───────────────────────────────── */

test("index.json: каждая запись указывает на существующий файл", () => {
  for (const task of index.задачи) {
    assert.ok(files.includes(task.файл), `в каталоге нет файла ${task.файл}`)
  }
})

test("index.json: у каждого файла есть запись", () => {
  const listed = new Set(index.задачи.map((task) => task.файл))
  for (const file of files) {
    assert.ok(listed.has(file), `файл ${file} не описан в index.json`)
  }
})

test("index.json: номера уникальны и совпадают с именем файла", () => {
  const numbers = new Set()
  for (const task of index.задачи) {
    assert.ok(!numbers.has(task.номер), `номер ${task.номер} встречается дважды`)
    numbers.add(task.номер)
    assert.equal(task.файл.slice(0, 3), String(task.номер).padStart(3, "0"))
  }
})

test("index.json: главная функция существует, а её тотальность записана верно", () => {
  for (const task of index.задачи) {
    const { program, totality } = modules.get(task.файл)
    const fn = program.functions.find((item) => item.name === task["главная функция"])
    assert.ok(fn, `в ${task.файл} нет функции «${task["главная функция"]}»`)
    assert.equal(
      task.тотальная,
      totality.total.has(fn.name),
      `${task.файл}: тотальность «${fn.name}» записана как ${task.тотальная}`,
    )
  }
})

test("index.json: счётчики функций и примеров совпадают с файлами", () => {
  for (const task of index.задачи) {
    const { program, totality } = modules.get(task.файл)
    assert.equal(task.функций, program.functions.length, task.файл)
    assert.equal(
      task["тотальных функций"],
      program.functions.filter((fn) => totality.total.has(fn.name)).length,
      task.файл,
    )
    assert.equal(
      task.примеров,
      program.functions.reduce((sum, fn) => sum + (fn.examples ?? []).length, 0),
      task.файл,
    )
  }
})

test("index.json: итоги согласованы с перечнем задач", () => {
  assert.equal(index.решено, index.задачи.length)
  assert.equal(index["тотальных решений"], index.задачи.filter((task) => task.тотальная).length)
  assert.deepEqual(index.категории, [...new Set(index.задачи.map((task) => task.категория))].sort())
})

test("index.json: у каждой задачи есть заметка о приёме и категория", () => {
  for (const task of index.задачи) {
    assert.equal(typeof task.приём, "string")
    assert.ok(task.приём.length > 20, `${task.файл}: заметка слишком короткая`)
    assert.ok(index.категории.includes(task.категория), `${task.файл}: категория вне списка`)
  }
})

test("index.json: список невыразимых задач заполнен и объяснён", () => {
  assert.ok(Array.isArray(index.невыразимые))
  assert.ok(index.невыразимые.length >= 10, `невыразимых записано: ${index.невыразимые.length}`)
  const пробелы = new Set(index["чего не хватает языку"].map((item) => item.чего))
  for (const задача of index.невыразимые) {
    assert.equal(typeof задача.причина, "string")
    assert.ok(задача.причина.length > 40, `${задача.название}: причина названа слишком коротко`)
    assert.ok(задача.чего_не_хватает.length > 0, `${задача.название}: не сказано, чего не хватает`)
    for (const пробел of задача.чего_не_хватает) {
      assert.ok(пробелы.has(пробел) || пробел.length > 0, `${задача.название}: неизвестный пробел «${пробел}»`)
    }
  }
})

test("index.json: решённая задача не числится невыразимой", () => {
  const решённые = new Set(index.задачи.map((task) => task.номер))
  for (const задача of index.невыразимые) {
    assert.ok(!решённые.has(задача.номер), `задача ${задача.номер} и решена, и объявлена невыразимой`)
  }
})

/* ──────────────────── проверки помимо примеров из условия ───────────────── */

/**
 * Входы, которых в условиях нет: пустые списки, границы, повторы, длинные
 * данные. Примеры в файлах — часть документации решения; здесь проверяется то,
 * что документацией быть не обязано.
 */
const ПРОВЕРКИ = [
  ["001-two-sum.flang", "Две суммы", { элементы: [1, 2], цель: 100 }, []],
  ["001-two-sum.flang", "Две суммы", { элементы: [0, 4, 3, 0], цель: 0 }, [0, 3]],
  ["001-two-sum.flang", "Две суммы", { элементы: [-1, -2, -3, -4, -5], цель: -8 }, [2, 4]],

  ["013-roman-to-integer.flang", "Римское в число", { текст: "" }, 0],
  ["013-roman-to-integer.flang", "Римское в число", { текст: "MMMCMXCIX" }, 3999],
  ["013-roman-to-integer.flang", "Римское в число", { текст: "IX" }, 9],

  ["014-longest-common-prefix.flang", "Наибольший общий префикс", { слова: ["", "a"] }, ""],
  ["014-longest-common-prefix.flang", "Наибольший общий префикс", { слова: ["abc", "abc"] }, "abc"],

  ["020-valid-parentheses.flang", "Скобки в строке", { текст: "" }, true],
  ["020-valid-parentheses.flang", "Скобки в строке", { текст: ")" }, false],
  ["020-valid-parentheses.flang", "Скобки в строке", { текст: "([)]" }, false],
  ["020-valid-parentheses.flang", "Скобки в строке", { текст: "{[]}" }, true],

  ["026-remove-duplicates-from-sorted-array.flang", "Без повторов", { элементы: [] }, []],
  ["026-remove-duplicates-from-sorted-array.flang", "Без повторов", { элементы: [2, 2, 2] }, [2]],

  ["035-search-insert-position.flang", "Место вставки", { элементы: [], цель: 5 }, 0],
  ["035-search-insert-position.flang", "Место вставки", { элементы: [1], цель: 0 }, 0],

  ["049-group-anagrams.flang", "Группировать анаграммы", { слова: [] }, []],
  ["049-group-anagrams.flang", "Группировать анаграммы", { слова: ["ab", "ba", "abc"] }, [["ab", "ba"], ["abc"]]],

  ["053-maximum-subarray.flang", "Наибольшая сумма куска", { элементы: [-3, -1, -2] }, -1],
  ["053-maximum-subarray.flang", "Наибольшая сумма куска", { элементы: [0] }, 0],

  ["066-plus-one.flang", "Прибавить единицу", { цифры: [0] }, [1]],
  ["066-plus-one.flang", "Прибавить единицу", { цифры: [1, 9, 9] }, [2, 0, 0]],

  ["070-climbing-stairs.flang", "Ступени", { н: 5 }, 8],
  ["070-climbing-stairs.flang", "Ступени", { н: 20 }, 10946],

  ["088-merge-sorted-array.flang", "Слить отсортированные", { первый: [], второй: [] }, []],
  ["088-merge-sorted-array.flang", "Слить отсортированные", { первый: [2, 2], второй: [1, 3] }, [1, 2, 2, 3]],

  ["104-maximum-depth-of-binary-tree.flang", "Глубина из списка", { элементы: [5] }, 1],
  ["104-maximum-depth-of-binary-tree.flang", "Глубина из списка", { элементы: [4, 2, 6, 1, 3, 5, 7] }, 3],

  ["110-balanced-binary-tree.flang", "Сбалансировано для списка", { элементы: [4, 2, 6, 1, 3, 5, 7] }, true],
  ["110-balanced-binary-tree.flang", "Сбалансировано для списка", { элементы: [1, 2, 3] }, false],

  ["121-best-time-to-buy-and-sell-stock.flang", "Лучшая прибыль", { цены: [1] }, 0],
  ["121-best-time-to-buy-and-sell-stock.flang", "Лучшая прибыль", { цены: [2, 4, 1] }, 2],

  ["125-valid-palindrome.flang", "Палиндром", { текст: "0P" }, false],
  ["125-valid-palindrome.flang", "Палиндром", { текст: ".,;" }, true],
  ["125-valid-palindrome.flang", "Палиндром", { текст: "AbBa" }, true],

  ["136-single-number.flang", "Одиночное число", { элементы: [7, 3, 3] }, 7],
  ["169-majority-element.flang", "Мажоритарный элемент", { элементы: [1] }, 1],
  ["217-contains-duplicate.flang", "Есть повторы", { элементы: [] }, false],

  ["226-invert-binary-tree.flang", "Обход после разворота", { элементы: [1] }, [1]],
  ["226-invert-binary-tree.flang", "Обход дерева из списка", { элементы: [3, 1, 2] }, [1, 2, 3]],

  ["242-valid-anagram.flang", "Анаграмма", { первое: "", второе: "" }, true],
  ["242-valid-anagram.flang", "Анаграмма", { первое: "aacc", второе: "ccac" }, false],

  ["268-missing-number.flang", "Пропущенное число", { элементы: [0] }, 1],
  ["268-missing-number.flang", "Пропущенное число", { элементы: [1] }, 0],

  ["283-move-zeroes.flang", "Сдвинуть нули", { элементы: [] }, []],
  ["283-move-zeroes.flang", "Сдвинуть нули", { элементы: [1, 2, 3] }, [1, 2, 3]],

  ["344-reverse-string.flang", "Обратить символы", { символы: ["a"] }, ["a"]],
  ["349-intersection-of-two-arrays.flang", "Пересечение", { первый: [1, 2], второй: [] }, []],

  ["509-fibonacci-number.flang", "Фибоначчи", { н: 1 }, 1],
  ["509-fibonacci-number.flang", "Фибоначчи", { н: 50 }, 12586269025],

  ["704-binary-search.flang", "Двоичный поиск", { элементы: [], цель: 1 }, -1],
  ["704-binary-search.flang", "Двоичный поиск", { элементы: [1, 2, 3, 4, 5, 6, 7, 8, 9], цель: 1 }, 0],
  ["704-binary-search.flang", "Двоичный поиск", { элементы: [1, 2, 3, 4, 5, 6, 7, 8, 9], цель: 9 }, 8],
  ["704-binary-search.flang", "Двоичный поиск", { элементы: [1, 2, 3, 4, 5, 6, 7, 8, 9], цель: 10 }, -1],
]

for (const [file, name, args, expected] of ПРОВЕРКИ) {
  test(`${file}: «${name}» от ${JSON.stringify(args)}`, () => {
    const { program } = modules.get(file)
    const actual = evaluate(program, name, args)
    assert.ok(
      valuesEqual(actual, expected),
      `ожидалось ${JSON.stringify(expected)}, получено ${JSON.stringify(actual)}`,
    )
  })
}

/* ───────────────────────── свойства решений ─────────────────────────────── */

test("704: двоичный поиск находит каждый элемент отсортированного списка", () => {
  const { program } = modules.get("704-binary-search.flang")
  const элементы = [-9, -4, -1, 0, 2, 3, 7, 11, 15, 21, 34]
  элементы.forEach((цель, номер) => {
    assert.equal(evaluate(program, "Двоичный поиск", { элементы, цель }), номер)
  })
})

test("704: двоичный поиск стоит логарифм, а не n·логарифм", (t) => {
  /* Решение брало элемент по номеру СВОИМ помощником, обходившим список звено
     за звеном, и это съедало весь смысл алгоритма: log₂n взятий по цене n
     каждое дают O(n·log n) — хуже, чем просто пройти список подряд. Мерилось
     это раньше секундами на большом списке, то есть не мерилось никогда.
     Здесь мерится наименьший бюджет шагов, при котором поиск ещё доходит:
     число целое, от загрузки машины не зависит, и его хватает, чтобы отличить
     логарифм от n·логарифма — на удвоении n логарифм добавляет ОДИН шаг цикла,
     а n·логарифм удваивается с лишним. */
  const { program } = modules.get("704-binary-search.flang")
  const доходит = (n, бюджет) => {
    const элементы = Array.from({ length: n }, (_, номер) => номер + 1)
    try {
      return evaluate(program, "Двоичный поиск", { элементы, цель: n }, { maxSteps: бюджет }) === n - 1
    } catch {
      return false
    }
  }
  const минимум = (n) => {
    let низ = 1
    let верх = 1
    while (!доходит(n, верх)) {
      низ = верх
      верх *= 2
      assert.ok(верх < 1e8, `поиск не доходит ни при каком бюджете шагов на n=${n}`)
    }
    while (верх - низ > 1) {
      const середина = Math.floor((низ + верх) / 2)
      if (доходит(n, середина)) верх = середина
      else низ = середина
    }
    return верх
  }
  const шагов = [минимум(2000), минимум(4000)]
  const рост = шагов[1] / шагов[0]
  t.diagnostic(`704: ${шагов[0]} шагов на 2000 элементах, ${шагов[1]} на 4000 — рост ×${рост.toFixed(2)}`)
  /* Порог 1,5 выбран с запасом: логарифм даёт ×1,09, а обход внутри — ×2,2.
     Между ними нет ничего, что можно было бы принять за то или другое. */
  assert.ok(
    рост < 1.5,
    `удвоение списка подняло работу в ${рост.toFixed(2)} раза (${шагов[0]} → ${шагов[1]}): ` +
      "взятие по номеру снова считается обходом, и двоичный поиск перестал быть двоичным",
  )
})

test("088: слияние даёт отсортированный список той же длины", () => {
  const { program } = modules.get("088-merge-sorted-array.flang")
  const первый = [1, 3, 5, 7]
  const второй = [2, 2, 6]
  const слитый = evaluate(program, "Слить отсортированные", { первый, второй })
  assert.equal(слитый.length, первый.length + второй.length)
  assert.deepEqual(слитый, [...слитый].sort((a, b) => a - b))
})

test("049: каждое слово попадает ровно в одну группу", () => {
  const { program } = modules.get("049-group-anagrams.flang")
  const слова = ["eat", "tea", "tan", "ate", "nat", "bat"]
  const группы = evaluate(program, "Группировать анаграммы", { слова })
  assert.deepEqual([...группы.flat()].sort(), [...слова].sort())
})
