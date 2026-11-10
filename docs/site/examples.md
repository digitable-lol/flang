# The catalogue of examples

Every example program in flang lives in one directory — `docs/examples/`: <!-- СНЯТО 2026-11-10 файлов docs/examples/*.flang = 349 --> 349 files in
twenty-six sets and one full-size project. There is no second directory of examples
in the repository.

The number is recounted by one command:
`git -c core.quotepath=false ls-files docs/examples | grep -c '\.flang$'` → <!-- СНЯТО 2026-11-10 файлов docs/examples/*.flang = 349 --> 349.

## The sets

| Directory | `.flang` files | About what |
|---|---:|---|
| [`leetcode/`](docs/examples/leetcode) | 82 | solutions to LeetCode problems; every file is self-contained on purpose — why, is said in [`index.json`](docs/examples/leetcode/index.json). The account of this set is [82 problems](case-studies.html) |
| [`rosetta/`](docs/examples/rosetta) | 28 | the canonical Rosetta Code tasks, each on the Russian and on the English surface of the language. The account of the set is [Rosetta Code](rosetta.html) |
| [`web/`](docs/examples/web) | 13 | HTTP: an orders service, the [URL shortener](shortener.html) and a marketplace API of three services — catalogue, cart, orders |
| [`io/`](docs/examples/io) | <!-- СНЯТО 2026-09-19 файлов docs/examples/io/*.flang = 10 --> 10 | I/O orders: a binary file there and back, octets over the wire, a child process, an HTTPS request, a temporary directory, parsing a packet, a progress bar on the terminal |
| [`crypto/`](docs/examples/crypto) | 8 | AES, ECDSA, X25519, X.509, a revocation list, a TLS hello — on real test vectors that lie next to them |
| [`dsl/`](docs/examples/dsl) | 1 | a small language for capture rules and its translation to typed values |
| [`library-api/`](docs/examples/library-api) | 7 | the domain half of a library REST service: lending, catalogue, fines. The only set that shows a **project layout** in full |
| [`db/`](docs/examples/db) | <!-- СНЯТО 2026-09-03 файлов docs/examples/db/*.flang = 6 --> 6 | talking to PostgreSQL (SCRAM included), to Redis, and reading an SQLite file |
| [`service-on-processes/`](docs/examples/service-on-processes) | 4 | a service on processes rather than on a three-function example: the claim about an own alternative to OTP, checked at full size |
| [`behavior/`](docs/examples/behavior) | 4 | business rules for the behavior table and its diff: access to a report in two versions and a refactoring, a discount on a number. The account is [the behavior table](https://github.com/digitable-lol/flang/blob/main/docs/guide/behavior-table.ru.md) |
| [`frameworks/`](docs/examples/frameworks) | <!-- СНЯТО 2026-09-08 файлов docs/examples/frameworks/*.flang = 6 --> 6 | a flang decision core under a JavaScript framework host: NestJS, React, Vue. The core is printed to JS and lies next to the host — see below |
| [`https/`](docs/examples/https) | 3 | TLS: the RFC 8448 records, the system trust store, a hello to a real host |
| [`proof-probes/`](docs/examples/proof-probes) | 3 | probes of the proof core itself: the typed-AST door, a refused generic descent, a variant with fields |
| [`driver/`](docs/examples/driver) | 2 | hardware drivers where every function must provably terminate: a UART and an MSI |
| [`measure/`](docs/examples/measure) | 3 | termination by a declared measure: Euclid, binary search, natural numbers |
| [`errors/`](docs/examples/errors) | 2 | failure as a value rather than a crash: summing a column of numbers that arrived as strings, parsing numbers |
| [`surfaces/`](docs/examples/surfaces) | 2 | factorial on the Chinese and the Esperanto surface of the language |
| [`wal/`](docs/examples/wal) | 2 | a write-ahead log: parsing, printing, recovery after a truncation |
| [`monad/`](docs/examples/monad) | 1 | an order total written in the `в монаде` form |
| [`money/`](docs/examples/money) | 1 | money on the exact decimal type `сотых` |
| [`paths/`](docs/examples/paths) | 1 | the shortest path over a network with unreachable nodes |
| [`allocator/`](docs/examples/allocator) | 1 | a memory allocator as a pure automaton: can `malloc` be written in flang, and what does the kernel take about it |
| [`host-boundary/`](docs/examples/host-boundary) | 1 | the seam: flang decides, a C host executes — printed to C, built with the system `cc`, run whole |
| [`service/`](docs/examples/service) | 1 | asking a service |
| [`import-check.flang`](docs/examples/import-check.flang) | 1 | a probe of linking modules by name |

## How to run them

Examples are declared inside functions rather than in separate check files, and
they are run by the binary:

```bash
bootstrap/flang test docs/examples/rosetta/   # one set
bootstrap/flang test docs/examples/           # the whole catalogue
```

The sets cost very different amounts, and that is worth knowing before you start.
On a shared machine: `leetcode` — 82 files, 806 examples, about 14 seconds;
`crypto` — 8 files, 1802 examples (77 of its own, the rest come from the library
modules it imports), about 19 minutes, because it computes real AES and ECDSA
test vectors. A file the
binary did not accept is named together with the
refusal code rather than skipped in silence.

## Create a DSL for capture rules

A domain-specific language (DSL) gives authors words for one job. Here a level
designer edits [a two-line rules file](docs/examples/dsl/example.capture):

```text
neutral after 3 ticks
hostile after 5 ticks
```

1. **Choose the domain and units.** This file specifies how many simulation ticks
   it takes to capture a neutral or a hostile cell. Require the two lines in that
   order, one space between words, and one or two ASCII digits with a value
   from 1 to 99. Accept LF and CRLF and one optional final newline.
2. **Translate the text once at the boundary.** In
   [the flang implementation](docs/examples/dsl/capture.flang),
   `«Разобрать правила»` checks the syntax and returns either a typed
   `«Правила захвата»` record or an error with the first rejected line number.
   The DSL's vocabulary lives in that parser. It requires no changes to the
   flang lexer or any of its four writing surfaces.
3. **Write the decisions against the typed model.** `«Срок захвата»` selects
   the duration from the record. Put the result of each branch into a named
   postcondition. Add examples for valid input, missing or extra lines, and
   mistakes in units or values. In an application, parse the file when loading
   the rules and pass the accepted record to the simulation.

From the repository root, check the examples and both postconditions:

```sh
bootstrap/flang check docs/examples/dsl/capture.flang --proof
bootstrap/flang test docs/examples/dsl/capture.flang
```

To read the sample file, use Node.js to pass its contents as a JSON string to
the flang command:

```sh
args=$(node -e 'process.stdout.write(JSON.stringify({текст:require("node:fs").readFileSync(process.argv[1],"utf8")}))' docs/examples/dsl/example.capture)
bootstrap/flang run docs/examples/dsl/capture.flang --function 'Разобрать правила' --args "$args"
```

The result contains `{"нейтральная":3,"вражеская":5}` in the `правила` field.
Changing `ticks` to `seconds` on the second line returns
`{"вариант":"Ошибка правила","строкаПравила":2}`. Try the same rule
selection the simulation would make:

```sh
bootstrap/flang run docs/examples/dsl/capture.flang --function 'Срок захвата' \
  --args '{"правила":{"нейтральная":3,"вражеская":5},"вражеская":true}'
```

It returns `5`. The two postconditions prove field selection for every input to
that function. The parser examples check specific accepted and rejected files.
If you extend the DSL, add a case for each new form and for the bad input it
might accidentally accept. If an existing file would change meaning, version the
grammar and let the host choose the parser when loading that version.

## About `library-api`

`library-api` stands apart in this row. The other sets are programs: a file with
declarations that carry their own examples (in `frameworks/` a TypeScript host lies
next to such files, see below). `library-api` is a project: seven flang
modules, one of them its own, with a directory layout of its own. The example shows
not HTTP but a border: what moves into the language, where a piece of logic has a
runnable example, and what stays with the host. There is no host in the tree:
the flang half is what remains, and it is checked by a command. The rules drawn from this layout
are collected in the [repository layout](project-layout.html).

## Under JS frameworks

`docs/examples/frameworks/` — three applications with one border: the core of the logic
is written in flang and printed to JavaScript (`bootstrap/flang emit … --target js`),
and the host is a JS framework. The host holds the socket, HTTP, form state and
rendering, and asks the core for the decision. The mark of the border is the same as
in `docs/examples/host-boundary/` with a C host: flang is for what **decides**; the host
keeps what **waits and holds control between decisions**.

| Directory | Host | Core | What the core decides |
|---|---|---|---|
| `docs/examples/frameworks/nestjs-orders/` | NestJS | `core/orders-api.flang` | an orders REST service: query-string parsing, required fields, routing by method and path, the response code (201/200/400/404/405) |
| `docs/examples/frameworks/react-invoice/` | React | `core/cart.flang`, `core/catalog.flang` | a cart total in whole kopecks: the sum, discount steps, the total, invoice lines |
| `docs/examples/frameworks/vue-roman/` | Vue | `core/roman-numerals.flang` | Roman numerals there and back in the range 1..3999 |
| `docs/examples/frameworks/react-ts-pure/` | React + TypeScript | `core/storefront.flang` | a storefront where the components carry zero lines of logic: cart, discount steps, rouble formatting and the reducer are all flang |

The printed module lies in `printed/` of each example and is self-contained: no
dependencies, runs both in Node and in the browser. The host imports it directly
(`src/orders.controller.ts`, `src/App.tsx`, `src/App.vue`). Values at the seam:
list → array, record → object; records are built by `sozdat…` factories from objects
with Russian keys. Function names are transliterations of the Russian ones:
«Обработать запрос» → `obrabotatZapros`, «Сумма корзины» → `summaKorziny`,
«В римские» → `vRimskie`.

What is checked on the tree: every core passes `bootstrap/flang check`; the code
in `printed/` carries a header with the licence and the reprint command; the
printed module answers correctly under `node` by a direct call:

```bash
cd docs/examples/frameworks/vue-roman && node --input-type=module -e \
  'import("./printed/roman_numerals.js").then(m => console.log(m.vRimskie(2024), m.izRimskih("MCMLXXXIV")))'
# MMXXIV 1984
```

Building the host is done with the framework's own commands from each example's
`package.json`: `npm install`, `npm run typecheck`, `npm run build`. It is not
checked on the tree: it needs packages from the network. `node_modules/` and `dist/`
are not part of the examples. To reprint a core, run from the root of the tree, for
example
`bootstrap/flang emit docs/examples/frameworks/vue-roman/core/roman-numerals.flang --target js --out docs/examples/frameworks/vue-roman/printed`;
the files in `printed/` are printed by the compiler and are not edited by hand.

## Where to go next

- [How to learn the language further](learning.html) — a reading order in which
  the examples are the fourth step;
- [A study of 82 leetcode problems](case-studies.html) — what proved out on live
  code and what did not;
- [The URL shortener](shortener.html) and [an application in the
  browser](browser-app.html) — two programs taken apart in full.
