---
номер: 6921
заголовок: docs/ читается как дневник проекта, а не как руководство по языку — раскладка, классификация всех файлов и план
статус: в работе
приоритет: P1
исполнитель: a
ветка: a/docs-are-a-manual-not-a-diary
команда: вторая
карта: Что мешает больше всего
рядом: 1433, 0037, 6518
нужность: 1 — владелец: «обновить README, актуализировать DESCRIPTION.md и все docs от нейрослопа вычистить и исторических данных, чтобы дока была как у эликсира условного»; замер по дереву ниже
---

# 6921. docs/ читается как дневник проекта, а не как руководство по языку

## Чем измерено

Дерево `gh/dev` `f05a9e2a2`, выпуск 0.7.23. Счёт файлов — `git ls-files docs`;
ссылки — `git grep -F` по имени файла в `scripts/`, `flang/scripts/`, `.github/`,
`.githooks/`, `docs/site/sitemap.*`, `ярлыки.flang`, в исходниках `flang/**`,
в `README.md`/`AGENTS.md`/`.ai/`, в `docs/jargon.json`; приметы — `grep -c СНЯТО`
по файлу.

В `docs/` 2052 файла. Вне четырёх каталогов, которые эта задача не судит
(`tasks` 537, `zettel` 724, `adr` 47, `examples` 321), — 423 файла. Каждый из
них отнесён к одному из трёх классов:

| класс | что это | файлов |
|---|---:|---:|
| A — руководство | то, что читает пользователь языка | 195 |
| B — рабочие записи, которые читают инструменты | описи, реестры долга, шаблоны, приборы замеров, код сборки сайта | 133 |
| C — отчёты и дневники | датированные замеры, передачи, ревизии, «дорога до…», архив, проектные записки | 95 |

### A — руководство (195)

| место | файлов | что там |
|---|---:|---|
| `docs/site/*.md` | 83 | страницы сайта: начало, справочники языка, библиотеки, команд, отказов, доказательства, примеры, выпуски |
| `docs/guide/` | 25 | тотальность, ограничения, настройки, именование, раскладка, круг раскрутки, MCP, TypeScript, бизнес-требования |
| `docs/flang/` | 9 | контракты: `SPEC.md`, `proof/SPEC.md`, `concurrency/{SPEC,DISTRIBUTED,RESILIENCE,README}.md`, `core/SPEC.md`, `self/SPEC.md`, `ct/README.md` |
| `docs/editors/` | 29 | плагины Vim и VS Code, linguist, их README |
| `docs/course/` | 19 | четырнадцать глав курса, его проверка `check.flang` и отчёт проверки |
| `docs/tutor/` | 13 | двенадцать уроков `flangtutor` и README |
| `docs/ct/` | 4 | контракты категорной записи |
| `docs/fspec/` | 1 | `clarifications.md` |
| корень `docs/` | 12 | `DESCRIPTION.md`, `README.md`, `README.ru.md`, `glossary.md`, `surfaces.md`, `commit-messages.md`, `zero-bug-policy.md`, `repository-layout{,.ru}.md`, `prose-numbers.md`, `four-coverages.md`, `reprint-runs-start-from-a-clean-tree.md` |

### B — записи для инструментов (133)

| место | файлов | кто читает |
|---|---:|---|
| `docs/site/` не-`.md` | 25 | сборка сайта (`build.mjs`, `sitemap.*`, `numbers.*`, поиск, подсветка, стиль) |
| `docs/flang/proof/checker/**/README*.md` | 34 | описания семейств проб чекера; проверки чекера |
| `docs/benchmarks/` | 23 | приборы замеров; `scripts/` 20 ссылок, `flang/scripts/` 2, `.github/` 1, ярлыки 1 |
| `docs/benchmark/`, `docs/benchmark2/` | 42 | материал двух замеров цены доказательства; `scripts/` 42 и 41 ссылки |
| `docs/templates/` | 2 | шаблон задачи и заметки к выпуску |
| корень `docs/` | 7 | `jargon.json` (сторож жаргона), `release-notes.json` (печать страницы выпусков, 23 ссылки), `reprint-ledger.tsv` (13), `eight-targets-renames.tsv` (реестр рукописных перечней), `tree-inventory.md` (18 ссылок, 36 примет), `javascript-inventory.md` (8, 3 приметы), `ci-inventory.md` (10, 1 примета) |

