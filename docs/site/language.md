# Language reference

This page answers one question: **how is it written**. For every construct you
get its usual name, the syntax, a working example, what the compiler checks and
where its limits are.

Other pages answer other questions:

| Question | Page |
| --- | --- |
| what does this word mean | [Glossary](../glossary.html) — in Russian |
| I have a task — which construct do I use | [Which construct to use when](which-construct.html) |
| I have a list and need a sum without duplicates — what do I write | [Operations](operations.html) |
| show me from zero, step by step | [Tutorial](tutorial.html) |
| what does "proved" mean, and how does it differ from "checked" | [Why and how](proofs.html) |
| the full language contract | [Language specification](../spec.html) — in Russian |

## Glossary: flang words and the usual terms

| In flang | Usual name | Closest analogue |
| --- | --- | --- |
| `тип` with `вариант`s | enum with data, tagged union | `enum` in Rust, union in TypeScript |
| `разбор … случай` | pattern matching | `match` in Rust and Python |
| `если … то … иначе` | if as an expression | the ternary operator |
| `пусть` | constant | `const` |
| `отобразить`, `отфильтровать`, `свёртка` | map, filter, reduce | the same in JavaScript and Python |
| `объект` and `запись` | a struct with fields and its value | dataclass, interface |
| `пример` | a unit test inside the function | doctest |
| `требует` | precondition: what must hold on input | an assert at the top of a function |
| `обеспечивает` | postcondition: what the function guarantees on output | an assert at the end, but checked for all inputs |
| `тотальная функция` | a function the compiler has proved to always terminate | — |
| `теорема` | a proof you write yourself | — |
| `план` | side effects: the function returns a command ("read the file"), the runtime executes it and calls the function again with the response | reducer, state machine |

The **prover** is the part of the compiler that proves `обеспечивает` for all
possible inputs, not only for your examples. In the compiler output it is called
«ядро» (kernel), and an `обеспечивает` line is called «постусловие»
(postcondition).

## How to read the examples

Most examples below are whole programs, and each of them passes:

```bash
flang check file.flang
```

Where that is not so, the text says it. Snippets without a `module` line show one
form, not a program. The examples of categories, monads and
processes exit with **code 2**, not 0: parsing, types, termination and examples
pass, but the binary compiler does not check the rules of those declarations,
and it says so in its output.

Blocks without highlighting are what the compiler **prints**: errors and
reports. The compiler prints in Russian whatever language the file is written
in. The word at the start of a line (`FLANG_TYPE`, `FLANG_PROOF_STEP`) is the
error code; every code is explained in the [Diagnostics reference](diagnostics.html).

Every keyword has an English and a Russian spelling (there are four spellings in
all, called surfaces). They are the same keyword, not a translation: both parse
to the same tree, and one file may use either. There are {{словарь.понятий}}
concepts; the full list with all four spellings is the
[Glossary](../glossary.html), and how the spellings work is
[Four writing surfaces](../surfaces.html) — both in Russian.

Names — of modules, functions, types, examples, postconditions — are written in
guillemets `«…»`, in either spelling of the keywords.

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
  uses «Lists»

total function «Total»
  accepts items: list number
  returns number
  example «duplicates are not counted twice»
    given items equals [3, 1, 3, 2, 1]
    expected 6
  «Сумма» of («Уникальные» of items)
