# Настройки: файл `.flangrc`

flang читает файл настроек `.flangrc`. В нём выбирается язык, которым flang
отвечает человеку, поверхность заготовок, цвет в терминале, язык страницы
`man flang` — и что делать с недоказанной программой, если её просят запустить.

Страница говорит прямо, **что уже работает и что ещё нет**. Решение —
[ADR-0024](../adr/0024-the-settings-file-and-the-language-of-output.md).

## Как выглядит файл

Файл этого проекта — тринадцать ключей и короткие команды `script.<имя>`
([ADR-0049](../adr/0049-short-commands-live-in-the-settings-file.md)). Ключи и
слова-значения английские:

```
language = ru
surface = ru
color = auto
page = ru

version = 0.7.23
name = @digitable-lol/flang
license = BSD-2-Clause
repository = https://github.com/digitable-lol/flang
issues = https://github.com/digitable-lol/flang/issues

unproven = refuse

max-line-length = 120
max-conditional-depth = 2
lint = refuse
```

Правил записи три:

* строка — «ключ = значение», пробелы вокруг знака равенства не важны;
* строка, начинающаяся с «#», пропускается; пустая строка ничего не значит;
* одноимённый ключ встретился дважды — побеждает последний.

Незнакомый ключ пропускается молча: файл, написанный для нового flang, обязан
работать на старом.

## Файл со старыми ключами

До выпуска 0.7.22 включительно ключи и слова были русскими. Такой файл
читается по-прежнему, и на каждую старую запись читатель отвечает одной
строкой — какой английской её заменить:

| было | стало |
| --- | --- |
| `язык` | `language` |
| `поверхность` | `surface` |
| `цвет` со словами `да`, `нет`, `авто` | `color` со словами `always`, `never`, `auto` |
| `страница` | `page` |
| `версия` | `version` |
| `имя` | `name` |
| `лицензия` | `license` |
| `склад` | `repository` |
| `беды` | `issues` |
| `недоказанное` со словами `отказ`, `предупреждение`, `разрешение` | `unproven` со словами `refuse`, `warn`, `allow` |

```
$ flang run m.flang --function «Ответ»          # в файле: недоказанное = разрешение
flang: /work/.flangrc: запись «недоказанное = разрешение» устарела и пока читается — замените её на «unproven = allow»
на веру: доказанность не считалась — запуск по настройке «недоказанное = разрешение» (/work/.flangrc)
42
```

Стоят в файле обе записи — читается английская, а про старую сказано, что она
не читается и её надо удалить.

## Ключи

| ключ | значения | умолчание | кто читает |
| --- | --- | --- | --- |
| `language` | `ru` `en` `eo` `zh` | `ru` (сперва спрошена локаль) | `scripts/flangrc.fscript`, проводник `flang/bin/flangtutor`; сам компилятор — пока нет, задача [5413](../tasks/5413-the-compiler-cannot-be-told-which-language-to-speak.md) |
| `surface` | `ru` `en` `eo` `zh` | `ru` | `scripts/flangrc.fscript` |
| `color` | `always` `never` `auto` | `auto` | `scripts/flangrc.fscript` |
| `page` | `ru` `en` | `ru` (сперва спрошена локаль) | `scripts/flangrc.fscript` |
| `version` | номер вида `X.Y.Z` | нет | проверки версии, страницы man, формулы Homebrew и выпуска в `scripts/guards/`, `scripts/site/build-changelog.fscript`, `scripts/site/release-body.fscript`, `docs/site/site-numbers.flang`, `.github/workflows/release.yml` |
| `name` | строка | нет | `scripts/guards/version-derivations-guard.fscript` |
| `license` | опознаватель SPDX | нет | `scripts/guards/license-guard.fscript`, подвал сайта — `docs/site/build.flang` |
| `repository` | адрес репозитория | нет | подвал сайта — `docs/site/build.flang` |
| `issues` | адрес, куда писать о задачах и ошибках | нет | подвал сайта — `docs/site/build.flang` |
| `unproven` | `refuse` `warn` `allow` | `refuse` | сам двоичный: `flang run` и `flang io` (`flang/src/emit/c/flang_repl.c`) |
| `profile` | имя профиля или несколько через запятую | нет — библиотека без ограничений | сам двоичный при поиске модуля по имени (`flang/src/emit/c/flang_repl.c`) |
| `modules` | имена модулей библиотеки через запятую | нет | то же |
| `profile.<имя>` | имена модулей через запятую — объявление профиля | профили `flang/stdlib/profiles.flangrc` | то же |
| `max-line-length` | целое число больше нуля | нет: длина не ограничена | `flang lint` |
| `max-conditional-depth` | целое число больше нуля | нет: глубина не ограничена | `flang lint` |
| `lint` | `refuse` `warn` | `refuse` | `flang lint` |

Четыре верхних ключа — выбор человека из закрытого списка: негодное значение
отбрасывается, и решает умолчание. Пять следующих несут сведения о проекте:
закрытого списка и умолчания у них нет. Правятся они не руками — значения
разносит

```
bootstrap/flang run-script version <НОВОЕ ЧИСЛО>
```

из функций «Версия», «Имя пакета», «Лицензия», «Адрес репозитория» и «Адрес
задач» в `scripts/release/emit-package.flang`. Расхождение называет
`bootstrap/flang run-script version-derivations:check`.

