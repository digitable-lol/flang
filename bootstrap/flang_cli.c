/*
 * Сгенерировано flang (бэкенд C, flang/src/emit/c.mjs). Не редактировать руками.
 * Модуль flang: «Компилятор flang».
 * Файл: прогонщик: JSON на входе, JSON на выходе.
 * Правьте исходник на flang и печатайте заново: любая правка здесь потеряется.
 */
#define FL_PROGRAM_CALL kompilyator_flang_call
#define FL_WITH_REPL 1

/*
 * Прогонщик программы flang: JSON на входе, JSON на выходе.
 *
 * Зачем он вообще есть. Сгенерированный модуль на C — это библиотека, и вызвать
 * её можно только из C. Но проверить кодогенератор нужно ровно одним способом —
 * сверкой с интерпретатором на сетке из тысяч входов, а перекомпилировать
 * программу ради каждой точки сетки невозможно. Поэтому бэкенд печатает ещё и
 * этот прогонщик: одна сборка, дальше поток запросов через трубу.
 *
 * Побочная польза больше основной: точно так же программу на flang вызывает
 * любой язык, у которого есть трубы, — Python, Node, shell. Ни FFI, ни ABI.
 *
 * ── Протокол ───────────────────────────────────────────────────────────────
 * Запрос — одна строка:  {"fn":"Имя функции","args":[…],"depth":"10000","steps":"1000000"}
 * Ответ  — одна строка:  {"ok":true,"value":…}
 *                    или {"ok":false,"code":"FLANG_TYPE","message":"…"}
 *
 * У программы с процессами есть второй запрос — прогон:
 *   {"run":"имя прогона","seed":"4172","turns":"10000","journal":"1"}
 *   {"ok":true,"run":"…","исход":"покой","время":"4","пробегов":"4",
 *    "состояния":[["Счётчик",…]],"живые":[…],"отказы":[…],"решения":[…],
 *    "журнал":[{"время":"0","процесс":"…","исход":"обработано","код":"","сообщение":…}]}
 * Семя обязательно в том смысле, что от него зависит ВСЁ чередование: при одном
 * и том же семени журнал доставок совпадает с эталоном побайтово, и это
 * проверяется, а не обещается.
 *
 * `journal` — наблюдение, и оно НЕОБЯЗАТЕЛЬНО. По умолчанию единица: прогон
 * ведёт журнал целиком, иначе сверять с эталоном было бы нечего. `"journal":"0"`
 * — рабочий режим: журнала нет ни в памяти, ни в ответе, и поля «журнал» в
 * ответе тоже нет (пустой список означал бы «пробегов не было»). Разница не в
 * удобстве вывода: запись журнала стоит памяти на КАЖДОМ пробеге, а арена
 * рантайма не возвращает ничего, поэтому долгоживущий процесс с журналом течёт
 * тем быстрее, чем дольше живёт. Наблюдаемое поведение от признака не зависит
 * ничем — те же исходы, состояния и решения надзора при том же семени.
 *
 * Значения размечены тегами, потому что JSON беднее flang:
 *   null            «ничто»
 *   true / false    признак
 *   {"n":"1.5"}     число — строкой, иначе потерялись бы NaN, Infinity и −0
 *                   (по той же причине строкой едут необязательные «depth»
 *                   и «steps»)
 *   {"s":"текст"}   строка
 *   {"l":[…]}       список
 *   {"r":[["поле",…]]}                 запись (порядок полей сохраняется)
 *   {"v":"Имя","f":[["поле",…]]}       вариант
 *
 * ── Память ─────────────────────────────────────────────────────────────────
 * На каждый запрос — один fl_arena_reset. Всё, что построил разбор запроса,
 * само вычисление и текст диагностики, освобождается одним движением, и объём
 * памяти не зависит от числа запросов. В конце — fl_arena_release: под
 * valgrind это ноль недостижимых байт.
 *
 * ── Второй вход: человеческие команды ──────────────────────────────────────
 * Когда этой программой оказывается сам компилятор flang, у бинарника есть и
 * человеческий вход: `--help`, `--version`, `check <файл>`, `repl`. Это тот же
 * прогонщик — те же вызовы функций по имени, — только запросы придумывает не
 * инструмент, а человек, и ответы печатаются словами, а не JSON. Живёт он в
 * СОСЕДНЕМ файле (flang_repl.c), и не для порядка: человеческому входу нужно
 * спрашивать у мира, где `cc`, где каталоги установки и что лежит в названном
 * файле, а этот файл обязан остаться переносимым C99, который ни от чего не
 * зависит и ничего не спрашивает. Здесь остаётся одна строка — передача
 * управления.
 *
 * Без аргументов программа ведёт себя ровно как прежде — читает JSON со
 * стандартного ввода. Тем же способом работает явное `--json`: оно нужно тому,
 * кто зовёт прогонщик из скрипта и хочет сказать это вслух, а не полагаться на
 * то, что аргументов случайно не оказалось.
 */
