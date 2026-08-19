# Real case studies

Three cases taken from the tree, not invented for this page: eighty-two leetcode
tasks, a URL-shortener service, and the supervision over its processes. For each
one: **what exactly is proven**, and what the proof costs.

## Case 1. Eighty-two leetcode tasks

`flang/examples/leetcode/` — 82 files, 7 607 lines. Counted by declaration:

| | |
| --- | --- |
| functions | 300 |
| of those total | **298** |
| ordinary | 2 |
| executable examples | 804 |
| postconditions (`обеспечивает`) | **2** |

This table has to be read both ways, and the second way matters more.

**What is proven.** 298 of 300 functions carry proven termination. This is not
"the tests passed": the compiler would refuse to build the file if it could not
show that the recursion bottoms out. For tasks like "search in a rotated sorted
array" or "trapping rain water" that is exactly where infinite loops live, and it
is closed before the program runs.

**What is not proven, visible in the same table.** The whole corpus holds **two**
postconditions, both in task 13, roman numerals to integer:

```
  обеспечивает «значение цифры неотрицательно» результат не меньше 0
  обеспечивает «значение цифры не больше тысячи» результат не больше 1000
```

So for 298 functions it is proven that they **stop**, and for almost none of them
that they **compute the right thing**. Correctness here is carried by 804
examples, and an example is a claim about one input. The gap between "proven" and
"correct" is the specification, and the leetcode corpus puts a number on its size.

**The two ordinary functions are named.** `«Шаг счастья»` and `«Счастливое»` from
task 202. They do terminate — the sequence of digit-square sums falls into a
cycle — but that cannot be shown by structural descent, so the file honestly
writes `функция` rather than `тотальная функция`. Two out of three hundred: the
price of the `тотальная` marker on real tasks is measurable, and it is small.

## Case 2. The URL-shortener service

`flang/examples/web/shortener/` — **2 162 lines**: 1 743 of flang across seven
files plus 419 lines of three Node hosts that read bytes off the connection and
hand bytes back. Between input and output there is not one line that is not flang.

| File | Lines | What is in it |
| --- | --- | --- |
| `service.flang` | 594 | outcome, theorems, routing, HTTP parsing and printing |
| `plan-durable.flang` | 381 | the same service on top of a write-ahead log |
| `server.flang` | 229 | processes, supervision, three runs |
| `plan-network.flang` | 198 | the same service through a real socket |
| `store.flang` | 155 | codes, addresses, redirect counter |
| `plan.flang` | 133 | the same handler through file I/O |
| `handler-without-budget.flang` | 53 | the exhibit: it does not compile, and that is the point |

The ledger run:

```bash
flang check flang/examples/web/shortener/service.flang --proof
```

```
функций 83: тотальных 83, обычных 0
обещание несёт: композиция 80, структура 2, постоянный шаг 1
утверждений 7: доказано 5 (из них индукцией 3), сетка 2, аксиом 0 (шагов в термах 30)
```

**Why this is valuable.** A web service whose **all 83 functions are total** is a
service where no request can drive a handler into an infinite loop. Not "we found
no such request" but "no such request exists". For an HTTP parser fed bytes off
the network that is the most expensive property available.

**Three proofs by induction** run over the type «Исход», an enumeration of ten
cases. It is proven that the response code always comes from the declared set,
that the code's explanation is non-empty, and that "the outcome succeeded" and
"the code succeeded" are the same thing. A bug of the form "returned 200 with an
error body" fails type checking here rather than being caught by a test.

**Two claims landed on a grid, not on a proof,** and the ledger says so verbatim:
"сетка 1 значение (примеры функции) … Это не доказательство — теоремы при
утверждении нет". About "the response body is no longer than the declared limit"
exactly this much is known: no violation was found on the written examples.

Running the service's examples: `flang test …/server.flang` — **240 examples,
240 passed, 0 failed**. The binary does not run the three process runs at all;
with them there are 243 examples, and all 243 pass under the reference
implementation.

## Case 3. Supervision: what happens when the loop budget runs out

This is where provability and operations meet. A handler whose termination is
proven needs no budget. A handler whose termination is not proven must name one —
`обрабатывает «шаг пересчёта» с запасом 2000 витков` — or **type checking rejects
the file**. And a process that can fail with no supervisor over it is rejected as
well: `FLANG_UNCOVERED_FAILURE`.

```mermaid flowchart TD What happens when the 2000-iteration budget runs out
flowchart TD
  A[a message arrives<br>for process «Пересчёт»] --> B{termination<br>proven?}
  B -->|yes| C([handler with no budget<br>finished])
  B -->|no| D[count iterations<br>budget 2000]
  D --> E{budget<br>exhausted?}
  E -->|no| C
  E -->|yes| F[message rejected<br>process crashed]
  F --> G[state stays as it was<br>BEFORE the run: the handler<br>is pure, half a change<br>never happens]
  G --> H[supervisor «Приём»<br>strategy «перезапустить»]
  H --> I{third failure<br>within 5000 ms?}
  I -->|no| J([process restarted<br>with its initial value])
  I -->|yes| K[fallback strategy<br>«остановить»]
  J --> L([the service is ALIVE<br>and keeps answering])
  C --> L
  class F,K otkaz
  class C,J,L vyvod
  class D,G,H glavnoe
```

The diagram does not restate the text above; it answers the question prose asks
badly: **what survives of the state, and who brings the crashed process back**.
Three runs in `server.flang` check exactly these arrows:

- `запас кончился у одного — служба жива и досчитала переход`: «Пересчёт» was
  restarted **exactly once**, its state went back to zero, and the store of
  «Служба» is intact — the link created before the crash is still there and its
  redirect is counted;
- `злонамеренный вход не роняет службу и не будит надзор`: a truncated request,
  two content lengths, an oversized header — **0 supervisor decisions**. A total
  handler crashes on nothing;
- `третье исчерпание запаса в окне уходит на запасную стратегию`: **seeds 1
  through 200** — two "restart" decisions and one "stop" across all two hundred
  interleavings.

The seed grid is not decoration: the threshold window is measured in handler
runs, and how many of those fit between failures is a matter of interleaving, not
arithmetic.

## Next

- [What is proven and what is checked](../overview.html) — in Russian; the ledger for the whole tree
- [Why and how](proofs.html) — how the proof kernel works
- [Processes and fault tolerance](../spec-conc.html) — in Russian; the supervision spec
