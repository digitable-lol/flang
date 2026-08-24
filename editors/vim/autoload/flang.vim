" Поиск языкового сервера flang — ОДНА реализация на оба редактора.
"
" Vim и Neovim настраиваются по-разному (у одного клиенты на VimScript, у
" другого встроенный vim.lsp на Lua), но ИЩУТ сервер они одинаково, и второй
" список путей разошёлся бы с первым в первый же день. Поэтому поиск написан
" здесь, а Lua зовёт его через vim.fn — Neovim умеет вызывать функции VimScript.
"
" ── Порядок путей и почему двоичный НЕ первый ───────────────────────────────
"
" У двоичного `flang` подкоманда `lsp` есть, и на закрытом вводе она отвечает
" правильно. Редактору она не годится: пока стандартный ввод открыт, сервер не
" присылает НИ ОДНОГО байта, и весь ответ вываливается разом при закрытии
" ввода. Померено (`editors/vim/checks/potok.md`): с открытым вводом 0 байт
" за 3 секунды, после закрытия — 334 байта сразу; `flang-lsp` на Node на том же
" сообщении отвечает 311 байтами за 0,1 секунды. Редактор ввод не закрывает
" никогда, поэтому двоичный сервер выглядел бы как молча висящий, а молчащий
" сервер неотличим от сломанного.
"
" Поэтому порядок такой:
"
"   1. flang-lsp из PATH                    — пакет npm, поставленный глобально;
"   2. node_modules/.bin/flang-lsp          — тот же пакет в этом проекте;
"   3. flang-lsp рядом с самим редактором   — сборка «всё в одном каталоге»;
"   4. flang/bin/flang-lsp.mjs в дереве     — работа над самим языком;
"   5. flang lsp из PATH                    — ТОЛЬКО по явной просьбе
"                                             (`let g:flang_dvoichnyy_lsp = 1`).
"
" Пункт 5 останется выключенным, пока двоичный не научится отвечать на лету.
" Когда научится — проверка `scripts/lsp-check.flang` позеленеет, и пункт
" можно будет поднять наверх: тогда Node для редактора станет не нужен.

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

  let l:derevo = s:VverhDo(l:ot, 'flang/bin/flang-lsp.mjs')
  if !empty(l:derevo) && executable('node')
    return [exepath('node'), l:derevo, '--stdio']
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
        \ 'Искали четыре места:',
        \ '  1. flang-lsp из PATH                (npm install -g @digitable-lol/flang)',
        \ '  2. node_modules/.bin/flang-lsp      рядом с проектом',
        \ '  3. flang-lsp рядом с ' . s:Ryadom(),
        \ '  4. flang/bin/flang-lsp.mjs в дереве языка (нужен node)',
        \ ]
  if flang#DvoichnyyEst()
    call add(l:stroki, 'Двоичный flang с подкомандой lsp рядом ЕСТЬ, но он не взят:')
    call add(l:stroki, '  он отвечает только после закрытия ввода, а редактор ввод не закрывает,')
    call add(l:stroki, '  и сервер выглядел бы висящим. Взять всё равно: let g:flang_dvoichnyy_lsp = 1')
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
