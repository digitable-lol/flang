[Back to README](../../README.md) · [Documentation index](../README.md)

# C code in flang: translation, kernel check, round trip and a draft spec

The translator reads functions written in C, prints their translation into flang and hands
the translation to the kernel. Every verdict here is about the **translation**: "the
translation of function X has property P". For a verdict about the translation to say
anything about the C itself, the translation is printed back into C and compared with the
source on a grid of inputs. The decision and its limits are in
[ADR-0058](../adr/0058-a-foreign-language-enters-through-an-untrusted-translator.md).

## How to call it

```
bootstrap/flang run-script foreign-c:demo     # the corpus flang/foreign/c/corpus, report and verdict
bootstrap/flang run-script foreign-c:census   # the share of the tree's C functions inside the subset
```

It needs `clang` and a `cc` with `-fsanitize=undefined`. Temporary files go under
`FLANG_TMP`.

## What the example set holds

* `corpus/*.c` — foreign code as it is.
* `corpus/claims.tsv` — what a person claims about a function: `requires` and `ensures`
  lines written as flang expressions over the parameters (names in «») and the word
  `результат`.
* `corpus/expected.tsv` — what to expect for each function: `bug` and the claim that must
  break; `proved` — everything must be proved; `open` — the code is right, the kernel cannot
  prove it, and there must be no counterexample; `refused` and the words of the reason — the
  translator must refuse for exactly that reason. A refusal the table does not list turns
  the plan red.

## What the report prints for each function

1. **The translation** — in full, the very text the kernel judges. `int` parameters carry
   the requirements `INT_MIN`…`INT_MAX`. Lines `обязательство N · строка L: …` are the places
   where C is undefined: an arithmetic result outside `int`, a zero divisor, the end of a
   function without `return`, undefined behaviour inside a called function. After the
   function, the same module holds the helper functions of its loops and copies of the
   functions it calls.
2. **Claims and verdicts.** Each one gets the kernel's word («доказано ядром» / «не доказано
   ядром») and, when the grid found an input where the claim is false, the input itself, what
   C did on it and what `flang run` said on it about the translation.
3. **The round trip C → flang → C.** How many grid inputs lie outside the requirements, on
   how many the values agreed, on how many C was stopped by the sanitizer and an obligation
   named it. A disagreement is a translation error, and the plan turns red.
4. **A draft specification.** `обеспечивает` lines marked `ВЫВЕДЕНО из перевода` with
   their ground. The tail of a line says what happened to it: proved by the kernel, dropped
   by a counterexample, or ВОПРОС ЧЕЛОВЕКУ — the kernel did not prove it and the grid did not
   refute it.
5. **Translator forgeries.** Three false translators: one drops the first `if` branch, one
   shifts the first constant by one, one swaps the operands of the first non-commutative
   operation. Each must disagree with C on the round trip.

## The C subset

Functions `int f(…)` with `int` parameters and structs of `int` fields passed by value.
Statements: `return`, `if`/`else`, blocks, the empty statement, a local `int` declaration with
or without an initial value, assignment to a local or a parameter (`=`, `+=`, `-=`, `*=`,
`/=`, `%=`, `++`, `--` as a statement of its own), `for` and `while` loops with a counter.
Expressions: `int` literals, parameters and locals, a field of a struct parameter
(`r.width`), a call of a function translated earlier in the same file, `+ - * / %`,
comparisons, `&& || !`, unary `-` and `+`, `?:`. On anything else the translator refuses and
names the line and the construct: pointers and arrays, globals, other types, `break`,
`continue`, `return` inside a loop, `do`, `switch`, recursion, assignment inside an
expression.

### Assignment

Every assignment introduces a new name: `x = x + 1;` after `пусть «x» равно …` becomes
`пусть «x 4» равно («x» плюс 1)`, and everything below reads `«x 4»`. Each branch of an
`if` gets its own continuation of the function, so after the branches a variable has its own
name on every path. Reading a local before its first assignment is a refusal.

### Loop

A loop is translated when it has a counter: the last statement of the body (the step, for a
`for`) moves a variable by a constant (`i++`, `i--`, `i += 2`, `i = i - 3`), the condition
compares it with a bound by a sign that leads it towards the bound (`<`, `<=` when stepping
up, `>`, `>=` when stepping down), the counter changes only by the step, and the bound does
not change in the body.

The translation is a set of helper functions next to the translation, one for every variable
the loop changes: `«factorial loop 4 result»` takes all the loop variables, calls itself on
the values after one turn while the condition holds, and returns its variable once it does
not. They terminate by a declared measure: `убывает ((«n» минус «i») плюс 1)`, the distance
from the counter to the bound, and the measure check stands in the generated code. After the
loop: `пусть «result 6» равно («factorial loop 4 result» от …)`.

A C obligation inside the body (`result * i` in `int`) must hold on every turn. For it a
predicate function `«factorial loop 4 duty 1»` is printed: the obligation on the current turn
and the same function on the next one. The `обеспечивает` line of the translation calls it on
the values before the loop under the same obligation name.

A loop without such a counter — `while (n >= 10) n = n / 10;` — has no measure that can be
read off the code, and the translator refuses: «цикл без выводимой меры».

### Call

A function may call a function translated earlier in the same file. The module of the
caller's translation gets a copy of the callee (parameters `число`, no requirements) and a
predicate function `«width ok»`: all the C obligations of the callee on its parameters. The
call has its own obligation, «вызов width(…) без неопределённого поведения внутри» — that
predicate on the call's arguments.

### Struct

A struct of `int` fields becomes a record: `объект «struct span»` with `число` fields, a
field is read as `(«s».«start»)`, and every field carries the requirements
`INT_MIN`…`INT_MAX`. On the grid the struct is laid out by its fields (`s.start`,
`s.length`), the C harness builds it with a compound literal, and a counterexample is replayed
through `«span_end flat»` — a wrapper that builds the record from the fields.

### The grid of a function with a loop

For a function whose translation, or the translation of a callee, has a loop, numbers above
100000 in absolute value are removed from the grid: a walk up to `INT_MAX` would take billions
of turns both in C and in the generated flang. Such a grid sees an overflow on large values
only when it happens earlier, for example `factorial` of 1000.

## How to read «не доказано»

«Не доказано ядром» is not "an error". The kernel does not take a branch condition as a fact,
so the obligation "the divisor is not zero" behind the check `if (count <= 0) return 0;`
stays unproved although it holds. The outcome becomes an error when the grid found an input
where the claim is false and `flang run` named the violated property on it.

The kernel proves none of the obligations inside a loop: it attaches induction to `разбор`,
and a loop's helper function is a branch and a declared measure. The grid judges them.

Related: [flang on foreign code](foreign-code.md) · [Requirements and
specifications](business-requirements.md)
