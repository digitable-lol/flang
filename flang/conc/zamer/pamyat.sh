#!/bin/bash
# Память покоя: по стенду на каждый N, пять повторов.
set -u
source "$(dirname "${BASH_SOURCE[0]}")/obshchee.sh"
for d in "$@"; do
  echo "== $d"
  bash "$FLANG/flang/conc/zamer/mera.sh" "$(stend "$d")" 1 0 5
done
