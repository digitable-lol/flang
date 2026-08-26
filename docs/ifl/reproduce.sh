#!/usr/bin/env bash
# Каждое число подачи на IFL — здесь, вместе с командой, которая его печатает.
#
# Правило простое: если числа нет в выводе этого скрипта, его нет и в статье.
# Скрипт запускается из любого места, ничего в репозитории не меняет и всё
# временное складывает в каталог, который создаётся заново на каждом прогоне.
#
#   bash docs/ifl/reproduce.sh            всё, включая неподвижную точку (~6 мин)
#   bash docs/ifl/reproduce.sh --fast     без неподвижной точки и без восьми целей
#
# Нужно: node ≥ 20 и больше ничего — сборки у языка нет, зависимостей у пакета
# ноль. Разделу «восемь целей» дополнительно нужны
# cc, go, cargo, python3, javac/java, dotnet, elixir. Чего нет — про то и
# напечатано «тулчейна нет»: пропуск из-за отсутствующего тулчейна не является
# пройденной проверкой (AGENTS.md), и в статью такой пропуск идёт как пропуск.
#
# Имена переменных латиницей нарочно: кириллицу bash в идентификаторах не
# принимает и молча делает не то, что читается.
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORK="${TMPDIR:-/tmp}/flang-ifl-chisla"
FAST=0
[ "${1:-}" = "--fast" ] && FAST=1
rm -rf "$WORK"; mkdir -p "$WORK"
cd "$ROOT"

head_of() { printf '\n=== %s ===\n' "$1"; }

head_of "0. Среда прогона — числа от неё зависят, поэтому печатается и она"
printf 'дата (UTC)     %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
printf 'коммит         %s\n' "$(git rev-parse --short HEAD 2>/dev/null || echo '—')"
printf 'node           %s\n' "$(node --version)"
printf 'cc             %s\n' "$(command -v cc >/dev/null && cc --version | head -1 || echo 'нет')"
printf 'ядер           %s\n' "$(nproc 2>/dev/null || echo '?')"
printf 'ОЗУ, ГиБ       %s\n' "$(free -g 2>/dev/null | awk '/^Mem:/{print $2}' || echo '?')"

head_of "1. Размер того, что самоприменяется"
printf 'исходники компилятора на flang, строк    %s\n' \
  "$(cat flang/self/*.flang flang/self/bootstrap/*.flang | wc -l)"
printf 'исходники компилятора на flang, байт     %s\n' \
  "$(cat flang/self/*.flang flang/self/bootstrap/*.flang | wc -c)"
# Расширений у программы четыре и они равноправны: `.flang`, `.fp`, `.фп`,
# `.фланг` (ADR-0016). Число по одному из них было бы меньше дерева.
printf 'файлов программы в репозитории           %s\n' \
  "$(find . \( -name '*.flang' -o -name '*.fp' -o -name '*.фп' -o -name '*.фланг' \) -not -path './node_modules/*' | wc -l)"
printf 'объявлений «тотальная функция»           %s\n' \
  "$(grep -rh '^тотальная функция ' --include='*.flang' --include='*.fp' --include='*.фп' --include='*.фланг' . | wc -l)"
printf 'объявлений «функция» (обычных)           %s\n' \
  "$(grep -rh '^функция ' --include='*.flang' --include='*.fp' --include='*.фп' --include='*.фланг' . | wc -l)"
printf 'объявлений «убывает» (мера)              %s\n' \
  "$(grep -rh '^[[:space:]]*убывает ' --include='*.flang' --include='*.fp' --include='*.фп' --include='*.фланг' . | wc -l)"
echo 'где именно объявлена мера:'
grep -rln '^[[:space:]]*убывает ' --include='*.flang' --include='*.fp' --include='*.фп' --include='*.фланг' . | sed 's/^/  /'

head_of "2. Связанный компилятор, печать в C, корпус побайтовой сверки"
echo 'команда: node docs/ifl/facts.mjs'
node docs/ifl/facts.mjs

