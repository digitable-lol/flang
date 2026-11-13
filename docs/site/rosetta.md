# Rosetta Code in flang

`docs/examples/rosetta/` holds solutions to 14 Rosetta Code tasks. This page shows
which solutions have their termination proved, which do not, and why.

The set holds <!-- СНЯТО 2026-09-08 файлов docs/examples/rosetta/*.flang = 28 --> 28 files,
two per task: one is written in the Russian words of the language, the other in
the English ones (`*-english.flang`). They are the same program: the language has
four equal spellings, and `тотальная функция` and `total function` are one
keyword ([Four writing surfaces](../surfaces.html), in Russian). All four
spellings of one task are in `docs/examples/surfaces/`.

The text for the Rosetta Code wiki pages is `docs/examples/rosetta/WIKI.en.md`.

## How to run it

```bash
flang test docs/examples/rosetta/
flang check docs/examples/rosetta/towers-of-hanoi.flang --proof
```

`test` runs the examples written inside the functions, over every file of the
set (28 files, 422 examples, 422 passed):

```
корпус «docs/examples/rosetta/»: файлов 28, взято 28, отказано 0, примеров 422 (своих 422), на чужих примерах 0, потеряно своих 0, прошло 422, не прошло 0, за … мс
```

`check --proof` prints the proof report of one file: what proves the termination
of each function, and what proves each `обеспечивает` (ensures) claim. The
Towers of Hanoi has one claim:

```
что высказано и чем это несётся:
  постусловие «ходов не бывает отрицательно» функции «Число ходов» — доказано индукцией по «список»: база 1 случай, шаг при допущении на частях (1 случай), правила сведения: неотрицательность по построению — утверждение обо ВСЕХ входах типа «список», а не о написанных
```

The words of the report are not interchangeable: «доказано» (proved) is true on
all inputs; «сетка N» (grid N) is computed on N of the author's examples and is
not a proof; «объявлено, не доказано» (stated, not proved) has no proof.

## What is proved

`check --proof` over all 28 files: there are 54 `обеспечивает` claims, they
stand in 20 files, and all 54 are proved. No report has a «сетка» line or an
«объявлено, не доказано» line.

Not proved:

- termination of the functions in the "not total" column of the table below —
  it is not promised either;
- that the Russian and the English file of a task are one program. Each is
  checked separately.

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
| Quicksort | `quicksort.flang` | «Быстрая сортировка» | recursion on filtered sublists: the sublist is smaller than the original but is not a part of it; «Сортировка вставками» next to it is total |
| Reverse a string | `reverse-string.flang` | — | all total; the reversal goes by code points — the example holds the string `"а🙂"` |
| Roman numerals | `roman-numerals.flang` | — | all total; claims about «Значение цифры»: at least 0, at most 1000, and one per numeral |
| Run-length encoding | `run-length-encoding.flang` | — | all total; «Туда и обратно» — encoding and decoding are inverse to each other |
| Towers of Hanoi | `towers-of-hanoi.flang` | — | all total; the non-negativity of «Число ходов» is proved by induction on the structure of the list |

The "not total" column is `grep '^функция ' docs/examples/rosetta/<file>`. What
proves each total function is printed by `flang check docs/examples/rosetta/<file> --proof`.

## Why some solutions are not total

The functions of this set are written without an `убывает …` (decreases) line,
and the compiler derives termination itself — from the shape of the recursion.
Three shapes it does not take:

- **Counting upwards.** «Числа от и до» grows the start until it overtakes the
  end. The end is a parameter, not a constant, and the compiler does not derive
  such a descent itself. The function stands in five files of the set and is
  total in none.
- **Recursion on a sublist rather than a tail.** In quicksort the filtered sublist
  is shorter than the original but is not a part of it.
- **Two arguments, neither decreasing on its own.** The Ackermann function.

The first two shapes are accepted if the author names the measure. «Числа от и
до» with the line `убывает конец минус начало плюс 1` (decreases: end minus
start plus 1) passes as `тотальная`, and the report answers:

```
«Числа от и до»  доказано объявленной мерой: убывает «конец» минус «начало» плюс 1; спуск ядром не выведен — на веру: мера объявлена автором, сторож считает её при работе на каждом витке — 1 место
```

The measure is then not proved; it is checked while the program runs. A sort
with a declared measure is taken apart on the page [Leetcode tasks](case-studies.html).
All the ways are on the page [What the mark «тотальная» gives](totality.html).

A run-time check also stands in functions proved by a constant step. The report
says why: «на IEEE-754 шаг не всегда меняет число, поэтому сторож» ("on IEEE-754
a step does not always change the number, hence the guard"). A step that did not
decrease gives the refusal `FLANG_MEASURE` rather than an endless loop.

## What the set does not have

- **Tasks with input and output.** The language has I/O (`docs/examples/io/`), but
  the tasks here were picked for the algorithm.
- **Tasks that need strings ordered** (Anagrams, Letter frequency). `меньше` and
  `больше` on strings are refused by the type check —
  `FLANG_TYPE: … сравнения порядка допустимы только для чисел`. The letters of a word cannot be sorted
  without a "letter → number" table, and with it the solution stops being a
  solution of this task.
- **Tasks about infinite sequences.** There is no laziness; a finite approximation
  is a different task.
- **A real sieve of Eratosthenes** — for the reason named in the table.

## Next

- [The catalogue of examples](examples.html) — every set in the `docs/examples/` directory
- [What the mark «тотальная» gives](totality.html) — the ways of proving termination
- [Leetcode tasks](case-studies.html) — three solutions with their proof reports
