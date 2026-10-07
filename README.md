**English** · [Русский](docs/README.ru.md) · [Documentation](https://digitable-lol.github.io/flang/en/index.html)

# flang

flang is a pure functional language with strict static typing, written in words rather than
symbols. A function carries its examples and its claims about the result next to its body. The
compiler checks them before anything runs and prints the checked program into C, C++, Go, Rust,
Java, JavaScript, TypeScript, Elixir, Python or C#. The compiler is written in flang. Every keyword
has a Russian and an English spelling; the compiler answers in Russian on either.

"Formally provable" means three things here. `total`: the compiler proves that the function
terminates on every input, or refuses the file. `ensures`: the proof kernel proves the claim about
the result for all inputs, or reports it as not proved, and `flang run` then refuses the program.
`flang check --proof --record <file>` writes the proof out; a separate C program,
[`checker.c`](flang/proof/checker/checker.c), replays it against the source and names the steps it
takes on the kernel's word.

The kernel does not search. It applies rules from a closed table —
[`flang/proof/tables/inference-rules.tsv`](flang/proof/tables/inference-rules.tsv): one row per
rule, and rows of kind `ban` for what is deliberately not derivable — and the report names the rule
that carried each claim. What this does not mean:
[What is proved and what is not](https://digitable-lol.github.io/flang/en/what-is-proved.html).

## Install

```bash
brew install digitable-lol/tap/flang

asdf plugin add flang https://github.com/digitable-lol/asdf-flang.git
asdf install flang latest
asdf set -u flang latest

git clone https://github.com/digitable-lol/flang && cd flang
make -C bootstrap -j4
sudo make -C bootstrap install        # or PREFIX=$HOME/.local, without sudo
```

Homebrew, asdf, or a clone: each builds the compiler from its C99 sources with `cc` and `make`.
`flang --version` prints the version. More: [Installing](https://digitable-lol.github.io/flang/en/install.html).

## A first program

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

Saved as **hello.flang**:

```
$ flang check hello.flang
модуль «Hello»: функций 1, из них с доказанным завершением 1; типов 0
hello.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
$ flang run hello.flang --function Twice --args '{"n": 21}'
доказано: утверждений 1
42
$ flang check hello.flang --proof 2>&1 | grep постусловие
  постусловие «the doubled value is at least the original» функции «Twice» — доказано по объявленным типам аргументов: цель сведена правилом «порядок по построению» — утверждение обо ВСЕХ входах, а не о написанных; теоремы при нём нет и не нужно
```

`проверено` reads "checked" and `доказано` reads "proved". The `example` runs on every check.
`--proof` reports what carries each claim: here the postcondition follows from the declared type
`nat`, for all inputs. Replace it with a claim the kernel does not prove:

```flang
  ensures «the result is even» (result modulo 2) equals 0
```

Saved as **even.flang**, the program passes `flang check` with code 0 and is refused by `flang run`:

```
$ flang run even.flang --function Twice --args '{"n": 21}' 2>&1 | head -n 1
не доказано: утверждений 1: доказано 0, сетка 1, на веру 0 — запуск только по явному согласию: --на-веру
$ flang run even.flang --function Twice --args '{"n": 21}' 2>/dev/null; echo $?
3
```

The line reads "not proved: 1 claim — 0 proved, 1 counted on its examples only; runs only on
explicit consent". The lines after it name the claim; `--trust` runs the program as it is.

## Printing into a target language

```
$ flang emit hello.flang --target c --out out-c 2>/dev/null
$ grep -A 4 '^fl_status hello_twice' out-c/hello.c
fl_status hello_twice(fl_ctx *ctx, fl_value n, fl_value *result, fl_error *error) {
  if (n.tag != FL_NUMBER || n.tag != FL_NUMBER) FL_TRY(fl_not_numbers(ctx, "add", n, n, error));
  *result = fl_number(n.as.number + n.as.number);
  return FL_OK;
}
```

`flang emit` checks the program the way `flang check` does, writes nothing when the check fails,
and reports on stderr. The output directory holds the module, the runtime of the target, a
command-line driver and a `Makefile`. A binary installed by `make -C bootstrap install` takes the
runtime from `--runtime flang/src/emit/c`.

The binary answers to fifteen commands, the editor language server among them: `check`, `test`,
`run`, `emit`, `ast`, `tokens`, `lint`, `facts`, `io`, `lock`, `package`, `new`, `run-script`, `repl` and
`lsp`. It prints into `c`, `cpp`, `go`, `rust`, `java`, `js`, `ts`, `elixir`, `python` and `csharp`.

## Documentation

- Start: [Your first program](https://digitable-lol.github.io/flang/en/getting-started.html), [Tutorial](https://digitable-lol.github.io/flang/en/tutorial.html), [Which construct to use when](https://digitable-lol.github.io/flang/en/which-construct.html)
- Language: [Map of the language constructs](https://digitable-lol.github.io/flang/en/language-map.html), [Language reference](https://digitable-lol.github.io/flang/en/language.html), [Standard library reference](https://digitable-lol.github.io/flang/en/stdlib.html), [`docs/flang/SPEC.md`](docs/flang/SPEC.md)
- Tools: [Command reference](https://digitable-lol.github.io/flang/en/cli.html), [Diagnostics reference](https://digitable-lol.github.io/flang/en/diagnostics.html), [Releases](https://digitable-lol.github.io/flang/en/releases.html)
- Proofs and programs: [Proofs: why and how](https://digitable-lol.github.io/flang/en/proofs.html), [`docs/examples/`](docs/examples)

## Contributing

Work happens in a clone; the only thing to build is the compiler.

```bash
make -C bootstrap -j8                    # gives bootstrap/flang
sh flang/test/обход.sh                   # the checks written in flang
./bootstrap/flang test flang/stdlib/     # the library's examples
git config core.hooksPath .githooks      # the pre-push hook: the cheap guards, before CI
```

The walk runs 211 checks written in flang and diffs the result against
<!-- СНЯТО 2026-10-03 строк flang/test/ledger.txt = 211 -->
`flang/test/ledger.txt`, one line per check. The hook runs the guards that finish in seconds and
names what it did not run; the long ones are CI (`.github/workflows/binary.yml`). Work is tracked
in [`docs/tasks/`](docs/tasks/README.md), one file per open task; a closed task leaves the tree and
its number stays taken in `docs/tasks/used-numbers.tsv`. The rules of the tree that are not visible
from the code are in [`AGENTS.md`](.ai/AGENTS.md); how to build, run the checks and send a change is
[`CONTRIBUTING.md`](CONTRIBUTING.md). Decisions are recorded in [`docs/adr/`](docs/adr).

Prose in this tree is held to the tree by runs, not by memory: a number written by hand carries a
note saying how it was measured (`scripts/guards/prose-numbers-guard.fscript`), a path in a link must
exist (`scripts/guards/link-guard.fscript`), and a word of internal jargon on a page for an outside
reader is refused (`scripts/guards/jargon-guard.fscript`). This page is one of the pages those
checks read.

## Built with flang

Four programs outside this repository: [flang-tui](https://github.com/digitable-lol/flang-tui),
[digitdisk](https://github.com/digitable-lol/digitdisk),
[flang-ribbon](https://github.com/digitable-lol/flang-ribbon) and
[flang-env](https://github.com/digitable-lol/flang-env).

On `0.x` the JSON shapes and the diagnostic codes are compatibility surfaces; the syntax is not
frozen. What the prover reaches and where it stops is measured in
[`docs/ROADMAP.md`](docs/ROADMAP.md).

## License

BSD 2-Clause — [LICENSE](LICENSE). A Russian edition without legal force is [LICENSE-RU.md](LICENSE-RU.md).
