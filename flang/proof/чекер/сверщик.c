/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/* СВЕДЁННЫЙ ЧЕКЕР (ячейка Ч29) — независимая проверка записи доказательства.
 *
 *   сверщик <исходник.flang> <запись>
 *   код 0 — сошлось; 1 — не сошлось, беда названа; 2 — кривой вызов.
 *
 * ── ЧТО ЭТО И ОТКУДА ВЗЯТО ───────────────────────────────────────────────────
 * Свод двух работ отряда, без единой строки от flang и без единой библиотеки
 * кроме libc:
 *   ДИСЦИПЛИНА ЧТЕНИЯ — от остова Ч2: поток читается сам, отказ на лишний байт,
 *     ни одного «ладно» по умолчанию, выход за край списка даёт пустую строку,
 *     то есть несовпадение, а не молчаливое согласие.
 *   САМА ПРОВЕРКА — от сверщика Ч21 (`flang/proof/сверщик.flang`, 2164 строки):
 *     привязка к исходнику, сличение разметки, шаги, закрытие, круг, покрытие,
 *     полнота, закрытый список из 15 правил, проигрывание сведения семью ходами
 *     и двумя законами, счёт долга.
 *
 * Здесь этот сверщик написан заново на C. Он не «переведён»: машинный перенос
 * той же программы замерен Ч21 и дал 11 816 строк C. Переписаны ТОЛЬКО решения,
 * а не устройство языка вокруг них.
 *
 * ── ЧТО ПРОВЕРЯЕТСЯ ──────────────────────────────────────────────────────────
 *  1. ПРИВЯЗКА. Число строк, число знаков (кодовых точек) и два многочленных
 *     отпечатка исходника. Запись от другой программы отваливается здесь.
 *  2. ЗАПИСЬ НЕ ВЫДУМАНА. Каждая строка записи называет номер строки исходника;
 *     исходник читается сам, и утверждение, теорема, каждый шаг обязаны стоять
 *     там, где сказано, и теми же словами.
 *  3. ШАГИ СОШЛИСЬ ЦЕЛИКОМ. Разметка теоремы читается из исходника и сличается
 *     с разметкой записи знак в знак: подменённый, лишний и пропавший шаг ломают
 *     сличение все трое.
 *  4. ЦЕЛЬ ЗАКРЫТА. У теоремы стоит «следовательно доказано», и в каждом случае
 *     есть шаг без выписанного утверждения — тот, что закрывает цель.
 *  5. КРУГА НЕТ. Ни прямого («У» через «У»), ни через других — берётся замыкание.
 *  6. СЛУЧАИ ПОКРЫВАЮТ ТИП. Посылок ровно столько, сколько у типа вариантов, и
 *     имена вариантов совпадают с объявленными.
 *  7. ЗАПИСЬ ГОВОРИТ ОБО ВСЕЙ ПРОГРАММЕ. Ни одна теорема исходника не замолчана,
 *     утверждений столько же, сколько постусловий.
 *  8. ДОКАЗЫВАЕТСЯ ОБЕЩАННОЕ. Хвост после «утверждаем» знак в знак равен хвосту
 *     после «обеспечивает «имя»».
 *  9. ПРАВИЛО СВЕДЕНИЯ ИЗ ЗАКРЫТОГО СПИСКА (15 имён плюс пустое).
 * 10. СВЕДЕНИЕ ПРОИГРЫВАЕТСЯ ПО ШАГАМ, когда записано ходами: держится список
 *     незакрытых целей, к первой применяется названный ход, и к «ход конец»
 *     целей не должно остаться. Ходов семь, законов два, оба списка закрыты.
 *
 * ── ТРИ ИСХОДА, НАЗВАННЫЕ СЛОВАМИ ───────────────────────────────────────────
 *   0 ПРОВЕРЕНО      — запись сошлась с исходником, привязка к программе
 *                      КРИПТОГРАФИЧЕСКАЯ и ничего не взято на слово.
 *   3 НЕ ПРОВЕРЕНО   — противоречий нет, но что-то не проверено, и оно названо:
 *                      либо места, принятые на слово ядра (числом), либо
 *                      привязка к программе, стоящая на ломаемой свёртке.
 *   1 НЕ СОШЛОСЬ     — найдено противоречие, оно названо.
 *   2 кривой вызов.
 *
 * ── ДОПИСКА Ч55: МОЛЧАНИЕ О ПРИВЯЗКЕ — ТОЖЕ ТРЕТИЙ ИСХОД ────────────────────
 * До Ч55 чекер об отсутствии строки «отпечаток256» МОЛЧАЛ: из 86 записей ядра
 * шестнадцать получали код 0 «ПРОВЕРЕНО», не неся этой строки, — то есть были
 * проверены по свёртке, которую Ч40 сломала за 0,976 с. Теперь так: строки нет
 * и отпечаток не подан доводом — код 3 «привязка к программе не
 * криптографическая». Это НЕ отказ: 86 настоящих записей не подделки, отвергать
 * их значило бы соврать про них. Это ровно третий исход.
 *
 * ── ДОПИСКА Ч55: ПОЛЕ «исходник» — ПРИМЕТА, КОГДА ХЕШ СОШЁЛСЯ ───────────────
 * Когда отпечаток256 сошёлся, поданный файл — та же программа побайтно, и
 * спорить с полем «исходник» не о чем: путь становится подсказкой человеку, где
 * искать файл, а расхождение печатается ПРИМЕТОЙ и на исход не влияет. Пока
 * хеша нет, поле остаётся привязкой и сверяется по-прежнему жёстко.
 *
 * Ключ `--мягко` УБРАН под этим именем: он менял третий исход на код 0 молча, и
 * замером Ч55 показано, что под ним ложь Ч40 `lozh-1-verdikt` снова получала
 * код 0. Прежний договор остался под именем `--старый-код-не-приёмка`, и под
 * ним чекер кричит в поток ошибок, что код 0 приёмкой не является. Ключа
 * `--мягко` чекер больше не знает и падает на нём кодом 2, а не толкует его
 * как-нибудь по-своему (правило Ч27: сторож, молча пропускающий неизвестное,
 * хуже отсутствующего).
 *
 * ── ЧТО ПРИНИМАЕТСЯ НА СЛОВО (в перечень аксиом B4) ──────────────────────────
 * Список закрытый: всё, чего здесь нет, чекер проверяет сам.
 * A1. ИМЯ ПРАВИЛА СВЕДЕНИЯ. Посылка, закрытая одним именем правила, не
 *     пересчитывается: чекер требует лишь, чтобы имя было из закрытого списка.
 *     Шестнадцать имён — шестнадцать теорем, взятых на веру. Число таких мест
 *     печатается в вердикте, и при нём вердикт — «НЕ ПРОВЕРЕНО», не «сошлось».
 * A2. САМ СПИСОК ПРАВИЛ. Что он полон — то есть что ядро не умеет поставить
 *     семнадцатое имя — стережёт отдельный прогон дерева, а не этот файл.
 * A3. ДВА ЗАКОНА. «сумма неотрицательных» и «литерал неотрицателен» —
 *     утверждения об IEEE-754, а не выводы. Приняты на веру.
 * A4. ТЕРМ — СТРОКА, А НЕ ДЕРЕВО. Подтерм ищется по сбалансированным скобкам и
 *     пробельным краям. Строковый литерал со скобкой внутри собьёт счёт: чекер
 *     тогда ОТКАЖЕТ (скобки не сойдутся), а не примет молча.
 * A5. РАВЕНСТВО ТЕРМОВ — СИНТАКСИЧЕСКОЕ. «Ужать» снимает лишние скобки и
 *     пробелы; прочее сравнивается байт в байт.
 * A6. ЯЗЫК ИСХОДНИКА. Чекер знает грамматику flang ровно настолько, чтобы найти
 *     строку. Он НЕ разбирает исходник и не проверяет, что тот компилируется.
 * A7. ВЫЧИСЛЕНИЕ. Ни одного значения чекер не считает: «развернуть» и «выбор» —
 *     чтение написанного, а не вычисление.
 * A8. ШАГ, ОБОСНОВАННЫЙ ПРИМЕРОМ, СВОЙСТВОМ ИЛИ ЗАКОНОМ. Чекер сверяет, что так
 *     написано в исходнике; держится ли обоснование — решало ядро. Считается
 *     отдельным числом вердикта («на слово ядра: шагов N»).
 * A10. ПРЕДУСЛОВИЕ ДЕРЖИТ ВЫЗЫВАЮЩИЙ. Ход «закрыть требованием «имя» строка N»
 *     закрывает цель тем, что у функции написано `требует`. Чекер сверяет две
 *     вещи: что строка N исходника ПРАВДА несёт это требование у этой функции и
 *     что записанный факт слово в слово есть цель. Что вызывающие это требование
 *     и правда доказывают — договор языка, и его держит компилятор, а не чекер.
 *     Ровно один такой ход на корпус (`precondition.flang`), и он назван здесь.
 * A9. ПРИВЯЗКА К ПРОГРАММЕ БЕЗ SHA-256. Когда запись не несёт строки
 *     «отпечаток256» и отпечаток не подан доводом, привязка стоит на
 *     многочленной свёртке ядра и на поле «исходник». Свёртка ЛОМАЕТСЯ: Ч40
 *     решила столкновение приведением решётки за 0,976 с. Чекер печатает
 *     SHA-256 исходника всегда — чтобы было чем пришпилить снаружи. С Ч55 это
 *     место больше не молчит: оно называется вслух и даёт исход 3, а не 0.
 *
 * ── ТЕРМ ПРИ НОМЕРЕ СТРОКИ: ДВОЙНАЯ ПРИВЯЗКА (ячейка Ч56) ────────────────────
 * Ядро печатает НОМЕРА СТРОК, а не термы, и довод у него записан в
 * `flang/self/zapis.flang`: пересказ был бы вторым источником одного и того же и
 * разошёлся бы молча. Довод верен ровно наполовину: второй источник молчит
 * только там, где его не с чем сличить.
 * Ход `развернуть` теперь несёт И номер строки, И тело термом в ⟨уголках⟩. Чекер
 * читает ту же строку исходника сам и сличает прочитанное с записанным.
 * Разойтись им позволено ровно СКОБКАМИ — расстановку скобок несёт разобранное
 * дерево, а текст строки её не несёт, — и работает чекер по ЗАПИСАННОМУ терму,
 * потому что группировка нужна закону суммы. Разойдутся словами — «НЕ СОШЛОСЬ».
 * Счётчик «без привязки к исходнику» при этом НЕ растёт: терм привязан.
 * Прежний будущий вид (терм без номера) принимается по-прежнему, и на нём
 * счётчик растёт, как и раньше.
 *
 * ── ЧЕГО СЕГОДНЯ ПРОВЕРИТЬ НЕЛЬЗЯ ───────────────────────────────────────────
 * Шаг автора, обоснованный примером или свойством, и утверждение, доказанное
 * БЕЗ теоремы вовсе. И то и другое — не беда печати: в объекте доказательства
 * (`check --proof --json`) у них НЕТ ни терма, ни номера строки, печатать
 * нечего. Замер Ч56 по 86 записям корпуса: мест «на слово ядра» 308, из них 159
 * — «теоремы нет», 97 — шаги автора, 52 — посылки; и только 23 посылки во всём
 * корпусе несут в объекте заключение термом. Правится это не здесь и не в
 * печати записи, а в самом ядре доказательств.
 */
#define _POSIX_C_SOURCE 200809L
#include <stdio.h>
#include <unistd.h>
#include <stdlib.h>
#include <string.h>
#include <stdarg.h>

/* ═══════════════════════════ основа: память и строки ═══════════════════════ */

typedef struct Blok { struct Blok *sled; size_t vzyato, ves; char *dno; } Blok;
static Blok *arena;

static void *dai(size_t n) {
  n = (n + 15u) & ~(size_t)15;
  if (!arena || arena->vzyato + n > arena->ves) {
    size_t ves = n > (1u << 20) ? n : (1u << 20);
    Blok *b = malloc(sizeof *b);
    if (!b) exit(2);
    b->dno = malloc(ves);
    if (!b->dno) exit(2);
    b->sled = arena; b->vzyato = 0; b->ves = ves; arena = b;
  }
  { char *p = arena->dno + arena->vzyato; arena->vzyato += n; return p; }
}

static char *kopiya(const char *s, size_t n) {
  char *p = dai(n + 1); memcpy(p, s, n); p[n] = 0; return p;
}

static char *fmt(const char *f, ...) {
  va_list a; int n; char *p; char proba[1];
  va_start(a, f); n = vsnprintf(proba, sizeof proba, f, a); va_end(a);
  if (n < 0) exit(2);
  p = dai((size_t)n + 1);
  va_start(a, f); vsnprintf(p, (size_t)n + 1, f, a); va_end(a);
  return p;
}

typedef struct { char **e; int n, ves; } Sp;   /* список строк */
static const Sp PUSTO = { NULL, 0, 0 };

static void dobavit(Sp *s, char *z) {
  if (s->n == s->ves) {
    int v = s->ves ? s->ves * 2 : 8;
    char **e = dai((size_t)v * sizeof *e);
    if (s->n) memcpy(e, s->e, (size_t)s->n * sizeof *e);
    s->e = e; s->ves = v;
  }
  s->e[s->n++] = z;
}

/* Часть списка по счёту с единицы; нет такой — пустая строка. Выход за край сам
   становится отказом: пустая строка не совпадёт ни с одним ожиданием. */
static char *chast(Sp s, long i) { return (i < 1 || i > s.n) ? (char *)"" : s.e[i - 1]; }

static int nachinaetsya(const char *s, const char *p) { return strncmp(s, p, strlen(p)) == 0; }
static int soderzhit(const char *s, const char *p) { return strstr(s, p) != NULL; }

static Sp razdelit(const char *s, const char *sep) {
  Sp v = PUSTO; size_t k = strlen(sep); const char *p = s, *q;
  if (!k) { dobavit(&v, (char *)s); return v; }
  while ((q = strstr(p, sep)) != NULL) { dobavit(&v, kopiya(p, (size_t)(q - p))); p = q + k; }
  dobavit(&v, kopiya(p, strlen(p)));
  return v;
}

static char *soedinit(Sp v, const char *sep) {
  size_t k = strlen(sep), dl = 1; int i; char *r, *p;
  for (i = 0; i < v.n; i++) dl += strlen(v.e[i]) + k;
  r = dai(dl); p = r; *p = 0;
  for (i = 0; i < v.n; i++) {
    if (i) { memcpy(p, sep, k); p += k; }
    { size_t d = strlen(v.e[i]); memcpy(p, v.e[i], d); p += d; }
  }
  *p = 0; return r;
}

static char *zamenit(const char *s, const char *chto, const char *na) {
  return *chto ? soedinit(razdelit(s, chto), na) : (char *)s;
}

/* Обрезка по краям: пробел, табуляция, возврат каретки. Внутри не трогает. */
static char *obrezat(const char *s) {
  size_t a = 0, b = strlen(s);
  while (a < b && (s[a] == ' ' || s[a] == '\t' || s[a] == '\r')) a++;
  while (b > a && (s[b-1] == ' ' || s[b-1] == '\t' || s[b-1] == '\r')) b--;
  return kopiya(s + a, b - a);
}

static char *slovo(const char *s, long n) { return chast(razdelit(s, " "), n); }

static char *slova_posle(const char *s, long skolko) {
  Sp v = razdelit(s, " "), r = PUSTO; int i;
  for (i = 0; i < v.n; i++) if (i + 1 > skolko) dobavit(&r, v.e[i]);
  return soedinit(r, " ");
}

/* Содержимое N-х ёлочек в строке; нет таких — пустая строка. */
static char *v_yolochkah(const char *s, long n) {
  return chast(razdelit(chast(razdelit(s, "«"), n + 1), "»"), 1);
}
/* Терм в угловых скобках ⟨⟩: ёлочки заняты именами, и терм несёт их сам. */
static char *v_ugolkah(const char *s, long n) {
  return chast(razdelit(chast(razdelit(s, "⟨"), n + 1), "⟩"), 1);
}

/* Число из слова; не число — минус один, и это названное значение. */
static double chislo_iz_slova(const char *s) {
  char *konec; double z;
  if (!*s) return -1;
  z = strtod(s, &konec);
  return (*konec || konec == s) ? -1 : z;
}

static char *slovo_posle(const char *s, const char *metka) {
  return soderzhit(s, metka) ? slovo(chast(razdelit(s, metka), 2), 1) : (char *)"";
}
/* ЧИСЛО ЗА МЕТКОЙ ищется по всем вхождениям метки, а не по первому. Довод —
   замер: у записи `утверждение «всякая строка начинается пустым префиксом» …
   строка 30` слово «строка» стоит внутри ИМЕНИ, и счёт по первому вхождению
   давал −1, то есть ЧЕСТНАЯ запись отвергалась. Слово внутри имени числа за
   собой не несёт, и первое вхождение с числом — то самое. */
static double chislo_posle(const char *s, const char *metka) {
  size_t k = strlen(metka); const char *p = s, *q;
  while ((q = strstr(p, metka)) != NULL) {
    double z = chislo_iz_slova(slovo(q + k, 1));
    if (z >= 0) return z;
    p = q + k;
  }
  return -1;
}
static long nomer_posle(const char *s, const char *metka) {
  return (long)chislo_posle(s, metka);
}
static char *hvost_posle(const char *s, const char *metka) {
  return soderzhit(s, metka) ? obrezat(chast(razdelit(s, metka), 2)) : (char *)"";
}
static char *stroka_po_nomeru(Sp stroki, long n) { return obrezat(chast(stroki, n)); }

/* ═══ ЧИТАТЬ ИСХОДНИК ТАК ЖЕ, КАК ЕГО ЧИТАЕТ ЯЗЫК — ЯЧЕЙКИ Ч119 и Ч126 ═══════
   ПЕРЕНЕСЕНО В СТВОЛ ЯЧЕЙКОЙ Ч166, и перенесено НЕ ЦЕЛИКОМ. Пятое место
   починки Ч126 — сверка объявления типа довода по «следу ядра» — здесь
   отсутствует вместе с самим следом: блок следа писан на ДРУГОЙ линии
   чекера (Ч70→Ч91→Ч92→Ч102), которой в стволе тоже нет. Вместе с ним не
   перенесены `obyavlen_tipom` и `primer_protiv_dna`: у них здесь нет ни
   одного зовущего, а функция без зовущего — не защита, а мёртвый код.
   Четыре места ниже — те, что в стволе есть, и они починены все четыре.
   ЧТО БЫЛО. Четыре места сверщика искали в исходнике ПОДСТРОКУ: объявление типа
   довода, заголовок функции, слово «теорема», слово «обеспечивает». Ч119 провела
   на этом три подделки до кода 0 «ПРОВЕРЕНО САМОСТОЯТЕЛЬНО» — на файлах, которые
   ядро отвергает поимённым контрпримером. Приёма было два, и оба про то, что
   сверщик читает НЕ ТО, ЧТО ЯЗЫК:

     1. ХВОСТОВОЕ ПРИМЕЧАНИЕ. `принимает первое: нат, второе: целое // второе: нат`
        — законный flang, и язык читает тип `целое`. Сверщик находил подстроку
        «второе: нат» ЗА ДВУМЯ КОСЫМИ и засчитывал её за объявление. Тем же
        приёмом заголовок `функция «Двойник» // функция «Знаки»` подменял
        настоящую функцию «Знаки».
     2. ПРОБЕЛЬНЫЙ ПРОБЕГ. Язык терпит между словом и ёлочками ЛЮБОЙ пробельный
        пробег: `обеспечивает  «ложное»` и `теорема\t«ложное»` — законные
        постусловие и теорема, и ядро их опровергает. Счётчики полноты сверщика
        сличали точный текст с ОДНИМ пробелом и молча их не видели.

   Приём починки в сверщике уже был написан — `est_term` сличает по пробельным
   краям, «иначе «х» нашлось бы внутри «хвост»». Здесь он доведён до конца:
   прежде чем читать строку исходника, она приводится к тому виду, в каком её
   читает язык, а имена сличаются ЦЕЛИКОМ, а не вхождением. */

/* Строка без хвостового примечания. Двойные кавычки уважаются: «//» внутри
   строкового литерала — знаки литерала, а не начало примечания. */
static char *bez_primechaniya(const char *s) {
  size_t i; int v_kavychkah = 0;
  for (i = 0; s[i]; i++) {
    if (s[i] == '"') v_kavychkah = !v_kavychkah;
    else if (!v_kavychkah && s[i] == '/' && s[i + 1] == '/') return kopiya(s, i);
  }
  return (char *)s;
}

/* Имя функции, ОБЪЯВЛЕННОЙ этой строкой; строка не заголовок — пустая строка.
   Заголовок пишется от левого края, поэтому отступ здесь не снимается. */
static char *imya_funkcii(const char *syraya) {
  char *b = bez_primechaniya(syraya);
  if (!nachinaetsya(b, "функция «") && !nachinaetsya(b, "тотальная функция «"))
    return (char *)"";
  return v_yolochkah(b, 1);
}

/* Имя, стоящее в записи, обязано стоять и в исходнике. Имя пишется в языке и
   голым словом, и в ёлочках, поэтому ёлочки снимаются с обеих сторон. */
static char *golo(const char *s) {
  char *t = obrezat(s);
  return nachinaetsya(t, "«") ? v_yolochkah(t, 1) : t;
}
/* Слово «то» перед обоснованием — грамматика случая, а не часть обоснования. */
static char *bez_to(const char *s) {
  return nachinaetsya(s, "то ") ? slova_posle(s, 1) : (char *)s;
}

static char *pervaya_s_nachalom(Sp v, const char *nachalo) {
  int i;
  for (i = 0; i < v.n; i++) { char *t = obrezat(v.e[i]); if (nachinaetsya(t, nachalo)) return t; }
  return (char *)"";
}
static Sp vse_s_nachalom(Sp v, const char *nachalo) {
  Sp r = PUSTO; int i;
  for (i = 0; i < v.n; i++) { char *t = obrezat(v.e[i]); if (nachinaetsya(t, nachalo)) dobavit(&r, t); }
  return r;
}

static char *prochitat_fajl(const char *put) {
  FILE *f = fopen(put, "rb"); char *b; size_t ves = 0, mesto = 1 << 16, k;
  if (!f) return NULL;
  b = malloc(mesto);
  if (!b) exit(2);
  while ((k = fread(b + ves, 1, mesto - ves - 1, f)) > 0) {
    ves += k;
    if (ves + 1 >= mesto) { mesto *= 2; b = realloc(b, mesto); if (!b) exit(2); }
  }
  fclose(f); b[ves] = 0;
  { char *r = kopiya(b, ves); free(b); return r; }
}

/* Знаки — кодовые точки, а не байты: так считает и пишущая сторона. */
static long znakov(const char *s) {
  long n = 0; const unsigned char *p = (const unsigned char *)s;
  for (; *p; p++) if ((*p & 0xC0) != 0x80) n++;
  return n;
}
/* Тот же счёт, что у пишущей стороны; написан порознь нарочно. */
static long otpechatok(const char *s, long mnozh, long modul) {
  long long h = 7; const unsigned char *p = (const unsigned char *)s;
  while (*p) {
    long long c; int k, i;
    if (*p < 0x80) { c = *p; k = 1; }
    else if ((*p & 0xE0) == 0xC0) { c = *p & 0x1F; k = 2; }
    else if ((*p & 0xF0) == 0xE0) { c = *p & 0x0F; k = 3; }
    else { c = *p & 0x07; k = 4; }
    for (i = 1; i < k && p[i]; i++) c = (c << 6) | (p[i] & 0x3F);
    h = (h * mnozh + c) % modul; p += i;
  }
  return (long)h;
}

