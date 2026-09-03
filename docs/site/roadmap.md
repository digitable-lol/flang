# What comes next

This page is about what the language does not have yet: what is being worked on,
what is queued, and what has been ruled out. There are no dates here — no
quarters, no months.

What the language already has is not read here:
[Language reference](language.html), [Standard library reference](stdlib.html),
[Command reference](cli.html), [Diagnostics reference](diagnostics.html),
[Language operations](operations.html), [Setting up your editor](editor.html),
[Troubleshooting](troubleshooting.html), [Releases](releases.html).

## Where the language is now

| | |
|---|---:|
| Functions written in flang | {{корпус.функций}} |
| Of them with termination proved | {{корпус.тотальных}} |
| Behaviour claims stated | {{утверждения.высказано}} |
| Of them proved by the kernel — for all inputs | {{утверждения.доказано}} |

The main limit of the language shows up right there, and it is also the main
item of the plan: **termination is proved in bulk, behaviour is proved rarely**.
The gap is widening rather than closing: claims are written faster than the
kernel can prove them.

## In progress

**There will be no release until the seed is reprinted.** Of the whole list this
item comes first, because it holds the others up. `bootstrap/` holds the compiler
already printed to C99 and committed: one `make` turns it into a working binary,
and nothing else is needed to build. The seed is required to match what today's
sources print — and it does not:

```
sh scripts/raskrutka.sh --bystro
→ 45 discrepancies. The compiler was edited, the seed was not reprinted.   (exit 1)
```

While that holds, an edit to the compiler's sources does not reach the built
program. A live example: emitting a process plan into C is written
(`flang/self/emit-c.flang`), and the seed has not one line of it — `grep -c
'flang_conc.c' bootstrap/compiler_flang.c` answers `0`, while the Elixir target
is there. The reprint itself costs hours and hundreds of gigabytes of memory, and
does not pass on the first try.

**The kernel proves few ordinary functions.** The obstacle is not search speed
but the strength of the rules themselves: there are three deciding rules, and
they run out on the body shape of an ordinary function. How the kernel works —
[Why and how](proofs.html).

**The compiler says a great deal about itself, and little about it is proved.**
The compiler's own sources (`flang/self`, 57 files, 113,693 lines) carry 7214
`обеспечивает` lines over 8664 function declarations (measured 29 August 2026).
Writing a claim is not the same as proving it — only a minority of them is
proved, and it runs into the same wall as the library. These files must be
counted with `awk`, not `grep`: `link.flang` holds a single NUL byte inside a
string literal, and one such byte is enough for `grep` to call the whole file
binary and skip it silently — `grep -a` reads it.

**An emitted program has no input boundary.** The installed `flang` does check
arguments against declared types:

```
flang run examples/measure/natural.flang --function «Факториал» --args '{"н":-3}'
→ FLANG_TYPE: вызов функции «Факториал»: аргумент «н»: -3 вне неотрицательное      (exit 1)
```

A program emitted by `flang emit` does not: the caller answers for its input,
and `flang emit` says so as it emits. It emits into all eight targets from the
same binary — [how to embed flang](embedding.html).

**The English half of the site is incomplete.** The site's own pages are
translated; the guide and the specifications are still Russian only.

## Next, and each holds the one after it

**1. There is no package manager.** The package and the lockfile themselves
exist: `flang package` puts a library and everything it pulls into one file,
`flang lock` records the dependencies themselves rather than references to them
— [how it is done](packages.html). What is missing is everything above a
package: a registry, search by name, version ranges, dependency resolution.
Updating today means taking the new file and putting it where the old one was.

**2. The library grew ahead of the package manager.** This page used to promise
the opposite order — "while a library cannot be handed out by name and version,
there is little point in growing it" — and the order came out otherwise. Today
`flang/stdlib` holds **38 modules** and 1275 functions, 1271 of them with
termination proved, and none of the gaps from the old list is left:

- databases — **two** drivers: PostgreSQL over the wire (protocol 3.0, login
  through `scram-sha-256`) and SQLite, which reads a file by walking its b-tree
  (internal pages and cell overflow included), **builds one from nothing**
  (`«Собрать базу»` hands back the whole file image, checked so far only by
  reading its own output back through the same tree walk), and **writes a row
  into an existing file** (`«База со строкой»`, checked against a real `sqlite3`
  reading the result back — not self-checked only, this time);
