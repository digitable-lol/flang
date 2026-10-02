---
номер: 1315
заголовок: Временные файлы проверок пишутся в дерево исходников и остаются там, когда прогон убит
статус: сделана с оговоркой — забытая времянка даёт код 1 и путь, убранная код 0 (прогон 2 октября 2026); перечень мест НЕ опустел: шесть мест из семи остались в дереве, потому что `TMPDIR` для них негоден, и каждое названо в самом сторже с причиной
приоритет: P2
исполнитель: a
ветка: a/1315-check-temporaries-leave-the-source-tree
команда: первая
карта: Цена самосборки
рядом: 1301, 1306, 1312
нужность: оставшийся временный файл попадает в чужой коммит, сдвигает счёт файлов и роняет проверки, читающие дерево
---

# 1315. Временные файлы проверок пишутся в дерево исходников и остаются там, когда прогон убит

## Шаги воспроизведения

1. Найти скрипты, которые кладут временное внутрь дерева:

```
grep -rlaE 'flang-storozh|occupancy-probe|collision-probe' scripts flang/scripts
```

2. Спросить, закрыт ли `.gitignore` файл, который пишет в корень дерева
   `scripts/guards/occupancy-check.fscript`:

```
git check-ignore -q occupancy-probe.flang; echo $?
```

3. Спросить, есть ли проверка на забытые временные файлы:

```
ls scripts/guards | grep -ciE 'temp|stray|untracked'
```

## Что происходит

```
$ grep -rlaE 'flang-storozh|occupancy-probe|collision-probe' scripts flang/scripts
flang/scripts/binary-rules-guard.fscript
flang/scripts/binary.mjs
flang/scripts/word-guard.fscript
scripts/guards/module-name-guard.fscript
scripts/guards/occupancy-check.fscript
scripts/targets/cpp-target-face.flang
scripts/targets/target-collisions.sh                              код 0
$ git check-ignore -q occupancy-probe.flang; echo $?
1
$ ls scripts/guards | grep -ciE 'temp|stray|untracked'
0
```

Версия: flang 0.7.23. Дата прогона: 30 сентября 2026.

Шесть из семи названных файлов пишут в дерево (седьмой,
`scripts/guards/module-name-guard.fscript`, такие каталоги только исключает):
каталоги с приставкой «.flang-storozh-» в корне, в `flang/scripts` и в
`flang/test/fixtures`, файл occupancy-probe.flang в корне и
collision-probe.flang в `flang/self/bootstrap`. Убирают они за собой по выходу;
прогон, снятый по времени или по памяти, до уборки не доходит. Файл
occupancy-probe.flang при этом не закрыт `.gitignore` и уходит в коммит первым
же `git add -A`.

## Что должно быть

Временное живёт в каталоге из `TMPDIR`, вне дерева. Где это невозможно
(компилятор ищет ввозимые модули относительно дерева), файл закрыт
`.gitignore` и по имени видно, что он временный. Забытый временный файл в
дереве находит проверка, а не случайный коммит.

## Обходной путь

После снятого прогона смотреть `git status --ignored` и убирать остатки руками;
не пользоваться `git add -A`.

## Когда задача сделана

- Перечень мест из шага 1 либо пуст, либо каждое оставшееся место названо в
  проверке с причиной, почему временное обязано лежать в дереве.
- `git check-ignore -q occupancy-probe.flang; echo $?` печатает 0, либо файл
  больше не пишется в корень.
- Есть проверка в `scripts/guards`, заведённая ярлыком в `ярлыки.flang`:
  положили в дерево неотслеживаемый каталог с приставкой «.flang-storozh-»
  или файл с «probe» в имени — код 1 и путь; убрали — код 0.

## Где живёт правка

Скрипты из шага 1, `.gitignore`, новая проверка в `scripts/guards` и строка в
`ярлыки.flang`. Всё читается двоичным с диска, пересборка семени (bootstrap
regeneration) не нужна.

## Что сделано

Ветка `a/1315-check-temporaries-leave-the-source-tree` от `origin/dev`
`cec6de523`, двоичный flang 0.7.23, все прогоны ниже — 2 октября 2026 на этой
машине.

