# Parsing a Russian utterance against a concept graph

The module `flang/experimental/ru-syntax.flang` checks an analysis of a Russian
utterance. The analysis is a text file. Each line is one claim. The module checks
the claim against the concept graph of the Russian Academy Grammar (1980) and
against the grammatical tags of word forms.

## Line format

A line reads `role: content`. The role is everything before the first `: `.

- `Высказывание: …` — the utterance under analysis.
- `Уровень: <concept>` — a step from the general to the particular: speech, written
  speech, monologue, text, context, situation, utterance. Each step is linked by a
  graph arrow to an earlier step, directly or through its parents. Otherwise the
  output says «Разрыв уровней» (broken chain).
- `Согласование в роде, числе и падеже: <dependent> → <head>` — agreement check of
  two word forms. `Координация в падеже и числе: …` works the same way. The role
  names the categories: gender («роде»), number («числе»), case («падеже»), person
  («лице»). A role without them checks all four.
- `Опоры нет: <what>` — the graph has no concept for this. The line goes to the
  output as is.
- Any other role — the content is a concept name. The output gives the concept, its
  paragraph, a quote and the path from the general concept down to it. An unknown
  name gives «Нет в графе» (not in the graph).

A category is checked only when both word forms carry it. A plural adjective has no
gender, so gender is skipped. The first and second genitive count as genitive; the
first and second prepositional count as prepositional.

## Running

```sh
jq -Rs '{"текстРазбора": .}' flang/experimental/texts/syntax-first-sentence.dsl > args.json
bootstrap/flang run flang/experimental/ru-syntax.flang --function 'Разобрать высказывание' \
  --args "$(cat args.json)"
```

The output is a JSON list:

```json
{"вариант":"Опора","роль":"Уровень","узел":"письменная речь","место":"§ 1890","цитата":"Языковое общение людей (языковая коммуникация), как непосредственное, устное, так и письменное, осуществляется в форме, которую можно назвать потоком речи или просто речью.","путь":"речь → письменная речь"}
{"вариант":"Связь форм","рольСвязи":"Согласование в роде, числе и падеже","зависимое":"русский","главное":"язык","проверено":[{"название":"род","общие":["мужской род"]},{"название":"число","общие":["единственное число"]},{"название":"падеж","общие":["именительный падеж","винительный падеж"]}],"согласовано":true}
{"вариант":"Опоры нет","что":"запятая между частями — Правила 1956 года, § 143; правил знаков в графе нет"}
```

A broken chain looks like this:

```sh
bootstrap/flang run flang/experimental/ru-syntax.flang --function 'Разобрать высказывание' \
  --args '{"текстРазбора": "Уровень: речь\nУровень: схема 4. N₁ — N₁"}'
```

The second entry is `{"вариант":"Разрыв уровней","уровень":"схема 4. N₁ — N₁", …}`.
No arrow links a sentence pattern to speech.

## Examples

The first three sentences of the grammar's Introduction are analysed in
`flang/experimental/texts/`:

| File | Lines | Result |
|---|---:|---|
| `syntax-first-sentence.dsl` | 41 | 25 concepts found, 11 agreement checks, 4 lines without support |
| `syntax-second-sentence.dsl` | 23 | 15 concepts found, 6 agreement checks, 1 line without support |
| `syntax-third-sentence.dsl` | 24 | 15 concepts found, 7 agreement checks, 1 line without support |

In all three files the steps are linked, every concept name is found and every
agreement check passes.

## Where the data comes from

The functions «Узлы графа», «Стрелки графа» and «Пометы словоформ» are data. They
hold a slice of the grammar's concept graph: 97 concepts and 126 arrows. The slice
holds the concepts named in the three files and all their parents along the arrows
«вид», «входит в», «является», «деление». Tags of 37 word forms come from tagging
the text layer of the Introduction: the part of speech by the Encyclopedic
Dictionary of Linguistic Terms, and gender, number, case and person by OpenCorpora.

## Limits

- The slice covers the three examples. A new concept in an analysis needs a new slice.
- The graph has no punctuation rules and no morphology concepts. Such lines are
  marked «Опоры нет».
- The agreement check does not pick a homonym. It looks for a shared value.
- Each concept has one quote: the first quote longer than sixty characters.
