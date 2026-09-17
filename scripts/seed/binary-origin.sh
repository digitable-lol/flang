#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# Отказ судить двоичным, которого нельзя собрать из bootstrap/ этого дерева:
# быстрая сверка — по именам таблицы символов, точная — побайтовой пересборкой.
# Ответ «сошлось» помнится в .git по отпечаткам двоичного, семени, этого файла и cc.
#
# Как звать:
#   sh scripts/seed/binary-origin.sh                    быстрая сверка (полсекунды)
#   sh scripts/seed/binary-origin.sh --точно            точная (пересборка, ~65 с)
#   sh scripts/seed/binary-origin.sh --чем "<имя>"      назвать, кто спрашивает
#   sh scripts/seed/binary-origin.sh -- <команда…>      отказать или запустить
#   sh scripts/seed/binary-origin.sh --подлог           самопроверка: два подлога
#   Латиницей то же: --exact, --what, --forgery. Судится FLANG_BINARY, иначе
#   FLANG_BIN, иначе bootstrap/flang. Обход (вслух): FLANG_BINARY_UNKNOWN_OK=1.
#
# Коды: 0 — двоичный отвечает семени (или сработал ключ обхода); 1 — не отвечает,
#       судить отказано; 2 — только у --подлог: часть самопроверки не снята (нет
#       strip); 3 — сверить не удалось (нет двоичного, readelf или таблицы имён).
#       Коды 2 и 3 — НЕ пройденная проверка.
# Почему так и что снято прогонами:
#   docs/zettel/the-binary-is-judged-by-its-symbol-names-not-by-its-size-or-strings.md
set -eu

export LC_ALL=C

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
BYPASS=FLANG_BINARY_UNKNOWN_OK

err() { printf '%s\n' "$*" >&2; }

fingerprint() {
  if command -v md5sum >/dev/null 2>&1; then md5sum "$1" | cut -d' ' -f1
  elif command -v md5 >/dev/null 2>&1; then md5 -q "$1"
  else cksum "$1" | cut -d' ' -f1
  fi
}

# Размер файла. `stat` разошёлся между GNU и BSD доводами, `wc -c` — нет.
bytes() { wc -c < "$1" | tr -d ' '; }

cores() { (getconf _NPROCESSORS_ONLN 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4) | tr -d ' '; }

what="эта проверка"
exact=0
forgery=0
while [ $# -gt 0 ]; do
  case $1 in
    --точно|--exact) exact=1; shift ;;
    --подлог|--forgery) forgery=1; shift ;;
    --чем|--what) [ $# -ge 2 ] || { err "--чем без имени"; exit 3; }; what=$2; shift 2 ;;
    --) shift; break ;;
    -*) err "неизвестный довод: $1"; exit 3 ;;
    *) break ;;
  esac
done

bin=${FLANG_BINARY:-${FLANG_BIN:-"$ROOT/bootstrap/flang"}}

