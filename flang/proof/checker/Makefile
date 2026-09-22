# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# СБОРКА ЧЕКЕРА. Собирается ОТДЕЛЬНО от компилятора и ничего от него не берёт:
# один файл на C99, ни одной библиотеки кроме libc, ни строки на flang.
# Специально НЕ вызывается из bootstrap/Makefile: тот напечатан компилятором и
# сверяется байт в байт (`sh scripts/raskrutka.sh --check`), а судья, которого
# собирает подсудимый, судьёй быть перестаёт.
#
#   make -C flang/proof/checker        собрать
#   make -C flang/proof/checker пробы  собрать и прогнать весь набор проб
CC ?= cc
CFLAGS ?= -std=c99 -Wall -Wextra -Werror -pedantic -O2
all: сверщик
сверщик: checker.c
	$(CC) $(CFLAGS) -o $@ $<
# Санитайзерная сборка идёт БЕЗ -Werror: при -O1 FORTIFY ругается на vsnprintf
# внутри libc-заголовка, к самой программе это отношения не имеет.
сверщик-san: checker.c
	$(CC) -std=c99 -Wall -Wextra -pedantic -g -O1 -fsanitize=address,undefined -o $@ $<
пробы: сверщик
	sh tests/run.sh
clean:
	rm -f сверщик сверщик-san
.PHONY: all пробы clean
