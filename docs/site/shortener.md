# URL shortener: service and client

One demonstration in two halves, and both are written entirely in flang.

- **The service** — `examples/web/shortener/`: the input is the bytes the host
  read from the connection, the output is the bytes the host will send back.
  Between them there is not one line written in anything but flang.
- **The client** — `web/shortener/`: the form, the submit, the list of links and
  the redirect counter, in a browser tab. Not a harness and not another counter
  demo: a real service answers it.

## How to look at it

```sh
export LC_ALL=C.UTF-8
bootstrap/flang check examples/web/shortener/service.flang --proof
bootstrap/flang test  examples/web/shortener/server.flang
bootstrap/flang io    examples/web/shortener/plan.flang --in-dir
```

The client in a tab:

```sh
sh web/sobrat.sh
bootstrap/flang io web/stand.flang --max-orders 1000000
# open http://127.0.0.1:8908/web/shortener/index.html
```

No Node, no npm, no `python3 -m http.server`: the binary compiler emits the
module and a harness written in flang (`web/stand.flang`) serves the page.

## The service

```
store.flang                    155   storage: codes, addresses, redirect counter
service.flang                  580   outcomes, theorems, routing, parsing and printing
server.flang                   229   processes, supervision, three runs
plan.flang                     133   the same handler over file I/O
handler-without-budget.flang    53   EVIDENCE: does not compile, and that is the point
                              ─────
                              1 150   lines, all of them flang
```

It rests on `flang/stdlib/http.flang` (1358 lines, 58 total functions).

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

`check --proof` on `service.flang`: **83 functions, 83 total, 0 ordinary, 0
unaccounted. 7 claims: 5 proved, 2 by grid, 0 taken on faith, 0 rejected, 0
axioms.**

Proved (a statement about ALL inputs):

1. `код ответа из объявленного набора` — by induction over "Outcome", base 10
   cases;
2. `пояснение кода непусто` — the same, 10 cases;
3. `успех исхода и успех кода — одно и то же` — the same, 10 cases;
4. `ссылок не бывает меньше нуля` — by reducing the goal against the body;
5. `глубина неотрицательна` — by reduction.

Checked by grid (NOT proved, and it is written here rather than hidden):

6. `урезанное не длиннее предела` — grid of 3;
7. `тело ответа не длиннее заявленного предела` — grid of 1.

Claims 6 and 7 run into `подстрока`: closing them would mean being able to prove
things about a substring, and the kernel has no such rule. The label is honest —
the word "proved" stands only where the statement covers all inputs.

**The importing file's ledger does not carry the three inductions**, and that is
not a loss: `flang/src/link.mjs` deliberately does not merge theorems of imported
modules — a proof is closed where the theorem is written, and re-checking someone
else's work in every importer would mean doing the same work as many times as
there are imports. That is why in the ledger of `server.flang` the same three
claims stand as "by grid".

### What the proof itself found

The theorem `пояснение кода непусто` was **rejected by the kernel on the first
run** — `FLANG_PROOF_STEP` on the case "address is not valid": the service
declared code 422, and the table of explanations in the library knew nothing
about it and returned an empty word. The status line `HTTP/1.1 422 ` is legal by
the letter and unreadable in practice. The branch was added to
`flang/stdlib/http.flang`, with the evidence written down next to it.

Supervision in `server.flang` at first covered only the recount — rejected with
`FLANG_UNCOVERED_FAILURE`: the scheduler has a ceiling of its own at a million
steps, and a total handler can hit it without looping, simply by not finishing in
time. Hence the division the compiler considers right: **totality removes
`с запасом N витков` and only that; supervision is needed by both.**

### What it can do today and what it cannot

It can (checked by the `serve.mjs` run, sixteen requests): all ten outcomes,
including four malicious inputs — a truncated request (silence, not a refusal),
two body lengths (400), a megabyte header (431), a hundred and one headers (431),
a megabyte body (413).

**It works OVER THE NETWORK** — the `serve-network.mjs` run, the same sixteen
requests but through a real socket on `127.0.0.1:39281`, one connection per
request:

```
200 201 301 200 404 405 404 422 409 413 0 400 431 431 204 404
```

The codes are compared inside the run itself against those produced by
`serve.mjs`, where the bytes were passed as a value; if even one diverged, the
run fails. Zero is the silence on a truncated request: the connection is closed
without a single byte written. 413 is for the megabyte body that arrived over TCP
in pieces and was assembled by the PROGRAM, not by the host.

