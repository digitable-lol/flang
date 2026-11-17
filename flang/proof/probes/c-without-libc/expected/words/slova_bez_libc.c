/*
 * Сгенерировано flang: C без libc (flang/self/emit-c-freestanding.flang).
 * Модуль flang: «Слова без libc». Файл: slova_bez_libc.c.
 * Собирается с -ffreestanding -nostdlib: ни libc, ни потоков, ни выделения памяти.
 * Не редактировать руками — правьте исходник на flang и генерируйте заново.
 */
#include "slova_bez_libc.h"

static inline fl_fs_status slova_bez_libc_komanda_valid(const slova_bez_libc_komanda_t *v) {
  if (v->tag == slova_bez_libc_komanda_chitat) {
    return FL_FS_OK;
  }
  if (v->tag == slova_bez_libc_komanda_pisat) {
    return FL_FS_OK;
  }
  if (v->tag == slova_bez_libc_komanda_sdvinut) {
    return FL_FS_OK;
  }
  return FL_FS_BAD_TAG;
}


fl_fs_status slova_bez_libc_slozhit_8(uint8_t p0_a, uint8_t p1_b, uint8_t *out) {
  (void)p0_a;
  (void)p1_b;
  uint8_t t0;
  FL_FS_TRY(fl_fs_u8_add(p0_a, p1_b, &t0));
  *out = t0;
  return FL_FS_OK;
}

fl_fs_status slova_bez_libc_vychest_8(uint8_t p0_a, uint8_t p1_b, uint8_t *out) {
  (void)p0_a;
  (void)p1_b;
  uint8_t t0;
  FL_FS_TRY(fl_fs_u8_sub(p0_a, p1_b, &t0));
  *out = t0;
  return FL_FS_OK;
}

fl_fs_status slova_bez_libc_umnozhit_8(uint8_t p0_a, uint8_t p1_b, uint8_t *out) {
  (void)p0_a;
  (void)p1_b;
  uint8_t t0;
  FL_FS_TRY(fl_fs_u8_mul(p0_a, p1_b, &t0));
  *out = t0;
  return FL_FS_OK;
}

uint8_t slova_bez_libc_slozhit_po_modulyu_8(uint8_t p0_a, uint8_t p1_b) {
  (void)p0_a;
  (void)p1_b;
  return fl_fs_u8_addw(p0_a, p1_b);
}

uint8_t slova_bez_libc_vychest_po_modulyu_8(uint8_t p0_a, uint8_t p1_b) {
  (void)p0_a;
  (void)p1_b;
  return fl_fs_u8_subw(p0_a, p1_b);
}

uint8_t slova_bez_libc_umnozhit_po_modulyu_8(uint8_t p0_a, uint8_t p1_b) {
  (void)p0_a;
  (void)p1_b;
  return fl_fs_u8_mulw(p0_a, p1_b);
}

fl_fs_status slova_bez_libc_podelit_8(uint8_t p0_a, uint8_t p1_b, uint8_t *out) {
  (void)p0_a;
  (void)p1_b;
  uint8_t t0;
  FL_FS_TRY(fl_fs_u8_div(p0_a, p1_b, &t0));
  *out = t0;
  return FL_FS_OK;
}

fl_fs_status slova_bez_libc_ostatok_8(uint8_t p0_a, uint8_t p1_b, uint8_t *out) {
  (void)p0_a;
  (void)p1_b;
  uint8_t t0;
  FL_FS_TRY(fl_fs_u8_mod(p0_a, p1_b, &t0));
  *out = t0;
  return FL_FS_OK;
}

uint8_t slova_bez_libc_i_8(uint8_t p0_a, uint8_t p1_b) {
  (void)p0_a;
  (void)p1_b;
  return ((uint8_t)(p0_a & p1_b));
}

uint8_t slova_bez_libc_ili_8(uint8_t p0_a, uint8_t p1_b) {
  (void)p0_a;
  (void)p1_b;
  return ((uint8_t)(p0_a | p1_b));
}

uint8_t slova_bez_libc_isklyuchayuschee_8(uint8_t p0_a, uint8_t p1_b) {
  (void)p0_a;
  (void)p1_b;
  return ((uint8_t)(p0_a ^ p1_b));
}

uint8_t slova_bez_libc_ne_8(uint8_t p0_a) {
  (void)p0_a;
  return ((uint8_t)(~(p0_a)));
}

fl_fs_status slova_bez_libc_vlevo_8(uint8_t p0_a, uint8_t p1_n, uint8_t *out) {
  (void)p0_a;
  (void)p1_n;
  uint8_t t0;
  FL_FS_TRY(fl_fs_u8_shl(p0_a, (uint64_t)(p1_n), &t0));
  *out = t0;
  return FL_FS_OK;
}

fl_fs_status slova_bez_libc_vpravo_8(uint8_t p0_a, uint8_t p1_n, uint8_t *out) {
  (void)p0_a;
  (void)p1_n;
  uint8_t t0;
  FL_FS_TRY(fl_fs_u8_shr(p0_a, (uint64_t)(p1_n), &t0));
  *out = t0;
  return FL_FS_OK;
}

