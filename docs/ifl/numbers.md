# Числа подачи и команды, которые их печатают

Правило одно: **в статье нет ни одной цифры, которой нет в этой таблице.**
Все числа получены прогоном на машине владельца 10 августа 2026;
среда прогона печатается разделом 0 скрипта `docs/ifl/reproduce.sh`.

Среда: Linux 6.8.0 x86_64, 8 ядер, 31 ГиБ ОЗУ, Node v24.18.0,
`cc (Ubuntu 13.3.0-6ubuntu2~24.04.1) 13.3.0`, ветка `docs/ifl-submission`
от `969be9f`.

Всё сразу: `bash docs/ifl/reproduce.sh` (около 6 минут),
без самой долгой части: `bash docs/ifl/reproduce.sh --fast`.

## Самоприменение

| Число | Значение | Команда |
|---|---|---|
| строк в исходниках компилятора на flang | 17 370 | `cat flang/self/*.flang flang/self/bootstrap/*.flang \| wc -l` |
| байт в них же | 1 654 076 | `cat flang/self/*.flang flang/self/bootstrap/*.flang \| wc -c` |
| функций в связанном компиляторе | 1 586 | `node docs/ifl/facts.mjs` |
| из них тотальных | 1 037 | там же |
| из них обычных | 549 | там же |
| из них с объявленной мерой | 0 | там же |
| типов | 170 | там же |
| диагностик связывания / типов / завершаемости | 0 / 0 / 0 | там же |
| файлов C, которые печатает бэкенд | 7 | там же |
| байт напечатанного C | 5 814 671 (5,55 МиБ) | там же |
| программ в корпусе побайтовой сверки | 43 | там же |
| тестов в проверке неподвижной точки | 22, из них 0 падений, 0 пропусков | `FTS_REQUIRE_TOOLCHAINS=c node --test flang/test/self-bootstrap.test.mjs` |
| время этой проверки | 215 795 мс (≈216 с) | там же, строка `duration_ms` |
| файлов C, совпавших побайтово у эталона, flang₁ и flang₂ | 7 | там же, строка `ℹ неподвижная точка сошлась: 7 файлов…` |
| флаги сборки C | `-std=c99 -Wall -Wextra -Werror -pedantic` | `flang/test/self-bootstrap.test.mjs:95` |
| сломанных программ в сверке диагностик | 7 | `node -e` по списку `СЛОМАННЫЕ` в `flang/test/self-bootstrap.test.mjs:528` |
| различных кодов диагностик, которые они дают | 6: `FLANG_TYPE`, `FLANG_UNKNOWN_NAME`, `FLANG_MATCH_NOT_EXHAUSTIVE`, `FLANG_MATCH_UNREACHABLE`, `FLANG_BUILTIN_ARGS`, `FLANG_NOT_TOTAL` | там же |
| разбивка корпуса из 43 | 10 stdlib + 1 example + 26 leetcode + 4 core + 2 self | `ls flang/stdlib/*.flang flang/examples/*.flang flang/examples/leetcode/*.flang \| wc -l` |
| пределы памяти, которые ставит сам тест | 1 ГиБ на крупнейший исходник, 4 ГиБ на весь компилятор | `flang/test/self-bootstrap.test.mjs:1097,1111` |

Числа 1 489 функций, 165 типов, 3,96 МБ C и 36 программ, которые стоят в
`flang/self/SPEC.md:73-80`, **устарели**: их печатал более ранний компилятор.
В статью идут числа прогона, а не документа. Расхождение стоит починить в
SPEC отдельным коммитом — к подаче оно отношения не имеет.

## Мера и тотальность

| Число | Значение | Команда |
|---|---|---|
| файлов `.flang` в репозитории | 98 | `find . -name '*.flang' -not -path './node_modules/*' \| wc -l` |
| объявлений `тотальная функция` | 1 708 | `grep -rh '^тотальная функция ' --include='*.flang' . \| wc -l` |
| объявлений `функция` (обычных) | 577 | `grep -rh '^функция ' --include='*.flang' . \| wc -l` |
| объявлений `убывает` (мера) | 2 | `grep -rh '^[[:space:]]*убывает ' --include='*.flang' . \| wc -l` |
| где именно объявлена мера | `flang/examples/measure/euclid.flang`, `flang/examples/measure/binary-search.flang` | `grep -rln '^[[:space:]]*убывает ' --include='*.flang' .` |
| тестов меры, ограниченности и завершаемости | 99, из них 0 падений | `node --test flang/test/measure.test.mjs flang/test/bounded.test.mjs flang/test/totality.test.mjs` |
| время этих тестов | 237 мс | там же |
| исполнителей, сверенных на одной мере | 9 (интерпретатор + 8 целей) | `bash docs/ifl/measure-across-targets.sh` |
| длина диагностики `FLANG_MEASURE` | 573 байта | там же |
| различных ответов среди девяти | 1 | там же |
| три условия сторожа меры | строго убыла, не ниже нуля, целая | `flang/SPEC.md:283-287` |

## Что напечатанный код НЕ держит

