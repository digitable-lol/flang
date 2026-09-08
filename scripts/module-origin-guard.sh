#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# ОТКУДА ВЗЯТ КАЖДЫЙ МОДУЛЬ — поимённо, ДО сборки и без двоичного.
#
#   sh scripts/module-origin-guard.sh              # опись: модуль → файл, из которого он приедет
#   sh scripts/module-origin-guard.sh --кратко      # только чужое
#   sh scripts/module-origin-guard.sh --подлог      # проба порчи на игрушечном дереве
#   sh scripts/module-origin-guard.sh --корень DIR  # судить не это дерево, а названное
#
# Код возврата 0 — каждый ввоз разрешается файлом ВНУТРИ дерева; 1 — хотя бы
# один модуль приезжает из-за пределов дерева, и такой назван обоими путями:
# откуда взят и что этим перекрыто.
#
# ── Зачем ───────────────────────────────────────────────────────────────────
# Поиск модуля по имени поднимается ВВЕРХ по каталогам-предкам, пока в очередном
# предке лежит хоть один `.flang`, и предок просматривается РАНЬШЕ библиотеки
# компилятора. Значит соседний файл, лежащий выше корня репозитория, подменяет
# модуль языка целиком, а сборка об этом не спотыкается: код возврата 0.
#
# Замер 8 сентября 2026 на этом дереве (`/srv/tmp/dokazuemyy/mod-iso`):
# `bootstrap/flang check scripts/releases.flang` отвечает «замечаний нет», кодом
# 0, и печатает при этом в stderr одну строку — «модуль «JSON» взят из
# /srv/tmp/json.baseline.flang». Чужой черновик каталогом выше подменил
# `flang/stdlib/json.flang`, и не покраснел никто: строка идёт в stderr вперемешку
# с отсчётом шагов, а сторожа, который её читает, в дереве не было.
#
# ── Почему это НЕ на flang ──────────────────────────────────────────────────
# Сторож обязан быть неуязвим для того, что стережёт. Любой сторож на flang,
# лежащий в `scripts/`, ввозит соседей ПО ИМЕНИ и ищет их ровно тем же подъёмом
# вверх — то есть его самого можно подменить черновиком из общей зоны. Здесь
# правило поиска ПЕРЕСЧИТЫВАЕТСЯ обходом каталогов, а не спрашивается у
# двоичного, и потому сторож видит подмену даже тогда, когда подменён был бы сам.
# Вторая причина — цена: сторож нужен ПЕРЕД сборкой, когда `bootstrap/flang`
# может быть ещё не собран (5–6 минут), а этот отвечает за доли секунды.
#
# ── Правило поиска повторено здесь ДОСЛОВНО ─────────────────────────────────
# Источник — `repl_places_of` и `repl_find_module`, `flang/src/emit/c/flang_repl.c`
# (подъём вверх — строки 3089–3107, библиотека — 3050). Места, в порядке
# просмотра: каталог ввозящего файла; каждый каталог ВЫШЕ, пока в нём есть
# `.flang`; каталоги `FLANG_MODULE_DIR` через двоеточие; и рядом с двоичным —
# `../flang/stdlib`, `../flang/core`, `../share/flang/stdlib`, `../share/flang/core`.
# Побеждает ПЕРВОЕ место, где имя нашлось, и отдаёт все свои совпадения.
# Расходиться этим двум записям нельзя: разойдутся — сторож станет украшением,
# и заметить это можно только пробой порчи (`--подлог`).
set -eu

KOREN=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$KOREN"

REZHIM=${1:-}
SUD=$KOREN
if [ "$REZHIM" = "--корень" ]; then
  SUD=${2:?"--корень требует каталога"}
  REZHIM=${3:-}
fi

