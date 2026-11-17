# What to read next

In what order should you read the documentation? Below is a route of eight
steps, from installation to your own program with proofs. Each step says what
you can do after it. Steps 1–3 take about half an hour.

## The main route

| Step | What to read | After the step you can |
| --- | --- | --- |
| 1 | [Installation](install.html) | call `flang --version` and get a version |
| 2 | [Your first program](getting-started.html) | write a function with a test, check it (`flang check`) and run it (`flang run`) |
| 3 | [Your first proof](first-proof.html) | write a precondition and a postcondition, read a counterexample, write a proof by induction |
| 4 | [Tutorial](tutorial.html), six chapters with exercises | write functions with a fold, your own types and `match`; fix a `FLANG_NOT_TOTAL` error |
| 5 | [Which construct to use when](which-construct.html), [Operations](operations.html) | move a task you solved in another language to flang |

Instead of step 4 you can take `flangtutor`: twelve lessons in the terminal,
the compiler checks each answer (`flangtutor --lang en`). The program ships
with the prebuilt builds.

## Further, by task

After step 5 the order is free. Choose by what your program needs.

| Task | What to read | After the step you can |
| --- | --- | --- |
| familiar loops and classes | [Loops, classes, interfaces](surface-sugar.html) | write a loop and a class and know what they are rewritten into |
| more proofs | [How to read the proof report](how-proofs-work.html), [Theorems step by step](manual-proofs.html), [The compiler rejected a proof](proof-refused.html) | read the whole output of `flang check --proof` and fix a theorem from a `FLANG_PROOF_…` message |
| files, network, processes | [The boundary between flang and the host](host-boundary.html), [Processes and supervision](processes.html), [Databases](database.html) | read a file from a program with `flang io` |
| code in another language | [Generating C and JavaScript](emit-walkthrough.html), [Embedding in another program](embedding.html), [Modules and packages](packages.html) | generate a project with `flang emit` and build it |

## Reference pages

You return to these as needed: [Language constructs](language.html),
[Commands](cli.html), [Error codes](diagnostics.html),
[Known limitations](limits.html).

## If you are stuck

| What you need | Command |
| --- | --- |
| see the errors of a file | `flang check file.flang` |
| see what is proved | `flang check file.flang --proof` |
| see all commands | `flang --help` |

An error message starts with a code: `FLANG_TYPE`, `FLANG_NOT_TOTAL`,
`FLANG_PROOF_INDUCTION_STEP`. Codes starting with `FLANG_PROOF_` are explained
in [The compiler rejected a proof](proof-refused.html), the rest in the
[error code reference](diagnostics.html). Install and start-up errors are on
the page [If it does not work](troubleshooting.html).
