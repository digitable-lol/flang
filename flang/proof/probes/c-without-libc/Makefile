# ПРОБА «C БЕЗ LIBC»: сгенерированный `flang emit --target c --freestanding` код
# собирается без libc и не тянет ни одного внешнего символа.
#
#   make check        всё, что считается в CI: symbols, link, forgery, differential, fresh
#   make symbols      expected/*/*.c: -ffreestanding -nostdlib -Wall -Wextra -Werror, `nm -u` пуст
#   make link         чужая программа на C без libc зовёт функции через заголовок; на x86_64 ещё и запуск
#   make forgery      подделка с вызовом memcpy обязана покраснеть на `nm -u`
#   make differential 1000 входов на функцию: обычный сгенерированный C против кода без libc
#   make fresh        генерация установленным компилятором сверяется с expected/ и с отказами
#   make from-source  то же, но генератор берётся из исходника flang/self (до пересборки компилятора)
#
# expected/ — то, что генератор выдал на programs/*.flang; файлы C названы по
# программе (ключ --path). Правка генератора
# меняет expected/ тем же коммитом: `make from-source UPDATE=1`.
#
# Компилятор для riscv64 — riscv64-linux-gnu-gcc. Нет его — строка «skip», а с
# REQUIRE_RISCV=1 (так зовёт CI) — ошибка: проба обязана различать «плохо» и
# «не проверено».

ROOT := $(abspath ../../../..)
FLANG ?= $(ROOT)/bootstrap/flang
CC ?= cc
RISCV_CC ?= riscv64-linux-gnu-gcc
REQUIRE_RISCV ?= 0
UPDATE ?= 0
BARE := -std=c99 -Wall -Wextra -Werror -ffreestanding -nostdlib
PROGRAMS := header index wrap words
# У этих программ нет постусловий, и их вывод не зависит от того, что доказало ядро.
EXACT := wrap words
REFUSED := exact fraction list not-total recursion signed string

.PHONY: check symbols link forgery differential fresh from-source

check: symbols link forgery differential fresh

# Список компиляторов: свой и, если есть, для riscv64.
define COMPILERS
if command -v $(RISCV_CC) > /dev/null 2>&1; then ccs="$(CC) $(RISCV_CC)"; \
elif [ "$(REQUIRE_RISCV)" = 1 ]; then echo "нет $(RISCV_CC), а REQUIRE_RISCV=1"; exit 1; \
else ccs="$(CC)"; printf 'skip\triscv64: нет %s\n' "$(RISCV_CC)"; fi;
endef

