# Packages

A flang package is **one file** that holds a library together with everything
it imports. There is no package cache, and the registry is a
[list of names](registry.html), not a store of code: it has no command of the
binary and answers with an address. To publish a package, commit the file to
git; to use it, put the file next to your program and write one import line.
Building on another machine needs only your program and the package file, and
never touches the network.

Two commands of the `flang` binary do the work: `flang package` builds a
package, `flang lock` writes a lock file for a whole program. Both have
`--help`. The examples below use `docs/examples/package/`.

## Use a package

1. Put the package file next to your program.
2. Import it by its module name:

```
модуль «Shop»
  использует «Скидка» из "discount.flang-package"
```

3. Check and test as usual:

```bash
$ ls
discount.flang-package  shop.flang

$ flang check shop.flang
модуль «Shop»: функций 4, из них с доказанным завершением 4; типов 0; файлов вместе с импортами 2
shop.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет

$ flang test shop.flang
shop.flang: примеров 7, прошло 7, не прошло 0
```

The library's source files are not in this directory: its functions came
inside the package file, with their unit tests, types and proofs.

The name in the import must match the module name inside the package.
Otherwise the check fails and names both:

```bash
$ flang check shop.flang
FLANG_IMPORT_NAME, строка 1, столбец 1: модуль в …/discount.flang-package называется «Скидка», а импортируется как «Скидочка»
shop.flang: не проверено — замечаний 1
```

Preconditions (`требует`) of the library's functions come with the package, and
your code must satisfy them at every call. Remove a `требует` from your own
function, and your program stops compiling even though the library did not
change:

```bash
$ flang check shop.flang
FLANG_PRECONDITION_CALL, строка 34, столбец 3: вызов «Скидка в копейках» в функции «Сколько скинули» не снимает предусловие «доля не больше ста»: …
shop.flang: не проверено — замечаний 1
```

## Install a package by name from the registry

A package listed in the [registry](registry.html) is installed with one command
run from the flang tree. Name your program file and the package, with a version
range if you want one:

```bash
$ flang run-script package:install проба/proba.flang 'Множество строк: не ниже 1.1'
поставлено пакетов: 3 рядом с проба/proba.flang; замок проба/flang.lock — 65547 знаков:
  · Множество строк 1.1.0 → sets.flang-package: доказано 4 из 18 обязательств
  · Списки 1.4.2 → lists.flang-package: доказано 15 из 39 обязательств
  · Логика 1.2.0 → logic.flang-package: доказано 4 из 7 обязательств
$ echo $?
0
```

What happens behind that line:

1. the need is appended to `flang.needs` next to the program (one need per line:
   `Логика: не ниже 1.0`); without a name on the command line everything in the
   file is installed;
2. the registry list is fetched — from the address in `--registry`, else from the
   `registry` key in `.flangrc`, else from the stable address on GitHub;
3. from the needs of the project and the needs of the packages themselves the
   greatest version of each name that satisfies all of them is chosen; one name,
   one version; needs that cannot be met together are refused with
   `FLANG_INSTALL_CONFLICT`, which names every range and who asked for it;
4. each package is downloaded and the `sha256` of the body is compared with the
   list record **before** anything is written: a mismatch is
   `FLANG_INSTALL_FINGERPRINT`, and no file is written;
5. the files land next to the program under the list name without the version
   (`sets-1.1.0.flang-package` → `sets.flang-package`), so the line `использует
   «Множество строк» из "sets.flang-package"` does not change when the version
   moves;
6. the program is checked with `flang check` and locked with `flang lock`: the
   sources themselves go into `flang.lock`, and the build never touches the
   network again.

A package carrying a `закон` (law) or a claim "declared, not proved" widens what
you trust without proof. Such a package is shown on its own line and is installed
only with `--accept-unproven`. The proved share is printed for every package.

Installing again into an empty directory gives the same `flang.lock` byte for
byte — `flang run-script package-install:check` verifies this, and the CI job
`package-install` does the same on a clean image. Ranges are written in words,
not symbols: `любая`, `ровно 1.2.3`, `не ниже 1.2.3`, `в пределах 1.x`. The refusal
codes are in the table below.

There is no `flang install` command of the binary yet: the installer is a flang
program (`scripts/package-install.fscript`) run from the flang tree.

### Refusal codes of the installer

The exit code is 1 for all of them; the code stands in the answer with the reason.

