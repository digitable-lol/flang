---
номер: 7182
заголовок: Ни одна проба не краснеет, если напечатанный Makefile снова перестанет знать заголовки
статус: в работе — печатник Makefile починен в `flang/self/emit-c.flang`, но Makefile семени печатает печатник: печать 1 партии 8 (семя 0.7.28) дала прежний Makefile, `makefile-headers:check` на нём красна — «НЕ ПЕРЕСОБИРАЕТСЯ: flang_repl.o — flang_repl.c включает tls_client.c / tls_client.h»; вторая печать снята (задача 6425), шаг CI до следующей печати идёт с continue-on-error
приоритет: P1
исполнитель: reprint-recipe
ветка: a/reprint-cost-and-makefile-probe
команда: первая
карта: Цена самосборки
рядом: —
нужность: новый компилятор, слинкованный со старым рантаймом, даёт ложный красный или ложный зелёный
---

# 7182. Ни одна проба не краснеет, если напечатанный Makefile снова перестанет знать заголовки

`bootstrap/Makefile` печатается компилятором (`flang/self/emit-c.flang`,
функции `«Печать Makefile»` и `«Зависимости заголовков Makefile»`). Он
выписывает транзитивное замыкание заголовков каждого исходника, считая только
те, что печать кладёт рядом:

```
flang_runtime.o: flang_runtime.c flang_runtime.h
compiler_flang.o: compiler_flang.c compiler_flang.h flang_runtime.h
flang_cli.o: flang_cli.c flang_runtime.h
flang_repl.o: flang_repl.c flang_runtime.h
```

В процессной сборке к этому добавляется `flang_conc.o`, и `flang_conc.h`
входит в замыкание модуля и прогонщика; без процессов имени `flang_conc` в
Makefile нет вовсе (постусловие `«без процессов движка нет»`).

Печать держат примеры и постусловия в `flang/self/emit-c.flang`. Чего нет —
пробы над собранным семенем: если зависимости из напечатанного Makefile
пропадут, объектный файл рантайма, собранный со старым заголовком, снова
слинкуется с новым компилятором, и ничто в дереве этого не заметит.

## Шаги воспроизведения

0. `make -C bootstrap -j4 CFLAGS='-std=c99 -O2' flang` — без собранных объектных
   файлов `make -n` называет пересборку всех четырёх, и шаги ниже ничего не
   различают.
1. `make -n -W compiler_flang.h -C bootstrap` — называет пересборку
   `compiler_flang.o`, затем `ar` и линковку.
2. `make -n -W flang_runtime.h -C bootstrap | grep -c -- '-c -o'` — 4.
3. `grep -rln 'make -n -W\|старше заголовка' scripts/seed scripts/guards .github` —
   ни одной пробы.

## Что происходит

Поведение верное, но держится только на тексте печатника: проверки, которая
сравнивает время объектного файла с временем его заголовков или спрашивает
`make -n -W`, в дереве нет. Прогон 11 октября 2026 (flang 0.7.25, дерево
1149c78f7): шаг 1 называет один `-c -o compiler_flang.o`, затем `ar` и линковку;
шаг 2 отвечает 4; шаг 3 не называет ни одного файла.

## Что должно быть

Проверка происхождения двоичного (`scripts/seed/binary-origin.fscript`) либо
отдельная проба краснеет, когда объектный файл старше своего заголовка или
когда `make -n -W <заголовок>` не называет пересборку зависящих от него
объектных файлов.

## Обходной путь

Собирать с ключом `-B`: `make -C bootstrap -B`.

## Когда задача сделана

- проба на нетронутом семени зелена;
- подделка: из копии `bootstrap/Makefile` убрана строка
  `compiler_flang.o: … flang_runtime.h` — проба краснеет и называет
  `compiler_flang.o`;
- отрицательный контроль: правка `compiler_flang.h` пересобирает
  `compiler_flang.o` и не трогает `flang_runtime.o`, `flang_cli.o`,
  `flang_repl.o` — проба это различает.

## Где живёт правка

`scripts/seed/binary-origin.fscript` или новая проба в `scripts/seed/`, зов —
в CI рядом со сборкой семени. Перепечатка не нужна.

## Следующий шаг

Новый план `scripts/seed/makefile-headers-probe.fscript`: прочитать `bootstrap/Makefile`,
потребовать у каждой строки `*.o:` все заголовки её замыкания и спросить
`make -n -W flang_runtime.h -C bootstrap` ровно о четырёх пересборках; подлог — копия
Makefile без строки `compiler_flang.o: … flang_runtime.h`. Проба, которая краснеет
сегодня: шаг 3 — ни одного файла с такой проверкой в `scripts/seed`, `scripts/guards`
и `.github`.

## Ход работы (15 октября 2026)

Проба — `scripts/seed/makefile-headers-probe.fscript`, ярлыки
`makefile-headers:check` и `makefile-headers:forgery`, зов — работа `build` в
`.github/workflows/binary.yml`. Она читает `#include "…"` каждого файла семени,
строит транзитивное замыкание по файлам, лежащим рядом, и на копии семени с
пустыми исходниками и поддельными объектными файлами спрашивает
`make -n -W <файл>` о каждом включённом файле. Пересобраться обязаны ровно те
объектные файлы, чьи исходники файл включают, — ни больше, ни меньше.
Компилировать ничего не нужно: прогон — секунды.

- Семя 0.7.28 как есть — код 1:
  `НЕ ПЕРЕСОБИРАЕТСЯ: flang_repl.o — flang_repl.c включает tls_client.c (сам или
  через другой файл), а make -n -W tls_client.c его не зовёт`, и то же для
  `tls_client.h`. Клиент TLS печатается отдельной печатью и включается оболочкой
  через `__has_include`, а печатник Makefile о нём не знал.
- Починка печатника: `«Клиент TLS оболочки в Makefile»` в
  `flang/self/emit-c.flang` дописывает
  `flang_repl.o: $(wildcard tls_client.c tls_client.h)` — есть файлы, есть и
  зависимость; нет — нет. На копии семени с этой строкой проба — код 0:
  `compiler_flang.h → compiler_flang.o`,
  `flang_runtime.h → flang_runtime.o compiler_flang.o flang_cli.o flang_repl.o`,
  `tls_client.c → flang_repl.o`, `tls_client.h → flang_repl.o`.
- Подлог (`makefile-headers:forgery`): без строки `compiler_flang.o:` названо
  `НЕ ПЕРЕСОБИРАЕТСЯ: compiler_flang.o` для `compiler_flang.h` и
  `flang_runtime.h`; код 0.
- Отрицательный контроль: `compiler_flang.h`, приписанный к `flang_cli.o`, —
  `ЛИШНЯЯ ПЕРЕСБОРКА: flang_cli.o`; на честной копии `compiler_flang.h`
  пересобирает только `compiler_flang.o`.

Не сделано: проба зелена на копии, а не на семени. Зелёной на `bootstrap/` её
делает перепечатка, которая унесёт правку печатника в `bootstrap/Makefile`.

