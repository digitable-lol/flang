# Страница `Category:Flang` — готовая разметка

Вставлять целиком, заменяя содержимое страницы
<https://rosettacode.org/wiki/Category:Flang> (правка страницы, не создание —
страница уже существует).

**Список решений сюда вписывать не нужно и нельзя.** Шаблон `{{header|Flang}}`,
который стоит в каждом решении, через ветку по умолчанию делает
`[[Category:Flang]]` и проставляет свойство «Implemented in language». Задачи
появляются в блоке «Pages in category» сами, как только выложены; вручную
поддерживаемый список разошёлся бы с ним на первой же новой задаче.

Оба листинга ниже прогнаны на компиляторе перед тем, как попасть сюда:
принимаемый даёт `valid: true` и сходящиеся примеры, отвергаемый — ровно ту
диагностику, которая процитирована.

---

```mediawiki
{{language|Flang
|exec=both
|site=https://github.com/digitable-lol/flang
|parampass=value
|safety=safe
|strength=strong
|compat=nominative
|express=explicit
|checking=static
|tags=text
}}
{{language programming paradigm|Functional}}
{{language programming paradigm|Declarative}}

'''Flang''' is a statically and strongly typed functional language built around one
distinction: a function is either ordinary, or its termination is ''proven'' by the
compiler. Both kinds live side by side in the same file, and the boundary between
them is enforced rather than described.

The language grew out of FTS, an executable specification format, and keeps its
central idea: the examples that show what a function does are part of the function,
not of a separate test file.

== Two classes of functions ==

A function marked <code>total</code> is rejected unless the compiler can prove it
terminates — by structural descent (a recursive call receives a part of an argument:
the tail of a list, a field of a variant) or by a numeric measure that decreases by a
constant step toward a proven floor.

<syntaxhighlight lang="text">
module «Factorial»

total function «Factorial»
  accepts n: number
  returns number
  example «Five factorial»
    given n equals 5
    expected 120
  example «Zero factorial is one»
    given n equals 0
    expected 1
  if n is at most 1
    then 1
    else n times («Factorial» of (n minus 1))
</syntaxhighlight>

The proof is not a formality, and it is easy to fall outside it. Summing the digits of
a number by repeated division looks just as terminating to a human, and is refused:

<syntaxhighlight lang="text">
total function «Digit sum»
  accepts n: number
  returns number
  if n less than 10
    then n
    else (n modulo 10) plus («Digit sum» of (n divided by 10))
</syntaxhighlight>

<code>FLANG_NOT_TOTAL</code>: the recursive argument <code>n divided by 10</code> is not
derived from any parameter by a recognised descent. Division is not one of the
accepted measures — only a constant step is. Dropping the <code>total</code> marker
compiles the same code as an ordinary function; nothing else changes. The refusal is
about what is ''claimed'', not about what may be written.

This is why several Rosetta Code solutions here carry an explanation of where the
border sits rather than a clever way around it.

== Examples are part of the source ==

The <code>example</code> blocks above are compiled, type-checked against the
signature, and executed by <code>flang test</code>. A function whose examples do not
agree with it does not build. Every function in the standard library — all 135 of
them, across nine modules — carries at least one, and a test refuses any that does not.

== One program, eight targets ==

Programs are printed to C99, Go, Rust, Python, JavaScript, Java, C# and Elixir. The
printed code is not trusted: for every function the run builds a grid from its own
examples plus deliberately wrong arguments, compiles the output with the real
toolchain, runs it as a real process, and requires the same values ''and'' the same
error texts as the reference interpreter. That differential check has found defects no
single backend's tests could see — uncompilable C when a variant and a function shared
a name, a variant literal turning into a record in Go.

== Written in itself ==

The compiler is written in Flang and prints itself to C99, so the released binary needs
no Node.js. The criterion is a fixed point, not a successful build: the reference
implementation prints the compiler sources to C, the compiler built from that C prints
the same sources again, and the two outputs must match byte for byte.

== Two keyword surfaces ==

Every keyword exists in Russian and English — <code>тотальная функция</code> and
<code>total function</code> are the same token, not a translation layer. Each solution
on Rosetta Code is given on both surfaces, and a test compares the two as trees, up to
a renaming of names, so the listings cannot silently drift apart.

== What the language does not have ==

Stated plainly, because it explains several solutions here: no bitwise operations, no
mutable references, no exceptions (failure is a value), and order comparison is defined
for numbers only. Compiler diagnostics are currently emitted in Russian only.

== Links ==

* [https://github.com/digitable-lol/flang Repository]
* [https://courses.digitable.life/fts/ Language guide and browser playground]

== Unimplemented tasks ==

* [[Tasks not implemented in Flang]]

[[Category:Programming Languages]]
```
