# Опись дерева по языкам: 252 файла вне flang, долг вне JavaScript — 46 при потолке 63
<!-- СНЯТО 2026-11-26 файлов *.sh,*.c,*.h,*.py,*.html,*.css,*.awk,*.erl,*.js,*.mjs,*.java,*.cs,*.ex,*.go,*.rs,*.lua,*.vim,*.rb,*.cpp,*.cc,*.hpp,*.hh,ярлык,packaging/asdf/bin/download,packaging/asdf/bin/install,packaging/asdf/bin/list-all,.githooks/pre-push,.githooks/commit-msg,.githooks/pre-commit = 252 (python in the playground: five programs of flang/foreign/python/corpus) -->

Страница считает всё, что в дереве написано не на flang, по языкам и отделяет
долг — файлы, которые можно и нужно перевести на flang, — от остального.

Запуск 27 ноября 2026 на коммите `ef0fecdac`:

```
$ bootstrap/flang run-script inventory:languages
опись дерева по языкам: файлов вне flang 252, строк 1590897
…
ДОЛГ ВНЕ JavaScript: файлов 46, строк 4434, потолок файлов 63
```

Код возврата 0: долг ниже потолка. Запуск занял 145 с и 482 МБ на машине,
занятой другими запусками. После строки о долге команда печатает каждый файл
долга с языком и числом строк. Ту же проверку ведёт на каждый пуш работа `build`
в `.github/workflows/binary.yml` (шаги «Check tree inventory» и «Check inventory
table»).

## Зачем эта опись понадобилась

До неё долг считали только по JavaScript: в `docs/ROADMAP.md`, в
[`docs/javascript-inventory.md`](javascript-inventory.md) и в числах сайта.
Оболочку, HTML, CSS, пробы на C, Python, awk и Erlang не считал никто, и рост
числа таких файлов ничто не останавливало.

## Что нашла опись

