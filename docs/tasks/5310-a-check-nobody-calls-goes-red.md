---
номер: 5310
заголовок: Девять проверок дерева не зовёт никто: ни CI, ни ярлык, ни хук, и одна из них в ведомости не названа
статус: свободна
приоритет: P2
исполнитель: —
ветка: —
команда: любая
карта: Как перепроверить всё это самому
рядом: 5204
нужность: проверка, которую не зовут ни CI, ни ярлык, ни хук, ломается незаметно
---

# 5310. Девять проверок дерева не зовёт никто: ни CI, ни ярлык, ни хук

Проверка `scripts/guards/checks-nobody-calls.fscript` (ярлык
`uncalled-checks:check`, работа `checks-nobody-calls` в `.github/workflows/ci.yml`)
сверяет файлы проверок дерева с ведомостью `scripts/ledgers/checks-nobody-calls.tsv`:
каждая проверка, которую не запускает никто, обязана быть в ней названа. Сегодня
красна и сама проверка: девятую незваную в ведомость не вписали. Открыто и то,
что незваные есть.

## Шаги воспроизведения

1. `bootstrap/flang io scripts/guards/checks-nobody-calls.fscript --plan Проверка --max-steps 4000000000`
2. `bootstrap/flang io scripts/guards/checks-nobody-calls.fscript --plan Перепись --max-steps 4000000000`
3. `bootstrap/flang io scripts/guards/checks-nobody-calls.fscript --plan Подлог --max-steps 4000000000`

## Что происходит

```
$ … --plan Проверка --max-steps 4000000000
НОВАЯ ПРОВЕРКА БЕЗ ЗОВА: flang/proof/probes/exact-fraction-in-targets/run.fscript
лежит в дереве, и ни одна работа CI, ни короткая команда, ни хук её не зовут …
                                                                   код 1
$ … --plan Перепись --max-steps 4000000000
  проверок в дереве   115
  зовут               106
  НЕ ЗОВУТ            9                                             код 0
$ … --plan Подлог --max-steps 4000000000
подлог пойман: подложный набор проб назван, код 1
  … НОВАЯ ПРОВЕРКА БЕЗ ЗОВА: flang/proof/probes/uncalled-forgery/run.fscript …
                                                                   код 1
```

Версия: flang 0.7.25, прогон 11 октября 2026.

Девять незваных; первая появилась коммитом `aaf81b243` (проба целой части дроби в
десяти целях) и в ведомости не названа, остальные восемь названы:

```
flang/proof/probes/exact-fraction-in-targets/run.fscript
flang/proof/probes/screen/run.fscript
flang/proof/probes/text-block/tokens.fscript
flang/scripts/count-guard.fscript
flang/scripts/direct-run-guard.fscript
flang/scripts/name-guard.fscript
scripts/guards/bidi-control-guard.fscript
scripts/guards/one-string-measure-guard.sh
scripts/guards/seed-parses-sources-guard.fscript
```

У восьми в ведомости записано состояние — зелена, красна или вердикта не даёт — и
довод, почему она не позвана. План «Перепись» теперь ведёт и вторую перепись —
судей (верхних функций «Проверить …» в `flang/self/`): верхних точек 204, зовут
193, не зовут 11, и ни одна из одиннадцати в ведомости не названа.

`flang/proof/probes/text-block/tokens.fscript` — прибор для правки лексера:
сверяет поток токенов лексера под интерпретатором с лексером, зашитым в семя
(ADR-0052). Без `--max-steps` вердикта не даёт («функция «Склеить» исчерпала
лимит шагов»), а цена растёт по размеру файла не линейно: на файле в 394 байта —
секунды, на файле 106 КБ — около десяти минут (ADR-0052). Зов на одном
крошечном файле был бы проверкой, которая не проверяет; чтобы её позвать, нужна
выборка, дающая вердикт за разумное время.

План «Подлог» показывает, что краснеть проверка умеет: подложный набор
`flang/proof/probes/uncalled-forgery/run.fscript` назван поимённо, код 1.

## Что должно быть

Каждую проверку дерева запускает CI, ярлык или хук; проверка, которая не нужна,
из дерева убрана. Ведомость незваных пуста.

## Обходной путь

Звать каждую из восьми руками; команды записаны в ведомости.

## Когда задача сделана

1. План «Проверка» отвечает кодом 0 (сегодня — 1: незваная проба целой части дроби
   в ведомости не названа и зова не имеет), план «Подлог» — кодом 1 с именем
   подложного набора.
2. Зелёная незваная `flang/proof/probes/screen/run.fscript` поставлена шагом в
   CI или ярлыком, её запись из ведомости убрана.
3. По каждой красной незваной решено одно из двух: долг, который она называет,
   закрыт и она поставлена в CI, либо она убрана из дерева.
4. План «Перепись» печатает `НЕ ЗОВУТ 0`.

## Где живёт правка

`scripts/ledgers/checks-nobody-calls.tsv`, `.github/workflows/binary.yml` и
`.github/workflows/ci.yml` (шаги запуска), `.flangrc`. Перепечатка не нужна.

**Следующий шаг.** Сначала `flang/proof/probes/exact-fraction-in-targets/run.fscript`:
дать ей зов — ярлык в `.flangrc` и шаг в `.github/workflows/binary.yml` рядом с
пробой `exact-integer-in-targets`, — или вписать в
`scripts/ledgers/checks-nobody-calls.tsv` с доводом. Проба, которая краснеет
сегодня, — план «Проверка» `scripts/guards/checks-nobody-calls.fscript`: код 1,
«НОВАЯ ПРОВЕРКА БЕЗ ЗОВА». Этот же план зовёт `uncalled-checks:check` из хука перед
пушем.
