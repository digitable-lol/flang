# Packages

A flang package is **one file** holding a library together with everything it
depends on. No registry, no store, no `~/.flang`. Publishing a package means
committing a file to git; using one means writing a single line; building on
another machine means copying two files over and running `flang check`.

Both commands — `flang package` and `flang lock` — are in the `flang` binary
0.7.17 (`flang package --help`, `flang lock --help`). The JavaScript
implementation and the `npm install` route were removed from the tree on
20 August 2026 (commit `fe8e8a37`); every output on this page was taken from the
binary on 11 September 2026 on the example in `docs/examples/package/`.

## Take someone else's package

Drop the package file next to your program and write one line:

```
модуль «Shop»
  использует «Скидка» из "discount.flang-package"
```

```bash
$ ls
discount.flang-package  shop.flang

$ flang check shop.flang
модуль «Shop»: функций 4, из них с доказанным завершением 4; типов 0; файлов вместе с импортами 2
shop.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет

$ flang test shop.flang
shop.flang: примеров 7, прошло 7, не прошло 0
```

The library's sources are not in this directory: its functions arrived inside
the package file, with their examples, types and proofs. Those two files are the
whole project.

The quoted name must match the module inside the package. If it does not, the
check refuses and names both:

```bash
$ flang check shop.flang
FLANG_IMPORT_NAME, строка 1, столбец 1: модуль в …/discount.flang-package называется «Скидка», а импортируется как «Скидочка»
shop.flang: не проверено — замечаний 1
```

Preconditions travel with the code and are paid at every call site. Drop a
`требует` on your side and the program stops building, though the library did
not change:

```bash
$ flang check shop.flang
FLANG_PRECONDITION_CALL, строка 34, столбец 3: вызов «Скидка в копейках» в функции «Сколько скинули» не снимает предусловие «доля не больше ста»: …
shop.flang: не проверено — замечаний 1
```

## Declare your own package

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
package is imported by. If the two diverge, the build refuses before anything is
assembled:

```bash
$ flang package skidka/discount.flang
FLANG_PACKAGE: в flang.package пакет назван «Не Скидка», а модуль в skidka/discount.flang называется «Скидка»
$ echo $?
1
```

Nothing new was added to the language for this: `skidka/discount.flang` is an
ordinary module with an ordinary `модуль` / `экспортирует` header.

Honestly about the example in the tree: on 29 August 2026 the example modules
were given English names (commit `03f0359ab`), and
`docs/examples/package/discount.flang` is now called «Discount», while the
manifest next to it still says «Скидка». So on 0.7.17 the command
`flang package docs/examples/package/discount.flang` refuses with exactly this
refusal, and the package `shop/discount.flang-package` that `shop.flang` works
with was built before the rename and carries the module «Скидка».

## Build it

```bash
$ flang package skidka/discount.flang > skidka/discount.flang-package

$ ls -la skidka/
-rw-rw-r-- 1 b b 3644 discount.flang
-rw-rw-r-- 1 b b 4343 discount.flang-package
-rw-rw-r-- 1 b b  122 flang.package
```

A package is built **only from checked code**: `flang package` first runs the
same checks `flang check` runs and refuses on a program with a type error.

The package is a JSON file. Here it is with the payload (the `исходник` field —
the module text in full, uncompressed, no base64) cut out for readability:

