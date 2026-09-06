#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# ПОДНЯТЬ ВЕРСИЮ ОДНОЙ КОМАНДОЙ: число пишется в источник и разносится во все
# производные места, чтобы его не набивали руками в четырёх файлах порознь.
#
#   ./ярлык версия 0.7.13     поставить 0.7.13 всюду
#   ./ярлык версия            показать текущую версию и что из неё вытекает
#
# ── Источник и производные ──────────────────────────────────────────────────
# Источник один: функция «Версия» в scripts/emit-package.flang. Из неё:
#   package.json                    version              — ПЕРЕПЕЧАТЫВАЕТСЯ отсюда
#   flang/src/emit/c/flang_repl.c   #define FLANG_VERSION — генерируется здесь
#   packaging/flang.1               .TH и обе расшифровки «flang X»
#   packaging/homebrew/flang.rb     version, тег и имя архива в url
#
# `#define` в C нельзя «прочитать из файла» при сборке (иначе пришлось бы
# трогать печатаемый bootstrap/Makefile или шаблон emit-c.flang, общий для всех
# программ) — поэтому его СТАВИТ этот скрипт, а сверяет `версия:проверка`.
#
# ── Чего скрипт НЕ трогает, и почему ────────────────────────────────────────
#   packaging/homebrew/flang.rb  sha256 — снимается с СОБРАННОГО архива выпуска,
#       из числа версии не выводится. Его ставит выпуск (release.yml), а
#       проверяет `формула:проверка`. После бампа `формула:проверка` останется
#       красной по sha256, пока архив новой версии не собран — это верно и
#       ожидаемо, а не поломка.
#   changelog.json, bootstrap/flang_repl.c (семя) — отражают выпущенное и семя,
#       законно отстают; поднимает их выпуск и перепечатка семени, не бамп.
set -u

KOREN=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$KOREN" || exit 3

ISTOCHNIK=scripts/emit-package.flang
REPL=flang/src/emit/c/flang_repl.c
MAN=packaging/flang.1
FORMULA=packaging/homebrew/flang.rb
BINARY=bootstrap/flang

tekushchaya() {
  grep -oE '^  "[0-9]+\.[0-9]+\.[0-9]+"$' "$ISTOCHNIK" | tr -d ' "' | head -1
}

NOVAYA=${1:-}

if [ -z "$NOVAYA" ]; then
  V=$(tekushchaya)
  echo "текущая версия (источник $ISTOCHNIK): ${V:-не найдена}"
  echo
  echo "вытекает в:"
  echo "  package.json                  $(sed -n 's/^  "version": "\([^"]*\)",$/version \1/p' package.json)"
  echo "  $REPL  $(sed -n 's/^#define FLANG_VERSION "\([^"]*\)".*/FLANG_VERSION \1/p' "$REPL")"
  echo "  $MAN               .TH $(grep -oE 'flang [0-9]+\.[0-9]+\.[0-9]+' "$MAN" | sort -u | tr '\n' ' ')"
  echo "  $FORMULA  $(sed -n 's/^  version "\([^"]*\)".*/version \1/p' "$FORMULA")"
  echo
  echo "поднять: ./ярлык версия <НОВОЕ ЧИСЛО>   (например ./ярлык версия 0.7.13)"
  exit 0
fi

# ── проверка вида числа ──────────────────────────────────────────────────────
case $NOVAYA in
  *[!0-9.]* | *..* | .* | *. )
    echo "версия «$NOVAYA» не похожа на X.Y.Z — ждал три числа через точку, например 0.7.13" >&2
    exit 2 ;;
esac
echo "$NOVAYA" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$' || {
  echo "версия «$NOVAYA» не похожа на X.Y.Z — ждал три числа через точку, например 0.7.13" >&2
  exit 2
}

STARAYA=$(tekushchaya)
echo "версия: $STARAYA → $NOVAYA"

# ── источник: тело функции «Версия» и её пример ─────────────────────────────
sed -i -E 's/^  "[0-9]+\.[0-9]+\.[0-9]+"$/  "'"$NOVAYA"'"/' "$ISTOCHNIK"
sed -i -E 's/^    ожидается "[0-9]+\.[0-9]+\.[0-9]+"$/    ожидается "'"$NOVAYA"'"/' "$ISTOCHNIK"

# ── #define в C: генерируется, не читается из файла ─────────────────────────
sed -i -E 's/^#define FLANG_VERSION "[0-9]+\.[0-9]+\.[0-9]+"$/#define FLANG_VERSION "'"$NOVAYA"'"/' "$REPL"

# ── страница man: .TH и обе расшифровки «flang X.Y.Z» (FLANG заглавными не тронут) ─
sed -i -E 's/flang [0-9]+\.[0-9]+\.[0-9]+/flang '"$NOVAYA"'/g' "$MAN"

# ── формула Homebrew: version, тег и имя архива в url. sha256 НЕ трогаем ─────
sed -i -E 's/^  version "[0-9]+\.[0-9]+\.[0-9]+"$/  version "'"$NOVAYA"'"/' "$FORMULA"
sed -i -E 's#/download/v[0-9]+\.[0-9]+\.[0-9]+/flang-[0-9]+\.[0-9]+\.[0-9]+-c\.tar\.gz#/download/v'"$NOVAYA"'/flang-'"$NOVAYA"'-c.tar.gz#' "$FORMULA"

# ── package.json: перепечатать из источника (знак-в-знак, как ждёт пакет:проверка) ─
if [ -x "$BINARY" ]; then
  "$BINARY" io "$ISTOCHNIK" --plan 'Напечатать пакет' >/dev/null 2>&1 \
    && echo "package.json перепечатан из источника" \
    || { echo "package.json перепечатать не удалось — запустите вручную: ./ярлык пакет" >&2; exit 3; }
else
  # двоичного нет: правим одно поле напрямую, а знак-в-знак допечатает ярлык пакет
  sed -i -E 's/^  "version": "[0-9]+\.[0-9]+\.[0-9]+",$/  "version": "'"$NOVAYA"'",/' package.json
  echo "package.json: version поправлена напрямую (нет $BINARY). Перепечатайте знак-в-знак: ./ярлык пакет"
fi

echo
echo "готово. Проверить сведение: sh scripts/version-derivations-guard.sh"
echo "Не поднято намеренно (это делает выпуск): sha256 формулы, changelog.json, семя bootstrap/flang_repl.c."
exit 0
