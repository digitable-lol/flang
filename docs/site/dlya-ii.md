# The flang service for an AI assistant

`flang --mcp-mode` is an MCP service: JSON-RPC over the standard streams, one
message per line. The assistant starts it, not a human: started by hand it waits
for lines in silence — that is not a hang.

Everything on this page was taken from runs on 24 August 2026 against
`flang {{выпуск.версия}}`. Every number and every quotation has the command that produces it
standing next to it; answers are quoted verbatim — including the places where
the service does not behave the way you would expect. The service answers in
Russian, so its own words are left untranslated and glossed instead.

## Half a minute to check it is alive

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | flang --mcp-mode
```

```json
{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-06-18","capabilities":{"tools":{}},"serverInfo":{"name":"flang","version":"0.6.0"}}}
```

**`serverInfo.version` is not the version of the binary.** The string `"0.6.0"`
is written straight into `flang/self/mcp.flang` and does not follow releases.
The binary that gave the answer above answers a direct question differently:

```bash
flang --version
```

```
flang {{выпуск.версия}}
```

So you cannot learn from the service's answer which binary is answering.

## How to connect it

```json
{"mcpServers": {"flang": {"command": "flang", "args": ["--mcp-mode"], "env": {}}}}
```

Set the service's working directory explicitly: it, and nothing else, decides
whether the service finds the other files of the program — see "The service
cannot see neighbouring files".

## Tools: exactly two

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' \
              '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
  | flang --mcp-mode | tail -1 | python3 -m json.tool
```

| Tool | Required fields | What it returns |
|---|---|---|
| `flang_check` | `source` | the report for the whole program, uncut |
| `flang_prove` | `source`, `claim` | what carries ONE named promise |

`claim` is the name from the line `обеспечивает «name» goal`, not the text of
the goal itself. A name that is not in the program is not counted as a refusal
and comes back on its own line: `Обещания «…» в программе нет.` ("there is no
such promise in the program").

## One text field comes back — no "ok", no `isError`

There is no green tick for the assistant to take: the protocol has none.
`result` has one key, the `content` element has two:

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"flang_check","arguments":{"source":"модуль «П»\n"}}}' \
  | flang --mcp-mode | tail -1 \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); print(list(d["result"]), list(d["result"]["content"][0]))'
```

```
['content'] ['type', 'text']
```

Which means branching happens on text. Branch on the FIRST LINE — each outcome
has its own, and it reads exactly like this:

| First line of the answer | What happened |
|---|---|
| `Слова ведомости, и они НЕ взаимозаменяемы:` | the check passed; the report follows |
| `Программа НЕ ПРОШЛА проверку языка, и ведомость доказательства поэтому не печатается.` | `flang_check`: the program was rejected, there will be no report |
| `Программа НЕ ПРОШЛА проверку языка, доказывать нечего:` | the same from `flang_prove` |
| `Обещания «…» в программе нет.` | the name in `claim` was not found; the program itself is fine |

Below the first line come lines of the form `FLANG_<CODE>, строка N, столбец M: …`
(line N, column M). Branching on the words "did not pass" is too coarse: under
that line sit a parse typo, a type mismatch, an example that did not match and a
file that was not found — four different problems with four different repairs.
Only the code tells them apart.

## Protocol errors

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' \
  '{"jsonrpc":"2.0","id":2,"method":"resources/list","params":{}}' \
  'это не json' \
  '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"flang_check","arguments":{}}}' \
  '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"flang_nonexistent","arguments":{}}}' \
  | flang --mcp-mode
```

Five lines in — **four answers out**:

```json
{"jsonrpc":"2.0","id":2,"error":{"code":-32601,"message":"служба flang не знает метода «resources/list»"}}
{"jsonrpc":"2.0","id":4,"error":{"code":-32602,"message":"в запросе нет поля «source» — текста программы на flang"}}
{"jsonrpc":"2.0","id":5,"error":{"code":-32602,"message":"служба flang не знает средства «flang_nonexistent». Их два: flang_check и flang_prove"}}
```

**A line that does not parse as JSON gets no answer in the stream at all** — no
error, not even an empty object. The service does say something about it, but
into the OTHER stream:

```
flang --mcp-mode: строка не разобрана как JSON, пропущена
```

("the line did not parse as JSON, skipped"). That is standard error, and most
MCP clients throw it away. So an assistant waiting for one answer per request
will wait here for ever and never learn why. Set a timeout, and pick that stream
up.

## Five words of the report — and a sixth one the glossary omits

The glossary travels in every successful answer, in full and word for word, so
there is nothing to remember between calls:

```
Слова ведомости, и они НЕ взаимозаменяемы:
  «доказано» — утверждение обо ВСЕХ входах, выведенное из объявлений и структуры;
  «доказано индукцией по «Т»» — то же обо всех входах типа «Т»;
  «сетка N» — посчитано на N значениях автора. ЭТО НЕ ДОКАЗАТЕЛЬСТВО;
  «объявлено, не доказано» — утверждение высказано, доказательства при нём нет;
  «НАРУШЕНО» — ложь, уже найденная примером автора.
Ни одно из этих слов не сводится к «ок».
```

