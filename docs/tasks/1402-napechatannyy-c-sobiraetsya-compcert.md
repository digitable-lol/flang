---
номер: 1402
заголовок: Проверить, собирается ли напечатанный C под CompCert — это закрывает половину разрыва чужой работой
статус: в работе
исполнитель: a
ветка: a/1402-printed-c-under-compcert
команда: любая
карта: Чего в языке нет вовсе
рядом: 1401, 3467, 3984, 9969, 0311, 7098
нужность: 1 — ADR-0030 §9; замера нет: grep -i compcert вне docs/tasks — 0, ccomp на машине не установлен; число «собирается/нет» не снято
---

# 1402. Напечатанный C под CompCert

Решение: [ADR-0030](../adr/0030-the-printer-proves-each-run-not-itself.md), §9.

## Зачем

Сегодня после печати в C стоят ДВА места доверия: наш печатник (flang → C) и
чужой компилятор C (C → машинный код). CompCert доказывает второй переход
теоремой. Если напечатанное собирать им, второе место закрывается **чужой
работой, без единой строки с нашей стороны**.

Останется одно место доверия вместо двух, и его закроет сличитель (задача 1401).

## Что сделать

1. **Померь сперва:** собирается ли `flang emit --target c` под CompCert вообще.
   Он берёт подмножество C99 и строг к расширениям — это главный риск.
2. Если не собирается — назови **поимённо**, что мешает: какие расширения,
   сколько мест, во что обойдётся их снятие в печатнике.
3. Если собирается — покажи прогоном: напечатанная программа, собранная
   CompCert, даёт тот же ответ, что собранная обычным компилятором.
4. Оцени цену поддержки CompCert как выбираемого компилятора в сборке.

## Чего не делать

- **Не считать это доказательством нашего печатника.** CompCert отвечает за
  свой переход, а не за наш. Разрыв flang → C остаётся открытым до 1401.
- Не заменять обычный компилятор насовсем — только добавить как выбор.

## Как поймём, что сделано

Есть число: собирается или нет, и если нет — сколько мест мешают.

## Ход работы (14 сентября 2026, исполнитель a)

Ствол `bdce1f75`, двоичный `bootstrap/flang` 0.7.19 из семени этого же коммита
(`make -C bootstrap -j16 CFLAGS='-std=c99 -Wall -Wextra -Werror -pedantic -O2'`, 4 мин 48 с).
Обычный компилятор — `cc` = gcc 15.2.0 (Ubuntu), x86_64. Все пробы, копии и журналы —
вне дерева, в `/home/b/projects/flang-1402-area/` (скрипты `measure.py`, `fuzz.py`,
`compare-compilers.sh`, `summarize.py`; результаты `results.jsonl`, `logs/`). Второй заход того
же дня — остаток дерева и перепроверка другим кодом: `measure_tree.py`, `fuzz_tree.py`,
`latin.py`, `make_table.py`, `recheck/*.sh`, `recheck/recheck_programs.py`; результаты
`results-tree-*.jsonl`, `recheck/`, `table-all.md`.

### Итог

**Напечатанный C собирается CompCert.** Всё дерево — 302 программы пяти пород: в C
печатаются 255, и **253 из 255 собирают и cc, и ccomp** (с пятью ключами и латиницей в
четырёх именах рантайма). Две, которых не собирает никто, — одна порода ошибки
печатника: модуль «100 doors» даёт идентификатор C с цифры (задача 3984). Сам компилятор
(`bootstrap/*.c`, 35 МБ C) CompCert собирает тоже, и собранный двоичный работает.

**Ответы совпадают байт в байт:** 11 475 примеров и 56 987 граничных вызовов на 248
программах; у компилятора — ведомости 157 файлов, AST всех 302, печать в четыре цели,
`check --proof`. **Расхождений 0**: ни разрыва печатника, ни неопределённого
поведения, которое у двух компиляторов проявилось бы по-разному. Отрицательный
контроль (cc с `-ffast-math`) расходится у 82 из 90 программ, так что сравнение
разницу ловит.

**Как напечатано, не собирается ничего:** голый `ccomp -std=c99 -Wall` не собирает
целиком ни одной программы (0 из 255). Мешают не печатник, а четыре кириллических имени
в рантайме и отсутствие пяти ключей (задача 3467). Не напечатались 47 программ, и ни одна
не по вине CompCert: 35 с `план`, 10 не проходят проверку, 2 упираются в столкновение
имён (класс 0311). Квантора по элементам (7098) в дереве нет ни в одной программе.

### CompCert поставлен в `$HOME`

- `opam` 2.5.2 — двоичный релиз с GitHub (`shell/install.sh --download-only`) в `~/.local/bin`;
  `opam init --disable-sandboxing --bare -y -a`; переключатель `1402` с OCaml 4.14.2.
- `opam install coq compcert` в репозитории по умолчанию **отказал**: `No package named
  compcert found`. Сработало `opam repo add coq-released https://coq.inria.fr/opam/released`
  и `opam install coq-compcert` → `coq 9.2.0` (Rocq 9.2.0), `coq-compcert 3.18`,
  лицензия «INRIA Non-Commercial License Agreement» (некоммерческая оценка — наш случай).
- Вся установка от `opam init` до `ccomp --version`: **8 мин 48 с** (23:28:29 → 23:37:17 UTC,
  256 ядер); Coq и CompCert собирались из исходников.
- `ccomp --version` печатает `The CompCert C verified compiler, version 3.17` при пакете
  3.18: архив `AbsInt/CompCert/archive/v3.18.tar.gz` несёт файл `VERSION` с `version=3.17`.
  Двоичный: `~/.opam/1402/bin/ccomp`.

### Что ccomp принимает из наших флагов

Из строки Makefile `-std=c99 -Wall -Wextra -Werror -pedantic -O2 -flto`: `-std=c99 -Wall
-Werror -O2` принимает; `-Wextra` — «Unknown warning option -Wextra, ignored»; `-pedantic` и
`-flto` — `Unknown option`, ошибка. `-lm -lpthread` принимает. Ключи CI (`FLANG_CFLAGS` в
`.github/workflows/binary.yml`) — те же плюс `-flto=auto`, и он тоже `Unknown option`.

### Набор программ: всё дерево, 302 + сам компилятор

Первый заход взял 96 программ, второй — остаток тех же каталогов, 206: в наборе все
`flang/proof/examples`, `docs/examples/**` и `flang/stdlib`.

| порода | в наборе | напечатано в C | cc | ccomp |
|---|---:|---:|---:|---:|
| `flang/proof/examples` | 47 | 45 | 45 | 45 |
| `docs/examples/rosetta` | 28 | 28 | 26 | 26 |
| `docs/examples/leetcode` | 82 | 82 | 82 | 82 |
| `docs/examples` прочее (tutorial, operations, web, crypto, db, io, frameworks, …) | 94 | 50 | 50 | 50 |
| `flang/stdlib` | 51 | 50 | 50 | 50 |
| **итого** | **302** | **255** | **253** | **253** |
| `bootstrap/*.c` — напечатанный компилятор, 35 030 594 байт `compiler_flang.c` | 1 | уже напечатан | да | да |

Не напечатались 47, и ни одна — по причине, связанной с CompCert:

- **35 — объявление `план`**: `FLANG_PLAN_UNSUPPORTED: цель «c» не умеет печатать
  объявление «план»`. 8 подтверждены полной печатью, 27 — печатью с `--no-check`: отказ
  по объявлению от доказательств не зависит, а полная печать таких программ идёт до
  трёх минут.
- **2 — два имени дают один идентификатор C** (класс задачи 0311):
  `flang/stdlib/uuid.flang` («Вариант УУИД» и «вариант УУИД» → `variant_uuid`),
  `docs/examples/surfaces/factorial.zh.flang` («乘积» и «前置» → `value`).
