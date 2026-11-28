# Перечень проверок CI: файлы работ и их работы

Страница перечисляет, что лежит в `.github/workflows/`: 16 файлов и 88 работ в
них. Перечень составлен 27 ноября 2026 чтением этих файлов на коммите
`ef0fecdac`.

Состояние запусков (какая работа сейчас зелёная, какая красная и сколько идёт)
на эту дату не измеряли. Его показывает GitHub:

```sh
gh run list --branch dev --limit 20
gh run list --commit "$(git rev-parse HEAD)"
```

Короткие команды, которые зовут работы, записаны в `.flangrc`: 323 строки
`script.<имя>`. Их список печатает `bootstrap/flang run-script` без имени.
Результатов запуска каждой команды на этой странице нет: редакция от 25 августа
2026 приводила их для версии 0.6.2, и к нынешнему дереву они не относятся.

## Как читать таблицы

- **работа** — ключ работы в файле; **имя в интерфейсе** — её `name`, под этим
  именем она видна в запросе на слияние.
- **где идёт** — значение `runs-on`. `self-hosted, big-memory` — свой раннер с
  большой памятью; он объявляется переменной репозитория `BIG_MEMORY_RUNNER=yes`.
- **срок** — `timeout-minutes`; прочерк значит, что срок не задан и действует
  предел GitHub.
- **условие** — `needs` и `if` работы дословно. Прочерк значит, что работа идёт
  при каждом запуске файла.

Расписания записаны в формате cron, время UTC.

## Что проверяется до CI

Три хука из `.githooks/` включаются командой `git config core.hooksPath .githooks`:

| хук | что запускает |
|---|---|
| `commit-msg` | `.githooks/commit-msg.fscript`, план «Commit message»: правила из [`commit-messages.md`](commit-messages.md) |
| `pre-commit` | `.githooks/no-growth.fscript` и `.githooks/lint-growth.fscript`, планы «Staged», по файлам в индексе |
| `pre-push` | `.githooks/pre-push.fscript`: 31 проверка |

## `binary.yml` — Binary

Запускается: пуш (кроме правок только в `docs/tasks/**`, `.ai/**`); запрос на слияние; ручной запуск. Работ: 24.

| работа | имя в интерфейсе | где идёт | срок, мин | условие |
|---|---|---|---:|---|
| `sborka` | build | ubuntu-latest | — | — |
| `self-examples` | self-examples | ubuntu-latest | 120 | `startsWith(github.ref, 'refs/tags/') \|\| github.event_name == 'workflow_dispatch'` |
| `semya` | seed-fingerprint | ubuntu-latest | 30 | — |
| `povtorimost` | reprint-determinism | ubuntu-latest | 20 | — |
| `published` | published-check | ubuntu-latest | 5 | — |
| `rust-node` | rust-node | ubuntu-latest | 30 | — |
| `imena` | link-collisions | ubuntu-latest | 25 | — |
| `srashchivanie` | merge-splicing | self-hosted, big-memory | 30 | `vars.BIG_MEMORY_RUNNER == 'yes' && (github.event_name == 'push' \|\| github.event_name == 'workflow_dispatch') && (github.ref == 'refs/heads/dev' \|\| github.ref == 'refs/heads/main')` |
| `chekker` | proof-checker | ubuntu-latest | 15 | — |
| `second-checker` | second-checker | ubuntu-latest | 45 | — |
| `tables-guard` | tables-guard | ubuntu-latest | 15 | — |
| `jargon` | jargon | ubuntu-latest | 45 | — |
| `perevod` | translation-matcher | ubuntu-latest | 20 | — |
| `falsifier` | falsifier | ubuntu-latest | 30 | — |
| `storozha` | guards-selftest | ubuntu-latest | 45 | — |
| `storozha-2` | guards-selftest-2 | ubuntu-latest | 30 | — |
| `guards-called-again` | guards-called-again | ubuntu-latest | 30 | — |
| `splicing-on-pull-request` | splicing-on-pull-request | ubuntu-latest | 60 | `github.event_name == 'pull_request'` |
| `guards-without-a-caller` | guards-without-a-caller | ubuntu-latest | 30 | — |
| `argue-probes` | argue-probes | ubuntu-latest | 45 | — |
| `progony` | runs-not-executed | ubuntu-latest | 25 | — |
| `plan-rules-asked` | plan-rules-asked | ubuntu-latest | 25 | — |
| `korpus` | corpus-examples | ubuntu-latest | 180 | `github.event_name == 'workflow_dispatch' \|\| startsWith(github.ref, 'refs/tags/')` |
| `translation-validation` | translation-validation | ubuntu-latest | 90 | — |

