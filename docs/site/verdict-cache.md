# The kernel's verdict cache

The proof kernel passes a verdict on every obligation of a program anew on each
`flang check`, each `flang emit` and each reprint of the compiler. The verdict
cache stores those verdicts in a file and, on the next run, hands them back
from there without asking the kernel again.

**The whole verdict is cached, refusals included.** An obligation the kernel
could not close costs the same steps as a proved one and is asked again on
every pass; a cache of "proved" alone would save the smaller part of the work.

## Where it lives

The mechanism is split across two layers, and the boundary between them is the
rule of trust.

- **The kernel computes and compares the key** — `flang/self/proofterm.flang`:
  the functions «Основа кеша», «Ключ кеша», «Из кеша», «Спросить кеш», «Сложить
  в кеш» and «Проверить доказательства с кешем». The rule by which a verdict is
  recognised as one's own does not leave the kernel.
- **The runtime stores the file** — `flang/src/emit/c/flang_repl.c` (the
  variable `FLANG_KESH_PRIGOVOROV`, the function `kesh_stamp_read`). It reads
  the cache file, hands it to the kernel as data together with the fingerprint
  of the binary itself, and after the judgement writes the updated cache back.
  The runtime neither sees nor computes the key.
- **The fingerprint** — «Отпечаток 256 текста» in `flang/self/zapis.flang`:
  sha256 through the language's built-in word `хеш256`.

The cache file is JSON: entries are laid out in buckets («Номер корзины» in
`proofterm.flang`), each entry carries the key under `k` and the verdict under
`v`.

## How to invoke it

```sh
FLANG_KESH_PRIGOVOROV=/path/to/cache.json flang check program.flang
FLANG_KESH_PRIGOVOROV=/path/to/cache.json flang emit program.flang --target c
FLANG_KESH_PRIGOVOROV=/path/to/cache.json sh scripts/raskrutka.sh
```

Variable not set — the cache is off, and the kernel takes its former road. The
binary could not read itself (no checker fingerprint) — the cache is off too: a
key without the fingerprint would hand out someone else's verdicts silently.

While the cache is on, every run reports its work in one line on stderr:

```
кеш приговоров: спросов 1, попаданий 1, промахов 0, доля попаданий 100.0 %
```

(asked 1, hits 1, misses 0, hit share 100.0 %). Hits are counted by the kernel
(«Спросить кеш»); the runtime only prints the count. To measure time by stage
there is `FLANG_VITKI=1`: it prints to stderr the number of evaluator steps for
each call into the kernel (`витки: <call name> <number>`).

There is no cache on the `--proof` road: the proof report is built apart from
the kernel's judgement, and verdicts there are computed anew. Compare a run
with the cache against one without by printing (`flang emit`) or by
`flang check` without `--proof`.

## What is in the key

«Вердикт без теоремы» in the kernel is a pure function of three arguments: the
obligation, the program, and the facts already paid for. The key covers exactly
those and the code that reads them. The part shared by the whole program
(«Основа кеша»):

| What | Where from |
|---|---|
| checker fingerprint | sha256 of the compiler binary itself |
| version of the kernel's term format | «Версия ядра» |
| all functions of the program — bodies, postconditions, preconditions | the field `functions` |
| type declarations | the field `types` |
| law declarations | the fields `monoids`, `monads`, `isomorphisms`, `intersections`, `embeddings` |
| the list of unpaid `требует` | «Оплаченное».«неоплаченные» |

The part per obligation («Ключ кеша»): the obligation node and the set of facts
already proved («Оплаченное».«доказанные»). Positions are stripped from the
nodes before printing («Значение без мест рекурсивно»): a shift of lines in the
file does not miss the cache.

All parts are printed as a string and folded with sha256. The former polynomial
fingerprint was replaced: it is linear in character codes, two different
obligations with one key can be constructed on purpose, and a cache with such a
key hands "proved" to what the kernel without a cache refuses.

Two decisions in the key are named together with their price:

- **The checker fingerprint is of the binary, not of the sources.** Two
  binaries on one tree with a different kernel rule pass different verdicts; a
  key over the tree would hand one binary's verdicts to the other. This is
  checked by `второе-ядро.sh`.
- **Functions are taken as the whole list, not as the call closure.** The list
  is handed to the kernel whole, and normalisation may unfold any function;
  narrowing the key to the closure is allowed only after proving that unfolding
  does not leave it. The price: editing any function of a program misses its
  whole cache.

## Instruments

Everything lies in `benchmarks/кеш-приговоров/`:

```sh
sh benchmarks/кеш-приговоров/пробы.sh <binary> [<second binary>]
sh benchmarks/кеш-приговоров/второе-ядро.sh [<where to build>]
sh benchmarks/кеш-приговоров/три-печати.sh [<working directory>]
python3 benchmarks/кеш-приговоров/наложить.py [<tree root>]
```

- `пробы.sh` asks four questions and answers each with a number: does the
  printing of several programs with and without the cache match byte for byte;
  does the cache miss when the body of a called function is edited while the
  function with the postcondition is untouched (`проба.flang` and a corrupted
  copy produced from it by one line of `sed`); does it hit when the sound one
  is restored; does a second kernel answer on someone else's cache exactly what
  it answers on an empty one.
- `второе-ядро.sh` builds from `bootstrap/` a second binary whose printed seed
  has one kernel rule rewritten («Предел ветвления»); the source tree is not
  changed.
- `три-печати.sh` reprints the compiler with `scripts/raskrutka.sh` three
  times — without the cache, with a cold one, with a hot one — and compares
  the seed after each printing with the printing without the cache. This takes
  hours.
- `наложить.py` applies the mechanism to a tree without it (it edits
  `proofterm.flang` and `flang_repl.c`); on this tree everything is already
  applied, and a repeated run touches nothing. `кеш.вставка` is the inserted
  piece of the kernel in flang; the extension is not `.flang` on purpose,
  because it is a piece of a module, not a module.

## The neighbouring directory

`benchmarks/кеш-доказанного/` is earlier work on the same phenomenon: the
instrument `прибор.c` computes the key and gives the probes something to refute
it with, but stores nothing; its key is narrower (bodies of called functions
are taken as the closure of the call graph). The cache that reads and writes a
file and substitutes the verdict for a repeated judgement is only here.
