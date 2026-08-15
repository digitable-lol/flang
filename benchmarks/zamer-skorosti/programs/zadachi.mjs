/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/**
 * Те же четыре задачи, что в zadachi.flang, на JavaScript (Node.js).
 *
 * Правило перевода — шаг в шаг, как и у zadachi.py:
 *   • где flang печатается в цикл (хвостовой самовызов) — здесь цикл;
 *   • где flang рекурсирует по-настоящему — здесь рекурсия;
 *   • никаких библиотечных сокращений: ни Array.prototype.sort, ни filter по
 *     индексу. Разрешены ровно те встроенные формы, которые есть и у flang:
 *     String.prototype.split (↔ «разделить … по …») и Number (↔ «к числу»).
 *
 * Запуск:  LC_ALL=C.UTF-8 node zadachi.mjs ЗАДАЧА РАЗМЕР
 * Печатает одно число — ту же контрольную сумму, что и остальные два языка.
 */
const A = 25173
const C = 13849
const M = 65536

function chisla(skolko, zerno) {
  const out = []
  let x = zerno
  for (let i = 0; i < skolko; i += 1) {
    x = (A * x + C) % M
    out.push(x)
  }
  return out
}

function otpechatok(elementy) {
  let acc = 0
  for (const e of elementy) acc = (acc * 31 + e) % 1000003
  return acc
}

/* ── задача 1: счёт на числах ─────────────────────────────────────────────── */

function shagovKollatca(n) {
  let nabrano = 0
  while (n > 1) {
    n = n % 2 === 0 ? n / 2 : 3 * n + 1
    nabrano += 1
  }
  return nabrano
}

function kollatc(predel) {
  let summa = 0
  for (let tekushchee = 1; tekushchee <= predel; tekushchee += 1) {
    summa += shagovKollatca(tekushchee)
  }
  return summa
}

/* ── задача 2: сортировка слиянием ────────────────────────────────────────── */

function cherezOdin(elementy, s) {
  const out = []
  for (let i = s; i < elementy.length; i += 2) out.push(elementy[i])
  return out
}

function sliyanie(pervyy, vtoroy) {
  const out = []
  let i = 0
  let j = 0
  while (i < pervyy.length && j < vtoroy.length) {
    if (pervyy[i] <= vtoroy[j]) {
      out.push(pervyy[i])
      i += 1
    } else {
      out.push(vtoroy[j])
      j += 1
    }
  }
  while (i < pervyy.length) {
    out.push(pervyy[i])
    i += 1
  }
  while (j < vtoroy.length) {
    out.push(vtoroy[j])
    j += 1
  }
  return out
}

function sortirovka(elementy) {
  if (elementy.length <= 1) return elementy
  const levaya = cherezOdin(elementy, 0)
  const pravaya = cherezOdin(elementy, 1)
  return sliyanie(sortirovka(levaya), sortirovka(pravaya))
}

/* ── задача 3: обход дерева ───────────────────────────────────────────────── */
/* Лист — null, узел — массив [ключ, слева, справа]. Значения не правятся:
   вставка переписывает путь и возвращает новое дерево, как у flang. */

function vstavit(derevo, novyy) {
  if (derevo === null) return [novyy, null, null]
  const [kl, l, p] = derevo
  if (novyy < kl) return [kl, vstavit(l, novyy), p]
  return [kl, l, vstavit(p, novyy)]
}

function sobratDerevo(skolko, zerno) {
  let derevo = null
  let x = zerno
  for (let i = 0; i < skolko; i += 1) {
    x = (A * x + C) % M
    derevo = vstavit(derevo, x)
  }
  return derevo
}

function summaDereva(derevo) {
  if (derevo === null) return 0
  return derevo[0] + summaDereva(derevo[1]) + summaDereva(derevo[2])
}

function glubinaDereva(derevo) {
  if (derevo === null) return 0
  const gl = glubinaDereva(derevo[1])
  const gp = glubinaDereva(derevo[2])
  return (gl > gp ? gl : gp) + 1
}

function obhodDereva(skolko) {
  const derevo = sobratDerevo(skolko, 12345)
  return summaDereva(derevo) + 1000000 * glubinaDereva(derevo)
}

/* ── задача 4: разбор строк ───────────────────────────────────────────────── */

function udvoitTekst(tekst, raz) {
  for (let i = 0; i < raz; i += 1) tekst = tekst + "," + tekst
  return tekst
}

function razborStrok(raz) {
  const tekst = udvoitTekst("17,42,8,99,3,71,25,60,14,88", raz)
  let acc = 0
  for (const kusok of tekst.split(",")) acc = (acc * 31 + Number(kusok)) % 1000003
  return acc
}

/* ── точки входа ──────────────────────────────────────────────────────────── */

const ZADACHI = {
  "коллатц": kollatc,
  "сортировка": (skolko) => otpechatok(sortirovka(chisla(skolko, 12345))),
  "дерево": obhodDereva,
  "строки": razborStrok,
}

const [, , zadacha, razmer] = process.argv
if (zadacha === undefined || ZADACHI[zadacha] === undefined) {
  process.stderr.write(`использование: node zadachi.mjs {${Object.keys(ZADACHI).join("|")}} РАЗМЕР\n`)
  process.exit(2)
}
process.stdout.write(`${ZADACHI[zadacha](Number(razmer))}\n`)
