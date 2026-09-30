---
номер: 5310
заголовок: Проверка незваных проверок красна: три записи её ведомости устарели, и восемь проверок никто не зовёт
статус: свободна
приоритет: P2
исполнитель: —
ветка: —
команда: любая
карта: Как перепроверить всё это самому
рядом: 5204
нужность: проверка, которую не зовут ни CI, ни ярлык, ни хук, ломается незаметно
---

# 5310. Проверка незваных проверок красна: три записи её ведомости устарели, и восемь проверок никто не зовёт

Проверка `scripts/guards/checks-nobody-calls.fscript` (ярлык
`незваные:проверка`, работа `checks-nobody-calls` в `.github/workflows/ci.yml`)
сверяет файлы проверок дерева с ведомостью
`scripts/ledgers/checks-nobody-calls.tsv`: каждая проверка, которую не запускает
никто, обязана быть в ней названа. Сама проверка написана и стоит в CI; открыто
то, что она сегодня показывает.

## Шаги воспроизведения

1. `bootstrap/flang io scripts/guards/checks-nobody-calls.fscript --plan Проверка --max-steps 4000000000`
2. `bootstrap/flang io scripts/guards/checks-nobody-calls.fscript --plan Перепись --max-steps 4000000000`

## Что происходит

```
$ bootstrap/flang io scripts/guards/checks-nobody-calls.fscript --plan Проверка --max-steps 4000000000
ЗАПИСЬ СТАЛА НЕПРАВДОЙ: flang/proof/probes/orders/run.fscript числится без зова, а её зовут. …
ЗАПИСЬ СТАЛА НЕПРАВДОЙ: flang/proof/probes/run/run.sh числится без зова, а такой проверки в дереве больше нет. …
ЗАПИСЬ СТАЛА НЕПРАВДОЙ: scripts/guards/run-verdict-debt-guard.sh числится без зова, а такой проверки в дереве больше нет. …     код 1
$ bootstrap/flang io scripts/guards/checks-nobody-calls.fscript --plan Перепись --max-steps 4000000000
  проверок в дереве   92
  зовут               84
  НЕ ЗОВУТ            8                                                                   код 0
```

Восемь незваных:

```
flang/proof/probes/screen/run.fscript
flang/scripts/count-guard.fscript
flang/scripts/direct-run-guard.fscript
flang/scripts/name-guard.fscript
scripts/guards/bidi-control-guard.fscript
scripts/guards/no-comments-guard.fscript
scripts/guards/one-string-measure-guard.sh
scripts/guards/seed-parses-sources-guard.sh
```

Состояние каждой из восьми (зелена, красна, вердикта не даёт) записано в
ведомости и сегодня не перепроверено.

Версия: flang 0.7.23, 30 сентября 2026.

## Что должно быть

План «Проверка» отвечает кодом 0. Каждую проверку дерева запускает CI, ярлык или
хук; проверка, которая не нужна, из дерева убрана. Ведомость незваных пуста.

## Обходной путь

Звать каждую из восьми руками; команды записаны в ведомости.

## Когда задача сделана

1. Три устаревшие записи убраны из ведомости, план «Проверка» отвечает кодом 0,
   план «Подлог» — кодом 1 с именем подложного набора.
2. Зелёные незваные (`flang/proof/probes/screen/run.fscript`,
   `scripts/guards/no-comments-guard.fscript`) поставлены шагами в CI или
   ярлыками, их записи убраны.
3. По каждой красной незваной решено одно из двух: долг, который она называет,
   закрыт и она поставлена в CI, либо она убрана из дерева.
4. План «Перепись» печатает `НЕ ЗОВУТ 0`.

## Где живёт правка

`scripts/ledgers/checks-nobody-calls.tsv`, `.github/workflows/binary.yml` и
`.github/workflows/ci.yml` (шаги запуска), `ярлыки.flang`. Перепечатка не нужна.
