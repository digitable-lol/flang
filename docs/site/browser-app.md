# An application in the browser

"Hailstones" is an application in a browser tab, written in flang. Type a number with the digit
keys, press «пуск», and the number follows the Collatz rule: an even number is halved, an odd
one is multiplied by three plus one. «Шаг» advances one tick, «бег» keeps going until stopped.

A browser does not run flang: the program is printed into JavaScript, and the printed module is
what travels to the tab. The sources are in the repository, in `docs/examples/web/browser-app/`.

## Run it

From the root of a clone of the repository:

```sh
sh docs/examples/web/build.sh
flang io docs/examples/web/stand.flang --max-orders 100000 --trust
# open http://127.0.0.1:8908/docs/examples/web/browser-app/index.html
```

The first command prints the application into JavaScript next to the page (`flang emit --target
js --no-cli`); the second starts the stand, a flang program that serves files over HTTP. Neither
Node nor npm is needed. `--trust` is required: some of the stand's promises are checked on
examples rather than proved, and without the switch `flang io` does not run such a program.

In 0.7.34 the printer names a module with a Russian name `program.js` (91,788 bytes), while the
application page asks for `gradiny.js` and gets a 404 from the stand. Copy the printed file under
that name. The application was not exercised in an actual browser for this page.

## What it is made of

| what | where | lines |
|---|---|---:|
| the application: state, steps, screen | `docs/examples/web/browser-app/hailstone.flang` | 256 |
| markup, without a line of JavaScript | `docs/examples/web/browser-app/index.html` | 88 |
| the tab host, shared by every page | `flang/src/emit/js/flang_host_browser.js` | 1822 |
| the stand that serves the page | `docs/examples/web/stand.flang` | 395 |

The application has 16 functions, all total, and 31 examples:

```sh
$ flang check docs/examples/web/browser-app/hailstone.flang
модуль «Градины»: функций 16, из них с доказанным завершением 16; типов 5
$ flang test docs/examples/web/browser-app/hailstone.flang
docs/examples/web/browser-app/hailstone.flang: примеров 31, прошло 31, не прошло 0
```

The page attaches the host with one tag and names the module for it:

```html
<script type="module" src="../../../../flang/src/emit/js/flang_host_browser.js"
        данные-модуль="./gradiny.js"></script>
```

## How the program talks to the tab

The program is a `план`: a state, a starting function and a handler of responses.

```
план «Градины»
  состояние «Полёт»
  начинает с «Начать»
  обрабатывает «Дальше»
```

The handler does nothing itself. It receives the host's response and returns the next order:

| host response | what the program answers |
|---|---|
| «Пока ничего», «Показано» | show the screen, then wait for an event |
| «Случилось» with a source and a value | apply the key press to the state and show the screen |
| «Срок вышел» | take one step and show the screen |
| «Сбой» with a code and a message | finish with a refusal carrying the same code |

There are two orders. `«Показать» с место равным "экран" и текст равным …` puts text into the
place on the page marked with `данные-место`. `«Ждать событие» с срок равным 350` means "wake me
on a human action or after 350 ms, whichever comes first"; a term of 0 waits for the human only.
One wait thus covers both sources of events, buttons and the clock.

Three consequences of this design:

- **The program knows nothing about the DOM.** It names a place with a string of its own and
  hands over text. It does not build markup: the host does not use `innerHTML`.
- **Totality holds.** «Шаг градины» is a total function, while whether the whole Collatz
  sequence terminates is unknown. The step is repeated not by the program but by the human or
  the clock: non-termination lives in the host's loop.
- **The tab does not freeze.** While the program waits for an event the stack is empty; the
  host wakes it.

## Which targets print a plan

A program with a `план` declaration is printed by `c`, `go`, `js`, `python`, `rust` and `ts`.
Targets `cpp`, `csharp`, `elixir` and `java` refuse with `FLANG_PLAN_UNSUPPORTED`.

Next: [URL shortener](shortener.html) — a service with the same host;
[Where flang ends and the host begins](host-boundary.html).
