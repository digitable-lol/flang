#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# КИРИЛЛИЦЫ В ИМЕНАХ ФАЙЛОВ ВНЕ flang/proof НЕ ПРИБАВЛЯЕТСЯ — храповик по ведомости.
#
#   sh scripts/guards/cyrillic-file-names-guard.sh --check    сверить дерево с ведомостью, код 1 при расхождении
#   sh scripts/guards/cyrillic-file-names-guard.sh --подлог   подмешать выдуманное имя: обязан покраснеть (код 1)
#   sh scripts/guards/cyrillic-file-names-guard.sh --список   кириллические имена дерева, по одному в строке
#
# Имена файлов в дереве — английскими словами, без транслита (задача 1419).
# Уже лежащие кириллические имена перечислены в scripts/ledgers/cyrillic-file-names-debt.txt
# и уходят оттуда по одному, вместе с переименованием. Сверка идёт В ОБЕ СТОРОНЫ:
# новое кириллическое имя — красно; запись, пережившая файл, — тоже красно.
# flang/proof/** не судится: там имя файла — ключ артефактов доказательств (задача 1420).
# Смотрятся ОТСЛЕЖИВАЕМЫЕ файлы (git ls-files): собранное и временное в счёт не идёт.
set -u
KOREN=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$KOREN" || exit 2
VEDOMOST=scripts/ledgers/cyrillic-file-names-debt.txt
REZHIM=${1:---check}
RAB=${FLANG_TMP:-/srv/tmp}/cyrillic-names.$$
mkdir -p "$RAB" || exit 2
trap 'rm -rf "$RAB"' EXIT INT TERM

spisok() {
  git -c core.quotepath=false ls-files \
    | grep -v '^flang/proof/' \
    | LC_ALL=C.UTF-8 grep -P '[А-Яа-яЁё][^/]*$' \
    | LC_ALL=C sort
}

case "$REZHIM" in
  --список) spisok; exit 0 ;;
  --check) spisok > "$RAB/derevo" ;;
  --подлог) { spisok; echo 'docs/подлог-кириллического-имени.md'; } | LC_ALL=C sort > "$RAB/derevo" ;;
  *) echo "кириллица в именах: непонятный ключ «$REZHIM» (--check, --подлог, --список)" >&2; exit 2 ;;
esac

[ -f "$VEDOMOST" ] || { echo "кириллица в именах: нет ведомости $VEDOMOST" >&2; exit 2; }
grep -v '^#' "$VEDOMOST" | grep -v '^$' | LC_ALL=C sort > "$RAB/vedomost"

LC_ALL=C comm -23 "$RAB/derevo" "$RAB/vedomost" > "$RAB/novye"
LC_ALL=C comm -13 "$RAB/derevo" "$RAB/vedomost" > "$RAB/mertvye"
n=$(wc -l < "$RAB/novye" | tr -d ' ')
m=$(wc -l < "$RAB/mertvye" | tr -d ' ')
vsego=$(wc -l < "$RAB/derevo" | tr -d ' ')

if [ "$n" -eq 0 ] && [ "$m" -eq 0 ]; then
  if [ "$REZHIM" = --подлог ]; then
    echo "ПОДЛОГ НЕ ПОЙМАН — сторож сломан: выдуманное кириллическое имя прошло" >&2
    exit 0
  fi
  echo "кириллица в именах файлов вне flang/proof: $vsego, все в ведомости — новых нет"
  exit 0
fi
[ "$n" -eq 0 ] || { echo "КИРИЛЛИЦА В ИМЕНИ ФАЙЛА ВНЕ flang/proof — новых $n (имя файла — английскими словами, без транслита; задача 1419):"; sed 's/^/  · /' "$RAB/novye"; }
[ "$m" -eq 0 ] || { echo "ЗАПИСЬ ВЕДОМОСТИ ПЕРЕЖИЛА ФАЙЛ — $m; уберите строки из $VEDOMOST:"; sed 's/^/  · /' "$RAB/mertvye"; }
[ "$REZHIM" = --подлог ] && echo "подлог пойман"
exit 1
# ярлык «кириллица:проверка» sh --check — кириллических имён файлов вне flang/proof не прибавилось
