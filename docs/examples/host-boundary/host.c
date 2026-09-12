/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/*
 * ХОЗЯИН. Здесь лежит ровно то, чего на flang написать нельзя.
 *
 * ГРАНИЦА ПРОХОДИТ МЕЖДУ «РЕШАЕТ» И «ЖДЁТ» (ADR-0008, docs/adr/layer-boundary.md).
 * Не между «завершается» и «не завершается»: функция без пометки «тотальная»
 * проходит проверку с кодом 0, и бесконечный цикл язык не запрещает — он
 * запрещает лгать о завершении. Поэтому цикл ниже стоит на C не потому, что
 * он бесконечный, а потому, что он ЖДЁТ.
 *
 * Всё содержимое этого файла — по одну сторону границы, и делится на три части:
 *
 *   1. ОЖИДАНИЕ. `fgets` ждёт строку. Слова для ожидания в языке нет ни
 *      одного: ждёт хозяин, а программа получает результат ожидания доводом.
 *
 *   2. УПРАВЛЕНИЕ МЕЖДУ ДВУМЯ РЕШЕНИЯМИ. Между двумя вызовами управление
 *      обязано выйти наружу: звать хозяина по имени программа не может,
 *      доступа к миру у неё нет. Поэтому цикл принадлежит хозяину.
 *
 *   3. ИЗМЕНЯЕМОЕ СОСТОЯНИЕ И ВЫВОД. `struct gate` живёт между витками,
 *      `printf` печатает. У flang изменяемых значений нет: состояние приезжает
 *      в функцию доводом и уезжает результатом.
 *
 * Решений здесь нет ни одного. Кого пропустить, кому отказать, с каким кодом
 * и что станет с запасом — решает gatekeeper.flang, и каждое из этих решений
 * доказано. Хозяин строит событие, зовёт «Шаг привратника» и исполняет ответ.
 *
 * Собирается и запускается через run.sh; отдельного main у напечатанного кода
 * нет — печать позвана с ключом «--no-cli» именно ради этого.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "privratnik.h"

#define ZAPROS "запрос "

/* Состояние живёт у хозяина. Поля названы так же, как поля записи «Врата». */
struct gate {
  double budget;   /* «запас» */
  double capacity; /* «ёмкость» */
  double level;    /* «уровень» */
  double passed;   /* «пропущено» */
  double refused;  /* «отказано» */
};

static int number_field(fl_ctx *ctx, fl_value record, const char *name, double *out,
                        fl_error *error) {
  fl_value field = fl_nothing();
  if (fl_field_get(ctx, record, name, &field, error) != FL_OK) {
    return 0;
  }
  if (field.tag != FL_NUMBER) {
    return 0;
  }
  *out = field.as.number;
  return 1;
}

static int flag_field(fl_ctx *ctx, fl_value record, const char *name, int *out,
                      fl_error *error) {
  fl_value field = fl_nothing();
  if (fl_field_get(ctx, record, name, &field, error) != FL_OK) {
    return 0;
  }
  if (field.tag != FL_FLAG) {
    return 0;
  }
  *out = field.as.flag ? 1 : 0;
  return 1;
}

/*
 * ОДИН ВИТОК: событие → решение → исполнение.
 *
 * Зовётся `privratnik_enter`, а НЕ `privratnik_call`. Разница объявлена в
 * напечатанном заголовке и она здесь по существу: значения пришли снаружи, от
 * человека со стандартного ввода, и объявленные типы обязаны быть сверены до
 * вызова. Доказательство завершения стоит на типе и вместе с типом теряется.
 */
static int one_turn(fl_ctx *ctx, struct gate *state, fl_value event, double *code,
                    int *pass, fl_error *error) {
  fl_value args[2];
  fl_value gate = fl_nothing();
  fl_value decision = fl_nothing();
  fl_value inner = fl_nothing();

  if (privratnik_sozdat_vrata(ctx, fl_number(state->budget), fl_number(state->capacity),
                              fl_number(state->level), fl_number(state->passed),
                              fl_number(state->refused), &gate, error) != FL_OK) {
    return 0;
  }
  args[0] = gate;
  args[1] = event;
  if (privratnik_enter(ctx, "Шаг привратника", args, 2, &decision, error) != FL_OK) {
    return 0;
  }

  if (fl_field_get(ctx, decision, "врата", &inner, error) != FL_OK) {
    return 0;
  }
  if (!number_field(ctx, inner, "запас", &state->budget, error) ||
      !number_field(ctx, inner, "ёмкость", &state->capacity, error) ||
      !number_field(ctx, inner, "уровень", &state->level, error) ||
      !number_field(ctx, inner, "пропущено", &state->passed, error) ||
      !number_field(ctx, inner, "отказано", &state->refused, error) ||
      !number_field(ctx, decision, "код", code, error) ||
      !flag_field(ctx, decision, "пропустить", pass, error)) {
    return 0;
  }
  return 1;
}

