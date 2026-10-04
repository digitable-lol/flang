/*
 * Сгенерировано flang (бэкенд C, flang/self/emit-c.flang). Не редактировать руками.
 * Модуль flang: «Declared measure at the boundary».
 * Файл: реализация.
 * Правьте исходник на flang и печатайте заново: любая правка здесь потеряется.
 */
#include "declared_measure_at_the_boundary.h"

#include <string.h>
#include <math.h> /* fmod, NAN и INFINITY: печать зовёт их по имени */


/* Тело «НОД»; глубину считает обёртка ниже. */
static fl_status declared_measure_at_the_boundary_nod_body(fl_ctx *ctx, fl_value pervoe, fl_value vtoroe, fl_value *result, fl_error *error) {
  for (;;) {
    bool fl_t1 = false;
    FL_TRY(fl_cond(ctx, fl_flag(fl_equal(vtoroe, fl_number(0.0))), &fl_t1, error));
    if (fl_t1) {
      *result = pervoe;
      return FL_OK;
    } else {
      const fl_value dovod_1 = vtoroe; /* пусть «довод 1» */
      if (pervoe.tag != FL_NUMBER || vtoroe.tag != FL_NUMBER) FL_TRY(fl_not_numbers(ctx, "mod", pervoe, vtoroe, error));
      const fl_value dovod_2 = fl_number(fmod(pervoe.as.number, vtoroe.as.number)); /* пусть «довод 2» */
      const fl_value mera_vitka = vtoroe; /* пусть «мера витка» */
      const fl_value mera_shaga = dovod_2; /* пусть «мера шага» */
      fl_value fl_t2 = fl_nothing();
      FL_TRY(fl_lt(ctx, mera_shaga, mera_vitka, &fl_t2, error));
      bool fl_t3 = false;
      FL_TRY(fl_cond(ctx, fl_t2, &fl_t3, error));
      fl_value fl_t4 = fl_nothing();
      if (fl_t3) {
        fl_value fl_t5 = fl_nothing();
        FL_TRY(fl_gte(ctx, mera_shaga, fl_number(0.0), &fl_t5, error));
        bool fl_t6 = false;
        FL_TRY(fl_cond(ctx, fl_t5, &fl_t6, error));
        fl_value fl_t7 = fl_nothing();
        if (fl_t6) {
          fl_value fl_t8 = fl_nothing();
          FL_TRY(fl_mod(ctx, mera_shaga, fl_number(1.0), &fl_t8, error));
          fl_value fl_t9 = fl_nothing();
          FL_TRY(fl_sub(ctx, mera_shaga, fl_t8, &fl_t9, error));
          fl_t7 = fl_flag(fl_equal(fl_t9, mera_shaga));
        } else {
          fl_t7 = fl_flag(false);
        }
        fl_t4 = fl_t7;
      } else {
        fl_t4 = fl_flag(false);
      }
      bool fl_t10 = false;
      FL_TRY(fl_cond(ctx, fl_t4, &fl_t10, error));
      fl_value fl_t11 = fl_nothing();
      if (fl_t10) {
        fl_t11 = dovod_1;
      } else {
        fl_value fl_t12 = fl_nothing();
        FL_TRY(declared_measure_at_the_boundary_obyavlennaya_mera_ubyvaet(ctx, mera_shaga, mera_vitka, dovod_1, &fl_t12, error));
        fl_t11 = fl_t12;
      }
      pervoe = fl_t11;
      vtoroe = dovod_2;
      /* виток цикла — тоже шаг: незавершающийся самовызов обязан упереться в лимит */
      FL_TRY(fl_tick(ctx, "НОД", error));
      continue;
    }
  }
}

/*
 * Функция flang «НОД».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 *
 * Хвостовой самовызов развёрнут в цикл: стек не растёт.
 *
 * Рекурсивная: считает глубину, на превышении — FLANG_RECURSION_LIMIT.
 * @param pervoe — «первое»: число
 * @param vtoroe — «второе»: число
 * @return значение: число
 */
fl_status declared_measure_at_the_boundary_nod(fl_ctx *ctx, fl_value pervoe, fl_value vtoroe, fl_value *result, fl_error *error) {
  FL_TRY(fl_enter(ctx, "НОД", error));
  {
    const fl_mark region = fl_region_open(ctx);
    const fl_status status = declared_measure_at_the_boundary_nod_body(ctx, pervoe, vtoroe, result, error);
    fl_leave(ctx);
    return fl_region_close(ctx, region, status, result, error);
  }
}

/*
 * Функция flang «объявленная мера убывает».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param shag — «шаг»: число
 * @param mera — «мера»: число
 * @param znachenie — «значение»: «Значение под сторожем»
 * @return значение: «Значение под сторожем»
 */
