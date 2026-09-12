#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# ЧТЕНИЕ `.flangrc`: СОБРАТЬ ИСТОЧНИКИ И СПРОСИТЬ ЯЗЫК, КОТОРЫЙ РЕШИТ.
#
#   sh scripts/flangrc.sh                 все ключи: `ключ = значение`
#   sh scripts/flangrc.sh язык            одно значение, одной строкой
#   sh scripts/flangrc.sh --откуда        то же и с источником каждого ключа
#   sh scripts/flangrc.sh --места         какие места просмотрены (для проверки)
#   sh scripts/flangrc.sh --файл          путь взятого файла проекта, или пусто
#   sh scripts/flangrc.sh --от DIR        считать началом поиска DIR, а не $PWD
#   sh scripts/flangrc.sh --дом DIR       считать домом DIR, а не $HOME
#
# ── Почему оболочка, а решает flang ─────────────────────────────────────────
# Замер 8 сентября 2026, двоичный 0.7.14: у хозяина `flang io` поручения
# «Прочитать переменную среды» НЕТ — на него приходит
# `FLANG_IO_UNKNOWN: хозяин не знает поручения «Прочитать переменную среды»`;
# «Прочитать доводы» нет тоже. Значит собрать источники программа на flang
# сегодня не может физически. Оболочка собирает, `scripts/settings-file.flang`
# решает — ровно так же разделены `ярлык` и `ярлыки.flang`, и по той же
# причине.
#
# ── Где ищется файл, и почему поиск не может уйти наверх ────────────────────
# Проектный `.flangrc` ищется от начального каталога ВВЕРХ, и подъём обрывается
# на каталоге с КОРНЕВОЙ ПРИМЕТОЙ — `.git` или `flang.package`, — включая сам
# этот каталог. Приметы по дороге не встретилось (до `$HOME` или до корня
# файловой системы) — проектного файла НЕТ ВОВСЕ: подъём не «доходит докуда
# дошёл», он объявляется несостоявшимся.
#
# Это не осторожность на всякий случай, а починка уже случившейся беды. Поиск
# МОДУЛЕЙ поднимается вверх, пока в очередном предке лежит хоть один `.flang`,
# и 8 сентября 2026 сборка сайта взяла модуль «JSON» из чужого черновика
# `/srv/tmp/json.baseline.flang`, ответив при этом кодом 0 (задача 3127,
# `scripts/guards/module-origin-guard.sh`). Настройки опаснее модуля: подменённый
# `.flangrc` меняет не одну сборку, а язык, которым программа отвечает
# человеку, и заметить это некому.
#
# Второй довод — уже принятый в дереве. Манифест пакета `flang.package`
# ищется ТОЛЬКО рядом со входным файлом и вверх не поднимается вовсе
# (`flang/src/emit/c/flang_repl.c`, `pkg_declaration`). Настройки от него
# отличаются одним: у проекта бывает подкаталог с исходниками, и требовать
# `.flangrc` в каждом — значит требовать копий. Поэтому подъём есть, но у
# него названа граница.
#
# ИМЕНА ПЕРЕМЕННЫХ ЗДЕСЬ ЛАТИНИЦЕЙ, как в `ярлык` и `scripts/raskrutka.sh`:
# ни dash, ни bash не принимают кириллицу в именах переменных.
set -eu

KOREN=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

OT=$PWD
DOM=${HOME:-}
REZHIM=znachenia
KLYUCH=

while [ $# -gt 0 ]; do
  case $1 in
    --от) OT=${2:?"--от требует каталога"}; shift 2 ;;
    --дом) DOM=${2:?"--дом требует каталога"}; shift 2 ;;
    --откуда) REZHIM=otkuda; shift ;;
    --места) REZHIM=mesta; shift ;;
    --файл) REZHIM=fajl; shift ;;
    -*) printf 'flangrc: непонятный ключ «%s»\n' "$1" >&2; exit 2 ;;
    *) KLYUCH=$1; shift ;;
  esac
done

[ -d "$OT" ] || { printf 'flangrc: нет каталога «%s»\n' "$OT" >&2; exit 2; }
OT=$(CDPATH= cd -- "$OT" && pwd)

