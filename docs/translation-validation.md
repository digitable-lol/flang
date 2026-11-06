# Translation validation of the C print

The C print `flang/self/emit-c.flang` turns a checked program into C. Translation validation
asks, function by function, whether the printed C computes what the source computes in the
reference semantics ([reference-semantics.md](reference-semantics.md)). It does not prove the
print; it checks each printed program. The decision is
[ADR-0163](adr/0163-the-printed-c-is-validated-function-by-function-against-the-reference.md).

```
bootstrap/flang run-script translation:validate
bootstrap/flang run-script translation:validate -- --all
bootstrap/flang run-script translation:validate -- --path docs/examples/leetcode
```

The first command takes `flang/proof/examples` and `docs/examples/pythagoras`; with `--all` it
takes every file of `docs/examples` too. With `-- --path <file or directory>` (from the root of the
tree, or absolute) it takes that program and the seven files the forgeries edit, so a program of
your own is validated the same way.

## How it runs

The plan `flang/translation/validation.fscript` takes every file of the corpus and, for each file:

1. reads the tree with `flang ast` and prints C with `flang emit --target c`;
2. builds the printed module with its runner `flang_cli.c` and the runtime, and takes the verdicts
   of the kernel with `flang check --proof --json`;
3. asks `flang/proof/lean/Semantics/Validate.lean plan` for the witnesses of every function
   and the answer of the reference on each of them;
4. sends the same calls to the C runner as JSON lines and reads its answers back through
   `Validate.lean canon`, so that both sides are printed by one printer;
5. compares the two answers line by line;
6. compares the function symbolically (below).

Every step has a time limit; a file that does not fit is named with the step that ran out.

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
| function | the functions of the module without captures that take as many parameters, of fitting kinds (number, flag, string, list) |

The examples of the function are added to the witnesses, and so are the boundaries: every number
literal that a comparison in the body, a precondition or a postcondition holds against a value,
with its two binary64 neighbours, put in place of each numeric parameter in turn (only where it
fits the declared type). When every parameter has a finite type
(flags, variants without fields, records and sums of them) and the product of the domains is at
most 512, the witnesses are the whole domain: agreement on all of them is agreement on every
input. A function without parameters has a domain of one point.

## Symbolic comparison

`Semantics/Symbolic.lean` builds two decision trees for a function and compares them node by
node:

- from the tree of the source, by walking the reference semantics with the parameters left as
  names: a leaf is a value term or a refusal code, an inner node is a condition, a call to
  another function of the module, a call to a builtin form, or a walk over a list (a fold, a
  filter or a map) with its own tree for one step;
- from the printed C, by executing a small subset of C statements symbolically: declarations and
  assignments of `fl_value`, `fl_number`, `fl_flag`, `fl_equal`, `fmod`, arithmetic and comparison
  of doubles (`a * b + 0.0`, `a / b + 0.0` and `fmod(a, b) + 0.0` are the product, quotient and
  remainder of the language, whose zero result is `+0`; a bare `*`, `/` or `fmod` is the binary64
  operation and does not equal the operation of the language), `fl_cond`, `fl_pre`, `fl_post`
  with their refusal, the number guards, variant tests and field reads, text constants (with their byte and character counts checked), calls to the
  functions of the module and the recursion wrapper, applications of a function value through the
  apply function (each of its branches checked against the tag it dispatches); list patterns (`fl_chain_empty`,
  `fl_chain_cons`, `fl_chain_head`, `fl_chain_tail`), list literals (`fl_list_alloc`, stores by
  index, `fl_list`), records and variants with fields (`fl_record_new`, `fl_variant_new` with the
  field names read from `static const char *const …[]`), and calls to the builtin forms `fl_b_…`
  (the 18 forms the reference runs). A fold loop and a filter loop are recognized by their whole
  shape (`for` over `.as.list.items`, an accumulator with `fl_region_recycle` or a `fl_keep` flag,
  and `fl_list` after the loop), and the loop body becomes the tree of one step; for a map
  (`fl_par_map`) the tree of one step is the separate C function the print hands the element and
  the array of captured values. A loop body that leaves
  the function (a `return` that is not a refusal, `break`, `goto`) or writes a variable declared
  outside it (other than the accumulator) is refused. The C tree starts at the door `_call`, so the
  preconditions printed there are compared too.

Equal trees mean that for every input the C function makes the same decisions and computes the
same terms as the reference, provided the functions it calls do; recursion is covered by induction
on the depth of the call, and a walk over a list by induction on its length. A function counts as proved symbolically when its trees are equal and
every function it calls is proved too (by symbols or over its whole domain). Before the C tree is
built, the reference tree is evaluated on every witness and must give the reference answer; a
mismatch is a fault of the symbolic walk, and the function is left out.

