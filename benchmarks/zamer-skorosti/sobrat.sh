#!/bin/bash
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# Собирает всё, что нужно замеру, в один каталог.
#
#   base/            напечатанный C как есть
#   bez-schetchika/  он же без счётчика ШАГОВ: fl_tick вычеркнут макросом, то
#                    есть исчезает и вызов, а не только его тело. Счётчик
#                    глубины и сторож стека остаются — их убрать нельзя, ими
#                    несётся объявленный предел глубины.
#   bez-vhoda/       он же без ВСЕХ пределов: fl_tick, fl_enter и fl_leave
#                    вычеркнуты все три.
#   lto/             base, собранный с -flto: рантайм и модуль лежат в разных
#                    единицах трансляции, и без межмодульной оптимизации ни один
#                    fl_add не подставляется на место. Это правка одной строки
#                    в Makefile, поэтому мерить её обязательно.
#   etalon           те же четыре задачи, написанные на C руками
#
# Макросы ставятся в файле МОДУЛЯ, а не в рантайме: сам рантайм обязан
# собираться обычным, иначе в нём нечего было бы звать.
#
# Использование: sobrat.sh КАТАЛОГ-СБОРКИ
set -eu
OUT="${1:?нужен каталог сборки}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PROG="$ROOT/benchmarks/zamer-skorosti/programs"

rm -rf "$OUT"
mkdir -p "$OUT/base"

# Предел шагов поднят, потому что задачи замера крупнее любой учебной: при
# умолчании 1 000 000 сортировка ста тысяч чисел упёрлась бы в предел и
# отказала. Сам СЧЁТЧИК при этом остаётся — его цену и меряем.
node "$ROOT/flang/bin/flang.mjs" emit "$PROG/zadachi.flang" --target c --out "$OUT/base" \
  --max-steps 2000000000 > "$OUT/emit.json"
make -C "$OUT/base" -j4 > "$OUT/base/make.log" 2>&1

patch_module() {
  local dir="$1"; shift
  python3 - "$dir/zadachi_zamera.c" "$@" <<'PY'
import sys
path, *names = sys.argv[1:]
text = open(path, encoding="utf-8").read()
marker = '#include "zadachi_zamera.h"'
assert marker in text, "не найден include модуля"
lines = ["", "/* ЗАМЕР: проверки вычеркнуты вместе с вызовами. */"]
for name in names:
    lines.append("#undef %s" % name)
    if name == "fl_leave":
        lines.append("#define fl_leave(ctx) ((void)0)")
    else:
        lines.append("#define %s(ctx, function, error) FL_OK" % name)
open(path, "w", encoding="utf-8").write(text.replace(marker, marker + "\n".join(lines) + "\n", 1))
PY
}

for variant in bez-schetchika bez-vhoda lto lto-bez-tipov; do
  cp -r "$OUT/base" "$OUT/$variant"
  rm -f "$OUT/$variant"/*.o "$OUT/$variant"/flang_cli "$OUT/$variant"/*.a "$OUT/$variant"/make.log
done

patch_module "$OUT/bez-schetchika" fl_tick
patch_module "$OUT/bez-vhoda" fl_tick fl_enter fl_leave

# Проверки типов в рантайме — те самые, которые тайпчекер уже сделал на
# исходнике: fl_add смотрит теги обоих значений перед каждым сложением. Здесь
# они выключены, чтобы стало видно, сколько стоит именно эта повторная работа,
# а сколько — сама ширина значения.
python3 - "$OUT/lto-bez-tipov/flang_runtime.c" <<'PY'
import sys, re
path = sys.argv[1]
text = open(path, encoding="utf-8").read()
for имя in ("fl_numbers", "fl_order"):
    начало = text.index("static fl_status %s(" % имя)
    открытая = text.index("{", начало)
    глубина = 0
    i = открытая
    while True:
        if text[i] == "{":
            глубина += 1
        elif text[i] == "}":
            глубина -= 1
            if глубина == 0:
                break
        i += 1
    заголовок = text[начало:открытая]
    подавление = "".join("  (void)%s;\n" % имя for имя in re.findall(r"(\w+)(?:,|\))", заголовок.split("(", 1)[1]))
    text = text[:открытая] + "{\n" + подавление + "  return FL_OK;\n}" + text[i + 1:]
open(path, "w", encoding="utf-8").write(text)
PY

make -C "$OUT/bez-schetchika" -j4 > "$OUT/bez-schetchika/make.log" 2>&1
make -C "$OUT/bez-vhoda" -j4 > "$OUT/bez-vhoda/make.log" 2>&1
make -C "$OUT/lto" -j4 CFLAGS="-std=c99 -Wall -Wextra -pedantic -O2 -flto" > "$OUT/lto/make.log" 2>&1
make -C "$OUT/lto-bez-tipov" -j4 CFLAGS="-std=c99 -O2 -flto -Wno-unused" > "$OUT/lto-bez-tipov/make.log" 2>&1

cc -std=c99 -Wall -Wextra -O2 -o "$OUT/etalon" "$PROG/etalon.c" -lm

echo "собрано в $OUT"
