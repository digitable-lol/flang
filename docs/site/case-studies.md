# A case taken apart: leetcode tasks, their solutions, and what is proved about them

`examples/leetcode/` — 82 files, 7 709 lines, 301 functions and 806 executable
examples (measured 29 August 2026). Not an example written for this page but code in the tree.

Below are five tasks: the statement, the whole solution, and what the compiler
answers about **exactly what** is proved for it. That last part is the
interesting one. Any language can show you a sort; not every language can show
you that its termination is proved, and name the measure that proves it.

The listings are the tree files as they are, so they are in flang, and flang is
written in Russian words. A key to the ones used here:

| flang | English |
| --- | --- |
| `модуль` | module |
| `тотальная функция` | total function |
| `принимает` / `возвращает` | takes / returns |
| `пример` / `дано` / `ожидается` | example / given / expected |
| `обеспечивает` | ensures (a postcondition) |
| `убывает` | decreases (a termination measure) |
| `разбор` / `случай` | match / case |
| `свёртка … начиная с … как … и … →` | fold … starting from … as … and … → |
| `если` / `то` / `иначе` | if / then / else |
| `пусть … равно` | let … be |

## Five ways to prove termination, and they are not equal

The mark `тотальная функция` — total function — is a promise that the function
ends on every input. The compiler checks it and refuses to build the file if it
could not prove it. It has five ways to do that:

| way | when it works | cost in the built program |
| --- | --- | --- |
| by composition | there is no recursion at all | none |
| by structure | the step goes down a part of the value: the tail of a list, a field of a variant | none |
| by exact step | descent over `нат` by exactly one | none |
| by constant step | a number falls by a constant amount and a condition holds it from below | one check per turn |
| by declared measure | the author wrote `убывает …` and the compiler recomputes the measure on every turn | one check per turn |

The first three are free: the proof goes entirely into the check, and not one
byte of it remains in the built program. The last two put a check next to the
recursion, and the report says so on a separate line — how many places in the
program the proof costs.

The report is printed by the `--proof` flag and it distinguishes words that are
easy to confuse: **доказано** (proved) — for all inputs; **сетка N** (grid of N)
— computed on N of the author's values and not a proof; **объявлено, не
доказано** (stated, not proved) — the claim is made and there is no proof under
it.

## Task 704. Binary search

**Statement.** Given a list of distinct numbers sorted ascending and a target,
return the index of the target (from zero) or −1 if it is not there. O(log n)
required.

**The whole solution** (`examples/leetcode/704-binary-search.flang`; the file's
opening comment is omitted, it is retold below):

```flang
модуль «Двоичный поиск»

тотальная функция «Поиск в диапазоне»
  принимает топливо: список числа, элементы: список числа, цель: число, низ: число, верх: число
  возвращает число
  пример «Нашли середину»
    дано топливо равно [1, 2, 3]
    дано элементы равно [1, 2, 3]
    дано цель равно 2
    дано низ равно 1
    дано верх равно 3
    ожидается 1
  разбор топливо
    случай пусто
      то -1
    случай голова и хвост
      если низ больше верх
        то -1
        иначе
          пусть сумма равно низ плюс верх
          пусть середина равно (сумма минус (сумма остаток от 2)) делить на 2
          пусть значение равно элемент середина в элементы
          если значение равен цель
            то середина минус 1
            иначе
              если значение меньше цель
                то «Поиск в диапазоне» от хвост и элементы и цель и (середина плюс 1) и верх
                иначе «Поиск в диапазоне» от хвост и элементы и цель и низ и (середина минус 1)

тотальная функция «Двоичный поиск»
  принимает элементы: список числа, цель: число
  возвращает число
  пример «Пример 1 из условия»
    дано элементы равно [-1, 0, 3, 5, 9, 12]
    дано цель равно 9
    ожидается 4
  пример «Пример 2 из условия»
    дано элементы равно [-1, 0, 3, 5, 9, 12]
    дано цель равно 2
    ожидается -1
  пример «Один элемент»
    дано элементы равно [5]
    дано цель равно 5
    ожидается 0
  «Поиск в диапазоне» от элементы и элементы и цель и 1 и (длина элементы)
```

