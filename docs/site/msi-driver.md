# The MSI driver in flang

What driver logic looks like when it is written as pure functions, and what can
be proved about it. The example is the MSI controller of the JH7110 PCIe bridge
(the VisionFive 2 board, the PLDA XpressRICH bridge).

The source `docs/examples/driver/msi/msi.flang` is rewritten from a NetBSD
driver: the files `jh7110_pcie_msi.c` and `jh7110_pcievar.h` in
`sys/arch/riscv/starfive`. It is a model of a driver: it is not built into a
system and has not run on the board.

## The approach: a function returns what to write

Every function takes the controller state and an event. It returns the new
state, a list of register writes and a list of vectors to handle. The function
itself writes no registers:

```flang fragment
тотальная функция «Занять вектор»
  принимает контроллер: «Состояние MSI», вектор: неотрицательное, безопасен: признак
  возвращает «Отклик MSI»
```

The register writes are done by the host: the C code that calls these
functions. The example directory has no host. Its job is a loop: read the MSI
status word, call «Раздать прерывание» (dispatch the interrupt), perform the
writes from the reply and call the handlers. How this boundary works:
[The boundary between flang and the host](host-boundary.html).

In the original driver the order "clear the bit first, then call the handler"
rests on a comment. Here the clear is the field `«сброс»` of the record
`«Разряд»`, next to the vector number. It cannot be moved after the handler
call.

## Bits: with arithmetic or with machine words

The language has machine words `u8` … `u64` with bitwise operations and shifts.
`msi.flang` does not use them: its mask and status word are declared `число`
(number), and the bits are read with arithmetic.

| Action | In `msi.flang` (arithmetic) | In `msi-words.flang` (`u32`) |
| --- | --- | --- |
| the bit of a vector | «Вес вектора»: recursive multiplication by 2 | `(u32 1) сдвиг влево на вектор` |
| is the bit set? | «Бит взведён»: recursion over remainders of 2 | `((слово сдвиг вправо на вектор) побитовое и 1) равен 1` |
| set the bit | «Маска со взведённым»: add the weight | `маска побитовое или бит` |
| clear the bit | «Маска со сброшенным»: subtract the weight | `маска побитовое и (побитовое не бит)` |

The reason for the choice is proofs. About a machine word the compiler proves
only the range of its type. About arithmetic it proves more, and in `msi.flang`
95 postconditions out of 98 are proved. The word version is shorter and closer
to C, but its postconditions are only tested on examples.

The second version is next to the first, in
`docs/examples/driver/msi/msi-words.flang`:

```flang insert docs/examples/driver/msi/msi-words.flang
модуль «MSI bit operations on machine words»

примечание "Те же действия над маской и словом состояния, что в msi.flang, записанные побитовыми операциями над u32"

тотальная функция «Бит вектора»
  принимает вектор: u32
  возвращает u32
  требует «вектор меньше тридцати двух» вектор меньше 32
  пример «нулевой вектор — единица»
    дано вектор равно u32 0
    ожидается u32 1
  пример «двадцать восьмой — PLDA_IMASK_INT_MSI, 0x10000000»
    дано вектор равно u32 28
    ожидается u32 268435456
  (u32 1) сдвиг влево на вектор

тотальная функция «Бит слова взведён»
  принимает слово: u32, вектор: u32
  возвращает признак
  требует «вектор меньше тридцати двух» вектор меньше 32
  пример «в пятёрке нулевой бит взведён»
    дано слово равно u32 5
    дано вектор равно u32 0
    ожидается да
  пример «в пятёрке первый бит сброшен»
    дано слово равно u32 5
    дано вектор равно u32 1
    ожидается нет
  ((слово сдвиг вправо на вектор) побитовое и 1) равен 1

тотальная функция «Маска слова со взведённым»
  принимает маска: u32, вектор: u32
  возвращает u32
  требует «вектор меньше тридцати двух» вектор меньше 32
  пример «взводим нулевой в пустой маске»
    дано маска равно u32 0
    дано вектор равно u32 0
    ожидается u32 1
  пример «взводим уже взведённый»
    дано маска равно u32 5
    дано вектор равно u32 2
    ожидается u32 5
  маска побитовое или («Бит вектора» от вектор)

тотальная функция «Маска слова со сброшенным»
  принимает маска: u32, вектор: u32
  возвращает u32
  требует «вектор меньше тридцати двух» вектор меньше 32
  пример «сбрасываем второй из пятёрки»
    дано маска равно u32 5
    дано вектор равно u32 2
    ожидается u32 1
  пример «сбрасываем уже сброшенный»
    дано маска равно u32 5
    дано вектор равно u32 1
    ожидается u32 5
  маска побитовое и (побитовое не («Бит вектора» от вектор))

тотальная функция «Взведение не снимает чужих битов»
  принимает маска: u32, вектор: u32
  возвращает признак
  требует «вектор меньше тридцати двух» вектор меньше 32
  обеспечивает «каждый прежний бит остался» результат равен да
  пример «пятёрка и первый вектор»
    дано маска равно u32 5
    дано вектор равно u32 1
    ожидается да
  ((«Маска слова со взведённым» от маска и вектор) побитовое и маска) равен маска
```

