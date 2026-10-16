[Back to README](../../README.md) · [Documentation index](../README.md)

# flang on foreign code: translate, see the mismatches, extract the specification

This page describes one real exercise: a piece of someone else's code was taken, rewritten in
flang, and a record was made of **what surfaced along the way, what was proved and what
remained declared**. The numbers come from the `bootstrap/flang` binary at the root of the
tree. All the files are in the tree, and every run is repeatable.

For a subset of C the translation is done by a machine, and the link between the translation
and the source is held by printing the translation back into C and comparing it on a grid of
inputs — [C code in flang](c-into-flang.md).

## 1. A correction first: errors are found by the rewriting, not by the check

This is the most common misconception about this kind of work, and it spoils expectations.

`flang check` looks **only at the new code**, written in flang. It does not care about the
foreign source: it has not read it, has not compared anything with it and passes no judgement
on it. There is no such thing as "the check found a bug in your Python", and there will not
be.

What works is something else. When you re-express foreign code with explicit types,
requirements on the input and promises about the result, **you have to name what the source
left implicit.** This is the step where mismatches surface: the implicit assumption either
cannot be expressed, or it can — and then it becomes visible that nobody ever checked it.

That is why everything below is split into "what surfaced during the rewriting" (section 3)
and "what the check said" (section 5). The two must not be confused.

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

Five of them are minor; the sixth is the reason for the whole exercise.

**1. There are no loops.** `while lo < hi` is rewritten as recursion, and the recursion has
to prove that it terminates. There is no structural proof here — what decreases is not a list
but a difference — so the author names the measure: `убывает верх минус низ плюс 1`. The cost
is stated up front: the check of the measure moves into the generated code, and the report
counts it in two places.

**2. There are no default values.** `lo=0`, `hi=None` — the language has no such thing. The
result is two functions: «Место слева в отрезке» with explicit bounds, and «Место слева»,
which passes `0` and `длина элементы`. Along the way it became visible that `hi=None` in the
source does not mean "the bound is unknown" but "the bound is the end of the list", and that
the signature gave no way to tell these two meanings apart.

**3. There are no exceptions.** `raise ValueError('lo must be non-negative')` is not a
runtime failure but a **precondition**: `требует «низ неотрицателен» низ не меньше 0`. The
difference is not cosmetic: an exception is checked on every call and costs time, while a
precondition is proved by the caller and leaves not a single byte in the generated code.

**4. Indexing from the other end.** In Python `a[mid]` counts from zero; in flang
`элемент N в список` counts from one. It became `элемент (середина плюс 1) в элементы`. This
is a place where the foreign code and the translation silently diverge if you miss it.

**5. There is no integer division.** `(lo + hi) // 2` does not translate into a single
operator; it became `(сумма минус (сумма остаток от 2)) делить на 2`. The well-known integer
overflow that broke binary search in the Java standard library does not reproduce here: the
language's numbers are not machine integers. In exchange there is a limit of its own — these
numbers are IEEE-754, and they are exact up to 2⁵³−1.

**6. The source states that the list is sorted nowhere except the docstring.** This is the
finding.

`bisect_left` works correctly only on a sorted list. The CPython code checks exactly one
condition — `lo < 0`. That the list is sorted is neither checked nor declared: it is the words
`assuming a is sorted` in a docstring, which the machine does not read. Pass an unsorted list
and the function returns a number, does not complain, and the number is wrong.

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

The precondition is written, the file passes the check (exit code 0). Then comes section 4,
which matters more than the finding itself.

## 4. The precondition is written — and is discharged at no call site

[`docs/examples/usage/lvalue-with-call.flang`](../examples/usage/lvalue-with-call.flang)
calls «Место слева» with a list literal that is plainly sorted:

```flang
тотальная функция «Куда встанет цена»
  принимает цена: число
  возвращает число
  пример «между сотней и пятью сотнями»
    дано цена равно 300
    ожидается 1
  «Место слева» от [100, 500, 900] и цена
```

The run:

```
$ bootstrap/flang check docs/examples/usage/lvalue-with-call.flang
FLANG_PRECONDITION_CALL … строка 70, столбец 3: вызов «Место слева» в функции
«Куда встанет цена» не снимает предусловие «список неубывающий» …
docs/examples/usage/lvalue-with-call.flang: не проверено — замечаний 1
```

exit code 1. The same refusal comes on the unsorted list `[900, 100, 500]`. In other words,
the check **rejects the correct call just as it rejects the wrong one**: the kernel does not
evaluate `«Неубывающий» от [100, 500, 900]`, it matches assertions syntactically, and a
precondition written as a call to your own function does not reduce to any of its ten rules.

The conclusion, worth more than the finding itself: **an implicit requirement can always be
named, but it can be carried across calls only if it has the form of an inequality or an
equality over numbers, strings and lists.** A domain predicate is written, stays in the
report and is checked at runtime, but calls are not checked against it. More on this in
[Requirements and specifications](business-requirements.md), section 5.

## 5. What the check said

The translation without the preconditions on the index range
([`lvalue.flang`](../examples/usage/lvalue.flang)):