head_of "3. Одна мера, девять исполнителей, побайтовая сверка диагностики"
echo 'команда: bash docs/ifl/measure-across-targets.sh'
bash docs/ifl/measure-across-targets.sh "$WORK/celi" "$FAST"

head_of "4. Что напечатанный код НЕ держит — тоже прогоном, а не на слово"
echo 'предел шагов и предел глубины по восьми целям:'
node --input-type=module -e '
import { parse } from "./flang/src/parser.mjs"
const исходник = [
  "функция «Вечно»",
  "  принимает н: число",
  "  возвращает число",
  "  «Вечно» от (н плюс 1)",
  "",
].join("\n")
const программа = parse(исходник, "вечно.flang")
const цели = {
  c: ["./flang/src/emit/c.mjs", "emitC"],
  go: ["./flang/src/emit/go.mjs", "emitGo"],
  rust: ["./flang/src/emit/rust.mjs", "emitRust"],
  python: ["./flang/src/emit/python.mjs", "emitPython"],
  java: ["./flang/src/emit/java.mjs", "emitJava"],
  csharp: ["./flang/src/emit/csharp.mjs", "emitCsharp"],
  elixir: ["./flang/src/emit/elixir.mjs", "emitElixir"],
  js: ["./flang/src/emit/js.mjs", "emitJs"],
}
for (const [имя, [путь, экспорт]] of Object.entries(цели)) {
  const модуль = await import(путь)
  const текст = модуль[экспорт](программа).files.map((файл) => файл.content).join("\n")
  console.log(
    "  " + имя.padEnd(8),
    "предел шагов:", /max_?steps/i.test(текст) ? "есть" : "НЕТ ",
    "| предел глубины:", /max_?depth/i.test(текст) ? "есть" : "НЕТ ",
    "| FLANG_RECURSION_LIMIT:", /RECURSION_LIMIT/.test(текст) ? "есть" : "НЕТ",
  )
}'
echo
echo 'сколько целей из восьми печатают конкурентность (читают program.processes):'
grep -l 'program\.processes\|программа\.processes\|\.processes' flang/src/emit/*.mjs | sed 's/^/  /'
echo
echo 'виды отказов процесса, которые язык считает замкнутым множеством:'
node -e 'import("./flang/src/failures.mjs").then((м) => console.log("  " + Object.values(м.КОДЫ_ОТКАЗА).join(", ")))'
echo 'а этот код рантайм C выдаёт, и в множестве его нет:'
grep -n 'FL_CODE_MEMORY' flang/src/emit/c/flang_runtime.h | head -1 | sed 's/^/  /'
node -e 'import("./flang/src/failures.mjs").then((м) =>
  console.log("  FLANG_MEMORY входит в замкнутое множество:",
    Object.values(м.КОДЫ_ОТКАЗА).includes("FLANG_MEMORY")))'

if [ "$FAST" = "1" ]; then
  head_of "5. Неподвижная точка — ПРОПУЩЕНА (--fast)"
  echo 'запустите без --fast, либо руками:'
  echo '  FTS_REQUIRE_TOOLCHAINS=c node --test flang/test/self-bootstrap.test.mjs'
  exit 0
fi

head_of "5. Неподвижная точка: три печати компилятора совпадают побайтово"
echo 'команда: FTS_REQUIRE_TOOLCHAINS=c node --test flang/test/self-bootstrap.test.mjs'
echo '(FTS_REQUIRE_TOOLCHAINS=c обязателен: без него отсутствие cc даёт пропуск,'
echo ' а пропуск в этой проверке выглядел бы как успех)'
FTS_REQUIRE_TOOLCHAINS=c node --test flang/test/self-bootstrap.test.mjs 2>&1 \
  | grep -E 'неподвижная точка|(tests|suites|pass|fail|cancelled|skipped|todo|duration_ms) [0-9]'
