#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# Сверить две печати одного дерева побайтово (вопрос гейта Г6): тело семени —
# напечатанные исходники рантайма, список из обоих деревьев. Готовность печати
# спрашивается у её журнала (<каталог>/../*.log), а не у файлов.
#
# Как звать:
#   sh scripts/seed/two-prints-identical.sh <каталог-1> <каталог-2>
#   ZHURNAL_1=<журнал> ZHURNAL_2=<журнал> … — назвать журналы прямо, если их
#   рядом больше одного (прибор не гадает и не берёт самый свежий).
#
# Коды: 0 — совпали побайтово; 1 — разошлись, названы файлы и первое расхождение;
#       2 — звать не умеют; 3 — НЕ ПРОВЕРЕНО: печати нет, она не кончилась, журнал
#       спорит сам с собой или неясно, какой журнал чей.
# см. docs/zettel/two-logs-beside-a-print-tree-mean-unknown-not-take-the-newer.md
set -u

skazhi() { printf '%s\n' "$*"; }
beda()   { printf '%s\n' "$*" >&2; }

put_pryamoj() {
  pp_d=$(dirname "$1"); pp_b=$(basename "$1")
  pp_d=$(cd "$pp_d" 2>/dev/null && pwd -P) || pp_d=""
  [ -n "$pp_d" ] || { printf '%s\n' "$1"; return; }
  printf '%s/%s\n' "$pp_d" "$pp_b"
}

