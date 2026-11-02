# Playground

Here flang checks a text right in the tab: a syllogism written in words, a formula with
the quantifiers ∀ and ∃, or a flang program with statements, theorems and laws. The
compiler with its proof kernel is built to WebAssembly and runs in the browser; nothing
is sent to a server, and the "Share" link carries the text in the address after `#`,
which the browser does not send to the server.

```playground
The playground needs JavaScript and a browser with WebAssembly. Without them the same
checks are done by the binary compiler: flang check file.flang --proof.
```

## What you see

The editor highlights language words, strings, numbers, names in «guillemets» and
comments; line numbers are on the left. The line where the compiler found an error is
marked both in the text and in its number.

Reasoning and formulas get their own highlighting. In reasoning the editor marks the
connectives («все», «некоторые», «ни один», «не», «следовательно», «значит», «если … то»
— all, some, no, not, therefore, so, if … then), the terms — words of the dictionary
and of the sentences, the names (the `Имя:` line and capitalised words that do not open
a sentence) and the dictionary headings. In a formula it marks the quantifiers, signs
and LaTeX commands, the sets ℕ, ℤ, ℚ and the variables. Which highlighting to use is
decided by the same rule that picks the check (next section), so the colour in the
editor always tells how the text will be checked.

The answer is split into six tabs.

- **Result** — one line about what matters and the list of statements with marks:
  - "Proved for all values" — every statement holds for every input, not only for the
    examples written;
  - "Checked on examples only" — no violations were found, but for the other values this
    is not a proof;
  - "Does not follow: here is a counterexample" — an input on which the statement is
    false;
  - "Not proved" — a statement has neither a proof nor examples;
  - "Error on line N" — the line is marked in the editor, and the button with its number
    puts the cursor there.

  Under the result, the details are folded: what the independent proof check said, and
  the full compiler output as in a terminal.
- **Formulas** — every statement of the program as a typeset formula, with its LaTeX
  source folded below it. KaTeX does the typesetting, and the site serves it itself, from
  no third-party address. If it did not load, the formula stays in plain quantifier
  notation.
- **flang → language** — the same program printed by `flang emit` into C, C++, Go, Rust,
  Java, JavaScript, TypeScript, Elixir, Python and C#. The same compiler in the tab does
  the printing. The program's files are shown; runtime files are copied into the output
  as they are, and only their names are listed here. If the editor holds a formula or a
  reasoning, the flang program it became is printed.
- **language → flang** — a field for a C function. The translator (`flang/foreign/c`)
  turns it into a flang program, and the kernel checks it right away: `int` overflow and
  division by zero become promises that have to be proved. Python comes when its
  translator is in the build; until then its button says "soon".
- **Formula → flang** — a field for a formula with ∀ / ∃ or in LaTeX: it is translated
  to flang and checked right away.
- **Pictures** — diagrams of what is declared: objects and arrows of a category, functor
  squares, monoid laws, Euler–Venn circles for sets and the proof tree. Every picture
  carries a mark: "proved", "on examples" or "violated".

## What becomes what

The playground decides what it is looking at by the first meaningful line of the text:
blank lines and `//` comments do not count. The rule is shared by the playground and the
`flang repl` shell (the `.text` command): the function `«Text kind»` in
`flang/proof/probes/syllogism/sentences/text-kind.flang`.

- A line that starts with `модуль`, `module`, `категория` or `category` is a flang
  program (when a category is declared at the top level, the kind is called "category"
  and it is checked the same way). `flang check
  --proof --json` checks it; the result is built from the compiler's machine-readable
  answer, not from its text.
- A line that starts with `∀`, `∃`, `\forall`, `\exists`, `forall` or `exists` is a
  formula. The formula
  translator (`flang/foreign/formula`) turns it into a flang statement, and the kernel
  checks it. When a formula cannot be read, the translator names the reason: "a chain of
  comparisons without parentheses is ambiguous", "there is no ℝ in flang" and so on.
- Any other text is reasoning in Russian: a dictionary (`Понятие:`, `Свойство:`,
  `Имя:`), premises and a conclusion after the word «Следовательно». The translator
  `flang/proof/probes/syllogism/sentences/translator.flang` builds a program from it, and
  the kernel decides whether the conclusion follows from the premises.

