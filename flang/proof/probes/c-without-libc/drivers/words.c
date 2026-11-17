/*
 * Водитель сличения: зовёт функции programs/words.flang, сгенерированные в C без
 * libc, на тысяче входов каждую и пишет два файла:
 *
 *   words <запросы> <ответы>
 *
 * «запросы» — строки для прогонщика обычного сгенерированного C (flang_cli --json),
 * «ответы» — то, что ответил код без libc, в том же виде, в каком отвечает
 * прогонщик (у ошибки — только код, без слов). Файлы сравнивает Makefile.
 *
 * Входы одни и те же при каждом запуске: сначала сетка границ (0, 1, ширина−1,
 * ширина, 2^w−1, 2^w−2, половина), потом псевдослучайные.
 */
#include <inttypes.h>
#include <stdio.h>

#include "words.h"

#define CASES 1000

static FILE *requests;
static FILE *answers;
static uint64_t seed = UINT64_C(0x9E3779B97F4A7C15);

static uint64_t roll(void) {
  seed ^= seed >> 12;
  seed ^= seed << 25;
  seed ^= seed >> 27;
  return seed * UINT64_C(0x2545F4914F6CDD1D);
}

static const uint64_t EDGES[] = {
    0,
    1,
    2,
    3,
    7,
    8,
    15,
    16,
    31,
    32,
    63,
    64,
    127,
    128,
    254,
    255,
    256,
    65534,
    65535,
    65536,
    UINT64_C(0x7FFFFFFF),
    UINT64_C(0x80000000),
    UINT64_C(0xFFFFFFFE),
    UINT64_C(0xFFFFFFFF),
    UINT64_C(0x100000000),
    UINT64_C(0x7FFFFFFFFFFFFFFF),
    UINT64_C(0x8000000000000000),
    UINT64_C(0xFFFFFFFFFFFFFFFE),
    UINT64_C(0xFFFFFFFFFFFFFFFF),
};
#define EDGE_COUNT (sizeof(EDGES) / sizeof(EDGES[0]))

static const uint64_t SHIFTS[] = {0, 1, 7, 8, 15, 16, 31, 32, 63, 64, 65, 255};
#define SHIFT_COUNT (sizeof(SHIFTS) / sizeof(SHIFTS[0]))

static const int64_t NUMBERS[] = {
    0,
    1,
    -1,
    255,
    256,
    65535,
    65536,
    INT64_C(4294967295),
    INT64_C(4294967296),
    INT64_C(9007199254740991),
    INT64_C(-9007199254740991),
};
#define NUMBER_COUNT (sizeof(NUMBERS) / sizeof(NUMBERS[0]))

static uint64_t fit(int width, uint64_t value) {
  return width == 64 ? value : value & ((UINT64_C(1) << width) - 1);
}

/* Слово ширины width для входа номер index; slot — который это аргумент. */
static uint64_t word(int width, int index, int slot) {
  if ((size_t)index < EDGE_COUNT * EDGE_COUNT) {
    size_t at = slot == 0 ? (size_t)index % EDGE_COUNT : (size_t)index / EDGE_COUNT;
    return fit(width, EDGES[at]);
  }
  return fit(width, roll() >> (roll() % 64));
}

static uint8_t amount(int index) {
  if ((size_t)index < EDGE_COUNT * SHIFT_COUNT) {
    return (uint8_t)SHIFTS[(size_t)index / EDGE_COUNT];
  }
  return (uint8_t)(roll() % 72);
}

static int64_t number(int index) {
  if ((size_t)index < NUMBER_COUNT) {
    return NUMBERS[index];
  }
  return (int64_t)(roll() % (UINT64_C(1) << 41)) - (INT64_C(1) << 40);
}

static void ask(const char *name) {
  fprintf(requests, "{\"fn\":\"%s\",\"args\":[", name);
}

static void ask_word(int width, uint64_t value, int last) {
  fprintf(requests, width == 64 ? "{\"s\":\"%" PRIu64 "\"}" : "{\"n\":\"%" PRIu64 "\"}", value);
  fputs(last ? "]}\n" : ",", requests);
}

static void ask_number(int64_t value, int last) {
  fprintf(requests, "{\"n\":\"%" PRId64 "\"}", value);
  fputs(last ? "]}\n" : ",", requests);
}

static void say_word(int width, uint64_t value) {
  fprintf(answers, "{\"ok\":true,\"value\":{\"w\":\"u%d\",\"v\":\"%" PRIu64 "\"}}\n", width, value);
}

static void say_number(int64_t value) {
  fprintf(answers, "{\"ok\":true,\"value\":{\"n\":\"%" PRId64 "\"}}\n", value);
}

static void say_flag(bool value) {
  fprintf(answers, "{\"ok\":true,\"value\":%s}\n", value ? "true" : "false");
}

