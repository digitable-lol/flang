# Operations: what does what

The [glossary](../glossary.html) (in Russian) answers "what does this word mean". This page
answers a different question: **"I have a list and I need the sum without
duplicates — what do I write?"**

All the code on this page lives in one file, `docs/examples/operations.flang`,
and runs as a whole:

```bash
flang test docs/examples/operations.flang
```

```
docs/examples/operations.flang: примеров 254, прошло 254, не прошло 0
```

Six of those examples are written here; the other 248 arrive with the library: an
imported module carries its own examples, and they run alongside yours.

## Importing a module

`использует` is the import. A module is attached by name, with no path:

```flang
модуль «Операции»
  использует «Lists»
  использует «Strings»
  использует «String sets»
  использует «String lists»
  использует «Numbers»
```

The quoted name must match the module name inside the file. If nothing matches,
the compiler says where it looked:

```
FLANG_IMPORT_NOT_FOUND в файле imp1.flang, строка 1, столбец 1: не найден модуль «Множества»: ни рядом с файлом, ни выше по каталогам, ни в библиотеке компилятора
```

Attach it by path and get the name wrong, and the refusal names both:

```
FLANG_IMPORT_NAME, строка 1, столбец 1: модуль в /путь/sets.flang называется «Множество строк», а импортируется как «Множества»
```

A module comes in whole. If you want one function, name it with `только` — but
`только` does not follow the dependencies of the function you named:

```flang
  использует «Lists» только «Двоичный поиск»
```

```
FLANG_UNKNOWN_NAME, строка 569, столбец 3: неизвестная функция «Поиск в диапазоне»
FLANG_NOT_TOTAL, строка 569, столбец 3: тотальная функция «Двоичный поиск» вызывает неизвестную функцию «Поиск в диапазоне»: завершение доказать нельзя
```

Add the missing name after a comma — or take the module whole.

## Where operations come from

The language has few words, on purpose: `плюс`, `минус`, `умножить на`,
`делить на`, `остаток от`, `равно`, `не меньше`, `если … то … иначе`, `свёртка`,
`разбор … случай`. Everything else is a **library function**, written in flang
itself and living in `flang/stdlib/`:

| Module | File | Functions |
| --- | --- | --- |
| «Списки» (lists) | `flang/stdlib/lists.flang` | 35 |
| «Строки» (strings) | `flang/stdlib/strings.flang` | 37 |
| «Списки строк» (string lists) | `flang/stdlib/strlists.flang` | 12 |
| «Множество строк» (string sets) | `flang/stdlib/sets.flang` | 9 |
| «Числа» (numbers) | `flang/stdlib/numbers.flang` | 16 |
| «Высший порядок» (higher-order) | `flang/stdlib/higher-order.flang` | 35 |
| «Словарь» (dictionary) | `flang/stdlib/dictionary.flang` | 14 |
| «Словарь хешем» (hash dictionary) | `flang/stdlib/hashmap.flang` | 23 |

## Lists

| You need | Write |
| --- | --- |
| length | `«Длина» от элементы` |
| prepend | `«Приписать в начало» от элементы и новое` |
| concatenate | `«Соединить списки» от первый и второй` |
| reverse | `«Обратить» от элементы` |
| take/drop N | `«Взять первые»`, `«Отбросить первые»`, `«Срез»` |
| Nth item | `«Элемент» от элементы и номер` — **numbering starts at one** |
| membership | `«Содержит число» от элементы и искомое` |
| sum, product | `«Сумма»`, `«Произведение»` |
| min, max | `«Минимум»`, `«Максимум»` |
| sort | `«Сортировать» от элементы` |
| drop duplicates | `«Уникальные» от элементы` |
| count occurrences | `«Считать вхождения» от элементы и значение` |
| range | `«Числа до» от н`, `«Числа от и до» от начало и конец` |

**Task: sum without duplicates.**

```flang
тотальная функция «Сумма без повторов»
  принимает элементы: список числа
  возвращает число
  пример «Повторы не считаются дважды»
    дано элементы равно [3, 1, 3, 2, 1]
    ожидается 6
  «Сумма» от («Уникальные» от элементы)
```

The answer is **6, not 10**: duplicates are dropped before the addition. What
checks it is the `пример` inside the function itself — an executable test that
travels with the declaration.

**Task: third largest.** Numbering from one is the one place that is easy to get
wrong here, so the example is named to make the mistake obvious:

```flang
тотальная функция «Третий по порядку»
  принимает элементы: список числа
  возвращает число
  обеспечивает «результат не меньше минимума» результат не меньше («Минимум» от элементы)
  пример «Нумерация с единицы: третий из [1, 4, 5, 9] — это 5»
    дано элементы равно [5, 4, 9, 1]
    ожидается 5
  «Элемент» от («Сортировать» от элементы) и 3
```

The `обеспечивает` line is a postcondition: a claim that must hold about the
result on any input. What the compiler does with it is in the proof-report
section below.

## Strings

| You need | Write |
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

