# Rosetta Code in flang

`examples/rosetta/` — the canonical Rosetta Code tasks, solved in flang. It is a
showcase: here the language is compared with the same solution in other languages,
so what matters is not brevity but what is visible on reading — where termination
is proved, and where the language says it cannot prove it.

The set holds <!-- СНЯТО 2026-09-08 файлов examples/rosetta/*.flang = 28 --> 28 files,
two per task: each is written on the Russian surface of the language and on the
English one (`*-english.flang`). This is not a translation of documentation: the
language has four equal writing surfaces — Russian, English, Esperanto and
Chinese — and `тотальная функция` / `total function` are one and the same keyword
(the word table is `flang/self/lexer.flang`; the page is [Four writing
surfaces](../surfaces.html), in Russian). Two are taken here because on a Rosetta Code task page
the second listing is there for the reader: next to the Russian listing, the
English one shows that the Russian spelling is a choice, not a limitation. All four
surfaces on one task are in `examples/surfaces/`.

Ready text for the wiki pages is in `examples/rosetta/WIKI.en.md`. The publishing
procedure, the licence caveat and the language page are described outside this
repository.

## How to run it

```bash
bootstrap/flang test examples/rosetta/                                # the examples of every file in the set
bootstrap/flang check examples/rosetta/towers-of-hanoi.flang --proof  # the ledger of one file
```

`test` runs the examples declared inside the functions. `check --proof` prints the
ledger: what carries the promise «тотальная» for each function, and what carries
each stated claim. For the Towers of Hanoi it ends like this (run of 8 September
2026):

```
что высказано и чем это несётся:
  постусловие «ходов не бывает отрицательно» функции «Число ходов» — доказано индукцией по «список»: база 1 случай, шаг при допущении на частях (1 случай), правила сведения: неотрицательность по построению — утверждение обо ВСЕХ входах типа «список», а не о написанных
```

The words of the ledger are not interchangeable: «доказано» (proved) is a claim
about all inputs; «сетка N» (grid N) is computed on N values of the author's, and
that is not a proof; «объявлено, не доказано» (stated, not proved) is a claim with
no proof attached. On the run of 8 September 2026 every stated claim in every file
of the set stands in the ledger with the word «доказано»; there is no «сетка» line
and no «объявлено, не доказано» line in any of them.

Both files of each task are checked by the run separately. A check that the two
listings are one program up to renaming does not exist in the tree.

## The tasks

A function without the word `тотальная` is one about whose termination the
compiler has been told nothing: it does not check it and does not promise it. The
column "not total" lists such functions of the Russian file; in the English file
the same functions stand under English names.

| Rosetta Code task | File | Not total | What is visible in flang |
|---|---|---|---|
| Ackermann function | `ackermann-function.flang` | «Аккерман», «Записи совпадают» | the recursion on two arguments decreases neither by a part of the value nor by a constant step; the total «Аккерман замкнуто» computes the first three rows by closed formulas and answers zero outside them, saying so in an example |
| Factorial | `factorial.flang` | «Числа от и до», «Факториал произведением» | «Факториал» is proved by an exact step: the argument is declared natural and decreases by 1; «Числа от и до» counts upwards |
| Fibonacci sequence | `fibonacci.flang` | «Числа от и до», «Ряд Фибоначчи» | «Фибоначчи шагом» is proved by an exact step, its non-negativity by induction on the natural argument |
| FizzBuzz | `fizzbuzz.flang` | «Числа от и до», «Физз-базз» | three claims about «Слово для числа» — multiples of fifteen, three and five — are proved by reducing the goal against the body, with no theorem |
| 100 doors | `hundred-doors.flang` | «Числа от и до», «Открытые двери», «Квадраты до», «Двери и квадраты сходятся» | the non-negativity of «Сколько раз тронули» is proved without a theorem; everything that counts upwards is unproved |
| Levenshtein distance | `levenshtein-distance.flang` | — | all functions total; the rows of the matrix are lists («Нулевой ряд», «Новый ряд») |
| Merge sort | `merge-sort.flang` | — | all total; merging and sorting go "with fuel" — over a list that becomes a part of itself on every turn |
| Palindrome detection | `palindrome.flang` | — | all total: normalisation of case and punctuation, comparison; the claims about «Позиция подстроки» are proved; the same task is shown separately on a list |
| Sequence of primes by trial division | `primes-by-trial-division.flang` | «Просеять», «Числа от и до», «Простые до», «Простые до, с топливом» | only «Просеять с топливом» is total; a real sieve of Eratosthenes crosses out by writing at an index, and the language has no such write — so the file lies under the trial-division task |
| Quicksort | `quicksort.flang` | «Быстрая сортировка» | recursion on filtered sublists: the sublist is smaller than the original but is not a part of it — no proof; «Сортировка вставками» next to it is total |
| Reverse a string | `reverse-string.flang` | — | all total; the reversal goes by code points — the example holds the string `"а🙂"` |
| Roman numerals | `roman-numerals.flang` | — | all total; claims about «Значение цифры»: at least 0, at most 1000, and one per numeral |
| Run-length encoding | `run-length-encoding.flang` | — | all total; «Туда и обратно» — encoding and decoding are inverse to each other |
| Towers of Hanoi | `towers-of-hanoi.flang` | — | all total; the non-negativity of «Число ходов» is proved by induction on the structure of the list |

The "not total" column is taken from a file by
`grep '^функция ' examples/rosetta/<file>`; what proves each total one is printed
by `bootstrap/flang check examples/rosetta/<file> --proof`.

## Why some solutions are not total

This is a border the language draws deliberately, not unfinished work. The ways of
proving termination are laid out on the page [What the mark «тотальная»
gives](totality.html); here only what the set shows that border on is named.

- **Counting upwards.** «Числа от и до» grows the start, and the end is a
  parameter, not a number: it cannot serve as the bound, because it changes from
  call to call itself. The compiler does not reason "the start will overtake the
  end sooner or later". This function stands in five files of the set and is total
  in none.
- **Recursion on a sublist rather than a tail.** In quicksort the filtered sublist
  is smaller than the original but is not a part of it, and it is not a number at
  all. Neither structural descent nor a measure.
- **Two arguments, neither decreasing on its own.** The Ackermann function.

That a constant step has a footing outside the shape of the program, the ledger
says itself: «на IEEE-754 шаг не всегда меняет число, поэтому сторож» — into every
call proved by a step the compiler inserts a check of the decrease, and a step that
did not decrease gives the refusal `FLANG_MEASURE` rather than an endless loop.

## What the set does not have

- **Tasks with input and output.** The language has I/O orders (`examples/io/`),
  but the Rosetta Code tasks here are about the algorithm, not about the host.
- **Tasks that need strings ordered** (Anagrams, Letter frequency). `меньше` and
  `больше` on strings are refused by the type check —
  `FLANG_TYPE: … сравнения порядка допустимы только для чисел` (checked on
  8 September 2026 on a one-function file). The letters of a word cannot be sorted
  without a "letter → number" table, and with it the solution stops being a
  solution of this task.
- **Tasks about infinite sequences.** There is no laziness; a finite approximation
  is a different task.
- **A real sieve of Eratosthenes** — for the reason named in the table.

## Next

- [The catalogue of examples](examples.html) — every set in the `examples/` directory
- [What the mark «тотальная» gives](totality.html) — the ways of proving termination
- [A study of leetcode problems](case-studies.html) — five problems with their ledgers in full
