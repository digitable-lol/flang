" Vim 8 и 9: языковой сервер через vim-lsp.
"
" Клиент выбран один и по одному доводу — ЧЕМ ОН ПЛАТИТ. Цель всей затеи в том,
" чтобы редактору не понадобился Node; coc.nvim его требует и тем сводит затею
" на нет. Из оставшихся vim-lsp написан на чистом VimScript, работает с Vim
" 8.0.1453, и внешних зависимостей у него ноль. yegappan/lsp тоже хорош, но
" требует Vim 9.0 — то есть отрезает весь Vim 8, а он и есть тот случай, ради
" которого этот файл написан.
"
" Neovim сюда не заходит: у него встроенный vim.lsp, и он настраивается в
" plugin/flang.lua. Два клиента на один буфер дали бы две одинаковые
" диагностики на каждую строку.
if has('nvim') || exists('g:loaded_flang_vimlsp') || get(g:, 'flang_no_setup', get(g:, 'flang_ne_nastraivat', 0))
  finish
endif
let g:loaded_flang_vimlsp = 1

function! s:Register() abort
  " Проверяем НАЛИЧИЕ ФАЙЛА, а не функции: `exists('*lsp#register_server')`
  " здесь лжёт. Автозагружаемая функция не «существует», пока её файл не
  " прочитан, а прочитан он будет только при первом вызове — то есть проверка
  " всегда возвращала бы «vim-lsp не поставлен» и молча отключала сервер.
  " Стоило это одного захода: сервер находился, команда печаталась, диагностик
  " не было ни одной.
  if empty(globpath(&runtimepath, 'autoload/lsp.vim'))
    " vim-lsp не поставлен. Это не беда: подсветка работает и без сервера, а
    " молча делать вид, что подсказки будут, — беда.
    return
  endif
  let l:command = flang#Server()
  if empty(l:command)
    call flang#WarnOnce()
    return
  endif
  call lsp#register_server({
        \ 'name': 'flang',
        \ 'cmd': {server_info -> l:command},
        \ 'allowlist': ['flang'],
        \ 'root_uri': {server_info -> lsp#utils#path_to_uri(flang#ProjectRoot())},
        \ })
endfunction

augroup flang_vimlsp
  autocmd!
  autocmd User lsp_setup call s:Register()
augroup END
