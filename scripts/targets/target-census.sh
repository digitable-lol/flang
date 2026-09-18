#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# Перепись утверждений библиотеки по виду цели: сколько какого вида и сколько
# доказано сегодня. Вид — с разбора (flang ast), вердикт — из ведомости
# (flang check --proof); модули идут подряд под ограничителем памяти.
#
# Как звать:  sh scripts/targets/target-census.sh [каталог]   умолчание flang/stdlib
#             (вся библиотека — около часа; каталог или модуль — минуты)
#
# Коды: 0 — перепись снята; 2 — нет двоичного; 3 — ни одной ведомости не снялось.
#       Второй и третий — «не проверено», а не «утверждений нет».
# см. docs/zettel/a-census-without-the-binary-prints-zeros-and-exits-zero.md
set -u
koren=$(cd "$(dirname "$0")/../.." && pwd)
katalog=${1:-flang/stdlib}
rab=$(mktemp -d -p /srv/tmp perepis.XXXXXX)
trap 'rm -rf "$rab"' EXIT

cd "$koren" || exit 1

# ── ПРИБОР. Без двоичного эта перепись не перепись ──────────────────────────
if [ ! -x ./bootstrap/flang ]; then
  echo "НЕ ИЗМЕРЯЛ: нет двоичного $koren/bootstrap/flang." >&2
  echo "Вид цели читается разбором (\`flang ast\`), вердикт — ведомостью" >&2
  echo "(\`flang check --proof\`); без двоичного ни того, ни другого нет." >&2
  echo "Это не «утверждений нет», это «смотреть нечем»." >&2
  echo "Соберите его: make -C bootstrap -j8" >&2
  exit 2
fi

