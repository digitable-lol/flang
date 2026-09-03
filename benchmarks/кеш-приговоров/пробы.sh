#!/bin/sh
# Пробы кеша приговоров. Имена переменных латиницей: ни dash, ни bash кириллицу
# в именах переменных не берут (проверено обоими).
#
#   sh benchmarks/кеш-приговоров/пробы.sh <двоичный> [<второй двоичный с иным правилом ядра>]
#
# Приговоры видны ПЕЧАТЬЮ, а не ведомостью: `--proof` идёт другой дорогой
# («Ведомость исходников»), кеша на ней нет, и сверять по ней нечего. А печать
# зависит от вердикта прямо — доказанное постусловие в напечатанный код не едет,
# и ложное «доказано» сняло бы сторожа, которого никто не поставит обратно.
set -u
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(CDPATH= cd -- "$HERE/../.." && pwd)
FLANG=$1
FLANG2=${2:-}
LC_ALL=C.UTF-8
export LC_ALL
RAB=${FLANG_KESH_RABOTA:-$(mktemp -d)}
mkdir -p "$RAB"
echo "рабочий каталог: $RAB"

KORPUS="flang/core/json.flang flang/self/lexer.flang flang/stdlib/base64.flang flang/self/zapis.flang flang/self/monoid.flang"

echo "══════════ 1. приговоры с кешем и без: печать побайтово ══════════"
SVERENO=0
RAZOSHLOS=0
for F in $KORPUS; do
  [ -f "$ROOT/$F" ] || continue
  SVERENO=$((SVERENO + 1))
  rm -rf "$RAB/бк" "$RAB/хк" "$RAB/гк" "$RAB/кеш-корпус.json"
  timeout 900 "$FLANG" emit "$ROOT/$F" --target c --runtime "$ROOT/flang/src/emit/c" --out "$RAB/бк" >/dev/null 2>&1
  FLANG_KESH_PRIGOVOROV=$RAB/кеш-корпус.json timeout 900 "$FLANG" emit "$ROOT/$F" --target c --runtime "$ROOT/flang/src/emit/c" --out "$RAB/хк" >/dev/null 2>&1
  FLANG_KESH_PRIGOVOROV=$RAB/кеш-корпус.json timeout 900 "$FLANG" emit "$ROOT/$F" --target c --runtime "$ROOT/flang/src/emit/c" --out "$RAB/гк" >/dev/null 2>&1
  if diff -r -q "$RAB/бк" "$RAB/хк" >/dev/null 2>&1 && diff -r -q "$RAB/бк" "$RAB/гк" >/dev/null 2>&1; then
    echo "  совпало побайтово: $F (кеш $(wc -c < "$RAB/кеш-корпус.json") байт)"
  else
    echo "  РАЗОШЛОСЬ: $F"
    RAZOSHLOS=$((RAZOSHLOS + 1))
  fi
done
echo "  сверено программ $SVERENO, расхождений $RAZOSHLOS"

echo
echo "══════════ 2. подделка: тело ВЫЗВАННОЙ функции, своя не тронута ══════════"
echo "  «Через ответ» побайтово та же и на той же строке; правлена только «Ответ»:"
# Испорченная порождается ЗДЕСЬ, а не лежит рядом: два файла с одним именем
# модуля в дереве завели бы спор имён на ровном месте. Правится ровно одна
# строка — тело «Ответа».
sed '5s/^  7$/  8/' "$HERE/проба.flang" > "$RAB/проба-испорченная.flang"
diff "$HERE/проба.flang" "$RAB/проба-испорченная.flang" | sed 's/^/    /'
rm -f "$RAB/кеш-1.json"
cp "$HERE/проба.flang" "$RAB/рабочая.flang"
FLANG_KESH_PRIGOVOROV=$RAB/кеш-1.json timeout 600 "$FLANG" check "$RAB/рабочая.flang" >/dev/null 2>&1
DO=$(wc -c < "$RAB/кеш-1.json")
DOKAZANO=$(/usr/bin/grep -a -c '"verdict":"доказано"' "$RAB/кеш-1.json")
echo "  исправная: кеш $DO байт, приговоров «доказано» $DOKAZANO"

