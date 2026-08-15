#!/bin/bash
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# Рост памяти арены на «Сортировке вставками» из flang/examples/rosetta/quicksort.flang.
#
# Задача выбрана нарочно самая невыгодная: она тотальна и написана прямо, без
# единой хитрости, — то есть это НЕ надуманный случай, а обычная программа на
# этом языке. Арена не отдаёт ничего до конца вызова, поэтому каждая
# промежуточная копия списка остаётся лежать, и рост получается не линейный.
#
# ВНИМАНИЕ. Размеры здесь маленькие, и это не осторожность ради приличия:
# на четырёх тысячах элементов эта самая программа набрала 178 ГиБ и не
# закончила за две с половиной минуты. Предел адресного пространства (ulimit -v
# 8 ГиБ) поставлен, чтобы замер не уронил машину.
#
# Использование: arena.sh КАТАЛОГ-С-БИНАРНИКОМ-quicksort
set -u
BIN="${1:?нужен каталог сборки quicksort}"
for N in 250 500 750 1000 1500; do
  node -e "
    const a = []
    let x = 12345
    for (let i = 0; i < $N; i += 1) { x = (25173 * x + 13849) % 65536; a.push({ n: String(x) }) }
    process.stdout.write(JSON.stringify({ fn: 'Сортировка вставками', args: [{ l: a }] }) + '\n')
  " > /tmp/claude-1000/arena-req.json
  printf '%6d  ' "$N"
  ( ulimit -v 8388608
    /usr/bin/time -f "%M КиБ  %e с" env "$BIN/flang_cli" --json \
      < /tmp/claude-1000/arena-req.json > /tmp/claude-1000/arena-otvet.json ) 2>&1 | tail -1 | tr -d '\n'
  if grep -q '"ok":true' /tmp/claude-1000/arena-otvet.json; then echo "  досчитала"; else
    echo "  ОТКАЗ: $(head -c 60 /tmp/claude-1000/arena-otvet.json)"; fi
done