for fajl in "$katalog"/*.flang "$katalog"/*.fp "$katalog"/*.фп "$katalog"/*.фланг "$katalog"/*.fscript; do
  [ -e "$fajl" ] || continue
  imya=$(basename "$fajl"); imya=${imya%.flang}; imya=${imya%.fp}; imya=${imya%.фп}; imya=${imya%.фланг}; imya=${imya%.fscript}
  ./scripts/memory-limit.sh -- ./bootstrap/flang ast "$fajl" > "$rab/ast-$imya.json" 2>"$rab/ast-$imya.err"
  ./scripts/memory-limit.sh -- ./bootstrap/flang check "$fajl" --proof > "$rab/led-$imya.txt" 2>&1
done

python3 - "$rab" <<'PYEOF'
# -*- coding: utf-8 -*-
import json, os, re, sys, collections
РАБ = sys.argv[1]

def это(н, в): return isinstance(н, dict) and н.get("kind") == в
def лит(н): return это(н, "literal")
def истина(н): return лит(н) and н.get("value") is True
def ноль(н): return лит(н) and н.get("value") == 0
def длина(н): return это(н, "builtin") and н.get("name") in ("длина", "length")
def вызов(н): return это(н, "call")

def ложь(н): return лит(н) and н.get("value") is False

def связка(e):
    """Три записи языка приезжают в разбор одним узлом `если`, и различает их
    только то, какие литералы стоят в ветвях. Не различишь — и `A и притом B`
    посчитается «деревом условий», то есть вид цели будет назван неверно."""
    if not это(e, "if"): return None
    т, и = e.get("then"), e.get("else")
    if ложь(т) and истина(и): return "отрицание"
    if истина(т) and not истина(и) and not ложь(и): return "связка: дизъюнкция"
    if ложь(и) and not истина(т) and not ложь(т): return "связка: конъюнкция"
    return None

def снять_охрану(e):
    """`если <охрана о входе> то <цель> иначе да` — оберег от «не числа» и от
    пустого входа, а не вид цели. Снимается ТОЛЬКО эта форма: `иначе да`."""
    сколько = 0
    while это(e, "if") and сколько < 8 and связка(e) is None:
        if истина(e.get("else")): e = e.get("then")
        else: break
        сколько += 1
    return e, сколько

def вид(e):
    if not isinstance(e, dict): return "прочее"
    св = связка(e)
    if св: return св
    k = e.get("kind")
    if k == "binary":
        op, л, п = e.get("op"), e.get("left"), e.get("right")
        if op == "and": return "связка: конъюнкция"
        if op == "or":  return "связка: дизъюнкция"
        if op == "gte":
            if ноль(п): return "граница: не меньше нуля"
            if лит(п):  return "граница: не меньше литерала"
            return "граница: не меньше терма"
        if op == "lte":
            if лит(п): return "граница: не больше литерала"
            if лит(л): return "граница: литерал не больше терма"
            return "граница: не больше терма"
        if op in ("gt", "lt"): return "граница: строгое неравенство"
        if op == "eq":
            if вызов(л) and вызов(п): return "равенство: круг (вызов равен вызову)"
            if вызов(л) or вызов(п):  return "равенство: вызов равен терму"
            if длина(л) and длина(п): return "равенство: длин (сохранение)"
            if лит(п) or лит(л):      return "равенство: с литералом"
            return "равенство: термов"
        if op == "neq": return "равенство: отрицание равенства"
        return "сравнение: " + str(op)
    if k == "builtin":
        и = e.get("name")
        if и in ("содержит", "contains"): return "принадлежность: содержит"
        if и in ("не", "not"): return "отрицание"
        return "встроенное: " + str(и)
    if k == "if":      return "условное: дерево условий"
    if k == "call":    return "голый вызов предиката"
    if k == "var":     return "голое имя"
    if k == "literal": return "цель-литерал"
    if k == "match":   return "условное: разбор"
    if k == "let":     return "прочее: пусть"
    return "прочее: " + str(k)

виды, охран = {}, 0
for ф in sorted(os.listdir(РАБ)):
    if not (ф.startswith("ast-") and ф.endswith(".json")): continue
    try: d = json.load(open(os.path.join(РАБ, ф), encoding="utf-8"))
    except Exception: continue
    for функция in d.get("functions", []):
        for п in функция.get("postconditions", []) or []:
            ядро, с = снять_охрану(п.get("expr"))
            ключ = (функция["name"], п["name"])
            if ключ not in виды: охран += 1 if с else 0
            виды[ключ] = вид(ядро)

СТРОКА = re.compile(r"^\s{2}постусловие «(.+?)» функции «(.+?)» — (.*)$")
def вердикт(т):
    if т.startswith("доказано индукцией"): return "индукцией"
    if т.startswith("доказано"):           return "доказано"
    if т.startswith("сетка"):              return "на сетке"
    if т.startswith("объявлено, не доказано"): return "объявлено"
    return "НАРУШЕНО"

вердикты, измерено, неизмерено = {}, 0, []
for ф in sorted(os.listdir(РАБ)):
    if not (ф.startswith("led-") and ф.endswith(".txt")): continue
    т = open(os.path.join(РАБ, ф), encoding="utf-8", errors="replace").read()
    if "что высказано и чем это несётся" not in т:
        неизмерено.append(ф[4:-4]); continue
    измерено += 1
    for стр in т.splitlines():
        м = СТРОКА.match(стр)
        if м: вердикты[(м.group(2), м.group(1))] = вердикт(м.group(3))

for имя in неизмерено: print("НЕ ИЗМЕРЕН:", имя)
общий = set(виды) & set(вердикты)
print(f"модулей измерено: {измерено}, не измерено: {len(неизмерено)}")

if измерено == 0:
    print("НЕ ИЗМЕРЕН НИ ОДИН МОДУЛЬ: ведомости пусты, считать нечего."
          " Таблица не печатается — нули от пустоты не перепись.",
          file=sys.stderr)
    sys.exit(3)
print(f"утверждений в разборе: {len(виды)}; с вердиктом: {len(общий)}; охран «иначе да» снято: {охран}")
т = collections.defaultdict(collections.Counter)
for к in общий: т[виды[к]][вердикты[к]] += 1
print()
print(f"{'вид цели':46} {'всего':>5} {'дказ':>5} {'инд':>4} {'сетка':>6} {'объявл':>7}")
итого = collections.Counter()
for в, c in sorted(т.items(), key=lambda kv: -sum(kv[1].values())):
    итого.update(c)
    print(f"{в:46} {sum(c.values()):5d} {c['доказано']:5d} {c['индукцией']:4d} {c['на сетке']:6d} {c['объявлено']:7d}")
print(f"{'ИТОГО':46} {sum(итого.values()):5d} {итого['доказано']:5d} {итого['индукцией']:4d} {итого['на сетке']:6d} {итого['объявлено']:7d}")
PYEOF
