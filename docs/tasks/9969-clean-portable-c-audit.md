---
номер: 9969
заголовок: Напечатанный и рукописный C не проверяется на неопределённое поведение: ни прогона под sanitizer, ни статического анализа нет
статус: свободна
приоритет: P2
исполнитель: —
ветка: —
команда: любая
карта: Чего в языке нет вовсе
рядом: 9970, 9971
нужность: обещание «собирается любым компилятором C99» держится на предупреждениях одного компилятора
---

# 9969. Напечатанный и рукописный C не проверяется на неопределённое поведение: ни прогона под sanitizer, ни статического анализа нет

## Шаги воспроизведения

1. `clang -std=c99 -Wall -Wextra -Werror -pedantic -fsyntax-only bootstrap/flang_runtime.c bootstrap/flang_repl.c bootstrap/flang_cli.c`
2. `grep -rl 'fsanitize\|cppcheck\|clang-tidy' .github scripts flang/scripts bootstrap/Makefile`
3. `grep -n 'define _POSIX_C_SOURCE\|define _XOPEN_SOURCE\|define _DARWIN_C_SOURCE' flang/src/emit/c/*.c flang/proof/checker/checker.c`

## Что происходит

```
$ clang -std=c99 -Wall -Wextra -Werror -pedantic -fsyntax-only bootstrap/flang_runtime.c bootstrap/flang_repl.c bootstrap/flang_cli.c
                                                                    код 0
$ grep -rl 'fsanitize\|cppcheck\|clang-tidy' .github scripts flang/scripts bootstrap/Makefile
                                                                    код 1
$ grep -n 'define _POSIX_C_SOURCE\|define _XOPEN_SOURCE\|define _DARWIN_C_SOURCE' flang/src/emit/c/*.c flang/proof/checker/checker.c
flang/src/emit/c/flang_runtime.c:29:#define _POSIX_C_SOURCE 200809L
flang/src/emit/c/flang_runtime.c:45:#define _DARWIN_C_SOURCE
flang/src/emit/c/flang_conc.c:52:#define _POSIX_C_SOURCE 200809L
flang/src/emit/c/flang_conc.c:64:#define _DARWIN_C_SOURCE
flang/proof/checker/checker.c:19:#define _POSIX_C_SOURCE 200809L
flang/src/emit/c/flang_repl.c:87:#define _POSIX_C_SOURCE 200809L
flang/src/emit/c/flang_repl.c:113:#define _DARWIN_C_SOURCE
flang/src/emit/c/flang_repl.c:134:#define _XOPEN_SOURCE 700
```

Второй компилятор предупреждений не даёт. Прогона под UBSan и ASan, cppcheck и
clang-tidy нет ни в проверках дерева, ни в CI. Макрос `_POSIX_C_SOURCE` стоит в трёх
файлах рантайма и в `flang/proof/checker/checker.c`; в последнем он без парного
`_DARWIN_C_SOURCE`.

Версия: flang 0.7.23, 30 сентября 2026.

## Что должно быть

`packaging/homebrew/flang.rb` обещает, что нужен только компилятор C. Значит
неопределённого поведения и зависимости от платформы в напечатанном и
рукописном C нет, и это показано прогоном, а не отсутствием предупреждений.

## Обходной путь

Не нужен: известных отказов сегодня нет.

## Когда задача сделана

1. Двоичный, собранный с `-fsanitize=undefined,address`, прошёл `check` и
   `test` по `flang/stdlib` и печать одного файла `flang/self`; находки названы
   файлом и строкой или их нет.
2. Дерево собрано вторым компилятором (gcc и clang); расхождения в
   предупреждениях названы.
3. cppcheck или clang-tidy прогнан по `bootstrap/*.c` и `flang/src/emit/c/*.c`;
   находки разобраны.
4. Проверено прогоном или чтением кода печати: знаковость `char`, размеры
   `int` и `long`, порядок вычисления аргументов, строгое совмещение указателей.
5. Макросы видимости сверены для glibc, musl и Darwin; для `checker.c` решено,
   нужен ли `_DARWIN_C_SOURCE`.
6. То, что среда проверить не дала, названо поимённо.
7. Хотя бы прогон под UBSan стоит ярлыком в `ярлыки.flang`.

## Где живёт правка

Находки в рукописном C — `flang/src/emit/c/*.c`, `flang/proof/checker/checker.c`
(быстрый пересев семени). Находки в напечатанном — `flang/self/emit-c.flang`
(перепечатка самосборной части). Ярлык — `ярлыки.flang`.
