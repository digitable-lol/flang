# Встроить flang в чужую программу

flang не встраивается рантаймом и не зовётся через FFI. Он **печатается в
исходник на вашем языке** — и дальше это обычный файл вашего проекта:
статическая библиотека на C, модуль на JavaScript, модуль на Python.
Напечатанный код о flang не знает: ни компилятора, ни виртуальной машины рядом
с ним при работе нет.

Целей печати {{цели.словом}}: {{цели.список}}.

## Одна команда

```bash
flang emit <файл> --target <цель> --out <каталог>
```

| ключ | что делает |
|---|---|
| `--out каталог` | куда записать файлы; каталога может не быть, он создаётся |
| `--no-cli` | не печатать прогонщик, оставить только модуль и рантайм |
| `--max-steps N`, `--max-depth N` | пределы, которые впечатываются в код как умолчания |
| `--index-base 0` или `--index-base 1` | база индексов программы; уезжает в `FL_INDEX_BASE` |
| `--runtime путь` | откуда брать исходники рантайма цели |

`--max-steps 500 --max-depth 200` дают в напечатанном модуле JavaScript ровно
`const $DEFAULT_MAX_STEPS = 500` и `const $DEFAULT_MAX_DEPTH = 200`, а
`--index-base 0` — строку `#define FL_INDEX_BASE 0` в шапке рантайма C.

**Непроверенное не печатается.** `emit` сначала гоняет те же проверки, что
`check`, и на первой же беде отказывает, не записав ни файла:

```bash
$ flang emit broken.flang --target js --out ./вывод
FLANG_TYPE в файле broken.flang, строка 10, столбец 5: функция «Удвоить»
 объявлена как строка, а тело даёт число
…
flang emit: печать отменена — программа не проходит проверку, замечаний 4.
$ ls ./вывод
ls: cannot access './вывод': No such file or directory
```

Про границу входа печать предупреждает отдельно:

```
аргументы напечатанной программы по типам не проверяются: это ограничение
двоичного flang
```

Напечатанное соберётся и заработает, а аргументы прогонщика с объявленными
типами сверяться не будут. Как это обойти — ниже, в разделе про прогонщик через
трубу.

## Что приезжает в каталоге

Один прогон на цель, программа одна и та же —
`flang/examples/rosetta/factorial-english.flang`:

| цель | файлы |
|---|---|
| `c` | `flang_runtime.h` `flang_runtime.c` `factorial.h` `factorial.c` `flang_cli.c` `Makefile` |
| `csharp` | `Value.cs` `Field.cs` `FlangError.cs` `Ctx.cs` `Flang.cs` `Factorial.cs` `FlangCli.cs` `flang.csproj` `Makefile` |
| `elixir` | `flang_runtime.ex` `factorial.ex` `flang_cli.ex` `Makefile` |
| `go` | `go.mod` `flangrt/flang_runtime.go` `flang/factorial.go` `cli/main.go` `Makefile` |
| `java` | `Value.java` `Field.java` `FlangError.java` `Ctx.java` `Flang.java` `Factorial.java` `FlangCli.java` `Makefile` |
| `js` | `factorial.js` `flang_cli.js` |
| `python` | `flang_runtime.py` `factorial.py` `flang_cli.py` `Makefile` |
| `rust` | `Cargo.toml` `src/runtime.rs` `src/factorial.rs` `src/lib.rs` `src/cli.rs` `src/main.rs` `Makefile` |

Раскладка везде одна: **рантайм** (значения, арифметика, диагностики),
**модуль программы** (по функции на функцию flang), **прогонщик** и сборочный
файл. С `--no-cli` прогонщика нет: у `js` остаётся один `factorial.js`, у `c` —
пять файлов из шести.

Программа с объявлениями `процесс` и `надзор` печатается с планировщиком только
на `c` и `elixir`; на остальных целях обработчики приезжают обычными функциями,
и звать их вам самим. Конкурентность цели названа ещё и в поле `возможности`
ответа `emit`.

## C: собрать и слинковать со своей программой

