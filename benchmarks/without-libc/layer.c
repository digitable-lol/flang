/*
 * Слой вместо libc: всё, что напечатанной программе flang нужно от системы,
 * когда она ничего не печатает и не ходит в сеть.
 *
 * Собрано ради замера, а не ради употребления. Замер: сколько именно строк
 * надо дописать, чтобы чистое вычисление собралось с -nostdlib.
 *
 * Требуется рантайму (проверено `nm -u`, x86_64 Linux, -DFL_NO_POSIX_STACK):
 *   malloc free memcpy strlen vsnprintf  — пять имён, тринадцать мест вызова.
 * Плюс точка входа _start, которой при -nostdlib не даёт никто.
 *
 * Обращений к ядру ровно три: mmap, munmap, exit_group.
 *
 * -DTOLKO_VHOD оставляет одну точку входа и убирает замены. Так виден
 * настоящий список нехватки: без точки входа компоновщик с --gc-sections
 * выметает всю программу целиком и не жалуется вовсе ни на что.
 */
#include <stdarg.h>
#include <stddef.h>

#ifndef TOLKO_VHOD

/* ── три обращения к ядру ────────────────────────────────────────────────── */

static long sistema(long nomer, long a, long b, long c, long d, long e, long f) {
  long ответ;
  register long r10 __asm__("r10") = d;
  register long r8 __asm__("r8") = e;
  register long r9 __asm__("r9") = f;
  __asm__ volatile("syscall"
                   : "=a"(ответ)
                   : "a"(nomer), "D"(a), "S"(b), "d"(c), "r"(r10), "r"(r8), "r"(r9)
                   : "rcx", "r11", "memory");
  return ответ;
}

/* ── память: mmap на каждое выделение, размер лежит в заголовке ──────────── */

void *malloc(size_t сколько) {
  size_t всего = (сколько + 16 + 4095) & ~(size_t)4095;
  long адрес = sistema(9, 0, (long)всего, 3 /* READ|WRITE */,
                       0x22 /* PRIVATE|ANONYMOUS */, -1, 0);
  if (адрес < 0 && адрес > -4096) return NULL;
  *(size_t *)(void *)адрес = всего;
  return (void *)(адрес + 16);
}

void free(void *что) {
  if (что == NULL) return;
  {
    char *начало = (char *)что - 16;
    sistema(11, (long)начало, (long)*(size_t *)(void *)начало, 0, 0, 0, 0);
  }
}

/* ── байты и строки ──────────────────────────────────────────────────────── */

void *memcpy(void *куда, const void *откуда, size_t сколько) {
  char *к = (char *)куда;
  const char *о = (const char *)откуда;
  while (сколько--) *к++ = *о++;
  return куда;
}

size_t strlen(const char *строка) {
  const char *к = строка;
  while (*к) ++к;
  return (size_t)(к - строка);
}

/* ── vsnprintf: ровно те три вида подстановки, что встречаются на этом пути ──
 * %s — текст, %lu — беззнаковое длинное, %d — знаковое. Остальное копируется
 * дословно вместе со знаком процента: соврать про формат хуже, чем не понять.
 */
typedef struct { char *край; size_t место; size_t надо; } vyvod;

static void vyvod_bayt(vyvod *в, char байт) {
  if (в->надо + 1 < в->место) в->край[в->надо] = байт;
  в->надо++;
}

static void vyvod_tekst(vyvod *в, const char *текст) {
  while (*текст) vyvod_bayt(в, *текст++);
}

static void vyvod_chislo(vyvod *в, unsigned long число, int znak) {
  char цифры[24];
  int сколько = 0;
  if (znak) vyvod_bayt(в, '-');
  if (число == 0) цифры[сколько++] = '0';
  while (число) { цифры[сколько++] = (char)('0' + (число % 10)); число /= 10; }
  while (сколько) vyvod_bayt(в, цифры[--сколько]);
}

int vsnprintf(char *край, size_t место, const char *формат, va_list доводы) {
  vyvod в;
  в.край = край; в.место = место; в.надо = 0;
  while (*формат) {
    if (*формат != '%') { vyvod_bayt(&в, *формат++); continue; }
    формат++;
    if (формат[0] == 's') { const char *т = va_arg(доводы, const char *);
      vyvod_tekst(&в, т ? т : "(нет)"); формат++; }
    else if (формат[0] == 'l' && формат[1] == 'u') {
      vyvod_chislo(&в, va_arg(доводы, unsigned long), 0); формат += 2; }
    else if (формат[0] == 'd') { int ч = va_arg(доводы, int);
      vyvod_chislo(&в, ч < 0 ? (unsigned long)(-(long)ч) : (unsigned long)ч, ч < 0);
      формат++; }
    else if (формат[0] == '%') { vyvod_bayt(&в, '%'); формат++; }
    else vyvod_bayt(&в, '%');
  }
  if (место) край[в.надо < место ? в.надо : место - 1] = '\0';
  return (int)в.надо;
}

#endif /* TOLKO_VHOD */

/* ── точка входа ─────────────────────────────────────────────────────────── */

/*
 * На языке C её написать нельзя, и это замеренный факт, а не осторожность.
 * При -nostdlib нет crt1.o, а значит некому выровнять стек: ядро отдаёт
 * управление с rsp, кратным 16, тогда как всякая функция C ждёт на входе
 * rsp % 16 == 8. Сгенерированный компилятором пролог смещения не знает, и
 * первая же инструкция movaps (их на этом пути десять) валит программу
 * раньше первого обращения к ядру. Отсюда шесть строк на языке ассемблера.
 */
int main(void);

__asm__(
    ".globl _start\n"
    "_start:\n"
    "  xor %rbp, %rbp\n"      /* конец цепочки кадров */
    "  and $-16, %rsp\n"      /* выровнять под вызов C */
    "  call glavnoe\n"
    "  mov %eax, %edi\n"
    "  mov $231, %eax\n"      /* exit_group */
    "  syscall\n");

int glavnoe(void);
int glavnoe(void) { return main(); }
