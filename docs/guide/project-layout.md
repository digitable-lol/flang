[Back to README](../../README.md) · [Documentation index](../README.md)

# Laying out a flang project

This document is not a wish list. Every rule here is derived from a working
example — [`examples/library-api`](../../examples/library-api/README.md), a
library REST service — and points at it.

Half of that example has since been removed: the Node host went on 20 August 2026
along with the rest of the JavaScript tooling. So the rules about what stays with
the host can no longer be shown on the tree — they are marked as such where they
stand, and they lean on the example's README, which names the removed files one by
one. The rules about flang modules are still checkable on the tree as before.

The example is laid out like this:

```
examples/library-api/
  lib/       flang pure functions over the project's data, domain rules included
  stdlib/    flang the project's own library: knows nothing about the domain
```

There were four directories. `host/` (HTTP, storage, percent-decoding on Node) and
`test/` were removed on 20 August 2026 along with the rest of the JavaScript
tooling, and they are no longer in the tree — the provenance is in the
[example's README](../../examples/library-api/README.md). The rules about the
boundary with the host did not change because of it: a boundary is visible from
one side too, and the README names the code that used to sit on the other side.
Where the text below says "in the example's host", it means the removed host, and
it says so in the past tense.

---

## 1. Three layers and the boundary between them

**Rule.** Logic moves into a flang module if it can have an example. What stays
with the host is what cannot have one.

**Why.** An example is not documentation but an executable check: `flang test`
finds them itself and fails when the behaviour has drifted. The same arithmetic
written inside an HTTP handler is checked only by whatever test somebody bothers
to write separately.

**Where to look.** The example's host (`examples/library-api/host/server.mjs`,
removed along with the JavaScript implementation of the language) held not a
single number from the fine schedule, no ISBN check digit, no query-string
parsing, and no "who is allowed to borrow" condition. All of that lives in
`examples/library-api/lib/*.flang`, which a command checks.

**What stays with the host, and why it is the host's.** I/O in the language is
DESCRIBED but not performed: `вариант «Прочитать файл» с путь равным …` builds a
value — an order — and the host carries it out
([`flang/SPEC.md`](../../flang/SPEC.md), the "Ввод-вывод" section). There are
twenty orders, the set is closed, and connections are in it —
`«Принять соединение»`, `«Прочитать из соединения»`, `«Ответить в соединение»`.
The boundary does not run along those; it runs along this section's own rule:
**an HTTP server has no input on which you can declare an example.** It waits for
callers rather than computing an answer from arguments, and there is nothing in it
for examples to check. So the server, the routing and the storage stay with the
host — not because the language cannot say them, but because moving them would not
make them checkable.

**What this paragraph NO LONGER says, which matters if you read it before.** It
used to say "functions in flang are not first-class values" and "there is no I/O
in the language at all". Both are out of date: a function IS a value now
(defunctionalization after Reynolds, `flang/SPEC.md`, section 3), and I/O orders
are in the language and are carried out by `flang io`. The rule about the boundary
survived both changes, because it rests on examples rather than on a list of what
the language lacks.

**You can check that the boundary is drawn right by emitting.** `flang emit` emits
the whole project library into all eight target languages — `c`, `go`, `rust`,
`python`, `java`, `csharp`, `elixir`, `js` — and the host emits nowhere, because
there is nothing to emit. If emission broke after you moved another piece into
`lib/`, you moved the wrong piece.

**The exception that is also a rule.** Do not rewrite in flang what the platform
already does correctly. Percent-decoding in the example was done by the removed
host's `decodeURIComponent`, not by a table of code points in flang: a second
source of truth for the sake of principle is worse than one foreign source.

---

## 2. Domain rules and computation are different modules

**Rule.** The module that holds tariffs, permissions and data shapes is kept apart
from the module that computes. The first is read and edited by more than
programmers; the second only by programmers.

**Why.** They are edited for different reasons and at different rates. The library
changes the fine schedule when the schedule changes; the ISBN check digit never
changes. Put them in one file and a tariff edit has to be made in a file people
are afraid to touch.

**Where to look.**
[`lib/fine.flang`](../../examples/library-api/lib/fine.flang) — the fine schedule
and its ceiling: three surcharges (50, 150 and 300 — exactly the ceiling when
summed), five examples and one `обеспечивает`, readable without a programmer.
[`lib/isbn.flang`](../../examples/library-api/lib/isbn.flang) — splitting a string
into characters, a fold with a record accumulator, a remainder: whoever edits the
tariff has nothing to do in here.

