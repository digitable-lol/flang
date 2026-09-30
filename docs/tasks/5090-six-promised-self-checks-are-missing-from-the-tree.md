---
номер: 5090
заголовок: Три проверки ссылаются на файлы самопроверок, которых в дереве нет, и одна из них такой файл запускает
статус: свободна
приоритет: P2
исполнитель: —
ветка: —
команда: вторая
карта: Что мешает больше всего
рядом: 5204
нужность: проверка обещает читателю самопроверку, которой нет; одна упадёт, дойдя до запуска
---

# 5090. Три проверки ссылаются на файлы самопроверок, которых в дереве нет, и одна из них такой файл запускает

## Шаги воспроизведения

1. `git ls-files '*.test.mjs'`
2. `grep -n 'test\.mjs' flang/scripts/name-guard.mjs flang/scripts/count-guard.mjs flang/scripts/tempdir-guard.fscript`

## Что происходит

```
$ git ls-files '*.test.mjs'
flang/test/nadzor-uzla.test.mjs
flang/test/planirovshchik-celi.test.mjs
flang/test/svyaz-celi.test.mjs
```

| кто ссылается | на что | файл есть |
|---|---|---|
| `flang/scripts/name-guard.mjs:151` | flang/test/name-guard.test.mjs | нет |
| `flang/scripts/count-guard.mjs:15` | flang/test/manpage.test.mjs | нет |
| `flang/scripts/tempdir-guard.fscript:279` | flang/test/uzel-celi.test.mjs | нет |

Первые два называют файл в тексте как свою самопроверку. Третий ставит его в
строку запуска `node --test …` рядом с тремя существующими файлами.

Версия: flang 0.7.23, 30 сентября 2026.

## Что должно быть

Каждый файл самопроверки, названный проверкой, существует. Файла нет — нет и
ссылки на него.

## Обходной путь

Нет.

## Когда задача сделана

Для каждого из трёх файлов выбрано одно: самопроверка написана и поставлена
отдельным ярлыком в `ярлыки.flang`, либо ссылка снята. Для
`tempdir-guard.fscript` выбор тот же, но оставить как есть нельзя: файл стоит в
строке запуска.

```sh
grep -rhoE 'flang/test/[a-z-]+\.test\.mjs' flang/scripts/name-guard.mjs flang/scripts/count-guard.mjs flang/scripts/tempdir-guard.fscript | sort -u | while read f; do test -f "$f" || echo "нет: $f"; done
```

Команда молчит.

## Где живёт правка

`flang/scripts/name-guard.mjs`, `flang/scripts/count-guard.mjs`,
`flang/scripts/tempdir-guard.fscript` (функция со строкой запуска `node --test`
и её пример), `ярлыки.flang`. Перепечатка не нужна.