/* ── настоящий отпечаток: SHA-256 ────────────────────────────────────────────
   Многочленная свёртка шапки (пары 131/1000000007 и 137/998244353) ЛИНЕЙНА по
   кодам знаков, а модули меньше 2^30. Ч40 подобрала к ней столкновение
   приведением решётки за 0,976 с на одном ядре: честная запись честной
   программы прошла сверку против ДРУГОЙ программы, не тронутая ни на байт.
   Свёртка поэтому оставлена как есть (её пишет ядро, и расхождение с ней —
   тоже отказ), но ПРИВЯЗКА на ней больше не стоит. Стоит она на SHA-256:
     • чекер считает его сам и печатает в вердикте — чтобы было чем пришпилить;
     • строка шапки «отпечаток256 <hex>», когда ядро начнёт её писать, обязана
       сойтись;
     • третьим доводом чекеру можно подать ожидаемый отпечаток, и тогда
       расхождение — отказ, а не примечание. */
static const unsigned long K256[64] = {
  0x428a2f98UL,0x71374491UL,0xb5c0fbcfUL,0xe9b5dba5UL,0x3956c25bUL,0x59f111f1UL,0x923f82a4UL,0xab1c5ed5UL,
  0xd807aa98UL,0x12835b01UL,0x243185beUL,0x550c7dc3UL,0x72be5d74UL,0x80deb1feUL,0x9bdc06a7UL,0xc19bf174UL,
  0xe49b69c1UL,0xefbe4786UL,0x0fc19dc6UL,0x240ca1ccUL,0x2de92c6fUL,0x4a7484aaUL,0x5cb0a9dcUL,0x76f988daUL,
  0x983e5152UL,0xa831c66dUL,0xb00327c8UL,0xbf597fc7UL,0xc6e00bf3UL,0xd5a79147UL,0x06ca6351UL,0x14292967UL,
  0x27b70a85UL,0x2e1b2138UL,0x4d2c6dfcUL,0x53380d13UL,0x650a7354UL,0x766a0abbUL,0x81c2c92eUL,0x92722c85UL,
  0xa2bfe8a1UL,0xa81a664bUL,0xc24b8b70UL,0xc76c51a3UL,0xd192e819UL,0xd6990624UL,0xf40e3585UL,0x106aa070UL,
  0x19a4c116UL,0x1e376c08UL,0x2748774cUL,0x34b0bcb5UL,0x391c0cb3UL,0x4ed8aa4aUL,0x5b9cca4fUL,0x682e6ff3UL,
  0x748f82eeUL,0x78a5636fUL,0x84c87814UL,0x8cc70208UL,0x90befffaUL,0xa4506cebUL,0xbef9a3f7UL,0xc67178f2UL };

static void sha_blok(unsigned long *h, const unsigned char *b) {
  unsigned long w[64], a, c, d, e, f, g, hh, bb, t1, t2; int i;
  for (i = 0; i < 16; i++)
    w[i] = ((unsigned long)b[i*4] << 24 | (unsigned long)b[i*4+1] << 16 |
            (unsigned long)b[i*4+2] << 8 | (unsigned long)b[i*4+3]) & 0xffffffffUL;
  for (i = 16; i < 64; i++) {
    unsigned long s0 = ((w[i-15] >> 7 | w[i-15] << 25) ^ (w[i-15] >> 18 | w[i-15] << 14) ^ (w[i-15] >> 3)) & 0xffffffffUL;
    unsigned long s1 = ((w[i-2] >> 17 | w[i-2] << 15) ^ (w[i-2] >> 19 | w[i-2] << 13) ^ (w[i-2] >> 10)) & 0xffffffffUL;
    w[i] = (w[i-16] + s0 + w[i-7] + s1) & 0xffffffffUL;
  }
  a = h[0]; bb = h[1]; c = h[2]; d = h[3]; e = h[4]; f = h[5]; g = h[6]; hh = h[7];
  for (i = 0; i < 64; i++) {
    unsigned long S1 = ((e >> 6 | e << 26) ^ (e >> 11 | e << 21) ^ (e >> 25 | e << 7)) & 0xffffffffUL;
    unsigned long ch = (e & f) ^ (~e & g);
    unsigned long S0 = ((a >> 2 | a << 30) ^ (a >> 13 | a << 19) ^ (a >> 22 | a << 10)) & 0xffffffffUL;
    unsigned long mj = (a & bb) ^ (a & c) ^ (bb & c);
    t1 = (hh + S1 + ch + K256[i] + w[i]) & 0xffffffffUL;
    t2 = (S0 + mj) & 0xffffffffUL;
    hh = g; g = f; f = e; e = (d + t1) & 0xffffffffUL;
    d = c; c = bb; bb = a; a = (t1 + t2) & 0xffffffffUL;
  }
  h[0] = (h[0]+a)&0xffffffffUL; h[1] = (h[1]+bb)&0xffffffffUL; h[2] = (h[2]+c)&0xffffffffUL;
  h[3] = (h[3]+d)&0xffffffffUL; h[4] = (h[4]+e)&0xffffffffUL; h[5] = (h[5]+f)&0xffffffffUL;
  h[6] = (h[6]+g)&0xffffffffUL; h[7] = (h[7]+hh)&0xffffffffUL;
}
static char *sha256(const char *s) {
  unsigned long h[8] = {0x6a09e667UL,0xbb67ae85UL,0x3c6ef372UL,0xa54ff53aUL,
                        0x510e527fUL,0x9b05688cUL,0x1f83d9abUL,0x5be0cd19UL};
  size_t n = strlen(s), i, ves = ((n + 9 + 63) / 64) * 64;
  unsigned char *b = dai(ves); char *r = dai(65);
  memset(b, 0, ves); memcpy(b, s, n); b[n] = 0x80;
  for (i = 0; i < 8; i++) b[ves-1-i] = (unsigned char)(((unsigned long long)n * 8) >> (8 * i));
  for (i = 0; i < ves; i += 64) sha_blok(h, b + i);
  for (i = 0; i < 8; i++) sprintf(r + i * 8, "%08lx", h[i]);
  return r;
}

/* ═══════════════════════════ термы: строкой, не деревом ════════════════════ */

static char *szhat_probely(const char *t) {
  Sp v = razdelit(t, " "), r = PUSTO; int i;
  for (i = 0; i < v.n; i++) if (*v.e[i]) dobavit(&r, v.e[i]);
  return soedinit(r, " ");
}
/* Строка в том виде, в каком её читает язык: примечание отрезано, табуляции —
   пробелы, пробельные пробеги сжаты в один. */
static char *kak_chitaet_yazyk(const char *s) {
  return szhat_probely(zamenit(bez_primechaniya(s), "\t", " "));
}

static char *rasstavit(const char *t) {
  return szhat_probely(zamenit(zamenit(t, "(", " ( "), ")", " ) "));
}
static long skolko_raz(const char *t, const char *ch) {
  long n = 0; const char *p = t, *q;
  while ((q = strstr(p, ch)) != NULL) { n++; p = q + strlen(ch); }
  return n;
}
static int skobki_soshlis(const char *t) { return skolko_raz(t, "(") == skolko_raz(t, ")"); }
static char *bez_kraev(const char *t) {
  size_t d = strlen(t); return d < 3 ? (char *)"" : kopiya(t + 1, d - 2);
}
/* Уходит ли счёт скобок в минус хоть раз: этим «( а ) плюс ( б )» отличается
   от «( ( а ) плюс ( б ) )» — там крайние скобки разные, снимать нельзя. */
static int ne_provalivaetsya(const char *t) {
  long sejchas = 0; const char *p;
  for (p = t; *p; p++) {
    if (*p == '(') sejchas++;
    else if (*p == ')') { sejchas--; if (sejchas < 0) return 0; }
  }
  return 1;
}
static int odna_para(const char *t) {
  size_t d = strlen(t);
  if (d < 3 || t[0] != '(' || t[d-1] != ')') return 0;
  return skobki_soshlis(t) && ne_provalivaetsya(bez_kraev(t));
}
static char *uzhat(const char *t) {
  int i; char *r = obrezat(t);
  for (i = 0; i < 4; i++) { if (!odna_para(r)) break; r = obrezat(bez_kraev(r)); }
  return r;
}
static char *term(const char *syroy) { return uzhat(rasstavit(syroy)); }

/* Ищется и меняется ПО ПРОБЕЛЬНЫМ КРАЯМ: иначе «х» нашлось бы внутри «хвост». */
static int est_term(const char *gde, const char *chto) {
  return soderzhit(fmt(" %s ", gde), fmt(" %s ", chto));
}
static char *v_skobki(const char *t) {
  return (!soderzhit(t, " ") || odna_para(t)) ? (char *)t : fmt("( %s )", t);
}
/* Два прохода: место, куда подтерм встаёт, БЫВАЕТ УЖЕ В СКОБКАХ, и вторые
   скобки вокруг вставляемого были бы лишними. */
static char *vstavit_vmesto(const char *gde, const char *chto, const char *na) {
  char *v = zamenit(fmt(" %s ", gde), fmt(" ( %s ) ", chto), fmt(" ( %s ) ", na));
  return obrezat(zamenit(v, fmt(" %s ", chto), fmt(" %s ", v_skobki(na))));
}

/* Части верхнего уровня: разбить по знаку наивно, а потом склеивать обратно,
   пока скобки не сойдутся. Разборщик языка для этого не нужен. */
static Sp razdelit_sverhu(const char *t, const char *op) {
  char *sep = fmt(" %s ", op);
  Sp syrye = razdelit(t, sep), chasti = PUSTO;
  char *tek = (char *)""; int nachata = 0, i;
  for (i = 0; i < syrye.n; i++) {
    char *novoe = nachata ? fmt("%s%s%s", tek, sep, syrye.e[i]) : syrye.e[i];
    if (skobki_soshlis(novoe)) { dobavit(&chasti, novoe); tek = (char *)""; nachata = 0; }
    else { tek = novoe; nachata = 1; }
  }
  return chasti;
}

typedef struct { int est; char *levo, *pravo; } Razrez;

static Razrez razrez_po(const char *t, const char *op) {
  Razrez r; Sp ch = razdelit_sverhu(uzhat(t), op);
  if (ch.n < 2) { r.est = 0; r.levo = (char *)""; r.pravo = (char *)""; return r; }
  r.est = 1; r.levo = obrezat(ch.e[0]);
  { Sp hv = PUSTO; int i; for (i = 1; i < ch.n; i++) dobavit(&hv, ch.e[i]);
    r.pravo = obrezat(soedinit(hv, fmt(" %s ", op))); }
  return r;
}
static char *sleva_ot(const char *t, const char *op) { return razrez_po(t, op).levo; }
static char *sprava_ot(const char *t, const char *op) { return razrez_po(t, op).pravo; }

/* ═══════════════════════════ законы: список закрыт ═════════════════════════ */

typedef struct { int vyshlo; char *pochemu; Sp posylki; } Primenenie;

static Primenenie ne_podoshel(char *pochemu) {
  Primenenie p; p.vyshlo = 0; p.pochemu = pochemu; p.posylki = PUSTO; return p;
}
/* Сумма неотрицательных неотрицательна: в IEEE-754 теорема без оговорок. */
static Primenenie zakon_summy(const char *cel) {
  Primenenie p; Razrez r = razrez_po(cel, "не меньше"), s;
  if (!(r.est && strcmp(r.pravo, "0") == 0))
    return ne_podoshel((char *)"закон суммы берёт только цель вида «Е не меньше 0»");
  s = razrez_po(r.levo, "плюс");
  if (!(s.est && razdelit_sverhu(uzhat(r.levo), "плюс").n == 2))
    return ne_podoshel((char *)"закон суммы берёт только сумму ровно двух слагаемых");
  p.vyshlo = 1; p.pochemu = (char *)""; p.posylki = PUSTO;
  dobavit(&p.posylki, fmt("%s не меньше 0", s.levo));
  dobavit(&p.posylki, fmt("%s не меньше 0", s.pravo));
  return p;
}
/* Литерал не меньше нуля: проверяется счётом, а не списком. */
static Primenenie zakon_literala(const char *cel) {
  Primenenie p; Razrez r = razrez_po(cel, "не меньше");
  if (r.est && strcmp(r.pravo, "0") == 0 && chislo_iz_slova(uzhat(r.levo)) >= 0) {
    p.vyshlo = 1; p.pochemu = (char *)""; p.posylki = PUSTO; return p;
  }
  return ne_podoshel((char *)"закон литерала берёт только неотрицательный литерал слева и 0 справа");
}
static Primenenie primenit_zakon(const char *imya, const char *cel) {
  if (strcmp(imya, "сумма неотрицательных") == 0) return zakon_summy(cel);
  if (strcmp(imya, "литерал неотрицателен") == 0) return zakon_literala(cel);
  return ne_podoshel(fmt("закона «%s» сверщик не знает: список законов закрыт", imya));
}

/* ═══════════════════════════ чтение исходника ══════════════════════════════ */

static const char *vid_stroki_teoremy(const char *s) {
  const char *g = bez_to(s);
  if (nachinaetsya(g, "по предположению") || nachinaetsya(g, "по свойству") ||
      nachinaetsya(g, "по примеру") || nachinaetsya(g, "по закону") ||
      nachinaetsya(g, "затем ")) return "шаг";
  if (nachinaetsya(g, "случай ")) return "случай";
  if (nachinaetsya(g, "дано ")) return "дано";
  if (nachinaetsya(g, "утверждаем")) return "утверждаем";
  if (nachinaetsya(g, "индукция по")) return "индукция";
  return strcmp(g, "следовательно доказано") == 0 ? "доказано" : "";
}

/* Разметка теоремы ПРЯМО ИЗ ИСХОДНИКА: по метке на значащую строку блока, в
   порядке чтения, с номером строки. Именно её сличают с записью. */
static Sp razmetka_teoremy(Sp stroki, long nachalo) {
  Sp metki = PUSTO; long i;
  for (i = nachalo; i <= stroki.n; i++) {
    char *syraya = chast(stroki, i), *s = obrezat(syraya);
    const char *vid;
    if (i > nachalo && *syraya && !nachinaetsya(syraya, " ")) break;
    if (nachinaetsya(s, "//") || !*s) continue;
    vid = nachinaetsya(s, "теорема ") ? "теорема" : vid_stroki_teoremy(s);
    if (!*vid) continue;
    dobavit(&metki, strcmp(vid, "доказано") == 0 ? (char *)"доказано" : fmt("%s %ld", vid, i));
  }
  return metki;
}

/* Имя варианта пишется двумя способами — в ёлочках и голым словом; оба в дереве. */
static char *imya_varianta(const char *s) {
  return nachinaetsya(s, "вариант «") ? v_yolochkah(s, 1) : slovo(s, 2);
}

/* Встроенные список и строка — суммы самого языка, объявления у них нет вовсе.
   Знать это чекеру позволено: он читает язык, а не программу. */
static Sp varianty_tipa(Sp stroki, const char *imya) {
  Sp v = PUSTO; char *zag; int i, vnutri = 0;
  if (strcmp(imya, "список") == 0 || strcmp(imya, "строка") == 0) {
    dobavit(&v, (char *)"пусто"); dobavit(&v, (char *)"голова и хвост"); return v;
  }
  zag = fmt("тип «%s»", imya);
  for (i = 0; i < stroki.n; i++) {
    char *s = obrezat(stroki.e[i]);
    if (strcmp(s, zag) == 0) { vnutri = 1; continue; }
    if (!vnutri) continue;
    if (nachinaetsya(s, "вариант ")) { dobavit(&v, imya_varianta(s)); continue; }
    if (!*s) continue;
    break;
  }
  return v;
}

static char *stroka_varianta_tipa(Sp stroki, const char *tip, const char *variant) {
  char *zag = fmt("тип «%s»", tip), *tekst = (char *)""; int i, vnutri = 0;
  for (i = 0; i < stroki.n; i++) {
    char *s = obrezat(stroki.e[i]);
    if (strcmp(s, zag) == 0) { vnutri = 1; continue; }
    if (!vnutri) continue;
    if (nachinaetsya(s, "вариант ")) { if (strcmp(imya_varianta(s), variant) == 0) tekst = s; continue; }
    if (!*s) continue;
    vnutri = 0;
  }
  return tekst;
}

/* Чьё это место: ближайшая назад строка, начатая с первого столбца «функция». */
static char *hozyain_stroki(Sp stroki, long gde) {
  char *tekst = (char *)""; long i;
  for (i = 1; i <= stroki.n && i <= gde; i++) {
    char *imya = imya_funkcii(chast(stroki, i));
    if (*imya) tekst = imya;
  }
  return tekst;
}

/* ═══════════════════════ обстановка и проигрывание сведения ════════════════ */

typedef struct { Sp stroki, svoi; char *cel, *funkciya, *po, *tip, *hvost; } Obst;

/* ПРОЧИЕ ДОВОДЫ ФУНКЦИИ — «и дно», «и предел» и так далее. Прежде вызов строился
   ОДНОДОВОДНЫМ («Ф» от значение), и на функции с двумя доводами цель посылки
   расходилась с телом молча: подстановка не находила терма и ход отваливался.
   Список читается из ИСХОДНИКА, из строки «принимает», и той же строки держится
   ядро — разойдутся, и терм развёртки не совпадёт с целью. */
static char *hvost_dovodov(Sp stroki, const char *funkciya) {
  Sp chasti; char *hv = (char *)"";
  int i, j, vnutri = 0;
  for (i = 0; i < stroki.n; i++) {
    char *syraya = stroki.e[i], *l = obrezat(bez_primechaniya(syraya));
    char *imya_z = imya_funkcii(syraya);
    if (*imya_z) vnutri = (strcmp(imya_z, funkciya) == 0);
    else if (vnutri && nachinaetsya(l, "принимает ")) {
      chasti = razdelit(hvost_posle(l, "принимает "), ",");
      for (j = 1; j < chasti.n; j++) {
        char *imya = obrezat(chast(razdelit(chasti.e[j], ":"), 1));
        if (*imya) hv = fmt("%s и %s", hv, imya);
      }
      return hv;
    }
  }
  return hv;
}

/* Цели равны, если равны их стороны с точностью до ОБЪЕМЛЮЩЕЙ пары скобок.
   Снимается только пара, обнимающая сторону целиком: она группировки не меняет,
   а `( а плюс б ) плюс в` от `а плюс ( б плюс в )` этим не спутать — там скобки
   стоят вокруг ЧАСТИ, и `uzhat` их не трогает. */
static int sovpali_celi(const char *a, const char *b) {
  Razrez ra, rb;
  if (strcmp(uzhat(a), uzhat(b)) == 0) return 1;
  ra = razrez_po(a, "не меньше"); rb = razrez_po(b, "не меньше");
  if (!ra.est || !rb.est) return 0;
  return strcmp(uzhat(ra.levo), uzhat(rb.levo)) == 0 && strcmp(uzhat(ra.pravo), uzhat(rb.pravo)) == 0;
}

/* Скобки долой: терм, напечатанный ядром, и строка исходника вправе разойтись
   ТОЛЬКО скобками и пробелами — расстановка скобок и есть то, чего в тексте
   строки нет, а в разобранном дереве есть. Разойдутся словами — это уже другой
   терм, и запись краснеет. */
static char *bez_skobok(const char *t) {
  return szhat_probely(zamenit(zamenit(rasstavit(t), "(", " "), ")", " "));
}

static char *sluchay_varianta(Obst *o, const char *variant) {
  Sp v = vse_s_nachalom(o->svoi, "случай строка"); int i;
  for (i = 0; i < v.n; i++) {
    char *l = stroka_po_nomeru(o->stroki, nomer_posle(v.e[i], "строка "));
    if (strcmp(imya_varianta(slova_posle(l, 1)), variant) == 0) return l;
  }
  return (char *)"";
}
/* Образец случая становится конструктором: `с голова как г` — `с голова равным г`. */
static char *konstruktor_sluchaya(const char *sluchay) {
  return zamenit(slova_posle(sluchay, 1), " как ", " равным ");
}
/* Что стоит на месте поля образца: `с голова как г` при имени «г» — «голова». */
static char *pole_obrazca(const char *sluchay, const char *imya) {
  Sp ch = razdelit_sverhu(sprava_ot(slova_posle(sluchay, 1), "с"), "и"); int i;
  for (i = 0; i < ch.n; i++)
    if (strcmp(obrezat(sprava_ot(ch.e[i], "как")), imya) == 0)
      return obrezat(sleva_ot(ch.e[i], "как"));
  return (char *)"";
}
/* Рекурсивно ли поле — на этом держится законность допущения индукции: часть
   обязана быть того же типа, иначе это не индукция, а круг. */
static int pole_rekursivno(Obst *o, const char *variant, const char *pole) {
  char *s = stroka_varianta_tipa(o->stroki, o->tip, variant);
  Sp ch = razdelit(sprava_ot(s, "содержит"), ","); int i;
  for (i = 0; i < ch.n; i++) {
    Sp p = razdelit(ch.e[i], ":");
    if (strcmp(obrezat(chast(p, 1)), pole) == 0)
      return strcmp(obrezat(chast(p, 2)), fmt("«%s»", o->tip)) == 0;
  }
  return 0;
}
/* Цель посылки — утверждение теоремы, где разбираемое имя заменено тем, о чём
   эта посылка, а `результат` — вызовом доказываемой функции на нём. */
static char *cel_pri_znachenii(Obst *o, const char *znachenie) {
  char *vyzov = term(fmt("«%s» от %s%s", o->funkciya, v_skobki(znachenie), o->hvost));
  return term(vstavit_vmesto(vstavit_vmesto(o->cel, "результат", vyzov), o->po, znachenie));
}
static char *nachalnaya_cel(Obst *o, const char *variant) {
  char *sl = sluchay_varianta(o, variant);
  if (!*sl) return (char *)"";
  return cel_pri_znachenii(o, term(konstruktor_sluchaya(sl)));
}

typedef struct { Sp celi, dano, bedy; long hodov, proigrano, bez_privyazki;
                 int idyot; char *variant; } Progon;

static void beda_progona(Progon *p, char *t) { dobavit(&p->bedy, t); p->idyot = 0; }
static char *pervaya_cel(Progon *p) { return p->celi.n ? p->celi.e[0] : (char *)""; }

/* Первая цель заменяется тем, во что разошлась: пусто — закрыта, одна —
   переписана, две — поделена. Новые цели встают ПЕРЕД прочими. */
static void vmesto_pervoy(Progon *p, Sp novye) {
  Sp c = PUSTO; int i;
  for (i = 0; i < novye.n; i++) dobavit(&c, novye.e[i]);
  for (i = 1; i < p->celi.n; i++) dobavit(&c, p->celi.e[i]);
  p->celi = c; p->hodov++;
}
static void odna_cel(Progon *p, char *c) { Sp v = PUSTO; dobavit(&v, c); vmesto_pervoy(p, v); }

/* Подстановка доводов вместо связанных имён образца. */
static void razvernut_po_telu(Progon *p, const char *chto, const char *obrazec,
                              char *telo, const char *dovod) {
  Sp imena = razdelit_sverhu(sprava_ot(slova_posle(obrazec, 1), "с"), "и");
  Sp znach = razdelit_sverhu(sprava_ot(dovod, "с"), "и");
  int i;
  for (i = 0; i < imena.n; i++) {
    char *imya = obrezat(sprava_ot(imena.e[i], "как"));
    char *z = obrezat(sprava_ot(chast(znach, i + 1), "равным"));
    if (*imya && *z) telo = vstavit_vmesto(telo, imya, z);
  }
  odna_cel(p, term(vstavit_vmesto(pervaya_cel(p), chto, telo)));
}

