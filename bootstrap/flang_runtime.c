/*
 * Сгенерировано flang (бэкенд C, flang/src/emit/c.mjs). Не редактировать руками.
 * Модуль flang: «Compiler flang».
 * Файл: рантайм: реализация.
 * Правьте исходник на flang и печатайте заново: любая правка здесь потеряется.
 */
/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/*
 * Рантайм flang для бэкенда C — реализация.
 *
 * Всё, что здесь есть, существует ради одного требования: сгенерированная
 * программа обязана давать те же значения и те же диагностики (код И текст),
 * что flang/src/interpret.mjs. Поэтому сообщения скопированы дословно, вплоть
 * до кавычек-ёлочек, порядок операций в процентах — как в ядре FTS, а число
 * печатается по правилам ECMAScript Number::toString, а не «как выйдет у %g».
 *
 * Зависимости — только стандартная библиотека C99. Единственное исключение —
 * стек: `fl_call_deep` и `fl_stack_room` спрашивают о нём POSIX (pthread,
 * getrlimit), потому что в C99 стека нет вовсе, а обещание «завершится ИЛИ
 * ОТКАЖЕТ ЧЕСТНО» без него не держится. Исключение обнесено проверкой платформы
 * и выключается одним `-DFL_NO_POSIX_STACK`: тогда файл снова чистый C99, а
 * сторож в `fl_enter` считает по FL_STACK_ROOM_FALLBACK.
 *
 * Второе исключение — WebAssembly, и оно ровно про то же самое, только отвечает
 * не система, а сам двоичный файл: у wasm стека тоже нет в языке, зато есть в
 * РАЗМЕТКЕ ПАМЯТИ модуля, которую делает компоновщик, и оттуда его настоящий
 * размер виден без единого системного вызова (см. `fl_wasm_room`). Выключается
 * одним `-DFL_NO_WASM_STACK`.
 */
#if !defined(FL_NO_POSIX_STACK) && (defined(__unix__) || defined(__unix) || \
                                    (defined(__APPLE__) && defined(__MACH__)))
/* Просить POSIX-объявления обязательно: под `-std=c99` их не видно. */
#if !defined(_POSIX_C_SOURCE)
#define _POSIX_C_SOURCE 200809L
#endif
#define FL_POSIX_STACK 1
#endif

#if defined(__wasm__) && !defined(FL_NO_WASM_STACK)
#define FL_WASM_STACK 1
#endif

#include "flang_runtime.h"

#include <errno.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#ifdef FL_POSIX_STACK
#include <pthread.h>
#include <sys/resource.h>
#endif

#ifdef FL_WASM_STACK
/*
 * Границы теневого стека, объявленные компоновщиком wasm. Символы слабые: модуль,
 * собранный так, что их нет, обязан собираться и работать — просто без этого
 * знания, по запасному числу. Значений у них нет, значение имеет их АДРЕС: это
 * отметки в разметке линейной памяти, а не переменные.
 */
extern char __heap_base __attribute__((weak));
extern char __data_end __attribute__((weak));
#endif

/* ═════════════════════════════ арена ═════════════════════════════ */

/*
 * Выравнивание: объединение самых «требовательных» типов. В C99 нет
 * max_align_t, а угадывать «наверное, 8» значило бы поймать SIGBUS на первой
 * же платформе со строгим выравниванием — а целятся сюда как раз такие
 * (RISC-V, старые ARM).
 */
typedef union fl_align {
  long double as_long_double;
  double as_double;
  void *as_pointer;
  size_t as_size;
} fl_align;

#define FL_ALIGNMENT (sizeof(fl_align))
#define FL_CHUNK_MIN (size_t)(64u * 1024u)

struct fl_chunk {
  fl_chunk *next;
  size_t used;
  size_t capacity;
};

static size_t fl_round_up(size_t size) {
  const size_t remainder = size % FL_ALIGNMENT;
  return remainder == 0 ? size : size + (FL_ALIGNMENT - remainder);
}

static char *fl_chunk_data(fl_chunk *chunk) {
  return (char *)chunk + fl_round_up(sizeof(fl_chunk));
}

void fl_arena_init(fl_arena *arena) {
  fl_arena_init_small(arena, FL_CHUNK_MIN);
}

void fl_arena_init_small(fl_arena *arena, size_t least) {
  if (arena == NULL) {
    return;
  }
  arena->chunks = NULL;
  arena->current = NULL;
  arena->reserved = 0;
  arena->handed = 0;
  arena->guard_chunk = NULL;
  arena->guard_used = 0;
  arena->staging = NULL;
  arena->staging_size = 0;
  /* Нулевой кусок не бывает, а кусок больше общего минимума и есть общий
     минимум: мельчить умеем, крупнить незачем. */
  arena->least = least == 0 || least > FL_CHUNK_MIN ? FL_CHUNK_MIN : fl_round_up(least);
}

void *fl_arena_alloc(fl_arena *arena, size_t size) {
  if (arena == NULL) {
    return NULL;
  }
  const size_t wanted = fl_round_up(size == 0 ? 1 : size);

  /* Сперва текущий кусок, затем следующие уже купленные (после reset они
     пусты и переиспользуются), и только потом покупка нового. */
  while (arena->current != NULL) {
    if (arena->current->capacity - arena->current->used >= wanted) {
      char *block = fl_chunk_data(arena->current) + arena->current->used;
      arena->current->used += wanted;
      arena->handed += wanted;
      return block;
    }
    if (arena->current->next == NULL || arena->current->next->used != 0) {
      break;
    }
    arena->current = arena->current->next;
  }

  {
    const size_t header = fl_round_up(sizeof(fl_chunk));
    size_t capacity = arena->least == 0 ? FL_CHUNK_MIN : arena->least;
    fl_chunk *chunk = NULL;
    if (capacity < wanted) {
      /*
       * Запас сверх запрошенного. Кусок, купленный впритык, полон в момент
       * покупки, и ни fl_arena_extend, ни удвоение запаса в fl_b_dobavit не
       * найдут в нём ни байта: линейное «добавить» выродилось бы обратно в
       * копию на каждом шаге — ровно то, от чего оно и заведено. Полтора раза
       * дают геометрический рост: новый кусок покупается всё реже, суммарный
       * перерасход ограничен, а накопление списка остаётся линейным.
       */
      capacity = wanted;
      if (capacity <= ((size_t)-1) / 3 * 2) {
        capacity = wanted + wanted / 2;
      }
    }
    if (capacity > (size_t)-1 - header) {
      return NULL; /* переполнение размера — только при абсурдном запросе */
    }
    chunk = (fl_chunk *)malloc(header + capacity);
    if (chunk == NULL) {
      return NULL;
    }
    chunk->capacity = capacity;
    chunk->used = wanted;
    chunk->next = NULL;
    if (arena->current == NULL) {
      chunk->next = arena->chunks;
      arena->chunks = chunk;
    } else {
      chunk->next = arena->current->next;
      arena->current->next = chunk;
    }
    arena->current = chunk;
    arena->reserved += header + capacity;
    arena->handed += wanted;
    /* Следующий кусок вдвое больше — до общего минимума и не дальше. Арена с
       мелким первым куском обязана оставаться дешёвой для того, кто ничего не
       считает, и не становиться дорогой для того, кто считает: без удвоения
       процесс, накопивший мегабайт, купил бы его двумя тысячами походов к
       malloc. С удвоением их одиннадцать. */
    if (arena->least < FL_CHUNK_MIN) {
      arena->least *= 2u;
    }
    return fl_chunk_data(chunk);
  }
}

/*
 * Продление последней выдачи. Арена — бамп указателя, и единственное, что она
 * умеет переиграть, это самый последний блок: он лежит в конце занятой части
 * текущего куска, и за ним заведомо нет ничего чужого.
 *
 * Отсюда обе проверки: блок обязан кончаться ровно на границе занятого
 * (`used`), и добавка обязана поместиться в тот же кусок. Ни то, ни другое не
 * «осторожность на всякий случай» — не выполнись любая, и продление затёрло бы
 * чужие данные.
 *
 * ── Третья проверка: продление не переходит границу области ────────────────
 * Она появилась вместе с областью на вызов, и без неё область была бы
 * НЕИСПРАВНОЙ — молча, на редком входе. Разбор целиком, потому что случай
 * тонкий и найден рассуждением, а не тестом:
 *
 *   вызывающий накопил список, его массив — последняя выдача арены;
 *   вызываемый открыл область (отметка встала ровно за массивом);
 *   внутри области «добавить» к тому же списку берёт быстрый путь, видит, что
 *   запас исчерпан, зовёт fl_arena_extend — продление ложится ВЫШЕ отметки, —
 *   и тут же правит `grow->capacity` на месте, удваивая его;
 *   область закрывается, откат забирает продлённую половину, а `grow` лежит
 *   НИЖЕ отметки, и удвоенный `capacity` остаётся в нём навсегда.
 *
 * Дальше первое же «добавить» к этому списку проходит проверку
 * `count < grow->capacity` и пишет в память, которую арена уже отдала кому-то
 * другому. Это порча чужих данных, а не потеря своих.
 *
 * Лечится там, где рождается: продлевать блок, начало которого лежит ниже
 * границы ближайшей открытой области, нельзя. Вызывающий тогда идёт медленным
 * путём — копией с запасом, — и копия эта ложится выше отметки, то есть
 * откатывается штатно.
 */
bool fl_arena_extend(fl_arena *arena, const void *block, size_t size, size_t extra) {
  fl_chunk *chunk = NULL;
  size_t taken = 0;
  size_t added = 0;
  if (arena == NULL || arena->current == NULL || block == NULL || extra == 0) {
    return false;
  }
  chunk = arena->current;
  taken = fl_round_up(size == 0 ? 1 : size);
  if (chunk->used < taken || (const char *)block != fl_chunk_data(chunk) + (chunk->used - taken)) {
    return false; /* выдавали не это или выдавали не последним */
  }
  /*
   * Граница открытой области. Куски выдаются вперёд по цепочке, а откат
   * возвращает и границу, и текущий кусок разом, — поэтому `guard_chunk`
   * всегда стоит на текущем куске или раньше него. Значит другой кусок
   * означает «блок выдан позже границы», и продлевать его можно.
   */
  if (arena->guard_chunk == chunk && (chunk->used - taken) < arena->guard_used) {
    return false;
  }
  if (size > ((size_t)-1) - extra) {
    return false;
  }
  /* Выравнивание оплачено ещё при первой выдаче, поэтому добавка считается по
     разнице округлённых размеров, а не по самому `extra`. */
  added = fl_round_up(size + extra) - taken;
  if (chunk->capacity - chunk->used < added) {
    return false; /* кусок кончился: пусть вызывающий выделит новый и скопирует */
  }
  chunk->used += added;
  arena->handed += added;
  return true;
}

void fl_arena_reset(fl_arena *arena) {
  fl_chunk *chunk = NULL;
  if (arena == NULL) {
    return;
  }
  for (chunk = arena->chunks; chunk != NULL; chunk = chunk->next) {
    chunk->used = 0;
  }
  arena->current = arena->chunks;
  arena->handed = 0;
  /* Открытых областей после сброса не бывает: сбрасывают между запросами, а не
     посреди вызова. Граница снимается, иначе она сторожила бы пустоту. */
  arena->guard_chunk = NULL;
  arena->guard_used = 0;
}

void fl_arena_release(fl_arena *arena) {
  fl_chunk *chunk = NULL;
  if (arena == NULL) {
    return;
  }
  chunk = arena->chunks;
  while (chunk != NULL) {
    fl_chunk *next = chunk->next;
    free(chunk);
    chunk = next;
  }
  free(arena->staging);
  arena->chunks = NULL;
  arena->current = NULL;
  arena->reserved = 0;
  arena->handed = 0;
  arena->guard_chunk = NULL;
  arena->guard_used = 0;
  arena->staging = NULL;
  arena->staging_size = 0;
}

/* ═════════════════════════════ стек ═════════════════════════════ */

/*
 * Сколько байт стека несёт расчёт. Ноль означает «ещё не спрашивали»; после
 * первого вопроса здесь лежит ответ, и второй раз никто не спрашивает — на
 * POSIX это системный вызов, а `fl_ctx_init` зовут на каждый запрос. Выключение
 * сторожа этим нулём не делается и делаться не может: выключает его поле
 * `ctx->stack_room` в конкретном контексте.
 */
static size_t fl_stack_known = 0;

/*
 * Сказали ли нам про стек, или мы его угадали.
 *
 * Разница между двумя этими случаями стоит целого вида отказа, поэтому она
 * названа полем, а не выведена из `fl_stack_known != 0`: там оба случая
 * выглядят одинаково. Угаданное число (FL_STACK_ROOM_FALLBACK) любой ЗАМЕР
 * вправе отменить — на то он и замер; объявленное `fl_stack_room_set` не вправе
 * отменить никто, потому что объявил его тот, кто знает, что делает, и берёт
 * последствия на себя.
 */
static bool fl_stack_told = false;

size_t fl_stack_wanted(size_t max_depth) {
  size_t wanted = 0;
  if (max_depth == 0) {
    /* Предел выключен — стеком его не обеспечить; берём столько, сколько берём
       по умолчанию, а дальше говорит сторож. */
    return FL_STACK_MIN;
  }
  /* Умножение с проверкой: `--max-depth` приходит от пользователя, а
     переполнение size_t дало бы КРОШЕЧНЫЙ стек там, где просили огромный. */
  if (max_depth > FL_STACK_MAX / (size_t)FL_STACK_PER_FRAME) {
    return FL_STACK_MAX;
  }
  wanted = max_depth * (size_t)FL_STACK_PER_FRAME + FL_STACK_MARGIN;
  if (wanted < FL_STACK_MIN) {
    return FL_STACK_MIN;
  }
  if (wanted > FL_STACK_MAX) {
    return FL_STACK_MAX;
  }
  return wanted;
}

void fl_stack_room_set(size_t bytes) {
  fl_stack_known = bytes;
  fl_stack_told = bytes != 0;
}

#ifdef FL_WASM_STACK
/*
 * Сколько теневого стека осталось под точкой `point`. Ноль значит «ответа нет»,
 * а НЕ «стека нет»: разметка незнакомая, и врать про неё нельзя.
 *
 * ── Откуда вообще берётся ответ ─────────────────────────────────────────────
 *
 * У WebAssembly нет ни getrlimit, ни сторожевой страницы, и потому казалось, что
 * спросить не у кого. Спросить есть у кого: теневой стек — не свойство среды, а
 * КУСОК ЛИНЕЙНОЙ ПАМЯТИ, который отвёл компоновщик, и его границы компоновщик же
 * и объявляет символами. Замер (clang 21.1.8, wasm32-wasi, `-O2`):
 *
 *     сборка                            __data_end   __heap_base   ёмкость
 *     как есть (умолчание wasm-ld)           4 868        70 416    65 548
 *     -Wl,-z,stack-size=1048576              4 868     1 053 456 1 048 588
 *
 * То есть формула не «знает» про 64 КиБ и не зашивает их: она читает то, что
 * компоновщик отвёл на самом деле. Кто просит стек больше — получает и предел
 * глубины больше, тем же двоичным файлом и без второго флага, который надо не
 * забыть согласовать с первым.
 *
 * ── Почему проверка, а не формула ──────────────────────────────────────────
 *
 * Разметок у wasm-ld две. Обычная: данные, потом стек, потом куча — стек лежит
 * МЕЖДУ отметками, растёт вниз, и остаток под точкой это `point - __data_end`.
 * И `--stack-first`: стек уезжает в самое начало памяти, а `__heap_base` минус
 * `__data_end` даёт 12 байт — число, по которому сторож отказал бы всему на
 * свете. Отличить их нельзя рассуждением, зато можно спросить у самого стека:
 * где лежит `point`, там и стек. Замерено на обеих разметках, обе ветки ниже
 * проверены прогоном.
 *
 * Всё, что не легло ни в одну разметку (модуль считает на чужом стеке — нити
 * wasm, стек в куче), честно отвечает нулём и уходит к запасному числу.
 */
static size_t fl_wasm_room(const char *point) {
  /* Приведение указателя к `size_t`, а не к `uintptr_t` из <stdint.h>: этот
     заголовок в напечатанном C не появляется НИ ОДНИМ включением (сторож
     `emit-c.test.mjs` — «кроме стандартной библиотеки C зависимостей быть не
     может» — проверяет список поимённо), а у wasm32 и у всех целей бэкенда
     `size_t` ровно ширины указателя. */
  const size_t here = (size_t)point;
  const size_t low = (size_t)&__data_end;
  const size_t high = (size_t)&__heap_base;
  if (here == 0u || low == 0u || high == 0u || high <= low) {
    return 0;
  }
  if (here > low && here <= high) {
    return here - low; /* данные, стек, куча: дно стека — конец данных */
  }
  if (here < low) {
    /* `--stack-first`: стек занимает начало линейной памяти, и дном ему служит
       нулевой адрес — весь остаток под точкой это её собственный адрес. */
    return here;
  }
  return 0;
}
#endif

size_t fl_stack_room(void) {
  if (fl_stack_known != 0) {
    return fl_stack_known;
  }
#ifdef FL_POSIX_STACK
  {
    struct rlimit limit;
    if (getrlimit(RLIMIT_STACK, &limit) == 0) {
      if (limit.rlim_cur == RLIM_INFINITY) {
        /* Стек без объявленного предела: врать про бесконечность нельзя, потому
           что система всё равно во что-нибудь упрётся. Берём тот же потолок, до
           которого доводит `fl_stack_wanted`. */
        fl_stack_known = FL_STACK_MAX;
        return fl_stack_known;
      }
      if ((size_t)limit.rlim_cur > FL_STACK_MARGIN) {
        /* Отметку сторож снимает не на самом дне стека, а там, где начался
           расчёт, и над ней уже лежат кадры main и разбора запроса. Их немного
           (самый толстый кадр прогонщика — 416 байт), но списать на них полный
           запас честнее, чем не списать ничего. */
        fl_stack_known = (size_t)limit.rlim_cur - FL_STACK_MARGIN;
        return fl_stack_known;
      }
    }
  }
#endif
  fl_stack_known = FL_STACK_ROOM_FALLBACK;
  return fl_stack_known;
}

#ifdef FL_POSIX_STACK
typedef struct fl_deep_work {
  void (*work)(void *);
  void *state;
} fl_deep_work;

static void *fl_deep_entry(void *raw) {
  fl_deep_work *carry = (fl_deep_work *)raw;
  carry->work(carry->state);
  return NULL;
}
#endif

