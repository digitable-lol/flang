#!/bin/sh
# Кого пересчитать: те подмены, чей файл сегодняшняя оснастка собирает ИНАЧЕ,
# чем собрала в первый раз (разбор шапки правился по ходу).
set -eu
KOREN=/srv/flang-rabota/u-uslovno
V=$(mktemp -d -p /srv/tmp u-sverka.XXXX)
: > "$KOREN/schet/pereproverit.spisok"
while IFS='	' read -r m f; do
  [ "$f" = "-" ] && continue
  k=$(printf '%s' "$m~$f" | tr ' /' '_.')
  staryy="$KOREN/schet/pustota/$k/$m.flang"
  [ -f "$staryy" ] || { printf '%s\t%s\n' "$m" "$f" >> "$KOREN/schet/pereproverit.spisok"; continue; }
  rm -rf "$V/$k"; mkdir -p "$V/$k"
  python3 "$KOREN/schet/podmena.py" "$KOREN/flang/stdlib" "$m" "$f" "$V/$k" 2>/dev/null || {
    printf '%s\t%s\n' "$m" "$f" >> "$KOREN/schet/pereproverit.spisok"; continue; }
  cmp -s "$V/$k/$m.flang" "$staryy" || printf '%s\t%s\n' "$m" "$f" >> "$KOREN/schet/pereproverit.spisok"
done < "$KOREN/schet/pustota.rabota"
rm -rf "$V"
wc -l < "$KOREN/schet/pereproverit.spisok"
