/*
 * Сгенерировано flang: C без libc (flang/self/c-without-libc.flang).
 * Модуль flang: «Индекс кольца». Файл: indeks_kolca.h.
 * Собирается с -ffreestanding -nostdlib: ни libc, ни потоков, ни выделения памяти.
 * Не редактировать руками — правьте исходник на flang и генерируйте заново.
 */
#ifndef indeks_kolca_h
#define indeks_kolca_h

#include "fl_freestanding.h"

/* Функция flang «Следующий индекс». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status indeks_kolca_sleduyuschiy_indeks(int64_t p0_indeks, int64_t *out);

/* Функция flang «Индекс по модулю». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status indeks_kolca_indeks_po_modulyu(int64_t p0_indeks, int64_t *out);

/* Функция flang «Индекс слова». Ошибки быть не может: ответ возвращается прямо. */
uint32_t indeks_kolca_indeks_slova(uint32_t p0_indeks);

/* Функция flang «Индекс слова числом». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status indeks_kolca_indeks_slova_chislom(uint32_t p0_indeks, int64_t *out);

#endif