```text
$ flang test docs/examples/driver/msi/msi-words.flang
docs/examples/driver/msi/msi-words.flang: примеров 9, прошло 9, не прошло 0
$ flang check docs/examples/driver/msi/msi-words.flang --proof
…
docs/examples/driver/msi/msi-words.flang: НЕ ДОКАЗАНО — ОПОРА НЕ СУДИЛАСЬ — утверждений 1: доказано 0, условно 0, сетка 1, … — код возврата 3
```

All nine examples pass. The only postcondition, «каждый прежний бит остался»
(every earlier bit stays), is not proved: it is tested on one example (the word
«сетка» in the output). The exit code is 3.

The language has no hexadecimal literals. Register addresses are written in
decimal, and a postcondition with the hexadecimal form in its name checks the
match: «PLDA_IMASK_LOCAL — 0x180, оно же 384».

An unknown vector number gives `return NULL` in the C driver. Here the function
returns the error text in the field `«отказ»` of the reply and writes nothing
to the registers or to the state.

## What is in `msi.flang`

Types: «Запись в регистр» (address, value), «Разряд» (vector, clear, call),
«Вектор MSI» (taken, handler, safe), «Состояние MSI» (doorbell, mask address,
mask, vectors, enabled), «Отклик MSI» (state, writes, bits, error).

| Group | Functions |
| --- | --- |
| register addresses | «Регистр местной маски», «Регистр местного состояния», «Регистр звонка», «Регистр состояния MSI», «Бит MSI в местной маске», «Число векторов», «Адреса регистров различны» |
| bounds and bits | «Вектор в пределах», «Вес вектора», «Бит взведён», «Младший бит взведён», «Маска со взведённым», «Маска со сброшенным», «Предел маски» |
| state validity | «Годное состояние» |
| vector table | «Номера векторов», «Свежие векторы», «Шаг правки», «Проход правки», «Правка вектора» |
| installing and removing a handler | «Занять вектор», «Освободить вектор» |
| interrupt dispatch | «Шаг раздачи», «Начало раздачи», «Раздать прерывание» |
| start-up | «Запустить контроллер» |

Carried over from the driver:

| What | Function in C |
| --- | --- |
| parsing the MSI status word and dispatch by vector | `jh7110_pcie_msi_dispatch` |
| installing a handler with a bounds check | `jh7110_pcie_msi_intr_establish` |
| removing a handler | the MSI branch of `jh7110_pcie_intr_disestablish` |
| starting the controller | `jh7110_pcie_msi_init` |

