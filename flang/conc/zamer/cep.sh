#!/bin/bash
# Цепь: одно сообщение будит все N процессов. $1 каталог, $2 пробегов, $3 повторов
set -u
source "$(dirname "${BASH_SOURCE[0]}")/obshchee.sh"
echo "== $1 пробегов $2"
bash "$FLANG/flang/conc/zamer/mera.sh" "$(stend "$1")" "$2" 0 "${3:-3}"
