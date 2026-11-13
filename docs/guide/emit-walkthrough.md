[Back to README](../../README.md) · [Documentation index](../README.md) · [Русский](emit-walkthrough.ru.md)

# Print a program into C and JavaScript

`flang emit` prints a checked program as source text in another language: the module, a runtime,
a driver and a build file. Below, one program — the position where a value belongs in a sorted
list — is printed into C and JavaScript, built and run.

## The program

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

## Printing

Save the program to a file and name the target and the output directory:

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

Before printing, `emit` checks the program: parsing, types, termination and the proof kernel.
It does not run the examples — `flang test insert.flang` does. A postcondition proved for all
inputs is left out of the printed code; an unproved one is printed as a run-time check.

## What is in the directory

```bash
$ ls out-c
Makefile  flang_cli.c  flang_runtime.c  flang_runtime.h  search_insert_position.c  search_insert_position.h
$ ls out-js
flang_cli.js  package.json  search_insert_position.js
```

| part | in C | in JavaScript |
|---|---|---|
| program module: one function per flang function | a `.c` and `.h` pair named after the module | one `.js` with the runtime inside |
| runtime: values, arithmetic, diagnostics | `flang_runtime.c`, `flang_runtime.h` | — |
| driver: JSON in, JSON out | `flang_cli.c` | `flang_cli.js` |
| build | `Makefile` | `package.json` |

The module file is named after the module: «Search insert position» gave
`search_insert_position`. `--no-cli` prints without the driver; `--file <name>` writes one file
to standard output.

The second function of the program as printed:

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

The fold became an ordinary loop. Names are transliterated; the original name sits in the comment
above the function. Printed code is not edited by hand: edit the flang source and print again.

## Build and run

The driver reads one call per line from standard input and answers one line per call. A function
is called by its original flang name, and values are tagged (`n` is a number, `l` a list; the
full table is in [Embedding flang in another program](../site/embedding.md)):

```bash
$ cat in.json
{"fn":"Место вставки","args":[{"l":[{"n":"1"},{"n":"3"},{"n":"5"},{"n":"6"}]},{"n":"5"}]}
$ cd out-c && make
$ ./flang_cli < ../in.json
{"ok":true,"value":{"n":"2"}}
$ cd ../out-js && node flang_cli.js ./search_insert_position.js < ../in.json
{"ok":true,"value":{"n":"2"}}
```

Besides the driver, `make` in the C directory builds the static library
`libsearch_insert_position.a`, which you link into your own program. The JavaScript module is
loaded with a plain `import`, in Node and in the browser.

## The other targets

There are ten targets. The same program and the same `in.json` gave
`{"ok":true,"value":{"n":"2"}}` on each:

| target | files | build and run | checked with |
|---|---|---|---|
| `c` | 6 | `make`, then `./flang_cli` | gcc 15.2 |
| `cpp` | 7 | `make`, then `./flang_cli` | g++ 15.2 |
| `csharp` | 9 | `dotnet run -- SearchInsertPosition` | .NET 10.0 |
| `elixir` | 4 | `make run` | Elixir 1.20, OTP 29 |
| `go` | 5 | `make flang_cli`, then `./flang_cli` | Go 1.26 |
| `java` | 8 | `make run` | OpenJDK 26 |
| `js` | 3 | `node flang_cli.js ./search_insert_position.js` | Node 26.7 |
| `python` | 4 | `python3 flang_cli.py search_insert_position` | Python 3.14 |
| `rust` | 7 | `make build`, then `./target/debug/flang_cli search_insert_position` | Rust 1.97 |
| `ts` | 5 | `node flang_cli.js ./search_insert_position.ts` | Node 26.7 |

- On `csharp` the printed `make run` rule fails under .NET 10: the `-v quiet --nologo` switches
  reach the program instead of `dotnet`. The command in the table works.
- On `ts` the module runs under Node 23.6 and later with no build step. The type check
  `tsc -p .` was not run here: the machine had no `tsc`. Target details:
  [The TypeScript target](typescript-target.md).

Declarations `процесс` and `надзор` are printed with a scheduler only by `c` and `elixir`. Other
differences between targets are in [Known limits](limits.md).
