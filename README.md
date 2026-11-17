**English** · [Русский](docs/README.ru.md) · [Documentation](https://digitable-lol.github.io/flang/en/index.html)

# flang

flang is a pure functional language with strict static typing. Its keywords are words (`function`,
`accepts`, `returns`). A function has its tests and the conditions on its result written next to its
body. The compiler checks them before anything runs and generates code from the checked program in
C, C++, Go, Rust, Java, JavaScript, TypeScript, Elixir, Python or C#. The compiler is written in
flang. Every keyword has a Russian and an English spelling; the compiler's messages are in Russian.

What "formal proof" means here:

- `total` — the compiler proves that the function terminates on every input; if it cannot, the file
  fails the check.
- `ensures` — a postcondition, a condition on the result. The compiler proves it for all inputs or
  reports that there is no proof; `flang run` does not run such a program.
- `flang check --proof` shows the proof report. A separate C program,
  [`checker.c`](flang/proof/checker/checker.c), re-checks the proofs and reports how many of them it
  could not re-check.

The compiler does not search for a proof. It applies inference rules from a fixed table,
[`flang/proof/tables/inference-rules.tsv`](flang/proof/tables/inference-rules.tsv), and the report
names the rule for each postcondition. The limits of the method:
[What is proved and what is not](https://digitable-lol.github.io/flang/en/what-is-proved.html).

## Install

Prebuilt builds ship with every release: Linux x86_64 and aarch64 (static, any distribution), macOS
arm64 and x86_64. The package is called **flang-package**; the command it
installs is `flang`.

> **Name clash with LLVM Flang.** LLVM's Fortran compiler also installs a command named `flang`
> (it is the `flang` formula in Homebrew and the `flang` package in the AUR). If both are installed,
> whichever comes first on `PATH` wins. Check with `flang --version`: ours prints `flang <version>`
> on the first line. Fix it by putting the directory of this install first on `PATH`, or call it by
> its full path (for example `~/.local/bin/flang`).

### Linux and macOS: one line

```bash
curl -fsSL https://raw.githubusercontent.com/digitable-lol/flang/main/install.sh | sh
```

Picks the build for your system, checks it against the release's `SHA256SUMS` and installs it into
`~/.local` without `sudo`. Pin a version with `FLANG_VERSION=<version>`, choose a place with
`PREFIX=/opt/flang` (both are environment variables of `sh`).

### macOS and Linux: Homebrew

```bash
brew install digitable-lol/tap/flang-package
```

`brew install digitable-lol/tap/flang` is an alias of the same formula.

### Any system with asdf

```bash
asdf plugin add flang https://github.com/digitable-lol/asdf-flang.git
asdf install flang latest
asdf set -u flang latest
```

The plugin downloads the prebuilt build and checks its checksum. With `ASDF_FLANG_FROM_SOURCE=1` it
builds `flang` from the C sources instead (needs `cc` and `make`).

### Debian, Ubuntu (deb) and Fedora, openSUSE (rpm)

Download the package for your CPU from the [latest release](https://github.com/digitable-lol/flang/releases/latest)
and install it:

```bash
sudo apt install ./flang-package_<version>_amd64.deb     # or _arm64.deb
sudo dnf install ./flang-package-<version>-1.x86_64.rpm   # or .aarch64.rpm
```

The rpm conflicts with Fedora's `flang` package (LLVM Flang): both own `/usr/bin/flang`.

### Arch Linux (AUR)

`packaging/aur/` holds the `PKGBUILD` of **flang-package-bin**. It is not published on the AUR yet;
to build it locally, fill it with the release's `SHA256SUMS` (`sh packaging/prebuilt/manifests.sh`) and run
`makepkg -si`.

### From source

```bash
git clone https://github.com/digitable-lol/flang && cd flang
make -C bootstrap -j4                  # a few minutes
make -C bootstrap install PREFIX=$HOME/.local
```

Needs only a C99 compiler and `make`. Along with `flang`, the standard library and the run-time
libraries of the target languages are installed into `share/flang`, so the install works outside the
clone too ([where flang looks for them](docs/guide/installed-library.md)). The program that re-checks
proofs independently is not installed this way; the prebuilt builds have it.

### Windows

Use WSL and the Linux one-liner above. There is no native Windows build yet.

`flang --version` prints the version. More: [Installing](https://digitable-lol.github.io/flang/en/install.html).

## A first program

File `hello.flang`:

```flang
module «Hello»

total function «Twice»
  accepts n: nat
  returns number
  ensures «the doubled value is at least the original» result is at least n
  example «twice two»
    given n equals 2
    expected 4
  n plus n
```

```bash
flang check hello.flang
```

```text
модуль «Hello»: функций 1, из них с доказанным завершением 1; типов 0
hello.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
```

Exit code 0. The first line reads "module «Hello»: 1 function, 1 of them proved to terminate; 0
types". The second lists the checks that passed — syntax, types, termination, proofs, tests — and
ends with "no errors".

```bash
flang run hello.flang --function Twice --args '{"n": 21}'
```

```text
доказано: утверждений 1
42
```

The first line reads "proved: 1 postcondition". The second is the result. The test (`example`) runs
on every check. The postcondition here follows from the declared type `nat` and is proved for all
inputs.

Replace the postcondition with one the compiler does not prove by itself. The whole file
`hello.flang`:

```flang
module «Hello»

total function «Twice»
  accepts n: nat
  returns number
  ensures «the result is even» (result modulo 2) equals 0
  example «twice two»
    given n equals 2
    expected 4
  n plus n
```

`flang check` accepts this file with code 0, and `flang run` does not run it:

```bash
flang run hello.flang --function Twice --args '{"n": 21}'
```

```text
не доказано: утверждений 1: доказано 0, сетка 1, на веру 0 — запуск только по явному согласию: --на-веру
…
```

Exit code 3. The line reads "not proved: 1 postcondition — 0 proved, 1 tested only; runs only on
explicit consent". The lines after it name the postcondition. The `--trust` flag runs the program
without the proof. How to write the proof:
[Your first proof](https://digitable-lol.github.io/flang/en/first-proof.html).

## Code in a target language

Put the first postcondition back into `hello.flang` and generate C:

```bash
flang emit hello.flang --target c --out out-c
grep -A 6 '^fl_status hello_twice' out-c/hello.c
```

```text
fl_status hello_twice(fl_ctx *ctx, fl_value n, fl_value *result,
                      fl_error *error) {
  if (n.tag != FL_NUMBER || n.tag != FL_NUMBER)
    FL_TRY(fl_not_numbers(ctx, "add", n, n, error));
  *result = fl_number(n.as.number + n.as.number);
  return FL_OK;
}
```

The function has no check of the postcondition: it is proved. `flang emit` checks the program the
way `flang check` does and writes nothing when there is an error. The output directory holds the
module, the run-time library, a command-line program and a `Makefile`.

`flang` has fifteen commands, the editor language server among them: `check`, `test`, `run`, `emit`,
`ast`, `tokens`, `lint`, `facts`, `io`, `lock`, `package`, `new`, `run-script`, `repl` and `lsp`. It
generates code for `c`, `cpp`, `go`, `rust`, `java`, `js`, `ts`, `elixir`, `python` and `csharp`.

## Documentation

- Start: [Your first program](https://digitable-lol.github.io/flang/en/getting-started.html), [Your first proof](https://digitable-lol.github.io/flang/en/first-proof.html), [Tutorial](https://digitable-lol.github.io/flang/en/tutorial.html), [Which construct to use when](https://digitable-lol.github.io/flang/en/which-construct.html)
- Language: [Map of the language constructs](https://digitable-lol.github.io/flang/en/language-map.html), [Language reference](https://digitable-lol.github.io/flang/en/language.html), [Standard library reference](https://digitable-lol.github.io/flang/en/stdlib.html), [`docs/flang/SPEC.md`](docs/flang/SPEC.md)
- Tools: [Command reference](https://digitable-lol.github.io/flang/en/cli.html), [Error codes](https://digitable-lol.github.io/flang/en/diagnostics.html), [Releases](https://digitable-lol.github.io/flang/en/releases.html)
- Proofs and programs: [Proofs: why and how](https://digitable-lol.github.io/flang/en/proofs.html), [`docs/examples/`](docs/examples)

## Contributing

Work happens in a clone; the only thing to build is the compiler.

```bash
make -C bootstrap -j8                    # builds bootstrap/flang
sh flang/test/обход.sh                   # the tests written in flang
./bootstrap/flang test flang/stdlib/     # the standard library's tests
git config core.hooksPath .githooks      # quick checks before git push
```

Before `git push` the checks that finish in seconds are run; the long ones are run by CI
(`.github/workflows/binary.yml`). Open tasks are in [`docs/tasks/`](docs/tasks/README.md), one file
per task. How to build the compiler, run the checks and send a change is in
[`CONTRIBUTING.md`](CONTRIBUTING.md). The rules of the repository that are not visible from the code
are in [`AGENTS.md`](.ai/AGENTS.md). Decisions are recorded in [`docs/adr/`](docs/adr).

The documentation text is checked automatically. Numbers in the text are compared with the
repository (`scripts/guards/prose-numbers-guard.fscript`). A path in a link must exist
(`scripts/guards/link-guard.fscript`). The project's internal words are not allowed on pages for
readers (`scripts/guards/jargon-guard.fscript`).

## Built with flang

Four programs outside this repository: [flang-tui](https://github.com/digitable-lol/flang-tui),
[digitdisk](https://github.com/digitable-lol/digitdisk),
[flang-ribbon](https://github.com/digitable-lol/flang-ribbon) and
[flang-env](https://github.com/digitable-lol/flang-env).

In `0.x` versions the JSON formats and the error codes stay compatible; the syntax may change. What
the compiler proves by itself and where it stops is described in [`docs/ROADMAP.md`](docs/ROADMAP.md).

## License

BSD 2-Clause — [LICENSE](LICENSE). A Russian edition without legal force is [LICENSE-RU.md](LICENSE-RU.md).
