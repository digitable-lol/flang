---
номер: 5821
заголовок: В scripts/ остаётся 13 скриптов оболочки, хотя скрипты дерева должны быть планами на flang
статус: свободна
приоритет: P2
исполнитель: —
ветка: —
команда: вторая
карта: Что мешает больше всего
рядом: —
нужность: требование владельца — в дереве только fscript, без скриптов оболочки
---

# 5821. В scripts/ остаётся 13 скриптов оболочки, хотя скрипты дерева должны быть планами на flang

Перепись скриптов с причиной по каждому («упирается во что») лежит в
`docs/shell-to-flang-census.md`. Там же уклад переноса: старый `.sh` снимается,
план зовётся из того же ярлыка, хука или работы CI, равенство показывается
парой прогонов на одних входах, и у плана есть проба, красная на подлоге.

## Шаги воспроизведения

1. `git ls-files scripts | grep -c '\.sh$'`
2. `git ls-files | grep -c '\.sh$'`

## Что происходит

```
$ git ls-files scripts | grep -c '\.sh$'
13
$ git ls-files | grep -c '\.sh$'
49
```

Версия: flang 0.7.23, 2 октября 2026, ствол 0241d36b0.

## Что должно быть

В `scripts/` нет файлов `.sh`, кроме тех, что исполняются до сборки двоичного
и потому планом быть не могут; каждый такой назван в
`docs/shell-to-flang-census.md` с причиной.

## Обходной путь

Не нужен: скрипты оболочки работают.

## Когда задача сделана

`git ls-files scripts | grep -c '\.sh$'` даёт число оставшихся исключений, и
оно равно числу строк «остаётся» в переписи. Для каждого перенесённого файла:
`.sh` снят, зовущие переведены, пара прогонов «старый против нового» записана в
переписи, проба на подлоге даёт код 1.

Сегодня не равно: 13 против двух строк «остаётся». Перепись
`docs/shell-to-flang-census.md` снята 23 сентября 2026 на 41 файле в `scripts/`, и с тех
пор её числа не пересняты; отдельной задачи на перепись в дереве нет.

Эти тринадцать и есть весь остаток (`git ls-files scripts | grep '\.sh$'`); каждый
назван в `docs/shell-to-flang-census.md`, там же причина по файлу:

1. `scripts/bootstrap-reprint.sh` делится на четыре части: проверка `--telo`
   (зовётся до сборки, остаётся оболочкой или становится целью печатаемого
   Makefile — правка в `flang/self/emit-c.flang`); отпечаток (`--otpechatok`,
   `--bystro`, `--stroki`); сверка имён и тел ядра (`--imena`, `--тела`);
   печать с `--check`, `--build`, `--замкнутость`.
2. ~~`scripts/seed/seed-freshness.sh`~~ СНЯТ 4 октября 2026: переходник в три
   строки не только дублировал `scripts/seed/seed-freshness.fscript`, но и ТЕРЯЛ
   довод — `exec` без `"$@"`, из-за чего единственный зовущий спрашивал
   `--chto "доля доказанного"`, а проверка отвечала про «эту проверку».
   `scripts/guards/published-vs-tree.sh` зовёт теперь ярлык
   `bootstrap/flang run-script seed:freshness --what …`.
3. `scripts/targets/target-collisions.sh` и `scripts/targets/identical-declarations.sh`
   — см. «Осталось» ниже.
4. Девять проверок в `scripts/guards/`: `bad-octet-guard.sh`,
   `guards-without-forgery-probe.sh`, `hand-written-lists.sh`,
   `module-origin-guard.sh`, `one-string-measure-guard.sh`,
   `overlong-string-guard.sh`, `proved-share-vs-tree.sh`, `published-vs-tree.sh`,
   `version-derivations-guard.sh` — по причинам из переписи.

Чего не хватает в `flang io`, чтобы перенос пошёл дальше, перечислено в
разделе «Что сдвинуло бы перепись дальше, числом» той же переписи: ключ,
сужающий журнал поручений; проброс чужого кода возврата; слияние потоков
потомка.

## Где живёт правка

`scripts/**/*.sh` и их зовущие: `.flangrc`, `.githooks/pre-push.fscript`,
`.github/workflows/*.yml`. Общие части планов — `scripts/inquiry.fscript`,
`scripts/reading.fscript`, `scripts/rules.fscript`. Проброс кода возврата и
слияние потоков — в `flang/src/emit/c/flang_repl.c` (хозяин `flang io`),
доезжает перепечаткой. После переноса переснять `docs/tree-inventory.md` и
`docs/shell-to-flang-census.md`.

## Осталось

- `scripts/targets/target-collisions.sh` и его `scripts/targets/names-in-c.awk` — в план;
- `scripts/targets/identical-declarations.sh` — в план, без `jq` и без node-библиотеки замыкания;
- `scripts/bootstrap-reprint.sh`: строка `SECOND_PRINT=scripts/bootstrap-c.sh` указывает на снятый файл — пределы второго пути печати теперь в `scripts/bootstrap-c.fscript` (читает их из `bootstrap-reprint.sh`), проверку `same_numbers_in_second_print` снять или перевести.
