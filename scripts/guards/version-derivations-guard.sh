#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# ВЕРСИЯ ЖИВЁТ В ОДНОМ ИСТОЧНИКЕ, А ВЫТЕКАЕТ ВО МНОГО МЕСТ — И ЭТИ МЕСТА
# ОБЯЗАНЫ СХОДИТЬСЯ С ИСТОЧНИКОМ БЕЗ РУЧНОЙ ПРАВКИ.
#
#   sh scripts/guards/version-derivations-guard.sh            # сверка, код 1 при расхождении
#   sh scripts/guards/version-derivations-guard.sh --подлог   # развести версию на копии и убедиться, что краснеет
#
# ── Зачем ───────────────────────────────────────────────────────────────────
# Число версии до сих пор набивали руками в нескольких файлах, и они разъезжались
# молча (задачи 9983, 4970). Существующий `версия:проверка` сверяет ровно пару
# package.json ↔ FLANG_VERSION — этого мало: .TH страницы man и три числа формулы
# Homebrew он только называет, а судят их дорогие `справка:проверка` и
# `формула:проверка`, которых нет в pre-push. Здесь — дешёвая сверка ВСЕХ
# производных мест с ОДНИМ источником, годная для хука перед пушем: ни groff, ни
# sha256sum, ни сети, только чтение файлов.
#
# Источник версии один: функция «Версия» в scripts/release/emit-package.flang. Из неё
# печатается package.json и из неё же ярлык `версия` разносит число во все
# производные места. Разошлось — не правьте руками, запустите:
#
#   ./ярлык версия <НОВОЕ ЧИСЛО>
#
# ── Что здесь СВЕРЯЕТСЯ с источником ────────────────────────────────────────
#   package.json                    version
#   .flangrc                        версия, имя
#   flang/src/emit/c/flang_repl.c   #define FLANG_VERSION
#   packaging/flang.1               .TH и обе расшифровки прогонов «flang X»
#   packaging/homebrew/flang.rb     version, тег в url, имя архива в url
#
# ── Чего здесь НЕТ, и почему ────────────────────────────────────────────────
#   packaging/homebrew/flang.rb  sha256 — его нельзя вывести из числа версии: он
#       снимается с СОБРАННОГО архива выпуска, которого при бампе ещё нет.
#       Сверяет его `формула:проверка` (и release.yml с готовым архивом), а
#       ярлык `версия` его намеренно не трогает.
#   changelog.json, bootstrap/flang_repl.c (семя) — отражают ВЫПУЩЕННОЕ и семя,
#       законно отстают от готовящейся версии; трогать их бампом нельзя.
#   README, docs/site/releases*, замеры с датой — проза про старые версии.
#
# ── Не подменяет соседей ────────────────────────────────────────────────────
# Этот сторож сверяет ТОЛЬКО число версии и дёшево. Знак-в-знак package.json
# держит `пакет:проверка`, набор man — `справка:проверка`, sha256 и архив —
# `формула:проверка`. Спора нет: здесь подмножество-по-числу, дешёвое и в хуке.
set -u

KOREN=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$KOREN" || exit 3

ISTOCHNIK=scripts/release/emit-package.flang
PODLOG=${1:-}

# ── Версия источника: тело функции «Версия» — единственная строка вида
#    «‹два пробела›"X.Y.Z"». Пример в той же функции набран с бо́льшим отступом
#    и словом «ожидается», под шаблон не попадает. Без кириллицы в шаблоне —
#    LC_ALL иначе решает, что «Версия» это байты, а не буквы.
V_SRC=$(grep -oE '^  "[0-9]+\.[0-9]+\.[0-9]+"$' "$ISTOCHNIK" | tr -d ' "' | head -1)

# Имя пакета — тело функции «Имя пакета», единственная строка вида
# «‹два пробела›"@…"». Тем же шаблоном и по той же причине, что и версия.
N_SRC=$(grep -oE '^  "@[^"]+"$' "$ISTOCHNIK" | tr -d ' "' | head -1)

