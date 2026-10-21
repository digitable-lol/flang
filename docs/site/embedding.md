# Embedding flang in someone else's program

flang is not embedded as a runtime and is not called through an FFI. It is
**emitted into source code in your language** — and from there it is an ordinary
file of your project: a static library in C, a module in JavaScript, a module in
Python. The emitted code knows nothing about flang: neither the compiler nor a
virtual machine is anywhere near it while it runs.

There are {{цели.поАнглийски}} emit targets: {{цели.список}}.

## One command

```bash
flang emit <file> --target <target> --out <directory>
```

| flag | what it does |
|---|---|
| `--out directory` | where to write; the directory need not exist, it is created |
| `--no-cli` | do not emit the runner — module and runtime only |
| `--max-steps N`, `--max-depth N` | limits baked into the emitted code as defaults |
| `--index-base 0` or `--index-base 1` | the program's index base; lands in `FL_INDEX_BASE` |
| `--runtime path` | where to take the target's runtime sources from |

`--max-steps 500 --max-depth 200` produce exactly `const $DEFAULT_MAX_STEPS =
500` and `const $DEFAULT_MAX_DEPTH = 200` in the emitted JavaScript module;
`--index-base 0` produces the line `#define FL_INDEX_BASE 0` in the C runtime
header.

**What does not check does not get emitted.** `emit` first runs the same checks
as `check`, and on the first trouble it refuses without writing a single file:

```bash
$ flang emit broken.flang --target js --out ./out
FLANG_TYPE в файле broken.flang, строка 10, столбец 5: функция «Удвоить»
 объявлена как строка, а тело даёт число
…
flang emit: печать отменена — программа не проходит проверку, замечаний 4.
$ ls ./out
ls: cannot access './out': No such file or directory
```

Emission also warns about the entry boundary:

```
аргументы напечатанной программы по типам не проверяются: это ограничение
двоичного flang
```

The emitted code builds and runs; the runner's arguments are simply not checked
against the declared types. The way around it is below, in the section on the
runner over a pipe.

## What arrives in the directory

One run per target, the same program every time —
`docs/examples/rosetta/factorial-english.flang`:

| target | files |
|---|---|
| `c` | `flang_runtime.h` `flang_runtime.c` `factorial.h` `factorial.c` `flang_cli.c` `Makefile` |
| `cpp` | `flang_runtime.hpp` `flang_runtime.cpp` `flang_cpp.hpp` `factorial.hpp` `factorial.cpp` `flang_cli.cpp` `Makefile` |
| `csharp` | `Value.cs` `Field.cs` `FlangError.cs` `Ctx.cs` `Flang.cs` `Factorial.cs` `FlangCli.cs` `flang.csproj` `Makefile` |
| `elixir` | `flang_runtime.ex` `factorial.ex` `flang_cli.ex` `Makefile` |
| `go` | `go.mod` `flangrt/flang_runtime.go` `flang/factorial.go` `cli/main.go` `Makefile` |
| `java` | `Value.java` `Field.java` `FlangError.java` `Ctx.java` `Flang.java` `Factorial.java` `FlangCli.java` `Makefile` |
| `js` | `factorial.js` `flang_cli.js` `package.json` |
| `python` | `flang_runtime.py` `factorial.py` `flang_cli.py` `Makefile` |
| `rust` | `Cargo.toml` `src/runtime.rs` `src/factorial.rs` `src/lib.rs` `src/cli.rs` `src/main.rs` `Makefile` |
| `ts` | `factorial.ts` `flang_runtime.js` `flang_cli.js` `package.json` `tsconfig.json` |

The layout is the same everywhere: a **runtime** (values, arithmetic,
diagnostics), the **program module** (one function per flang function), a
**runner**, and a build file. With `--no-cli` the runner is gone: `js` is left
with `factorial.js` and `package.json`, `c` with five files out of six.

