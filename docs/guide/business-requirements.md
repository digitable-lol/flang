[Back to README](../../README.md) · [Documentation index](../README.md)

# Requirements and specifications: what flang gives a business and what it does not

This page is for whoever decides whether to adopt the language. Every example
below is a file in the tree, every output comes from a run, and every number
has its command next to it. If the page promises more than a run shows, that is
a bug in the page.

All commands are run with the `bootstrap/flang` program from the root of the
tree.

## 1. In short: what you get and what you do not

**You get three things.**

1. A requirement on the program is written **next to the code**, in the words of
   the domain rule. The compiler reads it, not only a human.
2. **An unproved postcondition is visible.** `flang check --proof` calls it
   `не доказано` ("not proved") and exits with code 3. A code comment or a wiki
   page looks the same whether the rule holds or not.
3. What has been proved can be **rechecked by another program** that does not
   use the compiler's code.

**You do not get:**

- completeness. The proof kernel covers a narrow list of kinds of statement,
  and an ordinary business rule may fall outside it. The boundary is shown in
  section 5: the kernel does not prove a precondition written as a predicate
  function at any call site;
- anything about **state over time, side effects and concurrency**: the
  language's logic has no such notions;
- a proof about the **built program**: the proof is tied to the `flang check`
  command. The translation to C is checked separately and only in part
  (section 7).

## 2. The requirement sits next to the code

[`docs/examples/usage/order-total.flang`](../examples/usage/order-total.flang):

```flang
модуль «Order total»

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

The `обеспечивает` line is a postcondition: a statement about the result **on
every input**. The `пример` lines are part of the declaration, not tests in a
neighbouring file.

```
$ bootstrap/flang check docs/examples/usage/order-total.flang --proof
модуль «Order total»: функций 1, завершение доказано у 1
постусловие «итог не меньше стоимости товаров» функции «Итог заказа» — доказано
итог: постусловий и утверждений 1 — доказано 1, проверено только на тестах 0, не доказано 0
docs/examples/usage/order-total.flang: проверено — доказано 1, проверено только на тестах 0, не доказано 0, ложно 0 (постусловий и утверждений 1); независимая проверка повторила 0 из 1 — код возврата 0
```

The last line says one more thing: the independent check did not repeat this
proof ("0 из 1", 0 of 1). With `--explain` the same command prints the detailed
report and names the rule: "доказано по объявленным типам аргументов: цель
сведена правилом «порядок по построению»" (proved from the declared argument
types by the rule "order by construction").

The proof rests on **the argument types.** Both are declared `неотрицательное`
(non-negative), so the kernel derives "a sum is not less than its summand" by
itself. On a copy of the file with the type `вес` instead of `неотрицательное`
the same command answers "проверено только на тестах (примеров 2)" (tested
only, 2 examples) and exits with code 3.

## 3. Four answers and their exit codes

Measured by runs on the files of this page and their copies.

| What happened to the postcondition | Line of `check --proof` | Verdict under `--proof --strict` | `check` | `check --proof` | `check --proof --strict` |
|---|---|---|---:|---:|---:|
| proved for all inputs | `— доказано` | `ДОКАЗАНО` | 0 | 0 | 0 |
| examples exist, no proof | `— проверено только на тестах (примеров N)` | `НЕ УДАЛОСЬ ДОКАЗАТЬ — ОПОРА НЕ СУДИЛАСЬ` | 0 | 3 | 3 |
| neither a proof nor examples | `— не доказано` | `НЕ УДАЛОСЬ ДОКАЗАТЬ — ОБЪЯВЛЕНО, НЕ ДОКАЗАНО` | 0 | 3 | 3 |
| an example or a found input violates the postcondition | `FLANG_PROPERTY: … нарушено …` | no report is printed | 1 | 1 | 1 |

The third row was measured on
[`docs/examples/proofs/reverse.flang`](../examples/proofs/reverse.flang). The
word `сетка` ("grid") in the detailed report means "tested only". Code 4 is
reserved for `--fast` and means "some of the checks did not run". `--строго` is
the Cyrillic spelling of `--strict`.

**`flang check` without `--proof` does not judge provability.** On
`reverse.flang`, where the statement is not proved, it exits with code 0 and
prints "не доказано: 1 — подробности: flang check reverse.flang --proof". If
your build runs `flang check` without `--proof`, its exit code says nothing
about provability.

The help text of `flang check --help` says that without `--strict` a
tested-only result exits with code 0. Today that is not so: the code is 3 in
both cases.

## 4. An unproved requirement is visible

[`docs/examples/usage/discount.flang`](../examples/usage/discount.flang):

```flang
модуль «Discount»

