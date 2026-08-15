#!/bin/bash
# Собрать стенд: $1 — вид (тихо|ждут|цепь|пинг|пингконец), остальные — размеры N.
# Исходники и сборки кладутся в $ZAMER (по умолчанию — текущий каталог): на
# миллионе процессов это 166 МБ исходника и 129 МБ двоичника, и в дереве им не
# место.
set -eu
export LC_ALL=C.UTF-8
source "$(dirname "${BASH_SOURCE[0]}")/obshchee.sh"
VID=$1; shift
for N in "$@"; do
  node "$FLANG/flang/conc/zamer/gen.mjs" --n="$N" --вид="$VID" --out="$ZAMER/$VID-$N.flang"
  printf '%s N=%s ' "$VID" "$N"
  node "$FLANG/flang/conc/zamer/build.mjs" --root="$FLANG" --src="$ZAMER/$VID-$N.flang" --dir="$ZAMER/b-$VID-$N"
done
