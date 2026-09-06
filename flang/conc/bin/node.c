/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/*
 * ПОЛНЫЙ УЗЕЛ на цели c: таблица процессов, планировщик и связь.
 *
 * ── Из чего он собран ───────────────────────────────────────────────────────
 *
 * Ни одного решения в этом файле нет. Все три части решают напечатанные модули:
 *
 *   1. связь        flang/conc/link.flang          — 11 событий, 8 велений
 *   2. процессы     flang/conc/scheduler.flang — 7 событий, 6 велений
 *   3. программа    flang/conc/examples/distributed.flang — обработчики
 *
 * Собраны они в один модуль flang/conc/node-benchmark.flang и напечатаны
 * компилятором в цель c. Хозяин собирается ТЕМИ ЖЕ ключами: `node.mk` включает
 * напечатанный Makefile и берёт из него CC, CFLAGS, LDLIBS и объектные файлы.
 *
 * ── Что делает этот файл и только он ────────────────────────────────────────
 *
 *   1. держит сокеты, часы, таймеры и очередь готовых;
 *   2. переводит события мира в варианты двух эталонов;
 *   3. исполняет веления, которые эталоны вернули;
 *   4. зовёт обработчик по имени — это и есть та граница, из-за которой цикл
 *      принадлежит хозяину: передать функцию туда, где она приезжает данными,
 *      язык не умеет.
 *
 * Груз письма хозяин держит У СЕБЯ и кладёт в таблицу БИЛЕТ — число.
 *
 * ── Чем цель c отличается от семи прежних ───────────────────────────────────
 *
 * Значение flang здесь — fl_value: тег плюс объединение, и читается оно без
 * объявления типа (tag, as.string.utf8/bytes, as.list.items/count,
 * as.record->fields, as.variant->name). Порог цены проходит.
 *
 * Дорого здесь ДРУГОЕ, и это названо числом в отчёте: своя память. Значения
 * flang живут в АРЕНЕ и не освобождаются поштучно — арена одна на весь запуск и
 * не сбрасывается ни разу, потому что состояние узла, состояния процессов и
 * таблица грузов обязаны пережить любой шаг. Память поэтому растёт монотонно.
 * Это та же названная граница, что «билеты не чистятся» у остальных хозяев,
 * только здесь она видна прямо.
 *
 * Разбор JSON пришлось ПОВТОРИТЬ, а не написать: он напечатан рядом
 * (`flang_cli.c`, read_value/read_pairs/read_items) и отдаёт сразу fl_value, но
 * объявлен static и в другой единице трансляции. Печать числа взята у
 * напечатанного рантайма (fl_number_text): иначе число на проводе разошлось бы
 * с остальными хозяевами.
 *
 * Ожидание мира — опрос: сокеты неблокирующие, шаг 5 мс, выход по первым же
 * байтам. Место в витке то же, что у select у остальных: между набором и
 * пробегами, иначе первое письмо чужому ушло бы до знакомства.
 *
 * ── Надзор ──────────────────────────────────────────────────────────────────
 *
 * Отказ процесса доезжает до веления «Уронить процесс», и хозяин передаёт его
 * НАДЗОРУ — четвёртому напечатанному модулю, flang/conc/supervisor.flang. Кого
 * поднимать, кого укладывать и когда передавать выше, решает он; хозяин только
 * исполняет. Дерево надзора приезжает данными в плане, как и размещение.
 *
 * ── Чего здесь нет, и это названо ───────────────────────────────────────────
 *
 * ПРЕДЕЛЫ ТАБЛИЦ — постоянные: 8 связей, 16 процессов, 64 таймера, 4096 билетов.
 * Узлу этого хватает с запасом, а рост без предела в C стоил бы своей
 * распределяемой таблицы на каждую.
 *
 * Запуск (журнал построчным JSON на stdout, как у остальных хозяев):
 *
 *   ./flang_node --я счёт --слушать 127.0.0.1:0 --хэш <hex> \
 *     --план-файл plan.json --размещение <json> [--срок 1000] [--жить 5]
 */
#define _POSIX_C_SOURCE 200809L

#include <arpa/inet.h>
#include <errno.h>
#include <fcntl.h>
#include <netinet/in.h>
#include <netinet/tcp.h>
#include <stdarg.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <time.h>
#include <unistd.h>

/*
 * Имя напечатанного модуля и имя цели приезжают ключами сборки, а не правкой
 * этого файла. Цель «cpp» печатает тот же самый модуль в `uzel_zamera.hpp` и
 * собирает ЭТОТ ЖЕ файл компилятором C++ (`-x c++`) — второй копии хозяина в
 * дереве нет и быть не должно: она разошлась бы с подлинником молча, ровно как
 * разошёлся бы второй рантайм у самой цели «cpp».
 *
 * Умолчания — цели «c»: без ключей файл собирается ровно как собирался.
 */
#ifndef ZAGOLOVOK_MODULYA
#define ZAGOLOVOK_MODULYA "uzel_zamera.h"
#endif
#ifndef CEL
#define CEL "c"
#endif

#include ZAGOLOVOK_MODULYA
#define SVYAZEY 8
#define PROCESSOV 16
#define TAYMEROV 64
#define BILETOV 4096

static fl_arena arena;
static fl_ctx ctx;
static fl_error beda;

static void vstal(const char *pochemu) {
  fprintf(stderr, "узел встал: %s\n", pochemu);
  exit(1);
}

// Отказ эталона — поломка хозяина, а не ветвь вычисления: эталоны тотальны и
// проверены. Поэтому здесь выход, а не молчание.
#define NADO(vyzov)                                                           \
  do {                                                                        \
    if ((vyzov) != FL_OK) {                                                   \
      fprintf(stderr, "узел встал: [%s] %s\n",                                \
              beda.code ? beda.code : "?", beda.message ? beda.message : ""); \
      exit(1);                                                                \
    }                                                                         \
  } while (0)

static void *nado_pamyat(size_t skolko) {
  void *kusok = malloc(skolko);
  if (kusok == NULL) {
    vstal("памяти нет");
  }
  return kusok;
}

// ── растущая строка: журнал и кадры провода ───────────────────────────────

typedef struct {
  char *dannye;
  size_t dlina;
  size_t zapas;
} stroka;

static void s_init(stroka *kuda) {
  kuda->zapas = 256;
  kuda->dlina = 0;
  kuda->dannye = (char *)nado_pamyat(kuda->zapas);
  kuda->dannye[0] = '\0';
}

static void s_bayty(stroka *kuda, const char *chto, size_t skolko) {
  if (kuda->dlina + skolko + 1 > kuda->zapas) {
    while (kuda->dlina + skolko + 1 > kuda->zapas) {
      kuda->zapas *= 2;
    }
    char *bolshe = (char *)realloc(kuda->dannye, kuda->zapas);
    if (bolshe == NULL) {
      vstal("памяти нет");
    }
    kuda->dannye = bolshe;
  }
  memcpy(kuda->dannye + kuda->dlina, chto, skolko);
  kuda->dlina += skolko;
  kuda->dannye[kuda->dlina] = '\0';
}

static void s_slovo(stroka *kuda, const char *chto) {
  s_bayty(kuda, chto, strlen(chto));
}

// Строка в кавычках по правилам JSON. Кириллица не экранируется — так же, как в
// напечатанном рантайме и у остальных хозяев.
static void s_citata(stroka *kuda, const char *utf8, size_t bytes) {
  s_slovo(kuda, "\"");
  for (size_t nomer = 0; nomer < bytes; nomer += 1) {
    unsigned char znak = (unsigned char)utf8[nomer];
    switch (znak) {
      case '"': s_slovo(kuda, "\\\""); break;
      case '\\': s_slovo(kuda, "\\\\"); break;
      case '\n': s_slovo(kuda, "\\n"); break;
      case '\r': s_slovo(kuda, "\\r"); break;
      case '\t': s_slovo(kuda, "\\t"); break;
      case '\b': s_slovo(kuda, "\\b"); break;
      case '\f': s_slovo(kuda, "\\f"); break;
      default:
        if (znak < 0x20) {
          char shest[8];
          snprintf(shest, sizeof shest, "\\u%04x", (unsigned)znak);
          s_slovo(kuda, shest);
        } else {
          s_bayty(kuda, (const char *)&znak, 1);
        }
    }
  }
  s_slovo(kuda, "\"");
}

// Число наружу — текстом по правилам ECMAScript, теми же, какими его печатает
// напечатанный рантайм. Иначе «2» уехало бы как «2.000000», а «-0» как «0».
static void s_chislo(stroka *kuda, double chislo) {
  if (chislo != chislo) {
    s_slovo(kuda, "\"NaN\"");
    return;
  }
  if (chislo > 0 && chislo * 2 == chislo) {
    s_slovo(kuda, "\"+∞\"");
    return;
  }
  if (chislo < 0 && chislo * 2 == chislo) {
    s_slovo(kuda, "\"-∞\"");
    return;
  }
  if (chislo == 0 && 1 / chislo < 0) {
    s_slovo(kuda, "\"-0\"");
    return;
  }
  char bufer[FL_NUMBER_TEXT_MAX];
  fl_number_text(chislo, bufer);
  s_slovo(kuda, bufer);
}

