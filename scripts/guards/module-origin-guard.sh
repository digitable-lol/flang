#!/bin/sh
# ОТКУДА ВЗЯТ КАЖДЫЙ МОДУЛЬ — поимённо, ДО сборки и без двоичного.
#
#   sh scripts/guards/module-origin-guard.sh              # опись: модуль → файл, из которого он приедет
#   sh scripts/guards/module-origin-guard.sh --кратко      # только чужое
#   sh scripts/guards/module-origin-guard.sh --подлог      # проба порчи на игрушечном дереве
#   sh scripts/guards/module-origin-guard.sh --корень DIR  # судить не это дерево, а названное
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
# `bootstrap/flang check scripts/site/releases.flang` отвечает «замечаний нет», кодом
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

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$ROOT"

MODE=${1:-}
JUDGED=$ROOT
if [ "$MODE" = "--корень" ]; then
  JUDGED=${2:?"--корень требует каталога"}
  MODE=${3:-}
fi

if [ "$MODE" = "--подлог" ]; then
  # ПРОБА ПОРЧИ. Настоящее дерево для неё не годится в обе стороны: покрасить
  # его — значит положить файл ВЫШЕ корня, в чужую рабочую зону, а позеленить —
  # значит убрать чужой черновик, который сторожу и не принадлежит. Поэтому
  # проба строит игрушечное дерево во временном каталоге и гоняет сторожа по
  # нему дважды: с подложенным файлом наверху и без него.
  WORK=$(mktemp -d "${TMPDIR:-/tmp}/isolation-forgery.XXXXXX")
  trap 'rm -rf "$WORK"' EXIT INT TERM
  mkdir -p "$WORK/над/дерево/flang/stdlib" "$WORK/над/дерево/scripts" "$WORK/над/дерево/bootstrap"
  : > "$WORK/над/дерево/bootstrap/flang"
  printf 'модуль «Списки»\n' > "$WORK/над/дерево/flang/stdlib/lists.flang"
  printf 'модуль «Проба»\n  использует «Списки»\n' > "$WORK/над/дерево/scripts/probe.flang"
  # `.flang` В КОРНЕ игрушечного дерева — не украшение, а условие подъёма:
  # каталог без единого `.flang` обрывает подъём, и без этого файла проба была
  # бы зелена в обе стороны, ничего не проверив.
  printf 'модуль «Корень»\n' > "$WORK/над/дерево/root.flang"

  printf 'модуль «Списки»\n' > "$WORK/над/чужой-черновик.flang"
  set +e
  sh "$0" --корень "$WORK/над/дерево" > "$WORK/с-подлогом.out" 2>&1
  WITH_FORGERY=$?
  rm -f "$WORK/над/чужой-черновик.flang"
  sh "$0" --корень "$WORK/над/дерево" > "$WORK/без-подлога.out" 2>&1
  WITHOUT_FORGERY=$?
  set -e

  echo "ПРОБА ПОРЧИ: сторож происхождения модулей"
  echo
  echo "  с подложенным файлом выше корня  код $WITH_FORGERY  (ждали 1)"
  sed 's/^/    /' "$WORK/с-подлогом.out"
  echo
  echo "  без него                          код $WITHOUT_FORGERY  (ждали 0)"
  sed 's/^/    /' "$WORK/без-подлога.out"
  echo
  if [ "$WITH_FORGERY" = 1 ] && [ "$WITHOUT_FORGERY" = 0 ]; then
    echo "проба пройдена: сторож краснеет на подлоге и зеленеет без него"
    exit 0
  fi
  echo "ПРОБА ПРОВАЛЕНА: сторож не переворачивается — верить ему нельзя" >&2
  exit 1
fi

LC_ALL=C.UTF-8 python3 - "$JUDGED" "$MODE" <<'PY'
import os, re, sys

judged, mode = os.path.realpath(sys.argv[1]), sys.argv[2]

# ── Правило поиска: повторение repl_places_of/repl_find_module ──────────────
MODULE_WORDS = ("модуль", "module", "模块")
IMPORT_WORDS = ("использует", "uses", "uzas", "使用")
HEAD_BYTES = 65536          # столько же байт от начала читает repl_read_head

directory_cache = {}

def directory(path_):
    """Пути `.flang` каталога и имена их модулей — читается один раз."""
    if path_ in directory_cache:
        return directory_cache[path_]
    pairs = []
    try:
        names = sorted(f for f in os.listdir(path_) if f.endswith(".flang"))
    except OSError:
        names = []
    for name in names:
        full = os.path.join(path_, name)
        if not os.path.isfile(full):
            continue
        pairs.append((full, module_name(full)))
    directory_cache[path_] = pairs
    return pairs

def module_name(path_):
    """Первая ЗНАЧАЩАЯ строка файла — она и обязана быть заголовком модуля."""
    try:
        with open(path_, "rb") as stream:
            text = stream.read(HEAD_BYTES).decode("utf-8", "replace")
    except OSError:
        return None
    for line in text.split("\n"):
        trimmed = line.strip()
        if not trimmed or trimmed.startswith("//"):
            continue
        matched = re.match(r"(%s)[ \t]+«([^»]+)»" % "|".join(MODULE_WORDS), trimmed)
        return matched.group(2) if matched else None
    return None

def places_of(importer):
    """Каталог файла, каждый ВЫШЕ с `.flang`, FLANG_MODULE_DIR, библиотека."""
    places, step = [], os.path.dirname(importer)
    while True:
        if step not in places:
            places.append(step)
        if step == "/":
            break
        above = os.path.dirname(step)
        step = above
        if not directory(step):
            break
    named = os.environ.get("FLANG_MODULE_DIR", "")
    places += [k for k in named.split(":") if k]
    places += library()
    return places