uint8_t slova_bez_libc_povernut_vlevo_8(uint8_t p0_a, uint8_t p1_n) {
  (void)p0_a;
  (void)p1_n;
  return fl_fs_u8_rotl(p0_a, (uint64_t)(p1_n));
}

uint8_t slova_bez_libc_povernut_vpravo_8(uint8_t p0_a, uint8_t p1_n) {
  (void)p0_a;
  (void)p1_n;
  return fl_fs_u8_rotr(p0_a, (uint64_t)(p1_n));
}

uint8_t slova_bez_libc_vlevo_na_nol_8(uint8_t p0_a) {
  (void)p0_a;
  return ((uint8_t)((uint64_t)(p0_a) << 0));
}

uint8_t slova_bez_libc_vpravo_na_nol_8(uint8_t p0_a) {
  (void)p0_a;
  return ((uint8_t)((p0_a) >> 0));
}

uint8_t slova_bez_libc_vlevo_na_kray_8(uint8_t p0_a) {
  (void)p0_a;
  return ((uint8_t)((uint64_t)(p0_a) << 7));
}

uint8_t slova_bez_libc_vpravo_na_kray_8(uint8_t p0_a) {
  (void)p0_a;
  return ((uint8_t)((p0_a) >> 7));
}

uint8_t slova_bez_libc_povernut_na_sem_8(uint8_t p0_a) {
  (void)p0_a;
  return fl_fs_u8_rotl(p0_a, UINT64_C(7));
}

bool slova_bez_libc_menshe_8(uint8_t p0_a, uint8_t p1_b) {
  (void)p0_a;
  (void)p1_b;
  return (fl_fs_w(p0_a) < fl_fs_w(p1_b));
}

bool slova_bez_libc_ne_bolshe_8(uint8_t p0_a, uint8_t p1_b) {
  (void)p0_a;
  (void)p1_b;
  return (fl_fs_w(p0_a) <= fl_fs_w(p1_b));
}

bool slova_bez_libc_ravny_8(uint8_t p0_a, uint8_t p1_b) {
  (void)p0_a;
  (void)p1_b;
  return (fl_fs_w(p0_a) == fl_fs_w(p1_b));
}

fl_fs_status slova_bez_libc_raznost_8(uint8_t p0_a, uint8_t p1_b, uint8_t *out) {
  (void)p0_a;
  (void)p1_b;
  uint8_t t2;
  if ((fl_fs_w(p0_a) > fl_fs_w(p1_b))) {
    uint8_t t0;
    FL_FS_TRY(fl_fs_u8_sub(p0_a, p1_b, &t0));
    t2 = t0;
  } else {
    uint8_t t1;
    FL_FS_TRY(fl_fs_u8_sub(p1_b, p0_a, &t1));
    t2 = t1;
  }
  *out = t2;
  return FL_FS_OK;
}

uint8_t slova_bez_libc_smes_8(uint8_t p0_a, uint8_t p1_b) {
  (void)p0_a;
  (void)p1_b;
  const uint8_t v0_m = ((uint8_t)(((uint8_t)((p0_a) >> 3)) & ((uint8_t)UINT8_C(31))));
  (void)v0_m;
  return ((uint8_t)(v0_m ^ fl_fs_u8_mulw(p1_b, ((uint8_t)UINT8_C(3)))));
}

int64_t slova_bez_libc_chislom_8(uint8_t p0_a) {
  (void)p0_a;
  return fl_fs_word_num(p0_a);
}

fl_fs_status slova_bez_libc_iz_chisla_8(int64_t p0_ch, uint8_t *out) {
  (void)p0_ch;
  FL_FS_TRY(fl_fs_valid_num(p0_ch));
  uint8_t t0;
  FL_FS_TRY(fl_fs_u8_from_num(p0_ch, &t0));
  *out = t0;
  return FL_FS_OK;
}

uint16_t slova_bez_libc_iz_8_v_16(uint8_t p0_a) {
  (void)p0_a;
  return ((uint16_t)(p0_a));
}

uint32_t slova_bez_libc_iz_8_v_32(uint8_t p0_a) {
  (void)p0_a;
  return ((uint32_t)(p0_a));
}

uint64_t slova_bez_libc_iz_8_v_64(uint8_t p0_a) {
  (void)p0_a;
  return ((uint64_t)(p0_a));
}

fl_fs_status slova_bez_libc_slozhit_16(uint16_t p0_a, uint16_t p1_b, uint16_t *out) {
  (void)p0_a;
  (void)p1_b;
  uint16_t t0;
  FL_FS_TRY(fl_fs_u16_add(p0_a, p1_b, &t0));
  *out = t0;
  return FL_FS_OK;
}

fl_fs_status slova_bez_libc_vychest_16(uint16_t p0_a, uint16_t p1_b, uint16_t *out) {
  (void)p0_a;
  (void)p1_b;
  uint16_t t0;
  FL_FS_TRY(fl_fs_u16_sub(p0_a, p1_b, &t0));
  *out = t0;
  return FL_FS_OK;
}

