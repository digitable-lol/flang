# Ready wiki text for Rosetta Code (English)

Copy-paste material for the fifteen Rosetta Code **task pages** covered by this
directory. Fifteen pages, fourteen programs, twenty-eight files: `Roman
numerals/Encode` and `Roman numerals/Decode` are two pages served by one
program, and every program is written twice, once on each of the two keyword
surfaces shown here. Every block below is the prose that goes **above** the code
on the task page; the code goes inside
`<syntaxhighlight lang="text">…</syntaxhighlight>`.

The step-by-step publishing procedure — account, licence caveat, language page,
order of operations — is kept outside this repository, in the outreach
materials: `flang-outreach/rosetta-как-выложить.md` (Russian).

## How to produce the code block

The `.flang` files carry long Russian comment headers. They are the file's own
documentation and must **not** go on the wiki: the English prose below says the
same thing. Strip them:

```bash
grep -v '^[[:space:]]*//' flang/examples/rosetta/<file>.flang | cat -s
```

Checked, not assumed: all 28 files were stripped this way and re-run — 184
functions, 424 examples, all still pass, no parse or type errors. The stripping
is safe because none of the files has a trailing `//` comment on a code line.

## A paragraph to reuse on any page

Useful once per page, right under the `=={{header|flang}}==` line:

> flang splits programs into two classes and the compiler decides which is
> which: `тотальная функция` / `total function` is a function whose termination
> the compiler has established, and `функция` / `function` is everything else.
> Termination is established three ways: structural descent (a recursive call
> receives a part of an argument — the tail of a list, a field of a variant), a
> numeric parameter falling by a constant step toward a proven floor, or a
> measure the author declares with `убывает` / `decreases`. The first two are
> inferred; a declared measure is checked for shape before the run and enforced
> by a guard on every recursive step, which refuses with `FLANG_MEASURE` rather
> than looping. Keywords come in four equal surfaces — Russian, English,
> Esperanto and Chinese — of which two are shown here, which parse to the same
> AST. `пример` / `example` blocks are part of the source: they are type-checked
> and executed, not comments.

---

## FizzBuzz — `fizzbuzz.flang`, `fizzbuzz-english.flang`

> Two things are on display here. First, the split into proved and ordinary
> functions: 3 of the 5 functions are `total function` / `тотальная функция`,
> including classifying one number and mapping a list, but **counting from 1 to
> 100 is not**. Counting *up* is the one direction flang does not infer: the
> analysis infers structural descent and a fall by a constant step, and `n plus
> 1` is neither. It can be proved by declaring a measure (`убывает предел минус
> н` — "decreases limit minus n"), and this listing deliberately does not, so
> that the inferred boundary is what the reader sees. Second, there is no output: the
> language is pure, so "print" means "return a list of strings", and the
> `example` / `пример` blocks below check that list against the task.
>
> The second listing is the same program written with flang's English keyword
> surface. Both surfaces parse to the same AST; here that was verified by
> comparing the two ASTs with names and source positions stripped.

## Fibonacci sequence — `fibonacci.flang`

> 4 of the 6 functions here are proved terminating, Fibonacci itself included:
> recursing on `n minus 1` under a check that bounds `n` from below is a fall by
> a constant step, and that is inferred. What stays ordinary is the other
> direction — counting *up* to build the series. The two forms differ in which
> way the number moves, not in how clever the code is, and the compiler marks
> the difference instead of the author asserting it.

## Factorial — `factorial.flang`

> The smallest example of the constant-step rule: `n × (n−1)!` recurses on a
> number, and a number falling by a fixed step under a check that bounds it from
> below is exactly what the analysis infers, so the recursive factorial is
> proved — 3 of the 5 functions here are. The variant that builds `[1 … n]` and
> multiplies the list is the one that stays ordinary, because building that list
> counts *up*. The direct recursion is the provable one and the list detour is
> not, which is the opposite of what one expects.

## Towers of Hanoi — `towers-of-hanoi.flang`

> The usual formulation recurses on the *number* of disks, which flang cannot
> prove terminating. Represent the tower as a *list* of disks instead — head is
> the bottom, largest disk, tail is the stack on top of it — and the same
> recursion now walks the tail of a list, which the analysis does accept. So the
> solver is proved terminating with no extra parameter and no accounting: 3 of
> the 5 functions here are. What stays ordinary is the pair that turns a
> *number* of disks into a tower — the wrapper that builds `[n … 1]` and the
> entry point that calls it — because building that list counts up.
> This is the general move in flang: keep the structure rather than a counter.
>
> The same structure then carries a *proof about the answer*, not only about
> termination. `«Number of moves»` declares `ensures result is at least 0`, and
> the core discharges it by induction over the list: the empty tower gives 0,
> and a turn gives twice the tail plus one. `flang check … --proof` prints that
> the claim holds "about EVERY input of type list, not about the ones that were
> written down" — which is the line no example-based test can print.

