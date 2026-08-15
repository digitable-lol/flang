#!/bin/bash
# Память покоя: по стенду на каждый N, пять повторов.
set -u
S=/tmp/claude-1000/-home-a-projects-flang/9eb12cf5-ca30-4673-b8b0-88b76eecfdac/scratchpad/zamer
for d in "$@"; do
  echo "== $d"
  bash "$S/mera.sh" "$S/$d" 1 0 5
done
