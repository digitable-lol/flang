---
номер: 4412
заголовок: Сборка сайта и стенд узла написаны на JavaScript, и страницы публикуются через Node
статус: свободна
приоритет: P2
исполнитель: —
ветка: —
команда: вторая
карта: Чего в языке нет вовсе
рядом: 0049, 6858
нужность: сайт языка собирается не самим языком, и общие модули оснастки нельзя снять, пока их ввозит сборка сайта
---

# 4412. Сборка сайта и стенд узла написаны на JavaScript, и страницы публикуются через Node

## Шаги воспроизведения

1. Сосчитать файлы JavaScript сборки сайта и стенда узла:

```
git ls-files 'docs/site/*.mjs' 'flang/concurrency/bench/*.mjs' | wc -l
```

2. Посмотреть, что зовёт публикация страниц и ярлыки:

```
grep -an 'node ' .github/workflows/pages.yml
grep -an '"node docs/site' ярлыки.flang
```

3. Посмотреть, какие программы на flang уже лежат рядом:

```
ls docs/site/*.flang
```

## Что происходит

```
$ git ls-files 'docs/site/*.mjs' 'flang/concurrency/bench/*.mjs' | wc -l
14
$ grep -an 'node ' .github/workflows/pages.yml
122:        run: node scripts/site/build-changelog-page.mjs
141:        run: node docs/site/build.mjs --check
158:          if node docs/site/build.mjs --check > "$RUNNER_TEMP/probe.out" 2>&1; then
176:        run: node docs/site/build.mjs
$ ls docs/site/*.flang
docs/site/build.flang  docs/site/contrast-guard.flang  docs/site/diagram.flang
docs/site/highlighting.flang  docs/site/markdown.flang  docs/site/numbers.flang
docs/site/search.flang  docs/site/site-numbers.flang  docs/site/sitemap.flang
```

Версия: flang 0.7.23. Дата прогона: 30 сентября 2026.

Ярлыки `сайт`, `сайт:проверка`, `поверхности:прогон`, `поверхности:проверка`,
`числа`, `числа:проверка` зовут Node. Программы на flang лежат рядом с
оригиналами, но ни ярлык, ни публикация страниц на них не переключены, и их
ответы с ответами оригиналов не сверены.

Кто кого держит:

- `docs/site/highlighting.mjs` ввозит `flang/scripts/binary.mjs`;
- `docs/site/surfaces-run.mjs` ввозит `flang/scripts/binary.mjs`,
  `flang/scripts/direct-run.mjs` и `docs/site/lib/surface-pair.mjs`;
- `docs/site/site-numbers.mjs` ввозит `flang/scripts/binary.mjs`,
  `flang/scripts/direct-run.mjs` и `docs/site/surfaces-run.mjs`;
- `flang/concurrency/bench/node-death-targets.mjs` ввозит
  `flang/test/tempdir.mjs`, `flang/test/toolchain-guard.mjs`,
  `flang/test/uzel-osnastka.mjs`; его самого не зовёт ни ярлык, ни работа CI;
- `flang/concurrency/bench/gen.mjs` зовёт `flang/concurrency/bench/assemble.sh`;
  рядом лежит `flang/concurrency/bench/gen.flang`.

## Что должно быть

Сайт собирается и проверяется командами `bootstrap/flang …`; в
`.github/workflows/pages.yml` нет вызова `node`. Порядок для каждого файла:
программа на flang даёт тот же вывод и тот же код возврата на дереве, при
`--check` — тот же отказ на том же подложенном входе; ярлык и публикация
переключены; файл JavaScript удалён. Стенд смерти узла из
`flang/concurrency/bench/` либо получает программу на flang рядом с `flang/scripts/node-across-targets.fscript`,
либо снимается с записью в `docs/flang/concurrency/RESILIENCE.md`, где он
назван.

## Обходной путь

Держать Node на машине сборки сайта.

## Когда задача сделана

```
$ git ls-files 'docs/site/*.mjs' 'flang/concurrency/bench/*.mjs' | wc -l
0
$ grep -ac 'node ' .github/workflows/pages.yml
0
```

Допустимый остаток — `docs/site/search-check.mjs`, если он по-прежнему
проверяет тот же `docs/site/search.js`, который читает браузер; тогда счёт
равен 1 и причина названа в `docs/javascript-inventory.md`. `bootstrap/flang run-script site:check`
и `bootstrap/flang run-script surfaces:check` отвечают тем же кодом, что до сноса, и
краснеют на подложенной ошибке. Перечни `docs/javascript-inventory.md` и
`docs/tree-inventory.md` пересняты.

## Где живёт правка

`docs/site/` (программы на flang и снос файлов JavaScript), `ярлыки.flang`,
`.github/workflows/pages.yml`, `flang/concurrency/bench/`. После этого
снимаются `flang/scripts/binary.mjs` и `flang/scripts/direct-run.mjs` — когда не
останется ни одного ввозящего. Это сценарии и настройка, пересборка семени
(bootstrap regeneration) не нужна.

Отдельная задача, здесь не решается: оснастка в `scripts/`, `flang/scripts/` и
`flang/test/` — задача 0049; измеренные числа сайта устарели — задача 0044.
