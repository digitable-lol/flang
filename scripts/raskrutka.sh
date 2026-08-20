#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# Точка раскрутки: перепечатать её двоичным компилятором и сверить с деревом.
#
# ── Зачем ────────────────────────────────────────────────────────────────────
# В bootstrap/ лежит компилятор flang, напечатанный в C99 и закоммиченный. Это
# семя: из него одним `make` собирается двоичный компилятор, и больше для сборки
# ничего не нужно. Семя обязано совпадать с тем, что печатают текущие исходники,
# иначе дерево и точка раскрутки тихо разъедутся.
#
# Раньше перепечатывал scripts/bootstrap-c.mjs — он звал реализацию компилятора
# на JavaScript. Реализации больше нет (коммит fe8e8a37), и перепечатывает теперь
# сам двоичный: flang₁ печатает flang₂, и они обязаны совпасть байт в байт.
#
# ── Почему оболочка, а не цель в bootstrap/Makefile и не план на flang ───────
# Не bootstrap/Makefile: он САМ один из семи напечатанных файлов и сверяется
# байт в байт. Дописанная туда руками цель исчезнет при первой же перепечатке, а
# до этого будет валить сверку. Место, которое проверяют на совпадение, править
# руками нельзя.
#
# Не план на flang (`flang io`): тогда проверка двоичного зависела бы ещё и от
# его исполнителя планов — то есть от второй части той же программы, которую
# проверяем. Плюс сверка означала бы чтение 23 МБ в строки языка.
#
# Оболочка не приносит на путь сборки ничего нового: sh, make и cc там уже нужны,
# а cmp лежит рядом с make у всех. Node не нужен ни на одном шаге.
#
# ИМЕНА ЗДЕСЬ ЛАТИНИЦЕЙ, в отличие от остального дерева: ни dash, ни bash не
# принимают кириллицу в именах переменных и функций (проверено обоими). Русский
# остался там, где он от оболочки не зависит, — в пояснениях и в выводе.
#
# ── Как звать ────────────────────────────────────────────────────────────────
#   sh scripts/raskrutka.sh              перепечатать bootstrap/ из исходников
#   sh scripts/raskrutka.sh --check      сверить закоммиченное с печатью
#   sh scripts/raskrutka.sh --stroki     только быстрая проверка строк рантайма
#
# Ключи среды:
#   FLANG=<путь>   каким двоичным печатать (по умолчанию bootstrap/flang,
#                  а если его нет — собрать `make -C bootstrap`)

set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
INPUT=flang/self/bootstrap/compiler.flang
DIR=bootstrap
RUNTIME=flang/src/emit/c

# Пределы печати САМОГО КОМПИЛЯТОРА. Они уезжают в напечатанный байт
# (#define FL_MAX_STEPS), то есть участвуют в побайтовом совпадении. Умолчания
# бэкенда (10^6 шагов, 10^4 глубины) для компилятора малы: он разбирает 119 тысяч
# токенов и упирается в них на связывании вызовов. Ровно так уехал v0.4.1.
MAX_STEPS=40000000
MAX_DEPTH=20000

# Что в bootstrap/ НЕ относится к точке раскрутки: пояснение и продукты сборки.
# Список повторён здесь затем, чтобы сверка работала и на дереве без .git.
NOT_SEED="README.md flang flang.exe flang_cli flang_cli.exe libcompiler_flang.a"

say() { printf '%s\n' "$*"; }
err() { printf '%s\n' "$*" >&2; }

# ── Быстрая проверка: все строковые литералы C закрыты ───────────────────────
#
# Рантайм, прогонщик и оболочка (flang/src/emit/c/*.c) уезжают в напечатанное
# ДОСЛОВНО. Буквальный перенос строки, попавший внутрь строки C, ломает сборку —
# но узнаётся это на четвёртой минуте работы компилятора C, а после перепечатки
# ещё и оседает в семени. Здесь то же самое ловится за секунду.
check_literals() {
  awk '
    FNR == 1 { state = 0 }
    {
      line = $0
      n = length(line)
      i = 1
      while (i <= n) {
        c = substr(line, i, 1)
        d = substr(line, i + 1, 1)
        if (state == 0) {
          if (c == "/" && d == "/") break
          if (c == "/" && d == "*") { state = 3; i += 2; continue }
          if (c == "\"") state = 1
          else if (c == "\047") state = 2
        } else if (state == 1) {
          if (c == "\\") { i += 2; continue }
          if (c == "\"") state = 0
        } else if (state == 2) {
          if (c == "\\") { i += 2; continue }
          if (c == "\047") state = 0
        } else if (state == 3) {
          if (c == "*" && d == "/") { state = 0; i += 2; continue }
        }
        i += 1
      }
      if (state == 1 || state == 2) {
        # Перенос внутри литерала законен ровно тогда, когда строка кончается
        # нечётным числом обратных косых: это склейка строк препроцессором.
        tail = 0
        j = n
        while (j >= 1 && substr(line, j, 1) == "\\") { tail += 1; j -= 1 }
        if (tail % 2 == 0) {
          what = (state == 1) ? "строковый литерал не закрыт к концу строки" \
                              : "символьный литерал не закрыт к концу строки"
          printf "  %s:%d: %s\n", FILENAME, FNR, what > "/dev/stderr"
          bad = 1
          state = 0
        }
      }
    }
    END { exit bad ? 1 : 0 }
  ' "$@"
}

