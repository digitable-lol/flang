/**
 * Область на вызов в цели C: правила, по которым она работает и по которым
 * ОТКАЗЫВАЕТСЯ работать.
 *
 * Зачем отдельный набор. Всё остальное про печать в C сверяет ОТВЕТЫ —
 * собранная программа обязана давать то же, что интерпретатор. Область ответов
 * не меняет по построению, поэтому сверка ответов её и не видит: сними область
 * целиком, и `emit-c.test.mjs` останется зелёным. А снять её нельзя: без неё
 * сортировка слиянием четырёх тысяч чисел берёт 1 655 МиБ вместо двух.
 *
 * Значит проверять надо не ответ, а САМО УСТРОЙСТВО — и делать это на C, потому
 * что наблюдаемого с уровня flang здесь нет ничего. Каждая проверка ниже
 * краснеет от снятия ровно одного правила рантайма, и в шапке каждой написано,
 * от какого именно.
 *
 * Устройство набора: рантайм (`flang/src/emit/c/flang_runtime.[ch]`) кладётся в
 * пустой каталог как есть, рядом ложится программа-проба на C, всё это
 * собирается теми же флагами, что и напечатанное (`-Werror -pedantic`), и
 * запускается. Проба печатает по строке на проверку; строки сверяются здесь.
 */
import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { mkdtemp, rm, writeFile, copyFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, test } from "node:test"
import { fileURLToPath } from "node:url"

const runtimeDirectory = fileURLToPath(new URL("../src/emit/c/", import.meta.url))
const workdir = await mkdtemp(join(tmpdir(), "flang-region-"))
after(async () => {
  await rm(workdir, { recursive: true, force: true })
})

const CFLAGS = ["-std=c99", "-Wall", "-Wextra", "-Werror", "-pedantic", "-O2"]

let serial = 0

/**
 * Собирает пробу вместе с рантаймом и возвращает её вывод построчно.
 * `defines` уезжают в командную строку — так проверяется и то, что настройки
 * области действительно настройки, а не вкопанные числа.
 */
