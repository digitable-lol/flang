# URL shortener: service and client

One demonstration in two halves, and both are written entirely in flang.

- **The service** — `docs/examples/web/shortener/`: the input is the bytes the host
  read from the connection, the output is the bytes the host will send back.
  Between them there is not one line written in anything but flang.
- **The client** — `docs/examples/web/shortener-client/`: the form, the submit, the list of links and
  the redirect counter, in a browser tab. Not a harness and not another counter
  demo: a real service answers it.

## How to look at it

```sh
export LC_ALL=C.UTF-8
bootstrap/flang check docs/examples/web/shortener/service.flang --proof
bootstrap/flang test  docs/examples/web/shortener/server.flang
bootstrap/flang io    docs/examples/web/shortener/plan.flang --in-dir
```

The client in a tab:

```sh
sh docs/examples/web/build.sh
bootstrap/flang io docs/examples/web/stand.flang --max-orders 100000
# open http://127.0.0.1:8908/docs/examples/web/shortener-client/index.html
```

No Node, no npm, no `python3 -m http.server`: the binary compiler emits the
module and a harness written in flang (`docs/examples/web/stand.flang`) serves the page.

## The service

```
store.flang                    137   storage: codes, addresses, redirect counter
service.flang                  675   outcomes, theorems, routing, parsing and printing
server.flang                   136   processes, supervision, three runs
server-network.flang            30   the same processes over the network
plan.flang                      74   the same handler over file I/O
plan-network.flang             122   the same handler over a socket
plan-durable.flang             273   the same handler with a write-ahead log
handler-without-budget.flang    36   EVIDENCE: does not compile, and that is the point
                              ─────
                              1 483   lines, all of them flang
```

Line counts by `wc -l`.

It rests on `flang/stdlib/http.flang` (1 370 lines, 64 total functions —
`wc -l`, `grep -c '^тотальная функция'`).

### What it does

| method | path | answer |
|---|---|---|
| GET | `/здоровье` | 200 `живой` |
| GET | `/ссылки` | 200, one line per link |
| POST | `/ссылки` | 201 + code; body `адрес=…` and optional `код=…` |
| GET | `/с/{код}` | 301 + `Location`, the redirect is counted |
| DELETE | `/ссылки/{код}` | 204 |

Refusals: 400 bad request, 404 no such path or code, 405 wrong method for a
known path (not 404 — the service does not lie about the reason), 409 code
taken, 413 request body longer than 2048, 422 address is neither http nor https.

### What is proved and what is merely run

`bootstrap/flang check docs/examples/web/shortener/service.flang --proof`:
**24 functions, 24 total,
0 ordinary. 8 claims: 5 proved (4 of them by induction), 3 by grid, 0 declared
and unproved, 0 rejected; 0 laws on faith. Exit code 0.**

Proved (a statement about ALL inputs):

1. `код ответа из объявленного набора` («Код исхода»);
2. `пояснение кода непусто` («Код исхода»);
3. `успех исхода и успех кода — одно и то же` («Исход успешен»);
4. `октетов от одного до четырёх` («Октетов в знаке»);
5. `печать ответа начинается версией, кодом и пояснением` («Напечатать ответ
   службы»).

Checked by grid (NOT proved, and it is written here rather than hidden):

6. `урезанное не длиннее предела` («Урезать»);
7. `тело ответа не длиннее заявленного предела` («Тело решения»);
8. `в печати ответа длина тела названа в октетах` («Напечатать ответ службы»).

Claims 6–8 run into `подстрока` and `содержит`: closing them would mean being
able to prove things about a substring and about containment, and the kernel has
no such rules. The label is honest — the word "proved" stands only where the
statement covers all inputs.

The ledger of `server.flang`: 7 functions (5 total, 2 ordinary),
0 claims — theorems of an imported module are not carried into the importer's
ledger; the proof is closed where the theorem is written.

### What the proof catches