The service itself did not change by a single character: `service.flang`,
`store.flang` and `stdlib/http.flang` are the same. What changed is the PLAN —
that is, where the bytes come from: `plan.flang` (files) and `plan-network.flang`
(socket) take apart the host's answer with the very same branches, because
reading from a connection answers `«Прочитано»` and answering into a connection
answers `«Записано»`, the same variants a file uses.

The price named in `plan.flang` was "2 orders + 2 answers"; it came out at **3
orders and 1 answer**, and the difference is named in both directions: `«Слушать»`
did not need an order of its own (the port is named right inside
`«Принять соединение»`, and the host opens the listening socket on the first
accept), while `«Прочитать из соединения»` did turn out to be needed — without it
a megabyte body arriving in sixteen packets would reach the service as its first
chunk and be declared incomplete.

What it cannot do, stated with numbers:

| what is missing | price |
|---|---|
| keep-alive: an accepted connection lives for one exchange | 1 order "close connection" + a branch in the plan; today `«Ответить в соединение»` writes the answer and closes the socket |
| the PROCESS server (`server.flang`) over the network | 229 lines here and all of `conc.mjs`: the scheduler is synchronous, and `«Принять соединение»` has to wait. The same barrier as `«Запросить»`, and it is named in `nodeHostSync` |
| `Content-Length` in octets | 1 function "how many bytes in a UTF-8 string": `длина` counts characters, the specification counts octets, and on Cyrillic that is twice as many |
| resuming the parse where it stopped | 75 reads instead of 16 over sixteen connections: "serve" parses what has accumulated FROM THE START, and two megabyte inputs account for nearly all the extra work |

### What the service lacks to be put into production

Six things without which a service is not put into production, and where each of
them stands here. "Beyond the host's border" means it is not the language's job
and cannot be done in the language without breaking the arrangement; "missing
entirely" means it is the language's job and nobody has done it.

| what | as it stands | price |
|---|---|---|
| **persistence** | **PRESENT** — `plan-durable.flang`: a write-ahead log, recovery at startup | 218 lines of plan |
| **shutdown** | **beyond the host's border** — the plan ends when the host closes the port (`хозяин.закрыть()`), and that is the only legal ending | 0 |
| **fault tolerance** | **half of it is there**: supervision over processes is in `server.flang` (7 mentions), but I/O plans have no supervision; the plan handles a host failure itself, with branches | 1 branch per order |
| **concurrent access** | **missing entirely, and it runs into the host**: `runPlan` is synchronous, an accepted connection lives for one exchange, the second client waits for the first | scheduler + `nodeHostSync` |
| **observability** | **missing entirely**: no `/metrics`, no event log; the connection count exists only in the plan's result, and a live plan cannot be asked | 1 path + 2 state fields |
| **configuration** | **missing entirely**: the port (`39283`) and the log name (`"служба.wal"`) are named in the program as a number and a string; the plan takes no arguments and the program does not see the environment | plan arguments or 1 order |

### The service with a log — what the language is made for

`plan-durable.flang` is the third plan for the same service (the first went
through files, the second through a socket). The service did not change by a
single character; the plan did.

```sh
node examples/web/shortener/serve-durable.mjs     # three runs
node --test flang/test/shortener-durable.test.mjs        # 11 checks
```

**What the shape of the program proves.** A successful answer to a mutating
request is built in exactly one place in the whole module — inside the branch
`случай вариант «Записано»`. A sweep of 5 states × 13 host answers (the list of
answers is closed by the language) finds that place exactly once; on any other
answer a 503 goes out, and the **old** storage and the **old** log travel on.

**What the run shows.** `serve-durable.mjs`, three runs:

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

**Evidence found by the pairing.** While the service answered in the same step in
which it read, `serve-network.mjs` passed all sixteen connections. The moment a
log was put between the read and the answer, 5 mutating requests out of 8 got
**zero bytes** instead of an answer — even though the host executed all eight
"answer into connection" orders and the log on disk was correct. The cause was
`createServer` without `allowHalfOpen`: node closed its half of the connection on
the client's FIN. One word of a fix in `flang/src/host/node.mjs`; after it
`serve-network.mjs` gives the same 16 codes.

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
| **488** | `client.flang` — the whole application | flang |
| 106 | `index.html` — markup and 4 lines of startup | HTML |
| 342 | `flang/test/app-shortener.test.mjs` — a run without a browser | JavaScript |

