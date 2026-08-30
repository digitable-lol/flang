/*
 * Сгенерировано flang (бэкенд C, flang/src/emit/c.mjs). Не редактировать руками.
 * Модуль flang: «Compiler flang».
 * Файл: прогонщик: JSON на входе, JSON на выходе.
 * Правьте исходник на flang и печатайте заново: любая правка здесь потеряется.
 */
#define FL_PROGRAM_CALL compiler_flang_call
#define FL_PROGRAM_ENTRY compiler_flang_entry
#define FL_WITH_REPL 1

/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
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
 *   {"run":"имя прогона","workers":"8"}   рабочий режим: восемь потоков, и семя
 *                   чередования больше НЕ определяет (см. flang_conc.h)
 *   {"ok":true,"run":"…","исход":"покой","время":"4","пробегов":"4",
 *    "состояния":[["Счётчик",…]],"живые":[…],"отказы":[…],"решения":[…],
 *    "журнал":[{"время":"0","процесс":"…","исход":"обработано","код":"","сообщение":…}]}
 * Семя обязательно в том смысле, что от него зависит ВСЁ чередование: при одном
 * и том же семени журнал доставок совпадает со свидетелем побайтово, и это
 * проверяется, а не обещается.
 *
 * `journal` — наблюдение, и оно НЕОБЯЗАТЕЛЬНО. По умолчанию единица: прогон
 * ведёт журнал целиком, иначе сверять со свидетелем было бы нечего. `"journal":"0"`
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
 * Обещание «переносимый C99» это правило и держит: единственное, чего этому
 * файлу не хватает в C99, — стек под объявленный предел глубины, и просит он
 * его не сам, а `fl_call_deep` из рантайма, где платформенная часть и обнесена
 * проверкой платформы. Здесь по-прежнему ни одного `#include`, которого нет в
 * стандарте (см. хвост файла).
 *
 * Без аргументов программа читает JSON со стандартного ввода — если на том
 * конце не человек. Стоит на входе терминал, и у бинарника есть человеческий
 * вход, — голая команда открывает оболочку, как `iex` и как `python`; решает
 * это `fl_human_bare` из соседнего файла, потому что `isatty` здесь не наш.
 * Конвейеру ничего не меняется, и это контракт, а не мелочь: им живут тест
 * формулы Homebrew, проба плагина asdf и `scripts/build-release-c.mjs`. Явное
 * `--json` нужно тому, кто зовёт прогонщик из скрипта и хочет сказать это
 * вслух, а не полагаться на то, что аргументов случайно не оказалось.
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
 * Вторая связь с программой — её ГРАНИЦА ВХОДА: объявленные типы параметров,
 * напечатанные данными (`<префикс>_entry`). Прогонщик сверяет по ним значения
 * из JSON ДО вызова.
 *
 * Почему это здесь, а не внутри функций. Значения приходят СНАРУЖИ, а типов в
 * напечатанном коде нет вовсе — и `«Факториал» принимает н: неотрицательное` спокойно
 * считался при `н` равном −3 и 2.5. Хуже того, при 1e300 он упирался в
 * FLANG_RECURSION_LIMIT: доказательство завершения `тотальной` стоит НА ТИПЕ (у
 * `неотрицательное` есть потолок 2^53−1, ниже которого `н минус 1` точно меньше `н`), и
 * сторож убывания в такую функцию не печатается вовсе. Значение вне типа
 * выносит вместе с типом и доказательство — цепочка вечна, ловить её нечем.
 * Поэтому дверь стоит ДО вычисления и ровно одна.
 */
#ifndef FL_PROGRAM_ENTRY
#define FL_PROGRAM_ENTRY fl_program_entry
#endif

extern const fl_entry_table *FL_PROGRAM_ENTRY(void);

/*
 * Человеческий вход — соседний файл печати (flang_repl.c), и печатается он по
 * просьбе, а не всегда: осмыслен он ровно у одной программы — у самого
 * компилятора flang, потому что только у него есть точки входа, которые он
 * зовёт. Просьба приезжает тем же способом, что и имя функции вызова, —
 * `#define` перед этим файлом.
 */
#ifdef FL_WITH_REPL
extern int fl_human_main(int argc, char **argv, const char *self);
/*
 * Голая команда: человеку — оболочка, конвейеру — прогонщик. Спрашивать «есть
 * ли человек на том конце» этот файл не имеет права сам (обещание переносимого
 * C99 без единого нестандартного #include), поэтому спрашивает соседний, где
 * платформенная часть и живёт.
 */
extern int fl_human_bare(void);
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

