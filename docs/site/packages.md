# Writing packages

Short and up front: **there is no package store.** No registry, no `flang add`,
no versions, no conflict resolution. There are two things that do work, and both
were run for this page: **import by path** and **the lock**, which puts the
dependencies inside itself.

## A module is a file

```
модуль «Операции»
  использует «Списки» из "../../flang/stdlib/lists.flang"
  использует «Строки» из "../../flang/stdlib/strings.flang"
```

Three rules, all three enforced:

1. **The name must match.** A module names itself on its first line; if that
   disagrees with how it is imported, the build refuses:
   `модуль в …/sets.flang называется «Множество строк», а импортируется как
   «Множества»`. That is how a forgotten file move gets caught;
2. **The path is relative** — to the importing file;
3. **Exports are declared.** An `экспортирует` line lists the names visible from
   outside. No such line means everything declared is visible.

The standard library works exactly this way: `flang/stdlib/` is sixteen files
with no special relationship to the compiler. Your own package is a file, sitting
wherever you like.

## The lock: dependencies inside one file

```bash
node flang/bin/flang.mjs lock docs/examples/operations.flang > flang.lock
```

Run on 18 August 2026: a **4 764-byte** file with five imports produced a
**14 343-byte** lock. Inside is JSON with fields `схема`, `вход`, `модули`,
`печать`, and each module carries **the dependency's own parse**, reversibly
compressed — not a link to it and not a hash of it.

Hence the main property, verified by running it: **the dependency sources need
not be on disk at all.** The file and the lock were copied into an empty
directory from which `flang/stdlib/` is unreachable by any relative path:

```
$ ls
flang.lock  operations.flang
$ node …/flang.mjs check operations.flang
{"valid":true,"module":"Операции","functions":[…99 functions…],"diagnostics":[]}
```

All 99 functions are there, 93 of them from the library. There is no store —
there is nowhere to download from, because everything is already in the lock.

The lock is picked up automatically: if `flang.lock` sits next to the input file,
every command reads imports from it.

## What the lock catches, and what it does not

Verified by corrupting the same file three ways:

| Corruption | Answer |
| --- | --- |
| one character inside a module body (`адрес`) | refusal `FLANG_LOCK`: "Decompression failed" |
| first character of the lock's seal | refusal `FLANG_LOCK`: "печать замка не сходится: замок правлен или испорчен" |
| field `функций` changed from 28 to 27 | **accepted silently, the check passed** |

The third row is not nitpicking about a detail; it is the boundary of the lock's
honesty. The seal certifies **code**; the accompanying numbers next to it are not
certified. `функций` is a note for a human reading the lock by eye, and the
program does not verify it. Worth knowing before you cite it in a report.

## What is missing — as a list

- **a registry and a store.** There is nowhere to publish; `flang add` does not
  exist;
- **versions.** The lock carries no version number and no range for a
  dependency; neither does `использует`. Updating a dependency means running
  `lock` again, whole;
- **conflict resolution.** Two modules with one name inside one lock is a case
  that was never worked through; do not build on it;
- **partial updates.** The lock is replaced whole: it holds code, not a hash, and
  nothing can swap one dependency inside it except a fresh `lock`;
- **an author signature.** The lock's seal certifies integrity, not authorship:
  it answers "this file was not edited", not "this file is from whom you think".

Which of these arrives when: see the [roadmap](roadmap.html). What you can build
on today is the two things that work: the path and the lock.

## Next

- [Operations](operations.html) — what does what inside a module
- [Modularity and packages](../modules.html) — in Russian; the measurement and the design
- [Real case studies](case-studies.html) — how this looks on a 1 152-line service