fl_fs_status slova_bez_libc_umnozhit_16(uint16_t p0_a, uint16_t p1_b, uint16_t *out) {
  (void)p0_a;
  (void)p1_b;
  uint16_t t0;
  FL_FS_TRY(fl_fs_u16_mul(p0_a, p1_b, &t0));
  *out = t0;
  return FL_FS_OK;
}

uint16_t slova_bez_libc_slozhit_po_modulyu_16(uint16_t p0_a, uint16_t p1_b) {
  (void)p0_a;
  (void)p1_b;
  return fl_fs_u16_addw(p0_a, p1_b);
}

uint16_t slova_bez_libc_vychest_po_modulyu_16(uint16_t p0_a, uint16_t p1_b) {
  (void)p0_a;
  (void)p1_b;
  return fl_fs_u16_subw(p0_a, p1_b);
}

uint16_t slova_bez_libc_umnozhit_po_modulyu_16(uint16_t p0_a, uint16_t p1_b) {
  (void)p0_a;
  (void)p1_b;
  return fl_fs_u16_mulw(p0_a, p1_b);
}

fl_fs_status slova_bez_libc_podelit_16(uint16_t p0_a, uint16_t p1_b, uint16_t *out) {
  (void)p0_a;
  (void)p1_b;
  uint16_t t0;
  FL_FS_TRY(fl_fs_u16_div(p0_a, p1_b, &t0));
  *out = t0;
  return FL_FS_OK;
}

fl_fs_status slova_bez_libc_ostatok_16(uint16_t p0_a, uint16_t p1_b, uint16_t *out) {
  (void)p0_a;
  (void)p1_b;
  uint16_t t0;
  FL_FS_TRY(fl_fs_u16_mod(p0_a, p1_b, &t0));
  *out = t0;
  return FL_FS_OK;
}

uint16_t slova_bez_libc_i_16(uint16_t p0_a, uint16_t p1_b) {
  (void)p0_a;
  (void)p1_b;
  return ((uint16_t)(p0_a & p1_b));
}

uint16_t slova_bez_libc_ili_16(uint16_t p0_a, uint16_t p1_b) {
  (void)p0_a;
  (void)p1_b;
  return ((uint16_t)(p0_a | p1_b));
}

uint16_t slova_bez_libc_isklyuchayuschee_16(uint16_t p0_a, uint16_t p1_b) {
  (void)p0_a;
  (void)p1_b;
  return ((uint16_t)(p0_a ^ p1_b));
}

uint16_t slova_bez_libc_ne_16(uint16_t p0_a) {
  (void)p0_a;
  return ((uint16_t)(~(p0_a)));
}

fl_fs_status slova_bez_libc_vlevo_16(uint16_t p0_a, uint8_t p1_n, uint16_t *out) {
  (void)p0_a;
  (void)p1_n;
  uint16_t t0;
  FL_FS_TRY(fl_fs_u16_shl(p0_a, (uint64_t)(p1_n), &t0));
  *out = t0;
  return FL_FS_OK;
}

fl_fs_status slova_bez_libc_vpravo_16(uint16_t p0_a, uint8_t p1_n, uint16_t *out) {
  (void)p0_a;
  (void)p1_n;
  uint16_t t0;
  FL_FS_TRY(fl_fs_u16_shr(p0_a, (uint64_t)(p1_n), &t0));
  *out = t0;
  return FL_FS_OK;
}

uint16_t slova_bez_libc_povernut_vlevo_16(uint16_t p0_a, uint8_t p1_n) {
  (void)p0_a;
  (void)p1_n;
  return fl_fs_u16_rotl(p0_a, (uint64_t)(p1_n));
}

uint16_t slova_bez_libc_povernut_vpravo_16(uint16_t p0_a, uint8_t p1_n) {
  (void)p0_a;
  (void)p1_n;
  return fl_fs_u16_rotr(p0_a, (uint64_t)(p1_n));
}

uint16_t slova_bez_libc_vlevo_na_nol_16(uint16_t p0_a) {
  (void)p0_a;
  return ((uint16_t)((uint64_t)(p0_a) << 0));
}

uint16_t slova_bez_libc_vpravo_na_nol_16(uint16_t p0_a) {
  (void)p0_a;
  return ((uint16_t)((p0_a) >> 0));
}

uint16_t slova_bez_libc_vlevo_na_kray_16(uint16_t p0_a) {
  (void)p0_a;
  return ((uint16_t)((uint64_t)(p0_a) << 15));
}

uint16_t slova_bez_libc_vpravo_na_kray_16(uint16_t p0_a) {
  (void)p0_a;
  return ((uint16_t)((p0_a) >> 15));
}

uint16_t slova_bez_libc_povernut_na_sem_16(uint16_t p0_a) {
  (void)p0_a;
  return fl_fs_u16_rotl(p0_a, UINT64_C(7));
}

bool slova_bez_libc_menshe_16(uint16_t p0_a, uint16_t p1_b) {
  (void)p0_a;
  (void)p1_b;
  return (fl_fs_w(p0_a) < fl_fs_w(p1_b));
}

