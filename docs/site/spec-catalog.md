# The spec catalogue: the stand, the guard, the snapshot

The neighbouring page — [Specs: a proved business rule](fspec.html) — shows WHAT
a spec-as-a-program is. This one answers the next question: how specs add up to a
catalogue that does not drift apart, and what keeps it honest.

The catalogue lives in the tree under [`fspec/`](fspec). It is not the language
specification — that one is [`flang/SPEC.md`](flang/SPEC.md). It is **a sample
package and a working stand at once**: forty-odd domain rules written as
programs, the rule by which they are accepted, a guard program, a memory of what
stood yesterday, a set of deliberately broken cases, and a set of programs that
show where the compiler stops speaking.

## What lies where

| file | what it does | measured |
|---|---|---|
| [`spec/*.flang`](fspec/spec) | the specs themselves: the domain rules | 42 files <!-- СНЯТО 2026-09-08 файлов fspec/spec/*.flang = 42 -->, 140 examples of their own <!-- СНЯТО 2026-09-08 примеров-в fspec/spec/*.flang = 140 --> |
| [`policy.flang`](fspec/policy.flang) | the acceptance rule, written in the language itself: what counts as proved, what "agrees with its predecessor" means, what "the content was not rewritten" means | 361 lines <!-- СНЯТО 2026-09-09 строк fspec/policy.flang = 361 --> |
| [`guard.flang`](fspec/guard.flang) | the plan: read the snapshot, find the specs, ask the compiler, name the trouble, set the exit code | 1583 lines <!-- СНЯТО 2026-09-08 строк fspec/guard.flang = 1583 -->, 138 examples <!-- СНЯТО 2026-09-08 примеров-в fspec/guard.flang = 138 --> |
| [`snapshot.flang`](fspec/snapshot.flang) | the tooling: rewrite the snapshot from the current specs | 140 lines <!-- СНЯТО 2026-09-08 строк fspec/snapshot.flang = 140 --> |
| [`snapshot.txt`](fspec/snapshot.txt) | the snapshot itself: one line per promise — file, function, name, goal | 100 lines <!-- СНЯТО 2026-09-08 строк fspec/snapshot.txt = 100 --> |
| [`forgery.flang`](fspec/forgery.flang) | the forgery: deliberately broken catalogues, and the guard must redden on every one | 329 lines <!-- СНЯТО 2026-09-08 строк fspec/forgery.flang = 329 --> |
| [`clarifications.flang`](fspec/clarifications.flang) | the clarifier: turns a failed proof into a question for the author of the requirement | 507 lines <!-- СНЯТО 2026-09-08 строк fspec/clarifications.flang = 507 --> |
| [`experience/`](fspec/experience) | a coarse requirement and two answers to it — the bench for the clarifier | 3 files <!-- СНЯТО 2026-09-08 файлов fspec/experience/*.flang = 3 --> |
| [`experiments/`](fspec/experiments) | programs that show the boundary; they are not meant to be fixed | 22 files <!-- СНЯТО 2026-09-08 файлов fspec/experiments/*.flang = 22 --> |
| [`settings.txt`](fspec/settings.txt) | two lines: the path to the compiler and the spec directory | |

How the clarifier is built is a separate document next to it,
[`fspec/CLARIFICATIONS.md`](fspec/CLARIFICATIONS.md).

The stand is written in flang throughout: not a single JavaScript file in the
directory. That became possible because the guard does not parse `.flang`
itself — it runs the compiler as a process and reads the answer, and for that the
language has the orders "list a directory", "read a file" and "run a process".

## What a spec looks like

A spec is not markdown, it is a program. Here is the first spec of the catalogue
in full, [`fspec/spec/01-discount-cap.flang`](fspec/spec/01-discount-cap.flang),
comments stripped:

```flang
модуль «Спека 1: потолок скидки»

тотальная функция «Потолок скидки»
  принимает сумма: число
  возвращает число
  обеспечивает «скидка не больше 30» результат не больше 30
  обеспечивает «zh: 折扣不超过 30» результат не больше 30
  обеспечивает «en: discount is at most 30» результат не больше 30
  пример «потолок»
    дано сумма равно 1000
    ожидается 30
  30
```

**The name of a claim is its identity mark.** Specs are matched against one
another, and against the snapshot, by the pair "function plus name". Rename a
claim and the link breaks — visibly, by a run rather than by reading.

The link to a spec written earlier is the `использует` line:

```flang
модуль «Спека 3: наценка за срочность»
  использует «Спека 2: промо» из "./02-promo.flang"
```

That reference is part of the program, not prose: renaming a spec without fixing
its heir breaks the import at once.

## The acceptance rule

It is written in the language itself, in `policy.flang`. A spec is accepted only
if **every** claim of its own is proved, and **every** claim of its predecessor
is still proved in the heir's report.

The argument is direct: the language has zero axioms. Falsehood cannot be derived
from a set of proved claims — there is nothing to derive it from. As long as
every rule is derived rather than declared, the whole set stays consistent, and
there is no need to compare rules pairwise.

What is rejected:

| what was found | why it will not do |
|---|---|
| "declared, not proved" | the claim may turn out false, and that will be learnt in production |
| "grid" — counted on the author's values | this is not a claim about all inputs, and it cannot be added to another |
| "VIOLATED by an example" | a falsehood already found by the author's own example |
| a spec without a single `обеспечивает` | there is nothing to check, yet it greens exactly like one that holds |
| a predecessor's claim gone or weakened | the new rule cancelled the old one silently |
| a claim from the snapshot gone from the specs | a rule once proved has been withdrawn silently |
| a claim from the snapshot with its goal rewritten | same name, different promise |
| a claim present but absent from the snapshot | until it is recorded, it can be rewritten silently |
| an empty spec directory | a check with nothing to disagree about greens always |
| one name carrying two different notions | the reader takes it for one thing while it is two |
| an `принимает` line not parsed in full | until the input is parsed, a substituted notion under that name stays invisible |

**The price is named honestly.** A true but underivable claim will be rejected
too: the kernel is incomplete, and a sample of that incompleteness lies in the
tree —
[`flang/proof/examples/precondition.flang`](flang/proof/examples/precondition.flang).
A spec that runs into incompleteness is a request for a new kernel rule, not a
reason to weaken acceptance with a threshold. Which forms the kernel takes today
is laid out on [Which promises the kernel takes](kak-dokazat.html).

## What counts as a real claim

A claim can be proved and still say nothing. **A weakened claim** is one that
survives replacing the body with a stub of the same signature: `0`, `""`, `нет`,
the empty list. If the stub passes too, the claim is true of ANY function with
that signature, and therefore says nothing about this one.

This is settled by a run, not by argument: copy the function into a separate
file, keep the signature and the `обеспечивает`, replace the body with a stub,
and call `check`.

```flang
модуль «Заглушка»

тотальная функция «Потолок скидки»
  принимает сумма: число
  возвращает число
  обеспечивает «скидка не больше 30» результат не больше 30
  0
```

```
$ flang check zaglushka.flang --proof
zaglushka.flang: ПРОВЕРЕНО САМОСТОЯТЕЛЬНО — утверждений 1: доказано 1 … код возврата 0
```

The stub passed — so the claim of the first spec is weakened, and that is not an
oversight but part of the design: a function whose body is a constant has no
contentful promise at all. The first two specs show what the LINK between two
specs looks like, not what a strong claim looks like.

Hence the shape of the promises further down the catalogue. Claims that do NOT
survive a stub are those about **length** (`(длина результат) равен ((длина х)
плюс 1)`), about **membership** (`результат содержит "…"`), about a **boolean
formula**, about **record fields**, and about **a bound where the bound is the
result itself** (`цена не больше результат`). Those that do survive are one-sided
upper bounds (`результат не больше 30`) and non-negativity (`результат не меньше
0`).

## The snapshot: a memory of what stood yesterday

The acceptance rule looks at the specs AS THEY ARE NOW. Hence a hole: rewrite the
goal of a claim without touching its name, and acceptance will not notice.

The hole is closed by `snapshot.txt` — one line per promise, carrying, besides
the file, the function and the name, THE GOAL ITSELF verbatim:

```
01-discount-cap.flang :: Потолок скидки :: скидка не больше 30 :: результат не больше 30
```

The guard reads the snapshot first and matches it against the specs both ways:

- **snapshot → specs**: every recorded promise is in place and carries the same
  goal. Gone — "the rule was withdrawn silently". Goal rewritten — "same name,
  different promise", and both goals are shown side by side;
- **specs → snapshot**: every promise of a spec is recorded. Not recorded means
  not protected by anything, and tomorrow it can be rewritten silently.

**The snapshot is written by a separate command, and that too is a rule:**

```sh
flang io fspec/snapshot.flang
```

A snapshot that refreshed itself silently along with the specs would protect
nothing: it would record the weakening together with it. Editing a goal is TWO
actions, and the second one shows up in the diff as a line of its own.

**Where the goal comes from.** From the spec source, not from the compiler's
report: in the report a claim carries prose ("proved by reducing the goal against
the function body…"), and matching content by that means matching by the wording
of the proof. The parsed goal is in the report as well, but it is three times the
size of the rest of it, and parsing such JSON in flang costs gigabytes of memory.
So the goal is read from the primary source — the `обеспечивает` line of the spec
itself, character for character.

The convention this rests on: a promise is written on one line —
`обеспечивает «name» goal`, or under a quantifier, `для всех н обеспечивает
«name» goal`. The quantifier is part of the recorded goal, because "for all n"
and "for all m" are different claims. There is a lock on the convention: the rule
"the source was not parsed in full" compares the number of `обеспечивает` lines
read out with the number of claims in the report. If they diverge, the guard
reddens and says that content cannot be matched.

What the snapshot does NOT do: it does not judge whether the new goal is weaker
than the old one. "At most 1000" and "at most 30" are simply DIFFERENT to it. It
says something else and smaller: **the content of a proved promise does not
change silently.**

## A requirement in another language

For code, multilingualism is harmful: two names for one thing split the
community. For a requirement it is the other way round — a requirement is read
not by a programmer but by whoever pays. The proof stays one for all languages,
because what is proved is the goal, not the text.

A view is written with the same `обеспечивает`, with a language tag in the name —
see the first spec above. Views are real claims, not marginal notes: the kernel
proves each one separately, and each stands in the report and in the snapshot.

What is translated is the NAME of the promise. Names of functions, parameters and
variables are not: the body is shared between views, and a translated function
name is rejected by the guard as a trouble of its own.

**The list of language tags is CLOSED**, and it is spelled out in the guard's own
«Метки языков» function. Were it open, the typo `zn:` would stop being a view and
become a SEPARATE promise matched against nothing — a silent divergence instead
of a red one. Hence the price, named outright: the separator `": "` in a promise
name means a language tag and nothing else.

What the matching CANNOT do: read the translation. If the Chinese view is named
wrongly while its goal is right, the guard stays silent — it has nothing to judge
WORDS with. It judges what is formal: two views of one promise must promise the
same thing.

## The forgery: the guard must redden

Next to the specs lies `forgery.flang` — a set of deliberately broken catalogues.
The guard must redden on each of them, and on an honest change it must **stay
silent**. A rule that rejects everything looks just as healthy as a working one.

```sh
flang io fspec/forgery.flang --timeout 600000
```

Among the things caught: a rule weakened under the same name; a spec whose
predecessor is missing; a view in another language promising something else than
the main one; a typo in the language tag; a translated function name; one rule
name carrying two different signatures; a closed falsehood in a function without
inputs.

## Today the stand is red, and here is what by

This is the run on 11 September 2026, binary 0.7.17 (commit 2c40752d0; first taken on 8 September with 0.7.14, unchanged since):

```
$ flang io fspec/guard.flang
бед в системе спек: 79
03-urgency-markup.flang: утверждение «скидка с промо не больше 30» функции
«Скидка с промо» доказано у 02-promo.flang, а здесь его нет или оно ослаблено
…
код 1
```

All 79 troubles are of one kind, and they have one cause: **the `check --proof`
report no longer carries the claims of imported modules.** The heir gets a proof
report saying "CHECKED ON ITS OWN", holding only its own claims — while the second
acceptance rule demands that the predecessor's claim be found there.

```
$ flang check fspec/spec/03-urgency-markup.flang --proof
  утверждений 1: доказано 1 (из них без теоремы 1, объявленным типом 1), сетка 0
```

The forgery run answers with "расхождений 7 (подложенных случаев 19)", and six of
the seven follow from the same change: cases waiting for the words "не доказано —
declared" and "ЗАМКНУТА" now get a refusal from the language instead.

The stand does not hide the red: it is recorded in the tree's inventory of checks
(`docs/ci-inventory.md`) with the words "red on the merits", and the repair is
tracked as a task. If you are writing your own specs, keep in mind that in this
state the guard reddens on every heir, not only on your mistake.

## The boundary: what a lone `flang check` does not see

The programs in `experiments/` show where the compiler speaks and where it stays
quiet. The codes were taken on 8 September 2026 with binary 0.7.14 and re-checked on 11 September with binary 0.7.17 (commit 2c40752d0) by
`flang check <file> --proof`:

| program | what is written in it | code |
|---|---|---:|
| `contradiction-without-example.flang` | two mutually unsatisfiable `обеспечивает` on one function | 3 |
| `contradiction-one-function.flang` | the same contradiction plus the author's example | 1 |
| `contradiction-in-requirements.flang` | two mutually unsatisfiable `требует` and a caller | 1 |
| `contradiction-delivery-window.flang` | "no longer than three days" and "no faster than seven", with an example | 1 |
| `contradiction-money-rounding.flang` | "the total is a whole rouble" and "the total ends in fifty kopecks", with an example | 1 |
| `contradiction-return-defect.flang` | two return rules in one function, with an example | 1 |
| `contradiction-tax-theorem.flang` | "the rate is at most 20" and "at least 27", each with a theorem | 1 |
| `contradiction-weight-requirements.flang` | `требует` "heavier than ten" and "lighter than five", plus a caller | 1 |
| `theorem-on-false.flang` | a theorem proving a falsehood | 1 |
| `false-claim-strict-discount.flang` | "a discount strictly lowers the price" — false on a zero order | 1 |
| `false-claim-not-a-number.flang` | the same, but the price is declared `число`: false on "not a number" | 1 |
| `false-claim-negative-zero.flang` | "reversing a zero payment gives zero" — false on minus zero | 1 |
| `spec-legacy.flang` + `spec-new-feature.flang` | a contradiction ACROSS FILES: the heir promises the opposite | 0 and 3 |
| `conflict-cap-legacy.flang` + `conflict-cap-heir.flang` | markup: the new spec demands "at least 50" and calls the old one | 0 and 3 |
| `conflict-rights-legacy.flang` + `conflict-rights-heir.flang` | access: the new one promises the guest has no read left | 0 and 3 |
| `silent-drop-legacy.flang` + `silent-drop-heir.flang` | stock: the heir imports its predecessor **selectively** (`только`) and drops one of its rules | 0 and 0 |
| `superseded-cap-30.flang` + `replacement-cap-45.flang` | **replacing a rule**: a second edition of the cap, with no inheritance | 0 and 0 |

Here is how the table reads.

**The three `false-claim-*` rows are not about provability but about truth.**
Proved ≠ right: the kernel derives what is written, and if a falsehood is
written, it is an example that catches it, not a derivation. Zero, empty, the end
of a range, minus zero and "not a number" cost one example line each — cheaper
than a production run. For "not a number" the kernel now answers outright, with a
diagnostic of its own, `FLANG_BOUND_ON_NAN`, and names the counterexample in
words.

**Code 3 means "NOT CHECKED".** The claim is stated, no proof stands with it, and
the kernel defers it to the runtime. Such a file used to get code 0, and half of
the argument "a lone `flang check` is not enough" rested on that; today it gets a
code of its own, and that half is closed by the language itself.

**The rows with code 0 are what the catalogue is guarded for.** Neither of the
last two cases is a trouble to the compiler, and it is right: a selective import
is a legal form, and replacing a rule is legal work. Telling a silent withdrawal
from an honest replacement apart is possible only by knowing what stood
yesterday — that is, by the snapshot and the acceptance rule, not by checking one
file.

**The kernel is not at fault here, and it does not need fixing.** Consistency of
a set of specs is an acceptance rule on top of the proof report, not a new rule
inside the kernel. That is exactly what `policy.flang` is.

## How to add a spec

1. Put the file in `fspec/spec/` with a number at the front of the name:
   `43-….flang`. The number sets the order in which a human reads the specs.
2. First line — `модуль «Спека 43: …»`. If it builds on one written earlier, the
   second line is `использует «Спека 42: …» из "./42-….flang"`.
3. Write a function with `обеспечивает «name» …`. Word the name so that it reads
   well in a trouble report: that is where it will end up.
4. Run the guard: `flang io fspec/guard.flang`. If a claim came back "declared,
   not proved", either the goal is worded too broadly or the body has nothing to
   carry it; weakening acceptance is not allowed, rewriting the goal or the body
   is.
5. Test the claim by replacing the body with a stub. If it survived, rewrite it:
   what was proved is the signature, not your function.
6. Record the promise in the snapshot: `flang io fspec/snapshot.flang`. Until it
   is there, the guard reddens the spec with the words "not recorded in the
   snapshot".

File names are English words, contents are Russian. Transliteration will not do
in either direction.

## What is not here

| the work | why it is needed |
|---|---|
| a check of **satisfiability**, not derivability | "not proved" ≠ "false". To tell them apart you need a search for a counterexample over a finite grid — then what is found is a falsehood presented as a value, not as silence |
| a spec before the implementation | `обеспечивает` attaches only to a function with a body, and the claim is derived FROM THE BODY. A requirement whose implementation does not exist yet cannot be stated at all |
| a judgement on whether the new goal is WEAKER than the old | the snapshot sees that the goal differs and reddens on any divergence. To tell weakening from strengthening you need an implication between two goals, and the kernel does not derive one |
| running the guard's own examples | the 138 examples <!-- СНЯТО 2026-09-08 примеров-в fspec/guard.flang = 138 --> of `guard.flang` are written and are run by no target at all: the run hits the step limit. A guard nobody knows to be working is no better than a missing one |

The second row is the main open one. A specification without a body cannot be
stated in the language today, and one with a body is already half an
implementation.

A full satisfiability solver (Z3 and the like) does not fit here and will not:
it answers "unsatisfiable" without presenting the value that shows it. Accepting
such an answer would mean taking on the axiom "the external solver does not lie",
and the language has zero axioms. As a hint-giver it is admissible: it searches,
the kernel decides by what it presented.

## What to read next

- [Specs: a proved business rule](fspec.html) — what it is all for, on a
  worked-through example.
- [What is proved and what is not](what-is-proved.html) — numbers over the tree.
- [Which promises the kernel takes](kak-dokazat.html) — which wording the kernel
  will take and which it will defer.
- [The kernel refused: whose mistake is it](proof-refused.html) — the kernel's
  refusal codes.
- [A service for an AI assistant](dlya-ii.html) — how an unproved promise turns
  into a question for the author of the requirement.
