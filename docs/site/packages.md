# Packages

A flang package is **one file** holding a library together with everything it
depends on. No registry, no store, no `~/.flang`. Publishing a package means
committing a file to git; using one means writing a single line; building on
another machine means copying two files over and running `flang check`.

Everything below was run against `flang` installed the
[fourth way](install.html) (`npm install`, `node_modules/.bin/flang`). The
standalone `flang` binary — the one Homebrew installs and `bootstrap/` builds —
has no `package` and no `lock`, and says so:

```bash
$ flang --version
flang 0.5.0
$ flang package skidka/discount.flang
flang: неизвестная команда «package». «flang --help» — что умеет бинарник.
```

## Using someone else's package

Drop the package file next to your program and write one line:

```
модуль «Витрина»
  использует «Скидка» из "discount.flang-package"
```

```bash
$ ls
discount.flang-package  shop.flang

$ flang check shop.flang
{"valid":true,"module":"Витрина","functions":[{"name":"Скидка в копейках","total":true},
 {"name":"Цена за вычетом","total":true},{"name":"Цена в витрине","total":true},
 {"name":"Сколько скинули","total":true}],"types":[],"diagnostics":[]}

$ flang test shop.flang
… "total":7,"passed":7,"failed":0 …
```

**The library's sources are not in this directory.** Its two functions arrived
inside the package file — with their examples, types and proofs. The two files
above are the whole project.

The quoted name must match the module inside the package. It does not — refusal,
naming both:

```bash
$ flang check shop.flang
{"error":"модуль в …/discount.flang-package называется «Скидка»,
 а импортируется как «Скидочка»","diagnostics":[{"code":"FLANG_IMPORT_NAME", …}]}
```

## Declaring your module a package

Put a `flang.package` next to your library's entry file — three fields, two of
them required:

```json
{
  "имя": "Скидка",
  "версия": "1.0.0",
  "источник": "https://github.com/digitable-lol/flang"
}
```

`имя` must equal the module name on the file's first line: that is the name the
package is imported by, and the two may not diverge. They do — refusal, before
anything is built:

```bash
$ flang package skidka/discount.flang
{"error":"в flang.package пакет назван «Не Скидка», а модуль в
 skidka/discount.flang называется «Скидка»", …}
```

Not one new word was added to the language for this: `skidka/discount.flang` is
an ordinary module with an ordinary `модуль` / `экспортирует` header.

## Building the package

```bash
$ flang package skidka/discount.flang > skidka/discount.flang-package

$ ls -la skidka/
-rw-rw-r-- 1 b b 3644 discount.flang
-rw-rw-r-- 1 b b 4343 discount.flang-package
-rw-rw-r-- 1 b b  122 flang.package
```

**3,644 bytes of source become a 4,343-byte package.** The package is larger
than the source: it holds the module's full text plus a content address, a proof
report and a header. The format does not compress — why is explained below, in
the section on a multi-module library.

A package is built **only from checked code**: `flang package` first runs the
same checks `flang check` runs, and refuses on a program with a type error.
Promising for unchecked code would be a lie.

Here is that package with the payload (the base64 `адрес` field) cut out for
readability:

```json
{
  "схема": 1,
  "имя": "Скидка",
  "версия": "1.0.0",
  "вход": "./discount.flang",
  "модули": [
    { "имя": "Скидка", "путь": "./discount.flang", "функций": 2,
      "печать": "f859823c12859d95a764b801914fdc0e481a3d68e4997e69ff24590570959ea1" }
  ],
  "ведомость": [
    { "функция": "Цена за вычетом",
      "утверждение": "цена за вычетом не выходит за точный потолок",
      "сила": "доказано" }
  ],
  "источник": "https://github.com/digitable-lol/flang",
  "печать": "bac0aa0fc8fe3c0b39885d79bdd628cedf8063fad686d76838b248bd4c7fda13"
}
```

## Publishing

Commit one file:

