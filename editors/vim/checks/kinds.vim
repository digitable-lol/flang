" Печатает, во что покрасился открытый буфер: подряд идущие знаки одного вида
" сливаются в кусок, куски печатаются как «вид␟текст».
"
" Нужно ровно потому, что «вроде подсвечивается» — не результат. Здесь видно
" КАЖДЫЙ знак: и покрашенный, и оставшийся серым.
function! FlangVidy() abort
  let l:vyvod = []
  for l:n in range(1, line('$'))
    let l:stroka = getline(l:n)
    let l:c = 1
    let l:vid = ''
    let l:kusok = ''
    while l:c <= strlen(l:stroka)
      let l:znak = matchstr(l:stroka, '.', l:c - 1)
      if l:znak ==# ''
        break
      endif
      let l:etot = synIDattr(synID(l:n, l:c, 1), 'name')
      if l:etot ==# ''
        let l:etot = '-'
      endif
      if l:etot !=# l:vid
        if l:kusok !=# ''
          call add(l:vyvod, l:vid . "\x1f" . l:kusok)
        endif
        let l:vid = l:etot
        let l:kusok = ''
      endif
      let l:kusok .= l:znak
      let l:c += strlen(l:znak)
    endwhile
    if l:kusok !=# ''
      call add(l:vyvod, l:vid . "\x1f" . l:kusok)
    endif
    call add(l:vyvod, "\x1e")
  endfor
  return l:vyvod
endfunction

" Свалить разбор буфера в файл, названный ключом --cmd 'let g:flang_kuda=…'.
function! FlangVygruzit() abort
  call writefile(FlangVidy(), g:flang_kuda)
endfunction
