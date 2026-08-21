# Operations: what does what

The [glossary](../glossary.html) (in Russian) answers "what does this word mean". This page
answers a different question: **"I have a list and I need the sum without
duplicates — what do I write?"**

Everything below lives in one file, `docs/examples/operations.flang`, in the
language repository — the page reads fine without it, and running the whole
thing is easiest from a clone of the tree:

```bash
git clone https://github.com/digitable-lol/flang.git
flang test flang/docs/examples/operations.flang
```

The answer: **237 examples, 237 passed, 0 failed**. Two hundred thirty-one of
those are the library's own examples, pulled in by the imports — counting someone
else's examples as yours would be dishonest, so the number is given whole rather
than as a share.

Tasks with scalar arguments are also called on their own, by the `flang run`
command printed next to them, and the answer under the command was taken off a
run. Tasks whose argument is a list have no command line: `--args` takes only a
flat object of scalars, and the example inside the function answers for them.

## Where operations come from

The language has few words, on purpose: `плюс`, `минус`, `умножить на`,
`делить на`, `остаток от`, `равно`, `не меньше`, `если … то … иначе`, `свёртка`,
`разбор … случай`. Everything else is a **library function**, written in flang
itself and living in `flang/stdlib/`:

| Module | File | Functions | Lines |
| --- | --- | --- | --- |
| «Списки» (lists) | `flang/stdlib/lists.flang` | 29 | 819 |
| «Строки» (strings) | `flang/stdlib/strings.flang` | 31 | 979 |
| «Списки строк» (string lists) | `flang/stdlib/strlists.flang` | 12 | 438 |
| «Множество строк» (string sets) | `flang/stdlib/sets.flang` | 9 | 202 |
| «Числа» (numbers) | `flang/stdlib/numbers.flang` | 15 | 304 |
| «Высший порядок» (higher-order) | `flang/stdlib/higher-order.flang` | 34 | 547 |
| «Словарь» (dictionary) | `flang/stdlib/dictionary.flang` | 9 | 229 |
| «Словарь хешем» (hash dictionary) | `flang/stdlib/hashmap.flang` | 23 | 883 |

The names and the counts were taken off the tree by counting the files, not
written from memory.

A module is imported by name, in the header, with no path:

```
модуль «Операции»
  использует «Списки»
```

The quoted name must match the module name inside the file. A mismatch is the
refusal `FLANG_IMPORT_NOT_FOUND: не найден модуль «Множества»`. If the module is
attached by path rather than by name (`использует «Множества» из "…/sets.flang"`),
the refusal says more: `модуль в …/sets.flang называется «Множество строк», а
импортируется как «Множества»`. That is not pedantry: it is how a forgotten file
move gets caught.

## Passing arguments: `--args`

Arguments travel in one option, and it takes a **JSON object**: the key is the
parameter name exactly as written in `принимает`; the value is the value.

| Parameter type | What to write | Example |
| --- | --- | --- |
| `число`, `нат`, `целое` (number, natural, integer) | a number | `21`, `-3`, `2.5` |
| `строка` (string) | a double-quoted string | `"раз два три"` |
| `признак` (boolean) | `true` or `false` | `true` |
| `список чего-то` (list of something) | an array | `[3, 1, 3, 2, 1]` |
| a record | an object with field names | `{"начало": 1, "конец": 2}` |

The function name goes in ordinary quotes on the command line — guillemets are
not quotes to the shell, and it would split the name at the space.

**Scalars** — two numbers. One value is printed, with no envelope:

```bash
flang run docs/examples/operations.flang \
  --function "Страниц под записи" --args '{"записей": 23, "размер": 10}'
```

```
3
```

**A list and a record do not travel through `--args`, and that is a border, not
a typo.** The flag takes a FLAT object of scalars — a number, a string, `true`,
`false`, `null` — and refuses on an array or a nested object:

```bash
flang run docs/examples/operations.flang \
  --function "Сумма без повторов" --args '{"элементы": [3, 1, 3, 2, 1]}'
```

```
flang run: «--args» разобрать не удалось — ждался плоский объект скаляров, вроде '{"н":10}'
```

The refusal goes to the error stream; the exit code is 2. The table of types
above is about the language itself: a function does accept such values, they
just cannot be handed to it through `--args` today.

A composite value reaches the compiler through the shell: there it is written
in words of the language rather than in JSON, and the compiler itself reads it.

```bash
echo '«Сумма без повторов» от [3, 1, 3, 2, 1]' | flang repl docs/examples/operations.flang
```

