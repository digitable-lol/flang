#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# ОБОЛОЧКА ПОД ТРУБОЙ — ПРЕЖНЯЯ БАЙТ В БАЙТ, ПОД ТЕРМИНАЛОМ — ПРАВИТ СТРОКУ.
#
#   sh scripts/repl-proba.sh                 судить bootstrap/flang
#   sh scripts/repl-proba.sh <двоичный>      судить названный
#
# Коды возврата:
#   0  труба дала ожидаемый вывод без единого ESC, клавиши под pty сделали
#      то, что обещаны, NO_COLOR снял цвет;
#   1  расхождение — названо словами;
#   2  судить нечем: нет двоичного, нет python3 с pty или нет `cc`
#      (без него выражение проверяется, но не вычисляется, и ответа «5» не
#      будет). ЭТО НЕ ПРОЙДЕННАЯ ПРОВЕРКА (AGENTS.md).
#
# ── Что судится и почему именно это ─────────────────────────────────────────
# Задача 3636 поставила в оболочку редактор строки и тему digitable. Оба
# обещания проверяемы только двумя разными концами:
#
#   ТРУБА.  `flang repl < сценарий` — прогон сценария, им живут формула Homebrew
#           и проба asdf. Стоит хоть одному ESC цвета попасть в такой вывод, и
#           сценарий, который сверяют по тексту, красен у всех. Поэтому труба
#           гоняется с COLORTERM=truecolor и TERM=xterm-256color нарочно — в
#           самом «цветном» окружении вывод обязан остаться голым.
#
#   PTY.    Клавиши видны только терминалу: под трубой оболочка читает fgets и
#           ни одной последовательности не разбирает. Псевдотерминал даёт
#           python3 (модуль pty есть в любой сборке), expect в дереве не
#           требуется. Сценарий: Home и End двигают курсор, Backspace стирает
#           знак, ↑ возвращает прошлую строку, ⌥b и Ctrl-← ходят по словам,
#           Ctrl-U стирает до начала. Ответы считаются по набранному, и буквы
#           `^[[` в выводе быть не должно — это и был предмет задачи.
#
#   ЦВЕТ.   NO_COLOR действует самим наличием (правило flang-env): под pty с
#           NO_COLOR= в выводе не должно быть ни одной последовательности SGR.
set -u

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
BIN=${1:-$ROOT/bootstrap/flang}
[ -x "$BIN" ] || { echo "нет двоичного: $BIN — судить нечем (код 2)" >&2; exit 2; }
command -v python3 >/dev/null 2>&1 || { echo "нет python3 — pty взять нечем (код 2)" >&2; exit 2; }
python3 -c 'import pty' 2>/dev/null || { echo "python3 без модуля pty (код 2)" >&2; exit 2; }
command -v cc >/dev/null 2>&1 || { echo "нет cc — выражения не вычислятся (код 2)" >&2; exit 2; }

RAB=${FLANG_TMP:-/srv/tmp}/repl-proba.$$
mkdir -p "$RAB" || exit 2
trap 'rm -rf "$RAB"' EXIT INT TERM
BEDA=0

# ── труба ────────────────────────────────────────────────────────────────────
printf '2 плюс 2\nтотальная функция «Удвоить»\n  принимает х: число\n  возвращает число\n  х умножить на 2\n\n«Удвоить» от 21\n«Нет такой» от 1\n.выход\n' > "$RAB/vhod"
printf '4\nобъявлено: тотальная функция «Удвоить» — завершение доказано\n42\n' > "$RAB/zhdu.out"
printf 'FLANG_UNKNOWN_NAME, строка 1, столбец 1: неизвестная функция «Нет такой»\n' > "$RAB/zhdu.err"
env -u NO_COLOR COLORTERM=truecolor TERM=xterm-256color LC_ALL=C.UTF-8 \
  "$BIN" repl < "$RAB/vhod" > "$RAB/est.out" 2> "$RAB/est.err"
KOD=$?
if [ "$KOD" != 1 ]; then
  echo "труба: код $KOD, ждали 1 (в сценарии есть отказ, конвейеру он нужен кодом)"; BEDA=1
fi
if ! cmp -s "$RAB/zhdu.out" "$RAB/est.out"; then
  echo "труба: stdout разошёлся"; diff "$RAB/zhdu.out" "$RAB/est.out"; BEDA=1
fi
if ! cmp -s "$RAB/zhdu.err" "$RAB/est.err"; then
  echo "труба: stderr разошёлся"; diff "$RAB/zhdu.err" "$RAB/est.err"; BEDA=1
