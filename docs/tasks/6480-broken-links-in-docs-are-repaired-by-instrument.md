---
номер: 6480
заголовок: Битые ссылки на стволе починены прибором — сторож ссылок зелен в чистой копии
статус: в работе — 33 из 33 доступных ссылок и исключение починены (d51cde45c), 2 ссылки в flang/proof переданы стеку K
исполнитель: a
ветка: a/6480-broken-links-in-docs-are-repaired-by-instrument
команда: вторая
карта: Что мешает больше всего
рядом: 0037, 3017, 5414, 7005
нужность: 1 — `./ярлык ссылки:проверка` красен на самом стволе, и любая ветка наследует красноту: битую ссылку в новой правке не отличить от старой
---

# 6480. Битые ссылки на стволе починены прибором

Найдено 17 сентября 2026 стеком T кластера: `./ярлык ссылки:проверка` в ЧИСТОЙ копии
`main` красен — битых 35 из 7057 (копия c4ada14bf = main cbfaf3899 + коммит взятия задач;
на ветке ADR-0043 — 49 из 7114). Причина по большей части одна: `docs/adr/0036`, `0037`,
`0041` и `docs/design/nositel-tochnogo-celogo.md` ссылаются на старый каталог `tasks/`
после переезда задач в `docs/tasks/` (задача 0037); исключение `core/storefront` в
`scripts/ledgers/link-guard-known-not-a-path.tsv` устарело.

## Чем измерено

- `LC_ALL=C.UTF-8 ./ярлык ссылки:проверка` в чистой копии — код 1, «битых 35 из 7057».
- Список битых ссылок и файлов, где они стоят, снимается тем же прогоном (журнал сторожа).

## Что делается

Правятся ТОЛЬКО адреса ссылок (путь после переезда), не текст документов: ADR о
доказательствах и `docs/design` — стек K, туда идёт только замена пути. Исключение
`core/storefront` в ведомости — снять, если пути нет в дереве и ссылки на него больше нет.

## Как поймём, что сделано

- `./ярлык ссылки:проверка` в чистой копии — код 0; в задаче — таблица «файл → было →
  стало» по каждой из 35 ссылок (число строк названо);
- устаревших исключений в ведомости `link-guard-known-not-a-path.tsv` — 0;
- сторож прозы `sh scripts/guards/prose-numbers-guard.sh` — все приметы сошлись;
  `./ярлык опись:сверка` — код 0; pre-push — 0.

## Что найдено и как починено (17 сентября 2026, ячейка T10, копия wT14)

Прогон `LC_ALL=C.UTF-8 ./ярлык ссылки:проверка` в ЧИСТОЙ копии ствола 4ac13dc99 (main с #58 и #59;
9,5 мин при load 29): код 1, «битых 33 из 7009, устаревших исключений 1». Это список лида
(34 на 475fcc6cc) минус одна ссылка, ожившая после #59. Беды — трёх родов: переезд задач из
`tasks/` в `docs/tasks/` и дальше в `docs/tasks/completed/` без правки адресов (22 ссылки);
пути в кавычках, которые путями не являются, — расширение, иллюстративное имя, проба в рабочем
каталоге (10); одно исключение ведомости, чья цель ожила (1); плюс две ссылки в `flang/proof/**`
(стек K, не правлены).

Таблица — 35 строк: 34 беды лида (33 на 4ac13dc99 + ожившая) и 1 устаревшее исключение.
Правились ТОЛЬКО адреса (путь в скобках markdown-ссылки), ни одно слово текста не тронуто;
для «не-путей» — строка в `scripts/ledgers/link-guard-known-not-a-path.tsv` с доводом.
Имена, которые файлами не являются, в столбце «было» нарочно набраны без кода — иначе сторож
счёл бы их путями и покраснел бы уже на этой таблице.

