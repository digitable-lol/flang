#!/bin/sh
# Три печати одним двоичным: без кеша, с холодным кешем, с горячим.
#
#   sh benchmarks/кеш-приговоров/три-печати.sh [<рабочий каталог>]
#
# Порог, ради которого это меряют: холодный кеш не медленнее, чем без кеша,
# более чем на 10 %; горячий на НЕИЗМЕННОМ дереве — быстрее не менее чем вдвое;
# семя после каждой печати обязано совпасть с тем, что напечатано без кеша, —
# иначе кеш поменял приговоры, а это негодная работа.
#
# Имена переменных латиницей: оболочка кириллицу в них не берёт.
set -u
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(CDPATH= cd -- "$HERE/../.." && pwd)
RAB=${1:-$(mktemp -d)}
mkdir -p "$RAB"
LOG=$RAB/три-печати.log
LC_ALL=C.UTF-8
export LC_ALL
: > "$LOG"

SEMYA="Makefile compiler_flang.c compiler_flang.h flang_cli.c flang_repl.c flang_runtime.c flang_runtime.h"

skazat() { printf '%s\n' "$*" | tee -a "$LOG"; }

snyat_etalon() {
  mkdir -p "$RAB/эталон"
  for N in $SEMYA; do cp "$ROOT/bootstrap/$N" "$RAB/эталон/$N"; done
}

sverit_semya() { # <метка>
  BAD=0
  for N in $SEMYA; do
    cmp -s "$RAB/эталон/$N" "$ROOT/bootstrap/$N" || { skazat "    РАЗОШЛОСЬ: $N"; BAD=$((BAD + 1)); }
  done
  skazat "  семя после «$1»: расхождений $BAD из 7 файлов"
}

snyat_etalon
skazat "═══ печать БЕЗ кеша (знаменатель, тот же двоичный) ═══"
NACHALO=$(date +%s)
timeout 7200 sh "$ROOT/scripts/raskrutka.sh" > "$RAB/печать-без-кеша.out" 2> "$RAB/печать-без-кеша.err"
KOD=$?
BEZ=$(($(date +%s) - NACHALO))
skazat "  без кеша: код=$KOD секунд=$BEZ"
sverit_semya "без кеша"

skazat "═══ печать с ХОЛОДНЫМ кешем ═══"
rm -f "$RAB/кеш-печати.json"
NACHALO=$(date +%s)
FLANG_KESH_PRIGOVOROV=$RAB/кеш-печати.json timeout 7200 sh "$ROOT/scripts/raskrutka.sh" \
  > "$RAB/печать-холодная.out" 2> "$RAB/печать-холодная.err"
KOD=$?
HOLODNAYA=$(($(date +%s) - NACHALO))
skazat "  холодная: код=$KOD секунд=$HOLODNAYA кеш=$(wc -c < "$RAB/кеш-печати.json" 2>/dev/null || echo 0) байт"
sverit_semya "холодная"

skazat "═══ печать с ГОРЯЧИМ кешем ═══"
NACHALO=$(date +%s)
FLANG_KESH_PRIGOVOROV=$RAB/кеш-печати.json timeout 7200 sh "$ROOT/scripts/raskrutka.sh" \
  > "$RAB/печать-горячая.out" 2> "$RAB/печать-горячая.err"
KOD=$?
GORYACHAYA=$(($(date +%s) - NACHALO))
skazat "  горячая: код=$KOD секунд=$GORYACHAYA кеш=$(wc -c < "$RAB/кеш-печати.json" 2>/dev/null || echo 0) байт"
sverit_semya "горячая"

skazat "═══ ИТОГ ═══"
skazat "  без кеша $BEZ с; холодный $HOLODNAYA с; горячий $GORYACHAYA с"
