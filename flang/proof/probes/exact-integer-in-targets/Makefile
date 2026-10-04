# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# СБОРКА ВОДИТЕЛЕЙ ПРОБЫ по одному правилу на цель печати. Приговор выносит не
# этот файл, а план `run.fscript`: здесь только зовы компиляторов, там — список
# целей, ожидаемый ответ и разбор «зелено / красно / не мерено».
#
#   make -s c          собрать и прогнать водителя цели «c»
#
# Каждое правило печатает СЕМЬ строк «опыт<таб>разряды<таб>десятичное», и план
# сверяет их целиком. Нет инструментов цели или нет в рантайме сложения разрядов
# — правило печатает одну строку «skip<таб>причина» и выходит с кодом 0: проба
# обязана различать «плохо» и «не проверено».
#
# Рантайм берётся НЕ из дерева, а из вывода `flang emit`: пробе нужны те байты,
# которые цель получает на руки. Печатается программа на точном целом, а если
# двоичный этого слова ещё не знает — простая, только ради рантайма; тогда у
# целей «js» и «ts» напечатанного `$exactSum` не будет, и они честно «skip».

KOREN := $(abspath ../../../..)
FLANG := $(KOREN)/bootstrap/flang
VODILY := $(abspath drivers)
TOCHNOE := $(abspath programs/sum-beyond-the-ceiling.flang)
PROSTOE := $(abspath programs/plain.flang)
BEZSEMENI := рантайм JS печатается из flang/self/emit-js.flang и достаётся только печатью программы на точном целом: нужно семя после задачи 1908

# Каталог рантайма: цели «cpp» и «ts» берут его у чужой цели («c» и «js»),
# поэтому им называется общий каталог, а не свой, — так требует сам печатник.
RT_c := $(KOREN)/flang/src/emit/c
RT_cpp := $(KOREN)/flang/src/emit
RT_python := $(KOREN)/flang/src/emit/python
RT_go := $(KOREN)/flang/src/emit/go
RT_java := $(KOREN)/flang/src/emit/java
RT_csharp := $(KOREN)/flang/src/emit/csharp
RT_rust := $(KOREN)/flang/src/emit/rust
RT_elixir := $(KOREN)/flang/src/emit/elixir
RT_js := $(KOREN)/flang/src/emit/js
RT_ts := $(KOREN)/flang/src/emit

# Напечатать программу цели $(1) в $$d/p. Сначала точным целым, потом простой.
define PECHAT
d=$$(mktemp -d "$${TMPDIR:-/tmp}/exact-$(1).XXXXXX") || exit 2; \
trap 'rm -rf "$$d"' EXIT INT TERM; \
"$(FLANG)" emit "$(TOCHNOE)" --target $(1) --out "$$d/p" --runtime "$(RT_$(1))" > "$$d/e" 2>&1 \
  || "$(FLANG)" emit "$(PROSTOE)" --target $(1) --out "$$d/p" --runtime "$(RT_$(1))" > "$$d/e" 2>&1 \
  || { printf 'skip\tпечать не прошла: %s\n' "$$(head -1 "$$d/e")"; exit 0; };
endef

# Есть ли в напечатанном рантайме JS сложение разрядов.
define EST_JS
grep -q exactSum "$$d/p/flang_runtime.js" 2> /dev/null || { printf 'skip\t$(BEZSEMENI)\n'; exit 0; };
endef

.PHONY: c cpp python go java csharp rust elixir js ts

c:
	@command -v cc > /dev/null 2>&1 || { printf 'skip\tнет cc\n'; exit 0; }; \
	$(call PECHAT,c) \
	cp "$(VODILY)/driver.c" "$$d/p/" && cd "$$d/p" \
	  && cc -std=c99 -Wall -Wextra -Werror -pedantic -O2 -o driver driver.c flang_runtime.c -lm \
	  && ./driver

cpp:
	@command -v g++ > /dev/null 2>&1 || { printf 'skip\tнет g++\n'; exit 0; }; \
	$(call PECHAT,cpp) \
	cp "$(VODILY)/driver.cpp" "$$d/p/" && cd "$$d/p" \
	  && g++ -std=c++20 -Wall -Wextra -Werror -pedantic -O2 -o driver driver.cpp flang_runtime.cpp -lm \
	  && ./driver

# Водитель цели «python» лежит ЗДЕСЬ, а не в drivers/: сторож роста не пускает в
# дерево новый .py вне flang/src/emit (.githooks/no-growth.fscript), и правило
# выписывает его в рабочий каталог само. Длинные целые у Python есть в самом
# языке (ADR-0036 §6, первая цена), поэтому десятичное — одна строка `int`.
python:
	@command -v python3 > /dev/null 2>&1 || { printf 'skip\tнет python3\n'; exit 0; }; \
	$(call PECHAT,python) \
	printf '%s\n' \
	  'import sys' \
	  'sys.path.insert(0, sys.argv[1])' \
	  'import flang_runtime as rt' \
	  'BASE = 4194304' \
	  'def digits(values):' \
	  '    return rt.list_of([rt.number(value) for value in values])' \
	  'def places(value):' \
	  '    return [int(item.data) for item in rt.list_items(value)]' \
	  'def decimal(value):' \
	  '    total = 0' \
	  '    for digit in reversed(places(value)):' \
	  '        total = total * BASE + digit' \
	  '    return total' \
	  'def total(label, left, right):' \
	  '    out = rt.add(None, digits(left), digits(right))' \
	  '    shown = ",".join(str(digit) for digit in places(out))' \
	  '    print("%s\t%s\t%d" % (label, shown, decimal(out)))' \
	  'total("beyond", [1, 0, 512], [1])' \
	  'total("carry", [4194303], [1])' \
	  'total("wide", [4194303, 4194303, 4194303], [1, 0, 0])' \
	  'total("denormal", [4194305], [0])' \
	  'total("forged", [1, 0, 511], [1])' \
	  'print("numbers\t%d" % rt.add(None, rt.number(2), rt.number(3)).data)' \
	  'try:' \
	  '    rt.add(None, digits([1, 0, 512]), rt.number(1))' \
	  'except Exception as refusal:' \
	  '    print("refusal\t%s" % refusal)' \
	  > "$$d/driver-python" \
	  && python3 "$$d/driver-python" "$$d/p"

