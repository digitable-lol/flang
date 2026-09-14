/*
 * Сгенерировано flang (бэкенд C, flang/self/emit-c.flang). Не редактировать руками.
 * Модуль flang: «Подделка условия без спуска».
 * Файл: реализация.
 * Правьте исходник на flang и печатайте заново: любая правка здесь потеряется.
 */
#include "poddelka_usloviya_bez_spuska.h"

#include <string.h>


/* Тело «Стоит на месте»; глубину считает обёртка ниже. */
static fl_status poddelka_usloviya_bez_spuska_stoit_na_meste_body(fl_ctx *ctx, fl_value n, fl_value *result, fl_error *error) {
  if (n.tag != FL_NUMBER) FL_TRY(fl_not_order(ctx, n, fl_number(0.0), error));
  bool fl_t1 = false;
  FL_TRY(fl_cond(ctx, fl_flag(n.as.number <= 0.0), &fl_t1, error));
  fl_value fl_t2 = fl_nothing();
  if (fl_t1) {
    fl_t2 = fl_number(0.0 - 1.0);
  } else {
    fl_value fl_t3 = fl_nothing();
    FL_TRY(poddelka_usloviya_bez_spuska_stoit_na_meste(ctx, n, &fl_t3, error));
    fl_t2 = fl_t3;
  }
  const fl_value fl_t4 = fl_t2;
  if (fl_t4.tag != FL_NUMBER) FL_TRY(fl_not_order(ctx, fl_t4, fl_number(0.0), error));
  /* постусловие «результат меньше нуля» */
  bool fl_t5 = false;
  FL_TRY(fl_post(ctx, fl_flag(fl_t4.as.number < 0.0), "результат меньше нуля", "Стоит на месте", &fl_t5, error));
  if (!fl_t5) {
    return fl_fail(ctx, error, "FLANG_PROPERTY", "%s", "нарушено свойство «результат меньше нуля» функции «Стоит на месте»");
  }
  *result = fl_t4;
  return FL_OK;
}

/*
 * Функция flang «Стоит на месте».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param n — «н»: «неотрицательное»
 * @return значение: число
 */
fl_status poddelka_usloviya_bez_spuska_stoit_na_meste(fl_ctx *ctx, fl_value n, fl_value *result, fl_error *error) {
  FL_TRY(fl_enter(ctx, "Стоит на месте", error));
  {
    const fl_mark region = fl_region_open(ctx);
    const fl_status status = poddelka_usloviya_bez_spuska_stoit_na_meste_body(ctx, n, result, error);
    fl_leave(ctx);
    return fl_region_close(ctx, region, status, result, error);
  }
}

/* Тело «Кружит по паре»; глубину считает обёртка ниже. */
static fl_status poddelka_usloviya_bez_spuska_kruzhit_po_pare_body(fl_ctx *ctx, fl_value n, fl_value m, fl_value *result, fl_error *error) {
  if (n.tag != FL_NUMBER) FL_TRY(fl_not_order(ctx, n, fl_number(0.0), error));
  bool fl_t6 = false;
  FL_TRY(fl_cond(ctx, fl_flag(n.as.number <= 0.0), &fl_t6, error));
  fl_value fl_t7 = fl_nothing();
  if (fl_t6) {
    fl_t7 = fl_number(0.0 - 1.0);
  } else {
    fl_value fl_t8 = fl_nothing();
    FL_TRY(poddelka_usloviya_bez_spuska_kruzhit_po_pare(ctx, m, n, &fl_t8, error));
    fl_t7 = fl_t8;
  }
  const fl_value fl_t9 = fl_t7;
  if (fl_t9.tag != FL_NUMBER) FL_TRY(fl_not_order(ctx, fl_t9, fl_number(0.0), error));
  /* постусловие «результат меньше нуля» */
  bool fl_t10 = false;
  FL_TRY(fl_post(ctx, fl_flag(fl_t9.as.number < 0.0), "результат меньше нуля", "Кружит по паре", &fl_t10, error));
  if (!fl_t10) {
    return fl_fail(ctx, error, "FLANG_PROPERTY", "%s", "нарушено свойство «результат меньше нуля» функции «Кружит по паре»");
  }
  *result = fl_t9;
  return FL_OK;
}

/*
 * Функция flang «Кружит по паре».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param n — «н»: «неотрицательное»
 * @param m — «м»: «неотрицательное»
 * @return значение: число
 */
