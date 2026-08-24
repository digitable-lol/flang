# Specs: a business rule that is proved

An ordinary specification is prose. It gets written, agreed on, and a month later
the code has moved ahead — and the two part company silently: the document still
reads well, it simply is no longer about this program.

Here a spec is a **program**, so there is nothing to part company with. The rule
sits next to the function, the compiler proves it for **all** inputs rather than
for the ones that showed up in production, and a separate check stops the next
rule from quietly cancelling one already proved.

## What a rule looks like

Here is a spec in full — the whole file, not an extract:

```flang
module «Spec 1: discount cap»

total function «Discount cap»
  takes amount: number
  returns number
  ensures «discount is at most 30» result is at most 30
  example «the cap»
    given amount is 1000
    expected 30
  30
```

Four parts, and each one does work:

| part | what it is | who checks it |
|---|---|---|
| `ensures «name» <goal>` | the rule itself | the compiler proves it for all inputs |
| `requires «name» <condition>` | when the rule applies | whoever calls the function |
| `example … expected …` | a case from life | run on every check of the file |
| `total` | the function always terminates | the compiler proves it itself |

**A claim's name is its identity.** Specs are matched against each other by the
pair "function plus name": rename a claim and the link breaks, and the check says
so.

## Why not just tests

A test answers for the inputs written into it. A proved promise answers for
**all** of them. The difference shows up at the first requirement that arrives
second.

The rule "discount is at most 30" is written and proved. A month later comes "a
promo order gets a bigger discount", and someone writes a second function and a
second spec. The question is not whether the new one works — the question is
whether **the first rule is still true**. With tests you answer that by having
two people read the code. Here it is one command:

```sh
./ярлык спеки:проверка
```

```
specs agree: 42 specs, 295 claims, every one proved from zero axioms
```

"From zero axioms" means nothing was taken on faith: under every claim there is a
chain that reaches the rules of the language itself.

## What stops a spec from lying

A spec that cannot be forged is not a promise but a property, and it is checked
by running it. Next to the specs lives a **forgery set**: cases where a spec is
deliberately spoiled, and the check must go red on every one.

```sh
./ярлык спеки:подлог
```

Among the things it catches: a rule weakened under the same name; a spec with no
predecessor; a translated view promising something the original does not; a typo
in the language tag; a translated function name. There are fourteen cases, and
the check must catch each — while staying **silent** on an honest change,
otherwise it is not catching forgery, it is catching movement.

## A rule in another language is the same rule

A promise can be written in the language of the team that uses it:

```flang
ensures «zh: 折扣不超过 30» result is at most 30
```

This is a real claim, not a note beside one: it gets proved along with the rest.
The subject stays single not by agreement but because the translated goal is
compared with the original character for character. Promise different things and
the check goes red.

The price, named: a colon in a promise's name now means a language tag. And the
limit, named: the check cannot read the translation itself — if the Chinese view
is named wrongly while the goal is right, it stays silent.

## What to read next

- [What is proved](what-is-proved.html) — numbers from the tree, not promises.
- [When a proof is refused](proof-refused.html) — why the kernel refuses and what to do.
- [Clarifying questions](dlya-ii.html) — how an unproved promise turns into a question for whoever wrote the requirement.
- `fspec/README.md` in the tree — the same thing in more detail, with the file layout.
