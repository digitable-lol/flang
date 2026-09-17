#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# Приёмка нового двоичного после перепечатки семени (задача 0043): шесть примет
# с числами «было»; примета без материала говорит «не снята», а не «сошлась».
#
# Как звать:  sh scripts/seed/new-binary-acceptance.sh [дерево перепечатки]
#   умолчание — /srv/flang-rabota/u-semya5; прогоны идут через ворота памяти.
#
# Коды: 0 — все приметы сошлись; 1 — хоть одна нет, каждая названа;
#       2 — двоичного нет, приёмка не состоялась («не проверено», а не «не принят»).
# см. docs/zettel/an-acceptance-sign-without-material-must-say-not-taken-not-passed.md
set -u

D=${1:-/srv/flang-rabota/u-semya5}
DVOICHNYY="$D/bootstrap/flang"
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
PROBA=$ROOT/scripts/seed/new-binary-acceptance-probe.flang
BED=0

TMPD=$(mktemp -d -p "${FLANG_TMP:-/srv/tmp}" new-binary-acceptance.XXXXXX)
trap 'rm -rf "$TMPD"' EXIT INT TERM

say()  { printf '\n=== %s\n' "$*"; }
bad()  { printf '  ✗ %s\n' "$*"; BED=$((BED+1)); }
good() { printf '  ✓ %s\n' "$*"; }

skolko() { grep -c "$1" "$2" 2>/dev/null || true; }

# Прогон через ворота, вывод — в $TMPD/vyvod, код команды — в $KOD.
progon() {
  pamyat=$1
  shift
  PAMYAT=$pamyat timeout 900 /srv/flang-rabota/vorota/flang-vorota -- "$@" \
    > "$TMPD/vyvod" 2>&1
  KOD=$?
  case $KOD in
    75)  bad "ворота не дали места (код 75) — ОТКАЗ ВОРОТ, а не приговор двоичному; повторить примету"
         sed 's/^/    /' "$TMPD/vyvod"
         return 1 ;;
    124) bad "прогон не уложился в 900 с — примета НЕ СНЯТА, судить по ней нельзя"
         return 1 ;;
  esac
  return 0
}

say "ЧЕМ КОНЧИЛАСЬ ПЕЧАТЬ"
tail -5 /srv/work/semya5.log 2>/dev/null || echo "  журнала печати нет"

if pgrep -f 'scripts/raskrutka\.sh' >/dev/null 2>&1; then
  printf '\n  ⚠ ПЕРЕПЕЧАТКА ЕЩЁ ИДЁТ — строки выше это шапка захода, а не его итог.\n'
fi

if [ ! -x "$DVOICHNYY" ]; then
  printf '\nПРИЁМКА НЕ СОСТОЯЛАСЬ: двоичного нет — %s\n' "$DVOICHNYY"
  printf 'Ни одна примета не снята; это не «НЕ ПРИНЯТ», это «принимать нечего».\n'
  printf 'Приёмку звать после того, как перепечатка дошла И СЕМЯ СОБРАНО:\n'
  printf '  make -C %s/bootstrap -j8      (минута, 1,05 ГиБ)\n' "$D"
  exit 2
fi
printf '\nдвоичный: %s\n' "$DVOICHNYY"
"$DVOICHNYY" --version 2>&1 | head -1

# ── ПРИМЕТА 1: печать конкурентности в C появилась ──────────────────────────
say "ПРИМЕТА 1 — печать конкурентности в C"
IMENA=$(nm -a "$DVOICHNYY" 2>/dev/null | grep -o 'compiler_flang_[a-z_]*konkurentnost[a-z_]*' | sort -u)
printf '%s\n' "$IMENA" | sed 's/^/    /'
if printf '%s\n' "$IMENA" | grep -q '_c$'; then good "имя с «_c» есть"; else bad "имени с «_c» НЕТ (было так же)"; fi

# ── ПРИМЕТА 2: вердикт «доказано ПРИ УСЛОВИИ» появился ──────────────────────
say "ПРИМЕТА 2 — вердикт «доказано ПРИ УСЛОВИИ»"
N=$(skolko 'ПРИ УСЛОВИИ' "$D/bootstrap/compiler_flang.c")
echo "    вхождений: ${N:-нет файла}   (было 0)"
if [ "${N:-0}" -gt 0 ] 2>/dev/null
  then good "вердикт появился"
  else bad "вердикта НЕТ — все числа дерева остаются верхней оценкой"
fi

