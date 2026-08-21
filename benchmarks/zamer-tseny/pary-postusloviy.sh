#!/bin/sh
# Парный замер ЧЕРЕДОВАНИЕМ: A B A B … — единственный способ получить число,
# которое не врёт на общей машине.
#
# Зачем именно чередование. Абсолютное время `flang test` на этой машине плывёт
# на 15 % от чужой нагрузки: json со всеми утверждениями шёл 9855 мс при
# четырнадцати чужих прогонах и 11263 мс при шестидесяти шести. Разница ВНУТРИ
# пары при этом держится: 2742 мс и 3165 мс. Значит сравнивать можно только
# соседние прогоны, и только парами.
#
# Нагрузка печатается ДО и ПОСЛЕ — без неё разброс необъясним.
#
#   benchmarks/zamer-tseny/pary-postusloviy.sh A.flang B.flang 3 test
#   benchmarks/zamer-tseny/pary-postusloviy.sh A.flang B.flang 3 test --no-check
#   benchmarks/zamer-tseny/pary-postusloviy.sh A.flang B.flang 3 check
#
# Как получить B (тот же модуль без доказанных постусловий): имена доказанных
# берутся из отчёта о доказательствах —
#
#   ./bootstrap/flang check модуль.flang --proof --json
#
# в поле `claims` у доказанных стоит `"verdict": "proved"` или
# `"proved-induction"`; из исходника вырезаются строки `обеспечивает «имя»` с
# этими именами. B обязан пройти `flang check` кодом 0 — иначе меряется не то.
set -u
if [ $# -lt 3 ]; then
  echo "надо: $0 <A.flang> <B.flang> <сколько пар> [команда flang…]" >&2
  exit 2
fi
A=$1; B=$2; N=$3; shift 3
[ $# -gt 0 ] || set -- test

KOREN=$(cd "$(dirname "$0")/../.." && pwd)
FLANG=$KOREN/bootstrap/flang
SCHET=$KOREN/scripts/predel-pamyati.sh
[ -x "$FLANG" ] || { echo "нет двоичного $FLANG — собери: make -C bootstrap -j4" >&2; exit 2; }

kontekst() {
  if [ -x "$SCHET" ]; then "$SCHET" --schet 2>/dev/null | sed -n '1,2p'
  else free -g | sed -n '2p'; fi
}

echo "команда: flang $* <файл>"
echo "== нагрузка ДО =="; kontekst
i=1
while [ "$i" -le "$N" ]; do
  for v in A B; do
    case $v in A) f=$A;; B) f=$B;; esac
    t0=$(date +%s%N)
    LC_ALL=C.UTF-8 "$FLANG" "$@" "$f" >/dev/null 2>&1
    rc=$?
    t1=$(date +%s%N)
    echo "пара $i  $v  $(( (t1 - t0) / 1000000 )) мс  код $rc"
  done
  i=$((i + 1))
done
echo "== нагрузка ПОСЛЕ =="; kontekst
