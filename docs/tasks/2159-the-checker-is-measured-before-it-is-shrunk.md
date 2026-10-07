---
номер: 2159
заголовок: В независимой проверяющей программе 8127 строк кода, ровно потолок, и с каждым правилом их больше
статус: свободна
приоритет: P2
исполнитель: —
ветка: —
команда: любая
карта: Что мешает больше всего
рядом: 8121, 9790, 1307, 1311
нужность: проверяющей программе верят целиком, поэтому её размер и есть размер доверенной базы (TCB)
---

# 2159. В независимой проверяющей программе 8127 строк кода, ровно потолок, и с каждым правилом их больше

## Шаги воспроизведения

1. Снять число строк кода независимой проверяющей программы (proof checker)
   `flang/proof/checker/checker.c` без комментариев и пустых строк и сравнить с
   потолком:

```
bootstrap/flang io flang/proof/tables-guard.fscript --plan 'Tables guard' --timeout 600000 -- --code-lines
grep -a '^checker-code-lines' flang/proof/ratchets.txt
wc -l flang/proof/checker/checker.c
grep -ac '^static' flang/proof/checker/checker.c
```

## Что происходит

```
$ bootstrap/flang io flang/proof/tables-guard.fscript --plan 'Tables guard' --timeout 600000 -- --code-lines
{"plan":"Tables guard","result":"8127", …}                        код 0
$ grep -a '^checker-code-lines' flang/proof/ratchets.txt
checker-code-lines 8127                                           код 0
$ wc -l flang/proof/checker/checker.c
10505 flang/proof/checker/checker.c                               код 0
$ grep -ac '^static' flang/proof/checker/checker.c
595                                                               код 0
```

Запаса под потолком нет: следующее правило вывода требует поднять потолок.
Повторяющегося кода в файле почти нет, функции мелкие; рост идёт от разбора шага
записи по видам правил: `шаг_вывода` и функции `семейство_н`, `семейство_р`,
`семейство_о` ветвятся по именам правил, а правил в
`flang/proof/tables/inference-rules.tsv` 114.

## Что должно быть

Строк кода меньше 7531, и новое правило вывода не прибавляет ветку в C: правило
читается из той же таблицы, по которой сверены леммы в
`flang/proof/lean/Rules.lean` (имя правила, посылки, проверка). Отдельно названо
числом, сколько строк приходится на то, что таблицей не заменить: разбор записи,
арифметика, свёртки, SHA-256. Эта часть проверена на ошибки памяти и
переполнения инструментом (CBMC или Frama-C), цена такой проверки измерена.

Переписывать проверяющую программу на flang нельзя: она перестанет быть
независимой от компилятора. Комментарии не сокращать: в счёт идут строки кода.

## Обходной путь

Поднимать потолок `checker-code-lines` в `flang/proof/ratchets.txt` с каждым
новым правилом.

## Когда задача сделана

```
bootstrap/flang io flang/proof/tables-guard.fscript -- --code-lines               меньше 7531
bootstrap/flang io flang/proof/checker/tests/run.fscript                          «сошлось всё», код 0
bootstrap/flang io scripts/provability.fscript --plan Verdict --timeout 900000    ДОКАЗУЕМ, код 0
```

Потолок `checker-code-lines` в `flang/proof/ratchets.txt` опущен до нового
числа, `checker-primitives` не вырос. Проверка
`bootstrap/flang io flang/proof/tables-guard.fscript` краснеет, если строк кода
снова больше потолка.

## Где живёт правка

`flang/proof/checker/checker.c`, `flang/proof/ratchets.txt`,
`flang/proof/tables/inference-rules.tsv`. Проверяющая программа собирается
компилятором C отдельно от `bootstrap/flang`; пересборка семени (bootstrap
regeneration) не нужна.
