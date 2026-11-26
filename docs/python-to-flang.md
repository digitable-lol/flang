[Back to README](../README.md) · [Documentation index](README.md) · [По-русски](python-to-flang.ru.md)

# Python in flang: a translator you do not have to trust

The translator reads a program written in a small part of Python and prints the same
program in flang. You do not have to believe the translator: `flang check` judges the
printed text, and a separate run compares the answers of the translation with the
answers of Python itself on a set of inputs. This is the rule of
[ADR-0058](adr/0058-a-foreign-language-enters-through-an-untrusted-translator.md),
the same one the [C translator](guide/c-into-flang.md) follows.

The translator is written in flang, not in Python. In the browser it runs as
JavaScript printed from flang, so the page needs no Python. Python is needed in one
place only: to know what the original program answers when the answers are compared.

## How to call it

```
bootstrap/flang run-script foreign-python:demo
```

translates every program of `flang/foreign/python/corpus`, checks each translation
with `flang check`, compares the answers with Python and tries three lying versions of
the translator. It needs `python3` on the machine. Temporary files go under `FLANG_TMP`.

One program, from the command line:

```
bootstrap/flang run flang/foreign/python/browser.fscript --function "«Translate program»" \
  --args '{"source": "def square(x: int) -> int:\n    return x * x\n", "name": "square"}'
```

The answer is a record: `code` and `why` are empty when the program was translated,
`unit` holds the flang text, and `verdicts` says, function by function, whether the
translation is `тотальная` (its end is proved) and why. The same call works in the
WebAssembly build of the compiler (`playground/flang.wasm`), because the translator is
an ordinary flang module.

For the playground the translator is printed to JavaScript:

```
bootstrap/flang run-script playground:python
```

puts `docs/site/out/playground/python.js` next to `c.js`. The "Python → flang" setup of
the playground calls `translateForPage(source)`: it answers with one module for every
function — the function itself, copies of the functions it calls and the helper functions
it needs — under the same contract as the C translator. The page hands every module to the
compiler as `flang check /playground.flang --proof` and shows the verdict function by function.

## Three examples

### A square

```python
def square(x: int) -> int:
    return x * x


def sum_of_squares(a: int, b: int) -> int:
    return square(a) + square(b)
```

becomes

```flang
тотальная функция «square»
  принимает «x»: число
  возвращает число
  «x» умножить на «x»

тотальная функция «sum_of_squares»
  принимает «a»: число, «b»: число
  возвращает число
  («square» от «a») плюс («square» от «b»)
```

Every name of the program goes into guillemets, so a Python name never collides with a
word of flang. `int` and `float` both become `число`.

### A countdown that does not always end

```python
def countdown(n: int) -> int:
    if n == 0:
        return 0
    return countdown(n - 1)
```

On a negative `n` this recursion never stops. The translator sees that the call makes
`n` smaller but nothing before it keeps `n` from going below zero, so it writes
`функция`, not `тотальная функция`, and says why right above it:

```flang
примечание "Без «тотальная»: вызов на строке 4 уменьшает «n», но проверка перед ним не ограничивает «n» снизу (нужна вида n <= 0): на части входов рекурсия не кончается, поэтому перевод пишет «функция», а не «тотальная функция»"
функция «countdown»
  принимает «n»: число
  возвращает число
  если «n» равен 0
    то 0
    иначе «countdown» от («n» минус 1)
```

With `if n <= 0:` instead of `if n == 0:` the same function becomes `тотальная`, and
`flang check` proves its end.

### A loop

```python
def total(xs: list[int]) -> int:
    s = 0
    for x in xs:
        s += x
    return s
```

A `for` loop becomes a fold over the list. One turn of the loop is a function of its
own, and the fold calls it once for every element:

```flang
тотальная функция «total»
  принимает «xs»: список число
  возвращает число
  пусть «s» равно 0
  пусть «s 3» равно (свёртка «xs» начиная с «s» как «s so far» и «x» → «total loop 3» от «s so far» и «x»)
  «s 3»

тотальная функция «total loop 3»
  принимает «s»: число, «x»: число
  возвращает число
  пусть «s 4» равно «s» плюс «x»
  «s 4»
```

Every assignment gets a new name — `«s 4»` is the `s` assigned on line 4 — because a
flang value never changes. When a loop changes several variables, they travel through
the fold together in a record.

## What the subset holds

