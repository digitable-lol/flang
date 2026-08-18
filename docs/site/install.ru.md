# Установка: четыре пути

Четыре способа получить работающий `flang`. Ниже — только то, что прогнано
18 августа 2026 на этой машине: `cc (Ubuntu 15.2.0-16ubuntu1) 15.2.0`,
`GNU Make 4.4.1`, `node v26.7.0`. Что не прогнано — названо не прогнанным.

| Путь | Что даёт | Нужно на машине | Прогнано здесь |
| --- | --- | --- | --- |
| Homebrew | `flang` 0.5.0, `man flang` | `brew`, `cc`, `make` | формула и её хеш — да; сам `brew` — **нет** |
| asdf / mise | `flang` 0.5.0 рядом с другими версиями | `asdf` или `mise`, `cc`, `make` | три скрипта плагина — да; сам `asdf` — **нет** |
| Из исходников | команда `flang` (`make -C bootstrap install`) | `git`, `cc`, `make` | да, в пустом каталоге |
| Node в свой проект | восемь целей печати, законы, поиск нарушений | Node ≥ 20 | да, `npm install` в чистый проект |

## 1. Homebrew

```bash
brew install digitable-lol/tap/flang
```

Формула живёт в отдельном репозитории `digitable-lol/homebrew-tap` — так устроен
brew: `digitable-lol/tap/flang` разворачивается в
`github.com/digitable-lol/homebrew-tap`, файл `Formula/flang.rb`.

**Что здесь проверено прогоном.** Опубликованная формула скачана
(HTTP 200, 10 314 байт). Её `version` — `0.5.0`, её `url` ведёт на релиз
`v0.5.0`, её `sha256` — `7dc75fec…d0505`. Архив по этому `url` скачан отдельно:
HTTP 200, **929 817 байт**, `sha256sum` совпал с формулой посимвольно. Внутри
архива ровно **9 файлов**: `LICENSE`, `Makefile`, `flang.1`, четыре `.c` и два
`.h` — ни одного `.o`, ни одного собранного бинарника. Тело формулы, без строк
комментариев, **совпало** с `packaging/homebrew/flang.rb` этого дерева: копия в
tap не отстала.

**Чего здесь НЕ проверено.** Сам `brew`: в этом окружении его нет
(`command -v brew` пуст). Значит непроверенным осталось всё, что умеет только
brew, — разбор формулы как Ruby, `bin.install`, песочница сборки, `brew audit`.
Сказать «ставится через Homebrew» на этом основании нельзя. Сказать можно ровно
то, что выше: **архив, хеш и формула сошлись**.

Node не нужен: в релизном архиве лежит уже напечатанный C99. Компилятор flang
написан на самом flang и печатается в C — Node нужен тому, кто **развивает
язык**, а не тому, кто его ставит.

## 2. asdf (и mise)

```bash
asdf plugin add flang https://github.com/digitable-lol/asdf-flang.git
asdf install flang 0.5.0
asdf global flang 0.5.0
```

mise понимает те же плагины: `mise plugin add flang https://github.com/digitable-lol/asdf-flang.git`.

Репозиторий плагина заведён и публичен: `github.com/digitable-lol/asdf-flang`
отвечает HTTP 200.

**Что здесь проверено прогоном.** Три скрипта плагина запущены вручную, с
`PATH=/usr/bin:/bin` — то есть **с Node, физически отсутствующим в `PATH`**
(`command -v node` пуст, `node` лежит в `/usr/local/bin`, куда путь не ведёт):

```
bin/list-all  → 0.4.1 0.4.2 0.4.4 0.4.5 0.4.6 0.4.7 0.5.0
bin/download  → скачано и распаковано 9 файлов
bin/install   → 54,9 с, «flang 0.5.0 установлен»
```

После этого в каталоге установки лежат четыре файла: `bin/flang`,
`lib/libkompilyator_flang.a`, `include/flang_runtime.h`,
`include/kompilyator_flang.h`. `bin/flang --version` отвечает `flang 0.5.0`.

**Чего здесь НЕ проверено.** Сам `asdf` и сам `mise`: ни того, ни другого в
окружении нет. Значит непроверенным осталось то, что делает asdf вокруг
скриптов, — `plugin add`, разводка версий, подстановка в `PATH` через shim.
Проверено ровно одно: **три скрипта, которые asdf вызывает, дают рабочий
`flang 0.5.0` без Node**.

