/* ═══════ ПРИБОР Ч183: КЛЮЧ КЕША ДОКАЗАННОГО И ЦЕНА ОДНОГО ОБЯЗАТЕЛЬСТВА ═══════
 *
 * Кеша доказанного в дереве нет ни строки, и прибор его НЕ пишет. Он отвечает на
 * два вопроса, без которых кеш писать нельзя:
 *
 *   1. СКОЛЬКО СТОИТ ОДНО ОБЯЗАТЕЛЬСТВО. Неподвижная точка «Закрыть без теорем»
 *      (flang/self/proofterm.flang:3232) повторена здесь по-обязательственно:
 *      каждая попытка зовётся отдельным `repl_call`, а `repl_ctx.steps` после
 *      него — цена ИМЕННО этой попытки (счётчик обнуляется на каждом вызове,
 *      bootstrap/flang_repl.c:1466). Итог сличается с целым: список закрытых
 *      обязан совпасть по длине с тем, что даёт «Закрыть без теорем» целиком.
 *
 *   2. КАКОВ КЛЮЧ. Считаются ДВА ключа на каждое обязательство:
 *        • «полный» — само обязательство, тело своей функции, тела и подписи
 *          ВСЕХ вызванных по замыканию вызовов, объявления типов, объявления
 *          законов, список неоплаченных предусловий и отпечаток ядра;
 *        • «наивный» — только само обязательство и своя функция.
 *      Наивный считается не для дела, а для пробы на промах: он показывает,
 *      какой именно кеш отдал бы «доказано» на то, что уже не доказано.
 *
 * Ключ ядра приезжает переменной среды FLANG_KESH_KERNEL (любая строка;
 * снаружи туда кладётся sha256 четырёх файлов ядра) — ядро правится в
 * `flang/self`, а прибор живёт в семени и своих исходников не видит.
 *
 * Включается FLANG_KESH=1; по умолчанию молчит и не считает ничего. Ответ
 * команды прибор НЕ меняет: «Суд ядра о программе» после него зовётся как звался.
 */

static double machine_now(void);

/* ── хеш ─────────────────────────────────────────────────────────────────────
 * FNV-1a 64. Не криптография: сличаются свои же прогоны, подделывать ключ
 * некому. Криптостойкий хеш в настоящем кеше обязателен — здесь он лишь удлинил
 * бы прибор.
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

static bool kesh_ok = true;
static unsigned long kesh_last_steps = 0;

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

/* Хеш ПЕЧАТИ значения: печать — единственный способ увидеть узел целиком,
 * побайтово и в устойчивом порядке полей (flang/self/obligations.flang зовёт её
 * ровно затем же). */