fl_status poddelka_usloviya_bez_spuska_kruzhit_po_pare(fl_ctx *ctx, fl_value n, fl_value m, fl_value *result, fl_error *error) {
  FL_TRY(fl_enter(ctx, "Кружит по паре", error));
  {
    const fl_mark region = fl_region_open(ctx);
    const fl_status status = poddelka_usloviya_bez_spuska_kruzhit_po_pare_body(ctx, n, m, result, error);
    fl_leave(ctx);
    return fl_region_close(ctx, region, status, result, error);
  }
}

/* Тело «Через одно»; глубину считает обёртка ниже. */
static fl_status poddelka_usloviya_bez_spuska_cherez_odno_body(fl_ctx *ctx, fl_value n, fl_value *result, fl_error *error) {
  if (n.tag != FL_NUMBER) FL_TRY(fl_not_order(ctx, n, fl_number(1.0), error));
  bool fl_t11 = false;
  FL_TRY(fl_cond(ctx, fl_flag(n.as.number <= 1.0), &fl_t11, error));
  fl_value fl_t12 = fl_nothing();
  if (fl_t11) {
    fl_t12 = fl_number(0.0 - 1.0);
  } else {
    if (n.tag != FL_NUMBER) FL_TRY(fl_not_numbers(ctx, "sub", n, fl_number(2.0), error));
    fl_value fl_t13 = fl_nothing();
    FL_TRY(poddelka_usloviya_bez_spuska_cherez_odno(ctx, fl_number(n.as.number - 2.0), &fl_t13, error));
    fl_t12 = fl_t13;
  }
  const fl_value fl_t14 = fl_t12;
  if (fl_t14.tag != FL_NUMBER) FL_TRY(fl_not_order(ctx, fl_t14, fl_number(0.0), error));
  /* постусловие «результат меньше нуля» */
  bool fl_t15 = false;
  FL_TRY(fl_post(ctx, fl_flag(fl_t14.as.number < 0.0), "результат меньше нуля", "Через одно", &fl_t15, error));
  if (!fl_t15) {
    return fl_fail(ctx, error, "FLANG_PROPERTY", "%s", "нарушено свойство «результат меньше нуля» функции «Через одно»");
  }
  *result = fl_t14;
  return FL_OK;
}

/*
 * Функция flang «Через одно».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param n — «н»: «неотрицательное»
 * @return значение: число
 */
fl_status poddelka_usloviya_bez_spuska_cherez_odno(fl_ctx *ctx, fl_value n, fl_value *result, fl_error *error) {
  FL_TRY(fl_enter(ctx, "Через одно", error));
  {
    const fl_mark region = fl_region_open(ctx);
    const fl_status status = poddelka_usloviya_bez_spuska_cherez_odno_body(ctx, n, result, error);
    fl_leave(ctx);
    return fl_region_close(ctx, region, status, result, error);
  }
}

/* Тело «Дно зовёт себя»; глубину считает обёртка ниже. */
static fl_status poddelka_usloviya_bez_spuska_dno_zovyot_sebya_body(fl_ctx *ctx, fl_value n, fl_value *result, fl_error *error) {
  if (n.tag != FL_NUMBER) FL_TRY(fl_not_order(ctx, n, fl_number(0.0), error));
  bool fl_t16 = false;
  FL_TRY(fl_cond(ctx, fl_flag(n.as.number <= 0.0), &fl_t16, error));
  fl_value fl_t17 = fl_nothing();
  if (fl_t16) {
    fl_value fl_t18 = fl_nothing();
    FL_TRY(poddelka_usloviya_bez_spuska_dno_zovyot_sebya(ctx, n, &fl_t18, error));
    fl_t17 = fl_t18;
  } else {
    fl_t17 = fl_number(0.0 - 1.0);
  }
  const fl_value fl_t19 = fl_t17;
  if (fl_t19.tag != FL_NUMBER) FL_TRY(fl_not_order(ctx, fl_t19, fl_number(0.0), error));
  /* постусловие «результат меньше нуля» */
  bool fl_t20 = false;
  FL_TRY(fl_post(ctx, fl_flag(fl_t19.as.number < 0.0), "результат меньше нуля", "Дно зовёт себя", &fl_t20, error));
  if (!fl_t20) {
    return fl_fail(ctx, error, "FLANG_PROPERTY", "%s", "нарушено свойство «результат меньше нуля» функции «Дно зовёт себя»");
  }
  *result = fl_t19;
  return FL_OK;
}

