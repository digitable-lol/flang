# The flang service for an AI assistant

`flang --mcp-mode` is an MCP service. Through it an assistant checks a flang
program and learns what is proved about it. The service reads JSON-RPC from
standard input, one message per line, and answers on standard output. There is
no `Content-Length` framing as in LSP.

The service is started by the assistant, not by a person. Started by hand, it
silently waits for lines.

The service answers in Russian, like the compiler; the answers are quoted here
as they are.

## How to connect it

```json
{"mcpServers": {"flang": {"command": "flang", "args": ["--mcp-mode"], "env": {}}}}
```

Set the working directory of the service explicitly: whether it finds the files
a program uses depends on it — see "The service cannot see neighbouring files".

To check that the service answers:

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | flang --mcp-mode
```

```json
{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-06-18","capabilities":{"tools":{}},"serverInfo":{"name":"flang","version":"{{выпуск.версия}}"}}}
```

The `id` field comes back as it arrived: a number or a string.

## Two tools

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' \
              '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
  | flang --mcp-mode | tail -1 | python3 -m json.tool
```

| Tool | Required fields | What it returns |
|---|---|---|
| `flang_check` | `source` | the proof report for the whole program |
| `flang_prove` | `source`, `claim` | the verdict on one named claim |

`source` is the whole text of the program. `claim` is the name from the line
`обеспечивает «name» goal`, not the goal itself.

## The answer is one text, with no "ok" field

`result` has one key, and an element of `content` has two:

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"flang_check","arguments":{"source":"модуль «П»\n"}}}' \
  | flang --mcp-mode | tail -1 \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); print(list(d["result"]), list(d["result"]["content"][0]))'
```

```
['content'] ['type', 'text']
```

There is no `isError` and no success flag. The outcome is told apart by the
first line of the text:

| First line of the answer | What happened |
|---|---|
| `Слова ведомости, и они НЕ взаимозаменяемы:` | the program passed the check; the report follows |
| `Программа НЕ ПРОШЛА проверку языка, и ведомость доказательства поэтому не печатается.` | a `flang_check` answer: the program is rejected |
| `Программа НЕ ПРОШЛА проверку языка, доказывать нечего:` | the same in a `flang_prove` answer |
| `Обещания «…» в программе нет.` | the name in `claim` was not found; the program itself is fine |

Under the "НЕ ПРОШЛА" (did not pass) line come remarks of the form
`FLANG_CODE, строка N, столбец M: …` (line N, column M). A typo, a type
mismatch, a failed example and a file not found are told apart only by the
code — see [Diagnostics reference](diagnostics.html).

## The words of the report

A successful answer starts with a glossary. It comes in every answer, so there
is no need to remember it between calls:

```
Слова ведомости, и они НЕ взаимозаменяемы:
  «доказано» — утверждение обо ВСЕХ входах, выведенное из объявлений и структуры;
  «доказано индукцией по «Т»» — то же обо всех входах типа «Т»;
  «сетка N» — посчитано на N значениях автора. ЭТО НЕ ДОКАЗАТЕЛЬСТВО;
  «объявлено, не доказано» — утверждение высказано, доказательства при нём нет;
  «НАРУШЕНО» — ложь, уже найденная примером автора.
Ни одно из этих слов не сводится к «ок».
```

In order: «доказано» — proved, a claim about all inputs; «доказано индукцией по
«Т»» — proved by induction over the type «Т»; «сетка N» — grid of N, computed
on N of the author's values and not a proof; «объявлено, не доказано» — stated,
not proved; «НАРУШЕНО» — violated, a falsehood already found by the author's
example. The last line: none of these words reduces to "ok".

Below comes the report itself — the same one `flang check --proof` prints. Its
header has a sixth word that the glossary above lacks: «на веру» (on trust) —
"computed by nothing, the author's assumption".

The last lines of the report count the outcomes. For
`docs/examples/crypto/certificate.flang`:

```
итог:
  функций 7: тотальных 7, обычных 0
  обещание несёт: композиция 7, структура 0, точный шаг 0, постоянный шаг 0, объявленная мера 0
  сторожей в рантайме: 0 мест
  законов на сетке: 0 (значений в сетках 0); на веру: 0
  утверждений 2: доказано 1 (из них без теоремы 1), сетка 1, объявлено, не доказано 0
