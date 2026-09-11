# Write-ahead log

`examples/wal/` holds two flang programs: parsing, printing and recovery of a
write-ahead log after truncation, and a plan that appends one record to the log
through input-output orders. Both are written entirely in flang; neither writes
to disk — the host that carries out the plan's orders does.

## What is in the directory

There are 2 `.flang` files: <!-- СНЯТО 2026-09-08 файлов examples/wal/*.flang = 2 -->

| file | what it is | lines |
|---|---|---:|
| `examples/wal/write-ahead-log.flang` | module «Write ahead log»: the record format, character-by-character parsing, printing, recovery up to the last whole record, the next number | 579 <!-- СНЯТО 2026-09-08 строк examples/wal/write-ahead-log.flang = 579 --> |
| `examples/wal/append-plan.flang` | module «Append plan»: the plan «Дописать в журнал» — read the file, append a record, confirm with its number. Uses the first module | 95 <!-- СНЯТО 2026-09-08 строк examples/wal/append-plan.flang = 95 --> |

The two files together carry 110 examples <!-- СНЯТО 2026-09-08 примеров-в examples/wal/*.flang = 110 -->;
they are declared inside the functions and run with `bootstrap/flang test`.

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

```
bootstrap/flang check examples/wal/write-ahead-log.flang --proof
bootstrap/flang check examples/wal/append-plan.flang --proof
bootstrap/flang test  examples/wal/write-ahead-log.flang
bootstrap/flang test  examples/wal/append-plan.flang
```

The first line of `check` prints the number of functions and the number with a
proved termination; `--proof` adds a report on every assertion; `test` prints the
number of examples and how many passed.

The plan runs with `bootstrap/flang io`. The plan resolves the path to the file журнал.wal
relative to the directory of the program, and the file must exist: on a missing
file the plan answers «Провал» with the code `FLANG_IO_READ` (exit code 1). To
avoid writing into the tree, copy both files to a separate directory:

```
mkdir -p /tmp/wal && cp examples/wal/*.flang /tmp/wal/ && : > /tmp/wal/журнал.wal
bootstrap/flang io /tmp/wal/append-plan.flang
```

Every run prints, as JSON, two orders — «Прочитать файл» and «Записать файл» —
with the host's replies, and appends one record with the body «выдача товара»
and the next number. A record with a damaged frame at the end of the file (for
instance, without its end mark) is dropped on the next run: the file is
rewritten as the whole records plus the new one.

## What is checked and what is proved

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
does not is named on [which promises the kernel takes](kak-dokazat.html).

Besides these four, three small ones are on the grid too: «цифра не больше
девяти» («Цифра числом»), «печать не короче шести знаков» («Напечатать запись»)
and «разрез не теряет и не добавляет ни знака» («Разрез сходится») — run of
`check --proof` on 11 September 2026 at commit 2c40752d0: 17 claims, 10 proved,
7 on the grid.

What the kernel proved for all inputs:

* termination of every function in both modules — by composition and by
  structure, with no descent checks in the printed code;
* by induction over the string — «начало не длиннее целого» («Начало строки»)
  and «хвост не длиннее целого» («Хвост строки»); by induction over the list —
  «наибольший не меньше начала поиска» («Наибольший номер»);
* by reducing the goal to the function body — the postconditions of «Идём
  дальше», «Сбиться», «Закрыть запись», «Обратный порядок», «Сколько записей»,
  «Следующий номер».

There are no assertions "declared, not proved" and none taken on faith: the
report prints zeros for both. How many assertions there are, how many are proved
and how many are on the grid is not given on this page — the last line of the
`--proof` report prints those numbers, and they change together with the kernel.

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
* [Which promises the kernel takes](kak-dokazat.html)
* [Where flang ends and the host begins](host-boundary.html)
