" Поиск языкового сервера flang — ОДНА реализация на оба редактора.
"
" Vim и Neovim настраиваются по-разному (у одного клиенты на VimScript, у
" другого встроенный vim.lsp на Lua), но ИЩУТ сервер они одинаково, и второй
" список путей разошёлся бы с первым в первый же день. Поэтому поиск написан
" здесь, а Lua зовёт его через vim.fn — Neovim умеет вызывать функции VimScript.
"
" ── Порядок путей ───────────────────────────────────────────────────────────
"
"   1. flang-lsp из PATH                    — отдельный сервер, поставленный глобально;
"   2. node_modules/.bin/flang-lsp          — тот же сервер в этом проекте;
"   3. flang-lsp рядом с самим редактором   — сборка «всё в одном каталоге»;
"   4. flang lsp из PATH                    — двоичный flang 0.7.25 и новее.
"
" Двоичный из выпусков по 0.7.24 включительно отвечал только после закрытия
" стандартного ввода: ввод читался кусками по 8192 байта, и `fread` ждал либо
" полный кусок, либо конец ввода. Померено `docs/editors/vim/checks/stream.sh`:
" с открытым вводом 0 байт, после закрытия — 334 байта сразу. Редактор ввод не
" закрывает никогда, и такой сервер выглядел бы висящим. С 0.7.25 ввод
" читается тем, что уже пришло (`repl_read_some` в
" `flang/src/emit/c/flang_repl.c`), поэтому пункт 4 берётся сам, если
" `flang --version` не старше 0.7.25.
"
" Решение можно задать руками до загрузки плагина:
"
"   let g:flang_binary_lsp = 1   — брать двоичный, какой бы он ни был;
"   let g:flang_binary_lsp = 0   — не брать двоичный никогда.
"
" Старое имя `g:flang_dvoichnyy_lsp` по-прежнему читается, если нового нет.

let s:has_lsp = {}
let s:answers_open_input = {}
let s:warned = 0

" Умеет ли этот `flang` подкоманду `lsp`. Спрашиваем справку — один раз на путь.
function! s:HasLsp(path) abort
  if has_key(s:has_lsp, a:path)
    return s:has_lsp[a:path]
  endif
  let s:has_lsp[a:path] = (system(shellescape(a:path) . ' --help') =~# 'flang lsp') ? 1 : 0
  return s:has_lsp[a:path]
endfunction

" Отвечает ли этот `flang lsp` при открытом вводе: выпуск 0.7.25 и новее.
" Номер берём из `flang --version` — один раз на путь.
function! s:AnswersOpenInput(path) abort
  if has_key(s:answers_open_input, a:path)
    return s:answers_open_input[a:path]
  endif
  let l:v = matchlist(system(shellescape(a:path) . ' --version'), '\vflang (\d+)\.(\d+)\.(\d+)')
  let l:ok = 0
  if !empty(l:v)
    let l:ok = (str2nr(l:v[1]) * 1000000 + str2nr(l:v[2]) * 1000 + str2nr(l:v[3])) >= 7025
  endif
  let s:answers_open_input[a:path] = l:ok
  return l:ok
endfunction

" Что человек сказал про двоичный: 1 — брать, 0 — не брать, -1 — решить по
" выпуску. Старое имя переменной читается ради прежних настроек.
function! s:BinaryWish() abort
  return get(g:, 'flang_binary_lsp', get(g:, 'flang_dvoichnyy_lsp', -1))
endfunction

" Ближайший вверх файл или каталог. Пусто, если не нашлось.
" Путь каталога — без косой черты на конце: иначе `:h` срезал бы только её.
function! s:FindUp(from, what) abort
  let l:found = findfile(a:what, a:from . ';')
  if empty(l:found)
    let l:found = finddir(a:what, a:from . ';')
  endif
  return empty(l:found) ? '' : substitute(fnamemodify(l:found, ':p'), '.\zs/\+$', '', '')
endfunction

" Каталог, от которого искать: каталог текущего файла, иначе рабочий каталог.
function! flang#StartDir() abort
  let l:name = expand('%:p')
  return empty(l:name) ? getcwd() : fnamemodify(l:name, ':h')
endfunction

" Каталог рядом с самим редактором.
function! s:EditorDir() abort
  return fnamemodify(exepath(v:progpath), ':h')
endfunction

" Команда запуска сервера. Пустой список — не нашлось.
function! flang#Server() abort
  let l:from = flang#StartDir()

  if executable('flang-lsp')
    return [exepath('flang-lsp'), '--stdio']
  endif

  let l:local = s:FindUp(l:from, 'node_modules/.bin/flang-lsp')
  if !empty(l:local)
    return [l:local, '--stdio']
  endif

  let l:beside = s:EditorDir() . '/flang-lsp'
  if executable(l:beside)
    return [l:beside, '--stdio']
  endif

  let l:wish = s:BinaryWish()
  if l:wish != 0 && flang#BinaryHasLsp()
    if l:wish == 1 || s:AnswersOpenInput(exepath('flang'))
      return [exepath('flang'), 'lsp', '--stdio']
    endif
  endif

  return []
endfunction

" Есть ли поблизости двоичный с подкомандой lsp — нужно, чтобы объяснить
" человеку, ПОЧЕМУ он не взят, а не молчать про него.
function! flang#BinaryHasLsp() abort
  return executable('flang') && s:HasLsp(exepath('flang'))
endfunction

" Что сказать человеку, если сервера нет. Молчать здесь нельзя: редактор без
" подсказок выглядит точно так же, как редактор со сломанным сервером.
function! flang#WhyNoServer() abort
  let l:lines = [
        \ 'flang: языковой сервер не найден — подсказок и диагностики не будет.',
        \ 'Искали четыре места:',
        \ '  1. flang-lsp из PATH',
        \ '  2. node_modules/.bin/flang-lsp      рядом с проектом',
        \ '  3. flang-lsp рядом с ' . s:EditorDir(),
        \ '  4. flang lsp из PATH                (flang 0.7.25 и новее)',
        \ ]
  if flang#BinaryHasLsp()
    if s:BinaryWish() == 0
      call add(l:lines, 'Двоичный flang с подкомандой lsp есть, но выключен: g:flang_binary_lsp = 0.')
    else
      call add(l:lines, 'Двоичный flang с подкомандой lsp есть, но он старше 0.7.25:')
      call add(l:lines, '  такие выпуски отвечают только после закрытия ввода, а редактор ввод не закрывает,')
      call add(l:lines, '  и сервер выглядел бы висящим. Обновите flang или возьмите его как есть:')
      call add(l:lines, '  let g:flang_binary_lsp = 1')
    endif
  endif
  call add(l:lines, 'Подсветка работает и без сервера.')
  return join(l:lines, "\n")
endfunction

" Сказать один раз за сеанс, а не на каждом открытом файле.
function! flang#WarnOnce() abort
  if s:warned
    return
  endif
  let s:warned = 1
  echohl WarningMsg
  for l:line in split(flang#WhyNoServer(), "\n")
    echomsg l:line
  endfor
  echohl None
endfunction

" Корень проекта: по замку пакета, потом по package.json, потом по .git.
" Корень — каталог, где лежит метка, а не сама метка: для `.git` это каталог
" проекта, а не `<проект>/.git`.
function! flang#ProjectRoot() abort
  let l:from = flang#StartDir()
  for l:marker in ['flang.lock', 'package.json', '.git']
    let l:found = s:FindUp(l:from, l:marker)
    if !empty(l:found)
      return fnamemodify(l:found, ':h')
    endif
  endfor
  return l:from
endfunction
