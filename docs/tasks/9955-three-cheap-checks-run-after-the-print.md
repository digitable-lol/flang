---
номер: 9955
заголовок: Три отказа «emit», не зависящие от печати, приходят после проверки и печати всей программы
статус: свободна
приоритет: P2
исполнитель: —
ветка: —
команда: любая
карта: Что мешает больше всего
рядом: 9953
нужность: опечатка в ключе печати обнаруживается после всего прогона, на компиляторе это часы
---

# 9955. Три отказа «emit», не зависящие от печати, приходят после проверки и печати всей программы

## Шаги воспроизведения

Вход — `flang/stdlib/optional.flang`; каталог `rt` содержит один файл
`flang_runtime.h`, взятый из `flang/src/emit/c/`.

1. `time bootstrap/flang emit flang/stdlib/optional.flang --target c --out out`
2. `time bootstrap/flang emit flang/stdlib/optional.flang --target c --out /proc/nelzya/syuda`
3. `time bootstrap/flang emit flang/stdlib/optional.flang --target c --file net-takogo.c`
4. `time bootstrap/flang emit flang/stdlib/optional.flang --target c --out out3 --runtime rt`
5. Шаг 2 на `flang/stdlib/json.flang` под `timeout 60`.

## Что происходит

```
$ bootstrap/flang emit flang/stdlib/optional.flang --target c --out out
…                                                                   код 0, 1,41 с
$ bootstrap/flang emit flang/stdlib/optional.flang --target c --out /proc/nelzya/syuda
flang emit: не удалось завести каталог «/proc/nelzya/syuda»: No such file or directory
                                                                    код 2, 1,42 с
$ bootstrap/flang emit flang/stdlib/optional.flang --target c --file net-takogo.c
flang emit: файла «net-takogo.c» печать не даёт. Что даёт: flang_runtime.h flang_runtime.c optional.h optional.c flang_cli.c Makefile
                                                                    код 2, 1,43 с
$ bootstrap/flang emit flang/stdlib/optional.flang --target c --out out3 --runtime rt
flang emit: в rt не хватает flang_cli.c
flang emit: в rt не хватает flang_repl.c
flang emit: в rt не хватает flang_conc.h
flang emit: в rt не хватает flang_conc.c                            код 2, 1,36 с
$ timeout 60 bootstrap/flang emit flang/stdlib/json.flang --target c --out /proc/nelzya/syuda
                                                 без вывода, код 124 на исходе 60 с
```

Каждый отказ приходит за то же время, что и удачная печать, а на большем файле
отказ о каталоге не пришёл и за минуту: проверка доказательств идёт раньше.
Неполный `--runtime` называет недостачу целиком: четыре файла.
Строка о ходе («шагов …, идёт …») идёт только на терминал: при перенаправлении
вывода шаг 5 за минуту не печатает ничего вовсе.

Версия: flang 0.7.23, 3 октября 2026.

## Что должно быть

Все три отказа приходят до связывания и проверки, сразу после разбора ключей:
путь `--out` известен из доводов, набор имён файлов печати — из цели и имени
модуля, перечень файлов рантайма — из цели. Коды возврата и тексты прежние.

## Обходной путь

Перед долгой печатью проверить те же ключи на малом файле.

## Когда задача сделана

Три пробы на `flang/stdlib/json.flang` — негодный `--out`, несуществующий
`--file`, неполный `--runtime` — отвечают кодом 2 меньше чем за секунду, с теми
же текстами. Пробы стоят в наборе проверок и краснеют, если отказ снова уедет
за печать.

## Где живёт правка

`flang/src/emit/c/flang_repl.c`: `emit_make_dir` объявлен строкой 12418, а
зовётся для `--out` строкой 13247 — то есть ПОСЛЕ `emit_call` (строка 13235);
отказ «печать не даёт» внутри `emit_files_out` (строка 12494), проба файлов
рантайма — в `emit_call` (строка 12708). Файл рукописный: правка доезжает до
двоичного быстрым пересевом семени, без перепечатки.
