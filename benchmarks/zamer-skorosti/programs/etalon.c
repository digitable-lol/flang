/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/*
 * Те же четыре задачи на обычном C — эталон «чего стоит эта задача, если
 * писать её руками».
 *
 * Он нужен ровно для одного: разложить отставание flang на две части. Между
 * напечатанным C и этим файлом лежит ВСЁ, что делает представление значений и
 * память рантайма; между этим файлом и Python/Node — то, что и должно лежать
 * между компилируемым и интерпретируемым языком.
 *
 * Алгоритмы повторены шаг в шаг, включая неизменяемость: вставка в дерево
 * переписывает путь и возвращает новое дерево, слияние строит новый массив.
 * Иначе сравнение было бы не с flang, а с другой программой.
 *
 * Сборка: cc -std=c99 -O2 -o etalon etalon.c -lm
 * Запуск: ./etalon коллатц 50000
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define A 25173.0
#define C_ 13849.0
#define M 65536.0

static double lcg(double x) {
  double v = A * x + C_;
  return v - M * (double)(long long)(v / M);
}

/* ── задача 1: счёт на числах ─────────────────────────────────────────────── */

static double shagov_kollatca(double n) {
  double nabrano = 0;
  while (n > 1) {
    n = ((long long)n % 2 == 0) ? n / 2 : 3 * n + 1;
    nabrano += 1;
  }
  return nabrano;
}

static double kollatc(long predel) {
  double summa = 0;
  long i;
  for (i = 1; i <= predel; i += 1) {
    summa += shagov_kollatca((double)i);
  }
  return summa;
}

/* ── задача 1-бис: НОД ────────────────────────────────────────────────────── */

static double nod(double a, double b) {
  while (b != 0) {
    double ost = fmod(a, b);
    a = b;
    b = ost;
  }
  return a;
}

static double nod_zadacha(long predel) {
  double summa = 0;
  long i;
  for (i = 1; i <= predel; i += 1) summa += nod((double)i, 40902.0);
  return summa;
}

/* ── задача 2: сортировка слиянием ────────────────────────────────────────── */

typedef struct {
  double *items;
  size_t count;
} list;

static list cherez_odin(list src, size_t start) {
  list out;
  size_t i;
  out.count = start < src.count ? (src.count - start + 1) / 2 : 0;
  out.items = out.count == 0 ? NULL : malloc(out.count * sizeof(double));
  out.count = 0;
  for (i = start; i < src.count; i += 2) {
    out.items[out.count] = src.items[i];
    out.count += 1;
  }
  return out;
}

static list sliyanie(list a, list b) {
  list out;
  size_t i = 0, j = 0, k = 0;
  out.count = a.count + b.count;
  out.items = out.count == 0 ? NULL : malloc(out.count * sizeof(double));
  while (i < a.count && j < b.count) {
    if (a.items[i] <= b.items[j]) out.items[k++] = a.items[i++];
    else out.items[k++] = b.items[j++];
  }
  while (i < a.count) out.items[k++] = a.items[i++];
  while (j < b.count) out.items[k++] = b.items[j++];
  return out;
}

static list sortirovka(list src) {
  list levaya, pravaya, sl, sp, out;
  if (src.count <= 1) return src;
  levaya = cherez_odin(src, 0);
  pravaya = cherez_odin(src, 1);
  sl = sortirovka(levaya);
  sp = sortirovka(pravaya);
  if (sl.items != levaya.items) free(levaya.items);
  if (sp.items != pravaya.items) free(pravaya.items);
  out = sliyanie(sl, sp);
  free(sl.items);
  free(sp.items);
  return out;
}

static double otpechatok(list src) {
  double acc = 0;
  size_t i;
  for (i = 0; i < src.count; i += 1) {
    double v = acc * 31 + src.items[i];
    acc = v - 1000003.0 * (double)(long long)(v / 1000003.0);
  }
  return acc;
}

static double sortirovka_zadacha(long skolko) {
  list src, готово;
  double x = 12345, otvet;
  long i;
  src.count = (size_t)skolko;
  src.items = malloc(src.count * sizeof(double));
  for (i = 0; i < skolko; i += 1) {
    x = lcg(x);
    src.items[i] = x;
  }
  готово = sortirovka(src);
  otvet = otpechatok(готово);
  return otvet;
}

/* ── задача 3: обход дерева ───────────────────────────────────────────────── */

typedef struct node {
  double key;
  struct node *left;
  struct node *right;
} node;

static node *make(double key, node *left, node *right) {
  node *n = malloc(sizeof(node));
  n->key = key;
  n->left = left;
  n->right = right;
  return n;
}

/* Неизменяемая вставка: переписывается только путь, остальное общее. */
static node *vstavit(node *tree, double novyy) {
  if (tree == NULL) return make(novyy, NULL, NULL);
  if (novyy < tree->key) return make(tree->key, vstavit(tree->left, novyy), tree->right);
  return make(tree->key, tree->left, vstavit(tree->right, novyy));
}

static double summa_dereva(node *tree) {
  if (tree == NULL) return 0;
  return (tree->key + summa_dereva(tree->left)) + summa_dereva(tree->right);
}

static double glubina_dereva(node *tree) {
  double l, r;
  if (tree == NULL) return 0;
  l = glubina_dereva(tree->left);
  r = glubina_dereva(tree->right);
  return (l > r ? l : r) + 1;
}

static double obhod_dereva(long skolko) {
  node *tree = NULL;
  double x = 12345;
  long i;
  for (i = 0; i < skolko; i += 1) {
    x = lcg(x);
    tree = vstavit(tree, x);
  }
  return summa_dereva(tree) + 1000000.0 * glubina_dereva(tree);
}

/* ── задача 4: разбор строк ───────────────────────────────────────────────── */

static double razbor_strok(long raz) {
  const char *base = "17,42,8,99,3,71,25,60,14,88";
  size_t len = strlen(base);
  char *text = malloc(len + 1);
  double acc = 0;
  const char *p;
  long i;
  memcpy(text, base, len + 1);
  for (i = 0; i < raz; i += 1) {
    char *next = malloc(len * 2 + 2);
    memcpy(next, text, len);
    next[len] = ',';
    memcpy(next + len + 1, text, len);
    next[len * 2 + 1] = '\0';
    free(text);
    text = next;
    len = len * 2 + 1;
  }
  p = text;
  for (;;) {
    char *end = NULL;
    double v = strtod(p, &end);
    double w = acc * 31 + v;
    acc = w - 1000003.0 * (double)(long long)(w / 1000003.0);
    if (*end == '\0') break;
    p = end + 1;
  }
  free(text);
  return acc;
}

int main(int argc, char **argv) {
  long n;
  if (argc != 3) {
    fprintf(stderr, "использование: etalon {коллатц|сортировка|дерево|строки} РАЗМЕР\n");
    return 2;
  }
  n = strtol(argv[2], NULL, 10);
  if (strcmp(argv[1], "коллатц") == 0) printf("%.0f\n", kollatc(n));
  else if (strcmp(argv[1], "нод") == 0) printf("%.0f\n", nod_zadacha(n));
  else if (strcmp(argv[1], "сортировка") == 0) printf("%.0f\n", sortirovka_zadacha(n));
  else if (strcmp(argv[1], "дерево") == 0) printf("%.0f\n", obhod_dereva(n));
  else if (strcmp(argv[1], "строки") == 0) printf("%.0f\n", razbor_strok(n));
  else {
    fprintf(stderr, "неизвестная задача\n");
    return 2;
  }
  return 0;
}
