#!/bin/sh
# Замер: настоящая системная задача на flang — разбор fstab(5) — и три её
# прогона на НАСТОЯЩЕМ /etc/fstab этой машины:
#   1) вычислителем языка, планом (единственное место, где программа видит диск);
#   2) напечатанным в C родным двоичным;
#   3) им же, собранным БЕЗ LIBC вовсе.
# Повторяется целиком, из корня дерева:  sh benchmarks/systems/measure.sh
set -e
KORAB=${KORAB:-$(mktemp -d -p /srv/tmp sistemnoe.XXXXXX)}
ZDES=$(cd "$(dirname "$0")" && pwd)
KOREN=$(cd "$ZDES/../.." && pwd)
FLANG="$KOREN/bootstrap/flang"
echo "рабочий каталог: $KORAB"

echo
echo "── 1. Проверка программы ─────────────────────────────────────────────"
LC_ALL=C.UTF-8 "$FLANG" check "$ZDES/fstab.flang"

echo
echo "── 2. План на настоящем /etc/fstab ───────────────────────────────────"
LC_ALL=C.UTF-8 "$FLANG" io "$ZDES/fstab.flang" | sed -n 's/.*"result":"\([^"]*\)".*/вычислитель языка: \1/p'
echo "полномочия сужены (--no-read) — ждём отказ, а не молчание:"
LC_ALL=C.UTF-8 "$FLANG" io "$ZDES/fstab.flang" --no-read 2>&1 | head -2 || true

echo
echo "── 3. Печать в C и родной двоичный ───────────────────────────────────"
LC_ALL=C.UTF-8 "$FLANG" emit "$ZDES/fstab.flang" --target c --out "$KORAB" >/dev/null
cp "$ZDES/../bez-libc/layer.c" "$ZDES/../bez-libc/text-layer.c" "$ZDES/fstab-without-libc.c" "$KORAB/"
cd "$KORAB"
make -j8 >/dev/null 2>&1
printf '{"fn":"Отчёт","args":[{"s":%s}]}\n' "$(sed 's/\\/\\\\/g; s/"/\\"/g; s/\t/\\t/g' /etc/fstab | sed ':a;N;$!ba;s/\n/\\n/g; s/^/"/; s/$/\\n"/')" \
  | ./flang_cli | sed -n 's/.*"s":"\([^"]*\)".*/родной двоичный:   \1/p'

echo
echo "── 4. Тот же разбор БЕЗ LIBC ─────────────────────────────────────────"
OBSHCHIE="-std=c99 -O2 -ffunction-sections -fdata-sections -U_FORTIFY_SOURCE -D_FORTIFY_SOURCE=0 -fno-stack-protector"
cc $OBSHCHIE -DFL_NO_POSIX_STACK -c -o rt.o flang_runtime.c
cc $OBSHCHIE -c -o modul.o razbor_fstab.c
cc $OBSHCHIE -c -o drv.o fstab-without-libc.c
cc -std=gnu99 -O2 -DTOLKO_VHOD -fno-stack-protector -c -o vhod.o layer.c
echo "чего просит у libc разбор конфигурации (имя: мест вызова):"
cc -std=c99 -O2 -nostdlib -static -Wl,--gc-sections -o /dev/null vhod.o drv.o rt.o modul.o 2>&1 \
  | grep -oE "undefined reference to .[a-z_]+" | sed "s/.*to .//" | LC_ALL=C sort | uniq -c | LC_ALL=C sort -rn
for f in sloy sloy-teksta; do
  cc -std=gnu99 -O2 -Wall -Wextra -fno-stack-protector -fno-builtin \
     -ffunction-sections -fdata-sections -c -o $f.o $f.c
done
cc -std=c99 -O2 -nostdlib -static -Wl,--gc-sections -o bez-libc sloy.o sloy-teksta.o drv.o rt.o modul.o
cc -std=c99 -O2 -static -Wl,--gc-sections -o s-glibc drv.o rt.o modul.o -lm
./bez-libc && echo "БЕЗ LIBC: отчёт по настоящему /etc/fstab совпал знак в знак"
./s-glibc  && echo "на glibc:  он же"
echo "размер без libc: $(wc -c < bez-libc) байт ; статически с glibc: $(wc -c < s-glibc) байт"
echo "слои: layer.c $(sed 's://.*::' layer.c | perl -0777 -pe 's{/\*.*?\*/}{}gs' | grep -cvE '^[[:space:]]*$') строк + text-layer.c $(sed 's://.*::' text-layer.c | perl -0777 -pe 's{/\*.*?\*/}{}gs' | grep -cvE '^[[:space:]]*$') строк"
