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
# ⚠ РАЗДЕЛЫ 2, 4 И 5 СЕГОДНЯ НЕ СЧИТАЮТСЯ, И СКРИПТ ГОВОРИТ ОБ ЭТОМ ВСЛУХ.
#
# Они звали реализацию языка на JavaScript. Её удалили двумя коммитами —
# `fe8e8a37` (20 августа 2026, `flang/src/*.mjs` и `flang/bin/flang.mjs`) и
# `105943cd` (там же, 46 файлов проверок, среди них `self-bootstrap.test.mjs`).
# Из тринадцати путей, которые называл этот скрипт, в дереве нет ДВЕНАДЦАТИ:
# `flang/src/parser.mjs`, `flang/src/failures.mjs`, восемь `flang/src/emit/*.mjs`,
# `flang/test/self-bootstrap.test.mjs` и `docs/ifl/facts.mjs` (последний не
# удалялся — его не было никогда). Остался один: `docs/ifl/measure-across-targets.sh`.
#
# До 30 августа 2026 скрипт при этом печатал трассировки node и ВОЗВРАЩАЛ 0.
# То есть на обещание «числа нет в выводе — нет и в статье» он отвечал
# успехом, не посчитав ничего. Теперь каждое место названо отказом, а код
# возврата — 1. Прогон, доказавший это: `bash docs/ifl/reproduce.sh --fast`,
# 30 августа 2026, код 0, три `MODULE_NOT_FOUND` и один `grep: No such file`.
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

# Средства нет — говорим об этом строкой и считаем. Молчаливый пропуск здесь
# и есть та болезнь, ради которой скрипт написан: он выглядел бы как успех.
NET_SREDSTVA=0
net_sredstva() {
  NET_SREDSTVA=$((NET_SREDSTVA + 1))
  printf 'НЕ СЧИТАНО: %s\n' "$1"
  printf '  чем считалось: %s — в дереве этого файла НЕТ\n' "$2"
  printf '  чем считать сегодня: %s\n' "$3"
}

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
net_sredstva 'связанный компилятор, печать в C, корпус побайтовой сверки' \
  'docs/ifl/facts.mjs' \
  'bootstrap/flang ast flang/self/bootstrap/compiler.flang (разбор со связыванием) и make -C bootstrap (печать в C из семени)'

head_of "3. Одна мера, девять исполнителей, побайтовая сверка диагностики"
echo 'команда: bash docs/ifl/measure-across-targets.sh'
bash docs/ifl/measure-across-targets.sh "$WORK/celi" "$FAST"

head_of "4. Что напечатанный код НЕ держит — тоже прогоном, а не на слово"
net_sredstva 'предел шагов и предел глубины у восьми целей печати' \
  'flang/src/parser.mjs и восемь flang/src/emit/*.mjs' \
  'bootstrap/flang emit <программа> --target <цель> и поиск max_steps/max_depth в выводе'
echo
echo 'сколько целей из восьми печатают конкурентность (читают ключ processes):'
grep -l 'processes' flang/self/emit-*.flang | sed 's/^/  /'
echo
echo 'виды отказов процесса, которые язык считает замкнутым множеством:'
echo '  таблица «вид → код» лежит в «Коды отказа» (flang/self/failures.flang):'
sed -n '/^тотальная функция «Коды отказа»/,/^$/p' flang/self/failures.flang \
  | grep -o 'FLANG_[A-Z_]*' | LC_ALL=C sort -u | tr '\n' ' ' | sed 's/^/  /'
echo
echo '  кем этот слой ввезён и чем судится (счёт прогоном, а не пометкой):'
printf '    ввозят его файлов: %s\n' \
  "$(grep -rl 'использует «Множество отказов процесса»' --include='*.flang' . | wc -l)"
printf '    утверждений над ним в flang/проверки: %s\n' \
  "$(grep -c 'Вердикт отказов» от' flang/проверки/process-failures.flang)"
echo '    ⚠ два входа анализа — «Достижимые отказы» и «Отказы начального» —'
echo '      не зовёт по-прежнему ничто (ROADMAP.md, строка 4е)'
echo 'а этот код рантайм C выдаёт, и в множестве его нет:'
grep -n 'FL_CODE_MEMORY' flang/src/emit/c/flang_runtime.h | head -1 | sed 's/^/  /'

itog() {
  echo
  if [ "$NET_SREDSTVA" -gt 0 ]; then
    printf 'ИТОГ: не считано разделов — %s. Код возврата 1.\n' "$NET_SREDSTVA"
    printf 'Пока это так, обещание в шапке («числа нет в выводе — нет и в статье»)\n'
    printf 'держит только то, что напечаталось выше, и ничего сверх того.\n'
    exit 1
  fi
  echo 'ИТОГ: посчитано всё, что скрипт обещает.'
  exit 0
}

if [ "$FAST" = "1" ]; then
  head_of "5. Неподвижная точка — ПРОПУЩЕНА (--fast)"
  itog
fi

head_of "5. Неподвижная точка: три печати компилятора совпадают побайтово"
net_sredstva 'неподвижная точка самораскрутки' \
  'flang/test/self-bootstrap.test.mjs' \
  'sh scripts/raskrutka.sh --check — сверяет закоммиченное семя с печатью побайтово; идёт часы, а не минуты (замер 24 августа 2026: 5 ч 30 мин, пик 259 ГБ)'
itog