/* РАЗВЁРТКА ОПРЕДЕЛЕНИЯ. Тело берётся из ИСХОДНИКА по номеру строки, и три
   условия проверяются прежде, чем ему поверить: строка стоит внутри названной
   функции, над нею стоит образец названного варианта, и она начата словом «то». */
static void hod_razvyortki(Progon *p, const char *stroka, Obst *o) {
  char *chto = term(v_ugolkah(stroka, 1));
  long gde = nomer_posle(stroka, "строка ");
  char *imya = v_yolochkah(chto, 1);
  /* ДОВОД ОТРЕЗАЕТСЯ ПО ИМЕНИ ФУНКЦИИ, А НЕ ПО ПЕРВОМУ СЛОВУ «от». Прежде стояло
     `sprava_ot(chto, "от")`, и на функции, у которой «от» стоит в САМОМ ИМЕНИ
     («Высота от дна»), разрез шёл посередине имени: вариант читался как «от», и
     честная запись отвергалась. Имя уже известно — по нему и режем. Прочие
     доводы («и дно») отсекаются хвостом подписи: они не часть значения. */
  char *dovod = obrezat(hvost_posle(chto, fmt("«%s» от ", imya)));
  char *variant;
  { size_t dd = strlen(dovod), hh = strlen(o->hvost);
    if (hh && dd >= hh && strcmp(dovod + dd - hh, o->hvost) == 0) dovod = kopiya(dovod, dd - hh); }
  dovod = uzhat(obrezat(dovod));
  variant = imya_varianta(dovod);
  char *telo, *obrazec, *hozyain;
  if (!est_term(pervaya_cel(p), chto)) {
    beda_progona(p, fmt("развёртка: в цели «%s» нет терма «%s»", pervaya_cel(p), chto)); return;
  }
  if (gde < 1) {   /* будущий вид записи: тело приезжает термом, а не номером */
    char *t = v_ugolkah(stroka, 2);
    if (!*t) { beda_progona(p, (char *)"развёртка: ни номера строки исходника, ни тела термом"); return; }
    p->bez_privyazki++;
    razvernut_po_telu(p, chto, sluchay_varianta(o, variant), term(t), dovod); return;
  }
  telo = stroka_po_nomeru(o->stroki, gde);
  obrazec = stroka_po_nomeru(o->stroki, gde - 1);
  hozyain = hozyain_stroki(o->stroki, gde);
  /* ТЕРМ ПРИ НОМЕРЕ СТРОКИ — ДВОЙНАЯ ПРИВЯЗКА, А НЕ ВТОРОЙ ИСТОЧНИК. Ядро
     печатает тело ветви термом И называет строку, с которой его прочло; чекер
     читает ту же строку сам и сличает. Разойтись им позволено ровно скобками:
     расстановку скобок несёт разобранное дерево, а не текст строки. Разойдутся
     словами — «НЕ СОШЛОСЬ», и молчания здесь больше нет. */
  { char *napisano = v_ugolkah(stroka, 2);
    if (*napisano) {
      char *iz_ishodnika = term(slova_posle(telo, 1));
      if (strcmp(bez_skobok(napisano), bez_skobok(iz_ishodnika)) != 0) {
        beda_progona(p, fmt("развёртка «%s»: запись несёт тело ⟨%s⟩, а в строке %ld исходника написано «%s»",
                            imya, napisano, gde, iz_ishodnika)); return;
      }
      telo = fmt("то %s", napisano);
    } }
  if (strcmp(hozyain, imya) != 0)
    beda_progona(p, fmt("развёртка «%s»: строка %ld исходника стоит в функции «%s»", imya, gde, hozyain));
  else if (!nachinaetsya(telo, "то "))
    beda_progona(p, fmt("развёртка «%s»: строка %ld исходника не начинается словом «то»", imya, gde));
  else if (!(nachinaetsya(obrazec, "случай ") &&
             strcmp(imya_varianta(slova_posle(obrazec, 1)), variant) == 0))
    beda_progona(p, fmt("развёртка «%s»: над строкой %ld исходника не стоит случай варианта «%s»", imya, gde, variant));
  else razvernut_po_telu(p, chto, obrazec, term(slova_posle(telo, 1)), dovod);
}

/* ПЕРЕПИСКА ДОПУЩЕНИЕМ: допущение обязано быть равенством; переписываются ВСЕ
   вхождения левой стороны, как это делает и ядро. */
static void hod_zameny(Progon *p, const char *stroka) {
  long nomer = nomer_posle(stroka, "по дано ");
  int naoborot = soderzhit(stroka, " обратно");
  Razrez r = razrez_po(chast(p->dano, nomer), "равно");
  char *chto = naoborot ? r.pravo : r.levo, *na = naoborot ? r.levo : r.pravo;
  if (!r.est)
    beda_progona(p, fmt("замена по дано %ld: допущения-равенства под этим номером нет", nomer));
  else if (!est_term(pervaya_cel(p), chto))
    beda_progona(p, fmt("замена по дано %ld: в цели «%s» нет терма «%s»", nomer, pervaya_cel(p), chto));
  else odna_cel(p, term(vstavit_vmesto(pervaya_cel(p), chto, na)));
}

/* ПОРЯДОК СОСЕДЕЙ: переставляются два операнда ОДНОГО узла и только они —
   перестановка через скобки была бы ассоциативностью, а она в IEEE-754 ложна. */
static void hod_sosedey(Progon *p, const char *stroka) {
  char *chto = term(v_ugolkah(stroka, 1));
  const char *op = razdelit_sverhu(chto, "плюс").n == 2 ? "плюс" :
                   (razdelit_sverhu(chto, "умножить на").n == 2 ? "умножить на" : "");
  Razrez r = razrez_po(chto, op);
  if (!*op)
    beda_progona(p, fmt("соседи: «%s» не сумма и не произведение ровно двух соседей", chto));
  else if (!est_term(pervaya_cel(p), chto))
    beda_progona(p, fmt("соседи: в цели «%s» нет терма «%s»", pervaya_cel(p), chto));
  else odna_cel(p, term(vstavit_vmesto(pervaya_cel(p), chto, fmt("%s %s %s", r.pravo, op, r.levo))));
}

/* ВЕТВЬ ПРИ ИЗВЕСТНОМ УСЛОВИИ: `если да то А иначе Б` — это `А`. Ход ничего не
   выводит, он ЧИТАЕТ написанное. */
static void hod_vybora(Progon *p, const char *stroka) {
  char *chto = term(v_ugolkah(stroka, 1));
  Razrez po_to = razrez_po(chto, "то"), vetvi = razrez_po(po_to.pravo, "иначе");
  char *uslovie = slova_posle(po_to.levo, 1);
  char *vzyato = strcmp(uslovie, "да") == 0 ? vetvi.levo : vetvi.pravo;
  if (!(po_to.est && vetvi.est && nachinaetsya(po_to.levo, "если ")))
    beda_progona(p, fmt("выбор: «%s» не вида «если У то А иначе Б»", chto));
  else if (!(strcmp(uslovie, "да") == 0 || strcmp(uslovie, "нет") == 0))
    beda_progona(p, fmt("выбор: условие «%s» не вычислено до литерала — ветвь брать не из чего", uslovie));
  else if (!est_term(pervaya_cel(p), chto))
    beda_progona(p, fmt("выбор: в цели «%s» нет терма «%s»", pervaya_cel(p), chto));
  else odna_cel(p, term(vstavit_vmesto(pervaya_cel(p), chto, vzyato)));
}

/* ДЕЛЕНИЕ ЦЕЛИ ПО УСЛОВИЮ. Берётся ТОЛЬКО выражение, стоящее в цели условием:
   у произвольного подтерма значений больше двух, и замена была бы ложью. */
static void hod_deleniya(Progon *p, const char *stroka) {
  char *chto = term(v_ugolkah(stroka, 1)), *cel = pervaya_cel(p); Sp novye = PUSTO;
  if (!soderzhit(cel, fmt("если %s то ", chto))) {
    beda_progona(p, fmt("деление: «%s» не стоит в цели условием («если … то»)", chto)); return;
  }
  dobavit(&novye, term(vstavit_vmesto(cel, chto, "да")));
  dobavit(&novye, term(vstavit_vmesto(cel, chto, "нет")));
  vmesto_pervoy(p, novye);
}

static void hod_zakona(Progon *p, const char *stroka) {
  char *imya = v_yolochkah(stroka, 1);
  Primenenie it = primenit_zakon(imya, pervaya_cel(p));
  if (!it.vyshlo) {
    beda_progona(p, fmt("закон «%s» к цели «%s» не подошёл: %s", imya, pervaya_cel(p), it.pochemu)); return;
  }
  { Sp n = PUSTO; int i; for (i = 0; i < it.posylki.n; i++) dobavit(&n, term(it.posylki.e[i]));
    vmesto_pervoy(p, n); }
}

static void hod_zakrytiya(Progon *p, const char *stroka, Obst *o) {
  char *chem = slovo(stroka, 4), *cel = pervaya_cel(p);
  if (strcmp(chem, "дано") == 0) {
    long nomer = nomer_posle(stroka, "закрыть дано ");
    char *fakt = chast(p->dano, nomer);
    if (strcmp(uzhat(fakt), uzhat(cel)) == 0) vmesto_pervoy(p, PUSTO);
    else beda_progona(p, fmt("закрыть дано %ld: цель «%s» не совпала с допущением «%s»", nomer, cel, fakt));
  } else if (strcmp(chem, "тождеством") == 0) {
    Razrez r = razrez_po(cel, "равно");
    if (r.est && strcmp(uzhat(r.levo), uzhat(r.pravo)) == 0) vmesto_pervoy(p, PUSTO);
    else beda_progona(p, fmt("закрыть тождеством: у цели «%s» стороны равенства разные", cel));
  } else if (strcmp(chem, "истиной") == 0) {
    if (strcmp(cel, "да") == 0) vmesto_pervoy(p, PUSTO);
    else beda_progona(p, fmt("закрыть истиной: цель «%s» не литерал «да»", cel));
  } else if (strcmp(chem, "требованием") == 0) {
    /* ПРЕДУСЛОВИЕ — ЗАКОННОЕ ДОПУЩЕНИЕ ВНУТРИ ТЕЛА: его доказывает вызывающий
       (A10). Чекер сверяет ровно две вещи: что строка исходника ПРАВДА несёт
       это `требует` у этой функции и что записанный факт слово в слово и есть
       цель. Держит ли договор компилятор — не его дело, и это названо аксиомой. */
    char *imya = v_yolochkah(stroka, 1);
    long gde = nomer_posle(stroka, "строка ");
    char *v_ish = stroka_po_nomeru(o->stroki, gde);
    char *fakt = hvost_posle(v_ish, fmt("требует «%s» ", imya));
    if (!nachinaetsya(v_ish, fmt("требует «%s» ", imya)))
      beda_progona(p, fmt("закрыть требованием «%s»: в строке %ld исходника стоит «%s»", imya, gde, v_ish));
    else if (strcmp(hozyain_stroki(o->stroki, gde), o->funkciya) != 0)
      beda_progona(p, fmt("закрыть требованием «%s»: строка %ld исходника стоит не в функции «%s»", imya, gde, o->funkciya));
    else if (!sovpali_celi(term(fakt), term(cel)))
      beda_progona(p, fmt("закрыть требованием «%s»: требование «%s» не совпало с целью «%s»", imya, term(fakt), cel));
    else vmesto_pervoy(p, PUSTO);
  } else beda_progona(p, fmt("закрыть «%s» сверщику неизвестно", chem));
}

static void hod_celi(Progon *p, Obst *o) {
  char *nachalo = nachalnaya_cel(o, p->variant);
  if (!*nachalo) {
    beda_progona(p, fmt("ход цель: случая варианта «%s» в теореме нет", p->variant)); return;
  }
  p->celi = PUSTO; dobavit(&p->celi, nachalo);
  p->dano = PUSTO; p->hodov = 0; p->idyot = 1;
}

/* ДОПУЩЕНИЕ ИНДУКЦИИ не читается из записи: чекер считает его сам — то же
   утверждение теоремы, но о названной части значения. */
static void hod_dopushcheniya(Progon *p, const char *stroka, Obst *o) {
  char *imya = v_yolochkah(stroka, 1);
  char *sluchay = sluchay_varianta(o, p->variant);
  char *pole = pole_obrazca(sluchay, imya);
  if (!soderzhit(stroka, " предположение по "))
    beda_progona(p, (char *)"ход дано: сверщик знает один источник допущения — «предположение по «имя»»");
  else if (!*pole)
    beda_progona(p, fmt("допущение по «%s»: такого имени образец случая «%s» не связывает", imya, p->variant));
  else if (!pole_rekursivno(o, p->variant, pole))
    beda_progona(p, fmt("допущение по «%s»: поле «%s» варианта «%s» не того же типа «%s» — это не индукция, а круг",
                        imya, pole, p->variant, o->tip));
  else dobavit(&p->dano, cel_pri_znachenii(o, imya));
}

static void hod_konca(Progon *p) {
  if (!p->idyot) beda_progona(p, (char *)"ход конец стоит без «ход цель»");
  else if (p->celi.n)
    beda_progona(p, fmt("сведение посылки «%s» не доведено: незакрытых целей %d — первая «%s»",
                        p->variant, p->celi.n, pervaya_cel(p)));
  else { p->proigrano++; p->idyot = 0; }
}

static void novaya_posylka(Progon *p, const char *stroka) {
  if (p->idyot) beda_progona(p, fmt("сведение посылки «%s» оборвано: «ход конец» не стоит", p->variant));
  p->celi = PUSTO; p->dano = PUSTO; p->hodov = 0; p->idyot = 0;
  p->variant = v_yolochkah(stroka, 1);
}

/* НОМЕР ХОДА СЧИТАЕТСЯ, а не украшает: пропавший посередине ход виден и по
   номеру, и по несошедшейся цели, и первое сообщение понятнее второго. */
static void hod_shaga(Progon *p, const char *stroka, Obst *o) {
  char *rod = slovo(stroka, 3);
  long nomer = (long)chislo_iz_slova(slovo(stroka, 2));
  if (!p->idyot) { beda_progona(p, fmt("ход «%s» стоит до «ход цель»", stroka)); return; }
  if (nomer != p->hodov + 1) {
    beda_progona(p, fmt("ход %ld стоит %ld-м: ход пропущен или переставлен", nomer, p->hodov + 1)); return;
  }
  if (!p->celi.n) { beda_progona(p, fmt("ход %ld: незакрытых целей не осталось, ход лишний", nomer)); return; }
  if (strcmp(rod, "развернуть") == 0) hod_razvyortki(p, stroka, o);
  else if (strcmp(rod, "замена") == 0) hod_zameny(p, stroka);
  else if (strcmp(rod, "соседи") == 0) hod_sosedey(p, stroka);
  else if (strcmp(rod, "выбор") == 0) hod_vybora(p, stroka);
  else if (strcmp(rod, "деление") == 0) hod_deleniya(p, stroka);
  else if (strcmp(rod, "закон") == 0) hod_zakona(p, stroka);
  else if (strcmp(rod, "закрыть") == 0) hod_zakrytiya(p, stroka, o);
  else beda_progona(p, fmt("ход «%s» сверщику неизвестен: первичных ходов семь, и список закрыт", rod));
}

static Progon proigrat_blok(Obst *o) {
  Progon p; int i;
  memset(&p, 0, sizeof p); p.variant = (char *)"";
  for (i = 0; i < o->svoi.n; i++) {
    char *s = obrezat(o->svoi.e[i]);
    if (nachinaetsya(s, "посылка ")) { novaya_posylka(&p, s); continue; }
    if (!nachinaetsya(s, "ход ")) continue;
    { char *vtoroe = slovo(s, 2);
      if (strcmp(vtoroe, "цель") == 0) hod_celi(&p, o);
      else if (strcmp(vtoroe, "дано") == 0) hod_dopushcheniya(&p, s, o);
      else if (strcmp(vtoroe, "конец") == 0) hod_konca(&p);
      else hod_shaga(&p, s, o); }
  }
  if (p.idyot) beda_progona(&p, fmt("сведение посылки «%s» оборвано на конце блока: «ход конец» не стоит", p.variant));
  return p;
}

/* ═══════════════════════════ сверка ════════════════════════════════════════ */

/* `kripto` — привязка к программе стоит на SHA-256 и сошлась: либо строкой
   шапки «отпечаток256», либо отпечатком, поданным третьим доводом. Ноль значит
   не «подделка», а «проверить нечем»: исход 3. `primety` — то, что человеку
   знать полезно, а на исход не влияет (правило Ч55 о поле «исходник»). */
typedef struct { Sp bedy, primety; long na_slovo, shagov, utverzhdeniy, svedeniy, hodov,
                 uzlov, uzlov_mest, uzlov_mimo,
                 /* Ч365: узлы «тождество после переписки допущением» — сколько
                    проиграно заново, сколько мест этим снято со слова ядра,
                    сколько узлов ВНЕ приёма и сколько приём взял, но не свёл. */
                 tozhdestv, tozhdestv_mest, tozhdestv_mimo, tozhdestv_ne_soshlos,
                 bez_privyazki, shagov_na_slovo, shagov_primerom, dokazannyh,
                 /* Ч375: мест, где термин и номер строки стоят РЯДОМ и сверены
                    друг против друга (третья ветка, ниже, задача 9612). */
                 svereno_oboimi; char *sha; int kripto;
                 /* Ч56: вердикт по каждому утверждению порознь (ключ
                    `--по-утверждениям`), а не один на весь файл. */
                 Sp po_utverzhdeniyam;
                 /* Ч76: почему сверщик НЕ ВЗЯЛСЯ за шаг вне случая. Молча не
                    брать нельзя — это и есть правило Ч27 о закрытых списках:
                    сломайся приём, и он обязан назвать причину поимённо, а не
                    просто «проверить меньше». */
                 Sp ne_vzyalsya; } Sverka;

static void esli_ne(Sverka *s, int uslovie, char *tekst) { if (!uslovie) dobavit(&s->bedy, tekst); }

/* Правила сведения названы списком, и список закрыт: правило, которого здесь
   нет, отвергается. ШЕСТНАДЦАТЬ имён — ровно те, что ядро способно поставить в
   поле правила, плюс пустое. Число снято ПРОГОНОМ 31 августа 2026, а не взято у
   соседа: `сверка-правил.sh` на стволе main 03fb4060 покраснел на списке
   сверщика на flang — ядро ставит «начало по построению», которого в том списке
   нет, и честная запись с ним была бы отвергнута как подделка. Список здесь
   исправлен по замеру; что он ПОЛОН, стережёт тот же прогон, а не этот файл. */
static const char *PRAVILA[] = {
  "", "неотрицательность по построению", "ограниченность точным потолком по построению",
  "тождество после переписки допущением", "порядок по построению", "строгий порядок по построению",
  "порядок соседних по построению", "вхождение по построению", "цель есть допущение",
  "несовместимые допущения", "вычисление замкнутой цели", "разбор цели по условию",
  "цель-выбор с истинной ветвью", "разбор случаев по дизъюнкции в допущении",
  "разбор случаев по внутреннему условию цели", "равенство, решённое счётом замкнутых частей",
  "начало по построению"
};

static void sverit_shapku(Sverka *s, Sp shapka, const char *ishodnik) {
  long strok = nomer_posle(chast(shapka, 3), "строк ");
  long znakov_v = nomer_posle(chast(shapka, 4), "знаков ");
  long pervyy = (long)chislo_iz_slova(slovo(chast(shapka, 5), 2));
  long vtoroy = (long)chislo_iz_slova(slovo(chast(shapka, 5), 3));
  long stroka_v_ish = razdelit(ishodnik, "\n").n, znak_v_ish = znakov(ishodnik);
  esli_ne(s, strcmp(chast(shapka, 1), "запись доказательства 1") == 0,
          (char *)"шапка не та: первой строкой обязано стоять «запись доказательства 1»");
  esli_ne(s, strok == stroka_v_ish,
          fmt("в записи строк %ld, а в исходнике %ld — запись не от этой программы", strok, stroka_v_ish));
  esli_ne(s, znakov_v == znak_v_ish,
          fmt("в записи знаков %ld, а в исходнике %ld — запись не от этой программы", znakov_v, znak_v_ish));
  esli_ne(s, pervyy == otpechatok(ishodnik, 131, 1000000007),
          (char *)"первый отпечаток не сошёлся — запись не от этой программы");
  esli_ne(s, vtoroy == otpechatok(ishodnik, 137, 998244353),
          (char *)"второй отпечаток не сошёлся — запись не от этой программы");
  /* Ч55: строка есть и сошлась — привязка криптографическая; строки нет —
     молчать нельзя, это третий исход, и он выставляется в вердикте. */
  { char *silnyy = pervaya_s_nachalom(shapka, "отпечаток256 ");
    if (*silnyy) {
      if (strcmp(slovo(silnyy, 2), s->sha) == 0) s->kripto = 1;
      else dobavit(&s->bedy, fmt("отпечаток256 записи «%s» не сошёлся с исходником «%s»",
                                 slovo(silnyy, 2), s->sha));
    } }
}

static const char *vid_stroki_zapisi(const char *s) {
  if (strcmp(s, "следовательно доказано да") == 0) return "доказано";
  if (nachinaetsya(s, "дано «")) return "дано";
  if (nachinaetsya(s, "цель строка") || nachinaetsya(s, "цель ⟨")) return "утверждаем";
  if (nachinaetsya(s, "индукция по ")) return "индукция";
  if (nachinaetsya(s, "случай строка")) return "случай";
  return nachinaetsya(s, "шаг ") ? "шаг" : "";
}

/* Список меток, как их обещает ЗАПИСЬ: тот же порядок и тот же вид, что даёт
   чтение исходника. Сойтись обязаны знак в знак. Строка записи без номера —
   будущий вид: тогда номера снимаются с ОБЕИХ сторон, и это считается. */
static Sp razmetka_zapisi(Sp svoi, long nachalo, int *bez_nomerov) {
  Sp metki = PUSTO; int i;
  dobavit(&metki, fmt("теорема %ld", nachalo));
  for (i = 0; i < svoi.n; i++) {
    char *s = obrezat(svoi.e[i]);
    const char *vid = vid_stroki_zapisi(s);
    long gde;
    if (!*vid) continue;
    if (strcmp(vid, "доказано") == 0) { dobavit(&metki, (char *)"доказано"); continue; }
    gde = nomer_posle(s, "строка ");
    if (gde < 1) *bez_nomerov = 1;
    dobavit(&metki, fmt("%s %ld", vid, gde));
  }
  return metki;
}
static char *bez_nomerov_v(Sp v) {
  Sp r = PUSTO; int i;
  for (i = 0; i < v.n; i++) dobavit(&r, slovo(v.e[i], 1));
  return soedinit(r, ", ");
}

/* ═══ ТРЕТЬЯ ВЕТКА: ТЕРМИН И НОМЕР СТРОКИ — ДВА СВИДЕТЕЛЯ ОБ ОДНОМ МЕСТЕ ═════
   (задача 9612). Веток было две, и каждая брала РОВНО ОДНОГО свидетеля: есть
   номер — читается исходник, термин не смотрят вовсе; нет номера — берётся
   термин, а шаг вообще не сверяется ни с чем. Запись, несущая термин ВМЕСТО
   номера, проверялась МЕНЬШЕ, а не больше. Здесь заведена третья ветка (термин
   РЯДОМ с номером — сверяются друг против друга) и починена вторая (термин БЕЗ
   номера обязан сойтись с чем-то, а не просто лечь в вердикт процитированным).
   Первая ветка (один номер) не тронута ни на знак. */
