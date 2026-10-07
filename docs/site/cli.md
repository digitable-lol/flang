# Command reference

The `flang` binary has fourteen commands. For each one this page says when to
run it, how to call it, which flags it takes, what it prints and which exit code
it returns. Everything here can be checked against `flang --help` and
`flang <command> --help`; every output below was produced by the current binary.

The compiler prints its messages in Russian. Where the output matters, the page
says what it means.

## Cheat sheet

| Command | When to run it | Typical call |
| --- | --- | --- |
| `check` | after every change: parsing, types, termination, the prover, unit tests | `flang check привет.flang` |
| `test` | to run only the unit tests (`пример`) | `flang test привет.flang` |
| `run` | to compute one function and print the value | `flang run привет.flang --function «Удвоить» --args '{"н":21}'` |
| `emit` | to generate code in one of the {{цели.поАнглийски}} target languages | `flang emit привет.flang --target js --file привет.js` |
| `ast` | to see the parsed program as a JSON tree | `flang ast привет.flang --pretty` |
| `tokens` | to see what the lexer made of each word | `flang tokens привет.flang` |
| `lint` | to keep lines short and conditionals shallow, against the limits in `.flangrc` | `flang lint scripts/` |
| `facts` | to check claims against data in a JSON file | `flang facts привет.flang --facts факты.json --claims '["…"]'` |
| `io` | to run a program that reads files, starts processes or uses the network | `flang io план.flang --pretty` |
| `lock` | to write a lock file that contains the dependencies themselves | `flang lock привет.flang > flang.lock` |
| `package` | to build a package: a lock plus a name, a version and the list of what is proved | `flang package привет.flang > привет.flang-package` |
| `new` | to start a new package | `flang new проба` |
| `run-script` | to run a short project command from `.flangrc` | `flang run-script site:build` |
| `repl` | to try expressions interactively | `flang repl привет.flang` |
| `lsp` | started by your editor: the language server | `flang lsp --stdio` |

Also: `flang --help`, `flang --version`, `flang <command> --help`;
`flang --machine [<file>]` prints how fast this machine is (evaluation steps per
second); `flang --mcp-mode` is the server for an AI assistant over standard
input and output (`flang --mcp-mode --help` shows how to register it).

Three flags work with every command and limit the binary itself for this one
run:

| Flag | What it sets |
| --- | --- |
| `--depth-limit N` (`--предел-глубины`) | the call-depth limit |
| `--step-limit N` (`--предел-шагов`) | the step limit; running out gives `FLANG_RECURSION_LIMIT` with the number |
| `--memory-limit N` (`--предел-памяти`) | the memory limit, in bytes or with K, M, G, T; `0` means none. `check`, `test` and `run` default to three quarters of the machine's memory. At the limit the run stops with exit code `5` and names the function and the step count |

Long runs print a progress line `шагов N из M …` (steps done out of the limit)
to the error stream.

The examples below use this file, `привет.flang`:

```flang
module «Привет»

total function «Удвоить»
  accepts н: number
  returns number
  example «Двадцать один»
    given н equals 21
    expected 42
  н plus н
```

## Exit codes

The codes mean the same thing in every command.

| Code | Meaning |
| --- | --- |
| `0` | done, nothing to report |
| `1` | the program did not pass the check; for `facts` and `io`, the program itself answered "no" |
| `2` | bad call: unknown flag, wrong value, no such file |
| `3` | done, but not everything is checked, and the output names what is not. Also: `run` and `io` refuse a program whose guarantees are not proved |
| `4` | part of the checks did not run at all (`check --fast`) |
| `5` | the run stopped at the memory limit |

In a build script, treat `1` and `3` differently: `1` means the work was not
done, `3` means it was done but cannot be vouched for in full.

## The input file: four extensions

A program file can end in `.flang`, `.fp`, `.фп` or `.фланг`; all four are
equal. `.flang` is the main one; `.fp` saves a keyboard switch; `.фп` and
`.фланг` let a Russian file name stay in one alphabet. The commands take a file
by its path, so any other name works too.

