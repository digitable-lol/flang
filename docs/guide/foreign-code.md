[Back to README](../../README.md) · [Documentation index](../README.md)

# flang on foreign code: translate, see the mismatches, extract the specification

This page describes one exercise: a piece of someone else's code was rewritten in flang, and
a record was made of **what surfaced along the way, what was proved and what remained
unproved**. The numbers come from the `bootstrap/flang` program at the root of the tree. All
the files are in the tree, and every run can be repeated.

For a subset of C the translation is done by a program, and the match between the translation
and the source is checked by printing the translation back into C and comparing it on a set of
inputs — [C code in flang](c-into-flang.md).
For a subset of Python the translation is done by a program too, and the match is checked by
comparing the answers of the translation with the answers of Python on a set of inputs —
[Python in flang](../python-to-flang.md).

## 1. A correction first: errors are found by the rewriting, not by the check

`flang check` checks **only the new code**, written in flang. It does not read the foreign
source and does not compare it with the translation. It will not find a bug in your Python.

Mismatches are found earlier. When you write foreign code down with explicit types,
preconditions and postconditions, **you have to name what the source left implicit.** The
implicit assumption either cannot be expressed, or it can, and then it is visible that nobody
ever checked it.

That is why the page describes separately what surfaced during the rewriting (section 3) and
what the check answered (section 5).

## 2. What was translated

The function `bisect_left` from the CPython standard library, Lib/bisect.py — the insertion
point for a value in a sorted list. It was chosen because it is short, pure (no I/O),
everyone knows it by heart, and it lives in someone else's tree, not ours.

The structure of the source (cut down to what was translated; the `key` branch is covered
separately in section 6):

```python
def bisect_left(a, x, lo=0, hi=None, *, key=None):
    """Return the index where to insert item x in list a, assuming a is sorted."""
    if lo < 0:
        raise ValueError('lo must be non-negative')
    if hi is None:
        hi = len(a)
    while lo < hi:
        mid = (lo + hi) // 2
        if a[mid] < x:
            lo = mid + 1
        else:
            hi = mid
    return lo
```

The result of the translation is
[`docs/examples/usage/lvalue.flang`](../examples/usage/lvalue.flang).

## 3. What surfaced during the rewriting — six places

Five of them are minor; the sixth is the main one.

**1. The loop is written as recursion.** `while lo < hi` in the translation is a recursive
function, and its termination has to be justified. What decreases here is not a list but a
difference, so the author names it: `убывает верх минус низ плюс 1`. The compiler does not
prove this decrease and checks it at runtime, in two places. Today the language has the form
`цикл … пока` with an `убывает` line; it is rewritten into the same kind of function
([What loops and classes are rewritten into](surface-sugar.md)).

**2. There are no default values.** `lo=0`, `hi=None` — the language has no such thing. The
result is two functions: «Место слева в отрезке» with explicit bounds, and «Место слева»,
which passes `0` and `длина элементы`. Along the way it became visible that `hi=None` in the
source does not mean "the bound is unknown" but "the bound is the end of the list", and that
the signature gave no way to tell these two meanings apart.

**3. There are no exceptions.** `raise ValueError('lo must be non-negative')` becomes a
**precondition**: `требует «низ неотрицателен» низ не меньше 0`. An exception is checked on
every call. A precondition is proved on the caller's side during the check; in the emitted C
only the by-name entry, through which outside values arrive, checks it.

**4. Indexing from the other end.** In Python `a[mid]` counts from zero; in flang
`элемент N в список` counts from one. It became `элемент (середина плюс 1) в элементы`. If
you miss it, the translation diverges from the source with no error message.

**5. There is no integer division.** `(lo + hi) // 2` does not translate into a single
operator; it became `(сумма минус (сумма остаток от 2)) делить на 2`. The integer overflow
known from binary search in the Java standard library does not occur here: the language's
numbers are not machine integers. They have a limit of their own: these are IEEE-754 numbers,
exact up to 2⁵³−1.

