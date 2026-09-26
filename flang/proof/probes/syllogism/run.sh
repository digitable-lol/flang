#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# ПРОБЫ СИЛЛОГИЗМА (ADR-0047, задача 5309).
#
#   sh flang/proof/probes/syllogism/run.sh            двоичным: замер «до»
#   sh flang/proof/probes/syllogism/run.sh --печатью  компилятором, напечатанным
#                                                        в JavaScript: замер «после»
#   PECHAT=<каталог> sh … --печатью    взять уже напечатанный компилятор оттуда,
#                                      а не печатать заново (печать — 13 минут)
#
# Код 0 — сошлось всё; 1 — хоть одна проба разошлась, и она названа строкой;
# 2 — не смог измерить (нет двоичного, нет таблицы, нет node).
#
# ── ДВА ПУТИ, И ПОЧЕМУ ИХ ДВА ───────────────────────────────────────────────
# Слово поверхности `следует` живёт в печатаемой части семени
# (`flang/self/lexer.flang`, `flang/self/parser.flang`), и там же живёт починка
# распаковки `таких что` (`flang/self/proofterm.flang`). Правка там доезжает до
# `bootstrap/flang` только полной перепечаткой. ПЕРЕПЕЧАТКА ПРОШЛА 25 сентября
# 2026 (выпуск 0.7.22): двоичный теперь знает и слово, и починку, и первый путь
# спрашивает у него ВЕРДИКТ, а не отказ разбора. Замер «до» кончился вместе с
# перепечаткой; чем он был и что показывал — в шапке expected.tsv.
#
# Второй путь ПЕЧАТАЕТ КОМПИЛЯТОР В JAVASCRIPT и спрашивает уже его. Теперь это
# не «замер после», а ВТОРОЙ СУДЬЯ: две реализации на одних программах обязаны
# отвечать одинаково, и таблица ждёт от них одних слов. Цена снята 20 сентября
# 2026 на машине `dev`: печать — 12 мин 50 с и 12,9 ГиБ один раз, 14,8 МБ JS;
# дальше каждая проба — СЕКУНДЫ. Способ и обе его ямы описаны заметкой
# docs/zettel/a-compiler-printed-to-javascript-runs-a-new-target-in-seconds.md.
#
# ── ПОЧЕМУ НЕ ЗОНДОМ, КАК У `пробы-запуска` ────────────────────────────────
# Пробовали, и это замер, а не мнение. Зонд ведомости
# (`flang/self/bootstrap/zond-k7.flang`, «Ведомость исходников», толкование
# исходников нынешним двоичным) на этих же программах НЕ ДОСЧИТАЛСЯ ЗА
# ОДИННАДЦАТЬ ЧАСОВ и был снят сигналом 15, пик 24,7 ГиБ — три программы разом,
# 19–20 сентября 2026. То есть путь дороже самой перепечатки, ради обхода
# которой он заведён. Дешёвая его половина жива: разбор без доказательств
# (`zond-5309.flang`, «Печать разбора исходника») — две минуты и 1 ГиБ, и
# именно ею снято сличение деревьев в ADR-0047.
#
# Имена переменных латиницей: ни dash, ни bash не принимают кириллицу в именах.
set -u

KOREN=$(CDPATH= cd -- "$(dirname -- "$0")/../../../.." && pwd)
FLANG=${FLANG:-$KOREN/bootstrap/flang}
PROBY=$KOREN/flang/proof/probes/syllogism
TABLICA=$PROBY/expected.tsv
export LC_ALL=C.UTF-8

PECHATYU=0
[ "${1:-}" = "--печатью" ] && PECHATYU=1
[ -x "$FLANG" ] || { echo "нет двоичного: $FLANG" >&2; exit 2; }
[ -f "$TABLICA" ] || { echo "нет таблицы: $TABLICA" >&2; exit 2; }

# Одна проба двоичным: код и вывод читаются вместе, вывод — в одну строку.
proba_binary() { # программа → печатает вывод одной строкой
  out=$("$FLANG" check "$PROBY/programs/$1" --proof 2>&1)
  printf '%s' "$out" | tr '\n' ' '
}

