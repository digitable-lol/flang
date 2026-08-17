#!/bin/bash
# Собрать стенд: $1 — вид (тихо|ждут|цепь|пинг|пингконец|пары|пачка), остальные —
# размеры N.
# Исходники и сборки кладутся в $ZAMER (по умолчанию — текущий каталог): на
# миллионе процессов это 166 МБ исходника и 129 МБ двоичника, и в дереве им не
# место.
#
# K — сколько пробегов приходится на одну передачу процесса потоку; значит он
# только стенду «пачка» (шаг Д1 карты). Когда он назван, он входит и в ИМЯ
# сборки: два стенда с разным K — это два разных двоичника, и складывать их в
# один каталог значило бы мерить один, думая про другой.
set -eu
export LC_ALL=C.UTF-8
source "$(dirname "${BASH_SOURCE[0]}")/obshchee.sh"
VID=$1; shift
K=${K:-}
TYAZH=${TYAZH:-}
METKA=$VID
if [ -n "$K" ]; then METKA="$VID-k$K"; fi
if [ -n "$TYAZH" ]; then METKA="$METKA-t$TYAZH"; fi
for N in "$@"; do
  node "$FLANG/flang/conc/zamer/gen.mjs" --n="$N" --вид="$VID" ${K:+--k="$K"} ${TYAZH:+--тяж="$TYAZH"} \
    --out="$ZAMER/$METKA-$N.flang"
  printf '%s N=%s ' "$METKA" "$N"
  node "$FLANG/flang/conc/zamer/build.mjs" --root="$FLANG" --src="$ZAMER/$METKA-$N.flang" --dir="$ZAMER/b-$METKA-$N"
done
