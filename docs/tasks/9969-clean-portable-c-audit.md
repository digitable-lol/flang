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

1. `clang -std=c99 -Wall -Wextra -Werror -pedantic -fsyntax-only bootstrap/*.c`
2. `grep -rn 'fsanitize\|cppcheck\|clang-tidy' --exclude-dir=.git --exclude-dir=docs .`
3. `grep -rn 'сверщик-san' --exclude-dir=.git .`
4. `make -C flang/proof/checker сверщик-san`, затем `make -C flang/proof/checker сверщик`
5. `grep -n 'define _POSIX_C_SOURCE\|define _XOPEN_SOURCE\|define _DARWIN_C_SOURCE' flang/src/emit/c/*.c flang/proof/checker/checker.c`
6. `command -v cppcheck clang-tidy gcc clang`

## Что происходит

```
$ clang -std=c99 -Wall -Wextra -Werror -pedantic -fsyntax-only bootstrap/*.c
                                                                    код 0, 11,8 с
$ grep -rn 'fsanitize\|cppcheck\|clang-tidy' --exclude-dir=.git --exclude-dir=docs .
flang/foreign/c/run.fscript:578:      "cc -std=c99 -O0 -w -fsanitize=undefined -fno-sanitize-recover=all …
flang/proof/checker/Makefile:12:	$(CC) -std=c99 -Wall -Wextra -pedantic -g -O1 -fsanitize=address,undefined -o $@ $<
scripts/targets/target-canons.tsv:4:c	clang-tidy	356
scripts/targets/target-canons.tsv:8:cpp	clang-tidy	72
                                                                    код 0
$ grep -rn 'сверщик-san' --exclude-dir=.git .
.gitignore:140:flang/proof/checker/сверщик-san
flang/proof/checker/Makefile:6:сверщик-san: checker.c
flang/proof/checker/Makefile:11:	rm -f сверщик сверщик-san
                                                                    код 0
$ make -C flang/proof/checker сверщик-san
checker.c:50:23: warning: null format string [-Wformat-truncation=]
                                                                    код 0, 9,1 с
$ make -C flang/proof/checker сверщик
                                                                    код 0, 6,4 с
$ grep -n 'define _POSIX_C_SOURCE\|define _XOPEN_SOURCE\|define _DARWIN_C_SOURCE' flang/src/emit/c/*.c flang/proof/checker/checker.c
flang/src/emit/c/flang_runtime.c:29:#define _POSIX_C_SOURCE 200809L
flang/src/emit/c/flang_runtime.c:45:#define _DARWIN_C_SOURCE
flang/src/emit/c/flang_conc.c:52:#define _POSIX_C_SOURCE 200809L
flang/src/emit/c/flang_conc.c:64:#define _DARWIN_C_SOURCE
flang/proof/checker/checker.c:19:#define _POSIX_C_SOURCE 200809L
flang/src/emit/c/flang_repl.c:87:#define _POSIX_C_SOURCE 200809L
flang/src/emit/c/flang_repl.c:113:#define _DARWIN_C_SOURCE
flang/src/emit/c/flang_repl.c:134:#define _XOPEN_SOURCE 700
                                                                    код 0
$ command -v cppcheck clang-tidy gcc clang
/usr/bin/cppcheck /usr/bin/clang-tidy /usr/bin/gcc /usr/bin/clang   код 0
```

Прогон под sanitizer в дереве ЕСТЬ — но его не зовёт никто. Цель
`сверщик-san` в `flang/proof/checker/Makefile` собирает проверяющую программу с
`-fsanitize=address,undefined`; на неё не ссылается ни `.flangrc`, ни одна
работа в `.github/`, и в `.gitignore` она стоит только как имя двоичного. Ни для
двоичного `bootstrap/flang`, ни для напечатанного C такой цели нет вовсе. Что
прибавилось к 11 октября 2026: чужой корпус C (`flang/foreign/c/run.fscript`) собирается с
`-fsanitize=undefined` — но это проверка чтения чужого C, а не нашего; и канон целей
(ADR-0081, `scripts/targets/target-canons.fscript`, работа `target-canons.yml`) гоняет
`clang-tidy` по напечатанным образцам C и C++ и держит потолок находок — 356 для `c` и 72 для
`cpp` в `scripts/targets/target-canons.tsv`. По рукописному C (`bootstrap/*.c`,
`flang/src/emit/c/*.c`) cppcheck и clang-tidy по-прежнему не зовёт никто.

