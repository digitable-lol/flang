# Standard library

Which module to take for a task and how to import it. The library has
{{библиотека.файлов}} modules and {{библиотека.функций}} functions. Every
module has its own page: functions, their conditions and an example.

## Modules by task

@@библиотека:каталог@@

## Importing a module

`использует` is the import. The module name is written in English, as in the
catalogue above. No file path is needed.

File `sum.flang`:

```flang
модуль «Сумма до предела»
  использует «Lists»

тотальная функция «Сумма чисел до предела»
  принимает предел: число
  возвращает число
  пример «До пяти»
    дано предел равно 5
    ожидается 15
  «Сумма» от («Числа до» от предел)
```

```
$ flang check sum.flang
модуль «Сумма до предела»: функций 39, из них с доказанным завершением 39; типов 1; файлов вместе с импортами 2
sum.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
```

The first line counts functions together with the module: all functions of
Lists and one of yours. The second line lists what was checked: syntax, types,
termination, postconditions and tests. The tests of the module run with yours,
so a program with a large module (AES, TLS client) takes a few minutes to check.

### A module has no Russian name

Replace the module name in `sum.flang` with «Списки» ("lists" in Russian):

```
$ flang check sum.flang
…
FLANG_IMPORT_NOT_FOUND в файле sum.flang, строка 1, столбец 1: не найден модуль «Списки»: ни рядом с файлом, ни выше по каталогам, ни в библиотеке компилятора
FLANG_UNKNOWN_NAME в файле sum.flang, строка 10, столбец 3: неизвестная функция «Сумма»
…
sum.flang: не проверено — замечаний 5
```

There is no module «Списки»: lists are «Lists». The compiler says the module
was not found next to the file, up the directories, or in its library. The
`использует` line takes the English name.

### A part of a module

The word `только` imports the named functions and the ones they call:

```flang
  использует «Lists» только «Двоичный поиск»
```

With this line the program gets «Двоичный поиск» and the two functions it
needs. The tests of the other Lists functions do not run, and the check is
faster.

### Running a program with a module

`flang run` evaluates one function. Before that it looks whether every
postcondition of the program and of its modules is proved:

```
$ flang run sum.flang "«Сумма чисел до предела»" 5
не доказано: утверждений 66: доказано 42, сетка 24, на веру 0 — запуск только по явному согласию: --на-веру
…
$ flang run sum.flang "«Сумма чисел до предела»" 5 --trust
на веру: доказанность не считалась — запуск по ключу --trust
15
```

The first command stopped with exit code 3: of 66 postconditions 42 are proved
(`доказано`) and 24 are checked on tests only (`сетка`). The `--trust` flag runs
the program without this check; the unproved postconditions are then checked at
run time.

## How much is proved

A postcondition (`обеспечивает`) is a statement about the result of a function.
The compiler proves it for any arguments. Where it could not, the postcondition
is checked on the values from the tests and at run time.

@@библиотека:сводка@@

The status of every postcondition is on the module page, next to the function.
For your own program `flang check sum.flang --proof` prints the same report.

## Next

- [Modules and packages](packages.html) — your own module and a module by link.
- [Why and how to prove](proofs.html) — what "proved" means.
- [Unicode text](unicode-text.html) — normalization, graphemes, case.
