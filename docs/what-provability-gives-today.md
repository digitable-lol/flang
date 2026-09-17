# What provability gives a developer today — and what it does not

Measured 11 September 2026 on commit `2c40752d0` (release 0.7.17) with
`bootstrap/flang` built from this tree. Every output below is pasted from a run.
The full account, with both source files and all three runs, is the Russian
edition — [`what-provability-gives-today.ru.md`](what-provability-gives-today.ru.md).

In short. Next to a function you write what it requires of its input
(`требует`) and what it promises about its result (`обеспечивает`).
`flang check --proof` either proves the promise for all inputs and exits 0, or
says in words that it could not and exits 3. The compiler's proof can be written
out and handed to a separate C program that does not trust the compiler and
replays its moves. Everything else is a boundary: what cannot be written in this
language of promises, what no proof covers, and how far that is.

## Three runs

`«Итог заказа»` (order total, `товары плюс доставка`, both arguments
`неотрицательное`) promises `результат не меньше товары`:

```
$ flang check --proof заказ.flang
  … доказано по объявленным типам аргументов: цель сведена правилом «порядок по
  построению» — утверждение обо ВСЕХ входах, а не о написанных …
заказ.flang: ПРОВЕРЕНО САМОСТОЯТЕЛЬНО — утверждений 1: доказано 1 … — код возврата 0
```

Proved for all inputs, not for the example's 100 and 10; no theorem had to be
written.

`«Цена со скидкой»` (`цена минус скидка`, with `требует «скидка не больше
цены»`) promises `результат не меньше 0`:

```
$ flang check --proof скидка.flang
  … объявлено, не доказано: ни теоремы, ни примеров. Его считает рантайм после
  каждого возврата — на тех входах, которые придут
скидка.flang: НЕ ПРОВЕРЕНО — утверждений 1: доказано 0 … объявлено, не доказано 1 … — код возврата 3
```

The claim is true under that precondition, but the kernel has no rule for the
lower bound of a difference (`flang/self/proof-kernel.flang:2664`,
[ADR-0032](adr/0032-one-missing-rule-and-three-other-logics.md) §2). What matters
is what happens to the unproved: it does not pretend. Exit 3, the words
«объявлено, не доказано», and in the printed program the runtime checks the
condition on every return.

The third run is the independent check. The kernel writes its proof record;
`flang/proof/чекер/сверщик.c`, a C program with no line of the compiler in it,
reads the source and the record and replays the moves:

```
$ flang check --proof заказ.flang --записать заказ.запись            # exit 0
$ flang/proof/чекер/сверщик заказ.flang заказ.запись
НЕ ВЗЯЛСЯ … значение «по объявлению да» — сверщик не повторяет изъятие
объявленного типа, место на слове ядра
НЕ ПРОВЕРЕНО — запись не противоречит исходнику, но доказательством это не
является … Привязка к программе: SHA-256 сошёлся.                        exit 3
```

An honest answer. On this function the kernel closed the goal «by declaration»
— both arguments are declared non-negative — and the checker has no move for
that yet: it neither confirms nor refutes, it names the place where it takes the
kernel's word. 22 such places out of 651 remain in the compiler's own record set.
Where the kernel recorded moves, the checker replays them: 629 obligations over
89 records, and 453 deliberate forgery probes rejected (`./ярлык чекер:проверка`).

## Expressible, and not

Nine proof words (`flang/self/lexer.flang:1220`). Expressible and proved today:
inequalities and equalities over numbers; list lengths and order; a claim under
a condition; induction over a declared sum, over `неотрицательное` and over a
fold, when the theorem is written out; a precondition `требует`, checked by the
caller and costing zero bytes in printed code; the quantifier over a function's
inputs ([ADR-0026](adr/0026-quantifiers-over-any-type-are-a-kernel-change.md) §2.1).

Five more arrived with 0.7.19: induction over a type you declared yourself; a
quantifier over the elements of a list written in the goal
(`для всех п из результат: п больше 0`); nested quantifiers of any depth, and
existence with the value written out (`есть такой м, а именно н, что …`); a
statement standing outside a function (`утверждение «…»`), which now reaches
`flang check --proof --json` and the proved-share report; and a proof step named
by hand — the step names the inference rule and the premises it rests on, and the
kernel checks the naming instead of searching.

Not expressible — there is no place to write it:

- **∃ with no value named** — the kernel does not search for one and will not;
  only the written-out value is expressible (ADR-0026 §11, item 15);
- **state over time** — `обеспечивает` at a `процесс` is a parse refusal,
  `FLANG_PARSE` (ADR-0032 §3.1);
- **effects** — the proving layers know nothing about `план`: 0 occurrences in
  the kernel, obligations and types (ADR-0032 §3.2);
- **concurrency** — no notion of ownership separation (ADR-0032 §3.3);
- **subtraction under a precondition** — expressible, not proved (second run);
  one missing rule, task 1403.

