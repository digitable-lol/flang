# A case taken apart: 82 leetcode tasks

`flang/examples/leetcode/` — 82 files, 7 609 lines. Not an example written for
this page but code in the tree: one command runs it.

## Run it yourself

```bash
flang test flang/examples/leetcode
```

```
корпус «flang/examples/leetcode»: файлов 82, взято 82, отказано 0, примеров 804
(своих 804), на чужих примерах 0, потеряно своих 0, прошло 804, не прошло 0,
за 11956 мс
```

Exit code 0. Twelve seconds for 82 tasks.

## What is counted here

| | |
| --- | --- |
| functions | 300 |
| of those total | 298 |
| ordinary | 2 |
| executable examples | 804 |
| postconditions (`обеспечивает`) | 2 |

## What is proved

298 functions out of 300 carry proved termination. This is not "the examples
passed": the compiler would refuse to build the file if it could not show that
the recursion bottoms out. For tasks like "search in a rotated sorted array" or
"trapping rain water" the infinite loop is closed before the program runs.

The two ordinary functions are named: `«Шаг счастья»` and `«Счастливое»` from
task 202. They do terminate — the sequence of digit-square sums falls into a
cycle — but structural descent cannot show it, so the file honestly writes
`функция` rather than `тотальная функция`.

## What is not proved

Across all 82 tasks there are two postconditions, both in task 13, roman
numerals to integer:

```flang
  обеспечивает «значение цифры неотрицательно» результат не меньше 0
  обеспечивает «значение цифры не больше тысячи» результат не больше 1000
```

So for 298 functions it is proved that they **stop**, and for almost none of
them that they compute **the right thing**. Correctness here is carried by 804
examples, and an example is a claim about one input.

The gap between "proved" and "correct" is the specification. You can write one:
`обеспечивает` is accepted on any function, and the kernel will try to prove it.
How that is done — [Requirements that are proved](fspec.html).

## Next

- [What is proved and what is not](what-is-proved.html) — where the line runs.
- [Why and how](proofs.html) — how the proof kernel works.