```

**Avoid `only` unless you need it.** It does not just hide names: whatever is
not on the list is **left out of the program**. But the functions you import
call other functions of their module, in their bodies and in their
postconditions. Replace the third line above with `uses «Lists» only «Сумма»,
«Уникальные»` and the check fails:

```
модуль «Report»: функций 3, из них с доказанным завершением 0; типов 0; файлов вместе с импортами 2
без доказанного завершения: «Сумма» «Уникальные» «Total»
место указано строкой и столбцом, но без файла: вместе с импортами проверено файлов 2, а диагностика компилятора имени файла не несёт
FLANG_UNKNOWN_NAME, строка 460, столбец 47: неизвестная функция «Шаг суммы»
FLANG_UNKNOWN_NAME, строка 453, столбец 74: неизвестная функция «Все не меньше»
FLANG_UNKNOWN_NAME, строка 453, столбец 130: неизвестная функция «Максимум»
FLANG_UNKNOWN_NAME, строка 564, столбец 59: неизвестная функция «Шаг уникальных»
FLANG_NOT_TOTAL, строка 460, столбец 47: тотальная функция «Сумма» вызывает неизвестную функцию «Шаг суммы»: завершение доказать нельзя
FLANG_NOT_TOTAL, строка 564, столбец 59: тотальная функция «Уникальные» вызывает неизвестную функцию «Шаг уникальных»: завершение доказать нельзя
only.flang: не проверено — замечаний 6
```

`неизвестная функция` means "unknown function". The line numbers point into
`flang/stdlib/lists.flang`: line 453 is the postcondition of `«Сумма»` ("the sum
of non-negative numbers is at least the largest of them"), which calls
`«Все не меньше»` and `«Максимум»`; line 460 is the body of `«Сумма»`, which calls
`«Шаг суммы»`; line 564 is the body of `«Уникальные»`. `only` left all of them
out. The same file with a plain `uses «Lists»` passes with exit code 0.

There is no path in `uses`: **a module is found by name**. The name is what
stands on the first line of the file in `module «Lists»`; the file name and its
directory play no part, and a module moved to another directory keeps being
found.

The search covers three places, in this order:

1. the directory of the file that writes `uses`;
2. every directory above it — as long as the directory holds at least one
   `.flang` file;
3. the library shipped with the compiler.

The search does not go into subdirectories. For a module elsewhere, list its
directory in `FLANG_MODULE_DIR` (directories separated by colons), or name the
file directly with `uses «Module» from "path"`. The path is relative to the
importing file, and it works for a package too: `from "name.flang-package"`.

If two modules with the same name are found, the check fails and lists both
paths; the compiler never picks one silently.

Limit: module names are not translated. The standard list module is called
`«Lists»` (first line of `flang/stdlib/lists.flang`), and a file written in
Russian keywords imports it under that name too. `uses «Списки»` fails with
`FLANG_IMPORT_NOT_FOUND`.

## Function

The parts go in a fixed order. The body comes last and is one expression.

| Part | Required | What it means |
| --- | --- | --- |
| `total` | no | the function always terminates; the compiler proves it |
| `function «Name»` | yes | the declaration |
| `accepts name: type, name: type` | no | parameters; types are required |
| `returns type` | yes | the result type |
| `requires «name» condition` | no | precondition; the **caller** must make it true |
| `decreases expression` | no | a termination measure: a number that goes down on every recursive call |
| `for all p ensures «name» condition` | no | postcondition about `result` |
| `example «name»` / `given` / `expected` | no | a unit test: arguments and the expected result |

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

A call is `«Name» of argument and argument`. The word `and` separates
arguments; logical AND is written `and also`, so the two never clash.

Limits:

- in generated code `requires` is checked only at the boundary of the program,
  where a value comes from outside. Internal calls do not pay for the check;
- `ensures` must have a name: the `flang check --proof` report shows the result
  under that name, and a theorem refers to it by that name;
- examples run on **every** check. A failing example is the error
  `FLANG_EXAMPLE`, and the compiler does not generate code for the program.

## Totality and measures

The compiler proves termination of a `total` function in one of five ways. The
first three cost nothing at run time; the last two add a check to the generated
code. Which way was used for which function is in the `flang check --proof`
report; the counts across the repository are on [Why and how](proofs.html).

| Way | When it applies |
| --- | --- |
| by composition | no recursion at all |
| by structure | `match` recurses on a part of the value |
| by exact step | a `nat` parameter descending by a constant |
| by constant step | the same on `number`, with a run-time check |
| by declared measure | `decreases`, with a run-time check |

`decreases` goes between `returns` and the body and must be a number. Write it
when the recursion goes down by arithmetic, not by taking a part of the value:

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

Limit: the measure must be a non-negative integer, and this is checked on every
call. `«GCD»` of integers always works; `«GCD»` of two fractions stops with
`FLANG_MEASURE`, because a chain of fractional remainders can go down forever.

## The body: four forms

`match`, `fold`, `if` and `let`. There are no loops.

### `match` — pattern matching over an enum

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

A type with variants is an enum with data (a tagged union). Patterns:
`case Name` — a variant without fields; `case variant Name with field as name` —
a variant with its fields bound to names; `case empty` and `case head and tail`
— a list or a string; `case any` — everything else.

What the compiler checks: every variant is handled; a missing variant is the
error `FLANG_MATCH_NOT_EXHAUSTIVE`. Recursion on a part of the value is proved
to terminate without a measure. Induction in a theorem works **only** over this
form.

### `fold` — reduce: one pass over a list

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

Termination is free: the list is finite and the pass is one.

Limit: the accumulator type is not refined. A `nat` in the accumulator stays
`number`.

### `if` — if as an expression

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

Limits: both branches are required, and the condition must be a boolean. The
condition narrows **numeric bounds** inside its branch, but the prover does not
use it as a fact. This postcondition is not proved: `check --proof` says
«объявлено, не доказано» (declared, not proved) and exits 3:

```flang
модуль «Если»

