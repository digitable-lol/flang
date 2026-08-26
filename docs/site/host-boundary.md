# Where flang ends and the host begins

The language has no interrupts and no inline assembly, and a service loop cannot
be written in it. This page names exactly which layer of a system you can write
in flang, which one you cannot, and how the two layers talk.

The short answer:

> **flang is written for what DECIDES. What WAITS — and what holds control
> between two decisions — belongs to the host.**

"Host" here means a program in another language that takes events from the world
and carries out the answer — usually C. The decision that draws this line is
written down in full in `docs/adr/layer-boundary.md`, together with the runs that
refuted the earlier explanation.

## What the line does NOT mean

The familiar explanation — "flang is for what terminates" — is wrong, and
wrong in a way you can check.

**The language does not forbid an infinite loop.** The mark `тотальная` is a
promise, and the compiler checks exactly that promise. A function without the
mark promises nothing and may have no stopping condition at all — and it passes
the check:

```
$ cat вечный.flang
модуль «Вечный цикл»

функция «Крутить»
  принимает н: число
  возвращает число
  «Крутить» от (н плюс 1)

$ flang check вечный.flang; echo $?
модуль «Вечный цикл»: функций 1, из них с доказанным завершением 0; типов 0
без доказанного завершения: «Крутить»
вечный.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
0
```

Non-termination does not turn into a hang either:
both the evaluator and the printed program count steps and turn exhaustion into
a named refusal, `FLANG_RECURSION_LIMIT`. So what the language forbids is not
the infinite loop but **lying about termination**.

**A scheduler has already been written in flang.** It was quoted for years as
the example of what cannot be written. It sits in the tree —
`flang/conc/scheduler.flang` — and every one of its functions has a proved
termination. "Being a scheduler" turned out to be a property not of the code but
of whoever holds control: take waiting and calling a handler by name out of a
scheduler, and what is left is decisions.

## What cannot be written in flang

Four things, and not one of them is about the length of a loop.

**1. Waiting.** `accept`, `connect`, reading a socket, `poll`, reading the
clock, an interrupt arriving. The language has no word at all for this: the host
waits, and the program receives the result of the wait as an argument.

**2. Control between two decisions.** Between two actions, control must leave
the language. It cannot pass a function to a place where the function arrives as
data, and a program cannot call the host by name — it has no access to the
world. So the loop belongs to the host.

**3. Hardware.** Addresses, registers, memory-mapped device space, the interrupt
vector table. The language has no pointers and no manual allocation, and both
the termination proof and the region-based memory work rest on their absence.

**4. Inline assembly.** The form does not exist in the language, and adding it
would be pointless by construction: the proof kernel reads expressions of the
language and has nothing to say about an inline block. One such block would void
every promise of the function it sits in.

## What can be written in flang

Everything that turns input into output and waits for nothing. This is not a
promise but an inventory of what is already written:

| what | where | functions | of them marked `тотальная` |
| --- | --- | ---: | ---: |
| HTTP parsing and printing | `flang/stdlib/http.flang` | 63 | 63 |
| the AES cipher | `flang/stdlib/aes.flang` | 105 | 105 |
| talking to PostgreSQL | `flang/stdlib/postgres.flang` | 67 | 67 |
| the SHA-256 hash | `flang/stdlib/sha256.flang` | 37 | 37 |
| base64 | `flang/stdlib/base64.flang` | 19 | 19 |
| scheduler decisions | `flang/conc/scheduler.flang` | 54 | 54 |

The count is of function headers in the file. For the scheduler the compiler
says the same, counting the imported module as well:

```
$ flang check flang/conc/scheduler.flang; echo $?
модуль «Планировщик узла»: функций 73, из них с доказанным завершением 73; типов 17; файлов вместе с импортами 2
0
```

Packet parsing, codecs, protocol states, permission checks — and scheduler
decisions in the same row.

## What follows for an operating system

