#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# Быстрый пересев семени без 4,5-часовой печати: копируемые файлы рантайма
# (flang_repl.c, flang_cli.c, flang_runtime.c, flang_runtime.h) обновляются из
# flang/src/emit/c под шапкой семени, отпечаток снимается тем же прибором, что
# печать, двоичный пересобирается. Законен, только пока замыкание и пределы
# не тронуты относительно отпечатка — скрипт проверяет это сам и отказывает.
#
# Как звать:
#   sh scripts/seed/semya-osvezhit.sh            пересеять
#   sh scripts/seed/semya-osvezhit.sh --check    только сказать, годен ли быстрый путь
#                                           (для хука перед пушем); дерева не меняет
#   sh scripts/seed/semya-osvezhit.sh --help
#
# Коды: 0 — пересеяно (или быстрый путь годен, при --check); 1 — замыкание или
#       пределы тронуты: нужна печать; 2 — довод непонятен; 3 — сверить или
#       пересеять не удалось (нет отпечатка, sha256sum, сборка не прошла).
# см. docs/zettel/a-fast-reseed-is-legal-only-while-the-closure-and-limits-match-the-stamp.md
set -u

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$ROOT" || exit 3

STAMP=scripts/otpechatok-semeni
RASKRUTKA=scripts/raskrutka.sh
RUNTIME=flang/src/emit/c
TELO_METKA='# ── тело семени ──'
# Копируемый рантайм: тот же список, что судит заслон 2573.
RANTAYM='flang_repl.c flang_cli.c flang_runtime.c flang_runtime.h'

err() { printf '%s\n' "$*" >&2; }
say() { printf '%s\n' "$*"; }

REZHIM=reseed
case "${1:-}" in
  '') ;;
  --check) REZHIM=check ;;
  -h|--help|help)
    sed -n '3,20p' "$0" | sed 's/^# \{0,1\}//'
    exit 0 ;;
  *) err "непонятный довод: $1 (знаю --check и --help)"; exit 2 ;;
esac

[ -f "$ROOT/$STAMP" ] || { err "отпечатка нет: $STAMP — сверять не с чем"; exit 3; }

HASH=sha256sum
command -v sha256sum >/dev/null 2>&1 || {
  if command -v shasum >/dev/null 2>&1; then HASH='shasum -a 256'
  else err "нужен sha256sum или shasum — отпечаток нечем пересчитать"; exit 3; fi
}

# Один хеш файла, в формате sha256sum (хеш, два пробела, путь).
hash_of() { ( cd "$ROOT" && $HASH "$1" 2>/dev/null | cut -d' ' -f1 ); }

