#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# Перепечатка точки раскрутки `bootstrap/` — САМИМ ДВОИЧНЫМ, без Node.
#
# ── Зачем этот файл ─────────────────────────────────────────────────────────
# Компилятор написан на самом языке (`flang/self/`), а в дереве лежит уже
# напечатанным в C99 (`bootstrap/`). До этого файла перепечатать точку раскрутки
# можно было ровно одним способом — `node scripts/bootstrap-c.mjs`, — то есть
# Node лежал на пути СБОРКИ языка, а не только в проверках. Пока это так,
# реализацию на JavaScript нельзя удалить физически: без неё дерево не
# восстановить из исходников.
#
# Здесь тот же круг замкнут без Node. Курица и яйцо решается тем, что двоичный
# уже лежит в дереве собранным: `make -C bootstrap` даёт `bootstrap/flang`, и
# он умеет печатать компилятор в C (`flang emit --target c`, реализовано в
# `flang/src/emit/c/flang_repl.c`).
#
# ── Как пользоваться ────────────────────────────────────────────────────────
#   sh scripts/bootstrap-c.sh            перепечатать bootstrap/ двоичным
#   sh scripts/bootstrap-c.sh --check    сверить закоммиченное с печатью, код 1 при расхождении
#
#   FLANG=/путь/к/flang sh scripts/bootstrap-c.sh    печатать заданным двоичным
#   MAKE=gmake CC=clang  sh scripts/bootstrap-c.sh    чем собирать, если двоичного нет
#
# ── Ступени, как у всякой раскрутки ─────────────────────────────────────────
# Печатает СТУПЕНЬ N (двоичный, собранный из того, что лежит в дереве сейчас), а
# печатает она СЕГОДНЯШНИЕ исходники. Если правка тронула сам слой печати
# (`flang/self/emit-c.flang`), одного захода мало: первый заход даёт печать по
# старым правилам от новых исходников. Тогда — пересобрать и перепечатать ещё
# раз, пока два захода подряд не дадут одно и то же. Скрипт об этом говорит сам:
# после записи он называет, сколько файлов тронуто.
#
# ── Рецепт печати: ЕДИНСТВЕННАЯ ЗАПИСЬ ──────────────────────────────────────
# Пределы попадают прямо в напечатанный байт (`#define FL_MAX_STEPS` в
# `bootstrap/flang_runtime.h`), поэтому совпадение байт в байт точки раскрутки,
# релизного архива и обеих сторон сверки держится на том, что число ровно одно.
# Записаны они ЗДЕСЬ, а не в скрипте на JavaScript, ровно потому, что этот файл
# переживёт удаление реализации на JavaScript, а тот — нет.
# Второй путь печати — `scripts/raskrutka.sh`; числа там обязаны совпадать.
set -eu

FLANG_ENTRY='flang/self/bootstrap/compiler.flang'
FLANG_OUT='bootstrap'
FLANG_RUNTIME_SRC='flang/src/emit/c'
# Предел шагов поднят с 40 млн до миллиарда 22 августа 2026, и не по вкусу:
# после двух новых правил вывода проверка компилятора самим собой съедала
# 40 000 001 шаг из 40 000 000 и обрывалась — печать отменялась совсем.
# То же число уже стояло в scripts/raskrutka.sh (MAX_STEPS), а здесь отстало;
# два пути печати с разными пределами дают разный flang_runtime.h и ломают
# побайтовое совпадение. Теперь число одно на оба пути.
#
# 23 августа 2026 миллиард подняли до четырёх — по замеру ведомости
# flang/stdlib/json.flang, — но подняли ТОЛЬКО в scripts/raskrutka.sh, и правило
# «число одно на оба пути» снова разъехалось. Замечено сторожем входов, дословно:
#
#   $ sh scripts/raskrutka.sh --bystro
#   • печать зовётся иначе: было «предел-шагов 1000000000», стало «предел-шагов 4000000000»
#
# Здесь число возвращено к одному. Довод самого числа — в scripts/raskrutka.sh
# над MAX_STEPS; дублировать его сюда значило бы завести второй довод, который
# разъедется следующим.
#
# 29 августа 2026 число поднято с 4 000 000 000 до 300 000 000 000, и снова в
# обоих путях сразу. Коротко, полностью — в scripts/raskrutka.sh и в
# docs/reprint-cost.md: ключ «--max-steps» у «emit» НЕ ограничивает этот прогон,
# он только клеймит потолок в вывод, то есть задаёт потолок СЛЕДУЮЩЕГО семени.
# А самый дорогой шаг печати сегодня стоит больше ста миллиардов витков (замер
# 29 августа: «Суд ядра о программе» не уместился в 100 000 000 000), и семя с
# потолком 4 000 000 000 перепечатать дерево не может — 24 августа оно на этом
# числе и умерло, потратив 3 ч 02 мин и 216,9 ГиБ впустую.
FLANG_MAX_STEPS='300000000000'
FLANG_MAX_DEPTH='20000'
# Тот же пол, что в scripts/raskrutka.sh, и по тому же доводу: печатать с
# потолком ниже уже измеренного шага — значит заведомо не дойти до конца.
FLANG_POL_IZMERENNYY='100000005443'
# Что в `bootstrap/` НЕ относится к печати: проза и продукты сборки. Тот же
# Файл на JavaScript, где этот список дублировался, снят 21 августа 2026.
FLANG_NOT_EMITTED='README.md flang flang.exe flang_cli flang_cli.exe libcompiler_flang.a'