#include "flang_runtime.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/*
 * Единственная связь прогонщика с конкретной программой — вызов функции по
 * имени. Бэкенд печатает `#define FL_PROGRAM_CALL <префикс>_call` перед этим
 * файлом; запасное имя ниже нужно, чтобы файл компилировался и сам по себе.
 */
#ifndef FL_PROGRAM_CALL
#define FL_PROGRAM_CALL fl_program_call
#endif

extern fl_status FL_PROGRAM_CALL(fl_ctx *ctx, const char *name, const fl_value *args, size_t count,
                                 fl_value *result, fl_error *error);

/*
 * Человеческий вход — соседний файл печати (flang_repl.c), и печатается он по
 * просьбе, а не всегда: осмыслен он ровно у одной программы — у самого
 * компилятора flang, потому что только у него есть точки входа, которые он
 * зовёт. Просьба приезжает тем же способом, что и имя функции вызова, —
 * `#define` перед этим файлом.
 */
#ifdef FL_WITH_REPL
extern int fl_human_main(int argc, char **argv, const char *self);
#endif

/*
 * Второй запрос протокола — прогон конкурентной программы, и он есть только у
 * той программы, в которой объявлен хоть один `процесс`. Без него ключ «run»
 * остаётся неизвестным полем запроса, как и было: обещать прогон программе,
 * которой нечего прогонять, значило бы врать в протоколе.
 */
#ifdef FL_WITH_CONC
#include "flang_conc.h"

#ifndef FL_PROGRAM_CONC_PLAN
#define FL_PROGRAM_CONC_PLAN fl_program_conc_plan
#endif

extern const fl_conc_plan *FL_PROGRAM_CONC_PLAN(void);
#endif

/* ───────────────────────────── чтение входа ───────────────────────────── */

static char *read_all(FILE *stream, size_t *length) {
  size_t capacity = 65536;
  size_t used = 0;
  char *data = (char *)malloc(capacity);
  if (data == NULL) {
    return NULL;
  }
  for (;;) {
    const size_t got = fread(data + used, 1, capacity - used - 1, stream);
    used += got;
    if (used + 1 < capacity) {
      break;
    }
    {
      char *bigger = (char *)realloc(data, capacity * 2);
      if (bigger == NULL) {
        free(data);
        return NULL;
      }
      data = bigger;
      capacity *= 2;
    }
  }
  data[used] = '\0';
  *length = used;
  return data;
}

/* ───────────────────────────── разбор JSON ───────────────────────────── */

typedef struct fl_reader {
  const char *text;
  size_t bytes;
  size_t offset;
  fl_ctx *ctx;
} fl_reader;

static bool read_value(fl_reader *reader, fl_value *out);

static void skip_spaces(fl_reader *reader) {
  while (reader->offset < reader->bytes) {
    const char symbol = reader->text[reader->offset];
    if (symbol == ' ' || symbol == '\t' || symbol == '\r' || symbol == '\n') {
      reader->offset += 1;
    } else {
      break;
    }
  }
}

static bool expect(fl_reader *reader, char symbol) {
  skip_spaces(reader);
  if (reader->offset < reader->bytes && reader->text[reader->offset] == symbol) {
    reader->offset += 1;
    return true;
  }
  return false;
}

static bool peek(fl_reader *reader, char symbol) {
  skip_spaces(reader);
  return reader->offset < reader->bytes && reader->text[reader->offset] == symbol;
}

