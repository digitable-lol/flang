/*
 * Планировщик конкурентности flang для бэкенда C — реализация.
 *
 * Читать вместе с `flang/src/conc.mjs`: это тот же планировщик, переписанный на
 * C. «Тот же» здесь не оборот речи, а проверяемое утверждение — на одном семени
 * оба обязаны выдать побайтово один журнал доставок, и это сверяется тестом
 * (`flang/test/emit-c-conc.test.mjs`). Поэтому всякое расхождение в порядке
 * действий ниже — ошибка, даже если оно выглядит безобидным.
 *
 * Порядок объявления процессов — единственный порядок, в котором они
 * перечисляются где бы то ни было: очередь готовых, итоговые состояния, отчёт.
 * Один порядок на всё — условие того, чтобы журнал зависел от семени и больше
 * ни от чего.
 */
#include "flang_conc.h"

#include <math.h>
#include <stdint.h>
#include <string.h>

/*
 * Запас витков тотального обработчика: завершение доказано, предел формален.
 * Число то же, что у эталона (TOTAL_HANDLER_STEPS в conc.mjs), и взято отсюда,
 * а не из FL_MAX_STEPS программы: FL_MAX_STEPS настраивается ключом печати, а
 * сверка с эталоном обязана держаться при любых настройках.
 */
#define FL_CONC_TOTAL_STEPS 1000000

/** Нормальная причина остановки: она одна на всю модель — как `exit(:normal)`. */
static const char *const FL_CONC_NORMAL = "норма";

/* ───────────────────────────── генератор чередований ─────────────────────────────
   mulberry32 — тот же, что в `makeRandom` эталона. Выбран не за качество
   распределения (оно здесь ни на что не влияет), а за то, что укладывается в
   шесть строк целочисленной арифметики и потому повторяется где угодно один в
   один. Здесь это ровно та выгода, ради которой он и выбирался. */

static uint32_t fl_conc_imul(uint32_t left, uint32_t right) {
  /* Math.imul — умножение по модулю 2³²; беззнаковое умножение uint32_t в C
     даёт те же младшие 32 бита, и знак результата на них не влияет. */
  return (uint32_t)(left * right);
}

/** ToUint32 из ECMAScript: `Math.trunc(seed) >>> 0`, и 0 заменяется золотым. */
static uint32_t fl_conc_seed(double seed) {
  double whole = 0.0;
  uint32_t state = 0;
  if (seed != seed || seed == HUGE_VAL || seed == -HUGE_VAL) {
    return 0x9e3779b9u;
  }
  whole = fmod(trunc(seed), 4294967296.0);
  if (whole < 0.0) {
    whole += 4294967296.0;
  }
  state = (uint32_t)whole;
  return state == 0u ? 0x9e3779b9u : state;
}

static double fl_conc_random(uint32_t *state) {
  uint32_t t = 0;
  *state = *state + 0x6d2b79f5u;
  t = *state;
  t = fl_conc_imul(t ^ (t >> 15), t | 1u);
  t ^= t + fl_conc_imul(t ^ (t >> 7), t | 61u);
  return (double)(t ^ (t >> 14)) / 4294967296.0;
}

/* ───────────────────────────── растущие массивы ─────────────────────────────
   Арена ничего не отдаёт до конца вызова, поэтому рост — это «выделить вдвое и
   скопировать», а старое остаётся лежать. Для журнала прогона это ровно та
   сделка, которая нужна: пробегов тысячи, а не миллиарды, зато освобождать
   нечего и утечь неоткуда. */

static void *fl_conc_grow(fl_ctx *ctx, void *items, size_t used, size_t *capacity, size_t size) {
  const size_t next = *capacity == 0 ? 8 : *capacity * 2;
  void *bigger = fl_arena_alloc(ctx->arena, next * size);
  if (bigger == NULL) {
    return NULL;
  }
  if (used > 0) {
    memcpy(bigger, items, used * size);
  }
  *capacity = next;
  return bigger;
}

/* ───────────────────────────── почтовый ящик ─────────────────────────────
   Кольцо, а не список: ящику нужны три движения — снять с головы, положить в
   хвост («отправить», «отложить») и вернуть в голову («продолжить»), — и все
   три обязаны стоить одинаково. Список дал бы то же самое ценой указателя на
   каждое сообщение; кольцо обходится одним массивом. */

typedef struct fl_conc_box {
  fl_value *items;
  size_t capacity;
  size_t head;
  size_t count;
} fl_conc_box;

static bool fl_conc_box_grow(fl_ctx *ctx, fl_conc_box *box) {
  const size_t next = box->capacity == 0 ? 8 : box->capacity * 2;
  fl_value *items = (fl_value *)fl_arena_alloc(ctx->arena, next * sizeof(fl_value));
  size_t index = 0;
  if (items == NULL) {
    return false;
  }
  for (index = 0; index < box->count; index += 1) {
    items[index] = box->items[(box->head + index) % box->capacity];
  }
  box->items = items;
  box->capacity = next;
  box->head = 0;
  return true;
}

