#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# ЧЕМ И НА ЧЁМ СНЯТ ОТЧЁТ — шапка провенанса, одна на все отчёты о доказуемости.
#
#   sh scripts/report-provenance.sh
#
# ── Зачем ───────────────────────────────────────────────────────────────────
# Отчёты печатали ЧИСЛА и молчали о том, на чём эти числа сняты. «650 из 650 =
# 100 %» одинаково выглядит на чистом дереве и на дереве с правками в рабочей
# копии; «ДОКАЗУЕМ» одинаково выглядит при собранном двоичном и при отсутствии
# двоичного вовсе. Число без провенанса нельзя ни повторить, ни опровергнуть —
# его можно только процитировать, и оно начинает жить отдельно от дерева.
#
# Пункт 11 внешнего аудита сказал это прямо: «Привяжи отчёты к SHA исходников,
# семени, зависимостям и версии семантики».
#
# ── Что печатается и почему именно это ──────────────────────────────────────
#   дата              день замера: число устаревает молча, дата — нет;
#   SHA дерева        коммит И чистота рабочей копии: замер на правленом дереве
#                     не повторяется по одному коммиту, и об этом надо сказать;
#   SHA семени        отпечаток входов печати (scripts/otpechatok-semeni) и
#                     коммит, с которого печать снята: семя — не дерево, оно
#                     отстаёт от исходников на перепечатку;
#   входы сборки      sha256 всех bootstrap/*.c, *.h, Makefile — то, из чего
#                     собран двоичный, независимо от того, кто его собрал;
#   двоичный          версия, sha256 и СВЕЖЕСТЬ относительно семени. Строка
#                     «НЕТ В ДЕРЕВЕ» здесь — не украшение: отчёты о доказуемости
#                     умеют печатать вердикт, ни разу не позвав двоичный, и
#                     читатель обязан это видеть в самом отчёте;
#   сверщик           sha256 исходника независимого проверяющего: вердикт —
#                     его, и подмена проверяющего меняет смысл всех чисел;
#   версия семантики  отпечаток ведомости правил вывода: это и есть версия
#                     набора правил, по которым слово «доказано» вообще
#                     что-то значит;
#   Lean              версия второго, чужого судьи — из PATH, если он есть,
#                     иначе из lean-toolchain со словом «здесь не гонялся».
#
# Имена переменных латиницей: ни dash, ни bash не принимают кириллицу в именах.
set -u

KOREN=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$KOREN" || exit 2

sha() { sha256sum "$1" 2>/dev/null | cut -d' ' -f1; }
korotko() { printf '%.12s…' "$1"; }

# ── дерево ──────────────────────────────────────────────────────────────────
DATA=$(date +%F)
if SHA_DEREVA=$(git rev-parse HEAD 2>/dev/null); then
  GRYAZNO=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  if [ "$GRYAZNO" = 0 ]; then CHISTOTA="рабочая копия чиста"
  else CHISTOTA="РАБОЧАЯ КОПИЯ ПРАВЛЕНА: файлов $GRYAZNO — замер по одному коммиту не повторится"; fi
else
  SHA_DEREVA="—"; CHISTOTA="дерево не под учётом git"
fi

# ── семя ────────────────────────────────────────────────────────────────────
OTP=scripts/otpechatok-semeni
if [ -f "$OTP" ]; then
  SHA_SEMENI=$(sha "$OTP")
  KOMMIT_PECHATI=$(sed -n 's/^коммит //p' "$OTP" | head -1)
  VHOD_PECHATI=$(sed -n 's/^вход //p' "$OTP" | head -1)
else
  SHA_SEMENI="—"; KOMMIT_PECHATI="—"; VHOD_PECHATI="—"
fi

# Тот же расчёт, что у flang/proof/corpus-share.sh:otpechatok_semeni и у ключа
# кеша CI: имена под LC_ALL=C sort, чтобы отпечаток не зависел от машины.
VHODY_SBORKI=$( ( cd bootstrap 2>/dev/null && /bin/ls *.c *.h Makefile 2>/dev/null \
  | LC_ALL=C sort | xargs cat ) 2>/dev/null | sha256sum 2>/dev/null | cut -d' ' -f1 )
[ -n "$VHODY_SBORKI" ] || VHODY_SBORKI="—"

