#!/usr/bin/env bash
# П5 — ПОРЧА ПРАВИЛА ЯДРА. Дерево исходников НЕ ТРОГАЕТСЯ ни байтом; меняется
# ПРОВЕРЯЛЬЩИК: в копии семени «Предел ветвления» (flang/self/proof-kernel.flang:7000)
# переписан с 4 на 0. Это правило ядра, а не оформление: им ограничено ветвление
# при сведении цели.
#
# Спрашивается ровно одно: меняются ли ПРИГОВОРЫ при неизменном дереве. Если да —
# всякий кеш, чей ключ считан ТОЛЬКО по дереву, при смене проверяльщика отдаёт
# ложное доказательство. Заодно проверяется «Версия ядра» (proofterm.flang:102):
# годится ли она отпечатком правил.
#
# КОДЫ ВОЗВРАТА ЗДЕСЬ ПЕРЕВЁРНУТЫ ОТНОСИТЕЛЬНО ПРИВЫЧНОГО, и это нарочно: 1 —
# находка, ради которой опыт и ставился (дерево то же, ключ по дереву тот же,
# приговоры иные, значит кеш без отпечатка проверяльщика солгал бы); 0 —
# приговоры не разошлись, находки нет.
#
#   bash проба-ядром.sh <целое-семя> <порченое-семя> <вход.flang> <куда>
set -u
export LC_ALL=C.UTF-8
tseloe=${1:?целое семя}
porchenoe=${2:?порченое семя}
vhod=${3:?вход}
kuda=${4:?куда}
mkdir -p "$kuda"

echo "── дерево одно и то же на оба прогона ──"
sha256sum "$vhod" | sed 's/^/  /'

for s in "$tseloe" "$porchenoe"; do
  metka=$(basename "$s")
  FLANG_KESH=1 FLANG_KESH_ONLY=1 FLANG_KESH_KERNEL=одинаковый-по-дереву \
    "$s/flang" check "$vhod" > /dev/null 2> "$kuda/yadro-$metka.klyuchi"
  kod=$?
  "$s/flang" check "$vhod" --proof > "$kuda/yadro-$metka.vedomost" 2>&1
  kod2=$?
  /usr/bin/grep -a '^ОБЯЗ' "$kuda/yadro-$metka.klyuchi" | LC_ALL=C sort > "$kuda/yadro-$metka.oblig"
  echo "  «$metka»: ключи код $kod, ведомость код $kod2, обязательств $(wc -l < "$kuda/yadro-$metka.oblig")"
done

echo "── «Версия ядра», как её печатает каждый двоичный ──"
for s in "$tseloe" "$porchenoe"; do
  metka=$(basename "$s")
  echo "  $metka: $(/usr/bin/grep -a -o '"kernel":[0-9]*' "$kuda/yadro-$metka.vedomost" | head -1)$(/usr/bin/grep -a -c 'доказано' "$kuda/yadro-$metka.vedomost" > /dev/null; true)"
done

python3 - "$kuda" "$(basename "$tseloe")" "$(basename "$porchenoe")" <<'ПИТОН'
import sys, os
kuda, a_m, b_m = sys.argv[1], sys.argv[2], sys.argv[3]
def read(m):
    out = {}
    for line in open(os.path.join(kuda, 'yadro-%s.oblig' % m), encoding='utf-8'):
        f = line.rstrip('\n').split('\t')
        out[(f[1], f[2])] = f
    return out
a, b = read(a_m), read(b_m)
inache = sovpal = 0
for k in sorted(set(a) | set(b)):
    ra, rb = a.get(k), b.get(k)
    if ra is None or rb is None:
        print('  %-18s %-38s ПОЯВИЛОСЬ/ПРОПАЛО' % k)
        continue
    v = ra[3] == rb[3]
    kl = ra[7] == rb[7]
    if not v:
        inache += 1
    if kl:
        sovpal += 1
    print('  %-18s %-38s приговор %s→%s  ключ по дереву %s' % (
        k[0], k[1], ra[3], rb[3], 'ТОТ ЖЕ' if kl else 'иной'))
print('  ИТОГ: приговоров изменилось %d, ключей по дереву совпало %d из %d' % (inache, sovpal, len(a)))
if inache > 0 and sovpal == len(a):
    print('  ЛОЖНОЕ ДОКАЗАТЕЛЬСТВО: дерево то же, ключ тот же, приговор иной —')
    print('  кеш без отпечатка ПРОВЕРЯЛЬЩИКА отдал бы «доказано» на недоказанное.')
    sys.exit(1)
sys.exit(0)
ПИТОН
