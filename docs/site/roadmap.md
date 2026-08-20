# What comes next

This page is about **what the language does not have yet**: what is being worked
on, what is queued behind what, and what has been ruled out for good.

There are no dates here — no quarters, no months. Order and dependencies are
named because they are known; dates are not named because they are not, and an
uncovered promise is worse than silence.

What the language **already has** is not read here:
[Language reference](language.html) — the forms you can write,
[Language operations](operations.html) — what does what,
[Releases](releases.html) — what arrived in the latest version.

## Where the language stands

Four numbers, so that the plan below has something to count from. The site build
measures them against the tree; nobody types them and nobody can forget to
refresh them.

| | |
|---|---:|
| Functions written in flang | {{корпус.функций}} |
| Of them with termination proved | {{корпус.тотальных}} |
| Behaviour claims stated | {{утверждения.высказано}} |
| Of them proved by the kernel — for all inputs | {{утверждения.доказано}} |

The main limit of the language shows up right there, and it is also the main
item of the plan: **termination is proved in bulk, behaviour is proved rarely**.
The first column grows by itself; the second has to be pushed by hand.

## In progress

### The kernel proves few ordinary functions

Of twenty ordinary library functions the kernel closed **two**; four more only
after the claim was weakened. Not one human-written theorem was accepted. How it
was counted — [Proofs: why and how](proofs.html).

The obstacle is not search speed but the **strength of the rules themselves**:
there are three deciding rules, and they run out on the body shape of an ordinary
function. That is where the work is.

### An emitted program has an empty input boundary

The installed `flang` does check arguments against declared types: `Факториал` is
declared over `нат`, and given −3 it answers `FLANG_TYPE: аргумент «н»: -3 вне
нат` with exit code 1.

A program emitted through `flang emit` does not: the table of declared types is
built by a layer the installed language does not carry. Until that is closed,
**the caller answers for an emitted program's input** — and `flang emit` says so
itself as it emits, rather than keeping quiet.

### The installed language emits into C only

There are {{цели.поАнглийски}} emit targets: {{цели.список}}. The installed
binary can do one of them, `c`. The other seven come only from the compiler
installed through npm — [how to embed flang](embedding.html).

### The English half of the site is incomplete

The site's own pages are translated. The guide, the measurement reports and the
specifications are still Russian only.

## Next, and each holds the one after it

### 1. There is no package manager

Packages themselves exist: `flang package` puts a library and everything it pulls
into one file, imported with a single line — [how it is done](packages.html).

What is missing is everything **above** a package: a registry, search by name,
version ranges (`^1.2`), dependency resolution. Updating today means taking the
new file and putting it where the old one was. That does not block handing a
library out; it makes it manual.

### 2. The standard library is small

{{библиотека.файлов}} files, {{библиотека.строк|разрядами}} lines,
{{библиотека.функций}} functions. No database, no full networking. The list of
what is there is shorter than the list of what is not.

This comes after the package manager, not before it: while a library cannot be
handed out by name and version, there is little point in growing it.

### 3. There is almost no application code

The backend is one example of seven files (`flang/examples/library-api`). The
frontend is a browser demo, not an application. Application code waits on the
library, the library waits on packages.

## Ruled out

A refusal is a decision too, and each one has a stated reason.

### No closures

Capturing an environment breaks the termination proof and direct emission into C,
Go and Rust.

First-class functions do **exist**: the compiler replaces a function-value with a
tag and dispatches on tags — a technique known since 1972 (Reynolds), and that is
how `flang/stdlib/higher-order.flang` is written. A closure and a first-class
function are different things, and only the first is refused.

### No two versions of one library in one program

When two dependencies pull one library at different versions, that is settled by
raising a version, not by letting both live in the program side by side. The
argument is worked out in [Modularity and packages](../modules.html) (in
Russian).

### Not the full Unison model

Storing code in a database instead of files means owning an editor, owning a
host, and losing git. Half of it — content addressing — we take; the other half
we do not, and the reason is spelled out in the same place.

## What this page does not carry

**Dates.** Order of work yes, dependencies yes, dates no.

**A report on work done.** How many bytes the built binary weighs, how many
seconds the build takes and how the install was verified belong on [How the
install was verified](install-evidence.html), not on a plan.