static bool read_literal(fl_reader *reader, const char *word) {
  const size_t length = strlen(word);
  skip_spaces(reader);
  if (reader->offset + length > reader->bytes || memcmp(reader->text + reader->offset, word, length) != 0) {
    return false;
  }
  reader->offset += length;
  return true;
}

static size_t encode_utf8(unsigned long code, char *target) {
  if (code < 0x80u) {
    target[0] = (char)code;
    return 1;
  }
  if (code < 0x800u) {
    target[0] = (char)(0xC0u | (code >> 6));
    target[1] = (char)(0x80u | (code & 0x3Fu));
    return 2;
  }
  if (code < 0x10000u) {
    target[0] = (char)(0xE0u | (code >> 12));
    target[1] = (char)(0x80u | ((code >> 6) & 0x3Fu));
    target[2] = (char)(0x80u | (code & 0x3Fu));
    return 3;
  }
  target[0] = (char)(0xF0u | (code >> 18));
  target[1] = (char)(0x80u | ((code >> 12) & 0x3Fu));
  target[2] = (char)(0x80u | ((code >> 6) & 0x3Fu));
  target[3] = (char)(0x80u | (code & 0x3Fu));
  return 4;
}

static unsigned long read_hex4(const char *text) {
  unsigned long code = 0;
  size_t index = 0;
  for (index = 0; index < 4; index += 1) {
    const char symbol = text[index];
    code <<= 4;
    if (symbol >= '0' && symbol <= '9') {
      code |= (unsigned long)(symbol - '0');
    } else if (symbol >= 'a' && symbol <= 'f') {
      code |= (unsigned long)(symbol - 'a' + 10);
    } else if (symbol >= 'A' && symbol <= 'F') {
      code |= (unsigned long)(symbol - 'A' + 10);
    } else {
      return 0xFFFFFFFFu;
    }
  }
  return code;
}

/* Строка JSON → UTF-8 в арене. Выход никогда не длиннее входа, поэтому размер
   известен заранее и растить нечего. */
static bool read_text(fl_reader *reader, char **out, size_t *bytes) {
  size_t start = 0;
  size_t used = 0;
  char *data = NULL;
  if (!expect(reader, '"')) {
    return false;
  }
  start = reader->offset;
  while (reader->offset < reader->bytes && reader->text[reader->offset] != '"') {
    reader->offset += reader->text[reader->offset] == '\\' ? 2 : 1;
  }
  if (reader->offset > reader->bytes) {
    return false;
  }
  data = (char *)fl_arena_alloc(reader->ctx->arena, (reader->offset - start) + 1);
  if (data == NULL) {
    return false;
  }
  {
    size_t index = start;
    while (index < reader->offset) {
      const char symbol = reader->text[index];
      if (symbol != '\\') {
        data[used] = symbol;
        used += 1;
        index += 1;
        continue;
      }
      index += 1;
      if (index >= reader->offset) {
        return false;
      }
      switch (reader->text[index]) {
        case 'n': data[used] = '\n'; used += 1; index += 1; break;
        case 't': data[used] = '\t'; used += 1; index += 1; break;
        case 'r': data[used] = '\r'; used += 1; index += 1; break;
        case 'b': data[used] = '\b'; used += 1; index += 1; break;
        case 'f': data[used] = '\f'; used += 1; index += 1; break;
        case '"': data[used] = '"'; used += 1; index += 1; break;
        case '\\': data[used] = '\\'; used += 1; index += 1; break;
        case '/': data[used] = '/'; used += 1; index += 1; break;
        case 'u': {
          unsigned long code = 0;
          if (index + 5 > reader->offset) {
            return false;
          }
          code = read_hex4(reader->text + index + 1);
          index += 5;
          if (code >= 0xD800u && code <= 0xDBFFu && index + 6 <= reader->offset &&
              reader->text[index] == '\\' && reader->text[index + 1] == 'u') {
            const unsigned long low = read_hex4(reader->text + index + 2);
            if (low >= 0xDC00u && low <= 0xDFFFu) {
              code = 0x10000u + ((code - 0xD800u) << 10) + (low - 0xDC00u);
              index += 6;
            }
          }
          used += encode_utf8(code, data + used);
          break;
        }
        default:
          return false;
      }
    }
  }
  data[used] = '\0';
  reader->offset += 1; /* закрывающая кавычка */
  *out = data;
  *bytes = used;
  return true;
}

