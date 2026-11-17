# Check the reasoning in a text

The command `flang run-script argue` takes a text and a markup file for it. It
answers which of the author's conclusions follow from the premises and which do
not. The command works in a clone of the flang repository: it is written in the
repository's `.flangrc`.

flang does not read free text by itself. A human or a language model writes
down what each sentence claims and what is inferred from what, in a markup
file. flang does two things: it compares every quote of the markup with the
text, and it hands every step of the reasoning to the proof kernel.

The checked texts are Russian, so the markup keywords and the report are in
Russian too. The examples below are shown as they are.

## What the check finds

| Finding | How it is obtained |
| --- | --- |
| a conclusion does not follow from its premises | the kernel confirms a case where the premises hold and the conclusion fails |
| a contradiction between two judgments | the kernel derives falsehood from them; they may stand far apart in the text |
| a vicious circle | a conclusion rests on itself, directly or through a chain of steps |
| a shifted term | one word of the text is marked with two different notions |
| a step that is not a proof | the step is marked as a generalisation, a correlation or an appeal to authority |
| a conclusion without premises | a "therefore" has no judgments it is drawn from |
| a gap in the markup | a sentence has "hence" or "so", and the markup has no step for it |

For a step that does not follow, the report names the missing premise when it
can build one, and the kernel checks that the conclusion follows with it.

## Example: from a text to a report

The text is in `docs/examples/argue/service.txt`:

```
Под надёжным сервисом мы понимаем сервис, который отвечает на каждый запрос.
Все сервисы с резервной копией надёжны. Сервис «Архив» имеет резервную копию.
Следовательно, «Архив» надёжен. Пользователи называют «Архив» надёжным, так
что он отвечает на каждый запрос. После перехода на новую базу жалоб стало
меньше, значит, новая база повысила качество.
```

The markup is next to it, in `docs/examples/argue/service.claims`. Its
beginning:

```
понятие с_копией(x): у сервиса x есть резервная копия
понятие надёжен(x): сервис x надёжен
имя Архив

[2] все x: если с_копией(x), то надёжен(x)
    цитата: Все сервисы с резервной копией надёжны
[3] с_копией(Архив)
    цитата: Сервис «Архив» имеет резервную копию
[4] надёжен(Архив)
    цитата: Следовательно, «Архив» надёжен
вывод [4] из [2], [3]
```

A `понятие` line declares a notion and the number of its places. A `[N]` line
is a judgment: a number and a logical form. A `цитата:` line gives the words of
the text the judgment is taken from. The `вывод` line says that the author
infers judgment 4 from judgments 2 and 3.

Run it from the root of the clone:

```bash
flang run-script argue -- docs/examples/argue/service.txt --out report.md
```

```
отчёт записан: report.md; находок: 3; шагов: 3, следует: 1, не следует: 2, ядро не решило: 0
```

The command looks for the markup next to the text: `service.claims` for
`service.txt`. The key `--claims <file>` names another place. Without `--out`
the report is written next to the text as `service.argue.md`. Checking this
text takes about ten seconds.

The report is a Markdown file. Its table of steps:

```
| Шаг | Род | Вердикт |
| --- | --- | --- |
| [4] из [2], [3] | дедукция | следует (доказано ядром) |
| [6] из [5] | ссылка на авторитет | не следует (пример против подтверждён ядром) |
| [8] из [7] | причинное заключение из корреляции | не следует (пример против подтверждён ядром) |
```

The first step is proved. The other two are marked in the markup as not strict,
and the kernel confirms that they do not follow from their premises. About the
step `[8] из [7]` the report says:

```
- **Что не так:** шаг помечен в разметке как «корреляция»: из того, что два признака
  встречаются вместе, не следует, что один вызывает другой.
- **Почему:** из посылок вывод логически не следует; пример против подтверждён ядром:
  верно: `жалоб_меньше`; неверно: `база_повысила_качество`.
- **Чего не хватает:** посылки `если жалоб_меньше, то база_повысила_качество`: с ней
  вывод следует (доказано ядром). В разметке такой посылки нет.
```

The three lines read: what is wrong, why, and what is missing. The third
finding is a shifted term. The word «надёжным» is defined in the first sentence
as "answers every request", and in the fifth it means "the users like it".

## How to get the markup

