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
  fl_value etalon = fl_nothing();
  fl_error error;
  const char *names[2];
  fl_value values[2];
  size_t i = 0;
  names[0] = "имя";
  names[1] = "хвост";
  nachalo();
  /* Эталон строится НИЖЕ отметки — его откат не заденет. */
  for (i = 0; i < 2; i += 1) {
    fl_value text = fl_nothing();
    fl_value inner = fl_nothing();
    fl_value *cell = NULL;
    if (fl_text(&ctx, "строка с кириллицей", 34, &text, &error) != FL_OK) return 1;
    values[0] = text;
    values[1] = spisok(3);
    if (fl_variant_new(&ctx, "Узел", names, values, 2, &inner, &error) != FL_OK) return 1;
    if (fl_list_alloc(&ctx, 1, &cell, &error) != FL_OK) return 1;
    cell[0] = inner;
    if (i == 0) {
      etalon = fl_list(cell, 1);
    } else {
      region = fl_region_open(&ctx);
      musor(10000);
      /* тот же по значению, но построен ВЫШЕ отметки */
      if (fl_text(&ctx, "строка с кириллицей", 34, &text, &error) != FL_OK) return 1;
      values[0] = text;
      values[1] = spisok(3);
      if (fl_variant_new(&ctx, "Узел", names, values, 2, &inner, &error) != FL_OK) return 1;
      if (fl_list_alloc(&ctx, 1, &cell, &error) != FL_OK) return 1;
      cell[0] = inner;
      result = fl_list(cell, 1);
      (void)fl_region_close(&ctx, region, FL_OK, &result, NULL);
    }
  }
  printf("совпало: %s\n", fl_equal(result, etalon) ? "да" : "нет");
  fl_arena_release(&arena);
  return 0;
}
