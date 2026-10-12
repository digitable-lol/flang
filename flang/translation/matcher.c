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
  int guard_checked; /* узел сторожа меры, сличённый по образцу (ADR-0104) */
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
 * двух списков стережёт run.fscript. Имя, которого здесь нет, — отказ.
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

/* ── имена напечатанного C: своя область видимости и свой счёт временных ──────
 *
 * Имена временных сличитель брал из протокола как данность, и этого мало:
 * переименуй временную в C и в протоколе ЗАОДНО — текст сойдётся байт в байт,
 * а смысл напечатанной программы изменится. Две разные временные, схлопнувшиеся
 * в одно имя, дают одно из двух, и оба — беда:
 *   накрытие         внутренняя объявлена во ВЛОЖЕННОЙ области. Такой C
 *                    собирается флагами самого печатника (-Wshadow не входит ни
 *                    в -Wall, ни в -Wextra), а значение внешней теряется;
 *   переопределение  обе в ОДНОЙ области — такой C не собирается вовсе.
 * Свободное имя (fl_t3 → fl_zzz) смысла не меняет и принимается.
 *
 * Поэтому здесь свой учёт, а не чтение протокола: области видимости считаются
 * по фигурным скобкам СОБРАННОГО текста (он к этому мигу уже сошёлся с файлом C
 * байт в байт), каждое объявленное имя заносится в свою область, и объявление
 * имени, уже живого в этой или объемлющей области, — отказ с названным местом
 * обоих. Сверх того — свой счёт временных: fl_tN печатник выдаёт ОДНИМ
 * счётчиком на модуль, а счётчик не выдаёт номер дважды; поэтому одно и то же
 * fl_tN, объявленное в модуле два раза, — отказ, даже если области не
 * пересеклись и накрытия нет. Проверяется ПОВТОР, а не возрастание: порядок
 * объявлений в тексте не равен порядку выдачи. Замерено на корпусе: «запись» и
 * «свёртка» берут временную под итог РАНЬШЕ временной под массив, а печатают
 * строку массива ВЫШЕ («fl_value fl_t3[2];» стоит над «fl_value fl_t2 =
 * fl_nothing();»), и требование возрастания отвергло бы честную печать.
 *
 * Чего здесь НЕ проверяется и почему: имена самих функций модуля. Они живут в
 * заголовке рядом, и объявление в .c — второе по счёту, а не первое.
 */

#define SCOPES_MAX 64
#define DECLS_MAX 8192

typedef struct {
  char name[256];
  size_t scope;
  unsigned long line;
} decl_t;

static decl_t decls[DECLS_MAX];
static size_t decl_count = 0;
static size_t scope_top = 0;          /* 0 — область файла */
static size_t scope_over = 0;         /* областей не поместилось: чтобы «}» не съехали */
static int scope_header[SCOPES_MAX];  /* область заголовка for: снимается вместе с телом */
static long temps[DECLS_MAX];         /* номера fl_tN, уже выданные счётчиком в этом модуле */
static size_t temp_count = 0;

static int ident_start(char c) { return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c == '_'; }
static int ident_body(char c) { return ident_start(c) || (c >= '0' && c <= '9'); }

/* «fl_t<N>» → N; всё прочее — 0 (номера с нуля печатник не выдаёт). */
static long temp_number(const char *name) {
  size_t i = strlen("fl_t");
  long n = 0;
  if (strncmp(name, "fl_t", i) != 0 || !(name[i] >= '0' && name[i] <= '9')) return 0;
  for (; name[i] >= '0' && name[i] <= '9'; i += 1) n = n * 10 + (name[i] - '0');
  return name[i] == '\0' ? n : 0;
}

/* Живое имя — любое занесённое: снятые области из списка уже вычеркнуты.
 * Ищем с конца, чтобы найти самое внутреннее объявление. */
static const decl_t *live_name(const char *name) {
  size_t i = decl_count;
  while (i > 0) {
    i -= 1;
    if (strcmp(decls[i].name, name) == 0) return &decls[i];
  }
  return NULL;
}

static void scope_push(int header) {
  if (scope_top + 1 >= SCOPES_MAX) {
    scope_over += 1;
    return;
  }
  scope_top += 1;
  scope_header[scope_top] = header;
}

static void scope_pop(void) {
  if (scope_over > 0) {
    scope_over -= 1;
    return;
  }
  while (decl_count > 0 && decls[decl_count - 1].scope == scope_top) decl_count -= 1;
  if (scope_top == 0) return;
  scope_top -= 1;
  if (scope_top > 0 && scope_header[scope_top]) {
    while (decl_count > 0 && decls[decl_count - 1].scope == scope_top) decl_count -= 1;
    scope_header[scope_top] = 0;
    scope_top -= 1;
  }
}

static void declare(const char *name, const node_t *owner, unsigned long line) {
  const decl_t *old = live_name(name);
  char where[64], who[512];
  long n;
  snprintf(where, sizeof where, "напечатанный C, строка %lu", line);
  describe(owner, who, sizeof who);
  if (old != NULL) {
    if (old->scope == scope_top) {
      mismatch(where, "имя «%s» заводится второй раз в ТОЙ ЖЕ области — переопределение, первое на строке %lu; такой C не соберётся — %s",
               name, old->line, who);
    } else {
      mismatch(where, "имя «%s» накрывает живое имя, заведённое в объемлющей области на строке %lu; внешнее значение теряется — %s",
               name, old->line, who);
    }
    return;
  }
  n = temp_number(name);
  if (n != 0) {
    size_t k;
    for (k = 0; k < temp_count; k += 1) {
      if (temps[k] != n) continue;
      mismatch(where, "временная «%s» выдана в модуле второй раз, а счётчик печатника один и номера не повторяет — %s",
               name, who);
      return;
    }
    if (temp_count < DECLS_MAX) temps[temp_count++] = n;
  }
  if (decl_count < DECLS_MAX) {
    copy_field(decls[decl_count].name, sizeof decls[decl_count].name, name, strlen(name));
    decls[decl_count].scope = scope_top;
    decls[decl_count].line = line;
    decl_count += 1;
  }
}

/* Ключевые слова C, с которых объявление начаться не может: без них «return
 * FL_OK;» читалось бы как объявление «FL_OK». */
static int c_keyword(const char *s, size_t len) {
  static const char *const kw[] = {"if",     "else",  "for",      "while",  "do",    "switch", "case",
                                   "default", "return", "break", "continue", "goto", "sizeof", "typedef"};
  size_t i;
  for (i = 0; i < sizeof kw / sizeof kw[0]; i += 1) {
    if (strlen(kw[i]) == len && memcmp(s, kw[i], len) == 0) return 1;
  }
  return 0;
}

/* Объявление в начале строки C: «[static ][const ]<тип> [*]<имя>», и сразу за
 * именем « = », «;», «[» или «(». Одно слово перед знаком — это присвоение или
 * вызов, а не объявление. Ответ: 0 — не объявление, 1 — имя, 2 — заголовок
 * «for (тип имя = …» (имя живёт в области тела цикла), 3 — определение функции,
 * и тогда *paren — где открылся список параметров. */
static int declared_name(const char *s, char *out, size_t cap, size_t *paren) {
  size_t i = 0, start = 0, len = 0, words = 0;
  while (s[i] == ' ') i += 1;
  if (strncmp(s + i, "for (", strlen("for (")) == 0) {
    size_t j = i + strlen("for (");
    while (s[j] == ' ') j += 1;
    if (!ident_start(s[j])) return 0;
    while (ident_body(s[j])) j += 1;
    while (s[j] == ' ') j += 1;
    if (!ident_start(s[j])) return 0;
    start = j;
    while (ident_body(s[j])) j += 1;
    if (!(s[j] == ' ' && s[j + 1] == '=')) return 0;
    copy_field(out, cap, s + start, (size_t)(j - start));
    return 2;
  }
  for (;;) {
    int done = 0, func = 0;
    while (s[i] == ' ') i += 1;
    while (s[i] == '*') i += 1;
    if (!ident_start(s[i])) return 0;
    start = i;
    while (ident_body(s[i])) i += 1;
    len = (size_t)(i - start);
    if (words == 0 && c_keyword(s + start, len)) return 0;
    words += 1;
    if (s[i] == '(') done = func = 1;
    else if (s[i] == ';' || s[i] == '[') done = 1;
    else if (s[i] == ' ' && s[i + 1] == '=' && s[i + 2] == ' ') done = 1;
    else if (s[i] != ' ') return 0;
    if (done) {
      if (words < 2) return 0;
      copy_field(out, cap, s + start, len);
      *paren = i;
      return func ? 3 : 1;
    }
  }
}

