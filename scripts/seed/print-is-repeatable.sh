#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# Печать повторима: тот же двоичный, тот же вход, две разные среды (каталоги,
# часовой пояс, набивка окружения) — одни байты. Необходимое условие гейта Г6
# на каждом пуше, не сам гейт: печатается один модуль, не замыкание компилятора.
#
# Как звать:
#   sh scripts/seed/print-is-repeatable.sh                  сверка (вход flang/self/lexer.flang)
#   sh scripts/seed/print-is-repeatable.sh --вход <файл>    сверка на другом входе
#   sh scripts/seed/print-is-repeatable.sh --подлог         проба самого прибора
#   FLANG — чем печатать (bootstrap/flang); FLANG_TMP — где работать (/srv/tmp).
#
# Коды: 0 — совпали побайтово; 1 — разошлись: печать невоспроизводима (находка);
#       2 — звать не умеют; 3 — НЕ ПРОВЕРЕНО: печатать нечем, негде или печать отказала.
# см. docs/zettel/one-module-printed-in-two-environments-is-a-necessary-condition-of-gate-six-not-the-gate.md
set -u

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
RUNTIME=flang/src/emit/c
OTPECHATOK=scripts/otpechatok-semeni
VHOD_PO_UMOLCHANIYU=flang/self/lexer.flang

skazhi() { printf '%s\n' "$*"; }
beda()   { printf '%s\n' "$*" >&2; }

VHOD=$VHOD_PO_UMOLCHANIYU
PODLOG=net
while [ $# -gt 0 ]; do
  case $1 in
    --подлог) PODLOG=da ;;
    --вход)
      shift
      [ $# -gt 0 ] || { beda "--вход: не назван файл"; exit 2; }
      VHOD=$1 ;;
    *) beda "непонятный ключ: $1"
       beda "звать: sh scripts/seed/print-is-repeatable.sh [--вход <файл>|--подлог]"
       exit 2 ;;
  esac
  shift
done

[ -f "$ROOT/$VHOD" ] || { beda "входа нет: $VHOD"; exit 2; }

BINARY=${FLANG:-$ROOT/bootstrap/flang}
if [ ! -x "$BINARY" ]; then
  beda "НЕ ПРОВЕРЕНО: печатать нечем — $BINARY не исполняемый файл"
  beda "  Собрать: make -C bootstrap -j\"\$(nproc)\""
  exit 3
fi

PREDEL_SHAGOV=$(LC_ALL=C.UTF-8 /usr/bin/grep -a '^предел-шагов ' "$ROOT/$OTPECHATOK" 2>/dev/null | tail -1 | sed 's/^[^ ]* //')
PREDEL_GLUBINY=$(LC_ALL=C.UTF-8 /usr/bin/grep -a '^предел-глубины ' "$ROOT/$OTPECHATOK" 2>/dev/null | tail -1 | sed 's/^[^ ]* //')
if [ -z "$PREDEL_SHAGOV" ] || [ -z "$PREDEL_GLUBINY" ]; then
  beda "НЕ ПРОВЕРЕНО: в $OTPECHATOK нет пределов печати"
  beda "  Печатать с чужими пределами нельзя: это была бы другая печать."
  exit 3
fi

RAB=$(mktemp -d -p "${FLANG_TMP:-/srv/tmp}" povtorima.XXXXXX) || {
  beda "НЕ ПРОВЕРЕНО: не создался каталог в ${FLANG_TMP:-/srv/tmp}"; exit 3; }
trap 'rm -rf "$RAB"' EXIT INT TERM

# ── Сверка двух каталогов побайтово ─────────────────────────────────────────
sverit() { # $1 первый каталог, $2 второй. 0 — сошлись, 1 — разошлись
  ( cd "$1" && ls -A ) | LC_ALL=C sort > "$RAB/spisok-1"
  ( cd "$2" && ls -A ) | LC_ALL=C sort > "$RAB/spisok-2"
  if ! LC_ALL=C cmp -s "$RAB/spisok-1" "$RAB/spisok-2"; then
    skazhi "РАЗОШЛИСЬ: наборы напечатанных файлов не совпадают"
    LC_ALL=C diff "$RAB/spisok-1" "$RAB/spisok-2" | sed 's/^/  /'
    return 1
  fi
  sv_fajlov=0; sv_bajt=0; sv_razoshlos=0
  while IFS= read -r f; do
    [ -f "$1/$f" ] || continue
    sv_fajlov=$((sv_fajlov + 1))
    sv_bajt=$((sv_bajt + $(wc -c < "$1/$f")))
    if ! LC_ALL=C cmp -s "$1/$f" "$2/$f"; then
      sv_razoshlos=$((sv_razoshlos + 1))
      skazhi "РАЗОШЁЛСЯ: $f"
      skazhi "  $(LC_ALL=C cmp "$1/$f" "$2/$f" 2>&1 | head -1)"
    fi
  done < "$RAB/spisok-1"
  if [ "$sv_razoshlos" -gt 0 ]; then
    skazhi "файлов сверено $sv_fajlov, разошлось $sv_razoshlos"
    return 1
  fi
  SVERENO_FAJLOV=$sv_fajlov
  SVERENO_BAJT=$sv_bajt
  return 0
}

