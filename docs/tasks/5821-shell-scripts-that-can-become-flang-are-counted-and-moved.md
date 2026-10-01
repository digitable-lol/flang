---
номер: 5821
заголовок: Оболочка переносится на flang — сначала перепись, кто обязан остаться оболочкой, потом перенос по одному с подлогом
статус: в работе (23 сентября 2026 перенесено семь: .sh в scripts/ 48 → 41; перепись — docs/shell-to-flang-census.md)
исполнитель: a
ветка: a/scripts-to-fscript
команда: вторая
карта: Что мешает больше всего
рядом: 1428, 1414, 1415
нужность: 2 — долг оболочки 88 файлов и 16 041 строка (docs/tree-inventory.md); язык зовёт процессы из 73 скриптов, то есть умеет, но перенос без переписи начнёт с тех, кому нельзя
---

# 5821. Оболочка → flang: перепись, потом перенос

Слова владельца (17 сентября 2026): оболочку переносить на flang, но сначала замерить,
что обязано остаться оболочкой.

## Чем измерено

Дерево `main` `cbfaf3899`, 17 сентября 2026.

- `git ls-files 'scripts/**/*.sh'` — 45 файлов; вне `scripts/` файлов `.sh/.mjs/.js/.py` — 89.
- Долг оболочки по `docs/tree-inventory.md:81` — 88 файлов, 16 041 строка (примета СНЯТО 2026-09-17).
- Задача 1428, часть 1: язык умеет процессы, доводы, среду, временные каталоги
  (23 поручения, `flang/self/parser.flang` ~6595); 73 скрипта на flang зовут `git`,
  `make`, `sh`. Принципиальных исключений там названо три: `scripts/bootstrap-c.sh`,
  `scripts/bootstrap-reprint.sh`, `scripts/seed/seed-refresh.sh` — они собирают сам двоичный.
- Чего у `flang io` нет (задача 1415, Ш1): доводов вызова, печати на экран
  (FLANG_IO_NO_SCREEN), кода возврата потомка (`ярлык`, шапка). Скрипт, которому это
  нужно, остаётся оболочкой, пока это так.

## Как поймём, что сделано

- В этой задаче — таблица по каждому из 45 + 89 файлов: «обязан остаться / переносим /
  почему» с признаком (зовётся до сборки двоичного; судит двоичный; нужны доводы,
  экран или код возврата; иное); числа по столбцам названы;
- назначен порог переноса N по замеру (сколько переносимых), перенесено ≥ N;
- каждый перенесённый: старый `.sh` снят, новый файл на flang зовётся из того же ярлыка/хука/работы,
  и есть проба «сторож красен на подлоге», показанная прогоном (код 1 на подлоге, 0 без);
- `bootstrap/flang run-script inventory:check` код 0 после пересъёмки `docs/tree-inventory.md`.

## Замер 17 сентября 2026 — что у `flang io` есть, а чего нет (18 прогонов)

Дерево `a/T-zadachi-17-09` = main `cbfaf3899` + `c4ada14bf`; двоичный `bootstrap/flang`
0.7.19, собранный `make -C bootstrap` из этого же дерева. Пробный файл — один модуль с
двенадцатью планами, по плану на поручение (лежал вне дерева, в `/srv/tmp/wT7-tmp/zamer/`);
каждая строка — свой прогон `bootstrap/flang io … --plan …`, снимались код возврата и
`result`.

| поручение / свойство | есть? | чем показано (№ прогона → код, ответ) |
|---|---|---|
| «Прочитать доводы» | НЕТ | №1 → код 0, `Сбой: FLANG_IO_UNKNOWN — хозяин не знает поручения «Прочитать доводы»` |
| доводы вызова (`--`, `--n=5`, `--args`) | НЕТ | №14–16 → код 2, `непонятный ключ` |
| «Прочитать переменную среды» | НЕТ | №2, №3, №17 → код 0, `FLANG_IO_UNKNOWN` (и на HOME, и на незаданной) |
| «Показать» (экран) | НЕТ | №4 → код 0, `FLANG_IO_NO_SCREEN — у двоичного хозяина нет экрана` |
| «Ждать событие» | НЕТ | №10 → код 0, тот же `FLANG_IO_NO_SCREEN` |
| «Запустить процесс» с кодом потомка | ЕСТЬ | №5 → `Процесс завершён: код 7, вывод «на-экран», ошибки «в-ошибки»` — код потомка и оба потока доезжают до плана |
| код возврата `flang io` наружу | только 0/1/3 | №6: потомок ответил 7, план сдался — код 1; №11: «Не проверено» — код 3; конец работы — 0. Чужой код возврата наружу не пробрасывается |
| «Запустить процесс с вводом» | НЕТ | №7 → `FLANG_IO_UNKNOWN — хозяин не знает поручения «Запустить процесс с вводом»` |
| «Завести временный каталог» + «Удалить файл» | ЕСТЬ | №8 → `Заведено: zamer-58211LUmar; потом Убрано` (2 поручения) |
| «Перечислить каталог» | ЕСТЬ | №9 → `Перечислено: 1 имён` |
| срок потомка (`--timeout`) | ЕСТЬ | №12: `sleep 3` при `--timeout 500` → `Процесс убит: сигнал SIG9`; №13: без ключа (30 000 мс) → `код 0` |
| живой вывод потомка | НЕТ (копится) | №18: потомок печатает строку, спит 2 с, печатает вторую — первый байт ответа через 2556 мс, одной строкой JSON |

Расхождение между 1428 («доводы, среда, ввод — в языке ЕСТЬ») и 1415/шапками `ярлык` и
`flangrc.sh` («у `flang io` их НЕТ») снято: **обе стороны правы о разном**. Словарь
(`flang/self/parser.flang`, 22 поручения) эти слова знает — и сам же пишет над ними
«ВВЕДЕНО, И НИГДЕ НЕ ПРИМЕНЕНО»; хозяин 0.7.19 на них отвечает `FLANG_IO_UNKNOWN`. Для
переноса решает хозяин, а не словарь.

Отсюда правило переписи ниже: скрипт **обязан остаться оболочкой**, если ему нужен хотя бы
один из четырёх отсутствующих каналов — довод вызова, переменная среды, экран/живой вывод,
чужой код возврата наружу, — либо он стоит до сборки двоичного, судит или собирает его,
либо зовёт библиотеку на Node/Python (её пришлось бы переносить первой). Переменная среды
считается доводом: это тот же выбор «над чем работать», только без черты (так же рассуждает
шапка `scripts/flangrc.sh`).

## Перепись 134 файлов (45 в `scripts/` + 89 вне)

Списки — ровно по командам из «Чем измерено»; строки — `wc -l` на этом дереве. Вне 89
остались ещё 24 файла с кириллическими именами (`flang/proof/**` — 16, `flang/test/обход*.sh`
и `владение-состоянием.sh` — 4, `docs/benchmarks/verdict-cache/*` — 4, `flang/scripts/*.py` — 2):
команда замера их не видит, потому что `git ls-files` без `core.quotePath=false` печатает такие
пути в кавычках; в таблицу они не входят, и это названо, а не спрятано.

