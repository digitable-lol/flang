#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# Перепись перечней, набранных руками, и сверка их с деревом.
#
# ── Зачем ────────────────────────────────────────────────────────────────────
# Перечень имён, записанный в одном файле и описывающий вещи, живущие в другом,
# верен в день записи и лжёт назавтра: дерево меняется без него. Класс описан
# заметкой docs/zettel/a-hand-written-list-outlives-the-tree.md. До этого файла
# прибора, который считает такие перечни и спрашивает, разошлись ли они, в
# дереве не было — числа «105 перечней, 57 расходятся» назывались наизусть.
#
# ── Чем эта перепись НЕ является ─────────────────────────────────────────────
# Она не держит списка мест, куда смотреть: тогда она стала бы сто шестым
# перечнем и протухла бы ровно так же. Файлы берутся прогоном `git ls-files`,
# цели печати — из имён `flang/self/emit-*.flang`, оглавление дерева — оттуда же.
# Руками здесь набрано ровно одно: ПРАВИЛО, по которому строка признаётся
# перечнем, и оно записано ниже словами.
#
# ── Что считается перечнем ───────────────────────────────────────────────────
# ЦЕЛИ. Связная череда строк, в которой стоит ШЕСТЬ и более из девяти имён целей
# печати. Шесть из девяти — это заявка на «вот они все»; три имени рядом («go,
# rust и java печатать отказываются») — правдивое высказывание о подмножестве, и
# перечнем оно не считается. Расхождение: цель дерева, которой в череде нет.
#
# ЧЕГО ЭТА ПЕРЕПИСЬ НЕ ВИДИТ, СКАЗАНО ПРЯМО: связная череда строк берётся как
# ОДИН перечень. Две соседние копии одного перечня (в примере и в теле функции
# рядом) сливаются в одну, и цель, вынутая ровно из одной копии, прячется за
# второй. Проверено подлогом: правка одной строки из двух ответа не меняет,
# правка обеих — краснеет. Разделять по строкам пробовал: перенос длинной
# строки прозы тут же даёт четыре ложных расхождения, и лекарство выходит хуже
# болезни.
#
# ПУТИ. Связная череда строк-пунктов (маркер, номер, ячейка таблицы или
# закавыченный литерал), в которой стоит ТРИ и более разных имени объекта
# дерева. Расхождение: имя, которого в дереве нет ни файлом, ни каталогом.
#
# ── Как звать ────────────────────────────────────────────────────────────────
#   sh scripts/hand-written-lists.sh             перепись: два числа и все адреса
#   sh scripts/hand-written-lists.sh --check     то же и код 1, если расхождений
#                                                больше, чем записано в ведомости
#   sh scripts/hand-written-lists.sh --targets   только перечни целей печати
#
# Коды: 0 — сошлось; 1 — не сошлось; 2 — судить нечем (нет двоичного, нет
# ведомости). Второй — «не проверено», а НЕ отрицательный приговор.
#
# Ведомость известных расхождений — scripts/hand-written-lists-ledger.tsv. Она
# сверяется В ОБЕ СТОРОНЫ: запись, переставшая быть расхождением, красит так же,
# как новое расхождение. Иначе ведомость сама стала бы перечнем, пережившим
# дерево.

set -eu

# ── ЛОКАЛЬ ЗАДАЁТСЯ ЗДЕСЬ, А НЕ СНАРУЖИ ─────────────────────────────────────
# `comm` сравнивает строки байтами всегда, а `sort` — по правилам локали. Под
# `LC_ALL=ru_RU.UTF-8` они расходятся молча: сверка с ведомостью печатала три
# жалобы `comm: file 2 is not in sorted order`, под `C.UTF-8` — ни одной.
# Порядок сравнения обязан быть свойством сверки, а не машины, на которой её
# гоняют (задача 1312).
export LC_ALL=C.UTF-8
export LC_COLLATE=C

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

LEDGER=scripts/hand-written-lists-ledger.tsv