| язык | файлов | строк | долг файлов | долг строк |
|---|---:|---:|---:|---:|
| оболочка | 49 | 8 703 | 39 | 3 863 <!-- СНЯТО 2026-11-17 долг файлов/строк оболочки = 39/3863 (the published guard tells a release in preparation from a drift and lost two lines of history) --><!-- СНЯТО 2026-11-17 файлов *.sh,ярлык,packaging/asdf/bin/download,packaging/asdf/bin/install,packaging/asdf/bin/list-all,.githooks/pre-push,.githooks/commit-msg,.githooks/pre-commit = 49 (packaging/prebuilt/publish-tap.sh puts the formula of a published release into the tap) --><!-- СНЯТО 2026-11-17 строк-в *.sh,ярлык,packaging/asdf/bin/download,packaging/asdf/bin/install,packaging/asdf/bin/list-all,.githooks/pre-push,.githooks/commit-msg,.githooks/pre-commit = 8703 (publish-tap.sh is new, install.sh checks provenance on request, the published guard lost two lines) --> |
| C | 67 | 1 521 715 | 1 | 105 <!-- СНЯТО 2026-11-24 файлов *.c,*.h = 67 (print batch 15: the libc-free generator brings fifteen C files of its probe) --><!-- СНЯТО 2026-11-27 строк-в *.c,*.h = 1521715 (print batch 16, lexer speed fix) --><!-- СНЯТО 2026-10-04 долг файлов/строк C = 1/107 (задача 1413: водитель пробы flang/proof/probes/exact-integer-in-targets/drivers/driver.c — судья, который считает десятичную запись точного целого на самой цели, оснастка на чужом языке, а не рантайм цели; долга в C до него не было, снято 2026-10-04) --> |
| C++ | 2 | 527 | 1 | 105 <!-- СНЯТО 2026-10-04 файлов *.cpp,*.cc,*.hpp,*.hh = 2 (задача 1413: водитель пробы flang/proof/probes/exact-integer-in-targets/drivers/driver.cpp — судья, который считает десятичную запись точного целого на самой цели) --><!-- СНЯТО 2026-10-11 строк-в *.cpp,*.cc,*.hpp,*.hh = 527 (задача 1413: водитель пробы flang/proof/probes/exact-integer-in-targets/drivers/driver.cpp, 107 строк) --><!-- СНЯТО 2026-10-04 долг файлов/строк C++ = 1/107 (задача 1413: водитель пробы flang/proof/probes/exact-integer-in-targets/drivers/driver.cpp — судья, который считает десятичную запись точного целого на самой цели, оснастка на чужом языке, а не рантайм цели; долга в C++ до него не было, снято 2026-10-04) --> |
| Python | 41 | 4 220 | 0 | 0 <!-- СНЯТО 2026-11-26 файлов *.py = 41 (python in the playground: the three examples of the tab and two programs refused before — while and a parameter without a type) --><!-- СНЯТО 2026-11-26 строк-в *.py = 4220 (exact signed integer, ADR-0258) --> |
| HTML | 6 | 412 | 0 | 0 <!-- СНЯТО 2026-10-08 файлов *.html = 6 --><!-- СНЯТО 2026-10-08 строк-в *.html = 412 --> |
| CSS | 2 | 976 | 0 | 0 <!-- СНЯТО 2026-10-24 файлов *.css = 2 (site playground: KaTeX vendored under docs/site/vendor/katex (katex.min.js, katex.min.css), the text kind rule text-kind.flang, the shell .text command in flang_repl.c and its seed copy) --><!-- СНЯТО 2026-11-23 строк-в *.css = 976 (the playground reads a pasted text) --> |
| awk | 1 | 76 | 1 | 76 <!-- СНЯТО 2026-08-31 файлов *.awk = 1 --><!-- СНЯТО 2026-10-11 строк-в *.awk = 76 --> |
| Erlang | 1 | 69 | 0 | 0 <!-- СНЯТО 2026-08-31 файлов *.erl = 1 --><!-- СНЯТО 2026-08-31 строк-в *.erl = 69 --> |
| JavaScript | 43 | 27 293 | считает [`javascript-inventory.md`](javascript-inventory.md) <!-- СНЯТО 2026-11-17 файлов *.js,*.mjs = 43 (library module pages: docs/site/library-pages.mjs and library-catalog.mjs printed by the site build) --><!-- СНЯТО 2026-11-26 строк-в *.js,*.mjs = 27293 (python in the playground; bool in the C reader, the DSL tile, the plain words of the text tab) --> ||
| Java | 8 | 4 972 | 1 | 66 <!-- СНЯТО 2026-10-04 файлов *.java = 8 (задача 1413: водитель пробы flang/proof/probes/exact-integer-in-targets/drivers/Driver.java — судья, который считает десятичную запись точного целого на самой цели) --><!-- СНЯТО 2026-11-26 строк-в *.java = 4972 (exact signed integer, ADR-0258) --><!-- СНЯТО 2026-10-04 долг файлов/строк Java = 1/69 (задача 1413: водитель пробы flang/proof/probes/exact-integer-in-targets/drivers/Driver.java — судья, который считает десятичную запись точного целого на самой цели, оснастка на чужом языке, а не рантайм цели; долга в Java до него не было, снято 2026-10-04) --> |
| C# | 8 | 5 565 | 1 | 74 <!-- СНЯТО 2026-10-04 файлов *.cs = 8 (задача 1413: водитель пробы flang/proof/probes/exact-integer-in-targets/drivers/Driver.cs — судья, который считает десятичную запись точного целого на самой цели) --><!-- СНЯТО 2026-11-26 строк-в *.cs = 5565 (exact signed integer, ADR-0258) --><!-- СНЯТО 2026-10-04 долг файлов/строк C# = 1/77 (задача 1413: водитель пробы flang/proof/probes/exact-integer-in-targets/drivers/Driver.cs — судья, который считает десятичную запись точного целого на самой цели, оснастка на чужом языке, а не рантайм цели; долга в C# до него не было, снято 2026-10-04) --> |
| Elixir | 4 | 5 345 | 0 | 0 <!-- СНЯТО 2026-10-04 файлов *.ex = 4 (мера сужена с *.ex,*.exs до *.ex: водитель пробы flang/proof/probes/exact-integer-in-targets/drivers/driver.exs опись языком Elixir не считает — правило «Язык пути» знает только *.ex; само число то же) --><!-- СНЯТО 2026-11-26 строк-в *.ex = 5345 (exact signed integer, ADR-0258) --> |
| Go | 4 | 4 414 | 1 | 68 <!-- СНЯТО 2026-10-04 файлов *.go = 4 (задача 1413: водитель пробы flang/proof/probes/exact-integer-in-targets/drivers/driver.go — судья, который считает десятичную запись точного целого на самой цели) --><!-- СНЯТО 2026-11-26 строк-в *.go = 4414 (exact signed integer, ADR-0258) --><!-- СНЯТО 2026-10-04 долг файлов/строк Go = 1/71 (задача 1413: водитель пробы flang/proof/probes/exact-integer-in-targets/drivers/driver.go — судья, который считает десятичную запись точного целого на самой цели, оснастка на чужом языке, а не рантайм цели; долга в Go до него не было, снято 2026-10-04) --> |
| Rust | 4 | 5 808 | 1 | 77 <!-- СНЯТО 2026-10-04 файлов *.rs = 4 (задача 1413: водитель пробы flang/proof/probes/exact-integer-in-targets/drivers/driver.rs — судья, который считает десятичную запись точного целого на самой цели) --><!-- СНЯТО 2026-11-26 строк-в *.rs = 5808 (exact signed integer, ADR-0258) --><!-- СНЯТО 2026-10-04 долг файлов/строк Rust = 1/80 (задача 1413: водитель пробы flang/proof/probes/exact-integer-in-targets/drivers/driver.rs — судья, который считает десятичную запись точного целого на самой цели, оснастка на чужом языке, а не рантайм цели; долга в Rust до него не было, снято 2026-10-04) --> |
| Lua | 3 | 226 | 0 | 0 <!-- СНЯТО 2026-08-31 файлов *.lua = 3 --><!-- СНЯТО 2026-10-28 строк-в *.lua = 226 (print batch 9c: flang install, small compiler fixes, installs and io, restricted postconditions, listen address, u64 literals) --> |
| Vimscript | 8 | 419 | 0 | 0 <!-- СНЯТО 2026-08-31 файлов *.vim = 8 --><!-- СНЯТО 2026-10-28 строк-в *.vim = 419 (print batch 9c: flang install, small compiler fixes, installs and io, restricted postconditions, listen address, u64 literals) --> |
| Ruby | 1 | 157 | 0 | 0 <!-- СНЯТО 2026-08-31 файлов *.rb = 1 --><!-- СНЯТО 2026-10-28 строк-в *.rb = 157 (print batch 9c: flang install, small compiler fixes, installs and io, restricted postconditions, listen address, u64 literals) --> |