/* Имена параметров из собранного списка «(тип имя, тип *имя, …)»: у каждого
 * довода берётся последнее слово. «void» — не имя. */
static void declare_params(const char *s, size_t len, const node_t *owner, unsigned long line) {
  char last[256];
  size_t i;
  int depth = 0;
  last[0] = '\0';
  for (i = 0; i < len; i += 1) {
    char c = s[i];
    if (c == '(') {
      depth += 1;
    } else if (c == ')') {
      depth -= 1;
      if (depth <= 0) break;
    } else if (c == ',' && depth == 1) {
      if (last[0] != '\0' && strcmp(last, "void") != 0) declare(last, owner, line);
      last[0] = '\0';
    } else if (ident_start(c)) {
      size_t j = i;
      while (j < len && ident_body(s[j])) j += 1;
      copy_field(last, sizeof last, s + i, (size_t)(j - i));
      i = j - 1;
    }
  }
  if (last[0] != '\0' && strcmp(last, "void") != 0) declare(last, owner, line);
}

/* Состояние обхода строк: тянется между строками, потому что и комментарий, и
 * список параметров у двери занимают не одну строку. */
static int nm_comment = 0;    /* внутри блочного комментария */
static int nm_in_params = 0;  /* внутри списка параметров функции */
static int nm_paren = 0;
static char nm_params[8192];
static size_t nm_params_len = 0;
static int nm_ready = 0;      /* параметры собраны и ждут ближайшей «{» */
static const node_t *nm_owner = NULL;
static unsigned long nm_line = 0;

static void names_line(const char *s, const node_t *owner, unsigned long lineno) {
  size_t i, from = (size_t)-1;
  char name[256];
  if (!nm_comment && !nm_in_params) {
    size_t at = 0;
    int kind = declared_name(s, name, sizeof name, &at);
    if (kind == 1) {
      declare(name, owner, lineno);
    } else if (kind == 2) {
      scope_push(1);
      declare(name, owner, lineno);
    } else if (kind == 3 && scope_top == 0) {
      from = at;
      nm_paren = 0;
      nm_params_len = 0;
      nm_owner = owner;
      nm_line = lineno;
    }
  }
  for (i = 0; s[i] != '\0'; i += 1) {
    char c = s[i];
    if (nm_comment) {
      if (c == '*' && s[i + 1] == '/') {
        nm_comment = 0;
        i += 1;
      }
      continue;
    }
    if (c == '/' && s[i + 1] == '*') {
      nm_comment = 1;
      i += 1;
      continue;
    }
    if (c == '/' && s[i + 1] == '/') break;
    if (!nm_in_params && (c == '"' || c == '\'')) {
      i += 1;
      while (s[i] != '\0' && s[i] != c) i += s[i] == '\\' && s[i + 1] != '\0' ? 2 : 1;
      if (s[i] == '\0') break;
      continue;
    }
    if (i == from) nm_in_params = 1;
    if (nm_in_params) {
      if (nm_params_len + 1 < sizeof nm_params) nm_params[nm_params_len++] = c;
      if (c == '(') {
        nm_paren += 1;
      } else if (c == ')') {
        nm_paren -= 1;
        if (nm_paren == 0) {
          nm_in_params = 0;
          nm_ready = 1;
        }
      }
      continue;
    }
    if (c == '{') {
      scope_push(0);
      if (nm_ready) {
        declare_params(nm_params, nm_params_len, nm_owner, nm_line);
        nm_ready = 0;
      }
    } else if (c == '}') {
      scope_pop();
    }
  }
}

