#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# Двоичный для ведомости: напечатанное семя дословно плюс рантайм дерева
# (flang/src/emit/c) под шапкой семени. Ведомость им снимают только из каталога
# ВНУТРИ дерева: соседний каталог не видит flang/stdlib (сказано вслух в конце).
#
# Как звать:  sh scripts/seed/build-ledger-binary.sh [каталог сборки]
#   умолчание — <дерево>-ledger-binary; CC (cc), J (8) — чем собирать и число
#   заданий make; KOMMIT=<коммит> — собрать по названному коммиту, а не по
#   рабочей копии (условие воспроизводимости числа).
#
# Коды: 0 — собрано; 2 — коммита или файлов семени/рантайма нет; 3 — в семени нет
#       строки SPDX, границы шапки не найти; иначе — код make.
# см. docs/zettel/a-ledger-binary-beside-the-tree-cannot-see-the-library-and-blames-the-author.md
set -eu

koren=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
kuda=${1:-$koren-ledger-binary}
zadaniy=${J:-8}

semya=$koren/bootstrap
runtime=$koren/flang/src/emit/c
iz_semeni='compiler_flang.c compiler_flang.h Makefile'
iz_dereva='flang_cli.c flang_repl.c flang_runtime.c flang_runtime.h'

if [ -n "${KOMMIT:-}" ]; then
  polnyy=$(cd "$koren" && git rev-parse --verify "$KOMMIT^{commit}") || {
    echo "коммита $KOMMIT в дереве нет" >&2; exit 2; }
  semya=$kuda/.iz-kommita/bootstrap
  runtime=$kuda/.iz-kommita/emit-c
  mkdir -p "$semya" "$runtime"
  for name in $iz_semeni $iz_dereva; do
    (cd "$koren" && git show "$polnyy:bootstrap/$name") > "$semya/$name"
  done
  for name in $iz_dereva; do
    (cd "$koren" && git show "$polnyy:flang/src/emit/c/$name") > "$runtime/$name"
  done
  echo "семя и рантайм взяты из коммита $polnyy"
fi

for name in $iz_semeni $iz_dereva; do
  test -f "$semya/$name" || { echo "нет $semya/$name — дерево не то" >&2; exit 2; }
done
for name in $iz_dereva; do
  test -f "$runtime/$name" || { echo "нет $runtime/$name — дерево не то" >&2; exit 2; }
done

mkdir -p "$kuda"

# ── 1. Напечатанный компилятор — из семени, побайтово ────────────────────────
for name in $iz_semeni; do
  cp -p "$semya/$name" "$kuda/$name"
done

# ── 2. Рантайм — из дерева, но с ШАПКОЙ ИЗ СЕМЕНИ ────────────────────────────
for name in $iz_dereva; do
  stroka=$(sed -n '/^\/\* SPDX-FileCopyrightText/=' "$semya/$name" | head -1)
  test -n "$stroka" || { echo "в $semya/$name нет строки SPDX — границы шапки не найти" >&2; exit 3; }
  shapka=$((stroka - 1))
  {
    if [ "$shapka" -gt 0 ]; then head -n "$shapka" "$semya/$name"; fi
    cat "$runtime/$name"
  } > "$kuda/$name"
done

# ── 3. Сказать вслух, что приём сегодня добавляет ────────────────────────────
raznica=0
for name in $iz_dereva; do
  skolko=$(diff "$semya/$name" "$kuda/$name" | grep -c '^[<>]' || true)
  raznica=$((raznica + skolko))
  printf 'рантайм %-18s дерево обгоняет семя на %s строк\n' "$name" "$skolko"
done
if [ "$raznica" -eq 0 ]; then
  echo 'рантайм дерева и рантайм семени СОВПАЛИ: этот двоичный будет равен bootstrap/flang'
fi

make -C "$kuda" -j"$zadaniy" CC="${CC:-cc}"

echo
echo "двоичный: $kuda/flang"
echo "размер:   $(stat -c%s "$kuda/flang") байт"
echo "md5:      $(md5sum "$kuda/flang" | cut -d' ' -f1)"
"$kuda/flang" --version

# ── 4. Видит ли этот двоичный библиотеку дерева ──────────────────────────────
if [ ! -d "$kuda/../flang/stdlib" ]; then
  echo
  echo 'ВНИМАНИЕ: этот двоичный НЕ ВИДИТ библиотеку дерева.'
  echo "  он ищет её в $kuda/../flang/stdlib — а её там нет"
  echo '  собранным так двоичным ведомость снимать НЕЛЬЗЯ: он ответит'
  echo '  «FLANG_NOT_TOTAL: … вызывает неизвестную функцию …» на здоровом файле,'
  echo '  и отказ будет выглядеть долгом автора, а не бедой раскладки.'
  echo
  echo '  Как снимать ведомость: положите двоичный ВНУТРЬ дерева и зовите оттуда'
  echo "    mkdir -p $koren/build-ledger"
  echo "    cp -p $kuda/flang $kuda/flang_runtime.h $koren/build-ledger/"
  echo "    $koren/build-ledger/flang check <файл> --proof --json"
  echo '  Каталог build-ledger — временный: уберите его перед коммитом, иначе'
  echo '  сторож раскладки покажет лишний каталог в корне.'
fi
