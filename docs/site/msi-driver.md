# The MSI driver in flang

`docs/examples/driver/msi/msi.flang` is the MSI controller of the JH7110 PCIe bridge
(the VisionFive 2 board, PLDA XpressRICH bridge), rewritten in flang from a
driver in the NetBSD kernel. The source is the files jh7110_pcie_msi.c (the
controller itself) and jh7110_pcievar.h (types and register addresses) in the
directory sys/arch/riscv/starfive of our branch of the NetBSD tree; upstream
does not have this driver. One claim was tested: porting a driver to a language
with proofs runs into volume, not into possibility.

**Limits.** This does not build into the kernel, has not been tried on the
board, and does not replace the working driver. The NetBSD tree was only read
during this work.

## The approach: the driver writes nothing, it answers what to write

Every function is pure: "controller state and event → new state, a list of
register writes and a list of bits to dispatch". The same approach as in the
UART driver `docs/examples/driver/uart.flang` and the [memory
allocator](allocator.html).

```flang
тотальная функция «Занять вектор»
  принимает контроллер: «Состояние MSI», вектор: неотрицательное, безопасен: признак
  возвращает «Отклик MSI»
```

There is no C host in this directory. Its job is a loop: read the MSI status
word, call «Раздать прерывание», and for every bit in the reply perform the
«сброс» (clear) write and, if the field «звать» is true, call the vector's
handler.

The order "first clear the bit by writing one, then the handler" — which a
comment holds in the C source — is held here by the shape of the data: the clear
is the field «сброс» of the object «Разряд», not a separate step, and there is
nothing to move after the call.

What the language had to replace:

* **no bitwise operations** — the status word is taken apart by descent over
  remainders of two («Шаг раздачи», «Младший бит взведён», «Бит взведён»), and
  shifting one by the vector number is a multiplication («Вес вектора»);
* **no hexadecimal literals** — register addresses are written in decimal, and
  every conversion stands as its own promise: «PLDA_IMASK_LOCAL — 0x180, оно же
  384», «PLDA_ISTATUS_LOCAL — 0x184, оно же 388», «PLDA_IMSI_ADDR — 0x190, оно
  же 400», «PLDA_ISTATUS_MSI — 0x194, оно же 404»;
* **no silent `return NULL`** — an unknown vector gives a refusal named in words
  in the reply field «отказ»; nothing is written to the hardware or to the state
  (the family of promises «ОТКАЗ ЧЕСТЕН»).

## What is in the file

