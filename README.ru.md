[English](README.md) · **Русский**

# flang

`flang` — небольшой проверяемый язык программирования. В нём есть суммы типов,
списки, строки как данные, рекурсия и сопоставление с образцом — и он делит
каждую программу на два класса, для одного из которых компилятор доказывает
завершаемость. Программы доказанного класса печатаются в C, Go и JavaScript и
работают нативно.

Язык вырос из **FTS (Formal Type Surface)** — языка исполняемых спецификаций,
который лежит в этом же репозитории: отступная поверхность без скобок, где
модель `.fts` объявляет объекты предметной области, детерминированные утилиты с
правилами, проверяемые свойства, исполняемые примеры, морфизмы и
машинно-проверяемые свидетельства. В FTS намеренно нет ни сумм типов, ни
коллекций, ни рекурсии, ни строк как данных. flang добавляет ровно это — и
сохраняет каждую существующую модель `.fts` валидной программой flang.

```flang
модуль «Списки»

тотальная функция «Длина»
  принимает элементы: список числа
  возвращает число
  пример «Три элемента»
    дано элементы равно [7, 8, 9]
    ожидается 3
  разбор элементов
    случай пусто
      то 0
    случай голова и хвост
      то 1 плюс «Длина» от хвоста
```

## Как связаны FTS и flang

Это тот вопрос, на который раскладка репозитория сама по себе не отвечает,
поэтому он разобран здесь явно.

- **FTS — это поверхность.** Её эталонная реализация — TypeScript в
  [`src/`](src) (3 155 строк), который компилирует текст `.fts` в один
  канонический JSON `FtsDocument`. Всё остальное в мире FTS — проверка,
  исполнение утилит, кодогенерация, сертификаты доказательств, MCP-сервер,
  инструменты в [`tools/`](tools) — читает этот документ, а не внутренности
  парсера.
- **flang — это язык.** Его реализация — JavaScript в
  [`flang/src/`](flang/src): лексер, парсер, проверка типов, анализ
  тотальности, интерпретатор, связывание модулей и три бэкенда печати
  (JavaScript, C99, Go). Спецификация — [`flang/SPEC.md`](flang/SPEC.md).
- **FTS компилируется в flang.** [`flang/src/compat.mjs`](flang/src/compat.mjs)
  переводит `FtsDocument` в AST flang: объект → запись, утилита → тотальная
  функция, правила → цепочка `если`, свойства → постусловия, примеры → примеры.
  `npm test` каждый раз перепроверяет этот перевод дифференциально против ядра
  на TypeScript на всех моделях репозитория — на этом слепке: 19 файлов,
  22 утилиты, **19 593 входа, ноль расхождений**, включая коды диагностик.
- **На flang переписывается сам FTS.** [`flang/core/`](flang/core) — это ядро
  FTS (лексер, парсер, вычислитель, печать JSON, 3 444 строки), написанное на
  самом flang по контракту [`flang/core/SPEC.md`](flang/core/SPEC.md). Цель
  записана там же: напечатать ядро в C и получить нативный `fts` без Node. Это
  стало возможно только потому, что flang сделал строки данными: в FTS строка —
  тип поля, а не значение, над которым можно вычислять, а парсер — это
  вычисления над строками.

**Что не решено — прямым текстом.** Ядро на TypeScript до сих пор является
рабочей реализацией FTS и эталоном, по которому сверяется переписывание на
flang, а не наоборот. `flang/core/` воспроизводит его, но пока не заменяет:
скобочный диалект не разбирается (53 модели корпуса из 56 сходятся побайтово,
оставшиеся три написаны на скобках), `executeUtility` и `testUtilities` остаются
только в ядре, а каждое расхождение записано долгом в `flang/core/SPEC.md`.
Пакет в npm по-прежнему называется `@digitable/fts`. То есть репозиторий назван
по языку, которым он становится, а значительная часть его содержимого — всё ещё
инструментарий FTS.

## Два класса функций

Полнота по Тьюрингу и гарантия завершения несовместимы, поэтому flang не
выбирает одно: он делит программы, и деление проверяет компилятор.

