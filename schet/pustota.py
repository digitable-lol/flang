#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Счёт пустоты: пережило ли доказанное утверждение подмену тела заглушкой той
же подписи. Пережило — значит говорит про ПОДПИСЬ, а не про функцию."""
import json, glob, os, re, sys, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import uslovnost as U

KOREN = '/srv/flang-rabota/u-uslovno'
DOK = ('proved', 'proved-induction')

def vedomost(put):
    try:
        return json.load(open(put, encoding='utf-8'))
    except Exception:
        return None

# что доказано в ОПОРЕ — библиотека без примеров, тела не тронуты
opora = {}
for d in sorted(glob.glob(KOREN + '/schet/pustota/*~-')):
    m = os.path.basename(d)[:-2]
    v = vedomost(d + '/out.json')
    if v is None:
        opora[m] = None
        continue
    opora[m] = {(c['of'], c['name']): c['verdict'] for c in v['claims']}

hoz = U.hozyaeva(sorted(glob.glob(KOREN + '/flang/stdlib/*.flang')))
svoi = {os.path.basename(f)[:-6]: n for f, n in hoz.items()}

pustye, soderzhatelnye, ne_izmereno = [], [], []
for d in sorted(glob.glob(KOREN + '/schet/pustota/*')):
    imya = os.path.basename(d)
    if imya.endswith('~-'):
        continue
    if not os.path.exists(d + '/kod'):
        continue          # прогон ещё идёт
    m, funk = imya.split('~', 1)
    funk = funk.replace('_', ' ')
    baza = opora.get(m)
    if baza is None:
        continue
    # какие утверждения ЭТОЙ функции доказаны в опоре
    celi = {k: v for k, v in baza.items() if k[0].replace(' ', ' ') == funk and v in DOK}
    if not celi:
        # имя могло пострадать при замене пробелов на подчёркивания
        celi = {k: v for k, v in baza.items() if k[0].replace(' ', '_') == imya.split('~', 1)[1] and v in DOK}
    v = vedomost(d + '/out.json')
    if v is None:
        oshibka = ''
        if os.path.exists(d + '/out.err'):
            stroki = [s for s in open(d + '/out.err', encoding='utf-8').read().splitlines() if s.strip()]
            oshibka = ' | '.join(stroki[:2])
        rod = 'ТЕОРЕМА ОТВЕРГНУТА' if re.search(r'FLANG_PROOF|FLANG_PROPERTY', oshibka) else 'ПРОГОН НЕ ВЫШЕЛ'
        for k in celi:
            (soderzhatelnye if rod == 'ТЕОРЕМА ОТВЕРГНУТА' else ne_izmereno).append((m, k[0], k[1], rod, oshibka[:110]))
        continue
    posle = {(c['of'], c['name']): c['verdict'] for c in v['claims']}
    for k in celi:
        if posle.get(k) in DOK:
            pustye.append((m, k[0], k[1]))
        else:
            soderzhatelnye.append((m, k[0], k[1], 'вердикт стал %s' % posle.get(k), ''))

print('══ ПУСТОТА: подмена тела заглушкой той же подписи ══')
print('доказанных утверждений проверено: %d' % (len(pustye) + len(soderzhatelnye) + len(ne_izmereno)))
print('  ПУСТЫХ (пережили подмену — про подпись, не про функцию): %d' % len(pustye))
print('  содержательных (вердикт изменился):                     %d' % len(soderzhatelnye))
print('  не измерено:                                            %d' % len(ne_izmereno))
print()
print('── пустые, поимённо:')
for m, of, name in sorted(pustye):
    print('· [%s] «%s» функции «%s»' % (m, name, of))
if ne_izmereno:
    print()
    print('── не измерено:')
    for m, of, name, rod, o in sorted(ne_izmereno):
        print('· [%s] «%s» функции «%s» — %s: %s' % (m, name[:60], of, rod, o))
