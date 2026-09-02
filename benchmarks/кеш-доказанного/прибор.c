/* ═══════ ПРИБОР Ч351: КЛЮЧ КЕША ПРИГОВОРОВ И ЧЕМ ОН ДОКАЗАН ═══════
 *
 * Хранилища здесь нет и не пишется ни строки: прибор СЧИТАЕТ КЛЮЧ и даёт
 * пробам, чем его опровергать. Кеш с неверным ключом — машина по производству
 * ложных доказательств, и это не опасение: Ч183 замерила 4 ложных из 12 на
 * трёх однострочных правках и 49 из 103 на пересборке проверяльщика.
 *
 * ── ЧТО ВХОДИТ В КЛЮЧ. Девять слагаемых, каждое с местом, откуда ядро его
 *    читает (строки — flang/self, ветка dev):
 *
 *   ① УЗЕЛ ОБЯЗАТЕЛЬСТВА целиком — цель, посылки, `vars`, `assumptions`,
 *      `grid`, `bind`: obligations.flang:223 собирает его пофайлово, и ядро
 *      читает из него всё, кроме `span` (см. ниже про места);
 *   ② ТЕЛО СВОЕЙ ФУНКЦИИ — proofterm.flang:2632 «Свести цель с телом»;
 *   ③ ТЕЛА ВСЕХ ВЫЗВАННЫХ ПО ЗАМЫКАНИЮ — их разворачивает нормализация,
 *      proof-kernel.flang:1873 «Развернуть телом»; список определений =
 *      все функции программы, proofterm.flang:198 «Функция терма по имени»;
 *   ④ ПОСТУСЛОВИЯ ВЫЗВАННЫХ — proofterm.flang:2455 «Постусловия вызванных»;
 *   ⑤ ПРЕДУСЛОВИЯ ВЫЗВАННЫХ и ГЛОБАЛЬНЫЙ СПИСОК НЕОПЛАЧЕННЫХ —
 *      proofterm.flang:2482 и 3503 «Снять предусловия»;
 *   ⑥ ОБЪЯВЛЕНИЯ ТИПОВ — proofterm.flang:203 «Сумма по имени», по ним
 *      порождается принцип индукции (proof-initial.flang:1649);
 *   ⑦ ОБЪЯВЛЕНИЯ ЗАКОНОВ — proofterm.flang:228 «Есть закон»; полей ПЯТЬ:
 *      monoids, monads, isomorphisms, embeddings, intersections;
 *   ⑧ МНОЖЕСТВО УЖЕ ДОКАЗАННЫХ ФАКТОВ — proofterm.flang:2493 «Дописать факт
 *      вызванного» читает «Оплаченное».«доказанные»;
 *   ⑨ ОТПЕЧАТОК ПРОВЕРЯЛЬЩИКА — ДВОИЧНОГО, а не исходников дерева.
 *
 * ── ТРИ ОТЛИЧИЯ ОТ КЛЮЧА Ч183, каждое закрывает ложное доказательство:
 *
 *   А. МЕСТА (`span`) ИЗ КЛЮЧА ИЗЪЯТЫ. Ч183 замерила: одна пустая строка
 *      вверху файла — приговоры все те же, ключи все иные (4 из 4), то есть
 *      кеш не попадал бы никогда. Изъятие ЗАКОННО, и это читается в самом
 *      ядре, а не берётся на веру: всякое правило, которое ходит по узлу,
 *      место ПРОПУСКАЕТ явной веткой — подстановка (proof-initial.flang:278,
 *      с постусловием «поле места проходится нетронутым»), сбор имён
 *      (proof-kernel.flang:2095), сбор вызовов (proofterm.flang:3385),
 *      связыватели (proof-kernel.flang:2188), условие цели
 *      (proof-kernel.flang:6946). Место читается РОВНО В ОДНОМ месте — когда
 *      к отказу приписывают, где он случился («Отказ терма»,
 *      proofterm.flang:427, и «Диагностика отказа», :439).
 *      ЧТО ДЕЛАТЬ С ОТКАЗОМ, чтобы он не назвал устаревшую строку: хранить
 *      его БЕЗ поля `span` и приписывать место при чтении из кеша — из
 *      СЕГОДНЯШНЕГО узла обязательства, тем же «Первое непустое» от
 *      постусловия и функции, каким его берёт obligations.flang:228. Форма
 *      ядра к этому готова: «Отказ терма» принимает место ОТДЕЛЬНЫМ
 *      аргументом и приписывает его последним полем. Что в самом тексте
 *      отказа мест нет — проба-местами.sh сличает тексты побайтово.
 *
 *   Б. ОТПЕЧАТОК СНИМАЕТСЯ С ДВОИЧНОГО, И СНИМАЕТ ЕГО САМ ПРИБОР — читает
 *      /proc/self/exe. У Ч183 он приезжал переменной среды, и проба-ядром
 *      показала цену забывчивости: 49 приговоров из 103 сменились, «Версия
 *      ядра» (proofterm.flang:73) у обоих двоичных осталась 2 — там версия
 *      ФОРМАТА термов, а не правил. Не снялся отпечаток — ключи НЕ
 *      ПЕЧАТАЮТСЯ вовсе: молчание лучше неверного ключа.
 *
 *   В. ЗАКОНЫ-ПЕРЕСЕЧЕНИЯ (`intersections`) ДОБАВЛЕНЫ. Ч183 хешировала
 *      четыре поля законов из пяти; пятое читает «Есть закон»
 *      (proofterm.flang:245), и без него правка объявления пересечения
 *      меняла бы приговор, не меняя ключа.
 *
 * ── ПОЧЕМУ ⑧ НЕ ОТДЕЛЬНОЕ СЛАГАЕМОЕ, А СЛЕДСТВИЕ ЗАМЫКАНИЯ. «Доказанные»
 *    спрашивают не вообще, а по одному ключу «Ключ факта(кого, имя)», где
 *    «кого» — имя ВЫЗВАННОЙ (proofterm.flang:2493). Доказана ли она, решает
 *    её собственное обязательство, а оно стоит на её замыкании — подмножестве
 *    нашего. Индукцией по замыканию: множество доказанных фактов, которые
 *    видит это обязательство, определено содержимым его замыкания и общей
 *    частью. Класть в ключ сам список доказанных нельзя: он растёт по ходу
 *    неподвижной точки, и ключ не сошёлся бы сам с собой на втором проходе.
 *
 * ── ЗАМЫКАНИЕ СЧИТАЕТСЯ ПО ВСЕМУ УЗЛУ ФУНКЦИИ, а не по одному `body`, как у
 *    Ч183: цель — это постусловие с подставленным телом (proofterm.flang:2637),
 *    и вызов, стоящий ТОЛЬКО в постусловии или в `требует`, из `body` не
 *    виден. Пропущенное ребро замыкания — это ложное доказательство.
 *
 * ── ЧТО ПРИБОР ПЕЧАТАЕТ. По строке на обязательство, полями через табуляцию;
 *    первые семь полей — те же, что у Ч183, чтобы пробы читались обеими:
 *
 *      ОБЯЗ ⇥ функция ⇥ имя ⇥ приговор ⇥ шагов ⇥ попыток ⇥ замыкание
 *           ⇥ ПОЛНЫЙ ⇥ наивный ⇥ по-дереву ⇥ с-местами ⇥ без-замыкания
 *
 *    Четыре последних — НЕ ключи для дела, а ПОДДЕЛКИ, по одной на каждую
 *    выброшенную составляющую. Они здесь затем, чтобы каждая проба на одном
 *    прогоне показывала, что именно ломается без неё:
 *      наивный        — только своё обязательство и своя функция (ключ Ч183
 *                       для пробы на промах);
 *      по дереву      — полный БЕЗ отпечатка проверяльщика (⑨);
 *      с местами      — полный, но места в ключе (ключ Ч183 целиком);
 *      без замыкания  — полный БЕЗ тел вызванных (③④), общее и отпечаток на
 *                       месте.
 *
 * ── КЛЮЧИ. FLANG_KESH=1 включает прибор (по умолчанию он молчит и не считает
 *    ничего); FLANG_KESH_ONLY=1 — не звать после него «Суд ядра о программе»
 *    целиком; FLANG_KESH_TSENA=1 — считать ещё и ЦЕНУ (прогон «Закрыть без
 *    теорем» целиком и повтор при кеше), это вдвое дольше и нужно не всегда;
 *    FLANG_KESH_TOLKO_KLYUCHI=1 — НЕ ЗВАТЬ ЯДРО ВОВСЕ: печатаются одни ключи, в
 *    столбце приговора стоит «-». Тем и берётся ключ по замыканию компилятора,
 *    где неподвижная точка стоит 7,5 ч (Ч180) и потому не по карману;
 *    FLANG_KESH_KERNEL=<строка> — приписать к отпечатку произвольную строку
 *    (совместимость с приборами Ч183, отпечатка двоичного НЕ ОТМЕНЯЕТ).
 *
 *    Ответ команды прибор НЕ меняет: «Суд ядра о программе» после него зовётся
 *    как звался.
 */

