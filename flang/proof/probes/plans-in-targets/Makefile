# ПЕЧАТЬ И ПРОГОН ПЛАНА В ЦЕЛЯХ (ADR-0100), по одному правилу на цель. Приговор
# выносит не этот файл, а план `run.fscript` по таблице `expected.tsv`: здесь
# только печать, сборка компилятором цели и запуск прогонщика с ключом --plan.
#
#   make -s c PROGRAM=round-trip.flang    напечатать, собрать и прогнать в «c»
#
# Каждое правило печатает то, что прогонщик цели сказал об итоге плана, —
# `{"result":…,"orders":N}` в вывод или `{"error":…,"code":…}` в поток ошибок —
# и следом метку `[code=N]` с его кодом возврата; сам make выходит нулём, иначе
# любой ненулевой код прогонщика он превратил бы в свой 2. Нет компилятора
# цели — метка `[code=127]`: план пробы называет это «нечем смотреть», а не
# расхождением. Печать или сборка отказала — метка `[code=2]`.
#
# Рантайм берётся из дерева (`--runtime`), а не из установленного flang: проба
# судит те байты, которые лежат в flang/src/emit. Напечатанное другим
# компилятором — например компилятором из исходника, пока семя не перепечатано
# — подставляется переменной PLANS_EMITTED_DIR: в ней по каталогу на программу
# и цель (`$PLANS_EMITTED_DIR/round-trip/c`), и печать тогда не зовётся; цель
# без своего каталога там печатается как обычно.

ROOT := $(abspath ../../../..)
FLANG := $(ROOT)/bootstrap/flang
PROGRAMS := $(abspath programs)
PROGRAM ?= round-trip.flang
ARGS := a b

RT_c := $(ROOT)/flang/src/emit/c
RT_go := $(ROOT)/flang/src/emit/go
RT_rust := $(ROOT)/flang/src/emit/rust
RT_python := $(ROOT)/flang/src/emit/python
RT_js := $(ROOT)/flang/src/emit/js
RT_ts := $(ROOT)/flang/src/emit

# Напечатать программу цели $(1) в $$d/p; печать отказала — её слова и код 2.
define PECHAT
d=$$(mktemp -d "$${TMPDIR:-/tmp}/plans-$(1).XXXXXX") || exit 2; \
trap 'rm -rf "$$d"' EXIT INT TERM; \
if [ -n "$${PLANS_EMITTED_DIR:-}" ] && [ -d "$${PLANS_EMITTED_DIR}/$(basename $(PROGRAM))/$(1)" ]; then \
  cp -R "$$PLANS_EMITTED_DIR/$(basename $(PROGRAM))/$(1)" "$$d/p" || { echo "[code=2]"; exit 0; }; \
else \
  "$(FLANG)" emit "$(PROGRAMS)/$(PROGRAM)" --target $(1) --out "$$d/p" --runtime "$(RT_$(1))" > "$$d/e" 2>&1 \
    || { tail -1 "$$d/e"; echo "[code=2]"; exit 0; }; \
fi;
endef

.PHONY: c go rust python js ts

c:
	@command -v cc > /dev/null 2>&1 || { echo "[code=127]"; exit 0; }; \
	$(call PECHAT,c) \
	cd "$$d/p" && make -s > /dev/null || { echo "[code=2]"; exit 0; }; ./flang_cli --plan "" $(ARGS); echo "[code=$$?]"

go:
	@command -v go > /dev/null 2>&1 || { echo "[code=127]"; exit 0; }; \
	$(call PECHAT,go) \
	cd "$$d/p" && GOCACHE="$$d/cache" go build -o flang_cli ./cli || { echo "[code=2]"; exit 0; }; ./flang_cli --plan "" $(ARGS); echo "[code=$$?]"

rust:
	@command -v cargo > /dev/null 2>&1 || { echo "[code=127]"; exit 0; }; \
	$(call PECHAT,rust) \
	cd "$$d/p" && CARGO_TARGET_DIR="$$d/p/target" cargo build -q 2> "$$d/build" || { cat "$$d/build"; echo "[code=2]"; exit 0; }; ./target/debug/flang_cli --plan "" $(ARGS); echo "[code=$$?]"

python:
	@command -v python3 > /dev/null 2>&1 || { echo "[code=127]"; exit 0; }; \
	$(call PECHAT,python) \
	cd "$$d/p" && python3 -B flang_cli.py "$$(basename "$$(ls *.py | grep -v '^flang_' | head -1)" .py)" --plan "" $(ARGS); echo "[code=$$?]"

js:
	@command -v node > /dev/null 2>&1 || { echo "[code=127]"; exit 0; }; \
	$(call PECHAT,js) \
	cd "$$d/p" && node flang_host_node.js "./$$(ls *.js | grep -v '^flang_' | head -1)" $(ARGS); echo "[code=$$?]"

ts:
	@command -v node > /dev/null 2>&1 || { echo "[code=127]"; exit 0; }; \
	$(call PECHAT,ts) \
	cd "$$d/p" && node flang_host_node.js "./$$(ls *.ts | grep -v '^flang_' | head -1)" $(ARGS); echo "[code=$$?]"
