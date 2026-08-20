/* Тот же факториал, но через построение списка [1..н] и свёртку —
   путь, который заставляет арену выделять память. Ничего не печатает. */
#include "faktorial.h"

int main(void) {
  fl_arena arena;
  fl_ctx ctx;
  fl_error error;
  fl_value result;
  int ok;
  fl_arena_init(&arena);
  fl_ctx_init(&ctx, &arena);
  if (faktorial_faktorial_proizvedeniem(&ctx, fl_number(2000), &result, &error) != FL_OK) {
    fl_arena_release(&arena);
    return 1;
  }
  ok = (result.as.number > 1.0e300);   /* 2000! далеко за пределом double */
  fl_arena_release(&arena);
  return ok ? 0 : 2;
}
