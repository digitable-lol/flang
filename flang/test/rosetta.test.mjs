/**
 * Решения задач Rosetta Code — набор, который язык показывает наружу.
 *
 * Зачем отдельный тест. Эти файлы существуют не для тестирования компилятора,
 * а для чтения посторонним: Rosetta Code — витрина, где язык сравнивают не с
 * рекламой, а с тем же решением на сорока других языках. Витрина, в которой
 * что-то перестало запускаться, хуже пустой.
 *
 * Проверяется то же, что проверил бы читатель: файл разбирается, проходит
 * типы, проходит анализ завершаемости, и все примеры в нём сходятся. Плюс одно
 * сверх того — ЧИСЛО тотальных функций сверяется с записанным здесь. Не ради
 * числа: набор показывает границу языка, и если она сдвинется в любую сторону,
 * тексты в шапках файлов станут враньём. Сдвиг обязан заметить тест, а не
 * читатель.
 *
 * Именно так это уже случилось: `разложить … на символы` сделала обращение
 * строки доказуемо тотальным, и два файла, объяснявшие, почему оно тотальным
 * быть не может, оказались устаревшими.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { evaluate } from "../src/interpret.mjs"
import { parse } from "../src/parser.mjs"
import { checkTotality } from "../src/totality.mjs"
import { checkTypes } from "../src/types.mjs"
import { globSync } from "./glob.mjs"
import { связаноИмён, сверитьПоверхности } from "./surface-pair.mjs"

const корень = fileURLToPath(new URL("../examples/rosetta/", import.meta.url))

/**
 * Ожидаемая граница: сколько функций в файле доказуемо завершаются.
 *
 * Нетотальность здесь не недоделка, а свойство задачи. «Числа от и до»
 * рекурсирует по числу — счёт до N не убывает структурно; быстрая сортировка
 * рекурсирует по отфильтрованным подспискам, а подсписок не хвост. Обе границы
 * названы в шапках своих файлов, и обе обязаны остаться названными верно.
 */
const ОЖИДАЕТСЯ = new Map([
  ["ackermann-function.flang", { функций: 3, тотальных: 1 }],
  ["ackermann-function-english.flang", { функций: 3, тотальных: 1 }],
  ["factorial.flang", { функций: 5, тотальных: 3 }],
  ["factorial-english.flang", { функций: 5, тотальных: 3 }],
  ["fibonacci.flang", { функций: 6, тотальных: 4 }],
  ["fibonacci-english.flang", { функций: 6, тотальных: 4 }],
  ["fizzbuzz.flang", { функций: 5, тотальных: 3 }],
  ["fizzbuzz-english.flang", { функций: 5, тотальных: 3 }],
  ["hundred-doors.flang", { функций: 9, тотальных: 5 }],
  ["hundred-doors-english.flang", { функций: 9, тотальных: 5 }],
  ["levenshtein-distance.flang", { функций: 7, тотальных: 7 }],
  ["levenshtein-distance-english.flang", { функций: 7, тотальных: 7 }],
  ["merge-sort.flang", { функций: 8, тотальных: 8 }],
  ["merge-sort-english.flang", { функций: 8, тотальных: 8 }],
  ["palindrome.flang", { функций: 14, тотальных: 14 }],
  ["palindrome-english.flang", { функций: 14, тотальных: 14 }],
  ["quicksort.flang", { функций: 5, тотальных: 4 }],
  ["quicksort-english.flang", { функций: 5, тотальных: 4 }],
  ["reverse-string.flang", { функций: 4, тотальных: 4 }],
  ["reverse-string-english.flang", { функций: 4, тотальных: 4 }],
  ["roman-numerals.flang", { функций: 10, тотальных: 10 }],
  ["roman-numerals-english.flang", { функций: 10, тотальных: 10 }],
  ["run-length-encoding.flang", { функций: 5, тотальных: 2 }],
  ["run-length-encoding-english.flang", { функций: 5, тотальных: 2 }],
  ["primes-by-trial-division.flang", { функций: 5, тотальных: 1 }],
  ["primes-by-trial-division-english.flang", { функций: 5, тотальных: 1 }],
  ["towers-of-hanoi.flang", { функций: 5, тотальных: 3 }],
  ["towers-of-hanoi-english.flang", { функций: 5, тотальных: 3 }],
])

/**
 * Пары «русский листинг — английский»: на странице задачи стоят оба.
 *
 * Список задан руками, а не выведен из имени файла, ровно по той причине, по
 * какой задана таблица выше: пара, потерянная опечаткой в имени, молча
 * перестала бы проверяться, и на вики уехали бы два разных текста под видом
 * одного. Ниже стоит и обратная проверка — что каждый `-english.flang` в
 * каталоге попал в эту таблицу.
 */
const ПАРЫ = [
  ["ackermann-function.flang", "ackermann-function-english.flang"],
  ["factorial.flang", "factorial-english.flang"],
  ["fibonacci.flang", "fibonacci-english.flang"],
  ["fizzbuzz.flang", "fizzbuzz-english.flang"],
  ["hundred-doors.flang", "hundred-doors-english.flang"],
  ["levenshtein-distance.flang", "levenshtein-distance-english.flang"],
  ["merge-sort.flang", "merge-sort-english.flang"],
  ["palindrome.flang", "palindrome-english.flang"],
  ["primes-by-trial-division.flang", "primes-by-trial-division-english.flang"],
  ["quicksort.flang", "quicksort-english.flang"],
  ["reverse-string.flang", "reverse-string-english.flang"],
  ["roman-numerals.flang", "roman-numerals-english.flang"],
  ["run-length-encoding.flang", "run-length-encoding-english.flang"],
  ["towers-of-hanoi.flang", "towers-of-hanoi-english.flang"],
]