- **10 — программа не проходит проверку**, до печати дело не доходит:
  `forgery-modus-ponens-by-guard` (`FLANG_PROOF_STEP`), `forgery-if-without-descent-theorem`
  (`FLANG_PROOF_INDUCTION_DESCENT`), `proof-probes/typed-ast-generic-descent-is-refused`
  (`FLANG_NOT_TOTAL`), `web/shortener/handler-without-budget` (`FLANG_HANDLER_NOT_TOTAL`),
  `применение/место-слева-вызов` и `место-слева-с-отрезком` (`FLANG_PRECONDITION_CALL`),
  `library-api/lib/api` и `lib/catalog` (`FLANG_UNKNOWN_NAME`: «Шаг все не меньше»),
  `web/shortener/server-network` (`FLANG_MATCH_NOT_EXHAUSTIVE`), `monad/order-total`
  (`FLANG_TYPE_PARAM`). Часть отказывает намеренно (`forgery`, `is-refused` в имени);
  остальные к CompCert не относятся, и разбирать их — не эта задача.

**Квантор по элементам (задача 7098) не стоит ни в одной программе дерева:** узел
`forallIn` не встретился ни в одном из 302 AST. Поиск по исходнику `для всех … из`
врёт: он ловит и `для всех исход обеспечивает …` (`web/marketplace/gateway`,
`web/shortener/service`, `react-ts-pure/core/storefront`), а эти три печатаются и
собираются. Считать квантор надо по AST.

### Собирается ли: числа

Всё дерево, 255 напечатанных программ. Ключи\* — `-std=c99 -Wall -Werror -O2
-fstruct-passing -flongdouble -Wno-c11-extensions -Wno-unknown-pragmas -Wno-literal-range`.

| файл | ccomp `-std=c99 -Wall`, как напечатано | ccomp с ключами\*, как напечатано | ccomp с ключами\*, латиница в рантайме (копия вне дерева) |
|---|---|---:|---:|
| модуль программы (`<имя>.c`) | 5 из 255 | 253 из 255 | 253 из 255 |
| `flang_cli.c` | 0 — `flang_runtime.h:713: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | 253 из 255 | 253 из 255 |
| `flang_conc.c` (2 программы с `процесс`) | 0 — та же ошибка | 2 из 2 | 2 из 2 |
| `flang_runtime.c` | 0 — `flang_runtime.c:4596: error: invalid symbol '\\'` | **0 из 255** | 255 из 255 |
| **программа целиком слинкована** | **0 из 255** | **0 из 255** | **253 из 255** |
| `compiler_flang.c` (сам компилятор) | нет | **да: 280–286 с, пик 3,0 ГиБ** | да |
| `flang_repl.c` (человеческий вход компилятора) | нет | нет — `поток` | да |
| двоичный `flang` целиком | нет | нет | **да** |

cc (`-std=c99 -Wall -Wextra -Werror -pedantic -O2`, все файлы одной командой): программа
целиком — 253 из 255, сам компилятор — да. Модуль без ключей собрался у пяти программ
`flang/proof/examples` (`corpus-alphabet`, `corpus-cident`, `corpus-fullwidth`,
`corpus-marks`, `corpus-nat-names`): в них нет функций, отдающих `fl_value`. Ошибки
голого ccomp у `flang_cli.c`, `flang_conc.c` и `flang_runtime.c` одни и те же во всех
программах, файлы общие; сняты на `rosetta/quicksort` и `web/shortener/server`.

Не собирает никто две программы одной породы: `rosetta/hundred-doors.flang` и
`rosetta/hundred-doors-english.flang`. Модуль «100 doors» даёт приставку `100_doors`,
а идентификатор C с цифры начинаться не может (`100_doors.h:7:9: error: macro names
must be identifiers`; ccomp: `flang_cli.c:107: error: invalid numerical constant
'100_doors_call'`). Это **настоящая ошибка печатника**, с CompCert не связанная, —
задача 3984 (место: `flang/self/emit-c.flang:1846` «Префикс программы», `:469`
«Змейка», `:5261` «Обойти занятое целью C»). В go и js та же программа печатается,
собирается и отвечает на 18 примеров из 18, одинаково.

### Что мешает поимённо — четыре класса

| класс | где | сколько мест | чем снимается | во что обойдётся |
|---|---|---:|---|---|
| **расширение GNU: кириллица в идентификаторах C** (C99 §6.4.2.1 даёт только `\uXXXX`; CompCert не читает и их — препроцессор GCC отдаёт `\U0000043a…`, лексер падает `invalid symbol '\'`) | `flang/src/emit/c/flang_runtime.c:646–648` (`измерено`, 3), `:4590–4593` (`конец` 3, `ведущий` 2); `flang_repl.c:11907–11950` (`поток`, 12) | 4 имени, 20 употреблений, 3 места | переименовать латиницей | правка рантайма, печатник не трогается; перепечатка/пересев семени. Задача 3467 |
| **ограничение CompCert: структуры по значению** (`fl_value` возвращается и передаётся по значению во всех функциях) | каждая напечатанная функция, `flang_runtime.h:652` первая | всюду | ключ `-fstruct-passing` | 0 — ключ. Но проход `cparser/StructPassing.ml` (600 строк OCaml) стоит **до** проверенного ядра CompCert и теоремой не покрыт — см. «Чего это не даёт» |
| **ограничение CompCert: `long double`** | `flang_runtime.c:92` `union fl_align` (выравнивание) и макросы `isnan/isinf/isfinite/signbit` из glibc `<math.h>` (8 мест) | 9 | ключ `-flongdouble` (long double = double) | 0 — на поведение не влияет: ветка `__isnanl` для `double` не берётся, объединение только для выравнивания |
| **заголовки glibc под не-GCC компилятором** | анонимное объединение в `<sys/resource.h>` (`-Wc11-extensions`); `#pragma` в `stdint.h` GCC 15 (`-Wunknown-pragmas`, только `flang_conc.c`); `HUGE_VAL` = `1e10000` (`-Wliteral-range`, только `flang_conc.c:137`) | 3 | три `-Wno-…` | 0 — ключи; наш код не при чём |
| **реальная ошибка печатника** | имя модуля с ведущей цифрой | 2 программы из 255, одна порода | задача 3984 | правка `flang/self/emit-c.flang` + перепечатка |

Ключи `-Wextra`, `-pedantic`, `-flto` из напечатанного Makefile ccomp не принимает — это
не «мешает», а «не нужно»: `-Wextra` ccomp пропускает с предупреждением, остальные два
заменяются пустотой.

### Одинаково ли считает: cc против ccomp

Прогон **на одних входах, побайтовое сравнение ответов** прогонщика (`{"fn":…,"args":…}` →
`{"ok":…,"value":…}`). У ccomp-сборки латиница стоит только в строках кода (`latin.py`).

| что | программ | вызовов | вывод совпал байт в байт |
|---|---:|---:|---|
| примеры из самих `.flang` (через `flang ast`, аргументы в проводном виде) | 248 (у 5 напечатанных примеров нет, 2 не собираются) | **11 475** | **248 из 248**; с `ожидается` у обеих сборок сошлись все 11 475 |
| те же вызовы с граничными значениями: `−0`, `0.1`, `1e300`, `NaN`, `Infinity`, `1e-320`, `2^53+1`, пустая и 300-знаковая строка, знак вне BMP, кавычки, пустой и удвоенный список, подмена типа, лишний и недостающий довод (`fuzz.py`, `fuzz_tree.py`, ≤600 на программу) | 248 | **56 987** | **56 987 из 56 987** |
| отрицательный контроль: cc `-O2 -ffast-math` против cc `-O2`, те же входы (первый набор) | 90 | 27 512 | **расходится у 82 из 90**, 5887 строк |
| сам компилятор: `flang test --ledger` по `rosetta` (28), `proof/examples` (47), `leetcode` (82) | 157 файлов | — | ведомости совпали — у сборки первого захода и у пересборки с точной латиницей |
| сам компилятор: `flang ast` | 302 файла, всё дерево | — | 302 из 302, из них 25 — после поправки места (ниже) |
| сам компилятор: `flang emit --target c/go/js/python --runtime …` — каталоги побайтово, код возврата, stderr без строк хода | 6 программ × 4 цели | 102 файла | 24 из 24, дважды |
| сам компилятор: `flang check --proof` (stdout и stderr без строк хода, код возврата) | 4 | — | 4 из 4, дважды |

