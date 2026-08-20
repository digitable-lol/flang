#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# Перепечатка точки раскрутки `bootstrap/` — САМИМ ДВОИЧНЫМ, без Node.
#
# ── Зачем этот файл ─────────────────────────────────────────────────────────
# Компилятор написан на самом языке (`flang/self/`), а в дереве лежит уже
# напечатанным в C99 (`bootstrap/`). До этого файла перепечатать точку раскрутки
# можно было ровно одним способом — `node scripts/bootstrap-c.mjs`, — то есть
# Node лежал на пути СБОРКИ языка, а не только в проверках. Пока это так,
# реализацию на JavaScript нельзя удалить физически: без неё дерево не
# восстановить из исходников.
#
# Здесь тот же круг замкнут без Node. Курица и яйцо решается тем, что двоичный
# уже лежит в дереве собранным: `make -C bootstrap` даёт `bootstrap/flang`, и
# он умеет печатать компилятор в C (`flang emit --target c`, реализовано в
# `flang/src/emit/c/flang_repl.c`).
#
# ── Как пользоваться ────────────────────────────────────────────────────────
#   sh scripts/bootstrap-c.sh            перепечатать bootstrap/ двоичным
#   sh scripts/bootstrap-c.sh --check    сверить закоммиченное с печатью, код 1 при расхождении
#
#   FLANG=/путь/к/flang sh scripts/bootstrap-c.sh    печатать заданным двоичным
#   MAKE=gmake CC=clang  sh scripts/bootstrap-c.sh    чем собирать, если двоичного нет
#
# ── Ступени, как у всякой раскрутки ─────────────────────────────────────────
# Печатает СТУПЕНЬ N (двоичный, собранный из того, что лежит в дереве сейчас), а
# печатает она СЕГОДНЯШНИЕ исходники. Если правка тронула сам слой печати
# (`flang/self/emit-c.flang`), одного захода мало: первый заход даёт печать по
# старым правилам от новых исходников. Тогда — пересобрать и перепечатать ещё
# раз, пока два захода подряд не дадут одно и то же. Скрипт об этом говорит сам:
# после записи он называет, сколько файлов тронуто.
#
# ── Рецепт печати: ЕДИНСТВЕННАЯ ЗАПИСЬ ──────────────────────────────────────
# Пределы попадают прямо в напечатанный байт (`#define FL_MAX_STEPS` в
# `bootstrap/flang_runtime.h`), поэтому совпадение байт в байт точки раскрутки,
# релизного архива и обеих сторон сверки держится на том, что число ровно одно.
# Записаны они ЗДЕСЬ, а не в скрипте на JavaScript, ровно потому, что этот файл
# переживёт удаление реализации на JavaScript, а тот — нет.
# `scripts/bootstrap-c.mjs` читает их отсюда, пока жив (`ПРЕДЕЛЫ`).
set -eu

FLANG_ENTRY='flang/self/bootstrap/compiler.flang'
FLANG_OUT='bootstrap'
FLANG_RUNTIME_SRC='flang/src/emit/c'
FLANG_MAX_STEPS='40000000'
FLANG_MAX_DEPTH='20000'
# Что в `bootstrap/` НЕ относится к печати: проза и продукты сборки. Тот же
# список, что `НЕ_ТОЧКА` в `scripts/bootstrap-c.mjs`.
FLANG_NOT_EMITTED='README.md flang flang.exe flang_cli flang_cli.exe libcompiler_flang.a'

koren=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$koren"

sverit=0
if [ "${1:-}" = '--check' ]; then
  sverit=1
