/*
 * Сгенерировано flang: C без libc (flang/self/c-without-libc.flang).
 * Модуль flang: «Слова без libc». Файл: words.h.
 * Собирается с -ffreestanding -nostdlib: ни libc, ни потоков, ни выделения памяти.
 * Не редактировать руками — правьте исходник на flang и генерируйте заново.
 */
#ifndef words_h
#define words_h

#include "flang_freestanding.h"

/* Сумма типов flang «Команда»: метка tag и поля варианта в as. */
enum {
  slova_bez_libc_komanda_chitat = 1,
  slova_bez_libc_komanda_pisat = 2,
  slova_bez_libc_komanda_sdvinut = 3
};
typedef struct {
  int tag;
  union {
    uint8_t none;
    struct {
      uint8_t na;
    } sdvinut;
  } as;
} slova_bez_libc_komanda_t;

/* Запись flang «Регистр». */
typedef struct {
  uint32_t znachenie;
  uint8_t flagi;
} slova_bez_libc_registr_t;

/* Функция flang «Сложить 8». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_slozhit_8(uint8_t p0_a, uint8_t p1_b, uint8_t *out);

/* Функция flang «Вычесть 8». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_vychest_8(uint8_t p0_a, uint8_t p1_b, uint8_t *out);

/* Функция flang «Умножить 8». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_umnozhit_8(uint8_t p0_a, uint8_t p1_b, uint8_t *out);

/* Функция flang «Сложить по модулю 8». Ошибки быть не может: ответ возвращается прямо. */
uint8_t slova_bez_libc_slozhit_po_modulyu_8(uint8_t p0_a, uint8_t p1_b);

/* Функция flang «Вычесть по модулю 8». Ошибки быть не может: ответ возвращается прямо. */
uint8_t slova_bez_libc_vychest_po_modulyu_8(uint8_t p0_a, uint8_t p1_b);

/* Функция flang «Умножить по модулю 8». Ошибки быть не может: ответ возвращается прямо. */
uint8_t slova_bez_libc_umnozhit_po_modulyu_8(uint8_t p0_a, uint8_t p1_b);

/* Функция flang «Поделить 8». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_podelit_8(uint8_t p0_a, uint8_t p1_b, uint8_t *out);

/* Функция flang «Остаток 8». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_ostatok_8(uint8_t p0_a, uint8_t p1_b, uint8_t *out);

/* Функция flang «И 8». Ошибки быть не может: ответ возвращается прямо. */
uint8_t slova_bez_libc_i_8(uint8_t p0_a, uint8_t p1_b);

/* Функция flang «Или 8». Ошибки быть не может: ответ возвращается прямо. */
uint8_t slova_bez_libc_ili_8(uint8_t p0_a, uint8_t p1_b);

/* Функция flang «Исключающее 8». Ошибки быть не может: ответ возвращается прямо. */
uint8_t slova_bez_libc_isklyuchayuschee_8(uint8_t p0_a, uint8_t p1_b);

/* Функция flang «Не 8». Ошибки быть не может: ответ возвращается прямо. */
uint8_t slova_bez_libc_ne_8(uint8_t p0_a);

/* Функция flang «Влево 8». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_vlevo_8(uint8_t p0_a, uint8_t p1_n, uint8_t *out);

/* Функция flang «Вправо 8». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_vpravo_8(uint8_t p0_a, uint8_t p1_n, uint8_t *out);

/* Функция flang «Повернуть влево 8». Ошибки быть не может: ответ возвращается прямо. */
uint8_t slova_bez_libc_povernut_vlevo_8(uint8_t p0_a, uint8_t p1_n);

/* Функция flang «Повернуть вправо 8». Ошибки быть не может: ответ возвращается прямо. */
uint8_t slova_bez_libc_povernut_vpravo_8(uint8_t p0_a, uint8_t p1_n);

/* Функция flang «Влево на ноль 8». Ошибки быть не может: ответ возвращается прямо. */
uint8_t slova_bez_libc_vlevo_na_nol_8(uint8_t p0_a);

