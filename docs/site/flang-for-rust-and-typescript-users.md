# flang for Rust and TypeScript users

How is flang like the languages you know, what does it lack and what does it
add? Below are a table of equivalents, one example in three languages and two
lists of differences. Every construct is covered step by step in the
[language tour](tour-functions.html).

## Table of equivalents

| What you need | Rust | TypeScript | flang |
| --- | --- | --- | --- |
| a function | `fn f(x: f64) -> f64` | `function f(x: number): number` | `функция «Ф»` with the lines `принимает х: число` and `возвращает число` |
| an immutable name | `let x = 1;` | `const x = 1;` | `пусть х равно 1` |
| a structure | `struct` | `interface`, `type` | `объект` |
| a sum type | `enum` with data | a union with a tag field | `тип` with `вариант` lines |
| pattern matching | `match` | `switch` on the tag | `разбор` with `случай` lines |
| "may be missing" | `Option<T>` | `T \| undefined` | your own type with two variants |
| an error as a value | `Result<T, E>` | a union or `throw` | your own type: a variant with the result and a variant with the reason |
| a generic type | `enum Maybe<T>` | `type Maybe<T>` | `тип «Возможно» от «А»` |
| a trait, an interface | `trait` and `impl` | `interface` and `class` | `интерфейс` and `класс … есть «…»` |
| `map`, `filter`, `fold` | iterator methods | array methods | `отобразить`, `отфильтровать`, `свёртка` |
| a test | `#[test]` in a `tests` module | Jest, Vitest | `пример` inside the function |
| running tests | `cargo test` | `npm test` | `flang test file.flang` |
| checking without running | `cargo check` | `tsc --noEmit` | `flang check file.flang` |
| an import | `use` | `import` | `использует «Module»` |
| a package | a crate, `Cargo.toml` | an npm package | one `.flang-package` file, the command `flang package` |
| a new project | `cargo new` | `npm init` | `flang new name` |
| a comment | `//` | `//` | `//` |
| a compiler error code | `E0308` | `TS2322` | `FLANG_TYPE` and others with the `FLANG_` prefix |

A compiler error consists of a code, a file, a line, a column and a text in
Russian. Every code is described in the [code reference](diagnostics.html).

## One example in three languages

The cost of delivery: pickup is free, a courier costs 200 plus 20 per
kilometre. The file `delivery-cost.flang`:

```flang insert docs/examples/tour/compare/delivery-cost.flang
модуль «Comparison»

тип «Способ»
  вариант «Самовывоз»
  вариант «Курьером» содержит километров: неотрицательное

тотальная функция «Стоимость доставки»
  принимает способ: «Способ»
  возвращает число
  обеспечивает «стоимость не отрицательна» результат не меньше 0
  пример «курьером за пять километров»
    дано способ равно вариант «Курьером» с километров равным 5
    ожидается 300
  разбор способ
    случай вариант «Самовывоз»
      то 0
    случай вариант «Курьером» с километров как километров
      то 200 плюс километров умножить на 20
```

```text insert output: check docs/examples/tour/compare/delivery-cost.flang
$ flang check docs/examples/tour/compare/delivery-cost.flang
модуль «Comparison»: функций 1, из них с доказанным завершением 1; типов 1
docs/examples/tour/compare/delivery-cost.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
```

The same in Rust:

```rust
enum Method {
    Pickup,
    Courier { km: u32 },
}

fn delivery_cost(method: &Method) -> u32 {
    match method {
        Method::Pickup => 0,
        Method::Courier { km } => 200 + km * 20,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn courier_five_km() {
        assert_eq!(delivery_cost(&Method::Courier { km: 5 }), 300);
    }
}
```

And in TypeScript:

```typescript
type Method =
  | { kind: "pickup" }
  | { kind: "courier"; km: number };

function deliveryCost(method: Method): number {
  switch (method.kind) {
    case "pickup":
      return 0;
    case "courier":
      return 200 + method.km * 20;
  }
}

console.assert(deliveryCost({ kind: "courier", km: 5 }) === 300);
```

