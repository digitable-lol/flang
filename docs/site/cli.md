# Command reference

The commands of the `flang` binary are listed by its own help (inserted at the end
of this page from `flang --help`). For each one this page says when to
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

The examples below use this file, `docs/examples/cli/double.flang`:

```flang insert docs/examples/cli/double.flang
module «Hello»

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

Exit codes: `0` — no remarks; `1` — the program did not pass, or with `--proof`
a guarantee is violated; `2` — the program contains declarations the binary does not check at all
(category declarations, processes, supervision), and it names them; `3` — with
`--proof`, a guarantee is not proved, including a guarantee checked only on
examples (`сетка N`), a law checked only on a grid and a guarantee proved under
an unproved premise, and a file without imports whose proof record the
independent checker did not accept (`НЕ СОШЛОСЬ СО СВЕРЩИКОМ`); with `--strict`,
also a file with no guarantees at all; `4` — with `--fast`. The checker line comes before the verdict line. On a file
with imports the checker gets no records of the imported modules; its
disagreement there is named `НЕЗАВИСИМО НЕ ПРОВЕРЕНО` and does not change the
code ([ADR-0115](../adr/0115-the-exit-code-of-a-proof-check-names-what-was-proved.md)).

```text insert output: check docs/examples/cli/double.flang
$ flang check docs/examples/cli/double.flang
модуль «Hello»: функций 1, из них с доказанным завершением 1; типов 0
docs/examples/cli/double.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
```

The first line counts functions and how many of them have proved termination.
The second says all checks passed: parsing, types, termination, the prover
(«ядро») and the unit tests.

When a check fails, the output gives the error code, the line and the column.
Here `docs/examples/cli/bad.flang` declares `returns string` but the body gives a number:

```text insert output: check docs/examples/cli/bad.flang
$ flang check docs/examples/cli/bad.flang
модуль «Bad»: функций 1, из них с доказанным завершением 1; типов 0
FLANG_TYPE в файле docs/examples/cli/bad.flang, строка 6, столбец 5: функция «Удвоить» объявлена как строка, а тело даёт число
docs/examples/cli/bad.flang: не проверено — замечаний 1
$ echo $?
1
```

Every `FLANG_…` code and how to fix it: [Diagnostics reference](diagnostics.html).

```text insert output: check docs/examples/cli/double.flang --fast
$ flang check docs/examples/cli/double.flang --fast
модуль «Hello»: функций 1, из них с доказанным завершением 1; типов 0
ПРОВЕРЕНО: связывание имён и повторы объявлений, типы, исчерпываемость разбора,
           завершаемость (в том числе взаимная рекурсия по компонентам), процессы, планы.
НЕ СМОТРЕЛИ НА ЭТОМ ПРОГОНЕ: ядро доказательств — обязательств 0, теорем 0;
           законы категории на сетке; прогон примеров — примеров 1.
           И это не «нарушений нет»: про них не сказано ничего — ни хорошего, ни плохого.
           «Не смотрели» — не то же, что «объявлено, доказательства нет»: второе
           значит «смотрели и не смогли», а здесь вопроса не задавали вовсе.
           Спросить всё — та же команда без «--быстро».
docs/examples/cli/double.flang: часть проверок НЕ ЗАПУСКАЛАСЬ — код возврата 4, а не 0
$ echo $?
4
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

```flang insert docs/examples/cli/grid.flang
модуль «Grid»

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

`flang check docs/examples/cli/grid.flang` exits `0`: it does not judge proofs. `flang check
docs/examples/cli/grid.flang --proof` exits `3`: the report says `сетка 1` — one guarantee checked
only on examples — and `НЕ ДОКАЗАНО — ОПОРА НЕ СУДИЛАСЬ`. With `--strict` the code
is `3` as well.
`flang run` refuses to compute it (see [run](#run)), and with `--trust` at
`н = 100` it fails the postcondition:

```text insert output: run docs/examples/cli/grid.flang --function «Удвоить» --args '{"н":100}' --trust
$ flang run docs/examples/cli/grid.flang --function «Удвоить» --args '{"н":100}' --trust
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
example failed or a file was not taken; `2` — bad call.

A `прогон` block states a scenario over processes. `flang test` runs it with the
scheduler of `flang/self/conc.flang` and checks its expectations; each block
counts as one example, so a block whose expectation is false fails the file
with exit `1`:

```text insert output: test flang/concurrency/examples/counter.flang
$ flang test flang/concurrency/examples/counter.flang
flang/concurrency/examples/counter.flang: примеров 4, прошло 4, не прошло 0
```

```text insert output: test docs/examples/cli/double.flang
$ flang test docs/examples/cli/double.flang
docs/examples/cli/double.flang: примеров 1, прошло 1, не прошло 0
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
                       [--cost]
```

