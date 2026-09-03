# Installing

Latest release — **{{выпуск.версия}}**
([release on GitHub](https://github.com/digitable-lol/flang/releases/latest)).

| Path | What it installs | Needed on the machine |
| --- | --- | --- |
| [Homebrew](#homebrew) | `flang`, the library, the headers, `man flang` | `brew`, `cc`, `make` |
| [asdf](#asdf) | `flang` alongside other versions | `asdf`, `cc`, `make` |
| [From source](#from-source) | `flang` from a clone | `git`, `cc`, `make` |

All three give the SAME binary. Emitting to all {{цели.поАнглийски}} targets, the
checks, the proofs and the language server (`flang lsp --stdio`) are there on
every path — pick by what the machine already has.

## Homebrew

```bash
brew install digitable-lol/tap/flang
```

Installs `flang`, `libcompiler_flang.a`, two headers and the `man flang` page,
served from the [`homebrew-tap`](https://github.com/digitable-lol/homebrew-tap)
repository. Node is not needed: the release archive carries ready C99.

## asdf

```bash
asdf plugin add flang https://github.com/digitable-lol/asdf-flang.git
asdf install flang {{выпуск.версия}}
asdf set -u flang {{выпуск.версия}}
```

Installs `bin/flang`, `lib/libcompiler_flang.a` and two headers into the version
directory. The third line is `asdf set`, not `asdf global`: `global` and `local`
were removed in asdf 0.16.0. The same plugin works with mise:
`mise plugin add flang https://github.com/digitable-lol/asdf-flang.git`.

Does not work: the plugin is published in a separate repository and lags behind
this tree, so `asdf install flang {{выпуск.версия}}` can end in a refusal —
until it catches up, take Homebrew or the source.

## From source

```bash
git clone https://github.com/digitable-lol/flang.git
cd flang
make -C bootstrap -j4
sudo make -C bootstrap install        # or PREFIX=$HOME/.local, without sudo
```

Lays down four files — `bin/flang`, `lib/libcompiler_flang.a`,
`include/flang_runtime.h`, `include/compiler_flang.h` — and says where:

```
поставлено: /usr/local/bin/flang — проверьте: flang --version
```

The version is whatever the clone holds, not the latest release. There is no
`man` page on this path: `flang.1` ships only in the release archive.

If the machine has no `make`, one `cc` call is enough:

```bash
cd bootstrap
cc -std=c99 -Wall -Wextra -Werror -pedantic -O2 -o flang \
   flang_cli.c flang_repl.c flang_runtime.c compiler_flang.c -lm -lpthread
```

## There is no npm path any more

There used to be a fourth one. It is gone as of 3 September 2026: the package,
the `bin` entries `flang` and `flang-lsp`, the `postinstall` build and the
publishing workflow were all removed. `npm install @digitable-lol/flang` never
worked — nothing was ever published under that name — and
`npm install git+https://github.com/digitable-lol/flang.git` no longer installs
any command, because the manifest declares none.

**Windows is what this costs.** `bin` in npm has to be a file Node can start,
which is the only reason those two launchers were JavaScript — and it was the
only install path this project ever offered Windows. Homebrew does not install
on Windows, and the source path wants `cc` and `make`. On Windows that means
MSYS2, WSL or another C99 toolchain; there is no native path. Nothing here was
ever tested on Windows either, so what is lost is a promise rather than a
working road — but it was the only promise there was.

The language server is unaffected: it is `flang lsp --stdio`, a subcommand of
the binary itself, on every path above.

## Checking the install

Three commands. Answers like these mean flang is in place.

```bash
flang --version
```

```
flang {{выпуск.версия}}
```

Put this in `hello.flang`:

```flang
module «Hello»
total function «Two»
  returns number
  2
```

```bash
flang check hello.flang
```

```
модуль «Hello»: функций 1, из них с доказанным завершением 1; типов 0
hello.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
```

Exit code 0. A file that does not pass answers `не проверено — замечаний N` and
exit code 1.

```bash
flang repl
```

```
flang {{выпуск.версия}} — оболочка. «.помощь» — команды, «.выход» или Ctrl-D — конец.
Объявление заканчивается пустой строкой, выражение вычисляется сразу.
» 2 plus 2
4
```

Ctrl-D leaves. If the shell answers `вычислять нечем: не найден
libcompiler_flang.a` instead of `4`, the binary is installed and the library is
not: put `libcompiler_flang.a` next to the binary, or point `FLANG_LIB_DIR` at
the directory holding it.

## Removing

| Path | Command |
| --- | --- |
| Homebrew | `brew uninstall flang` |
| asdf | `asdf uninstall flang {{выпуск.версия}}`, then `asdf plugin remove flang` |
| From source | `make -C bootstrap uninstall` — add the same `PREFIX=…` you installed with |

`make -C bootstrap uninstall` removes `bin/flang`, the library and the man page,
but LEAVES the two headers in `include/` — delete them by hand if the prefix has
to be empty.

## Built with flang

Four applications outside this repository, not examples but working code:

- **[flang-tui](https://github.com/digitable-lol/flang-tui)** — terminal screen layout in
  flang: strips, clipping by printable cells, stacking, tabs, scrolling. Printed to Go and C.
- **[digitdisk](https://github.com/digitable-lol/digitdisk)** — a disk and system overview for
  Linux: the rules are decided by a kernel written in flang, the system calls by a Go host.
- **[flang-ribbon](https://github.com/digitable-lol/flang-ribbon)** — window-ribbon arithmetic
  in flang: offsets, column width, window height, insertion, panes. Carried over from digitwm
  and checked to match it exactly on 526,871 inputs. Printed to C and to Go.
- **[flang-env](https://github.com/digitable-lol/flang-env)** — parsing environment values in
  flang: color depth, language, `NO_COLOR`. The rules are pure; reading the environment is left
  to the host.

## Next

- [Your first program](getting-started.html) — write it, check it, run it
- [Tutorial](tutorial.html) — from the first function to a claim proved by the kernel
