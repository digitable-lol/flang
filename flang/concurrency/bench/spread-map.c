#include "flang_runtime.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static long fail_at = -1;
static long burn = 200000;

static fl_status body(fl_ctx *ctx, fl_value item, const fl_value *env,
                      fl_value *result, fl_error *error) {
  const long n = (long)item.as.number;
  long i = 0;
  char text[64];
  fl_value parts[3];
  fl_value fields[3];
  fl_value word;
  fl_value variant;
  const char *names[3] = {"имя", "части", "вид"};
  const char *vnames[1] = {"x"};
  (void)env;
  for (i = 0; i < burn * (1 + n % 7); i += 1) {
    FL_TRY(fl_tick(ctx, "Тело пробы", error));
  }
  if (n == fail_at) {
    return fl_fail(ctx, error, "FLANG_PROPERTY", "элемент %ld отказал", n);
  }
  snprintf(text, sizeof text, "элемент-%ld", n);
  FL_TRY(fl_text(ctx, text, strlen(text), &fields[0], error));
  parts[0] = fl_number((double)n);
  parts[1] = fl_flag(n % 2 == 0);
  FL_TRY(fl_text(ctx, "ёж", strlen("ёж"), &parts[2], error));
  {
    fl_value *items = NULL;
    FL_TRY(fl_list_alloc(ctx, 3, &items, error));
    memcpy(items, parts, sizeof parts);
    fields[1] = fl_list(items, 3);
  }
  word = fl_word(64, false, (uint64_t)n * 1000003u);
  FL_TRY(fl_variant_new(ctx, "Вариант", vnames, &word, 1, &variant, error));
  fields[2] = variant;
  return fl_record_new(ctx, names, fields, 3, result, error);
}

static void say(FILE *out, fl_value v) {
  size_t i = 0;
  switch (v.tag) {
  case FL_NOTHING: fputs("ничто", out); break;
  case FL_NUMBER: fprintf(out, "%g", v.as.number); break;
  case FL_FLAG: fputs(v.as.flag ? "да" : "нет", out); break;
  case FL_STRING: fprintf(out, "\"%.*s\"/%lu", (int)v.as.string.bytes, v.as.string.utf8, (unsigned long)v.as.string.points); break;
  case FL_WORD: fprintf(out, "w%u:%llu", (unsigned)v.as.word.width, (unsigned long long)v.as.word.bits); break;
  case FL_LIST:
    fputc('[', out);
    for (i = 0; i < v.as.list.count; i++) { if (i) fputc(',', out); say(out, v.as.list.items[i]); }
    fputc(']', out); break;
  case FL_RECORD:
    fputc('{', out);
    for (i = 0; i < v.as.record->count; i++) { fprintf(out, "%s%s=", i ? "," : "", v.as.record->fields[i].name); say(out, v.as.record->fields[i].value); }
    fputc('}', out); break;
  case FL_VARIANT:
    fprintf(out, "%s(", v.as.variant->name);
    for (i = 0; i < v.as.variant->count; i++) { fprintf(out, "%s%s=", i ? "," : "", v.as.variant->fields[i].name); say(out, v.as.variant->fields[i].value); }
    fputc(')', out); break;
  }
}

int main(int argc, char **argv) {
  fl_arena arena;
  fl_ctx ctx;
  fl_error error;
  fl_value *source = NULL;
  fl_value *items = NULL;
  long count = argc > 1 ? atol(argv[1]) : 200;
  long i = 0;
  fl_status status;
  if (argc > 2) fail_at = atol(argv[2]);
  if (argc > 3) burn = atol(argv[3]);
  fl_arena_init(&arena);
  fl_ctx_init(&ctx, &arena);
  ctx.max_steps = argc > 4 ? (size_t)atoll(argv[4]) : (size_t)1 << 50;
  error.code = NULL;
  error.message = NULL;
  source = (fl_value *)malloc((size_t)count * sizeof(fl_value));
  items = (fl_value *)calloc((size_t)count, sizeof(fl_value));
  for (i = 0; i < count; i++) source[i] = fl_number((double)i);
  status = fl_spread_map(&ctx, fl_list(source, (size_t)count), body, NULL, items, &error);
  printf("status %d steps %lu peak %lu\n", (int)status, (unsigned long)ctx.steps, (unsigned long)ctx.depth_peak);
  if (status != FL_OK) {
    printf("error %s: %s\n", error.code, error.message);
    return 1;
  }
  for (i = 0; i < count; i++) { say(stdout, items[i]); fputc('\n', stdout); }
  return 0;
}