| Flag | What it does |
| --- | --- |
| `--function «Имя»` | the function to compute. Required |
| `--args '{…}'` | arguments as a flat JSON object of scalars. Lists and nested objects are not accepted |
| `--max-steps N` | the step limit of the evaluator |
| `--max-depth N` | the depth limit of the program being evaluated (the binary's own limit is `--depth-limit`) |
| `--memory-limit N` | memory limit; exit `5` at the limit |
| `--cost` (`--цена`) | after the value, one line to the error stream: evaluator steps, the peak memory of the process in bytes and the seconds of the run — `цена прогона: шагов 6, пик памяти 13443072 байт, секунд 0.005997` |
| `--trust` (`--на-веру`) | run even if guarantees are not proved; the proofs are not checked at all, and a line says so |
| `--unproven WORD` (`--недоказанное`) | what to do when guarantees are not proved: `refuse` — do not run (the default), `warn` — say so and run, `allow` — the same as `--trust`. Cyrillic values: `отказ`, `предупреждение`, `разрешение` |

Arguments are checked against the declared types first: «Факториал» of −3 is
rejected with `FLANG_TYPE` instead of being computed.

**`run` refuses an unproved program.** Before computing, it checks the proofs
of everything the program uses (not just this file) and prints one line to the
error stream: `доказано: утверждений N` (N guarantees, all proved), or
`не доказано: …` and then nothing is computed, exit code `3`.

```text insert output: run docs/examples/cli/double.flang --function «Удвоить» --args '{"н":21}'
$ flang run docs/examples/cli/double.flang --function «Удвоить» --args '{"н":21}'
доказано: утверждений 0
42
```

To allow unproved programs for good, set the `unproven` key in `.flangrc`
([settings guide](https://github.com/digitable-lol/flang/blob/main/docs/guide/settings.md#what-to-do-with-an-unproved-program)):
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
напечатано файлов 6, байт …, в вывод
проверено перед печатью — разбор, типы, завершаемость и ядро доказательств.
ПРИМЕРЫ НЕ ПРОГНАНЫ: их считает вычислитель на самом языке, и на самых больших
программах он в предел шагов этого бинарника не укладывается — свяжи с ними
печать, и компилятор перестал бы печатать сам себя. Прогоните их отдельно:
flang test <файл>

$ ls вывод
Makefile  flang_cli.c  flang_runtime.c  flang_runtime.h  privet.c  privet.h
```

The output says: 6 files written; the program was checked before generation;
the unit tests were not run. The generated runner checks arguments against the
declared types the same way `flang run` does: for `−3` given to a
`неотрицательное` parameter it answers `FLANG_TYPE`. File names are the
module name in Latin letters («Привет» → `privet.c`).

An unknown target is exit code `2`, with the list of targets:

```text insert output: emit docs/examples/cli/double.flang --target нету
$ flang emit docs/examples/cli/double.flang --target нету
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
{"plan":"Целость","result":"коротких команд 217; …
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

**HTTPS.** The «Запросить» command supports `https`. In the runtime sources it
is executed by the TLS 1.3 client written in the language
(`flang/stdlib/tls-client.flang`), printed to C and built into the binary; a
binary printed before this change goes through an external `curl` and answers
`FLANG_IO_NO_TLS` without it
([ADR-0101](../adr/0101-the-binary-host-speaks-tls-with-the-printed-language-client.md)).
The client checks the chain up to a root, expiry, the host name and the
server's signature; a certificate failure is `FLANG_IO_TLS_CERT`, any other TLS
failure `FLANG_IO_TLS`. Roots come from `--trust-roots <PEM file>` or the
system bundle. Certificate revocation (OCSP, CRL) is not checked.
«Открыть соединение» is plain TCP.

**Datagrams.** «Отправить датаграмму» and «Принять датаграмму» are UDP over
IPv4 with octets as a list of numbers; the answer is «Записано», «Датаграмма»
or «Срок вышел».

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

```text insert output: lock docs/examples/cli/double.flang
$ flang lock docs/examples/cli/double.flang
{"схема":2,"вход":"./double.flang","модули":[],"печать":"dcf9b0c54a6a814573047949d66a78d7e4706c67ae8873e637823fa799609779"}
```

`double.flang` imports nothing, so the list of modules («модули») is empty.

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

$ flang package привет.flang | head -c 400
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

## The whole help of the binary

Below is what the binary itself prints: `flang --help` and `flang <command>
--help` for every command. The text is inserted from that output when the page is
built and compared with it on every check, so it cannot drift from the binary. The
binary speaks Russian.

```text insert output: --help
$ flang --help
flang 0.7.29 — язык, проверяемый до запуска: типы и доказанное завершение.

  flang                              оболочка: объявляй и считай сразу
  flang check <файл>                 разбор, типы, завершаемость, доказательства
  flang test <файл|каталог>          прогон примеров: один файл или целый каталог
  flang run <файл> --function «Имя»  вычислить одну функцию и напечатать значение
  flang emit <файл> --target «цель»  напечатать программу: c|cpp|go|rust|java|js|ts|elixir|python|csharp
  flang ast <файл>                   разобранная программа деревом в JSON
  flang tokens <файл>                поток токенов: чем каждое слово стало у лексера
  flang lint [<путь>…]               длина строк и глубина ветвлений против «.flangrc»
  flang facts <файл> --claims '[…]'  проверить утверждения на фактах
  flang io <файл>                    исполнить план: файлы, каталоги, процессы, сеть
  flang lock <файл>                  замок: сами зависимости, а не ссылки на них
  flang package <файл>               пакет: замок с именем, версией и ведомостью
  flang new <имя>                    новый пакет с нуля: модуль, fspec/, манифест
  flang run-script <имя>             короткая команда проекта из «.flangrc»
  flang repl [файл]                  та же оболочка, названная по имени
  flang lsp [--stdio]                языковой сервер для редактора (LSP)
  flang --mcp-mode                   служба для ИИ-помощника (MCP по стандартным потокам)

  flang --help                       эта справка
  flang --version                    версия
  flang --machine [<файл>]           постоянная этой машины: витков в секунду
  flang <команда> --help             все ключи команды

  --depth-limit N                    предел глубины вызовов САМОГО бинарника
                                     на этот прогон; годится при любой команде
                                     и поднимает заодно стек. Кириллицей:
                                     --предел-глубины
  --step-limit N                     предел ШАГОВ самого бинарника на этот
                                     прогон; годится при любой команде, печать
                                     включая. НЕ путать с «--max-steps N» у
                                     «emit»: тот впечатывается в вывод и своему
                                     прогону не говорит ничего. Кириллицей:
                                     --предел-шагов
  --memory-limit N                   предел ПАМЯТИ самого бинарника на этот
                                     прогон, байтами или с буквой K, M, G, T;
                                     0 — без предела. У check, test и run по
                                     умолчанию три четверти памяти машины. На
                                     пределе — остановка кодом 5 с именем
                                     функции и числом шагов. Кириллицей:
                                     --предел-памяти

Без доводов и без терминала на входе (конвейер, «--json») бинарник остаётся
прогонщиком: JSON на входе, JSON на выходе, по запросу на строку.

Здесь все 15 команд, и «flang lsp» среди них; отдельная команда «flang-lsp» —
тот же языковой сервер, который кладёт на «PATH» пакет npm.
Служба для ИИ-помощника отвечает НЕ «ок»: три вердикта — «доказано», «сетка N»
и «объявлено, не доказано» — уходят порознь. «flang --mcp-mode --help» — как её
прописать помощнику.
Чего бинарник не судит — ЗАКОНЫ КАТЕГОРИИ бинарник СЧИТАЕТ САМ — на сетке, с названным числом
значений: что объявленное равенство есть эквивалентность, что композиция
его уважает, что она ассоциативна и что квадрат естественного
преобразования коммутирует. Это счёт, а не доказательство, и отчёт говорит
об этом словами.

ЧЕГО НЕТ — УСТРОЙСТВО тех же объявлений: что категория замкнута под
композицией, что у каждого объекта есть единица, что концы у композиции
сходятся, что морфизм и преобразование объявлены как надо. Целиком нет
этих: связь модулей, бифунктор, изоморфизм, моноид, монада, множества,
объявленные свойства, требования, процесс, надзор, прогон.
Программу с такими объявлениями «flang check» НЕ пропускает молча: он
называет, чего не проверил, и отвечает кодом 2.

Подробности: man flang
```

### `flang check --help`

```text insert output: check --help
$ flang check --help
flang check <файл.flang> [--proof [--json] [--strict] [--record <файл>]]
                          [--fast] [--step-limit N] [--depth-limit N]

Разбор, типы, завершаемость, ядро доказательства. Замечания с кодом и местом,
код возврата 1, если программа не прошла.

  --fast             только связывание, типы, исчерпываемость и
                     завершаемость. Ядро доказательств, законы категории и
                     прогон примеров НЕ ЗАПУСКАЮТСЯ, и об этом говорится
                     вслух: что пропущено, сколько обязательств и сколько
                     примеров не смотрели. Код возврата 4 — «часть проверок
                     не запускалась»; ноль остаётся за «спрошено всё».
                     Рядом с «--proof» не имеет смысла и отвергается:
                     ведомость — это ответ ядра. Кириллицей: --быстро
  --proof            ведомость: чем несётся обещание «тотальная» у каждой
                     функции и чем — каждое высказанное утверждение
  --json             вместе с --proof: ведомость машинным видом
  --strict           вместе с --proof: четыре исхода разъезжаются кодами.
                     0 — ДОКАЗАНО: утверждений хотя бы одно и у КАЖДОГО
                     вердикт «доказано»; 1 — ОПРОВЕРГНУТО; 3 — НЕ УДАЛОСЬ
                     ДОКАЗАТЬ (опора на сетку значений автора, на
                     недоказанную посылку или «объявлено, не доказано»);
                     2 — НЕ ПОДДЕРЖИВАЕТСЯ. Код 4 остаётся за «--fast».
                     Без ключа опора остаётся нулём и называется строкой.
                     Кириллицей: --строго
  --record <файл>    вместе с --proof: положить САМО доказательство в файл
                     строками, которые читает и человек, и сверщик
                     (flang/proof/checker.flang). Ключ пишется и кириллицей:
                     --записать
  --step-limit N     ключ САМОГО бинарника (стоит где угодно в строке) —
                     поднять предел шагов ПРОВЕРЯЮЩЕГО на этот прогон.
                     Умолчание вшито при сборке (scripts/bootstrap-reprint.sh) и
                     ловит зацикливание; ключ поднимает его осознанно и
                     только там, где сказано. Исчерпание остаётся внятным:
                     FLANG_RECURSION_LIMIT с числом. Кириллицей: --предел-шагов
  --depth-limit N    поднять предел ГЛУБИНЫ вызовов на этот прогон. Ключ
                     общий у всех команд бинарника и поднимает заодно стек,
                     которым глубина и несётся. Не путать с «--max-depth» у
                     «emit»: тот кладёт число в НАПЕЧАТАННУЮ программу, а
                     этот — в текущий прогон. Кириллицей: --предел-глубины
  --memory-limit N   предел памяти прогона (умолчание — три четверти памяти
                     машины); на пределе — код 5 с именем функции и числом
                     шагов. Кириллицей: --предел-памяти

ПУСТАЯ ВЕДОМОСТЬ ПОД «--strict» — НЕ УСПЕХ. Ноль под ключом требует хотя бы
одного обязательства: у программы без единого утверждения и закона прибор не
проверил ничего, и ответ ей — ПРОВЕРЕНО ВПУСТУЮ, код 3. «Доказано ноль из
нуля» — тишина, а не доказательство, и код 0 значил бы «ничего не нашли».
Умолчание тут не тронуто: без ключа такая программа по-прежнему ноль.

Категорной поверхности и процессов бинарник НЕ СУДИТ ВОВСЕ — ни доказуемых
правил (концы стрелок, замкнутость категории, полнота связи), ни законов на
сетке (моноид, монада, изоморфизм, равенство морфизмов, множества, квадрат
связи, пять объявленных свойств), ни процессов, надзора и прогонов. Слоёв,
которые это делают, в бинарнике нет. Поэтому программа с такими объявлениями
получает отказ с названным пробелом и код 2 — и у check, и у --proof:
«замечаний нет» и пустой раздел ведомости читались бы как «проверено», а это
неправда. Поиск нарушений по примерам тоже не переехал: ведомость говорит «не
искали», а не «не найдено». Печать такую программу ПЕЧАТАЕТ, но называет тот же
пробел и уходит кодом 3: файлы есть, ручаться за них целиком нельзя.

ДВА ЗАЗОРА, которые бинарник не умеет даже НАЗВАТЬ, и потому названы здесь.
Уточнённые числовые типы («сотых», «вес») стоят типом в подписи, а не
отдельной строкой: программу с ними от обычной по объявлениям не отличить, и
check на ней отвечает «замечаний нет». Мост из FTS («.fts»-модели, законы
поверх них) бинарник не принимает вовсе.

Полный список правил, которых здесь нет, — не в этой справке, а в проверке:
flang/scripts/binary-rules-guard.mjs сверяет СОСТАВ ПРАВИЛ двух реализаций в
обе стороны, и правило, дописанное одной из них, красит её само.
```

### `flang test --help`

```text insert output: test --help
$ flang test --help
flang test <файл.flang | каталог | маска> [--no-check] [--json]
                                          [--max-steps N] [--max-depth N]

Прогон примеров, объявленных внутри функций. Сначала проверяет программу теми
же проверками, что и check: «пример сошёлся» на программе с ошибкой типов не
значит ничего.

Довод, не кончающийся на «.flang», и всякий довод со звездой или вопросом —
это НАБОР файлов, а не один файл:

  flang test flang/stdlib/                весь каталог, вглубь
  flang test 'examples/**/*.flang'  по маске (кавычки — от оболочки)

У набора печатается каждый не прошедший пример и каждый не взятый файл, а
прошедшие — числом. Код возврата 0 — взяты все файлы и сошлись все примеры;
1 — что-то не сошлось или файл не взят; 2 — кривой вызов.

  --no-check      не проверять — смотреть на поведение примеров, пока
                  программа ещё в правке
  --json          машиночитаемый итог одной строкой
  --ledger        ведомость: по строке на файл, для сверки диффом
  --max-steps N   предел шагов вычислителя
  --max-depth N   предел глубины
  --memory-limit N  предел памяти прогона (умолчание — три четверти памяти
                  машины); на пределе — код 5 с именем функции и числом шагов.
                  Кириллицей: --предел-памяти

У не сошедшегося примера называются ОБЕ стороны: ожидалось и получено.
Длинное значение обрезается на 200 знаках, и длина полного сказана числом.

Примеры, объявленные при морфизмах теорката, здесь не прогоняются: их считает
версия для Node. На таких программах счёт «примеров N» окажется меньше её.
```

### `flang run --help`

```text insert output: run --help
$ flang run --help
flang run <файл.flang> --function «Имя» [--args '{"н":10}'] [--max-steps N]
                       [--max-depth N] [--trust] [--unproven refuse|warn|allow]
                       [--cost]

Вычисляет ОДНУ функцию и печатает значение. Считает сам flang — ни Node, ни
«cc» для этого не нужны.

Аргументы сверяются объявленным типам ДО вычисления: «Факториал» от −3
отвергается FLANG_TYPE, а не считается.

ПЕРЕД ВЫЧИСЛЕНИЕМ СЧИТАЕТСЯ ВЕРДИКТ и одной строкой уходит в поток ошибок:
«доказано: утверждений N» либо «не доказано: …». Судится ЗАМЫКАНИЕ — всё,
что связано, а не один файл. Недоказанная программа не считается вовсе:
код 3 (ADR-0045). Запустить её всё же — «--trust» на один прогон либо ключ
«unproven» в «.flangrc» — раз и навсегда.

  --function «Имя»   что вычислять
  --args '{…}'       аргументы: ПЛОСКИЙ объект скаляров, вроде '{"н":10}'.
                     Списка или вложенного объекта здесь не принимают —
                     их считает версия для Node
  --max-steps N      предел шагов вычислителя
  --max-depth N      предел глубины ВЫЧИСЛЯЕМОЙ программы. Предел самого
                     бинарника — другой счётчик и другой ключ:
                     «--depth-limit N»
  --memory-limit N   предел памяти прогона (умолчание — три четверти памяти
                     машины); на пределе — код 5 с именем функции и числом
                     шагов. Кириллицей: --предел-памяти
  --cost             после значения одной строкой в поток ошибок: шагов
                     вычислителя (тот же счётчик, что у «--max-steps»), пик
                     памяти процесса в байтах и секунды всего прогона.
                     Кириллицей — «--цена»
  --trust            считать недоказанную: вердикт не считается вовсе, и об
                     этом говорится своей строкой. Кириллицей — «--на-веру»
  --unproven СЛОВО   что делать с недоказанной, все три исхода сразу:
                     refuse — не запускать (умолчание), warn — сказать и
                     запустить, allow — запустить, вердикта не считая (то же,
                     что «--trust»). Кириллицей — «--недоказанное отказ |
                     предупреждение | разрешение»

ТО ЖЕ РАЗ И НАВСЕГДА — ключ «unproven» в «.flangrc»
(docs/guide/settings.ru.md): «unproven = warn». Старшинство: ключ команды
старше переменной среды FLANG_UNPROVEN, та старше «.flangrc», а он —
умолчания «refuse». Значения, которого нет, файл молча не проглатывает:
отказ словами и код 2. Запись до 0.7.22, «недоказанное = отказ», читается
по-прежнему, и одной строкой сказано, какой английской её заменить.
```

### `flang emit --help`

```text insert output: emit --help
$ flang emit --help
flang emit <файл.flang> --target c|cpp|go|rust|java|js|ts|elixir|python|csharp
                        [--out каталог | --file имя] [--cli|--no-cli] [--repl]
                        [--runtime каталог] [--index-base 0|1]
                        [--max-steps N] [--max-depth N] [--no-check]
                        [--no-postconditions]

Печатает программу без Node — во все десять целей. Каталог из «--out»
заводится сам, вместе с промежуточными и с подкаталогами, которых просит цель
(у Go путь файла — это имя пакета).

  --out каталог     записать все файлы в каталог
  --protocol файл   рядом с C напечатать протокол перевода (только у цели «c»,
                    ADR-0030): что во что перешло и по какому правилу; его
                    переигрывает flang/translation/matcher.c. Кириллицей —
                    --протокол
  --file имя        один файл на стандартный вывод
  --cli | --no-cli  печатать ли прогонщик
  --repl            напечатать ещё и человеческий вход (только цель «c»)
  --runtime каталог где лежат исходники рантайма цели
  --max-steps N     предел шагов, ВПЕЧАТЫВАЕМЫЙ в напечатанную программу
                    («#define FL_MAX_STEPS»). Своему прогону печати он не
                    говорит ничего — для него «--step-limit N»
  --max-depth N     предел глубины, ВПЕЧАТЫВАЕМЫЙ в напечатанную программу
                    («#define FL_MAX_DEPTH»). Своему прогону печати он не
                    говорит ничего — для него «--depth-limit N»
  --no-check        не гонять ядро доказательств. Насколько быстрее —
                    зависит от модуля, и РАЗНИЦА ОГРОМНА: числа ниже.
                    Напечатанное толще. ЧТО ЭТИМ НЕЛЬЗЯ — ниже, отдельным
                    абзацем: в ствол напечатанное так НЕ ГОДИТСЯ
  --no-postconditions  не печатать сторожей постусловий В КОД. Судятся они
                    по-прежнему: это ключ печати, а не проверки. Напечатанное
                    заметно быстрее и говорит о ключе своей шапкой — числа и
                    условия ниже, отдельным абзацем


ПЕЧАТАЕТСЯ ТОЛЬКО ПРОВЕРЕННОЕ. Перед печатью программа судится той же дорогой,
что и «flang check»: разбор, связывание, типы, завершаемость и ядро
доказательств. Замечание — печать отменена и код 1, ни файла не записано.
ЧЕГО ЭТА СБОРКА НЕ СУДИТ, она называет. Категорную поверхность и процессы с
надзором она не судит вовсе. Такая программа ПЕЧАТАЕТСЯ — иначе эту часть языка
нечем было бы собрать без Node, — но несуждённое зовётся поимённо, а код 3.
Коды: 0 напечатано и пробелов нет, 1 не прошло проверку, 2 неверен вызов,
3 напечатано, но проверено не всё.
ПРИМЕРЫ не прогоняются, и это названо, а не умолчано: их считает вычислитель на
самом языке, и на самых больших программах дерева он в предел шагов этой сборки
не укладывается — свяжи с ними печать, и компилятор перестал бы печатать сам
себя, то есть сломалась бы раскрутка. Прогоняются они «flang test <файл>».
«--no-check» СНИМАЕТ РОВНО ЯДРО ДОКАЗАТЕЛЬСТВ, и больше ничего. Разбор,
связывание, типы и завершаемость судятся и с ним, и печать при замечании
по-прежнему отменяется кодом 1. Имя ключа шире его дела: написание занято у
«flang test» и у версии для Node, и второе заводить не стали — потому дело и
названо здесь, а не оставлено на догадку.
СКОЛЬКО ОН ЭКОНОМИТ — ЧИСЛО НЕ ОДНО, и разброс больше самой экономии;
«вдвое» неправда в обе стороны. Замер 30 августа 2026 на этом дереве, круг
«печать + сборка», по два прогона:
  flang/self/builtins.flang   148,8 → 18,9 с   в 7,9 раза быстрее
  flang/self/cli.flang         13,1 →  7,5 с   в 1,8 раза
  flang/self/lexer.flang        6,5 →  6,9 с   КЛЮЧ ВРЕДИТ
Цена ядра растёт с числом ДОКАЗЫВАЕМЫХ постусловий, а не с размером файла:
у lexer.flang ядро стоит 4 % печати, у builtins.flang — 95 %. А сборка с
ключом идёт ДОЛЬШЕ, потому что сторожей в напечатанном больше. Где ядро
дёшево, ключ проигрывает — не берите его по привычке, померьте.
ОТДЕЛЬНЫЙ СЛУЧАЙ — где ядру не хватает миллиарда шагов: distributed.flang и
bounded.flang без ключа не печатаются ВОВСЕ («ядро доказательства
прекращено» через 110 с), с ключом печатаются за 4,4 с.
ЧЕГО ОН НЕ ДАЁТ — а это важнее того, что даёт:
  * НАПЕЧАТАННОЕ ЭТИМ КЛЮЧОМ НЕ ГОДИТСЯ В СТВОЛ. Отпечаток семени не сойдётся
    («scripts/seed-fingerprint»), а собранный из такого семени двоичный толще
    и поведёт СЛЕДУЮЩУЮ печать медленнее — то есть беда переезжает дальше
    самого семени. Перепечатка семени идёт БЕЗ этого ключа, всегда;
  * доказательств никто не проверял. Ложное доказательство ядро ловит, а без
    ядра оно проходит молча — прогоните «flang check», прежде чем верить;
  * быстрее становится ПЕЧАТЬ, а не напечатанное. Постусловия уезжают в код
    все до одного, включая доказанные, которые печать с ядром снимает: список
    снимаемых считает то самое ядро. Напечатанное толще и на работе медленнее
    (замер: сторожей на «flang/stdlib/lists.flang» 67 против 29), но не
    слабее — лишний сторож стережёт то, что и так верно.
Это средство разработчика, а не замена перепечатке. Двоичный говорит всё то же
самое ВСЛУХ после каждой печати с ключом, чтобы ключ, уехавший в скопированный
рецепт, не стал привычкой за день.

«--no-postconditions» СНИМАЕТ СТОРОЖЕЙ В НАПЕЧАТАННОМ КОДЕ, А НЕ ПРОВЕРКУ.
Постусловие остаётся в исходнике, остаётся обещанием и судится этой же
командой: разбор, типы, завершаемость и ядро доказательств идут как обычно, и
замечание по-прежнему отменяет печать кодом 1. «flang check» и «flang test»
ключа не знают вовсе — они считают постусловия ВСЕГДА.
ЗАЧЕМ. Постусловие пересчитывается на КАЖДОМ возврате. Замер 2 сентября 2026,
раскладка терминального экрана (19 функций, 25 обещаний, цель go, кадр целиком,
«go test -benchtime 200x -count 5», медиана пяти, AMD EPYC 7742):
  кадр  80×24     42,6 мс со сторожами →  6,00 мс без них   в 7,1 раза
  кадр 200×50    100,0 мс              → 14,6 мс            в 6,9 раза
  выделений на кадре 200×50: 151 226 → 29 354
  напечатанного кода на Go: 1862 строки → 1303, сторожей rt.Post 23 → 0
Кадр перерисовывается не только по такту, но и на каждое нажатие клавиши и на
каждый SIGWINCH; 15 мс не видно, 100 мс видно. На программе, которую зовут раз
в час, ключ не нужен — померьте, прежде чем брать.
СВЕРЕНО, ЧТО СНЯТИЕ НЕ МЕНЯЕТ ЗНАЧЕНИЙ: 1119 входов на трёх функциях той же
раскладки, печать с ключом против печати без него — расхождений нет. И то, что
печатает ключ, совпало БАЙТ В БАЙТ с печатью исходника, из которого строки
«обеспечивает» вырезаны руками.
ВСЕ ВОСЕМЬ ЦЕЛЕЙ ВЕДУТ СЕБЯ ОДИНАКОВО: постусловия снимаются с разобранной
программы до того места, где цели расходятся, — печатнику про ключ знать
нечего.
НАПЕЧАТАННОЕ ГОВОРИТ О КЛЮЧЕ САМО. В шапку каждого файла кладётся заметка:
ключ, число снятых сторожей и то, что обещания проверяются на воротах, а не
здесь. Молча отдать облегчённый код нельзя — тот, кто взял его в руки, обязан
узнать об этом из него. Без заметки остаются два файла, где её негде
поставить: «go.mod» (шапки нет вовсе) и «flang.csproj» (XML-комментарий не
терпит двух дефисов подряд, а имя ключа их содержит).
ЧЕГО КЛЮЧ НЕ СНИМАЕТ: предусловия, сторожа убывания у тотальных функций,
пределы шагов и глубины, разбор отказов надзора.
ПЕРЕПЕЧАТКОЙ СЕМЕНИ ЭТО НЕ ПОЛЬЗУЮТСЯ: компилятор собирают со сторожами,
довод тот же, что у «--no-check».

РАНТАЙМ ЦЕЛИ уезжает в вывод ДОСЛОВНО, поэтому читается с диска: от двух
файлов у go, rust, js и python до шести у java и csharp, у cpp четыре (три
из них рантайм «c»). Ищутся они в
«--runtime», затем в $FLANG_RUNTIME_DIR, затем рядом с установленным flang
(share/flang/<цель>); в дереве исходников это flang/src/emit/<цель>. Полный
перечень имён — man flang.

СВЕРХУ УЖЕ СКАЗАНО, ЧТО ПЕЧАТАЕТСЯ ТОЛЬКО ПРОВЕРЕННОЕ, и это правда: типы и
завершаемость печать судит и при замечании отменяется. Проверено прогоном
25 августа 2026: функция, объявленная как «число», с телом-строкой даёт
FLANG_TYPE, «печать отменена», код 1 и ни одного файла.

ЧЕМ ЭТА ПЕЧАТЬ ОТЛИЧАЕТСЯ ОТ ПЕЧАТИ ПОЛНОГО ИНСТРУМЕНТАРИЯ:
  c            недостижимое НЕ отбрасывается, доказанное не метится
               («markProven»); напечатанного просто больше, работает так же;
  все прочие   недостижимое отбрасывается, как у свидетеля.

У ВСЕХ ДЕВЯТИ ПУСТА ГРАНИЦА ВХОДА: таблицу объявленных типов строит слой
типов свидетеля, которого на flang нет ни строки. Напечатанное собирается и
работает, но аргументы прогонщика объявленным типам не сверяются, и об этом
сказано словами после печати.

Невтащенных целей больше нет: все десять живут в замыкании этой сборки, и
печатает их она сама, без Node.
```

### `flang ast --help`

```text insert output: ast --help
$ flang ast --help
flang ast <файл.flang> [--pretty]

Печатает разобранную и СВЯЗАННУЮ программу деревом в JSON — то же самое, что
видит печать в целевой язык. Связывание здесь не украшение: без него у
программы с «использует … из "…"» дерево вышло бы неполным, и первым признаком
стала бы не ошибка команды, а несобирающийся напечатанный код.

  --pretty   с отступами в два пробела

Проверок типов и завершаемости здесь нет НАМЕРЕННО: дерево — это то, что
прочитано, а не то, что признано годным. Отказывает команда только на том, из
чего дерева не выходит вовсе, — на разборе и на связывании.
```

### `flang tokens --help`

```text insert output: tokens --help
$ flang tokens --help
flang tokens <файл.flang> [--json] [--pretty]
flang tokens --keyword «фраза»

Печатает поток токенов — то, что прочитал ЛЕКСЕР, до разбора и до связывания.
Вопрос, ради которого команда есть, один: чем станет это слово, если его
написать. Грепом он не решается — ломает программу не текст, а токен: слово в
комментарии, слово внутри строкового литерала и имя в ёлочках ключевым словом
не становятся никогда.

  --json      машинный вид: те же ключи, что у «flang ast» — kind, value, text,
              quoted и span со строкой и столбцом
  --pretty    с отступами в два пробела; машинный вид включает сам
  --keyword «фраза»   ключевое ли это слово: имя конструкции или отказ. Фраза
              из нескольких слов проверяется как фраза — «код символа» лексер
              отдаёт ОДНИМ токеном, а «элемент или беда» тремя, и формой языка
              вторая не является

Связывания здесь нет, в отличие от «flang ast»: токены файла от подключений не
зависят вовсе. Отказ бывает там же, где отказал сам лексер, — незакрытый
литерал, рваный отступ; тогда код 1, а машинный вид всё равно печатается, с
пустым tokens и заполненным diagnostics.
```

### `flang lint --help`

```text insert output: lint --help
$ flang lint --help
flang lint [<путь>…] [--max-line-length N] [--max-conditional-depth N]
                     [--warn | --refuse] [--tsv]

Меряет исходники и планы flang двумя мерами: длину строки в знаках и
глубину ветвлений в теле функции. Каталог обходится целиком, кроме имён с
точкой в начале; без путей — рабочий каталог. Файл не исходник — пропущен.

  --max-line-length N        предел длины строки в знаках
  --max-conditional-depth N  предел глубины: сколько «если» и «разбор»
                             вложено друг в друга в теле функции
  --warn                     назвать нарушения и ответить нулём
  --refuse                   назвать нарушения и ответить единицей
  --tsv                      машинный вид: строка на находку, поля через
                             табуляцию, без итоговой строки

Те же пределы — ключи «.flangrc»: max-line-length, max-conditional-depth и
lint = refuse|warn. Ключ команды старше файла проекта, файл проекта старше
файла дома. Предела нет нигде — мера не применяется.

Коды: 0 — нарушений нет или сказано «warn»; 1 — нарушения есть; 2 — плохой
вызов, нет пути или негодное значение в «.flangrc»; 3 — нарушений нет, но
часть файлов не разобралась, и глубина в них не измерена.
```

### `flang facts --help`

```text insert output: facts --help
$ flang facts --help
flang facts <файл.flang> --claims '["…"]' [--facts факты.json] [--steps N] [--pretty]

Проверяет утверждения на фактах — то, ради чего язык написан. Утверждение
имеет вид «<что-то> <оператор> <что-то>»; слева бывает факт, поле факта или
вызов функции от фактов, справа — то же самое или литерал.

  --facts файл    факты JSON-объектом (без ключа — фактов нет)
  --claims '[…]'  что проверять, JSON-массивом строк
  --steps N       предел шагов вычисления (по умолчанию 10000)
  --pretty        JSON с отступами

КОД 1 ЗДЕСЬ ЗНАЧИТ «ОПРОВЕРГНУТО», а не «сломалось»: вердикт всё равно уходит
в stdout, и код нужен, чтобы на нём падал CI. Код 2 — отказ вызова: не назван
файл, не разобран JSON, не связалась программа.

Вызов зовётся ТОЛЬКО у функции, чьё завершение доказано: нетотальная даёт
отказ до всякого вычисления. Упирание в предел шагов — тоже ответ, «не
досчитали за отведённый бюджет», а не сбой инструмента.
```

### `flang io --help`

```text insert output: io --help
$ flang io --help
flang io <файл.flang> [--plan «Имя»] [--max-orders N] [--seed N] [--in-dir] [--pretty]
                      [--timeout МС] [--trust] [--unproven refuse|warn|allow] [-- довод…]

Исполняет ПЛАН — единственное место языка, где программа встречается с миром.
Встречается не сама: каждый шаг возвращает ОПИСАНИЕ действия, а делает его
хозяин. Поэтому все функции плана остаются тотальными и проверяются обычными
примерами — без файлов и без сети.

  --plan «Имя»    какой план исполнять, если их несколько
  --max-orders N  предел поручений за прогон (по умолчанию 10000)
  --seed N        семя случайности: прогон становится повторимым.
                  «Случайное число» без семени берёт /dev/urandom;
                  «Случайные октеты» берут его всегда, а под семенем
                  отказывают кодом FLANG_IO_ENTROPY
  --in-dir        запретить пути за пределы каталога входного файла
  --trust-roots Ф связка корней PEM для «https»; без ключа — системная
  --max-steps N   предел шагов вычисления на один виток
  --timeout МС    срок ТИШИНЫ процесса из «Запустить процесс», миллисекундами
                  (по умолчанию 30000): отсчёт от последнего байта в stdout
                  или stderr, а не от запуска. Молчит дольше — хозяин убивает
                  его и отвечает «Сбой» с кодом FLANG_IO_TIMEOUT. Свой срок
                  плана (поручение «Запустить процесс с пределом»)
                  этого срока НЕ отменяет: ждут оба, бьёт тот, что раньше
  --pretty        JSON с отступами
  --trust         исполнить недоказанный план: вердикт не считается вовсе, и
                  об этом говорится своей строкой. Кириллицей — «--на-веру»
  --unproven СЛОВО  что делать с недоказанным: refuse — не исполнять
                  (умолчание), warn — сказать и исполнить, allow — то же, что
                  «--trust». Кириллицей — «--недоказанное отказ |
                  предупреждение | разрешение». Раз и навсегда — ключ
                  «unproven» в «.flangrc» (docs/guide/settings.ru.md)
  --              ГРАНИЦА: всё, что стоит после этого отдельного довода, —
                  доводы ПЛАНА, а не ключи команды. Их отдаёт поручение
                  «Прочитать доводы» списком строк, в том же порядке и без
                  разбора. Ключи самого «flang io» в этот список не попадают
                  никогда, имени программы и имени файла плана в нём нет.
                  Нет «--» в строке — список пуст

Полномочия сужаются по одному: --no-read, --no-write, --no-net, --no-clock,
--no-random, --no-spawn, --no-env, --no-args, --no-screen. Умолчание —
«можно всё»: запуск программы этой командой и есть согласие на её действия.

КОДЫ ВОЗВРАТА — контракт. 0 — план дошёл до конца; 1 — ПРОГРАММА СДАЛАСЬ
САМА («Провал»), то есть нашла беду и назвала её; 2 — кривой вызов; 3 —
сломался инструмент ЛИБО программа сказала «Не проверено», то есть смотреть
ей было нечем. Первое и второе различает не код отказа, а то, КТО принял
решение; второе и третье — то, ЧТО решено: «нашёл беду» против «не смог
посмотреть». Тройкой же отвечает и ОТКАЗ ЗАПУСКА недоказанного плана: перед
работой считается вердикт о замыкании и одной строкой уходит в поток ошибок
(ADR-0045); «--trust» («--на-веру») его пропускает, «--unproven warn»
предупреждает и работает, а сказать это раз и навсегда можно ключом
«unproven» в «.flangrc». Негодное значение там — код 2, а не тишина.

Среду и доводы хозяин читает сам: «Прочитать переменную среды» отдаёт РОВНО
названную переменную («Значение среды»), а незаданную — отдельным откликом
«Переменной среды нет», а не пустой строкой; пустое имя — отказ FLANG_IO_ENV.
Среды целиком не отдаётся: вместе с ней уехали бы ключи и пароли, которых
план не спрашивал. Запрет — --no-env и --no-args, отказом FLANG_IO_DENIED.

ЭКРАН ДВОИЧНОГО — УПРАВЛЯЮЩИЙ ТЕРМИНАЛ (/dev/tty), и место у него ОДНО, оно
зовётся «экран»; всякое другое имя — отказ FLANG_IO_PLACE. «Показать» кладёт
«текст» целым кадром: очистка, потом текст. Пишется кадр в терминал, а НЕ в
stdout — там вердикт плана, и смешивать их нельзя. На первом «Показать»
хозяин уходит на запасной экран терминала и прячет курсор, а при завершении
прогона — удачном ли, по отказу ли — возвращает как было.

«Ждать событие» переводит терминал в посимвольный режим и ждёт нажатия не
дольше «срока» миллисекунд; срок 0 или неназванный — без предела. Пришла
клавиша — «Случилось» с «откуда» равным «клавиатура»; вышел срок — «Срок
вышел». Имена клавиш: ввод, пробел, таб, возврат, выход, вверх, вниз, влево,
вправо; прочее приходит самим знаком. CTRL-C ПРОДОЛЖАЕТ УБИВАТЬ ПРОГРАММУ и
в ожидании тоже: выход человеку программа не отнимает.

«Размер экрана» отдаёт «Экран» с «ширина» и «высота» — знаков в строке и
строк на экране. Нулевой или нечитаемый размер — отказ, а не 80×24: кадр по
выдуманной ширине рисуется молча и неверно.

Терминала нет — вывод уведён в трубу или в файл, CI, nohup — и все три
поручения отвечают FLANG_IO_NO_SCREEN, ровно как отвечали всегда.

«https» у «Запросить» исполняет САМ ДВОИЧНЫЙ: клиент TLS 1.3 на языке
(flang/stdlib/tls-client.flang), напечатанный в C и собранный в него; curl
не нужен. Беда сертификата — FLANG_IO_TLS_CERT, прочая — FLANG_IO_TLS, код
клиента первым словом. Корни — --trust-roots <PEM>, иначе системная связка.
ОТЗЫВ СЕРТИФИКАТА НЕ ПРОВЕРЯЕТСЯ. «Открыть соединение» — голый TCP.
UDP (IPv4): «Отправить датаграмму» и «Принять датаграмму» (ADR-0101).
```

### `flang lock --help`

```text insert output: lock --help
$ flang lock --help
flang lock <файл.flang> [--pretty]

Печатает ЗАМОК программы — JSON, в котором лежат САМИ зависимости, а не ссылки
на них: у каждого импортированного модуля записан его исходник целиком, а
адресом ему служит sha256 по этому исходнику. Склада нет вовсе — скачивать
неоткуда, потому что всё уже в замке; сжатия в формате нет тоже.

  flang lock программа.flang > flang.lock

Если рядом с входным файлом лежит flang.lock, все команды берут импорты ИЗ НЕГО
и исходников зависимостей не читают вовсе — их может не быть на диске. Замок
самозаверен печатью: испорченный замок — отказ FLANG_LOCK, а не тихая сборка из
чего попало. Обновляется замок целиком: в нём лежит код, а не хеш.

  --pretty   с отступами в два пробела

Входного модуля в грузе нет: замок отвечает на вопрос «из чего собрана эта
программа», а сама программа лежит рядом с ним.
```

### `flang package --help`

```text insert output: package --help
$ flang package --help
flang package <файл.flang> [--pretty]

Печатает ПАКЕТ — тот же груз, что в замке, плюс имя, версия, источник и
ведомость доказанного. Имя и версию команда берёт из объявления flang.package
рядом со входным файлом, а не из ключей вызова: ключ живёт в истории оболочки,
а объявление живёт в репозитории и попадает в «git diff».

  flang package strings.flang > strings.flang-package

Подключается пакет одной строкой и без новых слов в языке:

  использует «Строки» из "strings.flang-package"

Исходников зависимостей при этом на диске нет, склада нет, сети не надо: код уже
в файле. Испорченный пакет — отказ FLANG_PACKAGE. Двух версий одной библиотеки в
программе по-прежнему не бывает; два пакета, привезшие один путь с разным
содержимым, — тоже FLANG_PACKAGE, а не молчаливый выбор первого.

  --pretty   с отступами в два пробела

Пакет собирается ТОЛЬКО ИЗ ПРОВЕРЕННОГО: пакет — это обещание, а обещать за
непроверенное нельзя.
```

### `flang new --help`

```text insert output: new --help
$ flang new --help
flang new <имя> [--force]

Создаёт каталог <имя>/ с готовой структурой пакета одной командой: базовый
модуль с тотальной функцией и примером, каталог fspec/ с одной доказанной
спекой и стражем guard.flang, манифест flang.package и README.

  flang new проба
  cd проба
  flang check проба.flang
  flang io fspec/guard.flang

Имя пакета — без пробела, косой черты, обратной косой черты, кавычек и
гильемет, вне списка зарезервированных слов (имена команд бинарника,
«flang», «fspec») и не «.»/«..». Недопустимое имя — отказ FLANG_NEW,
код 2, и ни один файл не создаётся.

  --force   переписать каталог, если он уже существует. Кириллицей: --силой.
            Без ключа существующий каталог — отказ
            FLANG_NEW, код 1: команда не переписывает чужую работу молча.

Образец fspec/ команда берёт рядом с собой (<каталог двоичного>/../fspec)
или из FLANG_FSPEC_TEMPLATE_DIR; не нашла ни того ни другого — отказ
FLANG_NEW, код 1, и каталог не заводится вовсе.
```

### `flang run-script --help`

```text insert output: run-script --help
$ flang run-script --help
flang run-script [<имя> [доводы…]]

Короткая команда проекта: имя, за которым стоит строка оболочки. Записана она
в файле настроек «.flangrc» строкой «script.<имя> = <команда>»:

  script.site:build = node docs/site/build.mjs

  flang run-script                   перечень: имя и команда каждой
  flang run-script site:build        исполнить
  flang run-script version 0.7.23    доводы после имени уезжают команде

Файл — ближайший «.flangrc» от рабочего каталога вверх, по правилу остальных
настроек; файл дома коротких команд не даёт. Команду исполняет «/bin/sh -c» в
каталоге этого файла, и код возврата — её собственный. Одноимённых строк две —
берётся последняя. У строки из нескольких команд через «&&» доводы достаются
последней.

Имени в файле нет — код 2 и перечень; файла нет — код 2; оболочка не
запустилась — код 3.
```

### `flang repl --help`

```text insert output: repl --help
$ flang repl --help
flang repl [<файл.flang>] [--max-steps N] [--max-depth N]

Интерактивная оболочка — то же самое, что голая команда «flang» на терминале.
Объявления накапливаются в сессии, выражения вычисляются сразу, «.помощь»
показывает команды. Файл в аргументе загружается в сессию при запуске.

Выражение считается так: сессия печатается в C тем же способом, что у
«flang emit», собирается системным «cc» против lib/libcompiler_flang.a и
запускается. Нет «cc» — оболочка не выключается, а проверяет разбор, типы и
завершаемость и говорит об этом при запуске.
Где искать: FLANG_CC, FLANG_INCLUDE_DIR, FLANG_LIB_DIR.
```

### `flang lsp --help`

```text insert output: lsp --help
$ flang lsp --help
flang lsp [--stdio]

Языковой сервер flang по стандартному вводу-выводу: рамки Content-Length, тело
JSON, как требует спецификация LSP. Запускается редактором, а не человеком —
вручную он будет молча ждать сообщений.

Умеет то же, что «flang-lsp» из инструментария на Node, и ТЕМ ЖЕ СЛОЕМ
(«flang/self/lsp.flang»): диагностику той же дорогой, что «flang check» —
разбор, связывание, типы, завершаемость, — дополнение, наведение с подписью и
переход к объявлению.

Расхождение со свидетелем одно, и оно названо: у программы с «использует» беда
импортированного модуля уходит в журнал редактора, а не подчёркивается в его
буфере. «Место» (self/types.flang) поля файла не имеет, поэтому файл беды
называется тогда и только тогда, когда исходник один.

Печатать в stdout что-либо, кроме сообщений протокола, нельзя: редактор читает
оттуда рамки. Всё человеческое уходит в stderr.
```

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
