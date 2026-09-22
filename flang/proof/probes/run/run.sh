#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# ПРОБЫ ВЕРДИКТА ПРИ ЗАПУСКЕ (ADR-0045, задача 8222).
#
#   sh flang/proof/probes/run/run.sh            двоичным: flang run / flang io
#   sh flang/proof/probes/run/run.sh --зондом   толкованием исходников compiler.flang
#   RABOTA=<каталог> sh flang/proof/probes/run/run.sh --по-записям
#       сверить уже снятые записи зонда заново, не считая их второй раз: зонд
#       стоит десять минут и 12 ГиБ на программу, а сверка — секунды.
#
# Что сверяется — expected.tsv: для каждой programs код возврата и слово в
# выводе. Код 0 — сошлось всё; код 1 — хоть одна проба разошлась, и она названа
# строкой. Слово «не доказано» и код 3 у недоказанной programs без ключа —
# это и есть фальсификатор задачи: код 0 там — ячейка провалена.
#
# ── Два пути, и почему их два ───────────────────────────────────────────────
# Правки flang/self доезжают до двоичного только перепечаткой семени. До неё
# двоичный (0.7.19) на первом пути даёт прежнее поведение — недоказанное
# запускается кодом 0, — и прогон КРАСЕН по построению: это замер «до». Второй
# путь толкует исходники compiler.flang зондом `flang/self/bootstrap/zond-8222.flang`
# тем же двоичным: около десяти минут и 12 ГиБ на программу (образец — zond-k7,
# задача 9616), и это замер «после» без перепечатки. Зондов идёт не больше трёх
# разом (PARALLEL=N меняет), и запись каждого лежит в каталоге $RABOTA.
#
# Имена переменных латиницей: ни dash, ни bash не принимают кириллицу в именах
# (dash отвечает «Bad substitution» уже на ${ПАРАЛЛЕЛЬ:-3}; снято 17 сентября 2026).
set -u

KOREN=$(CDPATH= cd -- "$(dirname -- "$0")/../../../.." && pwd)
FLANG=${FLANG:-$KOREN/bootstrap/flang}
PROBY=$KOREN/flang/proof/probes/run
ZOND=$KOREN/flang/self/bootstrap/zond-8222.flang
PARALLEL=${PARALLEL:-3}
RABOTA=${RABOTA:-$(mktemp -d -p "${FLANG_TMP:-/srv/tmp}" proby-zapuska.XXXXXX)}
export LC_ALL=C.UTF-8

ZONDOM=0
PO_ZAPISYAM=0
[ "${1:-}" = "--зондом" ] && ZONDOM=1
[ "${1:-}" = "--по-записям" ] && { ZONDOM=1; PO_ZAPISYAM=1; }
[ -x "$FLANG" ] || { echo "нет двоичного: $FLANG" >&2; exit 2; }

# Одна проба двоичным: код и слово читаются с потока ошибок и вывода вместе.
proba_binary() { # программа путь ключ → печатает «код<TAB>вывод-в-одну-строку»
  f=$PROBY/programs/$1; kl=""
  [ "$3" = "1" ] && kl=--на-веру
  if [ "$2" = run ]; then
    out=$("$FLANG" run "$f" --function «Ответ» $kl 2>&1); k=$?
  else
    out=$("$FLANG" io "$f" --max-steps 1000000 $kl 2>&1); k=$?
  fi
  printf '%s\t%s\n' "$k" "$(printf '%s' "$out" | tr '\n' ' ')"
}