After the kernel, the proof record is replayed by a separate program
(`flang/proof/checker/checker.c`, also in WebAssembly). When it matches, what is proved
rests on more than the compiler's word.

## Examples

Barbara syllogism: the conclusion follows from the premises.

```text playground Barbara syllogism — follows
Понятие: человек, люди.
Понятие: грек, греки.
Свойство: смертен, смертны.

Все люди смертны. Все греки — люди. Следовательно, все греки смертны.
```

A theorem about lists: the sum of the empty list is zero, a list's length is not
negative, and an element put in front makes the list one longer. All of it is proved for
every list.

```flang playground A theorem about lists
модуль «Списки»

тотальная функция «Сумма»
  принимает л: список число
  возвращает число
  разбор л
    случай пусто
      то 0
    случай голова и хвост
      то голова плюс («Сумма» от хвост)

утверждение «сумма пустого списка — ноль»
  утверждаем («Сумма» от пустой список) равна 0

утверждение «длина списка не отрицательна»
  для всех л: список число
  утверждаем (длина л) не меньше 0

утверждение «приписанный элемент удлиняет список на один»
  для всех л: список число
  для всех э: число
  утверждаем (длина (приписать э к л)) равна ((длина л) плюс 1)
```

A monoid with laws: string concatenation is associative, and the empty string is its
unit. The compiler checks the monoid laws on the values from the operation's examples;
the picture shows the associativity square and the unit triangles.

```flang playground A monoid with laws
модуль «Склейка строк»

тотальная функция «Склеить»
  принимает а: строка, б: строка
  возвращает строка
  пример «два слова»
    дано а равно "мир"
    дано б равно "ок"
    ожидается "мирок"
  пример «с пустой строкой»
    дано а равно ""
    дано б равно "ум"
    ожидается "ум"
  соединить [а, б] по ""

моноид «Склейка»
  носитель строка
  операция «Склеить»
  единица ""
```

A category with a square: a functor turns roubles into kopecks, and the square "issue
the bill, then convert" = "convert, then issue the bill" has to commute.

```flang playground A category with a square
модуль «Заказы и счета»

объект «Заказ»
  рубли является числом

объект «Счёт»
  рубли является числом

объект «Заказ в копейках»
  копейки является числом

объект «Счёт в копейках»
  копейки является числом

тотальная функция «Выставить»
  принимает заказ: «Заказ»
  возвращает «Счёт»
  пример «три рубля — счёт на тринадцать»
    дано заказ равно запись «Заказ» с рубли равным 3
    ожидается запись «Счёт» с рубли равным 13
  запись «Счёт» с рубли равным (заказ.рубли плюс 10)

тотальная функция «Выставить в копейках»
  принимает заказ: «Заказ в копейках»
  возвращает «Счёт в копейках»
  пример «триста копеек — счёт на тысячу триста»
    дано заказ равно запись «Заказ в копейках» с копейки равным 300
    ожидается запись «Счёт в копейках» с копейки равным 1300
  запись «Счёт в копейках» с копейки равным (заказ.копейки плюс 1000)

тотальная функция «Заказы равны»
  принимает а: «Заказ», б: «Заказ»
  возвращает признак
  а.рубли равен б.рубли

тотальная функция «Счета равны»
  принимает а: «Счёт», б: «Счёт»
  возвращает признак
  а.рубли равен б.рубли

тотальная функция «Заказы в копейках равны»
  принимает а: «Заказ в копейках», б: «Заказ в копейках»
  возвращает признак
  а.копейки равен б.копейки

тотальная функция «Счета в копейках равны»
  принимает а: «Счёт в копейках», б: «Счёт в копейках»
  возвращает признак
  а.копейки равен б.копейки

тотальная функция «Заказ в копейки»
  принимает заказ: «Заказ»
  возвращает «Заказ в копейках»
  пример «три рубля — триста копеек»
    дано заказ равно запись «Заказ» с рубли равным 3
    ожидается запись «Заказ в копейках» с копейки равным 300
  запись «Заказ в копейках» с копейки равным (заказ.рубли умножить на 100)

тотальная функция «Счёт в копейки»
  принимает счёт: «Счёт»
  возвращает «Счёт в копейках»
  пример «тринадцать рублей — тысяча триста копеек»
    дано счёт равно запись «Счёт» с рубли равным 13
    ожидается запись «Счёт в копейках» с копейки равным 1300
  запись «Счёт в копейках» с копейки равным (счёт.рубли умножить на 100)

морфизм «выставить» из «Заказ» в «Счёт»
  даёт «Выставить»

морфизм «выставить в копейках» из «Заказ в копейках» в «Счёт в копейках»
  даёт «Выставить в копейках»

единица «Заказ»
единица «Счёт»
единица «Заказ в копейках»
единица «Счёт в копейках»

категория «Рубли»
  морфизм «выставить»
  объект «Заказ» даёт «Заказы равны»
  объект «Счёт» даёт «Счета равны»

категория «Копейки»
  морфизм «выставить в копейках»
  объект «Заказ в копейках» даёт «Заказы в копейках равны»
  объект «Счёт в копейках» даёт «Счета в копейках равны»

функтор «В копейки» из «Рубли» в «Копейки»
  объект «Заказ» отображается в «Заказ в копейках» даёт «Заказ в копейки»
  объект «Счёт» отображается в «Счёт в копейках» даёт «Счёт в копейки»
  морфизм «выставить» отображается в морфизм «выставить в копейках»
```

