# If it does not work

What do you do when `flang` does not install, does not start or answers
something unclear? In the tables, the left column is what you see on the
screen, then the cause and what to type. Messages are quoted verbatim.

## Installing and building

| Symptom | Cause | What to do |
| --- | --- | --- |
| `flang: command not found` after `make -C bootstrap` | the build creates the program `bootstrap/flang` and does not add it to `PATH` | `sudo make -C bootstrap install`, or call it by the path `./bootstrap/flang` |
| `flang: command not found` after the one-line install | `~/.local/bin` is not on `PATH` | add `export PATH="$HOME/.local/bin:$PATH"` to your shell profile |
| `cc: command not found` when building from a clone | no C compiler | `sudo apt install build-essential` (Fedora — `sudo dnf install gcc make`, Alpine — `apk add build-base`, macOS — `xcode-select --install`) |
| `make: command not found` when building from a clone | `make` is not installed | build with one call to `cc` — [Installing](install.html#from-source) |
| `flang --version` does not answer `flang <version>` | LLVM Flang, the Fortran compiler with the same name, comes first on `PATH` | put the directory of our `flang` first on `PATH`, or call it by full path |

## The check reports on a different file

| Symptom | Cause | What to do |
| --- | --- | --- |
| `место указано строкой и столбцом, но без файла` ("the place is given by line and column, without a file") | several files were checked together with the imports. An error in an imported module comes with its path: `в файле …/neighbour.flang:`. An error without a path is in your file | check the named module on its own: `flang check neighbour.flang` |
| `FLANG_IMPORT_NOT_FOUND: не найден модуль «Имя»: ни рядом с файлом, ни выше по каталогам, ни в библиотеке компилятора` ("module not found") | the module file was not found by name, or was found and failed the check | give the path: `использует «Имя» из "path/file.flang"`; then check that module itself |
| `не проверено — … у программы с замечаниями` ("not checked — … for a program with errors") | `--proof` shows the proof report only for a file without errors | fix the errors named above that line |
| `FLANG_RECURSION_LIMIT` from `flang check` on a large file | the compiler ran out of its step limit | `flang check file.flang --step-limit N` |
| Exit code 5 | the memory limit is reached (three quarters of the machine's memory by default) | `--memory-limit N`, for example `--memory-limit 16G` |

## `run` or `io` does not start the program

The first line of the answer looks like this:

```text
не доказано: … — запуск только по явному согласию: --на-веру
```

Exit code 3. The line reads "not proved: … — runs only on explicit consent".
Before running, `flang run` and `flang io` check the proofs. They do not start
a program with an unproved postcondition or with a check error. The following
lines name each such postcondition. `--на-веру` is the Russian spelling of the
`--trust` flag.

| You want | Type |
| --- | --- |
| To see every error | `flang check file.flang` |
| To run once | `--unproven warn` warns and runs; `--trust` runs without checking the proofs |
| To run always | `unproven = warn` in the settings file `.flangrc` |

How to get a postcondition to "proved": [Your first proof](first-proof.html).

## A computation hits a limit

| Symptom | Cause | What to do |
| --- | --- | --- |
| `FLANG_RECURSION_LIMIT: функция «Имя» исчерпала лимит шагов (N) на глубине вызовов M`, exit code 1 | the computation ran out of steps | `--max-steps N` on `run`, `test`, `io` |
| `FLANG_RECURSION_LIMIT: функция «Имя» превысила предел глубины вызовов (N) на глубине M` | the call depth limit is reached | `--max-depth N`; rewriting the recursion as a fold is more reliable |
| `flang io` stopped before the end of the program | the limit is 10,000 effects per run | `--max-orders N` |

You can see the first message on a tiny limit. The command runs in a clone of
the repository:

```bash
flang run docs/examples/rosetta/factorial.flang --function 'Факториал' --args '{"н":30}' --max-steps 3
```

```text
доказано: утверждений 0
FLANG_RECURSION_LIMIT: функция «Факториал» исчерпала лимит шагов (3) на глубине вызовов 1
```

Exit code 1. The second line reads "function «Factorial» ran out of the step
limit (3) at call depth 1".

## Code generation fails for a program with processes

Not every target language has a process scheduler:

| Target language | What happens |
| --- | --- |
| `c`, `elixir`, `js`, `ts` | the code is generated, exit code 0 |
| `cpp`, `csharp`, `go`, `java`, `python`, `rust` | an error, exit code 1, no file is written |

The error message; the command runs in a clone of the repository:

```bash
flang emit docs/examples/service-on-processes/service.flang --target go --out ./out-go
```

```text
…
flang emit: печать отказала — у цели «go» нет планировщика конкурентности, а в программе
объявлена конкурентность (процессов 3, надзоров 1, прогонов 3), первый — процесс «Приёмная».
…
```

Exit code 1. The message reads "code generation failed — the target «go» has no
concurrency scheduler, and the program declares concurrency". For such a
program choose `c`, `elixir`, `js` or `ts`.

## The language server in the editor

| Symptom | Cause | What to do |
| --- | --- | --- |
| The editor is configured, but there are no hints or underlines | the editor cannot start `flang lsp`: the program `flang` is not on `PATH` | check the server command in the editor settings — [Editor setup](editor.html) |
| No highlighting in Emacs | highlighting exists only for Vim, Neovim and VS Code | errors come from the server or from `flang check` on a key — see the same page |

To check that the server answers:

```bash
printf 'Content-Length: 75\r\n\r\n{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{}}}' | flang lsp --stdio
```

```text
Content-Length: 311

{"jsonrpc":"2.0","id":1,"result":{"capabilities":{…},"serverInfo":{"name":"flang-lsp","version":"0.1.0"}}}
```

Exit code 0. The server works if the answer has `"capabilities"`.

Next: [Error codes](diagnostics.html) — every `FLANG_…` code and how to fix
it; [Installing](install.html).