тотальная функция «Положительное»
  принимает н: число
  возвращает число
  для всех н обеспечивает «больше нуля» результат больше 0
  если н больше 0
    то н
    иначе 1
```

To branch on the kind of a value, use `match`; why, and how it differs for
proofs, is on [Which construct to use when](which-construct.html).

### `let` — a constant

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

Limit: `let` binds once. It is not a variable; there is no reassignment. The
name is one word or is written in guillemets: `let net amount equals …` does not
parse — write a multi-word name as `let «net amount» equals …`.

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

Why declare an exact type: the prover gets bounds and integrality from it, and
the termination check gets a lower and an upper bound. `number` gives nothing.

Limit: `divided by` leaves the exact type — the result becomes `number`. There is
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
| everything else, and any division | `number` | IEEE-754 double, no guarantees |

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

Limit: **arithmetic does not keep the exact type.** Add two `nat` values,
declare the return as `nat`, and the check fails:

```
FLANG_TYPE в файле nats.flang, строка 6, столбец 5: функция «Sum of nats» объявлена как неотрицательное, а тело даёт число
```

Put exact types on **parameters and record fields**: that is where the prover
and the termination check use them. Declare the return as `number` when the
body does arithmetic.

### List

`list Type` — homogeneous. The literal is `[1, 2, 3]`, the empty one is
`empty list`. It is covariant: `list nat` fits where `list number` is expected.

`list of` is the same thing in other words: `list of number` in type position
and `list of 1 and 2 and 3` in value position.

### Record (struct)

```flang
object «Line»
  title is string
  price is number
  discount may be number
```

A field is written `name is type` or `«name»: type`. `may be` means the field
can be absent. A record is built with `record «Line» with title equal to "bolt"
and price equal to 30` and read with a dot: `entry.price`.

Limit: record types are invariant. A field cannot be changed: values are
immutable, so you build a new record.

### Type with variants (enum)

```flang
type «Answer»
  variant Ok contains value: number
  variant Failed contains reason: string
```

Built with `variant Ok with value equal to 30`, taken apart with `match`.

Use it for Optional and Result: "found" and "not found" are different
variants, and the caller has to match on them. `null` is not used for this.

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

### Alias and generic types

```flang
тип «Invoice» это list «Line»

type «Maybe» of «A»
  variant «Some» contains value: «A»
  variant «None»
```

Type parameters (generics) are introduced with `of` and applied with the same
word. At a call site they are inferred from the values; there is no syntax to
write them.

Limit: the alias word `это` has no English spelling. In a file written with
English keywords it is written with the Russian word, as above.

### Function types

`function from number and string to boolean` is the worded form; `number →
number` is the arrow form. Both give one type.

Limit: in English keywords the worded form `function from number to number`
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

Limit: the comparisons are `is at least` and `is at most`. Other phrasings by
analogy do not work — `not less than` is not a keyword. Take the spelling from
the [glossary](../glossary.html).

### A string over several lines

A `"…"` literal survives a line break: the value continues on the next line, and
the line break is part of it as written. Single quotes `'…'` are the same
literal. These two spellings give the same string:

```flang
module «Two spellings»