koren=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$koren"

if [ "$FLANG_MAX_STEPS" -lt "$FLANG_POL_IZMERENNYY" ]; then
  echo "bootstrap-c.sh: потолок $FLANG_MAX_STEPS ниже измеренного пола $FLANG_POL_IZMERENNYY —" >&2
  echo "семя с таким потолком не сможет перепечатать дерево." >&2
  exit 2
fi

sverit=0
if [ "${1:-}" = '--check' ]; then
  sverit=1
elif [ $# -gt 0 ]; then
  echo "bootstrap-c.sh: непонятный ключ «$1»; есть один — «--check»" >&2
  exit 2
fi

# ── двоичный: заданный снаружи или собранный из точки раскрутки ─────────────
: "${MAKE:=make}"
dvoichnyy="${FLANG:-}"
if [ -z "$dvoichnyy" ]; then
  dvoichnyy="$koren/$FLANG_OUT/flang"
  if [ ! -x "$dvoichnyy" ]; then
    echo "двоичного нет — собираю точку раскрутки: $MAKE -C $FLANG_OUT"
    "$MAKE" -C "$FLANG_OUT" >/dev/null
  fi
fi
if [ ! -x "$dvoichnyy" ]; then
  echo "bootstrap-c.sh: не найден двоичный «$dvoichnyy». Соберите его: $MAKE -C $FLANG_OUT" >&2
  exit 2
fi

kuda=$(mktemp -d "${TMPDIR:-/srv/tmp}/flang-tochka.XXXXXX")
trap 'rm -rf "$kuda"' EXIT INT TERM

echo "компилятор: $FLANG_ENTRY"
echo "печатает:   $dvoichnyy"
"$dvoichnyy" emit "$FLANG_ENTRY" \
  --target c \
  --cli \
  --repl \
  --max-steps "$FLANG_MAX_STEPS" \
  --max-depth "$FLANG_MAX_DEPTH" \
  --runtime "$FLANG_RUNTIME_SRC" \
  --out "$kuda"

# ── сверка набора файлов и байтов ───────────────────────────────────────────
# Сверяется и НАБОР: файл, оставшийся в `bootstrap/` от прошлой печати, — такая
# же ложь, как разошедшееся содержимое, и `cc *.c` соберёт его вместе с
# остальным.
bed=0
vsego=0
troputo=0

lishnie=''
for put in "$koren/$FLANG_OUT"/*; do
  imya=$(basename -- "$put")
  case " $FLANG_NOT_EMITTED " in *" $imya "*) continue ;; esac
  case "$imya" in *.o|*.obj|*.a|*.d) continue ;; esac
  [ -e "$kuda/$imya" ] && continue
  lishnie="$lishnie $imya"
done

for put in "$kuda"/*; do
  imya=$(basename -- "$put")
  bayt=$(wc -c <"$put")
  vsego=$((vsego + bayt))
  if [ ! -e "$koren/$FLANG_OUT/$imya" ]; then
    echo "  $FLANG_OUT/$imya: печать даёт $bayt байт, а в дереве файла нет" >&2
    bed=$((bed + 1))
    troputo=$((troputo + 1))
    [ "$sverit" = 1 ] || cp -- "$put" "$koren/$FLANG_OUT/$imya"
    continue
  fi
  if cmp -s -- "$put" "$koren/$FLANG_OUT/$imya"; then
    continue
  fi
  bylo=$(wc -c <"$koren/$FLANG_OUT/$imya")
  echo "  $FLANG_OUT/$imya: в дереве $bylo байт, печать даёт $bayt" >&2
  bed=$((bed + 1))
  troputo=$((troputo + 1))
  [ "$sverit" = 1 ] || cp -- "$put" "$koren/$FLANG_OUT/$imya"
done

for imya in $lishnie; do
  echo "  $FLANG_OUT/$imya: лежит в дереве, но печать его не даёт — след прошлой перепечатки" >&2
  bed=$((bed + 1))
  troputo=$((troputo + 1))
  [ "$sverit" = 1 ] || rm -f -- "$koren/$FLANG_OUT/$imya"
done

fajlov=$(ls -1 "$kuda" | wc -l | tr -d ' ')

if [ "$sverit" = 1 ]; then
  if [ "$bed" = 0 ]; then
    echo "точка раскрутки $FLANG_OUT/ совпадает с печатью двоичного: $fajlov файлов, $vsego байт"
    exit 0
  fi
  echo "точка раскрутки $FLANG_OUT/ разошлась с печатью двоичного — расхождений $bed" >&2
  echo "Перепечатайте её в том же коммите, что и правку компилятора: sh scripts/bootstrap-c.sh" >&2
  exit 1
fi

echo "итого $fajlov файлов, $vsego байт в $FLANG_OUT/; тронуто $troputo"
if [ "$troputo" != 0 ]; then
  echo "печать тронула $troputo файлов — пересоберите двоичный и перепечатайте ещё раз,"
  echo "пока два захода подряд не дадут одно и то же: $MAKE -C $FLANG_OUT && sh scripts/bootstrap-c.sh --check"
fi
echo "сборка без Node: $MAKE -C $FLANG_OUT"
