# Specs: a business rule that is proved

A spec here is not a document next to the code but a line in the program. A
rule is written at a function with the word `обеспечивает` (ensures), and the
compiler proves it for all inputs. Such a spec cannot drift from the code:
change the function so that the rule no longer holds, and the check fails.

The example on this page is a marketplace API made of three services and a
gateway, `docs/examples/web/marketplace/`. The programs are written in the
Russian words of flang and are quoted as they are.

## What a rule looks like

A function from the cart service (`cart.flang`) — "discount in percent", with
the rule "the discount is only zero, five or ten percent":

```flang
тотальная функция «Скидка в процентах»
  принимает сумма: число
  возвращает число
  для всех сумма обеспечивает «скидка бывает только нулевая, пятипроцентная или десятипроцентная» ((результат равен 0) или (результат равен 5)) или (результат равен 10)
  пример «мелкая покупка без скидки»
    дано сумма равно 100000
    ожидается 0
  пример «от пяти тысяч — пять процентов»
    дано сумма равно 500000
    ожидается 5
  пример «от двадцати тысяч — десять процентов»
    дано сумма равно 2000000
    ожидается 10
  если сумма не меньше 2000000
    то 10
    иначе (если сумма не меньше 500000 то 5 иначе 0)
```

| part | what it is | what checks it |
|---|---|---|
| `обеспечивает «name» goal` | a rule about the result | the compiler proves it for all inputs; if it cannot, the report says so |
| `требует «name» condition` | a condition on the input | checked at the call; a violation is the refusal `FLANG_PRECONDITION` |
| `пример … ожидается …` | a sample (example … expected …) | run on every check of the file |
| `тотальная` | the function ends on every input | the compiler proves it |

The name of a rule is what it is found by in the report and matched by between
specs.

The rule is written as a list of values, not as the bound "the discount is at
most ten". A function that always returns zero satisfies the bound too; such a
rule says nothing about this function.

## How to check

```
flang check docs/examples/web/marketplace/orders.flang --proof
```

```
что высказано и чем это несётся:
  постусловие «из конечного состояния переходов нет» функции «Переходы из» — доказано индукцией по «Состояние заказа»: база 6 случаев, шаг при допущении на частях (0 случаев) — утверждение обо ВСЕХ входах типа «Состояние заказа», а не о написанных
  постусловие «из конечного состояния не разрешён никакой переход» функции «Переход разрешён» — сетка 4 значения (примеры функции): нарушений на них нет: проверка прогнала каждый пример и посчитала постусловие на его ответе. Это не доказательство — теоремы при утверждении нет
  постусловие «у состояния есть непустое название» функции «Название состояния» — доказано индукцией по «Состояние заказа»: база 6 случаев, шаг при допущении на частях (0 случаев) — утверждение обо ВСЕХ входах типа «Состояние заказа», а не о написанных

итог:
  функций 7: тотальных 7, обычных 0
  утверждений 3: доказано 2 (из них индукцией 2), сетка 1, объявлено, не доказано 0 (шагов в термах 12)
```

The exit code is 3: one claim is not proved. Every claim in the report carries
one of four words:

| word | what it means |
|---|---|
| **доказано** (proved) | true for all inputs |
| **сетка N** (grid of N) | computed on N of the author's examples; not a proof |
| **объявлено, не доказано** (stated, not proved) | no proof and no examples |
| **НАРУШЕНО** (violated) | an input was found on which the claim is false |

Two claims are proved by induction over a type. The order states are declared
as variants, and the proof takes each one apart:

```flang
тип «Состояние заказа»
  вариант «Создан»
  вариант «Оплачен»
  вариант «Собран»
  вариант «Отправлен»
  вариант «Получен»
  вариант «Отменён»
```

Were the state a string (`"paid"`, `"shipped"`), taking every case apart would
be impossible: there are infinitely many strings.

The third claim stays on the grid. The body of «Переход разрешён» (transition
allowed) folds not the parameter itself but a list computed from it
(`«Переходы из» от откуда`), and the kernel has nothing to hang an induction
over the parameter on.

`flang check` without `--proof` answers "no remarks" and exit code 0 on the
same file: it does not show the verdicts of the claims.

## What is proved across the whole example

| file | lines | what is in it | functions | claims | proved | grid | `--proof` exit code |
|---|---:|---|---:|---:|---:|---:|---:|
| `catalog.flang` | 113 | goods, price, stock | 8 | 1 | 1 | 0 | 0 |
| `cart.flang` | 117 | items, the bill, the discount | 8 | 5 | 2 | 3 | 3 |
| `orders.flang` | 225 | order states and transitions | 7 | 3 | 2 | 1 | 3 |
| `gateway.flang` | 430 | routes and response codes | 17 | 2 | 2 | 0 | 0 |

All 40 functions are total. The report counts only the claims of the file
itself: the claims of the modules it uses and of the HTTP library are not in
it.