```bash
$ flang emit flang/examples/rosetta/factorial-english.flang --target c --out ./вывод-c
напечатано файлов 6, байт 280565, в ./вывод-c
$ ls ./вывод-c
Makefile  factorial.c  factorial.h  flang_cli.c  flang_runtime.c  flang_runtime.h
```

`make` в этом каталоге собирает **статическую библиотеку** и прогонщик:

```bash
$ cd вывод-c && make -j4
cc -std=c99 -Wall -Wextra -Werror -pedantic -O2 -flto   -c -o flang_runtime.o flang_runtime.c
cc -std=c99 -Wall -Wextra -Werror -pedantic -O2 -flto   -c -o factorial.o factorial.c
cc -std=c99 -Wall -Wextra -Werror -pedantic -O2 -flto   -c -o flang_cli.o flang_cli.c
ar rcs libfactorial.a flang_runtime.o factorial.o
cc -std=c99 -Wall -Wextra -Werror -pedantic -O2 -flto -o flang_cli flang_cli.o flang_runtime.o factorial.o -lm -lpthread
```

Имя библиотеки — `lib<модуль>.a`, где `<модуль>` тот же слаг, что у файлов:
модуль «Factorial» дал `libfactorial.a`, модуль «Хранилище ссылок» —
`libhranilische_ssylok.a`. Зависимостей ровно две: `-lm` и `-lpthread`.

**Точка входа — не `main`, а функция на функцию.** Заголовок называет контракт
вызова сам:

```c
/*
 * Контракт вызова: функция кладёт результат в *result и возвращает FL_OK
 * либо НЕ трогает *result и возвращает FL_ERROR, заполнив *error (его можно
 * передать NULL). Результат живёт в арене контекста — до ближайшего
 * fl_arena_reset; чтобы сохранить его надолго, скопируйте в свою память.
 */
fl_status factorial_factorial(fl_ctx *ctx, fl_value n, fl_value *result, fl_error *error);
fl_status factorial_product(fl_ctx *ctx, fl_value items, fl_value *result, fl_error *error);
```

Имя в C — `<модуль>_<функция>`, оба слага. «Factorial» → `factorial_factorial`,
«Приписать в начало» из модуля «Факториал» → `faktorial_pripisat_v_nachalo`.
Рядом с функциями заголовок объявляет `factorial_call` — вызов по исходному
имени flang («Factorial», не слаг) для тех, кто связывается динамически, — и
`factorial_entry`, таблицу объявленных типов параметров данными.

Хозяин на C — обычный файл, который включает заголовок и линкуется с архивом:

```c
#include <stdio.h>
#include "factorial.h"

int main(void) {
  fl_arena arena;
  fl_ctx ctx;
  fl_error error = {0};
  fl_value result;

  fl_arena_init(&arena);
  fl_ctx_init(&ctx, &arena);

  if (factorial_factorial(&ctx, fl_number(10), &result, &error) != FL_OK) {
    printf("отказ: %s — %s\n", error.code, error.message);
    fl_arena_release(&arena);
    return 1;
  }
  printf("factorial(10) = %.0f\n", result.as.number);

  fl_value items[4] = { fl_number(1), fl_number(2), fl_number(3), fl_number(4) };
  if (factorial_product(&ctx, fl_list(items, 4), &result, &error) != FL_OK) { … }
  printf("product([1,2,3,4]) = %.0f\n", result.as.number);

  /* Отказ значением: строку туда, где ждут число. */
  if (factorial_factorial(&ctx, fl_text_borrow("x", 1, 1), &result, &error) != FL_OK) {
    printf("отказ: %s — %s\n", error.code, error.message);
  }

  fl_arena_release(&arena);
  return 0;
}
```

```bash
$ cc -std=c99 -Wall -Wextra -Werror -pedantic -O2 -o host host.c libfactorial.a -lm -lpthread
$ ./host
factorial(10) = 3628800
product([1,2,3,4]) = 24
отказ: FLANG_TYPE — сравнения порядка допустимы только для чисел
```

Три правила, которые видно прямо здесь и которые придётся держать:

