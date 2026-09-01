#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# Замер столкновений имён при втаскивании семи генераторов в замыкание двоичного.
#
# ── Кто здесь судья ─────────────────────────────────────────────────────────
# Ни одной строки своего разбора и ни одной строки JavaScript: судит flang, а
# оболочка только раскладывает его ответы по трём стопкам.
#
#   1. СВЯЗЫВАНИЕ — `flang/self/link.flang`, строки 432, 450, 555, 583.
#      Отвечает FLANG_DUPLICATE_NAME на каждое имя, объявленное дважды.
#      Зовётся через `flang ast`: она собирает замыкание и на этом встаёт.
#   2. ПЕЧАТЬ В C — `flang/self/emit-c.flang`, «Просьбы имён» (3911) и «Занять
#      имя» (3929). Пространство имён у C одно на всё, что торчит наружу:
#      `создать <запись>`, `вариант <вариант>`, `<функция>`. Два РАЗНЫХ имени
#      могут дать один идентификатор — «Замены C» и «Замены C#» обе становятся
#      `zameny_c`, потому что решётка не буква и не цифра.
#   3. ПРОВЕРКА ТИПОВ — `flang/self/types.flang`, строка 2789: имена вариантов
#      обязаны быть уникальны на всю программу. Этот судья молчит ДО правки:
#      пока два одноимённых ТИПА живут в разных модулях, отказывает связывание;
#      разведёшь их переименованием — и варианты окажутся у двух разных сумм.
#      Улика и цена его пропуска — в `scripts/variant-probe.flang` рядом.
#
# ── Откуда берутся имена ────────────────────────────────────────────────────
# Из НАПЕЧАТАННОГО заголовка C. Над каждым объявлением там стоит его имя из
# исходника — «Функция flang «Слить просьбы».», «Сумма типов FTS «Скаляр»: …».
# То есть соответствие «идентификатор C → русское объявление» посчитал и
# напечатал сам flang; `scripts/names-in-c.awk` только читает готовое, второй
# транслитерации здесь нет.
#
# Отсюда и разбор столкновений без единого вычитания множеств:
#
#   • один идентификатор, РАЗНЫЕ имена — судья 2, связывание молчит;
#   • один идентификатор, одно имя варианта, а сумма переименуется, потому что
#     её имя столкнулось, — судья 3, молчат оба первых;
#   • одно имя в двух файлах — судья 1, он и скажет.
#
# ── Чем ограничено ──────────────────────────────────────────────────────────
# `flang emit` отбрасывает недостижимое от своих функций входа
# (`flang/src/reachable.mjs`). Своими функциями модуля-генератора корни и
# исчерпываются, поэтому потеряться может разве что тип, который модуль объявил
# и ни разу не применил. Сколько отброшено — печатается по каждой цели.
#
# ── Прогон ──────────────────────────────────────────────────────────────────
#   scripts/target-collisions.sh                           всё
#   scripts/target-collisions.sh --без-пар                 без 21 пары
#   FLANG=/путь/к/двоичному scripts/target-collisions.sh   судит двоичный
#
# Коды: 0 — замер снят; 3 — мерить нечем (двоичного нет). Третий — «не
# проверено», а не отрицательный приговор.
#
# Без FLANG зовётся `bootstrap/flang` — вторая реализация. Она здесь
# только машинка прогона: обе стороны сверены побайтово тестом самораскрутки, и
# `FLANG=<двоичный>` даёт те же числа без Node вовсе.
#
# Имена переменных оболочки латиницей не по выбору: bash не принимает в
# идентификаторах ничего, кроме [A-Za-z0-9_].

set -u
export LC_ALL=C.UTF-8
# Порядок сравнения — байтовый. `comm` и `join` сравнивают строки байтами
# всегда, а `sort` под локалью — по её правилам; разойдутся они молча, и
# пересечение множеств соврёт, ничего не сказав.
export LC_COLLATE=C

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 3

FL=${FLANG:-}
if [ -z "$FL" ]; then FL="$ROOT/bootstrap/flang"; fi

