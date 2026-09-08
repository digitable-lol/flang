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
#   packaging/homebrew-tap/Formula/flang.rb — то же, в рабочей копии сабмодуля
#       крана (если развёрнут): чтобы кран не отстал молча, как отставал
#       шесть выпусков подряд (0.7.4–0.7.10). Коммит и push в кране и подъём
#       указателя сабмодуля — руками, шаги печатаются в конце.
#   packaging/asdf-plugin/ — сабмодуль плагина asdf (digitable-lol/asdf-flang).
#       Числа версии в нём НЕТ: bin/list-all спрашивает выпуски у GitHub. Скрипт
#       его не правит, а СВЕРЯЕТ с packaging/asdf и, если копия отстала,
#       печатает шаги (тот же порядок, что у крана). Судья — `плагин:проверка`.
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
KRAN=packaging/homebrew-tap/Formula/flang.rb
PLAGIN=packaging/asdf-plugin
BINARY=bootstrap/flang

tekushchaya() {
  grep -oE '^  "[0-9]+\.[0-9]+\.[0-9]+"$' "$ISTOCHNIK" | tr -d ' "' | head -1
}

# Плагин asdf: версии в нём нет, сверяются сами файлы. Печатает одну строку
# состояния; коды: 0 совпал, 1 отстал (файлы названы), 2 не развёрнут.
plagin_sostoyanie() {
  if [ ! -f "$PLAGIN/README.md" ]; then
    echo "  $PLAGIN/  НЕ РАЗВЁРНУТ: git submodule update --init $PLAGIN"
    return 2
  fi
  otstali=
  for f in README.md bin/download bin/install bin/list-all; do
    cmp -s "packaging/asdf/$f" "$PLAGIN/$f" || otstali="$otstali $f"
  done
  if [ -n "$otstali" ]; then
    echo "  $PLAGIN/  ОТСТАЛ от packaging/asdf:$otstali  (сабмодуль $(git -C "$PLAGIN" rev-parse --short HEAD 2>/dev/null))"
    return 1
  fi
  echo "  $PLAGIN/  совпадает с packaging/asdf  (плагин asdf, сабмодуль $(git -C "$PLAGIN" rev-parse --short HEAD 2>/dev/null))"
  return 0
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
  if [ -f "$KRAN" ]; then
    echo "  $KRAN  $(sed -n 's/^  version "\([^"]*\)".*/version \1/p' "$KRAN")  (кран, сабмодуль $(git -C packaging/homebrew-tap rev-parse --short HEAD 2>/dev/null))"
  else
    echo "  $KRAN  НЕ РАЗВЁРНУТ: git submodule update --init packaging/homebrew-tap"
  fi
  plagin_sostoyanie || true
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

# ── формула в кране (сабмодуль): те же два числа, sha256 так же НЕ трогаем ──
if [ -f "$KRAN" ]; then
  sed -i -E 's/^  version "[0-9]+\.[0-9]+\.[0-9]+"$/  version "'"$NOVAYA"'"/' "$KRAN"
  sed -i -E 's#/download/v[0-9]+\.[0-9]+\.[0-9]+/flang-[0-9]+\.[0-9]+\.[0-9]+-c\.tar\.gz#/download/v'"$NOVAYA"'/flang-'"$NOVAYA"'-c.tar.gz#' "$KRAN"
else
  echo "кран $KRAN НЕ РАЗВЁРНУТ — не поднят. Разверните и повторите: git submodule update --init packaging/homebrew-tap" >&2
fi

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
echo
echo "Кран Homebrew (сабмодуль packaging/homebrew-tap) — ПОСЛЕ того, как sha256 архива вписан в $FORMULA:"
echo "  cp $FORMULA $KRAN"
echo "  git -C packaging/homebrew-tap commit -am 'flang $NOVAYA: url, sha256, version' && git -C packaging/homebrew-tap push origin main"
echo "  git add packaging/homebrew-tap   # указатель сабмодуля — в тот же коммит выпуска"
echo "Пока указатель не поднят, «формула:проверка» и release.yml КРАСНЫ — это и есть защита от забытого крана."
echo
echo "Плагин asdf (сабмодуль $PLAGIN) — числа версии в нём нет, поднимать нечего; сверка файлов:"
if plagin_sostoyanie; then
  echo "  трогать нечего."
else
  echo "  cp -R packaging/asdf/. $PLAGIN/"
  echo "  git -C $PLAGIN commit -am 'Плагин догнал packaging/asdf (flang $NOVAYA)' && git -C $PLAGIN push origin main"
  echo "  git add $PLAGIN   # указатель сабмодуля — в тот же коммит выпуска"
  echo "Пока указатель не поднят, «плагин:проверка» и release.yml КРАСНЫ — это и есть защита от забытого плагина."
fi
exit 0
