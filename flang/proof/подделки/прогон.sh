#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# ЧЕТЫРЕ ПОДДЕЛКИ И ЧЕСТНАЯ ПОЛОВИНА — настоящим прогоном, а не описанием.
#
#   sh flang/proof/подделки/прогон.sh
#   код 0 — честное доказательство принято, все четыре подделки отвергнуты;
#   код 1 — что-то из этого неверно, и оно названо строкой.
#
# ЧЕСТНАЯ ПОЛОВИНА ОБЯЗАТЕЛЬНА. Сверщик, отвергающий всё подряд, выглядел бы
# исправным на одних подделках; сверщик, принимающий всё подряд, хуже
# отсутствующего. Обе половины считаются здесь, и одна без другой ничего не
# значит.
#
# Имена переменных латиницей: ни dash, ни bash не принимают кириллицу в именах.
set -eu

KOREN=$(CDPATH= cd -- "$(dirname -- "$0")/../../.." && pwd)
FLANG=${FLANG:-$KOREN/bootstrap/flang}
SVERIT=$KOREN/flang/proof/сверить.sh
CHESTNYY=$KOREN/flang/proof/examples/body-forms.flang
CHUZHOY=$KOREN/flang/proof/examples/corpus-factorial.flang
KRUG=$KOREN/flang/proof/подделки/круг.flang
KRUG_ZAPIS=$KOREN/flang/proof/подделки/круг.запись

[ -x "$FLANG" ] || { echo "двоичного нет: $FLANG" >&2; exit 2; }

RABOTA=$(mktemp -d -p "${FLANG_TMP:-/srv/tmp}" poddelki.XXXXXX)
trap 'rm -rf "$RABOTA"' EXIT INT TERM

BAD=0
say() { printf '%s\n' "$*"; }

# Один опыт: имя, исходник, запись, ожидаемый код возврата сверщика.
sverit() {
  imya=$1; ish=$2; zap=$3; zhdyom=$4
  vyvod=$(sh "$SVERIT" "$ish" "$zap" 2>&1) && kod=0 || kod=$?
  if [ "$kod" -eq "$zhdyom" ]; then
    say "СОШЛОСЬ  $imya — код $kod, как и ждали"
  else
    say "ПРОВАЛ   $imya — ждали код $zhdyom, получили $kod"
    BAD=$((BAD + 1))
  fi
  say "         $(printf '%s' "$vyvod" | head -1 | cut -c1-220)"
}

say "исходник честной половины: $CHESTNYY"
"$FLANG" check "$CHESTNYY" --proof --записать "$RABOTA/честная" > /dev/null
say "записано доказательство: $(wc -l < "$RABOTA/честная") строк"
say ""

# ── честная половина ────────────────────────────────────────────────────────
sverit "честная: настоящее доказательство настоящей программы" "$CHESTNYY" "$RABOTA/честная" 0

# ── подделка 1: подменённый шаг ─────────────────────────────────────────────
# Один шаг записи получает ЧУЖОЕ обоснование. В исходнике на той строке
# написано другое, и сверщик обязан это увидеть.
sed '0,/^\( *\)шаг \(.*\) по предположению$/s//\1шаг \2 по свойству «высота неотрицательна»/' \
  "$RABOTA/честная" > "$RABOTA/подменённый"
if cmp -s "$RABOTA/честная" "$RABOTA/подменённый"; then
  say "подделка 1 не собралась: шага «по предположению» в записи нет"
  exit 2
fi
sverit "подделка 1: подменённый шаг" "$CHESTNYY" "$RABOTA/подменённый" 1

# ── подделка 2: доказательство не от той программы ──────────────────────────
sverit "подделка 2: верная запись подложена к другому исходнику" "$CHUZHOY" "$RABOTA/честная" 1

# ── подделка 3: обрублено, не дойдя до цели ─────────────────────────────────
# Из записи выброшен последний шаг: цель в этом случае не закрыта ничем.
grep -n '^ *шаг ' "$RABOTA/честная" | tail -1 | cut -d: -f1 > "$RABOTA/номер"
sed "$(cat "$RABOTA/номер")d" "$RABOTA/честная" > "$RABOTA/обрубленная"
sverit "подделка 3: обрубленное доказательство" "$CHESTNYY" "$RABOTA/обрубленная" 1

# ── подделка 4: круг ────────────────────────────────────────────────────────
sverit "подделка 4: шаг обосновывает сам себя" "$KRUG" "$KRUG_ZAPIS" 1


# ── честная половина ЦЕЛИКОМ: весь каталог примеров ─────────────────────────
# Одной честной программы мало: сверщик, принимающий ровно её, выглядел бы
# исправным. Здесь его спрашивают о КАЖДОЙ программе каталога, и число сошедшихся
# называется. Отвергнутая честная запись — такая же беда, как принятая подделка.
say ""
say "── весь каталог flang/proof/examples ──"
VSEGO=0; ZAPISEY=0; PRINYATO=0
# Четыре равноправных расширения программы: `.flang`, `.fp`, `.фп`, `.фланг` (ADR-0016).
# Несовпавший образец оболочка оставляет собой — потому проверка на файл.
for f in "$KOREN"/flang/proof/examples/*.flang "$KOREN"/flang/proof/examples/*.fp "$KOREN"/flang/proof/examples/*.фп "$KOREN"/flang/proof/examples/*.фланг; do
  [ -e "$f" ] || continue
  VSEGO=$((VSEGO + 1))
  if "$FLANG" check "$f" --proof --записать "$RABOTA/подряд" > /dev/null 2>&1; then
    ZAPISEY=$((ZAPISEY + 1))
    if vyvod=$(sh "$SVERIT" "$f" "$RABOTA/подряд" 2>&1); then
      PRINYATO=$((PRINYATO + 1))
    else
      say "ОТВЕРГНУТА честная запись $(basename "$f"): $(printf '%s' "$vyvod" | head -1 | cut -c1-200)"
      BAD=$((BAD + 1))
    fi
  else
    say "записи нет у $(basename "$f") — check не прошёл"
  fi
done
say "программ $VSEGO, записей $ZAPISEY, принято сверщиком $PRINYATO"

say ""
if [ "$BAD" -eq 0 ]; then
  say "сошлось всё: честное принято ($PRINYATO записей из $ZAPISEY), четыре подделки отвергнуты"
  exit 0
fi
say "опытов не сошлось: $BAD"
exit 1