# ── двоичный ────────────────────────────────────────────────────────────────
OTPECHATOK_PRI=bootstrap/flang.seed-sha256
if [ -x bootstrap/flang ]; then
  VERSIYA=$(./bootstrap/flang --version 2>/dev/null | head -1)
  [ -n "$VERSIYA" ] || VERSIYA="версии не назвал"
  SHA_DVOICH=$(sha bootstrap/flang)
  if [ -f "$OTPECHATOK_PRI" ] && [ "$(sed -n 's/^двоичный //p' "$OTPECHATOK_PRI")" = "$SHA_DVOICH" ]; then
    if [ "$(sed -n 's/^семя //p' "$OTPECHATOK_PRI")" = "$VHODY_SBORKI" ]; then
      SVEZHEST="собран из нынешнего семени (по отпечатку $OTPECHATOK_PRI)"
    else
      SVEZHEST="ОТСТАЛ ОТ СЕМЕНИ: собран не из нынешних bootstrap/*.c — пересобрать: make -C bootstrap"
    fi
  else
    SVEZHEST="отпечатка при этом двоичном нет — свежесть НЕ ПРОВЕРЕНА (записать: sh flang/proof/corpus-share.sh --отпечаток)"
  fi
  DVOICHNYY="$VERSIYA (bootstrap/flang), sha256 $(korotko "$SHA_DVOICH"), $SVEZHEST"
else
  DVOICHNYY="НЕТ В ДЕРЕВЕ — ни одно число этого отчёта не снято собранным двоичным"
fi

# ── сверщик и версия семантики ──────────────────────────────────────────────
SVERSCHIK_C=flang/proof/checker/checker.c
if [ -f "$SVERSCHIK_C" ]; then SHA_SVER=$(sha "$SVERSCHIK_C"); else SHA_SVER="—"; fi

VED=flang/proof/tables/inference-rules.tsv
OTP_VED=flang/proof/tables/inference-rules.digest
if [ -f "$VED" ] && [ -f "$OTP_VED" ]; then
  SHA_VED=$(sha "$VED")
  ZAPISANO_VED=$(head -1 "$OTP_VED" | tr -d ' \t\r\n')
  if [ "$SHA_VED" = "$ZAPISANO_VED" ]; then SEM_SLOVO="ведомость сходится с отпечатком"
  else SEM_SLOVO="ВЕДОМОСТЬ РАЗОШЛАСЬ С ОТПЕЧАТКОМ — версия семантики не та, что объявлена"; fi
  SEMANTIKA="$(korotko "$ZAPISANO_VED") ($OTP_VED; $SEM_SLOVO)"
else
  SEMANTIKA="— (нет $OTP_VED)"
fi

# ── Lean ────────────────────────────────────────────────────────────────────
TOOLCHAIN=flang/proof/lean/lean-toolchain
LEAN=${LEAN:-lean}
if command -v "$LEAN" >/dev/null 2>&1; then
  LEAN_SLOVO="$("$LEAN" --version 2>/dev/null | head -1) (в PATH)"
else
  if [ -f "$TOOLCHAIN" ]; then ZHDEM=$(tr -d ' \t\r\n' < "$TOOLCHAIN"); else ZHDEM="—"; fi
  LEAN_SLOVO="$ZHDEM по $TOOLCHAIN; в PATH НЕТ — здесь не гонялся"
fi

# ── печать ──────────────────────────────────────────────────────────────────
echo "── чем и на чём снято ──"
printf 'дата               %s\n' "$DATA"
printf 'SHA дерева         %s (%s)\n' "$SHA_DEREVA" "$CHISTOTA"
printf 'SHA семени         %s (%s; печать входа %s с коммита %s)\n' \
  "$(korotko "$SHA_SEMENI")" "$OTP" "$VHOD_PECHATI" "$(korotko "$KOMMIT_PECHATI")"
printf 'входы сборки       %s (sha256 bootstrap/*.c, *.h, Makefile)\n' "$(korotko "$VHODY_SBORKI")"
printf 'двоичный           %s\n' "$DVOICHNYY"
printf 'сверщик            %s sha256 %s\n' "$SVERSCHIK_C" "$(korotko "$SHA_SVER")"
printf 'версия семантики   %s\n' "$SEMANTIKA"
printf 'Lean               %s\n' "$LEAN_SLOVO"
echo
exit 0
