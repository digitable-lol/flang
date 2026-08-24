/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/* Что сколько занимает в планировщике C — спрашивается у компилятора, а не
   угадывается по полям. Собирается рядом с напечатанным стендом. */
#include <stdio.h>
#include "flang_conc.h"

/* Копии типов планировщика: они static в flang_conc.c, наружу не видны, и
   спросить sizeof можно только повторив объявление байт в байт. */
typedef struct link_probe { size_t supervisor; const char *strategy; } link_probe;
typedef struct box { fl_value *items; size_t capacity; size_t head; size_t count; } box;
typedef struct slot {
  fl_value initial; fl_value current; bool alive; box b; fl_arena heap[2]; size_t live; size_t pending;
} slot;

int main(void) {
  printf("fl_value            %zu\n", sizeof(fl_value));
  printf("fl_arena            %zu\n", sizeof(fl_arena));
  printf("ящик (box)          %zu\n", sizeof(box));
  printf("слот процесса       %zu\n", sizeof(slot));
  printf("fl_conc_process     %zu\n", sizeof(fl_conc_process));
  printf("fl_conc_link        %zu\n", sizeof(link_probe));
  return 0;
}