### C — отчёты и дневники (95)

Корень `docs/` — 44 файла. Столбцы: строк; ссылки из `scripts/` (s),
`flang/scripts/` (fs), `.github/` (gh), `sitemap.*` (sm), исходников `flang/**`
(src), `README.md`+`AGENTS.md`+`.ai/` (r), `jargon.json` (j); приметы «СНЯТО»
(m). Решение — что сделано этой веткой или что делать дальше.

| файл | строк | s | fs | gh | sm | src | r | j | m | решение |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| audit-2026-09-11 (удалён) | 227 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | удалён |
| categorical-search-measurement (удалён) | 411 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | удалён |
| cost-of-extension (удалён) | 581 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | удалён |
| hacker-news-readiness (удалён) | 372 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | удалён |
| http-boundary (удалён) | 228 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | удалён |
| lessons-2026-08-23 (удалён) | 100 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | удалён |
| HANDOVER (удалён) | 74 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | удалён; две ссылки в `guide/naming*.md` сняты |
| what-the-prover-lacks (удалён) | 252 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | удалён; ссылка в `binder-goal-share.md` снята |
| `print-cost-measured.md` | 331 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | улика открытой задачи 5709: вложить в задачу, удалить |
| `shell-to-flang-census.md` | 448 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | улика задач 3811 и 5821: вложить в 5821, удалить |
| `tree-layout-audit.md` | 444 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | улика задачи 1433: вложить в 1433, удалить |
| `kernel-ledger.md` | 286 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | улика задачи 1310: удалить, когда задача закрыта |
| `lockfile-without-store.md` | 238 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | ссылка из ADR-0021: заменить в ADR на хеш коммита, удалить |
| `body-shapes.md` | 315 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | верные факты (к чему цепляется индукция) уже в `site/which-construct`; удалить, сняв ссылку оттуда |
| `lean-checks-the-inference-rules.md` | 362 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | что проверяет Lean — один абзац в `site/what-is-proved`; удалить |
| `three-print-waves-measured.md` | 163 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | удалить вместе с ссылками из `design/fmath-first-ten-statements.md` и `road-to-one-hundred-measured.md` |
| `HANDOFF.md` | 517 | 0 | 0 | 0 | 0 | 0 | 3 | 1 | 0 | снять исключение в `jargon.json` и ссылки из навыков `.ai/`; удалить |
| `four-coverages.md` | 137 | 0 | 0 | 0 | 0 | 0 | 4 | 0 | 2 | это руководство (что значит каждое покрытие): влить в `site/what-is-proved`, ссылки из README — при его переписке |
| `what-provability-gives-today.md` и `what-provability-gives-today.ru.md` | 221, 285 | 0 | 0 | 0 | 0 | 0 | 2, 2 | 0 | 0 | верное — в `site/proofs`; удалить после переписки README |
| `road-to-1-0.md` | 190 | 0 | 0 | 0 | 0 | 0 | 3 | 0 | 1 | один план вместо четырёх: остаётся `ROADMAP.md`; удалить после переписки README и AGENTS |
| `road-to-one-hundred-measured.md` | 452 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | ссылки из `release-notes.json`, `site/releases*`, `site/roadmap*`, `inference-rules.tsv`; перевести в `internal/reports/` |
| `what-blocks-1-0.md` | 1395 | 15 | 21 | 1 | 0 | 1 | 0 | 0 | 1 | сторож `что-мешает:проверка` читает; перевести в `internal/reports/`, сторож — на новый путь |
| `ROADMAP.md` | 532 | 5 | 2 | 1 | 0 | 0 | 6 | 0 | 0 | задачник читает его заголовки (поле `карта`); переписать без дат как план, оставить единственным планом |
| `overview.ru.md` | 581 | 1 | 0 | 0 | 2→0 | 1 | 0 | 2 | 1 | снят с сайта; `flang/self/proof.flang` называет путь — перевести в `internal/reports/` вместе с правкой исходника |
| `benchmark-speed.md` | 995 | 3 | 0 | 0 | 2→0 | 0 | 0 | 2 | 0 | снят с сайта; `internal/reports/` |
| `benchmark-proof-cost.md` | 481 | 0 | 0 | 0 | 2→0 | 0 | 0 | 2 | 0 | снят с сайта; ссылки из `course/`, `flang/proof/SPEC.md`; `internal/reports/` |
| `benchmark-proof-cost-2.md` | 484 | 0 | 0 | 0 | 2→0 | 2 | 0 | 2 | 0 | снят с сайта; `internal/reports/` |
| `scheduler-benchmark.md` | 549 | 0 | 0 | 0 | 2→0 | 7 | 0 | 2 | 0 | снят с сайта; путь стоит в `flang/src/emit/c/*` и `bootstrap/flang_runtime.h` — перенос только с перепечаткой семени |
| `memory-and-regions.md` | 1446 | 0 | 0 | 0 | 2→0 | 0 | 0 | 2 | 0 | снят с сайта; `internal/reports/` |
| `modularity-and-packages.md` | 1083 | 7 | 0 | 0 | 2→0 | 0 | 0 | 2 | 0 | снят с сайта; `internal/reports/` |
| `wasm-via-c.md` | 546 | 0 | 2 | 0 | 2→0 | 0 | 0 | 2 | 0 | снят с сайта; `internal/reports/` |
| `journal-carried-out-of-sources.md` | 14915 | 29 | 0 | 0 | 0 | 0 | 0 | 0 | 4 | реестр комментариев, вынесенных из исходников; `internal/records/` |
| `reprint-cost.md` | 212 | 19 | 2 | 2 | 0 | 2 | 1 | 0 | 0 | сторож свежести читает; `internal/operations/` |
| `reprint-ledger.tsv` | 14 | 12 | 0 | 1 | 0 | 1 | 0 | 0 | 0 | то же |
| `resource-plan.md` | 372 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | `internal/operations/` |
| `gate-rules.md` | 1027 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | правила очереди одной машины; `internal/operations/`, ссылка из AGENTS |
| `memory-and-fan-out.md` | 412 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | `scripts/memory-limit.sh` называет; `internal/operations/` |
| `integer-closed-under-addition.md` | 495 | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | реестр исключений сторожа ссылок называет; `internal/reports/` |
| `native-x86-backend.md` | 568 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | то же |
| `emptiness-of-what-is-proved.md` | 151 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | то же |
| `binder-goal-share.md` | 266 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | `flang/proof/examples/binder-wall-map.flang` называет; `internal/reports/` |
| `lemmas-report.md` | 715 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 0 | `flang/proof/examples/*.flang` называют; `internal/reports/` |
| `proof-goal-map.md` | 620 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 1 | что ядро умеет доказывать — уже на `site/what-the-kernel-accepts`; `internal/reports/` |
| `eight-targets-collision-map.md` | 385 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | приложение к `eight-targets-renames.tsv` (реестр); `internal/reports/` |
| `why-javascript-remains.md` | 190 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | приметы; `internal/reports/` |

