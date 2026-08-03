/*
 * Рантайм flang для бэкенда C — реализация.
 *
 * Всё, что здесь есть, существует ради одного требования: сгенерированная
 * программа обязана давать те же значения и те же диагностики (код И текст),
 * что flang/src/interpret.mjs. Поэтому сообщения скопированы дословно, вплоть
 * до кавычек-ёлочек, порядок операций в процентах — как в ядре FTS, а число
 * печатается по правилам ECMAScript Number::toString, а не «как выйдет у %g».
 *
 * Зависимости — только стандартная библиотека C99.
 */
#include "flang_runtime.h"

#include <errno.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* ═════════════════════════════ арена ═════════════════════════════ */

/*
 * Выравнивание: объединение самых «требовательных» типов. В C99 нет
 * max_align_t, а угадывать «наверное, 8» значило бы поймать SIGBUS на первой
 * же платформе со строгим выравниванием — а целятся сюда как раз такие
 * (RISC-V, старые ARM).
 */
typedef union fl_align {
  long double as_long_double;
  double as_double;
  void *as_pointer;
  size_t as_size;
} fl_align;

#define FL_ALIGNMENT (sizeof(fl_align))
#define FL_CHUNK_MIN (size_t)(64u * 1024u)

struct fl_chunk {
  fl_chunk *next;
  size_t used;
  size_t capacity;
};

static size_t fl_round_up(size_t size) {
  const size_t remainder = size % FL_ALIGNMENT;
  return remainder == 0 ? size : size + (FL_ALIGNMENT - remainder);
}

static char *fl_chunk_data(fl_chunk *chunk) {
  return (char *)chunk + fl_round_up(sizeof(fl_chunk));
}

void fl_arena_init(fl_arena *arena) {
  if (arena == NULL) {
    return;
  }
  arena->chunks = NULL;
  arena->current = NULL;
  arena->reserved = 0;
}

void *fl_arena_alloc(fl_arena *arena, size_t size) {
  if (arena == NULL) {
    return NULL;
  }
  const size_t wanted = fl_round_up(size == 0 ? 1 : size);

  /* Сперва текущий кусок, затем следующие уже купленные (после reset они
     пусты и переиспользуются), и только потом покупка нового. */
  while (arena->current != NULL) {
    if (arena->current->capacity - arena->current->used >= wanted) {
      char *block = fl_chunk_data(arena->current) + arena->current->used;
      arena->current->used += wanted;
      return block;
    }
    if (arena->current->next == NULL || arena->current->next->used != 0) {
      break;
    }
    arena->current = arena->current->next;
  }

  {
    const size_t header = fl_round_up(sizeof(fl_chunk));
    size_t capacity = FL_CHUNK_MIN;
    fl_chunk *chunk = NULL;
    if (capacity < wanted) {
      capacity = wanted;
    }
    if (capacity > (size_t)-1 - header) {
      return NULL; /* переполнение размера — только при абсурдном запросе */
    }
    chunk = (fl_chunk *)malloc(header + capacity);
    if (chunk == NULL) {
      return NULL;
    }
    chunk->capacity = capacity;
    chunk->used = wanted;
    chunk->next = NULL;
    if (arena->current == NULL) {
      chunk->next = arena->chunks;
      arena->chunks = chunk;
    } else {
      chunk->next = arena->current->next;
      arena->current->next = chunk;
    }
    arena->current = chunk;
    arena->reserved += header + capacity;
    return fl_chunk_data(chunk);
  }
}

void fl_arena_reset(fl_arena *arena) {
  fl_chunk *chunk = NULL;
  if (arena == NULL) {
    return;
  }
  for (chunk = arena->chunks; chunk != NULL; chunk = chunk->next) {
    chunk->used = 0;
  }
  arena->current = arena->chunks;
}

void fl_arena_release(fl_arena *arena) {
  fl_chunk *chunk = NULL;
  if (arena == NULL) {
    return;
  }
  chunk = arena->chunks;
  while (chunk != NULL) {
    fl_chunk *next = chunk->next;
    free(chunk);
    chunk = next;
  }
  arena->chunks = NULL;
  arena->current = NULL;
  arena->reserved = 0;
}

/* ═════════════════════════════ контекст ═════════════════════════════ */

void fl_ctx_init(fl_ctx *ctx, fl_arena *arena) {
  if (ctx == NULL) {
    return;
  }
  ctx->arena = arena;
  ctx->depth = 0;
  ctx->max_depth = FL_MAX_DEPTH;
}

const char *fl_status_text(fl_status status) {
  switch (status) {
    case FL_OK:
      return "ok";
    case FL_ERROR:
      return "вычисление прекращено ошибкой";
    case FL_INVALID_ARGUMENT:
      return "недопустимый аргумент";
  }
  return "неизвестный статус";
}

/* ═════════════════════════════ ошибки ═════════════════════════════ */

static const char *fl_vformat(fl_ctx *ctx, const char *format, va_list args) {
  va_list probe;
  int needed = 0;
  char *buffer = NULL;
  if (ctx == NULL || ctx->arena == NULL) {
    return NULL;
  }
  va_copy(probe, args);
  needed = vsnprintf(NULL, 0, format, probe);
  va_end(probe);
  if (needed < 0) {
    return NULL;
  }
  buffer = (char *)fl_arena_alloc(ctx->arena, (size_t)needed + 1);
  if (buffer == NULL) {
    return NULL;
  }
  vsnprintf(buffer, (size_t)needed + 1, format, args);
  return buffer;
}

fl_status fl_fail(fl_ctx *ctx, fl_error *error, const char *code, const char *format, ...) {
  va_list args;
  const char *message = NULL;
  if (error == NULL) {
    /* Вызывающему текст не нужен — не строим его вовсе: диагностика стоит
       выделения памяти, а платить за неё молча неправильно. */
    return FL_ERROR;
  }
  va_start(args, format);
  message = fl_vformat(ctx, format, args);
  va_end(args);
  if (message == NULL) {
    error->code = FL_CODE_MEMORY;
    error->message = "недостаточно памяти для текста диагностики";
    return FL_ERROR;
  }
  error->code = code;
  error->message = message;
  return FL_ERROR;
}

static fl_status fl_no_memory(fl_error *error) {
  if (error != NULL) {
    error->code = FL_CODE_MEMORY;
    error->message = "недостаточно памяти";
  }
  return FL_ERROR;
}

fl_status fl_enter(fl_ctx *ctx, const char *function, fl_error *error) {
  if (ctx == NULL) {
    return FL_INVALID_ARGUMENT;
  }
  ctx->depth += 1;
  if (ctx->depth > ctx->max_depth) {
    /* Текст дословно как у интерпретатора: сперва предел, потом достигнутая
       глубина (она на единицу больше предела). */
    return fl_fail(ctx, error, FL_CODE_RECURSION_LIMIT,
                   "функция «%s» превысила предел глубины вызовов (%lu) на глубине %lu", function,
                   (unsigned long)ctx->max_depth, (unsigned long)ctx->depth);
  }
  return FL_OK;
}

void fl_leave(fl_ctx *ctx) {
  if (ctx != NULL && ctx->depth > 0) {
    ctx->depth -= 1;
  }
}

