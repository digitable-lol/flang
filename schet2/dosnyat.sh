#!/bin/sh
# Доснять ведомости только тех файлов, у кого json пуст. Не более 4 разом:
# ворота общие, и главный прогон (перепечатка семени) не должен их ждать.
set -u
DVOICH=$1
KUDA=$2
mkdir -p "$KUDA"
spisok=""
for f in /srv/flang-rabota/u-uslovno2/flang/stdlib/*.flang; do
  imya=$(basename "$f" .flang)
  [ -s "$KUDA/$imya.json" ] && continue
  spisok="$spisok $f"
done
printf '%s\n' $spisok | xargs -I{} -P 6 sh -c '
  f={}; imya=$(basename "$f" .flang)
  PAMYAT=60G CHISLO=30 POROG=120G ZHDAT=7200 /srv/flang-rabota/vorota/flang-vorota -- "$0" check --proof --json "$f" \
    > "$1/$imya.json" 2> "$1/$imya.err"
  echo "$? $imya"
' "$DVOICH" "$KUDA"
echo "готово"