1. **Арена — ваша.** `fl_arena_init` … `fl_arena_release` обрамляют работу;
   всё, что вернули функции, живёт в арене и умирает вместе с ней. Нужен
   результат дольше — копируйте в свою память.
2. **Отказ не бросается.** Исключений нет ни в языке, ни в напечатанном C:
   отказ — это `FL_ERROR` и заполненный `fl_error` с полями `code` и `message`.
3. **`fl_ctx` несёт пределы**: глубина, число шагов и проверка остатка стека.
   Один контекст можно переиспользовать между вызовами, как здесь.

Отсюда же берётся WebAssembly: напечатанный C переезжает туда без правок —
см. [WebAssembly через C](wasm.html).

## Значение на границе

У каждой цели печати представление значения своё, и именно оно и есть граница,
через которую вы разговариваете с программой.

### C

`fl_value` — тег плюс объединение (`flang_runtime.h`):

| flang | тег | как читать |
|---|---|---|
| число | `FL_NUMBER` | `v.as.number` — `double`, всегда; целых чисел в языке нет |
| признак | `FL_FLAG` | `v.as.flag` |
| строка | `FL_STRING` | `v.as.string.utf8`, `.bytes`, `.points` |
| список | `FL_LIST` | `v.as.list.items`, `.count` |
| запись | `FL_RECORD` | `fl_field_get(ctx, v, "имя поля", &out, &err)` |
| вариант | `FL_VARIANT` | `fl_variant_is(v, "Имя")`, `fl_variant_field(ctx, v, "поле", …)` |
| ничто | `FL_NOTHING` | нагрузки нет |

**Строка не обязана заканчиваться нулём**: подстрока и хвост — это срезы общей
памяти. Печатайте её длиной, а не `%s`. И длин две: `bytes` — октеты UTF-8,
`points` — кодовые точки; `длина` в языке считает вторые.

Строку в C делают двумя конструкторами: `fl_text_borrow(utf8, bytes, points)` —
без копирования, кодовые точки считает вызывающий; `fl_text(ctx, utf8, bytes,
&out, &err)` — с копированием в арену, точки считает рантайм. Второй безопаснее.

**Имена полей и вариантов не переводятся.** Транслитерируются только имена
функций и модулей; поле, объявленное как «адрес», в C так и берётся —
`fl_field_get(&ctx, v, "адрес", …)`.

**Отказ, объявленный значением, значением и приходит.** В
`flang/examples/errors/number-parsing.flang` «Разобрать число» возвращает сумму
типов «Вышло» | «Не вышло» — и на границе это вариант, а не `FL_ERROR`:

```
42 → Вышло, значение = 42
abc → Не вышло, сообщение = «к числу»: строка "abc" не является числом
```

Разница принципиальная: `FL_ERROR` — это отказ вычисления (не тот тип,
кончились шаги, кончилась глубина), а вариант — обычный ответ функции, который
вы разбираете `fl_variant_is`.

### JavaScript

Представление простое: число — `number`, строка — `string`, признак —
`boolean`, «ничто» — `null`, список — `Array` (`Array.isArray` даёт `true`),
запись — обычный объект с исходными именами полей, вариант — экземпляр
внутреннего класса с полями `variant` и `fields`. Отказ **бросается**:
`FlangError` с полями `code`, `message` и `diagnostics`.

### Python

Представление в Python **другое**, и это надо знать до первого вызова: значения
там упакованы (`Value` с полями `tag` и `data`), функции принимают контекст
первым аргументом, а голое число рантайм не примет:

```python
import factorial, flang_runtime as rt

ctx = factorial.new_context()
r = factorial.fn_factorial(ctx, rt.number(10))      # не 10, а rt.number(10)
print("factorial(10) =", r.tag, r.data)             # → 1 3628800.0
p = factorial.fn_product(ctx, rt.list_of([rt.number(x) for x in (1, 2, 3, 4)]))
print("product([1,2,3,4]) =", p.data)               # → 24.0
try:
    factorial.fn_factorial(ctx, rt.text("x"))
except rt.FlangError as e:
    print("отказ:", e.code, "|", e.message)         # → FLANG_TYPE | сравнения порядка допустимы только для чисел
```