int main(void) {
  fl_arena arena;
  fl_ctx ctx;
  fl_error error;
  struct gate state;
  char line[256];
  long turns = 0;

  state.budget = 0.0;
  state.capacity = 3.0;
  state.level = 2.0;
  state.passed = 0.0;
  state.refused = 0.0;

  fl_arena_init(&arena);
  fl_ctx_init(&ctx, &arena);

  printf("хозяин: врата открыты. ёмкость %g, уровень ключа %g, запас %g\n", state.capacity,
         state.level, state.budget);
  printf("хозяин: жду событий на стандартном вводе: «такт» или «запрос N»\n");

  /* ─────────────────────────────────────────────────────────────────────────
   * ВОТ ОН — цикл, которого на flang не написать. Не из-за того, что у него
   * нет убывающей меры (нетотальные функции язык принимает), а из-за одной
   * строки внутри: `fgets` ЖДЁТ. Ждать язык не умеет ничем.
   * ───────────────────────────────────────────────────────────────────────── */
  for (;;) {
    fl_value event = fl_nothing();
    double code = 0.0;
    int pass = 0;
    double need = 0.0;
    char *tail = NULL;

    if (fgets(line, sizeof line, stdin) == NULL) {
      break; /* мир сказал, что событий больше не будет */
    }
    /* Строка дождана. Дальше до конца витка ничего не ждёт никто. */
    line[strcspn(line, "\r\n")] = '\0';
    if (line[0] == '\0') {
      continue;
    }
    turns += 1;

    if (strcmp(line, "такт") == 0) {
      if (privratnik_variant_takt(&ctx, &event, &error) != FL_OK) {
        fprintf(stderr, "хозяин: %s: %s\n", error.code, error.message);
        return 1;
      }
    } else if (strncmp(line, ZAPROS, sizeof ZAPROS - 1) == 0) {
      /* Байт, а не букв: «запрос » — это семь букв и тринадцать байт UTF-8.
         Считать буквы здесь незачем, а `sizeof` не даёт ошибиться. */
      need = strtod(line + sizeof ZAPROS - 1, &tail);
      if (tail == line + sizeof ZAPROS - 1) {
        printf("хозяин: не понял событие «%s»\n", line);
        continue;
      }
      if (privratnik_variant_zapros(&ctx, fl_number(need), &event, &error) != FL_OK) {
        fprintf(stderr, "хозяин: %s: %s\n", error.code, error.message);
        return 1;
      }
    } else {
      printf("хозяин: не понял событие «%s»\n", line);
      continue;
    }

    if (!one_turn(&ctx, &state, event, &code, &pass, &error)) {
      printf("граница отвергла довод: %s — %s\n", error.code, error.message);
    } else if (strcmp(line, "такт") == 0) {
      printf("такт     → запас %g из %g\n", state.budget, state.capacity);
    } else {
      /* Ширину поля здесь не ставим: printf считает БАЙТЫ, а не буквы, и на
         кириллице выравнивание получилось бы разным у разных строк. */
      printf("%s → код %g, %s, запас %g, пропущено %g, отказано %g\n", line, code,
             pass ? "пропущен" : "ОТКАЗАНО", state.budget, state.passed, state.refused);
    }

    /* Арена отдаётся целиком каждый виток: всё, что построил flang, уже
       переписано в состояние хозяина. Поэтому за витками память не растёт. */
    fl_arena_reset(&arena);
    fl_ctx_init(&ctx, &arena);
  }

  printf("хозяин: событий %ld, пропущено %g, отказано %g\n", turns, state.passed,
         state.refused);

  /* ───────────────────────────────────────────────────────────────────────
   * КРАЙ. Предусловие «запас не выше ёмкости» — это и есть договор границы.
   * Хозяин нарушает его нарочно, чтобы видно было: проверка стоит, отказ
   * приезжает значением, программа не падает и цикл не рушится.
   * ─────────────────────────────────────────────────────────────────────── */
  {
    fl_value event = fl_nothing();
    double code = 0.0;
    int pass = 0;
    state.budget = state.capacity + 1.0;
    printf("хозяин: нарочно порчу довод — запас %g при ёмкости %g\n", state.budget,
           state.capacity);
    if (privratnik_variant_zapros(&ctx, fl_number(1.0), &event, &error) != FL_OK) {
      fprintf(stderr, "хозяин: %s: %s\n", error.code, error.message);
      return 1;
    }
    if (!one_turn(&ctx, &state, event, &code, &pass, &error)) {
      printf("граница отвергла довод: %s — %s\n", error.code, error.message);
    } else {
      printf("граница пропустила порченый довод: код %g\n", code);
    }
  }

  fl_arena_release(&arena);
  return 0;
}
