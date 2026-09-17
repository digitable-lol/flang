#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# Что именно есть в исходнике и ещё нет в семени — поимённо, по функциям.
# Отставание отделяется от «файл вне замыкания» графом импортов от входа печати.
# Это не сторож свежести (тот — seed-freshness.sh): код всегда 0, ничего не блокирует.
#
# Как звать:
#   sh scripts/seed/what-lags-the-seed.sh            сводка по файлам flang/self
#   sh scripts/seed/what-lags-the-seed.sh <файл>     имена по одному файлу
#
# Коды: 0 — сводка напечатана; 2 — нет семени, входа печати или названного файла.
# см. docs/zettel/lag-behind-the-seed-is-told-by-the-import-graph-not-by-a-share-of-missing-names.md
set -u

KOREN=$(cd "$(dirname "$0")/../.." && pwd)
SEMYA="$KOREN/bootstrap/compiler_flang.c"
[ -f "$SEMYA" ] || { echo "семени нет: $SEMYA" >&2; exit 2; }

ODIN=${1:-}

LC_ALL=C.UTF-8 python3 - "$KOREN" "$SEMYA" "$ODIN" <<'PY'
import re, sys, glob, os

koren, semya, odin = sys.argv[1], sys.argv[2], sys.argv[3]

v_semeni = set(re.findall('«([^»]{1,120})»',
                          open(semya, encoding='utf-8', errors='replace').read()))

obyavlenie = re.compile(r'^(?:тотальная |частичная )?функция «([^»]+)»', re.M)
imya_modulya = re.compile(r'^модуль\s+«([^»]+)»', re.M)
ispolzuet = re.compile(r'^\s*использует\s+«([^»]+)»', re.M)

VHOD = os.path.join(koren, 'flang/self/bootstrap/compiler.flang')
if not os.path.exists(VHOD):
    print('входа печати нет: %s — замыкание не построить' % VHOD, file=sys.stderr)
    sys.exit(2)

# Граф импортов ПО ИМЕНАМ МОДУЛЕЙ. Путей в строках `использует` нет вовсе.
po_imeni, rebra = {}, {}
for put in sorted(glob.glob(os.path.join(koren, 'flang/**/*.flang'), recursive=True) + glob.glob(os.path.join(koren, 'flang/**/*.fscript'), recursive=True)):
    tekst = open(put, encoding='utf-8', errors='replace').read()
    m = imya_modulya.search(tekst)
    if not m:
        continue
    po_imeni.setdefault(m.group(1), put)
    rebra[put] = set(ispolzuet.findall(tekst))

zamykanie, stopka, nerazreshennye = set(), [VHOD], set()
while stopka:
    put = stopka.pop()
    if put in zamykanie:
        continue
    zamykanie.add(put)
    for u in rebra.get(put, ()):
        if u in po_imeni:
            stopka.append(po_imeni[u])
        else:
            nerazreshennye.add(u)

fajly = [odin] if odin else sorted(glob.glob(os.path.join(koren, 'flang/self/*.flang')))
vne, otstali, celyh = [], [], 0

for put in fajly:
    if not os.path.exists(put):
        print('файла нет:', put, file=sys.stderr); sys.exit(2)
    imena = obyavlenie.findall(open(put, encoding='utf-8').read())
    if not imena:
        continue
    net = [i for i in imena if i not in v_semeni]
    imya = os.path.basename(put)
    if not net:
        celyh += 1
    elif os.path.realpath(put) not in {os.path.realpath(x) for x in zamykanie}:
        vne.append((imya, len(net), len(imena)))
    else:
        otstali.append((imya, len(net), len(imena), net))

if odin:
    for imya, n, vsego, net in otstali:
        print('%s: нет в семени %d из %d' % (imya, n, vsego))
        for i in net:
            print('  •', i)
    for imya, n, vsego in vne:
        print('%s: нет в семени %d из %d — файл вне замыкания компилятора'
              % (imya, n, vsego))
    if not otstali and not vne:
        print('всё на месте: сошлись все функции')
    sys.exit(0)

print('ОТСТАВАНИЕ СЕМЕНИ ОТ ИСХОДНИКА, поимённо по функциям')
print()
print('НАСТОЯЩЕЕ ОТСТАВАНИЕ — файл в замыкании, часть функций новее семени:')
if otstali:
    for imya, n, vsego, net in sorted(otstali, key=lambda x: -x[1]):
        print('  %-28s %4d из %4d   %s' % (imya, n, vsego, ', '.join(net[:2])[:52]))
    print('  ИТОГО: файлов %d, функций %d'
          % (len(otstali), sum(n for _, n, _, _ in otstali)))
else:
    print('  нет ни одного — семя догнало исходник')
print()
print('ВНЕ ЗАМЫКАНИЯ (не достижим из входа печати) — НЕ отставание:')
print('  файлов %d, функций %d' % (len(vne), sum(n for _, n, _ in vne)))
if nerazreshennye:
    print('  ⚑ имён модулей не разрешено: %d (%s) — замыкание НЕПОЛНО'
          % (len(nerazreshennye), ', '.join(sorted(nerazreshennye)[:4])))
print()
print('файлов, сошедшихся полностью: %d' % celyh)
print()
print('Свежесть семени как ДА/НЕТ — не здесь: sh scripts/seed/seed-freshness.sh')
PY
