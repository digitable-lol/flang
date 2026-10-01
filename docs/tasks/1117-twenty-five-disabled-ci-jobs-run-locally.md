---
номер: 1117
заголовок: Workflow CI выключен, и какие из его работ красны на нынешнем дереве, не измерено
статус: свободна
приоритет: P2
исполнитель: —
ветка: —
команда: вторая
карта: Что мешает больше всего
рядом: 1425, 8651
нужность: включать выключенный workflow вслепую нельзя, а без него двадцать пять проверок не гоняет никто
---

# 1117. Workflow CI выключен, и какие из его работ красны на нынешнем дереве, не измерено

## Шаги воспроизведения

1. Состояние workflow и число работ в `.github/workflows/ci.yml`:

```
gh workflow list --repo digitable-lol/flang --all
grep -ac 'runs-on' .github/workflows/ci.yml
```

2. Последний заход `.github/workflows/target-twins.yml`:

```
gh run list --repo digitable-lol/flang --workflow target-twins.yml --limit 1
gh run view <номер захода> --repo digitable-lol/flang --json jobs --jq '.jobs[] | "\(.name)\t\(.conclusion)"'
```

## Что происходит

```
$ gh workflow list --repo digitable-lol/flang --all
…
Target twins	active	365382689
CI	disabled_manually	326607079                                 код 0
$ grep -ac 'runs-on' .github/workflows/ci.yml
25                                                                код 0
$ gh run view 36408387800 … --json jobs
supervisor-across-targets	success
node-across-targets	failure
conc-link-emit	failure
scheduler-across-targets	success                                   код 0
```

Версия: flang 0.7.23. Дата прогона: 30 сентября 2026.

Двадцать пять работ `ci.yml` на GitHub не запускаются. Последний полный
локальный прогон снят на flang 0.7.21: красны были `links`, `corpus-runner`,
`rules-check`, `stale-pages` и `seed-verdicts`. На нынешнем дереве перепроверена
одна из них:

```
$ bootstrap/flang io scripts/guards/corpus-runner.fscript --trust
… "прогонщик корпуса: утверждений ведомости 39, все сошлись; …"   код 0
```

Остальные четыре не перепроверены: прогон каждой дольше минуты. У включённого
«Target twins» в единственном заходе красны две работы из четырёх.

## Что должно быть

У каждой работы `ci.yml` и `target-twins.yml` известен исход на нынешнем
дереве: зелена, красна или не запускается, с причиной. На каждую красную работу
есть задача либо правка. Тогда решение включить CI принимается по таблице, а не
вслепую.

## Обходной путь

Часть тех же проверок гоняют `.githooks/pre-push.fscript` и
`.github/workflows/binary.yml`. Остальные работы `ci.yml` запускают руками по
одной, строкой `run:` из файла.

## Когда задача сделана

Каждая работа `ci.yml` прогнана локально на нынешнем дереве, каждая в отдельной
подоболочке и с заданной переменной `GITHUB_OUTPUT` (шаги кончаются `exit` и
пишут в неё). На каждую работу есть строка: команда, код возврата, причина
красноты. Красных работ без задачи нет. Для `node-across-targets` и
`conc-link-emit` из «Target twins» причина провала названа и заведена задачей
либо исправлена; следующий заход

```
gh run list --repo digitable-lol/flang --workflow target-twins.yml --limit 1
```

показывает `success`. Сам workflow CI эта задача не включает.

## Где живёт правка

`.github/workflows/ci.yml` и `.github/workflows/target-twins.yml` — только
читаются; правки красных работ идут в те проверки, которые они зовут
(`scripts/guards`, `flang/proof/rules-match.sh`, страницы `docs/site`).
Пересборка семени (bootstrap regeneration) не нужна.