mode=census
targets_only=0
for a in "$@"; do
  case $a in
    --check) mode=check ;;
    --targets) targets_only=1 ;;
    --help|-h) sed -n '5,40p' "$0"; exit 0 ;;
    *) printf '%s\n' "неизвестный довод: $a" >&2; exit 2 ;;
  esac
done

# ── ПРИБОР: без двоичного сверять целевые перечни нечем ─────────────────────
#
# Целей печати в дереве ДВЕ штуки (см. ниже), и вторую — цели у двоичного —
# спрашивает прогон `bootstrap/flang emit --help`. Без двоичного этот список
# выходит пустым, и всякий перечень, называющий восемь целей семени, перестаёт
# сходиться хоть с чем-нибудь. Замерено на стволе `fa45f9ff`: с двоичным
# перепись даёт «расходятся 60 (целей 15, путей 45)», без него — «109 (целей
# 56)», а `--check` объявляет 49 НЕСУЩЕСТВУЮЩИХ новых расхождений и уходит
# кодом 1.
#
# Код 1 читается как «в дереве беда, чините дерево», и на нём уже потеряли
# время. Отсутствие прибора — это «не проверено», код 2 (задача 1312; образец
# отказа — scripts/identical-declarations.sh).
if [ ! -x bootstrap/flang ]; then
  printf 'НЕ СУДИЛ: нет двоичного %s/bootstrap/flang.\n' "$ROOT" >&2
  printf 'Список целей печати у двоичного берётся прогоном `flang emit --help`;\n' >&2
  printf 'без него всякий перечень целей выглядит разошедшимся, и перепись\n' >&2
  printf 'называет расхождения, которых нет.\n' >&2
  printf 'Это не «перечни разошлись», это «сверять не с чем».\n' >&2
  printf 'Соберите его: make -C bootstrap -j8\n' >&2
  exit 2
fi

TMP=$(mktemp -d "${TMPDIR:-/tmp}/hand-written-lists.XXXXXX")
trap 'rm -rf "$TMP"' EXIT INT TERM

# ── Источники. Всё прогоном, ни одного имени руками ─────────────────────────
git -c core.quotepath=false ls-files > "$TMP/оглавление"
# ── Целей печати в дереве ДВЕ штуки, и это не описка ─────────────────────────
# Слои печати лежат в исходнике: flang/self/emit-*.flang — их девять.
# Двоичный, которым дерево судят, собран из СЕМЕНИ, и своих целей у него ровно
# столько же: перепись сама печатает оба числа, сверять их на глаз не надо.
#
# ПОПРАВКА 5 сентября 2026. Прежде здесь стояло, что у семени целей восемь, а
# девятая (cpp) в него ещё не перепечатана, и потому перечень из восьми не лжёт.
# Это перестало быть правдой: семя с тех пор перепечатано, и оба источника дают
# девять — проверено прогоном (`bootstrap/flang emit --target cpp --out …` даёт
# 7 файлов и код 0, напечатанное — настоящий C++ с `namespace flang`). Значит
# перечень из восьми теперь расходится С ОБОИМИ источниками, и перепись его
# красит по делу. Само правило не менялось: лжёт тот, кто не сошёлся ни с одним.
# Урок общий и за сутки четвёртый: примечание про «исходник ≠ семя» протухает
# ровно тогда, когда семя догоняет, — и молча, потому что примечания никто не
# сверяет прогоном.
ls flang/self/emit-*.flang | sed 's|.*/emit-||; s|\.flang$||' | sort > "$TMP/цели"
: > "$TMP/цели-семени"
if [ -x bootstrap/flang ]; then
  bootstrap/flang emit --help 2>/dev/null \
    | LC_ALL=C.UTF-8 /usr/bin/grep -a -o -m1 -- '--target [a-z|]*' \
    | sed 's|--target ||' | tr '|' '\n' | LC_ALL=C.UTF-8 /usr/bin/grep -a -v '^$' | sort > "$TMP/цели-семени"