```
объявлено: тотальная функция «Сумма без повторов» — завершение доказано
объявлено: тотальная функция «Третий по порядку» — завершение доказано
объявлено: тотальная функция «Слов в строке» — завершение доказано
объявлено: тотальная функция «Код из адреса» — завершение доказано
объявлено: тотальная функция «Общих меток» — завершение доказано
объявлено: тотальная функция «Страниц под записи» — завершение доказано
загружено из docs/examples/operations.flang
6
```

The shell computes the expression with the system `cc`; without `cc` it does not
switch off — it checks parsing, types and termination and answers `проверено`.

## Lists

| You need | Use |
| --- | --- |
| length | `«Длина» от элементы` |
| prepend | `«Приписать в начало» от элементы и новое` |
| concatenate | `«Соединить списки» от первый и второй` |
| reverse | `«Обратить» от элементы` |
| take / drop N | `«Взять первые»`, `«Отбросить первые»`, `«Срез»` |
| Nth element | `«Элемент» от элементы и номер` — **numbering starts at one** |
| membership | `«Содержит число» от элементы и искомое` |
| sum, product | `«Сумма»`, `«Произведение»` |
| min, max | `«Минимум»`, `«Максимум»` |
| sort | `«Сортировать» от элементы` |
| drop duplicates | `«Уникальные» от элементы` |
| count occurrences | `«Считать вхождения» от элементы и значение` |
| range | `«Числа до» от н`, `«Числа от и до» от начало и конец` |

**Task: sum without duplicates.** Two functions in a row, both total:

```
тотальная функция «Сумма без повторов»
  принимает элементы: список числа
  возвращает число
  пример «Повторы не считаются дважды»
    дано элементы равно [3, 1, 3, 2, 1]
    ожидается 6
  «Сумма» от («Уникальные» от элементы)
```

This one cannot be called from the command line: `--args` takes only a flat
object of scalars (see above). It is checked by its own example —
`flang test docs/examples/operations.flang` — and the example says **6, not 10**:
duplicates are dropped before the addition.

A function name on the command line goes in ordinary quotes — guillemets are not
quotes to the shell, and it would split the name at the space.

**Task: third largest.** One-based numbering is the one place that is easy to get
wrong here, so the example is named to make the mistake obvious:

```
тотальная функция «Третий по порядку»
  принимает элементы: список числа
  возвращает число
  обеспечивает «результат не меньше минимума» результат не меньше («Минимум» от элементы)
  пример «Нумерация с единицы: третий из [1, 4, 5, 9] — это 5»
    дано элементы равно [5, 4, 9, 1]
    ожидается 5
  «Элемент» от («Сортировать» от элементы) и 3
```

There is nothing to call this one with either — its argument is a list; the
answer **5** comes from its own example under `flang test`.

## Strings

| You need | Use |
| --- | --- |
| concatenate | `«Соединить строки» от первая и вторая` |
| split on a character | `«Разбить по символу» от текст и " "` → list of strings |
| replace | `«Заменить» от текст и что и на что` |
| find a substring | `«Позиция подстроки» от текст и искомое` |
| starts / ends with | `«Начинается с»`, `«Заканчивается на»` |
| case | `«В верхний регистр»`, `«В нижний регистр»`, `«Заглавная буква»` |
| trim | `«Обрезать пробелы» от текст` |
| pad to width | `«Дополнить слева» от текст и ширина и символ` |
| explode into characters | `«Символы» от текст` |
| character tests | `«Это цифра»`, `«Это пробел»`, `«Это латинская буква»` |
| repeat | `«Повторить» от текст и раз` |
| palindrome | `«Палиндром» от текст` |

**Task: how many words in a string.**

```
тотальная функция «Слов в строке»
  принимает текст: строка
  возвращает число
  пример «Три слова через пробел»
    дано текст равно "раз два три"
    ожидается 3
  «Длина» от («Разбить по символу» от текст и " ")
```

```bash
flang run docs/examples/operations.flang \
  --function "Слов в строке" --args '{"текст": "раз два три"}'
```

```
3
```

**Task: take one segment of a path.** A string is not a list: it has its own
module. `«Разбить по символу»` yields a **list of strings**, and from there the
«Списки строк» module applies, not «Списки»:

```
тотальная функция «Код из адреса»
  принимает адрес: строка
  возвращает строка
  пример «Хвост после последней косой»
    дано адрес равно "/с/абв"
    ожидается "абв"
  «Строка по номеру» от («Разбить по символу» от адрес и "/") и 3 и ""
```

