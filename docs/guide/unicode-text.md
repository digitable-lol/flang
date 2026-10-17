[Back to README](../../README.md) · [Documentation index](../README.md)

# Unicode text

A string in flang is a sequence of Unicode code points, and `равен` compares code
points. Two spellings of one letter, `é` as U+00E9 and as `e` followed by U+0301,
are two different strings until the program normalizes them. The standard
library does that and the rest of the Unicode text algorithms in flang itself,
from the tables of the Unicode Character Database, version 17.0.0. The decision
and its reasons are [ADR-0154](../adr/0154-unicode-text-is-written-in-flang-from-the-character-database.md).

## Modules

| module | import | gives |
| --- | --- | --- |
| `flang/stdlib/unicode-normalization.flang` | `«Unicode normalization»` | «NFD», «NFC», «NFKD», «NFKC», «В NFC ли», «Равны канонически» |
| `flang/stdlib/unicode-graphemes.flang` | `«Unicode graphemes»` | «Графемы», «Длина в графемах» |
| `flang/stdlib/unicode-case.flang` | `«Unicode case folding»` | «Свернуть регистр», «Равны без учёта регистра» |
| `flang/stdlib/text-decoding.flang` | `«Text decoding»` | «Раскодировать из» |

```flang
«NFC» от "é"                          gives "é"
«Длина в графемах» от "е́"        gives 1
«Равны без учёта регистра» от "STRASSE" и "straße"    gives да
«Раскодировать из» от "KOI8-R" и [237, 201, 210]       gives вариант «Раскодировано» с текст равным "Мир"
```

«Раскодировать из» knows `UTF-8`, `UTF-16LE`, `UTF-16BE`, `UTF-16` (byte order
mark, big endian without it), `UTF-32LE`, `UTF-32BE`, `UTF-32`, `CP1251` (also
`windows-1251`), `KOI8-R` and `Latin-1` (also `ISO-8859-1`). Bytes that cannot
be read give `«Отказ раскодирования»` with the position of the first bad byte and
the reason in words; nothing is replaced silently.

## Tables

`flang/stdlib/unicode-normalization-data.flang`, `unicode-grapheme-data.flang`,
`unicode-case-data.flang` and `code-page-data.flang` are generated, not written
by hand. Each Unicode data module has a function that returns its version. To
rebuild them from the official files:

```
bootstrap/flang run-script unicode:tables <folder with the source files> <folder for the modules>
```

The folder holds `UnicodeData.txt`, `DerivedNormalizationProps.txt`,
`CaseFolding.txt`, `GraphemeBreakProperty.txt`, `emoji-data.txt`,
`DerivedCoreProperties.txt` from `https://www.unicode.org/Public/17.0.0/ucd/`
and `index-windows-1251.txt`, `index-koi8-r.txt` from the WHATWG Encoding
Standard. Paths that are not absolute are read from the folder of the plan
(`scripts/unicode`). The run takes about six minutes.

## How it is checked

```
bootstrap/flang run-script unicode:conformance <folder with NormalizationTest.txt and GraphemeBreakTest.txt>
bootstrap/flang run-script unicode-text:probe
```

The first command prints the plan `scripts/unicode/conformance.fscript` into C,
builds it and runs it on the official test files of the same Unicode version: all
five columns of every line of `NormalizationTest.txt`, every code point outside
its part 1 (each must stay itself under all four forms), ten laws on every test
string (each of the four forms is idempotent, NFC of NFD is NFC, NFD of NFC is
NFD, the clusters join back into the text, there are no more clusters than code
points, a text equals its NFD without case, case folding is idempotent) and every line of `GraphemeBreakTest.txt`. Any failure fails the plan
and names the first failing line. The interpreter runs the same plan, but the
check of more than a million code points takes it hours, which is why the command
prints it first.

The second command runs sixteen answers through the interpreter and all ten print
targets and requires the same answer everywhere.

## Cost

A lookup is a binary search inside a page of 256 code points over fixed-width
hexadecimal records, a few dozen steps of the interpreter. Text whose code points
are all below U+0300 or plain Cyrillic letters is already NFC and is returned
without a lookup.
