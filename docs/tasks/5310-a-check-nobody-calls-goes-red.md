---
номер: 5310
заголовок: Проверка незваных проверок красна: новая незваная не в ведомости, и восемь проверок никто не зовёт
статус: свободна
приоритет: P2
исполнитель: —
ветка: —
команда: любая
карта: Как перепроверить всё это самому
рядом: 5204
нужность: проверка, которую не зовут ни CI, ни ярлык, ни хук, ломается незаметно
---

# 5310. Проверка незваных проверок красна: новая незваная не в ведомости, и восемь проверок никто не зовёт

Проверка `scripts/guards/checks-nobody-calls.fscript` (ярлык
`uncalled-checks:check`, работа `checks-nobody-calls` в
`.github/workflows/ci.yml:1829`) сверяет файлы проверок дерева с ведомостью
`scripts/ledgers/checks-nobody-calls.tsv`: каждая проверка, которую не запускает
никто, обязана быть в ней названа. Сама проверка написана и стоит в CI; открыто
то, что она сегодня показывает.

## Шаги воспроизведения

1. `bootstrap/flang io scripts/guards/checks-nobody-calls.fscript --plan Проверка --max-steps 4000000000`
2. `bootstrap/flang io scripts/guards/checks-nobody-calls.fscript --plan Перепись --max-steps 4000000000`
3. `bootstrap/flang io scripts/guards/checks-nobody-calls.fscript --plan Подлог --max-steps 4000000000`

## Что происходит

```
$ … --plan Проверка --max-steps 4000000000
НОВАЯ ПРОВЕРКА БЕЗ ЗОВА: flang/proof/probes/kernel-memo/run.fscript лежит в дереве, и ни
одна работа CI, ни короткая команда, ни хук, ни другой скрипт её не запускает. Либо
позвать, либо вписать в scripts/ledgers/checks-nobody-calls.tsv с доводом.
                                                                   код 1 за 10,8 с
$ … --plan Перепись --max-steps 4000000000
  проверок в дереве   98
  зовут               90
  НЕ ЗОВУТ            8                                             код 0 за 10,6 с
$ … --plan Подлог --max-steps 4000000000
подлог пойман: подложный набор проб назван, код 1
  … НОВАЯ ПРОВЕРКА БЕЗ ЗОВА: flang/proof/probes/uncalled-forgery/run.fscript …
                                                                   код 1 за 12,8 с
```

Восемь незваных:

```
flang/proof/probes/kernel-memo/run.fscript          в ведомости НЕ названа
flang/proof/probes/screen/run.fscript
flang/scripts/count-guard.fscript
flang/scripts/direct-run-guard.fscript
flang/scripts/name-guard.fscript
scripts/guards/bidi-control-guard.fscript
scripts/guards/one-string-measure-guard.sh
scripts/guards/seed-parses-sources-guard.fscript
```

Семь из восьми названы в ведомости, и там же записано состояние каждой — зелена,
красна или вердикта не даёт; эти состояния сняты на деревьях прежних дней и
сегодня не перепроверены. Восьмая, `kernel-memo`, в ведомости не названа вовсе:
из-за неё план «Проверка» и красен, а работа CI `checks-nobody-calls` падает.
Её собственный прогон снят: `cd flang/proof/probes/kernel-memo &&
../../../../bootstrap/flang io run.fscript --на-веру` — код 1 за 306,7 с,
«KERNEL MEMO CHANGES THE ANSWER», шесть мест на `flang/stdlib/lists.flang` и
`flang/stdlib/hashmap.flang`. То есть она КРАСНА по делу и дорога: в CI её не
поставить, пока долг не закрыт, и запись в ведомости ей нужна с этим доводом.

План «Подлог» показывает, что краснеть проверка умеет: подложный набор
`flang/proof/probes/uncalled-forgery/run.fscript` назван поимённо, код 1.

Версия: flang 0.7.23, 2 октября 2026, ствол f909a981.

## Что должно быть

План «Проверка» отвечает кодом 0. Каждую проверку дерева запускает CI, ярлык или
хук; проверка, которая не нужна, из дерева убрана. Ведомость незваных пуста.

## Обходной путь

Звать каждую из восьми руками; команды записаны в ведомости.

## Когда задача сделана

1. План «Проверка» отвечает кодом 0: `kernel-memo` либо позвана, либо вписана в
   ведомость с доводом. План «Подлог» по-прежнему отвечает кодом 1 с именем
   подложного набора.
2. Зелёная незваная `flang/proof/probes/screen/run.fscript` поставлена шагом в
   CI или ярлыком, её запись из ведомости убрана.
3. По каждой красной незваной решено одно из двух: долг, который она называет,
   закрыт и она поставлена в CI, либо она убрана из дерева.
4. План «Перепись» печатает `НЕ ЗОВУТ 0`.

## Где живёт правка

`scripts/ledgers/checks-nobody-calls.tsv`, `.github/workflows/binary.yml` и
`.github/workflows/ci.yml` (шаги запуска), `.flangrc`. Перепечатка не нужна.