Оговорка в приёмке: пункт про `ярлыки.flang` устарел. С 0.7.24 короткие команды
живут в файле настроек `.flangrc` (`flang run-script <имя>`), а
функция-объявление ярлыка пишется в самом плане — так заведены оба новых ярлыка,
и `scripts/shortcut-collector.fscript --plan Сбор` сверяет одно с другим знак в
знак.

### Перечень мест: шесть из семи остались, и каждое названо в сторже с причиной

Унести эти времянки в `TMPDIR` НЕЛЬЗЯ, и причина записана в самом дереве —
`flang/scripts/binary.mjs:227`:

> Каталог заводится РЯДОМ с образцом, а не в `/tmp`: относительные пути в
> «использует … из "…"» считаются от места файла, и проба, унесённая в
> системный временный каталог, не связалась бы.

Поэтому перечень не опустел. Вместо пустоты — шесть мест, названных в самом
сторже функцией «Места», с причиной у каждого; сторож печатает их и зелёным, и
красным:

| пишет | след в дереве | почему не `TMPDIR` |
|---|---|---|
| `scripts/guards/occupancy-check.fscript` | `occupancy-probe.flang` в корне | замер занятости слов считает КОРПУС дерева; проба вне корпуса не мерилась бы |
| `scripts/targets/target-collisions.sh` | `flang/self/bootstrap/collision-probe.flang` | проба ввозит модули компилятора относительными путями из `flang/self/bootstrap`; свой рабочий каталог скрипт уже заводит через `mktemp -d -p "${TMPDIR:-/srv/tmp}"` |
| `scripts/targets/cpp-target-face.flang` | `.flang-storozh-lico-cpp-*` в корне | печать пробы ввозит лицо цели cpp относительным путём от места файла |
| `flang/scripts/binary-rules-guard.fscript` | `flang/scripts/.flang-storozh-emit-*` | подделки печатаются рядом со своим входом |
| `flang/scripts/word-guard.fscript` | `flang/test/fixtures/.flang-storozh-*` | проба заводится в каталоге разбираемого файла |
| `flang/scripts/binary.mjs` | `.flang-storozh-*` рядом с образцом | сказано в самом файле, цитата выше |

Седьмой файл шага 1, `scripts/guards/module-name-guard.fscript`, такие каталоги
только исключает и ничего не пишет. Восьмым в тот же `grep` теперь попадает сам
новый сторож — он эти имена называет, а не создаёт:

```
$ grep -rlaE 'flang-storozh|occupancy-probe|collision-probe' scripts flang/scripts | LC_ALL=C sort
flang/scripts/binary-rules-guard.fscript
flang/scripts/binary.mjs
flang/scripts/word-guard.fscript
scripts/guards/module-name-guard.fscript
scripts/guards/occupancy-check.fscript
scripts/guards/stray-temporaries-guard.fscript
scripts/targets/cpp-target-face.flang
scripts/targets/target-collisions.sh
```

### Проба в корне прощена `.gitignore`

ДО:

```
$ git check-ignore -q occupancy-probe.flang; echo $?
1
```

ПОСЛЕ:

```
$ git check-ignore -q occupancy-probe.flang; echo $?
0
```

Правило `/occupancy-probe.flang` стоит рядом с `.flang-storozh-*`, с записанной
причиной. Прощение делает слепым `git status`, но не сторожа — см. ниже.

### Новая проверка: `scripts/guards/stray-temporaries-guard.fscript`

ДО:

```
$ ls scripts/guards | grep -ciE 'temp|stray|untracked'
0
```

ПОСЛЕ:

```
$ ls scripts/guards | grep -ciE 'temp|stray|untracked'
1
```

Ярлыки в `.flangrc`, объявления — в самом плане (последние две функции файла):

```
script.stray-temporaries:check = bootstrap/flang io scripts/guards/stray-temporaries-guard.fscript --plan Проверка
script.stray-temporaries:forgery = bootstrap/flang io scripts/guards/stray-temporaries-guard.fscript --plan Подлог
```

Сторож спрашивает ДВА перечня git и склеивает их:
`git ls-files --others --exclude-standard` (видимое) и
`git ls-files --others --ignored --exclude-standard --directory` (прощённое).
Второй обязателен, и это измерено: с двумя подложенными времянками в дереве

```
$ git status --short | grep -cE 'storozh|probe'
0
```

