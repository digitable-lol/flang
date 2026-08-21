#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# Прогон приложения в НАСТОЯЩЕМ браузере — нажатиями, которые делает не человек.
#
# ── Чем это отличается от того, что было ─────────────────────────────────────
# Было `web/app/probe.mjs`: 124 строки на JavaScript, Playwright из npm и Node
# как точка входа. Playwright в зависимости flang не входит и не войдёт, поэтому
# путь к нему брался из окружения — то есть прогон был у того, кто заранее
# поставил себе node_modules.
#
# Стало: оболочка, `google-chrome` и `jq`. Ни Node, ни npm, ни одной строки
# JavaScript. Браузером управляет его собственный протокол (Chrome DevTools
# Protocol) — но не через WebSocket, а через ПАРУ ТРУБ: ключ
# `--remote-debugging-pipe` заставляет Chrome читать команды с дескриптора 3 и
# писать ответы в дескриптор 4, сообщениями JSON, разделёнными нулевым байтом.
# Ни рукопожатия, ни кадров, ни клиента WebSocket писать не пришлось.
#
# ── Почему нажатия настоящие, а не «выполнить JavaScript на странице» ────────
# Драйверы обычно жмут кнопку вызовом `element.click()` — то есть исполняя
# JavaScript внутри вкладки. Здесь этого нет намеренно: координаты кнопки
# берутся у `DOM.getBoxModel`, а нажатие шлётся `Input.dispatchMouseEvent`.
# Браузер получает событие мыши, неотличимое от человеческого, и весь путь —
# от кнопки до `addEventListener` хозяина и до плана на flang — проходится
# по-настоящему. Ни строки JavaScript не вычисляется ни в этом файле, ни во
# вкладке по нашей просьбе.
#
# ── Как звать ────────────────────────────────────────────────────────────────
#   TMPDIR=<куда класть временное> sh web/proba-v-brauzere.sh
#
# Стенд обязан быть уже поднят (`bootstrap/flang io web/stend.flang`), а модули
# напечатаны (`sh web/sobrat.sh`). Куда стучаться — в ADRES, куда класть снимок
# — в SNIMOK.
#
# Коды возврата: 0 — всё сошлось; 1 — что-то не сошлось, названо построчно;
# 2 — прогон не состоялся (нет браузера, нет стенда).
#
# Имена переменных латиницей: dash не принимает кириллицу в именах.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

