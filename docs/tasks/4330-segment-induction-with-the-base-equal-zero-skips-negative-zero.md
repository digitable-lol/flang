---
номер: 4330
заголовок: индукция по отрезку с дном «п равно 0» даёт шагу «п больше 0», а при п = −0 берётся ветвь шага
статус: свободна
приоритет: P0
исполнитель: —
ветка: —
команда: первая
карта: Что мешает больше всего
рядом: —
нужность: ядро отвечает «доказано» о ложном утверждении — ошибка состоятельности
---

# 4330. Дно отрезка «п равно 0» пропускает минус ноль

## Шаги воспроизведения

1. Программа `flang/proof/probes/typing-holes/programs/segment-base-equal-zero-skips-negative-zero.flang`:

```flang
модуль «Дно отрезка равенством нулю»

тотальная функция «До нуля»
  принимает а: неотрицательное
  возвращает число
  обеспечивает «итог ноль» результат равен 0
  пример «ноль»
    дано а равно 0
    ожидается 0
  если а равно 0 то 0 иначе (если а больше 0 то («До нуля» от (а минус 1)) иначе 99)
```

2. `bootstrap/flang check flang/proof/probes/typing-holes/programs/segment-base-equal-zero-skips-negative-zero.flang --proof`
3. `bootstrap/flang run flang/proof/probes/typing-holes/programs/segment-base-equal-zero-skips-negative-zero.flang --function 'До нуля' --args '{"а":-0}'`

## Что происходит

```
$ bootstrap/flang check flang/proof/probes/typing-holes/programs/segment-base-equal-zero-skips-negative-zero.flang --proof
… ПРОВЕРЕНО САМОСТОЯТЕЛЬНО — … доказано
$ bootstrap/flang run flang/proof/probes/typing-holes/programs/segment-base-equal-zero-skips-negative-zero.flang --function 'До нуля' --args '{"а":-0}'
FLANG_PROPERTY: нарушено свойство «итог ноль» функции «До нуля»                                  код 1
```

Версия: flang 0.7.34.

Минус ноль — значение типа `неотрицательное`, а `−0 равно 0` ложно: вычисление идёт в ветвь шага, где `а больше 0`
тоже ложно, и ответ 99. «Дно по операции» (`flang/self/proof-initial.flang`), случай `"eq"`, принимает форму
`п равно 0` дном и даёт шагу строгую положительность. Остальные четыре формы дна на −0 ложного не доказывают.

## Что должно быть

Форма `п равно 0` дном отрезка не читается (`FLANG_PROOF_INDUCTION_BRANCH`) либо шаг получает только
`не (п равно 0)` без строгой положительности.

## Обходной путь

Обхода нет: утверждение числится доказанным, и запуск идёт без согласия на недоказанное.

## Когда задача сделана

`bootstrap/flang check flang/proof/probes/typing-holes/programs/segment-base-equal-zero-skips-negative-zero.flang --proof` не числит ложное утверждение доказанным.
Проба — строки этой программы в `flang/proof/probes/typing-holes/expected.tsv`
и строка ведомости `flang/proof/tables/typing-holes.tsv`: сегодня они держат ответ
двоичного 0.7.34, после правки строка `proof` меняется, строка ведомости — на `закрыта`.

## Где живёт правка

`flang/self/proof-initial.flang`, «Дно по операции»; описание формы — `docs/flang/proof/SPEC.md`, раздел 3в. Правки в
этой ветке нет: сколько честных доказательств корпуса стоит на этой форме, без печати не измерить. Требует печати семени.