```bash
flang run docs/examples/operations.flang \
  --function "Код из адреса" --args '{"адрес": "/с/абв"}'
```

```
"абв"
```

The third argument is the **fallback**: what to return when that index is
missing. It cannot be omitted, and that is the point.

## Sets

A set is a list of strings without duplicates; there is no separate type, there
is a module that keeps the invariant.

| You need | Use |
| --- | --- |
| from a list | `«Из списка» от элементы` — duplicates dropped, first-occurrence order kept |
| membership | `«Есть в множестве» от множество и искомое` |
| add, remove | `«Добавить в множество»`, `«Убрать из множества»` |
| union, intersection, difference | `«Объединение»`, `«Пересечение»`, `«Разность»` |
| subset | `«Подмножество» от меньшее и большее` |
| size | `«Размер множества» от множество` |

**Task: how many labels two sets share.**

```
тотальная функция «Общих меток»
  принимает первые: список строки, вторые: список строки
  возвращает число
  обеспечивает «общих не больше, чем в первом наборе» результат не больше («Размер множества» от («Из списка» от первые))
  пример «Две метки общие»
    дано первые равно ["а", "б", "в"]
    дано вторые равно ["б", "в", "г"]
    ожидается 2
  «Размер множества» от («Пересечение» от («Из списка» от первые) и («Из списка» от вторые))
```

Both arguments are lists, so here too the answer comes from the function's own
example, not from the command line: **2** labels in common.

## Numbers

| You need | Use |
| --- | --- |
| absolute value, sign | `«Абсолютное значение»`, `«Знак»` |
| min/max of two | `«Минимум двух»`, `«Максимум двух»` |
| clamp | `«Ограничить» от значение и низ и верх` |
| integer division | `«Целочисленное деление» от делимое и делитель` |
| parity, divisibility | `«Чётное»`, `«Делится на»` |
| power, factorial | `«Степень»`, `«Факториал»` |
| gcd, lcm | `«НОД»`, `«НОК»` — **ordinary, not total** |
| digits | `«Цифры»`, `«Сумма цифр»` — ordinary as well |

Four of the fifteen functions in «Числа» are **not total**, and the `--proof`
report names
them one by one. That is not an omission: Euclid's algorithm does not terminate
by structural descent, and its measure does not decrease along the declared type.

**Task: how many pages for N records.** Rounding up is written with integer
division and a check against zero — otherwise the function would not be total:

```
тотальная функция «Страниц под записи»
  принимает записей: число, размер: число
  возвращает число
  пример «Двадцать три записи по десять»
    дано записей равно 23
    дано размер равно 10
    ожидается 3
  если размер не больше 0
    то 0
    иначе «Целочисленное деление» от (записей плюс размер минус 1) и размер
```

```bash
flang run docs/examples/operations.flang \
  --function "Страниц под записи" --args '{"записей": 23, "размер": 10}'
```

```
3
```

The `если размер не больше 0` branch is not tidiness: without it division by zero
would give infinity, while the function promises a number.

## What the proof report says about this file

```bash
flang check docs/examples/operations.flang --proof
```

The report's summary in full; above it, it names every function and every claim
one by one:

```
итог:
  функций 102: тотальных 98, обычных 4
  обещание несёт: композиция 81, структура 12, точный шаг 3, постоянный шаг 2, объявленная мера 0
  сторожей в рантайме: 2 места
  законов на сетке: 0 (значений в сетках 0); на веру: 0
  утверждений 139: доказано 25 (из них индукцией 4) (из них без теоремы 21, объявленным типом 1), сетка 114, объявлено, не доказано 0
```

**Both postconditions written in this file landed on a grid, not on a proof.**
The report says so plainly:

```
постусловие «результат не меньше минимума» функции «Третий по порядку» — сетка 1
значение (примеры функции): нарушений НЕ ИСКАЛИ — прогона примеров не было,
посчитано только их число. Это не доказательство — теоремы при утверждении нет
```

All twenty-five proven claims come **from the library** this file imports, not
from here: `«Длина»`, `«Соединить списки»`, `«Обратить»`, `«Считать вхождения»`,
`«Позиция подстроки»` and others. Writing a postcondition is easy; getting a
proof under it is separate work, and the kernel does not pretend that work is
done. What it costs and when it succeeds: see [Why and how](proofs.html).

## Next

- [Glossary](../glossary.html) — in Russian; {{словарь.понятий}} concepts, printed from the surface table
- [Writing packages](packages.html) — when operations stop being enough
- [Real case studies](case-studies.html) — the same operations on 82 tasks and a service
