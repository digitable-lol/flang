---
номер: 5519
заголовок: Четыре обещания README и страницы команд снова верны, и каждое проверено прогоном
статус: свободна
исполнитель: —
ветка: —
команда: любая
карта: Как перепроверить всё это самому
рядом: 0044, 0045, 1606, 1943, 6530
---

# 5519. README врёт в четырёх местах, и все четыре сняты прогоном

Проверено 29 августа 2026 на стволе `5f1078e1`. Ни одно из четырёх не выведено
чтением: у каждого стоит команда и её вывод.

## 1. Обещано десять команд, двоичный печатает тринадцать

`README.md:187` — «`flang --help` — ten commands and the language server»;
`README.md:219` — «It answers to all ten commands … `check`, `test`, `run`,
`emit`, `ast`, `facts`, `io`, `lock`, `package`, `repl` and `lsp`». Одиннадцать
имён названы словом «десять», и `tokens` среди них нет.

Двоичный (`./bootstrap/flang --help`, код 0) называет **тринадцать**: `check`,
`test`, `run`, `emit`, `ast`, **`tokens`**, `facts`, `io`, `lock`, `package`,
`repl`, `lsp`, `--mcp-mode` — плюс саму оболочку. Собственная справка двоичного
при этом тоже говорит «Здесь все 10 команд», то есть врёт и она.

## 2. Страница команд показывает отказ на ключ, который принимается

`docs/site/cli.md:373` и `:379`:

> `io` has no `--args` and no `--timeout` key.
> ```
> $ flang io план.flang --timeout 5
> flang io: непонятный ключ «--timeout»
> ```

Прогон 29 августа:

```
$ ./bootstrap/flang io <план>.flang --timeout 5
FLANG_PARSE в файле <план>.flang, строка 2, столбец 29: …
```

Ключ **пройден**, дело дошло до разбора плана. Контрольный опыт с заведомо
ложным ключом на том же файле:

```
$ ./bootstrap/flang io <план>.flang --nesushchestvuyushchiy 5
flang io: непонятный ключ «--nesushchestvuyushchiy»
```

Значит проверка настоящая: отказ на несуществующий ключ есть, на `--timeout` —
нет.

## 3. «Каждый ввоз в четырёх пробах указывает на существующий файл» — неправда

`README.md:163`: «what remains was pruned to what still resolves — every import
in those four files points at a file that exists».

```
$ ls flang/src/
emit          (и больше ничего)
$ ls flang/src/parser.mjs
No such file or directory
```

А `flang/test/jargon-guard.test.mjs:221` читает именно его:

```js
const парсер = читаемое(readFileSync(КОРЕНЬ + "flang/src/parser.mjs", "utf8"), "строки")
```

`npm test` от этого падает — прогон 29 августа, **код 1, провалилось 10 проб**:

```
✖ литерал-образец с кавычкой внутри не сбивает разбор …
  Error: ENOENT: no such file or directory, open '…/flang/src/parser.mjs'
```

Остальные девять валятся по двум другим причинам: шесть — сторож жаргона, три —
цель `go` (`error obtaining VCS status`, сборка `go build` без
`-buildvcs=false`). Это **три разные беды в одном красном прогоне**, и чинить их
надо порознь.

## 4. «Каждый файл пакета несёт метку лицензии» — четыре нарушения на 75 файлах

Прогон сторожа 29 августа, `./bootstrap/flang io scripts/license-guard.flang`,
**код 1**:

```
нарушений лицензионной разметки: 4 на 75 просмотренных файлов:
  · examples/host-boundary/host.c: нет SPDX-License-Identifier в начале файла
  · flang/conc/scheduler.js: нет SPDX-License-Identifier в начале файла
  · flang/scripts/per-file-proof-share.py: нет SPDX-License-Identifier в начале файла
  · flang/scripts/сличить-двух-сводителей.py: нет SPDX-License-Identifier в начале файла
```

Владелец 29 августа назвал 3 нарушения на 74 файлах; за сутки прибавился ещё
один файл на Python без шапки. **Я ставлю своё число: 4 на 75.**

Побочно: имя `flang/scripts/сличить-двух-сводителей.py` — кириллица в имени
файла, тогда как `AGENTS.md` требует английских имён для новых файлов.

## Что сделать

Каждое из четырёх — либо поправить обещание по правде, либо поправить дерево по
обещанию. Смешивать нельзя: «десять команд» лечится счётом, а `--timeout`
лечится решением — либо ключ убрать, либо страницу переписать.

## Как понять, что сделано

```sh
./bootstrap/flang --help                        # число команд сходится с README
./bootstrap/flang io <план> --timeout 5         # то, что обещает docs/site/cli.md
npm test                                        # код 0
./bootstrap/flang io scripts/license-guard.flang # код 0
```

Все четыре команды дают то, что обещано, и каждая проверка стоит в списке
ярлыков, иначе она тихо умрёт.

## Что от неё зависит

README — первое, что читает человек снаружи. Задача 0044 (числа пересчитываются
честно) — про то же самое, но про сайт.
