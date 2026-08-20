[Back to README](../../README.md) · [Documentation index](../README.md)

# What `тотальная` buys you

Turing completeness and guaranteed termination are incompatible, so flang does not choose: it
splits programs into two classes and has the compiler decide which one you are in.

|                              | `тотальная`                     | plain                      |
|------------------------------|----------------------------------|----------------------------|
| recursion                    | decreasing: by value part or by numeric measure | any         |
| termination                  | proven by the compiler           | not guaranteed             |
| its examples                 | are guaranteed to finish         | may need a step limit      |
| accepted by the fact-checker | yes                              | no                         |

`тотальная` requires every recursive call to receive a decreasing argument, and two kinds of
decrease are accepted: structural — the tail of a list, a field of a variant or a record — and
numeric, by measure. A measure is `н минус <number>` provided the parameter is bounded from below
at the call site by an inequality check (`если н не больше 0`). Both conditions are required:
without a constant step the chain may not decrease at all, without a floor it runs to minus
infinity. A PARAMETER also works as the step (`н минус ш`) — provided it arrives in the call
unchanged in its own position and is known to be strictly `ш больше 0`: the same number is then
subtracted along the whole chain. Without the strict bound the step may be zero, and a changing
step never reaches the floor at all — `ш`, `ш делить на 2`, … add up to less than `2ш`. If the analysis cannot prove it, you get `FLANG_NOT_TOTAL` and the file does not
compile.

Counting UP is not a measure and stays out of the total class: `«Числа от и до» от 1 и н` grows
the start, and the end is a parameter rather than a number, so it cannot serve as a floor. String
code crossed the border earlier and differently: the built-in form `разложить … на символы` turns
a string into a list of one-character strings by code points, and the walk becomes recursion over
a tail. `flang/examples/rosetta/reverse-string.flang` is total throughout because of it, emoji and
Cyrillic included.

This is not pedantry, and the reason is concrete. The embedded fact-checking mode
([`flang/self/factcheck.flang`](../../flang/self/factcheck.flang)) answers "does this claim hold about this
data" — and a system that must answer yes or no is not allowed to hang. So it refuses to run a
function that was not proven to terminate, before evaluating anything — `flang facts` answers with
`holds: false` and says why. The mode has no file, network or clock access, and a hard step budget:
the answer depends only on `(program, facts, claims, limits)`.

## A service is total by construction, and that is a type check, not a convention

An ordinary server is one non-terminating program, and there is nothing to prove
about it. In flang it is taken apart differently: **an infinite sequence of
terminating turns**. The scheduler is infinite; the handler it calls must
terminate.

This is not a wish in the documentation but a refusal from the type checker. A
handler that is neither marked `тотальная` nor names a fuel bound does not let
the program through: code `FLANG_HANDLER_NOT_TOTAL`, severity **error**, not
warning, and the message names what is missing — "с запасом". Name the bound and
the program is accepted, but then `надзор` becomes mandatory, otherwise
`FLANG_UNCOVERED_FAILURE`: a failure nobody catches does not pass either.

This rule is about the `процесс` declaration, and process declarations are not
judged by the binary compiler at all: it says so in words and answers with exit
code 2. They were judged by separate tooling written in JavaScript and removed
together with the second implementation of the language; there is no new judge
yet. So the severity cannot be demonstrated today — the rule is written down, its
check is waiting to be moved over.