// ── JSON: разбор ─────────────────────────────────────────────────────────
// ПЕРЕВОЗКА, а не решение. Тот же разбор компилятор печатает рядом в
// flang_cli.c и отдаёт сразу fl_value, но объявлен static. Число хранится
// ТЕКСТОМ: на проводе оно и так едет текстом, а разбор в double с последующей
// печатью потерял бы «-0».

enum { J_NICHTO, J_PRIZNAK, J_TEKST, J_CHISLO, J_SPISOK, J_ZAPIS };

typedef struct json json;
struct json {
  int vid;
  bool priznak;
  char *tekst;  // J_TEKST и J_CHISLO, с нулём на конце
  json **chleny;  // J_SPISOK и J_ZAPIS
  char **imena;  // J_ZAPIS: имя при каждом члене
  size_t chlenov;
};

static json *j_novyy(int vid) {
  json *chto = (json *)nado_pamyat(sizeof *chto);
  chto->vid = vid;
  chto->priznak = false;
  chto->tekst = NULL;
  chto->chleny = NULL;
  chto->imena = NULL;
  chto->chlenov = 0;
  return chto;
}

static void j_osvobodit(json *chto) {
  if (chto == NULL) {
    return;
  }
  for (size_t nomer = 0; nomer < chto->chlenov; nomer += 1) {
    j_osvobodit(chto->chleny[nomer]);
    if (chto->imena != NULL) {
      free(chto->imena[nomer]);
    }
  }
  free(chto->chleny);
  free(chto->imena);
  free(chto->tekst);
  free(chto);
}

static void j_dobavit(json *kuda, char *imya, json *chto) {
  size_t bylo = kuda->chlenov;
  json **bolshe = (json **)realloc(kuda->chleny, (bylo + 1) * sizeof *bolshe);
  if (bolshe == NULL) {
    vstal("памяти нет");
  }
  kuda->chleny = bolshe;
  kuda->chleny[bylo] = chto;
  if (imya != NULL) {
    char **imena = (char **)realloc(kuda->imena, (bylo + 1) * sizeof *imena);
    if (imena == NULL) {
      vstal("памяти нет");
    }
    kuda->imena = imena;
    kuda->imena[bylo] = imya;
  }
  kuda->chlenov = bylo + 1;
}

typedef struct {
  const char *znaki;
  size_t dlina;
  size_t gde;
  bool sorvalos;
} chtec;

static json *j_znachenie(chtec *chtets);

static void j_probely(chtec *chtets) {
  while (chtets->gde < chtets->dlina) {
    char znak = chtets->znaki[chtets->gde];
    if (znak != ' ' && znak != '\t' && znak != '\n' && znak != '\r') {
      break;
    }
    chtets->gde += 1;
  }
}

static char j_znak(chtec *chtets) {
  return chtets->gde < chtets->dlina ? chtets->znaki[chtets->gde] : '\0';
}

static bool j_slovo(chtec *chtets, const char *slovo) {
  size_t dlina = strlen(slovo);
  if (chtets->gde + dlina > chtets->dlina ||
      memcmp(chtets->znaki + chtets->gde, slovo, dlina) != 0) {
    chtets->sorvalos = true;
    return false;
  }
  chtets->gde += dlina;
  return true;
}

// Кодовая точка в UTF-8: нужна только разбору \uXXXX.
static void j_tochka(stroka *kuda, unsigned long tochka) {
  char bayty[4];
  if (tochka < 0x80) {
    bayty[0] = (char)tochka;
    s_bayty(kuda, bayty, 1);
  } else if (tochka < 0x800) {
    bayty[0] = (char)(0xC0 | (tochka >> 6));
    bayty[1] = (char)(0x80 | (tochka & 0x3F));
    s_bayty(kuda, bayty, 2);
  } else {
    bayty[0] = (char)(0xE0 | (tochka >> 12));
    bayty[1] = (char)(0x80 | ((tochka >> 6) & 0x3F));
    bayty[2] = (char)(0x80 | (tochka & 0x3F));
    s_bayty(kuda, bayty, 3);
  }
}

static char *j_stroka(chtec *chtets) {
  chtets->gde += 1;
  stroka sobrano;
  s_init(&sobrano);
  while (chtets->gde < chtets->dlina) {
    char znak = chtets->znaki[chtets->gde];
    chtets->gde += 1;
    if (znak == '"') {
      return sobrano.dannye;
    }
    if (znak != '\\') {
      s_bayty(&sobrano, &znak, 1);
      continue;
    }
    char sled = j_znak(chtets);
    chtets->gde += 1;
    switch (sled) {
      case '"': s_slovo(&sobrano, "\""); break;
      case '\\': s_slovo(&sobrano, "\\"); break;
      case '/': s_slovo(&sobrano, "/"); break;
      case 'b': s_slovo(&sobrano, "\b"); break;
      case 'f': s_slovo(&sobrano, "\f"); break;
      case 'n': s_slovo(&sobrano, "\n"); break;
      case 'r': s_slovo(&sobrano, "\r"); break;
      case 't': s_slovo(&sobrano, "\t"); break;
      case 'u': {
        char shest[5];
        for (size_t nomer = 0; nomer < 4; nomer += 1) {
          shest[nomer] = j_znak(chtets);
          chtets->gde += 1;
        }
        shest[4] = '\0';
        j_tochka(&sobrano, strtoul(shest, NULL, 16));
        break;
      }
      default:
        chtets->sorvalos = true;
        free(sobrano.dannye);
        return NULL;
    }
  }
  chtets->sorvalos = true;
  free(sobrano.dannye);
  return NULL;
}

static json *j_chislo(chtec *chtets) {
  size_t nachalo = chtets->gde;
  while (chtets->gde < chtets->dlina) {
    char znak = chtets->znaki[chtets->gde];
    bool svoy = (znak >= '0' && znak <= '9') || znak == '-' || znak == '+' ||
                znak == '.' || znak == 'e' || znak == 'E';
    if (!svoy) {
      break;
    }
    chtets->gde += 1;
  }
  if (chtets->gde == nachalo) {
    chtets->sorvalos = true;
    return NULL;
  }
  size_t dlina = chtets->gde - nachalo;
  json *chto = j_novyy(J_CHISLO);
  chto->tekst = (char *)nado_pamyat(dlina + 1);
  memcpy(chto->tekst, chtets->znaki + nachalo, dlina);
  chto->tekst[dlina] = '\0';
  return chto;
}

static json *j_znachenie(chtec *chtets) {
  j_probely(chtets);
  char znak = j_znak(chtets);
  if (znak == '{') {
    chtets->gde += 1;
    json *zapis = j_novyy(J_ZAPIS);
    j_probely(chtets);
    if (j_znak(chtets) == '}') {
      chtets->gde += 1;
      return zapis;
    }
    for (;;) {
      j_probely(chtets);
      if (j_znak(chtets) != '"') {
        chtets->sorvalos = true;
        j_osvobodit(zapis);
        return NULL;
      }
      char *klyuch = j_stroka(chtets);
      if (klyuch == NULL) {
        j_osvobodit(zapis);
        return NULL;
      }
      j_probely(chtets);
      if (j_znak(chtets) != ':') {
        chtets->sorvalos = true;
        free(klyuch);
        j_osvobodit(zapis);
        return NULL;
      }
      chtets->gde += 1;
      json *chto = j_znachenie(chtets);
      if (chto == NULL) {
        free(klyuch);
        j_osvobodit(zapis);
        return NULL;
      }
      j_dobavit(zapis, klyuch, chto);
      j_probely(chtets);
      if (j_znak(chtets) == ',') {
        chtets->gde += 1;
        continue;
      }
      if (j_znak(chtets) == '}') {
        chtets->gde += 1;
        return zapis;
      }
      chtets->sorvalos = true;
      j_osvobodit(zapis);
      return NULL;
    }
  }
  if (znak == '[') {
    chtets->gde += 1;
    json *spisok = j_novyy(J_SPISOK);
    j_probely(chtets);
    if (j_znak(chtets) == ']') {
      chtets->gde += 1;
      return spisok;
    }
    for (;;) {
      json *chto = j_znachenie(chtets);
      if (chto == NULL) {
        j_osvobodit(spisok);
        return NULL;
      }
      j_dobavit(spisok, NULL, chto);
      j_probely(chtets);
      if (j_znak(chtets) == ',') {
        chtets->gde += 1;
        continue;
      }
      if (j_znak(chtets) == ']') {
        chtets->gde += 1;
        return spisok;
      }
      chtets->sorvalos = true;
      j_osvobodit(spisok);
      return NULL;
    }
  }
  if (znak == '"') {
    char *tekst = j_stroka(chtets);
    if (tekst == NULL) {
      return NULL;
    }
    json *chto = j_novyy(J_TEKST);
    chto->tekst = tekst;
    return chto;
  }
  if (znak == 't') {
    if (!j_slovo(chtets, "true")) {
      return NULL;
    }
    json *chto = j_novyy(J_PRIZNAK);
    chto->priznak = true;
    return chto;
  }
  if (znak == 'f') {
    if (!j_slovo(chtets, "false")) {
      return NULL;
    }
    return j_novyy(J_PRIZNAK);
  }
  if (znak == 'n') {
    if (!j_slovo(chtets, "null")) {
      return NULL;
    }
    return j_novyy(J_NICHTO);
  }
  return j_chislo(chtets);
}

