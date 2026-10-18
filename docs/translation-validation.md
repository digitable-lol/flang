# Translation validation of the C print

The C print `flang/self/emit-c.flang` turns a checked program into C. Translation validation
asks, function by function, whether the printed C computes what the source computes in the
reference semantics ([reference-semantics.md](reference-semantics.md)). It does not prove the
print; it checks each printed program. The decision is
[ADR-0163](adr/0163-the-printed-c-is-validated-function-by-function-against-the-reference.md).

```
bootstrap/flang run-script translation:validate
```

## How it runs

The plan `flang/translation/validation.fscript` takes every file of `flang/proof/examples` and
`docs/examples/pythagoras` and, for each file:

1. reads the tree with `flang ast` and prints C with `flang emit --target c`;
2. builds the printed module with its runner `flang_cli.c` and the runtime;
3. asks `flang/proof/lean/Semantics/Validate.lean plan` for the witnesses of every function
   and the answer of the reference on each of them;
4. sends the same calls to the C runner as JSON lines and reads its answers back through
   `Validate.lean canon`, so that both sides are printed by one printer;
5. compares the two answers line by line.

An answer is a value, or a refusal with its code. The reference checks the preconditions of
the called function before the body and the postconditions after it, as the printed C does, so a
refusal by `FLANG_PRECONDITION` or `FLANG_PROPERTY` is compared like a value. Numbers are compared
by their shortest decimal form with the sign of zero kept, which is one string per binary64 value.
A row where the reference ran out of fuel or the C program hit its recursion or memory limit is
not compared and is counted apart.

## Which inputs

Witnesses come from the declared types of the parameters:

| type | witnesses |
|---|---|
| flag | both values |
| variant without fields | the variant |
| `число` | zero, minus zero, small integers, halves, tenths, the largest and the smallest finite values |
| `нат`, `неотрицательное` | non-negative integers up to 2⁵³−1 |
| `целое` | integers of both signs |
| string | the empty string, ASCII, Cyrillic, a string with a space |
| list | the empty list and lists of one to three witnesses of the element type |
| record, variant with fields | combinations of the witnesses of the fields; a recursive sum is unfolded twice |
| type parameter | `число` is put in its place |

The examples of the function are added to the witnesses. When every parameter has a finite type
(flags, variants without fields, records and sums of them) and the product of the domains is at
most 512, the witnesses are the whole domain: agreement on all of them is agreement on every
input. A function without parameters has a domain of one point.

## What the verdict says

```
СООТВЕТСТВИЕ ПРОВЕРЕНО для N функций, вне валидации M
  перебором всей области P (из них без параметров Z), на свидетелях S; сличено свидетелей K
  причины вне валидации: <reason> — <count>; …
не напечатано или не собрано файлов F: …
расхождений D
```

- **перебором всей области** — the C function agrees with the reference on its whole domain.
- **на свидетелях** — the C function agrees on every compared witness. This is a test, not a
  proof: an error on an input that is not a witness stays unseen.
- **вне валидации** — the function is not checked, and the reason is named: a parameter whose
  value is a function, or every witness ran into a limit.
- **не напечатано** — the print refused the file; the forgery examples of the kernel are refused
  this way by design.

Any disagreement fails the plan and is named with both answers.

## Forgeries

The same plan breaks the printed C of honest programs, one edit each, and requires the
validator to reject every one of them: an operation sign, a branch literal, a precondition
bound, a recursion step, a text constant and swapped operands. A forgery that cannot be built
(its line is gone from the printed C) fails the plan too.

## What stays trusted

The validator trusts the tree printed by `flang ast`: the reference reads it and the print reads
the same parse, so a parser error that changes the meaning of a program is invisible here. It
trusts the reference semantics itself and Lean that runs it, the C runtime
`flang/src/emit/c/flang_runtime.c` and the runner `flang_cli.c` (they are part of every compared
C answer), the C compiler and libc, and the shell commands of the plan that copy, edit and pipe
files. It does not trust the print, the matcher or the interpreter `flang/self/interpret.flang`.
