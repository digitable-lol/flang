#!/bin/sh
# Снять ведомости НОВЫМ двоичным. Не более 4 разом — ворота общие.
set -u
DVOICH=$1
KUDA=$2
mkdir -p "$KUDA"
for f in /srv/flang-rabota/u-uslovno2/flang/stdlib/*.flang; do
  imya=$(basename "$f" .flang)
  [ -s "$KUDA/$imya.json" ] && continue
  printf '%s\n' "$f"
done | xargs -I{} -P 4 sh -c '
  f={}; imya=$(basename "$f" .flang)
  PAMYAT=60G ZHDAT=7200 /srv/flang-rabota/vorota/flang-vorota -- "$0" check --proof --json "$f" \
    > "$1/$imya.json" 2> "$1/$imya.err"
  echo "$? $imya"
' "$DVOICH" "$KUDA"
echo "готово"