Sets: the letters of words as sets of strings, their intersection and inclusion. The
picture shows Euler–Venn circles with the letters in their regions.

```flang playground Sets — inclusion and intersection
модуль «Буквы»

тотальная функция «Гласные»
  возвращает список строки
  ["а", "е", "и", "о", "у"]

тотальная функция «Буквы слова мир»
  возвращает список строки
  ["м", "и", "р"]

тотальная функция «Буквы слова ум»
  возвращает список строки
  ["у", "м"]

тотальная функция «Пересечение»
  принимает первое: список строки, второе: список строки
  возвращает список строки
  отфильтровать первое где э → второе содержит э

тотальная функция «Вложение»
  принимает меньшее: список строки, большее: список строки
  возвращает признак
  (длина (отфильтровать меньшее где э → не (большее содержит э))) равна 0

утверждение «общие буквы мира и гласных — гласные»
  утверждаем «Вложение» от («Пересечение» от («Буквы слова мир») и («Гласные»)) и («Гласные»)

утверждение «у слов мир и ум общая только м»
  утверждаем («Пересечение» от («Буквы слова мир») и («Буквы слова ум»)) равно ["м"]
```

A formula with quantifiers in LaTeX: addition of integers is commutative. The same
formula can be entered on the "Formula → flang" tab.

```text playground Formula with ∀ in LaTeX
\forall x \in \mathbb{Z},\ \forall y \in \mathbb{Z},\ x + y = y + x
```

Affirming the consequent: from "all men are mortal" and "Socrates is mortal" it does not
follow that Socrates is a man. The playground shows a counterexample.

A formula with quantifiers in Unicode: multiplication of integers commutes.

```text playground Formula with ∀ — multiplication commutes
∀ x ∈ ℤ, ∀ y ∈ ℤ, x * y = y * x
```

A C function translated to flang. `clamp` is proved in full. For `midpoint` the kernel
does not prove the promise "`lo + hi` is at most INT_MAX", so the playground computes the
function at the `int` bounds: with `lo = hi = 2147483647` the promise is broken. This is
a real C bug, and the translation does not hide it.

```c playground A C function — translated to flang
int clamp(int x, int lo, int hi)
{
    if (x < lo)
        return lo;
    if (x > hi)
        return hi;
    return x;
}

int midpoint(int lo, int hi)
{
    return (lo + hi) / 2;
}
```

```text playground Affirming the consequent — does not follow
Понятие: человек, люди.
Свойство: смертен, смертны.
Имя: Сократ.

Все люди смертны. Сократ смертен. Следовательно, Сократ — человек.
```

A statement about your own type, proved by induction; the "Pictures" tab shows the
proof tree: the base, the step and the rule of each case.

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

