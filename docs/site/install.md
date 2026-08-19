# Installing

Latest release — **0.5.1**, commit `6d845f9`
([release on GitHub](https://github.com/digitable-lol/flang/releases/tag/v0.5.1)).

| Path | What it installs | Needed on the machine |
| --- | --- | --- |
| [Homebrew](#homebrew) | `flang 0.5.1` and `man flang` | `brew`, `cc`, `make` |
| [asdf](#asdf) | `flang` alongside other versions | `asdf`, `cc`, `make` |
| [From source](#from-source) | the `flang` command from a clone | `git`, `cc`, `make` |
| [With npm](#with-npm) | `flang` and `flang-lsp` for a Node project | Node ≥ 20 |

The first three paths give the same binary. It has ten commands — `check`,
`test`, `run`, `emit`, `ast`, `facts`, `io`, `lock`, `package`, `repl` — and
the bare `flang` command opens a shell, like `python` or `iex`. It emits to C
only; all {{цели.поАнглийски}} emit targets and the language server come from
the fourth path.

## Homebrew

```bash
brew install digitable-lol/tap/flang
```

Installs `flang 0.5.1`, `libkompilyator_flang.a`, the headers and the
`man flang` page. Node is not needed: the release archive ships ready C99.

## asdf

```bash
asdf plugin add flang https://github.com/digitable-lol/asdf-flang.git
asdf install flang 0.5.1
asdf set -u flang 0.5.1
```

Installs `bin/flang`, `lib/libkompilyator_flang.a` and two headers into the
version directory. The third line is `asdf set`, not `asdf global`: `global`
and `local` were removed in asdf 0.16.0.

**0.5.1 does not install this way today.** The published plugin looks for the
old file name `flang_cli`, while the 0.5.1 build produces `flang`: the build
succeeds and the install fails on the last step. Until the fix is published,
asdf installs 0.5.0.

The same plugin works with mise: `mise plugin add flang https://github.com/digitable-lol/asdf-flang.git`.

## From source

```bash
git clone https://github.com/digitable-lol/flang.git
cd flang
make -C bootstrap -j4
sudo make -C bootstrap install        # or PREFIX=$HOME/.local, without sudo
```

Installs the `flang` command, `libkompilyator_flang.a` and two headers; to
remove it, `make -C bootstrap uninstall`. The version is whatever the clone
holds, not the latest release. There is no `man` page on this path: `flang.1`
ships only in the release archive.

If the machine has no `make`, one `cc` call is enough:

```bash
cd bootstrap
cc -std=c99 -Wall -Wextra -Werror -pedantic -O2 -o flang \
   flang_cli.c flang_repl.c flang_runtime.c kompilyator_flang.c -lm -lpthread
```

## With npm

The path for emitting a program into other languages, or calling flang from
your own Node code.

```bash
npm install git+https://github.com/digitable-lol/flang.git
```

Installs `node_modules/.bin/flang` and `node_modules/.bin/flang-lsp`: all
{{цели.поАнглийски}} emit targets ({{цели.список}}) and the language server.
The package has no dependencies of its own.

Not available from the npm registry yet: nothing is published under the name
`@digitable-lol/flang`.

## Next

- [Your first program](getting-started.html) — write it, check it, run it
- [Tutorial](tutorial.html) — from the first function to a claim proved by the kernel
- [Operations](operations.html) — what does what
- [How the install was verified](install-evidence.html) — runs, hashes, sizes
  and what could not be checked
