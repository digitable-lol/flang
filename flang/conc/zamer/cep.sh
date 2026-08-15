#!/bin/bash
# Цепь: одно сообщение будит все N процессов. $1 каталог, $2 пробегов, $3 повторов
set -u
S=/tmp/claude-1000/-home-a-projects-flang/9eb12cf5-ca30-4673-b8b0-88b76eecfdac/scratchpad/zamer
echo "== $1 пробегов $2"
bash "$S/mera.sh" "$S/$1" "$2" 0 "${3:-3}"
