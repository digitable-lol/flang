**English** · [Русский](README.ru.md)

# FTS and flang — a specification that runs, and prints itself into your language

A written specification drifts from the code the day after it is merged. This repository takes
the other route: the specification **is** the program. You write the rules once, run them, test
them against their own examples, and then print them into C, Go, Rust, Python, Java, C#, Elixir
or JavaScript — where the printed code is required to produce the same values and the same error
codes as the interpreter, checked input by input.

The authoring surface is Russian; an English surface exists and lexes to the same identifiers
(`функция` / `function`, `свёртка` / `fold`). The prose below is English, the code is not
translated — names in a specification belong to the domain that wrote them.

## How FTS and flang relate

- **FTS** (`.fts`) — an indentation-based executable specification language for domain objects,
  deterministic utilities, examples, checked properties, morphisms and machine-checkable evidence.
  Its reference implementation is the TypeScript core in [`src/`](src).
- **[`flang`](flang/SPEC.md)** (`.flang`) — the full language FTS grew into: sum types, lists,
  strings as data, recursion, pattern matching, module linking, a category surface, a concurrency
  surface and eight code generators. Its implementation is [`flang/src/`](flang/src).

FTS is the total subset of flang: every existing `.fts` model is a valid flang program. That is
not a slogan but a differential test — both engines run every utility of every model over a grid
of inputs, and both the values and the error codes must agree. The run prints its own numbers:

```
сверка: файлов 22, документов 20, из них с утилитами 13; утилит 24, входов 23084,
из них с ошибкой 773 (коды: FTS_UTILITY_PROPERTY), расхождений 0
```

Two documents carry the rest: [`docs/overview.ru.md`](docs/overview.ru.md) describes the language
and draws the line between what is *proven* and what is *checked*, and
[`flang/SPEC.md`](flang/SPEC.md) is the specification. This page does not go past that line.

---

## Install

**Installing flang does not need Node.** The compiler is written in flang itself and prints to C,
so the release ships that C already printed: a C99 compiler is all it takes.

```bash
brew install digitable-lol/tap/flang
```

Or straight from the release archive, with nothing but `cc` and `make`:

```bash
tar -xzf flang-*-c.tar.gz   # inside: C99 sources and a Makefile, nothing else
make                        # cc -std=c99 -Wall -Wextra -Werror -pedantic -O2
./flang_cli                 # JSON in, JSON out, one request per line
```

The Homebrew formula is [`packaging/homebrew/flang.rb`](packaging/homebrew/flang.rb) and the
tap serves it. The asdf (and mise) plugin installs the same archive from the same releases, and
its source is [`packaging/asdf/`](packaging/asdf/README.md) — but asdf clones a plugin as a whole
repository, and that repository is not published yet, so for now the plugin is source rather than
an install path. Neither needs anything but a C compiler. This is how self-hosting languages
ship — Go carried generated C for years, Nim still does.

**Be clear about what that binary is.** It is the five layers of [`flang/self/`](flang/self):
lexer, parser, types, totality, printing to C. There is no evaluator among them, so running a
program, running its examples or opening a shell needs the full toolchain below.

**The full toolchain does need Node.js 20 or newer**, and here is exactly why: the interpreter,
the shell, the language server, the MCP server and seven of the eight backends exist only in
JavaScript. The self-hosted compiler — the one in the release — prints to **C and nothing else**.

```bash
npm install -g @digitable-lol/fts
```

