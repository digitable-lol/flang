# Leetcode tasks: the solution and what is proved about it

`docs/examples/leetcode/` holds 82 solutions to leetcode tasks. Three are taken
apart here: each shows one way to prove that a recursion ends — and one shows
what a program without such a proof looks like.

| task | what it teaches |
| --- | --- |
| 704. Binary search | recursion over numbers is not provable; a "fuel" list helps |
| 42. Trapping rain water | the measure `убывает …` and postconditions `обеспечивает …` |
| 202. Happy number | a function without the word `тотальная`: termination is not promised |

The listings are the tree files as they are, and flang is written in Russian
words. A key to the ones used here:

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

## How to run

```
flang test docs/examples/leetcode/704-binary-search.flang
flang run docs/examples/leetcode/704-binary-search.flang --function '«Двоичный поиск»' --args '{"элементы":[-1,0,3,5,9,12],"цель":9}'
flang check docs/examples/leetcode/704-binary-search.flang --proof
```

`test` runs the examples written inside the functions. `run` calls one function
with arguments given as JSON. `check --proof` prints the proof report:

```
docs/examples/leetcode/704-binary-search.flang: примеров 4, прошло 4, не прошло 0
```

```
доказано: утверждений 0
4
```

The first line `run` prints is how many claims about the program are proved
(`доказано: утверждений 0` — "proved: 0 claims"); this file has no claims, only
termination promises. The second line is the answer.

## How to read the report

The word `тотальная` (total) before a function is a promise that it ends on
every input. The compiler has to prove it; if it cannot, the file fails the
check. There are five ways:

| way | when it works | check while the program runs |
| --- | --- | --- |
| by composition (`композицией`) | there is no recursion | none |
| by structure (`структурой`) | the recursive call gets a part of the value: the tail of a list, a field of a variant | none |
| by exact step (`точным шагом`) | an argument of type `неотрицательное` falls by exactly one | none |
| by constant step (`постоянным шагом`) | a number falls by a constant amount and a condition holds it from below | on every turn |
| by declared measure (`объявленной мерой`) | the author wrote `убывает …` | on every turn |

About `обеспечивает` claims the report uses one of three words: **доказано**
(proved) — true on all inputs; **сетка N** (grid of N) — computed on N of the
author's examples, which is not a proof; **объявлено, не доказано** (stated, not
proved) — there is no proof.

## Task 704. Binary search

Given a list of distinct numbers in ascending order and a target, return the
index of the target, counting from zero, or −1.

The direct spelling is a recursion over the pair of numbers `низ` (low) and
`верх` (high):

```flang refused
модуль «Прямой поиск»

тотальная функция «Поиск в диапазоне»
  принимает элементы: список числа, цель: число, низ: число, верх: число
  возвращает число
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
            то «Поиск в диапазоне» от элементы и цель и (середина плюс 1) и верх
            иначе «Поиск в диапазоне» от элементы и цель и низ и (середина минус 1)
```

```
FLANG_NOT_TOTAL в файле naive.flang, строка 16, столбец 16: тотальная функция «Поиск в диапазоне»: рекурсивный вызов «Поиск в диапазоне» не убывает — аргумент 1 («элементы») — это сам параметр «элементы», а не его часть; аргумент 2 («цель») — это сам параметр «цель», а не его часть; аргумент 3 («середина» add 1) не выведен ни из одного параметра; аргумент 4 («верх») — это сам параметр «верх», а не его часть. Передавайте часть аргумента: хвост списка из образца «голова и хвост», поле варианта из образца, поле записи или элемент коллекции
```

The exit code is 1. `середина плюс 1` (mid plus 1) is the result of arithmetic,
not a part of a value, so this recursion is not provable by structure.

The solution in the catalogue adds a first argument, `топливо` (fuel). It is a
list, and every turn keeps only its tail:

```flang
модуль «Binary search»

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

```
flang check docs/examples/leetcode/704-binary-search.flang --proof
```

```
чем несётся обещание «тотальная»:
  «Поиск в диапазоне»  доказано структурой: аргумент 1 («топливо») на каждом витке становится частью себя; цепочка частей конечного дерева обрывается сама, сторожа нет
  «Двоичный поиск»     доказано композицией: рекурсии нет, обещание сложено из обещаний тех, кого зовёт
