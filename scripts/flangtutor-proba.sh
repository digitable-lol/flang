#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# ПРОБА ПРОВОДНИКА: КАЖДЫЙ УРОК ПРОХОДИТСЯ, ЧУЖОЙ ОТВЕТ НЕ ПРОХОДИТ.
#
#   sh scripts/flangtutor-proba.sh              судить bootstrap/flang
#   sh scripts/flangtutor-proba.sh <двоичный>   судить названный
#
# Коды: 0 — сошлось всё; 1 — расхождение, названо словами;
#       2 — судить нечем (нет двоичного).
#
# ── Что судится и почему именно это ─────────────────────────────────────────
# Урок, который никто не прошёл целиком, — это текст, а не урок. Поэтому здесь
# не проверяется «файл на месте» и не сличаются строки, а гоняется сам
# проводник:
#
#   ЦЕЛИКОМ.   Все уроки подряд верными ответами, взятыми из самих уроков
#              (раздел «ответ»), — проводник обязан дойти до конца и ответить
#              нулём. Ответ и подсказка в уроке одни и те же, разойтись им
#              негде.
#   ПООДИНОЧКЕ. Каждый урок отдельным запуском: иначе беда в третьем уроке
#              пряталась бы за тем, что до него не дошли.
#   ПОДЛОГ.    Каждому уроку подаётся ответ СОСЕДНЕГО. Проводник обязан
#              отказать: без этого «зелено» означало бы лишь, что он всё
#              принимает. Это и есть замер того, что судит компилятор.
#   МЕСТО.     Работа обрывается на середине, и следующий запуск обязан
#              продолжить со следующего урока, а не с первого.
#   ЯЗЫК.      Решение ADR-0024: язык вывода берётся из настроек. Проверяется
#              обеими сторонами — `--язык en` даёт английские имена уроков,
#              а код, уроков на котором нет, честно говорит об этом и уходит
#              в английский.
#   ЦВЕТ.      NO_COLOR действует самим наличием: под терминалом без него в
#              выводе есть SGR, с ним — ни одной последовательности.
set -u

KOREN=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
BIN=${1:-$KOREN/bootstrap/flang}
[ -x "$BIN" ] || { echo "нет двоичного: $BIN — судить нечем (код 2)" >&2; exit 2; }

RAB=${FLANG_TMP:-/srv/tmp}/flangtutor-proba.$$
mkdir -p "$RAB" || exit 2
trap 'rm -rf "$RAB"' EXIT INT TERM
BEDA=0

UROKI=$KOREN/docs/tutor
SPISOK=$(/bin/ls "$UROKI" | grep '\.урок$' | sort)
VSEGO=$(printf '%s\n' "$SPISOK" | wc -l | tr -d ' ')
[ "$VSEGO" -ge 1 ] || { echo "уроков нет — судить нечем (код 2)" >&2; exit 2; }

otvet() { # номер урока → верный ответ и точка
  f=$UROKI/$(printf '%s\n' "$SPISOK" | sed -n "$1p")
  awk '$0=="=ответ=" {v=1;next} /^=[^=]*=$/ {v=0} v {print}' "$f"
  echo "."
}
vesti() { # файл входа, файл вывода, доводы… → код проводника
  vhod=$1; vyvod=$2; shift 2
  NO_COLOR= FLANG_TMP=${FLANG_TMP:-/srv/tmp} FLANG_TUTOR_STATE=нет \
    FLANG=$BIN sh "$KOREN/flangtutor" "$@" < "$vhod" > "$vyvod" 2>&1
}

# ── целиком ─────────────────────────────────────────────────────────────────
n=1
: > "$RAB/vse"
while [ "$n" -le "$VSEGO" ]; do otvet "$n" >> "$RAB/vse"; n=$((n + 1)); done
vesti "$RAB/vse" "$RAB/vse.out" --сначала
KOD=$?
if [ "$KOD" != 0 ]; then
  echo "целиком: код $KOD, ждали 0 — проводник не дошёл до конца"; tail -12 "$RAB/vse.out"; BEDA=1
elif ! grep -q "все $VSEGO уроков пройдены" "$RAB/vse.out"; then
  echo "целиком: код 0, а слов «все $VSEGO уроков пройдены» в выводе нет"; BEDA=1
else
  echo "  зелен  целиком: $VSEGO уроков подряд верными ответами, код 0"
fi

# ── поодиночке и подлогом ───────────────────────────────────────────────────
n=1
while [ "$n" -le "$VSEGO" ]; do
  otvet "$n" > "$RAB/odin.$n"
  vesti "$RAB/odin.$n" "$RAB/odin.$n.out" --только "$n"
  KOD=$?
  if [ "$KOD" != 0 ]; then
    echo "урок $n: свой верный ответ дал код $KOD, ждали 0"; tail -8 "$RAB/odin.$n.out"; BEDA=1
  elif ! grep -q "урок $n пройден" "$RAB/odin.$n.out"; then
    echo "урок $n: код 0, а «урок $n пройден» не напечатано"; BEDA=1
  fi

  sosed=$((n % VSEGO + 1))
  otvet "$sosed" > "$RAB/chuzhoy.$n"
  vesti "$RAB/chuzhoy.$n" "$RAB/chuzhoy.$n.out" --только "$n"
  KOD=$?
  if [ "$KOD" = 0 ] || grep -q "урок $n пройден" "$RAB/chuzhoy.$n.out"; then
    echo "урок $n: ПРИНЯЛ ответ урока $sosed — судит не компилятор, а вежливость"; BEDA=1
  fi
  n=$((n + 1))
