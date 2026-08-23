#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# ПОДДЕЛКА И ЧЕСТНАЯ ПОЛОВИНА правила «равенство, решённое счётом замкнутых
# частей» — настоящим прогоном, а не описанием.
#
#   sh flang/proof/подделки/счёт-частей.sh
#   код 0 — все шесть лжей отвергнуты И все четыре правды доказаны;
#   код 1 — что-то из этого неверно, и оно названо строкой.
#
# ОБЕ ПОЛОВИНЫ ОБЯЗАТЕЛЬНЫ. Правило, отвергающее всё подряд, выглядело бы
# исправным на одних подделках; правило, доказывающее всё подряд, хуже
# отсутствующего. Одна половина без другой не значит ничего.
#
# Имена переменных латиницей: ни dash, ни bash не принимают кириллицу в именах.
set -u

KOREN=$(CDPATH= cd -- "$(dirname -- "$0")/../../.." && pwd)
FLANG=${FLANG:-$KOREN/bootstrap/flang}
LOZH=$KOREN/flang/proof/подделки/счёт-частей-ложь.flang
PRAVDA=$KOREN/flang/proof/подделки/счёт-частей-правда.flang

[ -x "$FLANG" ] || { echo "двоичного нет: $FLANG" >&2; exit 2; }

RABOTA=$(mktemp -d -p "${FLANG_TMP:-/srv/tmp}" schyot.XXXXXX)
trap 'rm -rf "$RABOTA"' EXIT INT TERM

BAD=0
say() { printf '%s\n' "$*"; }

# Вердикт одного утверждения: строка ведомости, начинающаяся с его имени.
verdikt() {
  otchyot=$1; imya=$2
  stroka=$(grep -F "постусловие «$imya» функции" "$otchyot" | head -1)
  if [ -z "$stroka" ]; then printf 'НЕТ В ОТЧЁТЕ'; return; fi
  case "$stroka" in
    *"— доказано"*) printf 'доказано' ;;
    *) printf 'не доказано' ;;
  esac
}

# Один опыт: отчёт, имя утверждения, ожидаемый вердикт.
sprosit() {
  otchyot=$1; imya=$2; zhdyom=$3
  bylo=$(verdikt "$otchyot" "$imya")
  if [ "$bylo" = "$zhdyom" ]; then
    say "СОШЛОСЬ  «$imya» — $bylo, как и ждали"
  else
    say "ПРОВАЛ   «$imya» — ждали «$zhdyom», получили «$bylo»"
    BAD=$((BAD + 1))
  fi
}

say "── ПОДДЕЛКА: шесть лжей, и ни одна не смеет быть доказана ──"
"$FLANG" check "$LOZH" --proof > "$RABOTA/ложь" 2>&1
say "flang check $LOZH --proof → код $?"
sprosit "$RABOTA/ложь" "перенос скобок ничего не меняет" "не доказано"
sprosit "$RABOTA/ложь" "одна десятая и две десятых дают три десятых" "не доказано"
sprosit "$RABOTA/ложь" "ноль со знаком есть ноль" "не доказано"
sprosit "$RABOTA/ложь" "бесконечности сокращаются в ноль" "не доказано"
sprosit "$RABOTA/ложь" "что угодно есть ноль" "не доказано"
sprosit "$RABOTA/ложь" "минус ноль есть ноль" "не доказано"

say ""
say "── ЧЕСТНАЯ ПОЛОВИНА: четыре правды, и каждая обязана быть доказана ──"
"$FLANG" check "$PRAVDA" --proof > "$RABOTA/правда" 2>&1
say "flang check $PRAVDA --proof → код $?"
sprosit "$RABOTA/правда" "прибавлено ровно пятьдесят" "доказано"
sprosit "$RABOTA/правда" "прибавлена ровно единица" "доказано"
sprosit "$RABOTA/правда" "прибавлен ровно код буквы А" "доказано"
sprosit "$RABOTA/правда" "прибавлено ровно сто двадцать" "доказано"

say ""
if [ "$BAD" -eq 0 ]; then
  say "сошлось всё: шесть подделок отвергнуты, четыре честных доказаны"
  exit 0
fi
say "опытов не сошлось: $BAD"
exit 1
