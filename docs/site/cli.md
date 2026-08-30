# Command reference

The `flang` binary has twelve commands. Here is each one: what it is for, how to
call it, what its keys are, what it prints and what code it exits with.

The source of this page is the program itself: `flang --help` and
`flang <command> --help`.

## Cheat sheet

| Command | What it does | Typical call |
| --- | --- | --- |
| `check` | Parsing, types, termination, the proof kernel | `flang check привет.flang` |
| `test` | Runs the examples declared inside functions | `flang test привет.flang` |
| `run` | Evaluates one function and prints the value | `flang run привет.flang --function «Удвоить» --args '{"н":21}'` |
| `emit` | Prints the program into one of eight target languages | `flang emit привет.flang --target js --file привет.js` |
| `ast` | The parsed and linked program as a JSON tree | `flang ast привет.flang --pretty` |
| `tokens` | The token stream: what each word became in the lexer | `flang tokens привет.flang` |
| `facts` | Checks claims against facts | `flang facts привет.flang --facts факты.json --claims '["…"]'` |
| `io` | Runs a plan: files, directories, processes, network | `flang io план.flang --pretty` |
| `lock` | Prints the lock: the dependencies themselves, not links to them | `flang lock привет.flang > flang.lock` |
| `package` | Prints the package: a lock with a name, a version and a list of what is proved | `flang package привет.flang > привет.flang-package` |
| `repl` | The interactive shell | `flang repl привет.flang` |
| `lsp` | The language server for your editor | `flang lsp --stdio` |

Common to all of them: `flang --help`, `flang --version`, `flang <command> --help`.

## The input file: four extensions

A program has four extensions, and all four are equal:

| Extension | Where the name comes from | Where it gets typed |
| --- | --- | --- |
| `.flang` | the name of the language | the main one: commands, docs, CI jobs |
| `.fp` | *functional program* | the short one, no keyboard switching |
| `.фп` | «функциональная программа» | so a Russian file name needs no transliteration |
| `.фланг` | the name of the language in Cyrillic | the same, spelled out |

A file is taken by its path, not by its extension: `flang check`, `run`, `emit`,
`ast`, `tokens`, `lock`, `package` and `facts` accept any of the four — and any
other path as well. The decisions are recorded in
`docs/adr/0016-three-file-extensions.md` and
`docs/adr/0018-file-extensions-are-one-list.md`.

One exception, and it is worth knowing: **`flang test`, given ONE file,
recognises it by `.flang`** — an argument with another extension is treated as a
directory, and the answer is "не нашлось ни одного .flang", exit code `2`. This
is the only place in the compiler that decides a file's fate by its extension,
and it waits for the bootstrap point to be reprinted; until then the examples in
a `.фп` file are run by `flang check`, which runs them too.

## Exit codes

The codes are the same across commands, and so is their meaning.

| Code | What it means |
| --- | --- |
| `0` | Done, nothing to report |
| `1` | The program did not pass — or, for `facts` and `io`, said "no" itself |
| `2` | Bad call: wrong key, wrong value, no such file |
| `3` | Done, but not everything was checked; what was not is named |

Code `3` happens with `emit` and with `io`. Tell `1` and `3` apart in build
scripts: `1` means the work was not done, `3` means it was done but cannot be
vouched for in full.

## check

Judges the program: parsing, linking, types, termination, the proof kernel. This
is the command you will call more often than all the rest together.

```bash
flang check <файл.flang> [--proof [--json] [--записать <файл>]]
                          [--предел-шагов N]
```

| Key | What it does |
| --- | --- |
| `--proof` | A report: what carries the promise "total" for each function, and what carries each claim |
| `--json` | Only together with `--proof`: the same report in machine form |
| `--записать <файл>` | Only together with `--proof`: write the proof itself into a file. The key is also spelled in Latin — `--record` |
| `--предел-шагов N` | Raise the checker's step limit for this one run. The default is compiled in at build time and catches non-termination; running out stays legible — `FLANG_RECURSION_LIMIT` with a number. Needed on the largest files: a `--proof --json` proof report for a module with a thousand claims does not fit the default. In Latin — `--step-limit` |

Codes: `0` — nothing to report; `1` — the program did not pass; `2` — the program
contains declarations that the `flang` binary does not judge at all (the category
surface, processes, supervision), and it names the gap instead of staying silent.

```bash
$ flang check привет.flang
модуль «Привет»: функций 1, из них с доказанным завершением 1; типов 0
привет.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
```

When it does not pass, the place and the code are named verbatim:

