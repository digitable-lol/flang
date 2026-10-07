# The proof cache

The proof kernel passes a verdict on every obligation of a program on each
`flang check`, each `flang emit` and each reprint of the compiler. The proof
cache keeps the kernel's answers between runs in a directory next to the
project and hands them back on the next run instead of computing them again.
It works like Lean's `.olean`: an answer, once computed, stays on disk and is
taken as long as nothing it depends on has changed.

## How to switch it on

```sh
FLANG_PROOF_CACHE=on flang check --proof program.flang
FLANG_PROOF_CACHE=on flang emit program.flang --target c
FLANG_PROOF_CACHE=/path/to/directory flang check program.flang
```

Unset, empty, `off` or `0` — no cache, and the kernel takes its old road byte
for byte. `on` or `1` — the directory `.flang-cache/proofs/` in the project
root: the nearest directory above with `.flangrc` or `.git`. Any other value is
the path of the cache directory. The directory never goes into git
(`.gitignore`) and may be removed at any time.

| variable | what it does |
|---|---|
| `FLANG_PROOF_CACHE_STATS=1` | one stderr line: entries taken from disk, hits, new entries, obligations computed on a narrowed program |
| `FLANG_PROOF_CACHE_AUDIT=1` | the kernel also computes on the whole program and compares the answer with the narrowed one |
| `FLANG_MEMO_AUDIT=1` | every hit, from disk or from memory, is computed again and compared byte for byte; a mismatch is `abort()` |
| `FLANG_PROOF_CACHE_RECHECK=0` | do not call the independent checker after a run with hits |
| `FLANG_PROOF_CACHE_KEY` | the signing key file instead of `~/.config/flang/proof-cache.key` |
| `FLANG_PROOF_CHECKER` | the checker binary instead of `flang/proof/checker/сверщик` |

A release does not use the cache: setting `FLANG_PROOF_CACHE` on the tag path
is forbidden, and `.github/actions/release-without-cache` guards it.

## What is cached

The answers of three pure functions of the compiler:

| function | where | what it answers |
|---|---|---|
| «Вердикт без теоремы по сужению» | `flang/self/proofterm.flang` | the verdict on a postcondition or statement without a theorem |
| «Проверить терм по сужению» | `flang/self/proofterm.flang` | the verdict on a theorem: steps, cases, refusals |
| «Значение терма записи» | `flang/self/proof-record.flang` | the value of a closed term in the proof record |

The ledger and the proof record (`--record`) are built from these answers, so
both come from the cache.

## The key

The key of an entry is sha256 of:

- the fingerprint of the binary itself: sha256 of `/proc/self/exe`. The kernel,
  the table of inference rules, the kernel version and the runtime are printed
  into the binary, and changing any of them changes the fingerprint;
- the function name;
- the EXACT bytes of every argument of the call, in the same encoding the
  in-run call memory compares them with
  ([ADR-0051](../adr/0051-the-proof-kernel-remembers-pure-calls-within-one-run.md)):
  the kind of value, a number in all 64 bits, the length and bytes of a string,
  field names and values in order. Places (`span`) are part of the key as they
  are.

The functions are pure: the answer is a function of the arguments. A hit gives
exactly what the kernel would compute on the same bytes.

## Narrowing: what one obligation depends on

Given the whole program, the key of each obligation would depend on the whole
program, and a one-line edit would miss the entire cache. So the kernel
computes an obligation on a NARROWED program:

1. The runtime (`proof_closures` in `flang/src/emit/c/flang_repl.c`) collects a
   closure for every obligation: every string of the obligation node, the
   declarations with such names among `functions`, `types`, `statements`,
   `theorems` (a type is named by its own name and the names of its variants),
   their strings, and so on to a fixed point. It hands the kernel the numbers
   of the declarations in ascending order.
2. The kernel («Сужение замкнуто») DOES NOT TRUST the runtime and checks for
   itself: the numbers strictly grow and lie inside the program, and every
   reference of every taken declaration and of the obligation itself is inside
   the set. If not, the obligation is computed on the whole program and without
   the cache ("без сужения" in the `FLANG_PROOF_CACHE_STATS` line).
3. The narrowed program is the same record with four fields replaced by the
   taken declarations in their original order. Of the facts already proved,
   those of the set's functions remain; of the example runs, those of the set's
   functions; the list of unpaid `требует` goes whole.

The kernel computes on the narrowed program on a hit and on a miss alike, so a
cold and a warm run with the cache answer the same. Whether the narrowed
answer equals the whole-program answer is checked by `FLANG_PROOF_CACHE_AUDIT=1`.

## Why a hit never lets a false proof through

- **A hit is a recomputation of the same bytes.** The key covers every argument
  of a pure function and the binary itself, so an entry with this key can only
  come from the same computation. What remains is the assumption that sha256
  resists collisions.
- **Narrowing is sound by construction.** The taken declarations are the
  program's declarations byte for byte, the set is closed under references, and
  all declarations of one name are in it. A derivation on a subprogram where
  every mentioned name resolves as it does in the whole program is a
  derivation in the whole program too.
- **A file is not taken on trust.** Every cache file is signed with HMAC-SHA256
  under the machine's key (`~/.config/flang/proof-cache.key`, 32 random bytes,
  mode 0600; the binary's fingerprint is part of the signed text). A corrupted,
  truncated or foreign file is refused whole, with a line in stderr, and
  everything in it is computed again.
- **The independent checker.** After `flang check --proof --record` with hits
  the record is checked by `flang/proof/checker/сверщик` by default, and its
  exit code is compared with its code on a record of the same file taken
  without hits. If it turned into "НЕ СОШЛОСЬ" where it was otherwise without
  the cache, the file's cache is removed and the run is repeated without it.
  The checker rereads the source itself but not everything: it leaves reduction
  rule names and "по свойству" steps "on the kernel's word"
  (`docs/flang/proof/checker/README.md`), so only `FLANG_MEMO_AUDIT=1` rechecks
  in full.

## Where it lives

```
.flang-cache/proofs/<16 chars of the binary fingerprint>/<16 chars of sha256 of the entry path>/
  <pid>-<time>.seg     entries: key digest, steps, depth, answer, signature at the end
  checker              the checker's code on the last record without hits, signed
```

One directory per binary and per entry file. A run reads every `.seg` file of
its directory and at the end writes one new file — the entries it took and the
entries it computed — and removes the files it read. Entries this file does not
need go away. A file is written under a temporary name and renamed, so two runs
on one file at once spoil nothing for each other: at worst two whole files
remain, and the next run merges them.

The steps and the depth of a call are stored with the answer and charged on a
hit, as with the in-run call memory: a hit does not hide the step limit.

## Checked by forgery

`bootstrap/flang run-script proof-cache:forgery`
(`scripts/guards/proof-cache-forgeries.fscript`, the `proof-cache` job in CI)
warms the cache on a small program, edits it and demands that the run with the
cache answers exactly as the run without it:

- only the body of the called function is edited;
- only the promise of the called function is edited;
- an imported module is edited;
- another binary (the kernel and the rules table are printed into it): not one
  entry is taken from disk;
- a byte of a cache file is spoiled: the signature fails, the file is refused;
- the file is signed with a foreign key: refused;
- a run with `FLANG_PROOF_CACHE_AUDIT=1` and `FLANG_MEMO_AUDIT=1`: every hit is
  recomputed, and the narrowed answer equals the whole-program answer.
