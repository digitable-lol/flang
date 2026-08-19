/*
 * Сгенерировано flang (бэкенд C, flang/src/emit/c.mjs). Не редактировать руками.
 * Модуль flang: «Компилятор flang».
 * Файл: оболочка: «flang repl» для человека.
 * Правьте исходник на flang и печатайте заново: любая правка здесь потеряется.
 */
#define FL_PROGRAM_CALL kompilyator_flang_call
#define FL_PROGRAM_ENTRY kompilyator_flang_entry

/* SPDX-FileCopyrightText: 2026 Digitable (Marat Zimnurov) */
/* SPDX-License-Identifier: BSD-2-Clause */
/*
 * Человеческий вход бинарника flang: `--help`, `--version`, `check`, `repl`.
 *
 * ── Зачем он вообще нужен ───────────────────────────────────────────────────
 * `brew install flang` кладёт человеку бинарник с именем языка. Пока у этого
 * бинарника был один вход — JSON со стандартного ввода, — поставивший язык не
 * мог сделать им ничего: `flang --help` молчал и отвечал нулём, `flang check
 * файл.flang` молчал и отвечал нулём. Инструмент, который на любую команду
 * молчит и говорит «всё хорошо», хуже отсутствующего: человек уверен, что
 * проверил, а не проверил ничего.
 *
 * Прогонщик при этом остался прогонщиком: без аргументов (и по явному `--json`)
 * бинарник читает JSON со стандартного ввода ровно как прежде — этим контрактом
 * живут тест формулы Homebrew, проба плагина asdf, `scripts/build-release-c.mjs`
 * и всякий, кто зовёт программу на flang из чужого языка через трубу.
 *
 * ── Почему это отдельный файл печати ────────────────────────────────────────
 * Рядом лежит прогонщик (flang_cli.c), и у него есть обещание, которое этот
 * файл выполнить не может: напечатанный C ни от чего не зависит и ничего не
 * спрашивает у мира — ни времени, ни случайности, ни окружения (проверка
 * «напечатанный C ни от чего не зависит и объясняет себя» в
 * flang/test/emit-c.test.mjs). Человеческий же вход обязан спросить: где `cc`,
 * где каталоги установки, есть ли человек на том конце, что лежит в файле,
 * который он назвал. Значит ему нужны POSIX и переменные окружения — и держать
 * его в одном файле с прогонщиком значило бы тихо лишить переносимости всё
 * напечатанное, включая чужие программы, которым человеческий вход не нужен
 * вовсе.
 *
 * Поэтому файла два, а бинарник один: `flang_cli` линкуется с обоими, и
 * прогонщик зовёт `fl_human_main`, увидев в аргументах хоть что-нибудь, кроме
 * `--json`. Кто берёт напечатанный C к себе в проект, берёт flang_cli.c без
 * этого файла — и остаётся с чистым C99.
 *
 * Печатается этот файл по просьбе (`repl: true` у бэкенда), и просит его ровно
 * одно место — `scripts/build-release-c.mjs`, который собирает релиз самого
 * компилятора. У любой другой напечатанной программы нет точек входа, которые
 * оболочка зовёт, и возить ей сто с лишним килобайт кода, который она не может
 * исполнить, незачем.
 *
 * ── Одна дорога у проверки и у оболочки ─────────────────────────────────────
 * `flang check` и приём объявления в сессию ходят одной и той же дорогой
 * (`repl_check_sources`): связывание → типы → завершаемость, в том же порядке,
 * что у точки входа «Проверить исходники». Это не экономия строк. Разойдись
 * дороги — оболочка принимала бы то, что `flang check` отвергает, и человек
 * узнавал бы об этом на сборке, а не при вводе.
 *
 * ── Почему сессия хранит ИСХОДНИК ───────────────────────────────────────────
 * Ровно тот же довод, что в `flang/src/repl.mjs`: сессия — это программа на
 * flang, а не набор разобранных узлов. На каждом вводе исходник пересобирается
 * целиком и проходит ту же дорогу, что `flang check`, — связывание, типы,
 * завершаемость. Совпадение дорог не оптимизация: разойдись они, и оболочка
 * принимала бы то, что компилятор отвергает.
 *
 * ── Чем вычисляется выражение ───────────────────────────────────────────────
 * Вычислитель в этом бинарнике теперь ЕСТЬ — `flang/self/interpret.flang` втащен
 * в замыкание компилятора, — но ОБОЛОЧКА ЕГО ПОКА НЕ ЗОВЁТ, и это долг, а не
 * решение: сессия у неё живёт исходником, а не связанной программой, и точка
 * входа «Прогон исходников» просит имя функции и аргументы, которых у свободного
 * выражения нет. Пока долг не закрыт, выражение вычисляется прежним способом —
 * сессия печатается в C (та же «Печать программы», что у `flang emit`),
 * собирается системным `cc` и запускается. Пересобирать при этом нечего, кроме
 * самой сессии: рантайм уже стоит рядом с бинарником — `lib/libkompilyator_flang.a`
 * и заголовки в `include/` кладут и формула Homebrew, и плагин asdf.
 *
 * Без `cc` оболочка не выключается: она по-прежнему проверяет разбор, типы и
 * завершаемость — то есть делает ровно то, что бинарник умеет. Про то, что
 * значения при этом не считаются, сказано один раз при запуске, а не на каждой
 * строке.
 *
 * ── Команды через точку ─────────────────────────────────────────────────────
 * Те же, что в Node-версии, и по той же причине: ни одна конструкция flang не
 * может начинаться с точки, значит строка с точки заведомо не программа. Имена
 * команд — русские и английские, как две поверхности самого языка.
 */

/*
 * POSIX просит об этом сама оболочка: временный каталог (mkdtemp), поиск
 * бинарника (access, getcwd), «человек ли на том конце» (isatty) и Ctrl-C,
 * который бросает набранное, а не сессию (sigaction). При `-std=c99` glibc
 * прячет всё это, пока не сказано, какой POSIX нужен. Объявление под #ifndef:
 * если вызывающий уже назвал свою версию, спорить не о чем — переопределение
 * стоило бы предупреждения, а сборка идёт с -Werror.
 */
#ifndef _POSIX_C_SOURCE
#define _POSIX_C_SOURCE 200809L
#endif

#include "flang_runtime.h"

#include <errno.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

/*
 * Единственная связь оболочки с конкретной программой — вызов функции по имени,
 * та же, что у прогонщика. Бэкенд печатает `#define FL_PROGRAM_CALL
 * <префикс>_call` перед этим файлом; запасное имя ниже нужно, чтобы файл
 * компилировался и сам по себе.
 */
#ifndef FL_PROGRAM_CALL
#define FL_PROGRAM_CALL fl_program_call
#endif

extern fl_status FL_PROGRAM_CALL(fl_ctx *ctx, const char *name, const fl_value *args, size_t count,
                                 fl_value *result, fl_error *error);

/*
 * Второй мост к программе — ЕЁ СОБСТВЕННАЯ ГРАНИЦА ВХОДА: объявленные типы
 * параметров, впечатанные в программу данными (fl_entry_table). Нужен он ровно
 * одному месту — `flang emit --target c`, печатающей САМ КОМПИЛЯТОР.
 *
 * Зачем. Таблицу строит слой типов свидетеля (`таблицаВхода`, flang/src/types.mjs),
 * и на flang его нет: `flang/self/types.flang` эту таблицу не строит. Значит
 * бинарнику взять её неоткуда — кроме одного случая, когда она у него уже есть:
 * когда печатаемая программа и есть та программа, которой бинарник является.
 * Тогда его собственная таблица и есть искомая, байт в байт.
 *
 * Случай этот не угадывается, а ПРОВЕРЯЕТСЯ: печать берёт таблицу только если
 * список пар «функция, параметр» связанной программы совпадает с впечатанным
 * — по порядку, по числу и по именам (`emit_entry_fits`). Не совпал — таблица
 * пуста, и об этом сказано числом на stderr, а не умолчанием.
 */
#ifndef FL_PROGRAM_ENTRY
#define FL_PROGRAM_ENTRY fl_program_entry
#endif

extern const fl_entry_table *FL_PROGRAM_ENTRY(void);

/*
 * Чтение файла целиком. У прогонщика есть такое же — и это не досадный повтор,
 * а цена отдельности: файлы обязаны собираться порознь, и общий заголовок между
 * ними завёл бы третий файл ради двадцати строк.
 */
static char *repl_read_all(FILE *stream, size_t *length) {
  size_t capacity = 65536;
  size_t used = 0;
  char *data = (char *)malloc(capacity);
  if (data == NULL) {
    return NULL;
  }
  for (;;) {
    const size_t got = fread(data + used, 1, capacity - used - 1, stream);
    used += got;
    if (used + 1 < capacity) {
      break;
    }
    {
      char *bigger = (char *)realloc(data, capacity * 2);
      if (bigger == NULL) {
        free(data);
        return NULL;
      }
      data = bigger;
      capacity *= 2;
    }
  }
  data[used] = '\0';
  *length = used;
  return data;
}

/** Имя функции-обёртки, в которой вычисляется выражение. */
#define REPL_EXPR_NAME "⟨выражение⟩"

/** Имя модуля сессии: нужно заголовку, без которого не работает «использует». */
#define REPL_MODULE "Оболочка"

/** Имя файла сессии — от него связывание отсчитывает относительные пути. */
#define REPL_FILE "«оболочка».flang"

/** Архив рантайма, который кладут формула и плагин; каталог ищется, имя — нет. */
#define REPL_ARCHIVE "libkompilyator_flang.a"

/** Сколько объявлений печатать поимённо, прежде чем перейти к счёту. */
#define REPL_VERBOSE 6

/*
 * Версия языка. Живёт она в четырёх местах — здесь, в package.json, в формуле
 * Homebrew и в заголовке страницы руководства, — и это не оплошность: бинарник
 * собирается без Node и без brew, и прочитать чужой файл ему неоткуда.
 * Расхождение ловят два теста: flang/test/manpage.test.mjs сверяет все четыре
 * записи между собой, а flang/test/self-bootstrap.test.mjs спрашивает версию у
 * СОБРАННОГО бинарника. Иначе `flang --version` однажды назвал бы версию,
 * которой нет ни в одном релизе.
 */
#define FLANG_VERSION "0.5.0"

static const char REPL_GREETING[] =
    "flang " FLANG_VERSION " — оболочка. «.помощь» — команды, «.выход» или Ctrl-D — конец.\n"
    "Объявление заканчивается пустой строкой, выражение вычисляется сразу.";

/*
 * То же приветствие, когда вычислять нечем. Обещать вычисление и тут же, второй
 * строкой в stderr, признаваться, что его не будет, — ровно тот способ врать,
 * от которого этот файл и заводился: человек читает первое и не читает второе.
 */
static const char REPL_GREETING_NO_EVAL[] =
    "flang " FLANG_VERSION " — оболочка. «.помощь» — команды, «.выход» или Ctrl-D — конец.\n"
    "Объявление заканчивается пустой строкой; выражение проверяется, но не вычисляется — почему, сказано ниже.";

/*
 * СПРАВКА В ДВА ЭТАЖА, и здесь перечислено то, что умеет ФАЙЛ, поставленный из
 * brew или asdf, — ровно оно. Печати в остальные семь целей и проверки суждений
 * в этом бинарнике нет, поэтому их здесь нет тоже: справка, обещающая
 * несуществующее, обходится дороже отсутствующей — по ней человек строит работу.
 * Команда попадает сюда ПОСЛЕ того, как заработала, а не вместе с замыслом.
 *
 * Первый этаж короткий: имя с версией, одна строка о том, что это, пять главных
 * команд и способ узнать остальное. Прежде здесь лежала простыня на 4 083 байта,
 * и первым, что видел поставивший язык, была она. Полный перечень ключей уехал
 * на второй этаж — `flang <команда> --help`, — и туда идут те, кому он нужен.
 *
 * Синопсис страницы руководства сверяется с ПЕРВЫМ этажом
 * (flang/test/manpage.test.mjs): страница и справка обязаны называть одни и те
 * же команды.
 */
/* ПРЕДЕЛ ISO C99 НА ОДИН ЛИТЕРАЛ — 4095 БАЙТ, И СЧИТАЕТСЯ ДЛИНА СКЛЕЙКИ соседних
   литералов, а не строки; в UTF-8 кириллица занимает по два байта, так что предел
   приходит вдвое быстрее, чем кажется по экрану. Однажды `cc
   -Werror=overlength-strings` уже отказался собирать компилятор, и неподвижная
   точка встала целиком. Оттого справка и разложена по массиву на команду: каждый
   этаж меряется отдельно, и запас у каждого свой. */
static const char FLANG_HELP[] =
    "flang " FLANG_VERSION " — язык, проверяемый до запуска: типы и доказанное завершение.\n"
    "\n"
    "  flang                              оболочка: объявляй и считай сразу\n"
    "  flang check <файл>                 разбор, типы, завершаемость, доказательства\n"
    "  flang test <файл>                  прогон примеров, объявленных внутри функций\n"
    "  flang run <файл> --function «Имя»  вычислить одну функцию и напечатать значение\n"
    "  flang emit <файл> --target c       напечатать программу в C99\n"
    "  flang repl [файл]                  та же оболочка, названная по имени\n"
    "\n"
    "  flang --help                       эта справка\n"
    "  flang --version                    версия\n"
    "  flang <команда> --help             все ключи команды\n"
    "\n"
    "Без доводов и без терминала на входе (конвейер, «--json») бинарник остаётся\n"
    "прогонщиком: JSON на входе, JSON на выходе, по запросу на строку.\n"
    "\n"
    "Здесь 6 команд, у полного инструментария их 12: сверх этих есть ast, facts,\n"
    "io, lock и package, а с ними остальные семь целей печати, законы на сетке и\n"
    "суждения.\n"
    "Ему нужен Node: npm install -g @digitable-lol/fts\n"
    "\n"
    "Подробности: man flang";

static const char HELP_CHECK[] =
    "flang check <файл.flang> [--proof [--json]]\n"
    "\n"
    "Разбор, типы, завершаемость, ядро доказательства. Замечания с кодом и местом,\n"
    "код возврата 1, если программа не прошла.\n"
    "\n"
    "  --proof   ведомость: чем несётся обещание «тотальная» у каждой функции и чем\n"
    "            — каждое высказанное утверждение\n"
    "  --json    вместе с --proof: ведомость машинным видом\n"
    "\n"
    "Ведомость бинарник печатает у программы, где всё, о чём она отчитывается, он\n"
    "ПОСЧИТАЛ САМ. Законы, считаемые вычислением на сетке (моноид, монада,\n"
    "изоморфизм, категория, множества, связь и пять объявленных свойств), в\n"
    "бинарнике не считает никто, и программа, где такое объявлено, получает отказ с\n"
    "названным препятствием, а не зелёную ведомость с пустым разделом. Поиск\n"
    "нарушений по примерам тоже не переехал: ведомость говорит «не искали», а не\n"
    "«не найдено».";

static const char HELP_TEST[] =
    "flang test <файл.flang> [--no-check] [--max-steps N] [--max-depth N]\n"
    "\n"
    "Прогон примеров, объявленных внутри функций. Сначала проверяет программу теми\n"
    "же проверками, что и check: «пример сошёлся» на программе с ошибкой типов не\n"
    "значит ничего.\n"
    "\n"
    "  --no-check      не проверять — смотреть на поведение примеров, пока\n"
    "                  программа ещё в правке\n"
    "  --max-steps N   предел шагов вычислителя\n"
    "  --max-depth N   предел глубины";

static const char HELP_RUN[] =
    "flang run <файл.flang> --function «Имя» [--args '{\"н\":10}'] [--max-steps N]\n"
    "                       [--max-depth N]\n"
    "\n"
    "Вычисляет ОДНУ функцию и печатает значение. Считает вычислитель, втащенный в\n"
    "замыкание бинарника (flang/self/interpret.flang), — без Node и без «cc».\n"
    "\n"
    "Аргументы сверяются объявленным типам ДО вычисления, тем же кодом, каким это\n"
    "делает свидетель: «Факториал» от −3 отвергается FLANG_TYPE, а не считается.\n"
    "\n"
    "  --function «Имя»   что вычислять\n"
    "  --args '{…}'       аргументы JSON-объектом\n"
    "  --max-steps N      предел шагов вычислителя\n"
    "  --max-depth N      предел глубины";

static const char HELP_EMIT[] =
    "flang emit <файл.flang> --target c [--out каталог | --file имя]\n"
    "                        [--cli|--no-cli] [--repl] [--runtime каталог]\n"
    "                        [--index-base 0|1] [--max-steps N] [--max-depth N]\n"
    "\n"
    "Печатает программу в C99 без Node; рантайм C читается с диска (--runtime,\n"
    "$FLANG_RUNTIME_DIR). ДВУХ ВЕЩЕЙ У НЕЁ НЕТ: недостижимое не отбрасывается,\n"
    "доказанное не метится («markProven»). На компиляторе это 6 файлов из 7 байт в\n"
    "байт.\n"
    "\n"
    "  --target c        единственная цель этого бинарника\n"
    "  --out каталог     записать все файлы в каталог\n"
    "  --file имя        один файл на стандартный вывод\n"
    "  --cli | --no-cli  печатать ли прогонщик\n"
    "  --repl            напечатать ещё и человеческий вход\n"
    "  --runtime каталог откуда читать рантайм C\n"
    "\n"
    "Остальные семь целей (js, go, rust, python, java, csharp, elixir) написаны на\n"
    "flang (flang/self/emit-*.flang), но в замыкание этого бинарника не входят.";

static const char HELP_REPL[] =
    "flang repl [<файл.flang>] [--max-steps N] [--max-depth N]\n"
    "\n"
    "Интерактивная оболочка — то же самое, что голая команда «flang» на терминале.\n"
    "Объявления накапливаются в сессии, выражения вычисляются сразу, «.помощь»\n"
    "показывает команды. Файл в аргументе загружается в сессию при запуске.\n"
    "\n"
    "Выражение считается так: сессия печатается в C (та же «Печать программы», что\n"
    "у «flang emit»), собирается системным «cc» против lib/libkompilyator_flang.a и\n"
    "запускается. Нет «cc» — оболочка не выключается, а проверяет разбор, типы и\n"
    "завершаемость и говорит об этом при запуске.\n"
    "Где искать: FLANG_CC, FLANG_INCLUDE_DIR, FLANG_LIB_DIR.";

/**
 * Второй этаж справки: раздел команды, если он есть, иначе первый этаж.
 *
 * Раздела нет — печатается краткий перечень. Это не заглушка: команда без своих
 * ключей объяснена в перечне целиком, и пустой раздел был бы обещанием
 * подробностей, которых нет.
 */
static void human_help(const char *topic) {
  if (topic == NULL) {
    printf("%s\n", FLANG_HELP);
  } else if (strcmp(topic, "check") == 0) {
    printf("%s\n", HELP_CHECK);
  } else if (strcmp(topic, "test") == 0) {
    printf("%s\n", HELP_TEST);
  } else if (strcmp(topic, "run") == 0) {
    printf("%s\n", HELP_RUN);
  } else if (strcmp(topic, "emit") == 0) {
    printf("%s\n", HELP_EMIT);
  } else if (strcmp(topic, "repl") == 0) {
    printf("%s\n", HELP_REPL);
  } else {
    printf("%s\n", FLANG_HELP);
  }
}

static const char REPL_HELP[] =
    "Оболочка flang.\n"
    "\n"
    "Объявление вводится в несколько строк; пустая строка заканчивает ввод:\n"
    "\n"
    "  тотальная функция «Удвоить»\n"
    "    принимает х: число\n"
    "    возвращает число\n"
    "    х умножить на 2\n"
    "  <пустая строка>\n"
    "\n"
    "Выражение вычисляется сразу:\n"
    "\n"
    "  «Удвоить» от 21        →  42\n"
    "\n"
    "Объявление проверяется той же дорогой, что и «flang check»: разбор, типы,\n"
    "завершаемость. Не прошедшее проверку в сессию не попадает.\n"
    "\n"
    "Команды (строка с точки — точкой не может начаться ни одна конструкция языка):\n"
    "  .помощь                    эта справка\n"
    "  .объявления                что объявлено в сессии\n"
    "  .исходник                  исходник сессии целиком\n"
    "  .сохранить <файл>          записать исходник сессии в файл\n"
    "  .загрузить <файл>          добавить объявления из файла .flang\n"
    "  .сбросить                  забыть всё объявленное\n"
    "  .выход                     закончить работу\n"
    "По-английски: .help .list .source .save .load .reset .quit\n"
    "\n"
    "Модули подключаются строкой языка, а не командой:\n"
    "  использует «Списки» из \"flang/stdlib/lists.flang\"\n"
    "\n"
    "Значения печатаются поверхностью языка: да, нет, ничто, \"текст\", [1, 2, 3],\n"
    "пустой список, {поле: значение}, Вариант(поле: значение).\n"
    "\n"
    "Тотальная функция завершается — это доказано. Обычная функция может не\n"
    "завершиться: её вычисление ограничено лимитом шагов, и на превышении лимита\n"
    "оболочка говорит FLANG_RECURSION_LIMIT, а не «результата нет».";

/*
 * Ключевые слова, с которых начинается объявление, — тот же набор, по которому
 * выбирает `parseDeclaration`. Список кончается NULL, чтобы не заводить рядом
 * второе число, которое однажды разойдётся с самим списком.
 */
static const char *const REPL_DECLARATIONS[] = {
    "module", "exports", "uses", "category", "object", "record", "type",
    "total", "function", "utility", "morphism", "chain", "identity", "theorem", "functor", NULL};

/*
 * Объявления, у которых тело — отступный блок ниже: их ввод не может кончиться
 * на первой строке. Однострочные заголовки («модуль», «использует», «морфизм»)
 * сюда не входят — им продолжение не нужно.
 */
static const char *const REPL_BLOCKS[] = {
    "object", "record", "type", "total", "function", "utility", "category", "chain", "functor", "theorem", NULL};

/*
 * Диагностики связывания, чьё место — в ЧУЖОМ файле. Диагностика flang несёт
 * строку и столбец, но не файл: после связывания «строка 12» может относиться
 * и к сессии, и к импортированному модулю. Там, где принадлежность точно
 * чужая, место лучше не показывать вовсе — неверное место хуже отсутствующего.
 */
static const char *const REPL_FOREIGN[] = {
    "FLANG_DUPLICATE_NAME", "FLANG_IMPORT_CYCLE", "FLANG_IMPORT_NOT_FOUND", "FLANG_IMPORT_NAME", NULL};

static bool repl_in_list(const char *const *list, const char *word, size_t bytes) {
  size_t index = 0;
  for (index = 0; list[index] != NULL; index += 1) {
    if (strlen(list[index]) == bytes && memcmp(list[index], word, bytes) == 0) {
      return true;
    }
  }
  return false;
}

/* ───────────────────────────── память и строки ───────────────────────────── */

/*
 * Кончившаяся память в оболочке — конец работы, а не случай, из которого можно
 * выйти: продолжать с половиной сессии значило бы врать про её содержимое.
 * Поэтому нехватка памяти прекращает работу здесь, а не едет статусом через
 * шесть десятков функций, затемняя в каждой то, ради чего она написана.
 */
static void repl_oom(void) {
  fputs("оболочка: кончилась память\n", stderr);
  exit(1);
}

static void *repl_alloc(size_t size) {
  void *block = malloc(size == 0 ? 1 : size);
  if (block == NULL) {
    repl_oom();
  }
  return block;
}

static void *repl_grow(void *block, size_t size) {
  void *bigger = realloc(block, size == 0 ? 1 : size);
  if (bigger == NULL) {
    repl_oom();
  }
  return bigger;
}

static char *repl_dup(const char *text, size_t bytes) {
  char *copy = (char *)repl_alloc(bytes + 1);
  memcpy(copy, text, bytes);
  copy[bytes] = '\0';
  return copy;
}

static char *repl_say(const char *text) { return repl_dup(text, strlen(text)); }

/** Растущий текст: исходник сессии, ответ, аргумент команды. */
typedef struct repl_buf {
  char *data;
  size_t used;
  size_t capacity;
} repl_buf;

static void buf_init(repl_buf *buf) {
  buf->capacity = 256;
  buf->data = (char *)repl_alloc(buf->capacity);
  buf->data[0] = '\0';
  buf->used = 0;
}

static void buf_free(repl_buf *buf) {
  free(buf->data);
  buf->data = NULL;
  buf->used = 0;
  buf->capacity = 0;
}

static void buf_add(repl_buf *buf, const char *text, size_t bytes) {
  if (buf->used + bytes + 1 > buf->capacity) {
    while (buf->used + bytes + 1 > buf->capacity) {
      buf->capacity *= 2;
    }
    buf->data = (char *)repl_grow(buf->data, buf->capacity);
  }
  memcpy(buf->data + buf->used, text, bytes);
  buf->used += bytes;
  buf->data[buf->used] = '\0';
}

static void buf_put(repl_buf *buf, const char *text) { buf_add(buf, text, strlen(text)); }

static void buf_char(repl_buf *buf, char symbol) { buf_add(buf, &symbol, 1); }

static void buf_number(repl_buf *buf, size_t number) {
  char text[32];
  sprintf(text, "%lu", (unsigned long)number);
  buf_put(buf, text);
}

static void buf_reset(repl_buf *buf) {
  buf->used = 0;
  buf->data[0] = '\0';
}

/**
 * Список строк во владении: имена объявлений, пути, экспорты — и ИСХОДНИКИ.
 *
 * Длина хранится рядом, а не считается `strlen`, и это не запас на будущее.
 * Исходник flang законно содержит НУЛЕВОЙ БАЙТ: `"\0"` — обычный строковый
 * литерал языка, и в `flang/self/link.flang` он стоит разделителем ключа
 * («Ход категорных», строка 890). Пока длина бралась `strlen`, такой файл
 * приезжал в компилятор обрезанным по первому нулю, и лексер отвечал на него
 * «не закрыта кавычка» — то есть БИНАРНИК НЕ МОГ ПРОЧИТАТЬ СВОЙ СОБСТВЕННЫЙ
 * СЛОЙ СВЯЗЫВАНИЯ, а `check` компилятора недосчитывался 135 функций из 3431 и
 * сыпал «неизвестная функция «Связать исходники»».
 */
typedef struct repl_strings {
  char **items;
  size_t *sizes;
  size_t count;
  size_t capacity;
} repl_strings;

static void strings_init(repl_strings *list) {
  list->items = NULL;
  list->sizes = NULL;
  list->count = 0;
  list->capacity = 0;
}

static void strings_add(repl_strings *list, const char *text, size_t bytes) {
  if (list->count == list->capacity) {
    list->capacity = list->capacity == 0 ? 8 : list->capacity * 2;
    list->items = (char **)repl_grow(list->items, list->capacity * sizeof(char *));
    list->sizes = (size_t *)repl_grow(list->sizes, list->capacity * sizeof(size_t));
  }
  list->items[list->count] = repl_dup(text, bytes);
  list->sizes[list->count] = bytes;
  list->count += 1;
}

static void strings_say(repl_strings *list, const char *text) { strings_add(list, text, strlen(text)); }

static bool strings_has(const repl_strings *list, const char *text, size_t bytes) {
  size_t index = 0;
  for (index = 0; index < list->count; index += 1) {
    if (list->sizes[index] == bytes && memcmp(list->items[index], text, bytes) == 0) {
      return true;
    }
  }
  return false;
}

static void strings_free(repl_strings *list) {
  size_t index = 0;
  for (index = 0; index < list->count; index += 1) {
    free(list->items[index]);
  }
  free(list->items);
  free(list->sizes);
  strings_init(list);
}

/* ───────────────────────────── пути и каталоги ───────────────────────────── */

static char *repl_join(const char *left, const char *right) {
  repl_buf buf;
  char *result = NULL;
  buf_init(&buf);
  buf_put(&buf, left);
  if (buf.used > 0 && buf.data[buf.used - 1] != '/') {
    buf_char(&buf, '/');
  }
  buf_put(&buf, right);
  result = repl_dup(buf.data, buf.used);
  buf_free(&buf);
  return result;
}

static char *repl_dirname(const char *path) {
  const char *slash = strrchr(path, '/');
  if (slash == NULL) {
    return repl_say(".");
  }
  if (slash == path) {
    return repl_say("/");
  }
  return repl_dup(path, (size_t)(slash - path));
}

/*
 * `resolve` свидетеля: путь становится абсолютным и нормализованным. Разделитель
 * один — косая черта; тем же одним разделителем обходится и связывание внутри
 * компилятора («Разрешить путь» в bootstrap/compiler.flang).
 */
