#!/bin/sh
# Снять ведомость (--proof --json) со всех файлов библиотеки одним двоичным.
# Зовут: sh snyat.sh <двоичный> <куда>
set -u
DVOICH=$1
KUDA=$2
mkdir -p "$KUDA"
for f in /srv/flang-rabota/u-uslovno2/flang/stdlib/*.flang; do
  imya=$(basename "$f" .flang)
  ( PAMYAT=60G /srv/flang-rabota/vorota/flang-vorota -- "$DVOICH" check --proof --json "$f" \
      > "$KUDA/$imya.json" 2> "$KUDA/$imya.err"
    echo "$?" > "$KUDA/$imya.kod" ) &
done
wait
echo "снято: $(ls "$KUDA"/*.json | wc -l)"
