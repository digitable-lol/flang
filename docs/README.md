# Документация flang

Указатель по каталогу `docs/`. Файл `.md` без языкового суффикса — английский или
русский по тому, на каком написан; файл с окончанием .ru.md — русская редакция одноимённого .md. `README.md` и
`SPEC.md` рядом с кодом называются так, потому что GitHub показывает их титульной
страницей каталога.

## Язык

| Файл | О чём |
|---|---|
| [`DESCRIPTION.md`](DESCRIPTION.md) | описание языка целиком: каждая конструкция с примером, команды, файл настроек, ограничения |
| [`site/language.ru.md`](site/language.ru.md) | справочник конструкций: как пишется каждая |
| [`glossary.md`](glossary.md) | все слова языка на четырёх поверхностях записи; печатается из таблицы лексера |
| [`surfaces.md`](surfaces.md) | четыре поверхности записи: русская, английская, эсперанто, китайская |
| [`number-kinds.md`](number-kinds.md) | виды чисел и законы арифметики, которые ядро доказывает о каждом |
| [`four-coverages.md`](four-coverages.md) | четыре покрытия доказанности и что каждое значит |
| [`ru-grammar.md`](ru-grammar.md) | русская морфология для силлогизмов: опытный модуль |
| [`flang/`](flang) | контракты слоёв: `SPEC.md` языка, ядра доказательств, процессов, ядра вычислителя; [доводы против аксиом в ядре](flang/proof/axioms.md) |
| [`ct/`](ct/README.md) | контракты категорной записи: правила, множества, законы |
| [`specifications/`](specifications/README.md) | язык доказательств и слой отказов |
| [`fspec/`](fspec/clarifications.md) | уточнения к спецификациям пакетов `fspec/` |

## Учиться

| Каталог | О чём |
|---|---|
| [`site/`](site) | страницы сайта документации и код его сборки (`bootstrap/flang run-script site:build`) |
| [`guide/`](guide) | руководства: тотальность, ограничения, настройки, имена, раскладка проекта, круг раскрутки, MCP, цель TypeScript, перевод кода на C в flang |
| [`course/`](course/README.md) | курс по главам с упражнениями |
| [`tutor/`](tutor/README.md) | уроки `flangtutor` |
| [`examples/`](examples/README.md) | программы-примеры: от одной функции до службы на процессах |
| [`editors/`](editors) | подсветка и языковой сервер для Vim и VS Code |

## Планы и решения

| Файл | О чём |
|---|---|
| [`ROADMAP.md`](ROADMAP.md) | дорожная карта: что есть, чего нет, куда язык идёт |
| [`road-to-1-0.md`](road-to-1-0.md) | условия выпуска 1.0 и что осталось по каждому |
| [`adr/`](adr) | принятые решения: задача, решение, что оно ломает |
| [`tasks/`](tasks/README.md) | открытые задачи, одна задача — один файл |
| [`templates/`](templates) | шаблоны задачи и заметки к выпуску |
| [`release-notes.json`](release-notes.json) | заметки к выпускам; из них печатаются тело релиза и страница выпусков |

## Тем, кто развивает язык

| Файл | О чём |
|---|---|
| [`repository-layout.md`](repository-layout.md) · [ru](repository-layout.ru.md) | раскладка репозитория |
| [`bootstrap-point.md`](bootstrap-point.md) | каталог `bootstrap/`: компилятор, напечатанный в C99 |
| [`commit-messages.md`](commit-messages.md) | правило сообщений коммитов |
| [`zero-bug-policy.md`](zero-bug-policy.md) | что делается с дефектом |
| [`prose-numbers.md`](prose-numbers.md) | числа в прозе и их приметы |
| [`reprint-cost.md`](reprint-cost.md), [`reprint-runs-start-from-a-clean-tree.md`](reprint-runs-start-from-a-clean-tree.md) | перепечатка семени: цена и порядок захода |
| [`scheduler-benchmark.md`](scheduler-benchmark.md) | сколько процессов держит планировщик |
| [`benchmarks/`](benchmarks/README.md) | приборы замеров: цена доказательства, скорость, кеш приговоров |

## Записи, которые читают проверки

| Файл | Кто читает |
|---|---|
| [`tree-inventory.md`](tree-inventory.md) | опись дерева по языкам — `bootstrap/flang run-script inventory:check` |
| [`ci-inventory.md`](ci-inventory.md) | опись проверок CI |
| [`javascript-inventory.md`](javascript-inventory.md) | опись JavaScript в дереве |
| [`jargon.json`](jargon.json) | внутренние слова и тексты для читателя — `bootstrap/flang run-script jargon:check` |
| [`reprint-ledger.tsv`](reprint-ledger.tsv) | ведомость заходов перепечатки |
| [`eight-targets-renames.tsv`](eight-targets-renames.tsv) | переименования объявлений по целям печати |

[`README.ru.md`](README.ru.md) — русская редакция корневого `README.md`, а не этой страницы.
