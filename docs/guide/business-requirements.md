[Back to README](../../README.md) · [Documentation index](../README.md)

# Requirements and specifications: what flang gives a business and what it does not

This page is for whoever decides whether to adopt the language. It is built so
that it can be checked: **every example below is a file in the tree, every
output is taken from a run, and next to every number it says what produced
it.** If something here promises more than a run shows, that is a bug in the
page, and it must be fixed, not read in the language's favour.

All runs on this page use the `bootstrap/flang` binary from the root of the
tree.

## 1. In short: what you get and what you do not

**You get three things.**

1. A requirement on the program is written **next to the code**, in the same
   words as the domain rule, and it is read by the compiler, not only by a
   human.
2. **An unkept promise is visible.** It does not pretend to be kept: the report
   calls it `объявлено, не доказано` ("declared, not proven"), and
   `flang check --proof` exits with code 3.
   This is the main difference from a code comment or a wiki page — those stay
   equally silent whether the rule holds or not.
3. What has been proven can be **rechecked by another program** that has never
   seen the compiler.

**You do not get:**

- Completeness: the proof kernel covers a narrow list of kinds of statement,
  and the most ordinary business rule may fall outside it. The boundary is
  shown in section 5: a precondition written as a domain predicate is not
  discharged by the kernel at any call site.
- Anything about **state over time, side effects and concurrency**: the
  language's logic has no such notions at all.
- The **built program**: the proof is tied to the `flang check` command.
  Nobody checks that the emitted C corresponds to the source (section 7).

## 2. The requirement sits next to the code

[`docs/examples/usage/order-total.flang`](../examples/usage/order-total.flang):

```flang
модуль «Итог заказа»

тотальная функция «Итог заказа»
  принимает товары: неотрицательное, доставка: неотрицательное
  возвращает число
  обеспечивает «итог не меньше стоимости товаров» результат не меньше товары
  пример «доставка бесплатна»
    дано товары равно 1200
    дано доставка равно 0
    ожидается 1200
  пример «доставка платная»
    дано товары равно 1200
    дано доставка равно 300
    ожидается 1500
  товары плюс доставка
```

The `обеспечивает` line is a promise about the result **on every input**, not
on the listed ones. The `пример` lines are not tests in a neighbouring file but
part of the declaration. The run:

```
$ bootstrap/flang check docs/examples/usage/order-total.flang --proof
…
  постусловие «итог не меньше стоимости товаров» функции «Итог заказа» —
  доказано по объявленным типам аргументов: цель сведена правилом «порядок по
  построению» — утверждение обо ВСЕХ входах, а не о написанных; теоремы при нём
  нет и не нужно
…
docs/examples/usage/order-total.flang: ПРОВЕРЕНО САМОСТОЯТЕЛЬНО —
утверждений 1: доказано 1 … — код возврата 0
```

Note what paid for the proof: **the argument types.** Both arguments are
declared `неотрицательное` (non-negative), so the kernel derives "a sum is not
less than its summand" by itself. The same text with the type `вес` instead of
`неотрицательное` no longer proves — the answer drops to `сетка 2 значения`
("grid of 2 values"), that is, to the two written examples (the same command
on a modified copy). The choice of type here is not decoration; it is what the
proof is paid with.

## 3. Four answers and four exit codes

All of this is taken from runs on the files of this page.

| What happened to the promise | What the report calls it | `check --proof` | `check --proof --строго` |
|---|---|---:|---:|
| proven for all inputs | `ПРОВЕРЕНО САМОСТОЯТЕЛЬНО` / under the flag `ДОКАЗАНО` | 0 | 0 |
| examples exist, no proof | `НЕ ДОКАЗАНО — ОПОРА НЕ СУДИЛАСЬ`, `сетка N … Это не доказательство` / under the flag `НЕ УДАЛОСЬ ДОКАЗАТЬ — ОПОРА НЕ СУДИЛАСЬ` | 3 | 3 |
| neither a theorem nor examples | `НЕ ПРОВЕРЕНО`, `объявлено, не доказано` / under the flag `НЕ УДАЛОСЬ ДОКАЗАТЬ — ОБЪЯВЛЕНО, НЕ ДОКАЗАНО` | 3 | 3 |
| an example breaks the promise | `FLANG_PROPERTY: нарушено свойство …` | 1 | 1 |