Первая находка видна уже этой целью, без новой правки: на одном и том же файле
`-O2 -Werror` молчит, а `-O1` с sanitizer предупреждает — `checker.c:50`,
`null format string` (`-Wformat-truncation=`) на обёртке `fmt`, где `vsnprintf`
зовётся с пробным буфером в один байт. Разные наборы флагов дают разный приговор
одному файлу, и в проверках стоит только молчащий набор.

Второй компилятор предупреждений не даёт, и «второй» тут надо называть точно:
`cc` в дереве — gcc 15.2.0, то есть основной путь сборки уже gcc, а вторым
остаётся clang 21.1.8. Он проходит `-fsyntax-only` по всем четырём исходникам
`bootstrap/` (вместе с `compiler_flang.c`, самым большим) за 11,8 с. Макрос
`_POSIX_C_SOURCE` стоит в трёх файлах рантайма и в
`flang/proof/checker/checker.c`; в последнем он без парного `_DARWIN_C_SOURCE`.

Версия: flang 0.7.25 (шаги 1, 4 и 6 повторены 11 октября 2026: clang за 12,3 с без ошибок,
`сверщик-san` — то же одно предупреждение `checker.c:50`; `cc` — gcc 15.2.0, clang 21.1.8).

## Что должно быть

`packaging/homebrew/flang.rb` обещает, что нужен только компилятор C. Значит
неопределённого поведения и зависимости от платформы в напечатанном и
рукописном C нет, и это показано прогоном, а не отсутствием предупреждений.

## Обходной путь

Не нужен: известных отказов нет.

## Когда задача сделана

1. Двоичный, собранный с `-fsanitize=undefined,address`, прошёл `check` и
   `test` по `flang/stdlib` и печать одного файла `flang/self`; находки названы
   файлом и строкой или их нет.
2. Дерево собрано clang целиком, а не только `-fsyntax-only`: gcc уже стоит
   основным (`cc` → gcc 15.2.0), вторым остаётся clang. Расхождения в
   предупреждениях названы файлом и строкой.
3. cppcheck или clang-tidy прогнан по `bootstrap/*.c` и `flang/src/emit/c/*.c`;
   находки разобраны (по напечатанному C и C++ `clang-tidy` уже гоняет канон целей — 356 и 72
   находки под потолком; разобрать их — тоже сюда).
4. Проверено прогоном или чтением кода печати: знаковость `char`, размеры
   `int` и `long`, порядок вычисления аргументов, строгое совмещение указателей.
5. Макросы видимости сверены для glibc, musl и Darwin; для `checker.c` решено,
   нужен ли `_DARWIN_C_SOURCE`.
6. То, что среда проверить не дала, названо поимённо.
7. Хотя бы прогон под UBSan стоит ярлыком в `.flangrc` строкой `script.<имя>`
   (ADR-0049). Готовую цель `сверщик-san` не зовёт ни ярлык, ни CI —
   ярлык обязан звать и её.

## Где живёт правка

Находки в рукописном C — `flang/src/emit/c/*.c`, `flang/proof/checker/checker.c`
(быстрый пересев семени). Находки в напечатанном — `flang/self/emit-c.flang`
(перепечатка самосборной части). Ярлык — `.flangrc`; цель sanitizer для
проверяющей программы уже лежит в `flang/proof/checker/Makefile`.

Следующий шаг: `.flangrc` — короткая команда, которая зовёт `make -C flang/proof/checker
сверщик-san` и собирает `bootstrap/flang` с `-fsanitize=undefined,address`, затем `check` и `test`
по `flang/stdlib` этим двоичным (пункты 1 и 7). Проба, которая красна сегодня: `grep -n 'san'
.flangrc` молчит — цель `сверщик-san` не зовёт ни ярлык, ни CI.