bool slova_bez_libc_ne_bolshe_16(uint16_t p0_a, uint16_t p1_b) {
  (void)p0_a;
  (void)p1_b;
  return (fl_fs_w(p0_a) <= fl_fs_w(p1_b));
}

bool slova_bez_libc_ravny_16(uint16_t p0_a, uint16_t p1_b) {
  (void)p0_a;
  (void)p1_b;
  return (fl_fs_w(p0_a) == fl_fs_w(p1_b));
}

fl_fs_status slova_bez_libc_raznost_16(uint16_t p0_a, uint16_t p1_b, uint16_t *out) {
  (void)p0_a;
  (void)p1_b;
  uint16_t t2;
  if ((fl_fs_w(p0_a) > fl_fs_w(p1_b))) {
    uint16_t t0;
    FL_FS_TRY(fl_fs_u16_sub(p0_a, p1_b, &t0));
    t2 = t0;
  } else {
    uint16_t t1;
    FL_FS_TRY(fl_fs_u16_sub(p1_b, p0_a, &t1));
    t2 = t1;
  }
  *out = t2;
  return FL_FS_OK;
}

uint16_t slova_bez_libc_smes_16(uint16_t p0_a, uint16_t p1_b) {
  (void)p0_a;
  (void)p1_b;
  const uint16_t v0_m = ((uint16_t)(((uint16_t)((p0_a) >> 3)) & ((uint16_t)UINT16_C(31))));
  (void)v0_m;
  return ((uint16_t)(v0_m ^ fl_fs_u16_mulw(p1_b, ((uint16_t)UINT16_C(3)))));
}

int64_t slova_bez_libc_chislom_16(uint16_t p0_a) {
  (void)p0_a;
  return fl_fs_word_num(p0_a);
}

fl_fs_status slova_bez_libc_iz_chisla_16(int64_t p0_ch, uint16_t *out) {
  (void)p0_ch;
  FL_FS_TRY(fl_fs_valid_num(p0_ch));
  uint16_t t0;
  FL_FS_TRY(fl_fs_u16_from_num(p0_ch, &t0));
  *out = t0;
  return FL_FS_OK;
}

fl_fs_status slova_bez_libc_iz_16_v_8(uint16_t p0_a, uint8_t *out) {
  (void)p0_a;
  uint8_t t0;
  FL_FS_TRY(fl_fs_u8_from((uint64_t)(p0_a), &t0));
  *out = t0;
  return FL_FS_OK;
}

uint32_t slova_bez_libc_iz_16_v_32(uint16_t p0_a) {
  (void)p0_a;
  return ((uint32_t)(p0_a));
}

uint64_t slova_bez_libc_iz_16_v_64(uint16_t p0_a) {
  (void)p0_a;
  return ((uint64_t)(p0_a));
}

fl_fs_status slova_bez_libc_slozhit_32(uint32_t p0_a, uint32_t p1_b, uint32_t *out) {
  (void)p0_a;
  (void)p1_b;
  uint32_t t0;
  FL_FS_TRY(fl_fs_u32_add(p0_a, p1_b, &t0));
  *out = t0;
  return FL_FS_OK;
}

fl_fs_status slova_bez_libc_vychest_32(uint32_t p0_a, uint32_t p1_b, uint32_t *out) {
  (void)p0_a;
  (void)p1_b;
  uint32_t t0;
  FL_FS_TRY(fl_fs_u32_sub(p0_a, p1_b, &t0));
  *out = t0;
  return FL_FS_OK;
}

fl_fs_status slova_bez_libc_umnozhit_32(uint32_t p0_a, uint32_t p1_b, uint32_t *out) {
  (void)p0_a;
  (void)p1_b;
  uint32_t t0;
  FL_FS_TRY(fl_fs_u32_mul(p0_a, p1_b, &t0));
  *out = t0;
  return FL_FS_OK;
}

uint32_t slova_bez_libc_slozhit_po_modulyu_32(uint32_t p0_a, uint32_t p1_b) {
  (void)p0_a;
  (void)p1_b;
  return fl_fs_u32_addw(p0_a, p1_b);
}

uint32_t slova_bez_libc_vychest_po_modulyu_32(uint32_t p0_a, uint32_t p1_b) {
  (void)p0_a;
  (void)p1_b;
  return fl_fs_u32_subw(p0_a, p1_b);
}

uint32_t slova_bez_libc_umnozhit_po_modulyu_32(uint32_t p0_a, uint32_t p1_b) {
  (void)p0_a;
  (void)p1_b;
  return fl_fs_u32_mulw(p0_a, p1_b);
}

fl_fs_status slova_bez_libc_podelit_32(uint32_t p0_a, uint32_t p1_b, uint32_t *out) {
  (void)p0_a;
  (void)p1_b;
  uint32_t t0;
  FL_FS_TRY(fl_fs_u32_div(p0_a, p1_b, &t0));
  *out = t0;
  return FL_FS_OK;
}

fl_fs_status slova_bez_libc_ostatok_32(uint32_t p0_a, uint32_t p1_b, uint32_t *out) {
  (void)p0_a;
  (void)p1_b;
  uint32_t t0;
  FL_FS_TRY(fl_fs_u32_mod(p0_a, p1_b, &t0));
  *out = t0;
  return FL_FS_OK;
}