**What is proved:**

```
flang check examples/leetcode/704-binary-search.flang --proof
```

```
чем несётся обещание «тотальная»:
  «Поиск в диапазоне»  доказано структурой: аргумент 1 («топливо») на каждом витке становится частью себя; цепочка частей конечного дерева обрывается сама, сторожа нет
  «Двоичный поиск»     доказано композицией: рекурсии нет, обещание сложено из обещаний тех, кого зовёт

итог:
  функций 2: тотальных 2, обычных 0
  обещание несёт: композиция 1, структура 1, точный шаг 0, постоянный шаг 0, объявленная мера 0
  сторожей в рантайме: 0 мест
```

The limit of the analysis is visible here. Binary search narrows a pair of
numbers, low and high, and descent over numbers is not something the compiler
accepts: "mid plus 1" is the result of arithmetic, not a part of a value. The
direct spelling is refused with `FLANG_NOT_TOTAL`.

The trick in the solution is honest and worth remembering: alongside the real
arguments rides **fuel** (`топливо`) — a list whose tail is taken on every turn.
The tail of a list is a part of the value, so the loop is provably finite; and
since the input list itself serves as fuel, there are certainly enough steps —
log₂n are needed and n are available. Zero checks in the built program: a proof
by structure is free.

## Task 148. Sort list

**Statement.** Sort a list in ascending order in O(n log n).

**The whole solution** (`examples/leetcode/148-sort-list.flang`):

```flang
модуль «Сортировка слиянием»

тотальная функция «Взять первые»
  принимает элементы: список числа, сколько: число
  возвращает список числа
  пример «Первые два»
    дано элементы равно [3, 1, 2]
    дано сколько равно 2
    ожидается [3, 1]
  пример «Ноль элементов»
    дано элементы равно [3, 1]
    дано сколько равно 0
    ожидается пустой список
  разбор элементы
    случай пусто
      то пустой список
    случай голова и хвост
      если сколько не больше 0
        то пустой список
        иначе свёртка («Взять первые» от хвост и (сколько минус 1)) начиная с [голова] как акк и эл → добавить эл к акк

тотальная функция «Отбросить первые»
  принимает элементы: список числа, сколько: число
  возвращает список числа
  пример «Без первых двух»
    дано элементы равно [3, 1, 2]
    дано сколько равно 2
    ожидается [2]
  пример «Отбросить больше длины»
    дано элементы равно [3]
    дано сколько равно 5
    ожидается пустой список
  разбор элементы
    случай пусто
      то пустой список
    случай голова и хвост
      если сколько не больше 0
        то элементы
        иначе «Отбросить первые» от хвост и (сколько минус 1)

тотальная функция «Слить упорядоченные»
  принимает первый: список числа, второй: список числа, готово: список числа
  возвращает список числа
  убывает (длина первый) плюс (длина второй)
  пример «Слияние через один»
    дано первый равно [1, 3]
    дано второй равно [2, 4]
    дано готово равно пустой список
    ожидается [1, 2, 3, 4]
  пример «Второй пуст»
    дано первый равно [1]
    дано второй равно пустой список
    дано готово равно пустой список
    ожидается [1]
  разбор первый
    случай пусто
      то свёртка второй начиная с готово как акк и эл → добавить эл к акк
    случай голова пг и хвост пх
      то разбор второй
        случай пусто
          то свёртка первый начиная с готово как акк и эл → добавить эл к акк
        случай голова вг и хвост вх
          то если пг не больше вг
            то «Слить упорядоченные» от пх и второй и (добавить пг к готово)
            иначе «Слить упорядоченные» от первый и вх и (добавить вг к готово)

тотальная функция «Сортировка слиянием»
  принимает элементы: список числа
  возвращает список числа
  убывает длина элементы
  пример «Пример 1 из условия»
    дано элементы равно [4, 2, 1, 3]
    ожидается [1, 2, 3, 4]
  пример «Пример 2 из условия»
    дано элементы равно [-1, 5, 3, 4, 0]
    ожидается [-1, 0, 3, 4, 5]
  пример «Пример 3 из условия»
    дано элементы равно пустой список
    ожидается пустой список
  пример «Один элемент»
    дано элементы равно [7]
    ожидается [7]
  пример «Повторы сохраняются»
    дано элементы равно [2, 1, 2, 1]
    ожидается [1, 1, 2, 2]
  пример «Уже отсортирован»
    дано элементы равно [1, 2, 3, 4, 5, 6, 7, 8]
    ожидается [1, 2, 3, 4, 5, 6, 7, 8]
  если (длина элементы) не больше 1
    то элементы
    иначе
      пусть половина равно ((длина элементы) минус ((длина элементы) остаток от 2)) делить на 2
      пусть слева равно «Сортировка слиянием» от («Взять первые» от элементы и половина)
      пусть справа равно «Сортировка слиянием» от («Отбросить первые» от элементы и половина)
      «Слить упорядоченные» от слева и справа и пустой список
```