```bash
$ git add skidka/discount.flang-package
$ git commit -m "Скидка 1.0.0"
$ git push
```

Whoever takes the package downloads **that file** — by raw link, from a release,
by mail, off a USB stick. There is no registry to upload to, and no
`flang publish`.

## A library of several modules

If the library is several files, all of them travel:

```bash
$ flang package examples/library-api/lib/api.flang > api.flang-package
$ ls -la api.flang-package
-rw-rw-r-- 1 b b 13161 api.flang-package
```

Inside: **8 modules and 53 functions**, 105,937 bytes: the package carries their
code as source, so it is about the size of what it replaces, not smaller. In the
repository it takes 21,111 bytes — git compresses objects itself.

The payload is **not compressed**: the compiler cannot compress, and compression
would have to be written into the compiler itself. A module's address is the
sha256 of its source, 64 characters, and the payload is checked against it when
the package is used: change a byte and the address changes.

The closure follows import edges and leaves the library's own directory when the
author wrote it that way: `catalog.flang` pulls `«Списки»` from
`"../../../flang/stdlib/lists.flang"`, and `lists.flang` travels with the rest.
Whoever uses the package need not know.

A package may sit on top of a package:

```
verh.flang            использует «Скидка» из "discount.flang-package"
verh.flang-package    holds both «Верх» and «Скидка»
```

Whoever imports `verh.flang-package` has no `discount.flang-package` on disk at
all, and `flang check` does not look for one: it travels as cargo inside.

## Pinning a version

The version lives in `flang.package` and is **covered by the package seal**.
Bumping it means editing the manifest and rebuilding:

```bash
$ sed -i 's/"версия": "1.0.0"/"версия": "1.1.0"/' skidka/flang.package
$ flang package skidka/discount.flang --pretty | grep '"версия"'
  "версия": "1.1.0",
```

Editing the version inside a built package is pointless: the seal is recomputed
on read and will not match.

```bash
$ sed -i 's/"версия":"1.0.0"/"версия":"9.9.9"/' vitrina/discount.flang-package
$ flang check vitrina/shop.flang
{"error":"печать пакета «Скидка» не сходится: пакет правлен или испорчен", …}
```

There are no version ranges (`^1.2`, `~> 1.2`). The program gets exactly the file
that was put next to it, and nothing can update itself.

## Building offline

There is no flag for it, and none is needed. **The build never touches the
network**: there is nothing to fetch, because the code is already in the file.

```bash
$ ls
discount.flang-package  shop.flang
$ flang check shop.flang
{"valid":true,"module":"Витрина", …}
```

That is also the answer to "will it build on another machine": move two files and
it builds.

To check that the package yields the same thing as the sources, emit the program
twice — once next to the package, once next to the sources — and compare the
directories.

```bash
flang emit shop.flang --target c --out ./from-package   # where the package lives
flang emit shop.flang --target c --out ./from-sources   # where the sources live
diff -r ./from-package ./from-sources && echo same
```

A run over a trial pair of two modules: both emissions gave **6 files and 272,974
bytes**, and `diff -r` returned 0 — not one file differs.

## What a package carries about proofs, and what it does not

A package holds a `ведомость` field — the proof report: what the kernel said
about the author's functions (`доказано`, `сетка N`, `объявлено, не доказано`).
The report is a **statement of record**, used to choose a library, not something
taken on trust: whoever imports the
package proves everything again, because the bodies of those functions travelled
whole.

And here is the line to know before you rely on a package. **`обеспечивает`
reaches the caller already proved. `требует` is paid at every call site.** Drop
the `требует` on your side and the program stops building, though the library did
not change:

```bash
$ flang check shop.flang
{"code":"FLANG_PRECONDITION_CALL",
 "message":"вызов «Скидка в копейках» в функции «Сколько скинули» не снимает
  предусловие «доля не больше ста»: …"}
```

Otherwise a precondition would be an axiom under another name — and in a language
whose axiom list is an empty `Object.freeze([])` there is nowhere for one to come
from.