Under `--строго` (strict), reliance on the grid answers **3**; code 4 is
reserved for `--быстро` (fast) and means exactly "some of the checks did not
run". Telling 0 from 3 in a build script is the whole point of the flag.

**There are two traps here, and both cost money.**

The first: **without the `--proof` flag there is no verdict at all.** A bare
`flang check` on a copy of the file from section 4 without the precondition,
where the promise is proven by nothing, answers with code 0 — it checks
parsing, types, termination and examples, and does not ask about proofs. If
your build runs `flang check` without `--proof`, it says nothing about
provability.

The second: **code 0 on the "grid" row does NOT mean "proven"** — it means "no
contradictions found on the values written in the examples". Only `--строго`
shows the difference between the first and second rows of the table: 0
versus 3.

## 4. An unproven requirement is visible

[`docs/examples/usage/discount.flang`](../examples/usage/discount.flang):

```flang
модуль «Скидка»

тотальная функция «Цена со скидкой»
  принимает цена: неотрицательное, скидка: неотрицательное
  возвращает число
  требует «скидка не больше цены» скидка не больше цена
  обеспечивает «скидка не делает цену отрицательной» результат не меньше 0
  цена минус скидка
```

The business rule is an ordinary one, and it is written exactly the way people
say it. A precondition stands next to it as well. The run:

```
$ bootstrap/flang check docs/examples/usage/discount.flang --proof
…
  постусловие «скидка не делает цену отрицательной» функции «Цена со скидкой» —
  доказано по объявленным типам аргументов: цель сведена правилом
  «неотрицательность по построению» — утверждение обо ВСЕХ входах, а не о
  написанных
…
docs/examples/usage/discount.flang: ПРОВЕРЕНО САМОСТОЯТЕЛЬНО — утверждений 1:
доказано 1, условно 0, сетка 0, объявлено, не доказано 0, отвергнуто 0,
нарушено 0 … — код возврата 0
```

The proof relies on the precondition. Remove the `требует` line, and the same
command on a copy answers differently:

```
  утверждений 1: доказано 0, сетка 0, объявлено, не доказано 1
…
discount.flang: НЕ ПРОВЕРЕНО — утверждений 1: доказано 0, условно 0, сетка 0,
объявлено, не доказано 1, отвергнуто 0, нарушено 0 … — код возврата 3
```

