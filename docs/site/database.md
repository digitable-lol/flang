# Databases

This page shows how a flang program talks to PostgreSQL: what builds a query,
who carries the bytes, what the library already contains, and how far it is
actually taken. By the end you can read the five-step conversation that ships
with the language, add a query of your own, and know in advance where it will
trip.

## Who talks to whom

A flang program opens no sockets. It has arguments and a result, and nothing
else: it sees neither files nor network, by construction of the language. That
is exactly why its functions stay total and are checked by examples with no
database present.

The conversation is carried by a **plan**. A plan is a function that returns not
an action but its *description*: "open a connection there", "send these bytes",
"read the answer". The description is carried out by whoever ran the plan. The
program decides, the runner acts.

```mermaid Who carries the bytes between the program and the database
flowchart LR
  A[flang program] -->|description of an action| B([plan runner])
  B -->|bytes| C[PostgreSQL]
  C -->|bytes| B
  B -->|answer as a value| A
  class A glavnoe
  class C glavnoe
```

Two consequences are worth holding on to from the start. First: the whole
protocol — building messages and parsing answers — is ordinary total functions,
checked by examples that need no database. Second: everything that depends on a
real wire is only ever established by running it, and the line between the two
halves is drawn explicitly below.

## What is already written

The PostgreSQL conversation lives in two files.

| file | what is in it | lines | functions | examples |
| --- | --- | ---: | ---: | ---: |
| `flang/stdlib/postgres.flang` | protocol version 3.0: client messages built, server messages parsed | {{база.строк}} | {{база.функций}} | {{база.примеров}} |
| `flang/examples/db/postgres-plan.flang` | the whole five-step conversation | {{план.строк}} | | {{план.примеров}} |

All {{база.тотальных}} functions of the module are total: termination of each is
proved by the compiler, not promised. The module imports nothing, so it is
checked on its own.

The five steps are what one writes a driver for: startup and login, creating a
table, an insert with parameters (`$1`, `$2`), a select, and a refusal on a
deliberately wrong query. Every step ends with a "ready" message, and that is
how the plan knows the answer has been read to the end.

Here is how a simple query is assembled — taken from the tree verbatim:

@@пример:simple-query@@

## How to run it

Checking and examples need no database at all:

```bash
flang check flang/stdlib/postgres.flang
flang test flang/stdlib/postgres.flang
```

The conversation itself is a separate command, and it does need a live server:

```bash
flang io flang/examples/db/postgres-plan.flang
```

The plan connects to `127.0.0.1:55434` as user `flang`, database `postgres`.
Address, port, user and password stand in the plan as literals: a plan takes no
arguments, and a program does not see the environment.

## The borders, named one by one

None of them is a guess: each follows from the construction and shows up in a
run.

**Login is `trust` and cleartext password only.** `md5` and `scram-sha-256`
require HMAC, and the library has none: it has `sha256`, and `scram` wants
PBKDF2 on top of that. The four raw octets of an `md5` salt do now arrive
intact — over the old text pipe they did not, in five requests out of five —
but there is still nothing to compute the digest with. A request the plan does
not understand is not refused today: the plan keeps reading and waits.

**There is no encryption.** The conversation runs in the clear; there is nothing
to build or parse TLS with. That is fine for a database on the same machine, and
for nothing beyond it.

**The program has no column types.** `RowDescription` now arrives intact, but
parsing takes only the number of columns out of it. The consequence: the type
number of a column is named by whoever knows the schema and is passed as an
argument. There is no "Column" type in the module: declaring a type nobody can
construct would promise an ability that does not exist. Selects still go through
the extended query protocol, for a different reason — it is the one that sends
values as parameters.

**A null value is not parsed.** Its length is minus one, that is 4 294 967 295
octets, and parsing asks for that many and runs out.

**Message length is bounded.** A message the program sends must have a length
whose four octets are all below 128; a query is padded with spaces when needed,
with 200 in reserve. A parameter value is at most 127 bytes. One parsing pass
takes at most 1000 messages.

**Corruption is recognised, not swallowed.** An element of the stream that is
not an octet stops the parse with a distinct answer instead of being counted
modulo something.

## The conversation runs over a real wire

The bytes travel as a list of numbers, not as text: the orders are
`Прочитать октеты из соединения` and `Ответить октетами в соединение`. That is
what makes a binary protocol possible at all. With text it was not: an order's
content was measured with `strlen`, and the very first PostgreSQL message begins
with a zero octet — the high byte of the four-byte length — so nothing was
written and the connection closed.

One command shows the state today. Against a live PostgreSQL 17.10:

```
$ flang io flang/examples/db/postgres-plan.flang
1 пуск: | | | … server_encoding=UTF8
2 создание: INSERT 0 1| | |
3 вставка с параметрами: INSERT 0 1| | |
4 выборка: SELECT 2| | 1	Мир ; 2	dva|
5 отказ: | ERROR 42703 column "netakoykolonki" does not exist| |
```

Five steps: start-up with a cleartext password, create, insert with parameters,
select, and a deliberate failure answered with the server's own code. Cyrillic
travels in both directions.

Independently of any database, this is what a check establishes: every message
built and every answer parsed — {{база.примеров}} module examples and
{{план.примеров}} plan examples, run on every check of the file.

## Where to go next

- [Processes, supervision, distribution](processes.html) — the other half of
  talking to the world: who holds the connection while work is going on.
- [What is proved and what is not](what-is-proved.html) — which part here is a
  proof and which part is a run.
- [How to keep learning the language](learning.html) — where this page sits on
  the road.