```json
{
  "схема": 2,
  "имя": "Скидка",
  "версия": "1.0.0",
  "вход": "./discount.flang",
  "модули": [
    { "имя": "Скидка", "путь": "./discount.flang", "функций": 2,
      "исходник": "модуль «Скидка»\n  экспортирует «Скидка в копейках», «Цена за вычетом»\n…" }
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

The `ведомость` field is the proof report: what the kernel said about the
author's functions (`доказано`, `сетка N`, `объявлено, не доказано`). It is a
record to choose a library by, not a verdict taken on trust — whoever imports
the package proves everything again, because the bodies travelled whole.

## Publish it

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

If the library is several files, all of them travel: the closure follows import
edges and leaves the library's own directory when the author wrote it that way;
whoever uses the package need not know. The example in the tree,
`examples/library-api/lib/`, does not build as a package today: there is no
`flang.package` next to `api.flang`, and
`flang package examples/library-api/lib/api.flang` on 0.7.17 answers
`FLANG_PACKAGE: рядом с … нет объявления flang.package` (run on 11 September
2026). Put a manifest there, and the command is the same as above.

The payload is **not compressed**. A module's address is the sha256 of its
source, 64 characters, and the payload is checked against it when the package is
used: change a byte and the address changes.

A package may sit on top of a package:

```
verh.flang            использует «Скидка» из "discount.flang-package"
verh.flang-package    holds both «Верх» and «Скидка»
```

Whoever imports `verh.flang-package` has no `discount.flang-package` on disk at
all, and `flang check` does not look for one: it travels as cargo inside.

## Pin a version

The version lives in `flang.package` and is covered by the package seal.
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
FLANG_PACKAGE: печать пакета «Скидка» не сходится: пакет правлен или испорчен
$ echo $?
1
```

There are no version ranges (`^1.2`, `~> 1.2`). The program gets exactly the file
that was put next to it, and nothing can update itself.

## Build offline

There is no flag for it, and none is needed. **The build never touches the
network**: there is nothing to fetch, because the code is already in the file.

```bash
$ ls
discount.flang-package  shop.flang
$ flang check shop.flang
модуль «Shop»: функций 4, из них с доказанным завершением 4; типов 0; файлов вместе с импортами 2
shop.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
```

That is also the answer to "will it build on another machine": move two files and
it builds. To check that the package yields the same thing as the sources, emit
the program twice and compare the directories:

```bash
flang emit shop.flang --target c --out ./from-package   # where the package lives
flang emit shop.flang --target c --out ./from-sources   # where the sources live
diff -r ./from-package ./from-sources && echo same
```

## What a tampered package reads like

| Tampered with | Answer |
| --- | --- |
| one character in a module's payload | `FLANG_PACKAGE`: "печать пакета «Скидка» не сходится: пакет правлен или испорчен" |
| the version | `FLANG_PACKAGE`: "печать пакета «Скидка» не сходится" |
| the package name | `FLANG_PACKAGE`: "печать пакета не сходится" |
| the source URL | `FLANG_PACKAGE`: "печать пакета не сходится" |
| a module's function count | `FLANG_PACKAGE`: "печать пакета не сходится" |

The seal covers everything the package says about itself: name, version, source,
and each module's function count. It is not a signature — it answers "this file
was not edited", not "this file is from whom you think".

Two packages carrying the same module path with different content are named
outright:

```
FLANG_PACKAGE: путь …/obshee.flang привезли два пакета с разным содержимым:
  «Библиотека а 1.0.0» и «Библиотека б 1.0.0». Двух версий одной библиотеки
  в одной программе не бывает: поднимите обе стороны до одной версии
```

If both sides carry identical content the diamond resolves itself, silently:
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

## What is missing

- **a registry and search.** There is nowhere to look a package up by name;
  `flang publish`, `flang add`, `flang search` do not exist;
- **version ranges and dependency resolution.** No `^`, no `~>`, no `latest`;
- **two versions of one library** in one program: an import merges declarations
  into one flat namespace;
- **partial updates.** An update is a full `flang package` again;
- **an author's signature.** The seal is self-certified integrity;
- **packages in the shell and the language server.** `flang repl` and
  `flang lsp` link imports themselves and know nothing of packages:
  `flang repl shop.flang`, in the very directory where `flang check` answers
  «замечаний нет», gives `FLANG_PARSE, заголовок модуля, строка 1` (the shell
  was checked on 0.7.17; the server was not).

## Where to next

- [Embedding flang](embedding.html) — how a library becomes code in your language
- [Roadmap](roadmap.html) — when the missing pieces are expected
