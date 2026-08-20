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

Every example below is a whole program, and every one of them was checked with:

```bash
flang check file.flang
```

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
| `uses «Module» from "path"` | import every name of the module |
| `uses … only «A», «B»` | import the named ones |

```
module «Report»
  exports «Total»
  uses «Списки» from "../../flang/stdlib/lists.flang" only «Сумма», «Уникальные»

total function «Total»
  accepts items: list number
  returns number
  example «duplicates are not counted twice»
    given items equals [3, 1, 3, 2, 1]
    expected 6
  «Сумма» of («Уникальные» of items)
```

The path is read **relative to the file**, not to the repository root. The name
in quotes must match the module name in that file; if they differ, the compiler
refuses and prints both names.

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

```
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

```
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

```
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

```
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

```
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

```
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

### List

`list Type` — homogeneous. The literal is `[1, 2, 3]`, the empty one is
`empty list`. It is covariant: `list nat` fits where `list number` is expected.

`list of` is the same thing in other words: `list of number` in type position
and `list of 1 and 2 and 3` in value position.

### Record

```
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

```
type «Answer»
  variant Ok contains value: number
  variant Failed contains reason: string
```

Built with `variant Ok with value equal to 30`, taken apart with `match`.

What it gives: "found" and "not found" are different values of different
variants, and matching over them is mandatory. `null` is not used for this.

All of it in one program:

```
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

```
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

```
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

```
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

```
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

## Theorem

Written when a postcondition is not enough.

```
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
| `induction on name decreases measure` | the induction principle and its measure |
| `case …` / `then justification` | a step |
| `therefore proved` | the end |

Justifications: `by hypothesis`, `by example «…»`, `under law «…»`, `by property
«…»`. A step without a justification is rejected by the parser.

Edge: a theorem is not always needed — write the postcondition first and see
whether the kernel closes it on its own. How much closes without a theorem, and
by which rules: [Why and how](proofs.html) and [Kernel
specification](../spec-proof.html) (in Russian).

## The categorical surface

Declaring a pipeline as data: objects, arrows between them, composition.

```
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

### What it gives a developer

Three refusals, each of them taken from a real run.

**1. The pipeline is declared, not called.** Type checking catches a mismatch in
the call `«Bill shipment» of («Ship order» of order)` — there is a call site
there. In a declared pipeline there is no call site. Arrows give it something to
check: swap the order of composition in the example above —

```
morphism «process» это «ship» after «bill»
```

— and `flang check` answers (diagnostic prose is Russian on every surface):

```
FLANG_COMPOSE_MISMATCH: композиция «process» не стыкуется: «bill»
приводит в «Invoice», а «ship» ожидает «Order»
```

The same refusal comes from `chain` if `first` and `next` are swapped.

**2. The arrow drifted away from its implementation.** Change what `«Bill
shipment»` accepts — from `«Shipment»` to `«Order»`. It has no call sites in the
file, and its own types agree. The refusal comes from the arrow:

```
FLANG_MORPHISM_SHAPE: морфизм «bill» ведёт из «Shipment»,
а «Bill shipment» принимает «Order»
```

**3. Two modules drifted apart in how they translate data.** This is the one a
type system does not catch at all. The tree holds a four-file example —
`flang/examples/cat/modules/` — where an orders module, a payments module and a
shipping module describe one thing three ways, and a functor names the
translation between them with the word `gives`. Copy the directory aside and
forget to carry one field over: in the function `«Платёж по заказу»` write
`возвращён равным 0` instead of `возвращён равным заказ.отменён`, and adjust its
example to the new body.

Every function stays total. The types agree. Their own examples are green.
`flang check` answers:

```
FLANG_FUNCTOR_SQUARE: функтор «Заказ в платёж»: квадрат не сходится на стрелке
«отменить заказ»: на {"сумма":500,"отменён":0} путь «Платёж по заказу» после
«отменить заказ» дал {"копейки":50000,"возвращён":0}, а «вернуть платёж» после
«Платёж по заказу» — {"копейки":50000,"возвращён":1}
```

In business terms this is "a cancelled order is cancelled everywhere", and the
refusal names the order on which the two paths diverged.

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
checked](../overview.html) (in Russian).

## Monads and `in monad`

```
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

```
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
| `date`, `money` | FTS heritage: `date` behaves as `string`, `money` as `number` | [Glossary](../glossary.html) |
| `utility`, `rule`, `nested object`, `proposition`, `in data`, `find where`, `by morphism` | FTS heritage: constructions of the previous kernel | [Glossary](../glossary.html) |

## What the language does not have

| Habit | What to use instead |
| --- | --- |
| a loop | `fold` and recursion |
| changing an element in place | building a new value |
| an exception | a variant of a sum type carrying the reason |
| `null` for "not found" | a sum type and a mandatory `match` |
| a variable | `let`, which binds once |
| a function body in place (a lambda) | `function «Name»` with named capture |

## Next

- [Glossary](../glossary.html) — all {{словарь.понятий}} concepts with four spellings (in Russian)
- [Operations](operations.html) — task → what solves it
- [Tutorial](tutorial.html) — the same from zero, step by step
- [Language specification](../spec.html) — the whole contract (in Russian)
- [Known limits](limits.html) — what the language does not do and will not