# ── Обход по ключу: разрешаем, но вслух ─────────────────────────────────────
if [ -n "${FLANG_BINARY_UNKNOWN_OK:-}" ] && [ "$forgery" = 0 ]; then
  err "$BYPASS: судим двоичным без сверки с семенем по прямому указанию."
  err "Двоичный: $bin"
  if [ $# -gt 0 ]; then exec "$@"; fi
  exit 0
fi

cannot_check() {
  err "СВЕРИТЬ ДВОИЧНЫЙ НЕ УДАЛОСЬ — судить о доказательствах нельзя: $what"
  err ""
  err "$1"
  err ""
  err "Пропуск не есть пройденная проверка: судить всё равно —"
  err "  $BYPASS=1 <та же команда>"
  exit 3
}

[ -f "$bin" ] || cannot_check "двоичного нет вовсе: $bin
Соберите его: make -C bootstrap"
[ -x "$bin" ] || cannot_check "двоичный есть, но не запускается: $bin"

SEED_FILES='compiler_flang.c compiler_flang.h flang_cli.c flang_repl.c flang_runtime.c flang_runtime.h'
for f in $SEED_FILES; do
  [ -f "$ROOT/bootstrap/$f" ] || cannot_check "в дереве нет файла семени bootstrap/$f — сверять не с чем"
done

# ── ПОДЛОГ: сторож обязан уметь покраснеть ──────────────────────────────────
if [ "$forgery" = 1 ]; then
  command -v "${CC:-cc}" >/dev/null 2>&1 || cannot_check "нет ${CC:-cc} — подложить нечего"
  work=$(mktemp -d "${TMPDIR:-/tmp}/binary-origin-forgery.XXXXXX") \
    || cannot_check "не завёлся временный каталог"
  trap 'rm -rf "$work"' EXIT INT TERM HUP
  cat > "$work/forged.c" <<'FORGED'
int flang_binary_origin_forged_name(void) { return 0; }
int main(void) { return flang_binary_origin_forged_name(); }
FORGED
  "${CC:-cc}" -o "$work/forged" "$work/forged.c" 2>/dev/null \
    || cannot_check "подложную программу не удалось собрать"

  out=$(FLANG_BINARY_UNKNOWN_OK= FLANG_BINARY_ORIGIN_NO_MEMORY=1 FLANG_BINARY= \
        FLANG_BIN="$work/forged" sh "$0" 2>&1) && code=0 || code=$?
  if [ "$code" != 1 ]; then
    err "СТОРОЖ СЛЕП: на подложенной программе он ответил кодом $code вместо 1."
    printf '%s\n' "$out" >&2
    exit 1
  fi
  case $out in
    *flang_binary_origin_forged_name*) ;;
    *) err "СТОРОЖ ОТКАЗАЛ, но не назвал подложное имя — отказ не по делу:"
       printf '%s\n' "$out" >&2
       exit 1 ;;
  esac
  echo "подлог именем: сторож покраснел и назвал имя — видит."

  if ! command -v strip >/dev/null 2>&1; then
    err "ЧАСТЬ САМОПРОВЕРКИ НЕ СНЯТА: нет strip, подлог снятой таблицей имён не сделан."
    err "Пропуск не есть пройденная проверка."
    exit 2
  fi
  if ! cp "$bin" "$work/stripped" || ! strip "$work/stripped" 2>/dev/null; then
    cannot_check "снять таблицу имён с копии двоичного не удалось"
  fi

  out=$(FLANG_BINARY_UNKNOWN_OK= FLANG_BINARY_ORIGIN_NO_MEMORY=1 FLANG_BINARY= \
        FLANG_BIN="$work/stripped" sh "$0" 2>&1) && code=0 || code=$?
  if [ "$code" != 3 ]; then
    err "СТОРОЖ СЛЕП: на двоичном со снятой таблицей имён он ответил кодом $code вместо 3."
    printf '%s\n' "$out" >&2
    exit 1
  fi
  echo "подлог пустотой: сторож отказал кодом 3, а не зазеленел, — видит."
  exit 0
fi


# ── Память ответа ───────────────────────────────────────────────────────────
remember_key() {
  cat "$ROOT/bootstrap/compiler_flang.c" "$ROOT/bootstrap/compiler_flang.h" \
      "$ROOT/bootstrap/flang_cli.c" "$ROOT/bootstrap/flang_repl.c" \
      "$ROOT/bootstrap/flang_runtime.c" "$ROOT/bootstrap/flang_runtime.h" > "$1/seed-whole"
  printf '%s %s %s %s %s\n' "$2" "$(fingerprint "$bin")" "$(fingerprint "$1/seed-whole")" \
    "$(fingerprint "$0")" "$("${CC:-cc}" --version 2>/dev/null | head -1)"
  rm -f "$1/seed-whole"
}

memory=''
if [ -n "${FLANG_BINARY_ORIGIN_NO_MEMORY:-}" ]; then
  memory=''