if [ -z "$V_SRC" ]; then
  echo "СВЕРКА НЕ НАЧАТА: в $ISTOCHNIK не найдена версия (тело функции «Версия»)." >&2
  echo "Источник версии сломан — сверять производные не с чем." >&2
  exit 3
fi

# ── подлог: развести версию на копии дерева и показать, что сторож краснеет ──
if [ "$PODLOG" = "--подлог" ]; then
  KOP=${FLANG_TMP:-/srv/tmp}/verderiv-podlog.$$
  # РАСКЛАДКА КОПИИ ПОВТОРЯЕТ ДЕРЕВО, И ЭТО НЕ ПЕДАНТИЗМ. До 13 сентября 2026
  # источник клали в `$KOP/scripts/`, а сам сторож звали из
  # `$KOP/scripts/guards/` — каталога, которого копия не заводила вовсе.
  # Проба отвечала «sh: cannot open …», то есть кодом 2, и объявляла подлог
  # пойманным: ловилось отсутствие файла, а не разведённая версия. Проба,
  # красная не по своему предмету, — холостая.
  rm -rf "$KOP"; mkdir -p "$KOP/scripts/guards" "$KOP/scripts/release" "$KOP/flang/src/emit/c" "$KOP/packaging/homebrew" || exit 3
  trap 'rm -rf "$KOP"' EXIT INT TERM
  cp "$ISTOCHNIK" "$KOP/scripts/release/" || exit 3
  cp package.json "$KOP/" || exit 3
  cp .flangrc "$KOP/" || exit 3
  cp flang/src/emit/c/flang_repl.c "$KOP/flang/src/emit/c/" || exit 3
  cp packaging/flang.1 "$KOP/packaging/" || exit 3
  cp packaging/homebrew/flang.rb "$KOP/packaging/homebrew/" || exit 3
  cp "$0" "$KOP/scripts/guards/" || exit 3
  # разводим ровно .TH страницы — источник не трогаем, значит производное разошлось
  sed -i 's/flang '"$V_SRC"'/flang 9.9.9/' "$KOP/packaging/flang.1"
  sh "$KOP/scripts/guards/version-derivations-guard.sh" >"$KOP/out" 2>&1
  kod=$?
  if [ "$kod" = 0 ]; then
    echo "ПОДЛОГ НЕ ПОЙМАН: развели .TH на 9.9.9, а сторож остался зелёным (код 0)." >&2
    echo "Сторож, не краснеющий на разведённой версии, — выключенный сторож." >&2
    exit 1
  fi
  # Кода «не ноль» мало: код 3 — это «сверка не начата», код 2 — оболочка не
  # нашла файла. Требуется код 1 И беда, названная страницей man, — иначе
  # проба показала бы лишь то, что копия развалилась.
  if [ "$kod" != 1 ]; then
    echo "ПРОБА ХОЛОСТА: сторож ответил кодом $kod, а не 1 — это не «поймал подлог», это «не смог посмотреть»." >&2
    sed 's/^/  /' "$KOP/out" >&2
    exit 1
  fi
  if ! grep -q 'packaging/flang.1' "$KOP/out"; then
    echo "ПРОБА ХОЛОСТА: сторож покраснел не тем — про packaging/flang.1 в выводе нет ни слова." >&2
    sed 's/^/  /' "$KOP/out" >&2
    exit 1
  fi
  echo "подлог пойман: развели .TH на 9.9.9 — сторож ответил код $kod и назвал страницу man. Вывод:"
  sed 's/^/  /' "$KOP/out"
  exit 0
fi