**Расхождений вывода — 0.** Дважды сверка «расходилась», и оба раза виновато было
место двоичного, а не компилятор: сборка ccomp лежит вне дерева. Печать без
`--runtime` не находила рядом с ней `flang/src/emit/<цель>` («0 из 24» первого захода).
`flang ast` 20 файлов с ввозом из библиотеки отвечал `FLANG_IMPORT_NOT_FOUND … ни в
библиотеке компилятора`: библиотеку двоичный ищет в `<родитель своего каталога>/flang/stdlib`
и `flang/core`. С `FLANG_MODULE_DIR=<дерево>/flang/stdlib:<дерево>/flang/core` совпали
все. Ещё у 5 файлов разница была только в строке хода, которую таймер печатает в stderr
у медленной сборки.

Скорость собранного (не цель замера, но снята): `flang test flang/stdlib/strings.flang`, по
три прогона. Первый заход: cc `-O2` без LTO 7,57 / 7,46 / 7,52 с, ccomp 13,68 / 13,74 /
13,99 с. Пересборка: cc 7,40 / 7,62 / 7,61 с, ccomp 14,22 / 13,58 / 13,92 с. ccomp
медленнее в 1,83–1,84 раза. Компиляция `compiler_flang.c`: ccomp 286 с (повтор — 280,5 с,
пик 3,0 ГиБ) против cc `-O2` 290 с (`out/bootstrap-compiler/cc-time.log`; одним потоком
в `make -j16` она же — длинный полюс 4 мин 48 с).

### Цена поддержки CompCert как выбираемого компилятора

- Печатник править **не надо**. Напечатанный `Makefile` уже принимает
  `make CC=ccomp CFLAGS='<ключи выше>'` — проверено на `rosetta/quicksort` (копия с четырьмя
  латинскими именами в рантайме): собралось, работает.
- Правка рантайма: 4 идентификатора в двух файлах `flang/src/emit/c/`; они уезжают в семя
  дословно, значит перепечатка или пересев семени (задача 4088 — как).
- CI: работа с `opam`+`coq-compcert` — 9 минут установки (кешируется) и 5 минут сборки семени.
- Всё вместе — задача **3467**.

### Чего это не даёт (границы вывода)

1. CompCert не доказывает наш печатник — разрыв flang → C остаётся (1401).
2. С ключом `-fstruct-passing` часть перевода — `cparser/StructPassing.ml`, замена
   структур по значению указателями — идёт **в непроверенной части CompCert**, до
   проверенного ядра. Наш C держится на `fl_value` по значению всюду, поэтому «второе
   место доверия закрыто теоремой целиком» сказать нельзя: закрыто всё, что после этого
   прохода. Снять зависимость — перестроить соглашение о вызовах в печатнике; цена не
   измерена.
3. Замер — на x86_64/Linux/glibc; CompCert на других целях (ARM, RISC-V, PowerPC) не
   гонялся.
\15. Сравнивались ответы на входах из примеров и на граничных значениях. Поведение под
   пределом памяти (арена), сигналы и рабочий режим `flang_conc` с числом потоков больше
   одного не сравнивались.

### Перепроверка первого захода: что было неточно и что осталось верным

Замер перепроверен другим кодом (`recheck/recheck_programs.py`, `recheck/slot-b.sh`,
`latin.py`, всё в `/home/b/projects/flang-1402-area/`). Три неточности первого захода и
что из них следует:

1. **Латиница ставилась заменой по всему файлу.** `measure.py` менял `\bконец\b`, а
   сборка компилятора — `s/поток/potok_/g` во всём файле. Это задевало и тексты:
   два сообщения `«подстрока»: конец … вне диапазона` (`flang_runtime.c:4349, 4363`)
   и три строки справки `поток токенов` (`flang_repl.c:373, 699, 12092`). Ложного
   «совпало» так получить нельзя: задетое сообщение показалось бы расхождением.
   Но ccomp собирал не ту же программу, что cc. Поэтому латиница поставлена
   заново, только в строках кода, где слово — имя переменной, и со сверкой числа
   замен (`latin.py`): в рантайме 7 строк (646–648, 4590–4593), в оболочке 12
   (11907–11950). **Итог тот же:** 92 программы, ccomp собрал 91 (кроме
   `hundred-doors`), у 90 программ с входами 3967 примеров и 23 545 граничных вызовов,
   всего 27 512 ответов, совпали байт в байт все.
2. **Отказы печати в `summary.md` названы строкой хода, а не причиной.** Там стоит
   «шагов … идёт «Проверить доказательства с кешем»»: `measure.py` брал первую
   строку со словом error или warning, а у отказа `план` такой строки нет. Причины
   сняты заново, перепрогоном печати (таблица ниже).
3. **«Печать совпала 24 из 24».** Верно по существу: 102 файла печати побайтово
   одинаковы. Но `diff -r` каталогов даёт разницу: 24 журнала различаются путём
   каталога вывода, а журнал `python-lists` ещё и строкой хода. Её печатает таймер
   у медленной сборки, к поведению она не относится.

**Отрицательный контроль, которого в первом заходе не было.** Та же программа,
собранная `cc -std=c99 -O2 -ffast-math`, на тех же входах разошлась с `cc -O2` у
**82 из 90** программ с входами (5887 строк ответа). Значит, разницу
компиляторов сравнение ловит, если она есть. У ccomp против cc её нет.

**Ещё два заявления проверены прогоном:**
- `make CC=ccomp CFLAGS='…'` собирает напечатанный `Makefile` как есть: quicksort,
  копия с латиницей в рантайме, код 0, ответы совпали с cc;
- ключи CI (`FLANG_CFLAGS` в `binary.yml`: `-std=c99 -Wall -Wextra -Werror -pedantic
  -O2 -flto=auto`) ccomp не берёт: `Unknown option '-pedantic'` и `'-flto=auto'` —
  ошибка, `-Wextra` — предупреждение.

**Откуда оговорка про `-fstruct-passing`.** `cparser/StructPassing.ml` — 600 строк
OCaml: «Eliminate structs and unions that are returned by value / passed by value».
В `cparser/` 23 файла `.ml` и один `.v`, и двойника на Coq у `StructPassing` нет.
Проверенная часть CompCert начинается с CompCert C (`cfrontend/Csyntax.v`,
`Csem.v`), и переводит в неё `cfrontend/C2C.ml`. Changelog CompCert прямо пишет, что
возврат структур по значению в проверенной части «remains emulated». Архив тега
`v3.18` из кеша opam; в нём же `VERSION` с `version=3.17`.

### Таблица по программам

Столбцы: «ccomp `-std=c99 -Wall`» — первая ошибка модуля программы без ключей, дословно;
«ccomp с ключами, программа целиком» — пять ключей и латиница в рантайме (`latin.py`),
все файлы, слинковано; «вывод cc = ccomp» — примеры и граничные вызовы, байт в байт.
У ненапечатанных причина взята из полного вывода печати, а пометка «печать с
`--no-check`» значит, что отказ `план` снят без проверки доказательств.

| класс | программ |
|---|---:|
| печатается; структуры по значению — ключ CompCert `-fstruct-passing` | 248 |
| не печатается: `план` — цель c планов не печатает | 35 |
| печатается; модуль собрался и без ключей; рантайм — нет (см. «Собирается ли: числа») | 5 |
| не печатается: программа не проходит проверку (`FLANG_UNKNOWN_NAME`) | 2 |
| печатается; не собирается | 2 |
| не печатается: два имени дают один идентификатор C — класс задачи 0311 | 2 |
| не печатается: программа не проходит проверку (`FLANG_PRECONDITION_CALL`) | 2 |
| не печатается: программа не проходит проверку (`FLANG_TYPE_PARAM`) | 1 |
| не печатается: программа не проходит проверку (`FLANG_NOT_TOTAL`) | 1 |
| не печатается: программа не проходит проверку (`FLANG_HANDLER_NOT_TOTAL`) | 1 |
| не печатается: программа не проходит проверку (`FLANG_MATCH_NOT_EXHAUSTIVE`) | 1 |
| не печатается: программа не проходит проверку (`FLANG_PROOF_INDUCTION_DESCENT`) | 1 |
| не печатается: программа не проходит проверку (`FLANG_PROOF_STEP`) | 1 |

<details><summary>Все программы поимённо</summary>

