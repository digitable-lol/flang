# How the install was verified

Evidence for the [Installing](install.html) page: what was actually run, what it
answered, and what could not be checked. It is a separate page because someone
installing the language needs a command, not a QA report — but the report cannot
be thrown away either, or the word "verified" has nothing under it.

Everything below was run on one machine: `cc (Ubuntu 15.2.0-16ubuntu1) 15.2.0`,
`GNU Make 4.4.1`, `node v26.7.0`.

**This report was taken on release 0.5.1 and has not been re-run since.** The
numbers below are about that archive and that formula, not about the current
release: this is a record of a run, and swapping the version inside it would
pass the unchecked off as checked. What installs today is on
[Install](install.html). Of what is named here, since fixed: `make install` in
the archive, and the `runtime-c` directory that shipped without the traverse
bit.

## Release 0.5.1: archive, hash, formula, build

The release archive was downloaded: `flang-0.5.1-c.tar.gz`, **1,515,080 bytes**,
`sha256sum` — `ef2cbcbe…61de1`. It holds exactly **nine files**: `LICENSE`,
`Makefile`, `flang.1`, four `.c` and two `.h` — no `.o`, no prebuilt binary.

The published formula was downloaded separately: HTTP 200, 10,891 bytes. Its
`version` is `0.5.1`, its `url` points at release `v0.5.1`, and its `sha256`
matched the one computed over the downloaded archive character for character.

The archive was built with the flags the formula itself sets
(`-std=c99 -Wall -Wextra -Werror -pedantic -O2`): 78.2 s, not one warning, a
`flang` of 7,873,872 bytes, and `flang --version` answers `flang 0.5.1`.

**What could not be checked.** There is no `brew` in this environment
(`command -v brew` is empty). So everything only brew can do is unchecked:
parsing the formula as Ruby, `bin.install`, the build sandbox, `brew audit`.
Checked is exactly what is above: archive, hash, formula, and building the
archive with the formula's flags.

**The formula in this tree lags behind the published one.**
`packaging/homebrew/flang.rb` here still says `version "0.5.0"` with hash
`7dc75fec…`, while `digitable-lol/homebrew-tap` already carries 0.5.1. The
The check watches this the other way round — whether the copy in the tap has
fallen behind; here it is the original that has.

## Why 0.5.0 had to be replaced: it did not build on macOS at all

Not "installed badly" — did not build, for anyone. `flang_repl.c` declares
`_POSIX_C_SOURCE 200809L`: on glibc that line EXPOSES `mkdtemp`, on Darwin it
HIDES it — Apple's headers derive the visibility level from `__DARWIN_C_LEVEL`,
and a named `_POSIX_C_SOURCE` drops it to pure POSIX, where `mkdtemp` does not
appear. The build runs with `-Werror`, so an implicit declaration is a stop, not
a warning: `brew install digitable-lol/tap/flang` never finished on any Mac.

Evidence, not retelling: in the unpacked 0.5.0 archive the word
`_DARWIN_C_SOURCE` occurs **zero** times; in the 0.5.1 archive, **three** (the
explanation and two `#define`s under `__APPLE__`).

**What could not be checked.** There is no macOS machine in this environment,
and the red cannot be reproduced on Linux by anything: here the line works even
without the fix.

## asdf: eight versions listed, and installing 0.5.1 fails

The plugin's three scripts were run by hand with `PATH=/usr/bin:/bin` — that is,
**with Node physically absent from `PATH`**.

```
bin/list-all        → 0.4.1 0.4.2 0.4.4 0.4.5 0.4.6 0.4.7 0.5.0 0.5.1
bin/download 0.5.1  → nine files downloaded and unpacked
bin/install  0.5.1  → REFUSED
bin/download 0.5.0  →
bin/install  0.5.0  → "flang 0.5.0 установлен"
```

The version list comes from GitHub releases live, so 0.5.1 appeared in it by
itself. **0.4.8 is absent on purpose**: the release is real but has no asset, and
`asdf install flang 0.4.8` ended in a 404. The script selects on "an archive is
served", not on "a release exists".

The refusal on 0.5.1 looks like this:

```
cc … -o flang flang_cli.o flang_repl.o flang_runtime.o compiler_flang.o -lm -lpthread
install: No such file or directory
```