Три нижних ключа задают пределы линтера; что именно считается, рассказывает
раздел `lint` [справочника команд](../site/cli.ru.md#lint).

**Что из этого работает сегодня.** Сам двоичный читает из файла ключ
`unproven`, ключи профиля — `profile`, `modules`, `profile.<имя>` — и три ключа линтера. Отвечает он по-русски всегда: выбор языка вывода — задача
[5413](../tasks/5413-the-compiler-cannot-be-told-which-language-to-speak.md),
и она требует правки самосборной части. Ключ `language` уже меняет язык
проводника `flangtutor`.

## Что делать с недоказанным

`flang run` и `flang io` считают вердикт до работы и недоказанную программу не
запускают: код `3`
([ADR-0045](../adr/0045-run-and-io-print-the-verdict-and-refuse-an-unproved-program.md)).
Ключ `--trust` решает один прогон, ключ файла — раз и навсегда:

```
unproven = warn
```

| значение | что делает |
| --- | --- |
| `refuse` | не запускать: вердикт сказан, код `3`. Умолчание |
| `warn` | вердикт посчитать, сказать строкой — и всё равно запустить, код `0` |
| `allow` | вердикта не считать вовсе; то же, что `--trust` |

Те же слова принимает ключ командной строки `--unproven`, и он старше файла.

**Негодное значение здесь — отказ вслух и код `2`, а не тишина:**

```
$ flang run m.flang --function «Ответ»          # в файле: unproven = allowed
flang: «allowed» — такого значения у «unproven» нет (/work/.flangrc).
Годны три: refuse — не запускать; warn — сказать и запустить;
allow — запустить, вердикта не считая.
```

Пробы всех исходов — `flang/proof/probes/unproven/`
(`bootstrap/flang io flang/proof/probes/unproven/run.fscript --plan Binary`).

## Профиль: какие модули библиотеки ввозятся

```
profile = mathematician
modules = UUID
```

Профиль — список модулей библиотеки, которые файлы проекта ввозят по имени.
Модуль библиотеки вне профиля и вне `modules` не находится: двоичный пишет в
stderr, какой профиль и какой файл его запретили, а проверка отвечает
`FLANG_IMPORT_NOT_FOUND`. Нет ни `profile`, ни `modules` — ограничений нет.

С языком приходят три профиля, `flang/stdlib/profiles.flangrc`:

| профиль | для чего |
| --- | --- |
| `mathematician` | числа, длинные целые, дроби, классические задачи, статистика, логика |
| `analyst` | числа, статистика, списки и строки, словари, дата и время, JSON, TOML, SQLite, Postgres |
| `programmer` | общие модули, форматы данных, сеть, базы данных, криптография |

Свой профиль объявляется строкой `profile.<имя> = Модуль, Модуль`; одноимённый
профиль библиотеки он перекрывает. Модули проекта, ввоз из файлов самой
библиотеки, `flang/core` и ввоз путём (`из "…"`) профилем не ограничиваются.
Ключи профиля читаются только из `.flangrc` проекта, не из `~/.flangrc`.
Вердикт о доказанности профиль не меняет: он считается по всем ввезённым файлам.
Решение — [ADR-0054](../adr/0054-a-profile-in-the-settings-file-selects-library-modules.md).

## Короткие команды

Строка `script.<имя> = <команда>` заводит короткую команду проекта — так же,
как раздел `scripts` в `package.json`. Имя пишется по-английски: строчная
латиница, цифры, дефис и двоеточие.

```
script.site:build = node docs/site/build.mjs
script.site:check = node docs/site/build.mjs --check
```

Исполняет её сам двоичный: `flang run-script site:build`; в этом дереве —
`bootstrap/flang run-script site:build`. Без имени команда печатает перечень.
Строку получает `/bin/sh -c` в каталоге файла, код возврата — её собственный.
Берётся только файл проекта: файл дома коротких команд не даёт, переменной
среды и довода для них нет. Решение —
[ADR-0049](../adr/0049-short-commands-live-in-the-settings-file.md); ключи и
коды — на странице [команд](../site/cli.ru.md).

## Где файл ищется

1. **`.flangrc` проекта** — от рабочего каталога вверх. Подъём обрывается на
   первом каталоге, где лежит `.flangrc`, `.git` или `flang.package`.
2. **`~/.flangrc`** — файл человека на этой машине.

Выше дома и выше корня файловой системы подъёма нет. Дальний файл не
перекрывает ближний. Проверяется прогоном:

```
bootstrap/flang io scripts/guards/flangrc-guard.fscript --plan Check
bootstrap/flang io scripts/guards/flangrc-guard.fscript --plan Forgery
```

## Что старше чего

```
довод командной строки → переменная среды → .flangrc проекта
  → .flangrc дома → локаль → умолчание
```

Переменные среды есть у семи ключей: `FLANG_LANG`, `FLANG_SURFACE`,
`FLANG_COLOR`, `FLANG_MANPAGE`, `FLANG_PROJECT_VERSION`, `FLANG_PROJECT_NAME`
и `FLANG_UNPROVEN`. Локаль (`LC_ALL`, затем `LC_MESSAGES`, затем `LANG`)
голосует только за `language` и `page`.

## Посмотреть, что вышло

Ответ плана — строка JSON; значение лежит в поле `result`.

```
bootstrap/flang io scripts/flangrc.fscript                  все тринадцать ключей
bootstrap/flang io scripts/flangrc.fscript -- version       одно значение
bootstrap/flang io scripts/flangrc.fscript -- --sources     значения и откуда каждое взято
bootstrap/flang io scripts/flangrc.fscript -- --places      какие каталоги просмотрены
bootstrap/flang io scripts/flangrc.fscript -- --file        путь взятого файла проекта
```

Ключи `--from КАТАЛОГ` и `--home КАТАЛОГ` называют начало поиска и дом.

## Чего в файле нет

Ключа «писать только русскими словами» или «только английскими» нет: все
четыре поверхности записи принимаются одновременно. Ключ `surface` говорит
лишь о том, какими словами `flang new` пишет заготовку. Подробности —
[Четыре поверхности](surfaces.ru.md).
