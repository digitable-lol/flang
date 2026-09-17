#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# В каком состоянии перепечатка — по её журналу: стадия (из четырёх), место в
# ней по отметкам хода «шагов … идёт «…»» (по одной в 30 с, в stderr) и конец
# печати по строкам «ПЕЧАТЬ КОД=» (договор) или «КОНЕЦ … код=» (наблюдение).
#
# Как звать:  sh scripts/seed/print-progress.sh <журнал печати>   (снятый с 2>&1)
#
# Коды: 0 — стадия названа или печать кончилась успехом; 1 — кончилась не успехом;
#       2 — звать не умеют; 3 — НЕ ПРОВЕРЕНО: журнала нет, пуст, отметок нет,
#       стадия образцу неизвестна или строка конца спорит с «Exit status:».
# Образец (2 сентября 2026, af791d85; четвёртая стадия не досчитана — её длина
# нижняя граница) и источники строк:
#   docs/zettel/the-reprint-step-counter-resets-per-stage-so-progress-is-read-from-tick-marks.md
set -u

OBRAZEC_SVYAZAT=17
OBRAZEC_TOTAL=1
OBRAZEC_SUD=1469
OBRAZEC_PECHAT=133          # нижняя граница: стадия не досчитана
OBRAZEC_VSEGO=1620          # сумма, тоже нижняя граница

[ $# -eq 1 ] || { echo "звать: sh scripts/seed/print-progress.sh <журнал печати>" >&2; exit 2; }
LOG=$1
[ -f "$LOG" ] || { echo "НЕ ПРОВЕРЕНО: журнала нет — $LOG" >&2; exit 3; }
[ -s "$LOG" ] || { echo "НЕ ПРОВЕРЕНО: журнал пуст — $LOG" >&2; exit 3; }

KOD=""; OTKUDA=""
if LC_ALL=C.UTF-8 /usr/bin/grep -aq 'ПЕЧАТЬ КОД=[0-9]' "$LOG"; then
  OTKUDA='ПЕЧАТЬ КОД='
  KOD=$(LC_ALL=C.UTF-8 /usr/bin/grep -ao 'ПЕЧАТЬ КОД=[0-9][0-9]*' "$LOG" | tail -1 | sed 's/.*=//')
elif LC_ALL=C.UTF-8 /usr/bin/grep -aq '^КОНЕЦ' "$LOG"; then
  OTKUDA='КОНЕЦ … код='
  KOD=$(LC_ALL=C.UTF-8 /usr/bin/grep -a '^КОНЕЦ' "$LOG" \
        | LC_ALL=C.UTF-8 /usr/bin/grep -ao 'код=[0-9][0-9]*' | tail -1 | sed 's/.*=//')
  VYHOD=$(LC_ALL=C.UTF-8 /usr/bin/grep -a 'Exit status:' "$LOG" | tail -1 \
          | sed 's/.*Exit status:[[:space:]]*//')
  if [ -n "$KOD" ] && [ -n "$VYHOD" ] && [ "$VYHOD" != "$KOD" ]; then
    echo "НЕ ПРОВЕРЕНО: журнал сам себе противоречит — «КОНЕЦ … код=$KOD» против" >&2
    echo "  «Exit status: $VYHOD» ($LOG). Так соврал" >&2
    echo "  /srv/tmp/relizy/perepechatka-zahod1-ubita.log: код=0 на убитом прогоне." >&2
    echo "  Пусть допишет «ПЕЧАТЬ КОД=<код>» тот, кто печать пустил." >&2
    exit 3
  fi
fi
if [ -n "$KOD" ]; then
  if [ "$KOD" = 0 ]; then
    echo "ПЕЧАТЬ КОНЧИЛАСЬ УСПЕХОМ (по строке «$OTKUDA$KOD»)."
    echo "Переснять образец этого прибора — он устарел."
    exit 0
  fi
  echo "ПЕЧАТЬ КОНЧИЛАСЬ НЕ УСПЕХОМ: код $KOD (по строке «$OTKUDA»)" >&2
  exit 1
fi

OTMETOK=$(LC_ALL=C.UTF-8 /usr/bin/grep -ac '^шагов ' "$LOG" || true)
[ "${OTMETOK:-0}" -gt 0 ] || {
  echo "НЕ ПРОВЕРЕНО: отметок «шагов … из …, идёт «…»» в журнале нет — $LOG" >&2
  echo "  Либо печать ещё не дошла до первого именованного шага (первая отметка" >&2
  echo "  встаёт через 30 с работы шага, flang_repl.c:1501), либо журнал снят БЕЗ" >&2
  echo "  stderr: отметки идут в дескриптор 2 (flang_repl.c:1557), и без «2>&1»" >&2
  echo "  их в журнале не будет ни одной." >&2
  echo "  Строки конца («ПЕЧАТЬ КОД=» или «КОНЕЦ … код=») тут тоже нет." >&2
  exit 3; }

STADIYA=$(LC_ALL=C.UTF-8 /usr/bin/grep -ao 'идёт «[^»]*»' "$LOG" | tail -1 | sed 's/^идёт «//;s/»$//')
V_STADII=$(LC_ALL=C.UTF-8 /usr/bin/grep -ac "идёт «$STADIYA»" "$LOG")

case "$STADIYA" in
  "Связать исходники")     NOMER=1; DLINA=$OBRAZEC_SVYAZAT; PROSHLO=0 ;;
  "Проверить тотальность") NOMER=2; DLINA=$OBRAZEC_TOTAL;   PROSHLO=$OBRAZEC_SVYAZAT ;;
  "Суд ядра о программе")  NOMER=3; DLINA=$OBRAZEC_SUD;     PROSHLO=$((OBRAZEC_SVYAZAT + OBRAZEC_TOTAL)) ;;
  "Напечатать связанное")  NOMER=4; DLINA=$OBRAZEC_PECHAT;  PROSHLO=$((OBRAZEC_SVYAZAT + OBRAZEC_TOTAL + OBRAZEC_SUD)) ;;
  *) echo "НЕ ПРОВЕРЕНО: стадия «$STADIYA» образцу неизвестна — образец устарел" >&2; exit 3 ;;
esac

echo "стадия $NOMER из 4: «$STADIYA»"
echo "  отметок в стадии: $V_STADII из ~$DLINA по образцу"
if [ "$V_STADII" -le "$DLINA" ]; then
  echo "  в стадии пройдено: ~$(( V_STADII * 100 / DLINA )) %"
else
  echo "  в стадии пройдено: БОЛЬШЕ образца ($V_STADII против $DLINA) — этот прогон дороже образцового"
fi
echo "  по всей печати:    ~$(( (PROSHLO + V_STADII) * 100 / OBRAZEC_VSEGO )) % (образец не досчитан, потому это ВЕРХНЯЯ оценка)"
[ "$NOMER" = 4 ] && echo "  ВНИМАНИЕ: длина четвёртой стадии в образце — нижняя граница, конца её никто не видел"
exit 0