if [ "$REZHIM" = "--подлог" ]; then
  # ПРОБА ПОРЧИ. Настоящее дерево для неё не годится в обе стороны: покрасить
  # его — значит положить файл ВЫШЕ корня, в чужую рабочую зону, а позеленить —
  # значит убрать чужой черновик, который сторожу и не принадлежит. Поэтому
  # проба строит игрушечное дерево во временном каталоге и гоняет сторожа по
  # нему дважды: с подложенным файлом наверху и без него.
  RAB=$(mktemp -d "${TMPDIR:-/tmp}/izolyaciya-podlog.XXXXXX")
  trap 'rm -rf "$RAB"' EXIT INT TERM
  mkdir -p "$RAB/над/дерево/flang/stdlib" "$RAB/над/дерево/scripts" "$RAB/над/дерево/bootstrap"
  : > "$RAB/над/дерево/bootstrap/flang"
  printf 'модуль «Списки»\n' > "$RAB/над/дерево/flang/stdlib/lists.flang"
  printf 'модуль «Проба»\n  использует «Списки»\n' > "$RAB/над/дерево/scripts/proba.flang"
  # `.flang` В КОРНЕ игрушечного дерева — не украшение, а условие подъёма:
  # каталог без единого `.flang` обрывает подъём, и без этого файла проба была
  # бы зелена в обе стороны, ничего не проверив. В настоящем дереве эту роль
  # играет `ярлыки.flang`, и потому наружу выходит именно оно.
  printf 'модуль «Ярлыки»\n' > "$RAB/над/дерево/ярлыки.flang"

  printf 'модуль «Списки»\n' > "$RAB/над/чужой-черновик.flang"
  set +e
  sh "$0" --корень "$RAB/над/дерево" > "$RAB/с-подлогом.out" 2>&1
  S_PODLOGOM=$?
  rm -f "$RAB/над/чужой-черновик.flang"
  sh "$0" --корень "$RAB/над/дерево" > "$RAB/без-подлога.out" 2>&1
  BEZ_PODLOGA=$?
  set -e

  echo "ПРОБА ПОРЧИ: сторож происхождения модулей"
  echo
  echo "  с подложенным файлом выше корня  код $S_PODLOGOM  (ждали 1)"
  sed 's/^/    /' "$RAB/с-подлогом.out"
  echo
  echo "  без него                          код $BEZ_PODLOGA  (ждали 0)"
  sed 's/^/    /' "$RAB/без-подлога.out"
  echo
  if [ "$S_PODLOGOM" = 1 ] && [ "$BEZ_PODLOGA" = 0 ]; then
    echo "проба пройдена: сторож краснеет на подлоге и зеленеет без него"
    exit 0
  fi
  echo "ПРОБА ПРОВАЛЕНА: сторож не переворачивается — верить ему нельзя" >&2
  exit 1
fi

LC_ALL=C.UTF-8 python3 - "$SUD" "$REZHIM" <<'PY'
import os, re, sys

sud, rezhim = os.path.realpath(sys.argv[1]), sys.argv[2]

# ── Правило поиска: повторение repl_places_of/repl_find_module ──────────────
SLOVA_MODULYA = ("модуль", "module", "模块")
SLOVA_VVOZA = ("использует", "uses", "uzas", "使用")
GOLOVA = 65536          # столько же байт от начала читает repl_read_head

kesh_katalogov = {}

def katalog(put):
    """Пути `.flang` каталога и имена их модулей — читается один раз."""
    if put in kesh_katalogov:
        return kesh_katalogov[put]
    pary = []
    try:
        imena = sorted(f for f in os.listdir(put) if f.endswith(".flang"))
    except OSError:
        imena = []
    for imya in imena:
        polnyj = os.path.join(put, imya)
        if not os.path.isfile(polnyj):
            continue
        pary.append((polnyj, imya_modulya(polnyj)))
    kesh_katalogov[put] = pary
    return pary

def imya_modulya(put):
    """Первая ЗНАЧАЩАЯ строка файла — она и обязана быть заголовком модуля."""
    try:
        with open(put, "rb") as potok:
            tekst = potok.read(GOLOVA).decode("utf-8", "replace")
    except OSError:
        return None
    for stroka in tekst.split("\n"):
        obrez = stroka.strip()
        if not obrez or obrez.startswith("//"):
            continue
        sovpalo = re.match(r"(%s)[ \t]+«([^»]+)»" % "|".join(SLOVA_MODULYA), obrez)
        return sovpalo.group(2) if sovpalo else None
    return None

def mesta(vvozyashchij):
    """Каталог файла, каждый ВЫШЕ с `.flang`, FLANG_MODULE_DIR, библиотека."""
    spisok, hod = [], os.path.dirname(vvozyashchij)
    while True:
        if hod not in spisok:
            spisok.append(hod)
        if hod == "/":
            break
        verh = os.path.dirname(hod)
        hod = verh
        if not katalog(hod):
            break
    nazvannoe = os.environ.get("FLANG_MODULE_DIR", "")
    spisok += [k for k in nazvannoe.split(":") if k]
    spisok += biblioteka()
    return spisok

def biblioteka():
    """Подкаталоги РЯДОМ С ДВОИЧНЫМ — так их ищет repl_library_places."""
    dvoichnyj = os.environ.get("FLANG_BINARY") or os.path.join(sud, "bootstrap", "flang")
    if not os.path.exists(dvoichnyj):
        return []
    roditel = os.path.dirname(os.path.dirname(os.path.realpath(dvoichnyj)))
    podkatalogi = ("flang/stdlib", "flang/core", "share/flang/stdlib", "share/flang/core")
    return [os.path.join(roditel, p) for p in podkatalogi if os.path.exists(os.path.join(roditel, p))]

def najti(vvozyashchij, imya):
    """Первое место, где имя нашлось, отдаёт ВСЕ свои совпадения; прочее — тень."""
    vzyato, ten = [], []
    for mesto in mesta(vvozyashchij):
        zdes = [put for put, imya_est in katalog(mesto) if imya_est == imya]
        if not vzyato:
            vzyato = zdes
        else:
            ten += [p for p in zdes if p not in vzyato and p not in ten]
    return vzyato, ten