**A ceiling is written as a promise, not as clamping.** `fine.flang` carries
`обеспечивает «Штраф ограничен» результат не больше 500`, and the limit equals the
sum of all the surcharges exactly. Clamping the value instead of promising would
HIDE going over the schedule; the promise says the opposite — 500 cannot be
exceeded on any input. The reason is written in the file's header.

**What this approach no longer gets you.** The right to lend a book was once
decided not by a function but by a proof: a certificate was built from a snapshot
of the data, and a refusal was called "the premise was not found" rather than "the
condition is false". Today it is an ordinary function
([`lib/loan.flang`](../../examples/library-api/lib/loan.flang)) — the same answer
on the same inputs, but backed only by its body and its examples. The difference
between "proven" and "computed" is named in the file's header rather than lost
quietly.

---

## 3. File names

**Rule.** A file name is Latin, lower case, words separated by hyphens. The
extension says what checks the file: `.flang` — the language; everything else —
the tooling of whatever language the host is written in.

**Why Latin.** A file name travels into README command lines, into CI samples,
into the `--out` of code generation and into repository URLs. Some of those places
break on spaces and Cyrillic silently — and a silently breaking path costs more
than a pretty name. The whole repository is already built this way.

**Why the extension matters more than a convention.** The flang loader picks the
parse by suffix: `.flang` goes through the language parser, `.json` is taken as a
ready AST (`«Загрузить»` in
[`flang/self/link.flang`](../../flang/self/link.flang)). A file with the wrong
extension is parsed by the wrong parser and gives an incomprehensible error.

**The name is about content, not about the layer.** `isbn.flang`, not
`isbn-module.flang`: the layer is already named by the directory.

**When it is otherwise.** A suffix a tool looks for beats the rule: if your host's
runner finds files by a pattern, the name obeys the pattern, not this section. A
project document is `README.md` even when written in Russian: that is what the
documentation naming rule in [README.ru.md](../../README.ru.md) says — `README.md`
and `SPEC.md` next to code keep those names in whatever language they are written,
because GitHub shows them as the directory's front page. The `X.ru.md` suffix is
for documents in `docs/`, where it tells the languages apart.

---

## 4. Names inside files

**Rule.** Names of functions, types, fields and rules are in Russian. A
single-word name may be written without quotes; a multi-word one must be in
guillemets: `«Рассчитать штраф»`, `«дней просрочки»`.

**Why not Latin.** The language's surface is Russian throughout, and the rule is
read by the same person who reads its name. Mixing alphabets within one line is
extra work for the eye with no benefit at all. The language does have an English
surface, but it is separate and complete —
[`examples/rosetta/factorial-english.flang`](../../examples/rosetta/factorial-english.flang)
sits next to `factorial.flang` rather than mixed into one file.

**Why guillemets.** A multi-word name is otherwise indistinguishable from the
continuation of a construct; the quotes are not decoration but a token boundary.
Ordinary quotes are equally valid; guillemets were chosen because string literals
use `"` — and it is easier on the eye when a name and a string look different.

**The form of a name is constant.** The language deliberately does not guess
grammatical cases (`docs/site/language.ru.md`), so a name at a call site is
written exactly as in its declaration. The only relaxation is for local names
inside a flang function, and only on an unchanging stem; it does not extend to the
names of functions, types or fields.

**How to name things.**

| What | Form | Example from the project |
|---|---|---|
| action function | verb phrase | `«Рассчитать штраф»`, `«Разобрать запрос»`, `«Отобрать»` |
| predicate function | a statement | `«Код верен»`, `«Заявка принята»` |
| type and record | a noun | `«Книга»`, `«Параметр»`, `«Сводка»` |
| record field | lower case, as in the data | `«на полке»`, `«дней просрочки»` |

Names like `«Помощник»`, `«Утилиты»`, `«Общее»` are not in the project and cannot
be: linking merges declarations into one program, and **a name collision is the
error `FLANG_DUPLICATE_NAME`, not shadowing** (`flang/self/link.flang`). A name has
to be recognisable across the whole assembled program, not only within its file.

