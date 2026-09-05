#!/bin/sh
# СЕМЯ РАНТАЙМА — ЭТО ИСТОЧНИК ПЛЮС ШАПКА, И БОЛЬШЕ НИЧЕГО.
#
# ЗАЧЕМ. В дереве держат правило «источник ≠ семя»: правка в flang/self/**
# не значит ничего, пока не пройдёт перепечатка, а она идёт часами. За одни
# сутки на этом потеряли время пятеро — правили и мерили несобранное.
#
# Но на файлы РАНТАЙМА (flang/src/emit/c/*) правило не распространяется:
# печать копирует их дословно, приписывая сверху свою шапку. Значит правку
# в рантайме можно проверить в работе за минуты, не дожидаясь перепечатки:
#
#   n=$(этот сторож назовёт длину шапки)
#   { head -n "$n" bootstrap/ФАЙЛ; cat flang/src/emit/c/ФАЙЛ; } > /tmp/новое
#   mv /tmp/новое bootstrap/ФАЙЛ && make -C bootstrap
#
# Сторож проверяет, что приём ещё законен. Перестанет держаться — краснеет,
# и тогда приёмом пользоваться нельзя.
#
# ЕДИНСТВЕННОЕ ПОСЛАБЛЕНИЕ, И ОНО ИМЕНОВАНО. Строка `#define FLANG_VERSION`
# расходится законно: семя печаталось до того, как версию подняли, и сойдётся
# оно перепечаткой. Послабление узкое — ровно эта строка, ровно эта директива;
# любая другая строка тела краснит. За тем, не отстаёт ли версия у ОТГРУЖАЕМОГО
# двоичного, смотрит отдельный сторож — см. задачу 9111.
#
# ЧЕГО СТОРОЖ НЕ ОБЕЩАЕТ. Он не говорит, что семя свежее. Он говорит одно:
# отличается ли тело семени от источника ЧЕМ-ТО, КРОМЕ шапки и версии.
set -u
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT" || exit 5
RAB=${FLANG_TMP:-/srv/tmp}/semya-rantayma.$$
mkdir -p "$RAB" || exit 5
trap 'rm -rf "$RAB"' EXIT INT TERM
BEDA=0
VERSIY=0
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
  printf '%-18s шапка %2d строк, различий тела %s' "$b" "$((N-1))" "$PROCHIE"
  if [ "$VER" -gt 0 ]; then printf ' (плюс версия — послабление названо выше)'; fi
  printf '\n'
  if [ "$PROCHIE" -gt 0 ]; then
    LC_ALL=C.UTF-8 grep '^[<>]' "$RAB/razn" \
      | LC_ALL=C.UTF-8 grep -v '^[<>] #define FLANG_VERSION ' | head -20 >&2
    BEDA=$((BEDA+1))
  fi
done
if [ "$BEDA" -gt 0 ]; then
  printf '\nтело семени рантайма разошлось с источником в %d файл(е/ах) — приём\n' "$BEDA" >&2
  printf '«шапка + источник» больше не законен, правку в рантайме без\n' >&2
  printf 'перепечатки проверить нельзя\n' >&2
  exit 1
fi
printf '\nсемя рантайма = шапка + источник дословно, во всех четырёх файлах'
if [ "$VERSIY" -gt 0 ]; then
  printf '\n(строк версии разошлось %d — законно до перепечатки, см. задачу 9111)' "$VERSIY"
fi
printf '\n'
exit 0
