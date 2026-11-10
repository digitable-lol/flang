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
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
VID=$1; shift
K=${K:-}
TYAZH=${TYAZH:-}
METKA=$VID
if [ -n "$K" ]; then METKA="$VID-k$K"; fi
if [ -n "$TYAZH" ]; then METKA="$METKA-t$TYAZH"; fi
for N in "$@"; do
  "$FLANG/bootstrap/flang" io "$FLANG/flang/concurrency/bench/gen.flang" --max-steps 200000000000 --max-depth 3000000 -- "n=$N" "вид=$VID" ${K:+"k=$K"} ${TYAZH:+"тяж=$TYAZH"} "выход=$ZAMER/$METKA-$N.flang" > "$ZAMER/$METKA-$N.gen.log" 2>&1
  printf '%s N=%s ' "$METKA" "$N"
  "$FLANG/bootstrap/flang" emit "$ZAMER/$METKA-$N.flang" --target c --out "$ZAMER/b-$METKA-$N" > "$ZAMER/b-$METKA-$N.log" 2>&1 && make -C "$ZAMER/b-$METKA-$N" >> "$ZAMER/b-$METKA-$N.log" 2>&1
  printf 'исходник %s байт, двоичный %s байт\n' "$(wc -c < "$ZAMER/$METKA-$N.flang")" "$(wc -c < "$ZAMER/b-$METKA-$N/flang_cli")"
done