static char *repl_resolve(const char *base, const char *path) {
  repl_strings parts;
  repl_buf buf;
  const char *scan = NULL;
  char *result = NULL;
  size_t index = 0;
  strings_init(&parts);
  buf_init(&buf);
  if (path[0] != '/') {
    buf_put(&buf, base);
    buf_char(&buf, '/');
  }
  buf_put(&buf, path);
  scan = buf.data;
  while (*scan != '\0') {
    const char *slash = strchr(scan, '/');
    const size_t bytes = slash == NULL ? strlen(scan) : (size_t)(slash - scan);
    if (bytes == 2 && scan[0] == '.' && scan[1] == '.') {
      if (parts.count > 0) {
        free(parts.items[parts.count - 1]);
        parts.count -= 1;
      }
    } else if (bytes > 0 && !(bytes == 1 && scan[0] == '.')) {
      strings_add(&parts, scan, bytes);
    }
    if (slash == NULL) {
      break;
    }
    scan = slash + 1;
  }
  buf_reset(&buf);
  for (index = 0; index < parts.count; index += 1) {
    buf_char(&buf, '/');
    buf_put(&buf, parts.items[index]);
  }
  if (buf.used == 0) {
    buf_char(&buf, '/');
  }
  result = repl_dup(buf.data, buf.used);
  strings_free(&parts);
  buf_free(&buf);
  return result;
}

/** `relative` свидетеля: путь от каталога `from` к файлу `to`, оба абсолютные. */
static char *repl_relative(const char *from, const char *to) {
  repl_strings here;
  repl_strings there;
  repl_buf buf;
  char *result = NULL;
  size_t common = 0;
  size_t index = 0;
  const char *scan = NULL;
  strings_init(&here);
  strings_init(&there);
  for (scan = from; *scan != '\0';) {
    const char *slash = strchr(scan, '/');
    const size_t bytes = slash == NULL ? strlen(scan) : (size_t)(slash - scan);
    if (bytes > 0) {
      strings_add(&here, scan, bytes);
    }
    if (slash == NULL) {
      break;
    }
    scan = slash + 1;
  }
  for (scan = to; *scan != '\0';) {
    const char *slash = strchr(scan, '/');
    const size_t bytes = slash == NULL ? strlen(scan) : (size_t)(slash - scan);
    if (bytes > 0) {
      strings_add(&there, scan, bytes);
    }
    if (slash == NULL) {
      break;
    }
    scan = slash + 1;
  }
  while (common < here.count && common < there.count && strcmp(here.items[common], there.items[common]) == 0) {
    common += 1;
  }
  buf_init(&buf);
  for (index = common; index < here.count; index += 1) {
    buf_put(&buf, buf.used == 0 ? ".." : "/..");
  }
  for (index = common; index < there.count; index += 1) {
    if (buf.used > 0) {
      buf_char(&buf, '/');
    }
    buf_put(&buf, there.items[index]);
  }
  result = repl_dup(buf.data, buf.used);
  strings_free(&here);
  strings_free(&there);
  buf_free(&buf);
  return result;
}

/*
 * Путь свидетеля `переписатьПуть`: импорт, приехавший из чужого каталога,
 * пересчитывается относительно каталога сессии. Без пересчёта «использует» из
 * загруженного файла указывал бы в пустоту.
 */
static char *repl_rewrite_path(const char *path, const char *from, const char *base) {
  char *full = repl_resolve(from, path);
  char *relative = repl_relative(base, full);
  if (relative[0] == '\0') {
    free(relative);
    return full;
  }
  free(full);
  return relative;
}

static bool repl_exists(const char *path) { return access(path, F_OK) == 0; }

static char *repl_read_file(const char *path, size_t *bytes) {
  FILE *stream = fopen(path, "rb");
  char *text = NULL;
  if (stream == NULL) {
    return NULL;
  }
  text = repl_read_all(stream, bytes);
  fclose(stream);
  return text;
}

/* ─────────────────────── чем вычислять: cc, lib, include ────────────────── */

/** Каталог, из которого запущен сам бинарник: от него отсчитываются lib и include. */
static char *repl_self_dir(const char *argv0) {
  if (argv0 == NULL || argv0[0] == '\0') {
    return NULL;
  }
  if (strchr(argv0, '/') != NULL) {
    char *cwd = NULL;
    char *full = NULL;
    char *dir = NULL;
    char buffer[4096];
    if (getcwd(buffer, sizeof(buffer)) == NULL) {
      return repl_dirname(argv0);
    }
    cwd = repl_say(buffer);
    full = repl_resolve(cwd, argv0);
    dir = repl_dirname(full);
    free(cwd);
    free(full);
    return dir;
  }
  {
    /* Имя без косой черты — программу нашли в PATH; там же ищем и мы. */
    const char *path = getenv("PATH");
    const char *scan = path;
    if (path == NULL) {
      return NULL;
    }
    while (*scan != '\0') {
      const char *colon = strchr(scan, ':');
      const size_t bytes = colon == NULL ? strlen(scan) : (size_t)(colon - scan);
      if (bytes > 0) {
        char *directory = repl_dup(scan, bytes);
        char *candidate = repl_join(directory, argv0);
        if (access(candidate, X_OK) == 0) {
          free(candidate);
          return directory;
        }
        free(candidate);
        free(directory);
      }
      if (colon == NULL) {
        break;
      }
      scan = colon + 1;
    }
  }
  return NULL;
}

/** Программа в PATH: полный путь или NULL. */
static char *repl_in_path(const char *name) {
  const char *path = getenv("PATH");
  const char *scan = path == NULL ? "/usr/bin:/bin:/usr/local/bin" : path;
  if (strchr(name, '/') != NULL) {
    return access(name, X_OK) == 0 ? repl_say(name) : NULL;
  }
  while (*scan != '\0') {
    const char *colon = strchr(scan, ':');
    const size_t bytes = colon == NULL ? strlen(scan) : (size_t)(colon - scan);
    if (bytes > 0) {
      char *directory = repl_dup(scan, bytes);
      char *candidate = repl_join(directory, name);
      free(directory);
      if (access(candidate, X_OK) == 0) {
        return candidate;
      }
      free(candidate);
    }
    if (colon == NULL) {
      break;
    }
    scan = colon + 1;
  }
  return NULL;
}

/*
 * Каталог установки ищется от самого бинарника, а не от захардкоженного места:
 * `bin/flang` → `../lib` и `../include` (так кладут и формула Homebrew, и
 * плагин asdf), а если бинарник запущен прямо из каталога сборки — рядом с ним.
 * Переопределяется переменной окружения: это единственный способ починить
 * необычную установку, не пересобирая бинарник.
 */
static char *repl_find_dir(const char *variable, const char *self_dir, const char *sub, const char *probe) {
  const char *set = getenv(variable);
  if (set != NULL && set[0] != '\0') {
    char *candidate = repl_join(set, probe);
    const bool found = repl_exists(candidate);
    free(candidate);
    return found ? repl_say(set) : NULL;
  }
  if (self_dir == NULL) {
    return NULL;
  }
  {
    char *parent = repl_dirname(self_dir);
    char *directory = repl_join(parent, sub);
    char *candidate = repl_join(directory, probe);
    const bool found = repl_exists(candidate);
    free(parent);
    free(candidate);
    if (found) {
      return directory;
    }
    free(directory);
  }
  {
    /* Каталог сборки: рядом с flang_cli лежат и заголовки, и архив. */
    char *candidate = repl_join(self_dir, probe);
    const bool found = repl_exists(candidate);
    free(candidate);
    if (found) {
      return repl_say(self_dir);
    }
  }
  return NULL;
}

/* ──────────────────────── обращение к компилятору ──────────────────────── */

/*
 * Арена живёт один ввод: разбор ввода, сборка сессии и проверка — это несколько
 * вызовов компилятора, и результат предыдущего нужен следующему. Сбрасывается
 * она в начале ввода, поэтому расход памяти не зависит от длины сессии.
 */
static fl_arena repl_arena;
static fl_ctx repl_ctx;

static void repl_cycle(void) {
  fl_arena_reset(&repl_arena);
  fl_ctx_init(&repl_ctx, &repl_arena);
}

static fl_status repl_call(const char *name, const fl_value *args, size_t count, fl_value *result) {
  fl_error error;
  fl_status status = FL_OK;
  error.code = NULL;
  error.message = NULL;
  /* Счётчики шагов и глубины — свои у каждого вызова: иначе разбор ввода съедал
     бы предел, отпущенный проверке. */
  repl_ctx.steps = 0;
  repl_ctx.depth = 0;
  status = FL_PROGRAM_CALL(&repl_ctx, name, args, count, result, &error);
  if (status != FL_OK) {
    /* Сбой самого компилятора виден человеку целиком: молча отдать «ошибок нет»
       значило бы соврать про проверку. */
    fprintf(stderr, "%s: %s\n", error.code == NULL ? "FLANG_INTERNAL" : error.code,
            error.message == NULL ? "компилятор прекратил работу" : error.message);
  }
  return status;
}

static fl_value repl_value_text(const char *text, size_t bytes) {
  fl_value out = fl_nothing();
  fl_error error;
  error.code = NULL;
  error.message = NULL;
  if (fl_text(&repl_ctx, text, bytes, &out, &error) != FL_OK) {
    repl_oom();
  }
  return out;
}

static fl_value repl_value_say(const char *text) { return repl_value_text(text, strlen(text)); }

static fl_value repl_value_list(const fl_value *items, size_t count) {
  fl_value *array = NULL;
  fl_error error;
  error.code = NULL;
  error.message = NULL;
  if (fl_list_alloc(&repl_ctx, count, &array, &error) != FL_OK) {
    repl_oom();
  }
  if (count > 0) {
    memcpy(array, items, count * sizeof(fl_value));
  }
  return fl_list(array, count);
}

static fl_value repl_value_strings(const repl_strings *list) {
  fl_value *array = NULL;
  fl_error error;
  size_t index = 0;
  error.code = NULL;
  error.message = NULL;
  if (fl_list_alloc(&repl_ctx, list->count, &array, &error) != FL_OK) {
    repl_oom();
  }
  for (index = 0; index < list->count; index += 1) {
    array[index] = repl_value_say(list->items[index]);
  }
  return fl_list(array, list->count);
}

static fl_value repl_value_record(const char *const *names, const fl_value *values, size_t count) {
  fl_value out = fl_nothing();
  fl_error error;
  error.code = NULL;
  error.message = NULL;
  if (fl_record_new(&repl_ctx, names, values, count, &out, &error) != FL_OK) {
    repl_oom();
  }
  return out;
}

/* ──────────────────────── чтение значений компилятора ──────────────────── */

static bool val_field(fl_value node, const char *name, fl_value *out) {
  size_t index = 0;
  if (node.tag == FL_RECORD) {
    for (index = 0; index < node.as.record->count; index += 1) {
      if (strcmp(node.as.record->fields[index].name, name) == 0) {
        *out = node.as.record->fields[index].value;
        return true;
      }
    }
    return false;
  }
  if (node.tag == FL_VARIANT) {
    for (index = 0; index < node.as.variant->count; index += 1) {
      if (strcmp(node.as.variant->fields[index].name, name) == 0) {
        *out = node.as.variant->fields[index].value;
        return true;
      }
    }
  }
  return false;
}

static bool val_is(fl_value node, const char *variant) {
  return node.tag == FL_VARIANT && strcmp(node.as.variant->name, variant) == 0;
}

/** Строка значения — байтами: строки рантайма не обязаны кончаться нулём. */
static bool val_text(fl_value node, const char **utf8, size_t *bytes) {
  if (node.tag != FL_STRING) {
    return false;
  }
  *utf8 = node.as.string.utf8;
  *bytes = node.as.string.bytes;
  return true;
}

static bool val_same(fl_value node, const char *text) {
  const char *utf8 = NULL;
  size_t bytes = 0;
  return val_text(node, &utf8, &bytes) && bytes == strlen(text) && memcmp(utf8, text, bytes) == 0;
}

static char *val_copy(fl_value node) {
  const char *utf8 = NULL;
  size_t bytes = 0;
  if (!val_text(node, &utf8, &bytes)) {
    return repl_say("");
  }
  return repl_dup(utf8, bytes);
}

/*
 * Узел AST приезжает как «Значение» из `flang/core/json.flang`: вариант с
 * тремя случаями. Ходить по нему приходится руками, зато это тот же самый
 * узел, который видят типы и завершаемость, — а не его пересказ.
 */
static bool zn_field(fl_value node, const char *key, fl_value *out) {
  fl_value fields = fl_nothing();
  size_t index = 0;
  if (!val_is(node, "Значение записи") || !val_field(node, "поля", &fields) || fields.tag != FL_LIST) {
    return false;
  }
  for (index = 0; index < fields.as.list.count; index += 1) {
    fl_value pair = fields.as.list.items[index];
    fl_value name = fl_nothing();
    fl_value value = fl_nothing();
    if (!val_field(pair, "ключ", &name) || !val_field(pair, "значение", &value)) {
      continue;
    }
    if (val_same(name, key)) {
      *out = value;
      return true;
    }
  }
  return false;
}

static bool zn_items(fl_value node, const fl_value **items, size_t *count) {
  fl_value list = fl_nothing();
  *items = NULL;
  *count = 0;
  if (!val_is(node, "Значение списка") || !val_field(node, "элементы", &list) || list.tag != FL_LIST) {
    return false;
  }
  *items = list.as.list.items;
  *count = list.as.list.count;
  return true;
}

static bool zn_scalar(fl_value node, const char *variant, fl_value *out) {
  fl_value scalar = fl_nothing();
  if (!val_is(node, "Значение скаляра") || !val_field(node, "скаляр", &scalar)) {
    return false;
  }
  return val_is(scalar, variant) && val_field(scalar, "значение", out);
}

static bool zn_text(fl_value node, const char **utf8, size_t *bytes) {
  fl_value value = fl_nothing();
  return zn_scalar(node, "Скаляр строка", &value) && val_text(value, utf8, bytes);
}

static bool zn_number(fl_value node, double *out) {
  fl_value value = fl_nothing();
  if (!zn_scalar(node, "Скаляр число", &value) || value.tag != FL_NUMBER) {
    return false;
  }
  *out = value.as.number;
  return true;
}

static bool zn_flag(fl_value node, bool *out) {
  fl_value value = fl_nothing();
  if (!zn_scalar(node, "Скаляр признак", &value) || value.tag != FL_FLAG) {
    return false;
  }
  *out = value.as.flag;
  return true;
}

/** Строковое поле узла: «name», «kind», «construct». */
static bool zn_field_text(fl_value node, const char *key, const char **utf8, size_t *bytes) {
  fl_value field = fl_nothing();
  return zn_field(node, key, &field) && zn_text(field, utf8, bytes);
}

/** Список-поле узла: «types», «functions», «legacy», «imports». */
static void zn_field_items(fl_value node, const char *key, const fl_value **items, size_t *count) {
  fl_value field = fl_nothing();
  *items = NULL;
  *count = 0;
  if (zn_field(node, key, &field)) {
    zn_items(field, items, count);
  }
}

/** Строка узла из его «span»; 0 — места нет. */
static size_t zn_line(fl_value node) {
  fl_value span = fl_nothing();
  fl_value line = fl_nothing();
  double number = 0.0;
  if (!zn_field(node, "span", &span) || !zn_field(span, "line", &line) || !zn_number(line, &number)) {
    return 0;
  }
  return number > 0.0 ? (size_t)number : 0;
}

/* ─────────────────────────────── сессия ─────────────────────────────────── */

typedef struct repl_decl {
  repl_strings names;
  char *label;
  char *text;
} repl_decl;

/*
 * Объявления хранятся указателями, а не значениями, и это не вкус. Кандидат на
 * новую сессию собирается из тех же объявлений, что и старая: пока проверка не
 * прошла, ни одно из них не имеет права быть скопированным или освобождённым —
 * отвергнутый ввод обязан оставить сессию точно такой, какой она была.
 */
typedef struct repl_decls {
  repl_decl **items;
  size_t count;
  size_t capacity;
} repl_decls;

typedef struct repl_import {
  char *category;
  char *from;
  repl_strings only;
  bool has_only;
} repl_import;

typedef struct repl_imports {
  repl_import *items;
  size_t count;
  size_t capacity;
} repl_imports;

typedef struct repl_session {
  char *base; /* каталог сессии; от него отсчитываются все пути */
  char *file; /* «оболочка».flang, разрешённый в base */
  /* Заголовок модуля хранится разобранным, а не строкой: «использует» пишется
     в разных местах ввода и в загружаемых файлах, а в исходнике сессии он
     обязан быть ровно один и ровно наверху. */
  char *module;
  repl_imports imports;
  repl_strings exports;
  repl_decls decls;
  /* Имена функций последней принятой сессии: с ними разбирается ввод, иначе
     вызов функции без аргументов остался бы несвязанным именем. */
  repl_strings known;
  repl_strings total;
  /* Чем вычислять. NULL в `why_no_eval` означает «вычислять можно». */
  char *cc;
  char *include_dir;
  char *lib_dir;
  char *tmp_dir;
  char *why_no_eval;
  char *steps;
  char *depth;
  repl_strings litter;
} repl_session;

static void decls_init(repl_decls *list) {
  list->items = NULL;
  list->count = 0;
  list->capacity = 0;
}

static void decls_push(repl_decls *list, repl_decl *decl) {
  if (list->count == list->capacity) {
    list->capacity = list->capacity == 0 ? 8 : list->capacity * 2;
    list->items = (repl_decl **)repl_grow(list->items, list->capacity * sizeof(repl_decl *));
  }
  list->items[list->count] = decl;
  list->count += 1;
}

static void decl_free(repl_decl *decl) {
  strings_free(&decl->names);
  free(decl->label);
  free(decl->text);
  free(decl);
}

static void decls_free(repl_decls *list) {
  size_t index = 0;
  for (index = 0; index < list->count; index += 1) {
    decl_free(list->items[index]);
  }
  free(list->items);
  decls_init(list);
}

static void imports_init(repl_imports *list) {
  list->items = NULL;
  list->count = 0;
  list->capacity = 0;
}

static void imports_push(repl_imports *list, repl_import item) {
  if (list->count == list->capacity) {
    list->capacity = list->capacity == 0 ? 4 : list->capacity * 2;
    list->items = (repl_import *)repl_grow(list->items, list->capacity * sizeof(repl_import));
  }
  list->items[list->count] = item;
  list->count += 1;
}

static void import_free(repl_import *item) {
  free(item->category);
  free(item->from);
  strings_free(&item->only);
  item->category = NULL;
  item->from = NULL;
}

static void imports_free(repl_imports *list) {
  size_t index = 0;
  for (index = 0; index < list->count; index += 1) {
    import_free(&list->items[index]);
  }
  free(list->items);
  imports_init(list);
}

static repl_import import_copy(const repl_import *item) {
  repl_import copy;
  size_t index = 0;
  copy.category = repl_say(item->category);
  copy.from = repl_say(item->from);
  copy.has_only = item->has_only;
  strings_init(&copy.only);
  for (index = 0; index < item->only.count; index += 1) {
    strings_say(&copy.only, item->only.items[index]);
  }
  return copy;
}

/* ─────────────────── сборка исходника сессии и карта строк ─────────────── */

/*
 * Карта нужна, чтобы диагностика показывала строку ВВОДА, а не строку
 * собранного текста: пользователь набрал три строки, и «ошибка в строке 47»
 * ему ничего не говорит.
 */
typedef struct repl_piece {
  const char *where; /* «ввод», «объявление», «модуль» */
  const char *name;  /* метка объявления или NULL */
  size_t first;
  size_t last;
  size_t line_shift;
  size_t column_shift;
} repl_piece;

typedef struct repl_map {
  repl_piece *items;
  size_t count;
  size_t capacity;
} repl_map;

static void map_init(repl_map *map) {
  map->items = NULL;
  map->count = 0;
  map->capacity = 0;
}

static void map_push(repl_map *map, repl_piece piece) {
  if (map->count == map->capacity) {
    map->capacity = map->capacity == 0 ? 8 : map->capacity * 2;
    map->items = (repl_piece *)repl_grow(map->items, map->capacity * sizeof(repl_piece));
  }
  map->items[map->count] = piece;
  map->count += 1;
}

static void map_free(repl_map *map) {
  free(map->items);
  map_init(map);
}

/** Взгляд на сессию: настоящую или ещё только примеряемую. */
typedef struct repl_view {
  const char *module;
  const repl_imports *imports;
  const repl_strings *exports;
  const repl_decls *decls;
  size_t fresh_first; /* [fresh_first, fresh_last) — только что набранное */
  size_t fresh_last;
} repl_view;

static void buf_json_text(repl_buf *buf, const char *text) {
  size_t index = 0;
  buf_char(buf, '"');
  for (index = 0; text[index] != '\0'; index += 1) {
    const unsigned char symbol = (unsigned char)text[index];
    switch (symbol) {
      case '"': buf_put(buf, "\\\""); break;
      case '\\': buf_put(buf, "\\\\"); break;
      case '\n': buf_put(buf, "\\n"); break;
      case '\r': buf_put(buf, "\\r"); break;
      case '\t': buf_put(buf, "\\t"); break;
      default:
        if (symbol < 0x20u) {
          char escape[8];
          sprintf(escape, "\\u%04x", (unsigned)symbol);
          buf_put(buf, escape);
        } else {
          buf_char(buf, (char)symbol);
        }
    }
  }
  buf_char(buf, '"');
}

/** Текст заголовка модуля; false — заголовка нет и печатать нечего. */
static bool repl_header_text(const char *module, const repl_imports *imports, const repl_strings *exports,
                             repl_buf *out) {
  size_t index = 0;
  if (imports->count == 0 && exports->count == 0 && module[0] == '\0') {
    return false;
  }
  buf_put(out, "модуль «");
  buf_put(out, module[0] == '\0' ? REPL_MODULE : module);
  buf_put(out, "»");
  for (index = 0; index < imports->count; index += 1) {
    const repl_import *item = &imports->items[index];
    size_t inner = 0;
    buf_put(out, "\n  использует «");
    buf_put(out, item->category);
    buf_put(out, "» из ");
    buf_json_text(out, item->from);
    if (item->has_only) {
      buf_put(out, " только ");
      for (inner = 0; inner < item->only.count; inner += 1) {
        if (inner > 0) {
          buf_put(out, ", ");
        }
        buf_put(out, "«");
        buf_put(out, item->only.items[inner]);
        buf_put(out, "»");
      }
    }
  }
  if (exports->count > 0) {
    buf_put(out, "\n  экспортирует ");
    for (index = 0; index < exports->count; index += 1) {
      if (index > 0) {
        buf_put(out, ", ");
      }
      buf_put(out, "«");
      buf_put(out, exports->items[index]);
      buf_put(out, "»");
    }
  }
  return true;
}

static size_t repl_lines_in(const char *text) {
  size_t lines = 1;
  size_t index = 0;
  for (index = 0; text[index] != '\0'; index += 1) {
    if (text[index] == '\n') {
      lines += 1;
    }
  }
  return lines;
}

/** Часть исходника + её место в карте. */
static void repl_add_piece(repl_buf *out, repl_map *map, const char *where, const char *name, const char *text,
                           size_t line_shift, size_t column_shift, size_t *line) {
  repl_piece piece;
  const size_t height = repl_lines_in(text);
  if (out->used > 0) {
    buf_put(out, "\n\n");
  }
  buf_put(out, text);
  piece.where = where;
  piece.name = name;
  piece.first = *line;
  piece.last = *line + height - 1;
  piece.line_shift = line_shift;
  piece.column_shift = column_shift;
  map_push(map, piece);
  /* Между частями ровно одна пустая строка — она же разделитель в файле,
     который пишет «.сохранить». */
  *line += height + 1;
}

/**
 * Исходник сессии целиком: заголовок, объявления и — если вычисляется
 * выражение — обёртка. Хвост приходит уже готовым текстом, потому что сдвиги
 * строк и столбцов у него свои.
 */
static void repl_assemble(const repl_view *view, const char *tail, size_t tail_line_shift, size_t tail_column_shift,
                          repl_buf *out, repl_map *map) {
  repl_buf header;
  size_t line = 1;
  size_t index = 0;
  buf_reset(out);
  map->count = 0;
  buf_init(&header);
  if (repl_header_text(view->module, view->imports, view->exports, &header)) {
    repl_add_piece(out, map, "модуль", NULL, header.data, 0, 0, &line);
  }
  for (index = 0; index < view->decls->count; index += 1) {
    const repl_decl *decl = view->decls->items[index];
    const bool fresh = index >= view->fresh_first && index < view->fresh_last;
    /* Только что набранное помечается как «ввод»: ошибка в нём обязана
       указывать строку ввода, а не строку объявления, о котором пользователь
       ещё не думает как об отдельной части сессии. */
    repl_add_piece(out, map, fresh ? "ввод" : "объявление", decl->label, decl->text, 0, 0, &line);
  }
  if (tail != NULL) {
    repl_add_piece(out, map, "ввод", NULL, tail, tail_line_shift, tail_column_shift, &line);
  }
  if (out->used > 0) {
    buf_char(out, '\n');
  }
  buf_free(&header);
}

/* ────────────────────────────── диагностика ─────────────────────────────── */

typedef struct repl_bad {
  char *code;
  char *message;
  bool has_at;
  size_t line;
  size_t column;
} repl_bad;

typedef struct repl_bads {
  repl_bad *items;
  size_t count;
  size_t capacity;
} repl_bads;

static void bads_init(repl_bads *list) {
  list->items = NULL;
  list->count = 0;
  list->capacity = 0;
}

static void bads_push(repl_bads *list, char *code, char *message, bool has_at, size_t line, size_t column) {
  repl_bad bad;
  if (list->count == list->capacity) {
    list->capacity = list->capacity == 0 ? 4 : list->capacity * 2;
    list->items = (repl_bad *)repl_grow(list->items, list->capacity * sizeof(repl_bad));
  }
  bad.code = code;
  bad.message = message;
  bad.has_at = has_at;
  bad.line = line;
  bad.column = column;
  list->items[list->count] = bad;
  list->count += 1;
}

static void bads_say(repl_bads *list, const char *message) {
  /* Ошибка оболочки — это ошибка вызова, а не ошибка программы, поэтому код тот
     же, каким CLI помечает неверный вызов: заводить для оболочки собственный код
     значило бы расширять список кодов там, где ничего нового не произошло. */
  bads_push(list, repl_say("FLANG_CLI"), repl_say(message), false, 0, 0);
}

static void bads_free(repl_bads *list) {
  size_t index = 0;
  for (index = 0; index < list->count; index += 1) {
    free(list->items[index].code);
    free(list->items[index].message);
  }
  free(list->items);
  bads_init(list);
}

/** Одна «Беда» компилятора → в наш список. */
static void bads_take(repl_bads *list, fl_value bad) {
  fl_value code = fl_nothing();
  fl_value message = fl_nothing();
  fl_value at = fl_nothing();
  fl_value has = fl_nothing();
  fl_value line = fl_nothing();
  fl_value column = fl_nothing();
  bool present = false;
  if (!val_field(bad, "код", &code) || !val_field(bad, "сообщение", &message)) {
    return;
  }
  if (val_field(bad, "место", &at) && val_field(at, "есть", &has) && has.tag == FL_FLAG) {
    present = has.as.flag;
  }
  if (present) {
    val_field(at, "строка", &line);
    val_field(at, "столбец", &column);
  }
  bads_push(list, val_copy(code), val_copy(message), present,
            line.tag == FL_NUMBER ? (size_t)line.as.number : 0,
            column.tag == FL_NUMBER ? (size_t)column.as.number : 0);
}

/** «Диагностика анализа» тотальности → «Беда»; предупреждения не едут. */
static void bads_take_analysis(repl_bads *list, fl_value bad) {
  fl_value code = fl_nothing();
  fl_value message = fl_nothing();
  fl_value weight = fl_nothing();
  fl_value has = fl_nothing();
  fl_value line = fl_nothing();
  fl_value column = fl_nothing();
  if (!val_field(bad, "код", &code) || !val_field(bad, "сообщение", &message)) {
    return;
  }
  if (val_field(bad, "важность", &weight) && val_same(weight, "warning")) {
    return;
  }
  val_field(bad, "есть место", &has);
  val_field(bad, "строка", &line);
  val_field(bad, "столбец", &column);
  bads_push(list, val_copy(code), val_copy(message), has.tag == FL_FLAG && has.as.flag,
            line.tag == FL_NUMBER ? (size_t)line.as.number : 0,
            column.tag == FL_NUMBER ? (size_t)column.as.number : 0);
}

