#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# Сторож таблицы «Где что лежит» в docs/what-blocks-1-0.md.
#
# ── Почему она заведена ──────────────────────────────────────────────────────
# Таблица говорит про КАЖДЫЙ названный прибор, есть он в стволе или нет. Это
# высказывание о дереве, и оно вычислимо целиком. Записанное руками, оно лгало
# уже в минуту собственного коммита: ряды про `scripts/raskrutka.sh --imena` и
# `flang/proof/чекер/` стояли со словом «нет», а оба прибора легли в ствол
# ЗА 7 И ЗА 11 МИНУТ ДО неё:
#
#   git log -1 --format='%ad' --date=iso e8380e2d   # 2026-08-31 20:04:02  чекер
#   git log -1 --format='%ad' --date=iso 4d0dcb7b   # 2026-08-31 20:08:21  --imena
#   git log -1 --format='%ad' --date=iso 86494646   # 2026-08-31 20:15:36  сама таблица
#
# Поэтому столбец «в стволе» больше не пишется руками: он СВЕРЯЕТСЯ с деревом,
# и расхождение красит.
#
# ── Что сверяется ────────────────────────────────────────────────────────────
# Из первого столбца берутся имена в обратных кавычках: путь дерева (с косой или
# с известным расширением) и ключ командной строки (`--что-то`).
#   • ряд без единого пути         — в столбце «в стволе» обязано стоять «не файл»
#                                    (иначе о нём написали вердикт, который
#                                    нечем проверить);
#   • все пути на месте и все ключи найдены — «есть»;
#     (наличие спрашивается у `git ls-files`, то есть у ветки, которую вливают,
#      а не у последнего коммита: иначе сторож молчал бы ровно до вливания)
#   • ни одного пути в дереве нет  — «нет»;
#   • часть есть, часть нет        — ряд красит: его надо разделить.
#
# ── Как звать ────────────────────────────────────────────────────────────────
#   sh scripts/what-blocks-inventory-guard.sh            сверить, код 1 при расхождении
#   sh scripts/what-blocks-inventory-guard.sh --print    напечатать столбец по дереву

set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

DOC=docs/what-blocks-1-0.md
HEAD_ROW='| прибор | в стволе | где сегодня |'

mode=check
case "${1:-}" in
  --print) mode=print ;;
  --help|-h) sed -n '5,35p' "$0"; exit 0 ;;
  "") ;;
  *) printf 'неизвестный довод: %s\n' "$1" >&2; exit 2 ;;
esac

[ -f "$DOC" ] || { printf 'нет файла %s\n' "$DOC" >&2; exit 2; }

TMP=$(mktemp -d "${TMPDIR:-/tmp}/what-blocks-inventory.XXXXXX")
trap 'rm -rf "$TMP"' EXIT INT TERM

# Ряды таблицы: от строки-заголовка до первой пустой строки.
LC_ALL=C.UTF-8 gawk -v hdr="$HEAD_ROW" '
  index($0, hdr) == 1 { inside = 1; next }
  inside && $0 ~ /^\|[-| ]*\|$/ { next }
  inside && $0 !~ /^\|/ { inside = 0 }
  inside { print FNR "\t" $0 }
' "$DOC" > "$TMP/rows"

[ -s "$TMP/rows" ] || { printf 'в %s не нашлось таблицы «%s»\n' "$DOC" "$HEAD_ROW" >&2; exit 1; }

bad=0
: > "$TMP/print"