bool fl_call_deep(size_t stack_bytes, void (*work)(void *), void *state) {
#ifdef FL_POSIX_STACK
  fl_deep_work carry;
  pthread_attr_t attr;
  pthread_t worker;
  struct rlimit space;
  size_t asked = stack_bytes;
  if (work == NULL) {
    return false;
  }
  carry.work = work;
  carry.state = state;
  /*
   * Стек берётся отображением, и под пределом адресного пространства он ОТНИМАЕТ
   * его у арены. Замер, который это и нашёл: под `ulimit -v 16384` восьми
   * мегабайт стека хватало, чтобы прогон конкурентности перестал доходить до
   * исхода — куча кончалась у планировщика, а не у процесса, и надзору было
   * нечего разбирать (`emit-c-conc.test.mjs`, шаг Г2).
   *
   * Отсюда правило: под объявленным пределом адресного пространства стек берёт
   * ЧЕТВЕРТЬ и не больше. Если четверти не хватает даже на системный минимум,
   * поток не заводится вовсе — и программа считает ровно там же и с той же
   * памятью, что до починки, а обещание держит сторож. Глубина, купленная ценой
   * чужой памяти, была бы не починкой, а переносом отказа в другое место.
   */
  if (getrlimit(RLIMIT_AS, &space) == 0 && space.rlim_cur != RLIM_INFINITY) {
    const size_t share = (size_t)(space.rlim_cur / 4);
    if (asked > share) {
      asked = share;
    }
    if (asked < FL_STACK_MIN) {
      return false;
    }
  }
  /*
   * Уступка вниз, а не отказ. Стек берётся у системы отображением, и под
   * `ulimit -v` (или в контейнере с пределом адресного пространства) большой
   * кусок не дадут. Отказаться совсем значило бы потерять и то, что дают;
   * поэтому просьба половинится до самого системного минимума, и лишь потом
   * расчёт идёт на своём стеке — со сторожем, который и скажет правду.
   */
  for (;;) {
    if (pthread_attr_init(&attr) != 0) {
      return false;
    }
    /* Запас объявляется ДО запуска, и это не придирчивость к порядку строк:
       поток спросит о нём в первом же `fl_ctx_init`. Объявить после
       `pthread_join` значило бы сторожить весь расчёт по стеку ГЛАВНОГО потока,
       то есть не воспользоваться заведённым ни на байт — снаружи это выглядит
       как «починка не работает», а не как ошибка порядка. */
    fl_stack_room_set(asked > FL_STACK_MARGIN ? asked - FL_STACK_MARGIN : asked);
    if (pthread_attr_setstacksize(&attr, asked) == 0 &&
        pthread_create(&worker, &attr, fl_deep_entry, &carry) == 0) {
      pthread_attr_destroy(&attr);
      return pthread_join(worker, NULL) == 0;
    }
    pthread_attr_destroy(&attr);
    fl_stack_room_set(0); /* поток не завёлся — объявленного запаса нет */
    if (asked <= FL_STACK_MIN) {
      return false;
    }
    asked /= 2;
    if (asked < FL_STACK_MIN) {
      asked = FL_STACK_MIN;
    }
  }
#else
  (void)stack_bytes;
  (void)work;
  (void)state;
  return false;
#endif
}

/* ═════════════════════════════ контекст ═════════════════════════════ */

void fl_ctx_init(fl_ctx *ctx, fl_arena *arena) {
  /* Отметка стека: адрес локальной этой самой функции. Всё, что расчёт займёт
     под ней, сторож и меряет. Брать её здесь правильно потому, что `fl_ctx_init`
     зовут ровно там, где расчёт начинается, — на запрос прогонщика, на сессию
     оболочки, на вызов встраивающего. */
  char here = 0;
  if (ctx == NULL) {
    return;
  }
  ctx->arena = arena;
  ctx->depth = 0;
  ctx->max_depth = FL_MAX_DEPTH;
  ctx->steps = 0;
  ctx->max_steps = FL_MAX_STEPS;
  ctx->stack_base = &here;
  ctx->stack_room = fl_stack_room();
#ifdef FL_WASM_STACK
  /*
   * На wasm запас не угадывают, а МЕРЯЮТ, и меряют здесь, а не в
   * `fl_stack_room`, по одной причине: ответ зависит от того, откуда позвали.
   * `fl_stack_room` отвечает один раз на процесс и запоминает ответ, а расчёт
   * может начаться и у самой вершины стека (прогонщик), и глубоко внутри чужой
   * работы (встраивающий) — запомненное число во втором случае было бы завышено
   * ровно на всё, что уже съедено. Отметка `&here` снята там же, где `stack_base`,
   * поэтому меряется именно то, что расчёту и остаётся.
   *
   * Замер отменяет догадку, но не отменяет объявленное: сказавший
   * `fl_stack_room_set` знает про свой стек больше, чем компоновщик, — так
   * говорит, например, встраивающий, который считает на стеке, отведённом им
   * самим.
   */
  if (!fl_stack_told) {
    const size_t измерено = fl_wasm_room(&here);
    if (измерено != 0) {
      ctx->stack_room = измерено;
    }
  }
#endif
  ctx->stack_seen = 0;
  ctx->stack_step = 0;
}

const char *fl_status_text(fl_status status) {
  switch (status) {
    case FL_OK:
      return "ok";
    case FL_ERROR:
      return "вычисление прекращено ошибкой";
    case FL_INVALID_ARGUMENT:
      return "недопустимый аргумент";
  }
  return "неизвестный статус";
}

/* ═════════════════════════════ ошибки ═════════════════════════════ */

static const char *fl_vformat(fl_ctx *ctx, const char *format, va_list args) {
  va_list probe;
  int needed = 0;
  char *buffer = NULL;
  if (ctx == NULL || ctx->arena == NULL) {
    return NULL;
  }
  va_copy(probe, args);
  needed = vsnprintf(NULL, 0, format, probe);
  va_end(probe);
  if (needed < 0) {
    return NULL;
  }
  buffer = (char *)fl_arena_alloc(ctx->arena, (size_t)needed + 1);
  if (buffer == NULL) {
    return NULL;
  }
  vsnprintf(buffer, (size_t)needed + 1, format, args);
  return buffer;
}

fl_status fl_fail(fl_ctx *ctx, fl_error *error, const char *code, const char *format, ...) {
  va_list args;
  const char *message = NULL;
  if (error == NULL) {
    /* Вызывающему текст не нужен — не строим его вовсе: диагностика стоит
       выделения памяти, а платить за неё молча неправильно. */
    return FL_ERROR;
  }
  va_start(args, format);
  message = fl_vformat(ctx, format, args);
  va_end(args);
  if (message == NULL) {
    error->code = FL_CODE_MEMORY;
    error->message = "недостаточно памяти для текста диагностики";
    return FL_ERROR;
  }
  error->code = code;
  error->message = message;
  return FL_ERROR;
}

static fl_status fl_no_memory(fl_error *error) {
  if (error != NULL) {
    error->code = FL_CODE_MEMORY;
    error->message = "недостаточно памяти";
  }
  return FL_ERROR;
}

/* ═════════════════════════════ граница входа ═════════════════════════════
 *
 * Значения, пришедшие СНАРУЖИ, против объявленных типов параметров. Таблица
 * печатается вместе с программой (`<модуль>_entry`), а сверяет её этот код —
 * один и тот же для всех программ, потому что второе понимание слов «значение
 * подходит типу» разошлось бы с первым молча.
 *
 * Тексты отказов — дословно те же, что у `checkValue` в flang/src/types.mjs.
 * Сверять их надо равенством строк: они и есть контракт, а не украшение.
 */

/* Текст в арену: метка пути внутрь значения строится на ходу («…[0]»). */
static const char *fl_label(fl_ctx *ctx, const char *format, ...) {
  va_list args;
  const char *text = NULL;
  va_start(args, format);
  text = fl_vformat(ctx, format, args);
  va_end(args);
  return text;
}

static fl_status fl_check_typed(fl_ctx *ctx, const fl_entry_table *table, size_t index, fl_value value,
                                const char *label, fl_error *error);

static fl_status fl_check_number_type(fl_ctx *ctx, const fl_type *type, fl_value value, const char *label,
                                      fl_error *error) {
  char text[FL_NUMBER_TEXT_MAX];
  if (value.tag != FL_NUMBER || !isfinite(value.as.number)) {
    return fl_fail(ctx, error, FL_CODE_TYPE, "%s не соответствует типу %s", label, type->name);
  }
  fl_number_text(value.as.number, text);
  /* Целость проверяется ДО отрезка и на ней же кончается: у свидетеля тот же
     порядок, и второй отказ на одном значении был бы вторым текстом про одну
     беду. */
  if (type->integral && floor(value.as.number) != value.as.number) {
    return fl_fail(ctx, error, FL_CODE_TYPE, "%s: %s не целое, а тип %s — целый", label, text, type->name);
  }
  if (type->bounded && (value.as.number < type->low || value.as.number > type->high)) {
    return fl_fail(ctx, error, FL_CODE_TYPE, "%s: %s вне %s", label, text, type->name);
  }
  return FL_OK;
}

/* Поле по имени среди полей записи или варианта; NULL — поля нет. */
static const fl_field *fl_find_field(const fl_field *fields, size_t count, const char *name) {
  size_t index = 0;
  for (index = 0; index < count; index += 1) {
    if (strcmp(fields[index].name, name) == 0) {
      return &fields[index];
    }
  }
  return NULL;
}

/*
 * Объявленные поля против заданных. `owner` — имя записи либо имя варианта:
 * сообщения о пропущенном поле у них разной формы, и обе выписаны здесь
 * дословно, потому что сверяются они со свидетелем равенством строк.
 */
static fl_status fl_check_fields(fl_ctx *ctx, const fl_entry_table *table, size_t from, size_t count,
                                 const fl_field *given, size_t given_count, const char *label,
                                 const char *owner, bool of_variant, fl_error *error) {
  size_t index = 0;
  for (index = 0; index < count; index += 1) {
    const fl_type_field *declared = &table->fields[from + index];
    const fl_field *found = fl_find_field(given, given_count, declared->name);
    const char *inner = NULL;
    if (found == NULL) {
      /* Необязательное поле можно не задавать: отсутствие — это «ничто». */
      if (table->types[declared->type].optional) {
        continue;
      }
      if (of_variant) {
        return fl_fail(ctx, error, FL_CODE_TYPE, "%s: вариант «%s» требует поле «%s»", label, owner,
                       declared->name);
      }
      return fl_fail(ctx, error, FL_CODE_TYPE, "%s: не задано поле «%s» записи «%s»", label, declared->name,
                     owner);
    }
    inner = fl_label(ctx, "%s.%s", label, declared->name);
    if (inner == NULL) {
      return fl_no_memory(error);
    }
    FL_TRY(fl_check_typed(ctx, table, declared->type, found->value, inner, error));
  }
  return FL_OK;
}

static fl_status fl_check_typed(fl_ctx *ctx, const fl_entry_table *table, size_t index, fl_value value,
                                const char *label, fl_error *error) {
  const fl_type *type = NULL;
  size_t item = 0;
  if (index >= table->type_count) {
    return FL_OK;
  }
  type = &table->types[index];
  /* Необязательный аргумент можно не задавать: отсутствие — это «ничто», а не
     пропуск. Так же считает и ядро FTS. */
  if (type->optional && value.tag == FL_NOTHING) {
    return FL_OK;
  }
  switch (type->kind) {
    case FL_TYPE_NUMBER:
      return fl_check_number_type(ctx, type, value, label, error);
    case FL_TYPE_STRING:
      if (value.tag != FL_STRING) {
        return fl_fail(ctx, error, FL_CODE_TYPE, "%s не соответствует типу %s", label, type->name);
      }
      return FL_OK;
    case FL_TYPE_FLAG:
      if (value.tag != FL_FLAG) {
        return fl_fail(ctx, error, FL_CODE_TYPE, "%s не соответствует типу %s", label, type->name);
      }
      return FL_OK;
    case FL_TYPE_NULL:
      if (value.tag != FL_NOTHING) {
        return fl_fail(ctx, error, FL_CODE_TYPE, "%s не соответствует типу %s", label, type->name);
      }
      return FL_OK;
    case FL_TYPE_LIST:
      if (value.tag != FL_LIST) {
        return fl_fail(ctx, error, FL_CODE_TYPE, "%s не соответствует типу %s", label, type->name);
      }
      for (item = 0; item < value.as.list.count; item += 1) {
        const char *inner = fl_label(ctx, "%s[%lu]", label, (unsigned long)item);
        if (inner == NULL) {
          return fl_no_memory(error);
        }
        FL_TRY(fl_check_typed(ctx, table, type->of, value.as.list.items[item], inner, error));
      }
      return FL_OK;
    case FL_TYPE_RECORD: {
      if (value.tag != FL_RECORD) {
        return fl_fail(ctx, error, FL_CODE_TYPE, "%s не соответствует типу %s", label, type->name);
      }
      FL_TRY(fl_check_fields(ctx, table, type->field_from, type->field_count, value.as.record->fields,
                             value.as.record->count, label, type->owner, false, error));
      /* Лишнее поле — тоже несоответствие типу: запись flang тотальна, и поля
         сверх объявленных в ней взяться неоткуда. */
      for (item = 0; item < value.as.record->count; item += 1) {
        size_t at = 0;
        bool declared = false;
        for (at = 0; at < type->field_count; at += 1) {
          if (strcmp(table->fields[type->field_from + at].name, value.as.record->fields[item].name) == 0) {
            declared = true;
            break;
          }
        }
        if (!declared) {
          return fl_fail(ctx, error, FL_CODE_TYPE, "%s: запись «%s» не имеет поля «%s»", label, type->owner,
                         value.as.record->fields[item].name);
        }
      }
      return FL_OK;
    }
    case FL_TYPE_SUM: {
      const fl_type_variant *variant = NULL;
      if (value.tag != FL_VARIANT && value.tag != FL_RECORD) {
        return fl_fail(ctx, error, FL_CODE_TYPE, "%s не соответствует типу %s", label, type->name);
      }
      if (value.tag == FL_VARIANT) {
        for (item = 0; item < type->variant_count; item += 1) {
          if (strcmp(table->variants[type->variant_from + item].name, value.as.variant->name) == 0) {
            variant = &table->variants[type->variant_from + item];
            break;
          }
        }
      }
      if (variant == NULL) {
        return fl_fail(ctx, error, FL_CODE_TYPE, "%s: ожидался вариант типа «%s»", label, type->owner);
      }
      return fl_check_fields(ctx, table, variant->field_from, variant->field_count, value.as.variant->fields,
                             value.as.variant->count, label, variant->name, true, error);
    }
    case FL_TYPE_UNKNOWN:
    default:
      return FL_OK;
  }
}

fl_status fl_check_entry(fl_ctx *ctx, const fl_entry_table *table, const char *name, const fl_value *args,
                         size_t count, fl_error *error) {
  size_t index = 0;
  size_t declared = 0;
  size_t at = 0;
  if (ctx == NULL || table == NULL || name == NULL) {
    return FL_OK;
  }
  for (index = 0; index < table->param_count; index += 1) {
    if (strcmp(table->params[index].function, name) == 0) {
      declared += 1;
    }
  }
  /* Сверять нечем: имени в таблице нет (о нём скажет диспетчер), параметров у
     функции нет вовсе, либо число значений не сошлось с числом параметров —
     это отдельный отказ, и он тоже принадлежит диспетчеру, чтобы текст про
     арность был в программе один. */
  if (declared == 0 || declared != count) {
    return FL_OK;
  }
  for (index = 0; index < table->param_count; index += 1) {
    const fl_entry_param *param = &table->params[index];
    const char *label = NULL;
    if (strcmp(param->function, name) != 0) {
      continue;
    }
    label = fl_label(ctx, "вызов функции «%s»: аргумент «%s»", name, param->name);
    if (label == NULL) {
      return fl_no_memory(error);
    }
    FL_TRY(fl_check_typed(ctx, table, param->type, args[at], label, error));
    at += 1;
  }
  return FL_OK;
}

fl_status fl_tick(fl_ctx *ctx, const char *function, fl_error *error) {
  if (ctx == NULL) {
    return FL_INVALID_ARGUMENT;
  }
  /* Предел 0 — счёт отключён; иначе первый же виток при max_steps == 0 объявил
     бы исчерпанной любую программу. */
  if (ctx->max_steps == 0) {
    return FL_OK;
  }
  ctx->steps += 1;
  if (ctx->steps > ctx->max_steps) {
    /* Текст дословно как у интерпретатора: предел, затем глубина вызовов на
       момент исчерпания (не число шагов). */
    return fl_fail(ctx, error, FL_CODE_RECURSION_LIMIT,
                   "функция «%s» исчерпала лимит шагов (%lu) на глубине вызовов %lu", function,
                   (unsigned long)ctx->max_steps, (unsigned long)ctx->depth);
  }
  return FL_OK;
}

/*
 * Сторож стека: сколько его уже съедено и не пора ли отказать.
 *
 * Мерить нужно именно байты, а не кадры. Счётчик глубины считает кадры, а
 * несёт их стек, и толщина кадра — свойство ПРОГРАММЫ: 352 байта у функции с
 * одним параметром и 5 526 у функции с сорока связываниями. Один и тот же
 * предел 10 000 в первом случае вдвое ниже стека, а во втором выше него в
 * шесть с половиной раз — и вторая программа умирала по SIGSEGV.
 *
 * Запас под последним входом считается по САМОМУ ТОЛСТОМУ кадру, который эта
 * программа уже показала, а не по числу из заголовка: между двумя проверками
 * успевает лечь ровно такой кадр (а с вложенным телом «отобрать» или свёртки —
 * несколько), и запас в четыре его толщины покрывает это с обеих сторон.
 * Программе с тонким кадром это не стоит ничего: её запас тоже тонкий.
 *
 * `stack_seen` — верхняя отметка, и разматывание её не опускает. Значит после
 * глубокого спуска толщина следующего кадра может быть посчитана крупнее, чем
 * есть. Это ошибка в БЕЗОПАСНУЮ сторону — запас окажется больше нужного, а не
 * меньше, — и опускать отметку на возврате незачем: `fl_leave` стоит на каждом
 * кадре, и работа в нём стоит дороже, чем эта неточность.
 */
static bool fl_stack_spent(fl_ctx *ctx) {
  char here = 0;
  const char *point = &here;
  size_t used = 0;
  size_t reserve = 0;
  if (ctx->stack_room == 0 || ctx->stack_base == NULL) {
    return false; /* сторож выключен: так решил тот, кто знает, что делает */
  }
  /* Стек растёт вниз почти везде, но «почти» здесь не годится: разность берётся
     по модулю, и направление роста перестаёт быть допущением. */
  used = point < ctx->stack_base ? (size_t)(ctx->stack_base - point)
                                 : (size_t)(point - ctx->stack_base);
  if (used > ctx->stack_seen) {
    const size_t step = used - ctx->stack_seen;
    if (step > ctx->stack_step) {
      ctx->stack_step = step;
    }
    ctx->stack_seen = used;
  }
  /*
   * Запас — МЕНЬШЕЕ из объявленного потолка и четверти всего стека, и второе
   * слагаемое приехало от wasm. FL_STACK_MARGIN (128 КиБ) считался «сотнями
   * кадров рантайма», и на стеке в 8 МиБ он ими и остаётся. Но теневой стек wasm
   * по умолчанию 64 КиБ — ВДВОЕ МЕНЬШЕ запаса, — и правило «отказать, если
   * осталось меньше запаса» сработало бы на первом же входе в первую функцию:
   * программа, считающая на глубине два, получала бы FLANG_RECURSION_LIMIT.
   * Это была бы вторая ложь вместо первой, а не починка.
   *
   * Четверть — а не половина и не восьмая — потому, что запас обязан оставаться
   * запасом: три четверти стека остаются работе. На 64 КиБ это 16 КиБ, то есть
   * 68 кадров рантайма (240 байт худший) или 39 кадров прогонщика (416) — с тем
   * же порядком кратности, ради которого 128 КиБ и брались.
   * На 8 МиБ четверть равна 2 МиБ, потолок ниже, и ни одно число не меняется.
   */
  reserve = FL_STACK_MARGIN;
  if (reserve > ctx->stack_room / 4u) {
    reserve = ctx->stack_room / 4u;
  }
  if (ctx->stack_step > (FL_STACK_MAX - reserve) / 4u) {
    return true; /* кадр толще всего мыслимого стека — дальше идти некуда */
  }
  reserve += ctx->stack_step * 4u;
  return used + reserve > ctx->stack_room;
}

