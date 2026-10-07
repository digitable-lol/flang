---
номер: 1425
заголовок: Правка одного файла задачи поднимет все 27 работ ci.yml — фильтра путей нет, а сам workflow выключен
статус: свободна
приоритет: P3
исполнитель: —
ветка: —
команда: первая
карта: Куда идём
рядом: 1117, 1424
нужность: фильтр понадобится в тот же час, когда workflow включат, и без него правка задачника снова поднимет 27 работ
---

# 1425. Правка одного файла задачи поднимет все 27 работ ci.yml — фильтра путей нет, а сам workflow выключен

## Шаги воспроизведения

1. Посмотреть, на что запускается `.github/workflows/ci.yml`:

```
grep -an -A5 "^on:" .github/workflows/ci.yml
grep -an "paths-ignore" .github/workflows/ci.yml .github/workflows/binary.yml .github/workflows/build-macos.yml
```

2. Посчитать работы и те из них, что идут только по тегу:

```
grep -ac "^    runs-on:" .github/workflows/ci.yml
grep -ac "if: github.ref_type == 'tag'" .github/workflows/ci.yml
```

3. Спросить GitHub, включён ли сам workflow и когда он ходил:

```
gh workflow list --all
gh run list --workflow=.github/workflows/ci.yml -L 1
```

## Что происходит

```
$ grep -an -A5 "^on:" .github/workflows/ci.yml
119:on:
120-  push:
121-    branches: [main, dev]
122-    tags: ["v*"]
123-  pull_request:
124-  workflow_dispatch:
$ grep -an "paths-ignore" .github/workflows/ci.yml .github/workflows/binary.yml .github/workflows/build-macos.yml
.github/workflows/build-macos.yml:59:    paths-ignore:
.github/workflows/binary.yml:115:    paths-ignore:
$ grep -ac "^    runs-on:" .github/workflows/ci.yml
27
$ grep -ac "if: github.ref_type == 'tag'" .github/workflows/ci.yml
4
$ gh workflow list --all
CI	disabled_manually	326607079
```

У `ci.yml` фильтра путей нет, и пуш, меняющий только `docs/tasks/**`, по
записанному в файле поднял бы все 27 работ. У соседних файлов фильтр стоит: они
не запускаются на `docs/tasks/**` и `.ai/**`.

Сейчас этот пуш не поднимает ни одной работы, и не потому, что фильтр есть:
сам workflow выключен руками (`disabled_manually`). Беда наступит в тот час,
когда workflow включат (задача 1117), и поэтому решать её надо до включения, а
не после.

Просто дописать `paths-ignore` нельзя. В блоке `push` рядом стоят `branches` и
`tags`, а GitHub читает `paths-ignore` и `tags` в одном блоке как «и», а не
«или». Четыре работы выпуска идут только по тегу (`if: github.ref_type ==
'tag' || github.event_name == 'workflow_dispatch'`), и с фильтром их запуск
стал бы зависеть ещё и от списка изменённых файлов. Прогон, который не
запустился, снаружи не отличить от зелёного.

## Что должно быть

Пуш, меняющий только `docs/tasks/**` или `.ai/**`, не запускает `ci.yml`, а пуш
тега `v*` по-прежнему запускает все четыре работы выпуска. Три способа, выбрать
должен человек:

1. Убрать `branches` и `tags`, оставить один `paths-ignore`, как в
   `.github/workflows/binary.yml`. Цена: прогон пойдёт на все ветки.
2. Поставить фильтр рядом с `tags` и принять, что коммит под тегом почти всегда
   меняет не только задачи. Цена: работы выпуска могут молча не запуститься.
3. Вынести четыре работы выпуска в отдельный файл со своим `on: push: tags:`, а
   в `ci.yml` оставить ветки с фильтром. Дороже остальных, но без ловушки.

## Обходной путь

Пока workflow выключен, обходной путь не нужен: правка задачника не поднимает
ничего. После включения обходного пути нет — прогон идёт целиком, его остаётся
только переждать или отменить руками.

## Когда задача сделана

Оба условия проверены прогоном на GitHub, а не чтением файла; для этого
workflow должен быть включён (задача 1117):

- коммит, меняющий только файл в `docs/tasks/`, не поднимает `ci.yml`
  (в списке прогонов для этого коммита его нет);
- пуш тега `v*` поднимает все четыре работы выпуска, и каждая дошла до конца.

## Где живёт правка

`.github/workflows/ci.yml`, блок `on:`; при третьем способе — ещё новый файл в
`.github/workflows/` с четырьмя работами выпуска. На двоичный правка не влияет,
пересборка семени (bootstrap regeneration) не нужна.
