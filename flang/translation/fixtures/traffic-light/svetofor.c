/*
 * Сгенерировано flang (бэкенд C, flang/self/emit-c.flang). Не редактировать руками.
 * Модуль flang: «Светофор».
 * Файл: реализация.
 * Правьте исходник на flang и печатайте заново: любая правка здесь потеряется.
 */
#include "svetofor.h"

#include <string.h>


/* Конструктор варианта «Красный» суммы «Светофор». */
fl_status svetofor_variant_krasnyy(fl_ctx *ctx, fl_value *out, fl_error *error) {
  return fl_variant_new(ctx, "Красный", NULL, NULL, 0, out, error);
}

/* Конструктор варианта «Жёлтый» суммы «Светофор». */
fl_status svetofor_variant_zhyoltyy(fl_ctx *ctx, fl_value *out, fl_error *error) {
  return fl_variant_new(ctx, "Жёлтый", NULL, NULL, 0, out, error);
}

/* Конструктор варианта «Зелёный» суммы «Светофор». */
fl_status svetofor_variant_zelyonyy(fl_ctx *ctx, fl_value *out, fl_error *error) {
  return fl_variant_new(ctx, "Зелёный", NULL, NULL, 0, out, error);
}

/*
 * Функция flang «Штраф».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param svet — «свет»: «Светофор»
 * @return значение: число
 */
fl_status svetofor_shtraf(fl_ctx *ctx, fl_value svet, fl_value *result, fl_error *error) {
  fl_value fl_t1 = fl_nothing();
  if (fl_variant_is(svet, "Красный")) {
    fl_t1 = fl_number(500.0);
  } else if (fl_variant_is(svet, "Жёлтый")) {
    fl_t1 = fl_number(100.0);
  } else if (fl_variant_is(svet, "Зелёный")) {
    fl_t1 = fl_number(0.0);
  } else {
    return fl_match_fail(ctx, svet, error);
  }
  const fl_value fl_t2 = fl_t1;
  if (fl_t2.tag != FL_NUMBER) FL_TRY(fl_not_order(ctx, fl_t2, fl_number(0.0), error));
  /* постусловие «штраф неотрицателен» */
  bool fl_t3 = false;
  FL_TRY(fl_post(ctx, fl_flag(fl_t2.as.number >= 0.0), "штраф неотрицателен", "Штраф", &fl_t3, error));
  if (!fl_t3) {
    return fl_fail(ctx, error, "FLANG_PROPERTY", "%s", "нарушено свойство «штраф неотрицателен» функции «Штраф»");
  }
  *result = fl_t2;
  return FL_OK;
}

/*
 * Вызов по исходному имени flang. Коды и тексты — те же, что у
 * интерпретатора: «не найдена функция …» и «функция … принимает N аргум.».
 */
fl_status svetofor_call(fl_ctx *ctx, const char *name, const fl_value *args, size_t count,
                    fl_value *result, fl_error *error) {
  if (strcmp(name, "Штраф") == 0) {
    if (count != 1) {
      return fl_fail(ctx, error, FL_CODE_TYPE, "функция «%s» принимает %lu аргум., получено %lu",
                     "Штраф", (unsigned long)1, (unsigned long)count);
    }
    return svetofor_shtraf(ctx, args[0], result, error);
  }
  return fl_fail(ctx, error, FL_CODE_UNKNOWN_NAME, "не найдена функция «%s»", name);
}

/*
 * ТА ЖЕ ДВЕРЬ, НО С ГРАНИЦЕЙ ВХОДА: сначала объявленные типы параметров
 * (fl_check_entry по таблице внизу файла), потом вызов. Зовите ЭТУ, если
 * значения пришли снаружи — из JSON, из другого языка, от человека.
 *
 * Почему не сверяет сам `_call`. Он обязан отвечать значение в значение так
 * же, как `interpret` у свидетеля, а тот объявленных типов не сверяет тоже:
 * сверяет их `flang run`. Здесь ровно та же пара — `_call` вычислитель,
 * `_enter` дверь, — и разойдись они, у языка стало бы два ответа на вопрос
 * «подходит ли значение типу».
 */
fl_status svetofor_enter(fl_ctx *ctx, const char *name, const fl_value *args, size_t count,
                    fl_value *result, fl_error *error) {
  FL_TRY(fl_check_entry(ctx, svetofor_entry(), name, args, count, error));
  return svetofor_call(ctx, name, args, count, result, error);
}

/*
 * Граница входа: объявленные типы параметров данными. Прогонщик сверяет по
 * ним значения, пришедшие снаружи, ДО вызова (fl_check_entry).
 *
 * Виды `неизвестно` (значение-функция, параметр полиморфизма, применение
 * типа с аргументами) не сверяются — ровно как молчит о них проверка
 * значений свидетеля.
 */
static const fl_type_variant svetofor_entry_variants[] = {
  { "Красный", 0, 0 },
  { "Жёлтый", 0, 0 },
  { "Зелёный", 0, 0 },
};

static const fl_type svetofor_entry_types[] = {
  { FL_TYPE_SUM, "«Светофор»", "Светофор", false, false, false, 0.0, 0.0, 0, 0, 0, 0, 3 },
};

static const fl_entry_param svetofor_entry_params[] = {
  { "Штраф", "свет", 0 },
};

static const fl_entry_table svetofor_entry_table = {
  svetofor_entry_types, 1,
  NULL, 0,
  svetofor_entry_variants, 3,
  svetofor_entry_params, 1
};

const fl_entry_table *svetofor_entry(void) {
  return &svetofor_entry_table;
}
