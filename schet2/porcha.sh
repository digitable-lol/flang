#!/bin/sh
# ПОРЧА: два файла, различие в одну строку. Ослабление посылки под доказанным
# утверждением ОБЯЗАНО менять вердикт вывода. Зовут: sh porcha.sh <двоичный> <куда>
set -u
DVOICH=$1
KUDA=$2
mkdir -p "$KUDA"
for p in a b; do
  PAMYAT=60G CHISLO=30 POROG=120G ZHDAT=7200 /srv/flang-rabota/vorota/flang-vorota -- \
    "$DVOICH" check --proof --json /srv/flang-rabota/u-uslovno2/schet2/proba-$p.flang \
    > "$KUDA/proba-$p.json" 2> "$KUDA/proba-$p.err"
  echo "proba-$p код=$?"
done
python3 - "$KUDA" <<'PY'
import json,sys
kat=sys.argv[1]
for p in 'ab':
    d=json.load(open(f'{kat}/proba-{p}.json'))
    print(f'── proba-{p} ──')
    for u in d['claims']:
        print('   ', json.dumps(u,ensure_ascii=False))
    print('    итоги:', json.dumps(d['totals']['claims'],ensure_ascii=False))
a=json.load(open(f'{kat}/proba-a.json'))
b=json.load(open(f'{kat}/proba-b.json'))
def stroka(d):
    return [u for u in d['claims'] if u['name']=='длина пары два'][0]
sa,sb=stroka(a),stroka(b)
print()
print('вывод «длина пары два»:')
print('   proba-a:', sa['verdict'])
print('   proba-b:', sb['verdict'])
print('РАЗЛИЧАЮТСЯ' if sa['verdict']!=sb['verdict'] else 'ОДИНАКОВЫ — порча НЕ ловится')
PY
