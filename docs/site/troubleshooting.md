# Troubleshooting

On the left is what you see on screen, then why it happens and what to type.
Every command here was run against this compiler; messages are quoted verbatim
(the compiler speaks Russian).

## Installing and building

| Symptom | Cause | What to do |
| --- | --- | --- |
| `flang: двоичный компилятор не собран — его не собрали при установке`, exit code 3 | the package builds the compiler from C99 at install time, and the machine has no `cc` or no `make` | `sudo apt install build-essential` (Fedora — `sudo dnf install gcc make`, Alpine — `apk add build-base`, macOS — `xcode-select --install`), then `npm rebuild @digitable-lol/flang` |
| `make: command not found` when building from a clone | `make` is only there to compile four C files | build with a single `cc` call — the command is below |
| `asdf install flang` refuses: the archive holds a different file name | the asdf plugin lives in a separate repository and lags behind the tree | `brew install digitable-lol/tap/flang`, or build from source |
| The built `flang` is not found | `make -C bootstrap` puts it in `bootstrap/flang`, not on `PATH` | `sudo make -C bootstrap install`, or call `./bootstrap/flang` |

Building without `make` is one call to the C compiler:

```bash
cd bootstrap
cc -std=c99 -Wall -Wextra -Werror -pedantic -O2 -o flang \
   flang_cli.c flang_repl.c flang_runtime.c compiler_flang.c -lm -lpthread
```

## The check does not answer, or answers about the wrong thing

| Symptom | Cause | What to do |
| --- | --- | --- |
| `flang check` on a big file thinks for a while and ends with `FLANG_RECURSION_LIMIT` | the step budget is one for the whole command, and `check` has no key that raises the limit | check one file at a time and split the module into smaller ones |
| `flang check` names a line and column that do not exist in your file | the trouble lives in an imported module, and the diagnostic carries no file name | check every imported module with its own command |
| "замечаний 1" and not a word about postconditions: `--proof` prints nothing | the check stopped at the first trouble — it never reached the postconditions, and the claims were not judged at all | fix the trouble; while it stands, "proved" means nothing |
| `FLANG_IMPORT_NOT_FOUND: не найден модуль «Имя»: ни рядом с файлом, ни выше по каталогам, ни в библиотеке компилятора` | the lookup by module name alone found no file | give the path outright: `использует «Имя» из "path/file.flang"` |
| `flang emit` exited with code 3 and the files are written | the program declares processes, supervision or the categorical surface — the binary does not judge those | this is not a refusal to emit: judge such a program by its examples (`flang test`) |

Trouble in an imported module looks like this — line 7 belongs to the
neighbouring file, not to the one you checked:

```
FLANG_UNKNOWN_NAME, строка 7, столбец 17: имя «неизвестное» не связано
```

The cure is to check one file at a time:

```bash
flang check neighbour.flang
```

## A plan run hits a limit

| Symptom | Cause | What to do |
| --- | --- | --- |
| `FLANG_RECURSION_LIMIT: функция «Имя» исчерпала лимит шагов (10000000) на глубине вызовов N`, exit code 1 | `flang io` allows 10,000,000 steps per turn by default | raise it: `flang io plan.flang --max-steps 100000000` |
| `FLANG_RECURSION_LIMIT: функция «Имя» превысила предел глубины вызовов (10000)` | the call depth limit is 10,000 | `--max-depth N`, or better, rewrite the recursion as a fold |
| The plan stops early and names no trouble | the default budget is 10,000 orders per run | `--max-orders N` |

To see that the message is exactly this one, force it with a tiny limit:

```bash
flang run examples/rosetta/factorial.flang --function 'Факториал' --args '{"н":30}' --max-steps 3
```

It prints `FLANG_RECURSION_LIMIT: функция «Факториал» исчерпала лимит шагов (3)
на глубине вызовов 1` and exits with code 1.

## Processes after emitting into another language

The scheduler is **not** emitted into every target. A program with processes
behaves differently depending on where you emitted it:

| Target | What happens |
| --- | --- |
| `js`, `elixir` | the scheduler is emitted, processes run |
| `go`, `rust`, `java` | emitting refuses outright, exit code 1, not a single file written |
| `c`, `python`, `csharp` | files are written, but there is no scheduler beside them: the handler became an ordinary function that nobody calls |

The refusal for `go` reads verbatim:

```
flang emit: печать отказала — у цели «go» нет планировщика конкурентности, а в программе
объявлена конкурентность (процессов 2, надзоров 1, прогонов 3), первый — процесс «Работник».
```

What to do: emit a program with processes into `elixir` or `js`.

```bash
flang emit your-file.flang --target elixir --out ./output
```

## The language server stays silent in the editor

| Symptom | Cause | What to do |
| --- | --- | --- |
| The editor is configured, the server is running, and there are no hints or squiggles | while standard input is open the server sends no bytes, and an editor never closes input | bind `flang check %` to a key — [Setting up your editor](editor.html) |
| `flang lsp: неразобранный JSON, сообщение пропущено` on the error stream | the client escaped non-ASCII as `\uXXXX`, and the server does not parse those sequences | send the body as plain UTF-8, unescaped |
| No highlighting in VS Code and Emacs | it was written for Vim and Neovim only | there it installs with one line, see the same page |

One command tells you whether the server is alive — it closes the input, so the
reply arrives:

```bash
printf 'Content-Length: 75\r\n\r\n{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{}}}' | flang lsp --stdio
```

Next: [Setting up your editor](editor.html) and [Installing](install.html).