static json *j_razobrat(const char *istochnik) {
  chtec chtets;
  chtets.znaki = istochnik;
  chtets.dlina = strlen(istochnik);
  chtets.gde = 0;
  chtets.sorvalos = false;
  json *chto = j_znachenie(&chtets);
  if (chto == NULL) {
    return NULL;
  }
  j_probely(&chtets);
  if (chtets.gde != chtets.dlina) {
    j_osvobodit(chto);
    return NULL;
  }
  return chto;
}

static const json *j_pole(const json *gde, const char *imya) {
  if (gde == NULL || gde->vid != J_ZAPIS) {
    return NULL;
  }
  for (size_t nomer = 0; nomer < gde->chlenov; nomer += 1) {
    if (strcmp(gde->imena[nomer], imya) == 0) {
      return gde->chleny[nomer];
    }
  }
  return NULL;
}

static const char *j_tekst_polya(const json *gde, const char *imya, const char *po_umolchaniyu) {
  const json *chto = j_pole(gde, imya);
  return chto != NULL && chto->vid == J_TEKST ? chto->tekst : po_umolchaniyu;
}

// ── граница значений: снаружи C, внутри значения flang ───────────────────

static fl_value tekst(const char *utf8) {
  fl_value chto = fl_nothing();
  NADO(fl_text(&ctx, utf8, strlen(utf8), &chto, &beda));
  return chto;
}

// Поле записи или варианта. Строки значений НЕ заканчиваются нулём — они срезы,
// поэтому здесь только поиск, а чтение идёт через v_tekst.
static fl_value pole(fl_value gde, const char *imya) {
  const fl_field *polya = NULL;
  size_t skolko = 0;
  if (gde.tag == FL_RECORD) {
    polya = gde.as.record->fields;
    skolko = gde.as.record->count;
  } else if (gde.tag == FL_VARIANT) {
    polya = gde.as.variant->fields;
    skolko = gde.as.variant->count;
  }
  for (size_t nomer = 0; nomer < skolko; nomer += 1) {
    if (strcmp(polya[nomer].name, imya) == 0) {
      return polya[nomer].value;
    }
  }
  return fl_nothing();
}

static void v_tekst(fl_value chto, char *kuda, size_t razmer) {
  size_t bytes = chto.tag == FL_STRING ? chto.as.string.bytes : 0;
  if (bytes > razmer - 1) {
    bytes = razmer - 1;
  }
  if (bytes > 0) {
    memcpy(kuda, chto.as.string.utf8, bytes);
  }
  kuda[bytes] = '\0';
}

// Имя поля и имя варианта конструкторы рантайма БЕРУТ, а не копируют
// (`variant->name = name`), и жить они обязаны не меньше значения. Имена,
// приехавшие с провода, живут в дереве кадра, а оно освобождается на следующем
// кадре, — поэтому здесь копия В АРЕНУ, где живёт и само значение. Стоило
// одного прогона: имя варианта уезжало в «разбор не покрывает значение <мусор>».
static const char *imya_v_arene(const char *chto) {
  fl_value kak_stroka = fl_nothing();
  NADO(fl_text(&ctx, chto, strlen(chto), &kak_stroka, &beda));
  return kak_stroka.as.string.utf8;
}

static double v_chislo(fl_value chto) {
  return chto.tag == FL_NUMBER ? chto.as.number : 0.0;
}

static bool v_priznak(fl_value chto) {
  return chto.tag == FL_FLAG && chto.as.flag;
}

// ── провод: те же метки, что у остальных хозяев ─────────────────────────
// Перевод, а не решение: правило «у каждого значения метка одной буквой» живёт
// в flang/conc/DISTRIBUTED.md, и разойтись с ним нельзя.
static void s_polya(stroka *kuda, const fl_field *polya, size_t skolko);

static void s_znachenie(stroka *kuda, fl_value chto) {
  switch (chto.tag) {
    case FL_NOTHING:
      s_slovo(kuda, "[\"н\"]");
      break;
    case FL_FLAG:
      s_slovo(kuda, chto.as.flag ? "[\"п\",true]" : "[\"п\",false]");
      break;
    case FL_STRING:
      s_slovo(kuda, "[\"с\",");
      s_citata(kuda, chto.as.string.utf8, chto.as.string.bytes);
      s_slovo(kuda, "]");
      break;
    case FL_NUMBER:
      s_slovo(kuda, "[\"ч\",");
      s_chislo(kuda, chto.as.number);
      s_slovo(kuda, "]");
      break;
    case FL_LIST:
      s_slovo(kuda, "[\"л\",[");
      for (size_t nomer = 0; nomer < chto.as.list.count; nomer += 1) {
        if (nomer > 0) {
          s_slovo(kuda, ",");
        }
        s_znachenie(kuda, chto.as.list.items[nomer]);
      }
      s_slovo(kuda, "]]");
      break;
    case FL_RECORD:
      s_slovo(kuda, "[\"з\",");
      s_polya(kuda, chto.as.record->fields, chto.as.record->count);
      s_slovo(kuda, "]");
      break;
    case FL_VARIANT:
      s_slovo(kuda, "[\"в\",");
      s_citata(kuda, chto.as.variant->name, strlen(chto.as.variant->name));
      s_slovo(kuda, ",");
      s_polya(kuda, chto.as.variant->fields, chto.as.variant->count);
      s_slovo(kuda, "]");
      break;
    default:
      vstal("нечего кодировать");
  }
}

static void s_polya(stroka *kuda, const fl_field *polya, size_t skolko) {
  s_slovo(kuda, "{");
  for (size_t nomer = 0; nomer < skolko; nomer += 1) {
    if (nomer > 0) {
      s_slovo(kuda, ",");
    }
    s_citata(kuda, polya[nomer].name, strlen(polya[nomer].name));
    s_slovo(kuda, ":");
    s_znachenie(kuda, polya[nomer].value);
  }
  s_slovo(kuda, "}");
}

static double chislo_vnutr(const char *tekst_chisla) {
  if (strcmp(tekst_chisla, "NaN") == 0) {
    return strtod("NAN", NULL);
  }
  if (strcmp(tekst_chisla, "+∞") == 0) {
    return strtod("INF", NULL);
  }
  if (strcmp(tekst_chisla, "-∞") == 0) {
    return -strtod("INF", NULL);
  }
  return strtod(tekst_chisla, NULL);
}

static fl_value raskodirovat(const json *kod) {
  if (kod == NULL || kod->vid != J_SPISOK || kod->chlenov == 0 ||
      kod->chleny[0]->vid != J_TEKST) {
    vstal("не значение на проводе");
  }
  const char *metka = kod->chleny[0]->tekst;
  const json *pervoe = kod->chlenov > 1 ? kod->chleny[1] : NULL;
  if (strcmp(metka, "н") == 0) {
    return fl_nothing();
  }
  if (strcmp(metka, "п") == 0) {
    return fl_flag(pervoe != NULL && pervoe->vid == J_PRIZNAK && pervoe->priznak);
  }
  if (strcmp(metka, "с") == 0) {
    return tekst(pervoe != NULL && pervoe->tekst != NULL ? pervoe->tekst : "");
  }
  if (strcmp(metka, "ч") == 0) {
    return fl_number(chislo_vnutr(pervoe != NULL && pervoe->tekst != NULL ? pervoe->tekst : "0"));
  }
  if (strcmp(metka, "л") == 0) {
    size_t skolko = pervoe != NULL && pervoe->vid == J_SPISOK ? pervoe->chlenov : 0;
    fl_value *chleny = NULL;
    NADO(fl_list_alloc(&ctx, skolko, &chleny, &beda));
    for (size_t nomer = 0; nomer < skolko; nomer += 1) {
      chleny[nomer] = raskodirovat(pervoe->chleny[nomer]);
    }
    return fl_list(chleny, skolko);
  }
  const json *polya = NULL;
  const char *imya_varianta = NULL;
  if (strcmp(metka, "з") == 0) {
    polya = pervoe;
  } else if (strcmp(metka, "в") == 0) {
    imya_varianta = imya_v_arene(pervoe != NULL && pervoe->vid == J_TEKST ? pervoe->tekst : "");
    polya = kod->chlenov > 2 ? kod->chleny[2] : NULL;
  } else {
    vstal("неизвестная метка значения");
  }
  size_t skolko = polya != NULL && polya->vid == J_ZAPIS ? polya->chlenov : 0;
  const char **imena = (const char **)nado_pamyat((skolko + 1) * sizeof *imena);
  fl_value *znacheniya = (fl_value *)nado_pamyat((skolko + 1) * sizeof *znacheniya);
  for (size_t nomer = 0; nomer < skolko; nomer += 1) {
    imena[nomer] = imya_v_arene(polya->imena[nomer]);
    znacheniya[nomer] = raskodirovat(polya->chleny[nomer]);
  }
  fl_value chto = fl_nothing();
  if (imya_varianta == NULL) {
    NADO(fl_record_new(&ctx, imena, znacheniya, skolko, &chto, &beda));
  } else {
    NADO(fl_variant_new(&ctx, imya_varianta, imena, znacheniya, skolko, &chto, &beda));
  }
  free((void *)imena);
  free(znacheniya);
  return chto;
}

