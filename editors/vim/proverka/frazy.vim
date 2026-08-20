" Сверка правил подсветки с таблицей языка: КАЖДАЯ фраза таблицы обязана
" покраситься ключевым словом целиком.
"
" Проверка не косметическая. Правила Vim умеют молча съесть слово: `syn keyword`
" разбирает хвост строки как свои ключи, и слово `contains` — настоящая фраза
" английской поверхности — обрывает список, унося с собой всё, что стояло после
" него. Ни ошибки, ни предупреждения при этом нет. Найти такое можно только
" спросив у настоящего редактора про каждую фразу.
"
" Буфер — файл, напечатанный из таблицы: одна фраза на строку.
function! FlangFrazy() abort
  let l:plohie = []
  let l:vsego = 0
  for l:n in range(1, line('$'))
    let l:stroka = getline(l:n)
    if l:stroka ==# ''
      continue
    endif
    let l:vsego += 1
    let l:c = 1
    let l:vse = 1
    while l:c <= strlen(l:stroka)
      let l:znak = matchstr(l:stroka, '.', l:c - 1)
      if l:znak ==# ''
        break
      endif
      if l:znak !=# ' ' && synIDattr(synID(l:n, l:c, 1), 'name') !=# 'flangKeyword'
        let l:vse = 0
      endif
      let l:c += strlen(l:znak)
    endwhile
    if !l:vse
      call add(l:plohie, l:stroka)
    endif
  endfor

  let l:vyvod = ['редактор: ' . (has('nvim') ? 'Neovim ' : 'Vim ') . matchstr(execute('version'), '\v(NVIM v|IMproved )\zs[0-9.]+')]
  call add(l:vyvod, 'фраз проверено: ' . l:vsego)
  call add(l:vyvod, 'покрашено целиком: ' . (l:vsego - len(l:plohie)))
  call add(l:vyvod, 'не покрашено: ' . len(l:plohie))
  for l:p in l:plohie[0:29]
    call add(l:vyvod, '  ПРОПУЩЕНА: ' . l:p)
  endfor
  " Пишем в поток вывода, а не в файл: прогонщику не нужен временный каталог, а
  " каталог, за которым никто не убирает, роняет соседний прогон. `:echo` не
  " годится — в тихом режиме (`vim -es`) он не печатает ничего вовсе, и
  " проверка, которая молчит, неотличима от проверки, которая прошла.
  call writefile(l:vyvod, get(g:, 'flang_kuda', '/dev/fd/2'))
endfunction