/* Функция flang «Вправо на ноль 8». Ошибки быть не может: ответ возвращается прямо. */
uint8_t slova_bez_libc_vpravo_na_nol_8(uint8_t p0_a);

/* Функция flang «Влево на край 8». Ошибки быть не может: ответ возвращается прямо. */
uint8_t slova_bez_libc_vlevo_na_kray_8(uint8_t p0_a);

/* Функция flang «Вправо на край 8». Ошибки быть не может: ответ возвращается прямо. */
uint8_t slova_bez_libc_vpravo_na_kray_8(uint8_t p0_a);

/* Функция flang «Повернуть на семь 8». Ошибки быть не может: ответ возвращается прямо. */
uint8_t slova_bez_libc_povernut_na_sem_8(uint8_t p0_a);

/* Функция flang «Меньше 8». Ошибки быть не может: ответ возвращается прямо. */
bool slova_bez_libc_menshe_8(uint8_t p0_a, uint8_t p1_b);

/* Функция flang «Не больше 8». Ошибки быть не может: ответ возвращается прямо. */
bool slova_bez_libc_ne_bolshe_8(uint8_t p0_a, uint8_t p1_b);

/* Функция flang «Равны 8». Ошибки быть не может: ответ возвращается прямо. */
bool slova_bez_libc_ravny_8(uint8_t p0_a, uint8_t p1_b);

/* Функция flang «Разность 8». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_raznost_8(uint8_t p0_a, uint8_t p1_b, uint8_t *out);

/* Функция flang «Смесь 8». Ошибки быть не может: ответ возвращается прямо. */
uint8_t slova_bez_libc_smes_8(uint8_t p0_a, uint8_t p1_b);

/* Функция flang «Числом 8». Ошибки быть не может: ответ возвращается прямо. */
int64_t slova_bez_libc_chislom_8(uint8_t p0_a);

/* Функция flang «Из числа 8». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_iz_chisla_8(int64_t p0_ch, uint8_t *out);

/* Функция flang «Из 8 в 16». Ошибки быть не может: ответ возвращается прямо. */
uint16_t slova_bez_libc_iz_8_v_16(uint8_t p0_a);

/* Функция flang «Из 8 в 32». Ошибки быть не может: ответ возвращается прямо. */
uint32_t slova_bez_libc_iz_8_v_32(uint8_t p0_a);

/* Функция flang «Из 8 в 64». Ошибки быть не может: ответ возвращается прямо. */
uint64_t slova_bez_libc_iz_8_v_64(uint8_t p0_a);

/* Функция flang «Сложить 16». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_slozhit_16(uint16_t p0_a, uint16_t p1_b, uint16_t *out);

/* Функция flang «Вычесть 16». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_vychest_16(uint16_t p0_a, uint16_t p1_b, uint16_t *out);

/* Функция flang «Умножить 16». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_umnozhit_16(uint16_t p0_a, uint16_t p1_b, uint16_t *out);

/* Функция flang «Сложить по модулю 16». Ошибки быть не может: ответ возвращается прямо. */
uint16_t slova_bez_libc_slozhit_po_modulyu_16(uint16_t p0_a, uint16_t p1_b);

/* Функция flang «Вычесть по модулю 16». Ошибки быть не может: ответ возвращается прямо. */
uint16_t slova_bez_libc_vychest_po_modulyu_16(uint16_t p0_a, uint16_t p1_b);

/* Функция flang «Умножить по модулю 16». Ошибки быть не может: ответ возвращается прямо. */
uint16_t slova_bez_libc_umnozhit_po_modulyu_16(uint16_t p0_a, uint16_t p1_b);

/* Функция flang «Поделить 16». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_podelit_16(uint16_t p0_a, uint16_t p1_b, uint16_t *out);

/* Функция flang «Остаток 16». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_ostatok_16(uint16_t p0_a, uint16_t p1_b, uint16_t *out);

/* Функция flang «И 16». Ошибки быть не может: ответ возвращается прямо. */
uint16_t slova_bez_libc_i_16(uint16_t p0_a, uint16_t p1_b);

