---
номер: 1315
заголовок: Временные файлы проверок пишутся в дерево исходников и остаются там, когда прогон убит
статус: свободна
приоритет: P2
исполнитель: —
ветка: —
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
