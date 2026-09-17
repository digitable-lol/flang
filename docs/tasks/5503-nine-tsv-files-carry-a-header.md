---
номер: 5503
заголовок: У девяти tsv первая строка отвечает «что, зачем, кто читает» — нечитаемые снесены
статус: в работе
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
