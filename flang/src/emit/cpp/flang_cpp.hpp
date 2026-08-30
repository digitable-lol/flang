/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/*
 * Рантайм flang для бэкенда C++ — лицо цели.
 *
 * Этот файл печатается бэкендом как есть, байт в байт, для любой программы:
 * он ничего не знает ни об одной конкретной программе и ничего у неё не
 * спрашивает.
 *
 * ── Что здесь есть и чего здесь нет ────────────────────────────────────────
 *
 * ЗДЕСЬ НЕТ второго представления значения. Значение, арена, счётчик шагов,
 * коды и тексты отказов приезжают из `flang_runtime.hpp` — того же файла, что
 * у цели «c», собранного компилятором C++. Второе представление значило бы
 * второй набор расхождений с вычислителем, и цена этому измерена деревом
 * дважды: у восьми целей печати расхождение ловится побайтовой сверкой, а не
 * рассуждением.
 *
 * ЗДЕСЬ ЕСТЬ ровно то, чего у C нет, а у C++ есть, и ради чего цель заведена
 * отдельно от «c»:
 *
 *   1. ПРОСТРАНСТВО ИМЁН. У C оно одно на всю программу, и потому имя верхнего
 *      уровня печатается как `префикс_роль_имя`. У C++ имя живёт в
 *      `namespace`, и напечатанный модуль зовётся полным именем `модуль::имя`
 *      — так же, как у Rust зовут `модуль::имя`, и по той же причине.
 *
 *   2. ОТКАЗ ИСКЛЮЧЕНИЕМ. У C отказ несётся парой «код возврата плюс
 *      `fl_error` по указателю», и каждый вызов обязан его переспросить
 *      (`FL_TRY`). У C++ отказ несёт `flang::Error`, и вызывающий волен не
 *      писать ни одной проверки. Обе дороги ведут к одному и тому же тексту:
 *      `Error` НЕ придумывает своих слов, он возит `fl_error` целиком.
 *
 *   3. ПЕЧАТЬ ЗНАЧЕНИЯ В ПОТОК. `operator<<` печатает то же самое и теми же
 *      байтами, что `write_value` прогонщика на C. Это не украшение: сверка
 *      цели с целью идёт побайтово, и вторая раскладка JSON сделала бы две
 *      цели несравнимыми.
 *
 *   4. ЖИЗНЬ АРЕНЫ — RAII. `fl_arena_init`/`fl_arena_release` вручную
 *      расходятся на первом же раннем возврате; `Arena` закрывает арену
 *      деструктором, и раннего возврата, который её потеряет, не бывает.
 *
 * ── Чего этот файл НЕ обещает, и это названо, а не умолчано ────────────────
 *
 * • Он НЕ владеет значениями. `fl_value` указывает в арену, и правило то же,
 *   что у цели «c»: читать результат можно до ближайшего `reset`, а сохранить
 *   надолго — только скопировав. `Value` — это ВЗГЛЯД на значение, а не
 *   владелец, и `std::string` из него делает копию явно (`text()`).
 *
 * • Он НЕ ловит отказ рантайма, который отказом не является: переполнение
 *   стека и предел глубины приходят кодом `fl_status`, и `Error` возит именно
 *   его. Исключение здесь — способ ПЕРЕДАЧИ, а не второй набор бед.
 *
 * • Он НЕ требует исключений от самого рантайма. Рантайм собран как C++, но
 *   написан как C: он не бросает и не ловит. Поэтому `-fno-exceptions` ломает
 *   ровно этот файл и ровно в тех местах, где он объявлен ломающимся.
 */
#ifndef FLANG_CPP_HPP
#define FLANG_CPP_HPP

#include "flang_runtime.hpp"

#include <cstring>
#include <exception>
#include <initializer_list>
#include <ostream>
#include <string>
#include <vector>

