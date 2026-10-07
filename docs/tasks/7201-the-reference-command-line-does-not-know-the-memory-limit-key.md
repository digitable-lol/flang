---
номер: 7201
заголовок: Эталон разбора командной строки на flang не знает ключа --memory-limit, который знает двоичный
статус: свободна
приоритет: P3
исполнитель: —
ветка: —
команда: любая
карта: Что мешает больше всего
рядом: 3787
нужность: эталон на flang и двоичный судят разный набор ключей
---

# 7201. Эталон разбора командной строки на flang не знает ключа --memory-limit, который знает двоичный

Заявка: https://github.com/digitable-lol/flang/issues/160, пункт 1.

## Шаги воспроизведения

1. `grep -c 'memory-limit' flang/self/cli.flang`
2. `grep -c 'step-limit' flang/self/cli.flang`
3. `grep -c 'memory-limit' flang/src/emit/c/flang_cli.c`
4. `grep -c 'memory-limit' docs/site/cli.ru.md`

## Что происходит

```
$ grep -c 'memory-limit' flang/self/cli.flang
0                                                           код 1
$ grep -c 'step-limit' flang/self/cli.flang
8                                                           код 0
$ grep -c 'memory-limit' flang/src/emit/c/flang_cli.c
1                                                           код 0
$ grep -c 'memory-limit' docs/site/cli.ru.md
4                                                           код 0
```

Версия: flang 0.7.23.

Ключ знают двоичный и страницы команд: `flang --предел-памяти`/`--memory-limit`
разбирается в `flang/src/emit/c/flang_cli.c`, справка называет его числом
(`--memory-limit N`), проба — `flang/proof/probes/memory-limit/run.fscript`. Не
знает только эталон.

Расхождение записано: `flang/scripts/cli-keys-debt.json`, раздел
`разряд-1-только-в-C` — 27 ключей, и оба написания предела памяти среди них. От
этой записи сторож ключей зелен: расхождение не потеряно, а отложено до
перепечатки семени.

## Что должно быть

Эталон на flang и двоичный судят один и тот же набор ключей: `--memory-limit N`
и `--предел-памяти N` с числом байт и буквой K, M, G, T (К, М, Г, Т), ноль —
без предела, негодное число — код 2 с текстом «не целое число байт».

## Обходной путь

Не нужен: ключ снимается в `main` до разбора команды, как `--step-limit`.

## Когда задача сделана

`grep -c 'memory-limit' flang/self/cli.flang` больше нуля, и примеры эталона
держат оба написания и отказ на «lots». Записи о пределе памяти в
`flang/scripts/cli-keys-debt.json` больше нет: ведомость сверяется в обе
стороны, и закрытый долг в ней краснеет.

## Где живёт правка

`flang/self/cli.flang`; разбор ключа в двоичном — `flang/src/emit/c/flang_cli.c`.
Требует перепечатки самосборной части.