fl_status declared_measure_at_the_boundary_obyavlennaya_mera_ubyvaet(fl_ctx *ctx, fl_value shag, fl_value mera, fl_value znachenie, fl_value *result, fl_error *error) {
  const fl_value fl_t13 = znachenie;
  fl_value fl_t14 = fl_nothing();
  FL_TRY(fl_lt(ctx, shag, mera, &fl_t14, error));
  /* постусловие «объявленная мера убывает» */
  bool fl_t15 = false;
  FL_TRY(fl_post(ctx, fl_t14, "объявленная мера убывает", "объявленная мера убывает", &fl_t15, error));
  if (!fl_t15) {
    return fl_fail(ctx, error, "FLANG_MEASURE", "%s", "тотальная функция «НОД»: мера на вызове «НОД» — «второе» — не убыла. Завершение доказано тем, что она строго убывает; равенство цепочку не обрывает, а значит этот вызов может не кончиться никогда");
  }
  fl_value fl_t16 = fl_nothing();
  FL_TRY(fl_gte(ctx, shag, fl_number(0.0), &fl_t16, error));
  /* постусловие «объявленная мера убывает» */
  bool fl_t17 = false;
  FL_TRY(fl_post(ctx, fl_t16, "объявленная мера убывает", "объявленная мера убывает", &fl_t17, error));
  if (!fl_t17) {
    return fl_fail(ctx, error, "FLANG_MEASURE", "%s", "тотальная функция «НОД»: мера на вызове «НОД» — «второе» — ушла ниже нуля. Мера обязана оставаться неотрицательной: иначе цепочка уходит в минус бесконечность и убывание ничего не доказывает. Чаще всего это выбор меры, а не ошибка вызова — мере, которая на последнем витке становится −1, обычно не хватает «плюс 1»");
  }
  fl_value fl_t18 = fl_nothing();
  FL_TRY(fl_mod(ctx, shag, fl_number(1.0), &fl_t18, error));
  fl_value fl_t19 = fl_nothing();
  FL_TRY(fl_sub(ctx, shag, fl_t18, &fl_t19, error));
  /* постусловие «объявленная мера убывает» */
  bool fl_t20 = false;
  FL_TRY(fl_post(ctx, fl_flag(fl_equal(fl_t19, shag)), "объявленная мера убывает", "объявленная мера убывает", &fl_t20, error));
  if (!fl_t20) {
    return fl_fail(ctx, error, "FLANG_MEASURE", "%s", "тотальная функция «НОД»: мера на вызове «НОД» — «второе» — перестала быть целой. Целость — это то, чем мера вообще что-то доказывает: строго убывающая цепочка целых неотрицательных чисел не длиннее своего первого члена, а дробная не обрывается вовсе (0.618, 0.382, 0.236 … больше нуля всегда). Отказ здесь честнее зацикливания");
  }
  *result = fl_t13;
  return FL_OK;
}

/*
 * Вызов по исходному имени flang. Коды и тексты — те же, что у
 * интерпретатора: «не найдена функция …» и «функция … принимает N аргум.».
 */
fl_status declared_measure_at_the_boundary_call(fl_ctx *ctx, const char *name, const fl_value *args, size_t count,
                    fl_value *result, fl_error *error) {
  if (strcmp(name, "НОД") == 0) {
    if (count != 2) {
      return fl_fail(ctx, error, FL_CODE_TYPE, "функция «%s» принимает %lu аргум., получено %lu",
                     "НОД", (unsigned long)2, (unsigned long)count);
    }
    return declared_measure_at_the_boundary_nod(ctx, args[0], args[1], result, error);
  }
  if (strcmp(name, "объявленная мера убывает") == 0) {
    if (count != 3) {
      return fl_fail(ctx, error, FL_CODE_TYPE, "функция «%s» принимает %lu аргум., получено %lu",
                     "объявленная мера убывает", (unsigned long)3, (unsigned long)count);
    }
    return declared_measure_at_the_boundary_obyavlennaya_mera_ubyvaet(ctx, args[0], args[1], args[2], result, error);
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
fl_status declared_measure_at_the_boundary_enter(fl_ctx *ctx, const char *name, const fl_value *args, size_t count,
                    fl_value *result, fl_error *error) {
  FL_TRY(fl_check_entry(ctx, declared_measure_at_the_boundary_entry(), name, args, count, error));
  return declared_measure_at_the_boundary_call(ctx, name, args, count, result, error);
}

/*
 * Граница входа: объявленные типы параметров данными. Прогонщик сверяет по
 * ним значения, пришедшие снаружи, ДО вызова (fl_check_entry).
 *
 * Виды `неизвестно` (значение-функция, параметр полиморфизма, применение
 * типа с аргументами) не сверяются — ровно как молчит о них проверка
 * значений свидетеля.
 */
static const fl_type declared_measure_at_the_boundary_entry_types[] = {
  { FL_TYPE_NUMBER, "число", "", false, false, false, 0.0, 0.0, 0, 0, 0, 0, 0 },
};

static const fl_entry_param declared_measure_at_the_boundary_entry_params[] = {
  { "НОД", "первое", 0 },
  { "НОД", "второе", 0 },
};

static const fl_entry_table declared_measure_at_the_boundary_entry_table = {
  declared_measure_at_the_boundary_entry_types, 1,
  NULL, 0,
  NULL, 0,
  declared_measure_at_the_boundary_entry_params, 2
};

const fl_entry_table *declared_measure_at_the_boundary_entry(void) {
  return &declared_measure_at_the_boundary_entry_table;
}
