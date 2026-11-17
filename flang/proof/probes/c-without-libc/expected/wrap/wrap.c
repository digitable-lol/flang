/*
 * Сгенерировано flang: C без libc (flang/self/c-without-libc.flang).
 * Модуль flang: «Заворот». Файл: wrap.c.
 * Собирается с -ffreestanding -nostdlib: ни libc, ни потоков, ни выделения памяти.
 * Не редактировать руками — правьте исходник на flang и генерируйте заново.
 */
#include "wrap.h"


uint64_t zavorot_summa_s_zavorotom(uint64_t p0_a, uint64_t p1_b) {
  (void)p0_a;
  (void)p1_b;
  return fl_fs_u64_addw(p0_a, p1_b);
}

fl_fs_status zavorot_summa_s_otkazom(uint8_t p0_a, uint8_t p1_b, uint8_t *out) {
  (void)p0_a;
  (void)p1_b;
  uint8_t t0;
  FL_FS_TRY(fl_fs_u8_add(p0_a, p1_b, &t0));
  *out = t0;
  return FL_FS_OK;
}

fl_fs_status zavorot_chastnoe(uint64_t p0_a, uint64_t p1_b, uint64_t *out) {
  (void)p0_a;
  (void)p1_b;
  uint64_t t0;
  FL_FS_TRY(fl_fs_u64_div(p0_a, p1_b, &t0));
  *out = t0;
  return FL_FS_OK;
}