# Одна проба напечатанным компилятором. `следует` он знает, поэтому программа
# едет как есть; ответ — JSON, из него берутся слова ведомости либо первая беда.
proba_pechatyu() { # программа → печатает ответ одной строкой
  f=$PROBY/programs/$1
  python3 -c '
import json,sys
p,f=sys.argv[1],sys.argv[2]
ish={"r":[["путь",{"s":p}],["текст",{"s":open(f,encoding="utf-8").read()}]]}
print(json.dumps({"fn":"Ведомость исходников","args":[{"l":[ish]},{"s":p}],
                  "depth":"100000","steps":"2000000000"},ensure_ascii=False))' "$1" "$f" \
  | node "$PECHAT/flang_cli.js" "$PECHAT/compiler_flang.js" 2>&1 \
  | python3 -c '
import json,sys
syr=sys.stdin.read()
try: d=json.loads(syr)
except Exception: print(syr.replace("\n"," ")[:400]); raise SystemExit
if not d.get("ok"):
    print("ОТКАЗ ПРОГОНЩИКА "+str(d.get("code"))+": "+str(d.get("message"))[:300]); raise SystemExit
polya=dict(d["value"]["r"])
if polya["годно"]:
    print(polya["словами"]["s"].replace("\n"," "))
else:
    bedy=polya.get("диагностики",{}).get("l",[])
    kuski=[]
    for b in bedy:
        q=dict(b["r"]); kuski.append(q["код"]["s"]+": "+q["сообщение"]["s"])
    print(" | ".join(kuski) if kuski else "не годно, препятствие")'
}

BAD=0
VSEGO=0
say() { printf '%s\n' "$*"; }

if [ "$PECHATYU" = "1" ]; then
  command -v node > /dev/null 2>&1 || { echo "нет node — путь «--печатью» без него не считается" >&2; exit 2; }
  command -v python3 > /dev/null 2>&1 || { echo "нет python3" >&2; exit 2; }
  if [ -z "${PECHAT:-}" ]; then
    PECHAT=$(mktemp -d -p "${FLANG_TMP:-/srv/tmp}" pechat-sillogizma.XXXXXX)
    say "печатаю компилятор в JavaScript (около 13 минут, 13 ГиБ): $PECHAT"
    "$FLANG" emit "$KOREN/flang/self/bootstrap/compiler.flang" --target js --no-check \
      --max-steps 200000000 --out "$PECHAT" > "$PECHAT/печать.log" 2>&1 \
      || { echo "печать не удалась, см. $PECHAT/печать.log" >&2; exit 2; }
  fi
  export PECHAT
  [ -f "$PECHAT/compiler_flang.js" ] || { echo "в $PECHAT нет compiler_flang.js" >&2; exit 2; }
fi

say "таблица: $TABLICA"
say "путь: $([ "$PECHATYU" = "1" ] && echo "печатью ($PECHAT)" || echo 'двоичным (замер «до»)')"
say ""

while IFS="	" read -r prog slovo_bin slovo_posle; do
  case "$prog" in \#*|programma|программа|"") continue ;; esac
  VSEGO=$((VSEGO + 1))
  if [ "$PECHATYU" = "1" ]; then
    zhdyom=$slovo_posle
    vyvod=$(proba_pechatyu "$prog")
  else
    zhdyom=$slovo_bin
    vyvod=$(proba_binary "$prog")
  fi
  case "$vyvod" in
    *"$zhdyom"*) say "СОШЛОСЬ  $prog — «$zhdyom»" ;;
    *)           say "ПРОВАЛ   $prog — ждали «$zhdyom»"
                 say "         получили: $(printf '%s' "$vyvod" | cut -c1-260)"
                 BAD=$((BAD + 1)) ;;
  esac
done < "$TABLICA"

say ""
if [ "$BAD" -eq 0 ]; then
  say "сошлось всё: проб $VSEGO"
  exit 0
fi
say "разошлось $BAD из $VSEGO"
exit 1