/*
 * Функция flang «Дно зовёт себя».
 *
 * Обычная (не тотальная): завершение не доказано, зацикливание не ловится.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param n — «н»: «неотрицательное»
 * @return значение: число
 */
fl_status poddelka_usloviya_bez_spuska_dno_zovyot_sebya(fl_ctx *ctx, fl_value n, fl_value *result, fl_error *error) {
  FL_TRY(fl_enter(ctx, "Дно зовёт себя", error));
  {
    const fl_mark region = fl_region_open(ctx);
    const fl_status status = poddelka_usloviya_bez_spuska_dno_zovyot_sebya_body(ctx, n, result, error);
    fl_leave(ctx);
    return fl_region_close(ctx, region, status, result, error);
  }
}

/*
 * Вызов по исходному имени flang. Коды и тексты — те же, что у
 * интерпретатора: «не найдена функция …» и «функция … принимает N аргум.».
 */
fl_status poddelka_usloviya_bez_spuska_call(fl_ctx *ctx, const char *name, const fl_value *args, size_t count,
                    fl_value *result, fl_error *error) {
  if (strcmp(name, "Стоит на месте") == 0) {
    if (count != 1) {
      return fl_fail(ctx, error, FL_CODE_TYPE, "функция «%s» принимает %lu аргум., получено %lu",
                     "Стоит на месте", (unsigned long)1, (unsigned long)count);
    }
    return poddelka_usloviya_bez_spuska_stoit_na_meste(ctx, args[0], result, error);
  }
  if (strcmp(name, "Кружит по паре") == 0) {
    if (count != 2) {
      return fl_fail(ctx, error, FL_CODE_TYPE, "функция «%s» принимает %lu аргум., получено %lu",
                     "Кружит по паре", (unsigned long)2, (unsigned long)count);
    }
    return poddelka_usloviya_bez_spuska_kruzhit_po_pare(ctx, args[0], args[1], result, error);
  }
  if (strcmp(name, "Через одно") == 0) {
    if (count != 1) {
      return fl_fail(ctx, error, FL_CODE_TYPE, "функция «%s» принимает %lu аргум., получено %lu",
                     "Через одно", (unsigned long)1, (unsigned long)count);
    }
    return poddelka_usloviya_bez_spuska_cherez_odno(ctx, args[0], result, error);
  }
  if (strcmp(name, "Дно зовёт себя") == 0) {
    if (count != 1) {
      return fl_fail(ctx, error, FL_CODE_TYPE, "функция «%s» принимает %lu аргум., получено %lu",
                     "Дно зовёт себя", (unsigned long)1, (unsigned long)count);
    }
    return poddelka_usloviya_bez_spuska_dno_zovyot_sebya(ctx, args[0], result, error);
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
fl_status poddelka_usloviya_bez_spuska_enter(fl_ctx *ctx, const char *name, const fl_value *args, size_t count,
                    fl_value *result, fl_error *error) {
  FL_TRY(fl_check_entry(ctx, poddelka_usloviya_bez_spuska_entry(), name, args, count, error));
  return poddelka_usloviya_bez_spuska_call(ctx, name, args, count, result, error);
}

/*
 * Граница входа: объявленные типы параметров данными. Прогонщик сверяет по
 * ним значения, пришедшие снаружи, ДО вызова (fl_check_entry).
 *
 * Виды `неизвестно` (значение-функция, параметр полиморфизма, применение
 * типа с аргументами) не сверяются — ровно как молчит о них проверка
 * значений свидетеля.
 */
static const fl_type poddelka_usloviya_bez_spuska_entry_types[] = {
  { FL_TYPE_NUMBER, "неотрицательное", "", false, true, true, 0.0, 9007199254740991.0, 0, 0, 0, 0, 0 },
};

static const fl_entry_param poddelka_usloviya_bez_spuska_entry_params[] = {
  { "Стоит на месте", "н", 0 },
  { "Кружит по паре", "н", 0 },
  { "Кружит по паре", "м", 0 },
  { "Через одно", "н", 0 },
  { "Дно зовёт себя", "н", 0 },
};

static const fl_entry_table poddelka_usloviya_bez_spuska_entry_table = {
  poddelka_usloviya_bez_spuska_entry_types, 1,
  NULL, 0,
  NULL, 0,
  poddelka_usloviya_bez_spuska_entry_params, 5
};

const fl_entry_table *poddelka_usloviya_bez_spuska_entry(void) {
  return &poddelka_usloviya_bez_spuska_entry_table;
}