# ── ПРИБОР. Спрашивается ДО работы, и отказ говорится словами ───────────────
#
# Оба судьи — связывание (`flang ast`) и печать (`flang emit`) — это прогоны
# двоичного. Без него замер и раньше уходил кодом 3, то есть «не проверено», и
# код был верен; а вот сказано было не слово отказа, а сырая жалоба оболочки:
#
#   ПЕЧАТЬ ОТКАЗАЛА на flang/self/emit-go.flang:
#   scripts/target-collisions.sh: line 132: …/bootstrap/flang: No such file or directory
#
# Читается это как «печать сломалась, чините печать», хотя чинить надо сборку.
# Задача 1312; образец отказа — scripts/identical-declarations.sh.
if [ ! -x "$FL" ]; then
  printf 'НЕ ЗАМЕРЯЛ: нет двоичного %s.\n' "$FL" >&2
  printf 'Столкновения судят два его прогона — связывание (`flang ast`) и печать\n' >&2
  printf '(`flang emit --target c`); без двоичного не работает ни один.\n' >&2
  printf 'Это не «печать отказала», это «мерить нечем».\n' >&2
  printf 'Соберите его: make -C bootstrap -j8   (или укажите свой: FLANG=/путь/к/flang)\n' >&2
  exit 3
fi

TMP="$(mktemp -d -p "${TMPDIR:-/srv/tmp}")"
PROBE="flang/self/bootstrap/proba-stolknoveniy.flang"
trap 'rm -rf "$TMP" "$ROOT/$PROBE"' EXIT

ENTRY=flang/self/bootstrap/compiler.flang
BASE_H=bootstrap/compiler_flang.h
IMENA="$ROOT/scripts/names-in-c.awk"
TAB=$(printf '\t')

# цель:имя модуля:файл
TARGETS=(
  "go:Печать в Go:emit-go.flang"
  "rust:Печать в Rust:emit-rust.flang"
  "python:Печать в Python:emit-python.flang"
  "java:Печать в Java:emit-java.flang"
  "csharp:Печать в C#:emit-csharp.flang"
  "elixir:Печать в Elixir:emit-elixir.flang"
  "js:Печать в JavaScript:emit-js.flang"
)

fld() { printf '%s' "$1" | cut -d: -f"$2"; }

# ── судья 1: связывание ─────────────────────────────────────────────────────

# Диагностики связывания для замыкания с перечисленными целями, по строке на
# столкновение. Вход кладётся РЯДОМ с настоящим: пути в `использует`
# относительные, из чужого каталога они не разрешатся.
linkage() {
  local edge t
  edge=$(grep -n '^  использует ' "$ENTRY" | tail -1 | cut -d: -f1)
  head -n "$edge" "$ENTRY" >"$PROBE"
  # Генераторы приезжают ПОСЛЕ `emit-c.flang` — как приедут и в настоящей
  # правке, и как решает порядок строк у связывания.
  for t in "$@"; do
    printf '  использует «%s» из "../%s"\n' "$(fld "$t" 2)" "$(fld "$t" 3)" >>"$PROBE"
  done
  tail -n +"$((edge + 1))" "$ENTRY" >>"$PROBE"
  $FL ast "$PROBE" >/dev/null 2>"$TMP/link.err"
  rm -f "$PROBE"
  # Свидетель на Node печатает диагностику JSON-ом, двоичный — строкой
  # человеку («FLANG_DUPLICATE_NAME, строка 510, столбец 1: …»). Оба вида
  # читаются здесь, потому что мерить полагается тем и другим, а числа обязаны
  # сойтись: на emit-go сошлись, 1 и 1.
  if jq -e '.diagnostics' <"$TMP/link.err" >/dev/null 2>&1; then
    jq -r '.diagnostics[]? | select(.code=="FLANG_DUPLICATE_NAME") | .message' \
      <"$TMP/link.err" 2>/dev/null
    return
  fi
  sed -n 's/^FLANG_DUPLICATE_NAME, [^:]*: //p' "$TMP/link.err"
}

# «функция «Слить просьбы» объявлена в двух модулях: A и B» → «функция|Слить просьбы».
# Диагностик больше, чем имён: связывание жалуется на каждую ВСТРЕЧУ, а
# переименование нужно одно на имя.
names() { sed -E 's/» .*//; s/ «/|/' | sort -u; }

# ── таблица имён напечатанного модуля ───────────────────────────────────────

