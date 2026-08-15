#!/bin/bash
# Собрать стенд: $1 — вид (тихо|себе|пинг), остальные — размеры N.
set -eu
export LC_ALL=C.UTF-8
S=/tmp/claude-1000/-home-a-projects-flang/9eb12cf5-ca30-4673-b8b0-88b76eecfdac/scratchpad/zamer
W=/home/a/projects/flang/.claude/worktrees/agent-a0860b9ee28929af8
VID=$1; shift
for N in "$@"; do
  node "$S/gen.mjs" --n="$N" --вид="$VID" --out="$S/$VID-$N.flang"
  printf '%s N=%s ' "$VID" "$N"
  node "$S/build.mjs" --root="$W" --src="$S/$VID-$N.flang" --dir="$S/b-$VID-$N"
done
