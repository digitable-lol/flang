[К README](../README.ru.md) · [Указатель документации](../README.md) · [English](emit-walkthrough.md)

# Напечатать программу в C и JavaScript

`flang emit` печатает проверенную программу исходным текстом другого языка: модуль, рантайм,
прогонщик и файл сборки. Ниже одна программа — место, куда значение встаёт в отсортированном
списке, — напечатана в C и JavaScript, собрана и запущена.

## Программа

```flang
модуль «Search insert position»

тотальная функция «Шаг места вставки»
  принимает акк: число, эл: число, цель: число
  возвращает число
  обеспечивает «меньший элемент двигает место» если эл меньше цель то (результат равен (акк плюс 1)) иначе да
  обеспечивает «иначе место стоит на прежнем» если не (эл меньше цель) то (результат равен акк) иначе да
  пример «Элемент меньше цели — шаг вперёд»
    дано акк равно 2
    дано эл равно 3
    дано цель равно 5
    ожидается 3
  пример «Элемент не меньше цели — место не двигается»
    дано акк равно 2
    дано эл равно 7
    дано цель равно 5
    ожидается 2
  если эл меньше цель то акк плюс 1 иначе акк

тотальная функция «Место вставки»
  принимает элементы: список числа, цель: число
  возвращает число
  пример «Пример 1 из условия»
    дано элементы равно [1, 3, 5, 6]
    дано цель равно 5
    ожидается 2
  пример «Пример 2 из условия»
    дано элементы равно [1, 3, 5, 6]
    дано цель равно 2
    ожидается 1
  пример «Пример 3 из условия»
    дано элементы равно [1, 3, 5, 6]
    дано цель равно 7
    ожидается 4
  свёртка элементы начиная с 0 как акк и эл → «Шаг места вставки» от акк и эл и цель
```

## Печать

Сохраните программу в файл и назовите цель и каталог вывода:

```bash
$ flang emit insert.flang --target c --out out-c
проверок при работе снято 2: постусловие доказано ядром обо всех входах и
проверено примерами функции — в напечатанный код оно не едет.
напечатано файлов 6, байт 612850, в out-c
…
$ flang emit insert.flang --target js --out out-js
…
напечатано файлов 3, байт 54552, в out-js
```

Перед печатью `emit` проверяет программу: разбор, типы, завершаемость и ядро доказательств.
Примеры он не гоняет — для них `flang test insert.flang`. Постусловие, доказанное для всех
входов, в напечатанный код не попадает; недоказанное печатается проверкой при работе.

## Что лежит в каталоге

```bash
$ ls out-c
Makefile  flang_cli.c  flang_runtime.c  flang_runtime.h  search_insert_position.c  search_insert_position.h
$ ls out-js
flang_cli.js  package.json  search_insert_position.js
```

| часть | в C | в JavaScript |
|---|---|---|
| модуль программы: функция на функцию flang | пара `.c` и `.h` с именем модуля | один `.js`, рантайм внутри него |
| рантайм: значения, арифметика, диагностики | `flang_runtime.c`, `flang_runtime.h` | — |
| прогонщик: JSON на входе, JSON на выходе | `flang_cli.c` | `flang_cli.js` |
| сборка | `Makefile` | `package.json` |

Имя файла модуля берётся из имени модуля: «Search insert position» дал
`search_insert_position`. Ключ `--no-cli` печатает без прогонщика, `--file <имя>` выводит один
файл на стандартный вывод.

Вторая функция программы в напечатанном виде:

```c
fl_status search_insert_position_mesto_vstavki(fl_ctx *ctx, fl_value elementy,
                                               fl_value cel, fl_value *result,
                                               fl_error *error) {
  fl_value fl_t2 = fl_nothing();
  FL_TRY(fl_require_list(ctx, elementy, "свёртка", &fl_t2, error));
  fl_value akk = fl_number(0.0);
  const fl_mark fl_t4 = fl_region_open(ctx);
  for (size_t fl_t3 = 0; fl_t3 < fl_t2.as.list.count; fl_t3 += 1) {
    const fl_value el = fl_t2.as.list.items[fl_t3];
    fl_value fl_t5 = fl_nothing();
    FL_TRY(search_insert_position_shag_mesta_vstavki(ctx, akk, el, cel, &fl_t5,
                                                     error));
    akk = fl_t5;
    FL_TRY(fl_region_recycle(ctx, fl_t4, &akk, error));
  }
  FL_TRY(fl_region_close(ctx, fl_t4, FL_OK, &akk, error));
  *result = akk;
  return FL_OK;
}
```

```js
export function mestoVstavki(elementy, cel) {
  const $t1 = $requireList(elementy, "свёртка");
  let akk = 0;
  for (const el of $t1) {
    akk = shagMestaVstavki(akk, el, cel);
  }
  return akk;
}
```

Свёртка стала обычным циклом. Имена переведены в латиницу, исходное имя стоит в комментарии над
функцией. Напечатанное руками не правят: правится исходник на flang и печатается заново.

## Собрать и запустить

Прогонщик читает со стандартного ввода по вызову на строку и отвечает строкой на вызов. Функция
зовётся исходным именем flang, значения размечены тегами (`n` — число, `l` — список; полная
таблица — [«Встроить flang в чужую программу»](../site/embedding.ru.md)):

```bash
$ cat in.json
{"fn":"Место вставки","args":[{"l":[{"n":"1"},{"n":"3"},{"n":"5"},{"n":"6"}]},{"n":"5"}]}
$ cd out-c && make
$ ./flang_cli < ../in.json
{"ok":true,"value":{"n":"2"}}
$ cd ../out-js && node flang_cli.js ./search_insert_position.js < ../in.json
{"ok":true,"value":{"n":"2"}}
```

Кроме прогонщика, `make` в каталоге C собирает статическую библиотеку
`libsearch_insert_position.a` — её линкуют в свою программу. Модуль JavaScript подключается
обычным `import` и в Node, и в браузере.

## Остальные цели

Целей десять. Та же программа и тот же ввод на каждой дали `{"ok":true,"value":{"n":"2"}}`:

| цель | файлов | собрать и запустить | проверено на |
|---|---|---|---|
| `c` | 6 | `make`, затем `./flang_cli` | gcc 15.2 |
| `cpp` | 7 | `make`, затем `./flang_cli` | g++ 15.2 |
| `csharp` | 9 | `dotnet run -- SearchInsertPosition` | .NET 10.0 |
| `elixir` | 4 | `make run` | Elixir 1.20, OTP 29 |
| `go` | 5 | `make flang_cli`, затем `./flang_cli` | Go 1.26 |
| `java` | 8 | `make run` | OpenJDK 26 |
| `js` | 3 | `node flang_cli.js ./search_insert_position.js` | Node 26.7 |
| `python` | 4 | `python3 flang_cli.py search_insert_position` | Python 3.14 |
| `rust` | 7 | `make build`, затем `./target/debug/flang_cli search_insert_position` | Rust 1.97 |
| `ts` | 5 | `node flang_cli.js ./search_insert_position.ts` | Node 26.7 |

- У `csharp` напечатанное правило `make run` на .NET 10 падает: ключи `-v quiet --nologo`
  уходят программе вместо `dotnet`. Команда из таблицы работает.
- У `ts` модуль запускается Node 23.6 и новее без сборки. Проверка типов `tsc -p .` здесь не
  прогонялась: `tsc` на машине не было. Подробности цели — [«Цель TypeScript»](typescript-target.ru.md).

Объявления `процесс` и `надзор` с планировщиком печатают только `c` и `elixir`. Остальные
различия между целями — в [«Известных ограничениях»](limits.ru.md).