static void repl_print_bad(const char *code, const char *message, const char *where, const char *name, size_t line,
                           size_t column) {
  if (where == NULL) {
    fprintf(stderr, "%s: %s\n", code, message);
    return;
  }
  if (strcmp(where, "ввод") == 0) {
    if (column > 0) {
      fprintf(stderr, "%s, строка %lu, столбец %lu: %s\n", code, (unsigned long)line, (unsigned long)column, message);
    } else {
      fprintf(stderr, "%s, строка %lu: %s\n", code, (unsigned long)line, message);
    }
    return;
  }
  if (strcmp(where, "файл") == 0) {
    fprintf(stderr, "%s в файле %s, строка %lu: %s\n", code, name == NULL ? "?" : name, (unsigned long)line, message);
    return;
  }
  /*
   * `flang check`: файл человек назвал сам, поэтому место называется полностью —
   * со столбцом. У «файла» выше столбца нет, и это не забывчивость: там файл
   * втягивается в сессию командой «.загрузить», и та же строка обязана совпасть
   * с оболочкой на Node дословно (сверка в flang/test/self-bootstrap.test.mjs).
   * У проверки второй оболочки нет — она печатает то, что человеку полезнее.
   */
  if (strcmp(where, "проверка") == 0) {
    if (column > 0) {
      fprintf(stderr, "%s в файле %s, строка %lu, столбец %lu: %s\n", code, name == NULL ? "?" : name,
              (unsigned long)line, (unsigned long)column, message);
    } else {
      fprintf(stderr, "%s в файле %s, строка %lu: %s\n", code, name == NULL ? "?" : name, (unsigned long)line, message);
    }
    return;
  }
  if (strcmp(where, "модуль") == 0) {
    fprintf(stderr, "%s, заголовок модуля, строка %lu: %s\n", code, (unsigned long)line, message);
    return;
  }
  fprintf(stderr, "%s в объявлении (%s), строка %lu: %s\n", code, name == NULL ? "?" : name, (unsigned long)line,
          message);
}

/**
 * Диагностика — кодом и местом, как в «flang check», только не в JSON.
 *
 * Место берётся либо из карты собранной сессии, либо — когда ввод разбирался
 * отдельно от неё — напрямую от вызывающего, которому оно известно заранее.
 */
static void repl_print_bads(const repl_bads *bads, const repl_map *map, const char *direct_where,
                            const char *direct_name, size_t line_shift, size_t column_shift) {
  size_t index = 0;
  for (index = 0; index < bads->count; index += 1) {
    const repl_bad *bad = &bads->items[index];
    const repl_piece *piece = NULL;
    size_t line = 0;
    size_t column = 0;
    if (!bad->has_at || repl_in_list(REPL_FOREIGN, bad->code, strlen(bad->code))) {
      repl_print_bad(bad->code, bad->message, NULL, NULL, 0, 0);
      continue;
    }
    if (direct_where != NULL) {
      line = bad->line > line_shift ? bad->line - line_shift : 1;
      column = bad->column > column_shift ? bad->column - column_shift : 1;
      repl_print_bad(bad->code, bad->message, direct_where, direct_name, line, bad->column > 0 ? column : 0);
      continue;
    }
    if (map != NULL) {
      size_t scan = 0;
      for (scan = 0; scan < map->count; scan += 1) {
        if (bad->line >= map->items[scan].first && bad->line <= map->items[scan].last) {
          piece = &map->items[scan];
          break;
        }
      }
    }
    if (piece == NULL) {
      repl_print_bad(bad->code, bad->message, NULL, NULL, 0, 0);
      continue;
    }
    line = bad->line + 1 - piece->first;
    line = line > piece->line_shift ? line - piece->line_shift : 1;
    column = bad->column > piece->column_shift ? bad->column - piece->column_shift : 1;
    repl_print_bad(bad->code, bad->message, piece->where, piece->name, line, bad->column > 0 ? column : 0);
  }
}

/* ───────────────────── исходники сессии и её импортов ──────────────────── */

/** Один «Исходник»: путь и текст. */
static fl_value repl_source_value(const char *path, const char *text, size_t bytes) {
  static const char *const names[2] = {"путь", "текст"};
  fl_value values[2];
  values[0] = repl_value_say(path);
  values[1] = repl_value_text(text, bytes);
  return repl_value_record(names, values, 2);
}

/** Пути импортов файла: разбираем его тем же разбором, что и всё остальное. */
static void repl_imports_of(const char *text, size_t bytes, const char *from, repl_strings *queue) {
  fl_value args[2];
  fl_value parsed = fl_nothing();
  fl_value program = fl_nothing();
  const fl_value *legacy = NULL;
  size_t count = 0;
  size_t index = 0;
  char *directory = repl_dirname(from);
  args[0] = repl_value_text(text, bytes);
  args[1] = repl_value_list(NULL, 0);
  if (repl_call("Разбор исходника", args, 2, &parsed) != FL_OK || !val_field(parsed, "программа", &program)) {
    free(directory);
    return;
  }
  zn_field_items(program, "legacy", &legacy, &count);
  for (index = 0; index < count; index += 1) {
    const char *construct = NULL;
    size_t construct_bytes = 0;
    fl_value value = fl_nothing();
    const fl_value *items = NULL;
    size_t imports = 0;
    size_t inner = 0;
    if (!zn_field_text(legacy[index], "construct", &construct, &construct_bytes)) {
      continue;
    }
    if (construct_bytes != 12 || memcmp(construct, "moduleHeader", 12) != 0) {
      continue;
    }
    if (!zn_field(legacy[index], "value", &value)) {
      continue;
    }
    zn_field_items(value, "imports", &items, &imports);
    for (inner = 0; inner < imports; inner += 1) {
      const char *path = NULL;
      size_t path_bytes = 0;
      if (zn_field_text(items[inner], "from", &path, &path_bytes)) {
        char *relative = repl_dup(path, path_bytes);
        char *full = repl_resolve(directory, relative);
        strings_say(queue, full);
        free(relative);
        free(full);
      }
    }
  }
  free(directory);
}

/**
 * Замыкание по «использует»: к уже собранным (`paths`, `texts`) добавляется всё,
 * до чего дотягивается очередь, и всё вместе едет компилятору списком. Чтения
 * файлов в языке нет и не будет — программа на flang не имеет доступа к миру, —
 * поэтому файлы читает этот файл.
 *
 * Вынесено из `repl_sources` не ради экономии строк: тем же замыканием живёт
 * `flang check`. Разойдись они, и проверка файла видела бы не ту программу, что
 * та же проверка в оболочке, — при одинаковом на вид ответе.
 *
 * `paths` и `texts` после возврата принадлежат вызывающему: по ним видно, из
 * скольких файлов собралась программа, а знать это нужно, чтобы решить, можно
 * ли назвать файл в диагностике (компилятор его не несёт).
 */
static fl_value repl_closure(repl_strings *paths, repl_strings *texts, repl_strings *queue) {
  fl_value *items = NULL;
  fl_value list = fl_nothing();
  size_t index = 0;
  for (index = 0; index < queue->count; index += 1) {
    const char *path = queue->items[index];
    char *text = NULL;
    size_t bytes = 0;
    if (strings_has(paths, path, strlen(path))) {
      continue;
    }
    text = repl_read_file(path, &bytes);
    if (text == NULL) {
      /* Файла нет — молчим: об этом скажет сам компилятор, и скажет кодом
         FLANG_IMPORT_NOT_FOUND, а не нашим пересказом. */
      continue;
    }
    strings_say(paths, path);
    strings_add(texts, text, bytes);
    repl_imports_of(text, bytes, path, queue);
    free(text);
  }
  {
    fl_error error;
    error.code = NULL;
    error.message = NULL;
    if (fl_list_alloc(&repl_ctx, paths->count, &items, &error) != FL_OK) {
      repl_oom();
    }
    for (index = 0; index < paths->count; index += 1) {
      items[index] = repl_source_value(paths->items[index], texts->items[index], texts->sizes[index]);
    }
    list = fl_list(items, paths->count);
  }
  return list;
}

/** Исходники сессии: сама сессия и замыкание её «использует». */
static fl_value repl_sources(repl_session *session, const char *source, const repl_imports *imports) {
  repl_strings paths;
  repl_strings texts;
  repl_strings queue;
  fl_value list = fl_nothing();
  size_t index = 0;
  strings_init(&paths);
  strings_init(&texts);
  strings_init(&queue);
  strings_say(&paths, session->file);
  strings_say(&texts, source);
  for (index = 0; index < imports->count; index += 1) {
    char *full = repl_resolve(session->base, imports->items[index].from);
    strings_say(&queue, full);
    free(full);
  }
  list = repl_closure(&paths, &texts, &queue);
  strings_free(&paths);
  strings_free(&texts);
  strings_free(&queue);
  return list;
}

/* ─────────────────────── одна дорога: и check, и оболочка ───────────────── */

/**
 * Разбор со связыванием → типы → завершаемость: ровно та пара проверок и в том
 * же порядке, что у точки входа «Проверить исходники», то есть у `flang check`.
 * Разбита здесь на три вызова не ради удобства, а потому что вызывающему нужна
 * ещё и сама связанная программа: по ней считаются имена, видимые следующему
 * вводу, по ней печатается C, когда вычисляется выражение, и по ней же
 * `flang check` говорит человеку, что в файле насчитано, — связывать второй раз
 * ради этого было бы расточительством.
 *
 * Дорога одна на оба человеческих входа нарочно: разойдись они, оболочка
 * принимала бы объявление, которое `flang check` в том же файле отвергает.
 */
static bool repl_check_sources(fl_value sources, const char *entry, repl_bads *bads, fl_value *program,
                               bool *has_program, repl_strings *proven, bool kernel) {
  fl_value args[2];
  fl_value linked = fl_nothing();
  fl_value typed = fl_nothing();
  fl_value total = fl_nothing();
  fl_value diagnostics = fl_nothing();
  size_t index = 0;
  *has_program = false;
  args[0] = sources;
  args[1] = repl_value_say(entry);
  if (repl_call("Связать исходники", args, 2, &linked) != FL_OK) {
    bads_say(bads, "компилятор не связал сессию");
    return false;
  }
  if (!val_field(linked, "программа", program)) {
    bads_say(bads, "связывание не вернуло программу");
    return false;
  }
  *has_program = true;
  if (val_field(linked, "диагностики", &diagnostics) && diagnostics.tag == FL_LIST) {
    for (index = 0; index < diagnostics.as.list.count; index += 1) {
      bads_take(bads, diagnostics.as.list.items[index]);
    }
  }
  if (repl_call("Проверить типы", program, 1, &typed) != FL_OK) {
    bads_say(bads, "проверка типов прекращена");
    return false;
  }
  if (val_field(typed, "диагностики", &diagnostics) && diagnostics.tag == FL_LIST) {
    for (index = 0; index < diagnostics.as.list.count; index += 1) {
      bads_take(bads, diagnostics.as.list.items[index]);
    }
  }
  if (repl_call("Проверить тотальность", program, 1, &total) != FL_OK) {
    bads_say(bads, "анализ завершаемости прекращён");
    return false;
  }
  if (val_field(total, "диагностики", &diagnostics) && diagnostics.tag == FL_LIST) {
    for (index = 0; index < diagnostics.as.list.count; index += 1) {
      bads_take_analysis(bads, diagnostics.as.list.items[index]);
    }
  }
  if (proven != NULL && val_field(total, "тотальные", &diagnostics) && diagnostics.tag == FL_LIST) {
    for (index = 0; index < diagnostics.as.list.count; index += 1) {
      const char *utf8 = NULL;
      size_t bytes = 0;
      if (val_text(diagnostics.as.list.items[index], &utf8, &bytes)) {
        strings_add(proven, utf8, bytes);
      }
    }
  }
  /*
   * ЯДРО ДОКАЗАТЕЛЬСТВА — четвёртым шагом, и это не добавка к отчёту.
   *
   * Пока его тут не было, бинарник ПРИНИМАЛ программу с заведомо ложным
   * утверждением: `flang check` отвечал «замечаний нет» и кодом 0 там, где
   * свидетель на Node отвечает `FLANG_PROOF_STEP` и кодом 1. Бинарник, принимающий
   * то, что свидетель отвергает, опаснее бинарника, который чего-то не умеет:
   * неумение видно, расхождение — нет.
   *
   * Оболочке ядро не зовётся (`kernel` равно false), и причина не в скорости:
   * сессия проверяется ПОСЛЕ КАЖДОГО объявления, а обязательство закрывается
   * теоремой, которая приходит отдельной строкой ПОЗЖЕ. Судить незаконченную
   * сессию ядром значило бы отвергать верное доказательство за то, что человек
   * ещё не дописал его.
   */
  if (kernel) {
    fl_value kernel_args[2];
    fl_value kernel_bads = fl_nothing();
    kernel_args[0] = *program;
    kernel_args[1] = total;
    if (repl_call("Беды ядра", kernel_args, 2, &kernel_bads) != FL_OK) {
      bads_say(bads, "ядро доказательства прекращено");
      return false;
    }
    if (kernel_bads.tag == FL_LIST) {
      for (index = 0; index < kernel_bads.as.list.count; index += 1) {
        bads_take(bads, kernel_bads.as.list.items[index]);
      }
    }
  }
  /*
   * ПРИМЕРЫ — ПЯТЫМ ШАГОМ, И ЭТО ТА ЖЕ ДЫРА, ЧТО БЫЛА С ЯДРОМ.
   *
   * Пока их тут не было, бинарник ПЕЧАТАЛ программу с заведомо ложным примером:
   * на файле с `пример «два на два — ПЯТЬ»` (`ожидается 5` при результате 4)
   * `flang_cli check` отвечал «проверено — замечаний нет» и кодом 0,
   * `flang_cli test` — «прошло 0, не прошло 1» и кодом 1, а `flang_cli emit
   * --target c --out …` — кодом 0 и 263 793 байтами C в шести файлах.
   * `пример` — часть программы, а не тест сбоку, и прогоняется при КАЖДОЙ
   * проверке; весь смысл проверок в том, что непроверенное не печатается.
   *
   * СТОИТ ПОСЛЕ ВСЕГО ОСТАЛЬНОГО И ТОЛЬКО НА ЧИСТОЙ ПРОГРАММЕ (`bads->count`
   * ниже), по тому же доводу, по которому `flang test` не гоняет примеров на
   * непроверенной программе: «пример сошёлся» на программе с ошибкой типов не
   * значит ничего — сойтись он мог на пути, который до кривого места не дошёл.
   * Заодно это и цена: вычислять примеры там, где ответ никто не прочтёт, —
   * работа впустую.
   *
   * Оболочке примеры не гоняются вместе с ядром (`kernel` равно false), и
   * причина та же: сессия проверяется ПОСЛЕ КАЖДОГО объявления, и прогон всех
   * примеров сессии на каждом вводе платился бы вычислением за каждую нажатую
   * строку. `flang check` над файлом сессии скажет то же самое и целиком.
   *
   * ── ГРАНИЦА, ИЗМЕРЕННАЯ, А НЕ ОЦЕНЁННАЯ ────────────────────────────────────
   * Прогон примеров считает вычислитель на самом flang, а его считает этот
   * бинарник, — и на своих же исходниках он в собственный предел упирается.
   * Замер на дереве: из 798 программ (ствол 440ca5ac) `check` бинарника отвечает
   * так же, как свидетель на Node, на 796 — те же годные и те же отвергнутые,
   * включая все 13 файлов с ложным примером. Расходятся ДВЕ, и обе — самые
   * большие программы дерева: `flang/self/bootstrap/compiler.flang` (3624
   * функции после связывания, 335 примеров) и `flang/self/repl/repl.flang`
   * (323 примера). На
   * них `repl_call` возвращает FLANG_RECURSION_LIMIT (предел 40 000 000 шагов)
   * через 4 мин 56 с и 3 мин 37 с соответственно, и `check` отвечает «прогон
   * примеров прекращён» и кодом 1.
   *
   * Это НЕ новая граница: `flang test` на том же файле упирался в тот же предел
   * и до этой правки (замер: 4 минуты, FLANG_RECURSION_LIMIT на «Сторожа в
   * узле»). Новое здесь одно — теперь об этом говорит и `check`, а не только
   * `test`. Отказ выбран сознательно: «примеров не смотрели» и «примеры
   * сошлись» — разные утверждения, и молчаливое второе на месте первого и есть
   * та дыра, которую эта правка закрывает.
   */
  if (kernel && bads->count == 0) {
    fl_value example_bads = fl_nothing();
    /* Пределы прогона НЕ называются здесь: они записаны одним местом на flang
       («Предел витков проверки» в `compiler.flang`), и вторая их копия в C
       разошлась бы с первой молча. */
    if (repl_call("Беды примеров при проверке", program, 1, &example_bads) != FL_OK) {
      bads_say(bads, "прогон примеров прекращён");
      return false;
    }
    if (example_bads.tag == FL_LIST) {
      for (index = 0; index < example_bads.as.list.count; index += 1) {
        bads_take(bads, example_bads.as.list.items[index]);
      }
    }
  }
  return bads->count == 0;
}

/** Та же дорога для сессии: исходником служит собранный текст сессии. */
static bool repl_check(repl_session *session, const char *source, const repl_imports *imports, repl_bads *bads,
                       fl_value *program, bool *has_program, repl_strings *proven) {
  return repl_check_sources(repl_sources(session, source, imports), session->file, bads, program, has_program, proven,
                            false);
}

/** Имена функций связанной программы: с ними разбирается следующий ввод. */
static void repl_known_of(fl_value program, repl_strings *out) {
  const fl_value *functions = NULL;
  size_t count = 0;
  size_t index = 0;
  zn_field_items(program, "functions", &functions, &count);
  for (index = 0; index < count; index += 1) {
    const char *name = NULL;
    size_t bytes = 0;
    if (zn_field_text(functions[index], "name", &name, &bytes)) {
      strings_add(out, name, bytes);
    }
  }
}

/* ─────────────────── разложение ввода на объявления ────────────────────── */

/** Узел объявления: имя, строка начала, как он называется по-русски. */
typedef struct repl_node {
  char *name;
  size_t line;
  char *label;
  int total; /* -1 — не функция, 0 — обычная, 1 — с доказанным завершением */
} repl_node;

typedef struct repl_nodes {
  repl_node *items;
  size_t count;
  size_t capacity;
} repl_nodes;

static void nodes_init(repl_nodes *list) {
  list->items = NULL;
  list->count = 0;
  list->capacity = 0;
}

static void nodes_push(repl_nodes *list, char *name, size_t line, char *label, int total) {
  repl_node node;
  if (list->count == list->capacity) {
    list->capacity = list->capacity == 0 ? 8 : list->capacity * 2;
    list->items = (repl_node *)repl_grow(list->items, list->capacity * sizeof(repl_node));
  }
  node.name = name;
  node.line = line;
  node.label = label;
  node.total = total;
  list->items[list->count] = node;
  list->count += 1;
}

static void nodes_free(repl_nodes *list) {
  size_t index = 0;
  for (index = 0; index < list->count; index += 1) {
    free(list->items[index].name);
    free(list->items[index].label);
  }
  free(list->items);
  nodes_init(list);
}

/** Как называется конструкция наследия FTS по-русски — для списка объявлений. */
static const char *repl_legacy_word(const char *construct, size_t bytes) {
  static const char *const pairs[] = {"utility",  "утилита", "theorem",     "теорема", "functor",  "функтор",
                                      "functorFile", "функтор", "morphism", "морфизм", "category", "категория",
                                      "chain",    "цепочка", "identity",    "тождество", NULL};
  size_t index = 0;
  for (index = 0; pairs[index] != NULL; index += 2) {
    if (strlen(pairs[index]) == bytes && memcmp(pairs[index], construct, bytes) == 0) {
      return pairs[index + 1];
    }
  }
  return NULL;
}

static char *repl_label(const char *word, const char *name, size_t name_bytes) {
  repl_buf buf;
  char *label = NULL;
  buf_init(&buf);
  buf_put(&buf, word);
  buf_put(&buf, " «");
  buf_add(&buf, name, name_bytes);
  buf_put(&buf, "»");
  label = repl_dup(buf.data, buf.used);
  buf_free(&buf);
  return label;
}

/**
 * Узлы объявлений разобранной программы. Порядок тот же, что в свидетеле: типы,
 * функции, наследие, — от него зависит и порядок строк «объявлено: …».
 */
static void repl_nodes_of(fl_value program, const repl_strings *proven, repl_nodes *out) {
  const fl_value *items = NULL;
  size_t count = 0;
  size_t index = 0;
  zn_field_items(program, "types", &items, &count);
  for (index = 0; index < count; index += 1) {
    const char *name = NULL;
    const char *kind = NULL;
    size_t name_bytes = 0;
    size_t kind_bytes = 0;
    if (!zn_field_text(items[index], "name", &name, &name_bytes)) {
      continue;
    }
    zn_field_text(items[index], "kind", &kind, &kind_bytes);
    nodes_push(out, repl_dup(name, name_bytes), zn_line(items[index]),
               repl_label(kind != NULL && kind_bytes == 6 && memcmp(kind, "record", 6) == 0 ? "запись" : "тип", name,
                          name_bytes),
               -1);
  }
  zn_field_items(program, "functions", &items, &count);
  for (index = 0; index < count; index += 1) {
    const char *name = NULL;
    size_t name_bytes = 0;
    fl_value marked = fl_nothing();
    bool total = false;
    if (!zn_field_text(items[index], "name", &name, &name_bytes)) {
      continue;
    }
    if (zn_field(items[index], "total", &marked)) {
      zn_flag(marked, &total);
    }
    /* «Тотальная» без доказательства сюда не доходит — такое объявление
       отвергает анализ завершаемости, — но полагаться на пометку незачем:
       спрашиваем множество доказанных имён. */
    nodes_push(out, repl_dup(name, name_bytes), zn_line(items[index]),
               repl_label(total ? "тотальная функция" : "функция", name, name_bytes),
               total && (proven == NULL || strings_has(proven, name, name_bytes)) ? 1 : 0);
  }
  zn_field_items(program, "legacy", &items, &count);
  for (index = 0; index < count; index += 1) {
    const char *construct = NULL;
    size_t construct_bytes = 0;
    const char *name = NULL;
    size_t name_bytes = 0;
    const char *word = NULL;
    fl_value value = fl_nothing();
    if (!zn_field_text(items[index], "construct", &construct, &construct_bytes)) {
      continue;
    }
    if (construct_bytes == 12 && memcmp(construct, "moduleHeader", 12) == 0) {
      continue;
    }
    if (!zn_field(items[index], "value", &value) || !zn_field_text(value, "name", &name, &name_bytes)) {
      continue;
    }
    word = repl_legacy_word(construct, construct_bytes);
    if (word == NULL) {
      char *own = repl_dup(construct, construct_bytes);
      nodes_push(out, repl_dup(name, name_bytes), zn_line(items[index]), repl_label(own, name, name_bytes), -1);
      free(own);
      continue;
    }
    nodes_push(out, repl_dup(name, name_bytes), zn_line(items[index]), repl_label(word, name, name_bytes), -1);
  }
}

static bool repl_blank(const char *line) {
  size_t index = 0;
  for (index = 0; line[index] != '\0'; index += 1) {
    if (line[index] != ' ' && line[index] != '\t' && line[index] != '\r') {
      return false;
    }
  }
  return true;
}

static bool repl_service_line(const char *line) {
  size_t index = 0;
  if (repl_blank(line)) {
    return true;
  }
  while (line[index] == ' ' || line[index] == '\t') {
    index += 1;
  }
  return line[index] == '/' && line[index + 1] == '/';
}

static void repl_split_lines(const char *text, repl_strings *out) {
  const char *scan = text;
  for (;;) {
    const char *newline = strchr(scan, '\n');
    if (newline == NULL) {
      strings_add(out, scan, strlen(scan));
      return;
    }
    strings_add(out, scan, (size_t)(newline - scan));
    scan = newline + 1;
  }
}

/** Метка нескольких узлов сразу: один — свой, много — через запятую. */
static char *repl_label_of(const repl_nodes *nodes, size_t first, size_t last) {
  repl_buf buf;
  char *label = NULL;
  size_t index = 0;
  size_t seen = 0;
  buf_init(&buf);
  for (index = 0; index < nodes->count; index += 1) {
    if (nodes->items[index].line < first || nodes->items[index].line > last) {
      continue;
    }
    if (seen > 0) {
      buf_put(&buf, ", ");
    }
    buf_put(&buf, nodes->items[index].label);
    seen += 1;
  }
  if (seen == 0) {
    buf_put(&buf, "объявление");
  }
  label = repl_dup(buf.data, buf.used);
  buf_free(&buf);
  return label;
}

static repl_decl *decl_new(void) {
  repl_decl *decl = (repl_decl *)repl_alloc(sizeof(repl_decl));
  strings_init(&decl->names);
  decl->label = NULL;
  decl->text = NULL;
  return decl;
}

/** Один фрагмент на весь ввод: разрезать не получилось. */
static void repl_whole(const char *text, const repl_nodes *nodes, repl_decls *out) {
  repl_decl *decl = decl_new();
  size_t index = 0;
  for (index = 0; index < nodes->count; index += 1) {
    strings_say(&decl->names, nodes->items[index].name);
  }
  decl->label = repl_label_of(nodes, 1, (size_t)-1);
  decl->text = repl_say(text);
  decls_push(out, decl);
}

/**
 * Ввод режется на отдельные объявления по строкам, с которых они начинаются.
 *
 * Порознь они нужны, чтобы переобъявление меняло одну функцию, а не весь ввод
 * целиком, и чтобы «.объявления» показывал список, а не простыню. Комментарии
 * перед объявлением уходят вместе с ним: в файлах библиотеки они и есть его
 * описание, и терять их при загрузке нельзя.
 *
 * Если разрезать не получается — объявления вложены в «категория «…»», у узла
 * нет места, кусок начинается с отступа, — ввод остаётся одним фрагментом. Это
 * не отказ: сессия остаётся правильной, просто переобъявлять придётся целиком.
 */
static void repl_split(const char *text, const repl_nodes *nodes, repl_decls *out) {
  repl_strings lines;
  size_t *first = NULL;
  size_t *last = NULL;
  size_t pieces = 0;
  size_t index = 0;
  size_t inner = 0;
  bool ok = true;
  if (nodes->count == 0) {
    repl_whole(text, nodes, out);
    return;
  }
  for (index = 0; index < nodes->count; index += 1) {
    if (nodes->items[index].line == 0 || nodes->items[index].name == NULL) {
      repl_whole(text, nodes, out);
      return;
    }
  }
  strings_init(&lines);
  repl_split_lines(text, &lines);
  first = (size_t *)repl_alloc((nodes->count + 1) * sizeof(size_t));
  last = (size_t *)repl_alloc((nodes->count + 1) * sizeof(size_t));
  for (index = 0; index < nodes->count; index += 1) {
    bool seen = false;
    for (inner = 0; inner < pieces; inner += 1) {
      if (first[inner] == nodes->items[index].line) {
        seen = true;
      }
    }
    if (!seen) {
      first[pieces] = nodes->items[index].line;
      pieces += 1;
    }
  }
  for (index = 0; index + 1 < pieces; index += 1) {
    for (inner = index + 1; inner < pieces; inner += 1) {
      if (first[inner] < first[index]) {
        const size_t swap = first[index];
        first[index] = first[inner];
        first[inner] = swap;
      }
    }
  }
  for (index = 0; index < pieces; index += 1) {
    last[index] = (index + 1 < pieces ? first[index + 1] : lines.count + 1) - 1;
  }
  /* Хвост куска — комментарии и пустые строки — принадлежит следующему
     объявлению: читатель написал их про него, а не про предыдущее. */
  for (index = 0; index + 1 < pieces; index += 1) {
    while (last[index] >= first[index] && last[index] >= 1 && last[index] <= lines.count &&
           repl_service_line(lines.items[last[index] - 1])) {
      last[index] -= 1;
      first[index + 1] -= 1;
    }
  }
  while (last[pieces - 1] >= first[pieces - 1] && last[pieces - 1] >= 1 && last[pieces - 1] <= lines.count &&
         repl_blank(lines.items[last[pieces - 1] - 1])) {
    last[pieces - 1] -= 1;
  }
  /* Комментарий перед ПЕРВЫМ объявлением тем же правом принадлежит ему. Назад
     идём только по служебным строкам, поэтому заголовок модуля (он не служебная
     строка) остаётся снаружи и в объявление не заезжает. */
  while (first[0] > 1 && repl_service_line(lines.items[first[0] - 2])) {
    first[0] -= 1;
  }
  for (index = 0; index < pieces; index += 1) {
    /* Пустые строки в начале куска не несут ничего, кроме лишней пустой строки
       в сохранённом файле. */
    while (first[index] < last[index] && first[index] >= 1 && first[index] <= lines.count &&
           repl_blank(lines.items[first[index] - 1])) {
      first[index] += 1;
    }
  }
  for (index = 0; index < pieces && ok; index += 1) {
    repl_buf body;
    buf_init(&body);
    for (inner = first[index]; inner <= last[index] && inner <= lines.count; inner += 1) {
      if (body.used > 0) {
        buf_char(&body, '\n');
      }
      buf_put(&body, lines.items[inner - 1]);
    }
    /* Кусок с отступом в первой строке — часть чужого блока («категория «…»»):
       отдельным объявлением он не соберётся. */
    if (repl_blank(body.data) || body.data[0] == ' ' || body.data[0] == '\t') {
      ok = false;
    } else {
      repl_decl *decl = decl_new();
      for (inner = 0; inner < nodes->count; inner += 1) {
        if (nodes->items[inner].line >= first[index] && nodes->items[inner].line <= last[index]) {
          strings_say(&decl->names, nodes->items[inner].name);
        }
      }
      decl->label = repl_label_of(nodes, first[index], last[index]);
      decl->text = repl_dup(body.data, body.used);
      decls_push(out, decl);
    }
    buf_free(&body);
  }
  free(first);
  free(last);
  strings_free(&lines);
  if (!ok) {
    decls_free(out);
    repl_whole(text, nodes, out);
  }
}

