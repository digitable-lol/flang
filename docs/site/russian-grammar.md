# Russian grammar as a pregroup

This page shows how to parse a Russian sentence in flang. Every word has a
type, the types are multiplied, and the sentence is grammatical when the
product reduces to the single type `s`, "sentence". This is Lambek's pregroup
grammar. The program lives in `flang/ct/russian/`.

There are two entry points. `«Разобрать»` in `parse.flang` gives one verdict on
a simple sentence made of the words of its own dictionary. `«Разборы»` in
`sentence.flang` reads sentences of scientific prose — prepositional groups
anywhere, coordination, subordinate clauses, participial phrases, brackets and
numbers — and returns every parse, not one.

The answers are in Russian, like the data: `разборов 2` means two parses, `не
разобрано` means not parsed, `связи` are the links between words.

## Parse a sentence of an article

```
$ flang run flang/ct/russian/sentence.flang --function '«Разобрать подробно»' --args '{"предложение":"В статье раскрываются основные вопросы."}'
доказано: утверждений 9
"разборов 1: в: r · n[предл ж ед 3]ˡ; статье: n[предл ж ед 3]; раскрываются: rʳ · s[мн 3] · n[им м мн 3]ˡ; основные: a[им мн]; вопросы: a[им мн]ʳ · n[им м мн 3]; связи: вопросы→основные определение, раскрываются→вопросы подлежащее, в→статье предлог, раскрываются→в обстоятельство"
```

("The article sets out the main questions.") The first line says how many
claims about the program are proved; `run` prints it before the answer. The
answer has three parts: the number of parses, the type of every word and the
links. A link reads "head→dependent role": `раскрываются→вопросы подлежащее`
is "sets out → questions, subject".

A sentence that reads several ways gets all its parses. Here the prepositional
group belongs either to the verb or to the noun:

```
$ flang run flang/ct/russian/sentence.flang --function '«Разобрать подробно»' --args '{"предложение":"Мама в доме читает книгу."}'
доказано: утверждений 9
"разборов 2: мама: n[им ж ед 3]; в: r · n[предл м ед 3]ˡ; доме: n[предл м ед 3]; читает: rʳ · n[им ж ед 3]ʳ · s[ед 3] · n[вин ж ед 3]ˡ; книгу: n[вин ж ед 3]; связи: читает→книгу дополнение, в→доме предлог, читает→в обстоятельство, читает→мама подлежащее || мама: n[им ж ед 3] · rˡ; в: r · n[предл м ед 3]ˡ; доме: n[предл м ед 3]; читает: n[им ж ед 3]ʳ · s[ед 3] · n[вин ж ед 3]ˡ; книгу: n[вин ж ед 3]; связи: читает→книгу дополнение, в→доме предлог, мама→в предложное определение, читает→мама подлежащее"
```

Parses are separated by `||`. The program does not choose between them: the
choice belongs to whoever knows the meaning.

A conclusion word gets a link of its own, so a step of reasoning is visible
without a dictionary:

```
$ flang run flang/ct/russian/sentence.flang --function '«Разобрать подробно»' --args '{"предложение":"Следовательно, система работает."}'
доказано: утверждений 9
"разборов 1: следовательно: вывод; система: n[им ж ед 3]; работает: n[им ж ед 3]ʳ · s[ед 3]; связи: работает→система подлежащее, система→следовательно вывод"
```

## When there is no parse

The answer names the reason and the word where the parse stopped:

```
$ flang run flang/ct/russian/sentence.flang --function '«Разобрать подробно»' --args '{"предложение":"Мама читает книга."}'
доказано: утверждений 9
"не разобрано: неверный падеж, слово «книга»"
$ flang run flang/ct/russian/sentence.flang --function '«Разобрать подробно»' --args '{"предложение":"Автор рассматривает систему, который решает задачу."}'
доказано: утверждений 9
"не разобрано: нет согласования по роду, числу или лицу, слово «решает»"
$ flang run flang/ct/russian/sentence.flang --function '«Разобрать подробно»' --args '{"предложение":"Мама читает куздру."}'
доказано: утверждений 9
"не разобрано: неизвестное слово, слово «куздру»"
$ flang run flang/ct/russian/sentence.flang --function '«Разобрать подробно»' --args '{"предложение":"Мама книгу."}'
доказано: утверждений 9
"не разобрано: нет сказуемого"
```

