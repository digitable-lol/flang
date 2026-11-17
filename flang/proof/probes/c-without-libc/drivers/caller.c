/*
 * Чужая программа на C без libc: зовёт проверенные функции через заголовок,
 * который сгенерировал flang. Точка входа своя (_start), выход — системный
 * вызов. Код 0 — все ответы сошлись, иначе номер первого несошедшегося.
 */
#include "header.h"

static void leave(long code) {
#if defined(__x86_64__)
  __asm__ volatile("syscall" : : "a"(60L), "D"(code) : "rcx", "r11", "memory");
#elif defined(__riscv)
  register long a0 __asm__("a0") = code;
  register long a7 __asm__("a7") = 93;
  __asm__ volatile("ecall" : "+r"(a0) : "r"(a7) : "memory");
#else
  (void)code;
#endif
  for (;;) {
  }
}

static long verdict(void) {
  const uint32_t word = UINT32_C(0x45000014);
  zagolovok_paketa_zagolovok_t header = zagolovok_paketa_razobrat(word);
  if (zagolovok_paketa_versiya(word) != 4) {
    return 1;
  }
  if (zagolovok_paketa_dlina_zagolovka(word) != 5) {
    return 2;
  }
  if (zagolovok_paketa_polnaya_dlina(word) != 20) {
    return 3;
  }
  if (header.versiya != 4 || header.dlina_zagolovka != 5 || header.polnaya_dlina != 20) {
    return 4;
  }
  if (zagolovok_paketa_starshaya_polovina(UINT64_C(0xFFFFFFFF00000000)) != UINT64_C(0xFFFFFFFF)) {
    return 5;
  }
  return 0;
}

#if defined(__x86_64__)
__attribute__((force_align_arg_pointer))
#endif
void _start(void) {
  leave(verdict());
}