// ── журнал: пары «имя, текст», конец — NULL. Значения всегда строки, кроме
// двух записей (подъём и конец), которые собираются вручную. ───────────────
static void skazat(const char *imya, ...) {
  stroka out;
  s_init(&out);
  s_slovo(&out, "{");
  va_list dovody;
  va_start(dovody, imya);
  const char *klyuch = imya;
  bool pervyy = true;
  while (klyuch != NULL) {
    const char *znachenie = va_arg(dovody, const char *);
    if (!pervyy) {
      s_slovo(&out, ",");
    }
    pervyy = false;
    s_citata(&out, klyuch, strlen(klyuch));
    s_slovo(&out, ":");
    s_citata(&out, znachenie, strlen(znachenie));
    klyuch = va_arg(dovody, const char *);
  }
  va_end(dovody);
  s_slovo(&out, "}");
  printf("%s\n", out.dannye);  // МИР
  fflush(stdout);  // МИР
  free(out.dannye);
}

// * Единственное чтение часов во всём файле.
static double chasy(void) {
  struct timespec seychas;
  clock_gettime(CLOCK_REALTIME, &seychas);  // МИР
  return (double)seychas.tv_sec * 1000.0 + (double)(seychas.tv_nsec / 1000000L);
}

// ── каналы, процессы, узел ───────────────────────────────────────────────

typedef struct {
  char kto[128];
  char adres[128];
  int soket;  // −1 — связи нет
  stroka hvost;
  double kogda_zvonit;
  double posledniy_puls;
  fl_value sostoyanie;
} kanal;

typedef struct {
  char imya[128];
  char nachalnoe[128];
  char obrabotchik[128];
  double yaschik;
} process;

typedef struct {
  double kogda;
  char komu[128];
  double bilet;
} taymer;

static char moyo_imya[128];
static char moy_hesh[128];
static double srok = 1000.0;
static double puls_srok = 200.0;
static double pauza = 250.0;
static bool rabotaet = true;
static unsigned semya = 7;

static process plan[PROCESSOV];
static size_t planov;
static char imena_sostoyaniy[PROCESSOV][128];
static fl_value sostoyaniya[PROCESSOV];
static size_t sostoyaniy;

static fl_value uzel;
static kanal kanaly[SVYAZEY];
static size_t kanalov;
static int server = -1;

static fl_value gruzy[BILETOV];
static size_t gruzov;
static taymer taymery[TAYMEROV];
static size_t taymerov;
static json *posledniy_kadr;
static double sleduyuschiy_storozh;
static fl_value derevo;

static void svyaz_sluchilas(size_t nomer, fl_value sobytie);
static void uzel_sluchilsya(fl_value sobytie);
static void nadzor_sluchilsya(const char *kto, const char *kod);

// ── мир: сокеты ────────────────────────────────────────────────────────

static void neblokiruyuschiy(int sok) {
  int flagi = fcntl(sok, F_GETFL, 0);  // МИР
  if (flagi >= 0) {
    fcntl(sok, F_SETFL, flagi | O_NONBLOCK);  // МИР
  }
  int da = 1;
  setsockopt(sok, IPPROTO_TCP, TCP_NODELAY, &da, sizeof da);  // МИР
}

static bool razobrat_adres(const char *adres, struct sockaddr_in *kuda) {
  const char *dvoetochie = strrchr(adres, ':');
  if (dvoetochie == NULL) {
    return false;
  }
  char hozyain[64];
  size_t dlina = (size_t)(dvoetochie - adres);
  if (dlina > sizeof hozyain - 1) {
    return false;
  }
  memcpy(hozyain, adres, dlina);
  hozyain[dlina] = '\0';
  memset(kuda, 0, sizeof *kuda);
  kuda->sin_family = AF_INET;
  kuda->sin_port = htons((unsigned short)atoi(dvoetochie + 1));
  return inet_pton(AF_INET, hozyain, &kuda->sin_addr) == 1;
}

static int slushat_na(const char *adres) {
  struct sockaddr_in kuda;
  if (!razobrat_adres(adres, &kuda)) {
    vstal("адрес не разобран");
  }
  int sluh = socket(AF_INET, SOCK_STREAM, 0);  // МИР
  if (sluh < 0) {
    vstal("сокет не заведён");
  }
  int da = 1;
  setsockopt(sluh, SOL_SOCKET, SO_REUSEADDR, &da, sizeof da);  // МИР
  if (bind(sluh, (struct sockaddr *)&kuda, sizeof kuda) != 0) {  // МИР
    vstal("узел не встал на адрес");
  }
  if (listen(sluh, 8) != 0) {  // МИР
    vstal("слушать не вышло");
  }
  neblokiruyuschiy(sluh);
  server = sluh;
  struct sockaddr_in svoy;
  socklen_t dlina = sizeof svoy;
  if (getsockname(sluh, (struct sockaddr *)&svoy, &dlina) != 0) {  // МИР
    vstal("порт не назван");
  }
  return (int)ntohs(svoy.sin_port);
}

static void pozvonit(size_t nomer) {
  kanal *k = &kanaly[nomer];
  if (k->soket >= 0 || !rabotaet) {
    return;
  }
  struct sockaddr_in kuda;
  if (!razobrat_adres(k->adres, &kuda)) {
    return;
  }
  int sok = socket(AF_INET, SOCK_STREAM, 0);  // МИР
  if (sok < 0 || connect(sok, (struct sockaddr *)&kuda, sizeof kuda) != 0) {  // МИР
    if (sok >= 0) {
      close(sok);  // МИР
    }
    fl_value sobytie = fl_nothing();
    NADO(uzel_zamera_variant_zvonok_ne_udalsya(&ctx, &sobytie, &beda));
    svyaz_sluchilas(nomer, sobytie);
    return;
  }
  neblokiruyuschiy(sok);
  k->soket = sok;
  fl_value sobytie = fl_nothing();
  NADO(uzel_zamera_variant_soket_zavyolsya(&ctx, fl_number(chasy()), &sobytie, &beda));
  svyaz_sluchilas(nomer, sobytie);
}

// Кто позвонил, скажет его «привет»; до него связь безымянная, и место для неё
// берётся первое свободное.
static void prinyat(void) {
  if (server < 0) {
    return;
  }
  int sok = accept(server, NULL, NULL);  // МИР
  if (sok < 0) {
    return;
  }
  size_t svobodnyy = kanalov;
  for (size_t nomer = 0; nomer < kanalov; nomer += 1) {
    if (kanaly[nomer].soket < 0) {
      svobodnyy = nomer;
      break;
    }
  }
  if (svobodnyy == kanalov) {
    close(sok);  // МИР
    return;
  }
  neblokiruyuschiy(sok);
  kanaly[svobodnyy].soket = sok;
  fl_value sobytie = fl_nothing();
  NADO(uzel_zamera_variant_soket_zavyolsya(&ctx, fl_number(chasy()), &sobytie, &beda));
  svyaz_sluchilas(svobodnyy, sobytie);
}

static void poslat_kadr(size_t nomer, const char *gotovyy) {
  kanal *k = &kanaly[nomer];
  if (k->soket < 0) {
    return;
  }
  size_t dlina = strlen(gotovyy);
  if (send(k->soket, gotovyy, dlina, 0) != (ssize_t)dlina) {  // МИР
    fl_value sobytie = fl_nothing();
    NADO(uzel_zamera_variant_soket_otkazal(&ctx, tekst("запись в сокет отказала"), &sobytie, &beda));
    svyaz_sluchilas(nomer, sobytie);
  }
}

static bool gotova_li(size_t nomer) {
  return v_priznak(pole(kanaly[nomer].sostoyanie, "готова"));
}

static void pribrat(size_t nomer) {
  kanal *k = &kanaly[nomer];
  if (k->soket >= 0) {
    close(k->soket);  // МИР
    k->soket = -1;
  }
  k->hvost.dlina = 0;
  k->hvost.dannye[0] = '\0';
}

static void kadrom(size_t nomer, const json *kadr);

// Читает всё, что пришло. Отвечает, были ли байты, — по этому ответу круг
// выходит из ожидания мира раньше срока, как выходит select у остальных.
static bool prochest(size_t nomer) {
  kanal *k = &kanaly[nomer];
  if (k->soket < 0) {
    return false;
  }
  char kusok[65536];
  ssize_t dlina = recv(k->soket, kusok, sizeof kusok, 0);  // МИР
  if (dlina < 0) {
    if (errno == EAGAIN || errno == EWOULDBLOCK) {
      return false;
    }
    fl_value sobytie = fl_nothing();
    NADO(uzel_zamera_variant_soket_otkazal(&ctx, tekst("сокет отказал"), &sobytie, &beda));
    svyaz_sluchilas(nomer, sobytie);
    return true;
  }
  if (dlina == 0) {
    fl_value sobytie = fl_nothing();
    NADO(uzel_zamera_variant_soket_otkazal(&ctx, tekst("сокет закрыт"), &sobytie, &beda));
    svyaz_sluchilas(nomer, sobytie);
    return true;
  }
  fl_value prishli = fl_nothing();
  NADO(uzel_zamera_variant_bayty_prishli(&ctx, fl_number(chasy()), &prishli, &beda));
  svyaz_sluchilas(nomer, prishli);
  s_bayty(&k->hvost, kusok, (size_t)dlina);
  while (k->soket >= 0) {
    char *kray = strchr(k->hvost.dannye, '\n');
    if (kray == NULL) {
      break;
    }
    size_t skolko = (size_t)(kray - k->hvost.dannye);
    char *stroka_kadra = (char *)nado_pamyat(skolko + 1);
    memcpy(stroka_kadra, k->hvost.dannye, skolko);
    stroka_kadra[skolko] = '\0';
    memmove(k->hvost.dannye, kray + 1, k->hvost.dlina - skolko);
    k->hvost.dlina -= skolko + 1;
    k->hvost.dannye[k->hvost.dlina] = '\0';
    json *kadr = j_razobrat(stroka_kadra);
    free(stroka_kadra);
    if (kadr == NULL) {
      fl_value sobytie = fl_nothing();
      NADO(uzel_zamera_variant_soket_otkazal(&ctx, tekst("кадр не разобран"), &sobytie, &beda));
      svyaz_sluchilas(nomer, sobytie);
      return true;
    }
    j_osvobodit(posledniy_kadr);
    posledniy_kadr = kadr;
    kadrom(nomer, kadr);
  }
  return true;
}