static int est_ugolki(const char *s) {
  const char *a = strstr(s, "⟨");
  return a != NULL && strstr(a + strlen("⟨"), "⟩") != NULL;
}
/* Строка записи без терма в уголках: термин несёт пробелы и ёлочки внутри
   себя, и без выреза они съезжали бы в пословный разбор (слово номер N,
   N-е ёлочки) — та самая беда, что делает вид «термин вместо номера»
   нерабочим сегодня. */
static char *bez_ugolkov(const char *s) {
  const char *a = strstr(s, "⟨"), *b;
  if (!a) return (char *)s;
  b = strstr(a + strlen("⟨"), "⟩");
  if (!b) return (char *)s;
  return szhat_probely(fmt("%s %s", kopiya(s, (size_t)(a - s)), b + strlen("⟩")));
}
static char *shag_slovami(const char *sh) { return est_ugolki(sh) ? bez_ugolkov(sh) : (char *)sh; }

/* Термин при номере обязан ПОВТОРИТЬ то, что написано в исходнике на названной
   строке: у цели — хвост после «утверждаем», у шага — строку без «то»/«затем».
   Сличение синтаксическое, как и всё равенство термов здесь (аксиома A5).
   Расходятся — беда прогона с теоремой, местом, номером, термом записи и
   текстом исходника. Сходятся — место сочтено сверенным ОБОИМИ свидетелями. */
static void sverit_term_i_nomer(Sverka *s, const char *stroka_zapisi,
                                const char *v_ishodnike, long gde,
                                const char *imya_t, const char *chto) {
  char *v_zapisi, *v_ish;
  if (gde < 1 || !est_ugolki(stroka_zapisi)) return;
  v_zapisi = term(v_ugolkah(stroka_zapisi, 1));
  v_ish = term(v_ishodnike);
  if (strcmp(v_zapisi, v_ish) == 0) { s->svereno_oboimi++; return; }
  dobavit(&s->bedy,
          fmt("теорема «%s», %s, строка %ld: термин записи и исходник говорят о разном — "
              "в записи ⟨%s⟩, а на строке %ld исходника написано «%s»",
              imya_t, chto, gde, v_zapisi, gde, v_ish));
}
/* Термин БЕЗ номера: источника, с которым его сверить, нет — единственный
   независимый свидетель тут обоснование той же строки записи. «Достаточен сам
   по себе» значит: термин обязан СОЙТИСЬ с обоснованием, а не просто лечь в
   вердикт процитированным и забытым. Пуст либо расходится — беда прогона. */
static void sverit_term_bez_nomera(Sverka *s, const char *stroka_zapisi,
                                   const char *obosnovanie, const char *imya_t,
                                   const char *chto) {
  char *v_zapisi;
  if (!est_ugolki(stroka_zapisi)) {
    dobavit(&s->bedy, fmt("теорема «%s», %s: ни номера строки, ни термина в уголках — заменить привязку нечем",
                          imya_t, chto));
    return;
  }
  v_zapisi = term(v_ugolkah(stroka_zapisi, 1));
  if (!*v_zapisi) {
    dobavit(&s->bedy, fmt("теорема «%s», %s: термин в уголках пуст — заменить недостающий номер ему нечем",
                          imya_t, chto));
    return;
  }
  esli_ne(s, strcmp(v_zapisi, term(obosnovanie)) == 0,
          fmt("теорема «%s», %s: термин в уголках говорит «%s», а обоснование той же строки записи — «%s» — расходятся между собой, а термина без номера сверить больше не с чем",
              imya_t, chto, v_zapisi, obosnovanie));
}

/* ТЕОРЕМА ОБЯЗАНА ДОКАЗЫВАТЬ ТО САМОЕ, ЧТО ОБЕЩАНО: сличаются два хвоста строк
   исходника — после «обеспечивает «имя»» и после «утверждаем». Термин цели БЕЗ
   номера сверяется этим же сличением: он и есть «утверждено», и сойтись
   обязан с обещанным постусловием — сам по себе, а не как цитата. */
static void sverit_cel(Sverka *s, Sp svoi, Sp stroki, const char *mesto,
                       const char *imya, const char *imya_t) {
  char *obeshchano = hvost_posle(mesto, fmt("обеспечивает «%s» ", imya));
  char *stroka_celi = pervaya_s_nachalom(svoi, "цель ");
  long gde = nomer_posle(stroka_celi, "строка ");
  char *utverzhdeno;
  if (gde < 1) { utverzhdeno = v_ugolkah(stroka_celi, 1); s->bez_privyazki++; }
  else {
    utverzhdeno = hvost_posle(stroka_po_nomeru(stroki, gde), "утверждаем ");
    sverit_term_i_nomer(s, stroka_celi, utverzhdeno, gde, imya_t, "цель");
  }
  esli_ne(s, strcmp(obeshchano, utverzhdeno) == 0,
          fmt("теорема «%s» утверждает «%s», а постусловие обещает «%s» — доказывается не то, что обещано",
              imya_t, utverzhdeno, obeshchano));
}

/* ═══ ШАГ АВТОРА `по примеру`: ПРИВЯЗКА К ИСТОЧНИКУ — ЯЧЕЙКА Ч71 ════════════
   ЧТО БЫЛО. Шаг `по примеру «имя»` сверялся ровно одним способом: та ли строка
   написана в исходнике. Существует ли пример с таким именем, у той ли он
   функции, о том ли значении говорит и сходится ли с телом — не проверял никто,
   и вердикт честно писал «принято на слово ядра». Замер Ч56 по 86 записям
   корпуса: таких мест 97, из них `по примеру` 93, `по свойству` 4 (счёт Ч71).

   ЧТО СТАЛО. Ядро выписывает в конец строки шага ПРИВЯЗКУ — `пример строка N`.
   Дальше сверщик делает ШЕСТЬ проверок, и каждая — чтение исходника, а не
   доверие записи:
     1. на строке N исходника стоит ровно `пример «имя»` из обоснования шага;
     2. строка N лежит В БЛОКЕ той функции, за которой записано утверждение
        (ядро ищет пример там же и нигде больше);
     3. у примера есть строка `ожидается <значение>`;
     4. значение, которое пример даёт переменной индукции, — то самое, что
        разбирает случай (`вариант «Красный»` против `вариант «Красный»`);
     5. цель, прочитанная из исходника, держится НА ЭТОМ значении (счётом);
     6. ветвь тела функции для того же образца даёт то же значение.
   Прошли все шесть — шаг проверен по существу и с «на слово» снимается.
   Не прошла хоть одна из 1–2 либо расхождение в 4–6 — «НЕ СОШЛОСЬ», код 1.
   Образец или отношение, которых сверщик не знает, — НЕ «сошлось», а «не
   берусь»: шаг остаётся на слове ядра с названной причиной (правило Ч27).

   ЧЕГО ЭТО НЕ ДАЁТ. Прогона примера сверщик не повторяет: вычислителя у него
   нет. Проверка 6 заменяет прогон только там, где ветвь тела — литерал; где
   тело считает, остаётся на слове ядра, и это сказано числом. */
#define METKA_PRIMERA " пример строка "

/* Обоснование шага без дописанной привязки: сверять с исходником надо ровно то,
   что в исходнике написано, а привязки там нет. */
/* Привязка стоит В САМОМ КОНЦЕ строки и кончается цифрами — только такое
   вхождение метки и отрезается. Иначе имя примера, в которое вписаны слова
   «пример строка», прятало бы за собой настоящую привязку. */
static char *bez_privyazki_primera(const char *sh) {
  const char *p = sh, *q, *nashli = NULL;
  while ((q = strstr(p, METKA_PRIMERA)) != NULL) {
    const char *c = q + strlen(METKA_PRIMERA);
    if (*c >= '0' && *c <= '9') {
      const char *k = c;
      while (*k >= '0' && *k <= '9') k++;
      if (!*k) nashli = q;
    }
    p = q + 1;
  }
  return nashli ? kopiya(sh, (size_t)(nashli - sh)) : (char *)sh;
}

/* «Вид» (закрывающий/промежуточный) и обоснование шага, ПОСЛОВНО, независимо
   от того, чем шаг привязан — номером, термином или обоими: «шаг K строка N»
   даёт четыре слова до вида, один «шаг K» — два. Термин вырезается ПЕРЕД
   счётом слов (`shag_slovami`), иначе он сдвигал бы счёт своими пробелами и
   ёлочками — та самая беда, что делает вид «термин вместо номера» нерабочим. */
static char *shag_vid(const char *sh) {
  return slovo(shag_slovami(sh), nomer_posle(sh, "строка ") >= 1 ? 5 : 3);
}
static char *shag_obosnovanie(const char *sh) {
  return slova_posle(bez_privyazki_primera(shag_slovami(sh)), nomer_posle(sh, "строка ") >= 1 ? 5 : 3);
}

/* Блок функции: строка её заголовка и первая строка ЗА блоком.
   КОНЕЦ БЛОКА — ПЕРВОЕ ЖЕ ОБЪЯВЛЕНИЕ ОТ КРАЯ, а не следующая «функция».
   Довод — замер: теорема пишется от края между функциями, и счёт «до следующей
   функции» затягивал её в блок. Тогда ветвью тела становилась строка теоремы
   `то по примеру «Пустой список»`, и ТРИ честных шага записи
   `svyortka-prefiks-chestnaya` получали «расхождение ветви и ожидания» —
   ложный отказ на честной записи. Внутри функции всё написано с отступом,
   поэтому строка без отступа и есть конец. */
static long blok_funkcii(Sp stroki, const char *funkciya, long *konec) {
  long i, nachalo = 0; *konec = stroki.n + 1;
  for (i = 1; i <= stroki.n; i++) {
    char *z = chast(stroki, i);
    if (nachalo) {
      if (*z && z[0] != ' ' && z[0] != '\t' && z[0] != '\r' && !nachinaetsya(z, "//")) { *konec = i; break; }
      continue;
    }
    if (strcmp(imya_funkcii(z), funkciya) == 0) nachalo = i;
  }
  return nachalo;
}

/* Строка `ожидается …` примера, объявленного на строке p. Пример кончается
   первым же `ожидается` — так его читает и разбор языка. */
static char *ozhidaetsya_primera(Sp stroki, long p, long konec) {
  long i;
  for (i = p + 1; i < konec; i++) {
    char *z = stroka_po_nomeru(stroki, i);
    if (nachinaetsya(z, "ожидается ")) return hvost_posle(z, "ожидается ");
    if (!nachinaetsya(z, "дано ") && *z) return (char *)"";
  }
  return (char *)"";
}

/* Значение, которое пример даёт названному доводу. Пусто — не даёт. */
static char *dano_primera(Sp stroki, long p, long konec, const char *dovod) {
  long i;
  for (i = p + 1; i < konec; i++) {
    char *z = stroka_po_nomeru(stroki, i);
    if (nachinaetsya(z, fmt("дано %s равно ", dovod))) return hvost_posle(z, "равно ");
    if (nachinaetsya(z, "ожидается ")) return (char *)"";
    if (!nachinaetsya(z, "дано ") && *z) return (char *)"";
  }
  return (char *)"";
}

/* Ветвь тела для образца: `случай <образец>` и стоящее под ней `то <терм>`.
   Ищется ТОЛЬКО в блоке функции — случаи теоремы лежат выше и сюда не попадают. */
static char *vetv_tela(Sp stroki, long a, long b, const char *obrazec) {
  long i;
  for (i = a; i < b; i++) {
    if (strcmp(stroka_po_nomeru(stroki, i), fmt("случай %s", obrazec)) != 0) continue;
    if (i + 1 < b && nachinaetsya(stroka_po_nomeru(stroki, i + 1), "то "))
      return slova_posle(stroka_po_nomeru(stroki, i + 1), 1);
  }
  return (char *)"";
}

static int chislo_tochno(const char *s, double *z) {
  char *konec;
  if (!*s) return 0;
  *z = strtod(s, &konec);
  return *konec == 0 && konec != s;
}

/* Образец случая и значение примера — одно ли это. СПИСОК ЗАКРЫТ: образца,
   которого здесь нет, сверщик не «пропускает», а объявляет незнакомым. */
static int obrazec_sovpal(const char *obrazec, const char *znachenie, int *znakom) {
  double a, b;
  *znakom = 1;
  if (nachinaetsya(obrazec, "вариант «")) return strcmp(obrazec, znachenie) == 0;
  if (strcmp(obrazec, "пусто") == 0)
    return strcmp(znachenie, "пустой список") == 0 || strcmp(znachenie, "\"\"") == 0;
  /* ДНО ОТРЕЗКА (`случай 0` по `нат`). Совпали числа — случай тот самый;
     не совпали — сверщик НЕ объявляет ложь: ядро на этой дороге проверяет
     попадание значения в дно [0, верх], а не равенство, и отказ здесь был бы
     отказом честной записи. Не совпали — «не берусь». */
  if (chislo_tochno(obrazec, &a) && chislo_tochno(znachenie, &b)) {
    if (a == b) return 1;
    *znakom = 0; return 0;
  }
  *znakom = 0; return 0;
}

/* Держится ли цель `результат <отношение> <число>` при данном значении.
   ОТНОШЕНИЙ ПЯТЬ, и список закрыт по тому же доводу. */
static int cel_derzhitsya(const char *cel, const char *znachenie, int *znakom) {
  static const char *otn[] = { "не меньше ", "не больше ", "больше ", "меньше ", "равен " };
  double v, e; int k;
  *znakom = 0;
  if (!nachinaetsya(cel, "результат ")) return 0;
  if (!chislo_tochno(znachenie, &v)) return 0;
  for (k = 0; k < 5; k++) {
    const char *hvost = cel + strlen("результат ");
    if (!nachinaetsya(hvost, otn[k])) continue;
    if (!chislo_tochno(hvost + strlen(otn[k]), &e)) return 0;
    *znakom = 1;
    switch (k) {
      case 0: return v >= e; case 1: return v <= e; case 2: return v > e;
      case 3: return v < e;  default: return v == e;
    }
  }
  return 0;
}

/* ═══ ШАГ АВТОРА ВНЕ СЛУЧАЯ: ПОДСТАНОВКА ТЕЛА В ТЕРМ — ЯЧЕЙКА Ч76 ═══════════
   ЧТО БЫЛО. Из 97 шагов автора 47 стоят ВНЕ случая разбора: у функции нет
   параметров (это таблица — ряд букв, метка, список замен), индукции нет, и
   цель говорит о `результат` и о вызовах соседних таблиц. Проверка 5 Ч71 ждала
   значения ОТ СЛУЧАЯ, случая нет — и все 47 оставались на слове ядра.

   ЧТО СТАЛО. Сверщик ПОДСТАВЛЯЕТ ТЕЛО В ТЕРМ, и подстановка ровно одна: вызов
   функции БЕЗ ПАРАМЕТРОВ, тело которой — один строковый литерал, заменяется
   значением этого литерала. Так замыкаются и `результат` (тело функции, за
   которой записана теорема), и `(«Соседняя таблица»)`. Замкнутый терм считается
   по ЗАКРЫТОМУ списку: десять отношений (`содержит`, `начинается с`, `равен`,
   `не равен`, четыре сравнения чисел, `плюс`, `минус`) и две формы (`длина`,
   `подстрока`). Сошлось всё — шаг снимается с «на слово»; цель не держится —
   код 1 «НЕ СОШЛОСЬ».

   ГДЕ ПРИЁМ КОНЧАЕТСЯ, И ГРАНИЦА ЭТА НАРОЧНАЯ (замер Ч76 по 86 записям):
     • тело-СПИСОК (вида ["а", "б"]) не подставляется вовсе — 27 мест из 47;
     • `свёртка`, `разложить … на символы`, `голова`, поле записи — незнакомы;
     • функция с параметрами не берётся: у неё `результат` не одно значение;
     • литерал с нулевым знаком (escape u плюс четыре нуля) или со знаком вне
       базовой плоскости отвергается — 3 места: длину такой строки язык считает
       не кодовыми точками, и гадать здесь значит принять неверное;
     • минус ноль не считается ни одним отношением (дыра Ч34/Ч45).
   Всё перечисленное — НЕ «сошлось», а «не берусь»: шаг остаётся на слове ядра
   с названной причиной (правило Ч27 о закрытых списках). Продолжать этот список
   значит заводить внутри сверщика второй вычислитель языка; тогда сверщик
   перестаёт быть независимым и проверить его самого будет нечем. */

/* Значение замкнутого терма. вид: 0 «не берусь», 1 строка, 2 число, 3 признак. */
typedef struct { int vid; char *s; double ch; } Znach;
static const Znach NE_BERUS = { 0, NULL, 0 };
static Znach kak_stroka(char *s)  { Znach z; z.vid = 1; z.s = s;    z.ch = 0;         return z; }
static Znach kak_chislo(double c) { Znach z; z.vid = 2; z.s = NULL; z.ch = c;         return z; }
static Znach kak_priznak(int b)   { Znach z; z.vid = 3; z.s = NULL; z.ch = b ? 1 : 0; return z; }
/* Вид 4 — СПИСОК (ячейка Ч87). Несёт и текст литерала без пробелов вне кавычек
   (по нему решается равенство), и число звеньев (по нему — «длина»). Считать
   элементы по отдельности сверщик не берётся: это был бы разбор значений. */
static Znach kak_spisok(char *s, long n) { Znach z; z.vid = 4; z.s = s; z.ch = (double)n; return z; }

/* Строковый литерал исходника → значение. Экранирование — ровно то, что
   принимает лексер языка (`flang/self/lexer.flang`, «Экранированный» и
   «Читать юникод»): `n`, `r`, `t`, escape `u` с четырьмя знаками, всё остальное
   даёт себя же. Нулевой знак отвергается: сверщик держит строки как строки C, и
   принять его значило бы молча обрезать литерал. */
static int razobrat_literal(const char *t, char **out) {
  size_t d = strlen(t), i, k = 0; char *r;
  if (d < 2 || t[0] != '"' || t[d - 1] != '"') return 0;
  r = dai(d + 1);
  for (i = 1; i + 1 < d; i++) {
    unsigned char c = (unsigned char)t[i];
    if (c >= 0xF0) return 0;                      /* знак вне базовой плоскости */
    /* НЕЭКРАНИРОВАННАЯ КАВЫЧКА ВНУТРИ — это не один литерал, а строка с чем-то
       ещё (`"а" равен "б"`), и брать её за литерал значит подставить не то
       значение. Экранированная сюда не доходит: её съедает ветвь ниже. */
    if (c == '"') return 0;
    if (c != '\\') { r[k++] = (char)c; continue; }
    i++;
    if (i + 1 >= d) return 0;
    if (t[i] == 'n') r[k++] = '\n';
    else if (t[i] == 'r') r[k++] = '\r';
    else if (t[i] == 't') r[k++] = '\t';
    else if (t[i] == 'u') {
      unsigned long kod = 0; int j;
      if (i + 4 >= d - 1) return 0;
      for (j = 1; j <= 4; j++) {
        char h = t[i + j];
        if (h >= '0' && h <= '9') kod = kod * 16 + (unsigned long)(h - '0');
        else if (h >= 'a' && h <= 'f') kod = kod * 16 + (unsigned long)(h - 'a' + 10);
        else if (h >= 'A' && h <= 'F') kod = kod * 16 + (unsigned long)(h - 'A' + 10);
        else return 0;
      }
      if (kod == 0 || (kod >= 0xD800 && kod <= 0xDFFF)) return 0;
      if (kod < 0x80) r[k++] = (char)kod;
      else if (kod < 0x800) {
        r[k++] = (char)(0xC0 | (kod >> 6)); r[k++] = (char)(0x80 | (kod & 0x3F));
      } else {
        r[k++] = (char)(0xE0 | (kod >> 12));
        r[k++] = (char)(0x80 | ((kod >> 6) & 0x3F));
        r[k++] = (char)(0x80 | (kod & 0x3F));
      }
      i += 4;
    } else r[k++] = t[i];
  }
  r[k] = 0; *out = r; return 1;
}

/* Длина строки В ЗНАКАХ — кодовыми точками. Знак вне базовой плоскости сюда не
   доходит: литерал с ним отвергнут разбором выше, и разницы между счётом
   кодовыми точками и счётом языка тут не остаётся. */
static long dlina_znakov(const char *s) {
  long n = 0; const unsigned char *p = (const unsigned char *)s;
  for (; *p; p++) if ((*p & 0xC0) != 0x80) n++;
  return n;
}
/* Начало n-го знака (счёт с единицы); n = длина+1 даёт конец строки. */
static const char *nachalo_znaka(const char *s, long n) {
  long i = 0; const unsigned char *p = (const unsigned char *)s;
  while (*p) { if ((*p & 0xC0) != 0x80) { i++; if (i == n) break; } p++; }
  return (const char *)p;
}
static int podstroka_znakov(const char *s, long a, long b, char **out) {
  const char *na, *ko;
  if (a < 1 || a > b || b > dlina_znakov(s)) return 0;
  na = nachalo_znaka(s, a); ko = nachalo_znaka(s, b + 1);
  *out = kopiya(na, (size_t)(ko - na)); return 1;
}

/* СПИСОК ОТНОШЕНИЙ ЗАКРЫТ. Порядок важен: длинное имя стоит раньше короткого,
   чтобы «не равен» не разрезалось как «равен». */
static const char *OTNOSHENIYA[] = {
  " содержит ", " начинается с ", " не равен ", " равен ",
  " не меньше ", " не больше ", " меньше ", " больше ", " плюс ", " минус "
};
#define OTNOSHENIY 10

/* Первое вхождение знака операции ВЕРХНЕГО УРОВНЯ: вне скобок и ВНЕ КАВЫЧЕК.
   Наивное деление по пробелам (как в `razdelit_sverhu`) здесь не годится: в
   строковом литерале бывают и скобки, и пробелы, и сами слова отношений. */
static int nayti_sverhu(const char *t, const char **spisok, int skolko,
                        long *gde, int *kakoe) {
  long gl = 0, i; int v_kavychkah = 0;
  for (i = 0; t[i]; i++) {
    if (v_kavychkah) {
      if (t[i] == '\\' && t[i + 1]) i++;
      else if (t[i] == '"') v_kavychkah = 0;
      continue;
    }
    if (t[i] == '"') { v_kavychkah = 1; continue; }
    if (t[i] == '(') { gl++; continue; }
    if (t[i] == ')') { gl--; continue; }
    if (gl != 0 || t[i] != ' ') continue;
    { int k; for (k = 0; k < skolko; k++)
        if (nachinaetsya(t + i, spisok[k])) { *gde = i; *kakoe = k; return 1; } }
  }
  return 0;
}

/* Снятие внешней пары скобок, если она обнимает ВЕСЬ терм. Своё, а не `uzhat`:
   тот считает скобки по всей строке, не глядя на кавычки. */
static char *bez_vneshnih(const char *syroy) {
  char *t = obrezat(syroy); int raz;
  for (raz = 0; raz < 6; raz++) {
    long gl = 0, i; int v_kavychkah = 0, vsyo = 1; size_t d = strlen(t);
    if (d < 2 || t[0] != '(' || t[d - 1] != ')') break;
    for (i = 0; t[i]; i++) {
      if (v_kavychkah) {
        if (t[i] == '\\' && t[i + 1]) i++;
        else if (t[i] == '"') v_kavychkah = 0;
        continue;
      }
      if (t[i] == '"') { v_kavychkah = 1; continue; }
      if (t[i] == '(') gl++;
      else if (t[i] == ')') { gl--; if (gl == 0 && t[i + 1]) { vsyo = 0; break; } }
    }
    if (!vsyo || gl != 0) break;
    t = obrezat(kopiya(t + 1, d - 2));
  }
  return t;
}

