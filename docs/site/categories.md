# The categorical surface

This page shows which words flang gives you beyond functions and types — monoid,
monad, functor, category, isomorphism — and what exactly the compiler does with
them. By the end you can declare a monoid on your own task, read someone else's
declaration, and know precisely which part of the promise is checked and which
is not.

## What it is for

An ordinary function says *what* it computes. A structure declaration says what
is **always true** about it — and thereby makes a claim someone can be held to.

Addition of numbers is not merely a two-argument function: it is an operation
with a unit, it is associative, and every value has an inverse. String
concatenation is the same, minus the inverse — and promising one would be a lie.
Both facts are written in one form:

```flang
моноид «Сумма»
  носитель число
  операция «Сложить»
  единица 0
  обратный элемент «Обратить»

моноид «Склейка»
  носитель строка
  операция «Склеить»
  единица ""
```

There is deliberately no separate word for "group": a group is a monoid with an
inverse, and a second word would split two checks that must agree in everything
but one law.

A monad is declared just as briefly — by a type name and two functions:

```flang
монада «Возможно» от «А»
  возврат «Обернуть»
  соединение «Сплющить»
```

## What is proved here and what is merely checked

The difference between these two lists is the whole point of the surface, and
mixing them is not allowed.

**Proved by comparing declarations** — if it does not add up, the file does not
build:

- the monoid operation takes two carrier values and returns a carrier;
- the unit is a value of the carrier;
- the inverse maps the carrier into the carrier;
- a monad names `возврат` and `соединение`, and the monad's name is the name of
  a type it is a monad in, by its first parameter.

**Checked on a grid of values** — that is, by running, not by proving:

- associativity, neutrality, invertibility. The grid is assembled from the
  operation's own examples, and the claim holds exactly on it.

"Checked on three values" is not "proved". Laws accepted with no check at all:
{{законы.наВеру}}.

## What can be run today

A worked example on a real task — summing a column of numbers, summing a column
of labels, and a chain of lookups any of which may find nothing:

```bash
flang test  flang/examples/cat/monoid-and-monad.flang
flang check flang/examples/cat/monoid-and-monad.flang
```

The first answers "примеров 20, прошло 20, не прошло 0". The second answers with
exit code 2 and this:

```
проверено НЕ ВСЁ: в программе объявлено то, чего бинарник не судит вовсе —
monoids, monads.
```

## The border, and today it is the main one

**The binary compiler does not judge the categorical surface at all.** It parses
these declarations and checks types, termination and examples — but skips the
rules of the surface itself, and **says so in words** instead of going green in
silence. It names the unjudged list itself: morphism, category, module link,
bifunctor, transformation, isomorphism, monoid, monad, sets, declared
properties, requirements.

They were judged by separate tooling written in JavaScript; that tooling was
removed from the tree together with the second implementation of the language,
and there is no new judge for the surface yet. So, plainly: **you can declare a
structure today, but you cannot get it checked.**

The same border is why the `в монаде` form — writing a chain without manual
binding — appears nowhere in the tree's examples even though monads are
declared. Expanding that form lived in a separate layer, and it was not carried
into the binary compiler.

## The surface contract is a draft, and says so itself

The full description of the surface — `flang/cat/SPEC.md`, some fifteen hundred
lines — calls itself a draft for approval in its very first line. Beside it lie
analyses of individual pieces: `HOF.md`, `POLY.md`, `MONAD.md`, `SETS.md`,
`ZAKONY.md`.

These are working documents: next to a rule of the language stands a discussion
of why the rule is what it is, and the mark "declared, not done" appears there
as often as "done". They are worth reading if you want to argue about how the
surface should work, not if you want to use it; on this site they now sit behind
the [for contributors](contributing.html) door and have gone nowhere.

## Where to go next

- [What is proved and what is not](what-is-proved.html) — the same border drawn
  across the whole language.
- [Processes, supervision, distribution](processes.html) — the second surface,
  with exactly the same border.
- [How to keep learning the language](learning.html) — where this page sits on
  the road.