/* Функция flang «Или 16». Ошибки быть не может: ответ возвращается прямо. */
uint16_t slova_bez_libc_ili_16(uint16_t p0_a, uint16_t p1_b);

/* Функция flang «Исключающее 16». Ошибки быть не может: ответ возвращается прямо. */
uint16_t slova_bez_libc_isklyuchayuschee_16(uint16_t p0_a, uint16_t p1_b);

/* Функция flang «Не 16». Ошибки быть не может: ответ возвращается прямо. */
uint16_t slova_bez_libc_ne_16(uint16_t p0_a);

/* Функция flang «Влево 16». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_vlevo_16(uint16_t p0_a, uint8_t p1_n, uint16_t *out);

/* Функция flang «Вправо 16». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_vpravo_16(uint16_t p0_a, uint8_t p1_n, uint16_t *out);

/* Функция flang «Повернуть влево 16». Ошибки быть не может: ответ возвращается прямо. */
uint16_t slova_bez_libc_povernut_vlevo_16(uint16_t p0_a, uint8_t p1_n);

/* Функция flang «Повернуть вправо 16». Ошибки быть не может: ответ возвращается прямо. */
uint16_t slova_bez_libc_povernut_vpravo_16(uint16_t p0_a, uint8_t p1_n);

/* Функция flang «Влево на ноль 16». Ошибки быть не может: ответ возвращается прямо. */
uint16_t slova_bez_libc_vlevo_na_nol_16(uint16_t p0_a);

/* Функция flang «Вправо на ноль 16». Ошибки быть не может: ответ возвращается прямо. */
uint16_t slova_bez_libc_vpravo_na_nol_16(uint16_t p0_a);

/* Функция flang «Влево на край 16». Ошибки быть не может: ответ возвращается прямо. */
uint16_t slova_bez_libc_vlevo_na_kray_16(uint16_t p0_a);

/* Функция flang «Вправо на край 16». Ошибки быть не может: ответ возвращается прямо. */
uint16_t slova_bez_libc_vpravo_na_kray_16(uint16_t p0_a);

/* Функция flang «Повернуть на семь 16». Ошибки быть не может: ответ возвращается прямо. */
uint16_t slova_bez_libc_povernut_na_sem_16(uint16_t p0_a);

/* Функция flang «Меньше 16». Ошибки быть не может: ответ возвращается прямо. */
bool slova_bez_libc_menshe_16(uint16_t p0_a, uint16_t p1_b);

/* Функция flang «Не больше 16». Ошибки быть не может: ответ возвращается прямо. */
bool slova_bez_libc_ne_bolshe_16(uint16_t p0_a, uint16_t p1_b);

/* Функция flang «Равны 16». Ошибки быть не может: ответ возвращается прямо. */
bool slova_bez_libc_ravny_16(uint16_t p0_a, uint16_t p1_b);

/* Функция flang «Разность 16». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_raznost_16(uint16_t p0_a, uint16_t p1_b, uint16_t *out);

/* Функция flang «Смесь 16». Ошибки быть не может: ответ возвращается прямо. */
uint16_t slova_bez_libc_smes_16(uint16_t p0_a, uint16_t p1_b);

/* Функция flang «Числом 16». Ошибки быть не может: ответ возвращается прямо. */
int64_t slova_bez_libc_chislom_16(uint16_t p0_a);

/* Функция flang «Из числа 16». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_iz_chisla_16(int64_t p0_ch, uint16_t *out);

/* Функция flang «Из 16 в 8». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_iz_16_v_8(uint16_t p0_a, uint8_t *out);

/* Функция flang «Из 16 в 32». Ошибки быть не может: ответ возвращается прямо. */
uint32_t slova_bez_libc_iz_16_v_32(uint16_t p0_a);

