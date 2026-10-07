---
номер: 1117
заголовок: Workflow CI выключен, и какие из его работ красны на нынешнем дереве, не измерено
статус: в работе
приоритет: P2
исполнитель: a
ветка: a/1117-ci-jobs-measured-locally
команда: вторая
карта: Что мешает больше всего
рядом: 1425, 8651
нужность: включать выключенный workflow вслепую нельзя, а без него двадцать семь проверок не гоняет никто
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

3. Каждую работу `ci.yml` прогнать локально: в отдельной подоболочке, с
   заданной переменной `GITHUB_OUTPUT` (шаги кончаются `exit` и пишут в неё),
   строками `run:` из файла.

## Что происходит

```
$ gh workflow list --repo digitable-lol/flang --all
…
Target twins	active	365382689
CI	disabled_manually	326607079                                 код 0
$ grep -ac 'runs-on' .github/workflows/ci.yml
27                                                                код 0
$ gh run view <номер захода> … --json jobs
scheduler-across-targets	success
supervisor-across-targets	success
conc-link-emit	failure
node-across-targets	failure                                       код 0
```

Работы `ci.yml` на GitHub не запускаются. По локальному прогону всех работ,
кроме `vremyanki` и `lean-rules-guard` (они не мерены):

- зелены: `semya`, `proza`, `kirillica`, `translit`, `nastroyki`, `zadachnik`,
  `postoyannye`, `stolknoveniya`, `zhargon`, `test`, `licensing`, `pechat`,
  `korpus`, `progon`, `granica`, `oblast`, `pravila-spisok`, `pravila`,
  `klyuchi`, `target-link`, `seed-verdicts`, `uncalled`;
- `links` — код 1: битые ссылки в документации; у работы стоит
  `continue-on-error: true`, тег и пуш она не держит;
- `stale-pages` — код 1: страницы `docs/course/**` объявляют прошлую версию
  двоичного; работа идёт только по метке и по кнопке;
- `neznanye-storozha` — код 1 на шаге «Check jargon»: внутренние слова на
  печатаемых страницах `docs/site/registry*.md` и `docs/site/packages*.md`
  (задача 2325).

Что локальный прогон не покрывает: матрицу версий Node у работы `test` (локально
одна версия), загрузку пакетов шагом `apt-get` на раннере, шаг «Check verdict
cache» на пути выпуска (краснеет только на метке с заданной
`FLANG_KESH_PRIGOVOROV`).

В «Target twins» красны две работы из четырёх, локальный прогон даёт тот же
исход:

- `node-across-targets` — полный узел работает на 8 целях из 9, не сходится
  `elixir`: «ответ с узла опоры не поменял состояния «Счётчика»»;
- `conc-link-emit` — `flang/concurrency/node-benchmark.flang` не печатается в
  JavaScript, отказ `FLANG_SVYAZ_NE_NAPECHATANO`.

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
подоболочке и с заданной переменной `GITHUB_OUTPUT`. На каждую работу есть
строка: команда, код возврата, причина красноты. Красных работ без задачи нет
(сегодня без задачи `links` и `stale-pages`). Для `node-across-targets` и
`conc-link-emit` из «Target twins» причина провала названа и заведена задачей
либо исправлена; следующий заход

```
gh run list --repo digitable-lol/flang --workflow target-twins.yml --limit 1
```

показывает `success`. Сам workflow CI эта задача не включает.

## Где живёт правка

`.github/workflows/ci.yml` и `.github/workflows/target-twins.yml` — только
читаются; правки красных работ идут в те проверки, которые они зовут
(`scripts/guards`, `flang/proof/rules-match.fscript`, страницы `docs/site`).
Пересборка семени (bootstrap regeneration) не нужна.
