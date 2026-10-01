---
номер: 1419
заголовок: Вне flang/proof остаются файлы с кириллическими именами, а правило требует английских
статус: свободна
приоритет: P3
исполнитель: —
ветка: —
команда: вторая
карта: Что мешает больше всего
рядом: 1420, 1186, 1418
нужность: кириллическое имя файла ломает пути в чужой оснастке, в архивах поставки и в адресах сайта
---

# 1419. Вне flang/proof остаются файлы с кириллическими именами, а правило требует английских

## Шаги воспроизведения

1. Сосчитать отслеживаемые файлы с кириллицей в последнем звене пути:

```
git -c core.quotepath=false ls-files | grep -P '[А-Яа-яЁё][^/]*$' | grep -v '^flang/proof/' | wc -l
```

2. Спросить проверку имён, сколько их записано долгом:

```
bootstrap/flang run-script cyrillic:check
```

## Что происходит

```
$ git -c core.quotepath=false ls-files | grep -P '[А-Яа-яЁё][^/]*$' | grep -v '^flang/proof/' | wc -l
60
$ bootstrap/flang run-script cyrillic:check
… "result":"кириллица в именах файлов: 61, все в ведомости — новых нет" …   код 0
```

Версия: flang 0.7.23. Дата прогона: 30 сентября 2026.

Проверка `scripts/guards/cyrillic-file-names-guard.fscript` не пускает новые
имена, а уже лежащие держит списком долга
`scripts/ledgers/cyrillic-file-names-debt.txt` (60 имён вне `flang/proof` и
один образец расширения внутри). Ни один файл не переименован: имя даёт автор
(задача 1186), предложенные ниже имена владельцем не утверждены.

```
docs/benchmarks/verdict-cache: второе-ядро.sh → second-kernel.sh; кеш.вставка → cache.insert;
  наложить.py → apply-cache.py; проба.flang → cache-probe.flang; пробы.sh → probes.sh;
  три-печати.sh → three-prints.sh
docs/examples/io: пакет.bin → packet.bin; фильтр-пакетов.flang → packet-filter.flang
docs/examples/pythagoras: квадрат-гипотенузы.flang → hypotenuse-square.flang;
  формула-евклида.flang → euclid-formula.flang
docs/examples/применение: итог-заказа.flang → order-total.flang; место-слева.flang → lvalue.flang;
  место-слева-вызов.flang → lvalue-with-call.flang; место-слева-по-ключу.flang → lvalue-by-key.flang;
  место-слева-с-отрезком.flang → lvalue-with-slice.flang; скидка.flang → discount.flang;
  скидка-на-вызове.flang → discount-on-call.flang
docs/спецификации: слой-отказов.flang → failure-layer.flang; чего-не-хватает-fts.md → what-fts-lacks.md;
  язык-доказательств.md → proof-language.md
flang/scripts: жаргон-образцы.flang → jargon-samples.flang; одна-линейка.py → one-gauge.py;
  породить-атомы.fscript → generate-atom-table.fscript; сличить-двух-сводителей.py → compare-two-mergers.py
flang/stdlib: образцы.flang → samples.flang
flang/test: ведомость.txt → ledger.txt; ведомость-self.txt → self-ledger.txt;
  ведомость-примеров.txt → examples-ledger.txt; владение-состоянием.flang и .sh → state-ownership;
  встроенные-формы.flang → builtin-forms.flang; жаргон.flang → jargon.flang; обход.sh → walk.sh;
  обход-self.sh → walk-self.sh; обход-примеров.sh → walk-examples.sh;
  прогонщик-корпуса.flang → corpus-runner.flang
flang/test/fixtures: скидки-в-подписки.fts → discounts-into-subscriptions.fts;
  001-предел-скидки.fts → 001-discount-limit.fts; 002-решение-о-возвратах.fts → 002-refund-decision.fts
scripts/guards: сторож-дарвина.fscript → darwin-guard.fscript
корень: ярлык → run; ярлыки.flang → shortcuts.flang
```

Решения владельца требуют: `ярлык` и `ярлыки.flang` — входная точка всех
команд дерева, ссылок на них больше всего; двенадцать уроков в `docs/tutor`,
у которых кириллица только в расширении; шесть заметок в `docs/zettel`,
переименование которых меняет указатель заметок и адреса сайта.

## Что должно быть

Имена файлов в дереве — английскими словами, без транслита: не obhod.sh, а
walk.sh. Правило касается имени файла, а не языка кода: кириллические
ключевые слова, имена модулей и функций остаются.

## Обходной путь

Обходного пути нет; новые кириллические имена проверка не пускает, старые
перечислены в списке долга.

## Когда задача сделана

Команда из шага 1 печатает 0. В списке долга остаётся только образец
расширения из `flang/proof`, и `bootstrap/flang run-script cyrillic:check` отвечает кодом 0.
План «Подлог» той же проверки краснеет на подложенном кириллическом имени.
Каждое переименование идёт вместе с правкой всех ссылок на файл, и проверка
ссылок после него зелёная.

## Где живёт правка

Переименование файлов и ссылок на них: `ярлыки.flang`, каталог `.github`,
страницы `docs`, сами проверки в `scripts/guards`. Пересборка семени
(bootstrap regeneration) не нужна: под `flang/self` и `flang/src/emit` нет ни
одного из этих файлов. Каталоги с кириллическими именами и файлы под
`flang/proof` в задачу не входят.