| Python | flang |
|---|---|
| `def f(a: int, b: list[int]) -> bool:` | `функция «f»` with the same parameters; a parameter or a result without a type is `int` |
| `int`, `float` | `число` |
| `bool`, `True`, `False` | `признак`, `да`, `нет` |
| `str` | `строка` |
| `list[T]`, `[a, b]` | `список T`, `[a, b]` |
| `return`, `if` / `elif` / `else`, `a if c else b` | the value of the branch, `если … то … иначе` |
| `x = …`, `x += …`, `a, b = b, a + b`, `xs: list[int] = []` | `пусть` with a new name |
| `for x in xs`, `for i in range(…)`, `for c in text` | a fold and a function for one turn |
| `while c:` | a recursive function with a declared measure (below) |
| `[f(x) for x in xs if c]` | `отобразить` and `отфильтровать` |
| recursion | a recursive call; its end is judged (below) |
| `+ - * / // % **`, comparisons, `and or not`, `in` | flang operations and small helper functions |
| `len abs min max sum sorted range str float list` | `длина` and helper functions |
| `xs[i]`, `xs[-1]`, `xs[a:b]`, `text[i]` | `элемент`, `голова`, `хвост`, helper functions |

Helper functions such as `«Python remainder»` or `«Python range»` are printed into the
same module, so the translation stands on its own.

## What is refused, and why

The translator refuses everything else, and it says what and where. It does not try a
guess that might be wrong.

| what | code | why |
|---|---|---|
| `class` | `FLANG_PYTHON_CLASS` | an object of Python has state that changes; flang values do not change |
| names at the top of the module, `global`, `nonlocal` | `FLANG_PYTHON_GLOBAL` | a function of the subset gets everything through its parameters |
| `try`, `raise`, `assert` | `FLANG_PYTHON_EXCEPTION` | flang has no catching: a refusal stops the whole computation |
| `print`, `input`, `open`, `with` | `FLANG_PYTHON_IO` | input and output are not a pure function |
| `import` | `FLANG_PYTHON_IMPORT` | one program is translated, without modules |
| a `while` without a measure the translator sees, `break`, `continue`, `return` inside a loop | `FLANG_PYTHON_LOOP` | the end of such a loop is not visible in the code; a loop is left only through its condition |
| `xs.append(…)`, `xs[i] = …`, `del` | `FLANG_PYTHON_MUTATION` | a list is not changed in place; build a new one: `xs = xs + [v]` |
| a type outside the table | `FLANG_PYTHON_TYPE` | the translation writes every type and does not guess it |
| a function that may end without `return` | `FLANG_PYTHON_RETURN` | Python would return `None`, a function of the subset always has a value |
| tuples, dictionaries, `None`, `lambda`, methods, keyword arguments | `FLANG_PYTHON_CONSTRUCT` | outside the subset |
| a name not defined in the function | `FLANG_PYTHON_NAME` | global names are outside the subset |
| text that is not Python | `FLANG_PYTHON_SYNTAX`, `FLANG_PYTHON_INDENT`, `FLANG_PYTHON_STRING`, `FLANG_PYTHON_NUMBER` | the reader names the line and the sign |

For example

```python
def doubled(xs: list[int]) -> list[int]:
    result: list[int] = []
    for x in xs:
        result.append(2 * x)
    return result
```

is refused with `FLANG_PYTHON_MUTATION строка 4: метод «append» меняет список на месте, а
значения flang не меняются: вместо xs.append(v) пишите xs = xs + [v]`.

## Where Python and flang differ

* **Numbers.** A Python `int` has no limit; a flang `число` is exact up to 2⁵³. Inputs
  beyond that are outside what the comparison checks.
* **Division.** `//` rounds down and `%` takes the sign of the divisor, as in Python: the
  translation calls `«Python floor division»` and `«Python remainder»`, because the
  remainder of flang takes the sign of the dividend. Division by zero is a condition the
  kernel has to check (below); where the translator cannot state it, the computation stops
  with a refusal, as Python raises `ZeroDivisionError`.
* **Minus zero.** In flang `-0` is not equal to `0`. A product of two values that may
  have different signs gets `плюс 0` at the end, which turns `-0` into `0`, so an
  equality after it means what it means in Python.
* **Text of numbers.** `str(…)` is translated only for an integer: Python writes `3.0`
  and `True`, flang writes `3` and `да`.
* **Errors.** Where Python raises (an index outside the list, division by zero), the
  translation refuses too. The comparison counts this as agreement: both stopped.

## When the translation says `тотальная`

flang has two kinds of function: `тотальная функция` always ends (or refuses honestly),
`функция` is not promised to. The translator writes `тотальная` only when it can name
the reason, and `flang check` must agree:

* **the tail of a list** — the call gets `xs[1:]` after a check that `xs` is not
  empty: the list becomes shorter, and flang sees it by itself;
* **a step down from a checked bound** — the call gets `n - 1` (any positive number)
  after a check like `if n <= 0: return …`;
