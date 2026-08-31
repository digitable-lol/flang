# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# СБОРКА ЧЕКЕРА. Собирается ОТДЕЛЬНО от компилятора и ничего от него не берёт:
# один файл на C99, ни одной библиотеки кроме libc, ни строки на flang.
# Специально НЕ вызывается из bootstrap/Makefile: тот напечатан компилятором и
# сверяется байт в байт (`sh scripts/raskrutka.sh --check`), а судья, которого
# собирает подсудимый, судьёй быть перестаёт.
#
#   make -C flang/proof/чекер        собрать
#   make -C flang/proof/чекер пробы  собрать и прогнать весь набор проб
CC ?= cc
CFLAGS ?= -std=c99 -Wall -Wextra -Werror -pedantic -O2
all: сверщик
сверщик: сверщик.c
	$(CC) $(CFLAGS) -o $@ $<
# Санитайзерная сборка идёт БЕЗ -Werror: при -O1 FORTIFY ругается на vsnprintf
# внутри libc-заголовка, к самой программе это отношения не имеет.
сверщик-san: сверщик.c
	$(CC) -std=c99 -Wall -Wextra -pedantic -g -O1 -fsanitize=address,undefined -o $@ $<
пробы: сверщик
	sh пробы/прогон.sh
clean:
	rm -f сверщик сверщик-san
.PHONY: all пробы clean
