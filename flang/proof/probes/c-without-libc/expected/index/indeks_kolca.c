/*
 * Сгенерировано flang: C без libc (flang/self/emit-c-freestanding.flang).
 * Модуль flang: «Индекс кольца». Файл: indeks_kolca.c.
 * Собирается с -ffreestanding -nostdlib: ни libc, ни потоков, ни выделения памяти.
 * Не редактировать руками — правьте исходник на flang и генерируйте заново.
 */
#include "indeks_kolca.h"


fl_fs_status indeks_kolca_sleduyuschiy_indeks(int64_t p0_indeks, int64_t *out) {
  (void)p0_indeks;
  FL_FS_TRY(fl_fs_valid_nat(p0_indeks));
  if (!((p0_indeks < INT64_C(8)))) return FL_FS_PRECONDITION;
  int64_t t1;
  if ((p0_indeks >= INT64_C(7))) {
    t1 = INT64_C(0);
  } else {
    int64_t t0;
    FL_FS_TRY(fl_fs_num_add(p0_indeks, INT64_C(1), &t0));
    t1 = t0;
  }
  int64_t t2;
  FL_FS_TRY(fl_fs_to_nat(t1, &t2));
  const int64_t t3 = t2;
  (void)t3;
  if (!((t3 < INT64_C(8)))) return FL_FS_POSTCONDITION;
  *out = t3;
  return FL_FS_OK;
}

fl_fs_status indeks_kolca_indeks_po_modulyu(int64_t p0_indeks, int64_t *out) {
  (void)p0_indeks;
  FL_FS_TRY(fl_fs_valid_nat(p0_indeks));
  int64_t t0;
  FL_FS_TRY(fl_fs_num_mod(p0_indeks, INT64_C(8), &t0));
  int64_t t1;
  FL_FS_TRY(fl_fs_to_nat(t0, &t1));
  const int64_t t2 = t1;
  (void)t2;
  if (!((t2 < INT64_C(8)))) return FL_FS_POSTCONDITION;
  *out = t2;
  return FL_FS_OK;
}

uint32_t indeks_kolca_indeks_slova(uint32_t p0_indeks) {
  (void)p0_indeks;
  return ((uint32_t)(p0_indeks & ((uint32_t)UINT32_C(7))));
}

fl_fs_status indeks_kolca_indeks_slova_chislom(uint32_t p0_indeks, int64_t *out) {
  (void)p0_indeks;
  const int64_t t0 = fl_fs_word_num(((uint32_t)(p0_indeks & ((uint32_t)UINT32_C(7)))));
  (void)t0;
  if (!((t0 <= INT64_C(7)))) return FL_FS_POSTCONDITION;
  *out = t0;
  return FL_FS_OK;
}
