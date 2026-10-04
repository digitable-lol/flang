---
номер: 0049
заголовок: Оснастка в scripts, flang/scripts и flang/test ещё написана на JavaScript и зовётся через Node
статус: свободна
приоритет: P2
исполнитель: —
ветка: —
команда: вторая
карта: Чего в языке нет вовсе
рядом: 0016, 0045
нужность: цель дерева — всё написано на flang; пока проверки и тесты узла идут через Node, язык не обслуживает себя сам
---

# 0049. Оснастка в scripts, flang/scripts и flang/test ещё написана на JavaScript и зовётся через Node

## Шаги воспроизведения

1. Сосчитать файлы JavaScript в дереве и в трёх каталогах оснастки:

```
git ls-files '*.mjs' | wc -l
git ls-files 'scripts/*.mjs' 'flang/scripts/*.mjs' 'flang/test/*.mjs'
```

2. Посмотреть, какие ярлыки и работы CI зовут Node:

```
grep -n ' = node ' .flangrc
grep -an 'run: node' .github/workflows/binary.yml .github/workflows/pages.yml
```

## Что происходит

```
$ git ls-files '*.mjs' | wc -l
33
$ git ls-files 'scripts/*.mjs' 'flang/scripts/*.mjs' 'flang/test/*.mjs' | wc -l
15
$ grep -c ' = node ' .flangrc
14
```

Версия: flang 0.7.23. Дата прогона: 2 октября 2026.

Пятнадцать файлов этой задачи и что держит каждый:

| файл | кто зовёт | программа на flang рядом |
|---|---|---|
| `flang/scripts/count-guard.mjs` | ярлык `counts:check` | `flang/scripts/count-guard.fscript`, правила перенесены не все |
| `flang/scripts/name-guard.mjs` | ярлык `names:check` | `flang/scripts/name-guard.fscript` |
| ~~`flang/scripts/word-occupancy.mjs`~~ СНЯТ 4 октября 2026 | — | `flang/scripts/word-occupancy.fscript`: прогон обоих на слове «неотрицательное» дал одно и то же (файлов 1297, голым 553, цепочкой 0, в ёлочках 0, в строке 128, в комментарии 0, те же места) и один код возврата; подложенное голое имя в `docs/examples/rosetta/quicksort.flang` красит оба (3 места, код 1). Ярлык `word:occupancy` зовёт план |
| `flang/scripts/link-collision-guard.mjs` | ярлыки `link-collisions:check`, `link-collisions:corrupt`, `.github/workflows/binary.yml`, `scripts/targets/identical-declarations.sh` | `flang/scripts/link-collision-tree.fscript` — задача 7192 |
| `scripts/site/build-changelog.mjs` | ввозит `scripts/site/build-changelog-page.mjs` | `scripts/site/build-changelog.fscript`, ярлыки `changelog:build` и `changelog:check` уже переключены |
| `scripts/site/build-changelog-page.mjs` | ярлыки `changelog:page`, `changelog:page:check`, `.github/workflows/pages.yml` | `scripts/site/build-changelog-page.fscript` |
| `flang/test/nadzor-uzla.test.mjs`, `flang/test/planirovshchik-celi.test.mjs`, `flang/test/svyaz-celi.test.mjs` | ярлык `tests`, `flang/scripts/guards-start.fscript` (обходит все `*.test.mjs`, сегодня их в дереве ровно эти три) | `flang/scripts/supervisor-across-targets.fscript`, `flang/scripts/scheduler-across-targets.fscript`, `flang/scripts/link-across-targets.fscript` |
| `flang/test/glob.mjs`, `flang/test/tempdir.mjs`, `flang/test/toolchain-guard.mjs`, `flang/test/uzel-osnastka.mjs` | три теста узла и стенд из задачи 4412 | уходят вместе с ввозящими |
| `flang/scripts/binary.mjs`, `flang/scripts/direct-run.mjs` | все остальные файлы этого списка и сборка сайта | `flang/scripts/binary.fscript`; уходят последними |

Совпадение ответов программ на flang с ответами файлов JavaScript сегодня не
перепроверено: прогон каждой пары дольше минуты.

## Что должно быть

В трёх каталогах нет ни одного файла JavaScript; ярлыки и работы CI зовут
`bootstrap/flang io …`. Каждый файл снимается в таком порядке: программа на
flang даёт тот же ответ и тот же код возврата на всём дереве, подложенная
ошибка делает красными обе, ярлык и работа CI переключены, файл удалён.
Сравнение на части дерева не годится: оно показывало пустую разницу при
сломанной проверке.

## Обходной путь

Держать на машине Node и звать ярлыки как есть.

## Когда задача сделана

```
$ git ls-files 'scripts/*.mjs' 'flang/scripts/*.mjs' 'flang/test/*.mjs' | wc -l
0
$ grep -ac '= node flang/\|= node scripts/\|= node --test' .flangrc
0
```

`bootstrap/flang run-script tests` и остальные переключённые ярлыки отвечают тем же кодом, что до
сноса; `flang/scripts/guards-start.fscript` не ждёт файлов тестов на
JavaScript. Перечень `docs/javascript-inventory.md` переснят. Файлы вне трёх
каталогов, которые остаются (`docs/benchmarks/speed/work.mjs`,
`docs/benchmarks/speed/programs/tasks.mjs`, `docs/examples/web/wasm/probe.mjs`,
`flang/concurrency/bin/wire.mjs`), названы в перечне с причиной либо сняты.

## Где живёт правка

Файлы из таблицы, `.flangrc` (объявления ярлыков переехали туда из
`ярлыки.flang`), `.github/workflows/binary.yml`,
`.github/workflows/pages.yml`, `scripts/targets/identical-declarations.sh`,
`scripts/guards/occupancy-check.fscript`, `flang/scripts/guards-start.fscript`,
`docs/javascript-inventory.md`. Пересборка семени (bootstrap regeneration) не
нужна: всё это сценарии и настройка.

Отдельная задача, здесь не решается: сборка сайта в `docs/site/` и стенд узла в
`flang/concurrency/bench/` на JavaScript — задача 4412.
