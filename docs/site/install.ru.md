# Установка

Последний выпуск — **{{выпуск.версия}}**
([релиз на GitHub](https://github.com/digitable-lol/flang/releases/latest)).

| Путь | Что ставит | Что нужно на машине |
| --- | --- | --- |
| [Homebrew](#homebrew) | `flang`, библиотеку, заголовки, `man flang` | `brew`, `cc`, `make` |
| [asdf](#asdf) | `flang` рядом с другими версиями | `asdf`, `cc`, `make` |
| [Из исходников](#из-исходников) | `flang` из клона | `git`, `cc`, `make` |
| [Через npm](#через-npm) | `flang` и `flang-lsp` внутри проекта на Node | Node ≥ 20, `cc`, `make` |

Все четыре дают ОДИН И ТОТ ЖЕ двоичный файл. Печать во все {{цели.словом}}
целей, проверки, доказательства и языковой сервер (`flang lsp --stdio`) есть на
каждом пути — выбирайте по тому, что уже стоит на машине.

## Homebrew

```bash
brew install digitable-lol/tap/flang
```

Ставит `flang`, `libcompiler_flang.a`, два заголовка и страницу `man flang`.
Node не нужен: в архиве релиза лежит готовый C99.

## asdf

```bash
asdf plugin add flang https://github.com/digitable-lol/asdf-flang.git
asdf install flang {{выпуск.версия}}
asdf set -u flang {{выпуск.версия}}
```

Ставит в каталог версии `bin/flang`, `lib/libcompiler_flang.a` и два заголовка.
Третья строка — `asdf set`, а не `asdf global`: `global` и `local` удалены в
asdf 0.16.0. Тот же плагин понимает mise:
`mise plugin add flang https://github.com/digitable-lol/asdf-flang.git`.

Не работает: плагин выложен в отдельном репозитории и отстаёт от этого дерева,
поэтому `asdf install flang {{выпуск.версия}}` может ответить отказом. Пока он
не догнал — берите Homebrew или исходники.

## Из исходников

```bash
git clone https://github.com/digitable-lol/flang.git
cd flang
make -C bootstrap -j4
sudo make -C bootstrap install        # или PREFIX=$HOME/.local, без sudo
```

Кладёт четыре файла — `bin/flang`, `lib/libcompiler_flang.a`,
`include/flang_runtime.h`, `include/compiler_flang.h` — и говорит куда:

```
поставлено: /usr/local/bin/flang — проверьте: flang --version
```

Версия будет та, что в клоне, а не последняя выпущенная. Страницы `man` на этом
пути нет: `flang.1` приезжает только в архиве релиза.

Если `make` на машине нет, хватает одного вызова `cc`:

```bash
cd bootstrap
cc -std=c99 -Wall -Wextra -Werror -pedantic -O2 -o flang \
   flang_cli.c flang_repl.c flang_runtime.c compiler_flang.c -lm -lpthread
```

## Через npm

Путь ровно для одного: положить `flang` внутрь проекта на Node, рядом с его
прочими инструментами, и дать редактору языковой сервер `flang-lsp` там, где
редактор его ищет.

```bash
npm install git+https://github.com/digitable-lol/flang.git
```

Ставит `node_modules/.bin/flang` и `node_modules/.bin/flang-lsp`. Своих
зависимостей у пакета нет, но `cc` и `make` на машине нужны: при установке он
СОБИРАЕТ тот же двоичный файл из лежащего в нём C99.

Не работает: `npm install @digitable-lol/flang` — под этим именем в реестре
ничего не выложено, ставьте по адресу git выше.

## Проверка, что встало

Три команды. Отвечают так — flang на месте.

```bash
flang --version
```

```
flang {{выпуск.версия}}
```

Положите в `privet.flang`:

```flang
модуль «Привет»
тотальная функция «Два»
  возвращает число
  2
```

```bash
flang check privet.flang
```

```
модуль «Привет»: функций 1, из них с доказанным завершением 1; типов 0
privet.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
```

Код возврата 0. Файл, который не прошёл, отвечает `не проверено — замечаний N`
и кодом возврата 1.

```bash
flang repl
```

```
flang {{выпуск.версия}} — оболочка. «.помощь» — команды, «.выход» или Ctrl-D — конец.
Объявление заканчивается пустой строкой, выражение вычисляется сразу.
» 2 плюс 2
4
```

Выход — Ctrl-D. Если вместо `4` оболочка отвечает `вычислять нечем: не найден
libcompiler_flang.a`, двоичный файл поставлен, а библиотека — нет: положите
`libcompiler_flang.a` рядом с двоичным файлом или укажите каталог с ней в
`FLANG_LIB_DIR`.

## Удаление

| Путь | Команда |
| --- | --- |
| Homebrew | `brew uninstall flang` |
| asdf | `asdf uninstall flang {{выпуск.версия}}`, затем `asdf plugin remove flang` |
| Из исходников | `make -C bootstrap uninstall` — с тем же `PREFIX=…`, с каким ставили |
| npm | `npm uninstall @digitable-lol/flang` |

`make -C bootstrap uninstall` снимает `bin/flang`, библиотеку и страницу man, но
ОСТАВЛЯЕТ два заголовка в `include/` — удалите их руками, если каталог должен
остаться пустым.

## Что дальше

- [Первая программа](getting-started.html) — написать, проверить, запустить
- [Учебник](tutorial.html) — от первой функции до утверждения, доказанного ядром