uint32_t slova_bez_libc_i_32(uint32_t p0_a, uint32_t p1_b) {
  (void)p0_a;
  (void)p1_b;
  return ((uint32_t)(p0_a & p1_b));
}

uint32_t slova_bez_libc_ili_32(uint32_t p0_a, uint32_t p1_b) {
  (void)p0_a;
  (void)p1_b;
  return ((uint32_t)(p0_a | p1_b));
}

uint32_t slova_bez_libc_isklyuchayuschee_32(uint32_t p0_a, uint32_t p1_b) {
  (void)p0_a;
  (void)p1_b;
  return ((uint32_t)(p0_a ^ p1_b));
}

uint32_t slova_bez_libc_ne_32(uint32_t p0_a) {
  (void)p0_a;
  return ((uint32_t)(~(p0_a)));
}

fl_fs_status slova_bez_libc_vlevo_32(uint32_t p0_a, uint8_t p1_n, uint32_t *out) {
  (void)p0_a;
  (void)p1_n;
  uint32_t t0;
  FL_FS_TRY(fl_fs_u32_shl(p0_a, (uint64_t)(p1_n), &t0));
  *out = t0;
  return FL_FS_OK;
}

fl_fs_status slova_bez_libc_vpravo_32(uint32_t p0_a, uint8_t p1_n, uint32_t *out) {
  (void)p0_a;
  (void)p1_n;
  uint32_t t0;
  FL_FS_TRY(fl_fs_u32_shr(p0_a, (uint64_t)(p1_n), &t0));
  *out = t0;
  return FL_FS_OK;
}

uint32_t slova_bez_libc_povernut_vlevo_32(uint32_t p0_a, uint8_t p1_n) {
  (void)p0_a;
  (void)p1_n;
  return fl_fs_u32_rotl(p0_a, (uint64_t)(p1_n));
}

uint32_t slova_bez_libc_povernut_vpravo_32(uint32_t p0_a, uint8_t p1_n) {
  (void)p0_a;
  (void)p1_n;
  return fl_fs_u32_rotr(p0_a, (uint64_t)(p1_n));
}

uint32_t slova_bez_libc_vlevo_na_nol_32(uint32_t p0_a) {
  (void)p0_a;
  return ((uint32_t)((uint64_t)(p0_a) << 0));
}

uint32_t slova_bez_libc_vpravo_na_nol_32(uint32_t p0_a) {
  (void)p0_a;
  return ((uint32_t)((p0_a) >> 0));
}

uint32_t slova_bez_libc_vlevo_na_kray_32(uint32_t p0_a) {
  (void)p0_a;
  return ((uint32_t)((uint64_t)(p0_a) << 31));
}

uint32_t slova_bez_libc_vpravo_na_kray_32(uint32_t p0_a) {
  (void)p0_a;
  return ((uint32_t)((p0_a) >> 31));
}

uint32_t slova_bez_libc_povernut_na_sem_32(uint32_t p0_a) {
  (void)p0_a;
  return fl_fs_u32_rotl(p0_a, UINT64_C(7));
}

bool slova_bez_libc_menshe_32(uint32_t p0_a, uint32_t p1_b) {
  (void)p0_a;
  (void)p1_b;
  return (fl_fs_w(p0_a) < fl_fs_w(p1_b));
}

bool slova_bez_libc_ne_bolshe_32(uint32_t p0_a, uint32_t p1_b) {
  (void)p0_a;
  (void)p1_b;
  return (fl_fs_w(p0_a) <= fl_fs_w(p1_b));
}

bool slova_bez_libc_ravny_32(uint32_t p0_a, uint32_t p1_b) {
  (void)p0_a;
  (void)p1_b;
  return (fl_fs_w(p0_a) == fl_fs_w(p1_b));
}

fl_fs_status slova_bez_libc_raznost_32(uint32_t p0_a, uint32_t p1_b, uint32_t *out) {
  (void)p0_a;
  (void)p1_b;
  uint32_t t2;
  if ((fl_fs_w(p0_a) > fl_fs_w(p1_b))) {
    uint32_t t0;
    FL_FS_TRY(fl_fs_u32_sub(p0_a, p1_b, &t0));
    t2 = t0;
  } else {
    uint32_t t1;
    FL_FS_TRY(fl_fs_u32_sub(p1_b, p0_a, &t1));
    t2 = t1;
  }
  *out = t2;
  return FL_FS_OK;
}

uint32_t slova_bez_libc_smes_32(uint32_t p0_a, uint32_t p1_b) {
  (void)p0_a;
  (void)p1_b;
  const uint32_t v0_m = ((uint32_t)(((uint32_t)((p0_a) >> 3)) & ((uint32_t)UINT32_C(31))));
  (void)v0_m;
  return ((uint32_t)(v0_m ^ fl_fs_u32_mulw(p1_b, ((uint32_t)UINT32_C(3)))));
}

int64_t slova_bez_libc_chislom_32(uint32_t p0_a) {
  (void)p0_a;
  return fl_fs_word_num(p0_a);
}