Three differences show at once:

- the flang test is written inside the function and runs on every check;
- Rust and TypeScript have no `обеспечивает` line. It is a postcondition: the
  result is at least zero for any arguments;
- the word `тотальная` makes the compiler prove that the function terminates.

The compiler proved the postcondition on its own:

```text insert output: check docs/examples/tour/compare/delivery-cost.flang --proof 2>&1 | grep "постусловие"
$ flang check docs/examples/tour/compare/delivery-cost.flang --proof 2>&1 | grep "постусловие"
  постусловие «стоимость не отрицательна» функции «Стоимость доставки» — доказано индукцией по «Способ»: база 2 случая, шаг при допущении на частях (0 случаев), правила сведения: неотрицательность по построению — утверждение обо ВСЕХ входах типа «Способ», а не о написанных
```

«доказано индукцией по „Способ“» means that both variants of the type were
examined and the result is non-negative in each. The statement covers all
values; the test with five kilometres is one particular case.

## What flang does not have

Every row was checked by running the compiler.

| Familiar | What the compiler answers | What to write |
| --- | --- | --- |
| a mutable variable, `let mut`, `x = x + 1` | `FLANG_PARSE` | `пусть` with a new name, `свёртка`, or `цикл` with a `храним` line |
| exceptions, `throw`, `panic!` | there is no word for it | a type with a variant for the error, and `разбор` at the caller |
| `null`, `undefined` | `FLANG_TYPE` when the result type is different | a type with the variants "present" and "absent" |
| a lambda as a value: `let f = \|x\| x * 2` | `FLANG_UNKNOWN_NAME` | a declared function passed as `функция «Name»` |
| class inheritance | `FLANG_PARSE` | `интерфейс` and several classes |
| the signs `+`, `*`, `==` | `FLANG_PARSE` | the words `плюс`, `умножить на`, `равен` |
| string interpolation: `` `Hello, ${name}` `` | the string stays as written | `соединить ["Hello, ", name] по ""` |
| a loop without a bound: `while (true)` | `FLANG_SUGAR_LOOP` | `пока` with a `шагов не больше` or `убывает` line |

A body after the arrow in `отобразить`, `отфильтровать` and `свёртка` is fine:
`отобразить цены как цена → цена умножить на 2`. You cannot store such a body
in a name or pass it to your own function.

A function does not touch files, the network or the clock by itself. It returns
a description of the action, and the command `flang io` performs it. Details
are on the page [The boundary between flang and the host](host-boundary.html).

## What flang adds

| Feature | What it gives | Where to read |
| --- | --- | --- |
| `тотальная` | the compiler proves that the function terminates on any arguments | [Functions that always terminate](tour-termination.html) |
| `требует` and `обеспечивает` | a precondition and a postcondition; the compiler looks for a counterexample and tries to prove | [Your first proof](first-proof.html) |
| `теорема` | a step-by-step proof for when the compiler did not manage on its own | [Your first proof](first-proof.html) |
| the types `неотрицательное`, `целое`, `сотых` | a value outside the type is rejected at the call | [Your own types](tour-types.html) |
| `flang emit` | one program becomes code in C, JavaScript and other languages | [Generating code](emit-walkthrough.html) |

## What surprises on the first day

- The keywords are Russian, and names are written in guillemets:
  `«Стоимость доставки»`. Keywords have an English spelling too; it is
  described in the [reference](language.html).
- Elements of a list and characters of a string are numbered from one.
- Call arguments are separated by the word `и`: `«Ф» от а и б`. Logical "and"
  is written `и притом`.
- The type `число` is `f64`. Division by zero does not stop the program: the
  result is `Infinity`.

## Next

- [The language tour](tour-functions.html) — six short pages with exercises
- [Which construct to use when](which-construct.html) — Optional, Result,
  `map` and other techniques step by step
- [Known limitations](limits.html) — what the language and the compiler cannot
  do yet
