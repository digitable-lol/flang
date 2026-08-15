# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
"""Те же четыре задачи, что в zadachi.flang, на Python 3.

Правило перевода — шаг в шаг:
  • где flang печатается в цикл (хвостовой самовызов) — здесь цикл;
  • где flang рекурсирует по-настоящему — здесь рекурсия;
  • никаких библиотечных сокращений: ни sorted(), ни срезов вида lst[0::2].
    Разрешены ровно те встроенные формы, которые есть и у flang: разделение
    строки (str.split ↔ «разделить … по …») и перевод строки в число
    (int ↔ «к числу»).

Запуск:  python3 zadachi.py ЗАДАЧА РАЗМЕР
         python3 zadachi.py коллатц 20000
Печатает одно число — ту же контрольную сумму, что и остальные два языка.
"""
import sys

A = 25173
C = 13849
M = 65536


def chisla(skolko, zerno):
    """«Числа»: хвостовой самовызов — значит цикл."""
    out = []
    x = zerno
    for _ in range(skolko):
        x = (A * x + C) % M
        out.append(x)
    return out


def otpechatok(elementy):
    """«Отпечаток»: свёртка."""
    acc = 0
    for e in elementy:
        acc = (acc * 31 + e) % 1000003
    return acc


# ── задача 1: счёт на числах ────────────────────────────────────────────────


def shagov_kollatca(n):
    """«Шагов Коллатца»: хвостовой самовызов — цикл."""
    nabrano = 0
    while n > 1:
        n = n // 2 if n % 2 == 0 else 3 * n + 1
        nabrano += 1
    return nabrano


def kollatc(predel):
    """«Сумма Коллатца»: тоже хвостовой, но вызов внутрь — настоящий."""
    summa = 0
    tekushchee = 1
    while tekushchee <= predel:
        summa += shagov_kollatca(tekushchee)
        tekushchee += 1
    return summa


# ── задача 2: сортировка слиянием ───────────────────────────────────────────


def cherez_odin(elementy, s):
    """«Через один»: каждый второй, начиная с позиции s."""
    out = []
    i = s
    n = len(elementy)
    while i < n:
        out.append(elementy[i])
        i += 2
    return out


def sliyanie(pervyy, vtoroy):
    """«Слияние»: хвостовой самовызов — цикл с двумя указателями."""
    out = []
    i = 0
    j = 0
    n = len(pervyy)
    m = len(vtoroy)
    while i < n and j < m:
        if pervyy[i] <= vtoroy[j]:
            out.append(pervyy[i])
            i += 1
        else:
            out.append(vtoroy[j])
            j += 1
    while i < n:
        out.append(pervyy[i])
        i += 1
    while j < m:
        out.append(vtoroy[j])
        j += 1
    return out


def sortirovka(elementy):
    """«Сортировка»: рекурсия настоящая — значит и здесь рекурсия."""
    if len(elementy) <= 1:
        return elementy
    levaya = cherez_odin(elementy, 0)
    pravaya = cherez_odin(elementy, 1)
    return sliyanie(sortirovka(levaya), sortirovka(pravaya))


# ── задача 3: обход дерева ──────────────────────────────────────────────────
# Лист — None, узел — кортеж (ключ, слева, справа). Значения неизменяемы, как
# у flang: вставка переписывает путь и возвращает новое дерево.


def vstavit(derevo, novyy):
    if derevo is None:
        return (novyy, None, None)
    kl, l, p = derevo
    if novyy < kl:
        return (kl, vstavit(l, novyy), p)
    return (kl, l, vstavit(p, novyy))


def sobrat_derevo(skolko, zerno):
    derevo = None
    x = zerno
    for _ in range(skolko):
        x = (A * x + C) % M
        derevo = vstavit(derevo, x)
    return derevo


def summa_dereva(derevo):
    if derevo is None:
        return 0
    kl, l, p = derevo
    return (kl + summa_dereva(l)) + summa_dereva(p)


def glubina_dereva(derevo):
    if derevo is None:
        return 0
    _, l, p = derevo
    gl = glubina_dereva(l)
    gp = glubina_dereva(p)
    return (gl if gl > gp else gp) + 1


def obhod_dereva(skolko):
    derevo = sobrat_derevo(skolko, 12345)
    return summa_dereva(derevo) + 1000000 * glubina_dereva(derevo)


# ── задача 4: разбор строк ──────────────────────────────────────────────────


def udvoit_tekst(tekst, raz):
    for _ in range(raz):
        tekst = tekst + "," + tekst
    return tekst


def razbor_strok(raz):
    tekst = udvoit_tekst("17,42,8,99,3,71,25,60,14,88", raz)
    acc = 0
    for kusok in tekst.split(","):
        acc = (acc * 31 + int(kusok)) % 1000003
    return acc


# ── точки входа ─────────────────────────────────────────────────────────────


def sortirovka_zadacha(skolko):
    return otpechatok(sortirovka(chisla(skolko, 12345)))


ZADACHI = {
    "коллатц": kollatc,
    "сортировка": sortirovka_zadacha,
    "дерево": obhod_dereva,
    "строки": razbor_strok,
}


def main(argv):
    if len(argv) != 3 or argv[1] not in ZADACHI:
        sys.stderr.write("использование: zadachi.py {%s} РАЗМЕР\n" % "|".join(ZADACHI))
        return 2
    sys.setrecursionlimit(200000)
    sys.stdout.write("%d\n" % ZADACHI[argv[1]](int(argv[2])))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
