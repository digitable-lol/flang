# A verified function inside someone else's C program without libc

How do you call a function verified in flang from an OS kernel, a bootloader or
firmware — from a place with no libc? The `--freestanding` flag of
`flang emit --target c` generates C that needs nothing but a C compiler.

The ordinary generated C does not fit there. It brings its own runtime library,
and that library calls `malloc`, threads and signals.

## Example: a packet header from one word

The first word of an IPv4 header holds the version, the header length and the
total packet length. Save this as `header.flang`:

```flang
модуль «Заголовок пакета»

объект «Заголовок»
  «версия»: u32
  «длина заголовка»: u32
  «полная длина»: u32

тотальная функция «Версия»
  принимает слово: u32
  возвращает u32
  пример «четвёртая версия»
    дано слово равно u32 1157627924
    ожидается u32 4
  слово сдвиг вправо на 28

тотальная функция «Длина заголовка»
  принимает слово: u32
  возвращает u32
  пример «пять слов»
    дано слово равно u32 1157627924
    ожидается u32 5
  (слово сдвиг вправо на 24) побитовое и 15

тотальная функция «Полная длина»
  принимает слово: u32
  возвращает u32
  пример «двадцать»
    дано слово равно u32 1157627924
    ожидается u32 20
  слово побитовое и 65535

тотальная функция «Разобрать»
  принимает слово: u32
  возвращает «Заголовок»
  пусть «в» равно («Версия» от слово)
  пусть «д» равно («Длина заголовка» от слово)
  пусть «п» равно («Полная длина» от слово)
  запись «Заголовок» с «версия» равным «в» и «длина заголовка» равным «д» и «полная длина» равным «п»
```

`u32` is a 32-bit machine word, like `uint32_t` in C. `объект` is a record
(`struct`). Generate the C:

```bash
flang emit header.flang --target c --freestanding --out kernel
ls kernel
```

```
flang_freestanding.h  zagolovok_paketa.c  zagolovok_paketa.h
```

There are three files. `zagolovok_paketa.h` holds the prototypes for your code,
`zagolovok_paketa.c` holds the functions, `flang_freestanding.h` holds the shared
definitions. A C name is the module name and the function name in Latin letters.

In the header:

```c
typedef struct {
  uint32_t versiya;
  uint32_t dlina_zagolovka;
  uint32_t polnaya_dlina;
} zagolovok_paketa_zagolovok_t;

uint32_t zagolovok_paketa_versiya(uint32_t p0_slovo);
uint32_t zagolovok_paketa_dlina_zagolovka(uint32_t p0_slovo);
uint32_t zagolovok_paketa_polnaya_dlina(uint32_t p0_slovo);
zagolovok_paketa_zagolovok_t zagolovok_paketa_razobrat(uint32_t p0_slovo);
```

The word became `uint32_t`, the record became a structure passed by value.

## Build without libc and check

```bash
gcc -std=c99 -Wall -Wextra -Werror -ffreestanding -nostdlib -c kernel/zagolovok_paketa.c -o header.o
nm -u header.o
```

Neither command prints anything. Empty `nm -u` output means the object file
needs no external symbol. The code builds the same way for another
architecture, for example with `riscv64-linux-gnu-gcc` and the same flags.

## Call it from your code

```c
#include "zagolovok_paketa.h"

int is_ipv4(uint32_t first_word) {
  return zagolovok_paketa_versiya(first_word) == 4;
}
```

Add `kernel` to the include path (`-Ikernel`) and link `header.o` into your
program.

## What becomes what

| flang | C |
| --- | --- |
| `u8`, `u16`, `u32`, `u64` | `uint8_t`, `uint16_t`, `uint32_t`, `uint64_t` |
| `признак` | `bool` |
| `число`, `целое`, `неотрицательное` | `int64_t`; whole values only, up to 2⁵³ in magnitude |
| `объект` | `struct`, passed by value |
| `тип` with variants | `struct` with a `tag` field and a `union` of the variants' fields |
| `пусть`, `если`, `разбор`, a function call | ordinary C statements |

Operations on words compute exactly as in ordinary flang. `плюс`, `минус` and
`умножить на` give an error on overflow. `плюс … с переполнением` computes
modulo 2ʷ. A shift by the word width or more is an error.

## A function that can fail

Save this as `wrap.flang`:

```flang
модуль «Заворот»

тотальная функция «Сумма с заворотом»
  принимает а: u64, б: u64
  возвращает u64
  а плюс б с переполнением

тотальная функция «Сумма с отказом»
  принимает а: u8, б: u8
  возвращает u8
  а плюс б
```

```bash
flang emit wrap.flang --target c --freestanding --out kernel
```

In `kernel/zavorot.h`:

```c
uint64_t zavorot_summa_s_zavorotom(uint64_t p0_a, uint64_t p1_b);
fl_fs_status zavorot_summa_s_otkazom(uint8_t p0_a, uint8_t p1_b, uint8_t *out);
```

The first function cannot fail and returns its answer directly. The second
returns a code and writes the answer to the last argument, `out`:

```c
uint8_t sum;
if (zavorot_summa_s_otkazom(200, 100, &sum) != FL_FS_OK) {
  /* 200 + 100 does not fit in u8 */
}
```

| Code | When |
| --- | --- |
| `FL_FS_OK` | the answer is in `out` |
| `FL_FS_OVERFLOW` | the result did not fit in the word |
| `FL_FS_DIVIDE_BY_ZERO` | division or remainder by zero |
| `FL_FS_SHIFT` | a shift by the word width or more |
| `FL_FS_PRECONDITION` | the arguments break a precondition (`требует`) |
| `FL_FS_POSTCONDITION` | a postcondition the proof kernel did not prove is broken |
| `FL_FS_RANGE` | a `число` went past 2⁵³, or a `неотрицательное` received a negative value |
| `FL_FS_BAD_TAG` | an argument holds a variant with an unknown `tag` |
| `FL_FS_NO_CASE` | `разбор` found no matching case |

A proved postcondition is not checked in the code. A precondition is always
checked: the arguments come from foreign code.

## What is not supported

Generation stops at the first function it cannot translate and names it. Save
this as `list.flang`:

```flang
модуль «Список в ядре»

тотальная функция «Сумма списка»
  принимает «числа»: список числа
  возвращает число
  свёртка «числа» начиная с 0 как «сумма» и «х» → «сумма» плюс «х»
```

```bash
flang emit list.flang --target c --freestanding --out kernel
```

```
… FLANG_FREESTANDING_UNSUPPORTED: функция «Сумма списка», параметр «числа» типа «список»: поддержаны
признак, слова u8, u16, u32 и u64, число (только целое), неотрицательное, целое, записи и суммы типов из
них; …
```

The message says: function «Сумма списка», parameter «числа» of type list;
supported are flags, the words `u8`…`u64`, whole numbers, records and sum types
made of them. Not supported:

- strings and lists — they need dynamic memory;
- fractional numbers and division on `число` — they need `double`; the words `u8`…`u64` can be divided;
- recursive functions — the stack depth must be known in advance;
- the signed words `i8`…`i64` and `точное целое`;
- functions not marked `тотальная`, `план` and `процесс`.

A C compiler may copy a large record with a call to `memcpy`. If `nm -u` shows
`memcpy` or `memset`, provide them in your kernel.

Next: [machine words in the language](language.html), [all `emit` flags](cli.html),
[ordinary C generation](embedding.html).