namespace flang {

/*
 * Отказ вычисления. Возит `fl_error` целиком: код — короткое слово вроде
 * `FLANG_TYPE`, сообщение — та же строка, которую напечатал бы прогонщик на C.
 * `what()` склеивает их через двоеточие, потому что `std::exception` умеет
 * ровно одну строку, а терять при этом код нельзя.
 */
class Error : public std::exception {
 public:
  Error(fl_status status, const char *code, const char *message)
      : status_(status),
        code_(code == nullptr ? "" : code),
        message_(message == nullptr ? "" : message),
        what_(code_.empty() ? message_ : code_ + ": " + message_) {}

  fl_status status() const noexcept { return status_; }
  const std::string &code() const noexcept { return code_; }
  const std::string &message() const noexcept { return message_; }
  const char *what() const noexcept override { return what_.c_str(); }

 private:
  fl_status status_;
  std::string code_;
  std::string message_;
  std::string what_;
};

/*
 * Арена вычисления. Открывается конструктором, закрывается деструктором;
 * копировать её нельзя — две копии закрыли бы одну память дважды.
 */
class Arena {
 public:
  Arena() { fl_arena_init(&arena_); }
  ~Arena() { fl_arena_release(&arena_); }

  Arena(const Arena &) = delete;
  Arena &operator=(const Arena &) = delete;
  Arena(Arena &&) = delete;
  Arena &operator=(Arena &&) = delete;

  /* Отдать всё, что построено, и начать сначала. После этого ни один ранее
     полученный `fl_value` читать нельзя — правило то же, что у цели «c». */
  void reset() { fl_arena_reset(&arena_); }

  fl_arena *raw() noexcept { return &arena_; }

 private:
  fl_arena arena_;
};

/*
 * Взгляд на значение. Ни байта своей памяти: всё лежит в арене. Методы
 * отвечают на те же вопросы, что `fl_is_*` рантайма, — и отвечают ими же, а не
 * своим разбором тега.
 */
class Value {
 public:
  Value() : value_(fl_nothing()) {}
  Value(fl_value value) : value_(value) {}  // NOLINT: обёртка нарочно неявная

  fl_value raw() const noexcept { return value_; }
  operator fl_value() const noexcept { return value_; }

  bool is_nothing() const noexcept { return value_.tag == FL_NOTHING; }
  bool is_number() const noexcept { return value_.tag == FL_NUMBER; }
  bool is_flag() const noexcept { return value_.tag == FL_FLAG; }
  bool is_string() const noexcept { return value_.tag == FL_STRING; }
  bool is_list() const noexcept { return fl_is_list(value_); }
  bool is_record() const noexcept { return fl_is_record(value_); }
  bool is_variant() const noexcept { return fl_is_variant(value_); }
  bool is(const char *name) const noexcept { return fl_variant_is(value_, name); }

  /* Число и признак — по значению; вид не тот, значит спрашивали не то, и
     ответом будет отказ, а не тихий ноль. */
  double number() const {
    if (value_.tag != FL_NUMBER) {
      throw Error(FL_ERROR, "FLANG_TYPE", "значение не число");
    }
    return value_.as.number;
  }

  bool flag() const {
    if (value_.tag != FL_FLAG) {
      throw Error(FL_ERROR, "FLANG_TYPE", "значение не признак");
    }
    return value_.as.flag;
  }

  /* КОПИЯ, и это названо: строка в арене может не заканчиваться нулём (срез),
     а `std::string` обязана. */
  std::string text() const {
    if (value_.tag != FL_STRING) {
      throw Error(FL_ERROR, "FLANG_TYPE", "значение не строка");
    }
    return std::string(value_.as.string.utf8, value_.as.string.bytes);
  }

  size_t size() const {
    if (fl_is_list(value_)) {
      return value_.as.list.count;
    }
    if (fl_is_record(value_)) {
      return value_.as.record->count;
    }
    if (fl_is_variant(value_)) {
      return value_.as.variant->count;
    }
    throw Error(FL_ERROR, "FLANG_TYPE", "у значения нет длины");
  }

  Value at(size_t index) const {
    if (!fl_is_list(value_) || index >= value_.as.list.count) {
      throw Error(FL_ERROR, "FLANG_INDEX", "нет элемента с таким номером");
    }
    return Value(value_.as.list.items[index]);
  }

