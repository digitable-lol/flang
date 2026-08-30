#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# СНЯТЬ ВЕДОМОСТЬ ОДНОГО ФАЙЛА И ПОСЧИТАТЬ ДОЛЮ САМОГО ФАЙЛА.
#
#   sh scripts/take-proof-ledger.sh flang/stdlib/aes.flang [каталог выходов]
#
# Кладёт рядом четыре файла — `<имя>.json` (ведомость), `.err` (строки хода и
# отказы), `.time` (стенные часы и пик занятой памяти), `.kod` (код возврата) —
# и печатает долю САМОГО файла, отделённую от ввезённого
# (`scripts/proved-share-of-a-file.py`). Складывать строки «итог:» нельзя: они
# берут замыкание ввоза и завышают — по дереву в 2,47 раза, на ядре в 34,2.
#
# Переменные:
#   DVOICHNYY        двоичный; умолчание — `<дерево>-ledger-binary/flang`,
#                    собранный `scripts/build-ledger-binary.sh`
#   VYHOD            каталог выходов; умолчание — второй довод или /tmp/…
#   PAMYAT PIK       ворота: адресное пространство (умолчание 45G) и ЗАМЕРЕННЫЙ
#                    пик — PIK передаётся, только если назван: врать в нём
#                    значит отнимать память у соседей по очереди
#   PREDEL_SHAGOV    `--предел-шагов N`; по умолчанию НЕ ставится
#   PREDEL_GLUBINY   `--предел-глубины N`; по умолчанию НЕ ставится
#
# ⚠ ОБА КЛЮЧА ЗАДАЮТ ПРЕДЕЛ, А НЕ ПОДНИМАЮТ ЕГО. Поставить «с запасом» число
# меньше вшитого — значит ОПУСТИТЬ предел и уронить прогон в FLANG_RECURSION_LIMIT
# на ровном месте. Вшитое умолчание стоит в `bootstrap/flang_runtime.h`
# (FL_MAX_STEPS, FL_MAX_DEPTH) и растёт с каждой перепечаткой; скрипт сверяет
# заданное с ним и говорит вслух, если ключ предел опускает.
set -u

koren=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
fajl=${1:-}
if [ -z "$fajl" ]; then
  echo 'не назван файл. Пример: sh scripts/take-proof-ledger.sh flang/stdlib/aes.flang' >&2
  exit 2
fi
test -f "$koren/$fajl" || test -f "$fajl" || { echo "нет файла $fajl" >&2; exit 2; }

dvoichnyy=${DVOICHNYY:-$koren-ledger-binary/flang}
test -x "$dvoichnyy" || {
  echo "нет двоичного $dvoichnyy — соберите: sh scripts/build-ledger-binary.sh" >&2
  exit 2
}

vyhod=${2:-${VYHOD:-$koren-ledger-binary/vedomosti}}
mkdir -p "$vyhod" || exit 2
slug=$(printf '%s' "$fajl" | tr '/' '_')

# Сверка ключей со вшитым умолчанием: ключ ЗАДАЁТ предел. Умолчание читается из
# шапки ТОГО семени, из которого собран ЭТОТ двоичный (она лежит рядом с ним в
# каталоге сборки), а не из нынешнего `bootstrap/`: у двоичного недельной
# давности пределы свои, и сверять его с сегодняшним семенем — врать.
shapka=$(dirname "$dvoichnyy")/flang_runtime.h
test -f "$shapka" || shapka=$koren/bootstrap/flang_runtime.h
vshito() {
  sed -n "s/^#define $1 \\([0-9][0-9]*\\)\$/\\1/p" "$shapka" | head -1
}
klyuchi=''
if [ -n "${PREDEL_SHAGOV:-}" ]; then
  bylo=$(vshito FL_MAX_STEPS)
  if [ -n "$bylo" ] && [ "$PREDEL_SHAGOV" -lt "$bylo" ] 2>/dev/null; then
    echo "ВНИМАНИЕ: --предел-шагов $PREDEL_SHAGOV ОПУСКАЕТ вшитый предел $bylo, а не поднимает" >&2
  fi
  klyuchi="$klyuchi --предел-шагов $PREDEL_SHAGOV"
fi
if [ -n "${PREDEL_GLUBINY:-}" ]; then
  bylo=$(vshito FL_MAX_DEPTH)
  if [ -n "$bylo" ] && [ "$PREDEL_GLUBINY" -lt "$bylo" ] 2>/dev/null; then
    echo "ВНИМАНИЕ: --предел-глубины $PREDEL_GLUBINY ОПУСКАЕТ вшитый предел $bylo, а не поднимает" >&2
  fi
  klyuchi="$klyuchi --предел-глубины $PREDEL_GLUBINY"
fi

vorota=/srv/flang-rabota/vorota/flang-vorota
cd "$koren" || exit 2

echo "снимаю ведомость: $fajl"
echo "двоичный: $dvoichnyy ($(md5sum "$dvoichnyy" | cut -d' ' -f1))"
echo "ключи: --proof --json$klyuchi"

# shellcheck disable=SC2086
if [ -x "$vorota" ]; then
  /usr/bin/time -f 'ZAMER %e %M' -o "$vyhod/$slug.time" \
    env PAMYAT="${PAMYAT:-45G}" ${PIK:+PIK="$PIK"} "$vorota" -- \
    "$dvoichnyy" check "$fajl" --proof --json $klyuchi \
    > "$vyhod/$slug.json" 2> "$vyhod/$slug.err"
  kod=$?
else
  echo "ворот $vorota нет — прогон идёт напрямую" >&2
  /usr/bin/time -f 'ZAMER %e %M' -o "$vyhod/$slug.time" \
    "$dvoichnyy" check "$fajl" --proof --json $klyuchi \
    > "$vyhod/$slug.json" 2> "$vyhod/$slug.err"
  kod=$?
fi
echo "код $kod $(cat "$vyhod/$slug.time" 2>/dev/null)" > "$vyhod/$slug.kod"
cat "$vyhod/$slug.kod"

if [ "$kod" -ne 0 ]; then
  echo '--- последние строки .err ---'
  tail -5 "$vyhod/$slug.err"
  echo 'ведомость не снята: доля файла не считается по неполному выходу' >&2
  exit "$kod"
fi

python3 "$koren/scripts/proved-share-of-a-file.py" "$fajl" "$vyhod/$slug.json"
