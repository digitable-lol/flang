# What to read next

A reading order from installation to a program of your own. On the right is
the command or the sign that shows the step is done.

| Step | What to read | The step is done when |
| --- | --- | --- |
| 1. Install | [Installation](install.html) | `flang --version` answers with a version |
| 2. First program | [Your first program](getting-started.html) | you wrote a file, checked it and ran a function |
| 3. The basics | [Tutorial](tutorial.html), six chapters with exercises | you can read a `FLANG_NOT_TOTAL` refusal and know what to fix |
| 4. Familiar forms | [Loops, classes, interfaces](../guide/surface-sugar.md) | you know what a loop expands into |
| 5. A task of your own | [Which construct to use when](which-construct.html), [Operations](operations.html) | a task you solved before in another language passes `flang check` and `flang test` |
| 6. Proofs | [Why and how](proofs.html), [How a proof works](how-proofs-work.html), [The kernel refused: whose error is it](proof-refused.html) | you tell «доказано» (proved) from «сетка N» (examples only) in the output of `flang check --proof` |
| 7. Files, network, processes | [Where flang ends and the host begins](host-boundary.html), [Processes and supervision](processes.html), [Databases](database.html) | your program reads a file through `flang io` |
| 8. Code in another language | [Embedding flang in another program](embedding.html), [Modules and packages](packages.html) | `flang emit` prints your program, and it builds |

Reference pages to come back to: [Language reference](language.html),
[Command reference](cli.html), [Refusal reference](diagnostics.html),
[Glossary](../glossary.html), [Known limitations](limits.html).

## If you are stuck

```bash
flang check file.flang          # what did not match
flang check file.flang --proof  # what is proved and what is not
flang --help                    # every command
```

A refusal starts with a code: `FLANG_TYPE`, `FLANG_NOT_TOTAL`,
`FLANG_PROOF_INDUCTION_STEP`. The `FLANG_PROOF_` codes are explained on the
page [The kernel refused: whose error is it](proof-refused.html), the rest in
the [Refusal reference](diagnostics.html).
