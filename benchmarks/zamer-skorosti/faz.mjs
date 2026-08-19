#!/usr/bin/env node
/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Разложение времени компиляции flang по шагам.
 *
 * Зачем отдельный скрипт, а не `time flang check`: «flang check» — это один
 * итог, а вопрос был про слагаемые. Здесь каждый шаг зовётся тем же кодом, что
 * и в `flang/bin/flang.mjs`, но с отметкой времени до и после:
 *
 *   лексер      tokenize        разбор исходника на токены
 *   разбор      parse           токены → AST (включает лексер, вычитается)
 *   типы        checkTypes
 *   тотальность checkTotality
 *   законы      monoid/monad/iso/sets — проверка на сетке значений
 *   обязательства obligations   какие цели надо доказать
 *   доказательства checkProofs  ядро: проверка предъявленных доказательств
 *   печать      emit --target c генератор кода C
 *
 * Сборка полученного C меряется снаружи (make), потому что это чужой процесс.
 *
 * Запуск:  node benchmarks/zamer-skorosti/faz.mjs ФАЙЛ.flang [--повторов N]
 * Вывод:   JSON — по каждому шагу все замеры в миллисекундах.
 */
import { readFileSync } from "node:fs"
import { performance } from "node:perf_hooks"

const [, , file, ...rest] = process.argv
if (file === undefined) {
  process.stderr.write("нужен файл: node faz.mjs ФАЙЛ.flang [--повторов N]\n")
  process.exit(2)
}
let повторов = 7
for (let i = 0; i < rest.length; i += 1) {
  if (rest[i] === "--повторов" || rest[i] === "--repeats") повторов = Number(rest[i + 1])
}

const корень = new URL("../../flang/", import.meta.url)
const { tokenize } = await import(new URL("src/lexer.mjs", корень).href)
const { parse } = await import(new URL("src/parser.mjs", корень).href)
const { checkTypes } = await import(new URL("src/types.mjs", корень).href)
const { checkTotality, markMeasureGuards } = await import(new URL("src/totality.mjs", корень).href)
const { checkMonadLaws } = await import(new URL("src/monad.mjs", корень).href)
const { checkSetLaws } = await import(new URL("src/sets.mjs", корень).href)
const { obligations } = await import(new URL("src/obligations.mjs", корень).href)
const { checkProofs } = await import(new URL("src/proofterm.mjs", корень).href)
const { linkProgram, importsOf } = await import(new URL("src/link.mjs", корень).href)
const { emitC } = await import(new URL("src/emit/c.mjs", корень).href)

const источник = readFileSync(file, "utf8")

/** Один замер: функция зовётся, время берётся с обеих сторон. */
function мера(шаг) {
  const начало = performance.now()
  const итог = шаг()
  return { мс: performance.now() - начало, итог }
}

let связываний = 0
async function собратьПрограмму() {
  let программа = parse(источник, file)
  связываний = importsOf(программа).length
  if (связываний > 0) {
    программа = await linkProgram(file, источник, parse)
  }
  return markMeasureGuards(программа)
}

/* Постоянная часть печати: сколько стоит НАПЕЧАТАТЬ ПУСТУЮ программу. Рантайм
   (девять с половиной тысяч строк C) читается с диска и проверяется на сырые
   двунаправленные управляющие при каждом вызове, и эта работа от размера
   программы не зависит вовсе. Без отдельной строки она растворилась бы в
   «печати» и выглядела бы её ростом. */
const ПУСТАЯ = { flang: 1, module: "Пустая", types: [], functions: [] }

const шаги = {}
const записать = (имя, мс) => {
  ;(шаги[имя] ??= []).push(Number(мс.toFixed(4)))
}

/* Прогрев: первый прогон платит за разбор самих модулей компилятора движком
   Node (JIT ещё не видел этого кода). Он не выбрасывается молча — он идёт
   отдельной строкой «холодный», потому что для пользователя первый запуск это
   и есть настоящее время. */
let холодный = null
let программа = null
for (let повтор = 0; повтор < повторов + 1; повтор += 1) {
  const т0 = performance.now()

  const лексер = мера(() => tokenize(источник))
  const разбор = мера(() => parse(источник, file))
  /* Связывание меряется как разница: собрать программу целиком минус тот же
     разбор, который в него входит. У файла без импортов остаётся отметка меры,
     то есть почти ноль; отрицательный остаток означал бы, что второй разбор
     оказался быстрее первого (так и бывает — JIT прогрелся), и в этом случае
     честно поставить ноль, а не отрицательное время. */
  const связывание = await (async () => {
    const начало = performance.now()
    программа = await собратьПрограмму()
    return { мс: Math.max(0, performance.now() - начало - разбор.мс) }
  })()

  const типы = мера(() => checkTypes(программа))
  const тотальность = мера(() => checkTotality(программа))
  const законы = мера(() => {
    checkMonadLaws(программа)
    checkSetLaws(программа)
  })
  const обяз = мера(() => obligations(программа, { types: типы.итог, totality: тотальность.итог }))
  const доказ = мера(() => checkProofs(программа, обяз.итог.obligations))
  const печать = мера(() => emitC(программа, {}))
  const пустаяПечать = мера(() => emitC(ПУСТАЯ, {}))

  const всего = performance.now() - т0
  if (повтор === 0) {
    холодный = {
      лексер: Number(лексер.мс.toFixed(4)),
      "разбор без лексера": Number((разбор.мс - лексер.мс).toFixed(4)),
      связывание: Number(связывание.мс.toFixed(4)),
      типы: Number(типы.мс.toFixed(4)),
      тотальность: Number(тотальность.мс.toFixed(4)),
      законы: Number(законы.мс.toFixed(4)),
      обязательства: Number(обяз.мс.toFixed(4)),
      доказательства: Number(доказ.мс.toFixed(4)),
      "печать в C": Number(печать.мс.toFixed(4)),
      "печать: постоянная часть": Number(пустаяПечать.мс.toFixed(4)),
      всего: Number(всего.toFixed(4)),
    }
    continue
  }
  записать("лексер", лексер.мс)
  записать("разбор без лексера", разбор.мс - лексер.мс)
  записать("связывание", связывание.мс)
  записать("типы", типы.мс)
  записать("тотальность", тотальность.мс)
  записать("законы", законы.мс)
  записать("обязательства", обяз.мс)
  записать("доказательства", доказ.мс)
  записать("печать в C", печать.мс)
  записать("печать: постоянная часть", пустаяПечать.мс)
  записать("всего", всего)
}

const функций = (программа.functions ?? []).length
const тотальных = (программа.functions ?? []).filter((f) => f.total === true).length
const строк = источник.split("\n").length

function свод(значения) {
  const s = [...значения].sort((a, b) => a - b)
  const медиана = s.length % 2 === 1 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
  return { медиана: Number(медиана.toFixed(3)), минимум: s[0], максимум: s[s.length - 1] }
}

const горячие = {}
for (const [имя, значения] of Object.entries(шаги)) горячие[имя] = свод(значения)

process.stdout.write(
  `${JSON.stringify(
    {
      файл: file,
      строк,
      функций,
      тотальных,
      обычных: функций - тотальных,
      импортов: связываний,
      холодный,
      горячие,
    },
    null,
    2,
  )}\n`,
)
