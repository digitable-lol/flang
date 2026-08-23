# Language reference

This page answers one question: **how is it written**. For every construction —
the form, a working example, what it gives you and where its edge is.

Neighbouring pages answer other questions:

| Question | Page |
| --- | --- |
| what does this word mean | [Glossary](../glossary.html) — in Russian |
| I have a list and need a sum without duplicates — what do I write | [Operations](operations.html) |
| show me from zero, step by step | [Tutorial](tutorial.html) |
| what does "proved" mean, and how does it differ from "checked" | [Why and how](proofs.html) |
| the full language contract | [Language specification](../spec.html) — in Russian |

## How to read the examples

Most examples below are whole programs, and every such one was checked with:

```bash
flang check file.flang
```

Where that is not so it is said. Three snippets are given without a `module`
line because they show one form of writing, not a program. And the examples of
the categorical surface, of monads and of processes answer with **exit code 2**,
not 0: parsing, types, termination and their own examples pass, while the rules
of those declarations are not judged by the binary compiler, which says so in
words.

The blocks without highlighting are what the compiler **prints**: refusals and
reports. They come out in Russian on every surface. The word at the start of the
line (`FLANG_TYPE`, `FLANG_PROOF_STEP`) is the refusal code.

Everything is written on two surfaces out of four: English and Russian. These
are the same word of the language, not a translation, and both parse to one
tree. The table holds {{словарь.понятий}} concepts; the full list with all four
spellings is the [Glossary](../glossary.html), and how surfaces work is
[Four writing surfaces](../surfaces.html) — both in Russian.

Names — of modules, functions, types, examples, claims — are written in
guillemets `«…»` on every surface.

### What can be typed more than one way

The arrow is typed `→`, `->` or `=>` — all the same thing. Every example below
uses `→`; there is no need to hunt for it on the keyboard.

| Sign | How else it is typed | Where it stands |
| --- | --- | --- |
| `→` | `->`, `=>` | a fold, `отобразить`, `отфильтровать` (map, filter), a function type |
| `"text"` | `'text'` | a string literal |
| `:` `(` `,` and the other punctuation | full-width `：` `（` `，` | a Chinese layout puts them on the same keys |

Words of the language also come in more than one spelling: `объект` and
`структура` (object, structure), `свёртка` and `свертка` (fold, with and without
`ё`), `равен`, `равна`, `равно`, `равным`, `равной`, `равное` (equals, in its
grammatical forms). Every spelling of every word is listed in the
[Glossary](../glossary.html) — one column per surface, all spellings in one cell,
comma-separated. Signs are not in the glossary: it holds words only.

## Module and imports

| Line | What it does |
| --- | --- |
| `module «Name»` | first line of the file, required |
| `exports «A», «B»` | what is visible outside; without the line, everything is |
| `uses «Module»` | import every name of the module |
| `uses … only «A», «B»` | import the named ones — with the caveat below |
| `uses «Module» from "path"` | the same, but the file is named directly |

```flang
module «Report»
  exports «Total»
  uses «Списки»

total function «Total»
  accepts items: list number
  returns number
  example «duplicates are not counted twice»
    given items equals [3, 1, 3, 2, 1]
    expected 6
  «Сумма» of («Уникальные» of items)
```

**Take `only` with care, and here is why.** The word decides not what the
importer sees but **what reaches the assembled program at all**: whatever is not
on the list is not in the program. An imported function may have claims of its
own that call its neighbours. Replace the third line above with `uses «Списки»
only «Сумма», «Уникальные»` and the check refuses:

```
FLANG_UNKNOWN_NAME, строка 635, столбец 74: неизвестная функция «Все не меньше»
FLANG_UNKNOWN_NAME, строка 635, столбец 130: неизвестная функция «Максимум»
```

(Compiler diagnostics are printed in Russian whatever surface the file is
written on. `неизвестная функция` — unknown function.)

Line 635 is the postcondition of `«Сумма»` itself in `lists.flang`: "the sum of
non-negative numbers is at least the largest of them". It calls `«Все не меньше»`
and `«Максимум»`, and `only` did not let them in. The same file with a plain
`uses «Списки»` passes with exit code 0.

There is no path in the line: **a module is found by name**. The name is what
stands on the first line of the file in `module «Списки»`; the file name and its
directory play no part, and a module moved to another directory keeps being
found.

The search covers three places, in this order:

1. the directory of the file that writes `uses`;
2. every directory above it — as long as the directory holds at least one
   `.flang` file;
3. the library shipped with the compiler.

The search does not descend: a module lying off that road is found only if you
name the place in `FLANG_MODULE_DIR` (directories separated by colons) — or name
the file directly, with `uses «Module» from "path"`. The path is read from the
file, not from the root, and works for a package too: `from "name.flang-package"`.