/**
 * Замена прежних объявлений одноимёнными новыми.
 *
 * Переобъявление — не роскошь: в оболочке функцию правят по десять раз, и
 * «функция объявлена дважды» на каждую правку сделала бы её бесполезной. Замена
 * идёт НА МЕСТЕ, чтобы порядок объявлений (а значит, и сохранённый файл) не
 * переставлялся от правки к правке.
 *
 * Один случай отвергается: если прежний фрагмент объявлял несколько имён и
 * переобъявлено из них не всё, замена молча потеряла бы остальные.
 */
static char *repl_merge(const repl_decls *current, const repl_decls *fresh, repl_decls *candidate,
                        repl_decls *dropped, repl_strings *replaced, size_t *fresh_first, size_t *fresh_last) {
  repl_strings names;
  size_t index = 0;
  size_t inner = 0;
  bool inserted = false;
  char *error = NULL;
  strings_init(&names);
  for (index = 0; index < fresh->count; index += 1) {
    for (inner = 0; inner < fresh->items[index]->names.count; inner += 1) {
      strings_say(&names, fresh->items[index]->names.items[inner]);
    }
  }
  for (index = 0; index < current->count && error == NULL; index += 1) {
    const repl_decl *decl = current->items[index];
    bool some = false;
    bool every = true;
    for (inner = 0; inner < decl->names.count; inner += 1) {
      if (strings_has(&names, decl->names.items[inner], strlen(decl->names.items[inner]))) {
        some = true;
      } else {
        every = false;
      }
    }
    if (some && !every) {
      repl_buf buf;
      buf_init(&buf);
      buf_put(&buf, decl->label);
      buf_put(&buf, " объявлено вместе с ");
      for (inner = 0; inner < decl->names.count; inner += 1) {
        if (inner > 0) {
          buf_put(&buf, ", ");
        }
        buf_put(&buf, "«");
        buf_put(&buf, decl->names.items[inner]);
        buf_put(&buf, "»");
      }
      buf_put(&buf, ": переобъявите их одним вводом или начните заново командой «.сбросить»");
      error = repl_dup(buf.data, buf.used);
      buf_free(&buf);
    }
  }
  if (error != NULL) {
    strings_free(&names);
    return error;
  }
  *fresh_first = 0;
  *fresh_last = 0;
  for (index = 0; index < current->count; index += 1) {
    repl_decl *decl = current->items[index];
    bool some = false;
    for (inner = 0; inner < decl->names.count; inner += 1) {
      if (strings_has(&names, decl->names.items[inner], strlen(decl->names.items[inner]))) {
        some = true;
      }
    }
    if (some) {
      strings_say(replaced, decl->label);
      decls_push(dropped, decl);
      if (!inserted) {
        *fresh_first = candidate->count;
        for (inner = 0; inner < fresh->count; inner += 1) {
          decls_push(candidate, fresh->items[inner]);
        }
        *fresh_last = candidate->count;
        inserted = true;
      }
      continue;
    }
    decls_push(candidate, decl);
  }
  if (!inserted) {
    *fresh_first = candidate->count;
    for (inner = 0; inner < fresh->count; inner += 1) {
      decls_push(candidate, fresh->items[inner]);
    }
    *fresh_last = candidate->count;
  }
  strings_free(&names);
  return NULL;
}

/* ───────────────────────────── разбор ввода ─────────────────────────────── */

/**
 * Ошибка лексера — не повод гадать о виде ввода: пусть её покажет разбор, у
 * которого есть и место, и код. Поэтому «не разобралось» здесь означает не
 * «пусто», а «не спрашивай токены».
 */
static bool repl_tokens(const char *text, size_t bytes, fl_value *out) {
  fl_value argument = fl_nothing();
  fl_value bad = fl_nothing();
  argument = repl_value_text(text, bytes);
  if (repl_call("Диагностики", &argument, 1, &bad) != FL_OK) {
    return false;
  }
  if (bad.tag == FL_LIST && bad.as.list.count > 0) {
    return false;
  }
  argument = repl_value_text(text, bytes);
  return repl_call("Токены", &argument, 1, out) == FL_OK && out->tag == FL_LIST;
}

static bool token_significant(fl_value token) {
  fl_value kind = fl_nothing();
  if (!val_field(token, "вид", &kind)) {
    return false;
  }
  return !val_same(kind, "indent") && !val_same(kind, "dedent") && !val_same(kind, "newline") &&
         !val_same(kind, "eof");
}

/** Первый значащий токен; (size_t)-1 — такого нет. */
static size_t token_first(fl_value tokens) {
  size_t index = 0;
  if (tokens.tag != FL_LIST) {
    return (size_t)-1;
  }
  for (index = 0; index < tokens.as.list.count; index += 1) {
    if (token_significant(tokens.as.list.items[index])) {
      return index;
    }
  }
  return (size_t)-1;
}

static bool token_keyword(fl_value token, const char **word, size_t *bytes) {
  fl_value kind = fl_nothing();
  fl_value value = fl_nothing();
  if (!val_field(token, "вид", &kind) || !val_same(kind, "keyword")) {
    return false;
  }
  return val_field(token, "значение", &value) && val_text(value, word, bytes);
}

/**
 * Объявление или выражение.
 *
 * Решает первое ключевое слово — то же самое, по которому выбирает
 * `parseDeclaration`. Спорное слово ровно одно: «запись» начинает и объявление
 * типа, и литерал записи («запись «Точка» с «х» равно 1»). Различаем так же,
 * как парсер: за именем в литерале стоит «с».
 */
static bool repl_is_declaration(bool lexed, fl_value tokens) {
  const char *word = NULL;
  size_t bytes = 0;
  size_t first = 0;
  if (!lexed) {
    return false;
  }
  first = token_first(tokens);
  if (first == (size_t)-1 || !token_keyword(tokens.as.list.items[first], &word, &bytes)) {
    return false;
  }
  if (!repl_in_list(REPL_DECLARATIONS, word, bytes)) {
    return false;
  }
  if (bytes == 6 && (memcmp(word, "record", 6) == 0 || memcmp(word, "object", 6) == 0)) {
    size_t index = 0;
    for (index = first + 2; index < tokens.as.list.count; index += 1) {
      const char *tail = NULL;
      size_t tail_bytes = 0;
      if (!token_significant(tokens.as.list.items[index])) {
        continue;
      }
      if (token_keyword(tokens.as.list.items[index], &tail, &tail_bytes) &&
          ((tail_bytes == 4 && memcmp(tail, "with", 4) == 0) ||
           (tail_bytes == 8 && memcmp(tail, "contains", 8) == 0))) {
        return false;
      }
      break;
    }
  }
  return true;
}

/**
 * Общий отступ ввода снимается: вставленный из файла кусок начинается с
 * отступа, а лексер такому исходнику скажет только «рваный отступ». Столбцы
 * диагностики восстанавливаются по снятой ширине.
 */
static char *repl_dedent(const char *text, size_t *width) {
  repl_strings lines;
  repl_buf buf;
  char *result = NULL;
  const char *common = NULL;
  size_t common_len = 0;
  size_t index = 0;
  size_t end = strlen(text);
  *width = 0;
  while (end > 0 && (text[end - 1] == ' ' || text[end - 1] == '\t' || text[end - 1] == '\n' ||
                     text[end - 1] == '\r')) {
    end -= 1;
  }
  strings_init(&lines);
  buf_init(&buf);
  buf_add(&buf, text, end);
  if (buf.used == 0) {
    buf_free(&buf);
    strings_free(&lines);
    return repl_say("");
  }
  repl_split_lines(buf.data, &lines);
  for (index = 0; index < lines.count; index += 1) {
    const char *line = lines.items[index];
    size_t own = 0;
    if (repl_blank(line)) {
      continue;
    }
    while (line[own] == ' ' || line[own] == '\t') {
      own += 1;
    }
    if (common == NULL) {
      common = line;
      common_len = own;
    } else {
      size_t keep = 0;
      while (keep < common_len && keep < own && common[keep] == line[keep]) {
        keep += 1;
      }
      common_len = keep;
    }
  }
  buf_reset(&buf);
  for (index = 0; index < lines.count; index += 1) {
    const char *line = lines.items[index];
    if (index > 0) {
      buf_char(&buf, '\n');
    }
    if (common_len == 0) {
      buf_put(&buf, line);
    } else if (strncmp(line, common, common_len) == 0) {
      buf_put(&buf, line + common_len);
    } else {
      size_t skip = 0;
      while (line[skip] == ' ' || line[skip] == '\t') {
        skip += 1;
      }
      buf_put(&buf, line + skip);
    }
  }
  *width = common_len;
  result = repl_dup(buf.data, buf.used);
  strings_free(&lines);
  buf_free(&buf);
  return result;
}

/**
 * Ввод как тело функции: каждая непустая строка сдвигается на два пробела.
 *
 * Верхнего уровня «просто выражение» в языке нет: программа — это объявления
 * (SPEC, раздел 5). Заводить для оболочки второй вход в парсер значило бы
 * завести вторую грамматику, которая однажды разойдётся с первой. Обёртка
 * намеренно НЕ тотальная: она может вызывать обычные функции, и объявлять её
 * тотальной значило бы обещать завершение, которого никто не доказывал.
 */
static char *repl_wrap(const char *text, const char *name) {
  repl_strings lines;
  repl_buf buf;
  char *result = NULL;
  size_t index = 0;
  strings_init(&lines);
  buf_init(&buf);
  repl_split_lines(text, &lines);
  buf_put(&buf, "функция «");
  buf_put(&buf, name);
  buf_put(&buf, "»\n");
  for (index = 0; index < lines.count; index += 1) {
    if (index > 0) {
      buf_char(&buf, '\n');
    }
    if (!repl_blank(lines.items[index])) {
      buf_put(&buf, "  ");
      buf_put(&buf, lines.items[index]);
    }
  }
  result = repl_dup(buf.data, buf.used);
  strings_free(&lines);
  buf_free(&buf);
  return result;
}

/**
 * Разбор одного ввода отдельно от сессии.
 *
 * Нужен ровно для двух вещей: узнать, ЧТО объявлено (иначе нечего заменять при
 * переобъявлении), и показать ошибку разбора на строке ввода, а не на строке
 * собранной сессии. «использует» и «экспортирует» без заголовка модуля —
 * синтаксическая ошибка, поэтому для них заголовок подставляется, а сдвиг строк
 * возвращается вызывающему.
 */
static bool repl_parse_input(repl_session *session, const char *text, bool lexed, fl_value tokens, fl_value *program,
                             repl_bads *bads, size_t *line_shift) {
  repl_buf buf;
  fl_value args[2];
  fl_value parsed = fl_nothing();
  fl_value diagnostics = fl_nothing();
  bool header_needed = false;
  size_t index = 0;
  *line_shift = 0;
  if (lexed) {
    const size_t first = token_first(tokens);
    const char *word = NULL;
    size_t bytes = 0;
    if (first != (size_t)-1 && token_keyword(tokens.as.list.items[first], &word, &bytes)) {
      header_needed = (bytes == 4 && memcmp(word, "uses", 4) == 0) ||
                      (bytes == 7 && memcmp(word, "exports", 7) == 0);
    }
  }
  buf_init(&buf);
  if (header_needed) {
    buf_put(&buf, "модуль «" REPL_MODULE "»\n");
    *line_shift = 1;
  }
  buf_put(&buf, text);
  args[0] = repl_value_text(buf.data, buf.used);
  args[1] = repl_value_strings(&session->known);
  buf_free(&buf);
  if (repl_call("Разбор исходника", args, 2, &parsed) != FL_OK) {
    bads_say(bads, "разбор ввода прекращён");
    return false;
  }
  if (val_field(parsed, "диагностики", &diagnostics) && diagnostics.tag == FL_LIST &&
      diagnostics.as.list.count > 0) {
    for (index = 0; index < diagnostics.as.list.count; index += 1) {
      fl_value bad = diagnostics.as.list.items[index];
      fl_value code = fl_nothing();
      fl_value message = fl_nothing();
      fl_value line = fl_nothing();
      fl_value column = fl_nothing();
      if (!val_field(bad, "код", &code) || !val_field(bad, "сообщение", &message)) {
        continue;
      }
      val_field(bad, "строка", &line);
      val_field(bad, "столбец", &column);
      bads_push(bads, val_copy(code), val_copy(message), true,
                line.tag == FL_NUMBER ? (size_t)line.as.number : 0,
                column.tag == FL_NUMBER ? (size_t)column.as.number : 0);
    }
    return false;
  }
  return val_field(parsed, "программа", program);
}

/** В программе только заголовок модуля: типов, функций и наследия нет. */
static bool repl_header_only(fl_value program) {
  const fl_value *items = NULL;
  size_t count = 0;
  size_t index = 0;
  zn_field_items(program, "types", &items, &count);
  if (count > 0) {
    return false;
  }
  zn_field_items(program, "functions", &items, &count);
  if (count > 0) {
    return false;
  }
  zn_field_items(program, "legacy", &items, &count);
  for (index = 0; index < count; index += 1) {
    const char *construct = NULL;
    size_t bytes = 0;
    if (!zn_field_text(items[index], "construct", &construct, &bytes)) {
      return false;
    }
    if (bytes != 12 || memcmp(construct, "moduleHeader", 12) != 0) {
      return false;
    }
  }
  return true;
}

/**
 * Слияние заголовка модуля из ввода или загруженного файла с заголовком сессии.
 *
 * Пути импортов пересчитываются относительно каталога сессии: файл, загруженный
 * из другого каталога, ссылается на соседей по-своему, и без пересчёта его
 * «использует» указывал бы в пустоту.
 */
static void repl_merge_header(repl_session *session, fl_value program, const char *from, char **module,
                              repl_imports *imports, repl_strings *exports) {
  const fl_value *legacy = NULL;
  size_t count = 0;
  size_t index = 0;
  size_t inner = 0;
  *module = repl_say(session->module);
  imports_init(imports);
  strings_init(exports);
  for (index = 0; index < session->imports.count; index += 1) {
    imports_push(imports, import_copy(&session->imports.items[index]));
  }
  for (index = 0; index < session->exports.count; index += 1) {
    strings_say(exports, session->exports.items[index]);
  }
  zn_field_items(program, "legacy", &legacy, &count);
  for (index = 0; index < count; index += 1) {
    const char *construct = NULL;
    size_t bytes = 0;
    fl_value value = fl_nothing();
    const fl_value *items = NULL;
    size_t items_count = 0;
    const char *name = NULL;
    size_t name_bytes = 0;
    if (!zn_field_text(legacy[index], "construct", &construct, &bytes) || bytes != 12 ||
        memcmp(construct, "moduleHeader", 12) != 0 || !zn_field(legacy[index], "value", &value)) {
      continue;
    }
    if ((*module)[0] == '\0' && zn_field_text(value, "name", &name, &name_bytes)) {
      free(*module);
      *module = repl_dup(name, name_bytes);
    }
    zn_field_items(value, "imports", &items, &items_count);
    for (inner = 0; inner < items_count; inner += 1) {
      const char *category = NULL;
      size_t category_bytes = 0;
      const char *path = NULL;
      size_t path_bytes = 0;
      fl_value only = fl_nothing();
      const fl_value *only_items = NULL;
      size_t only_count = 0;
      repl_import item;
      size_t scan = 0;
      bool replaced = false;
      if (!zn_field_text(items[inner], "from", &path, &path_bytes)) {
        continue;
      }
      zn_field_text(items[inner], "category", &category, &category_bytes);
      {
        char *own = repl_dup(path, path_bytes);
        item.from = repl_rewrite_path(own, from, session->base);
        free(own);
      }
      item.category = category == NULL ? repl_say("") : repl_dup(category, category_bytes);
      strings_init(&item.only);
      item.has_only = false;
      if (zn_field(items[inner], "only", &only) && zn_items(only, &only_items, &only_count)) {
        item.has_only = true;
        for (scan = 0; scan < only_count; scan += 1) {
          const char *word = NULL;
          size_t word_bytes = 0;
          if (zn_text(only_items[scan], &word, &word_bytes)) {
            strings_add(&item.only, word, word_bytes);
          }
        }
      }
      for (scan = 0; scan < imports->count; scan += 1) {
        if (strcmp(imports->items[scan].from, item.from) == 0) {
          import_free(&imports->items[scan]);
          imports->items[scan] = item;
          replaced = true;
          break;
        }
      }
      if (!replaced) {
        imports_push(imports, item);
      }
    }
    {
      const fl_value *names = NULL;
      size_t names_count = 0;
      zn_field_items(value, "exports", &names, &names_count);
      for (inner = 0; inner < names_count; inner += 1) {
        const char *word = NULL;
        size_t word_bytes = 0;
        if (zn_text(names[inner], &word, &word_bytes) && !strings_has(exports, word, word_bytes)) {
          strings_add(exports, word, word_bytes);
        }
      }
    }
  }
}

/* ───────────────────── вычисление: печать в C, cc, запуск ──────────────── */

/*
 * Прогонщик сессии. Печатается вместе с ней и собирается вместе с ней; всё, что
 * он делает, — вызывает одну функцию без аргументов и печатает значение
 * поверхностью языка: да, нет, ничто, "текст", [1, 2], пустой список,
 * {поле: значение}, Вариант(поле: значение). Печатать иначе значило бы учить
 * человека второму словарю: то же самое пишут бэкенды («к строке» в emit/js) и
 * оболочка на Node (formatValue в repl.mjs).
 *
 * Экранирование строки идёт числами (34 — кавычка, 92 — косая), а не escape-
 * последовательностями: этот текст сам живёт в строковом литерале C, и вторая
 * ступень экранирования сделала бы его нечитаемым.
 */
static const char REPL_RUNNER[] =
    "#include \"flang_runtime.h\"\n"
    "\n"
    "#include <stdio.h>\n"
    "#include <stdlib.h>\n"
    "\n"
    "extern fl_status FL_PROGRAM_CALL(fl_ctx *ctx, const char *name, const fl_value *args, size_t count,\n"
    "                                 fl_value *result, fl_error *error);\n"
    "\n"
    "static void show_text(const char *utf8, size_t bytes) {\n"
    "  size_t index = 0;\n"
    "  putchar(34);\n"
    "  for (index = 0; index < bytes; index += 1) {\n"
    "    const unsigned char symbol = (unsigned char)utf8[index];\n"
    "    if (symbol == 34 || symbol == 92) {\n"
    "      putchar(92);\n"
    "      putchar((char)symbol);\n"
    "    } else if (symbol == 10) {\n"
    "      putchar(92);\n"
    "      putchar('n');\n"
    "    } else if (symbol == 13) {\n"
    "      putchar(92);\n"
    "      putchar('r');\n"
    "    } else if (symbol == 9) {\n"
    "      putchar(92);\n"
    "      putchar('t');\n"
    "    } else if (symbol == 8) {\n"
    "      putchar(92);\n"
    "      putchar('b');\n"
    "    } else if (symbol == 12) {\n"
    "      putchar(92);\n"
    "      putchar('f');\n"
    "    } else if (symbol < 32) {\n"
    "      printf(\"%c%c%04x\", 92, 'u', (unsigned)symbol);\n"
    "    } else {\n"
    "      putchar((char)symbol);\n"
    "    }\n"
    "  }\n"
    "  putchar(34);\n"
    "}\n"
    "\n"
    "static void show(fl_value value) {\n"
    "  size_t index = 0;\n"
    "  char number[FL_NUMBER_TEXT_MAX];\n"
    "  switch (value.tag) {\n"
    "    case FL_NOTHING:\n"
    "      fputs(\"ничто\", stdout);\n"
    "      return;\n"
    "    case FL_FLAG:\n"
    "      fputs(value.as.flag ? \"да\" : \"нет\", stdout);\n"
    "      return;\n"
    "    case FL_NUMBER:\n"
    "      if (value.as.number == 0.0 && !(1.0 / value.as.number > 0.0)) {\n"
    "        fputs(\"-0\", stdout);\n"
    "        return;\n"
    "      }\n"
    "      fl_number_text(value.as.number, number);\n"
    "      fputs(number, stdout);\n"
    "      return;\n"
    "    case FL_STRING:\n"
    "      show_text(value.as.string.utf8, value.as.string.bytes);\n"
    "      return;\n"
    "    case FL_LIST:\n"
    "      if (value.as.list.count == 0) {\n"
    "        fputs(\"пустой список\", stdout);\n"
    "        return;\n"
    "      }\n"
    "      putchar('[');\n"
    "      for (index = 0; index < value.as.list.count; index += 1) {\n"
    "        if (index > 0) {\n"
    "          fputs(\", \", stdout);\n"
    "        }\n"
    "        show(value.as.list.items[index]);\n"
    "      }\n"
    "      putchar(']');\n"
    "      return;\n"
    "    case FL_RECORD:\n"
    "      putchar('{');\n"
    "      for (index = 0; index < value.as.record->count; index += 1) {\n"
    "        if (index > 0) {\n"
    "          fputs(\", \", stdout);\n"
    "        }\n"
    "        fputs(value.as.record->fields[index].name, stdout);\n"
    "        fputs(\": \", stdout);\n"
    "        show(value.as.record->fields[index].value);\n"
    "      }\n"
    "      putchar('}');\n"
    "      return;\n"
    "    case FL_VARIANT:\n"
    "      fputs(value.as.variant->name, stdout);\n"
    "      if (value.as.variant->count == 0) {\n"
    "        return;\n"
    "      }\n"
    "      putchar('(');\n"
    "      for (index = 0; index < value.as.variant->count; index += 1) {\n"
    "        if (index > 0) {\n"
    "          fputs(\", \", stdout);\n"
    "        }\n"
    "        fputs(value.as.variant->fields[index].name, stdout);\n"
    "        fputs(\": \", stdout);\n"
    "        show(value.as.variant->fields[index].value);\n"
    "      }\n"
    "      putchar(')');\n"
    "      return;\n"
    "  }\n"
    "  fputs(\"ничто\", stdout);\n"
    "}\n"
    "\n"
    "int main(int argc, char **argv) {\n"
    "  fl_arena arena;\n"
    "  fl_ctx ctx;\n"
    "  fl_error error;\n"
    "  fl_value result = fl_nothing();\n"
    "  fl_value args[1];\n"
    "  args[0] = fl_nothing();\n"
    "  if (argc < 2) {\n"
    "    fputs(\"прогонщик сессии: не названа функция\\n\", stderr);\n"
    "    return 2;\n"
    "  }\n"
    "  fl_arena_init(&arena);\n"
    "  fl_ctx_init(&ctx, &arena);\n"
    "  /* Пределы приходят снаружи: рантайм собран заранее, и «--max-steps»\n"
    "     оболочки иначе было бы нечем исполнить. Ноль означает «как собрано». */\n"
    "  if (argc > 2 && strtoul(argv[2], NULL, 10) > 0) {\n"
    "    ctx.max_steps = (size_t)strtoul(argv[2], NULL, 10);\n"
    "  }\n"
    "  if (argc > 3 && strtoul(argv[3], NULL, 10) > 0) {\n"
    "    ctx.max_depth = (size_t)strtoul(argv[3], NULL, 10);\n"
    "  }\n"
    "  error.code = NULL;\n"
    "  error.message = NULL;\n"
    "  if (FL_PROGRAM_CALL(&ctx, argv[1], args, 0, &result, &error) != FL_OK) {\n"
    "    fprintf(stderr, \"%s: %s\\n\", error.code == NULL ? \"FLANG_UNKNOWN\" : error.code,\n"
    "            error.message == NULL ? \"\" : error.message);\n"
    "    fl_arena_release(&arena);\n"
    "    return 1;\n"
    "  }\n"
    "  show(result);\n"
    "  putchar('\\n');\n"
    "  fl_arena_release(&arena);\n"
    "  return 0;\n"
    "}\n";

/** Аргумент для оболочки: одинарные кавычки не раскрывают ничего. */
static void buf_shell(repl_buf *buf, const char *text) {
  size_t index = 0;
  buf_char(buf, '\'');
  for (index = 0; text[index] != '\0'; index += 1) {
    if (text[index] == '\'') {
      buf_put(buf, "'\\''");
    } else {
      buf_char(buf, text[index]);
    }
  }
  buf_char(buf, '\'');
}

/** Всё созданное во временном каталоге записывается, чтобы быть убранным. */
static void repl_litter(repl_session *session, const char *name) {
  char *path = repl_join(session->tmp_dir, name);
  if (!strings_has(&session->litter, path, strlen(path))) {
    strings_say(&session->litter, path);
  }
  free(path);
}

/** Число из «#define FL_MAX_TAIL_ARGS N» напечатанного заголовка рантайма. */
static size_t repl_defined(const char *text, size_t bytes, const char *macro) {
  repl_buf needle;
  const char *found = NULL;
  size_t value = 0;
  size_t index = 0;
  buf_init(&needle);
  buf_put(&needle, "#define ");
  buf_put(&needle, macro);
  buf_char(&needle, ' ');
  /* Заголовок приезжает строкой рантайма — она не обязана кончаться нулём,
     поэтому ищем руками, а не strstr. */
  for (index = 0; index + needle.used <= bytes; index += 1) {
    if (memcmp(text + index, needle.data, needle.used) == 0) {
      found = text + index + needle.used;
      break;
    }
  }
  if (found != NULL) {
    while (*found >= '0' && *found <= '9') {
      value = value * 10 + (size_t)(*found - '0');
      found += 1;
    }
  }
  buf_free(&needle);
  return value;
}

/**
 * Печать сессии в C и её сборка.
 *
 * Рантайм не печатается и не пересобирается: он уже стоит рядом с бинарником
 * готовым архивом, а его заголовок берётся оттуда же. Собирается ровно сессия —
 * два файла, — и это доли секунды вместо пересборки компилятора.
 *
 * Ширину отскока батута заголовок диктует свою (FL_MAX_TAIL_ARGS входит в
 * fl_bounce), поэтому сессия, которой нужно больше, честно отвергается: собрать
 * её с готовым рантаймом нельзя, а тихо переполнить массив — тем более.
 */
