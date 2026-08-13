# Сгенерировано flang (бэкенд C). Флаги здесь — часть контракта бэкенда:
# сгенерированный код обязан собираться без единого предупреждения.
CC ?= cc
CFLAGS ?= -std=c99 -Wall -Wextra -Werror -pedantic -O2
LDLIBS ?= -lm

OBJECTS = flang_runtime.o kompilyator_flang.o

all: libkompilyator_flang.a flang_cli

libkompilyator_flang.a: $(OBJECTS)
	ar rcs $@ $(OBJECTS)

flang_cli: flang_cli.o flang_repl.o $(OBJECTS)
	$(CC) $(CFLAGS) -o $@ flang_cli.o flang_repl.o $(OBJECTS) $(LDLIBS)

clean:
	rm -f $(OBJECTS) flang_cli.o flang_repl.o flang_cli libkompilyator_flang.a

.PHONY: all clean
