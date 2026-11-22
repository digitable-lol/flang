# Check the reasoning in a text

The command `flang run-script argue:article` takes an article — a PDF, a Word
file or plain text — and writes a report on its reasoning: which of the
author's conclusions follow from the premises, which do not, what the main
conclusion rests on and what the author took without proof. The command works
in a clone of the flang repository: it is written in the repository's
`.flangrc`.

```bash
flang run-script argue:article -- article.pdf
```

flang does not read free text by itself. A language model or a human writes
down what each sentence claims and what is inferred from what, in a markup
file. flang does the rest: it takes the text out of the file, calls your markup
command, compares every quote of the markup with the text, hands every step of
the reasoning to the proof kernel and puts the report together.

The checked texts are Russian, so the markup keywords and the report are in
Russian too. The examples below are shown as they are.

## What is in the report

| Section | What it holds |
| --- | --- |
| Коротко (in short) | the main conclusion, how many steps lead to it and how many of them do not follow, the main assumption |
| Карта рассуждения (the map) | every step "premises → conclusion" as a list and as a diagram; conclusions with a failing step under them are marked |
| Провалы рассуждения (failures) | contradictions, vicious circles, shifted terms, conclusions without premises, steps that do not follow |
| Допущения автора (assumptions) | what a conclusion needs but the text does not say, and what is said without being derived; each with the conclusions that rest on it. Steps marked «допущение» go here too |
| Не доказательство (not a proof) | steps the markup itself calls less than a strict inference: a generalisation, a correlation, an appeal to authority, a step from significance, a step from a sample, a plausible step |
| Ядро не решило (not decided) | the steps the kernel did not check, each with its reason |
| Все шаги (all steps) | the table of steps with the kernel's verdict |
| Словарь понятий (glossary) | the notions of the article and the words whose meaning shifted |
| Кем прочитано (who read it) | for every sentence: who wrote down its meaning |
| Вне текста статьи (outside the article) | the reference list, a summary in another language, headings and table rows: they are not counted as sentences |
| Не досчитано (not finished) | steps whose check ran past the limit of time or memory |
| Выброшено из разметки (dropped) | markup entries whose quote is not in the text |

## Example: from a text to a report

The text is in `docs/examples/argue/service.txt`:

```
Под надёжным сервисом мы понимаем сервис, который отвечает на каждый запрос.
Все сервисы с резервной копией надёжны. Сервис «Архив» имеет резервную копию.
Следовательно, «Архив» надёжен. Пользователи называют «Архив» надёжным, так
что он отвечает на каждый запрос. После перехода на новую базу жалоб стало
меньше, значит, новая база повысила качество.
```

A finished markup lies next to it, in `docs/examples/argue/service.claims`, so
no markup command is needed here. Run from the root of the clone:

```bash
flang run-script argue:article -- docs/examples/argue/service.txt --out report.md
```

```
отчёт записан: report.md; провалов рассуждения: 1; подразумеваемых посылок: 0; шагов без доказательной силы: 2; шагов: 3, следует: 1, не следует: 2, без посылок: 0, посылки противоречат друг другу: 0, ядро не решило: 0; выброшено записей разметки: 0; не досчитано: 0
время: 48 с
```

The line says: one failure, no implied premises, two steps without the force
of a proof; three steps, one follows and two do not; nothing dropped and
nothing left unfinished; fifteen seconds.

The report is a Markdown file. Its beginning:

```
## Коротко

- Главный вывод: [8] «новая база повысила качество».
- Шагов до него: 1; из них следуют: 0, не следуют: 1 (из них строгих шагов, которым не хватает одной посылки: 0), ядро не решило: 0.
- Главное допущение: скрытая посылка шага [8] из [7]: `если жалоб_меньше, то база_повысила_качество` (с ней шаг следует — доказано ядром) — в тексте её нет. Если это неверно, без опоры остаются выводы: [8].
- Другие итоговые выводы: [4], [6].
- Найдено: провалов рассуждения: 1; подразумеваемых посылок: 0; шагов без доказательной силы: 2.
```

The map goes from conclusions down to premises:

