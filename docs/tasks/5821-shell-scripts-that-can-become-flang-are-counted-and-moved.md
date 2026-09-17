---
номер: 5821
заголовок: Оболочка переносится на flang — сначала перепись, кто обязан остаться оболочкой, потом перенос по одному с подлогом
статус: в работе
исполнитель: a
ветка: a/5821-shell-to-flang-census
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
  `scripts/raskrutka.sh`, `scripts/seed/seed-refresh.sh` — они собирают сам двоичный.
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
- `./ярлык опись:сверка` код 0 после пересъёмки `docs/tree-inventory.md`.

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
| 1 | `scripts/bootstrap-c.sh` | 206 | остаётся | собирает двоичный (cc, вторая печать) | scripts/raskrutka.sh, scripts/seed/build-ledger-binary.sh |
| 2 | `scripts/cell-work-preserved.sh` | 97 | остаётся | нужна среда: FLANG_CELLS — «Прочитать переменную среды» хозяин не знает (прогон №2); на этой машине код 3 (клонов ячеек нет) | никто (0) |
| 3 | `scripts/flangrc.sh` | 241 | остаётся | нужны доводы (ключ, --от DIR, --дом DIR) и среда HOME — записано в шапке | ярлыки.flang, flangrc-guard.sh, version-derivations-guard.sh, bump-version.sh, flang/bin/flangtutor |
| 4 | `scripts/flangtutor-proba.sh` | 241 | остаётся | зона 1428 (переименование в tutor-probe.sh) | никто (0) |
| 5 | `scripts/guards/bad-octet-guard.sh` | 340 | остаётся | негодные октеты приезжают только снаружи — литерал языка их не несёт (шапка); зовёт тулчейны девяти целей (node, python3, cc) | ярлыки.flang (октет:проверка, октет:порча) |
| 6 | `scripts/guards/criterion-score-guard.sh` | 85 | остаётся | нужен довод — путь к документу (ФАЙЛ) | ярлыки.flang (критерий:счёт) |
| 7 | `scripts/guards/cyrillic-file-names-guard.sh` | 61 | остаётся | зовётся до сборки двоичного: хук pre-push и работа kirillica (ci.yml) без сборки | .githooks/pre-push, ci.yml, ярлыки.flang |
| 8 | `scripts/guards/flangrc-guard.sh` | 238 | остаётся | зовётся до сборки: работа nastroyki (ci.yml) без сборки; доводы --корень DIR, --читатель FILE | ci.yml, ярлыки.flang |
| 9 | `scripts/guards/hand-written-lists.sh` | 376 | переносим позже | доводов нет (режимы --check/--targets → планы), но сторож красен по делу: код 1 за 12,8 с — новых 59, мёртвых 29; «0 без подлога» показать нельзя, пока долг не закрыт | ярлыки.flang (перечни:перепись, перечни:проверка) |
| 10 | `scripts/guards/kto-zovet-storozhey.sh` | 269 | остаётся | зовётся до сборки (хук); зона 1428 | .githooks/pre-push, ci.yml, ярлыки.flang, storozha-bez-podloga.sh |
| 11 | `scripts/guards/module-origin-guard.sh` | 279 | остаётся | читает среду FLANG_MODULE_DIR и FLANG_BINARY (py-программа внутри); довод --корень DIR; красен по месту: код 1 за 0,5 с (чужой /srv/tmp/json.baseline.flang выше корня) | ярлыки.flang (изоляция:проверка, изоляция:подлог) |
| 12 | `scripts/guards/no-comments-guard.sh` | 123 | ПЕРЕНОСИМ | доводов нет (режим --снять → второй план); зелен: код 0 — 39 624 строк в 567 файлах; временный каталог не нужен | никто (0) |
| 13 | `scripts/guards/one-string-measure-guard.sh` | 119 | остаётся | сырые октеты кладёт printf снаружи, литерал их не несёт (шапка «Почему оболочка») | никто (0; string-measure.flang называет его в шапке) |
| 14 | `scripts/guards/overlong-string-guard.sh` | 327 | остаётся | судит двоичный и его печать («судья не может исполняться подсудимым» — не долг по описи) | ci.yml, reprint.yml |
| 15 | `scripts/guards/pol-dokazannogo-sverka.sh` | 139 | остаётся | зовётся до сборки (хук); binary.yml; зона 1428 | .githooks/pre-push, binary.yml |
| 16 | `scripts/guards/prose-numbers-guard.sh` | 416 | остаётся | зовётся до сборки: хук и работа proza (ci.yml) без сборки | .githooks/pre-push, ci.yml |
| 17 | `scripts/guards/published-vs-tree.sh` | 803 | остаётся | зовётся без сборки: работа published (binary.yml); восемь режимов | binary.yml, ярлыки.flang |
| 18 | `scripts/guards/seed-knows-type-words-guard.sh` | 311 | остаётся | зовётся без сборки: работа semya (ci.yml); судит семя; доводы ФАЙЛ… | ci.yml, ярлыки.flang |
| 19 | `scripts/guards/seed-parses-sources-guard.sh` | 220 | остаётся | судит семя: собирает разборщик из bootstrap/ (cc) и гоняет по исходникам | никто (только упоминания в ci.yml и шапках) |
| 20 | `scripts/guards/storozha-bez-podloga.sh` | 323 | остаётся | зовётся до сборки (хук); зона 1428 | .githooks/pre-push, binary.yml, ci.yml, install-path.yml, release.yml |
| 21 | `scripts/guards/task-numbers-guard.sh` | 284 | остаётся | по замыслу без двоичного (шапка: «ни двоичного, ни git») — зовётся на свежем клоне до сборки | ярлыки.flang (задачник:номера, задачник:номера-подлог) |
| 22 | `scripts/guards/version-derivations-guard.sh` | 175 | остаётся | зовётся до сборки (хук) | .githooks/pre-push, .flangrc, bump-version.sh |
| 23 | `scripts/guards/what-blocks-inventory-guard.sh` | 160 | ПЕРЕНОСИМ | доводов нет (режим --print → второй план); зелен: код 0 — рядов 6; один зовущий | ярлыки.flang (что-мешает:проверка); ci.yml зовёт ярлык |
| 24 | `scripts/ledgers/take-proof-ledger.sh` | 106 | остаётся | нужен довод ФАЙЛ; среда DVOICHNYY/PAMYAT/PIK; зовёт python3-счёт доли | никто (0; proved-share-ledger.txt упоминает) |
| 25 | `scripts/memory-headroom.sh` | 252 | остаётся | доводы (--следить, --отчёт --итог) и фоновый процесс на всю работу CI | binary.yml |
| 26 | `scripts/memory-limit.sh` | 259 | остаётся | доводы (-- команда), пробрасывает код возврата (137) наружу | postcondition-pairs.sh, target-census.sh |
| 27 | `scripts/raskrutka.sh` | 3513 | остаётся | собирает двоичный (точка раскрутки); вне задачи | ярлык, хук, все работы CI (54 файла) |
| 28 | `scripts/release/bump-version.sh` | 173 | остаётся | нужен довод — новая версия | ярлыки.flang (версия) |
| 29 | `scripts/repl-proba.sh` | 303 | остаётся | зона 1428; проба REPL через терминал (экран) | никто (0; flang_repl.c упоминает) |
| 30 | `scripts/seed/binary-origin.sh` | 549 | остаётся | судит двоичный: сверка происхождения и пересборка (cc); доводы -- команда | binary.yml, seed-freshness.sh |
| 31 | `scripts/seed/build-ledger-binary.sh` | 171 | остаётся | собирает двоичный (cc) для ведомостей; довод каталог | take-proof-ledger.sh |
| 32 | `scripts/seed/chto-otstalo-ot-semeni.sh` | 177 | остаётся | зона 1428; отчёт об отставании семени | никто (хук упоминает как «не сторож») |
| 33 | `scripts/seed/new-binary-acceptance.sh` | 232 | остаётся | приёмка нового двоичного (судит двоичный); довод путь к дереву | ярлыки.flang, binary-origin.sh |
| 34 | `scripts/seed/pechat-povtorima.sh` | 314 | остаётся | зона 1428; судит печать (две печати) | binary.yml, reprint.yml |
| 35 | `scripts/seed/print-progress.sh` | 158 | остаётся | идёт во время печати семени, до двоичного (reprint.yml) | reprint.yml, two-prints-identical.sh |
| 36 | `scripts/seed/seed-freshness.sh` | 197 | остаётся | судит семя (свежесть) — зовётся из `ярлык` до всякого плана; доводы --chto, -- команда | ярлык, raskrutka.sh, binary-origin.sh, published-vs-tree.sh |
| 37 | `scripts/seed/semya-osvezhit.sh` | 273 | остаётся | собирает двоичный (пересев); хук до сборки; зона 1428 | .githooks/pre-push, ярлыки.flang |
| 38 | `scripts/seed/semya-rantayma-eto-istochnik.sh` | 108 | остаётся | зовётся до сборки (хук); зона 1428 | .githooks/pre-push, semya-osvezhit.sh |
| 39 | `scripts/seed/two-prints-identical.sh` | 226 | остаётся | судит печать; доводы — два каталога | binary.yml, reprint.yml, pechat-povtorima.sh |
| 40 | `scripts/targets/identical-declarations.sh` | 118 | остаётся | зовёт node-библиотеку (link-collision-guard.mjs, «замыкание») и jq; среда FLANG; сегодня не сходится: за 300 с не кончился, jq: parse error | никто (0) |
| 41 | `scripts/targets/target-census.sh` | 214 | остаётся | py-разбор JSON дерева (python3, json); довод каталог; зовёт memory-limit.sh | никто (0) |
| 42 | `scripts/targets/target-collisions.sh` | 337 | остаётся | среда FLANG и KARTA; зовёт names-in-c.awk (awk-программа дерева) и jq | никто (0) |
| 43 | `scripts/targets/targets-inventory.sh` | 79 | остаётся | доводы (имена целей); среда VOROTA/PAMYAT/VYVOD; зовёт ворота | никто (0) |
| 44 | `scripts/test-remote.sh` | 149 | остаётся | доводы (--info/--shell/--sync), среда FLANG_REMOTE, ssh и терминал | ярлыки.flang (тесты:по-ssh) |
| 45 | `scripts/доказуемость.sh` | 321 | остаётся | зона 1428 (переименование в provability-gate.sh); гейт доказуемости — судит чекер и сверщика | ярлыки.flang (доказуемость), ХРАПОВИК, proverka-dereva.sh |
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
| 106 | `flang/concurrency/bin/node.js` | 735 | не долг по описи | код на стороне цели: хозяин узла пишется на языке цели | .github/workflows/dvoyniki.yml, bootstrap/flang_repl.c, docs/release-notes.json … (13) |
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
транслитных имён и `доказуемость.sh` в перенос не берутся — их переименовывает 1428).
Порядок переноса — от меньшего с одним зовущим:

1. `scripts/guards/no-comments-guard.sh` — 123 строки, зовущих 0;
2. `scripts/guards/what-blocks-inventory-guard.sh` — 160 строк, зовущий один (ярлык
   `что-мешает:проверка`, его зовёт работа `uncalled-guards` в `ci.yml`).

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

Не трогает `scripts/raskrutka.sh`, `scripts/otpechatok-semeni`, `bootstrap/**`, `flang/self/**`,
`flang/proof/**`. Расширение перенесённого файла — по решению задачи 1415.
