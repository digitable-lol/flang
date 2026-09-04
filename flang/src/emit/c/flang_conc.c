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
 * ни от чего. Всё это — про ПРОВЕРОЧНЫЙ режим; что из этого перестаёт быть
 * правдой в рабочем, перечислено в шапке `flang_conc.h`.
 *
 * ── Один пробег на два режима ──────────────────────────────────────────────
 * Режима два, а тело пробега одно — `fl_conc_turn`. Это не про экономию строк:
 * два тела разъехались бы на первой же правке, и разъехались бы молча, потому
 * что побайтовая сверка со свидетелем смотрит только на первое. Режимы отличаются
 * ровно тем, ЧТО и в каком порядке выбирается на пробег, — и больше ничем.
 */
/*
 * Потоки берутся у POSIX ровно тем же способом, каким их уже берёт рантайм под
 * стек (`flang_runtime.c`, `FL_POSIX_STACK`): проверкой платформы и одним
 * выключателем. `-DFL_CONC_NO_THREADS` возвращает файл в чистый C99 — тогда
 * рабочего режима нет вовсе, а просьба о нём получает НАЗВАННЫЙ отказ, а не
 * молчаливое исполнение одним потоком.
 */
#if defined(__unix__) || defined(__unix) || (defined(__APPLE__) && defined(__MACH__))
#define FL_CONC_POSIX 1
#endif

#if defined(FL_CONC_POSIX) && !defined(FL_CONC_NO_THREADS)
#define FL_CONC_THREADS 1
#endif

/*
 * Сеть — ОТДЕЛЬНЫЙ выключатель, а не довесок к потокам, и это не аккуратность:
 * ждать соединения и считать в несколько потоков — разные обещания среды.
 * `-DFL_CONC_NO_NET` возвращает шести поручениям соединения тот НАЗВАННЫЙ отказ,
 * которым они отвечали до этой правки; там он правда — у чистого C99 сокетов
 * нет. Где сокеты есть, отказ был бы ложью: ждать умеет `poll`, и ждёт он не
 * останавливая планировщик.
 */
#if defined(FL_CONC_POSIX) && !defined(FL_CONC_NO_NET)
#define FL_CONC_NET 1
#endif

#if (defined(FL_CONC_THREADS) || defined(FL_CONC_NET)) && !defined(_POSIX_C_SOURCE)
#define _POSIX_C_SOURCE 200809L
#endif

/*
 * ТОТ ЖЕ РАЗРЫВ, ЧТО У `flang_repl.c` до 19 августа 2026 (см.
 * `docs/zettel/a-feature-macro-that-opens-on-glibc-closes-on-darwin.md`):
 * `_POSIX_C_SOURCE` на Darwin ЗАКРЫВАЕТ `mkdtemp` — ту же функцию, что уже
 * ломала сборку на Mac один раз. Этот файл её тоже зовёт («Завести временный
 * каталог» ниже) и фикса не получил. `_DARWIN_C_SOURCE` безвреден там, где
 * не нужен: он только поднимает видимость, ничего не забирая.
 */
#if defined(__APPLE__) && !defined(_DARWIN_C_SOURCE)
#define _DARWIN_C_SOURCE
#endif

#include "flang_conc.h"

#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
/* Часы — ради поручения «Текущее время» (седьмое действие). Ввоз безусловный:
   хозяин ввода-вывода живёт в этом файле и в проверочном режиме тоже, а
   `<time.h>` входит в C99 целиком. */
#include <time.h>

#ifdef FL_CONC_THREADS
#include <pthread.h>
#include <sched.h>
#include <unistd.h>
#endif

#ifdef FL_CONC_NET
#include <errno.h>
#include <fcntl.h>
#include <netdb.h>
#include <netinet/in.h>
#include <poll.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <unistd.h>
#endif

/*
 * Запас витков тотального обработчика: завершение доказано, предел формален.
 * Число то же, что у свидетеля (TOTAL_HANDLER_STEPS в conc.mjs), и взято отсюда,
 * а не из FL_MAX_STEPS программы: FL_MAX_STEPS настраивается ключом печати, а
 * сверка со свидетелем обязана держаться при любых настройках.
 */
#define FL_CONC_TOTAL_STEPS 1000000

/*
 * Первый кусок кучи процесса. Половин две, значит с рождения процесс стоит
 * килобайт, а не сто двадцать восемь: замер планировщика назвал старую цену
 * числом — 131 062 байта на работающий процесс, ровно два куска по 64 КиБ, —
 * притом что типичный процесс держит запись из двух полей.
 *
 * Полкилобайта, а не сто байт: в кусок обязаны поместиться состояние и первое
 * кольцо ящика (восемь мест по `sizeof(fl_value)`), иначе первый же пробег
 * купит второй кусок, и экономия обернётся лишним походом к malloc. Дальше
 * кусок удваивается сам (`fl_arena_init_small`), поэтому процессу, которому
 * нужны килобайты, эта константа ничего не стоит.
 */
#define FL_CONC_HEAP_LEAST (size_t)512u

/** Нормальная причина остановки: она одна на всю модель — как `exit(:normal)`. */
static const char *const FL_CONC_NORMAL = "норма";

/* ───────────────────────────── генератор чередований ─────────────────────────────
   mulberry32 — тот же, что в `makeRandom` свидетеля. Выбран не за качество
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

/* ───────────────────────────── рабочий режим ─────────────────────────────
   Всё, чего нет в проверочном режиме, собрано здесь и живёт ровно тогда, когда
   `workers` больше единицы. В проверочном режиме `sched->par` равен NULL, все
   замки — пустые вызовы, и машинного кода от этого раздела не остаётся ни
   байта: проверка `par == NULL` предсказывается всегда одинаково.

   Признак процесса ходит ТОЛЬКО под замком процесса, и он же не даёт одному
   процессу бежать на двух потоках: перевести «в очереди» в «бежит» может ровно
   тот поток, который снял его со склада. */
/* Сколько замков в пуле. Степень двойки: номер берётся побитовым И. */
#define FL_CONC_LOCKS ((size_t)4096u)

#define FL_CONC_IDLE 0u    /* покоится: ящик пуст либо процесс мёртв */
#define FL_CONC_QUEUED 1u  /* лежит на складе готовых, ждёт своего потока */
#define FL_CONC_RUNNING 2u /* его вычерпывает поток */

#ifdef FL_CONC_THREADS
/**
 * Склад готовых одного потока. Очередь, а не стопка: стопка отдавала бы одному
 * процессу пачку за пачкой и заморила бы соседей, а «любое чередование» — это
 * не «какое попало».
 *
 * Связывается склад ЧЕРЕЗ САМИ ПРОЦЕССЫ (`par->next`), а не своим массивом, и
 * это не мелочь: процесс лежит не больше чем на одном складе, значит одного
 * поля на процесс хватает навсегда, и класть на склад никогда не нужно памяти.
 * Иначе доставка сообщения могла бы не удаться из-за нехватки памяти В
 * ПЛАНИРОВЩИКЕ, а такого вида отказа модель не знает.
 */
/** Замок с набивкой. Набивка не суеверие: `pthread_mutex_t` — сорок байт, то
    есть в строку кэша их влезает полтора, и замки СОСЕДНИХ по номеру процессов
    оказывались в одной строке. Процессы эти в рабочем режиме бегут на разных
    ядрах, и строка гуляла бы между ними на каждом взятии. */
typedef struct fl_conc_guard {
  pthread_mutex_t lock;
  char padding[64];
} fl_conc_guard;

typedef struct fl_conc_shard {
  pthread_mutex_t lock;
  size_t head;
  size_t tail;
  /* По той же причине, что у `fl_conc_crew`: замок и голова соседнего склада не
     должны попадать в ту же строку кэша, что у этого. */
  char padding[64];
} fl_conc_shard;

typedef struct fl_conc_par {
  size_t workers;
  /* Общее хозяйство: счёт пробегов, журнал, отказы, решения, таймеры, таблица
     имён, арена вызывающего. Замок РЕКУРСИВНЫЙ, потому что диагностику строят и
     из-под него (`fl_conc_spawn`), и снаружи, а два разных способа сказать одно
     и то же — это ошибка, которая ждёт своей правки. */
  pthread_mutex_t big;
  /* Пул замков, а не замок на процесс: замок ящика и кучи. Номер процесса
     берётся по остатку — ложное столкновение раз в `FL_CONC_LOCKS`, и стоит оно
     ожидания, а не ошибки. */
  fl_conc_guard *locks;
  size_t lock_count;
  bool *seen; /* рабочий массив надзора: по одному на поток */
  unsigned char *state;   /* по процессу: покоится | в очереди | бежит */
  size_t *next;           /* по процессу: связь склада */
  fl_conc_shard *shards;  /* по потоку */

  /* Сон и пробуждение. Кладущий на склад НИКОГО не будит — иначе доставка
     платила бы за общий замок; спящий сам просыпается по сроку и обходит
     склады заново. Цена — задержка на хвосте прогона, и она измерена. */
  pthread_mutex_t idle_lock;
  size_t idle;
  /* Признак «прогону конец». Ходит ТОЛЬКО под `idle_lock`, и это не педантизм:
     ThreadSanitizer нашёл здесь гонку, когда признак читали мимо замка. Гонка
     была бы безобидной на всякой известной машине — один байт, — но «безобидная
     гонка» это то, что говорят про гонку до первого раза. Замок берётся раз на
     пачку пробегов, то есть на шестьдесят четыре, и стоит наносекунды. */
  bool stop;

  size_t handed; /* сколько пробегов роздано из общего счёта */
  size_t done;   /* сколько выполнено. Равенство `handed == done` значит, что
                    невыбранных ломтей нет ни у кого, — а без этого «пробеги
                    кончились» сказать нельзя: чужой ломоть ещё вернётся. */
  bool over;     /* пробеги кончились: исход «предел пробегов» */
  bool escalated;  /* отказ дошёл доверху */
  fl_status status; /* первая беда, оборвавшая прогон */
  fl_error error;
  bool ready;      /* завелось ли всё: замки, потоки, память */
} fl_conc_par;
#endif

/* ───────────────────────────── сеть: ждать, не останавливаясь ─────────────
   Шесть поручений соединения упирались в одно: `connect` и `accept` ждут ответа
   с той стороны, а планировщик синхронен весь. Отказ был назван честно, но
   отказом он был из-за ОДНОГО слова — «ждать». Слова этого здесь больше нет:
   сокет переводится в неблокирующий, поручение, которому нечего ответить
   СЕЙЧАС, кладётся в список ожиданий, а `poll` спрашивает у ядра «кто готов» и
   возвращает управление. Пробег при этом не стоит ни мгновения: процесс,
   выдавший поручение, просто ещё не получил письма — ровно то, чем «ждёт»
   называется в этой модели с самого начала.

   Отклик приходит ОБЫЧНЫМ СООБЩЕНИЕМ и тем же `fl_conc_deliver`, каким приходит
   всё остальное: словарь поручений и словарь откликов не тронуты ни на слово.

   Где хозяин может ответить НЕ ЖДАВ (данные уже пришли, соединение уже стоит в
   очереди, ответ уместился в буфер сокета) — он отвечает на месте, как отвечал
   всегда. Ожидание заводится только там, где раньше стоял отказ. */
#ifdef FL_CONC_NET

/* Портов и соединений столько же, сколько у хозяина планов (`flang_repl.c`,
   IO_MAX_PORTS/IO_MAX_LINKS): два хозяина одного языка не имеют права упираться
   в разные потолки — программа тогда работала бы под одним и не работала под
   другим по причине, которой нет в её тексте. */
#define FL_CONC_NET_PORTS 8
#define FL_CONC_NET_LINKS 64
/* Кусок чтения — тот же, что у хозяина планов, и по той же причине: «Прочитано»
   обязано отдавать столько же байтов за один отклик у обоих. */
#define FL_CONC_NET_CHUNK 8192
/* Через сколько пробегов спрашивать сеть, когда планировщику есть чем заняться.
   Опрос на КАЖДОМ пробеге был бы системным вызовом там, где пробег стоит
   наносекунды, и оба числа замерены: `poll` на одном сокете с нулевым
   тайм-аутом — 402 нс (миллион вызовов, эта машина), потолок планировщика —
   десять миллионов пробегов в секунду, то есть 100 нс на пробег (замер в шапке
   `flang_conc.h`). Опрос на каждом пробеге стоил бы вчетверо дороже самой
   работы; раз в 1024 пробега он стоит 402 нс на 102 мкс, то есть 0,4 %, а
   письмо из сети опаздывает не больше чем на 1024 пробега.

   Когда ожиданий нет вовсе — а их нет ни у одной программы без сети — не стоит
   и этого: проверяется одно поле, и до системного вызова дело не доходит. */
#define FL_CONC_NET_EVERY 1024

typedef struct {
  int port;
  int fd;
} fl_conc_port;

typedef struct {
  int number;
  int fd;
  /* Соединение открыла ПРОГРАММА, а не приняли мы. Поле читает запись: закрывает
     соединение тот, кто его завёл, — ровно как у хозяина планов. */
  bool outgoing;
} fl_conc_wire;

/** Чего ждёт отложенное поручение. Шесть поручений — пять видов ожидания:
    октетная пара ждёт того же, что текстовая, и отличается только тем, чем
    отвечает. */
typedef enum {
  FL_CONC_WAIT_ACCEPT = 0,
  FL_CONC_WAIT_CONNECT,
  FL_CONC_WAIT_READ,
  FL_CONC_WAIT_OCTETS,
  FL_CONC_WAIT_WRITE
} fl_conc_wait_kind;

typedef struct {
  fl_conc_wait_kind kind;
  int fd;
  int number;      /* номер соединения; -1 у приёма и у исходящего до успеха */
  size_t target;   /* кому нести отклик */
  bool reserved;   /* место в ящике адресата занято при выдаче поручения */
  bool octets;     /* отвечать «Октеты», а не «Прочитано» (у записи не читается) */
  bool closing;    /* положить трубку, когда допишем */
  unsigned char *body; /* недописанный хвост ответа; malloc, не арена */
  size_t bytes;
  size_t sent;
  double points;   /* «сколько» для отклика «Записано» */
  char where[128]; /* «адрес:порт» — только ради текста отказа исходящего */
} fl_conc_wait;
#endif

typedef struct fl_conc_sched {
  fl_ctx *ctx;
  /* Арена вызывающего — «дом». Держится отдельным полем, потому что на время
     пробега `ctx->arena` указывает на черновик, и «арена вызывающего» перестаёт
     быть тем же самым, что `ctx->arena`. Всё, что обязано пережить прогон
     (журнал, отказы, решения, итоговые состояния), выделяется здесь. */
  fl_arena *home;
  const fl_conc_plan *plan;
  fl_conc_slot *slots;

  /* Сколько процессов в прогоне ВСЕГО: объявленные плюс порождённые (Б1).
     Объявленные остаются лежать в `plan->processes`, то есть в .rodata, и сюда
     не копируются — копия миллиона объявлений стоила бы 48 МБ на ровном месте.
     Порождённые лежат в `born`, а `fl_conc_node` сводит два хранилища в один
     сквозной номер: он и есть «порядок объявления», продлённый порядком
     рождения. */
  fl_conc_process *born;
  size_t born_count;
  size_t born_capacity;
  size_t proc_count;
  size_t proc_capacity; /* сколько слотов и признаков выделено под процессы */

  /* Очередь готовых. Наблюдаемо от неё нужны ровно две вещи, и обе — ФУНКЦИИ, а
     не хранилище: сколько готовых всего и КТО k-й ПО ВОЗРАСТАНИЮ номера. Ровно
     это спрашивает у неё семя, и ровно это перебором считает свидетель.

     Поэтому здесь не список номеров, а ДЕРЕВО ЧАСТИЧНЫХ СУММ (Фенвика) над
     признаком «готов»: `rank[i]` хранит сумму признаков на отрезке, который
     кончается на `i`. Обе операции стоят O(log P) вместо O(готовых) на
     `memmove`, а ответ на оба вопроса — тот же самый до номера. Подробности и
     улика — у `fl_conc_rank_add`. */
  size_t *rank;      /* дерево частичных сумм, ОДНООСНОВНОЕ: rank[0] не в счёт */
  size_t rank_size;  /* сколько номеров в дереве; равно proc_capacity */
  size_t rank_step;  /* наибольшая степень двойки, не превосходящая rank_size */
  bool *is_ready;
  size_t ready_count;

  /* Указатель имён: имя процесса → его номер, открытая адресация. Заменил
     перебор всей таблицы на каждую доставку — замер планировщика
     (`docs/scheduler-benchmark.md`, раздел 5) назвал цену перебора числом:
     4,8 миллисекунды на одну доставку при миллионе объявленных процессов, то
     есть 208 сообщений в секунду против полутора миллионов у BEAM.

     Наблюдаемо не меняется НИЧЕГО: тот же адресат, та же очередь, тот же
     журнал. Меняется только способ его найти, и это ровно тот случай, когда
     побайтовая сверка со свидетелем — не помеха правке, а её проверка.

     Номер хранится `uint32_t`, а не `size_t`: при нагрузке в половину это
     восемь байт на процесс вместо шестнадцати, а больше четырёх миллиардов
     процессов не бывает — предел куда ниже (`FL_CONC_MAX_PROCESSES`). Ноль
     означает «пусто», поэтому в ячейке лежит номер ПЛЮС ЕДИНИЦА. */
  uint32_t *names;
  size_t names_mask; /* размер таблицы минус один; размер — степень двойки */
  size_t names_used;

  /* Журнал доставок. `keep_journal` — наблюдение, а не работа: в режиме прогона
     он нужен целиком (по нему сверяются со свидетелем побайтово), в рабочем режиме
     не нужен вовсе, а платится за него памятью на КАЖДОМ пробеге, и арена не
     возвращает ничего. Когда журнала нет, запись пробега всё равно нужна —
     исход пробега дописывается уже после вызова обработчика, — но живёт она в
     `scratch` и переписывается следующим пробегом. */
  bool keep_journal;

  /* Хозяин ввода-вывода (седьмое действие, `поручить`). По умолчанию его НЕТ, и
     это не осторожность, а условие сверки: журнал этого планировщика сверяется
     побайтово с журналом свидетеля (`flang/src/conc.mjs`), а хозяин, читающий
     настоящие файлы, сделал бы журнал зависящим от содержимого диска.
     Без хозяина поручение отвечает `«Сбой»` с кодом FLANG_IO_NO_HOST — тем же
     кодом и тем же текстом, что у свидетеля. Включает его тот, кто зовёт программу
     РАБОТАТЬ, а не проверяться: `fl_conc_run_host(..., host = true)`, а из
     прогонщика — поле `host` запроса. */
  bool host;
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
  size_t *subtree; /* рабочий список поддерева надзора; растёт вместе со слотами */
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
  size_t max_processes; /* сколько процессов прогон может завести всего (Б1) */
  uint32_t random;
  /* Кости хозяина — ОТДЕЛЬНОЕ состояние того же генератора, не `random`. Возьми
     хозяин числа у планировщика, и чередование стало бы зависеть от того,
     сколько раз программа бросила кости: побайтовая сверка сломалась бы на
     программе, которая ничего конкурентного не меняла. */
  uint32_t dice;

#ifdef FL_CONC_NET
  /* Слушающие сокеты, соединения и список ожиданий — всё хозяйство сети. Оно
     ОБЩЕЕ, как журнал и таймеры, и ходит под тем же общим замком. */
  fl_conc_port ports[FL_CONC_NET_PORTS];
  size_t port_count;
  fl_conc_wire wires[FL_CONC_NET_LINKS];
  size_t wire_count;
  int next_wire;
  fl_conc_wait waits[FL_CONC_NET_LINKS];
  size_t wait_count;
  /* Своя арена под отклики сети: строит их не пробег, а опрос, и черновик
     пробега к тому времени уже сброшен. Сбрасывается после каждого опроса —
     отклик к этому мгновению уже скопирован в кучу адресата доставкой. */
  fl_arena netpad;
  size_t polls; /* сколько раз спрошено у ядра: число для замера, не настройка */
#endif

  /* Рабочий режим. NULL — проверочный, и тогда ни одного замка не берётся. */
#ifdef FL_CONC_THREADS
  fl_conc_par *par;
#endif
} fl_conc_sched;

/* ───────────────────────────── замки ─────────────────────────────
   Четыре пары на весь файл, и в проверочном режиме все четыре — пустое место.
   Порядок взятия один и тот же везде: ОБЩИЙ → ПРОЦЕСС → СКЛАД. Вверх по нему не
   берут никогда, поэтому взаимной блокировки нет по построению, а не по
   везению. */

#ifdef FL_CONC_THREADS
#define FL_CONC_PAR(sched) ((sched)->par)
#else
#define FL_CONC_PAR(sched) ((void *)0)
#endif

static void fl_conc_big_lock(fl_conc_sched *sched) {
#ifdef FL_CONC_THREADS
  if (sched->par != NULL) {
    pthread_mutex_lock(&sched->par->big);
  }
#else
  (void)sched;
#endif
}

static void fl_conc_big_unlock(fl_conc_sched *sched) {
#ifdef FL_CONC_THREADS
  if (sched->par != NULL) {
    pthread_mutex_unlock(&sched->par->big);
  }
#else
  (void)sched;
#endif
}

static void fl_conc_hold(fl_conc_sched *sched, size_t process) {
#ifdef FL_CONC_THREADS
  if (sched->par != NULL) {
    pthread_mutex_lock(&sched->par->locks[process & (sched->par->lock_count - 1u)].lock);
  }
#else
  (void)sched;
  (void)process;
#endif
}

