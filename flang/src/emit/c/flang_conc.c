/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
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
#include <stdio.h>
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

static fl_status fl_conc_memory(fl_ctx *ctx, fl_error *error) {
  return fl_fail(ctx, error, FL_CODE_MEMORY, "кончилась память в планировщике конкурентности");
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

/* ───────────────────────────── копия значения (шаг А2) ─────────────────────
   Своя куча у процесса возможна ровно при одном условии: наружу из неё ничего
   не смотрит. Значит сообщение, уходящее адресату, обязано переехать в ЕГО
   кучу, а не остаться ссылкой в кучу отправителя, — иначе сброс кучи
   отправителя оставил бы адресату указатель в пустоту.

   Это и есть тот пункт границы честности, который выбор А0 вычеркнул:
   «сообщения не копируются» больше не правда. Взамен правдой стало «процесс
   живёт неограниченно», и разменяны они сознательно — цена копии измерена и
   названа числом (`flang/conc/bench.mjs`, раздел «Цена отправки сообщения»).

   Имена полей и имя варианта НЕ копируются: они приходят из модели, а не из
   данных, лежат в .rodata и живут столько же, сколько программа
   (`flang_runtime.h`, «Имена полей всегда заканчиваются нулём»). Копировать их
   значило бы платить за каждое сообщение ещё и длиной его схемы. */

static fl_status fl_conc_clone(fl_ctx *ctx, fl_value value, fl_value *out, fl_error *error);

static fl_status fl_conc_clone_fields(fl_ctx *ctx, const fl_field *fields, size_t count,
                                      const fl_field **out, fl_error *error) {
  fl_field *copy = NULL;
  size_t index = 0;
  if (count == 0) {
    *out = NULL;
    return FL_OK;
  }
  if (count > ((size_t)-1) / sizeof(fl_field)) {
    return fl_conc_memory(ctx, error);
  }
  copy = (fl_field *)fl_arena_alloc(ctx->arena, count * sizeof(fl_field));
  if (copy == NULL) {
    return fl_conc_memory(ctx, error);
  }
  for (index = 0; index < count; index += 1) {
    copy[index].name = fields[index].name;
    FL_TRY(fl_conc_clone(ctx, fields[index].value, &copy[index].value, error));
  }
  *out = copy;
  return FL_OK;
}

/**
 * Глубокая копия значения в арену `ctx`. Значения flang — деревья: они
 * неизменяемы, разделяются свободно и не содержат циклов, поэтому обход
 * завершается, а глубину сторожит `fl_enter` тем же пределом и тем же кодом
 * (`FLANG_RECURSION_LIMIT`), которым её сторожит всё остальное.
 *
 * Счёт витков на время копии выключен (`max_steps == 0` у контекста-приёмника):
 * копирование — работа планировщика, а не программы, и приписывать её запасу
 * обработчика значило бы сделать запас зависящим от размера сообщения.
 */
static fl_status fl_conc_clone(fl_ctx *ctx, fl_value value, fl_value *out, fl_error *error) {
  fl_status status = FL_OK;
  FL_TRY(fl_enter(ctx, "копия значения", error));
  switch (value.tag) {
    case FL_NOTHING:
    case FL_NUMBER:
    case FL_FLAG:
      *out = value;
      break;
    case FL_STRING: {
      char *text = (char *)fl_arena_alloc(ctx->arena, value.as.string.bytes + 1);
      if (text == NULL) {
        fl_leave(ctx);
        return fl_conc_memory(ctx, error);
      }
      if (value.as.string.bytes > 0) {
        memcpy(text, value.as.string.utf8, value.as.string.bytes);
      }
      /* Ноль на конце копия ставит, хотя исходник мог быть срезом и не
         заканчиваться им: лишний байт стоит меньше, чем правило «иногда с
         нулём», и диагностики печатают строку через %s. */
      text[value.as.string.bytes] = '\0';
      *out = fl_text_borrow(text, value.as.string.bytes, value.as.string.points);
      break;
    }
    case FL_LIST: {
      fl_value *items = NULL;
      size_t index = 0;
      if (value.as.list.count == 0) {
        *out = fl_list(NULL, 0);
        break;
      }
      if (value.as.list.count > ((size_t)-1) / sizeof(fl_value)) {
        fl_leave(ctx);
        return fl_conc_memory(ctx, error);
      }
      items = (fl_value *)fl_arena_alloc(ctx->arena, value.as.list.count * sizeof(fl_value));
      if (items == NULL) {
        fl_leave(ctx);
        return fl_conc_memory(ctx, error);
      }
      for (index = 0; index < value.as.list.count; index += 1) {
        status = fl_conc_clone(ctx, value.as.list.items[index], &items[index], error);
        if (status != FL_OK) {
          fl_leave(ctx);
          return status;
        }
      }
      /* Хвостовой запас копии НЕ передаётся: запас считает ячейки от базы
         своего массива, а копия — другое выделение. Наблюдаемо это ничего не
         меняет (`flang_runtime.h`: «Поле не наблюдаемо»). */
      *out = fl_list(items, value.as.list.count);
      break;
    }
    case FL_RECORD: {
      fl_record *record = (fl_record *)fl_arena_alloc(ctx->arena, sizeof(fl_record));
      if (record == NULL) {
        fl_leave(ctx);
        return fl_conc_memory(ctx, error);
      }
      record->count = value.as.record->count;
      record->fields = NULL;
      status = fl_conc_clone_fields(ctx, value.as.record->fields, value.as.record->count, &record->fields,
                                    error);
      if (status != FL_OK) {
        fl_leave(ctx);
        return status;
      }
      out->tag = FL_RECORD;
      out->as.record = record;
      break;
    }
    case FL_VARIANT: {
      fl_variant *variant = (fl_variant *)fl_arena_alloc(ctx->arena, sizeof(fl_variant));
      if (variant == NULL) {
        fl_leave(ctx);
        return fl_conc_memory(ctx, error);
      }
      variant->name = value.as.variant->name;
      variant->count = value.as.variant->count;
      variant->fields = NULL;
      status = fl_conc_clone_fields(ctx, value.as.variant->fields, value.as.variant->count, &variant->fields,
                                    error);
      if (status != FL_OK) {
        fl_leave(ctx);
        return status;
      }
      out->tag = FL_VARIANT;
      out->as.variant = variant;
      break;
    }
  }
  fl_leave(ctx);
  return FL_OK;
}

/* ───────────────────────────── почтовый ящик ─────────────────────────────
   Кольцо, а не список: ящику нужны три движения — снять с головы, положить в
   хвост («отправить», «отложить») и вернуть в голову («продолжить»), — и все
   три обязаны стоить одинаково. Список дал бы то же самое ценой указателя на
   каждое сообщение; кольцо обходится одним массивом.

   Массив ящика живёт в куче ТОГО ЖЕ процесса, что и сам ящик: он переезжает
   вместе с сообщениями и сбрасывается вместе с половиной кучи. Поэтому здесь
   арена, а не контекст, — контекст на пробеге указывает на черновик, и ящик,
   выросший в черновике, не пережил бы пробега. */

typedef struct fl_conc_box {
  fl_value *items;
  size_t capacity;
  size_t head;
  size_t count;
} fl_conc_box;

static bool fl_conc_box_grow(fl_arena *arena, fl_conc_box *box) {
  const size_t next = box->capacity == 0 ? 8 : box->capacity * 2;
  fl_value *items = (fl_value *)fl_arena_alloc(arena, next * sizeof(fl_value));
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

static bool fl_conc_box_push(fl_arena *arena, fl_conc_box *box, fl_value value, bool front) {
  if (box->count == box->capacity && !fl_conc_box_grow(arena, box)) {
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

/**
 * Процесс: состояние, ящик и СВОЯ КУЧА (шаг А2).
 *
 * Куча двумя половинами. Живое между пробегами — это ровно состояние и то, что
 * осталось в ящике: обработчик чист и завершается, значит в момент, когда он
 * вернул отклик, достижимо только `{новое состояние} ∪ {отправленное}`, а
 * отправленное уже уехало адресатам. Поэтому после пробега живое переезжает в
 * свободную половину, занятая сбрасывается целиком, и половины меняются местами.
 *
 * Сборщика здесь нет и не нужно: мусор не обходится, не помечается и не
 * считается — он перестаёт существовать вместе с половиной. Цена переезда —
 * O(состояние + ящик), а не O(кучи), и ровно это `RESILIENCE.md` называет
 * «сборкой на процесс, которая вообще не сборщик».
 *
 * `initial` живёт НЕ здесь, а в арене вызывающего: перезапуск надзором обязан
 * вернуть то же самое значение, что было при первом запуске, а половины кучи к
 * тому времени сброшены обе.
 */
typedef struct fl_conc_slot {
  fl_value initial; /* вычислено ОДИН раз: перезапуск обязан вернуть то же самое */
  fl_value current;
  bool alive;
  fl_conc_box box;
  fl_arena heap[2];
  size_t live; /* половина, из которой идёт выдача прямо сейчас */
  /* Сколько мест в ящике занято письмами, которые ещё не пришли («через»),
     шаг А3. Место занимается в тот момент, когда действие выполнено, а не
     когда таймер сработал: иначе переполнение случалось бы в тишине, между
     пробегами, и отказывать было бы некому. */
  size_t pending;
} fl_conc_slot;

typedef struct fl_conc_timer {
  double time;
  size_t target; /* индекс процесса; SIZE_MAX — адресат неизвестен, письмо пропадёт */
  bool reserved; /* место в ящике адресата занято этим письмом (А3) */
  fl_value message;
} fl_conc_timer;

/** Кто над кем: индекс надзора и стратегия за этим ребёнком. */
typedef struct fl_conc_link {
  size_t supervisor; /* SIZE_MAX — надзора нет */
  const char *strategy;
} fl_conc_link;

typedef struct fl_conc_sched {
  fl_ctx *ctx;
  /* Арена вызывающего — «дом». Держится отдельным полем, потому что на время
     пробега `ctx->arena` указывает на черновик, и «арена вызывающего» перестаёт
     быть тем же самым, что `ctx->arena`. Всё, что обязано пережить прогон
     (журнал, отказы, решения, итоговые состояния), выделяется здесь. */
  fl_arena *home;
  const fl_conc_plan *plan;
  fl_conc_slot *slots;

  /* Очередь готовых: индексы процессов ПО ВОЗРАСТАНИЮ, то есть в порядке
     объявления. Держится списком, а не пересобирается перебором всех процессов
     на каждом пробеге, как у эталона: содержимое то же самое, стоимость
     O(готовых) вместо O(объявленных). */
  size_t *ready;
  bool *is_ready;
  size_t ready_count;

  /* Журнал доставок. `keep_journal` — наблюдение, а не работа: в режиме прогона
     он нужен целиком (по нему сверяются с эталоном побайтово), в рабочем режиме
     не нужен вовсе, а платится за него памятью на КАЖДОМ пробеге, и арена не
     возвращает ничего. Когда журнала нет, запись пробега всё равно нужна —
     исход пробега дописывается уже после вызова обработчика, — но живёт она в
     `scratch` и переписывается следующим пробегом. */
  bool keep_journal;
  fl_conc_entry scratch;
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

  /* Черновик пробега (шаг А2). Обработчик считает в нём и только в нём, и
     сбрасывается он после КАЖДОГО пробега — значит всё, что пробег выделил и не
     отдал наружу, не стоит ничего. Законно это ровно потому же, почему В2 умеет
     снимать пробег по кванту: обработчик чист и возвращает состояние значением,
     поэтому пока пробег не вернулся, наружу не ушло ничего. */
  fl_arena draft;

  /* Письма, ждущие срока («через»). Своя куча по той же причине, что у
     процесса: отправитель сбросит свой черновик и свою половину задолго до
     того, как таймер сработает. Половины две и здесь — сработавшие письма
     мертвы, и куча складывается по оставшимся, а не растёт от числа таймеров. */
  fl_arena post[2];
  size_t post_live;

  double time;
  size_t turns;
  uint32_t random;
} fl_conc_sched;

/**
 * Копия значения в названную арену. Контекст заводится местный: счёт витков
 * выключен (копирование — работа планировщика, а не запаса обработчика), предел
 * глубины взят у вызывающего, потому что глубина значения — то же дерево, что
 * сторожит рекурсию везде.
 */
static bool fl_conc_keep(fl_conc_sched *sched, fl_arena *arena, fl_value value, fl_value *out) {
  fl_ctx into;
  fl_error unused;
  into.arena = arena;
  into.depth = 0;
  into.max_depth = sched->ctx->max_depth;
  into.steps = 0;
  into.max_steps = 0;
  /* Сторож стека переезжает вместе с остальными пределами, и не для порядка:
     `fl_conc_clone` рекурсивна по СТРУКТУРЕ значения, то есть кадры ест она
     тоже. Оставить поля неинициализированными значило бы сторожить по мусору —
     то есть либо отказать на ровном месте, либо не отказать вовсе. Отметка
     берётся у вызывающего: копия идёт на его же стеке, ниже его отметки. */
  into.stack_base = sched->ctx->stack_base;
  into.stack_room = sched->ctx->stack_room;
  into.stack_seen = sched->ctx->stack_seen;
  into.stack_step = sched->ctx->stack_step;
  unused.code = NULL;
  unused.message = NULL;
  return fl_conc_clone(&into, value, out, &unused) == FL_OK;
}

/**
 * Копия текста диагностики в арену вызывающего. Текст отказа строит обработчик,
 * то есть он лежит в черновике пробега и переживёт его только копией; а нужен
 * он дольше — его читают журнал, список отказов и решение надзора.
 */
static const char *fl_conc_keep_text(fl_ctx *ctx, const char *text) {
  size_t bytes = 0;
  char *copy = NULL;
  if (text == NULL) {
    return "";
  }
  bytes = strlen(text);
  copy = (char *)fl_arena_alloc(ctx->arena, bytes + 1);
  if (copy == NULL) {
    return "";
  }
  memcpy(copy, text, bytes + 1);
  return copy;
}

/**
 * Текст отказа «ящик полон» (А3). Строится здесь, а не при печати программы,
 * потому что называет ИМЯ адресата и объявленный им потолок, а знает их только
 * план — и знает одинаково у эталона и у напечатанного C.
 */
static const char *fl_conc_full_text(fl_conc_sched *sched, size_t target) {
  char buffer[256];
  if (target == SIZE_MAX) {
    return "ящик адресата полон";
  }
  snprintf(buffer, sizeof(buffer), "ящик процесса «%s» полон: объявлен на %lu",
           sched->plan->processes[target].name, (unsigned long)sched->plan->processes[target].mailbox);
  return fl_conc_keep_text(sched->ctx, buffer);
}

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
 * Занят ли ящик процесса целиком (А3).
 *
 * Занятость — лежащие в ящике сообщения ПЛЮС письма в пути: иначе объявленный
 * потолок не был бы потолком, потому что тысяча таймеров на один процесс
 * переполнила бы ящик в тот момент, когда сработала бы, то есть вне пробега.
 * Ноль в `mailbox` — ящик неограничен, и тогда полным он не бывает никогда.
 */
static bool fl_conc_box_full(const fl_conc_sched *sched, size_t target) {
  const size_t limit = sched->plan->processes[target].mailbox;
  if (limit == 0) {
    return false;
  }
  return sched->slots[target].box.count + sched->slots[target].pending >= limit;
}

/** Исход доставки: три, и все три названы (см. `положить` в `conc.mjs`). */
typedef enum fl_conc_post {
  FL_CONC_POSTED = 0,  /* легло */
  FL_CONC_NOBODY = 1,  /* адресата нет или он мёртв — не ошибка отправителя */
  FL_CONC_FULL = 2,    /* ящик объявлен ограниченным и места в нём нет */
  FL_CONC_NOMEM = 3    /* кончилась память */
} fl_conc_post;

/**
 * Положить сообщение в ящик. Мёртвому процессу писать некуда, и это не ошибка
 * отправителя: он не обязан знать, что адресат остановился, — ровно так же, как
 * в BEAM. Полный ящик — ошибка отправителя, и в этом всё отличие: адресат про
 * своё переполнение ничего сделать не может, а отправитель может.
 *
 * `reserved` — место уже занято этим письмом при выполнении «через», значит
 * потолок проверять не надо: он проверен тогда.
 */
static fl_conc_post fl_conc_deliver(fl_conc_sched *sched, size_t target, fl_value message, bool front,
                                    bool reserved) {
  fl_conc_slot *slot = NULL;
  fl_arena *heap = NULL;
  fl_value copy = fl_nothing();
  if (target == SIZE_MAX || !sched->slots[target].alive) {
    return FL_CONC_NOBODY;
  }
  if (!reserved && fl_conc_box_full(sched, target)) {
    return FL_CONC_FULL;
  }
  slot = &sched->slots[target];
  heap = &slot->heap[slot->live];
  /* Копия — это и есть выбор А0. Сообщение переезжает в кучу АДРЕСАТА, потому
     что куча отправителя будет стёрта, как только его пробег кончится, а
     черновик — сразу после. Проверка «жив ли адресат» стоит раньше копии
     намеренно: мёртвому не пишут, и платить за копию письма, которое некуда
     положить, незачем. */
  if (!fl_conc_keep(sched, heap, message, &copy)) {
    return FL_CONC_NOMEM;
  }
  if (!fl_conc_box_push(heap, &slot->box, copy, front)) {
    return FL_CONC_NOMEM;
  }
  fl_conc_refresh(sched, target);
  return FL_CONC_POSTED;
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

/**
 * Запись о пробеге. Возвращает место, куда пробег допишет свой исход, или NULL,
 * если кончилась память.
 *
 * Место это одно из двух, и в этом весь шаг А1. С журналом — очередная ячейка
 * растущего массива, которая останется лежать в арене до конца прогона. Без
 * журнала — `scratch`, одна и та же ячейка на все пробеги: исход пробега нужен
 * самому пробегу (по нему решает надзор), а хранить его после того, как пробег
 * кончился, незачем, если никто не собирается читать журнал.
 */
static fl_conc_entry *fl_conc_record(fl_conc_sched *sched, double when, size_t process, fl_value message) {
  fl_conc_entry *entry = &sched->scratch;
  if (sched->keep_journal) {
    if (sched->journal_count == sched->journal_capacity) {
      fl_conc_entry *bigger = (fl_conc_entry *)fl_conc_grow(sched->ctx, sched->journal, sched->journal_count,
                                                            &sched->journal_capacity, sizeof(fl_conc_entry));
      if (bigger == NULL) {
        return NULL;
      }
      sched->journal = bigger;
    }
    entry = &sched->journal[sched->journal_count];
    sched->journal_count += 1;
  }
  entry->time = when;
  entry->process = process;
  entry->outcome = "обработано";
  entry->code = NULL;
  entry->reason = NULL;
  /* Сообщение в журнале — КОПИЯ в арене вызывающего: подлинник лежит в куче
     процесса и умрёт с ближайшим её сбросом, а журнал живёт до конца прогона.
     Без журнала копии нет вовсе, и это не экономия на мелочи: копия сообщения
     на каждом пробеге — ровно та цена наблюдения, которую снял шаг А1. Поле
     заполняется «ничем», а не подлинником: указатель в сброшенную половину не
     читает никто, но и лежать ему там незачем. */
  if (sched->keep_journal) {
    if (!fl_conc_keep(sched, sched->home, message, &entry->message)) {
      return NULL;
    }
  } else {
    entry->message = fl_nothing();
  }
  return entry;
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

static bool fl_conc_timer_push(fl_conc_sched *sched, double when, size_t target, fl_value message,
                               bool reserved) {
  fl_value copy = fl_nothing();
  /* Письмо ждёт срока дольше, чем живёт черновик пробега, в котором его
     построили, — значит переезжает в почтовую кучу. Адресату оно достанется
     ещё одной копией, уже в его собственную кучу (`fl_conc_deliver`): сюда его
     кладут на хранение, а не в ящик. */
  if (!fl_conc_keep(sched, &sched->post[sched->post_live], message, &copy)) {
    return false;
  }
  message = copy;
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
  sched->timers[sched->timer_count].reserved = reserved;
  sched->timers[sched->timer_count].message = message;
  sched->timer_count += 1;
  return true;
}

/**
 * Сложить почтовую кучу: живое в ней — ровно те письма, что ещё ждут срока.
 * Сработавшее письмо мертво в тот же миг, когда адресат получил свою копию, и
 * без этого переезда «через» в цикле давал бы рост, которого А2 не терпит.
 */
static bool fl_conc_post_pack(fl_conc_sched *sched) {
  fl_arena *to = &sched->post[1 - sched->post_live];
  size_t index = 0;
  for (index = 0; index < sched->timer_count; index += 1) {
    fl_value moved = fl_nothing();
    if (!fl_conc_keep(sched, to, sched->timers[index].message, &moved)) {
      return false;
    }
    sched->timers[index].message = moved;
  }
  fl_arena_reset(&sched->post[sched->post_live]);
  sched->post_live = 1 - sched->post_live;
  return true;
}

/** Выдать все таймеры, чей срок наступил. Порядок при равном сроке — порядок
    постановки: два таймера на одно время не соревнуются. */
static bool fl_conc_fire_timers(fl_conc_sched *sched) {
  size_t index = 0;
  bool fired = false;
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
    fired = true;
    /* Место в ящике было занято ещё при выполнении «через», поэтому здесь оно
       только освобождается и тут же заполняется: переполниться этот путь не
       может по построению, и `FL_CONC_FULL` отсюда не возвращается никогда. */
    if (timer.reserved) {
      sched->slots[timer.target].pending -= 1;
    }
    if (fl_conc_deliver(sched, timer.target, timer.message, false, timer.reserved) == FL_CONC_NOMEM) {
      return false;
    }
  }
  return fired ? fl_conc_post_pack(sched) : true;
}

/**
 * Переезд процесса в свободную половину его кучи — вторая половина шага А2.
 *
 * Копируется ровно живое: новое состояние и то, что осталось в ящике. Занятая
 * половина сбрасывается целиком, половины меняются местами. Ящик переезжает
 * вместе с сообщениями и получает массив ровно по числу оставшихся: держать
 * прежнюю ёмкость незачем, следующий `push` возьмёт её у сброшенной половины
 * бампом указателя, без обращения к malloc.
 *
 * Зовётся ПОСЛЕ каждого пробега и до того, как решает надзор: к этому моменту
 * отправленное уже уехало адресатам копиями, отложенное лежит в своём ящике, а
 * подлинники всего этого — в той половине, которую сейчас сбросят.
 */
static bool fl_conc_evacuate(fl_conc_sched *sched, size_t index, fl_value *state) {
  fl_conc_slot *slot = &sched->slots[index];
  fl_arena *to = &slot->heap[1 - slot->live];
  fl_value moved = fl_nothing();
  fl_value *items = NULL;
  size_t at = 0;
  if (!fl_conc_keep(sched, to, *state, &moved)) {
    return false;
  }
  if (slot->box.count > 0) {
    items = (fl_value *)fl_arena_alloc(to, slot->box.count * sizeof(fl_value));
    if (items == NULL) {
      return false;
    }
    for (at = 0; at < slot->box.count; at += 1) {
      if (!fl_conc_keep(sched, to, slot->box.items[(slot->box.head + at) % slot->box.capacity], &items[at])) {
        return false;
      }
    }
  }
  fl_arena_reset(&slot->heap[slot->live]);
  slot->live = 1 - slot->live;
  slot->box.items = items;
  slot->box.capacity = slot->box.count;
  slot->box.head = 0;
  *state = moved;
  return true;
}

/**
 * Отказ, который процесс нажил САМ: ставится один раз, первый выигрывает.
 *
 * Сюда сходятся все виды, случающиеся уже ПОСЛЕ того, как обработчик вернулся:
 * полный ящик адресата (А3) и нехватка памяти в куче (Г2). Разного поведения у
 * двух отказов внутри одного списка действий быть не должно — иначе порядок
 * действий начал бы решать, каким кодом упадёт процесс.
 */
static void fl_conc_own_failure(fl_conc_sched *sched, size_t process, fl_conc_entry *entry,
                                const char **failed, const char **reason,
                                const char *code, const char *text) {
  if (*failed != NULL) {
    return;
  }
  *failed = code;
  *reason = text;
  entry->outcome = "отказ";
  sched->slots[process].alive = false;
  fl_conc_refresh(sched, process);
}

/**
 * Процесс отдаёт всё, что у него было (шаг Г2), — последнее средство.
 *
 * Зовётся ровно тогда, когда даже ПЕРЕЕЗД не удался: памяти не хватило на то,
 * чтобы перенести живое в свободную половину. Тогда переносить нечего и некуда,
 * и единственное, что можно вернуть, — начальное состояние: оно лежит в арене
 * вызывающего, а не в куче процесса, и потому переживает сброс обеих половин.
 *
 * Что процесс при этом теряет, названо прямо: накопленное состояние и всё, что
 * лежало в ящике. Это НЕ потеря данных по недосмотру — это единственное, что
 * можно сделать, когда памяти нет: любая попытка сберечь их требует памяти.
 * Надзор, поднимая процесс, и так вернул бы его к начальному состоянию; разница
 * лишь в том, что здесь оно возвращается ещё до решения надзора, потому что
 * иначе решать было бы не над чем.
 *
 * `pending` не обнуляется: письма в пути живут в почтовой куче, а не в этой, и
 * своё место в ящике они по-прежнему занимают.
 */
static void fl_conc_surrender(fl_conc_sched *sched, size_t index) {
  fl_conc_slot *slot = &sched->slots[index];
  fl_arena_reset(&slot->heap[0]);
  fl_arena_reset(&slot->heap[1]);
  slot->live = 0;
  slot->box.items = NULL;
  slot->box.capacity = 0;
  slot->box.head = 0;
  slot->box.count = 0;
  slot->current = slot->initial;
  fl_conc_refresh(sched, index);
}

fl_status fl_conc_run(fl_ctx *ctx, const fl_conc_plan *plan, const char *run, double seed, size_t max_turns,
                      bool journal, fl_conc_result *out, fl_error *error) {
  fl_conc_sched sched;
  const fl_conc_run_spec *spec = NULL;
  fl_value *inbox = NULL;
  size_t *subtree = NULL;
  bool *seen = NULL;
  fl_value *states = NULL;
  bool *alive = NULL;
  const char *outcome = "покой";
  size_t index = 0;
  /* Кучи процессов покупают память у malloc сами и обязаны её вернуть: арена
     вызывающего им не хозяйка. Значит у функции ровно один выход — `finish`, и
     всякий ранний возврат ПОСЛЕ того, как кучи заведены, идёт через него.
     Иначе прогон, кончившийся нехваткой памяти, оставлял бы за собой всё, что
     успел купить, и проверка valgrind'ом нашла бы это первой. */
  fl_status status = FL_OK;
  bool heaps = false;

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
  sched.home = ctx->arena;
  sched.plan = plan;
  sched.random = fl_conc_seed(seed);
  sched.keep_journal = journal;
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

  /* Кучи заводятся ДО первого вычисления: с этой строки любой выход обязан
     идти через `finish`. Начальное состояние при этом строится в арене
     вызывающего, а не в куче процесса, — перезапуск надзором обязан вернуть то
     же самое значение, а половины кучи к тому времени сброшены обе. */
  for (index = 0; index < plan->process_count; index += 1) {
    fl_arena_init(&sched.slots[index].heap[0]);
    fl_arena_init(&sched.slots[index].heap[1]);
    sched.slots[index].live = 0;
  }
  fl_arena_init(&sched.draft);
  fl_arena_init(&sched.post[0]);
  fl_arena_init(&sched.post[1]);
  sched.post_live = 0;
  heaps = true;

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
      status = fl_conc_memory(ctx, error);
      goto finish;
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
    status = plan->call(ctx, plan->processes[index].initial, NULL, 0, &initial, error);
    if (status != FL_OK) {
      goto finish;
    }
    sched.slots[index].initial = initial;
    sched.slots[index].current = initial;
    sched.slots[index].alive = true;
    sched.slots[index].box.items = NULL;
    sched.slots[index].box.capacity = 0;
    sched.slots[index].box.head = 0;
    sched.slots[index].box.count = 0;
    sched.slots[index].pending = 0;
    sched.is_ready[index] = false;
  }
  fl_conc_build_tree(&sched);

  /* Входные сообщения прогона лежат в ящиках ДО первого выбора планировщика:
     так же, как у эталона, где «дано» кладётся в ящик, а не доставляется. */
  if (spec->count > 0) {
    inbox = (fl_value *)fl_arena_alloc(ctx->arena, spec->count * sizeof(fl_value));
    if (inbox == NULL) {
      status = fl_conc_memory(ctx, error);
      goto finish;
    }
    status = spec->build(ctx, inbox, error);
    if (status != FL_OK) {
      goto finish;
    }
    for (index = 0; index < spec->count; index += 1) {
      /* Переполнение «дано» отвергает проверка типов (`types.mjs`, `checkRuns`):
         сколько сообщений названо, столько и ляжет, и посчитать это можно до
         прогона. Здесь — определённое поведение на плане, собранном мимо неё. */
      const fl_conc_post posted =
        fl_conc_deliver(&sched, fl_conc_find(plan, spec->targets[index]), inbox[index], false, false);
      if (posted == FL_CONC_NOMEM) {
        status = fl_conc_memory(ctx, error);
        goto finish;
      }
      if (posted == FL_CONC_FULL) {
        status = fl_fail(ctx, error, "FLANG_PROCESS", "«дано» переполняет ящик процесса «%s»",
                         spec->targets[index]);
        goto finish;
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
    fl_status called = FL_OK;
    const char *failed = NULL;
    const char *reason = NULL;
    const fl_conc_process *node = NULL;
    /* Успело ли новое состояние стать состоянием процесса. Пока не успело, оно
       живёт в черновике, и черновик можно сбросить досрочно; как только успело —
       нельзя, потому что `current` смотрит внутрь него до самого переезда. */
    bool committed = false;
    size_t saved_steps = 0;
    size_t saved_max_steps = 0;
    size_t saved_depth = 0;
    fl_value args[2];

    if (!fl_conc_fire_timers(&sched)) {
      status = fl_conc_memory(ctx, error);
      goto finish;
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
    entry = fl_conc_record(&sched, sched.time, process, message);
    if (entry == NULL) {
      status = fl_conc_memory(ctx, error);
      goto finish;
    }

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
    /* Пробег считает в ЧЕРНОВИКЕ и только в нём (шаг А2). Состояние и сообщение
       читаются при этом из кучи процесса — чтение через границу арены ничем не
       ограничено, ограничена запись: всё, что построит обработчик, ляжет в
       черновик и переживёт пробег только копией. */
    ctx->arena = &sched.draft;
    called = plan->call(ctx, node->handler, args, 2, &response, &inner);
    ctx->arena = sched.home;
    ctx->steps = saved_steps;
    ctx->max_steps = saved_max_steps;
    ctx->depth = saved_depth;

    if (called != FL_OK) {
      /* Исчерпание запаса — определённый исход, а не зависание и не молчаливый
         обрыв: сообщение отвергнуто, процесс упал, дальше решает надзор. */
      const bool budget = !node->total && inner.code != NULL &&
                          strcmp(inner.code, FL_CODE_RECURSION_LIMIT) == 0;
      failed = budget ? "FLANG_BUDGET_EXHAUSTED" : (inner.code == NULL ? "FLANG_INTERNAL" : inner.code);
      /* Текст построен в черновике — дальше он живёт копией. Код отказа
         копировать не нужно: коды приходят из `FL_CODE_*` и лежат в .rodata. */
      reason = fl_conc_keep_text(ctx, inner.message);
      entry->outcome = budget ? "запас исчерпан" : "отказ";
    } else if (fl_conc_read_response(ctx, response, node->handler, &state, &actions, &inner) != FL_OK) {
      failed = "FLANG_PROCESS";
      /* Здесь текст построен уже в арене вызывающего (`ctx` возвращён), но
         копия всё равно берётся: правило «текст отказа живёт копией» дешевле
         разбора того, чей это был черновик. */
      reason = fl_conc_keep_text(ctx, inner.message);
      entry->outcome = "отказ";
    }

    if (failed == NULL) {
      size_t action = 0;
      sched.slots[process].current = state;
      committed = true;
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
          fl_conc_post posted = FL_CONC_POSTED;
          fl_conc_variant_field(item, "кому", &to);
          fl_conc_variant_field(item, "что", &what);
          posted = fl_conc_deliver(&sched, fl_conc_address(plan, to), what, false, false);
          /* Оба неудачных исхода — отказ ОТПРАВИТЕЛЯ, и по одному доводу: он
             попросил положить сообщение, и положить его не вышло. Полный ящик
             (А3) и нехватка памяти в куче адресата (Г2) отличаются кодом, а не
             тем, кто отвечает. */
          if (posted == FL_CONC_NOMEM) {
            fl_conc_own_failure(&sched, process, entry, &failed, &reason, FL_CODE_MEMORY,
                                "кончилась память в куче адресата");
          } else if (posted == FL_CONC_FULL) {
            fl_conc_own_failure(&sched, process, entry, &failed, &reason, "FLANG_MAILBOX_FULL",
                                fl_conc_full_text(&sched, fl_conc_address(plan, to)));
          }
          continue;
        }
        if (strcmp(kind, "через") == 0) {
          size_t target = SIZE_MAX;
          bool reserve = false;
          fl_conc_variant_field(item, "задержка", &delay);
          fl_conc_variant_field(item, "кому", &to);
          fl_conc_variant_field(item, "что", &what);
          target = fl_conc_address(plan, to);
          /* Место занимается СЕЙЧАС, а не когда таймер сработает. Живость
             адресата при этом не смотрится вовсе, и это нарочно: мёртвый
             процесс может быть поднят надзором раньше срока письма, и тогда
             незанятое место дало бы ящику переполниться мимо потолка. */
          reserve = target != SIZE_MAX && plan->processes[target].mailbox != 0;
          if (reserve && fl_conc_box_full(&sched, target)) {
            fl_conc_own_failure(&sched, process, entry, &failed, &reason, "FLANG_MAILBOX_FULL",
                                fl_conc_full_text(&sched, target));
            continue;
          }
          if (reserve) {
            sched.slots[target].pending += 1;
          }
          if (!fl_conc_timer_push(&sched, sched.time + (delay.tag == FL_NUMBER ? delay.as.number : 0.0),
                                  target, what, reserve)) {
            /* Почтовая куча общая на прогон, но положить в неё просил ЭТОТ
               процесс, и отвечает за это он же (Г2). */
            if (reserve) {
              sched.slots[target].pending -= 1;
            }
            fl_conc_own_failure(&sched, process, entry, &failed, &reason, FL_CODE_MEMORY,
                                "кончилась память в почтовой куче");
          }
          continue;
        }
        if (strcmp(kind, "отложить") == 0) {
          /* За уже пришедшие, а не в голову: цена откладывания обязана быть
             видимой, иначе выборочный приём вернулся бы через заднюю дверь. */
          if (!fl_conc_box_push(&sched.slots[process].heap[sched.slots[process].live],
                                &sched.slots[process].box, message, false)) {
            fl_conc_own_failure(&sched, process, entry, &failed, &reason, FL_CODE_MEMORY,
                                "кончилась память в собственной куче процесса");
            continue;
          }
          fl_conc_refresh(&sched, process);
          entry->outcome = "отложено";
          continue;
        }
        if (strcmp(kind, "продолжить") == 0) {
          if (!fl_conc_box_push(&sched.slots[process].heap[sched.slots[process].live],
                                &sched.slots[process].box, message, true)) {
            fl_conc_own_failure(&sched, process, entry, &failed, &reason, FL_CODE_MEMORY,
                                "кончилась память в собственной куче процесса");
            continue;
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

    /* Пробег кончился — и вот здесь шаг А2 берёт своё.

       Живое у процесса — ровно состояние и ящик: обработчик чист, значит всё
       остальное, что пробег построил, мусор в ту же наносекунду. Отправленное
       уже уехало адресатам копиями, отложенное лежит в своём ящике, текст
       отказа скопирован, сообщение журнала скопировано. Значит живое можно
       перенести в свободную половину кучи, а занятую сбросить целиком — и
       черновик следом.

       Переезд идёт ДО надзора намеренно: надзор перезапускает процесс
       начальным состоянием из арены вызывающего, и переносить его в кучу
       незачем. */
    {
      fl_value moved = sched.slots[process].current;
      /* Пробег, кончившийся отказом, черновик уже не держит: состояние из него
         никуда не поехало, текст отказа скопирован, сообщение журнала
         скопировано. Значит черновик можно сбросить ДО переезда, а не после, —
         и это не мелочь, а половина шага Г2: если пробег упал ИМЕННО по памяти,
         то переезду она нужна прямо сейчас, а держит её брошенный черновик. */
      if (failed != NULL && !committed) {
        fl_arena_reset(&sched.draft);
      }
      if (!fl_conc_evacuate(&sched, process, &moved)) {
        /* Не хватило памяти даже на переезд. Это отказ ПРОЦЕССА, а не смерть
           программы (Г2): куча своя, и распорядиться ею — его дело. Переносить
           нечего и некуда, поэтому процесс отдаёт всё и возвращается к
           начальному состоянию, которое лежит в арене вызывающего. */
        fl_conc_own_failure(&sched, process, entry, &failed, &reason, FL_CODE_MEMORY,
                            "кончилась память при переезде кучи процесса");
        fl_conc_surrender(&sched, process);
      } else {
        sched.slots[process].current = moved;
      }
      fl_arena_reset(&sched.draft);
    }

    if (failed != NULL) {
      bool escalated = false;
      entry->code = failed;
      entry->reason = reason;
      if (!fl_conc_note_failure(&sched, process, failed, reason, entry->time)) {
        status = fl_conc_memory(ctx, error);
        goto finish;
      }
      if (!fl_conc_supervise(&sched, process, failed, entry->time, &escalated, subtree, seen)) {
        status = fl_conc_memory(ctx, error);
        goto finish;
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

  /* Итоговые состояния переезжают в арену вызывающего: кучи процессов сейчас
     будут отданы системе, а `fl_conc_result` обязан оставаться годным до
     ближайшего `fl_arena_reset` вызывающего — ровно как всякое другое значение
     из рантайма (`flang_conc.h`, раздел «Память»). Копия здесь одна на процесс
     и одна на прогон, а не на пробег. */
  for (index = 0; index < plan->process_count; index += 1) {
    if (!fl_conc_keep(&sched, sched.home, sched.slots[index].current, &states[index])) {
      status = fl_conc_memory(ctx, error);
      goto finish;
    }
    alive[index] = sched.slots[index].alive;
  }
  out->outcome = outcome;
  out->time = sched.time;
  out->turns = sched.turns;
  out->states = states;
  out->alive = alive;
  /* Журнал отдаётся ровно тогда, когда его вели. Пустой массив вместо признака
     врал бы: «ни одного пробега» и «пробеги были, но их не записывали» — разные
     вещи, и читатель обязан их различать, иначе побайтовая сверка с эталоном
     однажды сравнит пустоту с пустотой и промолчит. */
  out->journal_kept = sched.keep_journal;
  out->journal = sched.journal;
  out->journal_count = sched.journal_count;
  out->failures = sched.failures;
  out->failure_count = sched.failure_count;
  out->decisions = sched.decisions;
  out->decision_count = sched.decision_count;

finish:
  /* Единственное место, где кучи возвращаются системе. Их у прогона три вида —
     по две половины на процесс, черновик и почта, — и все они куплены у malloc
     напрямую, поэтому арена вызывающего их не освободит. Пропуск этой строки
     виден не рассуждением, а проверкой: `emit-c-conc.test.mjs` гоняет прогон
     под valgrind'ом и требует ноль потерянных байт. */
  if (heaps) {
    for (index = 0; index < plan->process_count; index += 1) {
      fl_arena_release(&sched.slots[index].heap[0]);
      fl_arena_release(&sched.slots[index].heap[1]);
    }
    fl_arena_release(&sched.draft);
    fl_arena_release(&sched.post[0]);
    fl_arena_release(&sched.post[1]);
  }
  return status;
}
