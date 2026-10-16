[Back to README](../../README.md) · [Documentation index](../README.md)

# How to write flang well

This is a set of working habits, not a retelling of the language. How the
language is built and how code passes the checks and **gets proven** is in the
skill `.claude/skills/flang-code`; naming rules are in [Names in
code](naming.md); the kinds of decrease are in [What `тотальная` buys
you](totality.md); "one source → many target languages" is in [Why this
exists](single-source.md); the boundary between proven and checked is in
[Known limits](limits.md). What is collected here is different: how to write
so as not to pile up debt, and so that what you write does not silently drift
from the code.

One rule is older than all the others: **a rule with no run behind it is a
wish, and it goes stale in a week** (proven in this tree, see [Names in
code](naming.md)). So everything below is either enforced by a check and turns
red, or is honestly called advice.

## A name instead of an explanation

A function explains itself with four things: **its name, its types,
`обеспечивает` and `пример`**. If they do not show what it does, fix the CODE —
rename it, refine a type, add a postcondition or an example — instead of
attaching an explanation on the side.

A name is not decoration but a load-bearing part. It belongs to the domain and
is not abbreviated: `«Разобрать запрос»` ("parse the request"), not `«разб»`;
a fold accumulator is `итог` ("total"), not `акк` ("acc"). What exactly is
forbidden and what turns red in a run (`flang/scripts/name-guard.mjs`) is in
[Names in code](naming.md); it is not retold here so that the two do not
drift apart.

## Guillemets around names

Names of functions, types, variants and modules are written in guillemets:
`«Глубина»`, `«Дерево»`, `модуль «Отрезок»`. A call is
`«Имя» от аргумент и аргумент`. Guillemets are the boundary of a name: inside
them the lexer sees one name, not a sequence of words. Local names (a
parameter, `пусть`, a fold element, a case field) do not need guillemets.

## The "no comments" policy — and what to use instead

**`.flang` files have no comments.** This is not a matter of taste but a
consequence of the design: the lexer discards comments
(`flang/self/lexer.flang`). Line `//` and block `/* */` comments never reach
the token stream at all. So a comment is not a **term**: it cannot be checked,
it cannot be referred to, and it silently drifts from the code — the code gets
edited, the note stays.

Adding comments is blocked by the ratchet
`scripts/guards/no-comments-guard.fscript`: the debt is recorded per file
(`scripts/ledgers/no-comments-debt.tsv`) and can only decrease. The check runs
in `.githooks/pre-push`, covers all five of the language's extensions and
trailing `//` as well, and does not count a `//` inside a string literal as a
comment. The debt holds only the seed print inputs (`flang/self/**` and the
files from `scripts/seed-fingerprint`; their comments go away with the next
print) and five proof checker probes where the comment is itself the forgery
(`docs/flang/proof/checker/tests/records/why-comments-here.md`); the rest of
the tree has no comments.

Where the things that other languages put in comments go instead:

- **the invariant that holds the function** — into `обеспечивает «имя» …`
  (postcondition) and `требует …` (precondition). These are terms: the kernel
  checks them, many of them for all inputs;
- **what the function does on a specific input** — into `пример «предложение»
  дано … ожидается …`. An example runs on EVERY check of the file;
- **a measurement, a date, "why we decided this"** — this is knowledge, but its
  place is not the source file; it is `docs/` and `docs/tasks/`.

### When a note in the code really is needed — a term note

The language does have a way to leave a **genuinely needed** note in the code,
and it is not a comment but a **term**: the note travels inside a construct
that the compiler keeps and checks, so it cannot drift from the code. The
canonical form is a **named `пример`** (its name in this language is a whole
sentence, up to 96 characters, and it is run), and next to it **named
`обеспечивает` / `требует` / `теорема`**.

If you want to note "it matters here that an incomplete input differs from a
corrupted one", do not write it as a `//` line; give that name to a
postcondition or an example, and the note becomes checkable:

```flang
обеспечивает «неполный вход назван неполным»
  если («Разобрать запрос» от вход) равен (вариант «Запрос неполон») то результат равен "неполон" иначе да
пример «Обрезанный запрос — неполон, а не испорчен»
  дано вход равно "GET / HT"
  ожидается "неполон"
```

## No duplication

Do not repeat the same fact in two places: they will drift apart. One source
gives the implementation, the tests and the postconditions on all targets at
once (see [Why this exists](single-source.md)) — do not write tests next to it
by hand. A list the tree can derive by itself is not typed by hand: such
hand-written lists are tracked by the discrepancy ledger
`scripts/ledgers/hand-written-lists-ledger.tsv` (verified by
`bootstrap/flang run-script hand-written-lists:check`). Before typing a list, ask
whether it can be derived from the tree.

## Totality and `убывает`

`тотальная` is a promise that the function terminates on every input; the
compiler **proves** it and rejects the file if it cannot. The cheapest to
prove are structural recursion over a part of the value (a `разбор` pattern
match on a sum type) and descent over `неотрицательное` by exactly 1 — they
cost nothing at runtime. A declared measure `убывает <выражение>` puts a check
into the emitted code and noticeably slows the function down — reach for it
only when the first ways are not enough. All five ways and when to use which
are in [What `тотальная` buys you](totality.md) and in the `flang-code` skill.

Separately about numbers: declare `неотрицательное` wherever a value is
non-negative — this gives the kernel bounds and induction, it is not pedantry.
The IEEE-754 traps (negative zero, NaN, associativity) are covered in the
`flang-code` skill — read it before working with numbers.

## Effects as data