# Одна проба зондом: доводы зонду — JSON с текстом programs; ответ зонда —
# ОДНА строка-значение, внутри которой «\n» стоят буквами: «вердикт: …\nкод N\n
# запущено да/нет\nисход». Поэтому читается она через замену «\n» на перевод
# строки, а не построчно: `grep '^код '` по сырому файлу не находил ничего и все
# тринадцать проб выходили «код ?» (снято 18 сентября 2026).
proba_zond() { # программа путь ключ → файл записи
  f=$PROBY/programs/$1; zap=$RABOTA/$1.$2.$3.txt
  fn='«Проба запуска»'; [ "$2" = io ] && fn='«Проба плана»'
  args=$(python3 -c '
import json,sys
p,f,k=sys.argv[1],sys.argv[2],sys.argv[3]
print(json.dumps({"путь": p, "текст": open(f, encoding="utf-8").read(), "имя": "Ответ" if p.find("план")<0 else "", "на веру": k=="1"}, ensure_ascii=False))' "$1" "$f" "$3")
  { /usr/bin/time -f 'зонд: %es, пик %M КБ, код %x' "$FLANG" run "$ZOND" --function "$fn" --max-steps 2000000000 --args "$args"; } > "$zap" 2>&1
  echo "$zap"
}

BAD=0; N=0; JOBS=0
awk -F'\t' '!/^#/ && $1 != "программа" && NF >= 5' "$PROBY/expected.tsv" > "$RABOTA/ожидание.tsv"

if [ "$ZONDOM" -eq 1 ]; then
  # Сначала все зонды (не больше PARALLEL разом), потом сверка записей.
  while IFS="$(printf '\t')" read -r prog put kl kod slovo; do
    [ "$PO_ZAPISYAM" -eq 1 ] && [ -s "$RABOTA/$prog.$put.$kl.txt" ] && continue
    proba_zond "$prog" "$put" "$kl" >/dev/null &
    JOBS=$((JOBS+1))
    if [ "$JOBS" -ge "$PARALLEL" ]; then wait; JOBS=0; fi
  done < "$RABOTA/ожидание.tsv"
  wait
fi

while IFS="$(printf '\t')" read -r prog put kl kod slovo; do
  N=$((N+1))
  if [ "$ZONDOM" -eq 1 ]; then
    zap=$RABOTA/$prog.$put.$kl.txt
    # Код и запуск читаются из ответа зонда, а не из кода выхода двоичного:
    # двоичный вернул значение зонда кодом 0 — толкование удалось.
    k=$(sed 's/\\n/\n/g' "$zap" | grep -a -m1 '^код ' | awk '{print $2}')
    out=$(sed 's/\\n/\n/g' "$zap" | tr '\n' ' ')
    [ -n "$k" ] || k="?"
  else
    set -- $(proba_binary "$prog" "$put" "$kl" | { IFS="$(printf '\t')" read -r a b; printf '%s\n' "$a"; printf '%s\n' "$b"; })
    k=$1; shift; out=$*
  fi
  # lie.flang с ключом запускается и на 0.7.19 честно даёт FLANG_PROPERTY на NaN? Нет:
  # «Квадрат» от 7 даёт 49, постусловие верно на этом входе — вычисление удаётся.
  if [ "$k" = "$kod" ] && printf '%s' "$out" | grep -q -a -F -- "$slovo"; then
    printf '✓ %-22s %-3s ключ=%s код %s, есть «%s»\n' "$prog" "$put" "$kl" "$k" "$slovo"
  else
    printf '✗ %-22s %-3s ключ=%s ждали код %s и «%s», вышло код %s: %s\n' "$prog" "$put" "$kl" "$kod" "$slovo" "$k" "$(printf '%s' "$out" | cut -c1-200)"
    BAD=$((BAD+1))
  fi
done < "$RABOTA/ожидание.tsv"

if [ "$BAD" -eq 0 ]; then
  echo "сошлось всё: проб $N, разошлось 0 (путь: $([ "$ZONDOM" -eq 1 ] && echo зондом || echo двоичным), записи: $RABOTA)"
  exit 0
fi
echo "НЕ СОШЛОСЬ: проб $N, разошлось $BAD (путь: $([ "$ZONDOM" -eq 1 ] && echo зондом || echo двоичным), записи: $RABOTA)"
exit 1