elif [ $# -gt 0 ]; then
  echo "bootstrap-c.sh: непонятный ключ «$1»; есть один — «--check»" >&2
  exit 2
fi

# ── двоичный: заданный снаружи или собранный из точки раскрутки ─────────────
: "${MAKE:=make}"
dvoichnyy="${FLANG:-}"
if [ -z "$dvoichnyy" ]; then
  dvoichnyy="$koren/$FLANG_OUT/flang"
  if [ ! -x "$dvoichnyy" ]; then
    echo "двоичного нет — собираю точку раскрутки: $MAKE -C $FLANG_OUT"
    "$MAKE" -C "$FLANG_OUT" >/dev/null
  fi
fi
if [ ! -x "$dvoichnyy" ]; then
  echo "bootstrap-c.sh: не найден двоичный «$dvoichnyy». Соберите его: $MAKE -C $FLANG_OUT" >&2
  exit 2
fi

kuda=$(mktemp -d "${TMPDIR:-/tmp}/flang-tochka.XXXXXX")
trap 'rm -rf "$kuda"' EXIT INT TERM

echo "компилятор: $FLANG_ENTRY"
echo "печатает:   $dvoichnyy"
"$dvoichnyy" emit "$FLANG_ENTRY" \
  --target c \
  --cli \
  --repl \
  --max-steps "$FLANG_MAX_STEPS" \
  --max-depth "$FLANG_MAX_DEPTH" \
  --runtime "$FLANG_RUNTIME_SRC" \
  --out "$kuda"

# ── сверка набора файлов и байтов ───────────────────────────────────────────
# Сверяется и НАБОР: файл, оставшийся в `bootstrap/` от прошлой печати, — такая
# же ложь, как разошедшееся содержимое, и `cc *.c` соберёт его вместе с
# остальным.
bed=0
vsego=0
troputo=0

lishnie=''
for put in "$koren/$FLANG_OUT"/*; do
  imya=$(basename -- "$put")
  case " $FLANG_NOT_EMITTED " in *" $imya "*) continue ;; esac
  case "$imya" in *.o|*.obj|*.a|*.d) continue ;; esac
  [ -e "$kuda/$imya" ] && continue
  lishnie="$lishnie $imya"
done

for put in "$kuda"/*; do
  imya=$(basename -- "$put")
  bayt=$(wc -c <"$put")
  vsego=$((vsego + bayt))
  if [ ! -e "$koren/$FLANG_OUT/$imya" ]; then
    echo "  $FLANG_OUT/$imya: печать даёт $bayt байт, а в дереве файла нет" >&2
    bed=$((bed + 1))
    troputo=$((troputo + 1))
    [ "$sverit" = 1 ] || cp -- "$put" "$koren/$FLANG_OUT/$imya"
    continue
  fi
  if cmp -s -- "$put" "$koren/$FLANG_OUT/$imya"; then
    continue
  fi
  bylo=$(wc -c <"$koren/$FLANG_OUT/$imya")
  echo "  $FLANG_OUT/$imya: в дереве $bylo байт, печать даёт $bayt" >&2
  bed=$((bed + 1))
  troputo=$((troputo + 1))
  [ "$sverit" = 1 ] || cp -- "$put" "$koren/$FLANG_OUT/$imya"
done

for imya in $lishnie; do
  echo "  $FLANG_OUT/$imya: лежит в дереве, но печать его не даёт — след прошлой перепечатки" >&2
  bed=$((bed + 1))
  troputo=$((troputo + 1))
  [ "$sverit" = 1 ] || rm -f -- "$koren/$FLANG_OUT/$imya"
done

fajlov=$(ls -1 "$kuda" | wc -l | tr -d ' ')

if [ "$sverit" = 1 ]; then
  if [ "$bed" = 0 ]; then
    echo "точка раскрутки $FLANG_OUT/ совпадает с печатью двоичного: $fajlov файлов, $vsego байт"
    exit 0
  fi
  echo "точка раскрутки $FLANG_OUT/ разошлась с печатью двоичного — расхождений $bed" >&2
  echo "Перепечатайте её в том же коммите, что и правку компилятора: sh scripts/bootstrap-c.sh" >&2
  exit 1
fi

echo "итого $fajlov файлов, $vsego байт в $FLANG_OUT/; тронуто $troputo"
if [ "$troputo" != 0 ]; then
  echo "печать тронула $troputo файлов — пересоберите двоичный и перепечатайте ещё раз,"
  echo "пока два захода подряд не дадут одно и то же: $MAKE -C $FLANG_OUT && sh scripts/bootstrap-c.sh --check"
fi
echo "сборка без Node: $MAKE -C $FLANG_OUT"
