#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# ВЛАДЕНИЕ СОСТОЯНИЕМ: обработчик процесса принимает РОВНО своё состояние.
#
#   sh flang/проверки/владение-состоянием.sh
#
# Правило то же, что правило десятое в flang/self/processes.flang: у обработчика
# ровно два довода, первый — тип из строки «состояние» процесса знак в знак,
# второй — тип из строки «принимает». Здесь оно проверяется ПО ВСЕМУ ДЕРЕВУ и
# работает уже сегодня, до перепечатки семени: разбор берётся у двоичного
# (`flang ast`), сличение делает python3.
#
# Проверка ДВУСТОРОННЯЯ. Подлоги дерева названы списком ниже: каждый из них
# обязан быть пойман, и поимка их зелёная. Красное — это расхождение в файле,
# подлогом не названном, ИЛИ подлог, который поймать перестали.
#
# Код 0 — сошлось. Код 1 — расхождение названо файлом, процессом и
# обработчиком. Код 2 — нечем мерить (нет двоичного или python3).
#
# Имена переменных латиницей: sh не принимает кириллицу в именах.
set -eu
LC_ALL=C.UTF-8
export LC_ALL

root=$(cd "$(dirname "$0")/../.." && pwd)
tool=${FLANG_BIN:-"$root/bootstrap/flang"}
[ -x "$tool" ] || { echo "нет двоичного «$tool». Собрать: make -C bootstrap" >&2; exit 2; }
command -v python3 >/dev/null 2>&1 || { echo "нет python3 — сличать разбор нечем" >&2; exit 2; }

cd "$root"
files=$(grep -rl '^процесс «' --include='*.flang' --include='*.fp' --include='*.фп' --include='*.фланг' . | sed 's|^\./||' | sort)

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT INT TERM

parsed=0
unparsed=0
for file in $files; do
  if "$tool" ast "$file" > "$work/ast.json" 2> "$work/ast.err"; then
    parsed=$((parsed + 1))
    printf '%s\n' "$file" >> "$work/files.txt"
    cp "$work/ast.json" "$work/$parsed.json"
  else
    unparsed=$((unparsed + 1))
    printf '%s\n' "$file" >> "$work/unparsed.txt"
  fi
done

PODLOGI="flang/test/fixtures/processes/13-handler-over-foreign-state-accepted-today.flang
flang/test/fixtures/processes/14-handler-with-foreign-state-argument-accepted-today.flang
flang/conc/examples/distributed-foreign-state-forged.flang"
printf '%s\n' "$PODLOGI" > "$work/подлоги.txt"

set +e
python3 - "$work" <<'PY'
import json, os, sys

work = sys.argv[1]


def lines(name):
    path = os.path.join(work, name)
    if not os.path.exists(path):
        return []
    return [line for line in open(path, encoding='utf-8').read().split('\n') if line]


files = lines('files.txt')
podlogi = set(lines('подлоги.txt'))

processes = 0
handlers = 0
breaches = []

for number, name in enumerate(files, start=1):
    tree = json.load(open(os.path.join(work, '%d.json' % number), encoding='utf-8'))
    functions = {f.get('name'): f for f in tree.get('functions', [])}
    for process in tree.get('processes', []):
        processes += 1
        handler = process.get('handler')
        state = process.get('state')
        accepts = process.get('accepts')
        function = functions.get(handler)
        if function is None:
            continue
        handlers += 1
        params = function.get('params', [])
        types = [(p.get('type') or {}).get('name', '') for p in params]
        where = '%s: процесс «%s» обработчик «%s»' % (name, process.get('name'), handler)
        if len(types) != 2:
            breaches.append((name, '%s принимает доводов: %d — положено два' % (where, len(types))))
            continue
        if types[0] != state:
            breaches.append((name, '%s принимает первым доводом «%s», а состояние процесса — «%s»' % (where, types[0], state)))
        if types[1] != accepts:
            breaches.append((name, '%s принимает вторым доводом «%s», а принимает процесс «%s»' % (where, types[1], accepts)))

caught = set(name for name, _ in breaches if name in podlogi)
unexpected = [text for name, text in breaches if name not in podlogi]
missed = sorted(podlogi - caught)

print('файлов с процессами разобрано: %d' % len(files))
print('процессов: %d, обработчиков найдено: %d' % (processes, handlers))
print('подлогов названо: %d, из них поймано: %d' % (len(podlogi), len(caught)))
print('расхождений вне подлогов: %d' % len(unexpected))
for text in unexpected:
    print('  ' + text)
for name in missed:
    print('  подлог больше не ловится: ' + name)
sys.exit(1 if (unexpected or missed) else 0)
PY
status=$?
set -e

if [ "$unparsed" -gt 0 ]; then
  echo "не разобрано файлов: $unparsed (они уже красные разбором, правило о владении к ним неприменимо)"
  cat "$work/unparsed.txt"
fi

exit $status