/* ═══ ТЕЛО-СПИСОК: УКАЗАТЕЛЬ ДАЁТ ПЕЧАТЬ — ЯЧЕЙКА Ч87, ДОРОГА П ═════════════
   ЧТО БЫЛО. Ч76 брала телом только ОДИН строковый литерал. Из 47 шагов вне
   случая 27 остались с названной причиной «тело — не один строковый литерал»:
   у них тело — списочный литерал, писанный по звену на строку.

   ЧТО СТАЛО. ИСКАТЬ литерал сверщик не ищет: печать записи выписала оглавление
   («таблица «Имя» открыта N закрыта M звеньев K»), и сверщик берёт оттуда,
   ГДЕ смотреть. Всё остальное он делает сам и заново:
     • на строке N обязана стоять ровно «[», на строке M — ровно «]»;
     • обе обязаны лежать внутри блока названной функции, и у функции не должно
       быть доводов;
     • звенья он пересчитывает сам и сличает свой счёт с объявленным в записи.
   Разошлось хоть в одном — это ЛОЖЬ ЗАПИСИ, а не «не берусь»: беда называется
   и вердикт становится «НЕ СОШЛОСЬ». Печать здесь только указывает; всё, что
   она сказала, есть второе чтение того же места, и оно сличается (узор Ч56).

   ЗНАЧЕНИЙ ЭТОТ ПРИЁМ НЕ РАЗБИРАЕТ. Список сравнивается с другим списком по
   тексту без пробелов вне кавычек и меряется длиной — и всё. */

/* Пробелы ВНЕ кавычек долой: тот же литерал, писанный по звену на строку и
   писанный в одну строку, обязаны сравниваться как одно. Внутри кавычек не
   трогается ничего — там пробел есть знак значения. Незакрытая кавычка даёт
   пустую строку, и звавший обязан ответить «не берусь». */
static char *bez_probelov_vne_kavychek(const char *s) {
  size_t d = strlen(s), i, k = 0; char *r = dai(d + 1); int v_kav = 0;
  for (i = 0; i < d; i++) {
    char c = s[i];
    if (v_kav) {
      r[k++] = c;
      if (c == '\\' && i + 1 < d) r[k++] = s[++i];
      else if (c == '"') v_kav = 0;
      continue;
    }
    if (c == '"') { v_kav = 1; r[k++] = c; continue; }
    if (c == ' ' || c == '\t' || c == '\r' || c == '\n') continue;
    r[k++] = c;
  }
  r[k] = 0;
  return v_kav ? (char *)"" : r;
}

/* Строка — РОВНО ОДНО звено списка. Запятая верхнего уровня позволена только
   последним знаком: иначе счёт звеньев по строкам был бы ложью. Скобки и
   кавычки обязаны сойтись в пределах строки — перенос звена тоже «не берусь».
   Поэтому одинокая «[» звеном не считается никогда, и на этом стоит поиск. */
static int odno_zveno(const char *z, int posledneye) {
  size_t d = strlen(z), i; long gl = 0; int v_kav = 0;
  if (!d || nachinaetsya(z, "//")) return 0;
  for (i = 0; i < d; i++) {
    if (v_kav) {
      if (z[i] == '\\' && i + 1 < d) i++;
      else if (z[i] == '"') v_kav = 0;
      continue;
    }
    if (z[i] == '"') { v_kav = 1; continue; }
    if (z[i] == '(' || z[i] == '[') { gl++; continue; }
    if (z[i] == ')' || z[i] == ']') { gl--; continue; }
    if (z[i] == ',' && gl == 0 && i + 1 < d) return 0;
  }
  if (v_kav || gl != 0) return 0;
  return posledneye ? (z[d - 1] != ',') : (z[d - 1] == ',');
}

/* Звенья в диапазоне a…b: КАЖДАЯ строка обязана быть одним звеном. Ноль — не
   «пусто», а «не берусь»: счёт по строкам на таком диапазоне не годится. */
static long zvenev_v_diapazone(Sp stroki, long a, long b) {
  long i;
  if (a < 1 || b < a || b > stroki.n) return 0;
  for (i = a; i <= b; i++)
    if (!odno_zveno(stroka_po_nomeru(stroki, i), i == b)) return 0;
  return b - a + 1;
}

/* Текст литерала целиком (со скобками), пробелы вне кавычек долой. */
static char *tekst_spiska(Sp stroki, long a, long b) {
  Sp v = PUSTO; long i;
  for (i = a - 1; i <= b + 1; i++) dobavit(&v, stroka_po_nomeru(stroki, i));
  return bez_probelov_vne_kavychek(soedinit(v, " "));
}

/* ОГЛАВЛЕНИЕ, ВЫПИСАННОЕ ПЕЧАТЬЮ. Строки «таблица …» из шапки записи. */
static Sp OGLAVLENIE = { NULL, 0, 0 };
/* Ложь оглавления — беда ЗАПИСИ, а не «не берусь»: печать назвала место, и
   место обязано быть тем самым. Копится здесь, вливается в сверку по концу. */
static Sp OGL_BEDY = { NULL, 0, 0 };

/* ДОРОГА П. Указатель печати на списочный литерал. Верится ему ровно в одном —
   ГДЕ искать; всё названное перечитывается. */
static int literal_spiska(Sp stroki, const char *imya, long *a, long *b) {
  int i;
  for (i = 0; i < OGLAVLENIE.n; i++) {
    char *z = OGLAVLENIE.e[i];
    long a0, b0, n0, n, nach, konec, j;
    if (strcmp(v_yolochkah(z, 1), imya) != 0) continue;
    a0 = nomer_posle(z, "открыта "); b0 = nomer_posle(z, "закрыта ");
    n0 = nomer_posle(z, "звеньев ");
    if (strcmp(stroka_po_nomeru(stroki, a0), "[") != 0 ||
        strcmp(stroka_po_nomeru(stroki, b0), "]") != 0) {
      dobavit(&OGL_BEDY, fmt("оглавление зовёт таблицей «%s» строки %ld…%ld, а «[» и «]» там не стоят",
                             imya, a0, b0));
      return 0;
    }
    nach = blok_funkcii(stroki, imya, &konec);
    if (nach < 1 || a0 <= nach || b0 >= konec) {
      dobavit(&OGL_BEDY, fmt("оглавление кладёт таблицу «%s» на строки %ld…%ld, а блок этой функции — не там",
                             imya, a0, b0));
      return 0;
    }
    for (j = nach + 1; j < konec; j++)
      if (nachinaetsya(stroka_po_nomeru(stroki, j), "принимает ")) {
        dobavit(&OGL_BEDY, fmt("оглавление зовёт таблицей «%s», а у этой функции есть доводы", imya));
        return 0;
      }
    n = zvenev_v_diapazone(stroki, a0 + 1, b0 - 1);
    if (n != n0) {
      dobavit(&OGL_BEDY, fmt("оглавление объявляет у «%s» звеньев %ld, а сверщик насчитал %ld",
                             imya, n0, n));
      return 0;
    }
    *a = a0 + 1; *b = b0 - 1;
    return 1;
  }
  return 0;
}

/* Значение функции-таблицы со списочным телом. */
static Znach tablica_spiskom(Sp stroki, const char *imya) {
  long a, b, n;
  if (!literal_spiska(stroki, imya, &a, &b)) return NE_BERUS;
  n = zvenev_v_diapazone(stroki, a, b);
  if (n < 1) return NE_BERUS;
  return kak_spisok(tekst_spiska(stroki, a, b), n);
}

/* ТЕЛО ФУНКЦИИ-ТАБЛИЦЫ. Годится только функция БЕЗ параметров, тело которой —
   один строковый литерал: последняя непустая строка блока. Всё прочее — 0,
   и звавший обязан ответить «не берусь», а не «сошлось». */
static int telo_tablicy(Sp stroki, const char *imya, char **znachenie) {
  long a, b, i, telo = 0;
  a = blok_funkcii(stroki, imya, &b);
  if (a < 1) return 0;
  for (i = a + 1; i < b; i++) {
    char *z = stroka_po_nomeru(stroki, i);
    if (nachinaetsya(z, "принимает ")) return 0;   /* у функции есть параметры */
    if (*z && !nachinaetsya(z, "//")) telo = i;
  }
  if (telo < 1) return 0;
  return razobrat_literal(stroka_po_nomeru(stroki, telo), znachenie);
}

/* Значение замкнутого терма. `rezultat` — тело функции, за которой стоит
   теорема; им и замыкается слово `результат`. Глубина ограничена: терм цели
   короток, а бесконечного спуска в сверщике быть не должно. */
static Znach ocenit_term(const char *syroy, Sp stroki, Znach rezultat, int glubina) {
  char *t, *lit, *im; long gde; int kakoe; double ch;
  if (glubina > 8) return NE_BERUS;
  t = bez_vneshnih(syroy);
  if (!*t) return NE_BERUS;
  if (nayti_sverhu(t, OTNOSHENIYA, OTNOSHENIY, &gde, &kakoe)) {
    Znach a = ocenit_term(kopiya(t, (size_t)gde), stroki, rezultat, glubina + 1);
    Znach b = ocenit_term(t + gde + strlen(OTNOSHENIYA[kakoe]), stroki, rezultat, glubina + 1);
    if (!a.vid || !b.vid) return NE_BERUS;
    if (kakoe == 0 || kakoe == 1) {
      if (a.vid != 1 || b.vid != 1) return NE_BERUS;
      return kak_priznak(kakoe == 0 ? soderzhit(a.s, b.s) : nachinaetsya(a.s, b.s));
    }
    if (kakoe == 2 || kakoe == 3) {
      int ravny;
      if (a.vid != b.vid) return NE_BERUS;
      ravny = (a.vid == 1 || a.vid == 4) ? (strcmp(a.s, b.s) == 0) : (a.ch == b.ch);
      return kak_priznak(kakoe == 2 ? !ravny : ravny);
    }
    if (a.vid != 2 || b.vid != 2) return NE_BERUS;
    switch (kakoe) {
      case 4: return kak_priznak(a.ch >= b.ch);
      case 5: return kak_priznak(a.ch <= b.ch);
      case 6: return kak_priznak(a.ch <  b.ch);
      case 7: return kak_priznak(a.ch >  b.ch);
      case 8: return kak_chislo(a.ch + b.ch);
      default: return kak_chislo(a.ch - b.ch);
    }
  }
  if (strcmp(t, "результат") == 0) return rezultat;
  if (strcmp(t, "да") == 0) return kak_priznak(1);
  if (strcmp(t, "нет") == 0) return kak_priznak(0);
  if (razobrat_literal(t, &lit)) return kak_stroka(lit);
  if (chislo_tochno(t, &ch)) {
    /* МИНУС НОЛЬ СЮДА НЕ ПУСКАЕТСЯ: ядро считает `0` и минус ноль одним термом,
       язык — разными (дыра Ч34, закрыта Ч45). Считать здесь значило бы гадать. */
    if (t[0] == '-' && ch == 0) return NE_BERUS;
    return kak_chislo(ch);
  }
  im = v_yolochkah(t, 1);
  if (*im && strcmp(fmt("«%s»", im), t) == 0) {
    char *v;
    if (telo_tablicy(stroki, im, &v)) return kak_stroka(v);
    return tablica_spiskom(stroki, im);
  }
  if (nachinaetsya(t, "длина ")) {
    Znach a = ocenit_term(t + strlen("длина "), stroki, rezultat, glubina + 1);
    if (a.vid == 4) return kak_chislo(a.ch);          /* длина списка — звенья */
    return a.vid == 1 ? kak_chislo((double)dlina_znakov(a.s)) : NE_BERUS;
  }
  if (nachinaetsya(t, "подстрока ")) {
    static const char *S_[] = { " с " }, *PO_[] = { " по " };
    char *h = t + strlen("подстрока "), *rez; long i1, i2, a1, b1; int nn;
    Znach x, p, q;
    if (!nayti_sverhu(h, S_, 1, &i1, &nn)) return NE_BERUS;
    if (!nayti_sverhu(h + i1 + 3, PO_, 1, &i2, &nn)) return NE_BERUS;
    x = ocenit_term(kopiya(h, (size_t)i1), stroki, rezultat, glubina + 1);
    p = ocenit_term(kopiya(h + i1 + 3, (size_t)i2), stroki, rezultat, glubina + 1);
    q = ocenit_term(h + i1 + 3 + i2 + 4, stroki, rezultat, glubina + 1);
    if (x.vid != 1 || p.vid != 2 || q.vid != 2) return NE_BERUS;
    a1 = (long)p.ch; b1 = (long)q.ch;
    if ((double)a1 != p.ch || (double)b1 != q.ch) return NE_BERUS;
    if (!podstroka_znakov(x.s, a1, b1, &rez)) return NE_BERUS;
    return kak_stroka(rez);
  }
  return NE_BERUS;
}

/* Шаг автора ВНЕ случая. Возвращает 1, если шаг проверен по существу.
   Две проверки Ч76 поверх трёх первых проверок Ч71:
     7. тело функции — таблица, и оно СХОДИТСЯ с `ожидается` примера (это
        замена прогону там, где прогонять нечего: тело и есть литерал);
     8. цель, замкнутая подстановкой тела, ДЕРЖИТСЯ (счётом самого сверщика).
   Расхождение в 7 или 8 — «НЕ СОШЛОСЬ». Незнакомая форма — «не берусь». */
static int ne_vzyalsya(Sverka *s, const char *imya_t, const char *pochemu) {
  dobavit(&s->ne_vzyalsya, fmt("теорема «%s»: шаг вне случая не проверен — %s", imya_t, pochemu));
  return 0;
}
static int sverit_shag_vne_sluchaya(Sverka *s, Sp stroki, const char *imya_t,
                                    const char *imya_p, const char *chya,
                                    const char *ozh, const char *cel,
                                    int est_svobodnye) {
  char *telo, *ozh_z; Znach z;
  if (est_svobodnye) return ne_vzyalsya(s, imya_t, "в цели остаётся свободное имя");
  if (!telo_tablicy(stroki, chya, &telo)) {
    /* ТЕЛО-СПИСОК (Ч87). Проверка 7 та же и здесь: тело обязано сойтись с
       `ожидается` примера — сравнением текста без пробелов вне кавычек. */
    Znach sp = tablica_spiskom(stroki, chya);
    char *ozh_n = bez_probelov_vne_kavychek(ozh);
    if (!sp.vid) return ne_vzyalsya(s, imya_t, fmt("тело функции «%s» — не литерал без параметров", chya));
    if (!*ozh_n) return ne_vzyalsya(s, imya_t, fmt("«ожидается» примера «%s» не разбирается", imya_p));
    esli_ne(s, strcmp(sp.s, ozh_n) == 0,
            fmt("теорема «%s»: пример «%s» ждёт другой список, чем тело функции «%s»",
                imya_t, imya_p, chya));
    if (strcmp(sp.s, ozh_n) != 0) return 0;
    z = ocenit_term(cel, stroki, sp, 0);
    if (z.vid != 3) return ne_vzyalsya(s, imya_t, fmt("вид цели «%s» сверщику незнаком", cel));
    esli_ne(s, z.ch != 0,
            fmt("теорема «%s»: цель «%s» при теле функции «%s» НЕ держится", imya_t, cel, chya));
    return z.ch != 0;
  }
  if (!razobrat_literal(ozh, &ozh_z))
    return ne_vzyalsya(s, imya_t, fmt("«ожидается» примера «%s» — не строковый литерал", imya_p));
  esli_ne(s, strcmp(telo, ozh_z) == 0,
          fmt("теорема «%s»: пример «%s» ждёт «%s», а тело функции «%s» даёт другое значение",
              imya_t, imya_p, ozh, chya));
  if (strcmp(telo, ozh_z) != 0) return 0;
  z = ocenit_term(cel, stroki, kak_stroka(telo), 0);
  if (z.vid != 3) return ne_vzyalsya(s, imya_t, fmt("вид цели «%s» сверщику незнаком", cel));
  esli_ne(s, z.ch != 0,
          fmt("теорема «%s»: цель «%s» при теле функции «%s» НЕ держится",
              imya_t, cel, chya));
  return z.ch != 0;
}

/* Одна проверка шага `по примеру`. Возвращает 1, если шаг проверен по существу
   и с «на слово» снимается; причина, по которой не снимается, называется. */
static int sverit_shag_primerom(Sverka *s, const char *sh, Sp stroki, const char *imya_t,
                                const char *chya, const char *po, long sluchay_gde,
                                const char *cel, int est_svobodnye) {
  /* Имя примера ищется БЕЗ терма в уголках: термин может нести своё «в
     ёлочках», и без выреза оно перехватило бы первое место у имени примера. */
  char *imya_p = v_yolochkah(shag_slovami(sh), 1);
  long p = nomer_posle(sh, METKA_PRIMERA), a, b;
  char *ozh, *dano, *obrazec, *vetv; int znakom = 0;
  if (p < 1) { s->bez_privyazki++; return 0; }
  a = blok_funkcii(stroki, chya, &b);
  esli_ne(s, a > 0, fmt("теорема «%s»: функции «%s» в исходнике нет, а пример «%s» записан за ней",
                        imya_t, chya, imya_p));
  if (a < 1) return 0;
  esli_ne(s, strcmp(stroka_po_nomeru(stroki, p), fmt("пример «%s»", imya_p)) == 0,
          fmt("теорема «%s»: запись привязывает пример «%s» к строке %ld, а там написано «%s»",
              imya_t, imya_p, p, stroka_po_nomeru(stroki, p)));
  esli_ne(s, p >= a && p < b,
          fmt("теорема «%s»: пример «%s» записан на строке %ld, а блок функции «%s» — строки %ld…%ld: пример чужой",
              imya_t, imya_p, p, chya, a, b - 1));
  if (strcmp(stroka_po_nomeru(stroki, p), fmt("пример «%s»", imya_p)) != 0 || p < a || p >= b) return 0;
  ozh = ozhidaetsya_primera(stroki, p, b);
  if (!*ozh) return 0;                       /* примера без «ожидается» язык не принимает */
  /* ШАГ ВНЕ СЛУЧАЯ — дорога Ч76: замкнутость цели решается подстановкой тела. */
  if (sluchay_gde < 1)
    return sverit_shag_vne_sluchaya(s, stroki, imya_t, imya_p, chya, ozh, cel, est_svobodnye);
  obrazec = hvost_posle(stroka_po_nomeru(stroki, sluchay_gde), "случай ");
  dano = dano_primera(stroki, p, b, po);
  if (!*dano || !*obrazec) return 0;
  if (!obrazec_sovpal(obrazec, dano, &znakom)) {
    esli_ne(s, !znakom,
            fmt("теорема «%s»: случай разбирает «%s», а пример «%s» задаёт «%s» как «%s» — это о другом значении",
                imya_t, obrazec, imya_p, po, dano));
    return 0;
  }
  vetv = vetv_tela(stroki, a, b, obrazec);
  if (!*vetv) return 0;                      /* ветвь тела не литерал — прогон не повторить */
  esli_ne(s, strcmp(vetv, ozh) == 0,
          fmt("теорема «%s»: пример «%s» ждёт «%s», а ветвь тела на «%s» даёт «%s»",
              imya_t, imya_p, ozh, obrazec, vetv));
  if (strcmp(vetv, ozh) != 0) return 0;
  if (!cel_derzhitsya(cel, ozh, &znakom)) {
    esli_ne(s, !znakom,
            fmt("теорема «%s»: цель «%s» на значении примера «%s» (%s) НЕ держится",
                imya_t, cel, imya_p, ozh));
    return 0;
  }
  return 1;
}

/* Каждый записанный шаг обязан быть НАПИСАН в исходнике теми же словами. */
static void sverit_shagi(Sverka *s, Sp svoi, Sp stroki, const char *imya_t,
                         const char *chya, const char *cel) {
  char *po = v_yolochkah(pervaya_s_nachalom(svoi, "индукция по "), 1);
  /* Свободное имя в цели: `дано «х»` или индукция. Тогда `результат` не одно
     значение, и подстановка тела (дорога Ч76) не годится — «не берусь». */
  int svobodnye = (*pervaya_s_nachalom(svoi, "дано «") != 0) || (*po != 0);
  long sluchay_gde = 0; int i;
  for (i = 0; i < svoi.n; i++) {
    char *sh = obrezat(svoi.e[i]);
    long gde; char *vid, *obosnovanie, *v_ish;
    if (nachinaetsya(sh, "случай строка")) { sluchay_gde = nomer_posle(sh, "строка "); continue; }
    if (!nachinaetsya(sh, "шаг ")) continue;
    gde = nomer_posle(sh, "строка ");
    vid = shag_vid(sh); obosnovanie = shag_obosnovanie(sh);
    s->shagov++;
    /* Шаг, обоснованный свойством или законом, чекер НЕ пересчитывает: он
       сверяет, что так написано в исходнике, а держится ли обоснование —
       решало ядро. Шаг `по примеру` с привязкой проверяется по существу. */
    if (nachinaetsya(obosnovanie, "по примеру")) {
      if (sverit_shag_primerom(s, sh, stroki, imya_t, chya, po, sluchay_gde, cel, svobodnye)) s->shagov_primerom++;
      else s->shagov_na_slovo++;
    } else if (nachinaetsya(obosnovanie, "по свойству") || nachinaetsya(obosnovanie, "по закону"))
      s->shagov_na_slovo++;
    if (gde < 1) {
      sverit_term_bez_nomera(s, sh, obosnovanie, imya_t, fmt("шаг %s", slovo(sh, 2)));
      s->bez_privyazki++; continue;
    }
    v_ish = bez_to(stroka_po_nomeru(stroki, gde));
    sverit_term_i_nomer(s, sh, nachinaetsya(v_ish, "затем ") ? slova_posle(v_ish, 1) : v_ish,
                        gde, imya_t, fmt("шаг %s", slovo(sh, 2)));
    if (strcmp(vid, "промежуточный") == 0)
      esli_ne(s, nachinaetsya(v_ish, "затем ") && soderzhit(v_ish, obosnovanie),
              fmt("теорема «%s», строка %ld: запись зовёт шаг промежуточным и обоснованным «%s», а в исходнике стоит «%s» — промежуточный шаг пишется словом «затем»",
                  imya_t, gde, obosnovanie, v_ish));
    else
      esli_ne(s, strcmp(v_ish, obosnovanie) == 0,
              fmt("теорема «%s», строка %ld: запись говорит «%s», а в исходнике написано «%s»",
                  imya_t, gde, obosnovanie, v_ish));
  }
}

/* ЦЕЛЬ ОБЯЗАН ЗАКРЫТЬ ШАГ БЕЗ ВЫПИСАННОГО УТВЕРЖДЕНИЯ, И В КАЖДОМ СЛУЧАЕ СВОЙ.
   Считается обходом по порядку: случай, у которого до следующего не встретилось
   ни одного закрывающего шага, обставлен фактами и не закрыт ничем. */
static long nezakrytye_sluchai(Sp svoi) {
  int i, v_sluchae = 0, zakryt = 0; long dolg = 0;
  for (i = 0; i < svoi.n; i++) {
    char *s = obrezat(svoi.e[i]);
    if (nachinaetsya(s, "случай строка")) {
      if (v_sluchae && !zakryt) dolg++;
      v_sluchae = 1; zakryt = 0;
    } else if (nachinaetsya(s, "шаг ") && strcmp(shag_vid(s), "закрывающий") == 0) zakryt = 1;
  }
  return (v_sluchae && !zakryt) ? dolg + 1 : dolg;
}