**What is proved:**

```
flang check examples/leetcode/148-sort-list.flang --proof
```

```
чем несётся обещание «тотальная»:
  «Взять первые»         доказано структурой: аргумент 1 («элементы») на каждом витке становится частью себя; цепочка частей конечного дерева обрывается сама, сторожа нет
  «Отбросить первые»     доказано структурой: аргумент 1 («элементы») на каждом витке становится частью себя; цепочка частей конечного дерева обрывается сама, сторожа нет
  «Слить упорядоченные»  доказано объявленной мерой: убывает длина «первый» плюс длина «второй»; мера объявлена автором, сторож считает её на каждом витке — 2 места
  «Сортировка слиянием»  доказано объявленной мерой: убывает длина «элементы»; мера объявлена автором, сторож считает её на каждом витке — 2 места

итог:
  функций 4: тотальных 4, обычных 0
  обещание несёт: композиция 0, структура 2, точный шаг 0, постоянный шаг 0, объявленная мера 2
```

This is what showing a sort was worth. Half of a list is **not** a structural
part of it — by construction a part of a value is a tail, a head or a field, not
"the first n elements". So a proof by structure does not go through for the sort
itself, and the measure is named outright:

- `убывает длина элементы` — for the sort: both halves are strictly shorter than
  the whole, because the "at most one element" case is handled before the split;
- `убывает (длина первый) плюс (длина второй)` — for the merge: exactly one head
  is removed per turn, and neither of the two arguments descends structurally in
  all branches at once.

The price is named right there, for each of the two functions: two places apiece
in the built program where the measure is recomputed at run time. The two helpers
— take-first and drop-first — are proved by structure and cost nothing.

## Task 42. Trapping rain water

**Statement.** Bar heights form a terrain. How many units of water are trapped
in the pits after rain: above each bar stands as much water as the smaller of
the two highest bars to its left and right, minus the bar itself.

**The whole solution** (`examples/leetcode/042-trapping-rain-water.flang`):