**6. The source states that the list is sorted nowhere except the docstring.** This is the
main finding.

`bisect_left` works correctly only on a sorted list. The CPython code checks exactly one
condition — `lo < 0`. That the list is sorted is neither checked nor declared: it is the words
`assuming a is sorted` in a docstring, which the interpreter does not check. On an unsorted
list the function returns a wrong number without an error.

The translation had to name it:

```flang
тотальная функция «Неубывающий»
  принимает элементы: список числа
  возвращает признак
  …

тотальная функция «Место слева»
  принимает элементы: список числа, цель: число
  возвращает число
  требует «список неубывающий» («Неубывающий» от элементы) равен да
  …
```

The precondition is written, and the file passes the check (exit code 0). Section 4 shows
what came of it at call sites.

## 4. The precondition is written — and is discharged at no call site

[`docs/examples/usage/lvalue-with-call.flang`](../examples/usage/lvalue-with-call.flang)
calls «Место слева» with a sorted list of literals:

```flang
тотальная функция «Куда встанет цена»
  принимает цена: число
  возвращает число
  пример «между сотней и пятью сотнями»
    дано цена равно 300
    ожидается 1
  «Место слева» от [100, 500, 900] и цена
```

```
$ bootstrap/flang check docs/examples/usage/lvalue-with-call.flang
FLANG_PRECONDITION_CALL … строка 70, столбец 3: вызов «Место слева» в функции
«Куда встанет цена» не снимает предусловие «список неубывающий» …
docs/examples/usage/lvalue-with-call.flang: не проверено — замечаний 1
```

Exit code 1. `не снимает` means "does not prove". The same error comes on the unsorted list
`[900, 100, 500]`. The check **rejects the correct call just as it rejects the wrong one**:
the kernel does not evaluate `«Неубывающий» от [100, 500, 900]`. It compares statements by
their form, and a precondition written as a call to your own function fits none of its rules.

The conclusion: **an implicit requirement can always be named, but it can be proved at call
sites only if it is written as an inequality or an equality over numbers, strings and
lists.** A domain predicate is, today, written down and checked at runtime, but calls are not
checked against it. More on this in
[Requirements and specifications](business-requirements.md), section 5.

## 5. What the check said

The translation without the preconditions on the index range
([`lvalue.flang`](../examples/usage/lvalue.flang)):

```
$ bootstrap/flang check docs/examples/usage/lvalue.flang --proof
модуль «Place on the left»: функций 3, завершение доказано у 2, без доказательства завершения: 1
постусловие «место не левее низа» функции «Место слева в отрезке» — проверено только на тестах (примеров 1)
постусловие «место не правее верха» функции «Место слева в отрезке» — проверено только на тестах (примеров 1)
…
docs/examples/usage/lvalue.flang: доказано не всё — доказано 0, проверено только на тестах 2, не доказано 0, ложно 0 (постусловий и утверждений 2); независимая проверка повторила 0 из 0 — код возврата 3
…
```

With `--explain` the detailed report names the method for each function: «Неубывающий» —
"доказано структурой" (proved by structure), «Место слева» — "доказано композицией" (by
composition), «Место слева в отрезке» — "объявленной мерой … спуск ядром не выведен — на
веру": the decrease is accepted without proof and checked at runtime.

With `--strict` the same command exits with code **1**. The `FLANG_NOT_TOTAL` warning about
the built-in operation `элемент` ("the index may fall outside the list") becomes an error
under that flag, and the report is not printed. `bootstrap/flang test` on the same file:
«примеров 7, прошло 7, не прошло 0», exit code 0.

The outcome in numbers:

| | count |
|---|---:|
| functions translated | 3 |
| termination proved | 2 of 3 (structural 1, composition 1); for the third the decrease is declared and checked at runtime |
| postconditions proved for all inputs | **0 of 2** |
| postconditions tested only on the author's examples | 2 of 2 |
| runtime checks of the decrease | 2 places |

