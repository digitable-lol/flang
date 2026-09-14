/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/* СЛИЧИТЕЛЬ ПЕРЕВОДА В C (ADR-0030, задача 1401).
 *
 *   matcher <исходник.flang> <напечатанный.c> <протокол>
 *   код 0 — СОШЛОСЬ; 3 — НЕ ПРОВЕРЕНО, названо что; 1 — НЕ СОШЛОСЬ, названо
 *   где; 2 — кривой вызов.
 *
 * Печатник flang доказывает не себя, а КАЖДЫЙ СВОЙ ЗАПУСК: рядом с C он кладёт
 * протокол перевода — какой узел исходника каким правилом из закрытого списка
 * (PRINT-RULES.tsv рядом) стал какими строками C. Эта программа берёт три
 * файла и переигрывает протокол сличением текста. Печатника она не видит,
 * flang не разбирает и ни одного узла сама не переводит: всё, что она знает о
 * языке, — где в строке исходника стоит слово узла и какой формы строки C даёт
 * каждое правило. Один файл C99, ни одной библиотеки кроме libc.
 */
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* ── общее: файл целиком, строки, отказ ───────────────────────────────────── */

typedef struct {
  const char *text;
  size_t len;
} span_t;

static char *slurp(const char *path, size_t *len) {
  FILE *h = fopen(path, "rb");
  char *buf = NULL;
  size_t cap = 0, n = 0, got = 0;
  if (h == NULL) return NULL;
  for (;;) {
    if (n + 4096 + 1 > cap) {
      char *grown;
      cap = cap == 0 ? 65536 : cap * 2;
      grown = realloc(buf, cap);
      if (grown == NULL) {
        free(buf);
        fclose(h);
        return NULL;
      }
      buf = grown;
    }
    got = fread(buf + n, 1, 4096, h);
    n += got;
    if (got < 4096) break;
  }
  fclose(h);
  buf[n] = '\0';
  *len = n;
  return buf;
}

typedef struct {
  span_t *items;
  size_t count;
} lines_t;

/* Строки без перевода; последняя строка без '\n' тоже строка. */
static lines_t split_lines(const char *text, size_t len) {
  lines_t out;
  size_t cap = 1024, start = 0, i;
  out.items = malloc(cap * sizeof *out.items);
  out.count = 0;
  for (i = 0; i <= len; i += 1) {
    if (i == len || text[i] == '\n') {
      if (i == len && start == len) break;
      if (out.count == cap) {
        cap *= 2;
        out.items = realloc(out.items, cap * sizeof *out.items);
      }
      out.items[out.count].text = text + start;
      out.items[out.count].len = i - start;
      out.count += 1;
      start = i + 1;
    }
  }
  return out;
}

static int verdict_failed = 0;

static void mismatch(const char *where, const char *fmt, ...) {
  va_list ap;
  printf("НЕ СОШЛОСЬ: %s: ", where);
  va_start(ap, fmt);
  vprintf(fmt, ap);
  va_end(ap);
  printf("\n");
  verdict_failed = 1;
}

/* ── SHA-256 (FIPS 180-4) ─────────────────────────────────────────────────── */

typedef struct {
  unsigned long h[8];
  unsigned char block[64];
  size_t fill;
  unsigned long long total;
} sha256_t;

static const unsigned long SHA_K[64] = {
    0x428a2f98UL, 0x71374491UL, 0xb5c0fbcfUL, 0xe9b5dba5UL, 0x3956c25bUL, 0x59f111f1UL, 0x923f82a4UL,
    0xab1c5ed5UL, 0xd807aa98UL, 0x12835b01UL, 0x243185beUL, 0x550c7dc3UL, 0x72be5d74UL, 0x80deb1feUL,
    0x9bdc06a7UL, 0xc19bf174UL, 0xe49b69c1UL, 0xefbe4786UL, 0x0fc19dc6UL, 0x240ca1ccUL, 0x2de92c6fUL,
    0x4a7484aaUL, 0x5cb0a9dcUL, 0x76f988daUL, 0x983e5152UL, 0xa831c66dUL, 0xb00327c8UL, 0xbf597fc7UL,
    0xc6e00bf3UL, 0xd5a79147UL, 0x06ca6351UL, 0x14292967UL, 0x27b70a85UL, 0x2e1b2138UL, 0x4d2c6dfcUL,
    0x53380d13UL, 0x650a7354UL, 0x766a0abbUL, 0x81c2c92eUL, 0x92722c85UL, 0xa2bfe8a1UL, 0xa81a664bUL,
    0xc24b8b70UL, 0xc76c51a3UL, 0xd192e819UL, 0xd6990624UL, 0xf40e3585UL, 0x106aa070UL, 0x19a4c116UL,
    0x1e376c08UL, 0x2748774cUL, 0x34b0bcb5UL, 0x391c0cb3UL, 0x4ed8aa4aUL, 0x5b9cca4fUL, 0x682e6ff3UL,
    0x748f82eeUL, 0x78a5636fUL, 0x84c87814UL, 0x8cc70208UL, 0x90befffaUL, 0xa4506cebUL, 0xbef9a3f7UL,
    0xc67178f2UL};

#define ROTR(x, n) ((((x) >> (n)) | ((x) << (32 - (n)))) & 0xffffffffUL)