Правило, годное для всех целей: **читайте напечатанный заголовок или модуль.**
В нём стоят и типы параметров, и контракт вызова, и признак `тотальная` у
каждой функции.

Коды отказов (`FLANG_TYPE`, `FLANG_RECURSION_LIMIT`, …) приезжают одинаковыми
на все цели; **тексты** диагностик русские на всех целях, даже если программа
написана на английской поверхности слов. Полагайтесь в своей программе на код,
а не на текст.

## JavaScript: встроить в свой проект

Модуль самодостаточен: ни одного `import` и ни одного `require` на верхнем
уровне — единственный ввоз стоит внутри `$callDeep` и берётся динамически.

```bash
$ flang emit flang/examples/rosetta/factorial-english.flang --target js --no-cli --out ./вывод-js
напечатано файлов 1, байт 18621, в ./вывод-js
$ ls ./вывод-js
factorial.js
```

```js
import { factorial, product, $newContext } from "./factorial.js"

console.log(factorial(10))          // 3628800
console.log(product([1, 2, 3, 4]))  // 24
```

Имена — camelCase от имени flang: «Factorial» → `factorial`, «Numbers from and
to» → `numbersFromAndTo`. У программы на русской поверхности они
транслитерируются: модуль «Разбор числа» даёт файл `razbor_chisla.js` и функцию
`razobratChislo`, а **поля и имена вариантов остаются исходными**:

```js
import { razobratChislo, Vyshlo } from "./razbor_chisla.js"

for (const текст of ["42", "abc"]) {
  const итог = razobratChislo(текст)
  console.log(JSON.stringify(текст), "→", итог.variant, JSON.stringify(итог.fields))
}
console.log("сконструирован хозяином:", JSON.stringify(Vyshlo({ значение: 7 })))
```

```
"42" → Вышло {"значение":42}
"abc" → Не вышло {"сообщение":"«к числу»: строка \"abc\" не является числом"}
сконструирован хозяином: {"variant":"Вышло","fields":{"значение":7}}
```

### Грабля: расширение `.js` и `"type"` вашего пакета

Файл печатается с расширением `.js` и написан модулями ECMAScript. В проекте,
где `package.json` объявляет `"type": "commonjs"` (это же и умолчание), Node
читает его как CommonJS, и именованный ввоз падает:

```
SyntaxError: Named export 'factorial' not found. The requested module './factorial.js'
is a CommonJS module, which may not support all module.exports as named exports.
```

Два лечения, работают оба: переименуйте файл в `.mjs` либо объявите
`"type": "module"` в том каталоге, куда он лёг.

### Пределы и глубина

`$newContext({ maxSteps, maxDepth })` ставит пределы **свежими** — не
переданное берётся по умолчанию, а не остаётся с прошлого вызова. Отказ по
пределу — это `FlangError` с кодом `FLANG_RECURSION_LIMIT`:

```
FlangError | FLANG_RECURSION_LIMIT | функция «Numbers from and to» исчерпала лимит шагов (50) на глубине вызовов 50
```

Отдельная беда JavaScript: **стека хозяина не хватает на объявленную глубину.**
Прямой вызов считает на вашем стеке, и глубокая рекурсия упирается в него
раньше, чем в объявленный предел. Модуль это ловит и говорит прямо, а не падает
чужой ошибкой:

```
прямой вызов 9000: FLANG_RECURSION_LIMIT | функция «Numbers from and to» исчерпала стек хозяина
на глубине 6952, не дойдя до предела глубины вызовов (10000)
$callDeep 9000: длина 9000
```

Рычаг — `await $callDeep(функция, [аргументы], пределы)`: расчёт уезжает в
поток с явно заданным стеком, и объявленный предел становится достижимым. В
браузере и там, где поток не завёлся, расчёт идёт как прежде, и модуль говорит
об этом прямо.

### Настоящий хозяин: служба HTTP на flang, вызванная из Node

В дереве лежит служба сокращения ссылок (`flang/examples/web/shortener/`) —
обработчик HTTP целиком на flang, у которого состояние передаётся значением.
Напечатайте её в `js`, и хозяин на Node обернёт напечатанный модуль:

```js
import { obsluzhit, $newContext } from "./sluzhba_ssylok.js"

$newContext({ maxSteps: 40000000 })
let состояние = { записи: [], выдано: 0 }
/* СЦЕНАРИЙ — список пар «имя, байты запроса»; в настоящем сервере на его
   месте стоит `while (true) accept()`. */
for (const [имя, текст] of СЦЕНАРИЙ) {
  const о = obsluzhit(состояние, текст)     // запись на входе, запись на выходе
  состояние = о["состояние"]
  console.log(о["код"], имя, (о["ответ"] || "").split("\r\n")[0])
}
```

```
200 | здоровье                | HTTP/1.1 200 OK
201 | создание ссылки         | HTTP/1.1 201 Created
301 | переход по коду         | HTTP/1.1 301 Moved Permanently
422 | ЗЛАЯ СХЕМА javascript:  | HTTP/1.1 422 Unprocessable Content
хранилище: {"записи":[{"код":"к1","адрес":"https://пример.рф/док","переходов":1}],"выдано":1}
```

Незавершаемость живёт в цикле хозяина, а обработчик завершается всегда.

## Любой язык: прогонщик через трубу

Если цели под ваш язык нет или связываться исходником не хочется, есть третья
дорога — прогонщик, который печатается рядом с модулем: **JSON на входе, JSON
на выходе, один процесс на поток запросов.** Протокол один и тот же у всех
целей.

```bash
$ printf '%s\n' '{"fn":"Factorial","args":[{"n":"10"}]}' \
                '{"fn":"Product","args":[{"l":[{"n":"1"},{"n":"2"},{"n":"3"},{"n":"4"}]}]}' \
                '{"fn":"Factorial","args":[{"s":"x"}]}' | node flang_cli.js ./factorial.js
{"ok":true,"value":{"n":"3628800"}}
{"ok":true,"value":{"n":"24"}}
{"ok":false,"code":"FLANG_TYPE","message":"вызов функции «Factorial»: аргумент «n» не соответствует типу нат"}
```

Тот же ввод, поданный собранному из цели `c` двоичному `./flang_cli`, даёт те
же строки. Функция зовётся **исходным именем flang**, не слагом. Значения
размечены тегами, потому что JSON беднее языка:

| тег | значение |
|---|---|
| `{"n":"1.5"}` | число строкой — иначе потерялись бы `NaN`, `Infinity` и −0 |
| `{"s":"…"}` | строка |
| `{"l":[…]}` | список |
| `{"r":[["поле", …]]}` | запись |
| `{"v":"Имя","f":[…]}` | вариант |
| `null`, `true`/`false` | «ничто», признак |

У этой дороги есть то, чего нет у прямого вызова: **прогонщик сверяет аргументы
с объявленными типами до вызова** — по таблице, которую печать положила рядом
(`factorial_entry` в C, `$PROGRAM.entry` в JS). Отсюда и разница в сообщениях
выше: прямой вызов `factorial("x")` доходит до сравнения и отвечает «сравнения
порядка допустимы только для чисел», а прогонщик отвечает раньше и точнее.

## Чего не обещано

- **байты напечатанного кода.** Обещание поведенческое: та же программа даёт те
  же значения и те же коды отказа, а не те же байты;
- **тексты диагностик** — только коды. Тексты русские на всех целях;
- **объявления типов для TypeScript.** Ни `.d.ts`, ни файла типов рядом нет;
  типы приезжают комментариями JSDoc в самом модуле — довольно для подсказок
  редактора, но не для строгой сборки;
- **конкурентность везде.** Процессы работают на `c` и `elixir`, параллелизм —
  на `elixir`;
- **сверка аргументов по типам при прямом вызове.** Таблица на границе входа
  остаётся пустой; прогонщик через трубу аргументы сверяет, прямой вызов — нет.

## Дальше

- [Первая программа](getting-started.html) — с чего начать, если flang вы ещё не ставили
- [Пакеты](packages.html) — как собрать библиотеку на flang, прежде чем её печатать