```flang
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

The function name on the command line goes in plain double quotes: the shell does
not treat `«»` as quotes and would split the name on the space.

**Task: take a piece of a path.** A string is not a list: it has its own module.
`«Разбить по символу»` yields a **list of strings**, and from there the functions
of «Списки строк» apply, not those of «Списки»:

```flang
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

The third argument is the **fallback**: what to return when there is no such
position. You cannot leave it out, and that is the point.

## Sets

A set is a list of strings with no duplicates; there is no separate type, there
is a module that holds the invariant.

| You need | Write |
| --- | --- |
| from a list | `«Из списка» от элементы` — duplicates dropped, first-occurrence order kept |
| membership | `«Есть в множестве» от множество и искомое` |
| add, remove | `«Добавить в множество»`, `«Убрать из множества»` |
| union, intersection, difference | `«Объединение»`, `«Пересечение»`, `«Разность»` |
| subset | `«Подмножество» от меньшее и большее` |
| size | `«Размер множества» от множество` |

**Task: how many labels two sets share.**

```flang
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

## Numbers

| You need | Write |
| --- | --- |
| absolute value, sign | `«Абсолютное значение»`, `«Знак»` |
| min/max of two | `«Минимум двух»`, `«Максимум двух»` |
| clamp | `«Ограничить» от значение и низ и верх` |
| integer division | `«Целочисленное деление» от делимое и делитель` |
| parity, divisibility | `«Чётное»`, `«Делится на»` |
| power, factorial | `«Степень»`, `«Факториал»` |
| gcd, lcm | `«НОД»`, `«НОК»` — **plain, not total** |
| digits | `«Цифры»`, `«Сумма цифр»` — plain as well |

Four of the sixteen functions in «Числа» carry no `тотальная` marker — `«НОД»`,
`«НОК»`, `«Цифры»`, `«Сумма цифр»`. That is not an omission but an honest
signature: both Euclid and splitting a number into digits descend by the SIZE of
the number (`«Целочисленное деление» от число и 10`), not by its structure, and
descent by a part of the value cannot prove that.

**Task: how many pages for N records.** Rounding up is written with integer
division and a zero check — otherwise the function would not be total:

```flang
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

The `если размер не больше 0` branch is not there for tidiness: without it,
division by zero would yield infinity, and the function promises a number.

## Passing arguments: `--args`

Arguments travel in one key, and it takes a **JSON object**: the key is the
parameter name exactly as written in `принимает`, the value is the value.

| Parameter type | Write | Example |
| --- | --- | --- |
| `число`, `неотрицательное`, `целое` | a number | `21`, `-3`, `2.5` |
| `строка` | a string in double quotes | `"раз два три"` |
| `признак` | `true` or `false` | `true` |

**Lists and records do not go through `--args`, and that is a boundary, not a
typo.** The key takes a FLAT object of scalars — number, string, `true`, `false`,
`null`:

```bash
flang run docs/examples/operations.flang \
  --function "Сумма без повторов" --args '{"элементы": [3, 1, 3, 2, 1]}'
```

```
flang run: «--args» разобрать не удалось — ждался плоский объект скаляров, вроде '{"н":10}'
```

The refusal goes to the error stream, exit code 2. The language itself accepts
such values — they just cannot be passed through `--args` today.

A compound value goes in through the shell, written in the words of the language
rather than JSON, and read by the compiler itself:

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

## What the proof report says about this file

```bash
flang check docs/examples/operations.flang --proof
```

The summary; above it the report names every function and every claim
individually:

```
итог:
  функций 115: тотальных 111, обычных 4
  обещание несёт: композиция 95, структура 11, точный шаг 3, постоянный шаг 2, объявленная мера 0
  сторожей в рантайме: 2 места
  законов на сетке: 0 (значений в сетках 0); на веру: 0
  утверждений 238: доказано 101 (из них индукцией 7) (из них без теоремы 93), сетка 137, объявлено, не доказано 0 (шагов в термах 2)
```

The word «сетка» — "grid" — the report defines in its own header: **"counted on N
of the author's values, no violations found; this is NOT a proof"**. The claim was
checked on the inputs the author wrote into the examples, and on those only.

**Both postconditions written on this page landed on the grid, not on a proof.**
The report says so outright:

```
постусловие «результат не меньше минимума» функции «Третий по порядку» — сетка 1 значение (примеры функции): нарушений НЕ ИСКАЛИ — прогона примеров не было, посчитано только их число. Это не доказательство — теоремы при утверждении нет
постусловие «общих не больше, чем в первом наборе» функции «Общих меток» — сетка 1 значение (примеры функции): нарушений НЕ ИСКАЛИ — прогона примеров не было, посчитано только их число. Это не доказательство — теоремы при утверждении нет
```

All 101 proven claims came **from the library** imported by this file, not from
anything written here. Writing a postcondition is easy; getting a proof under it
is separate work, and the compiler does not pretend that work is done. What it
costs and when it succeeds is on [Why and how](proofs.html).

## Next

- [Glossary](../glossary.html) — {{словарь.понятий}} concepts, printed from the surface table
- [Library reference](stdlib.html) — every module with its function signatures
- [Writing packages](packages.html) — when operations stop being enough
- [Real-world case studies](case-studies.html) — the same operations on 82 tasks and a service
