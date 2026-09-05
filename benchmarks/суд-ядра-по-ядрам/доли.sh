#!/usr/bin/env bash
export LC_ALL=ru_RU.UTF-8
# Корень дерева берётся ОТ СЕБЯ, как в соседнем встроить.sh. Раньше здесь стоял
# путь на чужой временный каталог — из свежего клона файл не запускался вовсе
# (задачи 9688, 7405).
root=$(cd "$(dirname "$0")/../.." && pwd)
cd "$root" || exit 1
export FLANG_MODULE_DIR="$root/flang/stdlib:$root/flang/core"
export FLANG_KERNEL_SPLIT=16
out=${ZAMERY:-${FLANG_TMP:-/srv/tmp}/суд-ядра-по-ядрам}
mkdir -p "$out" || exit 1
for f in "$@"; do
  name=$(basename "$f" .flang)
  t0=$(date +%s%N)
  /usr/bin/time -v ./bootstrap/flang check "$f" > /dev/null 2>"$out/доли-$name.txt"; kod=$?
  t1=$(date +%s%N)
  echo "=== $f kod=$kod всего $(( (t1-t0)/1000000 )) мс"
  /usr/bin/grep -a '^доли:' "$out/доли-$name.txt"
  /usr/bin/grep -a 'Maximum resident\|Percent of CPU' "$out/доли-$name.txt"
done