/* ═════════════════════════════ UTF-8 ═════════════════════════════ */

/*
 * Строки flang меряются кодовыми точками (SPEC, раздел 5), поэтому весь UTF-8
 * здесь — свой, без единой сторонней библиотеки. Ведущий байт кодовой точки
 * узнаётся тем же способом, что и везде: у продолжения старшие биты 10.
 */
static size_t fl_utf8_points(const char *utf8, size_t bytes) {
  size_t points = 0;
  size_t index = 0;
  for (index = 0; index < bytes; index += 1) {
    if (((unsigned char)utf8[index] & 0xC0u) != 0x80u) {
      points += 1;
    }
  }
  return points;
}

/** Байтовое смещение кодовой точки с номером point (от нуля). */
static size_t fl_utf8_offset(const char *utf8, size_t bytes, size_t point) {
  size_t seen = 0;
  size_t index = 0;
  for (index = 0; index < bytes; index += 1) {
    if (((unsigned char)utf8[index] & 0xC0u) != 0x80u) {
      if (seen == point) {
        return index;
      }
      seen += 1;
    }
  }
  return bytes;
}

static unsigned long fl_utf8_decode(const char *utf8, size_t bytes, size_t offset, size_t *width) {
  const unsigned char lead = (unsigned char)utf8[offset];
  unsigned long code = lead;
  size_t length = 1;
  if (lead >= 0xF0u) {
    length = 4;
    code = lead & 0x07u;
  } else if (lead >= 0xE0u) {
    length = 3;
    code = lead & 0x0Fu;
  } else if (lead >= 0xC0u) {
    length = 2;
    code = lead & 0x1Fu;
  }
  if (offset + length > bytes) {
    length = 1;
    code = lead;
  } else if (length > 1) {
    size_t index = 1;
    for (index = 1; index < length; index += 1) {
      code = (code << 6) | ((unsigned char)utf8[offset + index] & 0x3Fu);
    }
  }
  if (width != NULL) {
    *width = length;
  }
  return code;
}

/* Пробел по ECMAScript: WhiteSpace + LineTerminator. Список закрытый, поэтому
   он здесь целиком, а не «всё, что скажет isspace» — isspace зависит от locale
   и не знает про U+00A0 и U+2028. */
static bool fl_js_space(unsigned long code) {
  switch (code) {
    case 0x0009u:
    case 0x000Au:
    case 0x000Bu:
    case 0x000Cu:
    case 0x000Du:
    case 0x0020u:
    case 0x00A0u:
    case 0x1680u:
    case 0x2028u:
    case 0x2029u:
    case 0x202Fu:
    case 0x205Fu:
    case 0x3000u:
    case 0xFEFFu:
      return true;
    default:
      return code >= 0x2000u && code <= 0x200Au;
  }
}

/* ═════════════════════════════ значения ═════════════════════════════ */

fl_value fl_nothing(void) {
  fl_value value;
  value.tag = FL_NOTHING;
  value.as.number = 0.0;
  return value;
}

fl_value fl_number(double number) {
  fl_value value;
  value.tag = FL_NUMBER;
  value.as.number = number;
  return value;
}

fl_value fl_flag(bool flag) {
  fl_value value;
  value.tag = FL_FLAG;
  value.as.flag = flag;
  return value;
}

fl_value fl_text_borrow(const char *utf8, size_t bytes, size_t points) {
  fl_value value;
  value.tag = FL_STRING;
  value.as.string.utf8 = utf8;
  value.as.string.bytes = bytes;
  value.as.string.points = points;
  return value;
}

/** Строка-константа рантайма («да», «нет», «ничто»): длины считаются на месте. */
static fl_value fl_text_static(const char *utf8) {
  const size_t bytes = strlen(utf8);
  return fl_text_borrow(utf8, bytes, fl_utf8_points(utf8, bytes));
}

fl_status fl_text(fl_ctx *ctx, const char *utf8, size_t bytes, fl_value *out, fl_error *error) {
  char *copy = NULL;
  if (ctx == NULL || out == NULL) {
    return FL_INVALID_ARGUMENT;
  }
  copy = (char *)fl_arena_alloc(ctx->arena, bytes + 1);
  if (copy == NULL) {
    return fl_no_memory(error);
  }
  if (bytes > 0) {
    memcpy(copy, utf8, bytes);
  }
  copy[bytes] = '\0';
  *out = fl_text_borrow(copy, bytes, fl_utf8_points(copy, bytes));
  return FL_OK;
}

fl_value fl_list(const fl_value *items, size_t count) {
  fl_value value;
  value.tag = FL_LIST;
  value.as.list.items = items;
  value.as.list.count = count;
  return value;
}

fl_status fl_list_alloc(fl_ctx *ctx, size_t count, fl_value **items, fl_error *error) {
  if (ctx == NULL || items == NULL) {
    return FL_INVALID_ARGUMENT;
  }
  if (count == 0) {
    *items = NULL;
    return FL_OK;
  }
  if (count > ((size_t)-1) / sizeof(fl_value)) {
    return fl_no_memory(error);
  }
  *items = (fl_value *)fl_arena_alloc(ctx->arena, count * sizeof(fl_value));
  if (*items == NULL) {
    return fl_no_memory(error);
  }
  return FL_OK;
}

/*
 * Хвост списка — срез, а не копия. В JS «хвост» копирует, потому что массив
 * нельзя разделить с суффиксом; здесь значения неизменяемы и живут в арене,
 * поэтому срез наблюдаемо неотличим от копии, а рекурсия «голова и хвост» по
 * длинному списку из квадратичной становится линейной.
 */
fl_value fl_list_slice(fl_value list, size_t from) {
  if (list.tag != FL_LIST || from >= list.as.list.count) {
    return fl_list(NULL, 0);
  }
  return fl_list(list.as.list.items + from, list.as.list.count - from);
}

static fl_status fl_fields_new(fl_ctx *ctx, const char *const *names, const fl_value *values, size_t count,
                               const fl_field **out, fl_error *error) {
  fl_field *fields = NULL;
  size_t index = 0;
  if (count == 0) {
    *out = NULL;
    return FL_OK;
  }
  if (count > ((size_t)-1) / sizeof(fl_field)) {
    return fl_no_memory(error);
  }
  fields = (fl_field *)fl_arena_alloc(ctx->arena, count * sizeof(fl_field));
  if (fields == NULL) {
    return fl_no_memory(error);
  }
  for (index = 0; index < count; index += 1) {
    fields[index].name = names[index];
    fields[index].value = values[index];
  }
  *out = fields;
  return FL_OK;
}

fl_status fl_record_new(fl_ctx *ctx, const char *const *names, const fl_value *values, size_t count,
                        fl_value *out, fl_error *error) {
  fl_record *record = NULL;
  if (ctx == NULL || out == NULL) {
    return FL_INVALID_ARGUMENT;
  }
  record = (fl_record *)fl_arena_alloc(ctx->arena, sizeof(fl_record));
  if (record == NULL) {
    return fl_no_memory(error);
  }
  record->count = count;
  record->fields = NULL;
  FL_TRY(fl_fields_new(ctx, names, values, count, &record->fields, error));
  out->tag = FL_RECORD;
  out->as.record = record;
  return FL_OK;
}

