# Installing

Four paths. Everything below was run on 18 August 2026 on this machine:
`cc (Ubuntu 15.2.0-16ubuntu1) 15.2.0`, `GNU Make 4.4.1`, `node v26.7.0`.
How each path was checked: [How the install was verified](install-evidence.html).

| Path | What you get | Needed on the machine |
| --- | --- | --- |
| [Homebrew](#homebrew) | `flang` 0.5.0, `man flang` | `brew`, `cc`, `make` |
| [asdf / mise](#asdf-and-mise) | `flang` 0.5.0 alongside other versions | `asdf` or `mise`, `cc`, `make` |
| [From source](#from-source) | the `flang` command (`make -C bootstrap install`) | `git`, `cc`, `make` |
| [Node: the reference implementation](#node-the-reference-implementation) | eight emit targets, laws, language server | Node ≥ 20 |

The first three paths give the same binary, and the bare `flang` command in it
opens the shell — like `iex` for Elixir, like `python`. It has **six** commands:
`check`, `run`, `test`, `emit --target c`, `repl` and the shell itself.

**The fourth path gives twelve, and the difference is worth knowing up front.**
On top of the six, the reference on Node has `ast`, `facts`, `io`, `lock` and
`package`, and with them the other seven emit targets, the laws on a grid and the language
server. The binary does not keep quiet about it: `flang lock` is rejected with
exit code 2 and a line saying the command exists in the full toolchain — but the
language documentation promises those commands, and if you need them, you need
the fourth path.

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
asdf set -u flang 0.5.0
```

The third line is `asdf set`, not `asdf global`: `global` and `local` were
**removed** in asdf 0.16.0, and on any current asdf that line is an error. `-u`
writes the version into the home `.tool-versions` — exactly what `global` did.
On asdf older than 0.16 the old word still works.

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
sudo make -C bootstrap install        # or PREFIX=$HOME/.local, without sudo
```

**The program has one name — `flang`**, on this path too: `make` puts
`bootstrap/flang` next to the sources, and `make install` installs it as a
command together with `libkompilyator_flang.a`, the headers and the `flang.1`
man page (when it is next to them — it is in the release archive, not in the
repository tree). To remove it: `make -C bootstrap uninstall`. The build used to
produce `flang_cli` while brew and asdf installed the same file as `flang`: two
names for one program, and the guide taught the worse one.

Measured on a clean export (`git archive` into an empty directory): 13 324 277
bytes of emitted C and headers going in, `make -j4` — **34.3 s** and
**7 276 792 bytes**, with no warning at all under
`-Wall -Wextra -Werror -pedantic`.

If the machine has no `make`, one `cc` call is enough — **76.3 s**,
7 283 688 bytes:

```bash
cd bootstrap
cc -std=c99 -Wall -Wextra -Werror -pedantic -O2 -o flang \
   flang_cli.c flang_repl.c flang_runtime.c kompilyator_flang.c -lm -lpthread
```

Build in a fresh clone: `bootstrap/` arrives from the repository with `flang`
and `*.o` already built, and `make` goes by file times — in a tree where a build
has happened it answers "nothing to be done" and leaves the **old** binary in
place.

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

Install from the clone, not from the registry. The package is named
`@digitable-lol/flang` — the language's own name — and nothing has been
published under it yet: the registry answers 404. What is published is the old
name: `npm view @digitable-lol/fts version` answers `0.4.7`, which lags behind
release 0.5.0.

## Next

- [Your first program](getting-started.html) — write it, check it, run it
- [Tutorial](tutorial.html) — from the first function to a claim proved by the kernel
- [How the install was verified](install-evidence.html) — runs, hashes, sizes
- [Operations](operations.html) — what does what