static void fl_conc_drop(fl_conc_sched *sched, size_t process) {
#ifdef FL_CONC_THREADS
  if (sched->par != NULL) {
    pthread_mutex_unlock(&sched->par->locks[process & (sched->par->lock_count - 1u)].lock);
  }
#else
  (void)sched;
  (void)process;
#endif
}

/**
 * Процесс по сквозному номеру: сперва объявленные, потом порождённые.
 *
 * Одна функция на все обращения к таблице — потому что номер обязан значить
 * одно и то же везде: в очереди готовых, в журнале, в итоговых состояниях, в
 * дереве надзора. Разъехавшись здесь, они разъехались бы и в журнале, а журнал
 * сверяется со свидетелем побайтово.
 */
static const fl_conc_process *fl_conc_node(const fl_conc_sched *sched, size_t index) {
  const size_t declared = sched->plan->process_count;
  return index < declared ? &sched->plan->processes[index] : &sched->born[index - declared];
}

/**
 * Копия значения в названную арену. Контекст заводится местный: счёт витков
 * выключен (копирование — работа планировщика, а не запаса обработчика), предел
 * глубины взят у вызывающего, потому что глубина значения — то же дерево, что
 * сторожит рекурсию везде.
 */
static bool fl_conc_keep(const fl_ctx *guard, fl_arena *arena, fl_value value, fl_value *out) {
  fl_ctx into;
  fl_error unused;
  into.arena = arena;
  into.depth = 0;
  into.max_depth = guard->max_depth;
  into.steps = 0;
  into.max_steps = 0;
  /* Сторож стека переезжает вместе с остальными пределами, и не для порядка:
     `fl_conc_clone` рекурсивна по СТРУКТУРЕ значения, то есть кадры ест она
     тоже. Оставить поля неинициализированными значило бы сторожить по мусору —
     то есть либо отказать на ровном месте, либо не отказать вовсе. Отметка
     берётся у вызывающего: копия идёт на его же стеке, ниже его отметки.

     Отсюда и параметр вместо `sched->ctx`: в рабочем режиме копию делает поток,
     а у потока СВОЙ стек. Сторожить его по отметке главного потока значило бы
     сторожить по числу, не имеющему к нему никакого отношения, — то есть либо
     отказывать на ровном месте, либо не отказывать вовсе. */
  into.stack_base = guard->stack_base;
  into.stack_room = guard->stack_room;
  into.stack_seen = guard->stack_seen;
  into.stack_step = guard->stack_step;
  unused.code = NULL;
  unused.message = NULL;
  return fl_conc_clone(&into, value, out, &unused) == FL_OK;
}

/**
 * Копия текста диагностики в арену вызывающего. Текст отказа строит обработчик,
 * то есть он лежит в черновике пробега и переживёт его только копией; а нужен
 * он дольше — его читают журнал, список отказов и решение надзора.
 */
static const char *fl_conc_keep_text(fl_conc_sched *sched, const char *text) {
  size_t bytes = 0;
  char *copy = NULL;
  if (text == NULL) {
    return "";
  }
  bytes = strlen(text);
  /* Арена вызывающего одна на прогон, а в рабочем режиме потоков много — значит
     выдача из неё идёт под общим замком. Тексты отказов редки (их строит только
     упавший пробег), поэтому в горячий путь этот замок не попадает. */
  fl_conc_big_lock(sched);
  copy = (char *)fl_arena_alloc(sched->home, bytes + 1);
  fl_conc_big_unlock(sched);
  if (copy == NULL) {
    return "";
  }
  memcpy(copy, text, bytes + 1);
  return copy;
}

/**
 * Текст отказа «ящик полон» (А3). Строится здесь, а не при печати программы,
 * потому что называет ИМЯ адресата и объявленный им потолок, а знает их только
 * план — и знает одинаково у свидетеля и у напечатанного C.
 */