The theorem `пояснение кода непусто` is what keeps every declared code readable:
if the service declares a code (422, "address is not valid") that the table of
explanations in `flang/stdlib/http.flang` does not know, the table returns an
empty word, the status line becomes `HTTP/1.1 422 ` — legal by the letter and
unreadable in practice — and the kernel rejects the theorem with
`FLANG_PROOF_STEP` on that case.

Supervision in `server.flang` has to cover every process, not only the recount:
supervision of the recount alone is rejected with `FLANG_UNCOVERED_FAILURE`. The
scheduler has a ceiling of its own at a million steps, and a total handler can hit
it without looping, simply by not finishing in time. Hence the division the
compiler considers right: **totality removes `с запасом N витков` and only that;
supervision is needed by both.**

### What it can do today and what it cannot

It can (the sixteen requests are `plan-network.flang`; `plan.flang` runs
one request over files — two orders, answer 201, exit code 0): all ten outcomes,
including four malicious inputs — a truncated request (silence, not a refusal),
two body lengths (400), a megabyte header (431), a hundred and one headers (431),
a megabyte body (413).

**It works OVER THE NETWORK** — the `plan-network.flang` run (it needs a live
socket), the same sixteen requests but through a real socket on `127.0.0.1:39281`, one connection per
request:

```
200 201 301 200 404 405 404 422 409 413 0 400 431 431 204 404
```

The codes are compared inside the run itself against those produced by
`plan.flang`, where the bytes were passed as a value; if even one diverged, the
run fails. Zero is the silence on a truncated request: the connection is closed
without a single byte written. 413 is for the megabyte body that arrived over TCP
in pieces and was assembled by the PROGRAM, not by the host.

Both runs use the same service: `service.flang`,
`store.flang` and `stdlib/http.flang`. What differs is the PLAN —
that is, where the bytes come from: `plan.flang` (files) and `plan-network.flang`
(socket) take apart the host's answer with the very same branches, because
reading from a connection answers `«Прочитано»` and answering into a connection
answers `«Записано»`, the same variants a file uses.

The network costs **3 orders and 1 answer**: `«Слушать»`
does not need an order of its own (the port is named right inside
`«Принять соединение»`, and the host opens the listening socket on the first
accept), while `«Прочитать из соединения»` is needed — without it
a megabyte body arriving in sixteen packets would reach the service as its first
chunk and be declared incomplete.

What it cannot do, stated with numbers:

| what is missing | price |
|---|---|
| keep-alive: an accepted connection lives for one exchange | 1 order "close connection" + a branch in the plan; today `«Ответить в соединение»` writes the answer and closes the socket |
| the PROCESS server (`server.flang`) over the network | 136 lines here and all of the scheduler of the JavaScript host: it is synchronous, and `«Принять соединение»` has to wait. The same barrier as `«Запросить»`, |
| `Content-Length` in octets | closed for the RESPONSE: `service.flang` prints the body length through «Длина тела в октетах» and «Октетов в знаке» (postcondition «в печати ответа длина тела названа в октетах», by grid). Whether the service counts the INCOMING body length in octets is not checked here |
| resuming the parse where it stopped | 75 reads instead of 16 over sixteen connections: "serve" parses what has accumulated FROM THE START, and two megabyte inputs account for nearly all the extra work |

### What the service lacks to be put into production

Six things without which a service is not put into production, and where each of
them stands here. "Beyond the host's border" means it is not the language's job
and cannot be done in the language without breaking the arrangement; "missing
entirely" means it is the language's job and nobody has done it.

