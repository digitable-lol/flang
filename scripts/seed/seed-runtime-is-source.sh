#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# Семя рантайма — это источник (flang/src/emit/c/*) плюс шапка, и больше ничего.
# Сторож проверяет, что приём «шапка + источник» ещё законен: первая строка
# источника есть в семени. Отставание тел — сведение, не беда.
#
# Как звать:  sh scripts/seed/semya-rantayma-eto-istochnik.sh [--после-печати]
#   со ключом — сразу после печати: семя обязано совпасть с источником полностью.
#
# Коды: 0 — приём законен (в строгом ладу — совпало полностью); 1 — приём сломан
#       (в строгом ладу — разошлось); 2 — непонятный ключ; 5 — нет корня/времянки.
# см. docs/zettel/the-runtime-seed-is-the-source-plus-a-header-and-lagging-mid-work-is-normal.md
set -u
STROGO=0
for d in "$@"; do
  case "$d" in
    --после-печати) STROGO=1 ;;
    *) printf 'непонятный ключ: %s (знаю только --после-печати)\n' "$d" >&2; exit 2 ;;
  esac
done
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
cd "$ROOT" || exit 5
RAB=${FLANG_TMP:-/srv/tmp}/semya-rantayma.$$
mkdir -p "$RAB" || exit 5
trap 'rm -rf "$RAB"' EXIT INT TERM
BEDA=0
VERSIY=0
OTSTALO=0
for b in flang_repl.c flang_cli.c flang_runtime.c flang_runtime.h; do
  SEMYA=bootstrap/$b
  IST=flang/src/emit/c/$b
  if [ ! -f "$SEMYA" ] || [ ! -f "$IST" ]; then
    printf 'НЕТ ФАЙЛА: %s или %s\n' "$SEMYA" "$IST" >&2
    BEDA=$((BEDA+1)); continue
  fi
  PERV=$(head -1 "$IST")
  N=$(LC_ALL=C.UTF-8 grep -n -m1 -F -x -- "$PERV" "$SEMYA" | cut -d: -f1)
  if [ -z "$N" ]; then
    printf 'ПРИЁМ БОЛЬШЕ НЕ ЗАКОНЕН: %s — первой строки источника в семени нет вовсе\n' "$b" >&2
    BEDA=$((BEDA+1)); continue
  fi
  tail -n +"$N" "$SEMYA" > "$RAB/telo"
  diff "$RAB/telo" "$IST" > "$RAB/razn" 2>&1
  # Строки расхождения, кроме именованного послабления про версию.
  PROCHIE=$(LC_ALL=C.UTF-8 grep '^[<>]' "$RAB/razn" \
            | LC_ALL=C.UTF-8 grep -cv '^[<>] #define FLANG_VERSION ' || true)
  VER=$(LC_ALL=C.UTF-8 grep -c '^[<>] #define FLANG_VERSION ' "$RAB/razn" || true)
  VERSIY=$((VERSIY+VER))
  printf '%-18s шапка %2d строк, тело отстало на %s строк' "$b" "$((N-1))" "$PROCHIE"
  if [ "$VER" -gt 0 ]; then printf ', плюс версия'; fi
  printf '\n'
  OTSTALO=$((OTSTALO+PROCHIE+VER))
  if [ "$STROGO" = 1 ] && [ "$((PROCHIE+VER))" -gt 0 ]; then
    LC_ALL=C.UTF-8 grep '^[<>]' "$RAB/razn" | head -20 >&2
    BEDA=$((BEDA+1))
  fi
done
if [ "$BEDA" -gt 0 ]; then
  if [ "$STROGO" = 1 ]; then
    printf '\nПОСЛЕ ПЕЧАТИ СЕМЯ ОБЯЗАНО СОВПАСТЬ С ИСТОЧНИКОМ, а разошлось в %d\n' "$BEDA" >&2
    printf 'файл(е/ах). Либо печать копирует уже не дословно, либо источник\n' >&2
    printf 'правили ПОСЛЕ того, как печать началась.\n' >&2
  else
    printf '\nПРИЁМ «ШАПКА + ИСТОЧНИК» БОЛЬШЕ НЕ ЗАКОНЕН: в %d файл(е/ах) первой\n' "$BEDA" >&2
    printf 'строки источника в семени нет вовсе. Значит печать копирует рантайм\n' >&2
    printf 'уже не дословно, и правку в нём без перепечатки проверить нельзя.\n' >&2
  fi
  exit 1
fi
printf '\nприём «шапка + источник» законен: первая строка источника найдена во всех четырёх'
if [ "$OTSTALO" -gt 0 ]; then
  printf '\nсемя отстало от источника на %d строк — это НОРМА посреди правки,' "$OTSTALO"
  printf '\nсойдётся перепечаткой; после неё звать с --после-печати'
else
  printf '\nсемя совпадает с источником полностью'
fi
printf '\n'
exit 0
