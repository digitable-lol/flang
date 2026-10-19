# Russian grammar as a pregroup

This page shows how to check in flang whether a Russian sentence is
grammatical. Every word has a type, the types are multiplied, and the sentence
is grammatical when the product reduces to the single type `s`, "sentence".
This is Lambek's pregroup grammar. The program lives in `flang/ct/russian/`;
the decision and the literature are in ADR-0109.

## Check a sentence

One command:

```
$ flang run flang/ct/russian/parse.flang --function «Разобрать» --args '{"предложение":"Мама читает книгу."}'
доказано: утверждений 12
"грамматично: мама: n[им ж ед 3]; читает: n[им ед 3]ʳ · s · n[вин]ˡ; книгу: n[вин ж ед 3]; связи: мама—читает, читает—книгу"
```

("Mum reads a book.") The answer names the type chosen for each word and the
pairs of words whose types cancelled (`связи`). Capital letters and the full
stop do not matter. The answer is in Russian, like the data: `грамматично`
means grammatical, `не грамматично` means not.

Word order is free, as in Russian:

```
$ flang run flang/ct/russian/parse.flang --function «Разобрать» --args '{"предложение":"книгу мама читает"}'
доказано: утверждений 12
"грамматично: книгу: n[вин ж ед 3]; мама: n[им ж ед 3]; читает: n[им ед 3]ʳ · n[вин]ʳ · s; связи: мама—читает, книгу—читает"
```

An ungrammatical sentence gets a reason:

```
$ flang run flang/ct/russian/parse.flang --function «Разобрать» --args '{"предложение":"мама читает книга"}'
доказано: утверждений 12
"не грамматично: неверный падеж"
$ flang run flang/ct/russian/parse.flang --function «Разобрать» --args '{"предложение":"мама читают книгу"}'
доказано: утверждений 12
"не грамматично: нет согласования по роду, числу или лицу"
$ flang run flang/ct/russian/parse.flang --function «Разобрать» --args '{"предложение":"мама книгу"}'
доказано: утверждений 12
"не грамматично: нет сказуемого"
$ flang run flang/ct/russian/parse.flang --function «Разобрать» --args '{"предложение":"мама шьёт"}'
доказано: утверждений 12
"не грамматично: неизвестное слово «шьёт»"
```

The reasons are: wrong case; no agreement in gender, number or person; no
predicate; unknown word. A fifth one, `типы слов не сводятся к s`, means the
types do not reduce to `s` for any other reason.

Each run takes about 3.7 seconds; most of it is checking the program itself
before it runs.

## How to read a type

| Written | Meaning |
| --- | --- |
| `n[им ж ед 3]` | noun phrase: nominative, feminine, singular, third person |
| `n[вин]` | noun phrase in the accusative, nothing else matters |
| `s` | sentence |
| `aʳ` | waits for `a` on the left: `a · aʳ` cancels |
| `aˡ` | waits for `a` on the right: `aˡ · a` cancels |

A feature missing from the brackets does not matter. `n[им ж ед 3]` fits
where `n[им ед 3]` is expected, `n[им ж мн 3]` does not. That is how agreement
is checked.

## Add a word

The dictionary is `flang/ct/russian/lexicon.flang`. A noun is written as its
form and a list of "case gender number":

```flang
«Существительное» от "книгу" и ["вин ж ед"]
```

A form that reads several ways has several readings:

```flang
«Существительное» от "книги" и ["род ж ед", "им * мн", "вин * мн"]
```

A verb is written as what it waits for. The program builds the types for every
word order itself:

```flang
«Переходный» от "читает" и («Подлежащее настоящего» от "ед" и "3") и "вин"
«Непереходный» от "спала" и («Подлежащее прошедшего» от "ж" и "ед")
```

`«Типы слова»` shows the types a word got. A function name of two words is
quoted for the shell:

```
$ flang run flang/ct/russian/parse.flang --function '«Типы слова»' --args '{"слово":"читает"}'
доказано: утверждений 12
"s · n[им ед 3]ˡ; n[им ед 3]ʳ · s; s · n[вин]ˡ · n[им ед 3]ˡ; n[им ед 3]ʳ · s · n[вин]ˡ; n[вин]ʳ · n[им ед 3]ʳ · s; s · n[им ед 3]ˡ · n[вин]ˡ; n[вин]ʳ · s · n[им ед 3]ˡ; n[им ед 3]ʳ · n[вин]ʳ · s"
```

Eight types: two without an object ("mum reads", "reads mum") and six for
each order of subject, verb and object. "книги" has three types, one for each
reading of the form:

```
$ flang run flang/ct/russian/parse.flang --function '«Типы слова»' --args '{"слово":"книги"}'
доказано: утверждений 12
"n[род ж ед 3]; n[им мн 3]; n[вин мн 3]"
```

## What is checked and what is not

- **Proved** for all inputs: adjoints and multiplication of types keep the
  length they should, and one contraction never makes a type longer. See
  `flang check flang/ct/pregroup.flang --proof`: 10 of 10 proved (the module is shared with the English grammar since ADR-0166).
- **Counted on examples:** the pregroup laws — associativity of
  multiplication, `(aˡ)ʳ = a`, `aˡ · a → 1` — in
  `flang/ct/russian/category.flang`. These are examples, not a proof.
- **Checked by probes:** 71 sentences, 36 grammatical and 35 not. Run:
  `flang io flang/proof/probes/russian-grammar/run.fscript --plan Binary`.
- **Checked by nothing:** that the dictionary is right and that the reason
  given is the one a person would give.

What the grammar cannot do yet: adverbials in the middle of a sentence
("мама в доме читает"), sentences without a verb ("кошка на столе"), the
instrumental case, questions, "и" (and) and subordinate clauses. The list is in
ADR-0109.

## Where next

- [The category surface](categories.html) — what the compiler does with a
  declared category and monoid.
- [What is proved and what is not](what-is-proved.html) — the same boundary
  across the whole language.
