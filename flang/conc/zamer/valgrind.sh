#!/bin/bash
# Точные байты: сколько ВЫДАНО malloc'ом. RSS считает только тронутые страницы,
# а кусок арены в 64 КиБ, из которого использованы сто байт, тронет одну.
# $1 каталог, $2 пробегов
set -u
S=/tmp/claude-1000/-home-a-projects-flang/9eb12cf5-ca30-4673-b8b0-88b76eecfdac/scratchpad/zamer
DIR=$1; TURNS=$2
REQ="{\"run\":\"стенд\",\"seed\":\"1\",\"turns\":\"$TURNS\",\"journal\":\"0\"}"
echo "$REQ" | valgrind --tool=memcheck --error-exitcode=9 "$S/$DIR/flang_cli" 2>&1 >/dev/null \
  | grep -E 'total heap usage|in use at exit|ERROR SUMMARY'
