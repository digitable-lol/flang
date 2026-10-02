---
номер: 1433
заголовок: Карта docs/README.md называет семь подкаталогов docs/ из двадцати трёх, а проверка карты внутрь docs/ не смотрит
статус: свободна
приоритет: P3
исполнитель: —
ветка: —
команда: любая
карта: Что мешает больше всего
рядом: 0037, 1745
нужность: новый подкаталог docs/ заводится молча, а читатель не может по имени отличить два каталога замеров с одинаковыми именами файлов и разным содержимым
---

# 1433. Карта docs/README.md называет семь подкаталогов docs/ из двадцати трёх, а проверка карты внутрь docs/ не смотрит

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
16                                                               код 0
$ sh scripts/guards/published-vs-tree.sh --карта | head -1
КАРТА РАСКЛАДКИ (README против корня дерева):
$ diff <(ls docs/benchmark/) <(ls docs/benchmark2/) && echo IDENTICAL
IDENTICAL                                                        код 0
$ for f in …; do cmp -s …; done | wc -l
21
```

Версия: flang 0.7.23. Дата прогона: 30 сентября 2026.

Подкаталогов у `docs/` двадцать три; карта в `docs/README.md` называет семь
(guide, adr, archive, zettel, ifl, examples, flang). Не названы benchmark,
benchmark2, benchmarks, course, ct, design, editors, fspec, releases, site,
tasks, templates, tools, tutor, zamer-teorkat, спецификации. Функция `karta` в
`scripts/guards/published-vs-tree.sh` сверяет состав корня дерева с блоком
между метками КАРТА-НАЧАЛО и КАРТА-КОНЕЦ в `README.md` и `docs/README.ru.md`;
внутрь `docs/` она не смотрит, и новый подкаталог там заводится молча.
В `docs/benchmark/` и `docs/benchmark2/` по 21 файлу с одинаковыми именами, и
все 21 различаются содержимым; что второй — другой заход того же замера, видно
только из `docs/benchmark-proof-cost-2.md`. Рядом третий каталог
`docs/benchmarks/` с другим устройством (подкаталоги proof-cost, speed, verdict-cache).

## Что должно быть

Карта `docs/README.md` называет каждый подкаталог верхнего уровня `docs/` и
говорит, какой род документа туда попадает; проверка `--карта` сверяет её с
деревом так же, как корневую, и краснеет на неназванном каталоге. Каталоги
замеров различимы по имени, а не по цифре. Это обещает сама карта корня
(`README.md`: «everything else under `docs/` is `docs/README.md`») и правило
именования в конце `docs/README.md`.

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
назвать его. `diff <(ls docs/benchmark/) <(ls docs/benchmark2/)` больше не даёт
совпадения имён при разном содержимом, либо каталоги переименованы так, что
заход виден в имени; `node docs/site/build.mjs --check` — битых ссылок нет.
Каталоги, где имя говорит всё (adr, site, guide, releases, archive,
templates), собственного README не получают.

## Где живёт правка

`docs/README.md` (карта подкаталогов, раздел «Правило именования»), функция
`karta` в `scripts/guards/published-vs-tree.sh` (второй проход по `docs/`),
переименование `docs/benchmark/` и `docs/benchmark2/` вместе со ссылками из
`docs/benchmark-proof-cost.md`, `docs/benchmark-proof-cost-2.md` и карты сайта
`docs/site/sitemap.mjs`. Двоичного правка не касается, пересборка семени
(bootstrap regeneration) не нужна.

Отдельная задача, здесь не решается: имя каталога `docs/specifications/` —
правило имён файлов, а не раскладка.