A program does not go to the network or read files by itself. An effect is
**data**: a function builds a value of the form "do this" (open a file, send a
packet), and it is executed by the outside environment — the runtime host.
That is why all functions stay `тотальная` and are checked by ordinary
`пример`s, with no files and no network. Write the logic as a pure function
"input → description of the action"; leave the actual contact with the world
to the host. The set of requests is closed and defined in the compiler.

## Checking before running

`flang check` is parsing, type inference, the termination check, running the
built-in `пример`s and checking proofs, all **before** the run. Transpilation
(`flang emit`) calls the same checks: unchecked code does not get emitted.
Check before you consider the work done:

```bash
bootstrap/flang check файл.flang
bootstrap/flang check файл.flang --proof --pretty
bootstrap/flang run файл.flang --function «Имя» --args '{"н": 5}'
```

The binary is built with `make -C bootstrap`; an installed `flang` is called
the same way, without the `bootstrap/` prefix. The binary's locale only
selects the language of diagnostics ([Settings](settings.md), "What takes precedence over what").
That `check` and `test` must not give different answers on the same program is
guarded by `scripts/guards/check-before-run.fscript`.

## A file name says what it is, with no transliteration and no extra words

A name says **simply WHAT this is**. The directory already gives the context,
so academic and superfluous words do not go into the name. Four rules:

1. **Never transliterate.** A Russian word in Latin letters (`korpus`,
   `svodka`) is forbidden (the rule is broader than file names, see the
   `report-plainly` skill). Either a Russian word in Cyrillic or an English
   word in Latin letters — but not a Russian word in Latin letters.
2. **Acronyms stay as they are.** http, json, tcp, api are acronyms; they do
   not make a name "English" and do not need translating.
3. **A purely Russian concept goes in Cyrillic** with the `.фп`/`.фланг`
   extension; an English word goes in Latin letters with the `.flang`/`.fp`
   extension.
4. **No superfluous words** (`list`, `data`, «набор» ("set")…) when the
   directory and the purpose are already clear.

```
плохо:   flang/test/korpus-http.flang
         — «korpus» = русское «корпус» латиницей (транслит);
         — само «корпус/corpus» лишнее: каталог «test/» уже про проверку.
хорошо:  flang/test/http.flang
         — http это акроним, каталог даёт контекст, лишних слов нет.
хорошо:  сводка.фп        понятие русское  → кириллица и русское расширение
плохо:   svodka.flang     «сводка» латиницей — транслит
```

This is how "the extensions are equal" and "no transliteration" fit together:
**a Russian name → `.фп`, an English name → `.flang`/`.fp`** (the reason for
the fourth extension in ADR-0016 is so that a Russian name does not have to be
mangled into Latin letters).

## File extension

Source files have **four equal extensions**: `.flang`, `.fp`, `.фп`,
`.фланг`. The primary (default) one is `.flang`. The Cyrillic `.фп` and
`.фланг` are for those who write in Russian (see the transliteration rule
above). Cyrillic in an extension does not contradict the rule of English file
NAMES: an extension is not a name.

The canonical list is `scripts/guards/file-extensions.fscript` (the function
«Расширения языка»); the decisions are ADR-0016 and ADR-0018. To check:
`flang check имя.фп` → code 0.

## Before and after

### Example 1 — a wall-of-text header versus terms

The test suite `flang/test/http.flang` distinguishes three outcomes of parsing
a request, and the main thing in it is how "incomplete" (`неполон`) differs
from "corrupted" (`испорчен`). This is knowledge about invariants, and its
place is not in a comment. The file name is also an example of the rule above:
not `korpus-http` (a Russian word in Latin letters, and superfluous too — the
`flang/test/` directory is already about testing), but `http.flang`.

As a comment (not a term, not checked, quietly goes stale):

```flang
// «неполон»  — байтов пока мало, ЖДАТЬ ЕЩЁ, ответ — молчание;
// «испорчен» — так починить нельзя, отвечать кодом и закрывать связь.
// Слить их — дорогая беда: см. шапку.
```

As terms (the same meaning, and the kernel holds it; this is how the file does
it — 18 postconditions and 25 examples):

```flang
обеспечивает «неполный вход назван неполным»
  если («Разобрать запрос» от вход) равен (вариант «Запрос неполон») то результат равен "неполон" иначе да
пример «Обрезанный — неполон»
  дано вход равно "GET / HT"
  ожидается "неполон"
```

Prose about why the suite is built this way, and about how Content-Length is
handled, belongs in `docs/`, not in the source.

### Example 2 — a name instead of an explanation

Before:

```flang
// считает налог: цена минус скидка, потом умножить на ставку
тотальная функция «Расчёт»
  принимает ц: число, с: число, ст: число
  возвращает число
  (ц минус с) умножить на ст
```

After (the name and the types speak for themselves; no comment is needed, and
the postcondition checks the bound):

```flang
тотальная функция «Налог после скидки»
  принимает цена: стоимость, скидка: стоимость, ставка: число
  возвращает стоимость
  обеспечивает «налог неотрицателен» результат не меньше 0
  (цена минус скидка) умножить на ставка
```

## Signs that the work is done

- `flang check` on the file — code 0;
- no new comments were added
  (`bootstrap/flang io scripts/guards/no-comments-guard.fscript --plan Проверка`);
- names pass `flang/scripts/name-guard.mjs`;
- no hand-written lists were introduced
  (`bootstrap/flang run-script hand-written-lists:check`);
- invariants are written as terms (`обеспечивает`/`пример`), and measurements
  and reasoning live in `docs/`/`docs/tasks/`, not in the source.