### Почему у столбцов долга приметы нет

Числа «файлов» и «строк» проверяет `scripts/guards/prose-numbers-guard.fscript`:
рядом с каждым стоит примета, и проверка пересчитывает её на каждом пуше. У
столбцов «долг файлов» и «долг строк» приметы нет ни в одной строке.

Причина: приметы считают по образцу пути, а долг образцом не задаётся. Его
определяет функция «Довод не-долга» в `scripts/guards/tree-inventory.fscript`, где
у каждого исключения свой довод. Проверка по образцу дала бы другое число.
Столбцы долга поэтому сверяет сама опись: план «Опись сходится с документом»
(`bootstrap/flang run-script inventory:check`).

### Оговорка о приметах, которые здесь всё-таки стоят

Опись считает языком не только расширение, но и имена файлов без расширения.
Первую строку файла (шебанг) она не читает: имена перечислены в правиле.
Сегодня это три файла в `packaging/asdf/bin/` и каталог `.githooks/` целиком,
кроме `.fscript` и `.flang`. Поэтому у строки «оболочка» образец приметы
перечисляет их явно.

Файл оболочки без расширения вне этих двух мест опись не увидит: для этого
пришлось бы читать первую строку файла.

Долг вне JavaScript — 46 файлов, 4434 строки. JavaScript опись считает (43
файла, 27 293 строки), но по родам не раскладывает: это делает
[`javascript-inventory.md`](javascript-inventory.md).

Больше миллиона строк C — не долг: 1 152 809 из
них — `bootstrap/compiler_flang.c`, то есть сам компилятор, напечатанный из
flang в C.
<!-- СНЯТО 2026-11-27 строк bootstrap/compiler_flang.c = 1152809 (print batch 16, lexer speed fix) -->

## Не долг: двенадцать доводов, у каждого свой счёт

У каждой строки не-долга есть довод, а не мнение. Опись хранит их не в прозе, а
в самой программе — функция «Довод не-долга» в `scripts/guards/tree-inventory.fscript`
называет причину для каждого пути, и проверка падает, если в дереве появился
файл, которому довода нет.

