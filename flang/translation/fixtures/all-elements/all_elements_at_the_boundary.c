/*
 * Сгенерировано flang (бэкенд C, flang/self/emit-c.flang). Не редактировать руками.
 * Модуль flang: «All elements at the boundary».
 * Файл: реализация.
 * Правьте исходник на flang и печатайте заново: любая правка здесь потеряется.
 */
#include "all_elements_at_the_boundary.h"

#include <string.h>


/*
 * Функция flang «Как есть».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param elementy — «элементы»: список: число
 * @return значение: список: число
 */
fl_status all_elements_at_the_boundary_kak_est(fl_ctx *ctx, fl_value elementy, fl_value *result, fl_error *error) {
  const fl_value fl_t1 = elementy;
  fl_value fl_t2 = fl_nothing();
  FL_TRY(fl_require_list(ctx, fl_t1, "свёртка", &fl_t2, error));
  bool fl_t3 = true; /* для всех «п» */
  for (size_t fl_t4 = 0; fl_t3 && fl_t4 < fl_t2.as.list.count; fl_t4 += 1) {
    const fl_value p = fl_t2.as.list.items[fl_t4]; /* «п» */
    if (p.tag != FL_NUMBER) FL_TRY(fl_not_order(ctx, p, fl_number(0.0), error));
    bool fl_t5 = false;
    FL_TRY(fl_cond(ctx, fl_flag(p.as.number > 0.0), &fl_t5, error));
    fl_t3 = fl_t5;
  }
  /* постусловие «все положительны» */
  bool fl_t6 = false;
  FL_TRY(fl_post(ctx, fl_flag(fl_t3), "все положительны", "Как есть", &fl_t6, error));
  if (!fl_t6) {
    return fl_fail(ctx, error, "FLANG_PROPERTY", "%s", "нарушено свойство «все положительны» функции «Как есть»");
  }
  *result = fl_t1;
  return FL_OK;
}

/*
 * Вызов по исходному имени flang. Коды и тексты — те же, что у
 * интерпретатора: «не найдена функция …» и «функция … принимает N аргум.».
 */
fl_status all_elements_at_the_boundary_call(fl_ctx *ctx, const char *name, const fl_value *args, size_t count,
                    fl_value *result, fl_error *error) {
  if (strcmp(name, "Как есть") == 0) {
    if (count != 1) {
      return fl_fail(ctx, error, FL_CODE_TYPE, "функция «%s» принимает %lu аргум., получено %lu",
                     "Как есть", (unsigned long)1, (unsigned long)count);
    }
    return all_elements_at_the_boundary_kak_est(ctx, args[0], result, error);
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
fl_status all_elements_at_the_boundary_enter(fl_ctx *ctx, const char *name, const fl_value *args, size_t count,
                    fl_value *result, fl_error *error) {
  FL_TRY(fl_check_entry(ctx, all_elements_at_the_boundary_entry(), name, args, count, error));
  return all_elements_at_the_boundary_call(ctx, name, args, count, result, error);
}

/*
 * Граница входа: объявленные типы параметров данными. Прогонщик сверяет по
 * ним значения, пришедшие снаружи, ДО вызова (fl_check_entry).
 *
 * Виды `неизвестно` (значение-функция, параметр полиморфизма, применение
 * типа с аргументами) не сверяются — ровно как молчит о них проверка
 * значений свидетеля.
 */
static const fl_type all_elements_at_the_boundary_entry_types[] = {
  { FL_TYPE_LIST, "список числа", "", false, false, false, 0.0, 0.0, 1, 0, 0, 0, 0 },
  { FL_TYPE_NUMBER, "число", "", false, false, false, 0.0, 0.0, 0, 0, 0, 0, 0 },
};

static const fl_entry_param all_elements_at_the_boundary_entry_params[] = {
  { "Как есть", "элементы", 0 },
};

static const fl_entry_table all_elements_at_the_boundary_entry_table = {
  all_elements_at_the_boundary_entry_types, 2,
  NULL, 0,
  NULL, 0,
  all_elements_at_the_boundary_entry_params, 1
};

const fl_entry_table *all_elements_at_the_boundary_entry(void) {
  return &all_elements_at_the_boundary_entry_table;
}
