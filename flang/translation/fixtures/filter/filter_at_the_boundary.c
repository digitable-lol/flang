/*
 * Сгенерировано flang (бэкенд C, flang/self/emit-c.flang). Не редактировать руками.
 * Модуль flang: «Filter at the boundary».
 * Файл: реализация.
 * Правьте исходник на flang и печатайте заново: любая правка здесь потеряется.
 */
#include "filter_at_the_boundary.h"

#include <string.h>


/*
 * Функция flang «Только положительные».
 *
 * Тотальная: завершение доказано анализом завершаемости (totality.mjs).
 * @param elementy — «элементы»: список: число
 * @return значение: список: число
 */
fl_status filter_at_the_boundary_tolko_polozhitelnye(fl_ctx *ctx, fl_value elementy, fl_value *result, fl_error *error) {
  fl_value fl_t1 = fl_nothing();
  FL_TRY(fl_require_list(ctx, elementy, "отфильтровать", &fl_t1, error));
  fl_value *fl_t2 = NULL;
  size_t fl_t3 = 0;
  FL_TRY(fl_list_alloc(ctx, fl_t1.as.list.count, &fl_t2, error));
  for (size_t fl_t4 = 0; fl_t4 < fl_t1.as.list.count; fl_t4 += 1) {
    const fl_value el = fl_t1.as.list.items[fl_t4]; /* «эл» */
    if (el.tag != FL_NUMBER) FL_TRY(fl_not_order(ctx, el, fl_number(0.0), error));
    bool fl_t5 = false;
    FL_TRY(fl_keep(ctx, fl_flag(el.as.number > 0.0), &fl_t5, error));
    if (fl_t5) {
      fl_t2[fl_t3] = el;
      fl_t3 += 1;
    }
  }
  *result = fl_list(fl_t2, fl_t3);
  return FL_OK;
}

/*
 * Вызов по исходному имени flang. Коды и тексты — те же, что у
 * интерпретатора: «не найдена функция …» и «функция … принимает N аргум.».
 */
fl_status filter_at_the_boundary_call(fl_ctx *ctx, const char *name, const fl_value *args, size_t count,
                    fl_value *result, fl_error *error) {
  if (strcmp(name, "Только положительные") == 0) {
    if (count != 1) {
      return fl_fail(ctx, error, FL_CODE_TYPE, "функция «%s» принимает %lu аргум., получено %lu",
                     "Только положительные", (unsigned long)1, (unsigned long)count);
    }
    return filter_at_the_boundary_tolko_polozhitelnye(ctx, args[0], result, error);
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
fl_status filter_at_the_boundary_enter(fl_ctx *ctx, const char *name, const fl_value *args, size_t count,
                    fl_value *result, fl_error *error) {
  FL_TRY(fl_check_entry(ctx, filter_at_the_boundary_entry(), name, args, count, error));
  return filter_at_the_boundary_call(ctx, name, args, count, result, error);
}

/*
 * Граница входа: объявленные типы параметров данными. Прогонщик сверяет по
 * ним значения, пришедшие снаружи, ДО вызова (fl_check_entry).
 *
 * Виды `неизвестно` (значение-функция, параметр полиморфизма, применение
 * типа с аргументами) не сверяются — ровно как молчит о них проверка
 * значений свидетеля.
 */
static const fl_type filter_at_the_boundary_entry_types[] = {
  { FL_TYPE_LIST, "список числа", "", false, false, false, 0.0, 0.0, 1, 0, 0, 0, 0 },
  { FL_TYPE_NUMBER, "число", "", false, false, false, 0.0, 0.0, 0, 0, 0, 0, 0 },
};

static const fl_entry_param filter_at_the_boundary_entry_params[] = {
  { "Только положительные", "элементы", 0 },
};

static const fl_entry_table filter_at_the_boundary_entry_table = {
  filter_at_the_boundary_entry_types, 2,
  NULL, 0,
  NULL, 0,
  filter_at_the_boundary_entry_params, 1
};

const fl_entry_table *filter_at_the_boundary_entry(void) {
  return &filter_at_the_boundary_entry_table;
}
