#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# ПРОБЫ ВОРОТ НЕДОКАЗАННОГО (ADR-0045; docs/guide/settings.ru.md).
#
#   sh flang/proof/probes/unproven/run.sh
#   FLANG_BIN=<путь> sh flang/proof/probes/unproven/run.sh
#
# Код 0 — сошлось всё; 1 — хоть одна проба разошлась, и она названа строкой;
# 2 — не смог измерить (нет двоичного, нет таблицы).
#
# ── ЧТО ЗДЕСЬ СТЕРЕЖЁТСЯ ────────────────────────────────────────────────────
# С 0.7.21 недоказанная программа не считается вовсе (`flang/proof/probes/run`
# держит это), а пропустить проверку можно ключом. Этот набор — про ДРУГОЕ: про
# то, КАК человек управляет воротами и ЧТО ему на это отвечают.
#
#   · три исхода вместо двух: отказ, предупреждение, разрешение;
#   · старшинство: ключ команды → FLANG_UNPROVEN → .flangrc проекта →
#     .flangrc дома → умолчание «отказ»;
#   · письмо ответа = письмо вопроса: набравший «--trust» получает в строке
#     «--trust», а не «--на-веру».
#
# ── ПОЧЕМУ КАЖДАЯ ПРОБА ИДЁТ В СВОЁМ КАТАЛОГЕ, И ЗАЧЕМ В НЁМ ПУСТОЙ `.git` ──
# Настройки ищутся ОТ РАБОЧЕГО КАТАЛОГА ВВЕРХ, и подъём обрывает корневая
# примета. Без своей приметы проба взяла бы чужой `.flangrc` — хоть этого
# дерева, хоть `/tmp/.git`, который на машине разработчика существует (замер
# 8 сентября 2026, шапка scripts/flangrc.sh). Пустой файл `.git` рядом с
# программой обрывает подъём на первом же шаге, и проба судит РОВНО то, что
# ей положено. HOME отводится в пустой каталог по той же причине: `~/.flangrc`
# человека в пробу попадать не должен.
#
# Имена переменных латиницей: ни dash, ни bash не принимают кириллицу в именах.
set -u

KOREN=$(CDPATH= cd -- "$(dirname -- "$0")/../../../.." && pwd)
FLANG=${FLANG_BIN:-${FLANG:-$KOREN/bootstrap/flang}}
PROBY=$KOREN/flang/proof/probes/unproven
export LC_ALL=C.UTF-8

[ -x "$FLANG" ] || { echo "нет двоичного: $FLANG (собрать: make -C bootstrap)" >&2; exit 2; }
[ -f "$PROBY/expected.tsv" ] || { echo "нет таблицы ожиданий: $PROBY/expected.tsv" >&2; exit 2; }

RAB=$(mktemp -d -p "${FLANG_TMP:-${TMPDIR:-/tmp}}" proby-nedokazannogo.XXXXXX) || exit 2
trap 'rm -rf "$RAB"' EXIT INT TERM
mkdir -p "$RAB/dom"

BAD=0; N=0
awk -F'\t' '!/^#/ && $1 != "программа" && NF >= 7' "$PROBY/expected.tsv" > "$RAB/ожидание.tsv"

while IFS="$(printf '\t')" read -r prog put fajl sreda klyuchi kod slovo; do
  N=$((N+1))
  ISHODNIK=$PROBY/programs/$prog
  if [ ! -f "$ISHODNIK" ]; then
    printf '✗ %-22s НЕТ ПРОГРАММЫ: %s\n' "$prog" "$ISHODNIK"
    BAD=$((BAD+1)); continue
  fi

  MESTO=$RAB/proba.$N
  mkdir -p "$MESTO"
  cp "$ISHODNIK" "$MESTO/"
  : > "$MESTO/.git"
  [ "$fajl" = "—" ] || printf '%s\n' "$fajl" > "$MESTO/.flangrc"
  [ "$klyuchi" = "—" ] && klyuchi=""

  # Ключи разворачиваются без кавычек намеренно: пробелов внутри одного довода
  # в этой таблице нет, а «--unproven refuse» — это два довода, и разделить их
  # обязана именно оболочка.
  # Пустая FLANG_UNPROVEN и незаданная — для двоичного одно и то же (проверка
  # `env[0] != 0` в flang_repl.c), поэтому «—» кладётся пустой строкой.
  SREDA=$sreda; [ "$SREDA" = "—" ] && SREDA=""
  if [ "$put" = run ]; then
    out=$(cd "$MESTO" && HOME=$RAB/dom FLANG_UNPROVEN=$SREDA \
      "$FLANG" run "$prog" --function «Ответ» $klyuchi 2>&1); k=$?
  else
    out=$(cd "$MESTO" && HOME=$RAB/dom FLANG_UNPROVEN=$SREDA \
      "$FLANG" io "$prog" --max-steps 1000000 $klyuchi 2>&1); k=$?
  fi

  if [ "$k" = "$kod" ] && printf '%s' "$out" | grep -q -a -F -- "$slovo"; then
    printf '✓ %-22s %-4s файл «%s» среда «%s» ключи «%s» → код %s\n' \
      "$prog" "$put" "$fajl" "$sreda" "${klyuchi:-—}" "$k"
  else
    printf '✗ %-22s %-4s файл «%s» среда «%s» ключи «%s»: ждали код %s и «%s», вышло код %s: %s\n' \
      "$prog" "$put" "$fajl" "$sreda" "${klyuchi:-—}" "$kod" "$slovo" "$k" \
      "$(printf '%s' "$out" | tr '\n' ' ' | cut -c1-200)"
    BAD=$((BAD+1))
  fi
done < "$RAB/ожидание.tsv"

# ── Сверка с каталогом в обе стороны ───────────────────────────────────────
# Программа, лежащая в каталоге и не названная в таблице, — дыра в надзоре:
# ровно так заводится файл, о котором никто не спросил ни одного кода.
for f in "$PROBY"/programs/*.flang; do
  [ -e "$f" ] || continue
  imya=$(basename "$f")
  if ! cut -f1 "$RAB/ожидание.tsv" | grep -q -a -F -x -- "$imya"; then
    printf '✗ НЕЗАЯВЛЕННАЯ ПРОГРАММА: %s лежит в каталоге, а строки о ней в expected.tsv нет\n' "$imya"
    BAD=$((BAD+1))
  fi
done

echo
if [ "$BAD" -eq 0 ]; then
  echo "сошлось всё: проб $N, разошлось 0"
  exit 0
fi
echo "НЕ СОШЛОСЬ: проб $N, разошлось $BAD"
exit 1