A ready instruction for a language model is in
`docs/examples/argue/claims-prompt.md`. Give the model this file and the text of
the article, and save the answer as `article.claims`. A human marks a text up
by the same instruction.

The model can be wrong. flang guards against two kinds of mistakes:

- a quote that is not in the text stops the check and names the line of the
  markup: `строка 14 разметки: цитата суждения [2] не стоит в тексте дословно`;
- an undeclared notion, a missing quote and a reference to a judgment that does
  not exist are named with their lines as well.

flang does not see the third kind: a logical form may render the meaning of a
sentence wrongly. Every finding of the report shows the quote next to the form,
so that a human can check it.

Text is taken out of a PDF with `pdftotext article.pdf article.txt`, out of a
Word file with `pandoc article.docx -t plain -o article.txt`.

## The markup format

| Line | Meaning |
| --- | --- |
| `понятие кит(x): пояснение` | a property of a thing |
| `понятие старше(x, y): пояснение` | a relation between two things |
| `понятие дождь: пояснение` | a whole statement |
| `имя Сократ, Моби` | the things the text names |
| `[N] форма` | a numbered judgment |
| `цитата: слова текста` | where the judgment comes from; required |
| `термин: слово = смысл` | the sense a word has in this quote |
| `определение: слово = смысл` | the same for the sentence where the author defines the word |
| `вывод [N] из [M], [K]` | a step of the reasoning |
| `вывод [N] из [M]: корреляция` | a step with its kind |
| `# текст` | a comment |

A logical form is written in words: `не` (not), `и` (and), `или` (or),
`если …, то …` (if … then …), brackets, `все x:` (for all x) and `есть x:`
(there is x). Examples: `все x: если кит(x), то не рыба(x)`,
`есть x: кит(x) и белый(x)`, `если дождь, то мокро`, `старше(Анна, Борис)`.

The kind of a step is `обобщение` (generalisation), `корреляция`
(correlation), `авторитет` (authority) or `определение` (definition). A step
without a kind is claimed to be a strict inference.

## How to read the report

The report opens with a summary: how many sentences the text has, how many of
them are covered by quotes, how many steps the kernel checked and how many
findings of each kind there are.

The section «Находки» lists the mistakes of the reasoning. Each has its quotes
and the lines «Что не так», «Почему» and «Чего не хватает».

The section «Не доказательство» lists the steps that carry a kind. flang does
not refute them. It shows that the conclusion does not follow from the premises
logically and names the premise the author took without stating it.

The section «Ядро не решило» lists the steps that were too large for the
kernel. Such a step has to be split in two in the markup.

The section «Покрытие» names the sentences with inference words the markup did
not touch. This is where the markup is worth reading again.

The words of the report about the kernel:

| Words | What stands behind them |
| --- | --- |
| следует (доказано ядром) | the kernel accepted a proof of the step for all cases |
| не следует (пример против подтверждён ядром) | the kernel computed the premises and the conclusion on the found case: the premises hold, the conclusion fails |
| ядро не решило | the step is larger than the kernel takes, or the kernel did not accept the check |

## What the kernel judges and what it does not

It judges:

- forms without quantifiers over statements and over named things;
- forms with quantifiers of one kind in front: `все x, y: …` or `есть x: …`;
- notions of one place, of two and of more;
- a step that, after the things are substituted, has up to seven elementary
  statements. Up to four the kernel proves by itself; from five to seven it
  checks a case analysis that flang writes down.

It does not judge:

- a form where `все` and `есть` are mixed ("every student has a tutor"): a
  markup with such a form is refused;
- a step with more than seven elementary statements: no proof is handed to the
  kernel, and the report says «ядро не решило». A counterexample is searched
  for while there are at most ten statements;
- equality, numbers and arithmetic inside a form;
- the truth of the premises: only the link between premises and conclusion is
  checked;
- a contradiction between three or more judgments when no two of them
  contradict each other and they are not the premises of one step.

flang expands a quantifier itself: it puts every thing named in the step in
place of the variable. The kernel receives a formula without quantifiers. For
the forms of the "judges" list this substitution is enough: the answer «не
следует» means there is a real counterexample.

## Further

- [How it is proved](how-proofs-work.html) — what "proved by the kernel" means.
- [What the kernel proves by itself](what-the-kernel-accepts.html) — the limits of the kernel for programs.
- [A grammar of Russian on pregroups](russian-grammar.html) — how flang parses a Russian sentence.
