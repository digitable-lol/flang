#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# СЛИЧИТЕЛЬ ПЕРЕВОДА: честные пары сходятся, подделки не принимаются.
# ADR-0030 «Печатник доказывает КАЖДЫЙ СВОЙ ЗАПУСК», задача 1401.
#
#   sh flang/translation/run.sh
#
# Код 0 — всё, как ждали; 1 — хоть один опыт разошёлся с ожиданием.
#
# Честные пары лежат в fixtures/: напечатанный C и протокол перевода примеров
# flang/proof/examples/, снятые печатником flang/self/emit-c.flang. Подделки
# строятся здесь же из честных пар — каждая одной правкой, названной словами.
set -u
KOREN=$(cd "$(dirname "$0")/../.." && pwd)
TUT=$KOREN/flang/translation
RAB=$(mktemp -d "${TMPDIR:-/tmp}/translation.XXXXXX")
trap 'rm -rf "$RAB"' EXIT INT TERM

cc -std=c99 -Wall -Wextra -Werror -pedantic -O2 -o "$RAB/matcher" "$TUT/matcher.c" || exit 1

awk -F'\t' '!/^#/ && $1 != "имя" && NF { print $1 }' "$TUT/PRINT-RULES.tsv" > "$RAB/rules.tsv"
sed -n '/^static const char \*const RULES\[\] = {$/,/^};$/p' "$TUT/matcher.c" |
  sed -n 's/^    "\(.*\)",$/\1/p' > "$RAB/rules.c"
if ! cmp -s "$RAB/rules.tsv" "$RAB/rules.c"; then
  echo "КРАСЕН  закрытый список: PRINT-RULES.tsv и RULES[] в matcher.c разошлись"
  diff "$RAB/rules.tsv" "$RAB/rules.c"
  exit 1
fi
echo "зелен   закрытый список: $(wc -l < "$RAB/rules.tsv") правил, в PRINT-RULES.tsv и в matcher.c одни и те же"

BEDA=0
VSEGO=0
# opyt <что> <ждём: 0|1|3> <исходник> <C> <протокол> [слово, которое обязано быть в ответе]
opyt() {
  chto=$1; zhdem=$2; ish=$3; si=$4; prot=$5; slovo=${6:-}
  VSEGO=$((VSEGO + 1))
  "$RAB/matcher" "$ish" "$si" "$prot" > "$RAB/otvet" 2>&1
  kod=$?
  if [ "$kod" = "$zhdem" ] && { [ -z "$slovo" ] || grep -qF -- "$slovo" "$RAB/otvet"; }; then
    printf 'зелен   %s (код %s)\n' "$chto" "$kod"
  else
    printf 'КРАСЕН  %s: ждали код %s%s, получили %s\n' "$chto" "$zhdem" "${slovo:+ со словом «$slovo»}" "$kod"
    sed 's/^/        /' "$RAB/otvet" | head -n 5
    BEDA=$((BEDA + 1))
  fi
}

# ── правки для подделок ─────────────────────────────────────────────────────
# vyrezat <файл> <с> <по> <начало строки «с»>: файл без строк с…по; если строка
# «с» начинается не так, подделка не построена — это отказ прогона, а не опыт.
vyrezat() {
  if ! sed -n "$2p" "$1" | grep -qF -- "$4"; then
    echo "КРАСЕН  подделка не построена: в $(basename "$1") строка $2 не «$4»" >&2
    exit 1
  fi
  sed "$2,$3d" "$1"
}
# zamenit <файл> <было> <стало>: заменить единственное вхождение строки; было
# оно не одно — подделка не построена.
zamenit() {
  n=$(grep -cF -- "$2" "$1")
  if [ "$n" != 1 ]; then
    echo "КРАСЕН  подделка не построена: «$2» в $(basename "$1") встречается $n раз" >&2
    exit 1
  fi
  awk -v old="$2" -v new="$3" '{ i = index($0, old); if (i) $0 = substr($0, 1, i - 1) new substr($0, i + length(old)); print }' "$1"
}

