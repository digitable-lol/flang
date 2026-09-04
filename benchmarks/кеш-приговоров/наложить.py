#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Наложить кеш приговоров ядра. Одна правка на два дерева: v0.6.2 и ствол.

    python3 benchmarks/кеш-приговоров/наложить.py [<корень дерева>]

Идемпотентна: второй запуск на том же дереве скажет «уже» и ничего не тронет.

── ПОЧЕМУ ДВА ШВА, А НЕ ОДИН ────────────────────────────────────────────────
На `v0.6.2` рантайм зовёт ядро ОДНИМ вызовом «Суд ядра о программе»; на стволе
тот же вызов разбит на пять («Спуски узлами», «Обязательства», «Элементы поля»,
«Прогоны для ядра», «Проверить доказательства»), и кеш вешается прямо на
последний. Ядро (`proofterm.flang`) у обоих одно и то же — разные только два
шва в `flang_repl.c` и, на 0.6.2, обёртка в `compiler.flang`.

Правит три файла:
  flang/self/proofterm.flang            ключ и неподвижная точка через кеш
  flang/self/bootstrap/compiler.flang   только на 0.6.2: кеш наружу через «Суд ядра»
  flang/src/emit/c/flang_repl.c         хранилище: файл, отпечаток проверяльщика
"""
import io
import os
import sys

ZDES = os.path.dirname(os.path.abspath(__file__))
KOREN = sys.argv[1] if len(sys.argv) > 1 else os.path.abspath(os.path.join(ZDES, "..", ".."))
KUSOK = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ZDES, "кеш.вставка")


def chitat(put):
    with io.open(put, encoding="utf-8") as f:
        return f.read()


def pisat(put, text):
    with io.open(put, "w", encoding="utf-8") as f:
        f.write(text)


def zamena(text, pary, imya, objazatelno=True):
    """pary — список (было, стало); берётся первая пара, чей «было» нашёлся ровно раз."""
    for bylo, stalo in pary:
        if stalo in text:
            print("  уже: %s" % imya)
            return text
    for bylo, stalo in pary:
        if text.count(bylo) == 1:
            print("  правлю: %s" % imya)
            return text.replace(bylo, stalo)
    if not objazatelno:
        print("  нет в этом дереве: %s" % imya)
        return text
    raise SystemExit("НЕ НАЙДЕНО (или не одно): %s" % imya)


# ── 1. proofterm.flang: ядро. Общее для обоих деревьев ──────────────────────
pt = os.path.join(KOREN, "flang/self/proofterm.flang")
t = chitat(pt)

t = zamena(t, [("  использует «Обязательства программы»\n",
                "  использует «Обязательства программы»\n  использует «Запись доказательства»\n")],
           "ввоз «Запись доказательства»")

yakor = "// ЗАКРЫТЫЕ БЕЗ ТЕОРЕМЫ ИДУТ НЕПОДВИЖНОЙ ТОЧКОЙ, и это не оптимизация, а то, чем"
if "функция «Спросить кеш»" not in t:
    print("  правлю: тело кеша")
    if t.count(yakor) != 1:
        raise SystemExit("якорь неподвижной точки не один: %d" % t.count(yakor))
    t = t.replace(yakor, chitat(KUSOK) + "\n" + yakor)
else:
    print("  уже: тело кеша")

t = zamena(t, [("""функция «Проверить доказательства»
  принимает «программа»: «Значение», «обязательства»: список «Значение», «прогоны»: список «Значение»
  возвращает «Значение»
""",
                """// БЕЗ КЕША ЭТО ПРЕЖНЯЯ ФУНКЦИЯ БАЙТ В БАЙТ: пустой отпечаток проверяльщика
// выключает кеш целиком, и тогда зовётся та же «Закрыть без теорем», что и до
// этой работы. Так у кеша есть выключатель, а у сверки со свидетелем — прежний
// вход.
функция «Проверить доказательства»
  принимает «программа»: «Значение», «обязательства»: список «Значение», «прогоны»: список «Значение»
  возвращает «Значение»
  («Проверить доказательства с кешем» от «программа» и «обязательства» и «прогоны» и («Узел ничто») и "").«узел»