# ── проектный файл: подъём до ближайшей приметы ─────────────────────────────
# Три приметы, и любая обрывает подъём НА СЕБЕ:
#
#   .flangrc        сами настройки — ближайшие и есть настоящие;
#   .git            корень репозитория;
#   flang.package   корень пакета flang.
#
# Порядок проверки внутри каталога тоже часть правила: сперва `.flangrc`,
# потом корневые приметы. Каталог, несущий и то и другое, отдаёт настройки.
#
# ГЛАВНОЕ СВОЙСТВО — ДАЛЬНИЙ ФАЙЛ НЕ ПЕРЕКРЫВАЕТ БЛИЖНИЙ. Раз `.flangrc` сам
# обрывает подъём, пройти мимо одного и взять другой, лежащий выше, поиск не
# может ни при какой раскладке каталогов. Это ровно то, чего нет у поиска
# модулей: там побеждает первое совпадение по ИМЕНИ МОДУЛЯ, а подъём идёт,
# пока в предке лежит хоть один `.flang`, — и 8 сентября 2026 чужой черновик
# `/srv/tmp/json.baseline.flang` подменил `flang/stdlib/json.flang`, а сборка
# ответила кодом 0 (задача 3127, `scripts/guards/module-origin-guard.sh`).
#
# И три границы, дальше которых подъёма нет ни при какой примете: корень
# файловой системы, дом человека и остановка на месте.
#
# Замер, показывающий, зачем границы названы поимённо: на этой машине лежит
# `/tmp/.git`. Поиск, начатый в любом временном каталоге и не встретивший
# приметы раньше, дошёл бы до него и объявил корнем проекта весь `/tmp`.
MESTA=
PROEKT=
GDE_PROEKT=
kat=$OT
while :; do
  MESTA="$MESTA$kat
"
  if [ -f "$kat/.flangrc" ]; then
    PROEKT=$(cat "$kat/.flangrc")
    GDE_PROEKT=$kat/.flangrc
    PRICHINA="настройки найдены: $GDE_PROEKT"
    break
  fi
  if [ -e "$kat/.git" ] || [ -f "$kat/flang.package" ]; then
    PRICHINA="корень проекта, выше не смотрим: $kat"
    break
  fi
  roditel=$(dirname -- "$kat")
  if [ "$roditel" = "$kat" ] || [ "$kat" = "/" ]; then
    PRICHINA="корень файловой системы, выше некуда: $kat"
    break
  fi
  if [ -n "$DOM" ] && [ "$kat" = "$DOM" ]; then
    PRICHINA="дом человека, выше не смотрим: $kat"
    break
  fi
  kat=$roditel
done

# ── файл дома ───────────────────────────────────────────────────────────────
DOMASHNIY=
GDE_DOM=
if [ -n "$DOM" ] && [ -f "$DOM/.flangrc" ]; then
  DOMASHNIY=$(cat "$DOM/.flangrc")
  GDE_DOM=$DOM/.flangrc
  MESTA="$MESTA$DOM
"
fi

# ── среда и локаль ──────────────────────────────────────────────────────────
# ИМЕНА ПЕРЕМЕННЫХ СРЕДЫ — ТОЛЬКО ЛАТИНИЦЕЙ, и это не вкус, а замер 8 сентября
# 2026 на этой машине:
#
#   bash -c 'FLANG_ЯЗЫК=ru'   → FLANG_ЯЗЫК=ru: command not found, код 127
#   dash -c 'FLANG_ЯЗЫК=ru'   → FLANG_ЯЗЫК=ru: not found,         код 127
#   zsh  -c 'FLANG_ЯЗЫК=ru'   → код 0
#
# Кириллическое имя присваивается ровно в одной оболочке из трёх. Переменная,
# которую в двух оболочках из трёх нельзя задать, — не переменная, а ловушка:
# человек пишет присваивание, получает «command not found» и решает, что
# сломан flang. Ключи файла настроек при этом остаются русскими: файл читает
# flang, а не оболочка.
sreda_klyucha() {
  case $1 in
    язык) printf '%s' "${FLANG_LANG:-}" ;;
    поверхность) printf '%s' "${FLANG_SURFACE:-}" ;;
    цвет) printf '%s' "${FLANG_COLOR:-}" ;;
    страница) printf '%s' "${FLANG_MANPAGE:-}" ;;
    *) printf '' ;;
  esac
}
LOKAL=${LC_ALL:-${LC_MESSAGES:-${LANG:-}}}