One name on two found modules is a refusal listing both paths, not a silent pick
of the first.

Edge: module names are not translated. The Russian `«Списки»` is imported under
that name from a file written in English words.

## Function

The order of the parts is fixed. The body comes last, in one form.

| Part | Required | What it means |
| --- | --- | --- |
| `total` | no | a promise to terminate on every input; it is checked |
| `function «Name»` | yes | the declaration |
| `accepts name: type, name: type` | no | parameters; types are required |
| `returns type` | yes | the result type |
| `requires «name» condition` | no | precondition; discharged by the **caller** |
| `decreases expression` | no | a declared decreasing measure |
| `for all p ensures «name» condition` | no | postcondition about `result` |
| `example «name»` / `given` / `expected` | no | an executable example |

```flang
module «Signature»

total function «Share»
  accepts part: nat, whole: nat
  returns number
  requires «divisor is positive» whole is greater than 0
  for all part ensures «share is non-negative» result is at least 0
  example «half»
    given part equals 1
    given whole equals 2
    expected 0.5
  part divided by whole
```

A call is `«Name» of argument and argument`. The word `and` separates arguments;
conjunction is written with the compound `and also`, so the two never collide.

Edges:

- in emitted code `requires` sits only on the boundary of the program — where a
  value arrives from outside. Internal calls do not pay for it;
- `ensures` cannot be written without a name: the name is how the claim is found
  in the `flang check --proof` report and how a theorem refers to it;
- examples run on **every** check. If one does not hold: `FLANG_EXAMPLE`, and
  the compiler refuses to emit the program.

## Totality and measures

`total` is carried by one of five means. The first three cost nothing at run
time; the last two put a check into the emitted code. Which one carried which
function is in the `flang check --proof` report; the counts across the tree are
on [Why and how](proofs.html).

| Means | When it applies |
| --- | --- |
| by composition | no recursion at all |
| by structure | `match` walks a part of the value |
| by exact step | a `nat` parameter descending by a constant |
| by constant step | the same on `number`, with a run-time check |
| by declared measure | `decreases`, with a run-time check |

`decreases` sits between `returns` and the body and must be a number. It is
written where the decrease lives in the arithmetic rather than in the shape of
the call:

```flang
module «Measure»

total function «GCD»
  accepts a: number, b: number
  returns number
  decreases b
  example «twelve and eighteen»
    given a equals 12
    given b equals 18
    expected 6
  if b equals 0
    then a
    else «GCD» of b and (a modulo b)
```

Edge: the measure must be integral and non-negative, and that is checked on
every turn. `«GCD»` of integers always works; `«GCD»` of a real pair refuses
with `FLANG_MEASURE` — their chain of remainders decreases strictly and never
ends.

## The body: four forms

Branching, matching a sum, folding, binding. There are no loops.

### `match` — over a sum type

```flang
module «Tree»

type «Tree»
  variant Leaf
  variant Node contains value: number, left: «Tree», right: «Tree»

total function «Nodes»
  accepts tree: «Tree»
  returns number
  example «a leaf has no nodes»
    given tree equals variant Leaf
    expected 0
  match tree
    case Leaf
      then 0
    case variant Node with left as l and right as r
      then 1 plus («Nodes» of l) plus («Nodes» of r)
```

Patterns: `case Name` — a variant without fields; `case variant Name with field
as name` — with field bindings; `case empty` and `case head and tail` — a list
or a string; `case any` — everything else.

What it gives: exhaustiveness is computed by the type checker — a missing
variant is a refusal, not silence. Recursion over a part of the value is total
by construction. Induction in a theorem attaches **only** to this form.

### `fold` — one pass over a list

```flang
module «Fold»

total function «Product»
  accepts items: list number
  returns number
  example «three factors»
    given items equals [2, 3, 4]
    expected 24
  fold items starting with 1 as acc and x → acc times x
```

What it gives: totality by construction — the list is finite, the pass is one.

Edge: the accumulator type is not refined. A `nat` in the accumulator stays
`number`.

### `if` — branching

```flang
module «Branching»

total function «Sum up to»
  accepts n: nat
  returns number
  example «up to zero is zero»
    given n equals 0
    expected 0
  example «up to three is six»
    given n equals 3
    expected 6
  if n is at most 0
    then 0
    else n plus («Sum up to» of (n minus 1))
```

Edge: both branches are required, and the condition must be a boolean. The
condition narrows **numeric bounds** inside its branch, but it does not become a
fact for the proof kernel.

### `let` — binding a name