тотальная функция «Цена со скидкой»
  принимает цена: неотрицательное, скидка: неотрицательное
  возвращает число
  требует «скидка не больше цены» скидка не больше цена
  обеспечивает «скидка не делает цену отрицательной» результат не меньше 0
  цена минус скидка
```

The `требует` line is a precondition.

```
$ bootstrap/flang check docs/examples/usage/discount.flang --proof
модуль «Discount»: функций 1, завершение доказано у 1
постусловие «скидка не делает цену отрицательной» функции «Цена со скидкой» — доказано
итог: постусловий и утверждений 1 — доказано 1, проверено только на тестах 0, не доказано 0
docs/examples/usage/discount.flang: проверено — доказано 1, проверено только на тестах 0, не доказано 0, ложно 0 (постусловий и утверждений 1); независимая проверка повторила 1 из 1 — код возврата 0
```

Here the independent check did repeat the proof: "1 из 1".

The proof rests on the precondition. On a copy of the file without the
`требует` line the postcondition is false, and the compiler itself finds an input
that violates it:

```
$ bootstrap/flang check discount.flang --proof
FLANG_EXAMPLE: FLANG_PROPERTY: постусловие «скидка не делает цену отрицательной» функции «Цена со скидкой» нарушено на входе цена = 0, скидка = 1 — посчитано вычислителем на этом входе
discount.flang: не проверено — ведомость не печатается у программы с замечаниями
```

Exit code 1. `ведомость` in the last line is the proof report.

A true but unproved statement looks different:

```
$ bootstrap/flang check docs/examples/proofs/reverse.flang --proof
модуль «List reversal»: функций 2, завершение доказано у 2
утверждение «двойное обращение возвращает список» — не доказано
итог: постусловий и утверждений 1 — доказано 0, проверено только на тестах 0, не доказано 1
docs/examples/proofs/reverse.flang: доказано не всё — доказано 0, проверено только на тестах 0, не доказано 1, ложно 0 (постусловий и утверждений 1); независимая проверка повторила 0 из 0 — код возврата 3
подробный отчёт: flang check docs/examples/proofs/reverse.flang --proof --explain
```

Such a program builds and runs. The statement stays in it as a runtime check.
It cannot be called proved: the report says `не доказано` and the command exits
with code 3. A comment `// the discount will not make the price negative` in
another language looks the same whether the rule holds or broke long ago.

## 5. Who proves the precondition and where the boundary is