A program with `процесс` and `надзор` declarations is emitted with a scheduler
on `c` and `elixir` only; on the other targets the handlers arrive as ordinary
functions and the calling is yours. Concurrency per target is also named in the
`возможности` field of the `emit` answer.

## C: build it and link it into your program

```bash
$ flang emit docs/examples/rosetta/factorial-english.flang --target c --out ./out-c
напечатано файлов 6, байт …, в ./out-c
$ ls ./out-c
Makefile  factorial.c  factorial.h  flang_cli.c  flang_runtime.c  flang_runtime.h
```

`make` in that directory builds a **static library** and the runner:

```bash
$ cd out-c && make -j4
cc -std=c99 -Wall -Wextra -Werror -pedantic -O2 -flto   -c -o flang_runtime.o flang_runtime.c
cc -std=c99 -Wall -Wextra -Werror -pedantic -O2 -flto   -c -o factorial.o factorial.c
cc -std=c99 -Wall -Wextra -Werror -pedantic -O2 -flto   -c -o flang_cli.o flang_cli.c
ar rcs libfactorial.a flang_runtime.o factorial.o
cc -std=c99 -Wall -Wextra -Werror -pedantic -O2 -flto -o flang_cli flang_cli.o flang_runtime.o factorial.o -lm -lpthread
```

The library is `lib<module>.a`, where `<module>` is the same slug the files
carry: module «Factorial» gave `libfactorial.a`, module «Хранилище ссылок» gave
`libhranilische_ssylok.a`. There are exactly two dependencies: `-lm` and
`-lpthread`.

**The entry point is not `main` — it is one function per function.** The header
states the calling contract itself:

```c
/*
 * Контракт вызова: функция кладёт результат в *result и возвращает FL_OK
 * либо НЕ трогает *result и возвращает FL_ERROR, заполнив *error (его можно
 * передать NULL). Результат живёт в арене контекста — до ближайшего
 * fl_arena_reset; чтобы сохранить его надолго, скопируйте в свою память.
 */
fl_status factorial_factorial(fl_ctx *ctx, fl_value n, fl_value *result, fl_error *error);
fl_status factorial_product(fl_ctx *ctx, fl_value items, fl_value *result, fl_error *error);
```

The C name is `<module>_<function>`, both slugs. «Factorial» →
`factorial_factorial`; «Приписать в начало» in module «Факториал» →
`faktorial_pripisat_v_nachalo`. Beside the functions the header declares
`factorial_call`, which calls by the original flang name («Factorial», not the
slug) for anyone binding dynamically, and `factorial_entry`, the table of
declared parameter types as data.

A C host is an ordinary file that includes the header and links against the
archive:

```c
#include <stdio.h>
#include "factorial.h"

int main(void) {
  fl_arena arena;
  fl_ctx ctx;
  fl_error error = {0};
  fl_value result;

  fl_arena_init(&arena);
  fl_ctx_init(&ctx, &arena);

  if (factorial_factorial(&ctx, fl_number(10), &result, &error) != FL_OK) {
    printf("отказ: %s — %s\n", error.code, error.message);
    fl_arena_release(&arena);
    return 1;
  }
  printf("factorial(10) = %.0f\n", result.as.number);

  fl_value items[4] = { fl_number(1), fl_number(2), fl_number(3), fl_number(4) };
  if (factorial_product(&ctx, fl_list(items, 4), &result, &error) != FL_OK) { … }
  printf("product([1,2,3,4]) = %.0f\n", result.as.number);

  /* A refusal as a value: a string where a number is expected. */
  if (factorial_factorial(&ctx, fl_text_borrow("x", 1, 1), &result, &error) != FL_OK) {
    printf("отказ: %s — %s\n", error.code, error.message);
  }

  fl_arena_release(&arena);
  return 0;
}
```

```bash
$ cc -std=c99 -Wall -Wextra -Werror -pedantic -O2 -o host host.c libfactorial.a -lm -lpthread
$ ./host
factorial(10) = 3628800
product([1,2,3,4]) = 24
отказ: FLANG_TYPE — сравнения порядка допустимы только для чисел
```

