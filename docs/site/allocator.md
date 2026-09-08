# Memory allocator

`examples/allocator/allocator.flang` is a memory allocator written as a pure
function. The heap is data: a list of free segments and the total size. A
request is a value: «Взять» (take) so many, or «Вернуть» (return) an address and
a length. The allocator is the function «Шаг кучи», which returns the new heap,
an address and the flag «удалось» (succeeded):

```flang
тотальная функция «Шаг кучи»
  принимает куча: «Куча», запрос: «Запрос»
  возвращает «Отклик кучи»
```

The function does not touch memory — it answers what is now to be considered
taken. The approach is the same as in the UART driver
`examples/driver/uart.flang` and in the [MSI driver](msi-driver.html).

The program answers the question "can an allocator be expressed in flang, and
what about it is provable". It is not a replacement for `malloc` in the runtime
printed to C: the runtime needs memory before the first «Куча» value exists.

## What is in the file

1 file, 416 lines <!-- СНЯТО 2026-09-08 файлов examples/allocator/*.flang = 1 --> <!-- СНЯТО 2026-09-08 строк examples/allocator/allocator.flang = 416 -->.

Types: «Отрезок» (segment: start, length), «Куча» (heap: free segments, total),
«Запрос» (request: the variants «Взять» and «Вернуть»), «Отклик кучи» (heap
reply: heap, address, succeeded). The heap size is the constant of the function
«Размер кучи», 4096.

What the functions do:

* **«Выдать»** walks the free segments with a fold («Пройти свободные», step
  «Шаг выдачи»), takes the first segment no shorter than the request and leaves
  its remainder free. If there is no room, the reply is a refusal and the heap
  is unchanged.
* **«Вернуть кусок»** inserts a segment into the free list in order of starts
  («Пройти вставку», step «Шаг вставки»). A zero-length return and a return
  beyond the heap boundary are refused, and the heap stays intact.
* **«Годная куча»** — the free segments are in ascending order and do not
  overlap («Шаг годности»).
* **«Шаг кучи»** branches on the kind of request and calls «Выдать» or
  «Вернуть кусок».
* **«Отклик первой выдачи»**, **«Отклик второй выдачи»**, **«Отклик
  возврата»** — a closed trace of three steps on a fresh heap; their
  postconditions are decided by computation.

## How to run

```
bootstrap/flang check examples/allocator/allocator.flang --proof
bootstrap/flang test  examples/allocator/allocator.flang
```

The `--proof` report prints a verdict for every postcondition and, on its last
line, how many assertions are proved, how many are on the grid and how many are
declared without a proof. Those numbers are not on this page: they change
together with the kernel. A measurement on a given date, before and after the
fold rewrite, is in the section on inequalities of [which promises the kernel
takes](kak-dokazat.html).

## What is proved and what is not

Every function in the file is total, and each termination is proved by
composition. The report has no assertions "declared, not proved".

**Proved for all inputs** — everything written as an equality to a term of the
same branch or as a condition on a flag: honest refusal («ОТКАЗ ЧЕСТЕН: места
нет — куча не изменилась», «ОТКАЗ ЧЕСТЕН: нулевой возврат отвергается, куча
цела», «ОТКАЗ ЧЕСТЕН: возврат за границу кучи отвергается, куча цела»), issue
only from a segment («ВЫДАЁТ ТОЛЬКО ИЗ ОТРЕЗКА: адрес выдачи есть начало
отрезка»), the remainder takes the place of the taken segment («НИЧЕГО НЕ
ПОТЕРЯНО: вместо взятого отрезка встаёт его остаток»), the returned segment
enters the list, the insertion order, the whole closed trace of three steps —
including heap validity after every step and "the free space shrank by exactly
what was issued".

**Proved by induction over the fold**: «просят столько же, сколько запросили»
and «свободных отрезков остаётся столько же» of «Пройти свободные», «возвращаемый
отрезок по дороге не меняется» of «Пройти вставку». For this the fold must run
over the list argument itself: «Пройти свободные» takes the list of segments
rather than the heap, because with `свёртка куча.«свободные»` the kernel does
not read the induction principle.

**On the grid** (checked on the function's examples, not proved) remain the
postconditions written with an inequality or a subtraction:

| postcondition | function |
|---|---|
| «конец не левее начала» | «Конец отрезка» |
| «НИЧЕГО НЕ ПОТЕРЯНО: остаток плюс выданное — прежняя длина» | «Остаток отрезка» |
| «ВНУТРИ КУЧИ: адрес не левее начала отрезка» | «Выдать из отрезка» |
| «ВНУТРИ КУЧИ: конец выданного не правее конца отрезка» | «Выдать из отрезка» |
| «НЕ ПЕРЕСЕКАЮТСЯ: конец выданного не правее начала остатка» | «Выдать из отрезка» |
| «НЕ ПЕРЕСЕКАЮТСЯ: выданное и остаток — по проверке» | «Выдать из отрезка» |
| «НИЧЕГО НЕ ПОТЕРЯНО: остаток плюс выданное — прежняя длина отрезка» | «Выдать из отрезка» |
| «ГРАНИЦА НЕ ПЯТИТСЯ: прежняя не правее новой» | «Шаг годности» |

The reason is one: the kernel has no arithmetic of inequalities — no
reflexivity of "not greater", no monotonicity of addition, no law "(a minus b)
plus b equals a". So "the issued segment lies inside the heap" and "nothing is
lost", written as inequalities, stay on the grid, while the same thought written
as an equality ("the remainder starts exactly where the issued segment ends") is
proved. The rule for the writer: write segment bounds as equalities.

Separately, about types: the fields «начало» and «длина» have the type `число`
rather than `неотрицательное`, because the sum of two `неотрицательное` in the language has the type
`число`. The promise «конец не левее начала» is therefore not merely unproved —
with a negative length it is false, and the kernel's refusal here is on the
merits.

## What is not here

* **Coalescing of adjacent free segments.** A return inserts the segment in
  order of starts and does not merge it with its neighbours; the heap
  fragments. Coalescing is one more fold step of the same kind, and it is not
  written.
* **Validity in general.** «Годная куча» promises nothing, and there is no
  assertion "from a valid heap «Шаг кучи» makes a valid one" for an arbitrary
  heap. Validity is proved only on the closed trace of three steps.
* **Liveness.** It is proved that every step carries the heap from one state to
  another; that the allocator ever hands memory to whoever is waiting is a
  property of an infinite sequence, not of one step.

## Nearby

* [Catalogue of examples](examples.html)
* [What is proved and what is not](what-is-proved.html)
* [Which promises the kernel takes](kak-dokazat.html)
* [The MSI driver in flang](msi-driver.html)
