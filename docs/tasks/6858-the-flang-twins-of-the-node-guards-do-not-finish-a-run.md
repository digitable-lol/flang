---
номер: 6858
заголовок: У проверок на JavaScript есть двойники на flang, но ярлыки зовут node: двойники неполны или не доходят до конца прогона
статус: свободна
приоритет: P2
исполнитель: —
ветка: —
команда: любая
карта: Что мешает больше всего
рядом: 7192, 7790
нужность: пока ярлык зовёт node, дереву нужен Node, а двойник на flang никто не гоняет
---

# 6858. У проверок на JavaScript есть двойники на flang, но ярлыки зовут node: двойники неполны или не доходят до конца прогона

## Шаги воспроизведения

1. `git ls-files 'flang/scripts/*.mjs' 'scripts/**/*.mjs'`
2. `grep -o '"node [a-z]*/[^"]*"' ярлыки.flang | grep -v docs/site | grep -v flang/test`

## Что происходит

```
$ git ls-files 'flang/scripts/*.mjs' 'scripts/**/*.mjs'
flang/scripts/binary.mjs
flang/scripts/count-guard.mjs
flang/scripts/direct-run.mjs
flang/scripts/link-collision-guard.mjs
flang/scripts/name-guard.mjs
flang/scripts/word-occupancy.mjs
scripts/site/build-changelog-page.mjs
scripts/site/build-changelog.mjs
$ grep -o '"node [a-z]*/[^"]*"' ярлыки.flang | grep -v docs/site | grep -v flang/test
"node flang/scripts/count-guard.mjs"
"node flang/scripts/name-guard.mjs"
"node flang/scripts/link-collision-guard.mjs --дерево"
"node flang/scripts/link-collision-guard.mjs --порча"
"node flang/scripts/word-occupancy.mjs"
"node scripts/site/build-changelog-page.mjs"
"node scripts/site/build-changelog-page.mjs --check"
"node scripts/site/build-changelog.mjs --check && node scripts/site/build-changelog.mjs --self-test"
```

У каждого из восьми файлов рядом лежит двойник на flang с тем же именем.
Ярлыки на двойников не переключены.

Версия: flang 0.7.23, 30 сентября 2026.

Почему не переключены — не перепроверено, прогоны идут минутами:

| файл | что известно о двойнике |
|---|---|
| `count-guard` | правил меньше: нет таблиц, ведомости, `--fix`, `--дерево` |
| `link-collision-guard` | нет режимов `--дерево` и `--порча`, которые зовут ярлыки; цена прогона — задача 7192 |
| `name-guard`, `word-occupancy` | двойник написан позже, с оригиналом прогоном не сличён |
| `build-changelog`, `build-changelog-page` | двойник зовут другие ярлыки; сличения с оригиналом нет |
| `binary`, `direct-run` | библиотеки Node: их ввозят `docs/site/*.mjs`, `flang/test/*.mjs` и остальные шесть файлов; уходят последними |

Предел `--max-steps` у `flang io` считается на вызов функции, а не на прогон:
двойнику, который ходит по дереву, нужен ключ с числом от замера, иначе он
останавливается кодом 3 на умолчании.

## Что должно быть

Каждый из восьми ярлыков зовёт `bootstrap/flang io` на двойнике, двойник даёт
тот же приговор, что оригинал, и файл на JavaScript удалён.

## Обходной путь

Держать Node на машине и гонять оригиналы.

## Когда задача сделана

По каждому файлу, по одному:

1. двойник доходит до конца на настоящем дереве за время, которое не стыдно
   поставить в ярлык, и покрывает режимы, которые зовёт ярлык;
2. оригинал и двойник прогнаны на одном дереве, код и находки совпали, подделка
   краснеет у обоих;
3. ярлык в `ярлыки.flang` переключён, файл на JavaScript удалён;
4. `grep -c '"node flang/scripts\|"node scripts' ярлыки.flang` отвечает 0.

`binary.mjs` и `direct-run.mjs` удаляются, когда их никто не ввозит:
`grep -ln 'binary.mjs\|direct-run.mjs' $(git ls-files '*.mjs')` пуст.

## Где живёт правка

`flang/scripts/count-guard.fscript`, `flang/scripts/link-collision-guard.fscript`,
`flang/scripts/name-guard.fscript`, `flang/scripts/word-occupancy.fscript`,
`scripts/site/build-changelog.fscript`, `scripts/site/build-changelog-page.fscript`,
`ярлыки.flang`. Перепечатка не нужна.