static bool repl_compile(repl_session *session, fl_value program, char **error) {
  /* Прогонщик сессии — не тот, что печатается обычно, а наш маленький: ему
     нужно вычислить одну функцию и напечатать значение поверхностью языка.
     Своей оболочки сессии не нужно — «оболочка» здесь нет, и ста килобайт
     чужого кода в неё не попадает. */
  /*
   * Границы входа у сессии нет, и это не упущение. Таблица объявленных типов
   * приходит от слоя типов, а сессия печатается здесь, в готовом бинарнике, где
   * этого слоя под рукой нет. Пустые списки означают «сверять нечего»: сессия
   * зовётся своим маленьким прогонщиком (REPL_RUNNER), а он в границу и не
   * ходит — значения ему подаёт человек через ту же оболочку, а не сеть.
   */
  static const char *const names[15] = {"путь",              "есть путь",        "база",
                                        "предел глубины",    "предел шагов",     "прогонщик",
                                        "рантайм заголовок", "рантайм исходник", "исходник прогонщика",
                                        "оболочка",          "исходник оболочки", "типы входа",
                                        "поля входа",        "варианты входа",   "параметры входа"};
  fl_value values[15];
  fl_value args[2];
  fl_value emitted = fl_nothing();
  fl_value files = fl_nothing();
  fl_value failure = fl_nothing();
  repl_buf command;
  repl_strings sources;
  size_t index = 0;
  bool ok = true;
  *error = NULL;
  values[0] = repl_value_say("session");
  values[1] = fl_flag(true);
  values[2] = fl_number((double)FL_INDEX_BASE);
  values[3] = fl_number((double)FL_MAX_DEPTH);
  values[4] = fl_number((double)FL_MAX_STEPS);
  values[5] = fl_flag(true);
  values[6] = repl_value_say("");
  values[7] = repl_value_say("");
  values[8] = repl_value_say(REPL_RUNNER);
  values[9] = fl_flag(false);
  values[10] = repl_value_say("");
  values[11] = fl_list(NULL, 0);
  values[12] = fl_list(NULL, 0);
  values[13] = fl_list(NULL, 0);
  values[14] = fl_list(NULL, 0);
  args[0] = program;
  args[1] = repl_value_record(names, values, 15);
  if (repl_call("Напечатать связанное", args, 2, &emitted) != FL_OK) {
    *error = repl_say("печать сессии в C прекращена");
    return false;
  }
  if (val_field(emitted, "ошибка", &failure) && !val_same(failure, "")) {
    *error = val_copy(failure);
    return false;
  }
  if (!val_field(emitted, "файлы", &files) || files.tag != FL_LIST) {
    *error = repl_say("печать сессии в C не вернула файлов");
    return false;
  }
  strings_init(&sources);
  for (index = 0; index < files.as.list.count && ok; index += 1) {
    fl_value path = fl_nothing();
    fl_value content = fl_nothing();
    const char *text = NULL;
    size_t bytes = 0;
    char *name = NULL;
    if (!val_field(files.as.list.items[index], "путь", &path) ||
        !val_field(files.as.list.items[index], "содержимое", &content) || !val_text(content, &text, &bytes)) {
      continue;
    }
    name = val_copy(path);
    if (strcmp(name, "flang_runtime.h") == 0) {
      const size_t needed = repl_defined(text, bytes, "FL_MAX_TAIL_ARGS");
      if (needed > FL_MAX_TAIL_ARGS) {
        repl_buf say;
        buf_init(&say);
        buf_put(&say, "во взаимной рекурсии сессии ");
        buf_number(&say, needed);
        buf_put(&say, " аргументов, а установленный рантайм собран на ");
        buf_number(&say, (size_t)FL_MAX_TAIL_ARGS);
        buf_put(&say, ": проверить такую сессию оболочка может, вычислить — нет");
        *error = repl_dup(say.data, say.used);
        buf_free(&say);
        ok = false;
      }
      free(name);
      continue;
    }
    if (strcmp(name, "flang_runtime.c") == 0 || strcmp(name, "Makefile") == 0) {
      free(name);
      continue;
    }
    {
      char *full = repl_join(session->tmp_dir, name);
      FILE *stream = fopen(full, "wb");
      if (stream == NULL) {
        repl_buf say;
        buf_init(&say);
        buf_put(&say, "не удалось записать ");
        buf_put(&say, full);
        *error = repl_dup(say.data, say.used);
        buf_free(&say);
        ok = false;
      } else {
        const size_t length = strlen(name);
        fwrite(text, 1, bytes, stream);
        fclose(stream);
        repl_litter(session, name);
        if (length > 2 && strcmp(name + length - 2, ".c") == 0) {
          strings_say(&sources, full);
        }
      }
      free(full);
    }
    free(name);
  }
  if (!ok) {
    strings_free(&sources);
    return false;
  }

  buf_init(&command);
  buf_shell(&command, session->cc);
  buf_put(&command, " -std=c99 -I");
  buf_shell(&command, session->include_dir);
  buf_put(&command, " -o ");
  {
    char *binary = repl_join(session->tmp_dir, "session");
    buf_shell(&command, binary);
    repl_litter(session, "session");
    free(binary);
  }
  for (index = 0; index < sources.count; index += 1) {
    buf_char(&command, ' ');
    buf_shell(&command, sources.items[index]);
  }
  buf_char(&command, ' ');
  {
    char *archive = repl_join(session->lib_dir, REPL_ARCHIVE);
    buf_shell(&command, archive);
    free(archive);
  }
  buf_put(&command, " -lm > ");
  {
    char *log = repl_join(session->tmp_dir, "cc.log");
    buf_shell(&command, log);
    repl_litter(session, "cc.log");
    free(log);
  }
  buf_put(&command, " 2>&1");
  if (system(command.data) != 0) {
    /* Отказ cc — это внятное сообщение, а не молчаливый пропуск: без него
       человек видел бы «ничего не произошло» и не знал бы, где искать. */
    char *log = repl_join(session->tmp_dir, "cc.log");
    size_t bytes = 0;
    char *text = repl_read_file(log, &bytes);
    repl_buf say;
    buf_init(&say);
    buf_put(&say, "cc не собрал сессию (");
    buf_put(&say, session->cc);
    buf_put(&say, "):\n");
    buf_put(&say, text == NULL ? "вывод компилятора не прочитан" : text);
    *error = repl_dup(say.data, say.used);
    buf_free(&say);
    free(text);
    free(log);
    ok = false;
  }
  buf_free(&command);
  strings_free(&sources);
  return ok;
}

/** Запуск собранной сессии; печатает значение или диагностику вычисления. */
static bool repl_run(repl_session *session, const char *function) {
  repl_buf command;
  char *binary = repl_join(session->tmp_dir, "session");
  char *out = repl_join(session->tmp_dir, "out.txt");
  char *err = repl_join(session->tmp_dir, "err.txt");
  size_t bytes = 0;
  char *text = NULL;
  bool ok = true;
  buf_init(&command);
  buf_shell(&command, binary);
  buf_char(&command, ' ');
  buf_shell(&command, function);
  buf_char(&command, ' ');
  buf_shell(&command, session->steps);
  buf_char(&command, ' ');
  buf_shell(&command, session->depth);
  buf_put(&command, " > ");
  buf_shell(&command, out);
  buf_put(&command, " 2> ");
  buf_shell(&command, err);
  repl_litter(session, "out.txt");
  repl_litter(session, "err.txt");
  if (system(command.data) == 0) {
    text = repl_read_file(out, &bytes);
    if (text != NULL) {
      fwrite(text, 1, bytes, stdout);
    }
  } else {
    /* Предел шагов приходит сюда обычным FLANG_RECURSION_LIMIT рантайма. Текст
       не подменяем: в нём названы функция, лимит и глубина. */
    text = repl_read_file(err, &bytes);
    if (text != NULL && bytes > 0) {
      fwrite(text, 1, bytes, stderr);
    } else {
      fputs("FLANG_INTERNAL: собранная сессия прекратила работу без сообщения\n", stderr);
    }
    ok = false;
  }
  free(text);
  buf_free(&command);
  free(binary);
  free(out);
  free(err);
  return ok;
}

/* ────────────────────────── принятие ввода в сессию ─────────────────────── */

/** Сборка кандидата и его проверка целиком. */
static bool repl_apply(repl_session *session, const char *module, const repl_imports *imports,
                       const repl_strings *exports, const repl_decls *candidate, size_t fresh_first,
                       size_t fresh_last, repl_bads *bads, fl_value *program, repl_strings *proven,
                       repl_buf *source, repl_map *map) {
  repl_view view;
  bool has_program = false;
  view.module = module;
  view.imports = imports;
  view.exports = exports;
  view.decls = candidate;
  view.fresh_first = fresh_first;
  view.fresh_last = fresh_last;
  repl_assemble(&view, NULL, 0, 0, source, map);
  return repl_check(session, source->data, imports, bads, program, &has_program, proven);
}

/** Принятое становится сессией; всё, что заменено, освобождается здесь. */
static void repl_commit(repl_session *session, char *module, repl_imports *imports, repl_strings *exports,
                        repl_decls *candidate, repl_decls *dropped, fl_value program, repl_strings *proven) {
  size_t index = 0;
  free(session->module);
  session->module = module;
  imports_free(&session->imports);
  session->imports = *imports;
  imports_init(imports);
  strings_free(&session->exports);
  session->exports = *exports;
  strings_init(exports);
  for (index = 0; index < dropped->count; index += 1) {
    decl_free(dropped->items[index]);
  }
  free(session->decls.items);
  session->decls = *candidate;
  decls_init(candidate);
  strings_free(&session->known);
  repl_known_of(program, &session->known);
  strings_free(&session->total);
  session->total = *proven;
  strings_init(proven);
}

/**
 * Что сказать про принятые объявления. Про функцию говорится главное: доказано
 * ли её завершение. «Тотальная» без доказательства не бывает — такое объявление
 * сюда не доходит.
 */
static void repl_report(const repl_nodes *nodes, const repl_strings *proven, const repl_strings *replaced,
                        const char *from) {
  size_t index = 0;
  for (index = 0; index < replaced->count; index += 1) {
    printf("заменено: %s\n", replaced->items[index]);
  }
  if (nodes->count > REPL_VERBOSE) {
    /* Файл библиотеки — это два десятка объявлений; перечислять их построчно
       значит залить экран. Считаем то, ради чего их и читают. */
    size_t total = 0;
    size_t plain = 0;
    for (index = 0; index < nodes->count; index += 1) {
      if (nodes->items[index].total == 1) {
        total += 1;
      } else if (nodes->items[index].total == 0) {
        plain += 1;
      }
    }
    printf("объявлений: %lu — с доказанным завершением %lu, обычных функций %lu, типов и прочего %lu\n",
           (unsigned long)nodes->count, (unsigned long)total, (unsigned long)plain,
           (unsigned long)(nodes->count - total - plain));
  } else {
    for (index = 0; index < nodes->count; index += 1) {
      const repl_node *node = &nodes->items[index];
      const int total =
          node->total == 1 && proven != NULL && !strings_has(proven, node->name, strlen(node->name)) ? 0 : node->total;
      printf("объявлено: %s%s\n", node->label,
             total == 1 ? " — завершение доказано"
                        : total == 0 ? " — завершение не доказано: вычисление ограничено лимитом шагов" : "");
    }
  }
  if (from != NULL) {
    printf("загружено из %s\n", from);
  }
}

/**
 * Объявления из ввода или из файла вливаются в сессию одинаково: разбираются,
 * режутся на фрагменты, заменяют одноимённые прежние — и только после того, как
 * собранная сессия прошла проверку целиком, становятся сессией. Отвергнутое не
 * оставляет следов: сессия после отказа обязана быть точно такой, какой была.
 */
static bool repl_take(repl_session *session, fl_value program, const char *from_directory, const char *from_label,
                      const char *text) {
  repl_nodes nodes;
  repl_decls fresh;
  repl_decls candidate;
  repl_decls dropped;
  repl_strings replaced;
  repl_strings proven;
  repl_bads bads;
  repl_buf source;
  repl_map map;
  repl_imports imports;
  repl_strings exports;
  fl_value linked = fl_nothing();
  char *module = NULL;
  char *error = NULL;
  size_t fresh_first = 0;
  size_t fresh_last = 0;
  size_t index = 0;
  bool ok = false;
  nodes_init(&nodes);
  decls_init(&fresh);
  decls_init(&candidate);
  decls_init(&dropped);
  strings_init(&replaced);
  strings_init(&proven);
  bads_init(&bads);
  buf_init(&source);
  map_init(&map);
  repl_merge_header(session, program, from_directory, &module, &imports, &exports);
  repl_nodes_of(program, NULL, &nodes);
  repl_split(text, &nodes, &fresh);
  error = repl_merge(&session->decls, &fresh, &candidate, &dropped, &replaced, &fresh_first, &fresh_last);
  if (error != NULL) {
    bads_say(&bads, error);
    free(error);
    repl_print_bads(&bads, NULL, NULL, NULL, 0, 0);
  } else if (repl_apply(session, module, &imports, &exports, &candidate, fresh_first, fresh_last, &bads, &linked,
                        &proven, &source, &map)) {
    repl_strings kept;
    strings_init(&kept);
    for (index = 0; index < proven.count; index += 1) {
      strings_say(&kept, proven.items[index]);
    }
    repl_commit(session, module, &imports, &exports, &candidate, &dropped, linked, &proven);
    module = NULL;
    repl_report(&nodes, &kept, &replaced, from_label);
    strings_free(&kept);
    ok = true;
  } else {
    repl_print_bads(&bads, &map, NULL, NULL, 0, 0);
  }
  if (!ok) {
    for (index = 0; index < fresh.count; index += 1) {
      decl_free(fresh.items[index]);
    }
    imports_free(&imports);
    strings_free(&exports);
  }
  free(module);
  free(fresh.items);
  free(candidate.items);
  free(dropped.items);
  strings_free(&replaced);
  strings_free(&proven);
  bads_free(&bads);
  buf_free(&source);
  map_free(&map);
  nodes_free(&nodes);
  return ok;
}

/**
 * Ввод, в котором есть только заголовок модуля, меняет заголовок сессии, а не
 * список объявлений: «использует» в исходнике обязан стоять ровно один раз и
 * ровно наверху, иначе связывание увидит не тот набор импортов.
 */
static bool repl_take_header(repl_session *session, fl_value program) {
  repl_imports imports;
  repl_strings exports;
  repl_strings proven;
  repl_strings was;
  repl_bads bads;
  repl_buf source;
  repl_buf header;
  repl_map map;
  repl_decls dropped;
  repl_decls candidate;
  fl_value linked = fl_nothing();
  char *module = NULL;
  size_t index = 0;
  size_t appeared = 0;
  bool ok = false;
  strings_init(&proven);
  strings_init(&was);
  bads_init(&bads);
  buf_init(&source);
  buf_init(&header);
  map_init(&map);
  decls_init(&dropped);
  decls_init(&candidate);
  repl_merge_header(session, program, session->base, &module, &imports, &exports);
  if (repl_apply(session, module, &imports, &exports, &session->decls, session->decls.count, session->decls.count,
                 &bads, &linked, &proven, &source, &map)) {
    for (index = 0; index < session->decls.count; index += 1) {
      decls_push(&candidate, session->decls.items[index]);
    }
    for (index = 0; index < session->known.count; index += 1) {
      strings_say(&was, session->known.items[index]);
    }
    repl_commit(session, module, &imports, &exports, &candidate, &dropped, linked, &proven);
    module = NULL;
    for (index = 0; index < session->known.count; index += 1) {
      if (!strings_has(&was, session->known.items[index], strlen(session->known.items[index]))) {
        appeared += 1;
      }
    }
    if (repl_header_text(session->module, &session->imports, &session->exports, &header)) {
      printf("%s\n", header.data);
    } else {
      printf("\n");
    }
    /* Импорт сам по себе ничего не объявляет, поэтому докладываем не
       «объявлено», а что именно стало видно: без этого числа непонятно,
       подключилось ли хоть что-нибудь. */
    printf("стало видно функций: %lu\n", (unsigned long)appeared);
    ok = true;
  } else {
    repl_print_bads(&bads, &map, NULL, NULL, 0, 0);
    imports_free(&imports);
    strings_free(&exports);
  }
  free(module);
  free(dropped.items);
  free(candidate.items);
  strings_free(&was);
  strings_free(&proven);
  bads_free(&bads);
  buf_free(&source);
  buf_free(&header);
  map_free(&map);
  return ok;
}

/* ─────────────────────────────── вычисление ─────────────────────────────── */

static bool repl_evaluate(repl_session *session, const char *text, size_t indent) {
  repl_buf name;
  repl_view view;
  repl_buf source;
  repl_map map;
  repl_bads bads;
  repl_strings proven;
  fl_value program = fl_nothing();
  char *tail = NULL;
  char *error = NULL;
  bool has_program = false;
  bool ok = false;
  buf_init(&name);
  buf_init(&source);
  map_init(&map);
  bads_init(&bads);
  strings_init(&proven);
  /* Имя обёртки, не занятое ничем в сессии: столкнуться можно только нарочно. */
  buf_put(&name, REPL_EXPR_NAME);
  while (strings_has(&session->known, name.data, name.used)) {
    buf_put(&name, "′");
  }
  tail = repl_wrap(text, name.data);
  view.module = session->module;
  view.imports = &session->imports;
  view.exports = &session->exports;
  view.decls = &session->decls;
  view.fresh_first = session->decls.count;
  view.fresh_last = session->decls.count;
  repl_assemble(&view, tail, 1, 2 + indent, &source, &map);
  if (!repl_check(session, source.data, &session->imports, &bads, &program, &has_program, &proven)) {
    repl_print_bads(&bads, &map, NULL, NULL, 0, 0);
  } else if (session->why_no_eval != NULL) {
    /* Вычислять нечем — но проверка прошла, и сказать об этом надо: молчание
       читалось бы как «ничего не случилось». Чем именно нечем, сказано один раз
       при запуске, а не на каждой строке. */
    printf("проверено\n");
    ok = true;
  } else if (!repl_compile(session, program, &error)) {
    fprintf(stderr, "FLANG_CLI: %s\n", error == NULL ? "сессия не собралась" : error);
  } else {
    ok = repl_run(session, name.data);
  }
  free(error);
  free(tail);
  buf_free(&name);
  buf_free(&source);
  map_free(&map);
  bads_free(&bads);
  strings_free(&proven);
  return ok;
}

/* ─────────────────────────────── команды ────────────────────────────────── */

static bool repl_command_list(repl_session *session) {
  repl_buf header;
  size_t index = 0;
  buf_init(&header);
  if (repl_header_text(session->module, &session->imports, &session->exports, &header)) {
    printf("%s\n", header.data);
  }
  buf_free(&header);
  if (session->decls.count == 0) {
    printf("в сессии ничего не объявлено\n");
    return true;
  }
  for (index = 0; index < session->decls.count; index += 1) {
    const repl_decl *decl = session->decls.items[index];
    const char *about = "";
    size_t inner = 0;
    bool proven = false;
    for (inner = 0; inner < decl->names.count; inner += 1) {
      if (strings_has(&session->total, decl->names.items[inner], strlen(decl->names.items[inner]))) {
        proven = true;
      }
    }
    /* Про завершение говорит не пометка в тексте, а множество доказанных имён. */
    if (proven) {
      about = " — завершение доказано";
    } else if (strstr(decl->label, "функция") != NULL) {
      about = " — обычная: завершение не доказано";
    }
    printf("%lu. %s%s\n", (unsigned long)(index + 1), decl->label, about);
  }
  return true;
}

static bool repl_command_source(repl_session *session) {
  repl_view view;
  repl_buf source;
  repl_map map;
  buf_init(&source);
  map_init(&map);
  view.module = session->module;
  view.imports = &session->imports;
  view.exports = &session->exports;
  view.decls = &session->decls;
  view.fresh_first = session->decls.count;
  view.fresh_last = session->decls.count;
  repl_assemble(&view, NULL, 0, 0, &source, &map);
  while (source.used > 0 && (source.data[source.used - 1] == '\n' || source.data[source.used - 1] == ' ' ||
                             source.data[source.used - 1] == '\t')) {
    source.used -= 1;
    source.data[source.used] = '\0';
  }
  printf("%s\n", source.used == 0 ? "сессия пуста" : source.data);
  buf_free(&source);
  map_free(&map);
  return true;
}

static bool repl_command_save(repl_session *session, const char *path) {
  repl_bads bads;
  repl_imports imports;
  repl_view view;
  repl_buf source;
  repl_map map;
  char *full = NULL;
  char *directory = NULL;
  size_t index = 0;
  bool ok = false;
  bads_init(&bads);
  if (path[0] == '\0') {
    bads_say(&bads, "«.сохранить» требует путь к файлу");
    repl_print_bads(&bads, NULL, NULL, NULL, 0, 0);
    bads_free(&bads);
    return false;
  }
  full = repl_resolve(session->base, path);
  directory = repl_dirname(full);
  /* Пути импортов пересчитываются относительно места файла, а не сессии: иначе
     сохранённая в другой каталог сессия ссылалась бы на модули мимо них, и
     «flang check» на ней падал бы — то есть сохранение врало бы. */
  imports_init(&imports);
  for (index = 0; index < session->imports.count; index += 1) {
    repl_import item = import_copy(&session->imports.items[index]);
    char *rewritten = repl_rewrite_path(item.from, session->base, directory);
    free(item.from);
    item.from = rewritten;
    imports_push(&imports, item);
  }
  buf_init(&source);
  map_init(&map);
  view.module = session->module;
  view.imports = &imports;
  view.exports = &session->exports;
  view.decls = &session->decls;
  view.fresh_first = session->decls.count;
  view.fresh_last = session->decls.count;
  repl_assemble(&view, NULL, 0, 0, &source, &map);
  if (source.used == 0) {
    bads_say(&bads, "сохранять нечего: в сессии ничего не объявлено");
  } else {
    FILE *stream = NULL;
    errno = 0;
    stream = fopen(full, "wb");
    if (stream == NULL) {
      const int reason = errno;
      repl_buf say;
      buf_init(&say);
      buf_put(&say, "не удалось записать ");
      buf_put(&say, full);
      if (reason != 0) {
        buf_put(&say, ": ");
        buf_put(&say, strerror(reason));
      }
      bads_push(&bads, repl_say("FLANG_CLI"), repl_dup(say.data, say.used), false, 0, 0);
      buf_free(&say);
    } else {
      fwrite(source.data, 1, source.used, stream);
      fclose(stream);
      printf("сессия записана в %s (объявлений: %lu)\n", full, (unsigned long)session->decls.count);
      ok = true;
    }
  }
  if (!ok) {
    repl_print_bads(&bads, NULL, NULL, NULL, 0, 0);
  }
  bads_free(&bads);
  imports_free(&imports);
  buf_free(&source);
  map_free(&map);
  free(full);
  free(directory);
  return ok;
}

/**
 * Загрузка файла в сессию.
 *
 * Файл не «подключается», а разбирается на объявления и вливается в сессию —
 * ровно как если бы его набрали руками. Поэтому загруженную функцию можно тут же
 * переобъявить, а «.сохранить» вернёт всё это одним файлом. Подключение без
 * копирования у языка уже есть, и это «использует «Модуль» из "…"».
 */
static bool repl_command_load(repl_session *session, const char *path) {
  repl_bads bads;
  fl_value args[2];
  fl_value parsed = fl_nothing();
  fl_value program = fl_nothing();
  fl_value diagnostics = fl_nothing();
  char *full = NULL;
  char *directory = NULL;
  char *text = NULL;
  size_t bytes = 0;
  size_t index = 0;
  bool ok = false;
  bads_init(&bads);
  if (path[0] == '\0') {
    bads_say(&bads, "«.загрузить» требует путь к файлу");
    repl_print_bads(&bads, NULL, NULL, NULL, 0, 0);
    bads_free(&bads);
    return false;
  }
  full = repl_resolve(session->base, path);
  {
    const size_t length = strlen(full);
    const bool json = length > 5 && strcmp(full + length - 5, ".json") == 0;
    const bool fts = length > 4 && strcmp(full + length - 4, ".fts") == 0;
    if (json || fts) {
      repl_buf say;
      buf_init(&say);
      buf_put(&say, "оболочка загружает исходники flang, а ");
      buf_put(&say, full);
      buf_put(&say, json ? " — JSON с готовым AST" : " — модель FTS");
      buf_put(&say, " — нет; для них есть «flang check» и «flang run»");
      bads_push(&bads, repl_say("FLANG_CLI"), repl_dup(say.data, say.used), false, 0, 0);
      buf_free(&say);
      repl_print_bads(&bads, NULL, NULL, NULL, 0, 0);
      bads_free(&bads);
      free(full);
      return false;
    }
  }
  errno = 0;
  text = repl_read_file(full, &bytes);
  if (text == NULL) {
    /* Причину называет система, а не мы: «не удалось прочитать» без неё не
       различает «нет файла» и «нет прав», а это разные починки. */
    const int reason = errno;
    repl_buf say;
    buf_init(&say);
    buf_put(&say, "не удалось прочитать ");
    buf_put(&say, full);
    if (reason != 0) {
      buf_put(&say, ": ");
      buf_put(&say, strerror(reason));
    }
    bads_push(&bads, repl_say("FLANG_CLI"), repl_dup(say.data, say.used), false, 0, 0);
    buf_free(&say);
    repl_print_bads(&bads, NULL, NULL, NULL, 0, 0);
    bads_free(&bads);
    free(full);
    return false;
  }
  args[0] = repl_value_text(text, bytes);
  args[1] = repl_value_strings(&session->known);
  directory = repl_dirname(full);
  if (repl_call("Разбор исходника", args, 2, &parsed) != FL_OK) {
    bads_say(&bads, "разбор файла прекращён");
    repl_print_bads(&bads, NULL, NULL, NULL, 0, 0);
  } else if (val_field(parsed, "диагностики", &diagnostics) && diagnostics.tag == FL_LIST &&
             diagnostics.as.list.count > 0) {
    for (index = 0; index < diagnostics.as.list.count; index += 1) {
      fl_value bad = diagnostics.as.list.items[index];
      fl_value code = fl_nothing();
      fl_value message = fl_nothing();
      fl_value line = fl_nothing();
      if (!val_field(bad, "код", &code) || !val_field(bad, "сообщение", &message)) {
        continue;
      }
      val_field(bad, "строка", &line);
      bads_push(&bads, val_copy(code), val_copy(message), true,
                line.tag == FL_NUMBER ? (size_t)line.as.number : 0, 0);
    }
    repl_print_bads(&bads, NULL, "файл", path, 0, 0);
  } else if (val_field(parsed, "программа", &program)) {
    ok = repl_take(session, program, directory, path, text);
  }
  bads_free(&bads);
  free(text);
  free(full);
  free(directory);
  return ok;
}

static void repl_reset(repl_session *session) {
  free(session->module);
  session->module = repl_say("");
  imports_free(&session->imports);
  strings_free(&session->exports);
  decls_free(&session->decls);
  strings_free(&session->known);
  strings_free(&session->total);
}

/** Команда: разбор имени и довеска. Регистр латиницы не важен, как в свидетеле. */
static bool repl_command(repl_session *session, const char *line, bool *quit) {
  repl_buf name;
  const char *rest = line;
  char *argument = NULL;
  size_t end = 0;
  bool ok = true;
  buf_init(&name);
  while (*rest != '\0' && *rest != ' ' && *rest != '\t') {
    buf_char(&name, *rest >= 'A' && *rest <= 'Z' ? (char)(*rest - 'A' + 'a') : *rest);
    rest += 1;
  }
  while (*rest == ' ' || *rest == '\t') {
    rest += 1;
  }
  end = strlen(rest);
  while (end > 0 && (rest[end - 1] == ' ' || rest[end - 1] == '\t')) {
    end -= 1;
  }
  argument = repl_dup(rest, end);
  if (strcmp(name.data, ".помощь") == 0 || strcmp(name.data, ".help") == 0 || strcmp(name.data, ".?") == 0) {
    printf("%s\n", REPL_HELP);
  } else if (strcmp(name.data, ".объявления") == 0 || strcmp(name.data, ".list") == 0) {
    ok = repl_command_list(session);
  } else if (strcmp(name.data, ".исходник") == 0 || strcmp(name.data, ".source") == 0) {
    ok = repl_command_source(session);
  } else if (strcmp(name.data, ".сохранить") == 0 || strcmp(name.data, ".save") == 0) {
    ok = repl_command_save(session, argument);
  } else if (strcmp(name.data, ".загрузить") == 0 || strcmp(name.data, ".load") == 0) {
    ok = repl_command_load(session, argument);
  } else if (strcmp(name.data, ".сбросить") == 0 || strcmp(name.data, ".reset") == 0) {
    repl_reset(session);
    printf("сессия сброшена: объявлений нет\n");
  } else if (strcmp(name.data, ".выход") == 0 || strcmp(name.data, ".quit") == 0 ||
             strcmp(name.data, ".exit") == 0) {
    *quit = true;
  } else {
    repl_bads bads;
    repl_buf say;
    bads_init(&bads);
    buf_init(&say);
    buf_put(&say, "неизвестная команда «");
    buf_put(&say, name.data);
    buf_put(&say, "»; «.помощь» — список команд");
    bads_push(&bads, repl_say("FLANG_CLI"), repl_dup(say.data, say.used), false, 0, 0);
    repl_print_bads(&bads, NULL, NULL, NULL, 0, 0);
    buf_free(&say);
    bads_free(&bads);
    ok = false;
  }
  free(argument);
  buf_free(&name);
  return ok;
}

/* ─────────────────────────────── приём ввода ────────────────────────────── */

static bool repl_trimmed_empty(const char *text) {
  size_t index = 0;
  for (index = 0; text[index] != '\0'; index += 1) {
    if (text[index] != ' ' && text[index] != '\t' && text[index] != '\n' && text[index] != '\r') {
      return false;
    }
  }
  return true;
}

/**
 * Приём одного ввода: команда, объявление или выражение. Непредвиденный сбой не
 * имеет права уронить оболочку — сессия остаётся прежней, а беда показывается
 * диагностикой.
 */
