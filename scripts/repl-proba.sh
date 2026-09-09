#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# ОБОЛОЧКА ПОД ТРУБОЙ — ПРЕЖНЯЯ БАЙТ В БАЙТ, ПОД ТЕРМИНАЛОМ — ПРАВИТ СТРОКУ.
#
#   sh scripts/repl-proba.sh                 судить bootstrap/flang
#   sh scripts/repl-proba.sh <двоичный>      судить названный
#   sh scripts/repl-proba.sh --отпечаток     напечатать верный FLANG_SHELL_ID
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
#
#   ОТПЕЧАТОК. Задача 3637: поставленный двоичный 0.7.14 и свежий отвечали на
#           `--version` одинаково, и человек не мог узнать, что у него в руках.
#           Теперь оболочка называет восемь знаков sha256 своего исходника, и
#           РУКОЙ это число не ставится: здесь оно считается заново и сверяется
#           и с `#define FLANG_SHELL_ID`, и с тем, что печатает двоичный. Файл
#           изменили, а строку забыли — проба красна и печатает верное значение.
#
#   ИСТОРИЯ И Tab. И то и другое видно только под pty: история проверяется
#           двумя запусками подряд с общим FLANG_HISTORY (второй обязан помнить
#           строку первого), дополнение — тем, что «Втр + Tab даёт «Втрое».
#           Файл истории у пробы всегда свой, в каталоге прогона: писать в
#           домашний каталог того, кто гоняет пробу, она не имеет права.
set -u

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
ISTOCHNIK=$ROOT/flang/src/emit/c/flang_repl.c

# Отпечаток оболочки: sha256 исходника БЕЗ строки самого отпечатка — иначе
# число зависело бы от себя. Восемь знаков: столкновений на одном файле не
# ждём, а читать человеку.
otpechatok() {
  if command -v sha256sum >/dev/null 2>&1; then
    LC_ALL=C grep -av '^#define FLANG_SHELL_ID ' "$ISTOCHNIK" | sha256sum | cut -c1-8
  elif command -v shasum >/dev/null 2>&1; then
    LC_ALL=C grep -av '^#define FLANG_SHELL_ID ' "$ISTOCHNIK" | shasum -a 256 | cut -c1-8
  else
    echo ''
  fi
}

if [ "${1:-}" = "--отпечаток" ] || [ "${1:-}" = "--fingerprint" ]; then
  ID=$(otpechatok)
  [ -n "$ID" ] || { echo "нечем считать sha256 (код 2)" >&2; exit 2; }
  printf '#define FLANG_SHELL_ID "%s"\n' "$ID"
  exit 0
fi

BIN=${1:-$ROOT/bootstrap/flang}
[ -x "$BIN" ] || { echo "нет двоичного: $BIN — судить нечем (код 2)" >&2; exit 2; }
command -v python3 >/dev/null 2>&1 || { echo "нет python3 — pty взять нечем (код 2)" >&2; exit 2; }
python3 -c 'import pty' 2>/dev/null || { echo "python3 без модуля pty (код 2)" >&2; exit 2; }
command -v cc >/dev/null 2>&1 || { echo "нет cc — выражения не вычислятся (код 2)" >&2; exit 2; }

RAB=${FLANG_TMP:-/srv/tmp}/repl-proba.$$
mkdir -p "$RAB" || exit 2
trap 'rm -rf "$RAB"' EXIT INT TERM
BEDA=0

# ── отпечаток оболочки ───────────────────────────────────────────────────────
ID=$(otpechatok)
V_FILE=$(LC_ALL=C sed -n 's/^#define FLANG_SHELL_ID "\([0-9a-f]*\)".*/\1/p' "$ISTOCHNIK" | head -1)
if [ -z "$ID" ]; then
  echo "нечем считать sha256 — отпечаток не сверен (код 2)" >&2; exit 2
fi
if [ "$ID" != "$V_FILE" ]; then
  echo "отпечаток: в файле «$V_FILE», а исходник даёт «$ID» — поставьте строку:"
  echo "  sh scripts/repl-proba.sh --отпечаток"
  BEDA=1
fi
V_BIN=$(env -u NO_COLOR LC_ALL=C.UTF-8 "$BIN" --version 2>/dev/null | sed -n 's/^оболочка \([0-9a-f]*\):.*/\1/p' | head -1)
if [ -z "$V_BIN" ]; then
  echo "отпечаток: «$BIN --version» не назвал оболочку — это двоичный старее задачи 3637"
  BEDA=1
elif [ "$V_BIN" != "$V_FILE" ]; then
  echo "отпечаток: двоичный говорит «$V_BIN», а исходник дерева — «$V_FILE»: двоичный не пересобран"
  BEDA=1