cores() { (getconf _NPROCESSORS_ONLN 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4) | tr -d ' '; }

# ── Двоичный, которым печатаем ───────────────────────────────────────────────
pick_binary() {
  if [ -n "${FLANG:-}" ]; then
    [ -x "$FLANG" ] || { err "FLANG=$FLANG — не исполняемый файл"; exit 3; }
    printf '%s\n' "$FLANG"
    return
  fi
  own=$ROOT/$DIR/flang
  if [ ! -x "$own" ]; then
    err "двоичного нет — собираю из точки раскрутки: make -C $DIR"
    make -C "$ROOT/$DIR" -j"$(cores)" >&2
  fi
  printf '%s\n' "$own"
}

size_of() { wc -c < "$1" | tr -d ' \n'; }

# Имена файлов точки раскрутки, лежащих в дереве: без пояснения и продуктов сборки.
names_in_tree() {
  ( cd "$ROOT/$DIR" 2>/dev/null || exit 0
    for name in *; do
      [ -e "$name" ] || continue
      case " $NOT_SEED " in *" $name "*) continue ;; esac
      case "$name" in *.o|*.obj|*.a|*.d) continue ;; esac
      printf '%s\n' "$name"
    done | sort )
}

# ── Разбор доводов ───────────────────────────────────────────────────────────
mode=print
case "${1:-}" in
  --check) mode=verify ;;
  --stroki) mode=literals ;;
  "") ;;
  *) err "неизвестный довод: $1"; err "звать: sh scripts/raskrutka.sh [--check|--stroki]"; exit 2 ;;
esac

say "строки рантайма $RUNTIME: проверяю, что все литералы закрыты"
if ! check_literals "$ROOT/$RUNTIME"/*.c "$ROOT/$RUNTIME"/*.h; then
  err ""
  err "литерал не закрыт — печатать нельзя: он уедет в точку раскрутки дословно."
  exit 1
fi
say "  все литералы закрыты"
[ "$mode" = literals ] && exit 0

BINARY=$(pick_binary)
TMP=$(mktemp -d "${TMPDIR:-/tmp}/raskrutka.XXXXXX")
trap 'rm -rf "$TMP"' EXIT INT TERM

say "компилятор: $INPUT"
say "печатает:   $BINARY"
say "пределы:    шагов $MAX_STEPS, глубины $MAX_DEPTH"
( cd "$ROOT" && "$BINARY" emit "$INPUT" --target c --out "$TMP" \
    --cli --repl --max-steps "$MAX_STEPS" --max-depth "$MAX_DEPTH" ) >&2

PRINTED=$(cd "$TMP" && ls | sort)
TOTAL=0
COUNT=0
for name in $PRINTED; do
  TOTAL=$((TOTAL + $(size_of "$TMP/$name")))
  COUNT=$((COUNT + 1))
done

if [ "$mode" = verify ]; then
  BAD=0
  # Файл, оставшийся от прошлой печати, — такая же ложь, как разошедшееся
  # содержимое: `cc *.c` соберёт его вместе с остальным.
  for name in $(names_in_tree); do
    found=no
    for printed in $PRINTED; do [ "$printed" = "$name" ] && found=yes; done
    [ "$found" = yes ] && continue
    err "  • $DIR/$name: лежит в дереве, но печать его не даёт — след прошлой перепечатки"
    BAD=$((BAD + 1))
  done
  for name in $PRINTED; do
    target=$ROOT/$DIR/$name
    if [ ! -f "$target" ]; then
      err "  • $DIR/$name: печать даёт $(size_of "$TMP/$name") байт, а в дереве файла нет"
      BAD=$((BAD + 1))
      continue
    fi
    if ! where=$(LC_ALL=C cmp "$target" "$TMP/$name" 2>&1); then
      # Без места дифф на 19 МБ бесполезен, поэтому cmp зовётся ради «байт N,
      # строка M». Говорит он это двумя разными фразами — про несовпавший байт и
      # про оборвавшийся файл, — и обе переводятся здесь на русский.
      where=$(printf '%s' "$where" | sed -e 's/.*differ: char /разошлись на байте /' \
                                         -e 's/.*differ: byte /разошлись на байте /' \
                                         -e 's/.*after byte /один короче: оборвался на байте /' \
                                         -e 's/, line /, строка /')
      err "  • $DIR/$name: $where — в дереве $(size_of "$target") байт, печать даёт $(size_of "$TMP/$name")"
      BAD=$((BAD + 1))
    fi
  done
  if [ "$BAD" -eq 0 ]; then
    say "точка раскрутки $DIR/ совпадает с печатью: $COUNT файлов, $TOTAL байт"
    exit 0
  fi
  err ""
  err "точка раскрутки $DIR/ разошлась с исходниками — расхождений $BAD."
  err "Перепечатайте её в том же коммите, что и правку компилятора: sh scripts/raskrutka.sh"
  exit 1
fi

for name in $PRINTED; do
  cp "$TMP/$name" "$ROOT/$DIR/$name"
  say "  $name  $(size_of "$ROOT/$DIR/$name") байт"
done
say "итого $COUNT файлов, $TOTAL байт в $DIR/"
say "сборка без Node: make -C $DIR"