Three rules are visible right there, and you will have to keep them:

1. **The arena is yours.** `fl_arena_init` … `fl_arena_release` bracket the work;
   everything the functions returned lives in the arena and dies with it. Need a
   result to outlive it — copy it into your own memory.
2. **A refusal is not thrown.** There are no exceptions, neither in the language
   nor in the emitted C: a refusal is `FL_ERROR` plus a filled `fl_error` with
   fields `code` and `message`.
3. **`fl_ctx` carries the limits**: depth, step count and a check on remaining
   stack. One context can be reused across calls, as above.

WebAssembly comes from the same place: the emitted C moves there without edits.

## The value at the boundary

Each emit target has its own representation of a value, and that is precisely
the boundary across which you talk to the program.

### C

`fl_value` is a tag plus a union (`flang_runtime.h`):

| flang | tag | how to read it |
|---|---|---|
| number | `FL_NUMBER` | `v.as.number` — a `double`, always; the language has no integers |
| flag | `FL_FLAG` | `v.as.flag` |
| string | `FL_STRING` | `v.as.string.utf8`, `.bytes`, `.points` |
| list | `FL_LIST` | `v.as.list.items`, `.count` |
| record | `FL_RECORD` | `fl_field_get(ctx, v, "field name", &out, &err)` |
| variant | `FL_VARIANT` | `fl_variant_is(v, "Name")`, `fl_variant_field(ctx, v, "field", …)` |
| nothing | `FL_NOTHING` | no payload |

**A string is not required to be NUL-terminated**: a substring and a tail are
slices of shared memory. Print it by length, not with `%s`. And there are two
lengths: `bytes` — UTF-8 octets, `points` — code points; `длина` in the language
counts the latter.

Two constructors make a string in C: `fl_text_borrow(utf8, bytes, points)` — no
copy, the caller counts the code points; `fl_text(ctx, utf8, bytes, &out, &err)`
— copies into the arena, the runtime counts the points. The second is safer.

**Field and variant names are not translated.** Only function and module names
are transliterated; a field declared as «адрес» is taken in C by exactly that
name — `fl_field_get(&ctx, v, "адрес", …)`.

**A refusal declared as a value arrives as a value.** In
`docs/examples/errors/number-parsing.flang` the function «Разобрать число»
returns the sum type «Вышло» | «Не вышло» — and at the boundary that is a
variant, not `FL_ERROR`:

```
42 → Вышло, значение = 42
abc → Не вышло, сообщение = «к числу»: строка "abc" не является числом
```

The difference matters: `FL_ERROR` is a refusal of the computation (wrong type,
out of steps, out of depth), whereas a variant is the function's ordinary answer,
which you take apart with `fl_variant_is`.

### JavaScript

The representation is the plain one: a number is a `number`, a string is a
`string`, a flag is a `boolean`, "nothing" is `null`, a list is an `Array`
(`Array.isArray` answers `true`), a record is a plain object with the original
field names, a variant is an instance of an internal class with fields `variant`
and `fields`. A refusal **is thrown**: a `FlangError` with `code`, `message` and
`diagnostics`.

### Python

The Python representation is **different**, and you need to know that before the
first call: values are boxed (`Value` with fields `tag` and `data`), functions
take the context as their first argument, and a bare number is not accepted:

```python
import factorial, flang_runtime as rt

ctx = factorial.new_context()
r = factorial.fn_factorial(ctx, rt.number(10))      # not 10, but rt.number(10)
print("factorial(10) =", r.tag, r.data)             # → 1 3628800.0
p = factorial.fn_product(ctx, rt.list_of([rt.number(x) for x in (1, 2, 3, 4)]))
print("product([1,2,3,4]) =", p.data)               # → 24.0
try:
    factorial.fn_factorial(ctx, rt.text("x"))
except rt.FlangError as e:
    print("отказ:", e.code, "|", e.message)         # → FLANG_TYPE | сравнения порядка допустимы только для чисел
```