| Утверждение | Как проверено |
|---|---|
| у бэкенда JS нет ни предела шагов, ни предела глубины, ни `FLANG_RECURSION_LIMIT`; у остальных семи всё три есть | раздел 4 `docs/ifl/reproduce.sh` — печатает «Вечно» во все восемь целей и ищет счётчики в тексте |
| признано самим бэкендом | `flang/src/emit/js.mjs:52-57` |
| конкурентность печатают 2 цели из 8 | `grep -l '\.processes' flang/src/emit/*.mjs` → `c.mjs`, `elixir.mjs` |
| остальные шесть выбрасывают процессы молча, код возврата 0 | `for t in go rust python java csharp js; do node flang/bin/flang.mjs emit flang/conc/examples/budget.flang --target $t >/dev/null; echo "$t код=$?"; done` |
| замкнутое множество отказов — пять видов | `node -e 'import("./flang/src/failures.mjs").then(м => console.log(Object.values(м.КОДЫ_ОТКАЗА)))'` |
| `FLANG_MEMORY` рантайм C выдаёт, а в множестве его нет | `grep -n FL_CODE_MEMORY flang/src/emit/c/flang_runtime.h` (строка 228) плюс проверка вхождения в множество — раздел 4 скрипта |
| в C сторож глубины — счётчик кадров на стеке главного потока; семь остальных целей заводят поток с большим стеком | `grep -n 'pthread\|setrlimit\|RLIMIT_STACK' flang/src/emit/c/*.c` (пусто) против `flang/src/emit/rust/flang_cli.rs:34-51`, `flang/src/emit/java/Flang.java:50,72`, `flang/src/emit/csharp/Flang.cs:53,64`, `flang/src/emit/python/flang_runtime.py:439,456-479` |
| рабочего параллельного режима на потоках ОС нет | `flang/conc/SPEC.md:12-15`, `flang/conc/SPEC.md:1549-1552`, `flang/conc/RESILIENCE.md:940-972`; `grep -rn pthread flang/src/emit/c/` пусто |
| самоприменённый двоичный файл не умеет вычислять — только проверять и печатать C | `README.md:114-126` |

## Набор тестов целиком

| Набор | Команда | tests | pass | fail | skipped | duration_ms |
|---|---|---:|---:|---:|---:|---:|
| core | `node --test dist/test/*.test.js` | 71 | 71 | 0 | 0 | 2 847 |
| tools | `node --test tools/*/test/*.test.mjs` | 420 | 420 | 0 | 0 | 44 415 |
| flang | `node --test flang/test/*.test.mjs` | 2 272 | 2 269 | **3** | 0 | 423 031 |
| **всего** | `npm test` | **2 763** | 2 760 | **3** | 0 | |

**Про «2763 теста на восьми тулчейнах».** Число верное и совпадает с прогоном,
но в репозитории оно нигде не записано: `grep -rn '\b2763\b'` не находит его ни
в README, ни в CI, ни в журнале. Восемь тулчейнов на этой машине действительно
стоят все восемь, и пропусков ноль (`node scripts/preflight.mjs` → «Проверяется
по-настоящему: 8 из 8 … препятствий нет»). Но:

- **три теста сейчас падают**, и «2763 зелёных» было бы неправдой:
  `flang/test/changelog.test.mjs:64` (каталог `flang/scripts` не внесён в список
  `ВИДИМОСТЬ` в `scripts/build-changelog.mjs` — настоящий дефект ветки) и два в
  `flang/test/emit-elixir.test.mjs` (отрицательный ноль на OTP 25);
- **чужими руками восемь тулчейнов не воспроизводятся через CI**:
  `.github/workflows/ci.yml` гоняет только `ubuntu-latest` × Node 20/22/24,
  тулчейны не ставит и `FTS_REQUIRE_TOOLCHAINS` не выставляет — значит
  отсутствующий тулчейн даёт там молчаливый пропуск, а не падение;
- **«восемь целей» — это два разных списка**: у `flang` восьмая цель
  JavaScript, у `ftsc` — TypeScript. Оба списка по восемь, и спутать их легко.

Поэтому в статью идёт формулировка «2 763 теста, из них 2 760 проходят на
машине с восемью установленными тулчейнами», а не «2 763 зелёных на восьми».

## Что воспроизводимо чужими руками, а что нет

| Воспроизводится где угодно | Нужна наша машина или ручная установка |
|---|---|
| `npm test` на Node ≥ 20 без тулчейнов (тесты бэкендов честно пропустятся) | прогон без единого пропуска: нужны cc, go, cargo, python3, javac, dotnet, elixir — CI их не ставит |
| неподвижная точка: нужен только `cc` | сверка девяти исполнителей: нужны все восемь тулчейнов |
| `docs/ifl/facts.mjs`, `docs/ifl/measure-across-targets.sh --fast` | `scripts/test-remote.sh` — ходит по ssh на приватный хост владельца, посторонний его не запустит |
| `.github/workflows/ci.yml` на форке | числа 252 с / 15 с из `CONTRIBUTING.md` — они с того же приватного хоста |
