[Back to README](../../README.md) · [Documentation index](../README.md)

# How to write flang

Six habits the standard library is written by. Each is shown on one function
(`неотрицательное` is the non-negative integer type, `требует` is requires,
`обеспечивает` is ensures, `пример` is example):

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
price.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
```

## 1. The name says what the function does

Four things explain a function: its name, its types, `обеспечивает` and
`пример`. If they do not show what it does, fix them instead of adding an
explanation beside the code.

- A name comes from the domain and is not abbreviated: `«Цена после скидки»`
  (price after discount), not `«Расчёт»` (calculation); `цена`, not `ц`.
- Names of functions, types, variants and modules are written in guillemets:
  `«Цена после скидки»`. Inside them the lexer sees one name, not several
  words. Parameters and names bound by `пусть` need no guillemets.
- A call: `«Цена после скидки» от 100 и 20`.

## 2. A promise and an example instead of a comment

The lexer drops `//` and `/* */` comments: nothing checks them, and they drift
away from the code silently. What other languages put in a comment is written
here so that it is checked:

| What you want to say | Where it goes |
| --- | --- |
| "the result is never negative" | `обеспечивает «цена не уходит в минус» результат не меньше 0` |
| "the discount must not exceed the price" | `требует «скидка не больше цены» скидка не больше цена` |
| "100 and 20 give 80" | `пример «сто минус двадцать»` |

The name of a promise or an example is a whole sentence. It shows up in
reports and in refusals.

## 3. The narrowest type

Declare `неотрицательное` wherever a value is never negative. It gives the
compiler bounds: the postcondition of the function above is proved from the
types and the `требует` line alone. `flang check price.flang --proof` says:

```
постусловие «цена не уходит в минус» функции «Цена после скидки» — доказано по объявленным типам аргументов: цель сведена правилом «неотрицательность по построению» …
```

Remove the `требует` line, and `flang check` finds an input on which the
promise is false, exit code 1:

```
FLANG_EXAMPLE: FLANG_PROPERTY: постусловие «цена не уходит в минус» функции «Цена после скидки» нарушено на входе цена = 0, скидка = 1 — посчитано вычислителем на этом входе
```

## 4. `тотальная` the cheapest way

`тотальная` (total) means the function terminates on every input, and the
compiler proves it. The ways, from cheap to costly:

1. no recursion, a `свёртка` (fold) or a `цикл` (loop) over a list — nothing
   to prove;
2. recursion on a part of the value (the tail of a list, a field of a
   variant) — proved by structure;
3. descent on a `неотрицательное` parameter by a constant step — proved, no
   run-time check;
4. a declared measure `убывает …` — a check stays in the program and costs
   time. Use it when the first three are not enough.

Details: [Total functions](totality.md).

## 5. Actions as data

A function does not read a file or touch the network. It returns an order — a
value such as "read this file" — and `flang io` carries it out. The logic
therefore stays total and is checked by ordinary examples, with no files and
no network. How it works:
[Where flang ends and the host begins](../site/host-boundary.md).

## 6. Check before you run

```bash
flang check price.flang          # parsing, types, termination, examples
flang check price.flang --proof  # what is proved and what is not
flang run price.flang --function "Цена после скидки" --args '{"цена": 100, "скидка": 20}'
```

`flang check` without options answers «замечаний нет» (no remarks) even when a
promise is checked on examples only. What exactly is proved is shown by
`--proof`; its exit code 3 means something is left unproved.

## File names

A source file has four equal extensions: `.flang`, `.fp`, `.фп`, `.фланг`. A
Russian file name is written in Cyrillic (`налог.фп`), an English one in Latin
letters (`tax.flang`). A Russian word in Latin letters (`nalog.flang`) is not
written: neither a Russian reader nor a foreigner can read it.
