# Как выпустить версию

Выпуск идёт одним проходом. Метка ставится один раз, и ни один шаг по дороге не обязан быть
красным. Ниже — шаги по порядку, с командами. `X` везде — номер версии, например `0.8.0`.

## Что нужно до начала

- Вся работа выпуска влита в `dev`, проверки вершины `dev` зелёные.
- GitHub CLI установлен и вошёл: `gh auth status`.
- Сабмодули развёрнуты и компилятор собран:

```sh
git submodule update --init packaging/homebrew-tap packaging/asdf-plugin
make -C bootstrap
```

## 1. Версия и заметка

```sh
git fetch origin && git switch -c a/release-X origin/dev
bootstrap/flang run-script version X
sed -i 's/"выпуск.версия": "[^"]*"/"выпуск.версия": "X"/' docs/site/numbers.json
bootstrap/flang run-script seed:refresh
```

`version` разносит номер по файлам дерева. `seed:refresh` поднимает номер в
`bootstrap/flang_repl.c` и пересобирает компилятор: `bootstrap/flang --version` должен ответить
`flang X`.

Впишите заметку о версии в `docs/release-notes.json`, первой в списке, обе половины — `ru` и
`en`. Из неё собирается текст релиза на GitHub и страница «Выпуски».

```sh
git commit -am "chore(release): version X and its release notes"
```

## 2. Хеш архива и отпечаток компилятора

```sh
sh scripts/bootstrap-reprint.sh --otpechatok
bootstrap/flang run-script release:archive
bootstrap/flang run-script release:formula
rm -rf output/release-c
git commit -am "chore(release): sha256 of the X archive"
```

`--otpechatok` запускают на чистом дереве сразу после коммита шага 1: тогда
`scripts/seed-fingerprint` называет этот коммит. `seed:refresh` снимает отпечаток на правленом
дереве и коммита назвать не может.

`release:archive` собирает `output/flang-X-c.tar.gz` той же командой, что и раннер. Архив
повторим: один и тот же коммит даёт один и тот же sha256 на машине разработчика и на раннере.
`release:formula` вписывает этот sha256 в `packaging/homebrew/flang.rb`. Каталог
`output/release-c` после сборки удаляют: в нём лежат копии файлов дерева, и проверка коротких
команд перед пушем считает их вторыми объявлениями.

Архив нужен GNU tar. На macOS: `brew install gnu-tar`.

## 3. Запрос слияния

```sh
git push origin a/release-X
gh pr create --base dev --title "chore(release): version X"
gh pr checks --watch
```

Работа «Install path» собирает архив на раннере и сверяет его sha256 с формулой. Это
подтверждение хеша раннером, и оно приходит до метки.

Три проверки раньше краснели в этом месте на каждом выпуске. Теперь они отличают готовящийся
выпуск от расхождения:

| Проверка | Что видит | Что отвечает |
| --- | --- | --- |
| `published-check` | версии `X` ещё нет среди меток | предупреждение, если `X` старше последней метки на один шаг и заметка о ней есть |
| «Docs site» | у заметки `X` ещё нет метки | страница печатается без `X`, если заметка без метки одна и стоит первой |
| «Install path» | кран Homebrew на прошлой версии | предупреждение: кран поднимают после выпуска |

Красное здесь — настоящая ошибка. Чините её до слияния.

Ветку вливают в `dev` перемоткой, чтобы коммиты сохранили свои номера:

```sh
git push origin a/release-X:dev
```

Слияние, которое переписывает коммиты, оставит в отпечатке номер несуществующего коммита.
Шаг 4 это поймает. Лечится на вершине `dev` командой `sh scripts/bootstrap-reprint.sh --perekommit`
и коммитом одной строки.

## 4. Проверка перед меткой

```sh
git fetch origin && git switch --detach origin/dev
gh run list --commit "$(git rev-parse HEAD)"
bootstrap/flang run-script release:preflight X
```

Дождитесь, пока запуски проверок вершины `dev` закончатся, и запустите `release:preflight`. Команда
проверяет всё, на чём выпуски вставали раньше:

- номер `X` записан верно, одинаков во всех файлах, и компилятор называет себя `flang X`;
- рабочее дерево чисто, отпечаток компилятора называет коммит-предок;
- заметка о выпуске есть; тексты для читателя проходят проверку жаргона;
- метки `vX` ещё нет; `main` — предок этого коммита; коммит лежит в `dev`;
- автоматические проверки коммита зелёные;
- кран Homebrew и плагин asdf догнали прошлый выпуск;
- sha256 формулы равен sha256 архива, собранного заново.

Ответ `выпуск X готов к метке` и код 0 — можно ставить метку. Иначе команда перечисляет, что не
прошло, и под каждой строкой пишет, что делать. Две долгие проверки (жаргон и сборка архива) идут,
только когда прошли остальные; вся команда занимает 15–25 минут.

## 5. Метка

Выпуск идёт с `main`. Сначала `main` перематывается на проверенный коммит, потом ставится метка:

```sh
git push origin origin/dev:main
git tag -a vX -m "flang X" origin/main
git push origin vX
gh run watch "$(gh run list --workflow release.yml --limit 1 --json databaseId --jq '.[0].databaseId')"
```

Запуск `release.yml` первым шагом проверяет порядок: метка обязана стоять на коммите из `main`, а
`main` — быть предком `dev`. Затем он собирает архив, сверяет sha256 с формулой, создаёт релиз,
собирает готовые сборки под четыре платформы, пакеты `deb` и `rpm`, файл `SHA256SUMS` и записи о
происхождении сборки.

Если в настройках репозитория задан секрет `HOMEBREW_TAP_TOKEN`, тот же запуск кладёт формулу
выпуска в кран `digitable-lol/homebrew-tap`.

## 6. После выпуска

```sh
git switch -c a/release-X-pages origin/dev
bootstrap/flang run-script release:tap X
bootstrap/flang run-script releases:page
bootstrap/flang run-script changelog:build
bootstrap/flang run-script changelog:page
git commit -am "chore(release): the tap and the pages follow X"
git push origin a/release-X-pages
gh pr create --base dev --title "chore(release): the tap and the pages follow X"
```

`release:tap` берёт `SHA256SUMS` опубликованного выпуска, собирает из него формулу, кладёт её в
кран и готовит новый указатель сабмодуля. Если запуск выпуска уже обновил кран, команда только
поднимает указатель.

После слияния этого запроса перемотайте `main` и проверьте опубликованное:

```sh
git push origin origin/dev:main
bootstrap/flang run-script release:check
```

`release:check` спрашивает GitHub: релиз есть, архив приложен, его sha256 равен формуле, кран
раздаёт версию `X`.

## Проверить скачанный файл

У каждого файла выпуска есть запись о происхождении, подписанная GitHub. Она называет
репозиторий, файл `release.yml`, метку и коммит:

```sh
gh attestation verify flang-package-X-linux-x86_64.tar.gz --repo digitable-lol/flang
```

Сценарий установки делает ту же проверку с переменной `FLANG_VERIFY_PROVENANCE=1`.

## Если запуск выпуска упал

- **«Check release order».** Метка стоит на коммите вне `main`. Релиз не создан. Удалите метку
  (`git push origin :refs/tags/vX`), выполните шаг 5 с начала.
- **«Check archive hash».** Формула несёт не тот sha256. Релиз не создан. Шаги 2–4 этого не
  допускают; если случилось — исправьте формулу и выпустите следующую версию.
- **Любой шаг после «Upload release archive».** Релиз уже создан. Почините причину и
  перезапустите упавшие работы: `gh run rerun --failed <номер запуска>`. Метку не трогайте.