static double machine_now(void);

/* ── хеш ─────────────────────────────────────────────────────────────────────
 * FNV-1a 64. Не криптография: сличаются свои же прогоны, подделывать ключ
 * некому. В НАСТОЯЩЕМ хранилище хеш обязан быть криптостойким — там столкновение
 * означает ложное доказательство, и подбирать его будет тот, кому это выгодно.
 */
static unsigned long long kesh_fnv(unsigned long long h, const void *p, size_t n) {
  const unsigned char *b = (const unsigned char *) p;
  size_t i = 0;
  for (i = 0; i < n; i += 1) {
    h ^= (unsigned long long) b[i];
    h *= 1099511628211ULL;
  }
  return h;
}

#define KESH_SEED 14695981039346656037ULL
#define KESH_GLUBINA 20000

static bool kesh_ok = true;
static unsigned long kesh_last_steps = 0;
static unsigned long kesh_chuzhih = 0; /* узлов НЕ вида «Значение» под хешем */

static unsigned long long kesh_mark(unsigned long long h, const char *mark) {
  return kesh_fnv(h, mark, strlen(mark));
}

/* Вызов ядра по имени с замером ЭТОГО вызова. */
static bool kesh_call(const char *name, const fl_value *args, size_t count, fl_value *out) {
  bool was = repl_call_quiet;
  bool ok = false;
  repl_call_quiet = true;
  ok = (repl_call(name, args, count, out) == FL_OK);
  repl_call_quiet = was;
  kesh_last_steps = (unsigned long) repl_ctx.steps;
  if (!ok) {
    kesh_ok = false;
    fprintf(stderr, "кеш: сорвалось на «%s»\n", name);
  }
  return ok;
}

/* ── ОТПЕЧАТОК ПРОВЕРЯЛЬЩИКА (⑨) ────────────────────────────────────────────
 * Двоичного, а не исходников: проба-ядром.sh правит ПРАВИЛО в копии семени и
 * не трогает дерево ни байтом — отпечаток, снятый по дереву, у обоих прогонов
 * один, а приговоры разные. Читается /proc/self/exe, то есть тот самый файл,
 * который сейчас исполняется, — не путь из argv, который можно подменить.
 */
