#!/bin/bash
# Течёт ли планировщик со временем: память при разном числе пробегов.
# $1 каталог, далее — числа пробегов
set -u
source "$(dirname "${BASH_SOURCE[0]}")/obshchee.sh"
DIR=$1; shift
for T in "$@"; do
  printf 'пробегов %-9s ' "$T"
  bash "$FLANG/flang/conc/zamer/mera.sh" "$(stend "$DIR")" "$T" 0 2 | tr '\n' '|'
  echo
done