The gateway takes the text of an HTTP request and returns the text of the
response:

```flang fragment
тотальная функция «Обслужить»
  принимает витрина: «Витрина», текст: строка
  возвращает «Обслуживание»
```

It does not hold the socket: `flang io` accepts connections. How the same
scheme works on a real socket is shown on the page
[The link shortener](shortener.html).

Both claims of the gateway are about response codes, and both are proved by
induction over the type of outcomes:

```flang
тип «Исход»
  вариант «Готово»
  вариант «Создано»
  вариант «Очищено»
  вариант «Запрос негоден»
  вариант «Нет такого»
  вариант «Метод не тот»
  вариант «Товара не хватает»
  вариант «Тело велико»
  вариант «Переход запрещён»
```

```
  постусловие «код ответа из объявленного набора» функции «Код исхода» — доказано индукцией по «Исход»: база 9 случаев, шаг при допущении на частях (0 случаев) — утверждение обо ВСЕХ входах типа «Исход», а не о написанных
  постусловие «пояснение кода непусто» функции «Код исхода» — доказано индукцией по «Исход»: база 9 случаев, шаг при допущении на частях (0 случаев) — утверждение обо ВСЕХ входах типа «Исход», а не о написанных
```

The two claims read "the response code is from the declared set" and "the
reason phrase of a code is not empty"; both are proved by induction over
«Исход», base of 9 cases. For a client of the service this means: there are
exactly as many response codes as the set holds; 500 is not among them; every
code has a reason phrase. A client only has to handle the listed codes.

## What happens if a rule is broken

Change one line in the gateway's code table: let «Товара не хватает» (not
enough stock) answer 500 instead of 409.

```
flang check docs/examples/web/marketplace/gateway.flang --proof
```

```
FLANG_PROOF_STEP, строка 101, столбец 10: шаг 1, база «Товара не хватает» теоремы «код ответа из объявленного набора»: пример «товара не хватает — четыреста девять» не проходит: нарушено свойство «код ответа из объявленного набора» функции «Код исхода». Утверждение на этом значении неверно, значит случай им не закрывается. к этому месту не известно ничего, кроме гипотез «дано»
FLANG_PROOF_STEP, строка 125, столбец 10: шаг 1, база «Товара не хватает» теоремы «пояснение кода непусто»: пример «товара не хватает — четыреста девять» не проходит: нарушено свойство «код ответа из объявленного набора» функции «Код исхода». Утверждение на этом значении неверно, значит случай им не закрывается. к этому месту не известно ничего, кроме гипотез «дано»
docs/examples/web/marketplace/gateway.flang: не проверено — ведомость не печатается у программы с замечаниями
```

The exit code is 1. Before each remark the compiler adds a line saying that the
place is named without a file name; it is left out here.

A spoiled example is caught the same way. Change an expected value in the
catalogue: let a stock of 5 with a request for 2 give out 3.

```
flang check docs/examples/web/marketplace/catalog.flang --proof
```

```
FLANG_EXAMPLE: пример «остатка хватает» функции «Сколько выдать»: значение не совпало с ожидаемым: ожидалось 3, получено 2
docs/examples/web/marketplace/catalog.flang: не проверено — ведомость не печатается у программы с замечаниями
```

## A second rule must not cancel the first

Rules pile up. The directory `fspec/spec/` holds 43 specs of a business domain,
and a new spec brings in the one it rests on with a `использует` (uses) line.
The check of the catalogue answers a question that `flang check` on one file
does not see: did the earlier rule stay proved after the new one arrived.

```
flang run-script specs:check
```

At present the command answers `бед в системе спек: 78` ("troubles in the
spec system: 78") and exit code 1. 69 of the 78 remarks are of one kind: the
`check --proof` report does not contain the claims of the modules a file uses,
so the check does not find the earlier spec's claim in the new one. It goes red
on every spec with a `использует` line, not only on a real cancellation of a
rule.

How the catalogue is built, what exactly it compares, and what of that does not
work at present is on the page [The spec catalogue](spec-catalog.html).

## A rule in another language

A claim can be repeated in the language of those who read it. The language tag
stands in the name:

```flang fragment
обеспечивает «zh: 折扣不超过 30» результат не больше 30
```

It is a separate claim, proved like the others. The catalogue check compares
the goal of the translation with the goal of the main claim. It does not read
the translation itself: a wrongly translated name with the right goal passes.

## Next

- [The spec catalogue](spec-catalog.html) — how specs are gathered into a catalogue and what checks it.
- [Leetcode tasks](case-studies.html) — three solutions and what is proved about them.
- [What is proved and what is not](what-is-proved.html) — where the boundary runs.
- [The kernel refused: whose mistake is it](proof-refused.html) — what to do with a refusal.
- [The flang service for an AI assistant](ai-assistant.html) — the same check through MCP.
