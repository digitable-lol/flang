CC ?= cc
CFLAGS ?= -std=c99 -Wall -Wextra -Werror -pedantic -O2
LEAN ?= lean
LEANC ?= leanc
# Версия Lean закреплена в ../lean/lean-toolchain. elan запускает её по переменной
# ELAN_TOOLCHAIN, где бы ни стоял каталог сборки. Свой Lean другой версии:
# LEAN=… LEANC=… LEAN_ANY_VERSION=1.
TOOLCHAIN := $(shell cat ../lean/lean-toolchain 2>/dev/null)
PINNED := $(TOOLCHAIN:leanprover/lean4:v%=%)
export ELAN_TOOLCHAIN ?= $(TOOLCHAIN)
OUT ?= second/out
SECOND = Exploration Surfaces Source Terms Totality Moves Goals Canon Evaluator Order Body Node Sections Premises Theorem Ring Polynomial Linear Certificate Laws Category Checker Paths Verified Interpretation
MODULES = Binary64:Binary64 Model:Модель Rules:Правила Term:Терм Record:Запись Acceptance:Приёмка Consistency:Состоятельность RecordReader:RecordReader
all: сверщик
сверщик: checker.c
	$(CC) $(CFLAGS) -o $@ $<
сверщик-san: checker.c
	$(CC) -std=c99 -Wall -Wextra -pedantic -g -O1 -fsanitize=address,undefined -o $@ $<
second: $(OUT)/второй-сверщик
lean-pinned:
	@test -n "$(PINNED)" || { echo "не прочитан flang/proof/lean/lean-toolchain: в нём закреплена версия Lean" >&2; exit 2; }
	@v=$$($(LEAN) --version 2>/dev/null | sed -n 's/^Lean (version \([0-9.]*\).*/\1/p'); \
	if test -z "$$v"; then echo "Lean $(PINNED) не найден (команда «$(LEAN)»). Поставьте elan: он сам возьмёт версию из flang/proof/lean/lean-toolchain. Свой Lean: LEAN=… LEANC=…" >&2; exit 2; fi; \
	if test "$$v" != "$(PINNED)" && test -z "$(LEAN_ANY_VERSION)"; then echo "найден Lean $$v, а закреплён $(PINNED) (flang/proof/lean/lean-toolchain). Поставить: elan toolchain install $(TOOLCHAIN). Собрать найденным: LEAN_ANY_VERSION=1" >&2; exit 2; fi
$(OUT)/второй-сверщик: $(wildcard second/*.lean) $(wildcard ../lean/*.lean) | lean-pinned
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
.PHONY: all second lean-pinned пробы clean