A false statement: at `н = 0` doubling is not greater than the original. The kernel
tries the edges of the type, finds this input, and the playground answers
«опровергнуто на входе н = 0» (refuted at n = 0) with code 1.

```flang playground False statement — refuted
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
| independent proof check | `playground/checker.wasm` | `flang/proof/checker/checker.c`, the same `clang` |
| reasoning translator | `playground/reasoning.js` | `bootstrap/flang emit --target js` |
| formula translator | `playground/formula.js` | `flang/foreign/formula/browser.fscript`, `bootstrap/flang emit --target js` |
| C translator | `playground/c.js` | `flang/foreign/c/browser.fscript`, `bootstrap/flang emit --target js` |
| library | `playground/library.tar` | `flang/stdlib/*.flang` and `flang/core/*.flang` |
| WASI host | `playground/flang_host_browser.js` | `flang/src/emit/js/flang_host_browser.js` |
| playground page | `playground.js` | `docs/site/playground.js` |
| formula typesetting | `vendor/katex/` | KaTeX 0.16.11 (MIT licence), kept in the tree: `docs/site/vendor/katex` |

The files of the `playground/` directory are built by a step of the site build
(`bootstrap/flang run-script playground:build`); they are not in the tree. The WASI host
keeps a file system in the tab's memory: the user's source, the library (downloaded only
when the text has `использует`) and a temporary directory `/tmp`. The compiler runs in a
separate thread (a Web Worker), so the page does not freeze.

C text is read by the host: it builds the same tree that `clang -Xclang -ast-dump`
prints, only for the subset the translator knows. The probe compares this tree with
clang's on the nine files of `flang/foreign/c/corpus`, line by line. What the subset does
not have (pointers, `long`, `switch`, the preprocessor except `#include`) the host names
with its line instead of guessing a translation.

The editor takes its keywords from the lexer's table (`flang/self/lexer.flang`, the
function «Куски таблицы»): the site build puts them on the page, and there is no second
list of words. LaTeX formulas are drawn by KaTeX, which the page loads from
`cdn.jsdelivr.net`; without a network the formula stays LaTeX source. Pictures are SVG
the page draws itself from the parse tree (`flang ast`) and the compiler's
machine-readable answer.

The same host runs under Node, without a browser:

```sh
node flang/src/emit/js/flang_host_browser.js docs/site/out/playground "$(cat text.txt)"
node flang/src/emit/js/flang_host_browser.js docs/site/out/playground --json "$(cat text.txt)"
node flang/src/emit/js/flang_host_browser.js docs/site/out/playground --на go "$(cat program.flang)"
node flang/src/emit/js/flang_host_browser.js docs/site/out/playground --из c "$(cat function.c)"
```

Its exit code is the check's: 0 — follows or proved, 1 — does not follow, 3 — not proved.
With `--json` it prints the whole parsed answer — the one the page builds the result and
the pictures from.

This is how the site build probes the playground (`bootstrap/flang run-script
playground:probe`, the plan `scripts/site/playground-probe.fscript`): Barbara must
follow and the independent check must match the record; affirming the consequent must
give "does not follow" with code 1; the false statement must give code 3 and nothing
proved; the LaTeX formula must be translated to flang, proved and matched by the
independent check; printing into all ten languages must give the same program files the
binary compiler prints; a C function must be translated and checked by the kernel; the
playground's C reading must give clang's tree on every file of the corpus.

## What the playground does not have

- **Processes.** WebAssembly has no `fork` and `exec`, so the compiler cannot start the
  independent check itself; the host starts it next, as a second module.
- **Network and the machine's files.** There are no sockets; files live only in the
  tab's memory.
- **Independent check of programs with `использует`.** It needs the proof records of the
  imported modules; the playground does not build them.
- **Naturality squares in the pictures.** The components of a natural transformation
  (`морфизм … из функтора … в функтор …`) do not reach the parse tree of `flang ast`, so
  there is nothing to draw the square from; the law's mark is still in the result.
- **A 64-bit address.** The module is built for `wasm32`: memory is at most 4 GiB, and the
  built-in step limit 8·10¹² does not fit a 32-bit `size_t` and becomes 2 770 894 848 —
  `clang` warns about it during the build.
