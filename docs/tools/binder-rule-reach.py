#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
"""Сколько недоказанных обязательств правило ДЕЛАЕТ ПРИГОДНЫМИ для пятого хода.

Пятый ход («разбор цели по условию») берёт ПЕРВОЕ `если`, до которого обход
дошёл, НИ РАЗУ не войдя в связыватель (`пусть`, `свёртка`, `отобразить`,
`отфильтровать`, `разбор`). Правило `b/9952-kernel-binder-descent` меняет
запрет на вопрос об ИМЕНАХ: под связыватель обход входит, а найденное условие
берётся, только если связыватель не связал ни одного свободного имени этого
условия.

Здесь оба обхода повторены на РАЗОБРАННОМ дереве (`flang ast`) и посчитана
разница: обязательства, у которых до правила условия нет, а после — есть.

ЧТО ЭТО ЧИСЛО ЗНАЧИТ И ЧЕГО НЕ ЗНАЧИТ. Пригодность — не доказательство: у формы
цели «равно» правило есть, и всё равно часть таких целей не доказана. Верхняя
граница, и названа она так нарочно.

ЧЕМ ОГРАНИЧЕН ПРИБОР. Считает по РАЗОБРАННОМУ дереву, а не по нормализованному,
каким его видит ядро: `результат` подставляется телом здесь же, а свёртка
определений и переписки допущениями не повторяются.
"""
import collections, glob, json, os, re, sys


# `flang ast` печатает дерево ВМЕСТЕ с ввезёнными файлами: у `crl.flang`
# 32 объявленные функции и 150 в дереве. Своей файл считает только ту, чьё
# объявление стоит в нём самом, — имя И НОМЕР СТРОКИ, а не одно имя: имена по
# ввозу совпадают, а пара «имя + строка» — нет.
ОБЪЯВЛЕНА = re.compile(r'^(?:тотальная\s+)?функция\s+«([^»]+)»')


def свои_объявления(путь):
    свои = set()
    with open(путь, encoding='utf-8', errors='replace') as ф:
        for н, с in enumerate(ф, 1):
            m = ОБЪЯВЛЕНА.match(с)
            if m: свои.add((m.group(1), н))
    return свои

СВЯЗЫВАТЕЛИ = {'let', 'fold', 'map', 'filter', 'match'}


def связанные(узел):
    """Имена, которые связывает этот узел."""
    k = узел.get('kind')
    if k == 'let': return {узел.get('name')} - {None}
    if k == 'fold': return {узел.get('acc'), узел.get('item')} - {None}
    if k in ('map', 'filter'): return {узел.get('item')} - {None}
    if k == 'match':
        имена = set()
        for с in узел.get('cases') or []:
            имена |= имена_образца(с.get('pattern') or {})
        return имена
    return set()


def имена_образца(о):
    имена = set()
    if not isinstance(о, dict): return имена
    for ключ in ('name', 'head', 'tail', 'bind', 'as'):
        v = о.get(ключ)
        if isinstance(v, str): имена.add(v)
    for ключ, v in о.items():
        if ключ in ('kind', 'span'): continue
        if isinstance(v, dict): имена |= имена_образца(v)
        elif isinstance(v, list):
            for э in v:
                if isinstance(э, dict): имена |= имена_образца(э)
        elif isinstance(v, str) and ключ.startswith('поле') is False and ключ in ('переменная',):
            имена.add(v)
    return имена


def свободные(узел, связ=frozenset()):
    """Свободные имена выражения."""
    если_нет = set()
    if not isinstance(узел, dict):
        if isinstance(узел, list):
            for э in узел: если_нет |= свободные(э, связ)
        return если_нет
    k = узел.get('kind')
    if k == 'var':
        имя = узел.get('name')
        return set() if имя in связ else {имя}
    новые = связанные(узел)
    for ключ, v in узел.items():
        if ключ in ('span', 'kind', 'name', 'acc', 'item', 'pattern') and not isinstance(v, (dict, list)):
            continue
        if ключ == 'pattern':
            continue
        внутри = связ | новые if (k in СВЯЗЫВАТЕЛИ and ключ in ('in', 'body')) else связ
        если_нет |= свободные(v, внутри)
    return если_нет


def найти_условие(узел, сквозь):
    """Первое условие, как его ищет ядро. `сквозь` — правило включено."""
    if not isinstance(узел, dict):
        if isinstance(узел, list):
            for э in узел:
                r = найти_условие(э, сквозь)
                if r is not None: return r
        return None
    k = узел.get('kind')
    if k in СВЯЗЫВАТЕЛИ:
        if not сквозь: return None
        r = обойти_поля(узел, сквозь)
        if r is None: return None
        return None if (связанные(узел) & свободные(r)) else r
    if k == 'if':
        усл = узел.get('cond')
        if isinstance(усл, dict) and усл.get('kind') not in ('literal',) and усл.get('kind') not in СВЯЗЫВАТЕЛИ:
            return усл
        for ключ in ('then', 'else'):
            r = найти_условие(узел.get(ключ), сквозь)
            if r is not None: return r
        return None
    return обойти_поля(узел, сквозь)


def обойти_поля(узел, сквозь):
    for ключ, v in узел.items():
        if ключ in ('span', 'kind'): continue
        if ключ == 'pattern': continue
        r = найти_условие(v, сквозь)
        if r is not None: return r
    return None