| | `тотальная` | обычная |
|---|---|---|
| рекурсия | только структурно убывающая | любая |
| завершаемость | доказана компилятором | не гарантируется |
| примеры-тесты | гарантированно завершаются | могут упереться в лимит шагов |
| печать в C / Go | да | только JavaScript |
| годится для факт-чекинга | да | нет |

Недоказанное убывание — ошибка `FLANG_NOT_TOTAL`, а не предупреждение. Любая
модель `.fts` целиком лежит в тотальном классе, поэтому совместимость
проверяется, а не декларируется.

## Быстрый старт

Нужен Node.js 20 или новее.

```bash
npm install
npm test
npm run build
```

flang:

```bash
node flang/bin/flang.mjs check flang/stdlib/lists.flang
node flang/bin/flang.mjs test  flang/examples/leetcode/509-fibonacci-number.flang
node flang/bin/flang.mjs ast   flang/stdlib/strings.flang --pretty
node flang/bin/flang.mjs emit  flang/examples/leetcode/509-fibonacci-number.flang \
  --target c --out generated
```

Тот же CLI принимает модель FTS, потому что файл `.fts` — это программа flang
(этот путь идёт через мост совместимости, поэтому сначала `npm run build`):

```bash
node flang/bin/flang.mjs check examples/utilities/discount.fts
```

FTS:

```bash
node dist/src/cli.js pipeline examples/real-world/order-shipment.fts --pretty
node dist/src/cli.js certify  examples/real-world/order-shipment.fts \
  --context examples/real-world/order-shipment.context.json --pretty
node dist/src/cli.js test examples/utilities/discount.fts --pretty
node dist/src/cli.js run  examples/utilities/discount.fts \
  --utility "Рассчитать скидку" --input examples/utilities/discount.input.json --pretty
node dist/src/cli.js generate examples/utilities/discount.fts --out generated
```

У всех CLI репозитория один контракт: результат — JSON в stdout, диагностика —
JSON в stderr, отказ — ненулевой код возврата. Поэтому их можно составлять в
командной строке, в CI, в редакторах и в агентных средах.

## Печать в C, Go и JavaScript

`flang emit --target c|go|js` печатает целую программу в целевой язык. Без
`--out` файлы уходят в stdout вместе с путями, с `--out` записываются в каталог.

У бэкенда C есть свой рантайм значений, арена, работа с UTF-8
([`flang/src/emit/c/`](flang/src/emit/c)) и `Makefile`; напечатанные исходники
собираются обычным компилятором C99, и получившийся бинарник обязан отвечать
ровно то же, что интерпретатор, — то же значение и тот же код ошибки. Это
совпадение и есть тест, а не надежда: `flang/test/emit-c.test.mjs` и
`emit-go.test.mjs` прогоняют оба движка по стандартной библиотеке и корпусу
LeetCode и сравнивают.

Два решения, которые стоит знать до чтения сгенерированного кода: числа — IEEE-754
double, а равенство — `Object.is`, дословно как в ядре FTS; индексация строк —
с 1 и по кодовым точкам, потому что поверхность языка предметная и «первый
символ» в ней означает первый.

## Инструментарий FTS

Ядро компилирует один файл. Девять инструментов в [`tools/`](tools) стоят на его
публичном API и добавляют слои над отдельным документом. Это обычные ES-модули
над `dist/src`, поэтому сначала `npm run build`.

- [`ftsc`](tools/ftsc/README.md) — компилятор проекта: деревья `.fts`-модулей,
  импорты между категориями, проверенные функторы между предметными областями и
  кодогенерация на **восемь** языков (C, Rust, C#, Java, Elixir, Go, Python,
  TypeScript). Спецификация — [`tools/ftsc/SPEC.md`](tools/ftsc/SPEC.md).
- [`ftsvm`](tools/ftsvm/README.md) — исполнитель: гоняет утилиты по IR `ftsc`
  интерпретацией или JIT-компиляцией в JavaScript и несёт политики супервизии,
  выраженные моделями FTS.
- [`ftspec`](tools/ftspec/README.md) — проверка целостности требований до
  реализации: конфликты между спецификациями, инвариантами конституции и
  принятыми решениями.
- [`ftsls`](tools/ftsls/README.md) — языковой сервер: один LSP даёт поддержку
  `.fts` в VS Code, Neovim, JetBrains, Zed, Emacs и Helix.
