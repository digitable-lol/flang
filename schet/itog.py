#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Три числа разом: доказано / из них содержательных / из них безусловных.
Читает то, что уже снято: schet/vedomosti (ведомости библиотеки),
schet/pustota и schet/pustota2 (две подмены тела заглушкой той же подписи)."""
import glob, json, os, re, sys, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import uslovnost as U

KOREN = '/srv/flang-rabota/u-uslovno'
IST = sorted(glob.glob(KOREN + '/flang/stdlib/*.flang'))
hoz = U.hozyaeva(IST)

vse, usl = {}, set()
ne_izmereno = []
for f in sorted(glob.glob(KOREN + '/schet/vedomosti/*.json')):
    ist = KOREN + '/flang/stdlib/' + os.path.basename(f)[:-5] + '.flang'
    try:
        d = json.load(open(f, encoding='utf-8'))
    except Exception:
        ne_izmereno.append(ist)
        continue
    tab, _ = U.razobrat_vedomost(d)
    for k, z in tab.items():
        if k[0] not in hoz.get(ist, ()):
            continue
        z['shatkie'] = U.obhod(tab, k, [], set()) if z['verdikt'] in U.DOKAZANO else []
        vse[k] = z
        if z['verdikt'] in U.DOKAZANO and z['shatkie']:
            usl.add(k)

def prochest_pustye(put):
    out = set()
    for l in open(put, encoding='utf-8'):
        m = re.match(r'· \[([^\]]+)\] «(.*)» функции «([^»]+)»$', l.strip())
        if m:
            out.add((m.group(3), m.group(2)))
    return out

pustye = prochest_pustye(KOREN + '/schet/pustota.txt')
navernyaka = set()
for of, name in pustye:
    for m in sorted(glob.glob(KOREN + '/schet/pustota2/*/out.json')):
        try:
            d = json.load(open(m, encoding='utf-8'))
        except Exception:
            continue
        for c in d['claims']:
            if (c['of'], c['name']) == (of, name) and c['verdict'].startswith('proved') \
               and os.path.basename(os.path.dirname(m)).split('~', 1)[1] == of.replace(' ', '_').replace('/', '.'):
                navernyaka.add((of, name))

dok = {k: v for k, v in vse.items() if v['verdikt'] in U.DOKAZANO}
v_ishodnike = sum(1 for f in IST for l in open(f, encoding='utf-8') if re.match(r'^\s+обеспечивает\s', l))

print('══ ИТОГ ПО БИБЛИОТЕКЕ flang/stdlib ══')
print('обещаний в исходнике (строк `обеспечивает`):      %d' % v_ishodnike)
print('  из них не измеряется вовсе:                     %d  (%s)'
      % (v_ishodnike - len(vse), ', '.join(os.path.basename(x) for x in ne_izmereno)))
print('измерено обещаний:                                %d' % len(vse))
print()
print('доказано:                                         %d' % len(dok))
print('  из них СОДЕРЖАТЕЛЬНЫХ (не пережили подмену тела): %d' % (len(dok) - len(pustye)))
print('     пустых при постоянной-нуле:                  %d' % len(pustye))
print('     из них пусты и при ВТОРОЙ, другой постоянной: %d' % len(navernyaka))
print('  из них БЕЗУСЛОВНЫХ (ни одной недоказанной посылки): %d' % (len(dok) - len(usl)))
print('     условных:                                    %d' % len(usl))
print('  пустых И условных сразу:                        %d' % len(pustye & usl))
print('  содержательных И безусловных сразу:             %d' % (len(dok) - len(pustye | usl)))
print()
print('сетка (проверено примерами, не доказано):         %d' % sum(1 for v in vse.values() if v['verdikt'] == 'grid'))
print('объявлено, не доказано:                           %d' % sum(1 for v in vse.values() if v['verdikt'] == 'declared'))