# «идентификатор \t род \t имя \t владелец», по идентификатору.
table() {
  local src="$1" out="$2" h pref
  rm -rf "$out"
  if ! $FL emit "$src" --target c --out "$out" >"$TMP/emit.out" 2>"$TMP/emit.err"; then
    printf 'ПЕЧАТЬ ОТКАЗАЛА на %s:\n' "$src" >&2
    head -c 500 "$TMP/emit.err" >&2
    printf '\n' >&2
    return 1
  fi
  # Ключ с кириллицей jq принимает только в скобках.
  jq -r '.["отброшено"] // "?"' <"$TMP/emit.out" 2>/dev/null >"$TMP/dropped"
  h=$(ls "$out"/*.h | grep -v flang_runtime | head -1)
  pref=$(basename "$h" .h)
  awk -v pref="$pref" -f "$IMENA" "$h" | sort -t"$TAB" -k1,1
  rm -rf "$out"
}

# ── прогон ──────────────────────────────────────────────────────────────────

printf '═══ ЧЕМ МЕРЕНО ═══\n'
printf 'flang:  %s\n' "$FL"
printf 'версия: %s\n' "$($FL --version 2>&1 | head -1)"
printf 'дерево: %s\n' "$(git rev-parse --short HEAD 2>/dev/null)"
printf '\n'

printf '═══ БАЗА: замыкание двоичного как оно есть ═══\n'
# База берётся из ТОЧКИ РАСКРУТКИ, а не из свежей печати: именно её собирает
# `cc`, и именно её идентификаторы займёт новый модуль. Свежесть точки стерегла
# `flang/test/self-bootstrap.test.mjs` — она снята 20 августа 2026 коммитом `105943cd`; сегодня это не стережёт ничто.
# Ближайшее живое: `sh scripts/raskrutka.sh --bystro` — оно сверяет ВХОДЫ печати
# за секунды, а не саму точку, и на сегодняшнем стволе краснеет (ROADMAP, 6а:
# «расхождений 46, код 1»).
awk -v pref=compiler_flang -f "$IMENA" "$BASE_H" | sort -t"$TAB" -k1,1 >"$TMP/base.tab"
cut -f1 "$TMP/base.tab" >"$TMP/base.id"
printf 'файл базы: %s\n' "$BASE_H"
printf 'объявлений в C: %s (функций %s, вариантов %s, записей %s)\n' \
  "$(wc -l <"$TMP/base.tab")" \
  "$(awk -F"$TAB" '$2=="функция"' "$TMP/base.tab" | wc -l)" \
  "$(awk -F"$TAB" '$2=="вариант"' "$TMP/base.tab" | wc -l)" \
  "$(awk -F"$TAB" '$2=="запись"' "$TMP/base.tab" | wc -l)"
printf 'столкновений связывания в базе: %s\n' "$(linkage | wc -l)"
printf '\n'

printf '═══ ПО ОДНОЙ ЦЕЛИ ПРОТИВ НЫНЕШНЕГО ЗАМЫКАНИЯ ═══\n'
printf '%-12s %7s %7s %11s %7s %6s %6s\n' цель строк диагн. связывание печать типы всего
for t in "${TARGETS[@]}"; do
  n=$(fld "$t" 1)
  f=$(fld "$t" 3)
  linkage "$t" >"$TMP/$n.link"
  names <"$TMP/$n.link" >"$TMP/$n.names"
  table "flang/self/$f" "$TMP/out.$n" >"$TMP/$n.tab" || exit 3
  cp "$TMP/dropped" "$TMP/$n.dropped"

  # СУДЬЯ 2: один идентификатор, разные имена. Связывание молчит — имена-то
  # разные, — а печать отказывается выдать один идентификатор дважды.
  join -t"$TAB" -j1 "$TMP/$n.tab" "$TMP/base.tab" \
    | awk -F"$TAB" '$2 "|" $3 != $5 "|" $6' >"$TMP/$n.print"

  # СУДЬЯ 3: вариант, чья сумма переименуется. Имя суммы столкнулось (значит
  # разводить её придётся), а имя варианта уже занято базой — после развода
  # варианты окажутся у двух разных сумм.
  awk -F'|' '$1=="тип"{print $2}' "$TMP/$n.names" | sort -u >"$TMP/$n.types"
  join -t"$TAB" -j1 "$TMP/$n.tab" "$TMP/base.tab" \
    | awk -F"$TAB" -v types="$TMP/$n.types" '
        BEGIN { while ((getline line < types) > 0) bad[line] = 1 }
        $2 == "вариант" && $2 "|" $3 == $5 "|" $6 && ($4 in bad)' >"$TMP/$n.variants"

  printf '%-12s %7s %7s %11s %7s %6s %6s\n' "emit-$n" \
    "$(wc -l <"flang/self/$f")" "$(wc -l <"$TMP/$n.link")" "$(wc -l <"$TMP/$n.names")" \
    "$(wc -l <"$TMP/$n.print")" "$(wc -l <"$TMP/$n.variants")" \
    "$(( $(wc -l <"$TMP/$n.names") + $(wc -l <"$TMP/$n.print") + $(wc -l <"$TMP/$n.variants") ))"
done
printf '\n'
printf 'диагн.     — сообщений FLANG_DUPLICATE_NAME (по одному на каждую встречу)\n'
printf 'связывание — имён к переименованию, по одному на имя: судья 1\n'
printf 'печать     — один идентификатор C у двух разных имён: судья 2\n'
printf 'типы       — вариантов, которые столкнутся после развода своей суммы: судья 3\n'
printf '\n'

printf '═══ ИМЕНА ПОШТУЧНО ═══\n'
for t in "${TARGETS[@]}"; do
  n=$(fld "$t" 1)
  printf -- '── emit-%s (недостижимого отброшено при печати: %s) ──\n' "$n" "$(cat "$TMP/$n.dropped")"
  sed -E 's/ (объявлен|объявлена|объявлено) в двух модулях: [^ ]*\/(flang\/[^ ]*) и .*/ — занято в \2/' "$TMP/$n.link" \
    | sed 's/^/    [связывание] /'
  awk -F"$TAB" '{printf "    [печать] «%s» и «%s» → %s\n", $3, $6, $1}' "$TMP/$n.print"
  awk -F"$TAB" '{printf "    [типы] вариант «%s» суммы «%s» → %s\n", $3, $4, $1}' "$TMP/$n.variants"
done
printf '\n'

if [ "${1:-}" != "--без-пар" ]; then
  printf '═══ ЦЕЛЕЙ МЕЖДУ СОБОЙ, ПОПАРНО (сверх одиночных) ═══\n'
  for ((i = 0; i < ${#TARGETS[@]}; i++)); do
    for ((j = i + 1; j < ${#TARGETS[@]}; j++)); do
      a=$(fld "${TARGETS[$i]}" 1)
      b=$(fld "${TARGETS[$j]}" 1)
      linkage "${TARGETS[$i]}" "${TARGETS[$j]}" | names >"$TMP/pair.names"
      sort -u "$TMP/$a.names" "$TMP/$b.names" >"$TMP/own.names"
      extra=$(comm -23 "$TMP/pair.names" "$TMP/own.names" | wc -l)
      # Один идентификатор у двух РАЗНЫХ имён, ни одно из которых не занято
      # базой: этого не видит никто, пока обе цели не встретятся.
      dbl=$(join -t"$TAB" -j1 "$TMP/$a.tab" "$TMP/$b.tab" \
        | awk -F"$TAB" '$2 "|" $3 != $5 "|" $6 {print $1}' \
        | sort -u | comm -23 - "$TMP/base.id" | wc -l)
      printf '%-18s связывание %4s   печать %4s\n' "$a + $b" "$extra" "$dbl"
    done
  done
  printf '\n'
fi

printf '═══ ВСЕ СЕМЬ РАЗОМ ═══\n'
linkage "${TARGETS[@]}" >"$TMP/all.link"
names <"$TMP/all.link" >"$TMP/all.names"
cat "$TMP"/*.print | cut -f1 | sort -u >"$TMP/all.print"
cat "$TMP"/*.variants | cut -f1 | sort -u >"$TMP/all.variants"
printf 'диагностик связывания: %s\n' "$(wc -l <"$TMP/all.link")"
printf 'имён к переименованию по связыванию: %s\n' "$(wc -l <"$TMP/all.names")"
printf 'идентификаторов, о которых связывание молчит (печать): %s\n' "$(wc -l <"$TMP/all.print")"
printf 'вариантов, которые столкнутся после развода сумм: %s\n' "$(wc -l <"$TMP/all.variants")"
printf 'всего переименований: %s\n' \
  "$(( $(wc -l <"$TMP/all.names") + $(wc -l <"$TMP/all.print") + $(wc -l <"$TMP/all.variants") ))"

printf '\n═══ КАРТА ПЕРЕИМЕНОВАНИЙ ═══\n'
# ПРАВИЛО ОДНО НА ВСЕ СЕМЬ: к столкнувшемуся имени приписывается латинское имя
# цели — Go, Rust, Python, Java, CSharp, Elixir, JavaScript. Если имя уже
# кончается меткой своей цели («Замены C#» у emit-csharp), метка отбрасывается,
# а не дублируется: это то же слово.
#
# Идентификатор после переименования считается БЕЗ транслитерации, и это не
# срезанный угол. `snake` режет имя по всему, что не буква и не цифра, и
# склеивает слова через подчёркивание (`flang/src/naming.mjs`), поэтому
# приписка « Java» к имени — это ровно приписка «_java» к идентификатору, а
# замена хвоста « C#» на « CSharp» — замена `_c` на `_csharp`. Проверять
# предложенное можно прямо по таблице базы.
SUFFIX=(go:Go rust:Rust python:Python java:Java csharp:CSharp elixir:Elixir js:JavaScript)
: >"$TMP/map.tsv"
for t in "${TARGETS[@]}"; do
  n=$(fld "$t" 1)
  s=""
  for pair in "${SUFFIX[@]}"; do [ "${pair%%:*}" = "$n" ] && s=${pair##*:}; done
  low=$(printf '%s' "$s" | tr 'A-Z' 'a-z')

  # 1. Имена, на которые ответило связывание. Идентификатор берётся из таблицы
  #    напечатанного модуля; у суммы своего идентификатора нет — за неё
  #    отвечают её варианты, они идут третьим пунктом.
  awk -F'|' -v tab="$TMP/$n.tab" -v n="$n" -v s="$s" -v low="$low" '
    BEGIN { FS="|"; while ((getline l < tab) > 0) { split(l, c, "\t"); id[c[2] "|" c[3]] = c[1] } }
    { key = ($1 == "тип" ? "запись" : $1) "|" $2
      print n "\tсвязывание\t" $1 "\t" $2 "\t" $2 " " s "\t" (key in id ? id[key] "_" low : "—") }
  ' "$TMP/$n.names" >>"$TMP/map.tsv"

  # 2. Имена, о которых связывание молчит: один идентификатор у двух разных
  #    имён. Хвост « C#» — метка своей же цели, поэтому он заменяется.
  # Переменные awk латиницей по той же причине, что и в bash: gawk не берёт в
  # идентификаторы ничего, кроме [A-Za-z_0-9]. Кириллические имена здесь уже
  # стоили восьми пропавших строк карты, и пропали они молча.
  awk -F"$TAB" -v n="$n" -v s="$s" -v low="$low" '
    { bylo = $3; stalo = bylo
      sub(/ C#$/, "", stalo); stalo = stalo " " s
      ident = $1; sub(/_c$/, "", ident)
      print n "\tпечать\t" $2 "\t" bylo "\t" stalo "\t" ident "_" low }
  ' "$TMP/$n.print" >>"$TMP/map.tsv"

  # 3. Варианты, которые столкнутся, как только их сумму разведут по имени.
  awk -F"$TAB" -v n="$n" -v s="$s" -v low="$low" '
    { print n "\tтипы\tвариант\t" $3 "\t" $3 " " s "\t" $1 "_" low }
  ' "$TMP/$n.variants" >>"$TMP/map.tsv"
done

printf 'переименований всего: %s\n' "$(wc -l <"$TMP/map.tsv")"
awk -F"$TAB" '{c[$1]++} END {for (k in c) printf "  emit-%-8s %5d\n", k, c[k]}' "$TMP/map.tsv" | sort
# ПОДДЕЛКА НА ПРАВИЛО: предложенное имя обязано быть свободно. Занятым его
# сделали бы либо база, либо соседняя цель, и оба случая ловятся здесь.
cut -f6 "$TMP/map.tsv" | grep -v '^—$' | sort -u >"$TMP/map.id"
cat "$TMP"/*.tab | cut -f1 | sort -u >"$TMP/vse.id"
zanyato=$(comm -12 "$TMP/map.id" "$TMP/base.id" | wc -l)
vzaimno=$(cut -f6 "$TMP/map.tsv" | grep -v '^—$' | sort | uniq -d | wc -l)
chuzhoe=$(comm -12 "$TMP/map.id" "$TMP/vse.id" | wc -l)
printf 'предложенных идентификаторов: %s\n' "$(wc -l <"$TMP/map.id")"
printf 'из них занято базой: %s (обязан быть 0)\n' "$zanyato"
printf 'из них совпало между целями: %s (обязан быть 0)\n' "$vzaimno"
printf 'из них занято любой из целей: %s (обязан быть 0)\n' "$chuzhoe"
if [ -n "${KARTA:-}" ]; then
  { printf 'цель\tсудья\tрод\tбыло\tстало\tидентификатор\n'; cat "$TMP/map.tsv"; } >"$KARTA"
  printf 'карта записана: %s\n' "$KARTA"
fi