def library():
    """Подкаталоги РЯДОМ С ДВОИЧНЫМ — так их ищет repl_library_places."""
    binary = os.environ.get("FLANG_BINARY") or os.path.join(judged, "bootstrap", "flang")
    if not os.path.exists(binary):
        return []
    parent = os.path.dirname(os.path.dirname(os.path.realpath(binary)))
    subdirectories = ("flang/stdlib", "flang/core", "share/flang/stdlib", "share/flang/core")
    return [os.path.join(parent, p) for p in subdirectories if os.path.exists(os.path.join(parent, p))]

def find(importer, name):
    """Первое место, где имя нашлось, отдаёт ВСЕ свои совпадения; прочее — тень."""
    taken, shadow = [], []
    for place in places_of(importer):
        here = [path_ for path_, name_here in directory(place) if name_here == name]
        if not taken:
            taken = here
        else:
            shadow += [p for p in here if p not in taken and p not in shadow]
    return taken, shadow

# ── Ввозы дерева ────────────────────────────────────────────────────────────
IMPORT = re.compile(r"^(?:%s)[ \t]+«([^»]+)»(?:[ \t]+из[ \t]+\"([^\"]*)\")?" % "|".join(IMPORT_WORDS))

def in_tree(path_):
    return path_ == judged or path_.startswith(judged + os.sep)

files = []
for base, directories, names in os.walk(judged):
    directories[:] = [k for k in directories if k != ".git"]
    files += [os.path.join(base, i) for i in names if i.endswith((".flang", ".fscript"))]
files.sort()

imports_by_name = imports_with_path = 0
provenance = {}     # (имя модуля, путь-победитель) → сколько ввозов
foreign, not_found, disputed, foreign_path = [], [], [], []

for file in files:
    try:
        lines = open(file, encoding="utf-8", errors="replace").read().split("\n")
    except OSError:
        continue
    for number, line in enumerate(lines, 1):
        matched = IMPORT.match(line.strip())
        if not matched:
            continue
        name, path_ = matched.group(1), matched.group(2)
        where = "%s:%d" % (os.path.relpath(file, judged), number)
        if path_:
            imports_with_path += 1
            whole = os.path.realpath(os.path.join(os.path.dirname(file), path_))
            if not in_tree(whole):
                foreign_path.append((where, name, whole))
            continue
        imports_by_name += 1
        taken, shadow = find(file, name)
        if not taken:
            not_found.append((where, name))
            continue
        if len(taken) > 1:
            disputed.append((where, name, taken))
        winner = taken[0]
        provenance[(name, winner)] = provenance.get((name, winner), 0) + 1
        if not in_tree(winner):
            own = [p for p in shadow if in_tree(p)]
            foreign.append((where, name, winner, own))

def short(path_):
    return os.path.relpath(path_, judged) if in_tree(path_) else path_

if mode != "--кратко":
    print("ОТКУДА ПРИЕДЕТ КАЖДЫЙ МОДУЛЬ (дерево %s)\n" % judged)
    print("  файлов .flang в дереве      %d" % len(files))
    print("  ввозов по имени             %d" % imports_by_name)
    print("  ввозов с путём              %d  (разрешаются от файла, подъёмом не задеты)" % imports_with_path)
    print("  различных пар модуль→файл   %d\n" % len(provenance))
    for (name, winner), count in sorted(provenance.items()):
        mark = "  " if in_tree(winner) else "ЧУЖОЙ "
        print("  %s«%s» → %s  (ввозов %d)" % (mark, name, short(winner), count))
    print()

if not_found:
    print("НЕ НАЙДЕНЫ (об этом скажет связывание, сторож их в счёт не берёт): %d" % len(not_found))
    for where, name in not_found[:20]:
        print("  %s: «%s»" % (where, name))
    print()

if disputed:
    print("СПОР ИМЁН в одном месте (компилятор ответит FLANG_IMPORT_AMBIGUOUS): %d" % len(disputed))
    for where, name, taken in disputed[:20]:
        print("  %s: «%s» — %s" % (where, name, ", ".join(short(p) for p in taken)))
    print()

trouble = 0
for where, name, whole in foreign_path:
    trouble += 1
    print("ПУТЬ ВЕДЁТ ВОН ИЗ ДЕРЕВА  %s: «%s» → %s" % (where, name, whole))
for where, name, winner, own in foreign:
    trouble += 1
    print("МОДУЛЬ ИЗ-ЗА ПРЕДЕЛОВ ДЕРЕВА  %s: «%s» приедет из %s" % (where, name, winner))
    if own:
        print("      этим перекрыто в дереве: %s" % ", ".join(short(p) for p in own))
    else:
        print("      в дереве такого модуля нет вовсе — ввоз держится на чужом файле")

if trouble:
    print()
    print("СБОРКА НЕ ИЗОЛИРОВАНА: мест %d. Поиск модуля поднимается ВЫШЕ корня дерева,"
          " и чужой файл занял место своего." % trouble)
    print("Что делать сейчас: убрать чужой файл из каталога-предка либо перенести дерево"
          " туда, где у предков нет `.flang`.")
    sys.exit(1)

print("изоляция цела: каждый ввоз разрешается файлом внутри дерева")
sys.exit(0)
PY
# короткая команда «module-origin:check» sh — откуда приедет каждый модуль: поиск по имени поднимается ВЫШЕ корня дерева, и чужой файл в каталоге-предке подменяет модуль языка молча — 8 сентября 2026 «JSON» брался из /srv/tmp/json.baseline.flang, а сборка отвечала кодом 0
# короткая команда «module-origin:forgery» sh --подлог — проверка изоляции краснеет на файле, подложенном выше корня, и зеленеет, когда его убрали — обе стороны прогоном, на игрушечном дереве во временном каталоге