## `build-macos.yml` — macOS build

Запускается: пуш (кроме правок только в `docs/tasks/**`, `.ai/**`); запрос на слияние; ручной запуск. Работ: 1.

| работа | имя в интерфейсе | где идёт | срок, мин | условие |
|---|---|---|---:|---|
| `bootstrap` | build-macos | macos-latest | — | — |

## `ci.yml` — CI

Запускается: пуш (ветки `main`, `dev`; метки `v*`); запрос на слияние; ручной запуск. Работ: 33.

| работа | имя в интерфейсе | где идёт | срок, мин | условие |
|---|---|---|---:|---|
| `semya` | seed-words | ubuntu-latest | — | — |
| `proza` | prose-numbers | ubuntu-latest | — | — |
| `kirillica` | cyrillic-file-names | ubuntu-latest | — | — |
| `translit` | translit-file-names | ubuntu-latest | — | — |
| `temporal` | temporal-properties | ubuntu-latest | — | — |
| `vremyanki` | stray-temporaries | ubuntu-latest | — | — |
| `nastroyki` | flangrc-places | ubuntu-latest | — | — |
| `zadachnik` | task-tracker | ubuntu-latest | — | — |
| `postoyannye` | c99-limits | ubuntu-latest | — | — |
| `stolknoveniya` | id-collisions | ubuntu-latest | — | `github.ref_type == 'tag' \|\| github.event_name == 'workflow_dispatch'` |
| `zhargon` | jargon | ubuntu-latest | — | — |
| `skills` | skills-follow-the-page | ubuntu-latest | — | — |
| `test` | test | ubuntu-latest | 90 | `github.ref_type == 'tag' \|\| github.event_name == 'workflow_dispatch'` |
| `licensing` | licensing | ubuntu-latest | — | — |
| `links` | links | ubuntu-latest | — | — |
| `pechat` | emit-guard | ubuntu-latest | — | — |
| `stdlib-check` | stdlib-check | ubuntu-latest | 120 | — |
| `korpus` | corpus-runner | ubuntu-latest | — | — |
| `progon` | pretest-check | ubuntu-latest | — | — |
| `granica` | input-bounds | ubuntu-latest | — | — |
| `oblast` | c-region | ubuntu-latest | — | — |
| `pravila-spisok` | rules-list | ubuntu-latest | — | — |
| `lean-rules-guard` | lean-rules-guard | ubuntu-latest | — | — |
| `pravila` | rules-check | ubuntu-latest | — | `github.ref_type == 'tag' \|\| github.event_name == 'workflow_dispatch'` |
| `klyuchi` | cli-keys | ubuntu-latest | — | — |
| `stale-pages` | stale-pages | ubuntu-latest | — | `github.ref_type == 'tag' \|\| github.event_name == 'workflow_dispatch'` |
| `neznanye-storozha` | uncalled-guards | ubuntu-latest | — | — |
| `target-link` | link-across-targets | ubuntu-latest | 20 | — |
| `seed-verdicts` | seed-verdicts | ubuntu-latest | — | — |
| `python-in` | python-enters-flang | ubuntu-latest | — | — |
| `uncalled` | checks-nobody-calls | ubuntu-latest | — | — |
| `registry-resolution` | registry-resolution | ubuntu-latest | — | — |
| `link-import` | link-import | ubuntu-latest | — | — |

