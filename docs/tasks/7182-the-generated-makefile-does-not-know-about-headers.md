---
номер: 7182
заголовок: Напечатанный Makefile не знает заголовков: после смены заголовка объектные файлы не пересобираются
статус: свободна
приоритет: P1
исполнитель: —
ветка: —
команда: первая
карта: Цена самосборки
рядом: —
нужность: новый компилятор молча линкуется со старым рантаймом и даёт ложный красный или ложный зелёный
---

# 7182. Напечатанный Makefile не знает заголовков: после смены заголовка объектные файлы не пересобираются

`bootstrap/Makefile` печатается компилятором. Зависимостей от заголовков в нём
нет, действует неявное правило «объектный файл из одноимённого исходника».
Заголовки меняются при перепечатке, в них макросы и раскладки записей. Объектный файл рантайма, собранный со старым заголовком,
линкуется с новым компилятором, и двоичный отвечает `FLANG_TYPE` на поле
записи либо проходит проверки по случайности.

## Шаги воспроизведения

1. `make -C bootstrap` — собрать.
2. `make -n -W compiler_flang.h -C bootstrap` — спросить, что пересоберётся,
   если заголовок изменился.

## Что происходит

```
$ make -n -W compiler_flang.h -C bootstrap
make: Entering directory 'bootstrap'
make: Nothing to be done for 'all'.
make: Leaving directory 'bootstrap'                                    код 0
```

Версия: flang 0.7.23, 3 октября 2026.

Что видно в самом дереве, и это меняет форму правки:

```
$ grep -n '^#include "' bootstrap/*.c bootstrap/*.h
bootstrap/flang_cli.c:93:#include "flang_runtime.h"
bootstrap/flang_cli.c:156:#include "flang_conc.h"
bootstrap/flang_runtime.c:58:#include "flang_runtime.h"
bootstrap/flang_repl.c:146:#include "flang_runtime.h"
bootstrap/compiler_flang.h:10:#include "flang_runtime.h"
bootstrap/compiler_flang.c:7:#include "compiler_flang.h"
$ ls bootstrap/*.h
bootstrap/compiler_flang.h
bootstrap/flang_runtime.h
```

Два следствия для правки:

1. `compiler_flang.c` зовёт `flang_runtime.h` НЕ сам, а через
   `compiler_flang.h`. Зависимости, выписанные только по строкам `#include`
   самого исходника, смену `flang_runtime.h` до `compiler_flang.o` не донесут —
   нужен транзитивный обход заголовков.
2. `flang_cli.c:156` зовёт `flang_conc.h` под `#ifdef FL_WITH_CONC`, и в
   `bootstrap/` этого заголовка НЕТ. Зависимость на него make оборвёт
   («No rule to make target»), поэтому выписывать можно только те заголовки,
   которые печать кладёт рядом с исходником.

## Что должно быть

Смена заголовка пересобирает каждый объектный файл, который его включает.

## Обходной путь

Собирать с ключом `-B`: `make -C bootstrap -B`.

## Когда задача сделана

- `make -n -W compiler_flang.h -C bootstrap` называет пересборку
  `compiler_flang.o`; `make -n -W flang_runtime.h -C bootstrap` — всех четырёх
  объектных файлов;
- у функции «Печать Makefile» есть пример с этими зависимостями;
- проверка происхождения двоичного (`scripts/seed/binary-origin.fscript`) либо
  отдельная проба краснеет, когда объектный файл старше своего заголовка.

## Где живёт правка

`flang/self/emit-c.flang`, функция «Печать Makefile»: объявить поимённо
транзитивное замыкание заголовков каждого исходника, считая только те, что
печать кладёт рядом

```
flang_runtime.o: flang_runtime.c flang_runtime.h
compiler_flang.o: compiler_flang.c compiler_flang.h flang_runtime.h
flang_cli.o: flang_cli.c flang_runtime.h
flang_repl.o: flang_repl.c flang_runtime.h
```

Правка доезжает до `bootstrap/Makefile` перепечаткой самосборной части.
