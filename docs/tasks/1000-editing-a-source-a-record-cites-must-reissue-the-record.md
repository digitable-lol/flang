---
номер: 1000
заголовок: У 71 записи доказательства нет своего отпечатка SHA-256 исходника — привязку держит отдельная таблица
статус: свободна
приоритет: P2
исполнитель: —
ветка: —
команда: вторая
карта: Как перепроверить всё это самому
рядом: 9612, 9967
нужность: запись без SHA-256 привязана к программе только числом строк и знаков, и подмену того же размера сама не замечает
---

# 1000. У 71 записи доказательства нет своего отпечатка SHA-256 исходника — привязку держит отдельная таблица

## Шаги воспроизведения

1. Посчитать записи со слабой привязкой:

```
bootstrap/flang io scripts/guards/record-follows-its-source.fscript --plan Проверка
wc -l scripts/ledgers/record-source-digests.tsv
```

2. Собрать независимую проверяющую программу (proof checker) из
   `flang/proof/checker/checker.c` и подать ей такую запись с программой того же
   размера, но с ложным утверждением. В пустом каталоге:

```
cc -O1 -o checker <дерево>/flang/proof/checker/checker.c
mkdir -p flang/proof/examples
cp <дерево>/flang/proof/checker/tests/programs/lie-collision.flang flang/proof/examples/corpus-natural.flang
cp <дерево>/flang/proof/checker/tests/records/record-fields/natural-00-honest.record .
./checker flang/proof/examples/corpus-natural.flang natural-00-honest.record
```

## Что происходит

```
$ bootstrap/flang io scripts/guards/record-follows-its-source.fscript --plan Проверка
{"plan":"Проверка","result":"записей 570: с sha256 458, со слабой привязкой 71,
 без исходника в дереве 41; отвязанных нарочно 7, все названы в ведомости —
 сходится",…}                                                     код 0
$ wc -l scripts/ledgers/record-source-digests.tsv
72                                                                код 0
$ ./checker flang/proof/examples/corpus-natural.flang natural-00-honest.record
НЕ ПРОВЕРЕНО — привязка к программе не криптографическая (строки «отпечаток256»
в записи нет), и записанное доказательством не является: …        код 3
```

Версия: flang 0.7.23. Дата прогона: 30 сентября 2026.

У 71 записи в шапке нет строки `отпечаток256`. Число строк, число знаков и
многочленный отпечаток у подменённой программы совпадают с честной, поэтому
проверяющая программа такую запись не отвергает кодом 1, а отвечает кодом 3.
Подмену в дереве ловит только таблица `scripts/ledgers/record-source-digests.tsv`
(71 строка данных), которую ведёт проверка. Из 71 записи 67 лежат в
`flang/proof/checker/tests/records`, 4 — в `flang/proof/forgeries`; у 66 в записи
нарочно внесена порча, и простой перевыпуск её сотрёт.

## Что должно быть

Каждая запись дерева несёт `отпечаток256` своего исходника, как его пишет
нынешний компилятор. Таблица отпечаток-за-запись не нужна: привязку проверяет
сама запись.

## Обходной путь

Проверка `scripts/guards/record-follows-its-source.fscript` стоит в
`.githooks/pre-push.fscript` и в `.github/workflows/binary.yml`; она сверяет
такие записи с таблицей. Таблицу переснимает план `Снять`.

## Когда задача сделана

```
bootstrap/flang io scripts/guards/record-follows-its-source.fscript --plan Проверка
```

печатает «со слабой привязкой 0», код 0; в `record-source-digests.tsv` остаётся
одна строка заголовка. План `Подлог` той же проверки по-прежнему отвечает
кодом 1. Набор проб `flang/proof/checker/tests/run.sh` и
`flang/proof/forgeries/run.sh` отвечают кодом 0: каждая подделка отвергается той
же причиной, что и до перевыпуска.

## Где живёт правка

Записи в `flang/proof/checker/tests/records` и `flang/proof/forgeries`.
Честная запись перевыпускается командой
`bootstrap/flang check <исходник> --proof --record <запись>`; у подделки после
перевыпуска заново вносится та же порча, названная в её пробе. Затем план
`Снять` и, если нужно, ожидаемые коды в `flang/proof/checker/tests/run.sh`.
Пересборка семени (bootstrap regeneration) не нужна.

Отдельная задача, здесь не решается: `flang/proof/check.sh` (проверяющая
программа на flang, `flang/proof/checker.flang`) строку `отпечаток256` не читает
вовсе и на подменённой программе отвечает «сошлось», код 0, даже для записи с
отпечатком.