```

7 functions, all total; 2 claims: 1 proved, 1 on the grid. Of the two claims
one rests on the author's example, not on a proof. The report counts only the
text that was sent: the functions and claims of the modules it uses are not in
it.

## The verdict on one claim

`flang_prove` is useful when a claim looks true. Here the author is sure that a
term is never negative:

```flang refused
модуль «Срок»

тотальная функция «Дней осталось»
  принимает выдан: число, ныне: число
  возвращает число
  обеспечивает «срок никогда не отрицателен» результат не меньше 0
  пример «просрочен»
    дано выдан равно 10
    дано ныне равно 400
    ожидается -25
  (выдан плюс 365) минус ныне
```

The request is built from the program file:

```bash
python3 -c 'import json; print(json.dumps({"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}))' > request.jsonl
python3 -c 'import json; print(json.dumps({"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"flang_prove","arguments":{"source":open("term.flang").read(),"claim":"срок никогда не отрицателен"}}},ensure_ascii=False))' >> request.jsonl
flang --mcp-mode < request.jsonl | tail -1 \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["result"]["content"][0]["text"])'
```

```
Программа НЕ ПРОШЛА проверку языка, доказывать нечего:

FLANG_BOUND_ON_NAN, строка 6, столбец 3: постусловие «срок никогда не отрицателен» функции «Дней осталось» ЛОЖНО, и контрпример назван: «выдан» объявлен типом «число», а «не число» живёт в этом типе и стоит ВНЕ ПОРЯДКА — оно не больше и не меньше ничего, включая самоё себя. Тело собрано только из арифметики над «выдан», а всякая арифметическая операция «не число» переносит, значит результат есть «не число», и сравнение с ним ложно. Позовите «Дней осталось» от (0 делить на 0) — рантайм ответит FLANG_PROPERTY. Чинится тремя способами: объявить вход отрезком («неотрицательное», «целое») — тогда «не число» не втащить вовсе; поставить предусловие — за него платит вызывающий; либо оговорить границу, и ядро оговорку читает: обеспечьте «не ((выдан минус выдан) равен 0) или (…)»
```

The answer says the postcondition is FALSE and names a counterexample: the
argument is declared as `число` (number), NaN lives in that type, and NaN is
neither greater nor less than anything. It then names three ways to fix it:
declare the input as a range type, add a precondition, or state the boundary in
the claim. The counterexample is not the one in the author's example: the
author thought of an overdue term, the service found NaN.

If a claim is not false but not proved either, the answer says what will happen
to it while the program runs:

```flang
модуль «Удвоение»

тотальная функция «Удвоить»
  принимает х: число
  возвращает число
  обеспечивает «вдвое больше входа» результат равен (х умножить на 2)
  х плюс х
```

```
  постусловие «вдвое больше входа» функции «Удвоить» — объявлено, не доказано: ни теоремы, ни примеров. Его считает рантайм после каждого возврата — на тех входах, которые придут
```

("stated, not proved: neither a theorem nor examples. The runtime computes it
after every return — on the inputs that arrive".)

A name the program does not have:

```
Обещания «нет такого» в программе нет. Обещание пишется строкой `обеспечивает «имя» цель` внутри функции.
```

## What the service finds by itself and what it does not

The program below has four errors: the reserved word `список` (list) as a
parameter name, two type mismatches, and one of meaning — the function counts
not the length of the list but zero.

```flang refused
модуль «Отчёт»

тотальная функция «Строк в списке»
  принимает список: список строки
  возвращает число
  разбор список
    случай пусто
      то 0
    случай голова и хвост
      «Строк в списке» от хвост

тотальная функция «Заголовок»
  принимает имя: строка
  возвращает число
  имя плюс 1

тотальная функция «Метка»
  принимает номер: число
  возвращает строка
  номер