fl_status fl_enter(fl_ctx *ctx, const char *function, fl_error *error) {
  if (ctx == NULL) {
    return FL_INVALID_ARGUMENT;
  }
  /* Вход в функцию — тоже виток: иначе нерекурсивная по хвосту, но бесконечно
     ветвящаяся программа считала бы глубину и не считала шаги. */
  FL_TRY(fl_tick(ctx, function, error));
  if (fl_stack_spent(ctx)) {
    /*
     * Стек хозяина кончился раньше объявленного предела. Отказ всё равно
     * ОБЪЯВЛЕННЫЙ — код из закрытого набора, — а текст называет хозяина, а не
     * предел, до которого не добрались: врать про предел нельзя, молчать тоже.
     * Тот же текст и по той же причине печатает бэкенд JavaScript ($hostDepth),
     * где поднять стек изнутри модуля нечем вовсе.
     */
    return fl_fail(ctx, error, FL_CODE_RECURSION_LIMIT,
                   "функция «%s» исчерпала стек хозяина на глубине %lu, не дойдя до предела "
                   "глубины вызовов (%lu)",
                   function, (unsigned long)ctx->depth, (unsigned long)ctx->max_depth);
  }
  ctx->depth += 1;
  if (ctx->depth > ctx->max_depth) {
    /* Текст дословно как у интерпретатора: сперва предел, потом достигнутая
       глубина (она на единицу больше предела). */
    return fl_fail(ctx, error, FL_CODE_RECURSION_LIMIT,
                   "функция «%s» превысила предел глубины вызовов (%lu) на глубине %lu", function,
                   (unsigned long)ctx->max_depth, (unsigned long)ctx->depth);
  }
  return FL_OK;
}

void fl_leave(fl_ctx *ctx) {
  if (ctx != NULL && ctx->depth > 0) {
    ctx->depth -= 1;
  }
}

/* ═════════════════════════ область на вызов ═════════════════════════ */

/*
 * Сколько байт область обязана нарастить, чтобы откат стоило делать.
 *
 * Порог не взят с потолка — он равен куску арены. Ниже куска область не стоила
 * арене НИ ОДНОЙ покупки у malloc: её мусор лежит в памяти, которая всё равно
 * уже куплена, и откат вернул бы то, что и так вернётся ближайшему `reset`.
 * Выше куска область и есть та причина, по которой арена растёт, — и вот тогда
 * за перекладку результата есть чем платить.
 *
 * Замерено, а не выбрано: порог 8 КиБ на самом компиляторе flang, собранном в
 * C, даёт 787,2 МиБ вместо 795,8 — то есть 1,1 % памяти за 23 % времени
 * (3,8–4,0 с против 3,1–3,3). Кусок арены — та точка, где ещё платят за дело.
 *
 * Величина настраиваемая (-DFL_REGION_MIN=…), но умолчание привязано к
 * устройству арены, а не к вкусу: поменяется кусок — поменяется и порог.
 */
#ifndef FL_REGION_MIN
#define FL_REGION_MIN FL_CHUNK_MIN
#endif

/*
 * Во сколько раз отданное обязано превысить переложенное: результат не больше
 * ЧЕТВЕРТИ наросшего, то есть область отдаёт втрое больше, чем копирует.
 *
 * Четвёрка тоже замерена. Перекладка стоит `live` байт буфера, и буфер этот
 * входит в пик кучи наравне с ареной — а куски арены откат системе НЕ
 * возвращает. При «не больше половины» буфер сравним с отданным, и на двух
 * настоящих программах это чистый убыток:
 *
 *   накопление списка через «добавить», миллион витков:
 *       пик 96,1 → 126,6 МиБ, время 0,10 → 0,14 с;
 *   сам компилятор flang, собранный в C, на flang/self/emit-c.flang:
 *       пик 799,0 → 844,9 МиБ, время 3,1 → 3,5 с.
 *
 * При четверти оба возвращаются к прежним числам до цифры, а сортировка
 * слиянием четырёх тысяч чисел теряет всего 2,2 → 3,5 МиБ при 1 655 МиБ без
 * области. Ужесточать дальше незачем: восьмая уже отказывается там, где откат
 * выгоден (проверка «четверть держит с обеих сторон» краснеет от сдвига
 * константы в любую сторону).
 */
#ifndef FL_REGION_GAIN
#define FL_REGION_GAIN (size_t)4
#endif

/*
 * Предел глубины обхода при перекладке. Глубже область просто ОТКАЗЫВАЕТСЯ
 * работать — она не имеет права ни падать по стеку, ни отказывать вычислению.
 * Обход рекурсивный, кадр его тонок, тысяча кадров — сотня килобайт стека.
 */
#ifndef FL_REGION_DEPTH
#define FL_REGION_DEPTH (size_t)1024
#endif

/*
 * ── Обмер: сколько займёт копия ────────────────────────────────────────────
 *
 * Считает ровно то, что выделит перекладка, — теми же размерами и тем же
 * округлением. Считает С БЮДЖЕТОМ и бросает счёт, как только бюджет перебран.
 *
 * Бюджет — не мелочь ради скорости, а то, чем ограничены три из четырёх
 * известных изъянов приёма «копия наружу»:
 *
 *   • копия разворачивает разделяемый подграф в дерево (один и тот же подсписок,
 *     положенный в результат десять раз, станет десятью копиями), и в худшем
 *     случае это ЭКСПОНЕНТА. С бюджетом обход такого значения обрывается на
 *     первых же байтах сверх бюджета — и область отказывается от отката, вместо
 *     того чтобы взорваться;
 *   • копия стоит O(размера результата), и у функции, которая возвращает много,
 *     а мусорит мало, это чистый убыток. Бюджет запрещает такой случай по
 *     построению;
 *   • накопление растущего результата на каждом витке даёт квадрат. Как только
 *     результат перерастает четверть мусора, копии прекращаются сами.
 *
 * Отсюда и величина бюджета: наросшее, делённое на FL_REGION_GAIN. Тогда работа
 * области — и обмер, и обе перекладки — ограничена долей той работы, которую
 * область уже проделала на выделении. Это и есть обещание: цена приёма не
 * может превысить постоянного множителя от объёма, которым он распоряжается.
 */
static bool fl_region_take(size_t *total, size_t budget, size_t need) {
  size_t rounded = 0;
  /* Сперва сырой размер, потом округление: так округлять нечему переполниться —
     бюджет заведомо меньше половины адресного пространства. */
  if (need > budget) {
    return false;
  }
  rounded = fl_round_up(need);
  if (rounded > budget || *total > budget - rounded) {
    return false;
  }
  *total += rounded;
  return true;
}

static bool fl_region_fields_size(const fl_field *fields, size_t count, size_t budget, size_t depth,
                                  size_t *total);

static bool fl_region_size(fl_value value, size_t budget, size_t depth, size_t *total) {
  if (depth > FL_REGION_DEPTH) {
    return false;
  }
  switch (value.tag) {
    case FL_NOTHING:
    case FL_NUMBER:
    case FL_FLAG:
      return true;
    case FL_STRING:
      /* Ноль на конце копия ставит всегда, хотя исходник мог быть срезом. */
      if (value.as.string.bytes == (size_t)-1) {
        return false;
      }
      return fl_region_take(total, budget, value.as.string.bytes + 1);
    case FL_LIST: {
      size_t index = 0;
      if (value.as.list.count == 0) {
        return true;
      }
      if (value.as.list.count > ((size_t)-1) / sizeof(fl_value)) {
        return false;
      }
      if (!fl_region_take(total, budget, value.as.list.count * sizeof(fl_value))) {
        return false;
      }
      for (index = 0; index < value.as.list.count; index += 1) {
        if (!fl_region_size(value.as.list.items[index], budget, depth + 1, total)) {
          return false;
        }
      }
      return true;
    }
    case FL_RECORD:
      if (value.as.record == NULL) {
        return false;
      }
      if (!fl_region_take(total, budget, sizeof(fl_record))) {
        return false;
      }
      return fl_region_fields_size(value.as.record->fields, value.as.record->count, budget, depth, total);
    case FL_VARIANT:
      if (value.as.variant == NULL) {
        return false;
      }
      if (!fl_region_take(total, budget, sizeof(fl_variant))) {
        return false;
      }
      return fl_region_fields_size(value.as.variant->fields, value.as.variant->count, budget, depth, total);
    default:
      return false;
  }
}

static bool fl_region_fields_size(const fl_field *fields, size_t count, size_t budget, size_t depth,
                                  size_t *total) {
  size_t index = 0;
  if (count == 0) {
    return true;
  }
  if (fields == NULL || count > ((size_t)-1) / sizeof(fl_field)) {
    return false;
  }
  if (!fl_region_take(total, budget, count * sizeof(fl_field))) {
    return false;
  }
  for (index = 0; index < count; index += 1) {
    if (!fl_region_size(fields[index].value, budget, depth + 1, total)) {
      return false;
    }
  }
  return true;
}

/*
 * ── Перекладка: копия значения в плоский буфер ─────────────────────────────
 *
 * Выдача — бамп указателя внутри буфера, и размер буфера посчитан обмером
 * заранее ровно по тем же правилам. Значит переполниться буфер не может; если
 * всё-таки переполнился, обмер разошёлся с копией, и область отказывается от
 * отката вместо того, чтобы писать мимо.
 *
 * Имена полей и имя варианта НЕ копируются, и это не экономия, а свойство
 * дерева: имя приходит из модели (`.rodata`) либо из разобранного запроса,
 * который построен ДО вызова, то есть ниже любой отметки. Ни одно имя не
 * рождается во время расчёта — единственный, кто их выделяет, это разбор
 * запроса в прогонщике. Тот же довод записан в `fl_conc_clone`.
 */
typedef struct fl_pack {
  char *base;
  size_t size;
  size_t used;
} fl_pack;

static void *fl_pack_alloc(fl_pack *pack, size_t size) {
  const size_t wanted = fl_round_up(size == 0 ? 1 : size);
  char *block = NULL;
  if (wanted > pack->size - pack->used) {
    return NULL;
  }
  block = pack->base + pack->used;
  pack->used += wanted;
  return block;
}

static bool fl_pack_fields(fl_pack *pack, const fl_field *fields, size_t count, size_t depth,
                           const fl_field **out);

static bool fl_pack_value(fl_pack *pack, fl_value value, size_t depth, fl_value *out) {
  if (depth > FL_REGION_DEPTH) {
    return false;
  }
  switch (value.tag) {
    case FL_NOTHING:
    case FL_NUMBER:
    case FL_FLAG:
      *out = value;
      return true;
    case FL_STRING: {
      char *text = (char *)fl_pack_alloc(pack, value.as.string.bytes + 1);
      if (text == NULL) {
        return false;
      }
      if (value.as.string.bytes > 0) {
        memcpy(text, value.as.string.utf8, value.as.string.bytes);
      }
      text[value.as.string.bytes] = '\0';
      *out = fl_text_borrow(text, value.as.string.bytes, value.as.string.points);
      return true;
    }
    case FL_LIST: {
      fl_value *items = NULL;
      size_t index = 0;
      if (value.as.list.count == 0) {
        *out = fl_list(NULL, 0);
        return true;
      }
      items = (fl_value *)fl_pack_alloc(pack, value.as.list.count * sizeof(fl_value));
      if (items == NULL) {
        return false;
      }
      for (index = 0; index < value.as.list.count; index += 1) {
        if (!fl_pack_value(pack, value.as.list.items[index], depth + 1, &items[index])) {
          return false;
        }
      }
      /* Хвостовой запас копии не передаётся: `fl_grow` считает ячейки от базы
         своего массива, а копия — другое выделение. Наблюдаемо это не меняет
         ничего (flang_runtime.h: «Поле не наблюдаемо»). */
      *out = fl_list(items, value.as.list.count);
      return true;
    }
    case FL_RECORD: {
      fl_record *record = (fl_record *)fl_pack_alloc(pack, sizeof(fl_record));
      if (record == NULL) {
        return false;
      }
      record->count = value.as.record->count;
      record->fields = NULL;
      if (!fl_pack_fields(pack, value.as.record->fields, value.as.record->count, depth, &record->fields)) {
        return false;
      }
      out->tag = FL_RECORD;
      out->as.record = record;
      return true;
    }
    case FL_VARIANT: {
      fl_variant *variant = (fl_variant *)fl_pack_alloc(pack, sizeof(fl_variant));
      if (variant == NULL) {
        return false;
      }
      variant->name = value.as.variant->name;
      variant->count = value.as.variant->count;
      variant->fields = NULL;
      if (!fl_pack_fields(pack, value.as.variant->fields, value.as.variant->count, depth, &variant->fields)) {
        return false;
      }
      out->tag = FL_VARIANT;
      out->as.variant = variant;
      return true;
    }
    default:
      return false;
  }
}

static bool fl_pack_fields(fl_pack *pack, const fl_field *fields, size_t count, size_t depth,
                           const fl_field **out) {
  fl_field *copy = NULL;
  size_t index = 0;
  if (count == 0) {
    *out = NULL;
    return true;
  }
  copy = (fl_field *)fl_pack_alloc(pack, count * sizeof(fl_field));
  if (copy == NULL) {
    return false;
  }
  for (index = 0; index < count; index += 1) {
    copy[index].name = fields[index].name;
    if (!fl_pack_value(pack, fields[index].value, depth + 1, &copy[index].value)) {
      return false;
    }
  }
  *out = copy;
  return true;
}

/*
 * Откат к отметке. Куски не отдаются системе — они помечаются пустыми, ровно
 * как в `fl_arena_reset`, и ближайшая выдача берёт их снова. Оттого арена,
 * которую откатывают, остаётся горячей в кэше, а растущая — покупает новое и
 * гуляет по всей памяти; это и есть причина, по которой область не только
 * бережёт память, но и УСКОРЯЕТ расчёт.
 */
static void fl_arena_rollback(fl_arena *arena, fl_mark mark) {
  fl_chunk *chunk = NULL;
  if (mark.chunk == NULL) {
    /* На отметке арена была пуста: пусто всё, что после неё. */
    for (chunk = arena->chunks; chunk != NULL; chunk = chunk->next) {
      chunk->used = 0;
    }
    arena->current = arena->chunks;
  } else {
    mark.chunk->used = mark.used;
    for (chunk = mark.chunk->next; chunk != NULL; chunk = chunk->next) {
      chunk->used = 0;
    }
    arena->current = mark.chunk;
  }
  arena->handed = mark.handed;
}

/** Буфер под перекладку: живёт между вызовами, отдаётся в `fl_arena_release`. */
static bool fl_region_staging(fl_arena *arena, size_t need) {
  char *buffer = NULL;
  if (arena->staging_size >= need) {
    return true;
  }
  buffer = (char *)malloc(need);
  if (buffer == NULL) {
    return false;
  }
  free(arena->staging);
  arena->staging = buffer;
  arena->staging_size = need;
  return true;
}

fl_mark fl_region_open(fl_ctx *ctx) {
  fl_mark mark;
  fl_arena *arena = ctx == NULL ? NULL : ctx->arena;
  mark.chunk = NULL;
  mark.used = 0;
  mark.handed = 0;
  mark.guard_chunk = NULL;
  mark.guard_used = 0;
  if (arena == NULL) {
    return mark;
  }
  mark.chunk = arena->current;
  mark.used = arena->current == NULL ? 0 : arena->current->used;
  mark.handed = arena->handed;
  mark.guard_chunk = arena->guard_chunk;
  mark.guard_used = arena->guard_used;
  arena->guard_chunk = mark.chunk;
  arena->guard_used = mark.used;
  return mark;
}

/*
 * ── Закрытие области ───────────────────────────────────────────────────────
 *
 * Порядок такой и другим быть не может:
 *
 *   1. вернуть границу объемлющей области — ВСЕГДА, каким бы ни был исход;
 *   2. на отказе не трогать ничего: текст диагностики лежит в арене выше
 *      отметки, и откат стёр бы сообщение об ошибке;
 *   3. обмерить результат с бюджетом в четверть наросшего;
 *   4. переложить результат в буфер вне арены;
 *   5. откатить арену;
 *   6. переложить результат из буфера обратно, одним блоком.
 *
 * Шаги 3–6 могут не состояться — и тогда область просто НЕ ДЕЛАЕТ НИЧЕГО.
 * Это главное её свойство: она вправе отказаться в любой момент до шага 5, и
 * отказ не виден снаружи ничем, кроме памяти. Отказывается она, когда:
 *
 *   • область наросла меньше куска арены (платить не за что);
 *   • результат больше четверти наросшего (см. FL_REGION_GAIN);
 *   • результат не влез в бюджет — разделяемый подграф, большой ответ,
 *     накопление (см. обмер выше);
 *   • значение глубже FL_REGION_DEPTH;
 *   • не дали буфера;
 *   • обмер разошёлся с перекладкой (такого быть не должно, но проверка
 *     дешевле доверия).
 *
 * Единственное место, где область всё-таки может отказать вычислению, — шаг 6:
 * после отката память под копию уже нужна, и не дать её может только настоящее
 * исчерпание. Тогда честный FLANG_MEMORY, а не тишина.
 */