# Собрать каждый *.c каталога $$dir всеми компиляторами при -O0 и -O2 и
# потребовать пустого `nm -u`. Счёт сборок — в $$built.
define BARE_BUILD
for c in $$dir/*.c; do for cc in $$ccs; do for o in -O0 -O2; do \
  $$cc $(BARE) $$o -c "$$c" -o "$$d/bare.o" || { echo "не собирается: $$cc $$o $$c"; exit 1; }; \
  undefined=$$(nm -u "$$d/bare.o"); \
  [ -z "$$undefined" ] || { echo "внешние символы в $$c ($$cc $$o):"; echo "$$undefined"; exit 1; }; \
  built=$$((built + 1)); \
done; done; done;
endef

symbols:
	@d=$$(mktemp -d "$${TMPDIR:-/tmp}/bare-symbols.XXXXXX") || exit 2; trap 'rm -rf "$$d"' EXIT INT TERM; \
	$(COMPILERS) built=0; \
	for dir in expected/*; do $(BARE_BUILD) done; \
	echo "symbols: сборок $$built, внешних символов 0"

link:
	@d=$$(mktemp -d "$${TMPDIR:-/tmp}/bare-link.XXXXXX") || exit 2; trap 'rm -rf "$$d"' EXIT INT TERM; \
	$(COMPILERS) \
	for cc in $$ccs; do \
	  $$cc $(BARE) -O2 -static -Iexpected/header drivers/caller.c expected/header/header.c \
	    -o "$$d/kernel" || { echo "не линкуется без libc: $$cc"; exit 1; }; \
	  echo "link: $$cc слинковал чужую программу без libc"; \
	done; \
	if [ "$$(uname -sm)" = "Linux x86_64" ]; then \
	  $(CC) $(BARE) -O2 -static -Iexpected/header drivers/caller.c expected/header/header.c \
	    -o "$$d/kernel" || exit 1; \
	  "$$d/kernel"; code=$$?; \
	  [ "$$code" = 0 ] || { echo "чужая программа получила не те ответы: код $$code"; exit 1; }; \
	  echo "link: запуск на x86_64 — ответы сошлись"; \
	else printf 'skip\tзапуск: не Linux x86_64\n'; fi

forgery:
	@d=$$(mktemp -d "$${TMPDIR:-/tmp}/bare-forgery.XXXXXX") || exit 2; trap 'rm -rf "$$d"' EXIT INT TERM; \
	cp expected/header/*.h "$$d/" && cp expected/header/header.c "$$d/forged.c" || exit 2; \
	printf '%s\n' 'void *memcpy(void *to, const void *from, size_t size);' \
	  'void forged(uint32_t *to, const uint32_t *from) { memcpy(to, from, 4096); }' >> "$$d/forged.c"; \
	$(CC) $(BARE) -O0 -fno-builtin -c "$$d/forged.c" -o "$$d/forged.o" || exit 2; \
	undefined=$$(nm -u "$$d/forged.o"); \
	[ -n "$$undefined" ] || { echo "подделка с memcpy не замечена: nm -u пуст"; exit 1; }; \
	echo "forgery: подделка замечена — $$undefined"

differential:
	@d=$$(mktemp -d "$${TMPDIR:-/tmp}/bare-differential.XXXXXX") || exit 2; trap 'rm -rf "$$d"' EXIT INT TERM; \
	"$(FLANG)" emit programs/words.flang --target c --out "$$d/ordinary" > "$$d/emit.log" 2>&1 \
	  || { cat "$$d/emit.log"; echo "обычная генерация C не прошла"; exit 1; }; \
	$(MAKE) -s -C "$$d/ordinary" CFLAGS='-std=c99 -O2' > "$$d/make.log" 2>&1 \
	  || { tail -20 "$$d/make.log"; echo "обычный C не собрался"; exit 1; }; \
	$(CC) $(BARE) -O2 -c expected/words/words.c -o "$$d/bare.o" || exit 1; \
	$(CC) -std=c99 -Wall -Wextra -Werror -O2 -Iexpected/words drivers/words.c "$$d/bare.o" -o "$$d/words" || exit 1; \
	"$$d/words" "$$d/requests" "$$d/got" || exit 1; \
	"$$d/ordinary/flang_cli" --json < "$$d/requests" | sed -E 's/,"message":.*$$/}/' > "$$d/want"; \
	asked=$$(wc -l < "$$d/requests"); answered=$$(wc -l < "$$d/want"); \
	[ "$$asked" = "$$answered" ] || { echo "запросов $$asked, ответов обычного C $$answered"; exit 1; }; \
	cmp "$$d/want" "$$d/got" || { diff "$$d/want" "$$d/got" | head -20; echo "ответы разошлись"; exit 1; }; \
	echo "differential: входов $$asked, из них ошибок $$(grep -c '"ok":false' "$$d/got"), расхождений 0"

# Сверить каталог $$d/out с expected/ и с ожидаемыми отказами.
define COMPARE
for name in $(EXACT); do \
  if [ "$(UPDATE)" = 1 ]; then rm -rf "expected/$$name"; cp -r "$$d/out/$$name" "expected/$$name"; fi; \
  diff -r "expected/$$name" "$$d/out/$$name" > "$$d/diff.log" \
    || { head -30 "$$d/diff.log"; echo "генерация $$name разошлась с expected/"; exit 1; }; \
done; \
for name in $(REFUSED); do \
  want=$$(cat "programs/refused/$$name.txt"); \
  grep -qF -- "$$want" "$$d/out/$$name/REFUSED.txt" 2> /dev/null \
    || { echo "программа refused/$$name.flang: ждали ошибку со словами «$$want»"; \
         cat "$$d/out/$$name/REFUSED.txt" 2> /dev/null; ls "$$d/out/$$name"; exit 1; }; \
done;
endef

fresh:
	@d=$$(mktemp -d "$${TMPDIR:-/tmp}/bare-fresh.XXXXXX") || exit 2; trap 'rm -rf "$$d"' EXIT INT TERM; \
	mkdir -p "$$d/out"; \
	"$(FLANG)" emit programs/wrap.flang --target c --freestanding --path wrap --out "$$d/out/wrap" \
	  > "$$d/first.log" 2>&1; \
	if grep -q -e 'непонятный ключ' -e 'ещё не умеет' "$$d/first.log"; then \
	  printf 'skip\tfresh: этот компилятор ключа --freestanding не знает; до пересборки — make from-source\n'; \
	  exit 0; \
	fi; \
	for name in $(PROGRAMS); do \
	  "$(FLANG)" emit "programs/$$name.flang" --target c --freestanding --path "$$name" --out "$$d/out/$$name" \
	    > "$$d/emit.log" 2>&1 \
	    || { cat "$$d/emit.log"; echo "генерация $$name не прошла"; exit 1; }; \
	done; \
	for name in $(REFUSED); do \
	  mkdir -p "$$d/out/$$name"; \
	  "$(FLANG)" emit "programs/refused/$$name.flang" --target c --freestanding --out "$$d/out/$$name" \
	    > "$$d/out/$$name/REFUSED.txt" 2>&1 && { echo "refused/$$name.flang сгенерирована, а должна быть ошибка"; exit 1; }; \
	done; \
	$(COMPARE) \
	$(COMPILERS) built=0; \
	for dir in $$d/out/header $$d/out/index $$d/out/wrap $$d/out/words; do $(BARE_BUILD) done; \
	echo "fresh: программ $(words $(PROGRAMS)), ошибок по делу $(words $(REFUSED)), сборок $$built, внешних символов 0"

from-source:
	@d=$$(mktemp -d "$${TMPDIR:-/tmp}/bare-source.XXXXXX") || exit 2; trap 'rm -rf "$$d"' EXIT INT TERM; \
	"$(FLANG)" emit run-from-source.flang --target c --no-check --out "$$d/generator" > "$$d/emit.log" 2>&1 \
	  || { tail -20 "$$d/emit.log"; echo "генератор из исходника не сгенерирован"; exit 1; }; \
	$(MAKE) -s -C "$$d/generator" CFLAGS='-std=c99 -O1' > "$$d/make.log" 2>&1 \
	  || { tail -20 "$$d/make.log"; echo "генератор из исходника не собрался"; exit 1; }; \
	$(CC) -std=c99 -O1 drivers/pipe.c -o "$$d/pipe" || exit 1; \
	for name in $(PROGRAMS) $(REFUSED); do \
	  mkdir -p "$$d/out/$$name"; \
	  if [ -f "programs/$$name.flang" ]; then source="programs/$$name.flang"; else source="programs/refused/$$name.flang"; fi; \
	  "$$d/pipe" request "$$source" "$$name" | "$$d/generator/flang_cli" --json \
	    | "$$d/pipe" unpack "$$d/out/$$name" \
	    || { echo "генератор не ответил на $$source"; exit 1; }; \
	done; \
	if [ "$(UPDATE)" = 1 ]; then for name in header index; do \
	  rm -rf "expected/$$name"; cp -r "$$d/out/$$name" "expected/$$name"; done; fi; \
	for name in header index; do \
	  diff -r "expected/$$name" "$$d/out/$$name" > "$$d/diff.log" \
	    || { head -30 "$$d/diff.log"; echo "генерация $$name разошлась с expected/"; exit 1; }; \
	done; \
	$(COMPARE) \
	echo "from-source: программ $(words $(PROGRAMS)) сошлись с expected/, ошибок по делу $(words $(REFUSED))"
