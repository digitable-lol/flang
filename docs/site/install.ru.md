# Установка

Последний выпуск — **{{выпуск.версия}}**
([релиз на GitHub](https://github.com/digitable-lol/flang/releases/latest)).

| Путь | Что ставит | Что нужно на машине |
| --- | --- | --- |
| [Homebrew](#homebrew) | `flang {{выпуск.версия}}` и `man flang` | `brew`, `cc`, `make` |
| [asdf](#asdf) | `flang` рядом с другими версиями | `asdf`, `cc`, `make` |
| [Из исходников](#из-исходников) | команду `flang` из клона | `git`, `cc`, `make` |
| [Через npm](#через-npm) | `flang` и `flang-lsp` внутри проекта на Node | Node ≥ 20, `cc`, `make` |

Все четыре пути дают ОДИН И ТОТ ЖЕ двоичный файл и один и тот же набор
возможностей: четвёртый кладёт его в `node_modules/.bin` проекта, остальные
три — в систему. Печать в другие языки, языковой сервер, проверка и
доказательства есть на любом из четырёх — выбирать путь по тому, что вы
собираетесь делать, не нужно, только по тому, что у вас на машине. Команд у него двенадцать —
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
asdf install flang {{выпуск.версия}}
asdf set -u flang {{выпуск.версия}}
```

ПРЕДУПРЕЖДЕНИЕ, снятое прогоном 23 августа 2026. Плагин asdf живёт в отдельном
репозитории `digitable-lol/asdf-flang`, и правка в дереве до человека не
доходит, пока её туда не скопировали. Сторож
`scripts/plagin-asdf-opublikovan.flang` сверяет выложенный плагин с
`packaging/asdf` именами объектов git и сегодня отвечает: **расхождений 2 при 4
файлах** — разошлись `bin/install` и `README.md`. Починка установки лежит в
дереве и НЕ выложена.

Пока это так, `asdf install flang {{выпуск.версия}}` у выложенного плагина
отказывает: его `bin/install` ищет в архиве файл под прежним именем. Рабочие
пути на сегодня — Homebrew и из исходников; они дают тот же двоичный.

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

Путь ровно для одного: положить `flang` внутрь проекта на Node, рядом с его
прочими инструментами, и получить языковой сервер там, где его ищет редактор
такого проекта.

ПЕЧАТИ В ДРУГИЕ ЯЗЫКИ npm не добавляет: `flang emit --target …` печатает во
все {{цели.словом}} целей на любом из четырёх путей, и Node для этого не нужен
ни на одном. Если flang не зовётся из вашего кода на Node — этот путь вам
ничего не даёт, берите Homebrew или исходники.

```bash
npm install git+https://github.com/digitable-lol/flang.git
```

Ставит `node_modules/.bin/flang` и `node_modules/.bin/flang-lsp`. Своих
зависимостей у пакета нет, но `cc` и `make` на машине нужны: при установке
пакет СОБИРАЕТ тот же самый двоичный компилятор из лежащего в нём C99
(`packaging/postinstall.mjs`), а не везёт вторую реализацию на JavaScript. До
20 августа 2026 вёз — и она расходилась с двоичным на 54 вызовах из 59.

Из реестра npm пока не поставить: под именем `@digitable-lol/flang` ещё ничего
не выложено.

## Что дальше

- [Первая программа](getting-started.html) — написать, проверить, запустить
- [Учебник](tutorial.html) — от первой функции до утверждения, доказанного ядром
- [Операции языка](operations.html) — что чем делается