```flang
модуль «Дождевая вода»

тотальная функция «Большее из двух»
  принимает первый: число, второй: число
  возвращает число
  пример «Второй больше»
    дано первый равно 2
    дано второй равно 5
    ожидается 5
  пример «Первый больше»
    дано первый равно 5
    дано второй равно 2
    ожидается 5
  если первый не меньше второй то первый иначе второй

тотальная функция «Вода в диапазоне»
  принимает элементы: список числа, лево: число, право: число, порогслева: число, порогсправа: число, итог: число
  возвращает число
  убывает право минус лево плюс 1
  пример «Простая яма»
    дано элементы равно [3, 0, 3]
    дано лево равно 1
    дано право равно 3
    дано порогслева равно 0
    дано порогсправа равно 0
    дано итог равно 0
    ожидается 3
  пример «Границы уже сошлись»
    дано элементы равно [3, 0, 3]
    дано лево равно 2
    дано право равно 2
    дано порогслева равно 3
    дано порогсправа равно 3
    дано итог равно 7
    ожидается 7
  если лево не меньше право
    то итог
    иначе
      пусть стенкаслева равно элемент лево в элементы
      пусть стенкасправа равно элемент право в элементы
      если стенкаслева меньше стенкасправа
        то
          пусть порог равно «Большее из двух» от порогслева и стенкаслева
          «Вода в диапазоне» от элементы и (лево плюс 1) и право и порог и порогсправа и (итог плюс (порог минус стенкаслева))
        иначе
          пусть порог равно «Большее из двух» от порогсправа и стенкасправа
          «Вода в диапазоне» от элементы и лево и (право минус 1) и порогслева и порог и (итог плюс (порог минус стенкасправа))

тотальная функция «Дождевая вода»
  принимает элементы: список числа
  возвращает число
  пример «Пример 1 из условия»
    дано элементы равно [0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]
    ожидается 6
  пример «Пример 2 из условия»
    дано элементы равно [4, 2, 0, 3, 2, 5]
    ожидается 9
  пример «Пустой рельеф»
    дано элементы равно пустой список
    ожидается 0
  пример «Один столбик»
    дано элементы равно [5]
    ожидается 0
  пример «Ровная площадка»
    дано элементы равно [2, 2, 2]
    ожидается 0
  пример «Одна яма между равными стенками»
    дано элементы равно [3, 0, 3]
    ожидается 3
  пример «Склон воду не держит»
    дано элементы равно [1, 2, 3, 4]
    ожидается 0
  «Вода в диапазоне» от элементы и 1 и (длина элементы) и 0 и 0 и 0
```

**What is proved:**

```
flang check examples/leetcode/042-trapping-rain-water.flang --proof
```

```
чем несётся обещание «тотальная»:
  «Большее из двух»   доказано композицией: рекурсии нет, обещание сложено из обещаний тех, кого зовёт
  «Вода в диапазоне»  доказано объявленной мерой: убывает «право» минус «лево» плюс 1; мера объявлена автором, сторож считает её на каждом витке — 2 места
  «Дождевая вода»     доказано композицией: рекурсии нет, обещание сложено из обещаний тех, кого зовёт

итог:
  функций 3: тотальных 3, обычных 0
  обещание несёт: композиция 2, структура 0, точный шаг 0, постоянный шаг 0, объявленная мера 1
```

Two pointers moving toward each other: a technique with no descending list at
all — what descends is the distance between the boundaries. That is what the
measure says: `убывает право минус лево плюс 1`. Every turn moves exactly one
boundary, and the compiler checks that itself rather than trusting a comment.

The five quantities that would be variables in a language with loops ride as
arguments here. That is the price of having no loop, and it is visible right in
the signature.

## Task 13. Roman numerals to integer

**Statement.** Convert a Roman numeral to a number.

The only task in the catalogue that has not just proved termination but a
**claim about the result** — two `обеспечивает` postconditions.

**The whole solution** (`examples/leetcode/013-roman-to-integer.flang`):

```flang
модуль «Римские числа»

объект «Разбор римского»
  сумма является числом
  предыдущее является числом

тотальная функция «Приписать строку в начало»
  принимает первая: строка, элементы: список строки
  возвращает список строки
  пример «В непустой»
    дано первая равно "I"
    дано элементы равно ["V"]
    ожидается ["I", "V"]
  свёртка элементы начиная с [первая] как акк и эл → добавить эл к акк

тотальная функция «Значение цифры»
  принимает буква: строка
  возвращает число
  обеспечивает «значение цифры неотрицательно» результат не меньше 0
  обеспечивает «значение цифры не больше тысячи» результат не больше 1000
  пример «Единица»
    дано буква равно "I"
    ожидается 1
  пример «Тысяча»
    дано буква равно "M"
    ожидается 1000
  пример «Не римская цифра»
    дано буква равно "щ"
    ожидается 0
  если буква равен "I"
    то 1
    иначе
      если буква равен "V"
        то 5
        иначе
          если буква равен "X"
            то 10
            иначе
              если буква равен "L"
                то 50
                иначе
                  если буква равен "C"
                    то 100
                    иначе
                      если буква равен "D"
                        то 500
                        иначе
                          если буква равен "M" то 1000 иначе 0

тотальная функция «Символы»
  принимает текст: строка
  возвращает список строки
  пример «Две цифры»
    дано текст равно "IV"
    ожидается ["I", "V"]
  пример «Пустая запись»
    дано текст равно ""
    ожидается пустой список
  разложить текст на символы

тотальная функция «Римское в число»
  принимает текст: строка
  возвращает число
  пример «Пример 1 из условия»
    дано текст равно "III"
    ожидается 3
  пример «Пример 2 из условия»
    дано текст равно "LVIII"
    ожидается 58
  пример «Пример 3 из условия»
    дано текст равно "MCMXCIV"
    ожидается 1994
  пример «Вычитание»
    дано текст равно "IV"
    ожидается 4
  пусть начальное равно запись «Разбор римского» с сумма равным 0 и предыдущее равным 0
  пусть итог равно свёртка («Символы» от текст) начиная с начальное как акк и буква
    пусть значение равно «Значение цифры» от буква
    пусть поправка равно если акк.предыдущее меньше значение то (2 умножить на акк.предыдущее) иначе 0
    запись «Разбор римского» с сумма равным (акк.сумма плюс значение минус поправка) и предыдущее равным значение
  итог.сумма
```

