---
номер: 5503
заголовок: У девяти tsv первая строка отвечает «что, зачем, кто читает» — нечитаемые снесены
статус: в работе (сделано в ветке a/5503-nine-tsv-files-carry-a-header, ждёт вливания)
исполнитель: a
ветка: a/5503-nine-tsv-files-carry-a-header
команда: вторая
карта: Что мешает больше всего
рядом: 1312, 6130
нужность: 2 — файл без шапки читается только тем, кто его завёл; два из девяти не читает ни один прибор
---

# 5503. Девять tsv получают шапку

## Чем измерено

Дерево `main` `cbfaf3899`, 17 сентября 2026; читатели — `git grep -l <имя> -- . ':!docs/tasks' ':!*.md'`.

| файл | строк | кто читает (код, не проза) |
|---|---:|---|
| docs/eight-targets-renames.tsv | 1058 | никто (только запись в hand-written-lists-ledger.tsv) |
| docs/javascript-checks-breakdown.tsv | 893 | никто (только запись в hand-written-lists-ledger.tsv) |
| docs/reprint-ledger.tsv | 12 | reprint.yml, raskrutka.sh, seed/reprint-freshness.flang, seed/seed-freshness.sh |
| flang/translation/PRINT-RULES.tsv | 72 | flang/translation/matcher.c, run.sh |
| scripts/ledgers/hand-written-lists-ledger.tsv | 142 | scripts/guards/hand-written-lists.sh, flang/proof/ПРАВИЛА-ВЫВОДА.tsv |
| scripts/ledgers/link-guard-known-not-a-path.tsv | 248 | ci.yml, guards/file-extensions.flang, guards/link-guard.flang |
| scripts/ledgers/no-comments-debt.tsv | 567 | guards/no-comments-guard.sh |
| scripts/ledgers/target-function-drift-known.tsv | 50 | guards/target-function-drift.flang, ledgers/storozha-bez-*.json |
| scripts/ledgers/traceability-debt.tsv | 2 | binary.yml, guards/traceability-guard.flang, ярлыки.flang |

У четырёх (javascript-checks-breakdown, PRINT-RULES, hand-written-lists-ledger,
target-function-drift-known) первая строка — `#`-примечание, но не по форме
«ЧТО … ЗАЧЕМ … КТО ЧИТАЕТ …»; у пяти первая строка — данные.

## Как поймём, что сделано

- 9 из 9: либо первая строка `# ЧТО … ЗАЧЕМ … КТО ЧИТАЕТ …` и читающий сторож
  ссылается на файл в своей шапке, либо файл снесён с доводом здесь;
- каждый читатель после правки зелен тем же кодом, что до (число: код до/после у каждого);
- `docs/reprint-ledger.tsv` читает `scripts/raskrutka.sh` — шапку ставить так, чтобы его
  разбор не сломался (проверить `sh scripts/seed/seed-freshness.sh` до/после); сам
  `raskrutka.sh` не править.

## Сделано (17 сентября 2026, ветка `a/5503-nine-tsv-files-carry-a-header`)

