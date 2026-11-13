# The link shortener: a service and a client

An example made of two flang programs.

- **The service** — `docs/examples/web/shortener/`. Its input is the text of an
  HTTP request, its output the text of the response. It does not hold the
  socket: `flang io` accepts connections, carrying out the orders of a plan.
- **The client** — `docs/examples/web/shortener-client/`. A form, a list of
  links and a visit counter in a browser tab.

The programs are written in the Russian words of flang, and their routes,
messages and report lines are Russian too; they are quoted here as they are.

## The files of the service

| file | lines | what is in it |
|---|---:|---|
| `store.flang` | 137 | the store: codes, addresses, the visit counter |
| `service.flang` | 675 | routes, request parsing, response printing, the claims |
| `plan.flang` | 74 | a plan: one request from a file, the response into a file |
| `plan-network.flang` | 122 | a plan: the service on the socket `127.0.0.1:39281` |
| `plan-durable.flang` | 273 | a plan: the service on the socket `127.0.0.1:39283` with a log on disk |
| `server.flang` | 136 | the same service as three supervised processes |
| `server-network.flang` | 30 | the same processes on top of the network plan |
| `handler-without-budget.flang` | 36 | a deliberately wrong program: `check` rejects it |

HTTP parsing is the library `flang/stdlib/http.flang`.

## What the service answers

| method | path | response |
|---|---|---|
| GET | `/здоровье` (health) | 200 `живой` (alive) |
| GET | `/ссылки` (links) | 200, a line per link: code, address, number of visits |
| POST | `/ссылки` | 201 and the code; body `адрес=…` (address) and an optional `код=…` (code) |
| GET | `/с/{code}` | 301 and `Location`; the visit is counted |
| DELETE | `/ссылки/{code}` | 204 |

Refusals: 400 — bad request, 404 — no such path or code, 405 — wrong method
for a known path, 409 — the code is taken, 413 — the body is longer than 2048,
422 — the address is neither http nor https, 431 — the headers are too large.

## How to run

The examples written inside the functions:

```
flang test docs/examples/web/shortener/server.flang
```

```
docs/examples/web/shortener/server.flang: примеров 329, прошло 329, не прошло 0
```

329 examples, 329 passed. The count includes the examples of the modules the
file uses.

### One request through files

The plan `plan.flang` reads the request from `mail/request.txt` and writes the
response to `mail/response.txt`:

```
flang io docs/examples/web/shortener/plan.flang --in-dir --trust
```

```
на веру: доказанность не считалась — запуск по ключу --trust
{"plan":"Обслужить через файлы","result":86,"orders":2,"log":[…]}
```

```
HTTP/1.1 201 Created
Content-Type: text/plain; charset=utf-8
Content-Length: 3

к1
```

The `--in-dir` flag forbids the plan any path outside the directory of the
program. The `--trust` flag is needed because not every claim of the service is
proved; without it `flang io` answers with exit code 3:

```
не доказано: утверждений 163: доказано 92, сетка 69, на веру 2 — запуск только по явному согласию: --trust
```

