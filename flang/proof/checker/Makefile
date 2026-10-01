CC ?= cc
CFLAGS ?= -std=c99 -Wall -Wextra -Werror -pedantic -O2
all: сверщик
сверщик: checker.c
	$(CC) $(CFLAGS) -o $@ $<
сверщик-san: checker.c
	$(CC) -std=c99 -Wall -Wextra -pedantic -g -O1 -fsanitize=address,undefined -o $@ $<
пробы: сверщик
	../../../bootstrap/flang io tests/run.fscript --max-steps 4000000000 --timeout 600000
clean:
	rm -f сверщик сверщик-san
.PHONY: all пробы clean
