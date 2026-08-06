#!/usr/bin/env bash
# Прогон проверок подсветки FTS для Vim.
#
#   editors/vim-fts/tests/run.sh
#
# Тема берётся из colors/ рядом с плагином — та же, что едет в Workbench.
# Без неё проверка различимости цветов бессмысленна: в теме по умолчанию
# половина ролей и так одного цвета, и тест мерил бы Vim, а не нашу работу.

set -Eeuo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
report="$(mktemp "${TMPDIR:-/tmp}/fts-vim-test.XXXXXX")"
trap 'rm -f "$report"' EXIT INT TERM

command -v vim >/dev/null || { echo "нужен vim"; exit 1; }

fail=0

# Тема, на которой проверяется различимость ролей, живёт в платном архиве
# Digitable Workbench и в этом репозитории её нет и быть не должно: он открытый,
# и класть сюда файл из поставки значило бы раздавать её часть даром. Путь к
# каталогу с темой задаётся снаружи:
#
#   FTS_THEME_DIR=/путь/к/themes/vim tests/run.sh
#
# Без него проверка цветов пропускается — но пропуск объявляется вслух, чтобы
# зелёный прогон без темы не читался как доказательство, что цвета в порядке.
theme_rtp=''
if [ -n "${FTS_THEME_DIR:-}" ] && [ -d "${FTS_THEME_DIR}" ]; then
  theme_rtp="$FTS_THEME_DIR"
fi

# --- 1. Различимость ролей --------------------------------------------------
# Порядок важен: сначала runtimepath и тема, потом буфер нужного типа, и только
# затем сам тест — он уже ничего не настраивает и лишь смотрит на результат.
if [ -z "$theme_rtp" ]; then
  echo "ПРОПУЩЕНО: различимость цветов — тема не найдена, задайте FTS_THEME_DIR"
else
  # t_Co задаётся руками: в ex-режиме терминала нет, число цветов пустое, и тема
  # со своим `if &t_Co >= 256` не выставляет ничего. Без этой строки тест мерил
  # бы не подсветку, а отсутствие терминала — и падал бы всегда.
  FTS_TEST_REPORT="$report" vim -es -u NONE -N \
    --cmd "set runtimepath^=$root" \
    --cmd "set runtimepath^=$theme_rtp" \
    --cmd 'set t_Co=256' \
    --cmd 'syntax on' \
    --cmd 'set background=dark' \
    --cmd 'silent! colorscheme digitable-focus-carbon' \
    --cmd 'enew' \
    --cmd 'set filetype=fts' \
    --cmd "source $root/tests/distinct-colors.vim" \
    </dev/null >/dev/null 2>&1 || true

  if [ ! -s "$report" ]; then
    echo "ПРОВАЛ: тест не оставил отчёта — Vim не дошёл до конца скрипта"
    fail=1
  else
    cat "$report"
    grep -q '^ПРОВАЛ' "$report" && fail=1
  fi
fi

# --- 2. Совпадение списков слов с грамматикой VS Code -----------------------
# Слова обязаны совпадать: разъехавшись, они дадут одному файлу разный вид в
# двух редакторах, и человек решит, что ошибся он, а не редактор.
grammar="$root/../vscode-fts/syntaxes/fts.tmLanguage.json"
if [ -f "$grammar" ]; then
  missing="$(python3 - "$grammar" "$root/syntax/fts.vim" <<'PY'
import json, re, sys
grammar, vimfile = sys.argv[1], sys.argv[2]
words = set()
def walk(node):
    if isinstance(node, dict):
        pattern = node.get('match') or node.get('begin') or ''
        for group in re.findall(r'\\b\(([^)]*)\)\\b', pattern):
            words.update(w for w in group.split('|') if w and '\\' not in w)
        for value in node.values():
            walk(value)
    elif isinstance(node, list):
        for item in node:
            walk(item)
walk(json.load(open(grammar, encoding='utf-8')))
source = open(vimfile, encoding='utf-8').read()
absent = sorted(w for w in words if w not in source)
print('\n'.join(absent))
PY
)"
  if [ -n "$missing" ]; then
    echo "ПРОВАЛ: в подсветке Vim нет слов, которые знает грамматика VS Code:"
    printf '  %s\n' $missing
    fail=1
  else
    echo "ОК: списки слов Vim и VS Code совпадают"
  fi
else
  echo "ПРОПУЩЕНО: грамматика VS Code не найдена ($grammar)"
fi

exit "$fail"
