#!/usr/bin/env bash
# Вшивает прибор Ч183 в СЕМЯ (копию каталога bootstrap) и собирает двоичный.
#
# Семя правится нарочно: правка в flang/src/emit/c/** доехала бы до двоичного
# только перепечаткой компилятора самим собой — часы на прогон, а мерить надо
# сегодня. Своё дерево исходников при этом не трогается ни одной строкой.
# Тем же приёмом мерил Ч180 (benchmarks/суд-ядра-по-ядрам/встроить.sh).
#
#   bash встроить.sh <куда-класть-семя>
#
# Дальше:
#   FLANG_KESH=1 <куда>/flang check <файл>              ключи и приговоры
#   FLANG_KESH=1 FLANG_KESH_ONLY=1 ...                  без второго прогона ядра
#   FLANG_KESH=1 FLANG_KESH_TOLKO_KLYUCHI=1 ...         одни ключи, ядро не звано
#   FLANG_KESH=1 FLANG_KESH_TSENA=1 ...                 ещё и цена
#
# Отпечаток проверяльщика прибор снимает сам (/proc/self/exe); переменной среды
# он больше не приезжает — см. замер.sh.
set -e
export LC_ALL=C.UTF-8
here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../.." && pwd)
semya=${1:?куда класть семя}
rm -rf "$semya"
cp -a "$root/bootstrap" "$semya"
python3 - "$here" "$semya" <<'ПИТОН'
import sys
here, semya = sys.argv[1], sys.argv[2]
p = semya + '/flang_repl.c'
src = open(p, encoding='utf-8').read()
pribor = open(here + '/прибор.c', encoding='utf-8').read()

yakor = 'static bool repl_check_sources(fl_value sources, const char *entry, repl_bads *bads, fl_value *program,'
assert src.count(yakor) == 1, 'якорь объявления не единственный'
src = src.replace(yakor, pribor + "\n" + yakor, 1)

mesto = '''  if (kernel) {
    fl_value kernel_args[2];
    fl_value verdict = fl_nothing();
    fl_value kernel_bads = fl_nothing();
    kernel_args[0] = *program;
    kernel_args[1] = total;'''
assert src.count(mesto) == 1, 'якорь вызова ядра не единственный'
src = src.replace(mesto, '''  if (kernel) {
    fl_value kernel_args[2];
    fl_value verdict = fl_nothing();
    fl_value kernel_bads = fl_nothing();
    double kesh_t0 = 0.0;
    if (kesh_wanted()) {
      kesh_run(*program, total);
      if (getenv("FLANG_KESH_ONLY") != NULL) {
        return true;
      }
    }
    kesh_t0 = machine_now();
    kernel_args[0] = *program;
    kernel_args[1] = total;''', 1)

zov = '''    if (repl_call("Суд ядра о программе", kernel_args, 2, &verdict) != FL_OK) {
      bads_say(bads, "ядро доказательства прекращено");
      return false;
    }'''
assert src.count(zov) == 1, 'якорь самого вызова не единственный'
src = src.replace(zov, zov + '''
    if (kesh_wanted()) {
      fprintf(stderr, "кеш: «Суд ядра о программе» ЦЕЛИКОМ %.3f с, шагов %lu\\n",
              machine_now() - kesh_t0, (unsigned long) repl_ctx.steps);
    }''', 1)

open(p, 'w', encoding='utf-8').write(src)
ПИТОН
make -C "$semya" -j8
