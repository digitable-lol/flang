---
номер: 5413
заголовок: Компилятору нечем сказать, на каком языке отвечать: ключ языка молча игнорируется
статус: свободна
приоритет: P2
исполнитель: —
ветка: —
команда: любая
карта: Что мешает больше всего
рядом: 8161, 7203
нужность: файл настроек и его ADR обещают выбор языка вывода, компилятор его не исполняет
---

# 5413. Компилятору нечем сказать, на каком языке отвечать: ключ языка молча игнорируется

Правила файла настроек и старшинство источников записаны в
`docs/adr/0024-the-settings-file-and-the-language-of-output.md` и
`docs/guide/settings.ru.md`, разбор написан в `scripts/settings-file.flang` и
`scripts/flangrc.fscript`. Сам компилятор читает из `.flangrc` пять ключей —
`unproven` с устаревшим близнецом `недоказанное`, `lint`, `max-line-length`
и `max-conditional-depth`; ключа языка среди них нет.

## Шаги воспроизведения

1. `bootstrap/flang --help > a.txt; bootstrap/flang --язык en --help > b.txt; bootstrap/flang --lang en --help > c.txt`
2. `cmp a.txt b.txt; cmp a.txt c.txt`
3. В пустом каталоге: `printf 'language = eo\n' > .flangrc; bootstrap/flang --version`
4. `grep -c 'FLANG_LANG' bootstrap/flang_cli.c bootstrap/flang_repl.c`

## Что происходит

```
$ cmp a.txt b.txt; cmp a.txt c.txt
                                                   код 0, код 0: вывод тот же
$ bootstrap/flang --version            (рядом лежит .flangrc с language = eo)
flang 0.7.23
оболочка 9f361fce: правит строку (стрелки, слова, история, Tab), цвет digitable
$ grep -c 'FLANG_LANG' bootstrap/flang_cli.c bootstrap/flang_repl.c
bootstrap/flang_cli.c:0
bootstrap/flang_repl.c:0
```

Все три вызова `--help` отвечают кодом 0 и одним и тем же текстом; о том, что
ключ языка не понят, не сказано ничего.

Версия: flang 0.7.23, 2 октября 2026.

## Что должно быть

По ADR-0024 язык вывода выбирается в таком порядке: ключ командной строки
(`--язык ru|en|eo|zh`, латинский близнец `--lang`), переменная среды
`FLANG_LANG`, `.flangrc` проекта, `.flangrc` в домашнем каталоге, локаль
(`LC_ALL`, `LC_MESSAGES`, `LANG`; `C` и `POSIX` языком не считаются),
умолчание. Так же читаются `FLANG_SURFACE`, `FLANG_COLOR`, `FLANG_MANPAGE` и
соответствующие ключи файла. Вывод `--json` и коды `FLANG_*` от языка не
зависят.

## Обходной путь

Нет.

## Когда задача сделана

- `flang --язык en --help` печатает английский текст, когда перевод есть
  (задача 8161); пока перевода нет — печатает прежний и говорит об этом одной
  строкой;
- `.flangrc` с `language = eo` меняет прозу ответа `flang --version`;
- `.flangrc` выше корня проекта не действует — то же, что проверяет
  `bootstrap/flang io scripts/guards/flangrc-guard.fscript --plan Forgery`;
- негодное значение ключа — код 2 с названным ключом;
- проверка сличает правило поиска файла в компиляторе и в
  `scripts/flangrc.fscript`.

## Где живёт правка

`flang/src/emit/c/flang_repl.c` и его близнец в `bootstrap/` (там уже есть
`flangrc_key` и `flangrc_project` для ключа `unproven`), `flang/self/cli.flang`
(разбор ключей). Правка `flang/self/**` требует перепечатки.
