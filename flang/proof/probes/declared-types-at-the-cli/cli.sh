#!/bin/sh
# One request to the printed runner of one target.
#   sh cli.sh <target> <program.flang> '<request json>'
# The runner is printed by "$flang emit" and built once per binary and program
# (cache under ${FLANG_TMP:-${TMPDIR:-/tmp}}). With PROBE_PRINTED=<dir> the
# runner is taken from <dir>/<target> instead: a tree printed by the source
# compiler before the seed is reprinted (print-from-source.fscript, ADR-0099).
set -u
target=$1
program=$2
request=$3
flang=${flang:-${FLANG_BIN:-bootstrap/flang}}
if [ -n "${PROBE_PRINTED:-}" ]; then
  dir=$PROBE_PRINTED/$target
else
  key=$(cat "$flang" "$program" | cksum | tr ' ' '-')
  dir=${FLANG_TMP:-${TMPDIR:-/tmp}}/declared-types-at-the-cli/$key/$target
fi
if [ ! -f "$dir/.built" ]; then
  if [ -z "${PROBE_PRINTED:-}" ]; then
    rm -rf "$dir"
    "$flang" emit "$program" --target "$target" --out "$dir" > /dev/null 2>&1 || { echo "emit failed"; exit 90; }
  fi
  case $target in
    c|cpp|go|rust|elixir) make -s -C "$dir" > "$dir/.build.log" 2>&1 ;;
    java|csharp) make -s -C "$dir" build > "$dir/.build.log" 2>&1 ;;
    *) true ;;
  esac || { echo "build failed"; exit 91; }
  touch "$dir/.built"
fi
module=$(sed -n 's/^MODULE ?= //p' "$dir/Makefile" 2>/dev/null)
class=$(sed -n 's/^CLASS ?= //p' "$dir/Makefile" 2>/dev/null)
script=$(cd "$dir" && ls | grep -v '^flang_' | grep -E '[.](js|ts)$' | head -n 1)
cd "$dir" || exit 92
case $target in
  c|cpp|go) printf '%s\n' "$request" | ./flang_cli ;;
  rust) printf '%s\n' "$request" | ./target/debug/flang_cli ;;
  java) printf '%s\n' "$request" | java -cp . FlangCli "$class" ;;
  csharp) printf '%s\n' "$request" | dotnet run --no-build -- "$class" ;;
  python) printf '%s\n' "$request" | python3 -B flang_cli.py "$module" ;;
  elixir) printf '%s\n' "$request" | elixir -pa _build -e "Flang.Cli.main([\"$module\"])" ;;
  js|ts) printf '%s\n' "$request" | node flang_cli.js "./$script" ;;
esac