## `commit-messages.yml` — Commit messages

Запускается: запрос на слияние. Работ: 1.

| работа | имя в интерфейсе | где идёт | срок, мин | условие |
|---|---|---|---:|---|
| `lint` | commit-messages | ubuntu-latest | 45 | — |

## `install-path.yml` — Install path

Запускается: пуш (метки `v*`; только при правке 12 названных путей); запрос на слияние (только при правке 12 названных путей); расписание `17 4 * * *` (UTC); ручной запуск. Работ: 2.

| работа | имя в интерфейсе | где идёт | срок, мин | условие |
|---|---|---|---:|---|
| `put` | install-path (<ос>) | по матрице | — | — |
| `brew` | homebrew | macos-latest | — | — |

## `lean-crosscheck.yml` — Lean crosscheck

Запускается: расписание `17 4 * * *` (UTC); ручной запуск. Работ: 1.

| работа | имя в интерфейсе | где идёт | срок, мин | условие |
|---|---|---|---:|---|
| `lean` | lean-crosscheck | ubuntu-latest | 90 | — |

## `lean-model-blocks.yml` — Lean model blocks

Запускается: пуш (ветки `dev`; только при правке 7 названных путей); запрос на слияние (в `dev`; только при правке 7 названных путей); расписание `47 4 * * *` (UTC); ручной запуск. Работ: 1.

| работа | имя в интерфейсе | где идёт | срок, мин | условие |
|---|---|---|---:|---|
| `blocks` | lean-model-blocks | ubuntu-latest | 60 | — |

## `pages.yml` — Docs site

Запускается: пуш (ветки `main`, `dev`; только при правке 40 названных путей); запрос на слияние; ручной запуск. Работ: 4.

| работа | имя в интерфейсе | где идёт | срок, мин | условие |
|---|---|---|---:|---|
| `sobrat` | build | ubuntu-latest | — | `github.event_name != 'push' \|\| github.ref == 'refs/heads/main'` |
| `playground` | playground | ubuntu-latest | — | — |
| `pack` | pack | ubuntu-latest | — | после `sobrat`, `playground`; `github.event_name != 'pull_request' && (github.event_name != 'push' \|\| github.ref == 'refs/heads/main')` |
| `opublikovat` | deploy | ubuntu-latest | — | после `pack`; `github.event_name != 'pull_request' && (github.event_name != 'push' \|\| github.ref == 'refs/heads/main')` |

## `provability.yml` — Provability

Запускается: расписание `23 5 * * *` (UTC); ручной запуск. Работ: 1.

| работа | имя в интерфейсе | где идёт | срок, мин | условие |
|---|---|---|---:|---|
| `verdikt` | provability | ubuntu-latest | 45 | — |

## `release.yml` — Release

Запускается: пуш (метки `v*`); ручной запуск. Работ: 4.

| работа | имя в интерфейсе | где идёт | срок, мин | условие |
|---|---|---|---:|---|
| `release` | release | ubuntu-latest | — | — |
| `prebuilt` | prebuilt (<ос>-<архитектура>) | по матрице | — | после `release`; `${{ !cancelled() && needs.release.outputs.archive != '' }}` |
| `packages` | packages | ubuntu-24.04 | — | после `release`, `prebuilt`; `${{ !cancelled() && needs.prebuilt.result == 'success' }}` |
| `install-parity` | install-parity (<ос>) | по матрице | — | после `packages`; `${{ !cancelled() && needs.packages.result == 'success' }}` |

## `reprint.yml` — Reprint

Запускается: пуш (ветки `dev`; только при правке 6 названных путей); расписание `0 2 * * 0` (UTC); ручной запуск. Работ: 8.

