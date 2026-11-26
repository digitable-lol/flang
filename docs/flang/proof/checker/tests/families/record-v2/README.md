# Запись второй версии

Записи второй версии формата (ADR-0255): та же запись, где слова рамки, названия
правил ядра, короткие имена правил и имена примитивов — ключи таблицы
`flang/proof/tables/record-v2-words.tsv`, а формулы в уголках — знаки и ключи
понятий. Сверщик переводит такую запись обратно в первую версию и сверяет как
обычно.

Честные записи напечатаны ключом `flang check --proof --record файл --record-version 2`
двоичным, собранным из семени 0.8.0 с печатью второй версии из
`flang/src/emit/c/flang_repl.c` этой ветки, — до пересборки компилятора ключа в
двоичном семени нет. Исходники — уже лежащие в дереве программы четырёх языков
записи. Подделки в `corrupt/` — рукотворные порчи честных записей.

| запись | исходник | код | что это |
|---|---|---:|---|
| `corpus-natural.record` | `flang/proof/examples/corpus-natural.flang` | 0 | русская программа, вывод `Nonneg3`, `Unfold2`, формулы `⟨result ≥ 0⟩` |
| `english-postconditions.record` | `…/surfaces/english-postconditions.flang` | 3 | английская программа, та же запись, что у первой версии |
| `chinese-factorial.record` | `…/surfaces/chinese-factorial.flang` | 0 | китайская программа, тотальности |
| `esperanto-factorial.record` | `…/surfaces/esperanto-factorial.flang` | 0 | программа на эсперанто |
| `traffic-light.record` | `flang/proof/examples/traffic-light.flang` | 0 | ходы `move 1 unfold ⟨«Штраф» of (variant «Красный»)⟩` |
| `corrupt/line-count.record` | `corpus-natural.flang` | 1 | число строк в шапке не то |
| `corrupt/sign.record` | `corpus-natural.flang` | 1 | знак формулы `≥` заменён на `≤` |
| `corrupt/unknown-key.record` | `traffic-light.flang` | 1 | ключа рамки нет в таблице — строка не узнана |
