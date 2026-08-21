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
  fl_value result = fl_nothing();
  fl_error error;
  size_t do_oblasti = 0;
  size_t level = 0;
  nachalo();
  do_oblasti = arena.handed;
  region = fl_region_open(&ctx);
  musor(10000);
  result = spisok(1);
  for (level = 0; level < 40; level += 1) {
    fl_value *pair = NULL;
    if (fl_list_alloc(&ctx, 2, &pair, &error) != FL_OK) return 1;
    pair[0] = result;
    pair[1] = result; /* тот же указатель дважды — вот и разделение */
    result = fl_list(pair, 2);
  }
  (void)fl_region_close(&ctx, region, FL_OK, &result, NULL);
  printf("откатилось: %s\n", arena.handed - do_oblasti < 2000000u ? "да" : "нет");
  printf("значение цело: %lu\n", (unsigned long)result.as.list.count);
  fl_arena_release(&arena);
  return 0;
}