static bool read_number_text(fl_reader *reader, double *out) {
  char *text = NULL;
  size_t bytes = 0;
  if (!read_text(reader, &text, &bytes)) {
    return false;
  }
  if (strcmp(text, "NaN") == 0) {
    *out = 0.0 / 0.0;
  } else if (strcmp(text, "Infinity") == 0) {
    *out = 1.0 / 0.0;
  } else if (strcmp(text, "-Infinity") == 0) {
    *out = -1.0 / 0.0;
  } else {
    *out = strtod(text, NULL);
  }
  return true;
}

static bool read_pairs(fl_reader *reader, const char ***names, fl_value **values, size_t *count) {
  size_t capacity = 8;
  size_t used = 0;
  const char **name_list = (const char **)fl_arena_alloc(reader->ctx->arena, capacity * sizeof(const char *));
  fl_value *value_list = (fl_value *)fl_arena_alloc(reader->ctx->arena, capacity * sizeof(fl_value));
  if (name_list == NULL || value_list == NULL) {
    return false;
  }
  if (!expect(reader, '[')) {
    return false;
  }
  if (peek(reader, ']')) {
    reader->offset += 1;
    *names = name_list;
    *values = value_list;
    *count = 0;
    return true;
  }
  for (;;) {
    char *name = NULL;
    size_t bytes = 0;
    if (used == capacity) {
      const char **bigger_names = (const char **)fl_arena_alloc(reader->ctx->arena, capacity * 2 * sizeof(const char *));
      fl_value *bigger_values = (fl_value *)fl_arena_alloc(reader->ctx->arena, capacity * 2 * sizeof(fl_value));
      if (bigger_names == NULL || bigger_values == NULL) {
        return false;
      }
      memcpy(bigger_names, name_list, used * sizeof(const char *));
      memcpy(bigger_values, value_list, used * sizeof(fl_value));
      name_list = bigger_names;
      value_list = bigger_values;
      capacity *= 2;
    }
    if (!expect(reader, '[') || !read_text(reader, &name, &bytes) || !expect(reader, ',')) {
      return false;
    }
    if (!read_value(reader, &value_list[used]) || !expect(reader, ']')) {
      return false;
    }
    name_list[used] = name;
    used += 1;
    if (expect(reader, ',')) {
      continue;
    }
    break;
  }
  if (!expect(reader, ']')) {
    return false;
  }
  *names = name_list;
  *values = value_list;
  *count = used;
  return true;
}

static bool read_items(fl_reader *reader, fl_value *out) {
  size_t capacity = 8;
  size_t used = 0;
  fl_value *items = (fl_value *)fl_arena_alloc(reader->ctx->arena, capacity * sizeof(fl_value));
  if (items == NULL) {
    return false;
  }
  if (!expect(reader, '[')) {
    return false;
  }
  if (peek(reader, ']')) {
    reader->offset += 1;
    *out = fl_list(items, 0);
    return true;
  }
  for (;;) {
    if (used == capacity) {
      fl_value *bigger = (fl_value *)fl_arena_alloc(reader->ctx->arena, capacity * 2 * sizeof(fl_value));
      if (bigger == NULL) {
        return false;
      }
      memcpy(bigger, items, used * sizeof(fl_value));
      items = bigger;
      capacity *= 2;
    }
    if (!read_value(reader, &items[used])) {
      return false;
    }
    used += 1;
    if (expect(reader, ',')) {
      continue;
    }
    break;
  }
  if (!expect(reader, ']')) {
    return false;
  }
  *out = fl_list(items, used);
  return true;
}