// ── перевод: кадр провода → вариант эталона связи ────────────────────────
static void kadrom(size_t nomer, const json *kadr) {
  const char *vid = j_tekst_polya(kadr, "в", "");
  fl_value sobytie = fl_nothing();
  if (strcmp(vid, "привет") == 0) {
    NADO(uzel_zamera_variant_prishyol_privet(&ctx, tekst(j_tekst_polya(kadr, "узел", "")),
                                             tekst(j_tekst_polya(kadr, "хэш", "")), &sobytie, &beda));
  } else if (strcmp(vid, "пульс") == 0) {
    NADO(uzel_zamera_variant_prishyol_puls(&ctx, &sobytie, &beda));
  } else if (strcmp(vid, "письмо") == 0) {
    NADO(uzel_zamera_variant_prishlo_pismo(&ctx, tekst(j_tekst_polya(kadr, "кому", "")), &sobytie, &beda));
  } else if (strcmp(vid, "отбой") == 0) {
    NADO(uzel_zamera_variant_prishyol_otboy(&ctx, tekst(j_tekst_polya(kadr, "почему", "без причины")),
                                            &sobytie, &beda));
  } else {
    NADO(uzel_zamera_variant_prishyol_chuzhoy_kadr(&ctx, tekst(vid), &sobytie, &beda));
  }
  svyaz_sluchilas(nomer, sobytie);
}

// ── билеты: груз живёт у хозяина, в таблице едет число ───────────────────
static double novyy_bilet(fl_value gruz) {
  if (gruzov >= BILETOV) {
    vstal("билеты кончились");
  }
  gruzy[gruzov] = gruz;
  gruzov += 1;
  return (double)gruzov;
}

// ── исполнение велений связи ─────────────────────────────────────────────
static void ispolnit_svyaz(size_t nomer, fl_value velenie) {
  kanal *k = &kanaly[nomer];
  const char *imya = velenie.as.variant->name;
  char pochemu[512];
  v_tekst(pole(velenie, "почему"), pochemu, sizeof pochemu);

  if (strcmp(imya, "Послать привет") == 0) {
    stroka kadr;
    s_init(&kadr);
    s_slovo(&kadr, "{\"в\":\"привет\",\"узел\":");
    s_citata(&kadr, moyo_imya, strlen(moyo_imya));
    s_slovo(&kadr, ",\"хэш\":");
    s_citata(&kadr, moy_hesh, strlen(moy_hesh));
    s_slovo(&kadr, "}\n");
    poslat_kadr(nomer, kadr.dannye);
    free(kadr.dannye);
    return;
  }
  if (strcmp(imya, "Прибрать") == 0) {
    char kto[128];
    memcpy(kto, k->kto, sizeof kto);
    pribrat(nomer);
    fl_value sobytie = fl_nothing();
    NADO(uzel_zamera_variant_svyaz_poteryana(&ctx, tekst(kto), tekst("сокет прибран"), &sobytie, &beda));
    uzel_sluchilsya(sobytie);
    return;
  }
  if (strcmp(imya, "Связь заведена") == 0) {
    skazat("в", "связь", "узел", moyo_imya, "цель", CEL, "сосед", k->kto, "что", "заведена", NULL);
    fl_value sobytie = fl_nothing();
    NADO(uzel_zamera_variant_svyaz_gotova(&ctx, tekst(k->kto), &sobytie, &beda));
    uzel_sluchilsya(sobytie);
    return;
  }
  if (strcmp(imya, "Связь отвергнута") == 0) {
    char sosed[128];
    v_tekst(pole(velenie, "сосед"), sosed, sizeof sosed);
    skazat("в", "связь", "узел", moyo_imya, "цель", CEL, "сосед", sosed, "что", "отвергнута",
           "почему", pochemu, NULL);
    return;
  }
  /* Пропажа соседа — на ДОКЛАД, а не на «Прибрать»: сокет прибирают и когда
     терять было нечего, и по второму разу на одном разрыве, а доклад слой связи
     выдаёт ровно один раз на разрыв — доказано в link.flang. */
  if (strcmp(imya, "Доложить о потере") == 0) {
    skazat("в", "связь", "узел", moyo_imya, "цель", CEL, "сосед", k->kto, "что", "потеряна",
           "почему", pochemu, NULL);
    fl_value propal = fl_nothing();
    NADO(uzel_zamera_variant_uzel_propal(&ctx, tekst(k->kto), tekst(pochemu), &propal, &beda));
    uzel_sluchilsya(propal);
    return;
  }
  if (strcmp(imya, "Доложить о несостоявшемся знакомстве") == 0) {
    skazat("в", "связь", "узел", moyo_imya, "цель", CEL, "сосед", k->kto, "что", "не состоялась",
           "почему", pochemu, NULL);
    fl_value propal = fl_nothing();
    NADO(uzel_zamera_variant_uzel_propal(&ctx, tekst(k->kto), tekst(pochemu), &propal, &beda));
    uzel_sluchilsya(propal);
    return;
  }
  if (strcmp(imya, "Позвонить снова") == 0) {
    k->kogda_zvonit = chasy() + v_chislo(pole(velenie, "пауза"));
    return;
  }
  if (strcmp(imya, "Доставить письмо") == 0) {
    // Эталон связи назвал АДРЕСАТА, груз оставил узлу — вот он.
    char komu[128];
    v_tekst(pole(velenie, "кому"), komu, sizeof komu);
    fl_value gruz = raskodirovat(j_pole(posledniy_kadr, "что"));
    fl_value sobytie = fl_nothing();
    NADO(uzel_zamera_variant_pismo_snaruzhi(&ctx, tekst(komu), fl_number(novyy_bilet(gruz)),
                                            &sobytie, &beda));
    uzel_sluchilsya(sobytie);
    return;
  }
  fprintf(stderr, "узел не знает веления связи «%s»\n", imya);
  exit(1);
}

// ── единственная дорога от мира к решению о связи ────────────────────────
static void svyaz_sluchilas(size_t nomer, fl_value sobytie) {
  fl_value hod = fl_nothing();
  NADO(uzel_zamera_shag_svyazi_uzla(&ctx, kanaly[nomer].sostoyanie, sobytie, tekst(moy_hesh),
                                    fl_number(srok), fl_number(pauza), fl_flag(rabotaet), &hod, &beda));
  kanaly[nomer].sostoyanie = pole(hod, "связь");
  fl_value veleniya = pole(hod, "веления");
  for (size_t shag = 0; shag < veleniya.as.list.count; shag += 1) {
    ispolnit_svyaz(nomer, veleniya.as.list.items[shag]);
  }
}

// ── вызов обработчика по имени: та самая граница языка ───────────────────
static fl_value v_deystvie(fl_value d) {
  fl_value velenie = fl_nothing();
  fl_value komu = pole(d, "кому");
  const char *imya = d.as.variant->name;
  if (strcmp(imya, "отправить") == 0) {
    NADO(uzel_zamera_variant_veleno_slat(&ctx, komu, fl_number(novyy_bilet(pole(d, "что"))),
                                         &velenie, &beda));
    return velenie;
  }
  if (strcmp(imya, "через") == 0) {
    NADO(uzel_zamera_variant_veleno_slat_pozzhe(&ctx, komu, fl_number(novyy_bilet(pole(d, "что"))),
                                                pole(d, "задержка"), &velenie, &beda));
    return velenie;
  }
  if (strcmp(imya, "отложить") == 0) {
    NADO(uzel_zamera_variant_veleno_otlozhit(&ctx, &velenie, &beda));
    return velenie;
  }
  if (strcmp(imya, "продолжить") == 0) {
    NADO(uzel_zamera_variant_veleno_prodolzhit(&ctx, &velenie, &beda));
    return velenie;
  }
  if (strcmp(imya, "остановить") == 0) {
    NADO(uzel_zamera_variant_veleno_ostanovit(&ctx, pole(d, "почему"), &velenie, &beda));
    return velenie;
  }
  fprintf(stderr, "узел не знает действия «%s»\n", imya);
  exit(1);
}