/* Функция flang «Из 16 в 64». Ошибки быть не может: ответ возвращается прямо. */
uint64_t slova_bez_libc_iz_16_v_64(uint16_t p0_a);

/* Функция flang «Сложить 32». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_slozhit_32(uint32_t p0_a, uint32_t p1_b, uint32_t *out);

/* Функция flang «Вычесть 32». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_vychest_32(uint32_t p0_a, uint32_t p1_b, uint32_t *out);

/* Функция flang «Умножить 32». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_umnozhit_32(uint32_t p0_a, uint32_t p1_b, uint32_t *out);

/* Функция flang «Сложить по модулю 32». Ошибки быть не может: ответ возвращается прямо. */
uint32_t slova_bez_libc_slozhit_po_modulyu_32(uint32_t p0_a, uint32_t p1_b);

/* Функция flang «Вычесть по модулю 32». Ошибки быть не может: ответ возвращается прямо. */
uint32_t slova_bez_libc_vychest_po_modulyu_32(uint32_t p0_a, uint32_t p1_b);

/* Функция flang «Умножить по модулю 32». Ошибки быть не может: ответ возвращается прямо. */
uint32_t slova_bez_libc_umnozhit_po_modulyu_32(uint32_t p0_a, uint32_t p1_b);

/* Функция flang «Поделить 32». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_podelit_32(uint32_t p0_a, uint32_t p1_b, uint32_t *out);

/* Функция flang «Остаток 32». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_ostatok_32(uint32_t p0_a, uint32_t p1_b, uint32_t *out);

/* Функция flang «И 32». Ошибки быть не может: ответ возвращается прямо. */
uint32_t slova_bez_libc_i_32(uint32_t p0_a, uint32_t p1_b);

/* Функция flang «Или 32». Ошибки быть не может: ответ возвращается прямо. */
uint32_t slova_bez_libc_ili_32(uint32_t p0_a, uint32_t p1_b);

/* Функция flang «Исключающее 32». Ошибки быть не может: ответ возвращается прямо. */
uint32_t slova_bez_libc_isklyuchayuschee_32(uint32_t p0_a, uint32_t p1_b);

/* Функция flang «Не 32». Ошибки быть не может: ответ возвращается прямо. */
uint32_t slova_bez_libc_ne_32(uint32_t p0_a);

/* Функция flang «Влево 32». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_vlevo_32(uint32_t p0_a, uint8_t p1_n, uint32_t *out);

/* Функция flang «Вправо 32». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_vpravo_32(uint32_t p0_a, uint8_t p1_n, uint32_t *out);

/* Функция flang «Повернуть влево 32». Ошибки быть не может: ответ возвращается прямо. */
uint32_t slova_bez_libc_povernut_vlevo_32(uint32_t p0_a, uint8_t p1_n);

/* Функция flang «Повернуть вправо 32». Ошибки быть не может: ответ возвращается прямо. */
uint32_t slova_bez_libc_povernut_vpravo_32(uint32_t p0_a, uint8_t p1_n);

/* Функция flang «Влево на ноль 32». Ошибки быть не может: ответ возвращается прямо. */
uint32_t slova_bez_libc_vlevo_na_nol_32(uint32_t p0_a);

/* Функция flang «Вправо на ноль 32». Ошибки быть не может: ответ возвращается прямо. */
uint32_t slova_bez_libc_vpravo_na_nol_32(uint32_t p0_a);

/* Функция flang «Влево на край 32». Ошибки быть не может: ответ возвращается прямо. */
uint32_t slova_bez_libc_vlevo_na_kray_32(uint32_t p0_a);

/* Функция flang «Вправо на край 32». Ошибки быть не может: ответ возвращается прямо. */
uint32_t slova_bez_libc_vpravo_na_kray_32(uint32_t p0_a);

/* Функция flang «Повернуть на семь 32». Ошибки быть не может: ответ возвращается прямо. */
uint32_t slova_bez_libc_povernut_na_sem_32(uint32_t p0_a);