* **Euclid's step** — the call gets `a % b` in the place of `b`: the measure is `b · b`;
* **a shorter part** — the call gets a list filtered from the tail, as in quicksort:
  the measure is the length of the list.

Otherwise the translation writes `функция` and a note with the reason. A function that
calls such a function is not `тотальная` either, and its note says which call is the
cause. Binary search over `low` and `high`, Collatz steps and the countdown above are
all in the corpus and all get `функция` with a note.

## A `while` loop

A `while` becomes a function of its own that calls itself while the condition holds. It
takes every variable the loop changes and every variable it only reads, and returns the
changed ones. The translator writes a measure — a number that gets smaller on every turn —
when it sees one of two forms:

* **a counter**: a variable changes by a constant step towards a bound, `i += 1` under
  `i < n` (the measure is `n - i`), `i -= 2` under `i >= 0`;
* **division**: a variable is divided by a constant not less than 2, `x //= 10` (the
  measure is `x`).

```python
def is_palindrome(x: int) -> bool:
    if x < 0 or (x % 10 == 0 and x != 0):
        return False
    rev = 0
    while x > rev:
        rev = rev * 10 + x % 10
        x //= 10
    return x == rev or x == rev // 10
```

gives the loop

```flang
тотальная функция «is_palindrome while 8»
  принимает «rev»: число, «x»: число
  возвращает «is_palindrome while 8 state»
  убывает «x»
  если «x» больше «rev»
    то
      пусть «rev 9» равно («rev» умножить на 10) плюс («Python remainder» от «x» и 10)
      пусть «x 10» равно «Python floor division» от «x» и 10
      «is_palindrome while 8» от «rev 9» и «x 10»
    иначе запись «is_palindrome while 8 state» с «rev» равным «rev» и «x» равным «x»
```

The kernel derives the decrease of a measure only in one form (a parameter of type
`неотрицательное` that gets smaller by a constant), so the measure of a loop is taken on
trust: `flang check --proof` answers with code 3, and the generated code checks the measure
on every turn and stops with `FLANG_MEASURE` if it does not decrease. A loop of neither form
is refused with `FLANG_PYTHON_LOOP` and a hint how to rewrite it.

## Division by zero

A division `a // b`, `a % b` or `a / b` whose divisor is not a nonzero number written in the
code becomes an obligation of the function, as in the [C translator](guide/c-into-flang.md):

```flang
  обеспечивает «обязательство 1 · строка 2: делитель в a // b не ноль» если («b») больше 0 то да иначе ((«b») меньше 0)
```

The kernel looks for an input that breaks it and finds `a = 0, b = 0`. A division under an
`if`, `and`, `or` or `… if … else …` gets the condition of its branch in front:
`если не («b» равен 0) то (…) иначе да`. The translator states the obligation when the divisor
and the conditions use only parameters the function has not changed and the division is not
inside a loop; elsewhere the helper function stops with a refusal on zero, as Python raises
`ZeroDivisionError`. The plan `foreign-python:demo` accepts a broken obligation only when
Python itself raises `ZeroDivisionError` on an input of `corpus/inputs.tsv` for that function.

## How the translator is checked

The plan `foreign-python:demo` does four things for every program of the corpus:

1. translates it and runs `flang check` on the translation — the exit code must be 0;
2. compares the verdict of every function (`тотальная` or not, and the words of the
   reason) with `corpus/expected.tsv`;
3. runs every call of `corpus/inputs.tsv` twice — in Python (`reference.py`) and in the
   translation (`flang run`) — and compares the answers; a refusal on both sides is an
   agreement;
4. prints three lying translations — the first `if` loses its first branch, the first
   number grows by one, the first non-commutative operation swaps its operands — and
   requires the comparison to catch each of them.

It also translates the ten programs of `corpus/refused` and requires each refusal code
from `corpus/expected.tsv`.

Last run: 25 programs of the corpus, all 25 translated and passed `flang check` (in
`division` the kernel found a zero divisor for all three functions, and Python raises
`ZeroDivisionError` on those inputs too); 153 calls, the answers agreed with Python on all
153; 46 functions are `тотальная`, 4 are not (binary search and its caller, Collatz steps,
the countdown) and each says why; 61 lying translations, all 61 caught; 10 refused
programs, all 10 with the expected code. The answers of a translation are taken with
`flang run --trust`, because the end of a loop by a declared measure is not derived by the
kernel; the measure guard and the obligations are still computed while it runs. The run
takes about six minutes.

Related: [C code in flang](guide/c-into-flang.md) · [flang on foreign code](guide/foreign-code.md)
