# Embedding flang in someone else's program

flang is not embedded as a runtime and is not called through an FFI. It is
**emitted into source code in your language** — and from there it is an ordinary
file of your project: a static library in C, a module in JavaScript, a module in
Python. The emitted code knows nothing about flang: neither the compiler nor a
virtual machine is anywhere near it while it runs.

There are {{цели.поАнглийски}} emit targets: {{цели.список}}.

Not one command and not one number here is from memory: everything was run
against this tree with the compiler from the repository
(`node flang/bin/flang.mjs`) under Node v26.7.0, `cc` 15.2.0, Python 3.14.4,
Linux 7.0.0.

## One command

```bash
node flang/bin/flang.mjs emit <file> --target <target> --out <directory>
```

Without `--target` the command names the whole list itself and refuses:

```bash
$ node flang/bin/flang.mjs emit
{"error":"emit требует --target <язык>; доступны: c, csharp, elixir, go, java, js, python, rust", …}
```

The flags that matter to someone embedding:

| flag | what it does |
|---|---|
| `--out directory` | where to write; the directory need not exist, it is created |
| `--no-cli` | do not emit the runner — module and runtime only |
| `--max-steps N`, `--max-depth N` | limits baked into the emitted code as defaults |
| `--index-base 0` or `--index-base 1` | the program's index base; lands in `FL_INDEX_BASE` |

Verified by running it: `--max-steps 500 --max-depth 200` produce exactly
`const $DEFAULT_MAX_DEPTH = 200` and `const $DEFAULT_MAX_STEPS = 500` in the
emitted JavaScript module, and `--index-base 0` produces the line
`#define FL_INDEX_BASE 0` in the C runtime header.

**What does not check does not get emitted.** `emit` first runs the same checks
as `check`, and on the first trouble it refuses without writing a single file.
Run against a deliberately broken copy of the example (`returns number` replaced
by `returns string`):

```bash
$ node flang/bin/flang.mjs emit broken.flang --target js --out ./out
{"error":"печать отменена: программа не проходит проверку (диагностик: 11, первая —
 FLANG_TYPE: функция «Product» объявлена как строка, а тело даёт число). Проверьте
 программу командой check; ключ --no-check печатает непроверенное для отладки самой
 печати", …}
$ echo $?
1
$ ls ./out
ls: cannot access './out': No such file or directory
```

### What emitted here, and what the installed `flang` emits

This page emits with the compiler from the repository — the one installed through
npm. The standalone `flang` binary — the one Homebrew installs and `bootstrap/`
builds — has **all {{цели.поАнглийски}}** as well, and says so itself. Run against
the binary built from `bootstrap/`:

```bash
$ ./flang emit --help
flang emit <файл.flang> --target c|go|rust|java|js|elixir|python|csharp
```

Each of its targets needs a directory with the runtime SOURCES — it looks for them
itself in `$FLANG_RUNTIME_DIR`, `../flang/src/emit/c` and `../share/flang/c`,
while here the binary was built in a directory of its own, so the path had to be
named by a flag. And it warns separately about the entry boundary:

```bash
$ ./flang emit factorial-english.flang --target c --runtime …/flang/src/emit/c --out ./out-c
напечатано файлов 6, байт 274673, в …/out-c
граница входа пуста: таблицу объявленных типов строит слой типов свидетеля
(«таблицаВхода»), которого в бинарнике нет, а впечатанная (параметров 8905) этой
программе не подходит. Напечатанное соберётся и заработает, но аргументы
прогонщика объявленным типам сверяться не будут.
```

Unlike the compiler from the repository, the binary does not create the `--out`
directory: if it is missing, the binary refuses and names the file.

## What arrives in the directory

One run per target, the same program every time —
`flang/examples/rosetta/factorial-english.flang`:

| target | files |
|---|---|
| `c` | `flang_runtime.h` `flang_runtime.c` `factorial.h` `factorial.c` `flang_cli.c` `Makefile` |
| `csharp` | `Value.cs` `Field.cs` `FlangError.cs` `Ctx.cs` `Flang.cs` `Factorial.cs` `FlangCli.cs` `flang.csproj` `Makefile` |
| `elixir` | `flang_runtime.ex` `factorial.ex` `flang_cli.ex` `Makefile` |
| `go` | `go.mod` `flangrt/flang_runtime.go` `flang/factorial.go` `cli/main.go` `Makefile` |
| `java` | `Value.java` `Field.java` `FlangError.java` `Ctx.java` `Flang.java` `Factorial.java` `FlangCli.java` `Makefile` |
| `js` | `factorial.js` `flang_cli.js` |
| `python` | `flang_runtime.py` `factorial.py` `flang_cli.py` `Makefile` |
| `rust` | `Cargo.toml` `src/runtime.rs` `src/factorial.rs` `src/lib.rs` `src/cli.rs` `src/main.rs` `Makefile` |

The layout is the same everywhere: a **runtime** (values, arithmetic,
diagnostics), the **program module** (one function per flang function), a
**runner**, and a build file. With `--no-cli` the runner is gone: `js` is left
with a single `factorial.js`, `c` with five files out of six.

One more thing arrives in the `emit` answer and is worth reading before you
choose a target — the `возможности` (capabilities) field. Concurrency is not
everywhere, and a target that did not get it refuses to emit a concurrent
program rather than quietly doing something else:

| target | concurrency | parallelism | delegated tasks | reason as given |
|---|---|---|---|---|
| `c` | yes | no | yes | cooperative scheduler in the runtime, one thread |
| `elixir` | yes | yes | no | one BEAM process per process, supervision by OTP trees |
| `js` | yes | no | no | one thread |
| `csharp`, `go`, `java`, `python`, `rust` | no | no | no | no scheduler: emitting a concurrent program refuses with `FLANG_CONC_UNSUPPORTED` |

## C: build it and link it into your program

```bash
$ node flang/bin/flang.mjs emit flang/examples/rosetta/factorial-english.flang --target c --out ./out-c
{"target":"c","module":"Factorial","возможности":{…},"out":"…/out-c","files":[
 {"path":"flang_runtime.h","bytes":…},{"path":"flang_runtime.c","bytes":…},
 {"path":"factorial.h","bytes":…},{"path":"factorial.c","bytes":…},
 {"path":"flang_cli.c","bytes":…},{"path":"Makefile","bytes":…}]}
```

The sizes are left out on purpose, and not out of laziness. The bytes of emitted
code are not promised (see "Boundaries" below), and the price of that promise was
measured while this very page was being written: between two runs on the same day
`factorial.h` grew from 4 324 bytes to 4 968, because the generator in the tree
was being edited. The list of files did not move at all — lean on that.

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
`faktorial_pripisat_v_nachalo`. Beside the functions the header also declares the
plumbing: `factorial_call`, which calls by the original flang name («Factorial»,
not the slug) for anyone binding dynamically, and `factorial_entry`, the table of
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

WebAssembly comes from the same place: the emitted C moves there without edits —
the [measurement](../wasm.html) was made over every program in the repository.

## The value at the boundary

Inside the evaluator a value has its own representation
(`flang/src/builtins.mjs`: a record is a plain JS object, a list is an array, a
variant is a class of its own, plus a hidden "list with spare room" that never
leaves at all). **Each emit target has its own representation**, and that is not
a detail: it is precisely the boundary across which you talk to the program.

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

**A string is not required to be NUL-terminated.** That is written in the field's
own header: a substring and a tail are slices of shared memory. Print it by
length, not with `%s`. And there are two lengths: `bytes` — UTF-8 octets,
`points` — code points; `длина` in the language counts the latter. Run over
«привет» through «Reverse string»:

```
вход: tag=3 bytes=12 points=6
выход: tag=3 bytes=12 points=6 текст=тевирп
```

Two constructors make a string in C: `fl_text_borrow(utf8, bytes, points)` — no
copy, the caller counts the code points; `fl_text(ctx, utf8, bytes, &out, &err)`
— copies into the arena, the runtime counts the points. The second is safer and
is the one used in the examples here.

**Field and variant names are not translated.** Only function and module names
are transliterated; a field declared as «адрес» is taken in C by exactly that
name — `fl_field_get(&ctx, v, "адрес", …)`. Run over
`flang/examples/web/shortener/store.flang`:

```
пустое: tag=5 полей=2
после «Положить»: ссылок = 1
поле «выдано» = 1
поле «записи»: tag=4 длина=1
первая запись, «адрес» = https://пример.рф
```

**A refusal declared as a value arrives as a value.** In
`flang/examples/errors/number-parsing.flang` the function «Разобрать число»
returns the sum type «Вышло» | «Не вышло» — and at the boundary that is a
variant, not `FL_ERROR`:

```
42 → Вышло, значение = 42
12.5 → Вышло, значение = 12.5
abc → Не вышло, сообщение = «к числу»: строка "abc" не является числом
1e999 → Не вышло, сообщение = «к числу»: строка "1e999" не является конечным числом
```

The difference matters: `FL_ERROR` is a refusal of the computation (wrong type,
out of steps, out of depth), whereas a variant is the function's ordinary answer,
which you take apart with `fl_variant_is`.

### JavaScript

Here the representation matches the interpreter word for word, and there is
nothing to translate: a number is a `number`, a string is a `string`, a flag is a
`boolean`, "nothing" is `null`, a list is an `Array` (an ordinary one —
`Array.isArray` answers `true`), a record is a plain object with the original
field names, a variant is an instance of an internal class with fields `variant`
and `fields`. A refusal **is thrown**: a `FlangError` with `code`, `message` and
`diagnostics`.

### Python, and the rest

The Python representation is **different**, and you need to know that before the
first call: values there are boxed (`Value` with fields `tag` and `data`),
functions take the context as their first argument, and a bare number is not
accepted by the runtime. Run:

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
mark on every function — emission carries them over from the source instead of
retelling them.

### What is not translated on any target

Refusal codes (`FLANG_TYPE`, `FLANG_RECURSION_LIMIT`, …) and the diagnostic
**texts** arrive the same on every target — and those texts are Russian, even
when the program is written on the English keyword surface. The run above shows
it: `«Factorial»` is an English name, while the message is «сравнения порядка
допустимы только для чисел». Depend on the code in your program, not on the text:
texts are [not promised](../what-blocks-1-0.md).

## JavaScript: embedding into your own project

This is the case the `js` target was kept in the language for. The module is
self-contained: not a single `import` and not a single `require` at the top level
(checked by searching the emitted file) — the one import it has sits inside
`$callDeep` and is taken dynamically.

```bash
$ node flang/bin/flang.mjs emit flang/examples/rosetta/factorial-english.flang --target js --no-cli --out ./out-js
{"target":"js","module":"Factorial", …,"files":[{"path":"factorial.js","bytes":…}]}
```

One file, no neighbours. With the runner the module is larger: alongside the
runner the link to it is emitted too — `$PROGRAM`, carrying the table of declared
types — and without a runner there is nobody to emit it for. Checked by search:
the module built with a runner has `$PROGRAM`, the one built with `--no-cli` does
not have it at all.

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

for (const текст of ["42", "abc", "1e999"]) {
  const итог = razobratChislo(текст)
  console.log(JSON.stringify(текст), "→", итог.variant, JSON.stringify(итог.fields))
}
console.log("built by the host:", JSON.stringify(Vyshlo({ значение: 7 })))
```

```
"42" → Вышло {"значение":42}
"abc" → Не вышло {"сообщение":"«к числу»: строка \"abc\" не является числом"}
"1e999" → Не вышло {"сообщение":"«к числу»: строка \"1e999\" не является конечным числом"}
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

Two cures were run and both work: rename the file to `.mjs`, or declare
`"type": "module"` in the directory it landed in.

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

The depth in that message is THIS machine's and this host's; yours will differ.
The lever is `await $callDeep(fn, [args], limits)`: the computation moves into a
thread with an explicitly sized stack, and the declared limit becomes reachable.
In a browser, and anywhere the thread did not start, the computation runs as
before and the guard tells the truth about it.

### A real host: an HTTP service in flang, called from Node

The tree holds a link shortener (`flang/examples/web/shortener/`) — an HTTP
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