| Reason | Meaning |
| --- | --- |
| `неизвестное слово` | unknown word: it is neither in the closed lists nor in the dictionary |
| `нет сказуемого` | no predicate: no verb, no short form, no dash, no «это» |
| `нет согласования по роду, числу или лицу` | the sentence parses once agreement is not checked |
| `неверный падеж` | the sentence parses once cases are not checked |
| `неверный падеж и нет согласования` | it parses only without both checks |
| `слова не связываются в предложение` | the words are known but there is no whole parse |
| `превышен предел работы` | the parse was stopped: the sentence is too ambiguous |
| `предложение длиннее предела` | the sentence has more than 60 words |

The reasons about agreement and case are looked for only in sentences of up to
12 words. Without those checks almost any long sentence parses, so the reason
would say nothing.

The word named in the answer is the first one that no piece of a parse started
at the beginning of the sentence could reach. It is often the place of the
mistake, but not always.

## The answer for a program

`«Разборы»` returns the same answer as a value, not a string:

```
$ flang run flang/ct/russian/sentence.flang --function '«Разборы»' --args '{"предложение":"Система не является проблемой."}'
доказано: утверждений 9
{"вариант":"Разобрано","разборы":[{"слова":["система","не","является","проблемой"],"типы":["n[им ж ед 3]","частица перед","n[им ж ед 3]ʳ · s[ед 3] · n[тв ж ед 3]ˡ","n[тв ж ед 3]"],"связи":[{"главное":3,"зависимое":4,"роль":"дополнение в творительном"},{"главное":3,"зависимое":1,"роль":"подлежащее"},{"главное":3,"зависимое":2,"роль":"частица перед"}]}],"всего":1,"работа":4}
```

| Field | What it holds |
| --- | --- |
| `разборы` | the list of parses; each has the words, the type of every word and the links by word number, counted from one |
| `всего` | how many parses the sentence really has |
| `работа` | how many pairs of pieces of the sentence were compared |

`«Разборы»` gives at most eight parses, while `всего` counts all of them.
`«Разборы по словарю»` gives more: the number of parses is its third argument.
When there is no parse, the variant is `Не разобрано` with the fields `причина`
(reason), `слово` (word), `место` (position) and `работа`.

## How to read a type

| Written | Meaning |
| --- | --- |
| `n[им ж ед 3]` | noun phrase: nominative, feminine, singular, third person |
| `a[вин мн]` | modifier: an adjective or a participle |
| `s[ед 3]` | a predicate with everything that belongs to it |
| `r` | a preposition with its noun phrase |
| `d` | adverb |
| `i`, `g` | an infinitive and a gerund with their dependents |
| `c` | a subordinating conjunction with its clause |
| `&` | a coordinating conjunction with the word it joins |
| `q` | numeral |
| `aʳ` | waits for `a` on the left: `a · aʳ` cancels |
| `aˡ` | waits for `a` on the right: `aˡ · a` cancels |

The type of a word is its own letter and one adjoint for each dependent word:
those that wait for a dependent on the left stand to the left of the letter,
those that wait on the right stand to the right. In
`раскрываются: rʳ · s[мн 3] · n[им м мн 3]ˡ` the verb waits for a prepositional
group on the left and for the subject on the right.

Words that take no part in the parse carry a role instead of a type: `частица
перед` and `частица после` (a particle before or after a word), `вставка`
(brackets and references like [12]), `инициал` (an initial), `вводное` (a
parenthetical word), `вывод` (a conclusion word), `союз в начале` (a
conjunction that opens the sentence).

