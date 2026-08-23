# Installing

Latest release — **{{выпуск.версия}}**
([release on GitHub](https://github.com/digitable-lol/flang/releases/latest)).

| Path | What it installs | Needed on the machine |
| --- | --- | --- |
| [Homebrew](#homebrew) | `flang {{выпуск.версия}}` and `man flang` | `brew`, `cc`, `make` |
| [asdf](#asdf) | `flang` alongside other versions | `asdf`, `cc`, `make` |
| [From source](#from-source) | the `flang` command from a clone | `git`, `cc`, `make` |
| [With npm](#with-npm) | `flang` and `flang-lsp` inside a Node project | Node ≥ 20, `cc`, `make` |

All four paths give THE SAME binary and the same set of abilities: the fourth
puts it in the project's `node_modules/.bin`, the other three into the system.
Emitting to other languages, the language server, checking and proofs are there
on any of the four — pick a path by what your machine has, not by what you
intend to do. It has twelve commands —
`check`, `test`, `run`, `emit`, `ast`, `tokens`, `facts`, `io`, `lock`,
`package`, `repl`, `lsp` — and the bare `flang` command opens a shell, like
`python` or `iex`. It emits to all {{цели.поАнглийски}} targets, and it carries
its own language server: `flang lsp --stdio`.

## Homebrew

```bash
brew install digitable-lol/tap/flang
```

Installs `flang {{выпуск.версия}}`, `libcompiler_flang.a`, the headers and the
`man flang` page. Node is not needed: the release archive ships ready C99.

## asdf

```bash
asdf plugin add flang https://github.com/digitable-lol/asdf-flang.git
asdf install flang {{выпуск.версия}}
asdf set -u flang {{выпуск.версия}}
```

WARNING, measured on 23 August 2026. The asdf plugin lives in a separate
repository, `digitable-lol/asdf-flang`, and a fix in this tree does not reach
you until it is copied there. The guard `scripts/plagin-asdf-opublikovan.flang`
compares the published plugin against `packaging/asdf` by git object names, and
today it answers: **2 differences across 4 files** — `bin/install` and
`README.md`. The install fix is in the tree and NOT published.

While that holds, `asdf install flang {{выпуск.версия}}` fails with the
published plugin: its `bin/install` looks for a file under the old name. The
paths that work today are Homebrew and from source; they give the same binary.

Installs `bin/flang`, `lib/libcompiler_flang.a` and two headers into the
version directory. The third line is `asdf set`, not `asdf global`: `global`
and `local` were removed in asdf 0.16.0.

The same plugin works with mise: `mise plugin add flang https://github.com/digitable-lol/asdf-flang.git`.

## From source

```bash
git clone https://github.com/digitable-lol/flang.git
cd flang
make -C bootstrap -j4
sudo make -C bootstrap install        # or PREFIX=$HOME/.local, without sudo
```

Installs the `flang` command, `libcompiler_flang.a` and two headers; to
remove it, `make -C bootstrap uninstall`. The version is whatever the clone
holds, not the latest release. There is no `man` page on this path: `flang.1`
ships only in the release archive.

If the machine has no `make`, one `cc` call is enough:

```bash
cd bootstrap
cc -std=c99 -Wall -Wextra -Werror -pedantic -O2 -o flang \
   flang_cli.c flang_repl.c flang_runtime.c compiler_flang.c -lm -lpthread
```

## With npm

The path for exactly one thing: putting `flang` inside a Node project next to
its other tooling, and getting the language server where an editor for such a
project looks for it.

npm ADDS NOTHING for emitting to other languages: `flang emit --target …`
emits to all {{цели.поАнглийски}} targets on any of the four paths, and Node is
needed on none of them. If flang is not called from your own Node code, this
path gives you nothing — take Homebrew or the source.

```bash
npm install git+https://github.com/digitable-lol/flang.git
```

Installs `node_modules/.bin/flang` and `node_modules/.bin/flang-lsp`. The
package has no dependencies of its own, but `cc` and `make` are needed on the
machine: on install the package BUILDS the same binary compiler from the C99 it
carries (`packaging/postinstall.mjs`) instead of shipping a second
implementation in JavaScript. Until 20 August 2026 it shipped one — and it
disagreed with the binary on 54 calls out of 59.

Not available from the npm registry yet: nothing is published under the name
`@digitable-lol/flang`.

## Next

- [Your first program](getting-started.html) — write it, check it, run it
- [Tutorial](tutorial.html) — from the first function to a claim proved by the kernel
- [Operations](operations.html) — what does what
- [How the install was verified](install-evidence.html) — runs, hashes, sizes
  and what could not be checked