fl_fs_status slova_bez_libc_iz_chisla_32(int64_t p0_ch, uint32_t *out) {
  (void)p0_ch;
  FL_FS_TRY(fl_fs_valid_num(p0_ch));
  uint32_t t0;
  FL_FS_TRY(fl_fs_u32_from_num(p0_ch, &t0));
  *out = t0;
  return FL_FS_OK;
}

fl_fs_status slova_bez_libc_iz_32_v_8(uint32_t p0_a, uint8_t *out) {
  (void)p0_a;
  uint8_t t0;
  FL_FS_TRY(fl_fs_u8_from((uint64_t)(p0_a), &t0));
  *out = t0;
  return FL_FS_OK;
}

fl_fs_status slova_bez_libc_iz_32_v_16(uint32_t p0_a, uint16_t *out) {
  (void)p0_a;
  uint16_t t0;
  FL_FS_TRY(fl_fs_u16_from((uint64_t)(p0_a), &t0));
  *out = t0;
  return FL_FS_OK;
}

uint64_t slova_bez_libc_iz_32_v_64(uint32_t p0_a) {
  (void)p0_a;
  return ((uint64_t)(p0_a));
}

fl_fs_status slova_bez_libc_slozhit_64(uint64_t p0_a, uint64_t p1_b, uint64_t *out) {
  (void)p0_a;
  (void)p1_b;
  uint64_t t0;
  FL_FS_TRY(fl_fs_u64_add(p0_a, p1_b, &t0));
  *out = t0;
  return FL_FS_OK;
}

fl_fs_status slova_bez_libc_vychest_64(uint64_t p0_a, uint64_t p1_b, uint64_t *out) {
  (void)p0_a;
  (void)p1_b;
  uint64_t t0;
  FL_FS_TRY(fl_fs_u64_sub(p0_a, p1_b, &t0));
  *out = t0;
  return FL_FS_OK;
}

fl_fs_status slova_bez_libc_umnozhit_64(uint64_t p0_a, uint64_t p1_b, uint64_t *out) {
  (void)p0_a;
  (void)p1_b;
  uint64_t t0;
  FL_FS_TRY(fl_fs_u64_mul(p0_a, p1_b, &t0));
  *out = t0;
  return FL_FS_OK;
}

uint64_t slova_bez_libc_slozhit_po_modulyu_64(uint64_t p0_a, uint64_t p1_b) {
  (void)p0_a;
  (void)p1_b;
  return fl_fs_u64_addw(p0_a, p1_b);
}

uint64_t slova_bez_libc_vychest_po_modulyu_64(uint64_t p0_a, uint64_t p1_b) {
  (void)p0_a;
  (void)p1_b;
  return fl_fs_u64_subw(p0_a, p1_b);
}

uint64_t slova_bez_libc_umnozhit_po_modulyu_64(uint64_t p0_a, uint64_t p1_b) {
  (void)p0_a;
  (void)p1_b;
  return fl_fs_u64_mulw(p0_a, p1_b);
}

fl_fs_status slova_bez_libc_podelit_64(uint64_t p0_a, uint64_t p1_b, uint64_t *out) {
  (void)p0_a;
  (void)p1_b;
  uint64_t t0;
  FL_FS_TRY(fl_fs_u64_div(p0_a, p1_b, &t0));
  *out = t0;
  return FL_FS_OK;
}

fl_fs_status slova_bez_libc_ostatok_64(uint64_t p0_a, uint64_t p1_b, uint64_t *out) {
  (void)p0_a;
  (void)p1_b;
  uint64_t t0;
  FL_FS_TRY(fl_fs_u64_mod(p0_a, p1_b, &t0));
  *out = t0;
  return FL_FS_OK;
}

uint64_t slova_bez_libc_i_64(uint64_t p0_a, uint64_t p1_b) {
  (void)p0_a;
  (void)p1_b;
  return ((uint64_t)(p0_a & p1_b));
}

uint64_t slova_bez_libc_ili_64(uint64_t p0_a, uint64_t p1_b) {
  (void)p0_a;
  (void)p1_b;
  return ((uint64_t)(p0_a | p1_b));
}

uint64_t slova_bez_libc_isklyuchayuschee_64(uint64_t p0_a, uint64_t p1_b) {
  (void)p0_a;
  (void)p1_b;
  return ((uint64_t)(p0_a ^ p1_b));
}

uint64_t slova_bez_libc_ne_64(uint64_t p0_a) {
  (void)p0_a;
  return ((uint64_t)(~(p0_a)));
}

fl_fs_status slova_bez_libc_vlevo_64(uint64_t p0_a, uint8_t p1_n, uint64_t *out) {
  (void)p0_a;
  (void)p1_n;
  uint64_t t0;
  FL_FS_TRY(fl_fs_u64_shl(p0_a, (uint64_t)(p1_n), &t0));
  *out = t0;
  return FL_FS_OK;
}