**What is proved:**

```
flang check examples/leetcode/013-roman-to-integer.flang --proof
```

```
чем несётся обещание «тотальная»:
  «Приписать строку в начало»  доказано композицией: рекурсии нет, обещание сложено из обещаний тех, кого зовёт
  «Значение цифры»             доказано композицией: рекурсии нет, обещание сложено из обещаний тех, кого зовёт
  «Символы»                    доказано композицией: рекурсии нет, обещание сложено из обещаний тех, кого зовёт
  «Римское в число»            доказано композицией: рекурсии нет, обещание сложено из обещаний тех, кого зовёт

что высказано и чем это несётся:
  постусловие «значение цифры неотрицательно» функции «Значение цифры» — доказано сведением цели с телом функции: правило «неотрицательность по построению», объявленные типы аргументов не понадобились — утверждение обо ВСЕХ входах, а не о написанных; теоремы при нём нет и не нужно
  постусловие «значение цифры не больше тысячи» функции «Значение цифры» — доказано сведением цели с телом функции: правило «ограниченность точным потолком по построению», объявленные типы аргументов не понадобились — утверждение обо ВСЕХ входах, а не о написанных; теоремы при нём нет и не нужно

итог:
  функций 4: тотальных 4, обычных 0
  обещание несёт: композиция 4, структура 0, точный шаг 0, постоянный шаг 0, объявленная мера 0
```

The difference between "the examples passed" and "proved" is literally visible
here. The digit-value function has three examples; it has two postconditions,
and **neither is carried by the examples**. The first is closed by the rule
"non-negative by construction": eight branches of a choice end in eight
literals, and all eight are at least zero. The second by the rule "bounded by an
exact ceiling by construction": M is the highest sign in the table, and there is
nothing above a thousand in it.

Note that it says `не меньше 0` — at least zero — and not `не меньше 1`. A sign
outside the table yields zero, so "at least one" would be a lie, and the same
run would catch it, on the example named "not a Roman digit".

## Task 202. Happy number

**Statement.** Replace the number by the sum of the squares of its digits and
repeat. The number is happy if 1 eventually comes up; otherwise the sequence
falls into a cycle.

This task is here because the proof **does not go through** on it, and the file
says so outright.

**The whole solution** (`examples/leetcode/202-happy-number.flang`):