| # | файл | строк | вердикт | почему | кто зовёт (по коду и CI; упоминания в прозе не считаны) |
|---:|---|---:|---|---|---|
| 1 | `scripts/bootstrap-c.sh` | 206 | остаётся | собирает двоичный (cc, вторая печать) | scripts/bootstrap-reprint.sh, scripts/seed/build-ledger-binary.fscript |
| 2 | `scripts/cell-work-preserved.sh` | 97 | остаётся | нужна среда: FLANG_CELLS — «Прочитать переменную среды» хозяин не знает (прогон №2); на этой машине код 3 (клонов ячеек нет) | никто (0) |
| 3 | `scripts/flangrc.sh` | 241 | остаётся | нужны доводы (ключ, --от DIR, --дом DIR) и среда HOME — записано в шапке | ярлыки.flang, flangrc-guard.sh, version-derivations-guard.sh, bump-version.sh, flang/bin/flangtutor |
| 4 | `scripts/flangtutor-proba.sh` | 241 | остаётся | зона 1428 (переименование в tutor-probe.sh) | никто (0) |
| 5 | `scripts/guards/bad-octet-guard.sh` | 340 | остаётся | негодные октеты приезжают только снаружи — литерал языка их не несёт (шапка); зовёт тулчейны девяти целей (node, python3, cc) | ярлыки.flang (bad-octet:check, bad-octet:corrupt) |
| 6 | `scripts/guards/criterion-score-guard.sh` | 85 | остаётся | нужен довод — путь к документу (ФАЙЛ) | ярлыки.flang (criterion:score) |
| 7 | `scripts/guards/cyrillic-file-names-guard.sh` | 61 | остаётся | зовётся до сборки двоичного: хук pre-push и работа kirillica (ci.yml) без сборки | .githooks/pre-push, ci.yml, ярлыки.flang |
| 8 | `scripts/guards/flangrc-guard.sh` | 238 | остаётся | зовётся до сборки: работа nastroyki (ci.yml) без сборки; доводы --корень DIR, --читатель FILE | ci.yml, ярлыки.flang |
| 9 | `scripts/guards/hand-written-lists.sh` | 376 | переносим позже | доводов нет (режимы --check/--targets → планы), но сторож красен по делу: код 1 за 12,8 с — новых 59, мёртвых 29; «0 без подлога» показать нельзя, пока долг не закрыт | ярлыки.flang (hand-written-lists:census, hand-written-lists:check) |
| 10 | `scripts/guards/kto-zovet-storozhey.sh` | 269 | остаётся | зовётся до сборки (хук); зона 1428 | .githooks/pre-push, ci.yml, ярлыки.flang, storozha-bez-podloga.sh |
| 11 | `scripts/guards/module-origin-guard.sh` | 279 | остаётся | читает среду FLANG_MODULE_DIR и FLANG_BINARY (py-программа внутри); довод --корень DIR; красен по месту: код 1 за 0,5 с (чужой /srv/tmp/json.baseline.flang выше корня) | ярлыки.flang (module-origin:check, module-origin:forgery) |
| 12 | `scripts/guards/no-comments-guard.sh` | 123 | ПЕРЕНОСИМ | доводов нет (режим --снять → второй план); зелен: код 0 — 39 624 строк в 567 файлах; временный каталог не нужен | никто (0) |
| 13 | `scripts/guards/one-string-measure-guard.sh` | 119 | остаётся | сырые октеты кладёт printf снаружи, литерал их не несёт (шапка «Почему оболочка») | никто (0; string-measure.flang называет его в шапке) |
| 14 | `scripts/guards/overlong-string-guard.sh` | 327 | остаётся | судит двоичный и его печать («судья не может исполняться подсудимым» — не долг по описи) | ci.yml, reprint.yml |
| 15 | `scripts/guards/pol-dokazannogo-sverka.sh` | 139 | остаётся | зовётся до сборки (хук); binary.yml; зона 1428 | .githooks/pre-push, binary.yml |
| 16 | `scripts/guards/prose-numbers-guard.sh` | 416 | остаётся | зовётся до сборки: хук и работа proza (ci.yml) без сборки | .githooks/pre-push, ci.yml |
| 17 | `scripts/guards/published-vs-tree.sh` | 803 | остаётся | зовётся без сборки: работа published (binary.yml); восемь режимов | binary.yml, ярлыки.flang |
| 18 | `scripts/guards/seed-knows-type-words-guard.sh` | 311 | остаётся | зовётся без сборки: работа semya (ci.yml); судит семя; доводы ФАЙЛ… | ci.yml, ярлыки.flang |
| 19 | `scripts/guards/seed-parses-sources-guard.sh` | 220 | остаётся | судит семя: собирает разборщик из bootstrap/ (cc) и гоняет по исходникам | никто (только упоминания в ci.yml и шапках) |
| 20 | `scripts/guards/storozha-bez-podloga.sh` | 323 | остаётся | зовётся до сборки (хук); зона 1428 | .githooks/pre-push, binary.yml, ci.yml, install-path.yml, release.yml |
| 21 | `scripts/guards/task-numbers-guard.sh` | 284 | остаётся | по замыслу без двоичного (шапка: «ни двоичного, ни git») — зовётся на свежем клоне до сборки | ярлыки.flang (tasks:numbers, tasks:numbers:forgery) |
| 22 | `scripts/guards/version-derivations-guard.sh` | 175 | остаётся | зовётся до сборки (хук) | .githooks/pre-push, .flangrc, bump-version.sh |
| 23 | `scripts/guards/what-blocks-inventory-guard.sh` | 160 | ПЕРЕНОСИМ | доводов нет (режим --print → второй план); зелен: код 0 — рядов 6; один зовущий | ярлыки.flang (what-blocks:check); ci.yml зовёт ярлык |
| 24 | `scripts/ledgers/take-proof-ledger.sh` | 106 | остаётся | нужен довод ФАЙЛ; среда DVOICHNYY/PAMYAT/PIK; зовёт python3-счёт доли | никто (0; proved-share-ledger.txt упоминает) |
| 25 | `scripts/memory-headroom.sh` | 252 | остаётся | доводы (--следить, --отчёт --итог) и фоновый процесс на всю работу CI | binary.yml |
| 26 | `scripts/memory-limit.sh` | 259 | остаётся | доводы (-- команда), пробрасывает код возврата (137) наружу | postcondition-pairs.sh, target-census.sh |
| 27 | `scripts/bootstrap-reprint.sh` | 3513 | остаётся | собирает двоичный (точка раскрутки); вне задачи | ярлык, хук, все работы CI (54 файла) |
| 28 | `scripts/release/bump-version.sh` | 173 | остаётся | нужен довод — новая версия | ярлыки.flang (версия) |
| 29 | `scripts/repl-proba.sh` | 303 | остаётся | зона 1428; проба REPL через терминал (экран) | никто (0; flang_repl.c упоминает) |
| 30 | `scripts/seed/binary-origin.fscript` | 549 | остаётся | судит двоичный: сверка происхождения и пересборка (cc); доводы -- команда | binary.yml, seed-freshness.fscript |
| 31 | `scripts/seed/build-ledger-binary.fscript` | 171 | остаётся | собирает двоичный (cc) для ведомостей; довод каталог | take-proof-ledger.sh |
| 32 | `scripts/seed/chto-otstalo-ot-semeni.sh` | 177 | остаётся | зона 1428; отчёт об отставании семени | никто (хук упоминает как «не сторож») |
| 33 | `scripts/seed/new-binary-acceptance.fscript` | 232 | остаётся | приёмка нового двоичного (судит двоичный); довод путь к дереву | ярлыки.flang, binary-origin.fscript |
| 34 | `scripts/seed/pechat-povtorima.sh` | 314 | остаётся | зона 1428; судит печать (две печати) | binary.yml, reprint.yml |
| 35 | `scripts/seed/print-progress.sh` | 158 | остаётся | идёт во время печати семени, до двоичного (reprint.yml) | reprint.yml, two-prints-identical.fscript |
| 36 | `scripts/seed/seed-freshness.fscript` | 197 | остаётся | судит семя (свежесть) — зовётся из `ярлык` до всякого плана; доводы --chto, -- команда | ярлык, bootstrap-reprint.sh, binary-origin.fscript, published-vs-tree.sh |
| 37 | `scripts/seed/semya-osvezhit.sh` | 273 | остаётся | собирает двоичный (пересев); хук до сборки; зона 1428 | .githooks/pre-push, ярлыки.flang |
| 38 | `scripts/seed/semya-rantayma-eto-istochnik.sh` | 108 | остаётся | зовётся до сборки (хук); зона 1428 | .githooks/pre-push, semya-osvezhit.sh |
| 39 | `scripts/seed/two-prints-identical.fscript` | 226 | остаётся | судит печать; доводы — два каталога | binary.yml, reprint.yml, pechat-povtorima.sh |
| 40 | `scripts/targets/identical-declarations.sh` | 118 | остаётся | зовёт node-библиотеку (link-collision-guard.mjs, «замыкание») и jq; среда FLANG; сегодня не сходится: за 300 с не кончился, jq: parse error | никто (0) |
| 41 | `scripts/targets/target-census.sh` | 214 | остаётся | py-разбор JSON дерева (python3, json); довод каталог; зовёт memory-limit.sh | никто (0) |
| 42 | `scripts/targets/target-collisions.sh` | 337 | остаётся | среда FLANG и KARTA; зовёт names-in-c.awk (awk-программа дерева) и jq | никто (0) |
| 43 | `scripts/targets/targets-inventory.sh` | 79 | остаётся | доводы (имена целей); среда VOROTA/PAMYAT/VYVOD; зовёт ворота | никто (0) |
| 44 | `scripts/test-remote.sh` | 149 | остаётся | доводы (--info/--shell/--sync), среда FLANG_REMOTE, ssh и терминал | ярлыки.flang (tests:remote) |
| 45 | `scripts/provability.fscript` | 321 | остаётся | зона 1428 (переименование в provability-gate.sh); гейт доказуемости — судит чекер и сверщика | ярлыки.flang (доказуемость), ХРАПОВИК, proverka-dereva.sh |
| 46 | `docs/benchmarks/proof-cost/postcondition-pairs.sh` | 57 | остаётся | доводы (двоичные A/B, файл); зовёт memory-limit.sh | никто (0) |
| 47 | `docs/benchmarks/speed/arena.sh` | 37 | остаётся | довод (каталог сборки); замер памяти | flang/scripts/memory-guard.flang |
| 48 | `docs/benchmarks/speed/assemble.sh` | 110 | остаётся | доводы; python3 для правки напечатанного C | .gitignore, docs/benchmarks/speed/memory.flang, docs/benchmarks/speed/work.mjs |
| 49 | `docs/benchmarks/speed/probe.sh` | 17 | остаётся | доводы (БИНАРНИК ФУНКЦИЯ ЗАДАЧА РАЗМЕР) | docs/examples/web/browser-probe.sh, ярлыки.flang |
| 50 | `docs/benchmarks/speed/programs/tasks.mjs` | 181 | не долг по описи | замеряемый материал: то, с чем сравнивают | docs/benchmarks/speed/memory.flang, docs/benchmarks/speed/probe.sh, docs/benchmarks/speed/programs/tasks.flang … (4) |
| 51 | `docs/benchmarks/speed/programs/tasks.py` | 218 | не долг по описи | замеряемый материал: то, с чем сравнивают | docs/benchmarks/speed/memory.flang, docs/benchmarks/speed/probe.sh, docs/benchmarks/speed/programs/tasks.flang … (6) |
| 52 | `docs/benchmarks/speed/work.mjs` | 158 | JavaScript — считается отдельно (docs/javascript-inventory.md) | замер времени работы на восьми сборках | никто (0) |
| 53 | `docs/editors/vim/checks/stream.sh` | 60 | остаётся | открытый ввод и фоновый процесс (поток ответов сервера); довод | scripts/editors/lsp-check.flang |
| 54 | `docs/editors/vim/checks/tohtml.sh` | 41 | остаётся | гоняет настоящий Vim (:TOhtml); доводы | scripts/editors/vim-highlight-check.flang |
| 55 | `docs/editors/vim/checks/vim8.sh` | 36 | остаётся | среда FLANG_VIM_LSP; настоящий Vim | scripts/editors/lsp-check.flang |
| 56 | `docs/editors/vscode/extension.js` | 46 | не долг по описи | чужая среда: клиент VS Code пишется на JS | docs/editors/vscode/package.json |
| 57 | `docs/examples/frameworks/nestjs-orders/printed/flang_cli.js` | 560 | не долг по описи | напечатано компилятором — его вывод, не работа для него | .github/workflows/ci.yml, bootstrap/compiler_flang.c, bootstrap/flang_repl.c … (28) |
| 58 | `docs/examples/frameworks/nestjs-orders/printed/orders_api.js` | 1437 | не долг по описи | напечатано компилятором — его вывод, не работа для него | docs/examples/frameworks/nestjs-orders/printed/flang_cli.js, docs/examples/frameworks/nestjs-orders/src/orders.controller.ts |
| 59 | `docs/examples/frameworks/react-invoice/printed/cart_service.js` | 698 | не долг по описи | напечатано компилятором — его вывод, не работа для него | docs/examples/frameworks/react-invoice/printed/flang_cli.js, docs/examples/frameworks/react-invoice/src/App.tsx |
| 60 | `docs/examples/frameworks/react-invoice/printed/flang_cli.js` | 560 | не долг по описи | напечатано компилятором — его вывод, не работа для него | .github/workflows/ci.yml, bootstrap/compiler_flang.c, bootstrap/flang_repl.c … (28) |
| 61 | `docs/examples/frameworks/react-ts-pure/printed/flang_cli.js` | 560 | не долг по описи | напечатано компилятором — его вывод, не работа для него | .github/workflows/ci.yml, bootstrap/compiler_flang.c, bootstrap/flang_repl.c … (28) |
| 62 | `docs/examples/frameworks/react-ts-pure/printed/storefront.js` | 1021 | не долг по описи | напечатано компилятором — его вывод, не работа для него | docs/examples/frameworks/react-ts-pure/printed/flang_cli.js, docs/examples/frameworks/react-ts-pure/src/App.tsx, docs/examples/frameworks/react-ts-pure/src/Itogi.tsx … (4) |
| 63 | `docs/examples/frameworks/vue-roman/printed/flang_cli.js` | 560 | не долг по описи | напечатано компилятором — его вывод, не работа для него | .github/workflows/ci.yml, bootstrap/compiler_flang.c, bootstrap/flang_repl.c … (28) |
| 64 | `docs/examples/frameworks/vue-roman/printed/roman_numerals.js` | 545 | не долг по описи | напечатано компилятором — его вывод, не работа для него | docs/examples/frameworks/vue-roman/printed/flang_cli.js, docs/examples/frameworks/vue-roman/src/App.vue |
| 65 | `docs/examples/host-boundary/run.sh` | 54 | ПЕРЕНОСИМ | доводов нет; зовёт flang emit и cc (вне scripts/, в N не входит) | .github/workflows/binary.yml, docs/examples/host-boundary/host.c, flang/translation/matcher.c … (5) |
| 66 | `docs/examples/web/browser-probe.sh` | 242 | остаётся | поднимает сервер и браузер в фоне, ждёт порт; доводы | ярлыки.flang |
| 67 | `docs/examples/web/build.sh` | 63 | ПЕРЕНОСИМ | доводов нет; зовёт flang emit --target js и node (вне scripts/, в N не входит) | .gitignore, docs/examples/web/browser-app/index.html, docs/examples/web/browser-probe.sh … (7) |
| 68 | `docs/examples/web/wasm/build.sh` | 73 | остаётся | довод (файл .flang); clang wasm32 | .gitignore, docs/examples/web/browser-app/index.html, docs/examples/web/browser-probe.sh … (6) |
| 69 | `docs/examples/web/wasm/probe.mjs` | 66 | JavaScript — считается отдельно (docs/javascript-inventory.md) | прогон в браузере | docs/examples/web/browser-probe.sh, scripts/guards/published-vs-tree.sh |
| 70 | `docs/ifl/measure-across-targets.sh` | 127 | остаётся | доводы (каталог, --fast); тулчейны девяти целей | docs/ifl/reproduce.sh, scripts/guards/bad-octet-guard.sh |
| 71 | `docs/ifl/reproduce.sh` | 135 | остаётся | доводы (--fast); node и python3 | scripts/guards/file-extensions.flang |
| 72 | `docs/site/build.mjs` | 1069 | JavaScript — считается отдельно (docs/javascript-inventory.md) | сборка сайта на Node | .github/workflows/ci.yml, .github/workflows/pages.yml, .gitignore … (12) |
| 73 | `docs/site/diagram.mjs` | 410 | JavaScript — считается отдельно (docs/javascript-inventory.md) | сборка сайта на Node | docs/site/markdown.mjs, docs/site/style.css |
| 74 | `docs/site/lib/surface-pair.mjs` | 267 | JavaScript — считается отдельно (docs/javascript-inventory.md) | сборка сайта на Node | docs/site/surfaces-run.mjs |
| 75 | `docs/site/markdown.mjs` | 342 | JavaScript — считается отдельно (docs/javascript-inventory.md) | сборка сайта на Node | docs/site/build.mjs, docs/site/diagram.mjs, docs/site/podsvetka.mjs … (5) |
| 76 | `docs/site/numbers.mjs` | 107 | JavaScript — считается отдельно (docs/javascript-inventory.md) | сборка сайта на Node | .github/workflows/binary.yml, docs/site/build.mjs, docs/site/numbers.json … (9) |
| 77 | `docs/site/podsvetka.mjs` | 333 | JavaScript — считается отдельно (docs/javascript-inventory.md) | сборка сайта на Node | .github/workflows/pages.yml, docs/site/build.mjs, docs/site/markdown.mjs … (4) |
| 78 | `docs/site/poisk-proverka.mjs` | 175 | JavaScript — считается отдельно (docs/javascript-inventory.md) | сборка сайта на Node | docs/site/build.mjs, scripts/guards/file-extensions.flang, scripts/guards/published-vs-tree.sh |
| 79 | `docs/site/poisk.js` | 355 | JavaScript — считается отдельно (docs/javascript-inventory.md) | сборка сайта на Node | docs/site/build.mjs, docs/site/poisk-proverka.mjs, docs/site/poisk.mjs … (5) |
| 80 | `docs/site/poisk.mjs` | 111 | JavaScript — считается отдельно (docs/javascript-inventory.md) | сборка сайта на Node | docs/site/build.mjs |
| 81 | `docs/site/site-numbers.mjs` | 549 | JavaScript — считается отдельно (docs/javascript-inventory.md) | сборка сайта на Node | .github/workflows/binary.yml, docs/site/numbers.json, docs/site/numbers.mjs … (8) |
| 82 | `docs/site/sitemap.mjs` | 546 | JavaScript — считается отдельно (docs/javascript-inventory.md) | сборка сайта на Node | .github/workflows/ci.yml, docs/site/build.mjs, scripts/guards/prose-numbers-guard.sh |
| 83 | `docs/site/surfaces-run.mjs` | 368 | JavaScript — считается отдельно (docs/javascript-inventory.md) | сборка сайта на Node | docs/site/site-numbers.mjs, scripts/site/surfaces-page.flang, ярлыки.flang |
| 84 | `docs/tools/binder-goal-share.py` | 169 | остаётся | доводы (sys.argv — пути ведомостей); py-разбор JSON | никто (0) |
| 85 | `docs/tools/binder-rule-reach.py` | 242 | остаётся | довод (sys.argv); py-разбор JSON | никто (0) |
| 86 | `flang/concurrency/bench/assemble.sh` | 26 | остаётся | доводы ($1 вид, размеры); source common.sh | .gitignore, docs/benchmarks/speed/assemble.sh, docs/benchmarks/speed/memory.flang … (4) |
| 87 | `flang/concurrency/bench/by-cores.sh` | 44 | остаётся | доводы; source common.sh | никто (0) |
| 88 | `flang/concurrency/bench/chain.sh` | 6 | остаётся | доводы ($1 каталог, $2 пробегов, $3 повторов) | никто (0) |
| 89 | `flang/concurrency/bench/common.sh` | 13 | остаётся | библиотека оболочки (source) для остальных стендов — уходит вместе с ними | flang/concurrency/bench/assemble.sh, flang/concurrency/bench/by-cores.sh, flang/concurrency/bench/chain.sh … (14) |
| 90 | `flang/concurrency/bench/cores.sh` | 20 | остаётся | довод; source common.sh | никто (0) |
| 91 | `flang/concurrency/bench/delivery.sh` | 26 | остаётся | доводы; source common.sh | никто (0) |
| 92 | `flang/concurrency/bench/gen.mjs` | 351 | JavaScript — считается отдельно (docs/javascript-inventory.md) | генератор стендов | flang/concurrency/bench/assemble.sh |
| 93 | `flang/concurrency/bench/hot-swap.sh` | 82 | остаётся | зовёт node (хозяин узла на JS) пятью вызовами | flang/self/emit-js.flang |
| 94 | `flang/concurrency/bench/how-many.sh` | 28 | остаётся | доводы; source common.sh | никто (0) |
| 95 | `flang/concurrency/bench/leak.sh` | 11 | остаётся | доводы ($1 каталог, числа пробегов) | никто (0) |
| 96 | `flang/concurrency/bench/limit.sh` | 11 | остаётся | доводы ($1 каталог, $2 пробегов, пределы) | docs/benchmarks/proof-cost/postcondition-pairs.sh, flang/scripts/binary.mjs, scripts/memory-limit.sh … (4) |
| 97 | `flang/concurrency/bench/measure.sh` | 37 | остаётся | доводы ($1…$4) | flang/concurrency/bench/chain.sh, flang/concurrency/bench/delivery.sh, flang/concurrency/bench/leak.sh … (6) |
| 98 | `flang/concurrency/bench/memory.sh` | 8 | остаётся | довод; source common.sh | никто (0) |
| 99 | `flang/concurrency/bench/node-death-targets.mjs` | 147 | JavaScript — считается отдельно (docs/javascript-inventory.md) | прогон по восьми целям | никто (0) |
| 100 | `flang/concurrency/bench/node-death.sh` | 205 | остаётся | доводы; node и python3 (два узла, сокет, SIGKILL) | flang/concurrency/bench/node-death-targets.mjs, flang/concurrency/scheduler.flang, flang/self/emit-js.flang |
| 101 | `flang/concurrency/bench/slope.sh` | 14 | остаётся | доводы ($1…$5) | flang/concurrency/bench/delivery.sh |
| 102 | `flang/concurrency/bench/swarm.sh` | 24 | остаётся | доводы; source common.sh | никто (0) |
| 103 | `flang/concurrency/bench/threshold.sh` | 78 | остаётся | доводы; python3 | никто (0) |
| 104 | `flang/concurrency/bench/twin.sh` | 67 | остаётся | доводы; python3 | никто (0) |
| 105 | `flang/concurrency/bench/valgrind.sh` | 10 | остаётся | доводы ($1 каталог, $2 пробегов); valgrind | никто (0) |
| 106 | `flang/concurrency/bin/node.js` | 735 | не долг по описи | код на стороне цели: хозяин узла пишется на языке цели | .github/workflows/target-twins.yml, bootstrap/flang_repl.c, docs/release-notes.json … (13) |
| 107 | `flang/concurrency/bin/node.py` | 603 | не долг по описи | код на стороне цели: хозяин узла пишется на языке цели | flang/concurrency/bench/node-death.sh, flang/concurrency/bin/node.ex, flang/concurrency/bin/node.js … (8) |
| 108 | `flang/concurrency/bin/peer.py` | 245 | не долг по описи | код на стороне цели: хозяин узла пишется на языке цели | flang/concurrency/bin/node.py |
| 109 | `flang/concurrency/bin/wire.mjs` | 159 | JavaScript — считается отдельно (docs/javascript-inventory.md) | провод между узлами (сторона цели js) | никто (0) |
| 110 | `flang/scripts/binary.mjs` | 848 | JavaScript — считается отдельно (docs/javascript-inventory.md) | сторож/прибор на Node | .github/workflows/pages.yml, docs/site/podsvetka.mjs, docs/site/surfaces-run.mjs … (12) |
| 111 | `flang/scripts/count-guard.mjs` | 980 | JavaScript — считается отдельно (docs/javascript-inventory.md) | сторож/прибор на Node | flang/scripts/word-guard.mjs, scripts/guards/file-extensions.flang, scripts/shortcut-collector.flang … (5) |
| 112 | `flang/scripts/direct-run.mjs` | 55 | JavaScript — считается отдельно (docs/javascript-inventory.md) | сторож/прибор на Node | docs/examples/frameworks/nestjs-orders/printed/flang_cli.js, docs/examples/frameworks/react-invoice/printed/flang_cli.js, docs/examples/frameworks/react-ts-pure/printed/flang_cli.js … (17) |
| 113 | `flang/scripts/link-collision-guard.mjs` | 1101 | JavaScript — считается отдельно (docs/javascript-inventory.md) | сторож/прибор на Node | .github/workflows/binary.yml, bootstrap/flang_repl.c, flang/proof/midpoint-verdicts.flang … (11) |
| 114 | `flang/scripts/name-guard.mjs` | 533 | JavaScript — считается отдельно (docs/javascript-inventory.md) | сторож/прибор на Node | scripts/guards/file-extensions.flang, ярлыки.flang |
| 115 | `flang/scripts/per-file-proof-share.py` | 138 | остаётся | доводы (sys.argv); py-разбор JSON ведомости | docs/tools/binder-goal-share.py |
| 116 | `flang/scripts/proof-ledger.mjs` | 786 | JavaScript — считается отдельно (docs/javascript-inventory.md) | сторож/прибор на Node | docs/site/numbers.mjs, docs/site/site-numbers.mjs, flang/proof/examples/corpus-lists.flang … (17) |
| 117 | `flang/scripts/word-guard.mjs` | 706 | JavaScript — считается отдельно (docs/javascript-inventory.md) | сторож/прибор на Node | flang/scripts/kernel-forgeries.flang, flang/scripts/proof-ledger.mjs, flang/scripts/proof-words.json … (6) |
| 118 | `flang/scripts/word-occupancy.mjs` | 305 | JavaScript — считается отдельно (docs/javascript-inventory.md) | сторож/прибор на Node | flang/self/parser.flang, scripts/guards/file-extensions.flang, ярлыки.flang |
| 119 | `flang/src/emit/js/flang_cli.js` | 556 | не долг по описи | рантайм цели печати: уезжает в напечатанную программу дословно | .github/workflows/ci.yml, bootstrap/compiler_flang.c, bootstrap/flang_repl.c … (28) |
| 120 | `flang/src/emit/js/flang_conc.js` | 678 | не долг по описи | рантайм цели печати: уезжает в напечатанную программу дословно | bootstrap/flang_repl.c, flang/self/bootstrap/compiler.flang, flang/self/bootstrap/emit-from-source.flang … (7) |
| 121 | `flang/src/emit/js/flang_host_browser.js` | 397 | не долг по описи | рантайм цели печати: уезжает в напечатанную программу дословно | docs/examples/web/browser-app/index.html, docs/examples/web/shortener-client/index.html, flang/src/emit/js/flang_host_node.js … (6) |
| 122 | `flang/src/emit/js/flang_host_node.js` | 509 | не долг по описи | рантайм цели печати: уезжает в напечатанную программу дословно | bootstrap/flang_repl.c, docs/release-notes.json, flang/src/emit/c/flang_repl.c … (4) |
| 123 | `flang/src/emit/js/flang_io.js` | 261 | не долг по описи | рантайм цели печати: уезжает в напечатанную программу дословно | bootstrap/flang_repl.c, flang/self/bootstrap/emit-from-source.flang, flang/src/emit/c/flang_repl.c … (8) |
| 124 | `flang/src/emit/python/flang_cli.py` | 292 | не долг по описи | рантайм цели печати: уезжает в напечатанную программу дословно | .github/workflows/ci.yml, bootstrap/compiler_flang.c, bootstrap/flang_repl.c … (19) |
| 125 | `flang/src/emit/python/flang_io.py` | 264 | не долг по описи | рантайм цели печати: уезжает в напечатанную программу дословно | bootstrap/flang_repl.c, docs/release-notes.json, flang/src/emit/c/flang_repl.c … (4) |
| 126 | `flang/src/emit/python/flang_runtime.py` | 1527 | не долг по описи | рантайм цели печати: уезжает в напечатанную программу дословно | bootstrap/compiler_flang.c, bootstrap/flang_repl.c, flang/concurrency/bin/node.py … (7) |
| 127 | `flang/test/glob.mjs` | 127 | JavaScript — считается отдельно (docs/javascript-inventory.md) | проверки на node --test | flang/scripts/count-guard.mjs, flang/scripts/proof-ledger.mjs, flang/scripts/word-occupancy.mjs … (8) |
| 128 | `flang/test/nadzor-uzla.test.mjs` | 225 | JavaScript — считается отдельно (docs/javascript-inventory.md) | проверки на node --test | flang/scripts/tempdir-guard.flang, flang/test/uzel-osnastka.mjs |
| 129 | `flang/test/planirovshchik-celi.test.mjs` | 334 | JavaScript — считается отдельно (docs/javascript-inventory.md) | проверки на node --test | flang/scripts/tempdir-guard.flang |
| 130 | `flang/test/svyaz-celi.test.mjs` | 269 | JavaScript — считается отдельно (docs/javascript-inventory.md) | проверки на node --test | flang/concurrency/bin/peer.py, flang/scripts/tempdir-guard.flang, flang/test/planirovshchik-celi.test.mjs |
| 131 | `flang/test/tempdir.mjs` | 171 | JavaScript — считается отдельно (docs/javascript-inventory.md) | проверки на node --test | flang/concurrency/bench/node-death-targets.mjs, flang/scripts/tempdir-guard.flang, flang/test/nadzor-uzla.test.mjs … (6) |
| 132 | `flang/test/toolchain-guard.mjs` | 90 | JavaScript — считается отдельно (docs/javascript-inventory.md) | проверки на node --test | .github/workflows/ci.yml, flang/concurrency/bench/node-death-targets.mjs, flang/test/nadzor-uzla.test.mjs … (6) |
| 133 | `flang/test/uzel-osnastka.mjs` | 257 | JavaScript — считается отдельно (docs/javascript-inventory.md) | проверки на node --test | flang/concurrency/bench/node-death-targets.mjs, flang/self/emit-js.flang, flang/test/nadzor-uzla.test.mjs |
| 134 | `flang/translation/run.sh` | 165 | остаётся | независимый сличитель перевода: судья не на языке подсудимого (не долг по описи); доводы | .github/workflows/binary.yml, docs/examples/host-boundary/host.c, docs/examples/host-boundary/run.sh … (5) |

