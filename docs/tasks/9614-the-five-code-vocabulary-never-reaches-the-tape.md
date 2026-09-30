---
номер: 9614
заголовок: Проверки отвечают «смотреть было нечем» тем же кодом, что и «нашёл беду», а шаги CI различают только ноль и не ноль
статус: свободна
приоритет: P2
исполнитель: —
ветка: —
команда: любая
карта: Что мешает больше всего
рядом: —
нужность: красный ответ не отличить от несостоявшейся проверки; проба подделкой зеленеет и у слепой проверки
---

# 9614. Проверки отвечают «смотреть было нечем» тем же кодом, что и «нашёл беду», а шаги CI различают только ноль и не ноль

У `flang io` четыре кода выхода (`docs/flang/SPEC.md`, абзац о кодах выхода):
1 — план сдался сам («Провал»), 3 — сломался инструмент либо программа ответила
«Не проверено». Исход «Не проверено» в языке есть, но большинство проверок им не
пользуется, а шаги CI код не читают.

## Шаги воспроизведения

1. `grep -rl 'NECHEM_SMOTRET' scripts flang/scripts | xargs grep -L 'вариант «Не проверено»' | wc -l`
2. `grep -c 'kod=\$?' .github/workflows/ci.yml .github/workflows/binary.yml`
3. `sed -n 192,197p .github/workflows/ci.yml`
4. `grep -c 'НЕ ПРОВЕРЕН\|НЕ ИЗМЕРЕНО\|ПРОПУЩЕНА' scripts/guards/release-guard.fscript flang/scripts/memory-guard.fscript scripts/bootstrap-reprint.sh docs/editors/vim/checks/vim8.sh`

## Что происходит

```
$ grep -rl 'NECHEM_SMOTRET' scripts flang/scripts | xargs grep -L 'вариант «Не проверено»' | wc -l
33
$ grep -c 'kod=\$?' .github/workflows/ci.yml .github/workflows/binary.yml
.github/workflows/ci.yml:0
.github/workflows/binary.yml:0
$ sed -n 192,197p .github/workflows/ci.yml
        run: |
          if sh scripts/guards/seed-knows-type-words-guard.sh --подлог; then
            echo "сторож промолчал на подлоге — проверять им нечего" >&2
            exit 1
          fi
        env:
```

Тридцать три проверки называют беду «смотреть нечем» именем
`FLANG_…_NECHEM_SMOTRET`, но возвращают её «Провалом», то есть кодом 1. Шаг
«Probe seed words» проходит при любом ненулевом коде, а у
`scripts/guards/seed-knows-type-words-guard.sh` код 2 значит «читать нечего»:
шаг, который доказывает, что проверка не слепа, зеленеет и тогда, когда она
слепа. Тем же приёмом устроены пробы подделкой в
`.github/workflows/install-path.yml` и `.github/workflows/stdlib-proof.yml`.

Четыре проверки говорят «не проверено» и отвечают кодом 0 (строки найдены
шагом 4, коды не перепроверены): `scripts/guards/release-guard.fscript` — когда
сеть не ответила о выпуске или о формуле; `flang/scripts/memory-guard.fscript` —
когда снята только часть замеров; `scripts/bootstrap-reprint.sh` в режиме
`--тела`; `docs/editors/vim/checks/vim8.sh` — когда не задан `FLANG_VIM_LSP`.

Версия: flang 0.7.23, 30 сентября 2026.

## Что должно быть

Код 1 значит только «беда в предмете проверки». «Смотреть было нечем» — код 3
(у оболочечных проверок — тот код, что назван в их шапке). Шаг CI читает код
отдельной строкой и различает: 0 — зелено, 1 — беда, «не проверено» — отдельная
заметка, прочее — неудача запуска. Проба подделкой требует ровно тот код,
которым проверка отвечает на подделку.

## Обходной путь

Читать текст ответа: имя беды называет, что смотреть было нечем.

## Когда задача сделана

1. Команда из шага 1 печатает 0.
2. Каждая проба подделкой в `.github/workflows/*.yml` (`if … --подлог; then`,
   `--plan 'Подлог'`) читает код отдельной строкой и принимает только код
   отказа на подделке.
3. Шаги, зовущие проверки с тремя и более исходами
   (`scripts/seed/binary-origin.fscript`, `scripts/bootstrap-reprint.sh`,
   `scripts/guards/overlong-string-guard.sh`, `flang/proof/rules-match.sh`,
   `flang/proof/checker/tests/run.sh`), различают «беда» и «не проверено».
4. Разбор кода написан один раз и зовётся из шагов, а не скопирован в каждый.
   Образец разбора — шаги с `kod=$?` в `.github/workflows/reprint.yml`.
5. Четыре проверки из шага 4 на «не проверено» отвечают кодом 3, а не 0.

## Где живёт правка

Проверки на flang — `scripts/**/*.fscript`, `flang/scripts/*.fscript`: исход
«Провал» с кодом `…_NECHEM_SMOTRET` меняется на «Не проверено». Шаги —
`.github/workflows/ci.yml`, `binary.yml`, `install-path.yml`,
`stdlib-proof.yml`. В шаге нужен `set +e`, и вывод проверки идёт в файл, а не в
конвейер, иначе `$?` — код не той команды. Перепечатка не нужна.
