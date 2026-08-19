# Сгенерировано flang (бэкенд C). Флаги здесь — часть контракта бэкенда:
# сгенерированный код обязан собираться без единого предупреждения.
# -flto: рантайм и модуль программы — разные единицы трансляции, и без
# межмодульной оптимизации ни один вызов рантайма не подставляется на место.
# Замерено: работа быстрее в 1,1—1,6 раза, сборка дольше примерно вдвое.
# Нужна быстрая сборка вместо быстрой работы: make CFLAGS='-std=c99 -O2'.
# -lpthread: расчёт идёт на потоке с заданным стеком, иначе объявленный
# предел глубины не несётся стеком (flang_cli.c). С glibc 2.34 и новее он
# уже в libc, но на старых системах без него не слинкуется.
CC ?= cc
CFLAGS ?= -std=c99 -Wall -Wextra -Werror -pedantic -O2 -flto
LDLIBS ?= -lm -lpthread

OBJECTS = flang_runtime.o kompilyator_flang.o

# Куда ставит `make install`. Человек после сборки обязан получить КОМАНДУ
# `flang`, а не путь в каталог сборки: PREFIX=$HOME/.local, если без sudo.
PREFIX ?= /usr/local

all: libkompilyator_flang.a flang

libkompilyator_flang.a: $(OBJECTS)
	ar rcs $@ $(OBJECTS)

flang: flang_cli.o flang_repl.o $(OBJECTS)
	$(CC) $(CFLAGS) -o $@ flang_cli.o flang_repl.o $(OBJECTS) $(LDLIBS)

# Заголовки и библиотека ставятся рядом с бинарником не для порядка: без
# них оболочка не может собрать выражение системным `cc` и умеет только
# проверять. Страница руководства кладётся, если она рядом (в архиве
# релиза она есть, в дереве репозитория — нет).
install: all
	install -d $(DESTDIR)$(PREFIX)/bin $(DESTDIR)$(PREFIX)/lib $(DESTDIR)$(PREFIX)/include
	install -m 0755 flang $(DESTDIR)$(PREFIX)/bin/flang
	install -m 0644 libkompilyator_flang.a $(DESTDIR)$(PREFIX)/lib/
	install -m 0644 *.h $(DESTDIR)$(PREFIX)/include/
	test ! -f flang.1 || { install -d $(DESTDIR)$(PREFIX)/share/man/man1 && install -m 0644 flang.1 $(DESTDIR)$(PREFIX)/share/man/man1/; }
	@echo 'поставлено: $(DESTDIR)$(PREFIX)/bin/flang — проверьте: flang --version'

uninstall:
	rm -f $(DESTDIR)$(PREFIX)/bin/flang $(DESTDIR)$(PREFIX)/lib/libkompilyator_flang.a $(DESTDIR)$(PREFIX)/share/man/man1/flang.1

clean:
	rm -f $(OBJECTS) flang_cli.o flang_repl.o flang libkompilyator_flang.a

.PHONY: all clean install uninstall
