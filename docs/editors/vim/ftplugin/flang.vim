" Настройки буфера flang.
"
" Отступ значим — им размечены ветви и тела, как в Python. Поэтому табуляция
" разворачивается в пробелы: смешение табов и пробелов в языке со значимым
" отступом меняет смысл программы, а не только вид.
if exists("b:did_ftplugin")
  finish
endif
let b:did_ftplugin = 1

setlocal expandtab
setlocal shiftwidth=2
setlocal softtabstop=2
setlocal tabstop=2
setlocal comments=s1:/*,mb:*,ex:*/,://
setlocal commentstring=//\ %s
setlocal formatoptions-=t formatoptions+=croql

" Ёлочки — часть языка, а не типографика: пусть редактор ходит по ним парой и
" подставляет закрывающую.
setlocal matchpairs+=«:»

let b:undo_ftplugin = "setlocal expandtab< shiftwidth< softtabstop< tabstop< comments< commentstring< formatoptions< matchpairs<"