```
- [4] «Следовательно, «Архив» надёжен» — дедукция из [2], [3]: следует (доказано ядром).
  - [2] «Все сервисы с резервной копией надёжны» — принято без вывода
  - [3] «Сервис «Архив» имеет резервную копию» — принято без вывода
- [6] «он отвечает на каждый запрос» — ссылка на авторитет из [5]: не следует (пример против подтверждён ядром).
  - [5] «Пользователи называют «Архив» надёжным» — принято без вывода
```

Under the list the same map stands as a Mermaid diagram. GitHub, GitLab and
many Markdown editors draw it by themselves.

The assumptions section names a premise the text does not contain:

```
- скрытая посылка шага [8] из [7]: `если жалоб_меньше, то база_повысила_качество` (с ней шаг следует — доказано ядром) — в тексте её нет. Если это неверно, без опоры остаются выводы: [8].
```

The only failure in this text is a shifted term. The word «надёжным» is
defined in the first sentence as "answers every request", and in the fifth it
means "liked by the users".

## PDF, Word and other formats

A file with the extension `.pdf` is turned into text by the program
`pdftotext`; `.docx`, `.odt`, `.rtf`, `.html` and `.epub` files by `pandoc`.
Any other file is read as text.

When the program is missing, the command stops and says what to install:

```
для PDF нужна программа pdftotext, она не найдена. Поставьте пакет poppler-utils:
в Debian и Ubuntu — sudo apt install poppler-utils, в macOS — brew install poppler.
```

The text taken out of the file is saved next to the report: for `article.pdf`
it is `article.argue.txt`. The quotes of the markup are compared with that
file.

Tables are saved apart, in `article.argue.tables.txt`. From Word and HTML
documents tables are taken whole and do not get into the text for the markup.
A PDF has no tables as such: the command looks for them by the layout of
columns on the page and may miss a table or take columns of text for one.

When a PDF holds no text but only pictures of pages, the command says so. Such
a file has to be recognised first, for example with `ocrmypdf`.

## The markup

The command takes the markup in one of two ways.

**A finished file.** If `article.claims` lies next to the article, it is
taken. The key `--claims <file>` names another place.

**A markup command.** flang does not call a language model and keeps no access
keys. You name the command that does:

```bash
flang run-script argue:article -- article.pdf --markup-cmd "claude -p"
```

The markup command gets a ready task on its standard input: the instruction
from `docs/examples/argue/claims-prompt.md` and the text of the article. It
has to print the markup. Any program that reads a task from its input and
prints the model's answer will do. The answer is saved as `article.claims`;
the previous file stays as `article.claims.bak`.

Commands that were run:

| Command | What it does |
| --- | --- |
| `--markup-cmd "claude -p"` | hands the task to Claude Code |
| `--markup-cmd "claude -p --model haiku"` | the same with a fast model |
| `--markup-cmd 'cat markup/part$FLANG_ARGUE_PART.claims'` | puts in a markup you wrote yourself for every part |

To avoid typing the key every time, set the environment variable
`FLANG_ARGUE_MARKUP_CMD`. It takes effect only when no finished markup lies
next to the article. The key `--markup-cmd` marks the article anew on every
run.

With neither a markup file nor a command, flang invents nothing. It stops and
lists both ways.

### A long article

An article longer than 12,000 characters is marked in parts. A part ends at
the border of a paragraph, and a new section starts a new part where it can.
Every next part gets the notions and the judgments of the earlier ones, so the
article has one glossary and a step may refer to a judgment from another part.

The key `--part-size <characters>` changes the size of a part. The markup
command can read the variables `FLANG_ARGUE_PART` and `FLANG_ARGUE_PARTS` —
the number of the part and how many there are — and `FLANG_ARGUE_PROMPT_FILE`
and `FLANG_ARGUE_TEXT_FILE`, the files with the task and with the text of the
part.

### Quotes

Every judgment of the markup carries a quote — the words of the text it is
taken from. flang compares the quote with the text word for word, up to spaces
and line breaks.

An entry whose quote is not in the text does not stop the check. The judgment
and the steps that rest on it are dropped, and the report lists them in the
section «Выброшено из разметки»:

```
- суждение [2] (строка 10 разметки): цитаты нет в тексте дословно: «Пингвин — это птица»
- шаг [3] из [1], [2] (строка 13 разметки): опирается на выброшенное суждение [2]
```