- [`ftsmap`](tools/ftsmap/README.md) — карта покрытия правил: раскрашивает
  пространство входов утилиты по применимым правилам и показывает то, чего в
  правилах нет вовсе.
- [`ftsynth`](tools/ftsynth/README.md) — синтез моделей FTS из исторических
  решений; популяция состоит из правил FTS, поэтому результат — читаемая
  исполняемая спецификация, а не чёрный ящик.
- [`gasearch`](tools/gasearch/README.md) — эволюционный поиск, у которого
  фитнес-функция и ограничения записаны утилитой FTS и проверяются до старта.
- [`gacascade`](tools/gacascade/README.md) — каскад GA0 → GA1 → GA2 для
  планирования итерации.
- [`locate`](tools/locate/README.md) — одна реализация ответа «в какой строке и
  колонке эта диагностика», общая для `ftsls` и GitHub Action.

```bash
node tools/ftsc/bin/ftsc.mjs check tools/ftsc/stdlib
node tools/ftsc/bin/ftsc.mjs build tools/ftsc/stdlib --target rust --out generated
node tools/ftsvm/bin/ftsvm.mjs bench --quick
node tools/ftspec/bin/ftspec.mjs check tools/ftspec/examples/clean
```

`npm test` прогоняет ядро, инструменты и flang; `npm run test:ftsc`,
`test:ftsvm`, `test:ftspec` и `test:flang` — по одному набору. `npm run test:fast`
пропускает бэкенды, `npm run test:backends` гоняет только их. Тесты бэкендов
собирают сгенерированный код настоящим тулчейном и пропускаются поимённо, когда
его нет; дополнительные каталоги поиска берутся из `FTS_TOOLCHAIN_PATH`.

Пропущенный тест — не пройденный тест. Там, где тулчейн обязан быть установлен
(CI, релизная машина), ставится `FTS_REQUIRE_TOOLCHAINS`: `1` требует все
бэкенды, `rust,go` — перечисленные, и отсутствующий компилятор тогда роняет тест
по имени, а не пропускается молча.

## API библиотеки

```ts
import { compile, executeUtility, generateTypeScript, testUtilities, validate } from "@digitable/fts"

const document = compile(source)
const checked = validate(document)
const tests = testUtilities(document)
const generated = generateTypeScript(document)
```

Канонический формат обмена описан в
[`schema/document.schema.json`](schema/document.schema.json). У ядра нет ни
рантайм-зависимостей, ни ввода-вывода из библиотечного API. Браузерные
приложения импортируют `@digitable/fts/browser` — разбор, проверка и
визуализация без криптографии Node.js; строгие решения по сертификатам остаются
на сервере.

## ИИ-агенты

`node dist/src/mcp.js` запускается как MCP-сервер поверх stdio и отдаёт десять
read-only инструментов: `fts_compile`, `fts_check`, `fts_test`, `fts_generate`,
`fts_execute`, `fts_prove`, `fts_visualize`, `fts_certify`, `fts_verify`,
`fts_pipeline`. В результате едут и `structuredContent`, и текстовый блок JSON.
См. [Agent integration](docs/agents.md).

## Документация

Правило именования: файл `.md` без языкового суффикса — английский, `X.ru.md` —
его русская версия; единственное исключение — `README.md` и `SPEC.md` рядом с
кодом остаются под этими именами на том языке, на котором написаны, потому что
GitHub показывает их как титульную страницу каталога.

Не у каждого документа есть обе версии; язык отмечен ниже.

- [`flang/SPEC.md`](flang/SPEC.md) — спецификация flang (ru).
- [`flang/core/SPEC.md`](flang/core/SPEC.md) — контракт ядра FTS на flang вместе
  со списком долгов (ru).
- [Справочник языка](docs/language.ru.md) — поверхность FTS (ru).
- [Как работает FTS](docs/how-it-works.ru.md) — рабочий цикл (ru).
- [Architecture](docs/architecture.md) — модули и ограничения FTS (en).
- [Adoption](docs/adoption.md) — как приложение встраивает FTS (en).
- [Agent integration](docs/agents.md) — соглашения MCP и CLI (en).
- [Исполняемые утилиты](docs/executable-utilities.ru.md) (ru),
  [FTS на прикладных примерах](docs/examples.ru.md) (ru),
  [Зачем нужен FTS и как его интегрировать](docs/why-and-integration.ru.md) (ru).

