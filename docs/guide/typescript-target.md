# The TypeScript target

`flang emit program.flang --target ts --out dir` prints the program as
TypeScript. It is the same printer as target `js` — same function bodies, same
runner, same runtime — with one addition: every printed function, record and
sum type carries its declared type.

## What the output directory holds

| file | what it is |
|---|---|
| `<name>.ts` | the program: `export function f(n: number): number`, `export type Zapis = { "поле": number }`, `export type Summa = $FlangVariant`, the `$PROGRAM` table for the runner |
| `flang_runtime.js` | the runtime — the same pieces target `js` inlines into the module, as a separate file with an `export` line; the `.ts` imports what it needs |
| `flang_cli.js` | the runner, the same as for target `js`: JSON in, JSON out |
| `tsconfig.json` | `tsc` settings: `strict`, `allowJs`, `noEmit`; placed next to the output so checking needs no flags |
| `flang_host_node.js` | the I/O host — only for a program with a `план` declaration, as with target `js` |

## Check and run

```sh
cd dir && tsc -p .                           # strict type check, exit code 0 means the module holds
printf '%s\n' '{"fn":"Факториал","args":[{"n":"10"}]}' | node flang_cli.js ./factorial.ts
```

Node 23.6 and newer reads `.ts` directly by stripping types; Node 22.6–23.5
needs `--experimental-strip-types`. Only erasable syntax is printed — type
annotations, `type`, `as` — so there are no `enum`s or parameter properties in
the output and no build step is required. To get `.js` files:
`tsc -p . --noEmit false --outDir dist`.

## How types map

| flang | TypeScript |
|---|---|
| `число`, `нат`, `целое` and their synonyms | `number` |
| `строка` | `string` |
| `признак` | `boolean` |
| `ничто` | `null` |
| `список X` | `Array<X>` |
| record «Имя» | `export type Imya = { "поле": T; … }`; factory `(fields: Partial<Imya> = {}): Imya` — a missing field becomes `null`, as in the interpreter |
| sum type «Имя» | `export type Imya = $FlangVariant`; variant constructor `(fields: { "поле": T }): $FlangVariant` |
| optional `X` | `(X\|null)` |
| function as a value | removed before printing in one pass; never appears in a signature |
| unknown type | `any` |

Limits, stated plainly:

* **A sum type is `$FlangVariant`, not a union over variants.** Function bodies
  take variants apart with runtime helpers and `instanceof`; a strict union
  `{ variant: "Лист" } | …` would flag code that is correct.
* **Temporaries inside bodies are `any`.** The type contract lives on the
  signatures of functions, records and sums; temporaries (`$t1`, a fold
  accumulator) are compiler slots, and `tsc` cannot infer them without a mark.
* **The runtime is not rewritten in TypeScript.** `tsc` infers its types from
  the JavaScript (`allowJs`): helper parameters are `any`, return types follow
  the bodies. There is deliberately no second copy of the runtime in the tree:
  two texts would drift apart.

## How it differs from target `js`

* the module is not self-contained: `flang_runtime.js` has to sit next to it;
* `$callDeep` (evaluation on a stack sized for the declared depth limit) is a
  wrapper in the `.ts` that hands the runtime the program module's address: the
  worker has to import the program, not the runtime;
* everything else — refusal texts, codes, step and depth limits, field order —
  is identical, and a comparison of the two outputs shows no difference: the runner
  answers the same questions the same way.

## Where it lives in the tree

The printer is `flang/self/emit-ts.flang` on top of `flang/self/emit-js.flang`
(a "typed" flag in the shared printer); the target's runtime directory is
`flang/src/emit/ts/` (one file, `tsconfig.json`; the rest comes from
`flang/src/emit/js/`); the target table row is in
`flang/src/emit/c/flang_repl.c`. The binary built from the seed prints `ts`
after the seed is reprinted (`scripts/raskrutka.sh`); until then
`flang emit --target ts` refuses, naming the function the seed lacks.