An operating system kernel still cannot be rewritten in flang, but the reason is
a different one, and the difference is not verbal:

> **Waiting** cannot be written in flang. Somebody still has to wait for the
> interrupt, and that somebody is not a flang program.

Hence the honest inventory of what in a system **can** be written in flang:
packet parsing, format parsing, permission checks, protocol states, scheduling
policy — the deciding half. And of what **cannot**: the interrupt handler in the
sense of "what the processor runs off the vector", waiting for a device to be
ready, context switching, the loop itself.

A second, independent obstacle: the host must itself be a program under an
operating system — it calls `open`, `read`, `write`, `fork`. In such a system
flang would sit above the kernel rather than be it.

## The interrupt handler is the subtler case, and the instructive one

An interrupt handler does terminate, and still cannot be written in flang as a
whole — because the other half of its job is waiting and hardware. But the first
half can be, and that is not a small thing.

The tree carries this as a separate example, `examples/driver/uart.flang`. The
driver there is a pure function: "state and event → new state and a list of
register writes". It writes nothing; it **answers what to write**. The host does
the writing, and its whole job is a six-line loop. The state machine, meanwhile,
is proved in full.

Hence the rule that is worth more than any of the particular ones: **measure
lines, not files**. "This touches the world, so it cannot be written in flang" is
almost always said about a file in which the world and the decisions about the
world lie mixed together, and the proportion can be anything at all.

## How the two layers talk

There are two ways, and both are written down as data rather than as convention.

**First: the dictionary of orders.** A program does not perform an action — it
returns a **description of the action**, a variant of the sum type «Поручение».
The host performs it and returns an «Отклик», also a variant; a failure arrives
as a variant, not as an exception, because the language has no exceptions. There
are twenty order variants, and the set is deliberately closed: a function from a
foreign library cannot be called, neither through a shared object nor through a
system call.

From this follows a property that is otherwise lost: a program that goes to the
network is proved to terminate, because the network is not inside it. What
terminates is the description; what waits is the host.

Authority stays with the host rather than with the program: six prohibitions
(`--no-read`, `--no-write`, `--no-net`, `--no-clock`, `--no-random`,
`--no-spawn`), and a forbidden order comes back as `FLANG_IO_DENIED`. That works
precisely because the host knows **what** it is being asked to do.

**Second: printing to a target language plus a hand-written host.** The program
is printed into C (or one of eight target languages), and the host is written by
hand: it holds the loop, waits for events and calls the printed function. That
is the example on this page.

Processes have the same shape: the plan, the handlers and the supervision rules
are in flang; the loop, the operating system threads and the network wait are in
C. This is the largest live example of the boundary in the tree, and by lines it
looks like this:

| what | where | lines |
| --- | --- | ---: |
| scheduler: loop, threads, network wait | `flang/src/emit/c/flang_conc.c` | 4638 |
| decisions about processes, supervision, links | `flang/conc/*.flang` | 2956 |

The first file has six loops with no exit condition, the second has none — and
not because they are forbidden. Without waiting such a loop has nothing to do,
and there is nothing in the language to wait with.

## The door: one function, and types are checked before the call

Printing to C puts two doors next to the code. The difference between them is not
a matter of style.

```c
/* computation: argument types are NOT checked */
fl_status privratnik_call (fl_ctx *ctx, const char *name, ...);
/* entry boundary: declared types are checked BEFORE the call */
fl_status privratnik_enter(fl_ctx *ctx, const char *name, ...);
```

Values that came from outside — from a person, from the network, from another
language — must come in through `enter`. The printed header states the reason
itself: the termination proof rests **on the type**, and a value outside its type
carries the proof away along with the type.

Preconditions live on that same boundary. The line `требует «имя» условие` is a
contract with the caller; a check for it is printed into the generated code only
where the value arrives from outside. Internal calls do not pay for it.

