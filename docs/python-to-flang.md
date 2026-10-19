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
bootstrap/flang run flang/foreign/python/browser.fscript --function "«Translate for page»" \
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

puts `docs/site/out/playground/python.js` next to `formula.js`. The page calls
`translateForPage(source, name)` and hands `unit` to the compiler as
`flang check /playground.flang` — exactly as it does with a formula.

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
| `def f(a: int, b: list[int]) -> bool:` | `функция «f»` with the same parameters; the types are required |
| `int`, `float` | `число` |
| `bool`, `True`, `False` | `признак`, `да`, `нет` |
| `str` | `строка` |
| `list[T]`, `[a, b]` | `список T`, `[a, b]` |
| `return`, `if` / `elif` / `else`, `a if c else b` | the value of the branch, `если … то … иначе` |
| `x = …`, `x += …`, `a, b = b, a + b`, `xs: list[int] = []` | `пусть` with a new name |
| `for x in xs`, `for i in range(…)`, `for c in text` | a fold and a function for one turn |
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
| `while`, `break`, `continue`, `return` inside a loop | `FLANG_PYTHON_LOOP` | a `while` has no measure visible in the code; a fold cannot be left early |
| `xs.append(…)`, `xs[i] = …`, `del` | `FLANG_PYTHON_MUTATION` | a list is not changed in place; build a new one: `xs = xs + [v]` |
| a parameter or a result without a type, a type outside the table | `FLANG_PYTHON_TYPE` | the translation writes every type and does not guess it |
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
  remainder of flang takes the sign of the dividend. Division by zero stops the
  computation with a refusal, where Python raises `ZeroDivisionError`.
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

Last run: 20 programs of the corpus, all 20 translated and passed `flang check`; 131 calls, the
answers agreed with Python on all 131; 41 functions are `тотальная`, 4 are not (binary
search and its caller, Collatz steps, the countdown) and each says why; 52 lying
translations, all 52 caught; 10 refused programs, all 10 with the expected code. The
run takes about five minutes.

Related: [C code in flang](guide/c-into-flang.md) · [flang on foreign code](guide/foreign-code.md)