```bash
$ flang check плохо.flang
модуль «Плохо»: функций 1, из них с доказанным завершением 1; типов 0
FLANG_TYPE в файле плохо.flang, строка 6, столбец 5: функция «Удвоить» объявлена как строка, а тело даёт число
плохо.flang: не проверено — замечаний 1
$ echo $?
1
```

### The step budget of `check` cannot be raised

**A known limitation.** The step budget of `check` is one for the whole command,
not one per evaluation. Once it runs out, the command answers
`FLANG_RECURSION_LIMIT`. There is NO key that raises this limit: not
`--max-steps`, not anything else. A large file hits the limit, and no key gets
you past it.

What to do instead: run `flang test <file>` — examples have their own budget, and
it is set by `--max-steps`. Printing with `flang emit` also goes through: it
judges the program but does not evaluate the examples.

## test

Runs the examples declared inside functions. It first checks the program with the
same checks as `check`: "the example matched" means nothing on a program with a
type error.

```bash
flang test <файл.flang | каталог | маска> [--no-check] [--json] [--proof report]
                                          [--max-steps N] [--max-depth N]
```

| Key | What it does |
| --- | --- |
| `--no-check` | Do not check the program — look at how the examples behave while it is still being edited |
| `--json` | A machine-readable summary on one line |
| `--proof report` | One line per file, so results can be compared with a diff |
| `--max-steps N` | The evaluator step limit |
| `--max-depth N` | The depth limit |

An argument that does not end in `.flang`, and any argument with a star or a
question mark, is a set of files rather than a file:

```bash
flang test flang/stdlib/                the whole directory, recursively
flang test 'examples/**/*.flang'  by mask (quotes keep the shell out)
```

Codes: `0` — every file was taken and every example matched; `1` — something did
not match or a file was not taken; `2` — a bad call.

```bash
$ flang test привет.flang
привет.flang: примеров 1, прошло 1, не прошло 0
```

For an example that did not match, both sides are named: expected and received. A
long value is cut at 200 characters, and the full length is given as a number.

## run

Evaluates one function and prints the value. `flang` does the arithmetic itself —
neither Node nor a C compiler is needed.

```bash
flang run <файл.flang> --function «Имя» [--args '{"н":10}'] [--max-steps N]
                       [--max-depth N]
```

| Key | What it does |
| --- | --- |
| `--function «Имя»` | What to evaluate. Required |
| `--args '{…}'` | Arguments: a flat object of scalars. A list or a nested object is not accepted here |
| `--max-steps N` | The evaluator step limit |
| `--max-depth N` | The depth limit |

Arguments are checked against the declared types before evaluation: «Факториал»
of −3 is rejected with `FLANG_TYPE` rather than computed.

```bash
$ flang run привет.flang --function «Удвоить» --args '{"н":21}'
42
```

## emit

Prints the program into a target language — all eight targets, without Node. The
directory named by `--out` is created for you, together with intermediate ones
and with whatever subdirectories the target asks for.

```bash
flang emit <файл.flang> --target c|go|rust|java|js|elixir|python|csharp
                        [--out каталог | --file имя] [--cli|--no-cli] [--repl]
                        [--runtime каталог] [--index-base 0|1]
                        [--max-steps N] [--max-depth N]
```

| Key | What it does |
| --- | --- |
| `--target <target>` | `c`, `go`, `rust`, `java`, `js`, `elixir`, `python`, `csharp`. Required |
| `--out каталог` | Write all files into a directory |
| `--file имя` | One file on standard output |
| `--cli`, `--no-cli` | Whether to print the runner |
| `--repl` | Also print the human entry point. Target `c` only |
| `--runtime каталог` | Where the target runtime sources live |
| `--index-base 0\|1` | Declare the index base of the program |
| `--max-steps N` | The step limit baked into the printed code |
| `--max-depth N` | The depth limit |

### There is no "print without checking" key — on purpose

Only what was checked gets printed. Before printing, the program is judged the
same way as by `flang check`. On a diagnostic, printing is cancelled, the code is
`1`, and not a single file is written. There is no key that turns this check off,
and there will not be one: the only caller who would need it is the compiler
rebuilding itself, and that rebuild must go through the check.

The codes of `emit` and what each one means:

| Code | What it means |
| --- | --- |
| `0` | Printed, no gaps in the checking |
| `1` | Did not pass the check — nothing was written |
| `2` | Bad call: no such target, no such file, wrong value for a key |
| `3` | Printed, but not everything was checked: this build does not judge the category surface or processes. What was not checked is named |

