---
номер: 5821
заголовок: В scripts/ остаётся 9 скриптов оболочки, хотя скрипты дерева должны быть планами на flang
статус: свободна
приоритет: P2
исполнитель: —
ветка: —
команда: вторая
карта: Что мешает больше всего
рядом: —
нужность: требование владельца — в дереве только fscript, без скриптов оболочки
---

# 5821. В scripts/ остаётся 9 скриптов оболочки, хотя скрипты дерева должны быть планами на flang

Уклад переноса: старый `.sh` снимается, план зовётся из того же ярлыка, хука
или работы CI, равенство показывается парой прогонов на одних входах, и у плана
есть проба, красная на подлоге.

## Шаги воспроизведения

1. `git ls-files scripts | grep '\.sh$'`
2. `git ls-files | grep -c '\.sh$'`

## Что происходит

```
$ git ls-files scripts | grep '\.sh$'
scripts/bootstrap-reprint.sh
scripts/guards/bad-octet-guard.sh
scripts/guards/hand-written-lists.sh
scripts/guards/module-origin-guard.sh
scripts/guards/one-string-measure-guard.sh
scripts/guards/overlong-string-guard.sh
scripts/guards/published-vs-tree.sh
scripts/targets/identical-declarations.sh
scripts/targets/target-collisions.sh
$ git ls-files | grep -c '\.sh$'
45
```

Версия: flang 0.7.23.

Что делать с каждым:

1. `scripts/bootstrap-reprint.sh` делится на четыре части: проверка `--telo`
   (зовётся до сборки, остаётся оболочкой или становится целью печатаемого
   Makefile — правка в `flang/self/emit-c.flang`); отпечаток (`--otpechatok`,
   `--bystro`, `--stroki`); сверка имён и тел ядра (`--imena`, `--тела`);
   печать с `--check`, `--build`, `--замкнутость`. Строка
   `SECOND_PRINT=scripts/bootstrap-c.sh` указывает на снятый файл — пределы
   второго пути печати живут в `scripts/bootstrap-c.fscript` (читает их из
   `bootstrap-reprint.sh`); проверку `same_numbers_in_second_print` снять или
   перевести.
2. `scripts/targets/target-collisions.sh` и его `scripts/targets/names-in-c.awk`
   — в план.
3. `scripts/targets/identical-declarations.sh` — в план, без `jq` и без
   node-библиотеки замыкания.
4. Шесть проверок в `scripts/guards/`: `bad-octet-guard.sh`,
   `hand-written-lists.sh`, `module-origin-guard.sh`,
   `one-string-measure-guard.sh`, `overlong-string-guard.sh`,
   `published-vs-tree.sh`.

Чего не хватает в `flang io`, чтобы перенос шёл дальше: ключ, сужающий журнал
поручений; проброс чужого кода возврата; слияние потоков потомка.

## Что должно быть

В `scripts/` нет файлов `.sh`, кроме тех, что исполняются до сборки двоичного
и потому планом быть не могут; каждое такое исключение названо в этой задаче
с причиной.

## Обходной путь

Не нужен: скрипты оболочки работают.

## Когда задача сделана

`git ls-files scripts | grep -c '\.sh$'` даёт число названных исключений. Для
каждого перенесённого файла: `.sh` снят, зовущие переведены, пара прогонов
«старый против нового» сошлась, проба на подлоге даёт код 1.

## Где живёт правка

`scripts/**/*.sh` и их зовущие: `.flangrc`, `.githooks/pre-push.fscript`,
`.github/workflows/*.yml`. Общие части планов — `scripts/inquiry.fscript`,
`scripts/reading.fscript`, `scripts/rules.fscript`. Проброс кода возврата и
слияние потоков — в `flang/src/emit/c/flang_repl.c` (хозяин `flang io`),
доезжает перепечаткой. После переноса переснять `docs/tree-inventory.md`.