Итоги по столбцу «вердикт» (строк 134 = 45 + 89):

| вердикт | среди 45 в `scripts/` | среди 89 вне | всего |
|---|---:|---:|---:|
| остаётся | 42 | 33 | 75 |
| ПЕРЕНОСИМ | 2 | 2 | 4 |
| переносим позже (красен по делу) | 1 | 0 | 1 |
| JavaScript — считается отдельно | 0 | 32 | 32 |
| не долг по описи (напечатанное, рантайм, сторона цели, материал, чужая среда) | 0 | 22 | 22 |
| строк всего | 14062 | 27229 | 41291 |

**Порог N = 2** — столько «ПЕРЕНОСИМ» среди `scripts/**/*.sh` вне списка 1428 (девять
транслитных имён и `provability.fscript` в перенос не берутся — их переименовывает 1428).
Порядок переноса — от меньшего с одним зовущим:

1. `scripts/guards/no-comments-guard.sh` — 123 строки, зовущих 0;
2. `scripts/guards/what-blocks-inventory-guard.sh` — 160 строк, зовущий один (ярлык
   `what-blocks:check`, его зовёт работа `uncalled-guards` в `ci.yml`).

Третий кандидат без принципиальной преграды — `scripts/guards/hand-written-lists.sh`
(376 строк) — красен по делу (новых расхождений 59, мёртвых записей 29), и «0 без подлога»
на нём показать нельзя; он переносится после того, как долг перечней закрыт.