```flang
модуль «Счастливое число»

тотальная функция «Сумма квадратов цифр»
  принимает н: число
  возвращает число
  убывает н
  пример «Двузначное»
    дано н равно 19
    ожидается 82
  пример «Единица»
    дано н равно 1
    ожидается 1
  пример «Ноль»
    дано н равно 0
    ожидается 0
  если н не больше 0
    то 0
    иначе
      пусть цифра равно н остаток от 10
      пусть выше равно (н минус цифра) делить на 10
      (цифра умножить на цифра) плюс («Сумма квадратов цифр» от выше)

тотальная функция «Есть число»
  принимает элементы: список числа, значение: число
  возвращает признак
  пример «Есть»
    дано элементы равно [1, 2]
    дано значение равно 2
    ожидается да
  пример «Нет»
    дано элементы равно [1, 2]
    дано значение равно 3
    ожидается нет
  свёртка элементы начиная с нет как акк и эл → если акк то да иначе эл равен значение

функция «Шаг счастья»
  принимает н: число, виденные: список числа
  возвращает признак
  пример «Единица счастлива сразу»
    дано н равно 1
    дано виденные равно пустой список
    ожидается да
  пример «Повтор — несчастливое»
    дано н равно 4
    дано виденные равно [4]
    ожидается нет
  если н равен 1
    то да
    иначе
      если «Есть число» от виденные и н
        то нет
        иначе «Шаг счастья» от («Сумма квадратов цифр» от н) и (добавить н к виденные)

функция «Счастливое»
  принимает н: число
  возвращает признак
  пример «Пример 1 из условия»
    дано н равно 19
    ожидается да
  пример «Пример 2 из условия»
    дано н равно 2
    ожидается нет
  пример «Единица»
    дано н равно 1
    ожидается да
  пример «Семь счастливо»
    дано н равно 7
    ожидается да
  пример «Четвёрка — начало известного цикла»
    дано н равно 4
    ожидается нет
  пример «Сто счастливо»
    дано н равно 100
    ожидается да
  «Шаг счастья» от н и пустой список
```

**What is proved:**

```
flang check examples/leetcode/202-happy-number.flang --proof
```

```
чем несётся обещание «тотальная»:
  «Сумма квадратов цифр»  доказано объявленной мерой: убывает «н»; мера объявлена автором, сторож считает её на каждом витке — 1 место
  «Есть число»            доказано композицией: рекурсии нет, обещание сложено из обещаний тех, кого зовёт
  «Шаг счастья»           обещания нет: функция обычная, о завершении не сказано ничего
  «Счастливое»            обещания нет: функция обычная, о завершении не сказано ничего

итог:
  функций 4: тотальных 2, обычных 2
  обещание несёт: композиция 1, структура 0, точный шаг 0, постоянный шаг 0, объявленная мера 1
```

`«Шаг счастья»` and `«Счастливое»` are the only two functions in the whole
catalogue written with the word `функция` rather than `тотальная функция`. They
do terminate: the sequence of digit-square sums falls into a cycle, and the
cycle is caught by a list of numbers already seen. But that argument is a
theorem about numbers, not a descent of anything in the text of the program:
neither the list, nor a difference, nor the number itself goes down. There is no
measure to write, and the file honestly says `функция`.

That is what a refusal that is **not hidden** looks like. The compiler neither
stays silent nor takes it on trust: with nothing to prove it by, there simply is
no promise, and the report says "nothing has been said about termination".

## The whole catalogue in numbers

| | |
| --- | --- |
| files | 82 |
| lines | 7 709 |
| functions | 301 |
| of those total | 299 |
| ordinary | 2 |
| executable examples | 806 |
| declared measures (`убывает`) | 61 |
| postconditions (`обеспечивает`) | 85, in 37 files |

299 functions out of 301 are declared with the word `тотальная` — that is, they
carry a promise of termination, and the compiler is obliged to prove that
promise: failing to, it refuses to build the file. This is not "the examples
passed". For tasks like "search in a rotated sorted array" or "trapping rain
water" the infinite loop is closed before the program runs.

Claims about the **result** number 85 across all 82 tasks, and they sit in 37
files. This page used to say "two, both in task 13": that was the count on the
day it was measured, and the set has been added to since. The gap itself has not
closed: 85 postconditions over 301 functions is fewer than half the files, and
while termination is proved for 299 functions, correctness of the result is
proved for a minority. The rest of the correctness is carried by 806 examples,
and an example is a claim about one input.

The gap between "proved" and "correct" is the specification. You can write one:
`обеспечивает` is accepted on any function, and the compiler will try to prove
it. How that is done — [Requirements that are proved](fspec.html).

## Next

- [What is proved and what is not](what-is-proved.html) — where the line runs.
- [Why and how](proofs.html) — how the proof kernel works.
- [When a proof is refused](proof-refused.html) — why the check refuses and what to do.