fi
git -c core.quotepath=false ls-files \
  | LC_ALL=C.UTF-8 /usr/bin/grep -a -E '\.(flang|mjs|sh|js|py|awk|json|yml|yaml|md|tsv)$' > "$TMP/все-числящиеся"
# ── Числится в git ≠ лежит на диске ─────────────────────────────────────────
# Пути ниже уезжают в gawk ДОВОДАМИ (`$(cat "$TMP/файлы")`), а gawk на
# несуществующем файле не краснеет, а ПАДАЕТ: «gawk: fatal … cannot open file»,
# код 2. Ловится это не выдуманным случаем, а обычным: посреди перебазирования
# или при снятой правке файл ещё числится в `ls-files`, а на диске его уже нет,
# и сторож в этот миг не говорит ни правды, ни лжи — он просто умирает.
# Поэтому: отсутствующие отсеиваются, но НЕ молча — их число печатается в
# итоге, потому что числа переписи сняты тогда с неполного набора, и знать об
# этом обязан тот, кто на них смотрит. Само по себе отсутствие красным не
# делаем: дерево посреди перебазирования — не изъян дерева.
: > "$TMP/пропали"
: > "$TMP/файлы"
while IFS= read -r put; do
  if [ -f "$put" ]; then printf '%s\n' "$put" >> "$TMP/файлы"
  else printf '%s\n' "$put" >> "$TMP/пропали"; fi
done < "$TMP/все-числящиеся"
# Семья ПУТЕЙ идёт только по коду. В прозе имя исчезнувшего файла часто и есть
# предмет речи («flang/src/lexer.mjs больше нет»), и красить это — врать; в коде
# путь, которого в дереве нет, — всегда изъян.
LC_ALL=C.UTF-8 /usr/bin/grep -a -E '\.(flang|mjs|sh|js|py|awk)$' "$TMP/файлы" > "$TMP/код"