Что бы сдвинуло перепись, числом: поручение «Прочитать переменную среды» у хозяина освободило
бы ещё 4 файла в `scripts/` (`cell-work-preserved.sh`, `target-collisions.sh`,
`module-origin-guard.sh` — тот ещё и красен по месту, `identical-declarations.sh` — тот ещё
и зовёт Node); «Прочитать доводы» (4143, шаг 3) — ещё 7 (`criterion-score-guard.sh`,
`take-proof-ledger.sh`, `targets-inventory.sh`, `bump-version.sh`, `flangrc.sh`,
`memory-limit.sh`, `test-remote.sh`; у последних трёх сверх довода нужен ещё и чужой код
возврата или терминал).

## Чего задача НЕ делает

Не трогает `scripts/bootstrap-reprint.sh`, `scripts/seed-fingerprint`, `bootstrap/**`, `flang/self/**`,
`flang/proof/**`. Расширение перенесённого файла — по решению задачи 1415.


## Доводы из шапок двух переведённых сторожей (сняты 18 сентября 2026)

Переводя сторожа с оболочки на flang, шапку в код не переносят: в `.flang` и
`.fscript` комментариев не пишут. Ниже — 29 строк, стоявших комментариями в
`scripts/guards/no-comments-guard.fscript` и
`scripts/guards/what-blocks-inventory-guard.fscript`:

```
  SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
  SPDX-License-Identifier: BSD-2-Clause
  
  Комментариев в .flang не прибавляется — храповик по файлу долга
  scripts/ledgers/no-comments-debt.tsv (файл<TAB>число[<TAB>причина]); число
  поднимают только рукой и только с причиной, «Снять» умеет лишь уменьшать.
  
  bootstrap/flang io scripts/guards/no-comments-guard.fscript --plan Проверка   не прибавилось ли
  bootstrap/flang io scripts/guards/no-comments-guard.fscript --plan Снять      переписать долг ПОСЛЕ чистки
  bootstrap/flang io scripts/guards/no-comments-guard.fscript --plan Подлог     сторож краснеет на подлоге долга
  
  Коды: 0 — не прибавилось (или долг переписан вниз); 1 — прибавилось, файлы
  названы с числами; 3 — не проверено: файла долга нет либо .flang в дереве не найдено.
  Почему храповик, а не запрет, и где его граница — docs/guide/how-to-write-flang.ru.md.
  SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
  SPDX-License-Identifier: BSD-2-Clause
  
  Столбец «в стволе» таблицы «Где что лежит» (docs/what-blocks-1-0.md) не пишется
  руками: он сверяется с деревом, и расхождение красит. Из первого столбца ряда
  берутся имена в обратных кавычках — пути дерева и ключи командной строки:
  ряд без пути обязан говорить «не файл»; все пути в стволе (и ключи в файлах) —
  «есть»; ни одного — «нет»; часть — ряд смешанный, его надо разделить.
  
  bootstrap/flang io scripts/guards/what-blocks-inventory-guard.fscript --plan Проверка   сверить, код 1 при расхождении
  bootstrap/flang io scripts/guards/what-blocks-inventory-guard.fscript --plan Печать     напечатать столбец по дереву
  bootstrap/flang io scripts/guards/what-blocks-inventory-guard.fscript --plan Подлог     сторож краснеет на выдуманном приборе
  
  Почему столбец отняли у руки — docs/what-blocks-1-0.md и
  docs/zettel/a-hand-written-list-outlives-the-tree.md.
```

Сторож комментариев теперь считает и `.fscript`, и переписывает ведомость,
сохраняя её шапку «ЧТО / ЗАЧЕМ / КТО ЧИТАЕТ» — обе способности перенесены из
sh-двойника, который на стволе успел их получить (задачи 1415 и 5503).

## Чем кончилось

Приём задачи — «назначен порог переноса N по замеру, перенесено ≥ N; каждый
перенесённый: старый `.sh` снят, новый файл на flang зовётся из того же ярлыка/хука/работы».
Прогон 22 сентября 2026 на стволе `d0763e8b6`:

```
git ls-files 'scripts/*.sh' 'scripts/**/*.sh' | wc -l   → 48   (на день замера 45)
```

Таблица в задаче есть (158 строк), но перенесено не просто меньше порога — число
скриптов оболочки выросло на три. Не сделана; ветка `a/5821-shell-to-flang-census` на
сервере не живёт.

## Что сделано 23 сентября 2026

Две написанные ранее ветки (`a/sh-na-flang` — три сторожа, `a/sh-na-flang-2` — ещё
четыре и перепись) лежали невлитыми. Перенесены на свежий ствол `38105062f`
по-файлово, потому что обе старше ADR-0046 и переименования шагов CI на
английский: обычное перебазирование вернуло бы и кириллические имена шагов, и
исключение `flang/proof/**` из области двух сторожей имён.

```
git ls-files scripts | grep -c '\.sh$'                было 48 → стало 41
grep -hc "name:.*[А-Яа-я]" .github/workflows/*.yml    0 в каждой из девяти работ
```

Перенесено семь: `cyrillic-file-names-guard`, `translit-file-names-guard`,
`no-package-json-guard`, `criterion-score-guard`, `print-progress`,
`cell-work-preserved`, `bump-version`. Равенство старого и нового показано
парами прогонов на одних входах — таблицы входов, кодов и текстов лежат в
[`docs/shell-to-flang-census.md`](../shell-to-flang-census.md).

Остальные 41 остаются, и причина у каждого названа поимённо там же. Главные из
них не в усердии: у плана нет кода возврата 2 и нет проброса ЧУЖОГО кода
возврата наружу; слить `вывод` и `ошибки` потомка, как делает `2>&1`, нечем;
журнал поручений `flang io` не сузить ключом. Порог задачи (N = 2) взят.

