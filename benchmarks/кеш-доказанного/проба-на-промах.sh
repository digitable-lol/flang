#!/usr/bin/env bash
# ПРОБА НА ПРОМАХ: каждая зависимость доказательства портится ПО ОДНОЙ, и с
# каждой спрашивается три ответа, снятых НЕЗАВИСИМО друг от друга:
#
#   1. ПОРЧА СЛУЧИЛАСЬ — файл правда изменился, и изменилась ровно одна
#      названная строка (`git diff --numstat`). Порча, которая ничего не
#      испортила, выглядит как успех — docs/zettel/a-sabotage-test-that-
#      sabotages-nothing-looks-like-success.md;
#   2. ПРИГОВОР ИЗМЕНИЛСЯ — ядро на испорченном дереве закрывает НЕ ТО, что
#      закрывало. Спрашивается у самого ядра, а не у ключа;
#   3. КЛЮЧ ИЗМЕНИЛСЯ — полный ключ обязан промахнуться. Рядом печатается
#      наивный ключ (только своя функция): он показывает, какой именно кеш
#      отдал бы «доказано» на то, что уже не доказано.
#
# Порча правится ПО НОМЕРУ СТРОКИ, а не по первому вхождению образца.
#
# КОДЫ ВОЗВРАТА: 0 — полный ключ промахнулся всюду, где менялся приговор (так и
# должно быть); 1 — НАЙДЕНО ЛОЖНОЕ ДОКАЗАТЕЛЬСТВО у полного ключа; 3 — порча не
# применилась, то есть опыт НЕ ПРОВЕДЁН (не «зелено»).
#
#   bash проба-на-промах.sh <семя> <куда-складывать>
set -u
export LC_ALL=C.UTF-8
semya=${1:?семя}
kuda=${2:?куда}
here=$(cd "$(dirname "$0")" && pwd)
koren=$(cd "$here/../.." && pwd)
proba="$here/проба.flang"
mkdir -p "$kuda"

zamer() {  # <метка>
  metka=$1
  otpechatok=$(cat "$koren/flang/self/proofterm.flang" \
                   "$koren/flang/self/proof-kernel.flang" \
                   "$koren/flang/self/proof-initial.flang" \
                   "$koren/flang/self/obligations.flang" | sha256sum | cut -c1-32)
  FLANG_KESH=1 FLANG_KESH_ONLY=1 FLANG_KESH_KERNEL="$otpechatok" \
    "$semya/flang" check "$proba" > /dev/null 2> "$kuda/$metka.klyuchi"
  kod=$?
  "$semya/flang" check "$proba" --proof > "$kuda/$metka.vedomost" 2>&1
  kod2=$?
  /usr/bin/grep -a '^ОБЯЗ' "$kuda/$metka.klyuchi" | LC_ALL=C sort > "$kuda/$metka.oblig"
  echo "  замер «$metka»: ключи код $kod, ведомость код $kod2, обязательств $(wc -l < "$kuda/$metka.oblig")"
}

sravnit() {  # <метка>
  metka=$1
  python3 - "$kuda/osnova.oblig" "$kuda/$metka.oblig" <<'ПИТОН'
import sys
def read(p):
    out = {}
    for line in open(p, encoding='utf-8'):
        f = line.rstrip('\n').split('\t')
        out[(f[1], f[2])] = f
    return out
a = read(sys.argv[1])
b = read(sys.argv[2])
polnyy_sovpal = naivnyy_sovpal = prigovor_tot_zhe = 0
lozh = []
for k in sorted(set(a) | set(b)):
    ra, rb = a.get(k), b.get(k)
    if ra is None or rb is None:
        print('  %-18s %-38s ПОЯВИЛОСЬ/ПРОПАЛО' % (k[0], k[1]))
        continue
    p = ra[7] == rb[7]
    n = ra[8] == rb[8]
    v = ra[3] == rb[3]
    polnyy_sovpal += p
    naivnyy_sovpal += n
    prigovor_tot_zhe += v
    print('  %-18s %-38s приговор %s→%s  полный %s  наивный %s' % (
        k[0], k[1], ra[3], rb[3],
        'ТОТ ЖЕ (промаха нет)' if p else 'ИНОЙ (промах)',
        'ТОТ ЖЕ (промаха нет)' if n else 'ИНОЙ (промах)'))
    if not v and p:
        lozh.append(('полный', k))
    if not v and n:
        lozh.append(('наивный', k))
print('  ИТОГ: приговор не изменился у %d, полный ключ совпал у %d, наивный совпал у %d' % (
    prigovor_tot_zhe, polnyy_sovpal, naivnyy_sovpal))
for vid, k in lozh:
    print('  ЛОЖНОЕ ДОКАЗАТЕЛЬСТВО: %s ключ у «%s»/«%s» не изменился, а приговор изменился' % (vid, k[0], k[1]))
sys.exit(1 if any(v == 'полный' for v, _ in lozh) else 0)
ПИТОН
}

