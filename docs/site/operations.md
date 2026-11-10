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
docs/examples/operations.flang: примеров 274, прошло 274, не прошло 0
```

Six examples are written on this page; the other 268 come with the library:
the examples of an imported module run together with yours.

## Importing a module

`использует` is the import. A module is attached by name, with no path:

```flang
модуль «Operations»
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
FLANG_IMPORT_NAME, строка 1, столбец 1: модуль в /путь/sets.flang называется «String sets», а импортируется как «Множества»
```

A module comes in whole. If you want one function, name it with `только`:
`использует «Lists» только «Двоичный поиск»`.

## Where operations come from

The language has few words: `плюс`, `минус`, `умножить на`, `делить на`,
`остаток от`, `равно`, `не меньше`, `если … то … иначе`, `свёртка`, `цикл`,
`разбор … случай`. Everything else is a **library function**, written in flang
itself and living in `flang/stdlib/`. Functions are counted by `функция «…»`
headers:

| Module | File | Functions |
| --- | --- | --- |
| «Lists» | `flang/stdlib/lists.flang` | 38 |
| «Strings» | `flang/stdlib/strings.flang` | 39 |
| «String lists» | `flang/stdlib/strlists.flang` | 13 |
| «String sets» | `flang/stdlib/sets.flang` | 16 |
| «Numbers» | `flang/stdlib/numbers.flang` | 16 |
| «Higher order» | `flang/stdlib/higher-order.flang` | 35 |
| «Dictionary» | `flang/stdlib/dictionary.flang` | 14 |
| «Hash map» | `flang/stdlib/hashmap.flang` | 25 |

## Lists

| You need | Write |
| --- | --- |
| length | `«Длина» от элементы` |
| prepend | `«Приписать в начало» от новое и элементы` |
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

The answer is 6, not 10: duplicates are dropped before the addition. The
`пример` inside the function checks it.

**Task: third largest.** Numbering starts at one:

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

The `обеспечивает` line is a postcondition: a claim about the result that holds
on any input. What the compiler does with it is in
[the last section](#what-the-proof-report-says-about-this-file).

## Strings

| You need | Write |
| --- | --- |
| concatenate | `«Соединить строки» от части и разделитель` |
| split on a character | `«Разбить по символу» от текст и " "` → list of strings |
| replace | `«Заменить» от текст и что и чем` |
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
flang run docs/examples/operations.flang --trust \
  --function "Слов в строке" --args '{"текст": "раз два три"}'
```

```
на веру: доказанность не считалась — запуск по ключу --trust
3
```

`--trust` is needed because the file has postconditions without a proof:
without the flag `flang run` does not start such a program and exits with code
3. The function name on the command line goes in plain double quotes: the shell
does not treat `«»` as quotes and would split the name on the space.

**Task: take a piece of a path.** A string is not a list: it has its own module.
`«Разбить по символу»` yields a **list of strings**, and from there the functions
of «String lists» apply, not those of «Lists»:

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
flang run docs/examples/operations.flang --trust \
  --function "Код из адреса" --args '{"адрес": "/с/абв"}'
```

```
на веру: доказанность не считалась — запуск по ключу --trust
"абв"
```

The third argument is the fallback: what to return when there is no such
position.

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
| clamp | `«Ограничить» от число и снизу и сверху` |
| integer division | `«Целочисленное деление» от делимое и делитель` |
| parity, divisibility | `«Чётное»`, `«Делится на»` |
| power, factorial | `«Степень»`, `«Факториал»` |
| gcd, lcm | `«НОД»`, `«НОК»` — **plain, not total** |
| digits | `«Цифры»`, `«Сумма цифр»` — plain as well |

Four of the module's sixteen functions are declared without `тотальная`:
`«НОД»`, `«НОК»`, `«Цифры»`, `«Сумма цифр»`. They descend by the size of the
number, not by its structure, and the compiler does not prove such termination.

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
flang run docs/examples/operations.flang --trust \
  --function "Страниц под записи" --args '{"записей": 23, "размер": 10}'
```

```
на веру: доказанность не считалась — запуск по ключу --trust
3
```

Without the `если размер не больше 0` branch, division by zero would yield
infinity, and the function promises a number.

## Passing arguments: `--args`

`--args` takes a JSON object: the key is the parameter name exactly as written
in `принимает`.

| Parameter type | Write | Example |
| --- | --- | --- |
| `число`, `неотрицательное`, `целое` | a number | `21`, `-3`, `2.5` |
| `строка` | a string in double quotes | `"раз два три"` |
| `признак` | `true` or `false` | `true` |
| `список …` | a JSON array | `[3, 1, 2]` |
| a record (`объект`) | a JSON object, keys are the field names | `{"икс": 1, "имя": "А"}` |
| a sum type (`тип`) | `{"variant": "Имя", "fields": {…}}` | `{"variant": "Круг", "fields": {"радиус": 2}}` |

```bash
flang run docs/examples/operations.flang --trust \
  --function "Сумма без повторов" --args '{"элементы": [3, 1, 3, 2, 1]}'
```

```
на веру: доказанность не считалась — запуск по ключу --trust
6
```

Every value is checked against the declared type before the call, down to each
list element and record field. A value of the wrong type is refused with
`FLANG_TYPE` and exit code 1, and nothing is computed:

```bash
flang run docs/examples/operations.flang --trust \
  --function "Сумма без повторов" --args '{"элементы": [3, "один"]}'
```

```
на веру: доказанность не считалась — запуск по ключу --trust
FLANG_TYPE: вызов функции «Сумма без повторов»: аргумент «элементы»[1] не соответствует типу число
```

JSON that does not parse is a bad invocation: exit code 2.

## What the proof report says about this file

```bash
flang check docs/examples/operations.flang --proof
```

The report names every claim of the file and ends with a summary, exit code 3:

```
  постусловие «результат не меньше минимума» функции «Третий по порядку» — сетка 1 значение (примеры функции): нарушений на них нет: …
  постусловие «общих не больше, чем в первом наборе» функции «Общих меток» — сетка 1 значение (примеры функции): нарушений на них нет: …
…
итог:
  функций 6: тотальных 6, обычных 0
  обещание несёт: композиция 6, структура 0, точный шаг 0, постоянный шаг 0, объявленная мера 0
  сторожей в рантайме: 0 мест
  законов на сетке: 0 (значений в сетках 0); на веру: 0
  утверждений 2: доказано 0, сетка 2, объявлено, не доказано 0
…
docs/examples/operations.flang: НЕ ДОКАЗАНО — ОПОРА НЕ СУДИЛАСЬ — утверждений 2: доказано 0, условно 0, сетка 2, объявлено, не доказано 0, отвергнуто 0, нарушено 0; законов на сетке 0, на веру 0 — код возврата 3
```

«Сетка» ("grid") means the postcondition was computed on the inputs from the
examples and no violation was found, but that is not a proof. Both
postconditions on this page are checked this way. The claims of the imported
library are not in the summary. How to get a proof is on
[Why and how](proofs.html).

## Next

- [Glossary](../glossary.html) — {{словарь.понятий}} concepts, printed from the surface table
- [Library reference](stdlib.html) — every module with its function signatures
- [Writing packages](packages.html) — when operations stop being enough
- [Real-world case studies](case-studies.html) — the same operations on 82 tasks and a service
