[Back to README](../../README.md) · [Documentation index](../README.md)

# Why this exists

Here the rule is written once, in a form a domain expert can read
(an excerpt from [`examples/library-api/lib/fine.flang`](../../examples/library-api/lib/fine.flang)):

```flang
объект «Просроченная выдача»
  «дней просрочки»: число
  «книга редкая»: признак

тотальная функция «Рассчитать штраф»
  принимает «выдача»: «Просроченная выдача»
  возвращает число
  обеспечивает «Штраф ограничен» результат не больше 500
  пример «Вернули вовремя»
    дано «выдача» равно (запись «Просроченная выдача» с «дней просрочки» равным 0 и «книга редкая» равным нет)
    ожидается 0
  пример «Две недели и редкая книга»
    дано «выдача» равно (запись «Просроченная выдача» с «дней просрочки» равным 14 и «книга редкая» равным да)
    ожидается 500
  пусть «дней» равно («выдача».«дней просрочки»)
  пусть «редкая» равно («выдача».«книга редкая»)
  пусть «за просрочку» равно если «дней» больше 0 то 50 иначе 0
  пусть «за долгую» равно если «дней» не меньше 14 то 150 иначе 0
  пусть «за редкую» равно если («редкая» равен да) и притом («дней» больше 0) то 300 иначе 0
  («за просрочку» плюс «за долгую») плюс «за редкую»
```

No braces, no arrows, no semicolons: the surface is indentation-based and word-based, and
readable names may use guillemets.

Three things sit next to the body of the function and travel with it. The **examples** are not
tests in a neighbouring file but part of the declaration — `flang test` finds them itself.
**`обеспечивает`** is a promise about the result on every input, not on the listed ones.
**`тотальная`** is a marker the compiler answers for: a function whose termination it cannot
prove is not accepted with that marker.

From that single source you get the implementation, the examples and the checks — in eight
languages at once. The `обеспечивает` above is not a comment: it becomes a postcondition in the
emitted code.

```bash
flang emit examples/library-api/lib/fine.flang --target python --out /tmp/shtrafy
```

produces in `/tmp/shtrafy/shtrafy.py`, verbatim:

```python
    # постусловие «Штраф ограничен»
    if not rt.post(ctx, rt.lte(ctx, _t5, rt.number(500.0)), "Штраф ограничен", "Рассчитать штраф"):
        raise rt.fail("FLANG_PROPERTY", "нарушено свойство «Штраф ограничен» функции «Рассчитать штраф»")
```

`FLANG_PROPERTY` is the language's own diagnostic code, and the message is the language's own
wording. A Python service, a Go service and a C binary printed from this function refuse the same
input with the same words. That is what "one source of truth" has to mean to be worth anything.