fi
if LC_ALL=C grep -q "$(printf '\033')" "$RAB/est.out" "$RAB/est.err"; then
  echo "труба: в выводе есть ESC — цвет протёк в конвейер"; BEDA=1
fi
[ "$BEDA" = 0 ] && echo "  зелен  труба: вывод прежний, ESC нет"

# ── pty ──────────────────────────────────────────────────────────────────────
python3 - "$BIN" "$RAB" <<'PY'
import os, pty, re, sys, time, select
binary, rab = sys.argv[1], sys.argv[2]

def run(env_extra, keys):
    env = dict(os.environ, LC_ALL='C.UTF-8', TERM='xterm-256color', COLORTERM='truecolor')
    env.pop('FLANG_MODULE_DIR', None); env.pop('NO_COLOR', None)
    env.update(env_extra)
    pid, fd = pty.fork()
    if pid == 0:
        os.execve(binary, [binary, 'repl'], env)
    out = b''
    def drain(seconds):
        nonlocal out
        end = time.time() + seconds
        while time.time() < end:
            ready, _, _ = select.select([fd], [], [], 0.05)
            if ready:
                try:
                    data = os.read(fd, 65536)
                except OSError:
                    return
                if not data:
                    return
                out += data
    drain(1.0)
    for data, wait in keys:
        os.write(fd, data); drain(wait)
    os.write(fd, b'\x04'); drain(1.0)
    try:
        os.waitpid(pid, 0)
    except ChildProcessError:
        pass
    return out

ESC = b'\x1b'
HOME, END, UP = ESC + b'[H', ESC + b'[F', ESC + b'[A'
CTRL_LEFT, ALT_B, CTRL_U, BACKSPACE = ESC + b'[1;5D', ESC + b'b', b'\x15', b'\x7f'
answer_wait = 6.0
out = run({}, [
    ('плюс 3'.encode(), 0.3), (HOME, 0.3), ('2 '.encode(), 0.3), (END, 0.3), (b'\r', answer_wait),
    ('2 плюс 4'.encode(), 0.3), (BACKSPACE, 0.3), (b'3', 0.3), (b'\r', answer_wait),
    (UP, 0.3), (ALT_B, 0.3), (CTRL_LEFT, 0.3), (CTRL_U, 0.3), ('7 минус 1'.encode(), 0.3), (b'\r', answer_wait),
])
open(os.path.join(rab, 'pty.out'), 'wb').write(out)
beda = 0
def answers(raw):
    # Ответ печатается своей строкой после \r\n; цвет ответа — bold white.
    lines = raw.replace(b'\r\n', b'\n').split(b'\n')
    got = []
    for line in lines:
        plain = line
        while b'\x1b[' in plain:
            at = plain.index(b'\x1b[')
            end = at + 2
            while end < len(plain) and not (0x40 <= plain[end] <= 0x7e):
                end += 1
            plain = plain[:at] + plain[end + 1:]
        plain = plain.strip()
        if plain and all(ch in b'0123456789' for ch in plain):
            got.append(plain.decode())
    return got
got = answers(out)
if got != ['5', '5', '9']:
    print('pty: ответы', got, 'ждали [5, 5, 9] — Home/End, Backspace, история или слова не сработали'); beda = 1
if b'^[[' in out or b'^[b' in out:
    print('pty: в выводе буквальное ^[ — клавиша напечаталась знаками, а не сработала'); beda = 1
if b'\x1b[38;2;' not in out:
    print('pty: под truecolor нет ни одной последовательности 38;2 — тема не красит'); beda = 1
if b'\x1b[1;38;2;245;247;250m5' not in out:
    print('pty: ответ 5 не выкрашен белым полужирным (палитра digitable)'); beda = 1
plain = run({'NO_COLOR': ''}, [('1 плюс 1'.encode(), 0.3), (b'\r', answer_wait)])
open(os.path.join(rab, 'pty-nocolor.out'), 'wb').write(plain)
if re.search(rb'\x1b\[[0-9;]*m', plain):
    print('pty: NO_COLOR= стоит, а цвет (SGR) есть'); beda = 1
if answers(plain) != ['2']:
    print('pty: без цвета ответ', answers(plain), 'ждали [2]'); beda = 1
if beda == 0:
    print('  зелен  pty: Home/End/Backspace/↑/⌥b/Ctrl-←/Ctrl-U сработали, ответы 5, 5, 9; NO_COLOR снял цвет')
sys.exit(beda)
PY
[ $? = 0 ] || BEDA=1

if [ "$BEDA" != 0 ]; then
  echo "ПРОБА ОБОЛОЧКИ КРАСНА (вывод pty — $RAB/pty.out до выхода скрипта)" >&2
  exit 1
fi
echo "проба оболочки зелена"
exit 0
