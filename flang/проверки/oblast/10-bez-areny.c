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
  fl_ctx bare;
  fl_mark region;
  memset(&bare, 0, sizeof(bare));
  bare.arena = NULL;
  region = fl_region_open(&bare);
  printf("без арены: %d\n", (int)fl_region_close(&bare, region, FL_OK, NULL, NULL));
  nachalo();
  region = fl_region_open(&ctx);
  musor(10000);
  printf("без результата: %d\n", (int)fl_region_close(&ctx, region, FL_OK, NULL, NULL));
  fl_arena_release(&arena);
  return 0;
}
