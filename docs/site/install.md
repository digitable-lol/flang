# Installing: four paths

Four ways to get a working `flang`. Everything below was run on 18 August 2026 on
this machine: `cc (Ubuntu 15.2.0-16ubuntu1) 15.2.0`, `GNU Make 4.4.1`,
`node v26.7.0`. What was not run is named as not run.

| Path | What you get | Needed on the machine | Run here |
| --- | --- | --- | --- |
| Homebrew | `flang` 0.5.0, `man flang` | `brew`, `cc`, `make` | formula and its hash — yes; `brew` itself — **no** |
| asdf / mise | `flang` 0.5.0 alongside other versions | `asdf` or `mise`, `cc`, `make` | the plugin's three scripts — yes; `asdf` itself — **no** |
| From source | `bootstrap/flang_cli` from this tree | `git`, `cc`, `make` | yes, in an empty directory |
| Node, into your project | eight emit targets, laws, violation search | Node ≥ 20 | yes, `npm install` into a clean project |

## 1. Homebrew

```bash
brew install digitable-lol/tap/flang
```

The formula lives in a separate repository, `digitable-lol/homebrew-tap` — that
is how brew works: `digitable-lol/tap/flang` expands to
`github.com/digitable-lol/homebrew-tap`, file `Formula/flang.rb`.

**What was verified by running it.** The published formula was downloaded
(HTTP 200, 10 314 bytes). Its `version` is `0.5.0`, its `url` points at release
`v0.5.0`, its `sha256` is `7dc75fec…d0505`. The archive at that `url` was
downloaded separately: HTTP 200, **929 817 bytes**, and `sha256sum` matched the
formula character for character. The archive holds exactly **9 files**:
`LICENSE`, `Makefile`, `flang.1`, four `.c` and two `.h` — no `.o`, no built
binary. The body of the formula, comment lines aside, **matched**
`packaging/homebrew/flang.rb` in this tree: the tap copy has not fallen behind.

**What was NOT verified.** `brew` itself: it does not exist in this environment
(`command -v brew` is empty). So everything only brew can do stayed unverified —
parsing the formula as Ruby, `bin.install`, the build sandbox, `brew audit`.
"It installs via Homebrew" cannot be said on this evidence. What can be said is
exactly the above: **archive, hash and formula agree**.

Node is not needed: the release archive holds already-emitted C99. The flang
compiler is written in flang and emitted to C — Node is needed by whoever
**develops the language**, not by whoever installs it.

## 2. asdf (and mise)

```bash
asdf plugin add flang https://github.com/digitable-lol/asdf-flang.git
asdf install flang 0.5.0
asdf global flang 0.5.0
```

mise understands the same plugins: `mise plugin add flang https://github.com/digitable-lol/asdf-flang.git`.

The plugin repository exists and is public: `github.com/digitable-lol/asdf-flang`
answers HTTP 200.

**What was verified by running it.** The plugin's three scripts were run by hand
with `PATH=/usr/bin:/bin`, that is, **with Node physically absent from `PATH`**
(`command -v node` empty; `node` lives in `/usr/local/bin`, where the path does
not lead):

```
bin/list-all  → 0.4.1 0.4.2 0.4.4 0.4.5 0.4.6 0.4.7 0.5.0
bin/download  → 9 files downloaded and unpacked
bin/install   → 54.9 s, "flang 0.5.0 установлен"
```

Afterwards the install directory holds four files: `bin/flang`,
`lib/libkompilyator_flang.a`, `include/flang_runtime.h`,
`include/kompilyator_flang.h`. `bin/flang --version` answers `flang 0.5.0`.

**What was NOT verified.** `asdf` itself and `mise` itself: neither is present in
this environment. So what asdf does around the scripts stayed unverified —
`plugin add`, version resolution, `PATH` shims. Exactly one thing is verified:
**the three scripts asdf calls produce a working `flang 0.5.0` without Node**.

Installing from a branch is refused on purpose: `asdf install flang ref:main`
fails with an explanation. In the repository the compiler is source code in flang
itself, and it takes Node to get the first binary out of it — precisely the
dependency the plugin removes.

## 3. From source

```bash
git clone https://github.com/digitable-lol/flang.git
cd flang
make -C bootstrap -j4
```

**Run in an empty directory, and that is not a formality.** `bootstrap/` ships in
the repository together with an already built `flang_cli` and `*.o`, and `make`
looks at file times: in a tree where a build already happened it answers "nothing
to be done" and leaves the **old** binary. A measurement taken that way measures
zero. So the tree was unpacked with `git archive` into an empty directory, the
artifacts were deleted, and only then `make` ran:

```
in         13 058 798 bytes of emitted C and headers (249 033 lines)
make -j4   40.6 s, not one warning under -Wall -Wextra -Werror -pedantic
out        bootstrap/flang_cli — 7 127 856 bytes, linked against libc, libm, libpthread
```

A single `cc` call instead of `make` works too — worth knowing when the machine
has no `make`:

```bash
cc -std=c99 -O2 -o flang \
   flang_cli.c flang_repl.c flang_runtime.c kompilyator_flang.c -lm -lpthread
```

Run: **83.7 s**, binary 7 134 408 bytes. Twice as long as `make -j4` — the build
is single-threaded and the `-flto` from the `Makefile` is not passed here.

What the built binary can do and where its limits are: see
[Your first program](getting-started.html).

## 4. Node: embedding into an existing project

This path is not for whoever **installs the language** but for whoever **calls it
from their own code**: the rules sit next to the code that applies them.

```bash
git clone https://github.com/digitable-lol/flang.git
cd my-project
npm install ../flang
```

Run in a clean directory: `npm install` from the clone added **1 package** in
397 ms — it has zero dependencies, and `package.json` has no `dependencies` or
`devDependencies` key at all. Two executables appeared:
`node_modules/.bin/flang` and `node_modules/.bin/flang-lsp`. Run from a project
script:

```js
import { execFileSync } from 'node:child_process'
execFileSync('./node_modules/.bin/flang', ['check', 'proba.flang'], { encoding: 'utf8' })
// {"valid":true,"module":"Проба","functions":[{"name":"Два","total":true}],"types":[],"diagnostics":[]}
```

**Why from a clone, not from the registry or a git URL.** Both shortcuts were run
here and both failed, so they are not in the text:

- `npm view @digitable-lol/fts version` answers **0.4.7**. The registry holds a
  version that has fallen behind; the release is 0.5.0;
- `npm install github:digitable-lol/flang` and `npm install
  git+https://github.com/digitable-lol/flang.git` fail in this environment with
  "Could not read from remote repository" — npm reaches git over ssh and there
  are no keys. On a machine with keys this will probably work, but "probably"
  does not belong on an install page.

What this path buys: the other **seven** emit targets (`csharp`, `elixir`, `go`,
`java`, `js`, `python`, `rust`), laws on a grid, violation search by running
examples, and the language server — none of which the binary has.

## Next

- [Your first program](getting-started.html) — write it, check it, run it
- [Operations](operations.html) — what does what
- [Writing packages](packages.html) — modules, the lock, and what is missing
