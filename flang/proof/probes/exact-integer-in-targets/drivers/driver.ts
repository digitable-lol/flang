// SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
// SPDX-License-Identifier: BSD-2-Clause
//
// Проба цели «ts»: тот же рантайм, что у цели «js» — печатник TS кладёт его
// отдельным flang_runtime.js и ввозит имена (emit-js.flang, «Ввоз рантайма
// TS»), поэтому проба тоже ввозит $add из рантайма, а не объявляет его.
// Длинные целые у TS есть в самом языке (ADR-0036 §6, первая цена).

import { $add } from "./flang_runtime.js"

const BASE = 4194304n

const decimal = (digits: number[]): bigint =>
  digits.reduceRight((total: bigint, digit: number) => total * BASE + BigInt(digit), 0n)

const total = (label: string, left: number[], right: number[]): void => {
  const sum = $add(left, right) as number[]
  console.log(`${label}\t${sum.join(",")}\t${decimal(sum)}`)
}

total("beyond", [1, 0, 512], [1])
total("carry", [4194303], [1])
total("wide", [4194303, 4194303, 4194303], [1, 0, 0])
total("denormal", [4194305], [0])
total("forged", [1, 0, 511], [1])
console.log(`numbers\t${$add(2, 3)}`)
try {
  $add([1, 0, 512], 1)
} catch (refusal) {
  console.log(`refusal\t${(refusal as Error).message}`)
}
