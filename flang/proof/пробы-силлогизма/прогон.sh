#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# ПРОБЫ СИЛЛОГИЗМА (ADR-0046, задача 5309).
#
#   sh flang/proof/пробы-силлогизма/прогон.sh            двоичным: замер «до»
#   sh flang/proof/пробы-силлогизма/прогон.sh --зондом   толкованием исходников
#   RABOTA=<каталог> sh flang/proof/пробы-силлогизма/прогон.sh --по-записям
#       сверить уже снятые записи зонда заново, не считая их второй раз.
#
# Код 0 — сошлось всё; 1 — хоть одна проба разошлась, и она названа строкой;
# 2 — не смог измерить (нет двоичного, нет таблицы).
#
# ── ДВА ПУТИ, И ПОЧЕМУ ИХ ДВА ───────────────────────────────────────────────
# Слова поверхности `род` и `следует` живут в печатаемой части семени
# (`flang/self/lexer.flang`, `flang/self/parser.flang`). Правка там доезжает до
# `bootstrap/flang` только полной перепечаткой (`scripts/raskrutka.sh`, около
# 11 часов). До неё двоичный этих слов не знает и отвечает отказом разбора — и
# первый путь ЖДЁТ ИМЕННО ЭТОГО: столбец «слово двоичного» в ОЖИДАНИЕ.tsv
# заполнен отказом, а не вердиктом. Зелёный двоичный здесь означал бы, что
# замер снят не с той сборки.
#
# Второй путь толкует исходники компилятора зондом `flang/self/bootstrap/
# zond-k7.flang` тем же двоичным: он отдаёт ведомость `check --proof` словами,
# посчитанную ИСПРАВЛЕННЫМ компилятором. Это замер «после» без перепечатки.
# Цена, снятая 19 сентября 2026 на этом дереве: около сорока минут и 18 ГиБ на
# программу (у `пробы-запуска`, где зонд только запускает, — десять минут и
# 12 ГиБ; здесь дороже, потому что считается вся ведомость доказательств).
# Поэтому зондов идёт не больше двух разом (PARALLEL=N меняет), и запись
# каждого остаётся в каталоге $RABOTA — её можно пересверить `--по-записям`.
#
# Имена переменных латиницей: ни dash, ни bash не принимают кириллицу в именах.
set -u

KOREN=$(CDPATH= cd -- "$(dirname -- "$0")/../../.." && pwd)
FLANG=${FLANG:-$KOREN/bootstrap/flang}
PROBY=$KOREN/flang/proof/пробы-силлогизма
ZOND=$KOREN/flang/self/bootstrap/zond-k7.flang
TABLICA=$PROBY/ОЖИДАНИЕ.tsv
PARALLEL=${PARALLEL:-2}
RABOTA=${RABOTA:-$(mktemp -d -p "${FLANG_TMP:-/srv/tmp}" proby-sillogizma.XXXXXX)}
export LC_ALL=C.UTF-8

ZONDOM=0
PO_ZAPISYAM=0
[ "${1:-}" = "--зондом" ] && ZONDOM=1
[ "${1:-}" = "--по-записям" ] && { ZONDOM=1; PO_ZAPISYAM=1; }
[ -x "$FLANG" ] || { echo "нет двоичного: $FLANG" >&2; exit 2; }
[ -f "$TABLICA" ] || { echo "нет таблицы: $TABLICA" >&2; exit 2; }

# Одна проба двоичным: код и вывод читаются вместе, вывод — в одну строку.
proba_binary() { # программа → печатает вывод одной строкой
  out=$("$FLANG" check "$PROBY/программы/$1" --proof 2>&1)
  printf '%s' "$out" | tr '\n' ' '
}

# Одна проба зондом: довод — JSON с путём и текстом программы.
proba_zond() { # программа → файл записи
  f=$PROBY/программы/$1; zap=$RABOTA/$1.зонд.txt
  [ "$PO_ZAPISYAM" = "1" ] && { echo "$zap"; return; }
  args=$(python3 -c '
import json,sys
p,f=sys.argv[1],sys.argv[2]
print(json.dumps({"путь": p, "текст": open(f, encoding="utf-8").read()}, ensure_ascii=False))' "$1" "$f")
  { /usr/bin/time -f 'зонд: %es, пик %M КБ, код %x' \
      "$FLANG" run "$ZOND" --function "«Проверка зонда К7»" --max-steps 2000000000 --args "$args"; } > "$zap" 2>&1
  echo "$zap"
}

BAD=0
VSEGO=0
say() { printf '%s\n' "$*"; }

say "таблица: $TABLICA"
say "путь: $([ "$ZONDOM" = "1" ] && echo 'зондом (толкование исходников)' || echo 'двоичным (замер «до»)')"
[ "$ZONDOM" = "1" ] && say "работа: $RABOTA"
say ""

# Зондом — очередями по PARALLEL: каждый прогон берёт около 18 ГиБ.
if [ "$ZONDOM" = "1" ] && [ "$PO_ZAPISYAM" = "0" ]; then
  SCHET=0
  while IFS="	" read -r prog slovo_bin slovo_zond; do
    case "$prog" in \#*|programma|программа|"") continue ;; esac
    : "$slovo_bin" "$slovo_zond"
    proba_zond "$prog" > /dev/null &
    SCHET=$((SCHET + 1))
    [ "$((SCHET % PARALLEL))" -eq 0 ] && wait
  done < "$TABLICA"
  wait
fi

while IFS="	" read -r prog slovo_bin slovo_zond; do
  case "$prog" in \#*|programma|программа|"") continue ;; esac
  VSEGO=$((VSEGO + 1))
  if [ "$ZONDOM" = "1" ]; then
    zhdyom=$slovo_zond
    vyvod=$(tr '\n' ' ' < "$(proba_zond "$prog")")
  else
    zhdyom=$slovo_bin
    vyvod=$(proba_binary "$prog")
  fi
  case "$vyvod" in
    *"$zhdyom"*) say "СОШЛОСЬ  $prog — «$zhdyom»" ;;
    *)           say "ПРОВАЛ   $prog — ждали «$zhdyom»"
                 say "         получили: $(printf '%s' "$vyvod" | cut -c1-260)"
                 BAD=$((BAD + 1)) ;;
  esac
done < "$TABLICA"

say ""
if [ "$BAD" -eq 0 ]; then
  say "сошлось всё: проб $VSEGO"
  exit 0
fi
say "разошлось $BAD из $VSEGO"
exit 1
