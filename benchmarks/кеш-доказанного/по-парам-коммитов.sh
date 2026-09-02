#!/usr/bin/env bash
# Сколько обязательств НЕ МЕНЯЕТСЯ между соседними коммитами ствола.
#
#   bash по-парам-коммитов.sh <клон> <вход.flang> <сколько коммитов> <куда> [откуда]
#
# «откуда» — коммит, от которого идти первым родителем; по умолчанию HEAD. Он
# нужен, чтобы мерить ТО ЖЕ ОКНО ИСТОРИИ, что мерила прошлая ячейка: доля
# попаданий у другого окна — другое число, и сличать их как «сошлось/не сошлось»
# было бы подлогом.
#
# Ключи считаются по ИСХОДНИКАМ (ключи-по-дереву.py), то есть без мест и без
# комментариев — это ВЕРХНЯЯ оценка попаданий. Ядро (двоичный, которым
# проверяют) во всех прогонах ОДНО И ТО ЖЕ, поэтому отпечаток ядра постоянен:
# спрашивается «что даёт кеш при неизменном проверяльщике».
set -u
export LC_ALL=C.UTF-8
klon=${1:?клон}
vhod=${2:?вход}
skolko=${3:?сколько коммитов}
kuda=${4:?куда}
otkuda=${5:-HEAD}
here=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$kuda"
derevo="$kuda/derevo"

if [ ! -d "$derevo" ]; then
  git -C "$klon" worktree add --detach "$derevo" HEAD > /dev/null 2>&1
  kod=$?
  echo "рабочее дерево заведено, код $kod"
fi

git -C "$klon" -c core.quotepath=false log --first-parent -"$skolko" --format='%h' "$otkuda" > "$kuda/kommity.txt"
echo "коммитов взято: $(wc -l < "$kuda/kommity.txt"), от $otkuda"

while read -r c; do
  if [ -s "$kuda/klyuchi-$c.txt" ]; then continue; fi
  git -C "$derevo" checkout -q --detach "$c" 2> /dev/null
  kod=$?
  if [ "$kod" != 0 ]; then echo "$c: не выложен, код $kod"; continue; fi
  python3 "$here/ключи-по-дереву.py" "$derevo" "$vhod" одно-и-то-же-ядро \
    > "$kuda/klyuchi-$c.txt" 2> "$kuda/klyuchi-$c.err"
  kod=$?
  echo "$c: код $kod, $(wc -l < "$kuda/klyuchi-$c.txt") обязательств, $(head -1 "$kuda/klyuchi-$c.err")"
done < "$kuda/kommity.txt"

python3 - "$kuda" "$klon" < /dev/null > /dev/null 2>&1 || true
python3 - "$kuda" "$klon" <<'ПИТОН'
import os, subprocess, sys
kuda, klon = sys.argv[1], sys.argv[2]
kommity = [c.strip() for c in open(os.path.join(kuda, 'kommity.txt'), encoding='utf-8') if c.strip()]

def read(c):
    p = os.path.join(kuda, 'klyuchi-%s.txt' % c)
    if not os.path.exists(p):
        return None
    out = {}
    for line in open(p, encoding='utf-8'):
        f = line.rstrip('\n').split('\t')
        if len(f) < 7:
            continue
        out[(f[2], f[3])] = (f[4], f[5], f[1])
    return out

print('%-10s %-10s %7s %7s %7s %7s  %s' % ('новый', 'прежний', 'всего', 'полный', 'наивный', 'файлов', 'что тронуто'))
vsego_o = vsego_p = vsego_n = 0
pary = 0
for i in range(len(kommity) - 1):
    novyy, prezhniy = kommity[i], kommity[i + 1]
    a, b = read(novyy), read(prezhniy)
    if a is None or b is None:
        continue
    obshchie = set(a) & set(b)
    p = sum(1 for k in obshchie if a[k][0] == b[k][0])
    n = sum(1 for k in obshchie if a[k][1] == b[k][1])
    vsego = len(set(a) | set(b))
    tronuto = subprocess.run(
        ['git', '-C', klon, '-c', 'core.quotepath=false', 'show', '--name-only', '--format=', novyy],
        capture_output=True, text=True).stdout.split()
    flang_tronuto = [t for t in tronuto if t.endswith('.flang')]
    print('%-10s %-10s %7d %7d %7d %7d  %s' % (
        novyy, prezhniy, vsego, p, n, len(flang_tronuto),
        ', '.join(flang_tronuto[:3]) + (' …' if len(flang_tronuto) > 3 else '')))
    vsego_o += vsego
    vsego_p += p
    vsego_n += n
    pary += 1
if pary:
    print()
    print('ИТОГ по %d парам: обязательств %d, полный ключ совпал %d (%.2f %%), наивный %d (%.2f %%)'
          % (pary, vsego_o, vsego_p, 100.0 * vsego_p / vsego_o, vsego_n, 100.0 * vsego_n / vsego_o))
ПИТОН