fl_status fl_variant_new(fl_ctx *ctx, const char *name, const char *const *names, const fl_value *values,
                         size_t count, fl_value *out, fl_error *error) {
  fl_variant *variant = NULL;
  if (ctx == NULL || out == NULL) {
    return FL_INVALID_ARGUMENT;
  }
  variant = (fl_variant *)fl_arena_alloc(ctx->arena, sizeof(fl_variant));
  if (variant == NULL) {
    return fl_no_memory(error);
  }
  variant->name = name;
  variant->count = count;
  variant->fields = NULL;
  FL_TRY(fl_fields_new(ctx, names, values, count, &variant->fields, error));
  out->tag = FL_VARIANT;
  out->as.variant = variant;
  return FL_OK;
}

bool fl_is_list(fl_value value) {
  return value.tag == FL_LIST;
}

bool fl_is_record(fl_value value) {
  return value.tag == FL_RECORD;
}

bool fl_is_variant(fl_value value) {
  return value.tag == FL_VARIANT;
}

bool fl_is_scalar(fl_value value) {
  return value.tag == FL_NOTHING || value.tag == FL_NUMBER || value.tag == FL_FLAG || value.tag == FL_STRING;
}

bool fl_variant_is(fl_value value, const char *name) {
  return value.tag == FL_VARIANT && strcmp(value.as.variant->name, name) == 0;
}

/* ═════════════════════════ число → текст ═════════════════════════ */

/*
 * Правила ECMAScript Number::toString. Меньше всего хотелось писать это
 * руками, но выбора нет: «к строке» от числа и половина текстов диагностик
 * содержат число, а printf("%g") печатает «1e+21» как «1e+21» и «100000» как
 * «100000», зато 0.1 — как «0.1» лишь по счастливой случайности выбранной
 * точности. Совпадение с интерпретатором обязано быть посимвольным.
 *
 * Шаг первый — кратчайшая запись, читающаяся обратно тем же double: пробуем
 * точности от 1 до 17 и берём первую, которую strtod возвращает без потерь.
 * Шаг второй — расстановка точки и экспоненты ровно по таблице стандарта.
 */
size_t fl_number_text(double value, char *buffer) {
  char probe[64];
  char digits[32];
  size_t offset = 0;
  size_t count = 0;
  const char *cursor = NULL;
  int precision = 1;
  int exponent = 0;
  int n = 0;
  int k = 0;

  if (isnan(value)) {
    memcpy(buffer, "NaN", 4);
    return 3;
  }
  if (value == 0.0) {
    /* String(-0) === "0": знак нуля не печатается (но Object.is его различает). */
    buffer[0] = '0';
    buffer[1] = '\0';
    return 1;
  }
  if (value < 0.0) {
    buffer[offset] = '-';
    offset += 1;
    value = -value;
  }
  if (isinf(value)) {
    memcpy(buffer + offset, "Infinity", 9);
    return offset + 8;
  }

  for (precision = 1; precision < 17; precision += 1) {
    snprintf(probe, sizeof probe, "%.*e", precision - 1, value);
    if (strtod(probe, NULL) == value) {
      break;
    }
  }
  snprintf(probe, sizeof probe, "%.*e", precision - 1, value);

  for (cursor = probe; *cursor != '\0' && *cursor != 'e'; cursor += 1) {
    if (*cursor >= '0' && *cursor <= '9') {
      digits[count] = *cursor;
      count += 1;
    }
  }
  digits[count] = '\0';
  exponent = (*cursor == 'e') ? atoi(cursor + 1) : 0;

  k = (int)count;
  n = exponent + 1;

  if (k <= n && n <= 21) {
    memcpy(buffer + offset, digits, count);
    offset += count;
    while (n > k) {
      buffer[offset] = '0';
      offset += 1;
      n -= 1;
    }
  } else if (n > 0 && n <= 21) {
    memcpy(buffer + offset, digits, (size_t)n);
    offset += (size_t)n;
    buffer[offset] = '.';
    offset += 1;
    memcpy(buffer + offset, digits + n, count - (size_t)n);
    offset += count - (size_t)n;
  } else if (n > -6 && n <= 0) {
    buffer[offset] = '0';
    buffer[offset + 1] = '.';
    offset += 2;
    while (n < 0) {
      buffer[offset] = '0';
      offset += 1;
      n += 1;
    }
    memcpy(buffer + offset, digits, count);
    offset += count;
  } else {
    buffer[offset] = digits[0];
    offset += 1;
    if (k > 1) {
      buffer[offset] = '.';
      offset += 1;
      memcpy(buffer + offset, digits + 1, count - 1);
      offset += count - 1;
    }
    buffer[offset] = 'e';
    offset += 1;
    buffer[offset] = (n - 1) < 0 ? '-' : '+';
    offset += 1;
    offset += (size_t)snprintf(buffer + offset, FL_NUMBER_TEXT_MAX - offset, "%d", n - 1 < 0 ? -(n - 1) : n - 1);
  }
  buffer[offset] = '\0';
  return offset;
}

/* ═════════════════════════ буфер для текстов ═════════════════════════ */

typedef struct fl_buffer {
  char *data;
  size_t length;
  size_t capacity;
} fl_buffer;

static bool fl_buffer_reserve(fl_ctx *ctx, fl_buffer *buffer, size_t extra) {
  size_t capacity = buffer->capacity == 0 ? 64 : buffer->capacity;
  char *data = NULL;
  if (buffer->length + extra + 1 <= buffer->capacity) {
    return true;
  }
  while (capacity < buffer->length + extra + 1) {
    capacity *= 2;
  }
  /* Арена не умеет освобождать, поэтому рост — это копирование в новый блок.
     Строки диагностик короткие, а значит и копий одна-две. */
  data = (char *)fl_arena_alloc(ctx->arena, capacity);
  if (data == NULL) {
    return false;
  }
  if (buffer->length > 0) {
    memcpy(data, buffer->data, buffer->length);
  }
  buffer->data = data;
  buffer->capacity = capacity;
  return true;
}

static bool fl_buffer_add(fl_ctx *ctx, fl_buffer *buffer, const char *text, size_t bytes) {
  if (!fl_buffer_reserve(ctx, buffer, bytes)) {
    return false;
  }
  if (bytes > 0) {
    memcpy(buffer->data + buffer->length, text, bytes);
  }
  buffer->length += bytes;
  buffer->data[buffer->length] = '\0';
  return true;
}

static bool fl_buffer_text(fl_ctx *ctx, fl_buffer *buffer, const char *text) {
  return fl_buffer_add(ctx, buffer, text, strlen(text));
}

/* ═════════════════════════ описание значений ═════════════════════════ */

