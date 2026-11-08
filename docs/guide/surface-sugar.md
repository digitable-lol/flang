[Back to README](../../README.md) · [Documentation index](../README.md)

# Loops: kept values and `дальше`

A `цикл` block lets a function walk a list or repeat a step while a condition
holds, keeping a few values between steps, the way a `for` or `while` loop does
in Python. The block is expanded into ordinary flang before `check` sees it: a
fold, or a new total function. No kernel rule is involved, so proofs, records
and checkers judge the expanded text as any other program. The decision is
[ADR-0206](../adr/0206-a-loop-with-kept-state-expands-to-a-fold-or-a-total-function.md).

```
bootstrap/flang run-script sugar:expand -- task.flang expanded.flang
bootstrap/flang check --proof expanded.flang
```

## The block

```
цикл «Сужение»
  пока лево меньше право
  убывает право минус лево плюс 1
  храним лево: число равным 1, право: число равным длина элементы, лучшее: число равным 0
  в конце лучшее
  пусть итог равно ...
  если слева меньше справа
    то дальше: лево станет лево плюс 1, лучшее станет итог
    иначе дальше: право станет право минус 1, лучшее станет итог
```

| line | meaning |
|---|---|
| `для каждого х[: тип] из список` | walk a list; the type is needed when a branch leaves early |
| `пока условие` | repeat while the condition holds |
| `убывает мера` | the measure of a `пока` loop; a guard checks it at run time |
| `шагов не больше n, иначе v` | the step budget of a `пока` loop and the value when it runs out; no guard |
| `храним имя: тип равным начало, …` | the values kept between steps |
| `в конце значение` | the value when the list or the condition ends |
| `дальше: имя станет значение, …` | the next step; unnamed kept values stay as they are |

A branch without `дальше` is the answer of the loop: that is an early return.

## What it becomes

| loop | expansion | totality |
|---|---|---|
| `для каждого`, the body ends with one `дальше` | `свёртка` over a record `«Имя — состояние»` | by construction |
| `для каждого` with an early return | a function with `разбор` over the rest of the list | by structure |
| `пока` with `шагов не больше` | a function with a `неотрицательное` budget that drops by one | by exact step |
| `пока` with `убывает` | a function with the declared measure | by declared measure |

The new function takes the parameters of the enclosing function that the loop
mentions, then the kept values, and returns what the enclosing function returns.
The loop body sees those parameters, its kept values and its element; anything
bound by `пусть` before the loop enters through `храним`.

`bootstrap/flang run-script sugar:demo` expands three LeetCode tasks written
with loops (`flang/sugar/tasks.flang`) and compares the `check --proof` verdict
of each with the verdict of the original solution in `docs/examples/leetcode`.
