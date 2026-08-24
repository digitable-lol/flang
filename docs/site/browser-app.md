# An application in the browser

"Hailstones" is an application in a browser tab, written entirely in flang. Not a
harness: it shows state, answers a person's actions, computes.

Type a number in digits, press "start" — and the number falls by the Collatz
rule: an even one is halved, an odd one is tripled plus one. "Step" moves it by
one tick, "run" counts by itself until stopped.

```sh
sh web/sobrat.sh                                          # emit the module in JavaScript
bootstrap/flang io web/stand.flang --max-orders 1000000   # bring the harness up
# open http://127.0.0.1:8908/
```

No Node, no npm, no `python3 -m http.server`: the binary compiler emits the
module, and a harness written in flang (`web/stand.flang`) serves the page.

There used to be no build at all — the page imported `flang/src/parser.mjs` and
parsed `hailstone.flang` right inside the tab. The second implementation of the
language is no longer in the tree, and with it the page lost all three imports:
**the application would not open at all**. Now an emitted module travels into the
tab — 61 453 bytes against nearly two megabytes of compiler.

## How much of what is written

| lines | what | in what |
|---:|---|---|
| **301** | `web/app/hailstone.flang` — the whole application | flang |
| **499** | `web/stand.flang` — the harness that serves the page | flang |
| 397 | `flang/src/emit/js/flang_host_browser.js` — the tab's host | JavaScript |
| 241 | `web/browser-probe.sh` — a run in a real browser | shell |
| 88 | `web/app/index.html` — markup; lines of JavaScript in it: **zero** | HTML |

Lines of JavaScript written by hand for this page: **zero**. The startup tag
carries two attributes and not a single expression:

```html
<script type="module" src="../../flang/src/emit/js/flang_host_browser.js"
        данные-модуль="./gradiny.js"></script>
```

The tab's host is not the application's own code but the body of the "js" emit
target: it is one for every page in the tree and it must be in the target's
language, exactly as `flang/src/emit/c/*.c` must be in C.

Of the 301 flang lines, **106** are examples (`пример`, `дано`, `ожидается`) —
a third of the file is checks lying next to what they check. **16** functions,
**16 of 16** total, **31** examples, **0** failed.

The host, without comments, is **158** lines. It contains zero application logic:
it knows nothing about Collatz and nothing about buttons — it knows about places
and events.

## The push loop fitted the existing arrangement. Edits in `runPlan`: zero

This is the main measurement of the work, and the answer came out other than
expected.

The order loop is a **pull** loop: `runPlan` asks the program for the next order
itself. The browser is a **push** world: events call the program. The estimate was
"1 function + 1 edit in 1 file". The number of edits turned out to be **0**,
because the inversion had already been done by one line written long before any
browser:

```js
отклик = проверитьОтклик(await исполнить(поручение), поручение, план)
```

`await` **is** the inversion of control. The browser host returns a promise
resolved by `addEventListener`; while the plan waits, the stack is empty, the tab
is alive and responsive, and what wakes the plan is not the program but a person
or a clock. A run confirms it with a number: "run" took 27 down to one in **111
ticks**, each of them a wake-up by the clock, and "reset" after them worked
immediately.

So a pull loop and a push world are not opposites. The loop looks like a pull loop
from inside the program; from outside it is exactly as much of a push loop as the
host wants it to be.

### What the inversion did cost — three things, all named

**1. The order limit is a batch program's measure.** `DEFAULT_MAX_ORDERS` is
10 000, and for a program that ends this is a trap for a looping one. For a tab
the same number means "the application dies after five thousand key presses". It
is fixed by the caller (`maxOrders: Infinity` in `index.html`), no edit in
`io.mjs` was needed — but the default is wrong for an application, and that is
worth remembering.

