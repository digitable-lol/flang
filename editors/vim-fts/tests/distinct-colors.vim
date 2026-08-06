" Проверка: роли FTS не сливаются в один цвет.
"
" Подсветка, где объявление, шаг вывода и сравнение окрашены одинаково, — не
" подсветка. При этом связать группы с разными именами недостаточно: в
" конкретной теме `Keyword` и `Statement` могут вести на один и тот же цвет, и
" разница останется только в исходнике плагина.
"
" Запускать через tests/run.sh — он и печатает отчёт, и возвращает код.
" Результат пишется в файл из $FTS_TEST_REPORT: код выхода Vim в ex-режиме
" зависит от вещей, к проверке отношения не имеющих, и полагаться на него
" здесь значит ловить чужие ошибки вместо своих.

let s:report = $FTS_TEST_REPORT
if empty(s:report)
  let s:report = '/dev/stdout'
endif

let s:lines = []

" Роли, которые обязаны быть различимы. Внутри пары цвет совпадать не должен.
" Сравнения и отображения намеренно НЕ противопоставлены друг другу: обе — знаки
" отношения, и одинаковый цвет у них честно отражает одинаковую роль.
let s:must_differ = [
      \ ['ftsDeclaration', 'ftsClause'],
      \ ['ftsDeclaration', 'ftsName'],
      \ ['ftsDeclaration', 'ftsComment'],
      \ ['ftsClause', 'ftsOperand'],
      \ ['ftsClause', 'ftsComment'],
      \ ['ftsModality', 'ftsDeclaration'],
      \ ['ftsOperand', 'ftsName'],
      \ ['ftsBoolean', 'ftsName'],
      \ ]

" Режим указан явно. Без него synIDattr() отдаёт атрибут «текущего» режима, а в
" ex-режиме текущий — term, где у темы цветов нет вовсе: тест мерил бы не
" подсветку, а способ запуска Vim. Тема задаёт и cterm, и gui, поэтому сверяем
" обе записи и считаем роли слипшимися, только если совпали обе.
function! s:Colour(group) abort
  let l:id = synIDtrans(hlID(a:group))
  let l:cterm = synIDattr(l:id, 'fg', 'cterm')
  let l:gui = synIDattr(l:id, 'fg', 'gui')
  if empty(l:cterm) && empty(l:gui)
    return 'НЕТ'
  endif
  return l:cterm . '/' . l:gui
endfunction

" Синтаксис живёт в буфере: без файла нужного типа группы `fts*` не заведены,
" и тест сравнивал бы отсутствие с отсутствием.
if !exists('b:current_syntax') || b:current_syntax !=# 'fts'
  call add(s:lines, 'ПРОВАЛ: синтаксис fts не загрузился, проверять нечего')
else
  for s:pair in s:must_differ
    let s:a = s:Colour(s:pair[0])
    let s:b = s:Colour(s:pair[1])
    if s:a ==# 'НЕТ' || s:b ==# 'НЕТ'
      call add(s:lines, printf('ПРОВАЛ: %s или %s без цвета (%s / %s)',
            \ s:pair[0], s:pair[1], s:a, s:b))
    elseif s:a ==# s:b
      call add(s:lines, printf('ПРОВАЛ: %s и %s слились в цвет %s',
            \ s:pair[0], s:pair[1], s:a))
    endif
  endfor
  if empty(s:lines)
    call add(s:lines, printf('ОК: роли различимы, проверено пар: %d', len(s:must_differ)))
  endif
endif

call writefile(s:lines, s:report)
qall!
