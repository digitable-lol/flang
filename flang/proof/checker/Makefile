CC ?= cc
CFLAGS ?= -std=c99 -Wall -Wextra -Werror -pedantic -O2
LEAN ?= lean
LEANC ?= leanc
OUT ?= second/out
SECOND = Source Terms Totality Moves Evaluator Body Node Sections Premises Theorem Checker
MODULES = Model:Модель Rules:Правила Term:Терм Record:Запись Acceptance:Приёмка Consistency:Состоятельность RecordReader:RecordReader
all: сверщик
сверщик: checker.c
	$(CC) $(CFLAGS) -o $@ $<
сверщик-san: checker.c
	$(CC) -std=c99 -Wall -Wextra -pedantic -g -O1 -fsanitize=address,undefined -o $@ $<
second: $(OUT)/второй-сверщик
$(OUT)/второй-сверщик: $(wildcard second/*.lean) $(wildcard ../lean/*.lean)
	rm -rf $(OUT) && mkdir -p $(OUT)
	for p in $(MODULES); do cp ../lean/$${p%%:*}.lean $(OUT)/$${p##*:}.lean || exit 1; done
	for m in $(SECOND); do cp second/$$m.lean $(OUT)/$$m.lean || exit 1; done
	cd $(OUT) && for p in $(MODULES) $(SECOND); do m=$${p##*:}; \
	  LEAN_PATH=. $(LEAN) --root=. -o $$m.olean -c $$m.c $$m.lean || exit 1; done
	cd $(OUT) && $(LEANC) -O2 -o второй-сверщик *.c
пробы: сверщик
	../../../bootstrap/flang io tests/run.fscript --max-steps 4000000000 --timeout 600000
clean:
	rm -rf сверщик сверщик-san $(OUT)
.PHONY: all second пробы clean