Why it is a record and not a cache of verdicts to be trusted is answered with a number. The
tree does have a content-addressed verdict cache, and it was re-measured over 99
files carrying obligations, in one process, on warm code:

| what | time |
| --- | ---: |
| the proof kernel — all a package could save | **111 ms** |
| definition addresses — all a package must spend | **145 ms** |

Today the key a proof is cached under costs more than the proof. A package
shipping verdicts instead of a record would be slower — and would have to trust
them.

## What gets caught, and how it reads

Verified by five separate tamperings of the same package file:

| Tampered with | Answer |
| --- | --- |
| one character in a module's payload | `FLANG_PACKAGE`: "груз модуля «Скидка» в пакете «Скидка 1.0.0» не разворачивается" |
| the version | `FLANG_PACKAGE`: "печать пакета «Скидка» не сходится" |
| the package name | `FLANG_PACKAGE`: "печать пакета не сходится" |
| the source URL | `FLANG_PACKAGE`: "печать пакета не сходится" |
| a module's function count | `FLANG_PACKAGE`: "печать пакета не сходится" |

The seal covers **everything the package says about itself**, not just the
payload: name, version, source, and each module's function count. That is where
it differs from the lock ([below](#the-lock-versus-a-package)), whose companion
numbers are unsealed and edit silently.

The seal is not a signature: it has no secret. It answers "this file was not
edited", not "this file is from whom you think".

## Two versions of one library

There are none, and packages do not change that: an import in flang merges
declarations into one flat namespace. The refusal is argued in
[Modularity and packages](../modules.html) (in Russian) and recorded in the
[roadmap](roadmap.html).

What packages change is the message. A diamond used to surface as a complaint
about an arbitrary function:

```
FLANG_DUPLICATE_NAME: функция «Есть в множестве» объявлена в двух модулях:
  …/v1/sets.flang и …/v2/sets.flang
```

Now it names the packages, the versions, and what to do:

```
FLANG_PACKAGE: путь …/obshee.flang привезли два пакета с разным содержимым:
  «Библиотека а 1.0.0» и «Библиотека б 1.0.0». Двух версий одной библиотеки
  в одной программе не бывает: поднимите обе стороны до одной версии
```

If both sides carry **identical** content the diamond resolves itself, silently:
packages are compared by cargo, not by file name.

## The lock versus a package

Both put code inside a file, and they are easy to confuse.

| | `flang lock` | `flang package` |
| --- | --- | --- |
| answers | "what was THIS program built from" | "here is a library, take it" |
| name and version | none | required |
| how it is used | sits alongside, named `flang.lock` | written as `использует … из "…"` |
| how many per program | one | as many as you like |
| the seal covers | the cargo | cargo, name, version, source, function counts |

They do not interfere: a program may have both a `flang.lock` and packages.

## What is missing — as a list

- **a registry and search.** There is nowhere to look a package up by name;
  `flang publish`, `flang add`, `flang search` do not exist;
- **version ranges and dependency resolution.** No `^`, no `~>`, no `latest`.
  The file you put there is the file that builds;
- **two versions of one library** in one program — see above;
- **partial updates.** An update is a full `flang package` again: the file holds
  code, not a hash, and there is nothing in it to swap one dependency out of;
- **an author's signature.** The seal is self-certified integrity, not a
  signature;
- **packages in the shell and the language server.** `flang repl` and
  `flang-lsp` call linking themselves and know nothing of packages. Run:
  `flang repl shop.flang` in the very directory where `flang check` answers
  `{"valid":true,…}` gives `FLANG_PARSE, заголовок модуля, строка 1`. The same
  loose end the lock has;
- **packages in the standalone `flang`.** It has neither `package` nor `lock` —
  see the run at the top.

## Where to next

- [Language operations](operations.html) — what is done with what inside a module
- [Modularity and packages](../modules.html) — in Russian — the measurements and the design
- [Roadmap](roadmap.html) — when the missing pieces are expected
