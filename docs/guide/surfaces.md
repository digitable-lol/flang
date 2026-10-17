[Back to README](../../README.md) · [Documentation index](../README.md)

# Surfaces

> The section "Finishing Esperanto and Chinese" describes what the language does
> not have yet. Everything else is what it has, checked by a run.

One program can be written with four sets of words: Russian, English, Esperanto
and Chinese. These are not four languages: `если`, `if`, `se` and `如果` are one
and the same word of the language, and the parser produces one tree. The numbers
and the full list of gaps are on the page
[«Четыре поверхности записи»](../surfaces.md) (in Russian); this guide covers only
how surfaces work and how to use them.

## Which surfaces exist

| | Russian | English | Esperanto | Chinese |
| --- | :---: | :---: | :---: | :---: |
| ordinary program | yes | yes | yes | yes |
| proofs and termination | yes | yes | no | no |

You can write on all four. You can prove on two only: Esperanto and Chinese have
no words at all for `требует`/`обеспечивает`/`убывает`/`индукция по`
(`requires`/`ensures`/`decreases`/`induction on`), and that is a decision, not an
omission; the reasoning is in a section below.

## How it works

A surface is not a separate parser but a table in `flang/self/lexer.flang`: a
string of the form `|phrase:identifier|…|`, and the parser finds a phrase in it
with one `содержит` (contains), not by walking pairs. The table is built by the
function `«Куски таблицы»`; the forward lookup is `«Идентификатор фразы»`, and
its examples cover all four surfaces:

```flang
пример «Русская поверхность»
  дано фраза равно "если"
  ожидается "if"
пример «Китайская поверхность»
  дано фраза равно "如果"
  ожидается "if"
```

The table works both ways. The reverse lookup is `«Слово на поверхности»` in the
same file: given an identifier and a surface code it returns the word, and when
the surface has no word for it, an empty string rather than an invented one. To
check it yourself without editing the file (the `--trust` key is needed because
some postconditions of the lexer are checked on examples rather than proved, and
`run` refuses without it):

```
$ ./bootstrap/flang run flang/self/lexer.flang --function 'Слово на поверхности' \
    --args '{"идентификатор": "if", "поверхность": "zh"}' --trust
на веру: доказанность не считалась — запуск по ключу --trust
"如果"

$ ./bootstrap/flang run flang/self/lexer.flang --function 'Слово на поверхности' \
    --args '{"идентификатор": "decreases", "поверхность": "zh"}' --trust
на веру: доказанность не считалась — запуск по ключу --trust
""
```

The language server (`flang/self/lsp.flang`) imports `«Куски таблицы»` and
`«Идентификатор фразы»` from the lexer. There is no second word list in the
tree, so there is nothing to drift apart.

## How to add a surface

In short: add the words to the same table. In detail, there are several places
to edit in one file, and some of them are a type rather than a string:

1. **`«Куски таблицы»`**: add `word:identifier` for every concept the surface
   takes. A surface may leave a concept closed; a silent cell (see Esperanto and
   `modulo` below) is legal and not the only case.
2. **`«Куски поверхностей»`** and **`«Куски слов поверхностей»`**: the same
   words, in the form used to detect which surface a file is written on, and the
   reverse index by word.
3. **`объект «Голоса поверхностей»`**: a typed record with one field per
   surface. A fifth surface adds a new field here, not a data row: this is a
   change of a type.
4. **`«Все поверхности»`** carries the proved postcondition "there are exactly N
   surfaces". After the change the number changes, and the compiler checks it
   again instead of taking it on trust.
5. Check it with examples, following the examples of `«Идентификатор фразы»`:
   the new phrase needs its own `пример`, like the other surfaces have.

Then run `bootstrap/flang run-script surfaces:run` to measure the numbers on the
page [«Четыре поверхности записи»](../surfaces.md) again; this check is **not in
CI**, it is run by hand.

Note that the words "four surfaces" appear in more places than this file: some
checks and page generators (`scripts/site/surfaces-page.fscript`,
`scripts/editors/vim-rules.flang`, `scripts/guards/kernel-abilities-guard.fscript`,
`docs/site/site-numbers.mjs` and others) hold the number in prose or in a
postcondition. A fifth surface has to update them as well; the list of places is
not part of this guide.

## Finishing Esperanto and Chinese

This is not "add a few rows". Ten concepts, the whole proof vocabulary
(`requires`/`ensures`/`claim`/`for all`/`induction on`/`by property`/
`by example`/`by hypothesis`/`decreases`/`qed`), are open only on the Russian and
English surfaces, and the reason is not forgetfulness: `requires`/`ensures` have
precedent in English in Eiffel, JML and Dafny, while Esperanto and Chinese have
no established word at all. An invented word is worse than a missing one.

Some gaps are a clash of words rather than an omission: the Esperanto `modulo`
already means both "module" and "remainder of division" (the remainder took
`resto de`), and the Esperanto `ne` is already the literal for false, so negation
in Esperanto is written with the function `«Не так»`, not with a keyword.

Filling these cells needs a decision first: which word to take and why (or an
explicit refusal with the reason), not a quiet edit of the table.

## Printing a tree on another surface: what gets translated

The parser produces one tree whatever surface the file is written on. Since the
reverse dictionary (`«Слово на поверхности»`) exists, it is mechanically cheap to
print a file again, substituting for every keyword token its word on the target
surface. The plan `scripts/unicode/translate.fscript` does exactly that on the
current binary:

```
bootstrap/flang run-script unicode:translate <file> <ru|en|eo|zh> [<output file>]
```

It asks `bootstrap/flang tokens` where each keyword stands, takes the word on the
target surface from the reverse dictionary, and writes the file with only those
spans replaced; without an output file the text goes to standard output. Paths
that are not absolute are read from the folder of the plan. The answer names how
many keywords have no word on the target surface (Esperanto has no `модуль`, for
example); such a keyword stays as it was written. An inflected Russian form comes
back as the first form of its word: `равно` translated to English and back is
`равен`, and the program means the same.

What matters more is what such a translation does **not** translate:

- **Keywords**: yes, mechanically, the table works both ways.
- **Names**: no. `«Сложить копейки»` is not a keyword but a name chosen by the
  author of the function; the lexer table has no names and will not have them, it
  knows only the concepts of the language. After translation the program has
  control words on the target surface and the same function names the author
  gave. There is no dictionary of standard library names.
- **Diagnostics**: no, except one narrow place. Parse error messages substitute
  the quoted word through `«Слово на поверхности»`; other kinds of refusal (for
  example `FLANG_UNKNOWN_NAME`) stay in Russian whatever the surface of the file.

Hence the caveat for an English self-host: replacing the words does not turn
`flang/self/**` into English text. That also needs a dictionary of names, which
does not exist, and it is separate manual work, not a mechanism.

## Interslavic as a worked example

There is no fifth surface in the tree. Interslavic (a constructed language built
on common Slavic roots) makes a good worked example: the point of adding it is
not that people write in it, but to test whether this guide is enough for a
person who has never opened `lexer.flang`. As with Esperanto and Chinese, it does
not get the proof vocabulary right away: a silent cell is more honest than an
invented word.