If you write the markup yourself or write your own markup command, cut the
quotes out of the text with a program and do not retype them. A retyped quote
differs from the text in a quotation mark, a dash or a hyphenated word, and
the judgment is lost.

Other mistakes of the markup stop the check and name the line: an undeclared
notion, a judgment without a quote, a reference to a judgment that does not
exist.

## How to read the report

**The main conclusion** is the final conclusion that the most steps lead to.
On a tie the last one in the text is taken. The other final conclusions are
named on the next line.

**The map.** The mark «принято без вывода» stands at a judgment the author
derives from nothing. The mark «разобрано выше» means the judgment is already
opened in the map; a vicious circle is shown this way too. The bold mark
«ниже есть шаг, который не следует» stands at a final conclusion with at
least one unproved step under it.

**Failures and assumptions.** A strict step that lacks one premise goes to
the assumptions: most often the author takes that premise for obvious. The
report names it and says which conclusions lose their ground if it is false.
The failures hold what one premise does not mend: a contradiction, a circle, a
shifted term, a conclusion without premises. Whether the missing premise is
obvious is for the reader to decide: flang does not know.

A step marked «допущение» goes to the assumptions too. The markup uses this
kind for a conclusion that rests on a general rule the text does not state:
"the grass is wet, so it rained". If the kernel proved such a step, there is
no unstated rule, and the step is not listed among the assumptions.

**Not a proof.** These are the steps the markup itself calls less than a
strict inference. For each the report says why a step of that kind does not
prove its conclusion and which premises it usually lacks. For a step marked
«выборка» (a sample):

```
- **Что не так:** шаг помечен в разметке как «выборка»: то, что верно для обследованных, верно для остальных, только если выборка на них похожа.
- **Что нужно шагу этого рода:** посылки, что выборка представляет всех: как она набрана и чем остальные на неё похожи.
```

**Who read it.** The section says who wrote down the meaning of every
sentence. If a judgment has the line `источник:` (origin) in the markup, the
mark is taken from it:

| Mark | What it means |
| --- | --- |
| грамматикой | the flang grammar wrote the judgment and it was left as it is |
| грамматикой, вариант 2 | the grammar gave several readings and the second was chosen |
| моделью | the judgment was written or rewritten by whoever edited the markup |

The section opens with a count of the judgments by origin:

```
Источник суждений: грамматика — 1; грамматика, другой вариант — 1; модель — 1; не назван — 18.
```

A judgment without the line `источник:` gets its mark from the comparison
with the grammar. The sentence then carries one of the marks:

| Mark | What it means |
| --- | --- |
| только моделью | the meaning of the sentence is written in the markup; the flang grammar did not confirm it |
| моделью, подтверждено грамматикой | the flang grammar parsed the quote and got the same form as the markup |
| моделью; грамматика прочла иначе | the grammar parsed the quote, but the form came out different; the report shows both |
| моделью; имена понятий не сопоставлены | the forms agree, but the notions are named differently and flang could not match them |
| никем | the markup does not have the sentence |

The word "model" here means whoever wrote the markup, a program or a human.
When a judgment has both the line `источник:` and an answer of the
comparison, the mark carries both: «моделью; грамматика подтвердила».

The crosscheck against the grammar is done by a separate part of flang. When
your clone has it, the section opens with a count over the judgments: how many
are confirmed, how many differ, how many the grammar did not read and why. The
flang grammar reads little so far: on scientific prose nearly every judgment
stays with the mark «только моделью», and the report names the reason for
each — most often an unknown word. When that part is absent, the section says
so: «сверка грамматикой не подключена».

**Outside the article.** The reference list, a summary in another language,
headings, table rows and scraps of recognition are not counted as sentences
and do not enter the coverage. The section shows how many there are and which.

The report's words about the kernel:

| Words | What stands behind them |
| --- | --- |
| следует (доказано ядром) | the kernel accepted a proof of the step for all cases |
| не следует (пример против подтверждён ядром) | the kernel computed the premises and the conclusion on a found case: the premises hold, the conclusion fails |
| ядро не решило | the step is past one of the limits of the check, or the kernel did not accept the check; the section «Ядро не решило» names the reason |

## The report for programs

The key `--json` writes the same report as JSON, into `article.argue.json`:

```bash
flang run-script argue:article -- docs/examples/argue/service.txt --json --out report.json
```

The top-level fields: `summary`, `theses`, `steps`, `failures`,
`implied_premise_steps`, `map`, `assumptions`, `glossary`, `readers`,
`dropped`, `skipped`, `tables`, `outside_article_text`, `uncovered_markers`,
`boundary`. A step looks like this:

```json
{"conclusion": "6", "premises": ["5"], "kind": "авторитет", "verdict": "fails", "missing_premise": "если пользователи_называют_надёжным(Архив), то отвечает_на_каждый(Архив)", "in_circle": false, "rests_on_weak_steps": "[6] из [5]"}
```

The verdicts of a step: `follows`, `fails`, `clash` (the premises contradict
each other), `none` (no premises), `undecided`. A judgment in `theses` has the
field `origin`, its line `источник:`; a sentence in `readers.sentences` has
the field `origins`.

## Time and limits

The small example above takes under a minute: the steps are checked in about
fifteen seconds, and the comparison with the grammar takes half a minute more.
A real article takes longer: on twelve scientific articles of 7 to 25 thousand characters the
check of a finished markup took from 35 seconds to a little over four minutes,
usually about a minute and a quarter. The report on such an article takes 30
to 120 KB.

Marking by a model comes on top of that. An article of 7 thousand characters
was marked by `claude -p` in about half a minute; an article of 25 thousand
characters, three parts, in about five minutes.

The time of checking the steps stands in the report itself, in the section
«Коротко», and the command prints the whole time as its last line.

The command watches every step. When the check of one step, or the search for
contradictions of one judgment, runs longer than five minutes or hits the
memory limit, that place is left out and the check goes on. The report lists
what was left out in the section «Не досчитано» and does not pass it off as
checked.

| Environment variable | What it sets | Default |
| --- | --- | --- |
| `FLANG_ARGUE_UNIT_SECONDS` | time for one step or one judgment | 300 |
| `FLANG_ARGUE_MEMORY` | memory of the check | 16G |
| `FLANG_ARGUE_KERNEL_SECONDS` | time of the kernel for one proof | 600 |

The key `--jobs <number>` sets how many proofs the kernel checks at once;
eight by default.

## The markup format

| Line | Meaning |
| --- | --- |
| `понятие кит(x): пояснение` | a property of a thing |
| `понятие старше(x, y): пояснение` | a relation between two things |
| `понятие дождь: пояснение` | a whole statement |
| `имя Сократ, Моби` | the things the text names |
| `величина спрос, запас: пояснение` | numbers that are compared |
| `неотрицательная величина доля: пояснение` | a number that is never below zero |
| `[N] форма` | a numbered judgment |
| `цитата: слова текста` | where the judgment comes from; required |
| a second line `цитата:` | the judgment is put together from two places of the text; each quote is compared with the text |
| `сила: как правило` | the judgment is said with a reservation; a firm conclusion does not follow from such a premise |
| `источник: грамматика` | who wrote the judgment: `грамматика`, `грамматика, вариант 2` or `модель` |
| `вариант: другая форма` | another reading of the same quote; does not change the check |
| `почему: несколько слов` | why this form was chosen; does not change the check |
| `термин: слово = смысл` | the sense a word has in this quote |
| `определение: слово = смысл` | the same for the sentence where the author defines the word |
| `вывод [N] из [M], [K]` | a step of the reasoning |
| `вывод [N] из [M]: корреляция` | a step with its kind |
| `не суждение: слова текста` | a sentence with a word of inference that states nothing; it is not judged |
| `# текст` | a comment |

A logical form is written in words: `не` (not), `и` (and), `или` (or),
`если …, то …` (if … then …), brackets, `все x:` (for all x) and `есть x:`
(there is x). Examples: `все x: если кит(x), то не рыба(x)`,
`есть x: кит(x) и белый(x)`, `если дождь, то мокро`, `старше(Анна, Борис)`.
Quantifiers stand in front of the form, and the kind of quantifier may change
once: `все x: есть y: если студент(x), то наставник(x, y)`.

