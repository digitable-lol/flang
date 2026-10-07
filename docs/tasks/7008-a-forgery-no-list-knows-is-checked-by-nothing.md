---
номер: 7008
заголовок: Подделка, которой не знает ни запись, ни опись, ни проба ядра, не проверяется ничем
статус: свободна
приоритет: P2
исполнитель: —
ветка: —
команда: любая
карта: Сколько доказано на самом деле
рядом: 1407, 1000, 1409
нужность: файл назван подделкой, а опровергнуть его некому: ни записи, ни строки в описи, ни места в пробе ядра
---

# 7008. Подделка, которой не знает ни запись, ни опись, ни проба ядра, не проверяется ничем

## Шаги воспроизведения

```
bootstrap/flang run-script traceability:check
grep -c forgery-if-without-descent-theorem flang/proof/forgeries/manifest.tsv flang/scripts/kernel-forgeries.fscript
ls flang/proof/checker/tests/records/corpus/ | grep -c without-descent-theorem
grep -rl forgery-if-without-descent-theorem --include='*.yml' --include='*.sh' --include='*.fscript' .
```

## Что происходит

```
  рода «требование → проверка»: в подделках 58 (запись говорит «нет вердикта» 46,
    отказ ядра без записи 11, НЕ ПРОВЕРЕНО НИЧЕМ 1), вне подделок 4
  подделки, которых не знают ни запись, ни опись, ни проба ядра:
      flang/proof/examples/forgery-if-without-descent-theorem.flang:6
        функция «Стоит на месте с теоремой» — «итог меньше нуля»
flang/proof/forgeries/manifest.tsv:0
flang/scripts/kernel-forgeries.fscript:0
0
```

Версия: flang 0.7.23.

Файл `flang/proof/examples/forgery-if-without-descent-theorem.flang` носит имя
подделки и содержит заведомо ложное постусловие «итог меньше нуля». Ждут от
такого файла одного: чтобы его отвергли, и чтобы отказ был виден прогоном. Ни
одного из трёх следов отказа у него нет — записи доказательства в корпусе нет,
в описи подделок `flang/proof/forgeries/manifest.tsv` строки нет, в пробе ядра
`flang/scripts/kernel-forgeries.fscript` имени нет. Единственное упоминание в
дереве — прозаическое, в `CHANGELOG.md`.

Соседний файл без слова `theorem` в имени
(`flang/proof/examples/forgery-if-without-descent.flang`) заведён как надо: у
него есть запись и строка в описи.

## Что должно быть

У подделки обязан быть ровно один из двух следов, и прогон обязан его
показывать:

1. запись доказательства в корпусе с вердиктом «нет вердикта» — тогда её
   переигрывает сверщик и считает `share:replay`; либо
2. строка в `flang/proof/forgeries/manifest.tsv` или имя в пробе ядра — тогда
   отказ проверяет `kernel-forgeries:check`.

После правки `traceability:check` печатает «НЕ ПРОВЕРЕНО НИЧЕМ 0», и строка
`требование → проверка без записи и без пробы` в
`scripts/ledgers/traceability-debt.tsv` опускается с 1 до 0.

## Обходной путь

Нет: место это невидимо любому прогону, кроме `traceability:check`, который о
нём и говорит.

## Когда задача сделана

1. `bootstrap/flang run-script traceability:check` печатает «НЕ ПРОВЕРЕНО
   НИЧЕМ 0» и выходит кодом 0.
2. В `scripts/ledgers/traceability-debt.tsv` строка `требование → проверка без
   записи и без пробы` равна 0.
3. Прогон, который отвергает этот файл, назван в задаче и прогнан: код и слова
   отказа выписаны.

## Где живёт правка

- `flang/proof/forgeries/manifest.tsv` либо `flang/scripts/kernel-forgeries.fscript`
  — там, где подделка объявляется;
- `flang/proof/checker/tests/records/corpus/` — если выбран путь записи;
- `scripts/ledgers/traceability-debt.tsv` — храповик долга.