done
[ "$BEDA" = 0 ] && echo "  зелен  поодиночке: каждый из $VSEGO уроков проходится своим ответом и отвергает чужой"

# ── место: оборвать и продолжить ────────────────────────────────────────────
MESTO=$RAB/mesto
otvet 1 > "$RAB/pervyy"
NO_COLOR= FLANG_TUTOR_STATE=$MESTO FLANG=$BIN sh "$KOREN/flangtutor" --сначала \
  < "$RAB/pervyy" > "$RAB/mesto.out1" 2>&1
if [ ! -f "$MESTO" ] || [ "$(cat "$MESTO")" != 1 ]; then
  echo "место: после первого урока в $MESTO не записана единица"; BEDA=1
else
  : > "$RAB/ostalnye"
  n=2
  while [ "$n" -le "$VSEGO" ]; do otvet "$n" >> "$RAB/ostalnye"; n=$((n + 1)); done
  NO_COLOR= FLANG_TUTOR_STATE=$MESTO FLANG=$BIN sh "$KOREN/flangtutor" \
    < "$RAB/ostalnye" > "$RAB/mesto.out2" 2>&1
  KOD=$?
  if [ "$KOD" != 0 ] || ! grep -q "урок 2 из $VSEGO" "$RAB/mesto.out2"; then
    echo "место: продолжение пошло не со второго урока (код $KOD)"; tail -8 "$RAB/mesto.out2"; BEDA=1
  elif grep -q "урок 1 из $VSEGO" "$RAB/mesto.out2"; then
    echo "место: продолжение начало с первого урока заново"; BEDA=1
  else
    echo "  зелен  место: оборванная работа продолжается со следующего урока"
  fi
fi

# ── язык ────────────────────────────────────────────────────────────────────
NO_COLOR= FLANG=$BIN sh "$KOREN/flangtutor" --список --язык en > "$RAB/en" 2>&1
NO_COLOR= FLANG=$BIN sh "$KOREN/flangtutor" --список --язык ru > "$RAB/ru" 2>&1
if ! grep -q '^lesson 1 · ' "$RAB/en"; then
  echo "язык: «--язык en» не дал английских имён уроков"; BEDA=1
elif ! grep -q '^урок 1 · ' "$RAB/ru"; then
  echo "язык: «--язык ru» не дал русских имён уроков"; BEDA=1
else
  otvet 1 > "$RAB/pervyy"
  NO_COLOR= FLANG_TUTOR_STATE=нет FLANG=$BIN sh "$KOREN/flangtutor" --только 1 --язык eo \
    < "$RAB/pervyy" > "$RAB/eo" 2>&1
  if ! grep -q 'no lessons in' "$RAB/eo"; then
    echo "язык: на код «eo» уроков нет, а проводник об этом не сказал"; BEDA=1
  else
    echo "  зелен  язык: ru и en ведут на своём, а код без уроков назван вслух"
  fi
fi

# ── цвет ────────────────────────────────────────────────────────────────────
if LC_ALL=C grep -q "$(printf '\033')" "$RAB/vse.out"; then
  echo "цвет: NO_COLOR стоял, а в выводе есть ESC"; BEDA=1
elif command -v python3 >/dev/null 2>&1 && python3 -c 'import pty' 2>/dev/null; then
  otvet 1 > "$RAB/pervyy"
  python3 - "$KOREN" "$BIN" "$RAB" <<'PY'
import os, pty, select, sys, time
koren, binary, rab = sys.argv[1], sys.argv[2], sys.argv[3]

def pod_terminalom(no_color):
    env = dict(os.environ, LC_ALL='C.UTF-8', TERM='xterm-256color',
               FLANG=binary, FLANG_TUTOR_STATE='нет')
    env.pop('NO_COLOR', None)
    if no_color:
        env['NO_COLOR'] = ''
    otvet = open(os.path.join(rab, 'pervyy'), 'rb').read()
    pid, fd = pty.fork()
    if pid == 0:
        os.execve('/bin/sh', ['/bin/sh', os.path.join(koren, 'flangtutor'), '--только', '1'], env)
    out = b''
    def slushat(sec):
        nonlocal out
        end = time.time() + sec
        while time.time() < end:
            r, _, _ = select.select([fd], [], [], 0.05)
            if r:
                try:
                    d = os.read(fd, 65536)
                except OSError:
                    return
                if not d:
                    return
                out += d
    slushat(1.5)
    os.write(fd, otvet)
    slushat(20.0)
    try:
        os.kill(pid, 9); os.waitpid(pid, 0)
    except (ProcessLookupError, ChildProcessError):
        pass
    os.close(fd)
    return out

beda = 0
cvet = pod_terminalom(False)
golo = pod_terminalom(True)
if b'\x1b[1m' not in cvet:
    print('цвет: под терминалом без NO_COLOR нет ни одной последовательности SGR'); beda = 1
if b'\x1b[' in golo:
    print('цвет: под терминалом с NO_COLOR последовательности остались'); beda = 1
if beda == 0:
    print('  зелен  цвет: под терминалом красит, NO_COLOR снимает цвет')
sys.exit(beda)
PY
  [ $? = 0 ] || BEDA=1
else
  echo "  ЦВЕТ НЕ СУДИЛСЯ: нет python3 с модулем pty — под трубой цвета нет и так"
fi

if [ "$BEDA" != 0 ]; then
  echo "ПРОБА ПРОВОДНИКА КРАСНА" >&2
  exit 1
fi
echo "проба проводника зелена"
exit 0
