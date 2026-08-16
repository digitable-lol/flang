#!/bin/bash
# Занимает ли планировщик ядра. Одна и та же работа: сначала одним прогоном,
# потом K ОДНОВРЕМЕННЫМИ копиями того же двоичника. Если копии идут за то же
# время, что одна, значит ядра были свободны — и планировщик их не берёт.
set -u
source "$(dirname "${BASH_SOURCE[0]}")/obshchee.sh"
DIR=$(stend "${1:-b-пинг-0}"); TURNS=${2:-4000000}; K=${3:-8}
REQ="{\"run\":\"стенд\",\"seed\":\"1\",\"turns\":\"$TURNS\",\"journal\":\"0\"}"
echo "одна копия:"
for i in 1 2 3; do
  echo "$REQ" | /usr/bin/time -f '  настенных %e, процессорных %U, ядро %P' "$DIR/flang_cli" > /dev/null
done
echo "$K копий разом (настенное время всей пачки):"
for j in 1 2 3; do
  T0=$(date +%s.%N)
  for i in $(seq 1 "$K"); do echo "$REQ" | "$DIR/flang_cli" > /dev/null & done
  wait
  T1=$(date +%s.%N)
  awk -v a="$T0" -v b="$T1" "BEGIN{printf \"  пачка из %s: %.2f с\n\", $K, b-a}"
done