## Что сделано 27 сентября 2026: скрипты семени, отчёты и вердикт

Ветка `a/5821-seed-and-target-scripts-are-plans` над `gh/dev` `7b3a73873`. Сверка
«старый `.sh` против нового плана» гонялась на двух деревьях одного коммита: старое —
чистая копия ствола, новое — ветка; строка «SHA дерева» из сличения исключена, всё
остальное сличалось `diff`-ом. Код плана — 0 «конец работы», 1 «провал», 3 «не
проверено»; прежняя двойка стала тройкой. Вывод плана — JSON, текст отчёта — поле
`result` (или `error` при отказе).

### Перенесено: `.sh` снят, зовущие переведены

| было | стало | срок до → после, мс | код до → после | текст |
|---|---|---:|---|---|
| `scripts/provability.fscript` | `scripts/provability.fscript`, план `Verdict` | 17 499 → 48 268 | 0 → 0 | совпал знак в знак |
| то же, подлог таблицы ловушки (код вида снятой цели 0 → 1) | `FLANG_TRAP_TABLE=…` | 18 005 → 44 782 | 1 → 1 | совпал знак в знак |
| `scripts/report-provenance.fscript` | `scripts/report-provenance.fscript`, план `Report` | 342 → 3 063 | 0 → 0 | совпал; у плана нет пустой строки в конце |
| `scripts/four-coverages.fscript` | `scripts/four-coverages.fscript`, план `Measure` | 14 832 → 26 501 | 2 → 3 | совпал знак в знак |
| `scripts/seed/seed-runtime-is-source.fscript` | план `Check` / `After print` | 92 → 3 441 / 96 → 3 779 | 0 → 0 | совпал |
| `scripts/seed/two-prints-identical.fscript` | план `Check` | 78 → 5 141 | 0/1/3 → 0/1/3, 2 → 3 | совпал, кроме строки «как звать» |
| `scripts/seed/print-is-repeatable.fscript` | план `Check` / `Forgery` | 20 979 → 25 565 / 12 303 → 15 816 | 0 → 0 | совпал |
| `scripts/seed/what-lags-the-seed.fscript` | план `Report` | 632 → 8 080 | 0 → 0 | совпал, кроме последней строки-ссылки |
| `scripts/seed/binary-origin.fscript` | план `Check` / `Exact` / `Forgery` | 1 257 → 37 580 / 124 613 → 128 578 / 1 522 → 20 527 | 0 → 0; подлог 1 → 1 | план при успехе пишет строку «двоичный сверен с семенем поименно» — старый молчал |
| `scripts/seed/new-binary-acceptance.fscript` | план `Accept` | — | 2 → 3 | старый на стволе сломан: `PROBE` заведена, читается `$PROBA` при `set -u` |
| `scripts/seed/build-ledger-binary.fscript` | план `Build` | 137 413 → 131 389 | 0 → 0 | — |
| `scripts/seed/seed-freshness.fscript` | план `Check`; `.sh` оставлен трёхстрочным переходником | 2 078 → 40 400 | 3 → 3 | совпал, кроме имени ключа обхода |

Покраснение показано: вердикт — подлогом таблицы ловушки и таблицей без строки
(«ловушка ослабла: видов 37 при храповике 38»), отсутствием таблицы — код 3; сверка
семени и рантайма — песочницами с отставшим и испорченным источником (код 1); две
печати — изменённым байтом, лишним файлом (1) и семью видами негодного журнала (3);
повторимость печати — подставным двоичным, дописывающим часовой пояс (1);
происхождение двоичного — подложной программой (1) и снятой таблицей имён (3).

Прибавка 3–5 с у каждого плана — постоянная цена запуска `flang io`: столько же
стоит план, которому делать нечего. У вердикта прибавка 30 с: сверщик зовётся 42
раза процессом, по разу на вид ловушки.

Общие части: `scripts/inquiry.fscript` (вопрос хозяину — процесс, файл, среда,
доводы — и разбор ответа по имени вопроса), `scripts/reading.fscript` (строки,
слова, числа из вывода), `scripts/rules.fscript` (выбор по списку правил вместо
лестницы «если … иначе если»). Все планы проходят `flang check --proof` с
«ПРОВЕРЕНО САМОСТОЯТЕЛЬНО», сетки и «объявлено, не доказано» ноль — ключ
`--на-веру` им не нужен.

### Переименованные переменные среды и ключи

| было | стало |
|---|---|
| `LOVUSHKA_TSV`, `LOVUSHKA_HRAP` | `FLANG_TRAP_TABLE`, `FLANG_TRAP_RATCHET` |
| `SEMYA_OTSTALO_ZNAYU` | `FLANG_SEED_LAG_KNOWN` |
| `ZHURNAL_1`, `ZHURNAL_2` | `FLANG_PRINT_LOG_1`, `FLANG_PRINT_LOG_2` |
| `KOMMIT` (сборка двоичного ведомости) | `FLANG_SEED_COMMIT` |
| `--после-печати`, `--подлог`, `--точно`, `--вход`, `--чем`, `--chto` | планы `After print`, `Forgery`, `Exact`, довод после `--`, `-- --what` |

### Три скрипта, про которые решение, а не перенос

Вопрос: нужен ли скрипту уже собранный двоичный. Отвечено прогоном: двоичный
уносился из дерева, скрипт гонялся с ним и без него.

**`scripts/bootstrap-c.sh` — переносим.** Двоичный он не собирает: печатает
`flang/self/bootstrap/compiler.flang` командой `$FLANG emit` и сличает с
`bootstrap/`. Подставной «двоичный», копирующий `bootstrap/` в каталог вывода,
дал `--check` код 0 за 218 мс, он же с испорченным байтом — код 1 и
«bootstrap/flang_cli.c: в дереве 61906 байт, печать даёт 61920». Без двоичного —
код 2 «не найден двоичный»; единственное, что скрипт «собирает», — `make -C
bootstrap` перед печатью, и это та же минута, что у `bootstrap/flang run-script build`. Сверку
`--check` уже делает `scripts/seed/bootstrap-point-by-binary.fscript`, но рецепт
печати (`FLANG_OUT`) он читает из самого `bootstrap-c.sh`. В этой работе не
перенесён: `bootstrap-reprint.sh` держит его вторым путём печати
(`SECOND_PRINT`) и сверяет с ним пределы, а перепечатка идёт — трогать её вход
нельзя. Перенос — после печати: пределы и вход переезжают в план, а
`bootstrap-reprint.sh` читает их оттуда.

**`scripts/seed/seed-refresh.sh` — переносим.** `--check` двоичного не зовёт:
с двоичным и без — вывод один, код 0 оба раза (303 и 292 мс). Режим пересева
пересобирает двоичный `make -C bootstrap`; проверено, что план может пересобрать
собственного исполнителя: план, запущенный двоичным дерева, снёс `flang_cli.o`,
позвал `make` (код 0, 121 с) — файл двоичного новый (другой inode), `--version`
отвечает, план дошёл до конца кодом 0. Зовёт его хук-план
`.githooks/pre-push.fscript`, то есть двоичный уже есть. Не перенесён в этой
работе по объёму, а не по границе.

**`scripts/bootstrap-reprint.sh` — делится надвое, и граница проходит внутри.**
Дешёвые сверки двоичного не зовут: `--telo`, `--stroki`, `--imena`, `--тела`,
`--bystro` дали с двоичным и без него одинаковый вывод и код (210, 711, 410,
3314, 710 мс). `--telo` зовётся из `ярлык` ДО сборки, чтобы не собрать двоичный из
подменённого семени, — эту проверку на плане исполнить нечем. Целью в
`bootstrap/Makefile` она тоже не станет: Makefile напечатан, и дописанная руками
цель валит ту же проверку (`--telo` → код 1 «bootstrap/Makefile: изменён после
перепечатки»); нужна цель, которую печатает сам компилятор, — правка в
`flang/self/emit-c.flang`, место, где печатается Makefile, — а `flang/self/**`
сейчас не вливается. Печать (без ключа), `--check`, `--otpechatok`, `--build`,
`--замкнутость` зовут двоичный — они переносимы.

Состав (строки файла, код / комментарии / пустые):

| строки | что | код | комм. | пуст. |
|---|---|---:|---:|---:|
| 1–664 | шапка, пределы, настройки | 18 | 635 | 11 |
| 665–1358 | общие функции: отличия, литералы, пределы двух печатей, сборка и опрос, замыкание, отпечаток | 411 | 251 | 32 |
| 1359–2648 | имена и тела ядра против семени | 905 | 320 | 65 |
| 2649–2711 | разбор доводов | 36 | 25 | 2 |
| 2712–3130 | режимы `--telo`, `--imena`, `--тела`, `--замкнутость`, `--build`, `--stroki` | 305 | 95 | 19 |
| 3131–3415 | `--otpechatok`, `--bystro` | 194 | 76 | 15 |
| 3416–3599 | печать и `--check` | 126 | 44 | 14 |
| всего 3 598 | | 1 995 | 1 446 | 157 |

