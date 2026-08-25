# Specs: a business rule that is proved

An ordinary specification is prose. It gets written, agreed on, and a month later
the code has moved ahead — and the two part company silently: the document still
reads well, it simply is no longer about this program.

Here a spec is a **program**, so there is nothing to part company with. The rule
sits next to the function, the compiler proves it for **all** inputs rather than
for the ones that showed up in production, and a separate check stops the next
rule from quietly cancelling one already proved.

So that this is visible on something other than a toy, what follows is one
running example: **a marketplace API assembled from three services**, and an
ordinary React front end that calls it.

The listings are tree files as they are, so they are in flang, and flang is
written in Russian words. A key to the ones used here:

| flang | English |
| --- | --- |
| `модуль` / `использует` | module / uses |
| `тотальная функция` | total function |
| `принимает` / `возвращает` | takes / returns |
| `обеспечивает` / `требует` | ensures / requires |
| `для всех` | for all |
| `пример` / `дано` / `ожидается` | example / given / expected |
| `тип` / `вариант` | type / variant |
| `теорема` / `индукция по` / `следовательно доказано` | theorem / induction over / therefore proved |
| `если` / `то` / `иначе` | if / then / else |

## What a rule looks like

Here is a function from the cart service, whole, as it sits in the tree
(`examples/web/marketplace/cart.flang`):

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

Four parts, and each one does work:

| part | what it is | who checks it |
|---|---|---|
| `обеспечивает «name» <goal>` | the rule itself | the compiler proves it for all inputs |
| `требует «name» <condition>` | when the rule applies | whoever calls the function |
| `пример … ожидается …` | a case from life | run on every check of the file |
| `тотальная` | the function always terminates | the compiler proves it itself |

**A claim's name is its identity.** Specs are matched against each other by the
pair "function plus name": rename a claim and the link breaks, and the check says
so.

You can also see why the rule is written as a list of values rather than as a
bound. "The discount is at most ten" is a promise that survives replacing the
body with zero: it is true of any function that always returns zero, and so it
says nothing about this one. A list of values does not survive that replacement.

## The running example: a marketplace API

Three services and a gateway in front of them, split into modules the way they
would be split into services: each has its own state type and its own rules, and
`использует` is all that ties them together. The catalogue knows nothing about
the cart; the cart asks the catalogue for a price, because otherwise the price
would live in two places and diverge at the first repricing.

```
examples/web/marketplace/
  catalog.flang   136   goods, price, stock, "how many to hand out"
  cart.flang      130   line items, the bill, tiered discount
  orders.flang    245   order states and the transitions between them
  gateway.flang   482   response codes, routes, bytes in — bytes out
                  ─────
                  993   lines, all of them flang
```

What the gateway answers:

| method | path | answer |
|---|---|---|
| GET | `/товары` | 200, one line per item |
| GET | `/товары/{sku}` | 200 or 404 |
| GET | `/корзина` | 200, the bill, one line per line item |
| POST | `/корзина` | 201 + the recomputed bill; body `артикул=…&количество=…` |
| DELETE | `/корзина` | 204 |
| POST | `/заказы` | 201 + the order number; the cart empties |
| GET | `/заказы/{number}` | 200 or 404 |
| POST | `/заказы/{number}/{action}` | 200 or 422 |

The refusals are named: 400 bad request, 404 no such path, item or order, 405
wrong method for a known path (not 404 — the service does not lie about the
reason), 409 stock is short of what was asked, 413 body over the limit, 422 the
state transition is not allowed.

## Where the language's boundary runs

The gateway's input is the very text the host read off the connection; its output
is the very text the host will send back:

```flang
тотальная функция «Обслужить»
  принимает витрина: «Витрина», текст: строка
  возвращает «Обслуживание»
```

But there is no socket here. No listening port. Waiting for bytes is something
the language cannot do and will not learn: a flang program is given no access to
the world, or neither termination nor "the same arguments give the same answer"
could be proved. Whoever accepts the connection and holds it is the **host** —
the runtime the program runs inside.

