#!/bin/bash
# Течёт ли планировщик со временем: память при разном числе пробегов.
# $1 каталог, далее — числа пробегов
set -u
S=/tmp/claude-1000/-home-a-projects-flang/9eb12cf5-ca30-4673-b8b0-88b76eecfdac/scratchpad/zamer
DIR=$1; shift
for T in "$@"; do
  printf 'пробегов %-9s ' "$T"
  bash "$S/mera.sh" "$S/$DIR" "$T" 0 2 | tr '\n' '|'
  echo
done
