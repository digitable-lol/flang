#!/bin/bash
# Двойник собранного стенда: та же программа с ОДНОЙ отменённой правкой.
#
# Нужен, чтобы отвечать на «а что было бы, если бы» прогоном, а не оценкой.
# Двойник собирается из тех же напечатанных исходников, что и оригинал, поэтому
# сравнивать их можно напрямую: отличие ровно одно и названо.
#
#   перебор — `fl_conc_address` снова ищет адресата циклом по таблице процессов,
#             как было до указателя имён. Отвечает на вопрос «делает ли
#             динамическое порождение хуже при переборе».
#   кусок   — куча процесса снова покупается куском 64 КиБ, как было до
#             `fl_arena_init_small`. Отвечает на вопрос «сколько стоил резерв».
#
# $1 вид отмены (перебор|кусок), $2 каталог оригинала, $3 каталог двойника.
set -eu
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
VID=$1; FROM=$(stend "$2"); TO=$3

rm -rf "$TO"
cp -r "$FROM" "$TO"
C="$TO/flang_conc.c"

case "$VID" in
  перебор)
    # Тело `fl_conc_address` заменяется целиком: от заголовка до первой строки
    # «}» в начале строки. Правка текстовая, потому что двойник обязан быть
    # собран из ТЕХ ЖЕ исходников, а не из другой ветки дерева.
    python3 - "$C" <<'PY'
import sys
path = sys.argv[1]
text = open(path, encoding="utf-8").read()
head = "static size_t fl_conc_address(const fl_conc_sched *sched, fl_value name) {"
start = text.index(head)
end = text.index("\n}\n", start) + len("\n}\n")
body = head + """
  size_t index = 0;
  if (name.tag != FL_STRING) {
    return SIZE_MAX;
  }
  for (index = 0; index < sched->proc_count; index += 1) {
    const char *candidate = fl_conc_node(sched, index)->name;
    const size_t bytes = strlen(candidate);
    if (bytes == name.as.string.bytes && memcmp(candidate, name.as.string.utf8, bytes) == 0) {
      return index;
    }
  }
  return SIZE_MAX;
}
"""
open(path, "w", encoding="utf-8").write(text[:start] + body + text[end:])
PY
    ;;
  кусок)
    sed -i 's/fl_arena_init_small(\(&sched[^,]*\), FL_CONC_HEAP_LEAST)/fl_arena_init(\1)/g' "$C"
    # Проверяется ВЫЗОВ, а не объявление константы: `#define` остаётся лежать и
    # никому не мешает, а вот пропущенный вызов означал бы двойника, у которого
    # правка снята наполовину, — и число он дал бы бессмысленное.
    if grep -q 'fl_arena_init_small(&sched' "$C"; then
      echo "правка не снялась целиком: остались вызовы fl_arena_init_small"; exit 1
    fi
    ;;
  *)
    echo "неизвестный вид отмены: $VID (перебор|кусок)"; exit 1 ;;
esac

( cd "$TO" && cc -O2 -std=c99 ./*.c -o flang_cli -lm )
echo "двойник «$VID» собран: $TO"