```
$ bootstrap/flang check docs/examples/usage/lvalue.flang --proof
…
чем несётся обещание «тотальная»:
  «Неубывающий»            доказано структурой: аргумент 1 («элементы») на
                           каждом витке становится частью себя
  «Место слева в отрезке»  доказано объявленной мерой: убывает «верх» минус
                           «низ» плюс 1
  «Место слева»            доказано композицией: рекурсии нет
…
  постусловие «место не левее низа» функции «Место слева в отрезке» — сетка 1
  значение (примеры функции) … Это не доказательство — теоремы при утверждении нет
  постусловие «место не правее верха» функции «Место слева в отрезке» — сетка 1
  значение (примеры функции) … Это не доказательство — теоремы при утверждении нет
…
  утверждений 2: доказано 0, сетка 2, объявлено, не доказано 0
… ПРОВЕРЕНО С ОПОРОЙ, И ОПОРА НЕ СУДИЛАСЬ (спросить: --строго) … код возврата 0
```

With `--строго` the same command gives **exit code 3** and the words «НЕ УДАЛОСЬ ДОКАЗАТЬ —
ОПОРА НЕ СУДИЛАСЬ». `bootstrap/flang test` on the same file: «примеров 7, прошло 7, не прошло
0», exit code 0.

The outcome in numbers:

| | count |
|---|---:|
| functions translated | 3 |
| termination proved | 3 of 3 (structural 1, declared measure 1, composition 1) |
| postconditions proved for all inputs | **0 of 2** |
| postconditions left resting on the author's examples | 2 of 2 |
| checks moved into the generated code | 2 places (measure) |

**Zero of two.** Both promises — "the result is not left of the low bound" and "the result is
not right of the high bound" — are written, readable, checked at runtime and remain unproved.
Exactly one thing is proved here: that the function **terminates**. That is no small thing —
for a hand-written binary search this is exactly the bug people look for in foreign code —
but it must not be passed off as proved correctness.

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

exit code 1, four refusals
([`lvalue-with-slice.flang`](../examples/usage/lvalue-with-slice.flang)).
The kernel does not infer the invariant that binary search maintains on every iteration, and
the recursive calls cannot discharge the function's own precondition. So the choice is:
either do not write the preconditions — and then the program stays silent exactly like the
source — or write them and fail the check. There is no middle ground.

## 6. What did not surface, although it was expected

For honesty's sake: one expectation did not hold.

The `key=None` branch of `bisect_left` takes a **function as a parameter**. The expectation
was that it would not translate. It does:
`ключ: функция из числа в число`, applied as `ключ от (элемент … в элементы)`.
[`lvalue-by-key.flang`](../examples/usage/lvalue-by-key.flang):
«функций 4, из них с доказанным завершением 4 … замечаний нет», exit code 0;
`flang test` — «примеров 8, прошло 8, не прошло 0», exit code 0.

So the common claim "you cannot pass a function in flang" is false and should not be
repeated. What really does not exist is passing a function where it arrives as data (for
example, parsed from a settings file).

## 7. The specification that came out

A side result, but the most valuable one. Before: one runtime check (`lo < 0`) and a phrase in
the docstring. After: six named items, each machine-readable:

| item | how it is written | what happens to it | was it in the source |
|---|---|---|---|
| the list is non-decreasing | `требует «список неубывающий»` | not discharged by calls (section 4) | only in the docstring |
| the low bound is non-negative | `требует «низ неотрицателен»` | recursive calls do not discharge it, code 1 (section 5) | `raise ValueError` at runtime |
| the high bound is not past the end of the list | `требует «верх не дальше конца списка»` | same, code 1 | nowhere |
| the low bound is not right of the high bound | `требует «низ не правее верха»` | same, code 1 | nowhere |
| the result lies between the low and high bounds | two `обеспечивает` | declared, checked at runtime | nowhere |
| the function terminates on every input | `тотальная` + `убывает` | **proved** | nowhere |

Read the last two columns together. Of the six items, **one is proved**. But all six are now
**written in the code**, not in the author's head and not in a docstring — and that is what
will outlive both the author and any refactoring.

## 8. What this means for your repository

- It makes sense to translate **pure pieces**: calculations, format parsing, data validation
  rules. A piece that lives on state and I/O will translate formally but show nothing — the
  language's logic says nothing about state over time or side effects.
- Expect the harvest **from the rewriting, not from the run**. The real finding of this
  exercise is item 6 of section 3, and it was found at the moment the word `требует` had to be
  written, not when the compiler said something.
- Count by your own rules, not ours. In this exercise 1 specification item out of 6 is proved.
  You will get a different number, and the only way to learn it is to run it.
- Some code will not be expressible at all. Such tasks are tagged in the tree's task list with
  a separate map, "What the language does not have at all"; ask for the count by running
  `bootstrap/flang run-script tasks:board`. The full list of what is missing is in
  [Known limits](limits.md).

Related: [Requirements and specifications: what flang gives a business](business-requirements.md) ·
[Known limits](limits.md) ·
[How to write flang properly](how-to-write-flang.md)
