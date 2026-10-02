---
номер: 1433
заголовок: Карта docs/README.md называет семь подкаталогов из двадцати двух, а проверка карты внутрь docs/ не смотрит
статус: свободна
приоритет: P3
исполнитель: —
ветка: —
команда: любая
карта: Что мешает больше всего
рядом: 0037, 1745
нужность: новый подкаталог docs/ заводится молча — карта его не называет, и ни одна проверка не краснеет
---

# 1433. Карта docs/README.md называет семь подкаталогов из двадцати двух, а проверка карты внутрь docs/ не смотрит

## Шаги воспроизведения

1. Сколько подкаталогов `docs/` названы в карте `docs/README.md`:

```
for d in docs/*/; do n=$(basename $d); grep -q "$n/" docs/README.md || echo "не назван: $n"; done
```

2. Что сверяет проверка карты:

```
sh scripts/guards/published-vs-tree.sh --карта
```

3. Два каталога замеров с одними именами файлов и разным содержимым:

```
diff <(ls docs/benchmark/) <(ls docs/benchmark2/) && echo IDENTICAL
for f in $(ls docs/benchmark/); do cmp -s "docs/benchmark/$f" "docs/benchmark2/$f" || echo "DIFFER: $f"; done | wc -l
```

## Что происходит

```
$ for d in docs/*/; do …; done | wc -l
15                                                               код 0
$ sh scripts/guards/published-vs-tree.sh --карта | head -1
КАРТА РАСКЛАДКИ (docs/repository-layout против корня дерева):
$ diff <(ls docs/benchmark/) <(ls docs/benchmark2/) && echo IDENTICAL
IDENTICAL                                                        код 0
$ for f in …; do cmp -s …; done | wc -l
21
```

Версия: flang 0.7.23. Дата прогона: 2 октября 2026, ствол 0241d36b0.

Подкаталогов у `docs/` двадцать два (считано `git ls-files`, а не `find`); карта в
`docs/README.md` называет семь (guide, adr, archive, zettel, ifl, examples, flang). Не
названы пятнадцать: benchmark, benchmark2, benchmarks, course, ct, design, editors, fspec,
releases, site, specifications, tasks, templates, tutor, zamer-teorkat. Функция `karta` в
`scripts/guards/published-vs-tree.sh` сверяет состав корня дерева с блоком между метками
КАРТА-НАЧАЛО и КАРТА-КОНЕЦ в `docs/repository-layout.md` и `docs/repository-layout.ru.md`;
внутрь `docs/` она не смотрит, и новый подкаталог там заводится молча.
В `docs/benchmark/` и `docs/benchmark2/` по 21 файлу с одинаковыми именами, и
все 21 различаются содержимым. Заход теперь виден из каталога: у обоих есть свой
`README.md`, и в нём же записано, почему каталоги решено не переименовывать. Рядом третий
каталог `docs/benchmarks/` с другим устройством (подкаталоги proof-cost, speed, verdict-cache).

## Что должно быть

Карта `docs/README.md` называет каждый подкаталог верхнего уровня `docs/` и
говорит, какой род документа туда попадает; проверка `--карта` сверяет её с
деревом так же, как корневую, и краснеет на неназванном каталоге. Это обещает сама
карта корня (`docs/repository-layout.md`: «Prose lives in `docs/` and only there») и
правило именования в конце `docs/README.md`.

## Обходной путь

Читатель открывает каталог и читает `README.md` внутри, где он есть; у
`docs/benchmark/` и `docs/benchmark2/` смотрит ссылки из страниц `docs/benchmark-proof-cost.md`
и `docs/benchmark-proof-cost-2.md`.

## Когда задача сделана

```
for d in docs/*/; do n=$(basename $d); grep -q "$n/" docs/README.md || echo "не назван: $n"; done   → пусто
sh scripts/guards/published-vs-tree.sh --карта                                                  код 0
```

Проба: подложить пустой подкаталог в `docs/` — проверка обязана покраснеть и
назвать его; `node docs/site/build.mjs --check` — битых ссылок нет.
Каталоги, где имя говорит всё (adr, site, guide, releases, archive,
templates), собственного README не получают.

## Где живёт правка

`docs/README.md` (карта подкаталогов, раздел «Правило именования») и функция
`karta` в `scripts/guards/published-vs-tree.sh` (второй проход, по `docs/`).
Двоичного правка не касается, пересборка семени (bootstrap regeneration) не нужна.

Здесь не решается: переименование `docs/benchmark/` и `docs/benchmark2/` — решено не
переименовывать, довод записан в `docs/benchmark/README.md` (на эти пути завязаны
`docs/site/sitemap.mjs`, `docs/jargon.json` и курс).
