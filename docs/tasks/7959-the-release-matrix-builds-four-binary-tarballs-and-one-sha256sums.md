---
номер: 7959
заголовок: Выпуск несёт одно вложение — архив исходников C; готовых двоичных под четыре тройки и файла SHA256SUMS у него нет
статус: свободна
приоритет: P1
исполнитель: —
ветка: —
команда: вторая
карта: Что мешает больше всего
рядом: 7715, 1098, 1710, 8128, 1504
нужность: по ADR-0067 выпуск несёт готовые двоичные под Linux и macOS, как у dust; без них три канала из трёх собирают из исходников по 2–6 минут
---

# 7959. Выпуск несёт одно вложение — архив исходников C; готовых двоичных под четыре тройки и файла SHA256SUMS у него нет

Решение: [ADR-0067](../adr/0067-the-release-ships-binaries-for-four-triples-from-one-seed.md),
раздел 2.1 — матрица выпуска.

## Шаги воспроизведения

1. Спросить у GitHub вложения последнего выпуска:
   `gh release view v0.7.24 --json assets --jq '.assets[] | "\(.name) \(.size)"'`
2. Посчитать работы и раннеры в работе выпуска:
   `grep -n 'runs-on' .github/workflows/release.yml`
3. Поискать общий файл хешей: `grep -c 'SHA256SUMS' .github/workflows/release.yml`
4. Спросить у собранного двоичного, что он знает о себе: `bootstrap/flang --version`

## Что происходит

```
$ gh release view v0.7.24 --json assets --jq '.assets[] | "\(.name) \(.size)"'
flang-0.7.24-c.tar.gz 5410663                                   код 0
$ grep -n 'runs-on' .github/workflows/release.yml
74:    runs-on: ubuntu-latest                                   код 0
$ grep -c 'SHA256SUMS' .github/workflows/release.yml
0                                                               код 1
$ bootstrap/flang --version
flang 0.7.24
оболочка 9f361fce: правит строку (стрелки, слова, история, Tab), цвет digitable
                                                                код 0
```

Одно вложение, одна работа на одном раннере, файла хешей нет. Двоичный называет
версию и отпечаток оболочки (sha256 файла `flang_repl.c`), но не отпечаток семени
(`scripts/seed-fingerprint`) и не свою тройку.

Сборка семени на раннерах (шаг «Build bootstrap», `gh run view <прогон> --json jobs`):
`ubuntu-latest`, `make -C bootstrap -j4` — около 6 мин; `macos-latest` (arm64,
3 ядра, без `-flto`) — около 2,5 мин. На `ubuntu-24.04-arm` и `macos-15-intel`
семя не собиралось, времени сборки там нет.

Версия: `flang 0.7.24`.

## Что должно быть

ADR-0067, раздел 2.1: четыре работы матрицы — `linux-x86_64`, `linux-aarch64`,
`macos-aarch64`, `macos-x86_64` — каждая делает `make -C bootstrap` из ОДНОГО семени
с флагами формулы и плагина (`-std=c99 -Wall -Wextra -Werror -pedantic -O2`) и
кладёт `flang-<версия>-<ось>-<арх>.tar.gz` с раскладкой установки (`bin/flang`,
`lib/libcompiler_flang.a`, `include/*.h`, `share/man/man1/flang.1`,
`share/flang/<цель>/…`, `LICENSE`, `seed-fingerprint.txt`). Пятая работа собирает
`SHA256SUMS` по пяти вложениям (четыре двоичных + архив C) и выкладывает всё
разом; хеши — только с раннера (задача 7715: у себя они не повторяются).
`workflow_dispatch` с ветки собирает четыре архива и не выкладывает ничего —
как с архивом C (шаг «Upload release archive» идёт только на теге).

Раннеры: `ubuntu-22.04`, `ubuntu-22.04-arm` (нижняя граница glibc 2.35 — довод в
ADR), `macos-latest` с `MACOSX_DEPLOYMENT_TARGET`, `macos-15-intel`. `macos-13`
GitHub снял — его в матрице быть не может.

## Обходной путь

Три канала собирают из исходников сами: `brew install digitable-lol/tap/flang`
(сборка около 3,5 мин на `macos-latest`),
`asdf install flang 0.7.24`, клон и `make -C bootstrap -j4` (около 2 мин
в 4 потока, gcc 15).

## Когда задача сделана

1. `gh release view v<X> --json assets --jq '.assets | length'` отвечает `6`:
   четыре `flang-<X>-{linux,macos}-{x86_64,aarch64}.tar.gz`, `flang-<X>-c.tar.gz`,
   `SHA256SUMS`.
2. `sha256sum -c SHA256SUMS` над скачанными вложениями — пять строк `OK`, код 0.
3. На каждом из четырёх раннеров `bin/flang --version | head -1` равен
   `flang <X>`, а вторая строка («оболочка …») совпадает на всех четырёх знак в
   знак — одно семя даёт один отпечаток.
4. Проба порчи: вложение, в котором подменён один байт, краснит шаг сверки
   хешей ДО выкладки; шаг, который не краснеет на подлоге, не считается.
5. Сухой прогон `workflow_dispatch` с ветки: четыре архива собраны, шаг выкладки
   `skipped`.

## Где живёт правка

`.github/workflows/release.yml` — работа `release` делится на матрицу и работу
сборки `SHA256SUMS`; `.github/actions/release-binary/` — составное действие по
образцу `release-archive` (раскладка, повторимый `tar`, хеш); `packaging/flang.1`
и `LICENSE` едут как есть. Перепечатка не нужна. Строка семени и тройки в
`flang --version` — отдельно (ADR-0067, раздел 2.1, ступень 2): правка
`flang/src/emit/c/flang_repl.c` доезжает до двоичного только перепечаткой.
