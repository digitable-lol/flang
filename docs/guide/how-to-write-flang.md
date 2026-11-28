[Back to README](../../README.md) · [Documentation index](../README.md)

# How to write flang

What does good flang code look like? Below are six habits the standard library
is written by. All of them are shown on one function. Save it as `price.flang`
(`неотрицательное` is the non-negative integer type, `требует` is requires,
`обеспечивает` is ensures, `пример` is a test):

```flang
модуль «Цены»

тотальная функция «Цена после скидки»
  принимает цена: неотрицательное, скидка: неотрицательное
  возвращает число
  требует «скидка не больше цены» скидка не больше цена
  обеспечивает «цена не уходит в минус» результат не меньше 0
  пример «сто минус двадцать»
    дано цена равно 100
    дано скидка равно 20
    ожидается 80
  цена минус скидка
```

```bash
$ flang check price.flang
модуль «Цены»: функций 1, из них с доказанным завершением 1; типов 0
price.flang: проверено — доказано 1, проверено только на тестах 0, не доказано 0 (постусловий и утверждений 1); замечаний нет
```

The second line counts postconditions: one is proved (`доказано 1`).
«замечаний нет» means "no errors": syntax, types, termination and tests passed.

## 1. The name says what the function does

Four things explain a function: its name, its types, `обеспечивает` and
`пример`. If they do not show what it does, fix them. An explanation beside the
code will not help.

- A name comes from the domain and is not abbreviated: `«Цена после скидки»`
  (price after discount) rather than `«Расчёт»` (calculation), `цена` rather
  than `ц`.
- Names of functions, types, variants and modules are written in guillemets.
  Inside them the compiler sees one name even when it has several words.
- Parameters and names bound by `пусть` need no guillemets.
- A call: `«Цена после скидки» от 100 и 20`.

## 2. A postcondition and a test instead of a comment

The compiler skips `//` and `/* */` comments. Nothing checks them, so they
drift away from the code unnoticed. What other languages put in a comment is
written here as a line that is checked:

| What you want to say | Where it goes |
| --- | --- |
| "the result is never negative" | `обеспечивает «цена не уходит в минус» результат не меньше 0` |
| "the discount must not exceed the price" | `требует «скидка не больше цены» скидка не больше цена` |
| "100 and 20 give 80" | `пример «сто минус двадцать»` |

`обеспечивает` is a postcondition, `требует` is a precondition, `пример` is a
test. The name of each is a whole sentence: it shows up in reports and in error
messages.

## 3. The narrowest type

Declare `неотрицательное` wherever a value is never negative. The type gives
the compiler bounds. The postcondition of the function above is proved from the
types and the `требует` line alone:

```bash
$ flang check price.flang --proof
модуль «Цены»: функций 1, завершение доказано у 1
постусловие «цена не уходит в минус» функции «Цена после скидки» — доказано
…
price.flang: проверено — доказано 1, проверено только на тестах 0, не доказано 0, ложно 0 (постусловий и утверждений 1); независимая проверка повторила 1 из 1 — код возврата 0
```

`доказано` means proved for all arguments. The last line adds that the
independent check repeated this proof (`1 из 1`, 1 of 1).

Remove the `требует` line, and `flang check` finds arguments on which the
postcondition is false. The exit code is 1:

```
FLANG_EXAMPLE: FLANG_PROPERTY: постусловие «цена не уходит в минус» функции «Цена после скидки» нарушено на входе цена = 0, скидка = 1 — посчитано вычислителем на этом входе
```

## 4. `тотальная` the cheapest way

The word `тотальная` before a function demands that it terminates on any
arguments, and the compiler proves it. The ways, from cheap to costly:

1. no recursion, a `свёртка` (fold) or a `цикл` (loop) over a list — nothing
   to prove;
2. recursion on a part of the value (the tail of a list, a field of a
   variant) — proved from the shape of the data;
3. counting down on a `неотрицательное` parameter by a constant step — proved,
   no run-time check;
4. an `убывает …` line — the compiler proves the decrease only in simple cases;
   otherwise a check stays in the program and takes time. Use it when the first
   three are not enough.

Details: [How the compiler proves that a function terminates](totality.md).

## 5. Actions as data

A function does not read a file or touch the network. It returns an effect — a
value such as "read this file". The command `flang io` carries it out. The
logic therefore always terminates and is checked by ordinary tests, with no
files and no network.

How it works: [The boundary between flang and the host](../site/host-boundary.md).

## 6. Check before you run

```bash
flang check price.flang          # syntax, types, termination, tests
flang check price.flang --proof  # what is proved and what is not
flang run price.flang --function "Цена после скидки" --args '{"цена": 100, "скидка": 20}'
```

`flang check` without options answers «замечаний нет» even when a postcondition
is checked on tests only. What is proved is shown by `--proof`. Its exit code 3
says that some postconditions are left without a proof.

## File names

A source file has four equal extensions: `.flang`, `.fp`, `.фп`, `.фланг`. A
Russian file name is written in Cyrillic (`налог.фп`), an English one in Latin
letters (`tax.flang`). A Russian word in Latin letters (`nalog.flang`) is not
written: neither a Russian reader nor a foreigner can read it.

## Next

- [The language tour](../site/tour-functions.md) — six short pages with
  exercises
- [Which construct to use when](../site/which-construct.md) — what to write
  for a task
