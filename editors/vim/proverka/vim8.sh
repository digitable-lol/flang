#!/bin/sh
# Сеанс языкового сервера в НАСТОЯЩЕМ Vim (не Neovim), через vim-lsp.
#
# vim-lsp — чужой пакет, и в дереве языка ему не место. Путь к каталогу, где
# лежат `vim-lsp` и `async.vim`, берётся из переменной среды FLANG_VIM_LSP.
# Нет её — проверка честно говорит «пропущена» и выходит нулём: пропуск,
# названный вслух, лучше зелёного прогона, который ничего не проверял.
#
#   git clone --depth 1 https://github.com/prabirshrestha/vim-lsp.git   ~/vimlsp/vim-lsp
#   git clone --depth 1 https://github.com/prabirshrestha/async.vim.git ~/vimlsp/async.vim
#   FLANG_VIM_LSP=~/vimlsp flang io scripts/lsp-check.flang
set -eu

koren=$(cd "$(dirname "$0")/../../.." && pwd)
gde=${FLANG_VIM_LSP:-}

if [ -z "$gde" ] || [ ! -d "$gde/vim-lsp" ] || [ ! -d "$gde/async.vim" ]; then
  echo 'Vim 8/9 через vim-lsp: ПРОПУЩЕНА — не задан FLANG_VIM_LSP с vim-lsp и async.vim'
  exit 0
fi

# `-es` — тихий режим построчного редактора: ни окна, ни человека.
# `lsp#enable()` и `edit` руками: обычно vim-lsp включается на VimEnter, а в
# тихом режиме файл открыт раньше, чем зарегистрирован сервер.
vim -Nu NONE -es \
  --cmd 'set nocompatible' \
  --cmd "set rtp^=$gde/vim-lsp,$gde/async.vim,$koren/editors/vim" \
  --cmd 'filetype plugin on' \
  --cmd 'syntax on' \
  --cmd 'runtime! plugin/*.vim' \
  -c 'call lsp#enable()' \
  -c 'edit' \
  -c "source $koren/editors/vim/proverka/vimlsp.vim" \
  -c 'call FlangVimLsp()' \
  -c 'qa!' \
  "$koren/editors/vim/proverka/proba-beda.flang" 2>&1
