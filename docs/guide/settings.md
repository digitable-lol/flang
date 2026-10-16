# Settings: the `.flangrc` file

flang reads the settings file `.flangrc`. It selects the language flang uses to answer a
person, the surface of the templates, terminal colour, the language of the `man flang` page —
and what to do with an unproved program when someone asks to run it.

The page says plainly **what works and what does not yet**. The decision is
[ADR-0024](../adr/0024-the-settings-file-and-the-language-of-output.md).

## What the file looks like

This project's file has thirteen keys and short commands `script.<name>`
([ADR-0049](../adr/0049-short-commands-live-in-the-settings-file.md)). Keys and value words
are in English:

```
language = ru
surface = ru
color = auto
page = ru

version = 0.7.28
name = @digitable-lol/flang
license = BSD-2-Clause
repository = https://github.com/digitable-lol/flang
issues = https://github.com/digitable-lol/flang/issues

unproven = refuse

max-line-length = 120
max-conditional-depth = 2
lint = refuse
```

There are three syntax rules:

* a line is "key = value"; spaces around the equals sign do not matter;
* a line starting with "#" is skipped; an empty line means nothing;
* if the same key appears twice, the last one wins.

An unknown key is skipped silently: a file written for a newer flang must work on an older
one.

## A file with the old keys

A file with Russian keys and words is read, and for each such entry the reader
prints one line saying which English entry replaces it:

| Russian key | English key |
| --- | --- |
| `язык` | `language` |
| `поверхность` | `surface` |
| `цвет` with the words `да`, `нет`, `авто` | `color` with the words `always`, `never`, `auto` |
| `страница` | `page` |
| `версия` | `version` |
| `имя` | `name` |
| `лицензия` | `license` |
| `склад` | `repository` |
| `беды` | `issues` |
| `недоказанное` with the words `отказ`, `предупреждение`, `разрешение` | `unproven` with the words `refuse`, `warn`, `allow` |

```
$ flang run m.flang --function «Ответ»          # в файле: недоказанное = разрешение
flang: /work/.flangrc: запись «недоказанное = разрешение» устарела и пока читается — замените её на «unproven = allow»
на веру: доказанность не считалась — запуск по настройке «недоказанное = разрешение» (/work/.flangrc)
42
```

If the file holds both entries, the English one is read, and the reader says that the old one
is not read and should be deleted.

## Keys

| key | values | default | read by |
| --- | --- | --- | --- |
| `language` | `ru` `en` `eo` `zh` | `ru` (the locale is asked first) | `scripts/flangrc.fscript`, the tutorial `flang/bin/flangtutor`; the compiler — `flang check` ([ADR-0102](../adr/0102-the-compiler-answers-in-the-language-of-the-settings.md)), which does not consult the locale |
| `surface` | `ru` `en` `eo` `zh` | `ru` | `scripts/flangrc.fscript` |
| `color` | `always` `never` `auto` | `auto` | `scripts/flangrc.fscript` |
| `page` | `ru` `en` | `ru` (the locale is asked first) | `scripts/flangrc.fscript` |
| `version` | a number of the form `X.Y.Z` | none | the version, man page, Homebrew formula and release guards in `scripts/guards/`, `scripts/site/build-changelog.fscript`, `scripts/site/release-body.fscript`, `docs/site/site-numbers.flang`, `.github/workflows/release.yml` |
| `name` | a string | none | `scripts/guards/version-derivations-guard.fscript` |
| `license` | an SPDX identifier | none | `scripts/guards/license-guard.fscript`, the site footer — `docs/site/build.flang` |
| `repository` | the repository URL | none | the site footer — `docs/site/build.flang` |
| `issues` | the URL for reporting tasks and bugs | none | the site footer — `docs/site/build.flang` |
| `unproven` | `refuse` `warn` `allow` | `refuse` | the binary itself: `flang run` and `flang io` (`flang/src/emit/c/flang_repl.c`) |
| `profile` | a profile name, or several separated by commas | none — the library is unrestricted | the binary itself when looking up a module by name (`flang/src/emit/c/flang_repl.c`) |
| `modules` | library module names separated by commas | none | same |
| `profile.<name>` | module names separated by commas — a profile declaration | the profiles in `flang/stdlib/profiles.flangrc` | same |
| `max-line-length` | an integer greater than zero | none: line length is unlimited | `flang lint` |
| `max-conditional-depth` | an integer greater than zero | none: depth is unlimited | `flang lint` |
| `lint` | `refuse` `warn` | `refuse` | `flang lint` |

The top four keys are a person's choice from a closed list: an invalid value is discarded, and
the default decides. The next five carry facts about the project: they have no closed list and
no default. They are not edited by hand — the values are propagated by

```
bootstrap/flang run-script version <НОВОЕ ЧИСЛО>
```

from the functions «Версия», «Имя пакета», «Лицензия», «Адрес репозитория» and «Адрес задач»
in `scripts/release/emit-package.flang`. A mismatch is reported by
`bootstrap/flang run-script version-derivations:check`.