static void sverit_zakrytie(Sverka *s, Sp svoi, const char *imya_t, const char *verdikt) {
  Sp shagi = vse_s_nachalom(svoi, "шаг ");
  long zakryv = 0, sluchaev = vse_s_nachalom(svoi, "случай строка").n, nuzhno, nezakr;
  char *qed = slovo_posle(pervaya_s_nachalom(svoi, "следовательно доказано "), "доказано ");
  int i, dokazano = strcmp(verdikt, "доказано") == 0;
  for (i = 0; i < shagi.n; i++) if (strcmp(shag_vid(shagi.e[i]), "закрывающий") == 0) zakryv++;
  nuzhno = sluchaev > 0 ? sluchaev : 1;
  nezakr = nezakrytye_sluchai(svoi);
  esli_ne(s, !dokazano || strcmp(qed, "да") == 0,
          fmt("теорема «%s»: вердикт «доказано», а «следовательно доказано» не стоит", imya_t));
  esli_ne(s, !dokazano || zakryv >= nuzhno,
          fmt("теорема «%s»: закрывающих шагов %ld на %ld случаев — цель закрыта не везде, доказательство обрублено",
              imya_t, zakryv, sluchaev));
  esli_ne(s, !dokazano || nezakr == 0,
          fmt("теорема «%s»: случаев без закрывающего шага %ld — цель в них только обставлена промежуточными фактами, а не выведена",
              imya_t, nezakr));
}

/* Список стережётся у ВСЯКОГО утверждения, а не только у того, при котором
   написана теорема: посылки с названным правилом ядро ставит и без теоремы. */
static void sverit_pravila(Sverka *s, Sp svoi, const char *o_chyom) {
  Sp posylki = vse_s_nachalom(svoi, "посылка "), chuzhie = PUSTO;
  int i, j, n = (int)(sizeof PRAVILA / sizeof *PRAVILA);
  for (i = 0; i < posylki.n; i++) {
    char *r = v_yolochkah(posylki.e[i], 3);
    for (j = 0; j < n; j++) if (strcmp(PRAVILA[j], r) == 0) break;
    if (j == n) dobavit(&chuzhie, r);
  }
  esli_ne(s, chuzhie.n == 0,
          fmt("%s: запись ссылается на правило сведения, которого сверщик не знает: %s",
              o_chyom, soedinit(chuzhie, ", ")));
}

/* ДОЛГ СЧИТАЕТСЯ ПОИМЁННО: посылка стоит в долге, если её правило названо, а
   ходов под нею не записано ни одного — проверить в ней нечего, кроме имени. */
static long posylki_na_slovo(Sp svoi) {
  int i, pravilo = 0, hody = 0; long dolg = 0;
  for (i = 0; i < svoi.n; i++) {
    char *s = obrezat(svoi.e[i]);
    if (nachinaetsya(s, "посылка ")) {
      if (pravilo && !hody) dolg++;
      pravilo = *v_yolochkah(s, 3) != 0; hody = 0;
    } else if (strcmp(s, "ход конец") == 0) hody = 1;
  }
  return (pravilo && !hody) ? dolg + 1 : dolg;
}

/* Стоит ли имя доводом той функции, в чьём объявлении написано постусловие.
   Нужно там, где сверить имя переменной индукции больше не с чем: у утверждения
   без теоремы и без «для всех» строки «индукция по» в записи тоже нет. */
static int dovod_funkcii(Sp stroki, const char *mesto, const char *imya) {
  int i, vnutri = 0;
  for (i = 0; i < stroki.n; i++) {
    char *syraya = stroki.e[i], *l = obrezat(syraya);
    if (nachinaetsya(syraya, "функция «") || nachinaetsya(syraya, "тотальная функция «")) vnutri = 1;
    else if (vnutri && nachinaetsya(l, "принимает ") &&
             est_term(zamenit(zamenit(l, ":", " : "), ",", " , "), imya)) return 1;
    if (strcmp(l, mesto) == 0) return 0;
  }
  return 0;
}
/* ═══ УЗЕЛ ВЕРДИКТА «РАЗБОРОМ ПО СЛУЧАЯМ» — ЯЧЕЙКА Ч363 ══════════════════════
   ГДЕ ЭТО СТОИТ. Утверждение без теоремы ядро закрывает двумя подмаршрутами.
   Один — «по объявленному типу»: в запись из него не доезжает ни байта, и
   сверять нечего. Другой — «разбором по случаям»: принцип и посылки в записи
   СТОЯТ, но `proigrat_blok` переигрывает только ВЫПИСАННЫЕ ходы, а у посылки,
   закрытой сведением, их ноль. Оттого 13 таких мест корпуса числились на слово
   ядра — вместе с 26 своими посылками, и это один и тот же долг.

   ЧТО ПРОИГРЫВАЕТСЯ ЗДЕСЬ. Ровно один носитель — ОТРЕЗОК — и ровно одно правило
   — «неотрицательность по построению». Тело обязано быть одним «если». Какая
   ветвь дно, сказано ФОРМОЙ УСЛОВИЯ, а не догадкой о содержимом ветвей; её
   значение сверщик считает сам и требует, чтобы цель на нём держалась. Спуск
   обязан быть суммой неотрицательного ПО ПОСТРОЕНИЮ с рекурсивным вызовом на
   «по минус шаг»: этот вызов и есть допущение индукции, других допущений
   правило не берёт. Сошлось всё — узел снимается со слова ядра ВМЕСТЕ С
   ПОСЫЛКАМИ, потому что проиграно именно то, что они называли именем правила.

   ГДЕ ПРИЁМ КОНЧАЕТСЯ, И ГРАНИЦА НАРОЧНАЯ, а «не берусь» тут ДВУХ РАЗНЫХ ПОРОД.
   Узел ВНЕ ПРИЁМА — носитель `algebra` (10 мест из 13), другое правило, другая
   цель — считается ЧИСЛОМ в вердикте: приём за него не брался и не ломался.
   Узел, за который приём ВЗЯЛСЯ и не смог (тело не из одного «если», форма
   условия незнакома, дно не считается, спуск не сложился), называется
   ПОИМЁННО строкой «НЕ ВЗЯЛСЯ» — правило Ч27 о закрытых списках. А вот
   РАСХОЖДЕНИЕ прочитанного с записанным — «НЕ СОШЛОСЬ», как и у шага автора. */

/* Слагаемое неотрицательно ПО ПОСТРОЕНИЮ: либо число не меньше нуля, либо сам
   довод индукции, объявленный типом «нат». Список закрыт. */
static int neotricatelen(const char *t, const char *po, int po_nat) {
  double v;
  if (chislo_tochno(t, &v)) return v >= 0;
  return po_nat && strcmp(t, po) == 0;
}

/* Объявлен ли довод названным типом — читается ИЗ ИСХОДНИКА, а не берётся из
   записи: на этом объявлении стоит неотрицательность самого довода. */
static int dovod_tipa(Sp stroki, long a, long b, const char *imya, const char *tip) {
  long i;
  for (i = a; i < b; i++) {
    char *l = kak_chitaet_yazyk(chast(stroki, i));
    if (!nachinaetsya(l, "принимает ")) continue;
    return est_term(szhat_probely(zamenit(zamenit(l, ":", " : "), ",", " , ")),
                    fmt("%s : %s", imya, tip));
  }
  return 0;
}

/* Какая ветвь тела — дно: отношений пять, список закрыт, незнакомая форма даёт
   пустое слово, и узел остаётся на слове ядра. */
static const char *vetv_dna(const char *uslovie, const char *po) {
  static const char *otn[] = { "не больше ", "не меньше ", "больше ", "меньше ", "равно " };
  static const char *gde[] = { "то",         "иначе",      "иначе",   "то",      "то" };
  char *hvost; double v; int k;
  if (strcmp(slovo(uslovie, 1), po) != 0) return "";
  hvost = slova_posle(uslovie, 1);
  for (k = 0; k < 5; k++)
    if (nachinaetsya(hvost, otn[k]) && chislo_tochno(hvost + strlen(otn[k]), &v)) return gde[k];
  return "";
}

static int ne_proigran(Sverka *s, const char *imya, char *pochemu) {
  dobavit(&s->ne_vzyalsya, fmt("утверждение «%s»: узел вердикта не проигран — %s", imya, pochemu));
  return 0;
}

/* Проиграть узел вердикта заново. 1 — проигран целиком, и посылки его тоже. */
static int proigrat_uzel(Sverka *s, Sp svoi, Sp stroki, const char *imya,
                         const char *chya, const char *cel) {
  char *princip = pervaya_s_nachalom(svoi, "принцип тип ");
  Sp posylki = vse_s_nachalom(svoi, "посылка ");
  char *po = v_yolochkah(princip, 2), *nositel = slovo_posle(princip, "носитель ");
  char *usl = (char *)"", *v_to = (char *)"", *v_inache = (char *)"";
  long shag = nomer_posle(princip, "шаг "), a, b, i, eslej = 0, n_to = 0, n_inache = 0;
  const char *dno; char *t_dno, *t_spusk, *vyzov; Razrez sum; int znakom = 0;
  int vne;
  if (!*princip) return 0;               /* «по объявленному типу»: узла в записи нет */
  /* ВНЕ ПРИЁМА — не поломка: узел остаётся на слове ядра и считается числом. */
  vne = strcmp(nositel, "segment") != 0 || posylki.n != 2 || shag < 1
        || strcmp(cel, "результат не меньше 0") != 0;
  for (i = 0; !vne && i < posylki.n; i++)
    if (strcmp(v_yolochkah(posylki.e[i], 3), "неотрицательность по построению") != 0) vne = 1;
  if (vne) { s->uzlov_mimo++; return 0; }
  a = blok_funkcii(stroki, chya, &b);
  if (a < 1) return 0;                   /* функции в исходнике нет — об этом скажет сверка имён */
  for (i = a; i < b; i++) {
    char *z = kak_chitaet_yazyk(chast(stroki, i));
    if (nachinaetsya(z, "если ")) { eslej++; usl = hvost_posle(z, "если "); }
    else if (nachinaetsya(z, "то ")) { n_to++; v_to = hvost_posle(z, "то "); }
    else if (nachinaetsya(z, "иначе ")) { n_inache++; v_inache = hvost_posle(z, "иначе "); }
  }
  if (eslej != 1 || n_to != 1 || n_inache != 1)
    return ne_proigran(s, imya, (char *)"тело функции — не одно «если» с одной парой ветвей");
  dno = vetv_dna(usl, po);
  if (!*dno) return ne_proigran(s, imya, fmt("форма условия «%s» сверщику незнакома", usl));
  t_dno   = term(strcmp(dno, "то") == 0 ? v_to : v_inache);
  t_spusk = term(strcmp(dno, "то") == 0 ? v_inache : v_to);
  if (!cel_derzhitsya(cel, t_dno, &znakom)) {
    esli_ne(s, !znakom, fmt("утверждение «%s»: дно даёт «%s», и цель «%s» на нём НЕ держится",
                            imya, t_dno, cel));
    return znakom ? 0 : ne_proigran(s, imya, fmt("дно «%s» — не замкнутое число", t_dno));
  }
  vyzov = term(fmt("«%s» от ( %s минус %ld )", chya, po, shag));
  sum = razrez_po(t_spusk, "плюс");
  { int nat = dovod_tipa(stroki, a, b, po, "нат");
    if (sum.est && strcmp(uzhat(sum.pravo), vyzov) == 0 && neotricatelen(uzhat(sum.levo), po, nat)) return 1;
    if (sum.est && strcmp(uzhat(sum.levo), vyzov) == 0 && neotricatelen(uzhat(sum.pravo), po, nat)) return 1; }
  return ne_proigran(s, imya, fmt("спуск «%s» — не сумма неотрицательного по построению с вызовом «%s»",
                                  t_spusk, vyzov));
}


/* ═══ ТОЖДЕСТВО ПОСЛЕ ПЕРЕПИСКИ ДОПУЩЕНИЕМ — ЯЧЕЙКА Ч365 ════════════════════
   ГДЕ ЭТО СТОИТ. Утверждение без теоремы ядро закрывает двумя подмаршрутами.
   Разбор по случаям Ч363 уже проигрывает (`proigrat_uzel`); ВТОРОЙ — «по
   объявленному типу», и в запись из него не доезжает ни байта: ни принципа, ни
   посылок, ни ходов. Замером Ч363 по 86 записям корпуса таких мест 146, и по
   правилу сведения ядра самое крупное из них — «тождество после переписки
   допущением», 42 места. Их и проигрывает этот приём.

   ЧТО ПРОИГРЫВАЕТСЯ. Цель берётся из ИСХОДНИКА (строка `обеспечивает`), тело
   функции — оттуда же, `результат` заменяется телом, и обе стороны равенства
   переписываются по ЗАКРЫТОМУ СПИСКУ ЗАКОНОВ. Каждый закон стоит в ядре
   поимённо (`flang/self/proof-kernel.flang`) и каждый есть РАВЕНСТВО, а не
   оценка:
     Д1/Д2  длина (добавить Э к Л) = длина (приписать Э к Л) = (длина Л) плюс 1
                                                       — «Мера прибавления»;
     Д3     длина (соединить А с Б) = (длина А) плюс (длина Б)  — «Мера склейки»;
     Д4     длина (разложить Т на символы) = длина Т      — «Мера разложения»;
     Д5     длина (отобразить Л как …) = длина Л  — «Мера построения», ветвь map;
     Э1     элемент 1 в (приписать Г к Х) = Г;
     Э2     элемент К в (приписать Г к Х) = элемент (К минус 1) в Х, К ≥ 2 литерал;
     Э3     элемент ((длина Х) плюс 1) в (добавить Э к Х) = Э;
     Э4     элемент К в [Э₁ … Эн] = Эк, К литерал от 1 до н
                                    — все четыре «Развернуть элемент по номеру».
   Сошлись стороны знак в знак — узел снят со слова ядра.

   ТРИ ДВЕРИ СЛИЧЕНИЯ, И ЧЕТВЁРТОЙ НЕТ. Знак в знак; перестановка двух операндов
   ОДНОГО узла `плюс`/`умножить на` (теорема IEEE-754, и ядро называет её тем же
   словом); счёт ЗАМКНУТЫХ сторон тем же `ocenit_term`, каким сверщик считает
   замкнутую цель шага. АССОЦИАТИВНОСТИ СРЕДИ НИХ НЕТ И БЫТЬ НЕ МОЖЕТ: в
   IEEE-754 она ложна. Оттого перестановка берётся ТОЛЬКО там, где терм есть
   ровно один двоичный узел и другого знака верхнего уровня в нём нет
   (`odin_uzel`): старшинства сверщик не читает, а разбор наугад превратил бы
   перестановку соседей в ассоциативность.

   ГДЕ ПРИЁМ КОНЧАЕТСЯ. Цель не равенство, тело не одной строкой, скобка или
   пробел внутри строкового литерала — ВНЕ ПРИЁМА, число в вердикте. Стороны
   переписаны, но не сошлись (свёртка, разбор, вызов чужой функции) — тоже
   число, и тоже не поломка: список законов закрыт нарочно, и «не нашлось
   закона» не значит «запись лжёт». А вот когда обе стороны ЗАМКНУТЫ, посчитаны
   и это РАЗНЫЕ значения — равенство ложно, и это «НЕ СОШЛОСЬ», код 1. */

/* Кавычки в терме чисты: внутри строкового литерала нет ни скобки, ни пробела,
   ни обратной косой. Довод простой: всё дальнейшее (`rasstavit`, `uzhat`,
   `zamenit`, счёт скобок) читает терм СТРОКОЙ и в кавычки не заглядывает.
   Литерал со скобкой сбил бы этот счёт МОЛЧА — а молчаливая ошибка тут дороже
   непроверенного места. */
static int kavychki_chisty(const char *t) {
  int v = 0; long i;
  for (i = 0; t[i]; i++) {
    if (t[i] == '"') { v = !v; continue; }
    if (v && (t[i] == '(' || t[i] == ')' || t[i] == ' ' || t[i] == '\\')) return 0;
  }
  return !v;
}

/* Знаки, которые сверщик умеет видеть на верхнем уровне терма. СПИСОК ЗАКРЫТ
   (правило Ч27), и закрыт не из скупости: терм, у которого таких знаков больше
   одного, читается только со СТАРШИНСТВОМ, а старшинства сверщик не знает. */
static const char *ZNAKI_TERMA[] = {
  " умножить на ", " делить на ", " остаток от деления на ",
  " плюс ", " минус ", " и притом ", " или ",
  " содержит ", " начинается с ", " кончается на ",
  " не равен ", " равен ", " не меньше ", " не больше ", " меньше ", " больше "
};
#define ZNAKOV_TERMA 16

/* Терм есть РОВНО ОДИН двоичный узел с названным знаком: знак стоит на верхнем
   уровне, и ни в левой, ни в правой половине другого знака верхнего уровня нет.
   Квадратная скобка — сразу «нет»: уровни считаются по круглым, и выписанный
   список сбил бы счёт. */
static int odin_uzel(const char *t, const char *znak, char **levo, char **pravo) {
  long gde; int kakoe; char *l, *p;
  if (soderzhit(t, "[") || soderzhit(t, "]")) return 0;
  if (!nayti_sverhu(t, ZNAKI_TERMA, ZNAKOV_TERMA, &gde, &kakoe)) return 0;
  if (strcmp(ZNAKI_TERMA[kakoe], znak) != 0) return 0;
  l = obrezat(kopiya(t, (size_t)gde));
  p = obrezat(t + gde + strlen(znak));
  if (!*l || !*p) return 0;
  if (nayti_sverhu(l, ZNAKI_TERMA, ZNAKOV_TERMA, &gde, &kakoe)) return 0;
  if (nayti_sverhu(p, ZNAKI_TERMA, ZNAKOV_TERMA, &gde, &kakoe)) return 0;
  *levo = l; *pravo = p; return 1;
}

/* Разрез по названному слову верхнего уровня и ВНЕ КАВЫЧЕК, ровно надвое.
   Второе такое слово справа — отказ: у формы с двумя «к» одного чтения нет. */
static int razrez_slovom(const char *t, const char *chem, char **levo, char **pravo) {
  const char *sp[1]; long gde; int kakoe;
  sp[0] = chem;
  if (!nayti_sverhu(t, sp, 1, &gde, &kakoe)) return 0;
  *levo = obrezat(kopiya(t, (size_t)gde));
  *pravo = obrezat(t + gde + strlen(chem));
  if (!**levo || !**pravo) return 0;
  if (nayti_sverhu(*pravo, sp, 1, &gde, &kakoe)) return 0;
  return 1;
}

/* Члены ВЫПИСАННОГО списка: запятые верхнего уровня, счёт ведётся и по круглым
   скобкам, и по квадратным, и по кавычкам. Не выписанный список — пусто. */
static Sp chleny_spiska(const char *t) {
  Sp r = PUSTO; long i, nach = 1, kr = 0, kv = 0; int v = 0; long d = (long)strlen(t);
  if (d < 3 || t[0] != '[' || t[d - 1] != ']') return r;
  for (i = 1; i < d - 1; i++) {
    char c = t[i];
    if (v) { if (c == '"') v = 0; continue; }
    if (c == '"') v = 1;
    else if (c == '(') kr++;
    else if (c == ')') kr--;
    else if (c == '[') kv++;
    else if (c == ']') kv--;
    else if (c == ',' && kr == 0 && kv == 0) {
      dobavit(&r, obrezat(kopiya(t + nach, (size_t)(i - nach)))); nach = i + 1;
    }
  }
  dobavit(&r, obrezat(kopiya(t + nach, (size_t)(d - 1 - nach))));
  return r;
}

/* Переписка по закрытому списку законов. Терм незнакомой формы остаётся собой —
   и место остаётся на слове ядра; «почти подходит» тут не бывает. */
static char *svesti_term(const char *syroy, Sp stroki, int gl) {
  char *t = uzhat(obrezat(syroy)), *l, *p, *nom, *spis, *n, *sp2, *hv2;
  double v;
  if (gl <= 0) return t;
  if (nachinaetsya(t, "длина ")) {
    char *a = svesti_term(t + strlen("длина "), stroki, gl - 1);
    if (razrez_slovom(a, " к ", &l, &p) &&
        (nachinaetsya(l, "добавить ") || nachinaetsya(l, "приписать ")))
      return fmt("%s плюс 1",
                 v_skobki(svesti_term(fmt("длина %s", v_skobki(p)), stroki, gl - 1)));
    if (razrez_slovom(a, " с ", &l, &p) && nachinaetsya(l, "соединить "))
      return fmt("%s плюс %s",
                 v_skobki(svesti_term(fmt("длина %s", v_skobki(slova_posle(l, 1))), stroki, gl - 1)),
                 v_skobki(svesti_term(fmt("длина %s", v_skobki(p)), stroki, gl - 1)));
    if (razrez_slovom(a, " на ", &l, &p) && nachinaetsya(l, "разложить ") &&
        strcmp(p, "символы") == 0)
      return svesti_term(fmt("длина %s", v_skobki(slova_posle(l, 1))), stroki, gl - 1);
    if (razrez_slovom(a, " как ", &l, &p) && nachinaetsya(l, "отобразить "))
      return svesti_term(fmt("длина %s", v_skobki(slova_posle(l, 1))), stroki, gl - 1);
    return fmt("длина %s", v_skobki(a));
  }
  if (nachinaetsya(t, "элемент ") &&
      razrez_slovom(obrezat(t + strlen("элемент ")), " в ", &nom, &spis)) {
    Sp chleny;
    n = svesti_term(nom, stroki, gl - 1);
    sp2 = svesti_term(spis, stroki, gl - 1);
    if (razrez_slovom(sp2, " к ", &l, &p)) {
      hv2 = svesti_term(p, stroki, gl - 1);
      if (nachinaetsya(l, "приписать ") && chislo_tochno(n, &v) && v == (double)(long)v) {
        if ((long)v == 1) return svesti_term(slova_posle(l, 1), stroki, gl - 1);
        if ((long)v >= 2)
          return svesti_term(fmt("элемент %ld в %s", (long)v - 1, v_skobki(hv2)), stroki, gl - 1);
      }
      if (nachinaetsya(l, "добавить ") &&
          (strcmp(n, fmt("( длина %s ) плюс 1", v_skobki(hv2))) == 0 ||
           strcmp(n, fmt("1 плюс ( длина %s )", v_skobki(hv2))) == 0))
        return svesti_term(slova_posle(l, 1), stroki, gl - 1);
    }
    chleny = chleny_spiska(sp2);
    if (chleny.n && chislo_tochno(n, &v) && v == (double)(long)v &&
        (long)v >= 1 && (long)v <= chleny.n)
      return svesti_term(chast(chleny, (long)v), stroki, gl - 1);
    return fmt("элемент %s в %s", v_skobki(n), v_skobki(sp2));
  }
  return t;
}

/* Сошлись ли стороны. Три двери названы в шапке приёма; четвёртой нет. */
static int tozhdestvenny(const char *sa, const char *sb, Sp stroki, int gl) {
  static const char *SOSEDI[2] = { " плюс ", " умножить на " };
  char *a = svesti_term(sa, stroki, gl), *b = svesti_term(sb, stroki, gl);
  char *a1, *a2, *b1, *b2; int k;
  if (strcmp(a, b) == 0) return 1;
  if (gl > 0)
    for (k = 0; k < 2; k++)
      if (odin_uzel(a, SOSEDI[k], &a1, &a2) && odin_uzel(b, SOSEDI[k], &b1, &b2)) {
        if (tozhdestvenny(a1, b1, stroki, gl - 1) && tozhdestvenny(a2, b2, stroki, gl - 1)) return 1;
        if (tozhdestvenny(a1, b2, stroki, gl - 1) && tozhdestvenny(a2, b1, stroki, gl - 1)) return 1;
      }
  { Znach za = ocenit_term(a, stroki, NE_BERUS, 0), zb = ocenit_term(b, stroki, NE_BERUS, 0);
    if (za.vid && za.vid == zb.vid)
      return (za.vid == 1 || za.vid == 4) ? strcmp(za.s, zb.s) == 0 : za.ch == zb.ch; }
  return 0;
}

