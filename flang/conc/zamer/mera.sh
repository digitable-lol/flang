#!/bin/bash
# Один замер стенда, REPEAT повторов.
# Печатает по строке на повтор: «wall user sys maxRSSkb minflt cpu%».
# maxRSS в этой среде считается с шагом 2 МиБ (мелкие процессы дают 0), поэтому
# рядом печатаются мелкие промахи страниц: они целые и точные, страница 4 КиБ.
# $1 каталог сборки, $2 предел пробегов, $3 журнал (0|1), $4 повторов,
# $5 предел числа процессов (для стенда «рой»; ноль — умолчание планировщика)
set -u
DIR=$1; TURNS=$2; JOURNAL=${3:-0}; REPEAT=${4:-5}; PROCS=${5:-0}
# Поле «processes» дописывается только когда его просят: стенды, собранные ДО
# шага Б1, неизвестного поля не понимают и отвечают отказом, а сравнивать «до» и
# «после» надо одним и тем же скриптом.
MORE=""
if [ "$PROCS" != 0 ]; then MORE=",\"processes\":\"$PROCS\""; fi
REQ="{\"run\":\"стенд\",\"seed\":\"1\",\"turns\":\"$TURNS\",\"journal\":\"$JOURNAL\"$MORE}"
ERR=$(mktemp)
for i in $(seq 1 "$REPEAT"); do
  echo "$REQ" | /usr/bin/time -v "$DIR/flang_cli" > /dev/null 2>"$ERR"
  code=$?
  if [ $code -ne 0 ]; then echo "ОТКАЗ код=$code"; cat "$ERR"; rm -f "$ERR"; exit $code; fi
  awk '
    /Elapsed \(wall/ {w=$NF}
    /User time/ {u=$NF}
    /System time/ {s=$NF}
    /Maximum resident/ {m=$NF}
    /Minor \(reclaiming/ {f=$NF}
    /Percent of CPU/ {p=$NF}
    END {print w, u, s, m, f, p}
  ' "$ERR"
done
rm -f "$ERR"
