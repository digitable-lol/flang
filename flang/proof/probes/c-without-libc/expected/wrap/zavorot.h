/*
 * Сгенерировано flang: C без libc (flang/self/c-without-libc.flang).
 * Модуль flang: «Заворот». Файл: zavorot.h.
 * Собирается с -ffreestanding -nostdlib: ни libc, ни потоков, ни выделения памяти.
 * Не редактировать руками — правьте исходник на flang и генерируйте заново.
 */
#ifndef zavorot_h
#define zavorot_h

#include "fl_freestanding.h"

/* Функция flang «Сумма с заворотом». Ошибки быть не может: ответ возвращается прямо. */
uint64_t zavorot_summa_s_zavorotom(uint64_t p0_a, uint64_t p1_b);

/* Функция flang «Сумма с отказом». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status zavorot_summa_s_otkazom(uint8_t p0_a, uint8_t p1_b, uint8_t *out);

/* Функция flang «Частное». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status zavorot_chastnoe(uint64_t p0_a, uint64_t p1_b, uint64_t *out);

#endif