("not proved: 163 claims: 92 proved, 69 on the grid, 2 on trust — runs only
with explicit consent".) Those 163 include the claims of every module in use,
the HTTP library among them.

### The service with a log, on a socket

`plan-durable.flang` listens on `127.0.0.1:39283` and, before answering every
request that changes state, appends the request to the file `служба.wal` next
to the program. The log appears in the example directory — to avoid writing
into the tree, copy `docs/examples/web/shortener/`, `docs/examples/wal/` and
`flang/stdlib/` to a separate directory with the same relative paths.

```
cd docs/examples/web/shortener
flang io plan-durable.flang --in-dir --trust --max-orders 100000 &
```

A request without a body can be sent with `curl`:

```
$ curl -i http://127.0.0.1:39283/здоровье
HTTP/1.1 200 OK
Content-Type: text/plain; charset=utf-8
Content-Length: 10

живой
```

A request with a body cannot: the service counts the `Content-Length` of an
incoming request in characters, while `curl` and a browser count bytes (see
"What the service cannot do"). Below, the requests were written to the socket
as they are, with the length in characters:

```
POST /ссылки HTTP/1.1
Host: x
Content-Length: 23

адрес=https://пример.рф
```

```
HTTP/1.1 201 Created
Content-Type: text/plain; charset=utf-8
Content-Length: 3

к1
```

Two visits to `GET /с/к1` give two responses:

```
HTTP/1.1 301 Moved Permanently
Content-Type: text/plain; charset=utf-8
Location: https://пример.рф
Content-Length: 0
```

After them, `GET /ссылки`:

```
HTTP/1.1 200 OK
Content-Type: text/plain; charset=utf-8
Content-Length: 32

к1	https://пример.рф	2
```

Now stop the service (`kill` it by its process id) and start it with the same
command. `GET /ссылки` answers the same: the link and the counter 2 are
restored from the log. The log holds the requests themselves, one record per
state-changing request:

```
#1:77:POST /ссылки HTTP/1.1
Host: x
Content-Length: 23

адрес=https://пример.рф;#2:31:GET /с/к1 HTTP/1.1
Host: x

;#3:31:GET /с/к1 HTTP/1.1
Host: x

;
```

Recovery is serving the log records again, in order. That is sound because the
handler is a total function with no input or output: the same request on the
same store gives the same response. The log format is taken apart on the page
[Write-ahead log](wal.html).

If the log does not accept a record, the plan answers 503 and keeps the old
store: a 201, 204 or 301 response is built only in the branch where the host
answered «Записано» (written). This is visible in the function «После записи в
журнал» and its examples; it was not checked here by a run with a failing disk.

## What is proved

```
flang check docs/examples/web/shortener/service.flang --proof
```

```
итог:
  функций 24: тотальных 24, обычных 0
  обещание несёт: композиция 24, структура 0, точный шаг 0, постоянный шаг 0, объявленная мера 0
  сторожей в рантайме: 0 мест
  законов на сетке: 0 (значений в сетках 0); на веру: 0
  утверждений 8: доказано 5 (из них индукцией 4) (из них без теоремы 1), сетка 3, объявлено, не доказано 0 (шагов в термах 30)
```

24 functions, all total; 8 claims: 5 proved (4 by induction), 3 on the grid.
The exit code is 3 — because of the three claims on the grid.

Proved for all inputs:

| claim | function |
|---|---|
| «код ответа из объявленного набора» (the response code is from the declared set) | «Код исхода» |
| «пояснение кода непусто» (the reason phrase is not empty) | «Код исхода» |
| «успех исхода и успех кода — одно и то же» (a successful outcome and a successful code are the same thing) | «Исход успешен» |
| «октетов от одного до четырёх» (one to four octets) | «Октетов в знаке» |
| «печать ответа начинается версией, кодом и пояснением» (the printed response starts with version, code and reason) | «Напечатать ответ службы» |

The first three are proved by induction over the type «Исход» (outcome): it has
ten variants, and each one is taken apart.

On the grid, that is, checked only on the author's examples:

| claim | function |
|---|---|
| «урезанное не длиннее предела» (the truncated text is no longer than the limit) | «Урезать» |
| «тело ответа не длиннее заявленного предела» (the response body is no longer than the stated limit) | «Тело решения» |
| «в печати ответа длина тела названа в октетах» (the printed response names the body length in octets) | «Напечатать ответ службы» |

All three are about a slice of a string and about a substring occurring in it;
the kernel has no rules for those.

The other files:

| file | functions | total | claims | proved |
|---|---:|---:|---:|---:|
| `store.flang` | 12 | 12 | 1 | 1 |
| `server.flang` | 7 | 5 | 0 | — |
| `shortener-client/client.flang` | 32 | 32 | 43 | 43 |

The report counts only the claims of the file itself, not of the modules it
uses.

What this does not prove:

- that the service speaks HTTP correctly: there are eight claims, and they are
  about codes, lengths and the start of a response. Routes and request parsing
  are checked by examples;
- that the service ever ends: every step of the plan terminates, while the loop
  that accepts connections runs until the process is stopped.

### A handler without a turn budget

The handler of a process is either total, or the process names a turn budget —
the line `с запасом N витков`. `handler-without-budget.flang` does neither:

```
flang check docs/examples/web/shortener/handler-without-budget.flang
```

```
FLANG_HANDLER_NOT_TOTAL в файле docs/examples/web/shortener/handler-without-budget.flang, строка 13, столбец 1: обработчик «шаг разбора» процесса «Разборщик» не помечен тотальным, и запаса витков процесс не называет: строки «с запасом N витков» нет. Оборвать такой пробег планировщику нечем
```

The second remark is `FLANG_UNCOVERED_FAILURE`: a process with such a handler
is not under a supervisor. The exit code is 1.

## What the service cannot do

- **The length of an incoming body is counted in characters, not bytes.** The
  body `адрес=https://пример.рф` is 23 characters and 36 bytes. `curl
  --data-binary` says 36, the service waits for 13 more characters and does not
  answer. The body length in a response is printed in bytes.
- **One connection is one exchange.** There is no keep-alive; a second client
  waits until the first is served.
- **There are no CORS headers, and `OPTIONS` gets 405.** A page from another
  origin cannot call the service from a browser.
- **`Location` carries the address as it is**; Cyrillic is not encoded.
- **The port and the log name are written into the program** (`39283`,
  `служба.wal`).
- **The log is never compacted:** every state-changing request stays in it for
  good, and recovery replays the whole history.
- **Durability is not promised.** The plan rewrites the log file as a whole,
  and «Записано» means only that the system accepted the write. A record has no
  checksum.

Cyrillic paths are understood in percent-encoded form too:
`GET /%D1%81%D1%81%D1%8B%D0%BB%D0%BA%D0%B8` answers the same as `GET /ссылки`.

## The client in a tab

`client.flang` is the whole application: 453 lines, 32 functions, all total, 51
examples. The state is one record, «Стойка», of five fields. The handler is
pure: to a reply it returns the new state and the next order — «Показать»
(show), «Ждать событие» (wait for an event) or «Запросить» (request). So every
example runs without a browser and without a network:

```
flang test docs/examples/web/shortener-client/client.flang
```

```
docs/examples/web/shortener-client/client.flang: примеров 51, прошло 51, не прошло 0
```

`check --proof` on the client: 43 claims, 43 proved, no run-time checks. The
independent proof checker (`FLANG_CHECKER`) replayed 32 of the 43; the other 11
rest on the kernel's word.

The page is served by a stand, also written in flang:

```
sh docs/examples/web/build.sh
flang io docs/examples/web/stand.flang --max-orders 100000 --trust
```

`build.sh` translates `client.flang` into JavaScript next to the page; the
stand listens on `127.0.0.1:8908`. The page is
`http://127.0.0.1:8908/docs/examples/web/shortener-client/index.html`.

**The client is not connected to the service.** It requests `/ссылки` from the
address it was loaded from, that is, from the stand, and the stand answers 404
on that path. The service listens on another port, and what is listed above
stands in the way of calling it from the page: no CORS, the body length in
characters.

One more limit: the order «Показать» writes text to the screen, but the program
cannot write into an input field. After "clear" the program considers the field
empty while the field still holds the old text.

## Next

- [Write-ahead log](wal.html) — the log format and what is proved about it.
- [An application in the browser](browser-app.html) — an application built the same way, but with no service to call.
- [Where flang ends and the host begins](host-boundary.html) — what the program does and what `flang io` does.