That gives the commands used on this page: `flang` for the language, `fts` for models, `fts-mcp`
for the MCP server, plus `ftsc`, `ftsvm` and `ftspec`. Inside a clone the same commands are
`node flang/bin/flang.mjs` and `node dist/src/cli.js` — and a clone is what you need for anything
newer than the last published release. The bootstrap problem stays with those who develop the
language itself; see [Developing the language](#developing-the-language).

---

## One function, eight targets

This is `flang/examples/leetcode/035-search-insert-position.flang` — LeetCode 35, the position
where a value belongs in a sorted list. One fold, proven terminating:

```flang
тотальная функция «Место вставки»
  принимает элементы: список числа, цель: число
  возвращает число
  пример «Пример 1 из условия»
    дано элементы равно [1, 3, 5, 6]
    дано цель равно 5
    ожидается 2
  свёртка элементы начиная с 0 как акк и эл → если эл меньше цель то акк плюс 1 иначе акк
```

Everything below was produced by running

```bash
flang emit flang/examples/leetcode/035-search-insert-position.flang --target c --out ./out-c
#              …and again with go, rust, python, java, csharp, elixir, js
```

and is pasted verbatim, not written by hand. Seven backends emit the module, a runtime, a
JSON-in/JSON-out driver, a build file and — where the target has one — a package manifest
(`go.mod`, `Cargo.toml`, `flang.csproj`); the JavaScript backend emits a single self-contained
file. Shown here is only the function itself.

<details open>
<summary><b>C</b> — <code>out-c/mesto_vstavki.c</code></summary>

```c
/*
 * Функция flang «Место вставки».
 *
 * Тотальная: завершение доказано анализом структурного убывания (totality.mjs).
 * @param elementy — «элементы»: список: число
 * @param cel — «цель»: число
 * @return значение: число
 */
fl_status mesto_vstavki_mesto_vstavki(fl_ctx *ctx, fl_value elementy, fl_value cel, fl_value *result, fl_error *error) {
  fl_value fl_t1 = fl_nothing();
  FL_TRY(fl_require_list(ctx, elementy, "свёртка", &fl_t1, error));
  fl_value akk = fl_number(0.0); /* «акк» */
  for (size_t fl_t2 = 0; fl_t2 < fl_t1.as.list.count; fl_t2 += 1) {
    const fl_value el = fl_t1.as.list.items[fl_t2]; /* «эл» */
    fl_value fl_t3 = fl_nothing();
    FL_TRY(fl_lt(ctx, el, cel, &fl_t3, error));
    bool fl_t4 = false;
    FL_TRY(fl_cond(ctx, fl_t3, &fl_t4, error));
    fl_value fl_t5 = fl_nothing();
    if (fl_t4) {
      fl_value fl_t6 = fl_nothing();
      FL_TRY(fl_add(ctx, akk, fl_number(1.0), &fl_t6, error));
      fl_t5 = fl_t6;
    } else {
      fl_t5 = akk;
    }
    akk = fl_t5;
  }
  *result = akk;
  return FL_OK;
}
```

</details>

<details>
<summary><b>Go</b> — <code>out-go/flang/mesto_vstavki.go</code></summary>

```go
// MestoVstavki — функция flang «Место вставки».
//
// Тотальная: завершение доказано анализом структурного убывания (totality.mjs).
//
// Параметр elementy — «элементы»: список: число.
// Параметр cel — «цель»: число.
// Результат — значение: число.
func MestoVstavki(ctx *rt.Ctx, elementy rt.Value, cel rt.Value) (rt.Value, error) {
	t1, e2 := rt.RequireList(ctx, elementy, "свёртка")
	if e2 != nil {
		return rt.Value{}, e2
	}
	// «акк»
	akk := rt.Number(0.0)
	for t3 := range t1 {
		// «эл»
		el := t1[t3]
		t4, e5 := rt.Lt(ctx, el, cel)
		if e5 != nil {
			return rt.Value{}, e5
		}
		t6, e7 := rt.Cond(ctx, t4)
		if e7 != nil {
			return rt.Value{}, e7
		}
		var t8 rt.Value
		if t6 {
			t9, e10 := rt.Add(ctx, akk, rt.Number(1.0))
			if e10 != nil {
				return rt.Value{}, e10
			}
			t8 = t9
		} else {
			t8 = akk
		}
		akk = t8
	}
	return akk, nil
}
```

</details>

<details>
<summary><b>Rust</b> — <code>out-rust/src/mesto_vstavki.rs</code></summary>

```rust
/// Функция flang «Место вставки».
///
/// Тотальная: завершение доказано анализом структурного убывания (totality.mjs).
///
/// Параметр `elementy` — «элементы»: список: число.
/// Параметр `cel` — «цель»: число.
/// Результат — значение: число.
pub fn funkciya_mesto_vstavki(ctx: &rt::Ctx, elementy: rt::Value, cel: rt::Value) -> Result<rt::Value, rt::Error> {
    let t1 = rt::require_list(ctx, elementy.clone(), "свёртка")?;
    // «акк»
    let mut akk = rt::number(0.0);
    // «эл»
    for el in t1.iter().cloned() {
        let t2 = rt::lt(ctx, el.clone(), cel.clone())?;
        let t3 = rt::cond(ctx, t2)?;
        let t4 = if t3 {
            let t5 = rt::add(ctx, akk.clone(), rt::number(1.0))?;
            t5
        } else {
            akk.clone()
        };
        akk = t4;
    }
    return Ok(akk);
}
```

</details>

<details>
<summary><b>Python</b> — <code>out-python/mesto_vstavki.py</code></summary>

```python
def fn_mesto_vstavki(ctx, elementy, cel):
    """Функция flang «Место вставки».

    Тотальная: завершение доказано анализом структурного убывания (totality.mjs).

    Параметр elementy — «элементы»: список: число.
    Параметр cel — «цель»: число.
    Результат — значение: число.
    """
    _t1 = rt.require_list(ctx, elementy, "свёртка")
    # «акк»
    akk = rt.number(0.0)
    for el in _t1:
        if rt.cond(ctx, rt.lt(ctx, el, cel)):
            _t2 = rt.add(ctx, akk, rt.number(1.0))
        else:
            _t2 = akk
        akk = _t2
    return akk
```

</details>

<details>
<summary><b>Java</b> — <code>out-java/MestoVstavki.java</code></summary>

```java
  /**
   * Функция flang «Место вставки».
   *
   * Тотальная: завершение доказано анализом структурного убывания (totality.mjs).
   *
   * @param elementy «элементы»: список: число
   * @param cel «цель»: число
   * @return значение: число
   */
  public static Value fn_mesto_vstavki(Ctx ctx, Value elementy, Value cel) {
    Value[] t1 = Flang.requireList(ctx, elementy, "свёртка");
    // «акк»
    Value akk = Value.number(0.0d);
    for (Value el : t1) {
      Value t2;
      if (Flang.cond(ctx, Flang.lt(ctx, el, cel))) {
        t2 = Flang.add(ctx, akk, Value.number(1.0d));
      } else {
        t2 = akk;
      }
      akk = t2;
    }
    return akk;
  }
```

</details>

<details>
<summary><b>C#</b> — <code>out-csharp/MestoVstavki.cs</code></summary>

```csharp
    /// <summary>
    /// Функция flang «Место вставки».
    ///
    /// Тотальная: завершение доказано анализом структурного убывания (totality.mjs).
    ///
    /// Параметр elementy — «элементы»: список: число.
    /// Параметр cel — «цель»: число.
    /// Результат — значение: число.
    /// </summary>
    public static Value FnMestoVstavki(Ctx ctx, Value elementy, Value cel)
    {
        Value[] t1 = Flang.RequireList(ctx, elementy, "свёртка");
        // «акк»
        Value akk = Value.Number(0.0d);
        foreach (Value el in t1)
        {
            Value t2;
            if (Flang.Cond(ctx, Flang.Lt(ctx, el, cel)))
            {
                t2 = Flang.Add(ctx, akk, Value.Number(1.0d));
            }
            else
            {
                t2 = akk;
            }
            akk = t2;
        }
        return akk;
    }
```

</details>

<details>
<summary><b>Elixir</b> — <code>out-elixir/mesto_vstavki.ex</code></summary>

```elixir
  @doc """
  Функция flang «Место вставки».

  Тотальная: завершение доказано анализом структурного убывания (totality.mjs).

  Параметр `elementy` — «элементы»: список: число.
  Параметр `cel` — «цель»: число.
  Результат — значение: число.
  """
  def fn_mesto_vstavki(elementy, cel) do
    t1 = Flang.Rt.require_list(elementy, "свёртка")
    t2 = {:num, 0.0}
    t3 =
      Enum.reduce(t1, t2, fn el, akk ->
        t4 =
          if Flang.Rt.cond_flag(Flang.Rt.lt(el, cel)) do
            t5 = {:num, 1.0}
            Flang.Rt.add(akk, t5)
          else
            akk
          end
        t4
      end)
    t3
  end
```

</details>

<details>
<summary><b>JavaScript</b> — <code>out-js/mesto_vstavki.js</code>, a single dependency-free file</summary>

```js
/**
 * Функция flang «Место вставки».
 *
 * Тотальная: завершение доказано анализом структурного убывания (totality.mjs).
 *
 * @param {Array<number>} elementy — «элементы»
 * @param {number} cel — «цель»
 * @returns {number}
 */
export function mestoVstavki(elementy, cel) {
  const $t1 = $requireList(elementy, "свёртка")
  let akk = 0
  for (const el of $t1) {
    let $t2
    if ($cond($lt(el, cel))) {
      $t2 = $add(akk, 1)
    } else {
      $t2 = akk
    }
    akk = $t2
  }
  return akk
}
```

The JS backend inlines only the runtime helpers this module actually uses, so the output is one
self-contained file that runs in Node and in the browser.

</details>

The generated code is not a sketch you finish by hand. It carries the domain names in comments,
it reports the interpreter's diagnostic codes and messages verbatim, and the header says what it
is: *«Правьте исходник на flang и печатайте заново: любая правка здесь потеряется.»*

### Why the backends are believable

Each backend is checked differentially, not by golden files. The corpus is the standard library
and the LeetCode solutions — `flang/stdlib/*.flang` and `flang/examples/leetcode/*.flang`,
31 programs with 154 functions and 259 examples between them. For every function a grid of inputs
is built from its own examples plus deliberately wrong arguments (`null`, a string where a list is
wanted, a variant that does not exist), the program is printed into an empty directory, compiled
with the real toolchain from nothing but what the backend emitted, and run as a real process.
The run reports what it covered, so the claim is checkable rather than quoted:

```
✔ stdlib и leetcode: собранный Rust совпадает с интерпретатором
ℹ программ: 31, функций: 154, сверенных входов: 2235, за 28 с
✔ примеры stdlib и leetcode сходятся у собранного Rust так же, как у интерпретатора
ℹ сверенных примеров: 259
```

The C backend additionally compiles under `gcc` *and* `clang` with
`-std=c99 -Wall -Wextra -Werror -pedantic -O2` and is checked under `valgrind` for zero
unreachable bytes.

Backend tests need the real toolchain and skip explicitly when it is absent — a skipped test is
not a passing test, so where the toolchain is supposed to exist (CI, a release machine) set
`FTS_REQUIRE_TOOLCHAINS`: `1` demands every backend, `rust,go` demands the listed ones, and a
missing compiler then fails by name instead of vanishing. `FTS_TOOLCHAIN_PATH` adds lookup
directories.

---

## Why this exists

The usual arrangement has a specification in one artifact and the implementation in another, and
a promise that somebody keeps them in step. That promise fails silently: nothing breaks when the
document and the code disagree.

Here the rule is written once, in a form a domain expert can read
(an excerpt from [`examples/utilities/discount.fts`](examples/utilities/discount.fts)):

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

---

## A real problem, not a hello world

LeetCode 121 — best profit from one buy and one sell, one pass, state in a two-field record.
This is `flang/examples/leetcode/121-best-time-to-buy-and-sell-stock.flang` in full:

```flang
объект «Сделка»
  минимум является числом
  прибыль является числом

тотальная функция «Лучшая прибыль»
  принимает цены: список числа
  возвращает число
  пример «Пример 1 из условия»
    дано цены равно [7, 1, 5, 3, 6, 4]
    ожидается 5
  пример «Пример 2 из условия»
    дано цены равно [7, 6, 4, 3, 1]
    ожидается 0
  пример «Пустой список»
    дано цены равно пустой список
    ожидается 0
  разбор цены
    случай пусто
      то 0
    случай голова и хвост
      пусть начальное равно запись «Сделка» с минимум равным голова и прибыль равным 0
      пусть итог равно свёртка хвост начиная с начальное как акк и цена
        пусть минимум равно если цена меньше акк.минимум то цена иначе акк.минимум
        пусть сегодня равно цена минус акк.минимум
        пусть прибыль равно если сегодня больше акк.прибыль то сегодня иначе акк.прибыль
        запись «Сделка» с минимум равным минимум и прибыль равным прибыль
      итог.прибыль
```

It reads as Russian prose — "разбор цены / случай пусто / то 0" — and the `тотальная` keyword on
the first line is a claim the compiler had to prove before accepting the file. The examples are
part of the function, not a separate test file:

```bash
flang test flang/examples/leetcode/121-best-time-to-buy-and-sell-stock.flang --pretty
```

Two example sets are kept, and both are guarded by tests rather than by good intentions.
[`flang/examples/leetcode/`](flang/examples/leetcode) holds 26 solutions, 20 of them total
throughout; each carries a comment explaining not only the algorithm but where the language
pushed back — why binary search needs a "fuel" list to be accepted as terminating, why Single
Number is O(n²) because there are no bitwise operations.
[`flang/examples/rosetta/`](flang/examples/rosetta) holds seven canonical Rosetta Code tasks,
and its test pins the number of functions each file proves total: the set exists to show the
border of the language, so a border that moves has to break a test rather than quietly outdate a
comment. The standard library ([`flang/stdlib/`](flang/stdlib): `lists`, `numbers`, `optional`,
`result`, `strings`) is written the same way — 77 functions, of which 63 are proven total.

---

## What `тотальная` buys you

Turing completeness and guaranteed termination are incompatible, so flang does not choose: it
splits programs into two classes and has the compiler decide which one you are in.

|                              | `тотальная`                     | plain                      |
|------------------------------|----------------------------------|----------------------------|
| recursion                    | structurally decreasing only     | any                        |
| termination                  | proven by the compiler           | not guaranteed             |
| its examples                 | are guaranteed to finish         | may need a step limit      |
| accepted by the fact-checker | yes                              | no                         |

`тотальная` requires every recursive call to receive a structurally smaller argument — the tail
of a list, a field of a variant. If the analysis cannot prove it, you get `FLANG_NOT_TOTAL` and
the file does not compile. Every existing `.fts` model lands in the total class by construction.

A number getting smaller is not structural decrease, and that used to keep whole classes of
string code out of the total class. The built-in form `разложить … на символы` moves the border:
a string becomes a list of one-character strings by code points, and the same walk becomes
recursion over a tail, which is proven. `flang/examples/rosetta/reverse-string.flang` is total
throughout because of it, emoji and Cyrillic included.

This is not pedantry, and the reason is concrete. The embedded fact-checking mode
([`flang/src/factcheck.mjs`](flang/src/factcheck.mjs)) answers "does this claim hold about this
data" — and a system that must answer yes or no is not allowed to hang. So it refuses to run a
function that was not proven to terminate, before evaluating anything:

```bash
echo '{"н": 30}' | flang facts flang/examples/leetcode/509-fibonacci-number.flang \
  --facts - --claims '["«Фибоначчи» от н равно 832040"]' --pretty
```

```json
{
  "claim": "«Фибоначчи» от н равно 832040",
  "holds": false,
  "why": "функция «Фибоначчи» не помечена как «тотальная»; факт-чекинг допускает только тотальные функции — иначе ответ может не наступить"
}
```

The same claim against a total function is verified, and the verdict carries its own derivation
(`steps`: parse, totality check, which facts were read, what was computed, how it was compared):

```bash
echo '{"цены": [7, 1, 5, 3, 6, 4]}' | flang facts \
  flang/examples/leetcode/121-best-time-to-buy-and-sell-stock.flang \
  --facts - --claims '["«Лучшая прибыль» от цены равно 5"]' --pretty
```

```json
{ "ok": true, "results": [ { "holds": true,
  "why": "«Лучшая прибыль» от факта «цены» = 5; требование «равно 5» выполнено", "status": "verified" } ] }
```

The mode has no file, network or clock access, and a hard step budget: the answer depends only
on `(program, facts, claims, limits)`.

---

## The category surface

The semantics were already categorical; the surface used to be silent about it. A morphism is an
arrow between objects, composition is written `после`, a long pipeline is written in reading
order, and `единица` is the identity of an object. Only words — no `→`, no `∘`:

```flang
морфизм «отгрузить» из «Заказ» в «Отгрузка»
морфизм «выставить» из «Отгрузка» в «Счёт»
морфизм «оформить» это «выставить» после «отгрузить»
единица «Заказ»

цепочка «провести заказ»
  сначала «отгрузить»
  затем «выставить»
```

Wiring is checked by the compiler and belongs to the proven side: `«б» после «а»` assembles if
and only if the codomain of `«а»` is the domain of `«б»`, and a chain assembles only if it does
not break in the middle. A mismatch names both ends:

```
FLANG_COMPOSE_MISMATCH: композиция «оформить» не стыкуется:
«выставить» приводит в «Счёт», а «отгрузить» ожидает «Заказ»
```

A functor maps objects and arrows, and the word is not granted without the guarantee — there is
no opt-in flag for the laws, because a mapping that does not preserve composition is not a
functor:

```flang
функтор «Электронное в бумажное» из «Продажи» в «Продажи»
  объект «Заказ» отображается в «Заказ»
  объект «Отгрузка» отображается в «Накладная»
  объект «Счёт» отображается в «Счёт»
  морфизм «отгрузить» отображается в морфизм «печатать»
  морфизм «выставить» отображается в морфизм «подписать»
  морфизм «оформить» отображается в морфизм «оформить бумажно»
```

Three laws are **proven** here, not sampled — statements about all inputs, derived from the
declarations alone, with no grid and no solver:

1. the image of an arrow runs from the image of its domain to the image of its codomain
   (`FLANG_FUNCTOR_ARROW_MISMATCH`);
2. the image of a composition is the composition of the images, in the same order
   (`FLANG_FUNCTOR_COMPOSITION`);
3. the image of an identity is the identity of the image (`FLANG_FUNCTOR_IDENTITY`).

This is possible precisely because a morphism here is a *declaration*, not a value: its name,
domain and codomain are known before anything runs. With first-class functions there is no such
check — composition would be a computation, and equality of two computations is undecidable.

Where the surface stops is stated as plainly: category names (`из «Продажи» в «Биллинг»`) remain
a note for the reader, because a category is not declared as an entity and there is nothing to
check membership against. Natural transformations, monads, monoids and bifunctors are described
in [`flang/cat/SPEC.md`](flang/cat/SPEC.md) and are not implemented.

---

## Concurrency: two steps of seven

Values are immutable by construction, so two computations looking at one value cannot interfere:
there are no data races to lose, because there is nothing to build one out of. What the language
lacked was a word for simultaneity. Because functions are not first-class values, a process
cannot be spawned from a function — so **a process is a declaration**: a name, a state type, a
starting function and a handler.

```flang
процесс «Счётчик»
  состояние «Счёт»
  начинает с «пустой счёт»
  принимает «Команда счёта»
  обрабатывает «шаг счёта»

надзор «Учёт»
  процесс «Счётчик» стратегия «перезапустить»
  процесс «Журнал» стратегия «остановить»
  порог отказов 3 за 5000 миллисекунд иначе «передать выше»

прогон «два прибавления и доклад»
  семя 4172
  дано «Счётчик» принимает (вариант «прибавить» с «сколько» равным 2)
  дано «Счётчик» принимает (вариант «прибавить» с «сколько» равным 3)
  дано «Счётчик» принимает (вариант «доложить» с «повод» равным "итог: ")
  ожидается «Счётчик» равен (запись «Счёт» с «всего» равным 5)
  ожидается «Журнал» равен (запись «Записи» с «строки» равным ["итог: 5"])
```

The handler is an ordinary pure function returning "new state plus a list of actions"; sending a
message is *described*, not performed — the scheduler performs it. A `прогон` is an example with
a seed, and it runs in the same `flang test` output as ordinary examples: concurrency must not be
the place where checking stops. One seed gives one delivery log, byte for byte, and that is
checked by re-running after re-parsing the source. Deadlock is a defined outcome
(`исход: "покой"`), not a hang.

```bash
flang test flang/conc/examples/counter.flang --pretty
```

The contract is [`flang/conc/SPEC.md`](flang/conc/SPEC.md), and it names a seven-step plan of
which **steps one and two are done**: the surface, the checks, and the reference scheduler.
Supervision parses and is checked, but the scheduler does not yet apply strategies — a failed
process stays stopped. Processes are not printed into any target — emitting such a program gives
the handlers as ordinary functions and nothing more. The examples are in
[`flang/conc/examples/`](flang/conc/examples).

---

## The shell and the language server

```bash
flang repl flang/stdlib/lists.flang
```

The shell accumulates declarations in a session and evaluates expressions against them. Every
declaration goes the same road as `check` — parse, types, totality — so nothing gets in that the
compiler would reject. A blank line ends a declaration; `.помощь` lists the commands
(`.объявления`, `.исходник`, `.сохранить`, `.загрузить`, `.сбросить`, `.выход`; the English
`.help .list .source .save .load .reset .quit` work too). It is the one command with human output
instead of JSON.

```
» тотальная функция «Удвоить»
…   принимает х: число
…   возвращает число
…   х умножить на 2
…
объявлено: тотальная функция «Удвоить» — завершение доказано
» «Удвоить» от «Длина» от [1, 2, 3]
6
```

Totality is a verdict here, not a label: an ordinary function is announced as
`завершение не доказано: вычисление ограничено лимитом шагов`, and exceeding the limit gives
`FLANG_RECURSION_LIMIT`.

The language server is [`flang/src/lsp.mjs`](flang/src/lsp.mjs), started over stdio by
`node flang/bin/flang-lsp.mjs --stdio` (the package declares it as the `flang-lsp` binary). It
gives the buffer exactly what `flang check` gives the file — the same diagnostics, the same codes,
the same wording — plus completion, signature on hover and go-to-definition, including into
imported modules. Renaming, quick fixes and formatting are absent on purpose: they would be a
second implementation of the language beside the first. Editor setup and the full list of what it
does and does not do are in [`editors/flang-lsp/README.md`](editors/flang-lsp/README.md).

---

## Two implementations, and the fixed point

Two implementations exist, and both are kept deliberately. The **reference** one is written in
TypeScript and JavaScript and defines the behaviour of the language. The **self-hosted** one is
written in flang.

### The FTS core, written in flang

[`flang/core/`](flang/core) is the FTS core — lexer, parser, evaluator, JSON printer — rewritten
in flang: 300 functions, every one of them `тотальная` and proven so. `fts check` is not allowed
to hang either.

The correctness criterion is not "its own tests pass". It is a differential one, stated in
[`flang/core/SPEC.md`](flang/core/SPEC.md): run the whole chain — *text → lexer in flang →
parser in flang → JSON printer in flang* — and require the output string to equal
`JSON.stringify(compile(text))` of the TypeScript core **byte for byte**. It runs over every
`.fts` model in this repository — 50 of them on a clean clone, on both surfaces (47 indentation,
3 braced) — with zero divergences. If an external model directory is present, its models join the
same run, so your local count may be higher; the promise is the corpus, not the number.
Diagnostics are compared separately, on 34 deliberately broken indentation models and 13 braced
ones — code *and* message text.

Byte equality is a strong statement, not a formality, because the JSON string exposes everything
a looser comparison would hide: key insertion order, `5` versus `"5"` versus `да`, how a float is
rendered, whether a name kept its guillemets, which diagnostic fired first and in which words.
A reimplementation that is "morally the same" fails this test on its first document. (An early
draft of the contract stored scalars as strings; the JSON printer refuted it immediately —
`5`, `"5"` and `да` print differently and are indistinguishable as text.)

### The compiler, written in flang, and the fixed point

[`flang/self/`](flang/self) is the flang compiler written in flang. Five layers, each with its
own JavaScript reference to be compared against — not "roughly the same", but to the last
component of the result:

| Layer                 | Functions | Reference          | What must match                                                     |
|-----------------------|----------:|--------------------|---------------------------------------------------------------------|
| `self/lexer.flang`    |        88 | `src/lexer.mjs`    | token stream: kind, value, quotedness, line and column               |
| `self/parser.flang`   |       372 | `src/parser.mjs`   | the AST — **byte for byte** after serialization                      |
| `self/types.flang`    |       276 | `src/types.mjs`    | diagnostics (code, text, line, column) and the signature table       |
| `self/totality.flang` |       124 | `src/totality.mjs` | the verdict: proven functions in the same order, diagnostics, `ok`   |
| `self/emit-c.flang`   |       328 | `src/emit/c.mjs`   | the printed C — **byte for byte**, and it compiles without warnings  |

The comparison lives in `flang/test/self-*.test.mjs` and does not run on well-formed files only:
on a well-formed input the right answer is "no diagnostics", and that answer is also given by a
function that does nothing. So the corpus includes deliberately broken programs and fuzzing over
random sources, where the reference and the flang implementation must fail identically — same
codes, same words, same place.

Readiness is not "it built". It is the classical fixed point:

```
1. the JS compiler prints self/*.flang      → C → build → flang₁
2. flang₁ prints the same self/*.flang      → C → build → flang₂
3. the C printed by flang₁ and the C printed by flang₂ are identical byte for byte
```

**The fixed point has converged.** The reference, `flang₁` and `flang₂` print the compiler
identically — all six files — which means the compiler understands the language the way the
reference does, and no test suite substitutes for that. The check is
`flang/test/self-bootstrap.test.mjs`, and it prints the result:

```
✔ шаги 2 и 3: flang₁ печатает сам себя, flang₂ печатает то же самое
ℹ неподвижная точка сошлась: 6 файлов совпали побайтово у эталона, flang₁ и flang₂
```

This is what makes the Node-free release possible: the C in the release archive is printed from
these sources. The reference implementation is not deleted, and will not be — convergence is
measured against it, and deleting it would delete the check.

One decision is worth naming. The compiler does not require totality: unlike fact-checking it is
allowed to hit a step limit and say so. So `flang/self/` permits ordinary functions where proving
decrease would cost more than it buys (Tarjan's walk over the call graph, recursive descent over
the token stream), and every such place must be named with its reason in the "Долги" section of
[`flang/self/SPEC.md`](flang/self/SPEC.md). The FTS core in `flang/core/` gets no such relief.

### Which means the core compiles to a native binary

```bash
flang emit flang/core/parser.flang --target c --out ./core-c
make -C ./core-c
```

Measured on this machine (gcc 13.3, x86-64, `-std=c99 -Wall -Wextra -Werror -pedantic -O2`):

- compiles with **zero warnings** — the flags are part of the backend's contract, not advice;
- 671 616 bytes (633 048 stripped), linked against **`libc` and `libm` and nothing else** —
  no Node, no runtime to install;
- the largest model in the repository (`tools/gacascade/models/assignment.fts`, 19.5 KB of
  source) is parsed in about 14 ms, process startup included;
- its output was compared against `JSON.stringify(compile(...))` of the TypeScript core and is
  identical byte for byte.

The binary speaks the backend's JSON-in/JSON-out protocol, one request per line, so any language
with pipes can call it without FFI:

```bash
node -e 'const fs=require("fs");
  process.stdout.write(JSON.stringify({fn:"Скомпилировать",
    args:[{s:fs.readFileSync("examples/utilities/discount.fts","utf8")}]})+"\n")' \
| ./core-c/flang_cli
```

---

## Modules, the standard library, and a whole project

[`flang/examples/import-check.flang`](flang/examples/import-check.flang):

```flang
модуль «Проба импорта»
  использует «Списки» из "../stdlib/lists.flang"

тотальная функция «Сумма пробы»
  принимает элементы: список числа
  возвращает число
  «Сумма» от элементы
```

A selective form takes only what you name — `использует «Списки» из "…" только «Сумма», «Длина»` —
which is also how a name conflict between two modules is resolved.

How that scales to a full-size project is shown by
[`examples/library-api`](examples/library-api/README.md), a REST service for a library: the
domain is two FTS models, parsing and data handling are five flang modules, and HTTP and storage
stay with the host on Node. The rule the split follows is one sentence — *if a piece of logic can
have an example, it moves into a model or a module, where the example is executable* — and the
naming, layout, module-splitting and CI conventions derived from that project are collected in
[Раскладка проекта](docs/project-layout.ru.md).

---

## Developing the language

The JavaScript reference implementation stays for good: it is what the fixed point is checked
against, and deleting it would delete the check. Working on it takes a clone:

```bash
npm install
npm run build
node scripts/build-release-c.mjs     # prints the release C and builds it without Node
```

The commands the language answers to:

```bash
# parse, type-check, prove totality
flang check flang/examples/leetcode/035-search-insert-position.flang --pretty

# run the examples declared inside the functions
flang test flang/examples/leetcode/035-search-insert-position.flang --pretty

# call a function
flang run flang/examples/leetcode/035-search-insert-position.flang \
  --function "Место вставки" --args '{"элементы":[1,3,5,6],"цель":2}'
# {"function":"Место вставки","args":{...},"result":1}

# print it — targets: c | csharp | elixir | go | java | js | python | rust
flang emit flang/examples/leetcode/035-search-insert-position.flang \
  --target python --out ./out-python
```

Any `.fts` model is a valid flang program, so the same commands take one directly. That path goes
through the compatibility bridge, which needs the built TypeScript core — so `npm install && npm
run build` inside the clone comes first:

```bash
flang check examples/utilities/discount.fts --pretty
flang emit examples/utilities/discount.fts --target go --out ./out-go
```

FTS's own CLI, for models specifically:

```bash
fts pipeline examples/real-world/order-shipment.fts --pretty
fts test examples/utilities/discount.fts --pretty
fts run examples/utilities/discount.fts \
  --utility "Рассчитать скидку" --input examples/utilities/discount.input.json --pretty
fts certify examples/real-world/order-shipment.fts \
  --context examples/real-world/order-shipment.context.json --pretty
fts generate examples/utilities/discount.fts --out generated
```

Tests:

```bash
npm run test:flang    # the language: parser, types, totality, backends, the core and compiler in flang
npm test              # everything: core, tools, flang
```

The differential core checks (`flang/test/core-json.test.mjs`, `flang/test/core-parser.test.mjs`)
run over every `.fts` model in the repository. `FTS_MODEL_PATH` (a `PATH`-style list of
directories) adds model corpora from outside the repository; a directory that does not exist, is
not a directory, or holds no `.fts` at all is an error rather than a silent skip. Either way the
tests print the coverage they actually got — count and sources — so a run on a clean clone is
told apart from a run with an external corpus by looking at the output:

```bash
node --test flang/test/core-json.test.mjs
# ✔ корпус моделей найден — 50 моделей: только репозиторий, внешний корпус не подключён …
```

Every command writes JSON to stdout, diagnostics to stderr, and returns non-zero on failure —
the same contract everywhere, which is what makes it usable from CI, editors and agents. The one
exception is `flang repl`, which talks to a human.

---

## The rest of the repository

- **Library** — `compile`, `validate`, `executeUtility`, `testUtilities`, `generateTypeScript`,
  `certify`, `verifyCertificate`, `pipeline`. No runtime dependencies, no I/O from the library
  API. The interchange format is [`schema/document.schema.json`](schema/document.schema.json);
  the `./browser` entrypoint gives parsing, validation and visualization without Node.js
  cryptography, so strict certificate decisions stay on the server.
- **[`tools/ftsc`](tools/ftsc/README.md)** — the project compiler: trees of `.fts` modules,
  checked functors between categories, code generation for eight languages (C, Rust, C#, Java,
  Elixir, Go, Python, TypeScript).
- **[`tools/ftsvm`](tools/ftsvm/README.md)** — executes utilities from the `ftsc` IR by
  interpretation or by JIT to JavaScript.
- **[`tools/ftspec`](tools/ftspec/README.md)** — finds conflicts between specifications,
  constitution invariants and recorded decisions, before implementation starts.
- Six more tools in [`tools/`](tools): the FTS language server `ftsls` (one LSP for VS Code,
  Neovim, JetBrains, Zed, Emacs and Helix), the rule coverage map `ftsmap`, model synthesis from
  historical decisions `ftsynth`, evolutionary search `gasearch`, the planning cascade `gacascade`
  and the shared line/column binding `locate`.
- **MCP server** — `fts-mcp` (or `fts mcp`) over stdio, ten read-only tools: `fts_compile`,
  `fts_check`, `fts_test`, `fts_generate`, `fts_execute`, `fts_prove`, `fts_visualize`,
  `fts_certify`, `fts_verify`, `fts_pipeline`. See [Agent integration](docs/agents.md).
- **Editors** — syntax highlighting for `.fts` (Vim, VS Code, tree-sitter, Chroma, Linguist) in
  [`editors/`](editors/README.md), and the `.flang` language server in
  [`editors/flang-lsp`](editors/flang-lsp/README.md).
- **Benchmarks** — `npm run benchmark` (`benchmark:quick` for a short run); the harness and a
  checked-in Apple M1 Max baseline are in [`benchmarks/`](benchmarks/README.md).

Further reading — in English: [Architecture](docs/architecture.md) ·
[Adoption](docs/adoption.md) · [Agents](docs/agents.md).
In Russian (the language surface is Russian, and so is most of the prose):
[Описание языка](docs/overview.ru.md) · [Справочник языка](docs/language.ru.md) ·
[Как это работает](docs/how-it-works.ru.md) ·
[Исполняемые утилиты](docs/executable-utilities.ru.md) ·
[Прикладные примеры](docs/examples.ru.md) · [Раскладка проекта](docs/project-layout.ru.md) ·
[Зачем нужен FTS и как его интегрировать](docs/why-and-integration.ru.md) ·
[flang SPEC](flang/SPEC.md) · [core-in-flang contract](flang/core/SPEC.md) ·
[self-hosting contract](flang/self/SPEC.md) · [category contract](flang/cat/SPEC.md) ·
[concurrency contract](flang/conc/SPEC.md).

The documentation naming rule: an `.md` file with no language suffix is English, `X.ru.md` is its
Russian version. The exception is `README.md` and `SPEC.md` next to code — they keep those names
in whichever language they are written, because GitHub shows them as a directory's front page.

---

## Known limits

Stated plainly, because a project with undrawn borders is not one you can rely on. The same line
is drawn in [`docs/overview.ru.md`](docs/overview.ru.md); the full lists are in
[`flang/SPEC.md`](flang/SPEC.md) §10 and the "Долги" sections of the contracts.

**Proven versus checked.** The distinction matters and the words sound alike, so:

- *proven* — statements about **all** inputs, established by the compiler: termination
  (`тотальная`), types and exhaustiveness of `разбор`, composition and chain wiring, and the
  three functor laws above;
- *checked* — statements about a **finite** set: utility properties, declared examples,
  concurrency runs, and the agreement between the interpreter and the eight backends. "Checked on
  N inputs" is not "proven", and this page does not use one word for the other.

Extending what is proven is possible — conditions that fit linear arithmetic are decidable — but
attaching a solver to the verification conditions is an open task, not a feature.

**The language.**

- Functions are not first-class values. This is deliberate: without exponentials the language
  still prints into targets that have no closures, and the termination analysis stays decidable.
  Higher-order work is covered by `отобразить` / `отфильтровать` / `свёртка`, which take a *body*
  rather than a function. The price is that exponential objects are inexpressible, and with them
  part of the category constructions.
- Effects are described, not performed. The language is pure; work with a network or a file is
  meant to be a description of an action that the host executes. The I/O monad is not
  implemented, so today the host does that work — as `examples/library-api/host/` shows.
- No dictionaries, no arrays with random access, no bitwise operations. Table-driven dynamic
  programming (Coin Change, Edit Distance) does not transfer; a dictionary is a list of pairs.
- The totality analysis knows structural decrease only. A number getting smaller is not decrease,
  so binary search has to carry a "fuel" list to be accepted.
- A variant named like a keyword (`Да`, `Плюс`, `Больше`) is not matched in patterns, and the
  diagnostic blames the pattern instead of naming the real cause. Workaround: rename it, or use
  the explicit `случай вариант «Имя»` form the stdlib uses.

**The category surface.** Morphisms, composition, chains, identities and functors are
implemented. Natural transformations, monads, monoids, groups and bifunctors are specified in
[`flang/cat/SPEC.md`](flang/cat/SPEC.md) and are not. Category names in a functor declaration are
a note for the reader, not a checked claim.

**Concurrency.** Steps one and two of seven: the surface, the checks and the reference scheduler.
Supervision is parsed and checked but not enforced; `породить` does not exist; a message addressee
must be a literal. Emitting a program with processes prints the handlers as ordinary functions and
nothing else — no processes, no scheduler, in any target. There is no seed sweep and no
distribution. Numbers about capacity and cost are not quoted, because step seven — measuring — has
not happened.

**The core written in flang.** It matches the TypeScript core byte for byte on every model in the
corpus, and the places where it would not are known and written down:

- lexer: no NFC normalization, no block comments, no exponent notation (`1e3` reads as a name),
  no escape unwrapping inside string literals, apostrophe does not open a string, "inside
  quotes" is decided by parity rather than by an automaton, and an unclosed plain quote is not
  diagnosed;
- JSON printer: a lone surrogate is not escaped (there is no "character code" form in the
  language), and number rendering is delegated to the built-in `к строке`, which every backend
  must implement as ECMAScript `Number::toString` or byte equality breaks on the first fraction;
- parser: diagnostics carry no line number and no column (the token stream does not carry
  positions yet); for deeply unclosed brackets the diagnostic code matches but the message text
  does not always; a document written as raw JSON is not parsed;
- evaluator: document-level checks (`FTS_UNKNOWN_UTILITY`, `FTS_NO_UTILITIES`,
  `FTS_UTILITY_INPUT_TYPE`) belong to a layer that sees the whole document and are not
  implemented here.

None of these are hit by any model in the corpus — which is exactly why they are listed rather
than discovered by you. The TypeScript core stays the working implementation of FTS and the
reference the rewrite is measured against: `flang/core/` reproduces it, and does not replace it.

## Status

`0.x` is the language-design phase. The canonical JSON shape and the diagnostic codes are treated
as compatibility surfaces; syntax may grow through documented proposals.

## License

BSD 2-Clause. The project previously carried Apache-2.0, inherited from the repository it grew
out of rather than chosen; BSD 2-Clause is the deliberate choice. See [LICENSE](LICENSE).