Of the 488 flang lines, **186** are examples (`пример`, `дано`, `ожидается`):
38 % of the file are checks lying right next to what they check. **32** functions,
**32 of 32** total, **51** examples, **0** failed, **0 places** with runtime
guards in the emitted code.

Application logic in JavaScript — **zero lines**: not one decision about links,
codes, redirects or what to show is taken there.

**488 lines of `.flang` against 342 of `.mjs`, and that is only the run without a
browser.** The harness and the in-browser run (391 lines between them) were
deleted together with the second implementation they rested on.

### There is NO markup type in the language, and that is a decision, not an omission

`flang/stdlib/view.flang` does not exist. The argument has three points, and the
first of them is measured.

**First: markup is not expressible without editing the effect dictionary, and the
same assignment forbids editing it.** The order `«Показать»` carries a place and
a text. For it to carry a markup tree, the dictionary would need a fourth sum — a
recursive named type inside a built-in sum — whereas the fields of built-in sums
are flat today (`string`, `number`, `any`). The dictionary exists in two copies at
once (`flang/src/io.mjs` and its twin in flang) and is compared byte for byte, so
the edit means work in both implementations and in eight emit targets.

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
законов на сетке: 0; на веру: 0
```

All 32 are "proved by composition": there is no recursion in any of them, the
promise is assembled from the promises of those they call. Not one required a
declared measure, which means the emitted code contains no runtime checks at all.

**What this does NOT prove, and it has to be said out loud.** It is proved that
every step terminates. It is not proved, and cannot be proved here, that the
sequence of steps is finite — the application has no `«Конец работы»` branch at
all, it ends when the tab is closed. Non-termination lives in the host's loop,
exactly where it lives for the service.

### A run in a real browser

`web/shortener/probe.mjs` (deleted), HeadlessChrome 151, the harness came up by
itself. Six screen comparisons, all byte-for-byte, all green:

```
браузер: Mozilla/5.0 (X11; Linux x86_64) … HeadlessChrome/151.0.0.0 Safari/537.36
план поехал за 194 мс от goto

✔ открылось и само спросило у службы список
✔ набранный адрес доехал до программы целиком
✔ служба выдала код, и список обновился тем же ходом
✔ переход по короткой ссылке двинул счётчик службы
✔ злой адрес отвергнут службой, приложение живо
✔ вкладка жива после шести витков: обновление сработало

несошлось: 0
```

### Weight: what the tab carries

Measured with one and the same instrument (`page.on("response")` in the deleted
`probe.mjs`, every response over the whole six-comparison scenario,
HeadlessChrome 151), before and after the application started running from an
emitted module:

| | responses | bytes | of them, the second implementation of the language |
|---|---:|---:|---:|
| before: the tab parsed the source itself | 27 | **1 768 447** | 16 files, 1 683 164 |
| after: the tab carries emitted code | 11 | **102 675** | 0 files, **0** |

A difference of **17.2 times**, and the second implementation of the language does
not travel into the tab at all. What the tab carries now, by file:

| what | bytes |
|---|---:|
| `index.html` — markup and four lines of startup | 7 744 |
| `klient.js` — the emitted module together with the plan runner | 70 243 |
| `flang_host_browser.js` — the tab's host, zero imports | 24 475 |
| the service's answers over the whole scenario | 213 |

The emitted module is printed by the harness at startup and served from memory:
there is no file in the tree, so there is nothing to go stale. By hand the same is
done like this:

```
bootstrap/flang emit web/shortener/client.flang \
  --target js --no-cli --out <directory>
