#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# ДВОИЧНЫЙ, КОТОРЫМ СНИМАЕТСЯ ВЕДОМОСТЬ ТАМ, ГДЕ ЕЁ НЕ СНЯТЬ ОБЩИМ.
#
# ── ПОЧЕМУ ЭТОТ ФАЙЛ НА ОБОЛОЧКЕ, А НЕ НА flang ────────────────────────────
# Он СОБИРАЕТ компилятор — третьим путём, рядом с scripts/raskrutka.sh и
# scripts/bootstrap-c.sh: напечатанное семя дословно плюс рантайм дерева.
# Написать сборку компилятора программой, которую исполняет компилятор,
# нельзя: на этом шаге его ещё нет — а когда он есть, собирать нечего.
# Оболочка не приносит сюда ничего нового: `sh`, `make` и `cc` на этом пути
# нужны и так. Долгом дерева этот файл поэтому не считается —
# scripts/tree-inventory.flang, довод «точка раскрутки и приёмка».
#
# Напечатанный компилятор берётся ИЗ СЕМЕНИ ДОСЛОВНО, а рантайм — ИЗ ДЕРЕВА
# (`flang/src/emit/c`), с перенесённой шапкой семени. Так собран двоичный,
# которым 29 августа 2026 впервые снята ведомость `flang/self/proof-kernel.flang`
# — 44 из 44, — когда общий двоичный этот файл не читал вовсе.
#
# Зачем так, чего приём НЕ даёт и как им снимают ведомость: docs/kernel-ledger.md
#
#   sh scripts/build-ledger-binary.sh [каталог сборки]
#
# Каталог сборки по умолчанию — СОСЕДНИЙ дереву, `<дерево>-ledger-binary`, а не
# внутри него: артефакты сборки в дереве исходников не кладут, иначе `git status`
# перестаёт быть пустым и в ветку уезжает 60 МБ объектных файлов.
#
# Переменные:
#   CC      чем собирать (умолчание `cc`)
#   J       число заданий make (умолчание 8)
#   KOMMIT  собрать по НАЗВАННОМУ коммиту, а не по рабочей копии
#
# ⚠ KOMMIT — не удобство, а условие воспроизводимости ЧИСЛА. Двоичный переживает
# своё семя: число, снятое двоичным недельной давности, сегодняшним рецептом не
# повторяется, потому что `bootstrap/compiler_flang.c` в дереве уже другой
# (задача 6715, и она повторилась 30 августа). Поэтому рядом со снятым числом
# пишут коммит, а не имя рецепта, и пересчитывают так:
#
#   KOMMIT=9190b0be sh scripts/build-ledger-binary.sh /путь/куда
set -eu

koren=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
kuda=${1:-$koren-ledger-binary}
zadaniy=${J:-8}

semya=$koren/bootstrap
runtime=$koren/flang/src/emit/c
iz_semeni='compiler_flang.c compiler_flang.h Makefile'
iz_dereva='flang_cli.c flang_repl.c flang_runtime.c flang_runtime.h'

# По названному коммиту оба слоя выкладываются из него ЖЕ: рантайм дерева и
# семя должны быть одного часа, иначе собранное не отвечает ни одному числу.
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
# Его не трогают ничем: это ровно та программа, которую семя напечатало о себе.
# Она и есть то, что судит; рантайм ей только служит.
for name in $iz_semeni; do
  cp -p "$semya/$name" "$kuda/$name"
done

# ── 2. Рантайм — из дерева, но с ШАПКОЙ ИЗ СЕМЕНИ ────────────────────────────
# Шапка — блок настроек, напечатанный бэкендом: FL_MAX_TAIL_ARGS, FL_MAX_ARGS,
# FL_MAX_DEPTH, FL_MAX_STEPS, FL_INDEX_BASE у рантайма и FL_PROGRAM_CALL,
# FL_PROGRAM_ENTRY, FL_WITH_REPL у прогонщика.
#
# ПЕРЕНОСИТЬ ЕЁ ОБЯЗАТЕЛЬНО. В самом рантайме те же имена объявлены через
# `#ifndef`, поэтому без шапки он СОБИРАЕТСЯ начисто и падает только на прогоне:
# FL_MAX_TAIL_ARGS уезжает с 9 на 4, а им размечен массив НА СТЕКЕ, и первый же
# `check` умирает с «*** stack smashing detected ***», не напечатав ни байта.
# Разбор — docs/zettel/a-seed-with-tree-runtime-smashes-the-stack-without-its-limits-block.md
#
# Числа шапки принадлежат ЭТОМУ семени: у другого напечатанного компилятора они
# другие. Потому шапка и берётся из семени, а не вписывается руками.
#
# Граница шапки — первая строка SPDX: выше неё напечатанное, ниже — файл дерева.
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
# Если тело рантайма дерева совпало с семенным, собранное будет равно
# `bootstrap/flang`, и приём не даёт НИЧЕГО сверх `make -C bootstrap`. Это не
# отказ, а ответ: после свежей перепечатки так и бывает.
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
