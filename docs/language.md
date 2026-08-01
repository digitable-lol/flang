# FTS language reference

FTS (*Formal Type Surface*) is a textual surface over a canonical JSON document. Its notation is deliberately close to TypeScript, while its semantic vocabulary is categorical and Curry–Howard-oriented.

## Source forms

`compile` accepts:

1. native FTS syntax in `.fts` files;
2. legacy CH/TS syntax in `.ch.ts` files;
3. a canonical JSON object;
4. `export default <canonical JSON> as const`.

File extensions are conventions; the compiler reads content.

## Grammar

```text
document       := "category" Identifier "{" declaration* "}"
declaration    := structure | functor | proposition
structure      := "structure" Identifier "{" field* "}"
field          := Identifier "?"? ":" TypeExpression separator?
functor        := "functor" Identifier ":" TypeExpression "->" TypeExpression
proposition    := "proposition" (witness | apply | compose)
witness        := "witness" Identifier "." Identifier "{" property* "}"
apply          := "apply" Identifier? "{" property* nestedProposition "}"
compose        := "compose" FunctorList? "{" property* nestedProposition "}"
nestedProposition := ("proposition"?) (witness | apply | compose)
FunctorList    := "[" value ("," value)* "]"
separator      := newline | ";"
```

Comments use `// ...` or `/* ... */`. Strings may use single or double quotes. Objects permit identifier keys, which is the only intentional JSON5-like convenience.

## Declarations

`category` is the document boundary and roughly corresponds to a TypeScript namespace.

`structure` is a named object shape. Its fields retain TypeScript-like type expressions as strings in canonical JSON.

`functor f: A -> B` declares a named morphism. An optional `law` is available in canonical JSON; the current textual surface assigns `functor.arrow`.

## Propositions

### `witness`

```fts
proposition witness Task.status {
  selector { id: "T-1" }
  value "done"
  path ["tasks", { id: "T-1" }, "status"]
  detail "task is complete"
}
```

Without context, a witness is symbolic. With context, `prove` walks `path` and checks `value`. String segments access object properties, numbers access array indices, and object segments select the first array item matching all selector fields.

### `apply`

```fts
proposition apply normalize {
  witness Input.valid { value true }
}
```

The referenced functor must be declared or built in.

### `compose`

```fts
proposition compose {
  functors: ["humanImpliesMortal"]
  witness Individual.isHuman { value true }
}
```

Legacy `proposition compose [f, g] { ... }` is also accepted.

## Built-ins

`id`, `compose`, `field`, `path`, and `witness` are reserved built-in functors. They participate in validation but are not injected into the canonical document, so compilation is stable and free of implicit output.

## Diagnostics

Parser diagnostics contain a stable code and a 1-based line/column span. Semantic diagnostics contain a stable code and JSON path. Consumers should branch on `code`, not English `message`.