/* Обе стороны ЗАМКНУТЫ, посчитаны — и это РАЗНЫЕ значения. Тогда равенство
   ложно, а запись числит его доказанным: это противоречие, а не «не берусь».
   «Не число» сюда не пускается: с ним неравенство значений ещё не ложь. */
static int storony_razoshlis(const char *sa, const char *sb, Sp stroki) {
  Znach za = ocenit_term(svesti_term(sa, stroki, 8), stroki, NE_BERUS, 0);
  Znach zb = ocenit_term(svesti_term(sb, stroki, 8), stroki, NE_BERUS, 0);
  if (!za.vid || za.vid != zb.vid) return 0;
  if (za.vid == 1 || za.vid == 4) return strcmp(za.s, zb.s) != 0;
  if (za.ch != za.ch || zb.ch != zb.ch) return 0;
  return za.ch != zb.ch;
}

/* Есть ли у функции хоть одно «требует». Довод — там, где это читается: под
   допущением входа может не быть вовсе, и утверждение о нём истинно ПУСТО. */
static int est_trebovaniya(Sp stroki, long a, long b) {
  long i;
  for (i = a; i < b; i++)
    if (nachinaetsya(kak_chitaet_yazyk(chast(stroki, i)), "требует ")) return 1;
  return 0;
}

/* Тело функции ОДНОЙ строкой. Строки объявлений и примеров названы поимённо, всё
   прочее считается телом; тела не ровно одной строкой — сверщик не берётся.
   Список закрыт нарочно: незнакомая строка делает тело многострочным, а
   многострочное тело — отказ, а не догадка. */
static char *telo_odnoy_strokoy(Sp stroki, long a, long b) {
  static const char *OBYAVLENIYA[10] = {
    "принимает ", "возвращает ", "обеспечивает ", "требует ", "для всех ",
    "пример «", "дано ", "ожидается ", "теорема «", "использует "
  };
  long i; int k, nashli = 0; char *telo = (char *)"";
  for (i = a + 1; i < b; i++) {
    char *l = kak_chitaet_yazyk(chast(stroki, i)); int obyavlenie = 0;
    if (!*l) continue;
    for (k = 0; k < 10; k++) if (nachinaetsya(l, OBYAVLENIYA[k])) obyavlenie = 1;
    if (obyavlenie) continue;
    nashli++; telo = l;
  }
  return nashli == 1 ? telo : (char *)"";
}

/* Проиграть заново узел «тождество после переписки допущением».
   1 — проигран, и место снимается со слова ядра. */
static int perepiskoy(Sverka *s, Sp svoi, Sp stroki, const char *imya,
                      const char *chya, const char *cel_syraya) {
  static const char *RAVNO[2] = { " не равен ", " равен " };
  char *cel, *telo, *levo, *pravo, *sl, *sp3;
  long a, b, gde; int kakoe;
  /* Узел Ч363 — принцип с посылками — не этот приём. И посылок у ЭТОГО узла
     быть не может: он их не проигрывает, а стало быть и снять их со слова
     ядра не вправе; счёт снятого держится на этой строке. */
  if (*pervaya_s_nachalom(svoi, "принцип тип ") || vse_s_nachalom(svoi, "посылка ").n) return 0;
  if (!*cel_syraya || !kavychki_chisty(cel_syraya)) return 0;
  cel = term(cel_syraya);
  if (!nayti_sverhu(cel, RAVNO, 2, &gde, &kakoe) || kakoe != 1) { s->tozhdestv_mimo++; return 0; }
  levo  = obrezat(kopiya(cel, (size_t)gde));
  pravo = obrezat(cel + gde + strlen(RAVNO[1]));
  if (!*levo || !*pravo) { s->tozhdestv_mimo++; return 0; }
  if (nayti_sverhu(pravo, RAVNO, 2, &gde, &kakoe)) { s->tozhdestv_mimo++; return 0; }
  a = blok_funkcii(stroki, chya, &b);
  if (a < 1) return 0;                 /* функции в исходнике нет — скажет сверка имён */
  telo = telo_odnoy_strokoy(stroki, a, b);
  if (!*telo || !kavychki_chisty(telo)) { s->tozhdestv_mimo++; return 0; }
  telo = term(telo);
  sl  = vstavit_vmesto(levo,  "результат", telo);
  sp3 = vstavit_vmesto(pravo, "результат", telo);
  /* ЛОЖЬЮ «разные значения» становятся ТОЛЬКО у функции без «требует», и это не
     осторожность, а замер. Честная половина `flang/test/fixtures/
     poddelka-protivorechie.flang` требует разом `первое меньше второе` и
     `второе не больше первое`: такого входа нет, функция недостижима, и
     `1 равен 2` о ней ядро доказывает ПО ПРАВУ — истинно пусто. Без этой строки
     приём кричал «НЕ СОШЛОСЬ» на ЧЕСТНОЙ записи корпуса; поймано прогоном, а не
     рассуждением. Снятие места остаётся и под допущением: безусловное
     тождество влечёт условное, обратное неверно. */
  if (!est_trebovaniya(stroki, a, b) && storony_razoshlis(sl, sp3, stroki)) {
    dobavit(&s->bedy,
            fmt("утверждение «%s»: обе стороны равенства замкнуты и посчитаны, "
                "и это РАЗНЫЕ значения — «%s» против «%s»", imya, sl, sp3));
    return 0;
  }
  if (tozhdestvenny(sl, sp3, stroki, 6)) return 1;
  s->tozhdestv_ne_soshlos++;
  return 0;
}

/* Посылок у принципа по объявленной сумме обязано быть ровно столько, сколько у
   типа вариантов, и варианты обязаны совпасть с объявленными в исходнике. */
static void sverit_pokrytie(Sverka *s, Sp svoi, Sp stroki, const char *imya_t,
                            const char *verdikt, const char *mesto, int proigran) {
  char *princip = pervaya_s_nachalom(svoi, "принцип тип ");
  Sp posylki = vse_s_nachalom(svoi, "посылка "), varianty, nepokr = PUSTO;
  int i, j, dokazano = strcmp(verdikt, "доказано") == 0, slabyh = 0;
  char *tip, *nositel = slovo_posle(princip, "носитель ");
  char *indukciya = pervaya_s_nachalom(svoi, "индукция по «");
  for (i = 0; i < posylki.n; i++)
    if (strcmp(slovo_posle(posylki.e[i], "вердикт "), "доказано") != 0) slabyh++;
  /* Ч363: узел вердикта проигран заново — посылки его больше не на слово. */
  if (!proigran) s->na_slovo += posylki_na_slovo(svoi);
  esli_ne(s, !dokazano || slabyh == 0,
          fmt("теорема «%s»: вердикт «доказано», а посылок не доказано %d", imya_t, slabyh));
  if (!*princip) return;      /* прямое доказательство: принципа нет вовсе */
  /* НОСИТЕЛЬ ИЗ ЗАКРЫТОГО СПИСКА. Прежде порча этого слова молча ОТКЛЮЧАЛА
     проверку покрытия: «не algebra — и ладно». Мутационная проба это поймала. */
  esli_ne(s, strcmp(nositel, "algebra") == 0 || strcmp(nositel, "segment") == 0 ||
             strcmp(nositel, "fold") == 0,
          fmt("теорема «%s»: носитель принципа «%s» — сверщику известны только «algebra», «segment» и «fold»",
              imya_t, nositel));
  /* Переменная, по которой ведут индукцию, названа в записи дважды — в принципе
     и в строке «индукция по». Разойдутся — запись сама себе противоречит. А там,
     где теоремы нет и второй строки тоже, имя сверяется с ИСХОДНИКОМ: в строке
     постусловия стоит «для всех <имя> обеспечивает …». Замер: 41 принцип корпуса,
     у 25 такая строка есть, расхождений ноль. Без этого мутационная проба ловила
     порчу имени как принятую — единственный оставшийся случай из 2999. */
  esli_ne(s, !*indukciya || strcmp(v_yolochkah(princip, 2), v_yolochkah(indukciya, 1)) == 0,
          fmt("теорема «%s»: принцип ведёт индукцию по «%s», а запись говорит «индукция по «%s»»",
              imya_t, v_yolochkah(princip, 2), v_yolochkah(indukciya, 1)));
  { char *v_ish = slovo_posle(mesto, "для всех "), *po = v_yolochkah(princip, 2);
    if (*v_ish)
      esli_ne(s, strcmp(golo(v_ish), po) == 0,
              fmt("теорема «%s»: принцип ведёт индукцию по «%s», а постусловие исходника — по «%s»",
                  imya_t, po, golo(v_ish)));
    else                     /* «для всех» не написано — имя обязано быть доводом функции */
      esli_ne(s, dovod_funkcii(stroki, mesto, po),
              fmt("теорема «%s»: принцип ведёт индукцию по «%s», а такого довода у функции нет",
                  imya_t, po)); }
  /* Имя посылки не украшение: у объявленной суммы оно и есть имя варианта, а у
     отрезка и свёртки — одно из двух названных. Замер на 100 посылках корпуса. */
  for (i = 0; i < posylki.n; i++) {
    char *im = v_yolochkah(posylki.e[i], 1), *vr = v_yolochkah(posylki.e[i], 2);
    int ladno = strcmp(nositel, "algebra") == 0 ? strcmp(im, vr) == 0
              : (strcmp(nositel, "segment") == 0
                   ? (strcmp(im, "дно") == 0 || strcmp(im, "спуск") == 0)
                   : (strcmp(im, "начало свёртки") == 0 || strcmp(im, "шаг свёртки") == 0));
    esli_ne(s, ladno,
            fmt("теорема «%s»: посылка «%s» при носителе «%s» названа не своим именем", imya_t, im, nositel));
  }
  if (strcmp(nositel, "algebra") != 0) return;
  tip = v_yolochkah(princip, 1);
  varianty = varianty_tipa(stroki, tip);
  for (i = 0; i < varianty.n; i++) {
    for (j = 0; j < posylki.n; j++) if (strcmp(v_yolochkah(posylki.e[j], 2), varianty.e[i]) == 0) break;
    if (j == posylki.n) dobavit(&nepokr, varianty.e[i]);
  }
  esli_ne(s, varianty.n == posylki.n,
          fmt("теорема «%s»: у типа «%s» вариантов %d, а посылок %d — принцип не покрывает объявленную сумму",
              imya_t, tip, varianty.n, posylki.n));
  esli_ne(s, nepokr.n == 0,
          fmt("теорема «%s»: посылки не покрывают варианты %s", imya_t, soedinit(nepokr, ", ")));
}

/* ── круг: прямой и через других: «А» через «Б», «Б» через «А» ────────────── */

static void sverit_krugi(Sverka *s, Sp bloki) {
  Sp iz = PUSTO, v = PUSTO, krugi = PUSTO; int i, j, k, rosla = 1;
  for (i = 0; i < bloki.n; i++) {
    Sp svoi = razdelit(bloki.e[i], "\n"), shagi;
    char *imya = v_yolochkah(chast(svoi, 1), 1);
    shagi = vse_s_nachalom(svoi, "шаг ");
    /* Слова и ёлочки считаются БЕЗ терма (`shag_obosnovanie`/`shag_slovami`):
       термин несёт внутри и пробелы, и ёлочки, и без выреза круг перестал бы
       находиться ровно в записи, что несёт термин рядом с номером. */
    for (j = 0; j < shagi.n; j++)
      if (nachinaetsya(shag_obosnovanie(shagi.e[j]), "по свойству "))
        { dobavit(&iz, imya); dobavit(&v, v_yolochkah(shag_slovami(shagi.e[j]), 1)); }
  }
  while (rosla) {                       /* замыкание по достижимости */
    rosla = 0;
    for (i = 0; i < iz.n; i++) for (j = 0; j < iz.n; j++) {
      if (strcmp(v.e[i], iz.e[j]) != 0) continue;
      for (k = 0; k < iz.n; k++) if (!strcmp(iz.e[k], iz.e[i]) && !strcmp(v.e[k], v.e[j])) break;
      if (k == iz.n) { dobavit(&iz, iz.e[i]); dobavit(&v, v.e[j]); rosla = 1; }
    }
  }
  for (i = 0; i < iz.n; i++) if (strcmp(iz.e[i], v.e[i]) == 0) dobavit(&krugi, iz.e[i]);
  esli_ne(s, krugi.n == 0,
          fmt("утверждения обосновывают сами себя по кругу: %s", soedinit(krugi, ", ")));
}

/* ── поля записи: то, что сверщик на flang не стерёг вовсе ────────────────────
   Ч19 подсунула 30 подделок в одну правку каждая; семь прошли, и все семь били
   не в правила, а в ПОЛЯ. Ниже закрыты именно эти поля, и закрыты сличением с
   исходником либо с другим полем записи, а не объявлением на веру. */

static void sverit_imena(Sverka *s, Sp svoi, Sp stroki, const char *imya_t) {
  int i;
  for (i = 0; i < svoi.n; i++) {
    char *z = obrezat(svoi.e[i]), *imya, *v_ish, *bylo;
    long gde;
    const char *chto;
    if (nachinaetsya(z, "дано «")) chto = "дано ";
    else if (nachinaetsya(z, "индукция по «")) chto = "индукция по ";
    else continue;
    imya = v_yolochkah(z, 1);
    gde = nomer_posle(z, "строка ");
    if (gde < 1) { s->bez_privyazki++; continue; }
    v_ish = stroka_po_nomeru(stroki, gde);
    bylo = hvost_posle(v_ish, chto);
    /* «дано х: Тип» — имя до двоеточия; «индукция по х убывает х» — первое слово */
    bylo = *chto == 'd' || nachinaetsya(chto, "дано")
             ? golo(chast(razdelit(bylo, ":"), 1))
             : (nachinaetsya(bylo, "«") ? v_yolochkah(bylo, 1) : slovo(bylo, 1));
    esli_ne(s, nachinaetsya(v_ish, chto) && strcmp(bylo, imya) == 0,
            fmt("теорема «%s», строка %ld: запись зовёт «%s%s», а в исходнике стоит «%s»",
                imya_t, gde, chto, imya, v_ish));
  }
}

/* Объявленное число шагов случая обязано сойтись с числом написанных шагов.
   Прежде оно не сверялось ни с чем: «шагов 1» менялось на «шагов 2» и проходило. */
static void sverit_chislo_shagov(Sverka *s, Sp svoi, const char *imya_t) {
  int i; long obyavleno = -1, fakt = 0, gde = 0;
  for (i = 0; i <= svoi.n; i++) {
    char *z = i < svoi.n ? obrezat(svoi.e[i]) : (char *)"";
    if (i == svoi.n || nachinaetsya(z, "случай строка")) {
      if (obyavleno >= 0)
        esli_ne(s, obyavleno == fakt,
                fmt("теорема «%s», случай на строке %ld: объявлено шагов %ld, а написано %ld",
                    imya_t, gde, obyavleno, fakt));
      if (i == svoi.n) break;
      obyavleno = nomer_posle(z, "шагов "); gde = nomer_posle(z, "строка "); fakt = 0;
    } else if (nachinaetsya(z, "шаг ") && obyavleno >= 0) fakt++;
  }
}

/* Сколько шагов написано в случае, разбирающем названный вариант; нет такого — −1. */
static long shagov_sluchaya(Sp svoi, Sp stroki, const char *variant) {
  int i; long obyavleno = -1; char *tekushchiy = (char *)"";
  for (i = 0; i < svoi.n; i++) {
    char *z = obrezat(svoi.e[i]);
    if (!nachinaetsya(z, "случай строка")) continue;
    tekushchiy = stroka_po_nomeru(stroki, nomer_posle(z, "строка "));
    if (strcmp(imya_varianta(slova_posle(tekushchiy, 1)), variant) == 0)
      obyavleno = nomer_posle(z, "шагов ");
  }
  return obyavleno;
}

/* Поля посылки: «закрыта» из закрытого списка двух слов, а объявленное число
   шагов посылки сходится с числом шагов случая того же варианта. */
static void sverit_polya_posylok(Sverka *s, Sp svoi, Sp stroki, const char *imya_t) {
  Sp posylki = vse_s_nachalom(svoi, "посылка "); int i;
  for (i = 0; i < posylki.n; i++) {
    char *q = posylki.e[i];
    char *zakryta = slovo_posle(q, "закрыта "), *vid = slovo_posle(q, "вид ");
    esli_ne(s, strcmp(vid, "base") == 0 || strcmp(vid, "step") == 0,
            fmt("теорема «%s»: посылка «вид %s» — сверщику известны только «base» и «step»", imya_t, vid));
    char *variant = v_yolochkah(q, 2);
    long shagov = nomer_posle(q, "шагов "), v_sluchae = shagov_sluchaya(svoi, stroki, variant);
    if (strcmp(zakryta, "reduction") == 0)
      esli_ne(s, shagov == 0,
              fmt("теорема «%s», посылка «%s»: закрыта сведением, а шагов объявлено %ld — шагов автора там нет",
                  imya_t, variant, shagov));
    else if (strcmp(zakryta, "term") == 0)
      esli_ne(s, shagov >= 1 && (v_sluchae < 0 || shagov <= v_sluchae),
              fmt("теорема «%s», посылка «%s»: объявлено шагов %ld, а в случае того же варианта написано %ld",
                  imya_t, variant, shagov, v_sluchae));
    else
      esli_ne(s, 0, fmt("теорема «%s», посылка «%s»: «закрыта %s» — сверщику известны только «term» и «reduction»",
                        imya_t, variant, zakryta));
  }
}

/* Имя сведения не висит в воздухе: оно обязано быть тем самым правилом, которым
   закрыта хоть одна посылка этого утверждения, и стоять в закрытом списке. */
static void sverit_svedenie(Sverka *s, Sp svoi, const char *imya_t) {
  char *stroka = pervaya_s_nachalom(svoi, "сведение «");
  Sp posylki; char *imya; int i, nashlos = 0;
  if (!*stroka) return;
  imya = v_yolochkah(stroka, 1);
  posylki = vse_s_nachalom(svoi, "посылка ");
  for (i = 0; i < posylki.n; i++)
    if (strcmp(v_yolochkah(posylki.e[i], 3), imya) == 0) nashlos = 1;
  esli_ne(s, nashlos,
          fmt("теорема «%s»: сведение названо «%s», а ни одна посылка этим правилом не закрыта",
              imya_t, imya));
}

/* Поле «исходник» больше не лежит непрочитанным. Пути сличаются по составным
   частям: два полных пути обязаны совпасть целиком, а относительный обязан быть
   хвостом полного — иначе запись о другой программе прошла бы своим же словом. */
static Sp chasti_puti(const char *p) {
  Sp v = razdelit(p, "/"), r = PUSTO; int i;
  for (i = 0; i < v.n; i++) if (*v.e[i] && strcmp(v.e[i], ".") != 0) dobavit(&r, v.e[i]);
  return r;
}
/* Относительный путь, поданный оболочкой, доводится до полного рабочим
   каталогом — лексически, без разбора ссылок: иначе «хвост совпал» пропускало бы
   приписанное спереди, чем Ч19 и ловила. */
static char *polnyy_put(const char *p) {
  char kat[4096];
  if (p[0] == '/' || !getcwd(kat, sizeof kat)) return (char *)p;
  return fmt("%s/%s", kat, p);
}
static int put_sovpal(const char *a, const char *b) {
  Sp A, B;
  b = polnyy_put(b);
  A = chasti_puti(a); B = chasti_puti(b);
  { int i, polnyy_a = a[0] == '/', polnyy_b = b[0] == '/';
  Sp kor = polnyy_a ? B : A, dlin = polnyy_a ? A : B;
  if (polnyy_a == polnyy_b) {
    if (A.n != B.n) return 0;
    for (i = 0; i < A.n; i++) if (strcmp(A.e[i], B.e[i]) != 0) return 0;
    return 1;
  }
  if (kor.n > dlin.n) return 0;
  for (i = 0; i < kor.n; i++)
    if (strcmp(kor.e[i], dlin.e[dlin.n - kor.n + i]) != 0) return 0;
  return 1; }
}

/* НИ ОДНОЙ НЕПРОЧИТАННОЙ СТРОКИ. Мутационная проба (3000 порченых записей,
   зерно 7) показала: порча полей `вид`, `конец утверждения` и полей посылки у
   утверждения без теоремы проходила молча — просто потому, что этих строк никто
   не читал. Дисциплина остова Ч2 («ни лишнего байта») переносится сюда: строка
   записи, вид которой чекеру не известен, — отказ, а не «ладно». Значения полей
   `вид`, `вердикт` и `ядро` названы поимённо по замеру на 91 настоящей записи;
   новое значение чекер отвергнет вслух, а не пропустит. */
/* СКЕЛЕТ СТРОКИ: имя в ёлочках и терм в уголках — один знак, что бы внутри ни
   стояло. Иначе пословный разбор ломался бы на именах с пробелами. */
static char *skelet(const char *s) {
  char *r = dai(strlen(s) + 1), *v = r; const char *p = s;
  while (*p) {
    const char *k = NULL; const char *otkr = NULL, *zakr = NULL;
    if (nachinaetsya(p, "«")) { otkr = "«"; zakr = "»"; }
    else if (nachinaetsya(p, "⟨")) { otkr = "⟨"; zakr = "⟩"; }
    if (otkr && (k = strstr(p + strlen(otkr), zakr)) != NULL) {
      memcpy(v, otkr, strlen(otkr)); v += strlen(otkr);
      memcpy(v, zakr, strlen(zakr)); v += strlen(zakr);
      p = k + strlen(zakr); continue;
    }
    *v++ = *p++;
  }
  *v = 0; return r;
}
/* Пословное сличение с образцом: `#` — число, `.` — любое слово, `…` — любой
   хвост. Служебное слово обязано стоять на своём месте, иначе это не та строка. */
static int po_obrazcu(const char *s, const char *obrazec) {
  Sp a = razdelit(s, " "), b = razdelit(obrazec, " "); int i;
  for (i = 0; i < b.n; i++) {
    if (strcmp(b.e[i], "…") == 0) return 1;
    if (i >= a.n) return 0;
    if (strcmp(b.e[i], "#") == 0) { if (chislo_iz_slova(a.e[i]) < 0) return 0; continue; }
    if (strcmp(b.e[i], ".") == 0) { if (!*a.e[i]) return 0; continue; }
    if (strcmp(b.e[i], a.e[i]) != 0) return 0;
  }
  return a.n == b.n;
}
/* Закрытый список видов строк записи. Значения `вид`, `вердикт` и `ядро` названы
   поимённо по замеру на 91 настоящей записи: новое значение чекер отвергнет
   вслух, а не пропустит молча. */
