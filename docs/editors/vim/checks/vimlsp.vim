" Сеанс языкового сервера в НАСТОЯЩЕМ Vim (не Neovim), через vim-lsp.
"
" Vim не умеет ждать в цикле так, как Neovim (`vim.wait`), поэтому ожидание
" здесь — `sleep` с проверкой между: пока спим, `job` дочитывает ответы сервера.
function! FlangVimLsp() abort
  let l:otchet = []
  call add(l:otchet, 'редактор: Vim ' . matchstr(execute('version'), 'IMproved \zs[0-9.]\+'))
  call add(l:otchet, 'тип файла: ' . &filetype)
  call add(l:otchet, 'команда сервера: ' . join(flang#Server(), ' '))

  " Ждём, пока сервер поднимется и пришлёт диагностику.
  let l:zhdyom = 0
  let l:bedy = []
  while l:zhdyom < 300
    sleep 100m
    let l:bedy = lsp#internal#diagnostics#state#_get_all_diagnostics_grouped_by_server_for_uri(lsp#utils#get_buffer_uri())
    if !empty(l:bedy)
      break
    endif
    let l:zhdyom += 1
  endwhile

  let l:vsego = 0
  for [l:server, l:otvet] in items(l:bedy)
    for l:d in get(get(l:otvet, 'params', {}), 'diagnostics', [])
      let l:vsego += 1
      call add(l:otchet, printf('  строка %d, столбец %d, код %s: %s',
            \ l:d.range.start.line + 1, l:d.range.start.character + 1,
            \ get(l:d, 'code', 'нет'), substitute(l:d.message, "\n", ' ', 'g')))
    endfor
  endfor
  call add(l:otchet, 'диагностик пришло: ' . l:vsego)
  call add(l:otchet, l:vsego > 0 ? 'ИТОГ: сошлось' : 'ИТОГ: РАЗОШЛОСЬ')
  call writefile(l:otchet, get(g:, 'flang_kuda', '/dev/fd/2'))
endfunction
