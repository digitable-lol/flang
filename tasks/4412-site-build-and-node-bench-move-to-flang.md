---
номер: 4412
заголовок: Сборка сайта и стенд узла — на flang: последние потребители оснастки на Node
статус: свободна
исполнитель: —
ветка: —
команда: вторая
карта: Чего в языке нет вовсе
рядом: 0049, 6858
---

# 4412. Сборка сайта и стенд узла — на flang

## Откуда задача

Задача 0049 сносит оснастку на JavaScript из трёх каталогов — `scripts/`,
`flang/scripts/`, `flang/test/`. Опись 9 сентября 2026 (в самой 0049) нашла,
что семь файлов этих каталогов держат не сторожа и не пробы, а два
потребителя ВНЕ каталогов:

| потребитель | что ввозит из трёх каталогов | кто зовёт потребителя |
|---|---|---|
| `docs/site/podsvetka.mjs` | `flang/scripts/binary.mjs` (`кодыРазбора`, `токеныИсходника`) | `docs/site/build.mjs` → `pages.yml`, ярлыки `сайт`, `сайт:проверка` |
| `docs/site/surfaces-run.mjs` | `binary.mjs`, `flang/scripts/direct-run.mjs`, `flang/test/surface-pair.mjs` | ярлыки `поверхности:прогон`, `поверхности:проверка` |
| `docs/site/site-numbers.mjs` | `direct-run.mjs`, `flang/scripts/proof-ledger.mjs` (`ФАЙЛЫ`, `сводКорпуса`) | ярлыки `числа`, `числа:проверка` |
| `flang/conc/bench/node-death-targets.mjs` | `flang/test/{tempdir,toolchain-guard,uzel-osnastka}.mjs` | **никто** (ни ярлык, ни `.yml`, ни `.sh`) |

Решение координатора 9 сентября 2026: общие модули переезжают ПОД своих
единственных потребителей (`docs/site/lib/`, `flang/conc/bench/lib/`) с
правкой ввозов, чтобы три каталога 0049 очистились; а снос самих
потребителей — эта задача.

## Что уже есть на flang

Двойники узла сайта лежат рядом с оригиналами: `docs/site/build.flang`,
`sitemap.flang`, `site-numbers.flang`, `diagram.flang`, `podsvetka.flang`,
`markdown.flang`, `poisk.flang`, `numbers.flang`, `storozh-kontrasta.flang`
(последний уже зовётся `pages.yml`). Ни один ярлык и ни один workflow на
двойники сборки не переключён: `pages.yml` зовёт `node docs/site/build.mjs`
дважды (`--check` и сборка), ярлыки `сайт*`, `поверхности:*`, `числа*` — Node.

Стенд узла `node-death-targets.mjs` (147 строк) двойника не имеет; его дело —
смерть узла на девяти целях — частью покрывают `flang/scripts/*-across-targets.flang`
(`dvoyniki.yml`).

## Что сделать

1. Для каждого из трёх узлов сайта — сверить двойник с оригиналом прогоном
   на дереве (тот же вывод, тот же код; у `--check` — та же беда на том же
   подложенном входе), переключить `pages.yml` и ярлыки, снять `.mjs`.
   Порядок сноса общих модулей под `docs/site/lib/`: `surface-pair.mjs`
   уходит с `surfaces-run.mjs`, `proof-ledger.mjs` — с `site-numbers.mjs`,
   `binary.mjs` и `direct-run.mjs` — последними, когда не останется ни
   одного ввозящего.
2. `flang/conc/bench/node-death-targets.mjs` — либо двойник на flang рядом с
   `*-across-targets.flang`, либо снос с доводом «ноль вызовов» и записью в
   `flang/conc/RESILIENCE.md`, где он назван.
3. Каждый снятый файл — своим коммитом с доказательством; приметы «СНЯТО» в
   `docs/javascript-inventory.md` и `docs/tree-inventory.md` — переснять.

## Как понять, что сделано

`git ls-files 'docs/site/*.mjs' 'flang/conc/bench/*.mjs' | wc -l` → 0 (кроме
`docs/site/poisk-proverka.mjs`, если решение о нём не изменилось — он
проверяет тот же `poisk.js`, что читает браузер); `pages.yml` без `node`;
`./ярлык сайт:проверка` и `./ярлык поверхности:проверка` отвечают тем же
кодом, что до сноса.
