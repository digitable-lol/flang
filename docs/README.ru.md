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
программа на C, [`checker.c`](../flang/proof/checker/checker.c), перепроверяет его по исходнику и называет
шаги, принятые со слов ядра. Чего это не значит: [Что доказано, а что нет](https://digitable-lol.github.io/flang/what-is-proved.html).

## Установка

```bash
brew install digitable-lol/tap/flang

asdf plugin add flang https://github.com/digitable-lol/asdf-flang.git
asdf install flang latest
asdf set -u flang latest

git clone https://github.com/digitable-lol/flang && cd flang
make -C bootstrap -j4
sudo make -C bootstrap install        # или PREFIX=$HOME/.local, без sudo
```

Homebrew, asdf или клон: во всех трёх случаях компилятор собирается из исходников на C99, нужны
`cc` и `make`. `flang --version` печатает версию. Подробнее: [Установка](https://digitable-lol.github.io/flang/install.html).

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

Такую программу, сохранённую как **чётное.flang**, `flang check` принимает с кодом 0, а `flang run` отвергает:

```
$ flang run чётное.flang --function Удвоить --args '{"н": 21}' 2>&1 | head -n 1
не доказано: утверждений 1: доказано 0, сетка 1, на веру 0 — запуск только по явному согласию: --на-веру
$ flang run чётное.flang --function Удвоить --args '{"н": 21}' 2>/dev/null; echo $?
3
```

Следующие строки сообщения называют недоказанное утверждение; ключ `--trust` запускает программу
как есть.

## Перевод на целевой язык

```
$ flang emit привет.flang --target c --out out-c 2>/dev/null
$ grep -A 4 '^fl_status privet_udvoit' out-c/privet.c
fl_status privet_udvoit(fl_ctx *ctx, fl_value n, fl_value *result, fl_error *error) {
  if (n.tag != FL_NUMBER || n.tag != FL_NUMBER) FL_TRY(fl_not_numbers(ctx, "add", n, n, error));
  *result = fl_number(n.as.number + n.as.number);
  return FL_OK;
}
```

`flang emit` проверяет программу так же, как `flang check`, при отказе ничего не записывает, а
отчёт пишет в stderr. В каталоге вывода — модуль, рантайм цели, драйвер командной строки и
`Makefile`. После `make -C bootstrap install` рантайм задаётся ключом `--runtime flang/src/emit/c`.

У `flang` четырнадцать команд, языковой сервер редактора — одна из них: `check`, `test`, `run`,
`emit`, `ast`, `tokens`, `facts`, `io`, `lock`, `package`,
`new`, `run-script`, `repl` и `lsp`. Печатает он код для целей `c`, `cpp`, `go`, `rust`, `java`, `js`, `ts`,
`elixir`, `python` и `csharp`.

## Документация

- Начало: [Первая программа](https://digitable-lol.github.io/flang/getting-started.html), [Учебник](https://digitable-lol.github.io/flang/tutorial.html), [Какую конструкцию когда брать](https://digitable-lol.github.io/flang/which-construct.html)
- Язык: [Карта конструкций языка](https://digitable-lol.github.io/flang/language-map.html), [Справочник конструкций](https://digitable-lol.github.io/flang/language.html), [Справочник стандартной библиотеки](https://digitable-lol.github.io/flang/stdlib.html), [`docs/flang/SPEC.md`](flang/SPEC.md)
- Инструменты: [Справочник команд](https://digitable-lol.github.io/flang/cli.html), [Справочник отказов](https://digitable-lol.github.io/flang/diagnostics.html), [Выпуски](https://digitable-lol.github.io/flang/releases.html)
- Доказательства и программы: [Доказательства: зачем и как](https://digitable-lol.github.io/flang/proofs.html), [`docs/examples/`](examples)

## Участие в разработке

Правило имён: файл без языкового суффикса — английский; суффикс `.ru.md` отмечает его русскую
редакцию. Исключение — `README.md` и `SPEC.md` рядом с кодом: они держат эти имена на любом
языке, потому что GitHub показывает их первой страницей каталога.

## Как устроен репозиторий

У корня 6 каталогов. Всё, что есть язык, лежит под `flang/`; снаружи — то, что языком не
является: точка раскрутки, упаковка, примеры, замеры, документация и задачник.
`sh scripts/guards/published-vs-tree.sh --карта` сверяет эту карту с деревом на каждый пуш.

<!-- КАРТА-НАЧАЛО: между этими метками каждая строка начинается с имени каталога корня;
     sh scripts/guards/published-vs-tree.sh --карта сличает состав с деревом. -->

```
bootstrap/      компилятор, напечатанный в C99, и его Makefile: «make -C bootstrap» собирает двоичный
flang/          язык: self/ (компилятор), core/, stdlib/, proof/, concurrency/, ct/, src/emit/ (рантаймы целей), scripts/, test/, bin/ (flangtutor) — только код; его контракты лежат в docs/flang/
docs/examples/  238 программ на flang в 26 наборах: leetcode, rosetta, crypto, db, io, wal, web, library-api и другие
docs/editors/   языковой сервер, подсветка для Vim и VS Code, заявка в github-linguist
packaging/      формула Homebrew, плагин asdf, страница flang.1, проверки установки
scripts/        проверки дерева, перепечатка точки раскрутки, релизный архив, журнал изменений
fspec/          бизнес-правила, записанные доказанными спецификациями, и проверка, что новое правило не отменяет старое
docs/           документация: исходники сайта, руководство, решения (adr/), отчёты замеров, база знаний и flang/ — контракты языка, вынесенные из кода
docs/flang/     контракты языка — по SPEC.md на слой, вынесенные из кода; рядом с кодом остался только указатель
docs/tasks/     открытая и закрытая работа дерева, по файлу на задачу
.github/        CI и выпуск
.ai/            что читает помощник, работающий в дереве: AGENTS.md и .claude/skills; в корне `AGENTS.md` и `.claude` оставлены символическими ссылками сюда, и по старым именам оба по-прежнему находятся
```

<!-- КАРТА-КОНЕЦ -->

Внутри `flang/`: [`flang/self/`](../flang/self) — компилятор, 64 файла на flang —
<!-- СНЯТО 2026-09-17 файлов flang/self/*.flang = 64 -->
лексер, разбор, типы, завершаемость, ядро доказательств и по печати на каждую цель.
[`flang/stdlib/`](../flang/stdlib) — стандартная библиотека: **52 модуль, 1764 функции и 3745
примеров**, которые прогоняются при каждой проверке:
<!-- СНЯТО 2026-09-17 файлов flang/stdlib/*.flang = 52 -->
<!-- СНЯТО 2026-09-13 примеров-в flang/stdlib/*.flang = 3745 -->
списки, строки, числа, множества, словари, JSON, UTF-8, даты, два драйвера баз данных
(`postgres`, `sqlite`), сеть (`http`, `tls`, `redis`), криптография, написанная на flang (`aes`,
`x25519`, `sha256`, `hmac`, `x509`, `rsa`, `ecdsa`), и движок регулярных выражений.
[`flang/src/emit/`](../flang/src/emit) держит рантайм каждой цели;
[`flang/test/`](../flang/test) — проверки на flang, которые обходит двоичный.

Два набора примеров — полноразмерные проекты:
[`docs/examples/web/shortener`](examples/web/shortener/README.md), сокращатель ссылок, где между
байтами запроса и байтами ответа нет ничего, кроме flang, и
[`docs/examples/library-api`](examples/library-api/README.md), предметная половина библиотечной
службы; ещё 223 программ в остальных наборах — отдельные файлы, среди них набор LeetCode: 82
решения с 806 примерами.
<!-- СНЯТО 2026-09-08 файлов docs/examples/leetcode/*.flang = 82 -->
<!-- СНЯТО 2026-09-08 примеров-в docs/examples/leetcode/*.flang = 806 -->

**Точка раскрутки.** В `bootstrap/` лежит компилятор, уже напечатанный в C99, — поэтому один
`make` даёт рабочий `flang`. Этот двоичный печатает исходники компилятора заново, и результат
сверяется с закоммиченным: `sh scripts/bootstrap-reprint.sh --check`. Входы последней печати записаны в
`scripts/seed-fingerprint`, по хешированной строке на файл — 48 строк во входной половине; вместе
со второй половиной, телом семени, в файле 65 строк.
<!-- СНЯТО 2026-09-13 строк scripts/seed-fingerprint = 65 -->
Семя отстаёт от исходников: `bootstrap/flang io scripts/seed/what-lags-the-seed.fscript --plan Report --timeout 300000` перечисляет, какие файлы и
функции новее семени, а перепечатка (`sh scripts/bootstrap-reprint.sh`, часы на одном ядре) — единственный
путь, которым правки `flang/self/` доезжают до двоичного. **Правка исходника не попадает в
двоичный до этой перепечатки** — потому проверки выше и различают исходник и двоичный.
[`docs/bootstrap-point.md`](bootstrap-point.md) · [круг раскрутки](guide/bootstrap-circle.ru.md).

Файлы корня россыпью: `README.md` (вход хранилища; эта страница — его русская редакция),
`LICENSE` · `LICENSE-RU.md`, `CONTRIBUTING.md`, `AGENTS.md` (символическая ссылка на
`.ai/AGENTS.md`), [`docs/DESCRIPTION.md`](DESCRIPTION.md) (развёрнутое описание языка) и
[`docs/ROADMAP.md`](ROADMAP.md) (замер, а не намерение) — оба доступны через символические ссылки
в корне, которые держат живыми адреса, на которые уже ссылаются из других хранилищ;
`CHANGELOG.md` · `changelog.json` (печатаются из тегов и тем коммитов, руками не правятся);
`.flangrc` (файл настроек и единственное место, откуда берут версию, лицензию и два адреса —
[страница настроек](guide/settings.ru.md)) и место, где записаны короткие команды дерева, по
строке `script.<имя>` на каждую.

## Как участвовать

Работа идёт в клоне; собирать нужно только компилятор.

```bash
make -C bootstrap -j8                    # около минуты; даёт bootstrap/flang
sh flang/test/обход.sh                   # проверки на flang, секунды
./bootstrap/flang test flang/stdlib/     # примеры библиотеки
git config core.hooksPath .githooks      # хук перед пушем: дешёвые проверки до CI
```

Обход прогоняет 211 проверок, написанных на flang, и сличает результат с
<!-- СНЯТО 2026-09-13 строк flang/test/ведомость.txt = 211 -->
`flang/test/ведомость.txt` — по строке на проверку. Хук гоняет проверки, укладывающиеся в
секунды, и называет, чего не гонял; долгие — дело CI (`.github/workflows/binary.yml`). Работа
ведётся в [`docs/tasks/`](tasks/README.md): один файл — одна открытая задача; закрытая из дерева
уходит, а её номер остаётся занятым в `docs/tasks/used-numbers.tsv`. Правила дерева, которых из кода не
видно, — в [`AGENTS.md`](../.ai/AGENTS.md); как собрать, прогнать проверки и прислать правку —
[`CONTRIBUTING.md`](../CONTRIBUTING.md). Решения записаны в [`docs/adr/`](adr); база знаний —
измеренные факты и отвергнутые пути — в [`docs/zettel/`](zettel/README.md).

Проза этого дерева держится при дереве прогонами, а не памятью: число, набранное рукой, несёт
примету о том, чем снято (`scripts/guards/prose-numbers-guard.fscript`), путь в ссылке обязан
существовать (`scripts/guards/link-guard.fscript`), а внутреннее слово на странице для читателя со
стороны получает отказ (`scripts/guards/jargon-guard.fscript`). Эта страница — одна из тех, что эти
проверки читают.

## Состояние

`0.x` — фаза проектирования языка: форма JSON и коды диагностик — поверхности совместимости,
синтаксис растёт через документированные предложения. Вне этого репозитория на языке написаны
четыре программы — [flang-tui](https://github.com/digitable-lol/flang-tui),
[digitdisk](https://github.com/digitable-lol/digitdisk),
[flang-ribbon](https://github.com/digitable-lol/flang-ribbon) и
[flang-env](https://github.com/digitable-lol/flang-env). Что стоит между деревом и 1.0 — пять
этапов [`docs/ROADMAP.md`](ROADMAP.md), каждый привязан к решению в `docs/adr/` и к задачам в
`docs/tasks/`.

## Лицензия

BSD 2-Clause — [LICENSE](../LICENSE). Русская редакция без юридической силы — [LICENSE-RU.md](../LICENSE-RU.md).
