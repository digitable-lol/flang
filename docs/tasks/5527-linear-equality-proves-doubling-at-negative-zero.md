---
номер: 5527
заголовок: линейная арифметика доказывает «а плюс а равен 2 умножить на а» над «неотрицательное», а при а = −0 это ложно
статус: свободна
приоритет: P0
исполнитель: —
ветка: —
команда: первая
карта: Что мешает больше всего
рядом: —
нужность: ядро отвечает «доказано» о ложном утверждении — ошибка состоятельности
---

# 5527. Линейная арифметика равняет сумму с собой и удвоение на минус нуле

## Шаги воспроизведения

1. Программа `flang/proof/probes/typing-holes/programs/linear-equality-doubling-at-negative-zero.flang`:

```flang
модуль «Удвоение минус нуля»

тотальная функция «Дважды»
  принимает а: неотрицательное
  возвращает число
  обеспечивает «сумма с собой есть удвоение» результат равен (2 умножить на а)
  а плюс а
```

2. `bootstrap/flang check flang/proof/probes/typing-holes/programs/linear-equality-doubling-at-negative-zero.flang --proof`
3. `bootstrap/flang run flang/proof/probes/typing-holes/programs/linear-equality-doubling-at-negative-zero.flang --function 'Дважды' --args '{"а":-0}'`

## Что происходит

```
$ bootstrap/flang check flang/proof/probes/typing-holes/programs/linear-equality-doubling-at-negative-zero.flang --proof
… НЕ СОШЛОСЬ СО СВЕРЩИКОМ — … доказано 1 (до правки сверщика: ПРОВЕРЕНО САМОСТОЯТЕЛЬНО, код 0)
$ bootstrap/flang run flang/proof/probes/typing-holes/programs/linear-equality-doubling-at-negative-zero.flang --function 'Дважды' --args '{"а":-0}'
FLANG_PROPERTY: нарушено свойство «сумма с собой есть удвоение» функции «Дважды»                                  код 1
```

Версия: flang 0.7.34.

Минус ноль — значение типа `неотрицательное`. `−0 плюс −0` есть `−0`, а нулевое произведение язык отдаёт плюс нулём:
`2 умножить на −0` есть `+0`. Равенство языка различает знаки нуля. Сторож знака нуля у правила Лин5
(«Равенство без минус нуля линейно») считал, что произведение на литерал несёт знак нуля своего множителя.

## Что должно быть

Равенство, у которого одна сторона может быть минус нулём, а другая нет, линейной арифметикой не берётся:
сторона с произведением минус нулём не бывает.

## Обходной путь

Обхода нет: утверждение числится доказанным, и запуск идёт без согласия на недоказанное.

## Когда задача сделана

`bootstrap/flang check flang/proof/probes/typing-holes/programs/linear-equality-doubling-at-negative-zero.flang --proof` не числит ложное утверждение доказанным.
Проба — строки этой программы в `flang/proof/probes/typing-holes/expected.tsv`
и строка ведомости `flang/proof/tables/typing-holes.tsv`: сегодня они держат ответ
двоичного 0.7.34, после правки строка `proof` меняется с «доказано 1» на «доказано 0», строка ведомости — на `закрыта`.

## Где живёт правка

`flang/self/proof-kernel.flang`, «Слагаемый литерал двоичного линейно»: правка сделана в этой же ветке и ждёт печати
семени (партия 12). Сверщик на C (`flang/proof/checker/checker.c`, `ла_положителен`) и второй сверщик
(`flang/proof/checker/second/Linear.lean`, `«лаПоложителен»`) исправлены и отвечают «НЕ СОШЛОСЬ» уже сейчас; подделка —
`flang/proof/checker/tests/families/negative-zero/a-plus-a-doubling-proved.record`.