Предлагаемый разрез, по порядку:
1. `--telo` — отдельный файл, до сборки; после печати — цель напечатанного Makefile.
2. Отпечаток (`--otpechatok`, `--bystro`, `--stroki`) — план `scripts/seed/fingerprint.fscript`.
3. Сверка имён и тел ядра (`--imena`, `--тела`) — план; это 905 строк кода, самая большая часть.
4. Печать, `--check`, `--build`, `--замкнутость` — план `scripts/seed/reprint.fscript`, вместе с `bootstrap-c.sh`: пределы печати станут одним числом в одном файле.

### Чего в этой работе не перенесено и почему

| файл | почему |
|---|---|
| `scripts/memory-headroom.sh` | `--следить` стоит в `binary.yml` до шага «Build bootstrap», `--отчёт` — шагом `if: always()`, то есть и тогда, когда сборку сняли по памяти и двоичного нет |
| `scripts/memory-limit.sh` | обёртка: ответ прибора — ЧУЖОЙ код (137 при снятии по памяти, 7 от потомка); план отдаёт 1. Черновик плана сверен на 12 парах (счёт сошёлся, коды 137 и 7 стали 1) и в ветку не взят: его зовут `target-census.sh` и `docs/benchmarks/proof-cost/postcondition-pairs.sh` |
| `scripts/targets/target-census.sh` | его путь назван местом отбора в `scripts/guards/file-extensions.fscript:197`; снятие файла красит этого сторожа (код 1, «место отбора пропало из дерева»), а `scripts/guards/**` в этой работе не правится |
| `scripts/targets/identical-declarations.sh`, `target-collisions.sh`, `targets-inventory.sh` | не начаты: зовущих нет, прежняя перепись называет `jq`, awk-программу и `2>&1`; работа оборвалась на пределе сессии |
| `scripts/repl-probe.sh`, `scripts/tutor-probe.sh` | красны до переноса: код 1 за 80,5 и 49,6 с; переносить красный прибор без разбора его красноты нельзя |
| `scripts/test-remote.sh` | режим `--shell` отдаёт человеку живую оболочку по ssh — у плана нет ни ввода потомку, ни терминала |

### Что осталось называть старые имена и почему

`git grep` по снятым именам находит только места, которые эта работа не правит:
`scripts/guards/tree-inventory.fscript`, `adr-numbers-guard.fscript`,
`file-extensions.fscript`, `published-vs-tree.sh` (он же зовёт
`scripts/seed/seed-freshness.fscript` — оттого файл и оставлен переходником),
`scripts/bootstrap-reprint.sh` (идёт печать), `bootstrap/flang_repl.c` и его
источник `flang/src/emit/c/flang_repl.c` (комментарий о `scripts/binary-origin.fscript`,
путь устарел и до этой работы).

Объявления ярлыков «provability» и «binary:acceptance» жили строкой-комментарием
в снятых `.sh`; план «Сбор» теперь относит оба к «только в таблице» — это не
красное, но объявление надо завести заново, когда у «Сбора» будет английское имя
функции-объявления.

Два дефекта, найденные переносом, заведены отдельно и закрыты планами:
[5822](completed/5822-two-prints-check-skips-the-printed-compiler.md) — сверка двух
печатей не видела `compiler_flang.c`, `compiler_flang.h` и `Makefile`;
[5823](completed/5823-new-binary-acceptance-stops-at-the-kernel-rules-sign.md) —
приёмка нового двоичного обрывалась на четвёртой примете.

## Проверки p–w стали планами (27 сентября 2026, ветка `a/5821-guards-p-to-w-are-plans`)

Список: `prose-numbers-guard`, `seed-knows-type-words-guard`,
`seed-parses-sources-guard`, `stdlib-proof-guard`, `task-numbers-guard`,
`who-calls-the-guards`, `scripts/ledgers/take-proof-ledger`. Восьмой файл списка,
`run-verdict-debt-guard.sh`, снят с этой работы: его переводит автор задачи 3811
на своей ветке. Двоичный — `bootstrap/flang` 0.7.22, собранный `make -C bootstrap`
из этого же дерева. Эталон — прежний `.sh`, взятый из ствола `git show gh/dev:…`.

`git ls-files 'scripts/*.sh' 'scripts/**/*.sh' | wc -l`: 42 → 35. Опись
(`bootstrap/flang run-script inventory:check`, код 0): оболочка 101 файл / 24 449 строк → 94 / 22 540,
долг оболочки 89 / 15 825 → 82 / 13 916; вне flang 251 → 244 файла; долг вне
JavaScript 98 → 93.

| файл | двойник или новый | срок: было → стало | код на чистом: было → стало | как показано, что краснеет |
|---|---|---|---|---|
| `task-numbers-guard` | новый план: двойник `tasks:check` покрывает не всё | 2,50 с (код 127, падал) → 4,7 с; подлог 31,1 с → 24,3 с | 127 → 0 (починенная копия оболочки — 0) | шесть подлогов на копии дерева, текст знак в знак с починенной оболочкой; план Forgery показывает шесть сторон |
| `who-calls-the-guards` | новый план | 0,42 с → 9,3 с | 0 → 0, текст знак в знак (`--check`, перепись, список) | ведомость с вынутым незваным и вписанным званым — оба текста знак в знак; план Forgery — четыре стороны на построенном дереве |
| `seed-parses-sources-guard` | новый план | 4,44 с → 7,6 с | 3 → 3 («файлов 68, не досмотрено 68») | на маленьком дереве с неизвестным словом типа — код 1 у обоих, текст совпал; план Forgery — четыре стороны |
| `seed-knows-type-words-guard` | новый план | 2,20 с → 185 с | 0 → 0, «слов в позициях типа 58039» знак в знак | план Forgery: выдуманный тип, код 1, два места названы |
| `stdlib-proof-guard` | новый план, пять планов вместо пяти ключей | скобки 0,28 с → 5,7 с; прогон по библиотеке трёх модулей 555 с → 550 с | скобки 0 → 0 | подлоги скобок и обещания — код 1 у обоих; на своём каталоге и своей ведомости надгробие названо знак в знак; на построенном дереве с тремя спорными строками — те же три места |
| `take-proof-ledger` | новый план | 3,87 с → 6,57 с | 0 → 0, ведомость JSON побайтово та же | нет файла: 2 → 3; прогон под пределом 1000 шагов: 1 → 1, код прогона назван словами |
| `prose-numbers-guard` | новый план, последним | 10,6 с → 59 с | 0 → 0: «примет 226: сошлось 226, разошлось 0, негодных 0» знак в знак | подлог: знак в знак с оболочкой; сдвинутое число в прозе `docs/tree-inventory.md` — код 1, «ПРИМЕТА ОТОРВАЛАСЬ ОТ ПРОЗЫ» |

### Как звать теперь

```
bootstrap/flang io scripts/guards/prose-numbers-guard.fscript --plan Check
bootstrap/flang io scripts/guards/prose-numbers-guard.fscript --plan Forgery
bootstrap/flang io scripts/guards/seed-knows-type-words-guard.fscript --plan Check --max-steps 4000000000
bootstrap/flang io scripts/guards/seed-knows-type-words-guard.fscript --plan Forgery
bootstrap/flang io scripts/guards/seed-parses-sources-guard.fscript --plan Check
bootstrap/flang io scripts/guards/seed-parses-sources-guard.fscript --plan Forgery
bootstrap/flang io scripts/guards/stdlib-proof-guard.fscript --plan Brackets
bootstrap/flang io scripts/guards/stdlib-proof-guard.fscript --plan "Brackets forgery"
PARALLEL=8 PREDEL=3600 bootstrap/flang io scripts/guards/stdlib-proof-guard.fscript --plan Check --timeout 20000000
bootstrap/flang io scripts/guards/stdlib-proof-guard.fscript --plan Census --timeout 20000000
bootstrap/flang io scripts/guards/stdlib-proof-guard.fscript --plan Forgery --timeout 600000
bootstrap/flang io scripts/guards/task-numbers-guard.fscript --plan Check
bootstrap/flang io scripts/guards/task-numbers-guard.fscript --plan Forgery
bootstrap/flang io scripts/guards/who-calls-the-guards.fscript --plan Check
bootstrap/flang io scripts/guards/who-calls-the-guards.fscript --plan Census
bootstrap/flang io scripts/guards/who-calls-the-guards.fscript --plan List
bootstrap/flang io scripts/guards/who-calls-the-guards.fscript --plan Forgery
bootstrap/flang io scripts/ledgers/take-proof-ledger.fscript --timeout 36000000 -- flang/stdlib/aes.flang
```

