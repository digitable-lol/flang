---
номер: 3402
заголовок: Пример пакета в docs не пересобирается: модуль назван «Discount», а объявление и собранный пакет — «Скидка»
статус: свободна
приоритет: P2
исполнитель: —
ветка: —
команда: вторая
карта: Что уже есть
рядом: 3401, 3403, 1186
нужность: читатель, который повторяет образцовый пример пакета шаг в шаг, получает отказ на первой команде
---

# 3402. Пример пакета в docs не пересобирается: модуль назван «Discount», а объявление и собранный пакет — «Скидка»

Расхождений два: имя в примере пакета и раздел 6 `docs/road-to-1-0.md`.

## Шаги воспроизведения

1. Собрать пакет из примера в дереве:

```
bootstrap/flang package docs/examples/package/discount.flang
```

2. Сравнить имена в трёх файлах примера:

```
head -1 docs/examples/package/discount.flang
grep -a 'имя' docs/examples/package/flang.package
grep -a 'использует' docs/examples/package/shop/shop.flang
```

3. Утверждение страницы, которое опровергается одним прогоном:

```
grep -an 'разрешения версий' docs/road-to-1-0.md
bootstrap/flang io scripts/registry-tool.fscript --plan 'Разрешить' --trust
```

## Что происходит

```
$ bootstrap/flang package docs/examples/package/discount.flang
FLANG_PACKAGE: в flang.package пакет назван «Скидка», а модуль в
docs/examples/package/discount.flang называется «Discount»       код 1
$ head -1 docs/examples/package/discount.flang
модуль «Discount»
$ grep -a 'имя' docs/examples/package/flang.package
  "имя": "Скидка",
$ grep -a 'использует' docs/examples/package/shop/shop.flang
  использует «Скидка» из "discount.flang-package"
$ grep -an 'разрешения версий' docs/road-to-1-0.md
160:**Чего нет.** Почти всего: установки, разрешения версий, замыкания зависимостей.
$ bootstrap/flang io scripts/registry-tool.fscript --plan 'Разрешить' --trust
{"plan":"Разрешить","result":"запрос «Множество строк: не ниже 1.1» разрешён:
 пакетов 3 …",…}                                                  код 0
```

Исходник примера назван «Discount», а `flang.package`, собранный
`docs/examples/package/shop/discount.flang-package` и строка `использует «Скидка»`
в `docs/examples/package/shop/shop.flang` носят другое имя. Страницы
`docs/site/packages.md` и `docs/site/packages.ru.md` расхождение описывают
верно — они объясняют отказ и зовут читателя на свой каталог `skidka/`, — так
что чинить придётся и их: объяснение отказа станет неправдой, как только пример
соберётся.

Раздел 6 `docs/road-to-1-0.md` в «чего нет» называет разрешение версий, хотя
план «Разрешить» разрешает запрос транзитивно и отвечает кодом 0: пакетов 3,
поручений 2.

## Что должно быть

Пример из `docs/examples/package` пересобирается одной командой без правок
руками. Страницы не утверждают того, что опровергается одним прогоном двоичного
из дерева.

## Обходной путь

Перед сборкой поправить имя в `flang.package` на «Discount» руками. Лежащий в
дереве `docs/examples/package/shop/discount.flang-package`
программой `docs/examples/package/shop/shop.flang` читается:
`bootstrap/flang check docs/examples/package/shop/shop.flang` — код 0.

## Когда задача сделана

```
bootstrap/flang package docs/examples/package/discount.flang     код 0
```

и вывод совпадает байт в байт с `docs/examples/package/shop/discount.flang-package`;
`bootstrap/flang check docs/examples/package/shop/shop.flang` — код 0. В разделе 6
`docs/road-to-1-0.md` в «чего нет» остаются только установка и раздача, а
`flang/stdlib/registry.flang` и `scripts/registry-tool.fscript` названы в «что
уже есть». Страницы `docs/site/packages.md` и `docs/site/packages.ru.md` больше
не объясняют отказ на примере из дерева. Проба сборки пакета — задача 3401.

## Где живёт правка

`docs/examples/package/flang.package`, `docs/examples/package/shop/shop.flang`,
`docs/examples/package/shop/discount.flang-package` (пересобрать командой, не
руками), `docs/road-to-1-0.md`, `docs/site/packages.md`,
`docs/site/packages.ru.md`. Пересборка семени (bootstrap regeneration) не нужна.
