# The catalogue of examples

Every example program in flang lives in one directory — `examples/`: <!-- СНЯТО 2026-09-06 файлов examples/*.flang = 185 --> 185 files in
twenty-two sets and one full-size project. There is no second directory of examples
in the repository: until 24 August 2026 a hundred and fifty programs stood a floor
below, and they could not be found at a glance.

The number is recounted by one command:
`git -c core.quotepath=false ls-files examples | grep -c '\.flang$'` → <!-- СНЯТО 2026-09-06 файлов examples/*.flang = 185 --> 185 (measured 6 September 2026).

## The sets

| Directory | `.flang` files | About what |
|---|---:|---|
| [`leetcode/`](examples/leetcode) | 82 | solutions to LeetCode problems; every file is self-contained on purpose — why, is said in [`index.json`](examples/leetcode/index.json). The account of this set is [82 problems](case-studies.html) |
| [`rosetta/`](examples/rosetta) | 28 | the canonical Rosetta Code tasks, each on the Russian and on the English surface of the language. The account of the set is [Rosetta Code](rosetta.html) |
| [`web/`](examples/web) | 13 | HTTP: an orders service, the [URL shortener](shortener.html) and a marketplace API of three services — catalogue, cart, orders |
| [`io/`](examples/io) | <!-- СНЯТО 2026-09-03 файлов examples/io/*.flang = 9 --> 9 | I/O orders: a binary file there and back, octets over the wire, a child process, an HTTPS request, a temporary directory, parsing a packet |
| [`crypto/`](examples/crypto) | 8 | AES, ECDSA, X25519, X.509, a revocation list, a TLS hello — on real test vectors that lie next to them |
| [`library-api/`](examples/library-api) | 7 | the domain half of a library REST service: lending, catalogue, fines. The only set that shows a **project layout** in full |
| [`db/`](examples/db) | <!-- СНЯТО 2026-09-03 файлов examples/db/*.flang = 6 --> 6 | talking to PostgreSQL (SCRAM included), to Redis, and reading an SQLite file |
| [`service-on-processes/`](examples/service-on-processes) | 4 | a service on processes rather than on a three-function example: the claim about an own alternative to OTP, checked at full size |
| [`frameworks/`](examples/frameworks) | <!-- СНЯТО 2026-09-08 файлов examples/frameworks/*.flang = 4 --> 4 | a flang decision core under a JavaScript framework host: NestJS, React, Vue. The core is printed to JS and lies next to the host — see below |
| [`https/`](examples/https) | 3 | TLS: the RFC 8448 records, the system trust store, a hello to a real host |
| [`proof-probes/`](examples/proof-probes) | 3 | probes of the proof core itself: the typed-AST door, a refused generic descent, a variant with fields |
| [`driver/`](examples/driver) | 2 | hardware drivers where every function must provably terminate: a UART and an MSI |
| [`measure/`](examples/measure) | 3 | termination by a declared measure: Euclid, binary search, natural numbers |
| [`errors/`](examples/errors) | 2 | failure as a value rather than a crash: summing a column of numbers that arrived as strings, parsing numbers |
| [`surfaces/`](examples/surfaces) | 2 | factorial on the Chinese and the Esperanto surface of the language |
| [`wal/`](examples/wal) | 2 | a write-ahead log: parsing, printing, recovery after a truncation |
| [`monad/`](examples/monad) | 1 | an order total written in the `в монаде` form |
| [`money/`](examples/money) | 1 | money on the exact decimal type `сотых` |
| [`paths/`](examples/paths) | 1 | the shortest path over a network with unreachable nodes |
| [`allocator/`](examples/allocator) | 1 | a memory allocator as a pure automaton: can `malloc` be written in flang, and what does the kernel take about it |
| [`host-boundary/`](examples/host-boundary) | 1 | the seam: flang decides, a C host executes — printed to C, built with the system `cc`, run whole |
| [`service/`](examples/service) | 1 | asking a service |
| [`import-check.flang`](examples/import-check.flang) | 1 | a probe of linking modules by name |

## How to run them

Examples are declared inside functions rather than in separate check files, and
they are run by the binary:

```bash
bootstrap/flang test examples/rosetta/   # one set
bootstrap/flang test examples/           # the whole catalogue, 193 files
```

The sets cost very different amounts, and that is worth knowing before you start.
The run of 24 August 2026: `leetcode` — 82 files, 804 examples, 12 seconds
(that set holds 806 examples today);
`crypto` — 8 files, 1223 examples, 39 minutes, because it computes real AES and
ECDSA test vectors (that set holds 1802 examples today, and
`bootstrap/flang test examples/crypto/ --json` took 20 min 30 s, 0 failures —
measured 3 September 2026 on a loaded machine; the growth comes from the
library modules `crypto/` pulls in, not from the set itself). A file the
binary did not accept is named together with the
refusal code rather than skipped in silence.

## About `library-api`

`library-api` stands apart in this row. The other sets are programs: a file with
declarations that carry their own examples (in `frameworks/` a TypeScript host lies
next to such files, see below). `library-api` is a project: seven flang
modules, one of them its own, with a directory layout of its own. The example shows
not HTTP but a border: what moves into the language, where a piece of logic has a
runnable example, and what stays with the host. The host here was on Node and was
removed on 20 August 2026 together with the rest of the JavaScript scaffolding; the
flang half remained and is checked by a command. The rules drawn from this layout
are collected in the [repository layout](project-layout.html).

## Under JS frameworks

`examples/frameworks/` — three applications with one border: the core of the logic
is written in flang and printed to JavaScript (`bootstrap/flang emit … --target js`),
and the host is a JS framework. The host holds the socket, HTTP, form state and
rendering, and asks the core for the decision. The mark of the border is the same as
in `examples/host-boundary/` with a C host: flang is for what **decides**; the host
keeps what **waits and holds control between decisions**.

| Directory | Host | Core | What the core decides |
|---|---|---|---|
| `examples/frameworks/nestjs-orders/` | NestJS | `core/orders-api.flang` | an orders REST service: query-string parsing, required fields, routing by method and path, the response code (201/200/400/404/405) |
| `examples/frameworks/react-invoice/` | React | `core/cart.flang`, `core/catalog.flang` | a cart total in whole kopecks: the sum, discount steps, the total, invoice lines |
| `examples/frameworks/vue-roman/` | Vue | `core/roman-numerals.flang` | Roman numerals there and back in the range 1..3999 |

The printed module lies in `printed/` of each example and is self-contained: no
dependencies, runs both in Node and in the browser. The host imports it directly
(`src/orders.controller.ts`, `src/App.tsx`, `src/App.vue`). Values at the seam:
list → array, record → object; records are built by `sozdat…` factories from objects
with Russian keys. Function names are transliterations of the Russian ones:
«Обработать запрос» → `obrabotatZapros`, «Сумма корзины» → `summaKorziny`,
«В римские» → `vRimskie`.

What is checked on the tree (measured 8 September 2026): every core passes
`bootstrap/flang check`; a fresh `emit --target js` matches the code in `printed/`
(on top of the code there is a header with the licence and the reprint command);
the printed module answers correctly under `node` by a direct call:

```bash
cd examples/frameworks/vue-roman && node --input-type=module -e \
  'import("./printed/roman_numerals.js").then(m => console.log(m.vRimskie(2024), m.izRimskih("MCMLXXXIV")))'
# MMXXIV 1984
```

Building the host is done with the framework's own commands from each example's
`package.json`: `npm install`, `npm run typecheck`, `npm run build`. It is not
checked on the tree: it needs packages from the network. `node_modules/` and `dist/`
are not part of the examples. To reprint a core, run from the root of the tree, for
example
`bootstrap/flang emit examples/frameworks/vue-roman/core/roman-numerals.flang --target js --out examples/frameworks/vue-roman/printed`;
the files in `printed/` are printed by the compiler and are not edited by hand.

## Where to go next

- [How to learn the language further](learning.html) — a reading order in which
  the examples are the fourth step;
- [A study of 82 leetcode problems](case-studies.html) — what proved out on live
  code and what did not;
- [The URL shortener](shortener.html) and [an application in the
  browser](browser-app.html) — two programs taken apart in full.
