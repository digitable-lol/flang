# Установка

Четыре пути. Всё ниже прогнано 18 августа 2026 на этой машине:
`cc (Ubuntu 15.2.0-16ubuntu1) 15.2.0`, `GNU Make 4.4.1`, `node v26.7.0`.
Чем именно проверен каждый путь — [Чем проверена установка](install-evidence.html).

| Путь | Что даёт | Что нужно на машине |
| --- | --- | --- |
| [Homebrew](#homebrew) | `flang` 0.5.0, `man flang` | `brew`, `cc`, `make` |
| [asdf / mise](#asdf-и-mise) | `flang` 0.5.0 рядом с другими версиями | `asdf` или `mise`, `cc`, `make` |
| [Из исходников](#из-исходников) | `bootstrap/flang_cli` с этого дерева | `git`, `cc`, `make` |
| [Node в свой проект](#node-в-свой-проект) | восемь целей печати, законы, языковой сервер | Node ≥ 20 |

Первые три пути дают один и тот же двоичный файл: пять команд — `check`, `run`,
`test`, `emit --target c`, `repl`. Четвёртый ставит эталонную реализацию на Node,
у которой команд и целей печати больше.

## Homebrew

```bash
brew install digitable-lol/tap/flang
```

Появятся `flang 0.5.0` и страница руководства `man flang`. Node не нужен: в
релизном архиве лежит уже напечатанный C99.

Сам `brew` в этом окружении не прогонялся — проверены формула
(`digitable-lol/homebrew-tap`, файл `Formula/flang.rb`), её `sha256` и архив
релиза.

## asdf (и mise)

```bash
asdf plugin add flang https://github.com/digitable-lol/asdf-flang.git
asdf install flang 0.5.0
asdf global flang 0.5.0
```

Появятся четыре файла — `bin/flang`, `lib/libkompilyator_flang.a`,
`include/flang_runtime.h`, `include/kompilyator_flang.h`, — и `flang --version`
ответит `flang 0.5.0`.

mise берёт тот же плагин:

```bash
mise plugin add flang https://github.com/digitable-lol/asdf-flang.git
```

Плагин предлагает семь версий: 0.4.1, 0.4.2, 0.4.4, 0.4.5, 0.4.6, 0.4.7, 0.5.0.
Список выписан целиком намеренно: **0.4.8 в нём пропущен**. Это настоящий
выпуск, но архива у него нет, и `asdf install flang 0.4.8` кончался ошибкой 404.

Сам `asdf` (и `mise`) в этом окружении не прогонялся — проверены три скрипта
плагина, которые он вызывает.

## Из исходников

```bash
git clone https://github.com/digitable-lol/flang.git
cd flang
make -C bootstrap -j4
```

Появится `bootstrap/flang_cli` — 7 127 856 байт, собранный из четырёх файлов
C99 за 40,6 с, без единого предупреждения при
`-Wall -Wextra -Werror -pedantic`.

Если `make` на машине нет, хватает одного вызова `cc`:

```bash
cd bootstrap
cc -std=c99 -O2 -o flang \
   flang_cli.c flang_repl.c flang_runtime.c kompilyator_flang.c -lm -lpthread
```

Собирайте в свежем клоне: `bootstrap/` приезжает из репозитория вместе с уже
собранными `flang_cli` и `*.o`, а `make` смотрит на время файлов — в дереве, где
сборка уже была, он ответит «nothing to be done» и оставит **старый** двоичный
файл.

## Node в свой проект

Этот путь — для того, кто зовёт язык из своего кода.

```bash
git clone https://github.com/digitable-lol/flang.git
cd мой-проект
npm install ../flang
```

Появятся `node_modules/.bin/flang` и `node_modules/.bin/flang-lsp`; своих
зависимостей у пакета ноль. Отсюда доступны остальные **семь** целей печати
(`csharp`, `elixir`, `go`, `java`, `js`, `python`, `rust`), проверка законов на
сетке, поиск нарушений прогоном примеров и языковой сервер — в двоичном файле
ничего этого нет.

Ставьте из клона, а не из реестра: `npm view @digitable-lol/fts version`
отвечает `0.4.7`, то есть реестр отстал от релиза 0.5.0.

## Что дальше

- [Первая программа](getting-started.html) — написать, проверить, запустить
- [Учебник](tutorial.html) — от первой функции до утверждения, доказанного ядром
- [Чем проверена установка](install-evidence.html) — прогоны, хеши, размеры
- [Операции языка](operations.html) — что чем делается
