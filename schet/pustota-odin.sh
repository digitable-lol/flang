#!/bin/sh
set -u
KOREN=/srv/flang-rabota/u-uslovno
MODUL=$1
FUNK=$2
KLYUCH=$(printf '%s' "$MODUL~$FUNK" | tr ' /' '_.')
D="$KOREN/schet/pustota/$KLYUCH"
rm -rf "$D"; mkdir -p "$D"
python3 "$KOREN/schet/podmena.py" "$KOREN/flang/stdlib" "$MODUL" "$FUNK" "$D" 2> "$D/podmena.err" \
  || { echo "$KLYUCH ПОДМЕНА-НЕ-ВЫШЛА: $(cat $D/podmena.err)"; exit 3; }
/srv/flang-rabota/vorota/flang-vorota -- "$KOREN/bootstrap/flang" check --proof --json "$D/$MODUL.flang" > "$D/out.json" 2> "$D/out.err"
kod=$?
echo "$kod" > "$D/kod"
find "$D" -name '*.flang' ! -name "$MODUL.flang" -delete
echo "$KLYUCH код=$kod размер=$(wc -c < "$D/out.json")"