## 100 doors — `hundred-doors.flang`

> The doors are simulated as the task asks — each door is toggled once per pass
> that divides its number — and the "only perfect squares stay open" shortcut is
> *not* used to produce the answer. It is used as a check: a separate function
> computes the open doors one way and the perfect squares another way and
> compares the two lists, and that comparison is itself an executed example. A
> claim about the task that would otherwise live in a comment is a program here.
>
> Note also that `равен` / `equals` works on scalars only; comparing two lists
> needs a function, and it is in the listing.
>
> One function here also carries a claim the machine checks: `«How many times
> touched»` declares `ensures result is at least 0`, and the core proves it
> straight from the body — the fold starts at zero and only adds — with no
> theorem written at all. That is the cheapest of the three outcomes flang
> distinguishes: proved by the core, checked on a grid, or stated and not proved.

## Roman numerals/Encode — `roman-numerals.flang`

> Every function in this module is proved terminating, encoder included, which
> is not automatic: encoding is normally written as a loop over the remaining
> value, and a loop over a number is exactly what flang will not prove. Here the
> encoder walks the four *digit positions* instead — no recursion at all — and
> the "repeat a symbol up to three times" step is a fold over the fixed list
> `[1, 2, 3]`, because Roman notation never repeats a symbol more than three
> times. The bound is what makes the proof possible.
>
> The module also contains the decoder and a round-trip function asserting that
> the two are inverse; see the Decode page.

## Roman numerals/Decode — `roman-numerals.flang`

> The decoder reads the numeral right to left, so that a digit smaller than the
> largest one seen so far is the subtractive case (IV, IX, XL). A fold cannot
> look ahead, but it does carry the maximum seen, which is why the direction is
> reversed. The whole thing is a fold over the list of characters produced by
> `разложить … на символы`, so termination is proved.
>
> Encoder and decoder live in one module on purpose. Separately each is checked
> by examples — a point at a time. Together they support a *statement*: writing
> and reading are inverse. That statement is the function `«Туда и обратно»`
> ("there and back"), and it is exercised at both ends of the 1–3999 range.

## Run-length encoding — `run-length-encoding.flang`

> The interesting part is the asymmetry. Encoding is proved terminating: it is a
> fold over the list of characters. Decoding must repeat a character as many
> times as the input says, and that count is an arbitrary number read from the
> data — so the repeat recurses on `n − 1` under a check that bounds `n` from
> below, which the constant-step rule proves. In this listing the two decoding
> functions are nevertheless left as ordinary functions, and 2 of the 5 are
> marked proved; the listing predates the constant-step rule and has not been
> re-marked. The identical function in the standard library
> (`«Повторить»` in `flang/stdlib/strings.flang`) *is* proved, and comparing the
> two is a fair thing for a reader to do.
>
> Compare with the Roman numerals solution, where the repeat is bounded by three
> and is a fold over a fixed list. That word `total` / `тотальная` does not mean
> "this code is good"; it means "the boundary has been named", and naming it
> wrongly in either direction is the failure mode worth watching for.

## Levenshtein distance — `levenshtein-distance.flang`

> Dynamic programming with no table. flang reads a list by index (`элемент N в
> СПИСОК` / `element N in LIST`, constant time on seven of the eight targets)
> but cannot *write* one: values are immutable, and replacing the N-th element
> has no form in the language. That is what puts the usual matrix out of reach —
> not reading a cell, updating one. Levenshtein does not need the whole
> matrix anyway, only the previous row, and a row is a list. Lists have tails, and
> tails are what the termination analysis accepts, so all seven functions here
> are proved terminating, including both passes: the outer one is a fold over
> the characters of the first string, the inner one recurses on the tail of the
> characters of the second.
>
> The price is stated in the source: each cell needs three neighbours, and
> "left" is carried as an argument while "above" and "diagonal" are the first
> two elements of the previous row. That forces an invariant — the previous row
> is exactly one longer than the remaining letters — which holds by construction
> and which the language cannot express. Strings are decomposed by code point,
> so the Cyrillic example counts correctly.

## Sequence of primes by trial division — `primes-by-trial-division.flang`

> The same algorithm is written twice, and the difference is the point.
>
> `«Просеять»` is written the way anyone would write it: recurse on the filtered
> remainder. The compiler answers `FLANG_NOT_TOTAL`, and it is literally right —
> a filtered list is a *constructed* value, not a part of the argument it was
> built from, and inferred descent works on parts. The list does get shorter,
> but nothing in the shape of the call says so.
>
> `«Просеять с топливом»` is the same algorithm with one extra parameter: fuel,
> a list whose tail is taken on every step. There are never more steps than
> there are numbers in the input, so the fuel suffices — and a tail is something
> the analysis accepts. Same computation, proved termination. The cost is
> visible: fuel means nothing to the problem and everything to the proof.
>
> This is deliberately *not* filed under Sieve of Eratosthenes. A genuine sieve
> crosses multiples out by stepping through an array; this one tests each
> survivor with a modulo, which is trial division — see Melissa E. O'Neill, "The
> Genuine Sieve of Eratosthenes", JFP 19(1):95–106, 2009. Rosetta Code marks
> such solutions `{{incorrect}}`, and rightly.

