# The proof cache

`flang check` and `flang emit` prove every promise of a program again on every
run. The proof cache keeps the prover's answers on disk next to the project
and returns them on the next run without recomputing — as long as nothing the
answer depends on has changed. The cache is off by default.

## Turning it on

```bash
FLANG_PROOF_CACHE=on flang check --proof sum.flang
```

| Value of `FLANG_PROOF_CACHE` | What happens |
| --- | --- |
| unset, empty, `off`, `0` | no cache |
| `on`, `1` | the directory `.flang-cache/proofs/` in the project root — the nearest directory upwards that has `.flangrc` or `.git` |
| anything else | the path of the cache directory |

The directory can be deleted at any time. It does not go into git.

## Seeing that the cache works

`FLANG_PROOF_CACHE_STATS=1` adds a line of counters. Two runs in a row on a
program with one postcondition:

```bash
$ FLANG_PROOF_CACHE=on FLANG_PROOF_CACHE_STATS=1 flang check --proof sum.flang
кеш доказательств: взято записей 0, попаданий 0, новых 1, потеряно 0, отвергнуто сегментов 0

$ FLANG_PROOF_CACHE=on FLANG_PROOF_CACHE_STATS=1 flang check --proof sum.flang
кеш доказательств: взято записей 1, попаданий 1, новых 0, потеряно 0, отвергнуто сегментов 0
```

The first run computed the answer and stored it (`новых 1`, one new); the
second took it from disk (`попаданий 1`, one hit).

## When an answer is computed again

A cache entry fits only if everything the answer depends on is the same:

- the `flang` binary itself — another version of the compiler takes no old
  entries;
- the promise and every declaration it refers to — functions, types,
  statements, theorems, including those from imported modules.

Editing a function the promise does not depend on leaves its entry alone. So
after a change to one function of a large file only what is connected to it is
recomputed.

## Why the cache does not let a false proof through

- **The key covers every input.** The key of an entry is the sha256 of the
  fingerprint of the binary and the exact bytes of everything the prover
  receives. An entry with that key can only have come from the same
  computation.
- **The cache file is signed.** The signature is HMAC-SHA256 with the key of
  this machine (`~/.config/flang/proof-cache.key`, created automatically, mode
  0600). A damaged or foreign file is not taken, and everything is computed
  again:

  ```
  кеш доказательств: …/3888793-1a2efc3d002.seg — не сегмент кеша, не взят
  кеш доказательств: взято записей 0, попаданий 0, новых 1, потеряно 0, отвергнуто сегментов 1
  ```

- **It can be re-checked.** With `FLANG_MEMO_AUDIT=1` every hit is computed
  again and compared with the entry; a mismatch stops the program.

## Variables

| Variable | What it does |
| --- | --- |
| `FLANG_PROOF_CACHE` | turns the cache on and sets the directory |
| `FLANG_PROOF_CACHE_STATS=1` | a line of counters on stderr |
| `FLANG_PROOF_CACHE_AUDIT=1` | the answer on a part of the program is compared with the answer on the whole program |
| `FLANG_MEMO_AUDIT=1` | every hit is recomputed and compared |
| `FLANG_PROOF_CACHE_KEY` | the signing key file instead of `~/.config/flang/proof-cache.key` |
| `FLANG_PROOF_CACHE_RECHECK=0` | do not run the independent check of the record after a run with hits |

## Where it lives

```
.flang-cache/proofs/<fingerprint of the binary>/<fingerprint of the file path>/<number>.seg
```

One directory per binary and per input file. Two simultaneous runs on one file
do not disturb each other: a file is written under a temporary name and then
renamed.
