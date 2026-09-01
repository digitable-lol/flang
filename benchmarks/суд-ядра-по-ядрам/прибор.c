/* ═══════════════ ПРИБОР РАЗВЕДКИ Ч180: ДОЛИ «СУДА ЯДРА О ПРОГРАММЕ» ═══════════════
 *
 * Стадия «Суд ядра о программе» — 7 ч 33 мин из 9 ч 56 мин печати компилятора
 * самим собой, и всё это на ОДНОМ ядре из 256. Прибор ниже разбирает её на
 * названные доли и печатает по каждой секунды и шаги, а сверх того — гоняет
 * «Пройти обязательства» ДОЛЯМИ списка обязательств и сличает итог с целым.
 * Это и есть опыт на независимость: сойдётся построчно — обязательства друг от
 * друга не зависят, разойдётся — зависят, и видно где.
 *
 * Включается переменной среды FLANG_KERNEL_SPLIT=<число долей>; по умолчанию
 * молчит и не считает ничего. Ответ команды прибор НЕ меняет: «Суд ядра о
 * программе» после него зовётся как звался.
 */

static double machine_now(void);

static unsigned long split_steps = 0;

static double split_call(const char *name, const fl_value *args, size_t count, fl_value *out, bool *ok) {
  double t0 = machine_now();
  bool was_quiet = repl_call_quiet;
  repl_call_quiet = true;
  *ok = (repl_call(name, args, count, out) == FL_OK);
  repl_call_quiet = was_quiet;
  split_steps = (unsigned long) repl_ctx.steps;
  return machine_now() - t0;
}

static size_t split_shards(void) {
  const char *say = getenv("FLANG_KERNEL_SPLIT");
  long got = 0;
  if (say == NULL) {
    return 0;
  }
  got = strtol(say, NULL, 10);
  if (got < 1) {
    got = 1;
  }
  return (size_t) got;
}

