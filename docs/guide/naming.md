[To the README](../../README.md) · [Documentation index](../README.md)

# Names in code

A rule with no run behind it is a wish, and it goes stale in a week. A sentence is never executed, so it never breaks — which means nobody
finds out when it stopped being true.

So this page is split in two, and the split is not cosmetic:

- a **rule** is settled by a run and goes red — `bootstrap/flang run-script names:check`;
- **advice** cannot be settled by a run, and therefore stays advice.

Turning something into a rule that is not one is forbidden here separately. A guard that goes red on
sensible code gets switched off within a month, and everything else gets switched off with it.

## Rules

All six are checked by `flang/scripts/name-guard.mjs` against the parse tree, not by grep: grep could
not tell a name from a word in a string literal.

| | Rule | Where it applies | Sites a run counts |
|---|---|---|---|
| Р1 | no one-letter name | local names | **16566** |
| Р2 | no name shorter than three letters (Han: two characters) | local names | **3609** beyond Р1 |
| Р3 | no clipped word from a closed list (`акк`, `эл`, `acc`, `elem`, `знач`, `ctx`, `tmp`, …) | local names | **8029** |
| Р4 | Cyrillic and Latin never mix inside one word | all names | **1** |
| Р5 | no name longer than 48 letters | all names but example names | **3**, no debt |
| Р6 | no example name longer than 96 letters | example names | **10**, no debt |

**Local names** are the ones the author picks freely and briefly, which is exactly where `н`, `эл`,
`акк` come from: parameters, `пусть` bindings, the accumulator and item of a fold, the item of a map
or filter, the head and tail of a case, variant fields, record fields.

Function, type, variant and module names are bounded from above only. From below they are long
already: the shortest Cyrillic function name in the corpus is three letters («Все», «НОД», «Оба») and
the shortest Han one is two characters (`阶乘`, "factorial") — the corpus sits on the threshold
without being pushed. An **example** name in this language is a sentence («Минус ноль — тот же ноль:
иначе цифра пути вышла бы −0 и не совпала ни с одной ветвью», 63 letters), so a lower bound is wrong
for it in substance, not by oversight.

A type parameter (`тотальная функция «Длина» от «А»`) is out of Р1: a single letter there is settled
mathematical notation.

### Why Р3 is a closed list

"Is this a word" cannot be settled by a run — it would take a dictionary of four languages and an
argument with it. "Is it on the list" is settled exactly. The list is kept by hand in `ОБРУБКИ`, and
that is what makes it honest: you can see what is forbidden, and see that little is.

Six entries occur in the corpus: `акк`, `эл`, `acc`, `elem`, `знач`, `ctx`. The rest are the same
clipping, taken from neighbouring languages.

### Why Р4 is about lookalikes, not about mixed scripts

`сkind` is a Cyrillic `с` glued to a Latin `kind`, and it is indistinguishable from `ckind` by eye.
The pairs `с/c`, `о/o`, `р/p`, `а/a`, `е/e`, `х/x` are lookalikes;
only a search tells them apart, and that search finds nothing.

This is the one kind where the fault is **invisible**: the other violations are readable
abbreviations, you can see them, and they can wait. Where a `пусть` name mirrors a key of the JSON
being printed (`flang/self/proof-initial.flang`, `flang/self/proofterm.flang`,
`flang/self/obligations.flang`), the key is kept and the lookalike prefix is not: `«поле kind»`,
`«поле name»` — the two scripts are separated by a space.

Han mixed with Latin is **not** covered by Р4, and that is measured, not decided by taste: a rule
covering it goes red on a healthy Chinese example name, `二十的阶乘在double中仍然精确`. Chinese
puts no space between words, so a Latin technical term inside a Chinese phrase has to be written
flush — there is no separator to use. The hazard behind Р4 is not mixing as such but
indistinguishability, and Han characters have no Latin lookalikes.

## Four surfaces

The language has four surfaces — Russian, English, Esperanto, Chinese — and "at least three
characters" means different things on them. The threshold is therefore stated not in code points but
in **the word-forming unit of the script the name itself is written in**:

| Script | Surfaces | Threshold | Why |
|---|---|---|---|
| Cyrillic | ru | ≥ 3 letters | |
| Latin | en, eo | ≥ 3 letters | |
| Han | zh | ≥ 2 characters | `列表` "list", `数字` "number", `累加` "accumulate" are ordinary words; demanding three would forbid ordinary vocabulary, that is, forbid the Chinese surface |

One Han character is a morpheme, and an ambiguous one: that *is* the Chinese case of abbreviation.
The threshold is measured against the corpus: all 26 Han names in the tree are two characters or
more, the minimum being exactly 2.

