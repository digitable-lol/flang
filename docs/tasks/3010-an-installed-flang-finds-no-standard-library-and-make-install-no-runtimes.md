---
номер: 3010
заголовок: Установленный flang не находит стандартную библиотеку, а make install не кладёт share/flang
статус: свободна
приоритет: P1
исполнитель: —
ветка: —
команда: любая
карта: Что мешает больше всего
рядом: 1098, 7959, 1710
нужность: вне дерева репозитория `использует «Lists»` не работает ни у одной установки, а из клона ещё и печать отказывает
---

# 3010. Установленный flang не находит стандартную библиотеку, а make install не кладёт share/flang

## Шаги воспроизведения

1. Программа вне дерева репозитория, `probe.flang`:

   ```
   модуль «Проба»
     использует «Lists» только «Соединить списки»

   тотальная функция «Два»
     возвращает список строки
     пример «п»
       ожидается ["а", "б"]
     «Соединить списки» от ["а"] и ["б"]
   ```

2. `flang check probe.flang` установленным двоичным: готовая сборка через `install.sh`, brew,
   asdf, deb, rpm или `make -C bootstrap install PREFIX=<каталог>`.
3. То же двоичным дерева `bootstrap/flang`.
4. `flang emit probe.flang --target c --out o` установкой из `make install`.

## Что происходит

```
$ <установка>/bin/flang check probe.flang
FLANG_IMPORT_NOT_FOUND в файле probe.flang, строка 1, столбец 1: не найден модуль «Lists»:
ни рядом с файлом, ни выше по каталогам, ни в библиотеке компилятора          код 1
$ bootstrap/flang check probe.flang                                           код 0
$ <make install>/bin/flang emit probe.flang --target c --out o
flang emit: не найдены исходники рантайма C — …                               код 2
```

Двоичный ищет библиотеку в `<каталог двоичного>/../flang/stdlib` и `…/share/flang/stdlib`
(`flang/src/emit/c/flang_repl.c`, `SUBS`), но ни архив C выпуска, ни готовые сборки, ни
формула, ни плагин asdf, ни `make install` её туда не кладут; `make install` к тому же
не кладёт `share/flang/<цель>`. Снято 15 октября 2026 на установке `install.sh` из вложений
ручного прогона 38655714568 и на `make -C bootstrap install`; в CI (прогон 38659157192,
macOS) прибор сверки на установленном двоичном упал тем же `FLANG_IMPORT_NOT_FOUND`.

Версия: `flang 0.7.28`.

## Что должно быть

Установленный flang находит `Lists`, `Strings` и остальную библиотеку так же, как двоичный
дерева: архив C и готовые сборки несут `share/flang/stdlib` (и `share/flang/core`, если
библиотека на него опирается), формула, плагин asdf, deb и rpm его ставят, `make install`
кладёт `share/flang/stdlib` и `share/flang/<цель>`.

Пробы формулы и плагина считают каталоги под `share/flang` и требуют, чтобы их было ровно
столько, сколько целей печати: с библиотекой рядом они покраснеют и должны считать только
каталоги целей.

## Обходной путь

Держать копию `flang/stdlib` рядом с программой или выше по каталогам; печатать из клона
двоичным `bootstrap/flang`.

## Когда задача сделана

1. Программа из шагов: `flang check probe.flang` отвечает кодом 0 у установки `install.sh`,
   brew, asdf, deb и `make install`.
2. `make install` в чистый префикс кладёт `share/flang/stdlib` и рантаймы целей;
   `flang emit … --target c --out o` оттуда — код 0.
3. Прибор сверки (`install-parity:check`) знает вызов с импортом из библиотеки и сверяет его.

## Где живёт правка

`scripts/release/release-in-c.fscript` (что едет в архив C), `packaging/prebuilt/build-tarball.sh`,
`packaging/homebrew/flang-package.rb.in`, `packaging/asdf/bin/install`, `packaging/nfpm.yaml`,
`bootstrap/Makefile` (цель `install`, правится перепечаткой семени или через `seed:refresh`).