fl_status fl_region_close(fl_ctx *ctx, fl_mark mark, fl_status status, fl_value *result, fl_error *error) {
  fl_arena *arena = ctx == NULL ? NULL : ctx->arena;
  size_t grown = 0;
  size_t live = 0;
  fl_pack pack;
  fl_value staged = fl_nothing();
  fl_value moved = fl_nothing();
  char *block = NULL;

  if (arena == NULL) {
    return status;
  }
  arena->guard_chunk = mark.guard_chunk;
  arena->guard_used = mark.guard_used;
  if (status != FL_OK || result == NULL) {
    return status;
  }

  grown = arena->handed - mark.handed;
  if (grown < (size_t)FL_REGION_MIN) {
    return FL_OK;
  }
  if (!fl_region_size(*result, grown / FL_REGION_GAIN, 0, &live)) {
    return FL_OK;
  }
  if (live == 0) {
    /* Результат — скаляр либо пустой список: перекладывать нечего. */
    fl_arena_rollback(arena, mark);
    return FL_OK;
  }
  if (!fl_region_staging(arena, live)) {
    return FL_OK;
  }
  pack.base = arena->staging;
  pack.size = live;
  pack.used = 0;
  if (!fl_pack_value(&pack, *result, 0, &staged)) {
    return FL_OK;
  }

  fl_arena_rollback(arena, mark);

  block = (char *)fl_arena_alloc(arena, live);
  if (block == NULL) {
    return fl_no_memory(error);
  }
  pack.base = block;
  pack.size = live;
  pack.used = 0;
  if (!fl_pack_value(&pack, staged, 0, &moved)) {
    return fl_no_memory(error);
  }
  *result = moved;
  return FL_OK;
}

/*
 * ── Область на накопитель свёртки ──────────────────────────────────────────
 *
 * Область на ВЫЗОВ не помогает свёртке: свёртка печатается обычным циклом C, и
 * функция, внутри которой она стоит, вправе не быть рекурсивной — тогда области
 * у неё нет вовсе. А накопителей за цикл получается столько же, сколько витков,
 * и каждый из них живёт до конца объемлющего вызова. «Сортировка вставками» из
 * `flang/examples/rosetta/quicksort.flang` — ровно этот случай: на четырёх
 * тысячах элементов живых значений четыре тысячи, а мёртвых почти восемь
 * миллионов, то есть 99,95 % пика.
 *
 * Довод законности здесь ПРЯМЕЕ, чем у области на вызов, и виден прямо в
 * напечатанном C:
 *
 *   fl_value akk = <начальное>;              ← ниже отметки
 *   const fl_mark m = fl_region_open(ctx);
 *   for (...) {
 *     const fl_value el = list.as.list.items[i];   ← ниже отметки: элемент
 *     ... akk = <тело>; ...                          входного списка
 *     FL_TRY(fl_region_recycle(ctx, m, &akk, error));
 *   }
 *
 * После присваивания прежний накопитель не читает НИКТО: имя `akk` — единственное,
 * что на него указывало, и оно уже переприсвоено; значения flang неизменяемы,
 * замыканий нет, ссылок наружу нет. А входной список и его элементы построил
 * вызывающий, и лежат они НИЖЕ отметки, то есть откат их не трогает. Поэтому
 * «переиспользовать на месте разрешено там, где доказано, что старое значение
 * больше не читается» выполняется здесь не догадкой, а видом цикла.
 *
 * Почему нужна отдельная функция, а не голый `fl_region_close`: тот ВСЕГДА
 * возвращает границу объемлющей области (шаг 1 над ним), и со второго витка
 * цикл шёл бы без сторожа. Тогда `fl_arena_extend` продлил бы на месте блок,
 * лежащий ниже отметки, — а его вот-вот откатят.
 *
 * Отметка после отката остаётся действительной: откат восстанавливает ровно
 * `mark.chunk`/`mark.used`. Если область отказалась (см. список над
 * `fl_region_close`), отметка тем более действительна — арена не двигалась
 * ниже неё. Поэтому взводить сторож можно в обоих исходах одинаково.
 *
 * Границу объемлющей области возвращает НЕ эта функция, а `fl_region_close`,
 * который печатается один раз после цикла. На раннем возврате по ошибке из тела
 * цикла граница остаётся взведённой на отметке свёртки — это строго
 * консервативно (`fl_arena_extend` откажет там, где мог бы согласиться) и
 * снимается ближайшим `fl_region_close` объемлющего вызова либо
 * `fl_arena_reset`.
 */
/*
 * Бюджет витка строже, чем бюджет вызова, и это ЗАМЕРЕНО. Свёрткой в дереве
 * записаны две разные вещи, и им нужны разные пороги:
 *
 *   • накопление — `свёртка ... как акк и эл → добавить эл к акк`. Здесь
 *     «добавить» пишет в хвостовой запас на месте (см. `fl_b_dobavit`), мусора
 *     почти нет, и наросшее лишь вдвое больше живого. Откат тут — чистый
 *     убыток: он копирует накопитель И теряет запас, так что следующее
 *     «добавить» идёт на копию;
 *   • перестройка — `свёртка ... как акк и эл → «Вставить по порядку» от эл и
 *     акк`. Здесь каждый виток строит новый накопитель целиком, прежний
 *     мгновенно мёртв, и наросшее к витку k — это все прежние накопители, то
 *     есть примерно k²/2 при живых k.
 *
 * При бюджете вызова (четверть наросшего) первый случай проходит впритык и
 * платит: «Сортировка вставками» на 4 000 элементах стала 262 с вместо 151.
 * При бюджете витка (одна шестнадцатая) накопление отказывается по построению,
 * а перестройка проходит с k ≈ 32 — и обе меряются одним числом, а не
 * догадкой о том, что написал автор.
 */
#ifndef FL_REGION_LOOP_GAIN
#define FL_REGION_LOOP_GAIN (size_t)16
#endif

fl_status fl_region_recycle(fl_ctx *ctx, fl_mark mark, fl_value *result, fl_error *error) {
  fl_arena *arena = ctx == NULL ? NULL : ctx->arena;
  size_t grown = 0;
  size_t live = 0;
  fl_status status = FL_OK;

  if (arena == NULL || result == NULL) {
    return FL_OK;
  }
  grown = arena->handed - mark.handed;
  if (grown < (size_t)FL_REGION_MIN) {
    return FL_OK;
  }
  if (!fl_region_size(*result, grown / FL_REGION_LOOP_GAIN, 0, &live)) {
    /* Накопление: живого столько же, сколько наросло. Откат не окупится. */
    return FL_OK;
  }
  status = fl_region_close(ctx, mark, FL_OK, result, error);
  if (status != FL_OK) {
    return status;
  }
  arena->guard_chunk = mark.chunk;
  arena->guard_used = mark.used;
  return FL_OK;
}

/* ═════════════════════════════ UTF-8 ═════════════════════════════ */

/*
 * Строки flang меряются кодовыми точками (SPEC, раздел 5), поэтому весь UTF-8
 * здесь — свой, без единой сторонней библиотеки. Ведущий байт кодовой точки
 * узнаётся тем же способом, что и везде: у продолжения старшие биты 10.
 *
 * ГДЕ НАЧИНАЕТСЯ ЗНАК — один ответ на все формы, и до 22 августа 2026 его не
 * было. Первый октет строки начинает знак ВСЕГДА, даже если он октет
 * продолжения: иначе строка из одних продолжений оказывалась «длиной 0» и
 * «пустой», оставаясь при этом непустой по содержимому. Прогон на этой ветке:
 * у строки из октетов BC D0 `длина` давала 1, а `разложить … на символы` — два
 * куска, и второй кусок писался ЗА КОНЕЦ выделенного массива, потому что
 * массив мерился длиной. Одна мера — значит и счёт, и нарезка, и поиск ходят по
 * одному и тому же множеству начал.
 */
static bool fl_utf8_starts(const char *utf8, size_t index) {
  return index == 0 || ((unsigned char)utf8[index] & 0xC0u) != 0x80u;
}

/* Правило начала знака выписано ОДИН раз и зовётся отовсюду, включая эти два
   цикла. Развернуть его здесь руками (вынести нулевой октет из цикла) — значит
   завести вторую копию правила ради 1,8 % времени: замер `flang check` на
   90-килобайтном flang/stdlib/strings.flang, лучшее из семи, — 2,29 с с общим
   правилом против 2,25 с с развёрнутым при 2,14 с до правки. Вторая копия
   правила — это ровно тот способ, каким меры разошлись в прошлый раз. */
static size_t fl_utf8_points(const char *utf8, size_t bytes) {
  size_t points = 0;
  size_t index = 0;
  for (index = 0; index < bytes; index += 1) {
    if (fl_utf8_starts(utf8, index)) {
      points += 1;
    }
  }
  return points;
}

/*
 * ГДЕ СОДЕРЖИМОЕ ПЕРЕСТАЁТ БЫТЬ ТЕКСТОМ. Счёт точек выше не проверяет НИЧЕГО:
 * он делит байты на ведущие и продолжающие и на любом мусоре отвечает числом.
 * Этого хватает строкам самого языка — они собраны из литералов и из чтения
 * текста, — но не хватает хозяину, которому дали двоичный файл: 13 886 504
 * октета он назовёт 11 776 136 знаками и не скажет ни слова. Здесь спрашивается
 * прямо, и живут обе стороны вопроса в ОДНОМ месте, чтобы два хозяина на C
 * (`flang io` и планировщик конкурентности) не разошлись ответами.
 *
 * Возвращает номер (от 1) ПЕРВОГО октета, который не складывается в правильный
 * UTF-8, и 0 — если складывается весь.
 *
 * НУЛЕВОЙ ОКТЕТ ЗДЕСЬ ЗАКОНЕН, и это решение по улике, а не недосмотр. U+0000 —
 * обычная кодовая точка, и в дереве есть исходник, который её содержит:
 * `flang/self/link.flang` разделяет нулём имена в ключе (октет 91 689 из
 * 138 872). Запрет ловил бы ЭТОТ файл и не ловил бы ничего сверх того, что
 * ловится неправильным UTF-8: в заголовке ELF первый неправильный октет — 26-й,
 * а первый нулевой — 8-й, отвергаются оба файла одинаково. Опасен ноль был
 * ровно там, где длину брали `strlen`ом; длину теперь берут у значения.
 */
size_t fl_utf8_not_text_at(const char *utf8, size_t bytes) {
  size_t at = 0;
  while (at < bytes) {
    const unsigned char lead = (unsigned char)utf8[at];
    unsigned long point = 0;
    size_t more = 0;
    size_t step = 0;
    if (lead < 0x80u) {
      at += 1;
      continue;
    }
    if ((lead & 0xE0u) == 0xC0u) {
      more = 1;
      point = (unsigned long)(lead & 0x1Fu);
    } else if ((lead & 0xF0u) == 0xE0u) {
      more = 2;
      point = (unsigned long)(lead & 0x0Fu);
    } else if ((lead & 0xF8u) == 0xF0u) {
      more = 3;
      point = (unsigned long)(lead & 0x07u);
    } else {
      return at + 1;
    }
    if (at + more >= bytes) return at + 1;
    for (step = 1; step <= more; step += 1) {
      const unsigned char next = (unsigned char)utf8[at + step];
      if ((next & 0xC0u) != 0x80u) return at + 1;
      point = (point << 6) | (unsigned long)(next & 0x3Fu);
    }
    /* Пересокращённая запись, суррогат и всё выше U+10FFFF — тоже не текст:
       иначе у одного знака было бы два написания, и счёт разошёлся бы. */
    if (more == 1 && point < 0x80UL) return at + 1;
    if (more == 2 && point < 0x800UL) return at + 1;
    if (more == 3 && point < 0x10000UL) return at + 1;
    if (point > 0x10FFFFUL) return at + 1;
    if (point >= 0xD800UL && point <= 0xDFFFUL) return at + 1;
    at += more + 1;
  }
  return 0;
}

/** Байтовое смещение кодовой точки с номером point (от нуля). */
static size_t fl_utf8_offset(const char *utf8, size_t bytes, size_t point) {
  size_t seen = 0;
  size_t index = 0;
  for (index = 0; index < bytes; index += 1) {
    if (fl_utf8_starts(utf8, index)) {
      if (seen == point) {
        return index;
      }
      seen += 1;
    }
  }
  return bytes;
}

/** Стоит ли смещение на границе знака: конец строки границей считается тоже. */
static bool fl_utf8_boundary(const char *utf8, size_t bytes, size_t index) {
  return index >= bytes || fl_utf8_starts(utf8, index);
}

static unsigned long fl_utf8_decode(const char *utf8, size_t bytes, size_t offset, size_t *width) {
  const unsigned char lead = (unsigned char)utf8[offset];
  unsigned long code = lead;
  size_t length = 1;
  if (lead >= 0xF0u) {
    length = 4;
    code = lead & 0x07u;
  } else if (lead >= 0xE0u) {
    length = 3;
    code = lead & 0x0Fu;
  } else if (lead >= 0xC0u) {
    length = 2;
    code = lead & 0x1Fu;
  }
  if (offset + length > bytes) {
    length = 1;
    code = lead;
  } else if (length > 1) {
    size_t index = 1;
    for (index = 1; index < length; index += 1) {
      code = (code << 6) | ((unsigned char)utf8[offset + index] & 0x3Fu);
    }
  }
  if (width != NULL) {
    *width = length;
  }
  return code;
}

/* Пробел по ECMAScript: WhiteSpace + LineTerminator. Список закрытый, поэтому
   он здесь целиком, а не «всё, что скажет isspace» — isspace зависит от locale
   и не знает про U+00A0 и U+2028. */
static bool fl_js_space(unsigned long code) {
  switch (code) {
    case 0x0009u:
    case 0x000Au:
    case 0x000Bu:
    case 0x000Cu:
    case 0x000Du:
    case 0x0020u:
    case 0x00A0u:
    case 0x1680u:
    case 0x2028u:
    case 0x2029u:
    case 0x202Fu:
    case 0x205Fu:
    case 0x3000u:
    case 0xFEFFu:
      return true;
    default:
      return code >= 0x2000u && code <= 0x200Au;
  }
}

/* ═════════════════════════════ значения ═════════════════════════════ */

fl_value fl_nothing(void) {
  fl_value value;
  value.tag = FL_NOTHING;
  value.as.number = 0.0;
  return value;
}

fl_value fl_number(double number) {
  fl_value value;
  value.tag = FL_NUMBER;
  value.as.number = number;
  return value;
}

fl_value fl_flag(bool flag) {
  fl_value value;
  value.tag = FL_FLAG;
  value.as.flag = flag;
  return value;
}

fl_value fl_text_borrow(const char *utf8, size_t bytes, size_t points) {
  fl_value value;
  value.tag = FL_STRING;
  value.as.string.utf8 = utf8;
  value.as.string.bytes = bytes;
  value.as.string.points = points;
  return value;
}

/** Строка-константа рантайма («да», «нет», «ничто»): длины считаются на месте. */
static fl_value fl_text_static(const char *utf8) {
  const size_t bytes = strlen(utf8);
  return fl_text_borrow(utf8, bytes, fl_utf8_points(utf8, bytes));
}

fl_status fl_text(fl_ctx *ctx, const char *utf8, size_t bytes, fl_value *out, fl_error *error) {
  char *copy = NULL;
  if (ctx == NULL || out == NULL) {
    return FL_INVALID_ARGUMENT;
  }
  copy = (char *)fl_arena_alloc(ctx->arena, bytes + 1);
  if (copy == NULL) {
    return fl_no_memory(error);
  }
  if (bytes > 0) {
    memcpy(copy, utf8, bytes);
  }
  copy[bytes] = '\0';
  *out = fl_text_borrow(copy, bytes, fl_utf8_points(copy, bytes));
  return FL_OK;
}

/*
 * Запас массива — с двух концов. Запись одна на массив и общая для всех
 * значений списка, которые на этот массив смотрят: «добавить» занимает ячейку
 * за концом, «приписать» — перед началом, а два водораздела не дают двум разным
 * спискам занять одну и ту же ячейку. Целиком правило — над `fl_b_dobavit`.
 */
struct fl_grow {
  fl_value *items; /* база массива; значение с запасом смотрит внутрь неё */
  size_t head;     /* первая занятая кем-то ячейка; только убывает */
  size_t filled;   /* ячеек занято до этой, не включая; только растёт */
  size_t capacity; /* ячеек в массиве всего */
};

fl_value fl_list(const fl_value *items, size_t count) {
  fl_value value;
  value.tag = FL_LIST;
  value.as.list.items = items;
  value.as.list.count = count;
  value.as.list.grow = NULL; /* запас заводит только «добавить» */
  return value;
}

/** То же, но с запасом: единственный, кто им пользуется, — «добавить». */
static fl_value fl_list_grown(const fl_value *items, size_t count, fl_grow *grow) {
  fl_value value = fl_list(items, count);
  value.as.list.grow = grow;
  return value;
}

fl_status fl_list_alloc(fl_ctx *ctx, size_t count, fl_value **items, fl_error *error) {
  if (ctx == NULL || items == NULL) {
    return FL_INVALID_ARGUMENT;
  }
  if (count == 0) {
    *items = NULL;
    return FL_OK;
  }
  if (count > ((size_t)-1) / sizeof(fl_value)) {
    return fl_no_memory(error);
  }
  *items = (fl_value *)fl_arena_alloc(ctx->arena, count * sizeof(fl_value));
  if (*items == NULL) {
    return fl_no_memory(error);
  }
  return FL_OK;
}

/*
 * Хвост списка — срез, а не копия. В JS «хвост» копирует, потому что массив
 * нельзя разделить с суффиксом; здесь значения неизменяемы и живут в арене,
 * поэтому срез наблюдаемо неотличим от копии, а рекурсия «голова и хвост» по
 * длинному списку из квадратичной становится линейной.
 *
 * Запас срезу не передаётся (`fl_list` ставит NULL), и это обязательно: запись
 * запаса считает ячейки от базы массива, а срез начинается не с неё.
 */
fl_value fl_list_slice(fl_value list, size_t from) {
  if (list.tag != FL_LIST || from >= list.as.list.count) {
    return fl_list(NULL, 0);
  }
  return fl_list(list.as.list.items + from, list.as.list.count - from);
}

/*
 * Цепочка — список ЛИБО строка: образцы «пусто» и «голова и хвост» разбирают
 * обе. Причина одна на все восемь целей: у строки ровно два случая, пустая и
 * «первый символ и остаток», третьего нет. До этих четырёх функций посимвольный
 * проход обязан был начинаться с «разложить … на символы», и это меняло
 * сигнатуру функции.
 *
 * Голова строки — строка из ОДНОЙ кодовой точки, а не байт: `fl_utf8_offset`
 * считает точки, как «длина», «символ» и «символы». Байтовая нарезка разваливала
 * бы эмодзи пополам, и разбор строки разошёлся бы с её длиной.
 *
 * Обе — срезы без копирования, как `fl_list_slice`: значения неизменяемы, память
 * общая, и рекурсия по строке остаётся линейной.
 */
bool fl_chain_empty(fl_value value) {
  if (value.tag == FL_STRING) {
    return value.as.string.points == 0;
  }
  return value.tag == FL_LIST && value.as.list.count == 0;
}

bool fl_chain_cons(fl_value value) {
  if (value.tag == FL_STRING) {
    return value.as.string.points > 0;
  }
  return value.tag == FL_LIST && value.as.list.count > 0;
}

fl_value fl_chain_head(fl_value value) {
  if (value.tag == FL_STRING) {
    size_t stop = fl_utf8_offset(value.as.string.utf8, value.as.string.bytes, 1);
    return fl_text_borrow(value.as.string.utf8, stop, 1);
  }
  return value.as.list.items[0];
}

