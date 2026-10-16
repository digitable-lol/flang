---
номер: 8576
заголовок: Напечатанный C тянет 54 внешних символа, включая pthread и sigaction, а с -DFL_NO_POSIX_STACK рантайм не компилируется
статус: свободна
приоритет: P1
исполнитель: —
ветка: —
команда: первая
карта: Чего в языке нет вовсе
рядом: 9969
нужность: решения ядра ОС — чистые функции, которые flang доказывает, но напечатанный C не встаёт в ядро, загрузчик или прошивку
---

# 8576. Напечатанный C тянет 54 внешних символа, включая pthread и sigaction, а с -DFL_NO_POSIX_STACK рантайм не компилируется

Заявка: https://github.com/digitable-lol/flang/issues/383

Профилировщик `fl_time_*` в `flang_runtime.c` пользуется `sig_atomic_t`, `sigaction`, `setitimer` без условия, хотя `<signal.h>` подключается только под `FL_POSIX_STACK`. Поля записи читаются по строковому имени во время работы.

## Шаги воспроизведения

1. Любая программа без `план`, например `rights.flang` из одной записи.
2. `bootstrap/flang emit rights.flang --target c --no-cli --out k`, затем в `k`: `gcc -std=c99 -O2 -ffreestanding -c *.c`, `ld -r -o all.o *.o`, `nm -u all.o | wc -l`.
3. `gcc -std=c99 -O2 -DFL_NO_POSIX_STACK -c flang_runtime.c`.

## Что происходит

```
$ nm -u all.o | wc -l
54
$ nm -u all.o | grep -cE 'pthread|sigaction|setitimer'
16
$ gcc -std=c99 -O2 -DFL_NO_POSIX_STACK -c flang_runtime.c
flang_runtime.c:2140:17: error: unknown type name ‘sig_atomic_t’
flang_runtime.c:2195:20: error: storage size of ‘action’ isn’t known
```

Версия: flang 0.7.28 (`bootstrap/flang` из дерева).

## Что должно быть

Сначала: профилировщик, окно наблюдения, файлы и время рантайма отгорожены одним макросом (`FL_FREESTANDING`), и рантайм собирается без POSIX. Затем — режим `flang emit --target c --freestanding` для программ без `план`: только `<stdint.h>`/`<stddef.h>`/`<stdbool.h>`, память — арена вызывающего, исчерпание — код ошибки, записи — структуры, варианты — tagged union, доказанные проверки не печатаются.

## Обходной путь

Заглушки `sigaction`/`setitimer`/`open`/`gettimeofday` через `-include` и picolibc.

## Когда задача сделана

`gcc -std=c99 -O2 -DFL_NO_POSIX_STACK -c flang_runtime.c` — без ошибок; под `--freestanding` `nm -u all.o` пуст или называет только `memcpy`/`memset`.

## Где живёт правка

`flang/src/emit/c/flang_runtime.c`, `flang/self/emit-c.flang`. Рантайм доезжает без печати семени, печатник — с печатью.