## Sorting algorithms/Quicksort — `quicksort.flang`

> Quicksort itself is **not** proved terminating here, and the reason is visible
> in the body: the recursive call receives the result of `отфильтровать`
> (filter), a newly built list, not a tail of its own argument. The descent is
> real but it is by length, and flang's analysis only knows descent by
> structure. Insertion sort sits in the same file for contrast: it recurses on a
> tail and is proved immediately.

## Sorting algorithms/Merge sort — `merge-sort.flang`

> All eight functions are proved terminating. Merging is proved directly — it
> recurses on the tails of both lists — and the splitting recursion is made
> provable by carrying "fuel": a list whose tail is consumed on every step, no
> longer than the input, so it cannot run out.

## Reverse a string — `reverse-string.flang`

> Proved terminating, and by code point rather than UTF-16 unit, so an emoji
> outside the BMP stays one element instead of splitting into a surrogate pair.
> The proof exists because of one built-in form, `разложить … на символы`: it
> turns a string into a list of one-character strings, and the walk becomes a
> fold over a list instead of a walk over an index. All four functions here are
> proved, and the proof costs no declaration: a fold over a list is inferred,
> whereas walking an index needs the author to declare a measure
> (`убывает` / `decreases`) for the same result.

## Palindrome detection — `palindrome.flang`

> Fourteen functions, all fourteen proved terminating: normalisation, comparison
> and the list version of the same problem. Same reason as above — the string is
> decomposed into a list first, so everything after that is a fold.
>
> `«Position of substring»` carries a proved claim: `ensures result is at least
> 0`. It says something real rather than decorative — the function returns 0 when
> the substring is absent, so "not found" is not encoded as minus one, and that
> is established about every input rather than checked on the examples.

## Ackermann function — `ackermann-function.flang`

> This is the honest one. The Ackermann function **always terminates** — the
> pair (m, n) decreases lexicographically, and that order is well-founded. flang
> does not do that reasoning: it infers descent in *one* argument at a time,
> structurally or by a constant step, and a lexicographic pair is neither. So the
> function is marked ordinary, and writing `total` / `тотальная` gives
> `FLANG_NOT_TOTAL` — checked by running it, and the message names every one of
> the three recursive calls and why each fails.
>
> Which is the thing worth taking away from the whole flang set: `total` / `тотальная`
> does **not** mean "terminates". It means "termination was proved *by this
> analysis*". The converse does not hold, and Ackermann is the standard witness.
> No analysis accepts exactly the terminating programs; every real one draws the
> line somewhere earlier. The only question is whether the line is stated.
>
> The fuel trick used elsewhere in this set does not help here: Ackermann's
> recursion depth grows faster than any primitive recursive function — A(4, 2)
> is a power of two with 19 729 decimal digits — so a list of the required
> length does not exist, and not for reasons of memory.
>
> The file also contains the closed form for the first three rows, which *is*
> proved terminating because it has no recursion at all, plus a function
> asserting that the two agree. Same values, different proof status; the
> difference is in how the computation is written, not in what it computes.

---

## What is deliberately absent, and why

Worth saying once on the language page rather than repeating per task.

- **Tasks needing a table indexed by position** (a genuine sieve, tabular
  dynamic programming, a hash table). Reading a list by index is a built-in
  form; *writing* one is not, because values are immutable, so anything that
  updates a cell in place has no expression here. Dictionaries and sets do
  exist — a list of pairs with linear lookup, a search tree with O(log n)
  lookup and insert, and a set of strings — so grouping and counting are not
  the obstacle they used to be.
- **Ordering comparisons on strings** are rejected outright:
  `FLANG_TYPE: сравнения порядка допустимы только для чисел`. Letters can still
  be ordered through their code points, which are numbers.
- **Tasks needing input from the user.** flang has I/O as of 2026-08-07, but it
  is *described*, not performed: a function builds a value describing an action
  and a host executes it. There is no "read from stdin" order in the closed set.
- **Tasks needing functions as values** (sort with a supplied comparator, fold
  with a supplied operation, combinators). The *language* has first-class
  functions and emits them to all eight targets by defunctionalisation; the
  *repository* may not use them until the self-hosted parser understands the
  form.
- **Tasks about infinite sequences.** There is no laziness, and a finite
  approximation is a different task.
- **A genuine Sieve of Eratosthenes.** It needs indexed writes into an array.