static bool repl_submit(repl_session *session, const char *input, bool *quit) {
  char *text = NULL;
  size_t indent = 0;
  fl_value tokens = fl_nothing();
  fl_value program = fl_nothing();
  repl_bads bads;
  bool lexed = false;
  bool ok = true;
  size_t line_shift = 0;
  repl_cycle();
  if (repl_trimmed_empty(input)) {
    return true;
  }
  {
    const char *scan = input;
    while (*scan == ' ' || *scan == '\t' || *scan == '\n' || *scan == '\r') {
      scan += 1;
    }
    if (*scan == '.') {
      char *own = repl_say(scan);
      size_t end = strlen(own);
      while (end > 0 && (own[end - 1] == ' ' || own[end - 1] == '\t' || own[end - 1] == '\n' ||
                         own[end - 1] == '\r')) {
        end -= 1;
        own[end] = '\0';
      }
      ok = repl_command(session, own, quit);
      free(own);
      return ok;
    }
  }
  text = repl_dedent(input, &indent);
  lexed = repl_tokens(text, strlen(text), &tokens);
  /* Ввод из одних комментариев — это ничто, а не программа без тела. Ошибку
     лексера сюда не пускаем: её обязан показать разбор. */
  if (lexed && token_first(tokens) == (size_t)-1) {
    free(text);
    return true;
  }
  if (!repl_is_declaration(lexed, tokens)) {
    ok = repl_evaluate(session, text, indent);
    free(text);
    return ok;
  }
  bads_init(&bads);
  if (!repl_parse_input(session, text, lexed, tokens, &program, &bads, &line_shift)) {
    repl_print_bads(&bads, NULL, "ввод", NULL, line_shift, indent);
    ok = false;
  } else if (repl_header_only(program)) {
    ok = repl_take_header(session, program);
  } else {
    ok = repl_take(session, program, session->base, NULL, text);
  }
  bads_free(&bads);
  free(text);
  return ok;
}

/* ─────────────────── продолжение многострочного ввода ───────────────────── */

static bool repl_finished(repl_session *session, const char *line) {
  fl_value tokens = fl_nothing();
  fl_value program = fl_nothing();
  fl_value parsed = fl_nothing();
  fl_value diagnostics = fl_nothing();
  repl_bads bads;
  const bool lexed = repl_tokens(line, strlen(line), &tokens);
  bool finished = true;
  size_t line_shift = 0;
  if (!repl_is_declaration(lexed, tokens)) {
    fl_value args[2];
    char *wrapped = repl_wrap(line, REPL_EXPR_NAME);
    args[0] = repl_value_say(wrapped);
    args[1] = repl_value_strings(&session->known);
    free(wrapped);
    if (repl_call("Разбор исходника", args, 2, &parsed) != FL_OK) {
      return false;
    }
    return !(val_field(parsed, "диагностики", &diagnostics) && diagnostics.tag == FL_LIST &&
             diagnostics.as.list.count > 0);
  }
  bads_init(&bads);
  if (!repl_parse_input(session, line, lexed, tokens, &program, &bads, &line_shift)) {
    bads_free(&bads);
    return false;
  }
  bads_free(&bads);
  {
    const size_t first = token_first(tokens);
    const char *word = NULL;
    size_t bytes = 0;
    if (first != (size_t)-1 && token_keyword(tokens.as.list.items[first], &word, &bytes) &&
        repl_in_list(REPL_BLOCKS, word, bytes)) {
      /* Псевдоним («тип «Метр» это число») — единственное блочное слово, за
         которым блока не бывает: продолжать его нечем. */
      const fl_value *types = NULL;
      size_t count = 0;
      const char *kind = NULL;
      size_t kind_bytes = 0;
      zn_field_items(program, "types", &types, &count);
      finished = count == 1 && zn_field_text(types[0], "kind", &kind, &kind_bytes) && kind_bytes == 5 &&
                 memcmp(kind, "alias", 5) == 0;
    }
  }
  return finished;
}

/**
 * Нужен ли ещё ввод.
 *
 * Правило простое и оттого предсказуемое: пустая строка заканчивает ввод всегда,
 * а всё, что заведомо не помещается в строку — заголовок объявления с блоком
 * ниже, незакрытая скобка, «если» без «иначе», — продолжается до пустой строки.
 * Автоматически завершать блок «как только он разобрался» нельзя: после тела
 * функции законно идут «пример»ы, и оболочка обрубала бы их на полуслове.
 *
 * Ошибочная строка тоже уходит в продолжение — отличить «не дописано» от
 * «написано неверно» по одной строке невозможно. Цена ошибки мала: пустая
 * строка заканчивает ввод, и диагностика приходит целиком.
 */
static bool repl_needs_more(repl_session *session, const char *text) {
  const char *scan = text;
  const char *last = NULL;
  if (repl_trimmed_empty(text)) {
    return false;
  }
  while (*scan == ' ' || *scan == '\t' || *scan == '\n' || *scan == '\r') {
    scan += 1;
  }
  if (*scan == '.') {
    return false;
  }
  last = strrchr(text, '\n');
  if (last != NULL && repl_blank(last + 1)) {
    return false;
  }
  if (last != NULL) {
    return true;
  }
  repl_cycle();
  return !repl_finished(session, text);
}

/* ──────────────────────── запуск и завершение работы ────────────────────── */

/*
 * Временный каталог убирается за собой — сессия не должна оставлять мусора, и
 * убирать его должно не «обычно», а всегда. Поэтому уборка висит на atexit:
 * выход по «.выход», по концу ввода и по нехватке памяти проходит через неё
 * одинаково.
 */
static repl_session *repl_open = NULL;

static void repl_sweep(void) {
  size_t index = 0;
  if (repl_open == NULL) {
    return;
  }
  for (index = 0; index < repl_open->litter.count; index += 1) {
    remove(repl_open->litter.items[index]);
  }
  if (repl_open->tmp_dir != NULL) {
    rmdir(repl_open->tmp_dir);
  }
  repl_open = NULL;
}

/* Ctrl-C бросает набранное, но не сессию: набранное дешевле повторить, чем
   объявленное. Обработчик ставится без SA_RESTART именно ради этого — иначе
   чтение строки продолжилось бы, будто ничего не нажимали. */
static volatile sig_atomic_t repl_interrupted = 0;

static void repl_on_interrupt(int number) {
  (void)number;
  repl_interrupted = 1;
}

typedef enum repl_read { REPL_LINE, REPL_EOF, REPL_INTERRUPT } repl_read;

static repl_read repl_read_line(repl_buf *line) {
  char chunk[4096];
  buf_reset(line);
  for (;;) {
    if (fgets(chunk, (int)sizeof(chunk), stdin) != NULL) {
      buf_put(line, chunk);
      if (line->used > 0 && line->data[line->used - 1] == '\n') {
        line->used -= 1;
        line->data[line->used] = '\0';
        if (line->used > 0 && line->data[line->used - 1] == '\r') {
          line->used -= 1;
          line->data[line->used] = '\0';
        }
        return REPL_LINE;
      }
      continue;
    }
    if (repl_interrupted) {
      repl_interrupted = 0;
      clearerr(stdin);
      return REPL_INTERRUPT;
    }
    return line->used > 0 ? REPL_LINE : REPL_EOF;
  }
}

/** Каталог под печать и сборку сессии; NULL — вычислять негде. */
static bool repl_make_tmp(repl_session *session) {
  const char *root = getenv("TMPDIR");
  repl_buf pattern;
  bool ok = false;
  buf_init(&pattern);
  buf_put(&pattern, root == NULL || root[0] == '\0' ? "/tmp" : root);
  while (pattern.used > 1 && pattern.data[pattern.used - 1] == '/') {
    pattern.used -= 1;
    pattern.data[pattern.used] = '\0';
  }
  buf_put(&pattern, "/flang-repl-XXXXXX");
  if (mkdtemp(pattern.data) != NULL) {
    session->tmp_dir = repl_dup(pattern.data, pattern.used);
    ok = true;
  }
  buf_free(&pattern);
  return ok;
}

/**
 * Чем вычислять. Ищется честно: компилятор C — в PATH, каталоги установки — от
 * самого бинарника, и всё вместе переопределяется переменными окружения
 * FLANG_CC, FLANG_INCLUDE_DIR, FLANG_LIB_DIR.
 */
static void repl_tools(repl_session *session, const char *self) {
  char *self_dir = repl_self_dir(self);
  const char *chosen = getenv("FLANG_CC");
  repl_buf why;
  buf_init(&why);
  if (chosen != NULL && chosen[0] != '\0') {
    session->cc = repl_in_path(chosen);
  } else {
    session->cc = repl_in_path("cc");
    if (session->cc == NULL) {
      session->cc = repl_in_path("gcc");
    }
    if (session->cc == NULL) {
      session->cc = repl_in_path("clang");
    }
  }
  session->include_dir = repl_find_dir("FLANG_INCLUDE_DIR", self_dir, "include", "flang_runtime.h");
  session->lib_dir = repl_find_dir("FLANG_LIB_DIR", self_dir, "lib", REPL_ARCHIVE);
  if (session->cc == NULL) {
    buf_put(&why, "компилятора C нет (ни $FLANG_CC, ни cc, ни gcc, ни clang в PATH)");
  }
  if (session->include_dir == NULL) {
    if (why.used > 0) {
      buf_put(&why, "; ");
    }
    buf_put(&why, "не найден flang_runtime.h ($FLANG_INCLUDE_DIR, ../include или каталог самого бинарника)");
  }
  if (session->lib_dir == NULL) {
    if (why.used > 0) {
      buf_put(&why, "; ");
    }
    buf_put(&why, "не найден " REPL_ARCHIVE " ($FLANG_LIB_DIR, ../lib или каталог самого бинарника)");
  }
  if (why.used == 0 && !repl_make_tmp(session)) {
    buf_put(&why, "не создан временный каталог (см. $TMPDIR)");
  }
  if (why.used > 0) {
    repl_buf say;
    buf_init(&say);
    buf_put(&say, "вычислять нечем: ");
    buf_put(&say, why.data);
    buf_put(&say, ".\nРазбор, типы и завершаемость проверяются по-прежнему; выражение отвечает «проверено».");
    session->why_no_eval = repl_dup(say.data, say.used);
    buf_free(&say);
  }
  buf_free(&why);
  free(self_dir);
}

static void repl_open_session(repl_session *session, const char *self) {
  char buffer[4096];
  session->base = getcwd(buffer, sizeof(buffer)) == NULL ? repl_say(".") : repl_say(buffer);
  session->file = repl_resolve(session->base, REPL_FILE);
  session->module = repl_say("");
  imports_init(&session->imports);
  strings_init(&session->exports);
  decls_init(&session->decls);
  strings_init(&session->known);
  strings_init(&session->total);
  strings_init(&session->litter);
  session->cc = NULL;
  session->include_dir = NULL;
  session->lib_dir = NULL;
  session->tmp_dir = NULL;
  session->why_no_eval = NULL;
  session->steps = repl_say("0");
  session->depth = repl_say("0");
  repl_tools(session, self);
}

static void repl_close_session(repl_session *session) {
  repl_sweep();
  free(session->base);
  free(session->file);
  free(session->module);
  imports_free(&session->imports);
  strings_free(&session->exports);
  decls_free(&session->decls);
  strings_free(&session->known);
  strings_free(&session->total);
  strings_free(&session->litter);
  free(session->cc);
  free(session->include_dir);
  free(session->lib_dir);
  free(session->tmp_dir);
  free(session->why_no_eval);
  free(session->steps);
  free(session->depth);
}

/*
 * Человеческий вход обращается к компилятору по именам его точек входа, и
 * печатается он в КАЖДЫЙ прогонщик — бэкенд один на все программы. Если этой
 * программой оказался не компилятор, честнее сказать это первой же строкой, чем
 * делать вид, что всё работает: «Разбор исходника» взять всё равно неоткуда.
 */
static bool repl_is_compiler(void) {
  fl_value arguments[2];
  fl_value result = fl_nothing();
  fl_error error;
  repl_cycle();
  arguments[0] = repl_value_say("");
  arguments[1] = repl_value_list(NULL, 0);
  error.code = NULL;
  error.message = NULL;
  return FL_PROGRAM_CALL(&repl_ctx, "Разбор исходника", arguments, 2, &result, &error) == FL_OK;
}

/* ═══════════════════════════ flang check <файл> ═══════════════════════════ */

/**
 * Сколько в связанной программе объявлений и сколько из них с доказанным
 * завершением. Считается по САМОЙ программе, а не по тексту файла: `использует`
 * втягивает чужие функции, и человеку полезно знать, сколько их проверено
 * вместе с его собственными.
 */
static void check_count(fl_value program, size_t *functions, size_t *types, const repl_strings *proven,
                        size_t *proved) {
  const fl_value *items = NULL;
  size_t count = 0;
  size_t index = 0;
  *proved = 0;
  zn_field_items(program, "functions", &items, &count);
  *functions = count;
  for (index = 0; index < count; index += 1) {
    const char *name = NULL;
    size_t bytes = 0;
    if (zn_field_text(items[index], "name", &name, &bytes) && strings_has(proven, name, bytes)) {
      *proved += 1;
    }
  }
  zn_field_items(program, "types", &items, &count);
  *types = count;
}

/**
 * Диагностика проверки — человеку, а не инструменту: код, место, сообщение.
 *
 * Имя файла названо ровно тогда, когда оно известно. «Беда» компилятора несёт
 * строку и столбец, но НЕ несёт файла (запись «Беда» в
 * flang/self/bootstrap/compiler.flang), поэтому при одном исходнике файл
 * очевиден, а при нескольких — нет, и назвать наугад хуже, чем не назвать:
 * человек пойдёт править не тот файл. Про это сказано один раз перед списком, а
 * не при каждом замечании.
 */
static void check_print_bads(const repl_bads *bads, const char *file, size_t sources) {
  size_t index = 0;
  if (sources > 1 && bads->count > 0) {
    fprintf(stderr,
            "место указано строкой и столбцом, но без файла: вместе с импортами проверено файлов %lu, "
            "а диагностика компилятора имени файла не несёт\n",
            (unsigned long)sources);
  }
  for (index = 0; index < bads->count; index += 1) {
    const repl_bad *bad = &bads->items[index];
    if (!bad->has_at) {
      repl_print_bad(bad->code, bad->message, NULL, NULL, 0, 0);
    } else if (sources == 1) {
      repl_print_bad(bad->code, bad->message, "проверка", file, bad->line, bad->column);
    } else {
      repl_print_bad(bad->code, bad->message, "ввод", NULL, bad->line, bad->column);
    }
  }
}

/**
 * `flang check <файл>` — то, ради чего язык ставят: сказать до запуска, что
 * программа разбирается, сходится по типам и завершается.
 *
 * Дорога та же, что у оболочки (`repl_check_sources`), и тот же порядок бед,
 * что у точки входа «Проверить исходники». Отличается только подача: человеку —
 * строками, а не JSON. JSON остаётся у прогонщика, и кто хочет разбирать вывод
 * машиной, зовёт «Проверить исходники» через трубу, как раньше.
 *
 * Код возврата: 0 — замечаний нет, 1 — есть, 2 — файла нет или он не назван.
 * Разделение то же, что у CLI на Node: ошибка вызова и ошибка программы — не
 * одно и то же, и сценарий вправе их различать.
 */
static int check_file(const char *path) {
  repl_bads bads;
  repl_strings paths;
  repl_strings texts;
  repl_strings queue;
  repl_strings proven;
  fl_value program = fl_nothing();
  char buffer[4096];
  char *base = NULL;
  char *full = NULL;
  char *text = NULL;
  size_t bytes = 0;
  size_t functions = 0;
  size_t types = 0;
  size_t proved = 0;
  bool has_program = false;
  bool ok = false;

  base = getcwd(buffer, sizeof(buffer)) == NULL ? repl_say(".") : repl_say(buffer);
  full = repl_resolve(base, path);
  text = repl_read_file(full, &bytes);
  free(base);
  if (text == NULL) {
    /* Код тот же, каким CLI помечает неверный вызов: файла нет — это ошибка
       вызова, а не приговор программе, и путать их нельзя. */
    fprintf(stderr, "FLANG_CLI: не прочитан файл %s\n", path);
    free(full);
    return 2;
  }

  repl_cycle();
  strings_init(&paths);
  strings_init(&texts);
  strings_init(&queue);
  strings_init(&proven);
  bads_init(&bads);
  strings_say(&paths, full);
  strings_add(&texts, text, bytes);
  repl_imports_of(text, bytes, full, &queue);
  ok = repl_check_sources(repl_closure(&paths, &texts, &queue), full, &bads, &program, &has_program, &proven, true);

  if (has_program) {
    check_count(program, &functions, &types, &proven, &proved);
  }
  /* Считать нечего, когда разбор не дошёл до объявлений; «функций 0» в этом
     случае — не итог проверки, а утверждение о файле, которого никто не делал. */
  if (has_program && (functions > 0 || types > 0)) {
    const char *name = NULL;
    size_t name_bytes = 0;
    /* Программа приезжает узлом («Значение»), а не записью C, поэтому поля у
       неё достаются `zn_*`, как и у всего остального разобранного. */
    if (zn_field_text(program, "module", &name, &name_bytes) && name_bytes > 0) {
      printf("модуль «%.*s»", (int)name_bytes, name);
    } else {
      printf("без имени модуля");
    }
    printf(": функций %lu, из них с доказанным завершением %lu; типов %lu",
           (unsigned long)functions, (unsigned long)proved, (unsigned long)types);
    if (paths.count > 1) {
      printf("; файлов вместе с импортами %lu", (unsigned long)paths.count);
    }
    printf("\n");
  }
  /* Потоки разные — stdout под ответ, stderr под диагностику, — и порядок между
     ними держится только сбросом: под конвейером stdout копится блоками, и без
     этой строки замечания приезжали бы раньше того, к чему относятся. */
  fflush(stdout);
  check_print_bads(&bads, path, paths.count);
  fflush(stderr);
  if (ok) {
    printf("%s: проверено — разбор, типы, завершаемость, ядро и примеры; замечаний нет\n", path);
  } else {
    printf("%s: не проверено — замечаний %lu\n", path, (unsigned long)bads.count);
  }
  fflush(stdout);

  bads_free(&bads);
  strings_free(&paths);
  strings_free(&texts);
  strings_free(&queue);
  strings_free(&proven);
  free(text);
  free(full);
  return ok ? 0 : 1;
}

/* ═══════════════════ flang check --proof: ведомость ══════════════════════ */

/**
 * `flang check <файл> --proof [--json]` — ведомость доказательства, без Node.
 *
 * Считает её слой на самом flang («Ведомость исходников» в
 * `flang/self/bootstrap/compiler.flang`), а здесь — ровно печать: ни одного
 * числа этот файл не выводит сам. Иначе чисел стало бы два набора, и спорили бы
 * о них не люди, а две реализации.
 *
 * ── ТРИ ИСХОДА, И ТРЕТИЙ — ГЛАВНЫЙ ──────────────────────────────────────────
 * 0 — ведомость напечатана; 1 — программа не прошла проверку (ведомости у неё
 * нет: «доказано» о программе с отказом было бы неправдой про каждую строку);
 * 2 — ПРЕПЯТСТВИЕ: в программе объявлено то, чьи законы бинарник не считает.
 * Третий исход и есть отличие честной ведомости от зелёной: молча напечатать
 * пустой раздел «законов не объявлено» на программе, где закон объявлен, —
 * ровно та неправда, ради которой ведомость заводилась.
 *
 * Сверено со свидетелем на 37 программах `flang/proof/examples`: 33 совпали знак в
 * знак, 4 разошлись, и все четыре — в сторону «бинарник сказал МЕНЬШЕ» (поиска
 * нарушений по примерам в замыкании нет, и ведомость честно говорит «не
 * искали», а не «не найдено»).
 */
static int proof_file(const char *path, bool json) {
  repl_strings paths;
  repl_strings texts;
  repl_strings queue;
  fl_value result = fl_nothing();
  fl_value args[2];
  fl_value field = fl_nothing();
  char buffer[4096];
  char *base = NULL;
  char *full = NULL;
  char *text = NULL;
  const char *utf8 = NULL;
  size_t bytes = 0;
  size_t index = 0;
  int code = 0;

  base = getcwd(buffer, sizeof(buffer)) == NULL ? repl_say(".") : repl_say(buffer);
  full = repl_resolve(base, path);
  text = repl_read_file(full, &bytes);
  free(base);
  if (text == NULL) {
    fprintf(stderr, "FLANG_CLI: не прочитан файл %s\n", path);
    free(full);
    return 2;
  }

  repl_cycle();
  strings_init(&paths);
  strings_init(&texts);
  strings_init(&queue);
  strings_say(&paths, full);
  strings_add(&texts, text, bytes);
  repl_imports_of(text, bytes, full, &queue);
  args[0] = repl_closure(&paths, &texts, &queue);
  args[1] = repl_value_say(full);

  if (repl_call("Ведомость исходников", args, 2, &result) != FL_OK) {
    code = 1;
  } else if (val_field(result, "годно", &field) && field.tag == FL_FLAG && field.as.flag) {
    if (val_field(result, json ? "в JSON" : "словами", &field) && val_text(field, &utf8, &bytes)) {
      fwrite(utf8, 1, bytes, stdout);
      if (json) {
        fputc('\n', stdout);
      }
    }
    fflush(stdout);
  } else if (val_field(result, "препятствие", &field) && val_text(field, &utf8, &bytes) && bytes > 0) {
    fprintf(stderr, "%.*s\n", (int)bytes, utf8);
    code = 2;
  } else {
    fl_value list = fl_nothing();
    if (val_field(result, "диагностики", &list) && list.tag == FL_LIST) {
      for (index = 0; index < list.as.list.count; index += 1) {
        repl_bads bads;
        bads_init(&bads);
        bads_take(&bads, list.as.list.items[index]);
        check_print_bads(&bads, path, paths.count);
        bads_free(&bads);
      }
    }
    fflush(stderr);
    printf("%s: не проверено — ведомость не печатается у программы с замечаниями\n", path);
    fflush(stdout);
    code = 1;
  }

  strings_free(&paths);
  strings_free(&texts);
  strings_free(&queue);
  free(text);
  free(full);
  return code;
}

/* ══════════════════════════════ flang test ══════════════════════════════ */

/**
 * `flang test <файл> [--no-check]` — прогон примеров, объявленных внутри функций.
 *
 * Порядок тот же, что у свидетеля: сначала те же проверки, что у `check`, и на
 * непроверенной программе примеров не запускать. «Пример сошёлся» на программе с
 * ошибкой типов не значит ничего — сойтись он мог на пути, который до кривого
 * места не дошёл. `--no-check` снимает проверку ровно затем же, зачем у свидетеля:
 * смотреть на поведение примеров, пока программа ещё в правке.
 *
 * Печатается КАЖДЫЙ не прошедший пример, а прошедшие — числом: отчёт, в котором
 * тысяча зелёных строк прячет одну красную, читается как зелёный.
 */
static int test_file(int argc, char **argv) {
  repl_strings paths;
  repl_strings texts;
  repl_strings queue;
  fl_value result = fl_nothing();
  fl_value args[5];
  fl_value field = fl_nothing();
  fl_value rows = fl_nothing();
  char buffer[4096];
  const char *path = NULL;
  const char *steps = "40000000";
  const char *depth = "20000";
  char *base = NULL;
  char *full = NULL;
  char *text = NULL;
  size_t bytes = 0;
  size_t index = 0;
  bool check = true;
  int argi = 0;
  int code = 0;

  for (argi = 2; argi < argc; argi += 1) {
    if (strcmp(argv[argi], "--no-check") == 0) {
      check = false;
    } else if (strcmp(argv[argi], "--max-steps") == 0 && argi + 1 < argc) {
      argi += 1;
      steps = argv[argi];
    } else if (strcmp(argv[argi], "--max-depth") == 0 && argi + 1 < argc) {
      argi += 1;
      depth = argv[argi];
    } else if (argv[argi][0] != '-' && path == NULL) {
      path = argv[argi];
    } else {
      fprintf(stderr, "flang test: непонятный ключ «%s»\n", argv[argi]);
      return 2;
    }
  }
  if (path == NULL) {
    fputs("flang test: не назван файл. Пример: flang test модуль.flang\n", stderr);
    return 2;
  }

  base = getcwd(buffer, sizeof(buffer)) == NULL ? repl_say(".") : repl_say(buffer);
  full = repl_resolve(base, path);
  text = repl_read_file(full, &bytes);
  free(base);
  if (text == NULL) {
    fprintf(stderr, "FLANG_CLI: не прочитан файл %s\n", path);
    free(full);
    return 2;
  }

  repl_cycle();
  strings_init(&paths);
  strings_init(&texts);
  strings_init(&queue);
  strings_say(&paths, full);
  strings_add(&texts, text, bytes);
  repl_imports_of(text, bytes, full, &queue);
  args[0] = repl_closure(&paths, &texts, &queue);
  args[1] = repl_value_say(full);
  args[2] = fl_flag(check);
  args[3] = fl_number(strtod(steps, NULL));
  args[4] = fl_number(strtod(depth, NULL));

  if (repl_call("Прогон примеров исходников", args, 5, &result) != FL_OK) {
    code = 1;
  } else {
    double total = 0;
    double passed = 0;
    double failed = 0;
    if (val_field(result, "всего", &field) && field.tag == FL_NUMBER) {
      total = field.as.number;
    }
    if (val_field(result, "прошло", &field) && field.tag == FL_NUMBER) {
      passed = field.as.number;
    }
    if (val_field(result, "сорвалось", &field) && field.tag == FL_NUMBER) {
      failed = field.as.number;
    }
    if (val_field(result, "диагностики", &rows) && rows.tag == FL_LIST && rows.as.list.count > 0) {
      repl_bads bads;
      bads_init(&bads);
      for (index = 0; index < rows.as.list.count; index += 1) {
        bads_take(&bads, rows.as.list.items[index]);
      }
      check_print_bads(&bads, path, paths.count);
      bads_free(&bads);
      fflush(stderr);
      printf("%s: примеры не запускались — программа не прошла проверку\n", path);
      fflush(stdout);
      code = 1;
    } else {
      if (val_field(result, "строки", &rows) && rows.tag == FL_LIST) {
        for (index = 0; index < rows.as.list.count; index += 1) {
          fl_value row = rows.as.list.items[index];
          const char *fn = NULL;
          size_t fn_bytes = 0;
          const char *example = NULL;
          size_t example_bytes = 0;
          const char *word = NULL;
          size_t word_bytes = 0;
          const char *say = NULL;
          size_t say_bytes = 0;
          if (val_field(row, "прошёл", &field) && field.tag == FL_FLAG && field.as.flag) {
            continue;
          }
          if (val_field(row, "функция", &field)) {
            val_text(field, &fn, &fn_bytes);
          }
          if (val_field(row, "пример", &field)) {
            val_text(field, &example, &example_bytes);
          }
          if (val_field(row, "код", &field)) {
            val_text(field, &word, &word_bytes);
          }
          if (val_field(row, "сообщение", &field)) {
            val_text(field, &say, &say_bytes);
          }
          /* Кода у не сошедшегося примера НЕТ, и выдумывать его нельзя: «не
             совпало» — это результат прогона, а не отказ языка, и новый код ради
             отчёта был бы кодом, которого не объявлял никто. Код стоит только
             там, где вычисление сорвалось и язык его назвал сам. */
          if (word_bytes > 0) {
            fprintf(stderr, "%.*s: ", (int)word_bytes, word);
          }
          fprintf(stderr, "пример «%.*s» функции «%.*s» не прошёл: %.*s\n", (int)example_bytes,
                  example == NULL ? "" : example, (int)fn_bytes, fn == NULL ? "" : fn, (int)say_bytes,
                  say == NULL ? "" : say);
        }
      }
      fflush(stderr);
      printf("%s: примеров %lu, прошло %lu, не прошло %lu\n", path, (unsigned long)total, (unsigned long)passed,
             (unsigned long)failed);
      fflush(stdout);
      code = failed > 0 ? 1 : 0;
    }
  }

  strings_free(&paths);
  strings_free(&texts);
  strings_free(&queue);
  free(text);
  free(full);
  return code;
}

/* ══════════════════════════════ flang run ═══════════════════════════════ */

