CC ?= cc
CFLAGS ?= -std=c99 -Wall -Wextra -Werror -pedantic -O2
all: сверщик
сверщик: checker.c
	$(CC) $(CFLAGS) -o $@ $<
сверщик-san: checker.c
	$(CC) -std=c99 -Wall -Wextra -pedantic -g -O1 -fsanitize=address,undefined -o $@ $<
пробы: сверщик
	sh tests/run.sh
clean:
	rm -f сверщик сверщик-san
.PHONY: all пробы clean
