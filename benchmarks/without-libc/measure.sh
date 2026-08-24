#!/bin/sh
# Замер: сколько напечатанной программе flang нужно от libc и собирается ли
# она вовсе без libc. Повторяется целиком, из корня дерева:
#     sh benchmarks/without-libc/measure.sh
# Требуется: cc (проверено на gcc, x86_64 Linux), nm, собранный bootstrap/flang.
set -e
KORAB=${KORAB:-$(mktemp -d -p /srv/tmp bez-libc.XXXXXX)}
ZDES=$(cd "$(dirname "$0")" && pwd)
KOREN=$(cd "$ZDES/../.." && pwd)
echo "рабочий каталог: $KORAB"

LC_ALL=C.UTF-8 "$KOREN/bootstrap/flang" emit "$KOREN/examples/rosetta/factorial.flang" \
  --target c --out "$KORAB" >/dev/null
cp "$ZDES/layer.c" "$ZDES/plain.c" "$ZDES/list.c" "$KORAB/"
cd "$KORAB"

OBSHCHIE="-std=c99 -O2 -ffunction-sections -fdata-sections -U_FORTIFY_SOURCE -D_FORTIFY_SOURCE=0 -fno-stack-protector"

echo
echo "── 1. Что рантайм просит у libc ──────────────────────────────────────"
cc $OBSHCHIE -c -o rt-polnyy.o flang_runtime.c
cc $OBSHCHIE -DFL_NO_POSIX_STACK -c -o rt.o flang_runtime.c
cc $OBSHCHIE -c -o modul.o faktorial.c
cc $OBSHCHIE -c -o cli.o flang_cli.c
echo "рантайм как есть:              $(nm -u rt-polnyy.o | wc -l) имён"
nm -u rt-polnyy.o | awk '{printf "%s ", $2}'; echo
echo "рантайм с -DFL_NO_POSIX_STACK: $(nm -u rt.o | wc -l) имён"
nm -u rt.o | awk '{printf "%s ", $2}'; echo
echo "модуль самой программы:        $(nm -u modul.o | grep -vc ' fl_') имён libc"
nm -u modul.o | grep -v ' fl_' | awk '{printf "%s ", $2}'; echo
echo "прогонщик flang_cli.c:         $(nm -u cli.o | grep -vcE ' (fl_|faktorial_)') имён libc"

echo
echo "── 2. Сколько рантайма доживает до чистого вычисления ────────────────"
cc $OBSHCHIE -c -o chistoe.o plain.c
cc -std=c99 -O2 -Wl,--gc-sections -o chistoe chistoe.o rt.o modul.o -lm
./chistoe && echo "чистое вычисление на libc: посчитано верно"
nm --defined-only rt.o    | awk '$2=="T"||$2=="t"{print $3}' | LC_ALL=C sort -u > .rt-vse
nm --defined-only chistoe | awk '$2=="T"||$2=="t"{print $3}' | LC_ALL=C sort -u > .bin-vse
echo "функций в рантайме: $(wc -l < .rt-vse) ; дожило: $(comm -12 .rt-vse .bin-vse | wc -l)"

echo
echo "── 3. Сборка без libc ────────────────────────────────────────────────"
# Без точки входа компоновщик с --gc-sections выметает программу целиком и
# молчит: список нехватки виден только когда _start на месте, а замен нет.
cc -std=gnu99 -O2 -DTOLKO_VHOD -fno-stack-protector -c -o tolko-vhod.o layer.c
echo "чего не хватает, если слоя нет (имя: сколько мест вызова):"
cc -std=c99 -O2 -nostdlib -static -Wl,--gc-sections -o /dev/null \
  tolko-vhod.o chistoe.o rt.o modul.o 2>&1 | grep -oE "undefined reference to .[a-z_]+" \
  | sed "s/.*to .//" | LC_ALL=C sort | uniq -c | LC_ALL=C sort -rn
cc -std=gnu99 -O2 -Wall -Wextra -ffunction-sections -fdata-sections \
   -fno-stack-protector -fno-builtin -c -o sloy.o layer.c
cc -std=c99 -O2 -nostdlib -static -Wl,--gc-sections -o bezlibc sloy.o chistoe.o rt.o modul.o
echo "слой: $(sed 's://.*::' layer.c | perl -0777 -pe 's{/\*.*?\*/}{}gs' | grep -cvE '^[[:space:]]*$') строк кода"
./bezlibc && echo "БЕЗ LIBC: собралось и посчитало верно (факториал 20)"
echo "неопределённых символов в готовом файле: $(nm -u bezlibc | wc -l)"
echo "размер: $(wc -c < bezlibc) байт"

cc $OBSHCHIE -c -o spisok.o list.c
cc -std=c99 -O2 -nostdlib -static -Wl,--gc-sections -o spisok sloy.o spisok.o rt.o modul.o
./spisok && echo "БЕЗ LIBC: список [1..2000] построен и свёрнут — свой malloc работает"
