#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Собрать рабочую копию библиотеки для замера пустоты.

Копируется ВСЯ библиотека, потому что модули ввозят друг друга по соседнему
файлу (замерено: FLANG_IMPORT_NOT_FOUND, если положить один файл отдельно).

Примеры снимаются У ВСЕХ модулей: подменённое тело валит и свой пример, и чужой,
а упавший пример — это код 1 и ведомость не печатается вовсе (замерено:
FLANG_EXAMPLE, json 158 байт).

Тело названной функции заменяется заглушкой ТОЙ ЖЕ ПОДПИСИ: постоянная по
возвращаемому типу, а где постоянную не собрать — параметр того же типа.
Имя функции «-» — только снять примеры (это опора замера).
"""
import sys, os, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from razbor import razobrat, zaglushka, tipy

biblioteka, modul, imya_funkcii, kuda = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
rezhim = sys.argv[5] if len(sys.argv) > 5 else 'первая'
os.makedirs(kuda, exist_ok=True)

izv = {}
for f in sorted(glob.glob(os.path.join(biblioteka, '*.flang'))):
    tipy(open(f, encoding='utf-8').read(), izv)

def bez_primerov(tekst, podmenit=None):
    stroki, funkcii = razobrat(tekst)
    ubrat = set()
    for f in funkcii:
        for a, b in f['primery']:
            ubrat |= set(range(a, b))
    zamena = {}
    if podmenit:
        celi = [f for f in funkcii if f['imya'] == podmenit]
        if len(celi) != 1:
            sys.exit('функций с именем «%s»: %d' % (podmenit, len(celi)))
        f = celi[0]
        vozvrat = (f['vozvrashchaet'] or '').strip()
        # тип-переменная подписи (`функция «Ф» от «Значение»`) — постоянной нет,
        # и одноимённый ЧУЖОЙ тип сюда брать нельзя: замерено на «Успех или
        # запасное», где «Значение» это переменная, а в postgres — вариантный тип
        obshchie = set(f.get('obshchie') or [])
        z = None if vozvrat.strip('«»') in obshchie else zaglushka(vozvrat, izv, rezhim=rezhim)
        if z is None:
            for k, t in f['parametry']:
                if t == f['vozvrashchaet']:
                    z = k
                    break
        if z is None or f['telo'] is None:
            sys.exit('заглушки для «%s» нет: возвращает %s' % (podmenit, f['vozvrashchaet']))
        ubrat |= set(range(f['telo'], f['telo_do']))
        zamena[f['telo']] = '  ' + z
    out = []
    for n, s in enumerate(stroki):
        if n in zamena:
            out.append(zamena[n])
        if n in ubrat:
            continue
        out.append(s)
    return '\n'.join(out)

for f in sorted(glob.glob(os.path.join(biblioteka, '*.flang'))):
    imya = os.path.basename(f)
    tekst = open(f, encoding='utf-8').read()
    podmenit = imya_funkcii if (imya[:-6] == modul and imya_funkcii != '-') else None
    open(os.path.join(kuda, imya), 'w', encoding='utf-8').write(bez_primerov(tekst, podmenit))
