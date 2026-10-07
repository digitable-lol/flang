CC ?= cc
CFLAGS ?= -std=c99 -Wall -Wextra -Werror -pedantic -O2
LEAN ?= lean
LEANC ?= leanc
OUT ?= second/out
MODULES = Model:Модель Rules:Правила Term:Терм Record:Запись Acceptance:Приёмка Consistency:Состоятельность RecordReader:RecordReader
all: сверщик
сверщик: checker.c
	$(CC) $(CFLAGS) -o $@ $<
сверщик-san: checker.c
	$(CC) -std=c99 -Wall -Wextra -pedantic -g -O1 -fsanitize=address,undefined -o $@ $<
second: $(OUT)/второй-сверщик
$(OUT)/второй-сверщик: second/SecondChecker.lean $(wildcard ../lean/*.lean)
	rm -rf $(OUT) && mkdir -p $(OUT)
	for p in $(MODULES); do cp ../lean/$${p%%:*}.lean $(OUT)/$${p##*:}.lean || exit 1; done
	cp second/SecondChecker.lean $(OUT)/SecondChecker.lean
	cd $(OUT) && for p in $(MODULES) SecondChecker:SecondChecker; do m=$${p##*:}; \
	  LEAN_PATH=. $(LEAN) --root=. -o $$m.olean -c $$m.c $$m.lean || exit 1; done
	cd $(OUT) && $(LEANC) -O2 -o второй-сверщик *.c
пробы: сверщик
	../../../bootstrap/flang io tests/run.fscript --max-steps 4000000000 --timeout 600000
clean:
	rm -rf сверщик сверщик-san $(OUT)
.PHONY: all second пробы clean