# $1 — выходной каталог, $2 — часовой пояс, $3 — временный каталог,
# $4 — набивка окружения (сдвигает адреса стека), $5 — журнал
pechat() {
  mkdir -p "$1" "$3" || return 3
  (
    cd "$ROOT" || exit 3
    TZ=$2 TMPDIR=$3 FLANG_TMP=$3 NABIVKA=$4 \
      "$BINARY" emit "$VHOD" --target c --out "$1" \
        --cli --repl --runtime "$ROOT/$RUNTIME" \
        --max-steps "$PREDEL_SHAGOV" --max-depth "$PREDEL_GLUBINY"
  ) > "$5" 2>&1
}

NABIVKA_1=x
NABIVKA_2=$(awk 'BEGIN { s = ""; while (length(s) < 4000) s = s "щ"; print s }')

# ── ПОДЛОГ: краснеет ли прибор, когда есть на что ───────────────────────────
if [ "$PODLOG" = da ]; then
  bedy=0
  pechat "$RAB/probe" UTC "$RAB/t0" "$NABIVKA_1" "$RAB/probe.log"
  kod=$?
  if [ "$kod" -ne 0 ]; then
    beda "НЕ ПРОВЕРЕНО: печать пробы отказала (код $kod)"
    tail -20 "$RAB/probe.log" >&2
    exit 3
  fi

  cp -a "$RAB/probe" "$RAB/kopiya"
  if sverit "$RAB/probe" "$RAB/kopiya" >/dev/null; then
    skazhi "чисто молчит    дословная копия признана совпавшей"
  else
    beda "ЛОЖНАЯ ТРЕВОГА: сверщик развёл дословную копию"
    bedy=$((bedy + 1))
  fi

  # Порча ровно того рода, какой даёт сбитая печать: один байт в напечатанном.
  KOGO=$(cd "$RAB/kopiya" && ls -A | LC_ALL=C sort | head -1)
  [ -n "$KOGO" ] || { beda "НЕ ПРОВЕРЕНО: печать пробы не дала ни одного файла"; exit 3; }
  printf '/* подлог */\n' >> "$RAB/kopiya/$KOGO"
  if sverit "$RAB/probe" "$RAB/kopiya" >/dev/null; then
    beda "ПОДЛОГ НЕ ПОЙМАН: сверщик смолчал на изменённом байте в $KOGO"
    bedy=$((bedy + 1))
  else
    skazhi "подлог пойман   изменённый байт в $KOGO назван"
  fi

  rm -rf "$RAB/kopiya"; cp -a "$RAB/probe" "$RAB/kopiya"
  rm -f "$RAB/kopiya/$KOGO"
  if sverit "$RAB/probe" "$RAB/kopiya" >/dev/null; then
    beda "ПОДЛОГ НЕ ПОЙМАН: сверщик смолчал на пропавшем файле $KOGO"
    bedy=$((bedy + 1))
  else
    skazhi "подлог пойман   пропавший файл $KOGO назван"
  fi

  [ "$bedy" -eq 0 ] || exit 1
  skazhi "прибор краснеет там, где должен, и молчит там, где должен"
  exit 0
fi

# ── Сама сверка: две печати одного входа в РАЗНЫХ средах ────────────────────
skazhi "вход:      $VHOD"
skazhi "печатает:  $BINARY"
skazhi "пределы:   шагов $PREDEL_SHAGOV, глубины $PREDEL_GLUBINY"

pechat "$RAB/pervaya" UTC "$RAB/t1" "$NABIVKA_1" "$RAB/pervaya.log"
kod=$?
if [ "$kod" -ne 0 ]; then
  beda "НЕ ПРОВЕРЕНО: первая печать отказала (код $kod)"
  beda "Это НЕ «разошлись»: сверять было нечего."
  tail -20 "$RAB/pervaya.log" >&2
  exit 3
fi
pechat "$RAB/vtoraya-pechat-togo-zhe-dereva" Pacific/Kiritimati \
       "$RAB/vremennyy-katalog-vtorogo-zahoda" "$NABIVKA_2" "$RAB/vtoraya.log"
kod=$?
if [ "$kod" -ne 0 ]; then
  beda "НЕ ПРОВЕРЕНО: вторая печать отказала (код $kod)"
  beda "Это НЕ «разошлись»: сверять было нечего."
  tail -20 "$RAB/vtoraya.log" >&2
  exit 3
fi

SVERENO_FAJLOV=0; SVERENO_BAJT=0
if sverit "$RAB/pervaya" "$RAB/vtoraya-pechat-togo-zhe-dereva"; then
  skazhi "печати совпали побайтово: файлов $SVERENO_FAJLOV, байт $SVERENO_BAJT"
  skazhi "Печать этого двоичного не зависит от времени, адресов, номера процесса,"
  skazhi "путей и часового пояса. Это НЕОБХОДИМОЕ условие Г6, и оно держится."
  skazhi "Достаточным оно не стало: полная пара печатей одного дерева — за"
  skazhi "работой dve-pechati в .github/workflows/reprint.yml."
  exit 0
fi

skazhi ""
skazhi "ПЕЧАТЬ НЕВОСПРОИЗВОДИМА. Это НАХОДКА, а не поломка машины."
skazhi "Один двоичный, один вход, два захода — и разные байты. Значит в вывод"
skazhi "течёт что-то, чего нет во входах. Гейт Г6 на этом дереве не берётся"
skazhi "ничем: полная пара печатей разойдётся тем же."
skazhi "Чинить надо печать, а не проверку: повтор даст то же самое."
exit 1
