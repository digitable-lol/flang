# How these docs are made

The documentation version is the language version: **{{выпуск.версия}}** right
now. There is deliberately no separate numbering for documents: two numbers
drift apart, one does not.

## The provenance line

One line stands at the bottom of every page, and the build puts it there, not a
human:

```
flang documentation 0.5.0 · tree 83a0b5d of 2026-08-18 · built 2026-08-18
```

The commit and the date come from `git rev-parse --short HEAD` and
`git log -1 --date=short` at build time; the version comes from `package.json`.
In an export without `.git` (`git archive`) the line honestly says it could not
name the tree, instead of naming a wrong one.

## Dates in the prose

A date stands in the prose only where it is part of the fact: "release 0.4.8 of
9 August 2026", "measured on such a machine on such a day". Marks of work in
progress — "the fix was made on 16 August", "this was still true in the morning
and stopped being true by the evening" — have been removed. The question "what
does this page describe" is answered by the provenance line, and answered more
precisely.

## Numbers

A number is not typed into a page. The text carries a substitution,
`{{корпус.функций}}`, and the value arrives at build time from
`docs/site/numbers.json` — one number, one place. A large number can be asked
for in groups: `{{корпус.строк|разрядами}}` gives {{корпус.строк|разрядами}}.

The measurement is taken by one command:

```
npm run numbers
```

The corpus is measured by `flang/scripts/proof-ledger.mjs`, the same instrument
the number guard uses. A quick ad-hoc count lies instead: import linking
attributes a module's functions to every importer, and the answer doubles.

What is written down has no right to go stale:

```
npm run numbers:check
```

re-measures the tree and turns red on the first number that differs. So the
numbers in `numbers.json` are not "numbers as of some day" but the numbers of
THIS tree — the very one whose commit stands at the bottom of the page. Today
that is {{корпус.функций}} functions in the corpus and {{утверждения.доказано}}
claims proved by the kernel, and no page may name others.

## What guards it

| Command | What it prevents |
|---|---|
| `npm run numbers:check` | leaving a number on the site that has drifted from the tree |
| `npm run site:check` | a page without its English pair, a link to nowhere, a substitution with no value |
| `npm run links:check` | breaking a link to a file of the tree by renaming it |
| `npm run glossary:check` | the glossary page and the surface table drifting apart |

## Where things live

Texts live in `docs/`, the page map in `docs/site/sitemap.mjs`, the build is
`node docs/site/build.mjs`. A printed page is edited in its printer, not in the
`.md`: the [merge journal](../changelog.html) —
`scripts/build-changelog-page.mjs`, the [commit journal](../journal.html) —
`scripts/build-changelog.mjs`, the [releases](releases.html) —
`scripts/build-releases-page.mjs` together with the notes in
`docs/release-notes.json`.
