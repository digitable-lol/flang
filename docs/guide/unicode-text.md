[Back to README](../../README.md) · [Documentation index](../README.md)

# Unicode text

A string in flang is a sequence of Unicode code points, and `равен` compares code points. Two
spellings of one letter, `é` as the code point U+00E9 and `e` followed by U+0301, are two
different strings until the program normalizes them. Normalization, graphemes, case folding and
decoding of bytes come from the library; it is written in flang from the tables of the Unicode
Character Database, version 17.0.0.

```flang
модуль «Unicode text»

использует «Unicode normalization»
использует «Unicode graphemes»
использует «Unicode case folding»
использует «Text decoding»

тотальная функция «Собрать»
  принимает текст: строка
  возвращает строка
  пример «буква и отдельное ударение становятся одной кодовой точкой»
    дано текст равно "é"
    ожидается "é"
  «NFC» от текст

тотальная функция «Знаков для глаза»
  принимает текст: строка
  возвращает число
  пример «е с ударением — один знак»
    дано текст равно "е́"
    ожидается 1
  «Длина в графемах» от текст

тотальная функция «Одно слово»
  принимает первое: строка, второе: строка
  возвращает признак
  пример «регистр и эсцет не мешают»
    дано первое равно "STRASSE"
    дано второе равно "straße"
    ожидается да
  «Равны без учёта регистра» от первое и второе

тотальная функция «Из КОИ-8»
  принимает байты: список числа
  возвращает «Итог раскодирования»
  пример «три байта — слово»
    дано байты равно [237, 201, 210]
    ожидается вариант «Раскодировано» с текст равным "Мир"
  «Раскодировать из» от "KOI8-R" и байты
```

```
$ flang test text.flang
text.flang: примеров 191, прошло 191, не прошло 0
$ flang run text.flang --function '«Из КОИ-8»' --args '{"байты":[237,201,210]}'
доказано: утверждений 15
{"вариант":"Раскодировано","текст":"Мир"}
```

There are 191 examples, not four: `flang test` also runs the examples of the imported library
modules.

## Modules

| import | what it gives |
| --- | --- |
| `использует «Unicode normalization»` | «NFD», «NFC», «NFKD», «NFKC», «В NFC ли», «Равны канонически» |
| `использует «Unicode graphemes»` | «Графемы», «Длина в графемах» |
| `использует «Unicode case folding»` | «Свернуть регистр», «Равны без учёта регистра» |
| `использует «Text decoding»` | «Раскодировать из» |

## Decoding

«Раскодировать из» knows `UTF-8`, `UTF-16LE`, `UTF-16BE`, `UTF-16` (by the byte order mark;
big-endian without one), `UTF-32LE`, `UTF-32BE`, `UTF-32`, `CP1251` (also `windows-1251`),
`KOI8-R` and `Latin-1` (also `ISO-8859-1`).

Bytes that cannot be read give the variant «Отказ раскодирования» with the number of the first
bad byte and the reason in words; nothing is replaced silently:

```
$ flang run text.flang --function '«Из КОИ-8»' --args '{"байты":[300]}'
доказано: утверждений 15
{"вариант":"Отказ раскодирования","место":1,"причина":"не байт: число вне 0…255 или дробное"}
```

## Cost

Table lookup is a binary search inside a page of 256 code points, a few dozen evaluator steps.
A text whose code points are all below U+0300 or ordinary Cyrillic letters is already in NFC and
is returned without a lookup.

The library is checked against the official Unicode 17.0.0 tests, `NormalizationTest.txt` and
`GraphemeBreakTest.txt`.
