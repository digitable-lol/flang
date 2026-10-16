# Proofs in category theory

This page specifies how flang states and checks a theorem about **every**
category: "for every category C, all functors F and G from C to D and every
natural transformation η from F to G, …". The decision and its reasons are in
[ADR-0121](../adr/0121-abstract-category-theorems-are-checked-as-path-equalities.md).
The Russian page [category-proofs.ru.md](category-proofs.ru.md) is the same
specification with the same examples.

The category surface `flang/ct` ([docs/ct/spec.md](../ct/spec.md)) speaks about
**concrete** categories over the types of a program and computes their laws on a
finite grid. This page is about statements where the category is a variable.
Such a statement cannot be computed on a grid at all; it can only be proved.

## State

| what | where | state |
|---|---|---|
| reference corpus: 32 theorems with Lean 4 versions | `flang/ct/proofs/lean/` | Lean accepts 32 of 32, zero `sorry` |
| category model for Lean without mathlib | `flang/ct/proofs/lean/Category.lean` | 117 lines, Lean 4 core only |
| corpus run with a "proved / not" table | `bootstrap/flang run-script category-proofs:check` | prints the table and compares it with `corpus.tsv` |
| `теорема` with a `для всякой категории …` context | this page | specified; the binary compiler does not accept it yet |
| path equality resolver in the kernel | `flang/self/category-proofs.flang` | stage 1 |
| step replay by the C checker and Lean soundness lemmas | `flang/proof/checker/checker.c`, `flang/ct/proofs/lean/Moves.lean` | stage 1 |

## Example

```flang
теорема «Обратный единственен»
  для всякой категории C
  для всяких объектов А Б из C
  для всякой стрелки f из А в Б
  для всяких стрелок g h из Б в А
  дано «g обратна слева» (g после f) равно (единица А)
  дано «h обратна справа» (f после h) равно (единица Б)
  утверждаем g равно h
    g
    равно g после (единица Б) по единице
    равно g после (f после h) по «h обратна справа»
    равно (g после f) после h по ассоциативности
    равно (единица А) после h по «g обратна слева»
    равно h по единице
  следовательно доказано
```

A left inverse and a right inverse of one arrow coincide. Every line of the chain
is an equality of neighbouring terms and the law that makes it true. The kernel
checks every line on its own; there is no proof search.

## Surface

### The theorem

A theorem about categories is an ordinary `теорема «Name»` declaration. The kernel
recognises it by the first line of the block, which starts with `для всякой`,
`для всякого` or `для всяких`. The order of the parts is fixed:

1. context lines `для всяк… …`, one or more;
2. hypotheses `дано «name» <term> равно <term>`, zero or more;
3. the goal `утверждаем <term> равно <term>`;
4. the chain: the first line is a single term, every following line is
   `равно <term> по <law>`;
5. `следовательно доказано`.

### Context

| line | introduces |
|---|---|
| `для всякой категории C` / `для всяких категорий C D` | categories |
| `для всякого объекта А из C` / `для всяких объектов А Б из C` | objects of a category |
| `для всякой стрелки f из А в Б` / `для всяких стрелок g h из Б в А` | arrows; the category is the one of the ends |
| `для всякого функтора F из C в D` / `для всяких функторов F G из C в D` | functors |
| `для всякого естественного преобразования t из F в G` / `для всяких естественных преобразований s t из F в G` | natural transformations between functors with the same ends |

The ends of an arrow and the functors of a transformation are **terms**:
`для всякой стрелки u из (F от А) в Б` is legal. A name is introduced once.
Greek letters are written in guillemets (`«η»`).

### Terms

| written | meaning | type |
|---|---|---|
| `f` | an introduced arrow | its ends |
| `единица А` | identity arrow | А → А |
| `g после f` | composition, first f then g | А → В |
| `F от f` | image of an arrow under a functor | F А → F Б |
| `F от А` | image of an object | object of the target of F |
| `t на А` | component of t: F ⇒ G | F А → G А |
| `G после F` | composite functor (in parentheses before `от`) | functor |
| `единица C` | identity functor of C | C → C |

`после` without parentheses groups to the right. The kernel infers the type of
every term; a composite with mismatched ends, a functor applied to an arrow of
another category, a transformation between functors with different ends is
refused with the term and the line.

### Laws of a step