PRIMERY=$KOREN/flang/proof/examples
OSN=$TUT/fixtures/forgery-if-without-descent
ISH=$PRIMERY/forgery-if-without-descent.flang
SI=$OSN/poddelka_usloviya_bez_spuska.c
PR=$OSN/poddelka_usloviya_bez_spuska.protocol
SV=$TUT/fixtures/traffic-light

opyt "честная пара: четыре функции, все правила переиграны" 0 "$ISH" "$SI" "$PR" "СОШЛОСЬ"
opyt "честная пара с разбором: сошлось, непереигранное названо" 3 "$PRIMERY/traffic-light.flang" \
  "$SV/svetofor.c" "$SV/svetofor.protocol" "правило «случай» не переиграно"

VYZOV='poddelka_usloviya_bez_spuska_stoit_na_meste(ctx, n, &fl_t3'
DRUGOY='poddelka_usloviya_bez_spuska_cherez_odno(ctx, n, &fl_t3'

zamenit "$PR" "$VYZOV" "$DRUGOY" > "$RAB/1.protocol"
opyt "подменённый фрагмент протокола: вызов другой функции" 1 "$ISH" "$SI" "$RAB/1.protocol" "напечатанный C, строка 22"

zamenit "$SI" 'fl_t2 = fl_t3;' 'fl_t2 = fl_t1;' > "$RAB/2.c"
opyt "изменённая строка C при прежнем протоколе" 1 "$ISH" "$RAB/2.c" "$PR" "напечатанный C, строка"

vyrezat "$PR" 49 51 'узел var строка 35 столбец 31' > "$RAB/3.protocol"
opyt "пропущенный узел: довод вызова выпал из протокола" 1 "$ISH" "$SI" "$RAB/3.protocol" "исходник строка 35 столбец 11"

opyt "протокол от другого исходника" 1 "$PRIMERY/traffic-light.flang" "$SI" "$PR" "протокол от другого исходника"

zamenit "$PR" "$VYZOV" "$DRUGOY" > "$RAB/6.protocol"
zamenit "$SI" "$VYZOV" "$DRUGOY" > "$RAB/6.c"
opyt "подменённая функция в напечатанном коде (C и протокол заодно)" 1 "$ISH" "$RAB/6.c" "$RAB/6.protocol" \
  "по правилу ждали"

vyrezat "$PR" 45 59 'часть иначе строк 1' > "$RAB/7.protocol"
vyrezat "$SI" 20 23 '} else {' > "$RAB/7.c"
opyt "потерянная ветвь «иначе» (C и протокол заодно)" 1 "$ISH" "$RAB/7.c" "$RAB/7.protocol" "не три ветви"

PARA='kruzhit_po_pare(ctx, m, n, &fl_t8'
NAOBOROT='kruzhit_po_pare(ctx, n, m, &fl_t8'
zamenit "$PR" "$PARA" "$NAOBOROT" > "$RAB/8.protocol"
zamenit "$SI" "$PARA" "$NAOBOROT" > "$RAB/8.c"
opyt "переставленные доводы (C и протокол заодно)" 1 "$ISH" "$RAB/8.c" "$RAB/8.protocol" "исходник строка 46 столбец 11"

zamenit "$PR" 'столбец 11 правило «вызов» имя «Стоит на месте»' 'столбец 11 правило «вызов-наугад» имя «Стоит на месте»' > "$RAB/9.protocol"
opyt "правило не из закрытого списка" 1 "$ISH" "$SI" "$RAB/9.protocol" "не из закрытого списка"

zamenit "$PR" 'столбец 11 правило «вызов» имя «Стоит на месте»' 'столбец 12 правило «вызов» имя «Стоит на месте»' > "$RAB/10.protocol"
opyt "место узла сдвинуто на знак" 1 "$ISH" "$SI" "$RAB/10.protocol" "на этом месте исходника"

vyrezat "$PR" 360 472 'функция «Дно зовёт себя»' > "$RAB/11.protocol"
vyrezat "$SI" 146 189 '/* Тело «Дно зовёт себя»' > "$RAB/11.c"
opyt "функция замолчана (C и протокол заодно)" 1 "$ISH" "$RAB/11.c" "$RAB/11.protocol" "протокол о ней молчит"