fl_value fl_chain_tail(fl_value value) {
  if (value.tag == FL_STRING) {
    size_t start = fl_utf8_offset(value.as.string.utf8, value.as.string.bytes, 1);
    return fl_text_borrow(value.as.string.utf8 + start, value.as.string.bytes - start,
                          value.as.string.points - 1);
  }
  return fl_list_slice(value, 1);
}

static fl_status fl_fields_new(fl_ctx *ctx, const char *const *names, const fl_value *values, size_t count,
                               const fl_field **out, fl_error *error) {
  fl_field *fields = NULL;
  size_t index = 0;
  if (count == 0) {
    *out = NULL;
    return FL_OK;
  }
  if (count > ((size_t)-1) / sizeof(fl_field)) {
    return fl_no_memory(error);
  }
  fields = (fl_field *)fl_arena_alloc(ctx->arena, count * sizeof(fl_field));
  if (fields == NULL) {
    return fl_no_memory(error);
  }
  for (index = 0; index < count; index += 1) {
    fields[index].name = names[index];
    fields[index].value = values[index];
  }
  *out = fields;
  return FL_OK;
}

fl_status fl_record_new(fl_ctx *ctx, const char *const *names, const fl_value *values, size_t count,
                        fl_value *out, fl_error *error) {
  fl_record *record = NULL;
  if (ctx == NULL || out == NULL) {
    return FL_INVALID_ARGUMENT;
  }
  record = (fl_record *)fl_arena_alloc(ctx->arena, sizeof(fl_record));
  if (record == NULL) {
    return fl_no_memory(error);
  }
  record->count = count;
  record->fields = NULL;
  FL_TRY(fl_fields_new(ctx, names, values, count, &record->fields, error));
  out->tag = FL_RECORD;
  out->as.record = record;
  return FL_OK;
}

fl_status fl_variant_new(fl_ctx *ctx, const char *name, const char *const *names, const fl_value *values,
                         size_t count, fl_value *out, fl_error *error) {
  fl_variant *variant = NULL;
  if (ctx == NULL || out == NULL) {
    return FL_INVALID_ARGUMENT;
  }
  variant = (fl_variant *)fl_arena_alloc(ctx->arena, sizeof(fl_variant));
  if (variant == NULL) {
    return fl_no_memory(error);
  }
  variant->name = name;
  variant->count = count;
  variant->fields = NULL;
  FL_TRY(fl_fields_new(ctx, names, values, count, &variant->fields, error));
  out->tag = FL_VARIANT;
  out->as.variant = variant;
  return FL_OK;
}

bool fl_is_list(fl_value value) {
  return value.tag == FL_LIST;
}

bool fl_is_record(fl_value value) {
  return value.tag == FL_RECORD;
}

bool fl_is_variant(fl_value value) {
  return value.tag == FL_VARIANT;
}

bool fl_is_scalar(fl_value value) {
  return value.tag == FL_NOTHING || value.tag == FL_NUMBER || value.tag == FL_FLAG || value.tag == FL_STRING;
}

bool fl_variant_is(fl_value value, const char *name) {
  return value.tag == FL_VARIANT && strcmp(value.as.variant->name, name) == 0;
}

/* ═════════════════════════ число → текст ═════════════════════════ */

/*
 * Правила ECMAScript Number::toString. Меньше всего хотелось писать это
 * руками, но выбора нет: «к строке» от числа и половина текстов диагностик
 * содержат число, а printf("%g") печатает «1e+21» как «1e+21» и «100000» как
 * «100000», зато 0.1 — как «0.1» лишь по счастливой случайности выбранной
 * точности. Совпадение с интерпретатором обязано быть посимвольным.
 *
 * Шаг первый — кратчайшая запись, читающаяся обратно тем же double: пробуем
 * точности от 1 до 17 и берём первую, которую strtod возвращает без потерь.
 * Шаг второй — расстановка точки и экспоненты ровно по таблице стандарта.
 */
size_t fl_number_text(double value, char *buffer) {
  char probe[64];
  char digits[32];
  size_t offset = 0;
  size_t count = 0;
  const char *cursor = NULL;
  int precision = 1;
  int exponent = 0;
  int n = 0;
  int k = 0;

  if (isnan(value)) {
    memcpy(buffer, "NaN", 4);
    return 3;
  }
  if (value == 0.0) {
    /* String(-0) === "0": знак нуля не печатается (но Object.is его различает). */
    buffer[0] = '0';
    buffer[1] = '\0';
    return 1;
  }
  if (value < 0.0) {
    buffer[offset] = '-';
    offset += 1;
    value = -value;
  }
  if (isinf(value)) {
    memcpy(buffer + offset, "Infinity", 9);
    return offset + 8;
  }

  for (precision = 1; precision < 17; precision += 1) {
    snprintf(probe, sizeof probe, "%.*e", precision - 1, value);
    if (strtod(probe, NULL) == value) {
      break;
    }
  }
  snprintf(probe, sizeof probe, "%.*e", precision - 1, value);

  for (cursor = probe; *cursor != '\0' && *cursor != 'e'; cursor += 1) {
    if (*cursor >= '0' && *cursor <= '9') {
      digits[count] = *cursor;
      count += 1;
    }
  }
  digits[count] = '\0';
  exponent = (*cursor == 'e') ? atoi(cursor + 1) : 0;

  k = (int)count;
  n = exponent + 1;

  if (k <= n && n <= 21) {
    memcpy(buffer + offset, digits, count);
    offset += count;
    while (n > k) {
      buffer[offset] = '0';
      offset += 1;
      n -= 1;
    }
  } else if (n > 0 && n <= 21) {
    memcpy(buffer + offset, digits, (size_t)n);
    offset += (size_t)n;
    buffer[offset] = '.';
    offset += 1;
    memcpy(buffer + offset, digits + n, count - (size_t)n);
    offset += count - (size_t)n;
  } else if (n > -6 && n <= 0) {
    buffer[offset] = '0';
    buffer[offset + 1] = '.';
    offset += 2;
    while (n < 0) {
      buffer[offset] = '0';
      offset += 1;
      n += 1;
    }
    memcpy(buffer + offset, digits, count);
    offset += count;
  } else {
    buffer[offset] = digits[0];
    offset += 1;
    if (k > 1) {
      buffer[offset] = '.';
      offset += 1;
      memcpy(buffer + offset, digits + 1, count - 1);
      offset += count - 1;
    }
    buffer[offset] = 'e';
    offset += 1;
    buffer[offset] = (n - 1) < 0 ? '-' : '+';
    offset += 1;
    offset += (size_t)snprintf(buffer + offset, FL_NUMBER_TEXT_MAX - offset, "%d", n - 1 < 0 ? -(n - 1) : n - 1);
  }
  buffer[offset] = '\0';
  return offset;
}

/* ═════════════════════════ буфер для текстов ═════════════════════════ */

typedef struct fl_buffer {
  char *data;
  size_t length;
  size_t capacity;
} fl_buffer;

static bool fl_buffer_reserve(fl_ctx *ctx, fl_buffer *buffer, size_t extra) {
  size_t capacity = buffer->capacity == 0 ? 64 : buffer->capacity;
  char *data = NULL;
  if (buffer->length + extra + 1 <= buffer->capacity) {
    return true;
  }
  while (capacity < buffer->length + extra + 1) {
    capacity *= 2;
  }
  /* Арена не умеет освобождать, поэтому рост — это копирование в новый блок.
     Строки диагностик короткие, а значит и копий одна-две. */
  data = (char *)fl_arena_alloc(ctx->arena, capacity);
  if (data == NULL) {
    return false;
  }
  if (buffer->length > 0) {
    memcpy(data, buffer->data, buffer->length);
  }
  buffer->data = data;
  buffer->capacity = capacity;
  return true;
}

static bool fl_buffer_add(fl_ctx *ctx, fl_buffer *buffer, const char *text, size_t bytes) {
  if (!fl_buffer_reserve(ctx, buffer, bytes)) {
    return false;
  }
  if (bytes > 0) {
    memcpy(buffer->data + buffer->length, text, bytes);
  }
  buffer->length += bytes;
  buffer->data[buffer->length] = '\0';
  return true;
}

static bool fl_buffer_text(fl_ctx *ctx, fl_buffer *buffer, const char *text) {
  return fl_buffer_add(ctx, buffer, text, strlen(text));
}

/* ═════════════════════════ описание значений ═════════════════════════ */

const char *fl_type_name(fl_ctx *ctx, fl_value value) {
  switch (value.tag) {
    case FL_NOTHING:
      return "ничто";
    case FL_STRING:
      return "строка";
    case FL_NUMBER:
      return "число";
    case FL_FLAG:
      return "признак";
    case FL_LIST:
      return "список";
    case FL_RECORD:
      return "запись";
    case FL_VARIANT: {
      fl_buffer buffer;
      buffer.data = NULL;
      buffer.length = 0;
      buffer.capacity = 0;
      if (!fl_buffer_text(ctx, &buffer, "вариант «") || !fl_buffer_text(ctx, &buffer, value.as.variant->name) ||
          !fl_buffer_text(ctx, &buffer, "»")) {
        return "вариант";
      }
      return buffer.data;
    }
  }
  return "неизвестное значение";
}

/** JSON.stringify для строки: диагностики интерпретатора печатают строки им. */
static bool fl_buffer_quote(fl_ctx *ctx, fl_buffer *buffer, const char *utf8, size_t bytes) {
  size_t index = 0;
  if (!fl_buffer_text(ctx, buffer, "\"")) {
    return false;
  }
  for (index = 0; index < bytes; index += 1) {
    const unsigned char byte = (unsigned char)utf8[index];
    char escape[8];
    switch (byte) {
      case '"':
        if (!fl_buffer_text(ctx, buffer, "\\\"")) return false;
        continue;
      case '\\':
        if (!fl_buffer_text(ctx, buffer, "\\\\")) return false;
        continue;
      case '\b':
        if (!fl_buffer_text(ctx, buffer, "\\b")) return false;
        continue;
      case '\f':
        if (!fl_buffer_text(ctx, buffer, "\\f")) return false;
        continue;
      case '\n':
        if (!fl_buffer_text(ctx, buffer, "\\n")) return false;
        continue;
      case '\r':
        if (!fl_buffer_text(ctx, buffer, "\\r")) return false;
        continue;
      case '\t':
        if (!fl_buffer_text(ctx, buffer, "\\t")) return false;
        continue;
      default:
        break;
    }
    if (byte < 0x20u) {
      snprintf(escape, sizeof escape, "\\u%04x", (unsigned)byte);
      if (!fl_buffer_text(ctx, buffer, escape)) return false;
      continue;
    }
    if (!fl_buffer_add(ctx, buffer, (const char *)&byte, 1)) return false;
  }
  return fl_buffer_text(ctx, buffer, "\"");
}

static bool fl_describe_into(fl_ctx *ctx, fl_buffer *buffer, fl_value value) {
  char number[FL_NUMBER_TEXT_MAX];
  size_t index = 0;
  switch (value.tag) {
    case FL_STRING:
      return fl_buffer_quote(ctx, buffer, value.as.string.utf8, value.as.string.bytes);
    case FL_VARIANT:
      if (!fl_buffer_text(ctx, buffer, value.as.variant->name)) return false;
      if (value.as.variant->count == 0) return true;
      if (!fl_buffer_text(ctx, buffer, "(")) return false;
      for (index = 0; index < value.as.variant->count; index += 1) {
        if (index > 0 && !fl_buffer_text(ctx, buffer, ", ")) return false;
        if (!fl_buffer_text(ctx, buffer, value.as.variant->fields[index].name)) return false;
      }
      return fl_buffer_text(ctx, buffer, ")");
    case FL_LIST:
      snprintf(number, sizeof number, "%lu", (unsigned long)value.as.list.count);
      return fl_buffer_text(ctx, buffer, "список из ") && fl_buffer_text(ctx, buffer, number);
    case FL_RECORD:
      if (!fl_buffer_text(ctx, buffer, "запись {")) return false;
      for (index = 0; index < value.as.record->count; index += 1) {
        if (index > 0 && !fl_buffer_text(ctx, buffer, ", ")) return false;
        if (!fl_buffer_text(ctx, buffer, value.as.record->fields[index].name)) return false;
      }
      return fl_buffer_text(ctx, buffer, "}");
    case FL_NOTHING:
      return fl_buffer_text(ctx, buffer, "ничто");
    case FL_FLAG:
      return fl_buffer_text(ctx, buffer, value.as.flag ? "да" : "нет");
    case FL_NUMBER:
      fl_number_text(value.as.number, number);
      return fl_buffer_text(ctx, buffer, number);
  }
  return fl_buffer_text(ctx, buffer, "неизвестное значение");
}

const char *fl_describe(fl_ctx *ctx, fl_value value) {
  fl_buffer buffer;
  buffer.data = NULL;
  buffer.length = 0;
  buffer.capacity = 0;
  if (!fl_describe_into(ctx, &buffer, value)) {
    return "значение";
  }
  return buffer.data;
}

/** Строка в кавычках JSON — для диагностик «к числу». */
static const char *fl_quoted(fl_ctx *ctx, fl_value text) {
  fl_buffer buffer;
  buffer.data = NULL;
  buffer.length = 0;
  buffer.capacity = 0;
  if (!fl_buffer_quote(ctx, &buffer, text.as.string.utf8, text.as.string.bytes)) {
    return "\"\"";
  }
  return buffer.data;
}

/* ═════════════════════════ равенство ═════════════════════════ */

static bool fl_same_number(double left, double right) {
  /* Object.is: NaN равен NaN, 0 не равен −0. */
  if (isnan(left) || isnan(right)) {
    return isnan(left) && isnan(right);
  }
  if (left != right) {
    return false;
  }
  if (left == 0.0) {
    return (signbit(left) != 0) == (signbit(right) != 0);
  }
  return true;
}

static bool fl_fields_equal(const fl_field *left, size_t left_count, const fl_field *right, size_t right_count) {
  size_t index = 0;
  size_t other = 0;
  if (left_count != right_count) {
    return false;
  }
  /* Порядок ключей неважен — важен состав, как в recordsEqual интерпретатора. */
  for (index = 0; index < left_count; index += 1) {
    bool found = false;
    for (other = 0; other < right_count; other += 1) {
      if (strcmp(left[index].name, right[other].name) == 0) {
        found = fl_equal(left[index].value, right[other].value);
        break;
      }
    }
    if (!found) {
      return false;
    }
  }
  return true;
}

bool fl_equal(fl_value left, fl_value right) {
  if (fl_is_scalar(left) || fl_is_scalar(right)) {
    if (!fl_is_scalar(left) || !fl_is_scalar(right) || left.tag != right.tag) {
      return false;
    }
    switch (left.tag) {
      case FL_NOTHING:
        return true;
      case FL_FLAG:
        return left.as.flag == right.as.flag;
      case FL_NUMBER:
        return fl_same_number(left.as.number, right.as.number);
      case FL_STRING:
        return left.as.string.bytes == right.as.string.bytes &&
               (left.as.string.bytes == 0 ||
                memcmp(left.as.string.utf8, right.as.string.utf8, left.as.string.bytes) == 0);
      default:
        return false;
    }
  }
  if (left.tag == FL_LIST && right.tag == FL_LIST) {
    size_t index = 0;
    if (left.as.list.count != right.as.list.count) {
      return false;
    }
    for (index = 0; index < left.as.list.count; index += 1) {
      if (!fl_equal(left.as.list.items[index], right.as.list.items[index])) {
        return false;
      }
    }
    return true;
  }
  if (left.tag == FL_VARIANT && right.tag == FL_VARIANT) {
    if (strcmp(left.as.variant->name, right.as.variant->name) != 0) {
      return false;
    }
    return fl_fields_equal(left.as.variant->fields, left.as.variant->count, right.as.variant->fields,
                           right.as.variant->count);
  }
  if (left.tag == FL_RECORD && right.tag == FL_RECORD) {
    return fl_fields_equal(left.as.record->fields, left.as.record->count, right.as.record->fields,
                           right.as.record->count);
  }
  return false;
}

/* ═════════════════════════ операции языка ═════════════════════════ */

fl_status fl_field_get(fl_ctx *ctx, fl_value target, const char *name, fl_value *out, fl_error *error) {
  size_t index = 0;
  if (target.tag == FL_VARIANT) {
    /* Поле СУММЫ ИЗ ОДНОГО ВАРИАНТА. Что вариант ровно один, проверила проверка типов, поэтому сюда приезжает значение, у которого поле есть. Отказ ниже остаётся прежним: он про сумму из двух и более. */
    for (index = 0; index < target.as.variant->count; index += 1) {
      if (strcmp(target.as.variant->fields[index].name, name) == 0) {
        *out = target.as.variant->fields[index].value;
        return FL_OK;
      }
    }
    return fl_fail(ctx, error, FL_CODE_TYPE, "поле «%s» нельзя взять у варианта «%s» — нужен разбор", name,
                   target.as.variant->name);
  }
  if (target.tag != FL_RECORD) {
    return fl_fail(ctx, error, FL_CODE_TYPE, "поле «%s» можно взять только у записи, получено %s", name,
                   fl_type_name(ctx, target));
  }
  for (index = 0; index < target.as.record->count; index += 1) {
    if (strcmp(target.as.record->fields[index].name, name) == 0) {
      *out = target.as.record->fields[index].value;
      return FL_OK;
    }
  }
  return fl_fail(ctx, error, FL_CODE_UNKNOWN_NAME, "запись не содержит поле «%s»", name);
}

fl_status fl_variant_field(fl_ctx *ctx, fl_value target, const char *name, fl_value *out, fl_error *error) {
  size_t index = 0;
  for (index = 0; index < target.as.variant->count; index += 1) {
    if (strcmp(target.as.variant->fields[index].name, name) == 0) {
      *out = target.as.variant->fields[index].value;
      return FL_OK;
    }
  }
  return fl_fail(ctx, error, FL_CODE_UNKNOWN_NAME, "вариант «%s» не содержит поле «%s»", target.as.variant->name,
                 name);
}

fl_status fl_cond(fl_ctx *ctx, fl_value value, bool *out, fl_error *error) {
  if (value.tag != FL_FLAG) {
    return fl_fail(ctx, error, FL_CODE_TYPE, "условие «если» должно быть признаком, получено %s",
                   fl_type_name(ctx, value));
  }
  *out = value.as.flag;
  return FL_OK;
}

fl_status fl_keep(fl_ctx *ctx, fl_value value, bool *out, fl_error *error) {
  if (value.tag != FL_FLAG) {
    return fl_fail(ctx, error, FL_CODE_TYPE, "условие «отфильтровать» должно быть признаком, получено %s",
                   fl_type_name(ctx, value));
  }
  *out = value.as.flag;
  return FL_OK;
}

fl_status fl_post(fl_ctx *ctx, fl_value value, const char *property, const char *function, bool *out,
                  fl_error *error) {
  if (value.tag != FL_FLAG) {
    return fl_fail(ctx, error, FL_CODE_TYPE,
                   "постусловие «%s» функции «%s» должно давать признак, получено %s", property, function,
                   fl_type_name(ctx, value));
  }
  *out = value.as.flag;
  return FL_OK;
}