And the other side of the same rule: a `требует` on an internal function usually
has to be removed. An `если` branch in the caller does not become an assumption —
the compiler asks that the precondition be discharged by a proof at the call
site, and it names the six shapes of condition it knows how to close. This is not
pedantry: a precondition belongs to the boundary, and inside, its place is taken
by promises.

## An example that actually runs

`examples/host-boundary/` is the whole junction: `gatekeeper.flang` decides who
gets through, `host.c` runs the loop and prints the answers.

On the flang side there are eight functions, all total. Not one of them does
anything — each returns a value:

```flang
тотальная функция «Шаг привратника»
  принимает врата: «Врата», событие: «Событие»
  возвращает «Решение»
  требует «запас не выше ёмкости» врата.«запас» не больше врата.«ёмкость»
  обеспечивает «ГЛАВНОЕ: из годных врат выходят годные» результат.«врата».«запас» не больше результат.«врата».«ёмкость»
  обеспечивает «ёмкость шагом не меняется» результат.«врата».«ёмкость» равен врата.«ёмкость»
```

On the C side is what flang cannot write:

```c
for (;;) {
  if (fgets(line, sizeof line, stdin) == NULL) break;  /* the world says there are no more events */
  ...
  privratnik_enter(&ctx, "Шаг привратника", args, 2, &decision, &error);
  ...
}
```

This loop is in C not because it is infinite — the language accepts non-total
functions. It is in C because of one line inside it: `fgets` **waits**.

```
$ bash examples/host-boundary/run.sh
…
== 3. прогон: девять событий на стандартный ввод
хозяин: врата открыты. ёмкость 3, уровень ключа 2, запас 0
хозяин: жду событий на стандартном вводе: «такт» или «запрос N»
запрос 1 → код 429, ОТКАЗАНО, запас 0, пропущено 0, отказано 1
такт     → запас 1 из 3
такт     → запас 2 из 3
такт     → запас 3 из 3
такт     → запас 3 из 3
запрос 1 → код 200, пропущен, запас 2, пропущено 1, отказано 1
запрос 5 → код 403, ОТКАЗАНО, запас 2, пропущено 1, отказано 2
запрос 1 → код 200, пропущен, запас 1, пропущено 2, отказано 2
запрос 1 → код 200, пропущен, запас 0, пропущено 3, отказано 2
хозяин: событий 9, пропущено 3, отказано 2
хозяин: нарочно порчу довод — запас 4 при ёмкости 3
граница отвергла довод: FLANG_PRECONDITION — не выполнено требование «запас не выше ёмкости» функции «Шаг привратника»
код возврата: 0
```

Exit code 0. Every outcome is visible: refusal on an exhausted budget (429),
the budget filling up on ticks, the capacity ceiling, a pass (200), refusal on
insufficient rights (403). On the last line the host DELIBERATELY passes a
broken argument — a budget above the capacity — and the boundary precondition
turns it away. The refusal arrives as a status, not as a crash: the host loop
goes on.

Next to it in the tree sits a second junction, made the first way — through the
dictionary of orders: `examples/io/фильтр-пакетов.flang` parses an IPv4
datagram header together with the TCP destination port and decides whether to
let it through. Eighteen functions, all total; the octets leave for the
operating system and come back through `write` and `read`.

## What this does not solve

**There is no liveness here.** It is proved that every step carries the system
from a sound state to a sound state. It is not proved that the system will ever
wake up for the next event: that is a property of an infinite sequence rather
than of one step, and it lives with the host.

**A foreign function cannot be called.** Not through a shared library, not
through a system call. Exactly one path leads outward — the dictionary of
input-output orders — and it is closed on purpose.

**The language has no pointers and no manual freeing,** and that is not going to
change: the termination proof rests on their absence.

## Next

* [What the mark «тотальная» buys you](totality.html)
* [Processes, supervision, distribution](processes.html)
* [What is proved and what is not](what-is-proved.html)