static void sha256_block(sha256_t *s, const unsigned char *p) {
  unsigned long w[64], a, b, c, d, e, f, g, h, t1, t2;
  int i;
  for (i = 0; i < 16; i += 1) {
    w[i] = ((unsigned long)p[4 * i] << 24) | ((unsigned long)p[4 * i + 1] << 16) |
           ((unsigned long)p[4 * i + 2] << 8) | (unsigned long)p[4 * i + 3];
  }
  for (i = 16; i < 64; i += 1) {
    unsigned long s0 = ROTR(w[i - 15], 7) ^ ROTR(w[i - 15], 18) ^ (w[i - 15] >> 3);
    unsigned long s1 = ROTR(w[i - 2], 17) ^ ROTR(w[i - 2], 19) ^ (w[i - 2] >> 10);
    w[i] = (w[i - 16] + s0 + w[i - 7] + s1) & 0xffffffffUL;
  }
  a = s->h[0]; b = s->h[1]; c = s->h[2]; d = s->h[3];
  e = s->h[4]; f = s->h[5]; g = s->h[6]; h = s->h[7];
  for (i = 0; i < 64; i += 1) {
    t1 = (h + (ROTR(e, 6) ^ ROTR(e, 11) ^ ROTR(e, 25)) + ((e & f) ^ (~e & g)) + SHA_K[i] + w[i]) & 0xffffffffUL;
    t2 = ((ROTR(a, 2) ^ ROTR(a, 13) ^ ROTR(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) & 0xffffffffUL;
    h = g; g = f; f = e; e = (d + t1) & 0xffffffffUL;
    d = c; c = b; b = a; a = (t1 + t2) & 0xffffffffUL;
  }
  s->h[0] = (s->h[0] + a) & 0xffffffffUL; s->h[1] = (s->h[1] + b) & 0xffffffffUL;
  s->h[2] = (s->h[2] + c) & 0xffffffffUL; s->h[3] = (s->h[3] + d) & 0xffffffffUL;
  s->h[4] = (s->h[4] + e) & 0xffffffffUL; s->h[5] = (s->h[5] + f) & 0xffffffffUL;
  s->h[6] = (s->h[6] + g) & 0xffffffffUL; s->h[7] = (s->h[7] + h) & 0xffffffffUL;
}

static void sha256_hex(const unsigned char *data, size_t len, char out[65]) {
  static const unsigned long init[8] = {0x6a09e667UL, 0xbb67ae85UL, 0x3c6ef372UL, 0xa54ff53aUL,
                                        0x510e527fUL, 0x9b05688cUL, 0x1f83d9abUL, 0x5be0cd19UL};
  sha256_t s;
  unsigned char tail[128];
  size_t i, rest, pad;
  unsigned long long bits = (unsigned long long)len * 8u;
  memcpy(s.h, init, sizeof init);
  for (i = 0; i + 64 <= len; i += 64) sha256_block(&s, data + i);
  rest = len - i;
  memcpy(tail, data + i, rest);
  tail[rest] = 0x80;
  pad = rest + 1 <= 56 ? 64 : 128;
  memset(tail + rest + 1, 0, pad - rest - 1);
  for (i = 0; i < 8; i += 1) tail[pad - 1 - i] = (unsigned char)(bits >> (8 * i));
  sha256_block(&s, tail);
  if (pad == 128) sha256_block(&s, tail + 64);
  for (i = 0; i < 8; i += 1) sprintf(out + 8 * i, "%08lx", s.h[i]);
  out[64] = '\0';
}

/* ── протокол: дерево узлов ───────────────────────────────────────────────────
 *
 * Форма (PRINT-RULES.tsv рядом, ADR-0030 §10): шапка из пяти строк, затем
 * узлы. Узел открывается строкой «узел <вид> строка L столбец C правило
 * «имя»[ дополнение]» или строкой блока («функция «Имя» …», «граница входа»,
 * «план», «диспетчер», «шапка модуля») и закрывается «конец узла». Внутри —
 * вложенные узлы и части «часть <метка> строк N» с N строками C как есть; у
 * узла выражения последней строкой стоит «значение <выражение C>».
 */

typedef struct node node_t;

typedef struct {
  int is_part;      /* 1 — часть текста, 0 — вложенный узел */
  const char *label; /* метка части */
  size_t label_len;
  const char *text; /* текст части (строки с переводами) */
  size_t text_len;
  node_t *child;
} item_t;

struct node {
  const char *head; /* строка открытия целиком */
  size_t head_len;
  int is_block;     /* 1 — строка блока, 0 — «узел …» */
  char kind[64];
  char rule[128];
  const char *extra; /* дополнение после «правило «…»» */
  size_t extra_len;
  long line, column;
  const char *value; /* «значение …»; NULL, если нет */
  size_t value_len;
  item_t *items;
  size_t count, cap;
  size_t proto_line; /* номер строки протокола, где узел открыт */
  node_t *parent;
};

typedef struct {
  char source[4096];
  char digest[65];
  char module[512];
  char file[512];
  int version;
  node_t root;
  size_t node_count;
} protocol_t;

static void push_item(node_t *n, item_t it) {
  if (n->count == n->cap) {
    n->cap = n->cap == 0 ? 8 : n->cap * 2;
    n->items = realloc(n->items, n->cap * sizeof *n->items);
  }
  n->items[n->count++] = it;
}

static int starts(span_t s, const char *prefix) {
  size_t k = strlen(prefix);
  return s.len >= k && memcmp(s.text, prefix, k) == 0;
}

static void copy_field(char *dst, size_t cap, const char *src, size_t len) {
  if (len >= cap) len = cap - 1;
  memcpy(dst, src, len);
  dst[len] = '\0';
}

/* «узел <вид> строка L столбец C правило «имя»[ дополнение]» */
static int parse_node_head(node_t *n, span_t s) {
  const char *p = s.text + strlen("узел "), *end = s.text + s.len, *q;
  const char *rule_open = "правило «", *close = "»";
  q = memchr(p, ' ', (size_t)(end - p));
  if (q == NULL) return 0;
  copy_field(n->kind, sizeof n->kind, p, (size_t)(q - p));
  if (sscanf(q, " строка %ld столбец %ld", &n->line, &n->column) != 2) return 0;
  p = strstr(q, rule_open);
  if (p == NULL || p >= end) return 0;
  p += strlen(rule_open);
  q = strstr(p, close);
  if (q == NULL || q >= end) return 0;
  copy_field(n->rule, sizeof n->rule, p, (size_t)(q - p));
  n->extra = q + strlen(close);
  n->extra_len = (size_t)(end - n->extra);
  return 1;
}

static int read_protocol(const char *text, size_t len, protocol_t *pr) {
  lines_t ls = split_lines(text, len);
  size_t i = 0;
  node_t *cur = &pr->root;
  char where[128];
  memset(pr, 0, sizeof *pr);
  pr->root.is_block = 1;
  copy_field(pr->root.kind, sizeof pr->root.kind, "файл", strlen("файл"));
  if (ls.count < 5 || sscanf(ls.items[0].text, "протокол перевода %d", &pr->version) != 1 || pr->version != 1) {
    mismatch("протокол, строка 1", "нет шапки «протокол перевода 1»");
    return 0;
  }
  for (i = 1; i < ls.count; i += 1) {
    span_t s = ls.items[i];
    snprintf(where, sizeof where, "протокол, строка %lu", (unsigned long)(i + 1));
    if (starts(s, "исходник ")) {
      copy_field(pr->source, sizeof pr->source, s.text + strlen("исходник "), s.len - strlen("исходник "));
    } else if (starts(s, "отпечаток256 ")) {
      copy_field(pr->digest, sizeof pr->digest, s.text + strlen("отпечаток256 "), s.len - strlen("отпечаток256 "));
    } else if (starts(s, "модуль ")) {
      copy_field(pr->module, sizeof pr->module, s.text + strlen("модуль "), s.len - strlen("модуль "));
    } else if (starts(s, "файл ")) {
      copy_field(pr->file, sizeof pr->file, s.text + strlen("файл "), s.len - strlen("файл "));
    } else {
      break;
    }
  }
  for (; i < ls.count; i += 1) {
    span_t s = ls.items[i];
    snprintf(where, sizeof where, "протокол, строка %lu", (unsigned long)(i + 1));
    if (starts(s, "часть ")) {
      item_t it;
      const char *sp;
      unsigned long n = 0;
      size_t k;
      memset(&it, 0, sizeof it);
      it.is_part = 1;
      it.label = s.text + strlen("часть ");
      sp = strstr(it.label, " строк ");
      if (sp == NULL || sp > s.text + s.len || sscanf(sp, " строк %lu", &n) != 1) {
        mismatch(where, "часть без числа строк");
        return 0;
      }
      it.label_len = (size_t)(sp - it.label);
      if (i + n >= ls.count) {
        mismatch(where, "часть обещает %lu строк, а протокол кончился", n);
        return 0;
      }
      it.text = n == 0 ? s.text + s.len : ls.items[i + 1].text;
      it.text_len = 0;
      for (k = 1; k <= n; k += 1) it.text_len = (size_t)(ls.items[i + k].text + ls.items[i + k].len + 1 - it.text);
      push_item(cur, it);
      i += n;
    } else if (starts(s, "значение ")) {
      cur->value = s.text + strlen("значение ");
      cur->value_len = s.len - strlen("значение ");
    } else if (starts(s, "конец узла") && s.len == strlen("конец узла")) {
      if (cur == &pr->root) {
        mismatch(where, "«конец узла» без открытого узла");
        return 0;
      }
      cur = cur->parent;
    } else if (starts(s, "конец протокола") && s.len == strlen("конец протокола")) {
      if (cur != &pr->root) {
        mismatch(where, "протокол кончился внутри узла, открытого на строке %lu", (unsigned long)cur->proto_line);
        return 0;
      }
      if (i + 1 != ls.count) {
        mismatch(where, "после «конец протокола» есть строки");
        return 0;
      }
      free(ls.items);
      return 1;
    } else {
      item_t it;
      node_t *n = calloc(1, sizeof *n);
      n->head = s.text;
      n->head_len = s.len;
      n->proto_line = i + 1;
      n->parent = cur;
      if (starts(s, "узел ")) {
        if (!parse_node_head(n, s)) {
          mismatch(where, "строка узла не по форме: %.*s", (int)s.len, s.text);
          return 0;
        }
      } else {
        const char *sp = memchr(s.text, ' ', s.len);
        n->is_block = 1;
        copy_field(n->kind, sizeof n->kind, s.text, sp == NULL ? s.len : (size_t)(sp - s.text));
        copy_field(n->rule, sizeof n->rule, s.text, s.len);
      }
      memset(&it, 0, sizeof it);
      it.child = n;
      push_item(cur, it);
      cur = n;
      pr->node_count += 1;
    }
  }
  mismatch("протокол", "нет строки «конец протокола» — протокол оборван");
  return 0;
}

/* ── закрытый список правил ───────────────────────────────────────────────────
 * Те же имена, что в первом столбце PRINT-RULES.tsv, в том же порядке; сходство
 * двух списков стережёт run.sh. Имя, которого здесь нет, — отказ.
 */
static const char *const RULES[] = {
    "литерал",
    "переменная",
    "поле",
    "пусть",
    "признак",
    "положить",
    "если",
    "разбор-значением",
    "разбор",
    "случай",
    "вызов",
    "форма",
    "операция-вызовом",
    "арифметика-числом",
    "сравнение-числом",
    "список",
    "запись",
    "конструктор",
    "свёртка",
    "отобразить",
    "отфильтровать",
    "все-элементы",
    "число-литерал",
    "число-арифметика",
    "число-распакованное",
    "хвост-значение",
    "хвост-пусть",
    "хвост-если",
    "хвост-возврат",
    "хвост-отскок",
    "хвост-цикл",
    "функция",
    "постусловие",
    "предусловие",
    "дверь",
    "диспетчер",
    "фабрика",
    "конструктор суммы",
    "граница входа",
    "план",
    "шапка модуля",
};
#define RULE_COUNT (sizeof RULES / sizeof RULES[0])

static int rule_index(const char *name) {
  size_t i;
  for (i = 0; i < RULE_COUNT; i += 1) {
    if (strcmp(RULES[i], name) == 0) return (int)i;
  }
  return -1;
}

/* ── текст C, собранный из протокола ──────────────────────────────────────────
 * Каждая часть протокола — кусок напечатанного C. Кусок помнит узел, который
 * его напечатал: так расхождение называется не только строкой C, но и местом в
 * исходнике. Порядок кусков — порядок протокола, кроме трёх раскладок:
 *   гашение      часть «гашение» стоит в тексте ПЕРЕД предыдущим ребёнком;
 *   функция      части «шапка», «гашение», «пролог» — перед телом, прочие — после;
 *   шапка модуля печатается последней, а стоит в файле первой.
 */

typedef struct {
  const char *text;
  size_t len;
  const node_t *owner;
} piece_t;

static piece_t *pieces = NULL;
static size_t piece_count = 0, piece_cap = 0;

static void piece_insert(size_t at, const char *text, size_t len, const node_t *owner) {
  if (piece_count == piece_cap) {
    piece_cap = piece_cap == 0 ? 1024 : piece_cap * 2;
    pieces = realloc(pieces, piece_cap * sizeof *pieces);
  }
  memmove(pieces + at + 1, pieces + at, (piece_count - at) * sizeof *pieces);
  pieces[at].text = text;
  pieces[at].len = len;
  pieces[at].owner = owner;
  piece_count += 1;
}

static int label_is(const item_t *it, const char *label) {
  return it->is_part && it->label_len == strlen(label) && memcmp(it->label, label, it->label_len) == 0;
}

static int is_function_block(const node_t *n) { return n->is_block && strcmp(n->kind, "функция") == 0; }

static void lay_out(const node_t *n) {
  size_t i, last_child = piece_count;
  if (is_function_block(n)) {
    for (i = 0; i < n->count; i += 1) {
      const item_t *it = &n->items[i];
      if (label_is(it, "шапка") || label_is(it, "гашение") || label_is(it, "пролог")) {
        piece_insert(piece_count, it->text, it->text_len, n);
      }
    }
    for (i = 0; i < n->count; i += 1) {
      const item_t *it = &n->items[i];
      if (!it->is_part) {
        lay_out(it->child);
      } else if (!label_is(it, "шапка") && !label_is(it, "гашение") && !label_is(it, "пролог") && !label_is(it, "хвост")) {
        piece_insert(piece_count, it->text, it->text_len, n);
      }
    }
    for (i = 0; i < n->count; i += 1) {
      const item_t *it = &n->items[i];
      if (label_is(it, "хвост")) piece_insert(piece_count, it->text, it->text_len, n);
    }
    return;
  }
  for (i = 0; i < n->count; i += 1) {
    const item_t *it = &n->items[i];
    if (!it->is_part) {
      last_child = piece_count;
      lay_out(it->child);
    } else if (label_is(it, "гашение")) {
      piece_insert(last_child, it->text, it->text_len, n);
    } else {
      piece_insert(piece_count, it->text, it->text_len, n);
    }
  }
}

/* Раскладка файла модуля: шапка, затем тела через пустую строку. У протокола
 * каждая часть кончается переводом строки, поэтому между телами в файле стоит
 * ещё ровно один "\n", после шапки — два; пустое тело разделителя не несёт. */
static void lay_out_file(const protocol_t *pr) {
  size_t i;
  int first = 1;
  const node_t *head = NULL;
  for (i = 0; i < pr->root.count; i += 1) {
    const item_t *it = &pr->root.items[i];
    if (!it->is_part && it->child->is_block && strcmp(it->child->rule, "шапка модуля") == 0) head = it->child;
  }
  if (head != NULL) lay_out(head);
  for (i = 0; i < pr->root.count; i += 1) {
    const item_t *it = &pr->root.items[i];
    size_t sep_at = piece_count, k, bytes = 0;
    if (it->is_part || it->child == head) continue;
    piece_insert(piece_count, first ? "\n\n" : "\n", first ? 2 : 1, &pr->root);
    lay_out(it->child);
    for (k = sep_at + 1; k < piece_count; k += 1) bytes += pieces[k].len;
    if (bytes == 0) {
      memmove(pieces + sep_at, pieces + sep_at + 1, (piece_count - sep_at - 1) * sizeof *pieces);
      piece_count -= 1;
    } else {
      first = 0;
    }
  }
}

static void describe(const node_t *n, char *out, size_t cap) {
  if (n == NULL || n->parent == NULL) {
    snprintf(out, cap, "вне узлов");
  } else if (n->is_block) {
    snprintf(out, cap, "блок «%.*s» (протокол, строка %lu)", (int)n->head_len, n->head, (unsigned long)n->proto_line);
  } else {
    snprintf(out, cap, "узел %s, исходник строка %ld столбец %ld, правило «%s» (протокол, строка %lu)", n->kind, n->line,
             n->column, n->rule, (unsigned long)n->proto_line);
  }
}

/* Собранный текст против файла C, байт в байт. */
static void match_text(const char *c_text, size_t c_len) {
  size_t i, off = 0;
  for (i = 0; i < piece_count; i += 1) {
    const piece_t *p = &pieces[i];
    size_t k;
    for (k = 0; k < p->len; k += 1) {
      if (off + k >= c_len || c_text[off + k] != p->text[k]) {
        size_t line = 1, j;
        const char *eol;
        const char *bol = c_text;
        char who[512], where[64];
        for (j = 0; j < off + k && j < c_len; j += 1) {
          if (c_text[j] == '\n') {
            line += 1;
            bol = c_text + j + 1;
          }
        }
        eol = off + k < c_len ? memchr(bol, '\n', (size_t)(c_text + c_len - bol)) : NULL;
        describe(p->owner, who, sizeof who);
        snprintf(where, sizeof where, "напечатанный C, строка %lu", (unsigned long)line);
        if (off + k >= c_len) {
          mismatch(where, "файл кончился, а протокол ещё печатает — %s", who);
        } else {
          mismatch(where, "в файле «%.*s», а протокол здесь печатает другое — %s",
                   (int)(eol == NULL ? (size_t)(c_text + c_len - bol) : (size_t)(eol - bol)), bol, who);
        }
        return;
      }
    }
    off += p->len;
  }
  if (off != c_len) {
    size_t line = 1, j;
    char where[64];
    for (j = 0; j < off; j += 1) line += c_text[j] == '\n';
    snprintf(where, sizeof where, "напечатанный C, строка %lu", (unsigned long)line);
    mismatch(where, "протокол кончился, а в файле ещё %lu байт, которых не напечатал ни один узел",
             (unsigned long)(c_len - off));
  }
}

/* ── исходник: строки и знаки ─────────────────────────────────────────────── */

static const char *source_text = NULL;
static size_t source_len = 0;
static lines_t source_lines;

/* Функции исходника: строка «функция «Имя»» или «тотальная функция «Имя»» с
 * первого столбца. Протокол обязан говорить о каждой, и ни об одной лишней. */
static int source_function_name(span_t s, const char **name, size_t *len) {
  const char *p = s.text, *end = s.text + s.len, *q;
  const char *total = "тотальная ", *fn = "функция «", *close = "»";
  if (s.len >= strlen(total) && memcmp(p, total, strlen(total)) == 0) p += strlen(total);
  if ((size_t)(end - p) < strlen(fn) || memcmp(p, fn, strlen(fn)) != 0) return 0;
  p += strlen(fn);
  q = strstr(p, close);
  if (q == NULL || q > end) return 0;
  *name = p;
  *len = (size_t)(q - p);
  return 1;
}

static int block_names_function(const node_t *n, const char *name, size_t len) {
  const char *fn = "функция «";
  size_t k = strlen(fn);
  return is_function_block(n) && n->head_len > k + len && memcmp(n->head + k, name, len) == 0 &&
         memcmp(n->head + k + len, "»", strlen("»")) == 0;
}

/* «функция «применить N»» — диспетчер вызовов через значение-функцию,
 * порождённый дефункционализацией: в исходнике его нет по построению. */
static int is_generated_apply(const node_t *n) {
  const char *fn = "функция «применить ";
  size_t k = strlen(fn), i;
  if (n->head_len <= k || memcmp(n->head, fn, k) != 0) return 0;
  for (i = k; i < n->head_len && n->head[i] >= '0' && n->head[i] <= '9'; i += 1) {
  }
  return i > k && i + strlen("»") <= n->head_len && memcmp(n->head + i, "»", strlen("»")) == 0;
}

static void check_completeness(const protocol_t *pr) {
  size_t i, j;
  for (i = 0; i < source_lines.count; i += 1) {
    const char *name;
    size_t len;
    int found = 0;
    if (!source_function_name(source_lines.items[i], &name, &len)) continue;
    for (j = 0; j < pr->root.count && !found; j += 1) {
      const item_t *it = &pr->root.items[j];
      found = !it->is_part && block_names_function(it->child, name, len);
    }
    if (!found) {
      char where[64];
      snprintf(where, sizeof where, "исходник, строка %lu", (unsigned long)(i + 1));
      mismatch(where, "функция «%.*s» есть в исходнике, а протокол о ней молчит", (int)len, name);
    }
  }
  for (j = 0; j < pr->root.count; j += 1) {
    const item_t *it = &pr->root.items[j];
    int found = 0;
    if (it->is_part || !is_function_block(it->child)) continue;
    if (is_generated_apply(it->child)) continue;
    for (i = 0; i < source_lines.count && !found; i += 1) {
      const char *name;
      size_t len;
      found = source_function_name(source_lines.items[i], &name, &len) && block_names_function(it->child, name, len);
    }
    if (!found) {
      char who[512];
      describe(it->child, who, sizeof who);
      mismatch("протокол", "функции нет в исходнике — %s", who);
    }
  }
}

/* ── переигрывание правил ─────────────────────────────────────────────────────
 * У каждого переигрываемого правила — сличение его частей с формой, которую
 * правило обязано напечатать, по значениям детей. Сличается текст строки без
 * отступа: отступ — раскладка, а раскладку уже проверило сличение всего файла.
 * Правило без сличения засчитывается «принятым на слово» и называется в итоге.
 */

static unsigned long unreplayed[RULE_COUNT];
static unsigned long replayed[RULE_COUNT];

typedef struct {
  char text[4096];
} line_t;

/* Строка k (с 0) части без отступа и перевода; 0 — строки нет. */
static int part_line(const item_t *part, size_t k, line_t *out) {
  const char *p = part->text, *end = part->text + part->text_len, *nl;
  size_t i;
  for (i = 0; i < k; i += 1) {
    nl = memchr(p, '\n', (size_t)(end - p));
    if (nl == NULL) return 0;
    p = nl + 1;
  }
  if (p >= end) return 0;
  nl = memchr(p, '\n', (size_t)(end - p));
  if (nl == NULL) nl = end;
  while (p < nl && *p == ' ') p += 1;
  copy_field(out->text, sizeof out->text, p, (size_t)(nl - p));
  return 1;
}

static size_t part_lines(const item_t *part) {
  size_t n = 0, i;
  for (i = 0; i < part->text_len; i += 1) n += part->text[i] == '\n';
  return n;
}

static const item_t *find_part(const node_t *n, const char *label) {
  size_t i;
  for (i = 0; i < n->count; i += 1) {
    if (label_is(&n->items[i], label)) return &n->items[i];
  }
  return NULL;
}

static const node_t *child_at(const node_t *n, size_t k) {
  size_t i, seen = 0;
  for (i = 0; i < n->count; i += 1) {
    if (!n->items[i].is_part) {
      if (seen == k) return n->items[i].child;
      seen += 1;
    }
  }
  return NULL;
}

static size_t child_count(const node_t *n) {
  size_t i, seen = 0;
  for (i = 0; i < n->count; i += 1) seen += !n->items[i].is_part;
  return seen;
}

static void value_of(const node_t *n, char *out, size_t cap) {
  if (n == NULL || n->value == NULL) {
    out[0] = '\0';
  } else {
    copy_field(out, cap, n->value, n->value_len);
  }
}

/* Слово из дополнения: « имя «x»» → x; « цель fl_t3» → fl_t3. */
static int extra_word(const node_t *n, const char *word, char *out, size_t cap) {
  char key[64];
  const char *p, *end = n->extra + n->extra_len;
  snprintf(key, sizeof key, " %s ", word);
  p = strstr(n->extra, key);
  if (p == NULL || p >= end) return 0;
  p += strlen(key);
  if (strncmp(p, "«", strlen("«")) == 0) {
    const char *q = strstr(p, "»");
    if (q == NULL || q > end) return 0;
    p += strlen("«");
    copy_field(out, cap, p, (size_t)(q - p));
  } else {
    const char *q = p;
    while (q < end && *q != ' ') q += 1;
    copy_field(out, cap, p, (size_t)(q - p));
  }
  return 1;
}

static int is_ident(const char *s) {
  size_t i;
  if (!((s[0] >= 'a' && s[0] <= 'z') || (s[0] >= 'A' && s[0] <= 'Z') || s[0] == '_')) return 0;
  for (i = 1; s[i] != '\0'; i += 1) {
    char c = s[i];
    if (!((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_')) return 0;
  }
  return 1;
}

static const protocol_t *the_protocol = NULL;

/* Идентификатор C функции «имя» — из головы её блока:
 * «функция «Имя» идентификатор <ид> …». */
static int function_id(const char *name, char *out, size_t cap) {
  size_t i;
  const char *key = " идентификатор ";
  for (i = 0; the_protocol != NULL && i < the_protocol->root.count; i += 1) {
    const item_t *it = &the_protocol->root.items[i];
    const char *p, *end;
    if (it->is_part || !block_names_function(it->child, name, strlen(name))) continue;
    end = it->child->head + it->child->head_len;
    p = strstr(it->child->head, key);
    if (p == NULL || p >= end) return 0;
    p += strlen(key);
    {
      const char *q = p;
      while (q < end && *q != ' ') q += 1;
      copy_field(out, cap, p, (size_t)(q - p));
    }
    return is_ident(out);
  }
  return 0;
}

static int is_arg_slot(const char *s);

static void rule_mismatch(const node_t *n, const char *fmt, const char *a, const char *b) {
  char who[512];
  describe(n, who, sizeof who);
  mismatch(who, fmt, a, b);
}

/* Ждём строку ровно такую; иначе — несовпадение с названием части. */
static int expect_line(const node_t *n, const item_t *part, size_t k, const char *want) {
  line_t got;
  if (part == NULL || !part_line(part, k, &got)) {
    rule_mismatch(n, "нет строки «%s»%s", want, "");
    return 0;
  }
  if (strcmp(got.text, want) != 0) {
    rule_mismatch(n, "по правилу ждали «%s», напечатано «%s»", want, got.text);
    return 0;
  }
  return 1;
}

/* Доводы через запятую — значения детей с first по last-1. */
static void joined_values(const node_t *n, size_t first, size_t last, char *out, size_t cap) {
  size_t k, used = 0;
  out[0] = '\0';
  for (k = first; k < last; k += 1) {
    char v[1024];
    value_of(child_at(n, k), v, sizeof v);
    used += (size_t)snprintf(out + used, used < cap ? cap - used : 0, "%s%s", k == first ? "" : ", ", v);
  }
}

static int replay_temp_decl(const node_t *n, const item_t *part, const char *temp) {
  char want[1200];
  snprintf(want, sizeof want, "fl_value %s = fl_nothing();", temp);
  return expect_line(n, part, 0, want);
}

/* Параметров у функции «имя» этого исходника: двоеточий в строке «принимает»
 * под её заголовком; -1 — функции в исходнике нет (ввезённая, порождённая). */
static long source_params(const char *name) {
  size_t i, len = strlen(name);
  for (i = 0; i < source_lines.count; i += 1) {
    const char *found;
    size_t found_len, j;
    if (!source_function_name(source_lines.items[i], &found, &found_len) || found_len != len ||
        memcmp(found, name, len) != 0)
      continue;
    for (j = i + 1; j < source_lines.count; j += 1) {
      span_t s = source_lines.items[j];
      const char *key = "  принимает ";
      if (s.len >= strlen(key) && memcmp(s.text, key, strlen(key)) == 0) {
        long colons = 0;
        size_t k;
        for (k = 0; k < s.len; k += 1) colons += s.text[k] == ':';
        return colons;
      }
      if (s.len >= strlen("  возвращает ") && memcmp(s.text, "  возвращает ", strlen("  возвращает ")) == 0) return 0;
    }
    return 0;
  }
  return -1;
}

static int replay_call(const node_t *n) {
  const item_t *part = find_part(n, "вызов");
  char temp[1024], args[8192], want[9400], callee[512], id[512];
  value_of(n, temp, sizeof temp);
  if (!is_ident(temp)) {
    rule_mismatch(n, "значение вызова «%s» — не имя временного%s", temp, "");
    return 0;
  }
  if (!extra_word(n, "имя", callee, sizeof callee)) {
    rule_mismatch(n, "у вызова не названо имя функции%s%s", "", "");
    return 0;
  }
  id[0] = '\0';
  if (!function_id(callee, id, sizeof id)) {
    rule_mismatch(n, "функции «%s» нет среди блоков протокола%s", callee, "");
    return 0;
  }
  {
    long want_args = source_params(callee);
    char have[32], need[32];
    if (want_args >= 0 && (size_t)want_args != child_count(n)) {
      snprintf(have, sizeof have, "%lu", (unsigned long)child_count(n));
      snprintf(need, sizeof need, "%ld", want_args);
      rule_mismatch(n, "доводов у вызова %s, а функция в исходнике принимает %s", have, need);
      return 0;
    }
  }
  if (!replay_temp_decl(n, part, temp)) return 0;
  joined_values(n, 0, child_count(n), args, sizeof args);
  snprintf(want, sizeof want, "FL_TRY(%s(ctx%s%s, &%s, error));", id, args[0] ? ", " : "", args, temp);
  return expect_line(n, part, 1, want) && part_lines(part) == 2;
}

static int replay_field(const node_t *n) {
  const item_t *part = find_part(n, "чтение");
  char temp[1024], target[1024], name[512], want[4096];
  value_of(n, temp, sizeof temp);
  value_of(child_at(n, 0), target, sizeof target);
  if (!extra_word(n, "поле", name, sizeof name) || child_count(n) != 1) {
    rule_mismatch(n, "у чтения поля не названо поле или не один ребёнок%s%s", "", "");
    return 0;
  }
  if (!replay_temp_decl(n, part, temp)) return 0;
  snprintf(want, sizeof want, "FL_TRY(fl_field_get(ctx, %s, \"%s\", &%s, error));", target, name, temp);
  return expect_line(n, part, 1, want);
}

static int replay_let(const node_t *n) {
  const item_t *decl = find_part(n, "объявление");
  const item_t *quench = find_part(n, "гашение");
  char name[512], value[1024], body[1024], want[4096];
  line_t got;
  const char *eq;
  size_t k;
  if (!extra_word(n, "имя", name, sizeof name) || child_count(n) != 2 || decl == NULL || !part_line(decl, 0, &got)) {
    rule_mismatch(n, "у «пусть» нет имени, объявления или двух детей%s%s", "", "");
    return 0;
  }
  value_of(child_at(n, 0), value, sizeof value);
  value_of(child_at(n, 1), body, sizeof body);
  eq = strstr(got.text, " = ");
  if (strncmp(got.text, "const fl_value ", 15) != 0 || eq == NULL) {
    rule_mismatch(n, "объявление «пусть» не по форме: «%s»%s", got.text, "");
    return 0;
  }
  {
    char id[512];
    copy_field(id, sizeof id, got.text + 15, (size_t)(eq - got.text - 15));
    snprintf(want, sizeof want, "const fl_value %s = %s; /* пусть «%s» */", id, value, name);
    if (!expect_line(n, decl, 0, want)) return 0;
    if (quench != NULL) {
      for (k = 0; k < part_lines(quench); k += 1) {
        snprintf(want, sizeof want, "(void)%s;", id);
        if (!expect_line(n, quench, k, want)) return 0;
      }
    }
  }
  value_of(n, value, sizeof value);
  if (n->value == NULL || strcmp(value, body) != 0) {
    rule_mismatch(n, "значение «пусть» — не значение тела «%s»%s", body, "");
    return 0;
  }
  return 1;
}

static int replay_flag(const node_t *n) {
  const item_t *part = find_part(n, "проверка");
  char helper[64], flag[1024], value[1024], want[4096];
  value_of(n, flag, sizeof flag);
  value_of(child_at(n, 0), value, sizeof value);
  if (!extra_word(n, "помощник", helper, sizeof helper) || child_count(n) != 1 ||
      (strcmp(helper, "fl_cond") != 0 && strcmp(helper, "fl_keep") != 0)) {
    rule_mismatch(n, "признак без помощника fl_cond/fl_keep или не с одним ребёнком%s%s", "", "");
    return 0;
  }
  snprintf(want, sizeof want, "bool %s = false;", flag);
  if (!expect_line(n, part, 0, want)) return 0;
  snprintf(want, sizeof want, "FL_TRY(%s(ctx, %s, &%s, error));", helper, value, flag);
  return expect_line(n, part, 1, want);
}

static int replay_put(const node_t *n) {
  const item_t *part = find_part(n, "присвоение");
  char target[1024], value[1024], want[4096];
  value_of(child_at(n, 0), value, sizeof value);
  if (!extra_word(n, "цель", target, sizeof target) || child_count(n) != 1) {
    rule_mismatch(n, "у «положить» нет цели или не один ребёнок%s%s", "", "");
    return 0;
  }
  snprintf(want, sizeof want, "%s = %s;", target, value);
  return expect_line(n, part, 0, want);
}

static int replay_if(const node_t *n) {
  const node_t *cond = child_at(n, 0), *then_ = child_at(n, 1), *else_ = child_at(n, 2);
  char temp[1024], flag[1024], want[4096], target[1024];
  value_of(n, temp, sizeof temp);
  value_of(cond, flag, sizeof flag);
  if (child_count(n) != 3 || cond == NULL || strcmp(cond->rule, "признак") != 0 || strcmp(then_->rule, "положить") != 0 ||
      strcmp(else_->rule, "положить") != 0) {
    rule_mismatch(n, "у «если» не три ветви (признак, то, иначе)%s%s", "", "");
    return 0;
  }
  if (!extra_word(then_, "цель", target, sizeof target) || strcmp(target, temp) != 0 ||
      !extra_word(else_, "цель", target, sizeof target) || strcmp(target, temp) != 0) {
    rule_mismatch(n, "ветви «если» кладут не в значение узла «%s»%s", temp, "");
    return 0;
  }
  if (!replay_temp_decl(n, find_part(n, "шапка"), temp)) return 0;
  snprintf(want, sizeof want, "if (%s) {", flag);
  return expect_line(n, find_part(n, "шапка"), 1, want) && expect_line(n, find_part(n, "иначе"), 0, "} else {") &&
         expect_line(n, find_part(n, "конец"), 0, "}");
}

static int replay_match_value(const node_t *n) {
  char temp[1024];
  value_of(n, temp, sizeof temp);
  return child_count(n) == 1 && replay_temp_decl(n, find_part(n, "объявление"), temp);
}

static int replay_var(const node_t *n) {
  char name[512], value[1024];
  value_of(n, value, sizeof value);
  if (!extra_word(n, "имя", name, sizeof name) || !(is_ident(value) || is_arg_slot(value)) || child_count(n) != 0) {
    rule_mismatch(n, "переменная без имени или со значением «%s», которое не имя C%s", value, "");
    return 0;
  }
  return 1;
}

/* ── якорь: на месте узла в исходнике стоит его слово ─────────────────────────
 * Место — строка и столбец в знаках (кодовых точках), как в разборе. Слово
 * вида снято замером на 47 примерах flang/proof/examples: вызов стоит на «,
 * «пусть» на слове «пусть», чтение поля на точке, «если» — на «если» или на
 * «и»/«или»/«не», которые разбор сводит к «если». Узлы без места (нули) не
 * сличаются и не засчитываются.
 */

static const char *source_at(long line, long column, size_t *rest) {
  span_t s;
  const char *p, *end;
  long k;
  if (line < 1 || (size_t)line > source_lines.count || column < 1) return NULL;
  s = source_lines.items[line - 1];
  p = s.text;
  end = s.text + s.len;
  for (k = 1; k < column; k += 1) {
    if (p >= end) return NULL;
    p += 1;
    while (p < end && (*p & 0xC0) == 0x80) p += 1;
  }
  *rest = (size_t)(end - p);
  return p;
}

static int at_word(const char *p, size_t rest, const char *word) {
  size_t k = strlen(word);
  return rest >= k && memcmp(p, word, k) == 0;
}

/* «args[N]» — довод по номеру: так печатается имя внутри предусловия у двери. */
static int is_arg_slot(const char *s) {
  size_t i = 5;
  if (strncmp(s, "args[", 5) != 0 || s[i] < '0' || s[i] > '9') return 0;
  while (s[i] >= '0' && s[i] <= '9') i += 1;
  return s[i] == ']' && s[i + 1] == '\0';
}

/* Одно слово в двух формах: имя «элементы» и «элементов» в тексте. Русское
 * имя склоняется, поэтому сличается основа: общий приставок не короче длины
 * имени без двух последних знаков (и не короче одного знака). */
static size_t utf8_len(const char *s, size_t bytes) {
  size_t n = 0, i;
  for (i = 0; i < bytes; i += 1) n += (s[i] & 0xC0) != 0x80;
  return n;
}

static int same_stem(const char *p, size_t rest, const char *name) {
  size_t common = 0, need, total = utf8_len(name, strlen(name));
  const char *a = p, *b = name;
  need = total > 3 ? total - 2 : total;
  while ((size_t)(a - p) < rest && *b != '\0') {
    size_t k = 1;
    while (((unsigned char)b[k] & 0xC0) == 0x80) k += 1;
    if ((size_t)(a - p) + k > rest || memcmp(a, b, k) != 0) break;
    a += k;
    b += k;
    common += 1;
  }
  return common >= need;
}

static int check_anchor(const node_t *n) {
  size_t rest = 0;
  const char *p;
  char name[512], want[600];
  if (n->line == 0 && n->column == 0) return 1;
  p = source_at(n->line, n->column, &rest);
  if (p == NULL) {
    rule_mismatch(n, "в исходнике нет такого места%s%s", "", "");
    return 0;
  }
  if (strcmp(n->kind, "call") == 0 && extra_word(n, "имя", name, sizeof name)) {
    const node_t *first = child_at(n, 0);
    snprintf(want, sizeof want, "«%s»", name);
    if (!at_word(p, rest, want) &&
        !(strncmp(name, "применить ", strlen("применить ")) == 0 && first != NULL &&
          strcmp(first->kind, "var") == 0 && first->line == n->line && first->column == n->column))
      goto wrong;
  } else if (strcmp(n->kind, "var") == 0 && extra_word(n, "имя", name, sizeof name)) {
    snprintf(want, sizeof want, "«%s»", name);
    if (!same_stem(p, rest, name) && !at_word(p, rest, want)) goto wrong;
  } else if (strcmp(n->kind, "let") == 0) {
    if (!at_word(p, rest, "пусть")) goto wrong;
  } else if (strcmp(n->kind, "match") == 0) {
    if (!at_word(p, rest, "разбор")) goto wrong;
  } else if (strcmp(n->kind, "fold") == 0) {
    if (!at_word(p, rest, "свёртка")) goto wrong;
  } else if (strcmp(n->kind, "map") == 0) {
    if (!at_word(p, rest, "отобразить")) goto wrong;
  } else if (strcmp(n->kind, "filter") == 0) {
    if (!at_word(p, rest, "отфильтровать")) goto wrong;
  } else if (strcmp(n->kind, "record") == 0) {
    if (!at_word(p, rest, "запись")) goto wrong;
  } else if (strcmp(n->kind, "construct") == 0) {
    if (!at_word(p, rest, "вариант")) goto wrong;
  } else if (strcmp(n->kind, "field") == 0) {
    if (!at_word(p, rest, ".")) goto wrong;
  } else if (strcmp(n->kind, "list") == 0) {
    if (!at_word(p, rest, "[") && !at_word(p, rest, "пустой")) goto wrong;
  } else if (strcmp(n->kind, "forallIn") == 0) {
    if (!at_word(p, rest, "для всех")) goto wrong;
  } else if (strcmp(n->kind, "if") == 0) {
    if (!at_word(p, rest, "если") && !at_word(p, rest, "или") && !at_word(p, rest, "и") && !at_word(p, rest, "не"))
      goto wrong;
  }
  return 1;
wrong: {
  char seen[64];
  size_t k = rest < 24 ? rest : 24;
  copy_field(seen, sizeof seen, p, k);
  rule_mismatch(n, "на этом месте исходника стоит «%s…», а не слово узла%s", seen, "");
  return 0;
}
}

/* ── правила значений: числа, литералы, операции, сборки ─────────────────── */

/* Имя функции, к которой относится узел: из головы её блока «функция «Имя» …»
 * или двери диспетчера «дверь «Имя»», где проверяется предусловие. */
static const char *enclosing_function(const node_t *n, char *out, size_t cap) {
  static const char *const heads[] = {"функция «", "дверь «"};
  size_t i;
  for (; n != NULL; n = n->parent) {
    for (i = 0; i < 2; i += 1) {
      size_t k = strlen(heads[i]);
      if (n->is_block && n->head_len > k && memcmp(n->head, heads[i], k) == 0) {
        const char *p = n->head + k, *q = strstr(p, "»");
        if (q == NULL) return NULL;
        copy_field(out, cap, p, (size_t)(q - p));
        return out;
      }
    }
  }
  return NULL;
}

/* Число на месте узла: цифры с точкой, возможно со знаком. */
static int source_number(const node_t *n, double *out) {
  size_t rest = 0, k = 0;
  const char *p = source_at(n->line, n->column, &rest);
  char buf[64];
  if (p == NULL) return 0;
  while (k < rest && k < sizeof buf - 1 && ((p[k] >= '0' && p[k] <= '9') || p[k] == '.' || (k == 0 && p[k] == '-'))) {
    buf[k] = p[k];
    k += 1;
  }
  buf[k] = '\0';
  if (k == 0 || (k == 1 && buf[0] == '-')) return 0;
  *out = strtod(buf, NULL);
  return 1;
}

static int c_number(const char *text, double *out) {
  char *end = NULL;
  *out = strtod(text, &end);
  return end != text && *end == '\0';
}

static int replay_number_literal(const node_t *n) {
  char value[256];
  double a, b;
  value_of(n, value, sizeof value);
  if (child_count(n) != 0 || !source_number(n, &a) || !c_number(value, &b) || a != b) {
    rule_mismatch(n, "число «%s» не то, что написано в исходнике%s", value, "");
    return 0;
  }
  return 1;
}

static int replay_unboxed(const node_t *n) {
  char value[1024], inner[1024], want[1100];
  value_of(n, value, sizeof value);
  value_of(child_at(n, 0), inner, sizeof inner);
  snprintf(want, sizeof want, "%s.as.number", inner);
  if (child_count(n) != 1 || strcmp(value, want) != 0) {
    rule_mismatch(n, "распакованное число «%s», а ждали «%s»", value, want);
    return 0;
  }
  return 1;
}

/* Байты строкового литерала flang (с кавычками на месте узла) → buf. */
static int flang_string(const char *p, size_t rest, char *buf, size_t cap, size_t *len) {
  size_t i = 1, n = 0;
  if (rest == 0 || p[0] != '"') return 0;
  while (i < rest && p[i] != '"') {
    char c = p[i];
    if (c == '\\') {
      if (i + 1 >= rest) return 0;
      c = p[i + 1];
      if (c == 'n') c = '\n';
      else if (c == 't') c = '\t';
      else if (c == 'r') c = '\r';
      else if (c != '\\' && c != '"') return 0;
      i += 2;
    } else {
      i += 1;
    }
    if (n + 1 >= cap) return 0;
    buf[n++] = c;
  }
  if (i >= rest) return 0;
  *len = n;
  return 1;
}

/* Байты строки C между кавычками → buf; понимает \" \\ \n \t \r \xHH \ooo. */
static int c_string(const char *p, const char *end, char *buf, size_t cap, size_t *len, const char **after) {
  size_t n = 0;
  if (p >= end || *p != '"') return 0;
  p += 1;
  while (p < end && *p != '"') {
    int c = (unsigned char)*p;
    if (c == '\\') {
      p += 1;
      if (p >= end) return 0;
      if (*p == 'n') c = '\n', p += 1;
      else if (*p == 't') c = '\t', p += 1;
      else if (*p == 'r') c = '\r', p += 1;
      else if (*p == '\\' || *p == '"' || *p == '\'' || *p == '?') c = (unsigned char)*p, p += 1;
      else if (*p == 'x') {
        c = 0;
        p += 1;
        while (p < end && ((*p >= '0' && *p <= '9') || (*p >= 'a' && *p <= 'f') || (*p >= 'A' && *p <= 'F'))) {
          c = c * 16 + (*p <= '9' ? *p - '0' : (*p | 32) - 'a' + 10);
          p += 1;
        }
      } else if (*p >= '0' && *p <= '7') {
        int k = 0;
        c = 0;
        while (k < 3 && p < end && *p >= '0' && *p <= '7') c = c * 8 + (*p - '0'), p += 1, k += 1;
      } else {
        return 0;
      }
    } else {
      p += 1;
    }
    if (n + 1 >= cap) return 0;
    buf[n++] = (char)c;
  }
  if (p >= end) return 0;
  p += 1;
  while (p < end && *p == '"') return 0;
  *len = n;
  *after = p;
  return 1;
}

static const char *c_file_text = NULL;
static size_t c_file_len = 0;

/* Константа «static const fl_value ИМЯ = { FL_STRING, { .string = { "…", Б, З } } };»
 * в напечатанном C: её байты, число байт и число знаков — против литерала. */
static int replay_string_literal(const node_t *n, const char *name) {
  char key[600], src[8192], cst[8192];
  size_t rest = 0, slen = 0, clen = 0;
  unsigned long bytes = 0, chars = 0;
  const char *p = source_at(n->line, n->column, &rest), *def, *eol, *after;
  snprintf(key, sizeof key, "static const fl_value %s = { FL_STRING, { .string = { ", name);
  def = c_file_text == NULL ? NULL : strstr(c_file_text, key);
  if (p == NULL || !flang_string(p, rest, src, sizeof src, &slen)) return -1;
  if (def == NULL) {
    rule_mismatch(n, "строковой константы %s в напечатанном C нет%s", name, "");
    return 0;
  }
  def += strlen(key);
  eol = memchr(def, '\n', (size_t)(c_file_text + c_file_len - def));
  if (eol == NULL) eol = c_file_text + c_file_len;
  if (!c_string(def, eol, cst, sizeof cst, &clen, &after) || sscanf(after, ", %lu, %lu } } };", &bytes, &chars) != 2) {
    rule_mismatch(n, "строковая константа %s не по форме%s", name, "");
    return 0;
  }
  if (clen != slen || memcmp(cst, src, slen) != 0 || bytes != slen || chars != utf8_len(src, slen)) {
    rule_mismatch(n, "строковая константа %s не равна литералу исходника%s", name, "");
    return 0;
  }
  return 1;
}

static int replay_literal(const node_t *n) {
  char value[1024];
  size_t rest = 0;
  const char *p = source_at(n->line, n->column, &rest);
  const item_t *part = find_part(n, "литерал");
  value_of(n, value, sizeof value);
  if (child_count(n) != 0 || p == NULL || (part != NULL && part->text_len != 0)) return -1;
  if (strncmp(value, "fl_number(", 10) == 0) {
    char inner[256];
    double a, b;
    size_t k = strlen(value);
    if (k < 12 || value[k - 1] != ')') return -1;
    copy_field(inner, sizeof inner, value + 10, k - 11);
    if (!source_number(n, &a) || !c_number(inner, &b) || a != b) {
      rule_mismatch(n, "число «%s» не то, что написано в исходнике%s", value, "");
      return 0;
    }
    return 1;
  }
  if (strcmp(value, "fl_flag(true)") == 0 || strcmp(value, "fl_flag(false)") == 0 || strcmp(value, "fl_nothing()") == 0) {
    const char *word = value[8] == 't' ? "да" : value[8] == 'f' ? "нет" : "ничто";
    /* Признак, который разбор сам ставит, сводя связку к «если», стоит на
     * слове связки: «или» даёт да, «и» — нет, «не» — любой из двух. */
    int connective = (value[8] == 't' && at_word(p, rest, "или")) || (value[8] == 'f' && at_word(p, rest, "и ")) ||
                     (value[8] != 'n' && at_word(p, rest, "не "));
    if (!at_word(p, rest, word) && !connective) {
      rule_mismatch(n, "литерал «%s», а в исходнике не «%s»", value, word);
      return 0;
    }
    return 1;
  }
  if (is_ident(value) && strstr(value, "_text_") != NULL) return replay_string_literal(n, value);
  return -1;
}

static int replay_tail_value(const node_t *n) {
  const item_t *part = find_part(n, "возврат");
  char value[1024], want[1200];
  value_of(child_at(n, 0), value, sizeof value);
  if (child_count(n) != 1) return 0;
  snprintf(want, sizeof want, "*result = %s;", value);
  return expect_line(n, part, 0, want) && expect_line(n, part, 1, "return FL_OK;") && part_lines(part) == 2;
}

static const char *c_operator(const char *op) {
  static const char *const table[][2] = {{"gt", ">"},  {"gte", ">="}, {"lt", "<"},  {"lte", "<="},
                                         {"add", "+"}, {"sub", "-"},  {"mul", "*"}, {"div", "/"}};
  size_t i;
  for (i = 0; i < sizeof table / sizeof table[0]; i += 1) {
    if (strcmp(table[i][0], op) == 0) return table[i][1];
  }
  return NULL;
}

/* Сверка типов операндов: пусто или одна строка
 * «if (… .tag != FL_NUMBER …) FL_TRY(<сверщик>(ctx, …, error));» — по форме. */
static int check_guard(const node_t *n, const char *checker) {
  const item_t *part = find_part(n, "сверка");
  line_t got;
  char head[128];
  size_t k;
  if (part == NULL || part_lines(part) == 0) return 1;
  snprintf(head, sizeof head, "FL_TRY(%s(ctx, ", checker);
  if (part_lines(part) != 1 || !part_line(part, 0, &got) || strncmp(got.text, "if (", 4) != 0 ||
      strstr(got.text, ".tag != FL_NUMBER") == NULL || strstr(got.text, head) == NULL ||
      (k = strlen(got.text)) < strlen("error));") || strcmp(got.text + k - strlen("error));"), "error));") != 0) {
    rule_mismatch(n, "сверка типов операндов не по форме%s%s", "", "");
    return 0;
  }
  return 1;
}

static int replay_numeric(const node_t *n, const char *box, const char *checker) {
  char op[32], l[1024], r[1024], value[2200], want[2300];
  const char *sign;
  if (!extra_word(n, "операция", op, sizeof op) || child_count(n) != 2) return 0;
  sign = c_operator(op);
  if (sign == NULL) return -1;
  value_of(child_at(n, 0), l, sizeof l);
  value_of(child_at(n, 1), r, sizeof r);
  value_of(n, value, sizeof value);
  if (box[0] != '\0') snprintf(want, sizeof want, "%s(%s %s %s)", box, l, sign, r);
  else snprintf(want, sizeof want, "(%s %s %s)", l, sign, r);
  if (strcmp(value, want) != 0) {
    rule_mismatch(n, "значение «%s», а по правилу «%s»", value, want);
    return 0;
  }
  return checker == NULL || check_guard(n, checker);
}

static int replay_operation_call(const node_t *n) {
  char op[32], l[1024], r[1024], value[2200], want[2300];
  if (!extra_word(n, "операция", op, sizeof op) || child_count(n) != 2) return 0;
  value_of(child_at(n, 0), l, sizeof l);
  value_of(child_at(n, 1), r, sizeof r);
  value_of(n, value, sizeof value);
  if (strcmp(op, "eq") == 0 || strcmp(op, "neq") == 0) {
    const item_t *part = find_part(n, "вызов");
    snprintf(want, sizeof want, "fl_flag(%sfl_equal(%s, %s))", op[0] == 'n' ? "!" : "", l, r);
    if (strcmp(value, want) != 0 || (part != NULL && part->text_len != 0)) {
      rule_mismatch(n, "равенство «%s», а по правилу «%s»", value, want);
      return 0;
    }
    return 1;
  }
  return -1;
}

static int replay_build(const node_t *n, const char *ctor, const char *variant) {
  const item_t *part = find_part(n, "сборка");
  size_t count = child_count(n), k;
  char temp[1024], arr[1024], want[4096], v[1024];
  line_t got;
  value_of(n, temp, sizeof temp);
  if (count == 0) {
    if (!replay_temp_decl(n, part, temp)) return 0;
    if (variant == NULL) return -1;
    snprintf(want, sizeof want, "FL_TRY(fl_variant_new(ctx, \"%s\", NULL, NULL, 0, &%s, error));", variant, temp);
    return expect_line(n, part, 1, want) && part_lines(part) == 2;
  }
  if (part == NULL || !part_line(part, 0, &got) || strncmp(got.text, "fl_value ", 9) != 0) {
    rule_mismatch(n, "сборка без массива значений%s%s", "", "");
    return 0;
  }
  copy_field(arr, sizeof arr, got.text + 9, strcspn(got.text + 9, "["));
  snprintf(want, sizeof want, "fl_value %s[%lu];", arr, (unsigned long)count);
  if (!expect_line(n, part, 0, want)) return 0;
  for (k = 0; k < count; k += 1) {
    char head[sizeof arr + sizeof v + 64];
    value_of(child_at(n, k), v, sizeof v);
    snprintf(head, sizeof head, "%s[%lu] = %s; /* «", arr, (unsigned long)k, v);
    if (!part_line(part, k + 1, &got) || strncmp(got.text, head, strlen(head)) != 0) {
      rule_mismatch(n, "значение поля %s стоит не на своём месте: «%s»", head, got.text);
      return 0;
    }
  }
  snprintf(want, sizeof want, "fl_value %s = fl_nothing();", temp);
  if (!expect_line(n, part, count + 1, want) || !part_line(part, count + 2, &got)) return 0;
  if (variant != NULL) snprintf(want, sizeof want, "FL_TRY(fl_variant_new(ctx, \"%s\", ", variant);
  else snprintf(want, sizeof want, "FL_TRY(%s(ctx, ", ctor);
  {
    char tail[sizeof arr + sizeof temp + 64];
    size_t g = strlen(got.text), w;
    snprintf(tail, sizeof tail, ", %s, %lu, &%s, error));", arr, (unsigned long)count, temp);
    w = strlen(tail);
    if (strncmp(got.text, want, strlen(want)) != 0 || g < w || strcmp(got.text + g - w, tail) != 0) {
      rule_mismatch(n, "сборка «%s» не по правилу%s", got.text, "");
      return 0;
    }
  }
  return part_lines(part) == count + 3;
}

static int replay_list(const node_t *n) {
  size_t count = child_count(n), i, k = 0;
  char arr[1024], value[1200], want[2400], v[1024];
  const item_t *head = find_part(n, "шапка");
  line_t got;
  value_of(n, value, sizeof value);
  if (count == 0) return -1;
  if (head == NULL || !part_line(head, 0, &got) || strncmp(got.text, "fl_value *", 10) != 0) return 0;
  copy_field(arr, sizeof arr, got.text + 10, strcspn(got.text + 10, " "));
  snprintf(want, sizeof want, "fl_value *%s = NULL;", arr);
  if (!expect_line(n, head, 0, want)) return 0;
  snprintf(want, sizeof want, "FL_TRY(fl_list_alloc(ctx, %lu, &%s, error));", (unsigned long)count, arr);
  if (!expect_line(n, head, 1, want)) return 0;
  for (i = 0; i < n->count; i += 1) {
    const item_t *it = &n->items[i];
    if (!it->is_part || !label_is(it, "элемент")) continue;
    value_of(child_at(n, k), v, sizeof v);
    snprintf(want, sizeof want, "%s[%lu] = %s;", arr, (unsigned long)k, v);
    if (!expect_line(n, it, 0, want)) return 0;
    k += 1;
  }
  snprintf(want, sizeof want, "fl_list(%s, %lu)", arr, (unsigned long)count);
  if (k != count || strcmp(value, want) != 0) {
    rule_mismatch(n, "список «%s», а по правилу «%s»", value, want);
    return 0;
  }
  return 1;
}

static int replay_form(const node_t *n) {
  const item_t *part = find_part(n, "вызов");
  char name[256], temp[1024], args[8192], want[9400];
  line_t got;
  const char *open;
  value_of(n, temp, sizeof temp);
  if (!extra_word(n, "имя", name, sizeof name)) return 0;
  snprintf(want, sizeof want, "fl_value %s = fl_nothing(); /* «%s» */", temp, name);
  if (!expect_line(n, part, 0, want) || !part_line(part, 1, &got)) return 0;
  joined_values(n, 0, child_count(n), args, sizeof args);
  open = strchr(got.text, '(');
  if (strncmp(got.text, "FL_TRY(", 7) != 0 || open == NULL) return 0;
  open = strchr(open + 1, '(');
  if (open == NULL) return 0;
  snprintf(want, sizeof want, "(ctx%s%s, &%s, error));", args[0] ? ", " : "", args, temp);
  if (strcmp(open, want) != 0) {
    rule_mismatch(n, "доводы формы «%s», а по правилу «%s»", open, want);
    return 0;
  }
  return part_lines(part) == 2;
}

static int replay_promise(const node_t *n, const char *word, const char *helper) {
  const item_t *part = find_part(n, "проверка");
  char name[512], fn[512], flag[256], value[1024], want[4096];
  line_t got;
  span_t s;
  if (!extra_word(n, "имя", name, sizeof name) || child_count(n) != 1 || enclosing_function(n, fn, sizeof fn) == NULL)
    return 0;
  if (n->line < 1 || (size_t)n->line > source_lines.count) return 0;
  s = source_lines.items[n->line - 1];
  snprintf(want, sizeof want, "%s «%s»", word, name);
  {
    char line[8192];
    copy_field(line, sizeof line, s.text, s.len);
    if (strstr(line, want) == NULL) {
      rule_mismatch(n, "на строке исходника нет «%s»%s", want, "");
      return 0;
    }
  }
  value_of(child_at(n, 0), value, sizeof value);
  snprintf(want, sizeof want, "/* %s «%s» */", strcmp(word, "обеспечивает") == 0 ? "постусловие" : "требует", name);
  if (!expect_line(n, part, 0, want) || !part_line(part, 1, &got) || strncmp(got.text, "bool ", 5) != 0) return 0;
  copy_field(flag, sizeof flag, got.text + 5, strcspn(got.text + 5, " "));
  snprintf(want, sizeof want, "bool %s = false;", flag);
  if (!expect_line(n, part, 1, want)) return 0;
  snprintf(want, sizeof want, "FL_TRY(%s(ctx, %s, \"%s\", \"%s\", &%s, error));", helper, value, name, fn, flag);
  if (!expect_line(n, part, 2, want)) return 0;
  snprintf(want, sizeof want, "if (!%s) {", flag);
  return expect_line(n, part, 3, want) && expect_line(n, part, 5, "}") && part_lines(part) == 6;
}

/* Квантор по элементам «для всех э из Л: П» — правило «все-элементы». Ребёнок 0 —
 * список Л, ребёнок 1 — «признак» тела с fl_cond. Переигрывается каждая строка:
 * взятие списка, накопитель «да», цикл, который встаёт на первом «нет» (накопитель
 * стоит в условии цикла), элемент по индексу, гашение неиспользованного элемента,
 * присвоение признака тела накопителю; значение узла — fl_flag(накопителя). Имена
 * списка, накопителя, индекса и элемента снимаются с первой строки своей части и
 * обязаны быть разными именами C. Что тело читает элемент именно этим именем —
 * на слове, как у правила «переменная». */
static int replay_all_elements(const node_t *n) {
  const item_t *head = find_part(n, "шапка"), *take = find_part(n, "взятие");
  const item_t *quench = find_part(n, "гашение"), *end = find_part(n, "конец");
  const node_t *body = child_at(n, 1);
  char item[512], list[256], acc[256], index[256], elem[256], v[1024], want[4096];
  line_t got;
  size_t k;
  if (!extra_word(n, "элемент", item, sizeof item) || child_count(n) != 2 || body == NULL ||
      strcmp(body->rule, "признак") != 0 || !extra_word(body, "помощник", v, sizeof v) || strcmp(v, "fl_cond") != 0) {
    rule_mismatch(n, "у «для всех» нет имени элемента или детей не два (список и признак тела с fl_cond)%s%s", "", "");
    return 0;
  }
  if (head == NULL || !part_line(head, 0, &got) || strncmp(got.text, "fl_value ", 9) != 0) {
    rule_mismatch(n, "шапка «для всех» не начинается объявлением списка%s%s", "", "");
    return 0;
  }
  copy_field(list, sizeof list, got.text + 9, strcspn(got.text + 9, " "));
  if (!replay_temp_decl(n, head, list)) return 0;
  value_of(child_at(n, 0), v, sizeof v);
  snprintf(want, sizeof want, "FL_TRY(fl_require_list(ctx, %s, \"свёртка\", &%s, error));", v, list);
  if (!expect_line(n, head, 1, want)) return 0;
  if (!part_line(head, 2, &got) || strncmp(got.text, "bool ", 5) != 0) {
    rule_mismatch(n, "у «для всех» нет накопителя-признака%s%s", "", "");
    return 0;
  }
  copy_field(acc, sizeof acc, got.text + 5, strcspn(got.text + 5, " "));
  snprintf(want, sizeof want, "bool %s = true; /* для всех «%s» */", acc, item);
  if (!expect_line(n, head, 2, want) || part_lines(head) != 3) return 0;
  if (take == NULL || !part_line(take, 0, &got) || strncmp(got.text, "for (size_t ", 12) != 0) {
    rule_mismatch(n, "у «для всех» нет цикла по списку%s%s", "", "");
    return 0;
  }
  copy_field(index, sizeof index, got.text + 12, strcspn(got.text + 12, " "));
  snprintf(want, sizeof want, "for (size_t %s = 0; %s && %s < %s.as.list.count; %s += 1) {", index, acc, index, list,
           index);
  if (!expect_line(n, take, 0, want)) return 0;
  if (!part_line(take, 1, &got) || strncmp(got.text, "const fl_value ", 15) != 0) {
    rule_mismatch(n, "у «для всех» нет взятия элемента%s%s", "", "");
    return 0;
  }
  copy_field(elem, sizeof elem, got.text + 15, strcspn(got.text + 15, " "));
  snprintf(want, sizeof want, "const fl_value %s = %s.as.list.items[%s]; /* «%s» */", elem, list, index, item);
  if (!expect_line(n, take, 1, want) || part_lines(take) != 2) return 0;
  if (!is_ident(list) || !is_ident(acc) || !is_ident(index) || !is_ident(elem) || strcmp(list, acc) == 0 ||
      strcmp(list, index) == 0 || strcmp(list, elem) == 0 || strcmp(acc, index) == 0 || strcmp(acc, elem) == 0 ||
      strcmp(index, elem) == 0) {
    rule_mismatch(n, "имена цикла «для всех» не имена C или совпадают%s%s", "", "");
    return 0;
  }
  if (quench != NULL) {
    for (k = 0; k < part_lines(quench); k += 1) {
      snprintf(want, sizeof want, "(void)%s;", elem);
      if (!expect_line(n, quench, k, want)) return 0;
    }
  }
  value_of(body, v, sizeof v);
  snprintf(want, sizeof want, "%s = %s;", acc, v);
  if (end == NULL || !expect_line(n, end, 0, want) || !expect_line(n, end, 1, "}") || part_lines(end) != 2) return 0;
  value_of(n, v, sizeof v);
  snprintf(want, sizeof want, "fl_flag(%s)", acc);
  if (n->value == NULL || strcmp(v, want) != 0) {
    rule_mismatch(n, "значение «для всех» «%s», а по правилу «%s»", v, want);
    return 0;
  }
  return 1;
}

static void replay_node(const node_t *n) {
  int r = rule_index(n->rule), ok = -1;
  if (!n->is_block && !check_anchor(n)) return;
  if (strcmp(n->rule, "вызов") == 0) ok = replay_call(n);
  else if (strcmp(n->rule, "поле") == 0) ok = replay_field(n);
  else if (strcmp(n->rule, "пусть") == 0) ok = replay_let(n);
  else if (strcmp(n->rule, "признак") == 0) ok = replay_flag(n);
  else if (strcmp(n->rule, "положить") == 0) ok = replay_put(n);
  else if (strcmp(n->rule, "если") == 0) ok = replay_if(n);
  else if (strcmp(n->rule, "разбор-значением") == 0) ok = replay_match_value(n);
  else if (strcmp(n->rule, "переменная") == 0) ok = replay_var(n);
  else if (strcmp(n->rule, "число-литерал") == 0) ok = replay_number_literal(n);
  else if (strcmp(n->rule, "число-распакованное") == 0) ok = replay_unboxed(n);
  else if (strcmp(n->rule, "литерал") == 0) ok = replay_literal(n);
  else if (strcmp(n->rule, "хвост-значение") == 0) ok = replay_tail_value(n);
  else if (strcmp(n->rule, "сравнение-числом") == 0) ok = replay_numeric(n, "fl_flag", "fl_not_order");
  else if (strcmp(n->rule, "арифметика-числом") == 0) ok = replay_numeric(n, "fl_number", "fl_not_numbers");
  else if (strcmp(n->rule, "число-арифметика") == 0) ok = replay_numeric(n, "", NULL);
  else if (strcmp(n->rule, "операция-вызовом") == 0) ok = replay_operation_call(n);
  else if (strcmp(n->rule, "запись") == 0) ok = replay_build(n, "fl_record_new", NULL);
  else if (strcmp(n->rule, "конструктор") == 0) {
    char variant[256];
    ok = extra_word(n, "вариант", variant, sizeof variant) ? replay_build(n, NULL, variant) : 0;
  }
  else if (strcmp(n->rule, "список") == 0) ok = replay_list(n);
  else if (strcmp(n->rule, "форма") == 0) ok = replay_form(n);
  else if (strcmp(n->rule, "постусловие") == 0) ok = replay_promise(n, "обеспечивает", "fl_post");
  else if (strcmp(n->rule, "предусловие") == 0) ok = replay_promise(n, "требует", "fl_pre");
  else if (strcmp(n->rule, "все-элементы") == 0) ok = replay_all_elements(n);
  if (ok < 0) unreplayed[r] += 1;
  else if (ok > 0) replayed[r] += 1;
  else if (!verdict_failed) rule_mismatch(n, "части не по форме правила%s%s", "", "");
}

/* ── обход узлов: закрытый список и учёт непереигранного ─────────────────── */

static int refused = 0;

/* Блок протокола — по голове: правило из закрытого списка и где он может
 * стоять. «дверь» живёт только в «диспетчере», остальные — на верху файла. */
static const char *block_rule(const node_t *n) {
  static const char *const heads[][2] = {{"функция «", "функция"},
                                         {"дверь «", "дверь"},
                                         {"фабрика «", "фабрика"},
                                         {"конструктор «", "конструктор суммы"}};
  static const char *const whole[] = {"диспетчер", "шапка модуля", "граница входа", "план"};
  char head[1024];
  size_t i;
  copy_field(head, sizeof head, n->head, n->head_len);
  for (i = 0; i < sizeof whole / sizeof whole[0]; i += 1) {
    if (strcmp(head, whole[i]) == 0) return whole[i];
  }
  for (i = 0; i < sizeof heads / sizeof heads[0]; i += 1) {
    if (strncmp(head, heads[i][0], strlen(heads[i][0])) == 0) {
      if (i == 0 && (strstr(head, "» идентификатор ") == NULL || strstr(head, " оболочка ") == NULL)) return NULL;
      if (i == 3 && strstr(head, "» суммы «") == NULL) return NULL;
      return heads[i][1];
    }
  }
  return NULL;
}

static int block_in_place(const node_t *n, const char *rule) {
  int top = n->parent != NULL && n->parent->parent == NULL;
  if (strcmp(rule, "дверь") == 0)
    return n->parent != NULL && n->parent->is_block && n->parent->head_len == strlen("диспетчер") &&
           memcmp(n->parent->head, "диспетчер", n->parent->head_len) == 0;
  return top;
}


static void walk(const node_t *n) {
  size_t i;
  if (n->parent != NULL && n->is_block) {
    const char *rule = block_rule(n);
    if (rule == NULL || rule_index(rule) < 0 || !block_in_place(n, rule)) {
      char who[512];
      describe(n, who, sizeof who);
      printf("ОТКАЗ: блок не из закрытого списка или не на своём месте — %s\n", who);
      refused = 1;
    }
  }
  if (n->parent != NULL && !n->is_block) {
    int r = rule_index(n->rule);
    if (r < 0) {
      char who[512];
      describe(n, who, sizeof who);
      printf("ОТКАЗ: правило «%s» не из закрытого списка — %s\n", n->rule, who);
      refused = 1;
    } else {
      replay_node(n);
    }
  }
  for (i = 0; i < n->count; i += 1) {
    if (!n->items[i].is_part) walk(n->items[i].child);
  }
}

int main(int argc, char **argv) {
  size_t src_len = 0, c_len = 0, pr_len = 0, i;
  char *src, *c_text, *pr_text, digest[65];
  static protocol_t pr;
  unsigned long total_replayed = 0, total_unreplayed = 0;
  if (argc != 4) {
    fputs("вызов: matcher <исходник.flang> <напечатанный.c> <протокол>\n", stderr);
    return 2;
  }
  src = slurp(argv[1], &src_len);
  c_text = slurp(argv[2], &c_len);
  pr_text = slurp(argv[3], &pr_len);
  if (src == NULL || c_text == NULL || pr_text == NULL) {
    fprintf(stderr, "не прочитан файл: %s\n", src == NULL ? argv[1] : c_text == NULL ? argv[2] : argv[3]);
    return 2;
  }
  if (!read_protocol(pr_text, pr_len, &pr)) return 1;
  the_protocol = &pr;
  sha256_hex((const unsigned char *)src, src_len, digest);
  if (pr.digest[0] != '\0' && strcmp(pr.digest, digest) != 0) {
    mismatch("привязка", "протокол от другого исходника: в протоколе sha256 %s, у файла %s", pr.digest, digest);
    return 1;
  }
  source_text = src;
  c_file_text = c_text;
  c_file_len = c_len;
  source_len = src_len;
  source_lines = split_lines(src, src_len);
  walk(&pr.root);
  if (refused) return 1;
  lay_out_file(&pr);
  match_text(c_text, c_len);
  check_completeness(&pr);
  if (verdict_failed) return 1;
  for (i = 0; i < RULE_COUNT; i += 1) {
    total_replayed += replayed[i];
    total_unreplayed += unreplayed[i];
  }
  printf("узлов в протоколе %lu; переиграно правилом %lu, принято на слово %lu\n", (unsigned long)pr.node_count,
         total_replayed, total_unreplayed);
  if (pr.digest[0] == '\0' || total_unreplayed > 0) {
    printf("НЕ ПРОВЕРЕНО — текст C сошёлся с протоколом байт в байт, противоречий нет, но:\n");
    if (pr.digest[0] == '\0') printf("  привязка к исходнику не криптографическая: в протоколе нет отпечатка\n");
    for (i = 0; i < RULE_COUNT; i += 1) {
      if (unreplayed[i] > 0) printf("  правило «%s» не переиграно, узлов %lu\n", RULES[i], unreplayed[i]);
    }
    return 3;
  }
  printf("СОШЛОСЬ\n");
  return 0;
}
