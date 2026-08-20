/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
#include <stdio.h>
#include <string.h>
#include "flang_runtime.h"

static fl_arena arena;
static fl_ctx ctx;

void nachalo(void) {
  fl_arena_init(&arena);
  fl_ctx_init(&ctx, &arena);
}

/* Мусор: n выдач по 256 байт, ничем не связанных с результатом. */
void musor(size_t n) {
  size_t i = 0;
  for (i = 0; i < n; i += 1) {
    void *block = fl_arena_alloc(&arena, 256);
    if (block == NULL) { printf("НЕТ ПАМЯТИ\n"); }
  }
}

/* Список из n чисел в арене. */
fl_value spisok(size_t n) {
  fl_value *items = NULL;
  size_t i = 0;
  fl_error error;
  if (fl_list_alloc(&ctx, n, &items, &error) != FL_OK) { printf("НЕТ ПАМЯТИ\n"); }
  for (i = 0; i < n; i += 1) items[i] = fl_number((double)i);
  return fl_list(items, n);
}
int main(void) {
  fl_mark region;
  fl_error error;
  fl_value result = fl_nothing();
  fl_status status = FL_OK;
  nachalo();
  error.code = NULL;
  error.message = NULL;
  region = fl_region_open(&ctx);
  musor(10000);
  /* Отказ строит текст в арене — ровно как это делает fl_fail изнутри. */
  status = fl_fail(&ctx, &error, FL_CODE_TYPE, "число %d не годится", 42);
  status = fl_region_close(&ctx, region, status, &result, &error);
  printf("статус: %d\n", (int)status);
  printf("текст: %s\n", error.message);
  fl_arena_release(&arena);
  return 0;
}
