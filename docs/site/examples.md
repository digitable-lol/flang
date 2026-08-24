# The catalogue of examples

Every example program in flang lives in one directory — `examples/`: 172 files in
fifteen sets and one full-size project. There is no second directory of examples
in the repository: until 24 August 2026 a hundred and fifty programs stood a floor
below, and they could not be found at a glance.

The number is recounted by one command:
`git ls-files examples | grep -c '\.flang$'` → 172.

## The sets

| Directory | `.flang` files | About what |
|---|---:|---|
| [`leetcode/`](examples/leetcode) | 82 | solutions to LeetCode problems; every file is self-contained on purpose — why, is said in [`index.json`](examples/leetcode/index.json). The account of this set is [82 problems](case-studies.html) |
| [`rosetta/`](examples/rosetta) | 28 | the canonical Rosetta Code tasks |
| [`cat/`](examples/cat) | 12 | category theory on applied problems: arrows with promises of their own, laws, CRDT merge |
| [`web/`](examples/web) | 9 | HTTP: an orders service and the [URL shortener](shortener.html) — eight files, a plan and a service |
| [`io/`](examples/io) | 9 | I/O orders: a binary file there and back, octets over the wire, a child process, an HTTPS request, a temporary directory, parsing a packet |
| [`crypto/`](examples/crypto) | 8 | AES, ECDSA, X25519, X.509, a revocation list, a TLS hello — on real test vectors that lie next to them |
| [`library-api/`](examples/library-api) | 7 | the domain half of a library REST service: lending, catalogue, fines. The only set that shows a **project layout** in full |
| [`db/`](examples/db) | 4 | talking to PostgreSQL (SCRAM included), to Redis, and reading an SQLite file |
| [`measure/`](examples/measure) | 3 | termination by a declared measure: Euclid, binary search, natural numbers |
| [`errors/`](examples/errors) | 2 | failure as a value rather than a crash: summing a column of numbers that arrived as strings, parsing numbers |
| [`surfaces/`](examples/surfaces) | 2 | factorial on the Chinese and the Esperanto surface of the language |
| [`wal/`](examples/wal) | 2 | a write-ahead log: parsing, printing, recovery after a truncation |
| [`monad/`](examples/monad) | 1 | an order total written in the `в монаде` form |
| [`money/`](examples/money) | 1 | money on the exact decimal type `сотых` |
| [`paths/`](examples/paths) | 1 | the shortest path over a network with unreachable nodes |
| [`import-check.flang`](examples/import-check.flang) | 1 | a probe of linking modules by name |

## How to run them

Examples are declared inside functions rather than in separate check files, and
they are run by the binary:

```bash
bootstrap/flang test examples/rosetta/   # one set
bootstrap/flang test examples/           # all sixteen
```

The sets cost very different amounts, and that is worth knowing before you start.
The run of 24 August 2026: `leetcode` — 82 files, 804 examples, 12 seconds;
`crypto` — 8 files, 1223 examples, 39 minutes, because it computes real AES and
ECDSA test vectors. A file the binary did not accept is named together with the
refusal code rather than skipped in silence.

## About `library-api`

`library-api` stands apart in this row, and that is the only thing in which the
sets here differ from one another. The other fifteen are programs: a file with
declarations that carry their own examples. `library-api` is a project: seven flang
modules, one of them its own, with a directory layout of its own. The example shows
not HTTP but a border: what moves into the language, where a piece of logic has a
runnable example, and what stays with the host. The host here was on Node and was
removed on 20 August 2026 together with the rest of the JavaScript scaffolding; the
flang half remained and is checked by a command. The rules drawn from this layout
are collected in the [repository layout](project-layout.html).

## Where to go next

- [How to learn the language further](learning.html) — a reading order in which
  the examples are the fourth step;
- [A study of 82 leetcode problems](case-studies.html) — what proved out on live
  code and what did not;
- [The URL shortener](shortener.html) and [an application in the
  browser](browser-app.html) — two programs taken apart in full.
