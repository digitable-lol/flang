#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Грубый разбор исходника модуля flang на объявления функций: где подпись,
где примеры, где тело. Нужен для двух дел: снять примеры и подменить тело."""
import re, sys

NACHALO_FUNKCII = re.compile(r'^(тотальная\s+)?функция\s+«([^»]+)»(?:\s+от\s+(.*))?$')
SHAPKA = re.compile(r'^\s+(принимает|возвращает|требует|обеспечивает|пример)\b')

def razobrat(tekst):
    stroki = tekst.split('\n')
    funkcii = []
    i = 0
    while i < len(stroki):
        m = NACHALO_FUNKCII.match(stroki[i])
        if not m:
            i += 1
            continue
        nachalo = i
        imya = m.group(2)
        obshchie = [x.strip().strip('«»') for x in re.split(r'\s+и\s+', m.group(3))] if m.group(3) else []
        j = i + 1
        vozvrashchaet = None
        parametry = []
        primery = []          # (начало, конец) полуинтервалы
        telo_s = None
        while j < len(stroki):
            s = stroki[j]
            if s.strip() == '' :
                # пустая строка внутри объявления бывает; смотрим, что дальше
                k = j + 1
                while k < len(stroki) and stroki[k].strip() == '':
                    k += 1
                if k >= len(stroki) or not stroki[k].startswith(' '):
                    break
                j = k
                continue
            if not s.startswith(' '):
                break
            sm = SHAPKA.match(s)
            if sm:
                slovo = sm.group(1)
                if slovo == 'возвращает':
                    vozvrashchaet = s.strip()[len('возвращает'):].strip()
                if slovo == 'принимает':
                    hvost = s.strip()[len('принимает'):].strip()
                    for kus in hvost.split(','):
                        if ':' in kus:
                            k, t = kus.split(':', 1)
                            parametry.append((k.strip().strip('«»'), t.strip()))
                otstup = len(s) - len(s.lstrip())
                # продолжение клаузы — строки С БОЛЬШИМ отступом: так пишутся и
                # `пример`, и многострочное `обеспечивает … разбор результат`
                # со `случай`ами (замерено на «Разобрать отметку» в datetime).
                p = j + 1
                while p < len(stroki) and stroki[p].strip() != '' and (len(stroki[p]) - len(stroki[p].lstrip())) > otstup:
                    p += 1
                if slovo == 'пример':
                    primery.append((j, p))
                if telo_s is not None:
                    telo_s = None
                j = p
                continue
            if s.lstrip().startswith('//'):
                j += 1
                continue
            if telo_s is None:
                telo_s = j
            j += 1
        funkcii.append(dict(imya=imya, obshchie=obshchie, nachalo=nachalo, konec=j, parametry=parametry,
                            vozvrashchaet=vozvrashchaet, primery=primery, telo=telo_s,
                            telo_do=j))
        i = j
    return stroki, funkcii

def snyat_primery(tekst, krome=()):
    stroki, funkcii = razobrat(tekst)
    ubrat = set()
    for f in funkcii:
        for a, b in f['primery']:
            for n in range(a, b):
                ubrat.add(n)
    return '\n'.join(s for n, s in enumerate(stroki) if n not in ubrat)

ZAGLUSHKI = {
    'число': '0', 'нат': '0', 'строка': '""', 'признак': 'нет', 'сотых': '0',
}

TIP = re.compile(r'^тип\s+«([^»]+)»(?:\s+от\s+(.*))?$')
VARIANT = re.compile(r'^\s+вариант\s+«([^»]+)»(?:\s+содержит\s+(.*))?$')
OBJEKT = re.compile(r'^объект\s+«([^»]+)»')
POLE_OBJ = re.compile(r'^\s+«?([^»:]+)»?\s*(?::\s*(.*)|является\s+(.*))$')

def _polya_iz(hvost):
    polya = []
    if hvost:
        for kus in hvost.split(','):
            if ':' in kus:
                k, t = kus.split(':', 1)
                polya.append((k.strip().strip('«»'), t.strip()))
    return polya

def tipy(tekst, out=None):
    """тип/объект → (род, имя_варианта, поля, параметры_типа). Варианты все,
    чтобы можно было выбрать бесполевой — самая честная заглушка."""
    if out is None:
        out = {}
    stroki = tekst.split('\n')
    i = 0
    while i < len(stroki):
        m = TIP.match(stroki[i])
        if m:
            paramy = [x.strip().strip('«»') for x in re.split(r'\s+и\s+', m.group(2))] if m.group(2) else []
            j = i + 1
            varianty = []
            while j < len(stroki) and (stroki[j].startswith(' ') or stroki[j].strip() == ''):
                vm = VARIANT.match(stroki[j])
                if vm:
                    varianty.append((vm.group(1), _polya_iz(vm.group(2))))
                elif stroki[j].strip() and not stroki[j].strip().startswith('//'):
                    break
                j += 1
            if varianty:
                out.setdefault(m.group(1), ('вариант', varianty, paramy))
            i = j
            continue
        m = OBJEKT.match(stroki[i])
        if m:
            j = i + 1
            polya = []
            while j < len(stroki) and stroki[j].startswith(' ') and stroki[j].strip():
                pm = POLE_OBJ.match(stroki[j])
                if pm:
                    polya.append((pm.group(1).strip().strip('«»'), (pm.group(2) or pm.group(3) or '').strip()))
                j += 1
            out.setdefault(m.group(1), ('объект', [(m.group(1), polya)], []))
            i = j
            continue
        i += 1
    return out

IMYA_TIPA = re.compile(r'^«([^»]+)»(?:\s+от\s+(.*))?$')

def _dovody(hvost):
    """`числа и строки` → ['числа', 'строки']; скобок в корпусе нет."""
    return [x.strip() for x in re.split(r'\s+и\s+', hvost)] if hvost else []

# родительный падеж в записи `«Возможно» от числа` против `число` в подписи
PADEZH = {'числа': 'число', 'строки': 'строка', 'признака': 'признак'}

VTORYE = {'число': '0 минус 7', 'нат': '7', 'строка': '"я"', 'признак': 'да', 'сотых': '7'}

def zaglushka(tip, izvestnye=None, glubina=0, podstanovka=None, rezhim='первая'):
    """rezhim='первая' — постоянная-ноль; 'вторая' — заведомо ДРУГАЯ постоянная
    той же подписи. Утверждение, пережившее ОБЕ, про подпись наверняка; одна
    подмена даёт только оценку сверху."""
    if tip is None or glubina > 4:
        return None
    t = PADEZH.get(tip.strip(), tip.strip())
    if podstanovka and t.strip('«»') in podstanovka:
        t = podstanovka[t.strip('«»')]
        t = PADEZH.get(t, t)
    if t in ZAGLUSHKI:
        return (VTORYE if rezhim == 'вторая' else ZAGLUSHKI)[t]
    if t.startswith('список'):
        if rezhim == 'вторая':
            el = zaglushka(t[len('список'):].strip(), izvestnye, glubina + 1, podstanovka, rezhim)
            if el is not None:
                return '[' + (('(' + el + ')') if el.startswith(('вариант ', 'запись ')) else el) + ']'
        return 'пустой список'
    m = IMYA_TIPA.match(t)
    if m and izvestnye:
        z = izvestnye.get(m.group(1))
        if z:
            rod, varianty, paramy = z
            pod = dict(zip(paramy, _dovody(m.group(2)))) if paramy else {}
            # бесполевой вариант — самая простая заглушка; во второй раз наоборот,
            # самый «полный», и поля другие
            poryadok = sorted(varianty, key=lambda v: len(v[1]), reverse=(rezhim == 'вторая'))
            for vimya, polya in poryadok:
                chasti = []
                plohо = False
                for k, pt in polya:
                    d = zaglushka(pt, izvestnye, glubina + 1, pod, rezhim)
                    if d is None:
                        plohо = True
                        break
                    if d.startswith('вариант ') or d.startswith('запись '):
                        d = '(' + d + ')'
                    chasti.append('%s равным %s' % (k, d))
                if plohо:
                    continue
                slovo = 'вариант' if rod == 'вариант' else 'запись'
                return ('%s «%s»' % (slovo, vimya)) + ((' с ' + ' и '.join(chasti)) if chasti else '')
    return None

if __name__ == '__main__':
    tekst = open(sys.argv[1], encoding='utf-8').read()
    stroki, funkcii = razobrat(tekst)
    for f in funkcii:
        telo = '\n'.join(stroki[f['telo']:f['telo_do']]) if f['telo'] is not None else '‹НЕТ›'
        print('%-40s строки %d..%d  возвращает %-22s примеров %d  заглушка %s' %
              (f['imya'], f['nachalo']+1, f['konec'], str(f['vozvrashchaet'])[:22], len(f['primery']), zaglushka(f['vozvrashchaet'])))
        print('    тело: %s' % telo.strip().replace('\n', ' ⏎ ')[:140])
