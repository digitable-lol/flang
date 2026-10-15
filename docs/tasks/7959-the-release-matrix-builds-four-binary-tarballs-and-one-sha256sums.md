---
номер: 7959
заголовок: Выпуск несёт одно вложение — архив исходников C; готовых двоичных под четыре тройки и файла SHA256SUMS у него нет
статус: сделана на ветке — четыре архива собраны и запущены каждый на своём раннере, «оболочка 9f361fce» на всех четырёх, SHA256SUMS над девятью вложениями сходится, подменённый байт ловится до выкладки (ручные прогоны 38655714568 и 38667409182, 15 октября 2026); шесть-и-больше вложений выпуска появятся тегом v0.7.29
приоритет: P1
исполнитель: a
ветка: a/prebuilt-binaries
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
   `gh release view v0.7.25 --json assets --jq '.assets[] | "\(.name) \(.size)"'`
2. Посчитать работы и раннеры в работе выпуска:
   `grep -n 'runs-on' .github/workflows/release.yml`
3. Поискать общий файл хешей: `grep -c 'SHA256SUMS' .github/workflows/release.yml`
4. Спросить у собранного двоичного, что он знает о себе: `bootstrap/flang --version`

## Что происходит

```
$ gh release view v0.7.25 --json assets --jq '.assets[] | "\(.name) \(.size)"'
flang-0.7.25-c.tar.gz 5483859                                   код 0
$ grep -n 'runs-on' .github/workflows/release.yml
74:    runs-on: ubuntu-latest                                   код 0
$ grep -c 'SHA256SUMS' .github/workflows/release.yml
0                                                               код 1
$ bootstrap/flang --version
flang 0.7.25
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

Версия: `flang 0.7.25` (снято 11 октября 2026).

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
`asdf install flang 0.7.25`, клон и `make -C bootstrap -j4` (около 2 мин
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

Следующий шаг: `.github/workflows/release.yml` — работа `release` (одна, `runs-on: ubuntu-latest`,
строка 74) делится на матрицу четырёх троек, и рядом с `.github/actions/release-archive/`
заводится `.github/actions/release-binary/`. Проба, которая красна сегодня:
`gh release view v0.7.25 --json assets --jq '.assets | length'` отвечает 1, а не 6.

## Чем закрыта

Ветка `a/prebuilt-binaries`, коммиты `ci(release): four prebuilt tarballs, deb, rpm and one sha256sums`
и `ci(release): each tarball is checked against the hash of its runner`. Владелец изменил решение
ADR-0067 в трёх местах, и сделано по его слову:

- имя пакета — `flang-package` (имя `flang` занято LLVM Flang в homebrew/core и AUR), вложения
  `flang-package-<версия>-{linux-x86_64,linux-aarch64,macos-arm64,macos-x86_64}.tar.gz`;
- Linux собирается статически с musl в контейнере `alpine:3.20` на `ubuntu-24.04` и
  `ubuntu-24.04-arm`, а не динамически на 22.04: один двоичный идёт на любом дистрибутиве, и
  `file` на раннере это проверяет; macOS — `macos-14` и `macos-15-intel` флагами формулы;
- архив несёт `bin/flang`, `bin/flangtutor`, `share/flang/<цель>`, `share/flang-tutor`,
  `share/man/man1/flang.1`, `LICENSE`; `lib/` и `include/` — только на macOS (архив под musl
  чужим `cc` на glibc не свяжется); `seed-fingerprint.txt` не кладётся.

Сверх карточки в выпуск едут deb и rpm (nfpm) — всего девять вложений с архивом C.

Пункты «Когда задача сделана», снято прогоном 38655714568 (ветка, 15 октября 2026):

1. Число вложений выпуска — **?** до тега v0.7.29: ручной прогон ничего не выкладывает.
   Работа `packages` собрала девять файлов и `SHA256SUMS` (вложение прогона `release-assets`).
2. `sha256sum -c SHA256SUMS` над скачанными вложениями прогона — девять строк `OK`, код 0;
   хеш архива C `6a60dda8…` совпал с формулой Homebrew знак в знак.
3. `flang --version` на четырёх раннерах: первая строка `flang 0.7.28`, вторая
   `оболочка 9f361fce: …` — одна и та же на всех четырёх.
4. Проба порчи — шаг «Check prebuilt checksums» меняет байт в копии архива и требует, чтобы
   `sha256sum -c` отказал; прогон 38667409182.
5. Сухой прогон: четыре архива собраны, шаг «Upload prebuilt builds» `skipped`.

Время работ (прогон 38655714568): linux-x86_64 3 мин 26 с, macos-arm64 5 мин 32 с,
macos-x86_64 10 мин 23 с, linux-aarch64 16 мин 12 с.
