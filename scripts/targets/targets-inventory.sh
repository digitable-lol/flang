#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
# Опись целей: имя, код, время, причина — таблица markdown как docs/ci-inventory.md (294 строк,
# СНЯТО 2026-09-26 строк docs/ci-inventory.md = 294 (задача 4413: строка про снятый ярлык доказательства:пустота; до неё 288, снято 2026-08-31) Снятая
# руками, та опись не повторяется). Код 75 вместе со строкой отказа ворот = «переснять», не вердикт.
# Звать: sh scripts/targets/targets-inventory.sh [имя …]   все цели из ярлыки.flang или названные;
#   VOROTA, PAMYAT (45G), VYVOD (/srv/tmp/opis-celey) — ворота, память, сырой вывод. Код 0.
# см. docs/zettel/the-gate-passes-the-command-exit-code-through-so-75-alone-proves-nothing.md
set -u

VOROTA=${VOROTA:-/srv/flang-rabota/vorota/flang-vorota}
PAMYAT=${PAMYAT:-45G}
export PAMYAT
OTKAZ_VOROT='место не освободилось, прогон не начат'
VYVOD=${VYVOD:-/srv/tmp/opis-celey}
mkdir -p "$VYVOD"

names() {
  if [ $# -gt 0 ]; then printf '%s\n' "$@"; return; fi
  sed -n 's/.*«имя» равным "\([^"]*\)".*/\1/p' ярлыки.flang
}

run_one() {
  imya=$1
  syroy="$VYVOD/$(printf '%s' "$imya" | tr '/:' '__').txt"
  nachalo=$(date +%s)
  "$VOROTA" -- ./ярлык "$imya" > "$syroy" 2>&1
  kod=$?
  sek=$(( $(date +%s) - nachalo ))
  if [ "$kod" -eq 75 ] && grep -qF "$OTKAZ_VOROT" "$syroy"; then
    echo "переснять|$sek|ворота места не дали — прогон не запускался, это НЕ вердикт цели"
    return
  fi
  prichina=$(grep -oE 'FLANG_[A-Z_]+[^"]*' "$syroy" | head -1)
  echo "$kod|$sek|${prichina:-}"
}

printf '| # | цель | код | время | причина |\n|---:|---|---|---:|---|\n'
n=0
PERESNYAT=0
for imya in $(names "$@"); do
  n=$((n + 1))
  otvet=$(run_one "$imya")
  kod=${otvet%%|*}; ost=${otvet#*|}; sek=${ost%%|*}; prichina=${ost#*|}
  [ "$kod" = "переснять" ] && PERESNYAT=$((PERESNYAT + 1))
  printf '| %s | `%s` | %s | %s с | %s |\n' "$n" "$imya" "$kod" "$sek" "$prichina"
done
printf '\nЦелей снято: %s. Из них ждали слота дольше срока и требуют пересъёма: %s.\n' "$n" "$PERESNYAT"
printf 'Сырой вывод каждой цели: %s\n' "$VYVOD"