…
итог:
  функций 2: тотальных 2, обычных 0
  обещание несёт: композиция 1, структура 1, точный шаг 0, постоянный шаг 0, объявленная мера 0
  сторожей в рантайме: 0 мест
```

The input list itself serves as fuel. No more than log₂ n turns are needed and
the list has n elements, so the search never reaches the branch `случай пусто`
(empty case) before it has an answer. The compiler does not prove that: it
proves only that the function ends.

## Task 42. Trapping rain water

Bar heights form a relief. How much water stays in the pits after rain?

The solution is two pointers moving toward each other. No list shrinks here:
what shrinks is the distance between the pointers. It is written as the measure
`убывает право минус лево плюс 1` (decreases: right minus left plus 1):

```flang
модуль «Trapping rain water»

тотальная функция «Большее из двух»
  принимает первый: число, второй: число
  возвращает число
  обеспечивает «большее — первое, когда первое не меньше второго» если первый не меньше второй то (результат равен первый) иначе да
  обеспечивает «иначе большее — второе» если не (первый не меньше второй) то (результат равен второй) иначе да
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

```
flang check docs/examples/leetcode/042-trapping-rain-water.flang --proof
```

```
чем несётся обещание «тотальная»:
  «Большее из двух»   доказано композицией: рекурсии нет, обещание сложено из обещаний тех, кого зовёт
  «Вода в диапазоне»  доказано объявленной мерой: убывает «право» минус «лево» плюс 1; спуск ядром не выведен — на веру: мера объявлена автором, сторож считает её при работе на каждом витке — 2 места
  «Дождевая вода»     доказано композицией: рекурсии нет, обещание сложено из обещаний тех, кого зовёт
…
что высказано и чем это несётся:
  постусловие «большее — первое, когда первое не меньше второго» функции «Большее из двух» — доказано сведением цели с телом функции: правило «разбор цели по условию», объявленные типы аргументов не понадобились — утверждение обо ВСЕХ входах, а не о написанных; теоремы при нём нет и не нужно
  постусловие «иначе большее — второе» функции «Большее из двух» — доказано сведением цели с телом функции: правило «разбор случаев по внутреннему условию цели», объявленные типы аргументов не понадобились — утверждение обо ВСЕХ входах, а не о написанных; теоремы при нём нет и не нужно
…
итог:
  функций 3: тотальных 3, обычных 0
  обещание несёт: композиция 2, структура 0, точный шаг 0, постоянный шаг 0, объявленная мера 1
  сторожей в рантайме: 2 места
  законов на сетке: 0 (значений в сетках 0); на веру: 0
  утверждений 2: доказано 2 (из них без теоремы 2), сетка 0, объявлено, не доказано 0
```

What this shows:

- **The measure is taken on trust.** The report says so itself: `спуск ядром не
  выведен — на веру` ("the descent is not derived by the kernel — on trust").
  That the measure falls is checked while the program runs, in two places — one
  per recursive call. If the measure fails to fall on some turn, the program
  stops with a refusal instead of looping.
- **Two postconditions are proved.** Both are about `«Большее из двух»` (the
  larger of two), and both are derived from the function body by splitting on
  its condition. The examples took no part in it.
- **Nothing but termination is proved about the main function.** `«Дождевая
  вода»` has no `обеспечивает` at all: that the answer really is the volume of
  water is checked by seven examples, that is, on seven inputs.

### The same with a loop

The five arguments of the recursive function need not be written by hand. The
`цикл` (loop) form is shorthand: the compiler expands it into a function with a
declared measure.

