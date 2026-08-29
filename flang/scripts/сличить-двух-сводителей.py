#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
"""СЛИЧЕНИЕ ДВУХ СВОДИТЕЛЕЙ.

Берёт ведомость ядра (`flang check --proof --json`) и ответ малого сводителя
по тому же файлу и кладёт их рядом: на каждое утверждение — два ответа.

Оснастка только возит и считает; решают обе программы на flang.
"""
import json, os, subprocess, sys, collections

KOREN = os.environ.get("FLANG_KOREN", os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
RABOTA = os.environ.get("SLICHENIE_RABOTA", "/srv/tmp/сличение")
YADRO = os.path.join(RABOTA, "yadro")
MALYY = os.path.join(RABOTA, "malyy")

DOKAZANO = {"proved", "proved-induction"}


def imya_faila(put):
    return put.replace("/", "_")


def vedomost(put):
    p = os.path.join(YADRO, imya_faila(put) + ".json")
    if not os.path.exists(p) or os.path.getsize(p) == 0:
        return None
    try:
        return json.load(open(p, encoding="utf-8"))
    except Exception:
        return None


def pravilo_yadra(cl):
    ind = cl.get("induction") or {}
    r = ind.get("rules") or []
    if r:
        return ", ".join(r)
    s = cl.get("says") or ""
    if "правилом «" in s:
        return s.split("правилом «", 1)[1].split("»", 1)[0]
    if "правило «" in s:
        return s.split("правило «", 1)[1].split("»", 1)[0]
    if "правила сведения: " in s:
        return s.split("правила сведения: ", 1)[1].split(" —", 1)[0]
    return ""


def svoi_funkcii(put):
    """Имена функций, ОБЪЯВЛЕННЫХ в этом файле.

    Ведомость ядра печатается по СВЯЗАННОЙ программе — вместе с ввезёнными
    модулями, — и утверждения соседа попали бы в счёт столько раз, сколько
    модулей его подключают. Малый читает один файл, поэтому и сличать надо
    только своё. Тот же отбор делает `flang/scripts/proof-ledger.mjs`.
    """
    imena = set()
    with open(os.path.join(KOREN, put), encoding="utf-8") as fh:
        for line in fh:
            if line.startswith("функция «") or line.startswith("тотальная функция «"):
                imena.add(line.split("«", 1)[1].split("»", 1)[0])
    return imena


def otvety_malogo(put):
    p = os.path.join(MALYY, imya_faila(put) + ".tsv")
    if not os.path.exists(p):
        return None
    out = {}
    for line in open(p, encoding="utf-8"):
        line = line.rstrip("\n")
        if not line.strip():
            continue
        ch = line.split("\t")
        if len(ch) < 3:
            continue
        out[(ch[0], ch[1])] = (ch[2], ch[3] if len(ch) > 3 else "")
    return out


def main(spisok):
    puti = [l.strip() for l in open(spisok, encoding="utf-8") if l.strip()]
    svod = collections.Counter()
    stroki = []
    bez_yadra, bez_malogo = [], []
    for put in puti:
        v = vedomost(put)
        if v is None:
            bez_yadra.append(put)
            continue
        m = otvety_malogo(put)
        if m is None:
            bez_malogo.append(put)
            continue
        свои = svoi_funkcii(put)
        for cl in v.get("claims", []):
            if cl.get("kind") != "постусловие":
                continue
            f, n = cl.get("of") or "", cl.get("name") or ""
            if f not in свои:
                continue
            bolshoy = "доказано" if cl.get("verdict") in DOKAZANO else "не доказано"
            malyy, dovod = m.get((f, n), ("нет ответа", "утверждения в разборе малого не нашлось"))
            svod[(bolshoy, malyy)] += 1
            stroki.append((put, f, n, bolshoy, pravilo_yadra(cl), malyy, dovod))
    print("== СВОД ==")
    vsego = sum(svod.values())
    print(f"утверждений сличено: {vsego}")
    for k in sorted(svod, key=lambda k: -svod[k]):
        print(f"  большой {k[0]:<12} | малый {k[1]:<12} : {svod[k]}")
    soglasie = svod[("доказано", "доказано")]
    print(f"\nПОКРЫТО СОГЛАСИЕМ ДВУХ НЕЗАВИСИМЫХ: {soglasie}")
    print(f"НАХОДКИ (большой доказано, малый НЕ доказано): {svod[('доказано', 'не доказано')]}")
    print(f"ОБРАТНЫЕ (малый доказано, большой нет): {svod[('не доказано', 'доказано')]}")
    if bez_yadra:
        print(f"\nбез ведомости ядра: {len(bez_yadra)} — {', '.join(bez_yadra[:6])}")
    if bez_malogo:
        print(f"без ответа малого: {len(bez_malogo)} — {', '.join(bez_malogo[:6])}")
    with open(os.path.join(RABOTA, "ryadom.tsv"), "w", encoding="utf-8") as fh:
        for s in stroki:
            fh.write("\t".join(s) + "\n")
    print(f"\nпострочно: {os.path.join(RABOTA, 'ryadom.tsv')}")
    soglas = collections.Counter(s[4] for s in stroki if s[3] == "доказано" and s[5] == "доказано")
    print("\nсогласие по правилам ядра:")
    for k in sorted(soglas, key=lambda k: -soglas[k]):
        print(f"  {k or '(правило не названо)'}: {soglas[k]}")
    prich = collections.Counter(s[6] for s in stroki if s[3] == "доказано" and s[5] == "не берусь")
    print("\nпочему малый не берётся там, где большой доказал:")
    for k in sorted(prich, key=lambda k: -prich[k]):
        print(f"  {prich[k]:4d}  {k}")


if __name__ == "__main__":
    main(sys.argv[1])