## Not covered by any proof

- **Compiled code.** `flang check` proves the source; nobody checks that
  `flang emit --target c` printed the same program. The printer is not proved —
  the same gap as Coq, Lean and Idris; CompCert closes only C → machine.
  Decision: [ADR-0030](adr/0030-the-printer-proves-each-run-not-itself.md) —
  check each run of the printer, not the printer; tasks 1401, 1402.
- **`flang run`.** The evaluator inside the binary is not proved.
- **The categorical surface and processes** are parsed and reported unjudged,
  exit 2.
- **Grids.** Examples are counted, not proved; `flang check` does not even run
  them — `flang test` does.
- **Space, medicine, aviation.** Standards ask for traceability, tool
  qualification, proved response bounds, behaviour on hardware failure. Of these
  only traceability exists, and with gaps: `./ярлык прослеживаемость:проверка`
  on 11 September — 409 postconditions, 322 with an example, 361 in a record,
  244 proved, gaps 62 and 68 (task 1407). The rest does not exist, and a
  percentage does not replace it
  ([ADR-0031](adr/0031-certification-is-a-process-not-a-property-of-the-language.md)).
  Two of those rows are measured separately: «terminates within N steps» exists
  only as an analysis (`flang/self/bounded.flang`) and is not printed into the
  proof record ([ADR-0033](adr/0033-termination-is-not-a-bound-on-steps.md));
  an I/O failure arrives as data, but 79 handlers out of 309 swallow it with
  `случай любое`, and hardware failure the language does not see at all
  ([ADR-0034](adr/0034-hardware-failure-is-described-not-proved.md)).
  We do not promise it.

## What «96 %» means

```
sh scripts/доказуемость.sh          → ДОКАЗУЕМ                       (13 September 2026)
sh flang/proof/доля-корпуса.sh --проигрыванием
→ доля-проигрыванием = 629 / 651 = 96.62 %
  на слово ядра: посылок и утверждений 12; шагов 4; снято калькулятором 6
```

The share of places in the **compiler's own proof records** (89 records over
`flang/proof/map/`, `flang/proof/examples/` and the standard library) where the
independent checker replayed the kernel's move. Not «96 % of programs are
proved», not «96 % of claims in the tree», nothing about compiled code. The word
is derived from four numbers: no computing step in the checker; share against
the gate — 100 % since 17 September 2026 (the owner's word, task 3348), which is
why the word today is an honest **НЕ ДОКАЗУЕМ**, exit 1, at 633 of 650 replayed;
529 forgery probes rejected and 244 honest records accepted; the probe set has
not shrunk. The inference rules were also judged by the Lean 4
kernel — 88 rules against 85 lemmas in the run of 11 September; the list has
grown to 97 rules since, and Lean has not been run again
([`lean-checks-the-inference-rules.md`](lean-checks-the-inference-rules.md)).

**Release 0.7.19 did not move that share.** It went 625 → 629 in 0.7.18; the seed
reprint in 0.7.19 brought the kernel new abilities, not a higher share. What you
have to trust grew with it: the deciding part of the kernel is 4796 lines, 4669
before, because the quantifiers live there. The standing order to bring that
number under 4000 is not done.

## How far from «right»

Five stages in [`docs/ROADMAP.md`](ROADMAP.md), no dates:

| stage | today | when closed | decision, tasks |
|---|---|---|---|
| 1. To 100 % | 22 of 651 places on the kernel's word; the third run above is one | the checker answers ПРОВЕРЕНО, exit 0, on everything the kernel called proved | [`road-to-one-hundred-measured.md`](road-to-one-hundred-measured.md); 6191 done |
| 2. Proved translation to C | printed C covered by nothing | `emit` comes with a translation protocol and a comparator's verdict; a swapped function in C is caught | ADR-0030; 1401, 1402 |
| 3. Logic | subtraction under `требует` exits 3; nothing to say about processes, plans, effects | the second run exits 0 (1403); a place for claims about steps, plans, ownership (1404–1406, measurement first) | ADR-0032 |
| 4. Quantifiers | done in 0.7.19: a quantifier over list elements, nested quantifiers, existence with a written-out value, induction over your own type, a statement outside a function | a quantifier in `требует`; existence with no value named — decided against | ADR-0026; 6202, 6203, 6205, 6206, 5957, 9526 |
| 5. Traceability, response, failure | the requirement → code → example → record chain is walked both ways by a guard, gaps 62 and 68 (1407 done on 11 September); a step bound exists as analysis only; failure is described, not proved | the gaps go to zero under a ratchet; the step bound is in the record and replayed (1408), seconds for a named machine with a spread (1409); failure behaviour on one page with a counter of swallowed «Сбой» (1410); seconds and hardware failure still unproved | ADR-0031, 0033, 0034; 1407–1410 |