fi
[ "$BEDA" = 0 ] && echo "  зелен  отпечаток: исходник, строка и двоичный сошлись ($ID)"

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

def run(env_extra, keys, first=1.0):
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
    drain(first)
    for data, wait in keys:
        os.write(fd, data); drain(wait)
    # Ctrl-U перед Ctrl-D намеренно: Ctrl-D на НЕПУСТОЙ строке стирает знак
    # справа (как в bash и в iex), а не заканчивает ввод, и проба ждала бы
    # выхода вечно. Сначала пустая строка, потом конец ввода.
    os.write(fd, b'\x15\x04'); drain(1.5)
    end = time.time() + 20.0
    while time.time() < end:
        try:
            done, _ = os.waitpid(pid, os.WNOHANG)
        except ChildProcessError:
            break
        if done != 0:
            break
        drain(0.2)
    else:
        os.kill(pid, 9)
        try:
            os.waitpid(pid, 0)
        except ChildProcessError:
            pass
        print('pty: оболочка не вышла по Ctrl-D — снята силой')
    os.close(fd)
    return out

def strip(raw):
    plain = raw.replace(b'\r\n', b'\n')
    while b'\x1b[' in plain:
        at = plain.index(b'\x1b[')
        end = at + 2
        while end < len(plain) and not (0x40 <= plain[end] <= 0x7e):
            end += 1
        plain = plain[:at] + plain[end + 1:]
    return plain.decode('utf-8', 'replace')

def answers(raw):
    got = []
    for line in strip(raw).split('\n'):
        line = line.strip()
        if line and all(ch in '0123456789' for ch in line):
            got.append(line)
    return got

ESC = b'\x1b'
HOME, END, UP = ESC + b'[H', ESC + b'[F', ESC + b'[A'
CTRL_LEFT, ALT_B, CTRL_U, BACKSPACE, TAB = ESC + b'[1;5D', ESC + b'b', b'\x15', b'\x7f', b'\t'
CTRL_L = b'\x0c'
answer_wait = 8.0
beda = 0

# ── правка строки: Home/End, Backspace, история, слова ──
out = run({}, [
    ('плюс 3'.encode(), 0.3), (HOME, 0.3), ('2 '.encode(), 0.3), (END, 0.3), (b'\r', answer_wait),
    ('2 плюс 4'.encode(), 0.3), (BACKSPACE, 0.3), (b'3', 0.3), (b'\r', answer_wait),
    (UP, 0.3), (ALT_B, 0.3), (CTRL_LEFT, 0.3), (CTRL_U, 0.3), ('7 минус 1'.encode(), 0.3), (b'\r', answer_wait),
])
open(os.path.join(rab, 'pty.out'), 'wb').write(out)
got = answers(out)
if got != ['5', '5', '9']:
    print('pty: ответы', got, 'ждали [5, 5, 9] — Home/End, Backspace, история или слова не сработали'); beda = 1
if b'^[[' in out or b'^[b' in out:
    print('pty: в выводе буквальное ^[ — клавиша напечаталась знаками, а не сработала'); beda = 1
if b'\x1b[38;2;' not in out:
    print('pty: под truecolor нет ни одной последовательности 38;2 — тема не красит'); beda = 1
if b'\x1b[1;38;2;245;247;250m5' not in out:
    print('pty: ответ 5 не выкрашен белым полужирным (палитра digitable)'); beda = 1
if beda == 0:
    print('  зелен  pty: Home/End/Backspace/↑/⌥b/Ctrl-←/Ctrl-U сработали, ответы 5, 5, 9')

# ── Ctrl-L: экран чистится, а набранное остаётся на месте ──
# Клавиша работает с задачи 3636, но проба её не нажимала ни разу, и обещание
# справки («Ctrl-L очистить экран») ничем не держалось: пропади разбор байта
# 0x0c — покраснеть было бы нечему. Судятся обе половины обещания сразу:
# ЭКРАН ЧИСТИТСЯ (последовательность 2J) и СТРОКА НЕ ТЕРЯЕТСЯ (набранное до
# нажатия перерисовано после очистки и досчитывается до ответа).
out = run({}, [('4 плюс'.encode(), 0.3), (CTRL_L, 0.6), (' 4'.encode(), 0.3), (b'\r', answer_wait)])
open(os.path.join(rab, 'pty-ctrl-l.out'), 'wb').write(out)
if b'\x1b[2J' not in out:
    print('pty: Ctrl-L не очистил экран — последовательности 2J в выводе нет'); beda = 1
elif '4 плюс' not in strip(out[out.rindex(b'\x1b[2J') + 4:]):
    print('pty: после Ctrl-L набранное не перерисовано — строка потеряна вместе с экраном'); beda = 1