| what | as it stands | price |
|---|---|---|
| **persistence** | **PRESENT** — `plan-durable.flang`: a write-ahead log, recovery at startup | 273 lines of plan |
| **shutdown** | **beyond the host's border** — the plan ends when the host closes the port (`хозяин.закрыть()`), and that is the only legal ending | 0 |
| **fault tolerance** | **half of it is there**: supervision over processes is in `server.flang` (3 mentions of the word «надзор»), but I/O plans have no supervision; the plan handles a host failure itself, with branches | 1 branch per order |
| **concurrent access** | **missing entirely, and it runs into the host**: `runPlan` is synchronous, an accepted connection lives for one exchange, the second client waits for the first | a scheduler in the host |
| **observability** | **missing entirely**: no `/metrics`, no event log; the connection count exists only in the plan's result, and a live plan cannot be asked | 1 path + 2 state fields |
| **configuration** | **missing entirely**: the port (`39283`) and the log name (`"служба.wal"`) are named in the program as a number and a string; the plan takes no arguments and the program does not see the environment | plan arguments or 1 order |

### The service with a log — what the language is made for

`plan-durable.flang` is the third plan for the same service (the first went
through files, the second through a socket). The service is the same; only the
plan differs.

```sh
bootstrap/flang io docs/examples/web/shortener/plan-durable.flang --in-dir
```

**What the shape of the program proves.** A successful answer to a mutating
request is built in exactly one place in the whole module — inside the branch
`случай вариант «Записано»`. A sweep of 5 states × 13 host answers (the list of
answers is closed by the language) finds that place exactly once; on any other
answer a 503 goes out, and the **old** storage and the **old** log travel on.

**What the run shows.** `plan-durable.flang`, three runs:

| run | what | result |
|---|---|---|
| 1 | no log existed; 8 requests, 5 of them mutating | 200 201 301 301 201 204 404 200; 253 characters on disk, 5 records |
| 2 | **the plan started again**, state taken from the log | `GET /ссылки` returned exactly what stood at the end of run 1, redirect counter 2 included |
| 3 | a host whose file writes always fail | 503 instead of 201, storage stayed empty, no log file |

**Why recovery costs a single fold.** What goes into the log is the request
itself, not its consequence; recovery is re-serving the records. That is legal
precisely because the handler is a pure total function: a clock, a random number
and a reach outside are inexpressible in it, and `тотальная` is checked by the
compiler. In an ordinary language this would be an assumption someone has to
guard.

**How the fork is shown to be honest.** The set of codes declared mutating (201,
204, 301) is not eyeballed: over 24 pairs of "initial storage × request" the check
compares storage before and after and demands agreement with what was declared.
Recovery is compared against live state on all 13 prefixes of the scenario and on
all **375 truncations** of the log.

**Teeth.** Codes are removed from the fork one at a time — all three removals go
red. The fourth (adding code 200 to the fork) **does not go red**, and that is
recorded as a separate check rather than swept away: an extra record on replay
yields the same storage, because reading state does not change it. The price of
the extra code is not correctness but bytes: 7 records against 9 on the same
scenario.

**What this service does NOT guarantee.**

* **Durability.** The answer "written" means "the host said it wrote". `fsync`,
  the disk cache and write reordering by the controller are the OS and the
  hardware. No run ever cut the power.