const файлы = globSync("*.flang", { cwd: корень }).sort()

test("набор Rosetta не растерялся и не пополнился молча", () => {
  /* Новый файл в каталоге обязан попасть в таблицу выше — иначе он не будет
     проверен на границу, и первое же расхождение уедет к читателю. */
  assert.deepEqual(файлы, [...ОЖИДАЕТСЯ.keys()].sort())
})

for (const имя of файлы) {
  test(`${имя}: разбирается, проходит проверки и держит границу`, () => {
    const исходник = readFileSync(new URL(имя, `file://${корень}`), "utf8")
    const программа = parse(исходник, имя)

    const типы = checkTypes(программа)
    assert.deepEqual(
      (типы.diagnostics ?? []).map((беда) => `${беда.code}: ${беда.message}`),
      [],
    )

    const завершаемость = checkTotality(программа)
    const тотальные = new Set(завершаемость.total ?? [])
    const ожидание = ОЖИДАЕТСЯ.get(имя)
    assert.equal(программа.functions.length, ожидание.функций, "изменилось число функций")
    assert.equal(
      тотальные.size,
      ожидание.тотальных,
      `граница сдвинулась: тотальных ${тотальные.size}, ожидалось ${ожидание.тотальных} — ` +
        `объяснение в шапке файла надо переписать`,
    )
  })

  test(`${имя}: все примеры сходятся`, () => {
    const исходник = readFileSync(new URL(имя, `file://${корень}`), "utf8")
    const программа = parse(исходник, имя)
    let сошлось = 0
    for (const функция of программа.functions) {
      for (const пример of функция.examples ?? []) {
        const получилось = evaluate(программа, функция.name, пример.args)
        assert.deepEqual(
          получилось,
          пример.expected,
          `${функция.name} / ${пример.name}`,
        )
        сошлось += 1
      }
    }
    /* Файл без единого примера в набор не годится: показывать решение, которое
       ничем не подтверждено, — ровно то, чем плохи витрины. */
    assert.ok(сошлось >= 5, `${имя}: примеров всего ${сошлось}`)
  })
}

/* ─────────────────────── две поверхности одной задачи ─────────────────────── */

test("у каждого английского листинга есть пара в таблице", () => {
  /* Файл `*-english.flang`, не попавший в ПАРЫ, не сверялся бы с русским вовсе:
     он прошёл бы проверки выше сам по себе и разошёлся бы с оригиналом молча. */
  const английские = файлы.filter((имя) => имя.endsWith("-english.flang")).sort()
  assert.deepEqual(английские, ПАРЫ.map(([, английский]) => английский).sort())
  for (const [русский, английский] of ПАРЫ) {
    assert.ok(ОЖИДАЕТСЯ.has(русский), `${русский} нет в таблице границ`)
    assert.ok(ОЖИДАЕТСЯ.has(английский), `${английский} нет в таблице границ`)
  }
})

for (const [русский, английский] of ПАРЫ) {
  test(`${русский} и ${английский} — одна программа, а не два похожих текста`, () => {
    const первый = parse(readFileSync(new URL(русский, `file://${корень}`), "utf8"), русский)
    const второй = parse(readFileSync(new URL(английский, `file://${корень}`), "utf8"), английский)

    /* Главное: деревья совпадают с точностью до взаимно однозначного
       переименования. Разбор поверхности не знает, и потому один и тот же
       алгоритм на двух языках обязан дать одно и то же дерево. */
    const словари = сверитьПоверхности(первый, второй)
    assert.ok(связаноИмён(словари) > 0, "сверка не связала ни одного имени — она пустая")

    /* И граница тотальности та же. Это следствие предыдущего, а не отдельный
       факт, — но именно оно попадёт на вики словом `total`, поэтому пусть
       ломается отдельным сообщением. */
    const границаПервого = new Set(checkTotality(первый).total ?? [])
    const границаВторого = new Set(checkTotality(второй).total ?? [])
    assert.equal(первый.functions.length, второй.functions.length, "разное число функций")
    assert.equal(
      границаПервого.size,
      границаВторого.size,
      `доказанность разошлась: ${границаПервого.size} против ${границаВторого.size}`,
    )
  })
}

test("сверка поверхностей ловит расхождение, а не только совпадение", () => {
  /* Проверка на проверку. Сверка, которая всё принимает, хуже отсутствующей:
     она даёт уверенность, ничего не проверив. Поэтому здесь берётся настоящая
     пара и в английский листинг вносится одна правка — та самая, какой
     разъезжаются файлы при доработке одного из них. */
  const русский = readFileSync(new URL("factorial.flang", `file://${корень}`), "utf8")
  const английский = readFileSync(new URL("factorial-english.flang", `file://${корень}`), "utf8")
  const испорченный = английский.replace("else n times («Factorial» of (n minus 1))", "else n times («Factorial» of (n minus 2))")
  assert.notEqual(испорченный, английский, "правка не применилась — тест ничего не проверяет")
  assert.throws(
    () => сверитьПоверхности(parse(русский, "factorial.flang"), parse(испорченный, "порча")),
    /1 ≠ 2/u,
  )
})
