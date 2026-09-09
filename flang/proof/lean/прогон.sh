#!/bin/sh
# Сверка правил вывода flang ядром Lean 4.
#
# Гонит три вещи и печатает ЧИСЛА:
#   1) собирается ли «Модель.lean» и «Правила.lean» — то есть принял ли Lean
#      наши леммы;
#   2) отвергает ли Lean КАЖДОЕ из нарочно испорченных правил в «Ловушка.lean»
#      — каждое подаётся отдельным файлом, чтобы отказ был именно на нём;
#   3) сколько строк перечня переведено, а сколько нет.
#
# Lean в дереве не лежит и не должен. Путь к нему берётся из переменной LEAN
# либо из PATH. Без Lean прогон честно говорит, что ничего не проверил.
set -u

KAT=$(cd "$(dirname "$0")" && pwd)
VED="$KAT/../ПРАВИЛА-ВЫВОДА.tsv"
RAB=${FLANG_TMP:-/tmp}/lean-sverka.$$
LEAN=${LEAN:-lean}

if ! command -v "$LEAN" >/dev/null 2>&1; then
  echo "Lean не найден: ни в переменной LEAN, ни в PATH."
  echo "НИЧЕГО НЕ ПРОВЕРЕНО. Поставить: elan toolchain install stable."
  exit 2
fi

mkdir -p "$RAB" || exit 1
trap 'rm -rf "$RAB"' EXIT INT TERM

echo "Lean: $("$LEAN" --version)"
echo

# ── 1. модель и правила ─────────────────────────────────────────────────────
if ! (cd "$KAT" && "$LEAN" -o "$RAB/Модель.olean" Модель.lean) > "$RAB/m.out" 2>&1; then
  echo "МОДЕЛЬ НЕ СОБРАЛАСЬ:"; cat "$RAB/m.out"; exit 1
fi
echo "модель — собралась"

LEAN_PATH="$RAB"; export LEAN_PATH
if (cd "$KAT" && "$LEAN" Правила.lean) > "$RAB/p.out" 2>&1; then
  echo "правила — Lean принял ВСЕ леммы файла Правила.lean"
else
  echo "правила — Lean ОТВЕРГ часть лемм:"; cat "$RAB/p.out"; exit 1
fi

# ── 2. ловушка: каждое искажение отдельным файлом ───────────────────────────
awk -v rab="$RAB" 'BEGIN{n=0}
     /ИСКАЖЕНИЕ/{n++}
     {if (n==0) print > (rab "/шапка.lean"); else print > (rab "/иск" n ".lean")}' \
  "$KAT/Ловушка.lean"

VSEGO=0; OTVERGNUTO=0
for f in "$RAB"/иск*.lean; do
  [ -f "$f" ] || continue
  VSEGO=$((VSEGO+1))
  cat "$RAB/шапка.lean" "$f" > "$RAB/проба.lean"
  if (cd "$RAB" && "$LEAN" проба.lean) > "$RAB/l.out" 2>&1; then
    echo "  ЛОВУШКА НЕ СРАБОТАЛА: Lean ПРИНЯЛ искажение из $(basename "$f")"
  else
    OTVERGNUTO=$((OTVERGNUTO+1))
  fi
done
echo "ловушка — искажений $VSEGO, Lean отверг $OTVERGNUTO"

# ── 3. счёт строк перечня ─────────────────────────────────────────────────
STROK=$(awk -F'\t' 'NF>11 && $1 !~ /^#/ {n++} END{print n+0}' "$VED")
LEMM=$(grep -c '^theorem «' "$KAT/Правила.lean")
echo "перечень — строк $STROK"
echo "правила    — лемм в файле $LEMM"

if [ "$OTVERGNUTO" -eq "$VSEGO" ] && [ "$VSEGO" -gt 0 ]; then
  echo
  echo "сошлось всё"
  exit 0
fi
echo
echo "НЕ СОШЛОСЬ"
exit 1