static unsigned long long kesh_otpechatok(bool *snyat) {
  static int gotovo = 0;
  static bool ok = false;
  static unsigned long long h = KESH_SEED;
  if (!gotovo) {
    FILE *f = fopen("/proc/self/exe", "rb");
    double t0 = machine_now();
    gotovo = 1;
    if (f == NULL) {
      fprintf(stderr, "кеш: /proc/self/exe не открылся — ОТПЕЧАТОК ПРОВЕРЯЛЬЩИКА НЕ СНЯТ\n");
    } else {
      static unsigned char buf[65536];
      size_t got = 0;
      unsigned long long bytes = 0;
      while ((got = fread(buf, 1, sizeof buf, f)) > 0) {
        h = kesh_fnv(h, buf, got);
        bytes += (unsigned long long) got;
      }
      ok = (ferror(f) == 0) && bytes > 0;
      fclose(f);
      if (ok) {
        fprintf(stderr, "кеш: отпечаток проверяльщика %016llx, байтов %llu, снят за %.3f с\n",
                h, bytes, machine_now() - t0);
      } else {
        fprintf(stderr, "кеш: /proc/self/exe не дочитан — ОТПЕЧАТОК ПРОВЕРЯЛЬЩИКА НЕ СНЯТ\n");
      }
    }
  }
  *snyat = ok;
  return h;
}

/* ── СТРУКТУРНЫЙ ХЕШ УЗЛА ────────────────────────────────────────────────────
 *
 * Ходит по «Значение» (flang/core/json.flang:49) НАПРЯМУЮ, а не через «Печать
 * значения», и на то две причины. Первая: печать нельзя попросить пропустить
 * место, а ключу места не нужны. Вторая: печать идёт через толкователь и стоит
 * шагов, а ключ обязан быть дешевле того, что он экономит.
 *
 * Запись однозначна и без длин: у каждого вида своя метка, у каждого поля —
 * метка «k», длина имени и само имя, у записи и списка — закрывающая метка.
 * Двум разным деревьям одной записи не выйдет.
 *
 * ПОЛЕ `span` ПРОПУСКАЕТСЯ ЦЕЛИКОМ, если mesta = false. Ровно так же его
 * пропускают все правила ядра, которые ходят по узлу (список мест — в шапке).
 */
static unsigned long long kesh_hash_syroe(unsigned long long h, fl_value v, int depth);

static unsigned long long kesh_hash_uzel(unsigned long long h, fl_value node, bool mesta, int depth) {
  fl_value polya = fl_nothing();
  fl_value elementy = fl_nothing();
  fl_value skalyar = fl_nothing();
  fl_value vnutri = fl_nothing();
  size_t i = 0;

  if (depth > KESH_GLUBINA) {
    kesh_ok = false;
    fprintf(stderr, "кеш: узел глубже %d — ключ НЕ ПОЛОН\n", KESH_GLUBINA);
    return h;
  }
  if (node.tag != FL_VARIANT) {
    kesh_chuzhih += 1;
    return kesh_hash_syroe(h, node, depth);
  }
  if (strcmp(node.as.variant->name, "Значение записи") == 0) {
    h = kesh_mark(h, "R{");
    if (!val_field(node, "поля", &polya) || polya.tag != FL_LIST) {
      kesh_ok = false;
      fprintf(stderr, "кеш: у «Значение записи» нет списка «поля» — ключ НЕ ПОЛОН\n");
      return h;
    }
    for (i = 0; i < polya.as.list.count; i += 1) {
      fl_value para = polya.as.list.items[i];
      fl_value klyuch = fl_nothing();
      fl_value znachenie = fl_nothing();
      const char *utf8 = NULL;
      size_t bytes = 0;
      if (!val_field(para, "ключ", &klyuch) || !val_field(para, "значение", &znachenie) ||
          !val_text(klyuch, &utf8, &bytes)) {
        kesh_ok = false;
        fprintf(stderr, "кеш: поле записи не разобралось — ключ НЕ ПОЛОН\n");
        return h;
      }
      if (!mesta && bytes == 4 && memcmp(utf8, "span", 4) == 0) {
        continue;
      }
      h = kesh_mark(h, "k");
      h = kesh_fnv(h, &bytes, sizeof bytes);
      h = kesh_fnv(h, utf8, bytes);
      h = kesh_hash_uzel(h, znachenie, mesta, depth + 1);
    }
    return kesh_mark(h, "}");
  }
  if (strcmp(node.as.variant->name, "Значение списка") == 0) {
    h = kesh_mark(h, "L[");
    if (!val_field(node, "элементы", &elementy) || elementy.tag != FL_LIST) {
      kesh_ok = false;
      fprintf(stderr, "кеш: у «Значение списка» нет «элементы» — ключ НЕ ПОЛОН\n");
      return h;
    }
    for (i = 0; i < elementy.as.list.count; i += 1) {
      h = kesh_mark(h, "e");
      h = kesh_hash_uzel(h, elementy.as.list.items[i], mesta, depth + 1);
    }
    return kesh_mark(h, "]");
  }
  if (strcmp(node.as.variant->name, "Значение скаляра") == 0) {
    h = kesh_mark(h, "S");
    if (!val_field(node, "скаляр", &skalyar) || skalyar.tag != FL_VARIANT) {
      kesh_ok = false;
      fprintf(stderr, "кеш: у «Значение скаляра» нет «скаляр» — ключ НЕ ПОЛОН\n");
      return h;
    }
    h = kesh_mark(h, skalyar.as.variant->name);
    if (val_field(skalyar, "значение", &vnutri)) {
      h = kesh_hash_syroe(h, vnutri, depth + 1);
    }
    return h;
  }
  /* Вариантов у «Значение» ровно три. Четвёртый — не узел; хешируется целиком,
     чтобы ничто не пропало молча, и считается отдельно. */
  kesh_chuzhih += 1;
  return kesh_hash_syroe(h, node, depth);
}

/* Хеш чего угодно из рантайма — на случай, если под ключ приедет не «Значение».
   Молча выбросить нельзя: выброшенное слагаемое и есть ложное доказательство. */