isportit() {  # <номер строки> <новая строка> <что ждали в старой>
  nomer=$1
  novaya=$2
  zhdali=$3
  bylo=$(sed -n "${nomer}p" "$proba")
  case "$bylo" in
    *"$zhdali"*) ;;
    *) echo "  ПОРЧА НЕ ПРИМЕНЕНА: в строке $nomer нет «$zhdali», там «$bylo»"; return 3 ;;
  esac
  cp "$proba" "$kuda/цел.flang"
  python3 - "$proba" "$nomer" "$novaya" <<'ПИТОН'
import sys
p, n, s = sys.argv[1], int(sys.argv[2]), sys.argv[3]
lines = open(p, encoding='utf-8').read().split('\n')
lines[n - 1] = s
open(p, 'w', encoding='utf-8').write('\n'.join(lines))
ПИТОН
  if cmp -s "$proba" "$kuda/цел.flang"; then
    echo "  ПОРЧА НИЧЕГО НЕ ИСПОРТИЛА: файл побайтово тот же"
    return 3
  fi
  izmeneno=$(diff "$kuda/цел.flang" "$proba" | /usr/bin/grep -a -c '^[<>]')
  echo "  порча в строке $nomer применена, изменённых строк в diff: $izmeneno"
  return 0
}

vernut() {
  cp "$kuda/цел.flang" "$proba"
}

echo "══ основа (ничего не испорчено) ══"
zamer osnova
/usr/bin/grep -a 'постусловие' "$kuda/osnova.vedomost" | sed 's/^/  /'

itog=0

echo
echo "══ П1: испорчено ТЕЛО ВЫЗВАННОЙ («Вес мешка», строка 26) ══"
if isportit 26 '      то (гиря минус 1)' 'то гиря'; then
  zamer p1
  sravnit p1 || itog=1
  vernut
else
  itog=3
fi

echo
echo "══ П2: испорчено ОБЪЯВЛЕНИЕ ТИПА («Мешок», строка 15) ══"
if isportit 15 '  вариант «Полный» содержит вес: число' 'вес: нат'; then
  zamer p2
  sravnit p2 || itog=1
  vernut
else
  itog=3
fi

echo
echo "══ П3: испорчено ПРЕДУСЛОВИЕ ВЫЗВАННОЙ («Вес мешка», строка 20) ══"
if isportit 20 '  требует «мешок дан» 0 больше 100' 'требует «мешок дан»'; then
  zamer p3
  sravnit p3 || itog=1
  vernut
else
  itog=3
fi

echo
echo "══ П4: СДВИГ МЕСТ — пустая строка вверху, приговоры те же ══"
cp "$proba" "$kuda/цел.flang"
python3 - "$proba" <<'ПИТОН'
import sys
p = sys.argv[1]
lines = open(p, encoding='utf-8').read().split('\n')
lines.insert(1, '')
open(p, 'w', encoding='utf-8').write('\n'.join(lines))
ПИТОН
if cmp -s "$proba" "$kuda/цел.flang"; then
  echo "  ПОРЧА НИЧЕГО НЕ ИСПОРТИЛА"
  itog=3
else
  zamer p4
  sravnit p4 || true
fi
vernut

echo
echo "══ итог пробы: $itog ══"
exit "$itog"
