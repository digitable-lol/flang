#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# ТРАНСЛИТА В ИМЕНАХ ФАЙЛОВ НЕ ПРИБАВЛЯЕТСЯ — храповик по закрытому списку слов.
#
#   sh scripts/guards/translit-file-names-guard.sh --check    сверить имена со списком слов и ведомостью, код 1 при беде
#   sh scripts/guards/translit-file-names-guard.sh --подлог   подмешать scripts/podlog-storozha.sh: обязан покраснеть (код 1)
#   sh scripts/guards/translit-file-names-guard.sh --список   имена с чужими словами, по одному в строке
#
# Имя файла — либо русское, либо английское; транслит — брак (задача 1428).
# Кириллицу судит сосед (cyrillic-file-names-guard.sh); здесь судятся ЛАТИНСКИЕ
# имена: каждое слово имени (разделители «-», «_», «.», без последнего
# расширения, числа не в счёт, регистр не в счёт) обязано стоять в закрытом
# списке scripts/ledgers/file-name-words.txt. Слово не из списка — либо
# транслит, либо новое английское слово, и тогда его вписывают в список ВМЕСТЕ
# с файлом: список закрыт нарочно, чтобы транслит не прошёл молча.
# Область — стек инструментов: scripts/, flang/test/, flang/scripts/,
# docs/site/, docs/zettel/, .github/. Уже лежащие транслитные имена — в
# ведомости долга scripts/ledgers/translit-file-names-debt.txt, у каждого
# причина. Сверка В ОБЕ СТОРОНЫ: имя с чужим словом вне ведомости — красно;
# запись, пережившая файл или долг, — тоже красно.
# Судится имя файла, не каталог (как у соседа). Смотрятся ОТСЛЕЖИВАЕМЫЕ файлы
# (git ls-files): собранное и временное в счёт не идёт.
set -u
KOREN=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$KOREN" || exit 2
SLOVA=scripts/ledgers/file-name-words.txt
VEDOMOST=scripts/ledgers/translit-file-names-debt.txt
OBLAST="scripts flang/test flang/scripts docs/site docs/zettel .github"
REZHIM=${1:---check}
RAB=${FLANG_TMP:-/srv/tmp}/translit-names.$$
mkdir -p "$RAB" || exit 2
trap 'rm -rf "$RAB"' EXIT INT TERM

[ -f "$SLOVA" ] || { echo "транслит в именах: нет списка слов $SLOVA" >&2; exit 2; }
[ -f "$VEDOMOST" ] || { echo "транслит в именах: нет ведомости $VEDOMOST" >&2; exit 2; }
grep -v '^#' "$SLOVA" | grep -v '^$' | LC_ALL=C sort -u > "$RAB/slova"
grep -v '^#' "$VEDOMOST" | grep -v '^$' | LC_ALL=C sort > "$RAB/vedomost"

# Латинские имена области, по одному пути в строке.
imena() {
  git -c core.quotepath=false ls-files -- $OBLAST | LC_ALL=C.UTF-8 grep -v -P '[А-Яа-яЁё][^/]*$'
}

# путь → «путь<TAB>чужие слова» для имён, где есть слово не из списка.
chuzhie() {
  LC_ALL=C.UTF-8 awk -v SLOVA="$RAB/slova" '
    BEGIN { while ((getline w < SLOVA) > 0) znaem[w] = 1 }
    {
      put = $0; imya = put; sub(/.*\//, "", imya); sub(/\.[^.]*$/, "", imya)
      n = split(tolower(imya), kuski, /[-_.]/); vyvod = ""
      for (i = 1; i <= n; i++) {
        s = kuski[i]
        if (s == "" || s ~ /^[0-9]+$/ || (s in znaem)) continue
        vyvod = vyvod (vyvod == "" ? "" : " ") s
      }
      if (vyvod != "") print put "\t" vyvod
    }'
}

case "$REZHIM" in
  --список) imena | chuzhie | cut -f1; exit 0 ;;
  --check) imena | chuzhie > "$RAB/chuzhie" ;;
  --подлог) { imena; echo 'scripts/podlog-storozha.sh'; } | chuzhie > "$RAB/chuzhie" ;;
  *) echo "транслит в именах: непонятный ключ «$REZHIM» (--check, --подлог, --список)" >&2; exit 2 ;;
esac

vsego=$(imena | wc -l | tr -d ' ')
cut -f1 "$RAB/chuzhie" | LC_ALL=C sort > "$RAB/derevo"
LC_ALL=C comm -23 "$RAB/derevo" "$RAB/vedomost" > "$RAB/novye"
LC_ALL=C comm -13 "$RAB/derevo" "$RAB/vedomost" > "$RAB/mertvye"
n=$(wc -l < "$RAB/novye" | tr -d ' ')
m=$(wc -l < "$RAB/mertvye" | tr -d ' ')
dolg=$(wc -l < "$RAB/derevo" | tr -d ' ')

if [ "$n" -eq 0 ] && [ "$m" -eq 0 ]; then
  if [ "$REZHIM" = --подлог ]; then
    echo "ПОДЛОГ НЕ ПОЙМАН — сторож сломан: подмешанное имя scripts/podlog-storozha.sh прошло" >&2
    exit 0
  fi
  echo "транслит в именах файлов: латинских имён $vsego, с чужими словами $dolg — все в ведомости, новых нет"
  exit 0
fi
if [ "$n" -gt 0 ]; then
  echo "СЛОВО НЕ ИЗ СПИСКА В ИМЕНИ ФАЙЛА — новых $n (имя файла — английскими словами, без транслита; задача 1428)."
  echo "Английское слово — впишите в $SLOVA; транслит — переименуйте:"
  LC_ALL=C sort "$RAB/chuzhie" | LC_ALL=C join -t "$(printf '\t')" - "$RAB/novye" | awk -F'\t' '{ printf "  · %s  (чужие слова: %s)\n", $1, $2 }'
fi
if [ "$m" -gt 0 ]; then
  echo "ЗАПИСЬ ВЕДОМОСТИ ПЕРЕЖИЛА ФАЙЛ ИЛИ ДОЛГ — $m; уберите строки из $VEDOMOST:"
  sed 's/^/  · /' "$RAB/mertvye"
fi
[ "$REZHIM" = --подлог ] && echo "подлог пойман"
exit 1
# ярлык «транслит:проверка» sh --check — транслита в латинских именах файлов не прибавилось