if answers(out) != ['8']:
    print('pty: после Ctrl-L ответ', answers(out), 'ждали [8] — набранное до очистки не досчиталось'); beda = 1
if beda == 0:
    print('  зелен  pty: Ctrl-L очистил экран и вернул набранное на место, ответ 8')

# ── вставка, дополнение по Tab, справка о сборке, очистка экрана ──
history = os.path.join(rab, 'history')
paste = 'тотальная функция «Втрое»\r  принимает х: число\r  возвращает число\r  х умножить на 3\r\r'.encode()
out = run({'FLANG_HISTORY': history}, [
    (paste, 12.0),
    ('«Втр'.encode(), 0.4), (TAB, 0.6), (' от 5'.encode(), 0.3), (b'\r', answer_wait),
    ('.пом'.encode(), 0.4), (TAB, 0.6), (b'\r', 1.5),
    ('.оч'.encode(), 0.4), (TAB, 0.6), (b'\r', 1.0),
])
open(os.path.join(rab, 'pty-tab.out'), 'wb').write(out)
vidno = strip(out)
if 'объявлено: тотальная функция «Втрое»' not in vidno:
    print('pty: вставка четырёх строк одним куском не приняла объявление'); beda = 1
if answers(out)[-1:] != ['15']:
    print('pty: «Втр + Tab + « от 5» дало', answers(out)[-1:], 'ждали [15] — дополнение имени не сработало'); beda = 1
# Перерисовка на каждый байт вставки — то, от чего чинили: сотня очисток строки
# на шесть строк вставки. Считаем очистки за время вставки: их обязано быть по
# горстке на строку, а не по одной на знак.
paste_part = out[:out.find('объявлено'.encode())] if 'объявлено'.encode() in out else out
if paste_part.count(b'\x1b[K') > 30:
    print('pty: вставка перерисовала строку', paste_part.count(b'\x1b[K'), 'раз — мельтешение вернулось'); beda = 1
if 'Эта сборка: flang' not in vidno or 'строку правит оболочка' not in vidno:
    print('pty: «.пом + Tab» не дало справки со сведениями о сборке'); beda = 1
if 'история: строк в этой сессии' not in vidno:
    print('pty: справка не сказала про историю'); beda = 1
if b'\x1b[2J' not in out:
    print('pty: «.оч + Tab» не очистило экран — команды не дополняются'); beda = 1
if not os.path.exists(history):
    print('pty: файл истории', history, 'не заведён'); beda = 1

# ── история между запусками: второй запуск помнит строку первого ──
# Стрелка вверх поднимает ПОСЛЕДНЮЮ строку прошлого запуска, а последней там
# была команда очистки; ждать «Втрое» от 5 значило бы ждать четвёртой сверху.
out = run({'FLANG_HISTORY': history}, [(UP, 0.6)])
open(os.path.join(rab, 'pty-history.out'), 'wb').write(out)
if '.очистить' not in strip(out):
    print('pty: второй запуск не вспомнил строку первого — история между запусками потеряна'); beda = 1
elif beda == 0:
    print('  зелен  pty: вставка, Tab («имя, ключевое слово, .команда), справка о сборке, история между запусками')

# ── цвет выключается по NO_COLOR ──
plain = run({'NO_COLOR': '', 'FLANG_HISTORY': 'нет'}, [('1 плюс 1'.encode(), 0.3), (b'\r', answer_wait)])
open(os.path.join(rab, 'pty-nocolor.out'), 'wb').write(plain)
if re.search(rb'\x1b\[[0-9;]*m', plain):
    print('pty: NO_COLOR= стоит, а цвет (SGR) есть'); beda = 1
if answers(plain) != ['2']:
    print('pty: без цвета ответ', answers(plain), 'ждали [2]'); beda = 1
if 'выключен: стоит NO_COLOR' not in strip(run({'NO_COLOR': '', 'FLANG_HISTORY': 'нет'}, [('.помощь'.encode(), 0.3), (b'\r', 1.5)])):
    print('pty: при NO_COLOR справка не назвала причину выключенного цвета'); beda = 1
if beda == 0:
    print('  зелен  pty: NO_COLOR снял цвет и назван причиной в справке; FLANG_HISTORY=нет выключил файл')
sys.exit(beda)
PY
[ $? = 0 ] || BEDA=1

if [ "$BEDA" != 0 ]; then
  echo "ПРОБА ОБОЛОЧКИ КРАСНА (вывод pty — $RAB/pty.out до выхода скрипта)" >&2
  exit 1
fi
echo "проба оболочки зелена"
exit 0