Both postconditions — "the result is not left of the low bound" and "the result is not right
of the high bound" — are written, checked at runtime and remain unproved. The termination of
the binary search itself is not proved either: it is checked on every recursive call.

### Trying to strengthen it made things worse

Add the three preconditions on the index range that the source assumes (`низ не меньше 0`,
`верх не больше длины`, `низ не больше верх`), and the file no longer passes the check:

```
$ bootstrap/flang check docs/examples/usage/lvalue-with-slice.flang
FLANG_PRECONDITION_CALL … строка 46 … не снимает предусловие «низ неотрицателен»
FLANG_PRECONDITION_CALL … строка 46 … не снимает предусловие «низ не правее верха»
FLANG_PRECONDITION_CALL … строка 47 … не снимает предусловие «верх не дальше конца списка»
FLANG_PRECONDITION_CALL … строка 47 … не снимает предусловие «низ не правее верха»
… не проверено — замечаний 4
```

Exit code 1, four errors
([`lvalue-with-slice.flang`](../examples/usage/lvalue-with-slice.flang)).
The kernel does not infer the invariant that binary search maintains on every step, and the
recursive calls do not prove the function's own precondition. Today the choice is: leave
these preconditions out, and then the program says no more about them than the source, or
write them, and then the file fails the check.

## 6. What did not surface, although it was expected

The `key=None` branch of `bisect_left` takes a **function as a parameter**. The expectation
was that it would not translate. It does:
`ключ: функция из числа в число`, applied as `ключ от (элемент … в элементы)`.
[`lvalue-by-key.flang`](../examples/usage/lvalue-by-key.flang):
«функций 4, из них с доказанным завершением 4 … замечаний нет», exit code 0;
`flang test` — «примеров 8, прошло 8, не прошло 0», exit code 0.

A function declared by name can be passed as a parameter. What cannot be done is passing a
function that arrives as data (for example, parsed from a settings file), or writing an
anonymous function in place of an argument of your own function.

## 7. The specification that came out

Before: one runtime check (`lo < 0`) and a phrase in the docstring. After: six named items,
each written in the code:

| item | how it is written | what happens to it | was it in the source |
|---|---|---|---|
| the list is non-decreasing | `требует «список неубывающий»` | not proved at call sites (section 4) | only in the docstring |
| the low bound is non-negative | `требует «низ неотрицателен»` | recursive calls do not prove it, code 1 (section 5) | `raise ValueError` at runtime |
| the high bound is not past the end of the list | `требует «верх не дальше конца списка»` | same, code 1 | nowhere |
| the low bound is not right of the high bound | `требует «низ не правее верха»` | same, code 1 | nowhere |
| the result lies between the low and high bounds | two `обеспечивает` | tested only, checked at runtime | nowhere |
| the function terminates on every input | `тотальная` + `убывает` | not proved: the decrease is checked at runtime | nowhere |

Of the six items, **none is proved**. All six are now **written in the code**, not only in a
docstring, and some of them are checked at runtime.

## 8. What this means for your repository

- It makes sense to translate **pure pieces**: calculations, format parsing, data validation
  rules. Code that mostly changes state and does I/O can be translated, but the check will
  say nothing about it: the language's logic has no state over time and no side effects.
- Findings come **from the rewriting, not from the run**. The main finding of this exercise
  is item 6 of section 3. It was made when the word `требует` had to be written, not from a
  compiler message.
- Count on your own code. In this exercise none of the 6 specification items is proved. You
  will get a different number, and the only way to learn it is to run it.
- Some code will not be expressible at all. Such tasks in `docs/tasks/` are marked with the
  line `карта: Чего в языке нет вовсе`; `bootstrap/flang run-script tasks:board` shows their
  number. The full list is in
  [Known limits](limits.md).

Related: [Requirements and specifications: what flang gives a business](business-requirements.md) ·
[Known limits](limits.md) ·
[How to write flang properly](how-to-write-flang.md)
