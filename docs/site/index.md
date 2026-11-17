# flang — a language whose compiler proves the postconditions of functions

flang is a pure functional language with static types. Next to a function you
write a condition on its result — a postcondition. The compiler proves it for
every input or reports that there is no proof.

File `sum.flang`:

```flang
module «Example»

total function «Sum»
  accepts items: list of nat
  returns number
  ensures «the sum is not negative» result is at least 0
  example «one, two, three»
    given items equals [1, 2, 3]
    expected 6
  match items
    case empty
      then 0
    case head h and tail t
      then h plus («Sum» of t)
```

```bash
flang check sum.flang
```

```text
модуль «Example»: функций 1, из них с доказанным завершением 1; типов 0
sum.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
```

Exit code 0. The compiler writes its messages in Russian. The first line reads
"module «Example»: 1 function, 1 of them proved to terminate; 0 types". The
second lists the checks that passed: syntax, types, termination, proofs and
tests, and ends with "no errors".

```bash
flang run sum.flang --function Sum --args '{"items": [1, 2, 3]}'
```

```text
доказано: утверждений 1
6
```

The first line reads "proved: 1 postcondition". The second is the result.

What the compiler did:

- `total` — it proved that the function terminates: the recursion goes down
  the tail of the list, and the tail is shorter than the list.
- `ensures` — it proved the postcondition by induction on the list. It holds
  for every list of non-negative numbers; `[1, 2, 3]` is one case.
- `example` — it ran the test written inside the function. Tests run on every
  check.

Replace `plus` with `minus` in `sum.flang` and check again:

```bash
flang check sum.flang
```

```text
модуль «Example»: функций 1, из них с доказанным завершением 1; типов 0
FLANG_EXAMPLE: пример «one, two, three» функции «Sum»: FLANG_PROPERTY: нарушено свойство «the sum is not negative» функции «Sum»
sum.flang: не проверено — замечаний 1
```

Exit code 1. The second line reads "example «one, two, three» of function
«Sum»: postcondition «the sum is not negative» is violated": for the tail
`[2, 3]` the function returned −1. The last line reads "not checked — 1 error".
`flang run` does not run such a file.

[Open the example in the playground](playground.html#text=bW9kdWxlIMKrRXhhbXBsZcK7Cgp0b3RhbCBmdW5jdGlvbiDCq1N1bcK7CiAgYWNjZXB0cyBpdGVtczogbGlzdCBvZiBuYXQKICByZXR1cm5zIG51bWJlcgogIGVuc3VyZXMgwqt0aGUgc3VtIGlzIG5vbi1uZWdhdGl2ZcK7IHJlc3VsdCBpcyBhdCBsZWFzdCAwCiAgZXhhbXBsZSDCq29uZSwgdHdvLCB0aHJlZcK7CiAgICBnaXZlbiBpdGVtcyBlcXVhbHMgWzEsIDIsIDNdCiAgICBleHBlY3RlZCA2CiAgbWF0Y2ggaXRlbXMKICAgIGNhc2UgZW1wdHkKICAgICAgdGhlbiAwCiAgICBjYXNlIGhlYWQgaCBhbmQgdGFpbCB0CiAgICAgIHRoZW4gaCBwbHVzICjCq1N1bcK7IG9mIHQpCg) — in the browser, nothing to install.
Or install `flang` on your machine with one command:

```bash
curl -fsSL https://raw.githubusercontent.com/digitable-lol/flang/main/install.sh | sh
```

After that `flang --version` answers `flang {{выпуск.версия}}`. Homebrew, asdf,
deb, rpm and building from source are on the [Installation](install.html) page.

## What the language has

| You write | What the compiler does |
| --- | --- |
| `total` | proves that the function terminates; if it cannot, the file fails the check |
| `requires` | checks the precondition at every call site and on the input of `flang run` |
| `ensures` | proves the postcondition for every input; if it cannot, it reports that the postcondition is only tested or not checked at all |
| `example` | runs it as a test on every check |
| `theorem` | checks a proof written step by step |
| `цикл`, `класс`, `интерфейс` (loop, class, interface; Russian spelling only) | rewrites them into folds, records and functions, and checks the result |

Values are immutable. Functions have no side effects. When a program needs a
file, the network or the screen, a function returns an effect — a description
of the action as data. The command `flang io` performs the effects.

One program is compiled to code in {{цели.поАнглийски}} languages: {{цели.список}}.
The generated code has no checks for proved postconditions.

Keywords are words, and each has a Russian and an English spelling. The flang
compiler is written in flang and builds itself.

## What it is for and how it differs

flang fits logic where a mistake is expensive: calculations, format parsing,
access rules. You write it in flang, prove it and generate a library from it.

| Compared with | How flang differs |
| --- | --- |
| Dafny | the same preconditions and postconditions, but no SMT solver: the compiler applies a fixed set of rules, and the rest you prove with a step-by-step theorem |
| Lean, Coq | it checks programs and is not built for mathematics; there are no tactics and no automatic proof search |
| Rust | Rust checks memory ownership with types; flang proves termination and conditions on values, and has no mutable state |

A separate program re-checks the proofs, so far only some of them: it does not
re-check the proof from the example above, and the `flang check --proof` report
says so. The syntax may change before version 1.0. Details:
[What is proved and what is not](what-is-proved.html).

## Where to go next

| You want to | Read |
| --- | --- |
| write and run a first program | [Your first program](getting-started.html) |
| let the compiler find a bug, then prove a function | [Your first proof](first-proof.html) |
| go through the language in order | [Tutorial](tutorial.html) |
| choose what to read after that | [What to read next](learning.html) |
| find a construct or a command | [Language constructs](language.html), [Commands](cli.html), [Error codes](diagnostics.html) |
| see finished programs | [Library reference](stdlib.html), [Example catalogue](examples.html) |
| get code in your own language | [Generating C and JavaScript](emit-walkthrough.html) |
| learn the limits | [What is proved and what is not](what-is-proved.html), [Known limitations](limits.html) |