static unsigned long long kesh_hash_node(unsigned long long h, fl_value node) {
  fl_value printed = fl_nothing();
  const char *utf8 = NULL;
  size_t bytes = 0;
  if (!kesh_call("Печать значения", &node, 1, &printed)) {
    return h;
  }
  if (!val_text(printed, &utf8, &bytes)) {
    kesh_ok = false;
    fprintf(stderr, "кеш: «Печать значения» отдала не строку\n");
    return h;
  }
  return kesh_fnv(h, utf8, bytes);
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

/* Одна функция программы: имя, хеш всего узла и рёбра вызовов. */
typedef struct {
  const char *name;
  size_t name_bytes;
  unsigned long long hash;
  size_t *calls;
  size_t call_count;
} kesh_fun;

static size_t kesh_fun_by_name(const kesh_fun *funs, size_t count, const char *name, size_t bytes) {
  size_t i = count;
  /* ПОСЛЕДНЯЯ ОДНОИМЁННАЯ, а не первая — тем же правилом, что «Функция терма по
     имени» (flang/self/proofterm.flang:227). */
  while (i > 0) {
    i -= 1;
    if (funs[i].name_bytes == bytes && memcmp(funs[i].name, name, bytes) == 0) {
      return i;
    }
  }
  return (size_t) -1;
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
  unsigned long long h_global = KESH_SEED;
  double t0 = 0.0;
  const char *kernel_say = getenv("FLANG_KESH_KERNEL");

  err.code = NULL;
  err.message = NULL;

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

  /* ── ГЛОБАЛЬНЫЕ СЛАГАЕМЫЕ КЛЮЧА ─────────────────────────────────────────────
   * Каждое названо местом в коде, откуда ядро его читает.
   *   • типы          — «Сумма по имени» (proofterm.flang:232), принцип индукции
   *                     порождается по объявлению суммы (proof-initial.flang);
   *   • законы        — «Есть закон» (proofterm.flang:251–270);
   *   • неоплаченные  — «Снять предусловия» (proofterm.flang:3614), читается
   *                     каждым правилом через «Оплаченное»;
   *   • отпечаток ядра — самих правил: «Версия ядра» (proofterm.flang:102) на
   *                     это не годится, там версия ФОРМАТА термов, а не правил.
   */
  {
    static const char *const global_fields[5] = { "types", "monoids", "monads", "isomorphisms", "embeddings" };
    fl_value got = fl_nothing();
    for (i = 0; i < 5; i += 1) {
      if (!kesh_field(program, global_fields[i], &got)) { return; }
      h_global = kesh_hash_node(h_global, got);
    }
  }
  if (unpaid.tag == FL_LIST) {
    for (i = 0; i < unpaid.as.list.count; i += 1) {
      const char *utf8 = NULL;
      size_t bytes = 0;
      if (val_text(unpaid.as.list.items[i], &utf8, &bytes)) {
        h_global = kesh_fnv(h_global, utf8, bytes);
      }
    }
    fprintf(stderr, "кеш: неоплаченных предусловий %lu\n", (unsigned long) unpaid.as.list.count);
  }
  if (kernel_say != NULL) {
    h_global = kesh_fnv(h_global, kernel_say, strlen(kernel_say));
  } else {
    fprintf(stderr, "кеш: FLANG_KESH_KERNEL не задан — отпечаток ядра в ключ НЕ вошёл\n");
  }
  fprintf(stderr, "кеш: общая часть ключа %016llx\n", h_global);

  /* ── функции программы: хеш узла и рёбра вызовов ─────────────────────────── */
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
    /* ВЕСЬ узел функции: тело, параметры, постусловия, предусловия. Тело читает
       развёртка вызова («Развернуть телом», proof-kernel.flang:2019), подписи и
       постусловия — факты по вызову (proofterm.flang:2543). */
    funs[i].hash = kesh_hash_node(KESH_SEED, f);
  }
  for (i = 0; i < fcount; i += 1) {
    fl_value body = fl_nothing();
    fl_value calls = fl_nothing();
    size_t n = 0;
    if (!kesh_field(functions.as.list.items[i], "body", &body)) { free(funs); return; }
    if (!kesh_call("Вызовы в узле предусловий", &body, 1, &calls)) { free(funs); return; }
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
      if (at == (size_t) -1) { continue; }
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

  /* ── ЦЕЛОЕ: «Закрыть без теорем» как есть — для сличения с по-обязательственным ── */
  quad[0] = without;
  quad[1] = fl_list(NULL, 0);
  quad[2] = program;
  quad[3] = unpaid;
  t0 = machine_now();
  if (!kesh_call("Закрыть без теорем", quad, 4, &whole_closed)) { free(funs); return; }
  fprintf(stderr, "кеш: «Закрыть без теорем» ЦЕЛИКОМ %.3f с, шагов %lu, закрыто %lu\n",
          machine_now() - t0, kesh_last_steps,
          whole_closed.tag == FL_LIST ? (unsigned long) whole_closed.as.list.count : 0UL);

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
    fl_value *keys = NULL;   /* ключи фактов закрытых — «доказанные» */
    size_t keys_count = 0;
    size_t closed_count = 0;
    size_t pass = 0;
    unsigned long long all_steps = 0;
    double spent = 0.0;
    if (closed == NULL || steps == NULL || tries == NULL) { free(funs); return; }
    if (n > 0 && fl_list_alloc(&repl_ctx, n, &keys, &err) != FL_OK) { free(funs); return; }
    t0 = machine_now();
    for (;;) {
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
    fprintf(stderr, "кеш: по-обязательственно %.3f с, шагов %llu, закрыто %lu, проходов %lu\n",
            spent, all_steps, (unsigned long) closed_count, (unsigned long) pass);

    /* ── ЧТО СБЕРЁГ БЫ КЕШ НА ПОВТОРНОМ ПРОГОНЕ ТОГО ЖЕ ДЕРЕВА ─────────────────
     *
     * Кеша здесь нет и не пишется. Считается ОДНО число: во сколько шагов
     * обойдётся та же неподвижная точка, если приговоры «доказано» уже известны
     * и попытка по ним не делается. Это верхняя граница выгоды кеша, хранящего
     * ТОЛЬКО доказанное, — ровно то, о чём спросил владелец. Кеш, хранящий и
     * отказы, стоил бы ноль попыток и ноль шагов, и мерить там нечего.
     *
     * Отказы переспрашиваются, потому что вердикта у них нет: «Учесть попытку»
     * (proofterm.flang:3277) кладёт в «закрытые» только непустой вердикт.
     */
    {
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
      unsigned long long full = h_global;
      unsigned long long naive = KESH_SEED;
      unsigned long long h_obl = kesh_hash_node(KESH_SEED, without.as.list.items[i]);
      size_t reach = 0;
      if (!kesh_text_field(without.as.list.items[i], "of", &of, &of_b)) { free(funs); return; }
      if (!kesh_text_field(without.as.list.items[i], "name", &nm, &nm_b)) { free(funs); return; }
      at = kesh_fun_by_name(funs, fcount, of, of_b);
      naive = kesh_fnv(naive, &h_obl, sizeof(h_obl));
      full = kesh_fnv(full, &h_obl, sizeof(h_obl));
      if (at != (size_t) -1) {
        unsigned char *seen = (unsigned char *) calloc(fcount == 0 ? 1 : fcount, 1);
        size_t *queue = (size_t *) calloc(fcount == 0 ? 1 : fcount, sizeof(size_t));
        size_t head = 0;
        size_t tail = 0;
        if (seen == NULL || queue == NULL) { free(funs); return; }
        naive = kesh_fnv(naive, &funs[at].hash, sizeof(funs[at].hash));
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
        /* ЗАМЫКАНИЕ ПО ИНДЕКСУ, а не по порядку обхода: порядок обхода зависит
           от порядка объявлений, и ключ от него зависеть не должен. */
        for (j = 0; j < fcount; j += 1) {
          if (seen[j]) {
            full = kesh_fnv(full, &funs[j].hash, sizeof(funs[j].hash));
            reach += 1;
          }
        }
        free(seen);
        free(queue);
      }
      fprintf(stderr, "ОБЯЗ\t%.*s\t%.*s\t%d\t%llu\t%lu\t%lu\t%016llx\t%016llx\n",
              (int) of_b, of, (int) nm_b, nm, closed[i] ? 1 : 0,
              (unsigned long long) steps[i], (unsigned long) tries[i], (unsigned long) reach,
              full, naive);
    }
    free(closed);
    free(steps);
    free(tries);
  }
  for (i = 0; i < fcount; i += 1) {
    free(funs[i].calls);
  }
  free(funs);
  fprintf(stderr, "кеш: %s\n", kesh_ok ? "прибор без срывов" : "ПРИБОР СОРВАЛСЯ");
}

static bool kesh_wanted(void) {
  static int wanted = -1;
  if (wanted < 0) {
    wanted = getenv("FLANG_KESH") != NULL ? 1 : 0;
  }
  return wanted != 0;
}