sed '$d' "$PR" > "$RAB/12.protocol"
opyt "оборванный протокол" 1 "$ISH" "$SI" "$RAB/12.protocol" "оборван"

{ cat "$SI"; echo '/* строка, которой не печатал ни один узел */'; } > "$RAB/13.c"
opyt "лишняя строка в конце C" 1 "$ISH" "$RAB/13.c" "$PR" "не напечатал ни один узел"

vyrezat "$PR" 162 164 'узел var строка 46 столбец 31' > "$RAB/14a.protocol"
zamenit "$RAB/14a.protocol" "$PARA" 'kruzhit_po_pare(ctx, n, &fl_t8' > "$RAB/14.protocol"
zamenit "$SI" "$PARA" 'kruzhit_po_pare(ctx, n, &fl_t8' > "$RAB/14.c"
opyt "довод выпал (C и протокол заодно)" 1 "$ISH" "$RAB/14.c" "$RAB/14.protocol" "доводов у вызова 1, а функция в исходнике принимает 2"

zamenit "$PR" 'граница входа' 'граница выхода' > "$RAB/15.protocol"
opyt "подложный блок протокола" 1 "$ISH" "$SI" "$RAB/15.protocol" "блок не из закрытого списка"

# ── квантор по элементам (правило «все-элементы», задача 7098) ──────────────
VSE=$TUT/fixtures/all-elements
VISH=$VSE/all-elements.flang
VSI=$VSE/all_elements_at_the_boundary.c
VPR=$VSE/all_elements_at_the_boundary.protocol

opyt "честная пара с квантором по элементам: все узлы переиграны" 0 "$VISH" "$VSI" "$VPR" "СОШЛОСЬ"

zamenit "$VPR" 'fl_t3 && fl_t4 < fl_t2' 'fl_t4 < fl_t2' > "$RAB/16.protocol"
zamenit "$VSI" 'fl_t3 && fl_t4 < fl_t2' 'fl_t4 < fl_t2' > "$RAB/16.c"
opyt "квантор без остановки на первом «нет» (C и протокол заодно)" 1 "$VISH" "$RAB/16.c" "$RAB/16.protocol" "по правилу ждали"

zamenit "$VPR" 'bool fl_t3 = true; /* для всех «п» */' 'bool fl_t3 = false; /* для всех «п» */' > "$RAB/17.protocol"
zamenit "$VSI" 'bool fl_t3 = true; /* для всех «п» */' 'bool fl_t3 = false; /* для всех «п» */' > "$RAB/17.c"
opyt "квантор начат с «нет»: на пустом списке ложь (C и протокол заодно)" 1 "$VISH" "$RAB/17.c" "$RAB/17.protocol" "по правилу ждали"

zamenit "$VPR" 'значение fl_flag(fl_t3)' 'значение fl_flag(true)' > "$RAB/18.protocol"
zamenit "$VSI" 'fl_post(ctx, fl_flag(fl_t3),' 'fl_post(ctx, fl_flag(true),' > "$RAB/18.c"
opyt "сторож обещания сверяет «да» вместо квантора (C и протокол заодно)" 1 "$VISH" "$RAB/18.c" "$RAB/18.protocol" "значение «для всех»"

zamenit "$VPR" 'правило «все-элементы» элемент «п»' 'правило «свёртка» элемент «п»' > "$RAB/19.protocol"
opyt "квантор назван свёрткой: правило без сличения не засчитано" 3 "$VISH" "$VSI" "$RAB/19.protocol" "правило «свёртка» не переиграно"

echo
if [ "$BEDA" = 0 ]; then
  echo "ИТОГ: опытов $VSEGO, все сошлись с ожиданием"
  exit 0
fi
echo "ИТОГ: опытов $VSEGO, разошлись с ожиданием $BEDA"
exit 1
# ярлык «перевод:проверка» sh — протокол перевода в C переигрывается сличителем на C: честные пары сходятся, подделки протокола и напечатанного C не принимаются (ADR-0030)
