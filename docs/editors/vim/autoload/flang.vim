" Поиск языкового сервера flang — ОДНА реализация на оба редактора.
"
" Vim и Neovim настраиваются по-разному (у одного клиенты на VimScript, у
" другого встроенный vim.lsp на Lua), но ИЩУТ сервер они одинаково, и второй
" список путей разошёлся бы с первым в первый же день. Поэтому поиск написан
" здесь, а Lua зовёт его через vim.fn — Neovim умеет вызывать функции VimScript.
"
" ── Порядок путей и почему двоичный НЕ первый ───────────────────────────────
"
" У двоичного `flang` подкоманда `lsp` есть. Выпуски по 0.7.24 включительно
" отвечают только после закрытия стандартного ввода: ввод читался кусками по
" 8192 байта, и `fread` ждал либо полный кусок, либо конец ввода. Померено
" `docs/editors/vim/checks/stream.sh`: с открытым вводом 0 байт, после
" закрытия — 334 байта сразу. Редактор ввод не закрывает никогда, поэтому у
" такого выпуска сервер выглядит молча висящим, а молчащий сервер неотличим от
" сломанного. Ввод теперь читается тем, что уже пришло (`repl_read_some` в
" `flang/src/emit/c/flang_repl.c`), и тот же замер даёт 334 байта при открытом
" вводе.
"
" Поэтому порядок такой:
"
"   1. flang-lsp из PATH                    — пакет npm, поставленный глобально;
"   2. node_modules/.bin/flang-lsp          — тот же пакет в этом проекте;
"   3. flang-lsp рядом с самим редактором   — сборка «всё в одном каталоге»;
"   4. flang lsp из PATH                    — ТОЛЬКО по явной просьбе
"                                             (`let g:flang_dvoichnyy_lsp = 1`).
"
" Пункта «flang/bin/flang-lsp.mjs в дереве — работа над самим языком» больше
" нет: файл снят 20 августа 2026 вместе с реализацией на JavaScript
" (`fe8e8a37`), обёртка `flang-lsp` — вместе с npm 6 сентября (задача 8649);
" искать его редактор перестал 9 сентября (задача 6201).
"
" Пункт 4 остаётся по явной просьбе, хотя двоичный из этого дерева отвечает на
" лету: проверка `scripts/editors/lsp-check.fscript` меряет это первым шагом и
" гоняет Neovim именно на нём. Поставленные у людей выпуски по 0.7.24
" включительно по-прежнему молчат, и взять такой без спроса значило бы показать
" висящий сервер. Поднять пункт наверх можно, когда выйдет выпуск с исправлением.

let s:umeet_lsp = {}
let s:skazano = 0

" Умеет ли этот `flang` подкоманду `lsp`. Спрашиваем справку — один раз на путь.
function! s:UmeetLsp(put) abort
  if has_key(s:umeet_lsp, a:put)
    return s:umeet_lsp[a:put]
  endif
  let s:umeet_lsp[a:put] = (system(shellescape(a:put) . ' --help') =~# 'flang lsp') ? 1 : 0
  return s:umeet_lsp[a:put]
endfunction

" Ближайший вверх файл или каталог. Пусто, если не нашлось.
function! s:VverhDo(ot, chto) abort
  let l:nayden = findfile(a:chto, a:ot . ';')
  if empty(l:nayden)
    let l:nayden = finddir(a:chto, a:ot . ';')
  endif
  return empty(l:nayden) ? '' : fnamemodify(l:nayden, ':p')
endfunction

" Каталог, от которого искать: каталог текущего файла, иначе рабочий каталог.
function! flang#Otkuda() abort
  let l:imya = expand('%:p')
  return empty(l:imya) ? getcwd() : fnamemodify(l:imya, ':h')
endfunction

" Каталог рядом с самим редактором.
function! s:Ryadom() abort
  return fnamemodify(exepath(v:progpath), ':h')
endfunction

" Команда запуска сервера. Пустой список — не нашлось.
function! flang#Server() abort
  let l:ot = flang#Otkuda()

  if executable('flang-lsp')
    return [exepath('flang-lsp'), '--stdio']
  endif

  let l:mestnyy = s:VverhDo(l:ot, 'node_modules/.bin/flang-lsp')
  if !empty(l:mestnyy)
    return [l:mestnyy, '--stdio']
  endif

  let l:sosed = s:Ryadom() . '/flang-lsp'
  if executable(l:sosed)
    return [l:sosed, '--stdio']
  endif

  if get(g:, 'flang_dvoichnyy_lsp', 0) && executable('flang') && s:UmeetLsp(exepath('flang'))
    return [exepath('flang'), 'lsp', '--stdio']
  endif

  return []
endfunction

" Есть ли поблизости двоичный с подкомандой lsp — нужно, чтобы объяснить
" человеку, ПОЧЕМУ он не взят, а не молчать про него.
function! flang#DvoichnyyEst() abort
  return executable('flang') && s:UmeetLsp(exepath('flang'))
endfunction

" Что сказать человеку, если сервера нет. Молчать здесь нельзя: редактор без
" подсказок выглядит точно так же, как редактор со сломанным сервером.
function! flang#Pochemu() abort
  let l:stroki = [
        \ 'flang: языковой сервер не найден — подсказок и диагностики не будет.',
        \ 'Искали три места:',
        \ '  1. flang-lsp из PATH                (npm install -g @digitable-lol/flang)',
        \ '  2. node_modules/.bin/flang-lsp      рядом с проектом',
        \ '  3. flang-lsp рядом с ' . s:Ryadom(),
        \ ]
  if flang#DvoichnyyEst()
    call add(l:stroki, 'Двоичный flang с подкомандой lsp рядом ЕСТЬ, но он не взят:')
    call add(l:stroki, '  выпуски по 0.7.24 включительно отвечают только после закрытия ввода, а редактор')
    call add(l:stroki, '  ввод не закрывает, и сервер выглядел бы висящим; более новые отвечают сразу.')
    call add(l:stroki, '  Взять его: let g:flang_dvoichnyy_lsp = 1')
  endif
  call add(l:stroki, 'Подсветка работает и без сервера.')
  return join(l:stroki, "\n")
endfunction

" Сказать один раз за сеанс, а не на каждом открытом файле.
function! flang#Poplakat() abort
  if s:skazano
    return
  endif
  let s:skazano = 1
  echohl WarningMsg
  for l:stroka in split(flang#Pochemu(), "\n")
    echomsg l:stroka
  endfor
  echohl None
endfunction

" Корень проекта: по замку пакета, потом по package.json, потом по .git.
function! flang#Koren() abort
  let l:ot = flang#Otkuda()
  for l:metka in ['flang.lock', 'package.json', '.git']
    let l:nayden = s:VverhDo(l:ot, l:metka)
    if !empty(l:nayden)
      return fnamemodify(l:nayden, ':h')
    endif
  endfor
  return l:ot
endfunction
