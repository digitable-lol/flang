---
номер: 1104
заголовок: Ключ «--размещение» объявлен в исходнике и в документации, а двоичный его не знает
статус: свободна
приоритет: P2
исполнитель: —
ветка: —
команда: любая
карта: Что мешает больше всего
рядом: 1116, 2213
нужность: свести программу с размещением процессов по узлам двоичным нечем, хотя документация подаёт это рабочим приёмом
---

# 1104. Ключ «--размещение» объявлен в исходнике и в документации, а двоичный его не знает

Заявка: https://github.com/digitable-lol/flang/issues/104

## Шаги воспроизведения

1. Программа и размещение из дерева:
   `flang/concurrency/examples/distributed.flang` и
   `flang/concurrency/examples/distributed.json`.
2. Команды:

```
bootstrap/flang check flang/concurrency/examples/distributed.flang --размещение flang/concurrency/examples/distributed.json
bootstrap/flang check flang/concurrency/examples/distributed.flang --placement flang/concurrency/examples/distributed.json
bootstrap/flang check --help | grep -c 'размещ'
```

3. Смотреть сообщение и код возврата.

## Что происходит

```
$ bootstrap/flang check flang/concurrency/examples/distributed.flang --размещение flang/concurrency/examples/distributed.json
flang check: непонятный ключ «--размещение»                      код 2
$ bootstrap/flang check flang/concurrency/examples/distributed.flang --placement flang/concurrency/examples/distributed.json
flang check: непонятный ключ «--placement»                       код 2
$ bootstrap/flang check --help | grep -c 'размещ'
0
```

Версия: flang 0.7.23. Дата прогона: 30 сентября 2026.

`flang/self/cli.flang` объявляет ключ полями «размещение» и «есть размещение»
записи «Ключи вызова» и печатает его в своей справке. Разбор ключей команды
`check` в двоичном написан отдельно, в `flang/src/emit/c/flang_repl.c`, и этого
ключа там нет. Причина шире одного ключа: процессов, надзора и
распределённости двоичный не проверяет вовсе, и `flang check --help` говорит
об этом прямо. Расхождение записано в `flang/scripts/cli-keys-debt.json`.

## Что должно быть

Двоичный выпуска понимает ключ, объявленный в исходнике того же выпуска.
`docs/flang/concurrency/SPEC.md` и `docs/flang/concurrency/DISTRIBUTED.md`
называют `flang check --размещение узлы.json` способом свести программу с
размещением процессов по узлам.

## Обходной путь

Обходного пути нет: свести программу с размещением двоичным нечем.

## Когда задача сделана

Выбрано и записано решением одно из двух:

1. двоичный сводит программу с размещением — обе команды из шагов отвечают
   вердиктом, а не отказом разбора ключа;
2. ключ снят из `flang/self/cli.flang` и из документации о распределённости,
   пока слоя процессов в двоичном нет.

До этого решения на оба написания ключа двоичный отвечает «не поддерживается:
процессов двоичный не проверяет» и кодом 2 вместо «непонятный ключ». Проба с
этим ответом стоит в наборе `flang/proof/probes/run` и краснеет, если ответ
снова станет «непонятный ключ». Обе записи о ключе из
`flang/scripts/cli-keys-debt.json` убраны.

## Где живёт правка

Отказ с названной причиной — разбор ключей `check` в
`flang/src/emit/c/flang_repl.c`. Слой процессов — каталог `flang/self` и
`flang/src/emit/c/flang_conc.c`. И то и другое доезжает до двоичного только
пересборкой семени (bootstrap regeneration). Проба и запись в
`flang/scripts/cli-keys-debt.json` пересборки не требуют.
