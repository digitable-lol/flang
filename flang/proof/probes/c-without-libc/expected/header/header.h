/*
 * Сгенерировано flang: C без libc (flang/self/c-without-libc.flang).
 * Модуль flang: «Заголовок пакета». Файл: header.h.
 * Собирается с -ffreestanding -nostdlib: ни libc, ни потоков, ни выделения памяти.
 * Не редактировать руками — правьте исходник на flang и генерируйте заново.
 */
#ifndef header_h
#define header_h

#include "flang_freestanding.h"

/* Запись flang «Заголовок». */
typedef struct {
  uint32_t versiya;
  uint32_t dlina_zagolovka;
  uint32_t polnaya_dlina;
} zagolovok_paketa_zagolovok_t;

/* Функция flang «Версия». Ошибки быть не может: ответ возвращается прямо. */
uint32_t zagolovok_paketa_versiya(uint32_t p0_slovo);

/* Функция flang «Длина заголовка». Ошибки быть не может: ответ возвращается прямо. */
uint32_t zagolovok_paketa_dlina_zagolovka(uint32_t p0_slovo);

/* Функция flang «Полная длина». Ошибки быть не может: ответ возвращается прямо. */
uint32_t zagolovok_paketa_polnaya_dlina(uint32_t p0_slovo);

/* Функция flang «Старшая половина». Ошибки быть не может: ответ возвращается прямо. */
uint64_t zagolovok_paketa_starshaya_polovina(uint64_t p0_slovo);

/* Функция flang «Версия числом». Возвращает код: FL_FS_OK — ответ лежит в out, иначе причина ошибки. */
fl_fs_status zagolovok_paketa_versiya_chislom(uint32_t p0_slovo, int64_t *out);

/* Функция flang «Разобрать». Ошибки быть не может: ответ возвращается прямо. */
zagolovok_paketa_zagolovok_t zagolovok_paketa_razobrat(uint32_t p0_slovo);

#endif
