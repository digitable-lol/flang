#!/bin/bash
# Во что упирается прогон при нехватке памяти: ulimit -v в КиБ, точное сообщение.
# $1 каталог, $2 пробегов, далее — пределы в КиБ
set -u
source "$(dirname "${BASH_SOURCE[0]}")/obshchee.sh"
DIR=$(stend "$1"); TURNS=$2; shift 2
REQ="{\"run\":\"стенд\",\"seed\":\"1\",\"turns\":\"$TURNS\",\"journal\":\"0\"}"
for KB in "$@"; do
  OUT=$(echo "$REQ" | /bin/sh -c "ulimit -v $KB; exec '$DIR/flang_cli'" 2>&1 | head -c 200)
  printf 'ulimit -v %s КиБ: %s\n' "$KB" "${OUT:0:190}"
done
