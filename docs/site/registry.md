# The package registry

The flang registry is a **list of names**, not a store of code. The list is a
line-based file: five fields per line separated by «|», and nothing else. Asked
which version of a package will do, the registry answers with an **address**
where the package lies, not with the package; a name gets a version here, in the
list, and nowhere else; the language gains no new word for any of it. No server,
no database and no accounts are needed — and by decision there are none. The
whole argument:
[ADR-0059](../adr/0059-the-registry-is-a-ledger-of-names-not-a-store-of-code.md).

## The list is a file at a stable address

```
https://digitable-lol.github.io/flang/registry.list
```

It is a plain file served over HTTP. A flang program fetches it with the order
the language already has — «Запросить»:

```
вариант «Запросить» с способ равным "GET"
  и адрес равным "https://digitable-lol.github.io/flang/registry.list"
  и тело равным ""
```

What the site serves is a copy of the same file from the tree,
[`scripts/registry-example/registry.list`](../../scripts/registry-example/registry.list),
unchanged — put there by the same build that prints this page.

## The five fields

| field | what is in it |
|---|---|
| name | the package name — what stands in `использует` |
| version | three numbers: major, minor, patch |
| fingerprint | `sha256` of the package file |
| address | where the package file lies: a full URL, or a path relative to the list's own directory |
| needs | what the package requires of other names; empty means nothing |

A need reads `name: range`, needs are separated by semicolons. There are four
ranges: `любая`, `ровно 1.2.3`, `не ниже 1.2.3`, `в пределах 1.x`. Parsing the
list and choosing a version are written and proved in
[`flang/stdlib/registry.flang`](../../flang/stdlib/registry.flang). The whole file
format, for whoever writes or serves it, is
[registry-list-format.md](../registry-list-format.md).

## Install a package by name

```
flang run-script package:install проба/proba.flang 'Множество строк: не ниже 1.1'
```

The command takes this list, picks the greatest version that satisfies the needs
of the project and of the packages themselves, downloads the files, checks their
`sha256` before writing, puts them next to the program and writes `flang.lock`.
Details are on the [packages page](packages.html); the list address comes from
`--registry` or from the `registry` key in `.flangrc`. Installing again into an
empty directory gives exactly the same lock — the check
`package-install:check` and the CI job of the same name hold that.

## The records as they stand

The table below is printed **from that file** by
`flang run-script registry:page`; it is not edited by hand — an edit is lost at
the next printing.

| name | version | fingerprint | address | needs |
|---|---|---|---|---|
| Логика | 1.0.0 | `518d5932c0744c74d14afb8f4713a27d1b597e25a40e129291eeefda7ab254a3` | `logic-1.0.0.flang-package` |  |
| Логика | 1.2.0 | `adcd4da25035634dad1df489cf16073c591479e5c3362bd41b14ead9e90ee1d6` | `logic-1.2.0.flang-package` |  |
| Логика | 2.0.0 | `72d0c42d6f6bda0139f927aa25fea58b45bb46e027cf5fa01ce7a8f253af04f0` | `logic-2.0.0.flang-package` |  |
| Списки | 1.4.2 | `7d0a021fa77a2c5eb47124eb09356c58e5918a42593c718c289e4062676f1f08` | `lists-1.4.2.flang-package` | Логика: не ниже 1.0.0 |
| Множество строк | 1.0.0 | `cf3a1697ccc1e7c2fa4fd72b3210ad5372590c0844f13e07119fa290a1f69931` | `sets-1.0.0.flang-package` | Логика: не ниже 1.0.0 |
| Множество строк | 1.1.0 | `a9a776e153d9789c7e29f8c66ad92df36a834f21630c6388b41ebd4f8d2effc2` | `sets-1.1.0.flang-package` | Списки: в пределах 1.x; Логика: в пределах 1.x |
| Опциональное значение | 0.9.0 | `17eac86ce77be366094d22be0f537d4bab5bb00958fb41df3bd7353060957c7d` | `optional-0.9.0.flang-package` | Логика: ровно 2.0.0 |

Records in the list: 7.

## The fingerprint is checked against the file as the page is printed

The fingerprint is the only thing trust in someone else's package rests on, and
it rots silently. So the same run that prints the table recomputes the `sha256`
of every address and compares it with the fingerprint field. One character apart
and the page is not printed at all: the run exits with 1 and
`FLANG_REESTR_OTPECHATOK`, names the record, both fingerprints and the address,
and the site build goes red on it instead of reaching the reader.

The check is not a precaution: the fingerprints in the example did part
from the files once, and there was nobody to see it — no CI job called the
registry at all (task 4909, done: the guard
`scripts/guards/registry-resolution-guard.fscript` and the CI job `registry-resolution`).