[ $# -eq 2 ] || { beda "звать: sh scripts/seed/two-prints-identical.sh <каталог-1> <каталог-2>"; exit 2; }
A=$1; B=$2
for d in "$A" "$B"; do
  [ -d "$d" ] || { beda "не каталог: $d"; exit 2; }
done

# $1 — корень дерева печати. $2 — журнал, названный руками, или пусто.
gotova() {
  ZH=""
  if [ -n "$2" ]; then
    [ -f "$2" ] || { NET="названный журнал не файл: $2"; return 1; }
    ZH=$2
  else
    SKOLKO=0
    for f in "$1"/../*.log; do
      [ -f "$f" ] || continue
      SKOLKO=$((SKOLKO + 1)); ZH=$f
    done
    [ "$SKOLKO" -ne 0 ] || { NET="журнала печати рядом с $1 нет (ждём $1/../*.log)"; return 1; }
    if [ "$SKOLKO" -gt 1 ]; then
      NET="рядом с $1 журналов $SKOLKO, и какой из них ЭТОЙ печати — неизвестно:$(
        for f in "$1"/../*.log; do [ -f "$f" ] && printf '\n      %s' "$f"; done)
    Брать самый свежий нельзя: так прибор уже прочёл отказ печати как успех
    (замер А1 2 сентября 2026, см. шапку). Назовите журналы прямо —
    ZHURNAL_1=… ZHURNAL_2=… — или дайте каждой печати свой родительский каталог."
      return 1
    fi
  fi
  ZH=$(put_pryamoj "$ZH")
  if LC_ALL=C.UTF-8 /usr/bin/grep -aq 'ПЕЧАТЬ КОД=[0-9]' "$ZH"; then
    OTKUDA='ПЕЧАТЬ КОД='
    K=$(LC_ALL=C.UTF-8 /usr/bin/grep -ao 'ПЕЧАТЬ КОД=[0-9][0-9]*' "$ZH" | tail -1 | sed 's/.*=//')
  elif LC_ALL=C.UTF-8 /usr/bin/grep -aq '^КОНЕЦ' "$ZH"; then
    OTKUDA='КОНЕЦ … код='
    K=$(LC_ALL=C.UTF-8 /usr/bin/grep -a '^КОНЕЦ' "$ZH" \
        | LC_ALL=C.UTF-8 /usr/bin/grep -ao 'код=[0-9][0-9]*' | tail -1 | sed 's/.*=//')
    [ -n "$K" ] || { NET="строка «КОНЕЦ» есть, а кода в ней нет: $ZH"; return 1; }
    VYHOD=$(LC_ALL=C.UTF-8 /usr/bin/grep -a 'Exit status:' "$ZH" | tail -1 \
            | sed 's/.*Exit status:[[:space:]]*//')
    if [ -n "$VYHOD" ] && [ "$VYHOD" != "$K" ]; then
      NET="журнал сам себе противоречит: «КОНЕЦ … код=$K» против «Exit status: $VYHOD» — $ZH
    Так соврал /srv/tmp/relizy/perepechatka-zahod1-ubita.log: код=0 на убитом
    прогоне. Пусть допишет «ПЕЧАТЬ КОД=<код>» тот, кто печать пустил."
      return 1
    fi
  else
    NET="конца печати в журнале НЕТ: $ZH
    ни «ПЕЧАТЬ КОД=<код>» (дописать обязан тот, кто пустил печать: для CI —
    работа .github/workflows/reprint.yml, для ручного прогона — оболочка
    запуска), ни «КОНЕЦ … код=<код>». Печать либо идёт, либо её оборвали,
    не закрыв журнал. Это НЕ «печати разошлись»."
    return 1
  fi
  [ -n "$K" ] || { NET="конец назван строкой «$OTKUDA», а кода в ней нет: $ZH"; return 1; }
  [ "$K" = 0 ] || { NET="печать кончилась НЕ УСПЕХОМ (код $K, по «$OTKUDA»): $ZH"; return 1; }
  return 0
}

ne_gotovy=""; NET=""; ZH=""; K=""; OTKUDA=""; VYHOD=""; SKOLKO=0
ZH_A=""; ZH_B=""; OTKUDA_A=""; OTKUDA_B=""
gotova "$A" "${ZHURNAL_1:-}" || ne_gotovy="$ne_gotovy
  $NET"
ZH_A=$ZH; OTKUDA_A=$OTKUDA
gotova "$B" "${ZHURNAL_2:-}" || ne_gotovy="$ne_gotovy
  $NET"
ZH_B=$ZH; OTKUDA_B=$OTKUDA
if [ -n "$ZH_A" ] && [ "$ZH_A" = "$ZH_B" ]; then
  skazhi "НЕ ПРОВЕРЕНО: обеим печатям достался ОДИН журнал — $ZH_A"
  skazhi "  Значит про одну из них не известно ничего. Назовите журналы прямо:"
  skazhi "  ZHURNAL_1=<журнал первой> ZHURNAL_2=<журнал второй> sh $0 $A $B"
  exit 3
fi
if [ -n "$ne_gotovy" ]; then
  skazhi "НЕ ПРОВЕРЕНО: печать ещё не кончилась или кончилась не успехом:$ne_gotovy"
  skazhi "Это НЕ «разошлись». Повторить, когда обе печати кончатся."
  exit 3
fi

# ── Сверка. Список файлов тела берётся из ОБОИХ деревьев: файл, появившийся
#    только с одной стороны, — тоже расхождение, и молчать о нём нельзя.
spisok() { (cd "$1/flang/src/emit/c" 2>/dev/null && ls -A) | sort; }
# Временное — в FLANG_TMP, как везде в дереве: /tmp здесь запрещён хуком.
SDIR=$(mktemp -d -p "${FLANG_TMP:-/srv/tmp}" dve-pechati.XXXXXX) || {
  beda "ПРОВЕРИТЬ НЕ УДАЛОСЬ: не создался каталог в ${FLANG_TMP:-/srv/tmp}"; exit 3; }
trap 'rm -rf "$SDIR"' EXIT INT TERM
spisok "$A" > "$SDIR/a" 2>/dev/null
spisok "$B" > "$SDIR/b" 2>/dev/null

if ! LC_ALL=C cmp -s "$SDIR/a" "$SDIR/b"; then
  skazhi "РАЗОШЛИСЬ: наборы файлов в bootstrap/ не совпадают"
  LC_ALL=C diff "$SDIR/a" "$SDIR/b" | sed 's/^/  /'
  exit 1
fi

fajlov=0; bajt=0; razoshlos=0
while IFS= read -r f; do
  [ -f "$A/bootstrap/$f" ] || continue
  fajlov=$((fajlov + 1))
  bajt=$((bajt + $(wc -c < "$A/bootstrap/$f")))
  if ! LC_ALL=C cmp -s "$A/bootstrap/$f" "$B/bootstrap/$f"; then
    razoshlos=$((razoshlos + 1))
    skazhi "РАЗОШЁЛСЯ: bootstrap/$f"
    skazhi "  $(LC_ALL=C cmp "$A/bootstrap/$f" "$B/bootstrap/$f" 2>&1 | head -1)"
  fi
done < "$SDIR/a"

if [ "$razoshlos" -gt 0 ]; then
  skazhi ""
  skazhi "ПЕЧАТИ РАЗОШЛИСЬ: файлов сверено $fajlov, разошлось $razoshlos."
  skazhi "Значит печать НЕ воспроизводима, и Г6 на этой паре не взят."
  exit 1
fi

skazhi "печати совпали побайтово: файлов $fajlov, байт $bajt"
skazhi "  первая:  $A   (журнал $ZH_A, конец по «$OTKUDA_A»)"
skazhi "  вторая:  $B   (журнал $ZH_B, конец по «$OTKUDA_B»)"
skazhi "Г6 на ЭТОЙ паре взят. На гейт целиком этого мало: нужна пара из ОДНОГО"
skazhi "дерева и прибор, зовущийся сам, а не руками."
exit 0
