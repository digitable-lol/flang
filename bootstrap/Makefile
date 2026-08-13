# Сгенерировано flang (бэкенд C). Флаги здесь — часть контракта бэкенда:
# сгенерированный код обязан собираться без единого предупреждения.
# -lpthread: расчёт идёт на потоке с заданным стеком, иначе объявленный
# предел глубины не несётся стеком (flang_cli.c). С glibc 2.34 и новее он
# уже в libc, но на старых системах без него не слинкуется.
CC ?= cc
CFLAGS ?= -std=c99 -Wall -Wextra -Werror -pedantic -O2
LDLIBS ?= -lm -lpthread

OBJECTS = flang_runtime.o kompilyator_flang.o

all: libkompilyator_flang.a flang_cli

libkompilyator_flang.a: $(OBJECTS)
	ar rcs $@ $(OBJECTS)

flang_cli: flang_cli.o flang_repl.o $(OBJECTS)
	$(CC) $(CFLAGS) -o $@ flang_cli.o flang_repl.o $(OBJECTS) $(LDLIBS)

clean:
	rm -f $(OBJECTS) flang_cli.o flang_repl.o flang_cli libkompilyator_flang.a

.PHONY: all clean