```

Below are the answers of `flang check` on a file `report.flang` holding this
program. The service names the same remarks under the line "Программа НЕ
ПРОШЛА…".

**A parse error comes alone and hides the rest:**

```
FLANG_PARSE в файле report.flang, строка 6, столбец 10: не разобрана конструкция: неожиданное 'список' — это слово занято языком, именем оно быть не может: напишите имя в ёлочках («список») или переименуйте; а если слово попало в форму лишним — уберите его
report.flang: не проверено — замечаний 1
```

**Type errors come together.** After the parameter is renamed to `строки`:

```
модуль «Отчёт»: функций 3, из них с доказанным завершением 3; типов 0
FLANG_TYPE в файле report.flang, строка 15, столбец 3: левый операнд «add»: ожидался число, получен строка
FLANG_TYPE в файле report.flang, строка 20, столбец 3: функция «Метка» объявлена как строка, а тело даёт число
report.flang: не проверено — замечаний 2
```

**The error of meaning the service does not see.** After the types are fixed
(`(длина имя) плюс 1` and `к строке номер`) the program passes, although
«Строк в списке» returns zero on every list:

```
модуль «Отчёт»: функций 3, из них с доказанным завершением 3; типов 0
report.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
```

It is caught by an example or a claim written by the author. An example with
three strings and `ожидается 3` (expected 3) changes the answer:

```
модуль «Отчёт»: функций 3, из них с доказанным завершением 3; типов 0
FLANG_EXAMPLE: пример «три строки» функции «Строк в списке»: значение не совпало с ожидаемым: ожидалось 3, получено 0
report.flang: не проверено — замечаний 1
```

## Protocol errors

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' \
  '{"jsonrpc":"2.0","id":2,"method":"resources/list","params":{}}' \
  'это не json' \
  '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"flang_check","arguments":{}}}' \
  '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"flang_nonexistent","arguments":{}}}' \
  | flang --mcp-mode
```

Five lines in, four answers out. The first is the answer to `initialize`; the
other three:

```json
{"jsonrpc":"2.0","id":2,"error":{"code":-32601,"message":"служба flang не знает метода «resources/list»"}}
{"jsonrpc":"2.0","id":4,"error":{"code":-32602,"message":"в запросе нет поля «source» — текста программы на flang"}}
{"jsonrpc":"2.0","id":5,"error":{"code":-32602,"message":"служба flang не знает средства «flang_nonexistent». Их два: flang_check и flang_prove"}}
```

A line that does not parse as JSON gets no answer. The service writes about it
to standard error:

```
flang --mcp-mode: строка не разобрана как JSON, пропущена
```

A client that waits for an answer to every line will hang here. Set a timeout
and read standard error.

## The service cannot see neighbouring files

The service receives the text of a program, not a file. The text does have a
line that uses another module:

```flang fragment
модуль «Сертификат»
  использует «X.509» из "../../../flang/stdlib/x509.flang"
```

The service resolves a relative path from its own working directory. A program
that `flang check` passes from disk without a remark answers like this through
a service started in another directory:

```
FLANG_IMPORT_NOT_FOUND, строка 1, столбец 1: не найден модуль «X.509»: …/flang/stdlib/x509.flang (ENOENT: no such file or directory, …)
FLANG_UNKNOWN_NAME, строка 47, столбец 31: неизвестная функция «Версия сертификата»
…
```

One file not found gave 41 remarks: 1 `FLANG_IMPORT_NOT_FOUND`, 27
`FLANG_UNKNOWN_NAME` and 13 `FLANG_NOT_TOTAL`. They are counted like this
(`request.jsonl` holds `initialize` and a `tools/call` of `flang_check` whose
`source` is the text of `docs/examples/crypto/certificate.flang`):

```bash
flang --mcp-mode < request.jsonl | tail -1 | python3 -c \
 'import json,sys,re,collections; t=json.load(sys.stdin)["result"]["content"][0]["text"]; print(collections.Counter(re.findall(r"FLANG_[A-Z_]+", t)))'
```

There is nothing to fix in the program: one file was not found. Start the
service in the working directory of the program, or send a program that uses no
other modules.

The same request from the directory of the program passes and returns the
report whose last lines are shown above:

```bash
cd docs/examples/crypto && flang --mcp-mode < request.jsonl | tail -1
```

## What the service does not do

- It does not answer "ok": the outcome has to be read from the words of the
  report.
- It does not find errors of meaning about which the author wrote neither an
  example nor a claim.
- It does not run the program and does not carry out plans.
- It does not answer "what breaks if I change this" or "do the requirements
  agree with each other".

## Next

- [Specs: a proved rule](fspec.html) — how to write a requirement as a claim.
- [What is proved and what is not](what-is-proved.html) — where the boundary runs.
- [Diagnostics reference](diagnostics.html) — what to branch on after the first line.
