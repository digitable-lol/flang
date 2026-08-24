/*
 * Разбор настоящего /etc/fstab этой машины — БЕЗ LIBC.
 * Таблица вшита в программу, потому что чтение файла — дело хозяина, а
 * хозяина здесь нет вовсе: ни stdio, ни libc, ни точки входа от crt1.o.
 * 0 — отчёт совпал знак в знак; 2 — не совпал; 1 — рантайм отказал.
 */
#include "razbor_fstab.h"

static const char TABLICA[] =
    "# /dev/mapper/vg99546-root\n"
    "UUID=fecf8298-b812-4436-99ae-e5a6d57bf1b3\t/         \text4      \trw,relatime\t0 1\n"
    "\n"
    "# /dev/nvme1n1p2\n"
    "UUID=fc721aeb-932a-4d90-add1-b994415ecd11\t/boot     \text4      \trw,relatime\t0 2\n"
    "\n"
    "# /dev/nvme1n1p1\n"
    "UUID=C94E-A04E      \t/boot/efi \tvfat      \trw,relatime,fmask=0022,dmask=0022,codepage=437,shortname=mixed,errors=remount-ro\t0 2\n"
    "\n"
    "# /dev/mapper/vg99546-swap\n"
    "UUID=72295055-c1c0-4d1b-86b3-c6d558cdae70\tnone      \tswap      \tdefaults  \t0 0\n"
    "\n";

static const char ZHDYOM[] = "точек 4, бед 0, корней 1";

int main(void) {
  fl_arena arena;
  fl_ctx ctx;
  fl_error error;
  fl_value itog;
  size_t i;
  size_t bayt = sizeof(TABLICA) - 1;
  size_t zhdyom_bayt = sizeof(ZHDYOM) - 1;
  fl_arena_init(&arena);
  fl_ctx_init(&ctx, &arena);
  /* fstab этой машины — чистый ASCII, потому кодовых точек столько же, сколько байт. */
  if (razbor_fstab_otchyot(&ctx, fl_text_borrow(TABLICA, bayt, bayt), &itog, &error) != FL_OK) {
    fl_arena_release(&arena);
    return 1;
  }
  if (itog.tag != FL_STRING || itog.as.string.bytes != zhdyom_bayt) {
    fl_arena_release(&arena);
    return 2;
  }
  for (i = 0; i < zhdyom_bayt; i += 1) {
    if (itog.as.string.utf8[i] != ZHDYOM[i]) {
      fl_arena_release(&arena);
      return 2;
    }
  }
  fl_arena_release(&arena);
  return 0;
}
