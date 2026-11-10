# Установка

Последний выпуск — **{{выпуск.версия}}**
([релиз на GitHub](https://github.com/digitable-lol/flang/releases/latest)).

| Способ | Что ставит | Что нужно на машине |
| --- | --- | --- |
| [Одной строкой](#одной-строкой) | готовую сборку в `~/.local` без `sudo` | `curl` или `wget`, `sha256sum` или `shasum` |
| [Homebrew](#homebrew) | `flang`, библиотеку, заголовки, `man flang` | `brew` |
| [asdf](#asdf) | `flang` рядом с другими версиями | `asdf` |
| [deb и rpm](#deb-и-rpm) | пакет системы | `apt` или `dnf` |
| [Из исходников](#из-исходников) | `flang` из клона | `git`, `cc`, `make` |

Готовые сборки есть для Linux x86_64 и aarch64 (статические, идут на любом
дистрибутиве) и для macOS arm64 и x86_64. Пакет называется **flang-package**,
команда — `flang`. В каждой сборке есть проверки, доказательства, печать во все
{{цели.словом}} целей и языковой сервер (`flang lsp --stdio`).

Под Windows родной сборки нет: ставьте в WSL.

**Имя `flang` занято ещё и LLVM Flang.** Компилятор Фортрана из LLVM ставит
команду с тем же именем. Если стоят оба, работает тот, что раньше на `PATH`.
Наш отвечает на `flang --version` первой строкой `flang <версия>`. Чинится
порядком каталогов в `PATH` или полным путём к команде.

## Одной строкой

```bash
curl -fsSL https://raw.githubusercontent.com/digitable-lol/flang/main/install.sh | sh
```

Сценарий выбирает сборку под систему и процессор, скачивает её, сверяет с
`SHA256SUMS` выпуска и ставит в `~/.local`; при несовпадении суммы не ставит
ничего. Последней строкой он печатает команду удаления.

| Переменная среды | Что задаёт | Пример |
| --- | --- | --- |
| `FLANG_VERSION` | версию вместо последней | `FLANG_VERSION=0.7.34` |
| `PREFIX` | каталог вместо `~/.local` | `PREFIX=/opt/flang` |

## Homebrew

```bash
brew install digitable-lol/tap/flang-package
```

Ставит `flang`, `libcompiler_flang.a`, заголовки и страницу `man flang`.
`brew install digitable-lol/tap/flang` — другое имя той же формулы.

## asdf

```bash
asdf plugin add flang https://github.com/digitable-lol/asdf-flang.git
asdf install flang latest
asdf set -u flang latest
```

Плагин скачивает готовую сборку и сверяет её сумму. С
`ASDF_FLANG_FROM_SOURCE=1` он собирает из исходников — тогда нужны `cc` и
`make`. Тот же плагин работает в mise:
`mise plugin add flang https://github.com/digitable-lol/asdf-flang.git`.

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

## Из исходников

```bash
git clone https://github.com/digitable-lol/flang.git
cd flang
make -C bootstrap -j4
sudo make -C bootstrap install        # или PREFIX=$HOME/.local, без sudo
```

Последняя строка вывода говорит, куда поставлено:

```
поставлено: /usr/local/bin/flang — проверьте: flang --version
```

В `PREFIX` ложатся `bin/flang`, `lib/libcompiler_flang.a`, заголовки в
`include/`, рантаймы целей печати в `share/flang/<цель>/` и стандартная
библиотека в `share/flang/stdlib/`. Версия будет та, что в клоне. Страницы
`man` на этом пути нет. Где двоичный ищет библиотеку и как показать ему клон —
в [руководстве](../guide/installed-library.ru.md).

Если `make` на машине нет, хватает одного вызова `cc`:

```bash
cd bootstrap
cc -std=c99 -Wall -Wextra -Werror -pedantic -O2 -o flang \
   flang_cli.c flang_repl.c flang_runtime.c compiler_flang.c -lm -lpthread
```

## Проверка, что встало

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
flang run privet.flang --function Два
```

```
доказано: утверждений 0
2
```

## Удаление

| Способ | Команда |
| --- | --- |
| Одной строкой | `rm -rf …` — готовую команду сценарий напечатал последней строкой при установке |
| Homebrew | `brew uninstall flang-package` |
| asdf | `asdf uninstall flang <версия>`, затем `asdf plugin remove flang` |
| deb, rpm | `sudo apt remove flang-package`, `sudo dnf remove flang-package` |
| Из исходников | `make -C bootstrap uninstall` — с тем же `PREFIX=…`, с каким ставили |

`make -C bootstrap uninstall` оставляет заголовки в `include/`
(`compiler_flang.h`, `flang_runtime.h`, `tls_client.h`) — удалите их руками.

## Что дальше

- [Первая программа](getting-started.html) — написать, проверить, запустить
- [Учебник](tutorial.html) — от первой функции до утверждения, доказанного ядром
- [Устранение неполадок](troubleshooting.html) — если что-то не встало