static unsigned long long kesh_hash_syroe(unsigned long long h, fl_value v, int depth) {
  size_t i = 0;
  if (depth > KESH_GLUBINA) {
    kesh_ok = false;
    fprintf(stderr, "кеш: значение глубже %d — ключ НЕ ПОЛОН\n", KESH_GLUBINA);
    return h;
  }
  switch (v.tag) {
    case FL_NOTHING:
      return kesh_mark(h, "0");
    case FL_NUMBER: {
      double d = v.as.number;
      h = kesh_mark(h, "n");
      /* БИТАМИ, а не через печать: −0 и 0 — разные значения при сравнении на
         равенство, и ключ обязан их различать. */
      return kesh_fnv(h, &d, sizeof d);
    }
    case FL_FLAG: {
      unsigned char b = v.as.flag ? 1 : 0;
      h = kesh_mark(h, "b");
      return kesh_fnv(h, &b, 1);
    }
    case FL_STRING:
      h = kesh_mark(h, "s");
      h = kesh_fnv(h, &v.as.string.bytes, sizeof v.as.string.bytes);
      return kesh_fnv(h, v.as.string.utf8, v.as.string.bytes);
    case FL_LIST:
      h = kesh_mark(h, "l[");
      for (i = 0; i < v.as.list.count; i += 1) {
        h = kesh_mark(h, "e");
        h = kesh_hash_syroe(h, v.as.list.items[i], depth + 1);
      }
      return kesh_mark(h, "]");
    case FL_RECORD:
      h = kesh_mark(h, "r{");
      for (i = 0; i < v.as.record->count; i += 1) {
        h = kesh_mark(h, "f");
        h = kesh_mark(h, v.as.record->fields[i].name);
        h = kesh_hash_syroe(h, v.as.record->fields[i].value, depth + 1);
      }
      return kesh_mark(h, "}");
    case FL_VARIANT:
      h = kesh_mark(h, "v{");
      h = kesh_mark(h, v.as.variant->name);
      for (i = 0; i < v.as.variant->count; i += 1) {
        h = kesh_mark(h, "f");
        h = kesh_mark(h, v.as.variant->fields[i].name);
        h = kesh_hash_syroe(h, v.as.variant->fields[i].value, depth + 1);
      }
      return kesh_mark(h, "}");
    default:
      kesh_ok = false;
      fprintf(stderr, "кеш: значение неизвестного вида %d — ключ НЕ ПОЛОН\n", (int) v.tag);
      return h;
  }
}

static bool kesh_field(fl_value node, const char *key, fl_value *out) {
  fl_value pair[2];
  pair[0] = node;
  pair[1] = repl_value_say(key);
  return kesh_call("Взять поле", pair, 2, out);
}

static bool kesh_text_field(fl_value node, const char *key, const char **utf8, size_t *bytes) {
  fl_value pair[2];
  fl_value got = fl_nothing();
  pair[0] = node;
  pair[1] = repl_value_say(key);
  if (!kesh_call("Строка поля", pair, 2, &got)) {
    return false;
  }
  return val_text(got, utf8, bytes);
}

static bool kesh_items(fl_value node, const char *key, fl_value *out) {
  fl_value pair[2];
  pair[0] = node;
  pair[1] = repl_value_say(key);
  if (!kesh_call("Элементы поля", pair, 2, out)) {
    return false;
  }
  return out->tag == FL_LIST;
}

/* Одна функция программы: имя, два хеша узла (без мест и с местами) и рёбра. */
typedef struct {
  const char *name;
  size_t name_bytes;
  unsigned long long hash;       /* без мест — им считается ключ */
  unsigned long long hash_mesta; /* с местами — только для подделки «с местами» */
  size_t *calls;
  size_t call_count;
} kesh_fun;

static size_t kesh_fun_by_name(const kesh_fun *funs, size_t count, const char *name, size_t bytes) {
  size_t i = count;
  /* ПОСЛЕДНЯЯ ОДНОИМЁННАЯ, а не первая — тем же правилом, что «Функция терма по
     имени» (flang/self/proofterm.flang:198). */
  while (i > 0) {
    i -= 1;
    if (funs[i].name_bytes == bytes && memcmp(funs[i].name, name, bytes) == 0) {
      return i;
    }
  }
  return (size_t) -1;
}

/* Возрастающий порядок 64-битных хешей: замыкание — МНОЖЕСТВО, и ключ не имеет
   права зависеть от порядка объявлений в файле. Перестановка двух функций
   местами приговора не меняет — не должна менять и ключа. */
static int kesh_sravnit(const void *a, const void *b) {
  unsigned long long x = *(const unsigned long long *) a;
  unsigned long long y = *(const unsigned long long *) b;
  if (x < y) { return -1; }
  if (x > y) { return 1; }
  return 0;
}

static int kesh_sravnit_stroki(const void *a, const void *b) {
  return strcmp(*(const char *const *) a, *(const char *const *) b);
}

