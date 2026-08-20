#!/bin/sh
# Подсветка на НАСТОЯЩИХ файлах дерева, а не на выдуманных, — и на всех четырёх
# поверхностях записи.
#
# Каждый файл открывается настоящим Vim, переводится в HTML командой `:TOhtml`
# и считается, сколько кусков какого вида раскрасилось. Виды здесь — те, к
# которым правила ПРИВЯЗАНЫ (`hi def link`): ключевое слово → Statement, имя в
# ёлочках → Identifier, сами ёлочки → Special, строка и число → Constant,
# комментарий → Comment. Так их называет сам Vim, и подменить эти имена нечем.
set -eu

koren=$(cd "$(dirname "$0")/../../.." && pwd)
kuda=$(mktemp -d)
trap 'rm -rf "$kuda"' EXIT

pokazat() {
  poverhnost=$1
  fayl=$2
  out="$kuda/$(basename "$fayl").html"
  vim -Nu NONE -es \
    --cmd 'set nocompatible' \
    --cmd "set rtp^=$koren/editors/vim" \
    --cmd 'filetype plugin on' \
    --cmd 'syntax on' \
    --cmd 'runtime! plugin/tohtml.vim' \
    -c 'let g:html_use_css = 1' \
    -c 'let g:html_no_progress = 1' \
    -c 'TOhtml' \
    -c "w! $out" \
    -c 'qa!' \
    "$koren/$fayl" > /dev/null 2>&1
  svodka=$(grep -o 'class="[A-Za-z0-9]*"' "$out" | sort | uniq -c | sort -rn |
    awk '{printf "%s %s, ", substr($2, 8, length($2) - 8), $1}' | sed 's/, $//')
  printf '%s | %s | %s\n' "$poverhnost" "$fayl" "$svodka"
}

echo 'поверхность | файл | что раскрасилось (вид Vim и сколько кусков)'
pokazat 'русская'    'flang/stdlib/lists.flang'
pokazat 'английская' 'flang/examples/rosetta/factorial-english.flang'
pokazat 'китайская'  'flang/examples/surfaces/factorial.zh.flang'
pokazat 'эсперанто'  'flang/examples/surfaces/factorial.eo.flang'