Not carried over: setting up MSI in the device (`jh7110_pcie_msi_program`),
choosing free vectors (`jh7110_pcie_msi_find_run`,
`jh7110_pcie_msi_alloc_common`), choosing between MSI, MSI-X and INTx
(`jh7110_pcie_intr_alloc`). Locking, memory allocation and debug output stay
with the host.

## How to run

```text
$ flang test docs/examples/driver/msi/msi.flang
docs/examples/driver/msi/msi.flang: примеров 42, прошло 42, не прошло 0
```

All 42 examples gave the expected answer.

```text
$ flang run docs/examples/driver/msi/msi.flang --function '«Вес вектора»' --args '{"вектор":5}' --trust
на веру: доказанность не считалась — запуск по ключу --trust
32
```

`run` calls one function. The first line warns that the run skips the proof
check because of the flag `--trust`. The second is the answer: the bit of
vector five is 32. Without `--trust` the command returns exit code 3, because
the file has unproved postconditions.

```text
$ flang check docs/examples/driver/msi/msi.flang --proof
…
  утверждений 98: доказано 95 (из них индукцией 2) (из них без теоремы 93, объявленным типом 2), сетка 3, объявлено, не доказано 0
…
docs/examples/driver/msi/msi.flang: независимо, сверщиком, проиграно 70 из 95 доказанных; на слове ядра 25 — код сверщика 3
docs/examples/driver/msi/msi.flang: НЕ ДОКАЗАНО — ОПОРА НЕ СУДИЛАСЬ — утверждений 98: доказано 95, условно 0, сетка 3, … — код возврата 3
```

The first line shown: of 98 postconditions, 95 are proved for every input and 3
are only tested on examples (the word «сетка»). The second: the independent
check, the program `checker` («сверщик» in the output), repeated 70 proofs out
of 95. The other 25 are accepted without a re-check. The third line is the
summary and exit code 3.

## What is proved and what is not

All 26 functions always terminate. In «Вес вектора» and «Бит взведён» the
recursion goes over the type `число`, so the decrease of the argument is also
checked at run time.

**Proved for every input:**

* the bound on the vector number: a vector below 32 is accepted, 32 and above
  is rejected. In the C driver, crossing this bound is a write past the end of
  the handler array;
* register addresses: each one equals the hexadecimal value from the header,
  and a write goes only to its own address;
* one step of parsing the status word: a set bit gives one vector in the reply,
  a clear bit gives nothing;
* the error on a foreign vector: the error text is returned, the registers and
  the state are untouched;
* the vector table keeps its length when a handler is installed or removed.
  This is proved by induction over the fold;
* dispatching an interrupt does not change the controller state.

**Only tested on examples:**

| Postcondition | Function | Why it is not proved |
| --- | --- | --- |
| «это тот же нулевой разряд, что читает Бит взведён» | «Младший бит взведён» | the right-hand side is a recursive function |
| «ШАГ СОХРАНЯЕТ ГОДНОСТЬ ЦЕЛИКОМ: из годного состояния выходит годное» | «Занять вектор» | it needs the inequality "mask below the limit", and the compiler does not derive inequalities over arithmetic |
| the same | «Освободить вектор» | the same reason |

**One proved postcondition checks nothing.** «НЕ ТЕРЯЕТ ВЕКТОРОВ (ИНВАРИАНТ
ЦИКЛА)» of «Шаг раздачи» holds for any body that adds the same amount to the
counter and to the list. The content is checked by four postconditions next to
it: they name the increment as a number.

## What the example does not show

* Running on the board and building into a system: this was not checked.
* State validity after installing and removing a handler in general: tested on
  examples.
* Choosing free vectors, setting up MSI in the device, MSI-X: not carried over.
* Locking and memory: a pure function has none, they are the host's job.

## Next

* [The boundary between flang and the host](host-boundary.html)
* [Machine words](language.html#machine-words-u8-u64-i8-i64)
* [What is proved and what is not](what-is-proved.html)
