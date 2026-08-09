#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# Прогон тяжёлого набора не здесь, а на большой машине.
#
#   scripts/test-remote.sh                 # npm test целиком
#   scripts/test-remote.sh test:flang      # один набор
#   scripts/test-remote.sh -- npm run check && npm test   # произвольная команда
#
# Зачем. Полный набор поднимает восемь тулчейнов сразу — beam, go, cc, dotnet,
# rustc, javac — и на восьми ядрах локальной машины это десятки процессов и
# load average в сотню: работать за ней в это время нельзя. На `dev` 256 ядер и
# 499 ГБ, и тот же набор там никому не мешает. Локально остаются `npm run
# check`, юнит-тесты без бэкендов и сверки поверхностей.
#
# Хост — алиас из ~/.ssh/config, переменная FLANG_REMOTE (по умолчанию `dev`).
#
# Что уезжает. Рабочее дерево целиком, БЕЗ `node_modules`, `dist` и `output`:
# они собираются на месте, и везти сотню мегабайт зря. Вместе с деревом уезжает
# каталог `.git` — не для красоты: `flang/test/changelog.test.mjs` и
# `scripts/build-changelog.mjs --check` читают теги и заголовки коммитов, и без
# истории набор красный на ровном месте. Каталог берётся общий
# (`--git-common-dir`), поэтому скрипт работает и из `git worktree`, где `.git`
# — файл со ссылкой, а не каталог.
#
# Локальное дерево не меняется ничем из этого скрипта; на хосте меняется только
# ~/$FLANG_REMOTE_DIR.

set -euo pipefail

HOST="${FLANG_REMOTE:-dev}"
REMOTE_DIR="${FLANG_REMOTE_DIR:-flang-remote}"
ROOT=$(git rev-parse --show-toplevel)
GITDIR=$(cd -- "$(git rev-parse --git-common-dir)" && pwd)
BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [ "${1:-}" = -- ]; then
  shift
  CMD="$*"
else
  CMD="npm run ${1:-test}"
  [ $# -le 1 ] || { echo "лишние аргументы; для произвольной команды: -- <команда>" >&2; exit 2; }
  [ "${1:-test}" != test ] || CMD="npm test"
fi

echo "хост: $HOST, каталог: ~/$REMOTE_DIR, ветка: $BRANCH"
echo "команда: $CMD"

ssh "$HOST" "mkdir -p ~/$REMOTE_DIR"

# Дерево. --delete, чтобы удалённая копия была копией, а не наслоением прогонов;
# node_modules и dist исключены и потому защищены от --delete отдельно.
rsync -az --delete \
  --exclude .git --exclude node_modules --exclude dist --exclude output \
  --filter 'protect node_modules' --filter 'protect dist' --filter 'protect output' \
  "$ROOT/" "$HOST:$REMOTE_DIR/"

# История. Уезжает общий каталог, а HEAD на хосте переставляется на нашу ветку:
# в worktree HEAD общего каталога показывает на ЧУЖУЮ ветку (ту, что в основном
# рабочем дереве), и без этой строки `git status` на хосте объявил бы все файлы
# изменёнными, а `changelog:check` считал бы историю не от того коммита.
rsync -az --delete "$GITDIR/" "$HOST:$REMOTE_DIR/.git/"
ssh "$HOST" "cd $REMOTE_DIR \
  && git config core.bare false \
  && git symbolic-ref HEAD refs/heads/'$BRANCH' \
  && git reset --mixed --quiet \
  && git status --short"

# Локаль задаётся явно, и это не вкусовщина. Неинтерактивный ssh приходит без
# LANG, BEAM поднимается с native name encoding latin1 и предупреждает об этом
# сам («Elixir … expects utf8»), а печать в Elixir на именах с кириллицей после
# этого расходится с интерпретатором — 33 теста `emit-elixir` краснеют на ровном
# месте. `ELIXIR_ERL_OPTIONS=+fnu` — та же страховка со стороны BEAM, на случай
# хоста, где C.UTF-8 не собран.
#
# `npm install`, а не `ci`: package-lock в этом репозитории отстаёт от
# package.json, и `ci` на нём падает до первого теста.
ssh "$HOST" "cd $REMOTE_DIR \
  && export LANG=C.UTF-8 LC_ALL=C.UTF-8 ELIXIR_ERL_OPTIONS=+fnu \
  && npm install --no-audit --no-fund >/dev/null && $CMD"
