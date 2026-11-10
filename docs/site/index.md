# flang — a language whose compiler proves properties of your program

flang is a pure functional language with static types. You write what a
function promises, and the compiler proves it for every input — or says
plainly that it could not.

```flang
module «Example»

total function «Sum»
  accepts items: list of nat
  returns number
  ensures «the sum is non-negative» result is at least 0
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
$ flang check sum.flang
модуль «Example»: функций 1, из них с доказанным завершением 1; типов 0
sum.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет

$ flang run sum.flang --function Sum --args '{"items": [1, 2, 3]}'
доказано: утверждений 1
6
```

The compiler prints its messages in Russian. The first answer says: one
function, termination proved, no remarks. The second: one statement proved,
value `6`.

What happened here:

- `total` — the compiler proved that the function terminates: the recursion
  goes down the tail of the list.
- `ensures` — proved by induction over the list. A sum of non-negative numbers
  is non-negative for every list, not only for `[1, 2, 3]`.
- `example` — a test inside the function; it runs on every check.

Replace `plus` with `minus` and remove the example. The promise becomes false,
it cannot be proved, and `run` refuses to compute, exit code 3:

```
не доказано: утверждений 1: доказано 0, сетка 0, на веру 1 — запуск только по явному согласию: --на-веру
```

[Open the example in the playground](playground.html#text=bW9kdWxlIMKrRXhhbXBsZcK7Cgp0b3RhbCBmdW5jdGlvbiDCq1N1bcK7CiAgYWNjZXB0cyBpdGVtczogbGlzdCBvZiBuYXQKICByZXR1cm5zIG51bWJlcgogIGVuc3VyZXMgwqt0aGUgc3VtIGlzIG5vbi1uZWdhdGl2ZcK7IHJlc3VsdCBpcyBhdCBsZWFzdCAwCiAgZXhhbXBsZSDCq29uZSwgdHdvLCB0aHJlZcK7CiAgICBnaXZlbiBpdGVtcyBlcXVhbHMgWzEsIDIsIDNdCiAgICBleHBlY3RlZCA2CiAgbWF0Y2ggaXRlbXMKICAgIGNhc2UgZW1wdHkKICAgICAgdGhlbiAwCiAgICBjYXNlIGhlYWQgaCBhbmQgdGFpbCB0CiAgICAgIHRoZW4gaCBwbHVzICjCq1N1bcK7IG9mIHQpCg) — in the
browser, with nothing to install. Or install it with one command:

```bash
curl -fsSL https://raw.githubusercontent.com/digitable-lol/flang/main/install.sh | sh
```

After that `flang --version` answers `flang {{выпуск.версия}}`. Homebrew, asdf,
deb, rpm and building from source are on the [Installation](install.html) page.

## What the language has

| You write | What the compiler does |
| --- | --- |
| `total` | proves that the function terminates; if it cannot, the file is rejected |
| `requires` | checks the condition at every call site and on the input of `flang run` |
| `ensures` | proves the promise for every input; each promise gets one of three verdicts: «доказано» (proved), «сетка N» (examples only), «объявлено, не доказано» (declared, not proved) |
| `example` | runs it as a test on every check |
| `theorem` | checks a proof written step by step |
| `цикл`, `класс`, `интерфейс` (loop, class, interface; Russian spelling only) | expands them into folds, records and functions, and checks the expansion |

Values are immutable. Functions have no side effects: when a program needs a
file, the network or the screen, it returns an order as data, and `flang io`
carries it out.

One program is printed into {{цели.поАнглийски}} languages: {{цели.список}}. Proved
checks do not reach the printed code.

Keywords are words, not symbols, and each has a Russian and an English
spelling. The flang compiler is written in flang and builds itself.

## Where to go next

| You want to | Read |
| --- | --- |
| write and run a first program | [First program](getting-started.html) |
| go through the language in order | [Tutorial](tutorial.html) |
| understand what "proved" means | [Proofs: why and how](proofs.html) |
| find a construct or a command | [Language constructs](language.html), [Commands](cli.html), [Refusal codes](diagnostics.html) |
| see what is already written | [Library reference](stdlib.html), [Example catalogue](examples.html) |
| get code in your own language | [Print a program to C and JavaScript](emit-walkthrough.html) |
| learn the limits | [What is proved and what is not](what-is-proved.html), [Known limitations](limits.html) |