/*
 * `flang run <файл> --function «Имя» [--args JSON]` — вычислить названную
 * функцию и напечатать её значение.
 *
 * Появилось это только теперь и ровно потому, что раньше было НЕЧЕМ: вычислителя
 * в бинарнике не было. Теперь `flang/self/interpret.flang` втащен в замыкание
 * компилятора, и точка входа «Прогон исходников» считает без всякого Node.
 *
 * ── Долг, который здесь стоял и теперь закрыт ───────────────────────────────
 * Свидетель на JavaScript (`commandRun` в `flang/bin/flang.mjs`) перед вычислением
 * сверяет аргументы с объявленными типами (`checkArguments`), и делает это не
 * для красоты: доказательство завершения `тотальной` функции стоит НА ТИПЕ, и
 * значение вне типа выносит вместе с типом и доказательство. Этой сверки здесь
 * не было, и `flang run` в бинарнике ПРИНИМАЛ `«Факториал» от −3`, печатая `1`
 * там, где свидетель отказывает `FLANG_TYPE` и кодом 1. Закрыто на стороне flang:
 * «Прогон исходников» зовёт «Проверить аргументы вызова» (`self/types.flang`)
 * ДО вычисления, и оба инструмента отвечают одним кодом и одним текстом.
 *
 * ── Почему свой разбор JSON, а не разбор компилятора ────────────────────────
 * Компилятор умеет JSON ПЕЧАТАТЬ («Печать значения»), а читать — нет: читает
 * прогонщик, и его разборщик (`flang_cli.c`) говорит на своём языке тегов
 * («{"n":…}», «{"s":…}»), заведённом для передачи готовых значений рантайма, а
 * не для человека. Человеку `--args '{"н":10}'` писать удобнее, поэтому здесь
 * лежит маленький разбор ровно этого: плоский объект скаляров. Вложенности нет
 * намеренно — она понадобится, когда понадобится, а не «на всякий случай».
 */

/** Вариант с одним полем: «Значение записи» и «Значение списка» строятся так. */
static fl_value repl_value_variant_fields(const char *variant, const char *field, fl_value held) {
  fl_value out = fl_nothing();
  fl_error error;
  const char *names[1];
  fl_value values[1];
  error.code = NULL;
  error.message = NULL;
  names[0] = field;
  values[0] = held;
  if (fl_variant_new(&repl_ctx, variant, names, values, 1, &out, &error) != FL_OK) {
    repl_oom();
  }
  return out;
}

/*
 * Строка в JSON: кавычки, обратная косая и управляющие — экранируются.
 * Свой код здесь потому, что «Экранировать» компилятора работает над его
 * собственными значениями, а тут на руках голый UTF-8 из рантайма.
 */
static void run_print_text(const char *text, size_t bytes) {
  size_t index = 0;
  fputc('"', stdout);
  for (index = 0; index < bytes; index += 1) {
    const unsigned char symbol = (unsigned char)text[index];
    if (symbol == '"' || symbol == '\\') {
      fputc('\\', stdout);
      fputc((int)symbol, stdout);
    } else if (symbol == '\n') {
      fputs("\\n", stdout);
    } else if (symbol == '\t') {
      fputs("\\t", stdout);
    } else if (symbol == '\r') {
      fputs("\\r", stdout);
    } else if (symbol < 0x20) {
      printf("\\u%04x", (unsigned int)symbol);
    } else {
      fputc((int)symbol, stdout);
    }
  }
  fputc('"', stdout);
}

/** «Скаляр» из `core/json.flang`, обёрнутый в «Значение скаляра». */
static fl_value run_scalar(const char *variant, const char *field, fl_value inner) {
  fl_value out = fl_nothing();
  fl_value scalar = fl_nothing();
  fl_error error;
  const char *names[1];
  fl_value values[1];
  error.code = NULL;
  error.message = NULL;
  names[0] = field;
  values[0] = inner;
  if (fl_variant_new(&repl_ctx, variant, names, values, 1, &scalar, &error) != FL_OK) {
    repl_oom();
  }
  names[0] = "скаляр";
  values[0] = scalar;
  if (fl_variant_new(&repl_ctx, "Значение скаляра", names, values, 1, &out, &error) != FL_OK) {
    repl_oom();
  }
  return out;
}

/** Пропуск пробелов; общий на весь разбор `--args`. */
static void run_spaces(const char *text, size_t *at) {
  while (text[*at] == ' ' || text[*at] == '\t' || text[*at] == '\n' || text[*at] == '\r') {
    *at += 1;
  }
}

/*
 * Строка JSON в память арены. Escape-последовательности разбираются те, что
 * есть в самом JSON; `\uXXXX` намеренно НЕ разбирается, и это не лень: ключи и
 * значения приезжают из командной строки, где UTF-8 уже написан буквами, а
 * половинчатая поддержка суррогатных пар хуже честного отказа.
 */
static bool run_text(const char *text, size_t *at, char **out, size_t *bytes) {
  size_t start = 0;
  size_t used = 0;
  char *buffer = NULL;
  run_spaces(text, at);
  if (text[*at] != '"') {
    return false;
  }
  *at += 1;
  start = *at;
  while (text[*at] != '\0' && text[*at] != '"') {
    *at += text[*at] == '\\' && text[*at + 1] != '\0' ? 2 : 1;
  }
  if (text[*at] != '"') {
    return false;
  }
  buffer = (char *)malloc(*at - start + 1);
  if (buffer == NULL) {
    repl_oom();
  }
  {
    size_t index = start;
    while (index < *at) {
      if (text[index] == '\\' && index + 1 < *at) {
        const char next = text[index + 1];
        index += 2;
        if (next == 'n') {
          buffer[used] = '\n';
        } else if (next == 't') {
          buffer[used] = '\t';
        } else if (next == 'r') {
          buffer[used] = '\r';
        } else if (next == 'u') {
          free(buffer);
          return false;
        } else {
          buffer[used] = next;
        }
        used += 1;
        continue;
      }
      buffer[used] = text[index];
      used += 1;
      index += 1;
    }
  }
  buffer[used] = '\0';
  *at += 1;
  *out = buffer;
  *bytes = used;
  return true;
}

/** Один скаляр JSON в «Значение». Объектов и списков здесь нет — см. шапку. */
static bool run_value(const char *text, size_t *at, fl_value *out) {
  run_spaces(text, at);
  if (strncmp(text + *at, "true", 4) == 0) {
    *at += 4;
    *out = run_scalar("Скаляр признак", "значение", fl_flag(true));
    return true;
  }
  if (strncmp(text + *at, "false", 5) == 0) {
    *at += 5;
    *out = run_scalar("Скаляр признак", "значение", fl_flag(false));
    return true;
  }
  if (strncmp(text + *at, "null", 4) == 0) {
    *at += 4;
    {
      fl_value nothing = fl_nothing();
      fl_error error;
      error.code = NULL;
      error.message = NULL;
      if (fl_variant_new(&repl_ctx, "Скаляр ничто", NULL, NULL, 0, &nothing, &error) != FL_OK) {
        repl_oom();
      }
      {
        const char *names[1];
        fl_value values[1];
        names[0] = "скаляр";
        values[0] = nothing;
        if (fl_variant_new(&repl_ctx, "Значение скаляра", names, values, 1, out, &error) != FL_OK) {
          repl_oom();
        }
      }
    }
    return true;
  }
  if (text[*at] == '"') {
    char *word = NULL;
    size_t bytes = 0;
    if (!run_text(text, at, &word, &bytes)) {
      return false;
    }
    *out = run_scalar("Скаляр строка", "значение", repl_value_text(word, bytes));
    free(word);
    return true;
  }
  {
    char *end = NULL;
    const double number = strtod(text + *at, &end);
    if (end == text + *at) {
      return false;
    }
    *at = (size_t)(end - text);
    *out = run_scalar("Скаляр число", "значение", fl_number(number));
    return true;
  }
}

/**
 * `--args` в «Значение записи». Пустая строка и отсутствие ключа дают пустую
 * запись — функция без параметров зовётся без `--args`, и требовать `{}` от
 * человека было бы обрядом.
 */
static bool run_args(const char *text, fl_value *out) {
  size_t at = 0;
  size_t count = 0;
  size_t capacity = 8;
  fl_value *fields = (fl_value *)malloc(capacity * sizeof(fl_value));
  bool ok = true;
  if (fields == NULL) {
    repl_oom();
  }
  if (text == NULL) {
    free(fields);
    *out = repl_value_variant_fields("Значение записи", "поля", repl_value_list(NULL, 0));
    return true;
  }
  run_spaces(text, &at);
  if (text[at] != '{') {
    free(fields);
    return false;
  }
  at += 1;
  run_spaces(text, &at);
  if (text[at] != '}') {
    for (;;) {
      char *key = NULL;
      size_t bytes = 0;
      fl_value value = fl_nothing();
      if (!run_text(text, &at, &key, &bytes)) {
        ok = false;
        break;
      }
      run_spaces(text, &at);
      if (text[at] != ':') {
        free(key);
        ok = false;
        break;
      }
      at += 1;
      if (!run_value(text, &at, &value)) {
        free(key);
        ok = false;
        break;
      }
      if (count == capacity) {
        fl_value *bigger = (fl_value *)realloc(fields, capacity * 2 * sizeof(fl_value));
        if (bigger == NULL) {
          free(key);
          repl_oom();
        }
        fields = bigger;
        capacity *= 2;
      }
      {
        const char *names[2];
        fl_value values[2];
        names[0] = "ключ";
        values[0] = repl_value_text(key, bytes);
        names[1] = "значение";
        values[1] = value;
        fields[count] = repl_value_record(names, values, 2);
        count += 1;
      }
      free(key);
      run_spaces(text, &at);
      if (text[at] == ',') {
        at += 1;
        continue;
      }
      break;
    }
  }
  if (ok) {
    run_spaces(text, &at);
    ok = text[at] == '}';
  }
  if (ok) {
    *out = repl_value_variant_fields("Значение записи", "поля", repl_value_list(fields, count));
  }
  free(fields);
  return ok;
}

/**
 * «Знач» человеку — тем же JSON, каким его печатает свидетель.
 *
 * Печатается РЕКУРСИВНО и по значению, а не через «Описать знач»: та даёт
 * описание («список длиной 3»), годное для диагностики и негодное для того, кто
 * читает ответ программы.
 */
static void run_print(fl_value value) {
  fl_value inner = fl_nothing();
  const char *text = NULL;
  size_t bytes = 0;
  if (val_is(value, "Знач ничто")) {
    fputs("null", stdout);
    return;
  }
  if (val_is(value, "Знач число") && val_field(value, "число", &inner) && inner.tag == FL_NUMBER) {
    char buffer[64];
    const size_t used = fl_number_text(inner.as.number, buffer);
    printf("%.*s", (int)used, buffer);
    return;
  }
  if (val_is(value, "Знач признак") && val_field(value, "признак", &inner)) {
    fputs(inner.as.flag ? "true" : "false", stdout);
    return;
  }
  if (val_is(value, "Знач строка") && val_field(value, "текст", &inner) && val_text(inner, &text, &bytes)) {
    run_print_text(text, bytes);
    return;
  }
  if (val_is(value, "Знач список") && val_field(value, "элементы", &inner) && inner.tag == FL_LIST) {
    size_t index = 0;
    fputc('[', stdout);
    for (index = 0; index < inner.as.list.count; index += 1) {
      if (index > 0) {
        fputc(',', stdout);
      }
      run_print(inner.as.list.items[index]);
    }
    fputc(']', stdout);
    return;
  }
  if ((val_is(value, "Знач запись") || val_is(value, "Знач вариант")) && val_field(value, "поля", &inner) &&
      inner.tag == FL_LIST) {
    size_t index = 0;
    fputc('{', stdout);
    /* Имя варианта печатается полем, как это делает свидетель: запись и вариант с
       теми же полями обязаны быть различимы в ответе, иначе прочитавший его
       не отличит одно от другого. */
    if (val_is(value, "Знач вариант")) {
      fl_value named = fl_nothing();
      if (val_field(value, "имя", &named) && val_text(named, &text, &bytes)) {
        fputs("\"вариант\":", stdout);
        run_print_text(text, bytes);
        if (inner.as.list.count > 0) {
          fputc(',', stdout);
        }
      }
    }
    for (index = 0; index < inner.as.list.count; index += 1) {
      fl_value key = fl_nothing();
      fl_value held = fl_nothing();
      if (index > 0) {
        fputc(',', stdout);
      }
      if (val_field(inner.as.list.items[index], "ключ", &key) && val_text(key, &text, &bytes)) {
        run_print_text(text, bytes);
      }
      fputc(':', stdout);
      if (val_field(inner.as.list.items[index], "значение", &held)) {
        run_print(held);
      }
    }
    fputc('}', stdout);
    return;
  }
  fputs("null", stdout);
}

/**
 * `flang run` целиком. Код возврата тот же, что у `check`: 0 — посчиталось,
 * 1 — программа отказала, 2 — ошибка вызова. Разделение не косметика: сценарий
 * вправе отличать «программа сказала нет» от «я позвал неправильно».
 */
/**
 * Ёлочки с имени функции, если человек их написал.
 *
 * Справка показывает `--function «Имя»`, и показывает не по недосмотру: имена
 * функций в языке ПИШУТСЯ в ёлочках, и человек копирует их из исходника вместе
 * с ними. А ключ ёлочек не принимал и отвечал `не найдена функция ««Имя»»` —
 * то есть отвергал ровно ту форму, которой сам же учил.
 *
 * Свидетель на Node — `снятьЁлочки` в `flang/bin/flang.mjs`, и правились они
 * одним движением: почини одну сторону — и бинарник начал бы принимать то, что
 * свидетель отвергает.
 *
 * «» в UTF-8 — это C2 AB и C2 BB; снимается ровно одна внешняя пара.
 */
static const char *run_bare_name(const char *name, size_t *bytes) {
  const size_t length = strlen(name);
  *bytes = length;
  if (length >= 4 && (unsigned char)name[0] == 0xC2u && (unsigned char)name[1] == 0xABu &&
      (unsigned char)name[length - 2] == 0xC2u && (unsigned char)name[length - 1] == 0xBBu) {
    *bytes = length - 4;
    return name + 2;
  }
  return name;
}

static int run_file(int argc, char **argv) {
  repl_strings paths;
  repl_strings texts;
  repl_strings queue;
  fl_value sources = fl_nothing();
  fl_value result = fl_nothing();
  fl_value args[6];
  fl_value bound = fl_nothing();
  fl_value field = fl_nothing();
  char buffer[4096];
  const char *path = NULL;
  const char *name = NULL;
  const char *given = NULL;
  const char *steps = "40000000";
  const char *depth = "20000";
  char *base = NULL;
  char *full = NULL;
  char *text = NULL;
  size_t bytes = 0;
  int index = 0;
  int code = 0;

  for (index = 2; index < argc; index += 1) {
    if (strcmp(argv[index], "--function") == 0 && index + 1 < argc) {
      index += 1;
      name = argv[index];
    } else if (strcmp(argv[index], "--args") == 0 && index + 1 < argc) {
      index += 1;
      given = argv[index];
    } else if (strcmp(argv[index], "--max-steps") == 0 && index + 1 < argc) {
      index += 1;
      steps = argv[index];
    } else if (strcmp(argv[index], "--max-depth") == 0 && index + 1 < argc) {
      index += 1;
      depth = argv[index];
    } else if (argv[index][0] != '-' && path == NULL) {
      path = argv[index];
    } else {
      fprintf(stderr, "flang run: непонятный ключ «%s»\n", argv[index]);
      return 2;
    }
  }
  if (path == NULL) {
    fputs("flang run: не назван файл. Пример: flang run м.flang --function «Ф» --args '{\"н\":10}'\n", stderr);
    return 2;
  }
  if (name == NULL) {
    fputs("flang run требует «--function «Имя»»: какую из функций считать, программа сама не решает\n", stderr);
    return 2;
  }

  base = getcwd(buffer, sizeof(buffer)) == NULL ? repl_say(".") : repl_say(buffer);
  full = repl_resolve(base, path);
  text = repl_read_file(full, &bytes);
  free(base);
  if (text == NULL) {
    fprintf(stderr, "FLANG_CLI: не прочитан файл %s\n", path);
    free(full);
    return 2;
  }

  repl_cycle();
  strings_init(&paths);
  strings_init(&texts);
  strings_init(&queue);
  strings_say(&paths, full);
  strings_add(&texts, text, bytes);
  repl_imports_of(text, bytes, full, &queue);
  sources = repl_closure(&paths, &texts, &queue);

  if (!run_args(given, &bound)) {
    fprintf(stderr, "flang run: «--args» разобрать не удалось — ждался плоский объект скаляров, вроде '{\"н\":10}'\n");
    code = 2;
  } else {
    args[0] = sources;
    args[1] = repl_value_say(full);
    {
      size_t name_bytes = 0;
      const char *bare = run_bare_name(name, &name_bytes);
      args[2] = repl_value_text(bare, name_bytes);
    }
    args[3] = bound;
    args[4] = fl_number(strtod(steps, NULL));
    args[5] = fl_number(strtod(depth, NULL));
    if (repl_call("Прогон исходников", args, 6, &result) != FL_OK) {
      code = 1;
    } else if (val_field(result, "удалось", &field) && field.tag == FL_FLAG && field.as.flag) {
      if (val_field(result, "значение", &field)) {
        run_print(field);
        fputc('\n', stdout);
      }
      fflush(stdout);
    } else {
      const char *word = NULL;
      size_t word_bytes = 0;
      const char *say = NULL;
      size_t say_bytes = 0;
      fl_value held = fl_nothing();
      if (val_field(result, "код", &held)) {
        val_text(held, &word, &word_bytes);
      }
      if (val_field(result, "сообщение", &held)) {
        val_text(held, &say, &say_bytes);
      }
      fprintf(stderr, "%.*s: %.*s\n", (int)word_bytes, word == NULL ? "" : word, (int)say_bytes,
              say == NULL ? "" : say);
      code = 1;
    }
  }

  strings_free(&paths);
  strings_free(&texts);
  strings_free(&queue);
  free(text);
  free(full);
  return code;
}

/* ═══════════════════════ flang emit <файл> --target c ═════════════════════ */

/*
 * Печать программы в C — та самая, которой печатается САМ этот бинарник.
 *
 * Зачем она здесь. Пока `emit` жил только в свидетеле на JavaScript, компилятор
 * пересобирался из исходников РОВНО ОДНИМ способом: `node
 * scripts/bootstrap-c.mjs`. То есть Node лежал на пути сборки языка, и удалить
 * его значило остаться без способа восстановить компилятор из исходников `flang/self`.
 * Эта команда снимает ровно это: печать в C уже втащена в замыкание
 * (`flang/self/emit-c.flang` едет в `compiler.flang`), и не хватало только
 * разбора аргументов и подачи настроек.
 *
 * ── Три вещи, которые печать просит СНАРУЖИ ─────────────────────────────────
 *
 * 1. ТЕКСТ РАНТАЙМА — `flang_runtime.[ch]`, `flang_cli.c`, `flang_repl.c`. Это
 *    исходники на C, а не печать: они приезжают в вывод дословно, с приписанной
 *    сверху шапкой. Свидетель читает их с диска (`flang/src/emit/c.mjs`), и здесь
 *    читаются они же и оттуда же — иначе байты разошлись бы.
 *
 * 2. ГРАНИЦА ВХОДА — объявленные типы параметров таблицей. Её строит слой типов
 *    свидетеля (`таблицаВхода`), которого на flang нет вовсе. Один случай, когда
 *    таблица у бинарника уже есть, — печать САМОГО СЕБЯ: тогда годится его
 *    собственная, впечатанная (`FL_PROGRAM_ENTRY`). Годность не предполагается,
 *    а проверяется парами «функция, параметр» (`emit_entry_fits`); не сошлось —
 *    таблица пуста, и об этом сказано числом.
 *
 * 3. ПРЕДЕЛЫ — `--max-steps` и `--max-depth`: они впечатываются в
 *    `#define FL_MAX_STEPS`, то есть в байт вывода. Умолчания здесь — умолчания
 *    БЭКЕНДА (10⁶ и 10⁴); компилятор печатается с 40 000 000 и 20 000, и эти
 *    числа называет тот, кто печатает, а не этот файл.
 *
 * ── Чего эта команда НЕ делает, и это названо, а не умолчано ────────────────
 *
 * • Не отбрасывает недостижимое. `flang emit` на Node зовёт `dropUnreachable`,
 *   а `scripts/bootstrap-c.mjs` — нет, и обоснование записано там же: у
 *   компилятора, печатаемого с оболочкой, точек входа больше, чем его
 *   собственных функций. Здесь дорога одна — как у скрипта, — и на программе с
 *   импортами вывод будет БОЛЬШЕ, чем у `flang emit --target c` на Node.
 * • Не проверяет типы и завершаемость перед печатью: `flang check` — отдельная
 *   команда, и она в этом же бинарнике. Беды СВЯЗЫВАНИЯ печать отменяют: без
 *   связанной программы печатать нечего.
 *
 * ── Что померено прогоном, а не обещано ────────────────────────────────────
 * Под `env -i PATH=/usr/bin:/bin`, то есть там, где Node недостижим:
 *   1. flang₁ (этот бинарник) печатает компилятор — семь файлов; ШЕСТЬ из них
 *      совпадают с печатью `scripts/bootstrap-c.mjs` ПОБАЙТОВО, расходится
 *      один (kompilyator_flang.c) и по одной названной причине — `markProven`.
 *   2. Напечатанное собирается `cc -std=c99 -Wall -Wextra -Werror -pedantic`
 *      без единого предупреждения и даёт рабочий flang₂: `check` на пробном
 *      файле отвечает тем же, что flang₁.
 *   3. flang₂ печатает компилятор снова — и все СЕМЬ файлов совпадают с
 *      печатью flang₁ побайтово. То есть у печати самого бинарника есть своя
 *      неподвижная точка, и восстановить компилятор из исходников `flang/self`
 *      можно сколько угодно раз, ни разу не позвав Node.
 * • Цель одна — `c`. Остальные семь написаны на flang (`flang/self/emit-*.flang`)
 *   и сверены со свидетелем побайтово, но в замыкание не втащены. МЕШАЕТ ИМ ОДНО И
 *   ТО ЖЕ — СТОЛКНОВЕНИЯ ИМЁН: связывание сливает объявления в одно плоское
 *   пространство, а эталоны печати — братья одного строения и зовут свои части
 *   одинаково. Померено по замыканию компилятора (18 файлов, 3978 объявленных
 *   имён), числом новых объявлений цели и числом столкнувшихся:
 *
 *     go       189 →   2   («Слить просьбы», «Только цифры»)
 *     rust     223 →   4   («Без ведущих пробелов», «Ключи полей»,
 *                           «Обрезка слева», «Только цифры»)
 *     java     364 →   7   («Есть имя», «Есть узел», «Может быть имя»,
 *                           «Может быть узел», «Нет имени», «Нет узла»,
 *                           «Пара имён»)
 *     js       336 → 139
 *     elixir   422 → 261
 *     python   377 → 299
 *     csharp   382 → 309
 *
 *   Разрыв между go/rust и остальными — не случайность: `emit-go.flang` и
 *   `emit-rust.flang` называют свои части с именем цели («Модуль Go», «Змейка
 *   Rust»), а js, python, csharp и elixir зовут их так же, как `emit-c.flang`
 *   («Печать функции», «Печать вызова», «Общее», «Настройки»), и потому
 *   сталкиваются с уже втащенным сплошь. Для сравнения: вычислителю стоило
 *   трёх столкновений из 298, ядру доказательства — 36.
 */

/** Файлы рантайма, которые печать просит текстом. Порядок — как в настройках. */
#define EMIT_RUNTIME_HEADER "flang_runtime.h"
#define EMIT_RUNTIME_SOURCE "flang_runtime.c"
#define EMIT_RUNNER_SOURCE "flang_cli.c"
#define EMIT_SHELL_SOURCE "flang_repl.c"

/**
 * Каталог с ИСХОДНИКАМИ рантайма — не с напечатанными.
 *
 * Разница видна первой строкой: напечатанный `flang_runtime.h` начинается
 * шапкой «Сгенерировано flang», исходник — строкой SPDX. Каталог рядом с
 * бинарником (`bootstrap/`) полон именно напечатанных, и подсунуть их печати
 * значило бы приписать шапку второй раз. Поэтому каталог самого бинарника здесь
 * НЕ пробуется — в отличие от поиска заголовков для оболочки.
 */
static bool emit_runtime_here(const char *directory) {
  char *probe = repl_join(directory, EMIT_RUNTIME_HEADER);
  size_t bytes = 0;
  char *text = repl_read_file(probe, &bytes);
  bool ok = false;
  free(probe);
  if (text == NULL) {
    return false;
  }
  /* «Сгенерировано» стоит в первых двухстах байтах шапки и только там. */
  ok = strstr(text, "Сгенерировано flang") == NULL;
  free(text);
  return ok;
}

static char *emit_runtime_dir(const char *self_dir, const char *given) {
  static const char *const places[2] = {"flang/src/emit/c", "share/flang/c"};
  size_t index = 0;
  if (given != NULL && given[0] != '\0') {
    return emit_runtime_here(given) ? repl_say(given) : NULL;
  }
  {
    const char *set = getenv("FLANG_RUNTIME_DIR");
    if (set != NULL && set[0] != '\0') {
      return emit_runtime_here(set) ? repl_say(set) : NULL;
    }
  }
  if (self_dir == NULL) {
    return NULL;
  }
  for (index = 0; index < 2; index += 1) {
    char *parent = repl_dirname(self_dir);
    char *directory = repl_join(parent, places[index]);
    free(parent);
    if (emit_runtime_here(directory)) {
      return directory;
    }
    free(directory);
  }
  return NULL;
}

/** Вид типа границы — обратный перевод к «Виду типа входа» из emit-c.flang. */
static const char *emit_kind_word(fl_type_kind kind) {
  switch (kind) {
    case FL_TYPE_NUMBER:
      return "число";
    case FL_TYPE_STRING:
      return "строка";
    case FL_TYPE_FLAG:
      return "признак";
    case FL_TYPE_NULL:
      return "ничто";
    case FL_TYPE_LIST:
      return "список";
    case FL_TYPE_RECORD:
      return "запись";
    case FL_TYPE_SUM:
      return "сумма";
    case FL_TYPE_UNKNOWN:
    default:
      return "неизвестно";
  }
}

/**
 * Впечатанная граница входа — обратно в значения flang.
 *
 * Порядок полей здесь не свободный: это объекты «Тип входа», «Поле входа»,
 * «Вариант входа» и «Параметр входа» из `flang/self/emit-c.flang`, и разойдись
 * имена — печать получила бы записи не тех форм.
 */
static fl_value emit_entry_types(const fl_entry_table *table) {
  static const char *const names[13] = {"вид",  "имя",     "владелец", "ничто",  "целое",
                                        "отрезок", "низ",  "верх",     "элемент", "поле с",
                                        "полей", "вариант с", "вариантов"};
  fl_value *items = NULL;
  fl_value out = fl_nothing();
  size_t index = 0;
  if (table->type_count == 0) {
    return fl_list(NULL, 0);
  }
  items = (fl_value *)repl_alloc(sizeof(fl_value) * table->type_count);
  for (index = 0; index < table->type_count; index += 1) {
    const fl_type *type = &table->types[index];
    fl_value values[13];
    values[0] = repl_value_say(emit_kind_word(type->kind));
    values[1] = repl_value_say(type->name == NULL ? "" : type->name);
    values[2] = repl_value_say(type->owner == NULL ? "" : type->owner);
    values[3] = fl_flag(type->optional);
    values[4] = fl_flag(type->integral);
    values[5] = fl_flag(type->bounded);
    values[6] = fl_number(type->low);
    values[7] = fl_number(type->high);
    values[8] = fl_number((double)type->of);
    values[9] = fl_number((double)type->field_from);
    values[10] = fl_number((double)type->field_count);
    values[11] = fl_number((double)type->variant_from);
    values[12] = fl_number((double)type->variant_count);
    items[index] = repl_value_record(names, values, 13);
  }
  out = repl_value_list(items, table->type_count);
  free(items);
  return out;
}

static fl_value emit_entry_fields(const fl_entry_table *table) {
  static const char *const names[2] = {"имя", "тип"};
  fl_value *items = NULL;
  fl_value out = fl_nothing();
  size_t index = 0;
  if (table->field_count == 0) {
    return fl_list(NULL, 0);
  }
  items = (fl_value *)repl_alloc(sizeof(fl_value) * table->field_count);
  for (index = 0; index < table->field_count; index += 1) {
    fl_value values[2];
    values[0] = repl_value_say(table->fields[index].name == NULL ? "" : table->fields[index].name);
    values[1] = fl_number((double)table->fields[index].type);
    items[index] = repl_value_record(names, values, 2);
  }
  out = repl_value_list(items, table->field_count);
  free(items);
  return out;
}

static fl_value emit_entry_variants(const fl_entry_table *table) {
  static const char *const names[3] = {"имя", "поле с", "полей"};
  fl_value *items = NULL;
  fl_value out = fl_nothing();
  size_t index = 0;
  if (table->variant_count == 0) {
    return fl_list(NULL, 0);
  }
  items = (fl_value *)repl_alloc(sizeof(fl_value) * table->variant_count);
  for (index = 0; index < table->variant_count; index += 1) {
    fl_value values[3];
    values[0] = repl_value_say(table->variants[index].name == NULL ? "" : table->variants[index].name);
    values[1] = fl_number((double)table->variants[index].field_from);
    values[2] = fl_number((double)table->variants[index].field_count);
    items[index] = repl_value_record(names, values, 3);
  }
  out = repl_value_list(items, table->variant_count);
  free(items);
  return out;
}

