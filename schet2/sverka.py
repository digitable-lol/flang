#!/usr/bin/env python3
"""Независимая сверка: кто ДОЛЖЕН стать «доказано при условии».

Читает БАЗОВЫЕ ведомости (снятые до правки) и обходит ссылки `по свойству`
из самих термов. Ответ сличается с тем, что напечатало ядро после правки, —
две дороги к одному числу.
"""
import json, glob, sys, collections

kat = sys.argv[1]
verdikt = {}          # (of,name) -> вердикт ядра
ssylki = collections.defaultdict(set)   # (of,name) -> {(of,name) посылок}
vladelec = collections.defaultdict(set) # имя постусловия -> {функции}

for f in sorted(glob.glob(kat + '/*.json')):
    try:
        d = json.load(open(f))
    except Exception:
        continue
    for o in d.get('obligations', []):
        if o.get('kind') != 'postcondition':
            continue
        vladelec[o.get('name')].add(o.get('of'))
    for o in d.get('obligations', []):
        if o.get('kind') != 'postcondition':
            continue
        klyuch = (o.get('of'), o.get('name'))
        dis = o.get('discharge') or {}
        verdikt[klyuch] = dis.get('verdict', '')
        pr = o.get('proof') or {}
        shagi = list(pr.get('steps') or [])
        for sl in (pr.get('cases') or []):
            shagi += list(sl.get('steps') or [])
        for st in shagi:
            by = st.get('by') or {}
            if by.get('rule') == 'property':
                imya = by.get('name')
                for chya in vladelec.get(imya, ()):
                    ssylki[klyuch].add((chya, imya))

# наименьшая неподвижная точка снизу
tvyordye = set()
while True:
    novye = set(tvyordye)
    for k, v in verdikt.items():
        if v == 'доказано' and all(p in tvyordye for p in ssylki.get(k, ())):
            novye.add(k)
    if novye == tvyordye:
        break
    tvyordye = novye

uslovnye = sorted(k for k, v in verdikt.items() if v == 'доказано' and k not in tvyordye)
print('обязательств с вердиктом ядра:', len(verdikt))
print('  доказано:', sum(1 for v in verdikt.values() if v == 'доказано'))
print('  ссылок `по свойству` (пар):', sum(len(v) for v in ssylki.values()))
print('ОЖИДАЕТСЯ «при условии»:', len(uslovnye))
for k in uslovnye:
    print('   ', k[1], '/', k[0], '←', sorted(ssylki.get(k, ())))