**When it is otherwise.** Latin names go outward, into HTTP: the paths `/books`,
`/loans`, `/returns` and the parameters `author`, `shelf`. They are read by a
client that knows nothing about the model, and they are part of the protocol
rather than of the domain. JSON body keys stay Russian (`«код»`, `«на полке»`),
because those are model fields: a second dictionary of names would have to be kept
in agreement by hand, and no type catches two dictionaries drifting apart (which
is what happened in the removed host's storage — `host/storage.mjs`, no longer in
the tree).

---

## 5. Directories

**Rule.** A directory is a layer, not an entity. Not `книги/` and `выдачи/`, but
`lib/`, `stdlib/` and — if the project has a host — `host/`.

**Why.** A layer answers two questions at once: who edits this and what checks it.
`lib/` and `stdlib/` are checked by `flang check|test`; the host is ordinary code
that has no such checks at all. Lay the same thing out by entities and one folder
ends up holding files that different commands check.

**Checking the rule.** Look at a file and say which command checks it. If you
cannot answer at once, the file is in the wrong place.

---

## 6. Modules: where the boundary runs

**Rule.** One module, one file. The first line is `модуль «Имя»`, and that name
must match the way the module is imported.

**Why.** A mismatch is the error `FLANG_IMPORT_NAME` (`flang/self/link.flang`):
the reader sees one name and gets declarations from another file.

**A module boundary follows the question "what changes together".** The book
selection rules change together; the ISBN checksum formula never changes with them
— which is why [`lib/catalog.flang`](../../examples/library-api/lib/catalog.flang)
and [`lib/isbn.flang`](../../examples/library-api/lib/isbn.flang) are different
files.

**A module does not know about its consumers.**
[`lib/query.flang`](../../examples/library-api/lib/query.flang) knows nothing about
books or ISBNs: any project with a query string would take it as is. Knowledge
about books lives one floor up.

**The import graph is a tree, layers top down.** A cycle is the error
`FLANG_IMPORT_CYCLE`, and that is not a restriction but a hint: a cycle means the
boundary is in the wrong place. In the example:

```
api.flang ──> catalog.flang ──> isbn.flang
          │                 └─> flang/stdlib/lists.flang  (только «Минимум», «Все не меньше»,
          │                                                «Сумма», «Максимум», «Длина»)
          ├─> query.flang ────> stdlib/text.flang         (только «Первая часть», «Хвост через»,
          │                                                «Непустые»)
          ├─> fine.flang
          └─> loan.flang
```

Two of the names in «Каталог»'s `только` list are not called by that file at all —
`«Минимум»` and `«Все не меньше»`. They are called by the CONTRACT of the imported
`«Сумма»`, and `только` narrows the name table together with the contracts; without
them the module did not link at all. The reason is written right in the header of
`catalog.flang` — and it is the case where a `только` list is read not from the
body of the file but from a linking refusal.

**A project library has one entry module.**
[`lib/api.flang`](../../examples/library-api/lib/api.flang) is the only file the
host loads; linking pulls in everything else. The reason is in how the language
works: an import is a merge of declarations, not a namespace, and loading two
modules separately means keeping two programs on the host and remembering which
function is in which.

**Do not grow domain logic in the entry module.** Only what wires the lower
modules together. An entry module that people start adding "just one more
function, it is convenient here" to stops being an entry module within half a
year.

---

## 7. Imports: whole and selective

**Rule.** `использует «Модуль»` brings in all of the module's names.
`только «А», «Б»` brings in the listed ones.

**The main thing about `только`: it lists NAMES, not the dependency closure.**
Take a function that calls a neighbour inside its own module and you get
`FLANG_UNKNOWN_NAME` on the very first reference — and, if the function is
declared total, `FLANG_NOT_TOTAL` after it. That is why «ISBN» is taken whole in
the example (`«Код верен»` calls `«Цифры»` and `«Контрольную сумму»`), while
«Списки» and «Текст проекта» are taken selectively: there every needed function is
self-contained. Both reasons are written in the file headers.

**Why narrow at all.** Not for cleanliness: a name conflict at link time is an
error, not silent shadowing. A twenty-name module brought in whole is twenty future
`FLANG_DUPLICATE_NAME`s, and the first collision stops the build.

**There is no path in the line — a module is found by name.** The name is what
stands on the file's first line in `модуль «Имя»`. The search goes in order: the
file's own directory, every directory above it (as long as the directory holds
`.flang` files), and the library shipped with the compiler. Hence the consequence
the whole thing exists for: **a file can be moved to another directory and not one
`использует` line changes.**