static fl_value emit_entry_params(const fl_entry_table *table) {
  static const char *const names[3] = {"функция", "параметр", "тип"};
  fl_value *items = NULL;
  fl_value out = fl_nothing();
  size_t index = 0;
  if (table->param_count == 0) {
    return fl_list(NULL, 0);
  }
  items = (fl_value *)repl_alloc(sizeof(fl_value) * table->param_count);
  for (index = 0; index < table->param_count; index += 1) {
    fl_value values[3];
    values[0] = repl_value_say(table->params[index].function == NULL ? "" : table->params[index].function);
    values[1] = repl_value_say(table->params[index].name == NULL ? "" : table->params[index].name);
    values[2] = fl_number((double)table->params[index].type);
    items[index] = repl_value_record(names, values, 3);
  }
  out = repl_value_list(items, table->param_count);
  free(items);
  return out;
}

/**
 * Годится ли впечатанная граница связанной программе.
 *
 * Сверяются ПАРЫ «функция, параметр» по порядку, числу и именам — то же
 * перечисление, каким строит список `таблицаВхода` (по функциям программы, по
 * параметрам каждой). Совпало всё до последней пары — программа та же, и её
 * таблица годится. Разошлось хоть в одном месте — таблица чужая, и печатать по
 * ней значило бы соврать о типах напечатанного.
 *
 * Проверка НЕ доказывает совпадения типов: имена сошлись, а объявления могли
 * разойтись. Именно поэтому неподвижная точка сверяется отдельно и байтами
 * (`flang/test/self-bootstrap.test.mjs`): здесь дешёвый сторож, там приговор.
 */
static bool emit_entry_fits(fl_value program, const fl_entry_table *table) {
  const fl_value *functions = NULL;
  size_t count = 0;
  size_t index = 0;
  size_t seen = 0;
  zn_field_items(program, "functions", &functions, &count);
  for (index = 0; index < count; index += 1) {
    const char *function = NULL;
    size_t function_bytes = 0;
    const fl_value *params = NULL;
    size_t params_count = 0;
    size_t at = 0;
    if (!zn_field_text(functions[index], "name", &function, &function_bytes)) {
      return false;
    }
    zn_field_items(functions[index], "params", &params, &params_count);
    for (at = 0; at < params_count; at += 1) {
      const char *name = NULL;
      size_t name_bytes = 0;
      if (seen >= table->param_count) {
        return false;
      }
      if (!zn_field_text(params[at], "name", &name, &name_bytes)) {
        return false;
      }
      if (table->params[seen].function == NULL || table->params[seen].name == NULL) {
        return false;
      }
      if (strlen(table->params[seen].function) != function_bytes ||
          memcmp(table->params[seen].function, function, function_bytes) != 0) {
        return false;
      }
      if (strlen(table->params[seen].name) != name_bytes ||
          memcmp(table->params[seen].name, name, name_bytes) != 0) {
        return false;
      }
      seen += 1;
    }
  }
  return seen == table->param_count && seen > 0;
}

/** Запись одного напечатанного файла на диск; путь уже разрешён. */
static bool emit_write(const char *full, const char *text, size_t bytes) {
  FILE *stream = fopen(full, "wb");
  if (stream == NULL) {
    fprintf(stderr, "flang emit: не открыт для записи %s\n", full);
    return false;
  }
  if (bytes > 0 && fwrite(text, 1, bytes, stream) != bytes) {
    fprintf(stderr, "flang emit: не записан %s\n", full);
    fclose(stream);
    return false;
  }
  if (fclose(stream) != 0) {
    fprintf(stderr, "flang emit: не закрыт %s\n", full);
    return false;
  }
  return true;
}

static int emit_file(int argc, char **argv, const char *self) {
  repl_strings paths;
  repl_strings texts;
  repl_strings queue;
  static const char *const names[15] = {"путь",              "есть путь",         "база",
                                        "предел глубины",    "предел шагов",      "прогонщик",
                                        "рантайм заголовок", "рантайм исходник",  "исходник прогонщика",
                                        "оболочка",          "исходник оболочки", "типы входа",
                                        "поля входа",        "варианты входа",    "параметры входа"};
  fl_value values[15];
  fl_value args[2];
  fl_value sources = fl_nothing();
  fl_value result = fl_nothing();
  fl_value files = fl_nothing();
  fl_value failure = fl_nothing();
  const fl_entry_table *table = FL_PROGRAM_ENTRY();
  const char *path = NULL;
  const char *target = NULL;
  const char *out = NULL;
  const char *one = NULL;
  const char *given_runtime = NULL;
  const char *steps = "1000000";
  const char *depth = "10000";
  const char *own = "";
  char buffer[4096];
  char *base = NULL;
  char *full = NULL;
  char *text = NULL;
  char *self_dir = NULL;
  char *runtime = NULL;
  char *runtime_header = NULL;
  char *runtime_source = NULL;
  char *runner_source = NULL;
  char *shell_source = NULL;
  size_t runtime_header_bytes = 0;
  size_t runtime_source_bytes = 0;
  size_t runner_source_bytes = 0;
  size_t shell_source_bytes = 0;
  size_t bytes = 0;
  size_t index = 0;
  size_t written = 0;
  int argument = 0;
  int code = 0;
  int base_index = 1;
  bool cli = true;
  bool shell = false;
  bool fits = false;
  bool opened = false;

  for (argument = 2; argument < argc; argument += 1) {
    if (strcmp(argv[argument], "--target") == 0 && argument + 1 < argc) {
      argument += 1;
      target = argv[argument];
    } else if (strcmp(argv[argument], "--out") == 0 && argument + 1 < argc) {
      argument += 1;
      out = argv[argument];
    } else if (strcmp(argv[argument], "--file") == 0 && argument + 1 < argc) {
      argument += 1;
      one = argv[argument];
    } else if (strcmp(argv[argument], "--runtime") == 0 && argument + 1 < argc) {
      argument += 1;
      given_runtime = argv[argument];
    } else if (strcmp(argv[argument], "--max-steps") == 0 && argument + 1 < argc) {
      argument += 1;
      steps = argv[argument];
    } else if (strcmp(argv[argument], "--max-depth") == 0 && argument + 1 < argc) {
      argument += 1;
      depth = argv[argument];
    } else if (strcmp(argv[argument], "--index-base") == 0 && argument + 1 < argc) {
      argument += 1;
      base_index = strcmp(argv[argument], "0") == 0 ? 0 : 1;
    } else if (strcmp(argv[argument], "--path") == 0 && argument + 1 < argc) {
      argument += 1;
      own = argv[argument];
    } else if (strcmp(argv[argument], "--cli") == 0) {
      cli = true;
    } else if (strcmp(argv[argument], "--no-cli") == 0) {
      cli = false;
    } else if (strcmp(argv[argument], "--repl") == 0) {
      shell = true;
    } else if (argv[argument][0] != '-' && path == NULL) {
      path = argv[argument];
    } else {
      fprintf(stderr, "flang emit: непонятный ключ «%s»\n", argv[argument]);
      return 2;
    }
  }

  if (path == NULL) {
    fputs("flang emit: не назван файл. Пример: flang emit м.flang --target c --out каталог\n", stderr);
    return 2;
  }
  if (target == NULL) {
    fputs("flang emit требует «--target»: в этом бинарнике есть одна цель — «c»\n", stderr);
    return 2;
  }
  if (strcmp(target, "c") != 0) {
    fprintf(stderr,
            "flang emit: цели «%s» в этом бинарнике нет. Втащена одна — «c»; остальные семь\n"
            "(js, go, rust, python, java, csharp, elixir) написаны на flang\n"
            "(flang/self/emit-*.flang), но в замыкание этого бинарника не входят.\n",
            target);
    return 2;
  }
  if (out == NULL && one == NULL) {
    fputs("flang emit: назовите, куда печатать: «--out каталог» (все файлы) или «--file имя»\n"
          "(один файл на стандартный вывод, например «--file kompilyator_flang.c»).\n",
          stderr);
    return 2;
  }

  self_dir = repl_self_dir(self);
  runtime = emit_runtime_dir(self_dir, given_runtime);
  free(self_dir);
  if (runtime == NULL) {
    fputs("flang emit: не найдены ИСХОДНИКИ рантайма C (flang_runtime.h без шапки «Сгенерировано»).\n"
          "Они уезжают в вывод дословно, и без них печать соврала бы. Где искать:\n"
          "«--runtime каталог», $FLANG_RUNTIME_DIR, ../flang/src/emit/c, ../share/flang/c.\n",
          stderr);
    return 2;
  }

  base = getcwd(buffer, sizeof(buffer)) == NULL ? repl_say(".") : repl_say(buffer);
  full = repl_resolve(base, path);
  text = repl_read_file(full, &bytes);
  free(base);
  if (text == NULL) {
    fprintf(stderr, "FLANG_CLI: не прочитан файл %s\n", path);
    free(full);
    free(runtime);
    return 2;
  }

  {
    char *where = repl_join(runtime, EMIT_RUNTIME_HEADER);
    runtime_header = repl_read_file(where, &runtime_header_bytes);
    free(where);
    where = repl_join(runtime, EMIT_RUNTIME_SOURCE);
    runtime_source = repl_read_file(where, &runtime_source_bytes);
    free(where);
    where = repl_join(runtime, EMIT_RUNNER_SOURCE);
    runner_source = repl_read_file(where, &runner_source_bytes);
    free(where);
    where = repl_join(runtime, EMIT_SHELL_SOURCE);
    shell_source = repl_read_file(where, &shell_source_bytes);
    free(where);
  }
  if (runtime_header == NULL || runtime_source == NULL || runner_source == NULL || shell_source == NULL) {
    fprintf(stderr, "flang emit: в %s не хватает исходников рантайма\n", runtime);
    code = 2;
  }

  if (code == 0) {
    repl_cycle();
    strings_init(&paths);
    strings_init(&texts);
    strings_init(&queue);
    opened = true;
    strings_say(&paths, full);
    strings_add(&texts, text, bytes);
    repl_imports_of(text, bytes, full, &queue);
    sources = repl_closure(&paths, &texts, &queue);

    {
      fl_value linked = fl_nothing();
      fl_value program = fl_nothing();
      fl_value bads = fl_nothing();
      fl_value link_args[2];
      link_args[0] = sources;
      link_args[1] = repl_value_say(full);
      if (repl_call("Связать исходники", link_args, 2, &linked) != FL_OK) {
        code = 1;
      } else if (val_field(linked, "диагностики", &bads) && bads.tag == FL_LIST && bads.as.list.count > 0) {
        repl_bads list;
        size_t at = 0;
        bads_init(&list);
        for (at = 0; at < bads.as.list.count; at += 1) {
          bads_take(&list, bads.as.list.items[at]);
        }
        check_print_bads(&list, path, paths.count);
        fprintf(stderr, "flang emit: печать отменена — связывание дало замечаний %lu\n",
                (unsigned long)list.count);
        bads_free(&list);
        code = 1;
      } else if (!val_field(linked, "программа", &program)) {
        fputs("flang emit: связывание не вернуло программы\n", stderr);
        code = 1;
      } else {
        fits = emit_entry_fits(program, table);
        values[0] = repl_value_say(own);
        values[1] = fl_flag(own[0] != '\0');
        values[2] = fl_number((double)base_index);
        values[3] = fl_number(strtod(depth, NULL));
        values[4] = fl_number(strtod(steps, NULL));
        values[5] = fl_flag(cli);
        values[6] = repl_value_text(runtime_header, runtime_header_bytes);
        values[7] = repl_value_text(runtime_source, runtime_source_bytes);
        values[8] = repl_value_text(runner_source, runner_source_bytes);
        values[9] = fl_flag(shell);
        values[10] = repl_value_text(shell_source, shell_source_bytes);
        values[11] = fits ? emit_entry_types(table) : fl_list(NULL, 0);
        values[12] = fits ? emit_entry_fields(table) : fl_list(NULL, 0);
        values[13] = fits ? emit_entry_variants(table) : fl_list(NULL, 0);
        values[14] = fits ? emit_entry_params(table) : fl_list(NULL, 0);
        args[0] = program;
        args[1] = repl_value_record(names, values, 15);
        if (repl_call("Напечатать связанное", args, 2, &result) != FL_OK) {
          code = 1;
        } else if (val_field(result, "ошибка", &failure) && !val_same(failure, "")) {
          char *say = val_copy(failure);
          fprintf(stderr, "flang emit: печать отказала — %s\n", say);
          free(say);
          code = 1;
        } else if (!val_field(result, "файлы", &files) || files.tag != FL_LIST) {
          fputs("flang emit: печать не вернула файлов\n", stderr);
          code = 1;
        }
      }
    }
  }

  if (code == 0) {
    bool found = false;
    for (index = 0; index < files.as.list.count && code == 0; index += 1) {
      fl_value where = fl_nothing();
      fl_value content = fl_nothing();
      const char *body = NULL;
      size_t body_bytes = 0;
      char *name = NULL;
      if (!val_field(files.as.list.items[index], "путь", &where) ||
          !val_field(files.as.list.items[index], "содержимое", &content) ||
          !val_text(content, &body, &body_bytes)) {
        continue;
      }
      name = val_copy(where);
      if (one != NULL) {
        if (strcmp(name, one) == 0) {
          found = true;
          if (body_bytes > 0 && fwrite(body, 1, body_bytes, stdout) != body_bytes) {
            fputs("flang emit: вывод оборван\n", stderr);
            code = 1;
          }
          written += body_bytes;
        }
        free(name);
        continue;
      }
      {
        char *destination = repl_join(out, name);
        /* Каталог НЕ заводится, и это решение, а не пропуск. `mkdir` живёт в
           <sys/stat.h>, а у этого файла есть обещание: оболочке хватает
           стандартной библиотеки C плюс signal.h и unistd.h, и стережёт его
           сторож в flang/test/emit-c.test.mjs («оболочка печатается только по
           просьбе, и её нужды названы поимённо»). Один заголовок ради одного
           mkdir — плохая цена: каталог человек делает `mkdir` сам, а если его
           нет, отказ ниже назовёт путь. */
        if (!emit_write(destination, body, body_bytes)) {
          code = 1;
        }
        written += body_bytes;
        free(destination);
      }
      free(name);
    }
    fflush(stdout);
    if (one != NULL && !found && code == 0) {
      fprintf(stderr, "flang emit: файла «%s» печать не даёт. Что даёт:", one);
      for (index = 0; index < files.as.list.count; index += 1) {
        fl_value where = fl_nothing();
        if (val_field(files.as.list.items[index], "путь", &where)) {
          char *name = val_copy(where);
          fprintf(stderr, " %s", name);
          free(name);
        }
      }
      fputc('\n', stderr);
      code = 2;
    }
    if (code == 0) {
      /* Число файлов и байт — на stderr, потому что stdout занят печатью:
         `flang emit … --file x.c > x.c` обязан дать РОВНО файл. */
      if (one == NULL) {
        fprintf(stderr, "напечатано файлов %lu, байт %lu, в %s\n", (unsigned long)files.as.list.count,
                (unsigned long)written, out);
      }
      if (!fits) {
        fprintf(stderr,
                "граница входа пуста: таблицу объявленных типов строит слой типов свидетеля\n"
                "(«таблицаВхода»), которого в бинарнике нет, а впечатанная (параметров %lu) этой\n"
                "программе не подходит. Напечатанное соберётся и заработает, но аргументы\n"
                "прогонщика объявленным типам сверяться не будут.\n",
                (unsigned long)table->param_count);
      }
    }
  }

  if (opened) {
    strings_free(&paths);
    strings_free(&texts);
    strings_free(&queue);
  }
  free(runtime_header);
  free(runtime_source);
  free(runner_source);
  free(shell_source);
  free(runtime);
  free(text);
  free(full);
  return code;
}

static const char REPL_PROMPT[] = "» ";
static const char REPL_CONTINUATION[] = "… ";

/**
 * Терминал вокруг сессии: приглашения, склейка многострочного ввода и выбор
 * потока для печати. Всё, что решает, чем является строка и что с ней делать,
 * живёт выше — там же, где и в Node-версии.
 *
 * Многострочность собирается ровно одним правилом: строки копятся, пока
 * `repl_needs_more` говорит «объявление не закончено», и пустая строка
 * заканчивает ввод всегда. Остаток буфера отправляется при конце ввода — иначе
 * `flang repl < сценарий.flang` терял бы последнее объявление файла, если автор
 * не оставил в конце пустую строку.
 */
static int repl_loop(int argc, char **argv, const char *self) {
  repl_session session;
  repl_buf buffer;
  repl_buf line;
  struct sigaction action;
  const char *file = NULL;
  const bool interactive = isatty(0) == 1;
  bool failed = false;
  bool quit = false;
  int index = 0;

  repl_open_session(&session, self);
  repl_open = &session;
  atexit(repl_sweep);

  for (index = 1; index < argc; index += 1) {
    if (strcmp(argv[index], "--max-steps") == 0 && index + 1 < argc) {
      index += 1;
      free(session.steps);
      session.steps = repl_say(argv[index]);
    } else if (strcmp(argv[index], "--max-depth") == 0 && index + 1 < argc) {
      index += 1;
      free(session.depth);
      session.depth = repl_say(argv[index]);
    } else if (argv[index][0] != '-') {
      file = argv[index];
    }
  }

  action.sa_handler = repl_on_interrupt;
  sigemptyset(&action.sa_mask);
  action.sa_flags = 0;
  sigaction(SIGINT, &action, NULL);

  /* Приглашения печатаются только человеку: под конвейером они попали бы в
     вывод и испортили его тому, кто читает результат сценария. Приветствие
     выбирается по тому, чем оболочка на самом деле располагает: обещать
     вычисление, а следующей строкой признаваться, что вычислять нечем, значит
     соврать первой строкой — её и прочтут. */
  if (interactive) {
    printf("%s\n", session.why_no_eval == NULL ? REPL_GREETING : REPL_GREETING_NO_EVAL);
  }
  /* Про отсутствие вычислителя — один раз и в stderr: stdout принадлежит
     результату сценария. */
  if (session.why_no_eval != NULL) {
    fprintf(stderr, "%s\n", session.why_no_eval);
  }
  if (file != NULL && !repl_command_load(&session, file)) {
    failed = true;
  }

  buf_init(&buffer);
  buf_init(&line);
  if (interactive) {
    fputs(REPL_PROMPT, stdout);
    fflush(stdout);
  }
  for (;;) {
    const repl_read got = repl_read_line(&line);
    if (got == REPL_INTERRUPT) {
      buf_reset(&buffer);
      if (interactive) {
        printf("\n%s", REPL_PROMPT);
        fflush(stdout);
      }
      continue;
    }
    if (got == REPL_EOF) {
      break;
    }
    if (buffer.used > 0) {
      buf_char(&buffer, '\n');
    }
    buf_add(&buffer, line.data, line.used);
    if (repl_needs_more(&session, buffer.data)) {
      if (interactive) {
        fputs(REPL_CONTINUATION, stdout);
        fflush(stdout);
      }
      continue;
    }
    {
      char *own = repl_dup(buffer.data, buffer.used);
      buf_reset(&buffer);
      if (!repl_submit(&session, own, &quit)) {
        failed = true;
      }
      free(own);
    }
    fflush(stdout);
    if (quit) {
      break;
    }
    if (interactive) {
      fputs(REPL_PROMPT, stdout);
      fflush(stdout);
    }
  }
  if (!quit && buffer.used > 0 && !repl_submit(&session, buffer.data, &quit)) {
    failed = true;
  }
  fflush(stdout);

  buf_free(&buffer);
  buf_free(&line);
  repl_close_session(&session);
  /* Человеку код возврата не нужен — он видел ошибку и продолжил работать.
     Конвейеру нужен: `flang repl < сценарий.flang` — это прогон сценария, и
     молча отдать 0 после диагностики значило бы соврать вызывающему. */
  return interactive || !failed ? 0 : 1;
}

/**
 * `flang check` с ключами. `--json` осмыслен только рядом с `--proof`: без него
 * `check` и так печатает человеку, и молча принять ключ, который ничего не
 * меняет, значило бы пообещать работу и её не сделать.
 */
static int check_command(int argc, char **argv) {
  const char *path = NULL;
  bool proof = false;
  bool json = false;
  int index = 0;
  for (index = 2; index < argc; index += 1) {
    if (strcmp(argv[index], "--proof") == 0) {
      proof = true;
    } else if (strcmp(argv[index], "--json") == 0) {
      json = true;
    } else if (argv[index][0] != '-' && path == NULL) {
      path = argv[index];
    } else {
      fprintf(stderr, "flang check: непонятный ключ «%s»\n", argv[index]);
      return 2;
    }
  }
  if (path == NULL) {
    fputs("flang check: не назван файл. Пример: flang check модуль.flang\n", stderr);
    return 2;
  }
  if (json && !proof) {
    fputs("flang check --json осмыслен только рядом с «--proof»: без ведомости печатать в JSON нечего\n", stderr);
    return 2;
  }
  return proof ? proof_file(path, json) : check_file(path);
}

/* ═════════════════════════ разбор аргументов ═════════════════════════════ */

/*
 * КОМАНДЫ, КОТОРЫЕ ЕСТЬ У ПОЛНОГО ИНСТРУМЕНТАРИЯ И КОТОРЫХ ЗДЕСЬ НЕТ.
 *
 * Названы поимённо, а не свалены в «неизвестная команда». Замер, с которого это
 * заведено: у двоичного 6 команд, у свидетеля на Node — 11, и человек, пришедший
 * по документации за `flang lock`, получал ответ, читающийся как опечатка. Он не
 * узнавал ни того, что команда существует, ни того, где она живёт, — а
 * документация её обещает.
 *
 * Отвечать на такое ошибкой ПРАВИЛЬНО (двоичный этого не умеет, и делать вид,
 * что умеет, было бы хуже всего), но ошибка обязана назвать причину. Список
 * стережётся с обеих сторон: `flang/test/self-bootstrap.test.mjs` требует, чтобы
 * КАЖДАЯ команда свидетеля была у двоичного либо исполнена, либо названа здесь.
 */
static const char *human_elsewhere(const char *command) {
  if (strcmp(command, "ast") == 0) {
    return "печать разобранной программы";
  }
  if (strcmp(command, "facts") == 0) {
    return "проверка суждений на фактах";
  }
  if (strcmp(command, "io") == 0) {
    return "исполнение плана или службы";
  }
  if (strcmp(command, "lock") == 0) {
    return "замок, в котором лежат сами зависимости";
  }
  if (strcmp(command, "package") == 0) {
    return "пакет: груз замка плюс имя, версия и ведомость доказанного";
  }
  return NULL;
}

static bool human_word(const char *word, const char *full, const char *short_form, const char *bare) {
  return strcmp(word, full) == 0 || (short_form != NULL && strcmp(word, short_form) == 0) ||
         (bare != NULL && strcmp(word, bare) == 0);
}

/*
 * Стоит ли ключ где-нибудь в вызове. Ключ, который есть у всех, обязан работать
 * и после имени команды: `flang check --help` — первое, что набирает человек,
 * и до этой правки он получал «flang check: непонятный ключ «--help»».
 *
 * Ищется по всему вызову, а не только вторым словом: у команд этого бинарника
 * ключи стоят в любом порядке. Довод, что `--help` мог бы оказаться ЗНАЧЕНИЕМ
 * соседнего ключа (`--function --help`), здесь не работает против: вызов, в
 * котором человек написал `--help`, он написал не случайно.
 */
static bool human_flag(int argc, char **argv, const char *full, const char *short_form) {
  int index = 0;
  for (index = 1; index < argc; index += 1) {
    if (strcmp(argv[index], full) == 0 || strcmp(argv[index], short_form) == 0) {
      return true;
    }
  }
  return false;
}

/*
 * ГОЛАЯ КОМАНДА НА ТЕРМИНАЛЕ ОТКРЫВАЕТ ОБОЛОЧКУ — как `iex`, как `python`.
 *
 * Под конвейером голая команда остаётся прогонщиком, и это не уступка, а
 * контракт: им живут тест формулы Homebrew, проба плагина asdf,
 * `scripts/build-release-c.mjs` и всякий, кто зовёт программу на flang трубой.
 * Человека на том конце различает `isatty`, и другого способа нет: JSON,
 * набираемый руками в терминале, — не тот случай, ради которого стоит держать
 * дверь.
 *
 * «Компилятор ли я» спрашивается здесь же и раньше терминала по важности: у
 * ЧУЖОЙ программы, напечатанной с этим файлом, человеческого входа нет вовсе, и
 * увести её со стандартного ввода значило бы сломать ей протокол.
 */
int fl_human_bare(void) {
  bool compiler = false;
  if (isatty(0) != 1) {
    return 0;
  }
  fl_arena_init(&repl_arena);
  fl_ctx_init(&repl_ctx, &repl_arena);
  compiler = repl_is_compiler();
  fl_arena_release(&repl_arena);
  return compiler ? 1 : 0;
}

/**
 * Человеческий вход бинарника: сюда прогонщик передаёт управление, увидев в
 * аргументах хоть что-нибудь.
 *
 * Неизвестная команда — отказ с кодом 2, а не молчание. Молчание и было прежней
 * бедой: `flang chek файл.flang` с опечаткой читал пустой стандартный ввод,
 * ничего не печатал и отвечал нулём, а человек уходил в уверенности, что
 * проверил файл.
 *
 * Арена одна на весь вход и заводится здесь: и проверка файла, и оболочка зовут
 * компилятор, и делить владение памятью между ними было бы нечем.
 */
int fl_human_main(int argc, char **argv, const char *self) {
  const char *command = argc > 1 ? argv[1] : "";
  const bool named_help = human_word(command, "--help", "-h", "help");
  /* Версия отвечает РАНЬШЕ справки: `flang --help --version` — это вопрос о
     версии, а не просьба показать справку о ней. Порядок тот же, что у свидетеля
     на Node и у эталона на flang. */
  const bool asks_version =
      human_word(command, "--version", "-v", "version") || human_flag(argc, argv, "--version", "-v");
  const bool asks_help = named_help || human_flag(argc, argv, "--help", "-h");
  int code = 0;

  /*
   * «Кто я» спрашивается ПЕРВЫМ, раньше даже справки, и стоит это нисколько
   * (проба — разбор пустой строки). Иначе программа «Списки», собранная с этим
   * файлом, на `--help` рассказывала бы про язык flang и называла бы его
   * версию — то есть врала бы о себе там, где вопрос как раз о ней.
   */
  fl_arena_init(&repl_arena);
  fl_ctx_init(&repl_ctx, &repl_arena);
  if (!repl_is_compiler()) {
    fputs("человеческие команды есть только у компилятора flang: в этой программе нет его точек\n"
          "входа («Разбор исходника», «Связать исходники», «Проверить типы»). Прогонщик\n"
          "по-прежнему читает JSON со стандартного ввода.\n",
          stderr);
    fl_arena_release(&repl_arena);
    return 2;
  }

  if (asks_version) {
    printf("flang %s\n", FLANG_VERSION);
  } else if (asks_help) {
    /* О ЧЁМ спрашивают: у `flang help check` тема стоит третьим словом, у
       `flang check --help` темой служит сама команда, у голого `flang --help`
       темы нет вовсе. */
    human_help(named_help ? (argc > 2 ? argv[2] : NULL) : command);
  } else if (argc <= 1) {
    /* Сюда приходит голая команда с терминала: прогонщик уступил дорогу
       человеку, а человеку без доводов нужна оболочка. */
    code = repl_loop(0, argv, self);
  } else if (strcmp(command, "check") == 0) {
    code = check_command(argc, argv);
  } else if (strcmp(command, "test") == 0) {
    code = test_file(argc, argv);
  } else if (strcmp(command, "run") == 0) {
    code = run_file(argc, argv);
  } else if (strcmp(command, "emit") == 0) {
    code = emit_file(argc, argv, self);
  } else if (strcmp(command, "repl") == 0) {
    code = repl_loop(argc - 1, argv + 1, self);
  } else {
    const char *elsewhere = human_elsewhere(command);
    if (elsewhere != NULL) {
      fprintf(stderr,
              "flang %s (%s) есть в полном инструментарии, а в этом двоичном — нет.\n"
              "Что умеет двоичный, скажет «flang --help». Полный ставится с Node:\n"
              "npm install -g @digitable-lol/fts\n",
              command, elsewhere);
    } else {
      fprintf(stderr, "flang: неизвестная команда «%s». «flang --help» — что умеет бинарник.\n", command);
    }
    code = 2;
  }
  fl_arena_release(&repl_arena);
  return code;
}