// Кеш ВЫКЛЮЧЕН, пока отпечаток проверяльщика пуст. Считать основу ключа
// (отпечаток всех функций, типов и законов программы) стоит один проход по
// программе, и платить его там, где кеша нет, незачем.
функция «Ход кеша или без»
  принимает «без теоремы»: список «Значение», «программа»: «Значение», «неоплаченные»: список строки, «кеш»: «Значение», «отпечаток»: строка
  возвращает «Ход без теорем»
  если «отпечаток» равен ""
    то запись «Ход без теорем» с «закрытые» равным («Закрыть без теорем» от «без теоремы» и пустой список и «программа» и «неоплаченные») и «новые» равным пустой список
    иначе «Закрыть без теорем кешем» от «без теоремы» и (запись «Ход без теорем» с «закрытые» равным пустой список и «новые» равным пустой список) и «программа» и «неоплаченные» и («Основа кеша» от «программа» и «неоплаченные» и «отпечаток») и «кеш»

функция «Проверить доказательства с кешем»
  принимает «программа»: «Значение», «обязательства»: список «Значение», «прогоны»: список «Значение», «кеш»: «Значение», «отпечаток»: строка
  возвращает «Итог с кешем»
""")], "«Проверить доказательства» → обёртка")

t = zamena(t, [("  пусть «закрытые» равно («Закрыть без теорем» от «без теоремы» и пустой список и «программа» и («предусловия».«неоплаченные»))\n",
                "  пусть «ход» равно («Ход кеша или без» от «без теоремы» и «программа» и («предусловия».«неоплаченные») и «кеш» и «отпечаток»)\n"
                "  пусть «закрытые» равно («ход».«закрытые»)\n")],
           "закрытые из хода")

KESH_NARUZHU = " и «кеш» равным (если «отпечаток» равен \"\" то («Узел ничто») иначе («Кеш с новыми» от «кеш» и («ход».«новые»)))\n"
for hvost in ["(добавить «поле preconditions» к (добавить «поле diagnostics» к (добавить «поле checked» к (добавить «поле version» к пустой список))))",
              "(добавить «поле conditional» к (добавить «поле preconditions» к (добавить «поле diagnostics» к (добавить «поле checked» к (добавить «поле version» к пустой список)))))"]:
    bylo = "  «Запись как узел» от %s\n" % hvost
    stalo = "  запись «Итог с кешем» с «узел» равным («Запись как узел» от %s)%s" % (hvost, KESH_NARUZHU)
    if stalo in t or t.count(bylo) == 1:
        t = zamena(t, [(bylo, stalo)], "итог с кешем наружу")
        break
else:
    raise SystemExit("хвост «Проверить доказательства» не узнан")
pisat(pt, t)

# ── 2. compiler.flang: только там, где рантайм зовёт «Суд ядра о программе» ──
cf = os.path.join(KOREN, "flang/self/bootstrap/compiler.flang")
t = chitat(cf)
odin_vyzov = 'repl_call("Суд ядра о программе"' in chitat(os.path.join(KOREN, "flang/src/emit/c/flang_repl.c"))
if odin_vyzov:
    t = zamena(t, [("""объект «Суд ядра»
  «диагностики»: список «Беда»
  «снятые»: список «Значение»
""",
                    """объект «Суд ядра»
  «диагностики»: список «Беда»
  «снятые»: список «Значение»
  «кеш»: «Значение»
