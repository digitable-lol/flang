# Write-ahead log

`docs/examples/wal/` holds two programs. The first parses, prints and recovers a
write-ahead log after truncation. The second is a plan that appends one record
to the log. The programs themselves do not write to disk: the plan returns the
orders «Прочитать файл» (read file) and «Записать файл» (write file), and
`flang io` carries them out.

## What is in the directory

There are 2 `.flang` files: <!-- СНЯТО 2026-09-08 файлов docs/examples/wal/*.flang = 2 -->

| file | what it is | lines |
|---|---|---:|
| `docs/examples/wal/write-ahead-log.flang` | module «Write ahead log»: the record format, character-by-character parsing, printing, recovery up to the last whole record, the next number | 590 <!-- СНЯТО 2026-10-01 строк docs/examples/wal/write-ahead-log.flang = 590 --> |
| `docs/examples/wal/append-plan.flang` | module «Append plan»: the plan «Дописать в журнал» — read the file, append a record, confirm with its number. Uses the first module | 95 <!-- СНЯТО 2026-09-08 строк docs/examples/wal/append-plan.flang = 95 --> |

The two files together carry 110 examples <!-- СНЯТО 2026-09-08 примеров-в docs/examples/wal/*.flang = 110 -->;
they are written inside the functions.

## Record format

```
#<номер>:<длина>:<тело>;
```

* `<номер>` (number) and `<длина>` (length) are decimal numbers in canonical
  form: one to fifteen digits, no leading zero (the only lawful zero is `0`
  itself). The rule is the function «Канон числа».
* `<длина>` is the number of code points in the body, not bytes.
* `<тело>` (body) is exactly that many code points, any of them: `#`, `:`, `;`
  and line breaks are part of the body like any letter.
* A log is records back to back, with no separators between them.

A record is printed by «Напечатать запись». The log is read one character at a
time by «Шаг чтения» — a state machine with the states «Между записями»,
«Читаем номер», «Читаем длину», «Читаем тело», «Ждём метку конца» and
«Сбились». There is no way out of «Сбились»: everything after the first damaged
frame is discarded; the records read before it are kept.

The length comes before the body because the body may contain the same
characters as the frame: a reader driven by separators goes wrong on such a
body, a reader driven by the length does not. The end mark `;` is still needed:
without it a record with an understated length would be read as whole, and the
tail of its body as the start of the next record.

## How to run

The examples:

```
flang test docs/examples/wal/write-ahead-log.flang
flang test docs/examples/wal/append-plan.flang
```

```
docs/examples/wal/write-ahead-log.flang: примеров 98, прошло 98, не прошло 0
docs/examples/wal/append-plan.flang: примеров 110, прошло 110, не прошло 0
```

That is 98 examples, 98 passed, and 110 of 110. The second run also counts the
examples of the module it uses: the plan has 12 of its own.

The plan is run by `flang io`. It looks for the file журнал.wal in the directory
of the program, and the file must exist. To avoid writing into the tree, copy
the programs to a separate directory:

```
mkdir -p /tmp/wal && cp docs/examples/wal/*.flang /tmp/wal/ && : > /tmp/wal/журнал.wal
flang io /tmp/wal/append-plan.flang
```

```
не доказано: утверждений 17: доказано 10, сетка 7, на веру 0 — запуск только по явному согласию: --trust
```

The exit code is 3: `flang io` does not run a plan unless every claim under it
is proved ("not proved: 17 claims: 10 proved, 7 on the grid, 0 on trust — runs
only with explicit consent"). Consent is the `--trust` flag:

```
flang io /tmp/wal/append-plan.flang --trust
```

```
на веру: доказанность не считалась — запуск по ключу --trust
{"plan":"Дописать в журнал","result":1,"orders":2,"log":[{"поручение":{"variant":"Прочитать файл","fields":{"путь":"журнал.wal"}},"отклик":{"variant":"Прочитано","fields":{"содержимое":""}}},{"поручение":{"variant":"Записать файл","fields":{"путь":"журнал.wal","содержимое":"#1:13:выдача товара;"}},"отклик":{"variant":"Записано","fields":{"сколько":20}}}]}
```

Every run appends one record with the body «выдача товара» and the next number.
After two runs the file holds:

```
#1:13:выдача товара;#2:13:выдача товара;
```

A record with a damaged frame at the end of the file is dropped. If the scrap
`#3:5:обрыв`, with no end mark, is appended to that file, the next run leaves:

```
#1:13:выдача товара;#2:13:выдача товара;#3:13:выдача товара;
```

Without the log file the plan gets no further than its first order; the exit
code is 1:

```
{"error":"файл не прочитан: No such file or directory","diagnostics":[{"code":"FLANG_IO_READ","message":"файл не прочитан: No such file or directory","severity":"error","span":{"line":92,"column":1}}]}
```

## What is proved and what is not

```
flang check docs/examples/wal/write-ahead-log.flang --proof
```

The last lines of the report:

```
итог:
  функций 25: тотальных 25, обычных 0
  обещание несёт: композиция 21, структура 4, точный шаг 0, постоянный шаг 0, объявленная мера 0
  сторожей в рантайме: 0 мест
  законов на сетке: 0 (значений в сетках 0); на веру: 0
  утверждений 17: доказано 10 (из них индукцией 3) (из них без теоремы 7), сетка 7, объявлено, не доказано 0
```

25 functions, all total; 17 claims: 10 proved (3 by induction, 7 without a
theorem), 7 on the grid, 0 stated without proof. The exit code is 3 — because of
the seven claims on the grid. `flang check` without `--proof` answers "no
remarks" and exit code 0 on the same file: it does not show the verdicts of the
claims. `append-plan.flang` has no claims of its own; its six functions are
total.

The main statement about reading: a log truncated at any character is read up
to the last whole record and no further. It is written as four postconditions:

| postcondition | function | `--proof` verdict |
|---|---|---|
| «съедено не больше, чем подано» | «Прочитать журнал» | grid |
| «съеденное — это ровно печать прочитанного, знак в знак» | «Прочитать журнал» | grid |
| «съеденное и остаток дают вход, ни знаком больше и ни знаком меньше» | «Прочитать журнал» | grid |
| «в остатке целой записи с начала нет» | «Остаток пуст для читателя» | grid |

"Grid" means: the assertion is checked on the function's examples, and there is
no proof of it for all inputs — the report says so in plain words. The kernel
does not take these four because they relate the result of a fold over the
whole input string to the string itself (the print equals a prefix of the
input); the kernel has no rule of that shape. What the kernel takes and what it
does not is named on [which promises the kernel takes](what-the-kernel-accepts.html).

Besides these four, three more are on the grid: «цифра не больше девяти»
(«Цифра числом»), «печать не короче шести знаков» («Напечатать запись») and
«разрез не теряет и не добавляет ни знака» («Разрез сходится»).

What the kernel proved for all inputs:

* termination of every function in both modules — by composition and by
  structure, with no descent checks at run time;
* by induction over the string — «начало не длиннее целого» («Начало строки»)
  and «хвост не длиннее целого» («Хвост строки»); by induction over the list —
  «наибольший не меньше начала поиска» («Наибольший номер»);
* by reducing the goal to the function body — the postconditions of «Идём
  дальше», «Сбиться», «Закрыть запись», «Обратный порядок», «Сколько записей»,
  «Следующий номер».

There are no claims "stated, not proved" and none taken on trust.

The independent proof checker (`FLANG_CHECKER`, built with
`make -C flang/proof/checker`) replayed 4 proofs out of 10; the other 6 rest on
the kernel's word.

Confirmation of the write in the plan: the variant «Конец работы» is built in
one place of the module «Append plan» — the «Записано» branch of «После записи
журнала». Any other host reply gives «Провал»: «Сбой» with its own code,
anything else with the code `FLANG_IO_ORDER`. This is visible by reading the
module and its examples.

## What the program does not guarantee

* **Durability.** Flushing to disk, the disk cache and the controller's write
  ordering are outside the program. The reply «Записано» means only that the
  host reported a write.
* **Appending to the end of the file.** There is no such order; the plan
  rewrites the file as a whole — the whole records plus the new one.
* **Body integrity.** A record has no checksum; a flipped bit in the middle of
  the body does not damage the frame. Only frame damage and truncation are
  caught.
* **Byte length.** The length is counted in code points: the string arrives in
  the program already decoded by the host.
* **Order of records on disk.** The next number is the largest one read plus
  one; that the records lie in the file in number order is not checked.
* **Unique numbers beyond the canon's ceiling.** Having reached the largest
  fifteen-digit number, «Следующий номер» stops growing.
* **Concurrent access.** There are no two writers to one log.
* **Creating the log.** The plan does not create a missing file; it answers
  «Провал».

## Nearby

* [Catalogue of examples](examples.html)
* [What is proved and what is not](what-is-proved.html)
* [Which promises the kernel takes](what-the-kernel-accepts.html)
* [Where flang ends and the host begins](host-boundary.html)
