---
номер: 3467
заголовок: Напечатанный C не собирается CompCert без правок руками: четыре кириллических имени рантайма и неназванный набор ключей
статус: свободна
приоритет: P2
исполнитель: —
ветка: —
команда: первая
карта: Чего в языке нет вовсе
рядом: 1402, 1401, 9969, 9970
нужность: сборка проверенным компилятором закрывает доверие к переводу C в машинный код, а сегодня для неё рантайм приходится править копией вне дерева
---

# 3467. Напечатанный C не собирается CompCert без правок руками: четыре кириллических имени рантайма и неназванный набор ключей

## Шаги воспроизведения

1. Найти имена переменных C, написанные кириллицей, в рантайме, который
   уезжает в напечатанную программу дословно:

```
grep -anE '(size_t|bool|FILE \*const) [а-яё]+ ' flang/src/emit/c/flang_runtime.c flang/src/emit/c/flang_repl.c
```

2. Спросить, назван ли где-нибудь набор ключей для `ccomp`:

```
grep -c ccomp flang/self/emit-c.flang bootstrap/Makefile .github/workflows/binary.yml
```

3. При установленном CompCert: `make -C bootstrap CC=ccomp`.

## Что происходит

```
$ grep -anE '(size_t|bool|FILE \*const) [а-яё]+ ' flang/src/emit/c/…
flang_runtime.c:724:    const size_t измерено = fl_wasm_room(&here);
flang_runtime.c:4807:    const bool конец = index == text.as.string.bytes;
flang_runtime.c:4808:    const bool ведущий =
flang_repl.c:13308:  FILE *const поток = stdout_or_stderr;               код 0
$ grep -c ccomp flang/self/emit-c.flang bootstrap/Makefile .github/workflows/binary.yml
0, 0, 0                                                           код 1
```

Версия: flang 0.7.23. Дата прогона: 30 сентября 2026. Сборка самим `ccomp` не
перепроверена: CompCert на машине нет; записанный ответ CompCert 3.18 на
кириллическое имя — `invalid symbol '\'`.

Кириллица в идентификаторах — расширение GCC и Clang; CompCert не читает ни
её, ни запись `\uXXXX`. Кроме того, ключи `-pedantic` и `-flto` из
напечатанного Makefile и `-flto=auto` из `.github/workflows/binary.yml` для
`ccomp` — ошибка «Unknown option», а без `-fstruct-passing` и `-flongdouble`
не собирается ни один файл.

## Что должно быть

`make CC=ccomp CFLAGS='<набор>'` собирает семя и любую напечатанную программу
без копий и правок вне дерева, и собранное отвечает так же, как собранное
`cc`. Набор ключей назван в шапке напечатанного Makefile:

```
-std=c99 -Wall -Werror -O2 -fstruct-passing -flongdouble
-Wno-c11-extensions -Wno-unknown-pragmas -Wno-literal-range
```

## Обходной путь

Скопировать напечатанное вне дерева, переименовать четыре имени латиницей и
подать ключи руками.

## Когда задача сделана

- Первая команда из шагов воспроизведения ничего не находит (код 1).
- `make -C bootstrap CC=ccomp CFLAGS='<набор>'` отвечает кодом 0.
- Отчёт `bootstrap/flang test docs/examples/rosetta --ledger` у сборки `ccomp`
  совпадает побайтно с отчётом сборки `cc`; это сравнение стоит работой CI.
- Тексты сообщений со словами «конец» и «поток» не изменились: переименованы
  только имена переменных.

## Где живёт правка

`flang/src/emit/c/flang_runtime.c` (имена «измерено», «конец», «ведущий»),
`flang/src/emit/c/flang_repl.c` (имя «поток» в `ast_pretty_to`),
`flang/self/emit-c.flang` (шапка напечатанного Makefile), новая работа в
`.github/workflows`. Правки в `flang/src/emit` и `flang/self` доезжают до
двоичного только пересборкой семени (bootstrap regeneration).

Ключ `-fstruct-passing` включает непроверенный проход CompCert: передача
`fl_value` по значению остаётся на доверии, пока печать в C передаёт структуры
по значению.