```flang
module «Binding»

object «Line»
  price is number
  quantity is number

total function «Line cost»
  accepts entry: «Line»
  returns number
  example «two at three hundred»
    given entry equals record «Line» with price equal to 300 and quantity equal to 2
    expected 660
  let net equals entry.price times entry.quantity
  let tax equals 10 percent of net
  net plus tax
```

Edge: it binds once. This is not a variable; there is no second assignment. The
name is one word or is written in guillemets: `let net amount equals …` does not
parse — a multi-word name is written `let «net amount» equals …`.

## Types

### Scalars

| Type | What it is |
| --- | --- |
| `number` | IEEE-754 double |
| `nat` | an integer in [0, 2⁵³−1] |
| `integer` | an integer in [−(2⁵³−1), 2⁵³−1] |
| `weight` | non-negative, where `+∞` is a value rather than an edge |
| `hundredths`, `thousandths` | an integer count of minor units: exact money and shares |
| `string` | a string |
| `boolean` | `true` / `false` |
| `null` | one single value |

Nesting: `nat` ≤ `integer` ≤ `number` and `nat` ≤ `weight` ≤ `number`. A value
flows into a declared position, never back out.

What declaring an exact type gives: bounds and integrality for the proof kernel,
a floor and a ceiling for the termination analysis. `number` gives nothing.

Edge: `divided by` leaves the exact type — the result becomes `number`. There is
no rounding in the language, neither explicit nor silent. Each type in full:
[Language specification](../spec.html), section "Types" (in Russian).

### Which numeric type to take

| What the number is | Type | What you get for it |
| --- | --- | --- |
| a counter, an index, a count, a length | `nat` | zero and up, integral; a descent by a constant makes totality free |
| a difference, a balance, an offset, a temperature | `integer` | minus allowed, fractions not |
| money: units and cents | `hundredths` | an integer count of minor units; `19.99` is written `1999` |
| rates, shares, exchange rates | `thousandths` | the same with three decimal places |
| weight, distance, path cost | `weight` | non-negative, where `+∞` is a value rather than an edge |
| everything else, and any division | `number` | IEEE-754 double, no promises |

```flang
module «Exact types»

total function «Order in cents»
  accepts price: hundredths, count: nat
  returns number
  example «three at 19.99»
    given price equals 1999
    given count equals 3
    expected 5997
  price times count

total function «Share»
  accepts part: nat, whole: nat
  returns number
  requires «the divisor is positive» whole is greater than 0
  example «a half»
    given part equals 1
    given whole equals 2
    expected 0.5
  part divided by whole
```

Edge: **arithmetic does not inherit exactness.** Add two `nat` values, declare
the return as `nat`, and you get a refusal:

```
FLANG_TYPE, строка 6, столбец 5: функция «Sum of nats» объявлена как нат, а тело даёт число
```

An exact type belongs on **inputs and record fields** — where the proof kernel
takes bounds and integrality from it, and the termination analysis takes a floor.
Declare the return as `number` when the body computes with arithmetic.

### List

`list Type` — homogeneous. The literal is `[1, 2, 3]`, the empty one is
`empty list`. It is covariant: `list nat` fits where `list number` is expected.

`list of` is the same thing in other words: `list of number` in type position
and `list of 1 and 2 and 3` in value position.

### Record

```flang
object «Line»
  title is string
  price is number
  discount may be number
```

A field is written `name is type` or `«name»: type`. `may be` means the field
can be absent. A record is built with `record «Line» with title equal to "bolt"
and price equal to 30` and read with a dot: `entry.price`.

Edge: records are invariant. There is no field replacement — values are
immutable, so a new record is built.

### Sum type

```flang
type «Answer»
  variant Ok contains value: number
  variant Failed contains reason: string
```

Built with `variant Ok with value equal to 30`, taken apart with `match`.

What it gives: "found" and "not found" are different values of different
variants, and matching over them is mandatory. `null` is not used for this.

All of it in one program:

```flang
module «Types»

object «Line»
  title is string
  price is number
  discount may be number

тип «Invoice» это list «Line»

type «Answer»
  variant Ok contains value: number
  variant Failed contains reason: string

total function «Check price»
  accepts entry: «Line»
  returns «Answer»
  example «price is there»
    given entry equals record «Line» with title equal to "bolt" and price equal to 30
    expected variant Ok with value equal to 30
  example «zero is not a price»
    given entry equals record «Line» with title equal to "nut" and price equal to 0
    expected variant Failed with reason equal to "price is not positive"
  if entry.price is greater than 0
    then variant Ok with value equal to entry.price
    else variant Failed with reason equal to "price is not positive"
```

A field declared with `may be` does not have to be written in the examples.