Работающие интеграции: [CLI-утилита на Node.js](examples/integrations/node/discount-cli.mjs),
[HTTP-сервис на Node.js](examples/integrations/node/discount-http-server.mjs),
[калькулятор на React](examples/integrations/react/FtsDiscountCalculator.tsx),
пример на React поверх общей формы [`FtsForm`](examples/integrations/react/DigitableFtsDiscountForm.tsx)
и [клиент на Python](examples/integrations/python/calculate_discount.py).

Обе поверхности FTS отступные и без скобок; сравните
[`examples/utilities/discount.fts`](examples/utilities/discount.fts) и
[`examples/utilities/discount.en.fts`](examples/utilities/discount.en.fts). Весь
авторский исходник FTS пишется в `.fts`, весь авторский исходник flang — в
`.flang`; JSON — единственная форма обмена.

## Производительность

```bash
npm run benchmark
```

Воспроизводимый стенд и зафиксированная база на Apple M1 Max лежат в
[`benchmarks/`](benchmarks/README.md). В этой базе синтетическая модель FTS с
1000 полей и 1000 правил компилируется в среднем за 4.36 мс и проверяется за
1.02 мс; исполнение 1000 срабатывающих правил занимает 0.0157 мс. Это
микробенчмарки, а не обещание про сборщик или `tsc` конкретного приложения.

## Состояние

`0.x`. Канонический JSON и коды диагностик считаются поверхностями
совместимости; синтаксис растёт через задокументированные предложения.

`npm test` прогоняет три набора. На этом слепке, с Node 24, при наличии `cc`,
`javac` и `python3`:

| Набор | Тестов | Прошло | Упало | Пропущено |
|---|---:|---:|---:|---:|
| `test:core` — ядро FTS на TypeScript | 59 | 59 | 0 | 0 |
| `test:tools` — девять инструментов в `tools/` | 402 | 392 | 0 | 10 |
| `test:flang` — язык | 1073 | 1050 | 0 | 23 |
| **всего** | **1534** | **1501** | **0** | **33** |

Каждый пропуск — отсутствующий нативный тулчейн, и он назван поимённо. Здесь не
было Rust, C#, Elixir и Go, поэтому пропустились соответствующие тесты бэкендов
`ftsc` и все 23 теста Go у flang; C, Java, Python, TypeScript и JavaScript были
на месте, поэтому эти бэкенды по-настоящему собрали сгенерированный код и
прогнали его.

Что работает сегодня: фронтенд flang (лексер, парсер, проверка типов, анализ
тотальности, связывание модулей) и интерпретатор; бэкенды JavaScript и C — оба
здесь сверены с интерпретатором на стандартной библиотеке и корпусе LeetCode;
бэкенд Go, чьи сверочные тесты требуют тулчейн Go и на этой машине
пропустились; `flang check | run | test | facts | ast | emit`; мост FTS → flang,
сверенный дифференциально на 19 593 входах; все четыре слоя ядра FTS в
`flang/core/`, связанные в одну программу и сверенные с ядром на TypeScript.

Что пока нет: `flang/core/` не заменяет `src/` — скобочный диалект FTS не
разбирается, и долги из `flang/core/SPEC.md` (нет нормализации NFC, нет колонки
в части диагностик, нет `executeUtility` и `testUtilities`) открыты. Пакет не
опубликован: в `package.json` стоит `"private": true`, а `@digitable/fts` в
реестре npm нет, поэтому все команды выше запускаются через `node` из клона.

## Лицензия

BSD 2-Clause. В [LICENSE](LICENSE) лежит дословный текст лицензии и ничего
больше. [LICENSE-RU.md](LICENSE-RU.md) объясняет намерение по-русски и
юридической силы не имеет.

Ранние версии выходили под Apache-2.0, унаследованной от исходного репозитория,
а не выбранной. Все, кто получил код под Apache-2.0, сохраняют эти права;
изменение относится к последующим версиям.
