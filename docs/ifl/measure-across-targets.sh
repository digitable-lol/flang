#!/usr/bin/env bash
# Одна программа с объявленной мерой, девять исполнителей, один вопрос.
#
#   «НОД» от (1071, 462)  обязано дать 21;
#   «НОД» от (φ, 1)       обязано дать отказ FLANG_MEASURE, потому что мера
#                         перестала быть целой, а на дробной мере убывание
#                         ничего не доказывает: 0.618, 0.382, 0.236 … больше
#                         нуля всегда.
#
# Печатается длина и sha256 текста диагностики по каждому исполнителю. Смысл
# прогона в последней строке: сколько РАЗНЫХ ответов получилось. Единица
# означает, что интерпретатор и все собравшиеся бэкенды сказали одно и то же
# байт в байт. Тулчейна нет — так и написано, и это не «сошлось»: пропуск из-за
# отсутствующего тулчейна не является пройденной проверкой (AGENTS.md).
#
# Имена переменных здесь латиницей нарочно: bash не принимает кириллицу в
# идентификаторах, и написанный так скрипт молча делает не то, что читается.
#
#   bash docs/ifl/measure-across-targets.sh [рабочий-каталог] [быстро:0|1]
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORK="${1:-${TMPDIR:-/tmp}/flang-mera}"
FAST="${2:-0}"
SRC="examples/measure/euclid.flang"
WHOLE='{"fn":"НОД","args":[{"n":"1071"},{"n":"462"}]}'
PHI='{"fn":"НОД","args":[{"n":"1.618033988749895"},{"n":"1"}]}'

rm -rf "$WORK"; mkdir -p "$WORK/otvety"
cd "$ROOT"

# Из потока ответов прогонщика достаётся текст первого отказа — и только он.
message_of_failure() {
  python3 -c 'import sys, json
for line in sys.stdin:
    line = line.strip()
    if not line.startswith("{"): continue
    o = json.loads(line)
    if o.get("ok") is False:
        print(o["message"]); break'
}

no_toolchain() { printf '%-12s %s\n' "$1" "тулчейна нет — не запускалось"; }

# ── свидетель: интерпретатор на Node ───────────────────────────────────────────
bootstrap/flang run "$SRC" --function 'НОД' \
  --args '{"а":1.618033988749895,"б":1}' 2>&1 \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["diagnostics"][0]["message"])' \
  > "$WORK/otvety/interpretator.txt"

if [ "$FAST" = "1" ]; then
  echo "быстрый режим: восемь целей не собирались"
  printf '%-12s %6s\n' interpretator "$(wc -c < "$WORK/otvety/interpretator.txt")"
  exit 0
fi

for target in c go rust python java csharp elixir js; do
  bootstrap/flang emit "$SRC" --target "$target" --out "$WORK/$target" >/dev/null 2>&1 \
    || echo "печать в $target не удалась"
done

# ── C ───────────────────────────────────────────────────────────────────────
if command -v cc >/dev/null && (cd "$WORK/c" && make -s >/dev/null 2>&1); then
  echo "$WHOLE" | "$WORK/c/flang_cli" | grep -q '"n":"21"' || echo "ВНИМАНИЕ: C дал не 21"
  echo "$PHI" | "$WORK/c/flang_cli" | message_of_failure > "$WORK/otvety/c.txt"
else no_toolchain c; fi

# ── Python ──────────────────────────────────────────────────────────────────
if command -v python3 >/dev/null; then
  (cd "$WORK/python" && echo "$PHI" | python3 -B flang_cli.py evklid) \
    | message_of_failure > "$WORK/otvety/python.txt"
else no_toolchain python; fi

# ── JavaScript ──────────────────────────────────────────────────────────────
# Прогонщика бэкенд JS не печатает (единственный из восьми), поэтому модуль
# зовётся напрямую. Это не поблажка: сверяется тот же текст диагностики.
cat > "$WORK/js/proba.mjs" <<'EOF'
import { nOD } from "./evklid.js"
try { nOD(1.618033988749895, 1) }
catch (error) { console.log(JSON.stringify({ ok: false, message: error.message })) }
EOF
node "$WORK/js/proba.mjs" | message_of_failure > "$WORK/otvety/js.txt"

# ── Go ──────────────────────────────────────────────────────────────────────
if command -v go >/dev/null && (cd "$WORK/go" && go build -o flang_cli ./cli >/dev/null 2>&1); then
  echo "$PHI" | "$WORK/go/flang_cli" | message_of_failure > "$WORK/otvety/go.txt"
else no_toolchain go; fi

# ── Rust ────────────────────────────────────────────────────────────────────
if command -v cargo >/dev/null && (cd "$WORK/rust" && cargo build --quiet --release >/dev/null 2>&1); then
  RUSTBIN="$(find "$WORK/rust/target/release" -maxdepth 1 -type f -perm -u+x ! -name '*.d' | head -1)"
  echo "$PHI" | "$RUSTBIN" | message_of_failure > "$WORK/otvety/rust.txt"
else no_toolchain rust; fi

# ── Java ────────────────────────────────────────────────────────────────────
if command -v javac >/dev/null && (cd "$WORK/java" && make -s build >/dev/null 2>&1); then
  (cd "$WORK/java" && echo "$PHI" | java -cp . FlangCli Evklid) \
    | message_of_failure > "$WORK/otvety/java.txt"
else no_toolchain java; fi

# ── C# ──────────────────────────────────────────────────────────────────────
if command -v dotnet >/dev/null && (cd "$WORK/csharp" && dotnet build -v quiet --nologo >/dev/null 2>&1); then
  CSDLL="$(find "$WORK/csharp/bin" -name 'flang.dll' | head -1)"
  (cd "$WORK/csharp" && echo "$PHI" | dotnet "$CSDLL" Evklid) \
    | message_of_failure > "$WORK/otvety/csharp.txt"
else no_toolchain csharp; fi

# ── Elixir ──────────────────────────────────────────────────────────────────
if command -v elixir >/dev/null; then
  export ELIXIR_ERL_OPTIONS="+fnu"
  if (cd "$WORK/elixir" && make -s build >/dev/null 2>&1); then
    (cd "$WORK/elixir" && echo "$PHI" | elixir -pa _build -e 'Flang.Cli.main(["Evklid"])') \
      | message_of_failure > "$WORK/otvety/elixir.txt"
  else no_toolchain elixir; fi
else no_toolchain elixir; fi

echo
printf '%-14s %6s  %s\n' исполнитель байт sha256
for answer in "$WORK"/otvety/*.txt; do
  printf '%-14s %6s  %s\n' "$(basename "$answer" .txt)" "$(wc -c < "$answer")" \
    "$(sha256sum < "$answer" | cut -c1-16)"
done
echo
echo -n "исполнителей сверено: "
ls -1 "$WORK"/otvety/*.txt | wc -l
echo -n "различных ответов среди них: "
sha256sum "$WORK"/otvety/*.txt | awk '{print $1}' | sort -u | wc -l