Переведены зовущие: `ярлыки.flang` (`tasks:numbers`, `tasks:numbers:forgery`,
`guard-calls:check`, `seed:type-words`, `seed:type-words:forgery`), `.githooks/pre-push.fscript`
(три строки), `ci.yml` (работы `semya`, `proza`, `uncalled-guards`; первые две
теперь собирают двоичный), `stdlib-proof.yml`, место отбора в
`scripts/guards/file-extensions.fscript`, команды в `docs/kernel-ledger.md`,
пути в `README.md`, `docs/README.ru.md`, `docs/prose-numbers.md`,
`docs/flang/concurrency/README.md`, `docs/tree-inventory.md` и навыке
`flang-code`. Упоминания в задачах, решениях и заметках — история, не тронуты.
Не тронуты и упоминания в комментариях чужих файлов: `flang/src/emit/js/flang_io.js`,
`flang/src/emit/python/flang_io.py` (рантайм уезжает в цель дословно),
`flang/test/обход-self.sh`, `scripts/guards/guards-without-forgery-probe.sh`,
`scripts/ledgers/proved-share-ledger.txt`.

### Что при переносе изменилось, названо поимённо

- **Кода 2 у плана нет**: «нет двоичного», «не назван файл», «нет git» стали
  тройкой; `take-proof-ledger` прежде отдавал код прогона `check` (75 от ворот,
  1, 3), теперь отдаёт 1 и называет код прогона словами.
- **Подлог, не пойманный проверкой, — конец работы (код 0), а не 1**, как у
  прежних планов-подлогов (`no-package-json-guard`): шаг CI «if … --plan Forgery;
  then fail» теперь отличает пойманный подлог от слепого. У оболочки чисел оба
  исхода давали 1, и CI их не различал.
- **`task-numbers-guard`**: двойник `bootstrap/flang run-script tasks:check` проверен шестью
  подлогами на копии дерева. Двойной номер в `docs/tasks` и двойник живой с
  закрытой он ловит; двойник между `completed/` и `rejected/`, шапку, разошедшуюся
  с именем в `completed/`, и отказ без раздела «Почему отклонена» — не ловит:
  закрытые задачи он читает только по именам. Потому написан план, а не снесена
  оболочка в пользу двойника. Шестая сторона подлога прибавлена: шапка,
  разошедшаяся с именем файла.
- **`who-calls-the-guards`**: YAML не разбирается библиотекой, а читается правилом
  «значение ключа `run:` и его блок `|`/`>` по отступу»; на девяти workflow
  дерева перепись совпала с python-разбором знак в знак (147 ярлыков, 22 по имени,
  63 по файлу, 28 незваных). Сломанный YAML прежний прибор называл отказом, план —
  нет. Примечание ведомости (`"//"`) вынесено из файла данных ниже.
- **`seed-knows-type-words-guard`**: 185 с против 2,2 с на awk — в 84 раза
  дороже; чтение строк отдано `grep -o`, разбор — flang. Нужен ключ
  `--max-steps 4000000000`: умолчание 10 млн шагов на виток не вмещает 113 тысяч
  строк. Из-за этого работа `semya` в CI теперь собирает двоичный. Первый прогон
  разошёлся с awk на 3 слова из 58 039 (`вариант … содержит «a»: число и «b»:
  строка` — «и» между полями awk срезал, план считал) — поправлено, сошлось.
- **`seed-parses-sources-guard`**: шапка двоичного — путь как его зовёт план
  (`../../bootstrap/flang`), а не абсолютный; «Разбор — в шапке этого файла» →
  «в задаче 5821».
- **`stdlib-proof-guard`**: параллельный прогон по библиотеке держит `xargs -P`
  и одна строка `sh -c` на модуль (запись `.out`/`.err` в файлы, код и срок —
  строкой): у хозяина нет ни параллельных потомков, ни перенаправления вывода в
  файл, а ведомость модуля больше предела вывода потомка (1 МиБ). Судит flang.
  Переменные `FLANG`, `KATALOG`, `VEDOMOST`, `PARALLEL`, `PREDEL`, `FLANG_TMP`,
  `DEREVO` читаются как прежде; временный каталог по умолчанию `/tmp`, а не
  `/srv/tmp`. Порядок мест «СКОБКИ» — порядок обхода `grep -r`, а не `os.walk`.
  Весь прогон по 51 модулю (80 минут) в этой работе не повторялся: равенство
  показано на каталоге из трёх модулей со своей ведомостью. Примечание ведомости
  (две строки `#`) вынесено ниже.
- **`prose-numbers-guard`**: 59 с против 10,6 с. Каждая примета — одно-два
  поручения (`wc`, `git ls-files`, `sed -n`), всего 503 за прогон. Оболочка
  читала строку без приметы с ошибкой: `read` с разделителем «таб» склеивал
  пустое поле, и негодная примета называлась «дата «…» не вида ГГГГ-ММ-ДД»
  вместо «не разбирается». План говорит «не разбирается». На чистом дереве
  таких строк нет, и тексты совпали знак в знак.
- **`take-proof-ledger`**: довод и выходной каталог — после `--`; переменные
  `DVOICHNYY`, `VYHOD`, `PAMYAT`, `PIK`, `PREDEL_SHAGOV`, `PREDEL_GLUBINY` — как
  прежде. Сам прогон под `/usr/bin/time` с записью в файлы держит строка `sh -c`
  по той же причине, что у ведомости библиотеки. Счёт доли остаётся за
  `scripts/ledgers/proved-share-of-a-file.py`.

Шапки снесённых `.sh` (доводы, замеры, история бед) в `.fscript` не переносятся:
комментариев там нет. Они лежат в стволе: `git show 5c5dbf701:scripts/guards/<имя>.sh`.

### Примечания, вынесенные из файлов данных

`scripts/ledgers/uncalled-guards.json`, бывший ключ `"//"`:

```
ВЕДОМОСТЬ НЕЗВАНЫХ СТОРОЖЕЙ (scripts/guards/who-calls-the-guards.sh).
Это НЕ источник списка: список прибор снимает сам — разбором ярлыки.flang и
значений ключа run: во всех .github/workflows/*.yml. Здесь лежат только УЖЕ
НАЗВАННЫЕ долги с причиной, чтобы новый был виден среди старых.
Сверяется В ОБЕ СТОРОНЫ: незваного, которого здесь нет, — красно; записи, по
которой сторожа УЖЕ зовут, — тоже красно: долг закрыт, запись стала неправдой,
и убрать её обязан тот, кто долг закрыл.
Причина у каждого — не украшение: незваный без причины неотличим от забытого,
а забытый сторож — это выключенный сторож.
Замер снят 5 сентября 2026 своим прогоном, предел 130 с на сторожа (спорные перемерены поодиночке с пределом 200 с и 950 с), машина под
перепечаткой. «Дороже предела» и «не сходится» — РАЗНЫЕ вещи, и там, где
различить не удалось, так и сказано.
Перемер 5 сентября (задача 5612): семь записей разошлись с деревом за вечер и переписаны — выпуск, releases:page, запись, сведение, пустота, спеки, слова. Чужой цифре без своего прогона не верить.
Перемер 6 сентября 2026 (работник r10, свой прогон, предел 200 с на сторожа, машина под чужой печатью): все ОДИННАДЦАТЬ записанных «КРАСЕН по делу» дали код 1 — вкладка 16 с, выпуск 6 с, releases:page 39 с, журнал 5 с, имена-модулей 5 с, октет 17 с, перечни 15 с, поверхности 4 с, правила 7 с, спеки 63 с, утверждения 5 с; ни один долг не закрылся. Из записанных зелёными: word:occupancy код 0 за 86 с, срок код 0 за 72 с, а СЛОВА — КОД 1 за 62 с, и запись про него переписана. Красных по делу двенадцать, но не тех, что 5 сентября: коды ушли званым из CI, слова пришли красным.
Перемер 6 сентября 2026 (своим прогоном, без предела 200 с): десять записей «дороже предела замера» разобраны поимённо. Четверо СХОДЯТСЯ и были просто медленными — имена 584 с, закон 1613 с, числа 6864 с, подсчёты 6884 с. Один упирается в ПРЕДЕЛ ШАГОВ, заданный ключом своего же ярлыка, — память, код 3 за 353 с. Четверо НЕ СХОДЯТСЯ — времянки, запись, сведение, пустота. Один вовсе не замер, а полусуточная работа — точка. Дёшево-зелёных среди них нет ни одного: звать в CI нечего.
```

`scripts/ledgers/stdlib-proof-debt.tsv`, бывшие строки `#`:

```
ЧТО: модули flang/stdlib, с которых НЕ снимается ведомость доказательств (`flang check --proof` даёт не 0 либо пустой вывод) — строка на модуль: имя без расширения, код возврата, причина. ЗАЧЕМ: храповик — сторож краснеет и на новом отказе («ПРИБАВИЛОСЬ»), и на записи, чей долг закрыт («НАДГРОБИЕ»). КТО ЧИТАЕТ: scripts/guards/stdlib-proof-guard.sh (первый столбец; строка без табуляции, как эта, пропускается); .github/workflows/stdlib-proof.yml называет файл.
ЗАМЕР 20 сентября 2026, прогон `sh scripts/guards/stdlib-proof-guard.sh --перепись` на двоичном 0.7.20 (make -C bootstrap CFLAGS='-std=c99 -O0'), по восемь модулей разом, предел 3600 с на модуль, машина 256 ядер на простое: стенного 83 мин 41 с, машинного 462 мин 57 с; модулей 51, ведомость снялась с 39.
```