""")], "объект «Суд ядра» несёт кеш")
    t = zamena(t, [("  («Суд ядра о программе» от «программа» и «тотальность»).«диагностики»\n",
                    "  («Суд ядра о программе» от «программа» и «тотальность» и («Узел ничто») и \"\").«диагностики»\n")],
               "«Беды ядра» без кеша")
    t = zamena(t, [("""функция «Суд ядра о программе»
  принимает «программа»: «Значение», «тотальность»: «Итог тотальности»
  возвращает «Суд ядра»
  пусть «свод» равно («Обязательства» от «программа» и («Спуски узлами» от («тотальность».«спуски»)))
  пусть «вердикты» равно («Проверить доказательства» от «программа» и («Элементы поля» от «свод» и "obligations") и («Прогоны для ядра» от «программа»))
  запись «Суд ядра» с «диагностики» равным («Слить беды» от («Беды узлами» от («Элементы поля» от «свод» и "diagnostics")) и («Беды узлами» от («Элементы поля» от «вердикты» и "diagnostics"))) и «снятые» равным («Снимаемые постусловия» от («Элементы поля» от «свод» и "obligations") и («Элементы поля» от «вердикты» и "checked"))
""",
                    """функция «Суд ядра о программе»
  принимает «программа»: «Значение», «тотальность»: «Итог тотальности», «кеш»: «Значение», «отпечаток»: строка
  возвращает «Суд ядра»
  пусть «свод» равно («Обязательства» от «программа» и («Спуски узлами» от («тотальность».«спуски»)))
  пусть «итог» равно («Проверить доказательства с кешем» от «программа» и («Элементы поля» от «свод» и "obligations") и («Прогоны для ядра» от «программа») и «кеш» и «отпечаток»)
  пусть «вердикты» равно («итог».«узел»)
  запись «Суд ядра» с «диагностики» равным («Слить беды» от («Беды узлами» от («Элементы поля» от «свод» и "diagnostics")) и («Беды узлами» от («Элементы поля» от «вердикты» и "diagnostics"))) и «снятые» равным («Снимаемые постусловия» от («Элементы поля» от «свод» и "obligations") и («Элементы поля» от «вердикты» и "checked")) и «кеш» равным («итог».«кеш»)