| Code | What it means | What to do |
|---|---|---|
| `FLANG_INSTALL_USAGE` | the command was called without a program file or with an unknown key | `flang run-script package:install <program.flang> [<name>[: <range>]]... [--registry <address>] [--accept-unproven]` |
| `FLANG_INSTALL_LEDGER` | the registry list or a package file was not received (the address answered other than 200, the file is missing) or the list did not parse | check the address: the `--registry` key or `registry` in `.flangrc`; the list format is `docs/registry-list-format.md` |
| `FLANG_INSTALL_NEEDS` | the project needs in `flang.needs` did not parse | write `name: range`, one need per line; ranges are `любая`, `ровно 1.2.3`, `не ниже 1.2.3`, `в пределах 1.x` |
| `FLANG_INSTALL_CONFLICT` | the needs cannot be met together, or the registry does not know the name; the refusal names every range, who asked for it and which versions the registry knows | loosen a range or raise both sides to one version |
| `FLANG_INSTALL_FINGERPRINT` | the `sha256` of the received body differs from the registry record; nothing was written to disk | a substituted or damaged package: do not install it, tell the keeper of the list |
| `FLANG_INSTALL_UNPROVED` | the package carries a `закон` (law) or a claim "declared, not proved" and would widen the trusted base | read the named lines; if you agree, repeat with `--accept-unproven` |
| `FLANG_INSTALL_BUILD` | after installing, `flang check` or `flang lock` over the program answered non-zero | read their answer in the message; usually the program lacks the line `использует «Имя» из "file.flang-package"` |

## Make a package

**Step 1. Write the manifest.** Put `flang.package` next to the library's entry
file:

```json
{
  "имя": "Скидка",
  "версия": "1.0.0",
  "источник": "https://github.com/digitable-lol/flang"
}
```

`имя` (name) and `версия` (version) are required, `источник` (source URL) is
optional. `имя` must equal the module name on the first line of the entry
file: users import the package by this name. If they differ, `flang package`
refuses:

```bash
$ flang package skidka/discount.flang
FLANG_PACKAGE: в flang.package пакет назван «Не Скидка», а модуль в skidka/discount.flang называется «Скидка»
$ echo $?
1
```

The library itself needs nothing special: `skidka/discount.flang` is an
ordinary module with the usual `модуль` / `экспортирует` header.

The example in the repository has exactly this mismatch: the module in
`docs/examples/package/discount.flang` is called «Discount», and the manifest
next to it says «Скидка». So `flang package docs/examples/package/discount.flang`
refuses with `FLANG_PACKAGE`. The package `shop/discount.flang-package` that
`shop.flang` uses was built from a version of the module called «Скидка».

**Step 2. Build the package.**

```bash
$ flang package skidka/discount.flang > skidka/discount.flang-package

$ ls -la skidka/
-rw-rw-r-- 1 b b 3644 discount.flang
-rw-rw-r-- 1 b b 4343 discount.flang-package
-rw-rw-r-- 1 b b  122 flang.package
```

`flang package` builds **only checked code**: it first runs the same checks as
`flang check` and refuses a program with an error.

The package is a JSON file. Here it is with the module source (the `исходник`
field: the full module text, not compressed, not base64) shortened:

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

The field `ведомость` is the proof report: for each postcondition of the
library, whether the prover proved it (`доказано`), checked it only on the
examples (`сетка N`), or has neither a proof nor examples (`объявлено, не
доказано`). Use it to choose a library. You do not have to trust it: when you
import the package, your compiler proves everything again, because the full
source is inside.

**Step 3. Publish it.** Commit one file:

```bash
$ git add skidka/discount.flang-package
$ git commit -m "Скидка 1.0.0"
$ git push
```

Users download **that file** by any means: a raw link, a release asset, mail —
or install it by name once the file and its `sha256` are recorded in the
[registry list](registry.html). There is no `flang publish`.

## A library of several modules

If the library has several files, all of them go into the package: `flang
package` follows the imports from the entry file. The user of the package does
not see this.

The multi-module example `docs/examples/library-api/lib/` has no manifest, so
`flang package docs/examples/library-api/lib/api.flang` answers
`FLANG_PACKAGE: рядом с … нет объявления flang.package`. Add a `flang.package`
next to `api.flang`, and the steps are the same as above.

Each module in the package has an address: the sha256 of its source, 64 hex
characters. When the package is used, the source is checked against the
address, so changing a single byte is detected.

A package may import another package:

```
verh.flang            использует «Скидка» из "discount.flang-package"
verh.flang-package    holds both «Верх» and «Скидка»
```

Whoever imports `verh.flang-package` does not need `discount.flang-package` on
disk: it is inside.

## Change the version

The version lives in `flang.package`. To release a new version, edit the
manifest and build again:

```bash
$ sed -i 's/"версия": "1.0.0"/"версия": "1.1.0"/' skidka/flang.package
$ flang package skidka/discount.flang --pretty | grep '"версия"'
  "версия": "1.1.0",
```

Do not edit the version inside a built package. The package carries a
checksum (`печать`) over its name, version, source URL and the function
count of each module, and each module has its own address (see above). Both are
recomputed when the package is read, and an edited package is rejected:

```bash
$ sed -i 's/"версия":"1.0.0"/"версия":"9.9.9"/' vitrina/discount.flang-package
$ flang check vitrina/shop.flang
FLANG_PACKAGE: печать пакета «Скидка» не сходится: пакет правлен или испорчен
$ echo $?
1
```

There are no version ranges in symbols (`^1.2`, `~> 1.2`). Your program uses
exactly the file next to it, and nothing updates by itself; the installer picks
the version from the worded ranges in `flang.needs` (see above).

## Build offline

There is no flag for that because none is needed: **a build never uses the
network**. The code is already in the package file.

```bash
$ ls
discount.flang-package  shop.flang
$ flang check shop.flang
модуль «Shop»: функций 4, из них с доказанным завершением 4; типов 0; файлов вместе с импортами 2
shop.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
```

To make sure the package gives the same result as the library sources,
generate the program both ways and compare the directories:

```bash
flang emit shop.flang --target c --out ./from-package   # where the package lives
flang emit shop.flang --target c --out ./from-sources   # where the sources live
diff -r ./from-package ./from-sources && echo same
```

## What an edited package looks like

| What was edited | Error |
| --- | --- |
| one character of a module's source | `FLANG_PACKAGE`: "адрес модуля «Скидка» не сходится с его исходником: правлен или испорчен" |
| the version | `FLANG_PACKAGE`: "печать пакета «Скидка» не сходится: пакет правлен или испорчен" |
| the package name | the same, with the edited name in the quotes |
| the source URL | `FLANG_PACKAGE`: "печать пакета «Скидка» не сходится: пакет правлен или испорчен" |
| a module's function count | `FLANG_PACKAGE`: "печать пакета «Скидка» не сходится: пакет правлен или испорчен" |

The checksum shows that the file was not edited after it was built. It is not
a signature: it does not tell you who built the file.

If two packages bring the same module path with different content, the
compiler stops and names both:

```
FLANG_PACKAGE: путь …/obshee.flang привезли два пакета с разным содержимым:
  «Библиотека а 1.0.0» и «Библиотека б 1.0.0». Двух версий одной библиотеки
  в одной программе не бывает: поднимите обе стороны до одной версии
```

If the content is the same, the program compiles: packages are compared by
content, not by file name.

## A lock file versus a package

Both put code into a file, so they are easy to confuse.

| | `flang lock` | `flang package` |
| --- | --- | --- |
| answers | "what was this program built from" | "here is a library, use it" |
| name and version | none | required |
| how it is used | lies next to the program as `flang.lock` | imported with `использует … из "…"` |
| how many per program | one | any number |
| the checksum covers | the modules | the modules, name, version, source URL, function counts |

A program can have a `flang.lock` and packages at the same time.

## What is missing

- **A command of the binary.** There is no `flang install`: installing is a plan
  run from the flang tree (`flang run-script package:install`); there is no
  `flang publish` or `flang search` — publishing is a commit of the file and a
  line in the registry list.
- **Other people's packages in the registry.** The list holds only the example
  packages.
- **Two versions of one library** in one program: imports merge into one flat
  namespace.
- **Partial updates.** To update, run `flang package` again.
- **A signature of the author.** The checksum only shows the file was not
  edited.
- **Packages in the REPL and the language server.** `flang repl` and `flang
  lsp` resolve imports themselves and do not read packages. In the directory
  where `flang check shop.flang` reports no errors, `flang repl shop.flang`
  prints `FLANG_PARSE, заголовок модуля, строка 1` and does not see the
  library's functions. The language server has not been tried.

## Next

- [Embedding flang](embedding.html) — how a library becomes code in your
  language.
- [Roadmap](roadmap.html) — when the missing pieces are planned.
