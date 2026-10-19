#!/bin/sh
# Runs an installed or unpacked flang the way a person does first.
#
#   sh packaging/prebuilt/smoke.sh <dir-with-bin/flang> <version>
#
# Checks: `flang --version` names <version> on its first line, `flang check`
# accepts a module and rejects a broken one, `flang emit` prints into every
# target the binary names in `--help`, `check --proof` runs the proof checker,
# and flangtutor finds its lessons.
set -eu

if [ "$#" -ne 2 ]; then
  echo "usage: $0 <dir-with-bin/flang> <version>" >&2
  exit 2
fi
dir=$1
version=$2
flang="$dir/bin/flang"
fail=0

first=$("$flang" --version | head -1)
if [ "$first" = "flang $version" ]; then
  echo "ok   --version: $first"
else
  echo "FAIL --version: got '$first', expected 'flang $version'" >&2
  fail=1
fi

probe=$(mktemp -d)
trap 'rm -rf "$probe"' EXIT
printf 'модуль «Проба»\n\nтотальная функция «Два»\n  возвращает число\n  2\n' > "$probe/probe.flang"
printf 'модуль «Кривая»\n\nтотальная функция «Два»\n  возвращает число\n  "два"\n' > "$probe/broken.flang"

if "$flang" check "$probe/probe.flang" >/dev/null 2>&1; then
  echo "ok   check accepts a module"
else
  echo "FAIL check rejected a correct module" >&2
  fail=1
fi
if "$flang" check "$probe/broken.flang" >/dev/null 2>&1; then
  echo "FAIL check accepted a broken module" >&2
  fail=1
else
  echo "ok   check rejects a broken module"
fi

targets=$("$flang" --help | grep -- '--target' | tr ' ' '\n' | grep '|' | tr '|' ' ')
# shellcheck disable=SC2086 # one target per line on purpose
count=$(printf "%s\n" $targets | grep -c . || true)
if [ "$count" -lt 9 ]; then
  echo "FAIL --help names $count emit targets, expected at least 9" >&2
  fail=1
fi
for target in $targets; do
  if "$flang" emit "$probe/probe.flang" --target "$target" --out "$probe/out/$target" >/dev/null 2>&1 \
     && [ -n "$(ls -A "$probe/out/$target" 2>/dev/null)" ]; then
    echo "ok   emit --target $target"
  else
    echo "FAIL emit --target $target" >&2
    fail=1
  fi
done

# The independent proof checker must be found by an installed flang: without
# it `check --proof` says "сверщика нет" and every proved claim rests on the
# kernel alone.
printf 'модуль «Проба большего»\n\nтотальная функция «Большее»\n  принимает а: неотрицательное, б: неотрицательное\n  возвращает неотрицательное\n  обеспечивает «не меньше первого» результат не меньше а\n  если а больше б то а иначе б\n' > "$probe/larger.flang"
proved=$(env -u FLANG_CHECKER "$flang" check "$probe/larger.flang" --proof 2>&1 || true)
case "$proved" in
  *"сверщика нет"*) echo "FAIL check --proof finds no proof checker (libexec/flang/checker)" >&2; fail=1 ;;
  *"независимо, сверщиком"*) echo "ok   check --proof runs the proof checker" ;;
  *) echo "FAIL check --proof said nothing about the proof checker" >&2; fail=1 ;;
esac

if [ -x "$dir/bin/flangtutor" ]; then
  if "$dir/bin/flangtutor" --список 2>/dev/null | grep -q '^урок 1 '; then
    echo "ok   flangtutor finds its lessons"
  else
    echo "FAIL flangtutor does not find its lessons" >&2
    fail=1
  fi
fi

exit "$fail"