`emit` does not run the examples, and it says so. Run them separately with
`flang test <file>`.

```bash
$ flang emit привет.flang --target c --out вывод
напечатано файлов 6, байт 296845, в вывод
аргументы напечатанной программы по типам не проверяются: это ограничение двоичного flang, полная проверка есть в версии для Node
проверено перед печатью — разбор, типы, завершаемость и ядро доказательств.
ПРИМЕРЫ НЕ ПРОГНАНЫ: их считает вычислитель на самом языке, и на самых больших
программах он в предел шагов этого бинарника не укладывается — свяжи с ними
печать, и компилятор перестал бы печатать сам себя. Прогоните их отдельно:
flang test <файл>

$ ls вывод
Makefile  flang_cli.c  flang_runtime.c  flang_runtime.h  привет.c  привет.h
```

Name the target wrongly and the code is `2`, with all eight listed:

```bash
$ flang emit привет.flang --target нету
flang emit: цели «нету» у этой сборки flang нет — целей здесь ВОСЕМЬ — «c», «go», «rust», «java», «js», «elixir», «python», «csharp».
$ echo $?
2
```

## ast

Prints the parsed and linked program as a JSON tree — exactly what the target
printer sees.

```bash
flang ast <файл.flang> [--pretty]
```

| Key | What it does |
| --- | --- |
| `--pretty` | Indented by two spaces |

There are no type or termination checks here, on purpose: the tree is what was
read, not what was found fit. The command only refuses on what yields no tree at
all — parsing and linking.

```bash
$ flang ast привет.flang --pretty | head -8
{
  "flang": 1,
  "module": "Привет",
  "types": [],
  "functions": [
    {
      "name": "Удвоить",
      "total": true,
```

## tokens

Prints the token stream — what the lexer read, before parsing and before linking.
There is one question this command exists for: what will this word become if you
write it. Grep does not answer it: a word in a comment, a word inside a string
literal and a name in guillemets never become keywords.

```bash
flang tokens <файл.flang> [--json] [--pretty]
flang tokens --keyword «фраза»
```

| Key | What it does |
| --- | --- |
| `--json` | Machine form: the same keys as `flang ast` — `kind`, `value`, `text`, `quoted` and `span` with line and column |
| `--pretty` | Indented by two spaces; turns machine form on by itself |
| `--keyword «фраза»` | Whether this is a keyword. A multi-word phrase is checked as a phrase. No file is named with this key |

It refuses where the lexer itself refuses — an unclosed literal, a torn indent;
the code is then `1`, and machine form is still printed, with an empty `tokens`
and a filled `diagnostics`.

```bash
$ flang tokens привет.flang | head -4
1:1	слово module
1:8	ёлочка Привет
1:16	/
3:1	слово total

$ flang tokens --keyword 'элемент или беда'
«элемент или беда» — не ключевое слово языка: одним ключевым токеном лексер это не отдаёт
```

## facts

Checks claims against facts. A claim has the shape "something operator
something"; on the left there can be a fact, a field of a fact or a call of a
function on facts, on the right the same or a literal.

```bash
flang facts <файл.flang> --claims '["…"]' [--facts факты.json] [--steps N] [--pretty]
```

| Key | What it does |
| --- | --- |
| `--claims '[…]'` | What to check, as a JSON array of strings. Required |
| `--facts файл` | Facts as a JSON object. Without the key there are no facts |
| `--steps N` | The evaluation step limit. 10000 by default |
| `--pretty` | JSON with indentation |

Codes: `0` — confirmed; `1` — **refuted**, not "broke": the verdict still goes to
standard output, and the code is there so a build fails on it; `2` — the call was
refused: no file named, JSON not parsed, program not linked.

A call is made only for a function whose termination is proved: a non-total one
is refused before any evaluation.

```bash
$ cat факты.json
{"н": 21}

$ flang facts привет.flang --facts факты.json --claims '["«Удвоить» от н равно 42"]' --pretty | head -7
{
  "ok": true,
  "results": [
    {
      "claim": "«Удвоить» от н равно 42",
      "holds": true,
      "why": "«Удвоить» от факта «н» = 42; требование «равно 42» выполнено",
```

## io

Runs a plan of orders — the one place in the language where a program meets the
world. It does not meet it itself: every step returns a description of an action,
and the host performs it. That is why all the functions of a plan stay total and
are checked with ordinary examples — no files, no network.

```bash
flang io <файл.flang> [--plan 'Имя'] [--max-orders N] [--seed N] [--in-dir]
                      [--max-steps N] [--pretty]
```