while IFS='	' read -r lno row; do
  item=$(printf '%s' "$row" | LC_ALL=C.UTF-8 awk -F'|' '{print $2}')
  said_cell=$(printf '%s' "$row" | LC_ALL=C.UTF-8 awk -F'|' '{print $3}')
  where=$(printf '%s' "$row" | LC_ALL=C.UTF-8 awk -F'|' '{print $4}')

  # Внутри одной пары обратных кавычек может стоять целая команда
  # («sh scripts/raskrutka.sh --imena»): рвём её на words и разбираем каждое.
  words=$(printf '%s' "$item" | LC_ALL=C.UTF-8 /usr/bin/grep -a -o '`[^`]*`' | tr -d '`' | tr ' ' '\n')
  paths=$(printf '%s\n' "$words" | LC_ALL=C.UTF-8 /usr/bin/grep -a -E '/|\.(md|flang|tsv|sh|mjs|c|h|json|txt)$' \
          | LC_ALL=C.UTF-8 /usr/bin/grep -a -v -- '^--' || true)
  keys=$(printf '%s\n' "$words" | LC_ALL=C.UTF-8 /usr/bin/grep -a -E '^--' || true)

  if [ -z "$paths" ]; then
    said=$(printf '%s' "$said_cell" | LC_ALL=C.UTF-8 sed 's/[*]//g; s/^ *//; s/ *$//')
    if [ "$said" != "не файл" ]; then
      bad=$((bad + 1))
      printf '%s:%s  ряд не называет ни одного пути дерева, а вердикт «%s» стоит.\n' "$DOC" "$lno" "$said" >&2
      printf '            вердикт, который нечем проверить, пишется словом «не файл».\n' >&2
    fi
    printf '|%s| не файл |%s|\n' "$item" "$where" >> "$TMP/print"
    continue
  fi

  total=0; found=0; missing=""
  for p in $paths; do
    total=$((total + 1))
    q=${p%/}
    if git -c core.quotepath=false ls-files --error-unmatch -- "$q" >/dev/null 2>&1 \
       || git -c core.quotepath=false ls-files -- "$q" 2>/dev/null | LC_ALL=C.UTF-8 /usr/bin/grep -a -q .; then
      found=$((found + 1))
    else
      missing="$missing $p"
    fi
  done

  key_bad=""
  if [ "$found" = "$total" ] && [ -n "$keys" ]; then
    for k in $keys; do
      key_found=нет
      for p in $paths; do
        [ -f "$p" ] || continue
        if LC_ALL=C.UTF-8 /usr/bin/grep -a -q -- "$k" "$p"; then key_found=да; fi
      done
      [ "$key_found" = да ] || key_bad="$key_bad $k"
    done
  fi

  if [ -n "$key_bad" ]; then
    computed=нет
  elif [ "$found" = "$total" ]; then
    computed=есть
  elif [ "$found" = 0 ]; then
    computed=нет
  else
    computed=смешанный
  fi

  said=нет
  printf '%s' "$said_cell" | LC_ALL=C.UTF-8 /usr/bin/grep -a -q 'есть' && said=есть
  printf '%s' "$said_cell" | LC_ALL=C.UTF-8 /usr/bin/grep -a -q 'не файл' && said='не файл'

  printf '|%s| %s |%s|\n' "$item" "$computed" "$where" >> "$TMP/print"

  if [ "$computed" = смешанный ]; then
    bad=$((bad + 1))
    printf '%s:%s  ряд смешанный: %s из %s путей в стволе есть, нет —%s\n' "$DOC" "$lno" "$found" "$total" "$missing" >&2
    printf '            один вердикт на два разных ответа: ряд надо разделить.\n' >&2
  elif [ "$computed" != "$said" ]; then
    bad=$((bad + 1))
    printf '%s:%s  написано «%s», дерево отвечает «%s».\n' "$DOC" "$lno" "$said" "$computed" >&2
    [ -n "$missing" ] && printf '            в стволе нет:%s\n' "$missing" >&2
    [ -n "$key_bad" ] && printf '            ключа нет в файле:%s\n' "$key_bad" >&2
  fi
done < "$TMP/rows"

if [ "$mode" = print ]; then
  printf '%s\n' "$HEAD_ROW"
  printf '|---|---|---|\n'
  cat "$TMP/print"
  exit 0
fi

nrows=$(wc -l < "$TMP/rows" | tr -d ' ')
if [ "$bad" -gt 0 ]; then
  printf '\nтаблица «Где что лежит»: рядов %s, расходится с деревом %s\n' "$nrows" "$bad" >&2
  exit 1
fi
printf 'таблица «Где что лежит»: рядов %s, все сошлись с деревом\n' "$nrows"
exit 0
