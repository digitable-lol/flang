#!/bin/bash
# Разовая проба: время и пиковая память одной задачи на трёх языках.
# Использование: probe.sh БИНАРНИК ФУНКЦИЯ ЗАДАЧА РАЗМЕР
set -u
BIN="$1"; FN="$2"; ZAD="$3"; N="$4"
DIR="$(cd "$(dirname "$0")" && pwd)/programs"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
echo "--- flang"
printf '{"fn":"%s","args":[{"n":"%s"}]}\n' "$FN" "$N" > "$TMP/req.json"
# `env` между time и бинарником — не украшение: без него ru_maxrss до time не
# доезжает и «Maximum resident» приходит нулём (расчёт идёт на отдельном потоке).
/usr/bin/time -v env "$BIN" --json < "$TMP/req.json" 2>&1 | grep -E '^\{|Elapsed \(wall|Maximum resident'
echo "--- python"
/usr/bin/time -v python3 "$DIR/zadachi.py" "$ZAD" "$N" 2>&1 | grep -E '^[0-9]|Elapsed \(wall|Maximum resident'
echo "--- node"
LC_ALL=C.UTF-8 /usr/bin/time -v node "$DIR/zadachi.mjs" "$ZAD" "$N" 2>&1 | grep -E '^[0-9]|Elapsed \(wall|Maximum resident'