Link roles: `подлежащее` subject, `дополнение` object, `дополнение в
родительном`, `в дательном`, `в творительном` object in the genitive, dative,
instrumental, `именная часть` nominal part of the predicate, `инфинитив`,
`обстоятельство` adverbial, `определение` modifier, `обособленное определение`
detached modifier, `родительное` genitive attribute, `предложное определение`
prepositional attribute, `приложение` apposition, `количество` quantity,
`предлог` preposition, `союз` conjunction, `однородное` coordinated member,
`изъяснительное` complement clause, `придаточное` adverbial clause,
`придаточное определительное` relative clause, `деепричастный оборот` gerund
phrase, `подлежащее при связке` subject of a verbless predicate, `вводное`,
`вывод`.

## What is read

For every row of the table there are sentences that must parse and sentences
with a mistake that must not. They all lie in
`flang/proof/probes/russian-sentence/expected.tsv`.

| Construction | Example |
| --- | --- |
| a prepositional group or an adverb anywhere | Автор в статье рассматривает проблему. |
| agreeing modifier | Автор рассматривает важную научную проблему. |
| chain of genitives | Автор рассматривает проблему формирования системы управления. |
| coordination with «и», «или», «а также», with commas | Автор рассматривает проблему, задачу и систему. |
| coordinated predicates | Автор рассматривает проблему и решает задачу. |
| clause with «что» | Автор считает, что система работает. |
| clause with «который» | Автор рассматривает систему, в которой работает узел. |
| clause with «если», «так как», «поскольку» | Если система работает, то автор решает задачу. |
| participial phrase | Автор рассматривает вопросы, связанные с эволюцией системы. |
| gerund phrase | Рассматривая проблему, автор решает задачу. |
| copula and dash | Система — это узел. Система является проблемой. |
| short form and passive | Задача сложна. Задача была решена автором. |
| negation | Автор не решает задачи. |
| parenthetical and conclusion words | Автор, например, рассматривает проблему. Поэтому система работает. |
| brackets and references | Автор рассматривает систему (узел) и задачу. Автор рассматривает систему [12]. |
| numbers, units, numerals | Автор рассматривает три основных типа систем. Доля системы составляет 10 %. |
| infinitive with a verb and with «можно», «необходимо» | Эту задачу можно решать. |
| comparison | Автор рассматривает систему как узел. Система важнее задачи. |
| fixed phrases | Автор рассматривает систему в качестве узла. |

## Where word features come from

The type of a word is derived from its part of speech and features. For the
open classes — nouns, adjectives, verbs, adverbs — the features come from a
dictionary:

```
$ flang run flang/ct/russian/sentence.flang --function '«Признаки слова»' --args '{"форма":"задачи"}'
доказано: утверждений 9
[{"лемма":"задача","часть":"сущ","падеж":"род","род":"ж","число":"ед","лицо":"*","время":"*","прочее":"*"},{"лемма":"задача","часть":"сущ","падеж":"им","род":"ж","число":"мн","лицо":"*","время":"*","прочее":"*"},{"лемма":"задача","часть":"сущ","падеж":"вин","род":"ж","число":"мн","лицо":"*","время":"*","прочее":"*"}]
```

An unknown word gets an empty list. For now `«Признаки слова»` reads a small
sample dictionary, `sample-dictionary.flang`: it holds only the words of the
examples on this page and of the probes. Your own dictionary goes to
`«Разборы по словарю»`: its second argument is a list of strings of the form
`form=lemma,part,case,gender,number,person,tense,marks`.

```flang fragment
«Разборы по словарю» от "Мама спит." и ["мама=мама,сущ,им,ж,ед", "спит=спать,глагол,*,*,ед,3,наст"] и 8
```