const char *fl_type_name(fl_ctx *ctx, fl_value value) {
  switch (value.tag) {
    case FL_NOTHING:
      return "ничто";
    case FL_STRING:
      return "строка";
    case FL_NUMBER:
      return "число";
    case FL_FLAG:
      return "признак";
    case FL_LIST:
      return "список";
    case FL_RECORD:
      return "запись";
    case FL_VARIANT: {
      fl_buffer buffer;
      buffer.data = NULL;
      buffer.length = 0;
      buffer.capacity = 0;
      if (!fl_buffer_text(ctx, &buffer, "вариант «") || !fl_buffer_text(ctx, &buffer, value.as.variant->name) ||
          !fl_buffer_text(ctx, &buffer, "»")) {
        return "вариант";
      }
      return buffer.data;
    }
  }
  return "неизвестное значение";
}

/** JSON.stringify для строки: диагностики интерпретатора печатают строки им. */
static bool fl_buffer_quote(fl_ctx *ctx, fl_buffer *buffer, const char *utf8, size_t bytes) {
  size_t index = 0;
  if (!fl_buffer_text(ctx, buffer, "\"")) {
    return false;
  }
  for (index = 0; index < bytes; index += 1) {
    const unsigned char byte = (unsigned char)utf8[index];
    char escape[8];
    switch (byte) {
      case '"':
        if (!fl_buffer_text(ctx, buffer, "\\\"")) return false;
        continue;
      case '\\':
        if (!fl_buffer_text(ctx, buffer, "\\\\")) return false;
        continue;
      case '\b':
        if (!fl_buffer_text(ctx, buffer, "\\b")) return false;
        continue;
      case '\f':
        if (!fl_buffer_text(ctx, buffer, "\\f")) return false;
        continue;
      case '\n':
        if (!fl_buffer_text(ctx, buffer, "\\n")) return false;
        continue;
      case '\r':
        if (!fl_buffer_text(ctx, buffer, "\\r")) return false;
        continue;
      case '\t':
        if (!fl_buffer_text(ctx, buffer, "\\t")) return false;
        continue;
      default:
        break;
    }
    if (byte < 0x20u) {
      snprintf(escape, sizeof escape, "\\u%04x", (unsigned)byte);
      if (!fl_buffer_text(ctx, buffer, escape)) return false;
      continue;
    }
    if (!fl_buffer_add(ctx, buffer, (const char *)&byte, 1)) return false;
  }
  return fl_buffer_text(ctx, buffer, "\"");
}

static bool fl_describe_into(fl_ctx *ctx, fl_buffer *buffer, fl_value value) {
  char number[FL_NUMBER_TEXT_MAX];
  size_t index = 0;
  switch (value.tag) {
    case FL_STRING:
      return fl_buffer_quote(ctx, buffer, value.as.string.utf8, value.as.string.bytes);
    case FL_VARIANT:
      if (!fl_buffer_text(ctx, buffer, value.as.variant->name)) return false;
      if (value.as.variant->count == 0) return true;
      if (!fl_buffer_text(ctx, buffer, "(")) return false;
      for (index = 0; index < value.as.variant->count; index += 1) {
        if (index > 0 && !fl_buffer_text(ctx, buffer, ", ")) return false;
        if (!fl_buffer_text(ctx, buffer, value.as.variant->fields[index].name)) return false;
      }
      return fl_buffer_text(ctx, buffer, ")");
    case FL_LIST:
      snprintf(number, sizeof number, "%lu", (unsigned long)value.as.list.count);
      return fl_buffer_text(ctx, buffer, "список из ") && fl_buffer_text(ctx, buffer, number);
    case FL_RECORD:
      if (!fl_buffer_text(ctx, buffer, "запись {")) return false;
      for (index = 0; index < value.as.record->count; index += 1) {
        if (index > 0 && !fl_buffer_text(ctx, buffer, ", ")) return false;
        if (!fl_buffer_text(ctx, buffer, value.as.record->fields[index].name)) return false;
      }
      return fl_buffer_text(ctx, buffer, "}");
    case FL_NOTHING:
      return fl_buffer_text(ctx, buffer, "ничто");
    case FL_FLAG:
      return fl_buffer_text(ctx, buffer, value.as.flag ? "да" : "нет");
    case FL_NUMBER:
      fl_number_text(value.as.number, number);
      return fl_buffer_text(ctx, buffer, number);
  }
  return fl_buffer_text(ctx, buffer, "неизвестное значение");
}

const char *fl_describe(fl_ctx *ctx, fl_value value) {
  fl_buffer buffer;
  buffer.data = NULL;
  buffer.length = 0;
  buffer.capacity = 0;
  if (!fl_describe_into(ctx, &buffer, value)) {
    return "значение";
  }
  return buffer.data;
}

/** Строка в кавычках JSON — для диагностик «к числу». */
static const char *fl_quoted(fl_ctx *ctx, fl_value text) {
  fl_buffer buffer;
  buffer.data = NULL;
  buffer.length = 0;
  buffer.capacity = 0;
  if (!fl_buffer_quote(ctx, &buffer, text.as.string.utf8, text.as.string.bytes)) {
    return "\"\"";
  }
  return buffer.data;
}

/* ═════════════════════════ равенство ═════════════════════════ */

static bool fl_same_number(double left, double right) {
  /* Object.is: NaN равен NaN, 0 не равен −0. */
  if (isnan(left) || isnan(right)) {
    return isnan(left) && isnan(right);
  }
  if (left != right) {
    return false;
  }
  if (left == 0.0) {
    return (signbit(left) != 0) == (signbit(right) != 0);
  }
  return true;
}

static bool fl_fields_equal(const fl_field *left, size_t left_count, const fl_field *right, size_t right_count) {
  size_t index = 0;
  size_t other = 0;
  if (left_count != right_count) {
    return false;
  }
  /* Порядок ключей неважен — важен состав, как в recordsEqual интерпретатора. */
  for (index = 0; index < left_count; index += 1) {
    bool found = false;
    for (other = 0; other < right_count; other += 1) {
      if (strcmp(left[index].name, right[other].name) == 0) {
        found = fl_equal(left[index].value, right[other].value);
        break;
      }
    }
    if (!found) {
      return false;
    }
  }
  return true;
}

bool fl_equal(fl_value left, fl_value right) {
  if (fl_is_scalar(left) || fl_is_scalar(right)) {
    if (!fl_is_scalar(left) || !fl_is_scalar(right) || left.tag != right.tag) {
      return false;
    }
    switch (left.tag) {
      case FL_NOTHING:
        return true;
      case FL_FLAG:
        return left.as.flag == right.as.flag;
      case FL_NUMBER:
        return fl_same_number(left.as.number, right.as.number);
      case FL_STRING:
        return left.as.string.bytes == right.as.string.bytes &&
               (left.as.string.bytes == 0 ||
                memcmp(left.as.string.utf8, right.as.string.utf8, left.as.string.bytes) == 0);
      default:
        return false;
    }
  }
  if (left.tag == FL_LIST && right.tag == FL_LIST) {
    size_t index = 0;
    if (left.as.list.count != right.as.list.count) {
      return false;
    }
    for (index = 0; index < left.as.list.count; index += 1) {
      if (!fl_equal(left.as.list.items[index], right.as.list.items[index])) {
        return false;
      }
    }
    return true;
  }
  if (left.tag == FL_VARIANT && right.tag == FL_VARIANT) {
    if (strcmp(left.as.variant->name, right.as.variant->name) != 0) {
      return false;
    }
    return fl_fields_equal(left.as.variant->fields, left.as.variant->count, right.as.variant->fields,
                           right.as.variant->count);
  }
  if (left.tag == FL_RECORD && right.tag == FL_RECORD) {
    return fl_fields_equal(left.as.record->fields, left.as.record->count, right.as.record->fields,
                           right.as.record->count);
  }
  return false;
}

