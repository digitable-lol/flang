# Show HN: текст и ответы на возражения

Пояснение для владельца — по-русски; всё, что пойдёт на площадку, — по-английски.

## Прежде чем постить

**Перепроверьте цифры своим прогоном.** В тексте ниже стоят числа; часть из них
я взял из репозитория, часть получил своим запуском. HN проверяет по ссылке за
минуты, и одно расхождение стоит дороже всего остального.

Что проверено МОИМ запуском 7 августа 2026:

- набор Rosetta Code: 15 файлов, 97 функций, 70 тотальных, 222 примера, все
  сходятся (`node --test flang/test/rosetta.test.mjs` — 31 тест зелёный);
- `тотальная` на функции Аккермана даёт `FLANG_NOT_TOTAL` с текстом «рекурсивный
  вызов … не убывает»;
- сравнения порядка для строк отвергаются: `FLANG_TYPE: сравнения порядка
  допустимы только для чисел`;
- печать во все восемь целей на одном модуле; C собран `cc -std=c99 -Wall
  -Wextra -Werror -pedantic` без предупреждений и дал те же значения, что
  интерпретатор; Python и JavaScript — тоже.

Что я НЕ перепроверял своим прогоном и что взято из репозитория (запустите
`npm test` целиком и убедитесь сами):

- «31 программа, 154 функции, 2235 сверенных входов» на каждую цель;
- схождение неподвижной точки самоприменения;
- три названных дефекта, найденных дифференциальной сверкой.

**Расхождение в документах, которое надо свести ДО поста.** Число файлов, на
которых сошлась неподвижная точка, в репозитории названо по-разному:
`docs/overview.ru.md` говорит «все семь файлов», `flang/self/SPEC.md` и
`README.ru.md` — «все шесть файлов». Одно из двух неверно. На HN такое находят, и
находка про число файлов обесценивает утверждение целиком. Поэтому в английском
тексте ниже числа файлов нет вовсе — но в репозитории его надо поправить.

**Не постите в понедельник утром по тихоокеанскому времени** — там пик. Лучше
вторник–четверг, раннее утро по восточному. Это соображение о площадке, а не
факт; проверять его я не стал.

---

## Title

Основной (76 символов, укладывается в лимит HN в 80):

> Show HN: Flang – mark a function total and the compiler proves it or refuses

Запасные:

> Show HN: Flang – a language with two classes of function, proved and ordinary

> Show HN: Flang – executable specifications, eight backends, one interpreter

Чего в заголовке нет намеренно: слов «first», «finally», «solves», «revolutionary»,
«ever». Любое из них — готовый первый комментарий про преувеличение, и дальше
обсуждают уже его, а не язык.

---

## Post text (≈230 words)

> Flang is a functional language with an executable specification: examples live
> in the source, are type-checked, and run as tests rather than sitting in
> comments.
>
> Its one distinctive decision is that functions come in two classes and the
> compiler decides which is which. Write `total` and the compiler has to prove
> termination by structural descent — a recursive call must receive a
> structurally smaller argument, a list tail or a field — or it refuses with
> `FLANG_NOT_TOTAL`. Everything else is an ordinary function with unrestricted
> recursion. The Rosetta Code set in the repo is 97 functions, 70 of them
> proved, and the boundary is pinned by a test, so a solution that quietly stops
> being proved breaks CI.
>
> Programs are emitted to C, Go, Rust, Python, Java, C#, Elixir and JavaScript,
> and the emitted code is differentially checked against the interpreter: same
> values, same error codes, same error texts, on a grid built from the examples
> plus deliberately wrong arguments. That check found defects the per-backend
> tests missed — uncompilable C when a variant and a function shared a name, a
> variant literal turning into a record in the Go backend.
>
> The compiler is also written in flang and reproduces its own emitted source
> byte-for-byte against the reference implementation.
>
> What it does not have, in the repository's own words: no dictionaries or sets,
> no indexed arrays, no exception handling, no laziness, no separate
> compilation. That list is kept honest by a test that fails when a listed gap
> stops being a gap.
>
> Caveats up front: one author, no outside users, and the documentation and
> standard library are in Russian — the keywords have an equal English surface,
> the prose does not.

Ссылки в первом комментарии, а не в тексте: репозиторий, набор Rosetta Code,
`flang/examples/leetcode/index.json` (список недостач) и
`flang/test/missing.test.mjs` (тест, который его держит).

---

## Seven objections and honest answers

Пишите так, как здесь: сначала согласие с тем, что верно в возражении, потом
разница. Спор с очевидно верным замечанием читается как враньё и топит ветку.

### 1. "Totality checking is not new. Agda, Idris, Coq, Lean, Dhall, F* all do this."

> Correct, and I do not claim otherwise. Structural descent is the standard,
> textbook check, and those systems do strictly more than flang does.
>
> Two things here are not about novelty. First, `total` is a declaration in
> ordinary source code that the compiler adjudicates, next to ordinary functions
> in the same file — the two classes coexist rather than the whole language
> being total. Second, and this is the part I actually care about, the
> repository *measures* the boundary instead of describing it: 70 of 97
> functions in the Rosetta Code set, and a test fails if that number moves in
> either direction, because then the prose explaining why some function cannot
> be proved has become false.

