# Установка

Последний выпуск — **0.5.1**, коммит `6d845f9`
([релиз на GitHub](https://github.com/digitable-lol/flang/releases/tag/v0.5.1)).

| Путь | Что ставит | Что нужно на машине |
| --- | --- | --- |
| [Homebrew](#homebrew) | `flang 0.5.1` и `man flang` | `brew`, `cc`, `make` |
| [asdf](#asdf) | `flang` рядом с другими версиями | `asdf`, `cc`, `make` |
| [Из исходников](#из-исходников) | команду `flang` из клона | `git`, `cc`, `make` |
| [Через npm](#через-npm) | `flang` и `flang-lsp` для проекта на Node | Node ≥ 20 |

Первые три пути дают один и тот же двоичный файл. Команд у него десять —
`check`, `test`, `run`, `emit`, `ast`, `facts`, `io`, `lock`, `package`,
`repl`, — а голая команда `flang` открывает оболочку, как `python` или `iex`.
Печатать он умеет только в C; все {{цели.словом}} целей печати и языковой
сервер даёт четвёртый путь.

## Homebrew

```bash
brew install digitable-lol/tap/flang
```

Ставит `flang 0.5.1`, `libcompiler_flang.a`, заголовки и страницу
`man flang`. Node не нужен: в архиве релиза лежит готовый C99.

## asdf

```bash
asdf plugin add flang https://github.com/digitable-lol/asdf-flang.git
asdf install flang 0.5.1
asdf set -u flang 0.5.1
```

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
- [Чем проверена установка](install-evidence.html) — прогоны, хеши, размеры и
  чего проверить не удалось