— `git status` не видит ни одной, потому что обе прощены `.gitignore`. Поэтому
искать ими нечего.

Законных жильцов двое, и сторож называет их с причиной, а не краснеет на них:
`docs/benchmarks/proof-cost/.probe-bare` и `.probe-stub` — их пишет замер счёта
двадцати при каждом прогоне и переписывает поверх, а убрать за собой план не
может: поручения «Удалить файл» в словаре ввода-вывода нет.

### Зубы: прогоном, в обе стороны

```
$ mkdir -p .flang-storozh-zuby && printf 'модуль «Проба»\n' > .flang-storozh-zuby/проба.flang && : > occupancy-probe.flang
$ bootstrap/flang io scripts/guards/stray-temporaries-guard.fscript --plan Проверка
ЗАБЫТАЯ ВРЕМЯНКА ПРОВЕРКИ В ДЕРЕВЕ — 2
  · .flang-storozh-zuby/
  · occupancy-probe.flang
прогон сняли до уборки: уберите остатки руками и не берите дерево целиком через `git add -A` (задача 1315)
код 1
$ rm -rf .flang-storozh-zuby occupancy-probe.flang
$ bootstrap/flang io scripts/guards/stray-temporaries-guard.fscript --plan Проверка
забытых времянок проверок нет: путей просмотрено 1
код 0
```

Вторая проба — подложенный путь в памяти плана, `--plan Подлог`: код 1,
«подлог пойман». Обе стоят в `ci.yml`, работа `stray-temporaries`, каждая в
условии `if` с `exit 1` — поэтому
`sh scripts/guards/guards-without-forgery-probe.sh` числит сторожа в графе
«ПРОБА ПОЗВАНА», а не в долге:

```
$ sh scripts/guards/guards-without-forgery-probe.sh | grep stray
  stray-temporaries:check        ci.yml       stray-temporaries:forgery
$ sh scripts/guards/guards-without-forgery-probe.sh --check
сторожа без пробы порчи: 43, все названы в ведомости — сходится
код 0
```

Проба НА ДИСКЕ важнее пробы в памяти: в чистой выписке CI сторож зелен всегда, а
сторож, зелёный всегда, неотличим от выключенного. Поэтому шаг
`Probe stray temporaries on disk` сам кладёт времянку в выписку, требует кода 1
и убирает её за собой.

### Что это стоит и что проверено рядом

| прогон | код | время |
|---|---:|---:|
| `bootstrap/flang io scripts/guards/stray-temporaries-guard.fscript --plan Проверка` | 0 | 1,15 с (пик 105 МиБ) |
| `bootstrap/flang io scripts/guards/stray-temporaries-guard.fscript --plan Подлог` | 1 | 1,19 с |
| `bootstrap/flang check --proof scripts/guards/stray-temporaries-guard.fscript` | 0 | утверждений 12: доказано 12 |
| `bootstrap/flang io scripts/shortcut-collector.fscript --plan Сбор` | 0 | объявлений 136, расходится 0 |
| `sh scripts/guards/guards-without-forgery-probe.sh --check` | 0 | без пробы 43, сходится |
| `bootstrap/flang io scripts/guards/who-calls-the-guards.fscript --plan Check` | 0 | без зова 28, сходится |
| `sh scripts/guards/proved-share-vs-tree.sh` | 0 | строка описи `12\|12\|0\|0\|0` добавлена |
| `bootstrap/flang io scripts/guards/translit-file-names-guard.fscript --plan Проверка` | 0 | латинских имён 2417 → 2418; слово `temporaries` вписано в `scripts/ledgers/file-name-words.txt` |
| `bootstrap/flang io scripts/guards/prose-numbers-guard.fscript --plan Check` | 0 | примет 213, сошлось 213 — ни одно число в прозе не сдвинулось |
| `bootstrap/flang io flang/proof/tables-guard.fscript` | 0 | таблицы правил целы |

Чего эта правка НЕ делает. Сторож находит НЕОТСЛЕЖИВАЕМУЮ времянку; времянка,
уже затянутая в коммит через `git add -A`, становится отслеживаемой, и он
молчит — его место перед `git add`, а не после. Вторым домом ему просится
`.githooks/pre-commit` (там сейчас два плана); здесь он не поставлен, чтобы не
двигать числа прозы о хуке в этой же ветке.
