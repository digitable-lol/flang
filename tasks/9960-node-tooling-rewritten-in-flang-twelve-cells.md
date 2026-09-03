---
номер: 9960
заголовок: 46 файлов .mjs своего инструментария переписываются на flang
статус: открыта
исполнитель: —
ветка: —
команда: любая
карта: Что мешает больше всего
рядом: 8649
---

# 9960 — свой инструментарий (сторожа, сайт, changelog, тесты) переписывается с Node на flang

Владелец: «ты бы кстати и nodejs бы выпилил нахрена он нам нужен» → после
разбора трёх разных смыслов («node» как цель печати, как хозяин теста, как
инструментарий разработки) → «перепиши на flang, не надо нам эти 46
файлов, раздай 12 субагентам их».

## Что НЕ трогается, и почему

Пять файлов — не наш инструментарий, а часть возможностей языка или
методики замера:

* `benchmarks/speed/programs/tasks.mjs`, `benchmarks/speed/work.mjs` —
  эталонная реализация на JS, с которой сравнивают. Без неё замер теряет
  предмет сравнения (`docs/javascript-inventory.md`, куча 2).
* `flang/conc/bin/wire.mjs` — хозяин узла на цели печати `js`, восьмой из
  восьми (`flang/scripts/node-across-targets.flang`). Без него цель `js`
  не работает как рабочая цель.
* `scripts/wasm-run.mjs`, `web/wasm/probe.mjs` — проверка цели WASM,
  которой сама природа цели требует Node/браузер как среду.

## Раскладка 41 файла (17 836 строк) на 12 ячеек

| ячейка | пакет | файлы | строк |
|---|---|---|---:|
| Ч376 | сайт: сборка | `docs/site/{build,sitemap}.mjs` | 1492 |
| Ч377 | сайт: разметка | `docs/site/{markdown,podsvetka,diagram}.mjs` | 1073 |
| Ч378 | сайт: поиск и числа | `docs/site/{poisk,poisk-proverka,numbers,site-numbers,surfaces-run}.mjs` | 1306 |
| Ч379 | сторожа столкновений | `flang/scripts/link-collision-guard.mjs`, `scripts/{latin,type}-collision-guard.mjs` | 1679 |
| Ч380 | сторожа слов/имён компилятора | `flang/scripts/{word-guard,name-guard,target-words,word-occupancy,claim-guard}.mjs` | 2303 |
| Ч381 | сторожа счёта и жаргона | `flang/scripts/count-guard.mjs`, `scripts/jargon-guard.mjs`, `flang/test/jargon-guard.test.mjs` | 1799 |
| Ч382 | сторожа CLI/двоичного | `flang/scripts/{binary,cli-keys-guard,binary-rules-guard}.mjs` | 2006 |
| Ч383 | прямой запуск, поиск, ведомость | `flang/scripts/{direct-run-guard,direct-run,discriminating-search,proof-ledger}.mjs` | 1974 |
| Ч384 | журнал изменений | `scripts/build-changelog{,-page}.mjs` | 1713 |
| Ч385 | обвязка тестов | `flang/test/{tempdir,glob,toolchain-guard,uzel-osnastka,surface-pair}.mjs` | 900 |
| Ч386 | сами тесты (кроме fixture-хозяев) | `flang/test/{planirovshchik-celi,svyaz-celi,nadzor-uzla}.test.mjs` | 813 |
| Ч387 | замеры | `benchmarks/proof-cost/count-library.mjs`, `flang/conc/bench/{gen,node-death-targets}.mjs` | 778 |

## Как устроена проверка равносильности

`flang` не имеет побочных действий: программа строит план поручений
(«прочитать файл», «запустить процесс»), хозяин план исполняет. Образец —
`scripts/release-guard.flang` (`flang io scripts/release-guard.flang`).
Новый инструмент на flang и старый на Node ОБЯЗАНЫ давать одинаковый
приговор на одних и тех же входах — не «похоже работает», а сверено
прогоном.

## Порог, общий на все двенадцать

Это ночь выпуска, и часть переписываемых сторожей поймала настоящие баги
сегодня же (`link-collision-guard.mjs` — столкновение «Пара имён» час
назад; `jargon-guard.mjs` — судоязык в релизе). Замена не должна снизить
защиту.

* Старый `.mjs`-файл НЕ удаляется. Новый `.flang` живёт рядом.
* Равносильность доказана прогоном на РЕАЛЬНОМ дереве (сегодняшнее
  состояние — зелёное почти везде) И на известных красных случаях, где
  они есть (мутанты проб, история находок в `tasks/` и `docs/zettel/`).
* Ничего не вливается в `dev` этой же ночью без отдельной проверки
  координатором — слишком высокая цена ошибки в инструменте, который сам
  проверяет дерево.
