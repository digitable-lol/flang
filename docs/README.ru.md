[English](../README.md) · **Русский** · [Документация](https://digitable-lol.github.io/flang/)

# flang

flang — чистый функциональный язык со строгой статической типизацией, записываемый словами, а не
символами. У функции рядом с телом стоят её примеры и её утверждения о результате; компилятор
проверяет их до любого запуска и переводит проверенную программу на C, C++, Go, Rust, Java,
JavaScript, TypeScript, Elixir, Python или C#. Компилятор написан на flang. У каждого ключевого
слова есть русское и английское написание; отвечает компилятор по-русски при любом.

«Формально доказуемый» значит здесь три вещи. `тотальная`: компилятор доказывает, что функция
завершается на любом входе, либо отвергает файл. `обеспечивает`: ядро доказательств доказывает
утверждение о результате для всех входов либо сообщает, что оно не доказано, и тогда `flang run`
программу не запускает. `flang check --proof --record <файл>` записывает доказательство; отдельная
программа на C, [`checker.c`](../flang/proof/checker/checker.c), перепроверяет его по исходнику и
называет шаги, принятые со слов ядра.

Ядро не ищет. Оно применяет правила из закрытой таблицы —
[`flang/proof/tables/inference-rules.tsv`](../flang/proof/tables/inference-rules.tsv): по строке на
правило, а строки вида `ban` называют то, что выводить нарочно нельзя, — и отчёт называет правило,
которым сведено каждое утверждение. Чего это не значит:
[Что доказано, а что нет](https://digitable-lol.github.io/flang/what-is-proved.html).

## Установка

Готовые сборки выходят с каждым выпуском начиная с 0.7.29: Linux x86_64 и aarch64 (статические, для
любого дистрибутива), macOS arm64 и x86_64. Пакет называется **flang-package**; команда, которую он
ставит, — `flang`.

> **Одно имя с LLVM Flang.** Компилятор Фортрана из LLVM тоже ставит команду `flang` (формула
> `flang` в Homebrew, пакет `flang` в AUR). Если стоят оба, побеждает тот, что раньше в `PATH`.
> Проверка — `flang --version`: наш печатает первой строкой `flang <версия>`. Лечится так: каталог
> этой установки поставить в `PATH` первым либо звать команду полным путём (например,
> `~/.local/bin/flang`).

### Linux и macOS: одной строкой

```bash
curl -fsSL https://raw.githubusercontent.com/digitable-lol/flang/main/install.sh | sh
```

Выбирает сборку под вашу систему, сверяет её с `SHA256SUMS` выпуска и ставит в `~/.local` без
`sudo`. Версию закрепляет `FLANG_VERSION=0.7.29`, место — `PREFIX=/opt/flang` (обе — переменные
окружения для `sh`).

### macOS и Linux: Homebrew

```bash
brew install digitable-lol/tap/flang-package
```

`brew install digitable-lol/tap/flang` работает по-прежнему: это второе имя той же формулы.

### Любая система с asdf

```bash
asdf plugin add flang https://github.com/digitable-lol/asdf-flang.git
asdf install flang latest
asdf set -u flang latest
```

Плагин скачивает готовую сборку и сверяет её контрольную сумму. Выпуски до 0.7.29 и запуск с
`ASDF_FLANG_FROM_SOURCE=1` собираются из исходников на C (нужны `cc` и `make`).

### Debian, Ubuntu (deb) и Fedora, openSUSE (rpm)

Скачайте пакет под свой процессор со страницы
[последнего выпуска](https://github.com/digitable-lol/flang/releases/latest) и поставьте:

```bash
sudo apt install ./flang-package_<версия>_amd64.deb     # или _arm64.deb
sudo dnf install ./flang-package-<версия>-1.x86_64.rpm   # или .aarch64.rpm
```

Пакет rpm конфликтует с пакетом `flang` из Fedora (LLVM Flang): оба владеют `/usr/bin/flang`.

### Arch Linux (AUR)

В `packaging/aur/` лежит заготовка `PKGBUILD` пакета **flang-package-bin**. В AUR он ещё не
опубликован; чтобы собрать его у себя, заполните заготовку суммами выпуска
(`sh packaging/prebuilt/manifests.sh`) и запустите `makepkg -si`.

### Из исходников

```bash
git clone https://github.com/digitable-lol/flang && cd flang
make -C bootstrap -j4                  # около 6 минут
make -C bootstrap install PREFIX=$HOME/.local
```

Нужны только компилятор C99 и `make`. У такой установки нет `share/flang`, поэтому вне клона она не
находит ни стандартную библиотеку, ни рантаймы целевых языков; у готовых сборок есть и то и другое
([где flang ищет](guide/installed-library.ru.md)).

### Windows

Поставьте WSL и выполните строку для Linux выше. Родная сборка под Windows в работе.

`flang --version` печатает версию. Подробнее: [Установка](https://digitable-lol.github.io/flang/install.html).

## Первая программа

```flang
модуль «Привет»

тотальная функция «Удвоить»
  принимает н: неотрицательное
  возвращает число
  обеспечивает «удвоенное не меньше исходного» результат не меньше н
  пример «дважды два»
    дано н равно 2
    ожидается 4
  н плюс н
```

В файле **привет.flang**:

```
$ flang check привет.flang
модуль «Привет»: функций 1, из них с доказанным завершением 1; типов 0
привет.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
$ flang run привет.flang --function Удвоить --args '{"н": 21}'
доказано: утверждений 1
42
$ flang check привет.flang --proof 2>&1 | grep постусловие
  постусловие «удвоенное не меньше исходного» функции «Удвоить» — доказано по объявленным типам аргументов: цель сведена правилом «порядок по построению» — утверждение обо ВСЕХ входах, а не о написанных; теоремы при нём нет и не нужно
```

`пример` выполняется при каждой проверке. `--proof` сообщает, на чём держится каждое утверждение:
здесь постусловие следует из объявленного типа `неотрицательное` для всех входов. Замените его
утверждением, которое ядро не доказывает:

```flang
  обеспечивает «результат чётный» (результат остаток от 2) равен 0
```

Такую программу, сохранённую как **чётное.flang**, `flang check` принимает с кодом 0, а `flang run`
отвергает:

```
$ flang run чётное.flang --function Удвоить --args '{"н": 21}' 2>&1 | head -n 1
не доказано: утверждений 1: доказано 0, сетка 1, на веру 0 — запуск только по явному согласию: --на-веру
$ flang run чётное.flang --function Удвоить --args '{"н": 21}' 2>/dev/null; echo $?
3
```

«Сетка 1» значит: утверждение посчитано только на примерах функции. Следующие строки сообщения
называют его; ключ `--trust` запускает программу как есть.

## Перевод на целевой язык

```
$ flang emit привет.flang --target c --out out-c 2>/dev/null
$ grep -A 6 '^fl_status privet_udvoit' out-c/program.c
fl_status privet_udvoit(fl_ctx *ctx, fl_value n, fl_value *result,
                        fl_error *error) {
  if (n.tag != FL_NUMBER || n.tag != FL_NUMBER)
    FL_TRY(fl_not_numbers(ctx, "add", n, n, error));
  *result = fl_number(n.as.number + n.as.number);
  return FL_OK;
}
```

`flang emit` проверяет программу так же, как `flang check`, при отказе ничего не записывает, а
отчёт пишет в stderr. В каталоге вывода — модуль, рантайм цели, драйвер командной строки и
`Makefile`. Двоичный, поставленный через `make -C bootstrap install`, берёт рантайм по ключу
`--runtime flang/src/emit/c`.

У `flang` пятнадцать команд, языковой сервер редактора — одна из них: `check`, `test`, `run`,
`emit`, `ast`, `tokens`, `lint`, `facts`, `io`, `lock`, `package`,
`new`, `run-script`, `repl` и `lsp`. Печатает он код для целей `c`, `cpp`, `go`, `rust`, `java`, `js`, `ts`,
`elixir`, `python` и `csharp`.

## Документация

- Начало: [Первая программа](https://digitable-lol.github.io/flang/getting-started.html), [Учебник](https://digitable-lol.github.io/flang/tutorial.html), [Какую конструкцию когда брать](https://digitable-lol.github.io/flang/which-construct.html)
- Язык: [Карта конструкций языка](https://digitable-lol.github.io/flang/language-map.html), [Справочник конструкций](https://digitable-lol.github.io/flang/language.html), [Справочник стандартной библиотеки](https://digitable-lol.github.io/flang/stdlib.html), [`docs/flang/SPEC.md`](flang/SPEC.md)
- Инструменты: [Справочник команд](https://digitable-lol.github.io/flang/cli.html), [Справочник отказов](https://digitable-lol.github.io/flang/diagnostics.html), [Выпуски](https://digitable-lol.github.io/flang/releases.html)
- Доказательства и программы: [Доказательства: зачем и как](https://digitable-lol.github.io/flang/proofs.html), [`docs/examples/`](examples)
- Каталог `docs/`: [указатель](README.md), [раскладка репозитория](repository-layout.ru.md)

## Участие в разработке

Работа идёт в клоне; собирать нужно только компилятор.

```bash
make -C bootstrap -j8                    # даёт bootstrap/flang
sh flang/test/обход.sh                   # проверки, написанные на flang
./bootstrap/flang test flang/stdlib/     # примеры библиотеки
git config core.hooksPath .githooks      # хук перед пушем: дешёвые проверки до CI
```

Обход прогоняет 211 проверок, написанных на flang, и сличает результат с
<!-- СНЯТО 2026-09-13 строк flang/test/ledger.txt = 211 -->
`flang/test/ledger.txt` — по строке на проверку. Хук гоняет проверки, укладывающиеся в
секунды, и называет, чего не гонял; долгие — дело CI (`.github/workflows/binary.yml`). Работа
ведётся в [`docs/tasks/`](tasks/README.md): один файл — одна открытая задача; закрытая из дерева
уходит, а её номер остаётся занятым в `docs/tasks/used-numbers.tsv`. Правила дерева, которых из кода не
видно, — в [`AGENTS.md`](../.ai/AGENTS.md); как собрать, прогнать проверки и прислать правку —
[`CONTRIBUTING.md`](../CONTRIBUTING.md). Решения записаны в [`docs/adr/`](adr).

Проза этого дерева держится при дереве прогонами, а не памятью: число, набранное рукой, несёт
примету о том, чем снято (`scripts/guards/prose-numbers-guard.fscript`), путь в ссылке обязан
существовать (`scripts/guards/link-guard.fscript`), а внутреннее слово на странице для читателя со
стороны получает отказ (`scripts/guards/jargon-guard.fscript`). Эта страница — одна из тех, что эти
проверки читают.

## Написано на flang

Четыре программы вне этого репозитория: [flang-tui](https://github.com/digitable-lol/flang-tui),
[digitdisk](https://github.com/digitable-lol/digitdisk),
[flang-ribbon](https://github.com/digitable-lol/flang-ribbon) и
[flang-env](https://github.com/digitable-lol/flang-env).

На `0.x` формы JSON и коды диагностик — поверхности совместимости; синтаксис не заморожен. Докуда
дотягивается ядро доказательств и где оно останавливается, измерено в
[`docs/ROADMAP.md`](ROADMAP.md).

## Лицензия

BSD 2-Clause — [LICENSE](../LICENSE). Русская редакция без юридической силы — [LICENSE-RU.md](../LICENSE-RU.md).