`flang test` decides between a file and a set of files by the argument, see
[test](#test). A file with any of the four extensions is taken as one file:

```bash
$ flang test привет.фп
привет.фп: примеров 1, прошло 1, не прошло 0
```

## check

Checks the program: parsing, name resolution, types, termination, the prover
and the unit tests. Run it after every change.

```bash
flang check <файл.flang> [--proof [--json] [--strict] [--record <файл>]]
                          [--fast] [--step-limit N] [--depth-limit N]
```

Every flag also has a Cyrillic spelling, given in brackets.

| Flag | What it does |
| --- | --- |
| `--proof` | prints the proof report: for each function, what proves its termination; for each postcondition, whether it is proved, checked only on examples, or not proved. A postcondition with neither a proof nor examples gives exit code `3` |
| `--json` | with `--proof`: the same report as JSON |
| `--strict` (`--строго`) | with `--proof`: exit code `0` only when every guarantee is proved. For CI. See below |
| `--record <file>` (`--записать`) | with `--proof`: write the proof itself to a file, so that the independent checker `flang/proof/checker/checker.c` can re-check it |
| `--fast` (`--быстро`) | only names, types, exhaustiveness of pattern matching and termination. The prover and the unit tests do not run, the output says so, and the exit code is `4`. Not allowed together with `--proof` |
| `--step-limit N` (`--предел-шагов`) | raise the step limit for this run. Needed for `--proof --json` on very large files. `check` has no `--max-steps`: that is a bad call, exit `2` |
| `--depth-limit N` (`--предел-глубины`) | raise the call-depth limit for this run. Not the same as `--max-depth` of `emit`, which is written into the generated program |
| `--memory-limit N` (`--предел-памяти`) | memory limit, see above; exit `5` at the limit |

Exit codes: `0` — no remarks; `1` — the program did not pass; `2` — the program
contains declarations the binary does not check at all (category declarations,
processes, supervision), and it names them; `3` — with `--proof`, a guarantee
is not proved (with `--strict`, anything short of "all proved"); `4` — with
`--fast`.

```bash
$ flang check привет.flang
модуль «Привет»: функций 1, из них с доказанным завершением 1; типов 0
привет.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
```

The first line counts functions and how many of them have proved termination.
The second says all checks passed: parsing, types, termination, the prover
(«ядро») and the unit tests.

When a check fails, the output gives the error code, the line and the column.
Here `плохо.flang` declares `returns string` but the body gives a number:

```bash
$ flang check плохо.flang
модуль «Плохо»: функций 1, из них с доказанным завершением 1; типов 0
FLANG_TYPE в файле плохо.flang, строка 6, столбец 5: функция «Удвоить» объявлена как строка, а тело даёт число
плохо.flang: не проверено — замечаний 1
$ echo $?
1
```

Every `FLANG_…` code and how to fix it: [Diagnostics reference](diagnostics.html).

```bash
$ flang check привет.flang --fast
модуль «Привет»: функций 1, из них с доказанным завершением 1; типов 0
ПРОВЕРЕНО: связывание имён и повторы объявлений, типы, исчерпываемость разбора,
           завершаемость (в том числе взаимная рекурсия по компонентам), процессы.
НЕ СМОТРЕЛИ НА ЭТОМ ПРОГОНЕ: ядро доказательств — обязательств 0, теорем 0;
           законы категории на сетке; прогон примеров — примеров 1.
           И это не «нарушений нет»: про них не сказано ничего — ни хорошего, ни плохого.
           «Не смотрели» — не то же, что «объявлено, доказательства нет»: второе
           значит «смотрели и не смогли», а здесь вопроса не задавали вовсе.
           Спросить всё — та же команда без «--быстро».
привет.flang: часть проверок НЕ ЗАПУСКАЛАСЬ — код возврата 4, а не 0
```

### `--strict`: one exit code per result

Without `--strict`, `check --proof` exits `0` both when everything is proved and
when some guarantees are checked only on your examples. The words in the
output differ, but a build script reads the exit code. With `--strict` each
result has its own code:

| Result | Code | When |
| --- | --- | --- |
| `ДОКАЗАНО` (proved) | `0` | there is at least one guarantee, and every guarantee is proved |
| `ОПРОВЕРГНУТО` (disproved) | `1` | a counterexample was found |
| `НЕ УДАЛОСЬ ДОКАЗАТЬ` (could not prove) | `3` | no counterexample, but not everything is proved; the output names what |
| `НЕ ПОДДЕРЖИВАЕТСЯ` (not supported) | `2` | the program declares something the binary does not check, and the output names it |

Code `3` has three reasons, told apart by the words after it:
`ОПОРА НЕ СУДИЛАСЬ` — a guarantee is checked only on examples;
`ОБЪЯВЛЕНО, НЕ ДОКАЗАНО` — a guarantee has neither a proof nor examples;
`ПРОВЕРЕНО ВПУСТУЮ` — there are no guarantees at all. When several apply, the
most serious one is named: a counterexample beats a missing proof, and a
missing proof beats "only examples".

A file with no guarantees passes by default and fails under `--strict`,
because "nothing to prove" is not a proof:

```bash
$ flang check привет.flang --proof --strict | tail -2
привет.flang: НЕ УДАЛОСЬ ДОКАЗАТЬ — ПРОВЕРЕНО ВПУСТУЮ, ОБЯЗАТЕЛЬСТВ НЕТ ВОВСЕ — утверждений 0: доказано 0, условно 0, сетка 0, объявлено, не доказано 0, отвергнуто 0, нарушено 0; законов на сетке 0, на веру 0 — код возврата 3
  ничего: ни одно утверждение не назвало ни правила, ни шага
```

**Passing examples are not a proof.** Here a postcondition is false, and two
examples happen to pass:

```flang
модуль «Сетка»

тотальная функция «Удвоить»
  принимает н: неотрицательное
  возвращает число
  обеспечивает «не больше ста» результат не больше 100
  пример «один»
    дано н равно 1
    ожидается 2
  пример «десять»
    дано н равно 10
    ожидается 20
  н плюс н
```

`flang check сетка.flang` and `flang check сетка.flang --proof` both exit `0`;
the report says `сетка 1` — one guarantee checked only on examples — and
`ПРОВЕРЕНО С ОПОРОЙ, И ОПОРА НЕ СУДИЛАСЬ`. With `--strict` the exit code is `3`.
`flang run` refuses to compute it (see [run](#run)), and with `--trust` at
`н = 100` it fails the postcondition:

```bash
$ flang run сетка.flang --function «Удвоить» --args '{"н":100}' --trust
на веру: доказанность не считалась — запуск по ключу --trust
FLANG_PROPERTY: нарушено свойство «не больше ста» функции «Удвоить»
$ echo $?
1
```

`--strict` makes only the compiler strict. The independent checker
`flang/proof/checker/checker.c` answers `НЕ ПРОВЕРЕНО — ВПУСТУЮ` with exit code `3`
on a proof record with nothing proved, without any flag.

`--strict` without `--proof` is a bad call, exit `2`. Test programs for all
results are in `flang/proof/probes/strict/`; run them with
`bootstrap/flang io flang/proof/probes/strict/run.fscript --plan Binary`.

## test

Runs the unit tests (`пример`) declared inside functions. It first runs the
same checks as `check`, because a passing test means nothing in a program with
a type error.

```bash
flang test <файл.flang | каталог | маска> [--no-check] [--json] [--ledger]
                                          [--max-steps N] [--max-depth N]
```

| Flag | What it does |
| --- | --- |
| `--no-check` | skip the checks and just run the examples, while the program is still being edited |
| `--json` | a one-line JSON summary |
| `--ledger` | one tab-separated line per file, for comparing runs with `diff` |
| `--max-steps N` | the step limit of the evaluator |
| `--max-depth N` | the depth limit |
| `--memory-limit N` | memory limit; exit `5` at the limit |

An argument that does not end in one of the four extensions, or that contains
`*` or `?`, is a set of files:

```bash
flang test flang/stdlib/                the whole directory, recursively
flang test 'docs/examples/**/*.flang'  by mask (the quotes keep the shell out)
```

Exit codes: `0` — every file was taken and every example passed; `1` — an
example failed or a file was not taken; `2` — bad call; `3` — the examples
passed and the file declares `прогон` blocks that nothing ran.

A `прогон` block states a scenario over processes, and the binary does not run
one: the scheduler is declared in `flang/self/conc.flang`, and that layer is not
inside the binary. Such a file is named by number and exits `3`, so a program
whose scenario expectations are all false never exits `0`:

```bash
$ flang test flang/concurrency/examples/counter.flang
flang/concurrency/examples/counter.flang: примеров 2, прошло 2, не прошло 0
flang/concurrency/examples/counter.flang: блоков «прогон» 2, исполнено 0 — исполнить их нечем: планировщика в этом двоичном нет
```

```bash
$ flang test привет.flang
привет.flang: примеров 1, прошло 1, не прошло 0
```

The output reads "examples 1, passed 1, failed 0". For a failed example both
sides are printed: expected and received. A long value is cut at 200
characters, and its full length is given.

## run

Computes one function and prints the value. The binary evaluates it itself; no
C compiler or Node is needed.

```bash
flang run <файл.flang> --function «Имя» [--args '{"н":10}'] [--max-steps N]
                       [--max-depth N] [--trust] [--unproven refuse|warn|allow]
```

| Flag | What it does |
| --- | --- |
| `--function «Имя»` | the function to compute. Required |
| `--args '{…}'` | arguments as a flat JSON object of scalars. Lists and nested objects are not accepted |
| `--max-steps N` | the step limit of the evaluator |
| `--max-depth N` | the depth limit of the program being evaluated (the binary's own limit is `--depth-limit`) |
| `--memory-limit N` | memory limit; exit `5` at the limit |
| `--trust` (`--на-веру`) | run even if guarantees are not proved; the proofs are not checked at all, and a line says so |
| `--unproven WORD` (`--недоказанное`) | what to do when guarantees are not proved: `refuse` — do not run (the default), `warn` — say so and run, `allow` — the same as `--trust`. Cyrillic values: `отказ`, `предупреждение`, `разрешение` |

Arguments are checked against the declared types first: «Факториал» of −3 is
rejected with `FLANG_TYPE` instead of being computed.

**`run` refuses an unproved program.** Before computing, it checks the proofs
of everything the program uses (not just this file) and prints one line to the
error stream: `доказано: утверждений N` (N guarantees, all proved), or
`не доказано: …` and then nothing is computed, exit code `3`.

```bash
$ flang run привет.flang --function «Удвоить» --args '{"н":21}'
доказано: утверждений 0
42
```

To allow unproved programs for good, set the `unproven` key in `.flangrc`
([settings guide, Russian](https://github.com/digitable-lol/flang/blob/main/docs/guide/settings.ru.md#что-делать-с-недоказанным)):
`unproven = warn`. A command-line flag beats the `FLANG_UNPROVEN` environment
variable, which beats `.flangrc`, which beats the default `refuse`. The line
printed before the value names what allowed the run: the flag, or the setting
and the path of its file. An unknown value is exit code `2` with an
explanation.

## emit

Generates code in a target language. All {{цели.поАнглийски}} targets are built into the
binary. The directory given to `--out` is created if needed, with any
subdirectories the target requires.

```bash
flang emit <файл.flang> --target c|cpp|go|rust|java|js|ts|elixir|python|csharp
                        [--out каталог | --file имя] [--cli|--no-cli] [--repl]
                        [--runtime каталог] [--index-base 0|1]
                        [--max-steps N] [--max-depth N] [--no-check]
                        [--no-postconditions]
```

| Flag | What it does |
| --- | --- |
| `--target <target>` | `c`, `cpp`, `go`, `rust`, `java`, `js`, `ts`, `elixir`, `python`, `csharp`. Required |
| `--out dir` | write all files into a directory |
| `--file name` | one file to standard output |
| `--cli`, `--no-cli` | whether to generate the command-line runner |
| `--repl` | also generate an interactive entry point. Target `c` only |
| `--protocol file` (`--протокол`) | target `c` only: also write a translation log — what each construct became and by which rule — which `flang/translation/matcher.c` re-checks |
| `--runtime dir` | where the target's runtime sources are |
| `--index-base 0\|1` | declare the index base of the program |
| `--max-steps N` | the step limit written into the generated code |
| `--max-depth N` | the depth limit written into the generated code |
| `--no-check` | do not run the prover. Parsing, types and termination are still checked |
| `--no-postconditions` | do not generate runtime checks of postconditions. They are still proved; this flag changes only the generated code, and its header says so. Preconditions, termination checks and step and depth limits stay. Measurements: `flang emit --help` |

Only a checked program is generated. Before generating, `emit` runs the same
checks as `flang check`; on an error nothing is written and the exit code is
`1`.

### `--no-check` removes the prover and nothing else

With `--no-check`, parsing, names, types and termination are still checked, and
a program that fails them is still not generated. What changes:

- Postconditions are not proved, so none of them can be dropped from the
  generated code: every postcondition becomes a runtime check. The output is
  larger and slower, but not less safe.
- Wrong proofs are not caught. Run `flang check` before trusting the result.
- Code generated this way must not go into the repository's own compiler
  build: the build's fingerprint will not match. The binary prints this
  warning after every run with the flag.

How much time it saves depends on the file: on some files many times, on
others the flag makes the whole cycle slower, because the extra runtime checks
cost the C build more than the prover costs `emit`. `flang emit --help` gives
the numbers. On the two largest compiler modules, `flang/self/distributed.flang`
and `flang/self/bounded.flang`, the prover runs out of steps, and they can only
be generated with this flag.

Exit codes of `emit`:

| Code | Meaning |
| --- | --- |
| `0` | generated, everything checked |
| `1` | did not pass the check; nothing was written |
| `2` | bad call: unknown target, no such file, wrong flag value |
| `3` | generated, but not everything was checked: the binary does not check category declarations or processes, and the output names what it skipped |

`emit` does not run the unit tests, and says so; run them with `flang test`.

```bash
$ flang emit привет.flang --target c --out вывод
напечатано файлов 6, байт 435936, в вывод
аргументы напечатанной программы по типам не проверяются: это ограничение двоичного flang, полная проверка есть в версии для Node
проверено перед печатью — разбор, типы, завершаемость и ядро доказательств.
ПРИМЕРЫ НЕ ПРОГНАНЫ: их считает вычислитель на самом языке, и на самых больших
программах он в предел шагов этого бинарника не укладывается — свяжи с ними
печать, и компилятор перестал бы печатать сам себя. Прогоните их отдельно:
flang test <файл>

$ ls вывод
Makefile  flang_cli.c  flang_runtime.c  flang_runtime.h  privet.c  privet.h
```

The output says: 6 files written; the generated runner does not check argument
types; the program was checked before generation; the unit tests were not run.
The mention of a "version for Node" is outdated — there is no such version, and
nothing checks the argument types of generated code. File names are the
module name in Latin letters («Привет» → `privet.c`).

An unknown target is exit code `2`, with the list of targets:

```bash
$ flang emit привет.flang --target нету
flang emit: цели «нету» у этой сборки flang нет — целей здесь ДЕСЯТЬ — «c», «cpp», «go», «rust», «java», «js», «ts», «elixir», «python», «csharp».
Невтащенных целей больше нет: все десять живут в замыкании этой сборки, и
печатает их она сама, без Node.
$ echo $?
2
```

## ast

Prints the parsed program, with imports resolved, as a JSON tree: exactly what
the code generator receives.

```bash
flang ast <файл.flang> [--pretty]
```

| Flag | What it does |
| --- | --- |
| `--pretty` | indent by two spaces |

Types and termination are not checked here: the tree shows what was read, not
what is correct. The command fails only on parse errors and unresolved imports.

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

Prints the token stream: what the lexer read, before parsing. Use it to find out
what a word will become if you write it. `grep` cannot tell you this: a word in
a comment, inside a string literal or inside a name in guillemets never becomes
a keyword.

```bash
flang tokens <файл.flang> [--json] [--pretty]
flang tokens --keyword «фраза»
```

| Flag | What it does |
| --- | --- |
| `--json` | JSON with the same keys as `flang ast`: `kind`, `value`, `text`, `quoted` and `span` with line and column |
| `--pretty` | indented JSON; implies `--json` |
| `--keyword «phrase»` | is this a keyword? A phrase of several words is checked as one phrase. No file is given with this flag |

It fails where the lexer fails — an unclosed literal, broken indentation — with
exit code `1`; the JSON is still printed, with empty `tokens` and filled
`diagnostics`.

```bash
$ flang tokens привет.flang | head -4
1:1	слово module
1:8	ёлочка Привет
1:16	/
3:1	слово total

$ flang tokens --keyword 'элемент или беда'
«элемент или беда» — не ключевое слово языка: одним ключевым токеном лексер это не отдаёт

$ flang tokens --keyword 'код символа'
«код символа» — ключевое слово, конструкция «charCode»
```

Each line is `line:column`, the token kind (`слово` — word, `ёлочка` — a name
in guillemets) and its text.

## lint

`flang lint` measures flang sources by two measures and compares them with the
limits written in `.flangrc`:

* **line length** — how many characters a line holds;
* **conditional depth** — how many `если` and `разбор` sit inside one another in
  the body of a function.

Both limits live in the settings file, next to the other keys:

```
max-line-length = 120
max-conditional-depth = 2
lint = refuse
```

A key that is absent means no limit: a project without these lines gets no
findings at all.

### Calling it

```bash
flang lint [<path>…] [--max-line-length N] [--max-conditional-depth N]
           [--warn | --refuse] [--tsv]
```

A path is a file or a directory. A directory is walked whole, except names that
begin with a dot; the files taken are those with the five source extensions:
`.flang`, `.fscript`, `.fp`, `.фп`, `.фланг`. A named file that is not a flang source
is skipped and said so. Without a path the command walks the working directory.

A key on the command line beats the project `.flangrc`, and the project file
beats `.flangrc` in the home directory.

```
$ flang lint docs/examples/guide/ladder-before.flang docs/examples/guide/walk-tree.flang
docs/examples/guide/ladder-before.flang:17: глубина ветвлений 3 > 2 в «Цена доставки» (max-conditional-depth)
docs/examples/guide/walk-tree.flang:15: длина строки 206 > 120 (max-line-length)
flang lint: файлов 2; max-line-length 120: 1; max-conditional-depth 2: 1; не разобрано 0
```

A finding names the file, the line, the measured value, the limit and the key.
The last line goes to the error stream and counts files and findings.

| Code | Meaning |
| --- | --- |
| `0` | nothing over the limits, or `lint = warn` |
| `1` | findings, and `lint = refuse` |
| `2` | a bad call: an unknown key, a path that does not exist, a bad value in `.flangrc` |
| `3` | nothing over the limits, but some files did not parse, and their depth was not measured |

`--tsv` prints one finding per line with tab-separated fields and no summary:

```
length	<path>	<line>	<length>	<limit>
depth	<path>	<line>	<depth>	<limit>	<function>	<first line>	<last line>
unparsed	<path>
skipped	<path>
```

### What is counted

**Length** is counted in characters, not bytes: `«Сумма»` is seven characters
long. The line break is not counted; a tab is one character. A long string
literal is a long line too.

**Depth** is measured on the parse tree of the function body, not on its
indentation. Every `если` and every `разбор` on the way from the body to a node
adds one level, wherever it stands: in a condition, in a branch, in an argument,
in the value of `пусть`. The depth of a function is its deepest such way, and the
finding points to the line of the deepest conditional.

```flang
если а
  то 1
  иначе если б
    то 2
    иначе 3
```

This is depth 2: the `если` in the `иначе` branch of another `если` is one level
deeper. A ladder of five such branches is depth 5. The way to stay shallow is a
list of rules and one `разбор`, not a ladder.

`или` and `и притом` are not conditionals for the linter, although the parse tree
writes them as `если`. Examples, `обеспечивает`, `требует` and theorems are not
measured: only the body is.

### What the grammar lets you break

A line breaks only where the grammar allows it to continue:

* inside a list literal, after `[` and after a comma;
* inside parentheses, before `иначе`;
* at the level of a statement, `если … то … иначе …` as three lines.

A record literal, a variant with fields and a chain of calls do not break: a
line break inside them ends the expression. Such a line is shortened by naming a
part of it with `пусть` or by a small function.

## facts

Checks claims against data. A claim has the form "left operator right"; the
left side is a fact, a field of a fact, or a function called on facts; the
right side is the same or a literal.

```bash
flang facts <файл.flang> --claims '["…"]' [--facts факты.json] [--steps N] [--pretty]
```

| Flag | What it does |
| --- | --- |
| `--claims '[…]'` | what to check, as a JSON array of strings. Required |
| `--facts file` | the facts as a JSON object. Without it there are no facts |
| `--steps N` | the step limit. 10000 by default |
| `--pretty` | indented JSON |

Exit codes: `0` — confirmed; `1` — **refuted** (the result still goes to
standard output; the code is there so that CI fails); `2` — bad call: no file,
unparsable JSON, unresolved imports.

Only functions with proved termination can be called in a claim; any other is
refused before evaluation.

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

Runs a `план` (plan): the only way a flang program works with files, processes,
the network or the terminal. The program does not do this itself: each step
returns a command as data ("write this file"), the runtime executes it and
calls the program again with the response. So all functions of a plan stay
pure and total, and their unit tests need no files and no network.

```bash
flang io <файл.flang> [--plan 'Имя'] [--max-orders N] [--seed N] [--in-dir]
                      [--max-steps N] [--timeout N] [--pretty] [--trust]
                      [--unproven refuse|warn|allow] [-- довод…]
```

| Flag | What it does |
| --- | --- |
| `--plan 'Имя'` | which plan to run, when the file has several |
| `--max-orders N` | the limit of commands per run. 10000 by default |
| `--max-steps N` | the step limit of one step of the plan |
| `--timeout N` | how long a process started with «Запустить процесс» may stay silent, in milliseconds, counted from its last byte on stdout or stderr. 30000 by default. After that the runtime kills it and responds «Сбой» with `FLANG_IO_TIMEOUT`. `0` or a non-number is a bad call, exit `2` |
| `--seed N` | the random seed: makes the run repeatable |
| `--in-dir` | forbid paths outside the directory of the input file |
| `--pretty` | indented JSON |
| `--trust` (`--на-веру`) | run a plan whose guarantees are not proved; proofs are not checked, and a line says so |
| `--unproven WORD` (`--недоказанное`) | `refuse` (the default), `warn`, `allow`; for good — the `unproven` key of `.flangrc` |
| `--` | everything after it is passed to the plan, not to `flang io`. The plan gets these arguments with the command «Прочитать доводы», as a list of strings in order |

Like `run`, `io` checks the proofs first and prints one line to the error
stream; a plan with unproved guarantees does not run, exit code `3`.

**Write the plan name without guillemets, and put a name with a space in shell
quotes.** In source code names are written in guillemets, but `--plan` takes the
name exactly as typed, guillemets included:

```bash
$ flang io scripts/shortcut-collector.fscript --plan «Целость»
доказано: утверждений 9
{"error":"не найден план ««Целость»»","diagnostics":[{"code":"FLANG_UNKNOWN_PLAN","message":"не найден план ««Целость»»","severity":"error"}]}
$ echo $?
3
$ flang io scripts/shortcut-collector.fscript --plan Целость
доказано: утверждений 9
{"plan":"Целость","result":"коротких команд 150; …
$ echo $?
0
```

Without shell quotes, a two-word name is split by the shell into two arguments:

```bash
$ flang io flang/scripts/kernel-forgeries.fscript --plan «Аксиом ноль»
flang io: непонятный ключ «ноль»»
$ echo $?
2
$ flang io flang/scripts/kernel-forgeries.fscript --plan 'Аксиом ноль' --trust
на веру: доказанность не считалась — запуск по ключу --trust
{"plan":"Аксиом ноль","result":"подделки отвергнуты: 36 файлов каталога … аксиом ноль, нарушений 0", …
$ echo $?
0
```

`flang io --help` itself writes `--plan «Имя»`; there the guillemets only mark
where the name goes.

Permissions are taken away one at a time: `--no-read`, `--no-write`, `--no-net`,
`--no-clock`, `--no-random`, `--no-spawn`, `--no-env`, `--no-args`,
`--no-screen`. By default everything is allowed: running a program with
`flang io` means you agree to what it does.

`io` has no `--args`: a plan starts from its own `начинает с` function, not from
arguments. Pass data after `--` instead.

```bash
$ flang io docs/examples/crypto/revocation.flang --args '{}'
flang io: непонятный ключ «--args»
$ echo $?
2
```

Exit codes: `0` — the plan finished; `1` — the program gave up itself
(«Провал»): it found a problem and named it; `2` — bad call; `3` — the tool
failed, or the program answered «Не проверено» (it could not check what it was
asked to), or the plan is not proved and neither `--trust` nor the `unproven`
setting allowed it.

An example plan, `план.flang`, writes one file:

```flang
модуль «План»

тип «Ход»
  вариант «Пишем»
  вариант «Ждём запись»

план «Записать привет»
  состояние «Ход»
  начинает с «Начало»
  обрабатывает «Дальше»

тотальная функция «Начало»
  возвращает «Ход»
  пример «план начинается с записи»
    ожидается вариант «Пишем»
  вариант «Пишем»

тотальная функция «После записи»
  принимает отклик: «Отклик»
  возвращает «Продолжение»
  пример «записано шесть байт»
    дано отклик равно вариант «Записано» с сколько равным 6
    ожидается вариант «Конец работы» с значение равным 6
  разбор отклик
    случай вариант «Записано» с сколько как сколько
      то вариант «Конец работы» с значение равным сколько
    случай любое
      то вариант «Провал» с код равным "FLANG_IO_ORDER" и сообщение равным "ждали подтверждение записи"

тотальная функция «Дальше»
  принимает ход: «Ход», отклик: «Отклик»
  возвращает «Продолжение»
  пример «первым делом пишется файл»
    дано ход равно вариант «Пишем»
    дано отклик равно вариант «Пока ничего»
    ожидается вариант «Сделать» с поручение равным (вариант «Записать файл» с путь равным "привет.txt" и содержимое равным "привет") и потом равным (вариант «Ждём запись»)
  разбор ход
    случай вариант «Пишем»
      то вариант «Сделать» с поручение равным (вариант «Записать файл» с путь равным "привет.txt" и содержимое равным "привет") и потом равным (вариант «Ждём запись»)
    случай вариант «Ждём запись»
      то «После записи» от отклик
```

The output is the plan's result and the log: each command («поручение») with
the runtime's response («отклик»):

```bash
$ flang io план.flang --pretty
доказано: утверждений 0
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

Take a permission away, and the plan gets a refusal as its response and gives
up with code `1`:

```bash
$ flang io план.flang --no-write
доказано: утверждений 0
{"error":"ждали подтверждение записи","diagnostics":[{"code":"FLANG_IO_ORDER","message":"ждали подтверждение записи","severity":"error","span":{"line":7,"column":1}}]}
$ echo $?
1
```

**Terminal.** The screen is the controlling terminal (`/dev/tty`), and it has one
place, named «экран»; any other name is `FLANG_IO_PLACE`. «Показать» draws a
whole frame (clear, then text) on the terminal, not on stdout — stdout carries
the plan's result. On the first «Показать» the runtime switches to the
terminal's alternate screen and hides the cursor, and restores both when the
run ends. «Ждать событие» waits for a key no longer than «срок» milliseconds (0
or none — forever): a key gives «Случилось» with «откуда» equal to
«клавиатура», a timeout gives «Срок вышел». Key names: ввод, пробел, таб,
возврат, выход, вверх, вниз, влево, вправо; any other key arrives as its
character. Ctrl-C still stops the program. «Размер экрана» returns the width and
height in characters. Without a terminal (output piped, CI, nohup) these
commands answer `FLANG_IO_NO_SCREEN`; with `--no-screen` they answer
`FLANG_IO_DENIED`.

**HTTPS.** The «Запросить» command supports `https`, but through an external
`curl`: the binary has no TLS of its own. Without `curl` the answer is
`FLANG_IO_NO_TLS`; `--no-spawn` forbids `https` too (`FLANG_IO_DENIED`). `curl`
checks the certificate (expiry, chain, host name); certificate revocation (OCSP,
CRL) is not checked. «Открыть соединение» is plain TCP.

## lock

Prints the lock file of a program: JSON that contains the dependencies
themselves, not references to them. For each imported module its whole source
is stored, addressed by the `sha256` of that source. There is no registry and
nothing to download: everything is in the lock.

```bash
flang lock <файл.flang> [--pretty]
```

| Flag | What it does |
| --- | --- |
| `--pretty` | indent by two spaces |

If a `flang.lock` is next to the input file, every command takes imports from it
and does not read the dependency sources. A damaged lock is refused with
`FLANG_LOCK`.

```bash
$ flang lock привет.flang
{"схема":2,"вход":"./привет.flang","модули":[],"печать":"dcf9b0c54a6a814573047949d66a78d7e4706c67ae8873e637823fa799609779"}
```

`привет.flang` imports nothing, so the list of modules («модули») is empty.

## package

Prints a package: the same content as a lock, plus a name, a version, the
source and the list of what is proved.

```bash
flang package <файл.flang> [--pretty]
```

| Flag | What it does |
| --- | --- |
| `--pretty` | indent by two spaces |

The name and version come from a `flang.package` file next to the input file,
not from flags. Without it the command fails with code `1`:

```bash
$ flang package привет.flang
FLANG_PACKAGE: рядом с привет.flang нет объявления flang.package: пакету нужны имя и версия, и берутся они оттуда, а не из вызова
$ echo $?
1
```

With a `flang.package` next to it, the package is built:

```bash
$ cat flang.package
{"имя": "Привет", "версия": "1.0.0"}

$ flang package привет.flang | head -c 160
{"схема":2,"имя":"Привет","версия":"1.0.0","вход":"./привет.flang","модули":[{"имя":"Привет","путь":"./привет.flang","функций":1,"адрес":"2bc2186046bc075d03953d3ff11c333835b8561a724dc526bb95c91730fe0699","исходник":"module «Привет»\n\ntotal function «Удвоить»\n  accepts н: number\n  returns number\n  examp
```

A package is built only from a checked program. How to use one:
[How to write packages](packages.html).

## new

Creates a directory with a ready package: a module with one total function and
a unit test, a `fspec/` directory with one proved spec and a check program
`guard.flang`, the manifest `flang.package` and a README.

```bash
flang new <имя> [--force]
```

| Flag | What it does |
| --- | --- |
| `--force` (`--силой`) | overwrite the directory if it exists |

```bash
$ flang new проба-cli
flang new: пакет «проба-cli» создан в …/проба-cli
  cd проба-cli && flang check проба-cli.flang
  flang io fspec/guard.flang
$ ls проба-cli
README.md  flang.package  fspec  проба-cli.flang
```

An existing directory without `--force` is exit code `1`; a name with a space,
a slash, quotes or guillemets, or a reserved word (a command name, `flang`,
`fspec`) is exit code `2`, and no files are created.

## run-script

```
flang run-script [<name> [arguments…]]
```

A short project command is a name for a shell command line. It is written in
the settings file `.flangrc` as `script.<name> = <command>`, like `scripts` in
`package.json`:

```
script.site:build = node docs/site/build.mjs
```

Without a name, `flang run-script` lists the short commands of the project;
with a name it runs that one, and everything after the name goes to the
command. In a directory whose `.flangrc` has the two lines shown:

```bash
$ cat .flangrc
script.hello = echo hello
script.fail = exit 7

$ flang run-script hello
hello
$ echo $?
0

$ flang run-script fail
$ echo $?
7

$ flang run-script missing
flang run-script: короткой команды «missing» в «…/.flangrc» нет. Вот какие есть:

  hello                              echo hello
  fail                               exit 7
$ echo $?
2
```

The file is the nearest `.flangrc` from the current directory upwards; the one
in your home directory does not define short commands. The line runs with
`/bin/sh -c` in the directory of that file, and the exit code is the command's
own. If a name is written twice, the last line wins. In a line of several
commands joined by `&&`, the arguments go to the last one.

| Exit code | When |
| --- | --- |
| the command's own | the command ran |
| `2` | no such name, or no `.flangrc` |
| `3` | the file could not be read, or `/bin/sh` did not start |

The binary's own flags `--depth-limit` and `--step-limit` are taken by the
binary before the name and do not reach the command.

## repl

The interactive shell, the same as a bare `flang` in a terminal. Declarations
add up during the session, expressions are computed at once, `.помощь` lists
the shell commands. A file given as an argument is loaded at startup.

```bash
flang repl [<файл.flang>] [--max-steps N] [--max-depth N]
```

| Flag | What it does |
| --- | --- |
| `--max-steps N` | the step limit of the evaluator |
| `--max-depth N` | the depth limit |

An expression is computed by generating C for the session (as `flang emit`
does), building it with the system C compiler and running it:

```bash
$ echo '«Удвоить» от 21' | flang repl привет.flang
объявлено: тотальная функция «Удвоить» — завершение доказано
загружено из привет.flang
42
```

Without a C compiler the shell still works: it checks parsing, types and
termination and answers «проверено» (checked) instead of a value, and says so
at startup:

```bash
$ echo '«Удвоить» от 21' | FLANG_CC=/nonexistent/cc flang repl привет.flang
вычислять нечем: компилятора C нет (ни $FLANG_CC, ни cc, ни gcc, ни clang в PATH).
Разбор, типы и завершаемость проверяются по-прежнему; выражение отвечает «проверено».
объявлено: тотальная функция «Удвоить» — завершение доказано
загружено из привет.flang
проверено
```

The C compiler and its files are found through `FLANG_CC`,
`FLANG_INCLUDE_DIR` and `FLANG_LIB_DIR`.

## lsp

The flang language server over standard input and output (`Content-Length`
frames with JSON bodies, as the LSP specification says). Your editor starts it;
started by hand, it silently waits for messages.

```bash
flang lsp [--stdio]
```

| Flag | What it does |
| --- | --- |
| `--stdio` | talk over standard input and output |

It provides diagnostics (the same checks as `flang check`: parsing, names,
types, termination), completion, hover with the signature, and go to
definition. Only protocol messages go to standard output; everything else goes
to the error stream.

To check that the server works, send it one message:

```bash
$ printf 'Content-Length: 107\r\n\r\n{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"processId":null,"rootUri":null,"capabilities":{}}}' | flang lsp --stdio
Content-Length: 311

{"jsonrpc":"2.0","id":1,"result":{"capabilities":{"positionEncoding":"utf-16","textDocumentSync":{"openClose":true,"change":1,"save":{"includeText":false}},"completionProvider":{"triggerCharacters":["«","."]},"hoverProvider":true,"definitionProvider":true},"serverInfo":{"name":"flang-lsp","version":"0.1.0"}}}
```

Known limitation: in a program with `использует` (import), an error in an
imported module goes to the editor's log instead of being underlined in that
module's buffer.

## Environment variables

| Variable | What it sets |
| --- | --- |
| `FLANG_RUNTIME_DIR` | where `emit` looks for target runtime sources when `--runtime` is not given |
| `FLANG_CC` | the C compiler `repl` calls |
| `FLANG_INCLUDE_DIR`, `FLANG_LIB_DIR` | where `repl` looks for headers and the library |
| `FLANG_UNPROVEN` | what `run` and `io` do with unproved programs: `refuse`, `warn`, `allow` |

`FLANG_RECURSION_LIMIT` is not a variable but an error code: the step or depth
limit ran out.

## Next

- [Diagnostics reference](diagnostics.html) — every `FLANG_…` code and how to fix it.
- [Language reference](language.html) — what to write in the file.
- [How to write packages](packages.html) — what to do with the output of `lock` and `package`.