static const char *fl_conc_full_text(fl_conc_sched *sched, size_t target) {
  char buffer[256];
  if (target == SIZE_MAX) {
    return "ящик адресата полон";
  }
  snprintf(buffer, sizeof(buffer), "ящик процесса «%s» полон: объявлен на %lu",
           fl_conc_node(sched, target)->name, (unsigned long)fl_conc_node(sched, target)->mailbox);
  return fl_conc_keep_text(sched, buffer);
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

/* ───────────────────────────── указатель имён ─────────────────────────────
   FNV-1a на 64 битах: три строки, ни одной таблицы, и переносится куда угодно
   один в один — тот же довод, по которому выбран mulberry32. Качество
   рассеивания здесь ни на что наблюдаемое не влияет: указатель отвечает на тот
   же вопрос, что отвечал перебор, и отвечает тем же номером. */

static uint64_t fl_conc_hash(const char *bytes, size_t count) {
  uint64_t hash = 14695981039346656037ull;
  size_t index = 0;
  for (index = 0; index < count; index += 1) {
    hash ^= (uint64_t)(unsigned char)bytes[index];
    hash *= 1099511628211ull;
  }
  return hash;
}

/** Совпадает ли имя процесса с байтами адреса. Строка-значение может быть
    срезом и не заканчиваться нулём, поэтому длина и байты, а не strcmp. */
static bool fl_conc_named(const fl_conc_sched *sched, size_t process, const char *bytes, size_t count) {
  const char *candidate = fl_conc_node(sched, process)->name;
  return strlen(candidate) == count && memcmp(candidate, bytes, count) == 0;
}

/**
 * Положить процесс в указатель. `false` — имя уже занято, и тогда выигрывает
 * ПЕРВЫЙ: то же правило, по которому работал перебор сверху и по которому
 * строится дерево надзора. Место всегда находится, потому что нагрузка держится
 * не выше половины (`fl_conc_index_build`).
 */
static bool fl_conc_index_put(fl_conc_sched *sched, size_t process) {
  const char *bytes = fl_conc_node(sched, process)->name;
  const size_t count = strlen(bytes);
  size_t at = (size_t)(fl_conc_hash(bytes, count) & (uint64_t)sched->names_mask);
  for (;;) {
    const uint32_t taken = sched->names[at];
    if (taken == 0u) {
      sched->names[at] = (uint32_t)(process + 1);
      sched->names_used += 1;
      return true;
    }
    if (fl_conc_named(sched, (size_t)taken - 1, bytes, count)) {
      return false;
    }
    at = (at + 1) & sched->names_mask;
  }
}

/** Перестроить указатель под `wanted` имён. Размер — степень двойки, вдвое
    больше нужного: половина пустых ячеек и есть та цена, за которую линейные
    пробы остаются короткими. */
static bool fl_conc_index_build(fl_conc_sched *sched, size_t wanted) {
  size_t size = 16;
  size_t index = 0;
  uint32_t *bigger = NULL;
  /* Сравнение переписано с `size < wanted * 2` на деление, потому что
     переполнялось именно произведение, а сторож стоял на удвоении `size`:
     при `wanted` больше половины разрядной сетки произведение свернулось бы,
     цикл не выполнился, таблица осталась бы на шестнадцати ячейках — и довод
     «таблица не бывает полной» рухнул бы вместе с завершаемостью пробы. */
  while (size / 2u < wanted) {
    if (size > ((size_t)-1) / 2u) {
      return false;
    }
    size *= 2u;
  }
  /* В местную переменную, а не сразу в поле: на нехватке памяти поле осталось
     бы нулевым при непустой маске, и следующий же поиск адресата разыменовал
     бы NULL. Сегодня оба вызывающих обрывают прогон немедленно, но полагаться
     на это значит держать заряженную ошибку для следующей правки. */
  bigger = (uint32_t *)fl_arena_alloc(sched->home, size * sizeof(uint32_t));
  if (bigger == NULL) {
    return false;
  }
  memset(bigger, 0, size * sizeof(uint32_t));
  sched->names = bigger;
  sched->names_mask = size - 1u;
  sched->names_used = 0;
  for (index = 0; index < sched->proc_count; index += 1) {
    fl_conc_index_put(sched, index);
  }
  return true;
}

/**
 * Место под `wanted` процессов: слоты, признаки готовности, очередь готовых,
 * связи надзора и рабочий список поддерева. Пять массивов растут ОДНОЙ ёмкостью
 * — иначе номер процесса, годный в одном из них, оказался бы негодным в другом.
 *
 * Первый вызов берёт ровно столько, сколько объявлено: на миллионе процессов
 * округление вверх до степени двойки стоило бы сотню мегабайт впустую. Дальше
 * растёт удвоением, как журнал и всё прочее здесь.
 */
static bool fl_conc_reserve(fl_conc_sched *sched, size_t wanted) {
  size_t next = sched->proc_capacity;
  fl_conc_slot *slots = NULL;
  size_t *rank = NULL;
  bool *is_ready = NULL;
  fl_conc_link *over = NULL;
  size_t *subtree = NULL;
  size_t index = 0;
  size_t step = 1u;
  if (wanted <= sched->proc_capacity) {
    return true;
  }
  if (next == 0) {
    next = wanted;
  }
  while (next < wanted) {
    if (next > ((size_t)-1) / 2u) {
      return false;
    }
    next *= 2u;
  }
  slots = (fl_conc_slot *)fl_arena_alloc(sched->home, next * sizeof(fl_conc_slot));
  /* Одним больше: дерево одноосновное, потому что младший установленный бит у
     нуля не определён, а на нём держится весь обход. */
  rank = (size_t *)fl_arena_alloc(sched->home, (next + 1u) * sizeof(size_t));
  is_ready = (bool *)fl_arena_alloc(sched->home, next * sizeof(bool));
  over = (fl_conc_link *)fl_arena_alloc(sched->home, next * sizeof(fl_conc_link));
  subtree = (size_t *)fl_arena_alloc(sched->home, next * sizeof(size_t));
  if (slots == NULL || rank == NULL || is_ready == NULL || over == NULL || subtree == NULL) {
    return false;
  }
  memset(rank, 0, (next + 1u) * sizeof(size_t));
  if (sched->proc_capacity > 0) {
    memcpy(slots, sched->slots, sched->proc_capacity * sizeof(fl_conc_slot));
    memcpy(is_ready, sched->is_ready, sched->proc_capacity * sizeof(bool));
    memcpy(over, sched->over_process, sched->proc_capacity * sizeof(fl_conc_link));
    /* Дерево ПЕРЕСОБИРАЕТСЯ, а не переносится: узел его хранит сумму по
       отрезку, а отрезки при другом размере другие. Сборка идёт за O(P), а не
       за O(P·log P): сперва в каждый узел кладётся свой признак, потом каждый
       узел один раз прибавляется к родителю. */
    for (index = 0; index < sched->proc_count; index += 1) {
      if (is_ready[index]) {
        rank[index + 1u] += 1u;
      }
    }
    for (index = 1u; index <= next; index += 1) {
      const size_t parent = index + (index & ((size_t)0 - index));
      if (parent <= next) {
        rank[parent] += rank[index];
      }
    }
  }
  while (step * 2u <= next) {
    step *= 2u;
  }
  sched->slots = slots;
  sched->rank = rank;
  sched->rank_size = next;
  sched->rank_step = step;
  sched->is_ready = is_ready;
  sched->over_process = over;
  sched->subtree = subtree;
  sched->proc_capacity = next;
  return true;
}

/**
 * Адресат «отправить» — значение-строка. Раньше здесь стоял цикл по всей
 * таблице процессов; теперь один хеш и короткая проба.
 */
static size_t fl_conc_address(const fl_conc_sched *sched, fl_value name) {
  size_t at = 0;
  if (name.tag != FL_STRING) {
    return SIZE_MAX;
  }
  at = (size_t)(fl_conc_hash(name.as.string.utf8, name.as.string.bytes) & (uint64_t)sched->names_mask);
  for (;;) {
    const uint32_t taken = sched->names[at];
    if (taken == 0u) {
      return SIZE_MAX;
    }
    if (fl_conc_named(sched, (size_t)taken - 1, name.as.string.utf8, name.as.string.bytes)) {
      return (size_t)taken - 1;
    }
    at = (at + 1) & sched->names_mask;
  }
}

/** Копия строки-значения в арену вызывающего с нулём на конце: для журнала и
    диагностик. Замок — по той же причине, что у `fl_conc_keep_text`. */
static const char *fl_conc_cstring(fl_conc_sched *sched, fl_value value) {
  char *text = NULL;
  if (value.tag != FL_STRING) {
    return "";
  }
  fl_conc_big_lock(sched);
  text = (char *)fl_arena_alloc(sched->home, value.as.string.bytes + 1);
  fl_conc_big_unlock(sched);
  if (text == NULL) {
    return "";
  }
  memcpy(text, value.as.string.utf8, value.as.string.bytes);
  text[value.as.string.bytes] = '\0';
  return text;
}

/* ───────────────────────────── очередь готовых ─────────────────────────────
 * ── Что здесь наблюдаемо, а что нет — и почему это надо назвать вслух ──────
 *
 * Долгое время здесь стоял отсортированный массив номеров, и трогать его
 * считалось нельзя: «семя выбирает номер В ЭТОМ массиве, значит порядок в
 * очереди готовых — часть наблюдаемого поведения». Первая половина верна,
 * вторая — нет, и различить их стоит того, чтобы сказать точно.
 *
 * Наблюдаемо не хранилище, а ДВЕ ФУНКЦИИ, и обе видны в свидетеле буквально
 * (`conc.mjs`: `порядок.filter(…)`, потом `готовые[floor(случайное() · длина)]`):
 *
 *   1. СКОЛЬКО процессов готово — на это умножается число из семени;
 *   2. КТО k-й ПО ВОЗРАСТАНИЮ НОМЕРА среди готовых — его и берут.
 *
 * Всё. Ни порядок в памяти, ни способ его держать наружу не видны ничем.
 * Значит любая структура, отвечающая на эти два вопроса теми же числами, даёт
 * ПОБАЙТОВО тот же журнал доставок — и это не рассуждение, а то, чем оно
 * проверяется: 5200 совпадений со свидетелем на 320 различных чередованиях
 * (`flang/test/emit-c-conc.test.mjs`). Сверка здесь не помеха правке, а её
 * единственное доказательство.
 *
 * ── Улика, ради которой это сделано ───────────────────────────────────────
 * Массив отвечал на второй вопрос за O(1), а стоил O(готовых) на КАЖДОМ
 * изменении: два `memmove` половины списка на пробег. Замер
 * (`docs/scheduler-benchmark.md`, раздел 5) назвал это числом: переключение
 * стоит 88,1 мкс при 480 000 одновременно готовых процессов, наклон
 * 0,172 нс на готовый процесс, а на миллионе выходило бы около 170 мкс, то
 * есть примерно 5 900 переключений в секунду. Это и было последней стенкой
 * между «миллион молчащих процессов» и «миллион работающих».
 *
 * ── Чем заменено ──────────────────────────────────────────────────────────
 * Дерево частичных сумм (Фенвика) над признаком «готов». `rank[i]` хранит сумму
 * признаков на отрезке длиной в младший установленный бит `i`, кончающемся на
 * `i`. Отсюда:
 *
 *   • стало готово / перестало  — O(log P): `fl_conc_rank_add`;
 *   • кто k-й по возрастанию    — O(log P): `fl_conc_select`, спуск по битам;
 *   • сколько готовых           — O(1): счётчик `ready_count`, как и был.
 *
 * Памяти ровно столько же, сколько занимал массив: по одному `size_t` на
 * процесс (плюс один на одноосновность). Порядок перечисления — по-прежнему
 * порядок объявления, потому что номер процесса и есть порядок объявления, а
 * дерево ходит по номерам.
 */

/**
 * Прибавить к дереву единицу (процесс стал готов) или отнять (перестал).
 *
 * Один и тот же обход на оба случая, потому что «стало» и «перестало» — не два
 * разных действия, а одно с разным знаком: разъехались бы они, разъехались бы
 * молча.
 */
static void fl_conc_rank_add(fl_conc_sched *sched, size_t index, bool more) {
  size_t at = index + 1u;
  while (at <= sched->rank_size) {
    if (more) {
      sched->rank[at] += 1u;
    } else {
      sched->rank[at] -= 1u;
    }
    /* Следующий узел, покрывающий этот: прибавить младший установленный бит. */
    at += at & ((size_t)0 - at);
  }
}

/**
 * Номер k-го ПО ВОЗРАСТАНИЮ готового процесса, k считается от нуля.
 *
 * Тот же самый процесс, который вернул бы `готовые[k]` у свидетеля, — и это
 * утверждение, которое проверяется побайтовой сверкой журнала, а не обещается.
 * Спуск по степеням двойки: на каждом шаге либо шагнули вправо, вычтя сумму
 * пройденного отрезка, либо нет.
 *
 * Зовётся только когда `ready_count` больше нуля, поэтому «не нашлось» здесь
 * невозможно: k строго меньше числа готовых, значит спуск обязан остановиться
 * на готовом.
 */
static size_t fl_conc_select(const fl_conc_sched *sched, size_t k) {
  size_t at = 0;
  size_t step = sched->rank_step;
  size_t left = k;
  for (; step > 0; step >>= 1) {
    const size_t next = at + step;
    if (next <= sched->rank_size && sched->rank[next] <= left) {
      at = next;
      left -= sched->rank[at];
    }
  }
  /* `at` — одноосновный номер последнего пройденного, значит искомый ровно он:
     одноосновный `at + 1` это нольосновный `at`. */
  return at;
}

/**
 * Привести очередь готовых в согласие с процессом: готов он тогда и только
 * тогда, когда жив и в ящике что-то есть. Зовётся после КАЖДОГО изменения
 * жизни или ящика — пропуск такого вызова означал бы, что журнал зависит не
 * только от семени, а это и есть та единственная ошибка, которой здесь нельзя.
 */
static void fl_conc_refresh(fl_conc_sched *sched, size_t index, size_t via) {
  const bool wanted = sched->slots[index].alive && sched->slots[index].box.count > 0;
  /* В сборке без потоков складов нет вовсе, и «на чей склад класть» — вопрос без
     смысла. Параметр остаётся в подписи, чтобы у двух сборок был один и тот же
     набор вызовов: разойдись они, разница между сборками перестала бы быть
     одним выключателем. */
  (void)via;
#ifdef FL_CONC_THREADS
  /* Рабочий режим. Дерева рангов здесь нет вовсе, и это не небрежность, а прямое
     следствие того, что размениваем: очередь готовых наблюдаема только через
     семя, а семя в этом режиме ничего не выбирает. Значит и отвечать на «кто k-й
     по возрастанию» здесь не надо ни за какую цену — работу разбирают складами и
     подворовыванием.

     Зовётся только с ВЗЯТЫМ замком этого процесса: признак и ящик ходят под ним
     вместе, иначе один поток решал бы «готов» по ящику, который другой в это
     время опустошает.

     Снимать со склада переставший быть готовым не нужно и нечем: поток,
     добравшись до него, увидит пустой ящик и вернёт его в покой. Лишний обход
     склада дешевле, чем удаление из середины очереди. */
  if (sched->par != NULL) {
    fl_conc_par *par = sched->par;
    if (!wanted || par->state[index] != FL_CONC_IDLE) {
      return;
    }
    par->state[index] = FL_CONC_QUEUED;
    par->next[index] = SIZE_MAX;
    {
      /* Кладём на СВОЙ склад, а не на «склад номер процесса по остатку». Разница
         измерена и велика: при раскладке по остатку все потоки пишут во все
         склады, и на стенде «пары» (каждая пара — свой пинг-понг, ящик всегда с
         одним письмом) шестнадцать потоков давали 1,15× при пятнадцати занятых
         ядрах — то есть выигрыш от ядер ровно съедался толкотнёй на замках
         складов. Свой склад пишет почти только его хозяин, а работу разбирают
         подворовыванием. */
      fl_conc_shard *shard = &par->shards[(via == SIZE_MAX ? index : via) % par->workers];
      pthread_mutex_lock(&shard->lock);
      if (shard->head == SIZE_MAX) {
        shard->head = index;
      } else {
        par->next[shard->tail] = index;
      }
      shard->tail = index;
      pthread_mutex_unlock(&shard->lock);
    }
    return;
  }
#endif
  if (wanted == sched->is_ready[index]) {
    return;
  }
  fl_conc_rank_add(sched, index, wanted);
  if (wanted) {
    sched->ready_count += 1;
  } else {
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
  const size_t limit = fl_conc_node(sched, target)->mailbox;
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
static fl_conc_post fl_conc_deliver(fl_conc_sched *sched, const fl_ctx *guard, size_t via, size_t target,
                                    fl_value message, bool front, bool reserved) {
  fl_conc_slot *slot = NULL;
  fl_arena *heap = NULL;
  fl_value copy = fl_nothing();
  fl_conc_post posted = FL_CONC_POSTED;
  if (target == SIZE_MAX) {
    return FL_CONC_NOBODY;
  }
  /* Замок адресата берётся ЗДЕСЬ и держится до конца доставки: ящик и куча
     адресата — единственное, что отправитель у него трогает, и трогает он их
     ровно тогда, когда владелец может вычерпывать тот же ящик. В проверочном
     режиме это пустой вызов. */
  fl_conc_hold(sched, target);
  if (!sched->slots[target].alive) {
    fl_conc_drop(sched, target);
    return FL_CONC_NOBODY;
  }
  if (!reserved && fl_conc_box_full(sched, target)) {
    fl_conc_drop(sched, target);
    return FL_CONC_FULL;
  }
  slot = &sched->slots[target];
  heap = &slot->heap[slot->live];
  /* Копия — это и есть выбор А0. Сообщение переезжает в кучу АДРЕСАТА, потому
     что куча отправителя будет стёрта, как только его пробег кончится, а
     черновик — сразу после. Проверка «жив ли адресат» стоит раньше копии
     намеренно: мёртвому не пишут, и платить за копию письма, которое некуда
     положить, незачем. */
  if (!fl_conc_keep(guard, heap, message, &copy)) {
    posted = FL_CONC_NOMEM;
  } else if (!fl_conc_box_push(heap, &slot->box, copy, front)) {
    posted = FL_CONC_NOMEM;
  } else {
    fl_conc_refresh(sched, target, via);
  }
  fl_conc_drop(sched, target);
  return posted;
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

/** Известные действия — те же СЕМЬ, что вводит язык суммой «Действие». */
static bool fl_conc_known_action(const char *name) {
  return strcmp(name, "отправить") == 0 || strcmp(name, "через") == 0 ||
         strcmp(name, "остановить") == 0 || strcmp(name, "отложить") == 0 ||
         strcmp(name, "продолжить") == 0 || strcmp(name, "породить") == 0 ||
         strcmp(name, "поручить") == 0;
}

/* ───────────────────────────── хозяин ввода-вывода ─────────────────────────
   Седьмое действие (`поручить`) даёт процессу выдать ПОРУЧЕНИЕ и получить
   отклик обычным сообщением. Поручение ОПИСЫВАЕТСЯ языком — это значение
   закрытой суммы «Поручение», — а исполняет его ХОЗЯИН: среда, в которую
   напечатан модуль. Вот она, эта среда, для цели C, и она здесь одна на весь
   файл: единственное место планировщика, где есть `fopen` и `time`.

   Поручения, которые эта среда исполняет или называет отказом (остальные —
   каталог, процесс, экран — падают в общий `FLANG_IO_UNKNOWN` внизу):

     «Прочитать файл»   — `fopen`/`fread`, отклик «Прочитано»;
     «Записать файл»    — `fopen`/`fwrite`, отклик «Записано» с числом КОДОВЫХ
                          ТОЧЕК, а не байтов: так считает `длина` в языке, и два
                          разных числа об одном файле были бы ложью;
     «Текущее время»    — `time(NULL)` в миллисекундах;
     «Случайное число»  — тот же mulberry32, что ведёт чередование, но своим
                          состоянием: брать числа у планировщика значило бы
                          сделать чередование зависящим от того, сколько раз
                          программа бросила кости;
     «Запросить»        — НАЗВАННЫЙ ОТКАЗ `«Сбой»` с кодом FLANG_IO_NET. HTTP на
                          голом C99 без внешней библиотеки не пишется, а
                          притворяться нечем. Тот же код и по тому же доводу
                          отдаёт хозяин Node, когда ходить в сеть нечем: для
                          программы «сети не дали» и «сеть не ответила» — один
                          путь, и он один и проверен;
     шесть поручений СОЕДИНЕНИЯ («Открыть соединение», «Принять соединение»,
                          «Прочитать из соединения», «Ответить в соединение»,
                          «Прочитать октеты из соединения», «Ответить октетами
                          в соединение») —
                          ИСПОЛНЯЮТСЯ, и это единственное поручение среди
                          восемнадцати, чей отклик может прийти НЕ В ТОМ ЖЕ
                          пробеге. Здесь стоял названный отказ «нет способа
                          ждать сеть»; ждать и правда никто не стал — сокет
                          неблокирующий, а поручение, которому ответить нечем,
                          ждёт своей готовности в `poll` (см. «сеть: опрос»).
                          Долг остался у `«Запросить»` и только у него.

   Отказ хозяина — ОТКЛИК, а не ошибка прогона. Это решение приезжает готовым с
   той стороны шва (`flang/src/io.mjs`): программа обязана уметь встретить
   неудачу поручения, а «файла нет» ничем не отличается от «сеть упала».
   Возвращается FL_ERROR только на нехватке памяти в арене — на том, что к
   модели отношения не имеет. */

/**
 * Часы хозяина — В МИЛЛИСЕКУНДАХ, а не в секундах, умноженных на тысячу.
 *
 * Здесь стояло `time(NULL) * 1000.0`, и это была не мелочь округления, а
 * непригодность: замер пятью прогонами подряд давал 1787191329000 все пять раз,
 * при настоящем времени 1787191329259. То есть поручение «Текущее время»
 * отвечало с точностью до СЕКУНДЫ.
 *
 * Чем это ломается, видно на распределённости: узел шлёт признак жизни раз в
 * 200 мс и объявляет связь потерянной после 1000 мс молчания. На часах с шагом
 * в секунду «прошло 200 мс» неотличимо от «не прошло нисколько», и срок
 * перестаёт быть числом. Ровно те же часы нужны всякому, кто меряет свою
 * работу: «сколько заняло» на таких часах — это 0 или 1000.
 *
 * `clock_gettime(CLOCK_REALTIME)` — POSIX.1-2001, и живёт под тем же условием,
 * под которым в этом файле уже живут потоки. Где его нет, остаётся старое
 * поведение: точность хуже, но ответ есть, и это лучше отказа.
 *
 * CLOCK_REALTIME, а не CLOCK_MONOTONIC, и это выбор, а не привычка: поручение
 * называется «Текущее время», и программа вправе ждать от него отметку,
 * сравнимую с отметкой на другой машине. Монотонные часы такой отметки не дают
 * вовсе — у них ноль там, где случилась загрузка.
 */
static double fl_conc_now_ms(void) {
#if defined(FL_CONC_THREADS) && defined(CLOCK_REALTIME)
  struct timespec now;
  if (clock_gettime(CLOCK_REALTIME, &now) == 0) {
    /* Целое число миллисекунд, а не дробное. Точности у `clock_gettime` хватает
       и на наносекунды, но `Date.now()` у хозяина на Node — целое, а два хозяина
       одного языка обязаны отвечать на одно поручение значением одного вида.
       Лишняя точность здесь стоила бы того, что «Отметка времени» у двух целей
       перестала бы быть одним и тем же числом. */
    return floor((double)now.tv_sec * 1000.0 + (double)now.tv_nsec / 1000000.0);
  }
#endif
  return (double)time(NULL) * 1000.0;
}

static const char *const FL_CONC_NO_HOST = "FLANG_IO_NO_HOST";
/* Текст без единой подстановки, и это условие, а не лаконизм: тот же текст
   выдаёт свидетель (`conc.mjs`, `NO_HOST_TEXT`), а журналы сверяются побайтово. */
static const char *const FL_CONC_NO_HOST_TEXT =
    "у прогона нет хозяина: поручение описано, а исполнить его некому";

/** Отклик `«Сбой» с код … и сообщение …` — строится в арене вызывающего. */
static fl_status fl_conc_io_fail(fl_ctx *ctx, const char *code, const char *text, fl_value *out,
                                 fl_error *error) {
  static const char *const names[2] = {"код", "сообщение"};
  fl_value values[2];
  if (fl_text(ctx, code, strlen(code), &values[0], error) != FL_OK) {
    return FL_ERROR;
  }
  if (fl_text(ctx, text, strlen(text), &values[1], error) != FL_OK) {
    return FL_ERROR;
  }
  return fl_variant_new(ctx, "Сбой", names, values, 2, out, error);
}

/** Строка поля поручения с нулём на конце, во временной памяти вызывающего. */
static const char *fl_conc_io_text(fl_ctx *ctx, fl_value order, const char *field) {
  fl_value value = fl_nothing();
  char *text = NULL;
  if (!fl_conc_variant_field(order, field, &value) || value.tag != FL_STRING) {
    return NULL;
  }
  text = (char *)fl_arena_alloc(ctx->arena, value.as.string.bytes + 1);
  if (text == NULL) {
    return NULL;
  }
  memcpy(text, value.as.string.utf8, value.as.string.bytes);
  text[value.as.string.bytes] = '\0';
  return text;
}

/* ───────────────────────────── сеть: хозяйство ────────────────────────────
   Ниже — ровно то, что уже есть у хозяина планов (`flang_repl.c`), с одной
   разницей: каждый сокет здесь неблокирующий. Разница эта и есть вся работа. */
#ifdef FL_CONC_NET

/** Неблокирующий режим сокета. Отсюда и дальше ни один вызов не ждёт. */
static bool fl_conc_net_relax(int fd) {
  const int flags = fcntl(fd, F_GETFL, 0);
  return flags >= 0 && fcntl(fd, F_SETFL, flags | O_NONBLOCK) == 0;
}

/**
 * Слушающий сокет порта: заводится при первом же «Принять соединение» и живёт до
 * конца прогона. Порт называется в поручении, отдельного «Слушать» в словаре
 * нет — и не понадобилось, ровно как у хозяина планов.
 */
static int fl_conc_net_listen(fl_conc_sched *sched, int port, char *why, size_t why_size) {
  size_t index = 0;
  int fd = -1;
  int yes = 1;
  struct sockaddr_in address;
  for (index = 0; index < sched->port_count; index += 1) {
    if (sched->ports[index].port == port) {
      return sched->ports[index].fd;
    }
  }
  if (sched->port_count == FL_CONC_NET_PORTS) {
    snprintf(why, why_size, "хозяин слушает уже %d портов — больше некуда", FL_CONC_NET_PORTS);
    return -1;
  }
  fd = socket(AF_INET, SOCK_STREAM, 0);
  if (fd < 0) {
    snprintf(why, why_size, "сокет не заведён: %s", strerror(errno));
    return -1;
  }
  (void)setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &yes, sizeof(yes));
  memset(&address, 0, sizeof(address));
  address.sin_family = AF_INET;
  address.sin_addr.s_addr = htonl(INADDR_ANY);
  address.sin_port = htons((unsigned short)port);
  if (bind(fd, (struct sockaddr *)&address, sizeof(address)) != 0 || listen(fd, 16) != 0) {
    snprintf(why, why_size, "порт %d не занят хозяином: %s", port, strerror(errno));
    close(fd);
    return -1;
  }
  if (!fl_conc_net_relax(fd)) {
    snprintf(why, why_size, "слушающий сокет не стал неблокирующим: %s", strerror(errno));
    close(fd);
    return -1;
  }
  sched->ports[sched->port_count].port = port;
  sched->ports[sched->port_count].fd = fd;
  sched->port_count += 1;
  return fd;
}

static int fl_conc_wire_fd(const fl_conc_sched *sched, int number) {
  size_t index = 0;
  for (index = 0; index < sched->wire_count; index += 1) {
    if (sched->wires[index].number == number) {
      return sched->wires[index].fd;
    }
  }
  return -1;
}

/* Открыла ли соединение сама программа. Неизвестное — «нет»: до этого вопроса
   дело доходит только после того, как соединение нашлось. */
static bool fl_conc_wire_outgoing(const fl_conc_sched *sched, int number) {
  size_t index = 0;
  for (index = 0; index < sched->wire_count; index += 1) {
    if (sched->wires[index].number == number) {
      return sched->wires[index].outgoing;
    }
  }
  return false;
}

static void fl_conc_wire_drop(fl_conc_sched *sched, int number) {
  size_t index = 0;
  for (index = 0; index < sched->wire_count; index += 1) {
    if (sched->wires[index].number == number) {
      sched->wires[index] = sched->wires[sched->wire_count - 1];
      sched->wire_count -= 1;
      return;
    }
  }
}

/** Записать соединение и выдать ему номер; −1 — мест больше нет. */
static int fl_conc_wire_add(fl_conc_sched *sched, int fd, bool outgoing) {
  int number = 0;
  if (sched->wire_count == FL_CONC_NET_LINKS) {
    return -1;
  }
  number = sched->next_wire;
  sched->wires[sched->wire_count].number = number;
  sched->wires[sched->wire_count].fd = fd;
  sched->wires[sched->wire_count].outgoing = outgoing;
  sched->wire_count += 1;
  sched->next_wire += 1;
  return number;
}

/**
 * Завести ожидание. Место в ящике адресата занимается ВЫЗЫВАЮЩИМ и до сюда, а
 * не здесь: полный ящик — отказ ТОГО, КТО ПОРУЧИЛ, и узнать о нём он обязан на
 * своём пробеге, а не через полсекунды устами опроса.
 */
static fl_conc_wait *fl_conc_wait_push(fl_conc_sched *sched, fl_conc_wait_kind kind, int fd, int number,
                                       size_t target, bool reserved) {
  fl_conc_wait *wait = NULL;
  if (sched->wait_count == FL_CONC_NET_LINKS) {
    return NULL;
  }
  wait = &sched->waits[sched->wait_count];
  memset(wait, 0, sizeof(*wait));
  wait->kind = kind;
  wait->fd = fd;
  wait->number = number;
  wait->target = target;
  wait->reserved = reserved;
  sched->wait_count += 1;
  return wait;
}

static void fl_conc_wait_drop(fl_conc_sched *sched, size_t index) {
  free(sched->waits[index].body);
  memmove(sched->waits + index, sched->waits + index + 1,
          (sched->wait_count - index - 1) * sizeof(fl_conc_wait));
  sched->wait_count -= 1;
}

/* EAGAIN и EWOULDBLOCK на большинстве систем одно и то же число. Спрашивать их
   двумя сравнениями подряд значило бы писать `x != 1 && x != 1`; препроцессор
   умеет это различить, компилятор — уже нет. */
static bool fl_conc_net_again(int problem) {
#if defined(EWOULDBLOCK) && EWOULDBLOCK != EAGAIN
  if (problem == EWOULDBLOCK) {
    return true;
  }
#endif
  return problem == EAGAIN;
}

/**
 * Занять место в ящике адресата ПОД БУДУЩИЙ отклик — тем же движением, каким его
 * занимает `через`. Без этого полный ящик обнаружился бы через полсекунды, в
 * опросе, и отвечать за него было бы некому: пробег того, кто поручил, к тому
 * времени давно кончился. `false` — ящик полон.
 */
static bool fl_conc_net_reserve(fl_conc_sched *sched, size_t target, bool *reserved) {
  bool full = false;
  *reserved = false;
  if (target == SIZE_MAX || fl_conc_node(sched, target)->mailbox == 0) {
    return true;
  }
  fl_conc_hold(sched, target);
  full = fl_conc_box_full(sched, target);
  if (!full) {
    sched->slots[target].pending += 1;
    *reserved = true;
  }
  fl_conc_drop(sched, target);
  return !full;
}

static void fl_conc_net_release(fl_conc_sched *sched, size_t target, bool reserved) {
  if (!reserved) {
    return;
  }
  fl_conc_hold(sched, target);
  sched->slots[target].pending -= 1;
  fl_conc_drop(sched, target);
}

/**
 * Отклик на чтение — один на оба поручения чтения и на оба места, где чтение
 * случается (поручение и опрос). Пустой отклик — КОНЕЦ: сюда попадают только
 * после того, как связь кончилась, а «байтов ещё нет» до сюда не доходит вовсе.
 */
static fl_status fl_conc_net_read_answer(fl_ctx *ctx, const unsigned char *chunk, long got, bool octets,
                                         fl_value *out, fl_error *error) {
  const size_t count = got > 0 ? (size_t)got : 0;
  if (octets) {
    static const char *const names[1] = {"октеты"};
    fl_value *items = NULL;
    fl_value value = fl_nothing();
    size_t at = 0;
    if (fl_list_alloc(ctx, count, &items, error) != FL_OK) {
      return FL_ERROR;
    }
    for (at = 0; at < count; at += 1) {
      items[at] = fl_number((double)chunk[at]);
    }
    value = fl_list(items, count);
    return fl_variant_new(ctx, "Октеты", names, &value, 1, out, error);
  }
  {
    static const char *const names[1] = {"содержимое"};
    fl_value value = fl_nothing();
    if (fl_text(ctx, (const char *)chunk, count, &value, error) != FL_OK) {
      return FL_ERROR;
    }
    return fl_variant_new(ctx, "Прочитано", names, &value, 1, out, error);
  }
}

/** Число из поля поручения; false — поля нет или оно не число. */
static bool fl_conc_io_number(fl_value order, const char *field, double *out) {
  fl_value value = fl_nothing();
  if (!fl_conc_variant_field(order, field, &value) || value.tag != FL_NUMBER) {
    return false;
  }
  *out = value.as.number;
  return true;
}
#endif /* FL_CONC_NET */

/**
 * Исполнить поручение. Всегда отдаёт ОТКЛИК — значение суммы «Отклик»; FL_ERROR
 * только на нехватке памяти.
 *
 * ТРИ ИСХОДА, а не два, и третий появился вместе с сетью:
 *   • отклик готов — он в `out`, `*deferred` не тронут;
 *   • отклик придёт ПОТОМ — `*deferred` в «да», `out` не тронут, поручение
 *     лежит в списке ожиданий и отвечать за него будет опрос;
 *   • отклик нести некуда — `*posted` в `FL_CONC_FULL`: ящик адресата полон, и
 *     это отказ того, кто поручил, ровно как у `отправить`.
 * Первый исход — единственный, который был до сети, и на всяком поручении, кроме
 * шести соединения, он единственный и остался.
 */
static fl_status fl_conc_perform(fl_conc_sched *sched, fl_ctx *ctx, fl_value order, size_t target,
                                 fl_value *out, bool *deferred, fl_conc_post *posted, fl_error *error) {
  const char *kind = NULL;
  *deferred = false;
  *posted = FL_CONC_POSTED;
  (void)target;
  if (order.tag != FL_VARIANT) {
    return fl_conc_io_fail(ctx, "FLANG_IO", "поручение обязано быть вариантом суммы «Поручение»", out, error);
  }
  kind = order.as.variant->name;
  if (!sched->host) {
    return fl_conc_io_fail(ctx, FL_CONC_NO_HOST, FL_CONC_NO_HOST_TEXT, out, error);
  }

  if (strcmp(kind, "Прочитать файл") == 0) {
    static const char *const names[1] = {"содержимое"};
    const char *path = fl_conc_io_text(ctx, order, "путь");
    fl_value value = fl_nothing();
    char *buffer = NULL;
    size_t filled = 0;
    size_t capacity = 4096;
    FILE *file = NULL;
    if (path == NULL || path[0] == '\0') {
      return fl_conc_io_fail(ctx, "FLANG_IO_PATH", "поручению нужен непустой путь", out, error);
    }
    file = fopen(path, "rb");
    if (file == NULL) {
      return fl_conc_io_fail(ctx, "FLANG_IO_READ", "файл не открылся", out, error);
    }
    /* Читается кусками и в арену: размер файла заранее не спрашивается нарочно —
       `fseek`/`ftell` не обязаны работать на всём, что открывается, а на трубе
       врут. Удвоение даёт тот же порядок обращений, что у арены. */
    buffer = (char *)fl_arena_alloc(ctx->arena, capacity);
    for (;;) {
      size_t got = 0;
      if (buffer == NULL) {
        fclose(file);
        return fl_conc_io_fail(ctx, "FLANG_IO_READ", "не хватило памяти под содержимое файла", out, error);
      }
      got = fread(buffer + filled, 1, capacity - filled, file);
      filled += got;
      if (filled < capacity) {
        break;
      }
      {
        char *bigger = (char *)fl_arena_alloc(ctx->arena, capacity * 2);
        if (bigger != NULL) {
          memcpy(bigger, buffer, filled);
        }
        buffer = bigger;
        capacity *= 2;
      }
    }
    fclose(file);
    /* Отклик несёт СТРОКУ, а строка языка — UTF-8. Двоичный файл строкой не
       бывает: счёт знаков на нём соврал бы молча (13 886 504 октета назывались
       11 776 136 знаками). Отказ лучше испорченного значения, и он называет
       поручение, которым это содержимое возится без потерь. Вопрос задаётся
       рантайму — тот же, что задаёт хозяин `flang io`. */
    if (fl_utf8_not_text_at(buffer, filled) > 0) {
      return fl_conc_io_fail(ctx, "FLANG_IO_NOT_TEXT",
                             "файл не текст: содержимое не складывается в UTF-8; октеты возит «Прочитать октеты из файла»",
                             out, error);
    }
    if (fl_text(ctx, buffer, filled, &value, error) != FL_OK) {
      return FL_ERROR;
    }
    return fl_variant_new(ctx, "Прочитано", names, &value, 1, out, error);
  }

  if (strcmp(kind, "Записать файл") == 0) {
    static const char *const names[1] = {"сколько"};
    const char *path = fl_conc_io_text(ctx, order, "путь");
    fl_value content = fl_nothing();
    fl_value value = fl_nothing();
    FILE *file = NULL;
    if (path == NULL || path[0] == '\0') {
      return fl_conc_io_fail(ctx, "FLANG_IO_PATH", "поручению нужен непустой путь", out, error);
    }
    if (!fl_conc_variant_field(order, "содержимое", &content) || content.tag != FL_STRING) {
      return fl_conc_io_fail(ctx, "FLANG_IO_WRITE", "поручению нужно содержимое строкой", out, error);
    }
    if (fl_utf8_not_text_at(content.as.string.utf8, content.as.string.bytes) > 0) {
      return fl_conc_io_fail(ctx, "FLANG_IO_NOT_TEXT",
                             "содержимое не текст: не складывается в UTF-8; октеты возит «Записать октеты в файл»",
                             out, error);
    }
    file = fopen(path, "wb");
    if (file == NULL) {
      return fl_conc_io_fail(ctx, "FLANG_IO_WRITE", "файл не открылся на запись", out, error);
    }
    if (content.as.string.bytes > 0 &&
        fwrite(content.as.string.utf8, 1, content.as.string.bytes, file) != content.as.string.bytes) {
      fclose(file);
      return fl_conc_io_fail(ctx, "FLANG_IO_WRITE", "запись не удалась", out, error);
    }
    fclose(file);
    /* Кодовые точки, а не байты: `длина` в языке считает точки, и «записано»
       обязано совпадать с ней на том же тексте. */
    value = fl_number((double)content.as.string.points);
    return fl_variant_new(ctx, "Записано", names, &value, 1, out, error);
  }

  /* ── Убрать и завести ─────────────────────────────────────────────────────
     Оба поручения исполняются тем же кодом, что у хозяина `flang io`, и по той
     же причине, что октетная пара: они синхронны, планировщику ждать нечего.
     Пути здесь берутся как даны — правила «внутри каталога» у этого хозяина нет
     вовсе (его нет и у чтения с записью выше), и заводить его на одном
     поручении значило бы отвечать двумя разными правилами на один словарь. */
  if (strcmp(kind, "Удалить файл") == 0) {
    const char *path = fl_conc_io_text(ctx, order, "путь");
    if (path == NULL || path[0] == '\0') {
      return fl_conc_io_fail(ctx, "FLANG_IO_PATH", "поручению нужен непустой путь", out, error);
    }
    if (remove(path) != 0) {
      return fl_conc_io_fail(ctx, "FLANG_IO_REMOVE", "имя не убрано", out, error);
    }
    return fl_variant_new(ctx, "Убрано", NULL, NULL, 0, out, error);
  }

  if (strcmp(kind, "Завести временный каталог") == 0) {
    static const char *const names[1] = {"путь"};
    const char *given = fl_conc_io_text(ctx, order, "образец");
    fl_value value = fl_nothing();
    char *pattern = NULL;
    size_t bytes = 0;
    if (given == NULL || given[0] == '\0') {
      return fl_conc_io_fail(ctx, "FLANG_IO_PATH", "поручению нужен непустой образец", out, error);
    }
    bytes = strlen(given);
    pattern = (char *)fl_arena_alloc(ctx->arena, bytes + 7);
    if (pattern == NULL) {
      return fl_conc_io_fail(ctx, "FLANG_IO_TEMPDIR", "не хватило памяти под имя каталога", out, error);
    }
    memcpy(pattern, given, bytes);
    memcpy(pattern + bytes, "XXXXXX", 7);
    if (mkdtemp(pattern) == NULL) {
      return fl_conc_io_fail(ctx, "FLANG_IO_TEMPDIR", "временный каталог не заведён", out, error);
    }
    if (fl_text(ctx, pattern, bytes + 6, &value, error) != FL_OK) {
      return FL_ERROR;
    }
    return fl_variant_new(ctx, "Заведено", names, &value, 1, out, error);
  }

  /* ── Октетная пара у файлов ────────────────────────────────────────────────
     Барьера, которым отговорены шесть поручений соединения, у файла нет: чтение
     и запись файла синхронны, планировщику ждать нечего. Поэтому здесь пара
     ИСПОЛНЯЕТСЯ, а не отговаривается, и исполняется тем же кодом, что у хозяина
     `flang io`: список чисел из [0, 255], длина — у списка, нулевой октет —
     обычное число. Разойтись двум хозяинам на этих поручениях негде: переводить
     нечего. */
  if (strcmp(kind, "Прочитать октеты из файла") == 0) {
    static const char *const names[1] = {"октеты"};
    const char *path = fl_conc_io_text(ctx, order, "путь");
    fl_value value = fl_nothing();
    fl_value *items = NULL;
    unsigned char *buffer = NULL;
    size_t filled = 0;
    size_t capacity = 4096;
    size_t at = 0;
    FILE *file = NULL;
    if (path == NULL || path[0] == '\0') {
      return fl_conc_io_fail(ctx, "FLANG_IO_PATH", "поручению нужен непустой путь", out, error);
    }
    file = fopen(path, "rb");
    if (file == NULL) {
      return fl_conc_io_fail(ctx, "FLANG_IO_READ", "файл не открылся", out, error);
    }
    buffer = (unsigned char *)fl_arena_alloc(ctx->arena, capacity);
    for (;;) {
      size_t got = 0;
      if (buffer == NULL) {
        fclose(file);
        return fl_conc_io_fail(ctx, "FLANG_IO_READ", "не хватило памяти под содержимое файла", out, error);
      }
      got = fread(buffer + filled, 1, capacity - filled, file);
      filled += got;
      if (filled < capacity) {
        break;
      }
      {
        unsigned char *bigger = (unsigned char *)fl_arena_alloc(ctx->arena, capacity * 2);
        if (bigger != NULL) {
          memcpy(bigger, buffer, filled);
        }
        buffer = bigger;
        capacity *= 2;
      }
    }
    fclose(file);
    if (fl_list_alloc(ctx, filled, &items, error) != FL_OK) {
      return FL_ERROR;
    }
    for (at = 0; at < filled; at += 1) {
      items[at] = fl_number((double)buffer[at]);
    }
    value = fl_list(items, filled);
    return fl_variant_new(ctx, "Октеты", names, &value, 1, out, error);
  }

  if (strcmp(kind, "Записать октеты в файл") == 0) {
    static const char *const names[1] = {"сколько"};
    const char *path = fl_conc_io_text(ctx, order, "путь");
    fl_value octets = fl_nothing();
    fl_value value = fl_nothing();
    unsigned char *bytes = NULL;
    size_t count = 0;
    size_t at = 0;
    FILE *file = NULL;
    if (path == NULL || path[0] == '\0') {
      return fl_conc_io_fail(ctx, "FLANG_IO_PATH", "поручению нужен непустой путь", out, error);
    }
    if (!fl_conc_variant_field(order, "октеты", &octets) || octets.tag != FL_LIST) {
      return fl_conc_io_fail(ctx, "FLANG_IO_OCTETS", "поручению нужен список октетов, а дан не список", out,
                             error);
    }
    count = octets.as.list.count;
    if (count > 0) {
      bytes = (unsigned char *)fl_arena_alloc(ctx->arena, count);
      if (bytes == NULL) {
        return fl_conc_io_fail(ctx, "FLANG_IO_WRITE", "не хватило памяти под октеты", out, error);
      }
    }
    for (at = 0; at < count; at += 1) {
      const fl_value item = octets.as.list.items[at];
      if (item.tag != FL_NUMBER || item.as.number < 0 || item.as.number > 255 ||
          item.as.number != (double)(long)item.as.number) {
        return fl_conc_io_fail(ctx, "FLANG_IO_OCTETS", "октет не годится: нужно целое от 0 до 255", out, error);
      }
      bytes[at] = (unsigned char)(long)item.as.number;
    }
    file = fopen(path, "wb");
    if (file == NULL) {
      return fl_conc_io_fail(ctx, "FLANG_IO_WRITE", "файл не открылся на запись", out, error);
    }
    if (count > 0 && fwrite(bytes, 1, count, file) != count) {
      fclose(file);
      return fl_conc_io_fail(ctx, "FLANG_IO_WRITE", "запись не удалась", out, error);
    }
    fclose(file);
    value = fl_number((double)count);
    return fl_variant_new(ctx, "Записано", names, &value, 1, out, error);
  }

  if (strcmp(kind, "Текущее время") == 0) {
    static const char *const names[1] = {"миллисекунды"};
    fl_value value = fl_number(fl_conc_now_ms());
    return fl_variant_new(ctx, "Отметка времени", names, &value, 1, out, error);
  }

  if (strcmp(kind, "Случайное число") == 0) {
    static const char *const names[1] = {"значение"};
    /* Своё состояние, не планировщиково: чередование не должно зависеть от того,
       сколько раз программа бросила кости. */
    fl_value value = fl_number(fl_conc_random(&sched->dice));
    return fl_variant_new(ctx, "Выпало", names, &value, 1, out, error);
  }

  if (strcmp(kind, "Запросить") == 0) {
    return fl_conc_io_fail(ctx, "FLANG_IO_NET",
                           "у хозяина на C нет способа сходить в сеть: HTTP в рантайм не входит", out,
                           error);
  }

#ifdef FL_CONC_NET
  /* ── ШЕСТЬ ПОРУЧЕНИЙ СОЕДИНЕНИЯ ─────────────────────────────────────────
     Здесь стоял названный отказ: «у хозяина на C нет способа ждать сеть:
     планировщик процессов не ждёт». Отказ был честен ровно в одном слове —
     ЖДАТЬ. Ждать этот планировщик и правда не умеет и уметь не должен: пробег
     атомарен, и остановить его на `accept` значило бы остановить все процессы
     разом, вместе с таймерами и надзором.

     Поэтому ждать никто и не стал. Сокет неблокирующий; поручение, на которое
     ядру есть что ответить СЕЙЧАС, отвечается на месте — как отвечалось всегда;
     поручение, которому ответить нечем, кладётся в список ожиданий, и пробег
     кончается ТОГДА ЖЕ, когда кончился бы без сети. Отклик принесёт опрос
     (`fl_conc_net_pump`) обычным сообщением и тем же `fl_conc_deliver`.

     Что при этом НЕ изменилось: словарь поручений, словарь откликов, вид
     отклика на каждое из шести. Изменилось одно — КОГДА отклик приходит. */
  if (strcmp(kind, "Открыть соединение") == 0) {
    static const char *const names[1] = {"соединение"};
    const char *address = fl_conc_io_text(ctx, order, "адрес");
    double port = 0;
    char why[256];
    struct addrinfo hints;
    struct addrinfo *found = NULL;
    struct addrinfo *step = NULL;
    char service[8];
    int failed = 0;
    if (address == NULL || address[0] == '\0') {
      return fl_conc_io_fail(ctx, "FLANG_IO_NET", "поручению «Открыть соединение» нужен непустой адрес", out,
                             error);
    }
    /* Ноль здесь НЕ годится, в отличие от приёма: «порт 0» на слушающем сокете
       значит «дай любой свободный», а на исходящем не значит ничего. */
    if (!fl_conc_io_number(order, "порт", &port) || port < 1 || port > 65535 ||
        port != (double)(long)port) {
      return fl_conc_io_fail(ctx, "FLANG_IO_NET", "порт не годится: нужно целое от 1 до 65535", out, error);
    }
    if (sched->wire_count == FL_CONC_NET_LINKS) {
      return fl_conc_io_fail(ctx, "FLANG_IO_NET", "у хозяина кончились места под соединения", out, error);
    }
    snprintf(service, sizeof(service), "%d", (int)port);
    memset(&hints, 0, sizeof(hints));
    hints.ai_family = AF_UNSPEC;
    hints.ai_socktype = SOCK_STREAM;
    /* `getaddrinfo`, а не `inet_addr`: имя узла разрешать всё равно надо, а
       второй способ не умеет ни имён, ни IPv6. Разрешение имени — единственное
       место всей сети, которое здесь ждёт по-настоящему, и это цена, названная
       вслух: асинхронного `getaddrinfo` в POSIX нет. */
    failed = getaddrinfo(address, service, &hints, &found);
    if (failed != 0) {
      snprintf(why, sizeof(why), "адрес «%s» не разрешён: %s", address, gai_strerror(failed));
      return fl_conc_io_fail(ctx, "FLANG_IO_NET", why, out, error);
    }
    for (step = found; step != NULL; step = step->ai_next) {
      const int fd = socket(step->ai_family, step->ai_socktype, step->ai_protocol);
      if (fd < 0) {
        continue;
      }
      if (!fl_conc_net_relax(fd)) {
        close(fd);
        continue;
      }
      if (connect(fd, step->ai_addr, step->ai_addrlen) == 0) {
        const int number = fl_conc_wire_add(sched, fd, true);
        fl_value value = fl_nothing();
        freeaddrinfo(found);
        if (number < 0) {
          close(fd);
          return fl_conc_io_fail(ctx, "FLANG_IO_NET", "у хозяина кончились места под соединения", out, error);
        }
        value = fl_number((double)number);
        return fl_variant_new(ctx, "Соединение открыто", names, &value, 1, out, error);
      }
      if (errno == EINPROGRESS || errno == EINTR) {
        bool reserved = false;
        fl_conc_wait *wait = NULL;
        if (!fl_conc_net_reserve(sched, target, &reserved)) {
          close(fd);
          freeaddrinfo(found);
          *posted = FL_CONC_FULL;
          return FL_OK;
        }
        wait = fl_conc_wait_push(sched, FL_CONC_WAIT_CONNECT, fd, -1, target, reserved);
        if (wait == NULL) {
          fl_conc_net_release(sched, target, reserved);
          close(fd);
          freeaddrinfo(found);
          return fl_conc_io_fail(ctx, "FLANG_IO_NET", "у хозяина кончились места под ожидание", out, error);
        }
        snprintf(wait->where, sizeof(wait->where), "%s:%d", address, (int)port);
        freeaddrinfo(found);
        *deferred = true;
        return FL_OK;
      }
      close(fd);
    }
    snprintf(why, sizeof(why), "соединение с %s:%d не установлено: %s", address, (int)port, strerror(errno));
    freeaddrinfo(found);
    return fl_conc_io_fail(ctx, "FLANG_IO_NET", why, out, error);
  }

  if (strcmp(kind, "Принять соединение") == 0) {
    static const char *const names[1] = {"соединение"};
    double port = 0;
    char why[256];
    int listener = -1;
    int taken = -1;
    if (!fl_conc_io_number(order, "порт", &port) || port < 0 || port > 65535 ||
        port != (double)(long)port) {
      return fl_conc_io_fail(ctx, "FLANG_IO_NET", "порт не годится: нужно целое от 0 до 65535", out, error);
    }
    listener = fl_conc_net_listen(sched, (int)port, why, sizeof(why));
    if (listener < 0) {
      return fl_conc_io_fail(ctx, "FLANG_IO_NET", why, out, error);
    }
    if (sched->wire_count == FL_CONC_NET_LINKS) {
      return fl_conc_io_fail(ctx, "FLANG_IO_NET", "у хозяина кончились места под соединения", out, error);
    }
    taken = accept(listener, NULL, NULL);
    if (taken >= 0) {
      fl_value value = fl_nothing();
      const int number = (fl_conc_net_relax(taken), fl_conc_wire_add(sched, taken, false));
      if (number < 0) {
        close(taken);
        return fl_conc_io_fail(ctx, "FLANG_IO_NET", "у хозяина кончились места под соединения", out, error);
      }
      value = fl_number((double)number);
      return fl_variant_new(ctx, "Соединение открыто", names, &value, 1, out, error);
    }
    if (!fl_conc_net_again(errno) && errno != EINTR) {
      snprintf(why, sizeof(why), "соединение не принято: %s", strerror(errno));
      return fl_conc_io_fail(ctx, "FLANG_IO_NET", why, out, error);
    }
    /* Никто ещё не постучался. ВОТ ЗДЕСЬ и стоял отказ. */
    {
      bool reserved = false;
      if (!fl_conc_net_reserve(sched, target, &reserved)) {
        *posted = FL_CONC_FULL;
        return FL_OK;
      }
      if (fl_conc_wait_push(sched, FL_CONC_WAIT_ACCEPT, listener, -1, target, reserved) == NULL) {
        fl_conc_net_release(sched, target, reserved);
        return fl_conc_io_fail(ctx, "FLANG_IO_NET", "у хозяина кончились места под ожидание", out, error);
      }
    }
    *deferred = true;
    return FL_OK;
  }

  if (strcmp(kind, "Прочитать из соединения") == 0 ||
      strcmp(kind, "Прочитать октеты из соединения") == 0) {
    const bool octets = strcmp(kind, "Прочитать октеты из соединения") == 0;
    unsigned char chunk[FL_CONC_NET_CHUNK];
    double number = 0;
    int fd = -1;
    long got = 0;
    if (!fl_conc_io_number(order, "соединение", &number) ||
        (fd = fl_conc_wire_fd(sched, (int)number)) < 0) {
      return fl_conc_io_fail(ctx, "FLANG_IO_READ",
                             "соединения у хозяина нет: оно закрыто, не принималось и не открывалось", out,
                             error);
    }
    got = (long)read(fd, chunk, sizeof(chunk));
    if (got < 0 && (fl_conc_net_again(errno) || errno == EINTR)) {
      /* Байтов ЕЩЁ нет — и это не конец связи. Ответить пустым «Прочитано»
         значило бы соврать: пустое здесь означает «связь кончилась», и служба
         по нему решает, что запрос оборван. Поэтому отклика нет вовсе, пока
         байты не придут. */
      bool reserved = false;
      if (!fl_conc_net_reserve(sched, target, &reserved)) {
        *posted = FL_CONC_FULL;
        return FL_OK;
      }
      if (fl_conc_wait_push(sched, octets ? FL_CONC_WAIT_OCTETS : FL_CONC_WAIT_READ, fd, (int)number, target,
                            reserved) == NULL) {
        fl_conc_net_release(sched, target, reserved);
        return fl_conc_io_fail(ctx, "FLANG_IO_NET", "у хозяина кончились места под ожидание", out, error);
      }
      *deferred = true;
      return FL_OK;
    }
    return fl_conc_net_read_answer(ctx, chunk, got, octets, out, error);
  }

  if (strcmp(kind, "Ответить в соединение") == 0 ||
      strcmp(kind, "Ответить октетами в соединение") == 0) {
    static const char *const names[1] = {"сколько"};
    const bool octets = strcmp(kind, "Ответить октетами в соединение") == 0;
    fl_value field = fl_nothing();
    fl_value value = fl_nothing();
    const unsigned char *body = NULL;
    unsigned char *made = NULL;
    double number = 0;
    double points = 0;
    size_t bytes = 0;
    size_t sent = 0;
    int fd = -1;
    bool closing = false;
    if (!fl_conc_io_number(order, "соединение", &number) ||
        (fd = fl_conc_wire_fd(sched, (int)number)) < 0) {
      return fl_conc_io_fail(ctx, "FLANG_IO_WRITE",
                             "соединения у хозяина нет: оно закрыто, не принималось и не открывалось", out,
                             error);
    }
    if (octets) {
      size_t at = 0;
      if (!fl_conc_variant_field(order, "октеты", &field) || field.tag != FL_LIST) {
        return fl_conc_io_fail(ctx, "FLANG_IO_OCTETS", "поручению нужен список октетов, а дан не список",
                               out, error);
      }
      bytes = field.as.list.count;
      if (bytes > 0) {
        made = (unsigned char *)fl_arena_alloc(ctx->arena, bytes);
        if (made == NULL) {
          return fl_conc_io_fail(ctx, "FLANG_IO_WRITE", "не хватило памяти под октеты", out, error);
        }
      }
      for (at = 0; at < bytes; at += 1) {
        const fl_value item = field.as.list.items[at];
        if (item.tag != FL_NUMBER || item.as.number < 0 || item.as.number > 255 ||
            item.as.number != (double)(long)item.as.number) {
          return fl_conc_io_fail(ctx, "FLANG_IO_OCTETS", "октет не годится: нужно целое от 0 до 255", out,
                                 error);
        }
        made[at] = (unsigned char)(long)item.as.number;
      }
      body = made;
      /* У октетов «сколько» — ЧИСЛО ОКТЕТОВ, а не кодовых точек: переводить
         нечего, и второе число об одном и том же было бы ложью. */
      points = (double)bytes;
    } else {
      if (!fl_conc_variant_field(order, "содержимое", &field) || field.tag != FL_STRING) {
        return fl_conc_io_fail(ctx, "FLANG_IO_WRITE", "поручению нужно содержимое строкой", out, error);
      }
      if (fl_utf8_not_text_at(field.as.string.utf8, field.as.string.bytes) > 0) {
        return fl_conc_io_fail(
          ctx, "FLANG_IO_NOT_TEXT",
          "содержимое не текст: не складывается в UTF-8; октеты возит «Ответить октетами в соединение»", out,
          error);
      }
      body = (const unsigned char *)field.as.string.utf8;
      bytes = field.as.string.bytes;
      /* Кодовые точки, а не байты: `длина` в языке считает точки. */
      points = (double)field.as.string.points;
    }
    /* ЕДИНСТВЕННОЕ место, где принятое соединение отличается от открытого:
       закрывает тот, кто завёл. Принятое хозяин закрывает ответом — обмен на нём
       кончился; открытое оставляет программе. Пустое содержимое закрывает и то и
       другое: это и есть «положить трубку». */
    closing = bytes == 0 || !fl_conc_wire_outgoing(sched, (int)number);
    while (sent < bytes) {
      const long put = (long)write(fd, body + sent, bytes - sent);
      if (put > 0) {
        sent += (size_t)put;
        continue;
      }
      if (put < 0 && (fl_conc_net_again(errno) || errno == EINTR)) {
        break;
      }
      close(fd);
      fl_conc_wire_drop(sched, (int)number);
      return fl_conc_io_fail(ctx, "FLANG_IO_WRITE", "ответ не записан", out, error);
    }
    if (sent < bytes) {
      /* Буфер сокета полон — дописывать будет опрос. Хвост уезжает в `malloc`, а
         не в арену: арена пробега умрёт через мгновение, а хвост нужен дольше. */
      bool reserved = false;
      fl_conc_wait *wait = NULL;
      unsigned char *tail = (unsigned char *)malloc(bytes - sent);
      if (tail == NULL) {
        return fl_conc_io_fail(ctx, "FLANG_IO_WRITE", "не хватило памяти под недописанный ответ", out, error);
      }
      memcpy(tail, body + sent, bytes - sent);
      if (!fl_conc_net_reserve(sched, target, &reserved)) {
        free(tail);
        *posted = FL_CONC_FULL;
        return FL_OK;
      }
      wait = fl_conc_wait_push(sched, FL_CONC_WAIT_WRITE, fd, (int)number, target, reserved);
      if (wait == NULL) {
        fl_conc_net_release(sched, target, reserved);
        free(tail);
        return fl_conc_io_fail(ctx, "FLANG_IO_NET", "у хозяина кончились места под ожидание", out, error);
      }
      wait->body = tail;
      wait->bytes = bytes - sent;
      wait->closing = closing;
      wait->points = points;
      *deferred = true;
      return FL_OK;
    }
    if (closing) {
      close(fd);
      fl_conc_wire_drop(sched, (int)number);
    }
    value = fl_number(points);
    return fl_variant_new(ctx, "Записано", names, &value, 1, out, error);
  }
#else
  /* Сборка без сети (`-DFL_CONC_NO_NET`) или не POSIX. Здесь отказ — правда: у
     чистого C99 сокетов нет вовсе. Молчать нельзя: `FLANG_IO_UNKNOWN` означал бы
     «хозяин отстал от словаря языка», а он не отстал — ему нечем. */
  if (strcmp(kind, "Открыть соединение") == 0 || strcmp(kind, "Принять соединение") == 0 ||
      strcmp(kind, "Прочитать из соединения") == 0 || strcmp(kind, "Ответить в соединение") == 0 ||
      strcmp(kind, "Прочитать октеты из соединения") == 0 ||
      strcmp(kind, "Ответить октетами в соединение") == 0) {
    return fl_conc_io_fail(ctx, "FLANG_IO_NET",
                           "у хозяина на C нет сокетов: собрано без сети (FL_CONC_NO_NET)", out, error);
  }
#endif

  /* Набор поручений закрыт, поэтому «неизвестное поручение» — это не «мы такого
     ещё не умеем», а расхождение хозяина со словарём языка. Отклик, а не
     ошибка: программа увидит «Сбой» и решит сама. */
  return fl_conc_io_fail(ctx, "FLANG_IO_UNKNOWN", "хозяин не знает такого поручения", out, error);
}

/* ───────────────────────────── сеть: опрос ────────────────────────────────
   Здесь «ждать» и превращается в «спросить и вернуть управление».

   ПОЧЕМУ НЕ НУЛЕВОЙ ТАЙМ-АУТ ВСЕГДА. Нулевой тайм-аут в цикле планировщика —
   первое, что приходит в голову, и он правда снимает барьер; но когда делать
   больше нечего, он превращает ожидание письма из сети в холостой круг на
   полное ядро. Замер снят двумя сборками одной и той же службы, простаивавшими
   по пять секунд: с `poll(0)` всегда — 500 тиков ЦП из 500 возможных (сто
   процентов ядра), с тайм-аутом по делу — 0 тиков из 500. Отвечают обе
   одинаково: `curl` получает 200 от той и от другой. Поэтому тайм-аут ЗАВИСИТ
   от того, есть ли планировщику чем заняться: ноль, когда есть (вернуть
   управление немедленно), и «сколько угодно», когда нет (спать до первого
   байта). Виртуальное время таймеров при
   этом не трогается — таймеры и сеть меряются разными часами, и смешивать их
   значило бы поставить срок письма в зависимость от того, пришёл ли пакет.

   ЧТО ЭТО НЕ МЕНЯЕТ. Программа без сети не платит ничего: `wait_count` у неё
   ноль, и опрос кончается на первой строке, не дойдя до системного вызова. */
#ifdef FL_CONC_NET
static bool fl_conc_net_pump(fl_conc_sched *sched, fl_ctx *ctx, int patience, fl_error *error) {
  struct pollfd fds[FL_CONC_NET_LINKS];
  short heard[FL_CONC_NET_LINKS];
  size_t index = 0;
  size_t count = 0;
  int ready = 0;
  fl_arena *saved = NULL;
  bool ok = true;

  /* Список ожиданий, соединения и порты — общее хозяйство, и ходят они под тем
     же общим замком, что журнал и таймеры. Порядок взятия прежний: общий →
     процесс (его возьмёт доставка), и вверх по нему здесь никто не идёт. */
  fl_conc_big_lock(sched);
  count = sched->wait_count;
  if (count == 0) {
    fl_conc_big_unlock(sched);
    return true;
  }
  for (index = 0; index < count; index += 1) {
    const fl_conc_wait_kind kind = sched->waits[index].kind;
    fds[index].fd = sched->waits[index].fd;
    fds[index].events =
      (short)((kind == FL_CONC_WAIT_CONNECT || kind == FL_CONC_WAIT_WRITE) ? POLLOUT : POLLIN);
    fds[index].revents = 0;
  }
  sched->polls += 1;
  ready = poll(fds, (nfds_t)count, patience);
  /* Ноль — никто не готов; −1 — прерван сигналом. Оба — «сейчас нечего», и оба
     ведут в одно место: вернуть управление планировщику. */
  if (ready <= 0) {
    fl_conc_big_unlock(sched);
    return true;
  }
  for (index = 0; index < count; index += 1) {
    heard[index] = fds[index].revents;
  }
  /* Отклики строятся в своей арене: пробег, выдавший поручение, кончился давно,
     и его черновик сброшен. Доставка копирует значение в кучу адресата, поэтому
     арена сбрасывается сразу после обхода. */
  saved = ctx->arena;
  ctx->arena = &sched->netpad;
  /* Обход СВЕРХУ ВНИЗ: снятие ожидания сдвигает только те, что ниже него, а к
     ним мы уже не вернёмся. Поэтому номер в `heard` и номер ожидания не
     разъезжаются, и никакого второго указателя для этого не нужно. */
  index = count;
  while (index > 0) {
    fl_value answer = fl_nothing();
    bool done = false;
    fl_conc_wait *wait = NULL;
    index -= 1;
    if (!ok || heard[index] == 0) {
      continue;
    }
    wait = &sched->waits[index];
    switch (wait->kind) {
      case FL_CONC_WAIT_ACCEPT: {
        static const char *const names[1] = {"соединение"};
        const int taken = accept(wait->fd, NULL, NULL);
        if (taken < 0) {
          char why[256];
          if (fl_conc_net_again(errno) || errno == EINTR) {
            break;
          }
          snprintf(why, sizeof(why), "соединение не принято: %s", strerror(errno));
          ok = fl_conc_io_fail(ctx, "FLANG_IO_NET", why, &answer, error) == FL_OK;
          done = true;
          break;
        }
        (void)fl_conc_net_relax(taken);
        {
          const int number = fl_conc_wire_add(sched, taken, false);
          if (number < 0) {
            close(taken);
            ok = fl_conc_io_fail(ctx, "FLANG_IO_NET", "у хозяина кончились места под соединения", &answer,
                                 error) == FL_OK;
          } else {
            fl_value value = fl_number((double)number);
            ok = fl_variant_new(ctx, "Соединение открыто", names, &value, 1, &answer, error) == FL_OK;
          }
        }
        done = true;
        break;
      }
      case FL_CONC_WAIT_CONNECT: {
        static const char *const names[1] = {"соединение"};
        int problem = 0;
        socklen_t size = (socklen_t)sizeof(problem);
        if (getsockopt(wait->fd, SOL_SOCKET, SO_ERROR, &problem, &size) != 0) {
          problem = errno;
        }
        if (problem != 0) {
          char why[256];
          close(wait->fd);
          snprintf(why, sizeof(why), "соединение с %s не установлено: %s", wait->where, strerror(problem));
          ok = fl_conc_io_fail(ctx, "FLANG_IO_NET", why, &answer, error) == FL_OK;
        } else {
          const int number = fl_conc_wire_add(sched, wait->fd, true);
          if (number < 0) {
            close(wait->fd);
            ok = fl_conc_io_fail(ctx, "FLANG_IO_NET", "у хозяина кончились места под соединения", &answer,
                                 error) == FL_OK;
          } else {
            fl_value value = fl_number((double)number);
            ok = fl_variant_new(ctx, "Соединение открыто", names, &value, 1, &answer, error) == FL_OK;
          }
        }
        done = true;
        break;
      }
      case FL_CONC_WAIT_READ:
      case FL_CONC_WAIT_OCTETS: {
        unsigned char chunk[FL_CONC_NET_CHUNK];
        const long got = (long)read(wait->fd, chunk, sizeof(chunk));
        if (got < 0 && (fl_conc_net_again(errno) || errno == EINTR)) {
          break;
        }
        ok = fl_conc_net_read_answer(ctx, chunk, got, wait->kind == FL_CONC_WAIT_OCTETS, &answer, error) ==
             FL_OK;
        done = true;
        break;
      }
      case FL_CONC_WAIT_WRITE: {
        static const char *const names[1] = {"сколько"};
        bool broken = false;
        while (wait->sent < wait->bytes) {
          const long put = (long)write(wait->fd, wait->body + wait->sent, wait->bytes - wait->sent);
          if (put > 0) {
            wait->sent += (size_t)put;
            continue;
          }
          if (put < 0 && (fl_conc_net_again(errno) || errno == EINTR)) {
            break;
          }
          close(wait->fd);
          fl_conc_wire_drop(sched, wait->number);
          ok = fl_conc_io_fail(ctx, "FLANG_IO_WRITE", "ответ не записан", &answer, error) == FL_OK;
          broken = true;
          break;
        }
        if (broken) {
          done = true;
          break;
        }
        if (wait->sent < wait->bytes) {
          break;
        }
        if (wait->closing) {
          close(wait->fd);
          fl_conc_wire_drop(sched, wait->number);
        }
        {
          fl_value value = fl_number(wait->points);
          ok = fl_variant_new(ctx, "Записано", names, &value, 1, &answer, error) == FL_OK;
        }
        done = true;
        break;
      }
      default:
        break;
    }
    if (!done || !ok) {
      continue;
    }
    {
      const size_t target = wait->target;
      const bool reserved = wait->reserved;
      /* Место было занято при выдаче поручения — здесь оно освобождается и тут
         же заполняется, ровно как у сработавшего таймера. Переполниться этот
         путь не может по построению. */
      if (reserved) {
        fl_conc_hold(sched, target);
        sched->slots[target].pending -= 1;
        fl_conc_drop(sched, target);
      }
      fl_conc_wait_drop(sched, index);
      if (fl_conc_deliver(sched, ctx, SIZE_MAX, target, answer, false, reserved) == FL_CONC_NOMEM) {
        ok = false;
      }
    }
  }
  ctx->arena = saved;
  fl_arena_reset(&sched->netpad);
  fl_conc_big_unlock(sched);
  if (!ok) {
    return fl_conc_memory(ctx, error) == FL_OK;
  }
  return true;
}

/** Есть ли кому ждать. Спрашивается на каждом витке, поэтому одно поле. */
static bool fl_conc_net_pending(fl_conc_sched *sched) { return sched->wait_count > 0; }

/** Закрыть всё, что сеть завела. Зовётся ровно один раз — на выходе прогона. */
static void fl_conc_net_close(fl_conc_sched *sched) {
  size_t index = 0;
  for (index = 0; index < sched->wait_count; index += 1) {
    free(sched->waits[index].body);
    sched->waits[index].body = NULL;
  }
  sched->wait_count = 0;
  for (index = 0; index < sched->wire_count; index += 1) {
    close(sched->wires[index].fd);
  }
  sched->wire_count = 0;
  for (index = 0; index < sched->port_count; index += 1) {
    close(sched->ports[index].fd);
  }
  sched->port_count = 0;
}
#endif /* FL_CONC_NET */


/**
 * Разобрать отклик; FL_ERROR — отклик не той формы, и тогда `broken` заполнен
 * текстом. Тексты дословно те же, что у свидетеля: расхождение здесь ничем не
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
   правилом «первое объявление выигрывает», что у свидетеля. */

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
  /* Порождённые (Б2). В `watch` их нет и быть не может — надзор объявлен в
     исходнике, а они завелись на ходу, — поэтому они добавляются здесь, по
     наследованной связи и в порядке рождения. Без этого перезапуск поддерева
     поднимал бы вид и оставлял его экземпляры лежать. */
  for (index = plan->process_count; index < sched->proc_count; index += 1) {
    if (sched->over_process[index].supervisor != supervisor) {
      continue;
    }
    out[*count] = index;
    *count += 1;
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

/* Решение надзора трогает ЧУЖОЙ процесс, а чужой процесс в рабочем режиме
   может в это время бежать на другом потоке. Замок делает решение атомарным по
   отношению к его пробегу: либо пробег успел целиком, либо решение легло целиком.
   Что при этом теряется — порядок между решением и пробегом, — названо в шапке
   заголовка: это одно из законных чередований, а не потерянное обновление. */
static void fl_conc_restart(fl_conc_sched *sched, size_t index) {
  fl_conc_hold(sched, index);
  sched->slots[index].current = sched->slots[index].initial;
  sched->slots[index].alive = true;
  fl_conc_refresh(sched, index, SIZE_MAX);
  fl_conc_drop(sched, index);
}

static void fl_conc_stop(fl_conc_sched *sched, size_t index) {
  fl_conc_hold(sched, index);
  sched->slots[index].alive = false;
  fl_conc_refresh(sched, index, SIZE_MAX);
  fl_conc_drop(sched, index);
}

/**
 * Отказ дошёл до надзора: кто решает и что из этого вышло. `escalated` значит,
 * что «передать выше» упёрлось в надзор, над которым никого нет, — тогда
 * останавливается вся программа.
 */
static bool fl_conc_supervise(fl_conc_sched *sched, size_t failed, const char *code, double when,
                              bool *escalated, bool *seen) {
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
      fl_conc_subtree(sched, target, seen, sched->subtree, &count);
    } else {
      sched->subtree[0] = target;
      count = 1;
    }
    for (index = 0; index < count; index += 1) {
      if (!fl_conc_decide(sched, when, sched->subtree[index], plan->supervisors[link.supervisor].name,
                          strategy, code)) {
        return false;
      }
      if (strcmp(strategy, "перезапустить") == 0) {
        fl_conc_restart(sched, sched->subtree[index]);
      } else {
        fl_conc_stop(sched, sched->subtree[index]);
      }
    }
    return true;
  }
}

/* ───────────────────────────── прогон ───────────────────────────── */

/**
 * Начать запись о пробеге. Возвращает `false`, если кончилась память.
 *
 * Запись всегда своя у пробега (`scratch`), а в журнал она уезжает КОПИЕЙ, уже
 * дописанной, — `fl_conc_journal_add`. Раньше запись заводилась прямо в
 * массиве журнала, и в проверочном режиме это было верно; в рабочем указатель в
 * растущий массив пережил бы ровно до того мига, когда журнал вырос бы у соседа
 * по потоку. Порядок записей в журнале от этого не изменился ни в одном
 * проверочном прогоне: пробеги там идут по одному.
 *
 * Копия САМОГО СООБЩЕНИЯ делается здесь, а не при дописывании: подлинник лежит
 * в куче процесса, а к концу пробега та половина уже сброшена переездом.
 */
static bool fl_conc_record(fl_conc_sched *sched, const fl_ctx *guard, fl_conc_entry *scratch, double when,
                           size_t process, fl_value message) {
  bool ok = true;
  scratch->time = when;
  scratch->process = process;
  scratch->outcome = "обработано";
  scratch->code = NULL;
  scratch->reason = NULL;
  /* Сообщение в журнале — КОПИЯ в арене вызывающего: подлинник лежит в куче
     процесса и умрёт с ближайшим её сбросом, а журнал живёт до конца прогона.
     Без журнала копии нет вовсе, и это не экономия на мелочи: копия сообщения
     на каждом пробеге — ровно та цена наблюдения, которую снял шаг А1. Поле
     заполняется «ничем», а не подлинником: указатель в сброшенную половину не
     читает никто, но и лежать ему там незачем. */
  if (sched->keep_journal) {
    /* Арена вызывающего одна на прогон — значит под общим замком. В рабочем
       режиме это единственное место, где журнал стоит захвата замка на КАЖДОМ
       пробеге; потому умолчание рабочего режима — журнала не вести. */
    fl_conc_big_lock(sched);
    ok = fl_conc_keep(guard, sched->home, message, &scratch->message);
    fl_conc_big_unlock(sched);
  } else {
    scratch->message = fl_nothing();
  }
  return ok;
}

/** Дописать готовую запись в журнал. Общее хозяйство — под общим замком. */
static bool fl_conc_journal_add(fl_conc_sched *sched, const fl_conc_entry *entry) {
  bool ok = true;
  if (!sched->keep_journal) {
    return true;
  }
  fl_conc_big_lock(sched);
  if (sched->journal_count == sched->journal_capacity) {
    fl_conc_entry *bigger = (fl_conc_entry *)fl_conc_grow(sched->ctx, sched->journal, sched->journal_count,
                                                          &sched->journal_capacity, sizeof(fl_conc_entry));
    if (bigger == NULL) {
      ok = false;
    } else {
      sched->journal = bigger;
    }
  }
  if (ok) {
    sched->journal[sched->journal_count] = *entry;
    sched->journal_count += 1;
  }
  fl_conc_big_unlock(sched);
  return ok;
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

static bool fl_conc_timer_push(fl_conc_sched *sched, const fl_ctx *guard, double when, size_t target,
                               fl_value message, bool reserved) {
  fl_value copy = fl_nothing();
  bool ok = true;
  /* Письмо ждёт срока дольше, чем живёт черновик пробега, в котором его
     построили, — значит переезжает в почтовую кучу. Адресату оно достанется
     ещё одной копией, уже в его собственную кучу (`fl_conc_deliver`): сюда его
     кладут на хранение, а не в ящик. */
  /* Почтовая куча и список таймеров — общее хозяйство: под общим замком. */
  fl_conc_big_lock(sched);
  if (!fl_conc_keep(guard, &sched->post[sched->post_live], message, &copy)) {
    ok = false;
  }
  if (ok && sched->timer_count == sched->timer_capacity) {
    fl_conc_timer *bigger = (fl_conc_timer *)fl_conc_grow(sched->ctx, sched->timers, sched->timer_count,
                                                          &sched->timer_capacity, sizeof(fl_conc_timer));
    if (bigger == NULL) {
      ok = false;
    } else {
      sched->timers = bigger;
    }
  }
  if (ok) {
    sched->timers[sched->timer_count].time = when;
    sched->timers[sched->timer_count].target = target;
    sched->timers[sched->timer_count].reserved = reserved;
    sched->timers[sched->timer_count].message = copy;
    sched->timer_count += 1;
  }
  fl_conc_big_unlock(sched);
  return ok;
}

/**
 * Сложить почтовую кучу: живое в ней — ровно те письма, что ещё ждут срока.
 * Сработавшее письмо мертво в тот же миг, когда адресат получил свою копию, и
 * без этого переезда «через» в цикле давал бы рост, которого А2 не терпит.
 */
static bool fl_conc_post_pack(fl_conc_sched *sched, const fl_ctx *guard) {
  fl_arena *to = &sched->post[1 - sched->post_live];
  size_t index = 0;
  for (index = 0; index < sched->timer_count; index += 1) {
    fl_value moved = fl_nothing();
    if (!fl_conc_keep(guard, to, sched->timers[index].message, &moved)) {
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
static bool fl_conc_fire_timers(fl_conc_sched *sched, const fl_ctx *guard) {
  size_t index = 0;
  bool fired = false;
  /* Список таймеров и почтовая куча — общее хозяйство. Замок держится и на
     время доставки: в рабочем режиме порядок взятия «общий → процесс», и
     доставка берёт замок процесса из-под него, а не наоборот. */
  fl_conc_big_lock(sched);
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
      fl_conc_hold(sched, timer.target);
      sched->slots[timer.target].pending -= 1;
      fl_conc_drop(sched, timer.target);
    }
    if (fl_conc_deliver(sched, guard, SIZE_MAX, timer.target, timer.message, false, timer.reserved) ==
        FL_CONC_NOMEM) {
      fl_conc_big_unlock(sched);
      return false;
    }
  }
  if (fired && !fl_conc_post_pack(sched, guard)) {
    fl_conc_big_unlock(sched);
    return false;
  }
  fl_conc_big_unlock(sched);
  return true;
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
static bool fl_conc_evacuate(fl_conc_sched *sched, const fl_ctx *guard, size_t index, fl_value *state) {
  fl_conc_slot *slot = &sched->slots[index];
  fl_arena *to = &slot->heap[1 - slot->live];
  fl_value moved = fl_nothing();
  fl_value *items = NULL;
  size_t at = 0;
  /* Замок берётся у ВЫЗЫВАЮЩЕГО (`fl_conc_turn`): переезд читает и ящик, и обе
     половины кучи, а писать в ящик может любой отправитель. */
  if (!fl_conc_keep(guard, to, *state, &moved)) {
    return false;
  }
  if (slot->box.count > 0) {
    items = (fl_value *)fl_arena_alloc(to, slot->box.count * sizeof(fl_value));
    if (items == NULL) {
      return false;
    }
    for (at = 0; at < slot->box.count; at += 1) {
      if (!fl_conc_keep(guard, to, slot->box.items[(slot->box.head + at) % slot->box.capacity], &items[at])) {
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
  /* Свой собственный процесс, но замок берётся и здесь: жизнь процесса читает
     всякий, кто ему пишет, и читает под этим же замком. */
  fl_conc_hold(sched, process);
  sched->slots[process].alive = false;
  fl_conc_refresh(sched, process, SIZE_MAX);
  fl_conc_drop(sched, process);
}

/* ───────────────────────────── порождение (шаг Б1) ─────────────────────────
   `породить` заводит ЭКЗЕМПЛЯР ОБЪЯВЛЕННОГО ВИДА, а не произвольный код.
   Отсюда всё остальное: множество видов остаётся конечным и известным на этапе
   компиляции, замыканий не появляется, дефункционализация цела, анализ
   достижимых отказов (Г1) считает по видам и потому знает про экземпляры ровно
   то же, что про вид. Ровно это `flang/conc/RESILIENCE.md` и называет «самой
   дешёвой большой победой».

   Имя порождённому даёт РОДИТЕЛЬ, и это ответ на вопрос, из-за которого шаг
   стоял: «породить» в контракте описан как «создать процесс и вернуть его имя»,
   а вернуть что-либо описанное действие не может по построению — его исполняет
   планировщик, а обработчик к этому времени уже вернулся. Значит имя не
   возвращается, а НАЗЫВАЕТСЯ: адрес и так строка (`отправить`), и порождение не
   заводит нового вида значений вовсе. У BEAM здесь pid — значение, которое
   `spawn` возвращает выражением; у нас выражения нет, зато есть строка, и она
   дешевле pid'а на всё: ни таблицы, ни счётчика поколений, ни вопроса о том,
   что делать с pid'ом умершего.

   Цена решения названа прямо: уникальность имени — дело программы. Занятое имя
   не молчит и не перезаписывает — это отказ ПОРОЖДАЮЩЕГО (`FLANG_NAME_TAKEN`),
   и разбирает его надзор. Так же устроен `register/2` в BEAM. */

/** Отказы порождения. Все три — отказы порождающего: он попросил, не вышло. */
static const char *const FL_CONC_NAME_TAKEN = "FLANG_NAME_TAKEN";
static const char *const FL_CONC_PROCESS_LIMIT = "FLANG_PROCESS_LIMIT";
/* Имя порождённого — АДРЕС, и адресом может быть не всякая строка. Пустая не
   может: адресоваться к ней нечем. Строка с нулевым байтом внутри — тоже, и
   вот почему это отказ, а не молчание: имя процесса живёт в рантайме C строкой
   с нулём на конце, значит «а\0б» и «а» стали бы одним и тем же адресом, а у
   свидетеля на JavaScript — разными. Расхождение вышло бы не в отказе, а в
   ДОСТАВКЕ: письмо ушло бы не тому. Поэтому имя проверяется, а не усекается. */
static const char *const FL_CONC_BAD_NAME = "FLANG_BAD_NAME";

/** Копия имени порождённого в арену вызывающего с нулём на конце.
    В арену вызывающего, а не в кучу процесса: имя живёт столько же, сколько
    таблица процессов, то есть весь прогон, а куча родителя сбрасывается в конце
    того же пробега, на котором имя построено. */
static const char *fl_conc_keep_name(fl_conc_sched *sched, fl_value name) {
  char *text = (char *)fl_arena_alloc(sched->home, name.as.string.bytes + 1);
  if (text == NULL) {
    return NULL;
  }
  memcpy(text, name.as.string.utf8, name.as.string.bytes);
  text[name.as.string.bytes] = '\0';
  return text;
}

/**
 * Завести процесс на ходу. Возвращает `false` только на нехватке памяти в арене
 * вызывающего — на всём остальном отказывает ПОРОЖДАЮЩИЙ, и отказ уже поставлен.
 *
 * Внимание к порядку: `fl_conc_reserve` двигает массив слотов, а `fl_conc_grow`
 * — массив порождённых. Значит указатель, взятый на процесс ДО этого вызова
 * (`node` в пробеге), после него не годится. В пробеге `node` больше не
 * читается — обработчик к этому времени вернулся, — и это единственная причина,
 * по которой здесь можно расти.
 */
static bool fl_conc_spawn(fl_conc_sched *sched, const fl_ctx *guard, size_t via, size_t parent,
                          fl_value kind, fl_value name, fl_value first, fl_conc_entry *entry,
                          const char **failed, const char **reason) {
  size_t proto = SIZE_MAX;
  size_t born = 0;
  const char *text = NULL;
  char buffer[256];
  fl_conc_post posted = FL_CONC_POSTED;

  /* Порождение целиком идёт под ОБЩИМ замком: оно двигает таблицу процессов,
     таблицу имён и счёт процессов — то есть всё, о чём одновременно спрашивает
     каждая доставка. Замок рекурсивный, поэтому диагностика (`fl_conc_keep_text`,
     `fl_conc_cstring`) берёт его же изнутри и не встаёт сама на себя.

     Дорого ли это: да, и это названо числом в замере. Прогон, который только и
     делает, что плодит процессы, упирается в один замок и по ядрам не
     разъезжается. Прогон, в котором порождение — событие, а не занятие, платит
     за него ровно там, где оно случается. */
  fl_conc_big_lock(sched);

  /* Вид обязан быть объявленным процессом. Проверка типов это и требует
     (`вид` — литерал, сверенный со списком объявленных), поэтому сюда попадает
     только план, собранный мимо неё; но и на нём порождение обязано кончаться
     названным отказом, а не тем, что о нём забыли. */
  proto = fl_conc_address(sched, kind);
  if (proto == SIZE_MAX || proto >= sched->plan->process_count) {
    snprintf(buffer, sizeof(buffer), "породить нечего: вида «%s» среди объявленных процессов нет",
             kind.tag == FL_STRING ? fl_conc_cstring(sched, kind) : "");
    fl_conc_own_failure(sched, parent, entry, failed, reason, "FLANG_PROCESS",
                        fl_conc_keep_text(sched, buffer));
    fl_conc_big_unlock(sched);
    return true;
  }
  if (name.tag != FL_STRING || name.as.string.bytes == 0) {
    fl_conc_own_failure(sched, parent, entry, failed, reason, FL_CONC_BAD_NAME,
                        "имя порождённого процесса пусто, а адресоваться к пустому имени нечем");
    fl_conc_big_unlock(sched);
    return true;
  }
  if (memchr(name.as.string.utf8, '\0', name.as.string.bytes) != NULL) {
    fl_conc_own_failure(sched, parent, entry, failed, reason, FL_CONC_BAD_NAME,
                        "в имени порождённого процесса нулевой байт: имя процесса — адрес, "
                        "и адрес обязан быть строкой без дыр");
    fl_conc_big_unlock(sched);
    return true;
  }
  /* Предел — это тотальность слоя, а не осторожность: `породить` в цикле иначе
     кончался бы исчерпанием памяти узла, то есть исходом без имени. */
  if (sched->proc_count >= sched->max_processes) {
    snprintf(buffer, sizeof(buffer), "предел числа процессов: объявлено и порождено %lu при пределе %lu",
             (unsigned long)sched->proc_count, (unsigned long)sched->max_processes);
    fl_conc_own_failure(sched, parent, entry, failed, reason, FL_CONC_PROCESS_LIMIT,
                        fl_conc_keep_text(sched, buffer));
    fl_conc_big_unlock(sched);
    return true;
  }
  if (fl_conc_address(sched, name) != SIZE_MAX) {
    snprintf(buffer, sizeof(buffer), "имя «%s» уже занято процессом",
             fl_conc_cstring(sched, name));
    fl_conc_own_failure(sched, parent, entry, failed, reason, FL_CONC_NAME_TAKEN,
                        fl_conc_keep_text(sched, buffer));
    fl_conc_big_unlock(sched);
    return true;
  }

  text = fl_conc_keep_name(sched, name);
  if (text == NULL) {
    fl_conc_big_unlock(sched);
    return false;
  }
  if (sched->born_count == sched->born_capacity) {
    fl_conc_process *bigger = (fl_conc_process *)fl_conc_grow(
      sched->ctx, sched->born, sched->born_count, &sched->born_capacity, sizeof(fl_conc_process));
    if (bigger == NULL) {
      fl_conc_big_unlock(sched);
      fl_conc_big_unlock(sched);
    return false;
    }
    sched->born = bigger;
  }
  if (!fl_conc_reserve(sched, sched->proc_count + 1)) {
    fl_conc_big_unlock(sched);
    return false;
  }
  born = sched->proc_count;
  /* Экземпляр берёт у вида ВСЁ, кроме имени: обработчик, начальное состояние,
     доказанность, запас витков, объявленный размер ящика. Иначе «экземпляр
     объявленного вида» было бы оборотом речи, а не утверждением. */
  sched->born[sched->born_count] = *fl_conc_node(sched, proto);
  sched->born[sched->born_count].name = text;

  /* Кучи заводятся ДО того, как счётчик процессов вырастет, и порядок этот не
     косметика: освобождение в `finish` идёт ровно по `proc_count`, а память под
     слоты приходит из арены НЕОБНУЛЁННОЙ. Процесс, попавший в счёт раньше, чем
     его арены проинициализированы, был бы освобождён по мусорному указателю —
     стоило бы кому-нибудь вставить между этими строками выход. */
  fl_arena_init_small(&sched->slots[born].heap[0], FL_CONC_HEAP_LEAST);
  fl_arena_init_small(&sched->slots[born].heap[1], FL_CONC_HEAP_LEAST);
  sched->slots[born].live = 0;
  /* Начальное значение берётся у ВИДА, и берётся то же самое, что вычислено при
     старте прогона: перезапуск порождённого обязан вернуть не «такое же», а то
     же самое значение — ровно то обещание, которое модель даёт объявленным. */
  sched->slots[born].initial = sched->slots[proto].initial;
  sched->slots[born].current = sched->slots[proto].initial;
  sched->slots[born].alive = true;
  sched->slots[born].box.items = NULL;
  sched->slots[born].box.capacity = 0;
  sched->slots[born].box.head = 0;
  sched->slots[born].box.count = 0;
  sched->slots[born].pending = 0;
  sched->is_ready[born] = false;
#ifdef FL_CONC_THREADS
  if (sched->par != NULL) {
    sched->par->state[born] = FL_CONC_IDLE;
  }
#endif
  /* Надзор наследуется у вида (шаг Б2). Дерево надзора объявляется данными, и
     объявление это одно на вид; приписывать экземпляру свой надзор было бы
     вторым местом правды о том же самом. Отсюда и полнота: множество отказов
     экземпляра то же, что у вида, значит накрытый вид накрывает и экземпляры, а
     `FLANG_UNCOVERED_FAILURE` считает по-прежнему по одному объявлению. */
  sched->over_process[born] = sched->over_process[proto];
  /* Слот заведён целиком — только теперь процесс есть. */
  sched->born_count += 1;
  sched->proc_count += 1;
  /* Указатель обязан РАСТИ вместе с таблицей, и это не оптимизация: при
     нагрузке выше половины линейная проба удлиняется, а при полной таблице
     `fl_conc_index_put` не нашёл бы пустой ячейки никогда и завис бы навсегда.
     Порог держится тот же, что при постройке: занято не больше половины. */
  if ((sched->names_used + 1u) * 2u > sched->names_mask + 1u) {
    if (!fl_conc_index_build(sched, sched->proc_count)) {
      fl_conc_big_unlock(sched);
      return false;
    }
  } else {
    fl_conc_index_put(sched, born);
  }

  /* Первое сообщение кладётся тем же путём, что всякое другое, и это не
     удобство, а необходимость: процесс без сообщения не побежит никогда —
     обработчик зовётся на сообщение, а не на рождение. Поэтому `породить`
     несёт письмо, а не «начальное состояние»: начальное состояние у вида уже
     объявлено (`начинает с`), а работа приезжает письмом. */
  posted = fl_conc_deliver(sched, guard, via, born, first, false, false);
  if (posted == FL_CONC_NOMEM) {
    fl_conc_own_failure(sched, parent, entry, failed, reason, FL_CODE_MEMORY,
                        "кончилась память в куче порождённого процесса");
  } else if (posted == FL_CONC_FULL) {
    fl_conc_own_failure(sched, parent, entry, failed, reason, "FLANG_MAILBOX_FULL",
                        fl_conc_full_text(sched, born));
  }
  fl_conc_big_unlock(sched);
  return true;
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
  /* Замок берётся у ВЫЗЫВАЮЩЕГО (`fl_conc_turn`, переезд кучи): здесь сбрасываются
     обе половины кучи, и писать в них в это время нельзя никому. */
  fl_arena_reset(&slot->heap[0]);
  fl_arena_reset(&slot->heap[1]);
  slot->live = 0;
  slot->box.items = NULL;
  slot->box.capacity = 0;
  slot->box.head = 0;
  slot->box.count = 0;
  slot->current = slot->initial;
  fl_conc_refresh(sched, index, SIZE_MAX);
}

/* ───────────────────────────── один пробег ─────────────────────────────
   Тело пробега ОДНО на оба режима, и это главное решение всей многоядерности.
   Режимы отличаются тем, ЧТО и в каком порядке выбирается на пробег; что при
   этом делается — обязано совпадать до буквы, иначе побайтовая сверка с
   свидетелем проверяла бы один планировщик, а работал бы другой. */

/** Всё, что у пробега своё, а не общее. В проверочном режиме такой ровно один. */
typedef struct fl_conc_hand {
  fl_ctx *ctx;      /* контекст этого потока: свой стек, свой сторож глубины */
  fl_arena *draft;  /* черновик пробега; свой у каждого потока */
  /* Куда вернуть арену контекста после вызова обработчика. В проверочном режиме
     это дом: отклик разбирается в арене вызывающего, как было всегда. В рабочем
     — черновик: арена вызывающего одна на прогон, писать в неё без общего замка
     нельзя, а текст отказа и так живёт дальше только копией. */
  fl_arena *rest;
  fl_conc_entry entry; /* запись пробега; в журнал уезжает копией */
  bool *seen;          /* рабочий массив надзора */
  size_t worker;
} fl_conc_hand;

/**
 * Пробег: доставленное сообщение отдать обработчику, разобрать отклик, выполнить
 * действия, переселить кучу, разобрать отказ надзором.
 *
 * `when` — виртуальное время этого пробега; кто его назначает, зависит от
 * режима. `escalated` — отказ дошёл доверху, дальше прогону конца.
 */
static fl_status fl_conc_turn(fl_conc_sched *sched, fl_conc_hand *hand, size_t process, fl_value message,
                              double when, bool *escalated, fl_error *error) {
  fl_ctx *ctx = hand->ctx;
  const fl_conc_plan *plan = sched->plan;
  fl_value response = fl_nothing();
  fl_value state = fl_nothing();
  fl_value actions = fl_list(NULL, 0);
  fl_conc_entry *entry = &hand->entry;
  fl_error inner;
  fl_status called = FL_OK;
  const char *failed = NULL;
  const char *reason = NULL;
  const fl_conc_process *node = fl_conc_node(sched, process);
  /* Успело ли новое состояние стать состоянием процесса. Пока не успело, оно
     живёт в черновике, и черновик можно сбросить досрочно; как только успело —
     нельзя, потому что `current` смотрит внутрь него до самого переезда. */
  bool committed = false;
  size_t saved_steps = 0;
  size_t saved_max_steps = 0;
  size_t saved_depth = 0;
  fl_value args[2];

  *escalated = false;
  if (!fl_conc_record(sched, ctx, entry, when, process, message)) {
    return fl_conc_memory(ctx, error);
  }

  inner.code = NULL;
  inner.message = NULL;
  /* Состояние читается под замком процесса: писать в него может ещё и надзор
     (`fl_conc_restart`), а значение flang — шестнадцать байт, которые машина не
     читает одним движением. Прочитать половину старого и половину нового
     значило бы получить указатель, которого никогда не было. */
  fl_conc_hold(sched, process);
  args[0] = sched->slots[process].current;
  fl_conc_drop(sched, process);
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
  ctx->arena = hand->draft;
  called = plan->call(ctx, node->handler, args, 2, &response, &inner);
  ctx->arena = hand->rest;
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
    reason = fl_conc_keep_text(sched, inner.message);
    entry->outcome = budget ? "запас исчерпан" : "отказ";
  } else if (fl_conc_read_response(ctx, response, node->handler, &state, &actions, &inner) != FL_OK) {
    failed = "FLANG_PROCESS";
    /* Копия берётся и здесь: правило «текст отказа живёт копией» дешевле
       разбора того, чей это был черновик. */
    reason = fl_conc_keep_text(sched, inner.message);
    entry->outcome = "отказ";
  }

  if (failed == NULL) {
    size_t action = 0;
    fl_conc_hold(sched, process);
    sched->slots[process].current = state;
    fl_conc_drop(sched, process);
    committed = true;
    /* Пробег обработчика стоит единицу виртуального времени. Без этого правила
       таймер не сработал бы никогда в программе, которой всё время есть чем
       заняться, — например, в той, что откладывает сообщения по кругу.

       В рабочем режиме время назначается заранее, пачкой на весь ломоть
       пробегов (`fl_conc_slice`), а не здесь: иначе общий счётчик двигался бы
       на каждом пробеге и стал бы той самой стенкой, ради снятия которой всё
       и затевалось. */
    if (FL_CONC_PAR(sched) == NULL) {
      sched->time += 1.0;
    }
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
        posted = fl_conc_deliver(sched, ctx, hand->worker, fl_conc_address(sched, to), what, false, false);
        /* Оба неудачных исхода — отказ ОТПРАВИТЕЛЯ, и по одному доводу: он
           попросил положить сообщение, и положить его не вышло. Полный ящик
           (А3) и нехватка памяти в куче адресата (Г2) отличаются кодом, а не
           тем, кто отвечает. */
        if (posted == FL_CONC_NOMEM) {
          fl_conc_own_failure(sched, process, entry, &failed, &reason, FL_CODE_MEMORY,
                              "кончилась память в куче адресата");
        } else if (posted == FL_CONC_FULL) {
          fl_conc_own_failure(sched, process, entry, &failed, &reason, "FLANG_MAILBOX_FULL",
                              fl_conc_full_text(sched, fl_conc_address(sched, to)));
        }
        continue;
      }
      if (strcmp(kind, "поручить") == 0) {
        /* Седьмое действие. Поручение исполняется ЗДЕСЬ, на месте выполнения
           действия, и отклик ложится в ящик названного адресата обычным
           сообщением — тем же `fl_conc_deliver`, каким ложится всё остальное.
           Отсюда три следствия, и все три те же, что у свидетеля:
             • полный ящик адресата — отказ ТОГО, КТО ПОРУЧИЛ, ровно как у
               `отправить`: он попросил принести отклик, а принести некуда;
             • мёртвый или необъявленный адресат отказом не является, отклик
               пропадает так же, как пропадает отправка мёртвому;
             • пробег на время исполнения поручения СТОИТ: хозяин синхронен, и
               медленное поручение держит планировщик. Цена та же, что у
               длинного обработчика, и названа по той же причине. Из этого
               правила ОДНО исключение, и оно названо там же, где сделано: шесть
               поручений соединения не держат пробег ни мгновения — им отвечать
               нечем СЕЙЧАС, и они уходят в список ожиданий, а отклик приносит
               опрос сети (`fl_conc_net_pump`) обычным сообщением. */
        fl_value order = fl_nothing();
        fl_value answer = fl_nothing();
        fl_conc_post posted = FL_CONC_POSTED;
        bool deferred = false;
        size_t whom = SIZE_MAX;
        fl_conc_variant_field(item, "кому", &to);
        fl_conc_variant_field(item, "поручение", &order);
        whom = fl_conc_address(sched, to);
        if (fl_conc_perform(sched, ctx, order, whom, &answer, &deferred, &posted, error) != FL_OK) {
          return FL_ERROR;
        }
        /* Отклик придёт ПОТОМ. Место в ящике адресата уже занято, поэтому
           переполнение здесь уже названо, а не отложено вместе с откликом. */
        if (deferred) {
          continue;
        }
        if (posted == FL_CONC_POSTED) {
          posted = fl_conc_deliver(sched, ctx, hand->worker, whom, answer, false, false);
        }
        if (posted == FL_CONC_NOMEM) {
          fl_conc_own_failure(sched, process, entry, &failed, &reason, FL_CODE_MEMORY,
                              "кончилась память в куче адресата");
        } else if (posted == FL_CONC_FULL) {
          fl_conc_own_failure(sched, process, entry, &failed, &reason, "FLANG_MAILBOX_FULL",
                              fl_conc_full_text(sched, fl_conc_address(sched, to)));
        }
        continue;
      }
      if (strcmp(kind, "через") == 0) {
        size_t target = SIZE_MAX;
        bool reserve = false;
        bool full = false;
        fl_conc_variant_field(item, "задержка", &delay);
        fl_conc_variant_field(item, "кому", &to);
        fl_conc_variant_field(item, "что", &what);
        target = fl_conc_address(sched, to);
        /* Место занимается СЕЙЧАС, а не когда таймер сработает. Живость
           адресата при этом не смотрится вовсе, и это нарочно: мёртвый
           процесс может быть поднят надзором раньше срока письма, и тогда
           незанятое место дало бы ящику переполниться мимо потолка. */
        reserve = target != SIZE_MAX && fl_conc_node(sched, target)->mailbox != 0;
        if (reserve) {
          fl_conc_hold(sched, target);
          full = fl_conc_box_full(sched, target);
          if (!full) {
            sched->slots[target].pending += 1;
          }
          fl_conc_drop(sched, target);
        }
        if (full) {
          fl_conc_own_failure(sched, process, entry, &failed, &reason, "FLANG_MAILBOX_FULL",
                              fl_conc_full_text(sched, target));
          continue;
        }
        if (!fl_conc_timer_push(sched, ctx, sched->time + (delay.tag == FL_NUMBER ? delay.as.number : 0.0),
                                target, what, reserve)) {
          /* Почтовая куча общая на прогон, но положить в неё просил ЭТОТ
             процесс, и отвечает за это он же (Г2). */
          if (reserve) {
            fl_conc_hold(sched, target);
            sched->slots[target].pending -= 1;
            fl_conc_drop(sched, target);
          }
          fl_conc_own_failure(sched, process, entry, &failed, &reason, FL_CODE_MEMORY,
                              "кончилась память в почтовой куче");
        }
        continue;
      }
      if (strcmp(kind, "отложить") == 0) {
        /* За уже пришедшие, а не в голову: цена откладывания обязана быть
           видимой, иначе выборочный приём вернулся бы через заднюю дверь. */
        bool laid = false;
        fl_conc_hold(sched, process);
        laid = fl_conc_box_push(&sched->slots[process].heap[sched->slots[process].live],
                                &sched->slots[process].box, message, false);
        if (laid) {
          fl_conc_refresh(sched, process, hand->worker);
        }
        fl_conc_drop(sched, process);
        if (!laid) {
          /* Замок снят ДО отказа намеренно: `fl_conc_own_failure` берёт его сам,
             а взять невозвратный замок дважды значит встать навсегда. */
          fl_conc_own_failure(sched, process, entry, &failed, &reason, FL_CODE_MEMORY,
                              "кончилась память в собственной куче процесса");
          continue;
        }
        entry->outcome = "отложено";
        continue;
      }
      if (strcmp(kind, "продолжить") == 0) {
        bool laid = false;
        fl_conc_hold(sched, process);
        laid = fl_conc_box_push(&sched->slots[process].heap[sched->slots[process].live],
                                &sched->slots[process].box, message, true);
        if (laid) {
          fl_conc_refresh(sched, process, hand->worker);
        }
        fl_conc_drop(sched, process);
        if (!laid) {
          fl_conc_own_failure(sched, process, entry, &failed, &reason, FL_CODE_MEMORY,
                              "кончилась память в собственной куче процесса");
          continue;
        }
        entry->outcome = "продолжено";
        continue;
      }
      if (strcmp(kind, "породить") == 0) {
        fl_value form = fl_nothing();
        fl_value born = fl_nothing();
        fl_conc_variant_field(item, "вид", &form);
        fl_conc_variant_field(item, "имя", &born);
        fl_conc_variant_field(item, "что", &what);
        if (!fl_conc_spawn(sched, ctx, hand->worker, process, form, born, what, entry, &failed, &reason)) {
          return fl_conc_memory(ctx, error);
        }
        continue;
      }
      if (strcmp(kind, "остановить") == 0) {
        fl_value why = fl_nothing();
        const char *text = NULL;
        fl_conc_variant_field(item, "почему", &why);
        text = fl_conc_cstring(sched, why);
        fl_conc_hold(sched, process);
        sched->slots[process].alive = false;
        fl_conc_refresh(sched, process, SIZE_MAX);
        fl_conc_drop(sched, process);
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
    if (FL_CONC_PAR(sched) == NULL) {
      sched->time += 1.0;
    }
    fl_conc_hold(sched, process);
    sched->slots[process].alive = false;
    fl_conc_refresh(sched, process, SIZE_MAX);
    fl_conc_drop(sched, process);
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
    fl_value moved = sched->slots[process].current;
    bool evacuated = false;
    /* Пробег, кончившийся отказом, черновик уже не держит: состояние из него
       никуда не поехало, текст отказа скопирован, сообщение журнала
       скопировано. Значит черновик можно сбросить ДО переезда, а не после, —
       и это не мелочь, а половина шага Г2: если пробег упал ИМЕННО по памяти,
       то переезду она нужна прямо сейчас, а держит её брошенный черновик. */
    if (failed != NULL && !committed) {
      fl_arena_reset(hand->draft);
    }
    /* Замок держится на весь переезд: он читает ящик и сбрасывает половину
       кучи, а писать в ящик может любой отправитель. */
    fl_conc_hold(sched, process);
    evacuated = fl_conc_evacuate(sched, ctx, process, &moved);
    if (evacuated) {
      sched->slots[process].current = moved;
    } else {
      /* Не хватило памяти даже на переезд. Это отказ ПРОЦЕССА, а не смерть
         программы (Г2): куча своя, и распорядиться ею — его дело. Переносить
         нечего и некуда, поэтому процесс отдаёт всё и возвращается к
         начальному состоянию, которое лежит в арене вызывающего. */
      fl_conc_surrender(sched, process);
    }
    fl_conc_drop(sched, process);
    if (!evacuated) {
      fl_conc_own_failure(sched, process, entry, &failed, &reason, FL_CODE_MEMORY,
                          "кончилась память при переезде кучи процесса");
    }
    fl_arena_reset(hand->draft);
  }

  if (failed != NULL) {
    entry->code = failed;
    entry->reason = reason;
  }
  /* Запись уезжает в журнал ЗДЕСЬ, уже дописанной. В проверочном режиме порядок
     от этого не меняется ничем — пробеги идут по одному; в рабочем порядок
     записей есть порядок ЗАВЕРШЕНИЯ пробегов, и это записано в заголовке
     списком того, что перестало быть гарантией. */
  if (!fl_conc_journal_add(sched, entry)) {
    return fl_conc_memory(ctx, error);
  }

  if (failed != NULL) {
    /* Надзор — общее хозяйство целиком: он пишет решения, двигает окна порогов
       и топчется по рабочим массивам поддерева. Под общим замком, и только под
       ним; замки процессов берутся уже из-под него (`fl_conc_restart`). */
    bool broke = false;
    fl_conc_big_lock(sched);
    if (!fl_conc_note_failure(sched, process, failed, reason, entry->time)) {
      broke = true;
    } else if (!fl_conc_supervise(sched, process, failed, entry->time, escalated, hand->seen)) {
      broke = true;
    }
    fl_conc_big_unlock(sched);
    if (broke) {
      return fl_conc_memory(ctx, error);
    }
  }
  return FL_OK;
}

/* ───────────────────────────── рабочий режим: потоки ─────────────────────── */

size_t fl_conc_cores(void) {
#ifdef FL_CONC_THREADS
  const long online = sysconf(_SC_NPROCESSORS_ONLN);
  if (online <= 0) {
    return 1;
  }
  return (size_t)online > (size_t)FL_CONC_MAX_WORKERS ? (size_t)FL_CONC_MAX_WORKERS : (size_t)online;
#else
  return 0;
#endif
}

#ifdef FL_CONC_THREADS

/**
 * Ломоть пробегов из общего счёта.
 *
 * Пробеги роздают ПАЧКОЙ, и это единственное, что держит общий замок вне
 * горячего пути: брать его на каждый пробег значило бы поставить вместо очереди
 * готовых один замок и упереться в него на четвёртом ядре.
 *
 * Предел при этом держится ТОЧНО, а не приблизительно, и вот чем. Ломоть
 * берётся на одну пачку и возвращается сразу по её окончании; поток, которому
 * пробегов не досталось, не кончает прогон, а КЛАДЁТ ПРОЦЕСС ОБРАТНО и идёт
 * спать. Прогон кончается только тогда, когда спят все, — а тогда все ломти уже
 * возвращены, и «роздано» равно «выполнено» до единицы. Поэтому выполненных
 * пробегов ровно столько, сколько объявлено, и ни одним меньше.
 */
static size_t fl_conc_slice(fl_conc_sched *sched, size_t max_turns, size_t want, size_t used, double *from,
                            bool *spent) {
  fl_conc_par *par = sched->par;
  size_t take = 0;
  *spent = false;
  pthread_mutex_lock(&par->big);
  par->done += used;
  if (par->handed < max_turns) {
    take = max_turns - par->handed;
    if (take > want) {
      take = want;
    }
    *from = sched->time;
    par->handed += take;
    sched->time += (double)take;
  } else if (par->handed == par->done) {
    /* Пробегов нет И невыбранных ломтей ни у кого не осталось — вот теперь это
       исход, а не «подожди, сосед вернёт». Без второго условия прогон кончался
       бы раньше времени и недосчитывал бы пробегов; без ПЕРВОГО он не кончался
       бы вовсе, и это не рассуждение, а найденное зависание: тридцать два
       потока по кругу снимали процесс со склада, узнавали, что пробегов нет,
       клали обратно — и ни разу не оказывались спящими все сразу. Прогон на
       сто тысяч пробегов, идущий на шестнадцати потоках 0,115 секунды, на
       тридцати двух не кончался и за минуту при полной загрузке ядер. */
    par->over = true;
    *spent = true;
  }
  pthread_mutex_unlock(&par->big);
  return take;
}

/** Свести счёт: невыбранные пробеги вернуть, выполненные записать. Зовётся,
    когда поток остаётся без работы, — то есть редко. */
static void fl_conc_settle(fl_conc_sched *sched, size_t unused, size_t drained) {
  fl_conc_par *par = sched->par;
  if (unused == 0 && drained == 0) {
    return;
  }
  pthread_mutex_lock(&par->big);
  par->handed -= unused;
  par->done += drained;
  sched->time -= (double)unused;
  pthread_mutex_unlock(&par->big);
}

/** Снять процесс со склада: сперва со своего, потом у соседей. SIZE_MAX — пусто
    везде. Подворовывание — не украшение: без него поток, чьи процессы замолчали,
    стоял бы рядом с занятым соседом. */
static size_t fl_conc_take(fl_conc_par *par, size_t worker) {
  size_t step = 0;
  for (step = 0; step < par->workers; step += 1) {
    fl_conc_shard *shard = &par->shards[(worker + step) % par->workers];
    size_t got = SIZE_MAX;
    /* На СВОЙ склад поток встаёт в очередь, на чужой — только пробует. Разница
       не косметическая: когда работы мало, все потоки разом обходят все склады,
       и очередь на чужой замок превращается в толпу, которая мешает тому
       единственному, у кого работа есть. Не подворовалось — не беда: через
       мгновение попробуем снова. */
    if (step == 0) {
      pthread_mutex_lock(&shard->lock);
    } else if (pthread_mutex_trylock(&shard->lock) != 0) {
      continue;
    }
    if (shard->head != SIZE_MAX) {
      got = shard->head;
      shard->head = par->next[got];
      if (shard->head == SIZE_MAX) {
        shard->tail = SIZE_MAX;
      }
    }
    pthread_mutex_unlock(&shard->lock);
    if (got != SIZE_MAX) {
      return got;
    }
  }
  return SIZE_MAX;
}

/**
 * Тихо ли стало настолько, что прогону конец. Зовётся из-под `idle_lock` тем
 * потоком, который уснул последним, — значит все ломти уже возвращены.
 *
 * Два исхода: работы нет и не будет (`покой`) либо работы нет, но есть таймер —
 * тогда время прыгает сразу к ближайшему сроку, и прогон продолжается. Третий,
 * «пробеги кончились», решается не здесь, а там, где их раздают
 * (`fl_conc_slice`): он не требует, чтобы спали все, и потому не зависит от
 * того, сойдутся ли когда-нибудь тридцать два потока в одном мгновении.
 */
static bool fl_conc_quiet(fl_conc_sched *sched) {
  fl_conc_par *par = sched->par;
  size_t index = 0;
  double due = 0.0;
  bool found = false;
  bool empty = true;
#ifdef FL_CONC_NET
  /* Прогон, у которого кто-то ждёт сеть, НЕ в покое, сколько бы пусты ни были
     склады: письмо придёт снаружи, а не изнутри. Без этой строки служба,
     дождавшаяся тишины между запросами, объявляла бы работу законченной. */
  if (sched->wait_count > 0) {
    return false;
  }
#endif
  for (index = 0; index < par->workers; index += 1) {
    pthread_mutex_lock(&par->shards[index].lock);
    if (par->shards[index].head != SIZE_MAX) {
      empty = false;
    }
    pthread_mutex_unlock(&par->shards[index].lock);
  }
  if (!empty) {
    return false;
  }
  pthread_mutex_lock(&par->big);
  for (index = 0; index < sched->timer_count; index += 1) {
    if (!found || sched->timers[index].time < due) {
      due = sched->timers[index].time;
      found = true;
    }
  }
  /* Тишина: скачок сразу к ближайшему сроку. Таймер на пять секунд в проверке не
     ждёт пяти секунд — он ждёт, когда планировщику станет нечего делать. */
  if (found && due > sched->time) {
    sched->time = due;
  }
  pthread_mutex_unlock(&par->big);
  return !found;
}

/** Кончен ли прогон. Раз на пачку, а не на пробег: замок дешёвый, но не даровой. */
static bool fl_conc_stopped(fl_conc_par *par) {
  bool stop = false;
  pthread_mutex_lock(&par->idle_lock);
  stop = par->stop;
  pthread_mutex_unlock(&par->idle_lock);
  return stop;
}

/** Объявить прогону конец. */
static void fl_conc_halt(fl_conc_par *par) {
  pthread_mutex_lock(&par->idle_lock);
  par->stop = true;
  pthread_mutex_unlock(&par->idle_lock);
}

/**
 * Своё у каждого потока. Набивка до строки кэша — не украшение и не суеверие:
 * счётчики двух соседних потоков лежали в одной строке, и каждая запись в свой
 * гоняла эту строку от ядра к ядру. Замер назвал цену: на тридцати двух потоках
 * прогон, который на шестнадцати шёл 0,57 секунды, не кончался и за десять
 * минут при двадцати трёх занятых ядрах.
 *
 * Заодно счётчик перестал расти на каждом пробеге: `fl_conc_drain` считает у
 * себя в переменной и записывает раз на пачку.
 */
/** Ломоть пробегов, взятый потоком у общего счёта, и что от него осталось.
    Живёт дольше пачки — в этом весь смысл: общий замок берётся раз на ломоть. */
typedef struct fl_conc_purse {
  size_t left;  /* сколько пробегов ещё можно выполнить */
  size_t used;  /* сколько выполнено с прошлого захода к общему счёту */
  double clock; /* виртуальное время следующего пробега */
} fl_conc_purse;

typedef struct fl_conc_crew {
  fl_conc_sched *sched;
  size_t worker;
  size_t max_turns;
  size_t executed;
  char padding[64];
} fl_conc_crew;

/** Поспать сотню микросекунд. Кладущий на склад никого не будит — иначе доставка
    платила бы за общий замок на каждом письме, — поэтому спящий просыпается сам
    и обходит склады заново. Цена — задержка на хвосте прогона, и она измерена. */
static void fl_conc_doze(void) {
  struct timespec pause;
  pause.tv_sec = 0;
  pause.tv_nsec = 100000L;
  nanosleep(&pause, NULL);
}

/**
 * Вычерпать ящик процесса: до `left` пробегов подряд, не отпуская процесс.
 *
 * Возвращает, сколько пробегов израсходовано, — по нему возвращается невыбранный
 * остаток ломтя. Сообщение снимается из ящика ПОД ЗАМКОМ и ровно один раз:
 * снять его и не выполнить значило бы потерять письмо молча.
 */
static size_t fl_conc_drain(fl_conc_sched *sched, fl_conc_hand *hand, fl_conc_purse *purse, size_t process,
                            size_t max_turns, bool *spent) {
  fl_conc_par *par = sched->par;
  size_t drained = 0;
  /* Признак остановки внутри пачки НЕ спрашивается. Пачка не длиннее
     `FL_CONC_BATCH` пробегов, значит остановка опаздывает не больше чем на неё, а
     завершаемость от этого не страдает: пробеги всё равно кончатся. Цена
     названа в заголовке списком того, что перестало быть гарантией: отказ,
     дошедший доверху, останавливает программу не «в тот же миг», а к концу
     текущих пачек. */
  *spent = false;
  while (drained < FL_CONC_BATCH) {
    if (purse->left == 0) {
      /* Ломоть кончился — новый берётся ЗДЕСЬ, а не на границе пачки: общий
         замок обязан браться раз на тысячу пробегов, а не раз на шестьдесят
         четыре. Выполненное с прошлого захода засчитывается тем же движением. */
      purse->left = fl_conc_slice(sched, max_turns, FL_CONC_TURN_SLICE, purse->used, &purse->clock, spent);
      purse->used = 0;
      if (purse->left == 0) {
        break;
      }
    }
    fl_value message = fl_nothing();
    bool got = false;
    bool escalated = false;
    fl_conc_hold(sched, process);
    if (sched->slots[process].alive && sched->slots[process].box.count > 0) {
      message = fl_conc_box_shift(&sched->slots[process].box);
      got = true;
    }
    fl_conc_drop(sched, process);
    if (!got) {
      break;
    }
    drained += 1;
    purse->left -= 1;
    purse->used += 1;
    purse->clock += 1.0;
    if (fl_conc_turn(sched, hand, process, message, purse->clock - 1.0, &escalated, &par->error) != FL_OK) {
      pthread_mutex_lock(&par->big);
      par->status = FL_ERROR;
      pthread_mutex_unlock(&par->big);
      fl_conc_halt(par);
      break;
    }
    if (escalated) {
      /* Отказ дошёл доверху: останавливается вся программа. Это исход, а не
         зависание, и он назван — иначе прогон отличал бы «надзор не справился»
         от «работа кончилась» только по итоговым состояниям. */
      pthread_mutex_lock(&par->big);
      par->escalated = true;
      pthread_mutex_unlock(&par->big);
      fl_conc_halt(par);
      break;
    }
  }
  return drained;
}

/**
 * Один поток рабочего режима.
 *
 * Берёт ГОТОВЫЙ ПРОЦЕСС и вычерпывает его ящик пачкой до `FL_CONC_BATCH`
 * сообщений — ровно то, ради чего рабочий режим раздаёт процессы, а не пробеги:
 * передача работы другому потоку платится один раз на пачку. Пока процесс у
 * потока, никто другой его не запускает — за этим следит признак под замком
 * процесса, и потому состояние и куча процесса на время пробега снова
 * однопоточны, как в проверочном режиме.
 */
static void *fl_conc_worker(void *raw) {
  fl_conc_crew *crew = (fl_conc_crew *)raw;
  fl_conc_sched *sched = crew->sched;
  fl_conc_par *par = sched->par;
  fl_conc_hand hand;
  fl_conc_purse purse;
  fl_ctx ctx;
  fl_arena draft;
  unsigned spins = 0;

  fl_arena_init(&draft);
  /* Отметку стека каждый поток снимает СВОЮ: стек у него свой, и сторожить
     глубину по отметке главного потока значило бы сторожить по числу, не
     имеющему к этому стеку отношения. */
  fl_ctx_init(&ctx, &draft);
  ctx.max_depth = sched->ctx->max_depth;
  hand.ctx = &ctx;
  hand.draft = &draft;
  /* В рабочем режиме отклик разбирается в ЧЕРНОВИКЕ: арена вызывающего одна на
     прогон, и писать в неё без общего замка нельзя. Текст отказа от этого не
     страдает — он и так живёт дальше только копией. */
  hand.rest = &draft;
  hand.seen = par->seen == NULL ? NULL : &par->seen[crew->worker * sched->plan->supervisor_count];
  hand.worker = crew->worker;

  purse.left = 0;
  purse.used = 0;
  purse.clock = 0.0;
  while (!fl_conc_stopped(par)) {
    size_t process = fl_conc_take(par, crew->worker);
    /* Оба вида безделья — «работы нет» и «пробегов не досталось» — ведут в одно
       и то же место. Порознь они дали бы вечный круг: поток, которому не
       достаётся пробегов, снимал бы процесс со склада и клал обратно, никогда не
       засыпая, и тогда «все спят» не наступило бы никогда. */
    bool idled = false;

    if (process == SIZE_MAX) {
      /* Сперва посмотреть таймеры — их мог поставить сосед. Спрашивать про них
         замком на каждом холостом круге дорого, а счётчик читается и так. */
      if (sched->timer_count > 0 && !fl_conc_fire_timers(sched, &ctx)) {
        pthread_mutex_lock(&par->big);
        par->status = FL_ERROR;
        pthread_mutex_unlock(&par->big);
        fl_conc_halt(par);
        break;
      }
#ifdef FL_CONC_NET
      /* Сеть спрашивается и здесь, и ТОЛЬКО с нулевым тайм-аутом: общий замок
         опрос берёт сам, а спать под общим замком значило бы остановить всех
         соседей заодно. Ждать в рабочем режиме есть чем и без этого — холостой
         поток и так засыпает на сотню микросекунд ниже по кругу. Цена: письмо
         из сети опаздывает на эту сотню, и это названо числом, а не словом
         «быстро». */
      if (fl_conc_net_pending(sched)) {
        fl_error trouble;
        trouble.code = NULL;
        trouble.message = NULL;
        if (!fl_conc_net_pump(sched, &ctx, 0, &trouble)) {
          pthread_mutex_lock(&par->big);
          par->status = FL_ERROR;
          par->error = trouble;
          pthread_mutex_unlock(&par->big);
          fl_conc_halt(par);
          break;
        }
      }
#endif
      idled = true;
    } else {
      /* Процесс снят со склада — значит он мой, и до конца пачки только мой. */
      fl_conc_hold(sched, process);
      par->state[process] = FL_CONC_RUNNING;
      fl_conc_drop(sched, process);

      bool spent = false;
      size_t drained = fl_conc_drain(sched, &hand, &purse, process, crew->max_turns, &spent);
      crew->executed += drained;
      idled = drained == 0;
      if (spent) {
        fl_conc_halt(par);
      }

      /* Пачка кончилась. Процесс возвращается в покой, а если ящик непуст —
         сразу обратно на склад: решение принимается под тем же замком, под
         которым ящик пополняют, поэтому «положили и не разбудили» здесь
         невозможно. */
      fl_conc_hold(sched, process);
      par->state[process] = FL_CONC_IDLE;
      fl_conc_refresh(sched, process, crew->worker);
      fl_conc_drop(sched, process);
      if (drained > 0) {
        spins = 0;
      }
    }

    if (!idled) {
      continue;
    }
    spins += 1;
    if (spins < 32) {
      sched_yield();
      continue;
    }
    spins = 0;
    /* Ломоть возвращается ровно здесь: поток уходит спать, и держать за собой
       пробеги, которые могли бы достаться соседу, ему больше незачем. Заодно это
       и есть то мгновение, в которое «роздано» сходится с «выполнено», — а без
       такого мгновения предел пробегов нельзя было бы объявить точным. */
    fl_conc_settle(sched, purse.left, purse.used);
    purse.left = 0;
    purse.used = 0;
    {
      bool stop = false;
      pthread_mutex_lock(&par->idle_lock);
      par->idle += 1;
      if (par->idle == par->workers && fl_conc_quiet(sched)) {
        par->stop = true;
      }
      stop = par->stop;
      pthread_mutex_unlock(&par->idle_lock);
      if (!stop) {
        fl_conc_doze();
      }
      pthread_mutex_lock(&par->idle_lock);
      par->idle -= 1;
      pthread_mutex_unlock(&par->idle_lock);
    }
  }

  fl_arena_release(&draft);
  return NULL;
}
#endif /* FL_CONC_THREADS */

/**
 * Прогон БЕЗ хозяина — то, чем `fl_conc_run` был всегда.
 *
 * Обёртка, а не копия: у прогона, идущего на сверку со свидетелем, хозяина нет и
 * быть не должно, а прежняя подпись обязана остаться прежней — её зовут и
 * прогонщик, и тесты. Новый довод дописан отдельной функцией именно затем,
 * чтобы «проверяется» и «работает» отличались вызовом, а не забытым `false`.
 */
fl_status fl_conc_run(fl_ctx *ctx, const fl_conc_plan *plan, const char *run, double seed, size_t max_turns,
                      size_t max_processes, size_t workers, bool journal, fl_conc_result *out,
                      fl_error *error) {
  return fl_conc_run_host(ctx, plan, run, seed, max_turns, max_processes, workers, journal, false, out,
                          error);
}

fl_status fl_conc_run_host(fl_ctx *ctx, const fl_conc_plan *plan, const char *run, double seed,
                           size_t max_turns, size_t max_processes, size_t workers, bool journal, bool host,
                           fl_conc_result *out, fl_error *error) {
  fl_conc_sched sched;
  const fl_conc_run_spec *spec = NULL;
  fl_value *inbox = NULL;
  bool *seen = NULL;
  fl_value *states = NULL;
  bool *alive = NULL;
  const char **names = NULL;
  const char *outcome = "покой";
  size_t index = 0;
#ifdef FL_CONC_THREADS
  fl_conc_par par;
  fl_conc_crew *crew = NULL;
  pthread_t *threads = NULL;
  size_t started = 0;
#endif
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
  /* Кости хозяина заводятся ОТ ТОГО ЖЕ СЕМЕНИ, но своим состоянием: прогон с
     хозяином и семенем N обязан быть повторимым целиком, вместе с бросками. */
  sched.dice = fl_conc_seed(seed);
  sched.host = host;
  sched.keep_journal = journal;
  sched.max_processes = max_processes == 0 ? FL_CONC_MAX_PROCESSES : max_processes;
  sched.proc_count = plan->process_count;
  if (sched.max_processes < plan->process_count) {
    sched.max_processes = plan->process_count;
  }
  if (workers > FL_CONC_MAX_WORKERS) {
    return fl_fail(ctx, error, "FLANG_PROCESS", "потоков просят больше объявленного предела %lu",
                   (unsigned long)FL_CONC_MAX_WORKERS);
  }
#ifndef FL_CONC_THREADS
  /* Сборка без потоков. Молча исполнить рабочий режим одним потоком было бы
     худшим из ответов: заказчик получил бы воспроизводимость, о которой не
     просил, и решил бы, что многоядерность работает. */
  if (workers > 1) {
    return fl_fail(ctx, error, "FLANG_PROCESS",
                   "рабочий (многопоточный) режим в этой сборке выключен: собрано с FL_CONC_NO_THREADS");
  }
#endif

  /* ── Сколько места занять сразу ──────────────────────────────────────────
     В проверочном режиме таблицы растут по мере надобности, как росли всегда.
     В рабочем они покупаются СРАЗУ на объявленный предел числа процессов, и это
     не расточительность, а условие правильности: переезд таблицы на новое место
     оставил бы соседний поток читать старое. Плата названа и измерена — адресное
     пространство под слоты плюс байт признака на процесс, — а трогается из неё
     только то, где процессы действительно завелись. Отсюда правило для
     вызывающего: в рабочем режиме предел `processes` ставят по делу, а не с
     запасом в сто раз. */
  if (!fl_conc_reserve(&sched, workers > 1 ? sched.max_processes : plan->process_count)) {
    return fl_conc_memory(ctx, error);
  }
  /* Указатель имён строится ОДИН раз на прогон и дальше только дополняется
     порождёнными. Строится он здесь, а не при первой доставке: доставка обязана
     стоить одинаково на первом письме и на миллионном. */
  if (!fl_conc_index_build(&sched, workers > 1 ? sched.max_processes : plan->process_count)) {
    return fl_conc_memory(ctx, error);
  }
#ifdef FL_CONC_THREADS
  if (workers > 1) {
    const size_t born_room = sched.max_processes - plan->process_count;
    memset(&par, 0, sizeof(par));
    par.workers = workers;
    /* Массив порождённых тоже не имеет права переезжать: `fl_conc_node` читает
       его из любого потока. */
    if (born_room > 0) {
      sched.born = (fl_conc_process *)fl_arena_alloc(sched.home, born_room * sizeof(fl_conc_process));
      if (sched.born == NULL) {
        return fl_conc_memory(ctx, error);
      }
      sched.born_capacity = born_room;
    }
    par.state = (unsigned char *)fl_arena_alloc(sched.home, sched.max_processes);
    par.next = (size_t *)fl_arena_alloc(sched.home, sched.max_processes * sizeof(size_t));
    par.shards = (fl_conc_shard *)fl_arena_alloc(sched.home, workers * sizeof(fl_conc_shard));
    crew = (fl_conc_crew *)fl_arena_alloc(sched.home, workers * sizeof(fl_conc_crew));
    threads = (pthread_t *)fl_arena_alloc(sched.home, workers * sizeof(pthread_t));
    if (plan->supervisor_count > 0) {
      par.seen = (bool *)fl_arena_alloc(sched.home, workers * plan->supervisor_count * sizeof(bool));
    }
    if (par.state == NULL || par.next == NULL || par.shards == NULL || crew == NULL || threads == NULL ||
        (plan->supervisor_count > 0 && par.seen == NULL)) {
      return fl_conc_memory(ctx, error);
    }
    memset(par.state, FL_CONC_IDLE, sched.max_processes);
    /* Замков ПУЛ, а не по замку на процесс. Замок стоит сорок байт, и на четырёх
       миллионах процессов это сто шестьдесят мегабайт, которые пришлось бы ещё и
       завести по одному; пул в четыре тысячи стоит килобайты и даёт ложное
       столкновение раз в четыре тысячи. Соседям по остатку от деления это стоит
       ожидания, а не ошибки: замок защищает ящик и кучу, а не порядок. */
    par.lock_count = FL_CONC_LOCKS;
    par.locks = (fl_conc_guard *)fl_arena_alloc(sched.home, par.lock_count * sizeof(fl_conc_guard));
    if (par.locks == NULL) {
      return fl_conc_memory(ctx, error);
    }
    for (index = 0; index < par.lock_count; index += 1) {
      if (pthread_mutex_init(&par.locks[index].lock, NULL) != 0) {
        while (index > 0) {
          index -= 1;
          pthread_mutex_destroy(&par.locks[index].lock);
        }
        return fl_fail(ctx, error, "FLANG_PROCESS", "не завёлся замок планировщика");
      }
    }
    for (index = 0; index < workers; index += 1) {
      par.shards[index].head = SIZE_MAX;
      par.shards[index].tail = SIZE_MAX;
      pthread_mutex_init(&par.shards[index].lock, NULL);
    }
    {
      /* Общий замок ВОЗВРАТНЫЙ: диагностику строят и из-под него, и снаружи. */
      pthread_mutexattr_t kind;
      pthread_mutexattr_init(&kind);
      pthread_mutexattr_settype(&kind, PTHREAD_MUTEX_RECURSIVE);
      pthread_mutex_init(&par.big, &kind);
      pthread_mutexattr_destroy(&kind);
    }
    pthread_mutex_init(&par.idle_lock, NULL);
    par.status = FL_OK;
    par.error.code = NULL;
    par.error.message = NULL;
    par.ready = true;
    /* С этой строки планировщик в рабочем режиме, и все замки перестают быть
       пустыми вызовами. Ставится она ПОСЛЕ того, как всё заведено. */
    sched.par = &par;
  }
#endif

  /* Кучи заводятся ДО первого вычисления: с этой строки любой выход обязан
     идти через `finish`. Начальное состояние при этом строится в арене
     вызывающего, а не в куче процесса, — перезапуск надзором обязан вернуть то
     же самое значение, а половины кучи к тому времени сброшены обе. */
  for (index = 0; index < plan->process_count; index += 1) {
    fl_arena_init_small(&sched.slots[index].heap[0], FL_CONC_HEAP_LEAST);
    fl_arena_init_small(&sched.slots[index].heap[1], FL_CONC_HEAP_LEAST);
    sched.slots[index].live = 0;
  }
  fl_arena_init(&sched.draft);
  fl_arena_init(&sched.post[0]);
  fl_arena_init(&sched.post[1]);
  sched.post_live = 0;
#ifdef FL_CONC_NET
  fl_arena_init(&sched.netpad);
  /* Номера соединений начинаются с ЕДИНИЦЫ, как у хозяина планов: ноль в этом
     языке — обычное число, и соединение с номером ноль отличалось бы от
     «соединения нет» только вниманием читателя. */
  sched.next_wire = 1;
#endif
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
     так же, как у свидетеля, где «дано» кладётся в ящик, а не доставляется. */
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
        fl_conc_deliver(&sched, ctx, SIZE_MAX, fl_conc_find(plan, spec->targets[index]), inbox[index], false,
                        false);
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

#ifdef FL_CONC_THREADS
  if (sched.par != NULL) {
    /* ── Рабочий режим ──────────────────────────────────────────────────────
       Чередование выбирает не семя, а планировщик ОС. Всё, что при этом
       перестаёт быть гарантией, перечислено в шапке `flang_conc.h`, и итог
       прогона называет режим вслух полем `workers`, чтобы читатель не мог
       принять один режим за другой.

       Начальные сообщения уже лежат в ящиках, и `fl_conc_deliver` при их
       раскладке уже разложил процессы по складам: доставка и пробуждение — одно
       и то же действие, и второго списка «кто готов» здесь нет вовсе. */
    for (index = 0; index < workers; index += 1) {
      crew[index].sched = &sched;
      crew[index].worker = index;
      crew[index].max_turns = max_turns;
      crew[index].executed = 0;
    }
    for (index = 0; index < workers; index += 1) {
      pthread_attr_t attr;
      const size_t room = fl_stack_room();
      int made = -1;
      if (pthread_attr_init(&attr) != 0) {
        break;
      }
      /* Стек потоку даётся тот же, под который объявлен предел глубины: сторож
         в `fl_ctx_init` спросит `fl_stack_room()` и получит то же число, что у
         главного потока. Дать меньше значило бы объявить предел, которого стек
         не несёт, — ровно та ошибка, которую рантайм уже однажды нашёл. */
      if (room > 0) {
        (void)pthread_attr_setstacksize(&attr, room + FL_STACK_MARGIN);
      }
      made = pthread_create(&threads[index], &attr, fl_conc_worker, &crew[index]);
      pthread_attr_destroy(&attr);
      if (made != 0) {
        break;
      }
      started += 1;
    }
    if (started == 0) {
      status = fl_fail(ctx, error, "FLANG_PROCESS", "не завёлся ни один поток планировщика");
      goto finish;
    }
    /* Заведись не все — прогон идёт на тех, кто завёлся, и итог скажет, сколько
       их. Молчать про это нельзя: «просили восемь, работал один» — разница в
       скорости, а не в исходе, но узнать о ней надо не по секундомеру.

       `par.workers` при этом НЕ меняется, и это важно: по нему считается номер
       склада (`процесс % потоков`). Сменить его посреди прогона значило бы
       отправлять процессы на склад с номером, которого больше нет ни у кого, —
       а обходят склады всё равно все, потому что подворовывание идёт по кругу. */
    for (index = 0; index < started; index += 1) {
      pthread_join(threads[index], NULL);
    }
    for (index = 0; index < started; index += 1) {
      sched.turns += crew[index].executed;
    }
    /* Виртуальное время в рабочем режиме — счёт выполненных пробегов. Роздано
       могло быть больше (ломоть берётся на пачку), но всё лишнее возвращено, и
       врать про «время», которого не было, незачем. */
    if (sched.time > (double)sched.turns) {
      sched.time = (double)sched.turns;
    }
    if (par.status != FL_OK) {
      *error = par.error;
      status = par.status;
      goto finish;
    }
    if (par.escalated) {
      outcome = "отказ дошёл доверху";
      for (index = 0; index < sched.proc_count; index += 1) {
        sched.slots[index].alive = false;
      }
    } else if (par.over) {
      outcome = "предел пробегов";
    }
  } else
#endif
  {
    /* ── Проверочный режим ──────────────────────────────────────────────────
       Тот же самый, каким был: один поток, чередование по семени, побайтовая
       сверка со свидетелем. Ниже не изменено ничего, кроме того, что тело пробега
       уехало в `fl_conc_turn` и зовётся оттуда обоими режимами. */
    fl_conc_hand hand;
    hand.ctx = ctx;
    hand.draft = &sched.draft;
    hand.rest = sched.home;
    hand.seen = seen;
    hand.worker = 0;
    for (;;) {
      size_t chosen = 0;
      size_t process = 0;
      fl_value message = fl_nothing();
      bool escalated = false;

      if (!fl_conc_fire_timers(&sched, ctx)) {
        status = fl_conc_memory(ctx, error);
        goto finish;
      }
#ifdef FL_CONC_NET
      /* Сеть спрашивается и на ходу — иначе письмо из неё ждало бы, пока
         планировщику станет нечего делать, а «нечего делать» у службы с двумя
         процессами может не наступить никогда. Тайм-аут НОЛЬ: есть чем
         заняться. Каждый 1024-й виток, а не каждый, — цена системного вызова
         названа у `FL_CONC_NET_EVERY`. У программы без сети это одно сравнение
         поля с нулём. */
      if (fl_conc_net_pending(&sched) && sched.turns % FL_CONC_NET_EVERY == 0) {
        if (!fl_conc_net_pump(&sched, ctx, 0, error)) {
          status = FL_ERROR;
          goto finish;
        }
      }
#endif
      if (sched.ready_count == 0) {
        double due = 0.0;
        bool found = false;
        for (index = 0; index < sched.timer_count; index += 1) {
          if (!found || sched.timers[index].time < due) {
            due = sched.timers[index].time;
            found = true;
          }
        }
#ifdef FL_CONC_NET
        /* Заняться нечем — вот здесь и ждут сеть. Ждут по-настоящему: `poll`
           спит, пока не придёт байт, и ядро на это время свободно. Есть ещё и
           таймеры — ждать нельзя, у них свои часы: тайм-аут ноль, и дальше
           виток идёт как шёл, скачком виртуального времени к ближайшему сроку. */
        if (fl_conc_net_pending(&sched)) {
          if (!fl_conc_net_pump(&sched, ctx, found ? 0 : -1, error)) {
            status = FL_ERROR;
            goto finish;
          }
          if (sched.ready_count > 0) {
            continue;
          }
          if (!found) {
            /* Опрос вернулся ни с чем (сигнал, ложная готовность) — круг
               замыкается на том же `poll`, а не объявляет прогон конченым. */
            continue;
          }
        }
#endif
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
      /* Тот же самый процесс, который свидетель взял бы из `готовые[chosen]`:
         k-й по возрастанию номера среди готовых. Разница — в цене, а не в
         ответе, и ровно это сверяется побайтово. */
      process = fl_conc_select(&sched, chosen);
      message = fl_conc_box_shift(&sched.slots[process].box);
      fl_conc_refresh(&sched, process, SIZE_MAX);
      sched.turns += 1;

      status = fl_conc_turn(&sched, &hand, process, message, sched.time, &escalated, error);
      if (status != FL_OK) {
        goto finish;
      }
      if (escalated) {
        /* Отказ дошёл доверху: останавливается вся программа. Это исход, а не
           зависание, и он назван — иначе прогон отличал бы «надзор не справился»
           от «работа кончилась» только по итоговым состояниям. */
        outcome = "отказ дошёл доверху";
        for (index = 0; index < sched.proc_count; index += 1) {
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
     и одна на прогон, а не на пробег.

     Массив под них заводится ЗДЕСЬ, а не при старте: сколько процессов у
     прогона, известно только теперь — порождённые (Б1) приписаны к тем же
     номерам, что и объявленные, и в итоге стоят за ними. */
  states = (fl_value *)fl_arena_alloc(ctx->arena, sched.proc_count * sizeof(fl_value));
  alive = (bool *)fl_arena_alloc(ctx->arena, sched.proc_count * sizeof(bool));
  names = (const char **)fl_arena_alloc(ctx->arena, sched.proc_count * sizeof(const char *));
  if (states == NULL || alive == NULL || names == NULL) {
    status = fl_conc_memory(ctx, error);
    goto finish;
  }
  for (index = 0; index < sched.proc_count; index += 1) {
    if (!fl_conc_keep(ctx, sched.home, sched.slots[index].current, &states[index])) {
      status = fl_conc_memory(ctx, error);
      goto finish;
    }
    alive[index] = sched.slots[index].alive;
    names[index] = fl_conc_node(&sched, index)->name;
  }
  out->outcome = outcome;
  out->time = sched.time;
  out->turns = sched.turns;
  out->names = names;
  out->process_count = sched.proc_count;
  out->states = states;
  out->alive = alive;
  /* Журнал отдаётся ровно тогда, когда его вели. Пустой массив вместо признака
     врал бы: «ни одного пробега» и «пробеги были, но их не записывали» — разные
     вещи, и читатель обязан их различать, иначе побайтовая сверка со свидетелем
     однажды сравнит пустоту с пустотой и промолчит. */
  out->journal_kept = sched.keep_journal;
  out->journal = sched.journal;
  out->journal_count = sched.journal_count;
  out->failures = sched.failures;
  out->failure_count = sched.failure_count;
  out->decisions = sched.decisions;
  out->decision_count = sched.decision_count;
  /* Сколько потоков вело прогон. Единица — журнал повторяется по семени; больше
     единицы — не повторяется, и читатель обязан узнать об этом из итога, а не
     из документации. */
  out->workers = workers < 1 ? 1 : workers;
#ifdef FL_CONC_THREADS
  if (sched.par != NULL) {
    out->workers = started;
  }
#endif

finish:
  /* Единственное место, где кучи возвращаются системе. Их у прогона три вида —
     по две половины на процесс, черновик и почта, — и все они куплены у malloc
     напрямую, поэтому арена вызывающего их не освободит. Пропуск этой строки
     виден не рассуждением, а проверкой: `emit-c-conc.test.mjs` гоняет прогон
     под valgrind'ом и требует ноль потерянных байт. */
  if (heaps) {
    for (index = 0; index < sched.proc_count; index += 1) {
      fl_arena_release(&sched.slots[index].heap[0]);
      fl_arena_release(&sched.slots[index].heap[1]);
    }
    fl_arena_release(&sched.draft);
    fl_arena_release(&sched.post[0]);
    fl_arena_release(&sched.post[1]);
#ifdef FL_CONC_NET
    /* Сокеты возвращаются системе тем же движением, что кучи: незакрытый
       слушающий сокет держит порт до конца процесса, и второй прогон на том же
       порту получил бы отказ там, где отказа нет. */
    fl_conc_net_close(&sched);
    fl_arena_release(&sched.netpad);
#endif
  }
#ifdef FL_CONC_THREADS
  /* Замки возвращаются системе так же, как кучи: под valgrind'ом незакрытый
     замок виден недостижимой памятью, и проверка нашла бы его первой. */
  if (sched.par != NULL && par.ready) {
    sched.par = NULL;
    for (index = 0; index < par.lock_count; index += 1) {
      pthread_mutex_destroy(&par.locks[index].lock);
    }
    for (index = 0; index < workers; index += 1) {
      pthread_mutex_destroy(&par.shards[index].lock);
    }
    pthread_mutex_destroy(&par.big);
    pthread_mutex_destroy(&par.idle_lock);
  }
#endif
  return status;
}