static bool read_value(fl_reader *reader, fl_value *out) {
  skip_spaces(reader);
  if (read_literal(reader, "null")) {
    *out = fl_nothing();
    return true;
  }
  if (read_literal(reader, "true")) {
    *out = fl_flag(true);
    return true;
  }
  if (read_literal(reader, "false")) {
    *out = fl_flag(false);
    return true;
  }
  if (!expect(reader, '{')) {
    return false;
  }
  {
    char *tag = NULL;
    size_t bytes = 0;
    if (!read_text(reader, &tag, &bytes) || !expect(reader, ':')) {
      return false;
    }
    if (strcmp(tag, "n") == 0) {
      double number = 0.0;
      if (!read_number_text(reader, &number)) {
        return false;
      }
      *out = fl_number(number);
      return expect(reader, '}');
    }
    if (strcmp(tag, "s") == 0) {
      char *text = NULL;
      size_t length = 0;
      if (!read_text(reader, &text, &length)) {
        return false;
      }
      /* Разбор уже положил текст в арену — копировать второй раз незачем. */
      if (fl_text(reader->ctx, text, length, out, NULL) != FL_OK) {
        return false;
      }
      return expect(reader, '}');
    }
    if (strcmp(tag, "l") == 0) {
      if (!read_items(reader, out)) {
        return false;
      }
      return expect(reader, '}');
    }
    if (strcmp(tag, "r") == 0) {
      const char **names = NULL;
      fl_value *values = NULL;
      size_t count = 0;
      if (!read_pairs(reader, &names, &values, &count)) {
        return false;
      }
      if (fl_record_new(reader->ctx, names, values, count, out, NULL) != FL_OK) {
        return false;
      }
      return expect(reader, '}');
    }
    if (strcmp(tag, "v") == 0) {
      char *name = NULL;
      size_t length = 0;
      const char **names = NULL;
      fl_value *values = NULL;
      size_t count = 0;
      if (!read_text(reader, &name, &length)) {
        return false;
      }
      if (expect(reader, ',')) {
        char *key = NULL;
        size_t key_bytes = 0;
        if (!read_text(reader, &key, &key_bytes) || strcmp(key, "f") != 0 || !expect(reader, ':')) {
          return false;
        }
        if (!read_pairs(reader, &names, &values, &count)) {
          return false;
        }
      }
      if (fl_variant_new(reader->ctx, name, names, values, count, out, NULL) != FL_OK) {
        return false;
      }
      return expect(reader, '}');
    }
    return false;
  }
}

/* ───────────────────────────── печать JSON ───────────────────────────── */

static void write_text(const char *utf8, size_t bytes) {
  size_t index = 0;
  putchar('"');
  for (index = 0; index < bytes; index += 1) {
    const unsigned char symbol = (unsigned char)utf8[index];
    switch (symbol) {
      case '"': fputs("\\\"", stdout); break;
      case '\\': fputs("\\\\", stdout); break;
      case '\n': fputs("\\n", stdout); break;
      case '\r': fputs("\\r", stdout); break;
      case '\t': fputs("\\t", stdout); break;
      case '\b': fputs("\\b", stdout); break;
      case '\f': fputs("\\f", stdout); break;
      default:
        if (symbol < 0x20u) {
          printf("\\u%04x", (unsigned)symbol);
        } else {
          putchar((char)symbol);
        }
    }
  }
  putchar('"');
}

static void write_value(fl_value value) {
  size_t index = 0;
  char number[FL_NUMBER_TEXT_MAX];
  switch (value.tag) {
    case FL_NOTHING:
      fputs("null", stdout);
      return;
    case FL_FLAG:
      fputs(value.as.flag ? "true" : "false", stdout);
      return;
    case FL_NUMBER:
      /* −0 обязан доехать до сверки со знаком: Object.is(0, −0) ложно. */
      fl_number_text(value.as.number, number);
      fputs("{\"n\":", stdout);
      if (value.as.number == 0.0 && !(1.0 / value.as.number > 0.0)) {
        write_text("-0", 2);
      } else {
        write_text(number, strlen(number));
      }
      putchar('}');
      return;
    case FL_STRING:
      fputs("{\"s\":", stdout);
      write_text(value.as.string.utf8, value.as.string.bytes);
      putchar('}');
      return;
    case FL_LIST:
      fputs("{\"l\":[", stdout);
      for (index = 0; index < value.as.list.count; index += 1) {
        if (index > 0) {
          putchar(',');
        }
        write_value(value.as.list.items[index]);
      }
      fputs("]}", stdout);
      return;
    case FL_RECORD:
      fputs("{\"r\":[", stdout);
      for (index = 0; index < value.as.record->count; index += 1) {
        if (index > 0) {
          putchar(',');
        }
        putchar('[');
        write_text(value.as.record->fields[index].name, strlen(value.as.record->fields[index].name));
        putchar(',');
        write_value(value.as.record->fields[index].value);
        putchar(']');
      }
      fputs("]}", stdout);
      return;
    case FL_VARIANT:
      fputs("{\"v\":", stdout);
      write_text(value.as.variant->name, strlen(value.as.variant->name));
      fputs(",\"f\":[", stdout);
      for (index = 0; index < value.as.variant->count; index += 1) {
        if (index > 0) {
          putchar(',');
        }
        putchar('[');
        write_text(value.as.variant->fields[index].name, strlen(value.as.variant->fields[index].name));
        putchar(',');
        write_value(value.as.variant->fields[index].value);
        putchar(']');
      }
      fputs("]}", stdout);
      return;
  }
  fputs("null", stdout);
}