def подставить(цель, тело):
    """`результат` в цели заменяется телом функции — так делает ядро."""
    if isinstance(цель, list): return [подставить(э, тело) for э in цель]
    if not isinstance(цель, dict): return цель
    if цель.get('kind') == 'var' and цель.get('name') == 'результат': return тело
    return {k: (v if k == 'span' else подставить(v, тело)) for k, v in цель.items()}



def есть_связыватель(узел, снаружи=True):
    """Стоит ли в дереве хоть один связыватель."""
    if isinstance(узел, list):
        return any(есть_связыватель(э) for э in узел)
    if not isinstance(узел, dict): return False
    if узел.get('kind') in СВЯЗЫВАТЕЛИ: return True
    return any(есть_связыватель(v) for k, v in узел.items() if k != 'span')


def разбор_под_связывателем(узел, под=False):
    """Есть ли `разбор`, до которого не дойти, не войдя в связыватель."""
    if isinstance(узел, list):
        return any(разбор_под_связывателем(э, под) for э in узел)
    if not isinstance(узел, dict): return False
    k = узел.get('kind')
    if k == 'match' and под: return True
    внутри = под or (k in СВЯЗЫВАТЕЛИ)
    return any(разбор_под_связывателем(v, внутри) for kk, v in узел.items() if kk != 'span')

ВЕРДИКТ = re.compile(r'^  (постусловие|предусловие|закон|утверждение)\s+«(.*)»\s+функции\s+«([^»]*)»\s+—\s+(.*)$')
НАЧАЛО = 'что высказано и чем это несётся:'


def вердикты(путь):
    д, внутри = {}, False
    for с in open(путь, encoding='utf-8', errors='replace'):
        с = с.rstrip('\n')
        if с.startswith(НАЧАЛО): внутри = True; continue
        if внутри and с and not с.startswith('  '): внутри = False
        if not (внутри and с.startswith('  ')): continue
        m = ВЕРДИКТ.match(с)
        if m: д[(m.group(3), m.group(2))] = m.group(4)
    return д


def main(корень, ка, кв, образцы):
    итог = collections.Counter()
    поимённо = []
    сверка = collections.Counter()
    пути = []
    for о in образцы: пути += glob.glob(os.path.join(корень, о))
    for путь in sorted(set(пути)):
        отн = os.path.relpath(путь, корень)
        k = отн.replace('/', '_')
        фа, фв = os.path.join(ка, k + '.json'), os.path.join(кв, k + '.out')
        if not (os.path.exists(фа) and os.path.getsize(фа)): continue
        if not (os.path.exists(фв) and os.path.getsize(фв)): continue
        d = json.load(open(фа, encoding='utf-8'))
        объявлены = свои_объявления(путь)
        в = вердикты(фв)
        # тот же порог, что у разреза: файл идёт в счёт, только если число
        # приговоров о СВОИХ функциях сошлось с числом обязательств в исходнике
        свои_имена = {и for и, _ in объявлены}
        приговоров = sum(1 for (ф, _) in в if ф in свои_имена)
        написано = sum(1 for с in open(путь, encoding='utf-8', errors='replace')
                       if not с.lstrip().startswith('//') and re.match(r'^\s+(обеспечивает|требует|закон)\b', с))
        if приговоров != написано:
            итог['файл не учтён: счёты не сошлись'] += 1
            continue
        for f in d.get('functions', []):
            if (f['name'], (f.get('span') or {}).get('line')) not in объявлены: continue
            тело = f.get('body') or {}
            for pc in f.get('postconditions', []):
                ключ = (f['name'], pc.get('name'))
                if ключ not in в: continue
                хвост = в[ключ]
                доказано = хвост.startswith('доказано') and not хвост.startswith('доказано ПРИ УСЛОВИИ')
                цель = подставить(pc.get('expr') or {}, тело)
                было = найти_условие(цель, False)
                стало = найти_условие(цель, True)
                # сверка прибора: цели, закрытые ходом по условию, обязаны иметь условие и ДО
                if 'разбор цели по условию' in хвост or 'разбор случаев по внутреннему условию' in хвост:
                    сверка['ход по условию, условие найдено ДО' if было is not None
                           else 'ход по условию, а условия ДО НЕТ — прибор врёт'] += 1
                связ = есть_связыватель(цель)
                разб = разбор_под_связывателем(цель)
                if доказано:
                    итог['доказано'] += 1
                    if связ: итог['доказано, а связыватель в цели стоит'] += 1
                    continue
                итог['НЕ доказано'] += 1
                if связ: итог['НЕ доказано, и связыватель в цели стоит'] += 1
                if разб: итог['НЕ доказано, и `разбор` спрятан под связывателем'] += 1
                if было is None and стало is not None:
                    итог['правило делает пригодным'] += 1
                    поимённо.append((отн, f['name'], pc.get('name'), тело.get('kind')))
                elif было is None:
                    итог['условия нет ни до, ни после'] += 1
                else:
                    итог['условие было и до — правило ни при чём'] += 1
    print('область:', ' '.join(образцы))
    for имя, н in итог.most_common(): print(f'  {имя:40s} {н:6d}')
    print('\nсверка прибора на ходе по условию:')
    for имя, н in сверка.most_common(): print(f'  {имя:50s} {н:6d}')
    print(f'\nПОИМЁННО — обязательства, которые правило делает пригодными ({len(поимённо)}):')
    по_виду = collections.Counter(т for _, _, _, т in поимённо)
    for т, н in по_виду.most_common(): print(f'  тело {т:10s} {н:5d}')
    for ф, фн, ин, т in поимённо[:60]: print(f'  {ф}  «{фн}» / «{ин}»  тело {т}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4:] or ['flang/stdlib/*.flang'])
