# The catalogue of examples

Every example program in flang lives in one directory — `docs/examples/`: <!-- СНЯТО 2026-11-10 файлов docs/examples/*.flang = 350 --> 350 files in
twenty-six sets and one full-size project. There is no second directory of examples
in the repository.

The number is recounted by one command:
`git -c core.quotepath=false ls-files docs/examples | grep -c '\.flang$'` → <!-- СНЯТО 2026-11-10 файлов docs/examples/*.flang = 350 --> 350.

## The sets

| Directory | `.flang` files | About what |
|---|---:|---|
| [`leetcode/`](docs/examples/leetcode) | 82 | solutions to LeetCode problems; every file is self-contained on purpose — why, is said in [`index.json`](docs/examples/leetcode/index.json). The account of this set is [82 problems](case-studies.html) |
| [`rosetta/`](docs/examples/rosetta) | 28 | the canonical Rosetta Code tasks, each on the Russian and on the English surface of the language. The account of the set is [Rosetta Code](rosetta.html) |
| [`web/`](docs/examples/web) | 13 | HTTP: an orders service, the [URL shortener](shortener.html) and a marketplace API of three services — catalogue, cart, orders |
| [`io/`](docs/examples/io) | <!-- СНЯТО 2026-09-19 файлов docs/examples/io/*.flang = 10 --> 10 | I/O orders: a binary file there and back, octets over the wire, a child process, an HTTPS request, a temporary directory, parsing a packet, a progress bar on the terminal |
| [`crypto/`](docs/examples/crypto) | 8 | AES, ECDSA, X25519, X.509, a revocation list, a TLS hello — on real test vectors that lie next to them |
| [`dsl/`](docs/examples/dsl) | 2 | free shipping and document access, from text to a typed rule |
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

## Build a small DSL

Start with a line someone can read and edit without knowing flang. Write down
what each word means and which inputs should be rejected. In both examples
the parser turns text into a value or an explicit error. A separate function
uses the value to make a decision. The `.dsl` files contain the rules;
the `.flang` files implement their grammar and behavior.

### Free shipping

[`shipping.dsl`](docs/examples/dsl/shipping.dsl)

```text
Shipping is free when the order total is at least 50
Otherwise shipping costs 7
```

The two lines set the free-shipping threshold and the price below it. An order of 50 ships for 0. An order of 49 ships for 7. Both amounts come from the rule. Try replacing 50 with `many` to see the error.
[Implementation](docs/examples/dsl/shipping.flang)

```sh
bootstrap/flang run docs/examples/dsl/shipping.flang --function 'Разобрать доставку' \
  --args '{"текст правила":"Shipping is free when the order total is at least 50\nOtherwise shipping costs 7"}'
```

The parser returns `{"вариант":"Правило","порог":50,"обычная цена":7}`.

### Access to a document

[`access.dsl`](docs/examples/dsl/access.dsl)

```text
Editors can publish documents
```

`Editors` and `Readers` name the supported roles. `publish documents` and `read documents` name the supported actions. This rule grants editors permission to publish. Reading requires its own rule.
[Implementation](docs/examples/dsl/access.flang)

```sh
bootstrap/flang run docs/examples/dsl/access.flang --function 'Разобрать доступ' \
  --args '{"текст правила":"Editors can publish documents"}'
```

The result contains `{"вариант":"Правило","право":{"роль":"editor","действие":"publish"}}`.

Run both sets of examples from the repository root:

```sh
bootstrap/flang test docs/examples/dsl/shipping.flang
bootstrap/flang test docs/examples/dsl/access.flang
```

To extend a DSL, first add an example of the new sentence and one of a similar
sentence you still want to reject. Update the parser and check the resulting
value. Change the decision function when the new sentence adds a new kind of
decision.

A larger example is [parsing a Russian utterance against a concept graph](russian-syntax.md).
There a line names a grammar concept, and the program finds it and checks agreement
between word forms.

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
