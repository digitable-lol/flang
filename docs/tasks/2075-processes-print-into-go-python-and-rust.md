---
номер: 2075
заголовок: Процессы не печатаются в go, python и rust, а план — в cpp, csharp, elixir и java
статус: свободна
приоритет: P3
исполнитель: —
ветка: —
команда: первая
карта: Чего в языке нет вовсе
рядом: 8589
нужность: программа с процессами или планом собирается только в части целей печати
---

# 2075. Процессы не печатаются в go, python и rust, а план — в cpp, csharp, elixir и java

Это возможность, которой нет, а не дефект: отказ назван прямо.

## Шаги воспроизведения

1. Программа с процессом: `docs/examples/service-on-processes/service.flang`.
2. `bootstrap/flang emit docs/examples/service-on-processes/service.flang --target go --out d`
   (то же с `--target python`, `--target rust`).
3. Программа с планом: `flang/proof/probes/plans-in-targets/programs/round-trip.flang`,
   цели `cpp`, `csharp`, `elixir`, `java`.

## Что происходит

Шаг 2 — код 1 и «у цели «go» нет планировщика конкурентности, а в программе
объявлена конкурентность (…)»; каталог не создан. Шаг 3 — код 1 и
`FLANG_PLAN_UNSUPPORTED`. Версия: flang 0.7.25, 12 октября 2026.

План с ADR-0100 печатается в `c`, `go`, `js`, `python`, `rust`, `ts` (в
четыре первые — после перепечатки семени); процессы — в `c`, `elixir`, `js`,
`ts`.

## Что должно быть

Процессы печатаются в `go`, `python`, `rust` с планировщиком в рантайме цели,
прогон (`прогон`) даёт тот же журнал, что свидетель; план печатается в `cpp`,
`csharp`, `elixir`, `java` тем же устройством, что в ADR-0100.

## Обходной путь

Процессы — цели `c`, `elixir`, `js`, `ts`; план — `flang io` или цели из
ADR-0100.

## Когда задача сделана

`flang emit … --target go|python|rust` на `service.flang` — код 0, и сборка
компилятором цели проходит; проба вида `flang/proof/probes/plans-in-targets`
сверяет прогоны процессов с `flang run`. Строки `cpp`, `csharp`, `elixir`,
`java` в той пробе дают тот же итог, что `flang io`.

## Где живёт правка

`flang/self/emit-go.flang`, `emit-python.flang`, `emit-rust.flang` (печать
объявлений процессов данными), планировщик в `flang/src/emit/<цель>/` по
образцу `flang/src/emit/js/flang_conc.js`; `flang/self/bootstrap/compiler.flang`
(«Отказ по конкурентности целью», «Отказ по плану»). Правка в `flang/self/**`
требует перепечатки семени.

Следующий шаг: у `cpp` план почти даром — прогонщик тот же `flang_cli.c`, нужна
только строка `#define FL_PROGRAM_IO_PLANS` в печати `flang/self/emit-cpp.flang`
и снятие «Отказа по плану» для «cpp»; затем планировщик Python по образцу
`flang_conc.js`.
