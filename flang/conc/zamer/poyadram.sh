#!/bin/bash
# Растёт ли пропускная способность с числом потоков.
#
# Тот же стенд, тот же предел пробегов, меняется одно — поле «workers» в запросе.
# Печатается: сколько потоков, настенное время, пробегов в секунду и во сколько
# раз быстрее одного потока. Настенное, а не процессорное: вопрос стенда —
# «быстрее ли стало», а процессорное время многопоточного прогона по
# определению больше, и сравнивать по нему значило бы мерить не то.
#
# Минимум из REP повторов: помеха может замер только удлинить.
#
# $1 каталог сборки, $2 предел пробегов, дальше — числа потоков.
# PROCS — предел числа процессов (нужен стендам с порождением).
set -u
source "$(dirname "${BASH_SOURCE[0]}")/obshchee.sh"
DIR=$(stend "$1"); shift
TURNS=$1; shift
REP=${REP:-3}
PROCS=${PROCS:-0}
MORE=""
if [ "$PROCS" != 0 ]; then MORE=",\"processes\":\"$PROCS\""; fi

echo "--- $DIR  пробегов $TURNS, повторов $REP"
printf '%8s %10s %14s %10s %8s\n' потоков "настен,с" "пробегов/с" "раз" "цпу,%"
BASE=""
for W in "$@"; do
  REQ="{\"run\":\"стенд\",\"seed\":\"1\",\"turns\":\"$TURNS\",\"journal\":\"0\",\"workers\":\"$W\"$MORE}"
  BEST=""
  CPU=""
  ERR=$(mktemp)
  for _ in $(seq 1 "$REP"); do
    echo "$REQ" | /usr/bin/time -f '%e %P' "$DIR/flang_cli" > /dev/null 2>"$ERR"
    code=$?
    if [ $code -ne 0 ]; then echo "ОТКАЗ код=$code"; cat "$ERR"; rm -f "$ERR"; exit $code; fi
    read -r w p < <(tail -1 "$ERR")
    if [ -z "$BEST" ] || [ 1 -eq "$(awk -v x="$w" -v y="$BEST" 'BEGIN{print (x<y)?1:0}')" ]; then
      BEST=$w; CPU=$p
    fi
  done
  rm -f "$ERR"
  if [ -z "$BASE" ]; then BASE=$BEST; fi
  awk -v w="$W" -v t="$BEST" -v turns="$TURNS" -v base="$BASE" -v cpu="$CPU" \
    'BEGIN { printf "%8s %10.3f %14.0f %9.2fx %8s\n", w, t, turns / t, base / t, cpu }'
done