static void repl_kernel_split(fl_value program, fl_value total, size_t shards) {
  fl_value spuski_field = fl_nothing();
  fl_value spuski = fl_nothing();
  fl_value svod = fl_nothing();
  fl_value obligations = fl_nothing();
  fl_value runs = fl_nothing();
  fl_value pre = fl_nothing();
  fl_value unpaid = fl_nothing();
  fl_value without = fl_nothing();
  fl_value closed = fl_nothing();
  fl_value pass = fl_nothing();
  fl_value rows = fl_nothing();
  fl_value firm = fl_nothing();
  fl_value marked = fl_nothing();
  fl_value empty_svod = fl_nothing();
  fl_value pair[2];
  fl_value quad[4];
  fl_value five[5];
  fl_error err;
  bool ok = false;
  double sec = 0.0;
  double sec_post = 0.0;
  double whole = 0.0;
  size_t i = 0;
  err.code = NULL;
  err.message = NULL;

  if (!val_field(total, "спуски", &spuski_field)) {
    fprintf(stderr, "доли: нет поля «спуски»\n");
    return;
  }
  sec = split_call("Спуски узлами", &spuski_field, 1, &spuski, &ok);
  if (!ok) { fprintf(stderr, "доли: сорвалось на «Спуски узлами»\n"); return; }
  fprintf(stderr, "доли: «Спуски узлами» %.3f с, шагов %lu\n", sec, split_steps);

  pair[0] = program;
  pair[1] = spuski;
  sec = split_call("Обязательства", pair, 2, &svod, &ok);
  if (!ok) { fprintf(stderr, "доли: сорвалось на «Обязательства»\n"); return; }
  fprintf(stderr, "доли: «Обязательства» %.3f с, шагов %lu\n", sec, split_steps);

  pair[0] = svod;
  pair[1] = repl_value_say("obligations");
  sec = split_call("Элементы поля", pair, 2, &obligations, &ok);
  if (!ok || obligations.tag != FL_LIST) { fprintf(stderr, "доли: сорвалось на «Элементы поля»\n"); return; }
  fprintf(stderr, "доли: обязательств %lu\n", (unsigned long) obligations.as.list.count);

  pair[0] = program;
  pair[1] = obligations;
  sec = split_call("Прогоны для ядра", pair, 2, &runs, &ok);
  if (!ok) { fprintf(stderr, "доли: сорвалось на «Прогоны для ядра»\n"); return; }
  fprintf(stderr, "доли: «Прогоны для ядра» %.3f с, шагов %lu\n", sec, split_steps);

  sec = split_call("Снять предусловия", &program, 1, &pre, &ok);
  if (!ok) { fprintf(stderr, "доли: сорвалось на «Снять предусловия»\n"); return; }
  fprintf(stderr, "доли: «Снять предусловия» %.3f с, шагов %lu\n", sec, split_steps);
  if (!val_field(pre, "неоплаченные", &unpaid)) { fprintf(stderr, "доли: нет «неоплаченные»\n"); return; }

  /* Отбор обязательств без теоремы — тот же, что в «Проверить доказательства». */
  {
    fl_value *items = NULL;
    size_t n = obligations.as.list.count;
    size_t m = 0;
    double t0 = machine_now();
    if (n > 0 && fl_list_alloc(&repl_ctx, n, &items, &err) != FL_OK) { fprintf(stderr, "доли: нет места под отбор\n"); return; }
    for (i = 0; i < n; i += 1) {
      fl_value kind = fl_nothing();
      fl_value proof = fl_nothing();
      fl_value nothing = fl_nothing();
      const char *utf8 = NULL;
      size_t bytes = 0;
      pair[0] = obligations.as.list.items[i];
      pair[1] = repl_value_say("kind");
      if (repl_call("Строка поля", pair, 2, &kind) != FL_OK) { return; }
      if (!val_text(kind, &utf8, &bytes) || bytes != strlen("postcondition") ||
          memcmp(utf8, "postcondition", bytes) != 0) {
        continue;
      }
      pair[0] = obligations.as.list.items[i];
      pair[1] = repl_value_say("proof");
      if (repl_call("Взять поле", pair, 2, &proof) != FL_OK) { return; }
      if (repl_call("Это ничто", &proof, 1, &nothing) != FL_OK) { return; }
      if (nothing.tag == FL_FLAG && nothing.as.flag) {
        items[m] = obligations.as.list.items[i];
        m += 1;
      }
    }
    without = fl_list(items, m);
    fprintf(stderr, "доли: отбор «без теоремы» %.3f с, их %lu\n", machine_now() - t0, (unsigned long) m);
  }

  quad[0] = without;
  quad[1] = fl_list(NULL, 0);
  quad[2] = program;
  quad[3] = unpaid;
  sec = split_call("Закрыть без теорем", quad, 4, &closed, &ok);
  if (!ok) { fprintf(stderr, "доли: сорвалось на «Закрыть без теорем»\n"); return; }
  fprintf(stderr, "доли: «Закрыть без теорем» %.3f с, шагов %lu, закрыто %lu\n", sec, split_steps,
          closed.tag == FL_LIST ? (unsigned long) closed.as.list.count : 0UL);

  {
    const char *names[2];
    fl_value vals[2];
    names[0] = "строки";
    names[1] = "диагностика";
    vals[0] = fl_list(NULL, 0);
    vals[1] = fl_list(NULL, 0);
    if (fl_record_new(&repl_ctx, names, vals, 2, &empty_svod, &err) != FL_OK) {
      fprintf(stderr, "доли: не собрался пустой «Свод проверки»\n");
      return;
    }
  }

  five[0] = obligations;
  five[1] = empty_svod;
  five[2] = program;
  five[3] = runs;
  five[4] = closed;
  whole = split_call("Пройти обязательства", five, 5, &pass, &ok);
  if (!ok) { fprintf(stderr, "доли: сорвалось на «Пройти обязательства»\n"); return; }
  if (!val_field(pass, "строки", &rows)) { fprintf(stderr, "доли: нет «строки»\n"); return; }
  fprintf(stderr, "доли: «Пройти обязательства» ЦЕЛИКОМ %.3f с, шагов %lu, строк %lu\n", whole, split_steps,
          (unsigned long) rows.as.list.count);

  pair[0] = rows;
  pair[1] = fl_list(NULL, 0);
  sec = split_call("Твёрдые ключи", pair, 2, &firm, &ok);
  if (!ok) { fprintf(stderr, "доли: сорвалось на «Твёрдые ключи»\n"); return; }
  sec_post = sec;
  pair[0] = rows;
  pair[1] = firm;
  sec = split_call("Пометить условные", pair, 2, &marked, &ok);
  if (!ok) { fprintf(stderr, "доли: сорвалось на «Пометить условные»\n"); return; }
  fprintf(stderr, "доли: послепроход («Твёрдые ключи»+«Пометить условные») %.3f с\n", sec_post + sec);

  if (shards > 1 && obligations.as.list.count > 0) {
    size_t n = obligations.as.list.count;
    size_t got = 0;
    size_t same = 0;
    double sum = 0.0;
    double worst = 0.0;
    for (i = 0; i < shards; i += 1) {
      size_t from = n * i / shards;
      size_t to = n * (i + 1) / shards;
      fl_value part = fl_list(obligations.as.list.items + from, to - from);
      fl_value out = fl_nothing();
      fl_value prows = fl_nothing();
      double spent = 0.0;
      size_t k = 0;
      five[0] = part;
      five[1] = empty_svod;
      five[2] = program;
      five[3] = runs;
      five[4] = closed;
      spent = split_call("Пройти обязательства", five, 5, &out, &ok);
      if (!ok) { fprintf(stderr, "доли: сорвалось на доле %lu\n", (unsigned long) i); return; }
      if (!val_field(out, "строки", &prows) || prows.tag != FL_LIST) { return; }
      for (k = 0; k < prows.as.list.count; k += 1) {
        if (got + k < rows.as.list.count && fl_equal(prows.as.list.items[k], rows.as.list.items[got + k])) {
          same += 1;
        }
      }
      got += prows.as.list.count;
      sum += spent;
      if (spent > worst) { worst = spent; }
      fprintf(stderr, "доли: доля %lu из %lu — обязательств %lu, %.3f с, шагов %lu, строк %lu\n",
              (unsigned long) (i + 1), (unsigned long) shards, (unsigned long) (to - from), spent,
              split_steps, (unsigned long) prows.as.list.count);
    }
    fprintf(stderr,
            "доли: ИТОГ долей — сумма %.3f с (целиком %.3f с), самая долгая %.3f с, "
            "строк %lu из %lu, совпало построчно %lu\n",
            sum, whole, worst, (unsigned long) got, (unsigned long) rows.as.list.count,
            (unsigned long) same);
  }
}
