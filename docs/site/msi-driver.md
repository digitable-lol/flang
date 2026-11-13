# The MSI driver in flang

`docs/examples/driver/msi/msi.flang` is the MSI controller of the JH7110 PCIe bridge
(the VisionFive 2 board, PLDA XpressRICH bridge), rewritten in flang from a
driver for the NetBSD kernel: jh7110_pcie_msi.c (the controller itself) and
jh7110_pcievar.h (types and register addresses) from sys/arch/riscv/starfive.
The main NetBSD tree does not have this driver.

This is a model of the driver, not a driver: it does not build into the kernel
and has not been run on the board.

## The approach: the driver writes nothing, it answers what to write

Every function is pure: "controller state and event → new state, a list of
register writes and a list of bits to dispatch". The same approach as in the
UART driver `docs/examples/driver/uart.flang` and the [memory
allocator](allocator.html).

```flang fragment
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

1 file, 458 lines <!-- СНЯТО 2026-09-08 файлов docs/examples/driver/msi/*.flang = 1 --> <!-- СНЯТО 2026-10-01 строк docs/examples/driver/msi/msi.flang = 458 -->.

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
flang test docs/examples/driver/msi/msi.flang
flang run docs/examples/driver/msi/msi.flang --function '«Вес вектора»' --args '{"вектор":5}' --trust
flang check docs/examples/driver/msi/msi.flang --proof
```

`test` runs the examples (42 of 42 pass):

```
docs/examples/driver/msi/msi.flang: примеров 42, прошло 42, не прошло 0
```

`run` calls one function. «Вес вектора» (the weight of a vector) of 5 is a one
shifted left by five bits:

```
на веру: доказанность не считалась — запуск по ключу --trust
32
```

Without `--trust`, `run` refuses with exit code 3: not everything in the file
is proved.

`check --proof` prints a verdict for every claim. The last lines:

```
итог:
  функций 26: тотальных 26, обычных 0
  обещание несёт: композиция 24, структура 0, точный шаг 0, постоянный шаг 2, объявленная мера 0
  сторожей в рантайме: 2 места
  законов на сетке: 0 (значений в сетках 0); на веру: 0
  утверждений 98: доказано 95 (из них индукцией 2) (из них без теоремы 93, объявленным типом 2), сетка 3, объявлено, не доказано 0
```

26 functions, all total; 98 claims: 95 proved, 3 on the grid. The exit code is
3 — because of the three claims on the grid. The independent proof checker
(`FLANG_CHECKER`) replayed 70 proofs out of 95; the other 25 rest on the
kernel's word.

## What is proved and what is not

All 26 functions are total. For two — «Вес вектора» and «Бит взведён» —
termination is proved by a constant step, and their descent is checked while
the program runs: the descent goes over the type `число`, and on IEEE-754 a
constant step does not always change the magnitude. For the other 24 it is
proved by composition, with no run-time checks.

Of the 98 claims 95 are proved and 3 are on the grid.

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
* [Which promises the kernel takes](what-the-kernel-accepts.html)
* [Memory allocator](allocator.html)