/* ───────────────────────────── прогон конкурентной программы ─────────────────────────────
   Ответ отличается от ответа на вызов функции не украшением, а существом: у
   конкурентной программы нет одного значения, есть исход, состояния всех
   процессов и ЖУРНАЛ ДОСТАВОК — то самое чередование, которое обязано совпасть
   с эталоном побайтово при том же семени (контракт, «Что проверяется и чем»,
   пункт 2). Ради этого журнал и печатается целиком, а не сводкой. */

#ifdef FL_WITH_CONC
/* Число едет строкой по той же причине, что и в «n»: иначе потерялись бы NaN,
   бесконечности и −0, а виртуальное время — обычное число flang. */
static void write_number_text(double value) {
  char number[FL_NUMBER_TEXT_MAX];
  fl_number_text(value, number);
  write_text(number, strlen(number));
}

static void write_name(const char *text) {
  write_text(text == NULL ? "" : text, strlen(text == NULL ? "" : text));
}

static void write_run(const fl_conc_plan *plan, const char *name, const fl_conc_result *result) {
  size_t index = 0;
  bool first = true;
  fputs("{\"ok\":true,\"run\":", stdout);
  write_name(name);
  fputs(",\"исход\":", stdout);
  write_name(result->outcome);
  fputs(",\"время\":", stdout);
  write_number_text(result->time);
  fputs(",\"пробегов\":", stdout);
  write_number_text((double)result->turns);

  /* Состояния — в порядке объявления процессов, том же, что у эталона. */
  fputs(",\"состояния\":[", stdout);
  for (index = 0; index < plan->process_count; index += 1) {
    if (index > 0) {
      putchar(',');
    }
    putchar('[');
    write_name(plan->processes[index].name);
    putchar(',');
    write_value(result->states[index]);
    putchar(']');
  }

  fputs("],\"живые\":[", stdout);
  for (index = 0; index < plan->process_count; index += 1) {
    if (!result->alive[index]) {
      continue;
    }
    if (!first) {
      putchar(',');
    }
    first = false;
    write_name(plan->processes[index].name);
  }

  fputs("],\"отказы\":[", stdout);
  for (index = 0; index < result->failure_count; index += 1) {
    if (index > 0) {
      putchar(',');
    }
    putchar('[');
    write_name(plan->processes[result->failures[index].process].name);
    putchar(',');
    write_name(result->failures[index].code);
    putchar(']');
  }

  fputs("],\"решения\":[", stdout);
  for (index = 0; index < result->decision_count; index += 1) {
    if (index > 0) {
      putchar(',');
    }
    putchar('[');
    write_name(plan->processes[result->decisions[index].process].name);
    putchar(',');
    write_name(result->decisions[index].supervisor);
    putchar(',');
    write_name(result->decisions[index].strategy);
    putchar(']');
  }

  /* Журнала может не быть вовсе — тогда поля нет, а не пустой список. Пустой
     список означал бы «пробегов не было», и читатель, сверяющий журнал с
     эталоном, сравнил бы пустоту с пустотой и промолчал. Отсутствие поля он
     заметит сразу. */
  putchar(']');
  if (result->journal_kept) {
    fputs(",\"журнал\":[", stdout);
    for (index = 0; index < result->journal_count; index += 1) {
      const fl_conc_entry *entry = &result->journal[index];
      if (index > 0) {
        putchar(',');
      }
      fputs("{\"время\":", stdout);
      write_number_text(entry->time);
      fputs(",\"процесс\":", stdout);
      write_name(plan->processes[entry->process].name);
      fputs(",\"исход\":", stdout);
      write_name(entry->outcome);
      fputs(",\"код\":", stdout);
      write_name(entry->code);
      fputs(",\"сообщение\":", stdout);
      write_value(entry->message);
      putchar('}');
    }
    putchar(']');
  }
  fputs("}\n", stdout);
}
#endif