static bool fl_conc_box_push(fl_ctx *ctx, fl_conc_box *box, fl_value value, bool front) {
  if (box->count == box->capacity && !fl_conc_box_grow(ctx, box)) {
    return false;
  }
  if (front) {
    box->head = (box->head + box->capacity - 1) % box->capacity;
    box->items[box->head] = value;
  } else {
    box->items[(box->head + box->count) % box->capacity] = value;
  }
  box->count += 1;
  return true;
}

static fl_value fl_conc_box_shift(fl_conc_box *box) {
  const fl_value value = box->items[box->head];
  box->head = (box->head + 1) % box->capacity;
  box->count -= 1;
  return value;
}

/* ───────────────────────────── состояние прогона ───────────────────────────── */

typedef struct fl_conc_slot {
  fl_value initial; /* вычислено ОДИН раз: перезапуск обязан вернуть то же самое */
  fl_value current;
  bool alive;
  fl_conc_box box;
} fl_conc_slot;

typedef struct fl_conc_timer {
  double time;
  size_t target; /* индекс процесса; SIZE_MAX — адресат неизвестен, письмо пропадёт */
  fl_value message;
} fl_conc_timer;

/** Кто над кем: индекс надзора и стратегия за этим ребёнком. */
typedef struct fl_conc_link {
  size_t supervisor; /* SIZE_MAX — надзора нет */
  const char *strategy;
} fl_conc_link;

typedef struct fl_conc_sched {
  fl_ctx *ctx;
  const fl_conc_plan *plan;
  fl_conc_slot *slots;

  /* Очередь готовых: индексы процессов ПО ВОЗРАСТАНИЮ, то есть в порядке
     объявления. Держится списком, а не пересобирается перебором всех процессов
     на каждом пробеге, как у эталона: содержимое то же самое, стоимость
     O(готовых) вместо O(объявленных). */
  size_t *ready;
  bool *is_ready;
  size_t ready_count;

  fl_conc_entry *journal;
  size_t journal_count;
  size_t journal_capacity;

  fl_conc_failure *failures;
  size_t failure_count;
  size_t failure_capacity;

  fl_conc_decision *decisions;
  size_t decision_count;
  size_t decision_capacity;

  fl_conc_timer *timers;
  size_t timer_count;
  size_t timer_capacity;

  /* Скользящее окно порога отказов — по надзору. */
  double **windows;
  size_t *window_count;
  size_t *window_capacity;

  fl_conc_link *over_process;
  fl_conc_link *over_supervisor;
  bool *passed; /* защита от круга в надзоре: по надзору на один отказ */

  double time;
  size_t turns;
  uint32_t random;
} fl_conc_sched;

/* ───────────────────────────── поиск по имени ───────────────────────────── */

size_t fl_conc_find(const fl_conc_plan *plan, const char *name) {
  size_t index = 0;
  if (plan == NULL || name == NULL) {
    return SIZE_MAX;
  }
  for (index = 0; index < plan->process_count; index += 1) {
    if (strcmp(plan->processes[index].name, name) == 0) {
      return index;
    }
  }
  return SIZE_MAX;
}

static size_t fl_conc_find_supervisor(const fl_conc_plan *plan, const char *name) {
  size_t index = 0;
  if (name == NULL) {
    return SIZE_MAX;
  }
  for (index = 0; index < plan->supervisor_count; index += 1) {
    if (strcmp(plan->supervisors[index].name, name) == 0) {
      return index;
    }
  }
  return SIZE_MAX;
}

/**
 * Адресат «отправить» — значение-строка, а строка в рантайме может быть срезом
 * и не заканчиваться нулём. Поэтому сравнение по длине и байтам, а не strcmp.
 */
static size_t fl_conc_address(const fl_conc_plan *plan, fl_value name) {
  size_t index = 0;
  if (name.tag != FL_STRING) {
    return SIZE_MAX;
  }
  for (index = 0; index < plan->process_count; index += 1) {
    const char *candidate = plan->processes[index].name;
    const size_t bytes = strlen(candidate);
    if (bytes == name.as.string.bytes && memcmp(candidate, name.as.string.utf8, bytes) == 0) {
      return index;
    }
  }
  return SIZE_MAX;
}

/** Копия строки-значения в арену с нулём на конце: для журнала и диагностик. */
static const char *fl_conc_cstring(fl_ctx *ctx, fl_value value) {
  char *text = NULL;
  if (value.tag != FL_STRING) {
    return "";
  }
  text = (char *)fl_arena_alloc(ctx->arena, value.as.string.bytes + 1);
  if (text == NULL) {
    return "";
  }
  memcpy(text, value.as.string.utf8, value.as.string.bytes);
  text[value.as.string.bytes] = '\0';
  return text;
}

/* ───────────────────────────── очередь готовых ─────────────────────────────
   Наименьшая позиция, на которую можно вставить индекс, не нарушив порядка.
   Двоичный поиск, потому что список отсортирован всегда: это его инвариант, а
   не удача. */