### 2. "Russian keywords make this unusable / a toy."

> The keywords have an equal English surface — `module`, `total function`,
> `accepts`, `returns`, `fold … starting with … as …` — and both parse to the
> same AST; there is a FizzBuzz in each in the repo, and I checked the two ASTs
> match with names and positions stripped.
>
> But that is not the whole answer, so: the documentation, the specification,
> the standard library and every source comment are in Russian. If you do not
> read Russian, most of the repository is closed to you. That is a real adoption
> barrier and I am not going to pretend the English keyword table removes it.

### 3. "Eight backends is a party trick. Show me the generated code quality."

> The generated code is not fast and speed is not a goal — the repository says
> so explicitly in its roadmap: values are tagged unions, intermediate lists are
> not fused.
>
> The backends are not there for performance, they are there to be *disagreed
> with*. Every one of them is run against the interpreter on the same inputs and
> must produce the same values, the same error codes and the same error texts,
> including on arguments deliberately corrupted with wrong types. Bugs invisible
> to any single backend's own tests show up immediately: C that would not
> compile when a variant and a function shared a name; a variant literal that
> became a record in Go; a signed zero from division by infinity in Elixir. One
> backend is a code generator you hope is right. Eight cross-checked backends
> are an oracle.

### 4. "Self-hosting to a fixed point is what every compiler does. Why is it a bullet point?"

> Because it is a bullet point about *testing*, not about bootstrapping. Yes,
> stage-2 = stage-3 is ordinary practice and has been since the 1960s.
>
> The claim is narrow: every change to the reference implementation must be
> repeated in the flang implementation or the comparison goes red, and that has
> been catching real divergences — three in one day, per the log. It is a
> regression net with a very high false-negative cost and a zero false-positive
> rate, not a novelty.

### 5. "'Proved' is doing a lot of work here. Where is the semantics? Where is the proof?"

> Fair, and the repository draws the line explicitly because the distinction is
> easy to blur.
>
> Proved, meaning a statement about all inputs derived from declarations:
> termination by structural descent, types, composition matching for morphisms,
> and three functor laws.
>
> Checked, meaning a finite grid of inputs: user-defined properties, examples,
> and the agreement between interpreter and backends. Monoid laws are checked,
> not proved — they are equalities over all values of a carrier. Isomorphism
> laws are neither: an arrow has no body, so there is nothing to evaluate, and
> the compiler only answers whether the claim is well-formed.
>
> There is no mechanized semantics and no proof assistant behind any of this. If
> you want that, this is not it.

### 6. "One author, no users, no papers. Why should I look?"

> No good reason, if you need a language to adopt. There is nothing here to
> adopt yet.
>
> The reason to look is the method, and it is separable from the language: every
> claim in the repository is supposed to be held up by a program, including the
> claims about what the language *cannot* do. A statement that something is
> missing is the one statement about a system that does not break when it
> becomes false — no one writes a test asserting the absence of a feature, and
> the tests asserting presence never look at that sentence. In August 2026 eight
> of fifteen entries in this project's own "what the language lacks" list turned
> out to be false; several had been fixed and the sentence had outlived the gap.
> The fix was a test that runs a program per entry and goes red when the gap
> closes. I have not seen that pattern elsewhere and it is cheap to copy.

### 7. "No dictionaries, no arrays, no exceptions, no laziness. That is not a language, that is a DSL."

> The list is accurate and it is the repository's own; I did not soften it. No
> associative array and no set, so any "count the occurrences" problem is O(n²).
> No indexed access, so dynamic-programming tables and grids do not work. No way
> to catch a built-in failure. No laziness, and none planned. No separate
> compilation, and none planned, because defunctionalisation needs the whole
> program.
>
> What follows from that is a smaller claim than "general-purpose language": the
> compiler for this language is written in it, and the Rosetta Code and LeetCode
> sets run. Where it breaks, the catalogue says which missing feature broke it,
> and which problems it is unable to express at all. Take it as a demonstration
> of a checking discipline, not as a tool you are being asked to switch to.

### Про восьмое возражение, которое почти наверняка придёт

«Это писал ИИ». Оно придёт из-за объёма и однородности комментариев. Честный
ответ короткий и без оправданий: скажите, чем именно писалось, и переведите
разговор на проверяемое — тесты, прогон, дифференциальная сверка. Спорить о том,
кто набирал буквы, бессмысленно; предъявлять запускающиеся программы — нет.

Не пишите «всё написано человеком», если это не так. Это тот самый случай, когда
одна недоказуемая фраза уничтожает доверие ко всем остальным, которые доказуемы.

---

## Чего в тексте нет намеренно

- **«Первый в мире», «единственный», «наконец-то».** Ни одно свойство языка не
  первое: тотальность есть у Agda и Idris, самоприменение — у всех, печать в
  несколько целей — у Haxe и Nim, исполняемая спецификация — у doctest и
  property-based-тестов. Первенство здесь не нужно и не выдержит проверки.
- **«Решает проблему X».** Язык ничего не решает; он проводит границу и называет
  её. Это и есть весь тезис.
- **Сравнений «быстрее чем».** Скорость не измерялась и целью не является.
- **Числа файлов неподвижной точки** — пока в репозитории расхождение (см. выше).
- **Слова «production-ready».** Пользователей нет.