The bottom three keys set the linter's limits; what exactly is counted is described in the
`lint` section of the [command reference](../site/cli.md#lint).

**What of this works.** The binary itself reads the key `unproven`, the profile keys —
`profile`, `modules`, `profile.<name>` — and the three linter keys from the file. The key
`language` (and the variable `FLANG_LANG`, which takes precedence over the file) is read by
`flang check`
([ADR-0102](../adr/0102-the-compiler-answers-in-the-language-of-the-settings.md)):
the `FLANG_*` code stays the same, and the text comes from the catalogue
`flang/messages/catalog.tsv`. 13 of the 144 codes have an English template
(`bootstrap/flang run-script messages:check`); the rest answer in Russian — task
[2510](../tasks/2510-most-compiler-messages-have-no-english-template.md).
The other commands always answer in Russian — task
[5413](../tasks/5413-the-compiler-cannot-be-told-which-language-to-speak.md).
The key `language` also changes the language of the `flangtutor` tutorial.

## What to do with an unproved program

`flang run` and `flang io` compute the verdict before running and do not run an unproved
program: exit code `3`
([ADR-0045](../adr/0045-run-and-io-print-the-verdict-and-refuse-an-unproved-program.md)).
The `--trust` flag decides for one run; the key in the file decides once and for all:

```
unproven = warn
```

| value | what it does |
| --- | --- |
| `refuse` | do not run: the verdict is printed, exit code `3`. The default |
| `warn` | compute the verdict, print it as a line — and run anyway, exit code `0` |
| `allow` | do not compute the verdict at all; the same as `--trust` |

The command-line flag `--unproven` accepts the same words, and it takes precedence over the
file.

**An invalid value here is a loud refusal with exit code `2`, not silence:**

```
$ flang run m.flang --function «Ответ»          # в файле: unproven = allowed
flang: «allowed» — такого значения у «unproven» нет (/work/.flangrc).
Годны три: refuse — не запускать; warn — сказать и запустить;
allow — запустить, вердикта не считая.
```

Probes for every outcome are in `flang/proof/probes/unproven/`
(`bootstrap/flang io flang/proof/probes/unproven/run.fscript --plan Binary`).

## Profile: which library modules are imported

```
profile = mathematician
modules = UUID
```

A profile is a list of library modules that the project's files import by name. A library
module outside the profile and outside `modules` is not found: the binary writes to stderr
which profile and which file excluded it, and the check answers `FLANG_IMPORT_NOT_FOUND`. With
neither `profile` nor `modules` there are no restrictions.

The language ships three profiles, in `flang/stdlib/profiles.flangrc`:

| profile | for what |
| --- | --- |
| `mathematician` | numbers, big integers, fractions, classic problems, statistics, logic |
| `analyst` | numbers, statistics, lists and strings, dictionaries, date and time, JSON, TOML, SQLite, Postgres |
| `programmer` | general modules, data formats, networking, databases, cryptography |

You declare your own profile with a line `profile.<name> = Модуль, Модуль`; it overrides the
library profile of the same name. Project modules, imports from the library's own files,
`flang/core` and imports by path (`из "…"`) are not restricted by the profile. The profile
keys are read only from the project's `.flangrc`, not from `~/.flangrc`. The profile does not
change the proof verdict: the verdict is computed over all imported files. The decision is
[ADR-0054](../adr/0054-a-profile-in-the-settings-file-selects-library-modules.md).

## Short commands

A line `script.<name> = <command>` defines a short project command — the same way as the
`scripts` section in `package.json`. The name is written in English: lowercase Latin letters,
digits, hyphen and colon.

```
script.site:build = node docs/site/build.mjs
script.site:check = node docs/site/build.mjs --check
```

The binary itself runs it: `flang run-script site:build`; in this tree,
`bootstrap/flang run-script site:build`. Without a name, the command prints the list. The line
is passed to `/bin/sh -c` in the file's directory, and the exit code is its own. Only the
project's file is used: the home file provides no short commands, and there is no environment
variable or argument for them. The decision is
[ADR-0049](../adr/0049-short-commands-live-in-the-settings-file.md); flags and exit codes are
on the [commands](../site/cli.md) page.

## Where the file is looked up

1. **The project's `.flangrc`** — from the working directory upward. The search stops at the
   first directory that contains `.flangrc`, `.git` or `flang.package`.
2. **`~/.flangrc`** — the person's file on this machine.

The search does not go above the home directory or above the file system root. A farther file
does not override a nearer one. This is checked by a run:

```
bootstrap/flang io scripts/guards/flangrc-guard.fscript --plan Check
bootstrap/flang io scripts/guards/flangrc-guard.fscript --plan Forgery
```

## What takes precedence over what

```
довод командной строки → переменная среды → .flangrc проекта
  → .flangrc дома → локаль → умолчание
```

Seven keys have environment variables: `FLANG_LANG`, `FLANG_SURFACE`, `FLANG_COLOR`,
`FLANG_MANPAGE`, `FLANG_PROJECT_VERSION`, `FLANG_PROJECT_NAME` and `FLANG_UNPROVEN`. The
locale (`LC_ALL`, then `LC_MESSAGES`, then `LANG`) has a say only in `language` and `page`.

## Seeing the result

The plan's answer is a JSON line; the value is in the `result` field.

```
bootstrap/flang io scripts/flangrc.fscript                  все тринадцать ключей
bootstrap/flang io scripts/flangrc.fscript -- version       одно значение
bootstrap/flang io scripts/flangrc.fscript -- --sources     значения и откуда каждое взято
bootstrap/flang io scripts/flangrc.fscript -- --places      какие каталоги просмотрены
bootstrap/flang io scripts/flangrc.fscript -- --file        путь взятого файла проекта
```

The flags `--from DIRECTORY` and `--home DIRECTORY` set the start of the search and the home
directory.

## What the file does not have

There is no key for "write only in Russian words" or "only in English words": all four
surfaces are accepted at the same time. The key `surface` only says which words `flang new`
uses to write a template. Details: [Surfaces](surfaces.md).