fl_fs_status slova_bez_libc_vpravo_64(uint64_t p0_a, uint8_t p1_n, uint64_t *out) {
  (void)p0_a;
  (void)p1_n;
  uint64_t t0;
  FL_FS_TRY(fl_fs_u64_shr(p0_a, (uint64_t)(p1_n), &t0));
  *out = t0;
  return FL_FS_OK;
}

uint64_t slova_bez_libc_povernut_vlevo_64(uint64_t p0_a, uint8_t p1_n) {
  (void)p0_a;
  (void)p1_n;
  return fl_fs_u64_rotl(p0_a, (uint64_t)(p1_n));
}

uint64_t slova_bez_libc_povernut_vpravo_64(uint64_t p0_a, uint8_t p1_n) {
  (void)p0_a;
  (void)p1_n;
  return fl_fs_u64_rotr(p0_a, (uint64_t)(p1_n));
}

uint64_t slova_bez_libc_vlevo_na_nol_64(uint64_t p0_a) {
  (void)p0_a;
  return ((uint64_t)((uint64_t)(p0_a) << 0));
}

uint64_t slova_bez_libc_vpravo_na_nol_64(uint64_t p0_a) {
  (void)p0_a;
  return ((uint64_t)((p0_a) >> 0));
}

uint64_t slova_bez_libc_vlevo_na_kray_64(uint64_t p0_a) {
  (void)p0_a;
  return ((uint64_t)((uint64_t)(p0_a) << 63));
}

uint64_t slova_bez_libc_vpravo_na_kray_64(uint64_t p0_a) {
  (void)p0_a;
  return ((uint64_t)((p0_a) >> 63));
}

uint64_t slova_bez_libc_povernut_na_sem_64(uint64_t p0_a) {
  (void)p0_a;
  return fl_fs_u64_rotl(p0_a, UINT64_C(7));
}

bool slova_bez_libc_menshe_64(uint64_t p0_a, uint64_t p1_b) {
  (void)p0_a;
  (void)p1_b;
  return (fl_fs_w(p0_a) < fl_fs_w(p1_b));
}

bool slova_bez_libc_ne_bolshe_64(uint64_t p0_a, uint64_t p1_b) {
  (void)p0_a;
  (void)p1_b;
  return (fl_fs_w(p0_a) <= fl_fs_w(p1_b));
}

bool slova_bez_libc_ravny_64(uint64_t p0_a, uint64_t p1_b) {
  (void)p0_a;
  (void)p1_b;
  return (fl_fs_w(p0_a) == fl_fs_w(p1_b));
}

fl_fs_status slova_bez_libc_raznost_64(uint64_t p0_a, uint64_t p1_b, uint64_t *out) {
  (void)p0_a;
  (void)p1_b;
  uint64_t t2;
  if ((fl_fs_w(p0_a) > fl_fs_w(p1_b))) {
    uint64_t t0;
    FL_FS_TRY(fl_fs_u64_sub(p0_a, p1_b, &t0));
    t2 = t0;
  } else {
    uint64_t t1;
    FL_FS_TRY(fl_fs_u64_sub(p1_b, p0_a, &t1));
    t2 = t1;
  }
  *out = t2;
  return FL_FS_OK;
}

uint64_t slova_bez_libc_smes_64(uint64_t p0_a, uint64_t p1_b) {
  (void)p0_a;
  (void)p1_b;
  const uint64_t v0_m = ((uint64_t)(((uint64_t)((p0_a) >> 3)) & ((uint64_t)UINT64_C(31))));
  (void)v0_m;
  return ((uint64_t)(v0_m ^ fl_fs_u64_mulw(p1_b, ((uint64_t)UINT64_C(3)))));
}

fl_fs_status slova_bez_libc_chislom_64(uint64_t p0_a, int64_t *out) {
  (void)p0_a;
  int64_t t0;
  FL_FS_TRY(fl_fs_u64_to_num(p0_a, &t0));
  *out = t0;
  return FL_FS_OK;
}

fl_fs_status slova_bez_libc_iz_chisla_64(int64_t p0_ch, uint64_t *out) {
  (void)p0_ch;
  FL_FS_TRY(fl_fs_valid_num(p0_ch));
  uint64_t t0;
  FL_FS_TRY(fl_fs_u64_from_num(p0_ch, &t0));
  *out = t0;
  return FL_FS_OK;
}

fl_fs_status slova_bez_libc_iz_64_v_8(uint64_t p0_a, uint8_t *out) {
  (void)p0_a;
  uint8_t t0;
  FL_FS_TRY(fl_fs_u8_from((uint64_t)(p0_a), &t0));
  *out = t0;
  return FL_FS_OK;
}

fl_fs_status slova_bez_libc_iz_64_v_16(uint64_t p0_a, uint16_t *out) {
  (void)p0_a;
  uint16_t t0;
  FL_FS_TRY(fl_fs_u16_from((uint64_t)(p0_a), &t0));
  *out = t0;
  return FL_FS_OK;
}

fl_fs_status slova_bez_libc_iz_64_v_32(uint64_t p0_a, uint32_t *out) {
  (void)p0_a;
  uint32_t t0;
  FL_FS_TRY(fl_fs_u32_from((uint64_t)(p0_a), &t0));
  *out = t0;
  return FL_FS_OK;
}