The search does not descend. A module from a neighbouring branch of the tree — the
project's `stdlib/` next to `lib/`, say — is either named by path
(`использует «Project text» из "../stdlib/text.flang"`) or its directory is named
once in `FLANG_MODULE_DIR` (directories separated by colons). A path, when written,
is taken relative to the file's directory; an absolute path makes a project
non-portable, and there is not one in the example.

---

## 8. The project library (`stdlib/`)

**Rule for getting in.** A function belongs here when it **knows nothing about the
domain** but the project needs it.

**Rule for moving up.** If a function would be useful to anybody writing flang, its
place is not here but in `flang/stdlib` — with a header, examples and a write-up in
the common set. A project library is not a dumping ground for "we have not got
round to it".

**Why it is needed at all.** Parametric types DO exist in the language
(`тип «Возможно» от «А»`), and part of `flang/stdlib/lists.flang` has already been
moved onto them: `«Длина» от «А»`, `«Приписать в начало» от «А»`,
`«Обратить» от «А»` and several more work over a list of any values. Not all of it:
`«Элемент»`, `«Индекс»`, `«Без значения»`, `«Минимум»`, `«Сумма»` are declared for
`список числа` and will not do for a list of strings — a type parameter has neither
an order nor arithmetic, and the boundary runs exactly along whether the body
compares elements. A list of strings — and that is what everything produced by
splitting a string is — needs those functions written again, and writing them once
in one place is better.

**Where to look.**
[`stdlib/text.flang`](../../examples/library-api/stdlib/text.flang) — four
functions over a list of strings, not one of which knows the word "book".

---

## 9. Examples

**Rule.** An example is part of a declaration, not a separate file. `пример` is
written inside the function itself.

**Why.** `flang test` finds such examples itself and fails on a disagreement. An
example moved out into a separate file is run by nobody until somebody remembers.

**What examples must cover.** The boundary: an empty list, an empty string, zero,
"not found". Every function in the project that has a boundary at all has such an
example: `«Пустой каталог»`, `«Пустая строка»`, `«Параметра нет»`, `«Хвоста нет»`,
`«Вернули вовремя»`.

**One example per trap, not per line.** `«Разделитель внутри хвоста»` in
`stdlib/text.flang` exists because joining the tail through `=` is exactly where
people get it wrong: splitting `"поиск=a=b"` gives `"a"` as the second piece, while
the value has to be `"a=b"`.

**A promise is written next to the examples, not instead of them.** `обеспечивает`
holds for all inputs, an example for one; together they say different things, and
neither replaces the other. `«Рассчитать штраф»` carries both.

**Where the functions without examples live.** There are none in the project: every
function declared in `lib/` and `stdlib/` has at least one example, and `flang test`
checks that along with totality. The exact number of functions in the assembled
program is deliberately not named here: it depends on what linking pulls in, and it
is taken by a run, not by counting in files.

---

## 10. Running it and CI

**The commands that check the project:**

```bash
flang check examples/library-api/lib/api.flang
flang test  examples/library-api/lib/api.flang
```

`check` on the entry module assembles the whole program; `test` runs the examples of
every assembled function — its own and imported ones. That is why naming one file is
enough: add a module and it arrives in the check along with linking, without editing
a list of files.

**What used to stand here and why it is gone.** It said: "today both answer with a
refusal, `FLANG_UNKNOWN_NAME`, unknown function `«Все не меньше»`". That function has
since appeared in the library (`flang/stdlib/lists.flang`), and `catalog.flang`
imports it by name, so the named cause of the refusal is gone. Whether both commands
exit 0 today is not stated here: that is taken by a run rather than by reading, and
passing reading off as a run is not allowed on a page about checkability.

---

## The short list

1. Can have an example — moves into a language module; cannot — stays with the host.
2. `.flang` — domain rules and pure computation; the host's language — the outside world.
3. File names Latin with hyphens; the extension picks the parse.
4. Names inside in Russian, multi-word ones in guillemets, the form constant.
5. A directory is a layer, not an entity; you can see from a file which command checks it.
6. A module is a file; the boundary is "what changes together"; the import graph is a tree.
7. One entry module per library, with no logic of its own.
8. `только` lists names together with their contracts, not dependencies; paths are relative.
9. The project's `stdlib/` holds what knows nothing about the domain.
10. An example is part of a declaration, not a separate file.
11. A value's ceiling is written as an `обеспечивает` promise, not as clamping.
12. One command on the entry module checks the whole program: `check` assembles, `test` runs.
