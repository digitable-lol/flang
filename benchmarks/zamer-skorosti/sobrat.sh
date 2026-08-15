#!/bin/bash
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# Собирает всё, что нужно замеру, в один каталог.
#
#   base/       напечатанный C как есть
#   bez-vhoda/  он же, но с вычеркнутыми fl_enter/fl_leave — то есть без счётчика
#               шагов, без счётчика глубины и без сторожа стека. Вычеркнуты они
#               макросом в файле МОДУЛЯ (рантайм при этом собирается обычным,
#               иначе не собрался бы он сам), поэтому исчезает и сам вызов, а не
#               только его тело.
#   etalon      те же четыре задачи, написанные на C руками
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

cp -r "$OUT/base" "$OUT/bez-vhoda"
rm -f "$OUT"/bez-vhoda/*.o "$OUT"/bez-vhoda/flang_cli "$OUT"/bez-vhoda/*.a
MOD="$OUT/bez-vhoda/zadachi_zamera.c"
python3 - "$MOD" <<'PY'
import sys
path = sys.argv[1]
text = open(path, encoding="utf-8").read()
marker = '#include "zadachi_zamera.h"'
patch = marker + """

/* ЗАМЕР: входные проверки вычеркнуты целиком — ни шагов, ни глубины, ни стека. */
#undef fl_enter
#undef fl_leave
#define fl_enter(ctx, function, error) FL_OK
#define fl_leave(ctx) ((void)0)
"""
assert marker in text, "не найден include модуля"
open(path, "w", encoding="utf-8").write(text.replace(marker, patch, 1))
PY
make -C "$OUT/bez-vhoda" -j4 > "$OUT/bez-vhoda/make.log" 2>&1

cc -std=c99 -Wall -Wextra -O2 -o "$OUT/etalon" "$PROG/etalon.c" -lm

echo "собрано в $OUT"
