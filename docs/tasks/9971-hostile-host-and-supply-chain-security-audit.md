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
нужность: подмена кода действия или сборочной машины сегодня не обнаруживается
---

# 9971. В CI остаются действие с плавающим тегом и подстановка контекста в команду; граница защиты от враждебного хоста не описана

Вопрос владельца: защищены ли мы от взлома и грязного хоста.

## Шаги воспроизведения

1. `grep -n 'uses:' .github/workflows/*.yml | grep -v '@[0-9a-f]\{40\}' | grep -v 'uses: \./'`
2. `grep -n 'run:.*\${{ *github\.' .github/workflows/*.yml | cut -c1-150`
3. `grep -c 'pull_request_target' .github/workflows/*.yml | grep -v ':0'`
4. `grep -n 'runs-on:.*self-hosted' .github/workflows/*.yml`
5. `ls SECURITY.md`

## Что происходит

```
$ grep -n 'uses:' .github/workflows/*.yml | grep -v '@[0-9a-f]\{40\}' | grep -v 'uses: \./'
.github/workflows/binary.yml:246:        uses: actions/cache@v4
.github/workflows/binary.yml:792:        uses: actions/cache@v4
.github/workflows/binary.yml:1006:        uses: actions/cache@v4
.github/workflows/binary.yml:1209:        uses: actions/cache@v4
.github/workflows/binary.yml:1362:        uses: actions/cache@v4
.github/workflows/binary.yml:1559:        uses: actions/cache@v4
.github/workflows/binary.yml:1819:        uses: actions/cache@v4
.github/workflows/commit-messages.yml:24:        uses: actions/cache@v4
$ grep -n 'run:.*\${{ *github\.' .github/workflows/*.yml | cut -c1-150
.github/workflows/commit-messages.yml:34:        run: bootstrap/flang io .githooks/commit-msg.fscript --plan "Commit range" -- "origin/${{ github.base
$ grep -c 'pull_request_target' .github/workflows/*.yml | grep -v ':0'
                                                                    код 1
$ grep -n 'runs-on:.*self-hosted' .github/workflows/*.yml
.github/workflows/binary.yml:1336:    runs-on: [self-hosted, bolshaya-pamyat]
.github/workflows/reprint.yml:304:    runs-on: [self-hosted, bolshaya-pamyat]
.github/workflows/reprint.yml:413:    runs-on: [self-hosted, bolshaya-pamyat]
$ ls SECURITY.md
ls: cannot access 'SECURITY.md': No such file or directory           код 2
```

Остальные действия закреплены полным хешем коммита. `pull_request_target` нет.
Три работы на собственном раннере (`binary.yml`, `reprint.yml`) пускают запрос
на вливание только из веток этого же репозитория. `actions/cache@v4` плавает в
восьми местах. В `commit-messages.yml` имя целевой ветки и хеш головы запроса
подставляются прямо в тело команды, без прослойки `env:`. Описания того, что дерево обнаруживает при
подменённой сборочной машине, а что нет, в дереве нет.

Версия: flang 0.7.23, 30 сентября 2026. Проба самой проверки
`release-without-cache` (`mode: self-test`, зовётся из `binary.yml`) локально не
перепроверена.

## Что должно быть

Каждое стороннее действие закреплено полным хешем коммита. Значения контекста
GitHub попадают в команды только через `env:`. Граница доверия к сборочной
машине записана: что ловит повторяемость печати и независимая проверяющая
программа, а что не ловит никто.

## Обходной путь

Нет.

## Когда задача сделана

1. Команда шага 1 молчит.
2. Команда шага 2 молчит.
3. Права `permissions:` каждого файла `.github/workflows/*.yml` сверены: запись
   есть только у `release.yml` (`contents`) и `pages.yml` (`pages`,
   `id-token`); расхождения названы.
4. Последний прогон шага с `mode: self-test` в CI зелёный, и показано подлогом,
   что он краснеет при заданной переменной кеша приговоров.
5. В `docs/` есть страница о границе: может ли подменённая машина первой печати
   семени внести изменение, которое переживёт самосборку и останется
   невидимым проверяющей программе; что это обнаруживает сегодня и что нет.

Аудит учётных записей и прав организации на GitHub в задачу не входит.

## Где живёт правка

`.github/workflows/binary.yml`, `.github/workflows/commit-messages.yml`, новая
страница в `docs/`. Перепечатка не нужна.
