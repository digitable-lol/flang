/**
 * Общий рантайм бэкенда C: статусы, сравнение чисел и процент от поля.
 *
 * Вынесен в отдельный файл, потому что это единственная часть вывода, которая не
 * зависит от IR: один и тот же текст для любого проекта. Держать его строкой
 * рядом с генератором проще, чем собирать из кусков — так видно ровно тот C,
 * который получит человек.
 *
 * Почему всё header-only и `static inline`: бэкенд обязан обходиться
 * стандартной библиотекой и не навязывать линковку с дополнительным объектным
 * файлом. Неиспользованная `static inline` функция не даёт -Wunused-function,
 * поэтому модуль без утилит компилируется так же чисто, как модуль с ними.
 */

/**
 * Сравнение double через прямое `==` в сгенерированном коде было бы враньём:
 * модель оперирует «деньгами» и процентами, а 5% от 5000 в двоичном double —
 * не то же самое число, что записанное в примере 250. Поэтому равенство —
 * смешанный допуск: абсолютный для околонулевых величин и относительный для
 * крупных сумм. Границы (`gte`, `lte`) наследуют этот же допуск, иначе
 * свойство «скидка не больше 20% суммы» ломалось бы ровно на границе;
 * строгие (`gt`, `lt`) — наоборот, требуют выйти за допуск, чтобы `gt` и `lte`
 * оставались взаимоисключающими.
 */
export const RUNTIME_HEADER = `#ifndef FTSC_RUNTIME_H
#define FTSC_RUNTIME_H

#include <math.h>
#include <stdbool.h>
#include <stddef.h>
#include <string.h>

/*
 * Контракт утилиты.
 *
 * В C нет исключений, поэтому свойство-постусловие модели превращается в код
 * возврата: утилита либо кладёт результат в *result и возвращает FTSC_OK, либо
 * не трогает *result и возвращает причину. Нарушенное свойство НЕ чинит
 * результат — вычисление прекращается, как того требует FTS.
 *
 *   ftsc_status calculate(const Input *input, double *result, const char **violation);
 *
 * Третий параметр необязателен (можно передать NULL): в него кладётся исходное
 * имя нарушенного свойства из модели — код возврата сам по себе не говорит,
 * какое именно свойство не выдержало.
 */
typedef enum ftsc_status {
  FTSC_OK = 0,
  /* нарушено свойство утилиты; в диагностике ядра — FTS_UTILITY_PROPERTY */
  FTSC_UTILITY_PROPERTY = 1,
  /* опциональное поле, нужное правилу, отсутствует; в ядре — FTS_UTILITY_INPUT */
  FTSC_UTILITY_INPUT = 2,
  /* input или result равны NULL — ошибка вызывающего, а не модели */
  FTSC_INVALID_ARGUMENT = 3
} ftsc_status;

static inline const char *ftsc_status_text(ftsc_status status) {
  switch (status) {
    case FTSC_OK:
      return "ok";
    case FTSC_UTILITY_PROPERTY:
      return "нарушено свойство утилиты";
    case FTSC_UTILITY_INPUT:
      return "во входных данных отсутствует поле";
    case FTSC_INVALID_ARGUMENT:
      return "недопустимый аргумент";
  }
  return "неизвестный статус";
}

/* Допуск сравнения чисел: абсолютный у нуля, относительный на больших суммах. */
#define FTSC_EPSILON 1e-9

static inline bool ftsc_number_eq(double left, double right) {
  const double difference = fabs(left - right);
  const double scale = fabs(left) > fabs(right) ? fabs(left) : fabs(right);
  return difference <= FTSC_EPSILON || difference <= FTSC_EPSILON * scale;
}

static inline bool ftsc_number_neq(double left, double right) {
  return !ftsc_number_eq(left, right);
}

static inline bool ftsc_number_gte(double left, double right) {
  return left >= right || ftsc_number_eq(left, right);
}

static inline bool ftsc_number_lte(double left, double right) {
  return left <= right || ftsc_number_eq(left, right);
}

static inline bool ftsc_number_gt(double left, double right) {
  return left > right && !ftsc_number_eq(left, right);
}

static inline bool ftsc_number_lt(double left, double right) {
  return left < right && !ftsc_number_eq(left, right);
}

/* Строки модели неизменяемы, сравниваются по содержимому; NULL допустим. */
static inline bool ftsc_text_eq(const char *left, const char *right) {
  if (left == NULL || right == NULL) {
    return left == right;
  }
  return strcmp(left, right) == 0;
}

static inline bool ftsc_text_neq(const char *left, const char *right) {
  return !ftsc_text_eq(left, right);
}

/* «10% от поля сумма»: тот же порядок множителей, что у эталонного движка FTS. */
static inline double ftsc_percent(double percent, double value) {
  return percent / 100.0 * value;
}

#endif /* FTSC_RUNTIME_H */
`