# ── Ввозы дерева ────────────────────────────────────────────────────────────
VVOZ = re.compile(r"^(?:%s)[ \t]+«([^»]+)»(?:[ \t]+из[ \t]+\"([^\"]*)\")?" % "|".join(SLOVA_VVOZA))

def v_dereve(put):
    return put == sud or put.startswith(sud + os.sep)

fajly = []
for osnova, katalogi, imena in os.walk(sud):
    katalogi[:] = [k for k in katalogi if k != ".git"]
    fajly += [os.path.join(osnova, i) for i in imena if i.endswith(".flang")]
fajly.sort()

vvozov_po_imeni = vvozov_s_putem = 0
proishozhdenie = {}     # (имя модуля, путь-победитель) → сколько ввозов
chuzhie, ne_najdeny, sporn, chuzhoj_put = [], [], [], []

for fajl in fajly:
    try:
        stroki = open(fajl, encoding="utf-8", errors="replace").read().split("\n")
    except OSError:
        continue
    for nomer, stroka in enumerate(stroki, 1):
        sovpalo = VVOZ.match(stroka.strip())
        if not sovpalo:
            continue
        imya, put = sovpalo.group(1), sovpalo.group(2)
        gde = "%s:%d" % (os.path.relpath(fajl, sud), nomer)
        if put:
            vvozov_s_putem += 1
            celyj = os.path.realpath(os.path.join(os.path.dirname(fajl), put))
            if not v_dereve(celyj):
                chuzhoj_put.append((gde, imya, celyj))
            continue
        vvozov_po_imeni += 1
        vzyato, ten = najti(fajl, imya)
        if not vzyato:
            ne_najdeny.append((gde, imya))
            continue
        if len(vzyato) > 1:
            sporn.append((gde, imya, vzyato))
        pobeditel = vzyato[0]
        proishozhdenie[(imya, pobeditel)] = proishozhdenie.get((imya, pobeditel), 0) + 1
        if not v_dereve(pobeditel):
            svoi = [p for p in ten if v_dereve(p)]
            chuzhie.append((gde, imya, pobeditel, svoi))

def kratko(put):
    return os.path.relpath(put, sud) if v_dereve(put) else put

if rezhim != "--кратко":
    print("ОТКУДА ПРИЕДЕТ КАЖДЫЙ МОДУЛЬ (дерево %s)\n" % sud)
    print("  файлов .flang в дереве      %d" % len(fajly))
    print("  ввозов по имени             %d" % vvozov_po_imeni)
    print("  ввозов с путём              %d  (разрешаются от файла, подъёмом не задеты)" % vvozov_s_putem)
    print("  различных пар модуль→файл   %d\n" % len(proishozhdenie))
    for (imya, pobeditel), skolko in sorted(proishozhdenie.items()):
        metka = "  " if v_dereve(pobeditel) else "ЧУЖОЙ "
        print("  %s«%s» → %s  (ввозов %d)" % (metka, imya, kratko(pobeditel), skolko))
    print()

if ne_najdeny:
    print("НЕ НАЙДЕНЫ (об этом скажет связывание, сторож их в счёт не берёт): %d" % len(ne_najdeny))
    for gde, imya in ne_najdeny[:20]:
        print("  %s: «%s»" % (gde, imya))
    print()

if sporn:
    print("СПОР ИМЁН в одном месте (компилятор ответит FLANG_IMPORT_AMBIGUOUS): %d" % len(sporn))
    for gde, imya, vzyato in sporn[:20]:
        print("  %s: «%s» — %s" % (gde, imya, ", ".join(kratko(p) for p in vzyato)))
    print()

beda = 0
for gde, imya, celyj in chuzhoj_put:
    beda += 1
    print("ПУТЬ ВЕДЁТ ВОН ИЗ ДЕРЕВА  %s: «%s» → %s" % (gde, imya, celyj))
for gde, imya, pobeditel, svoi in chuzhie:
    beda += 1
    print("МОДУЛЬ ИЗ-ЗА ПРЕДЕЛОВ ДЕРЕВА  %s: «%s» приедет из %s" % (gde, imya, pobeditel))
    if svoi:
        print("      этим перекрыто в дереве: %s" % ", ".join(kratko(p) for p in svoi))
    else:
        print("      в дереве такого модуля нет вовсе — ввоз держится на чужом файле")

if beda:
    print()
    print("СБОРКА НЕ ИЗОЛИРОВАНА: мест %d. Поиск модуля поднимается ВЫШЕ корня дерева,"
          " и чужой файл занял место своего." % beda)
    print("Что делать сейчас: убрать чужой файл из каталога-предка либо перенести дерево"
          " туда, где у предков нет `.flang`.")
    sys.exit(1)

print("изоляция цела: каждый ввоз разрешается файлом внутри дерева")
sys.exit(0)
PY
