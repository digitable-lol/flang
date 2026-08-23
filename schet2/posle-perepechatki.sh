#!/bin/sh
# Дождаться перепечатки семени, собрать двоичный, прогнать порчу, снять ведомости.
set -u
K=/srv/flang-rabota/u-uslovno2
cd "$K"
while ! grep -q 'RC=' schet2/raskrutka.log 2>/dev/null; do sleep 20; done
echo "=== перепечатка: $(grep 'RC=' schet2/raskrutka.log) ==="
tail -8 schet2/raskrutka.log
grep -q 'RC=0' schet2/raskrutka.log || { echo "перепечатка не удалась — дальше не иду"; exit 1; }
echo "=== сборка двоичного из свежего семени ==="
make -C bootstrap -j64 2>&1 | tail -3 || exit 1
cp bootstrap/flang schet2/flang-stalo
echo "=== ПОРЧА ==="
sh schet2/porcha.sh "$K/schet2/flang-stalo" "$K/schet2/porcha"
echo "=== ведомости НОВЫМ двоичным ==="
sh schet2/snyat-stalo.sh "$K/schet2/flang-stalo" "$K/schet2/stalo"
echo "=== СЧЁТ ==="
echo "── было ──"; python3 schet2/schet.py schet2/do
echo "── стало ──"; python3 schet2/schet.py schet2/stalo