/* ═════════════════════════ операции языка ═════════════════════════ */

fl_status fl_field_get(fl_ctx *ctx, fl_value target, const char *name, fl_value *out, fl_error *error) {
  size_t index = 0;
  if (target.tag == FL_VARIANT) {
    return fl_fail(ctx, error, FL_CODE_TYPE, "поле «%s» нельзя взять у варианта «%s» — нужен разбор", name,
                   target.as.variant->name);
  }
  if (target.tag != FL_RECORD) {
    return fl_fail(ctx, error, FL_CODE_TYPE, "поле «%s» можно взять только у записи, получено %s", name,
                   fl_type_name(ctx, target));
  }
  for (index = 0; index < target.as.record->count; index += 1) {
    if (strcmp(target.as.record->fields[index].name, name) == 0) {
      *out = target.as.record->fields[index].value;
      return FL_OK;
    }
  }
  return fl_fail(ctx, error, FL_CODE_UNKNOWN_NAME, "запись не содержит поле «%s»", name);
}

fl_status fl_variant_field(fl_ctx *ctx, fl_value target, const char *name, fl_value *out, fl_error *error) {
  size_t index = 0;
  for (index = 0; index < target.as.variant->count; index += 1) {
    if (strcmp(target.as.variant->fields[index].name, name) == 0) {
      *out = target.as.variant->fields[index].value;
      return FL_OK;
    }
  }
  return fl_fail(ctx, error, FL_CODE_UNKNOWN_NAME, "вариант «%s» не содержит поле «%s»", target.as.variant->name,
                 name);
}

fl_status fl_cond(fl_ctx *ctx, fl_value value, bool *out, fl_error *error) {
  if (value.tag != FL_FLAG) {
    return fl_fail(ctx, error, FL_CODE_TYPE, "условие «если» должно быть признаком, получено %s",
                   fl_type_name(ctx, value));
  }
  *out = value.as.flag;
  return FL_OK;
}

fl_status fl_keep(fl_ctx *ctx, fl_value value, bool *out, fl_error *error) {
  if (value.tag != FL_FLAG) {
    return fl_fail(ctx, error, FL_CODE_TYPE, "условие «отфильтровать» должно быть признаком, получено %s",
                   fl_type_name(ctx, value));
  }
  *out = value.as.flag;
  return FL_OK;
}

fl_status fl_post(fl_ctx *ctx, fl_value value, const char *property, const char *function, bool *out,
                  fl_error *error) {
  if (value.tag != FL_FLAG) {
    return fl_fail(ctx, error, FL_CODE_TYPE,
                   "постусловие «%s» функции «%s» должно давать признак, получено %s", property, function,
                   fl_type_name(ctx, value));
  }
  *out = value.as.flag;
  return FL_OK;
}

fl_status fl_match_fail(fl_ctx *ctx, fl_value value, fl_error *error) {
  return fl_fail(ctx, error, FL_CODE_MATCH_NOT_EXHAUSTIVE, "разбор не покрывает значение %s",
                 fl_describe(ctx, value));
}

fl_status fl_require_list(fl_ctx *ctx, fl_value value, const char *label, fl_value *out, fl_error *error) {
  if (value.tag != FL_LIST) {
    return fl_fail(ctx, error, FL_CODE_TYPE, "«%s» работает только со списком, получено %s", label,
                   fl_type_name(ctx, value));
  }
  *out = value;
  return FL_OK;
}

static fl_status fl_numbers(fl_ctx *ctx, const char *op, fl_value left, fl_value right, fl_error *error) {
  if (left.tag != FL_NUMBER || right.tag != FL_NUMBER) {
    const char *left_name = fl_type_name(ctx, left);
    return fl_fail(ctx, error, FL_CODE_TYPE, "операция «%s» допустима только для чисел, получено %s и %s", op,
                   left_name, fl_type_name(ctx, right));
  }
  return FL_OK;
}

/* Сообщение дословно как в ядре (src/utility.ts, compare). */
static fl_status fl_order(fl_ctx *ctx, fl_value left, fl_value right, fl_error *error) {
  if (left.tag != FL_NUMBER || right.tag != FL_NUMBER) {
    return fl_fail(ctx, error, FL_CODE_TYPE, "%s", "сравнения порядка допустимы только для чисел");
  }
  return FL_OK;
}

fl_status fl_add(fl_ctx *ctx, fl_value left, fl_value right, fl_value *out, fl_error *error) {
  FL_TRY(fl_numbers(ctx, "add", left, right, error));
  *out = fl_number(left.as.number + right.as.number);
  return FL_OK;
}

fl_status fl_sub(fl_ctx *ctx, fl_value left, fl_value right, fl_value *out, fl_error *error) {
  FL_TRY(fl_numbers(ctx, "sub", left, right, error));
  *out = fl_number(left.as.number - right.as.number);
  return FL_OK;
}

fl_status fl_mul(fl_ctx *ctx, fl_value left, fl_value right, fl_value *out, fl_error *error) {
  FL_TRY(fl_numbers(ctx, "mul", left, right, error));
  *out = fl_number(left.as.number * right.as.number);
  return FL_OK;
}

/* Деление на ноль даёт Infinity — это значение IEEE-754, а не ошибка. */
fl_status fl_div(fl_ctx *ctx, fl_value left, fl_value right, fl_value *out, fl_error *error) {
  FL_TRY(fl_numbers(ctx, "div", left, right, error));
  *out = fl_number(left.as.number / right.as.number);
  return FL_OK;
}

fl_status fl_mod(fl_ctx *ctx, fl_value left, fl_value right, fl_value *out, fl_error *error) {
  FL_TRY(fl_numbers(ctx, "mod", left, right, error));
  /* Оператор % в JS для чисел — это fmod: знак от делимого, без округления. */
  *out = fl_number(fmod(left.as.number, right.as.number));
  return FL_OK;
}

/* Порядок операций ядра: (процент / 100) * значение. Переставить множители
   нельзя — меняется последний бит мантиссы. */
fl_status fl_percent(fl_ctx *ctx, fl_value left, fl_value right, fl_value *out, fl_error *error) {
  FL_TRY(fl_numbers(ctx, "percent", left, right, error));
  *out = fl_number((left.as.number / 100.0) * right.as.number);
  return FL_OK;
}

fl_status fl_gt(fl_ctx *ctx, fl_value left, fl_value right, fl_value *out, fl_error *error) {
  FL_TRY(fl_order(ctx, left, right, error));
  *out = fl_flag(left.as.number > right.as.number);
  return FL_OK;
}

fl_status fl_lt(fl_ctx *ctx, fl_value left, fl_value right, fl_value *out, fl_error *error) {
  FL_TRY(fl_order(ctx, left, right, error));
  *out = fl_flag(left.as.number < right.as.number);
  return FL_OK;
}

