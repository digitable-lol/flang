#!/bin/sh
# SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
# SPDX-License-Identifier: BSD-2-Clause
#
# СОГЛАСИЕ НАЗВАНО ТАМ, ГДЕ ОНО НУЖНО, И НИГДЕ БОЛЬШЕ (ADR-0045, задача 3811).
#
#   sh scripts/guards/run-verdict-debt-guard.sh            сверка, код 1 при расхождении
#   sh scripts/guards/run-verdict-debt-guard.sh --список    имена из ведомости, по одному в строке
#
# ── Что здесь стережётся ────────────────────────────────────────────────────
# С ADR-0045 `flang run` и `flang io` считают вердикт о доказанности и
# недоказанную программу не запускают вовсе (код 3). Инструменты ЭТОГО дерева
# судятся тем же вердиктом, что чужие программы, и часть их его не проходит:
# замер 18 сентября 2026 — ведомость flang/scripts/run-verdict-debt.tsv.
#
# Такой вызов обязан называть согласие ключом `--на-веру` прямо в строке вызова
# — не переменной среды, не умолчанием, не тишиной. Обратное тоже стережётся:
# ключ у инструмента, который вердикт ПРОХОДИТ, — это ложь о доказанности в
# другую сторону, и он краснеет как надгробие (долг закрыт, запись осталась).
#
# ── Почему строки склеиваются перед поиском ─────────────────────────────────
# В `ярлыки.flang` команда собрана из кусков: «соединить ["bootstrap/flang io ",
# "файл --plan ", "'Имя'"] по ""». Построчный поиск увидел бы «flang io» в одной
# строке, а ключ — в другой, и решил бы, что ключа нет. Поэтому куски сначала
# склеиваются ровно так, как их склеивает «соединить … по ""»: соседние строковые
# литералы, разделённые запятой и переводом строки, становятся одним.
#
# Коды: 0 — сошлось; 1 — разошлось (каждое место названо); 2 — довод непонятен;
#       3 — нет ведомости или нечем считать.
set -u

KOREN=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
VEDOMOST=$KOREN/flang/scripts/run-verdict-debt.tsv
BEZYMYANNYE=$KOREN/flang/scripts/run-verdict-targets-not-named.tsv

[ -f "$VEDOMOST" ] || { echo "нет ведомости $VEDOMOST" >&2; exit 3; }
[ -f "$BEZYMYANNYE" ] || { echo "нет ведомости $BEZYMYANNYE" >&2; exit 3; }
command -v python3 > /dev/null 2>&1 || { echo "нет python3 — сверять нечем" >&2; exit 3; }

case "${1:-}" in
  --список) awk -F'\t' '!/^#/ && $1 != "файл" && NF >= 2 {print $1}' "$VEDOMOST"; exit 0 ;;
  '') ;;
  *) echo "непонятный довод «$1»" >&2; exit 2 ;;
esac

python3 - "$KOREN" "$VEDOMOST" "$BEZYMYANNYE" <<'PY'
import io, os, re, sys

koren, vedomost, bezymyannye_put = sys.argv[1], sys.argv[2], sys.argv[3]

# Места, где цель — переменная: файл → (нужен ли ключ, довод).
bezymyannye = {}
for stroka in io.open(bezymyannye_put, encoding='utf-8'):
    if stroka.startswith('#') or not stroka.strip():
        continue
    pole = stroka.rstrip('\n').split('\t')
    if pole[0] == 'файл' or len(pole) < 3:
        continue
    bezymyannye[pole[0]] = (pole[1].strip() == 'да', pole[2])

dolg = set()
for stroka in io.open(vedomost, encoding='utf-8'):
    if stroka.startswith('#') or not stroka.strip():
        continue
    pole = stroka.rstrip('\n').split('\t')
    if pole[0] == 'файл' or len(pole) < 2:
        continue
    dolg.add(pole[0])

# Где ищем вызовы: только то, что вызывает НА САМОМ ДЕЛЕ.
mesta = ['ярлык', 'ярлыки.flang']
for koren_kat in ('.github/workflows', '.github/actions', 'scripts', 'flang'):
    for kat, _, imena in os.walk(os.path.join(koren, koren_kat)):
        for imya in imena:
            if imya.endswith(('.sh', '.yml', '.fscript')):
                mesta.append(os.path.relpath(os.path.join(kat, imya), koren))