Каталоги класса C — 51 файл:

| каталог | файлов | ссылки | решение |
|---|---:|---|---|
| `docs/archive/` | 11 | `scripts/` 3, `flang/scripts/` 2, приметы 6; сторож ссылок называет каталог «историей» | `internal/archive/`, сторож — на новый путь |
| `docs/design/` | 22 | `scripts/` 23, исходники 12, приметы 11 | проектные записки: `internal/design/`, имена английские |
| `docs/спецификации/` | 4 | `scripts/` 4, исходники 1 | то же, вместе с `design/`; имя каталога — латиницей |
| `docs/ifl/` | 6 | `scripts/` 7 | подача на конференцию: `internal/ifl/` |
| `docs/zamer-teorkat/` | 3 | `scripts/` 5, исходники 2 | материал замера: в `internal/benchmarks/` под английским именем |
| `docs/tools/` | 3 | `.github/` 1 | две программы на Python; удалить вместе с `binder-goal-share.md` |
| `docs/releases/` | 2 | `scripts/` 7 | заметки 0.7.13 и 0.7.14 влить в `release-notes.json`, удалить |

## Целевая раскладка

Образец — документация Elixir: «Getting started → Guides → Reference →
Changelog», каждый факт в одном месте, в руководстве нет датированного
повествования.

