#!/bin/bash
# Корень дерева берётся ОТ СЕБЯ. Раньше здесь стоял `cd` на чужой рабочий
# каталог агента — из свежего клона файл не запускался вовсе (задачи 9688, 7405).
cd "$(dirname "$0")/../.." || exit 1
export LC_ALL=C.UTF-8
# Четыре равноправных расширения программы: `.flang`, `.fp`, `.фп`, `.фланг` (ADR-0016).
for f in docs/benchmark2/*.flang docs/benchmark2/*.fp docs/benchmark2/*.фп docs/benchmark2/*.фланг; do
  [ -e "$f" ] || continue
  printf "%-42s " "$f"
  bootstrap/flang test "$f" --no-check 2>&1 | node -e '
    let s = ""
    process.stdin.on("data", (c) => (s += c))
    process.stdin.on("end", () => {
      try { const j = JSON.parse(s); console.log("всего", j.total, "зелёных", j.passed, "красных", j.failed) }
      catch { console.log("НЕ РАЗОБРАЛСЯ:", s.slice(0, 90)) }
    })'
done