fl_status fl_gte(fl_ctx *ctx, fl_value left, fl_value right, fl_value *out, fl_error *error) {
  FL_TRY(fl_order(ctx, left, right, error));
  *out = fl_flag(left.as.number >= right.as.number);
  return FL_OK;
}

fl_status fl_lte(fl_ctx *ctx, fl_value left, fl_value right, fl_value *out, fl_error *error) {
  FL_TRY(fl_order(ctx, left, right, error));
  *out = fl_flag(left.as.number <= right.as.number);
  return FL_OK;
}

static fl_status fl_join_two(fl_ctx *ctx, fl_value left, fl_value right, fl_value *out, fl_error *error) {
  char *data = NULL;
  const size_t bytes = left.as.string.bytes + right.as.string.bytes;
  data = (char *)fl_arena_alloc(ctx->arena, bytes + 1);
  if (data == NULL) {
    return fl_no_memory(error);
  }
  if (left.as.string.bytes > 0) {
    memcpy(data, left.as.string.utf8, left.as.string.bytes);
  }
  if (right.as.string.bytes > 0) {
    memcpy(data + left.as.string.bytes, right.as.string.utf8, right.as.string.bytes);
  }
  data[bytes] = '\0';
  *out = fl_text_borrow(data, bytes, left.as.string.points + right.as.string.points);
  return FL_OK;
}

fl_status fl_concat(fl_ctx *ctx, fl_value left, fl_value right, fl_value *out, fl_error *error) {
  if (left.tag != FL_STRING || right.tag != FL_STRING) {
    const char *left_name = fl_type_name(ctx, left);
    return fl_fail(ctx, error, FL_CODE_TYPE, "«соединить» допустимо только для строк, получено %s и %s",
                   left_name, fl_type_name(ctx, right));
  }
  return fl_join_two(ctx, left, right, out, error);
}

/* ═════════════════════════ проверка аргументов ═════════════════════════ */

static fl_status fl_expect_string(fl_ctx *ctx, const char *name, fl_value value, const char *role,
                                  fl_error *error) {
  if (value.tag != FL_STRING) {
    return fl_fail(ctx, error, FL_CODE_BUILTIN_ARGS, "«%s»: %s должна быть строкой, получено %s", name, role,
                   fl_type_name(ctx, value));
  }
  return FL_OK;
}

static fl_status fl_expect_number(fl_ctx *ctx, const char *name, fl_value value, const char *role,
                                  fl_error *error) {
  if (value.tag != FL_NUMBER) {
    return fl_fail(ctx, error, FL_CODE_BUILTIN_ARGS, "«%s»: %s должно быть числом, получено %s", name, role,
                   fl_type_name(ctx, value));
  }
  return FL_OK;
}

static fl_status fl_expect_integer(fl_ctx *ctx, const char *name, fl_value value, const char *role,
                                   fl_error *error) {
  char text[FL_NUMBER_TEXT_MAX];
  FL_TRY(fl_expect_number(ctx, name, value, role, error));
  /* Number.isInteger: конечное и без дробной части. */
  if (!isfinite(value.as.number) || floor(value.as.number) != value.as.number) {
    fl_number_text(value.as.number, text);
    return fl_fail(ctx, error, FL_CODE_BUILTIN_ARGS, "«%s»: %s должно быть целым числом, получено %s", name,
                   role, text);
  }
  return FL_OK;
}

static fl_status fl_expect_list(fl_ctx *ctx, const char *name, fl_value value, const char *role,
                                fl_error *error) {
  if (value.tag != FL_LIST) {
    return fl_fail(ctx, error, FL_CODE_BUILTIN_ARGS, "«%s»: %s должен быть списком, получено %s", name, role,
                   fl_type_name(ctx, value));
  }
  return FL_OK;
}

/* ═════════════════════════ встроенные формы ═════════════════════════ */

fl_status fl_b_dlina(fl_ctx *ctx, fl_value value, fl_value *out, fl_error *error) {
  if (value.tag == FL_STRING) {
    *out = fl_number((double)value.as.string.points);
    return FL_OK;
  }
  if (value.tag == FL_LIST) {
    *out = fl_number((double)value.as.list.count);
    return FL_OK;
  }
  return fl_fail(ctx, error, FL_CODE_BUILTIN_ARGS, "«длина»: ожидается строка или список, получено %s",
                 fl_type_name(ctx, value));
}

fl_status fl_b_simvol(fl_ctx *ctx, fl_value index, fl_value text, fl_value *out, fl_error *error) {
  double at = 0.0;
  size_t start = 0;
  size_t stop = 0;
  FL_TRY(fl_expect_integer(ctx, "символ", index, "индекс", error));
  FL_TRY(fl_expect_string(ctx, "символ", text, "строка", error));
  at = index.as.number - (double)FL_INDEX_BASE;
  if (at < 0.0 || at >= (double)text.as.string.points) {
    char number[FL_NUMBER_TEXT_MAX];
    fl_number_text(index.as.number, number);
    return fl_fail(ctx, error, FL_CODE_BUILTIN_ARGS, "«символ»: индекс %s вне строки длиной %lu", number,
                   (unsigned long)text.as.string.points);
  }
  start = fl_utf8_offset(text.as.string.utf8, text.as.string.bytes, (size_t)at);
  stop = fl_utf8_offset(text.as.string.utf8, text.as.string.bytes, (size_t)at + 1);
  *out = fl_text_borrow(text.as.string.utf8 + start, stop - start, 1);
  return FL_OK;
}

fl_status fl_b_podstroka(fl_ctx *ctx, fl_value text, fl_value from, fl_value to, fl_value *out,
                         fl_error *error) {
  double start = 0.0;
  double end = 0.0;
  size_t first = 0;
  size_t last = 0;
  FL_TRY(fl_expect_string(ctx, "подстрока", text, "строка", error));
  FL_TRY(fl_expect_integer(ctx, "подстрока", from, "начало", error));
  FL_TRY(fl_expect_integer(ctx, "подстрока", to, "конец", error));
  start = from.as.number - (double)FL_INDEX_BASE;
  end = to.as.number;
  if (start < 0.0 || start > (double)text.as.string.points) {
    char number[FL_NUMBER_TEXT_MAX];
    fl_number_text(from.as.number, number);
    return fl_fail(ctx, error, FL_CODE_BUILTIN_ARGS, "«подстрока»: начало %s вне строки длиной %lu", number,
                   (unsigned long)text.as.string.points);
  }
  if (end < start || end > (double)text.as.string.points) {
    char first_text[FL_NUMBER_TEXT_MAX];
    char last_text[FL_NUMBER_TEXT_MAX];
    fl_number_text(to.as.number, last_text);
    fl_number_text(from.as.number, first_text);
    return fl_fail(ctx, error, FL_CODE_BUILTIN_ARGS, "«подстрока»: конец %s вне диапазона [%s, %lu]",
                   last_text, first_text, (unsigned long)text.as.string.points);
  }
  first = fl_utf8_offset(text.as.string.utf8, text.as.string.bytes, (size_t)start);
  last = fl_utf8_offset(text.as.string.utf8, text.as.string.bytes, (size_t)end);
  *out = fl_text_borrow(text.as.string.utf8 + first, last - first, (size_t)(end - start));
  return FL_OK;
}

