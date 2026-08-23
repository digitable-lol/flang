#!/bin/sh
set -u
KOREN=/srv/flang-rabota/u-uslovno
VYHOD=$KOREN/schet/vedomosti-dop
f=$1
imya=$(echo "$f" | tr '/' '~')
/srv/flang-rabota/vorota/flang-vorota -- "$KOREN/bootstrap/flang" check --proof --json "$KOREN/$f" \
  > "$VYHOD/$imya.json" 2> "$VYHOD/$imya.err"
kod=$?
echo "$kod" > "$VYHOD/$imya.kod"
echo "$imya код=$kod размер=$(wc -c < "$VYHOD/$imya.json")"