total function «Through a line break»
  returns string
  example «the same as with \n»
    expected "first\nsecond"
  "first
second"

total function «In single quotes»
  returns string
  example «the same quotes, only different»
    expected "text"
  'text'
```

Edge: the indentation of a continuation line is part of the value, character
for character. `"first⏎    second"` equals `"first\n    second"`, so a text
inside a function body would have to start at the first column. For a text over
several lines inside an indented body there is the text block.

### The text block `"""` — from 0.7.24

Three double quotes open a block; the text starts on the next line; the common
indentation is removed:

```flang
total function «Help»
  returns string
  """
  Commands:
    .help   this text
    .quit   leave
  """
```

The value is `"Commands:\n  .help   this text\n  .quit   leave\n"`. The token is
the one a literal with `\n` gives: the block is a spelling, not a new kind of
string.

| Rule | What it means |
| --- | --- |
| nothing after the opening `"""` on its line | the text starts on the next line; another character there is a `FLANG_LEX` refusal at its position |
| the first unescaped `"""` closes | the rest of that line is read as usual |
| common indentation | the smallest indentation among the non-blank lines and the line of the closing quotes; a tab counts as one character, like a space |
| every line loses the common indentation | a line of only spaces and tabs becomes empty; trailing spaces stay |
| closing quotes on their own line | the text ends with a line break; on the last text line — it does not |
| escapes are those of `"…"` | `\n`, `\t`, `\"`, `\\`, `\uXXXX`; the quotes `"` and `'` inside are written as they are |

```flang
total function «Without a trailing line break»
  returns string
  example «closing quotes on the last text line»
    expected "first\nsecond"
  """
  first
  second"""

total function «With indentation inside»
  returns string
  example «closing quotes left of the text set the common indentation»
    expected "  first\n"
  """
    first
  """
```

Edges: an unclosed block is a `FLANG_LEX` refusal at the opening quotes; a bad
`\uXXXX` inside the block is a refusal at the line and column of the backslash
itself. There is no interpolation. The decision with every case:
[ADR-0052](../adr/0052-a-text-block-literal-strips-its-common-indentation.md)
(in Russian).

## Built-in forms over lists and strings

| Form | What it does |
| --- | --- |
| `length X` | the length of a list or a string |
| `head X`, `tail X`, `empty` | parts of a list and of a string |
| `item N in X` | the N-th element of a list |
| `char N in X` | the N-th character of a string |
| `add X to Y`, `prepend X to Y` | at the end and at the front of a list |
| `map X as name → body` | map: a new list |
| `filter X where name → condition` | filter: the items that fit |
| `substring X from A to B` | a slice of a string |
| `split X by Y` | string → list of strings |
| `join X by Y` | list of strings → string |
| `join X with Y` | concatenating two strings |
| `contains`, `begins with` | checks over a string |
| `to number`, `to number or failure`, `to text` | conversions |
| `character code X`, `decompose X into characters` | character by character |
| `character by code N` | code point as a number → a one-character string; fails on fractions, outside [0, 1114111], and on a lone surrogate |

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

Each form has its own fixed prepositions:

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

Limit: indexes start at one, and ranges include both ends. An index outside the
list stops the computation with an error. Everything else is a library
function; which one solves which task is on [Operations](operations.html).

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

**Instead of closures: partial application by name.** `function «Add» with a
equal to 10` gives a function of one argument. Captured parameters must come in
the order they are declared. There are no lambdas as values: only a declared
function can be a value. The built-in `map`, `filter` and `fold` accept a body in
place (`x → x plus 1`), but that body is part of the form, not a value, and
cannot be passed anywhere.

Limit: you can apply only a function that the program somewhere takes with
`function «Name»`. A function value that comes from outside and is not taken
anywhere in the program is rejected with `FLANG_APPLY`. There is no separate
compilation: function values are resolved over the whole program at once.

## Contracts and proofs

These words say more about a function than its type does. Each is checked in its
own way.

| Word | Where it goes | Who must make it true | What checks it |
| --- | --- | --- | --- |
| `requires «name» condition` | after `returns`, before the body | **the caller** | a run-time check at the boundary of the program |
| `for all p ensures «name» condition` | the same place, after `requires` | the function | the prover at check time; if not proved, a run-time check on every return |
| `total` | before the word `function` | the compiler | at check time; see [Totality and measures](#totality-and-measures) |
| `theorem «name»` | top level, next to the function | you | the prover at check time, step by step |
| `утверждение «name»` | top level, with NO function | you | the prover at check time; included in `--proof --json` |

### `requires` — a precondition

`requires «name» condition` — what must hold for a call to be valid.

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

Inside the function the condition is an **assumption**: a theorem can use it
with `by hypothesis`, even without induction.

Limit: the run-time check is generated only at the boundary of the program,
where a value comes from outside. Internal calls do not pay for it.

### `ensures` — a postcondition

`for all p ensures «name» condition` — what holds for `result` on every input.
`result` in the condition is the returned value.

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

The prover first tries to **prove** the condition. If it is proved, the
generated code has no check. If not, the condition is checked on every return,
and a violation stops the computation. `flang check --proof` shows what is
proved and what is not.

Limit: the name is required — `ensures` without a name does not parse. A theorem
refers to the postcondition by that name, and so does `by property` in another
proof.

### `для всех … из …:` — a property of every element of a list

To say something about every element of a list, write the quantifier in the
postcondition itself. A colon separates its body.

```flang
модуль «Все элементы после отбора»

тотальная функция «Только положительные»
  принимает элементы: список числа
  возвращает список числа
  обеспечивает «все положительны» для всех п из результат: п больше 0
  пример «Смесь»
    дано элементы равно [3, 0, 5]
    ожидается [3, 5]
  отфильтровать элементы где э → э больше 0
```

The prover proves such a postcondition from the SHAPE of the list the body
builds, not by running it. It accepts four shapes: the empty list;
`отфильтровать Л где х → У`, where `У` is the property being proved;
`добавить Х к Л` and `приписать Х к Л`, where the property holds of `Х` and of
`Л`; and `если У то А иначе Б`, where it holds in both branches. A list written
out element by element, `отобразить` (map) and a call to another function are
not accepted — the prover has no rule for them.

The body after the colon is a condition again, so quantifiers nest:

```flang
  обеспечивает «каждый с каждым положителен» для всех х из результат: для всех м из результат: м больше 0
```

For "there exists", name the value yourself:
`есть такой м, а именно х, что …`. The prover does not search for it.

Limit: the first top-level colon ends the quantifier, and everything to the
right of it is the body. The quantifier inside the condition and the variable in
`для всех н обеспечивает …` are different things, and the prover keeps them
apart.

### `theorem`

Write a theorem when the prover could not prove a postcondition on its own.

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
| `theorem «name»` | the same name as the postcondition it proves |
| `given name: type` | the variables |
| `claim condition` | what is being proved |
| `induction on name decreases measure` | proof by induction; `decreases` is needed only when a number goes down, not a part of a value |
| `case …` / `then justification` | one step |
| `next claim by justification` | an intermediate fact; later steps can use it |
| `therefore proved` | the end |

A theorem does not need induction; a short one is a single justification:

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

Limit: often no theorem is needed — write the postcondition first and see
whether the prover proves it on its own. Induction works over a `match` on a
type with variants, including your own type (see below), and over a number that
goes down.

### `утверждение` — a property outside a function

A property can stand on its own, without a function.

```flang
модуль «Свободные утверждения»

утверждение «длина пустого списка нулевая»
  утверждаем (длина пустой список) равен 0

утверждение «ноль нейтрален при сложении»
  для всех н: неотрицательное таких что н больше 0
  утверждаем (н плюс 0) равен н
```

The prover checks it exactly like a postcondition, and it appears in
`flang check --proof --json`. The line `для всех имя: тип таких что условие`
gives the variables and an assumption. The assumption matters here:
`неотрицательное` admits minus zero at run time, and without `н больше 0` the
second property is false.

A property can also be proved by a theorem with the same name, written next to
it.

### Induction over a type you declared yourself

`индукция по` (induction on) works for your own types with variants as well as
for the built-in ones: the induction principle comes from the type declaration.

```flang
модуль «Своё натуральное»

тип «Нат»
  вариант «Ноль»
  вариант «Следующий» содержит пред: «Нат»

тотальная функция «К числу»
  принимает н: «Нат»
  возвращает число
  разбор н
    случай вариант «Ноль»
      то 0
    случай вариант «Следующий» с пред как п
      то («К числу» от п) плюс 1

утверждение «шаг растит счёт на один»
  для всех н: «Нат»
  утверждаем («К числу» от (вариант «Следующий» с пред равным н)) равно ((«К числу» от н) плюс 1)

теорема «шаг растит счёт на один»
  дано н: «Нат»
  утверждаем («К числу» от (вариант «Следующий» с пред равным н)) равно ((«К числу» от н) плюс 1)
  индукция по н
    случай вариант «Следующий» с пред как п
      то по предположению
  следовательно доказано
```

The report says «доказано индукцией по «Нат»» (proved by induction on «Нат»).
No `убывает` is needed: what goes down is a part of the value, not a number.

### Justifications for a step

Every step needs a justification, or it does not parse. There are four.

| Justification | Use it when |
| --- | --- |
| `by property «name»` | the step contains a **call** to a function that has a postcondition with that name |
| `by hypothesis` | there is an assumption: the induction hypothesis (`induction on`) or the function's precondition (`requires`) |
| `by example «name»` | the case has **one** value (a pattern with no bound names), and the function has an example with that name |
| `under law «name»` | the name is a monoid, monad or isomorphism declared in this module, or one of the inference rules the prover checks (see [A step that names its rule](#a-step-that-names-its-rule)) |

### `by property`

Uses the postcondition of **another** function. The prover finds the calls to
that function in the step and substitutes its postcondition: parameters become
the arguments of the call, `result` becomes the call itself.

The example is the theorem "through doubling the length is the same" above.
Referring to the postcondition you are proving is circular, and the check fails:

```
FLANG_PROOF_STEP в файле circle.flang, строка 12, столбец 3: шаг 1, теорема «длина сохраняется»: «по свойству «длина сохраняется»» ссылается на то самое постусловие, которое сейчас доказывается — это круг. Часть значения обосновывает «по предположению», а не ссылка на саму цель. к этому месту не известно ничего, кроме гипотез «дано»
```

Limit: some function of the module must have a postcondition with that name;
otherwise the check fails and says there is nothing to refer to.

### `by hypothesis`

Uses an assumption. There are two kinds: the induction hypothesis (the same
property for a smaller part of the value) and the function's precondition (the
`requires` line). The "Sum up to" theorem above uses the induction hypothesis.

Without either, the check fails and says what is missing:

```
FLANG_PROOF_INDUCTION_STEP в файле hyp.flang, строка 12, столбец 3: шаг 1, теорема «половина неотрицательна»: «по предположению» стоит вне индукции, а допущений у этой цели нет ни одного: ни посылки индукции (её даёт `индукция по`), ни предусловия функции (его даёт `требует`). Предполагать не о чем. к этому месту не известно ничего, кроме гипотез «дано»
```

Limit: a hypothesis has no name. There is one per case, and you cannot use the
hypothesis of another case.

### `by example`

Proves a case by running an example. An example is **one** value, so it proves
only a case with one value: `case 0`, `case Leaf`, `case empty` — a pattern
**with no bound names**.

`case variant Node with left as l` covers infinitely many values, and one
example does not prove it. Use `by hypothesis` there.

Limit: the example is looked up by name on the function whose postcondition is
being proved. If there is no example with that name, the check fails and names
both.

### `under law`

Refers to a monoid, monad or isomorphism declared in the module, or to an
inference rule by name. Any other name is rejected — otherwise
`under law «what never happens»` would prove anything:

```
FLANG_PROOF_STEP в файле law.flang, строка 12, столбец 3: теорема «то же»: шаг 1 (чего не бывает, без основания): правило «чего не бывает» ведомости ядро пока не проверяет; проверяет шесть: Н1, Н3, Н5, О1, О10, Разв2
```

The message says: the prover does not check a rule called «чего не бывает»; it
checks six rules, Н1, Н3, Н5, О1, О10 and Разв2.

### A step that names its rule

A step can name the inference rule it uses and the facts it rests on. The prover
then checks that rule application instead of searching for a proof itself.

```flang
теорема «результат не больше десяти»
  дано а: число
  дано б: число
  утверждаем результат не больше 10
  затем а не больше б по закону «О1» из строки 5
  затем б не больше 10 по закону «О1» из строки 6
  затем а не больше 10 по закону «О10» из 1 и 2
  по закону «Разв2» из 3 и строки 9
  следовательно доказано
```

`из строки N` is the source line the fact comes from (a precondition, the body);
`из K` and `из K L` are the numbers of earlier steps of the same theorem. The
rule names are listed in `flang/proof/tables/inference-rules.tsv`.

Why name the rule: the independent proof checker (`flang/proof/checker/checker.c`)
re-checks a step that names its rule; a step without a name it has to take on the
prover's word.

Limit: the prover checks six rules — Н1, Н3, Н5, О1, О10, Разв2; any other name
is an error (see the output above).

How much is proved without a theorem, and by which rules: [Why and
how](proofs.html) and [Prover specification](../spec-proof.html) (in Russian).

## Categories: a pipeline declared as data

Objects, arrows (morphisms) between them and their composition, declared rather
than called.

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
| `law «name»` with examples | what the arrow guarantees, checked on example values |
| `«b» after «a»` | composition; the right one runs first |
| `chain` / `first` / `next` | the same composition in reading order |
| `identity «X»` | the identity arrow of an object |
| `category «C»` with a list of arrows | the interface: what the module can do |
| `isomorphism` / `forward morphism` / `inverse morphism` | a pair of arrows there and back |
| `functor` / `bifunctor` | a link between categories |
| `monoid` / `carrier` / `operation` / `identity` / `inverse element` | a structure with its own laws |

### What the compiler checks and what it does not

**Checked: the laws of a category, on a finite set of values.** If a category
declares its own equality (`объект «Х» даёт «Х равны»`), the compiler checks on a
finite set of values that the equality is an equivalence, that composition
respects it, and that composition is associative. The report gives the size of
the set («сетка», grid):

```
категория «Отгрузки»: сетка 5 значений на 3 объектах, троек стрелок 7, нарушений 0 — ПОСЧИТАНО НА СЕТКЕ, не доказано
```

It reads: 5 values on 3 objects, 7 triples of arrows, 0 violations — counted on
these values, not proved. A violation fails the check with exit code 1 and shows
the values that break the law, and no code is generated. The same holds for a
natural transformation: `FLANG_TRANSFORM_NOT_NATURAL` with both paths and their
values.

**Not checked: the shape of the declarations.** Closure under composition,
identities on objects, matching ends of composed arrows, the shape of a functor —
the binary compiler checks none of it. It says so in a separate line and exits
with code 2, so it never looks like a pass. In particular:

- a swapped composition order (`«отгрузить» после «выставить»`) gives **no**
  error, although the language contract describes `FLANG_COMPOSE_MISMATCH`;
- an arrow that does not match its function gives **no** error, although
  `FLANG_MORPHISM_SHAPE` is described;
- a functor square that does not commute gives **no** error: functors are not
  checked at all, and `FLANG_FUNCTOR_SQUARE` never fires.

So today **a category declaration documents intent and checks its laws on example
values; it does not check the shape.** With full runs: [The categorical
surface](categories.html).

Before you use it:

- an ordinary composition written as a function call is already checked by the
  type checker. Arrows are for pipelines that are **declared**, not called;
- the functor square and the arrow laws are **checked on a finite set of values**
  built from your examples; that is not a proof. The report prints the size of
  the set;
- a category is only a note to the reader until you list its arrows; nothing
  checks that an object belongs to it;
- a mapping without an implementation (`maps to` without `gives`) is not checked
  at all: it is recorded as taken on trust.

The full contract: [Categories and functors](../spec-cat.html) (in Russian).
Where "proved" ends and "checked" begins: [What is proved and what is
not](what-is-proved.html).

## Monads and `in monad`: chaining steps that may fail

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

The compiler expands the block into nested `match`es over the variants of the
type. You do not write the chain "if none, return none" at every step — the
same idea as `?` in Rust or `do` in Haskell.

Limits: `return` must be the last line of the block. The mapping (fmap) is not
declared — the compiler derives it from the type. The monad laws are checked on
a finite set of values, not proved.

## Processes and supervision

A process owns its state, like an actor in Erlang. The handler is an ordinary
total function: it takes the state and a message and returns the new state and a
list of actions. Sending a message is an action in that list, not a side effect.

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
| `with budget N` | the step limit for a handler that is not `total` |
| `with mailbox N` | the size of the mailbox |
| `supervision «S»` | a supervisor: what to do on failures, as data |
| `process «P» strategy «…»` | what to do on a failure |
| `failure threshold N within M … else «…»` | the window and the fallback strategy |
| `run «name»` / `seed` / `given` / `expected` | a test of a concurrent program: messages in, expected state out |
| `seed from N to M` | the same test over a range of message orderings |

Limit: the reply fields (`состояние`, `действия`) and the type `«Действие»` are
fixed names of the process model, and they are spelled in Russian in every file.
So are the strategy names (`перезапустить` restart, `остановить` stop,
`передать выше` escalate) and the normal stop reason `норма`.

The full model: [Processes and fault tolerance](../spec-conc.html) (in Russian).

## Words that do not appear in the examples above

The forms above are what programs are written with. The remaining keywords are
listed here so you know where they belong.

| Word | Where it belongs | Where it is described |
| --- | --- | --- |
| `embedding`, `intersection` | categories: a part of an object and the common part of two | [Categories and functors](../spec-cat.html) |
| `objects`, `morphisms` | bifunctor: a pair of objects and a pair of arrows | the same |
| `maps to`, `maps to field`, `maps to morphism` | the lines of a functor | the same |
| `property` | a law of a single operation: commutativity, monotonicity and three more | [Categories and functors](../spec-cat.html) |
| `plan` | side effects (file, network, processes): declared by the same three lines as a process | [Categories and functors](../spec-cat.html), section "Эффекты и HTTP" |
| `date`, `money` | older keywords: `date` behaves as `string`, `money` as `number` | [Glossary](../glossary.html) |
| `has` — the line `given «Object» has «field» equal to value` | an older theorem form; rejected next to proof steps | below |
| `utility`, `rule`, `nested object`, `in data`, `find where`, `by morphism` | older keywords: still parsed, but a program cannot be built from them | [Glossary](../glossary.html) |

The older theorem form cannot be mixed with the current one: the line
`given «Object» has «field»` next to `claim` is an error.

```
FLANG_PARSE в файле mix.flang, строка 12, столбец 1: теорема «цена та же» смешала две формы: дано «Объект» имеет «поле» — из старой, а рядом стоят слова доказательства. Выберите одну форму
```

`in data`, `by morphism` and `therefore «conclusion»` behave the same way.

## What the language does not have

| Habit | What to use instead |
| --- | --- |
| a loop | `fold` and recursion |
| changing an element in place | building a new value |
| an exception | a Result: a variant of a type that carries the reason |
| `null` for "not found" | an Optional: a type with variants and a mandatory `match` |
| a variable | `let`, which binds once |
| a lambda | a declared function, passed as `function «Name»` |
| a closure that captures a local variable | partial application by parameter name: `function «Name» with a equal to 10` |
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
