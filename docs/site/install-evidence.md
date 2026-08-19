# How the install was verified

Evidence for the [Installing](install.html) page: what was actually run, what it
answered, and what could not be checked. It is a separate page because someone
installing the language needs a command, not a QA report — but the report cannot
be thrown away either, or the word "verified" has nothing under it.

Everything was run on 18 August 2026 on one machine: `cc (Ubuntu
15.2.0-16ubuntu1) 15.2.0`, `GNU Make 4.4.1`, `node v26.7.0`.

## Homebrew: formula, hash and archive agree

The published formula was downloaded: HTTP 200, 10 314 bytes. Its `version` is
`0.5.0`, its `url` points at release `v0.5.0`, its `sha256` is `7dc75fec…d0505`.

The archive at that `url` was downloaded separately: HTTP 200, **929 817
bytes**, and `sha256sum` matched the formula character for character. The
archive holds exactly **9 files**: `LICENSE`, `Makefile`, `flang.1`, four `.c`
and two `.h` — no `.o`, no prebuilt binary.

The body of the formula, comment lines aside, **matched**
`packaging/homebrew/flang.rb` in this tree: the copy in the tap has not fallen
behind.

**What could not be checked.** There is no `brew` in this environment
(`command -v brew` is empty). So everything only brew can do is unchecked:
parsing the formula as Ruby, `bin.install`, the build sandbox, `brew audit`. On
this evidence one may not say "it installs via Homebrew". One may say exactly
what is above: archive, hash and formula agree.

## asdf: the plugin's three scripts, run with no Node in `PATH`

The plugin repository exists and is public: `github.com/digitable-lol/asdf-flang`
answers HTTP 200.

Its three scripts were run by hand with `PATH=/usr/bin:/bin` — that is, **with
Node physically absent from `PATH`** (`command -v node` empty; `node` lives in
`/usr/local/bin`, where the path does not lead):

```
bin/list-all  → 0.4.1 0.4.2 0.4.4 0.4.5 0.4.6 0.4.7 0.5.0
bin/download  → 9 files downloaded and unpacked
bin/install   → 54.9 s, "flang 0.5.0 installed"
```

After that the install directory holds four files: `bin/flang`,
`lib/libkompilyator_flang.a`, `include/flang_runtime.h`,
`include/kompilyator_flang.h`. `bin/flang --version` answers `flang 0.5.0`.

**About 0.4.8.** The release exists, it has no archive, and `asdf install flang
0.4.8` ended in a 404. That is why `bin/list-all` does not name it, and why the
install page spells the version list out in full: an ellipsis would quietly
promise something that cannot be delivered.

**What could not be checked.** Neither `asdf` nor `mise` is in this environment.
So everything asdf does around the scripts is unchecked: `plugin add`, version
resolution, shimming into `PATH`. Exactly one thing is checked: the three
scripts asdf calls produce a working `flang 0.5.0` without Node.

**Installing from a branch is refused on purpose.** `asdf install flang ref:main`
fails with an explanation: in the repository the compiler is source written in
flang itself, and the first binary out of it comes from Node — precisely the
dependency the plugin exists to remove.

## From source: two builds in an empty directory

The empty directory is not a formality. `bootstrap/` ships in the repository
with `flang_cli` and `*.o` already built, and `make` goes by file times: in a
tree where a build has happened it answers "nothing to be done" and leaves the
**old** binary. A measurement taken that way measures nothing.

So the tree was unpacked with `git archive` into an empty directory, and only
then was `make` started:

| run | time | binary |
| --- | ---: | ---: |
| `make -C bootstrap -j4` | 40.6 s | 7 127 856 bytes |
| `make -C bootstrap` (no `-j`) | 98.2 s | 7 127 856 bytes |
| one `cc` call over four `.c` | 83.7 s | 7 134 408 bytes |

The input is 13 058 798 bytes of emitted C and headers (249 033 lines). Not one
warning under `-Wall -Wextra -Werror -pedantic`. The binary links against
`libc`, `libm`, `libpthread`.

**Time drifts with machine load, bytes do not.** Two `make` runs with different
thread counts gave the same size to the byte; only the plain `cc` call differs,
and it differs predictably — no `-flto`, so the link is a different one.

## Node: what `npm` answered

`npm install ../flang` into a clean directory added **1 package** in 397 ms —
the package has zero dependencies, and `package.json` has no `dependencies` or
`devDependencies` keys at all. It produced `node_modules/.bin/flang` and
`node_modules/.bin/flang-lsp`. Called from a project script:

```js
import { execFileSync } from 'node:child_process'
execFileSync('./node_modules/.bin/flang', ['check', 'proba.flang'], { encoding: 'utf8' })
// {"valid":true,"module":"Проба","functions":[{"name":"Два","total":true}],"types":[],"diagnostics":[]}
```

**Two shortcuts were tried and did not work** — which is why they are not on the
install page:

- `npm view @digitable-lol/fts version` answers **0.4.7**: the registry holds a
  version that lags behind release 0.5.0;
- `npm install github:digitable-lol/flang` and
  `npm install git+https://github.com/digitable-lol/flang.git` fail in this
  environment with "Could not read from remote repository": npm reaches git over
  ssh and there are no keys. On a machine with keys this will probably work —
  but "probably" does not belong on an install page.

## Next

- [Installing](install.html) — the commands themselves
- [Your first program](getting-started.html) — write it, check it, run it
