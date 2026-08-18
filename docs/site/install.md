# Installing

Four paths. Everything below was run on 18 August 2026 on this machine:
`cc (Ubuntu 15.2.0-16ubuntu1) 15.2.0`, `GNU Make 4.4.1`, `node v26.7.0`.
How each path was checked: [How the install was verified](install-evidence.html).

| Path | What you get | Needed on the machine |
| --- | --- | --- |
| [Homebrew](#homebrew) | `flang` 0.5.0, `man flang` | `brew`, `cc`, `make` |
| [asdf / mise](#asdf-and-mise) | `flang` 0.5.0 alongside other versions | `asdf` or `mise`, `cc`, `make` |
| [From source](#from-source) | `bootstrap/flang_cli` from this tree | `git`, `cc`, `make` |
| [Node: the reference implementation](#node-the-reference-implementation) | eight emit targets, laws, language server | Node ≥ 20 |

The first three paths give the same binary: five commands — `check`, `run`,
`test`, `emit --target c`, `repl`. The fourth installs the reference
implementation on Node, which has more commands and more emit targets.

## Homebrew

```bash
brew install digitable-lol/tap/flang
```

You get `flang 0.5.0` and the `man flang` page. Node is not needed: the release
archive already contains emitted C99.

`brew` itself was not run in this environment — what was checked is the formula
(`digitable-lol/homebrew-tap`, file `Formula/flang.rb`), its `sha256`, and the
release archive.

## asdf (and mise)

```bash
asdf plugin add flang https://github.com/digitable-lol/asdf-flang.git
asdf install flang 0.5.0
asdf global flang 0.5.0
```

You get four files — `bin/flang`, `lib/libkompilyator_flang.a`,
`include/flang_runtime.h`, `include/kompilyator_flang.h` — and
`flang --version` answers `flang 0.5.0`.

mise takes the same plugin:

```bash
mise plugin add flang https://github.com/digitable-lol/asdf-flang.git
```

The plugin offers seven versions: 0.4.1, 0.4.2, 0.4.4, 0.4.5, 0.4.6, 0.4.7,
0.5.0. The list is spelled out in full on purpose: **0.4.8 is missing from it**.
That release is real, but it has no archive, and `asdf install flang 0.4.8` ended
in a 404.

`asdf` itself (and `mise`) was not run in this environment — what was checked is
the plugin's three scripts, the ones asdf calls.

## From source

```bash
git clone https://github.com/digitable-lol/flang.git
cd flang
make -C bootstrap -j4
```

You get `bootstrap/flang_cli` — 7 127 856 bytes, built from four C99 files in
40.6 s, with no warning at all under `-Wall -Wextra -Werror -pedantic`.

If the machine has no `make`, one `cc` call is enough:

```bash
cd bootstrap
cc -std=c99 -O2 -o flang \
   flang_cli.c flang_repl.c flang_runtime.c kompilyator_flang.c -lm -lpthread
```

Build in a fresh clone: `bootstrap/` arrives from the repository with
`flang_cli` and `*.o` already built, and `make` goes by file times — in a tree
where a build has happened it answers "nothing to be done" and leaves the **old**
binary in place.

## Node: the reference implementation

This path is not for writing in the language: everything you need in order to
write and check is done by the binary from the first three paths. It is for
those **developing the language itself**, or calling it from their own Node
code.

```bash
git clone https://github.com/digitable-lol/flang.git
cd my-project
npm install ../flang
```

You get `node_modules/.bin/flang` and `node_modules/.bin/flang-lsp`; the package
has zero dependencies of its own. From here you also get the other **seven**
emit targets (`csharp`, `elixir`, `go`, `java`, `js`, `python`, `rust`), law
checking on a grid, violation search by running examples, and the language
server — the binary has none of that.

Install from the clone, not from the registry: `npm view @digitable-lol/fts
version` answers `0.4.7`, so the registry lags behind release 0.5.0.

## Next

- [Your first program](getting-started.html) — write it, check it, run it
- [Tutorial](tutorial.html) — from the first function to a claim proved by the kernel
- [How the install was verified](install-evidence.html) — runs, hashes, sizes
- [Operations](operations.html) — what does what
