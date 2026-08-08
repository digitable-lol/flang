# Ready wiki text for Rosetta Code (English)

Copy-paste material for the fifteen solutions in this directory. Every block
below is the prose that goes **above** the code on the task page; the code goes
inside `<syntaxhighlight lang="text">…</syntaxhighlight>`.

The step-by-step publishing procedure — account, licence caveat, language page,
order of operations — is in `docs/public/rosetta-как-выложить.md` (Russian).

## How to produce the code block

The `.flang` files carry long Russian comment headers. They are the file's own
documentation and must **not** go on the wiki: the English prose below says the
same thing. Strip them:

```bash
grep -v '^[[:space:]]*//' flang/examples/rosetta/<file>.flang | cat -s
```

Checked, not assumed: all fifteen files were stripped this way and re-run —
222 examples, all still pass, no parse or type errors. The stripping is safe
because none of the files has a trailing `//` comment on a code line.

## A paragraph to reuse on any page

Useful once per page, right under the `=={{header|flang}}==` line:

> flang splits programs into two classes and the compiler decides which is
> which: `тотальная функция` / `total function` is a function whose termination
> the compiler has *proved* by structural descent, and `функция` / `function` is
> everything else. Keywords come in two equal surfaces, Russian and English,
> which parse to the same AST. `пример` / `example` blocks are part of the
> source: they are type-checked and executed, not comments.

---

## FizzBuzz — `fizzbuzz.flang`, `fizzbuzz-english.flang`

> Two things are on display here. First, the split into proved and ordinary
> functions: classifying one number and mapping a list are both `total function` / `тотальная функция`
> (proved terminating), but **counting from 1 to 100 is not** — flang's
> termination analysis accepts only structural descent (the tail of a list, a
> field of a record or variant), and `n plus 1` is arithmetic, not a part of a
> value. So the loop costs exactly one unproved function, and the compiler says
> so instead of the author claiming otherwise. Second, there is no output: the
> language is pure, so "print" means "return a list of strings", and the
> `example` / `пример` blocks below check that list against the task.
>
> The second listing is the same program written with flang's English keyword
> surface. Both surfaces parse to the same AST; here that was verified by
> comparing the two ASTs with names and source positions stripped.

## Fibonacci sequence — `fibonacci.flang`

> Both the iterative and the series form run into the same wall: they count. In
> flang a recursive call has to receive a structurally smaller argument, and a
> decremented number is not one, so 2 of the 6 functions here are proved
> terminating and the rest are honestly marked as ordinary. Nothing about the
> code is wrong — the compiler simply refuses to claim more than it can show.

## Factorial — `factorial.flang`

> The same boundary as FizzBuzz, on the smallest possible example: `n × (n−1)!`
> recurses on a number, and numbers have no structural parts, so factorial is an
> ordinary function. The list-based helpers around it are proved.

## Towers of Hanoi — `towers-of-hanoi.flang`

> The usual formulation recurses on the *number* of disks, which flang cannot
> prove terminating. Represent the tower as a *list* of disks instead — head is
> the bottom, largest disk, tail is the stack on top of it — and the same
> recursion now walks the tail of a list, which the analysis does accept. So the
> solver is proved terminating with no extra parameter and no accounting; only
> the convenience wrapper that builds `[n … 1]` from a number stays ordinary.
> This is the general move in flang: keep the structure rather than a counter.

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
> fold over the list of characters. Decoding is **not**, and not for lack of
> effort — decoding must repeat a character as many times as the input says, and
> that count is an arbitrary number read from the data. Repeating n times means
> recursing on `n − 1`, which flang does not accept.
>
> Compare with the Roman numerals solution, where both directions are proved: the
> repeat there is bounded by three, so a fold over a fixed list does the job.
> The difference between the two files is not skill or luck, it is whether the
> repetition has a bound known in advance. That is what the word `total` / `тотальная`
> actually means: not "this code is good" but "the boundary has been named".

## Levenshtein distance — `levenshtein-distance.flang`

> Dynamic programming with no table. flang has no array with indexed access, so
> the usual matrix is out of reach — but Levenshtein does not need the whole
> matrix, only the previous row, and a row is a list. Lists have tails, and
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
> a filtered list is a *constructed* value, and about constructed values the
> analysis knows nothing. The list does get shorter, but that is descent by
> *measure*, and the analysis only knows descent by *structure*.
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
> fold over a list instead of a walk over an index. Walking an index decreases a
> *number*, which the analysis rejects.

## Palindrome detection — `palindrome.flang`

> Fourteen functions, all fourteen proved terminating: normalisation, comparison
> and the list version of the same problem. Same reason as above — the string is
> decomposed into a list first, so everything after that is a fold.

## Ackermann function — `ackermann-function.flang`

> This is the honest one. The Ackermann function **always terminates** — the
> pair (m, n) decreases lexicographically, and that order is well-founded. flang
> does not do that reasoning: its analysis knows exactly one argument, "this is a
> structural part of that", and numbers have no parts. So the function is marked
> ordinary, and writing `total` / `тотальная` gives `FLANG_NOT_TOTAL`.
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

- **Tasks needing a dictionary or a set** (`Anagrams`, `Letter frequency`).
  flang has neither, so grouping is quadratic; and letters cannot be sorted
  directly, because ordering comparisons are rejected for strings —
  `FLANG_TYPE: сравнения порядка допустимы только для чисел`. A letter-to-number
  table would work but would stop being a solution to that task.
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
