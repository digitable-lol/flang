#!/usr/bin/env bash
# Вшивает оба прибора в СЕМЯ (копию каталога bootstrap) и собирает двоичный.
# Семя правится нарочно: правка в flang/src/emit/c/** доехала бы до двоичного
# только перепечаткой компилятора самим собой — час на прогон, а мерить надо
# сегодня. Своё дерево исходников при этом не трогается ни одной строкой.
#
#   bash встроить.sh <куда-копировать-семя>
#
# Дальше: FLANG_KERNEL_SPLIT=<долей> [FLANG_KERNEL_SNAPSHOT=1] <куда>/flang check <файл>
set -e
export LC_ALL=C.UTF-8
here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../.." && pwd)
seed=${1:?куда класть семя}
cp -a "$root/bootstrap" "$seed"
python3 - "$here" "$seed" <<'ПИТОН'
import sys
here, seed = sys.argv[1], sys.argv[2]
p = seed + '/flang_repl.c'
src = open(p, encoding='utf-8').read()
доли = open(here + '/прибор.c', encoding='utf-8').read()
снимком = open(here + '/снимком.c', encoding='utf-8').read()
якорь = 'static bool repl_check_sources(fl_value sources, const char *entry, repl_bads *bads, fl_value *program,'
assert src.count(якорь) == 1
src = src.replace(якорь, доли + "\n" + якорь, 1)
якорь = 'static void repl_kernel_split(fl_value program, fl_value total, size_t shards) {'
assert src.count(якорь) == 1
src = src.replace(якорь, снимком + "\n" + якорь, 1)
зов = '''  fprintf(stderr, "доли: «Закрыть без теорем» %.3f с, шагов %lu, закрыто %lu\\n", sec, split_steps,
          closed.tag == FL_LIST ? (unsigned long) closed.as.list.count : 0UL);'''
assert src.count(зов) == 1
src = src.replace(зов, зов + '''
  if (getenv("FLANG_KERNEL_SNAPSHOT") != NULL) {
    repl_kernel_snapshot(program, without, unpaid,
                         closed.tag == FL_LIST ? closed.as.list.count : 0);
  }''', 1)
место = '''  if (kernel) {
    fl_value kernel_args[2];
    fl_value verdict = fl_nothing();
    fl_value kernel_bads = fl_nothing();
    kernel_args[0] = *program;
    kernel_args[1] = total;'''
assert src.count(место) == 1
src = src.replace(место, '''  if (kernel) {
    fl_value kernel_args[2];
    fl_value verdict = fl_nothing();
    fl_value kernel_bads = fl_nothing();
    const size_t split_want = split_shards();
    if (split_want > 0) {
      repl_kernel_split(*program, total, split_want);
    }
    kernel_args[0] = *program;
    kernel_args[1] = total;''', 1)
open(p, 'w', encoding='utf-8').write(src)
ПИТОН
make -C "$seed" -j8