fl_status fl_pre(fl_ctx *ctx, fl_value value, const char *property, const char *function, bool *out,
                 fl_error *error) {
  if (value.tag != FL_FLAG) {
    return fl_fail(ctx, error, FL_CODE_TYPE,
                   "предусловие «%s» функции «%s» должно давать признак, получено %s", property, function,
                   fl_type_name(ctx, value));
  }
  *out = value.as.flag;
  return FL_OK;
}

fl_status fl_match_fail(fl_ctx *ctx, fl_value value, fl_error *error) {
  return fl_fail(ctx, error, FL_CODE_MATCH_NOT_EXHAUSTIVE, "разбор не покрывает значение %s",
                 fl_describe(ctx, value));
}

fl_status fl_require_list(fl_ctx *ctx, fl_value value, const char *label, fl_value *out, fl_error *error) {
  if (value.tag != FL_LIST) {
    return fl_fail(ctx, error, FL_CODE_TYPE, "«%s» работает только со списком, получено %s", label,
                   fl_type_name(ctx, value));
  }
  *out = value;
  return FL_OK;
}

/*
 * Отказ арифметики: текст живёт ЗДЕСЬ И ТОЛЬКО ЗДЕСЬ.
 *
 * Зовут его двое: `fl_numbers` ниже, когда проверку делает рантайм, и сам
 * напечатанный код, когда проверку делает он (см. шапку в flang_runtime.h).
 * Один текст на оба пути — иначе они разошлись бы молча в тот день, когда
 * сообщение поправят в одном месте.
 */
fl_status fl_not_numbers(fl_ctx *ctx, const char *op, fl_value left, fl_value right, fl_error *error) {
  const char *left_name = fl_type_name(ctx, left);
  return fl_fail(ctx, error, FL_CODE_TYPE, "операция «%s» допустима только для чисел, получено %s и %s", op,
                 left_name, fl_type_name(ctx, right));
}

/* Сообщение дословно как в ядре (src/utility.ts, compare). */
fl_status fl_not_order(fl_ctx *ctx, fl_value left, fl_value right, fl_error *error) {
  (void)left;
  (void)right;
  return fl_fail(ctx, error, FL_CODE_TYPE, "%s", "сравнения порядка допустимы только для чисел");
}

static fl_status fl_numbers(fl_ctx *ctx, const char *op, fl_value left, fl_value right, fl_error *error) {
  if (left.tag != FL_NUMBER || right.tag != FL_NUMBER) {
    return fl_not_numbers(ctx, op, left, right, error);
  }
  return FL_OK;
}

static fl_status fl_order(fl_ctx *ctx, fl_value left, fl_value right, fl_error *error) {
  if (left.tag != FL_NUMBER || right.tag != FL_NUMBER) {
    return fl_not_order(ctx, left, right, error);
  }
  return FL_OK;
}

fl_status fl_add(fl_ctx *ctx, fl_value left, fl_value right, fl_value *out, fl_error *error) {
  FL_TRY(fl_numbers(ctx, "add", left, right, error));
  *out = fl_number(left.as.number + right.as.number);
  return FL_OK;
}

fl_status fl_sub(fl_ctx *ctx, fl_value left, fl_value right, fl_value *out, fl_error *error) {
  FL_TRY(fl_numbers(ctx, "sub", left, right, error));
  *out = fl_number(left.as.number - right.as.number);
  return FL_OK;
}

fl_status fl_mul(fl_ctx *ctx, fl_value left, fl_value right, fl_value *out, fl_error *error) {
  FL_TRY(fl_numbers(ctx, "mul", left, right, error));
  *out = fl_number(left.as.number * right.as.number);
  return FL_OK;
}

/* Деление на ноль даёт Infinity — это значение IEEE-754, а не ошибка. */
fl_status fl_div(fl_ctx *ctx, fl_value left, fl_value right, fl_value *out, fl_error *error) {
  FL_TRY(fl_numbers(ctx, "div", left, right, error));
  *out = fl_number(left.as.number / right.as.number);
  return FL_OK;
}

fl_status fl_mod(fl_ctx *ctx, fl_value left, fl_value right, fl_value *out, fl_error *error) {
  FL_TRY(fl_numbers(ctx, "mod", left, right, error));
  /* Оператор % в JS для чисел — это fmod: знак от делимого, без округления. */
  *out = fl_number(fmod(left.as.number, right.as.number));
  return FL_OK;
}

/* Порядок операций ядра: (процент / 100) * значение. Переставить множители
   нельзя — меняется последний бит мантиссы. */
fl_status fl_percent(fl_ctx *ctx, fl_value left, fl_value right, fl_value *out, fl_error *error) {
  FL_TRY(fl_numbers(ctx, "percent", left, right, error));
  *out = fl_number((left.as.number / 100.0) * right.as.number);
  return FL_OK;
}

fl_status fl_gt(fl_ctx *ctx, fl_value left, fl_value right, fl_value *out, fl_error *error) {
  FL_TRY(fl_order(ctx, left, right, error));
  *out = fl_flag(left.as.number > right.as.number);
  return FL_OK;
}

fl_status fl_lt(fl_ctx *ctx, fl_value left, fl_value right, fl_value *out, fl_error *error) {
  FL_TRY(fl_order(ctx, left, right, error));
  *out = fl_flag(left.as.number < right.as.number);
  return FL_OK;
}

fl_status fl_gte(fl_ctx *ctx, fl_value left, fl_value right, fl_value *out, fl_error *error) {
  FL_TRY(fl_order(ctx, left, right, error));
  *out = fl_flag(left.as.number >= right.as.number);
  return FL_OK;
}

fl_status fl_lte(fl_ctx *ctx, fl_value left, fl_value right, fl_value *out, fl_error *error) {
  FL_TRY(fl_order(ctx, left, right, error));
  *out = fl_flag(left.as.number <= right.as.number);
  return FL_OK;
}

/*
 * Слипнутся ли на стыке два знака в один. Правая строка, начинающаяся октетом
 * продолжения, прирастает к последнему знаку левой: два знака на входе, один на
 * выходе, и `длина (соединить а с б)` перестала бы равняться сумме длин.
 * Показать разницу представление не умеет, поэтому склейка ОТКАЗЫВАЕТ — тем же
 * видом отказа и по той же причине, по какой отказывает склейка половин
 * суррогатной пары у целей с UTF-16 (SPEC, раздел 5).
 */
static bool fl_shov_sliyaet_s(bool est_levoe, fl_value right) {
  return est_levoe && right.as.string.bytes > 0 &&
         ((unsigned char)right.as.string.utf8[0] & 0xC0u) == 0x80u;
}

static bool fl_shov_sliyaet(fl_value left, fl_value right) {
  return fl_shov_sliyaet_s(left.as.string.bytes > 0, right);
}

static fl_status fl_join_two(fl_ctx *ctx, fl_value left, fl_value right, fl_value *out, fl_error *error) {
  char *data = NULL;
  const size_t bytes = left.as.string.bytes + right.as.string.bytes;
  if (fl_shov_sliyaet(left, right)) {
    return fl_fail(ctx, error, FL_CODE_BUILTIN_ARGS, "%s",
                   "«соединить»: на стыке октет продолжения прирос бы к последнему знаку левой "
                   "строки — два знака слились бы в один");
  }
  data = (char *)fl_arena_alloc(ctx->arena, bytes + 1);
  if (data == NULL) {
    return fl_no_memory(error);
  }
  if (left.as.string.bytes > 0) {
    memcpy(data, left.as.string.utf8, left.as.string.bytes);
  }
  if (right.as.string.bytes > 0) {
    memcpy(data + left.as.string.bytes, right.as.string.utf8, right.as.string.bytes);
  }
  data[bytes] = '\0';
  *out = fl_text_borrow(data, bytes, left.as.string.points + right.as.string.points);
  return FL_OK;
}

fl_status fl_concat(fl_ctx *ctx, fl_value left, fl_value right, fl_value *out, fl_error *error) {
  if (left.tag != FL_STRING || right.tag != FL_STRING) {
    const char *left_name = fl_type_name(ctx, left);
    return fl_fail(ctx, error, FL_CODE_TYPE, "«соединить» допустимо только для строк, получено %s и %s",
                   left_name, fl_type_name(ctx, right));
  }
  return fl_join_two(ctx, left, right, out, error);
}

/* ═════════════════════════ проверка аргументов ═════════════════════════ */

static fl_status fl_expect_string(fl_ctx *ctx, const char *name, fl_value value, const char *role,
                                  fl_error *error) {
  if (value.tag != FL_STRING) {
    return fl_fail(ctx, error, FL_CODE_BUILTIN_ARGS, "«%s»: %s должна быть строкой, получено %s", name, role,
                   fl_type_name(ctx, value));
  }
  return FL_OK;
}

static fl_status fl_expect_number(fl_ctx *ctx, const char *name, fl_value value, const char *role,
                                  fl_error *error) {
  if (value.tag != FL_NUMBER) {
    return fl_fail(ctx, error, FL_CODE_BUILTIN_ARGS, "«%s»: %s должно быть числом, получено %s", name, role,
                   fl_type_name(ctx, value));
  }
  return FL_OK;
}

static fl_status fl_expect_integer(fl_ctx *ctx, const char *name, fl_value value, const char *role,
                                   fl_error *error) {
  char text[FL_NUMBER_TEXT_MAX];
  FL_TRY(fl_expect_number(ctx, name, value, role, error));
  /* Number.isInteger: конечное и без дробной части. */
  if (!isfinite(value.as.number) || floor(value.as.number) != value.as.number) {
    fl_number_text(value.as.number, text);
    return fl_fail(ctx, error, FL_CODE_BUILTIN_ARGS, "«%s»: %s должно быть целым числом, получено %s", name,
                   role, text);
  }
  return FL_OK;
}

static fl_status fl_expect_list(fl_ctx *ctx, const char *name, fl_value value, const char *role,
                                fl_error *error) {
  if (value.tag != FL_LIST) {
    return fl_fail(ctx, error, FL_CODE_BUILTIN_ARGS, "«%s»: %s должен быть списком, получено %s", name, role,
                   fl_type_name(ctx, value));
  }
  return FL_OK;
}

/* ═════════════════════════ встроенные формы ═════════════════════════ */

fl_status fl_b_dlina(fl_ctx *ctx, fl_value value, fl_value *out, fl_error *error) {
  if (value.tag == FL_STRING) {
    *out = fl_number((double)value.as.string.points);
    return FL_OK;
  }
  if (value.tag == FL_LIST) {
    *out = fl_number((double)value.as.list.count);
    return FL_OK;
  }
  return fl_fail(ctx, error, FL_CODE_BUILTIN_ARGS, "«длина»: ожидается строка или список, получено %s",
                 fl_type_name(ctx, value));
}

fl_status fl_b_simvol(fl_ctx *ctx, fl_value index, fl_value text, fl_value *out, fl_error *error) {
  double at = 0.0;
  size_t start = 0;
  size_t stop = 0;
  FL_TRY(fl_expect_integer(ctx, "символ", index, "индекс", error));
  FL_TRY(fl_expect_string(ctx, "символ", text, "строка", error));
  at = index.as.number - (double)FL_INDEX_BASE;
  if (at < 0.0 || at >= (double)text.as.string.points) {
    char number[FL_NUMBER_TEXT_MAX];
    fl_number_text(index.as.number, number);
    return fl_fail(ctx, error, FL_CODE_BUILTIN_ARGS, "«символ»: индекс %s вне строки длиной %lu", number,
                   (unsigned long)text.as.string.points);
  }
  start = fl_utf8_offset(text.as.string.utf8, text.as.string.bytes, (size_t)at);
  stop = fl_utf8_offset(text.as.string.utf8, text.as.string.bytes, (size_t)at + 1);
  *out = fl_text_borrow(text.as.string.utf8 + start, stop - start, 1);
  return FL_OK;
}

fl_status fl_b_podstroka(fl_ctx *ctx, fl_value text, fl_value from, fl_value to, fl_value *out,
                         fl_error *error) {
  double start = 0.0;
  double end = 0.0;
  size_t first = 0;
  size_t last = 0;
  FL_TRY(fl_expect_string(ctx, "подстрока", text, "строка", error));
  FL_TRY(fl_expect_integer(ctx, "подстрока", from, "начало", error));
  FL_TRY(fl_expect_integer(ctx, "подстрока", to, "конец", error));
  start = from.as.number - (double)FL_INDEX_BASE;
  end = to.as.number;
  if (start < 0.0 || start > (double)text.as.string.points) {
    char number[FL_NUMBER_TEXT_MAX];
    fl_number_text(from.as.number, number);
    return fl_fail(ctx, error, FL_CODE_BUILTIN_ARGS, "«подстрока»: начало %s вне строки длиной %lu", number,
                   (unsigned long)text.as.string.points);
  }
  if (end < start || end > (double)text.as.string.points) {
    char first_text[FL_NUMBER_TEXT_MAX];
    char last_text[FL_NUMBER_TEXT_MAX];
    fl_number_text(to.as.number, last_text);
    fl_number_text(from.as.number, first_text);
    return fl_fail(ctx, error, FL_CODE_BUILTIN_ARGS, "«подстрока»: конец %s вне диапазона [%s, %lu]",
                   last_text, first_text, (unsigned long)text.as.string.points);
  }
  first = fl_utf8_offset(text.as.string.utf8, text.as.string.bytes, (size_t)start);
  last = fl_utf8_offset(text.as.string.utf8, text.as.string.bytes, (size_t)end);
  *out = fl_text_borrow(text.as.string.utf8 + first, last - first, (size_t)(end - start));
  return FL_OK;
}

fl_status fl_b_soedinit(fl_ctx *ctx, fl_value left, fl_value right, fl_value *out, fl_error *error) {
  /* Две формы: «соединить строку с строкой» и «соединить список с
     разделителем». Различаем по типу первого аргумента — как builtins.mjs. */
  if (left.tag == FL_LIST) {
    size_t index = 0;
    size_t bytes = 0;
    size_t points = 0;
    char *data = NULL;
    size_t offset = 0;
    bool est_levoe = false;
    FL_TRY(fl_expect_string(ctx, "соединить", right, "разделитель", error));
    for (index = 0; index < left.as.list.count; index += 1) {
      const fl_value item = left.as.list.items[index];
      if (item.tag != FL_STRING) {
        return fl_fail(ctx, error, FL_CODE_BUILTIN_ARGS,
                       "«соединить»: элемент %lu списка должен быть строкой, получено %s",
                       (unsigned long)(index + 1), fl_type_name(ctx, item));
      }
      /* Проверяется КАЖДЫЙ стык, и разделитель — такой же стык, как элемент:
         иначе сумма длин перестала бы быть длиной склейки посередине списка. */
      if (index > 0 && fl_shov_sliyaet_s(est_levoe, right)) {
        return fl_fail(ctx, error, FL_CODE_BUILTIN_ARGS, "%s",
                       "«соединить»: на стыке октет продолжения прирос бы к последнему знаку "
                       "левой строки — два знака слились бы в один");
      }
      if (index > 0 && right.as.string.bytes > 0) {
        est_levoe = true;
      }
      if (fl_shov_sliyaet_s(est_levoe, item)) {
        return fl_fail(ctx, error, FL_CODE_BUILTIN_ARGS, "%s",
                       "«соединить»: на стыке октет продолжения прирос бы к последнему знаку "
                       "левой строки — два знака слились бы в один");
      }
      if (item.as.string.bytes > 0) {
        est_levoe = true;
      }
      bytes += item.as.string.bytes;
      points += item.as.string.points;
    }
    if (left.as.list.count > 1) {
      bytes += right.as.string.bytes * (left.as.list.count - 1);
      points += right.as.string.points * (left.as.list.count - 1);
    }
    data = (char *)fl_arena_alloc(ctx->arena, bytes + 1);
    if (data == NULL) {
      return fl_no_memory(error);
    }
    for (index = 0; index < left.as.list.count; index += 1) {
      const fl_value item = left.as.list.items[index];
      if (index > 0 && right.as.string.bytes > 0) {
        memcpy(data + offset, right.as.string.utf8, right.as.string.bytes);
        offset += right.as.string.bytes;
      }
      if (item.as.string.bytes > 0) {
        memcpy(data + offset, item.as.string.utf8, item.as.string.bytes);
        offset += item.as.string.bytes;
      }
    }
    data[offset] = '\0';
    *out = fl_text_borrow(data, offset, points);
    return FL_OK;
  }
  FL_TRY(fl_expect_string(ctx, "соединить", left, "первая строка", error));
  FL_TRY(fl_expect_string(ctx, "соединить", right, "вторая строка", error));
  return fl_join_two(ctx, left, right, out, error);
}

/*
 * Поиск подстроки — ПО ЗНАКАМ, а не по октетам.
 *
 * Здесь стояло «UTF-8 самосинхронизирующийся, ложных срабатываний нет», и это
 * верно ровно до тех пор, пока обе строки — правильный UTF-8. Правильности
 * никто не обещал: октеты приезжают снаружи (`--args`, файл, процесс, кусок
 * TCP), и тогда байтовый поиск находит вхождение ПОСРЕДИ знака. Замер на
 * стволе: «мама» содержит октеты BC D0 — «да», хотя ни один знак «мамы» им не
 * равен и ни одна подстрока его не даёт; «мама» начинается с октета D0 — «да»,
 * хотя её первый знак «м»; «разделить» резало четырёхзначную «маму» на пять
 * кусков по половинке знака.
 *
 * Лекарство то же, каким целям с UTF-16 запретили резать суррогатную пару
 * (`$isBoundary` в печати JS): совпадение засчитывается, только если оба его
 * края стоят на границе знака. Два сравнения октета на найденное вхождение —
 * дешевле, чем обход строки, и включаются они только после удачного memcmp.
 */
static const char *fl_find(const char *haystack, size_t haystack_bytes, const char *needle, size_t needle_bytes) {
  size_t index = 0;
  if (needle_bytes == 0) {
    return haystack;
  }
  if (needle_bytes > haystack_bytes) {
    return NULL;
  }
  for (index = 0; index + needle_bytes <= haystack_bytes; index += 1) {
    if (memcmp(haystack + index, needle, needle_bytes) == 0 &&
        fl_utf8_starts(haystack, index) &&
        fl_utf8_boundary(haystack, haystack_bytes, index + needle_bytes)) {
      return haystack + index;
    }
  }
  return NULL;
}

/* Стоит ли разделитель на этом месте — та же мера, что у «содержит»: оба края
   вхождения обязаны стоять на границе знака, иначе кусок начинался бы половиной
   знака. Без этого «разделить» резало «маму» по одинокому октету D0 на пять
   кусков вместо одного. */
