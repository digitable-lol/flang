# What comes next

This page is about what the language does not have yet: what is being worked on,
what is queued, and what has been ruled out. There are no dates here — no
quarters, no months.

What the language already has is not read here:
[Language reference](language.html), [Language operations](operations.html),
[Releases](releases.html).

## Where the language is now

| | |
|---|---:|
| Functions written in flang | {{корпус.функций}} |
| Of them with termination proved | {{корпус.тотальных}} |
| Behaviour claims stated | {{утверждения.высказано}} |
| Of them proved by the kernel — for all inputs | {{утверждения.доказано}} |

The main limit of the language shows up right there, and it is also the main
item of the plan: **termination is proved in bulk, behaviour is proved rarely**.

## In progress

**The kernel proves few ordinary functions.** The obstacle is not search speed
but the strength of the rules themselves: there are three deciding rules, and
they run out on the body shape of an ordinary function. How the kernel works —
[Why and how](proofs.html).

**An emitted program has no input boundary.** The installed `flang` does check
arguments against declared types: `Факториал` is declared over `нат`, and given
−3 it answers `FLANG_TYPE: аргумент «н»: -3 вне нат` with exit code 1. A program
emitted by `flang emit` does not: the caller answers for its input, and
`flang emit` says so as it emits.

**The installed language emits into C only.** The other targets come with the
compiler installed through npm — [how to embed flang](embedding.html).

**The English half of the site is incomplete.** The site's own pages are
translated; the guide and the specifications are still Russian only.

## Next, and each holds the one after it

**1. There is no package manager.** Packages themselves exist: `flang package`
puts a library and everything it pulls into one file — [how it is
done](packages.html). What is missing is everything above a package: a registry,
search by name, version ranges, dependency resolution. Updating today means
taking the new file and putting it where the old one was.

**2. The standard library is small.** No database, no full networking. This
comes after the package manager, not before it: while a library cannot be handed
out by name and version, there is little point in growing it.

**3. There is almost no application code.** The backend is one example of seven
files (`flang/examples/library-api`); the frontend is a browser demo, not an
application. Application code waits on the library, the library waits on
packages.

## Ruled out

**No closures.** Capturing an environment breaks the termination proof and
direct emission into C, Go and Rust. First-class functions do **exist**: the
compiler replaces a function-value with a tag and dispatches on tags. A closure
and a first-class function are different things, and only the first is refused.

**No two versions of one library in one program.** When two dependencies pull
one library at different versions, that is settled by raising a version, not by
letting both live in the program side by side. The argument is worked out in
[Modularity and packages](../modules.html).

**Not the full Unison model.** Storing code in a database instead of files means
owning an editor, owning a host, and losing git. Half of it — content addressing
— we take; the other half we do not.