fl_status fl_b_soedinit(fl_ctx *ctx, fl_value left, fl_value right, fl_value *out, fl_error *error) {
  /* Две формы: «соединить строку с строкой» и «соединить список с
     разделителем». Различаем по типу первого аргумента — как builtins.mjs. */
  if (left.tag == FL_LIST) {
    size_t index = 0;
    size_t bytes = 0;
    size_t points = 0;
    char *data = NULL;
    size_t offset = 0;
    FL_TRY(fl_expect_string(ctx, "соединить", right, "разделитель", error));
    for (index = 0; index < left.as.list.count; index += 1) {
      const fl_value item = left.as.list.items[index];
      if (item.tag != FL_STRING) {
        return fl_fail(ctx, error, FL_CODE_BUILTIN_ARGS,
                       "«соединить»: элемент %lu списка должен быть строкой, получено %s",
                       (unsigned long)(index + 1), fl_type_name(ctx, item));
      }
      bytes += item.as.string.bytes;
      points += item.as.string.points;
    }
    if (left.as.list.count > 1) {
      bytes += right.as.string.bytes * (left.as.list.count - 1);
      points += right.as.string.points * (left.as.list.count - 1);
    }
    data = (char *)fl_arena_alloc(ctx->arena, bytes + 1);
    if (data == NULL) {
      return fl_no_memory(error);
    }
    for (index = 0; index < left.as.list.count; index += 1) {
      const fl_value item = left.as.list.items[index];
      if (index > 0 && right.as.string.bytes > 0) {
        memcpy(data + offset, right.as.string.utf8, right.as.string.bytes);
        offset += right.as.string.bytes;
      }
      if (item.as.string.bytes > 0) {
        memcpy(data + offset, item.as.string.utf8, item.as.string.bytes);
        offset += item.as.string.bytes;
      }
    }
    data[offset] = '\0';
    *out = fl_text_borrow(data, offset, points);
    return FL_OK;
  }
  FL_TRY(fl_expect_string(ctx, "соединить", left, "первая строка", error));
  FL_TRY(fl_expect_string(ctx, "соединить", right, "вторая строка", error));
  return fl_join_two(ctx, left, right, out, error);
}

/** Поиск подстроки по байтам: UTF-8 самосинхронизирующийся, ложных срабатываний нет. */
static const char *fl_find(const char *haystack, size_t haystack_bytes, const char *needle, size_t needle_bytes) {
  size_t index = 0;
  if (needle_bytes == 0) {
    return haystack;
  }
  if (needle_bytes > haystack_bytes) {
    return NULL;
  }
  for (index = 0; index + needle_bytes <= haystack_bytes; index += 1) {
    if (memcmp(haystack + index, needle, needle_bytes) == 0) {
      return haystack + index;
    }
  }
  return NULL;
}

fl_status fl_b_razdelit(fl_ctx *ctx, fl_value text, fl_value separator, fl_value *out, fl_error *error) {
  size_t count = 1;
  size_t index = 0;
  size_t start = 0;
  fl_value *items = NULL;
  FL_TRY(fl_expect_string(ctx, "разделить", text, "строка", error));
  FL_TRY(fl_expect_string(ctx, "разделить", separator, "разделитель", error));
  if (separator.as.string.bytes == 0) {
    return fl_fail(ctx, error, FL_CODE_BUILTIN_ARGS, "%s", "«разделить»: разделитель не может быть пустым");
  }

  for (index = 0; index + separator.as.string.bytes <= text.as.string.bytes;) {
    if (memcmp(text.as.string.utf8 + index, separator.as.string.utf8, separator.as.string.bytes) == 0) {
      count += 1;
      index += separator.as.string.bytes;
    } else {
      index += 1;
    }
  }

  FL_TRY(fl_list_alloc(ctx, count, &items, error));
  count = 0;
  start = 0;
  for (index = 0; index + separator.as.string.bytes <= text.as.string.bytes;) {
    if (memcmp(text.as.string.utf8 + index, separator.as.string.utf8, separator.as.string.bytes) == 0) {
      const char *piece = text.as.string.utf8 + start;
      const size_t bytes = index - start;
      items[count] = fl_text_borrow(piece, bytes, fl_utf8_points(piece, bytes));
      count += 1;
      index += separator.as.string.bytes;
      start = index;
    } else {
      index += 1;
    }
  }
  {
    const char *piece = text.as.string.utf8 + start;
    const size_t bytes = text.as.string.bytes - start;
    items[count] = fl_text_borrow(piece, bytes, fl_utf8_points(piece, bytes));
    count += 1;
  }
  *out = fl_list(items, count);
  return FL_OK;
}

fl_status fl_b_soderzhit(fl_ctx *ctx, fl_value left, fl_value right, fl_value *out, fl_error *error) {
  if (left.tag == FL_LIST) {
    size_t index = 0;
    for (index = 0; index < left.as.list.count; index += 1) {
      if (fl_equal(left.as.list.items[index], right)) {
        *out = fl_flag(true);
        return FL_OK;
      }
    }
    *out = fl_flag(false);
    return FL_OK;
  }
  FL_TRY(fl_expect_string(ctx, "содержит", left, "строка или список", error));
  FL_TRY(fl_expect_string(ctx, "содержит", right, "искомая подстрока", error));
  *out = fl_flag(fl_find(left.as.string.utf8, left.as.string.bytes, right.as.string.utf8,
                         right.as.string.bytes) != NULL);
  return FL_OK;
}

fl_status fl_b_nachinaetsya_s(fl_ctx *ctx, fl_value text, fl_value prefix, fl_value *out, fl_error *error) {
  FL_TRY(fl_expect_string(ctx, "начинается с", text, "строка", error));
  FL_TRY(fl_expect_string(ctx, "начинается с", prefix, "префикс", error));
  *out = fl_flag(prefix.as.string.bytes <= text.as.string.bytes &&
                 (prefix.as.string.bytes == 0 ||
                  memcmp(text.as.string.utf8, prefix.as.string.utf8, prefix.as.string.bytes) == 0));
  return FL_OK;
}

/*
 * «к числу» — строгий разбор. Регулярное выражение интерпретатора
 * /^[+-]?(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?$/u развёрнуто в проверку вручную:
 * тянуть regex.h ради одной строки нельзя (POSIX-регулярки не знают ни \d,
 * ни якорей в том же смысле), а «просто strtod» пропустил бы «0x10», «Infinity»
 * и «12abc» — то есть молча превратил бы мусор в значение.
 */
static bool fl_looks_like_number(const char *text, size_t bytes) {
  size_t index = 0;
  size_t digits = 0;
  if (bytes == 0) {
    return false;
  }
  if (text[0] == '+' || text[0] == '-') {
    index = 1;
  }
  while (index < bytes && text[index] >= '0' && text[index] <= '9') {
    index += 1;
    digits += 1;
  }
  if (index < bytes && text[index] == '.') {
    size_t fraction = 0;
    index += 1;
    while (index < bytes && text[index] >= '0' && text[index] <= '9') {
      index += 1;
      fraction += 1;
    }
    /* «1.» недопустимо: у целой части обязана быть дробная, если точка есть. */
    if (fraction == 0) {
      return false;
    }
    digits += fraction;
  }
  if (digits == 0) {
    return false;
  }
  if (index < bytes && (text[index] == 'e' || text[index] == 'E')) {
    size_t exponent = 0;
    index += 1;
    if (index < bytes && (text[index] == '+' || text[index] == '-')) {
      index += 1;
    }
    while (index < bytes && text[index] >= '0' && text[index] <= '9') {
      index += 1;
      exponent += 1;
    }
    if (exponent == 0) {
      return false;
    }
  }
  return index == bytes;
}

