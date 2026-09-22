#!/bin/sh
# Сверка правил вывода flang ядром Lean 4 — и сверщика с моделью.
#
# Гонит пять вещей и печатает ЧИСЛА:
#   1) собираются ли файлы по порядку импорта: Модель → Правила → Терм →
#      Запись → Приёмка → Состоятельность → RecordReader → VerdictCheck; сообщение Lean
#      (предупреждение, `sorry`) на любом из них — «не сошлось»;
#   2) на каких аксиомах стоит теорема «состоятельность» (`#print axioms`):
#      допускаются только три стандартные — propext, Classical.choice,
#      Quot.sound;
#   3) отвергает ли Lean КАЖДОЕ из нарочно испорченных правил в «Trap.lean»
#      — каждое подаётся отдельным файлом, чтобы отказ был именно на нём;
#   4) у какой строки перечня есть лемма, а у какой нет — поимённо;
#   5) сверка вердиктов C ↔ Lean (ADR-0041 §2.2). Весь набор проб сверщика
#      (`checker/tests/run.sh`) гоняется через обёртку, которая сохраняет
#      каждый вызов: исходник, запись, код, вывод. Каждое утверждение с блоком
#      «вывод», который сверщик проигрывает, читает `RecordReader.lean` и судит
#      «принят?» (`VerdictCheck.lean`); вердикт по блоку сличается с вердиктом
#      сверщика. Расхождение печатается красным и роняет прогон кодом 1.
#
# Lean в дереве не лежит и не должен. Путь к нему берётся из переменной LEAN
# либо из PATH; версия — в `lean-toolchain` рядом. Без Lean прогон честно
# говорит, что ничего не проверил.
set -u

KAT=$(cd "$(dirname "$0")" && pwd)
VED="$KAT/../tables/inference-rules.tsv"
CHEK="$KAT/../checker"
RAB=${FLANG_TMP:-/tmp}/lean-sverka.$$
LEAN=${LEAN:-lean}

if ! command -v "$LEAN" >/dev/null 2>&1; then
  echo "Lean не найден: ни в переменной LEAN, ни в PATH."
  echo "НИЧЕГО НЕ ПРОВЕРЕНО. Поставить: elan toolchain install stable."
  exit 2
fi

mkdir -p "$RAB" || exit 1
trap 'rm -rf "$RAB"' EXIT INT TERM
if [ -t 1 ]; then KRAS=$(printf '\033[31m'); SBROS=$(printf '\033[0m'); else KRAS=; SBROS=; fi
PLOHO=0

echo "Lean: $("$LEAN" --version)"
echo

# ── 1. сборка по порядку импорта ────────────────────────────────────────────
LEAN_PATH="$RAB"; export LEAN_PATH
for f in Модель Правила Терм Запись Приёмка Состоятельность RecordReader VerdictCheck; do
  if ! (cd "$KAT" && "$LEAN" -o "$RAB/$f.olean" "$f.lean") > "$RAB/$f.out" 2>&1; then
    echo "${KRAS}$f.lean НЕ СОБРАЛСЯ:${SBROS}"; cat "$RAB/$f.out"; exit 1
  fi
  if [ -s "$RAB/$f.out" ]; then
    echo "${KRAS}$f.lean собрался, но Lean не молчит:${SBROS}"; cat "$RAB/$f.out"; PLOHO=1
  fi
done
echo "сборка — Модель, Правила, Терм, Запись, Приёмка, Состоятельность, RecordReader, VerdictCheck: без сообщений"

# ── 2. аксиомы теоремы ──────────────────────────────────────────────────────
printf 'import «Состоятельность»\n#print axioms «состоятельность»\n' > "$RAB/аксиомы.lean"
(cd "$RAB" && "$LEAN" аксиомы.lean) > "$RAB/a.out" 2>&1
AKS=$(tr '\n' ' ' < "$RAB/a.out" | sed -n 's/.*depends on axioms: \[\([^]]*\)\].*/\1/p')
if grep -q 'does not depend on any axioms' "$RAB/a.out"; then AKS=; fi
if [ -z "$AKS" ] && ! grep -q 'does not depend on any axioms' "$RAB/a.out"; then
  echo "${KRAS}аксиомы — вывод Lean не разобран:${SBROS}"; cat "$RAB/a.out"; PLOHO=1