# ── Перечни целей печати ────────────────────────────────────────────────────
gawk -v targets_file="$TMP/цели" -v seed_file="$TMP/цели-семени" '
  BEGIN {
    while ((getline t < targets_file) > 0) if (t != "") { tgt[t] = 1; all_n++ }
    while ((getline t < seed_file) > 0) if (t != "") { seed[t] = 1; seed_n++ }
    need = int(all_n * 2 / 3)          # шесть из девяти
    if (need < 3) need = 3
  }
  function reset(  i) { delete seen; n = 0; start = 0 }
  function flush(   i, miss, misslist, smiss) {
    if (n >= need) {
      lists++
      miss = 0; misslist = ""
      for (i in tgt) if (!(i in seen)) { miss++; misslist = misslist (miss > 1 ? "," : "") i }
      smiss = 0
      if (seed_n > 0) { for (i in seed) if (!(i in seen)) smiss++ }
      if (miss == 0) { printf "ЦЕЛИ-ЦЕЛ\t%s\t%d\t%d\t%d\tпо исходнику\n", file, start, n, all_n }
      else if (seed_n > 0 && smiss == 0 && n == seed_n) {
        seedlists++
        printf "ЦЕЛИ-СЕМЯ\t%s\t%d\t%d\t%d\tпо семени (%d целей); в исходнике нет: %s\n", file, start, n, all_n, seed_n, misslist
      }
      else { diverged++; printf "ЦЕЛИ\t%s\t%d\t%d\t%d\tнет ни там, ни там: %s\n", file, start, n, all_n, misslist }
    }
    reset()
  }
  FNR == 1 { flush(); file = FILENAME }
  {
    # имя цели считается названным, если стоит отдельным словом: в кавычках,
    # в обратных кавычках, через пробел в строке оболочки или как «emit-имя».
    s = $0; k = 0
    if (file ~ /\.md$/) {
      # в прозе имя цели всегда стоит в кавычках или обратных кавычках; без
      # этого правила связная проза «цель c печатает, а go отказывает» слилась
      # бы в перечень, которым она не является.
      while (match(s, /["\x27`][a-z]+["\x27`]/)) {
        w = substr(s, RSTART + 1, RLENGTH - 2)
        s = substr(s, RSTART + RLENGTH)
        if (w in tgt) { if (!(w in seen)) { seen[w] = 1; n++ }; k++ }
      }
    } else {
      # в коде перечень бывает и без кавычек: VSE="c go rust …",
      # «for module in emit-go emit-rust …»
      gsub(/[^A-Za-z0-9_-]/, " ", s)
      gsub(/(^| )emit-/, " ", s)
      nw = split(s, wds, /[ ]+/)
      for (wi = 1; wi <= nw; wi++) {
        w = wds[wi]
        if (w in tgt) { if (!(w in seen)) { seen[w] = 1; n++ }; k++ }
      }
    }
    if (k > 0) { if (start == 0) start = FNR }
    else if (n > 0) flush()
  }
  END { flush(); printf "ИТОГ-ЦЕЛИ\t%d\t%d\t%d\n", lists, diverged, seedlists }
' $(cat "$TMP/файлы") > "$TMP/цели.tsv"

# ── Перечни путей дерева ────────────────────────────────────────────────────
gawk -v inventory="$TMP/оглавление" '
  BEGIN {
    while ((getline t < inventory) > 0) if (t != "") {
      tree[t] = 1
      p = t; while (match(p, "/[^/]*$")) { p = substr(p, 1, RSTART - 1); tree[p] = 1; tree[p "/"] = 1 }
      q = t; while (match(q, "^[^/]*/")) { q = substr(q, RSTART + RLENGTH); tree[q] = 1 }
    }
    reset()
  }
  # порождённое имя (bootstrap/flang) в оглавлении не лежит, а на диске есть
  function on_disk(nm,   r) {
    if (nm in disk) return disk[nm]
    r = (system("test -e \"" nm "\"") == 0)
    disk[nm] = r
    return r
  }
  function reset(  i) { delete names; n = 0; start = 0; gap = 0; delete lineof }
  function flush(   i, miss, misslist) {
    if (n >= 3) {
      lists++
      miss = 0; misslist = ""
      for (i = 1; i <= n; i++) if (!(names[i] in tree) && !on_disk(names[i])) {
        miss++; misslist = misslist (miss > 1 ? " " : "") names[i] ":" lineof[names[i]]
      }
      if (miss > 0) { diverged++; printf "ПУТИ\t%s\t%d\t%d\t%d\tнет: %s\n", file, start, miss, n, misslist }
      else printf "ПУТИ-ЦЕЛ\t%s\t%d\t0\t%d\t-\n", file, start, n
    }
    reset()
  }
  FNR == 1 { flush(); file = FILENAME }
  {
    text = $0
    gsub(/\\[nrt]/, " ", text)          # "\ndocs/a.md" — не имя дерева
    shape = 0
    if (text ~ /^[ \t]*[-*+][ \t]/) shape = 1
    else if (text ~ /^[ \t]*[0-9]+[.)][ \t]/) shape = 1
    else if (text ~ /^[ \t]*\|/) shape = 1
    else if (text ~ /["\x27`]/) shape = 1
    k = 0; delete fresh
    if (shape && index(text, "://") == 0) {
      s = text
      while (match(s, /[A-Za-z0-9_][A-Za-z0-9_.-]*(\/[A-Za-z0-9_.А-Яа-яЁё-]+)+/)) {
        c = substr(s, RSTART, RLENGTH)
        pre = substr(s, 1, RSTART - 1)
        s = substr(s, RSTART + RLENGTH)
        if (pre ~ /[$%{]$/) continue                       # подстановка оболочки
        if (c ~ /^[A-Z][A-Z0-9_]*\//) continue             # $ПЕРЕМЕННАЯ/путь
        if (c ~ /\*/) continue                             # маска, а не имя
        if (c !~ /\.(flang|mjs|md|sh|c|h|json|tsv|txt|py|fts|yml|yaml|js|awk|ex|java|cs|vim|html|hex|toml|lock)$/ &&
            c !~ /^(flang|docs|scripts|tasks|fspec|examples|benchmarks|bootstrap|packaging|editors|web)\//) continue
        base = c; sub(/^.*\//, "", base)
        if (base ~ /^[a-zA-Z0-9]\./) continue              # a.md — выдуманный пример пробы
        fresh[++k] = c
      }
    }
    if (k > 0) {
      if (n == 0) start = FNR
      for (i = 1; i <= k; i++) {
        was = 0
        for (j = 1; j <= n; j++) if (names[j] == fresh[i]) was = 1
        if (!was) { names[++n] = fresh[i]; lineof[fresh[i]] = FNR }
      }
      gap = 0
    } else if (n > 0) { gap++; if (gap > 1) flush() }
  }
  END { flush(); printf "ИТОГ-ПУТИ\t%d\t%d\n", lists, diverged }
' $(cat "$TMP/код") > "$TMP/пути.tsv"

# ── Свод ────────────────────────────────────────────────────────────────────
tgt_lists=$(LC_ALL=C.UTF-8 /usr/bin/grep -a '^ИТОГ-ЦЕЛИ' "$TMP/цели.tsv" | cut -f2)
tgt_bad=$(LC_ALL=C.UTF-8 /usr/bin/grep -a '^ИТОГ-ЦЕЛИ' "$TMP/цели.tsv" | cut -f3)
tgt_seed=$(LC_ALL=C.UTF-8 /usr/bin/grep -a '^ИТОГ-ЦЕЛИ' "$TMP/цели.tsv" | cut -f4)
nseed=$(wc -l < "$TMP/цели-семени" | tr -d ' ')
path_lists=$(LC_ALL=C.UTF-8 /usr/bin/grep -a '^ИТОГ-ПУТИ' "$TMP/пути.tsv" | cut -f2)
path_bad=$(LC_ALL=C.UTF-8 /usr/bin/grep -a '^ИТОГ-ПУТИ' "$TMP/пути.tsv" | cut -f3)

if [ "$targets_only" = 1 ]; then
  all_lists=$tgt_lists; all_bad=$tgt_bad
  LC_ALL=C.UTF-8 /usr/bin/grep -a '^ЦЕЛИ	' "$TMP/цели.tsv" > "$TMP/расхождения" || true
else
  all_lists=$((tgt_lists + path_lists)); all_bad=$((tgt_bad + path_bad))
  { LC_ALL=C.UTF-8 /usr/bin/grep -a '^ЦЕЛИ	' "$TMP/цели.tsv" || true
    LC_ALL=C.UTF-8 /usr/bin/grep -a '^ПУТИ	' "$TMP/пути.tsv" || true; } > "$TMP/расхождения"
fi

commit=$(git -c core.quotepath=false rev-parse --short HEAD)
ntargets=$(wc -l < "$TMP/цели" | tr -d ' ')

printf 'перепись перечней, набранных руками — ствол %s\n' "$commit"
printf 'целей печати по исходнику flang/self/emit-*.flang: %s (%s)\n' "$ntargets" "$(tr '\n' ' ' < "$TMP/цели")"
printf 'целей печати у двоичного bootstrap/flang:            %s (%s)\n' "$nseed" "$(tr '\n' ' ' < "$TMP/цели-семени")"
printf '\n'
printf 'перечней набрано руками: %s   (целей %s, путей %s)\n' "$all_lists" "$tgt_lists" "$path_lists"
printf 'из них расходятся с деревом сегодня: %s   (целей %s, путей %s)\n' "$all_bad" "$tgt_bad" "$path_bad"
printf 'перечней целей, сошедшихся с семенем, а не с исходником: %s\n' "$tgt_seed"
printf '\n'

if [ "$tgt_seed" -gt 0 ]; then
  printf 'перечни целей, сошедшиеся с ДВОИЧНЫМ, а не с исходником (отстают на девятую цель):\n'
  LC_ALL=C.UTF-8 /usr/bin/grep -a '^ЦЕЛИ-СЕМЯ	' "$TMP/цели.tsv" \
    | while IFS='	' read -r kind fname lno cnt tot rest; do
        printf '  %s:%s\t%s\n' "$fname" "$lno" "$rest"
      done
  printf '\n'
fi

if [ "$all_bad" -gt 0 ]; then
  printf 'расхождения:\n'
  while IFS='	' read -r kind fname lno cnt tot rest; do
    printf '  %s\t%s:%s\t%s из %s\t%s\n' "$kind" "$fname" "$lno" "$cnt" "$tot" "$rest"
  done < "$TMP/расхождения"
  printf '\n'
fi

[ "$mode" = check ] || exit 0

# ── Сверка с ведомостью, в обе стороны ──────────────────────────────────────
# Нет ведомости — второй прибор отсутствует, и это тоже «не проверено», код 2:
# «сверять не с чем» и «сверка не сошлась» — разные ответы (задача 1312).
[ -f "$LEDGER" ] || { printf 'НЕ СУДИЛ: ведомости %s нет — сверять не с чем\n' "$LEDGER" >&2; exit 2; }

LC_ALL=C.UTF-8 /usr/bin/grep -a -v '^#' "$LEDGER" | LC_ALL=C.UTF-8 /usr/bin/grep -a -v '^$' \
  | cut -f1,2,3 | sort > "$TMP/ведомость"
cut -f1,2,3 "$TMP/расхождения" | sort > "$TMP/сейчас"

comm -13 "$TMP/ведомость" "$TMP/сейчас" > "$TMP/новые"
comm -23 "$TMP/ведомость" "$TMP/сейчас" > "$TMP/мёртвые"

n_new=$(wc -l < "$TMP/новые" | tr -d ' ')
n_dead=$(wc -l < "$TMP/мёртвые" | tr -d ' ')

n_gone=$(wc -l < "$TMP/пропали" | tr -d ' ')
if [ "$n_gone" -gt 0 ]; then
  printf 'ЧИСЛЯТСЯ В GIT, НО НЕ ЛЕЖАТ НА ДИСКЕ: %s — перепись снята БЕЗ них\n' "$n_gone" >&2
  while IFS= read -r put; do printf '  нет на диске\t%s\n' "$put" >&2; done < "$TMP/пропали"
  printf 'красным это не делаем: посреди перебазирования так и бывает; но числа\n' >&2
  printf 'ниже сняты с неполного набора, и на них нельзя ссылаться как на полные.\n\n' >&2
fi

bad=0
if [ "$n_new" -gt 0 ]; then
  bad=1
  printf 'НОВЫХ РАСХОЖДЕНИЙ: %s — их нет в ведомости %s\n' "$n_new" "$LEDGER" >&2
  while IFS='	' read -r kind fname lno; do
    printf '  %s\t%s:%s\n' "$kind" "$fname" "$lno" >&2
  done < "$TMP/новые"
  printf '\n' >&2
fi
if [ "$n_dead" -gt 0 ]; then
  bad=1
  printf 'МЁРТВЫХ ЗАПИСЕЙ ВЕДОМОСТИ: %s — расхождения нет, а запись стоит\n' "$n_dead" >&2
  printf 'ведомость, пережившая дерево, — та же болезнь; уберите строки:\n' >&2
  while IFS='	' read -r kind fname lno; do
    printf '  %s\t%s:%s\n' "$kind" "$fname" "$lno" >&2
  done < "$TMP/мёртвые"
  printf '\n' >&2
fi

if [ "$bad" = 1 ]; then
  printf 'перепись: новых %s, мёртвых записей %s\n' "$n_new" "$n_dead" >&2
  exit 1
fi

printf 'перепись сошлась с ведомостью: %s расхождений, все названы с доводом\n' "$all_bad"
exit 0
