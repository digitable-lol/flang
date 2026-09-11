#!/bin/bash
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# Рост памяти арены на «Сортировке вставками» из examples/rosetta/quicksort.flang.
#
# Задача выбрана нарочно самая невыгодная: она тотальна и написана прямо, без
# единой хитрости, — то есть это НЕ надуманный случай, а обычная программа на
# этом языке. Арена не отдаёт ничего до конца вызова, поэтому каждая
# промежуточная копия списка остаётся лежать, и рост получается не линейный.
#
# ПОПРАВКА 18 августа. Две строки выше описывают дерево ДО коммита e342156,
# который научил арену откатываться. Тогда четыре тысячи элементов набирали
# 178 ГиБ и не заканчивали за две с половиной минуты; сегодня те же четыре
# тысячи — 710 МиБ и 151 с, и они досчитывают. Поэтому размеры расширены до
# 4000, а предел адресного пространства (ulimit -v 8 ГиБ) оставлен: он ничего
# не стоит, а на откате назад по истории снова понадобится.
#
# Использование: arena.sh КАТАЛОГ-С-БИНАРНИКОМ-quicksort
set -u
BIN="${1:?нужен каталог сборки quicksort}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
for N in 250 500 750 1000 1500 2000 4000; do
  node -e "
    const a = []
    let x = 12345
    for (let i = 0; i < $N; i += 1) { x = (25173 * x + 13849) % 65536; a.push({ n: String(x) }) }
    process.stdout.write(JSON.stringify({ fn: 'Сортировка вставками', args: [{ l: a }] }) + '\n')
  " > "$TMP/arena-req.json"
  printf '%6d  ' "$N"
  ( ulimit -v 8388608
    /usr/bin/time -f "%M КиБ  %e с" env "$BIN/flang_cli" --json \
      < "$TMP/arena-req.json" > "$TMP/arena-otvet.json" ) 2>&1 | tail -1 | tr -d '\n'
  if grep -q '"ok":true' "$TMP/arena-otvet.json"; then echo "  досчитала"; else
    echo "  ОТКАЗ: $(head -c 60 "$TMP/arena-otvet.json")"; fi
done