/* ───────────────────────────── запрос ───────────────────────────── */

static void run_request(fl_arena *arena, const char *line, size_t bytes) {
  fl_ctx ctx;
  fl_reader reader;
  fl_error error;
  fl_value result = fl_nothing();
  fl_value args[FL_MAX_ARGS];
  char *name = NULL;
  size_t name_bytes = 0;
  size_t count = 0;
  fl_status status = FL_OK;
#ifdef FL_WITH_CONC
  char *run = NULL;
  double seed = 0.0;
  double turns = 0.0;
  /* Журнал по умолчанию ВЕДЁТСЯ: прогон — основной способ звать эту программу, и
     по журналу он сверяется с эталоном. Выключает его тот, кто знает, что зовёт
     не прогон, а работу, — и знает, что платит за наблюдение памятью на каждом
     пробеге. Умолчание наоборот сломало бы сверку молча. */
  double journal = 1.0;
#endif

  fl_arena_reset(arena);
  fl_ctx_init(&ctx, arena);
  error.code = NULL;
  error.message = NULL;

  reader.text = line;
  reader.bytes = bytes;
  reader.offset = 0;
  reader.ctx = &ctx;

  if (!expect(&reader, '{')) {
    fputs("{\"ok\":false,\"code\":\"CLI\",\"message\":\"ожидался объект запроса\"}\n", stdout);
    return;
  }
  for (;;) {
    char *key = NULL;
    size_t key_bytes = 0;
    if (!read_text(&reader, &key, &key_bytes) || !expect(&reader, ':')) {
      fputs("{\"ok\":false,\"code\":\"CLI\",\"message\":\"неразборчивый запрос\"}\n", stdout);
      return;
    }
    if (strcmp(key, "fn") == 0) {
      if (!read_text(&reader, &name, &name_bytes)) {
        fputs("{\"ok\":false,\"code\":\"CLI\",\"message\":\"неразборчивое имя функции\"}\n", stdout);
        return;
      }
    } else if (strcmp(key, "depth") == 0) {
      double depth = 0.0;
      if (!read_number_text(&reader, &depth)) {
        fputs("{\"ok\":false,\"code\":\"CLI\",\"message\":\"неразборчивый предел глубины\"}\n", stdout);
        return;
      }
      ctx.max_depth = (size_t)depth;
    } else if (strcmp(key, "steps") == 0) {
      double steps = 0.0;
      if (!read_number_text(&reader, &steps)) {
        fputs("{\"ok\":false,\"code\":\"CLI\",\"message\":\"неразборчивый предел шагов\"}\n", stdout);
        return;
      }
      ctx.max_steps = (size_t)steps;
#ifdef FL_WITH_CONC
    } else if (strcmp(key, "run") == 0) {
      size_t run_bytes = 0;
      if (!read_text(&reader, &run, &run_bytes)) {
        fputs("{\"ok\":false,\"code\":\"CLI\",\"message\":\"неразборчивое имя прогона\"}\n", stdout);
        return;
      }
    } else if (strcmp(key, "seed") == 0) {
      if (!read_number_text(&reader, &seed)) {
        fputs("{\"ok\":false,\"code\":\"CLI\",\"message\":\"неразборчивое семя\"}\n", stdout);
        return;
      }
    } else if (strcmp(key, "turns") == 0) {
      if (!read_number_text(&reader, &turns)) {
        fputs("{\"ok\":false,\"code\":\"CLI\",\"message\":\"неразборчивый предел пробегов\"}\n", stdout);
        return;
      }
    } else if (strcmp(key, "journal") == 0) {
      if (!read_number_text(&reader, &journal)) {
        fputs("{\"ok\":false,\"code\":\"CLI\",\"message\":\"неразборчивый признак журнала\"}\n", stdout);
        return;
      }
#endif
    } else if (strcmp(key, "args") == 0) {
      fl_value list = fl_nothing();
      if (!read_items(&reader, &list) || list.as.list.count > FL_MAX_ARGS) {
        fputs("{\"ok\":false,\"code\":\"CLI\",\"message\":\"неразборчивые аргументы\"}\n", stdout);
        return;
      }
      count = list.as.list.count;
      for (name_bytes = 0; name_bytes < count; name_bytes += 1) {
        args[name_bytes] = list.as.list.items[name_bytes];
      }
    } else {
      fputs("{\"ok\":false,\"code\":\"CLI\",\"message\":\"неизвестное поле запроса\"}\n", stdout);
      return;
    }
    if (expect(&reader, ',')) {
      continue;
    }
    break;
  }
#ifdef FL_WITH_CONC
  if (run != NULL) {
    const fl_conc_plan *plan = FL_PROGRAM_CONC_PLAN();
    fl_conc_result outcome;
    if (fl_conc_run(&ctx, plan, run, seed, (size_t)turns, journal != 0.0, &outcome, &error) == FL_OK) {
      write_run(plan, run, &outcome);
      return;
    }
    fputs("{\"ok\":false,\"code\":", stdout);
    write_name(error.code == NULL ? "FLANG_UNKNOWN" : error.code);
    fputs(",\"message\":", stdout);
    write_name(error.message);
    fputs("}\n", stdout);
    return;
  }
#endif

  if (name == NULL) {
    fputs("{\"ok\":false,\"code\":\"CLI\",\"message\":\"в запросе нет имени функции\"}\n", stdout);
    return;
  }

  status = FL_PROGRAM_CALL(&ctx, name, args, count, &result, &error);
  if (status == FL_OK) {
    fputs("{\"ok\":true,\"value\":", stdout);
    write_value(result);
    fputs("}\n", stdout);
    return;
  }
  fputs("{\"ok\":false,\"code\":", stdout);
  write_text(error.code == NULL ? "FLANG_UNKNOWN" : error.code, strlen(error.code == NULL ? "FLANG_UNKNOWN" : error.code));
  fputs(",\"message\":", stdout);
  write_text(error.message == NULL ? "" : error.message, strlen(error.message == NULL ? "" : error.message));
  fputs("}\n", stdout);
}