elif git_dir=$(cd "$ROOT" && git rev-parse --git-dir 2>/dev/null); then
  case $git_dir in
    /*) memory=$git_dir/binary-origin.checked ;;
    *)  memory=$ROOT/$git_dir/binary-origin.checked ;;
  esac
fi

remembered() {
  [ -n "$memory" ] && [ -f "$memory" ] && grep -qxF "$1" "$memory"
}

remember() {
  [ -n "$memory" ] || return 0
  mine=$(fingerprint "$0")
  if {
       if [ -f "$memory" ]; then
         awk -v mine="$mine" '$4 == mine' "$memory" | grep -vxF "$1" || true
       fi
       printf '%s\n' "$1"
     } > "$memory.tmp" 2>/dev/null
  then
    mv "$memory.tmp" "$memory" 2>/dev/null || rm -f "$memory.tmp"
  else
    rm -f "$memory.tmp"
  fi
  return 0
}

# `exec` подменяет процесс, и ловушка EXIT уже не сработает: убираем сами.
run_and_leave() {
  work_dir=$1; shift
  if [ -n "$work_dir" ]; then rm -rf "$work_dir"; fi
  trap - EXIT INT TERM HUP
  exec "$@"
}

# ── ТОЧНАЯ СВЕРКА ───────────────────────────────────────────────────────────
if [ "$exact" = 1 ]; then
  command -v make >/dev/null 2>&1 || cannot_check "нет make — пересобрать нечем"
  command -v "${CC:-cc}" >/dev/null 2>&1 || cannot_check "нет ${CC:-cc} — пересобрать нечем"

  work=$(mktemp -d "${TMPDIR:-/tmp}/binary-origin.XXXXXX") || cannot_check "не завёлся временный каталог"
  trap 'rm -rf "$work"' EXIT INT TERM HUP

  # В bootstrap/ ничего не пишется даже временно: он и есть предмет сверки.
  stamp=$(remember_key "$work" побайтово)
  cc_id=$("${CC:-cc}" --version 2>/dev/null | head -1)
  if remembered "$stamp"; then
    if [ $# -gt 0 ]; then run_and_leave "$work" "$@"; fi
    exit 0
  fi

  cp "$ROOT/bootstrap/Makefile" "$work/" 2>/dev/null || cannot_check "нет bootstrap/Makefile"
  for f in $SEED_FILES; do
    cp "$ROOT/bootstrap/$f" "$work/"
  done
  if ! (cd "$work" && make -j"$(cores)" >"$work/build.log" 2>&1); then
    err "сборка из семени не прошла — вот её конец:"
    tail -20 "$work/build.log" >&2
    cannot_check "собрать компилятор из bootstrap/ этого дерева не удалось"
  fi

  if cmp -s "$work/flang" "$bin"; then
    remember "$stamp"
    if [ $# -gt 0 ]; then run_and_leave "$work" "$@"; fi
    exit 0
  fi

  err "ОТКАЗЫВАЮСЬ СУДИТЬ: двоичный не собирается из семени этого дерева: $what"
  err ""
  err "  двоичный в дереве: $(fingerprint "$bin")  $(bytes "$bin") байт"
  err "  сборка из семени:  $(fingerprint "$work/flang")  $(bytes "$work/flang") байт"
  err "  собрано: ${CC:-cc} — $cc_id"
  err ""
  err "Это тот же случай, что 23 августа 2026: в двадцати рабочих копиях лежал"
  err "двоичный, собранный из невлитых веток. Отличий не было видно ни в номере"
  err "версии, ни в печатных строках — только в коде."
  err ""
  err "Чинится одним из двух:"
  err "  * пересобрать двоичный из дерева:  make -C bootstrap"
  err "  * или закоммитить то, из чего он на самом деле собран."
  err ""
  err "Судить всё равно, зная это: $BYPASS=1 <та же команда>"
  exit 1
fi

# ── БЫСТРАЯ СВЕРКА ──────────────────────────────────────────────────────────
command -v readelf >/dev/null 2>&1 || cannot_check "нет readelf — имена из двоичного взять нечем.
Точная сверка readelf не требует: sh scripts/seed/binary-origin.sh --точно"

# Имена, которые кладёт не компилятор flang, а компоновщик и запуск программы.
LINKER_NAMES='_DYNAMIC
_GLOBAL_OFFSET_TABLE_
_IO_stdin_used
__FRAME_END__
__TMC_END__
__abi_tag
__do_global_dtors_aux
__do_global_dtors_aux_fini_array_entry
__dso_handle
__frame_dummy_init_array_entry
_fini
_init
_start
completed
deregister_tm_clones
frame_dummy
register_tm_clones'

work=$(mktemp -d "${TMPDIR:-/tmp}/binary-origin.XXXXXX") || cannot_check "не завёлся временный каталог"
trap 'rm -rf "$work"' EXIT INT TERM HUP

stamp=$(remember_key "$work" поименно)
if remembered "$stamp"; then
  if [ $# -gt 0 ]; then run_and_leave "$work" "$@"; fi
  exit 0
fi

readelf -SW "$bin" 2>/dev/null | grep -q '[[:space:]]\.symtab[[:space:]]' \
  || cannot_check "у двоичного снята таблица имён (.symtab) — сверять по именам нечего.
Пустота не есть совпадение. Побайтовая сверка это переживёт:
  sh scripts/seed/binary-origin.sh --точно"

readelf -sW "$bin" 2>/dev/null | awk '
  /^Symbol table/ { ours = ($0 ~ /\.symtab/); next }
  function base(n,   prev) {
    do {
      prev = n
      sub(/\.(lto_priv|isra|constprop|part|cold|localalias)(\.[0-9]+)?$/, "", n)
      sub(/\.[0-9]+$/, "", n)
    } while (n != prev)
    return n
  }
  ours && ($4 == "FUNC" || $4 == "OBJECT") && $7 != "UND" && $8 != "" {
    n = $8; sub(/@.*/, "", n)
    if (n != "") print base(n)
  }
