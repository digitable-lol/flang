# Playground

Here flang checks a text right in the tab: a syllogism written in words, or a flang
program with statements, theorems and postconditions. The compiler with its proof kernel
is built to WebAssembly and runs in the browser; nothing is sent to a server, and the
"Share" link carries the text in the address after `#`, which the browser does not send
to the server.

```playground
The playground needs JavaScript and a browser with WebAssembly. Without them the same
checks are done by the binary compiler: flang check file.flang --proof.
```

## What becomes what

The playground decides what it is looking at by the first word of the text.

- A text that starts with `модуль` or `категория` is a flang program. `flang check
  --proof` checks it and prints the proof ledger, as in a terminal.
- Any other text is reasoning in Russian: a dictionary (`Понятие:`, `Свойство:`,
  `Имя:`), premises and a conclusion after the word «Следовательно». The translator
  `flang/proof/probes/syllogism/sentences/translator.flang` builds a program from it, the
  kernel judges it with `--proof --strict`, and the answer comes in the judge's words:
  «СЛЕДУЕТ» (follows) or «НЕ СЛЕДУЕТ» (does not follow) with a counterexample.

After the kernel, the playground hands the proof record to the checker
(`flang/proof/checker/checker.c`), built as a separate WebAssembly module, and prints its
answer next. A statement the checker replayed rests on more than the kernel's word.

## Examples

Syllogism Barbara: the conclusion follows from the premises.

```text playground Barbara syllogism — follows
Понятие: человек, люди.
Понятие: грек, греки.
Свойство: смертен, смертны.

Все люди смертны. Все греки — люди. Следовательно, все греки смертны.
```

Affirming the consequent: from "all men are mortal" and "Socrates is mortal" it does not
follow that Socrates is a man. The kernel does not derive the goal, the judge names a
counterexample.

```text playground Affirming the consequent — does not follow
Понятие: человек, люди.
Свойство: смертен, смертны.
Имя: Сократ.

Все люди смертны. Сократ смертен. Следовательно, Сократ — человек.
```

A statement about your own type, proved by induction.

```flang playground Statement with a theorem — induction on a type
модуль «Своё натуральное»

тип «Нат»
  вариант «Ноль»
  вариант «Следующий» содержит пред: «Нат»

тотальная функция «К числу»
  принимает н: «Нат»
  возвращает число
  разбор н
    случай вариант «Ноль»
      то 0
    случай вариант «Следующий» с пред как п
      то («К числу» от п) плюс 1

утверждение «шаг растит счёт на один»
  для всех н: «Нат»
  утверждаем («К числу» от (вариант «Следующий» с пред равным н)) равно ((«К числу» от н) плюс 1)

теорема «шаг растит счёт на один»
  дано н: «Нат»
  утверждаем («К числу» от (вариант «Следующий» с пред равным н)) равно ((«К числу» от н) плюс 1)
  индукция по н
    случай вариант «Следующий» с пред как п
      то по предположению
  следовательно доказано
```

A function with a postcondition: the `обеспечивает` promise is proved for every input.

```flang playground Function with a postcondition
модуль «Привет»

тотальная функция «Удвоить»
  принимает н: неотрицательное
  возвращает число
  обеспечивает «удвоенное не меньше исходного» результат не меньше н
  пример «дважды два»
    дано н равно 2
    ожидается 4
  н плюс н
```

A false statement: at `н = 0` doubling is not greater than the original. The ledger says
«объявлено, не доказано» (declared, not proved), the verdict is «НЕ ПРОВЕРЕНО» with code 3.

```flang playground False statement — not proved
модуль «Ложное»

утверждение «удвоение всегда больше»
  для всех н: неотрицательное
  утверждаем (н плюс н) больше н
```

Blocks of flang programs on the other documentation pages carry a "run in the
playground" link: it opens this page with the block's text in the address.

## How it is built

| what | where | built by |
|---|---|---|
| compiler with the kernel | `playground/flang.wasm` | `bootstrap/*.c`, `clang --target=wasm32-wasi` |
| checker | `playground/checker.wasm` | `flang/proof/checker/checker.c`, the same `clang` |
| reasoning translator | `playground/reasoning.js` | `bootstrap/flang emit --target js` |
| library | `playground/library.tar` | `flang/stdlib/*.flang` and `flang/core/*.flang` |
| WASI host and playground | `playground/flang_host_browser.js` | `flang/src/emit/js/flang_host_browser.js` |

All five files are built by a step of the site build (`bootstrap/flang run-script
playground:build`); they are not in the tree. The WASI host keeps a file system in the
tab's memory: the user's source, the library (downloaded only when the text has
`использует`) and a temporary directory `/tmp`. The compiler and the checker run in a
separate thread (a Web Worker), so the page does not freeze.

The same host runs under Node, without a browser:

```sh
node flang/src/emit/js/flang_host_browser.js docs/site/out/playground "$(cat text.txt)"
```

Its exit code is the check's: 0 — follows or proved, 1 — does not follow, 3 — not proved.

This is how the site build probes the playground (`bootstrap/flang run-script
playground:probe`, the plan `scripts/site/playground-probe.fscript`): Barbara must
follow and the checker must agree with the record; affirming the consequent must give
«НЕ СЛЕДУЕТ» with code 1; the false statement must give «НЕ ПРОВЕРЕНО» with code 3 and
no «ДОКАЗАНО» at all.

## What the playground does not have

- **Processes.** WebAssembly has no `fork` and `exec`, so the compiler cannot call the
  checker itself and prints «НЕЗАВИСИМО НЕ ПРОВЕРЕНО этим модулем» (not independently
  checked by this module); the host calls the checker next, as a second module.
- **Network and the machine's files.** There are no sockets; files live only in the
  tab's memory.
- **Checking imports.** For a program with `использует` the checker needs the records of
  the imported modules (`--зависимость`); the playground does not build them, and the
  checker answers with code 1.
- **A 64-bit address.** The module is built for `wasm32`: memory is at most 4 GiB, and the
  built-in step limit 8·10¹² does not fit a 32-bit `size_t` and becomes 2 770 894 848 —
  `clang` warns about it during the build.