The precondition (`требует`) is proved on the **caller's** side.
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
модуль «Discount on call»: функций 2, из них с доказанным завершением 2; типов 0
docs/examples/usage/discount-on-call.flang: проверено — доказано 0, проверено только на тестах 0, не доказано 0 (постусловий и утверждений 0); замечаний нет
```

Exit code 0. On a copy with the call `от 100 и 300`, a discount larger than the
price, the same command answers:

```
FLANG_PRECONDITION_CALL … вызов «Цена со скидкой» в функции «Цена товара по акции» не снимает предусловие «скидка не больше цены»: …
… не проверено — замечаний 1
```

Exit code 1. `не снимает` means "does not prove". The bad call is found before
the run.

In the emitted C (`flang emit --target c`) the function body does not check the
precondition. The by-name entry (`discount_call`), through which outside values
arrive, does check it; a violation there gives `FLANG_PRECONDITION`.

**The boundary is narrow.** The kernel proves a precondition only if it is a
comparison ("не меньше", "не больше", "меньше", "больше", "равно") with a
literal or an expression, "содержит" (contains), "не убывает" (non-decreasing)
or "начинается с" (starts with). The error message names the rule the kernel
tried and the forms that rule accepts. A precondition written as **a call to
your own predicate function** ("the list is non-decreasing", "the client is
verified", "the contract is in force") is not proved at any call site, even
where it is obviously true. An example is on the page
[flang on foreign code](foreign-code.md), section 4: a call with the sorted
list `[100, 500, 900]` is rejected just like a call with an unsorted one.

The practical conclusion: **the compiler proves requirements written as
inequalities and equalities over numbers, strings and lists.** A requirement
written as a domain predicate is, today, written down, checked at runtime and
left unproved.

## 6. What the logic does not have at all

- **state over time.** The language does not express statements like "after
  payment an order cannot become a draft": the kernel has no temporal logic;
- **side effects.** An action in flang is a described value, executed by
  the host that runs the plan. The kernel gives no proofs about what
  happens to the outside world;
- **concurrency.** The language has processes, but no statements about races
  and deadlocks.

The full list is [Known limits](limits.md). Among the tree's tasks these are
marked with the line `карта: Чего в языке нет вовсе` in the `docs/tasks/*.md`
files. Their number changes; `bootstrap/flang run-script tasks:board` shows it.

## 7. Where the proof ends

The result of the script `bootstrap/flang io scripts/provability.fscript --plan Verdict --timeout 900000`
(coverage threshold 100 %) concerns the `flang check` command only.

```
$ bootstrap/flang io scripts/provability.fscript --plan Verdict --timeout 900000
…
ДОКАЗУЕМ

проверка 1 — калькулятор снят? ДА (…)
проверка 2 — доля проигрыванием не ниже 100 %? ДА (100.00 %: 650 из 650; …)
проверка 3 — набор проб пройден? ДА (набор подделок 39 из 39; проб на подлог 632, принято кодом 0 — 0; …)
проверка 4 — набор не ослаб? ДА (…)
```

This output was recorded earlier; on 27 November 2026 the command was not
re-run: it takes more than ten minutes. It means: 650 of the 650 statements in
the set were **repeated by an independent program** that does not use the
compiler's code, and 632 attempts to push a false statement through the same
record were rejected.

What this number does not include:

| step | what is proved |
|---|---|
| `flang check` | postconditions and termination; an independent program repeated this |
| `flang run` | nothing: the evaluator inside the compiler is not proved |
| `flang emit --target c` and the build | not proved. With `--protocol` the C emission writes a translation protocol, and `flang/translation/matcher.c` compares the emitted file with it |

The translation protocol is described in [ADR-0030](../adr/0030-the-printer-proves-each-run-not-itself.md)
(accepted on 13 September 2026) and exists only for the C target. On
`discount.flang` the comparison answers "узлов в протоколе 21; переиграно
правилом 16, принято на слово 0" (21 nodes, 16 replayed by rule) and "СОШЛОСЬ"
(matched); after one number in the emitted C is edited it answers "НЕ СОШЛОСЬ"
with the line number. This checks one emission run; it is not a proof of the
compiler. Nothing checks the build of that C by `cc`. Coq, Lean and Idris have
the same gap; CompCert and CakeML closed it, each with years of a team's work.

A proof does not notice a change that altered a rule together with its
postcondition and examples. Every check passes, because the specification
changed together with the code. Such a change is shown by the
[behaviour table of a rule](behavior-table.ru.md): the rows where the outcome
became different.

## 8. On certification

To the question "is this fit for avionics, medical devices, a nuclear plant"
the answer is: **not today, and the share of what is proved has nothing to do
with it.**

Process certification (DO-178C, IEC 62304, IEC 61508 and related standards)
asks about other things:

- **traceability** "requirement → code → test → run result", end to end and
  documented;
- **tool qualification**: the compiler and the checking programs must
  themselves be qualified, with a description of what they do and how their
  failure is detected;
- **response-time bounds**, proven or measured on the target hardware;
- **failure behaviour**: what the program does when memory runs out, a device
  does not respond, a value goes out of range;
- **change and configuration management** with a record of who accepted what.

We have none of these items, and no dated plan for them. The
language provides part of the first item (the requirement is written next to
the code and checked by a machine) and none of the rest.

## 9. If you are deciding whether to adopt it

Three questions that a run answers, not this page:

1. Take **three of your real rules**, the most ordinary ones. Write them as
   `обеспечивает` and run `flang check --proof`. How many of the three answered
   "доказано" (proved), how many "проверено только на тестах" (tested only),
   how many "не доказано" (not proved)? That is your share; the share on the
   language's own programs says nothing about it.
2. Look at the ones that stayed unproved. **Are you fine with them being
   visible but not proved?** If yes, the language is useful to you already. If
   you need provability specifically, count by item 1.
3. Do you need the built code, or is checking the source enough? If you need
   the built code, see section 7 and decide whether the gap is tolerable.

Related: [Known limits](limits.md) ·
[What `тотальная` buys you](totality.md) ·
[flang on foreign code](foreign-code.md) ·
[How to write flang well](how-to-write-flang.md)
