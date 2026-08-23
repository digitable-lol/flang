# Установка

Последний выпуск — **{{выпуск.версия}}**
([релиз на GitHub](https://github.com/digitable-lol/flang/releases/latest)).

| Путь | Что ставит | Что нужно на машине |
| --- | --- | --- |
| [Homebrew](#homebrew) | `flang {{выпуск.версия}}` и `man flang` | `brew`, `cc`, `make` |
| [asdf](#asdf) | `flang` рядом с другими версиями | `asdf`, `cc`, `make` |
| [Из исходников](#из-исходников) | команду `flang` из клона | `git`, `cc`, `make` |
| [Через npm](#через-npm) | `flang` и `flang-lsp` для проекта на Node | Node ≥ 20 |

Все четыре пути дают один и тот же двоичный файл: четвёртый кладёт его в
`node_modules/.bin` проекта, остальные три — в систему. Команд у него двенадцать —
`check`, `test`, `run`, `emit`, `ast`, `tokens`, `facts`, `io`, `lock`,
`package`, `repl`, `lsp`, — а голая команда `flang` открывает оболочку, как
`python` или `iex`. Печатает он во все {{цели.словом}} целей, и языковой сервер
для редактора у него свой: `flang lsp --stdio`.

## Homebrew

```bash
brew install digitable-lol/tap/flang
```

Ставит `flang {{выпуск.версия}}`, `libcompiler_flang.a`, заголовки и страницу
`man flang`. Node не нужен: в архиве релиза лежит готовый C99.

## asdf

```bash
asdf plugin add flang https://github.com/digitable-lol/asdf-flang.git
asdf install flang 0.5.0
asdf set -u flang 0.5.0
```

Здесь стоит 0.5.0, а не последний выпуск, и это не описка: у выложенного
плагина установка отказывала на 0.5.1 — скрипт ищет в архиве файл под прежним
именем. Починка в дереве уже есть, но в репозиторий плагина не выложена, так
что до выкладки через asdf ставится 0.5.0, а последний выпуск даёт Homebrew.

Ставит в каталог версии `bin/flang`, `lib/libcompiler_flang.a` и два
заголовка. Третья строка — `asdf set`, а не `asdf global`: `global` и `local`
удалены в asdf 0.16.0.

Тот же плагин понимает mise: `mise plugin add flang https://github.com/digitable-lol/asdf-flang.git`.

## Из исходников

```bash
git clone https://github.com/digitable-lol/flang.git
cd flang
make -C bootstrap -j4
sudo make -C bootstrap install        # или PREFIX=$HOME/.local, без sudo
```

Ставит команду `flang`, `libcompiler_flang.a` и два заголовка; снять —
`make -C bootstrap uninstall`. Версия будет та, что в клоне, а не последняя
выпущенная. Страницы `man` на этом пути нет: `flang.1` приезжает только в
архиве релиза.

Если `make` на машине нет, хватает одного вызова `cc`:

```bash
cd bootstrap
cc -std=c99 -Wall -Wextra -Werror -pedantic -O2 -o flang \
   flang_cli.c flang_repl.c flang_runtime.c compiler_flang.c -lm -lpthread
```

## Через npm

Путь для того, кто печатает программу в другие языки или зовёт flang из своего
кода на Node.

```bash
npm install git+https://github.com/digitable-lol/flang.git
```

Ставит `node_modules/.bin/flang` и `node_modules/.bin/flang-lsp`: все
{{цели.словом}} целей печати ({{цели.список}}) и языковой сервер. Своих
зависимостей у пакета нет.

Из реестра npm пока не поставить: под именем `@digitable-lol/flang` ещё ничего
не выложено.

## Что дальше

- [Первая программа](getting-started.html) — написать, проверить, запустить
- [Учебник](tutorial.html) — от первой функции до утверждения, доказанного ядром
- [Операции языка](operations.html) — что чем делается