| довод | что под ним | файлов | строк |
|---|---|---:|---:|
| напечатано самим компилятором | `bootstrap/**` — восемь файлов на C, вывод печати | 8 | 1 448 523 <!-- СНЯТО 2026-10-14 файлов bootstrap/*.c,bootstrap/*.h = 8 (print batch six: bootstrap/tls_client.c and bootstrap/tls_client.h printed by the reprint) --><!-- СНЯТО 2026-11-27 строк-в bootstrap/*.c,bootstrap/*.h = 1448523 (print batch 16, lexer speed fix) --> |
| рантайм цели печати | `flang/src/emit/{c,cpp,python,java,csharp,elixir,go,rust}/**` — уезжает в напечатанную программу дословно | 29 | 69 283 <!-- СНЯТО 2026-09-06 файлов flang/src/emit/c/*,flang/src/emit/cpp/*,flang/src/emit/python/*,flang/src/emit/java/*,flang/src/emit/csharp/*,flang/src/emit/elixir/*,flang/src/emit/go/*,flang/src/emit/rust/* = 29 --><!-- СНЯТО 2026-11-27 строк-в flang/src/emit/c/*,flang/src/emit/cpp/*,flang/src/emit/python/*,flang/src/emit/java/*,flang/src/emit/csharp/*,flang/src/emit/elixir/*,flang/src/emit/go/*,flang/src/emit/rust/* = 69283 (print batch 16) --> |
| замеряемый материал | `benchmarks/**` без оболочки и без оснастки на Python (`tasks.py` — набор задач замера, он материал) плюс `flang/concurrency/bench/beam.erl` — это то, с чем сравнивают | 12 | 3 217 |
| проба рантайма C | `flang/test/oblast/*.c` и `flang/concurrency/bench/sizes.c` — двенадцать проб памяти, их заголовок и размеры записей; на flang они проверяли бы не рантайм, а себя. Гоняет их `scripts/targets/region-in-c-target.flang`, уже написанный на flang | 14 | 674 |
| чужая среда: редактор | `docs/editors/vim/**` — vim и neovim грузят только vimscript и Lua | 11 | 645 <!-- СНЯТО 2026-08-31 файлов docs/editors/vim/*.vim,docs/editors/vim/*.lua = 11 --><!-- СНЯТО 2026-10-21 строк-в docs/editors/vim/*.vim,docs/editors/vim/*.lua = 645 (this branch: the installs ship the spec template, chunked http bodies, nested run arguments, the Vim plugin takes flang lsp) --> |
| код на стороне цели | `flang/concurrency/bin/node.{c,cs,ex,go,java,py,rs}` — семь хозяев узлов на семи языках | 8 | 8 227 |
| разметка и оформление | четыре `.html` и `docs/site/style.css` — цели HTML у языка нет и не заявлено | 5 | 1 785 |
| чужая среда: установщик | `packaging/homebrew/flang.rb`, три файла `packaging/asdf/bin/`, `install.sh` и четыре файла `packaging/prebuilt/` — homebrew понимает Ruby, asdf зовёт свои три раньше, чем flang в системе есть, `install.sh` его и ставит, сборка готовых выпусков идёт в контейнере Alpine, где flang нет, а формулу в кран кладёт раннер выпуска до сборки компилятора | 9 | 1 088 |
| точка раскрутки и приёмка | `scripts/bootstrap-reprint.sh`, `scripts/bootstrap-c.fscript`, `scripts/seed/new-binary-acceptance.fscript`, `scripts/seed/build-ledger-binary.fscript` — разобраны отдельно ниже | 4 | 4 080 |
| сверка двоичного и его печати | `scripts/seed/binary-origin.fscript` и `scripts/guards/overlong-string-guard.sh` — заведены 29 августа, разобраны 30-го, см. ниже | 2 | 876 |
| чужой хозяин примера | `docs/examples/host-boundary/host.c` — этим примером и показывают границу с чужим кодом | 1 | 225 <!-- СНЯТО 2026-10-11 строк docs/examples/host-boundary/host.c = 225 --> |
| независимый чекер записи | `flang/proof/checker/**` — сверщик записи доказательства на C, прогон его проб и одна проба-подделка на оболочке; заведён 31 августа, разобран ниже | 3 | 4 417 |

Восьмой хозяин узла (`node.js`) и восьмой рантайм (`flang/src/emit/js/**`)
стоят в счёте JavaScript и разобраны в его собственной описи — по тем же
доводам.

### Почему точка раскрутки и приёмка остаются на оболочке

`scripts/bootstrap-reprint.sh` печатает компилятор заново и сравнивает напечатанное
с закоммиченным байт в байт. Если записать это сравнение планом на flang, его
будет исполнять тот самый компилятор, который проверяют: сломанный компилятор
может и напечатать не то, и ответить, что напечатал то. Оболочка при этом ничего
не добавляет к сборке: `sh`, `make`, `cc` и `cmp` там нужны и так.

## Долг: 46 файлов, 4434 строки

По каталогам, из того же запуска 27 ноября 2026:

| место | файлов | строк |
|---|---:|---:|
| `.githooks` | 3 | 6 |
| `docs/benchmarks` | 4 | 214 |
| `docs/editors` | 3 | 137 |
| `docs/examples` | 4 | 426 |
| `flang/concurrency` | 15 | 450 |
| `flang/proof` | 6 | 495 |
| `flang/test` | 4 | 785 |
| `scripts/guards` | 4 | 1 521 |
| `scripts/targets` | 3 | 400 |
| всего | 46 | 4 434 |

### Файлы долга в `scripts`

| файл | строк | что делает |
|---|---:|---|
| `target-collisions.sh` | 245 | столкновения имён на восьми целях печати <!-- СНЯТО 2026-10-11 строк scripts/targets/target-collisions.sh = 245 --> |
| `bad-octet-guard.sh` | 337 | сторож негодных октетов <!-- СНЯТО 2026-10-11 строк scripts/guards/bad-octet-guard.sh = 337 --> |
| `one-string-measure-guard.sh` | 116 | подаёт сырые октеты в `string-measure.flang` <!-- СНЯТО 2026-10-11 строк scripts/guards/one-string-measure-guard.sh = 116 --> |
| `identical-declarations.sh` | 79 | что можно ввезти вместо переименования <!-- СНЯТО 2026-10-11 строк scripts/targets/identical-declarations.sh = 79 --> |
| `names-in-c.awk` | 76 | «идентификатор C → русское объявление» из напечатанного заголовка <!-- СНЯТО 2026-10-11 строк scripts/targets/names-in-c.awk = 76 --> |
| `published-vs-tree.sh` | 793 | сверяет числа и карту, которые проект публикует о себе, с деревом |
| `module-origin-guard.sh` | 275 | называет, из какого файла берётся каждый модуль, до сборки |

`names-in-c.awk` — единственный файл на awk в дереве. Его зовёт
`target-collisions.sh`, поэтому переводить их придётся вместе.

## Ещё 174 строки JavaScript, которых не видит ни один счётчик

Обе описи — эта и `javascript-inventory.md` — считают файлы по имени: `.mjs` и
`.js`. Внутрь HTML не смотрит ни одна, а там лежит написанный руками JavaScript:

| файл | всего строк | из них JavaScript внутри `<script>` |
|---|---:|---:|
| `docs/examples/web/wasm/demo/index.html` | 188 | 174 (строки 14–187) |
| `docs/examples/web/shortener-client/index.html` | 100 | 0 |
| `docs/examples/web/browser-app/index.html` | 88 | 0 |

У двух страниц из трёх тег `<script>` несёт только `src` на напечатанный модуль,
и строк внутри тега нет. Третья несёт 174 строки, и в счёт JavaScript они не
попадают: счёт строк в описи JavaScript — нижняя оценка. Здесь эти строки
посчитаны в HTML.

## Как держать опись честной

Проверка не сверяет число строк: оно меняется каждой правкой. Сверяется число
файлов долга, и только сверху: потолок 63, долгу разрешено убывать и запрещено
расти.

Кто перевёл файл на flang, опускает потолок: число записано в функции «Потолок
долга» в `scripts/guards/tree-inventory.fscript`.

Новый довод не-долга допустим по одному основанию: файл проверяет или собирает
то, чем его самого пришлось бы исполнять. Довод пишется в трёх местах — в шапке
самого файла, в функции «Довод не-долга» и на этой странице.

Проверка считает и файлы, ещё не добавленные в git
(`ls-files --cached --others --exclude-standard`). Что она умеет отказать,
показывает шаг «Probe inventory table» той же работы `build`.
