#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Счёт условной доказанности.

Для каждого доказанного утверждения собирается, на какие ЧУЖИЕ постусловия оно
опёрлось, и смотрятся их вердикты; цепочка обходится до конца, а не на шаг.

Два места в ядре, откуда посылка попадает в доказательство, и других нет:
  8-й ход  «Постусловия вызванных» — поле `calls` в ведомости. Ядро берёт сюда
           ТОЛЬКО уже доказанное (неподвижная точка «Закрыть без теорем»),
           но проверяется всё равно, а не принимается на слово.
  7-й ход  `по свойству «имя»` в теореме — берёт постусловие ЛЮБОЕ, доказано
           оно или нет. Имя разрешается так же, как в ядре («Найти постусловие»,
           `proofterm.flang`): первая функция связанной программы, у которой
           есть постусловие с таким именем.
"""
import json, glob, os, re, sys, collections

KOREN = '/srv/flang-rabota/u-uslovno'
DOKAZANO = ('proved', 'proved-induction')
OBJYAVLENIE = re.compile(r'^\s*(?:тотальная\s+)?функция\s+«([^»]+)»', re.M)


def hozyaeva(istochniki):
    """файл → множество имён функций, ОБЪЯВЛЕННЫХ в нём. Одноимённые функции в
    разных модулях законны (redis и dictionary оба объявляют «Положить»),
    поэтому таблица не «имя → файл», а «файл → имена»."""
    h = {}
    for f in istochniki:
        h[f] = {m.group(1) for m in OBJYAVLENIE.finditer(open(f, encoding='utf-8', errors='replace').read())}
    return h


def _hodit(uzel, delo):
    if isinstance(uzel, dict):
        delo(uzel)
        for v in uzel.values():
            _hodit(v, delo)
    elif isinstance(uzel, list):
        for v in uzel:
            _hodit(v, delo)


def svoystva(uzel):
    out = set()
    def d(u):
        by = u.get('by')
        if isinstance(by, dict) and by.get('rule') == 'property' and by.get('name'):
            out.add(by['name'])
    _hodit(uzel, d)
    return out


def pravila(uzel, schet):
    def d(u):
        by = u.get('by')
        if isinstance(by, dict) and by.get('rule'):
            schet[by['rule']] += 1
    _hodit(uzel, d)


def vyzovy(uzel):
    out = set()
    def d(u):
        c = u.get('calls')
        if isinstance(c, list):
            for z in c:
                if isinstance(z, dict) and z.get('of') and z.get('name'):
                    out.add((z['of'], z['name']))
    _hodit(uzel, d)
    return out


def razobrat_vedomost(d):
    """Ведомость одной программы → таблица (функция, имя) → сведения."""
    poryadok = [fn['name'] for fn in d['functions']]
    u_funkcii = collections.defaultdict(set)
    for o in d['obligations']:
        if o.get('kind') == 'postcondition':
            u_funkcii[o['of']].add(o['name'])
    def vladelec(imya):
        for fn in poryadok:
            if imya in u_funkcii[fn]:
                return fn
        return None
    verdikty = {(c['of'], c['name']): c['verdict'] for c in d['claims']}
    tab = {}
    schet_pravil = collections.Counter()
    for o in d['obligations']:
        if o.get('kind') != 'postcondition':
            continue
        klyuch = (o['of'], o['name'])
        dis = o.get('discharge') or {}
        posylki, istochnik = set(), {}
        for p in vyzovy(dis):
            posylki.add(p); istochnik[p] = '8-й ход, постусловие вызванного'
        pravila(o.get('proof'), schet_pravil)
        for imya in svoystva(o.get('proof')):
            v = vladelec(imya)
            p = (v, imya) if v else ('?', imya)
            posylki.add(p); istochnik[p] = '7-й ход, `по свойству` в теореме'
        tab[klyuch] = dict(verdikt=verdikty.get(klyuch, dis.get('verdict')),
                           posylki=posylki, istochnik=istochnik,
                           teorema=bool(o.get('proof')),
                           stroka=(o.get('span') or {}).get('line'))
    return tab, schet_pravil


def obhod(tab, klyuch, put, vidano):
    itog = []
    if klyuch in vidano:
        return itog
    vidano = vidano | {klyuch}
    for p in sorted(tab.get(klyuch, {}).get('posylki', ()), key=lambda x: (str(x[0]), x[1])):
        z = tab.get(p)
        if z is None:
            itog.append((p, 'НЕТ В ВЕДОМОСТИ', put + [klyuch]))
        elif z['verdikt'] not in DOKAZANO:
            itog.append((p, z['verdikt'], put + [klyuch]))
        else:
            itog += obhod(tab, p, put + [klyuch], vidano)
    return itog


def schitat(nabor, istochniki, imya_nabora, podrobno=True, chuzhie=()):
    hoz = hozyaeva(istochniki)
    chuzhie = set(chuzhie)
    vse = {}
    ne_izmereno = []
    pravila_vsego = collections.Counter()
    for json_put, istochnik in nabor:
        kod = open(json_put[:-5] + '.kod').read().strip() if os.path.exists(json_put[:-5] + '.kod') else '?'
        try:
            d = json.load(open(json_put, encoding='utf-8'))
        except Exception:
            oshibka = ''
            if os.path.exists(json_put[:-5] + '.err'):
                stroki = [s for s in open(json_put[:-5] + '.err', encoding='utf-8').read().splitlines() if s.strip()]
                oshibka = ' | '.join(stroki[:2])
            ne_izmereno.append((istochnik, kod, oshibka))
            continue
        tab, pr = razobrat_vedomost(d)
        pravila_vsego += pr
        for klyuch, z in tab.items():
            z['shatkie'] = obhod(tab, klyuch, [], set()) if z['verdikt'] in DOKAZANO else []
            z['gde'] = istochnik
        svoi = [i for _, i in nabor]
        for klyuch, z in tab.items():
            svoya = klyuch[0] in hoz.get(istochnik, ())
            if svoya:
                vse[(istochnik,) + klyuch] = z      # объявлено здесь — здесь и считается
                continue
            # ввезённая функция: её сосчитает её собственный модуль
            if any(klyuch[0] in hoz.get(x, ()) for x in svoi):
                continue
            if any(klyuch[0] in hoz.get(x, ()) for x in chuzhie):
                continue
            if (None,) + klyuch not in vse:
                vse[(None,) + klyuch] = z           # ничей — сосчитаем один раз
    dok = {k: v for k, v in vse.items() if v['verdikt'] in DOKAZANO}
    usl = {k: v for k, v in dok.items() if v['shatkie']}
    print('══ %s ══' % imya_nabora)
    print('обещаний (постусловий), каждое один раз: %d' % len(vse))
    print('из них доказано:                        %d' % len(dok))
    print('  из доказанных УСЛОВНЫ:                %d' % len(usl))
    print('  из доказанных БЕЗУСЛОВНЫ:             %d' % (len(dok) - len(usl)))
    print('вердикты:', collections.Counter(v['verdikt'] for v in vse.values()).most_common())
    print('шаги теорем по правилам:', pravila_vsego.most_common())
    if ne_izmereno:
        print('НЕ ИЗМЕРЕНО (%d файлов):' % len(ne_izmereno))
        for f, kod, o in ne_izmereno:
            print('  %-46s код=%s  %s' % (f, kod, o[:160]))
    if podrobno and usl:
        print('── условно доказанные, поимённо:')
        for k in sorted(usl, key=lambda k: (vse[k]['gde'], vse[k]['stroka'] or 0)):
            z = vse[k]
            print('· %s:%s  «%s» функции «%s» — %s' % (z['gde'], z['stroka'], k[2], k[1], z['verdikt']))
            vid = set()
            for p, v, put in z['shatkie']:
                if (p, v) in vid:
                    continue
                vid.add((p, v))
                cherez = ' → '.join('«%s»' % x[1][:38] for x in put[1:]) if len(put) > 1 else 'прямо'
                print('     ← «%s» функции «%s» — %s   [%s; %s]' % (p[1], p[0], v, z['istochnik'].get(p, 'через цепочку'), cherez))
    print('── по файлам:')
    print('%-46s %6s %8s %9s %10s' % ('файл', 'всего', 'доказано', 'условных', 'безусл.'))
    po = collections.defaultdict(lambda: [0, 0, 0])
    for k, v in vse.items():
        g = os.path.basename(v['gde'])
        po[g][0] += 1
        if v['verdikt'] in DOKAZANO:
            po[g][1] += 1
            if v['shatkie']:
                po[g][2] += 1
    for g in sorted(po):
        a1, b1, c1 = po[g]
        print('%-46s %6d %8d %9d %10d' % (g, a1, b1, c1, b1 - c1))
    return vse, dok, usl, ne_izmereno


if __name__ == '__main__':
    nabor1 = []
    for f in sorted(glob.glob(KOREN + '/schet/vedomosti/*.json')):
        nabor1.append((f, KOREN + '/flang/stdlib/' + os.path.basename(f)[:-5] + '.flang'))
    ist1 = sorted(glob.glob(KOREN + '/flang/stdlib/*.flang'))
    a = schitat(nabor1, ist1, 'БИБЛИОТЕКА flang/stdlib (26 модулей)')

    nabor2 = []
    for f in sorted(glob.glob(KOREN + '/schet/vedomosti-dop/*.json')):
        put = os.path.basename(f)[:-5].replace('~', '/')
        nabor2.append((f, KOREN + '/' + put))
    ist2 = ist1 + [p for _, p in nabor2]
    print()
    b = schitat(nabor2, ist2, 'СПЕКИ И ПРИМЕРЫ (fspec/spec, fspec/experiments, flang/examples, examples)', chuzhie=ist1)

    print()
    print('══ ВСЁ ВМЕСТЕ ══')
    print('обещаний %d · доказано %d · из них условных %d · безусловных %d'
          % (len(a[0]) + len(b[0]), len(a[1]) + len(b[1]), len(a[2]) + len(b[2]),
             len(a[1]) + len(b[1]) - len(a[2]) - len(b[2])))
    print('не измерено файлов: %d' % (len(a[3]) + len(b[3])))
