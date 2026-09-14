---
номер: 3984
заголовок: Имя модуля, начинающееся с цифры, печатается в C допустимым идентификатором
статус: свободна
исполнитель: —
ветка: —
команда: первая
карта: Чего в языке нет вовсе
рядом: 1402, 3467, 0311, 9969
нужность: 2 — две программы дерева (`rosetta/hundred-doors.flang`, `rosetta/hundred-doors-english.flang`) не собираются ни cc, ни ccomp; замер 1402
---

# 3984. Имя модуля с ведущей цифрой даёт некомпилируемый C

Найдено замером задачи 1402 (14 сентября 2026, двоичный `bootstrap/flang` 0.7.19,
ствол `bdce1f75`): из 255 напечатанных в C программ дерева две не собираются **никаким**
компилятором C — `docs/examples/rosetta/hundred-doors.flang` и
`hundred-doors-english.flang`, обе с модулем «100 doors».

```
$ bootstrap/flang emit docs/examples/rosetta/hundred-doors.flang --target c --out /tmp/d
$ cc -std=c99 -Wall -Wextra -Werror -pedantic -O2 -c 100_doors.c
100_doors.h:7:9: error: macro names must be identifiers
$ ccomp -std=c99 -Wall -fstruct-passing -c flang_cli.c
flang_cli.c:107: error: invalid numerical constant '100_doors_call'
```

Приставка программы — `flang/self/emit-c.flang:1846` («Префикс программы») —
получается из «Змейка» (`:469`) и «Обойти занятое целью C» (`:5261`). Первая
транслитерирует и склеивает слова подчёркиваниями, вторая уступает место именам
заголовков C (`string` → `string_flang`). Ведущую цифру не сторожит ни одна:
`100 doors` → `100_doors`, а идентификатор C с цифры начинаться не может
(C99 §6.4.2.1). Дальше приставка уезжает во все имена модуля: `100_doors_call`,
`100_doors_entry`, страж заголовка `100_DOORS_H`.

Цели `go` и `js` той же программой печатаются, собираются и отвечают: `go build` —
код 0, `node --check` чист, обе отвечают на 18 примеров из 18, и ответы совпадают
байт в байт. У Go код модуля лежит в пакете `flang`, у JS имя модуля живёт только в
имени файла `100_doors.js`. Беда одной цели.

## Что сделать

В «Змейка» (или в «Обойти занятое целью C», это решает исполнитель) — если
результат начинается с цифры, приписать спереди подчёркивание или слово, и
проверить примером: `дано "100 doors"`, `ожидается "_100_doors"` (или иное
выбранное правило). Перепечатка семени нужна, как для любой правки
`flang/self/**`.

## Как поймём, что сделано

```
bootstrap/flang emit docs/examples/rosetta/hundred-doors.flang --target c --out <каталог>
\1bootstrap/flang emit docs/examples/rosetta/hundred-doors-english.flang --target c --out <каталог2>\nmake -C <каталог2>         # код 0\n```