' | sort -u > "$work/binary-names"

[ -s "$work/binary-names" ] || cannot_check "в таблице имён двоичного нет ни одного
определённого имени — читать нечего. Побайтовая сверка это переживёт:
  sh scripts/seed/binary-origin.sh --точно"

grep -h -o '[A-Za-z_][A-Za-z0-9_]*' \
  "$ROOT/bootstrap/compiler_flang.c" "$ROOT/bootstrap/compiler_flang.h" \
  "$ROOT/bootstrap/flang_cli.c" "$ROOT/bootstrap/flang_repl.c" \
  "$ROOT/bootstrap/flang_runtime.c" "$ROOT/bootstrap/flang_runtime.h" \
  | sort -u > "$work/seed-names"

printf '%s\n' "$LINKER_NAMES" | sort -u > "$work/linker-names"
sort -u -m "$work/seed-names" "$work/linker-names" > "$work/known-names"
comm -23 "$work/binary-names" "$work/known-names" > "$work/foreign-names"

n=$(wc -l < "$work/foreign-names" | tr -d ' ')
if [ "$n" = 0 ]; then
  remember "$stamp"
  if [ $# -gt 0 ]; then run_and_leave "$work" "$@"; fi
  exit 0
fi

err "ОТКАЗЫВАЮСЬ СУДИТЬ: в двоичном есть код, которого нет в семени: $what"
err ""
err "  двоичный: $bin"
err "  отпечаток: $(fingerprint "$bin"), $(bytes "$bin") байт"
err ""
err "Имён, которых нет ни в bootstrap/*.c, ни в bootstrap/*.h: $n"
sed 's/^/  • /' "$work/foreign-names" | head -12 >&2
if [ "$n" -gt 12 ]; then err "  …и ещё $((n - 12))"; fi
err ""
err "Двоичный собран не из этого семени. Причин ровно две, и обе чинятся:"
err ""
err "  1. Двоичный СВЕЖЕЕ семени: собран из правки, которой в bootstrap/ нет."
err "     Ровно так 23 августа 2026 в двадцати рабочих копиях оказался"
err "     компилятор из двух невлитых веток — и шесть суток судил язык с"
err "     доказательствами. Чинится: закоммитить то, из чего он собран, или"
err "     пересобрать из дерева."
err "  2. Двоичный ОТСТАЛ: семя перепечатали, а его не пересобрали."
err "     Чинится:  make -C bootstrap"
err ""
err "Какая из двух — видно по именам выше: имя из вашей же правки значит"
err "первое, десятки незнакомых имён семени — второе."
err ""
err "Побайтовая сверка (около 65 с): sh scripts/seed/binary-origin.sh --точно"
err "Судить всё равно, зная это: $BYPASS=1 <та же команда>"
exit 1