* **That the log will not lose its tail on power loss.** The plan rewrites the
  file whole (there is no append among the language's orders), and what happens
  to the file when power goes in the middle of a rewrite is not checked here by
  anything.
* **Concurrent access.** There are no two writers into one log and none are
  intended; the second client waits for the first.
* **Integrity of a record's body.** There is no checksum: a flipped bit in the
  middle of a body leaves the record intact with a corrupted body.
* **That the log does not grow.** There is no compaction: every mutating request
  adds a record forever, and recovery costs replaying the whole history.
* **Units of measurement.** Length is counted in code points, not octets — the
  same gap as with `Content-Length`.

## The client in a tab

**The page opens, but the service is not yet wired to it.** The application
starts and draws its screen, yet every request comes back refused: there is no
service on that port. One named thing is in the way — the divergences between the
browser and the service, listed below.

### How much of what is written

| lines | what | in what |
|---:|---|---|
| **453** | `client.flang` — the whole application | flang |
| 100 | `index.html` — markup and 4 lines of startup | HTML |

Of the 453 flang lines, **186** are examples (`пример`, `дано`, `ожидается`):
41 % of the file are checks lying right next to what they check. **32** functions,
**32 of 32** total, **51** examples, **0** failed, **0 places** with runtime
guards in the emitted code.

Application logic in JavaScript — **zero lines**: not one decision about links,
codes, redirects or what to show is taken there.

### There is NO markup type in the language, and that is a decision, not an omission

`flang/stdlib/view.flang` does not exist. The argument has three points, and the
first of them is measured.

**First: markup is not expressible without editing the effect dictionary.** The order `«Показать»` carries a place and
a text. For it to carry a markup tree, the dictionary would need a fourth sum — a
recursive named type inside a built-in sum — whereas the fields of built-in sums
are flat (`string`, `number`, `any`). The dictionary lives in
`flang/self/io.flang`, and the edit means work there and in
{{цели.поАнглийски}} emit targets.

**Second: a second answer to the same question diverges from the first silently.**
The browser host writes `textContent`, not `innerHTML`, and that is written not
out of caution but as a contract: allowing markup would mean dragging into the
dictionary a second language the program is not written in and nobody checks.

**Third, and this one is already a measurement: what exists was ENOUGH.** A screen
with the list, the counters and the message fit into one place and one text. And
splitting the screen into several places would cost more than it seems:
`«Продолжение»` carries EXACTLY ONE order, so K places means K orders per redraw.
Measured on the scenario "opened → typed an address → pressed shorten":

| order | how many times |
|---|---:|
| `«Показать»` | 6 |
| `«Ждать событие»` | 5 |
| `«Запросить»` | 3 |
| **total** | **14** |

Six redraws for three actions. With a screen of four places this would have been
24 orders instead of 6 — four times as many trips through the host for the same
frame. So the choice "one place, one text" is not only cheaper to write here, it
is cheaper to run.

### How the application is built

The state is a single record of five fields. There is no "where we are" field in
it: the point at which the program waits for the host is named by the ANSWER
itself — we showed something, so next we wait; we were answered, so next we
compute. The field `«дело»` answers a different question — "what is intended" —
and without it a person would not see the line "sending to the service…": the
screen would refresh only together with the answer.

A chain of two requests in a row is written and checked: "a link was created"
itself intends "go fetch the list", because after a creation the screen must show
a fresh list rather than the previous one. It is visible in the log:
`POST /ссылки` → `GET /ссылки`.

The handler is **pure**: no branch does anything, each of them returns a value.
All the checkability rests on this — 51 examples run without a browser and
without a network, because there is nothing to run, it is a computation.

### The client's proof ledger

```
функций 32: тотальных 32, обычных 0
обещание несёт: композиция 32, структура 0, точный шаг 0, постоянный шаг 0, объявленная мера 0
сторожей в рантайме: 0 мест
законов на сетке: 0 (значений в сетках 0); на веру: 0
утверждений 43: доказано 43 (из них без теоремы 43), сетка 0, объявлено, не доказано 0
```

(`check --proof` on `client.flang`; the client has no grid.)

All 32 are "proved by composition": there is no recursion in any of them, the
promise is assembled from the promises of those they call. Not one required a
declared measure, which means the emitted code contains no runtime checks at all.

**What this does NOT prove, and it has to be said out loud.** It is proved that
every step terminates. It is not proved, and cannot be proved here, that the
sequence of steps is finite — the application has no `«Конец работы»` branch at
all, it ends when the tab is closed. Non-termination lives in the host's loop,
exactly where it lives for the service.

### What the tab carries

| what | bytes |
|---|---:|
| `index.html` — markup and four lines of startup | 6 216 |
| the emitted module together with the plan runner (`stoyka_ssylok.js`) | 90 937 |
| `flang_host_browser.js` — the tab's host, zero imports | 30 257 |

No file of the language implementation travels into the tab: only emitted code
and the host.

The emitted module is printed by the harness at startup and served from memory:
there is no file in the tree, so there is nothing to go stale. By hand the same is
done like this:

```
bootstrap/flang emit docs/examples/web/shortener-client/client.flang \
  --target js --no-cli --out <directory>
```

## Where the browser and the service disagree — five places and a sixth

None of them is about the language or about the application: this is the debt of
the service.

1. **there is not one CORS header.** The entire set of response headers is
   `Content-Type` and, on a redirect, `Location` (`service.flang`, "response
   headers"). The service serves no static files, so it has no "same origin" from
   which to serve the page at all;
2. **the service answers `OPTIONS` with 405** — the browser's preflight never
   reaches the service;
3. **Cyrillic paths are needed as raw bytes, and the browser percent-encodes
   them.** `GET /ссылки` raw gives 200; `GET /%D1%81%D1%81...` gives **404**. The
   service has **3 Cyrillic paths out of 3**;
4. **`Content-Length` counts bytes, not characters.** The body `адрес=…`
   begins with six Cyrillic characters — that is 6 characters and **11 bytes**.
   For the response this is closed: the body length is printed in octets
   («Длина тела в октетах» in `service.flang`). Whether the service counts the
   incoming body length in octets is not checked here;
5. **one connection, one exchange**, and `Connection: close` is not sent.

Plus a sixth: the service puts a **raw Cyrillic address** into `Location`, and
such a header is accepted neither by Node (`ERR_INVALID_CHAR`) nor by a browser:
the redirect fails as `500 Moved Permanently` — code 500 with a status line from
a 301.

## How a plan gets into the tab

`flang emit … --target js` emits the plan declaration `план «Стойка ссылок»`
together with the application's functions:

* **the plan descriptor** is emitted as data (`const $io = {…}`) and handed out
  through two doors — `ioPlan()` and `ioRun(name, host)`, by the same generator
  that emits `concPlan()`;
* **the plan runner** — `flang/src/emit/js/flang_io.js`, a port of `runPlan` onto
  the value representation of the emitted module. It is emitted INSIDE the module,
  the way the concurrency scheduler is: the module stays self-contained;
* **no silent loss**: a target must either emit the plan or refuse, naming the
  plan — there is no third outcome. That rule is written in `docs/ct/spec.md`:
  `emit --target js` emits the declaration and answers 0, the other nine targets
  refuse with `FLANG_PLAN_UNSUPPORTED` and code 1 without writing a file.
  `scripts/targets/plan-across-targets.fscript` checks this.

The tab's host is `flang/src/emit/js/flang_host_browser.js`, with zero imports.

### Percent-decoding

The translation "browser → service" is percent-decoding back into raw UTF-8, and
it is written in flang, in `flang/stdlib/http.flang`. It rests on the built-in
`символ по коду`, the inverse of `код символа`, available on all four surfaces of
the language. Decoding reaches a character for **all 1 112 064 scalar values**
(halves of surrogate pairs are rejected with a refusal rather than combined: in
the emit targets where a string is stored as UTF-8 — C, Go, Rust — such a half is
not written at all).

Decoding happens AFTER the path is split: `%2F` inside a segment stays a
character and does not produce an extra segment. The Cyrillic routes — 3 out of
3 — answer on a browser-encoded path.

### Not closed: the screen is one-way

The program reads input fields but cannot write them. It is visible in a
screenshot: after "clear", the program considers what was typed empty, while the
field in front of the person still holds the previous text. Orders that write to
the screen: **one** (`«Показать»`, and it writes `textContent`); orders that write
into an input field: **0**. What diverged is not the pictures but the state: the
program and the person see different things.

Closing it means extending the effect dictionary. It would cost one order variant and one branch in the host.

## How this relates to its neighbour

[An application in the browser](browser-app.html) — "Hailstones", an application
of the same build: the same host, the same order loop, the same pure handler. The
one difference is substantial: in Hailstones everything is closed on itself, while
here there is **waiting for someone else's answer**. 