async function probe(source, defines = []) {
  serial += 1
  const directory = join(workdir, `p${serial}`)
  await execFileSync("mkdir", ["-p", directory])
  await copyFile(join(runtimeDirectory, "flang_runtime.h"), join(directory, "flang_runtime.h"))
  await copyFile(join(runtimeDirectory, "flang_runtime.c"), join(directory, "flang_runtime.c"))
  await writeFile(join(directory, "proba.c"), source, "utf8")
  try {
    execFileSync("cc", [...CFLAGS, ...defines, "proba.c", "flang_runtime.c", "-o", "proba", "-lm"], {
      cwd: directory,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
  } catch (error) {
    assert.fail(`проба не собралась:\n${error.stderr ?? error.message}`)
  }
  const run = spawnSync(join(directory, "proba"), [], { encoding: "utf8", timeout: 120_000 })
  assert.equal(run.status, 0, `проба упала (${run.signal ?? run.status}):\n${run.stdout}\n${run.stderr}`)
  return run.stdout.split("\n").filter((line) => line.length > 0)
}

/** Шапка всякой пробы: рантайм плюс арена с контекстом на стеке. */
const HEAD = `#include <stdio.h>
#include <string.h>
#include "flang_runtime.h"

static fl_arena arena;
static fl_ctx ctx;

void nachalo(void) {
  fl_arena_init(&arena);
  fl_ctx_init(&ctx, &arena);
}

/* Мусор: n выдач по 256 байт, ничем не связанных с результатом. */
void musor(size_t n) {
  size_t i = 0;
  for (i = 0; i < n; i += 1) {
    void *block = fl_arena_alloc(&arena, 256);
    if (block == NULL) { printf("НЕТ ПАМЯТИ\\n"); }
  }
}

/* Список из n чисел в арене. */
fl_value spisok(size_t n) {
  fl_value *items = NULL;
  size_t i = 0;
  fl_error error;
  if (fl_list_alloc(&ctx, n, &items, &error) != FL_OK) { printf("НЕТ ПАМЯТИ\\n"); }
  for (i = 0; i < n; i += 1) items[i] = fl_number((double)i);
  return fl_list(items, n);
}
`

/* ═════════════════════════ 1. изъян: fl_grow переживает откат ═════════════ */

test("продление на месте не переходит границу открытой области", async () => {
  /*
   * Краснеет от снятия проверки `arena->guard_chunk == chunk && …` в
   * `fl_arena_extend`.
   *
   * Почему это правило вообще нужно: «добавить» на быстром пути зовёт
   * `fl_arena_extend` и, если продление удалось, тут же УДВАИВАЕТ
   * `grow->capacity` на месте. Пусть массив и его `fl_grow` лежат ниже
   * отметки, а продление легло выше — откат заберёт продлённую половину, а
   * удвоенный `capacity` останется. С этой минуты запись `fl_grow` врёт про
   * арену: она числит своими ячейки, которые арена уже готова отдать другому.
   *
   * Сегодня эта ложь до записи в чужую память не доходит — быстрый путь
   * требует ещё и `grow->filled == count`, а `filled` растёт вместе с
   * `capacity` и откатом тоже не задет. Но держать корректность области на
   * втором поле чужого инварианта нельзя: правило «продление не переходит
   * границу» локально, проверяемо и стоит одно сравнение.
   */
  const lines = await probe(`${HEAD}
int main(void) {
  void *block = NULL;
  fl_mark region;
  nachalo();
  block = fl_arena_alloc(&arena, 64);
  /* Без области последняя выдача продлевается — так и было до области. */
  printf("без области: %s\\n", fl_arena_extend(&arena, block, 64, 64) ? "да" : "нет");
  region = fl_region_open(&ctx);
  /* Блок лежит НИЖЕ отметки: продление обязано быть отвергнуто. */
  printf("под областью: %s\\n", fl_arena_extend(&arena, block, 128, 128) ? "да" : "нет");
  (void)fl_region_close(&ctx, region, FL_OK, NULL, NULL);
  /* Область закрыта — граница снята, продление снова законно. */
  printf("после области: %s\\n", fl_arena_extend(&arena, block, 128, 128) ? "да" : "нет");
  fl_arena_release(&arena);
  return 0;
}
`)
  assert.deepEqual(lines, ["без области: да", "под областью: нет", "после области: да"])
})

test("блок, выданный ВНУТРИ области, продлевается как обычно", async () => {
  /*
   * Обратная сторона того же правила, и она важнее первой: сторож обязан
   * запрещать ровно опасное. Запрети он всё подряд — накопление списка в
   * свёртке выродилось бы обратно в копию на каждом шаге, то есть в ~16·n²
   * байт мусора, ради ухода от которых `fl_arena_extend` и заведён.
   */
  const lines = await probe(`${HEAD}
int main(void) {
  void *block = NULL;
  fl_mark region;
  nachalo();
  region = fl_region_open(&ctx);
  block = fl_arena_alloc(&arena, 64);
  printf("внутри области: %s\\n", fl_arena_extend(&arena, block, 64, 64) ? "да" : "нет");
  (void)fl_region_close(&ctx, region, FL_OK, NULL, NULL);
  fl_arena_release(&arena);
  return 0;
}
`)
  assert.deepEqual(lines, ["внутри области: да"])
})

/* ═══════════════════ 2. область действительно отдаёт мусор ════════════════ */

test("область отдаёт мусор и сохраняет результат до значения", async () => {
  /*
   * Главная проверка набора: краснеет, если область снять совсем.
   *
   * Мусора здесь 2,5 МиБ, результат — список из шестнадцати чисел. После
   * закрытия области выданного обязано остаться столько же, сколько было до
   * неё, плюс сам результат; а сам результат обязан совпасть со сверочной
   * копией, построенной НИЖЕ отметки, — то есть перекладка не потеряла ни
   * значения, ни порядка.
   */
  const lines = await probe(`${HEAD}
int main(void) {
  fl_mark region;
  fl_value result = fl_nothing();
  fl_value etalon = fl_nothing();
  size_t do_oblasti = 0;
  nachalo();
  etalon = spisok(16); /* ниже отметки: откат его не тронет */
  do_oblasti = arena.handed;
  region = fl_region_open(&ctx);
  musor(10000);
  result = spisok(16);
  printf("наросло: %s\\n", arena.handed - do_oblasti > 2000000u ? "много" : "мало");
  (void)fl_region_close(&ctx, region, FL_OK, &result, NULL);
  printf("осталось: %lu\\n", (unsigned long)(arena.handed - do_oblasti));
  printf("значение то же: %s\\n", fl_equal(result, etalon) ? "да" : "нет");
  printf("длина: %lu\\n", (unsigned long)result.as.list.count);
  fl_arena_release(&arena);
  return 0;
}
`)
  assert.equal(lines[0], "наросло: много")
  const left = Number(lines[1].split(": ")[1])
  assert.ok(left > 0, "результат обязан остаться в арене")
  assert.ok(left < 4096, `после отката обязан остаться только результат, осталось ${left} байт`)
  assert.equal(lines[2], "значение то же: да")
  assert.equal(lines[3], "длина: 16")
})

test("перекладка сохраняет строки, записи и варианты, а не только списки", async () => {
  const lines = await probe(`${HEAD}
int main(void) {
  fl_mark region;
  fl_value result = fl_nothing();
  fl_value etalon = fl_nothing();
  fl_error error;
  const char *names[2];
  fl_value values[2];
  size_t i = 0;
  names[0] = "имя";
  names[1] = "хвост";
  nachalo();
  /* Эталон строится НИЖЕ отметки — его откат не заденет. */
  for (i = 0; i < 2; i += 1) {
    fl_value text = fl_nothing();
    fl_value inner = fl_nothing();
    fl_value *cell = NULL;
    if (fl_text(&ctx, "строка с кириллицей", 34, &text, &error) != FL_OK) return 1;
    values[0] = text;
    values[1] = spisok(3);
    if (fl_variant_new(&ctx, "Узел", names, values, 2, &inner, &error) != FL_OK) return 1;
    if (fl_list_alloc(&ctx, 1, &cell, &error) != FL_OK) return 1;
    cell[0] = inner;
    if (i == 0) {
      etalon = fl_list(cell, 1);
    } else {
      region = fl_region_open(&ctx);
      musor(10000);
      /* тот же по значению, но построен ВЫШЕ отметки */
      if (fl_text(&ctx, "строка с кириллицей", 34, &text, &error) != FL_OK) return 1;
      values[0] = text;
      values[1] = spisok(3);
      if (fl_variant_new(&ctx, "Узел", names, values, 2, &inner, &error) != FL_OK) return 1;
      if (fl_list_alloc(&ctx, 1, &cell, &error) != FL_OK) return 1;
      cell[0] = inner;
      result = fl_list(cell, 1);
      (void)fl_region_close(&ctx, region, FL_OK, &result, NULL);
    }
  }
  printf("совпало: %s\\n", fl_equal(result, etalon) ? "да" : "нет");
  fl_arena_release(&arena);
  return 0;
}
`)
  assert.deepEqual(lines, ["совпало: да"])
})

/* ═══════════════ 3. изъяны 2–4: три случая, когда область молчит ══════════ */

test("разделяемый подграф не разворачивается: обмер с бюджетом обрывает копию", async () => {
  /*
   * Изъян, названный соседом и не записанный в конкурентности: значения flang
   * — деревья, но в ПАМЯТИ они графы. Один и тот же подсписок разрешено
   * положить в результат сколько угодно раз одним указателем, а глубокая
   * копия развернёт такой граф в дерево — в худшем случае экспонентой.
   *
   * Здесь построено ровно такое значение: сорок уровней, на каждом список из
   * двух ссылок на предыдущий. В памяти это 40 · 2 · 32 байта, развёрнутым
   * деревом — 2^40 листьев, то есть тридцать пять терабайт.
   *
   * Область обязана не заметить разницы и просто отказаться: обмер идёт с
   * бюджетом в половину наросшего и обрывается на первых же байтах сверх него.
   * Краснеет от снятия бюджета — тогда проба не отказывается, а не
   * возвращается вовсе (тайм-аут в 120 секунд).
   *
   * Разделения перекладка не сохраняет, и это НЕ починено, а ограничено:
   * копия, если она всё-таки делается, не больше половины отданного мусора.
   * Больше памяти после области, чем до неё, не станет никогда.
   */
  const lines = await probe(`${HEAD}
int main(void) {
  fl_mark region;
  fl_value result = fl_nothing();
  fl_error error;
  size_t do_oblasti = 0;
  size_t level = 0;
  nachalo();
  do_oblasti = arena.handed;
  region = fl_region_open(&ctx);
  musor(10000);
  result = spisok(1);
  for (level = 0; level < 40; level += 1) {
    fl_value *pair = NULL;
    if (fl_list_alloc(&ctx, 2, &pair, &error) != FL_OK) return 1;
    pair[0] = result;
    pair[1] = result; /* тот же указатель дважды — вот и разделение */
    result = fl_list(pair, 2);
  }
  (void)fl_region_close(&ctx, region, FL_OK, &result, NULL);
  printf("откатилось: %s\\n", arena.handed - do_oblasti < 2000000u ? "да" : "нет");
  printf("значение цело: %lu\\n", (unsigned long)result.as.list.count);
  fl_arena_release(&arena);
  return 0;
}
`)
  /* Отката нет — но и взрыва нет: область просто не тронула ничего. */
  assert.deepEqual(lines, ["откатилось: нет", "значение цело: 2"])
})

/** Проба «намусорить и вернуть список»: сколько выдано после закрытия области. */
function vydano(garbage, list) {
  return `${HEAD}
int main(void) {
  fl_mark region;
  fl_value result = fl_nothing();
  size_t do_oblasti = 0;
  nachalo();
  do_oblasti = arena.handed;
  region = fl_region_open(&ctx);
  musor(${garbage});
  result = spisok(${list});
  (void)fl_region_close(&ctx, region, FL_OK, &result, NULL);
  printf("выдано: %lu\\n", (unsigned long)(arena.handed - do_oblasti));
  printf("длина: %lu\\n", (unsigned long)result.as.list.count);
  fl_arena_release(&arena);
  return 0;
}
`
}

/** Тот же исход, но с заведомо непреодолимым порогом: область точно молчит. */
const БЕЗ_ОБЛАСТИ = ["-DFL_REGION_MIN=(size_t)(64u*1024u*1024u)"]

test("четверть — замеренная граница, а не круглое число: держит с обеих сторон", async () => {
  /*
   * Изъян третий: копия стоит O(размера результата), и у функции, которая
   * возвращает много, а мусорит мало, откат — чистый убыток. Правило —
   * `FL_REGION_GAIN`: перекладывать, только если отданное втрое превысит
   * переложенное (то есть результат не больше четверти наросшего).
   *
   * Четвёрка не выдумана. При половине накопление списка через «добавить»
   * платит буфером перекладки: замер на миллионе «добавить» дал пик
   * 96,1 → 126,6 МиБ и время 0,10 → 0,14 с, а сам компилятор flang,
   * собранный в C, — 799,0 → 844,9 МиБ. При четверти оба возвращаются к
   * прежним числам, а сортировка слиянием теряет всего 2,2 → 3,5 МиБ при
   * 1 655 МиБ до области.
   *
   * Поэтому проверка держит границу С ОБЕИХ сторон и краснеет от сдвига
   * константы в любую:
   *   • ослабь до половины — первая проба начнёт откатываться;
   *   • ужесточи до восьмой — вторая перестанет.
   *
   * Сверка не с числом из головы, а сама с собой: та же проба с непреодолимым
   * порогом заведомо не откатывается и даёт опорное число. Сравнивать
   * указатели тут нельзя — откат возвращает те же куски, и перекладка часто
   * ложится ровно туда же, откуда взялась.
   */
  /* Мусора 2 048 000 Б, живого 960 000 Б — больше четверти, меньше половины. */
  const мимо = vydano(8000, 30000)
  const мимоОпора = await probe(мимо, БЕЗ_ОБЛАСТИ)
  assert.deepEqual(await probe(мимо), мимоОпора, "результат больше четверти мусора — область обязана молчать")

  /* Мусора 2 048 000 Б, живого 320 000 Б — меньше четверти, больше восьмой. */
  const мимоНеПрошло = vydano(8000, 10000)
  const опора = await probe(мимоНеПрошло, БЕЗ_ОБЛАСТИ)
  const откат = await probe(мимоНеПрошло)
  assert.equal(откат[1], "длина: 10000", "значение обязано пережить перекладку")
  const было = Number(опора[0].split(": ")[1])
  const стало = Number(откат[0].split(": ")[1])
  assert.ok(
    стало * 4 <= было,
    `результат меньше четверти мусора — область обязана откатить: было ${было}, стало ${стало}`,
  )
})

test("область молчит на мелком вызове: ниже куска арены платить не за что", async () => {
  /*
   * Изъян четвёртый в исходном виде звучал как «порог — это настройка, а
   * настройка это непредсказуемость». Порог здесь не настройка вкуса: он равен
   * куску арены (FL_CHUNK_MIN). Ниже куска область не стоила арене ни одной
   * покупки у malloc, и откатывать нечего.
   *
   * Проверка держит обе стороны: под порогом область не делает НИЧЕГО (иначе
   * мелкие частые вызовы платили бы обмером на каждом), а стоит поднять порог
   * ключом компилятора — и она перестаёт работать там, где работала. То есть
   * порог действительно порог, а не украшение.
   */
  const source = `${HEAD}
int main(void) {
  fl_mark region;
  fl_value result = fl_nothing();
  size_t do_oblasti = 0;
  nachalo();
  do_oblasti = arena.handed;
  region = fl_region_open(&ctx);
  musor(100);          /* ~26 КиБ — меньше куска в 64 КиБ */
  result = spisok(4);
  (void)fl_region_close(&ctx, region, FL_OK, &result, NULL);
  printf("мелкий откатился: %s\\n", arena.handed - do_oblasti < 4096u ? "да" : "нет");
  do_oblasti = arena.handed;
  region = fl_region_open(&ctx);
  musor(1000);         /* ~256 КиБ — больше куска */
  result = spisok(4);
  (void)fl_region_close(&ctx, region, FL_OK, &result, NULL);
  printf("крупный откатился: %s\\n", arena.handed - do_oblasti < 4096u ? "да" : "нет");
  fl_arena_release(&arena);
  return 0;
}
`
  assert.deepEqual(await probe(source), ["мелкий откатился: нет", "крупный откатился: да"])
  /* Тот же исходник с поднятым порогом: крупный вызов уходит под порог. */
  assert.deepEqual(await probe(source, ["-DFL_REGION_MIN=(size_t)(1024u*1024u)"]), [
    "мелкий откатился: нет",
    "крупный откатился: нет",
  ])
})

/* ═════════════════ 4. область не меняет наблюдаемого поведения ════════════ */

test("на отказе область не трогает ничего: текст диагностики переживает выход", async () => {
  /*
   * Текст диагностики строится в той же арене и лежит выше отметки. Откати
   * область на отказе — и вызывающий получил бы код с указателем в отданную
   * память. Краснеет от снятия проверки `status != FL_OK` в fl_region_close.
   */
  const lines = await probe(`${HEAD}
int main(void) {
  fl_mark region;
  fl_error error;
  fl_value result = fl_nothing();
  fl_status status = FL_OK;
  nachalo();
  error.code = NULL;
  error.message = NULL;
  region = fl_region_open(&ctx);
  musor(10000);
  /* Отказ строит текст в арене — ровно как это делает fl_fail изнутри. */
  status = fl_fail(&ctx, &error, FL_CODE_TYPE, "число %d не годится", 42);
  status = fl_region_close(&ctx, region, status, &result, &error);
  printf("статус: %d\\n", (int)status);
  printf("текст: %s\\n", error.message);
  fl_arena_release(&arena);
  return 0;
}
`)
  assert.deepEqual(lines, ["статус: 1", "текст: число 42 не годится"])
})

test("область не отказывает вычислению: без арены и без результата она молчит", async () => {
  const lines = await probe(`${HEAD}
int main(void) {
  fl_ctx bare;
  fl_mark region;
  memset(&bare, 0, sizeof(bare));
  bare.arena = NULL;
  region = fl_region_open(&bare);
  printf("без арены: %d\\n", (int)fl_region_close(&bare, region, FL_OK, NULL, NULL));
  nachalo();
  region = fl_region_open(&ctx);
  musor(10000);
  printf("без результата: %d\\n", (int)fl_region_close(&ctx, region, FL_OK, NULL, NULL));
  fl_arena_release(&arena);
  return 0;
}
`)
  assert.deepEqual(lines, ["без арены: 0", "без результата: 0"])
})

test("вложенные области откатываются по одной и не задевают объемлющую", async () => {
  /*
   * Область на вызов открывается на КАЖДОМ уровне рекурсии, поэтому порядок
   * «внутренняя закрылась — внешняя ещё открыта» это обычный случай, а не
   * краевой. Здесь внутренняя откатывает свой мусор, а живое внешней остаётся
   * нетронутым; краснеет, если fl_region_close не возвращает границу
   * объемлющей области.
   */
  const lines = await probe(`${HEAD}
int main(void) {
  fl_mark outer;
  fl_mark inner;
  fl_value snaruzhi = fl_nothing();
  fl_value vnutri = fl_nothing();
  fl_value etalon = fl_nothing();
  size_t do_vsego = 0;
  nachalo();
  etalon = spisok(8);
  do_vsego = arena.handed;
  outer = fl_region_open(&ctx);
  snaruzhi = spisok(8);
  musor(10000);
  inner = fl_region_open(&ctx);
  musor(10000);
  vnutri = spisok(8);
  (void)fl_region_close(&ctx, inner, FL_OK, &vnutri, NULL);
  printf("внешнее цело: %s\\n", fl_equal(snaruzhi, etalon) ? "да" : "нет");
  printf("внутреннее цело: %s\\n", fl_equal(vnutri, etalon) ? "да" : "нет");
  (void)fl_region_close(&ctx, outer, FL_OK, &vnutri, NULL);
  printf("после внешней: %lu\\n", (unsigned long)(arena.handed - do_vsego));
  printf("итог цел: %s\\n", fl_equal(vnutri, etalon) ? "да" : "нет");
  fl_arena_release(&arena);
  return 0;
}
`)
  assert.equal(lines[0], "внешнее цело: да")
  assert.equal(lines[1], "внутреннее цело: да")
  const left = Number(lines[2].split(": ")[1])
  assert.ok(left > 0 && left < 4096, `после внешней области обязан остаться только итог, осталось ${left}`)
  assert.equal(lines[3], "итог цел: да")
})

test("буфер перекладки отдаётся системе: valgrind не находит ни потерянного байта", async () => {
  /*
   * Буфер живёт между откатами (иначе каждый вызов покупал бы его заново) и
   * отдаётся в `fl_arena_release`. Краснеет, если его там забыть.
   */
  const version = spawnSync("valgrind", ["--version"], { encoding: "utf8" })
  if (version.status !== 0) return

  serial += 1
  const directory = join(workdir, `v${serial}`)
  execFileSync("mkdir", ["-p", directory])
  await copyFile(join(runtimeDirectory, "flang_runtime.h"), join(directory, "flang_runtime.h"))
  await copyFile(join(runtimeDirectory, "flang_runtime.c"), join(directory, "flang_runtime.c"))
  await writeFile(
    join(directory, "proba.c"),
    `${HEAD}
int main(void) {
  fl_mark region;
  fl_value result = fl_nothing();
  size_t round = 0;
  nachalo();
  for (round = 0; round < 8; round += 1) {
    region = fl_region_open(&ctx);
    musor(10000);
    result = spisok(64);
    (void)fl_region_close(&ctx, region, FL_OK, &result, NULL);
  }
  printf("длина: %lu\\n", (unsigned long)result.as.list.count);
  fl_arena_release(&arena);
  return 0;
}
`,
    "utf8",
  )
  execFileSync("cc", [...CFLAGS, "proba.c", "flang_runtime.c", "-o", "proba", "-lm"], { cwd: directory })
  const run = spawnSync(
    "valgrind",
    ["--error-exitcode=9", "--leak-check=full", "--show-leak-kinds=all", "--errors-for-leak-kinds=all",
      join(directory, "proba")],
    { encoding: "utf8", timeout: 300_000 },
  )
  assert.equal(run.status, 0, `valgrind нашёл проблему:\n${run.stderr}`)
  assert.match(run.stderr, /in use at exit: 0 bytes in 0 blocks/u)
})

/* ═══════════ 5. настоящая программа, которая без области не считалась ══════ */

test("сортировка вставками досчитывает под пределом памяти, при котором раньше отказывала", async () => {
  /*
   * Проверка на настоящей программе, а не на пробе: «Сортировка вставками» из
   * `flang/examples/rosetta/quicksort.flang` — тотальная, доказанная
   * структурно, написанная прямо, без единой хитрости.
   *
   * До области память на ней росла КУБИЧЕСКИ (замерено massif на этом дереве:
   * 250 → 82 МиБ, 500 → 675 МиБ, 750 → 2,3 ГиБ, 1 000 → 6,6 ГиБ), и при
   * обычном пределе адресного пространства в 8 ГиБ полторы тысячи элементов
   * давали объявленный отказ FLANG_MEMORY — то есть программа не досчитывала
   * вовсе. С областью тот же вход при том же пределе занимает 101 МиБ и
   * доходит до ответа.
   *
   * Здесь взят предел поменьше и вход поменьше, чтобы проверка шла секунды, а
   * не минуты: 512 МиБ адресного пространства и 700 элементов. Без области на
   * этом входе нужно около 1,9 ГиБ — вчетверо больше предела.
   *
   * Краснеет от снятия области целиком: тогда прогонщик отвечает
   * FLANG_MEMORY вместо числа. Проверка идёт только там, где предел можно
   * поставить (`ulimit -v`, то есть Linux) и где есть `bash`.
   */
  if (process.platform !== "linux") return

  const program = `модуль «Проба вставками»
  использует «Быстрая сортировка» из "${fileURLToPath(new URL("../examples/rosetta/quicksort.flang", import.meta.url))}"

функция «Построить»
  принимает сколько: число, зерно: число, накоплено: список числа
  возвращает список числа
  если сколько не больше 0
    то накоплено
    иначе
      пусть следующее равно ((зерно умножить на 1103515245) плюс 12345) остаток от 2147483648
      «Построить» от (сколько минус 1) и следующее и (добавить (следующее остаток от 1000000) к накоплено)

функция «Сумма»
  принимает элементы: список числа
  возвращает число
  свёртка элементы начиная с 0 как акк и эл → акк плюс эл

функция «Проба»
  принимает н: число
  возвращает число
  «Сумма» от («Сортировка вставками» от («Построить» от н и 12345 и пустой список))
`
  serial += 1
  const directory = join(workdir, `v${serial}`)
  execFileSync("mkdir", ["-p", directory])
  const source = join(directory, "proba.flang")
  await writeFile(source, program, "utf8")
  const flang = fileURLToPath(new URL("../bin/flang.mjs", import.meta.url))
  execFileSync(process.execPath, [flang, "emit", source, "--target", "c", "--out", directory,
    "--max-steps", "2000000000", "--max-depth", "4000000"], { encoding: "utf8", stdio: ["ignore", "ignore", "pipe"] })
  execFileSync("make", ["-C", directory], { encoding: "utf8", stdio: ["ignore", "ignore", "pipe"] })

  const run = spawnSync("bash", ["-c",
    `ulimit -v 524288; echo '{"fn":"Проба","args":[{"n":"700"}]}' | ${join(directory, "flang_cli")} --json`],
  { encoding: "utf8", timeout: 600_000 })
  const answer = JSON.parse((run.stdout || "").trim() || "{}")
  assert.equal(
    answer.ok,
    true,
    `под пределом 512 МиБ программа обязана досчитать, а не отказать: ${run.stdout || run.stderr}`,
  )
  assert.equal(answer.value?.n, "351563950", "ответ обязан совпасть с эталонным")
})
