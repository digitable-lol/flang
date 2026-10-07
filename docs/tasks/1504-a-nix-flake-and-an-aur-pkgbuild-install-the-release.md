---
номер: 1504
заголовок: Ни Nix, ни Arch не ставят flang: в дереве нет flake.nix и PKGBUILD, а имя `flang` в AUR занято Фортраном от LLVM
статус: свободна
приоритет: P3
исполнитель: —
ветка: —
команда: вторая
карта: Что мешает больше всего
рядом: 7959, 1098, 8128
нужность: владелец решил публиковаться во все менеджеры, куда дотягиваемся без Windows; Nix и AUR дотягиваются из того же архива C и не требуют ни Node, ни своих раннеров
---

# 1504. Ни Nix, ни Arch не ставят flang: в дереве нет flake.nix и PKGBUILD, а имя `flang` в AUR занято Фортраном от LLVM

Решение: [ADR-0067](../adr/0067-the-release-ships-binaries-for-four-triples-from-one-seed.md),
раздел 2.5 — новые каналы. Делается ПОСЛЕ матрицы выпуска и после того, как
владелец назовёт имя пакета для AUR.

## Шаги воспроизведения

1. `ls flake.nix packaging/aur`
2. `command -v nix makepkg` — есть ли инструменты на машине разработки.
3. Открыть `https://aur.archlinux.org/packages/flang` — кто занимает имя.

## Что происходит

```
$ ls flake.nix packaging/aur
ls: cannot access 'flake.nix': No such file or directory
ls: cannot access 'packaging/aur': No such file or directory   код 2
$ command -v nix makepkg
                                                                код 1
```

Ни флейка, ни PKGBUILD в дереве нет; на машине разработки нет ни `nix`, ни
`makepkg`, то есть проверять оба канала можно только в CI. В AUR пакет `flang` — «ground-up implementation of a Fortran front end
written in modern C++» (LLVM Flang); в `homebrew-core` имя `flang` занято им
же — потому наш кран и зовётся полным именем `digitable-lol/tap/flang`.

## Что должно быть

**Nix.** `flake.nix` в корне дерева: пакет `flang` из архива C выпуска
(`fetchurl` с `sha256` из `SHA256SUMS`), сборка — `make` с флагами формулы,
установка — раскладка как у формулы (`bin`, `lib`, `include`, `share/flang`,
`share/man`). `nix profile install github:digitable-lol/flang` и `nix run` дают
`flang --version` = версия выпуска. `flake.lock` коммитится; обновляет его
`bump-version` вместе с версией и хешем. Сборка из исходников — нарочно: Nix
сам и есть сборка из описания, готовый двоичный ему чужероден.

**AUR.** `packaging/aur/PKGBUILD` и `.SRCINFO` для пакета с именем, которое
назовёт владелец (предложение ADR: `flang-digitable`; `conflicts=('flang')`,
потому что исполняемый файл тот же `flang`), источник — архив C с `sha256sums`,
сборка — `make` с флагами формулы, `package()` — та же раскладка. Второй пакет
`-bin` из готового двоичного — не в этой задаче. Публикация в AUR требует
учётной записи и ключа SSH владельца; автоматика (`KSXGitHub/github-actions-deploy-aur`
с секретом) — отдельное решение владельца, до него `.SRCINFO` сверяется в CI,
а пушит владелец.

## Обходной путь

Пользователь Nix: `nix-shell -p gcc gnumake`, клон, `make -C bootstrap`.
Пользователь Arch: `base-devel`, то же. Оба — вручную, без менеджера.

## Когда задача сделана

1. Работа CI на `ubuntu-latest` с установщиком Nix: `nix build .#flang` и
   `result/bin/flang --version | head -1` = `flang <X>`; `nix flake check` зелен.
2. Работа CI в контейнере `archlinux:base-devel`: `makepkg -si --noconfirm` из
   `packaging/aur`, `flang --version | head -1` = `flang <X>`;
   `makepkg --printsrcinfo` совпадает с `.SRCINFO` знак в знак (иначе — красное).
3. Прибор паритета (задача об install-parity) даёт `расхождений 0` между
   установкой Nix и установкой из готового двоичного на `ubuntu-latest`.
4. Проба порчи: `sha256` в `flake.nix` или `sha256sums` в PKGBUILD с подменённым
   знаком — сборка красная по хешу, не по компилятору.
5. `bump-version` поднимает версию и хеш в `flake.nix` и `PKGBUILD` тем же
   прогоном, что в формуле; `homebrew-formula:check`-подобный сторож сверяет
   три места.

## Где живёт правка

`flake.nix`, `flake.lock`, `packaging/aur/PKGBUILD`, `packaging/aur/.SRCINFO`,
`scripts/release/bump-version.fscript`, новая работа в `.github/workflows/`
(по образцу `install-path.yml`), страницы установки — строки Nix и AUR в
таблице каналов. Перепечатка не нужна.