Numbers and declared quantities are compared with the signs `<`, `<=`, `=`,
`!=`, `>`, `>=` or with the words `меньше`, `не больше`, `равно`, `не равно`,
`больше`, `не меньше`: `спрос < запас`, `доля >= 50 %`,
`выручка_2021 = 1,12 * выручка_2020`. Quantities can be added, subtracted,
and multiplied or divided by a number.

The form `причина: если курит, то болеет` says that one thing causes the
other. As a premise it works as a plain condition. As a conclusion it follows
only from a judgment about the same cause: a cause is not derived from two
features that occur together.

The kind of a step is written after the colon in the line `вывод`. A step
without a kind is claimed to be a strict inference.

| Kind | What the step is |
| --- | --- |
| `обобщение` | from examples to all cases |
| `корреляция` | from two features that occur together to a cause |
| `авторитет` | from somebody's opinion to the claim itself |
| `определение` | an inference by the definition of a word; judged as a strict one |
| `значимость` | from statistical significance to an effect |
| `выборка` | from those examined to everybody |
| `правдоподобие` | the conclusion or a premise is said with a reservation: "probably", "as a rule" |
| `допущение` | the conclusion rests on a general rule the text does not state |
| `объяснение` | the author explains why something happened and does not prove it; it is not judged |

## What the kernel judges and what it does not

It judges:

- forms without quantifiers over statements and over named things;
- forms with quantifiers in front: of one kind (`все x, y: …`, `есть x: …`)
  and with one change of kind (`все x: есть y: …`, `есть y: все x: …`);
- notions of one place, of two and of more;
- comparisons of numbers and declared quantities with addition, subtraction,
  and multiplication and division by a number;
- a large step: flang cuts its proof into parts of two or three elementary
  statements, and the kernel checks every part.

It does not judge:

- a step that, after the things are substituted, has more than 40 elementary
  statements;
- a step where the substitution gives more than 600 combinations of things;
- a step with comparisons that has more than three quantities or more than
  four different comparisons;
- a form where the kind of quantifier changes more than once, and a comparison
  where one quantity is multiplied by another: a markup with them is refused,
  and the message names the line;
- the truth of the premises: only the link between premises and conclusion is
  checked;
- a contradiction between three or more judgments when no two of them
  contradict each other and they are not the premises of one step.

A step past one of the first three limits gets the answer «ядро не решило»,
and the section «Ядро не решило» names the reason:

```
- [20] из [17], [18], [19]: предел: доказательство шага на 3 простых высказываний не делится на части, посильные ядру.
```

A step has three answers, and each is backed by something. «Следует»: the
kernel accepted every part of the proof. «Не следует»: a case was found on
which the kernel computed the premises true and the conclusion false. «Ядро
не решило»: there is neither. The proof and the counterexample are searched
for apart, so a failed search never turns into «следует» or «не следует».

flang expands a quantifier itself: it puts every thing named in the step in
place of the variable. The kernel receives a formula without quantifiers. In
a form with a change of quantifier kind the named things are sometimes not
enough for a proof nor for a counterexample; the answer is then «ядро не
решило».

## What the check does not promise

- **The truth of the premises is not checked.** flang judges the link between
  premises and conclusion. A false premise from which the conclusion follows
  gives the verdict "follows".
- **The markup may distort the meaning.** The logical form of a sentence is
  written by a model or a human. flang checks the quote, not whether the form
  renders its meaning. The quote stands next to the form in the report so that
  the reader can check.
- **"All the holes" are not guaranteed.** What is guaranteed is different:
  every marked step is checked by the kernel or named as unchecked, and every
  sentence the markup did not touch is named in the section «Кем прочитано».
- **The main conclusion and the main assumption are chosen by counting
  steps**, not by the meaning of the article. The author may have meant
  another one.

## The strict check of a finished markup

The command `flang run-script argue -- text.txt` checks a text with a finished
markup and forgives nothing: the first quote that is not in the text stops the
check. It is handy while a markup is written and mended by hand. Its report is
shorter: it has no map, no assumptions and no glossary.

## Further

- [How it is proved](how-proofs-work.html) — what "proved by the kernel" means.
- [What the kernel proves by itself](what-the-kernel-accepts.html) — the limits of the kernel for programs.
- [A grammar of Russian on pregroups](russian-grammar.html) — how flang parses a Russian sentence.