Из ветки плагин ставить отказывается намеренно: `asdf install flang ref:main`
падает с объяснением. В репозитории компилятор лежит исходником на самом flang,
и первый бинарник из него получает Node — то есть ровно та зависимость, от
которой плагин избавляет.

## 3. Из исходников

```bash
git clone https://github.com/digitable-lol/flang.git
cd flang
make -C bootstrap -j4
sudo make -C bootstrap install        # или PREFIX=$HOME/.local, без sudo
```

**Имя у программы одно — `flang`**, и на этой дороге тоже. `make` кладёт рядом с
исходниками `bootstrap/flang`, а `make install` ставит его как команду вместе с
`libkompilyator_flang.a`, заголовками и страницей `flang.1` (если она рядом —
в архиве релиза есть, в дереве репозитория нет). Снять — `make -C bootstrap
uninstall`. Прогнано здесь: `make install PREFIX=…` в пустой префикс, дальше
`flang --version` → `flang 0.5.0`, `flang --help` → краткая справка.

**Прогнано в пустом каталоге, и это не формальность.** `bootstrap/` лежит в
репозитории вместе с уже собранными `flang` и `*.o`, а `make` смотрит на
время файлов: в дереве, где сборка уже была, он отвечает «nothing to be done» и
оставляет **старый** бинарник. Замер, снятый так, меряет ноль. Поэтому дерево
разложено `git archive` в пустой каталог, артефакты удалены, и только потом
запущен `make`:

```
на входе   13 093 142 байт напечатанного C и заголовков (249 571 строк)
make -j4   38,5 с, ни одного предупреждения при -Wall -Wextra -Werror -pedantic
на выходе  bootstrap/flang — 7 149 128 байт, связан с libc, libm, libpthread
```

Один вызов `cc` вместо `make` тоже работает — и это полезно знать, когда `make`
на машине нет:

```bash
cc -std=c99 -Wall -Wextra -Werror -pedantic -O2 -o flang \
   flang_cli.c flang_repl.c flang_runtime.c kompilyator_flang.c -lm -lpthread
```

Прогнано: **85,7 с**, бинарник 7 159 800 байт. Дольше `make -j4` — сборка
идёт в один поток, а `-flto` из `Makefile` здесь не задан. Имя выхода тут задаёте
вы сами ключом `-o`, и назвать его стоит `flang`: у программы одно имя.

Что умеет собранный двоичный и где его границы — на странице
[Первая программа](getting-started.html).

## 4. Node: встроить в существующий проект

Этот путь — не для того, кто **ставит язык**, а для того, кто **зовёт его из
своего кода**: правила лежат рядом с кодом, который их применяет.

```bash
git clone https://github.com/digitable-lol/flang.git
cd мой-проект
npm install ../flang
```

Прогнано в чистом каталоге: `npm install` из клона добавил **1 пакет** за
397 мс —
зависимостей у него ноль, ключей `dependencies` и `devDependencies` в
`package.json` нет вовсе. Появились два запускаемых файла:
`node_modules/.bin/flang` и `node_modules/.bin/flang-lsp`. Прогон из скрипта
проекта:

```js
import { execFileSync } from 'node:child_process'
execFileSync('./node_modules/.bin/flang', ['check', 'proba.flang'], { encoding: 'utf8' })
// {"valid":true,"module":"Проба","functions":[{"name":"Два","total":true}],"types":[],"diagnostics":[]}
```

**Почему из клона, а не из реестра и не из git-адреса.** Обе короткие дороги
здесь прогнаны и обе не сработали, поэтому в тексте их нет:

- `npm view @digitable-lol/fts version` отвечает **0.4.7**. В реестре лежит
  отставшая версия, релиз — 0.5.0;
- `npm install github:digitable-lol/flang` и `npm install
  git+https://github.com/digitable-lol/flang.git` в этом окружении падают на
  «Could not read from remote repository» — npm ходит в git по ssh, ключей нет.
  На машине с ключами это, вероятно, пройдёт, но «вероятно» на страницу
  установки не пишут.

Ради чего этот путь: остальные **семь** целей печати (`csharp`, `elixir`, `go`,
`java`, `js`, `python`, `rust`), законы на сетке, поиск нарушений прогоном
примеров и языковой сервер — всего этого в двоичном нет.

## Что дальше

- [Первая программа](getting-started.html) — написать, проверить, запустить
- [Операции языка](operations.html) — что чем делается
- [Как писать пакеты](packages.html) — модули, замок, чего нет