The boundary is drawn by design, not out of poverty: flang is where you write
**what to decide**, not how to wait for bytes off the network. In exchange,
everything that is written is checked by example, without a single server being
started.

That this is not a sketch is visible next door: in `examples/web/shortener/` the
same boundary is carried through — a 1 150-line service that the host drives over
a real socket, and `curl` gets 200, 201, 301 and 204 out of it.

## A spec is not written, it is checked

The report is printed by the `--proof` flag, and it distinguishes words that are
easy to confuse. There are four of them, and they are not the same thing:

| word | what it means |
|---|---|
| **доказано** (proved) | a claim about ALL inputs, derived from declarations and structure |
| **сетка N** (grid of N) | computed on N of the author's values, no violation found. This is NOT a proof |
| **объявлено, не доказано** (stated, not proved) | the claim is made and there is no proof under it |
| **НАРУШЕНО** (violated) | a contradicting case was found and shown |

Here is what the check answers for the orders service:

```
flang check examples/web/marketplace/orders.flang --proof
```

```
что высказано и чем это несётся:
  постусловие «из конечного состояния переходов нет» функции «Переходы из» — доказано индукцией по «Состояние заказа»: база 6 случаев, шаг при допущении на частях (0 случаев) — утверждение обо ВСЕХ входах типа «Состояние заказа», а не о написанных
  постусловие «из конечного состояния не разрешён никакой переход» функции «Переход разрешён» — сетка 4 значения (примеры функции): нарушений НЕ ИСКАЛИ — прогона примеров не было, посчитано только их число. Это не доказательство — теоремы при утверждении нет
  постусловие «у состояния есть непустое название» функции «Название состояния» — доказано индукцией по «Состояние заказа»: база 6 случаев, шаг при допущении на частях (0 случаев) — утверждение обо ВСЕХ входах типа «Состояние заказа», а не о написанных

итог:
  функций 7: тотальных 7, обычных 0
  утверждений 3: доказано 2 (из них индукцией 2), сетка 1, объявлено, не доказано 0 (шагов в термах 12)
```

Three claims, three different answers, and they stand together on purpose. Two
are proved by induction over a declared sum: the cases are matched against the
**declaration** of the type, and had the author missed one, the compiler would
refuse. The third is honestly marked "сетка 4" — computed on four of the author's
examples and not a proof.

Where the difference comes from is visible too. Order states are declared as a
sum:

```flang
тип «Состояние заказа»
  вариант «Создан»
  вариант «Оплачен»
  вариант «Собран»
  вариант «Отправлен»
  вариант «Получен»
  вариант «Отменён»
```

A state carried as a string (`"paid"`, `"shipped"`) offers no such possibility at
all: the set of strings is infinite, and a case analysis over it is not
exhaustive.

## What is proved across the whole example

All four files of the example are checked by the same program, and each answers
with its own summary line:

```
$ flang check examples/web/marketplace/catalog.flang --proof
  функций 8: тотальных 8, обычных 0
  утверждений 1: доказано 1 (из них без теоремы 1), сетка 0, объявлено, не доказано 0

$ flang check examples/web/marketplace/cart.flang --proof
  функций 16: тотальных 16, обычных 0
  утверждений 6: доказано 3 (из них без теоремы 3), сетка 3, объявлено, не доказано 0

$ flang check examples/web/marketplace/orders.flang --proof
  функций 7: тотальных 7, обычных 0
  утверждений 3: доказано 2 (из них индукцией 2), сетка 1, объявлено, не доказано 0 (шагов в термах 12)

$ flang check examples/web/marketplace/gateway.flang --proof
  функций 106: тотальных 106, обычных 0
  утверждений 146: доказано 70 (из них индукцией 10) (из них без теоремы 58, объявленным типом 2), сетка 76, объявлено, не доказано 0 (шагов в термах 32)
```