/* Функция flang «Меньше 32». Ошибки быть не может: ответ возвращается прямо. */
bool slova_bez_libc_menshe_32(uint32_t p0_a, uint32_t p1_b);

/* Функция flang «Не больше 32». Ошибки быть не может: ответ возвращается прямо. */
bool slova_bez_libc_ne_bolshe_32(uint32_t p0_a, uint32_t p1_b);

/* Функция flang «Равны 32». Ошибки быть не может: ответ возвращается прямо. */
bool slova_bez_libc_ravny_32(uint32_t p0_a, uint32_t p1_b);

/* Функция flang «Разность 32». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_raznost_32(uint32_t p0_a, uint32_t p1_b, uint32_t *out);

/* Функция flang «Смесь 32». Ошибки быть не может: ответ возвращается прямо. */
uint32_t slova_bez_libc_smes_32(uint32_t p0_a, uint32_t p1_b);

/* Функция flang «Числом 32». Ошибки быть не может: ответ возвращается прямо. */
int64_t slova_bez_libc_chislom_32(uint32_t p0_a);

/* Функция flang «Из числа 32». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_iz_chisla_32(int64_t p0_ch, uint32_t *out);

/* Функция flang «Из 32 в 8». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_iz_32_v_8(uint32_t p0_a, uint8_t *out);

/* Функция flang «Из 32 в 16». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_iz_32_v_16(uint32_t p0_a, uint16_t *out);

/* Функция flang «Из 32 в 64». Ошибки быть не может: ответ возвращается прямо. */
uint64_t slova_bez_libc_iz_32_v_64(uint32_t p0_a);

/* Функция flang «Сложить 64». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_slozhit_64(uint64_t p0_a, uint64_t p1_b, uint64_t *out);

/* Функция flang «Вычесть 64». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_vychest_64(uint64_t p0_a, uint64_t p1_b, uint64_t *out);

/* Функция flang «Умножить 64». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_umnozhit_64(uint64_t p0_a, uint64_t p1_b, uint64_t *out);

/* Функция flang «Сложить по модулю 64». Ошибки быть не может: ответ возвращается прямо. */
uint64_t slova_bez_libc_slozhit_po_modulyu_64(uint64_t p0_a, uint64_t p1_b);

/* Функция flang «Вычесть по модулю 64». Ошибки быть не может: ответ возвращается прямо. */
uint64_t slova_bez_libc_vychest_po_modulyu_64(uint64_t p0_a, uint64_t p1_b);

/* Функция flang «Умножить по модулю 64». Ошибки быть не может: ответ возвращается прямо. */
uint64_t slova_bez_libc_umnozhit_po_modulyu_64(uint64_t p0_a, uint64_t p1_b);

/* Функция flang «Поделить 64». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_podelit_64(uint64_t p0_a, uint64_t p1_b, uint64_t *out);

/* Функция flang «Остаток 64». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_ostatok_64(uint64_t p0_a, uint64_t p1_b, uint64_t *out);

/* Функция flang «И 64». Ошибки быть не может: ответ возвращается прямо. */
uint64_t slova_bez_libc_i_64(uint64_t p0_a, uint64_t p1_b);

/* Функция flang «Или 64». Ошибки быть не может: ответ возвращается прямо. */
uint64_t slova_bez_libc_ili_64(uint64_t p0_a, uint64_t p1_b);

/* Функция flang «Исключающее 64». Ошибки быть не может: ответ возвращается прямо. */
uint64_t slova_bez_libc_isklyuchayuschee_64(uint64_t p0_a, uint64_t p1_b);

/* Функция flang «Не 64». Ошибки быть не может: ответ возвращается прямо. */
uint64_t slova_bez_libc_ne_64(uint64_t p0_a);

/* Функция flang «Влево 64». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_vlevo_64(uint64_t p0_a, uint8_t p1_n, uint64_t *out);

/* Функция flang «Вправо 64». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_vpravo_64(uint64_t p0_a, uint8_t p1_n, uint64_t *out);

/* Функция flang «Повернуть влево 64». Ошибки быть не может: ответ возвращается прямо. */
uint64_t slova_bez_libc_povernut_vlevo_64(uint64_t p0_a, uint8_t p1_n);