else
  LISHNIE=$(printf '%s\n' "$AKS" | tr ',' '\n' | sed 's/^ *//;s/ *$//' \
    | grep -v -x -e propext -e Classical.choice -e Quot.sound -e '' | tr '\n' ' ')
  if [ -n "$LISHNIE" ]; then
    echo "${KRAS}аксиомы «состоятельность» — лишние: $LISHNIE${SBROS}"; PLOHO=1
  else
    echo "аксиомы «состоятельность» — [${AKS}], сверх трёх стандартных ни одной"
  fi
fi

# ── 3. ловушка: каждое искажение отдельным файлом ───────────────────────────
awk -v rab="$RAB" 'BEGIN{n=0}
     /ИСКАЖЕНИЕ/{n++}
     {if (n==0) print > (rab "/шапка.lean"); else print > (rab "/иск" n ".lean")}' \
  "$KAT/Trap.lean"

VSEGO=0; OTVERGNUTO=0
for f in "$RAB"/иск*.lean; do
  [ -f "$f" ] || continue
  VSEGO=$((VSEGO+1))
  cat "$RAB/шапка.lean" "$f" > "$RAB/проба.lean"
  if (cd "$RAB" && "$LEAN" проба.lean) > "$RAB/l.out" 2>&1; then
    echo "  ${KRAS}ЛОВУШКА НЕ СРАБОТАЛА: Lean ПРИНЯЛ искажение из $(basename "$f")${SBROS}"
  else
    OTVERGNUTO=$((OTVERGNUTO+1))
  fi
done
echo "ловушка — искажений $VSEGO, Lean отверг $OTVERGNUTO"
[ "$OTVERGNUTO" -eq "$VSEGO" ] && [ "$VSEGO" -gt 0 ] || PLOHO=1

# ── 4. пары «строка перечня ↔ лемма» ──────────────────────────────────────
# У правила лемма зовётся его именем («Н1») либо именем с приставкой через
# дефис («В2-добавить»); у запрета — встречным примером: Н✗ → «Н-запрет»,
# О✗✗ → «О-запрет2», С✗3 → «С-запрет3». Строка без пары называется по имени.
# Леммы ищутся в «Rules.lean» и в «Term.lean»: правило о ЗАПИСИ терма (Т2 —
# переименование связанного имени) модель значений выразить не может, его лемма
# «Т2-терм» говорит о синтаксисе и живёт там, где синтаксис есть.
cat "$KAT/Rules.lean" "$KAT/Term.lean" > "$RAB/леммы.lean"
PARY=$(awk -F'\t' '
  FNR == NR { if ($0 ~ /^theorem «/) { split($0, a, "«"); split(a[2], b, "»"); L[b[1]] = 1 } next }
  NF > 11 && $1 !~ /^#/ {
    r = $1; s++; ok = 0
    if (index(r, "✗")) {
      k = r; if (!sub(/✗✗✗$/, "-запрет3", k)) if (!sub(/✗✗$/, "-запрет2", k)) sub(/✗/, "-запрет", k)
      ok = (k in L)
    } else if (r in L) ok = 1
    else for (x in L) if (index(x, r "-") == 1) { ok = 1; break }
    if (ok) e++; else net = net (net != "" ? ", " : "") r
  }
  END { printf "%d\t%d\t%s\n", s, e, net }' "$RAB/леммы.lean" "$VED")
STROK=$(printf '%s\n' "$PARY" | cut -f1)
SPAROJ=$(printf '%s\n' "$PARY" | cut -f2)
BEZ=$(printf '%s\n' "$PARY" | cut -f3)
LEMM=$(grep -c '^theorem «' "$KAT/Rules.lean")
echo "перечень — строк $STROK, из них с леммой $SPAROJ, без леммы $((STROK - SPAROJ))${BEZ:+: $BEZ}"
echo "правила    — лемм в файле $LEMM"

# ── 5. сверка вердиктов C ↔ Lean ────────────────────────────────────────────
echo
if ! ${CC:-cc} -std=c99 -O2 -o "$RAB/сверщик" "$CHEK/checker.c" 2> "$RAB/cc.out"; then
  echo "${KRAS}сверка вердиктов НЕ ПРОВЕДЕНА: сверщик не собрался${SBROS}"; cat "$RAB/cc.out"; exit 1
fi
# Обёртка кладёт каждый вызов в свой каталог: доводы по строке, копии файлов-
# доводов (подделки набор порождает и стирает сам), код и вывод сверщика.
cat > "$RAB/обёртка.sh" <<'OB'
#!/bin/sh
d=$(mktemp -d "$SBOR/в.XXXXXX")
i=0
for a in "$@"; do
  i=$((i+1)); printf '%s\n' "$a" >> "$d/доводы"
  [ -f "$a" ] && cp "$a" "$d/арг$i"
