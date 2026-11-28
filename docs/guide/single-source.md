[Back to README](../../README.md) · [Documentation index](../README.md)

# Why this exists

Here the rule is written once, in a form a domain expert can read
(an excerpt from [`docs/examples/library-api/lib/fine.flang`](../examples/library-api/lib/fine.flang)):

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

There are no braces, arrows or semicolons: nesting is set by indentation, operations are written
in words, and names of several words go in guillemets.

Three more things are written next to the body of the function. The **examples** are part of the
declaration, not tests in a neighbouring file: `flang test` finds them itself. **`обеспечивает`**
is a postcondition: a statement about the result on every input. **`тотальная`** is a word the
compiler checks. Either it proves termination itself (by composition, by structure, or by an exact
step over a non-negative integer), or it makes the author name the decreasing expression
(`убывает`) and then inserts a runtime check. The second is not a proof: `flang check` exits 0,
`flang check --proof` exits 3, and a run stops with the error `FLANG_MEASURE` if the expression
did not decrease. `flang check --proof --explain` names the method for each function; details are
in [How the compiler proves that a function terminates](totality.md).

From one source you get the implementation, the examples and the checks in ten languages. The
`обеспечивает` line becomes a postcondition in the emitted code.

```bash
flang emit docs/examples/library-api/lib/fine.flang --target python --out вывод
```

produces `вывод/fine.py`, and there is no postcondition check in it. The kernel proved
«Штраф ограничен» for all inputs (`flang check docs/examples/library-api/lib/fine.flang --proof
--explain`: «доказано сведением цели с телом функции», exit 0), and a proved postcondition is
not emitted. With `--no-check` the kernel is not run, and then `вывод/fine.py` contains:

```python
    # постусловие «Штраф ограничен»
    if not rt.post(
        ctx, rt.lte(ctx, _t5, rt.number(500.0)), "Штраф ограничен", "Рассчитать штраф"
    ):
        raise rt.fail(
            "FLANG_PROPERTY",
            "нарушено свойство «Штраф ограничен» функции «Рассчитать штраф»",
        )
```

`FLANG_PROPERTY` is the language's own error code, and the message text is the language's too. A
Python service, a Go service and a C program emitted from this function answer the same input
with the same error.
