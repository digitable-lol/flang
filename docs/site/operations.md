# Operations: what does what

The [glossary](../glossary.html) (in Russian) answers "what does this word mean". This page
answers a different question: **"I have a list and I need the sum without
duplicates — what do I write?"**

Everything below lives in one file, `docs/examples/operations.flang`, and runs:

```bash
node flang/bin/flang.mjs test docs/examples/operations.flang
```

Run on 18 August 2026: **224 examples, 224 passed, 0 failed**. Two hundred
eighteen of those are the library's own examples, pulled in by the imports —
counting someone else's examples as yours would be dishonest, so the number is
given whole rather than as a share.

## Where operations come from

The language has few words, on purpose: `плюс`, `минус`, `умножить на`,
`делить на`, `остаток от`, `равно`, `не меньше`, `если … то … иначе`, `свёртка`,
`разбор … случай`. Everything else is a **library function**, written in flang
itself and living in `flang/stdlib/`:

| Module | File | Functions | Lines |
| --- | --- | --- | --- |
| «Списки» (lists) | `flang/stdlib/lists.flang` | 28 | 741 |
| «Строки» (strings) | `flang/stdlib/strings.flang` | 30 | 666 |
| «Списки строк» (string lists) | `flang/stdlib/strlists.flang` | 12 | 361 |
| «Множество строк» (string sets) | `flang/stdlib/sets.flang` | 9 | 184 |
| «Числа» (numbers) | `flang/stdlib/numbers.flang` | 14 | 247 |
| «Высшего порядка» (higher-order) | `flang/stdlib/higher-order.flang` | 72 | 492 |
| «Словарь» (dictionary) | `flang/stdlib/dictionary.flang` | 9 | 206 |
| «Хеш-таблица» (hash map) | `flang/stdlib/hashmap.flang` | 24 | 802 |

A module is imported by path, in the header:

```
модуль «Операции»
  использует «Списки» из "../../flang/stdlib/lists.flang"
```

The quoted name must match the module name inside the file. A mismatch is a
refusal: `модуль в …/sets.flang называется «Множество строк», а импортируется как
«Множества»`. That is not pedantry: it is how a forgotten file move gets caught.

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

One-based numbering is the one place that is easy to get wrong here, so the
example is named to make the mistake obvious:

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

Sum without duplicates is two functions in a row, both total:

```
  «Сумма» от («Уникальные» от элементы)
```

`[3, 1, 3, 2, 1]` → `6`, not `10`.

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

A string is not a list: it has its own module. `«Разбить по символу»` yields a
**list of strings**, and from there the «Списки строк» module applies, not
«Списки»:

```
  «Строка по номеру» от («Разбить по символу» от адрес и "/") и 3 и ""
```

The third argument is the **fallback**: what to return when that index is
missing. It cannot be omitted, and that is the point. `"/с/абв"` → `"абв"`.

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

```
  «Размер множества» от («Пересечение» от («Из списка» от первые) и («Из списка» от вторые))
```

`["а","б","в"]` and `["б","в","г"]` → `2`.

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

Four of the fourteen functions in «Числа» are **not total**, and the ledger names
them one by one. That is not an omission: Euclid's algorithm does not terminate
by structural descent, and its measure does not decrease along the declared type.

Rounding up is written with integer division and a guard against zero — otherwise
the function would not be total:

```
  если размер не больше 0
    то 0
    иначе «Целочисленное деление» от (записей плюс размер минус 1) и размер
```

23 records at 10 per page → 3 pages.

## What the ledger says about this file

```bash
node flang/bin/flang.mjs check docs/examples/operations.flang --proof --pretty
```

```
функций 99: тотальных 95, обычных 4
обещание несёт: композиция 79, структура 11, точный шаг 3, постоянный шаг 2
утверждений 5: доказано 3, сетка 2, объявлено, не доказано 0
```

**Both postconditions written in this file landed on a grid, not on a proof.**
The ledger says so plainly:

```
постусловие «результат не меньше минимума» функции «Третий по порядку»
  — сетка 1 значение (примеры функции): нарушений не найдено (искали прогоном на всех 1).
    Это не доказательство — теоремы при утверждении нет
```

The three proven claims come **from the library**, not from here: `«Знак»`,
`«Чётное»`, `«Сколько дополнить»`. Writing a postcondition is easy; getting a
proof under it is separate work, and the kernel does not pretend that work is
done. What it costs and when it succeeds: see [Why and how](proofs.html).

## Next

- [Glossary](../glossary.html) — in Russian; 149 concepts, printed from the surface table
- [Writing packages](packages.html) — when operations stop being enough
- [Real case studies](case-studies.html) — the same operations on 82 tasks and a service