| law | what is compared |
|---|---|
| `по ассоциативности` | terms are equal once composition brackets are opened |
| `по единице` | the same, and identities are dropped from composites |
| `по функториальности` / `по функториальности F` | the same, and functors are pushed inside: `F от (g после f)` → `(F от g) после (F от f)`, `F от (единица А)` → `единица (F от А)`, `(G после F) от f` → `G от (F от f)`, `(единица C) от f` → `f`; a named functor must occur in the step |
| `по законам категории` | the same as `по функториальности`, unnamed |
| `по «name»` | one substitution of a hypothesis or an earlier theorem, either direction, into a segment of a composite, also under a functor |
| `по естественности t` | one substitution of the naturality square `(G от u) после (t на А)` ↔ `(t на Б) после (F от u)` for any path u from А to Б, also under a functor |

The last two are **exactly one** substitution.

## The path equality resolver

The kernel module `flang/self/category-proofs.flang` («Category proofs») is
connected to the kernel in one place, «Обязательства» in
`flang/self/obligations.flang`: a theorem about categories becomes an obligation
of kind `category` whose verdict the module sets. No other kernel function uses
the module and the module does not call the kernel's reduction.

**Normal form.** An arrow term becomes a **path**, a list of atoms; an atom is a
prefix of functors and a base, an introduced arrow or a component `t на А`.
Three levels: (1) nested composites become one list; (2) identities are dropped
(an empty path remembers its object); (3) functors are pushed to the atoms,
`F от (единица А)` disappears, `(G после F)` becomes the prefix `G F`, the identity
functor leaves the prefix. Each level is a total computation, not a search.

**Substitution.** A hypothesis `L равно R` rewrites a path X when the full normal
form of X contains a segment equal to `P от L` for some functor prefix P; the
segment becomes `P от R`. An empty L inserts `P от R` at a junction whose object is
`P от А`. Naturality is the same substitution with the schema
`(G от u) после (t на А) = (t на Б) после (F от u)` where the path u is read off the
segment itself. The kernel finds the place, the prefix and the side by a bounded
scan of the path and prints them into the record, so the checker searches nothing.

**Checking, not deciding.** Whether two paths are equal in a category with
hypotheses is undecidable in general (the word problem for semigroups reduces to
it). The kernel therefore does not decide it; it checks the chain the author
wrote, one normal form or one substitution per step. Everything it accepts is
obtained by finitely many category laws, functor laws, naturality squares and
hypotheses.

## Trusted and checked

| part | checked by |
|---|---|
| surface parsing and term types | the kernel; the C checker repeats it from the source |
| normal form and substitution | the kernel; the C checker repeats it from the record |
| soundness of each law | a Lean lemma in `flang/ct/proofs/lean/Moves.lean`: an accepted step has equal interpretations in **every** category |
| the category model `Category.lean` | read by eye: 117 lines of textbook definitions |

The record block, one per theorem about categories:

```
категорная теорема «Обратный единственен» строка 1
  вердикт доказано
  шагов 5
  шаг 1 строка 10 единица
  шаг 2 строка 11 гипотеза «h обратна справа» место 2 приставка ⟨⟩ назад
  шаг 3 строка 12 ассоциативность
  шаг 4 строка 13 гипотеза «g обратна слева» место 1 приставка ⟨⟩ вперёд
  шаг 5 строка 14 единица
конец категорной теоремы
```

Terms are not in the record; the checker reads them from the source by line. A
substitution gives the **place** (first atom of the segment, from 1), the functor
**prefix** and the **side**; naturality also gives the length of u.

Forgeries that must be refused: false commutativity (`g после f равно f после g`),
the wrong order of a composite in a hypothesis, a swapped functor in a naturality
step, mismatched ends, two substitutions in one step, a chain that does not end at
the right side of the goal, a reference to a missing hypothesis, a record with the
wrong place or prefix.

## Next

Universal properties (`по единственности`, `существует единственная стрелка`),
cancellation by a monomorphism, intermediate facts (`затем «name»`), an
isomorphism as a goal, duality (`двойственно к «theorem»`), adjunctions and monads,
and the Yoneda lemma over the category of sets. The surface grows; the resolver
stays.

## Corpus

`flang/ct/proofs/corpus.tsv` lists 32 theorems from simple to intermediate with
the stage at which flang proves each one. `flang/ct/proofs/lean/` holds a Lean 4
version of each over `Category.lean`; `flang/ct/proofs/programs/` holds the flang
versions as the stages open them.

```bash
bootstrap/flang run-script category-proofs:check
```

builds the model in a temporary directory, checks each theorem with real Lean
(`LEAN`, otherwise `lean` on the path), each program with the binary
`flang check --proof --strict`, prints the table and compares it with
`corpus.tsv`; a mismatch is `FLANG_CATEGORY_PROOFS`, and `sorry` in the file or in
Lean's output is a refusal.
