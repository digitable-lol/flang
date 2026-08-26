#!/bin/bash
# ПРОГОН СТЫКА: flang считает решение, хозяин на C исполняет.
#
# Три шага, и все три видны в выводе:
#
#   1. напечатать gatekeeper.flang в C. Ключ «--no-cli» — потому что точка
#      входа у этой программы своя, в host.c: две функции main в одной сборке
#      не слинкуются;
#   2. собрать хозяина вместе с напечатанным модулем и рантаймом;
#   3. подать хозяину поток событий и показать, что он ответил.
#
# Событий подаётся девять, и подобраны они так, чтобы каждый исход был виден
# хотя бы раз: пустые врата, накопление запаса, пропуск, отказ по правам,
# отказ по исчерпанному запасу. Десятое событие подаёт сам хозяин, уже после
# конца ввода, — с нарочно испорченным доводом, чтобы было видно, что
# предусловие на границе проверяется, а не только обещается.
#
# Запуск:  bash examples/host-boundary/run.sh
#          FLANG=<двоичный>  — если брать не bootstrap/flang дерева;
#          RAB=<каталог>     — если собирать не во временном.
set -u
export LC_ALL=C.UTF-8

KOREN=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
FLANG=${FLANG:-$KOREN/bootstrap/flang}
RAB=${RAB:-$(mktemp -d -p /srv/tmp host-boundary-XXXXXX)}
CC=${CC:-cc}
mkdir -p "$RAB"

echo "== 1. печать решения в C"
"$FLANG" emit "$KOREN/examples/host-boundary/gatekeeper.flang" \
  --target c --no-cli --out "$RAB/vyvod"
kod=$?
if [ $kod -ne 0 ]; then echo "печать отказала, код $kod"; exit 1; fi
ls -1 "$RAB/vyvod"

echo
echo "== 2. сборка хозяина вместе с напечатанным"
"$CC" -std=c99 -Wall -Wextra -O2 -I "$RAB/vyvod" \
  -o "$RAB/gatekeeper-host" \
  "$KOREN/examples/host-boundary/host.c" \
  "$RAB/vyvod"/privratnik.c "$RAB/vyvod"/flang_runtime.c \
  -lm -lpthread
kod=$?
if [ $kod -ne 0 ]; then echo "сборка отказала, код $kod"; exit 1; fi
echo "собран: $RAB/gatekeeper-host"

echo
echo "== 3. прогон: девять событий на стандартный ввод"
printf 'запрос 1\nтакт\nтакт\nтакт\nтакт\nзапрос 1\nзапрос 5\nзапрос 1\nзапрос 1\n' \
  | "$RAB/gatekeeper-host"
kod=$?
echo "код возврата: $kod"
exit $kod
