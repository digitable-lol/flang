#!/bin/bash
# Память покоя: по стенду на каждый N, пять повторов.
set -u
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
for d in "$@"; do
  echo "== $d"
  bash "$FLANG/flang/conc/bench/measure.sh" "$(stend "$d")" 1 0 5
done