slova_bez_libc_komanda_t slova_bez_libc_komanda_po_kodu(uint8_t p0_kod) {
  (void)p0_kod;
  slova_bez_libc_komanda_t t4;
  if ((fl_fs_w(p0_kod) == fl_fs_w(((uint8_t)UINT8_C(0))))) {
    slova_bez_libc_komanda_t t0;
    t0.tag = slova_bez_libc_komanda_chitat;
    t0.as.none = 0;
    t4 = t0;
  } else {
    slova_bez_libc_komanda_t t3;
    if ((fl_fs_w(p0_kod) == fl_fs_w(((uint8_t)UINT8_C(1))))) {
      slova_bez_libc_komanda_t t1;
      t1.tag = slova_bez_libc_komanda_pisat;
      t1.as.none = 0;
      t3 = t1;
    } else {
      slova_bez_libc_komanda_t t2;
      t2.tag = slova_bez_libc_komanda_sdvinut;
      t2.as.none = 0;
      t2.as.sdvinut.na = ((uint8_t)(p0_kod & ((uint8_t)UINT8_C(31))));
      t3 = t2;
    }
    t4 = t3;
  }
  return t4;
}

fl_fs_status slova_bez_libc_ispolnit(slova_bez_libc_komanda_t p0_k, slova_bez_libc_registr_t p1_r, slova_bez_libc_registr_t *out) {
  (void)p0_k;
  (void)p1_r;
  FL_FS_TRY(slova_bez_libc_komanda_valid(&p0_k));
  const uint32_t v0_z = (p1_r).znachenie;
  (void)v0_z;
  const slova_bez_libc_komanda_t t1 = p0_k;
  (void)t1;
  slova_bez_libc_registr_t t2;
  if (t1.tag == slova_bez_libc_komanda_chitat) {
    t2 = p1_r;
  } else if (t1.tag == slova_bez_libc_komanda_pisat) {
    slova_bez_libc_registr_t t3;
    t3.znachenie = ((uint32_t)(v0_z ^ ((uint32_t)UINT32_C(4294967295))));
    t3.flagi = ((uint8_t)UINT8_C(1));
    t2 = t3;
  } else {
    uint32_t t4;
    FL_FS_TRY(fl_fs_u32_shl(v0_z, (uint64_t)(t1.as.sdvinut.na), &t4));
    slova_bez_libc_registr_t t5;
    t5.znachenie = t4;
    t5.flagi = (p1_r).flagi;
    t2 = t5;
  }
  *out = t2;
  return FL_FS_OK;
}

fl_fs_status slova_bez_libc_sleduyuschiy_v_kolce(int64_t p0_indeks, int64_t *out) {
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
  *out = t2;
  return FL_FS_OK;
}

fl_fs_status slova_bez_libc_po_modulyu_kolca(int64_t p0_indeks, int64_t *out) {
  (void)p0_indeks;
  FL_FS_TRY(fl_fs_valid_nat(p0_indeks));
  int64_t t0;
  FL_FS_TRY(fl_fs_num_mod(p0_indeks, INT64_C(8), &t0));
  int64_t t1;
  FL_FS_TRY(fl_fs_to_nat(t0, &t1));
  *out = t1;
  return FL_FS_OK;
}

fl_fs_status slova_bez_libc_schyot(int64_t p0_a, int64_t p1_b, int64_t *out) {
  (void)p0_a;
  (void)p1_b;
  FL_FS_TRY(fl_fs_valid_num(p0_a));
  FL_FS_TRY(fl_fs_valid_num(p1_b));
  int64_t t0;
  FL_FS_TRY(fl_fs_num_mul(p0_a, p1_b, &t0));
  int64_t t1;
  FL_FS_TRY(fl_fs_num_add(p0_a, INT64_C(7), &t1));
  int64_t t2;
  FL_FS_TRY(fl_fs_num_sub(t0, t1, &t2));
  *out = t2;
  return FL_FS_OK;
}

fl_fs_status slova_bez_libc_shag(uint8_t p0_kod, uint32_t p1_z, uint8_t p2_f, slova_bez_libc_registr_t *out) {
  (void)p0_kod;
  (void)p1_z;
  (void)p2_f;
  slova_bez_libc_registr_t t0;
  t0.znachenie = p1_z;
  t0.flagi = p2_f;
  const slova_bez_libc_registr_t v1_r = t0;
  (void)v1_r;
  slova_bez_libc_registr_t t2;
  FL_FS_TRY(slova_bez_libc_ispolnit(slova_bez_libc_komanda_po_kodu(p0_kod), v1_r, &t2));
  *out = t2;
  return FL_FS_OK;
}

fl_fs_status slova_bez_libc_znachenie_shaga(uint8_t p0_kod, uint32_t p1_z, uint8_t p2_f, uint32_t *out) {
  (void)p0_kod;
  (void)p1_z;
  (void)p2_f;
  slova_bez_libc_registr_t t0;
  FL_FS_TRY(slova_bez_libc_shag(p0_kod, p1_z, p2_f, &t0));
  *out = (t0).znachenie;
  return FL_FS_OK;
}
