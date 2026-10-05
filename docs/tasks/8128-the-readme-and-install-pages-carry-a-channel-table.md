---
номер: 8128
заголовок: README и страницы установки не несут таблицы каналов: три пути одним списком, готовых двоичных и SHA256SUMS на них нет
статус: свободна
приоритет: P2
исполнитель: —
ветка: —
команда: вторая
карта: Что мешает больше всего
рядом: 7959, 1098
нужность: человек с сайта должен за десять секунд выбрать канал и проверить хеш; сегодня страница обещает «все три дают ОДИН И ТОТ ЖЕ двоичный», а путь из клона печатать не умеет
---

# 8128. README и страницы установки не несут таблицы каналов: три пути одним списком, готовых двоичных и SHA256SUMS на них нет

Решение: [ADR-0067](../adr/0067-the-release-ships-binaries-for-four-triples-from-one-seed.md),
раздел 2.6 — README и страницы установки.

## Шаги воспроизведения

1. Посчитать строки таблиц в разделе «Install» README:
   `awk '/^## Install/{p=1;next} /^## /{p=0} p' README.md | grep -c '^|'`
2. Поискать на трёх страницах установки готовые двоичные и файл хешей:
   `grep -c 'tar\.gz\|SHA256SUMS' README.md docs/site/install.md docs/site/install.ru.md`
3. Поставить из клона в чистый префикс и напечатать из другого каталога:
   `make -C bootstrap install PREFIX=/tmp/p >/dev/null; cd /tmp/w && /tmp/p/bin/flang emit проба.flang --target c --out out-c`

## Что происходит

```
$ awk '/^## Install/{p=1;next} /^## /{p=0} p' README.md | grep -c '^|'
0                                                               код 1
$ grep -c 'tar\.gz\|SHA256SUMS' README.md docs/site/install.md docs/site/install.ru.md
README.md:0
docs/site/install.md:0
docs/site/install.ru.md:0                                       код 1
$ cd /tmp/w && /tmp/p/bin/flang emit проба.flang --target c --out out-c
flang emit: не найдены исходники рантайма C — они уезжают в вывод ДОСЛОВНО, и
без них печать соврала бы. …                                    код 2
```

README перечисляет три пути одним блоком кода; `docs/site/install.md` и
`install.ru.md` несут таблицу из трёх строк (Homebrew, asdf, из исходников) и
обещают: «All three give the SAME binary» / «Все три дают ОДИН И ТОТ ЖЕ двоичный
файл». Двоичный тот же, установка — нет: `make -C bootstrap install` кладёт
`bin`, `lib`, `include` и `man` (если есть), но не `share/flang/<цель>`, и
поставленный из клона `flang emit` отказывает кодом 2 на всех целях. Страница
говорит об этом только про `man`.

Версия: `flang 0.7.24`, `оболочка 9f361fce`. Прогон 5 октября 2026.

## Что должно быть

ADR-0067, раздел 2.6: в README и на обеих страницах установки — таблица каналов
по образцу `bootandy/dust`: строка на канал (Homebrew, asdf, готовый двоичный,
из исходников; Nix и AUR — если приняты задачей о них), столбцы «команда», «что
ставит», «что нужно на машине», «как проверить». Строка готовых двоичных
называет четыре имени `flang-<версия>-{linux,macos}-{x86_64,aarch64}.tar.gz`,
нижнюю границу (glibc 2.35, macOS по `MACOSX_DEPLOYMENT_TARGET`) и две команды
проверки: `sha256sum -c SHA256SUMS` и, если принята аттестация,
`gh attestation verify <файл> --owner digitable-lol`. Строка «из исходников»
говорит прямо: без `man` и без печати (`emit`), пока `make install` не кладёт
`share/flang`. Обе страницы — на двух языках, одним содержанием; версия берётся
подстановкой `{{выпуск.версия}}`, как сегодня.

## Обходной путь

Читать `docs/site/install.md` и `release.yml` целиком; про печать из клона
узнавать первым запуском.

## Когда задача сделана

1. `awk '/^## Install/{p=1;next} /^## /{p=0} p' README.md | grep -c '^|'` — не
   меньше 6 (шапка, разделитель, четыре канала).
2. `grep -c 'SHA256SUMS' README.md docs/site/install.md docs/site/install.ru.md`
   — по 1 и больше на каждом из трёх файлов.
3. Имена вложений в таблице совпадают с именами из `SHA256SUMS` последнего
   выпуска знак в знак — сверяет прибор в `scripts/site/` по образцу
   `releases-page-verify.fscript`, и он зовётся из `pages.yml`.
4. `bootstrap/flang run-script jargon:check` зелен: таблица — наружу, жаргона в
   ней нет.
5. Строка «из исходников» называет отсутствие печати; когда `make install`
   научится класть `share/flang`, строку правит та работа, и прибор из пункта 3
   краснеет на устаревшем обещании.

## Где живёт правка

`README.md` (раздел «Install»), `docs/site/install.md`, `docs/site/install.ru.md`;
прибор сверки имён — `scripts/site/`, вызов — `.github/workflows/pages.yml`.
Перепечатка не нужна.