ADDRESS=${ADRES:-http://127.0.0.1:8908/}
CHROME=${CHROME:-/usr/bin/google-chrome}
SHOT=${SNIMOK:-$ROOT/web/gradiny.png}
BASE=${TMPDIR:?нужен каталог для временного: TMPDIR=<каталог> sh web/proba-v-brauzere.sh}

command -v jq >/dev/null 2>&1 || { echo "нужен jq" >&2; exit 2; }
[ -x "$CHROME" ] || { echo "нет браузера: $CHROME (переопределяется CHROME=)" >&2; exit 2; }

WORK=$(mktemp -d "$BASE/proba-brauzer.XXXXXX")
ANSWERS=$WORK/otvety.txt
: > "$ANSWERS"

CHROME_PID=""
TR_PID=""
cleanup() {
  [ -n "$CHROME_PID" ] && kill "$CHROME_PID" 2>/dev/null || true
  [ -n "$TR_PID" ] && kill "$TR_PID" 2>/dev/null || true
  /bin/sleep 1
  rm -rf "$WORK" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

mkfifo "$WORK/cdp_in" "$WORK/cdp_out"
"$CHROME" --headless=new --disable-gpu --no-sandbox --no-first-run \
  --disable-dev-shm-usage --window-size=1100,760 \
  --user-data-dir="$WORK/profile" --remote-debugging-pipe about:blank \
  3<"$WORK/cdp_in" 4>"$WORK/cdp_out" >"$WORK/chrome.log" 2>&1 &
CHROME_PID=$!
# Сообщения разделены нулевым байтом; переводов строки внутри JSON не бывает,
# поэтому нулевой байт безопасно меняется на перевод строки — и дальше файл
# читается обычным grep.
tr '\0' '\n' < "$WORK/cdp_out" > "$ANSWERS" &
TR_PID=$!
exec 8> "$WORK/cdp_in"

# Счётчик команд ЛЕЖИТ В ФАЙЛЕ, а не в переменной, и это не причуда: `call`
# зовётся внутри подстановки `$(…)`, то есть в порождённой оболочке, и всякое
# присваивание там пропадает при возврате. С переменной номера повторялись,
# `grep` находил ЧУЖОЙ старый ответ с тем же номером, и прогон читал ответ на
# позапрошлую команду как на нынешнюю.
printf '0' > "$WORK/schet"
# Отправить команду и вернуть ЕЁ ответ одной строкой. Ждём по номеру: события
# браузера приходят в ту же трубу и без номера, и путать их с ответом нельзя.
call() {
  now=$(( $(cat "$WORK/schet") + 1 ))
  printf '%s' "$now" > "$WORK/schet"
  printf '%s\0' "$(printf '{"id":%d,%s}' "$now" "$1")" >&8
  waited=0
  while [ "$waited" -lt 600 ]; do
    line=$(grep -m1 "\"id\":$now[,}]" "$ANSWERS" 2>/dev/null || true)
    if [ -n "$line" ]; then
      printf '%s\n' "$line"
      return 0
    fi
    waited=$((waited + 1))
    sleep 0.05
  done
  echo "браузер не ответил на команду $now: $1" >&2
  return 1
}

# То же, но внутри сессии вкладки.
say() { call "\"sessionId\":\"$SESSION\",$1"; }

TARGET=$(call "\"method\":\"Target.createTarget\",\"params\":{\"url\":\"$ADDRESS\"}" | jq -r '.result.targetId')
[ -n "$TARGET" ] || { echo "вкладка не открылась" >&2; exit 2; }
SESSION=$(call "\"method\":\"Target.attachToTarget\",\"params\":{\"targetId\":\"$TARGET\",\"flatten\":true}" | jq -r '.result.sessionId')
[ -n "$SESSION" ] || { echo "к вкладке не присоединиться" >&2; exit 2; }
say '"method":"DOM.enable","params":{}' >/dev/null

# Узел по признаку разметки. Дерево спрашивается заново каждый раз: страница
# живая, и старые номера узлов после перерисовки не значат ничего.
node_of() {
  root=$(say '"method":"DOM.getDocument","params":{"depth":0}' | jq -r '.result.root.nodeId')
  say "\"method\":\"DOM.querySelector\",\"params\":{\"nodeId\":$root,\"selector\":$(printf '%s' "$1" | jq -R .)}" \
    | jq -r '.result.nodeId // 0'
}

# Текст места: разметка узла, из которой вырезано содержимое тега.
text_of() {
  id=$(node_of "$1")
  [ "$id" = "0" ] && { echo ""; return 0; }
  say "\"method\":\"DOM.getOuterHTML\",\"params\":{\"nodeId\":$id}" \
    | jq -r '.result.outerHTML' | sed -e 's/^<[^>]*>//' -e 's|</[a-zA-Z0-9]*>$||'
}

# Нажатие мышью в середину узла. Координаты — у самого браузера.
click() {
  id=$(node_of "$1")
  [ "$id" = "0" ] && { echo "на странице нет узла $1" >&2; return 1; }
  quad=$(say "\"method\":\"DOM.getBoxModel\",\"params\":{\"nodeId\":$id}" | jq -r '.result.model.content | @csv')
  x=$(printf '%s' "$quad" | awk -F, '{ printf "%d", ($1 + $5) / 2 }')
  y=$(printf '%s' "$quad" | awk -F, '{ printf "%d", ($2 + $6) / 2 }')
  say "\"method\":\"Input.dispatchMouseEvent\",\"params\":{\"type\":\"mousePressed\",\"x\":$x,\"y\":$y,\"button\":\"left\",\"clickCount\":1}" >/dev/null
  say "\"method\":\"Input.dispatchMouseEvent\",\"params\":{\"type\":\"mouseReleased\",\"x\":$x,\"y\":$y,\"button\":\"left\",\"clickCount\":1}" >/dev/null
}

# Дождаться, пока место начнёт содержать кусок. Ждём СОСТОЯНИЯ, а не времени:
# план отвечает через хозяина, и «сколько это займёт» не наше дело.
await() {
  waited=0
  while [ "$waited" -lt "${3:-200}" ]; do
    case "$(text_of "$1")" in *"$2"*) return 0 ;; esac
    waited=$((waited + 1))
    sleep 0.1
  done
  echo "не дождались «$2» в месте $1; там сейчас: $(text_of "$1")" >&2
  return 1
}

BAD=0
check() {
  got=$(text_of '[данные-место="экран"]')
  if [ "$got" = "$2" ]; then
    printf '  сошлось  %s\n' "$1"
  else
    BAD=$((BAD + 1))
    printf '  НЕ СОШЛОСЬ  %s\n    ждали: %s\n    вышло: %s\n' "$1" "$2" "$got"
  fi
}

echo "адрес:   $ADDRESS"
echo "браузер: $(call '"method":"Browser.getVersion","params":{}' | jq -r '.result.product')"
echo

# План показывает себя сам, без нажатия: первое поручение всякого витка —
# «Показать». Дождаться этого значит дождаться, что план поехал.
await '[данные-место="экран"]' 'набор:' 300 || exit 1
check 'открылось пустым и с подсказкой' 'набор: 0
число: 0
шагов: 0
вершина: 0
бег: нет
наберите число и нажмите «пуск»'

click '[данные-значение="2"]'
click '[данные-значение="7"]'
await '[данные-место="экран"]' 'набор: 27' || exit 1
check 'две цифры набраны настоящими нажатиями мыши' 'набор: 27
число: 0
шагов: 0
вершина: 0
бег: нет
набрано 27'

click '[данные-значение="пуск"]'
await '[данные-место="экран"]' 'число: 27' || exit 1
check 'пуск взял набранное число' 'набор: 27
число: 27
шагов: 0
вершина: 27
бег: нет
готово к шагам'

click '[данные-значение="шаг"]'
await '[данные-место="экран"]' 'число: 82' || exit 1
check 'шаг двинул на такт' 'набор: 27
число: 82
шагов: 1
вершина: 82
бег: нет
летим'

# Бег: план будят ЧАСЫ, а не человек, и это ровно то место, ради которого у
# поручения «Ждать событие» есть срок. 27 приходит к единице за 111 шагов,
# вершина 9232 — числа известны заранее, поэтому сверять есть с чем.
click '[данные-значение="бег"]'
await '[данные-место="экран"]' 'пришли к единице' 900 || exit 1
check 'бег дошёл до единицы сам, часами' 'набор: 27
число: 1
шагов: 111
вершина: 9232
бег: нет
пришли к единице'

# Вкладка обязана быть ЖИВОЙ всё это время: план ждал на обещании, стек был
# пуст. Нажатие после ста одиннадцати витков — проверка того, что она жива.
click '[данные-значение="сброс"]'
await '[данные-место="экран"]' 'наберите число' || exit 1
check 'вкладка жива после 111 витков: сброс сработал' 'набор: 0
число: 0
шагов: 0
вершина: 0
бег: нет
наберите число и нажмите «пуск»'

REFUSAL=$(text_of '[данные-место="итог"]')
if [ -n "$REFUSAL" ]; then
  BAD=$((BAD + 1))
  printf '  НЕ СОШЛОСЬ  план отказался: %s\n' "$REFUSAL"
fi

say '"method":"Page.captureScreenshot","params":{"format":"png"}' | jq -r '.result.data' | base64 -d > "$SHOT"
echo
echo "снимок: $SHOT ($(wc -c < "$SHOT") байт)"
echo "не сошлось: $BAD"
[ "$BAD" -eq 0 ] || exit 1