static void pozvat(const char *kto, size_t bilet) {
  const char *obrabotchik = NULL;
  for (size_t nomer = 0; nomer < planov; nomer += 1) {
    if (strcmp(plan[nomer].imya, kto) == 0) {
      obrabotchik = plan[nomer].obrabotchik;
    }
  }
  size_t gde = sostoyaniy;
  for (size_t nomer = 0; nomer < sostoyaniy; nomer += 1) {
    if (strcmp(imena_sostoyaniy[nomer], kto) == 0) {
      gde = nomer;
    }
  }
  if (obrabotchik == NULL || bilet == 0 || bilet > gruzov || gde == sostoyaniy) {
    fl_value sobytie = fl_nothing();
    NADO(uzel_zamera_variant_obrabotchik_otkazal(&ctx, tekst("FLANG_PROCESS"),
                                                 tekst("обработчика или груза нет"), &sobytie, &beda));
    uzel_sluchilsya(sobytie);
    return;
  }
  fl_value dovody[2];
  dovody[0] = sostoyaniya[gde];
  dovody[1] = gruzy[bilet - 1];
  fl_value itog = fl_nothing();
  if (uzel_zamera_call(&ctx, obrabotchik, dovody, 2, &itog, &beda) != FL_OK) {
    fl_value sobytie = fl_nothing();
    NADO(uzel_zamera_variant_obrabotchik_otkazal(&ctx, tekst(beda.code ? beda.code : "FLANG_INTERNAL"),
                                                 tekst(beda.message ? beda.message : ""), &sobytie, &beda));
    uzel_sluchilsya(sobytie);
    return;
  }
  sostoyaniya[gde] = pole(itog, "состояние");
  fl_value deystviya = pole(itog, "действия");
  size_t skolko = deystviya.as.list.count;
  fl_value *velenya = NULL;
  NADO(fl_list_alloc(&ctx, skolko, &velenya, &beda));
  for (size_t nomer = 0; nomer < skolko; nomer += 1) {
    velenya[nomer] = v_deystvie(deystviya.as.list.items[nomer]);
  }
  fl_value sobytie = fl_nothing();
  NADO(uzel_zamera_variant_obrabotchik_vernul(&ctx, fl_list(velenya, skolko), &sobytie, &beda));
  uzel_sluchilsya(sobytie);
}

// ── исполнение велений планировщика ──────────────────────────────────────
static void ispolnit_uzel(fl_value velenie) {
  const char *imya = velenie.as.variant->name;
  char kto[128];
  char pochemu[512];
  v_tekst(pole(velenie, "кто"), kto, sizeof kto);
  v_tekst(pole(velenie, "почему"), pochemu, sizeof pochemu);

  if (strcmp(imya, "Позвать обработчик") == 0) {
    pozvat(kto, (size_t)v_chislo(pole(velenie, "билет")));
    return;
  }
  if (strcmp(imya, "Послать по проводу") == 0) {
    char sosed[128];
    char komu[128];
    v_tekst(pole(velenie, "узел"), sosed, sizeof sosed);
    v_tekst(pole(velenie, "кому"), komu, sizeof komu);
    size_t bilet = (size_t)v_chislo(pole(velenie, "билет"));
    if (bilet == 0 || bilet > gruzov) {
      return;
    }
    for (size_t nomer = 0; nomer < kanalov; nomer += 1) {
      if (strcmp(kanaly[nomer].kto, sosed) != 0) {
        continue;
      }
      if (kanaly[nomer].soket < 0 || !gotova_li(nomer)) {
        return;
      }
      stroka kadr;
      s_init(&kadr);
      s_slovo(&kadr, "{\"в\":\"письмо\",\"кому\":");
      s_citata(&kadr, komu, strlen(komu));
      s_slovo(&kadr, ",\"что\":");
      s_znachenie(&kadr, gruzy[bilet - 1]);
      s_slovo(&kadr, "}\n");
      poslat_kadr(nomer, kadr.dannye);
      free(kadr.dannye);
      return;
    }
    return;
  }
  if (strcmp(imya, "Поставить таймер") == 0) {
    if (taymerov >= TAYMEROV) {
      vstal("таймеры кончились");
    }
    taymery[taymerov].kogda = chasy() + v_chislo(pole(velenie, "задержка"));
    v_tekst(pole(velenie, "кому"), taymery[taymerov].komu, sizeof taymery[taymerov].komu);
    taymery[taymerov].bilet = v_chislo(pole(velenie, "билет"));
    taymerov += 1;
    return;
  }
  if (strcmp(imya, "Записать в журнал") == 0) {
    char vid[128];
    v_tekst(pole(velenie, "вид"), vid, sizeof vid);
    skazat("в", vid, "узел", moyo_imya, "цель", CEL, "кто", kto, "почему", pochemu, NULL);
    return;
  }
  if (strcmp(imya, "Уронить процесс") == 0) {
    char kod[128];
    char chto[512];
    v_tekst(pole(velenie, "код"), kod, sizeof kod);
    v_tekst(pole(velenie, "текст"), chto, sizeof chto);
    skazat("в", "отказ", "узел", moyo_imya, "цель", CEL, "процесс", kto, "код", kod, "текст", chto, NULL);
    // Отказ уходит НАДЗОРУ, а не в журнал: решает напечатанный supervisor.flang,
    // здесь только дорога к нему.
    nadzor_sluchilsya(kto, kod);
    return;
  }
  if (strcmp(imya, "Письмо пропало") == 0) {
    char komu[128];
    v_tekst(pole(velenie, "кому"), komu, sizeof komu);
    skazat("в", "потеря", "узел", moyo_imya, "цель", CEL, "кому", komu, "почему", pochemu, NULL);
    return;
  }
  fprintf(stderr, "узел не знает веления планировщика «%s»\n", imya);
  exit(1);
}

// ── единственная дорога от мира к решению о процессах ────────────────────
static void uzel_sluchilsya(fl_value sobytie) {
  fl_value hod = fl_nothing();
  NADO(uzel_zamera_shag_uzla_celikom(&ctx, uzel, sobytie, &hod, &beda));
  uzel = pole(hod, "узел");
  fl_value veleniya = pole(hod, "веления");
  for (size_t shag = 0; shag < veleniya.as.list.count; shag += 1) {
    ispolnit_uzel(veleniya.as.list.items[shag]);
  }
}

// ── единственная дорога от отказа к решению надзора ──────────────────────

static void ispolnit_nadzor(fl_value velenie) {
  const char *imya = velenie.as.variant->name;
  char kto[128];
  char nadzor[128];
  v_tekst(pole(velenie, "кто"), kto, sizeof kto);
  v_tekst(pole(velenie, "надзор"), nadzor, sizeof nadzor);

  if (strcmp(imya, "Поднять") == 0) {
    // Перезапуск трогает состояние и не трогает ящик — это решено на flang;
    // здесь состояние берётся тем же путём, что при подъёме узла.
    fl_value novyy = fl_nothing();
    NADO(uzel_zamera_podnyat_process_uzla(&ctx, uzel, tekst(kto), &novyy, &beda));
    uzel = novyy;
    for (size_t nomer = 0; nomer < planov; nomer += 1) {
      if (strcmp(plan[nomer].imya, kto) != 0) {
        continue;
      }
      fl_value nachalnoe = fl_nothing();
      NADO(uzel_zamera_call(&ctx, plan[nomer].nachalnoe, NULL, 0, &nachalnoe, &beda));
      // Строки может и НЕ БЫТЬ: при подъёме узла состояние заводят только своим
      // процессам, а подхваченный чужой становится своим сейчас. Без этой ветки
      // он поднимался бы в таблице процессов и оставался без состояния — то
      // есть навсегда молчащим.
      size_t gde = sostoyaniy;
      for (size_t i = 0; i < sostoyaniy; i += 1) {
        if (strcmp(imena_sostoyaniy[i], kto) == 0) {
          gde = i;
          break;
        }
      }
      if (gde == sostoyaniy && sostoyaniy < PROCESSOV) {
        snprintf(imena_sostoyaniy[sostoyaniy], sizeof imena_sostoyaniy[0], "%s", kto);
        sostoyaniy += 1;
      }
      if (gde < sostoyaniy) {
        sostoyaniya[gde] = nachalnoe;
      }
    }
    skazat("в", "надзор", "узел", moyo_imya, "цель", CEL, "что", "поднят", "кто", kto, NULL);
    return;
  }
  if (strcmp(imya, "Уложить") == 0) {
    fl_value novyy = fl_nothing();
    NADO(uzel_zamera_ulozhit_process_uzla(&ctx, uzel, tekst(kto), tekst("остановлен надзором"),
                                          &novyy, &beda));
    uzel = novyy;
    skazat("в", "надзор", "узел", moyo_imya, "цель", CEL, "что", "уложен", "кто", kto,
           "надзор", nadzor, NULL);
    return;
  }
  if (strcmp(imya, "Решено") == 0) {
    char strategiya[128];
    v_tekst(pole(velenie, "стратегия"), strategiya, sizeof strategiya);
    skazat("в", "надзор", "узел", moyo_imya, "цель", CEL, "что", "решено", "кто", kto,
           "надзор", nadzor, "стратегия", strategiya, NULL);
    return;
  }
  if (strcmp(imya, "Некому надзирать") == 0) {
    fl_value novyy = fl_nothing();
    NADO(uzel_zamera_ostanovit_uzel_celikom(&ctx, uzel, &novyy, &beda));
    uzel = novyy;
    rabotaet = false;
    skazat("в", "надзор", "узел", moyo_imya, "цель", CEL, "что", "некому", "кто", kto,
           "надзор", nadzor, NULL);
    return;
  }
  fprintf(stderr, "узел не знает веления надзора «%s»\n", imya);
  exit(1);
}

