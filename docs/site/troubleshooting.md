# Troubleshooting

On the left is what you see on the screen, then why it happens and what to
type. Messages are quoted verbatim.

## Installing and building

| Symptom | Cause | What to do |
| --- | --- | --- |
| `flang: command not found` after `make -C bootstrap` | the build puts the binary in `bootstrap/flang`, not on `PATH` | `sudo make -C bootstrap install`, or call `./bootstrap/flang` |
| `flang: command not found` after the one-line install | `~/.local/bin` is not on `PATH` | add `export PATH="$HOME/.local/bin:$PATH"` to your shell profile |
| `cc: command not found` when building from a clone | no C compiler | `sudo apt install build-essential` (Fedora — `sudo dnf install gcc make`, Alpine — `apk add build-base`, macOS — `xcode-select --install`) |
| `make: command not found` when building from a clone | `make` is not installed | build with one call to `cc` — [Installing](install.html#from-source) |
| `flang --version` does not answer `flang <version>` | LLVM Flang, the Fortran compiler with the same name, comes first on `PATH` | put the directory of our `flang` first on `PATH`, or call it by full path |
| The shell answers `вычислять нечем: не найден libcompiler_flang.a` | the binary is installed without the library, so expressions cannot be evaluated | name the directory with `libcompiler_flang.a` in `FLANG_LIB_DIR` and the one with the headers in `FLANG_INCLUDE_DIR` |

## The check answers about something else

| Symptom | Cause | What to do |
| --- | --- | --- |
| `место указано строкой и столбцом, но без файла` | several files were checked together with the imports. A failure in an imported module carries the path in its text: `в файле …/neighbour.flang:`; a failure without a path is in your file | check the named module on its own: `flang check neighbour.flang` |
| `FLANG_IMPORT_NOT_FOUND: не найден модуль «Имя»: ни рядом с файлом, ни выше по каталогам, ни в библиотеке компилятора` | the search by module name found no file — or found one that does not pass the check | name the path: `использует «Имя» из "path/file.flang"`; then check that module itself |
| `не проверено — … не печатается у программы с замечаниями` | `check --proof` prints the proof report only for a program without failures | fix the failures printed above that line |
| `FLANG_RECURSION_LIMIT` from `flang check` on a large file | the checker ran out of its step limit | `flang check file.flang --step-limit N` |
| Exit code 5 | the run hit the memory limit (three quarters of the machine's memory by default) | `--memory-limit N`, for example `--memory-limit 16G` |

## `run` or `io` refuses to start the program

```
не доказано: … — запуск только по явному согласию: --trust
```

Exit code 3. Before running, `flang run` and `flang io` check the proofs and do
not start a program whose guarantees are not proved or that has failures. The
line names the first failure.

| You want | Type |
| --- | --- |
| To see every failure | `flang check file.flang` |
| To run anyway, once | `--unproven warn` warns and runs; `--trust` runs without checking the proofs |
| To run anyway, always | `unproven = warn` in `.flangrc` |

## A run hits a limit

| Symptom | Cause | What to do |
| --- | --- | --- |
| `FLANG_RECURSION_LIMIT: функция «Имя» исчерпала лимит шагов (N) на глубине вызовов M`, exit code 1 | the evaluation ran out of steps | `--max-steps N` on `run`, `test`, `io` |
| `FLANG_RECURSION_LIMIT: функция «Имя» превысила предел глубины вызовов (N) на глубине M` | the call depth limit is reached | `--max-depth N`, or better, rewrite the recursion as a fold |
| The plan stopped before its end | `flang io` allows 10,000 orders per run | `--max-orders N` |

To see the message on a tiny limit:

```bash
flang run docs/examples/rosetta/factorial.flang --function 'Факториал' --args '{"н":30}' --max-steps 3
```

```
доказано: утверждений 0
FLANG_RECURSION_LIMIT: функция «Факториал» исчерпала лимит шагов (3) на глубине вызовов 1
```

Exit code 1.

## Emitting a program with processes is refused

The process scheduler is not emitted into every target:

| Target | What happens |
| --- | --- |
| `c`, `elixir`, `js`, `ts` | the scheduler is emitted, exit code 0 |
| `cpp`, `csharp`, `go`, `java`, `python`, `rust` | the emit is refused, exit code 1, no file is written |

The refusal looks like this:

```
flang emit: печать отказала — у цели «go» нет планировщика конкурентности, а в программе
объявлена конкурентность (процессов 3, надзоров 1, прогонов 3), первый — процесс «Приёмная».
```

Emit such a program to `c`, `elixir`, `js` or `ts`:

```bash
flang emit your-file.flang --target elixir --out ./out
```

## The language server in the editor

| Symptom | Cause | What to do |
| --- | --- | --- |
| The editor is configured, but there are no hints or underlines | the editor cannot start `flang lsp`: the binary is not on `PATH` | check the server command in the editor settings — [Editor setup](editor.html) |
| No highlighting in Emacs | highlighting exists only for Vim, Neovim and VS Code | diagnostics come from the server or from `flang check` on a key — see the same page |

To check that the server answers:

```bash
printf 'Content-Length: 75\r\n\r\n{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{}}}' | flang lsp --stdio
```

The server is alive if it prints `Content-Length: …` and an answer with
`"capabilities"`.

Next: [Failure reference](diagnostics.html) — every `FLANG_…` code and how to
fix it; [Installing](install.html).