# JSON собирается python3, а не printf: значение может нести кавычку, обратную
# косую и перевод строки, и склейка руками их бы потеряла.
sprosit() { # ключ, довод
  k=$1; d=$2
  args=$(KL="$k" DOV="$d" SRE="$(sreda_klyucha "$k")" PRO="$PROEKT" DOMA="$DOMASHNIY" LOK="$LOKAL" \
    python3 -c 'import json,os; print(json.dumps({"ключ":os.environ["KL"],"довод":os.environ["DOV"],"среда":os.environ["SRE"],"проект":os.environ["PRO"],"дом":os.environ["DOMA"],"локаль":os.environ["LOK"]},ensure_ascii=False))')
  "$KOREN/bootstrap/flang" run "$KOREN/scripts/settings-file.flang" \
    --function "«Выбранное значение»" --args "$args" 2>/dev/null | sed 's/^"//; s/"$//'
}

# Откуда взято — считается ЗДЕСЬ, а не спрашивается у языка: язык отвечает
# значением, а не рассказом о себе. Порядок тот же, что в «Выбранное значение»,
# и разойтись им нельзя — разойдутся, и `--откуда` начнёт врать.
otkuda() { # ключ, итог
  k=$1; itog=$2
  if [ -z "$itog" ]; then printf 'ниоткуда'; return; fi
  if [ "$(sreda_klyucha "$k")" = "$itog" ]; then printf 'переменная среды'; return; fi
  if [ -n "$GDE_PROEKT" ] && [ "$(znachenie_v "$PROEKT" "$k")" = "$itog" ]; then printf '%s' "$GDE_PROEKT"; return; fi
  if [ -n "$GDE_DOM" ] && [ "$(znachenie_v "$DOMASHNIY" "$k")" = "$itog" ]; then printf '%s' "$GDE_DOM"; return; fi
  case $k in
    язык|страница)
      if [ -n "$LOKAL" ] && [ "$(printf '%.2s' "$LOKAL")" = "$itog" ]; then printf 'локаль %s' "$LOKAL"; return; fi ;;
  esac
  printf 'умолчание'
}

znachenie_v() { # текст, ключ
  T="$1" K="$2" python3 -c '
import os,sys
klyuch=os.environ["K"]; naideno=""
for stroka in os.environ["T"].split("\n"):
    if stroka.strip().startswith("#") or "=" not in stroka: continue
    k,_,v=stroka.partition("=")
    if " ".join(k.split())==klyuch: naideno=" ".join(v.split())
print(naideno)'
}

# ДВА ЭТИХ ОТВЕТА ДВОИЧНОГО НЕ ТРЕБУЮТ, и это нарочно: проверка мест обязана
# работать и тогда, когда `bootstrap/flang` не собран (5–6 минут сборки), — иначе
# она стояла бы в CI ценой сборки ради вопроса, на который отвечает один обход
# каталогов.
if [ "$REZHIM" = mesta ]; then
  printf '%s' "$MESTA"
  printf 'остановка: %s\n' "$PRICHINA"
  if [ -n "$GDE_DOM" ]; then printf 'дом: %s\n' "$GDE_DOM"; fi
  exit 0
fi

if [ "$REZHIM" = fajl ]; then
  if [ -n "$GDE_PROEKT" ]; then printf '%s\n' "$GDE_PROEKT"; fi
  exit 0
fi

# ── спросить язык ───────────────────────────────────────────────────────────
if [ ! -x "$KOREN/bootstrap/flang" ]; then
  printf 'flangrc: нет bootstrap/flang, решать нечем. Соберите: make -C bootstrap\n' >&2
  exit 3
fi

KLYUCHI="язык поверхность цвет страница"
[ -n "$KLYUCH" ] && KLYUCHI=$KLYUCH

for k in $KLYUCHI; do
  z=$(sprosit "$k" "")
  if [ -n "$KLYUCH" ] && [ "$REZHIM" = znachenia ]; then
    printf '%s\n' "$z"
  elif [ "$REZHIM" = otkuda ]; then
    printf '%s = %s   (%s)\n' "$k" "$z" "$(otkuda "$k" "$z")"
  else
    printf '%s = %s\n' "$k" "$z"
  fi
done