static const char *OBRAZCY[] = {
  "", "запись доказательства 1", "исходник …", "строк #", "знаков #",
  "отпечаток # #", "отпечаток256 .", "ядро 2", "утверждений #",
  "утверждение «» функции «» строка #", "вид postcondition",
  "вердикт доказано", "вердикт нет вердикта", "теорема «» строка #", "теоремы нет",
  "дано «» строка #", "цель строка #", "цель ⟨⟩", "индукция по «» строка #",
  "случай строка # шагов #", "шаг # строка # закрывающий …",
  "шаг # строка # промежуточный …", "шаг # ⟨⟩ закрывающий …",
  "шаг # ⟨⟩ промежуточный …",
  /* Ч375: термин РЯДОМ с номером — второй свидетель о том же месте, а не
     замена первого (задача 9612). */
  "цель строка # ⟨⟩", "шаг # строка # ⟨⟩ закрывающий …",
  "шаг # строка # ⟨⟩ промежуточный …",
  "следовательно доказано да", "следовательно доказано нет",
  "принцип тип «» по «» носитель . база # шаг #", "сведение «»",
  "посылка «» вид . вариант «» вердикт доказано закрыта . шагов # правило «»",
  "посылка «» вид . вариант «» вердикт нет вердикта закрыта . шагов # правило «»",
  "конец утверждения", "конец записи", "ход …",
  /* Ч87: оглавление списочных литералов. Вид закрыт так же, как прочие. */
  "таблиц #", "таблица «» открыта # закрыта # звеньев #"
};
static int znakomaya_stroka(const char *s) {
  char *sk = skelet(s); int i;
  for (i = 0; i < (int)(sizeof OBRAZCY / sizeof *OBRAZCY); i++)
    if (po_obrazcu(sk, OBRAZCY[i])) return 1;
  return 0;
}
static void sverit_stroki_zapisi(Sverka *s, const char *zapis) {
  Sp v = razdelit(zapis, "\n"); int i, konec = 0;
  for (i = 0; i < v.n; i++) {
    char *l = obrezat(v.e[i]);
    esli_ne(s, znakomaya_stroka(l),
            fmt("строка записи %d не узнана: «%s» — чекер не принимает того, чего не читает", i + 1, l));
    if (strcmp(l, "конец записи") == 0) konec = 1;
  }
  esli_ne(s, konec, (char *)"запись не кончается словами «конец записи» — она обрублена");
}

/* Утверждение обязано быть целым: у него есть вид, вердикт, слово о теореме и
   свой конец. Обрубленная запись без этого выглядела бы просто короче. */
static void sverit_celost_bloka(Sverka *s, Sp svoi, const char *imya) {
  int i, vid = 0, verd = 0, teor = 0, konec = 0;
  for (i = 0; i < svoi.n; i++) {
    char *l = obrezat(svoi.e[i]);
    if (nachinaetsya(l, "вид ")) vid++;
    else if (nachinaetsya(l, "вердикт ")) verd++;
    else if (nachinaetsya(l, "теорема «") || strcmp(l, "теоремы нет") == 0) teor++;
    else if (strcmp(l, "конец утверждения") == 0) konec++;
  }
  esli_ne(s, vid == 1 && verd == 1 && teor == 1 && konec == 1,
          fmt("утверждение «%s» записано не целиком: вид %d, вердикт %d, слово о теореме %d, конец %d — обязано быть по одному",
              imya, vid, verd, teor, konec));
}

/* ЗАПИСЬ НЕ ВПРАВЕ МОЛЧАТЬ О НАПИСАННОМ: теорема, которой в записи нет вовсе, —
   это не «не доказано», а НЕ СКАЗАНО. Строка объявления, а не упоминание в
   пояснении: пояснение начинается двумя косыми. */
static void sverit_polnotu(Sverka *s, Sp stroki, Sp bloki) {
  Sp zamolchano = PUSTO; int i, j; long postusloviy = 0;
  for (i = 0; i < stroki.n; i++) {
    char *l = stroki.e[i], *t = kak_chitaet_yazyk(l);
    if (nachinaetsya(l, "теорема") && nachinaetsya(t, "теорема «")) {
      char *imya = v_yolochkah(t, 1);
      for (j = 0; j < bloki.n; j++)
        if (strcmp(v_yolochkah(chast(razdelit(bloki.e[j], "\n"), 1), 1), imya) == 0) break;
      if (j == bloki.n) dobavit(&zamolchano, imya);
    }
    if (soderzhit(t, "обеспечивает «")) postusloviy++;
  }
  esli_ne(s, zamolchano.n == 0,
          fmt("в исходнике есть теоремы, о которых запись молчит: %s", soedinit(zamolchano, ", ")));
  esli_ne(s, postusloviy == bloki.n,
          fmt("в исходнике постусловий %ld, а в записи утверждений %d — запись говорит не обо всей программе",
              postusloviy, bloki.n));
}

static void vlit_progon(Sverka *s, Progon *p, const char *imya_t) {
  esli_ne(s, p->bedy.n == 0, fmt("теорема «%s», сведение: %s", imya_t, soedinit(p->bedy, "; ")));
  s->svedeniy += p->proigrano; s->hodov += p->hodov; s->bez_privyazki += p->bez_privyazki;
}

static void sverit_teoremu(Sverka *s, Sp svoi, Sp stroki, const char *verdikt,
                           const char *mesto, const char *imya, const char *chya) {
  char *stroka_t = pervaya_s_nachalom(svoi, "теорема «");
  long nachalo = nomer_posle(stroka_t, "строка ");
  char *imya_t = v_yolochkah(stroka_t, 1);
  Sp ozhidaemaya, nastoyashchaya; int bez_nomerov = 0;
  char *a, *b;
  Obst o; Progon p;
  esli_ne(s, strcmp(stroka_po_nomeru(stroki, nachalo), fmt("теорема «%s»", imya_t)) == 0,
          fmt("строка %ld исходника — не «теорема «%s»»", nachalo, imya_t));
  ozhidaemaya = razmetka_zapisi(svoi, nachalo, &bez_nomerov);
  nastoyashchaya = razmetka_teoremy(stroki, nachalo);
  if (bez_nomerov) { s->bez_privyazki++;
    a = bez_nomerov_v(ozhidaemaya); b = bez_nomerov_v(nastoyashchaya); }
  else { a = soedinit(ozhidaemaya, ", "); b = soedinit(nastoyashchaya, ", "); }
  esli_ne(s, strcmp(a, b) == 0,
          fmt("теорема «%s»: запись говорит о строках [%s], а в исходнике стоят [%s]", imya_t, a, b));
  sverit_cel(s, svoi, stroki, mesto, imya, imya_t);
  sverit_imena(s, svoi, stroki, imya_t);
  sverit_chislo_shagov(s, svoi, imya_t);
  sverit_polya_posylok(s, svoi, stroki, imya_t);
  sverit_svedenie(s, svoi, imya_t);
  { char *sk = pervaya_s_nachalom(svoi, "цель ");
    long gc = nomer_posle(sk, "строка ");
    sverit_shagi(s, svoi, stroki, imya_t, chya,
                 gc < 1 ? v_ugolkah(sk, 1) : hvost_posle(stroka_po_nomeru(stroki, gc), "утверждаем ")); }
  sverit_zakrytie(s, svoi, imya_t, verdikt);
  sverit_pravila(s, svoi, fmt("теорема «%s»", imya_t));
  { char *princip = pervaya_s_nachalom(svoi, "принцип тип ");
    char *stroka_celi = pervaya_s_nachalom(svoi, "цель ");
    long gde = nomer_posle(stroka_celi, "строка ");
    o.stroki = stroki; o.svoi = svoi; o.funkciya = (char *)chya;
    o.cel = term(gde < 1 ? v_ugolkah(stroka_celi, 1)
                         : hvost_posle(stroka_po_nomeru(stroki, gde), "утверждаем "));
    o.po = v_yolochkah(princip, 2); o.tip = v_yolochkah(princip, 1);
    o.hvost = hvost_dovodov(stroki, chya); }
  p = proigrat_blok(&o);
  vlit_progon(s, &p, imya_t);
  sverit_pokrytie(s, svoi, stroki, imya_t, verdikt, mesto, 0);
}

/* Утверждение, доказанное БЕЗ теоремы, сверять нечем: доказательства в исходнике
   нет ни строкой, вердикт целиком на совести ядра. Чекер обязан сказать это
   числом. Два он всё же проверяет: что теоремы правда нет и что правила из списка. */
static void bez_teoremy(Sverka *s, Sp svoi, Sp stroki, const char *imya,
                        const char *verdikt, const char *mesto, const char *chya) {
  int i, spryatana = 0, proigran, perepisan, dokazano;
  char *cel;
  for (i = 0; i < stroki.n; i++)
    if (strcmp(obrezat(stroki.e[i]), fmt("теорема «%s»", imya)) == 0) spryatana = 1;
  esli_ne(s, !spryatana,
          fmt("в записи сказано «теоремы нет», а в исходнике теорема «%s» написана", imya));
  dokazano = strcmp(verdikt, "доказано") == 0;
  /* Цель у обоих подмаршрутов ОДНА и берётся из ИСХОДНИКА, хвостом постусловия:
     запись о ней не говорит ни строкой, и спрашивать её тут не у кого. */
  cel = hvost_posle(kak_chitaet_yazyk(mesto), fmt("обеспечивает «%s» ", imya));
  /* Ч363: подмаршрут «разбором по случаям» — узел вердикта, который можно
     проиграть заново. */
  proigran = dokazano && proigrat_uzel(s, svoi, stroki, imya, chya, cel);
  /* Ч365: ВТОРОЙ подмаршрут — «тождество после переписки допущением». Зовётся
     только там, где первый не взялся, и это не осторожность, а разные узлы:
     у первого в записи есть принцип с посылками, у второго нет ни строки. */
  perepisan = !proigran && dokazano && perepiskoy(s, svoi, stroki, imya, chya, cel);
  sverit_pravila(s, svoi, fmt("утверждение «%s»", imya));
  sverit_polya_posylok(s, svoi, stroki, imya);
  sverit_svedenie(s, svoi, imya);
  sverit_pokrytie(s, svoi, stroki, imya, verdikt, mesto, proigran || perepisan);
  /* Ч363: и узлы, и СНЯТЫЕ ИМИ МЕСТА — числом. Второе нужно тому, кто считает
     породы мест по тексту записи: без него два прибора разойдутся на честной
     записи, и расхождение это будет не находкой, а слепотой мерки.
     Ч365: приём переписки снимает РОВНО ОДНО место — само утверждение. Посылок
     он не проигрывает и потому их не считает: `perepiskoy` берётся только там,
     где посылок нет ни одной, и приписать себе чужое снятие ему нечем. */
  if (proigran) { s->uzlov++; s->uzlov_mest += 1 + vse_s_nachalom(svoi, "посылка ").n; }
  else if (perepisan) { s->tozhdestv++; s->tozhdestv_mest++; }
  else if (dokazano) s->na_slovo++;
}

static void sverit_utverzhdenie(Sverka *s, const char *blok, Sp stroki) {
  Sp svoi = razdelit(blok, "\n");
  char *zagolovok = chast(svoi, 1);
  char *imya = v_yolochkah(zagolovok, 1), *chya = v_yolochkah(zagolovok, 2);
  long gde = nomer_posle(zagolovok, "строка ");
  char *mesto = stroka_po_nomeru(stroki, gde);
  char *verdikt = slovo_posle(pervaya_s_nachalom(svoi, "вердикт "), "вердикт ");
  char *hozyain = hozyain_stroki(stroki, gde);
  int est_teorema = *pervaya_s_nachalom(svoi, "теорема «") != 0;
  s->utverzhdeniy++;
  if (strcmp(verdikt, "доказано") == 0) s->dokazannyh++;
  sverit_celost_bloka(s, svoi, imya);
  esli_ne(s, soderzhit(mesto, fmt("обеспечивает «%s»", imya)),
          fmt("строка %ld исходника не несёт «обеспечивает «%s»» — записанное утверждение в исходнике не стоит", gde, imya));
  esli_ne(s, strcmp(hozyain, chya) == 0,
          fmt("утверждение «%s» записано за функцией «%s», а строка %ld исходника стоит в функции «%s»",
              imya, chya, gde, hozyain));
  if (est_teorema) sverit_teoremu(s, svoi, stroki, verdikt, mesto, imya, chya);
  else bez_teoremy(s, svoi, stroki, imya, verdikt, mesto, chya);
}

static Sverka sverit(const char *ishodnik, const char *zapis, const char *put,
                     const char *zhdyom) {
  Sverka s; Sp chasti = razdelit(zapis, "\nутверждение "), bloki = PUSTO;
  Sp shapka = razdelit(chast(chasti, 1), "\n"), stroki = razdelit(ishodnik, "\n");
  int i;
  memset(&s, 0, sizeof s);
  /* Ч87: оглавление списочных литералов, выписанное печатью записи. Никакого
     доверия оно не получает — только указывает, где сверщику читать. */
  OGLAVLENIE = PUSTO; OGL_BEDY = PUSTO;
  for (i = 0; i < shapka.n; i++)
    if (nachinaetsya(obrezat(shapka.e[i]), "таблица «")) dobavit(&OGLAVLENIE, obrezat(shapka.e[i]));
  s.sha = sha256(ishodnik);
  /* Отпечаток, поданный доводом, — такая же криптопривязка, как строка шапки, и
     считается ДО сверки пути: от него зависит, привязка путь или примета. */
  if (zhdyom) {
    if (strcmp(zhdyom, s.sha) == 0) s.kripto = 1;
    else dobavit(&s.bedy, fmt("ждали исходник с отпечатком %s, а у поданного %s", zhdyom, s.sha));
  }
  for (i = 0; i < chasti.n; i++)
    if (!nachinaetsya(chasti.e[i], "запись доказательства")) dobavit(&bloki, chasti.e[i]);
  sverit_stroki_zapisi(&s, zapis);
  sverit_shapku(&s, shapka, ishodnik);
  /* Ч55. Пока криптоотпечатка нет, поле «исходник» — единственное, что держит
     запись при её программе, и оно сверяется жёстко. Как только отпечаток256
     сошёлся, поданный файл — ТА ЖЕ программа побайтно, и спорить с путём не о
     чем: запись, снятая в другом клоне, честна, а поле годится лишь как
     подсказка, где файл искать. Тогда расхождение — примета, не беда. */
  { char *zayavlen = hvost_posle(chast(shapka, 2), "исходник ");
    if (!put_sovpal(zayavlen, put)) {
      if (s.kripto)
        dobavit(&s.primety,
                fmt("поле «исходник» зовёт «%s», а сверялись с «%s»; отпечаток256 сошёлся — "
                    "это та же программа, и поле здесь примета, а не привязка", zayavlen, put));
      else
        dobavit(&s.bedy,
                fmt("запись зовёт своим исходником «%s», а сверяется с «%s» — это другая программа",
                    zayavlen, put));
    } }
  /* Ч87: оглавление списочных литералов обещает столько таблиц, сколько в нём
     строк, — иначе печать назвала не всё, что выписала. */
  esli_ne(&s, !OGLAVLENIE.n || nomer_posle(pervaya_s_nachalom(shapka, "таблиц "), "таблиц ") == OGLAVLENIE.n,
          (char *)"оглавление обещает не столько таблиц, сколько в нём строк");
  esli_ne(&s, nomer_posle(chast(shapka, 7), "утверждений ") == bloki.n,
          (char *)"шапка обещает не столько утверждений, сколько в записи");
  sverit_polnotu(&s, stroki, bloki);
  /* ВЕРДИКТ ПОУТВЕРЖДЁННО. Гейт Г4 меряет долю УТВЕРЖДЕНИЙ, а вердикт до сих пор
     был один на весь файл: одно непроверенное утверждение красило и те, что
     проверены до конца. Здесь считается каждое порознь — тем же счётом, что и
     общий вердикт, а не отдельной меркой. */
  for (i = 0; i < bloki.n; i++) {
    long b0 = s.bedy.n, d0 = s.na_slovo, sh0 = s.shagov_na_slovo;
    Sp svoi = razdelit(bloki.e[i], "\n");
    char *imya = v_yolochkah(chast(svoi, 1), 1);
    char *verdikt = slovo_posle(pervaya_s_nachalom(svoi, "вердикт "), "вердикт ");
    const char *itog;
    sverit_utverzhdenie(&s, bloki.e[i], stroki);
    itog = s.bedy.n > b0 ? "НЕ СОШЛОСЬ"
         : (strcmp(verdikt, "доказано") != 0 ? "вердикта нет — проверять нечего"
         : ((s.na_slovo > d0 || s.shagov_na_slovo > sh0) ? "НЕ ПРОВЕРЕНО" : "ПРОВЕРЕНО"));
    dobavit(&s.po_utverzhdeniyam,
            fmt("  утверждение «%s»: %s (на слово ядра: посылок и утверждений %ld, шагов %ld)",
                imya, itog, s.na_slovo - d0, s.shagov_na_slovo - sh0));
  }
  sverit_krugi(&s, bloki);
  for (i = 0; i < OGL_BEDY.n; i++) dobavit(&s.bedy, OGL_BEDY.e[i]);
  return s;
}

/* ── ТРИ ИСХОДА, И ОНИ НАЗВАНЫ СЛОВАМИ, А НЕ ОТТЕНКАМИ ───────────────────────
   Ч40 показала прогоном, чего стоит одно слово «сошлось»: сверщик на flang
   ответил им и кодом 0 на записи, утверждающей ЛОЖЬ, — потому что «сошлось»
   значило «запись не противоречит тексту исходника», а читалось как
   «утверждение доказано». Здесь это два разных исхода с разными кодами:
     0 — ПРОВЕРЕНО: ни одного места, взятого на слово ядра;
     3 — НЕ ПРОВЕРЕНО: противоречий нет, но столько-то мест не проверено, и они
         названы числом. Это НЕ «доказано»;
     1 — НЕ СОШЛОСЬ: найдено противоречие, оно названо;
     2 — кривой вызов.
   Исход 3 наступает по ДВУМ разным причинам, и они названы порознь:
     • места, принятые на слово ядра (посылки, шаги, имена правил), — числом;
     • привязка к программе не криптографическая: строки «отпечаток256» в
       записи нет и отпечаток не подан доводом (дописка Ч55).
   Ключ `--старый-код-не-приёмка` (бывший `--мягко`) возвращает 0 вместо 3 — для
   оснастки, писанной под прежний договор о двух исходах. Слова вердикта он НЕ
   меняет и МОЛЧА этого не делает: в поток ошибок уходит строка о том, что код 0
   здесь приёмкой не является и каким был настоящий исход. Имя переименовано
   именно затем, чтобы код 0 под ним нельзя было прочесть как приёмку: замером
   Ч55 показано, что под прежним `--мягко` ложь Ч40 `lozh-1-verdikt` получала
   код 0 — тот же код, что и честная проверенная запись. */
int main(int argc, char **argv) {
  char *ishodnik, *zapis, *zhdyom = NULL; Sverka s; int staryy = 0, d = 0, i, poimenno = 0;
  const char *dovody[3]; int n = 0;
  /* Список ключей закрыт (правило Ч27): ключ, которого чекер не знает, — отказ
     кодом 2, а не довод и не «ладно». Иначе забытый `--мягко` уехал бы третьим
     доводом и вышел бы ложным «НЕ СОШЛОСЬ» вместо честного «звать не так». */
  for (i = 1; i < argc; i++) {
    if (strcmp(argv[i], "--старый-код-не-приёмка") == 0) staryy = 1;
    else if (strcmp(argv[i], "--по-утверждениям") == 0) poimenno = 1;
    else if (nachinaetsya(argv[i], "--")) {
      fprintf(stderr, "чекер не знает ключа «%s». Ключей ровно два: "
                      "--старый-код-не-приёмка (им заменён прежний --мягко) "
                      "и --по-утверждениям\n", argv[i]);
      return 2;
    }
    else if (n < 3) dovody[n++] = argv[i];
    else { fprintf(stderr, "лишний довод «%s»\n", argv[i]); return 2; }
  }
  if (n < 2 || n > 3) {
    fprintf(stderr, "звать: сверщик [--старый-код-не-приёмка] [--по-утверждениям]"
                    " <исходник.flang> <запись> [ожидаемый sha256]\n");
    return 2;
  }
  if (n == 3) zhdyom = (char *)dovody[2];
  ishodnik = prochitat_fajl(dovody[0]);
  if (!ishodnik) { fprintf(stderr, "исходник не прочитан: %s\n", dovody[0]); return 2; }
  zapis = prochitat_fajl(dovody[1]);
  if (!zapis) { fprintf(stderr, "запись не прочитана: %s\n", dovody[1]); return 2; }
  s = sverit(ishodnik, zapis, dovody[0], zhdyom);
  /* Ч56: вердикт по каждому утверждению порознь. Печатается ДО общего — он и
     объясняет, откуда общий взялся. */
  if (poimenno) for (i = 0; i < s.po_utverzhdeniyam.n; i++) printf("%s\n", s.po_utverzhdeniyam.e[i]);
  if (s.bedy.n) { printf("НЕ СОШЛОСЬ: %s\n", soedinit(s.bedy, "; ")); return 1; }
  /* Ч76: за что сверщик НЕ ВЗЯЛСЯ, названо вслух и поимённо. Приём, который
     ломается молча, отличить от приёма, которому нечего проверять, нельзя. */
  if (s.ne_vzyalsya.n)
    printf("НЕ ВЗЯЛСЯ (мест %d): %s\n", s.ne_vzyalsya.n, soedinit(s.ne_vzyalsya, "; "));
  { int na_slovo_est = (s.na_slovo || s.shagov_na_slovo) ? 1 : 0;
    const char *golova;
    d = (na_slovo_est || !s.kripto) ? 1 : 0;
    if (!s.kripto && na_slovo_est)
      golova = "НЕ ПРОВЕРЕНО — привязка к программе не криптографическая (строки «отпечаток256»"
               " в записи нет), и записанное доказательством не является";
    else if (!s.kripto)
      golova = "НЕ ПРОВЕРЕНО — привязка к программе не криптографическая: строки «отпечаток256»"
               " в записи нет и отпечаток не подан доводом, а многочленная свёртка ломается";
    else if (na_slovo_est)
      golova = "НЕ ПРОВЕРЕНО — запись не противоречит исходнику, но доказательством это не является";
    else
      golova = s.dokazannyh
             ? "ПРОВЕРЕНО — запись сошлась с исходником, и всё доказанное проиграно заново"
             : "ПРОВЕРЕНО ВПУСТУЮ — запись сошлась с исходником, но доказанным в ней не числится ничего";
    printf("%s: утверждений %ld, шагов сверено с исходником %ld, сведений проиграно заново %ld"
           " (ходов проверено %ld). Числятся доказанными %ld."
           " НА СЛОВО ЯДРА: посылок и утверждений %ld, шагов %ld."
           " Узлов вердикта «разбором по случаям» проиграно заново %ld"
           " (снято со слова ядра мест %ld),"
           " вне приёма сверщика %ld."
           " Узлов «тождество после переписки допущением» проиграно заново %ld"
           " (снято со слова ядра мест %ld),"
           " вне приёма сверщика %ld, переписано, но не сошлось %ld."
           " Шагов по примеру проверено по существу %ld."
           " Строк без привязки к исходнику %ld."
           " Мест, сверенных ОБОИМИ свидетелями (термин и номер строки), %ld."
           " Привязка к программе: %s."
           " sha256 исходника %s\n",
           golova, s.utverzhdeniy, s.shagov, s.svedeniy, s.hodov, s.dokazannyh,
           s.na_slovo, s.shagov_na_slovo, s.uzlov, s.uzlov_mest, s.uzlov_mimo,
           s.tozhdestv, s.tozhdestv_mest, s.tozhdestv_mimo, s.tozhdestv_ne_soshlos,
           s.shagov_primerom, s.bez_privyazki, s.svereno_oboimi,
           s.kripto ? "SHA-256 сошёлся" : "только свёртка ядра — она ломается",
           s.sha);
    if (s.primety.n) printf("ПРИМЕТЫ (на исход не влияют): %s\n", soedinit(s.primety, "; "));
    if (d && staryy)
      fprintf(stderr, "ВНИМАНИЕ: ключ --старый-код-не-приёмка обменял исход 3 на код 0."
                      " Код 0 здесь ПРИЁМКОЙ НЕ ЯВЛЯЕТСЯ. Настоящий исход: %s\n", golova);
    return (d && !staryy) ? 3 : 0; }
}