The build passed, the install did not. The published script runs
`install -m 0755 "${build}/flang_cli"`, while the `Makefile` in the 0.5.1
archive produces `flang`. The fix already exists in this tree —
`packaging/asdf/bin/install` accepts both names and additionally probes
`--version` and `--help` — but it has not been published to the plugin
repository, so what reaches a person today is the refusal.

After installing 0.5.0 the version directory holds four files: `bin/flang`,
`lib/libcompiler_flang.a`, `include/flang_runtime.h`,
`include/compiler_flang.h`.

**Installing from a branch is refused on purpose.** With `ASDF_INSTALL_TYPE=ref`
the script exits 1 and explains: in the repository the compiler is source
written in flang itself, and the first binary out of it comes from Node —
precisely the dependency the plugin exists to remove.

**What could not be checked.** Neither `asdf` nor `mise` is in this environment.
So everything asdf does around the scripts is unchecked: `plugin add`, version
resolution, shimming into `PATH`. About mise nothing at all was run — the line
about it on the install page rests on how the plugin is built, not on a
measurement.

## From source: a fresh clone holds no built file

**A fresh clone holds no built file, and a clone proves it.** `bootstrap/flang`
is in `.gitignore`,
`git ls-files bootstrap/` names eight files, and `git clone --depth 1` from
GitHub puts down exactly those: `Makefile`, `README.md`, four `.c`, two `.h`.
Nothing built.

The measurement was taken in that very clone:

| run | time | binary |
| --- | ---: | ---: |
| `make -C bootstrap -j4`, the tree's flags (with `-flto`) | 34.2 s | 7,831,160 bytes |
| one `cc` call over four `.c` (no `-flto`) | 83.5 s | 7,873,872 bytes |
| `make` in the unpacked 0.5.1 archive, the formula's flags (no `-flto`) | 78.2 s | 7,873,872 bytes |

Not one warning under `-Wall -Wextra -Werror -pedantic` in any of the runs. Time
drifts with machine load, bytes do not: the two runs without `-flto` gave the
same size to the byte, and only the `-flto` build differs from them.

`make -C bootstrap install PREFIX=…` into an empty prefix laid down four files:
`bin/flang`, `lib/libcompiler_flang.a`, `include/flang_runtime.h`,
`include/compiler_flang.h`. No man page among them: `flang.1` lives in
`packaging/`, not in `bootstrap/`, and the release script is what puts it into
the archive.

`./bootstrap/flang --version` in the clone answers `flang 0.5.0`, not `0.5.1`:
the `v0.5.1` tag is not merged into `main`, and `package.json` together with
`FLANG_VERSION` there is still 0.5.0. Hence the caveat on the install page: the
version is whatever the clone holds, not the latest release.

## Node: the git URL, the registry, and emit targets beyond C

`npm install ../flang` into a clean directory: **1 package added in 255 ms**,
zero dependencies — `package.json` has no `dependencies` or `devDependencies`
keys at all. It produced `node_modules/.bin/flang` and
`node_modules/.bin/flang-lsp`.

`npm install git+https://github.com/digitable-lol/flang.git` into an empty
project gives the same in 11 s. A previous run of that command failed with
"Could not read from remote repository": npm reaches git over ssh and there were
no keys on the machine. Today the keys are there and the command passes; on a
machine without keys it may fail again.

The difference between the binary and the Node package was measured with one
command on one file:

```
binary: flang emit проба.flang --target rust
        → "цели «rust» в этом бинарнике нет. Втащена одна — «c»"
Node:   ./node_modules/.bin/flang emit проба.flang --target rust
        → Cargo.toml, src/runtime.rs, src/lib.rs, src/main.rs
```

**The registry is shut from both sides.** `npm view @digitable-lol/flang version`
answers **E404**: nothing is published under the language's own name.
`npm view @digitable-lol/fts version` answers **0.4.7** — the old name, and it
lags behind the release.

## The binary has ten commands, not six

`./bootstrap/flang --help` names all ten, and `flang lock проба.flang` answers
with a JSON lock and exit code 0 — not a refusal pointing at "the full
toolchain", as one might expect. The help of
the binary and of the Node package list the same set of commands.

So the difference between the paths is exactly one thing, and it is about
emitting: the binary has the `c` target, the Node package has all
{{цели.поАнглийски}} ({{цели.список}}) plus the `flang-lsp` language server.

## Next

- [Installing](install.html) — the commands themselves
- [Your first program](getting-started.html) — write it, check it, run it
