" Подсветка FTS для Vim и Neovim.
"
" Слова языка перечислены здесь теми же списками, что в
" editors/vscode-fts/syntaxes/fts.tmLanguage.json, и это не украшение: файл,
" который в одном редакторе цветной, а в другом наполовину серый, читается как
" ошибка в файле, а не в редакторе. Совпадение проверяется — tests/run.sh
" разбирает грамматику VS Code и падает на первом же слове, которого тут нет.
"
" Внутри каждой группы длинные формы стоят раньше коротких. Vim берёт первое
" совпадение, и при обратном порядке «затем по морфизму» подсветилось бы как
" «затем» с необъяснимым хвостом.

if exists('b:current_syntax')
  finish
endif

syntax case match

" --- комментарии ------------------------------------------------------------
syntax match  ftsComment "//.*$" contains=@Spell
syntax region ftsComment start="/\*" end="\*/" contains=@Spell

" --- имена в кавычках -------------------------------------------------------
" Ёлочки — основная форма в русских спецификациях: имя внутри содержит пробелы
" и без кавычек распалось бы на отдельные слова.
syntax region ftsName start="«" end="»"
syntax region ftsName start=+"+ skip=+\\.+ end=+"+
syntax region ftsName start=+'+ skip=+\\.+ end=+'+

" --- заголовки объявлений ---------------------------------------------------
syntax match ftsDeclaration "\<\(вложена структура\|вложен объект\|nested structure\|nested object\)\>"
syntax match ftsDeclaration "\<\(категория\|структура\|свойство\|морфизм\|правило\|теорема\|утилита\|функтор\|объект\|пример\)\>"
syntax match ftsDeclaration "\<\(structure\|category\|morphism\|property\|example\|functor\|theorem\|utility\|object\|rule\)\>"

" --- модуль, подключение, экспорт -------------------------------------------
syntax match ftsModule "\<\(модуль\|module\)\>"
syntax match ftsImport "\<\(использует\|uses\)\>"
syntax match ftsExport "\<\(экспортирует\|exports\)\>"

" --- шаги вывода ------------------------------------------------------------
" Самая большая группа языка: 45 форм, от «затем применить морфизм» до союза «и».
syntax match ftsClause "\<\(затем применить морфизм\|затем по морфизму\|применить морфизм\|then apply morphism\|then by morphism\|apply morphism\)\>"
syntax match ftsClause "\<\(следовательно\|то результат\|then result\|по морфизму\|то добавить\|by morphism\|starts with\|find where\)\>"
syntax match ftsClause "\<\(возвращает\|начинает с\|therefore\|under law\|найти где\|ожидается\|по закону\|принимает\|equal to\|expected\|then add\)\>"
syntax match ftsClause "\<\(в данных\|получаем\|accepts\|in data\|returns\|равное\|given\|имеет\|from\|then\|дано\|если\)\>"
syntax match ftsClause "\<\(and\|has\|if\|to\|из\|то\|в\|и\)\>"

" --- отображения ------------------------------------------------------------
syntax match ftsMapsTo "\<\(отображается в морфизм\|отображается в поле\|maps to morphism\|maps to field\|отображается в\|maps to\)\>"
syntax match ftsMapsTo "->\|=>"

" --- операнды ---------------------------------------------------------------
syntax match ftsOperand "\<\(процентов от поля\|процента от поля\|процент от поля\|percents of field\|percent of field\)\>"
syntax match ftsOperand "\<\(результат\|result\|field\|поле\)\>"

" --- служебные слова конструкций --------------------------------------------
syntax match ftsControl "\<\(свидетельство\|proposition\|утверждение\|композиция\|применить\|functors\|selector\|аргумент\)\>"
syntax match ftsControl "\<\(значение\|описание\|селектор\|функторы\|compose\|witness\|detail\|apply\|value\|path\|путь\|arg\)\>"

" --- модальность поля -------------------------------------------------------
syntax match ftsModality "\<\(иногда является\|является\|may be\|is\)\>"
syntax match ftsModality "\<\(состоянием\|state\)\>"

" --- встроенные типы --------------------------------------------------------
syntax match ftsType "\<\(признаком\|деньгами\|строкой\|текстом\|признак\|деньги\|строку\|числом\|boolean\|number\|string\)\>"
syntax match ftsType "\<\(money\|датой\|число\|date\|дату\)\>"

" --- сравнения --------------------------------------------------------------
syntax match ftsComparison "\<\(is not equal to\|is greater than\|is less than\|is at least\|is at most\)\>"
syntax match ftsComparison "\<\(не больше\|не меньше\|не равен\|не равна\|не равно\|equals\)\>"
syntax match ftsComparison "\<\(больше\|меньше\|равен\|равна\|равно\)\>"

" --- значения ---------------------------------------------------------------
syntax match ftsBoolean "\<\(false\|true\|нет\|да\)\>"
syntax match ftsNull    "\<\(ничто\|null\)\>"
syntax match ftsNumber  "-\?\<\(0\|[1-9][0-9]*\)\(\.[0-9]\+\)\?\([eE][+-]\?[0-9]\+\)\?\>"

" --- связи с группами подсветки ---------------------------------------------
"
" Группы выбраны не по смыслу имени, а по тому, что они дают РАЗНЫЙ цвет в
" настоящих темах. В Digitable Focus Carbon `Keyword`, `Statement`, `Define` и
" `PreProc` — один и тот же фиолетовый: связав объявление с Keyword, а шаг
" вывода со Statement, мы развели бы их только на бумаге. Проверка —
" tests/run.sh, она падает, когда две роли сходятся в цвете.
highlight default link ftsComment     Comment
highlight default link ftsName        String
highlight default link ftsDeclaration Structure
highlight default link ftsModule      PreProc
highlight default link ftsImport      Include
highlight default link ftsExport      Include
highlight default link ftsClause      Statement
highlight default link ftsMapsTo      Operator
highlight default link ftsOperand     Function
highlight default link ftsControl     Identifier
highlight default link ftsModality    Special
highlight default link ftsType        Type
highlight default link ftsComparison  Operator
highlight default link ftsBoolean     Boolean
highlight default link ftsNull        Constant
highlight default link ftsNumber      Number

let b:current_syntax = 'fts'