static void kesh_run(fl_value program, fl_value total) {
  fl_value spuski_field = fl_nothing();
  fl_value spuski = fl_nothing();
  fl_value svod = fl_nothing();
  fl_value obligations = fl_nothing();
  fl_value pre = fl_nothing();
  fl_value unpaid = fl_nothing();
  fl_value without = fl_nothing();
  fl_value whole_closed = fl_nothing();
  fl_value functions = fl_nothing();
  fl_value pair[2];
  fl_value quad[4];
  fl_error err;
  kesh_fun *funs = NULL;
  size_t fcount = 0;
  size_t i = 0;
  size_t j = 0;
  unsigned long long h_obshchee = KESH_SEED;      /* ⑥⑦⑤ — общая часть */
  unsigned long long h_obshchee_mesta = KESH_SEED; /* она же, но с местами */
  unsigned long long h_otpechatok = 0;             /* ⑨ */
  bool otpechatok_snyat = false;
  double t0 = 0.0;
  bool tsenu = getenv("FLANG_KESH_TSENA") != NULL;
  bool tolko_klyuchi = getenv("FLANG_KESH_TOLKO_KLYUCHI") != NULL;
  const char *kernel_say = getenv("FLANG_KESH_KERNEL");

  err.code = NULL;
  err.message = NULL;

  /* ── ⑨ ПЕРВЫМ ДЕЛОМ: не снялся отпечаток — ключей не будет вовсе ───────── */
  h_otpechatok = kesh_otpechatok(&otpechatok_snyat);
  if (!otpechatok_snyat) {
    kesh_ok = false;
    fprintf(stderr, "кеш: КЛЮЧИ НЕ ПЕЧАТАЮТСЯ. Кеш без отпечатка проверяльщика отдаёт "
                    "ложные доказательства на первой же пересборке ядра (Ч183: 49 из 103)\n");
    return;
  }

  /* ── стадии до неподвижной точки: те же имена, что в «Проверить доказательства» ── */
  if (!val_field(total, "спуски", &spuski_field)) {
    fprintf(stderr, "кеш: нет поля «спуски»\n");
    return;
  }
  if (!kesh_call("Спуски узлами", &spuski_field, 1, &spuski)) { return; }
  pair[0] = program;
  pair[1] = spuski;
  if (!kesh_call("Обязательства", pair, 2, &svod)) { return; }
  if (!kesh_items(svod, "obligations", &obligations)) { return; }
  fprintf(stderr, "кеш: обязательств %lu\n", (unsigned long) obligations.as.list.count);

  if (!kesh_call("Снять предусловия", &program, 1, &pre)) { return; }
  if (!val_field(pre, "неоплаченные", &unpaid)) {
    fprintf(stderr, "кеш: нет «неоплаченные»\n");
    return;
  }

  /* ── ОБЩАЯ ЧАСТЬ КЛЮЧА: ⑥ типы, ⑦ законы, ⑤ неоплаченные, ⑨ отпечаток ──── */
  {
    /* Ровно те поля программы, которые читает ядро. Проверено перечислением
       всех обращений вида «от «программа» и "…"» в четырёх файлах ядра:
       functions (оно в замыкании), types и ПЯТЬ полей законов. */
    static const char *const zakony[6] = { "types", "monoids", "monads",
                                           "isomorphisms", "embeddings", "intersections" };
    fl_value got = fl_nothing();
    for (i = 0; i < 6; i += 1) {
      if (!kesh_field(program, zakony[i], &got)) { return; }
      h_obshchee = kesh_mark(h_obshchee, zakony[i]);
      h_obshchee = kesh_hash_uzel(h_obshchee, got, false, 0);
      h_obshchee_mesta = kesh_mark(h_obshchee_mesta, zakony[i]);
      h_obshchee_mesta = kesh_hash_uzel(h_obshchee_mesta, got, true, 0);
    }
  }
  if (unpaid.tag == FL_LIST) {
    /* ПО ПОРЯДКУ ИМЕНИ, а не по порядку прихода: список читают ровно одним
       вопросом — «есть ли в нём это имя» (proofterm.flang:2482), значит это
       МНОЖЕСТВО, и порядок в ключе был бы ложным различием. */
    const char **imena = (const char **) calloc(unpaid.as.list.count + 1, sizeof(char *));
    size_t n = 0;
    if (imena == NULL) { fprintf(stderr, "кеш: нет места под неоплаченные\n"); return; }
    for (i = 0; i < unpaid.as.list.count; i += 1) {
      const char *utf8 = NULL;
      size_t bytes = 0;
      if (val_text(unpaid.as.list.items[i], &utf8, &bytes)) {
        imena[n] = repl_dup(utf8, bytes);
        n += 1;
      }
    }
    qsort(imena, n, sizeof(char *), kesh_sravnit_stroki);
    for (i = 0; i < n; i += 1) {
      h_obshchee = kesh_mark(h_obshchee, "неоплачено");
      h_obshchee = kesh_mark(h_obshchee, imena[i]);
      h_obshchee_mesta = kesh_mark(h_obshchee_mesta, "неоплачено");
      h_obshchee_mesta = kesh_mark(h_obshchee_mesta, imena[i]);
    }
    free(imena);
    fprintf(stderr, "кеш: неоплаченных предусловий %lu\n", (unsigned long) unpaid.as.list.count);
  }
  if (kernel_say != NULL) {
    h_obshchee = kesh_mark(h_obshchee, kernel_say);
    h_obshchee_mesta = kesh_mark(h_obshchee_mesta, kernel_say);
  }
  fprintf(stderr, "кеш: общая часть ключа %016llx (без мест), %016llx (с местами)\n",
          h_obshchee, h_obshchee_mesta);

  /* ── функции программы: хеши узла и рёбра вызовов ────────────────────────── */
  if (!kesh_items(program, "functions", &functions)) { return; }
  fcount = functions.as.list.count;
  funs = (kesh_fun *) calloc(fcount == 0 ? 1 : fcount, sizeof(kesh_fun));
  if (funs == NULL) {
    fprintf(stderr, "кеш: нет места под функции\n");
    return;
  }
  t0 = machine_now();
  for (i = 0; i < fcount; i += 1) {
    fl_value f = functions.as.list.items[i];
    const char *utf8 = NULL;
    size_t bytes = 0;
    if (!kesh_text_field(f, "name", &utf8, &bytes)) { free(funs); return; }
    funs[i].name = utf8;
    funs[i].name_bytes = bytes;
    /* ВЕСЬ узел функции: тело (②), постусловия (④), предусловия (⑤), подпись.
       Тело читает развёртка вызова, постусловия — факты по вызову. */
    funs[i].hash = kesh_hash_uzel(KESH_SEED, f, false, 0);
    funs[i].hash_mesta = kesh_hash_uzel(KESH_SEED, f, true, 0);
  }
  for (i = 0; i < fcount; i += 1) {
    fl_value uzel = functions.as.list.items[i];
    fl_value calls = fl_nothing();
    size_t n = 0;
    /* ПО ВСЕМУ УЗЛУ, А НЕ ПО `body`: цель — постусловие с подставленным телом,
       и вызов из постусловия или из `требует` в `body` не виден. */
    if (!kesh_call("Вызовы в узле предусловий", &uzel, 1, &calls)) { free(funs); return; }
    if (calls.tag != FL_LIST) { continue; }
    n = calls.as.list.count;
    funs[i].calls = (size_t *) calloc(n == 0 ? 1 : n, sizeof(size_t));
    if (funs[i].calls == NULL) { free(funs); return; }
    for (j = 0; j < n; j += 1) {
      const char *utf8 = NULL;
      size_t bytes = 0;
      size_t at = 0;
      if (!kesh_text_field(calls.as.list.items[j], "name", &utf8, &bytes)) { free(funs); return; }
      at = kesh_fun_by_name(funs, fcount, utf8, bytes);
      if (at == (size_t) -1) { continue; } /* встроенное имя: тела в программе нет */
      funs[i].calls[funs[i].call_count] = at;
      funs[i].call_count += 1;
    }
  }
  fprintf(stderr, "кеш: функций %lu, граф вызовов и хеши за %.3f с\n", (unsigned long) fcount,
          machine_now() - t0);

  /* ── отбор «постусловие без теоремы»: тот же, что в «Проверить доказательства» ── */
  {
    fl_value *items = NULL;
    size_t n = obligations.as.list.count;
    size_t m = 0;
    if (n > 0 && fl_list_alloc(&repl_ctx, n, &items, &err) != FL_OK) {
      fprintf(stderr, "кеш: нет места под отбор\n");
      free(funs);
      return;
    }
    for (i = 0; i < n; i += 1) {
      const char *utf8 = NULL;
      size_t bytes = 0;
      fl_value proof = fl_nothing();
      fl_value nothing = fl_nothing();
      if (!kesh_text_field(obligations.as.list.items[i], "kind", &utf8, &bytes)) { free(funs); return; }
      if (bytes != strlen("postcondition") || memcmp(utf8, "postcondition", bytes) != 0) { continue; }
      if (!kesh_field(obligations.as.list.items[i], "proof", &proof)) { free(funs); return; }
      if (!kesh_call("Это ничто", &proof, 1, &nothing)) { free(funs); return; }
      if (nothing.tag == FL_FLAG && nothing.as.flag) {
        items[m] = obligations.as.list.items[i];
        m += 1;
      }
    }
    without = fl_list(items, m);
    fprintf(stderr, "кеш: без теоремы %lu\n", (unsigned long) m);
  }

  /* ── ЦЕЛОЕ: «Закрыть без теорем» как есть — сличение с по-обязательственным ── */
  if (tsenu && !tolko_klyuchi) {
    quad[0] = without;
    quad[1] = fl_list(NULL, 0);
    quad[2] = program;
    quad[3] = unpaid;
    t0 = machine_now();
    if (!kesh_call("Закрыть без теорем", quad, 4, &whole_closed)) { free(funs); return; }
    fprintf(stderr, "кеш: «Закрыть без теорем» ЦЕЛИКОМ %.3f с, шагов %lu, закрыто %lu\n",
            machine_now() - t0, kesh_last_steps,
            whole_closed.tag == FL_LIST ? (unsigned long) whole_closed.as.list.count : 0UL);
  }

  /* ── ПО-ОБЯЗАТЕЛЬСТВЕННО: та же неподвижная точка, но каждая попытка отдельно ──
   *
   * Повторено буква в букву: «Проход без теорем» идёт по списку, каждая попытка
   * видит «закрытые», накопленные СОСЕДЯМИ этого же прохода, уже закрытое не
   * пробуется вторично, и проходы идут, пока список растёт.
   */
  {
    size_t n = without.tag == FL_LIST ? without.as.list.count : 0;
    unsigned char *closed = (unsigned char *) calloc(n == 0 ? 1 : n, 1);
    unsigned long long *steps = (unsigned long long *) calloc(n == 0 ? 1 : n, sizeof(unsigned long long));
    unsigned long *tries = (unsigned long *) calloc(n == 0 ? 1 : n, sizeof(unsigned long));
    unsigned long long *zamykanie = NULL; /* хеши членов замыкания — под сортировку */
    fl_value *keys = NULL;   /* ключи фактов закрытых — «доказанные» */
    size_t keys_count = 0;
    size_t closed_count = 0;
    size_t pass = 0;
    unsigned long long all_steps = 0;
    double spent = 0.0;
    bool sudili = !tolko_klyuchi;
    if (closed == NULL || steps == NULL || tries == NULL) { free(funs); return; }
    zamykanie = (unsigned long long *) calloc(fcount == 0 ? 1 : fcount, sizeof(unsigned long long));
    if (zamykanie == NULL) { free(funs); return; }
    if (n > 0 && fl_list_alloc(&repl_ctx, n, &keys, &err) != FL_OK) { free(funs); return; }
    t0 = machine_now();
    while (sudili) {
      size_t was = closed_count;
      pass += 1;
      for (i = 0; i < n; i += 1) {
        fl_value paid = fl_nothing();
        fl_value verdict = fl_nothing();
        fl_value triple[3];
        const char *names[2];
        fl_value vals[2];
        if (closed[i]) { continue; }
        names[0] = "доказанные";
        names[1] = "неоплаченные";
        vals[0] = fl_list(keys, keys_count);
        vals[1] = unpaid;
        if (fl_record_new(&repl_ctx, names, vals, 2, &paid, &err) != FL_OK) {
          fprintf(stderr, "кеш: не собралось «Оплаченное»\n");
          free(funs);
          return;
        }
        triple[0] = without.as.list.items[i];
        triple[1] = program;
        triple[2] = paid;
        if (!kesh_call("Вердикт без теоремы", triple, 3, &verdict)) { free(funs); return; }
        steps[i] += (unsigned long long) kesh_last_steps;
        all_steps += (unsigned long long) kesh_last_steps;
        tries[i] += 1;
        {
          fl_value nothing = fl_nothing();
          if (!kesh_call("Это ничто", &verdict, 1, &nothing)) { free(funs); return; }
          if (nothing.tag == FL_FLAG && !nothing.as.flag) {
            const char *of = NULL;
            const char *nm = NULL;
            size_t of_b = 0;
            size_t nm_b = 0;
            fl_value key = fl_nothing();
            fl_value two[2];
            if (!kesh_text_field(without.as.list.items[i], "of", &of, &of_b)) { free(funs); return; }
            two[0] = repl_value_text(of, of_b);
            if (!kesh_text_field(without.as.list.items[i], "name", &nm, &nm_b)) { free(funs); return; }
            two[1] = repl_value_text(nm, nm_b);
            if (!kesh_call("Ключ факта", two, 2, &key)) { free(funs); return; }
            keys[keys_count] = key;
            keys_count += 1;
            closed[i] = 1;
            closed_count += 1;
          }
        }
      }
      if (closed_count == was) { break; }
    }
    spent = machine_now() - t0;
    if (sudili) {
      fprintf(stderr, "кеш: по-обязательственно %.3f с, шагов %llu, закрыто %lu, проходов %lu\n",
              spent, all_steps, (unsigned long) closed_count, (unsigned long) pass);
    } else {
      fprintf(stderr, "кеш: ЯДРО НЕ ЗВАНО (FLANG_KESH_TOLKO_KLYUCHI) — приговоров нет, только ключи\n");
    }

    /* ── ЧТО СБЕРЁГ БЫ КЕШ НА ПОВТОРНОМ ПРОГОНЕ ТОГО ЖЕ ДЕРЕВА ───────────────
     * Кеша здесь нет и не пишется. Считается ОДНО число: во сколько шагов
     * обойдётся та же неподвижная точка, если приговоры «доказано» уже известны
     * и попытка по ним не делается. Отказы переспрашиваются, потому что вердикта
     * у них нет: «Учесть попытку» (proofterm.flang:3172) кладёт в «закрытые»
     * только непустой вердикт.
     */
    if (tsenu && sudili) {
      size_t was_closed = closed_count;
      unsigned long long warm_steps = 0;
      size_t warm_pass = 0;
      size_t warm_tries = 0;
      double warm_t0 = machine_now();
      for (;;) {
        size_t was = closed_count;
        warm_pass += 1;
        for (i = 0; i < n; i += 1) {
          fl_value paid = fl_nothing();
          fl_value verdict = fl_nothing();
          fl_value triple[3];
          const char *names[2];
          fl_value vals[2];
          if (closed[i]) { continue; }
          names[0] = "доказанные";
          names[1] = "неоплаченные";
          vals[0] = fl_list(keys, keys_count);
          vals[1] = unpaid;
          if (fl_record_new(&repl_ctx, names, vals, 2, &paid, &err) != FL_OK) { free(funs); return; }
          triple[0] = without.as.list.items[i];
          triple[1] = program;
          triple[2] = paid;
          if (!kesh_call("Вердикт без теоремы", triple, 3, &verdict)) { free(funs); return; }
          warm_steps += (unsigned long long) kesh_last_steps;
          warm_tries += 1;
        }
        if (closed_count == was) { break; }
      }
      fprintf(stderr,
              "кеш: ПОВТОР при кеше доказанного %.3f с, шагов %llu из %llu (%.2f %% сбережено), "
              "попыток %lu, проходов %lu, закрытых из кеша %lu\n",
              machine_now() - warm_t0, warm_steps, all_steps,
              all_steps == 0 ? 0.0 : 100.0 * (double) (all_steps - warm_steps) / (double) all_steps,
              (unsigned long) warm_tries, (unsigned long) warm_pass, (unsigned long) was_closed);
    }
    if (whole_closed.tag == FL_LIST && whole_closed.as.list.count != closed_count) {
      fprintf(stderr, "кеш: РАСХОЖДЕНИЕ с целым — целиком %lu, по частям %lu\n",
              (unsigned long) whole_closed.as.list.count, (unsigned long) closed_count);
      kesh_ok = false;
    }

    /* ── строки замера: по одной на обязательство ───────────────────────────── */
    for (i = 0; i < n; i += 1) {
      const char *of = NULL;
      const char *nm = NULL;
      size_t of_b = 0;
      size_t nm_b = 0;
      size_t at = 0;
      unsigned long long polnyy = KESH_SEED;
      unsigned long long naivnyy = KESH_SEED;
      unsigned long long po_derevu = KESH_SEED;
      unsigned long long s_mestami = KESH_SEED;
      unsigned long long bez_zamykaniya = KESH_SEED;
      unsigned long long h_obl = kesh_hash_uzel(KESH_SEED, without.as.list.items[i], false, 0);
      unsigned long long h_obl_mesta = kesh_hash_uzel(KESH_SEED, without.as.list.items[i], true, 0);
      size_t reach = 0;
      if (!kesh_text_field(without.as.list.items[i], "of", &of, &of_b)) { free(funs); return; }
      if (!kesh_text_field(without.as.list.items[i], "name", &nm, &nm_b)) { free(funs); return; }
      at = kesh_fun_by_name(funs, fcount, of, of_b);
      if (at == (size_t) -1) {
        /* Функции обязательства нет в программе: замыкание построить не из чего,
           и ключ был бы НЕПОЛОН. Молчать здесь нельзя. */
        kesh_ok = false;
        fprintf(stderr, "кеш: функция «%.*s» обязательства не найдена — ключ НЕ ПОЛОН\n",
                (int) of_b, of);
        continue;
      }

      /* ① узел обязательства + ⑥⑦⑤ общее + ⑨ отпечаток */
      polnyy = kesh_mark(polnyy, "обязательство");
      polnyy = kesh_fnv(polnyy, &h_obl, sizeof h_obl);
      polnyy = kesh_fnv(polnyy, &h_obshchee, sizeof h_obshchee);
      po_derevu = polnyy;
      bez_zamykaniya = polnyy;
      polnyy = kesh_fnv(polnyy, &h_otpechatok, sizeof h_otpechatok);

      s_mestami = kesh_mark(s_mestami, "обязательство");
      s_mestami = kesh_fnv(s_mestami, &h_obl_mesta, sizeof h_obl_mesta);
      s_mestami = kesh_fnv(s_mestami, &h_obshchee_mesta, sizeof h_obshchee_mesta);
      s_mestami = kesh_fnv(s_mestami, &h_otpechatok, sizeof h_otpechatok);

      naivnyy = kesh_mark(naivnyy, "обязательство");
      naivnyy = kesh_fnv(naivnyy, &h_obl, sizeof h_obl);

      /* ② своя функция — отдельным слагаемым, чтобы «своя» и «вызванная» не
         слились в одно множество */
      polnyy = kesh_mark(polnyy, "своя");
      polnyy = kesh_fnv(polnyy, &funs[at].hash, sizeof funs[at].hash);
      po_derevu = kesh_mark(po_derevu, "своя");
      po_derevu = kesh_fnv(po_derevu, &funs[at].hash, sizeof funs[at].hash);
      bez_zamykaniya = kesh_mark(bez_zamykaniya, "своя");
      bez_zamykaniya = kesh_fnv(bez_zamykaniya, &funs[at].hash, sizeof funs[at].hash);
      s_mestami = kesh_mark(s_mestami, "своя");
      s_mestami = kesh_fnv(s_mestami, &funs[at].hash_mesta, sizeof funs[at].hash_mesta);
      naivnyy = kesh_mark(naivnyy, "своя");
      naivnyy = kesh_fnv(naivnyy, &funs[at].hash, sizeof funs[at].hash);

      /* ③④⑤ замыкание вызовов — обходом вширь от своей функции */
      {
        unsigned char *seen = (unsigned char *) calloc(fcount == 0 ? 1 : fcount, 1);
        size_t *queue = (size_t *) calloc(fcount == 0 ? 1 : fcount, sizeof(size_t));
        size_t head = 0;
        size_t tail = 0;
        size_t m = 0;
        if (seen == NULL || queue == NULL) { free(funs); return; }
        seen[at] = 1;
        queue[tail] = at;
        tail += 1;
        while (head < tail) {
          size_t cur = queue[head];
          head += 1;
          for (j = 0; j < funs[cur].call_count; j += 1) {
            size_t to = funs[cur].calls[j];
            if (!seen[to]) {
              seen[to] = 1;
              queue[tail] = to;
              tail += 1;
            }
          }
        }
        for (j = 0; j < fcount; j += 1) {
          if (seen[j] && j != at) {
            zamykanie[m] = funs[j].hash;
            m += 1;
          }
        }
        reach = m + 1;
        qsort(zamykanie, m, sizeof(unsigned long long), kesh_sravnit);
        polnyy = kesh_mark(polnyy, "замыкание");
        po_derevu = kesh_mark(po_derevu, "замыкание");
        for (j = 0; j < m; j += 1) {
          polnyy = kesh_fnv(polnyy, &zamykanie[j], sizeof zamykanie[j]);
          po_derevu = kesh_fnv(po_derevu, &zamykanie[j], sizeof zamykanie[j]);
        }
        m = 0;
        for (j = 0; j < fcount; j += 1) {
          if (seen[j] && j != at) {
            zamykanie[m] = funs[j].hash_mesta;
            m += 1;
          }
        }
        qsort(zamykanie, m, sizeof(unsigned long long), kesh_sravnit);
        s_mestami = kesh_mark(s_mestami, "замыкание");
        for (j = 0; j < m; j += 1) {
          s_mestami = kesh_fnv(s_mestami, &zamykanie[j], sizeof zamykanie[j]);
        }
        free(seen);
        free(queue);
      }
      bez_zamykaniya = kesh_fnv(bez_zamykaniya, &h_otpechatok, sizeof h_otpechatok);

      fprintf(stderr, "ОБЯЗ\t%.*s\t%.*s\t%s\t%llu\t%lu\t%lu\t%016llx\t%016llx\t%016llx\t%016llx\t%016llx\n",
              (int) of_b, of, (int) nm_b, nm, sudili ? (closed[i] ? "1" : "0") : "-",
              (unsigned long long) steps[i], (unsigned long) tries[i], (unsigned long) reach,
              polnyy, naivnyy, po_derevu, s_mestami, bez_zamykaniya);
    }
    free(zamykanie);
    free(closed);
    free(steps);
    free(tries);
  }
  for (i = 0; i < fcount; i += 1) {
    free(funs[i].calls);
  }
  free(funs);
  if (kesh_chuzhih > 0) {
    fprintf(stderr, "кеш: узлов НЕ вида «Значение» под хешем %lu (хешированы целиком)\n", kesh_chuzhih);
  }
  fprintf(stderr, "кеш: %s\n", kesh_ok ? "прибор без срывов" : "ПРИБОР СОРВАЛСЯ");
}

static bool kesh_wanted(void) {
  static int wanted = -1;
  if (wanted < 0) {
    wanted = getenv("FLANG_KESH") != NULL ? 1 : 0;
  }
  return wanted != 0;
}
