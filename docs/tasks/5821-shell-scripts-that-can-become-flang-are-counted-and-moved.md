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
63
```

Версия: flang 0.7.23, 1 октября 2026.

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

Что известно про оставшиеся (не перепроверено):

1. `scripts/bootstrap-c.sh` переносим: двоичный он не собирает, а печатает
   `flang/self/bootstrap/compiler.flang` и сличает с `bootstrap/`. Пределы
   печати и вход переезжают в план, `scripts/bootstrap-reprint.sh` читает их
   оттуда.
2. `scripts/seed/seed-refresh.sh` переносим: план может пересобрать
   собственный двоичный через `make -C bootstrap`.
3. `scripts/bootstrap-reprint.sh` делится на четыре части: проверка `--telo`
   (зовётся до сборки, остаётся оболочкой или становится целью печатаемого
   Makefile — правка в `flang/self/emit-c.flang`); отпечаток (`--otpechatok`,
   `--bystro`, `--stroki`); сверка имён и тел ядра (`--imena`, `--тела`);
   печать с `--check`, `--build`, `--замкнутость`.
4. `scripts/seed/seed-freshness.sh` — переходник в три строки на
   `scripts/seed/seed-freshness.fscript`; снимается, когда
   `scripts/guards/published-vs-tree.sh` перестанет его звать.
5. `scripts/memory-limit.sh` отдаёт наружу чужой код возврата (137, код
   потомка), а план отдаёт только 0, 1 и 3: нужен проброс кода возврата из
   `flang io`.
6. `scripts/memory-headroom.sh` зовётся в `binary.yml` до сборки и после
   неудачной сборки, когда двоичного нет.
7. `scripts/targets/target-census.sh` назван местом отбора в
   `scripts/guards/file-extensions.fscript`; снятие файла без правки этой
   проверки её красит.
8. `scripts/repl-probe.sh` и `scripts/tutor-probe.sh` отвечали кодом 1 до
   переноса; сначала разобрать, почему.
9. `scripts/test-remote.sh` в режиме `--shell` отдаёт человеку оболочку по
   ssh: у плана нет ни ввода потомку, ни терминала.
10. Остальные проверки в `scripts/guards/*.sh` и три скрипта в
    `scripts/targets/` — по причинам из переписи.

Чего не хватает в `flang io`, чтобы перенос пошёл дальше, перечислено в
разделе «Что сдвинуло бы перепись дальше, числом» той же переписи: ключ,
сужающий журнал поручений; проброс чужого кода возврата; слияние потоков
потомка.

## Где живёт правка

`scripts/**/*.sh` и их зовущие: `ярлыки.flang`, `.githooks/pre-push.fscript`,
`.github/workflows/*.yml`. Общие части планов — `scripts/inquiry.fscript`,
`scripts/reading.fscript`, `scripts/rules.fscript`. Проброс кода возврата и
слияние потоков — в `flang/src/emit/c/flang_repl.c` (хозяин `flang io`),
доезжает перепечаткой. После переноса переснять `docs/tree-inventory.md` и
`docs/shell-to-flang-census.md`.

## Осталось

- `scripts/targets/target-collisions.sh` и его `scripts/targets/names-in-c.awk` — в план;
- `scripts/targets/identical-declarations.sh` — в план, без `jq` и без node-библиотеки замыкания;
- `scripts/seed/seed-freshness.sh` (переходник) — снять вместе с переводом `scripts/guards/published-vs-tree.sh`, его единственного зовущего;
- `scripts/bootstrap-reprint.sh`: строка `SECOND_PRINT=scripts/bootstrap-c.sh` указывает на снятый файл — пределы второго пути печати теперь в `scripts/bootstrap-c.fscript` (читает их из `bootstrap-reprint.sh`), проверку `same_numbers_in_second_print` снять или перевести.