/*
 * ── СТРОКА, КОТОРАЯ НЕ ТЕКСТ ───────────────────────────────────────────────
 *
 * Запрос протокола — строка, а строка в этом языке UTF-8 (SPEC, раздел 5).
 * До 22 августа 2026 негодный октет проходил сквозь восемь прогонщиков ПЯТЬЮ
 * разными способами, и отказом не был ни один (замер снят прогоном, таблица —
 * в scripts/bad-octet-guard.sh):
 *
 *   C           возил октеты как есть и отвечал FLANG_UNKNOWN_NAME на мусор;
 *   Go, Java,
 *   C#, JS      подменяли октет знаком замены U+FFFD и отвечали тем же
 *               FLANG_UNKNOWN_NAME — то есть врали о содержимом запроса;
 *   Elixir      звал это «неразборчивым запросом», сваливая не-текст на JSON;
 *   Rust        МОЛЧА обрывал цикл и выходил кодом 0 — худший из восьми:
 *               зелёный код при несделанной работе;
 *   Python      падал трассировкой UnicodeDecodeError, а при локали C и
 *               C.UTF-8 протаскивал октет суррогатом и отвечал кодом 0.
 *
 * Образец поведения у языка уже был — `FLANG_IO_NOT_TEXT` у текстовой пары
 * ввода-вывода: номер октета, его значение и чем возить октеты. Прогонщик
 * отвечает ТАК ЖЕ, и у семи целей из восьми — байт в байт одинаково:
 * диагностика в поток ошибок, код возврата 1, разбора нет. Строки ДО негодной
 * уже отвечены и остаются отвеченными — отменять сделанное отказ не обязан.
 * Восьмая, JS, названа долгом вслух: её прогонщик — рукописный JavaScript,
 * править который в этом дереве запрещено.
 *
 * Почему в поток ошибок, а не ответом протокола. Ответ протокола обещан один
 * на запрос, а строка, которая не текст, запросом не является: ответить на неё
 * `{"ok":false}` значило бы разобрать неразобранное. Ровно этим и был прежний
 * FLANG_UNKNOWN_NAME на мусоре.
 */

/* Отказ «строка не текст»: номер строки, номер октета в ней (с единицы), длина
   строки в октетах и значение негодного октета. Текст один на семь целей —
   сторож сверяет его байт в байт. */