| Key | What it does |
| --- | --- |
| `--plan 'Имя'` | Which plan to run, when there is more than one |
| `--max-orders N` | The limit of orders per run. 10000 by default |
| `--max-steps N` | The evaluation step limit for one turn |
| `--timeout N` | The wait time for one order, in milliseconds. 30000 by default |
| `--seed N` | The randomness seed: the run becomes repeatable |
| `--in-dir` | Forbid paths outside the directory of the input file |
| `--pretty` | JSON with indentation |

**A plan name is written WITHOUT guillemets, and a space inside it is closed by
shell quotes.** Guillemets are how the language writes names in source, but the
`--plan` key takes the name exactly as given, guillemets included:

```bash
$ flang io ярлыки.flang --plan «Целость»
{"error":"не найден план ««Целость»»", … "code":"FLANG_UNKNOWN_PLAN" …}
$ flang io ярлыки.flang --plan Целость
{"plan":"Целость","result":"ярлыков 101; …
$ echo $?
0
```

A two-word name without shell quotes is split by the shell into two arguments,
and only the first reaches the key:

```bash
$ flang io flang/scripts/kernel-forgeries.flang --plan «Аксиом ноль»
flang io: непонятный ключ «ноль»»
$ echo $?
2
$ flang io flang/scripts/kernel-forgeries.flang --plan 'Аксиом ноль'
{"plan":"Аксиом ноль","result":"… аксиом ноль, нарушений 0", …
$ echo $?
0
```

The binary's own help (`flang io --help`) prints `--plan «Имя»` and is misleading
about this: there the guillemets mark the slot where a name goes, not part of the
name. That help lives in `flang/self/cli.flang`, so it changes only with a
reprint of the bootstrap seed; until then the working form is recorded here.

Permissions are narrowed one at a time: `--no-read`, `--no-write`, `--no-net`,
`--no-clock`, `--no-random`, `--no-spawn`. The default is "everything is
allowed": running a program with this command is your consent to what it does.

`io` has no `--args` key. Arguments are not passed to a plan: a plan starts from
its own "начинает с" function, not from call arguments.

```bash
$ flang io examples/crypto/revocation.flang --args '{}'
flang io: непонятный ключ «--args»
$ echo $?
2
```

There **is** a wait time, and it is `--timeout N`, in milliseconds, 30000 by
default. This page said the opposite until 29 August 2026 and showed a refusal
that the binary does not print; the key is accepted, checks its value
(`--timeout 0` and `--timeout abc` are refused with exit 2), and sixteen of this
tree's own shortcuts pass it (`ярлыки.flang`). Beyond it the run is bounded by
the number of orders and the number of steps.

The exit codes are a contract: `0` — the plan ran to the end; `1` — the program
gave up itself, that is, it found trouble and named it; `2` — a bad call; `3` —
the tool broke. What tells the first two apart is not the error code but who made
the decision.

```bash
$ flang io план.flang --pretty
{
  "plan": "Записать привет",
  "result": 6,
  "orders": 1,
  "log": [
    {
      "поручение": {
        "variant": "Записать файл",
        "fields": {
          "путь": "привет.txt",
          "содержимое": "привет"
        }
      },
      "отклик": {
        "variant": "Записано",
        "fields": {
          "сколько": 6
        }
      }
    }
  ]
}
```

Take a permission away and the plan sees a refusal and gives up itself, with code
`1`:

```bash
$ flang io план.flang --no-write
{"error":"ждали подтверждение записи","diagnostics":[{"code":"FLANG_IO_ORDER","message":"ждали подтверждение записи","severity":"error","span":{"line":38,"column":1}}]}
$ echo $?
1
```

What the binary host does not have: a screen («Показать», «Ждать событие» answer
`FLANG_IO_NO_SCREEN`) and encryption of its own. The `https` scheme of the
«Запросить» order works, but an external `curl` performs it: without it the
refusal is `FLANG_IO_NO_TLS`; `--no-spawn` forbids `https` too, with
`FLANG_IO_DENIED`. Certificate revocation is not checked, neither by OCSP nor by
CRL.

## lock

Prints the lock of a program — JSON that holds the dependencies themselves rather
than links to them: for every imported module its whole source is written down,
and its address is the `sha256` of that source. There is no registry — there is
nowhere to download from, because everything is already in the lock.

```bash
flang lock <файл.flang> [--pretty]
```

| Key | What it does |
| --- | --- |
| `--pretty` | Indented by two spaces |

