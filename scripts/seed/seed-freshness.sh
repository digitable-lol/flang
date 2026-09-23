#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# Отказ судить о доказательствах, пока семя отстало от исходников или двоичный
# не собирается из семени. Порядок: двоичный (binary-origin.sh) → тело семени
# (bootstrap-reprint.sh --telo, ключа обхода нет) → ключ обхода → входы печати (--bystro).
#
# Как звать:
#   sh scripts/seed/seed-freshness.sh                     только ответить
#   sh scripts/seed/seed-freshness.sh --chto "<имя>" ...  назвать, кто спрашивает
#   sh scripts/seed/seed-freshness.sh -- <команда…>       отказать или запустить
#   Обход (вслух): SEMYA_OTSTALO_ZNAYU=1 — только сверка семени с исходниками;
#   сверку двоичного снимает свой ключ FLANG_BINARY_UNKNOWN_OK, одним обе нельзя.
#
# Коды: 0 — семя отвечает исходникам, двоичный семени (или ключ обхода);
#       1 — отстало либо двоичный чужой, судить отказано; 3 — сверить не удалось.
# см. docs/zettel/a-proof-ledger-taken-with-a-stale-seed-shows-a-tree-that-does-not-exist.md
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
BYPASS=SEMYA_OTSTALO_ZNAYU
FAST="sh scripts/bootstrap-reprint.sh --bystro"

err() { printf '%s\n' "$*" >&2; }

what="эта проверка"
while [ $# -gt 0 ]; do
  case $1 in
    --chto) [ $# -ge 2 ] || { err "--chto без имени"; exit 3; }; what=$2; shift 2 ;;
    --) shift; break ;;
    -*) err "неизвестный довод: $1"; exit 3 ;;
    *) break ;;
  esac
done

skolko_faylov() { printf '%s\n' "$1" | grep -c 'перепечатки$' || true; }

fajlov() {
  case $1 in
    *1[1-4]) printf 'файлов' ;;
    *1) printf 'файл' ;;
    *[2-4]) printf 'файла' ;;
    *) printf 'файлов' ;;
  esac
}

# ── Двоичный обязан собираться из семени, лежащего рядом ─────────────────────
ORIGIN=$ROOT/scripts/seed/binary-origin.sh
if [ -f "$ORIGIN" ]; then
  sh "$ORIGIN" --чем "$what" || exit $?
fi

# ── Тело семени: спрашивается ДО ключа обхода, и ключом не глушится ─────────
TELO="sh scripts/bootstrap-reprint.sh --telo"
rc=0
telo_out=$(cd "$ROOT" && $TELO 2>&1) || rc=$?
if [ "$rc" != 0 ]; then
  err "ОТКАЗЫВАЮСЬ СУДИТЬ О ДОКАЗАТЕЛЬСТВАХ: $what"
  err ""
  err "Дело не в отставании: разошлось ТЕЛО СЕМЕНИ — то, из чего собран двоичный,"
  err "которым эта проверка и судит. Ключа обхода здесь нет."
  err ""
  printf '%s\n' "$telo_out" >&2
  exit 1
fi

# ── Обход по ключу: разрешаем, но вслух ──────────────────────────────────────
if [ -n "${SEMYA_OTSTALO_ZNAYU:-}" ]; then
  err "$BYPASS: судим при отставшем семени по прямому указанию."
  err "Ответ этой проверки — про дерево, собранное из СТАРОГО семени."
  if [ $# -gt 0 ]; then exec "$@"; fi
  exit 0
fi

# ── Сверка входов печати. Стоит полсекунды и двоичного не зовёт ─────────────
rc=0
out=$(cd "$ROOT" && $FAST 2>&1) || rc=$?
if [ "$rc" = 0 ]; then
  if [ $# -gt 0 ]; then exec "$@"; fi
  exit 0
fi

n=$(skolko_faylov "$out")

if [ "$n" = 0 ]; then
  err "СЕМЯ СВЕРИТЬ НЕ УДАЛОСЬ — судить о доказательствах нельзя: $what"
  err ""
  printf '%s\n' "$out" >&2
  err ""
  err "Сверка входов печати ответила кодом $rc и ни одного расхождения не назвала."
  err "Судить всё равно: $BYPASS=1 <та же команда>"
  exit 3
fi

err "ОТКАЗЫВАЮСЬ СУДИТЬ О ДОКАЗАТЕЛЬСТВАХ: $what"
err ""
err "семя отстало от исходников на $n $(fajlov "$n"), ведомость показывает состояние,"
err "которого нет; перепечатайте \`sh scripts/bootstrap-reprint.sh\`"
err ""
err "Двоичный собран из семени и знает СТАРЫЕ правила. Его зелёный ответ — про"
err "дерево, которого в этой копии нет: правка есть в исходнике и отсутствует в"
err "семени. Ровно так 21–22 августа 2026 трижды за сутки лежали в стволе"
err "неработающими правило ядра, четвёртый вердикт и два поручения ввода-вывода."
err ""
err "Что разошлось (весь список — \`$FAST\`):"
printf '%s\n' "$out" | grep '^  • ' | head -8 >&2
if [ "$n" -gt 8 ]; then err "  …и ещё $((n - 8))"; fi
err ""
err "Перепечатка стоит 8 ч 34 мин одного ядра (docs/reprint-ledger.tsv), и это"
err "не то, что делают между делом. Знаешь про отставание и берёшь ответ на"
err "себя — скажи это вслух:"
err ""
err "  $BYPASS=1 <та же команда>"
exit 1