The gateway's numbers stand out for a plain reason: `gateway.flang` pulls the
HTTP parsing library in with it, and the report counts everything checked
alongside it — 106 functions against the catalogue's eight. The gateway's own
claims are two, and both are proved by induction over the declared sum of
outcomes:

```
  постусловие «код ответа из объявленного набора» функции «Код исхода» — доказано индукцией по «Исход»: база 9 случаев, шаг при допущении на частях (0 случаев) — утверждение обо ВСЕХ входах типа «Исход», а не о написанных
  постусловие «пояснение кода непусто» функции «Код исхода» — доказано индукцией по «Исход»: база 9 случаев, шаг при допущении на частях (0 случаев) — утверждение обо ВСЕХ входах типа «Исход», а не о написанных
```

The report neither hides `сетка` nor renames it. The cart has three, the order
service one, and it reads exactly as written: computed on the author's values,
with nothing known about the remaining inputs.

Why these four in particular, the compiler says itself once a theorem is written
against them. It answers that it reads a case's conclusion **from two shapes of
the body and from nowhere else**: from a `разбор` branch over the same variable,
and from the seed and step of a `свёртка` over the same variable. In all four the
body folds not the variable itself but a list computed from it
(`«Переходы из» от откуда`, `корзина.«позиции»`) — there is nothing for a proof to
hang on. Unfolding them into a `разбор` over the variable is possible, but for the
order service it would mean keeping a second copy of the transition table, and two
copies drifting apart is the very trouble this example warns against. The proof
would cost more than the honest mark, so the mark stays.

## What stops a spec from lying

A spec that cannot be forged is not a promise but a property, and it is checked
by running it. Spoil one line in the gateway's code table — let "not enough
stock" answer 500 instead of 409:

```sh
flang check examples/web/marketplace/gateway.flang --proof
```

```
место указано строкой и столбцом, но без файла: вместе с импортами проверено файлов 7, а диагностика компилятора имени файла не несёт
FLANG_PROOF_STEP, строка 129, столбец 10: шаг 1, база «Товара не хватает» теоремы «код ответа из объявленного набора»: пример «товара не хватает — четыреста девять» не проходит: нарушено свойство «код ответа из объявленного набора» функции «Код исхода». Утверждение на этом значении неверно, значит случай им не закрывается. к этому месту не известно ничего, кроме гипотез «дано»
место указано строкой и столбцом, но без файла: вместе с импортами проверено файлов 7, а диагностика компилятора имени файла не несёт
FLANG_PROOF_STEP, строка 156, столбец 10: шаг 1, база «Товара не хватает» теоремы «пояснение кода непусто»: пример «товара не хватает — четыреста девять» не проходит: нарушено свойство «код ответа из объявленного набора» функции «Код исхода». Утверждение на этом значении неверно, значит случай им не закрывается. к этому месту не известно ничего, кроме гипотез «дано»
examples/web/marketplace/gateway.flang: не проверено — ведомость не печатается у программы с замечаниями
```

Five hundred is not in the declared set, and the claim falls. Not "a test on that
code fails" — what falls is the **claim about every outcome**, because the code
table and the set of outcomes are tied by a theorem, not by convention.

A spoiled example is caught the same way. Change an expected value in the
catalogue — let a stock of 5 with 2 asked for hand out 3:

```sh
flang check examples/web/marketplace/catalog.flang --proof
```

```
FLANG_EXAMPLE: пример «остатка хватает» функции «Сколько выдать»: значение не совпало с ожидаемым: ожидалось 3, получено 2
examples/web/marketplace/catalog.flang: не проверено — ведомость не печатается у программы с замечаниями
```

Examples are part of the program, not a separate test suite: they run on every
check of the file, and the check goes red.

## React stays outside, and the contract stays checkable

The browser code is ordinary. Nobody writes it in flang and nobody is going to:

```jsx
// Ordinary React, not one line of flang.
function Cart() {
  const [bill, setBill] = useState("");
  const [error, setError] = useState("");

  async function add(sku, qty) {
    const res = await fetch("/корзина", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `артикул=${sku}&количество=${qty}`,
    });
    const text = await res.text();
    switch (res.status) {
      case 201: setBill(text); setError(""); break;      // added, bill recomputed
      case 400: setError("quantity is not a number"); break;
      case 404: setError("no item with that sku"); break;
      case 409: setError("stock is short of what was asked"); break;
      case 413: setError("request body over the limit"); break;
    }
  }
  // …
}
```

What is interesting here is not that React calls the service but that **the list
of cases in the `switch` is a consequence, not a convention**. The set of codes is
declared in the service as a type:

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

and the claim "the response code is from the declared set" is proved by induction
over that type — nine base cases. Two things follow that are usually paid for
with discipline:

| what a front end usually learns in production | what is known here before launch |
|---|---|
| "where did that 500 come from?" | there is no 500 in the set, and that is proved, not tested |
| "an unknown method came back 404" | 405 is separated from 404 by routing on the path's section and depth |
| "an outcome was added and its code forgotten" | the compiler refuses: the case is not covered |
| "the reason field arrived empty" | "the code's reason phrase is non-empty" is proved by the same nine cases |

The specification here is not a document beside the code but the code itself: the
list of outcomes, the code table, and the theorem that ties them. The front end
does not check it and does not have to — it is checked where it is written.

## The rule that arrives second

A test answers for the inputs written into it. A proved promise answers for
**all** of them. The difference shows up at the first requirement that arrives
second.

In `fspec/spec/` the first spec writes down the rule "discount is at most 30". A
month later comes "a promo order gets a bigger discount", and someone writes a
second function and a second spec. The question is not whether the new one works
— the question is whether **the first rule is still true**. With tests you answer that by having
two people read the code. Here it is one command:

```sh
./ярлык спеки:проверка
```

```
спеки согласны: спек 42, утверждений 295, и каждое доказано из нуля аксиом
```

"From zero axioms" means nothing was taken on faith: under every claim there is a
chain that reaches the rules of the language itself.

The first two specs in the catalogue show exactly the LINK between two rules, not
a strong claim: they are written as an upper bound, and an upper bound survives
replacing the body with zero. For strong claims look at specs 3–27 and at the
marketplace example above.

Next to the specs lives a **forgery set**: cases where a spec is deliberately
spoiled, and the check must go red on every one.

```sh
./ярлык спеки:подлог
```

Among the things it catches: a rule weakened under the same name; a spec with no
predecessor; a translated view promising something the original does not; a typo
in the language tag; a translated function name. There are fourteen cases, and
the check must catch each — while staying **silent** on an honest change,
otherwise it is not catching forgery, it is catching movement.

## A rule in another language is the same rule

A promise can be written in the language of the team that uses it:

```flang
обеспечивает «zh: 折扣不超过 30» результат не больше 30
```

This is a real claim, not a note beside one: it gets proved along with the rest.
The subject stays single not by agreement but because the translated goal is
compared with the original character for character. Promise different things and
the check goes red.

The price, named: a colon in a promise's name now means a language tag. And the
limit, named: the check cannot read the translation itself — if the Chinese view
is named wrongly while the goal is right, it stays silent.

## What to read next

- [A case taken apart: leetcode tasks](case-studies.html) — five whole solutions and what is proved about them.
- [What is proved](what-is-proved.html) — numbers from the tree, not promises.
- [When a proof is refused](proof-refused.html) — why the kernel refuses and what to do.
- [Clarifying questions](dlya-ii.html) — how an unproved promise turns into a question for whoever wrote the requirement.
- `examples/web/marketplace/README.md` in the tree — the same example in more detail, with the file layout.
- `fspec/README.md` — how the spec catalogue is laid out.