cp "$RAB/проба-испорченная.flang" "$RAB/рабочая.flang"
FLANG_KESH_PRIGOVOROV=$RAB/кеш-1.json timeout 600 "$FLANG" check "$RAB/рабочая.flang" >/dev/null 2>&1
POSLE=$(wc -c < "$RAB/кеш-1.json")
OTKAZOV=$(/usr/bin/grep -a -c '"v":null' "$RAB/кеш-1.json")
echo "  испорченная на ГОРЯЧЕМ кеше от исправной: кеш $DO → $POSLE байт, отказов «v»:null $OTKAZOV"
if [ "$POSLE" -gt "$DO" ] && [ "$OTKAZOV" -ge 1 ]; then
  echo "  КЕШ ПРОМАХНУЛСЯ: ядро переспрошено и ответило ОТКАЗОМ — ложного доказательства нет"
else
  echo "  КЕШ ПОПАЛ — ЭТО ЛОЖНОЕ ДОКАЗАТЕЛЬСТВО, РАБОТА НЕГОДНА"
fi

echo
echo "══════════ 2б. возврат исправной: кеш обязан ПОПАСТЬ ══════════"
cp "$HERE/проба.flang" "$RAB/рабочая.flang"
DO=$(wc -c < "$RAB/кеш-1.json")
FLANG_KESH_PRIGOVOROV=$RAB/кеш-1.json timeout 600 "$FLANG" check "$RAB/рабочая.flang" >/dev/null 2>&1
POSLE=$(wc -c < "$RAB/кеш-1.json")
if [ "$POSLE" -eq "$DO" ]; then
  echo "  кеш $DO → $POSLE байт: без роста, значит ПОПАЛ"
else
  echo "  кеш $DO → $POSLE байт: вырос, значит промахнулся на неизменном входе"
fi

if [ -n "$FLANG2" ]; then
  echo
  echo "══════════ 3. подделка: ядро пересобрано с изменённым правилом ══════════"
  echo "  «Предел ветвления» 4 → 0 в напечатанном семени; дерево побайтово то же."
  B=$ROOT/flang/stdlib/base64.flang
  rm -f "$RAB/кеш-ядро.json" "$RAB/кеш-пусто.json"
  rm -rf "$RAB/я1" "$RAB/я2а" "$RAB/я2б"
  FLANG_KESH_PRIGOVOROV=$RAB/кеш-ядро.json timeout 900 "$FLANG" emit "$B" --target c --runtime "$ROOT/flang/src/emit/c" --out "$RAB/я1" >/dev/null 2>&1
  DO=$(wc -c < "$RAB/кеш-ядро.json")
  FLANG_KESH_PRIGOVOROV=$RAB/кеш-ядро.json timeout 900 "$FLANG2" emit "$B" --target c --runtime "$ROOT/flang/src/emit/c" --out "$RAB/я2а" >/dev/null 2>&1
  POSLE=$(wc -c < "$RAB/кеш-ядро.json")
  FLANG_KESH_PRIGOVOROV=$RAB/кеш-пусто.json timeout 900 "$FLANG2" emit "$B" --target c --runtime "$ROOT/flang/src/emit/c" --out "$RAB/я2б" >/dev/null 2>&1
  echo "  кеш первого ядра $DO байт → после второго $POSLE байт"
  if diff -r -q "$RAB/я1" "$RAB/я2б" >/dev/null 2>&1; then
    echo "  ВНИМАНИЕ: правило вердиктов base64 не меняет — проба ничего не проверяет"
  else
    echo "  правило вердикты МЕНЯЕТ: печать первого и второго ядра разошлась"
  fi
  if diff -r -q "$RAB/я2а" "$RAB/я2б" >/dev/null 2>&1; then
    echo "  ВТОРОЕ ЯДРО НА ЧУЖОМ КЕШЕ НАПЕЧАТАЛО РОВНО ТО ЖЕ, ЧТО НА ПУСТОМ — отпечаток проверяльщика работает"
  else
    echo "  ВТОРОЕ ЯДРО НА ЧУЖОМ КЕШЕ НАПЕЧАТАЛО ИНОЕ — ЛОЖНЫЕ ДОКАЗАТЕЛЬСТВА, РАБОТА НЕГОДНА"
  fi
fi