static bool fl_razdelit_zdes(fl_value text, fl_value separator, size_t index) {
  return memcmp(text.as.string.utf8 + index, separator.as.string.utf8, separator.as.string.bytes) == 0 &&
         fl_utf8_starts(text.as.string.utf8, index) &&
         fl_utf8_boundary(text.as.string.utf8, text.as.string.bytes, index + separator.as.string.bytes);
}

/* Само разделение, без единой проверки: обе внешние формы («разделить» и её
   доказанный путь) проверяют своё и зовут это. Общее тело здесь потому, что
   расхождение двух копий алгоритма было бы расхождением ОТВЕТА, а не только
   сторожа. */
static fl_status fl_razdelit_kuski(fl_ctx *ctx, fl_value text, fl_value separator, fl_value *out, fl_error *error) {
  size_t count = 1;
  size_t index = 0;
  size_t start = 0;
  fl_value *items = NULL;

  for (index = 0; index + separator.as.string.bytes <= text.as.string.bytes;) {
    if (fl_razdelit_zdes(text, separator, index)) {
      count += 1;
      index += separator.as.string.bytes;
    } else {
      index += 1;
    }
  }

  FL_TRY(fl_list_alloc(ctx, count, &items, error));
  count = 0;
  start = 0;
  for (index = 0; index + separator.as.string.bytes <= text.as.string.bytes;) {
    if (fl_razdelit_zdes(text, separator, index)) {
      const char *piece = text.as.string.utf8 + start;
      const size_t bytes = index - start;
      items[count] = fl_text_borrow(piece, bytes, fl_utf8_points(piece, bytes));
      count += 1;
      index += separator.as.string.bytes;
      start = index;
    } else {
      index += 1;
    }
  }
  {
    const char *piece = text.as.string.utf8 + start;
    const size_t bytes = text.as.string.bytes - start;
    items[count] = fl_text_borrow(piece, bytes, fl_utf8_points(piece, bytes));
    count += 1;
  }
  *out = fl_list(items, count);
  return FL_OK;
}

fl_status fl_b_razdelit(fl_ctx *ctx, fl_value text, fl_value separator, fl_value *out, fl_error *error) {
  FL_TRY(fl_expect_string(ctx, "разделить", text, "строка", error));
  FL_TRY(fl_expect_string(ctx, "разделить", separator, "разделитель", error));
  if (separator.as.string.bytes == 0) {
    return fl_fail(ctx, error, FL_CODE_BUILTIN_ARGS, "%s", "«разделить»: разделитель не может быть пустым");
  }
  return fl_razdelit_kuski(ctx, text, separator, out, error);
}

fl_status fl_b_razdelit_dokazano(fl_ctx *ctx, fl_value text, fl_value separator, fl_value *out, fl_error *error) {
  FL_TRY(fl_expect_string(ctx, "разделить", text, "строка", error));
  FL_TRY(fl_expect_string(ctx, "разделить", separator, "разделитель", error));
  return fl_razdelit_kuski(ctx, text, separator, out, error);
}

/*
 * Разложение строки в список односимвольных строк — по кодовым точкам.
 *
 * Куски не копируются: каждая строка списка одалживает байты исходной
 * (`fl_text_borrow`), потому что исходная строка живёт в той же арене и до
 * конца вызова никуда не денется. Список из n символов стоит поэтому одного
 * выделения на массив, а не n выделений на строки.
 *
 * Пустая строка даёт пустой список — так же, как в свидетеле.
 */
fl_status fl_b_simvoly(fl_ctx *ctx, fl_value text, fl_value *out, fl_error *error) {
  size_t count = 0;
  size_t index = 0;
  size_t start = 0;
  fl_value *items = NULL;
  FL_TRY(fl_expect_string(ctx, "символы", text, "строка", error));

  count = fl_utf8_points(text.as.string.utf8, text.as.string.bytes);
  if (count == 0) {
    *out = fl_list(NULL, 0);
    return FL_OK;
  }

  FL_TRY(fl_list_alloc(ctx, count, &items, error));
  count = 0;
  /* Ведущий байт кодовой точки — тот, у которого старшие два бита не 10.
     Встретив следующий ведущий, закрываем предыдущий символ. */
  for (index = 1; index <= text.as.string.bytes; index += 1) {
    const bool конец = index == text.as.string.bytes;
    const bool ведущий =
        !конец && ((unsigned char)text.as.string.utf8[index] & 0xC0u) != 0x80u;
    if (конец || ведущий) {
      items[count] = fl_text_borrow(text.as.string.utf8 + start, index - start, 1);
      count += 1;
      start = index;
    }
  }
  *out = fl_list(items, count);
  return FL_OK;
}

/* «код символа»: кодовая точка первого символа строки.

   Декодер уже есть — тот же `fl_utf8_decode`, каким считаются пробелы в «к
   числу»; байт utf8[0] отдал бы первую восьмёрку бит, а не символ. */
fl_status fl_b_kod_simvola(fl_ctx *ctx, fl_value text, fl_value *out, fl_error *error) {
  size_t width = 0;
  FL_TRY(fl_expect_string(ctx, "код символа", text, "строка", error));
  if (text.as.string.bytes == 0) {
    return fl_fail(ctx, error, FL_CODE_BUILTIN_ARGS, "%s", "«код символа»: строка пуста");
  }
  *out = fl_number(
      (double)fl_utf8_decode(text.as.string.utf8, text.as.string.bytes, 0, &width));
  return FL_OK;
}

fl_status fl_b_kod_simvola_dokazano(fl_ctx *ctx, fl_value text, fl_value *out, fl_error *error) {
  size_t width = 0;
  FL_TRY(fl_expect_string(ctx, "код символа", text, "строка", error));
  *out = fl_number(
      (double)fl_utf8_decode(text.as.string.utf8, text.as.string.bytes, 0, &width));
  return FL_OK;
}

/* «символ по коду»: строка ровно из одного символа.
 *
 * Обратной к `fl_utf8_decode` в рантайме не было, и здесь она выписана — четыре
 * ветки по длине записи, ровно те же границы, по которым декодер читает. Больше
 * ей нигде не нужно, поэтому она стоит внутри формы, а не рядом с декодером.
 *
 * Суррогат отвергается ДО кодирования. Записать его в UTF-8 технически можно —
 * три байта лягут, — но это была бы не UTF-8, а WTF-8, и строка перестала бы
 * быть тем, чем её объявляет `flang_runtime.h`: «строка — UTF-8, длина в байтах
 * и в кодовых точках». Тот же отказ дают все восемь целей.
 */
fl_status fl_b_simvol_po_kodu(fl_ctx *ctx, fl_value code, fl_value *out, fl_error *error) {
  char buffer[4];
  size_t bytes = 0;
  unsigned long point = 0;
  FL_TRY(fl_expect_integer(ctx, "символ по коду", code, "код", error));
  if (code.as.number < 0.0 || code.as.number > 1114111.0) {
    char number[FL_NUMBER_TEXT_MAX];
    fl_number_text(code.as.number, number);
    return fl_fail(ctx, error, FL_CODE_BUILTIN_ARGS,
                   "«символ по коду»: код %s вне диапазона Unicode [0, 1114111]", number);
  }
  if (code.as.number >= 55296.0 && code.as.number <= 57343.0) {
    char number[FL_NUMBER_TEXT_MAX];
    fl_number_text(code.as.number, number);
    return fl_fail(ctx, error, FL_CODE_BUILTIN_ARGS,
                   "«символ по коду»: код %s — половина суррогатной пары, а не символ", number);
  }
  point = (unsigned long)code.as.number;
  if (point < 0x80ul) {
    buffer[0] = (char)point;
    bytes = 1;
  } else if (point < 0x800ul) {
    buffer[0] = (char)(0xC0ul | (point >> 6));
    buffer[1] = (char)(0x80ul | (point & 0x3Ful));
    bytes = 2;
  } else if (point < 0x10000ul) {
    buffer[0] = (char)(0xE0ul | (point >> 12));
    buffer[1] = (char)(0x80ul | ((point >> 6) & 0x3Ful));
    buffer[2] = (char)(0x80ul | (point & 0x3Ful));
    bytes = 3;
  } else {
    buffer[0] = (char)(0xF0ul | (point >> 18));
    buffer[1] = (char)(0x80ul | ((point >> 12) & 0x3Ful));
    buffer[2] = (char)(0x80ul | ((point >> 6) & 0x3Ful));
    buffer[3] = (char)(0x80ul | (point & 0x3Ful));
    bytes = 4;
  }
  return fl_text(ctx, buffer, bytes, out, error);
}

fl_status fl_b_soderzhit(fl_ctx *ctx, fl_value left, fl_value right, fl_value *out, fl_error *error) {
  if (left.tag == FL_LIST) {
    size_t index = 0;
    for (index = 0; index < left.as.list.count; index += 1) {
      if (fl_equal(left.as.list.items[index], right)) {
        *out = fl_flag(true);
        return FL_OK;
      }
    }
    *out = fl_flag(false);
    return FL_OK;
  }
  FL_TRY(fl_expect_string(ctx, "содержит", left, "строка или список", error));
  FL_TRY(fl_expect_string(ctx, "содержит", right, "искомая подстрока", error));
  *out = fl_flag(fl_find(left.as.string.utf8, left.as.string.bytes, right.as.string.utf8,
                         right.as.string.bytes) != NULL);
  return FL_OK;
}

fl_status fl_b_nachinaetsya_s(fl_ctx *ctx, fl_value text, fl_value prefix, fl_value *out, fl_error *error) {
  FL_TRY(fl_expect_string(ctx, "начинается с", text, "строка", error));
  FL_TRY(fl_expect_string(ctx, "начинается с", prefix, "префикс", error));
  /* Начало у префикса и у строки одно, поэтому левый край на границе знака
     всегда; сторожится правый — иначе «мама» начиналась бы с одинокого октета
     D0, то есть с половины своего первого знака. */
  *out = fl_flag(prefix.as.string.bytes <= text.as.string.bytes &&
                 (prefix.as.string.bytes == 0 ||
                  (memcmp(text.as.string.utf8, prefix.as.string.utf8, prefix.as.string.bytes) == 0 &&
                   fl_utf8_boundary(text.as.string.utf8, text.as.string.bytes, prefix.as.string.bytes))));
  return FL_OK;
}

/*
 * «к числу» — строгий разбор. Регулярное выражение интерпретатора
 * /^[+-]?(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?$/u развёрнуто в проверку вручную:
 * тянуть regex.h ради одной строки нельзя (POSIX-регулярки не знают ни \d,
 * ни якорей в том же смысле), а «просто strtod» пропустил бы «0x10», «Infinity»
 * и «12abc» — то есть молча превратил бы мусор в значение.
 */
static bool fl_looks_like_number(const char *text, size_t bytes) {
  size_t index = 0;
  size_t digits = 0;
  if (bytes == 0) {
    return false;
  }
  if (text[0] == '+' || text[0] == '-') {
    index = 1;
  }
  while (index < bytes && text[index] >= '0' && text[index] <= '9') {
    index += 1;
    digits += 1;
  }
  if (index < bytes && text[index] == '.') {
    size_t fraction = 0;
    index += 1;
    while (index < bytes && text[index] >= '0' && text[index] <= '9') {
      index += 1;
      fraction += 1;
    }
    /* «1.» недопустимо: у целой части обязана быть дробная, если точка есть. */
    if (fraction == 0) {
      return false;
    }
    digits += fraction;
  }
  if (digits == 0) {
    return false;
  }
  if (index < bytes && (text[index] == 'e' || text[index] == 'E')) {
    size_t exponent = 0;
    index += 1;
    if (index < bytes && (text[index] == '+' || text[index] == '-')) {
      index += 1;
    }
    while (index < bytes && text[index] >= '0' && text[index] <= '9') {
      index += 1;
      exponent += 1;
    }
    if (exponent == 0) {
      return false;
    }
  }
  return index == bytes;
}

fl_status fl_b_k_chislu(fl_ctx *ctx, fl_value text, fl_value *out, fl_error *error) {
  size_t start = 0;
  size_t stop = 0;
  size_t width = 0;
  char *copy = NULL;
  double number = 0.0;
  FL_TRY(fl_expect_string(ctx, "к числу", text, "строка", error));

  stop = text.as.string.bytes;
  while (start < stop) {
    const unsigned long code = fl_utf8_decode(text.as.string.utf8, stop, start, &width);
    if (!fl_js_space(code)) {
      break;
    }
    start += width;
  }
  while (stop > start) {
    /* Отступаем на начало последней кодовой точки. */
    size_t back = stop - 1;
    while (back > start && ((unsigned char)text.as.string.utf8[back] & 0xC0u) == 0x80u) {
      back -= 1;
    }
    if (!fl_js_space(fl_utf8_decode(text.as.string.utf8, stop, back, &width))) {
      break;
    }
    stop = back;
  }

  if (!fl_looks_like_number(text.as.string.utf8 + start, stop - start)) {
    return fl_fail(ctx, error, FL_CODE_BUILTIN_ARGS, "«к числу»: строка %s не является числом",
                   fl_quoted(ctx, text));
  }
  copy = (char *)fl_arena_alloc(ctx->arena, (stop - start) + 1);
  if (copy == NULL) {
    return fl_no_memory(error);
  }
  memcpy(copy, text.as.string.utf8 + start, stop - start);
  copy[stop - start] = '\0';
  errno = 0;
  number = strtod(copy, NULL);
  if (!isfinite(number)) {
    return fl_fail(ctx, error, FL_CODE_BUILTIN_ARGS, "«к числу»: строка %s не является конечным числом",
                   fl_quoted(ctx, text));
  }
  *out = fl_number(number);
  return FL_OK;
}

/*
 * Отказ «к числу», ставший значением (builtins.mjs, «отказ, ставший значением»).
 *
 * Разбор не повторяется: он один и тот же, и вызывается прямо здесь. Иначе
 * пришлось бы держать вторую копию правил разбора и второй набор текстов, и
 * первое же расхождение оказалось бы незамеченным — сравнивать было бы не с
 * чем. Здесь же текст отказа приходит ровно из `fl_b_k_chislu`.
 *
 * `inner` — свой fl_error, а не тот, что дан вызывающим: отказ разбора наружу
 * не идёт вовсе, эта форма отказать не может. Сообщение живёт в арене (его
 * строит fl_vformat), поэтому borrow-строкой брать его безопасно — арена та же.
 */
fl_status fl_b_k_chislu_ili_beda(fl_ctx *ctx, fl_value text, fl_value *out, fl_error *error) {
  static const char *const parsed_names[] = {"значение"};
  static const char *const failed_names[] = {"код", "сообщение"};
  fl_error inner;
  fl_value number = fl_nothing();
  fl_value failure[2];
  inner.code = NULL;
  inner.message = NULL;
  if (fl_b_k_chislu(ctx, text, &number, &inner) == FL_OK) {
    return fl_variant_new(ctx, "Разобрано", parsed_names, &number, 1, out, error);
  }
  failure[0] = fl_text_static(inner.code == NULL ? FL_CODE_BUILTIN_ARGS : inner.code);
  failure[1] = fl_text_static(inner.message == NULL ? "" : inner.message);
  return fl_variant_new(ctx, "Не разобрано", failed_names, failure, 2, out, error);
}

fl_status fl_b_k_stroke(fl_ctx *ctx, fl_value value, fl_value *out, fl_error *error) {
  char text[FL_NUMBER_TEXT_MAX];
  switch (value.tag) {
    case FL_STRING:
      *out = value;
      return FL_OK;
    case FL_NUMBER:
      fl_number_text(value.as.number, text);
      return fl_text(ctx, text, strlen(text), out, error);
    case FL_FLAG:
      /* Признак печатается по-русски: поверхность языка знает «да» и «нет». */
      *out = fl_text_static(value.as.flag ? "да" : "нет");
      return FL_OK;
    case FL_NOTHING:
      *out = fl_text_static("ничто");
      return FL_OK;
    default:
      return fl_fail(ctx, error, FL_CODE_BUILTIN_ARGS, "«к строке»: ожидается скаляр, получено %s",
                     fl_type_name(ctx, value));
  }
}

fl_status fl_b_pusto(fl_ctx *ctx, fl_value value, fl_value *out, fl_error *error) {
  if (value.tag == FL_LIST) {
    *out = fl_flag(value.as.list.count == 0);
    return FL_OK;
  }
  if (value.tag == FL_STRING) {
    *out = fl_flag(value.as.string.points == 0);
    return FL_OK;
  }
  return fl_fail(ctx, error, FL_CODE_BUILTIN_ARGS, "«пусто»: ожидается строка или список, получено %s",
                 fl_type_name(ctx, value));
}

fl_status fl_b_golova(fl_ctx *ctx, fl_value value, fl_value *out, fl_error *error) {
  FL_TRY(fl_expect_list(ctx, "голова", value, "аргумент", error));
  if (value.as.list.count == 0) {
    return fl_fail(ctx, error, FL_CODE_BUILTIN_ARGS, "%s", "«голова»: список пуст");
  }
  *out = value.as.list.items[0];
  return FL_OK;
}

fl_status fl_b_golova_dokazano(fl_ctx *ctx, fl_value value, fl_value *out, fl_error *error) {
  FL_TRY(fl_expect_list(ctx, "голова", value, "аргумент", error));
  *out = value.as.list.items[0];
  return FL_OK;
}

/*
 * «элемент N в СПИСОК»: обращение к массиву, без обхода.
 *
 * Список в C — указатель на массив плюс счётчик (`fl_value.as.list`), поэтому
 * N-й элемент стоит одного сложения — столько же, сколько первый. Проверка
 * границ и текст отказа повторяют вычислитель дословно: они сверяются
 * дифференциально, и «похоже» тут не годится.
 */
fl_status fl_b_element(fl_ctx *ctx, fl_value index, fl_value list, fl_value *out, fl_error *error) {
  double at = 0.0;
  FL_TRY(fl_expect_integer(ctx, "элемент", index, "индекс", error));
  FL_TRY(fl_expect_list(ctx, "элемент", list, "список", error));
  at = index.as.number - (double)FL_INDEX_BASE;
  if (at < 0.0 || at >= (double)list.as.list.count) {
    char number[FL_NUMBER_TEXT_MAX];
    fl_number_text(index.as.number, number);
    return fl_fail(ctx, error, FL_CODE_BUILTIN_ARGS, "«элемент»: индекс %s вне списка длиной %lu", number,
                   (unsigned long)list.as.list.count);
  }
  *out = list.as.list.items[(size_t)at];
  return FL_OK;
}

fl_status fl_b_hvost(fl_ctx *ctx, fl_value value, fl_value *out, fl_error *error) {
  FL_TRY(fl_expect_list(ctx, "хвост", value, "аргумент", error));
  if (value.as.list.count == 0) {
    return fl_fail(ctx, error, FL_CODE_BUILTIN_ARGS, "%s", "«хвост»: список пуст");
  }
  *out = fl_list_slice(value, 1);
  return FL_OK;
}

fl_status fl_b_hvost_dokazano(fl_ctx *ctx, fl_value value, fl_value *out, fl_error *error) {
  FL_TRY(fl_expect_list(ctx, "хвост", value, "аргумент", error));
  *out = fl_list_slice(value, 1);
  return FL_OK;
}

