# Установка

Последний выпуск — **{{выпуск.версия}}**
([релиз на GitHub](https://github.com/digitable-lol/flang/releases/latest)).

| Путь | Что ставит | Что нужно на машине |
| --- | --- | --- |
| [Одной строкой](#одной-строкой) | готовую сборку в `~/.local` без `sudo` | `curl` или `wget`, `sha256sum` или `shasum` |
| [Homebrew](#homebrew) | `flang`, библиотеку, заголовки, `man flang` | `brew` |
| [asdf](#asdf) | `flang` рядом с другими версиями | `asdf` |
| [deb и rpm](#deb-и-rpm) | пакет системы | `apt` или `dnf` |
| [Из исходников](#из-исходников) | `flang` из клона | `git`, `cc`, `make` |

Готовые сборки лежат в каждом выпуске начиная с 0.7.29: Linux x86_64 и aarch64
(статически, на любом дистрибутиве), macOS arm64 и x86_64. Пакет называется
**flang-package**, команда, которую он ставит, — `flang`. Печать во все
{{цели.словом}} целей, проверки, доказательства и языковой сервер
(`flang lsp --stdio`) есть в каждой готовой сборке.

**Имя занято LLVM Flang.** Компилятор Фортрана из LLVM тоже ставит команду
`flang` (формула `flang` в Homebrew, пакет `flang` в AUR и Fedora). Если стоят
оба, побеждает тот, что раньше на `PATH`. Проверка — `flang --version`: наш
отвечает первой строкой `flang <версия>`. Лечится порядком каталогов в `PATH`
или полным путём к команде в каталоге установки.

## Одной строкой

```bash
curl -fsSL https://raw.githubusercontent.com/digitable-lol/flang/main/install.sh | sh
```

Сценарий выбирает сборку под систему и процессор, скачивает её вместе с
`SHA256SUMS` выпуска, отказывается продолжать при несовпадении суммы и ставит
`bin/`, `share/` (на macOS ещё `lib/` и `include/`) в `~/.local`. Версию
закрепляет `FLANG_VERSION=0.7.29`, каталог — `PREFIX=/opt/flang`; обе — переменные
среды `sh`. Под Windows сценарий отвечает отказом и советует WSL.

## Homebrew

```bash
brew install digitable-lol/tap/flang-package
```

`brew install digitable-lol/tap/flang` тоже работает: это другое имя той же
формулы. Ставит `flang`, `libcompiler_flang.a`, заголовки и страницу `man flang` —
раздаёт их репозиторий
[`homebrew-tap`](https://github.com/digitable-lol/homebrew-tap).

## asdf

```bash
asdf plugin add flang https://github.com/digitable-lol/asdf-flang.git
asdf install flang latest
asdf set -u flang latest
```

Плагин скачивает готовую сборку и сверяет её сумму. Выпуски до 0.7.29, а также
установка с `ASDF_FLANG_FROM_SOURCE=1` собираются из исходников C — для этого
нужны `cc` и `make`. После установки плагин щупает поставленное:
`flang --version` обязан назвать запрошенную версию. Третья строка — `asdf set`,
а не `asdf global`: `global` и `local` удалены в asdf 0.16.0. Тот же плагин
понимает mise: `mise plugin add flang https://github.com/digitable-lol/asdf-flang.git`.

## deb и rpm

Скачайте пакет под свой процессор из
[последнего выпуска](https://github.com/digitable-lol/flang/releases/latest) и
поставьте:

```bash
sudo apt install ./flang-package_<версия>_amd64.deb     # или _arm64.deb
sudo dnf install ./flang-package-<версия>-1.x86_64.rpm   # или .aarch64.rpm
```

rpm конфликтует с пакетом `flang` из Fedora (LLVM Flang): оба владеют
`/usr/bin/flang`.

Плагин живёт в своём репозитории,
[`asdf-flang`](https://github.com/digitable-lol/asdf-flang); это дерево держит
его сабмодулем `packaging/asdf-plugin` и не выпускается, пока он расходится с
`packaging/asdf/`.

## Из исходников

```bash
git clone https://github.com/digitable-lol/flang.git
cd flang
make -C bootstrap -j4
sudo make -C bootstrap install        # или PREFIX=$HOME/.local, без sudo
```

Кладёт `bin/flang`, `lib/libcompiler_flang.a` и заголовки в `include/` — и
говорит куда:

```
…
поставлено: /usr/local/bin/flang — проверьте: flang --version
make: Leaving directory '…/bootstrap'
```

Версия будет та, что в клоне, а не последняя выпущенная. Страницы `man` на этом
пути нет: `flang.1` приезжает только в архиве релиза. Нет и `share/flang/` с
исходниками рантайма целей печати, поэтому `flang emit` из такой установки
просит назвать их каталог: `--runtime <клон>/flang/src/emit/c` или та же
переменная `FLANG_RUNTIME_DIR` — по каталогу на цель.

Если `make` на машине нет, хватает одного вызова `cc`:

```bash
cd bootstrap
cc -std=c99 -Wall -Wextra -Werror -pedantic -O2 -o flang \
   flang_cli.c flang_repl.c flang_runtime.c compiler_flang.c -lm -lpthread
```

## Не через npm

Четвёртого пути нет: пакета npm нет, `package.json` в репозитории нет.
`npm install @digitable-lol/flang` под этим именем ничего не находит, а
`npm install git+https://github.com/digitable-lol/flang.git` не ставит ни одной
команды.

**Под Windows** Homebrew не ставит, а путь из исходников хочет `cc` и `make`:
это значит MSYS2, WSL или другой набор с C99; родного пути нет. Под Windows
здесь ничего не проверяется.

Языкового сервера это не касается: он и есть `flang lsp --stdio`, подкоманда
самого двоичного, и он на каждом пути выше.

## Проверка, что встало

Три команды. Отвечают так — flang на месте.

```bash
flang --version
```

```
flang {{выпуск.версия}}
оболочка …: правит строку (стрелки, слова, история, Tab), цвет digitable
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
оболочка …: строку правит сама (Tab — дополнение, «.помощь» — клавиши)
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
| Одной строкой | команду удаления сценарий печатает последней строкой: `rm -rf` по списку поставленных файлов |
| Homebrew | `brew uninstall flang-package` |
| asdf | `asdf uninstall flang <версия>`, затем `asdf plugin remove flang` |
| deb, rpm | `sudo apt remove flang-package`, `sudo dnf remove flang-package` |
| Из исходников | `make -C bootstrap uninstall` — с тем же `PREFIX=…`, с каким ставили |

`make -C bootstrap uninstall` снимает `bin/flang`, библиотеку и страницу man, но
ОСТАВЛЯЕТ заголовки в `include/` (`compiler_flang.h`, `flang_runtime.h`,
`tls_client.h`) — удалите их руками, если каталог должен остаться пустым.

## Построено на flang

Четыре приложения вне этого репозитория — не примеры, а рабочий код:

- **[flang-tui](https://github.com/digitable-lol/flang-tui)** — раскладка терминального экрана
  на flang: полосы, обрезка по печатаемым ячейкам, укладка, вкладки, прокрутка. Печатается в Go
  и C.
- **[digitdisk](https://github.com/digitable-lol/digitdisk)** — обзор диска и системы на Linux:
  правила решаются ядром на flang, системные вызовы — хозяином на Go.
- **[flang-ribbon](https://github.com/digitable-lol/flang-ribbon)** — арифметика ленты окон на
  flang: смещения, ширина колонки, высота окна, вставка, панели. Перенесена из digitwm и сверена
  с ним побайтно на 526 871 входе. Печатается в C и в Go.
- **[flang-env](https://github.com/digitable-lol/flang-env)** — разбор значений окружения на
  flang: глубина цвета, язык, `NO_COLOR`. Чистые правила, чтение — за хозяином.

## Что дальше

- [Первая программа](getting-started.html) — написать, проверить, запустить
- [Учебник](tutorial.html) — от первой функции до утверждения, доказанного ядром
