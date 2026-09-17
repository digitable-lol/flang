---
номер: 3570
заголовок: package.json уходит из дерева — читатели переведены на .flangrc и печать пакета, сторож красен на его появлении
статус: сделана (17 сентября 2026, ветка a/3570-package-json-leaves-the-tree)
исполнитель: a
ветка: a/3570-package-json-leaves-the-tree
команда: вторая
карта: Что мешает больше всего
рядом: 1423, 8649, 3420
нужность: 1 — слово владельца 17 сентября 2026: «package.json выбросить»; файл производный, версия уже живёт в .flangrc и scripts/release/emit-package.flang
---

# 3570. package.json уходит из дерева

Слова владельца (17 сентября 2026): package.json выбросить, заменив читателей.

## Чем измерено

Дерево `main` `cbfaf3899`, 17 сентября 2026, `git grep -n package.json -- . ':!docs' ':!*.md'`.

Файл `package.json` в корне — 16 строк: имя, `private`, версия 0.7.19, `type: module`,
лицензия, два адреса, `engines`. npm из дерева убран 3 сентября 2026 (задача 8649);
файл печатается из `scripts/release/emit-package.flang` (`./ярлык пакет`), а версия
для оболочки уже читается без JSON: `sh scripts/flangrc.sh версия` → `0.7.19`
(ключ `версия` в `.flangrc`, разносит `./ярлык версия <N>`).

Читатели корневого файла в живом коде:

| место | что читает | чем заменить |
|---|---|---|
| `.github/actions/release-archive/action.yml:96` | версию `sed`-ом | `sh scripts/flangrc.sh версия` |
| `.github/workflows/release.yml:115–196` | версию `sed`-ом, шаг «двоичный называет ту же версию» | то же |
| `.github/workflows/install-path.yml:73,85,257–284` | фильтр путей и шаг «FLANG_VERSION совпадает с package.json» | сверять с `.flangrc` |
| `.github/workflows/ci.yml:1506–1524` | шаг «package.json сходится с объявлением пакета» и подлог | сторож «файла нет» |
| `scripts/release/emit-package.flang` | печатает файл; ярлыки `пакет`, `пакет:проверка` | оставить печать `.flangrc`-ключей либо снести планы печати |
| `scripts/guards/version-guard.flang` (`./ярлык версия:проверка`) | «FLANG_VERSION совпадает с package.json» | сверять с `.flangrc` |
| `scripts/guards/version-derivations-guard.sh`, `scripts/release/bump-version.sh` | разносят версию в package.json | убрать это место из списка |
| `docs/site/site-numbers.mjs`, `scripts/guards/homebrew-formula-guard.flang` | версию | `.flangrc` |
| `flang/scripts/code-guard.flang:226,244` | строка «где» с package.json | проверить, что это |
| `flang/scripts/node-across-targets.flang:28`, `supervisor-across-targets.flang:26` | печатают `{"type":"module"}` рядом с выводом цели JS | корневой файл не читают — не трогать |
| `flang/concurrency/bench/{hot-swap,node-death}.sh` | печатают `{"type":"module"}` во временный каталог | корневой файл не читают — не трогать |
| `changelog.json:4758` | история | не трогать |
| `bootstrap/flang_repl.c` | слово в напечатанном C — источник `flang/src/emit/c` | стек overagent'а: сказать, не править |
| `flang/self/cli.flang:34,1362`, `flang/self/emit-js.flang:4410,4495` | печать цели JS кладёт свой package.json рядом с выводом | стек K, корневого файла не читают |

## Как поймём, что сделано

- `git ls-files package.json` пуст;
- `./ярлык версия` печатает `0.7.19` без package.json; `./ярлык версия:проверка` код 0;
- сторож (`sh scripts/guards/no-package-json-guard.sh` или рядом) красен, когда файл
  подложен, и зелен, когда его нет — показано прогоном;
- работы «Двоичный», «Путь установки», «Выпуск» зелены на ветке (3 из 3);
- `sh .githooks/pre-push` зелен; ярлыки `пакет`/`пакет:проверка` либо переписаны на
  `.flangrc`, либо сняты с доводом в `ярлыки.flang`.

## Чего задача НЕ делает

Не трогает печать цели JS (`flang/self/emit-js.flang` кладёт package.json рядом с
напечатанным узлом — это файл вывода, а не дерева). Не правит `bootstrap/**`.

## Где записано то, что не пишут в коде (17 сентября 2026)

В `.flang` комментариев не пишут — объясняют именем, типом, `обеспечивает` и `примером`
(правило `.claude/skills/flang-code`, сторож `scripts/guards/no-comments-guard.sh`).
При переносе читателей 17 сентября в семь программ попало 17 строк объяснений; они сняты
тем же днём, а сказанное в них записано здесь:

- **Откуда читаются пять значений.** Имя, версия, лицензия, адрес склада и адрес бед —
  ключи `имя`, `версия`, `лицензия`, `склад`, `беды` в `.flangrc`. Разносит их туда
  `./ярлык версия <N>` из единственного источника `scripts/release/emit-package.flang`
  (функции «Имя пакета», «Версия», «Лицензия», «Адрес склада», «Адрес бед»). Читают:
  `docs/site/build.flang`, `docs/site/site-numbers.flang`, `scripts/site/build-changelog.flang`,
  `scripts/site/release-body.flang`, `scripts/guards/version-guard.flang`,
  `scripts/guards/license-guard.flang`. До 17 сентября 2026 те же значения брались из
  `package.json`; файл выброшен этой задачей.
- **Повторяющийся ключ в `.flangrc`.** Побеждает последний одноимённый — так же, как в
  `scripts/settings-file.flang`.
- **Почему «package.json» остался в видимых корнях журнала** (`scripts/site/changelog.flang`):
  журнал печатается по всей истории, а коммиты до 17 сентября 2026 этот файл трогали. Убери
  корень — и те коммиты стали бы «незнакомыми». Корень оставлен ради истории, самого файла в
  дереве нет.