# ── ПРИМЕТА 3: строка хода появилась (задача 0031) ──────────────────────────
say "ПРИМЕТА 3 — строка хода"
strings "$DVOICHNYY" > "$TMPD/stroki" 2>/dev/null || true
N=$(skolko 'шагов .* из .*, идёт' "$TMPD/stroki")
echo "    вхождений: ${N:-0}   (было 0)"
if [ "${N:-0}" -gt 0 ] 2>/dev/null
  then good "девятичасовая работа перестала быть слепой"
  else bad "строки хода НЕТ"
fi

# ── ПРИМЕТА 4: правила ядра РАБОТАЮТ, а не просто напечатались ──────────────
say "ПРИМЕТА 4 — правила ядра работают (прогон, а не таблица имён)"
if progon 45G "$DVOICHNYY" check "$PROBA" --proof; then
  ITOG=$(grep -E '^ *утверждений' "$TMPD/vyvod" | tail -1)
  echo "    ${ITOG:-(итога нет)}"
  echo "    было: утверждений 4: доказано 0, сетка 0, объявлено, не доказано 4"
  DOK=$(printf '%s\n' "$ITOG" | sed -n 's/^ *утверждений [0-9]*: доказано \([0-9][0-9]*\).*/\1/p')
  case "${DOK:-нет}" in
    нет) bad "проба не дала итога вовсе" ;;
    0)   bad "ни одно правило не заработало — семя не догнало исходники" ;;
    4)   good "все четыре правила ядра доехали" ;;
    *)   good "правил ядра доехало $DOK из 4 — часть, как проба и допускает; какие именно, смотреть в ведомости" ;;
  esac
fi

# ── ПРИМЕТА 5: двоичный читает свежие исходники ────────────────────────────
say "ПРИМЕТА 5 — двоичный читает исходники со свежими типами"
OBRAZ=
for kandidat in "$D/flang/self/interpret.flang" "$ROOT/flang/self/interpret.flang"; do
  [ -f "$kandidat" ] || continue
  skolkoNashlos=$(skolko 'Узел хеша» от' "$kandidat")
  [ "${skolkoNashlos:-0}" -gt 0 ] 2>/dev/null || continue
  OBRAZ=$kandidat
  break
done
if [ -z "$OBRAZ" ]; then
  bad "проверить НЕЧЕМ: параметрического типа нет ни в дереве перепечатки, ни в дереве приёмки — примета не снята"
else
  echo "    образец: $OBRAZ ($(skolko 'Узел хеша» от' "$OBRAZ") вхождений параметрического типа)"
  if progon 60G "$DVOICHNYY" check "$OBRAZ"; then
    OTVET=$(grep -E 'FLANG_TYPE_ARGS|замечаний нет' "$TMPD/vyvod" | head -1)
    echo "    ${OTVET:-(ответа нет)}"
    case "$OTVET" in
      *FLANG_TYPE_ARGS*) bad "параметрические типы по-прежнему не понимает" ;;
      *"замечаний нет"*) good "читает" ;;
      *) bad "ответ не распознан — смотреть руками, вывод целиком выше"
         tail -3 "$TMPD/vyvod" | sed 's/^/    /' ;;
    esac
  fi
fi

# ── ПРИМЕТА 6: не сломан ли он вовсе ───────────────────────────────────────
say "ПРИМЕТА 6 — не сломан на живом файле"
if progon 45G "$DVOICHNYY" check "$D/flang/stdlib/hashmap.flang" --proof; then
  OTVET=$(tail -2 "$TMPD/vyvod")
  printf '%s\n' "$OTVET" | sed 's/^/    /'
  case "$OTVET" in
    *FLANG_PROPERTY*|*FLANG_INTERNAL*) bad "падает — принимать НЕЛЬЗЯ" ;;
    *утверждений*) good "считает" ;;
    *) bad "ответ не распознан" ;;
  esac
fi

say "ИТОГ"
if [ "$BED" -eq 0 ]; then
  echo "  все приметы сошлись. Дальше: sh scripts/raskrutka.sh --bystro —"
  echo "  сверить, что семя больше не отстаёт (было 41 расхождение)."
  echo "  ⛔ Приёмная коммиты с bootstrap/** из веток ОТВЕРГАЕТ: семя кладётся"
  echo "  в ствол не через неё. Спросить владельца приёмной, как именно."
  exit 0
fi
echo "  примет не сошлось: $BED. Двоичный НЕ ПРИНЯТ."
exit 1