A postcondition the kernel proved is not printed in C. Such a postcondition is left out of the
reference tree too, so the proof stands on the kernel for it, and the verdict counts those
functions.

The comparison is syntactic. It refuses code that differs in form but not in value: C that tests
`x > -5e-324` instead of `x >= 0` gives the same answer on every binary64 number and is still
refused. A function it refuses keeps its witnesses.

## What the verdict says

```
СООТВЕТСТВИЕ ПРОВЕРЕНО для N функций, вне валидации M
  доказано для D: перебором всей области P (из них без параметров Z), символьно S
  из символьных опираются на постусловия, доказанные ядром, Y
  на свидетелях без доказательства W; сличено свидетелей K
  символьно не сошлось X; символьно сошлось, но опирается на недоказанные вызовы V
  причины вне символьной проверки: <reason> — <count>; …
  причины вне валидации: <reason> — <count>; …
не напечатано или не собрано файлов F: …
расхождений D
```

- **перебором всей области** — the C function agrees with the reference on its whole domain.
- **символьно** — the decision trees of the C function and of the reference are equal.
- **на свидетелях без доказательства** — the C function agrees on every compared witness. This is a test, not a
  proof: an error on an input that is not a witness stays unseen.
- **вне валидации** — the function is not checked, and the reason is named: a function parameter
  with no fitting function in the module, or every witness ran into a limit.
- **не напечатано** — the print refused the file; the forgery examples of the kernel are refused
  this way by design.

Any disagreement fails the plan and is named with both answers.

## Bounds in CI

The job `translation-validation` of `.github/workflows/binary.yml` runs on every push and every
pull request. It gives the plan a floor and three ceilings:

| key | bound |
|---|---|
| `--validated-floor` | functions with СООТВЕТСТВИЕ ПРОВЕРЕНО, at least |
| `--proved-floor` | functions proved over the whole domain or symbolically, at least |
| `--outside-ceiling` | functions outside the validation, at most |
| `--unprinted-ceiling` | files not printed or not built, at most |

A count past its bound fails the plan with a line `пол … не достигнут` or `потолок … превышен`.
A second step of the same job runs the plan with the proved floor one higher and the ceiling of
files not printed one lower and requires it to fail with both lines, so a bound the plan stopped reading
cannot stay green. Raising a floor or lowering a ceiling is an edit of the numbers in the job, made
together with the change that moved them.

## Forgeries

The same plan breaks the printed C of honest programs, one edit each, and requires the
validator to reject every one of them: an operation sign, a branch literal, a precondition
bound, a recursion step, a text constant, swapped operands, a hidden point (a postcondition check
that fails at one value no witness takes), a bound inside a sum (a precondition over `m² + n²`), a
list length wrong only on a tail of three, a fold step that takes the wrong accumulator, a filter
that drops 1000 and a map condition wrong only at a threshold of 5000.
A forgery is rejected when a witness disagrees or the symbolic comparison does not match. A forgery that cannot be built
(its line is gone from the printed C) fails the plan too.

## What stays trusted

The symbolic comparison adds two more things to trust: the meaning it gives to the C subset it
executes (`Semantics/Symbolic.lean`: C `+`, `<`, `*`, `/`, `fmod` on doubles are the binary64
operations of the reference, `x + 0.0` over the result of `*`, `/` or `fmod` is the product,
quotient or remainder of the language, `fl_b_…` is the builtin form of the same name,
`fl_chain_…` is a list pattern, `fl_list`, `fl_record_new` and `fl_variant_new` build a value,
`fl_par_map` maps in order (when a lane fails the runtime finishes the list sequentially, so the
refusal is the one of the first failing element), `fl_variant_is` in the apply function selects
the function of that tag, the runtime helpers `fl_add` and the like are the operations of the language), and
the kernel for the postconditions it proved and the print left out, and the types: the walk drops
a number guard on a parameter, the result of a function or a form, the head of a list of numbers
and a fold accumulator that starts as a number.

The validator trusts the tree printed by `flang ast`: the reference reads it and the print reads
the same parse, so a parser error that changes the meaning of a program is invisible here. It
trusts the reference semantics itself and Lean that runs it, the C runtime
`flang/src/emit/c/flang_runtime.c` and the runner `flang_cli.c` (they are part of every compared
C answer), the C compiler and libc, and the shell commands of the plan that copy, edit and pipe
files. It does not trust the print, the matcher or the interpreter `flang/self/interpret.flang`.