/* Собранный текст — построчно, с узлом-хозяином каждой строки. */
static void check_names(void) {
  static char line[8192];
  size_t i, k, li = 0;
  unsigned long lineno = 1;
  const node_t *owner = NULL;
  for (i = 0; i < piece_count; i += 1) {
    const piece_t *p = &pieces[i];
    for (k = 0; k < p->len; k += 1) {
      char c = p->text[k];
      if (li == 0) owner = p->owner;
      if (c == '\n') {
        line[li] = '\0';
        names_line(line, owner, lineno);
        lineno += 1;
        li = 0;
      } else if (li + 1 < sizeof line) {
        line[li++] = c;
      }
    }
  }
  if (li > 0) {
    line[li] = '\0';
    names_line(line, owner, lineno);
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

/* «функция «мера убывает»» — сторож меры, который печатник кладёт сам; его
 * закрытый список имён и проверка «кто-то его зовёт» — ниже, у сторожа меры. */
static int is_generated_measure(const protocol_t *pr, const node_t *n);

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
    if (is_generated_measure(pr, it->child)) continue;
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
static unsigned long measure_born = 0; /* узлы сторожа меры: место не сличалось */

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

/* ── сторож меры: функция и узлы, которых в исходнике нет ─────────────────────
 *
 * Завершение рекурсии доказано мерой, и у двух способов из пяти («постоянным
 * шагом» и «объявленной мерой», DESCRIPTION.md) в напечатанном коде остаётся
 * сторож: мера следующего шага обязана быть строго меньше меры этого витка,
 * неотрицательной и целой. Сторож — своя функция, «мера убывает» (у
 * объявленной меры «объявленная мера убывает»; имя занято — с номером), и
 * узлы под ней автор не писал: «пусть» с мерой шага, «если» сравнения, вызов
 * этой функции и повторная мера на доводах витка. Место у таких узлов —
 * хвостовой вызов, убывающий довод или строка «убывает», и слова своего вида
 * там нет по построению.
 *
 * С ADR-0104 сторож самовызова сличается по образцу (ниже, «сторож меры:
 * переигрывается по образцу»): место, строгость сравнения мер и ветвь,
 * продолжающая виток. Поблажка ниже осталась для того, чего образец не знает,
 * — сторожа у вызова ДРУГОЙ функции (взаимная рекурсия): место такого узла не
 * сличается, он назван числом в итоге, и итог становится «НЕ ПРОВЕРЕНО». Блок
 * функции сторожа принимается, если его кто-то зовёт, — ровно как блок
 * «применить N».
 */
static int is_measure_guard_name(const char *name) {
  static const char *const bases[] = {"мера убывает", "объявленная мера убывает"};
  size_t i;
  for (i = 0; i < sizeof bases / sizeof bases[0]; i += 1) {
    size_t k = strlen(bases[i]), d;
    if (strncmp(name, bases[i], k) != 0) continue;
    if (name[k] == '\0') return 1;
    if (name[k] != ' ') continue;
    d = k + 1;
    while (name[d] >= '0' && name[d] <= '9') d += 1;
    if (d > k + 1 && name[d] == '\0') return 1;
  }
  return 0;
}

/* Имя функции из головы её блока «функция «Имя» …». */
static int block_function_name(const node_t *n, char *out, size_t cap) {
  const char *fn = "функция «", *p, *q;
  size_t k = strlen(fn);
  if (!is_function_block(n) || n->head_len <= k || memcmp(n->head, fn, k) != 0) return 0;
  p = n->head + k;
  q = strstr(p, "»");
  if (q == NULL || q > n->head + n->head_len) return 0;
  copy_field(out, cap, p, (size_t)(q - p));
  return 1;
}

/* Зовёт ли протокол функцию «имя» хоть откуда-нибудь. */
static int protocol_calls(const node_t *n, const char *name) {
  char called[512];
  size_t i;
  if (!n->is_block && strcmp(n->rule, "вызов") == 0 && extra_word(n, "имя", called, sizeof called) &&
      strcmp(called, name) == 0)
    return 1;
  for (i = 0; i < n->count; i += 1) {
    if (!n->items[i].is_part && protocol_calls(n->items[i].child, name)) return 1;
  }
  return 0;
}

static int is_generated_measure(const protocol_t *pr, const node_t *n) {
  char name[512];
  return block_function_name(n, name, sizeof name) && is_measure_guard_name(name) && protocol_calls(&pr->root, name);
}

/* Вызов сторожа меры в поддереве узла, стоящий ровно на месте этого узла: так
 * узнаются «пусть», «если» и «положить», которые сторож печатает вокруг себя. */
static int holds_measure_guard(const node_t *n, long line, long column) {
  char name[512];
  size_t i;
  if (!n->is_block && n->line == line && n->column == column && strcmp(n->rule, "вызов") == 0 &&
      extra_word(n, "имя", name, sizeof name) && is_measure_guard_name(name))
    return 1;
  for (i = 0; i < n->count; i += 1) {
    if (!n->items[i].is_part && holds_measure_guard(n->items[i].child, line, column)) return 1;
  }
  return 0;
}

/* Строка объявленной меры функции «имя»: «  убывает …» под её заголовком и до
 * заголовка следующей функции; 0 — меры не объявлено. */
static long measure_line(const char *name) {
  const char *key = "  убывает ";
  size_t i, len = strlen(name);
  for (i = 0; i < source_lines.count; i += 1) {
    const char *found;
    size_t found_len, j;
    if (!source_function_name(source_lines.items[i], &found, &found_len) || found_len != len ||
        memcmp(found, name, len) != 0)
      continue;
    for (j = i + 1; j < source_lines.count; j += 1) {
      span_t s = source_lines.items[j];
      if (s.len >= strlen(key) && memcmp(s.text, key, strlen(key)) == 0) return (long)(j + 1);
      if (source_function_name(s, &found, &found_len)) break;
    }
    return 0;
  }
  return 0;
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
static int measure_born_node(const node_t *n);
static int replay_helper_operation(const node_t *n, const char *op);

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
  if (n->guard_checked) return 1;
  /* Обёртка («число-распакованное», «положить») берёт вид и место того, что
   * обёртывает; обёрнут узел сторожа, сличённый по образцу, — место его. */
  if (child_count(n) == 1 && child_at(n, 0)->guard_checked && child_at(n, 0)->line == n->line &&
      child_at(n, 0)->column == n->column && strcmp(child_at(n, 0)->kind, n->kind) == 0)
    return 1;
  if (measure_born_node(n)) {
    measure_born += 1;
    return 1;
  }
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

/* Узел, рождённый сторожем меры: сам сторож и его оболочка стоят на месте
 * вызова сторожа, повторная мера — на строке «убывает» своей функции, а всё
 * внутри самой функции сторожа — её же. */
static int measure_born_node(const node_t *n) {
  char fn[512];
  if (holds_measure_guard(n, n->line, n->column)) return 1;
  if (enclosing_function(n, fn, sizeof fn) == NULL) return 0;
  if (is_measure_guard_name(fn)) return 1;
  return n->line != 0 && n->line == measure_line(fn);
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
  /* Литерал без места кладёт сторож меры; его значение сличил образец. */
  if (p == NULL && n->guard_checked && child_count(n) == 0 && (part == NULL || part->text_len == 0)) return 1;
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
  if (sign == NULL && strcmp(op, "mod") != 0 && strcmp(op, "percent") != 0) return -1;
  value_of(child_at(n, 0), l, sizeof l);
  value_of(child_at(n, 1), r, sizeof r);
  value_of(n, value, sizeof value);
  {
    /* «Прямая арифметика» печатника: остаток — fmod, процент — (l / 100.0) * r. */
    char inner[2100];
    if (strcmp(op, "mod") == 0) snprintf(inner, sizeof inner, "fmod(%s, %s)", l, r);
    else if (strcmp(op, "percent") == 0) snprintf(inner, sizeof inner, "(%s / 100.0) * %s", l, r);
    else snprintf(inner, sizeof inner, "%s %s %s", l, sign, r);
    if (box[0] != '\0') snprintf(want, sizeof want, "%s(%s)", box, inner);
    else snprintf(want, sizeof want, "(%s)", inner);
  }
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
  return replay_helper_operation(n, op);
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
  if (n->line < 1 || (size_t)n->line > source_lines.count) {
    /* Обещание без места автор не писал: такие печатает сторож меры о себе;
     * сличённое по образцу сторожа (ADR-0104) поблажкой уже не считается. */
    if (n->guard_checked) {
    } else if (!measure_born_node(n)) {
      return 0;
    } else {
      measure_born += 1;
    }
  } else {
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

/* Отбор по признаку «отфильтровать Л где э → П» — правило «отфильтровать».
 * Ребёнок 0 — список Л, ребёнок 1 — «признак» тела с fl_keep (не fl_cond: у
 * отбора свой помощник). Переигрывается каждая строка: взятие списка, место
 * под ответ длиной во весь список, счётчик взятых, цикл БЕЗ остановки на
 * первом «нет», элемент по индексу, гашение неиспользованного элемента и
 * отбор — ровно четыре строки, в которых элемент попадает в ответ ТОЛЬКО под
 * признаком и счётчик растёт на один; значение узла — fl_list(место,
 * счётчик), то есть длина ответа — число взятых, а не длина списка. Имена
 * списка, места, счётчика, индекса и элемента снимаются с первых строк своих
 * частей и обязаны быть разными именами C. Что тело читает элемент именно
 * этим именем — на слове, как у правила «переменная». */
static int replay_filter(const node_t *n) {
  const item_t *head = find_part(n, "шапка"), *made = find_part(n, "объявления");
  const item_t *take = find_part(n, "взятие"), *pick = find_part(n, "отбор");
  const item_t *quench = find_part(n, "гашение"), *end = find_part(n, "конец");
  const node_t *body = child_at(n, 1);
  char item[512], list[256], out[256], kept[256], index[256], elem[256], v[1024], want[4096];
  line_t got;
  size_t k;
  if (!extra_word(n, "элемент", item, sizeof item) || child_count(n) != 2 || body == NULL ||
      strcmp(body->rule, "признак") != 0 || !extra_word(body, "помощник", v, sizeof v) || strcmp(v, "fl_keep") != 0) {
    rule_mismatch(n, "у «отфильтровать» нет имени элемента или детей не два (список и признак тела с fl_keep)%s%s",
                  "", "");
    return 0;
  }
  if (head == NULL || !part_line(head, 0, &got) || strncmp(got.text, "fl_value ", 9) != 0) {
    rule_mismatch(n, "шапка «отфильтровать» не начинается объявлением списка%s%s", "", "");
    return 0;
  }
  copy_field(list, sizeof list, got.text + 9, strcspn(got.text + 9, " "));
  if (!replay_temp_decl(n, head, list)) return 0;
  value_of(child_at(n, 0), v, sizeof v);
  snprintf(want, sizeof want, "FL_TRY(fl_require_list(ctx, %s, \"отфильтровать\", &%s, error));", v, list);
  if (!expect_line(n, head, 1, want) || part_lines(head) != 2) return 0;
  if (made == NULL || !part_line(made, 0, &got) || strncmp(got.text, "fl_value *", 10) != 0) {
    rule_mismatch(n, "у «отфильтровать» нет места под ответ%s%s", "", "");
    return 0;
  }
  copy_field(out, sizeof out, got.text + 10, strcspn(got.text + 10, " "));
  snprintf(want, sizeof want, "fl_value *%s = NULL;", out);
  if (!expect_line(n, made, 0, want)) return 0;
  if (!part_line(made, 1, &got) || strncmp(got.text, "size_t ", 7) != 0) {
    rule_mismatch(n, "у «отфильтровать» нет счётчика взятых%s%s", "", "");
    return 0;
  }
  copy_field(kept, sizeof kept, got.text + 7, strcspn(got.text + 7, " "));
  snprintf(want, sizeof want, "size_t %s = 0;", kept);
  if (!expect_line(n, made, 1, want)) return 0;
  snprintf(want, sizeof want, "FL_TRY(fl_list_alloc(ctx, %s.as.list.count, &%s, error));", list, out);
  if (!expect_line(n, made, 2, want)) return 0;
  if (!part_line(made, 3, &got) || strncmp(got.text, "for (size_t ", 12) != 0) {
    rule_mismatch(n, "у «отфильтровать» нет цикла по списку%s%s", "", "");
    return 0;
  }
  copy_field(index, sizeof index, got.text + 12, strcspn(got.text + 12, " "));
  snprintf(want, sizeof want, "for (size_t %s = 0; %s < %s.as.list.count; %s += 1) {", index, index, list, index);
  if (!expect_line(n, made, 3, want) || part_lines(made) != 4) return 0;
  if (take == NULL || !part_line(take, 0, &got) || strncmp(got.text, "const fl_value ", 15) != 0) {
    rule_mismatch(n, "у «отфильтровать» нет взятия элемента%s%s", "", "");
    return 0;
  }
  copy_field(elem, sizeof elem, got.text + 15, strcspn(got.text + 15, " "));
  snprintf(want, sizeof want, "const fl_value %s = %s.as.list.items[%s]; /* «%s» */", elem, list, index, item);
  if (!expect_line(n, take, 0, want) || part_lines(take) != 1) return 0;
  if (!is_ident(list) || !is_ident(out) || !is_ident(kept) || !is_ident(index) || !is_ident(elem) ||
      strcmp(list, out) == 0 || strcmp(list, kept) == 0 || strcmp(list, index) == 0 || strcmp(list, elem) == 0 ||
      strcmp(out, kept) == 0 || strcmp(out, index) == 0 || strcmp(out, elem) == 0 || strcmp(kept, index) == 0 ||
      strcmp(kept, elem) == 0 || strcmp(index, elem) == 0) {
    rule_mismatch(n, "имена отбора не имена C или совпадают%s%s", "", "");
    return 0;
  }
  value_of(body, v, sizeof v);
  snprintf(want, sizeof want, "if (%s) {", v);
  if (!expect_line(n, pick, 0, want)) return 0;
  snprintf(want, sizeof want, "%s[%s] = %s;", out, kept, elem);
  if (!expect_line(n, pick, 1, want)) return 0;
  snprintf(want, sizeof want, "%s += 1;", kept);
  if (!expect_line(n, pick, 2, want) || !expect_line(n, pick, 3, "}") || part_lines(pick) != 4) return 0;
  if (quench != NULL) {
    for (k = 0; k < part_lines(quench); k += 1) {
      snprintf(want, sizeof want, "(void)%s;", elem);
      if (!expect_line(n, quench, k, want)) return 0;
    }
  }
  if (end == NULL || !expect_line(n, end, 0, "}") || part_lines(end) != 1) return 0;
  value_of(n, v, sizeof v);
  snprintf(want, sizeof want, "fl_list(%s, %s)", out, kept);
  if (n->value == NULL || strcmp(v, want) != 0) {
    rule_mismatch(n, "значение «отфильтровать» «%s», а по правилу «%s»", v, want);
    return 0;
  }
  return 1;
}

/* ── хвостовые правила: «хвост-пусть», «хвост-если», «хвост-цикл», «хвост-возврат» ──
 *
 * Хвост — узел, который сам кончает функцию: кладёт ответ и возвращает или
 * уходит на следующий виток. Значения у хвоста нет, поэтому переигрываются
 * строки его частей по значениям детей.
 */

/* Подпись C функции из части «шапка» её блока: первая строка вида
 * «… <ид>(fl_ctx *ctx, fl_value a, …, fl_value *result, fl_error *error) {».
 * Имена параметров C — по порядку; (size_t)-1 — подписи нет. */
static size_t signature_params(const node_t *block, char names[][128], size_t max) {
  size_t i;
  for (i = 0; i < block->count; i += 1) {
    const item_t *it = &block->items[i];
    line_t got;
    size_t k;
    if (!label_is(it, "шапка")) continue;
    for (k = 0; part_line(it, k, &got); k += 1) {
      const char *open = strstr(got.text, "(fl_ctx *ctx"), *tail = ", fl_value *result, fl_error *error) {";
      const char *p, *end;
      size_t count = 0, len = strlen(got.text);
      if (open == NULL || len < strlen(tail) || strcmp(got.text + len - strlen(tail), tail) != 0) continue;
      p = open + strlen("(fl_ctx *ctx");
      end = got.text + len - strlen(tail);
      while (p < end) {
        const char *q;
        if (strncmp(p, ", fl_value ", 11) != 0) return (size_t)-1;
        p += 11;
        q = p;
        while (q < end && strncmp(q, ", ", 2) != 0) q += 1;
        if (count >= max) return (size_t)-1;
        copy_field(names[count], 128, p, (size_t)(q - p));
        if (!is_ident(names[count])) return (size_t)-1;
        count += 1;
        p = q;
      }
      return count;
    }
  }
  return (size_t)-1;
}

/* Блок функции, внутри которого стоит узел. */
static const node_t *enclosing_block(const node_t *n) {
  for (; n != NULL; n = n->parent) {
    if (is_function_block(n)) return n;
  }
  return NULL;
}

static int is_tail_rule(const node_t *n) {
  return n != NULL && !n->is_block && strncmp(n->rule, "хвост-", strlen("хвост-")) == 0;
}

static int replay_tail_let(const node_t *n) {
  const item_t *decl = find_part(n, "объявление"), *quench = find_part(n, "гашение");
  char name[512], value[1024], id[512], want[4096];
  line_t got;
  const char *eq;
  size_t k;
  if (!extra_word(n, "имя", name, sizeof name) || child_count(n) != 2 || !is_tail_rule(child_at(n, 1)) ||
      decl == NULL || part_lines(decl) != 1 || !part_line(decl, 0, &got) || n->value != NULL) {
    rule_mismatch(n, "у «хвост-пусть» нет имени, объявления или двух детей (значение и хвост)%s%s", "", "");
    return 0;
  }
  eq = strstr(got.text, " = ");
  if (strncmp(got.text, "const fl_value ", 15) != 0 || eq == NULL) {
    rule_mismatch(n, "объявление «хвост-пусть» не по форме: «%s»%s", got.text, "");
    return 0;
  }
  copy_field(id, sizeof id, got.text + 15, (size_t)(eq - got.text - 15));
  value_of(child_at(n, 0), value, sizeof value);
  snprintf(want, sizeof want, "const fl_value %s = %s; /* пусть «%s» */", id, value, name);
  if (!is_ident(id) || !expect_line(n, decl, 0, want)) return 0;
  if (quench != NULL) {
    if (part_lines(quench) > 1) return 0;
    for (k = 0; k < part_lines(quench); k += 1) {
      snprintf(want, sizeof want, "(void)%s;", id);
      if (!expect_line(n, quench, k, want)) return 0;
    }
  }
  return 1;
}

static int replay_tail_if(const node_t *n) {
  const node_t *cond = child_at(n, 0);
  const item_t *head = find_part(n, "шапка"), *other = find_part(n, "иначе"), *end = find_part(n, "конец");
  char flag[1024], helper[64], want[1200];
  if (child_count(n) != 3 || cond == NULL || strcmp(cond->rule, "признак") != 0 ||
      !extra_word(cond, "помощник", helper, sizeof helper) || strcmp(helper, "fl_cond") != 0 ||
      !is_tail_rule(child_at(n, 1)) || !is_tail_rule(child_at(n, 2)) || n->value != NULL) {
    rule_mismatch(n, "у «хвост-если» не три ветви (признак с fl_cond, хвост «то», хвост «иначе»)%s%s", "", "");
    return 0;
  }
  value_of(cond, flag, sizeof flag);
  snprintf(want, sizeof want, "if (%s) {", flag);
  return head != NULL && other != NULL && end != NULL && part_lines(head) == 1 && part_lines(other) == 1 &&
         part_lines(end) == 1 && expect_line(n, head, 0, want) && expect_line(n, other, 0, "} else {") &&
         expect_line(n, end, 0, "}");
}

/* Самовызов в хвосте — виток цикла. Довод, который не имя C или совпадает с
 * параметром, сперва ложится во временное (иначе присвоение параметров по
 * порядку прочло бы уже переписанный); затем параметрам по порядку подписи
 * присваиваются доводы, пояснение, тик счётчика шагов и continue. */
static int replay_tail_loop(const node_t *n) {
  const item_t *tail = find_part(n, "хвост");
  const node_t *block = enclosing_block(n);
  char name[512], fn[512], params[64][128], parts[64][1024], want[2400];
  size_t count, i, j, k = 0;
  line_t got;
  if (block == NULL || !extra_word(n, "имя", name, sizeof name) || !block_function_name(block, fn, sizeof fn) ||
      strcmp(name, fn) != 0) {
    rule_mismatch(n, "«хвост-цикл» зовёт не свою функцию%s%s", "", "");
    return 0;
  }
  count = signature_params(block, params, 64);
  if (count == (size_t)-1 || count != child_count(n) || tail == NULL) {
    rule_mismatch(n, "доводов у витка не столько, сколько параметров в подписи функции%s%s", "", "");
    return 0;
  }
  if (strchr(name, '"') != NULL || strchr(name, '\\') != NULL) return -1;
  for (i = 0; i < count; i += 1) {
    int keep;
    value_of(child_at(n, i), parts[i], sizeof parts[i]);
    keep = is_ident(parts[i]);
    for (j = 0; j < count && keep; j += 1) keep = strcmp(parts[i], params[j]) != 0;
    if (!keep) {
      char temp[256];
      if (!part_line(tail, k, &got) || strncmp(got.text, "const fl_value ", 15) != 0) {
        rule_mismatch(n, "довод витка «%s» не отложен во временное%s", parts[i], "");
        return 0;
      }
      copy_field(temp, sizeof temp, got.text + 15, strcspn(got.text + 15, " "));
      snprintf(want, sizeof want, "const fl_value %s = %s;", temp, parts[i]);
      if (!is_ident(temp) || !expect_line(n, tail, k, want)) return 0;
      copy_field(parts[i], sizeof parts[i], temp, strlen(temp));
      k += 1;
    }
  }
  for (i = 0; i < count; i += 1) {
    snprintf(want, sizeof want, "%.127s = %.1023s;", params[i], parts[i]);
    if (!expect_line(n, tail, k, want)) return 0;
    k += 1;
  }
  if (!part_line(tail, k, &got) || strncmp(got.text, "/* ", 3) != 0 || strstr(got.text, "*/") == NULL ||
      strstr(got.text, "*/") != got.text + strlen(got.text) - 2) {
    rule_mismatch(n, "у витка нет пояснения%s%s", "", "");
    return 0;
  }
  k += 1;
  snprintf(want, sizeof want, "FL_TRY(fl_tick(ctx, \"%s\", error));", name);
  if (!expect_line(n, tail, k, want) || !expect_line(n, tail, k + 1, "continue;")) return 0;
  return part_lines(tail) == k + 2;
}

/* Чужая функция в хвосте — возврат её ответа: одна строка. */
static int replay_tail_return(const node_t *n) {
  const item_t *tail = find_part(n, "хвост");
  char callee[512], id[512], args[8192], want[9400];
  long want_args;
  if (!extra_word(n, "имя", callee, sizeof callee) || !function_id(callee, id, sizeof id) || tail == NULL) {
    rule_mismatch(n, "у хвостового возврата не названа функция протокола%s%s", "", "");
    return 0;
  }
  want_args = source_params(callee);
  if (want_args >= 0 && (size_t)want_args != child_count(n)) {
    rule_mismatch(n, "доводов у хвостового возврата не столько, сколько параметров у «%s»%s", callee, "");
    return 0;
  }
  joined_values(n, 0, child_count(n), args, sizeof args);
  snprintf(want, sizeof want, "return %s(ctx%s%s, result, error);", id, args[0] ? ", " : "", args);
  return expect_line(n, tail, 0, want) && part_lines(tail) == 1;
}

/* Операция вызовом помощника: «fl_value T = fl_nothing();» и
 * «FL_TRY(fl_<оп>(ctx, l, r, &T, error));»; значение — T. Таблица помощников —
 * та же, что «Помощники операций» печатника. */
static const char *operation_helper(const char *op) {
  static const char *const table[][2] = {{"add", "fl_add"}, {"sub", "fl_sub"},         {"mul", "fl_mul"},
                                         {"div", "fl_div"}, {"mod", "fl_mod"},         {"percent", "fl_percent"},
                                         {"gt", "fl_gt"},   {"lt", "fl_lt"},           {"gte", "fl_gte"},
                                         {"lte", "fl_lte"}, {"concat", "fl_concat"}};
  size_t i;
  for (i = 0; i < sizeof table / sizeof table[0]; i += 1) {
    if (strcmp(table[i][0], op) == 0) return table[i][1];
  }
  return NULL;
}

static int replay_helper_operation(const node_t *n, const char *op) {
  const item_t *part = find_part(n, "вызов");
  const char *helper = operation_helper(op);
  char temp[1024], l[1024], r[1024], want[4200];
  if (helper == NULL) return -1;
  value_of(n, temp, sizeof temp);
  value_of(child_at(n, 0), l, sizeof l);
  value_of(child_at(n, 1), r, sizeof r);
  if (!is_ident(temp)) {
    rule_mismatch(n, "значение операции «%s» — не имя временного%s", temp, "");
    return 0;
  }
  if (!replay_temp_decl(n, part, temp)) return 0;
  snprintf(want, sizeof want, "FL_TRY(%s(ctx, %s, %s, &%s, error));", helper, l, r, temp);
  return expect_line(n, part, 1, want) && part_lines(part) == 2;
}

/* ── сторож меры: переигрывается по образцу (ADR-0104) ───────────────────────
 *
 * Сторож печатается не из исходника, а понижением (flang/self/defunc.flang), и
 * форма его закрыта: у постоянного шага «пусть шаг = довод; если шаг < п то шаг
 * иначе «мера убывает» от шаг и п» и функция «мера убывает» с одним обещанием
 * «результат < мера»; у объявленной меры доводы связаны «пусть», затем «мера
 * витка» и «мера шага», первый довод вызова — «если (Мера убыла от шага и витка)
 * то довод 1 иначе «объявленная мера убывает» от шага, витка и довода 1», а
 * функция сторожа обещает три вещи: шаг < мера, шаг ≥ 0, шаг − (шаг остаток от
 * 1) = шаг. Здесь эта форма сличается узел в узел:
 *   · МЕСТО — узлы, которые сторож кладёт вокруг вызова, стоят ровно на месте
 *     этого вызова (у постоянного шага — на месте довода); мера витка — узлы
 *     строки «убывает» своей функции, начиная с первого знака выражения; мера
 *     шага — та же мера, где каждый параметр вызываемой функции заменён своим
 *     доводом (у самовызова — узел в узел);
 *   · СТРОГОСТЬ — сравнение мер операцией lt, и в «если» витка, и в обещании
 *     функции сторожа; lte на этом месте — отказ;
 *   · ВЕТВЬ — виток продолжает ветвь «то» (довод как есть), а вызов сторожа
 *     стоит в «иначе»; функция сторожа отдаёт свой довод «значение» («шаг»).
 * Сверх того имена C сравниваемых мер — те, что объявлены их «пусть» и
 * подписью функции сторожа. Узел, сличённый по образцу, помечается; его место
 * больше не поблажка. Чего образец не знает — самовызова нет (вызывается
 * другая функция) — то остаётся прежней поблажкой и называется числом.
 */

static unsigned long measure_replayed = 0; /* узлы сторожа, сличённые по образцу */

static void measure_mark(const node_t *n) {
  size_t i;
  ((node_t *)n)->guard_checked = 1;
  for (i = 0; i < n->count; i += 1) {
    if (!n->items[i].is_part) measure_mark(n->items[i].child);
  }
}

static int measure_refuse(const node_t *n, const char *fmt, const char *a, const char *b) {
  rule_mismatch(n, fmt, a, b);
  return 0;
}

static int rule_is(const node_t *n, const char *rule) { return n != NULL && !n->is_block && strcmp(n->rule, rule) == 0; }

static int word_is(const node_t *n, const char *word, const char *want) {
  char got[512];
  return n != NULL && extra_word(n, word, got, sizeof got) && strcmp(got, want) == 0;
}

static int value_is(const node_t *n, const char *want) {
  char got[1024];
  if (n == NULL || n->value == NULL) return 0;
  value_of(n, got, sizeof got);
  return strcmp(got, want) == 0;
}

static int same_place(const node_t *a, const node_t *b) {
  return a != NULL && b != NULL && a->line == b->line && a->column == b->column;
}

/* «переменная «имя»» со значением C — ровно cid. */
static int measure_var(const node_t *n, const char *name, const char *cid) {
  return rule_is(n, "переменная") && child_count(n) == 0 && word_is(n, "имя", name) && value_is(n, cid);
}

static int measure_number(const node_t *n, double want) {
  char v[256], inner[256];
  double got;
  size_t k;
  if (!rule_is(n, "литерал") || child_count(n) != 0 || n->value == NULL) return 0;
  value_of(n, v, sizeof v);
  k = strlen(v);
  if (strncmp(v, "fl_number(", 10) != 0 || k < 12 || v[k - 1] != ')') return 0;
  copy_field(inner, sizeof inner, v + 10, k - 11);
  return c_number(inner, &got) && got == want;
}

static int measure_false(const node_t *n) {
  return rule_is(n, "литерал") && child_count(n) == 0 && value_is(n, "fl_flag(false)");
}

static int measure_op(const node_t *n, const char *op) {
  return rule_is(n, "операция-вызовом") && child_count(n) == 2 && word_is(n, "операция", op);
}

static const node_t *measure_cond(const node_t *n) {
  if (!rule_is(n, "признак") || child_count(n) != 1 || !word_is(n, "помощник", "fl_cond")) return NULL;
  return child_at(n, 0);
}

static const node_t *measure_put(const node_t *n) {
  if (!rule_is(n, "положить") || child_count(n) != 1) return NULL;
  return child_at(n, 0);
}

/* Имя C, которое объявил «пусть»: «const fl_value X = …». */
static int let_c_name(const node_t *let, char *out, size_t cap) {
  const item_t *decl = find_part(let, "объявление");
  line_t got;
  const char *eq;
  if (decl == NULL || !part_line(decl, 0, &got) || strncmp(got.text, "const fl_value ", 15) != 0) return 0;
  eq = strstr(got.text, " = ");
  if (eq == NULL) return 0;
  copy_field(out, cap, got.text + 15, (size_t)(eq - got.text - 15));
  return is_ident(out);
}

static int is_let(const node_t *n) { return rule_is(n, "пусть") || rule_is(n, "хвост-пусть"); }

static int is_call_rule(const node_t *n) {
  return rule_is(n, "вызов") || rule_is(n, "хвост-цикл") || rule_is(n, "хвост-возврат") || rule_is(n, "хвост-отскок");
}

/* Строгость: «шаг < мера» — операция lt над двумя именами. */
static int measure_strict(const node_t *n, const char *step, const char *step_c, const char *measure,
                          const char *measure_c) {
  char op[32];
  if (!rule_is(n, "операция-вызовом") || child_count(n) != 2 || !extra_word(n, "операция", op, sizeof op))
    return measure_refuse(n, "сторож меры: мера сравнивается не операцией двух мест%s%s", "", "");
  if (strcmp(op, "lt") != 0)
    return measure_refuse(n, "сторож меры: строгость сравнения мер — ждали «lt», напечатано «%s»%s", op, "");
  if (!measure_var(child_at(n, 0), step, step_c) || !measure_var(child_at(n, 1), measure, measure_c))
    return measure_refuse(n, "сторож меры: сравниваются не «%s» и «%s» с их именами C", step, measure);
  return 1;
}

/* Неотрицательность «шаг ≥ 0» и целость «шаг − (шаг остаток от 1) = шаг». */
static int measure_nonnegative(const node_t *n, const char *step, const char *step_c) {
  if (!measure_op(n, "gte") || !measure_var(child_at(n, 0), step, step_c) || !measure_number(child_at(n, 1), 0.0))
    return measure_refuse(n, "сторож меры: неотрицательность — ждали «%s» gte 0%s", step, "");
  return 1;
}

static int measure_whole(const node_t *n, const char *step, const char *step_c) {
  const node_t *sub = child_at(n, 0), *mod = sub == NULL ? NULL : child_at(sub, 1);
  if (!measure_op(n, "eq") || !measure_var(child_at(n, 1), step, step_c) || !measure_op(sub, "sub") ||
      !measure_var(child_at(sub, 0), step, step_c) || !measure_op(mod, "mod") ||
      !measure_var(child_at(mod, 0), step, step_c) || !measure_number(child_at(mod, 1), 1.0))
    return measure_refuse(n, "сторож меры: целость — ждали «%s» минус («%s» остаток от 1) равно ему же", step, step);
  return 1;
}

static int measure_declared(const char *name) {
  return strncmp(name, "объявленная мера убывает", strlen("объявленная мера убывает")) == 0;
}

/* Функция сторожа: подпись, ответ, обещания — по образцу. */
static int replay_measure_function(const node_t *block, const char *name) {
  int declared = measure_declared(name);
  const char *promise = declared ? "объявленная мера убывает" : "мера убывает";
  const item_t *res = find_part(block, "результат"), *ret = find_part(block, "возврат");
  char params[4][128], temp[256], want[1200];
  size_t want_params = declared ? 3 : 2, k;
  const node_t *answer = child_at(block, 0);
  line_t got;
  if (signature_params(block, params, 4) != want_params)
    return measure_refuse(block, "сторож меры: у функции «%s» не %s параметров", name, declared ? "три" : "два");
  if (child_count(block) != (declared ? 4u : 2u))
    return measure_refuse(block, "сторож меры: у функции «%s» не ответ и %s", name,
                          declared ? "три обещания" : "одно обещание");
  if (!measure_var(answer, declared ? "значение" : "шаг", params[declared ? 2 : 0]))
    return measure_refuse(block, "сторож меры: функция «%s» отдаёт не свой довод «%s»", name,
                          declared ? "значение" : "шаг");
  if (res == NULL || part_lines(res) != 1 || !part_line(res, 0, &got) || strncmp(got.text, "const fl_value ", 15) != 0)
    return measure_refuse(block, "сторож меры: у функции «%s» нет ответа во временном%s", name, "");
  copy_field(temp, sizeof temp, got.text + 15, strcspn(got.text + 15, " "));
  snprintf(want, sizeof want, "const fl_value %s = %s;", temp, params[declared ? 2 : 0]);
  if (!is_ident(temp) || strcmp(got.text, want) != 0)
    return measure_refuse(block, "сторож меры: ответ функции «%s» не «%s»", name, want);
  snprintf(want, sizeof want, "*result = %s;", temp);
  if (ret == NULL || part_lines(ret) != 2 || !expect_line(block, ret, 0, want) ||
      !expect_line(block, ret, 1, "return FL_OK;"))
    return 0;
  for (k = 1; k < child_count(block); k += 1) {
    const node_t *p = child_at(block, k), *expr = child_at(p, 0);
    if (!rule_is(p, "постусловие") || child_count(p) != 1 || !word_is(p, "имя", promise))
      return measure_refuse(block, "сторож меры: у функции «%s» узел не обещание «%s»", name, promise);
    if (k == 1 && !(declared ? measure_strict(expr, "шаг", params[0], "мера", params[1])
                             : measure_strict(expr, "результат", temp, "мера", params[1])))
      return 0;
    if (k == 2 && !measure_nonnegative(expr, "шаг", params[0])) return 0;
    if (k == 3 && !measure_whole(expr, "шаг", params[0])) return 0;
  }
  measure_mark(block);
  ((node_t *)block)->guard_checked = 0; /* блок не узел: в счёт не идёт */
  return 1;
}

/* Имя k-го (с 0) параметра функции «имя» исходника — из строки «принимает»:
 * у каждого «:» имя стоит между предыдущей «, » (или словом «принимает») и им. */
static int source_param_name(const char *fname, size_t k, char *out, size_t cap) {
  size_t i, len = strlen(fname);
  const char *key = "  принимает ";
  for (i = 0; i < source_lines.count; i += 1) {
    const char *found;
    size_t found_len, j;
    if (!source_function_name(source_lines.items[i], &found, &found_len) || found_len != len ||
        memcmp(found, fname, len) != 0)
      continue;
    for (j = i + 1; j < source_lines.count; j += 1) {
      span_t s = source_lines.items[j];
      size_t c, start = strlen(key), seen = 0;
      if (s.len < strlen(key) || memcmp(s.text, key, strlen(key)) != 0) continue;
      for (c = start; c < s.len; c += 1) {
        size_t from = start, b;
        if (s.text[c] != ':') continue;
        for (b = start; b + 1 < c; b += 1) {
          if (s.text[b] == ',' && s.text[b + 1] == ' ') from = b + 2;
        }
        if (seen == k) {
          const char *p = s.text + from, *q = s.text + c;
          if (q - p >= 4 && strncmp(p, "«", 2) == 0 && strncmp(q - 2, "»", 2) == 0) {
            p += 2;
            q -= 2;
          }
          copy_field(out, cap, p, (size_t)(q - p));
          return 1;
        }
        seen += 1;
        start = c + 1;
      }
      return 0;
    }
    return 0;
  }
  return 0;
}

/* Индекс параметра «имя» у функции исходника; -1 — нет такого. */
static long source_param_index(const char *fname, const char *param) {
  char got[512];
  size_t k;
  for (k = 0; source_param_name(fname, k, got, sizeof got); k += 1) {
    if (strcmp(got, param) == 0) return (long)k;
  }
  return -1;
}

/* Постоянный шаг: «пусть шаг = довод; если шаг < п то шаг иначе сторож». */
static int replay_measure_step(const node_t *g, const char *name, const node_t *iff, const node_t *other) {
  const node_t *let = iff->parent, *call = let == NULL ? NULL : let->parent, *block = enclosing_block(g);
  const node_t *arg = let == NULL ? NULL : child_at(let, 0);
  char step[512], step_c[512], callee[512], fn[512], measure[512], measure_c[128], params[64][128];
  size_t k, count;
  long at;
  if (!is_let(let) || child_count(let) != 2 || child_at(let, 1) != iff || !extra_word(let, "имя", step, sizeof step) ||
      !let_c_name(let, step_c, sizeof step_c) || !is_call_rule(call) || block == NULL ||
      !block_function_name(block, fn, sizeof fn) || !extra_word(call, "имя", callee, sizeof callee))
    return measure_refuse(g, "сторож меры: вызов «%s» стоит не в «пусть шаг» довода%s", name, "");
  if (strcmp(callee, fn) != 0) return 1; /* не самовызов: образца нет, остаётся поблажка */
  if (!same_place(let, arg) || !same_place(iff, let) || !same_place(g, let) || !same_place(other, let))
    return measure_refuse(g, "сторож меры: «%s» и его «если» стоят не на месте довода вызова «%s»", name, callee);
  for (k = 0; k < child_count(call) && child_at(call, k) != let; k += 1) continue;
  count = signature_params(block, params, 64);
  if (k == child_count(call) || !source_param_name(callee, k, measure, sizeof measure) ||
      (at = source_param_index(fn, measure)) < 0 || count == (size_t)-1 || (size_t)at >= count)
    return measure_refuse(g, "сторож меры: шаг «%s» не довод параметра функции «%s»", step, fn);
  copy_field(measure_c, sizeof measure_c, params[at], strlen(params[at]));
  if (!measure_strict(measure_cond(child_at(iff, 0)), step, step_c, measure, measure_c)) return 0;
  if (!measure_var(measure_put(child_at(iff, 1)), step, step_c))
    return measure_refuse(iff, "сторож меры: ветвь «то», которая продолжает виток, отдаёт не шаг «%s»%s", step, "");
  if (child_count(g) != 2 || !measure_var(child_at(g, 0), step, step_c) || !measure_var(child_at(g, 1), measure, measure_c))
    return measure_refuse(g, "сторож меры: «%s» зовётся не от шага «%s» и параметра", name, step);
  ((node_t *)let)->guard_checked = 1;
  ((node_t *)iff)->guard_checked = 1;
  measure_mark(child_at(iff, 0));
  measure_mark(child_at(iff, 1));
  measure_mark(other);
  return 1;
}

/* Мера шага — мера витка, где параметр i заменён доводом i: узел в узел. */
static int measure_renamed(const node_t *was, const node_t *now, const char *fn, char lets[][512], char cids[][512],
                           size_t count) {
  size_t k;
  if (was == NULL || now == NULL || strcmp(was->rule, now->rule) != 0 || strcmp(was->kind, now->kind) != 0 ||
      !same_place(was, now) || child_count(was) != child_count(now))
    return 0;
  if (rule_is(was, "переменная")) {
    char name[512], value[1024];
    long at;
    if (!extra_word(was, "имя", name, sizeof name)) return 0;
    at = source_param_index(fn, name);
    if (at < 0 || (size_t)at >= count) {
      value_of(was, value, sizeof value);
      return measure_var(now, name, value);
    }
    return measure_var(now, lets[at], cids[at]);
  }
  if (was->extra_len != now->extra_len || memcmp(was->extra, now->extra, was->extra_len) != 0) return 0;
  for (k = 0; k < child_count(was); k += 1) {
    if (!measure_renamed(child_at(was, k), child_at(now, k), fn, lets, cids, count)) return 0;
  }
  return 1;
}

/* Мера витка стоит на строке «убывает» и начинается с первого знака выражения. */
static int measure_on_line(const node_t *n, long line, long *leftmost) {
  size_t k;
  if (n->line != 0 || n->column != 0) {
    if (n->line != line) return 0;
    if (*leftmost == 0 || n->column < *leftmost) *leftmost = n->column;
  }
  for (k = 0; k < child_count(n); k += 1) {
    if (!measure_on_line(child_at(n, k), line, leftmost)) return 0;
  }
  return 1;
}

static long measure_start_column(long line) {
  span_t s;
  const char *key = "  убывает ";
  size_t k = strlen(key);
  if (line < 1 || (size_t)line > source_lines.count) return 0;
  s = source_lines.items[line - 1];
  if (s.len < k || memcmp(s.text, key, k) != 0) return 0;
  while (k < s.len && s.text[k] == ' ') k += 1;
  return (long)utf8_len(s.text, k) + 1;
}

/* Объявленная мера: доводы, мера витка, мера шага, «если (Мера убыла …)». */
static int replay_measure_declared(const node_t *g, const char *name, const node_t *iff, const node_t *other) {
  const node_t *call = iff->parent, *block = enclosing_block(g), *step_let, *turn_let, *cur, *mu, *inner;
  const node_t *lets[64];
  char callee[512], fn[512], names[64][512], cids[64][512], step[512], step_c[512], turn[512], turn_c[512];
  size_t count, i;
  long line, leftmost = 0;
  if (!is_call_rule(call) || child_at(call, 0) != iff || block == NULL || !block_function_name(block, fn, sizeof fn) ||
      !extra_word(call, "имя", callee, sizeof callee))
    return measure_refuse(g, "сторож меры: «если» сторожа «%s» не первый довод вызова%s", name, "");
  if (strcmp(callee, fn) != 0) return 1; /* не самовызов: образца нет, остаётся поблажка */
  count = child_count(call);
  step_let = call->parent;
  turn_let = step_let == NULL ? NULL : step_let->parent;
  if (count == 0 || count > 64 || source_params(callee) != (long)count || !is_let(step_let) || !is_let(turn_let) ||
      child_count(step_let) != 2 || child_count(turn_let) != 2 || child_at(step_let, 1) != call ||
      child_at(turn_let, 1) != step_let || !extra_word(step_let, "имя", step, sizeof step) ||
      !let_c_name(step_let, step_c, sizeof step_c) || !extra_word(turn_let, "имя", turn, sizeof turn) ||
      !let_c_name(turn_let, turn_c, sizeof turn_c))
    return measure_refuse(g, "сторож меры: вокруг вызова «%s» нет «пусть» меры витка и меры шага%s", callee, "");
  cur = turn_let;
  for (i = count; i > 0; i -= 1) {
    const node_t *up = cur->parent;
    if (!is_let(up) || child_count(up) != 2 || child_at(up, 1) != cur || !extra_word(up, "имя", names[i - 1], 512) ||
        !let_c_name(up, cids[i - 1], 512))
      return measure_refuse(g, "сторож меры: доводы вызова «%s» связаны «пусть» не все%s", callee, "");
    lets[i - 1] = up;
    cur = up;
  }
  for (i = 0; i < count; i += 1) {
    const node_t *arg = child_at(lets[i], 0), *prev = i == 0 ? call : child_at(lets[i - 1], 0);
    if (!same_place(lets[i], call)) break;
    if (arg->line != 0 && (arg->line < prev->line || (arg->line == prev->line && arg->column <= prev->column))) break;
  }
  if (i < count || !same_place(turn_let, call) || !same_place(step_let, call) || !same_place(iff, call) ||
      !same_place(g, call) || !same_place(other, call))
    return measure_refuse(g, "сторож меры: «пусть» и «если» сторожа стоят не на месте вызова «%s» или доводы не по порядку%s",
                          callee, "");
  for (i = 1; i < count; i += 1) {
    if (!measure_var(child_at(call, i), names[i], cids[i]))
      return measure_refuse(call, "сторож меры: довод витка не «%s»%s", names[i], "");
  }
  line = measure_line(fn);
  if (line == 0 || !measure_on_line(child_at(turn_let, 0), line, &leftmost) || leftmost != measure_start_column(line))
    return measure_refuse(turn_let, "сторож меры: мера витка «%s» — не выражение строки «убывает» функции «%s»", turn, fn);
  if (!measure_renamed(child_at(turn_let, 0), child_at(step_let, 0), fn, names, cids, count))
    return measure_refuse(step_let, "сторож меры: мера шага «%s» — не мера витка на доводах вызова «%s»", step, callee);
  mu = measure_cond(child_at(iff, 0));
  inner = rule_is(mu, "если") && child_count(mu) == 3 ? measure_put(child_at(mu, 1)) : NULL;
  if (!rule_is(mu, "если") || child_count(mu) != 3)
    return measure_refuse(iff, "сторож меры: признак сторожа — не «Мера убыла»%s%s", "", "");
  if (!measure_strict(measure_cond(child_at(mu, 0)), step, step_c, turn, turn_c)) return 0;
  if (!rule_is(inner, "если") || child_count(inner) != 3 || !measure_false(measure_put(child_at(mu, 2))) ||
      !measure_false(measure_put(child_at(inner, 2))))
    return measure_refuse(mu, "сторож меры: ветви «Мера убыла» не по образцу%s%s", "", "");
  if (!measure_nonnegative(measure_cond(child_at(inner, 0)), step, step_c) ||
      !measure_whole(measure_put(child_at(inner, 1)), step, step_c))
    return 0;
  if (!measure_var(measure_put(child_at(iff, 1)), names[0], cids[0]))
    return measure_refuse(iff, "сторож меры: ветвь «то», которая продолжает виток, отдаёт не первый довод «%s»%s",
                          names[0], "");
  if (child_count(g) != 3 || !measure_var(child_at(g, 0), step, step_c) || !measure_var(child_at(g, 1), turn, turn_c) ||
      !measure_var(child_at(g, 2), names[0], cids[0]))
    return measure_refuse(g, "сторож меры: «%s» зовётся не от меры шага, меры витка и первого довода%s", name, "");
  for (i = 0; i < count; i += 1) ((node_t *)lets[i])->guard_checked = 1;
  ((node_t *)turn_let)->guard_checked = 1;
  ((node_t *)step_let)->guard_checked = 1;
  ((node_t *)iff)->guard_checked = 1;
  measure_mark(child_at(step_let, 0));
  measure_mark(child_at(iff, 0));
  measure_mark(child_at(iff, 1));
  measure_mark(other);
  return 1;
}

static int replay_measure_call(const node_t *g, const char *name) {
  const node_t *other = g->parent, *iff = other == NULL ? NULL : other->parent;
  if (!rule_is(other, "положить") || child_count(other) != 1 || !rule_is(iff, "если") || child_count(iff) != 3)
    return measure_refuse(g, "сторож меры: вызов «%s» стоит не в ветви своего «если»%s", name, "");
  if (child_at(iff, 1) == other)
    return measure_refuse(iff, "сторож меры: ветви перепутаны — вызов «%s» стоит в «то», а виток продолжает «иначе»%s",
                          name, "");
  if (child_at(iff, 2) != other)
    return measure_refuse(g, "сторож меры: вызов «%s» стоит не в ветви «иначе»%s", name, "");
  return measure_declared(name) ? replay_measure_declared(g, name, iff, other) : replay_measure_step(g, name, iff, other);
}

static void replay_measure_guards(const protocol_t *pr, const node_t *n) {
  char name[512], fn[512];
  size_t i;
  if (n->is_block && is_generated_measure(pr, n) && block_function_name(n, name, sizeof name))
    replay_measure_function(n, name);
  if (rule_is(n, "вызов") && extra_word(n, "имя", name, sizeof name) && is_measure_guard_name(name) &&
      (enclosing_function(n, fn, sizeof fn) == NULL || !is_measure_guard_name(fn)))
    replay_measure_call(n, name);
  for (i = 0; i < n->count; i += 1) {
    if (!n->items[i].is_part) replay_measure_guards(pr, n->items[i].child);
  }
}

static unsigned long count_measure_checked(const node_t *n) {
  unsigned long total = n->guard_checked ? 1 : 0;
  size_t i;
  for (i = 0; i < n->count; i += 1) {
    if (!n->items[i].is_part) total += count_measure_checked(n->items[i].child);
  }
  return total;
}

/* ── порядок детей: по местам исходника, а не по порядку протокола ────────────
 *
 * Значение узла правило считает по значениям детей В ПОРЯДКЕ ПРОТОКОЛА. Пока
 * этот порядок ничем не привязан к исходнику, довольно переставить в протоколе
 * два блока детей — и «н не больше 0» печатается как «0 не больше н»: значение
 * сойдётся, текст сойдётся, а программа стала другой. Поэтому дети обязаны
 * идти по НЕУБЫВАНИЮ места исходника (строка, потом столбец).
 *
 * Не строгое возрастание, а неубывание: обёртка («положить», «признак») берёт
 * место того, что она обёртывает, и два ребёнка честно стоят на одном месте.
 *
 * Два исключения, оба — не поблажка правилу, а замер того, где места нет:
 *   · дети БЕЗ МЕСТА (нули) в порядок не входят — их место неизвестно, и
 *     сличитель не сличает их нигде;
 *   · ребёнок, стоящий РОВНО НА МЕСТЕ САМОГО УЗЛА, в порядок не входит: его
 *     туда поставил не пишущий, а разбор. Замерено печатью «если (н больше 0) и
 *     притом (м больше 0)»: связка «и»/«или»/«не» сводится к «если», и ветвь
 *     -литерал, которой в исходнике нет, встаёт на саму связку — то есть на
 *     место узла «если», между двумя писаными ветвями. То же у порождённого
 *     дефункционализацией вызова «применить N»: его первый довод —
 *     значение-функция, стоящая там же, где сам вызов. Требуй здесь порядка —
 *     сличитель отвергал бы честную печать (проверено прогоном: три функции со
 *     связками, две отвергались).
 */
static void check_child_order(const node_t *n) {
  size_t k, count = child_count(n);
  const node_t *prev = NULL;
  for (k = 0; k < count; k += 1) {
    const node_t *c = child_at(n, k);
    if (c == NULL || (c->line == 0 && c->column == 0)) continue;
    if (c->line == n->line && c->column == n->column) continue;
    if (prev != NULL && (c->line < prev->line || (c->line == prev->line && c->column < prev->column))) {
      char who[512], seen[256];
      describe(n, who, sizeof who);
      snprintf(seen, sizeof seen, "ребёнок %lu на строке %ld столбце %ld, а предыдущий — на строке %ld столбце %ld",
               (unsigned long)k, c->line, c->column, prev->line, prev->column);
      mismatch(who, "дети стоят не в порядке мест исходника: %s%s", seen, "");
      return;
    }
    prev = c;
  }
}

static void replay_node(const node_t *n) {
  int r = rule_index(n->rule), ok = -1;
  if (!n->is_block && !check_anchor(n)) return;
  if (!n->is_block) check_child_order(n);
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
  else if (strcmp(n->rule, "хвост-пусть") == 0) ok = replay_tail_let(n);
  else if (strcmp(n->rule, "хвост-если") == 0) ok = replay_tail_if(n);
  else if (strcmp(n->rule, "хвост-цикл") == 0) ok = replay_tail_loop(n);
  else if (strcmp(n->rule, "хвост-возврат") == 0) ok = replay_tail_return(n);
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
  else if (strcmp(n->rule, "отфильтровать") == 0) ok = replay_filter(n);
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
  replay_measure_guards(&pr, &pr.root);
  measure_replayed = count_measure_checked(&pr.root);
  walk(&pr.root);
  if (refused) return 1;
  lay_out_file(&pr);
  match_text(c_text, c_len);
  if (!verdict_failed) check_names();
  check_completeness(&pr);
  if (verdict_failed) return 1;
  for (i = 0; i < RULE_COUNT; i += 1) {
    total_replayed += replayed[i];
    total_unreplayed += unreplayed[i];
  }
  printf("узлов в протоколе %lu; переиграно правилом %lu, принято на слово %lu\n", (unsigned long)pr.node_count,
         total_replayed, total_unreplayed);
  if (measure_replayed > 0)
    printf("узлов сторожа меры %lu: место, строгость сравнения мер и ветвь, продолжающая виток, сличены по образцу\n",
           measure_replayed);
  if (pr.digest[0] == '\0' || total_unreplayed > 0 || measure_born > 0) {
    printf("НЕ ПРОВЕРЕНО — текст C сошёлся с протоколом байт в байт, противоречий нет, но:\n");
    if (pr.digest[0] == '\0') printf("  привязка к исходнику не криптографическая: в протоколе нет отпечатка\n");
    if (measure_born > 0)
      printf("  узлов сторожа меры %lu: их места в исходнике не сличались\n", measure_born);
    for (i = 0; i < RULE_COUNT; i += 1) {
      if (unreplayed[i] > 0) printf("  правило «%s» не переиграно, узлов %lu\n", RULES[i], unreplayed[i]);
    }
    return 3;
  }
  printf("СОШЛОСЬ\n");
  return 0;
}
