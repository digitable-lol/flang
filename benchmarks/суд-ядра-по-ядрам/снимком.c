/*
 * ВТОРАЯ ЧАСТЬ ПРИБОРА: ЧТО ОСТАЛОСЬ БЫ ОТ «ЗАКРЫТЬ БЕЗ ТЕОРЕМ» НА МНОГИХ ЯДРАХ.
 *
 * «Закрыть без теорем» — неподвижная точка, и внутри одного прохода каждая
 * попытка видит то, что закрыли предыдущие («Попытка без теоремы» кормит
 * «Вердикт без теоремы» накопленным «закрытые»). Разложить ТАКОЙ проход по
 * ядрам нельзя. Но у неподвижной точки есть вторая, столь же законная форма:
 * все попытки прохода смотрят в ОДИН И ТОТ ЖЕ снимок прошлого прохода. Точка
 * та же (список закрытых только растёт, значит и вердиктов от прохода к проходу
 * не убывает), проходов может понадобиться больше, зато КАЖДЫЙ проход целиком
 * раскладывается по ядрам.
 *
 * Прибор считает эту вторую форму ОДНИМ ядром и мерит две величины: всю работу
 * (сумма попыток) и критический путь (сумма самых долгих попыток по проходам).
 * Их отношение — потолок разгона при бесконечном числе ядер, и получен он без
 * единого лишнего процесса на общей машине.
 */
static void repl_kernel_snapshot(fl_value program, fl_value without, fl_value unpaid, size_t was_closed) {
  fl_value closed = fl_list(NULL, 0);
  fl_error err;
  size_t n = (without.tag == FL_LIST) ? without.as.list.count : 0;
  size_t pass = 0;
  double sum_all = 0.0;
  double path_all = 0.0;
  err.code = NULL;
  err.message = NULL;
  if (n == 0) {
    return;
  }
  for (;;) {
    fl_value paid = fl_nothing();
    fl_value *keys = NULL;
    fl_value *grown = NULL;
    size_t was = closed.as.list.count;
    size_t k = 0;
    size_t i = 0;
    size_t added = 0;
    size_t tried = 0;
    double sum = 0.0;
    double worst = 0.0;
    if (was > 0 && fl_list_alloc(&repl_ctx, was, &keys, &err) != FL_OK) { return; }
    for (i = 0; i < was; i += 1) {
      fl_value key = fl_nothing();
      if (!val_field(closed.as.list.items[i], "ключ", &key)) { return; }
      keys[i] = key;
    }
    {
      const char *names[2];
      fl_value vals[2];
      names[0] = "доказанные";
      names[1] = "неоплаченные";
      vals[0] = fl_list(keys, was);
      vals[1] = unpaid;
      if (fl_record_new(&repl_ctx, names, vals, 2, &paid, &err) != FL_OK) { return; }
    }
    if (fl_list_alloc(&repl_ctx, n, &grown, &err) != FL_OK) { return; }
    for (i = 0; i < was; i += 1) { grown[i] = closed.as.list.items[i]; }
    k = was;
    for (i = 0; i < n; i += 1) {
      fl_value o = without.as.list.items[i];
      fl_value id = fl_nothing();
      fl_value verdict = fl_nothing();
      fl_value nothing = fl_nothing();
      fl_value two[2];
      fl_value trio[3];
      double t0 = 0.0;
      double spent = 0.0;
      bool already = false;
      size_t j = 0;
      two[0] = o;
      two[1] = repl_value_say("id");
      if (repl_call("Строка поля", two, 2, &id) != FL_OK) { return; }
      for (j = 0; j < was; j += 1) {
        fl_value old = fl_nothing();
        if (val_field(closed.as.list.items[j], "ид", &old) && fl_equal(old, id)) { already = true; break; }
      }
      if (already) { continue; }
      trio[0] = o;
      trio[1] = program;
      trio[2] = paid;
      t0 = machine_now();
      repl_call_quiet = true;
      if (repl_call("Вердикт без теоремы", trio, 3, &verdict) != FL_OK) { repl_call_quiet = false; return; }
      repl_call_quiet = false;
      spent = machine_now() - t0;
      tried += 1;
      sum += spent;
      if (spent > worst) { worst = spent; }
      if (repl_call("Это ничто", &verdict, 1, &nothing) != FL_OK) { return; }
      if (nothing.tag == FL_FLAG && nothing.as.flag) { continue; }
      {
        fl_value of = fl_nothing();
        fl_value nm = fl_nothing();
        fl_value key = fl_nothing();
        fl_value rec = fl_nothing();
        const char *names[3];
        fl_value vals[3];
        two[0] = o; two[1] = repl_value_say("of");
        if (repl_call("Строка поля", two, 2, &of) != FL_OK) { return; }
        two[0] = o; two[1] = repl_value_say("name");
        if (repl_call("Строка поля", two, 2, &nm) != FL_OK) { return; }
        two[0] = of; two[1] = nm;
        if (repl_call("Ключ факта", two, 2, &key) != FL_OK) { return; }
        names[0] = "ид"; names[1] = "ключ"; names[2] = "вердикт";
        vals[0] = id; vals[1] = key; vals[2] = verdict;
        if (fl_record_new(&repl_ctx, names, vals, 3, &rec, &err) != FL_OK) { return; }
        grown[k] = rec;
        k += 1;
        added += 1;
      }
    }
    pass += 1;
    sum_all += sum;
    path_all += worst;
    fprintf(stderr,
            "снимком: проход %lu — попыток %lu, закрылось %lu, работа %.3f с, самая долгая попытка %.3f с\n",
            (unsigned long) pass, (unsigned long) tried, (unsigned long) added, sum, worst);
    closed = fl_list(grown, k);
    if (added == 0 || pass >= 100) { break; }
  }
  fprintf(stderr,
          "снимком: ИТОГ — проходов %lu, закрыто %lu (спуском было %lu), вся работа %.3f с, "
          "критический путь %.3f с, потолок разгона %.1f крат\n",
          (unsigned long) pass, (unsigned long) closed.as.list.count, (unsigned long) was_closed,
          sum_all, path_all, path_all > 0.0 ? sum_all / path_all : 0.0);
}
