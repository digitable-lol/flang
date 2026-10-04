// SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
// SPDX-License-Identifier: BSD-2-Clause
//
// Проба цели «js»: точное целое складывается разрядами основания 2²², и сумма
// за 2⁵³ печатается десятичной записью. Длинные целые у JS есть в самом языке
// (ADR-0036 §6, первая цена), поэтому десятичная запись — один BigInt, а не
// своя арифметика, как в целях «c», «cpp» и «rust». В РАНТАЙМЕ BigInt не нужен
// и не заведён: значение держится разрядами, точность приходит от длины списка.

const runtime = await import(process.argv[2])
const { $add } = runtime

const BASE = 4194304n

const decimal = (digits) => digits.reduceRight((total, digit) => total * BASE + BigInt(digit), 0n)

const total = (label, left, right) => {
  const sum = $add(left, right)
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
  console.log(`refusal\t${refusal.message}`)
}
