#!/bin/bash
# Разовая проба: время и пиковая память одной задачи на трёх языках.
# Использование: probe.sh БИНАРНИК ФУНКЦИЯ ЗАДАЧА РАЗМЕР
set -u
BIN="$1"; FN="$2"; ZAD="$3"; N="$4"
DIR="$(cd "$(dirname "$0")" && pwd)/programs"
echo "--- flang"
printf '{"fn":"%s","args":[{"n":"%s"}]}\n' "$FN" "$N" > /tmp/claude-1000/zamer-req.json
/usr/bin/time -v "$BIN" --json < /tmp/claude-1000/zamer-req.json 2>&1 | grep -E '^\{|Elapsed \(wall|Maximum resident'
echo "--- python"
/usr/bin/time -v python3 "$DIR/zadachi.py" "$ZAD" "$N" 2>&1 | grep -E '^[0-9]|Elapsed \(wall|Maximum resident'
echo "--- node"
LC_ALL=C.UTF-8 /usr/bin/time -v node "$DIR/zadachi.mjs" "$ZAD" "$N" 2>&1 | grep -E '^[0-9]|Elapsed \(wall|Maximum resident'