Восемь tsv получили первой строкой `# ЧТО: … ЗАЧЕМ: … КТО ЧИТАЕТ: …` (одна строка,
без табуляции, с «#» — так её пропускает каждый читатель), девятый снесён с доводом
ниже. У `link-guard-known-not-a-path.tsv` шапка встала НА МЕСТО прежней строки
заголовка столбцов, потому что сторож ссылок отбрасывает ровно первую строку
ведомости — данные не сдвинулись. У `target-function-drift-known.tsv` две прежние
`#`-строки заголовка слиты в шапку. В `hand-written-lists-ledger.tsv` запись о
`eight-targets-renames.tsv` переставлена со строки 2 на 3 (шапка сдвинула данные),
в `docs/eight-targets-collision-map.md` число строк файла 1058 → 1059.

### Читатели: код до и после (дерево `c4ada14bf`, до — без шапок, после — с шапками)

| файл | кто читает (код) | как пропускает шапку | код до / после |
|---|---|---|---|
| docs/eight-targets-renames.tsv | никто из приборов; человек — по ссылке из `docs/eight-targets-collision-map.md`; перепись перечней лишь считает в ней имена целей | строка без имён целей | перечни 1 / 1 (новых 59, мёртвых 29 — те же; строка перечня 2 → 3) |
| docs/reprint-ledger.tsv | `scripts/seed/reprint-freshness.flang`; `reprint.yml`, `raskrutka.sh`, `seed-freshness.sh` только называют файл | «Поле» за краем строки без табуляции даёт «» | reprint-freshness 1 / 1 (тот же текст: сверка 2026-09-08 устарела); seed-freshness 3 / 3 (тот же текст) |
| flang/translation/PRINT-RULES.tsv | `flang/translation/run.sh` (`перевод:проверка`); `matcher.c` держит список литералом | `awk '!/^#/ && $1 != "имя"'` | 0 / 0 (41 правило, 21 опыт — тот же текст) |
| scripts/ledgers/hand-written-lists-ledger.tsv | `scripts/guards/hand-written-lists.sh --check` (`перечни:проверка`) | `grep -v '^#'` | 1 / 1 (новых 59, мёртвых 29) |
| scripts/ledgers/link-guard-known-not-a-path.tsv | `scripts/guards/link-guard.flang` (`ссылки:проверка`); `file-extensions.flang` вынимает файл из переписи | первая строка отброшена как заголовок | ссылки 1 / 1 (битых 36 из 7051, список тот же, устаревших исключений 1); расширения 0 / 0 (тот же текст) |
| scripts/ledgers/no-comments-debt.tsv | `scripts/guards/no-comments-guard.sh` | `join`/`awk` по табуляции: строка без неё даёт 0 | 0 / 0 (строк 39624 в 567 файлах) |
| scripts/ledgers/target-function-drift-known.tsv | `scripts/guards/target-function-drift.flang` (`расхождение:проверка`) | «Пояснение»: строка с «#» — не долг | 1 / 1 (тот же текст: 16 расхождений, долг называет 8) |
| scripts/ledgers/traceability-debt.tsv | `scripts/guards/traceability-guard.flang` (`прослеживаемость:проверка`) | берёт строки ровно из двух столбцов | 0 / 0 (тот же текст) |
| docs/javascript-checks-breakdown.tsv | никто | — | снесён |

Приметы прозы: 216 сошлось, разошлось 0 — до и после. Сторож ссылок: «в записях
о прошлом» 1875 → 1877 — это две ссылки в обратных кавычках на снесённый файл в
летописи (`docs/tasks/completed/7842…` строка 74, `docs/tasks/6201…` строка 96 —
датирована в шапке), сторож кладёт их в свой счёт, а не в беды; битых не прибавилось.

Опись дерева (`опись:сверка`): 0 → 1 только из-за двух строк, добавленных в
`no-comments-guard.sh` (оболочка 24768 → 24770); `docs/tree-inventory.md` переснята
`./ярлык опись:языки` на перебазированной ветке.

Заодно: `no-comments-guard.sh --снять` переписывал долг из дерева и стёр бы шапку
первым же заходом — теперь строки с «#» переживают переписку (проверено: `--снять`
на неизменном долге — код 0, файл байт в байт тот же).

### Довод сноса `docs/javascript-checks-breakdown.tsv` (893 строки)

- Что это было: снимок разбора 886 блоков `test(...)` в 37 файлах JavaScript на
  коммите `4780c595` (ветка `vypusk/zamestit-proverki`) по родам A1/A2/B/C/D —
  план переноса проверок с JavaScript. Самих `.test.mjs` в дереве давно нет
  (задача 6201 — дерево всё ещё цитирует снятую реализацию): таблица описывает
  то, чего нет, и правдива лишь на дату снимка.
- Кто читал: ни один прибор — `git grep -l javascript-checks-breakdown -- . ':!docs/tasks' ':!*.md'`
  находил только запись о нём в ведомости перечней, а та стояла лишь потому, что
  строка 518 файла содержала шесть имён целей.
- Шапка «КТО ЧИТАЕТ: никто» была бы признанием, а не ответом — файл снесён;
  запись `ЦЕЛИ docs/javascript-checks-breakdown.tsv 518` снята из ведомости
  перечней вместе с ним (перечней 309 → 308, расходящихся 126 → 125; новых 59 и
  мёртвых 29 — те же).
- Упоминания остались в летописи — `docs/tasks/completed/7842…` и таблице
  «летопись» открытой задачи 6201; летопись не правится.
- `docs/eight-targets-renames.tsv` тоже не читает ни один прибор, но он —
  приложение к живой карте `docs/eight-targets-collision-map.md` (строка её
  таблицы называет его и число строк) и читается человеком по ссылке; оставлен,
  шапка называет читателем человека.