```

## Where the browser and the service disagree — five places and a sixth

None of them is about the language or about the application: this is the debt of
a service written before the language had a browser.

1. **there is not one CORS header.** The entire set of response headers is
   `Content-Type` and, on a redirect, `Location` (`service.flang`, "response
   headers"). The service serves no static files, so it has no "same origin" from
   which to serve the page at all;
2. **the service answers `OPTIONS` with 405** — the browser's preflight never
   reaches the service;
3. **Cyrillic paths are needed as raw bytes, and the browser percent-encodes
   them.** `GET /ссылки` raw gives 200; `GET /%D1%81%D1%81...` gives **404**. The
   service has **3 Cyrillic paths out of 3**;
4. **`Content-Length` is counted in CHARACTERS, not bytes.** The body `адрес=…`
   begins with six Cyrillic characters — that is 6 characters and **11 bytes**.
   The browser will set the length in bytes, the service will consider the request
   incomplete and wait for more;
5. **one connection, one exchange**, and `Connection: close` is not sent.

Plus a sixth, found by this very work and costing one failed redirect: the service
puts a **raw Cyrillic address** into `Location`, and such a header is accepted
neither by Node (`ERR_INVALID_CHAR`) nor by a browser. It showed up as
`500 Moved Permanently` — code 500 with a status line from a 301.

## What ran aground — and what is already closed

### CLOSED: the generator emitted the application's functions and silently dropped the plan

What stood here: `flang emit … --target js` ends with code **0**, without a single
diagnostic, emits the entire application — both plan functions included — and
loses the declaration `план «Стойка ссылок»`, **0 bytes**. The emitted module
could compute and could not work.

Closed entirely, with three edits, and each of them where a sample already stood
alongside:

* **the plan descriptor** is emitted as data (`const $io = {…}`) and handed out
  through two doors — `ioPlan()` and `ioRun(name, host)`. By the same generator
  that emits `concPlan()`, and on both sides at once: `flang/src/emit/js.mjs` and
  `flang/self/emit-js.flang` are compared byte for byte, 108 corpus programs out
  of 108;
* **the plan runner** — `flang/src/emit/js/flang_io.js`, a port of `runPlan` onto
  the value representation of the emitted module. It is emitted INSIDE the module,
  the way the concurrency scheduler is: the module stays self-contained;
* **the silence** is fixed separately from the emission: a target must either emit
  the plan or refuse, naming the plan — there is no third outcome. That rule is
  written in `flang/cat/SPEC.md`, and as of 22 August 2026 the binary holds it:
  `emit --target js` emits the declaration and answers 0, the other seven targets
  refuse with `FLANG_PLAN_UNSUPPORTED` and code 1 without writing a file.
  `scripts/plan-across-targets.flang` checks this.

The host moved to `flang/src/emit/js/flang_host_browser.js` with zero imports;
`flang/src/host/browser.mjs` became a transitional line that substitutes the
interpreter's variant factory. There is ONE host implementation, not two.

### CLOSED: percent-decoding ran into one missing form

**What was found.** The translation "browser → service" is percent-decoding back
into raw UTF-8. It could not be written in flang, and it ran into exactly one
thing: the language had no bridge from a number to a string character. The bridge
the other way existed (`код символа`), this one did not.

In numbers, on the day of the find: **20** built-in forms, of which **0** lead
from a number to a string character. That is why `flang/stdlib/http.flang`
decoded percents only for codes **32…126** — that is **95 code points out of
1 114 112** — and called it "a named limit of the language, not a shortcoming of
the module". `/ссылки` is 7 characters and 13 bytes, and **0** of them fell into
those 95.

**What it became.** The form exists: `символ по коду`, the twenty-first built-in,
the inverse of `код символа`, on all four surfaces of the language. Decoding in
`http.flang` now reaches a character for **1 112 064 scalar values out of
1 112 064** (halves of surrogate pairs are rejected with a refusal rather than
combined: in four emit targets out of eight a string is UTF-8, and such a half is
not written there at all).

**How the closure is confirmed.** The probe of the service's routes runs every
route in two forms, as a raw path and as a browser-encoded one: it was **16 out of
28**, it became **28 out of 28**. It was checked separately that decoding happens
AFTER the path is split: `%2F` inside a segment stays a character and does not
produce an extra segment. The Cyrillic routes — 3 out of 3 — answer on a
browser-encoded path.

What is left of the find is what should be left of it: the conclusion "the harness
has to be in JavaScript" rested on this form, and rests on it no more.

### NOT closed: the screen is one-way

The program reads input fields but cannot write them. It is visible in a
screenshot: after "clear", the program considers what was typed empty, while the
field in front of the person still holds the previous text. Orders that write to
the screen: **one** (`«Показать»`, and it writes `textContent`); orders that write
into an input field: **0**. What diverged is not the pictures but the state: the
program and the person see different things.

The same assignment forbids extending the dictionary, so it is only named here. It
would cost one order variant and one branch in the host.

## How this relates to its neighbour

[An application in the browser](browser-app.html) — "Hailstones", an application
of the same build: the same host, the same order loop, the same pure handler. The
one difference is substantial: in Hailstones everything is closed on itself, while
here there is **waiting for someone else's answer**. That is exactly what dragged
three of the four sticking points above into the open.