/*
 * ── «добавить»: удлинение списка за постоянное время ───────────────────────
 *
 * Прямая запись — выделить n+1 значений и скопировать n — верна, но в арене,
 * которая ничего не отдаёт до конца вызова, стоит ~16·n² байт на список,
 * собранный n вызовами: живёт не только последняя копия, а все. Под сборщиком
 * мусора этого не видно (`[...list, x]` в JS копирует ровно так же, но
 * промежуточные копии умирают сразу), здесь — видно: лексер компилятора на
 * 35 тысячах токенов требовал 19 ГБ.
 *
 * ── Почему одного `fl_arena_extend` мало ───────────────────────────────────
 * Напрашивается решение проще: раз арена умеет продлить последнюю выдачу,
 * пусть «добавить» её и продлевает. Померено — не работает, и вот числа
 * (20 000 «добавить», байт арены на элемент):
 *
 *   между «добавить» ничего не выделяется:  321 018 → 316 691  (−1.3%)
 *   между «добавить» выделяется значение:   379 882 → 379 882  (0%)
 *
 * Две причины, и обе неустранимы в рамках «продлить последнее». Первая —
 * последним оно почти никогда не бывает: список из чего-то состоит, и это
 * что-то строится перед тем, как попасть в список. Ровно так работает лексер,
 * и ровно поэтому вторая строка не сдвинулась ни на байт. Вторая — как только
 * массив перерастает кусок арены (64 КБ, то есть 2048 значений), он получает
 * кусок ровно по себе, и продлевать его некуда; поэтому и первая строка дала
 * процент, а не порядок.
 *
 * Работает другое: не продлевать по одной ячейке в конце, а брать запас
 * заранее — тогда между двумя «добавить» арена может выдать сколько угодно
 * чужого, ячейка всё равно наша. Продление на месте осталось, но как приятное
 * дополнение к запасу, а не как замена ему.
 *
 * ── Как это не ломает неизменяемость ───────────────────────────────────────
 * Массив выделяется с запасом, а «добавить» пишет в запас на месте.
 * Всё держится на одном инварианте, и он же — доказательство неизменяемости:
 *
 *   у массива с запасом есть общая на всех запись `fl_grow`, и занятая часть
 *   массива в ней — полуинтервал `[head, filled)`: `filled` только растёт,
 *   `head` только убывает.
 *
 * Занять ячейку `filled` разрешено единственному — тому списку, который в этом
 * массиве кончается ровно на ней (`начало + длина == filled`); после записи
 * `filled` становится больше на один. Ячейку `head − 1` занимает «приписать», и
 * тоже единственному — тому, кто в этом массиве НАЧИНАЕТСЯ ровно на `head`.
 * Значит:
 *
 *   • ячейка за концом списка пишется не более одного раза за всю жизнь
 *     арены — второе «добавить» к тому же значению видит `filled` дальше своего
 *     конца и уходит на копию; то же у «приписать» с `head`;
 *   • ячейки `head…filled−1` не трогаются вовсе.
 *
 * Отсюда старый список после «добавить» — тот же самый: та же длина, те же
 * элементы. Разветвление
 *
 *     пусть «а» равно (добавить 1 к «с»)   ← занимает ячейку n, filled = n+1
 *     пусть «б» равно (добавить 2 к «с»)   ← count = n ≠ filled → копия
 *
 * даёт два независимых списка, и ни один не портит «с».
 *
 * Запас удваивается, поэтому за все перевыделения арена отдаёт около 4n ячеек
 * вместо n²/2 — линейно по длине. А если массив ещё и последнее, что арена
 * выдала, запас продлевается прямо на месте (`fl_arena_extend`), и копий нет
 * вовсе: так идёт накопление в свёртке, где между двумя «добавить» не
 * выделяется ничего.
 */

/* Запас первого массива: списки чаще коротки, и платить за них страницей ни к
   чему. Дальше запас равен длине, то есть удваивается. */
#define FL_GROW_FIRST (size_t)4

fl_status fl_b_dobavit(fl_ctx *ctx, fl_value item, fl_value list, fl_value *out, fl_error *error) {
  const size_t limit = ((size_t)-1) / sizeof(fl_value);
  fl_grow *grow = NULL;
  fl_value *items = NULL;
  size_t count = 0;
  size_t capacity = 0;
  size_t start = 0;

  FL_TRY(fl_expect_list(ctx, "добавить", list, "второй аргумент", error));
  count = list.as.list.count;
  grow = list.as.list.grow;
  /* Начало списка внутри массива: ноль у всех, кого собрал «добавить», и
     сдвинутое вперёд у тех, кого собрал «приписать». */
  if (grow != NULL) {
    start = (size_t)(list.as.list.items - grow->items);
  }

  /* Быстрый путь: ячейка за концом принадлежит этому массиву и свободна. */
  if (grow != NULL && start + count == grow->filled) {
    bool room = grow->filled < grow->capacity;
    if (!room && grow->capacity <= limit / 2) {
      /* Запас исчерпан, но массив может оказаться последней выдачей арены. */
      const size_t taken = grow->capacity * sizeof(fl_value);
      if (fl_arena_extend(ctx->arena, grow->items, taken, taken)) {
        grow->capacity += grow->capacity;
        room = true;
      }
    }
    if (room) {
      grow->items[grow->filled] = item;
      grow->filled += 1;
      *out = fl_list_grown(grow->items + start, count + 1, grow);
      return FL_OK;
    }
  }

  /* Медленный путь: копия с запасом — чтобы следующие «добавить» шли на месте.
     Запись запаса выделяется ПЕРЕД массивом, тогда массив остаётся последней
     выдачей арены и его ещё можно будет продлить, не копируя. */
  if (count >= limit) {
    return fl_no_memory(error);
  }
  capacity = count < FL_GROW_FIRST ? FL_GROW_FIRST : count;
  if (capacity > limit - count) {
    capacity = limit - count;
  }
  capacity += count; /* не меньше count + 1: выше count < limit */
  grow = (fl_grow *)fl_arena_alloc(ctx->arena, sizeof(fl_grow));
  if (grow == NULL) {
    return fl_no_memory(error);
  }
  FL_TRY(fl_list_alloc(ctx, capacity, &items, error));
  if (count > 0) {
    memcpy(items, list.as.list.items, count * sizeof(fl_value));
  }
  items[count] = item;
  grow->items = items;
  grow->head = 0;
  grow->filled = count + 1;
  grow->capacity = capacity;
  *out = fl_list_grown(items, count + 1, grow);
  return FL_OK;
}

/*
 * ── «приписать»: то же за постоянное время, только с другого конца ─────────
 *
 * Приписывание в начало — зеркало «добавить», и держится оно на той же записи
 * `fl_grow`: у массива есть запас СПЕРЕДИ, а `head` не даёт двум разным
 * спискам занять одну и ту же ячейку перед началом.
 *
 * Занять ячейку `head − 1` разрешено единственному — тому списку, который
 * начинается ровно на `head`; после записи `head` становится меньше на один.
 * Разветвление
 *
 *     пусть «а» равно (приписать 1 к «с»)   ← занимает ячейку head−1, head−−
 *     пусть «б» равно (приписать 2 к «с»)   ← начало «с» уже не равно head → копия
 *
 * даёт два независимых списка, и ни один не портит «с» — доказательство то же,
 * что у «добавить», и другой половиной того же инварианта.
 *
 * ЧЕМ ЭТО ОТЛИЧАЕТСЯ ОТ «ДОБАВИТЬ». Ровно одним: продлить массив на месте
 * (`fl_arena_extend`) вперёд нельзя — арена умеет отменить только последнюю
 * выдачу, и растёт та в сторону старших адресов. Поэтому весь запас
 * «приписать» берёт заранее: копия кладётся в КОНЕЦ свежего массива, и всё
 * свободное место остаётся перед ней. Запас равен длине, то есть удваивается,
 * поэтому за все перевыделения арена отдаёт около 4n ячеек вместо n²/2.
 *
 * ЗАЧЕМ ЭТО ВООБЩЕ. До появления формы приписывание в начало писалось
 * свёрткой, дописывающей КАЖДЫЙ элемент хвоста в свежий накопитель. У неё
 * своя цена — линейная по длине на каждый вызов, — и на построении списка
 * спереди назад это давало квадрат там, где нужен один проход. Числа: в SPEC,
 * раздел «Стоимость встроенных форм», и в комментарии над проверкой
 * «приписывание в начало не стоит длины списка» (flang/test/builtins.test.mjs).
 */
fl_status fl_b_pripisat(fl_ctx *ctx, fl_value item, fl_value list, fl_value *out, fl_error *error) {
  const size_t limit = ((size_t)-1) / sizeof(fl_value);
  fl_grow *grow = NULL;
  fl_value *items = NULL;
  size_t count = 0;
  size_t capacity = 0;
  size_t slack = 0;

  FL_TRY(fl_expect_list(ctx, "приписать", list, "второй аргумент", error));
  count = list.as.list.count;
  grow = list.as.list.grow;

  /* Быстрый путь: ячейка перед началом принадлежит этому массиву и свободна. */
  if (grow != NULL && grow->head > 0 && list.as.list.items == grow->items + grow->head) {
    grow->head -= 1;
    grow->items[grow->head] = item;
    *out = fl_list_grown(grow->items + grow->head, count + 1, grow);
    return FL_OK;
  }

  /* Медленный путь: копия в конец массива, весь запас — перед ней. */
  if (count >= limit) {
    return fl_no_memory(error);
  }
  slack = count < FL_GROW_FIRST ? FL_GROW_FIRST : count;
  if (slack > limit - count) {
    slack = limit - count;
  }
  capacity = count + slack; /* не меньше count + 1: выше count < limit, slack >= 1 */
  grow = (fl_grow *)fl_arena_alloc(ctx->arena, sizeof(fl_grow));
  if (grow == NULL) {
    return fl_no_memory(error);
  }
  FL_TRY(fl_list_alloc(ctx, capacity, &items, error));
  if (count > 0) {
    memcpy(items + slack, list.as.list.items, count * sizeof(fl_value));
  }
  items[slack - 1] = item;
  grow->items = items;
  grow->head = slack - 1;
  grow->filled = capacity;
  grow->capacity = capacity;
  *out = fl_list_grown(items + grow->head, count + 1, grow);
  return FL_OK;
}

fl_status fl_b_ostatok_ot(fl_ctx *ctx, fl_value left, fl_value right, fl_value *out, fl_error *error) {
  FL_TRY(fl_expect_number(ctx, "остаток от", left, "делимое", error));
  FL_TRY(fl_expect_number(ctx, "остаток от", right, "делитель", error));
  *out = fl_number(fmod(left.as.number, right.as.number));
  return FL_OK;
}

fl_status fl_b_procentov_ot(fl_ctx *ctx, fl_value left, fl_value right, fl_value *out, fl_error *error) {
  FL_TRY(fl_expect_number(ctx, "процентов от", left, "процент", error));
  FL_TRY(fl_expect_number(ctx, "процентов от", right, "значение", error));
  *out = fl_number((left.as.number / 100.0) * right.as.number);
  return FL_OK;
}

/* ═════════════════════════ батут ═════════════════════════ */

/*
 * ── Область на ВИТОК батута ────────────────────────────────────────────────
 *
 * Без неё батут был дырой ровно того же вида, какую у свёртки закрывает
 * `fl_region_recycle`, и дырой куда крупнее. Свёртка печатается циклом C, и
 * область на вызов ей не помогала; батут — ТОЖЕ цикл C, а область у него одна
 * на всю раскрутку: её открывает обёртка компоненты сильной связности
 * («Печать батута» в flang/self/emit-c.flang) ПЕРЕД вызовом батута и закрывает
 * ПОСЛЕ. Значит мусор всех витков доживал до конца последнего.
 *
 * ── Улика, снятая замером, а не рассуждением ───────────────────────────────
 * Хвостовая рекурсия на самом языке, прогнанная интерпретатором:
 *
 *     тотальная функция «Счёт» принимает «сколько», «сумма» … убывает «сколько»
 *       если «сколько» равен 0 то «сумма» иначе «Счёт» от («сколько» минус 1) …
 *
 *   витков    пик до                 пик после     время до → после
 *   100 000    7,99 ГиБ               0,0135 ГиБ    12,7 с → 6,9 с
 *   200 000   15,98 ГиБ               0,0135 ГиБ    25,3 с → 13,5 с
 *   400 000   снят пределом 20 ГиБ    0,0135 ГиБ         — → 27,2 с
 *
 * То есть 84 килобайта на виток и рост строго линейный: считать в интерпретаторе
 * миллион витков было нельзя ни на какой машине. После правки пик от числа
 * витков НЕ ЗАВИСИТ ВОВСЕ — одно и то же число на всех четырёх замерах, — а
 * время вдвое МЕНЬШЕ: арена перестала покупать у malloc гигабайты кусков.
 * Пик снимался ядром (`memory.peak` контрольной группы), а не `ps`: тот на этих
 * же прогонах занижал вдвое.
 *
 * Обход стека при пике `flang check flang/stdlib/scram.flang` показывал ровно
 * это место: `fl_record_new` ← «Положить» ← «Вычислить пусть» ← «Шаг машины» ←
 * «Виток»(шаг) ← `fl_trampoline`. Интерпретатор — сам батут, и каждый его виток
 * складывал в арену новую обстановку.
 *
 * ── Довод законности ───────────────────────────────────────────────────────
 * Тот же, что у свёртки, и виден он прямо в цикле ниже. После отскока живы РОВНО
 * `bounce.args`: значения flang неизменяемы, замыканий нет, ссылок наружу нет, а
 * `buffer` перед откатом уже переписан отскоком. Входные `args` вызывающего
 * лежат НИЖЕ отметки, снятой на входе в батут, и откат их не трогает. `*result`
 * на витке с отскоком не читает никто: значение отдаёт тот шаг, который отскока
 * не поставил, и после него отката уже нет.
 *
 * Отметка своя, а не обёрточная: обёртке её не передать, не поменяв подписи
 * батута у всех 144 компонент. Вложенность безобидна — `fl_region_open`
 * запоминает границу объемлющей области и возвращает её `fl_region_close`,
 * который здесь стоит на КАЖДОМ выходе, включая отказ (на отказе он не трогает
 * арену: текст диагностики лежит выше отметки).
 *
 * Бюджет витка — тот же `FL_REGION_LOOP_GAIN`, и по той же причине: хвостовая
 * рекурсия, накапливающая список через «добавить», обязана отказаться от отката,
 * иначе она потеряет хвостовой запас и выродится в копию на каждом витке.
 *
 * ── ЛЕСТНИЦА ПОРОГА, И ОНА ЗАМЕРЕНА, А НЕ ПРИДУМАНА ────────────────────────
 * Первая редакция звала откат на КАЖДОМ витке, как это делает свёртка. Замер
 * той редакции (10 000 витков интерпретатором, 1 830 171 отскок): память
 * 0,80 ГиБ → 0,0084 ГиБ, а время 2,9 с → 20,4 с, то есть в семь раз дороже.
 * Счётчик показал, куда ушло: обмер обошёл 2 578 225 252 узла на 1 820 650
 * переложенных, — 1 400 узлов обмера на один отскок.
 *
 * Причина видна из устройства обмера: он бросает счёт, когда живое перерастает
 * бюджет (наросшее/16), НО наросшее после неудачи никуда не девается, и
 * следующий виток мерит то же самое ещё раз. Пока живое больше бюджета, обмер
 * повторяется на каждом отскоке и каждый раз доходит до бюджета.
 *
 * Поэтому порог ходит лестницей: промах — вдвое выше, попадание — вдвое ниже
 * сработавшего. Тогда обмер идёт геометрически редко, а порог сам садится туда,
 * где откат окупается (наросшее ≈ 16 × живое), — без единой новой постоянной.
 */
fl_status fl_trampoline(fl_ctx *ctx, fl_step step, const fl_value *args, size_t count, const char *function,
                        fl_value *result, fl_error *error) {
  fl_arena *arena = ctx == NULL ? NULL : ctx->arena;
  fl_bounce bounce;
  fl_value buffer[FL_MAX_TAIL_ARGS];
  fl_value carried = fl_nothing();
  fl_mark mark;
  fl_status status = FL_OK;
  size_t index = 0;
  size_t grown = 0;
  size_t before = 0;
  /* Когда пробовать откат в следующий раз; про лестницу — над функцией. */
  size_t porog = (size_t)FL_REGION_MIN;
  for (index = 0; index < FL_MAX_TAIL_ARGS; index += 1) {
    buffer[index] = index < count ? args[index] : fl_nothing();
  }
  mark = fl_region_open(ctx);
  for (;;) {
    bounce.next = NULL;
    for (index = 0; index < FL_MAX_TAIL_ARGS; index += 1) {
      bounce.args[index] = fl_nothing();
    }
    status = step(ctx, buffer, &bounce, result, error);
    if (status != FL_OK || bounce.next == NULL) {
      break;
    }
    /* Отскок — виток: «Чётное»/«Нечётное» друг на друге идут в постоянной
       глубине, и без этого счётчика незавершающаяся пара крутилась бы вечно. */
    status = fl_tick(ctx, function, error);
    if (status != FL_OK) {
      break;
    }
    step = bounce.next;
    for (index = 0; index < FL_MAX_TAIL_ARGS; index += 1) {
      buffer[index] = bounce.args[index];
    }
    if (arena == NULL) {
      continue;
    }
    grown = arena->handed - mark.handed;
    if (grown < porog) {
      continue;
    }
    /*
     * Доводы витка перекладываются ОДНИМ значением: список поверх `buffer` без
     * единого выделения — обмер и перекладка читают его как всякий список, а
     * лежит он на стеке, то есть переживает откат по построению.
     */
    before = arena->handed;
    carried = fl_list(buffer, FL_MAX_TAIL_ARGS);
    status = fl_region_recycle(ctx, mark, &carried, error);
    if (status != FL_OK) {
      break;
    }
    if (arena->handed < before) {
      /* Откат состоялся: доводы теперь лежат копией, её и берём. Порог вниз —
         вдвое ниже сработавшего, чтобы следующий цикл нашёл своё место за один
         промах, а не за всю лестницу снизу. */
      if (carried.tag == FL_LIST && carried.as.list.count == FL_MAX_TAIL_ARGS) {
        for (index = 0; index < FL_MAX_TAIL_ARGS; index += 1) {
          buffer[index] = carried.as.list.items[index];
        }
      }
      porog = grown / 2 < (size_t)FL_REGION_MIN ? (size_t)FL_REGION_MIN : grown / 2;
    } else {
      /* Область отказалась: живого больше бюджета. Пробовать на следующем витке
         снова значит платить обмером за тот же отказ — порог вверх вдвое. */
      porog = grown > ((size_t)-1) / 2 ? (size_t)-1 : grown * 2;
    }
  }
  return fl_region_close(ctx, mark, status, result, error);
}
