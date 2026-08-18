[Back to README](../../README.md) · [Documentation index](../README.md)

# Why this exists

Here the rule is written once, in a form a domain expert can read
(an excerpt from `examples/utilities/discount.fts`):

```fts
категория «Продажи»

  объект Покупка
    сумма является деньгами
    «постоянный клиент» является признаком

  утилита «Рассчитать скидку»
    принимает Покупка
    возвращает деньги
    начинает с 0

    правило «Большая покупка»
      если сумма не меньше 10000
      то добавить 10 процентов от поля сумма

    правило «Постоянный клиент»
      если «постоянный клиент» равен да
      то добавить 5 процентов от поля сумма

    свойство «Скидка ограничена»
      результат не больше 20 процентов от поля сумма

    пример «Большая покупка»
      дано сумма равна 20000
      дано «постоянный клиент» равен нет
      ожидается результат равен 2000
```

No braces, no arrows, no colons: the surface is indentation-based and syllogistic, and readable
names may use guillemets. A legacy braced dialect is still accepted for compatibility.

From that single source you get the implementation, the tests, and the checks — in eight
languages at once. The `свойство` above is not a comment: it becomes a postcondition in the
emitted code. Printing `examples/utilities/discount.fts` to Python produces, verbatim:

```python
    # постусловие «Скидка ограничена»
    if not rt.post(ctx, rt.lte(ctx, _t3, rt.percent(ctx, rt.number(20.0), rt.field_get(ctx, vhod, "сумма"))), "Скидка ограничена", "Рассчитать скидку"):
        raise rt.fail("FTS_UTILITY_PROPERTY", "нарушено свойство «Скидка ограничена» утилиты «Рассчитать скидку»")
```

`FTS_UTILITY_PROPERTY` is the FTS core's own diagnostic code, and the message is the core's own
wording. A Python service, a Go service and a C binary generated from this model refuse the same
inputs with the same words. That is what "one source of truth" has to mean to be worth anything.