SKLEYKA = re.compile(r'",\s*\n\s*"')
VYZOV = re.compile(r'flang"?\s+(run|io)\s+("?)([^\s"\']+\.(?:flang|fscript))')
# Цель, которой НЕТ ИМЕНИ: «$file», «${путь}», «$1». Такое место сторож по имени
# узнать не может — значит правило для него другое и названо вслух: не можешь
# назвать цель, назови согласие. 18 сентября 2026 ровно такое место — обходчик
# проверок flang/test/обход.sh:140, `"$tool" run "$file"` — прошло мимо первой
# редакции этого сторожа и покраснело уже в CI: недоказанные проверки дерева
# перестали запускаться, а сторож отвечал «согласие названо ровно там, где нужно».
# Двоичный тоже зовут через переменную: «"$tool" run», «"$FLANG" io». Оба конца
# вызова — и двоичный, и цель — бывают безымянными, и оба ловятся здесь.
DVOICHNYY = r'(?:flang"?|"?\$\{?[A-Za-z_][A-Za-z0-9_]*\}?"?)'
VYZOV_PEREMENNAYA = re.compile(DVOICHNYY + r'\s+(?:run|io)\s+"?\$')

zhaloby = []
zvano = {}
bezymyannyh = 0
vidno = set()
for put in sorted(set(mesta)):
    polnyy = os.path.join(koren, put)
    if not os.path.isfile(polnyy):
        continue
    try:
        text = io.open(polnyy, encoding='utf-8').read()
    except (UnicodeDecodeError, OSError):
        continue
    if put.endswith('.flang'):
        text = SKLEYKA.sub('', text)
    for stroka in text.split('\n'):
        golo = stroka.lstrip()
        if golo.startswith('#') or golo.startswith('//'):
            continue
        # Строки примеров («дано …», «ожидается …») — не вызовы, а данные: там
        # стоит ЖДАННОЕ значение, и ключ в нём означал бы другое ожидание, а не
        # другое согласие.
        if golo.startswith('дано ') or golo.startswith('ожидается '):
            continue
        for sovpadenie in VYZOV.finditer(stroka):
            cel = sovpadenie.group(3)
            hvost = stroka[sovpadenie.end():]
            soglasie = '--на-веру' in hvost or '--trust' in hvost
            zvano.setdefault(cel, []).append((put, soglasie))
        # Переменная в позиции цели красна только тогда, когда имени цели на
        # строке НЕТ ВОВСЕ: «$KOREN/scripts/settings-file.flang» — имя, просто с
        # приставкой, и такое место разбирается выше по имени.
        if VYZOV_PEREMENNAYA.search(stroka) and not VYZOV.search(stroka):
            bezymyannyh += 1
            vidno.add(put)
            if put not in bezymyannye:
                zhaloby.append('ЦЕЛЬ БЕЗ ИМЕНИ И БЕЗ ЗАПИСИ: %s зовёт run/io на переменной — вписать в flang/scripts/run-verdict-targets-not-named.tsv с доводом' % put)
            elif bezymyannye[put][0] and not ('--на-веру' in stroka or '--trust' in stroka):
                zhaloby.append('ЗАПИСЬ ТРЕБУЕТ КЛЮЧА, А ЕГО НЕТ: %s — «%s»' % (put, bezymyannye[put][1][:80]))

for cel in sorted(zvano):
    for put, soglasie in zvano[cel]:
        if cel in dolg and not soglasie:
            zhaloby.append('НЕТ СОГЛАСИЯ: %s зовёт %s, а тот вердикта не проходит — нужен --на-веру' % (put, cel))
        if cel not in dolg and soglasie:
            zhaloby.append('СОГЛАСИЕ ЛИШНЕЕ: %s зовёт %s с --на-веру, а тот вердикт ПРОХОДИТ — ключ убрать' % (put, cel))

nezvano = sorted(c for c in dolg if c not in zvano)

print('СОГЛАСИЕ ПРИ ЗАПУСКЕ (ADR-0045, задача 3811)')
print('  записей в ведомости:  %d' % len(dolg))
print('  целей найдено в дереве: %d, вызовов: %d' % (len(zvano), sum(len(v) for v in zvano.values())))
print('  вызовов на переменной (имени цели нет): %d в %d файлах, записано %d' % (bezymyannyh, len(vidno), len(bezymyannye)))
for lishniy in sorted(set(bezymyannye) - vidno):
    zhaloby.append('ЗАПИСЬ ОСТАЛАСЬ, А МЕСТА НЕТ: %s больше не зовёт run/io на переменной — убрать из run-verdict-targets-not-named.tsv' % lishniy)
print('  записей, которых в дереве не зовут: %d%s'
      % (len(nezvano), (' (' + ', '.join(nezvano) + ')') if nezvano else ''))
if zhaloby:
    print('')
    for zh in zhaloby:
        print('  ✘ ' + zh)
    print('')
    print('РАЗОШЛОСЬ: жалоб %d' % len(zhaloby))
    sys.exit(1)
print('')
print('СОШЛОСЬ: согласие названо ровно там, где нужно')
PY
