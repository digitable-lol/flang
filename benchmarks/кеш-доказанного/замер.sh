#!/usr/bin/env bash
# Один замер прибором Ч183: цена каждого обязательства и его ключ.
#
#   bash замер.sh <семя> <файл.flang> <куда-класть>
#
# Отпечаток ядра считается ЗДЕСЬ, а не в приборе: прибор живёт в семени и
# исходников ядра не видит. Четыре файла — те, где стоят правила, по которым
# выносится приговор.
set -u
export LC_ALL=C.UTF-8
semya=${1:?семя}
vhod=${2:?файл}
kuda=${3:?куда}
koren=$(cd "$(dirname "$0")/../.." && pwd)
otpechatok=$(cat "$koren/flang/self/proofterm.flang" \
                 "$koren/flang/self/proof-kernel.flang" \
                 "$koren/flang/self/proof-initial.flang" \
                 "$koren/flang/self/obligations.flang" | sha256sum | cut -c1-32)
FLANG_KESH=1 FLANG_KESH_ONLY=1 FLANG_KESH_KERNEL="$otpechatok" \
  "$semya/flang" check "$vhod" > /dev/null 2> "$kuda"
kod=$?
echo "замер: $vhod, отпечаток ядра $otpechatok, код возврата $kod"
/usr/bin/grep -a -v '^ОБЯЗ' "$kuda"
exit "$kod"