**Esperanto** is written in Latin with diacritics (`ĉ ĝ ĥ ĵ ŝ ŭ`), so counting goes over `\p{L}`
after NFC normalisation. Otherwise `ĉ` would count as two units and a three-letter Esperanto word
would pass where a Russian one failed.

The script is decided by **the name itself**, not by the file, and word by word. A Russian file is
entitled to call a function «Печать в C» or «Число Elixir»: `C`, `TS`, `JS`, `AST`, `IEEE` are proper
nouns and acronyms, not abbreviations. So a word made of capital Latin letters and digits is out of
the lower bound. Without that clause the guard would go red on 200+ healthy sites — and it would be
switched off. Lowercase `n`, `f`, `h`, `t` are not covered by the clause.

## Debt: the rules hold, the corpus is fixed separately

The corpus does not satisfy the rules, and the price is stated as a number rather than as
"here and there". Pardoning the violations silently would be a lie; going red on all of them at once
would block the build until a long renaming is done.

So the debt is written down **by name** in `flang/scripts/name-debt.json`, and the comparison is a
**diff of lists by name**, not a difference of counts: a new name in a file goes red, a removed name
is reported as done. A count would have matched while one violation was traded for another.

```
Сторож имён: 363 файлов, 27711 мест долга в 238 файлах.
  Р1-одна-буква                16566
  Р2-короче-трёх               3609
  Р3-обрубок                   8029
  Р4-две-письменности          1
  Р5-длинное-имя               3
  Р6-длинный-пример            10
  помиловано (правило неверно) 39
  не разобрано функций         0 (записано 0)
  охват                        363 файлов из 1333 в дереве; вне охвата 970 — …
```

After the summary the run lists, by name, the new violations that are not in the debt
(«НОВЫЕ нарушения»), the broken upper bounds («ВЕРХНЯЯ граница пробита») and the names already
removed that the debt still lists («ВЫПОЛНЕНО — … имён снято; перепишите долг: --debt»). Any of the
first two makes the exit code 1.

The debt key is "file + name", with no occurrence count. That is deliberately weaker than
"file + name + count": adding one more `акк` to a file that already has `акк` will not be noticed.
A count, though, would shake on any unrelated edit to a body, and the debt file would have to be
rewritten by every commit — and a file rewritten without looking stops being evidence.

Rewrite the debt after cleaning: `node flang/scripts/name-guard.mjs --debt`. The debt must shrink.
The upper bounds (Р5, Р6) have no debt: every violation of them is red at once.

### An exception is not a debt

Debt means "the code is wrong, we will fix it". An exception means "**the rule** is wrong here, and
renaming would make the file worse". The two lists are separate on purpose.

Exceptions sit in ten files, by name, in `ИСКЛЮЧЕНИЯ`; a run counts them as
«помиловано (правило неверно)». They are of two kinds.

The first: a Rosetta task reproduces a formula
that names its own variables. The Ackermann function is defined as `A(m, n)`, the factorial as `n!`;
`первый` and `второй` in place of `m` and `n` would cut the tie to the definition the example exists
for. A one-letter name is meaningful exactly when its meaning is fixed from outside by mathematical
notation — and no run can check that, so the list is kept by hand and by name in `ИСКЛЮЧЕНИЯ`.

The second: `«поле param»` in `flang/self/proof-initial.flang` and
`flang/self/proofterm.flang`: the name mirrors a key of the canonical JSON, and the key sits quoted
as the next word on the same line (`пусть «поле param» равно («Собрать поле ядра» от "param" и …)`).
Canonical JSON is a compatibility surface, so the key cannot be renamed; calling the binding
`поле parameter` would split the name from the key it exists to match. `param` *is* an honest
clipping and Р3 catches it correctly — what is wrong here is applying the rule to a mirror.

The same name cannot be both a debt and an exception: that is checked.

### A file that fails to parse must not carry its checks away silently

A file the parser does not accept whole would carry away all its functions, and the guard would stay
green precisely because nothing was left to check. So the guard has a fallback: the file is cut at
function declarations and parsed piece by piece.

The list of known losses, `ПОТЕРИ`, is empty: every function parses whole («не разобрано функций 0»).
The fallback is the insurance against the next such hole, and the list is compared **in both
directions**: a new loss goes red, and so does the tombstone of a removed one. An entry that outlived
its reason lies exactly as much as a missing one; the «Объявлено, не сделано» list in
`flang/scripts/code-guard.fscript` is kept by the same rule.

### What the guard does not look at

`КАТАЛОГИ` lists four directories — `flang/stdlib`, `flang/core`, `flang/self`, `docs/examples`. A
directory left off the list does not go red — it simply is not checked, and the guard stays green
precisely because it stopped looking.

So the coverage is printed on every run: **363 files out of 1333**. The other 970 are not an
oversight:

| Outside coverage | Count | Why |
|---|---|---|
| benchmark output (`docs/benchmark*`) | 27 | it is the output of a run, not a source |
| test fixtures (`flang/test/fixtures/`) | 101 | their names are deliberately malformed; that is what makes them fixtures |
| hand-written code outside the four directories | **842** | worth covering, but their price has not been measured |

Those last 842 are a named coverage debt. Widening the coverage without measuring the price would
mean landing a rule the corpus was never checked against.

## Advice

None of this is settled by a run, so none of it is a rule. Checking it is the job of whoever reads
the change.

- **Name by meaning, not by type.** `элементы`, not `список`; `остаток`, not `второе число`.
- **A parameter's name says what it is, not where it came from.** `порог`, not `аргумент`.
- **One concept, one word across the tree.** If a list item is `элемент` in one module and `значение`
  in the next, searching the tree stops meaning anything.
- **An example name is a sentence about what is being checked**, not "Case 3". It *is* the
  documentation: examples are printed into the tests of all ten targets.
- **Do not transliterate.** `spisok` instead of `список` is the worse of both: neither a Russian word
  nor an English one. This is deliberately not a rule. The check "a Latin word that is not the
  transliteration of a Russian one" was written and measured, and on healthy code it produced **298
  false positives** — `list`, `to`, `element`, `start`, `by`, `on` in English files coincide with the
  transliteration of Russian words character for character. A guard that goes red on `element` gets
  switched off the same day.

  Careless transliteration in corpus names is **zero**, verified by reading all 151 Latin words that
  occur in names outside English, Esperanto and Chinese files: nearly all are proper nouns (`Java`,
  `Rust`, `Go`, `C`, `Elixir`, `Python`, `Makefile`, `Cargo`, `flang`), acronyms (`JSON`, `AST`,
  `TS`, `JS`, `IEEE`, `ASCII`, `BMP`, `XML`), English technical words (`bind`, `unit`, `join`,
  `span`, `null`, `mod`, `trampoline`, `wireFields`) or example data (`kitten`, `sitting`, `horse`,
  `MCMXCIX`).

  Transliteration appears in names in exactly one place, and it is **not carelessness**: 25 functions
  in `flang/self/emit-js.flang` are named «Текст b_dlina JS», «Текст b_soedinit JS», «Текст b_kod_simvola JS»
  — after the identifier each one prints into JavaScript. That identifier is transliterated by
  the printer itself (`flang/self/emit-js.flang` and the nine other printers), because
  JavaScript will not take Cyrillic in helper names, and the printing
  function's name repeats what is printed, word for word. Same argument as `сkind` under Р4 — except
  here it creates no lookalikes, and so it stands.
- **File names carry no transliteration at all.** A Latin extension means an English-worded name:
  `lists.flang`, `higher-order.flang`, `name-guard.mjs`. This one is guarded by a run:
  `scripts/guards/translit-file-names-guard.fscript` checks every word of a Latin file name in
  `scripts/`, `flang/test/`, `flang/scripts/`, `flang/proof/`, `docs/site/` and `.github/` against
  the closed word list `scripts/ledgers/file-name-words.txt`, and transliteration already in the
  tree against `scripts/ledgers/translit-file-names-debt.txt`, where every name has its reason.
  It runs in CI as the job `translit-file-names`:

  ```
  $ bootstrap/flang io scripts/guards/translit-file-names-guard.fscript --plan Проверка
  транслит в именах файлов: латинских имён 1847, с чужими словами 102 — все в ведомости, новых нет
  ```

  The bootstrap print in C takes its file names from the module name, by the same transliteration
  every target uses — so the compiler's module is named in English, «Compiler flang», and not by a
  special case in the printing machinery: the contract «a module name reaches the target» is shared
  by all ten targets, and carving a special case into it for one program would fix our tree at every
  other tree's expense. That module's name is the only one in `flang/self/` that reaches a foreign
  namespace at all: it is the file name (`compiler_flang.c`, `.h`), the library name
  (`libcompiler_flang.a`), the header guard, and the prefix of every exported C symbol. Layer names
  never get there — linking merges them into one flat namespace. The word order («Compiler flang»,
  not «Flang compiler») is chosen because the `flang_` prefix belongs to the backend itself
  (`flang_runtime.c`, `flang_cli.c`, `flang_repl.c`), and the tree tells the print from the program
  by exactly that prefix.

## Running it

```bash
bootstrap/flang run-script names:check                         # the guard
node flang/scripts/name-guard.mjs --list       # the debt per file, by name
node flang/scripts/name-guard.mjs --debt       # rewrite the debt after cleaning
bootstrap/flang check scripts/guards/module-name-guard.fscript  # the 34 examples of the R7 check
```

The R1–R6 guard has no test of its own: nothing feeds it fakes and checks that it goes red. A guard
that cannot go red looks exactly like a guard that has nothing to report.
