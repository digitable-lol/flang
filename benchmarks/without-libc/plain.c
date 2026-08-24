/* Чистое вычисление: факториал 20, ничего не печатает, в сеть не ходит.
   0 — посчитано верно, 2 — неверно, 1 — отказ рантайма. */
#include "faktorial.h"

int main(void) {
  fl_arena arena;
  fl_ctx ctx;
  fl_error error;
  fl_value result;
  int ok;
  fl_arena_init(&arena);
  fl_ctx_init(&ctx, &arena);
  if (faktorial_faktorial(&ctx, fl_number(20), &result, &error) != FL_OK) {
    fl_arena_release(&arena);
    return 1;
  }
  ok = (result.as.number == 2432902008176640000.0);
  fl_arena_release(&arena);
  return ok ? 0 : 2;
}