  /* Поле записи или варианта по имени. Имена полей всегда с нулём на конце —
     они приходят из модели, а не из данных. */
  Value field(const char *name) const {
    const fl_field *fields = nullptr;
    size_t count = 0;
    if (fl_is_record(value_)) {
      fields = value_.as.record->fields;
      count = value_.as.record->count;
    } else if (fl_is_variant(value_)) {
      fields = value_.as.variant->fields;
      count = value_.as.variant->count;
    } else {
      throw Error(FL_ERROR, "FLANG_TYPE", "у значения нет полей");
    }
    for (size_t index = 0; index < count; index += 1) {
      if (std::strcmp(fields[index].name, name) == 0) {
        return Value(fields[index].value);
      }
    }
    throw Error(FL_ERROR, "FLANG_FIELD", "значение не содержит такого поля");
  }

  /* Имя варианта; у не-варианта имени нет, и молчать об этом нельзя. */
  const char *variant_name() const {
    if (!fl_is_variant(value_)) {
      throw Error(FL_ERROR, "FLANG_TYPE", "значение не вариант");
    }
    return value_.as.variant->name;
  }

 private:
  fl_value value_;
};

/* ─────────────────────────── постройка значений ─────────────────────────── */

inline Value nothing() { return Value(fl_nothing()); }
inline Value number(double value) { return Value(fl_number(value)); }
inline Value flag(bool value) { return Value(fl_flag(value)); }

/*
 * Строка кладётся В АРЕНУ, а не берётся взаймы: `std::string`, из которой её
 * сделали, вполне может умереть раньше вычисления. Длина в кодовых точках
 * считается рантаймом (`fl_text`), а не здесь: второй счёт разошёлся бы с
 * первым на первом же неполном UTF-8.
 */
inline Value text(Arena &arena, const std::string &utf8) {
  fl_ctx ctx;
  fl_error error;
  fl_value out = fl_nothing();
  error.code = nullptr;
  error.message = nullptr;
  fl_ctx_init(&ctx, arena.raw());
  if (fl_text(&ctx, utf8.data(), utf8.size(), &out, &error) != FL_OK) {
    throw Error(FL_ERROR, error.code, error.message);
  }
  return Value(out);
}

/*
 * Список кладётся в арену тем же вызовом, которым его кладёт напечатанный код
 * (`fl_list_alloc`), — иначе у списка не было бы запаса, и «добавить» на нём
 * копировал бы там, где у своего списка не копирует.
 */
inline Value list(Arena &arena, std::initializer_list<Value> items) {
  fl_ctx ctx;
  fl_error error;
  fl_value *room = nullptr;
  size_t index = 0;
  error.code = nullptr;
  error.message = nullptr;
  fl_ctx_init(&ctx, arena.raw());
  if (fl_list_alloc(&ctx, items.size(), &room, &error) != FL_OK) {
    throw Error(FL_ERROR, error.code, error.message);
  }
  for (const Value &item : items) {
    room[index] = item.raw();
    index += 1;
  }
  return Value(fl_list(room, items.size()));
}

/* ────────────────────────────── печать в поток ───────────────────────────── */

/*
 * Раскладка JSON здесь ТА ЖЕ, что у `write_value` прогонщика на C, и это не
 * совпадение: сверка цели с целью идёт побайтово, и вторая раскладка сделала бы
 * «c» и «cpp» несравнимыми. Числа едут строкой (иначе потерялись бы NaN,
 * бесконечности и −0), запись и вариант — списком пар «имя, значение».
 */
inline void write_json_text(std::ostream &out, const char *utf8, size_t bytes) {
  static const char *const digits = "0123456789abcdef";
  out.put('"');
  for (size_t index = 0; index < bytes; index += 1) {
    const unsigned char symbol = static_cast<unsigned char>(utf8[index]);
    switch (symbol) {
      case '"': out << "\\\""; break;
      case '\\': out << "\\\\"; break;
      case '\n': out << "\\n"; break;
      case '\r': out << "\\r"; break;
      case '\t': out << "\\t"; break;
      case '\b': out << "\\b"; break;
      case '\f': out << "\\f"; break;
      default:
        if (symbol < 0x20u) {
          out << "\\u00";
          out.put(digits[(symbol >> 4) & 0xfu]);
          out.put(digits[symbol & 0xfu]);
        } else {
          out.put(static_cast<char>(symbol));
        }
    }
  }
  out.put('"');
}

inline std::ostream &operator<<(std::ostream &out, const Value &value) {
  const fl_value raw = value.raw();
  char digits[FL_NUMBER_TEXT_MAX];
  switch (raw.tag) {
    case FL_NOTHING:
      return out << "null";
    case FL_FLAG:
      return out << (raw.as.flag ? "true" : "false");
    case FL_NUMBER:
      fl_number_text(raw.as.number, digits);
      out << "{\"n\":";
      /* −0 обязан доехать до сверки со знаком: Object.is(0, −0) ложно. */
      if (raw.as.number == 0.0 && !(1.0 / raw.as.number > 0.0)) {
        write_json_text(out, "-0", 2);
      } else {
        write_json_text(out, digits, std::strlen(digits));
      }
      return out << '}';
    case FL_STRING:
      out << "{\"s\":";
      write_json_text(out, raw.as.string.utf8, raw.as.string.bytes);
      return out << '}';
    case FL_LIST:
      out << "{\"l\":[";
      for (size_t index = 0; index < raw.as.list.count; index += 1) {
        if (index > 0) {
          out << ',';
        }
        out << Value(raw.as.list.items[index]);
      }
      return out << "]}";
    case FL_RECORD:
      out << "{\"r\":[";
      for (size_t index = 0; index < raw.as.record->count; index += 1) {
        const fl_field &field = raw.as.record->fields[index];
        if (index > 0) {
          out << ',';
        }
        out << '[';
        write_json_text(out, field.name, std::strlen(field.name));
        out << ',' << Value(field.value) << ']';
      }
      return out << "]}";
    case FL_VARIANT:
      out << "{\"v\":";
      write_json_text(out, raw.as.variant->name, std::strlen(raw.as.variant->name));
      out << ",\"f\":[";
      for (size_t index = 0; index < raw.as.variant->count; index += 1) {
        const fl_field &field = raw.as.variant->fields[index];
        if (index > 0) {
          out << ',';
        }
        out << '[';
        write_json_text(out, field.name, std::strlen(field.name));
        out << ',' << Value(field.value) << ']';
      }
      return out << "]}";
  }
  return out << "null";
}

/* ──────────────────────────────── вызов ─────────────────────────────────── */

/*
 * Позвать функцию напечатанного модуля по имени.
 *
 * `enter` — это дверь модуля (`<модуль>::enter`), та самая, что сверяет
 * объявленные типы параметров ДО вызова. Вызывать в обход двери можно
 * (`<модуль>::call`), но тогда сверки типов не будет — ровно как у цели «c», и
 * ровно поэтому дверь здесь стоит умолчанием.
 *
 * Отказ приезжает исключением. Второй дороги — «вернуть код и переспросить» —
 * здесь нет нарочно: две дороги к одному отказу разошлись бы текстом.
 */
using Entry = fl_status (*)(fl_ctx *, const char *, const fl_value *, size_t, fl_value *,
                            fl_error *);

inline Value call(Arena &arena, Entry entry, const char *name,
                  std::initializer_list<Value> args) {
  fl_ctx ctx;
  fl_error error;
  fl_value result = fl_nothing();
  std::vector<fl_value> room;
  error.code = nullptr;
  error.message = nullptr;
  room.reserve(args.size());
  for (const Value &arg : args) {
    room.push_back(arg.raw());
  }
  fl_ctx_init(&ctx, arena.raw());
  const fl_status status =
      entry(&ctx, name, room.empty() ? nullptr : room.data(), room.size(), &result, &error);
  if (status != FL_OK) {
    throw Error(status, error.code, error.message);
  }
  return Value(result);
}

}  // namespace flang

#endif /* FLANG_CPP_HPP */