1 file, 426 lines <!-- СНЯТО 2026-09-08 файлов docs/examples/driver/msi/*.flang = 1 --> <!-- СНЯТО 2026-09-08 строк docs/examples/driver/msi/msi.flang = 426 -->.

Types: «Запись в регистр» (register write: address, value), «Разряд» (bit:
vector, clear, call), «Вектор MSI» (taken, handler, safe), «Состояние MSI»
(doorbell, mask address, mask, vectors, enabled), «Отклик MSI» (state, writes,
bits, refusal).

Functions by group:

| group | functions |
|---|---|
| register constants and their distinctness | «Регистр местной маски», «Регистр местного состояния», «Регистр звонка», «Регистр состояния MSI», «Бит MSI в местной маске», «Число векторов», «Адреса регистров различны» |
| bound and bits | «Вектор в пределах», «Вес вектора», «Бит взведён», «Младший бит взведён», «Маска со взведённым», «Маска со сброшенным», «Предел маски» |
| state validity | «Годное состояние» |
| vector table | «Номера векторов», «Свежие векторы», «Шаг правки», «Проход правки», «Правка вектора» |
| establishing and removing a handler | «Занять вектор», «Освободить вектор» |
| interrupt dispatch | «Шаг раздачи», «Начало раздачи», «Раздать прерывание» |
| start-up | «Запустить контроллер» |

Taken from the driver: parsing the MSI status word and dispatching by vector
(`jh7110_pcie_msi_dispatch`), establishing a handler with the bound check and
setting the mask bit (`jh7110_pcie_msi_intr_establish`), removing a handler
with clearing the same bit (the MSI branch of `jh7110_pcie_intr_disestablish`),
start-up — reading the doorbell, re-arming the MSI capture, zeroing the table,
unmasking (`jh7110_pcie_msi_init`), all register addresses and constants.

Left out: programming the device's MSI capability (`jh7110_pcie_msi_program` —
the offsets are found by `pci_get_capability` at run time), allocation of
aligned runs of vectors (`jh7110_pcie_msi_find_run`,
`jh7110_pcie_msi_alloc_common`), the MSI/MSI-X/INTx negotiation
(`jh7110_pcie_intr_alloc`), the MSI-X functions (this bridge has none), mutual
exclusion, memory allocation and debug printing — those are the host's work.

## How to run

```
bootstrap/flang check docs/examples/driver/msi/msi.flang --proof
bootstrap/flang test  docs/examples/driver/msi/msi.flang
```

The `--proof` report prints a verdict for every postcondition and, on its last
line, how many assertions are proved, how many are on the grid and how many are
declared without a proof. Those numbers are not on this page: they change
together with the kernel. A measurement on a given date, before and after the
fold rewrite, is in the section on inequalities of [which promises the kernel
takes](kak-dokazat.html).

## What is proved and what is not

All functions are total. For two — «Вес вектора» and «Бит взведён» — termination
is proved by a constant step, and for them a descent check is placed in the
printed code: the descent runs over the type `число` (the difference `неотрицательное минус
1` does not flow back into `нат`), and on IEEE-754 a constant step does not
always change the magnitude. For the rest — by composition, with no checks in
the printed code.

The report has no assertions "declared, not proved".

**Proved for all inputs:**

* the vector-number bound — «ВЕКТОР МЕНЬШЕ ТРИДЦАТИ ДВУХ — СВОЙ», «ВЕКТОР ОТ
  ТРИДЦАТИ ДВУХ И ВЫШЕ — ЧУЖОЙ»; on the hardware, crossing it is a write past
  the end of the handler array;
* addresses — every conversion from hexadecimal, «ЗВОНОК НЕ ПУТАЕТСЯ С
  ОСТАЛЬНЫМИ ТРЕМЯ», «ЗВОНОК ПИШЕТСЯ ПО СВОЕМУ АДРЕСУ И ТОЛЬКО ПО НЕМУ»
  (start-up writes exactly two records, and both are named), «W1C ПИШЕТСЯ ПО
  PLDA_ISTATUS_MSI И ТОЛЬКО ПО НЕМУ», «МАСКА ПИШЕТСЯ ПО СВОЕМУ АДРЕСУ, А НЕ ПО
  ЗВОНКУ»;
* mask parsing on one step — a set bit yields exactly one dispatch entry and
  grows the count by exactly one, a clear bit yields nothing;
* refusal — «ОТКАЗ ЧЕСТЕН: чужой вектор назван словами», «… в железо не пишут»,
  «… состояние не трогают», «СВОЙ ВЕКТОР ОТКАЗА НЕ ДАЁТ» — for both establishing
  and removing;
* the vector table — «ПРОХОД СОБИРАЕТ РОВНО СТОЛЬКО, СКОЛЬКО ПРОШЁЛ» and «ЦЕЛЬ
  ПРОХОДОМ НЕ МЕНЯЕТСЯ» of «Проход правки» are proved by induction over the
  fold, and from them «ТАБЛИЦА НЕ МЕНЯЕТ ДЛИНЫ» of «Правка вектора». For this the
  fold is moved into a separate function whose whole body it is: a fold under a
  field projection does not show the kernel the induction principle;
* validity under dispatch — «ШАГ СОХРАНЯЕТ ГОДНОСТЬ ЦЕЛИКОМ» of «Раздать
  прерывание»: dispatch does not change the state.

**On the grid** (checked on the function's examples, not proved):

| postcondition | function | why |
|---|---|---|
| «это тот же нулевой разряд, что читает Бит взведён» | «Младший бит взведён» | a recursive function on the right; the kernel checks the equality on a finite set of values |
| «ШАГ СОХРАНЯЕТ ГОДНОСТЬ ЦЕЛИКОМ: из годного состояния выходит годное» | «Занять вектор» | validity contains the inequality "mask below the limit", and the kernel has no arithmetic of inequalities |
| «ШАГ СОХРАНЯЕТ ГОДНОСТЬ ЦЕЛИКОМ: из годного состояния выходит годное» | «Освободить вектор» | the same |

What of validity is still proved for establishing and removing: the table
length does not change, the vector's mask bit is set and cleared, the doorbell
and the mask address do not change, on a foreign vector the state is untouched.

**One proved promise is empty as a statement.** «НЕ ТЕРЯЕТ ВЕКТОРОВ (ИНВАРИАНТ
ЦИКЛА)» of «Шаг раздачи» — "if before the step there were as many entries as set
bits, then after it too" — holds for any body that adds the same amount to the
count and to the list of entries. The content is carried by the four promises
next to it, which pin the increment to a concrete number. The invariant is kept
for the sake of the formulation, not for its proving power.

## What it does not guarantee

* **Working on the board or building into the kernel.** Not tried.
* **State validity after establishing and removing** in general — grid, see
  above.
* **Vector allocation**, programming the MSI capability, MSI-X — not rewritten.
* **Mutual exclusion and memory** — a pure function has none; that is the
  host's work.

## Nearby

* [Catalogue of examples](examples.html)
* [Where flang ends and the host begins](host-boundary.html)
* [What is proved and what is not](what-is-proved.html)
* [Which promises the kernel takes](kak-dokazat.html)
* [Memory allocator](allocator.html)
