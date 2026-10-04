/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov)
 * SPDX-License-Identifier: BSD-2-Clause
 *
 * Проба цели «c» (и, с тем же текстом, цели «cpp»): точное целое складывается
 * разрядами основания 2²², и сумма за 2⁵³ печатается ДЕСЯТИЧНОЙ записью.
 *
 * Десятичная запись считается здесь своими руками: у C длинных целых нет
 * вовсе (ADR-0036 §6, третья цена), а чужую библиотеку брать нельзя
 * (ADR-0012). Рантайму она не нужна — он держит значение разрядами, — и
 * потому лежит в пробе, а не в flang_runtime.c.
 */
#include "flang_runtime.h"
#include <stdio.h>

#define EXACT_BASE 4194304UL

static fl_value digits(fl_ctx *ctx, const double *values, size_t count) {
  fl_value *items = NULL;
  fl_error error;
  size_t index;
  if (fl_list_alloc(ctx, count, &items, &error) != FL_OK) {
    return fl_nothing();
  }
  for (index = 0; index < count; index++) {
    items[index] = fl_number(values[index]);
  }
  return fl_list(items, count);
}

/* Разряды → десятичная запись: школьным умножением на основание. */
static const char *decimal(fl_value value) {
  static char text[512];
  unsigned char cells[256];
  size_t used = 1;
  size_t place;
  size_t index;
  cells[0] = 0;
  for (place = value.as.list.count; place > 0; place--) {
    unsigned long carry = (unsigned long)value.as.list.items[place - 1].as.number;
    for (index = 0; index < used; index++) {
      unsigned long cell = (unsigned long)cells[index] * EXACT_BASE + carry;
      cells[index] = (unsigned char)(cell % 10UL);
      carry = cell / 10UL;
    }
    while (carry > 0UL && used < sizeof cells) {
      cells[used++] = (unsigned char)(carry % 10UL);
      carry /= 10UL;
    }
  }
  while (used > 1 && cells[used - 1] == 0) {
    used--;
  }
  for (index = 0; index < used; index++) {
    text[index] = (char)('0' + cells[used - 1 - index]);
  }
  text[used] = '\0';
  return text;
}

static void places(fl_value value) {
  size_t index;
  for (index = 0; index < value.as.list.count; index++) {
    printf("%s%.0f", index ? "," : "", value.as.list.items[index].as.number);
  }
}

static void sum(fl_ctx *ctx, const char *label, const double *l, size_t lc, const double *r, size_t rc) {
  fl_value out;
  fl_error error;
  if (fl_add(ctx, digits(ctx, l, lc), digits(ctx, r, rc), &out, &error) != FL_OK) {
    printf("%s\tОТКАЗ\t%s\n", label, error.message);
    return;
  }
  printf("%s\t", label);
  places(out);
  printf("\t%s\n", decimal(out));
}

int main(void) {
  static const double beyond_left[3] = {1.0, 0.0, 512.0};
  static const double one[1] = {1.0};
  static const double carry_left[1] = {4194303.0};
  static const double wide_left[3] = {4194303.0, 4194303.0, 4194303.0};
  static const double wide_right[3] = {1.0, 0.0, 0.0};
  static const double denormal[1] = {4194305.0};
  static const double zero[1] = {0.0};
  static const double forged_left[3] = {1.0, 0.0, 511.0};
  fl_arena arena;
  fl_ctx ctx;
  fl_value out;
  fl_error error;
  fl_arena_init(&arena);
  fl_ctx_init(&ctx, &arena);
  sum(&ctx, "beyond", beyond_left, 3, one, 1);
  sum(&ctx, "carry", carry_left, 1, one, 1);
  sum(&ctx, "wide", wide_left, 3, wide_right, 3);
  sum(&ctx, "denormal", denormal, 1, zero, 1);
  sum(&ctx, "forged", forged_left, 3, one, 1);
  if (fl_add(&ctx, fl_number(2.0), fl_number(3.0), &out, &error) == FL_OK) {
    printf("numbers\t%.0f\n", out.as.number);
  }
  if (fl_add(&ctx, digits(&ctx, beyond_left, 3), fl_number(1.0), &out, &error) != FL_OK) {
    printf("refusal\t%s\n", error.message);
  }
  fl_arena_release(&arena);
  return 0;
}
