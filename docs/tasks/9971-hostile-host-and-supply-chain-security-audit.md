---
номер: 9971
заголовок: В CI остаются действие с плавающим тегом и подстановка контекста в команду; граница защиты от враждебного хоста не описана
статус: свободна
приоритет: P2
исполнитель: —
ветка: —
команда: любая
карта: Чего в языке нет вовсе
рядом: 9969, 9970
нужность: подмена кода действия или сборочной машины не обнаруживается
---

# 9971. В CI остаются действие с плавающим тегом и подстановка контекста в команду; граница защиты от враждебного хоста не описана

Вопрос владельца: защищены ли мы от взлома и грязного хоста.

## Шаги воспроизведения

1. `grep -n 'uses:' .github/workflows/*.yml | grep -v '@[0-9a-f]\{40\}' | grep -v 'uses: \./'`
2. `grep -n 'run:.*\${{ *github\.' .github/workflows/*.yml | cut -c1-150`
3. `grep -c 'pull_request_target' .github/workflows/*.yml | grep -v ':0'`
4. `grep -n 'runs-on:.*self-hosted' .github/workflows/*.yml`
5. `grep -A4 '^permissions:' .github/workflows/*.yml | grep 'write'`
6. Прогнать пробу сторожа локально: тело шага вынуть из составного действия и
   позвать с `MODE=self-test` —
   `sed -n '115,378p' .github/actions/release-without-cache/action.yml | sed 's/^        //' > guard.sh`,
   затем `env -u GITHUB_STEP_SUMMARY MODE=self-test KATALOG_RABOT=.github bash guard.sh`
7. `ls SECURITY.md`

## Что происходит

```
$ grep -n 'uses:' .github/workflows/*.yml | grep -v '@[0-9a-f]\{40\}' | grep -v 'uses: \./'
.github/workflows/binary.yml:247:        uses: actions/cache@v4
.github/workflows/binary.yml:778:        uses: actions/cache@v4
.github/workflows/binary.yml:993:        uses: actions/cache@v4
.github/workflows/binary.yml:1195:        uses: actions/cache@v4
.github/workflows/binary.yml:1348:        uses: actions/cache@v4
.github/workflows/binary.yml:1503:        uses: actions/cache@v4
.github/workflows/binary.yml:1569:        uses: actions/cache@v4
.github/workflows/binary.yml:1938:        uses: actions/cache@v4
.github/workflows/binary.yml:2004:        uses: actions/cache@v4
.github/workflows/commit-messages.yml:24:        uses: actions/cache@v4
$ grep -n 'run:.*\${{ *github\.' .github/workflows/*.yml | cut -c1-150
.github/workflows/commit-messages.yml:34:        run: bootstrap/flang io .githooks/commit-msg.fscript --plan "Commit range" -- "origin/${{ github.base
.github/workflows/commit-messages.yml:39:        run: bootstrap/flang io .githooks/no-growth.fscript --plan "Range" -- "origin/${{ github.base_ref }}"
.github/workflows/commit-messages.yml:44:        run: bootstrap/flang io .githooks/lint-growth.fscript --plan "Range" --max-orders 100000 -- "origin/$
$ grep -c 'pull_request_target' .github/workflows/*.yml | grep -v ':0'
                                                                    код 1
$ grep -n 'runs-on:.*self-hosted' .github/workflows/*.yml
.github/workflows/binary.yml:1336:    runs-on: [self-hosted, bolshaya-pamyat]
.github/workflows/reprint.yml:323:    runs-on: [self-hosted, bolshaya-pamyat]
.github/workflows/reprint.yml:453:    runs-on: [self-hosted, bolshaya-pamyat]
$ grep -A4 '^permissions:' .github/workflows/*.yml | grep 'write'
.github/workflows/pages.yml-  pages: write
.github/workflows/pages.yml-  id-token: write
.github/workflows/release.yml-  # contents: write — не расширение полномочий ради удобства, а то, без чего
.github/workflows/release.yml-  contents: write
                                                                    код 0
$ env -u GITHUB_STEP_SUMMARY MODE=self-test KATALOG_RABOT=.github bash guard.sh
проба: выпуск + переменная задана — код 1, как задумано
проба: выпуск + переменной нет — код 0, как задумано
проба: выпуск + переменная задана пустым — код 0, как задумано
проба: не выпуск + переменная задана — код 0, как задумано
проба: режим release на ветке + переменная — код 1, как задумано
проба: разметка: работа задаёт переменную — код 1, как задумано
проба: разметка: имя без присваивания — не в счёт — код 0, как задумано
проба: неизвестный режим — смотреть нечем — код 2, как задумано
сторож выпуска без кеша умеет краснеть и умеет молчать: 8 проб из 8
                                                                    код 0
$ ls SECURITY.md
ls: cannot access 'SECURITY.md': No such file or directory           код 2
```

Остальные действия закреплены полным хешем коммита. `pull_request_target` нет.
Три работы на собственном раннере (`binary.yml:1336`, `reprint.yml:323` и
`reprint.yml:453`) пускают запрос на вливание только из веток этого же
репозитория.

`actions/cache@v4` плавает в десяти местах: девять в `binary.yml`, одно в
`commit-messages.yml`. Значения контекста GitHub подставляются прямо в тело
команды в ТРЁХ шагах `commit-messages.yml` (строки 34, 39, 44): во всех трёх —
`github.base_ref`, в первом ещё и `github.event.pull_request.head.sha`. У
каждого из трёх шагов блок `env:` УЖЕ стоит (`LC_ALL`, `FLANG_TMP`) — правка в
том, чтобы переложить два значения в готовый блок, а не завести новый.

Права `permissions:` сходятся с меркой по всем двенадцати файлам работ: запись
выдана ровно в двух — `release.yml` (`contents: write`) и `pages.yml`
(`pages: write`, `id-token: write`, при `contents: read`), — а у остальных
десяти стоит только `contents: read`. Четвёртой строкой в выводе идёт пояснение
из `release.yml`, а не ещё одно право.

Сторож умеет краснеть, и это показано прогоном: проба `mode: self-test`,
которую зовёт `binary.yml:1677`, даёт 8 проб из 8 и код 0, а первая её проба —
подлог «выпуск + переменная задана» — ждёт код 1 и получает его. То есть на
заданную переменную кеша приговоров сторож краснеет.

Чего нет: описания того, что дерево обнаруживает при подменённой сборочной
машине, а что нет. `SECURITY.md` в дереве нет.

Версия: flang 0.7.23.

## Что должно быть

Каждое стороннее действие закреплено полным хешем коммита. Значения контекста
GitHub попадают в команды только через `env:`. Граница доверия к сборочной
машине записана: что ловит повторяемость печати и независимая проверяющая
программа, а что не ловит никто.

## Обходной путь

Нет.

## Когда задача сделана

1. Команда шага 1 молчит: все `actions/cache@v4` закреплены полным
   хешем коммита.
2. Команда шага 2 молчит: `github.base_ref` и
   `github.event.pull_request.head.sha` переложены в уже стоящие блоки `env:`
   трёх шагов `commit-messages.yml` (строки 34, 39, 44).
3. В `docs/` есть страница о границе: может ли подменённая машина первой печати
   семени внести изменение, которое переживёт самосборку и останется
   невидимым проверяющей программе; что это обнаруживает и что нет.

Аудит учётных записей и прав организации на GitHub в задачу не входит.

## Где живёт правка

`.github/workflows/binary.yml`, `.github/workflows/commit-messages.yml`, новая
страница в `docs/`. Перепечатка не нужна.