The rule that holds for every target: **read the emitted header or module.** It
carries the parameter types, the calling contract, and the `тотальная` (total)
mark on every function.

Refusal codes (`FLANG_TYPE`, `FLANG_RECURSION_LIMIT`, …) arrive the same on
every target; the diagnostic **texts** are Russian on every target, even when
the program is written on the English keyword surface. Depend on the code in
your program, not on the text.

## JavaScript: embedding into your own project

The module is self-contained: not a single `import` and not a single `require`
at the top level — the one import it has sits inside `$callDeep` and is taken
dynamically.

```bash
$ flang emit docs/examples/rosetta/factorial-english.flang --target js --no-cli --out ./out-js
напечатано файлов 2, байт …, в ./out-js
$ ls ./out-js
factorial.js  package.json
```

```js
import { factorial, product, $newContext } from "./factorial.js"

console.log(factorial(10))          // 3628800
console.log(product([1, 2, 3, 4]))  // 24
```

Names are camelCase from the flang name: «Factorial» → `factorial`, «Numbers from
and to» → `numbersFromAndTo`. For a program on the Russian surface they are
transliterated: module «Разбор числа» gives the file `razbor_chisla.js` and the
function `razobratChislo`, while **fields and variant names stay as they were**:

```js
import { razobratChislo, Vyshlo } from "./razbor_chisla.js"

for (const текст of ["42", "abc"]) {
  const итог = razobratChislo(текст)
  console.log(JSON.stringify(текст), "→", итог.variant, JSON.stringify(итог.fields))
}
console.log("built by the host:", JSON.stringify(Vyshlo({ значение: 7 })))
```

```
"42" → Вышло {"значение":42}
"abc" → Не вышло {"сообщение":"«к числу»: строка \"abc\" не является числом"}
built by the host: {"variant":"Вышло","fields":{"значение":7}}
```

### The trap: the `.js` extension and your package's `"type"`

The file is emitted with a `.js` extension and written in ECMAScript modules. In
a project whose `package.json` declares `"type": "commonjs"` (which is also the
default), Node reads it as CommonJS and the named import fails:

```
SyntaxError: Named export 'factorial' not found. The requested module './factorial.js'
is a CommonJS module, which may not support all module.exports as named exports.
```

Two cures, both work: rename the file to `.mjs`, or declare `"type": "module"`
in the directory it landed in.

### Limits and depth

`$newContext({ maxSteps, maxDepth })` sets the limits **fresh** — anything not
passed goes back to the default instead of lingering from the previous call. A
refusal on a limit is a `FlangError` with code `FLANG_RECURSION_LIMIT`:

```
FlangError | FLANG_RECURSION_LIMIT | функция «Numbers from and to» исчерпала лимит шагов (50) на глубине вызовов 50
```

A separate trouble in JavaScript: **the host's stack does not reach the declared
depth.** A direct call computes on your stack, and deep recursion hits it before
it hits the declared limit. The module catches that and says so plainly instead
of falling over with someone else's error:

```
прямой вызов 9000: FLANG_RECURSION_LIMIT | функция «Numbers from and to» исчерпала стек хозяина
на глубине 6952, не дойдя до предела глубины вызовов (10000)
$callDeep 9000: длина 9000
```

The lever is `await $callDeep(fn, [args], limits)`: the computation moves into a
thread with an explicitly sized stack, and the declared limit becomes reachable.
In a browser, and anywhere the thread did not start, the computation runs as
before and the guard tells the truth about it.

### A real host: an HTTP service in flang, called from Node

The tree holds a link shortener (`docs/examples/web/shortener/`) — an HTTP
handler written entirely in flang, whose state is passed by value. Emit it to
`js`, and the Node host wraps the emitted module:

```js
import { obsluzhit, $newContext } from "./sluzhba_ssylok.js"

$newContext({ maxSteps: 40000000 })
let состояние = { записи: [], выдано: 0 }
/* СЦЕНАРИЙ is a list of «name, request bytes» pairs; in a real server its place
   is taken by `while (true) accept()`. */
for (const [имя, текст] of СЦЕНАРИЙ) {
  const о = obsluzhit(состояние, текст)     // a record in, a record out
  состояние = о["состояние"]
  console.log(о["код"], имя, (о["ответ"] || "").split("\r\n")[0])
}
```

```
200 | здоровье                | HTTP/1.1 200 OK
201 | создание ссылки         | HTTP/1.1 201 Created
301 | переход по коду         | HTTP/1.1 301 Moved Permanently
422 | ЗЛАЯ СХЕМА javascript:  | HTTP/1.1 422 Unprocessable Content
хранилище: {"записи":[{"код":"к1","адрес":"https://пример.рф/док","переходов":1}],"выдано":1}
```

Non-termination lives in the host's loop, while the handler always terminates.

## Any language: the runner over a pipe

If there is no target for your language, or you would rather not bind by source,
there is a third road — the runner emitted next to the module: **JSON in, JSON
out, one process per stream of requests.** The protocol is the same on every
target.

```bash
$ printf '%s\n' '{"fn":"Factorial","args":[{"n":"10"}]}' \
                '{"fn":"Product","args":[{"l":[{"n":"1"},{"n":"2"},{"n":"3"},{"n":"4"}]}]}' \
                '{"fn":"Factorial","args":[{"s":"x"}]}' | node flang_cli.js ./factorial.js
{"ok":true,"value":{"n":"3628800"}}
{"ok":true,"value":{"n":"24"}}
{"ok":false,"code":"FLANG_TYPE","message":"сравнения порядка допустимы только для чисел"}
```

The same input fed to the `./flang_cli` binary built from the `c` target gives
the same lines. A function is called by its **original flang name**, not by the
slug. Values are tagged, because JSON is poorer than the language:

| tag | value |
|---|---|
| `{"n":"1.5"}` | a number as a string — otherwise `NaN`, `Infinity` and −0 would be lost |
| `{"s":"…"}` | a string |
| `{"l":[…]}` | a list |
| `{"r":[["field", …]]}` | a record |
| `{"v":"Name","f":[…]}` | a variant |
| `null`, `true`/`false` | "nothing", a flag |

The table of declared parameter types is printed beside the module
(`factorial_entry` in C, `$PROGRAM.entry` in JS), but the binary
leaves it empty and says so on every print: «аргументы напечатанной программы по
типам не проверяются» — "the arguments of the printed program are not checked
against types". So the runner answers `{"s":"x"}` with the same words as the
direct call `factorial("x")` — «сравнения порядка допустимы только для чисел»,
"order comparisons are only allowed for numbers" — and not with "argument does
not match the type"; a type check before the call exists only on the `c` target
at the `enter` door (see [the host boundary](host-boundary.html)).

## C without libc: for an OS kernel

A kernel, a boot loader or firmware has no C library: no `malloc`, no threads,
no files, no `abort`. The ordinary C print needs all of them — the four-function
module `права.flang` from issue #383 pulled in 54 outside functions, `pthread_create`
and `sigaction` among them. The `--freestanding` flag prints C for such a place:

```bash
flang emit права.flang --target c --freestanding --out k
cd k && cc -std=c99 -O2 -ffreestanding -nostdlib -c *.c && ld -r -o all.o *.o
nm -u all.o     # prints nothing: the code calls no outside function
```

Measured on that module with gcc 15: no outside functions, 449 bytes of machine
code, no warnings under `-Wall -Wextra -pedantic`. The same files build with
clang for `riscv64-unknown-elf`.

Three files arrive:

| file | what is in it |
|---|---|
| `fl_freestanding.h` | status codes and checked arithmetic, about a hundred lines |
| `<module>.h` | the types and the function declarations |
| `<module>.c` | the functions |

