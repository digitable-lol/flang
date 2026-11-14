# The TypeScript target

`flang emit --target ts` prints a program as TypeScript. Function bodies, the runner and the
runtime are the same as for target `js`; the one addition is that every function, record and sum
type carries its declared type.

```flang
модуль «Shapes»

тип «Фигура»
  вариант «Круг» с радиус: число
  вариант «Прямоугольник» с ширина: число и высота: число

объект «Точка»
  «х»: число
  «у»: число

тотальная функция «Площадь»
  принимает ф: «Фигура»
  возвращает число
  пример «Прямоугольник два на три»
    дано ф равно вариант «Прямоугольник» с ширина равным 2 и высота равным 3
    ожидается 6
  разбор ф
    случай вариант «Круг» с радиус как р
      то 3 умножить на р умножить на р
    случай вариант «Прямоугольник» с ширина как ш и высота как вы
      то ш умножить на вы

тотальная функция «Сдвиг»
  принимает х: число
  возвращает «Точка»
  запись «Точка» с «х» равным х и «у» равным 0
```

```sh
$ flang emit shapes.flang --target ts --out out-ts
напечатано файлов 5, байт 57146, в out-ts
…
$ ls out-ts
flang_cli.js  flang_runtime.js  package.json  shapes.ts  tsconfig.json
```

Declarations from the printed module:

```ts
export type Tochka = { х: number; у: number };
export function sozdatTochka(fields: Partial<Tochka> = {}): Tochka
export type Figura = $FlangVariant;
export function Krug(fields: { радиус: number }): $FlangVariant
export function Pryamougolnik(fields: { ширина: number; высота: number }): $FlangVariant
export function ploschad(f: Figura): number
export function sdvig(h: number): Tochka
```

## What the output directory holds

| file | what it is |
|---|---|
| the `.ts` module | the program: functions, record and sum types, the `$PROGRAM` table for the runner |
| `flang_runtime.js` | the runtime; target `js` inlines it into the module, here it is a separate file |
| `flang_cli.js` | the runner, the same as for target `js`: JSON in, JSON out |
| `tsconfig.json` | `tsc` settings: `strict`, `allowJs`, `noEmit` — checking needs no flags |
| `package.json` | the single line `"type": "module"` |

## Check and run

```sh
$ cd out-ts
$ tsc -p .
$ printf '%s\n' '{"fn":"Сдвиг","args":[{"n":"10"}]}' | node flang_cli.js ./shapes.ts
{"ok":true,"value":{"r":[["х",{"n":"10"}],["у",{"n":"0"}]]}}
```

`tsc -p .` is a strict type check; exit code 0 means the module holds. Node 23.6 and newer reads
`.ts` directly by stripping types; Node 22.6–23.5 needs `--experimental-strip-types`. Only
erasable syntax is printed — type annotations, `type`, `as` — so no build step is needed. To get
`.js` files: `tsc -p . --noEmit false --outDir dist`.

## How types map

| flang | TypeScript |
|---|---|
| `число`, `нат`, `целое` and their synonyms | `number` |
| `строка` | `string` |
| `признак` | `boolean` |
| `ничто` | `null` |
| `список X` | `Array<X>` |
| `объект «Имя»` | `export type Imya = { поле: T; … }` and a factory `sozdatImya(fields: Partial<Imya> = {})`; a missing field becomes `null` |
| `тип «Имя»` with variants | `export type Imya = $FlangVariant` and one constructor per variant: `(fields: { поле: T }): $FlangVariant` |
| unknown type | `any` |

Three limits:

* **A sum type is `$FlangVariant`, not a union of its variants.** Function bodies take variants
  apart with runtime helpers and `instanceof`; a strict union would make `tsc` complain where the
  code is correct.
* **Temporaries inside bodies are annotated `any`.** Types sit on the signatures of functions,
  records and sums; the fold accumulator and temporaries such as `$t1` have none.
* **The runtime stays JavaScript.** `tsc` infers its types (`allowJs`).

## How it differs from target `js`

* The module is not self-contained: `flang_runtime.js` must sit next to it.
* Everything else matches: refusal texts and codes, step and depth limits, field order. The
  runner answers the same questions the same way.

The other nine targets: [Print a program into C and JavaScript](emit-walkthrough.md).