**2. The `runPlan` log is a leak that grows at the speed of a person's actions.**
The log accumulates `{order, answer}` for every order and is handed to nobody
until the end of the plan, which an application does not have. One flight of the
number 27 is **225 records** over forty seconds. A tab left open for an hour with
"run" on will accumulate hundreds of thousands of them. This is **not fixed**:
fixing it means editing `io.mjs`, and every edit there drags the reference
implementation along, so doing it in passing would be dishonest. It is stated with
a number so it does not get forgotten.

**3. The continuation machine waits for EXACTLY ONE thing.** `«Продолжение»`
carries a single field, an order, so two simultaneous waits cannot be expressed.
And the application has two sources: a person and a clock. So they are folded into
one order — `«Ждать событие» с срок равным 350` means "wake me on a person's
action or in 350 ms, whichever comes first". This is not a way around the
restriction but its correct reading: the choice of "whichever comes first" belongs
to the host, while the program names both conditions at once.

## What was not dragged into the language, and why

Neither `DOM`, nor `window`, nor `addEventListener`, nor `querySelector` — not in
the dictionary (`flang/src/io.mjs`), not in the specification, not in a single
line of `.flang`. The program names a **place** — the string `"экран"`, which it
invented itself — and does not know where the host will put that place. The border
is the same as the one between a path and a file descriptor.

**An order carries TEXT, not markup.** This is a deliberate refusal, and here is
its price. For the program to be able to describe appearance (lists, tables,
nesting), the dictionary would need a fourth sum — a markup tree — whereas the
fields of built-in sums are flat today: `string`, `number`, `any`. A recursive
named type inside a built-in sum would have to be repeated in the reference
implementation and in eight emit targets. So the host draws the appearance and the
program hands it text; there is no `innerHTML` in the host and there will not be —
allowing markup would mean dragging into the dictionary a second language the
program is not written in and nobody checks. The same argument with the same
numbers stands in the [URL shortener](shortener.html), and that is no coincidence:
both applications share one host.

**Totality is intact.** The task was chosen for exactly that: `«Шаг градины»` is a
total function, while whether the sequence terminates has been proved by nobody in
the world. And the language does not demand it: no function repeats the step, the
step is repeated by a person or by a clock. Non-termination lives in the host's
loop — the same place it lives for a service — and the event handler turned out to
be exactly the same total step the request handler already was.

## What checks it without hands

Two runs, and the second found what the first had missed.

**`flang/test/host-browser.test.mjs` — without a browser.** A stand-in document:
an object with `querySelector`, `querySelectorAll` and `addEventListener`, thirty
lines. The real host works with it the same way it works with a tab's window — the
same technique by which `nodeHost` is checked without a network. Six checks, among
them "the clock wakes the plan by itself" (6 → 1 in 8 steps without a single key
press) and "presses that happened while the plan was computing are not lost".

**`web/browser-probe.sh` — in a real browser, without Node and without npm.**
Playwright is taken from the environment, it is not among flang's dependencies.
Six screen comparisons, all byte-for-byte.

The second run found a fault invisible to the first: a button in HTML **does**
have a `value` property, and it is an empty string. The host asked for it before
the declared `данные-значение` and got emptiness from every press — in the browser
the application answered "unknown key «»" to every digit, and it was 1 comparison
out of 6. The stand-in page did not catch this, because it had no `value` at all.
Both were fixed: the host and the check. The mutation is confirmed — with the old
order, 3 checks out of 6 fail.

## What is left of the seven points of the gap

**5 of 7** are closed: screen orders (+2 instead of +4), screen answers (+3), the
browser host (250 lines), the event loop (0 edits), agreement (6 files instead of
7 — six is how many there turned out to be).

**2** are not closed:

* **a markup type** — deliberately, the reason is above: an order carries text;
* **emitting plans into targets** — in the browser the plan used to be executed by
  the interpreter, loaded as sixteen modules. That worked and loaded in 245 ms,
  but an emitted module is many times lighter. For the `js` target this has since
  been closed — the account of that closure stands in the
  [URL shortener](shortener.html); the other seven targets refuse with
  `FLANG_PLAN_UNSUPPORTED`, and that is named there too.