Non-termination lives in the host's loop, while the handler always terminates —
that is not a hope but an output of `check`.

**A caveat about the file next door.** `serve.mjs` sits beside it running the
same scenario, and it goes NOT through the emitted module but through the
evaluator (`loadProgram` from `flang/bin/flang.mjs` and `evaluateFlang` from
`flang/src/compat.mjs`). The answers agree BYTE FOR BYTE: the scenario above was
run down both roads and the output matched to the character — `diff` says
nothing. But only the first road is fit for embedding: `flang/src/*.mjs` is not promised as a library,
`emit` is. Read `serve.mjs` as a model of the host's SHAPE (state by value, loop
on the outside), not as a model of binding.

## Any language: the runner over a pipe

If there is no target for your language, or you would rather not bind by source,
there is a third road — the very runner emitted next to the module: **JSON in,
JSON out, one process per stream of requests.** The protocol is the same on every
target.

```bash
$ printf '%s\n' '{"fn":"Factorial","args":[{"n":"10"}]}' \
                '{"fn":"Product","args":[{"l":[{"n":"1"},{"n":"2"},{"n":"3"},{"n":"4"}]}]}' \
                '{"fn":"Factorial","args":[{"s":"x"}]}' | node flang_cli.js ./factorial.js
{"ok":true,"value":{"n":"3628800"}}
{"ok":true,"value":{"n":"24"}}
{"ok":false,"code":"FLANG_TYPE","message":"вызов функции «Factorial»: аргумент «n» не соответствует типу нат"}
```

The same input fed to the `./flang_cli` binary built from the `c` target gives
the same lines — that was run. A function is called by its **original flang
name**, not by the slug. Values are tagged, because JSON is poorer than the
language: `{"n":"1.5"}` is a number as a string (otherwise `NaN`, `Infinity` and
−0 would be lost), `{"s":…}` a string, `{"l":[…]}` a list, `{"r":[["field",…]]}`
a record, `{"v":"Name","f":[…]}` a variant, `null` is "nothing", `true`/`false` a
flag.

This road has something the direct call does not: **the runner checks arguments
against the declared types before the call** — using the table emission placed
beside the module (`factorial_entry` in C, `$PROGRAM.entry` in JS). Hence the
difference in the messages above: the direct call `factorial("x")` gets as far as
the comparison and answers «сравнения порядка допустимы только для чисел», while
the runner answers earlier and more precisely — «аргумент «n» не соответствует
типу нат».

## Boundaries: what this page does not promise

Written not for completeness but because a promise read wider than it was made is
a future breakage in your code.

- **`flang/src/*.mjs` is not a library.** The compiler's internal modules can be
  imported, but at your own risk: they are
  [not promised](../what-blocks-1-0.md) and change without warning. There is one
  promised road for embedding, and it is `emit`.
- **The bytes of the emitted code are not promised.** The promise is behavioural:
  the same program yields the same values and the same refusal codes, not the
  same bytes. The generator is being optimised, and the files will differ.
- **Diagnostic texts are not promised — only codes.** And those texts are Russian
  on every target and on every keyword surface.
- **Emission produces no TypeScript declarations.** There is no `.d.ts` and no
  types file beside the module; types arrive as JSDoc comments inside the module
  itself, which is enough for editor hints but not for a strict build.
- **Concurrency exists on three targets out of {{цели.поАнглийски}}** (`c`,
  `elixir`, `js`), parallelism on one (`elixir`). The rest refuse to emit a
  concurrent program.
- **The installed `flang` binary emits into C only**, and leaves the entry
  boundary's type table empty. All {{цели.поАнглийски}} targets come from the
  compiler installed through npm.
- **About `--index-base`, `--max-steps` and `--max-depth` only one thing was
  checked** — that they reach the emitted code as the lines named above; their
  effect on a running program was not measured here.

## Next

- [First program](getting-started.html) — where to start if you have not installed flang yet
- [Packages](packages.html) — how to assemble a flang library before emitting it
- [WebAssembly through C](../wasm.html) — the measurement: emitted C moves to wasm without edits
- [Known limitations](limits.html) — what the language cannot do