### Alias and parametric types

```flang
тип «Invoice» это list «Line»

type «Maybe» of «A»
  variant «Some» contains value: «A»
  variant «None»
```

Parameters are introduced with `of` and applied with the same word. Arguments at
the call site are inferred from the values — there is nowhere to write them.

Edge: the alias word `это` has no English spelling. In a file written on the
English surface it is written with the Russian word, as above.

### Function types

`function from number and string to boolean` is the worded form; `number →
number` is the arrow form. Both give one type.

Edge: on the English surface the worded form `function from number to number`
does not parse — `to number` is taken by the built-in string conversion. Use the
arrow: `number → number`.

## Expressions

| What | How it is written |
| --- | --- |
| function call | `«Name» of argument and argument` |
| record field | `value.field` |
| arithmetic | `plus`, `minus`, `times`, `divided by`, `modulo`, `percent of` |
| comparison | `equals`, `is not equal to`, `is greater than`, `is less than`, `is at most`, `is at least` |
| logic | `not`, `and also`, `or` |
| literals | `12`, `"text"`, `true`, `false`, `null`, `[1, 2]` |

Precedence, from weakest to strongest:

```
or  <  and also  <  not  <  comparisons  <  plus minus  <  times divided  <  of  .
```

Edge: the comparisons are `is at least` and `is at most`. They do not assemble
by analogy — `not less than` is not a phrase of the language. Take the spelling
from the [glossary](../glossary.html).

## Built-in forms over lists and strings

| Form | What it does |
| --- | --- |
| `length X` | the length of a list or a string |
| `head X`, `tail X`, `empty` | parts of a list and of a string |
| `item N in X` | the N-th element of a list |
| `char N in X` | the N-th character of a string |
| `add X to Y`, `prepend X to Y` | at the end and at the front of a list |
| `map X as name → body` | a new list |
| `filter X where name → condition` | selection |
| `substring X from A to B` | a slice of a string |
| `split X by Y` | string → list of strings |
| `join X by Y` | list of strings → string |
| `join X with Y` | concatenating two strings |
| `contains`, `begins with` | checks over a string |
| `to number`, `to number or failure`, `to text` | conversions |
| `character code X`, `decompose X into characters` | character by character |
| `character by code N` | code point as a number → a one-character string; refuses on fractions, outside [0, 1114111], and on a lone surrogate |

```flang
module «Built-in forms»

total function «Long words»
  accepts text: string
  returns list string
  example «the short word is dropped»
    given text equals "one twice thrice"
    expected ["twice", "thrice"]
  filter (split text by " ") where word → (length word) is greater than 3

total function «Word lengths»
  accepts words: list string
  returns list number
  example «three words»
    given words equals ["one", "twice", "thrice"]
    expected [3, 5, 6]
  map words as word → length word
```

The prepositions are fixed, and they differ from form to form:

```flang
module «Strings»

total function «Second word»
  accepts text: string
  returns string
  example «two words»
    given text equals "one twice"
    expected "twice"
  item 2 in (split text by " ")

total function «First three»
  accepts text: string
  returns string
  example «cut from the head»
    given text equals "abcdef"
    expected "abc"
  substring text from 1 to 3

total function «Glued»
  accepts parts: list string
  returns string
  example «joined with a comma»
    given parts equals ["a", "b"]
    expected "a,b"
  join parts by ","

total function «Initial»
  accepts text: string
  returns string
  example «first letter»
    given text equals "abc"
    expected "a"
  char 1 in text
```

Edge: indexing starts at one and is inclusive. An index outside the list stops
the computation with a refusal. Everything not in this list is a library
function; which task is solved by which one is on [Operations](operations.html).

## Functions as values

```flang
module «Function as a value»

total function «Double»
  accepts x: number
  returns number
  x times 2

total function «Add»
  accepts a: number, b: number
  returns number
  a plus b

total function «Apply twice»
  accepts f: number → number, x: number
  returns number
  f of (f of x)

total function «Trial»
  returns number
  example «five doubled twice»
    expected 20
  «Apply twice» of function «Double» and 5

total function «Trial with capture»
  returns number
  example «ten added twice»
    expected 25
  «Apply twice» of (function «Add» with a equal to 10) and 5
```

| Form | What it means |
| --- | --- |
| `function «Name»` | a function as a value |
| `function «Name» with a equal to 10` | the same with the first parameter captured |
| `f of 5` | applying a value |
| `number → number` | the type |

**What replaces closures.** Capture is by name: `function «Add» with a equal to
10` yields a one-argument function. The order of capture must follow the order
of the declared parameters. There is no anonymous function value: only a
declared function is taken as a value. A body written in place (`x → x plus 1`)
is accepted by the built-in `map`, `filter` and `fold`, but such a body is part
of the form, not a value, and cannot be passed anywhere.

