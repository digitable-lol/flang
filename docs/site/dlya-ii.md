# flang and AI: a language where an assistant has nothing to bluff with

A model writes code quickly and confidently. The problem is not the speed but
that the confidence rests on nothing: "this function is correct" is a sentence,
not a fact, and there is usually nothing to check it against except tests written
by the same model for the same inputs.

flang is shaped so that confidence is checked by a machine rather than conveyed
by tone.

## Three things that are usually missing

**A promise is checked, not read.** Next to a function stands `ensures` — a claim
about the result. The compiler **proves it for all inputs** or refuses the file.
An assistant cannot declare a function correct; it can only write a promise that
either proves or does not. The answer is binary and comes from the compiler.

**Termination is proved.** The word `total` is a promise that the function
terminates on every input, and the compiler checks it itself. An infinite loop
the model failed to notice does not pass here.

**Examples live inside the function** and run on every check of the file. They
cannot be forgotten and cannot drift away from the code.

## A service for the assistant

The binary speaks the model conversation protocol:

```sh
flang --mcp-mode
```

It is JSON-RPC over standard streams, one message per line, started by the
assistant rather than a human. What the assistant gets back is not prose to read
but answers backed by a compiler run: proved or not, and if not, why.

An unknown tool is reported as an error naming the real ones rather than passed
over in silence; a promise that does not exist is named. In other words, it makes
mistakes visible.

## A question instead of a guess

The expensive part of working from requirements is not writing the code, it is
seeing what the requirement does not say. This is normally where an assistant
**guesses** and moves on.

Here the question is **computed**. The clarification tool
(`fspec/utochneniya.flang`) takes the proof kernel's verdict and the shape of the
goal and derives from them a question for whoever wrote the requirement. A census
across the whole library:

| | |
|---|---|
| promises | 491 |
| unproved | 386 |
| of those, turned into a question | 112 |
| of the rest, the tool says it has nothing to ask | 285 |

Twenty-nine percent of the unproved turns mechanically into a meaningful
question. The more important half is the other one: for the rest the tool does
**not invent** a question, it says honestly that it does not know. Eight files
were not measured at all — and there too it answers with a refusal rather than a
zero in the table.

The loop was checked by three runs: a coarse requirement yields one question; the
right answer yields "2 of 2 proved, exit 0"; a wrong one yields "violated, exit
1". The right answer also found an error in the requirement itself: with the old
body the promise was false.

## A rule in the team's own language

A promise can be written in the language the customer speaks:

```flang
ensures «zh: 折扣不超过 30» result is at most 30
```

This is not a note but a full claim: it is proved along with the rest, and the
translated goal is compared with the original character for character. For an
assistant that means carrying a requirement in the customer's language without
losing checkability.

More in [Specs: a business rule that is proved](fspec.html).

## What the service cannot do yet

It answers two of four questions. "What breaks if I change this" and "do these
requirements agree with each other" both need starting a process from the
service loop, and today's loop handles one effect. This is written into the
service's own tool listing: a listing without the gaps reads as "we can do
everything", which is untrue.