fl_status fl_b_k_chislu(fl_ctx *ctx, fl_value text, fl_value *out, fl_error *error) {
  size_t start = 0;
  size_t stop = 0;
  size_t width = 0;
  char *copy = NULL;
  double number = 0.0;
  FL_TRY(fl_expect_string(ctx, "к числу", text, "строка", error));

  stop = text.as.string.bytes;
  while (start < stop) {
    const unsigned long code = fl_utf8_decode(text.as.string.utf8, stop, start, &width);
    if (!fl_js_space(code)) {
      break;
    }
    start += width;
  }
  while (stop > start) {
    /* Отступаем на начало последней кодовой точки. */
    size_t back = stop - 1;
    while (back > start && ((unsigned char)text.as.string.utf8[back] & 0xC0u) == 0x80u) {
      back -= 1;
    }
    if (!fl_js_space(fl_utf8_decode(text.as.string.utf8, stop, back, &width))) {
      break;
    }
    stop = back;
  }

  if (!fl_looks_like_number(text.as.string.utf8 + start, stop - start)) {
    return fl_fail(ctx, error, FL_CODE_BUILTIN_ARGS, "«к числу»: строка %s не является числом",
                   fl_quoted(ctx, text));
  }
  copy = (char *)fl_arena_alloc(ctx->arena, (stop - start) + 1);
  if (copy == NULL) {
    return fl_no_memory(error);
  }
  memcpy(copy, text.as.string.utf8 + start, stop - start);
  copy[stop - start] = '\0';
  errno = 0;
  number = strtod(copy, NULL);
  if (!isfinite(number)) {
    return fl_fail(ctx, error, FL_CODE_BUILTIN_ARGS, "«к числу»: строка %s не является конечным числом",
                   fl_quoted(ctx, text));
  }
  *out = fl_number(number);
  return FL_OK;
}

fl_status fl_b_k_stroke(fl_ctx *ctx, fl_value value, fl_value *out, fl_error *error) {
  char text[FL_NUMBER_TEXT_MAX];
  switch (value.tag) {
    case FL_STRING:
      *out = value;
      return FL_OK;
    case FL_NUMBER:
      fl_number_text(value.as.number, text);
      return fl_text(ctx, text, strlen(text), out, error);
    case FL_FLAG:
      /* Признак печатается по-русски: поверхность языка знает «да» и «нет». */
      *out = fl_text_static(value.as.flag ? "да" : "нет");
      return FL_OK;
    case FL_NOTHING:
      *out = fl_text_static("ничто");
      return FL_OK;
    default:
      return fl_fail(ctx, error, FL_CODE_BUILTIN_ARGS, "«к строке»: ожидается скаляр, получено %s",
                     fl_type_name(ctx, value));
  }
}

fl_status fl_b_pusto(fl_ctx *ctx, fl_value value, fl_value *out, fl_error *error) {
  if (value.tag == FL_LIST) {
    *out = fl_flag(value.as.list.count == 0);
    return FL_OK;
  }
  if (value.tag == FL_STRING) {
    *out = fl_flag(value.as.string.points == 0);
    return FL_OK;
  }
  return fl_fail(ctx, error, FL_CODE_BUILTIN_ARGS, "«пусто»: ожидается строка или список, получено %s",
                 fl_type_name(ctx, value));
}

fl_status fl_b_golova(fl_ctx *ctx, fl_value value, fl_value *out, fl_error *error) {
  FL_TRY(fl_expect_list(ctx, "голова", value, "аргумент", error));
  if (value.as.list.count == 0) {
    return fl_fail(ctx, error, FL_CODE_BUILTIN_ARGS, "%s", "«голова»: список пуст");
  }
  *out = value.as.list.items[0];
  return FL_OK;
}

fl_status fl_b_hvost(fl_ctx *ctx, fl_value value, fl_value *out, fl_error *error) {
  FL_TRY(fl_expect_list(ctx, "хвост", value, "аргумент", error));
  if (value.as.list.count == 0) {
    return fl_fail(ctx, error, FL_CODE_BUILTIN_ARGS, "%s", "«хвост»: список пуст");
  }
  *out = fl_list_slice(value, 1);
  return FL_OK;
}

fl_status fl_b_dobavit(fl_ctx *ctx, fl_value item, fl_value list, fl_value *out, fl_error *error) {
  fl_value *items = NULL;
  FL_TRY(fl_expect_list(ctx, "добавить", list, "второй аргумент", error));
  FL_TRY(fl_list_alloc(ctx, list.as.list.count + 1, &items, error));
  if (list.as.list.count > 0) {
    memcpy(items, list.as.list.items, list.as.list.count * sizeof(fl_value));
  }
  items[list.as.list.count] = item;
  *out = fl_list(items, list.as.list.count + 1);
  return FL_OK;
}

fl_status fl_b_ostatok_ot(fl_ctx *ctx, fl_value left, fl_value right, fl_value *out, fl_error *error) {
  FL_TRY(fl_expect_number(ctx, "остаток от", left, "делимое", error));
  FL_TRY(fl_expect_number(ctx, "остаток от", right, "делитель", error));
  *out = fl_number(fmod(left.as.number, right.as.number));
  return FL_OK;
}

fl_status fl_b_procentov_ot(fl_ctx *ctx, fl_value left, fl_value right, fl_value *out, fl_error *error) {
  FL_TRY(fl_expect_number(ctx, "процентов от", left, "процент", error));
  FL_TRY(fl_expect_number(ctx, "процентов от", right, "значение", error));
  *out = fl_number((left.as.number / 100.0) * right.as.number);
  return FL_OK;
}

/* ═════════════════════════ батут ═════════════════════════ */

fl_status fl_trampoline(fl_ctx *ctx, fl_step step, const fl_value *args, size_t count, fl_value *result,
                        fl_error *error) {
  fl_bounce bounce;
  fl_value buffer[FL_MAX_TAIL_ARGS];
  size_t index = 0;
  for (index = 0; index < FL_MAX_TAIL_ARGS; index += 1) {
    buffer[index] = index < count ? args[index] : fl_nothing();
  }
  for (;;) {
    bounce.next = NULL;
    for (index = 0; index < FL_MAX_TAIL_ARGS; index += 1) {
      bounce.args[index] = fl_nothing();
    }
    FL_TRY(step(ctx, buffer, &bounce, result, error));
    if (bounce.next == NULL) {
      return FL_OK;
    }
    step = bounce.next;
    for (index = 0; index < FL_MAX_TAIL_ARGS; index += 1) {
      buffer[index] = bounce.args[index];
    }
  }
}