Edge: you can only apply a function that the program takes somewhere with the
form `function «Name»`. A function value arriving from outside and taken nowhere
in the program is rejected with `FLANG_APPLY`. There is no separate compilation:
function values are lowered across the whole program at once.

## Claims about behaviour

Four words promise more about a function than its type does. They are checked in
different ways, and the difference shows at once.

| Word | Where it stands | Who answers for it | What checks it |
| --- | --- | --- | --- |
| `requires «name» condition` | after `returns`, before the body | **the caller** | a run-time check on the boundary of the program |
| `for all p ensures «name» condition` | the same place, after `requires` | the function itself | the kernel at check time; if it fails, a check on every return |
| `total` | before the word `function` | the compiler | at check time; see [Totality and measures](#totality-and-measures) |
| `theorem «name»` | top level, next to the function | the author of the proof | the kernel at check time, step by step |

### `requires` — a precondition

`requires «name» condition` — the condition under which calling the function is
lawful.

```flang
module «Precondition»

total function «Share»
  accepts part: nat, whole: nat
  returns number
  requires «the divisor is positive» whole is greater than 0
  example «a half»
    given part equals 1
    given whole equals 2
    expected 0.5
  part divided by whole
```

What it gives: inside the function the condition becomes an **assumption** — the
one `by hypothesis` refers to in a theorem, even where there is no induction.

Edge: the run-time check is emitted only on the boundary of the program — where
a value arrives from outside. Internal calls do not pay for it.

### `ensures` — a postcondition

`for all p ensures «name» condition` — what holds of `result` on every input.
The word `result` in the condition means the returned value.

```flang
module «Postcondition»

total function «Double all»
  accepts items: list number
  returns list number
  for all items ensures «length is preserved» (length result) equals (length items)
  example «three items»
    given items equals [1, 2, 3]
    expected [2, 4, 6]
  map items as x → x times 2
```

What it gives: the kernel first tries to **prove** the condition. Proved — there
is no check in the emitted code. Not proved — the condition is checked on every
return, and a violation stops the computation. What closed and what did not is
shown by `flang check --proof`.

Edge: the name is not optional — `ensures` without a name does not parse. A
theorem refers to the claim by that name, and so does `by property` from someone
else's proof.

### `theorem`

Written when a postcondition is not enough: the kernel did not close it by itself.

```flang
module «Theorem»

total function «Sum up to»
  accepts n: nat
  returns number
  for all n ensures «sum up to is non-negative» result is at least 0
  example «no steps left»
    given n equals 0
    expected 0
  if n is at most 0
    then 0
    else n plus («Sum up to» of (n minus 1))

theorem «sum up to is non-negative»
  given n: nat
  claim result is at least 0
  induction on n decreases n
    case 0
      then by example «no steps left»
    case any
      then by hypothesis
  therefore proved
```

| Line | What it does |
| --- | --- |
| `theorem «name»` | the name matches the postcondition's name |
| `given name: type` | the variables of the claim |
| `claim condition` | what is being proved |
| `induction on name decreases measure` | the induction principle and its measure; `decreases` is needed only where a number goes down, not a part of a value |
| `case …` / `then justification` | a step |
| `next claim by justification` | an intermediate fact: prove it and later steps may lean on it |
| `therefore proved` | the end |

There may be no induction at all — a short theorem fits into a single line of
justification:

```flang
module «Property»

total function «Double all»
  accepts items: list number
  returns list number
  for all items ensures «doubling keeps the length» (length result) equals (length items)
  map items as x → x times 2

total function «Through doubling»
  accepts items: list number
  returns list number
  for all items ensures «through doubling the length is the same» (length result) equals (length items)
  «Double all» of items

theorem «through doubling the length is the same»
  given items: list number
  claim (length result) equals (length items)
  by property «doubling keeps the length»
  therefore proved
```

Edge: a theorem is not always needed — write the postcondition first and see
whether the kernel closes it on its own. Induction attaches **only** to `match`
over a declared sum and to a descent along a number.

### Justifications for a step

A step without a justification is rejected by the parser. There are four, and
each works in its own place.

| Justification | Works when |
| --- | --- |
| `by property «name»` | the conclusion of the step holds a **call** to a function that has a postcondition of that name |
| `by hypothesis` | there is an assumption: an induction hypothesis (`induction on`) or a precondition of the function (`requires`) |
| `by example «name»` | the case holds **one** value, that is, a pattern with no bound names, and the function has an example of that name |
| `under law «name»` | the law is declared: by a monoid, a monad or an isomorphism of this module |

### `by property`

A reference to **someone else's** postcondition. The kernel looks for calls to
the named function in the conclusion and substitutes its postcondition:
parameters for the arguments of that call, `result` for the call itself. There is
nothing to search: the call itself names the substitution.

The example is the theorem "through doubling the length is the same" above. A
reference to **your own** postcondition is a circle, and the kernel says so:

```
FLANG_PROOF_STEP, строка 12, столбец 3: шаг 1, теорема «длина сохраняется»: «по свойству «длина сохраняется»» ссылается на то самое постусловие, которое сейчас доказывается — это круг. Часть значения обосновывает «по предположению», а не ссылка на саму цель
```

Edge: a postcondition of that name must exist **on some function of the module**.
If there is none, the refusal says there is nothing to refer to.

### `by hypothesis`

Takes an assumption. There are two kinds and the word covers both: an induction
hypothesis — the same claim about a smaller part of the value; and a precondition
of the function — the `requires` line. Inside induction it is the `by hypothesis`
of the "Sum up to" example.

With neither one, the refusal names exactly what was missing:

```
FLANG_PROOF_INDUCTION_STEP, строка 12, столбец 3: шаг 1, теорема «половина неотрицательна»: «по предположению» стоит вне индукции, а допущений у этой цели нет ни одного: ни посылки индукции (её даёт `индукция по`), ни предусловия функции (его даёт `требует`). Предполагать не о чем
```

Edge: a hypothesis has no name. There is one per case, and there is no way to
refer to the hypothesis of another case.

### `by example`

Closes a case by running an example. An example is **one** value, so it can close
exactly the case that holds one value: `case 0`, `case Leaf`, `case empty` — a
pattern **with no bound names**.

`case variant Node with left as l` is not closed by one example: it holds
infinitely many values, and the example speaks of one. Such cases are closed by
`by hypothesis`.

Edge: the example is looked up on the function whose postcondition is being
proved, and by name. No example of that name — the refusal names both strings in
guillemets.

### `under law`

A reference to a law declared in the module: a law of a monoid, a monad or an
isomorphism. An undeclared law is not accepted — otherwise the line
`under law «what never happens»` would close anything:

```
закона «чего не бывает» в модуле нет: ни моноида, ни монады, ни изоморфизма с таким именем не объявлено — сослаться не на что
```

How much closes without a theorem, and by which rules: [Why and
how](proofs.html) and [Kernel specification](../spec-proof.html) (in Russian).

## The categorical surface

Declaring a pipeline as data: objects, arrows between them, composition.

```flang
module «Order pipeline»

object «Order»
  amount is number

object «Shipment»
  code is number

object «Invoice»
  total is number

total function «Ship order»
  accepts order: «Order»
  returns «Shipment»
  record «Shipment» with code equal to order.amount

total function «Bill shipment»
  accepts shipment: «Shipment»
  returns «Invoice»
  record «Invoice» with total equal to shipment.code

morphism «ship» from «Order» to «Shipment»
  gives «Ship order»
  law «the shipment code comes from the order amount»
    example «an ordinary order»
      given order equals record «Order» with amount equal to 500
      expected record «Shipment» with code equal to 500

morphism «bill» from «Shipment» to «Invoice»
  gives «Bill shipment»

morphism «process» это «bill» after «ship»

chain «process an order»
  first «ship»
  next «bill»
```

| Construction | What it does |
| --- | --- |
| `object «X»` | a kind of data; fields as in a record |
| `morphism «m» from «A» to «B»` | an arrow with declared ends |
| `gives «F»` | the function the arrow is |
| `law «name»` with examples | what the arrow promises, on values |
| `«b» after «a»` | composition; the right one runs first |
| `chain` / `first` / `next` | the same composition in reading order |
| `identity «X»` | the identity arrow of an object |
| `category «C»` with a list of arrows | the interface: what the module can do |
| `isomorphism` / `forward morphism` / `inverse morphism` | a pair of arrows there and back |
| `functor` / `bifunctor` | a link between categories |
| `monoid` / `carrier` / `operation` / `identity` / `inverse element` | a structure with its own laws |

### What it gives a developer today

One thing it gives, three promised refusals it does not, and the two must not be
confused. Measured by a run on 21 August 2026.

**It gives: the laws of a category are computed.** If a category declares its own
equality (`объект «Х» даёт «Х равны»`), the compiler computes over a finite grid
of values that the equality is an equivalence, that composition respects it, and
that composition is associative. The report states the grid size:

```
категория «Отгрузки»: сетка 5 значений на 3 объектах, троек стрелок 7,
нарушений 0 — ПОСЧИТАНО НА СЕТКЕ, не доказано
```

A violation is a refusal with exit code 1 and the offending pair of values shown,
and emitting such a program is cancelled: zero files. The same holds for a
natural transformation — `FLANG_TRANSFORM_NOT_NATURAL`, with both paths and their
values.

**It does not give: the shape of the declarations is not checked.** Closure of a
category under composition, identities on objects, the endpoints of composed
arrows agreeing, the shape of a functor — none of that is checked by anything
today, and the compiler says so in a separate line and answers with exit code 2
rather than going green in silence. So:

- a swapped composition order (`«отгрузить» после «выставить»`) yields **no**
  refusal, although `FLANG_COMPOSE_MISMATCH` is described in the contract;
- an arrow drifting from its function yields **no** refusal, although
  `FLANG_MORPHISM_SHAPE` is described;
- a functor square that does not commute yields **no** refusal: functors are not
  judged at all, and `FLANG_FUNCTOR_SQUARE` does not fire.

All three codes exist in the sources and the rules are written down — the binary
simply does not get to them. Read it this way: **a category declaration today
documents intent and gives you the laws counted over a grid; it is not a check of
the shape.** With runs: [The categorical surface](categories.html).

Edges, worth knowing before you start:

- an ordinary composition written as a call is caught by type checking without
  any arrows. Arrows are for pipelines that are **declared** rather than called;
- the structure (ends, composition, identities, completeness of a link) is
  proved by comparing declarations. The functor square and the arrow laws are
  **checked on a grid** built from the author's examples, and that is not a
  proof. The report prints the size of the grid;
- a category stays a note to the reader until it is given a list of its own
  arrows; there is nothing to check a claim that an object belongs to one;
- a translation without an implementation (`maps to` without `gives`) is not
  checked at all: such a link is recorded as assumed.

The full contract: [Categories and functors](../spec-cat.html) (in Russian).
Where "proved" ends and "checked" begins: [What is proved and what is
not](what-is-proved.html).

## Monads and `in monad`

```flang
module «Discount»

type «Maybe» of «A»
  variant «Some» contains value: «A»
  variant «None»

monad «Maybe» of «A»
  return «Wrap»
  flatten «Flatten»

total function «Wrap» of «A»
  accepts value: «A»
  returns «Maybe» of «A»
  variant «Some» with value equal to value

total function «Flatten» of «A»
  accepts nested: «Maybe» of («Maybe» of «A»)
  returns «Maybe» of «A»
  match nested
    case variant «Some» with value as inner
      then inner
    case «None»
      then variant «None»

total function «Price of item»
  accepts code: number
  returns «Maybe» of number
  if code equals 1
    then variant «Some» with value equal to 500
    else variant «None»

total function «Discount for price»
  accepts price: number
  returns «Maybe» of number
  if price is at least 400
    then variant «Some» with value equal to (price divided by 10)
    else variant «None»

total function «Discounted total»
  accepts code: number
  returns «Maybe» of number
  example «the first item has a discount»
    given code equals 1
    expected variant «Some» with value equal to 450
  example «the second item is not in the catalogue»
    given code equals 2
    expected variant «None»
  in monad «Maybe»
    let price equals «Price of item» of code
    let discount equals «Discount for price» of price
    return price minus discount
```

| Line | What it does |
| --- | --- |
| `monad «T» of «A»` | declared on a parametric type |
| `return «F»` | the function that wraps a value |
| `flatten «F»` | the function that removes one layer |
| `in monad «T»` | the binding block |
| `let name equals step` | a step that is allowed not to answer |
| `return expression` | the last line of the block |

What it gives: the block is expanded by the compiler into a nested `match` over
the variants of the type. The staircase of "none on none", which grows with
every step, is not written.

Edge: `return` must be the last line of the block. The endofunctor mapping is
not declared — the compiler derives it from the shape of the type. The binding
laws are checked on a finite grid; the structure is proved by comparing
declarations.

## Processes and supervision

State belongs to a process. The handler is an ordinary total function returning
a new state and a list of actions. Sending is described, not performed.

```flang
module «Counter»

object «Count»
  «total»: number

object «Reply»
  «состояние»: «Count»
  «действия»: list «Действие»

type «Command»
  variant «add» contains «amount»: number

process «Counter»
  state «Count»
  starts with «empty count»
  accepts «Command»
  handles «counter step»

supervision «Bookkeeping»
  process «Counter» strategy «перезапустить»
  failure threshold 3 within 5000 milliseconds else «передать выше»

total function «empty count»
  returns «Count»
  record «Count» with «total» equal to 0

total function «counter step»
  accepts current: «Count», message: «Command»
  returns «Reply»
  example «adding changes the state and sends nothing»
    given current equals (record «Count» with «total» equal to 1)
    given message equals (variant «add» with «amount» equal to 2)
    expected (record «Reply» with «состояние» equal to (record «Count» with «total» equal to 3) and «действия» equal to [])
  match message
    case variant «add» with «amount» as amount
      let updated equals (record «Count» with «total» equal to (current.«total» plus amount))
      record «Reply» with «состояние» equal to updated and «действия» equal to []

run «two additions»
  seed 1
  given «Counter» accepts (variant «add» with «amount» equal to 2)
  given «Counter» accepts (variant «add» with «amount» equal to 3)
  expected «Counter» equals (record «Count» with «total» equal to 5)
```

| Line | What it does |
| --- | --- |
| `process «P»` | the declaration |
| `state «T»` | the type of the state |
| `starts with «F»` | the function giving the initial state |
| `accepts «T»` | the type of messages |
| `handles «F»` | the handler |
| `with budget N` | the turn limit for a non-total handler |
| `with mailbox N` | the size of the mailbox |
| `supervision «S»` | failure decisions, as data |
| `process «P» strategy «…»` | what to do on a failure |
| `failure threshold N within M … else «…»` | the window and the fallback strategy |
| `run «name»` / `seed` / `given` / `expected` | an example of a concurrent program |
| `seed from N to M` | the same run over a grid of interleavings |

Edge: the reply fields (`состояние`, `действия`) and the type `«Действие»` are
part of the model's contract, not a convention of the file, and they keep their
Russian spelling on every surface. So do the strategy names (`перезапустить`,
`остановить`, `передать выше`) and the normal stop reason `норма`.

The model in full, with its costs and measurements: [Processes and fault
tolerance](../spec-conc.html) (in Russian).

## Words that do not appear in the examples above

The forms above are the ones programs are written from. The remaining words of
the table are named here so that nobody has to hunt for them.

| Word | Where it belongs | Where it is described |
| --- | --- | --- |
| `embedding`, `intersection` | the categorical surface: a part of an object and the common part of two | [Categories and functors](../spec-cat.html) |
| `objects`, `morphisms` | bifunctor: a pair of objects and a pair of arrows | the same |
| `maps to`, `maps to field`, `maps to morphism` | the lines of a functor | the same |
| `property` | a law of a single operation: commutativity, monotonicity and three more | [Categories and functors](../spec-cat.html) |
| `plan` | input and output: declared by the same three lines as a process | [Categories and functors](../spec-cat.html), section "Эффекты и HTTP" |
| `date`, `money` | heritage of the earlier surface: `date` behaves as `string`, `money` as `number` | [Glossary](../glossary.html) |
| `has` — the line `given «Object» has «field» equal to value` | heritage of the earlier theorem form; next to the words of a proof it is rejected | below |
| `utility`, `rule`, `nested object`, `proposition`, `in data`, `find where`, `by morphism` | heritage of the earlier surface: still parsed, but a program can no longer be built out of them | [Glossary](../glossary.html) |

The earlier theorem form does not blend with the present one: the line
`given «Object» has «field»` next to `claim` is a refusal, not a mixture.

```
FLANG_PARSE, строка 12, столбец 1: теорема «цена та же» смешала две формы: дано «Объект» имеет «поле» — из старой, а рядом стоят слова доказательства. Выберите одну форму
```

`in data`, `by morphism` and `therefore «conclusion»` behave the same way.

## What the language does not have

| Habit | What to use instead |
| --- | --- |
| a loop | `fold` and recursion |
| changing an element in place | building a new value |
| an exception | a variant of a sum type carrying the reason |
| `null` for "not found" | a sum type and a mandatory `match` |
| a variable | `let`, which binds once |
| a function body in place (a lambda) | `function «Name»` with named capture |
| a closure carrying a local name outwards | capture of declared parameters only: `function «Name» with a equal to 10` |
| bitwise operations: `and`, `or`, `xor`, shifts | arithmetic: `times`, `divided by`, `modulo` |
| writing into a list by index (`x[i] = v`) | `map` builds a new list |
| a dependent type (`list of length n`) | `ensures` about the length, and a theorem about it |

## Next

- [Glossary](../glossary.html) — all {{словарь.понятий}} concepts with four spellings (in Russian)
- [Operations](operations.html) — task → what solves it
- [Tutorial](tutorial.html) — the same from zero, step by step
- [Language specification](../spec.html) — the whole contract (in Russian)
- [Known limits](limits.html) — what the language does not do and will not
- [Standard library reference](stdlib.html) — the standard library modules and what to take from each
