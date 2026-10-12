/*
 * Сгенерировано flang (бэкенд C, flang/self/emit-c.flang).
 * Не редактировать руками.
 * Модуль flang: «Constant step at the boundary».
 * Файл: реализация.
 * Правьте исходник на flang и печатайте заново:
 * любая правка здесь потеряется.
 */
#include "constant_step_at_the_boundary.h"

#include <string.h>


/* Тело «Обратный счёт»; глубину считает обёртка ниже. */
static fl_status constant_step_at_the_boundary_obratnyy_schyot_body(fl_ctx *ctx, fl_value n, fl_value *result, fl_error *error) {
  for (;;) {
    if (n.tag != FL_NUMBER) FL_TRY(fl_not_order(ctx, n, fl_number(0.0), error));
    bool fl_t1 = false;
    FL_TRY(fl_cond(ctx, fl_flag(n.as.number <= 0.0), &fl_t1, error));
    if (fl_t1) {
      *result = fl_number(0.0);
      return FL_OK;
    } else {
      if (n.tag != FL_NUMBER) FL_TRY(fl_not_numbers(ctx, "sub", n, fl_number(1.0), error));
      const fl_value shag = fl_number(n.as.number - 1.0); /* пусть «шаг» */
      fl_value fl_t2 = fl_nothing();
      FL_TRY(fl_lt(ctx, shag, n, &fl_t2, error));
      bool fl_t3 = false;
      FL_TRY(fl_cond(ctx, fl_t2, &fl_t3, error));
      fl_value fl_t4 = fl_nothing();
      if (fl_t3) {
        fl_t4 = shag;
      } else {
        fl_value fl_t5 = fl_nothing();
        FL_TRY(constant_step_at_the_boundary_mera_ubyvaet(ctx, shag, n, &fl_t5, error));
        fl_t4 = fl_t5;
      }
      n = fl_t4;
      /* виток цикла — тоже шаг: самовызов упрётся в лимит */
      FL_TRY(fl_tick(ctx, "Обратный счёт", error));
      continue;
    }
  }
}

/*
 * Функция flang «Обратный счёт».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param n — «н»: число
 * @return значение: число
 */
fl_status constant_step_at_the_boundary_obratnyy_schyot(fl_ctx *ctx, fl_value n, fl_value *result, fl_error *error) {
  FL_TRY(fl_enter(ctx, "Обратный счёт", error));
  {
    const fl_mark region = fl_region_open(ctx);
    const fl_status status = constant_step_at_the_boundary_obratnyy_schyot_body(ctx, n, result, error);
    fl_leave(ctx);
    return fl_region_close(ctx, region, status, result, error);
  }
}

/*
 * Функция flang «мера убывает».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param shag — «шаг»: число
 * @param mera — «мера»: число
 * @return значение: число
 */
fl_status constant_step_at_the_boundary_mera_ubyvaet(fl_ctx *ctx, fl_value shag, fl_value mera, fl_value *result, fl_error *error) {
  const fl_value fl_t6 = shag;
  fl_value fl_t7 = fl_nothing();
  FL_TRY(fl_lt(ctx, fl_t6, mera, &fl_t7, error));
  /* постусловие «мера убывает» */
  bool fl_t8 = false;
  FL_TRY(fl_post(ctx, fl_t7, "мера убывает", "мера убывает", &fl_t8, error));
  if (!fl_t8) {
    return fl_fail(ctx, error, "FLANG_MEASURE", "%s", "тотальная функция «Обратный счёт»: мера не убыла — аргумент 1 вызова «Обратный счёт» не стал меньше параметра «н». Завершение доказано убыванием этой меры, а числа flang — IEEE-754 double: при большом |«н»| постоянный шаг не меняет значение, и спуск не идёт. Отказ здесь честнее зацикливания");
  }
  *result = fl_t6;
  return FL_OK;
}

/*
 * Вызов по исходному имени flang. Коды и тексты — те же, что у
 * интерпретатора: «не найдена функция …» и «функция … принимает N аргум.».
 */
fl_status constant_step_at_the_boundary_call(fl_ctx *ctx, const char *name, const fl_value *args, size_t count,
                    fl_value *result, fl_error *error) {
  if (strcmp(name, "Обратный счёт") == 0) {
    if (count != 1) {
      return fl_fail(ctx, error, FL_CODE_TYPE, "функция «%s» принимает %lu аргум., получено %lu",
                     "Обратный счёт", (unsigned long)1, (unsigned long)count);
    }
    return constant_step_at_the_boundary_obratnyy_schyot(ctx, args[0], result, error);
  }
  if (strcmp(name, "мера убывает") == 0) {
    if (count != 2) {
      return fl_fail(ctx, error, FL_CODE_TYPE, "функция «%s» принимает %lu аргум., получено %lu",
                     "мера убывает", (unsigned long)2, (unsigned long)count);
    }
    return constant_step_at_the_boundary_mera_ubyvaet(ctx, args[0], args[1], result, error);
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
fl_status constant_step_at_the_boundary_enter(fl_ctx *ctx, const char *name, const fl_value *args, size_t count,
                    fl_value *result, fl_error *error) {
  FL_TRY(fl_check_entry(ctx, constant_step_at_the_boundary_entry(), name, args, count, error));
  return constant_step_at_the_boundary_call(ctx, name, args, count, result, error);
}

/*
 * Граница входа: объявленные типы параметров данными. Прогонщик сверяет по
 * ним значения, пришедшие снаружи, ДО вызова (fl_check_entry).
 *
 * Виды `неизвестно` (значение-функция, параметр полиморфизма, применение
 * типа с аргументами) не сверяются — ровно как молчит о них проверка
 * значений свидетеля.
 */
static const fl_type constant_step_at_the_boundary_entry_types[] = {
  { FL_TYPE_NUMBER, "число", "", false, false, false, 0.0, 0.0, 0, 0, 0, 0, 0 },
};

static const fl_entry_param constant_step_at_the_boundary_entry_params[] = {
  { "Обратный счёт", "н", 0 },
};

static const fl_entry_table constant_step_at_the_boundary_entry_table = {
  constant_step_at_the_boundary_entry_types, 1,
  NULL, 0,
  NULL, 0,
  constant_step_at_the_boundary_entry_params, 1
};

const fl_entry_table *constant_step_at_the_boundary_entry(void) {
  return &constant_step_at_the_boundary_entry_table;
}