That is: `доказано` — holds for all inputs; `доказано индукцией по «Т»` — the
same for every value of type «Т»; `сетка N` — computed on N of the author's
values, which is NOT a proof; `объявлено, не доказано` — stated, nothing proves
it; `НАРУШЕНО` — already false, found by the author's own example. None of them
reduces to "ok".

Below the glossary, inside the report itself, a sixth word turns up — **`на
веру`**, "taken on trust: computed by nothing, the author's assumption". It is
not in the glossary that gets shipped: an assistant that parses the answer
against five words will trip over it.

The last lines of the report count the outcomes. Here they are from a real
module — `examples/crypto/certificate.flang`, an X.509 parser of 121 functions:

```
итог:
  функций 121: тотальных 121, обычных 0
  обещание несёт: композиция 120, структура 0, точный шаг 0, постоянный шаг 1, объявленная мера 0
  сторожей в рантайме: 1 место
  законов на сетке: 0 (значений в сетках 0); на веру: 0
  утверждений 292: доказано 174 (из них индукцией 25) (из них без теоремы 139, объявленным типом 1), сетка 118, объявлено, не доказано 0 (шагов в термах 11)
```

Of 292 claims, 174 are proved (25 of them by induction) and 118 stand on the
author's values only. Those numbers show the assistant not what is proved but
**what it does not know**. The word "checked" carries no such difference, which
is why it is not in the answer.

## A refusal is worth more than a proof

The most useful thing the service gives an assistant is not `доказано` but a
named falsehood. The promise below looks obviously true, and the author's
example under it is honest:

```flang
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

```bash
python3 -c 'import json; print(json.dumps({"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}))' > zapros.jsonl
python3 -c 'import json; print(json.dumps({"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"flang_prove","arguments":{"source":open("srok.flang").read(),"claim":"срок никогда не отрицателен"}}},ensure_ascii=False))' >> zapros.jsonl
flang --mcp-mode < zapros.jsonl | tail -1 \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["result"]["content"][0]["text"])'
```

```
Программа НЕ ПРОШЛА проверку языка, доказывать нечего:

FLANG_BOUND_ON_NAN, строка 6, столбец 3: постусловие «срок никогда не
отрицателен» функции «Дней осталось» ЛОЖНО, и контрпример назван: «выдан»
объявлен типом «число», а «не число» живёт в этом типе и стоит ВНЕ ПОРЯДКА —
оно не больше и не меньше ничего, включая самоё себя. […] Позовите «Дней
осталось» от (0 делить на 0) — рантайм ответит FLANG_PROPERTY. Чинится тремя
способами: объявить вход отрезком («нат», «целое») […]; поставить предусловие
[…]; либо оговорить границу […]
```

The postcondition is FALSE and the counterexample is named: `выдан` is declared
`число`, and "not a number" lives in that type and stands OUTSIDE THE ORDER — it
is neither greater nor smaller than anything, itself included. Call the function
with `0 делить на 0` and the runtime answers `FLANG_PROPERTY`. Three repairs are
offered: declare the input over an interval (`нат`, `целое`), add a
precondition, or qualify the bound.

The counterexample is not the one the author had in mind. The author was
thinking of an expired certificate and wrote `-25`; the service showed an input
he never considered. That is what an assistant will not get from itself: it
wrote a promise it was sure of and learned the promise was false before the
first run, not after it.

The opposite case — a promise that is not false and not proved either. The
answer says that too, and says what becomes of it:

```
постусловие «вдвое больше входа» функции «Удвоить» — объявлено, не доказано:
ни теоремы, ни примеров. Его считает рантайм после каждого возврата — на тех
входах, которые придут
```

Stated, not proved: no theorem, no examples. The runtime will check it after
every return, on whatever inputs actually arrive.

## What is caught in one run, and what is not

One program, four deliberate mistakes: a word reserved by the language used as a
parameter name, two type mismatches, and a semantic one — the function returns
zero instead of the length of the list.

```flang
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

**A parse error arrives alone and drowns the rest.** `flang check chetyre.flang`:

```
chetyre.flang: не проверено — замечаний 1
FLANG_PARSE в файле chetyre.flang, строка 6, столбец 10: не разобрана
конструкция: неожиданное 'список' — это слово занято языком, именем оно быть не
может: напишите имя в ёлочках («список») или переименуйте; а если слово попало в
форму лишним — уберите его
```

One complaint: `список` is a word the language has taken, so it cannot be a
name. Not one type error from the same file is named — nobody looked for them
yet.

**Type errors arrive as a batch.** Rename the parameter to `строки` and both
mismatches are named in a single run, so there is no fixing them one at a time:

```
модуль «Отчёт»: функций 3, из них с доказанным завершением 3; типов 0
chetyre-2.flang: не проверено — замечаний 2
FLANG_TYPE в файле chetyre-2.flang, строка 15, столбец 3: левый операнд «add»: ожидался число, получен строка
FLANG_TYPE в файле chetyre-2.flang, строка 20, столбец 3: функция «Метка» объявлена как строка, а тело даёт число
```

**The fourth mistake — the semantic one — the service does not see.** Fix the
types and the same program passes in silence, even though `«Строк в списке»`
returns zero for every list:

```
модуль «Отчёт»: функций 3, из них с доказанным завершением 3; типов 0
chetyre-3.flang: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет
```

"Checked: parsing, types, termination, kernel and examples; no complaints." A
mistake of that kind is caught exactly when the author has written a promise or
an example next to the function. One added line, `ожидается 3`, changes the
answer:

```
chetyre-4.flang: не проверено — замечаний 1
FLANG_EXAMPLE: пример «три строки» функции «Строк в списке»: значение не
совпало с ожидаемым: ожидалось 3, получено 0
```

So three mistakes out of four were found by the compiler itself, before any
run — but over two runs, not one. The fourth was found too, only after the
author said what he expected.

## The service cannot see neighbouring files

The most expensive mistake when wiring it up. The service receives `source` —
text, and nothing but text. It has no file, and the text has an import line in
it:

```flang
модуль «Сертификат»
  использует «X.509» из "../../flang/stdlib/x509.flang"
```

The service resolves a relative path against ITS OWN working directory. The same
file that `flang check` reads from disk without a complaint answers this way
through the service:

```
FLANG_IMPORT_NOT_FOUND, строка 1, столбец 1: не найден модуль «X.509»:
/srv/flang/stdlib/x509.flang (ENOENT: no such file or directory)
FLANG_UNKNOWN_NAME, строка 68, столбец 31: неизвестная функция «Версия сертификата»
…
```

One import line that was not found produced **41 complaints**: 1
`FLANG_IMPORT_NOT_FOUND`, 27 `FLANG_UNKNOWN_NAME` and 13 `FLANG_NOT_TOTAL`.
Counted like this (here and below `zapros.jsonl` holds `initialize` plus a
`tools/call` on `flang_check` whose `source` is the whole text of
`certificate.flang`):

```bash
flang --mcp-mode < zapros.jsonl | tail -1 | python3 -c \
 'import json,sys,re,collections; t=json.load(sys.stdin)["result"]["content"][0]["text"]; print(collections.Counter(re.findall(r"FLANG_[A-Z_]+", t)))'
```

An assistant reading that answer will decide the program has fallen apart and
start rewriting all of it. Nothing has fallen apart: one file was not found. The
same request handed to a service whose working directory sits next to the file
goes through and prints the full report — the only thing changed is the
directory:

```bash
cd examples/crypto && flang --mcp-mode < zapros.jsonl | tail -1
```

So there are two cures: start the service with the project as its working
directory, or send the program as one text with no imports.

## What it costs

Measured with `flang check` under `/usr/bin/time`, ten runs each, on a shared
machine.

| What is checked | Size | Time |
|---|---|---|
| one function with a promise and an example | 12 lines, 1 function | 0.03 s |
| `examples/leetcode/001-two-sum.flang` | 65 lines, 3 functions | 0.12 s |
| `examples/crypto/certificate.flang` with imports | 121 functions, 5 files | 92 s |

```bash
/usr/bin/time -f '%e s' flang check examples/leetcode/001-two-sum.flang
/usr/bin/time -f '%e s' flang check examples/crypto/certificate.flang
```

The same computation as a Python script takes 0.01 s; 0.01 s of every row in
the table is process startup. The MCP exchange on top of the check adds 0.004 s:
`initialize` plus `tools/call` on the program from the first row is 0.036 s in
total.

Read the table like this: **on a script the proof is free** — the difference
against an ordinary run is hundredths of a second, so the service can be called
on every edit. On a real module it costs a minute and a half, which makes it one
call per review, not one per keystroke.

The second cost is not time but room in the conversation. The full report for
that same certificate arrives as one line of **95,707 characters, 450 lines**:

```bash
flang --mcp-mode < zapros.jsonl | tail -1 | python3 -c \
 'import json,sys; t=json.load(sys.stdin)["result"]["content"][0]["text"]; print(len(t), t.count(chr(10))+1)'
```

Hence the rule: `flang_check` for the program you are writing right now;
`flang_prove` with the name of a promise for anything bigger. The second answers
in one paragraph instead of a hundred pages.

## What the service does not do

It does not stop an assistant from writing something wrong. It takes away the
option of calling the wrong thing right: "this function is correct" is a
sentence, while `доказано` in the answer is the result of a run.

Two questions it cannot answer: "what breaks if I change this" and "do these
requirements agree with each other". Both need a process started from the
service loop, and today's loop carries one effect.

## Next

- [Requirements that are proved](fspec.html) — a rule in the customer's language.
- [What is proved and what is not](what-is-proved.html) — where the line runs.
- [Diagnostic codes](diagnostics.html) — what to branch on after the first line.
