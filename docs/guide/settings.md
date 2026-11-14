# Settings: the `.flangrc` file

`.flangrc` is the project's settings file: which language `flang check` answers in, what to do
with an unproved program, which library modules may be imported, the linter limits and the
project's short commands.

## What the file looks like

```
language = ru
unproven = refuse

profile = programmer

max-line-length = 120
max-conditional-depth = 2
lint = refuse

script.test = flang test main.flang
```

- A line is "key = value"; spaces around the equals sign do not matter.
- A line starting with "#" and an empty line are skipped.
- If a key occurs twice, the last one wins.
- An unknown key is skipped silently.

## Keys

| key | values | default | read by |
| --- | --- | --- | --- |
| `language` | `ru` `en` | `ru` | `flang check` |
| `unproven` | `refuse` `warn` `allow` | `refuse` | `flang run`, `flang io` |
| `profile` | a profile name, or several separated by commas | none — the library is unrestricted | module lookup by name |
| `modules` | library module names separated by commas | none | the same |
| `profile.<name>` | module names separated by commas — declares your own profile | the library's three profiles | the same |
| `max-line-length` | an integer above zero | none: length is unlimited | `flang lint` |
| `max-conditional-depth` | an integer above zero | none: depth is unlimited | `flang lint` |
| `lint` | `refuse` `warn` | `refuse` | `flang lint` |
| `script.<name>` | a command line | none | `flang run-script` |

The key `registry` is gone: since 0.7.34 the package registry and the command `flang install`
are removed, and a module is attached by a link — [Packages](../site/packages.md). A line
`registry = …` in an old file is skipped as an unknown key.

The keys `surface`, `color`, `page`, `version`, `name`, `license`, `repository`, `issues` are
read by the build tools of the flang repository itself. The `flang` commands ignore them.

## The answer language

```
$ flang check m.flang                     # in the file: language = en
module «M»: functions 2, with termination proved 2; types 0
m.flang: verified — parsing, types, termination, proof kernel and examples; no problems found
```

A `FLANG_*` code does not depend on the language. Not every diagnostic has an English text:
those without one arrive in Russian. The other commands always answer in Russian.

## What to do with an unproved program

`flang run` and `flang io` compute the verdict before working. A program with an unproved
promise is not run, and the exit code is `3`:

```
$ flang run m.flang --function «Сумма» --args '{"части":[1,2,3]}'
не доказано: утверждений 2: доказано 1, сетка 1, на веру 0 — запуск только по явному согласию: --на-веру
…
$ echo $?
3
```

The switch `--trust` decides one run; the key in the file decides all of them:

```
unproven = warn
```

```
$ flang run m.flang --function «Сумма» --args '{"части":[1,2,3]}'
не доказано: утверждений 2: доказано 1, сетка 1, на веру 0 — запуск по настройке «unproven = warn» (/work/.flangrc)
6
```

| value | what it does |
| --- | --- |
| `refuse` | do not run: the verdict is stated, exit code `3`. The default |
| `warn` | compute the verdict, say it in one line and run, exit code `0` |
| `allow` | do not compute the verdict; the same as `--trust` |

The command-line switch `--unproven` takes the same words. A bad value is a refusal with exit
code `2`:

```
$ flang run m.flang --function «Сумма» --args '{"части":[1,2,3]}'    # in the file: unproven = allowed
flang: «allowed» — такого значения у «unproven» нет (/work/.flangrc).
Годны три: refuse — не запускать; warn — сказать и запустить;
allow — запустить, вердикта не считая.
```

## Profile: which library modules are imported

```
profile = mathematician
modules = UUID
```

A profile is a list of library modules that the project's files import by name. A module
outside the profile and outside `modules` is not found:

```
$ flang check u.flang                     # in the file: profile = mathematician; u.flang imports «UUID»
flang: модуль «UUID» библиотеки не входит в профиль «mathematician» (/work/.flangrc) — по имени не ввозится;
допишите его в «modules» или выберите другой профиль
FLANG_IMPORT_NOT_FOUND в файле u.flang, строка 1, столбец 1: не найден модуль «UUID»: …
```

With neither `profile` nor `modules` there are no restrictions. Three profiles come with the
language:

| profile | what for |
| --- | --- |
| `mathematician` | numbers, big integers, rationals, classic problems, statistics, logic |
| `analyst` | numbers, statistics, lists and strings, dictionaries, date and time, JSON, TOML, SQLite, Postgres |
| `programmer` | general modules, data formats, network, databases, cryptography |

Your own profile is declared with a line `profile.<name> = Module, Module`; it overrides a
library profile of the same name. Project modules and imports by path (`из "…"`) are not
restricted by a profile. Profile keys are read only from the project's `.flangrc`, not from
`~/.flangrc`. A profile does not change the proof verdict: it is computed over all imported
files.

## Linter limits

```
max-line-length = 40
lint = refuse
```

```
$ flang lint m.flang
flang lint: файлов 1; max-line-length 40: 3; max-conditional-depth: без предела; не разобрано 0
m.flang:5: длина строки 53 > 40 (max-line-length)
m.flang:13: длина строки 59 > 40 (max-line-length)
m.flang:17: длина строки 62 > 40 (max-line-length)
$ echo $?
1
```

With `lint = warn` the same findings are printed and the exit code is `0`. What exactly is
measured is in the `lint` section of the [command reference](../site/cli.md#lint).

## Short commands

A line `script.<name> = <command>` defines a short command of the project, like the `scripts`
section of `package.json`. The name uses lowercase Latin letters, digits, hyphen and colon.

```
script.hello = echo привет
```

```
$ flang run-script hello
привет
$ flang run-script
короткие команды проекта (/work/.flangrc):

  hello                              echo привет

звать: flang run-script <имя> [доводы…]
```

The line is given to `/bin/sh -c` in the directory of the file; the exit code is its own. Only
the project file counts: `~/.flangrc` gives no short commands.

## Where the file is looked up

1. **The project's `.flangrc`** — from the working directory upwards. The climb stops at the
   first directory that holds `.flangrc`, `.git` or `flang.package`.
2. **`~/.flangrc`** — the person's file on this machine.

A farther file does not override a nearer one.

## What takes precedence over what

```
command-line switch → environment variable → project .flangrc → home .flangrc → default
```

Environment variables: `FLANG_LANG` for `language`, `FLANG_UNPROVEN` for `unproven`.

```
$ FLANG_UNPROVEN=allow flang run m.flang --function «Сумма» --args '{"части":[1,2,3]}'
на веру: доказанность не считалась — запуск по переменной среды FLANG_UNPROVEN=allow
6
```

## The old spelling of the key

The old Russian spelling of the key `unproven` is still read, and `flang` answers it with the replacement:

| Russian key | English key |
| --- | --- |
| `недоказанное` with the words `отказ`, `предупреждение`, `разрешение` | `unproven` with the words `refuse`, `warn`, `allow` |

```
$ flang run m.flang --function «Сумма» --args '{"части":[1,2,3]}'    # in the file: недоказанное = разрешение
flang: /work/.flangrc: запись «недоказанное = разрешение» устарела и пока читается — замените её на «unproven = allow»
на веру: доказанность не считалась — запуск по настройке «недоказанное = разрешение» (/work/.flangrc)
6
```

If both lines are in the file, the English one is read, and the old one is reported as a line to
delete.

## What the file does not have

There is no key for "write only in Russian words" or "only in English": all surfaces are
accepted at once — [Surfaces](surfaces.md).
