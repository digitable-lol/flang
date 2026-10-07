---
номер: 8309
заголовок: Пять примеров в docs всё ещё пишут тип как «нат» вместо «неотрицательное»
статус: свободна
приоритет: P3
исполнитель: —
ветка: —
команда: любая
карта: Куда идём
рядом: 5188
нужность: пока примеры пишут старое имя, его нельзя снять из языка
---

# 8309. Пять примеров в docs всё ещё пишут тип как «нат» вместо «неотрицательное»

Тип переименован в «неотрицательное» по всему дереву; «нат» остаётся принятым
синонимом до 1.0. Не переименованы примеры ниже. Пробы и корпус сверщика, где
старое имя стоит нарочно, в эту задачу не входят: их снимает задача 5188.

## Шаги воспроизведения

1. `grep -rcE '(: |возвращает |список )нат([^а-яёА-ЯЁ]|$)' docs/examples docs/benchmarks --include='*.flang' | grep -v ':0$'`
2. `bootstrap/flang package docs/examples/package/discount.flang`

## Что происходит

```
$ grep -rcE '(: |возвращает |список )нат([^а-яёА-ЯЁ]|$)' docs/examples docs/benchmarks --include='*.flang' | grep -v ':0$'
docs/examples/package/discount.flang:2
docs/examples/pythagoras/euclid-formula.flang:4
docs/examples/pythagoras/hypotenuse-square.flang:4
docs/benchmarks/verdict-cache/cache-probe.flang:2
docs/examples/io/progress-bar-on-screen.flang:3
$ bootstrap/flang package docs/examples/package/discount.flang
FLANG_PACKAGE: в flang.package пакет назван «Скидка», а модуль в docs/examples/package/discount.flang называется «Discount»     код 1
```

Пример пакета едет дословной копией внутри
`docs/examples/package/shop/discount.flang-package`. Переименовать исходник, не
пересобрав пакет, нельзя, а пересобрать мешает отказ `flang package` (задачи
3401 и 3402).

Версия: flang 0.7.23.

## Что должно быть

Живые примеры пишут `неотрицательное`. Первая команда из шагов печатает пустой
вывод.

## Обходной путь

Не нужен: оба имени работают.

## Когда задача сделана

1. Четыре примера (`docs/examples/pythagoras/`, `docs/examples/io/`,
   `docs/benchmarks/verdict-cache/`) переименованы; `bootstrap/flang check` на
   каждом отвечает так же, как до правки.
2. `docs/examples/package/discount.flang` переименован вместе с пересборкой
   пакета, после починки `flang package`.
3. `bootstrap/flang run-script seed:type-words` отвечает кодом 0.

## Где живёт правка

Пять файлов из вывода выше и `docs/examples/package/shop/discount.flang-package`.
Перепечатка не нужна.
