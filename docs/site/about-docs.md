# How these docs are made

The documentation version is the language version: **{{выпуск.версия}}** right
now. There is deliberately no separate numbering for documents: two numbers
drift apart, one does not.

## The footer

Two lines stand at the bottom of every page, and the build puts them there, not
a human.

The first is about the project: who makes the language, under which licence,
where the tree is, where a bug report goes.

```
The language is made by Digitable (Marat Zimnurov) · BSD 2-Clause, © 2026,
the verbatim text is LICENSE at the root of the tree ·
source — github.com/digitable-lol/flang · bug reports — issues in the same repository
```

Not one fact in it is typed. The copyright holder, the year and the licence name
are read from `LICENSE`, both addresses from `package.json`; the licence name in
the file is checked against the package's `license` field, and a disagreement
fails the build. A typed year would go stale on 1 January and a typed address on
the day the repository moves — both of them silently.

The second is about the page itself: which version of the language it describes
and which tree its numbers were taken on.

```
flang documentation 0.5.0 · tree 83a0b5d of 2026-08-18 · built 2026-08-18
```

The commit and the date come from `git rev-parse --short HEAD` and
`git log -1 --date=short` at build time; the version comes from `package.json`.
In an export without `.git` (`git archive`) the line honestly says it could not
name the tree, instead of naming a wrong one.

## The mark in the header

The mark is drawn by the build itself and inlined into every page: no image
file, no request to anywhere else — the site has to open without a network
whole, not almost whole. It has no colour of its own; it takes the colour of the
word beside it and therefore flips with the dark theme on its own. Its measure is
24 pixels: that is where it was checked, and it must not be set smaller.

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

## Search

Search runs entirely in the browser: the site sits on GitHub Pages, and there is
no server behind it. The index is assembled by the build
(`docs/site/poisk.mjs`) and placed beside the pages as a single file,
`poisk-ukazatel.js`; the search over it is `poisk.js` — ours, without a single
library, exactly like the markdown parser.

The index does not hold the full text. The full text of every page is some 1.8
million characters, close to three megabytes: an index that heavy would take
longer to load than the page it was opened for takes to read. So a page's entry
holds its title, its section, all of its subheadings, and the **first 700
characters** of its text. The cut is justified by the shape of the tree, not
only by weight: a knowledge-base note opens with its claim, and a site page
opens with what it is about. The exact weight of the index is printed by the
build, on its own line next to the page count.

The index is fetched on the first touch of the search field, not with every
page: a reader who came to read does not need it, and once fetched it stays in
the browser cache.

Two rules serve Russian, which is the main case here. "Ё" and "е" are one letter
for search — the tree contains both «свёртка» and «свертка», and the language
glossary holds them in neighbouring cells of one row. And words are compared by
stem rather than whole, so «свёртка» finds «свёртке» and «тотальность» finds
«тотальную».

Without JavaScript there is no search field at all: it is marked `hidden` and
opened by the script. The page then stays what it was — the side table of
contents in place, everything readable. A field that takes letters and answers
nothing is worse than no field.

## What guards it

| Command | What it prevents |
|---|---|
| `npm run numbers:check` | leaving a number on the site that has drifted from the tree |
| `npm run site:check` | a page without its English pair, a link to nowhere, a substitution with no value, a broken search |
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
