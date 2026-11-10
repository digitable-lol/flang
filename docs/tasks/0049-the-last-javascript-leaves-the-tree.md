---
номер: 0049
заголовок: Оснастка в scripts, flang/scripts и flang/test ещё написана на JavaScript и зовётся через Node
статус: свободна
приоритет: P2
исполнитель: —
ветка: —
команда: вторая
карта: Чего в языке нет вовсе
рядом: 4412, 7192
нужность: цель дерева — всё написано на flang; пока проверки и тесты узла идут через Node, язык не обслуживает себя сам
---

# 0049. Оснастка в scripts, flang/scripts и flang/test ещё написана на JavaScript и зовётся через Node

## Шаги воспроизведения

1. Сосчитать файлы JavaScript в дереве и в трёх каталогах оснастки:

```
git ls-files '*.mjs' '*.js' | wc -l
git ls-files 'scripts/*.mjs' 'flang/scripts/*.mjs' 'flang/test/*.mjs'
```

2. Посмотреть, какие ярлыки и работы CI зовут Node:

```
grep -n ' = node ' .flangrc
grep -an 'run: node' .github/workflows/binary.yml .github/workflows/pages.yml
```

## Что происходит

```
$ git ls-files '*.mjs' '*.js' | wc -l
41
$ git ls-files 'scripts/*.mjs' 'flang/scripts/*.mjs' 'flang/test/*.mjs' | wc -l
8
$ grep -c ' = node ' .flangrc
12
$ grep -ac '= node flang/\|= node scripts/\|= node --test' .flangrc
6
```

Прогон 10 ноября 2026 на дереве 001d8df7c, двоичный 0.7.34.

Восемь файлов этой задачи и что держит каждый:

| файл | кто зовёт | что мешает снять |
|---|---|---|
| `flang/scripts/name-guard.mjs` | ярлык `names:check` | план `flang/scripts/name-guard.fscript` отвечает тем же кодом 1 на тех же 483 файлах, но находок у него 688 против 4000; все 688 есть среди 4000, а из остальных 3312 у 2761 названного имени в файле нет — JavaScript приписывает файлу имена его ввозов. Про оставшиеся 551 не выяснено, кто прав |
| `flang/scripts/count-guard.mjs` | ярлык `counts:check` | план `flang/scripts/count-guard.fscript` судит одни числа потолка (код 1 за 584 с, одно расхождение), остальные правила не перенесены |
| `flang/scripts/link-collision-guard.mjs` | ярлыки `link-collisions:check`, `link-collisions:corrupt`, `.github/workflows/binary.yml`, `scripts/targets/identical-declarations.sh` | задача 7192: план `flang/scripts/link-collision-tree.fscript` числит настоящими три столкновения, заявленные пробами (код 1 против 0), и идёт 7 мин 17 с при 16 ГиБ против 15 с |
| `scripts/site/build-changelog-page.mjs`, `scripts/site/build-changelog.mjs` | ярлыки `changelog:page`, `changelog:page:check`, `.github/workflows/pages.yml` | план `scripts/site/build-changelog-page.fscript` печатает другую страницу — вся таблица мер в ней нули — за 15 мин 06 с и 19,6 ГиБ против 35 с |
| `flang/scripts/binary.mjs`, `flang/scripts/direct-run.mjs`, `flang/test/glob.mjs` | файлы этого списка и сборка сайта | уходят последними, когда не останется ввозящих |

Три пробы узла (`flang/test/*.test.mjs`) и их оснастка сняты: те же вопросы
задают планы `flang/scripts/link-across-targets.fscript`,
`scheduler-across-targets.fscript` и `supervisor-across-targets.fscript`, ярлык
`tests` зовёт их. Сверка каждой пары — в `docs/javascript-inventory.md`.

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

Перечень `docs/javascript-inventory.md` переснят.

## Где живёт правка

Файлы из таблицы, `.flangrc` (объявления ярлыков), `.github/workflows/binary.yml`,
`.github/workflows/pages.yml`, `scripts/targets/identical-declarations.sh`,
`docs/javascript-inventory.md`. Пересборка семени (bootstrap regeneration) не
нужна: всё это сценарии и настройка.

Отдельная задача, здесь не решается: сборка сайта в `docs/site/` на JavaScript —
задача 4412.

Следующий шаг — пара `flang/scripts/name-guard.mjs` /
`flang/scripts/name-guard.fscript`: взять одно из 551 имени, которое есть в
файле, названо JavaScript и не названо планом, и выяснить, чьё это правило.
Если прав план — переключить ярлык `names:check` и удалить файл. Три остальные
пары упираются в цену интерпретатора на больших текстах: без неё план нельзя
поставить в работу, идущую на каждый пуш. Краснеющая сегодня проба:
`git ls-files 'scripts/*.mjs' 'flang/scripts/*.mjs' 'flang/test/*.mjs' | wc -l`
печатает 8, а не 0.