static size_t fl_conc_lower(const size_t *ready, size_t count, size_t value) {
  size_t low = 0;
  size_t high = count;
  while (low < high) {
    const size_t middle = low + ((high - low) / 2);
    if (ready[middle] < value) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
}

/**
 * Привести очередь готовых в согласие с процессом: готов он тогда и только
 * тогда, когда жив и в ящике что-то есть. Зовётся после КАЖДОГО изменения
 * жизни или ящика — пропуск такого вызова означал бы, что журнал зависит не
 * только от семени, а это и есть та единственная ошибка, которой здесь нельзя.
 */
static void fl_conc_refresh(fl_conc_sched *sched, size_t index) {
  const bool wanted = sched->slots[index].alive && sched->slots[index].box.count > 0;
  size_t at = 0;
  if (wanted == sched->is_ready[index]) {
    return;
  }
  at = fl_conc_lower(sched->ready, sched->ready_count, index);
  if (wanted) {
    memmove(sched->ready + at + 1, sched->ready + at, (sched->ready_count - at) * sizeof(size_t));
    sched->ready[at] = index;
    sched->ready_count += 1;
  } else {
    memmove(sched->ready + at, sched->ready + at + 1, (sched->ready_count - at - 1) * sizeof(size_t));
    sched->ready_count -= 1;
  }
  sched->is_ready[index] = wanted;
}

/**
 * Положить сообщение в ящик. Мёртвому процессу писать некуда, и это не ошибка
 * отправителя: он не обязан знать, что адресат остановился, — ровно так же, как
 * в BEAM.
 */
static bool fl_conc_deliver(fl_conc_sched *sched, size_t target, fl_value message, bool front) {
  if (target == SIZE_MAX || !sched->slots[target].alive) {
    return true;
  }
  if (!fl_conc_box_push(sched->ctx, &sched->slots[target].box, message, front)) {
    return false;
  }
  fl_conc_refresh(sched, target);
  return true;
}

/* ───────────────────────────── чтение отклика ─────────────────────────────
   Отклик — запись из нового состояния и списка действий. Имена полей — часть
   контракта модели, а не соглашение файла. */

static bool fl_conc_field(fl_value record, const char *name, fl_value *out) {
  size_t index = 0;
  if (record.tag != FL_RECORD) {
    return false;
  }
  for (index = 0; index < record.as.record->count; index += 1) {
    if (strcmp(record.as.record->fields[index].name, name) == 0) {
      *out = record.as.record->fields[index].value;
      return true;
    }
  }
  return false;
}

static bool fl_conc_variant_field(fl_value value, const char *name, fl_value *out) {
  size_t index = 0;
  if (value.tag != FL_VARIANT) {
    return false;
  }
  for (index = 0; index < value.as.variant->count; index += 1) {
    if (strcmp(value.as.variant->fields[index].name, name) == 0) {
      *out = value.as.variant->fields[index].value;
      return true;
    }
  }
  return false;
}

/** Известные действия — те же пять, что вводит язык суммой «Действие». */
static bool fl_conc_known_action(const char *name) {
  return strcmp(name, "отправить") == 0 || strcmp(name, "через") == 0 ||
         strcmp(name, "остановить") == 0 || strcmp(name, "отложить") == 0 ||
         strcmp(name, "продолжить") == 0;
}

/**
 * Разобрать отклик; FL_ERROR — отклик не той формы, и тогда `broken` заполнен
 * текстом. Тексты дословно те же, что у эталона: расхождение здесь ничем не
 * лучше расхождения в чередовании.
 *
 * Текст строится через `fl_fail` с местной `fl_error`, а не своим форматтером:
 * форматтер рантайма уже кладёт строку в арену и уже умеет считать длину, и
 * второй такой же рядом разошёлся бы с ним на первом же `%s`.
 */
static fl_status fl_conc_read_response(fl_ctx *ctx, fl_value response, const char *handler, fl_value *state,
                                       fl_value *actions, fl_error *broken) {
  size_t index = 0;
  if (response.tag != FL_RECORD) {
    return fl_fail(ctx, broken, "FLANG_PROCESS", "обработчик «%s» вернул не запись отклика", handler);
  }
  if (!fl_conc_field(response, "состояние", state)) {
    return fl_fail(ctx, broken, "FLANG_PROCESS", "отклик обработчика «%s» не содержит поле «состояние»",
                   handler);
  }
  if (!fl_conc_field(response, "действия", actions) || actions->tag != FL_LIST) {
    return fl_fail(ctx, broken, "FLANG_PROCESS",
                   "поле «действия» отклика обработчика «%s» должно быть списком действий", handler);
  }
  for (index = 0; index < actions->as.list.count; index += 1) {
    const fl_value action = actions->as.list.items[index];
    if (action.tag != FL_VARIANT) {
      return fl_fail(ctx, broken, "FLANG_PROCESS", "в списке «действия» обработчика «%s» не действие",
                     handler);
    }
    if (!fl_conc_known_action(action.as.variant->name)) {
      return fl_fail(ctx, broken, "FLANG_PROCESS", "неизвестное действие «%s» в отклике обработчика «%s»",
                     action.as.variant->name, handler);
    }
  }
  return FL_OK;
}

/* ───────────────────────────── надзор ─────────────────────────────
   Дерево строится один раз на прогон и дальше только читается — тем же
   правилом «первое объявление выигрывает», что у эталона. */

static void fl_conc_build_tree(fl_conc_sched *sched) {
  const fl_conc_plan *plan = sched->plan;
  size_t index = 0;
  size_t child = 0;
  for (index = 0; index < plan->process_count; index += 1) {
    sched->over_process[index].supervisor = SIZE_MAX;
    sched->over_process[index].strategy = NULL;
  }
  for (index = 0; index < plan->supervisor_count; index += 1) {
    sched->over_supervisor[index].supervisor = SIZE_MAX;
    sched->over_supervisor[index].strategy = NULL;
  }
  for (index = 0; index < plan->supervisor_count; index += 1) {
    const fl_conc_supervisor *node = &plan->supervisors[index];
    for (child = 0; child < node->watch_count; child += 1) {
      const size_t process = fl_conc_find(plan, node->watch[child].name);
      if (process == SIZE_MAX || sched->over_process[process].supervisor != SIZE_MAX) {
        continue;
      }
      sched->over_process[process].supervisor = index;
      sched->over_process[process].strategy = node->watch[child].strategy;
    }
    for (child = 0; child < node->nested_count; child += 1) {
      const size_t nested = fl_conc_find_supervisor(plan, node->nested[child].name);
      if (nested == SIZE_MAX || nested == index || sched->over_supervisor[nested].supervisor != SIZE_MAX) {
        continue;
      }
      sched->over_supervisor[nested].supervisor = index;
      sched->over_supervisor[nested].strategy = node->nested[child].strategy;
    }
  }
}

/**
 * Поддерево надзора — процессы в порядке объявления, сначала свои, потом чужие
 * через вложенные надзоры. Порядок здесь важен так же, как везде: по нему идут
 * записи в журнале решений.
 */
static void fl_conc_subtree(fl_conc_sched *sched, size_t supervisor, bool *seen, size_t *out, size_t *count) {
  const fl_conc_plan *plan = sched->plan;
  const fl_conc_supervisor *node = NULL;
  size_t index = 0;
  size_t other = 0;
  if (supervisor == SIZE_MAX || seen[supervisor]) {
    return;
  }
  seen[supervisor] = true;
  node = &plan->supervisors[supervisor];
  for (index = 0; index < node->watch_count; index += 1) {
    const size_t process = fl_conc_find(plan, node->watch[index].name);
    bool have = false;
    if (process == SIZE_MAX) {
      continue;
    }
    for (other = 0; other < *count; other += 1) {
      if (out[other] == process) {
        have = true;
        break;
      }
    }
    if (!have) {
      out[*count] = process;
      *count += 1;
    }
  }
  for (index = 0; index < node->nested_count; index += 1) {
    fl_conc_subtree(sched, fl_conc_find_supervisor(plan, node->nested[index].name), seen, out, count);
  }
}

/**
 * Порог отказов по виртуальному времени. Окно скользящее: отказы старше
 * `когда − окно` в счёт не идут, потому что «три отказа за час» и «три отказа
 * за всю жизнь» — разные утверждения.
 */
static const char *fl_conc_threshold(fl_conc_sched *sched, size_t supervisor, const char *base, double when) {
  const fl_conc_supervisor *node = &sched->plan->supervisors[supervisor];
  size_t kept = 0;
  size_t index = 0;
  if (!node->threshold) {
    return base;
  }
  for (index = 0; index < sched->window_count[supervisor]; index += 1) {
    if (sched->windows[supervisor][index] > when - node->window) {
      sched->windows[supervisor][kept] = sched->windows[supervisor][index];
      kept += 1;
    }
  }
  sched->window_count[supervisor] = kept;
  if (kept == sched->window_capacity[supervisor]) {
    double *bigger = (double *)fl_conc_grow(sched->ctx, sched->windows[supervisor], kept,
                                            &sched->window_capacity[supervisor], sizeof(double));
    if (bigger == NULL) {
      return base;
    }
    sched->windows[supervisor] = bigger;
  }
  sched->windows[supervisor][kept] = when;
  sched->window_count[supervisor] = kept + 1;
  return (double)sched->window_count[supervisor] > node->failures ? node->otherwise : base;
}

static bool fl_conc_decide(fl_conc_sched *sched, double when, size_t process, const char *supervisor,
                           const char *strategy, const char *code) {
  if (sched->decision_count == sched->decision_capacity) {
    fl_conc_decision *bigger = (fl_conc_decision *)fl_conc_grow(
      sched->ctx, sched->decisions, sched->decision_count, &sched->decision_capacity,
      sizeof(fl_conc_decision));
    if (bigger == NULL) {
      return false;
    }
    sched->decisions = bigger;
  }
  sched->decisions[sched->decision_count].time = when;
  sched->decisions[sched->decision_count].process = process;
  sched->decisions[sched->decision_count].supervisor = supervisor;
  sched->decisions[sched->decision_count].strategy = strategy;
  sched->decisions[sched->decision_count].code = code;
  sched->decision_count += 1;
  return true;
}

static void fl_conc_restart(fl_conc_sched *sched, size_t index) {
  sched->slots[index].current = sched->slots[index].initial;
  sched->slots[index].alive = true;
  fl_conc_refresh(sched, index);
}

static void fl_conc_stop(fl_conc_sched *sched, size_t index) {
  sched->slots[index].alive = false;
  fl_conc_refresh(sched, index);
}

/**
 * Отказ дошёл до надзора: кто решает и что из этого вышло. `escalated` значит,
 * что «передать выше» упёрлось в надзор, над которым никого нет, — тогда
 * останавливается вся программа.
 */
static bool fl_conc_supervise(fl_conc_sched *sched, size_t failed, const char *code, double when,
                              bool *escalated, size_t *subtree, bool *seen) {
  const fl_conc_plan *plan = sched->plan;
  bool over_supervisor = false;
  size_t target = failed;
  size_t index = 0;
  *escalated = false;
  for (index = 0; index < plan->supervisor_count; index += 1) {
    sched->passed[index] = false;
  }
  for (;;) {
    const fl_conc_link link = over_supervisor ? sched->over_supervisor[target] : sched->over_process[target];
    const char *strategy = NULL;
    size_t count = 0;
    if (link.supervisor == SIZE_MAX) {
      /* Процесс без надзора остаётся остановленным. Надзор, над которым никого
         нет, — конец программы: отказ обязан кончиться исходом, а не тем, что о
         нём забыли. */
      *escalated = over_supervisor;
      return true;
    }
    /* Круг в надзоре проверка типов отвергает; здесь — защита на случай, если
       планировщик позвали на неразобранном плане: круг обязан кончиться
       исходом, а не вечным циклом. */
    if (sched->passed[link.supervisor]) {
      *escalated = true;
      return true;
    }
    sched->passed[link.supervisor] = true;
    strategy = fl_conc_threshold(sched, link.supervisor, link.strategy, when);
    if (strcmp(strategy, "передать выше") == 0) {
      if (!fl_conc_decide(sched, when, failed, plan->supervisors[link.supervisor].name, strategy, code)) {
        return false;
      }
      over_supervisor = true;
      target = link.supervisor;
      continue;
    }
    if (over_supervisor) {
      for (index = 0; index < plan->supervisor_count; index += 1) {
        seen[index] = false;
      }
      fl_conc_subtree(sched, target, seen, subtree, &count);
    } else {
      subtree[0] = target;
      count = 1;
    }
    for (index = 0; index < count; index += 1) {
      if (!fl_conc_decide(sched, when, subtree[index], plan->supervisors[link.supervisor].name, strategy,
                          code)) {
        return false;
      }
      if (strcmp(strategy, "перезапустить") == 0) {
        fl_conc_restart(sched, subtree[index]);
      } else {
        fl_conc_stop(sched, subtree[index]);
      }
    }
    return true;
  }
}

/* ───────────────────────────── прогон ───────────────────────────── */

static bool fl_conc_record(fl_conc_sched *sched, double when, size_t process, fl_value message) {
  if (sched->journal_count == sched->journal_capacity) {
    fl_conc_entry *bigger = (fl_conc_entry *)fl_conc_grow(sched->ctx, sched->journal, sched->journal_count,
                                                          &sched->journal_capacity, sizeof(fl_conc_entry));
    if (bigger == NULL) {
      return false;
    }
    sched->journal = bigger;
  }
  sched->journal[sched->journal_count].time = when;
  sched->journal[sched->journal_count].process = process;
  sched->journal[sched->journal_count].outcome = "обработано";
  sched->journal[sched->journal_count].code = NULL;
  sched->journal[sched->journal_count].reason = NULL;
  sched->journal[sched->journal_count].message = message;
  sched->journal_count += 1;
  return true;
}

static bool fl_conc_note_failure(fl_conc_sched *sched, size_t process, const char *code, const char *reason,
                                 double when) {
  if (sched->failure_count == sched->failure_capacity) {
    fl_conc_failure *bigger = (fl_conc_failure *)fl_conc_grow(
      sched->ctx, sched->failures, sched->failure_count, &sched->failure_capacity, sizeof(fl_conc_failure));
    if (bigger == NULL) {
      return false;
    }
    sched->failures = bigger;
  }
  sched->failures[sched->failure_count].process = process;
  sched->failures[sched->failure_count].code = code;
  sched->failures[sched->failure_count].reason = reason;
  sched->failures[sched->failure_count].time = when;
  sched->failure_count += 1;
  return true;
}

static bool fl_conc_timer_push(fl_conc_sched *sched, double when, size_t target, fl_value message) {
  if (sched->timer_count == sched->timer_capacity) {
    fl_conc_timer *bigger = (fl_conc_timer *)fl_conc_grow(sched->ctx, sched->timers, sched->timer_count,
                                                          &sched->timer_capacity, sizeof(fl_conc_timer));
    if (bigger == NULL) {
      return false;
    }
    sched->timers = bigger;
  }
  sched->timers[sched->timer_count].time = when;
  sched->timers[sched->timer_count].target = target;
  sched->timers[sched->timer_count].message = message;
  sched->timer_count += 1;
  return true;
}

/** Выдать все таймеры, чей срок наступил. Порядок при равном сроке — порядок
    постановки: два таймера на одно время не соревнуются. */
static bool fl_conc_fire_timers(fl_conc_sched *sched) {
  size_t index = 0;
  while (index < sched->timer_count) {
    fl_conc_timer timer;
    if (sched->timers[index].time > sched->time) {
      index += 1;
      continue;
    }
    timer = sched->timers[index];
    memmove(sched->timers + index, sched->timers + index + 1,
            (sched->timer_count - index - 1) * sizeof(fl_conc_timer));
    sched->timer_count -= 1;
    if (!fl_conc_deliver(sched, timer.target, timer.message, false)) {
      return false;
    }
  }
  return true;
}

static fl_status fl_conc_memory(fl_ctx *ctx, fl_error *error) {
  return fl_fail(ctx, error, FL_CODE_MEMORY, "кончилась память в планировщике конкурентности");
}

fl_status fl_conc_run(fl_ctx *ctx, const fl_conc_plan *plan, const char *run, double seed, size_t max_turns,
                      fl_conc_result *out, fl_error *error) {
  fl_conc_sched sched;
  const fl_conc_run_spec *spec = NULL;
  fl_value *inbox = NULL;
  size_t *subtree = NULL;
  bool *seen = NULL;
  fl_value *states = NULL;
  bool *alive = NULL;
  const char *outcome = "покой";
  size_t index = 0;

  if (ctx == NULL || plan == NULL || out == NULL) {
    return FL_INVALID_ARGUMENT;
  }
  if (plan->process_count == 0) {
    return fl_fail(ctx, error, "FLANG_PROCESS", "в программе нет ни одного процесса: прогонять нечего");
  }
  for (index = 0; index < plan->run_count; index += 1) {
    if (strcmp(plan->runs[index].name, run) == 0) {
      spec = &plan->runs[index];
      break;
    }
  }
  if (spec == NULL) {
    return fl_fail(ctx, error, "FLANG_PROCESS", "нет прогона «%s»", run);
  }

  memset(&sched, 0, sizeof(sched));
  sched.ctx = ctx;
  sched.plan = plan;
  sched.random = fl_conc_seed(seed);
  sched.slots = (fl_conc_slot *)fl_arena_alloc(ctx->arena, plan->process_count * sizeof(fl_conc_slot));
  sched.ready = (size_t *)fl_arena_alloc(ctx->arena, plan->process_count * sizeof(size_t));
  sched.is_ready = (bool *)fl_arena_alloc(ctx->arena, plan->process_count * sizeof(bool));
  sched.over_process = (fl_conc_link *)fl_arena_alloc(ctx->arena, plan->process_count * sizeof(fl_conc_link));
  subtree = (size_t *)fl_arena_alloc(ctx->arena, plan->process_count * sizeof(size_t));
  states = (fl_value *)fl_arena_alloc(ctx->arena, plan->process_count * sizeof(fl_value));
  alive = (bool *)fl_arena_alloc(ctx->arena, plan->process_count * sizeof(bool));
  if (sched.slots == NULL || sched.ready == NULL || sched.is_ready == NULL || sched.over_process == NULL ||
      subtree == NULL || states == NULL || alive == NULL) {
    return fl_conc_memory(ctx, error);
  }
  /* Надзоров может не быть вовсе, а `fl_arena_alloc(…, 0)` — не то, о чём стоит
     договариваться: пустой план обходится без выделения. */
  if (plan->supervisor_count > 0) {
    sched.over_supervisor =
      (fl_conc_link *)fl_arena_alloc(ctx->arena, plan->supervisor_count * sizeof(fl_conc_link));
    sched.passed = (bool *)fl_arena_alloc(ctx->arena, plan->supervisor_count * sizeof(bool));
    sched.windows = (double **)fl_arena_alloc(ctx->arena, plan->supervisor_count * sizeof(double *));
    sched.window_count = (size_t *)fl_arena_alloc(ctx->arena, plan->supervisor_count * sizeof(size_t));
    sched.window_capacity = (size_t *)fl_arena_alloc(ctx->arena, plan->supervisor_count * sizeof(size_t));
    seen = (bool *)fl_arena_alloc(ctx->arena, plan->supervisor_count * sizeof(bool));
    if (sched.over_supervisor == NULL || sched.passed == NULL || sched.windows == NULL ||
        sched.window_count == NULL || sched.window_capacity == NULL || seen == NULL) {
      return fl_conc_memory(ctx, error);
    }
    for (index = 0; index < plan->supervisor_count; index += 1) {
      sched.windows[index] = NULL;
      sched.window_count[index] = 0;
      sched.window_capacity[index] = 0;
    }
  }

  /* Начальное состояние вычисляется РОВНО ОДИН РАЗ. Функция без параметров
     чиста, поэтому пересчёт дал бы то же значение; но храня его, мы делаем
     обещание контракта буквальным: перезапуск возвращает не «такое же», а то же
     самое значение, что было при первом запуске. */
  for (index = 0; index < plan->process_count; index += 1) {
    fl_value initial = fl_nothing();
    FL_TRY(plan->call(ctx, plan->processes[index].initial, NULL, 0, &initial, error));
    sched.slots[index].initial = initial;
    sched.slots[index].current = initial;
    sched.slots[index].alive = true;
    sched.slots[index].box.items = NULL;
    sched.slots[index].box.capacity = 0;
    sched.slots[index].box.head = 0;
    sched.slots[index].box.count = 0;
    sched.is_ready[index] = false;
  }
  fl_conc_build_tree(&sched);

  /* Входные сообщения прогона лежат в ящиках ДО первого выбора планировщика:
     так же, как у эталона, где «дано» кладётся в ящик, а не доставляется. */
  if (spec->count > 0) {
    inbox = (fl_value *)fl_arena_alloc(ctx->arena, spec->count * sizeof(fl_value));
    if (inbox == NULL) {
      return fl_conc_memory(ctx, error);
    }
    FL_TRY(spec->build(ctx, inbox, error));
    for (index = 0; index < spec->count; index += 1) {
      if (!fl_conc_deliver(&sched, fl_conc_find(plan, spec->targets[index]), inbox[index], false)) {
        return fl_conc_memory(ctx, error);
      }
    }
  }

  if (max_turns == 0) {
    max_turns = FL_CONC_MAX_TURNS;
  }

  for (;;) {
    size_t chosen = 0;
    size_t process = 0;
    fl_value message = fl_nothing();
    fl_value response = fl_nothing();
    fl_value state = fl_nothing();
    fl_value actions = fl_list(NULL, 0);
    fl_conc_entry *entry = NULL;
    fl_error inner;
    fl_status status = FL_OK;
    const char *failed = NULL;
    const char *reason = NULL;
    const fl_conc_process *node = NULL;
    size_t saved_steps = 0;
    size_t saved_max_steps = 0;
    size_t saved_depth = 0;
    fl_value args[2];

    if (!fl_conc_fire_timers(&sched)) {
      return fl_conc_memory(ctx, error);
    }
    if (sched.ready_count == 0) {
      double due = 0.0;
      bool found = false;
      for (index = 0; index < sched.timer_count; index += 1) {
        if (!found || sched.timers[index].time < due) {
          due = sched.timers[index].time;
          found = true;
        }
      }
      if (!found) {
        break;
      }
      /* Тишина: скачок сразу к ближайшему сроку. Таймер на пять секунд в
         проверке не ждёт пяти секунд — он ждёт, когда планировщику станет
         нечего делать. */
      if (due > sched.time) {
        sched.time = due;
      }
      continue;
    }
    if (sched.turns >= max_turns) {
      outcome = "предел пробегов";
      break;
    }

    /* Единственное место, где решает семя. Всё остальное определено. */
    chosen = (size_t)floor(fl_conc_random(&sched.random) * (double)sched.ready_count);
    if (chosen >= sched.ready_count) {
      chosen = sched.ready_count - 1;
    }
    process = sched.ready[chosen];
    node = &plan->processes[process];
    message = fl_conc_box_shift(&sched.slots[process].box);
    fl_conc_refresh(&sched, process);
    sched.turns += 1;
    if (!fl_conc_record(&sched, sched.time, process, message)) {
      return fl_conc_memory(ctx, error);
    }
    entry = &sched.journal[sched.journal_count - 1];

    inner.code = NULL;
    inner.message = NULL;
    args[0] = sched.slots[process].current;
    args[1] = message;
    saved_steps = ctx->steps;
    saved_max_steps = ctx->max_steps;
    saved_depth = ctx->depth;
    ctx->steps = 0;
    ctx->depth = 0;
    ctx->max_steps = node->total || node->budget == 0 ? FL_CONC_TOTAL_STEPS : node->budget;
    status = plan->call(ctx, node->handler, args, 2, &response, &inner);
    ctx->steps = saved_steps;
    ctx->max_steps = saved_max_steps;
    ctx->depth = saved_depth;

    if (status != FL_OK) {
      /* Исчерпание запаса — определённый исход, а не зависание и не молчаливый
         обрыв: сообщение отвергнуто, процесс упал, дальше решает надзор. */
      const bool budget = !node->total && inner.code != NULL &&
                          strcmp(inner.code, FL_CODE_RECURSION_LIMIT) == 0;
      failed = budget ? "FLANG_BUDGET_EXHAUSTED" : (inner.code == NULL ? "FLANG_INTERNAL" : inner.code);
      reason = inner.message == NULL ? "" : inner.message;
      entry->outcome = budget ? "запас исчерпан" : "отказ";
    } else if (fl_conc_read_response(ctx, response, node->handler, &state, &actions, &inner) != FL_OK) {
      failed = "FLANG_PROCESS";
      reason = inner.message == NULL ? "" : inner.message;
      entry->outcome = "отказ";
    }

    if (failed == NULL) {
      size_t action = 0;
      sched.slots[process].current = state;
      /* Пробег обработчика стоит единицу виртуального времени. Без этого правила
         таймер не сработал бы никогда в программе, которой всё время есть чем
         заняться, — например, в той, что откладывает сообщения по кругу. */
      sched.time += 1.0;
      for (action = 0; action < actions.as.list.count; action += 1) {
        const fl_value item = actions.as.list.items[action];
        const char *kind = item.as.variant->name;
        fl_value to = fl_nothing();
        fl_value what = fl_nothing();
        fl_value delay = fl_nothing();
        if (strcmp(kind, "отправить") == 0) {
          fl_conc_variant_field(item, "кому", &to);
          fl_conc_variant_field(item, "что", &what);
          if (!fl_conc_deliver(&sched, fl_conc_address(plan, to), what, false)) {
            return fl_conc_memory(ctx, error);
          }
          continue;
        }
        if (strcmp(kind, "через") == 0) {
          fl_conc_variant_field(item, "задержка", &delay);
          fl_conc_variant_field(item, "кому", &to);
          fl_conc_variant_field(item, "что", &what);
          if (!fl_conc_timer_push(&sched, sched.time + (delay.tag == FL_NUMBER ? delay.as.number : 0.0),
                                  fl_conc_address(plan, to), what)) {
            return fl_conc_memory(ctx, error);
          }
          continue;
        }
        if (strcmp(kind, "отложить") == 0) {
          /* За уже пришедшие, а не в голову: цена откладывания обязана быть
             видимой, иначе выборочный приём вернулся бы через заднюю дверь. */
          if (!fl_conc_box_push(ctx, &sched.slots[process].box, message, false)) {
            return fl_conc_memory(ctx, error);
          }
          fl_conc_refresh(&sched, process);
          entry->outcome = "отложено";
          continue;
        }
        if (strcmp(kind, "продолжить") == 0) {
          if (!fl_conc_box_push(ctx, &sched.slots[process].box, message, true)) {
            return fl_conc_memory(ctx, error);
          }
          fl_conc_refresh(&sched, process);
          entry->outcome = "продолжено";
          continue;
        }
        if (strcmp(kind, "остановить") == 0) {
          fl_value why = fl_nothing();
          const char *text = NULL;
          fl_conc_variant_field(item, "почему", &why);
          text = fl_conc_cstring(ctx, why);
          sched.slots[process].alive = false;
          fl_conc_refresh(&sched, process);
          /* Нормальная остановка — не отказ, надзор о ней не узнаёт. Любая
             другая причина — отказ. */
          if (strcmp(text, FL_CONC_NORMAL) == 0) {
            entry->outcome = "остановлено";
          } else {
            failed = "FLANG_STOPPED";
            reason = text;
            entry->outcome = "отказ";
          }
          continue;
        }
      }
    } else {
      /* Пробег, кончившийся отказом, всё равно был пробегом: время идёт и здесь.
         Иначе окно порога отказов не двигалось бы у процесса, который только и
         делает, что падает. */
      sched.time += 1.0;
      sched.slots[process].alive = false;
      fl_conc_refresh(&sched, process);
    }

    if (failed != NULL) {
      bool escalated = false;
      entry->code = failed;
      entry->reason = reason;
      if (!fl_conc_note_failure(&sched, process, failed, reason, entry->time)) {
        return fl_conc_memory(ctx, error);
      }
      if (!fl_conc_supervise(&sched, process, failed, entry->time, &escalated, subtree, seen)) {
        return fl_conc_memory(ctx, error);
      }
      if (escalated) {
        /* Отказ дошёл доверху: останавливается вся программа. Это исход, а не
           зависание, и он назван — иначе прогон отличал бы «надзор не справился»
           от «работа кончилась» только по итоговым состояниям. */
        outcome = "отказ дошёл доверху";
        for (index = 0; index < plan->process_count; index += 1) {
          sched.slots[index].alive = false;
        }
        break;
      }
    }
  }

  for (index = 0; index < plan->process_count; index += 1) {
    states[index] = sched.slots[index].current;
    alive[index] = sched.slots[index].alive;
  }
  out->outcome = outcome;
  out->time = sched.time;
  out->turns = sched.turns;
  out->states = states;
  out->alive = alive;
  out->journal = sched.journal;
  out->journal_count = sched.journal_count;
  out->failures = sched.failures;
  out->failure_count = sched.failure_count;
  out->decisions = sched.decisions;
  out->decision_count = sched.decision_count;
  return FL_OK;
}