static void cli_not_text(size_t line, const char *bytes, size_t length, size_t at) {
  fprintf(stderr,
          "FLANG_IO_NOT_TEXT: строка %lu не текст: октет %lu из %lu (0x%02X) не складывается в UTF-8; запрос обязан ехать в UTF-8\n",
          (unsigned long)line, (unsigned long)at, (unsigned long)length,
          (unsigned)(unsigned char)bytes[at - 1]);
}

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
   со свидетелем побайтово при том же семени (контракт, «Что проверяется и чем»,
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

/**
 * Предел из запроса в `size_t`, и почему это отдельная функция.
 *
 * `(size_t)x` для отрицательного, бесконечного или нечислового `x` — поведение
 * НЕОПРЕДЕЛЁННОЕ, и на обычной машине даёт огромное число. Для `turns` это
 * значило бы «крутись почти вечно», для `processes` — хуже: предел числа
 * процессов и есть тотальность слоя, и снятый мусором из запроса он перестаёт
 * быть пределом. Поэтому такой запрос ОТВЕРГАЕТСЯ, а не округляется молча.
 *
 * Ноль и всё, что больше разрядной сетки, законны: ноль означает умолчание
 * планировщика, а слишком большое упирается в память задолго до предела.
 */
static bool limit_from_number(double value, size_t *out) {
  if (value != value || value < 0.0) {
    return false;
  }
  if (value >= 18446744073709551616.0) {
    *out = (size_t)-1;
    return true;
  }
  *out = (size_t)value;
  return true;
}

static void write_run(const char *name, const fl_conc_result *result) {
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
  /* Поле появляется РОВНО ТОГДА, когда прогон шёл больше чем одним потоком.
     Печатать его всегда значило бы засорить вывод проверочного режима, по
     которому идёт побайтовая сверка; не печатать никогда значило бы разменять
     воспроизводимость молча. */
  if (result->workers > 1) {
    fputs(",\"рабочих\":", stdout);
    write_number_text((double)result->workers);
  }

  /* Состояния — в порядке объявления процессов, том же, что у свидетеля; за
     объявленными идут порождённые, в порядке рождения. Имена берутся из ИТОГА,
     а не из плана: у прогона с `породить` процессов больше, чем в плане. */
  fputs(",\"состояния\":[", stdout);
  for (index = 0; index < result->process_count; index += 1) {
    if (index > 0) {
      putchar(',');
    }
    putchar('[');
    write_name(result->names[index]);
    putchar(',');
    write_value(result->states[index]);
    putchar(']');
  }

  fputs("],\"живые\":[", stdout);
  for (index = 0; index < result->process_count; index += 1) {
    if (!result->alive[index]) {
      continue;
    }
    if (!first) {
      putchar(',');
    }
    first = false;
    write_name(result->names[index]);
  }

  fputs("],\"отказы\":[", stdout);
  for (index = 0; index < result->failure_count; index += 1) {
    if (index > 0) {
      putchar(',');
    }
    putchar('[');
    write_name(result->names[result->failures[index].process]);
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
    write_name(result->names[result->decisions[index].process]);
    putchar(',');
    write_name(result->decisions[index].supervisor);
    putchar(',');
    write_name(result->decisions[index].strategy);
    putchar(']');
  }

  /* Журнала может не быть вовсе — тогда поля нет, а не пустой список. Пустой
     список означал бы «пробегов не было», и читатель, сверяющий журнал с
     свидетелем, сравнил бы пустоту с пустотой и промолчал. Отсутствие поля он
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
      write_name(result->names[entry->process]);
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
  /* Сколько процессов прогону позволено завести всего, объявленных плюс
     порождённых (`породить`, шаг Б1). Ноль — умолчание планировщика, ровно как
     у `turns`: это настройка запроса, а не потолок модели. */
  double processes = 0.0;
  /* Сколько потоков ведут прогон. Ноль и единица — проверочный режим: один
     поток, чередование по семени, побайтовая сверка со свидетелем. Больше единицы —
     рабочий: столько потоков ОС, и семя больше НЕ ОПРЕДЕЛЯЕТ чередования.
     Умолчание — проверочный, и это не осторожность: воспроизводимость здесь
     часть договора языка, и терять её молча, «потому что машина многоядерная»,
     нельзя. Кто хочет ядер, говорит об этом вслух — и получает в ответе поле
     «рабочих», чтобы не спутать один режим с другим.

     Слово «все» просит столько потоков, сколько у машины ядер: «параллельно,
     сколько даёт среда» из контракта — это число, а не оборот речи. */
  double workers = 0.0;
  /* Журнал по умолчанию ВЕДЁТСЯ: прогон — основной способ звать эту программу, и
     по журналу он сверяется со свидетелем. Выключает его тот, кто знает, что зовёт
     не прогон, а работу, — и знает, что платит за наблюдение памятью на каждом
     пробеге. Умолчание наоборот сломало бы сверку молча. */
  double journal = 1.0;
  /* Хозяин ввода-вывода (седьмое действие, `поручить`). По умолчанию ВЫКЛЮЧЕН, и
     это не осторожность: прогон — свидетель, с которым побайтово сверяется журнал
     `flang/src/conc.mjs`, а хозяин, читающий настоящие файлы, сделал бы журнал
     зависящим от содержимого диска. Просит его тот, кто зовёт программу
     РАБОТАТЬ, а не проверяться, — и просит вслух, полем `"host": 1`. */
  double host = 0.0;
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
    } else if (strcmp(key, "processes") == 0) {
      if (!read_number_text(&reader, &processes)) {
        fputs("{\"ok\":false,\"code\":\"CLI\",\"message\":\"неразборчивый предел числа процессов\"}\n", stdout);
        return;
      }
    } else if (strcmp(key, "workers") == 0) {
      if (!read_number_text(&reader, &workers)) {
        fputs("{\"ok\":false,\"code\":\"CLI\",\"message\":\"неразборчивое число потоков\"}\n", stdout);
        return;
      }
    } else if (strcmp(key, "journal") == 0) {
      if (!read_number_text(&reader, &journal)) {
        fputs("{\"ok\":false,\"code\":\"CLI\",\"message\":\"неразборчивый признак журнала\"}\n", stdout);
        return;
      }
    } else if (strcmp(key, "host") == 0) {
      if (!read_number_text(&reader, &host)) {
        fputs("{\"ok\":false,\"code\":\"CLI\",\"message\":\"неразборчивый признак хозяина\"}\n", stdout);
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
    /* Обнуление здесь не перестраховка, а следствие двух правок, встретившихся
       в одном дереве: рабочий режим планировщика дал `fl_conc_run` пути, на
       которых итог заполняется не целиком, а межмодульная оптимизация (`-flto`)
       позволила компилятору увидеть это через границу файла. По отдельности ни
       одна ветка не краснела; вместе — `-Werror=maybe-uninitialized` на
       `outcome.outcome` и `outcome.time`. Стоит обнуление ноль тактов и снимает
       вопрос целиком, а не глушит предупреждение. */
    fl_conc_result outcome = {0};
    size_t turn_limit = 0;
    size_t process_limit = 0;
    size_t worker_count = 0;
    if (!limit_from_number(turns, &turn_limit) || !limit_from_number(processes, &process_limit) ||
        !limit_from_number(workers, &worker_count)) {
      fputs("{\"ok\":false,\"code\":\"CLI\",\"message\":\"предел в запросе отрицателен или не число\"}\n",
            stdout);
      return;
    }
    if (fl_conc_run_host(&ctx, plan, run, seed, turn_limit, process_limit, worker_count, journal != 0.0,
                         host != 0.0, &outcome, &error) == FL_OK) {
      write_run(run, &outcome);
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

  /* Граница входа — ДО вызова: значение вне объявленного типа выносит вместе с
     типом и доказательство завершения, и поймать вечную цепочку потом нечем. */
  status = fl_check_entry(&ctx, FL_PROGRAM_ENTRY(), name, args, count, &error);
  if (status == FL_OK) {
    status = FL_PROGRAM_CALL(&ctx, name, args, count, &result, &error);
  }
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

static int run_main(int argc, char **argv) {
  fl_arena arena;
  size_t length = 0;
  size_t start = 0;
  size_t index = 0;
  size_t line = 0;
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
  if (argc > 1 ? strcmp(argv[1], "--json") != 0 : fl_human_bare() == 1) {
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
      /* Хвостовой «\r» снимается ТОЛЬКО для счёта: он ASCII и текстом быть не
         мешает, а вот число «из скольких» обязано совпасть с теми целями, чей
         построчный читатель снимает его сам (Go, Java, C#). */
      size_t stop = index;
      size_t bad = 0;
      if (index == length && start == length) {
        break;
      }
      line += 1;
      if (stop > start && input[stop - 1] == '\r') {
        stop -= 1;
      }
      /* Вопрос задаётся рантайму (`fl_utf8_not_text_at`), а не решается здесь:
         тот же вопрос задают хозяин `flang io` и планировщик конкурентности,
         и третий ответ на один вопрос был бы третьим способом разойтись. */
      bad = fl_utf8_not_text_at(input + start, stop - start);
      if (bad > 0) {
        fflush(stdout);
        cli_not_text(line, input + start, stop - start, bad);
        fl_arena_release(&arena);
        free(input);
        return 1;
      }
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

/*
 * ── Почему прогонщик считает не на своём стеке ─────────────────────────────
 *
 * Счётчик глубины считает КАДРЫ, а несёт их стек, и толщина кадра — свойство
 * программы, а не языка. Замер холодными процессами: у функции с одним
 * параметром напечатанный C проходит 23 807 кадров при стеке 8 МиБ, а у
 * функции с сорока связываниями — 1 518, и на пределах ПО УМОЛЧАНИЮ (10 000)
 * она умирала по SIGSEGV: без кода, без текста, без возможности перехвата.
 * Объявленный предел глубины в этой цели пределом НЕ БЫЛ.
 *
 * Лечение то же, что в бэкенде Python (`rt.call_with_deep_stack`): расчёт идёт
 * на потоке с ЯВНО ЗАДАННЫМ стеком, а размер стека соотнесён с объявленным
 * пределом — FL_MAX_DEPTH кадров по FL_STACK_PER_FRAME байт. Размер кадра взят
 * не с потолка: `cc -fstack-usage` по всему корпусу репозитория (7 896 функций)
 * дал худший кадр 6 496 байт — у самого компилятора flang, — и 16 КиБ на кадр
 * несут его с запасом в 2,5 раза.
 *
 * Предел берётся впечатанный (`--max-depth` при печати) либо названный ключом
 * `--предел-глубины` — но НЕ тот, что приедет в запросе: стек заводится один раз
 * на процесс, а запросов в трубе сколько угодно. Запрос, попросивший больше
 * заведённого, упрётся в сторож `fl_enter` и получит объявленный отказ с честным
 * текстом про хозяина — не молчаливую смерть.
 *
 * Если потока с таким стеком система не даёт (не POSIX, `ulimit -v`, контейнер
 * с пределом адресного пространства), расчёт идёт здесь же. Обещание держится и
 * тогда — его держит сторож, а не стек: предел окажется ниже объявленного, и
 * программа СКАЖЕТ об этом, а не упадёт.
 *
 * ── Почему ключ глубины разбирается ЗДЕСЬ, а не у команды ──────────────────
 *
 * Стек заводится ДО того, как разобран хоть один ключ, — строкой ниже. Значит
 * команда, разобравшая `--предел-глубины` у себя, опоздала бы ровно на стек:
 * число в `ctx->max_depth` легло бы, а нести его было бы нечем, и `fl_enter`
 * упёрся бы в `fl_stack_spent` — «исчерпала стек хозяина», не дойдя до
 * объявленного предела. Поднять предел и поднять стек — одно движение, и делать
 * его надо здесь.
 *
 * Отсюда же второе следствие: ключ общий для всех команд бинарника, а не свой у
 * каждой. Он снимается из `argv` до передачи управления, поэтому разборы команд
 * его не видят вовсе и своего «непонятный ключ» на него не печатают.
 *
 * Задача 7444: до этой правки предела глубины у идущего прогона не менял НИЧТО,
 * кроме пересборки, — `--max-depth` кладёт число в напечатанную программу, а не
 * в свою.
 */

/*
 * Строгий разбор числа: только цифры, только больше нуля, без переполнения.
 * Тот же разбор и по тому же доводу, что у `--предел-шагов` в человеческом
 * входе: эталон на flang «1e3» не принимает вовсе, и `strtoul` здесь дал бы
 * 1000 там, где эталон отказывает.
 *
 * Ноль не принимается: он значит «не сказано», а снятие предела — это
 * `ctx->max_depth = 0` на самом контексте, и одним числом эти два смысла
 * называть нельзя.
 */
static int cli_whole(const char *text, size_t *out) {
  size_t value = 0;
  size_t at = 0;
  if (text == NULL || text[0] == 0) {
    return 0;
  }
  for (at = 0; text[at] != 0; at += 1) {
    if (text[at] < '0' || text[at] > '9') {
      return 0;
    }
    if (value > ((size_t)-1 - (size_t)(text[at] - '0')) / 10) {
      return 0;
    }
    value = value * 10 + (size_t)(text[at] - '0');
  }
  if (value == 0) {
    return 0;
  }
  *out = value;
  return 1;
}

/*
 * Снимает `--предел-глубины N` (латиницей `--depth-limit N`) из `argv` и
 * говорит найденное число. Ключ может стоять где угодно: человек пишет его и
 * перед командой, и после файла, и оба написания обязаны работать одинаково.
 *
 * Даёт 0 — разобрано; 2 — ключ назван, а число при нём негодное. Код 2 тот же,
 * что у прочих ошибок ВЫЗОВА во всём бинарнике.
 */
static int cli_depth_key(int *argc, char **argv, size_t *depth) {
  int read = 1;
  int write = 1;
  int count = *argc;
  while (read < count) {
    const char *word = argv[read];
    if (strcmp(word, "--предел-глубины") == 0 || strcmp(word, "--depth-limit") == 0) {
      if (read + 1 >= count) {
        fputs("flang --предел-глубины: не названо число кадров\n", stderr);
        return 2;
      }
      if (!cli_whole(argv[read + 1], depth)) {
        fprintf(stderr,
                "flang --предел-глубины: «%s» — не целое число кадров больше нуля\n",
                argv[read + 1]);
        return 2;
      }
      read += 2;
      continue;
    }
    argv[write] = argv[read];
    write += 1;
    read += 1;
  }
  argv[write] = NULL;
  *argc = write;
  return 0;
}

typedef struct cli_run {
  int argc;
  char **argv;
  int status;
} cli_run;

static void cli_body(void *raw) {
  cli_run *run = (cli_run *)raw;
  run->status = run_main(run->argc, run->argv);
}

int main(int argc, char **argv) {
  cli_run run;
  size_t depth = 0;
  int bad = cli_depth_key(&argc, argv, &depth);
  if (bad != 0) {
    return bad;
  }
  if (depth != 0) {
    fl_max_depth_default_set(depth);
  }
  run.argc = argc;
  run.argv = argv;
  run.status = 0;
  /* Стек — под ДЕЙСТВУЮЩИЙ предел, а не под впечатанный. Ключа не назвали —
     `fl_max_depth_default` отдаёт ровно `FL_MAX_DEPTH`, и прогон идёт байт в
     байт как прежде. */
  if (!fl_call_deep(fl_stack_wanted(fl_max_depth_default()), cli_body, &run)) {
    cli_body(&run);
  }
  return run.status;
}
