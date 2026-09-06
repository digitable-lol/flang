#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# БЫСТРЫЙ ПЕРЕСЕВ СЕМЕНИ — без 4,5-часовой печати, там где она не нужна.
#
# Вопрос владельца (задача 3388): «зачем гонять перепечатку на каждый тег? нельзя
# ли семя 0.7.12 взять для 0.7.13?» Ответ: часто — можно, и вот когда именно.
#
# Семя bootstrap/ состоит из двух родов файлов:
#   ПЕЧАТАЕТСЯ  compiler_flang.c, compiler_flang.h — снимаются печатью из
#               flang/self/** (это и есть те самые ~4,5 часа);
#   КОПИРУЕТСЯ  flang_repl.c, flang_cli.c, flang_runtime.c, flang_runtime.h —
#               уезжают в семя ДОСЛОВНО из flang/src/emit/c/**, печать лишь
#               приписывает сверху шапку с #define (заслон 2573,
#               scripts/semya-rantayma-eto-istochnik.sh).
#
# Печатаемая часть — чистая функция от (замыкание flang/** + пределы шагов и
# глубины). Пока это не менялось, свежая печать дала бы БАЙТ В БАЙТ тот же
# compiler_flang.c. Значит его можно оставить как есть, обновить лишь
# копируемые файлы, и пересчитать отпечаток. Версия (#define FLANG_VERSION)
# сидит в flang_repl.c — то есть в копируемой части, и подхватывается сама.
#
# КОГДА ЭТОТ ПУТЬ ВЕРЕН — ровно тогда, когда замыкание и пределы не тронуты
# относительно нынешнего отпечатка. Тронуты — печатаемая часть устарела, и
# честного быстрого пути нет: нужна полная перепечатка sh scripts/raskrutka.sh.
# Этот скрипт сам проверяет условие и ОТКАЗЫВАЕТ, если оно нарушено.
#
# ОТПЕЧАТОК СНИМАЕТСЯ ТЕМ ЖЕ ПРИБОРОМ, ЧТО И ПЕЧАТЬ. Руками отпечаток не
# пишется и flang_repl.c руками не правится: и то и другое заслон прочитал бы
# как подлог происхождения. Снятие идёт через sh scripts/raskrutka.sh
# --otpechatok — та же функция stamp_now, которой заканчивается полная печать.
#
# ── Как звать ────────────────────────────────────────────────────────────────
#   sh scripts/semya-osvezhit.sh            пересеять: обновить копируемые файлы,
#                                           снять отпечаток, пересобрать двоичный
#   sh scripts/semya-osvezhit.sh --check    только сказать, годен ли быстрый путь
#                                           (для хука перед пушем); не меняет дерева
#   sh scripts/semya-osvezhit.sh --help
#
# Коды: 0 — пересеяно (или быстрый путь годен, при --check);
#       1 — замыкание/пределы тронуты: быстрый путь не годится, нужна печать;
#       2 — довод непонятен;
#       3 — сверить/пересеять не удалось (нет отпечатка, нет sha256sum, и т.п.).
set -u

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
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
    sed -n '3,30p' "$0" | sed 's/^# \{0,1\}//'
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
#
# Печатаемую часть задают ДВА входа: замыкание компилятора (все .flang, что
# отпечаток перечислил во входном блоке, КРОМЕ копируемого рантайма) и пределы
# (строки «предел-шагов»/«предел-глубины»). Сверяем и то и другое с деревом.
# Расхождение хоть в одном — печатаемая часть другая, быстрый путь не годится.
#
# Печатает в поток бед строки-расхождения; в стандартный вывод — ничего.
# Возвращает 0, если замыкание и пределы совпали; 1 — если разошлись.
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
#
# Тот же вопрос, что у заслона 2573 --после-печати, но без кода: для каждого
# копируемого файла тело семени (от первой строки источника и ниже) сходится
# ли с источником байт в байт. Все четыре сошлись — рантайм догнан.
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
#
# Красное — только на настоящей опасности: замыкание разошлось, А рантайм при
# этом ПОДАН как свежий (догнал источник). Это подпись «быстрый пересев
# применили там, где нельзя»: честная полная печать свела бы к одному коммиту и
# рантайм, и печатаемую часть. Обычное отставание середины работы (отстают и
# рантайм, и замыкание) — это СВЕДЕНИЕ, не беда: догоняется печатью перед
# выпуском, красить на это значит красить почти всегда.
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
  # Отпечаток снимается ТЕМ ЖЕ прибором, что и печать (stamp_now внутри
  # raskrutka.sh). Руками его не пишем — иначе заслон 2573 прочтёт подлог.
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
if sh "$ROOT/scripts/semya-rantayma-eto-istochnik.sh" --после-печати >/dev/null 2>&1; then
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