# ── сверка ───────────────────────────────────────────────────────────────────
BEDY=""
dobavit() { BEDY="${BEDY}  · $1
"; }

# package.json version
V_PKG=$(sed -n 's/^  "version": "\([^"]*\)",$/\1/p' package.json)
if [ "$V_PKG" != "$V_SRC" ]; then
  dobavit "package.json: version «${V_PKG:-не найдена}», а источник $ISTOCHNIK объявляет «$V_SRC» — package.json не перепечатан из источника"
fi

# .flangrc — версия и имя проекта. Файл настроек читают и человек, и
# `sh scripts/flangrc.sh`, и разойтись с источником он не вправе ровно так же,
# как package.json: `./ярлык версия <N>` разносит число и туда.
V_RC=$(sed -n 's/^версия[[:space:]]*=[[:space:]]*//p' .flangrc | head -1)
if [ "$V_RC" != "$V_SRC" ]; then
  dobavit ".flangrc: версия «${V_RC:-не найдена}», а источник $ISTOCHNIK объявляет «$V_SRC» — файл настроек не догнал подъём"
fi

if [ -n "$N_SRC" ]; then
  N_RC=$(sed -n 's/^имя[[:space:]]*=[[:space:]]*//p' .flangrc | head -1)
  if [ "$N_RC" != "$N_SRC" ]; then
    dobavit ".flangrc: имя «${N_RC:-не найдено}», а источник $ISTOCHNIK объявляет «$N_SRC»"
  fi
fi

# flang_repl.c #define FLANG_VERSION
V_REPL=$(sed -n 's/^#define FLANG_VERSION "\([^"]*\)".*/\1/p' flang/src/emit/c/flang_repl.c)
if [ "$V_REPL" != "$V_SRC" ]; then
  dobavit "flang/src/emit/c/flang_repl.c: #define FLANG_VERSION «${V_REPL:-не найдена}», а источник объявляет «$V_SRC»"
fi

# packaging/flang.1 — .TH и все расшифровки «flang X.Y.Z»
CHUZHIE=$(grep -oE 'flang [0-9]+\.[0-9]+\.[0-9]+' packaging/flang.1 | sed 's/^flang //' | grep -vxF "$V_SRC" | sort -u | tr '\n' ' ')
if [ -n "$CHUZHIE" ]; then
  dobavit "packaging/flang.1: на странице man стоит версия «$(echo "$CHUZHIE" | sed 's/ $//')», а источник объявляет «$V_SRC» (.TH и/или расшифровки прогонов)"
fi

# packaging/homebrew/flang.rb — version
V_RB=$(sed -n 's/^  version "\([^"]*\)".*/\1/p' packaging/homebrew/flang.rb)
if [ "$V_RB" != "$V_SRC" ]; then
  dobavit "packaging/homebrew/flang.rb: version «${V_RB:-не найдена}», а источник объявляет «$V_SRC»"
fi

# packaging/homebrew/flang.rb — тег и имя архива в url
if ! grep -qF "/download/v$V_SRC/flang-$V_SRC-c.tar.gz" packaging/homebrew/flang.rb; then
  URL=$(sed -n 's|^  url "\(.*\)".*|\1|p' packaging/homebrew/flang.rb)
  dobavit "packaging/homebrew/flang.rb: url «$URL» не ведёт на тег v$V_SRC и архив flang-$V_SRC-c.tar.gz"
fi

if [ -n "$BEDY" ]; then
  echo "сторож производных версии ОТКАЗЫВАЕТ: версия разошлась с источником $ISTOCHNIK ($V_SRC)." >&2
  printf '%s' "$BEDY" >&2
  echo "  Не правьте руками — сведёт всё к источнику одна команда:" >&2
  echo "      ./ярлык версия $V_SRC" >&2
  echo "  (или другое число, если бампаете; sha256 формулы это не трогает — его считает выпуск)." >&2
  exit 1
fi

echo "сторож производных версии: источник $ISTOCHNIK объявляет $V_SRC — и package.json, .flangrc, flang_repl.c, .TH страницы man и три числа формулы Homebrew сошлись с ним. sha256 формулы, changelog и семя здесь не судятся (см. шапку)."
exit 0
