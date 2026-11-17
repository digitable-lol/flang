/*
 * Сгенерировано flang: C без libc (flang/self/emit-c-freestanding.flang).
 * Модуль flang: «Индекс кольца». Файл: fl_freestanding.h.
 * Собирается с -ffreestanding -nostdlib: ни libc, ни потоков, ни выделения памяти.
 * Не редактировать руками — правьте исходник на flang и генерируйте заново.
 */
#ifndef FL_FREESTANDING_H
#define FL_FREESTANDING_H

/* Только эти три заголовка: их даёт сам компилятор C и без libc (-ffreestanding). */
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

/* Функция, в которой возможна ошибка, возвращает код, а ответ кладёт в последний аргумент out. */
typedef enum {
  FL_FS_OK = 0,
  FL_FS_PRECONDITION = 1,  /* не выполнено «требует»: вызвавший нарушил договор */
  FL_FS_POSTCONDITION = 2, /* не выполнено недоказанное «обеспечивает» */
  FL_FS_RANGE = 3,         /* число вышло за границы типа или за 2^53 */
  FL_FS_DIVIDE_BY_ZERO = 4,
  FL_FS_OVERFLOW = 5,      /* ответ не уместился в слово: сложение, вычитание, умножение, перевод */
  FL_FS_SHIFT = 6,         /* сдвиг на величину не меньше ширины слова */
  FL_FS_BAD_TAG = 7,       /* на вход пришёл вариант с чужой меткой */
  FL_FS_NO_CASE = 8        /* разбор не нашёл случая */
} fl_fs_status;

#define FL_FS_TRY(call) \
  do { \
    fl_fs_status fl_fs_s_ = (call); \
    if (fl_fs_s_ != FL_FS_OK) return fl_fs_s_; \
  } while (0)
#define FL_FS_LIMIT INT64_C(9007199254740992)   /* 2^53: дальше обычное число flang не точно */
#define FL_FS_NAT_MAX INT64_C(9007199254740991) /* потолок неотрицательного и целого */

static inline fl_fs_status fl_fs_num_check(int64_t v, int64_t *out) {
  if (v > FL_FS_LIMIT || v < -FL_FS_LIMIT) return FL_FS_RANGE;
  *out = v;
  return FL_FS_OK;
}
static inline fl_fs_status fl_fs_num_add(int64_t a, int64_t b, int64_t *out) {
  return fl_fs_num_check(a + b, out);
}
static inline fl_fs_status fl_fs_num_sub(int64_t a, int64_t b, int64_t *out) {
  return fl_fs_num_check(a - b, out);
}
static inline fl_fs_status fl_fs_num_mul(int64_t a, int64_t b, int64_t *out) {
  int64_t ma = a < 0 ? -a : a;
  int64_t mb = b < 0 ? -b : b;
  if (ma != 0 && mb > FL_FS_LIMIT / ma) return FL_FS_RANGE;
  return fl_fs_num_check(a * b, out);
}
static inline fl_fs_status fl_fs_num_mod(int64_t a, int64_t b, int64_t *out) {
  if (b == 0) return FL_FS_DIVIDE_BY_ZERO;
  *out = a % b;
  return FL_FS_OK;
}
static inline fl_fs_status fl_fs_valid_nat(int64_t v) {
  return (v < 0 || v > FL_FS_NAT_MAX) ? FL_FS_RANGE : FL_FS_OK;
}
static inline fl_fs_status fl_fs_valid_num(int64_t v) {
  return (v > FL_FS_LIMIT || v < -FL_FS_LIMIT) ? FL_FS_RANGE : FL_FS_OK;
}
static inline fl_fs_status fl_fs_valid_int(int64_t v) {
  return (v > FL_FS_NAT_MAX || v < -FL_FS_NAT_MAX) ? FL_FS_RANGE : FL_FS_OK;
}
static inline fl_fs_status fl_fs_to_nat(int64_t v, int64_t *out) {
  if (v < 0 || v > FL_FS_NAT_MAX) return FL_FS_RANGE;
  *out = v;
  return FL_FS_OK;
}
static inline fl_fs_status fl_fs_to_int(int64_t v, int64_t *out) {
  if (v > FL_FS_NAT_MAX || v < -FL_FS_NAT_MAX) return FL_FS_RANGE;
  *out = v;
  return FL_FS_OK;
}
static inline fl_fs_status fl_fs_shift_amount(int64_t v, uint64_t *out) {
  if (v < 0) return FL_FS_SHIFT;
  *out = (uint64_t)v;
  return FL_FS_OK;
}
/* Слово для сравнения и слово не шире u32 числом: через функцию, чтобы компилятор C не судил */
/* о границах типа раньше времени. */
static inline uint64_t fl_fs_w(uint64_t v) { return v; }
static inline int64_t fl_fs_word_num(uint32_t v) { return (int64_t)v; }
static inline fl_fs_status fl_fs_u64_to_num(uint64_t v, int64_t *out) {
  if (v > (uint64_t)FL_FS_NAT_MAX) return FL_FS_OVERFLOW;
  *out = (int64_t)v;
  return FL_FS_OK;
}

