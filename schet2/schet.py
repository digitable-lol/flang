#!/usr/bin/env python3
"""Свести ведомости каталога в числа: доказано / при условии / сетка / прочее."""
import json, os, sys, collections

kat = sys.argv[1]
itog = collections.Counter()
fajly = 0
net = []
for imya in sorted(os.listdir(kat)):
    if not imya.endswith('.json'):
        continue
    put = os.path.join(kat, imya)
    if os.path.getsize(put) == 0:
        net.append(imya)
        continue
    try:
        d = json.load(open(put))
    except Exception as e:
        net.append(f'{imya}: {e}')
        continue
    fajly += 1
    for u in d.get('claims', []):
        itog[u.get('verdict', '?')] += 1
print(f'файлов измерено: {fajly}   без ведомости: {len(net)} {net if net else ""}')
vsego = sum(itog.values())
for k in sorted(itog):
    print(f'  {k:22s} {itog[k]}')
print(f'  {"ВСЕГО":22s} {vsego}')