If a `flang.lock` lies next to the input file, every command takes imports from
it and does not read dependency sources at all. A damaged lock is refused with
`FLANG_LOCK` rather than quietly built from whatever is around.

```bash
$ flang lock привет.flang
{"схема":2,"вход":"./привет.flang","модули":[],"печать":"dcf9b0c54a6a814573047949d66a78d7e4706c67ae8873e637823fa799609779"}
```

## package

Prints a package — the same payload as in a lock, plus a name, a version, an
origin and a list of what is proved.

```bash
flang package <файл.flang> [--pretty]
```

| Key | What it does |
| --- | --- |
| `--pretty` | Indented by two spaces |

The name and the version are taken from the `flang.package` declaration next to
the input file, not from call keys. No declaration means a refusal with code `1`:

```bash
$ flang package привет.flang
FLANG_PACKAGE: рядом с привет.flang нет объявления flang.package: пакету нужны имя и версия, и берутся они оттуда, а не из вызова
$ echo $?
1
```

Put a `flang.package` next to it and the package builds:

```bash
$ cat flang.package
{"имя": "Привет", "версия": "1.0.0"}

$ flang package привет.flang | cut -c1-96
{"схема":2,"имя":"Привет","версия":"1.0.0","вход":"./привет.flang","модули":[{"имя":"Привет",
```

A package is built only from what was checked. How to use one is on the
[How to write packages](packages.html) page.

## repl

The interactive shell — the same thing as a bare `flang` on a terminal.
Declarations accumulate in the session, expressions are evaluated at once,
`.помощь` lists the commands. A file given as an argument is loaded into the
session at startup.

```bash
flang repl [<файл.flang>] [--max-steps N] [--max-depth N]
```

| Key | What it does |
| --- | --- |
| `--max-steps N` | The evaluator step limit |
| `--max-depth N` | The depth limit |

An expression is computed like this: the session is printed to C the same way
`flang emit` does it, built with the system `cc` and run. Without `cc` the shell
does not switch off — it checks parsing, types and termination, and says so at
startup:

```bash
$ flang repl привет.flang
вычислять нечем: не найден libcompiler_flang.a ($FLANG_LIB_DIR, ../lib или каталог самого бинарника).
Разбор, типы и завершаемость проверяются по-прежнему; выражение отвечает «проверено».
объявлено: тотальная функция «Удвоить» — завершение доказано
загружено из привет.flang
```

Where the C compiler and its environment are looked for: `FLANG_CC`,
`FLANG_INCLUDE_DIR`, `FLANG_LIB_DIR`.

## lsp

The flang language server over standard input and output: `Content-Length`
frames, JSON bodies, as the LSP specification requires. It is started by an
editor, not by a human: run by hand it will silently wait for messages.

```bash
flang lsp [--stdio]
```

| Key | What it does |
| --- | --- |
| `--stdio` | Speak over standard input and output |

It can do: diagnostics along the same road as `flang check` — parsing, linking,
types, termination — completion, hover with a signature, and go to definition.

Nothing but protocol messages may be printed to standard output: the editor reads
frames from there. Everything meant for humans goes to the error stream.

To see that the server is alive, send it one message and read the answer:

```bash
$ printf 'Content-Length: 104\r\n\r\n{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"processId":null,"rootUri":null,"capabilities":{}}}' | flang lsp --stdio
Content-Length: 311

{"jsonrpc":"2.0","id":1,"result":{"capabilities":{"positionEncoding":"utf-16","textDocumentSync":{"openClose":true,"change":1,"save":{"includeText":false}},"completionProvider":{"triggerCharacters":["«","."]},"hoverProvider":true,"definitionProvider":true},"serverInfo":{"name":"flang-lsp","version":"0.1.0"}}}
```

There is one divergence, and it is named: for a program with `использует`,
trouble in an imported module goes into the editor log instead of being
underlined in its buffer.

## Environment variables

| Variable | What it sets |
| --- | --- |
| `FLANG_RUNTIME_DIR` | Where `emit` looks for target runtime sources when `--runtime` is not given |
| `FLANG_CC` | Which C compiler `repl` calls |
| `FLANG_INCLUDE_DIR`, `FLANG_LIB_DIR` | Where `repl` looks for headers and the library |

`FLANG_RECURSION_LIMIT` is not a variable but an error code: that is the name of
running out of the step budget.

## Next

- [Language reference](language.html) — what to write in the file itself.
- [How to write packages](packages.html) — what to do with what `lock` and `package` printed.