/* Слова u8, u16, u32, u64: переполнение — ошибка, а у действий с заворотом (…w) её нет. */
#define FL_FS_WORD(W, T, MAX) \
  static inline fl_fs_status fl_fs_u##W##_add(T a, T b, T *out) { \
    if ((T)(MAX - a) < b) return FL_FS_OVERFLOW; \
    *out = (T)(a + b); \
    return FL_FS_OK; \
  } \
  static inline fl_fs_status fl_fs_u##W##_sub(T a, T b, T *out) { \
    if (a < b) return FL_FS_OVERFLOW; \
    *out = (T)(a - b); \
    return FL_FS_OK; \
  } \
  static inline fl_fs_status fl_fs_u##W##_mul(T a, T b, T *out) { \
    if (a != 0 && (T)(MAX / a) < b) return FL_FS_OVERFLOW; \
    *out = (T)((uint64_t)a * (uint64_t)b); \
    return FL_FS_OK; \
  } \
  static inline fl_fs_status fl_fs_u##W##_div(T a, T b, T *out) { \
    if (b == 0) return FL_FS_DIVIDE_BY_ZERO; \
    *out = (T)(a / b); \
    return FL_FS_OK; \
  } \
  static inline fl_fs_status fl_fs_u##W##_mod(T a, T b, T *out) { \
    if (b == 0) return FL_FS_DIVIDE_BY_ZERO; \
    *out = (T)(a % b); \
    return FL_FS_OK; \
  } \
  static inline T fl_fs_u##W##_addw(T a, T b) { return (T)((uint64_t)a + (uint64_t)b); } \
  static inline T fl_fs_u##W##_subw(T a, T b) { return (T)((uint64_t)a - (uint64_t)b); } \
  static inline T fl_fs_u##W##_mulw(T a, T b) { return (T)((uint64_t)a * (uint64_t)b); } \
  static inline fl_fs_status fl_fs_u##W##_from(uint64_t v, T *out) { \
    if ((uint64_t)(T)v != v) return FL_FS_OVERFLOW; \
    *out = (T)v; \
    return FL_FS_OK; \
  } \
  static inline fl_fs_status fl_fs_u##W##_from_num(int64_t v, T *out) { \
    if (v < 0 || (uint64_t)(T)v != (uint64_t)v) return FL_FS_OVERFLOW; \
    *out = (T)v; \
    return FL_FS_OK; \
  } \
  FL_FS_SHIFTS(W, T)

/* Сдвиг на величину не меньше ширины — ошибка; поворот берёт величину по модулю ширины. */
#define FL_FS_SHIFTS(W, T) \
  static inline fl_fs_status fl_fs_u##W##_shl(T a, uint64_t n, T *out) { \
    if (n >= W) return FL_FS_SHIFT; \
    *out = (T)((uint64_t)a << n); \
    return FL_FS_OK; \
  } \
  static inline fl_fs_status fl_fs_u##W##_shr(T a, uint64_t n, T *out) { \
    if (n >= W) return FL_FS_SHIFT; \
    *out = (T)((uint64_t)a >> n); \
    return FL_FS_OK; \
  } \
  static inline T fl_fs_u##W##_rotl(T a, uint64_t n) { \
    unsigned k = (unsigned)(n % W); \
    return k == 0 ? a : (T)(((uint64_t)a << k) | ((uint64_t)a >> (W - k))); \
  } \
  static inline T fl_fs_u##W##_rotr(T a, uint64_t n) { \
    unsigned k = (unsigned)(n % W); \
    return k == 0 ? a : (T)(((uint64_t)a >> k) | ((uint64_t)a << (W - k))); \
  }

FL_FS_WORD(8, uint8_t, UINT8_MAX)
FL_FS_WORD(16, uint16_t, UINT16_MAX)
FL_FS_WORD(32, uint32_t, UINT32_MAX)
FL_FS_WORD(64, uint64_t, UINT64_MAX)

#endif /* FL_FREESTANDING_H */
