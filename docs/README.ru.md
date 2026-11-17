[English](../README.md) · **Русский** · [Документация](https://digitable-lol.github.io/flang/)

# flang

flang — чистый функциональный язык со строгой статической типизацией. Ключевые слова в нём — слова
(`функция`, `принимает`, `возвращает`). Рядом с телом функции записаны её тесты и условия на
результат. Компилятор проверяет их до запуска и генерирует из проверенной программы код на C, C++,
Go, Rust, Java, JavaScript, TypeScript, Elixir, Python или C#. Компилятор написан на flang. У
каждого ключевого слова есть русское и английское написание; сообщения компилятора — по-русски.

Что здесь называется формальным доказательством:

- `тотальная` — компилятор доказывает, что функция завершается на любом входе; не смог — файл не
  проходит проверку.
- `обеспечивает` — постусловие, условие на результат. Компилятор доказывает его для всех входов
  или сообщает, что доказательства нет; такую программу `flang run` не запускает.
- `flang check --proof` выводит отчёт о доказательствах. Отдельная программа на C,
  [`checker.c`](../flang/proof/checker/checker.c), перепроверяет доказательства и сообщает,
  сколько из них перепроверить не смогла.

Компилятор не ищет доказательство перебором. Он применяет правила вывода из фиксированной таблицы
[`flang/proof/tables/inference-rules.tsv`](../flang/proof/tables/inference-rules.tsv), и отчёт
называет правило для каждого постусловия. Границы метода:
[Что доказано, а что нет](https://digitable-lol.github.io/flang/what-is-proved.html).

## Установка

Готовые сборки выходят с каждым выпуском: Linux x86_64 и aarch64 (статические, для любого
дистрибутива), macOS arm64 и x86_64. Пакет называется **flang-package**; команда, которую он
ставит, — `flang`.

> **Одно имя с LLVM Flang.** Компилятор Фортрана из LLVM тоже ставит команду `flang` (формула
> `flang` в Homebrew, пакет `flang` в AUR). Если стоят оба, работает тот, что раньше в `PATH`.
> Проверка — `flang --version`: наш отвечает первой строкой `flang <версия>`. Исправляется так:
> каталог этой установки поставить в `PATH` первым либо вызывать команду полным путём (например,
> `~/.local/bin/flang`).

### Linux и macOS: одной строкой

```bash
curl -fsSL https://raw.githubusercontent.com/digitable-lol/flang/main/install.sh | sh
```

Выбирает сборку под вашу систему, проверяет её контрольную сумму по `SHA256SUMS` выпуска и ставит
в `~/.local` без `sudo`. Версию задаёт `FLANG_VERSION=<версия>`, каталог — `PREFIX=/opt/flang` (обе
— переменные окружения для `sh`).

### macOS и Linux: Homebrew

```bash
brew install digitable-lol/tap/flang-package
```

`brew install digitable-lol/tap/flang` — второе имя той же формулы.

### Любая система с asdf

```bash
asdf plugin add flang https://github.com/digitable-lol/asdf-flang.git
asdf install flang latest
asdf set -u flang latest
```

Плагин скачивает готовую сборку и проверяет её контрольную сумму. С `ASDF_FLANG_FROM_SOURCE=1` он
собирает `flang` из исходников на C (нужны `cc` и `make`).

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
make -C bootstrap -j4                  # несколько минут
make -C bootstrap install PREFIX=$HOME/.local
```

Нужны только компилятор C99 и `make`. Вместе с `flang` в `share/flang` ставятся стандартная
библиотека и библиотеки времени выполнения целевых языков, поэтому установка работает и вне клона
([где flang их ищет](guide/installed-library.ru.md)). Программа независимой проверки доказательств
при такой установке не ставится; в готовых сборках она есть.

### Windows

Поставьте WSL и выполните строку для Linux выше. Родной сборки под Windows пока нет.

`flang --version` выводит версию. Подробнее: [Установка](https://digitable-lol.github.io/flang/install.html).

## Первая программа

Файл `hello.flang`:

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

```bash
flang check hello.flang
```

```text
модуль «Привет»: функций 1, из них с доказанным завершением 1; типов 0
hello.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
```

Код возврата 0. Вторая строка перечисляет проверки: синтаксис («разбор»), типы, завершение функций,
доказательства («ядро») и тесты («примеры»). «Замечаний нет» читается как «ошибок нет».

```bash
flang run hello.flang --function Удвоить --args '{"н": 21}'
```

```text
доказано: утверждений 1
42
```

Первая строка: единственное постусловие файла доказано. Вторая — результат. Тест (`пример`)
выполняется при каждой проверке. Постусловие здесь следует из типа `неотрицательное` и доказано для
всех входов.

Замените постусловие таким, которое компилятор сам не доказывает. Файл `hello.flang` целиком:

```flang
модуль «Привет»

тотальная функция «Удвоить»
  принимает н: неотрицательное
  возвращает число
  обеспечивает «результат чётный» (результат остаток от 2) равен 0
  пример «дважды два»
    дано н равно 2
    ожидается 4
  н плюс н
```

`flang check` принимает такой файл с кодом 0, а `flang run` не запускает:

```bash
flang run hello.flang --function Удвоить --args '{"н": 21}'
```

```text
не доказано: утверждений 1: доказано 0, сетка 1, на веру 0 — запуск только по явному согласию: --на-веру
…
```

Код возврата 3. «Сетка 1» читается как «одно постусловие проверено только на тестах». Следующие
строки ответа называют это постусловие. Ключ `--trust` (по-русски `--на-веру`) запускает программу
без доказательства. Как дописать доказательство —
[Первое доказательство](https://digitable-lol.github.io/flang/first-proof.html).

## Код на целевом языке

Верните в `hello.flang` первое постусловие и сгенерируйте код на C:

```bash
flang emit hello.flang --target c --out out-c
grep -A 6 '^fl_status privet_udvoit' out-c/program.c
```

```text
fl_status privet_udvoit(fl_ctx *ctx, fl_value n, fl_value *result,
                        fl_error *error) {
  if (n.tag != FL_NUMBER || n.tag != FL_NUMBER)
    FL_TRY(fl_not_numbers(ctx, "add", n, n, error));
  *result = fl_number(n.as.number + n.as.number);
  return FL_OK;
}
```

Проверки постусловия в функции нет: оно доказано. `flang emit` проверяет программу так же, как
`flang check`, и при ошибке ничего не записывает. В каталоге вывода лежат модуль, библиотека времени
выполнения, программа для вызова из командной строки и `Makefile`.

У `flang` пятнадцать команд, языковой сервер для редактора — одна из них: `check`, `test`, `run`,
`emit`, `ast`, `tokens`, `lint`, `facts`, `io`, `lock`, `package`,
`new`, `run-script`, `repl` и `lsp`. Код генерируется для целевых языков `c`, `cpp`, `go`, `rust`,
`java`, `js`, `ts`, `elixir`, `python` и `csharp`.

## Документация

- Начало: [Первая программа](https://digitable-lol.github.io/flang/getting-started.html), [Первое доказательство](https://digitable-lol.github.io/flang/first-proof.html), [Учебник](https://digitable-lol.github.io/flang/tutorial.html), [Какую конструкцию когда брать](https://digitable-lol.github.io/flang/which-construct.html)
- Язык: [Карта конструкций языка](https://digitable-lol.github.io/flang/language-map.html), [Справочник конструкций](https://digitable-lol.github.io/flang/language.html), [Справочник стандартной библиотеки](https://digitable-lol.github.io/flang/stdlib.html), [`docs/flang/SPEC.md`](flang/SPEC.md)
- Инструменты: [Справочник команд](https://digitable-lol.github.io/flang/cli.html), [Коды ошибок](https://digitable-lol.github.io/flang/diagnostics.html), [Выпуски](https://digitable-lol.github.io/flang/releases.html)
- Доказательства и программы: [Доказательства: зачем и как](https://digitable-lol.github.io/flang/proofs.html), [`docs/examples/`](examples)
- Каталог `docs/`: [указатель](README.md), [раскладка репозитория](repository-layout.ru.md)

## Участие в разработке

Работа идёт в клоне; собирать нужно только компилятор.

```bash
make -C bootstrap -j8                    # собирает bootstrap/flang
sh flang/test/обход.sh                   # тесты, написанные на flang
./bootstrap/flang test flang/stdlib/     # тесты стандартной библиотеки
git config core.hooksPath .githooks      # быстрые проверки перед git push
```

Перед `git push` выполняются проверки, которые занимают секунды; долгие выполняет CI
(`.github/workflows/binary.yml`). Открытые задачи лежат в [`docs/tasks/`](tasks/README.md), по файлу
на задачу. Как собрать компилятор, запустить проверки и прислать правку —
[`CONTRIBUTING.md`](../CONTRIBUTING.md). Правила репозитория, которых не видно из кода, —
[`AGENTS.md`](../.ai/AGENTS.md). Принятые решения записаны в [`docs/adr/`](adr).

Текст документации проверяется автоматически. Числа в тексте сравниваются с репозиторием
(`scripts/guards/prose-numbers-guard.fscript`). Путь в ссылке обязан существовать
(`scripts/guards/link-guard.fscript`). Внутренние слова проекта на страницах для читателей
запрещены (`scripts/guards/jargon-guard.fscript`).

## Написано на flang

Четыре программы вне этого репозитория: [flang-tui](https://github.com/digitable-lol/flang-tui),
[digitdisk](https://github.com/digitable-lol/digitdisk),
[flang-ribbon](https://github.com/digitable-lol/flang-ribbon) и
[flang-env](https://github.com/digitable-lol/flang-env).

Что остаётся совместимым от выпуска к выпуску и что замораживает 1.0, написано на странице
[«Совместимость»](site/stability.ru.md). Что компилятор доказывает сам и где останавливается,
описано в [`docs/ROADMAP.md`](ROADMAP.md).

## Лицензия

BSD 2-Clause — [LICENSE](../LICENSE). Русская редакция без юридической силы — [LICENSE-RU.md](../LICENSE-RU.md).
