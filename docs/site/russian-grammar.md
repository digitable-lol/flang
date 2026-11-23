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
"разборов 1: в: r · n[предл ж ед 3]ˡ; статье: n[предл ж ед 3]; раскрываются: rʳ · s[мн 3] · n[им мн 3]ˡ; основные: a[им мн]; вопросы: a[им мн]ʳ · n[им мн 3]; связи: вопросы→основные определение, раскрываются→вопросы подлежащее, в→статье предлог, раскрываются→в обстоятельство"
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

Parses are separated by `||`. The program drops none of them but puts them in
order: the preferred one comes first. The preference is simple — a smaller sum
of distances between linked words; an object before the predicate, a subject
after it, a prepositional group attached to a noun, an apposition and a
predicate without a copula cost more. This is a guess about the order, not a
choice: the other parses follow.

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
{"вариант":"Разобрано","разборы":[{"слова":["система","не","является","проблемой"],"леммы":["система","не","являться","проблема"],"части":["сущ","частица перед","глагол","сущ"],"типы":["n[им ж ед 3]","частица перед","n[им ж ед 3]ʳ · s[ед 3] · n[тв ж ед 3]ˡ","n[тв ж ед 3]"],"строй":[[{"вид":"n","падеж":"им","род":"ж","число":"ед","лицо":"3","сопряжение":0}],[],[{"вид":"n","падеж":"им","род":"ж","число":"ед","лицо":"3","сопряжение":1},{"вид":"s","падеж":"*","род":"*","число":"ед","лицо":"3","сопряжение":0},{"вид":"n","падеж":"тв","род":"ж","число":"ед","лицо":"3","сопряжение":-1}],[{"вид":"n","падеж":"тв","род":"ж","число":"ед","лицо":"3","сопряжение":0}]],"связи":[{"главное":3,"зависимое":4,"роль":"дополнение в творительном"},{"главное":3,"зависимое":1,"роль":"подлежащее"},{"главное":3,"зависимое":2,"роль":"частица перед"}]}],"сверх":{"цены":[3],"пометы":[["","","отрицание",""]],"вид":"предложение"},"всего":1,"работа":4}
```

| Field | What it holds |
| --- | --- |
| `разборы` | the list of parses; the fields of a parse are below |
| `всего` | how many parses the sentence really has |
| `работа` | how many pairs of pieces of the sentence were compared |
| `сверх` | per parse: `цены`, the cost the parses are ordered by, and `пометы`, the marks of the words — `отрицание` negation, `заглавное` capitalised, `имя` name, `сравнение` comparison; `вид` — `предложение` sentence or `назывное` nominative sentence |

A parse has six fields; the lists go word by word:

| Field of a parse | What it holds |
| --- | --- |
| `слова` | the words of the sentence in lower case |
| `леммы` | the dictionary form of every word |
| `части` | the part of speech; for a word that takes no part in the parse, its role |
| `типы` | the type of the word as a string, as in `«Разобрать подробно»` |
| `строй` | the same type as a list of simple types: kind, case, gender, number, person and adjoint (1 right, −1 left, 0 the letter itself) |
| `связи` | the head word, the dependent word and the role; words are named by number, counted from one |

`«Разборы»` gives at most eight parses, while `всего` counts all of them,
including those that differ only in the reading of a word under the same
links; such parses do not enter the list twice.
`«Разборы по словарю»` gives more: the number of parses is its third argument.
When there is no parse, the variant is `Не разобрано` with the fields `причина`
(reason), `слово` (word), `место` (position) and `работа`.

## A parse for building a logical form

Whoever builds a logical form from a parse is better served by a record per
word. `«Разборы для смысла»` gives it (sentence, dictionary, how many parses to
list):

```
$ flang run flang/ct/russian/sentence.flang --function '«Разборы для смысла по пробному словарю»' --args '{"предложение":"Система не является проблемой."}'
доказано: утверждений 9
{"разборы":[{"слова":[{"слово":"система","лемма":"система","часть":"сущ","тип":[{"вид":"n","падеж":"им","род":"ж","число":"ед","лицо":"3","сопряжение":0}]},{"слово":"не","лемма":"не","часть":"не","тип":[]},{"слово":"является","лемма":"являться","часть":"связка","тип":[{"вид":"n","падеж":"им","род":"ж","число":"ед","лицо":"3","сопряжение":1},{"вид":"s","падеж":"*","род":"*","число":"ед","лицо":"3","сопряжение":0},{"вид":"n","падеж":"тв","род":"ж","число":"ед","лицо":"3","сопряжение":-1}]},{"слово":"проблемой","лемма":"проблема","часть":"сущ","тип":[{"вид":"n","падеж":"тв","род":"ж","число":"ед","лицо":"3","сопряжение":0}]}],"связи":[{"левое":3,"правое":4},{"левое":1,"правое":3}],"роли":["дополнение в творительном","подлежащее"],"стыки":[{"откуда":3,"гнездо":3,"куда":4,"паз":1},{"откуда":1,"гнездо":1,"куда":3,"паз":1}],"пометы":["","","отрицание",""],"приставные":[{"главное":3,"зависимое":2,"роль":"частица перед"}],"цена":3}],"всего":1,"причина":"","слово":"","вид":"предложение"}
```

| Field | What it holds |
| --- | --- |
| `слова` | for every word: the word, the lemma, the part of speech and the type as a list of simple types |
| `связи` | pairs of numbers of the words whose types cancelled: the left word and the right one |
| `роли` | the role of every link, in the same order |
| `стыки` | which simple type cancelled with which: `откуда` and `гнездо` are the left word and the number of the simple type inside its type, `куда` and `паз` are the right word and the number inside its type |
| `пометы` | per word: `отрицание` — «не» stands before the word, `заглавное` — a capitalised word that is not the first one, `имя` — the dictionary marks the word as a proper name |
| `приставные` | links of words without a type: particles, insertions, parenthetical words — head, dependent and role |
| `цена` | the cost of the parse; parses go from cheap to expensive |

The record itself also has the field `вид`: `предложение`, `назывное`, or empty
when there is no parse.

The part of speech is refined here by lemma and by role: `квантор` quantifier
(«каждый», «все»), `модальное` modal («может», «можно», «необходимо»),
`связка` copula («является», «быть»), `бытийный` existence verb
(«существует»), `местоимение` pronoun, `числительное` numeral, `имя` name (a word marked `имя` or `заглавное`),
`родительный` a noun in the genitive attached to another noun, `сказ_прил` an
adjective inside the predicate. A word that takes no part in the parse has an
empty type; its part of speech is the word itself for «не», «то», «ни» and the
role for the others.

A pronoun gets the type of a noun phrase and does not break the parse: what it
refers to is not for the grammar to decide. Nor does the grammar interpret a
singular subject: «иерархия затрудняет» is about one hierarchy and about any.

A unit of text without a predicate — a heading, a fragment, a table row — gets
the reason `нет сказуемого`. That is how such a unit is told from a sentence.

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
`раскрываются: rʳ · s[мн 3] · n[им мн 3]ˡ` the verb waits for a prepositional
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
`вывод`, `пояснение` explanation after a colon, `сравнение` comparison,
`содержание` content of a complement clause, `косвенная речь` reported speech,
`источник` source.

Three roles serve whoever builds the meaning from a parse. `содержание` links
the conjunction «что» to the verb of its clause: everything under it is said
or thought, not asserted by the author. `косвенная речь` links a verb of
speech or thought («показал», «считает», «отмечает») to such a clause; whose
words they are is told by the subject of that verb. `источник` marks «как
показывает автор», «по мнению автора», «согласно данным»: whom the sentence
refers to.

## What is read

For every row of the table there are sentences that must parse and sentences
with a mistake that must not. They are all written in the table
`expected.tsv` of the probe set `russian-sentence`.

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
| predicate without a copula | Дорога мокрая. Сократ не рыба. Если идет дождь, то дорога мокрая. |
| apposition with a name and between dashes | Сервис Архив имеет резервную копию. Одно из направлений — сети — переживает становление. |
| paired conjunction «как …, так и» | Автор рассматривает как систему, так и задачу. |
| «и» in the sense of "also" | В статье рассматриваются и задачи. |
| predicate with a measure | Расходы были равны 10 %. |
| short form and passive | Задача сложна. Задача была решена автором. |
| negation | Автор не решает задачи. |
| parenthetical and conclusion words | Автор, например, рассматривает проблему. Поэтому система работает. |
| brackets and references | Автор рассматривает систему (узел) и задачу. Автор рассматривает систему [12]. |
| numbers, units, numerals | Автор рассматривает три основных типа систем. Доля системы составляет 10 %. |
| infinitive with a verb and with «можно», «необходимо» | Эту задачу можно решать. |
| comparison | Автор рассматривает систему как узел. Система важнее задачи. |
| fixed phrases | Автор рассматривает систему в качестве узла. |
| explanation after a colon, in any case | Автор выделяет три задачи: систему, узел и сеть. Задача решена: система работает. |
| comparison with «чем», «более … чем» | Система работает лучше, чем узел. Система более сложна, чем узел. |
| reported speech and a source | Автор показывает, что система работает. По мнению автора, система работает. |
| nominative and elliptical sentences | Введение. Первый узел работает быстро, второй — медленно. |
| apposition between commas, a repeated conjunction | Автор, брат мамы, читает книгу. Автор рассматривает и систему, и узел, и сеть. |
| a hyphen left inside a word by line breaking | Автор рассматривает сис-тему. |

The full inventory of construction kinds taken from a reference book of Russian
syntax — with the article, volume and page, examples and the grammar's answer —
is on the page
[«Какие конструкции русского предложения читает грамматика»](https://github.com/digitable-lol/flang/blob/dev/docs/russian-syntax-coverage.md)
(in Russian): 89 of 94 kinds are read.

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

A dictionary can also be given as a table: one line per reading, ten fields
separated by spaces — form, lemma, part of speech as a full word, case,
gender, number, person, tense, marks separated by commas, source. It is read
by `«Разборы по таблице признаков»` and `«Разобрать по таблице признаков»`:

```
$ flang run flang/ct/russian/sentence.flang --function '«Разобрать по таблице признаков»' --args '{"предложение":"Мама спит.","таблица":"мама мама существительное им ж ед * * одуш словарь\nспит спать глагол * * ед 3 наст несов,неперех словарь"}'
доказано: утверждений 9
"разборов 1: мама: n[им ж ед 3]; спит: n[им ж ед 3]ʳ · s[ед 3]; связи: спит→мама подлежащее"
```

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
it answered a sentence in 0.17 seconds at the median and in at most 1.9
seconds, counting the start of the process.

For a page in a browser the same program is printed in JavaScript:

```
$ flang emit flang/ct/russian/sentence.flang --target js --out build/russian-js
```

The parsing functions are pure and print without changes. Called inside the
process, the JavaScript version answered the same sentences in 0.02 seconds at
the median; 29 sentences of 1338 took more than a second, six took more than
two, all of them 33 to 58 words long.

A parse does not hang. It counts how many pairs of pieces of the sentence it
has compared and stops at 40,000 pairs with the reason `превышен предел работы`.
On the twelve articles 11 sentences out of 1338 hit the limit.

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
  36 not. Run: `flang run-script russian-grammar:probe`.
- **Checked by probes** of scientific prose: 201 sentences on 113 kinds of
  constructions, 154 must parse and 47 must not. Run:
  `flang run-script russian-sentence:probe`.
- **Measured on twelve scientific articles**, 1338 units of text: a line of an
  article or a part of it up to a full stop; word features come from the
  OpenCorpora dictionary. 645 units with a predicate are parsed whole. Another
  285 are headings and captions parsed as nominative sentences; 69 are not
  parsed and have no predicate: table rows, formulas, reference lists. 131
  units contain a word the dictionary does not know. The earlier `«Разобрать»`
  parsed none of the same units.
- **There are many parses.** Of the 645 parsed sentences with a predicate 83
  have one parse, in another 381 the first parse is strictly preferred to the
  second, in 181 the first parses cost the same. What differs most often: the
  place of a prepositional group or an adverb, the word a genitive belongs to,
  subject versus object for a form that is the same in the nominative and the
  accusative, modifier versus predicate, the members of a coordination. On 30
  sentences labelled by hand the first parse is right in 19.
- **Checked by nothing:** that the reason given is the one a person would
  give. The
  texts of the articles are not in the repository, so the measurement on the
  articles cannot be repeated with a command from the repository.

What the grammar does not read yet:

- questions with a question word («Почему система работает?») and commands;
- an infinitive sentence («Решить задачу.») and a part of a sentence cut off by
  a full stop («И задачу.»);
- an adjective or a participle in place of a noun («учащиеся», «следующее»),
  except after a preposition and after a pronominal word;
- a dative with a verb that is not in the list, when the form also reads as
  another case;
- formulas, table rows, reference lists.

The letter ё is read as е: words are looked up in the dictionary spelt with «е».

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