```flang
модуль «Вода циклом»

тотальная функция «Большее из двух» принимает первый: число, второй: число возвращает число
  если первый не меньше второй то первый иначе второй

тотальная функция «Дождевая вода» принимает элементы: список числа возвращает число
  пример «Пример 1 из условия»
    дано элементы равно [0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]
    ожидается 6
  пример «Пример 2 из условия»
    дано элементы равно [4, 2, 0, 3, 2, 5]
    ожидается 9
  пример «Пустой рельеф»
    дано элементы равно пустой список
    ожидается 0
  цикл «Сужение»
    пока лево меньше право
    убывает право минус лево плюс 1
    храним лево: число равным 1, право: число равным длина элементы, уровень: число равным 0, вода: число равным 0
    в конце вода
    пусть слева равно элемент лево в элементы
    пусть справа равно элемент право в элементы
    пусть низшая равно если слева меньше справа то слева иначе справа
    пусть выше равно «Большее из двух» от уровень и низшая
    если слева меньше справа
      то дальше: лево станет лево плюс 1, уровень станет выше, вода станет вода плюс (выше минус низшая)
      иначе дальше: право станет право минус 1, уровень станет выше, вода станет вода плюс (выше минус низшая)
```

The `check --proof` report names the expanded function after the loop, and its
verdict is the same:

```
  «Сужение»          доказано объявленной мерой: убывает «право» минус «лево» плюс 1; спуск ядром не выведен — на веру: мера объявлена автором, сторож считает её при работе на каждом витке — 2 места
```

## Task 202. Happy number

A number is replaced by the sum of the squares of its digits, again and again.
The number is happy if 1 comes out; otherwise the sequence loops.

```flang
модуль «Happy number»

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
  обеспечивает «единица — счастливое число» если н равен 1 то (результат равен да) иначе да
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

```
flang check docs/examples/leetcode/202-happy-number.flang --proof
```

```
чем несётся обещание «тотальная»:
  «Сумма квадратов цифр»  доказано объявленной мерой: убывает «н»; спуск ядром не выведен — на веру: мера объявлена автором, сторож считает её при работе на каждом витке — 1 место
  «Есть число»            доказано композицией: рекурсии нет, обещание сложено из обещаний тех, кого зовёт
  «Шаг счастья»           обещания нет: функция обычная, о завершении не сказано ничего
  «Счастливое»            обещания нет: функция обычная, о завершении не сказано ничего
…
что высказано и чем это несётся:
  постусловие «единица — счастливое число» функции «Шаг счастья» — доказано сведением цели с телом функции: правило «разбор цели по условию», объявленные типы аргументов не понадобились — утверждение обо ВСЕХ входах, а не о написанных; теоремы при нём нет и не нужно
…
итог:
  функций 4: тотальных 2, обычных 2
  обещание несёт: композиция 1, структура 0, точный шаг 0, постоянный шаг 0, объявленная мера 1
  сторожей в рантайме: 1 место
  законов на сетке: 0 (значений в сетках 0); на веру: 0
  утверждений 1: доказано 1 (из них без теоремы 1), сетка 0, объявлено, не доказано 0
```

`«Шаг счастья»` and `«Счастливое»` are written with the word `функция`, without
`тотальная`. They do end: the sums of squared digits fall into a cycle, and the
list of seen numbers catches the repeat. But that is a theorem about numbers.
Nothing in the program text falls — not a list, not a difference, not the number
itself — and no measure can state it.

The compiler neither refuses nor takes it on trust: there is no promise, and
the report says exactly that — `о завершении не сказано ничего` ("nothing is
said about termination"). The postcondition `«единица — счастливое число»` (one
is a happy number) is proved all the same: a proof of a claim about the result
does not depend on termination.

These are the only two functions in the catalogue without the word `тотальная`.

## The whole catalogue in numbers

| | |
| --- | --- |
| files | 82 |
| lines | 7 014 |
| functions | 343 |
| of them total | 341 |
| declared measures (`убывает`) | 61 |
| postconditions (`обеспечивает`) | 92 in 37 files |
| examples | 908 |

The numbers are taken from the tree: `wc -l` and `grep` for the words `функция`,
`убывает`, `обеспечивает`, `пример`.

Termination is proved for 341 functions out of 343. Claims about the result
number 92 for 343 functions, and they sit in 37 files out of 82. In the other
files only examples check that the answer is right, and an example is a claim
about one input.

For a claim to become proved it has to be written: any function accepts
`обеспечивает`. How that is done — [Specs: a proved rule](fspec.html).

## Next

- [Rosetta Code in flang](rosetta.html) — 14 classic tasks and where totality stops on them.
- [What is proved and what is not](what-is-proved.html) — where the boundary runs.
- [Proof refusals](proof-refused.html) — why the check refuses and what to do about it.