static void nadzor_sluchilsya(const char *kto, const char *kod) {
  fl_value hod = fl_nothing();
  NADO(uzel_zamera_shag_nadzora_uzla(&ctx, derevo, tekst(kto), tekst(kod), fl_number(chasy()),
                                     &hod, &beda));
  derevo = pole(hod, "дерево");
  fl_value veleniya = pole(hod, "веления");
  for (size_t shag = 0; shag < veleniya.as.list.count; shag += 1) {
    ispolnit_nadzor(veleniya.as.list.items[shag]);
  }
}

// ── круг: сокеты, часы, таймеры и очередь готовых ────────────────────────

static double period(void) {
  double shag = srok / 5.0;
  return shag < 20.0 ? 20.0 : shag;
}

static double zhrebiy(void) {
  semya = (unsigned)(semya + 0x6D2B79F5u);
  unsigned t = (unsigned)((semya ^ (semya >> 15)) * (semya | 1u));
  t = (unsigned)(t ^ (t + (unsigned)((t ^ (t >> 7)) * (t | 61u))));
  return (double)(t ^ (t >> 14)) / 4294967296.0;
}

static void pospat(long millisekund) {
  struct timespec skolko;
  skolko.tv_sec = millisekund / 1000;
  skolko.tv_nsec = (millisekund % 1000) * 1000000L;
  nanosleep(&skolko, NULL);  // МИР
}

// Ждать мира. `select` здесь есть, но опрос неблокирующих сокетов короче и
// одинаков с хозяевами на Rust и Java. Место в витке — то же, что у select у
// остальных: между набором и пробегами.
static void zhdat_mira(void) {
  double krayniy = chasy() + (period() < puls_srok ? period() : puls_srok);
  for (;;) {
    prinyat();
    bool bylo = false;
    for (size_t nomer = 0; nomer < kanalov; nomer += 1) {
      if (kanaly[nomer].soket >= 0 && prochest(nomer)) {
        bylo = true;
      }
    }
    if (bylo || chasy() >= krayniy) {
      return;
    }
    pospat(5);
  }
}

static void krug(double dokole) {
  while (chasy() < dokole && rabotaet) {
    double seychas = chasy();
    for (size_t nomer = 0; nomer < kanalov; nomer += 1) {
      if (kanaly[nomer].soket < 0 && seychas >= kanaly[nomer].kogda_zvonit &&
          kanaly[nomer].adres[0] != '\0') {
        pozvonit(nomer);
      }
    }
    zhdat_mira();

    seychas = chasy();
    size_t ostalos = 0;
    taymer sozrevshie[TAYMEROV];
    size_t sozrelo = 0;
    for (size_t nomer = 0; nomer < taymerov; nomer += 1) {
      if (taymery[nomer].kogda <= seychas) {
        sozrevshie[sozrelo] = taymery[nomer];
        sozrelo += 1;
      } else {
        taymery[ostalos] = taymery[nomer];
        ostalos += 1;
      }
    }
    taymerov = ostalos;
    for (size_t nomer = 0; nomer < sozrelo; nomer += 1) {
      fl_value sobytie = fl_nothing();
      NADO(uzel_zamera_variant_taymer_srabotal(&ctx, tekst(sozrevshie[nomer].komu),
                                               fl_number(sozrevshie[nomer].bilet), &sobytie, &beda));
      uzel_sluchilsya(sobytie);
    }

    for (size_t nomer = 0; nomer < kanalov; nomer += 1) {
      if (kanaly[nomer].soket >= 0 && gotova_li(nomer) &&
          seychas - kanaly[nomer].posledniy_puls >= puls_srok) {
        kanaly[nomer].posledniy_puls = seychas;
        poslat_kadr(nomer, "{\"в\":\"пульс\"}\n");
      }
    }

    if (seychas >= sleduyuschiy_storozh) {
      sleduyuschiy_storozh = seychas + period();
      for (size_t nomer = 0; nomer < kanalov; nomer += 1) {
        if (kanaly[nomer].soket >= 0) {
          fl_value sobytie = fl_nothing();
          NADO(uzel_zamera_variant_storozh_prosnulsya(&ctx, fl_number(seychas), &sobytie, &beda));
          svyaz_sluchilas(nomer, sobytie);
        }
      }
    }

    // Пробеги — до покоя, но с уступкой миру после каждого витка.
    for (size_t shag = 0; shag < 64; shag += 1) {
      fl_value bylo = uzel;
      fl_value sobytie = fl_nothing();
      NADO(uzel_zamera_variant_pora_bezhat(&ctx, fl_number(zhrebiy()), &sobytie, &beda));
      uzel_sluchilsya(sobytie);
      if (fl_equal(uzel, bylo)) {
        break;
      }
    }
  }
}

// ── доводы, план, размещение ─────────────────────────────────────────────

#define DOVODOV 32
static char imena_dovodov[DOVODOV][64];
static const char *znacheniya_dovodov[DOVODOV];
static size_t dovodov;

static const char *dovod(const char *imya, const char *po_umolchaniyu) {
  for (size_t nomer = 0; nomer < dovodov; nomer += 1) {
    if (strcmp(imena_dovodov[nomer], imya) == 0) {
      return znacheniya_dovodov[nomer];
    }
  }
  return po_umolchaniyu;
}

static double dovod_chislo(const char *imya, double po_umolchaniyu) {
  const char *chto = dovod(imya, NULL);
  return chto == NULL || chto[0] == '\0' ? po_umolchaniyu : strtod(chto, NULL);
}

static void razobrat_dovody(int argc, char **argv) {
  size_t poslednee = DOVODOV;
  for (int nomer = 1; nomer < argc; nomer += 1) {
    if (strncmp(argv[nomer], "--", 2) == 0) {
      if (dovodov >= DOVODOV) {
        vstal("доводов слишком много");
      }
      snprintf(imena_dovodov[dovodov], sizeof imena_dovodov[0], "%s", argv[nomer] + 2);
      znacheniya_dovodov[dovodov] = "";
      poslednee = dovodov;
      dovodov += 1;
    } else if (poslednee < DOVODOV) {
      znacheniya_dovodov[poslednee] = argv[nomer];
      poslednee = DOVODOV;
    }
  }
}

static char *prochest_fayl(const char *put) {
  FILE *fayl = fopen(put, "rb");  // МИР
  if (fayl == NULL) {
    vstal("план не прочитан");
  }
  stroka sobrano;
  s_init(&sobrano);
  char kusok[4096];
  size_t dlina;
  while ((dlina = fread(kusok, 1, sizeof kusok, fayl)) > 0) {  // МИР
    s_bayty(&sobrano, kusok, dlina);
  }
  fclose(fayl);  // МИР
  return sobrano.dannye;
}

