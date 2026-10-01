/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
#include <stdio.h>
#include <string.h>
#include "flang_runtime.h"

static fl_arena arena;
static fl_ctx ctx;

static fl_value numbers(size_t count, double base) {
  fl_value *items = NULL;
  size_t index = 0;
  fl_error error;
  if (fl_list_alloc(&ctx, count, &items, &error) != FL_OK) {
    printf("no memory\n");
  }
  for (index = 0; index < count; index += 1) {
    items[index] = fl_number(base + (double)index);
  }
  return fl_list(items, count);
}

static void garbage(size_t count) {
  size_t index = 0;
  for (index = 0; index < count; index += 1) {
    if (fl_arena_alloc(&arena, 256) == NULL) {
      printf("no memory\n");
    }
  }
}

static fl_status compute(fl_value list, fl_value *result) {
  fl_error error;
  size_t level = 0;
  for (level = 0; level < 3; level += 1) {
    if (fl_enter(&ctx, "inner", &error) != FL_OK) {
      return FL_ERROR;
    }
  }
  for (level = 0; level < 3; level += 1) {
    fl_leave(&ctx);
  }
  fl_charge(&ctx, 4);
  *result = fl_number(list.as.list.items[0].as.number * 2.0);
  return FL_OK;
}

static const char *call(fl_value list, double *answer) {
  fl_memo_call memo;
  fl_value result = fl_nothing();
  const char *how = "hit";
  if (!fl_memo_find(&ctx, "Probe", &list, 1, &memo, &result)) {
    how = "computed";
    if (fl_memo_keep(&ctx, &memo, compute(list, &result), &result) != FL_OK) {
      *answer = 0.0;
      return "failed";
    }
  }
  *answer = result.as.number;
  return how;
}

int main(void) {
  fl_value first;
  fl_value second;
  fl_value third = fl_nothing();
  fl_value scalar = fl_number(0.0);
  fl_mark region;
  fl_error error;
  double answer = 0.0;
  size_t before = 0;
  const char *how = NULL;
  fl_arena_init(&arena);
  fl_ctx_init(&ctx, &arena);
  fl_memo_setup(1, 0, (size_t)64u * 1024u * 1024u);

  region = fl_region_open(&ctx);
  first = numbers(200000, 1.0);
  before = ctx.steps;
  how = call(first, &answer);
  printf("first call: %s %g steps %lu\n", how, answer, (unsigned long)(ctx.steps - before));
  before = ctx.steps;
  how = call(first, &answer);
  printf("second call: %s %g steps %lu peak %lu\n", how, answer, (unsigned long)(ctx.steps - before),
         (unsigned long)(ctx.depth_peak - ctx.depth));
  garbage(1024);
  (void)fl_region_close(&ctx, region, FL_OK, &scalar, &error);

  second = numbers(200000, 5.0);
  printf("same address after rollback: %s\n", second.as.list.items == first.as.list.items ? "yes" : "no");
  how = call(second, &answer);
  printf("other list at that address: %s %g\n", how, answer);
  how = call(second, &answer);
  printf("other list again: %s %g\n", how, answer);

  third = numbers(200000, 1.0);
  ctx.max_steps = ctx.steps + 6;
  how = call(third, &answer);
  printf("steps would run out: %s %g\n", how, answer);
  ctx.max_steps = fl_max_steps_default();
  ctx.max_depth = ctx.depth + 2;
  how = call(third, &answer);
  printf("depth would run out: %s %g\n", how, answer);
  ctx.depth = 0;
  ctx.max_depth = fl_max_depth_default();
  how = call(third, &answer);
  printf("equal content elsewhere: %s %g\n", how, answer);

  fl_memo_setup(1, 1, (size_t)64u * 1024u * 1024u);
  how = call(third, &answer);
  printf("audit: %s %g\n", how, answer);
  fl_arena_release(&arena);
  return 0;
}