int main(int argc, char **argv) {
  fl_arena arena;
  size_t length = 0;
  size_t start = 0;
  size_t index = 0;
  char *input = NULL;
#ifdef FL_WITH_REPL
  /*
   * Любой аргумент — человеческий вход; без аргументов всё как было, JSON со
   * стандартного ввода. Разбор здесь нарочно в одну строку: у прогонщика ключей
   * нет и не должно быть, иначе его протокол перестал бы быть протоколом, — а
   * что означают слова, решает соседний файл, где эти слова и живут.
   *
   * `--json` пропускается сюда, а не в человеческий вход: это единственный
   * способ сказать «мне нужен прогонщик» вслух. Он же оставляет прежним
   * контракт для всех, кто уже зовёт бинарник трубой, — тест формулы Homebrew,
   * пробу плагина asdf, `scripts/build-release-c.mjs`.
   */
  if (argc > 1 && strcmp(argv[1], "--json") != 0) {
    return fl_human_main(argc, argv, argv[0]);
  }
#else
  (void)argc;
  (void)argv;
#endif
  input = read_all(stdin, &length);
  if (input == NULL) {
    fputs("{\"ok\":false,\"code\":\"CLI\",\"message\":\"не прочитан вход\"}\n", stdout);
    return 1;
  }
  fl_arena_init(&arena);
  for (index = 0; index <= length; index += 1) {
    if (index == length || input[index] == '\n') {
      if (index > start) {
        run_request(&arena, input + start, index - start);
        fflush(stdout);
      }
      start = index + 1;
    }
  }
  fl_arena_release(&arena);
  free(input);
  return 0;
}