int main(int argc, char **argv) {
  fl_arena_init(&arena);
  fl_ctx_init(&ctx, &arena);
  razobrat_dovody(argc, argv);

  snprintf(moyo_imya, sizeof moyo_imya, "%s", dovod("я", ""));
  snprintf(moy_hesh, sizeof moy_hesh, "%s", dovod("хэш", ""));
  srok = dovod_chislo("срок", 1000.0);
  puls_srok = dovod_chislo("пульс", 200.0);
  pauza = dovod_chislo("пауза", 250.0);
  semya = (unsigned)dovod_chislo("семя", 7.0);

  json *razmeschenie = j_razobrat(dovod("размещение", "{}"));
  if (razmeschenie == NULL) {
    vstal("размещение не разобрано");
  }
  char *tekst_plana = NULL;
  const char *gotovyy = dovod("план", "");
  if (gotovyy[0] != '\0') {
    tekst_plana = (char *)nado_pamyat(strlen(gotovyy) + 1);
    memcpy(tekst_plana, gotovyy, strlen(gotovyy) + 1);
  } else {
    tekst_plana = prochest_fayl(dovod("план-файл", "plan.json"));
  }
  json *plan_json = j_razobrat(tekst_plana);
  free(tekst_plana);
  if (plan_json == NULL) {
    vstal("план не разобран");
  }
  const json *spisok_processov = j_pole(plan_json, "процессы");
  if (spisok_processov != NULL && spisok_processov->vid == J_SPISOK) {
    for (size_t nomer = 0; nomer < spisok_processov->chlenov && planov < PROCESSOV; nomer += 1) {
      const json *p = spisok_processov->chleny[nomer];
      snprintf(plan[planov].imya, sizeof plan[0].imya, "%s", j_tekst_polya(p, "имя", ""));
      snprintf(plan[planov].nachalnoe, sizeof plan[0].nachalnoe, "%s", j_tekst_polya(p, "начальное", ""));
      snprintf(plan[planov].obrabotchik, sizeof plan[0].obrabotchik, "%s",
               j_tekst_polya(p, "обработчик", ""));
      const json *dlina = j_pole(p, "ящик");
      plan[planov].yaschik = dlina != NULL && dlina->vid == J_CHISLO ? chislo_vnutr(dlina->tekst) : 0.0;
      planov += 1;
    }
  }

  // Таблица процессов — значение эталона. Свои и представители различаются
  // признаком, а не двумя списками: так решено на flang.
  fl_value *processy = NULL;
  NADO(fl_list_alloc(&ctx, planov, &processy, &beda));
  for (size_t nomer = 0; nomer < planov; nomer += 1) {
    const char *gde = j_tekst_polya(razmeschenie, plan[nomer].imya, "");
    bool svoy = strcmp(gde, moyo_imya) == 0;
    fl_value chto = fl_nothing();
    NADO(uzel_zamera_process_uzla(&ctx, tekst(plan[nomer].imya),
                                  tekst(plan[nomer].obrabotchik), fl_flag(svoy),
                                  tekst(svoy ? "" : gde), fl_flag(true), tekst(""),
                                  fl_number(plan[nomer].yaschik), fl_number(0), fl_list(NULL, 0),
                                  &chto, &beda));
    processy[nomer] = chto;
    if (svoy) {
      fl_value nachalnoe = fl_nothing();
      NADO(uzel_zamera_call(&ctx, plan[nomer].nachalnoe, NULL, 0, &nachalnoe, &beda));
      snprintf(imena_sostoyaniy[sostoyaniy], sizeof imena_sostoyaniy[0], "%s", plan[nomer].imya);
      sostoyaniya[sostoyaniy] = nachalnoe;
      sostoyaniy += 1;
    }
  }
  NADO(uzel_zamera_uzel_zanovo(&ctx, tekst(moyo_imya), fl_list(processy, planov), fl_list(NULL, 0),
                               tekst(""), fl_number(0), fl_flag(true), &uzel, &beda));

  // Соседи считаются по ПРЕДСТАВИТЕЛЯМ, а не по «звонить»: узел, которого
  // набирает сосед, ждёт его ровно так же, и место под связь ему нужно такое
  // же. Без этого принимающая сторона отказывала бы в соединении.
  const json *zvonit = j_pole(razmeschenie, "звонить");
  for (size_t nomer = 0; nomer < planov; nomer += 1) {
    const char *gde = j_tekst_polya(razmeschenie, plan[nomer].imya, "");
    if (strcmp(gde, moyo_imya) == 0) {
      continue;
    }
    bool uzhe = false;
    for (size_t est = 0; est < kanalov; est += 1) {
      if (strcmp(kanaly[est].kto, gde) == 0) {
        uzhe = true;
      }
    }
    if (uzhe || kanalov >= SVYAZEY) {
      continue;
    }
    snprintf(kanaly[kanalov].kto, sizeof kanaly[0].kto, "%s", gde);
    snprintf(kanaly[kanalov].adres, sizeof kanaly[0].adres, "%s", j_tekst_polya(zvonit, gde, ""));
    kanaly[kanalov].soket = -1;
    s_init(&kanaly[kanalov].hvost);
    kanaly[kanalov].kogda_zvonit = 0.0;
    kanaly[kanalov].posledniy_puls = 0.0;
    NADO(uzel_zamera_svyaz_uzla_zanovo(&ctx, tekst(gde), fl_flag(false), fl_flag(false),
                                       fl_flag(false), fl_flag(false), fl_flag(false), fl_number(0),
                                       &kanaly[kanalov].sostoyanie, &beda));
    kanalov += 1;
  }

  // Дерево надзора — данные, ровно как размещение. Решает по нему напечатанный
  // supervisor.flang, а не этот файл.
  const json *spisok_nadzorov = j_pole(plan_json, "надзоры");
  size_t nadzorov = spisok_nadzorov != NULL && spisok_nadzorov->vid == J_SPISOK ? spisok_nadzorov->chlenov : 0;
  fl_value *nadzirateli = NULL;
  NADO(fl_list_alloc(&ctx, nadzorov, &nadzirateli, &beda));
  fl_value svyazi[2][SVYAZEY * PROCESSOV];
  size_t svyazey[2] = {0, 0};
  for (size_t nomer = 0; nomer < nadzorov; nomer += 1) {
    const json *n = spisok_nadzorov->chleny[nomer];
    const char *imya_nadzora = j_tekst_polya(n, "имя", "");
    const json *porog = j_pole(n, "порог");
    const json *okno = j_pole(n, "окно");
    fl_value nadziratel = fl_nothing();
    NADO(uzel_zamera_nadziratel_uzla(
        &ctx, tekst(imya_nadzora),
        fl_number(porog != NULL && porog->vid == J_CHISLO ? chislo_vnutr(porog->tekst) : 0.0),
        fl_number(okno != NULL && okno->vid == J_CHISLO ? chislo_vnutr(okno->tekst) : 0.0),
        tekst(j_tekst_polya(n, "иначе", "остановить")), &nadziratel, &beda));
    nadzirateli[nomer] = nadziratel;
    const char *klyuchi_svyazey[2] = {"процессы", "надзоры"};
    for (size_t vid = 0; vid < 2; vid += 1) {
      const json *spisok = j_pole(n, klyuchi_svyazey[vid]);
      if (spisok == NULL || spisok->vid != J_SPISOK) {
        continue;
      }
      for (size_t est = 0; est < spisok->chlenov; est += 1) {
        if (svyazey[vid] >= SVYAZEY * PROCESSOV) {
          vstal("связей надзора слишком много");
        }
        fl_value svyaz = fl_nothing();
        NADO(uzel_zamera_svyaz_nadzora_uzla(
            &ctx, tekst(j_tekst_polya(spisok->chleny[est], "кто", "")), tekst(imya_nadzora),
            tekst(j_tekst_polya(spisok->chleny[est], "стратегия", "")), &svyaz, &beda));
        svyazi[vid][svyazey[vid]] = svyaz;
        svyazey[vid] += 1;
      }
    }
  }
  fl_value *nad_processom = NULL;
  fl_value *nad_nadzorom = NULL;
  NADO(fl_list_alloc(&ctx, svyazey[0], &nad_processom, &beda));
  NADO(fl_list_alloc(&ctx, svyazey[1], &nad_nadzorom, &beda));
  for (size_t nomer = 0; nomer < svyazey[0]; nomer += 1) {
    nad_processom[nomer] = svyazi[0][nomer];
  }
  for (size_t nomer = 0; nomer < svyazey[1]; nomer += 1) {
    nad_nadzorom[nomer] = svyazi[1][nomer];
  }
  NADO(uzel_zamera_derevo_nadzora_uzla(&ctx, fl_list(nadzirateli, nadzorov),
                                       fl_list(nad_processom, svyazey[0]),
                                       fl_list(nad_nadzorom, svyazey[1]), &derevo, &beda));

  const char *adres = dovod("слушать", "");
  int port = adres[0] == '\0' ? 0 : slushat_na(adres);

  stroka podnyat;
  s_init(&podnyat);
  s_slovo(&podnyat, "{\"в\":\"поднят\",\"узел\":");
  s_citata(&podnyat, moyo_imya, strlen(moyo_imya));
  s_slovo(&podnyat, ",\"цель\":\"" CEL "\",\"порт\":");
  s_chislo(&podnyat, port);
  s_slovo(&podnyat, ",\"хэш\":");
  {
    size_t skolko = strlen(moy_hesh) < 12 ? strlen(moy_hesh) : 12;
    s_citata(&podnyat, moy_hesh, skolko);
  }
  s_slovo(&podnyat, ",\"сроки\":{\"срок\":");
  s_chislo(&podnyat, srok);
  s_slovo(&podnyat, ",\"пульс\":");
  s_chislo(&podnyat, puls_srok);
  s_slovo(&podnyat, ",\"пауза\":");
  s_chislo(&podnyat, pauza);
  s_slovo(&podnyat, "}}");
  printf("%s\n", podnyat.dannye);  // МИР
  fflush(stdout);  // МИР
  free(podnyat.dannye);

  // Начальные письма — тем же путём, каким приходят письма с провода.
  json *vbrosy = j_razobrat(dovod("вбросить", "[]"));
  if (vbrosy != NULL && vbrosy->vid == J_SPISOK) {
    for (size_t nomer = 0; nomer < vbrosy->chlenov; nomer += 1) {
      const json *vbros = vbrosy->chleny[nomer];
      fl_value gruz = raskodirovat(j_pole(vbros, "что"));
      fl_value sobytie = fl_nothing();
      NADO(uzel_zamera_variant_pismo_snaruzhi(&ctx, tekst(j_tekst_polya(vbros, "кому", "")),
                                              fl_number(novyy_bilet(gruz)), &sobytie, &beda));
      uzel_sluchilsya(sobytie);
    }
  }
  j_osvobodit(vbrosy);

  krug(chasy() + dovod_chislo("жить", 5.0) * 1000.0);

  stroka konec;
  s_init(&konec);
  s_slovo(&konec, "{\"в\":\"конец\",\"узел\":");
  s_citata(&konec, moyo_imya, strlen(moyo_imya));
  s_slovo(&konec, ",\"цель\":\"" CEL "\",\"состояния\":{");
  for (size_t nomer = 0; nomer < sostoyaniy; nomer += 1) {
    if (nomer > 0) {
      s_slovo(&konec, ",");
    }
    s_citata(&konec, imena_sostoyaniy[nomer], strlen(imena_sostoyaniy[nomer]));
    s_slovo(&konec, ":");
    s_znachenie(&konec, sostoyaniya[nomer]);
  }
  s_slovo(&konec, "}}");
  printf("%s\n", konec.dannye);  // МИР
  fflush(stdout);  // МИР
  free(konec.dannye);

  j_osvobodit(posledniy_kadr);
  j_osvobodit(plan_json);
  j_osvobodit(razmeschenie);
  for (size_t nomer = 0; nomer < kanalov; nomer += 1) {
    if (kanaly[nomer].soket >= 0) {
      close(kanaly[nomer].soket);  // МИР
    }
    free(kanaly[nomer].hvost.dannye);
  }
  if (server >= 0) {
    close(server);  // МИР
  }
  fl_arena_release(&arena);
  return 0;
}
