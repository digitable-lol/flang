---
номер: 3402
заголовок: Пример пакета в docs не пересобирается: модуль назван «Discount», а объявление и собранный пакет — «Скидка»
статус: свободна
приоритет: P2
исполнитель: —
ветка: —
команда: вторая
карта: Что уже есть
рядом: 3401, 3403, 9968, 1186
нужность: читатель, который повторяет образцовый пример пакета шаг в шаг, получает отказ на первой команде
---

# 3402. Пример пакета в docs не пересобирается: модуль назван «Discount», а объявление и собранный пакет — «Скидка»

## Шаги воспроизведения

1. Собрать пакет из примера в дереве:

```
bootstrap/flang package docs/examples/package/discount.flang
```

2. Сравнить имена в четырёх файлах примера:

```
head -1 docs/examples/package/discount.flang
grep -a 'имя' docs/examples/package/flang.package
grep -a 'использует' docs/examples/package/shop/shop.flang
```

3. Два утверждения в текстах, которые расходятся с деревом:

```
grep -an 'разрешения версий' docs/road-to-1-0.md
grep -an 'FLANG_IO_NO_TLS' scripts/release/asdf-version-list.fscript
bootstrap/flang io scripts/registry-tool.fscript --plan 'Разрешить' --trust
```

## Что происходит

```
$ bootstrap/flang package docs/examples/package/discount.flang
FLANG_PACKAGE: в flang.package пакет назван «Скидка», а модуль в
docs/examples/package/discount.flang называется «Discount»       код 1
$ grep -an 'разрешения версий' docs/road-to-1-0.md
160:**Чего нет.** Почти всего: установки, разрешения версий, замыкания зависимостей.
$ bootstrap/flang io scripts/registry-tool.fscript --plan 'Разрешить' --trust
{"plan":"Разрешить","result":"запрос «Множество строк: не ниже 1.1» разрешён:
 пакетов 3 …",…}                                                  код 0
```

Версия: flang 0.7.23. Дата прогона: 30 сентября 2026.

Исходник примера переименован в «Discount», а `flang.package`, собранный
`docs/examples/package/shop/discount.flang-package` и строка `использует «Скидка»` в `docs/examples/package/shop/shop.flang`
остались со старым именем. Страница `docs/road-to-1-0.md` говорит, что
разрешения версий нет, хотя план «Разрешить» его выполняет. Комментарий в
`scripts/release/asdf-version-list.fscript` (строки 40–41) говорит, что на https
хозяин отвечает `FLANG_IO_NO_TLS`, хотя поручение «Запросить» ходит по https
через curl.

## Что должно быть

Пример из `docs/examples/package` пересобирается командой со страницы
`docs/site/packages.ru.md` без правок. Страницы не утверждают того, что
опровергается одним прогоном двоичного из дерева.

## Обходной путь

Перед сборкой поправить имя в `flang.package` на «Discount» руками. Лежащий в
дереве `docs/examples/package/shop/discount.flang-package` собран раньше и программой `docs/examples/package/shop/shop.flang`
читается: `bootstrap/flang check docs/examples/package/shop/shop.flang` — код 0.

## Когда задача сделана

```
bootstrap/flang package docs/examples/package/discount.flang     код 0
```

и вывод совпадает байт в байт с `docs/examples/package/shop/discount.flang-package`;
`bootstrap/flang check docs/examples/package/shop/shop.flang` — код 0. В разделе 6
`docs/road-to-1-0.md` в «чего нет» остаются только установка и раздача, а
`flang/stdlib/registry.flang` и `scripts/registry-tool.fscript` названы в «что
уже есть». Устаревшего комментария про `FLANG_IO_NO_TLS` в
`asdf-version-list.fscript` нет. Проба сборки пакета — задача 3401.

## Где живёт правка

`docs/examples/package/flang.package`, `docs/examples/package/shop/shop.flang`,
`docs/examples/package/shop/discount.flang-package` (пересобрать командой, не
руками), `docs/road-to-1-0.md`, `scripts/release/asdf-version-list.fscript`.
Пересборка семени (bootstrap regeneration) не нужна.