| файл | C модуля, байт | cc | ccomp `-std=c99 -Wall`: первая ошибка дословно | ccomp с ключами, программа целиком | класс причины | примеров | вывод cc = ccomp |
|---|---:|:-:|---|:-:|---|---:|---|
| `docs/examples/allocator/allocator.flang` | 72120 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 37 | да (37 прим., 373 гран.) |
| `docs/examples/crypto/aes-vectors.flang` | — | — | — | — | не печатается: `план` — цель c планов не печатает | — | — |
| `docs/examples/crypto/certificate.flang` | — | — | — | — | не печатается: `план` — цель c планов не печатает | — | — |
| `docs/examples/crypto/ecdsa-digest.flang` | 196272 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 105 | да (105 прим., 600 гран.) |
| `docs/examples/crypto/ecdsa-signature.flang` | 261929 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 148 | да (148 прим., 600 гран.) |
| `docs/examples/crypto/revocation.flang` | — | — | — | — | не печатается: `план` — цель c планов не печатает | — | — |
| `docs/examples/crypto/signature.flang` | — | — | — | — | не печатается: `план` — цель c планов не печатает | — | — |
| `docs/examples/crypto/tls-hello.flang` | — | — | — | — | не печатается: `план` — цель c планов не печатает (печать с `--no-check`) | — | — |
| `docs/examples/crypto/x25519-vectors.flang` | — | — | — | — | не печатается: `план` — цель c планов не печатает | — | — |
| `docs/examples/db/postgres-plan.flang` | — | — | — | — | не печатается: `план` — цель c планов не печатает (печать с `--no-check`) | — | — |
| `docs/examples/db/postgres-scram-plan.flang` | — | — | — | — | не печатается: `план` — цель c планов не печатает | — | — |
| `docs/examples/db/redis-plan.flang` | — | — | — | — | не печатается: `план` — цель c планов не печатает (печать с `--no-check`) | — | — |
| `docs/examples/db/sqlite-insert.flang` | — | — | — | — | не печатается: `план` — цель c планов не печатает | — | — |
| `docs/examples/db/sqlite-overflow.flang` | — | — | — | — | не печатается: `план` — цель c планов не печатает (печать с `--no-check`) | — | — |
| `docs/examples/db/sqlite-read.flang` | — | — | — | — | не печатается: `план` — цель c планов не печатает | — | — |
| `docs/examples/driver/msi/msi.flang` | 71484 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 42 | да (42 прим., 472 гран.) |
| `docs/examples/driver/uart.flang` | 15863 | да | `flang_runtime.h:713: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 7 | да (7 прим., 29 гран.) |
| `docs/examples/errors/column-total.flang` | 19837 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 13 | да (13 прим., 83 гран.) |
| `docs/examples/errors/number-parsing.flang` | 20547 | да | `flang_runtime.h:713: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 31 | да (31 прим., 265 гран.) |
| `docs/examples/frameworks/nestjs-orders/core/orders-api.flang` | 248278 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 167 | да (167 прим., 600 гран.) |
| `docs/examples/frameworks/react-invoice/core/cart.flang` | 35507 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 31 | да (31 прим., 238 гран.) |
| `docs/examples/frameworks/react-invoice/core/catalog.flang` | 18754 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 15 | да (15 прим., 134 гран.) |
| `docs/examples/frameworks/react-ts-pure/core/storefront.flang` | 60791 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 48 | да (48 прим., 532 гран.) |
| `docs/examples/frameworks/react-ts-pure/scripts/markup-without-logic.flang` | — | — | — | — | не печатается: `план` — цель c планов не печатает (печать с `--no-check`) | — | — |
| `docs/examples/frameworks/vue-roman/core/roman-numerals.flang` | 25055 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 33 | да (33 прим., 328 гран.) |
| `docs/examples/host-boundary/gatekeeper.flang` | 30611 | да | `flang_runtime.h:713: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 15 | да (15 прим., 220 гран.) |
| `docs/examples/https/rfc8448-records.flang` | — | — | — | — | не печатается: `план` — цель c планов не печатает (печать с `--no-check`) | — | — |
| `docs/examples/https/system-trust-store.flang` | — | — | — | — | не печатается: `план` — цель c планов не печатает (печать с `--no-check`) | — | — |
| `docs/examples/https/tls-hello-to-a-real-host.flang` | — | — | — | — | не печатается: `план` — цель c планов не печатает (печать с `--no-check`) | — | — |
| `docs/examples/import-check.flang` | 112902 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 83 | да (83 прим., 600 гран.) |
| `docs/examples/io/binary-file-round-trip.flang` | — | — | — | — | не печатается: `план` — цель c планов не печатает (печать с `--no-check`) | — | — |
| `docs/examples/io/child-process.flang` | — | — | — | — | не печатается: `план` — цель c планов не печатает (печать с `--no-check`) | — | — |
| `docs/examples/io/gcm-vectors.flang` | — | — | — | — | не печатается: `план` — цель c планов не печатает (печать с `--no-check`) | — | — |
| `docs/examples/io/https-request.flang` | — | — | — | — | не печатается: `план` — цель c планов не печатает (печать с `--no-check`) | — | — |
| `docs/examples/io/inverse-cipher-vectors.flang` | — | — | — | — | не печатается: `план` — цель c планов не печатает (печать с `--no-check`) | — | — |
| `docs/examples/io/link-report.flang` | — | — | — | — | не печатается: `план` — цель c планов не печатает (печать с `--no-check`) | — | — |
| `docs/examples/io/octets-over-the-wire.flang` | — | — | — | — | не печатается: `план` — цель c планов не печатает (печать с `--no-check`) | — | — |
| `docs/examples/io/temp-directory.flang` | — | — | — | — | не печатается: `план` — цель c планов не печатает (печать с `--no-check`) | — | — |
| `docs/examples/io/фильтр-пакетов.flang` | — | — | — | — | не печатается: `план` — цель c планов не печатает (печать с `--no-check`) | — | — |
| `docs/examples/leetcode/001-two-sum.flang` | 10838 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 6 | да (6 прим., 112 гран.) |
| `docs/examples/leetcode/003-longest-substring-without-repeating-characters.flang` | 30044 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 8 | да (8 прим., 128 гран.) |
| `docs/examples/leetcode/004-median-of-two-sorted-arrays.flang` | 25236 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 12 | да (12 прим., 175 гран.) |
| `docs/examples/leetcode/011-container-with-most-water.flang` | 22268 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 13 | да (13 прим., 236 гран.) |
| `docs/examples/leetcode/013-roman-to-integer.flang` | 13454 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 10 | да (10 прим., 48 гран.) |
| `docs/examples/leetcode/014-longest-common-prefix.flang` | 11519 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 11 | да (11 прим., 99 гран.) |
| `docs/examples/leetcode/015-3sum.flang` | 45373 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 21 | да (21 прим., 378 гран.) |
| `docs/examples/leetcode/017-letter-combinations-of-a-phone-number.flang` | 17809 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 11 | да (11 прим., 48 гран.) |
| `docs/examples/leetcode/020-valid-parentheses.flang` | 13303 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 13 | да (13 прим., 73 гран.) |
| `docs/examples/leetcode/022-generate-parentheses.flang` | 20021 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 8 | да (8 прим., 148 гран.) |
| `docs/examples/leetcode/026-remove-duplicates-from-sorted-array.flang` | 6522 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 4 | да (4 прим., 23 гран.) |
| `docs/examples/leetcode/027-remove-element.flang` | 6149 | да | `flang_runtime.h:713: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 10 | да (10 прим., 180 гран.) |
| `docs/examples/leetcode/028-find-the-index-of-the-first-occurrence-in-a-string.flang` | 15983 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 8 | да (8 прим., 141 гран.) |
| `docs/examples/leetcode/033-search-in-rotated-sorted-array.flang` | 26224 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 11 | да (11 прим., 209 гран.) |
| `docs/examples/leetcode/035-search-insert-position.flang` | 6454 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 5 | да (5 прим., 92 гран.) |
| `docs/examples/leetcode/042-trapping-rain-water.flang` | 20366 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 11 | да (11 прим., 213 гран.) |
| `docs/examples/leetcode/046-permutations.flang` | 32198 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 9 | да (9 прим., 164 гран.) |
| `docs/examples/leetcode/049-group-anagrams.flang` | 18042 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 6 | да (6 прим., 42 гран.) |
| `docs/examples/leetcode/050-powx-n.flang` | 13854 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 11 | да (11 прим., 206 гран.) |
| `docs/examples/leetcode/053-maximum-subarray.flang` | 7895 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 4 | да (4 прим., 21 гран.) |
| `docs/examples/leetcode/056-merge-intervals.flang` | 19721 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 17 | да (17 прим., 111 гран.) |
| `docs/examples/leetcode/062-unique-paths.flang` | 35327 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 10 | да (10 прим., 175 гран.) |
| `docs/examples/leetcode/064-minimum-path-sum.flang` | 33097 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 12 | да (12 прим., 250 гран.) |
| `docs/examples/leetcode/066-plus-one.flang` | 9134 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 5 | да (5 прим., 34 гран.) |
| `docs/examples/leetcode/069-sqrtx.flang` | 16924 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 9 | да (9 прим., 89 гран.) |
| `docs/examples/leetcode/070-climbing-stairs.flang` | 7483 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 5 | да (5 прим., 51 гран.) |
| `docs/examples/leetcode/072-edit-distance.flang` | 40778 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 13 | да (13 прим., 257 гран.) |
| `docs/examples/leetcode/074-search-a-2d-matrix.flang` | 22106 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 12 | да (12 прим., 257 гран.) |
| `docs/examples/leetcode/076-minimum-window-substring.flang` | 36395 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 11 | да (11 прим., 266 гран.) |
| `docs/examples/leetcode/078-subsets.flang` | 8359 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 7 | да (7 прим., 57 гран.) |
| `docs/examples/leetcode/088-merge-sorted-array.flang` | 7986 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 5 | да (5 прим., 62 гран.) |
| `docs/examples/leetcode/094-binary-tree-inorder-traversal.flang` | 9302 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 7 | да (7 прим., 49 гран.) |
| `docs/examples/leetcode/098-validate-binary-search-tree.flang` | 29168 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 15 | да (15 прим., 120 гран.) |
| `docs/examples/leetcode/100-same-tree.flang` | 8484 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 6 | да (6 прим., 63 гран.) |
| `docs/examples/leetcode/101-symmetric-tree.flang` | 23638 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 12 | да (12 прим., 68 гран.) |
| `docs/examples/leetcode/104-maximum-depth-of-binary-tree.flang` | 14525 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 3 | да (3 прим., 15 гран.) |
| `docs/examples/leetcode/110-balanced-binary-tree.flang` | 17910 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 3 | да (3 прим., 15 гран.) |
| `docs/examples/leetcode/112-path-sum.flang` | 23206 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 12 | да (12 прим., 131 гран.) |
| `docs/examples/leetcode/121-best-time-to-buy-and-sell-stock.flang` | 8237 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 3 | да (3 прим., 15 гран.) |
| `docs/examples/leetcode/125-valid-palindrome.flang` | 14600 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 13 | да (13 прим., 97 гран.) |
| `docs/examples/leetcode/136-single-number.flang` | 7147 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 4 | да (4 прим., 39 гран.) |
| `docs/examples/leetcode/139-word-break.flang` | 21109 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 9 | да (9 прим., 158 гран.) |
| `docs/examples/leetcode/148-sort-list.flang` | 35257 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 12 | да (12 прим., 133 гран.) |
| `docs/examples/leetcode/150-evaluate-reverse-polish-notation.flang` | 15382 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 20 | да (20 прим., 283 гран.) |
| `docs/examples/leetcode/152-maximum-product-subarray.flang` | 11176 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 8 | да (8 прим., 71 гран.) |
| `docs/examples/leetcode/153-find-minimum-in-rotated-sorted-array.flang` | 18113 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 9 | да (9 прим., 99 гран.) |
| `docs/examples/leetcode/167-two-sum-ii-input-array-is-sorted.flang` | 18140 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 7 | да (7 прим., 171 гран.) |
| `docs/examples/leetcode/169-majority-element.flang` | 7650 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 3 | да (3 прим., 33 гран.) |
| `docs/examples/leetcode/179-largest-number.flang` | 16800 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 13 | да (13 прим., 134 гран.) |
| `docs/examples/leetcode/189-rotate-array.flang` | 14232 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 14 | да (14 прим., 211 гран.) |
| `docs/examples/leetcode/198-house-robber.flang` | 8773 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 6 | да (6 прим., 46 гран.) |
| `docs/examples/leetcode/200-number-of-islands.flang` | 62501 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 14 | да (14 прим., 288 гран.) |
| `docs/examples/leetcode/202-happy-number.flang` | 16723 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 13 | да (13 прим., 92 гран.) |
| `docs/examples/leetcode/205-isomorphic-strings.flang` | 9674 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 15 | да (15 прим., 164 гран.) |
| `docs/examples/leetcode/207-course-schedule.flang` | 26305 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 19 | да (19 прим., 308 гран.) |
| `docs/examples/leetcode/208-implement-trie-prefix-tree.flang` | 27915 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 13 | да (13 прим., 178 гран.) |
| `docs/examples/leetcode/209-minimum-size-subarray-sum.flang` | 21912 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 11 | да (11 прим., 307 гран.) |
| `docs/examples/leetcode/217-contains-duplicate.flang` | 5807 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 3 | да (3 прим., 20 гран.) |
| `docs/examples/leetcode/226-invert-binary-tree.flang` | 19850 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 5 | да (5 прим., 37 гран.) |
| `docs/examples/leetcode/236-lowest-common-ancestor-of-a-binary-tree.flang` | 26568 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 12 | да (12 прим., 257 гран.) |
| `docs/examples/leetcode/238-product-of-array-except-self.flang` | 22187 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 14 | да (14 прим., 105 гран.) |
| `docs/examples/leetcode/242-valid-anagram.flang` | 10270 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 5 | да (5 прим., 73 гран.) |
| `docs/examples/leetcode/268-missing-number.flang` | 6341 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 4 | да (4 прим., 28 гран.) |
| `docs/examples/leetcode/283-move-zeroes.flang` | 7030 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 3 | да (3 прим., 28 гран.) |
| `docs/examples/leetcode/300-longest-increasing-subsequence.flang` | 27418 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 11 | да (11 прим., 190 гран.) |
| `docs/examples/leetcode/322-coin-change.flang` | 21218 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 5 | да (5 прим., 118 гран.) |
| `docs/examples/leetcode/344-reverse-string.flang` | 8323 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 5 | да (5 прим., 38 гран.) |
| `docs/examples/leetcode/349-intersection-of-two-arrays.flang` | 6979 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 3 | да (3 прим., 36 гран.) |
| `docs/examples/leetcode/383-ransom-note.flang` | 10485 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 9 | да (9 прим., 106 гран.) |
| `docs/examples/leetcode/424-longest-repeating-character-replacement.flang` | 30451 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 14 | да (14 прим., 297 гран.) |
| `docs/examples/leetcode/438-find-all-anagrams-in-a-string.flang` | 24367 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 13 | да (13 прим., 214 гран.) |
| `docs/examples/leetcode/509-fibonacci-number.flang` | 7220 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 6 | да (6 прим., 52 гран.) |
| `docs/examples/leetcode/516-longest-palindromic-subsequence.flang` | 32983 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 13 | да (13 прим., 203 гран.) |
| `docs/examples/leetcode/543-diameter-of-binary-tree.flang` | 25782 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 14 | да (14 прим., 108 гран.) |
| `docs/examples/leetcode/547-number-of-provinces.flang` | 36039 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 20 | да (20 прим., 310 гран.) |
| `docs/examples/leetcode/567-permutation-in-string.flang` | 23144 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 13 | да (13 прим., 183 гран.) |
| `docs/examples/leetcode/643-maximum-average-subarray-i.flang` | 20328 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 9 | да (9 прим., 231 гран.) |
| `docs/examples/leetcode/704-binary-search.flang` | 10316 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 4 | да (4 прим., 92 гран.) |
| `docs/examples/leetcode/733-flood-fill.flang` | 69622 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 21 | да (21 прим., 600 гран.) |
| `docs/examples/leetcode/739-daily-temperatures.flang` | 14372 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 15 | да (15 прим., 194 гран.) |
| `docs/examples/leetcode/746-min-cost-climbing-stairs.flang` | 16930 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 7 | да (7 прим., 54 гран.) |
| `docs/examples/leetcode/977-squares-of-a-sorted-array.flang` | 38335 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 16 | да (16 прим., 170 гран.) |
| `docs/examples/library-api/lib/api.flang` | — | — | — | — | не печатается: программа не проходит проверку (`FLANG_UNKNOWN_NAME`) | — | — |
| `docs/examples/library-api/lib/catalog.flang` | — | — | — | — | не печатается: программа не проходит проверку (`FLANG_UNKNOWN_NAME`) | — | — |
| `docs/examples/library-api/lib/fine.flang` | 7029 | да | `flang_runtime.h:713: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 5 | да (5 прим., 20 гран.) |
| `docs/examples/library-api/lib/isbn.flang` | 12526 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 10 | да (10 прим., 41 гран.) |
| `docs/examples/library-api/lib/loan.flang` | 5274 | да | `flang_runtime.h:713: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 4 | да (4 прим., 13 гран.) |
| `docs/examples/library-api/lib/query.flang` | 14106 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 15 | да (15 прим., 130 гран.) |
| `docs/examples/library-api/stdlib/text.flang` | 9217 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 9 | да (9 прим., 75 гран.) |
| `docs/examples/measure/binary-search.flang` | 18298 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 5 | да (5 прим., 99 гран.) |
| `docs/examples/measure/euclid.flang` | 12006 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 6 | да (6 прим., 144 гран.) |
| `docs/examples/measure/natural.flang` | 17367 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 16 | да (16 прим., 141 гран.) |
| `docs/examples/monad/order-total.flang` | — | — | — | — | не печатается: программа не проходит проверку (`FLANG_TYPE_PARAM`) | — | — |
| `docs/examples/money/exact-decimal.flang` | 18989 | да | `flang_runtime.h:713: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 27 | да (27 прим., 339 гран.) |
| `docs/examples/operations.flang` | 413795 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 274 | да (274 прим., 600 гран.) |
| `docs/examples/package/discount.flang` | 6632 | да | `flang_runtime.h:713: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 5 | да (5 прим., 96 гран.) |
| `docs/examples/package/shop/shop.flang` | 9168 | да | `flang_runtime.h:713: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 7 | да (7 прим., 144 гран.) |
| `docs/examples/paths/shortest-path.flang` | 20405 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 22 | да (22 прим., 339 гран.) |
| `docs/examples/proof-probes/typed-ast-door.flang` | 72275 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 21 | да (21 прим., 104 гран.) |
| `docs/examples/proof-probes/typed-ast-generic-descent-is-refused.flang` | — | — | — | — | не печатается: программа не проходит проверку (`FLANG_NOT_TOTAL`) | — | — |
| `docs/examples/proof-probes/variant-with-fields.flang` | 26390 | да | `flang_runtime.h:713: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 23 | да (23 прим., 110 гран.) |
| `docs/examples/pythagoras/квадрат-гипотенузы.flang` | 5703 | да | `flang_runtime.h:714: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 4 | да (4 прим., 62 гран.) |
| `docs/examples/pythagoras/формула-евклида.flang` | 17514 | да | `flang_runtime.h:713: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 9 | да (9 прим., 170 гран.) |
| `docs/examples/rosetta/ackermann-function-english.flang` | 9301 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 15 | да (15 прим., 279 гран.) |
| `docs/examples/rosetta/ackermann-function.flang` | 9450 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 15 | да (15 прим., 279 гран.) |
| `docs/examples/rosetta/factorial-english.flang` | 11254 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 11 | да (11 прим., 89 гран.) |
| `docs/examples/rosetta/factorial.flang` | 11781 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 11 | да (11 прим., 89 гран.) |
| `docs/examples/rosetta/fibonacci-english.flang` | 16011 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 10 | да (10 прим., 111 гран.) |
| `docs/examples/rosetta/fibonacci.flang` | 17015 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 10 | да (10 прим., 111 гран.) |
| `docs/examples/rosetta/fizzbuzz-english.flang` | 11484 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 10 | да (10 прим., 100 гран.) |
| `docs/examples/rosetta/fizzbuzz.flang` | 11909 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 10 | да (10 прим., 100 гран.) |
| `docs/examples/rosetta/hundred-doors-english.flang` | 19366 | НЕТ | `100_doors.h:7:9: error: macro names must be identifiers` | НЕТ | см. разбор ниже | 18 | — |
| `docs/examples/rosetta/hundred-doors.flang` | 18097 | НЕТ | `100_doors.h:7:9: error: macro names must be identifiers` | НЕТ | см. разбор ниже | 18 | — |
| `docs/examples/rosetta/levenshtein-distance-english.flang` | 18306 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 20 | да (20 прим., 350 гран.) |
| `docs/examples/rosetta/levenshtein-distance.flang` | 19113 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 20 | да (20 прим., 350 гран.) |
| `docs/examples/rosetta/merge-sort-english.flang` | 19958 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 13 | да (13 прим., 155 гран.) |
| `docs/examples/rosetta/merge-sort.flang` | 21676 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 13 | да (13 прим., 155 гран.) |
| `docs/examples/rosetta/palindrome-english.flang` | 29522 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 23 | да (23 прим., 212 гран.) |
| `docs/examples/rosetta/palindrome.flang` | 28942 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 23 | да (23 прим., 212 гран.) |
| `docs/examples/rosetta/primes-by-trial-division-english.flang` | 14210 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 11 | да (11 прим., 109 гран.) |
| `docs/examples/rosetta/primes-by-trial-division.flang` | 14829 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 11 | да (11 прим., 109 гран.) |
| `docs/examples/rosetta/quicksort-english.flang` | 13876 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 11 | да (11 прим., 100 гран.) |
| `docs/examples/rosetta/quicksort.flang` | 14918 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 11 | да (11 прим., 100 гран.) |
| `docs/examples/rosetta/reverse-string-english.flang` | 8907 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 10 | да (10 прим., 51 гран.) |
| `docs/examples/rosetta/reverse-string.flang` | 9304 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 10 | да (10 прим., 51 гран.) |
| `docs/examples/rosetta/roman-numerals-english.flang` | 23900 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 33 | да (33 прим., 328 гран.) |
| `docs/examples/rosetta/roman-numerals.flang` | 25055 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 33 | да (33 прим., 328 гран.) |
| `docs/examples/rosetta/run-length-encoding-english.flang` | 18753 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 14 | да (14 прим., 102 гран.) |
| `docs/examples/rosetta/run-length-encoding.flang` | 19323 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 14 | да (14 прим., 102 гран.) |
| `docs/examples/rosetta/towers-of-hanoi-english.flang` | 17000 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 12 | да (12 прим., 167 гран.) |
| `docs/examples/rosetta/towers-of-hanoi.flang` | 17544 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 12 | да (12 прим., 167 гран.) |
| `docs/examples/service-on-processes/ask.flang` | — | — | — | — | не печатается: `план` — цель c планов не печатает (печать с `--no-check`) | — | — |
| `docs/examples/service-on-processes/core.flang` | 369755 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 274 | да (274 прим., 600 гран.) |
| `docs/examples/service-on-processes/serve.flang` | — | — | — | — | не печатается: `план` — цель c планов не печатает (печать с `--no-check`) | — | — |
| `docs/examples/service-on-processes/service.flang` | 407560 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 280 | да (280 прим., 600 гран.) |
| `docs/examples/service/ask-a-service.flang` | — | — | — | — | не печатается: `план` — цель c планов не печатает (печать с `--no-check`) | — | — |
| `docs/examples/surfaces/factorial.eo.flang` | 11374 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 11 | да (11 прим., 89 гран.) |
| `docs/examples/surfaces/factorial.zh.flang` | — | — | — | — | не печатается: два имени дают один идентификатор C — класс задачи 0311 | — | — |
| `docs/examples/tutorial.flang` | 15508 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 10 | да (10 прим., 61 гран.) |
| `docs/examples/wal/append-plan.flang` | — | — | — | — | не печатается: `план` — цель c планов не печатает (печать с `--no-check`) | — | — |
| `docs/examples/wal/write-ahead-log.flang` | 74195 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 98 | да (98 прим., 600 гран.) |
| `docs/examples/web/browser-app/hailstone.flang` | — | — | — | — | не печатается: `план` — цель c планов не печатает (печать с `--no-check`) | — | — |
| `docs/examples/web/marketplace/cart.flang` | 35507 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 31 | да (31 прим., 238 гран.) |
| `docs/examples/web/marketplace/catalog.flang` | 18754 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 15 | да (15 прим., 134 гран.) |
| `docs/examples/web/marketplace/gateway.flang` | 423599 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 321 | да (321 прим., 600 гран.) |
| `docs/examples/web/marketplace/orders.flang` | 21168 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 27 | да (27 прим., 55 гран.) |
| `docs/examples/web/orders-api.flang` | 248278 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 167 | да (167 прим., 600 гран.) |
| `docs/examples/web/shortener-client/client.flang` | — | — | — | — | не печатается: `план` — цель c планов не печатает (печать с `--no-check`) | — | — |
| `docs/examples/web/shortener/handler-without-budget.flang` | — | — | — | — | не печатается: программа не проходит проверку (`FLANG_HANDLER_NOT_TOTAL`) | — | — |
| `docs/examples/web/shortener/plan-durable.flang` | — | — | — | — | не печатается: `план` — цель c планов не печатает (печать с `--no-check`) | — | — |
| `docs/examples/web/shortener/plan-network.flang` | — | — | — | — | не печатается: `план` — цель c планов не печатает (печать с `--no-check`) | — | — |
| `docs/examples/web/shortener/plan.flang` | — | — | — | — | не печатается: `план` — цель c планов не печатает (печать с `--no-check`) | — | — |
| `docs/examples/web/shortener/server-network.flang` | — | — | — | — | не печатается: программа не проходит проверку (`FLANG_MATCH_NOT_EXHAUSTIVE`) | — | — |
| `docs/examples/web/shortener/server.flang` | 429787 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 326 | да (326 прим., 600 гран.) |
| `docs/examples/web/shortener/service.flang` | 403866 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 323 | да (323 прим., 600 гран.) |
| `docs/examples/web/shortener/store.flang` | 24985 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 17 | да (17 прим., 166 гран.) |
| `docs/examples/web/stand.flang` | — | — | — | — | не печатается: `план` — цель c планов не печатает (печать с `--no-check`) | — | — |
| `docs/examples/web/wasm/descent.flang` | 12326 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 3 | да (3 прим., 57 гран.) |
| `docs/examples/применение/итог-заказа.flang` | 4319 | да | `flang_runtime.h:714: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 2 | да (2 прим., 36 гран.) |
| `docs/examples/применение/место-слева-вызов.flang` | — | — | — | — | не печатается: программа не проходит проверку (`FLANG_PRECONDITION_CALL`) | — | — |
| `docs/examples/применение/место-слева-по-ключу.flang` | 25280 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 8 | да (8 прим., 121 гран.) |
| `docs/examples/применение/место-слева-с-отрезком.flang` | — | — | — | — | не печатается: программа не проходит проверку (`FLANG_PRECONDITION_CALL`) | — | — |
| `docs/examples/применение/место-слева.flang` | 22305 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 7 | да (7 прим., 108 гран.) |
| `docs/examples/применение/скидка-на-вызове.flang` | 5780 | да | `flang_runtime.h:713: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 2 | да (2 прим., 26 гран.) |
| `docs/examples/применение/скидка.flang` | 5430 | да | `flang_runtime.h:713: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 0 | примеров нет |
| `flang/proof/examples/binder-hides-the-condition.flang` | 6614 | да | `flang_runtime.h:713: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 2 | да (2 прим., 38 гран.) |
| `flang/proof/examples/binder-wall-map.flang` | 20831 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 0 | примеров нет |
| `flang/proof/examples/body-forms.flang` | 9820 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 7 | да (7 прим., 26 гран.) |
| `flang/proof/examples/corpus-alphabet.flang` | 10420 | да | `— (модуль собрался; рантайм — кириллица)` | да | модуль собрался и без ключей; рантайм — нет (см. «Собирается ли: числа») | 6 | да (6 прим., 12 гран.) |
| `flang/proof/examples/corpus-brackets.flang` | 6987 | да | `flang_runtime.h:713: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 3 | да (3 прим., 4 гран.) |
| `flang/proof/examples/corpus-bytes.flang` | 13586 | да | `flang_runtime.h:733: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 1 | да (1 прим., 2 гран.) |
| `flang/proof/examples/corpus-carrier.flang` | 10059 | да | `flang_runtime.h:763: error: unsupported feature: function parameter of struct or union type (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 12 | да (12 прим., 14 гран.) |
| `flang/proof/examples/corpus-case.flang` | 29706 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 3 | да (3 прим., 48 гран.) |
| `flang/proof/examples/corpus-cforms.flang` | 38594 | да | `flang_runtime.h:713: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 2 | да (2 прим., 4 гран.) |
| `flang/proof/examples/corpus-cident.flang` | 5912 | да | `— (модуль собрался; рантайм — кириллица)` | да | модуль собрался и без ключей; рантайм — нет (см. «Собирается ли: числа») | 1 | да (1 прим., 2 гран.) |
| `flang/proof/examples/corpus-depth.flang` | 8009 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 0 | примеров нет |
| `flang/proof/examples/corpus-endings.flang` | 9761 | да | `flang_runtime.h:733: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 1 | да (1 прим., 2 гран.) |
| `flang/proof/examples/corpus-factorial.flang` | 5368 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 4 | да (4 прим., 16 гран.) |
| `flang/proof/examples/corpus-fullwidth.flang` | 4901 | да | `— (модуль собрался; рантайм — кириллица)` | да | модуль собрался и без ключей; рантайм — нет (см. «Собирается ли: числа») | 2 | да (2 прим., 4 гран.) |
| `flang/proof/examples/corpus-hof.flang` | 21843 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 19 | да (19 прим., 144 гран.) |
| `flang/proof/examples/corpus-json.flang` | 7630 | да | `flang_runtime.h:763: error: unsupported feature: function parameter of struct or union type (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 6 | да (6 прим., 7 гран.) |
| `flang/proof/examples/corpus-jsonescape.flang` | 20503 | да | `flang_runtime.h:713: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 1 | да (1 прим., 2 гран.) |
| `flang/proof/examples/corpus-keywords.flang` | 17705 | да | `flang_runtime.h:733: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 1 | да (1 прим., 2 гран.) |
| `flang/proof/examples/corpus-length.flang` | 5109 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 3 | да (3 прим., 15 гран.) |
| `flang/proof/examples/corpus-lists.flang` | 42674 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 36 | да (36 прим., 528 гран.) |
| `flang/proof/examples/corpus-marks.flang` | 4861 | да | `— (модуль собрался; рантайм — кириллица)` | да | модуль собрался и без ключей; рантайм — нет (см. «Собирается ли: числа») | 2 | да (2 прим., 4 гран.) |
| `flang/proof/examples/corpus-namesigns.flang` | 8612 | да | `flang_runtime.h:733: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 1 | да (1 прим., 2 гран.) |
| `flang/proof/examples/corpus-nat-names.flang` | 4091 | да | `— (модуль собрался; рантайм — кириллица)` | да | модуль собрался и без ключей; рантайм — нет (см. «Собирается ли: числа») | 1 | да (1 прим., 2 гран.) |
| `flang/proof/examples/corpus-natural-ceiling.flang` | 4522 | да | `flang_runtime.h:714: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 1 | да (1 прим., 24 гран.) |
| `flang/proof/examples/corpus-natural.flang` | 4402 | да | `flang_runtime.h:714: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 1 | да (1 прим., 24 гран.) |
| `flang/proof/examples/corpus-numtree.flang` | 7564 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 3 | да (3 прим., 13 гран.) |
| `flang/proof/examples/corpus-ophelpers.flang` | 10181 | да | `flang_runtime.h:713: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 1 | да (1 прим., 2 гран.) |
| `flang/proof/examples/corpus-phrases.flang` | 3896 | да | `flang_runtime.h:714: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 1 | да (1 прим., 2 гран.) |
| `flang/proof/examples/corpus-signs.flang` | 9214 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 5 | да (5 прим., 15 гран.) |
| `flang/proof/examples/corpus-tables.flang` | 20813 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 3 | да (3 прим., 6 гран.) |
| `flang/proof/examples/corpus-translit.flang` | 39322 | да | `flang_runtime.h:713: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 1 | да (1 прим., 2 гран.) |
| `flang/proof/examples/corpus-tree-depth.flang` | 9165 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 5 | да (5 прим., 81 гран.) |
| `flang/proof/examples/corpus-tree-height.flang` | 9134 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 5 | да (5 прим., 81 гран.) |
| `flang/proof/examples/corpus-tree.flang` | 7884 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 2 | да (2 прим., 9 гран.) |
| `flang/proof/examples/forgery-binder-hides-the-condition.flang` | 12153 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 0 | примеров нет |
| `flang/proof/examples/forgery-if-without-descent-theorem.flang` | — | — | — | — | не печатается: программа не проходит проверку (`FLANG_PROOF_INDUCTION_DESCENT`) | — | — |
| `flang/proof/examples/forgery-if-without-descent.flang` | 13660 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 0 | примеров нет |
| `flang/proof/examples/forgery-modus-ponens-by-guard.flang` | — | — | — | — | не печатается: программа не проходит проверку (`FLANG_PROOF_STEP`) | — | — |
| `flang/proof/examples/forgery-subtraction-under-precondition.flang` | 10489 | да | `flang_runtime.h:713: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 3 | да (3 прим., 83 гран.) |
| `flang/proof/examples/four-words.flang` | 8744 | да | `flang_runtime.h:713: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 6 | да (6 прим., 19 гран.) |
| `flang/proof/examples/honest-modus-ponens-by-guard.flang` | 10281 | да | `flang_runtime.h:713: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 6 | да (6 прим., 78 гран.) |
| `flang/proof/examples/if-over-a-segment.flang` | 9506 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 3 | да (3 прим., 39 гран.) |
| `flang/proof/examples/precondition.flang` | 12770 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 6 | да (6 прим., 66 гран.) |
| `flang/proof/examples/segment.flang` | 7174 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 4 | да (4 прим., 28 гран.) |
| `flang/proof/examples/stack.flang` | 8455 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 2 | да (2 прим., 4 гран.) |
| `flang/proof/examples/subtraction-under-precondition.flang` | 6903 | да | `flang_runtime.h:713: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 3 | да (3 прим., 60 гран.) |
| `flang/proof/examples/traffic-light.flang` | 5123 | да | `flang_runtime.h:714: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 3 | да (3 прим., 4 гран.) |
| `flang/stdlib/aes.flang` | 544093 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 252 | да (252 прим., 600 гран.) |
| `flang/stdlib/automaton.flang` | 176791 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 104 | да (104 прим., 600 гран.) |
| `flang/stdlib/base64.flang` | 79801 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 61 | да (61 прим., 568 гран.) |
| `flang/stdlib/bignum.flang` | 105634 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 82 | да (82 прим., 600 гран.) |
| `flang/stdlib/cli.flang` | 146981 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 115 | да (115 прим., 600 гран.) |
| `flang/stdlib/crl.flang` | 459319 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 331 | да (331 прим., 600 гран.) |
| `flang/stdlib/datetime.flang` | 226480 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 128 | да (128 прим., 600 гран.) |
| `flang/stdlib/der.flang` | 99793 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 87 | да (87 прим., 600 гран.) |
| `flang/stdlib/dictionary.flang` | 36976 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 27 | да (27 прим., 369 гран.) |
| `flang/stdlib/dns.flang` | 358609 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 203 | да (203 прим., 600 гран.) |
| `flang/stdlib/ecdsa.flang` | 235112 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 143 | да (143 прим., 600 гран.) |
| `flang/stdlib/hashmap.flang` | 101401 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 67 | да (67 прим., 600 гран.) |
| `flang/stdlib/higher-order.flang` | 98045 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 67 | да (67 прим., 600 гран.) |
| `flang/stdlib/hmac.flang` | 225519 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 138 | да (138 прим., 600 гран.) |
| `flang/stdlib/http.flang` | 306564 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 219 | да (219 прим., 600 гран.) |
| `flang/stdlib/json.flang` | 272904 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 71 | да (71 прим., 415 гран.) |
| `flang/stdlib/kdf.flang` | 247268 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 144 | да (144 прим., 600 гран.) |
| `flang/stdlib/lists.flang` | 110904 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 82 | да (82 прим., 600 гран.) |
| `flang/stdlib/logic.flang` | 13721 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 20 | да (20 прим., 80 гран.) |
| `flang/stdlib/math-classics-lists.flang` | 58194 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 29 | да (29 прим., 438 гран.) |
| `flang/stdlib/math-classics.flang` | 88152 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 62 | да (62 прим., 600 гран.) |
| `flang/stdlib/number-format.flang` | 58154 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 63 | да (63 прим., 600 гран.) |
| `flang/stdlib/numbers.flang` | 61517 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 34 | да (34 прим., 463 гран.) |
| `flang/stdlib/numtree.flang` | 30145 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 18 | да (18 прим., 120 гран.) |
| `flang/stdlib/optional.flang` | 32878 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 27 | да (27 прим., 350 гран.) |
| `flang/stdlib/postgres.flang` | 460944 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 209 | да (209 прим., 600 гран.) |
| `flang/stdlib/protobuf.flang` | 250865 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 137 | да (137 прим., 600 гран.) |
| `flang/stdlib/redis.flang` | 303491 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 171 | да (171 прим., 600 гран.) |
| `flang/stdlib/registry.flang` | 144364 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 55 | да (55 прим., 496 гран.) |
| `flang/stdlib/result.flang` | 20279 | да | `flang_runtime.h:713: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 25 | да (25 прим., 300 гран.) |
| `flang/stdlib/rsa.flang` | 109162 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 52 | да (52 прим., 600 гран.) |
| `flang/stdlib/scram.flang` | 362648 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 233 | да (233 прим., 600 гран.) |
| `flang/stdlib/sets.flang` | 54396 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 34 | да (34 прим., 457 гран.) |
| `flang/stdlib/sha1.flang` | 307644 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 178 | да (178 прим., 600 гран.) |
| `flang/stdlib/sha256.flang` | 184173 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 101 | да (101 прим., 600 гран.) |
| `flang/stdlib/sqlite.flang` | 421985 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 196 | да (196 прим., 600 гран.) |
| `flang/stdlib/stats.flang` | 166467 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 140 | да (140 прим., 600 гран.) |
| `flang/stdlib/strings.flang` | 144286 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 86 | да (86 прим., 600 гран.) |
| `flang/stdlib/strlists.flang` | 44675 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 32 | да (32 прим., 337 гран.) |
| `flang/stdlib/tls-handshake.flang` | 937196 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 497 | да (497 прим., 600 гран.) |
| `flang/stdlib/tls.flang` | 812469 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 427 | да (427 прим., 600 гран.) |
| `flang/stdlib/toml.flang` | 469276 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 205 | да (205 прим., 600 гран.) |
| `flang/stdlib/tree.flang` | 90026 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 54 | да (54 прим., 482 гран.) |
| `flang/stdlib/trust-store.flang` | 435481 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 293 | да (293 прим., 600 гран.) |
| `flang/stdlib/utf8.flang` | 79835 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 86 | да (86 прим., 417 гран.) |
| `flang/stdlib/uuid.flang` | — | — | — | — | не печатается: два имени дают один идентификатор C — класс задачи 0311 | — | — |
| `flang/stdlib/websocket.flang` | 904580 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 636 | да (636 прим., 600 гран.) |
| `flang/stdlib/wire.flang` | 161157 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 83 | да (83 прим., 600 гран.) |
| `flang/stdlib/x25519.flang` | 119385 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 46 | да (46 прим., 502 гран.) |
| `flang/stdlib/x509.flang` | 380642 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 272 | да (272 прим., 600 гран.) |
| `flang/stdlib/образцы.flang` | 119638 | да | `flang_runtime.h:652: error: unsupported feature: function returning a struct or union (consider adding option [-fstruct-passing])` | да | структуры по значению — ключ CompCert `-fstruct-passing` | 124 | да (124 прим., 600 гран.) |

</details>