/* Код ошибки тем словом, каким о том же говорит обычный сгенерированный C. */
static void say_refusal(fl_fs_status status) {
  const char *code = "FLANG_FREESTANDING_ONLY";
  if (status == FL_FS_OVERFLOW || status == FL_FS_DIVIDE_BY_ZERO) {
    code = "FLANG_OVERFLOW";
  } else if (status == FL_FS_SHIFT) {
    code = "FLANG_BUILTIN_ARGS";
  } else if (status == FL_FS_PRECONDITION) {
    code = "FLANG_PRECONDITION";
  }
  fprintf(answers, "{\"ok\":false,\"code\":\"%s\"}\n", code);
}

#define EACH for (int i = 0; i < CASES; i += 1)

#define TWO_CHECKED(RU, C, W) \
  EACH { \
    uint##W##_t a = (uint##W##_t)word(W, i, 0), b = (uint##W##_t)word(W, i, 1), out = 0; \
    fl_fs_status status = slova_bez_libc_##C##_##W(a, b, &out); \
    ask(RU " " #W); \
    ask_word(W, a, 0); \
    ask_word(W, b, 1); \
    if (status != FL_FS_OK) say_refusal(status); \
    else say_word(W, out); \
  }

#define TWO_DIRECT(RU, C, W) \
  EACH { \
    uint##W##_t a = (uint##W##_t)word(W, i, 0), b = (uint##W##_t)word(W, i, 1); \
    ask(RU " " #W); \
    ask_word(W, a, 0); \
    ask_word(W, b, 1); \
    say_word(W, slova_bez_libc_##C##_##W(a, b)); \
  }

#define TWO_FLAG(RU, C, W) \
  EACH { \
    uint##W##_t a = (uint##W##_t)word(W, i, 0), b = (uint##W##_t)word(W, i, 1); \
    ask(RU " " #W); \
    ask_word(W, a, 0); \
    ask_word(W, b, 1); \
    say_flag(slova_bez_libc_##C##_##W(a, b)); \
  }

#define ONE_DIRECT(RU, C, W) \
  EACH { \
    uint##W##_t a = (uint##W##_t)word(W, i, 0); \
    ask(RU " " #W); \
    ask_word(W, a, 1); \
    say_word(W, slova_bez_libc_##C##_##W(a)); \
  }

#define SHIFT_CHECKED(RU, C, W) \
  EACH { \
    uint##W##_t a = (uint##W##_t)word(W, i, 0), out = 0; \
    uint8_t n = amount(i); \
    fl_fs_status status = slova_bez_libc_##C##_##W(a, n, &out); \
    ask(RU " " #W); \
    ask_word(W, a, 0); \
    ask_word(8, n, 1); \
    if (status != FL_FS_OK) say_refusal(status); \
    else say_word(W, out); \
  }

#define SHIFT_DIRECT(RU, C, W) \
  EACH { \
    uint##W##_t a = (uint##W##_t)word(W, i, 0); \
    uint8_t n = amount(i); \
    ask(RU " " #W); \
    ask_word(W, a, 0); \
    ask_word(8, n, 1); \
    say_word(W, slova_bez_libc_##C##_##W(a, n)); \
  }

#define FROM_NUMBER(W) \
  EACH { \
    int64_t v = number(i); \
    uint##W##_t out = 0; \
    fl_fs_status status = slova_bez_libc_iz_chisla_##W(v, &out); \
    ask("Из числа " #W); \
    ask_number(v, 1); \
    if (status != FL_FS_OK) say_refusal(status); \
    else say_word(W, out); \
  }

#define WIDER(FROM, TO) \
  EACH { \
    uint##FROM##_t a = (uint##FROM##_t)word(FROM, i, 0); \
    ask("Из " #FROM " в " #TO); \
    ask_word(FROM, a, 1); \
    say_word(TO, slova_bez_libc_iz_##FROM##_v_##TO(a)); \
  }

#define NARROWER(FROM, TO) \
  EACH { \
    uint##FROM##_t a = (uint##FROM##_t)word(FROM, i, 0); \
    uint##TO##_t out = 0; \
    fl_fs_status status = slova_bez_libc_iz_##FROM##_v_##TO(a, &out); \
    ask("Из " #FROM " в " #TO); \
    ask_word(FROM, a, 1); \
    if (status != FL_FS_OK) say_refusal(status); \
    else say_word(TO, out); \
  }

#define WIDTH(W) \
  TWO_CHECKED("Сложить", slozhit, W) \
  TWO_CHECKED("Вычесть", vychest, W) \
  TWO_CHECKED("Умножить", umnozhit, W) \
  TWO_DIRECT("Сложить по модулю", slozhit_po_modulyu, W) \
  TWO_DIRECT("Вычесть по модулю", vychest_po_modulyu, W) \
  TWO_DIRECT("Умножить по модулю", umnozhit_po_modulyu, W) \
  TWO_CHECKED("Поделить", podelit, W) \
  TWO_CHECKED("Остаток", ostatok, W) \
  TWO_DIRECT("И", i, W) \
  TWO_DIRECT("Или", ili, W) \
  TWO_DIRECT("Исключающее", isklyuchayuschee, W) \
  ONE_DIRECT("Не", ne, W) \
  SHIFT_CHECKED("Влево", vlevo, W) \
  SHIFT_CHECKED("Вправо", vpravo, W) \
  SHIFT_DIRECT("Повернуть влево", povernut_vlevo, W) \
  SHIFT_DIRECT("Повернуть вправо", povernut_vpravo, W) \
  ONE_DIRECT("Влево на ноль", vlevo_na_nol, W) \
  ONE_DIRECT("Вправо на ноль", vpravo_na_nol, W) \
  ONE_DIRECT("Влево на край", vlevo_na_kray, W) \
  ONE_DIRECT("Вправо на край", vpravo_na_kray, W) \
  ONE_DIRECT("Повернуть на семь", povernut_na_sem, W) \
  TWO_FLAG("Меньше", menshe, W) \
  TWO_FLAG("Не больше", ne_bolshe, W) \
  TWO_FLAG("Равны", ravny, W) \
  TWO_CHECKED("Разность", raznost, W) \
  TWO_DIRECT("Смесь", smes, W) \
  FROM_NUMBER(W)

static void numbers_of_words(void) {
  EACH {
    uint8_t a = (uint8_t)word(8, i, 0);
    ask("Числом 8");
    ask_word(8, a, 1);
    say_number(slova_bez_libc_chislom_8(a));
  }
  EACH {
    uint16_t a = (uint16_t)word(16, i, 0);
    ask("Числом 16");
    ask_word(16, a, 1);
    say_number(slova_bez_libc_chislom_16(a));
  }
  EACH {
    uint32_t a = (uint32_t)word(32, i, 0);
    ask("Числом 32");
    ask_word(32, a, 1);
    say_number(slova_bez_libc_chislom_32(a));
  }
  EACH {
    uint64_t a = word(64, i, 0);
    int64_t out = 0;
    fl_fs_status status = slova_bez_libc_chislom_64(a, &out);
    ask("Числом 64");
    ask_word(64, a, 1);
    if (status != FL_FS_OK) say_refusal(status);
    else say_number(out);
  }
}

static void records_and_cases(void) {
  EACH {
    uint8_t code = (uint8_t)(i < 96 ? (uint64_t)(i % 48) : roll() % 256);
    uint32_t value = (uint32_t)word(32, i, 0);
    uint8_t flags = (uint8_t)word(8, i, 1);
    slova_bez_libc_registr_t out;
    uint32_t alone = 0;
    fl_fs_status status = slova_bez_libc_shag(code, value, flags, &out);
    ask("Шаг");
    ask_word(8, code, 0);
    ask_word(32, value, 0);
    ask_word(8, flags, 1);
    if (status != FL_FS_OK) {
      say_refusal(status);
    } else {
      fprintf(answers,
              "{\"ok\":true,\"value\":{\"r\":[[\"значение\",{\"w\":\"u32\",\"v\":\"%" PRIu32
              "\"}],[\"флаги\",{\"w\":\"u8\",\"v\":\"%u\"}]]}}\n",
              out.znachenie, (unsigned)out.flagi);
    }
    status = slova_bez_libc_znachenie_shaga(code, value, flags, &alone);
    ask("Значение шага");
    ask_word(8, code, 0);
    ask_word(32, value, 0);
    ask_word(8, flags, 1);
    if (status != FL_FS_OK) say_refusal(status);
    else say_word(32, alone);
  }
}

static void plain_numbers(void) {
  EACH {
    int64_t index = i % 21;
    int64_t out = 0;
    fl_fs_status status = slova_bez_libc_sleduyuschiy_v_kolce(index, &out);
    ask("Следующий в кольце");
    ask_number(index, 1);
    if (status != FL_FS_OK) say_refusal(status);
    else say_number(out);
    status = slova_bez_libc_po_modulyu_kolca(index, &out);
    ask("По модулю кольца");
    ask_number(index, 1);
    if (status != FL_FS_OK) say_refusal(status);
    else say_number(out);
  }
  EACH {
    int64_t a = (int64_t)(roll() % 2000001) - 1000000;
    int64_t b = (int64_t)(roll() % 2000001) - 1000000;
    int64_t out = 0;
    fl_fs_status status = slova_bez_libc_schyot(a, b, &out);
    ask("Счёт");
    ask_number(a, 0);
    ask_number(b, 1);
    if (status != FL_FS_OK) say_refusal(status);
    else say_number(out);
  }
}

int main(int argc, char **argv) {
  if (argc != 3) {
    fputs("words <запросы> <ответы>\n", stderr);
    return 2;
  }
  requests = fopen(argv[1], "wb");
  answers = fopen(argv[2], "wb");
  if (requests == NULL || answers == NULL) {
    fputs("words: не открываются файлы вывода\n", stderr);
    return 2;
  }
  WIDTH(8)
  WIDTH(16)
  WIDTH(32)
  WIDTH(64)
  WIDER(8, 16)
  WIDER(8, 32)
  WIDER(8, 64)
  WIDER(16, 32)
  WIDER(16, 64)
  WIDER(32, 64)
  NARROWER(16, 8)
  NARROWER(32, 8)
  NARROWER(32, 16)
  NARROWER(64, 8)
  NARROWER(64, 16)
  NARROWER(64, 32)
  numbers_of_words();
  records_and_cases();
  plain_numbers();
  return fclose(requests) != 0 || fclose(answers) != 0;
}
