# The proof cache

This page answers the question: how not to prove the same thing on every run.
`flang check` and `flang emit` prove the postconditions anew each time. The
cache keeps the kernel's answers on disk and returns them until something the
answer depends on changes. The cache is off by default.

## How to turn it on

```bash
FLANG_PROOF_CACHE=on flang check --proof discount.flang
```

| Value of `FLANG_PROOF_CACHE` | What happens |
| --- | --- |
| unset, empty, `off`, `0` | no cache |
| `on`, `1` | the directory `.flang-cache/proofs/` in the project root — the nearest directory upward with `.flangrc` or `.git` |
| anything else | a path to the cache directory |

You can delete the directory at any time. It does not go into git.

## How to see that the cache works

`FLANG_PROOF_CACHE_STATS=1` adds counter lines. Two runs in a row on the file
`docs/examples/proofs/discount.flang`:

```bash
FLANG_PROOF_CACHE=on FLANG_PROOF_CACHE_STATS=1 flang check --proof discount.flang
```

```
кеш доказательств: взято записей 0, попаданий 0, новых 10, потеряно 0, отвергнуто сегментов 0
```

```bash
FLANG_PROOF_CACHE=on FLANG_PROOF_CACHE_STATS=1 flang check --proof discount.flang
```

```
кеш доказательств: взято записей 10, попаданий 4, новых 0, потеряно 0, отвергнуто сегментов 0
```

The first run computed the answers and wrote ten entries. The second read them
from disk and took a ready answer four times. «Сегмент» in the output is one
cache file.

## When an answer is computed anew

A cache entry fits only if everything the answer depends on matches:

- the `flang` program: another version of the compiler does not take old entries;
- the postcondition and every declaration it refers to: functions, types,
  statements, theorems, including those from imported modules.

Editing a function the postcondition does not depend on leaves its entry alone.
After editing one function of a large file only what is connected with it is
recomputed.

## Why the cache will not let a false proof through

- The key of an entry is the SHA-256 of the fingerprint of the `flang` program
  and the exact bytes of everything the kernel receives. An entry with that key
  can only come from the same computation.
- The cache file is signed: HMAC-SHA256 with this machine's key
  (`~/.config/flang/proof-cache.key`, created automatically, mode 0600). A
  damaged or foreign file is not taken, and everything is computed anew.
- With `FLANG_MEMO_AUDIT=1` every hit is recomputed and compared with the
  entry. A mismatch stops the program.

The cache neither adds trust nor takes it away: it holds answers of the same
kernel. What you are trusting when you see «доказано» is on
[a separate page](trust.html).

## Variables

| Variable | What it does |
| --- | --- |
| `FLANG_PROOF_CACHE` | turns the cache on and sets the directory |
| `FLANG_PROOF_CACHE_STATS=1` | counter lines on stderr |
| `FLANG_PROOF_CACHE_AUDIT=1` | the answer for a part of the program is compared with the answer for the whole program |
| `FLANG_MEMO_AUDIT=1` | every hit is recomputed and compared with the entry |
| `FLANG_PROOF_CACHE_KEY` | a signing key file instead of `~/.config/flang/proof-cache.key` |
| `FLANG_PROOF_CACHE_RECHECK=0` | do not run the independent check of the record after a run with hits |

## Where it is

```
.flang-cache/proofs/<fingerprint of the flang program>/<fingerprint of the file path>/<number>.seg
```

A directory of its own for every version of `flang` and every input file. Two
simultaneous runs on one file do not disturb each other: the file is written
under a temporary name and renamed.