""")], "«Суд ядра о программе» с кешем")
    pisat(cf, t)
else:
    print("  на стволе «Суд ядра о программе» разбит на пять вызовов — compiler.flang не трогаю")

# ── 3. flang_repl.c: склад ──────────────────────────────────────────────────
rc = os.path.join(KOREN, "flang/src/emit/c/flang_repl.c")
t = chitat(rc)

sklad = r'''/*
 * ═════════════════ КЕШ ПРИГОВОРОВ ЯДРА: ТОЛЬКО СКЛАД ══════════════════════
 *
 * ПРАВИЛО, ПО КОТОРОМУ РЕШАЮТ «ДОКАЗАНО», ОСТАЛОСЬ В ЯДРЕ. Здесь ровно склад:
 * прочитать файл, отдать его ядру ДАННЫМИ, забрать обновлённый и записать
 * обратно. Ключ считает ядро («Ключ кеша» в `flang/self/proofterm.flang`), и
 * рантайм его не видит ни разу — иначе правило доверия уехало бы из слоя, вся
 * ценность которого в недоверии.
 *
 * ОТПЕЧАТОК ПРОВЕРЯЛЬЩИКА — sha256 САМОГО ДВОИЧНОГО, а не исходников дерева, и
 * это замер, а не осторожность. Два двоичных на побайтово одном дереве, в семени
 * переписано одно правило («Предел ветвления» с 4 на 0): 49 приговоров из 103
 * сменились с «доказано» на «не доказано», а всё, что видно из дерева, включая
 * «Версию ядра», осталось прежним. Кеш с ключом по дереву отдал бы 49 ложных
 * доказательств.
 *
 * СЕБЯ НЕ ПРОЧИТАЛИ — КЕШ ВЫКЛЮЧЕН, а не включён с ослабленным ключом.
 * Ослабленный ключ раздаёт ложные доказательства молча, и молчание здесь хуже
 * отказа.
 */
#define KESH_PEREMENNAYA "FLANG_KESH_PRIGOVOROV"

static char *kesh_stamp_read(void) {
  size_t bytes = 0;
  char *body = NULL;
  char *out = NULL;
  sha256_ctx ctx;
  if (repl_self_kept == NULL || repl_self_kept[0] == '\0') {
    return NULL;
  }
  body = repl_read_file(repl_self_kept, &bytes);
  if (body == NULL) {
    return NULL;
  }
  out = (char *)malloc(65);
  if (out == NULL) {
    free(body);
    return NULL;
  }
  sha256_init(&ctx);
  sha256_add(&ctx, "flang-kesh-1 ", 13);
  sha256_add(&ctx, body, bytes);
  sha256_hex(&ctx, out);
  free(body);
  return out;
}

'''

t = zamena(t, [("static bool repl_check_sources(fl_value sources, const char *entry, repl_bads *bads, fl_value *program,",
                sklad + "static bool repl_check_sources(fl_value sources, const char *entry, repl_bads *bads, fl_value *program,")],
           "склад кеша в рантайме")

t = zamena(t, [("""  if (status != FL_OK) {
    repl_call_keep(error.code == NULL ? "FLANG_INTERNAL" : error.code,
""",
                """  /*
   * ВИТКИ ПО ШАГАМ — под переменной среды, а не всегда. Вопрос «где сидит
   * время» задаётся не каждый прогон, а лишняя строка на каждый вызов сломала
   * бы разбор вывода тем, кто читает бинарник трубой.
   */
  if (!repl_call_quiet && getenv("FLANG_VITKI") != NULL) {
    fprintf(stderr, "витки: %s %lu\\n", name, (unsigned long)repl_ctx.steps);
  }
  if (status != FL_OK) {
    repl_call_keep(error.code == NULL ? "FLANG_INTERNAL" : error.code,
""")], "витки по шагам")

# ── шов A: 0.6.2, один вызов «Суд ядра о программе» ─────────────────────────
t = zamena(t, [("""  if (kernel) {
    fl_value kernel_args[2];
    fl_value verdict = fl_nothing();
    fl_value kernel_bads = fl_nothing();
    kernel_args[0] = *program;
    kernel_args[1] = total;
""",
                """  if (kernel) {
    fl_value kernel_args[4];
    fl_value verdict = fl_nothing();
    fl_value kernel_bads = fl_nothing();
    fl_value kesh = fl_nothing();
    const char *kesh_put = getenv(KESH_PEREMENNAYA);
    char *kesh_stamp = (kesh_put == NULL || kesh_put[0] == '\\0') ? NULL : kesh_stamp_read();
    if (kesh_stamp != NULL) {
      size_t kesh_bytes = 0;
      char *kesh_text = repl_read_file(kesh_put, &kesh_bytes);
      if (kesh_text != NULL) {
        size_t kesh_where = 0;
        if (!facts_json(kesh_text, &kesh_where, &kesh)) {
          kesh = fl_nothing();
        }
        free(kesh_text);
      }
    }
    kernel_args[0] = *program;
    kernel_args[1] = total;
    kernel_args[2] = kesh;
    kernel_args[3] = repl_value_say(kesh_stamp == NULL ? "" : kesh_stamp);
""")], "шов 0.6.2: чтение кеша перед судом", objazatelno=False)

t = zamena(t, [("""    if (repl_call("Суд ядра о программе", kernel_args, 2, &verdict) != FL_OK) {
      bads_say(bads, "ядро доказательства прекращено");
      return false;
    }
""",
                """    if (repl_call("Суд ядра о программе", kernel_args, 4, &verdict) != FL_OK) {
      free(kesh_stamp);
      bads_say(bads, "ядро доказательства прекращено");
      return false;
    }
    /*
     * ЗАПИСЬ ИДЁТ ДАЖЕ ТОГДА, КОГДА ПРОГРАММА ОТВЕРГНУТА: приговор «не
     * доказано» стоит тех же шагов, что «доказано», и переспрашивают его каждым
     * проходом. Замер Ч183: на не закрытых обязательствах уходит 76–81 % шагов
     * стадии. Кеш только доказанного сберегает 59–62 %, кеш приговоров — всё.
     */
    if (kesh_stamp != NULL) {
      fl_value novyy = fl_nothing();
      fl_value printed = fl_nothing();
      const char *kesh_utf8 = NULL;
      size_t kesh_printed = 0;
      if (val_field(verdict, "кеш", &novyy) && repl_call("Печать значения", &novyy, 1, &printed) == FL_OK
          && val_text(printed, &kesh_utf8, &kesh_printed)) {
        FILE *kesh_stream = fopen(kesh_put, "wb");
        if (kesh_stream != NULL) {
          fwrite(kesh_utf8, 1, kesh_printed, kesh_stream);
          fclose(kesh_stream);
        }
      }
    }
    free(kesh_stamp);
""")], "шов 0.6.2: вызов на четырёх доводах и запись", objazatelno=False)

# ── шов Б: ствол, «Проверить доказательства» зовётся прямо ──────────────────
t = zamena(t, [("    fl_value triple[3];\n", "    fl_value triple[5];\n")],
           "шов ствола: место под два лишних довода", objazatelno=False)

t = zamena(t, [("""    triple[0] = *program;
    triple[1] = obligations;
    triple[2] = runs;
    if (repl_call_within("Проверить доказательства", triple, 3, &verified) != FL_OK) {
      bads_say(bads, "ядро доказательства прекращено");
      return false;
    }
""",
                """    {
      const char *kesh_put = getenv(KESH_PEREMENNAYA);
      char *kesh_stamp = (kesh_put == NULL || kesh_put[0] == '\\0') ? NULL : kesh_stamp_read();
      fl_value kesh_itog = fl_nothing();
      fl_value kesh_novyy = fl_nothing();
      fl_value kesh = fl_nothing();
      triple[0] = *program;
      triple[1] = obligations;
      triple[2] = runs;
      if (kesh_stamp != NULL) {
        size_t kesh_bytes = 0;
        char *kesh_text = repl_read_file(kesh_put, &kesh_bytes);
        if (kesh_text != NULL) {
          size_t kesh_where = 0;
          if (!facts_json(kesh_text, &kesh_where, &kesh)) {
            kesh = fl_nothing();
          }
          free(kesh_text);
        }
      }
      triple[3] = kesh;
      triple[4] = repl_value_say(kesh_stamp == NULL ? "" : kesh_stamp);
      if (repl_call_within("Проверить доказательства с кешем", triple, 5, &kesh_itog) != FL_OK
          || !val_field(kesh_itog, "узел", &verified)) {
        free(kesh_stamp);
        bads_say(bads, "ядро доказательства прекращено");
        return false;
      }
      /*
       * ЗАПИСЬ ИДЁТ ДАЖЕ ТОГДА, КОГДА ПРОГРАММА ОТВЕРГНУТА: приговор «не
       * доказано» стоит тех же шагов, что «доказано», и переспрашивают его
       * каждым проходом. Замер Ч183: на не закрытых обязательствах уходит
       * 76–81 % шагов стадии.
       */
      if (kesh_stamp != NULL && val_field(kesh_itog, "кеш", &kesh_novyy)) {
        fl_value printed = fl_nothing();
        const char *kesh_utf8 = NULL;
        size_t kesh_printed = 0;
        if (repl_call("Печать значения", &kesh_novyy, 1, &printed) == FL_OK
            && val_text(printed, &kesh_utf8, &kesh_printed)) {
          FILE *kesh_stream = fopen(kesh_put, "wb");
          if (kesh_stream != NULL) {
            fwrite(kesh_utf8, 1, kesh_printed, kesh_stream);
            fclose(kesh_stream);
          }
        }
      }
      free(kesh_stamp);
    }
""")], "шов ствола: «Проверить доказательства с кешем»", objazatelno=False)

pisat(rc, t)
print("наложено")
