#!/bin/sh
# Второе ядро: то же дерево, в напечатанном семени переписано ОДНО правило —
# «Предел ветвления» с 4 на 0. Приём Ч183: дерево побайтово одно, а вердикты
# разные, и отличить их можно только отпечатком ПРОВЕРЯЛЬЩИКА.
#
#   sh benchmarks/кеш-приговоров/второе-ядро.sh [<куда собрать>]
#
# Имена переменных латиницей: оболочка кириллицу в них не берёт.
set -eu
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(CDPATH= cd -- "$HERE/../.." && pwd)
KUDA=${1:-$(mktemp -d)}
rm -rf "$KUDA"
mkdir -p "$KUDA"
cp "$ROOT/bootstrap/Makefile" "$ROOT/bootstrap"/*.c "$ROOT/bootstrap"/*.h "$KUDA/"
LC_ALL=C.UTF-8 python3 - "$KUDA/compiler_flang.c" <<'PY'
import io, sys
put = sys.argv[1]
t = io.open(put, encoding="utf-8").read()
staroe = """fl_status compiler_flang_predel_vetvleniya(fl_ctx *ctx, fl_value *result, fl_error *error) {
  (void)ctx;
  (void)error;
  *result = fl_number(4.0);"""
if t.count(staroe) != 1:
    raise SystemExit("«Предел ветвления» в семени не один: %d" % t.count(staroe))
io.open(put, "w", encoding="utf-8").write(t.replace(staroe, staroe.replace("fl_number(4.0)", "fl_number(0.0)")))
print("правило переписано: «Предел ветвления» 4 -> 0")
PY
cd "$KUDA"
LC_ALL=C.UTF-8 make -j8 >/dev/null 2>"$KUDA/sborka.err" || { tail -20 "$KUDA/sborka.err"; exit 1; }
echo "второе ядро собрано: $KUDA/flang"
