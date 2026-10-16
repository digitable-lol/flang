---
номер: 1542
заголовок: Формула Homebrew не ставит сверщик, и flang check --proof у установленного flang всегда пишет «сверщика нет»
статус: свободна
приоритет: P2
исполнитель: —
ветка: —
команда: любая
карта: Что мешает больше всего
рядом: 3010, 1098
нужность: у поставивших из Homebrew независимой перепроверки нет
---

# 1542. Формула Homebrew не ставит сверщик, и flang check --proof у установленного flang всегда пишет «сверщика нет»

Заявка: https://github.com/digitable-lol/flang/issues/394

Формула ставит `flang` и `flangtutor`; сверщик `flang` ищет по пути `bin/../flang/proof/checker/сверщик`, которого в установке нет, а совет `make -C flang/proof/checker` выполнить негде.

## Шаги воспроизведения

1. `brew install digitable-lol/tap/flang`.
2. `flang check <файл> --proof` на программе с доказанным утверждением, `FLANG_CHECKER` не задан.
3. В дереве: `packaging/homebrew/flang.rb` — что ставит `install`.

## Что происходит

```
НЕЗАВИСИМО НЕ ПРОВЕРЕНО — сверщика нет (…/Cellar/flang/0.7.28/bin/../flang/proof/checker/сверщик; собрать: make -C flang/proof/checker либо назвать FLANG_CHECKER)
```

Версия: flang 0.7.28 (`bootstrap/flang` из дерева).

## Что должно быть

Архив выпуска несёт `checker.c`, формула собирает его и кладёт туда, где его ищет `flang` (или `flang` ищет сверщик рядом с собой в `libexec`), и `flang check --proof` перепроверяет доказанное без `FLANG_CHECKER`. То же у прочих каналов установки.

## Обходной путь

Склонировать тег, `make -C flang/proof/checker`, задать `FLANG_CHECKER`.

## Когда задача сделана

Прибор паритета установок (`packaging/install-parity.flang`) на каждой установке видит сверщик: `flang check --proof` не печатает «сверщика нет».

## Где живёт правка

`packaging/homebrew/flang.rb`, `packaging/homebrew/flang-package.rb.in`, сборка архива выпуска, поиск сверщика в `flang/src/emit/c/flang_repl.c`.