# ── Условие быстрого пути: печатаемая часть не устарела ──────────────────────
zamykanie_svezhee() {
  BEDA=0

  # Пределы: из отпечатка против нынешнего raskrutka.sh.
  for klyuch in предел-шагов предел-глубины; do
    OTP=$(LC_ALL=C.UTF-8 awk -v k="$klyuch" '$1==k{print $2; exit}' "$ROOT/$STAMP")
    case "$klyuch" in
      предел-шагов)   PEREM=MAX_STEPS ;;
      предел-глубины) PEREM=MAX_DEPTH ;;
    esac
    NYNE=$(LC_ALL=C.UTF-8 awk -F= -v p="$PEREM" '$1==p{print $2; exit}' "$ROOT/$RASKRUTKA")
    if [ "$OTP" != "$NYNE" ]; then
      err "  • $klyuch: в отпечатке $OTP, в $RASKRUTKA $NYNE"
      BEDA=$((BEDA+1))
    fi
  done

  # Входной блок отпечатка: строки «<хеш>␠␠<путь>» до метки тела. Из них
  # замыкание — всё, кроме путей рантайма flang/src/emit/c/*.
  VHODY=$(LC_ALL=C.UTF-8 awk -v m="$TELO_METKA" '
    $0==m{exit} /^[0-9a-f]{64}  /{print $1"\t"$2}' "$ROOT/$STAMP")

  OLDIFS=$IFS; IFS='
'
  for stroka in $VHODY; do
    OTPHASH=${stroka%%	*}
    PUT=${stroka#*	}
    case "$PUT" in "$RUNTIME"/*) continue ;; esac   # рантайм судим отдельно
    if [ ! -f "$ROOT/$PUT" ]; then
      err "  • $PUT: был в отпечатке, в дереве нет"
      BEDA=$((BEDA+1)); continue
    fi
    NYNE=$(hash_of "$PUT")
    if [ "$NYNE" != "$OTPHASH" ]; then
      err "  • $PUT: изменён относительно отпечатка семени"
      BEDA=$((BEDA+1))
    fi
  done
  IFS=$OLDIFS

  [ "$BEDA" = 0 ]
}

# ── Рантайм-часть семени догнала источник? ──────────────────────────────────
rantaym_dognan() {
  for b in $RANTAYM; do
    IST=$ROOT/$RUNTIME/$b
    SEMYA=$ROOT/bootstrap/$b
    [ -f "$IST" ] && [ -f "$SEMYA" ] || return 1
    PERV=$(head -1 "$IST")
    N=$(LC_ALL=C.UTF-8 /usr/bin/grep -a -n -m1 -F -x -- "$PERV" "$SEMYA" | cut -d: -f1)
    [ -n "$N" ] || return 1
    tail -n +"$N" "$SEMYA" | cmp -s - "$IST" || return 1
  done
  return 0
}

# ── Режим --check: сказать хуку, годен ли быстрый путь ──────────────────────
if [ "$REZHIM" = check ]; then
  if zamykanie_svezhee 2>/tmp/.semya-check.$$; then
    rm -f /tmp/.semya-check.$$
    say "печатаемая часть семени отвечает flang/self и пределам."
    say "тронуты только копируемые файлы — быстрый пересев «семя:освежить» достаточен."
    exit 0
  fi
  RAZN=$(cat /tmp/.semya-check.$$ 2>/dev/null); rm -f /tmp/.semya-check.$$
  if rantaym_dognan; then
    err "БЫСТРЫЙ ПЕРЕСЕВ ПРИМЕНЁН ТАМ, ГДЕ НЕЛЬЗЯ."
    err ""
    err "Рантайм-часть семени догнала источник (как после «семя:освежить»),"
    err "но печатаемая часть разошлась с flang/self или пределами:"
    err "$RAZN"
    err ""
    err "compiler_flang.c печатается из flang/self/**, и быстрый путь его не"
    err "трогает. Раз замыкание другое — печатаемая часть устарела, и семя"
    err "собрано не из того, чем оно объявлено. Нужна полная перепечатка:"
    err "  sh scripts/raskrutka.sh"
    exit 1
  fi
  say "flang/self или пределы ушли вперёд семени — обычное отставание середины работы."
  say "$RAZN"
  say ""
  say "Это НЕ беда: рантайм тоже отстаёт, семя честно старое. Догонится полной"
  say "перепечаткой перед выпуском (sh scripts/raskrutka.sh); быстрый пересев здесь"
  say "не годится — он трогает только копируемые файлы, а разошлось замыкание."
  exit 0
fi

# ── Режим пересева ──────────────────────────────────────────────────────────

say "быстрый пересев семени: проверяю, что печатаемая часть не устарела"
if ! zamykanie_svezhee; then
  err ""
  err "ОТКАЗ: замыкание компилятора или пределы тронуты относительно отпечатка."
  err "compiler_flang.c печатается из flang/self/** — быстрый пересев его не даёт."
  err "Нужна полная перепечатка (те самые ~4,5 часа):"
  err "  sh scripts/raskrutka.sh"
  exit 1
fi
say "  замыкание и пределы совпали с отпечатком — печатаемую часть оставляем как есть"

# Составляем копируемые файлы заново: шапка семени (всё до первой строки
# источника) + источник ДОСЛОВНО. Точно рецепт заслона 2573.
IZMENENO=0
for b in $RANTAYM; do
  IST=$ROOT/$RUNTIME/$b
  SEMYA=$ROOT/bootstrap/$b
  if [ ! -f "$IST" ] || [ ! -f "$SEMYA" ]; then
    err "нет файла: $RUNTIME/$b или bootstrap/$b — пересеять нечего"; exit 3
  fi
  PERV=$(head -1 "$IST")
  N=$(LC_ALL=C.UTF-8 /usr/bin/grep -a -n -m1 -F -x -- "$PERV" "$SEMYA" | cut -d: -f1)
  if [ -z "$N" ]; then
    err "ПРИЁМ БОЛЬШЕ НЕ ЗАКОНЕН: первой строки источника $b в семени нет вовсе."
    err "Печать копирует рантайм уже не дословно — быстрым путём не пересеять."
    err "Нужна полная перепечатка: sh scripts/raskrutka.sh"
    exit 1
  fi
  NOVOE=$(mktemp "${FLANG_TMP:-/srv/tmp}/semya-$b.XXXXXX") || { err "нет времянки"; exit 3; }
  { head -n "$((N-1))" "$SEMYA"; cat "$IST"; } > "$NOVOE"
  if cmp -s "$NOVOE" "$SEMYA"; then
    rm -f "$NOVOE"
    say "  $b: уже совпадает с источником — не трогаю"
  else
    mv "$NOVOE" "$SEMYA"
    say "  $b: шапка $((N-1)) строк + источник $(wc -l < "$IST") строк — обновлён"
    IZMENENO=$((IZMENENO+1))
  fi
done

if [ "$IZMENENO" = 0 ]; then
  say ""
  say "семя уже свежо: копируемые файлы совпадают с источником, обновлять нечего."
  say "проверяю заслоны на всякий случай."
else
  say ""
  say "снимаю отпечаток тем же прибором, что и печать: sh $RASKRUTKA --otpechatok"
  if ! sh "$ROOT/$RASKRUTKA" --otpechatok; then
    err "снять отпечаток не удалось — семя оставлено обновлённым, но отпечаток старый"
    exit 3
  fi
fi

# ── Проверка: то ли собралось и сошлись ли заслоны ──────────────────────────
say ""
say "пересобираю двоичный из обновлённого семени: make -C bootstrap"
if ! make -C bootstrap -j"$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 4)" >&2; then
  err "сборка не удалась"; exit 3
fi

say ""
say "сверяю заслоны семени:"
OK=0
if sh "$ROOT/$RASKRUTKA" --telo >/dev/null 2>&1; then
  say "  зелен  raskrutka.sh --telo (тело семени сходится с отпечатком)"
else
  say "  КРАСЕН raskrutka.sh --telo"; OK=1
fi
if sh "$ROOT/scripts/seed/semya-rantayma-eto-istochnik.sh" --после-печати >/dev/null 2>&1; then
  say "  зелен  semya-rantayma-eto-istochnik.sh --после-печати (семя = источник)"
else
  say "  КРАСЕН semya-rantayma-eto-istochnik.sh --после-печати"; OK=1
fi
say ""
say "версия собранного двоичного: $(./bootstrap/flang --version 2>&1 | head -1)"

if [ "$OK" = 0 ]; then
  say ""
  say "семя пересеяно быстрым путём, заслоны зелены."
fi
exit "$OK"