/* Функция flang «Повернуть вправо 64». Ошибки быть не может: ответ возвращается прямо. */
uint64_t slova_bez_libc_povernut_vpravo_64(uint64_t p0_a, uint8_t p1_n);

/* Функция flang «Влево на ноль 64». Ошибки быть не может: ответ возвращается прямо. */
uint64_t slova_bez_libc_vlevo_na_nol_64(uint64_t p0_a);

/* Функция flang «Вправо на ноль 64». Ошибки быть не может: ответ возвращается прямо. */
uint64_t slova_bez_libc_vpravo_na_nol_64(uint64_t p0_a);

/* Функция flang «Влево на край 64». Ошибки быть не может: ответ возвращается прямо. */
uint64_t slova_bez_libc_vlevo_na_kray_64(uint64_t p0_a);

/* Функция flang «Вправо на край 64». Ошибки быть не может: ответ возвращается прямо. */
uint64_t slova_bez_libc_vpravo_na_kray_64(uint64_t p0_a);

/* Функция flang «Повернуть на семь 64». Ошибки быть не может: ответ возвращается прямо. */
uint64_t slova_bez_libc_povernut_na_sem_64(uint64_t p0_a);

/* Функция flang «Меньше 64». Ошибки быть не может: ответ возвращается прямо. */
bool slova_bez_libc_menshe_64(uint64_t p0_a, uint64_t p1_b);

/* Функция flang «Не больше 64». Ошибки быть не может: ответ возвращается прямо. */
bool slova_bez_libc_ne_bolshe_64(uint64_t p0_a, uint64_t p1_b);

/* Функция flang «Равны 64». Ошибки быть не может: ответ возвращается прямо. */
bool slova_bez_libc_ravny_64(uint64_t p0_a, uint64_t p1_b);

/* Функция flang «Разность 64». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_raznost_64(uint64_t p0_a, uint64_t p1_b, uint64_t *out);

/* Функция flang «Смесь 64». Ошибки быть не может: ответ возвращается прямо. */
uint64_t slova_bez_libc_smes_64(uint64_t p0_a, uint64_t p1_b);

/* Функция flang «Числом 64». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_chislom_64(uint64_t p0_a, int64_t *out);

/* Функция flang «Из числа 64». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_iz_chisla_64(int64_t p0_ch, uint64_t *out);

/* Функция flang «Из 64 в 8». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_iz_64_v_8(uint64_t p0_a, uint8_t *out);

/* Функция flang «Из 64 в 16». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_iz_64_v_16(uint64_t p0_a, uint16_t *out);

/* Функция flang «Из 64 в 32». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_iz_64_v_32(uint64_t p0_a, uint32_t *out);

/* Функция flang «Команда по коду». Ошибки быть не может: ответ возвращается прямо. */
slova_bez_libc_komanda_t slova_bez_libc_komanda_po_kodu(uint8_t p0_kod);

/* Функция flang «Исполнить». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_ispolnit(slova_bez_libc_komanda_t p0_k, slova_bez_libc_registr_t p1_r, slova_bez_libc_registr_t *out);

/* Функция flang «Следующий в кольце». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_sleduyuschiy_v_kolce(int64_t p0_indeks, int64_t *out);

/* Функция flang «По модулю кольца». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_po_modulyu_kolca(int64_t p0_indeks, int64_t *out);

/* Функция flang «Счёт». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_schyot(int64_t p0_a, int64_t p1_b, int64_t *out);

/* Функция flang «Шаг». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_shag(uint8_t p0_kod, uint32_t p1_z, uint8_t p2_f, slova_bez_libc_registr_t *out);

/* Функция flang «Значение шага». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status slova_bez_libc_znachenie_shaga(uint8_t p0_kod, uint32_t p1_z, uint8_t p2_f, uint32_t *out);

#endif
