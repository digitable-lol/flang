# Parsing a Russian utterance against a concept graph

The module `flang/ct/russian/syntax.flang` checks an analysis of a Russian
utterance. The analysis is a text file. Each line is one claim. The module checks
the claim against two sources: it looks the concept up in a slice of the concept
graph of the Russian Academy Grammar (1980), and it takes the grammatical tags of
word forms from the dictionary of the [pregroup grammar](russian-grammar.html).

## Line format

A line reads `role: content`. The role is everything before the first `: `.

- `Высказывание: …` — the utterance under analysis.
- `Уровень: <concept>` — a step from the general to the particular: speech, written
  speech, monologue, text, context, situation, utterance. Each step is linked by a
  graph arrow to an earlier step, directly or through its parents. Otherwise the
  output says «Разрыв уровней» (broken chain).
- `Согласование в роде, числе и падеже: <dependent> → <head>` — agreement check of
  two word forms. `Координация в числе и лице: …` works the same way. The role
  names the categories: gender («роде»), number («числе»), case («падеже»), person
  («лице»). A role without them checks all four.
- `Опоры нет: <what>` — the graph has no concept for this. The line goes to the
  output as is.
- Any other role — the content is a concept name. The output gives the concept, its
  paragraph, a quote and the path from the general concept down to it. An unknown
  name gives «Нет в графе» (not in the graph).

A category is checked only when both word forms carry it. A plural form has no
gender, so gender is skipped. When no category could be checked, the pair counts as
not agreeing. A word form missing from the dictionary gives «Нет помет» (no tags).

## Running

The result of an analysis in one line:

```sh
flang run flang/ct/russian/syntax.flang --function '«Итог разбора»' \
  --args "$(jq -Rs '{"текст разбора": .}' flang/ct/russian/syntax-texts/first-sentence.dsl)"
```

```
"опор 25, сверок 11, без опоры 4, разрывов 0, нет в графе 0, нет помет 0, не согласовано 0"
```

That is: 25 concepts found, 11 agreement checks, 4 lines without support, no broken
chain, no unknown concept, no word form without tags, no failed agreement.

The function `«Разобрать высказывание»` takes the same arguments and prints the whole
analysis as a JSON list. Three kinds of entries from it:

```json
{"вариант":"Опора","роль":"Уровень","узел":"письменная речь","место":"§ 1890","цитата":"Языковое общение людей (языковая коммуникация), как непосредственное, устное, так и письменное, осуществляется в форме, которую можно назвать потоком речи или просто речью.","путь":"речь → письменная речь"}
{"вариант":"Связь форм","сверка":{"роль":"Согласование в роде, числе и падеже","зависимое":"русский","главное":"язык","проверено":[{"название":"род","общие":["мужской род"]},{"название":"число","общие":["единственное число"]},{"название":"падеж","общие":["именительный падеж","винительный падеж"]}],"согласовано":true}}
{"вариант":"Опоры нет","что":"запятая между частями — Правила 1956 года, § 143; правил знаков в графе нет"}
```

A broken chain looks like this:

```sh
flang run flang/ct/russian/syntax.flang --function '«Итог разбора»' \
  --args '{"текст разбора": "Уровень: речь\nУровень: схема 4. N₁ — N₁"}'
```

```
"опор 1, сверок 0, без опоры 0, разрывов 1, нет в графе 0, нет помет 0, не согласовано 0"
```

No arrow links a sentence pattern to speech.

`«Найти пометы»` shows the tags of one word form:

```sh
flang run flang/ct/russian/syntax.flang --function '«Найти пометы»' --args '{"словоформа":"системой"}'
```

```json
{"вариант":"Найдены","найденные":[{"разряд":"род","значение":"женский род"},{"разряд":"число","значение":"единственное число"},{"разряд":"падеж","значение":"творительный падеж"},{"разряд":"лицо","значение":"3 лицо"}]}
```

## Examples

The first three sentences of the grammar's Introduction are analysed in
`flang/ct/russian/syntax-texts/`:

| File | Lines | Result |
|---|---:|---|
| `first-sentence.dsl` | 41 | 25 concepts found, 11 agreement checks, 4 lines without support |
| `second-sentence.dsl` | 23 | 15 concepts found, 6 agreement checks, 1 line without support |
| `third-sentence.dsl` | 24 | 15 concepts found, 7 agreement checks, 1 line without support |

In all three files the steps are linked, every concept name is found and every
agreement check passes.

## Where the data comes from

The concepts live in `flang/ct/russian/syntax-graph.flang`. It holds a slice of the
grammar's concept graph: 97 concepts and 126 arrows. The slice holds the concepts
named in the three files and all their parents along the arrows «вид», «входит в»,
«является», «деление». Each concept carries its paragraph of the grammar and one
verbatim quote from it.

The tags — gender, number, case and person — are read from the dictionary
`flang/ct/russian/lexicon.flang`, the same one the pregroup grammar parses sentences
with. The module keeps no tag table of its own. The word forms of the three analyses
are entered in the dictionary, which now has six cases: the instrumental (`тв`) was
added. The [grammar page](russian-grammar.html) shows how to enter a new word.

## Limits

- The slice covers the three examples. A new concept in an analysis needs a new
  slice; a new word form needs a line in the dictionary.
- The graph has no punctuation rules and no morphology concepts. Such lines are
  marked «Опоры нет».
- The agreement check does not pick a homonym. It looks for a shared value among all
  the readings of a word form that the dictionary lists.
- The dictionary lists the readings of the word that stands in the analysed
  sentences. Readings that belong to homonyms from other words are not listed.
- A noun carries the third person in the dictionary: the verb coordinates with it.
