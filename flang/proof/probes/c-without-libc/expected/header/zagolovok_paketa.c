/*
 * Сгенерировано flang: C без libc (flang/self/emit-c-freestanding.flang).
 * Модуль flang: «Заголовок пакета». Файл: zagolovok_paketa.c.
 * Собирается с -ffreestanding -nostdlib: ни libc, ни потоков, ни выделения памяти.
 * Не редактировать руками — правьте исходник на flang и генерируйте заново.
 */
#include "zagolovok_paketa.h"


uint32_t zagolovok_paketa_versiya(uint32_t p0_slovo) {
  (void)p0_slovo;
  return ((uint32_t)((p0_slovo) >> 28));
}

uint32_t zagolovok_paketa_dlina_zagolovka(uint32_t p0_slovo) {
  (void)p0_slovo;
  return ((uint32_t)(((uint32_t)((p0_slovo) >> 24)) & ((uint32_t)UINT32_C(15))));
}

uint32_t zagolovok_paketa_polnaya_dlina(uint32_t p0_slovo) {
  (void)p0_slovo;
  return ((uint32_t)(p0_slovo & ((uint32_t)UINT32_C(65535))));
}

uint64_t zagolovok_paketa_starshaya_polovina(uint64_t p0_slovo) {
  (void)p0_slovo;
  return ((uint64_t)((p0_slovo) >> 32));
}

fl_fs_status zagolovok_paketa_versiya_chislom(uint32_t p0_slovo, int64_t *out) {
  (void)p0_slovo;
  const int64_t t0 = fl_fs_word_num(zagolovok_paketa_versiya(p0_slovo));
  (void)t0;
  if (!((t0 >= INT64_C(0)))) return FL_FS_POSTCONDITION;
  if (!((t0 <= INT64_C(15)))) return FL_FS_POSTCONDITION;
  *out = t0;
  return FL_FS_OK;
}

zagolovok_paketa_zagolovok_t zagolovok_paketa_razobrat(uint32_t p0_slovo) {
  (void)p0_slovo;
  const uint32_t v0_v = zagolovok_paketa_versiya(p0_slovo);
  (void)v0_v;
  const uint32_t v1_d = zagolovok_paketa_dlina_zagolovka(p0_slovo);
  (void)v1_d;
  const uint32_t v2_p = zagolovok_paketa_polnaya_dlina(p0_slovo);
  (void)v2_p;
  zagolovok_paketa_zagolovok_t t3;
  t3.versiya = v0_v;
  t3.dlina_zagolovka = v1_d;
  t3.polnaya_dlina = v2_p;
  return t3;
}