```
docs/
  README.md              указатель
  DESCRIPTION.md         описание языка целиком, один файл
  getting-started/       установка, первая программа, учебник, редактор, что дальше, неполадки
                         (сейчас: site/install, getting-started, tutorial, editor, learning, troubleshooting; tutor/; course/)
  guides/                по задачам: какую конструкцию брать, доказательства, side effects, процессы,
                         пакеты, встраивание, спеки, настройки, именование, ограничения
                         (сейчас: site/*.md о том же и guide/)
  reference/             язык, библиотека, команды, отказы, операции, словарь, четыре набора слов,
                         контракты (docs/flang, docs/ct)
  changelog/             выпуски: release-notes.json и напечатанная страница
  contributing/          сборка, раскладка, сообщения коммитов, нулевой долг дефектов, числа в прозе,
                         перепечатка, развитие языка
  editors/, examples/    как сейчас
  site/                  только код сборки
  adr/, tasks/, zettel/  как сейчас; на сайт не печатаются
  internal/              не печатается: records/ (описи, реестры, шаблоны), reports/ (отчёты, которые
                         читают сторожа), operations/ (очередь, перепечатка, память машины),
                         benchmarks/, design/, archive/, ifl/
```

Правило переезда: сначала сторожа и ярлыки — на новые пути, потом `git mv`,
одним коммитом на каталог. `docs/zettel/` на сайт больше не печатается: 724
заметки — лабораторный журнал, а не руководство; адреса `knowledge-*.html`
остаются переездами на `contributing.html`.

## Что сделано этой веткой

1. `docs/DESCRIPTION.md` переписан: описание языка на 0.7.23 по разделам, каждый
   пример проходит `bootstrap/flang check`, вывод команд дословный, дат и
   номеров задач нет, ограничения — одним разделом. Слова flang стоят рядом с
   привычными терминами, слова компилятора переведены таблицей.
2. С сайта сняты восемь страниц-отчётов: раздел «Замеры» целиком (скорость,
   цена доказательства дважды, планировщик, память, модульность, WebAssembly) и
   отчёт о доказательствах по дереву. Адреса остались переездами на страницы
   руководства; двойник карты на flang приведён к тем же числам.
3. Удалены восемь отчётов, на которые не ссылается ни сторож, ни карта сайта,
   ни исходник, ни живая страница.
4. С двенадцати страниц руководства (`site/language`, `getting-started`,
   `install`, `packages`, `processes`, `tutorial`, `editor`, `troubleshooting`,
   `diagnostics`, `stdlib`; `guide/totality`, `guide/limits`) сняты даты
   прогонов, версии двоичного и хеши коммитов; технический текст не менялся.

## Что дальше

1. Отчёты, которые читают сторожа и исходники (таблица выше, решение
   «`internal/…`»): переезд каталогом, сторожа — на новые пути.
2. Улики открытых задач (5709, 5821, 1433, 1310) — вложить в задачи, файлы
   удалить.
3. `four-coverages`, `what-provability-gives-today*`, `road-to-1-0` — после
   переписки README (задача идёт параллельно).
4. Один план вместо четырёх: `ROADMAP.md` без дат; `site/roadmap*` снять с
   сайта, `what-blocks-1-0.md` и `road-to-*` — в `internal/reports/`.
5. Оставшиеся страницы с датированным повествованием: `site/cli`,
   `site/what-is-proved`, `site/proofs`, `site/index`, `site/how-proofs-work`,
   `site/spec-catalog`, `site/what-the-kernel-accepts`, `site/shortener`,
   `site/examples`, `site/browser-app`, `site/case-studies`, `site/roadmap`,
   `guide/naming`, `guide/bootstrap-circle`, `guide/project-layout`,
   `guide/business-requirements`, `guide/how-to-write-flang`, `glossary`,
   `surfaces`. Слог — как у `site/which-construct`: слово flang рядом с
   привычным термином, у каждого абзаца — что писать и что делает компилятор.
6. `docs/README.md` переписать указателем по целевой раскладке.
7. `docs/zettel/` снять с сайта.

## Когда задача сделана

`git ls-files docs | grep -v -E '^docs/(tasks|zettel|adr|examples|internal)/'`
называет только файлы руководства, код сборки сайта, плагины редакторов и
`release-notes.json`; `node docs/site/build.mjs --check` — код 0;
`./ярлык ссылки:проверка` не хуже, чем до ветки (66 битых, все в открытых
задачах и контрактах); `grep -l -E '20(25|26)' docs/site/*.md docs/guide/*.md`
называет только напечатанные страницы выпусков и журналов.

## Где живёт правка

`docs/**`, `docs/site/sitemap.mjs`, `docs/site/sitemap.flang`, сторожа в
`scripts/guards/` и `flang/scripts/`, которые называют пути отчётов. Двоичного
не касается.
