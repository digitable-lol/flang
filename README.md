**English** · [Русский](README.ru.md)

# FTS and flang — a specification that runs, and prints itself into your language

A written specification drifts from the code the day after it is merged. This repository takes
the other route: the specification **is** the program. You write the rules once, run them, test
them against their own examples, and then print them into C, Rust, Go, Python or JavaScript —
where the printed code is required to produce the same values and the same error codes as the
interpreter, checked input by input.

Two layers:

- **FTS** (`.fts`) — an indentation-based executable specification language for domain objects,
  deterministic utilities, examples, checked properties, morphisms and machine-checkable evidence.
- **[`flang`](flang/SPEC.md)** — the full language FTS grew into: sum types, lists, strings as
  data, recursion, pattern matching, module linking, and five code generators. Every existing
  `.fts` model is a valid flang program, verified on 19 593 inputs with zero divergences.

The authoring surface is Russian; an English surface exists and lexes to the same identifiers
(`функция` / `function`, `свёртка` / `fold`). The prose below is English, the code is not
translated — names in a specification belong to the domain that wrote them.

---

## One function, five targets

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
node flang/bin/flang.mjs emit flang/examples/leetcode/035-search-insert-position.flang \
  --target c --out ./out-c        # …and again with go, rust, python, js
```

and is pasted verbatim, not written by hand. The C, Go, Rust and Python backends emit the module,
a runtime, a JSON-in/JSON-out driver and a build file; the JS backend emits one self-contained
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

Each backend is checked differentially, not by golden files. The corpus is everything in this
repository actually written in flang — `flang/stdlib/*.flang` and
`flang/examples/leetcode/*.flang`: **31 programs, 154 functions, 259 examples**. For every
function a grid of inputs is built from its own examples plus deliberately wrong arguments
(`null`, a string where a list is wanted, a variant that does not exist), the program is printed
into an empty directory, compiled with the real toolchain from nothing but what the backend
emitted, and run as a real process. **2235 grid points** must agree with the interpreter — same
value, same error code, same error text.

The C backend additionally compiles under `gcc` *and* `clang` with
`-std=c99 -Wall -Wextra -Werror -pedantic -O2` and is checked under `valgrind` for zero
unreachable bytes.

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

From that single source you get the implementation, the tests, and the checks — in five
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
node flang/bin/flang.mjs test flang/examples/leetcode/121-best-time-to-buy-and-sell-stock.flang --pretty
```

There are 26 LeetCode solutions in [`flang/examples/leetcode/`](flang/examples/leetcode), each
with a comment explaining not only the algorithm but where the language pushed back — why
binary search needs a "fuel" list to be accepted as terminating, why Single Number is O(n²)
because there are no bitwise operations, why Roman numerals cannot be total until strings can be
walked character by character. The standard library
([`flang/stdlib/`](flang/stdlib): `lists`, `numbers`, `optional`, `result`, `strings`) is written
the same way — 77 functions, of which 63 are proven total.

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

This is not pedantry, and the reason is concrete. The embedded fact-checking mode
([`flang/src/factcheck.mjs`](flang/src/factcheck.mjs)) answers "does this claim hold about this
data" — and a system that must answer yes or no is not allowed to hang. So it refuses to run a
function that was not proven to terminate, before evaluating anything:

```bash
echo '{"н": 30}' | node flang/bin/flang.mjs facts \
  flang/examples/leetcode/509-fibonacci-number.flang \
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
echo '{"цены": [7, 1, 5, 3, 6, 4]}' | node flang/bin/flang.mjs facts \
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

## The core is written in the language itself

[`flang/core/`](flang/core) is the FTS core — lexer, parser, evaluator, JSON printer — rewritten
in flang: **300 functions, every one of them `тотальная` and proven so**. `fts check` is not
allowed to hang either.

The correctness criterion is not "its own tests pass". It is a differential one, stated in
[`flang/core/SPEC.md`](flang/core/SPEC.md): run the whole chain — *text → lexer in flang →
parser in flang → JSON printer in flang* — and require the output string to equal
`JSON.stringify(compile(text))` of the TypeScript core **byte for byte**. It is run over **every
`.fts` model in this repository** — 47 of them on a clean clone, examples, demos, tool fixtures
and the models the tools carry — with **zero divergences**, on both surfaces (indentation and
braced). If an external model directory is present on the machine, its models are added to the
same run, so your local count may be higher than 47; the promise is the corpus, not the number.
Diagnostics are compared separately, on 34 deliberately broken indentation models and 13 braced
ones — code *and* message text.

Byte equality is a strong statement, not a formality, because the JSON string exposes everything
a looser comparison would hide: key insertion order, `5` versus `"5"` versus `да`, how a float is
rendered, whether a name kept its guillemets, which diagnostic fired first and in which words.
A reimplementation that is "morally the same" fails this test on its first document. (An early
draft of the contract stored scalars as strings; the JSON printer refuted it immediately —
`5`, `"5"` and `да` print differently and are indistinguishable as text.)

### Which means the core compiles to a native binary

```bash
node flang/bin/flang.mjs emit flang/core/parser.flang --target c --out ./core-c
make -C ./core-c
```

Measured on this machine (gcc 13.3, x86-64, `-std=c99 -Wall -Wextra -Werror -pedantic -O2`):

- compiles with **zero warnings** — the flags are part of the backend's contract, not advice;
- **663 KB** binary (625 KB stripped), linked against **`libc` and `libm` and nothing else** —
  no Node, no runtime to install;
- the largest model in the repository (`tools/gacascade/models/assignment.fts`, 19.5 KB of
  source) is parsed in **~30 ms**, process startup included;
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

## Quick start

Node.js 20 or newer.

```bash
npm install
npm run build
```

flang, on a file that is not tied to Node in any way:

```bash
# parse, type-check, prove totality
node flang/bin/flang.mjs check flang/examples/leetcode/035-search-insert-position.flang --pretty

# run the examples declared inside the functions
node flang/bin/flang.mjs test flang/examples/leetcode/035-search-insert-position.flang --pretty

# call a function
node flang/bin/flang.mjs run flang/examples/leetcode/035-search-insert-position.flang \
  --function "Место вставки" --args '{"элементы":[1,3,5,6],"цель":2}'
# {"function":"Место вставки","args":{...},"result":1}

# print it — targets: c | go | rust | python | js
node flang/bin/flang.mjs emit flang/examples/leetcode/035-search-insert-position.flang \
  --target python --out ./out-python
```

Any `.fts` model is a valid flang program, so the same commands take one directly:

```bash
node flang/bin/flang.mjs check examples/utilities/discount.fts --pretty
node flang/bin/flang.mjs emit examples/utilities/discount.fts --target go --out ./out-go
```

FTS's own CLI, for models specifically:

```bash
node dist/src/cli.js pipeline examples/real-world/order-shipment.fts --pretty
node dist/src/cli.js test examples/utilities/discount.fts --pretty
node dist/src/cli.js run examples/utilities/discount.fts \
  --utility "Рассчитать скидку" --input examples/utilities/discount.input.json --pretty
node dist/src/cli.js certify examples/real-world/order-shipment.fts \
  --context examples/real-world/order-shipment.context.json --pretty
node dist/src/cli.js generate examples/utilities/discount.fts --out generated
```

Tests:

```bash
npm run test:flang    # the language: parser, types, totality, backends, the core in flang
npm test              # everything: core, tools, flang
```

Backend tests compile the generated code with the real toolchain and skip explicitly when it is
absent — a skipped test is not a passing test, so where the toolchain is supposed to exist
(CI, a release machine) set `FTS_REQUIRE_TOOLCHAINS`: `1` demands every backend, `rust,go`
demands the listed ones, and a missing compiler then fails by name instead of vanishing.
`FTS_TOOLCHAIN_PATH` adds lookup directories.

The differential core checks (`flang/test/core-json.test.mjs`, `flang/test/core-parser.test.mjs`)
run over every `.fts` model in the repository — 47 of them, the same number on any clean clone.
`FTS_MODEL_PATH` (a `PATH`-style list of directories) adds model corpora from outside the
repository; a directory that does not exist, is not a directory, or holds no `.fts` at all is an
error rather than a silent skip. Either way the tests print the coverage they actually got —
count and sources — so a run on a clean clone is told apart from a run with an external corpus
by looking at the output:

```bash
node --test flang/test/core-json.test.mjs
# ✔ корпус моделей найден — 47 моделей: только репозиторий, внешний корпус не подключён …
FTS_MODEL_PATH=/path/to/models node --test flang/test/core-json.test.mjs
# ✔ корпус моделей найден — 56 моделей: репозиторий 47 + внешние 9 (FTS_MODEL_PATH)
```

Every command writes JSON to stdout, diagnostics to stderr, and returns non-zero on failure —
the same contract everywhere, which is what makes it usable from CI, editors and agents.

---

## Modules and the standard library

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

---

## The rest of the repository

- **Library** — `compile`, `validate`, `executeUtility`, `testUtilities`, `generateTypeScript`,
  `certify`, `verify`. No runtime dependencies, no I/O from the library API. The interchange
  format is [`schema/document.schema.json`](schema/document.schema.json); the `./browser`
  entrypoint gives parsing, validation and visualization without Node.js cryptography, so strict
  certificate decisions stay on the server. The package is not on npm yet — use the repository
  directly (`npm install && npm run build`).
- **[`tools/ftsc`](tools/ftsc/README.md)** — the project compiler: trees of `.fts` modules,
  checked functors between categories, code generation for eight languages (C, Rust, C#, Java,
  Elixir, Go, Python, TypeScript).
- **[`tools/ftsvm`](tools/ftsvm/README.md)** — executes utilities from the `ftsc` IR by
  interpretation or by JIT to JavaScript.
- **[`tools/ftspec`](tools/ftspec/README.md)** — finds conflicts between specifications,
  constitution invariants and recorded decisions, before implementation starts.
- **MCP server** — `fts-mcp` (or `fts mcp`) over stdio, ten read-only tools: `fts_compile`,
  `fts_check`, `fts_test`, `fts_generate`, `fts_execute`, `fts_prove`, `fts_visualize`,
  `fts_certify`, `fts_verify`, `fts_pipeline`. See [Agent integration](docs/agents.md).
- **Benchmarks** — `npm run benchmark`; the harness and a checked-in Apple M1 Max baseline are in
  [`benchmarks/`](benchmarks/README.md).

Further reading — in English: [Architecture](docs/architecture.md) ·
[Adoption](docs/adoption.md) · [Agents](docs/agents.md).
In Russian (the language surface is Russian, and so is most of the prose):
[Справочник языка](docs/language.ru.md) · [Как это работает](docs/how-it-works.ru.md) ·
[Исполняемые утилиты](docs/executable-utilities.ru.md) ·
[Прикладные примеры](docs/examples.ru.md) ·
[Зачем нужен FTS и как его интегрировать](docs/why-and-integration.ru.md) ·
[flang SPEC](flang/SPEC.md) · [core-in-flang contract](flang/core/SPEC.md).

---

## Known limits

Stated plainly, because a project with undrawn borders is not one you can rely on. The full lists
are in [`flang/SPEC.md`](flang/SPEC.md) §10 and the "Долги" section of
[`flang/core/SPEC.md`](flang/core/SPEC.md).

**The language.**

- Functions are not first-class values. This is deliberate: without exponentials the language
  still prints into targets that have no closures, and the termination analysis stays simple.
  Higher-order work is covered by `отобразить` / `отфильтровать` / `свёртка`, which take a *body*
  rather than a function.
- No dictionaries, no arrays with random access, no bitwise operations. Table-driven dynamic
  programming (Coin Change, Edit Distance) does not transfer; a dictionary is a list of pairs.
- The totality analysis knows structural decrease only. A number getting smaller is not
  decrease, so binary search has to carry a "fuel" list to be accepted, and walking a string
  character by character cannot be total at all.
- A variant named like a keyword (`Да`, `Плюс`, `Больше`) is not matched in patterns, and the
  diagnostic blames the pattern instead of naming the real cause. Workaround: rename it, or use
  the explicit `случай вариант «Имя»` form the stdlib uses.

**The core written in flang.** It matches the TypeScript core byte for byte on every model in
the corpus, and the places where it would not are known and written down:

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
than discovered by you.

## Status

`0.x` is the language-design phase. The canonical JSON shape and the diagnostic codes are treated
as compatibility surfaces; syntax may grow through documented proposals.

## License

BSD 2-Clause. The project previously carried Apache-2.0, inherited from the repository it grew
out of rather than chosen; BSD 2-Clause is the deliberate choice. See [LICENSE](LICENSE).