They include only `<stdint.h>`, `<stddef.h>` and `<stdbool.h>`, which the C
compiler gives even without a C library.

How the program looks in C:

| flang | C |
|---|---|
| `признак` | `bool` |
| `неотрицательное` | `uint64_t`, at most 2⁵³ − 1 |
| `целое` | `int64_t`, from −(2⁵³ − 1) to 2⁵³ − 1 |
| `число` | `int64_t`: a whole number only, see below |
| `точное целое` | `uint64_t`; a result past 64 bits gives `FL_FS_OVERFLOW` |
| a record | a `struct` with its fields at fixed places |
| a sum type | a `struct` with a `tag` and the variant's fields in `as` |

A function returns a status, and the answer goes to its last argument:

```c
fl_fs_status prava_oslabit(prava_mandat_t p0_m, prava_prava_t p1_maska,
                           prava_mandat_t *out);
```

`FL_FS_OK` is zero. Any other code names the reason: a `требует` your call broke
(`FL_FS_PRECONDITION`), a number outside its type (`FL_FS_RANGE`), an exact
integer that would go below zero (`FL_FS_NEGATIVE`) or past 64 bits
(`FL_FS_OVERFLOW`), `остаток от` zero, a sum value with an unknown tag
(`FL_FS_BAD_TAG`). Nothing calls `abort`. Nothing takes memory either: every
value is a fixed-size `struct` on the caller's stack, so there is no allocator
to pass in.

What is checked while the code runs:

- a postcondition that `flang check` proved for every input is not printed; any
  other `обеспечивает` is checked and answers `FL_FS_POSTCONDITION`;
- `требует` is always checked: the prover showed that calls inside the module
  keep it, but a call from your C code is out of its reach;
- arguments are checked against their types on the way in: a `неотрицательное`
  above 2⁵³ − 1 answers `FL_FS_RANGE`;
- there is no step counter: only `тотальная` functions are printed, and the
  check before printing has proved that they end. Recursion uses the C stack,
  and how deep it goes is yours to watch.

**Why `число` is allowed.** In flang `число` is a double. Printed without libc,
it is a 64-bit integer, and the two agree because the printer refuses
everything that makes a fraction: a fractional literal, `делить на`, percent.
Whole numbers stay exact in a double up to 2⁵³, and a result past that answers
`FL_FS_RANGE` instead of a rounded value. So whenever the C code answers
`FL_FS_OK`, it gives the same number as `flang run`.

**What the first version refuses.** Strings, lists, fractions and division,
`вес` and `сотых`, a type that contains itself (a tree or a list needs memory),
generic types, functions as values, calls of library functions, `план` and
processes. The refusal names the function and exits with code `1`:

```text
$ flang emit hello.flang --target c --freestanding --out k
flang emit: печать отказала — FLANG_FREESTANDING_UNSUPPORTED: функция «Привет», параметр «имя»: печатаются признак, число (только целое), неотрицательное, целое, точное целое и записи и суммы из них; строки, списки, вес, доли и параметры типов — нет
```

A C compiler may call `memcpy` or `memset` on its own to copy a large `struct`;
every kernel has both.

## What is not promised

- **the bytes of the emitted code.** The promise is behavioural: the same
  program yields the same values and the same refusal codes, not the same bytes;
- **diagnostic texts** — only codes. The texts are Russian on every target;
- **TypeScript declarations.** There is no `.d.ts`; types arrive as JSDoc
  comments inside the module, enough for editor hints, not for a strict build;
- **concurrency everywhere.** Processes run on `c` and `elixir`, parallelism on
  `elixir`;
- **type-checked arguments** — neither on a direct call nor in the runner over a
  pipe: the table on the entry boundary is left empty, and the binary
  says so when printing. The exception is the `enter` door on the `c` target.

## Next

- [First program](getting-started.html) — where to start if you have not installed flang yet
- [Packages](packages.html) — how to assemble a flang library before emitting it