- networking — HTTP (parsing and printing request and response), a binary
  protocol over TCP (`provod`), Redis over RESP2, TLS handshake parsing;
- own cryptography — AES with CTR, GCM and CBC modes, X25519 key exchange,
  SHA-1, SHA-256, HMAC, PBKDF2, DER parsing, X.509 certificate parsing and CRL
  revocation-list parsing;
- regular expressions — `automaton.flang`, 63 functions, every one with
  termination proved. The engine never backtracks: a pattern is parsed into a
  tree, and the automaton's state is the pattern itself, shortened by the
  character just read (Brzozowski derivatives). The number of steps equals the
  length of the input by construction.

What is **not** done in that list: the secure connection itself is not run by
our own cipher — `https` still goes out to the external `curl`, and revocation
checking is not wired into it, even though there is now something to read a CRL
with. Writing a row into an existing SQLite file only reaches a ready leaf's free
middle, in row-number order, without growing the file: a page split, a row out
of order, a payload that needs an overflow page, an edit, a delete — every one
of those refuses rather than corrupts the file, and there is still no journal
to make any of it safe against a reader who has the file open at the same time.
A registry is needed more for this library, not less: there is now
something worth handing out by name and version.

**3. Application code is thin, but no longer a single item.** A link-shortener
service (`examples/web/shortener`) — storage, routing, processes and
supervision, with not one line between the incoming and outgoing bytes written
in anything but flang; a backend example of seven files (`examples/library-api`);
plans that talk to the databases (`examples/db`). The service also comes up on a
real socket: the C process scheduler learned to wait on the network without
stopping, and `curl` gets 200 on `/здоровье`, 201 on `POST`, 301 with `Location`
and 204 on `DELETE`. That run carries a caveat, and naming it without the caveat
would be dishonest: the C process-plan table was written by hand outside the
tree, because there is nothing to emit it with — the committed seed holds not one
line of that emission. The same run cannot be repeated from a clean tree today.
And these are examples, not applications in service: no program among them is one
somebody runs in production.

**4. The auxiliary code is still JavaScript.** The tree holds 54 such files and
25,527 lines (`git ls-files '*.mjs' '*.js' | xargs wc -l | tail -1`, measured
29 August 2026) — the site build, the guards, the benchmarks. Some of them are
not held up by a shortage of hands: capabilities are absent from the language
itself, and what exactly holds each file is worked out in
`docs/javascript-inventory.md`, which sorts all 54 into four heaps. **The debt
is 28 files and 13,507 lines**; the other 26 are not a debt at all — the runtime
of the `js` emit target, output of the compiler itself, launchers that run
before flang is on the machine, and the separate directory of test fixtures.

One of the holes in that analysis has closed halfway, and the other half will
never close. Regular expressions arrived in the language, but there are no
lookaheads or lookbehinds in them and there never will be (see below) — and the
guards are written with them: `claim-guard.mjs` has three, `count-guard.mjs`
three, `binary-rules-guard.mjs` two. Free of them are `name-guard.mjs` and
`jargon-guard.mjs`: those two are portable with the new engine today, the other
three are not, and what has to be rewritten in them is not the pattern but the
approach.

## Ruled out

**No closures.** Capturing an environment breaks the termination proof and
direct emission into C, Go and Rust. First-class functions do **exist**: the
compiler replaces a function-value with a tag and dispatches on tags. A closure
and a first-class function are different things, and only the first is refused.

**No lookaheads or lookbehinds in regular expressions.** `(?=…)`, `(?<=…)` and
backreferences `\1` all require going back and re-reading what has been read —
exactly the backtracking the engine was written to refuse. A pattern using them
does not fail silently: it is refused by name, the reason goes into the `беда`
field, and a match against such a pattern answers "no". The price is named above:
three tree guards stay in JavaScript until somebody rewrites them without
lookarounds.

**No two versions of one library in one program.** When two dependencies pull
one library at different versions, that is settled by raising a version, not by
letting both live in the program side by side. The argument is worked out in
[Modularity and packages](../modules.html).

**Not the full Unison model.** Storing code in a database instead of files means
owning an editor, owning a host, and losing git. Half of it — content addressing
— we take; the other half we do not.