And here is the main point. The copy without the precondition builds and
runs; the promise has not disappeared — it has moved into a runtime check and
will fire on a real input. But **nobody can call it proven**, because the
report names it differently and the command exits with a non-zero code. A
comment `// скидка не сделает цену отрицательной` ("the discount will not make
the price negative") in any other language behaves exactly the opposite way:
it looks the same whether the rule holds or broke half a year ago.

## 5. Who proves the precondition — and where that has its boundary

The precondition (`требует`) is discharged by the **caller**, and therefore
not a single byte of it reaches the emitted code. This works.
[`docs/examples/usage/discount-on-call.flang`](../examples/usage/discount-on-call.flang)
calls the same function with literals:

```flang
тотальная функция «Цена товара по акции»
  возвращает число
  пример «тысяча минус триста»
    ожидается 700
  «Цена со скидкой» от 1000 и 300
```

```
$ bootstrap/flang check docs/examples/usage/discount-on-call.flang
модуль «Скидка на вызове»: функций 2, из них с доказанным завершением 2; типов 0
docs/examples/usage/discount-on-call.flang: проверено — разбор, типы,
завершаемость, ядро и примеры; замечаний нет
```

Exit code 0. Change one literal — `от 100 и 300`, that is, a discount larger
than the price — and running the same command on a copy gives:

```
FLANG_PRECONDITION_CALL … вызов «Цена со скидкой» в функции «Цена товара по
акции» не снимает предусловие «скидка не больше цены» …
… не проверено — замечаний 1
```

Exit code 1. The requirement caught the bad call before the run.

**The boundary is exactly here, and it is narrow.** The kernel discharges a
precondition only if the goal has one of the ten forms it lists by name in its
refusal — "не меньше 0" (at least 0), "не больше конечного литерала" (at most
a finite literal), "не больше терма" (at most a term), "не меньше терма" (at
least a term), "меньше терма" (less than a term), "больше терма" (greater than
a term), "равно" (equals), "содержит" (contains), "не убывает" (non-decreasing)
and "начинается с" (starts with). A precondition written as **a call to your
own predicate function** ("the list is non-decreasing", "the client is
verified", "the contract is in force") is not discharged at any call site —
even where it is obviously true. This is shown by a run on the page
[flang on foreign code](foreign-code.md),
section 4: a call with the plainly sorted list `[100, 500, 900]` is rejected
just like a call with an unsorted one.

Hence the practical conclusion for whoever counts the money: **the
requirements the compiler can carry through are inequalities and equalities
over numbers, strings and lists.** Everything expressed by a domain predicate
is written down, checked at runtime and stays declared.

## 6. What the logic does not have at all

This is not "little" or "partial" — it is absent:

- **state over time.** The language does not express statements like "after
  payment an order cannot become a draft": the kernel has no temporal logic;
- **side effects.** An action in flang is a described value, executed by
  whoever runs the plan. The kernel gives no proofs whatsoever about what
  happens to the outside world;
- **concurrency.** The language has processes, but no statements about races
  and deadlocks.

The full list of what is absent is [Known limits](limits.md). In the tree's
task book such tasks are marked with a separate card: these are the
`docs/tasks/*.md` files with the line `карта: Чего в языке нет вовсе`. The task
book's count changes; ask for it by running
`bootstrap/flang run-script tasks:board`, not this page.

## 7. Where the proof ends

The verdict of the tool `bootstrap/flang io scripts/provability.fscript --plan Verdict --timeout 900000`
(coverage threshold 100 %) is tied to the `flang check` command — and only to
it.

```
$ bootstrap/flang io scripts/provability.fscript --plan Verdict --timeout 900000
…
ДОКАЗУЕМ

проверка 1 — калькулятор снят? ДА (…)
проверка 2 — доля проигрыванием не ниже 100 %? ДА (100.00 %: 650 из 650; …)
проверка 3 — набор проб пройден? ДА (набор подделок 39 из 39; проб на подлог 632, принято кодом 0 — 0; …)
проверка 4 — набор не ослаб? ДА (…)
```

(run from the root of the tree, exit code 0).

Read it like this: 650 of the 650 obligations in the set were **replayed by an
independent program** that has never seen the compiler, and 632 attempts to
push a falsehood through the same record were rejected. That is a lot, and it
is checkable.

And here is what this number does not include:

| step | what is proven |
|---|---|
| `flang check` | postconditions and termination; an independent program replayed this |
| `flang run` | nothing: the evaluator inside the binary is not proven |
| `flang emit --target c` and the build | nothing: **nobody checks that the emitted C corresponds to the source** |

The decision on this gap is [ADR-0030](../adr/0030-the-printer-proves-each-run-not-itself.md),
status "proposed". Coq, Lean and Idris have the same gap; CompCert and CakeML
closed it, each with years of a team's work.

## 8. On certification — plainly

If you came with the question "is this fit for avionics, medical devices, a
nuclear plant", the answer is short: **no, and the coverage percentage has
nothing to do with it.**

Process certification (DO-178C, IEC 62304, IEC 61508 and related standards)
asks not about the share of what is proven but about other things:

- **traceability** "requirement → code → test → run result", end to end and
  documented;
- **tool qualification**: the compiler and the checking programs must
  themselves be qualified, with a description of what they do and how their
  failure is detected;
- **response-time bounds**, proven or measured on the target hardware;
- **failure behaviour**: what the program does when memory runs out, a device
  does not respond, a value goes out of range;
- **change and configuration management** with a record of who accepted what.

We have none of these items — neither finished nor as a dated plan. The
language provides part of the first item (the requirement is written next to
the code and checked by a machine) and none of the rest.

## 9. If you are deciding whether to adopt it

Three questions that a run answers honestly, not this page:

1. Take **three of your real rules** — the most ordinary ones, not the
   prettiest. Write them as `обеспечивает` and run
   `flang check --proof --строго`. How many of the three answered "proven", how
   many "grid", how many "declared, not proven"? That is your coverage, not the
   coverage of the language's own corpus.
2. Look at the ones that stayed declared. **Are you fine with them being
   visible but not proven?** If yes, the language already gives you
   something. If you need provability specifically, count by item 1.
3. Do you need the built code, or is checking the source enough? If you need
   the built code, see section 7 and decide whether the gap is tolerable.

Related: [Known limits](limits.md) ·
[What `тотальная` buys you](totality.md) ·
[flang on foreign code](foreign-code.md) ·
[How to write flang well](how-to-write-flang.md)