| Field | Values |
| --- | --- |
| part | `сущ` noun, `мест` pronoun, `прил` adjective, `прич` participle, `кр_прил` and `кр_прич` short forms, `глагол` verb, `инф` infinitive, `деепр` gerund, `нареч` adverb, `комп` comparative, `числ` numeral, `предик` predicative |
| case | `им`, `род`, `дат`, `вин`, `тв`, `предл` |
| gender, number, person | `м`, `ж`, `с`; `ед`, `мн`; `1`, `2`, `3` |
| tense | `наст`, `прош`, `буд` |
| marks | separated by spaces: `перех` transitive, `страд` passive, `возвр` reflexive, `неизм` indeclinable, `местоим` pronominal adjective, `сокр` abbreviation |

An asterisk or a missing tail means "not set". A form with several readings has
several strings.

The closed classes — prepositions with their cases, conjunctions, particles,
parenthetical words, conclusion words, fixed phrases — are written in
`lexicon.flang` and are not taken from the dictionary. A number, a word in
Latin letters and a text in quotation marks count as a name in any case. So
does an unknown capitalised word that is not the first word of the sentence.

## What it costs

`flang run` checks the program itself before it runs, so one sentence takes
about ten seconds and a long one takes minutes. For a whole article, build the
program into an executable:

```
$ flang emit flang/ct/russian/sentence.flang --target c --out build/russian --cli
$ make -C build/russian
$ printf '%s\n' '{"fn":"Разобрать подробно","args":[{"s":"Мама читает книгу."}]}' | build/russian/flang_cli
{"ok":true,"value":{"s":"разборов 1: мама: n[им ж ед 3]; читает: n[им ж ед 3]ʳ · s[ед 3] · n[вин ж ед 3]ˡ; книгу: n[вин ж ед 3]; связи: читает→книгу дополнение, читает→мама подлежащее"}}
```

The built program reads requests one per line. On twelve scientific articles
it answered a sentence in 0.07 seconds at the median and in at most 0.23
seconds; most of that time is the start of the process.

A parse does not hang. It counts how many pairs of pieces of the sentence it
has compared and stops at 40,000 pairs with the reason `превышен предел работы`.
On the twelve articles two sentences out of 1338 hit the limit.

## What is checked and what is not

- **Proved** for all inputs: adjoints and multiplication of types keep the
  length they should, and one contraction never makes a type longer. See
  `flang check flang/ct/russian/pregroup.flang --proof`: 9 of 9 proved. The
  independent proof checker (`FLANG_CHECKER`) replayed 2 of them; the other 7
  are checked by the kernel alone.
- **Counted on examples:** the pregroup laws — associativity of
  multiplication, `(aˡ)ʳ = a`, `aˡ · a → 1` — in
  `flang/ct/russian/category.flang`. The `--proof` report on that file: 7
  claims, 0 proved, 7 on the grid; exit code 3.
- **Checked by probes** of simple sentences: 75 sentences, 39 grammatical and
  36 not. Run:
  `flang io flang/proof/probes/russian-grammar/run.fscript --plan Binary`.
- **Checked by probes** of scientific prose: 108 sentences on 46 rows of
  constructions, 71 must parse and 37 must not. Run from the directory
  `flang/proof/probes/russian-sentence`: `flang io run.fscript --plan Binary`.
- **Measured on twelve scientific articles**, 1338 units of text: a line of an
  article or a part of it up to a full stop. 574 are parsed whole, which is
  43 %. The earlier `«Разобрать»` parsed none of the same units. Another 356
  units are headings, table rows and reference lists without a predicate, and
  221 units contain a word the dictionary does not know. Among the units with
  a predicate and known words, 75 % are parsed.
- **There are many parses.** 78 sentences out of 574 have one parse, 110 have
  two to four, 386 have more than four. The main reasons: a prepositional
  group that fits both the verb and the noun; a form that is the same in the
  nominative and the accusative; a genitive after coordinated members.
- **Checked by nothing:** that the parse a person would give is among those
  returned, and that the reason given is the one a person would give. The
  texts of the articles are not in the repository, so the measurement on the
  articles cannot be repeated with a command from the repository.

What the grammar does not read yet:

- questions and commands;
- «и» in the sense of "also" («рассматривались и политические явления»);
- paired conjunctions «как …, так и», «не только …, но и», «либо …, либо»;
- an explanation after a colon and an apposition between dashes;
- an adjective or a participle in place of a noun («учащиеся», «следующее»),
  except after a preposition and after a pronominal word;
- a predicate that is a full adjective without a copula («каталепсия более
  выраженная»);
- a dative with a verb that is not in the list, when the form also reads as
  another case;
- formulas, table rows, reference lists.

## The simple verdict: «Разобрать»

`«Разобрать»` in `parse.flang` knows the 141 word forms of its dictionary and
gives one verdict:

```
$ flang run flang/ct/russian/parse.flang --function «Разобрать» --args '{"предложение":"Мама читает книгу."}'
доказано: утверждений 11
"грамматично: мама: n[им ж ед 3]; читает: n[им ед 3]ʳ · s · n[вин]ˡ; книгу: n[вин ж ед 3]; связи: мама—читает, читает—книгу"
```

("Mum reads a book.") `грамматично` means grammatical, `не грамматично` means
not. Word order is free, as in Russian:

```
$ flang run flang/ct/russian/parse.flang --function «Разобрать» --args '{"предложение":"книгу мама читает"}'
доказано: утверждений 11
"грамматично: книгу: n[вин ж ед 3]; мама: n[им ж ед 3]; читает: n[им ед 3]ʳ · n[вин]ʳ · s; связи: мама—читает, книгу—читает"
```

An ungrammatical sentence gets a reason:

```
$ flang run flang/ct/russian/parse.flang --function «Разобрать» --args '{"предложение":"мама читает книга"}'
доказано: утверждений 11
"не грамматично: неверный падеж"
$ flang run flang/ct/russian/parse.flang --function «Разобрать» --args '{"предложение":"мама читают книгу"}'
доказано: утверждений 11
"не грамматично: нет согласования по роду, числу или лицу"
$ flang run flang/ct/russian/parse.flang --function «Разобрать» --args '{"предложение":"мама книгу"}'
доказано: утверждений 11
"не грамматично: нет сказуемого"
$ flang run flang/ct/russian/parse.flang --function «Разобрать» --args '{"предложение":"мама шьёт"}'
доказано: утверждений 11
"не грамматично: неизвестное слово «шьёт»"
```

The reasons are: wrong case; no agreement in gender, number or person; no
predicate; unknown word. A fifth one, `типы слов не сводятся к s`, means the
types do not reduce to `s` for any other reason. This entry point does not take
an adverbial in the middle of a sentence, and `«Разборы»` does:

```
$ flang run flang/ct/russian/parse.flang --function «Разобрать» --args '{"предложение":"мама в доме читает"}'
доказано: утверждений 11
"не грамматично: типы слов не сводятся к s"
```

In this entry point a verb is written as what it waits for, and the program
builds the types for every word order itself:

```flang fragment
«Переходный» от "читает" и («Подлежащее настоящего» от "ед" и "3") и "вин"
```

`«Типы слова»` shows the types a word got:

```
$ flang run flang/ct/russian/parse.flang --function '«Типы слова»' --args '{"слово":"читает"}'
доказано: утверждений 11
"s · n[им ед 3]ˡ; n[им ед 3]ʳ · s; s · n[вин]ˡ · n[им ед 3]ˡ; n[им ед 3]ʳ · s · n[вин]ˡ; n[вин]ʳ · n[им ед 3]ʳ · s; s · n[им ед 3]ˡ · n[вин]ˡ; n[вин]ʳ · s · n[им ед 3]ˡ; n[им ед 3]ʳ · n[вин]ʳ · s"
```

## Where next

- [Parsing an utterance against a concept graph](russian-syntax.html) — the same
  dictionary checks agreement between word forms in an analysis of a sentence.
- [The category surface](categories.html) — what the compiler does with a
  declared category and monoid.
- [What is proved and what is not](what-is-proved.html) — the same boundary
  across the whole language.