| № | файл | строка | было | стало | почему |
|---|---|---|---|---|---|
| 1 | `ROADMAP.md` (симлинк на `docs/ROADMAP.md`) | 210 | `tasks/1407-proslezhivaemost-trebovanie-kod-test.md` | `tasks/completed/1407-proslezhivaemost-trebovanie-kod-test.md` | задача 1407 сделана и лежит в `docs/tasks/completed/`; путь считается от `docs/` (третий способ чтения сторожа), как у соседних ссылок файла; симлинк восстановлен как симлинк |
| 2 | `docs/ROADMAP.md` | 210 | то же | то же | это и есть файл за симлинком — одна правка закрывает обе беды |
| 3 | `docs/adr/0036-an-exact-integer-is-a-new-kind-of-value-not-a-new-name.md` | 25 | `../../tasks/completed/1411-nositel-tochnogo-celogo-eto-novyy-vid-znacheniya.md` | `../tasks/completed/1411-nositel-tochnogo-celogo-eto-novyy-vid-znacheniya.md` | `tasks/` переехал под `docs/` (задача 0037): из `docs/adr` до `docs/tasks` — один шаг вверх |
| 4 | `docs/adr/0036-an-exact-integer-is-a-new-kind-of-value-not-a-new-name.md` | 26 | `../../tasks/1412-pravila-kolca-tolko-dlya-tochnogo-celogo.md` | `../tasks/1412-pravila-kolca-tolko-dlya-tochnogo-celogo.md` | то же |
| 5 | `docs/adr/0036-an-exact-integer-is-a-new-kind-of-value-not-a-new-name.md` | 27 | `../../tasks/1413-dlinnye-celye-v-desyati-celyah-pechati.md` | `../tasks/1413-dlinnye-celye-v-desyati-celyah-pechati.md` | то же |
| 6 | `docs/adr/0037-second-order-is-a-finite-conjunction-over-function-tags.md` | 25 | `../tasks/1261-a-call-precondition-is-not-discharged-by-a-proved-callee-postcondition.md` | `../tasks/completed/1261-a-call-precondition-is-not-discharged-by-a-proved-callee-postcondition.md` | задача 1261 сделана, переехала в `completed/` |
| 7 | `docs/adr/0037-second-order-is-a-finite-conjunction-over-function-tags.md` | 28 | `../tasks/7098-the-element-quantifier-is-not-printed-into-any-target.md` | `../tasks/completed/7098-the-element-quantifier-is-not-printed-into-any-target.md` | задача 7098 сделана, переехала в `completed/` |
| 8 | `docs/adr/0041-the-checker-is-proved-sound-against-a-mechanised-semantics.md` | 22 | `../tasks/2907-the-record-and-the-checker-are-modelled-in-lean-and-soundness-is-proved.md` | `../tasks/completed/2907-the-record-and-the-checker-are-modelled-in-lean-and-soundness-is-proved.md` | задача 2907 сделана, переехала в `completed/` |
| 9 | `docs/design/nositel-tochnogo-celogo.md` | 5 | `../../tasks/completed/1411-nositel-tochnogo-celogo-eto-novyy-vid-znacheniya.md` | `../tasks/completed/1411-nositel-tochnogo-celogo-eto-novyy-vid-znacheniya.md` | как строки 3–5: `tasks/` под `docs/` |
| 10 | `docs/design/nositel-tochnogo-celogo.md` | 16 | ../adr/0035-an-exact-integer-is-a-new-kind-of-value-not-a-new-name.md | `../adr/0036-an-exact-integer-is-a-new-kind-of-value-not-a-new-name.md` | решение «точное целое» предлагалось как ADR-0035 (84d872429) и перенумеровано в 0036 (0035 — «наставник печатает строки»); текст «ADR-0035» в десяти местах файла не тронут — стек K |
| 11 | `docs/design/nositel-tochnogo-celogo.md` | 222 | n-stroka.flang | ведомость | проба в рабочем каталоге ячейки ($S), не файл дерева — довод «внешний» |
| 12 | `docs/design/nositel-tochnogo-celogo.md` | 240 | n-zapis.flang | ведомость | то же |
| 13 | `docs/design/nositel-tochnogo-celogo.md` | 312 | n-ravenstvo.flang | ведомость | то же |
| 14 | `docs/examples/frameworks/react-ts-pure/README.md` | 61 | .d.ts | ведомость | обозначение расширения, не имя файла (как .ru.md у `README.md` в той же ведомости) |
| 15 | `docs/tasks/1416-the-shortcut-list-is-computed-from-the-scripts.md` | 173 | .ru.md | ведомость | обозначение суффикса-конвенции, не имя файла |
| 16 | `docs/tasks/1419-cyrillic-file-names-outside-proof-become-english.md` | 16 | obhod.sh | ведомость | иллюстративное имя в разборе задачи (пример транслита-брака), не файл |
| 17 | `docs/tasks/1419-cyrillic-file-names-outside-proof-become-english.md` | 16, 60 | walk.sh | ведомость | иллюстративное английское имя из примера, не файл |
| 18 | `docs/tasks/1419-cyrillic-file-names-outside-proof-become-english.md` | 176 | walk.sh | та же запись ведомости | вторая встреча той же пары «файл–цель»; сторож считает встречи, ведомость — пары |
| 19 | `docs/tasks/1419-cyrillic-file-names-outside-proof-become-english.md` | 61 | obhod.sh | та же запись ведомости | вторая встреча |
| 20 | `docs/tasks/1423-node-leaves-the-concurrency-directory.md` | 85 | .test.mjs | ведомость | обозначение суффикса-конвенции, не имя файла |
| 21 | `docs/tasks/3348-the-provability-threshold-is-one-hundred-percent.md` (теперь в `completed/`) | 42 | `.github/workflows/provability.yml` | ничего | после #59 (63a48f925) файл в дереве есть — ссылка ожила сама; на 4ac13dc99 сторож её уже не называет (33, а не 34) |
| 22 | `docs/tasks/6752-a-law-of-the-category-surface-is-a-statement-about-the-carrier.md` | 120 | probe-777.flang | ведомость | иллюстративное имя пробы в тексте, не файл |
| 23 | `docs/tasks/completed/1261-a-call-precondition-is-not-discharged-by-a-proved-callee-postcondition.md` | 15 | `../adr/0037-second-order-is-a-finite-conjunction-over-function-tags.md` | `../../adr/0037-second-order-is-a-finite-conjunction-over-function-tags.md` | из `completed/` до `docs/adr` — два шага вверх, не один |
| 24 | `docs/tasks/completed/1407-proslezhivaemost-trebovanie-kod-test.md` | 14 | `../adr/0031-certification-is-a-process-not-a-property-of-the-language.md` | `../../adr/0031-certification-is-a-process-not-a-property-of-the-language.md` | то же |
| 25 | `docs/tasks/completed/1794-the-sources-goal-is-written-as-an-element-quantifier.md` | 15 | `../adr/0042-the-last-twelve-places-get-rules-not-exceptions.md` | `../../adr/0042-the-last-twelve-places-get-rules-not-exceptions.md` | то же |
| 26 | `docs/tasks/completed/2907-the-record-and-the-checker-are-modelled-in-lean-and-soundness-is-proved.md` | 15 | `../adr/0041-the-checker-is-proved-sound-against-a-mechanised-semantics.md` | `../../adr/0041-the-checker-is-proved-sound-against-a-mechanised-semantics.md` | то же |
| 27 | `docs/tasks/completed/3449-the-example-evaluator-reads-a-list-by-link-and-a-variant-with-fields.md` | 15 | `../adr/0042-the-last-twelve-places-get-rules-not-exceptions.md` | `../../adr/0042-the-last-twelve-places-get-rules-not-exceptions.md` | то же |
| 28 | `docs/tasks/completed/3449-the-example-evaluator-reads-a-list-by-link-and-a-variant-with-fields.md` | 17 | `3448-the-example-evaluator-of-the-checker-reads-nul-strings-and-filter.md` | `../3448-the-example-evaluator-of-the-checker-reads-nul-strings-and-filter.md` | 3448 ещё открыта и лежит в `docs/tasks/`, а не рядом в `completed/` |
| 29 | `docs/tasks/completed/6191-unfold-foreign-case-by-constructor.md` | 18 | `../road-to-one-hundred-measured.md` | `../../road-to-one-hundred-measured.md` | файл лежит в `docs/`, из `completed/` — два шага вверх |
| 30 | `docs/tasks/completed/6812-a-contradictory-pair-of-assumptions-is-a-ledger-family.md` | 15 | `../adr/0042-the-last-twelve-places-get-rules-not-exceptions.md` | `../../adr/0042-the-last-twelve-places-get-rules-not-exceptions.md` | как 23 |
| 31 | `docs/tasks/completed/7098-the-element-quantifier-is-not-printed-into-any-target.md` | 15 | `../adr/0037-second-order-is-a-finite-conjunction-over-function-tags.md` | `../../adr/0037-second-order-is-a-finite-conjunction-over-function-tags.md` | как 23 |
| 32 | `docs/tasks/completed/7359-strings-have-no-induction-principle.md` | 15 | `../adr/0040-a-simplifier-rewrites-by-proved-equalities-and-prints-every-step.md` | `../../adr/0040-a-simplifier-rewrites-by-proved-equalities-and-prints-every-step.md` | как 23 |
| 33 | `flang/proof/checker/tests/families/plan/README.md` | 3 | `../../../../../../tasks/1405-plan-nichego-ne-obeshchaet.md` | `../../../../../../docs/tasks/completed/1405-plan-nichego-ne-obeshchaet.md` | правлено позже, коммитом d350b7eea: задача переехала в `completed/`, и путь сведён вместе с переездом |
| 34 | `flang/proof/checker/tests/families/run-induction/README.md` | 3 | `../../../../../../tasks/1404-utverzhdenie-o-posledovatelnosti-shagov.md` | `../../../../../../docs/tasks/completed/1404-utverzhdenie-o-posledovatelnosti-shagov.md` | то же |
| 35 | `scripts/ledgers/link-guard-known-not-a-path.tsv` | 131 | `docs/site/examples.md` → core/storefront.flang («план: пример живёт на ветке») | строка снята | цель ожила: `docs/examples/frameworks/react-ts-pure/core/storefront.flang` в дереве; сторож сам сказал «исключение больше не срабатывает» |

Ведомость: снята 1 строка, добавлено 9 (строки 11–17, 20, 22; пары 18–19 покрыты теми же
записями, что 16–17): было 247 записей, стало 255 (с заголовком — 256 строк).

## Замер после правки

| что | до (4ac13dc99) | после (эта ветка) |
|---|---|---|
| `./ярлык ссылки:проверка` | код 1, битых 33 из 7009, устаревших исключений 1 | снимается прогоном на этом коммите (см. следующий коммит) |
| `sh scripts/guards/prose-numbers-guard.sh` | — | код 0: примет 216, сошлось 216, разошлось 0, негодных 0 |
| `./ярлык опись:сверка` | — | код 0 |