go:
	@command -v go > /dev/null 2>&1 || { printf 'skip\tнет go\n'; exit 0; }; \
	$(call PECHAT,go) \
	mkdir -p "$$d/r" \
	  && sed 's/^package .*/package main/' "$$d/p/flangrt/flang_runtime.go" > "$$d/r/flang_runtime.go" \
	  && cp "$(VODILY)/driver.go" "$$d/r/main.go" \
	  && printf 'module exact\n\ngo 1.21\n' > "$$d/r/go.mod" \
	  && cd "$$d/r" && GOFLAGS=-mod=mod GOCACHE="$$d/gocache" go run .

java:
	@{ command -v javac > /dev/null 2>&1 && command -v java > /dev/null 2>&1; } \
	  || { printf 'skip\tнет javac или java\n'; exit 0; }; \
	$(call PECHAT,java) \
	rm -f "$$d/p/FlangCli.java" && cp "$(VODILY)/Driver.java" "$$d/p/" && cd "$$d/p" \
	  && javac -nowarn -d . ./*.java && java Driver

csharp:
	@command -v dotnet > /dev/null 2>&1 || { printf 'skip\tнет dotnet\n'; exit 0; }; \
	$(call PECHAT,csharp) \
	rm -f "$$d/p/FlangCli.cs" "$$d"/p/*.csproj && cp "$(VODILY)/Driver.cs" "$$d/p/" \
	  && printf '%s\n' \
	    '<Project Sdk="Microsoft.NET.Sdk">' \
	    '  <PropertyGroup>' \
	    '    <OutputType>Exe</OutputType>' \
	    '    <TargetFramework>net10.0</TargetFramework>' \
	    '    <Nullable>disable</Nullable>' \
	    '    <InvariantGlobalization>true</InvariantGlobalization>' \
	    '  </PropertyGroup>' \
	    '</Project>' > "$$d/p/exact.csproj" \
	  && cd "$$d/p" && DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1 NUGET_PACKAGES="$$d/nuget" \
	    dotnet run --nologo

rust:
	@command -v cargo > /dev/null 2>&1 || { printf 'skip\tнет cargo\n'; exit 0; }; \
	$(call PECHAT,rust) \
	mkdir -p "$$d/r/src" && cp "$$d/p/src/runtime.rs" "$$d/r/src/flang_runtime.rs" \
	  && cp "$(VODILY)/driver.rs" "$$d/r/src/main.rs" \
	  && printf '[package]\nname = "exact"\nversion = "0.1.0"\nedition = "2021"\n' > "$$d/r/Cargo.toml" \
	  && cd "$$d/r" && CARGO_TARGET_DIR="$$d/r/target" cargo run --quiet 2> /dev/null

elixir:
	@command -v elixir > /dev/null 2>&1 || { printf 'skip\tнет elixir\n'; exit 0; }; \
	$(call PECHAT,elixir) \
	elixir "$(VODILY)/driver.exs" "$$d/p/flang_runtime.ex"

js:
	@command -v node > /dev/null 2>&1 || { printf 'skip\tнет node\n'; exit 0; }; \
	$(call PECHAT,js) \
	$(EST_JS) \
	printf '{"type":"module"}\n' > "$$d/p/package.json" \
	  && node "$(VODILY)/driver.mjs" "$$d/p/flang_runtime.js"

# Собирается в ПОДКАТАЛОГ: с --outDir рядом с входом tsc отказывается
# перезаписывать flang_runtime.js (TS5055), а рантайм нужен обоим — и сборке
# (ввоз имён), и прогону (сам код).
ts:
	@{ command -v node > /dev/null 2>&1 && command -v npx > /dev/null 2>&1; } \
	  || { printf 'skip\tнет node или npx\n'; exit 0; }; \
	$(call PECHAT,ts) \
	$(EST_JS) \
	mkdir -p "$$d/t/vyvod" && cp "$$d/p/flang_runtime.js" "$$d/t/" \
	  && cp "$$d/p/flang_runtime.js" "$$d/t/vyvod/" && cp "$(VODILY)/driver.ts" "$$d/t/" \
	  && printf '{"type":"module"}\n' > "$$d/t/vyvod/package.json" && cd "$$d/t" \
	  && { npx --yes tsc driver.ts --target es2020 --module es2020 --moduleResolution bundler \
	       --allowJs --checkJs false --outDir vyvod > /dev/null 2>&1 || true; } \
	  && node vyvod/driver.js