done
"$REAL" "$@" >"$d/inference" 2>"$d/ошибки"; k=$?
echo "$k" > "$d/код"
cat "$d/inference"; cat "$d/ошибки" >&2
exit $k
OB
chmod +x "$RAB/обёртка.sh"
SBOR="$RAB/сбор"; mkdir -p "$SBOR"
( export SBOR; REAL="$RAB/сверщик" SVERSCHIK="$RAB/обёртка.sh" FLANG_TMP="$RAB" \
  sh "$CHEK/tests/run.sh" ) > "$RAB/tests.out" 2>&1
KPROB=$?
NABOR=$(sed -n 's/^ *\(подделок [0-9]*\):.*/\1/p; s/^ *\(честных *[0-9]*\):.*/\1/p' "$RAB/tests.out" | tr -s ' ' | paste -sd, - | sed 's/,/, /')
VYZ=$(ls "$SBOR" | wc -l | tr -d ' ')
if [ "$KPROB" -eq 0 ]; then SVOD="сошлось всё"; else SVOD="${KRAS}НЕ СОШЛОСЬ (код $KPROB)${SBROS}"; PLOHO=1; fi
echo "набор проб сверщика — ${NABOR:-?}; вызовов сверщика $VYZ; сам набор: $SVOD"

# Пары «исходник + запись» с блоком вывода, без повторов.
: > "$RAB/список"; : > "$RAB/ключи"
for d in "$SBOR"/в.*; do
  [ -f "$d/доводы" ] || continue
  set -- $(awk '!/^--/{n++; if (n<=2) printf "%d ", NR}' "$d/доводы")
  [ $# -eq 2 ] || continue
  i="$d/арг$1"; z="$d/арг$2"
  [ -f "$i" ] && [ -f "$z" ] || continue
  grep -q '^ *вывод ' "$z" || continue
  k=$(cat "$i" "$z" | cksum | tr ' ' _)
  grep -qx "$k" "$RAB/ключи" && continue
  echo "$k" >> "$RAB/ключи"
  printf '%s\t%s\t%s\n' "$d" "$i" "$z" >> "$RAB/список"
done
PAR=$(wc -l < "$RAB/список" | tr -d ' ')
if [ "$PAR" -eq 0 ]; then
  echo "${KRAS}сверка вердиктов НЕ ПРОВЕДЕНА: ни одной пары с блоком вывода${SBROS}"; exit 1
fi
if ! (cd "$KAT" && "$LEAN" --run VerdictCheck.lean "$RAB/список") > "$RAB/lean.tsv" 2> "$RAB/lean.err"; then
  echo "${KRAS}сверка вердиктов НЕ ПРОВЕДЕНА: VerdictCheck.lean упала${SBROS}"; cat "$RAB/lean.err"; exit 1
fi
# Вердикт сверщика по блоку: «утверждение «И», вывод: …» в его выводе — отверг;
# иначе принял. Код записи рядом: 1 при молчании о блоке значит, что запись
# отвергнута по другой причине, и это число печатается отдельно.
cut -f1 "$RAB/lean.tsv" | sort -u | while read -r d; do
  cat "$d/inference" "$d/ошибки" | grep -o 'утверждение «[^»]*», вывод:' \
    | sed 's/^утверждение «\(.*\)», вывод:$/\1/' | sort -u | sed "s|^|$d	|"
done > "$RAB/c-отверг.tsv"

awk -F'\t' -v kras="$KRAS" -v sbros="$SBROS" -v par="$PAR" '
  FNR==NR { o[$1 "\t" $2] = 1; next }
  {
    d = $1; c = ((d "\t" $2) in o || ($3 != "" && (d "\t" $3) in o)) ? "отверг" : "принял"
    if (!(d in kod)) { f = d "/код"; getline kod[d] < f; close(f) }
    bl++
    if ($4 == "ПРИНЯЛ" && c == "принял") { pp++; if (kod[d] == 1) pp1++ }
    else if ($4 == "ОТВЕРГ" && c == "отверг") oo++
    else if ($4 == "НЕ ПРОЧЁЛ" && c == "отверг") no++
    else if ($4 == "ВНЕ") { if (c == "принял") vp++; else vo++; pr[$5]++ }
    else {
      ras++
      f = d "/доводы"; n = 0; zap = "?"
      while ((getline s < f) > 0) if (s !~ /^--/ && ++n == 2) zap = s
      close(f)
      sub(/.*\/flang\/proof\//, "", zap)
      r[ras] = sprintf("  %sРАСХОЖДЕНИЕ%s: %s «%s» — сверщик %s, Lean %s%s", kras, sbros, zap, $2, c, $4, ($5 != "" ? " (" $5 ")" : ""))
    }
  }
  END {
    printf "сверка вердиктов — пар «исходник + запись» с блоком вывода %d, блоков, которые сверщик проигрывает, %d\n", par, bl
    printf "  сверщик принял, Lean принял (цель следует по теореме): %d", pp
    if (pp1) printf " (из них %d — в записях, отвергнутых сверщиком по другой причине)", pp1
    printf "\n  сверщик отверг, Lean отверг: %d\n", oo
    printf "  сверщик отверг, Lean не прочёл блок: %d\n", no
    n = 0; for (k in pr) { key[++n] = k }
    for (i = 1; i <= n; i++) for (j = i + 1; j <= n; j++)
      if (pr[key[j]] > pr[key[i]] || (pr[key[j]] == pr[key[i]] && key[j] < key[i])) { t = key[i]; key[i] = key[j]; key[j] = t }
    s = ""; for (i = 1; i <= n; i++) s = s (i > 1 ? ", " : "") key[i] " " pr[key[i]]
    printf "  вне приёмки Lean (первый непринятый шаг — правило, которого в Acceptance.lean нет): сверщик принял %d, отверг %d\n", vp, vo
    if (n) printf "    правила: %s\n", s
    for (i = 1; i <= ras; i++) print r[i]
    printf "  расхождений: %d\n", ras
    exit (ras > 0)
  }' "$RAB/c-отверг.tsv" "$RAB/lean.tsv"
[ $? -eq 0 ] || PLOHO=1

# Отрицательный контроль молчания. «Сверщик о блоке промолчал» читается как
# «принял» и в записях, которые он отверг по другой причине. Верно ли это —
# проверяется порчей: у такого блока первый шаг получает имя правила, которого
# нет, и сверщик обязан назвать именно этот блок.
awk -F'\t' 'FNR==NR { o[$1 "\t" $2] = 1; next }
  !(($1 "\t" $2) in o) && $4 == "ПРИНЯЛ" { print $1 "\t" $2 "\t" $3 }' "$RAB/c-отверг.tsv" "$RAB/lean.tsv" \
  | while IFS='	' read -r d n t; do [ "$(cat "$d/код")" = 1 ] && printf '%s\t%s\t%s\n' "$d" "$n" "$t"; done \
  | awk -F'\t' '!s[$1]++' | head -5 > "$RAB/контроль.tsv"
KV=0; KP=0
while IFS='	' read -r d n t; do
  KV=$((KV+1))
  i=$(awk -F'\t' -v d="$d" '$1 == d { print $2 }' "$RAB/список")
  z=$(awk -F'\t' -v d="$d" '$1 == d { print $3 }' "$RAB/список")
  awk -v n="$n" '/^утверждение «/ { v = (index($0, "утверждение «" n "»") == 1) }
    v && /^ *вывод 1 / && !g { sub(/вывод 1 [^ ]+ /, "вывод 1 Н✗ "); g = 1 } { print }' "$z" > "$RAB/corrupt.запись"
  "$RAB/сверщик" "$i" "$RAB/corrupt.запись" 2>&1 \
    | grep -qF -e "утверждение «$n», вывод:" -e "утверждение «$t», вывод:" && KP=$((KP+1))
done < "$RAB/контроль.tsv"
if [ "$KV" -eq 0 ]; then
  echo "  контроль молчания — не на чем: блоков, принятых обоими в отвергнутых записях, нет"
elif [ "$KP" -eq "$KV" ]; then
  echo "  контроль молчания — испорчен молчавший блок в $KV отвергнутых записях, сверщик назвал его $KP из $KV"
else
  echo "  ${KRAS}контроль молчания — испорчен молчавший блок в $KV записях, сверщик назвал его лишь $KP раз${SBROS}"; PLOHO=1
fi

echo
if [ "$PLOHO" -eq 0 ]; then
  echo "сошлось всё"
  exit 0
fi
echo "${KRAS}НЕ СОШЛОСЬ${SBROS}"
exit 1