| работа | имя в интерфейсе | где идёт | срок, мин | условие |
|---|---|---|---:|---|
| `freshness` | freshness | ubuntu-latest | — | — |
| `c99-limits` | c99-limits | ubuntu-latest | — | — |
| `id-collisions` | id-collisions | ubuntu-latest | — | — |
| `wide-determinism` | reprint-determinism-wide | ubuntu-latest | 30 | — |
| `big-memory-runner` | big-memory-runner | ubuntu-latest | — | — |
| `runner-watch` | runner-watch | ubuntu-latest | 75 | после `big-memory-runner` |
| `reprint-check` | reprint-check | self-hosted, big-memory | 1020 | после `c99-limits`, `id-collisions`, `big-memory-runner`; `(github.event_name == 'schedule' \|\| (github.event_name == 'workflow_dispatch' && !inputs.two_prints_only)) && (github.ref == 'refs/heads/dev' \|\| github.ref == 'refs/heads/main')` |
| `two-prints` | reprint-reproducibility | self-hosted, big-memory | 2100 | после `c99-limits`, `big-memory-runner`; `(github.event_name == 'push' \|\| github.event_name == 'schedule' \|\| github.event_name == 'workflow_dispatch') && (github.ref == 'refs/heads/dev' \|\| github.ref == 'refs/heads/main')` |

## `slow-guards.yml` — Slow guards

Запускается: запрос на слияние (в `dev`; только при правке `.github/workflows/slow-guards.yml`); расписание `23 3 * * 2` (UTC); ручной запуск. Работ: 1.

| работа | имя в интерфейсе | где идёт | срок, мин | условие |
|---|---|---|---:|---|
| `guard` | <проверка> | ubuntu-latest | 90 | — |

## `stdlib-proof.yml` — Stdlib proof

Запускается: расписание `41 6 * * 6` (UTC); ручной запуск. Работ: 1.

| работа | имя в интерфейсе | где идёт | срок, мин | условие |
|---|---|---|---:|---|
| `vedomost` | stdlib-proof | ubuntu-latest | 350 | — |

## `target-canons.yml` — Target canons

Запускается: расписание `0 5 * * 1` (UTC); ручной запуск. Работ: 1.

| работа | имя в интерфейсе | где идёт | срок, мин | условие |
|---|---|---|---:|---|
| `canons` | printed-code-follows-target-canons | ubuntu-latest | 120 | — |

## `target-twins.yml` — Target twins

Запускается: расписание `0 4 * * 1` (UTC); ручной запуск. Работ: 4.

| работа | имя в интерфейсе | где идёт | срок, мин | условие |
|---|---|---|---:|---|
| `planirovshchik` | scheduler-across-targets | ubuntu-latest | 30 | — |
| `nadzor` | supervisor-across-targets | ubuntu-latest | 60 | — |
| `uzel` | node-across-targets | ubuntu-latest | 45 | — |
| `pechat-svyazi` | conc-link-emit | ubuntu-latest | 15 | — |

## `typing-holes-fuzz.yml` — Typing holes search

Запускается: расписание `41 3 * * *`, `41 4 * * 0` (UTC); запрос на слияние (только при правке `scripts/fuzz/**`, `.github/workflows/typing-holes-fuzz.yml`, `flang/proof/tables/typing-holes.tsv`); ручной запуск. Работ: 1.

| работа | имя в интерфейсе | где идёт | срок, мин | условие |
|---|---|---|---:|---|
| `fuzz` | typing-holes-fuzz | ubuntu-latest | 90 | — |

## Матрицы

- `slow-guards.yml`, работа `guard` — шесть проверок: `closed-length`,
  `target-drift`, `tasks`, `docs`, `claims`, `proven`.
- `install-path.yml`, работа `put` — `ubuntu-latest` и `macos-latest`.
- `release.yml`, работа `prebuilt` — четыре сборки: linux x86_64
  (`ubuntu-24.04`), linux aarch64 (`ubuntu-24.04-arm`), macos arm64 (`macos-15`),
  macos x86_64 (`macos-15-intel`).
- `release.yml`, работа `install-parity` — linux x86_64 и macos arm64.
