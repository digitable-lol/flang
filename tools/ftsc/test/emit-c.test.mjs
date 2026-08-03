/**
 * Тесты бэкенда C.
 *
 * Проверяется не текст вывода, а его пригодность: сгенерированный код обязан
 * собираться штатными флагами и проходить примеры моделей. Сравнивать
 * сгенерированный C построчно с эталоном бессмысленно — такой тест ломается от
 * любого пробела и ничего не говорит о правильности.
 */
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { emit, target } from "../src/emit/c.mjs"
import { missingToolchain } from "./toolchain-guard.mjs"

const FIXTURES = fileURLToPath(new URL("./fixtures/", import.meta.url))
const NAMES = ["discount", "delivery", "shipment", "shop"]
const FLAGS = ["-std=c11", "-Wall", "-Wextra", "-Werror", "-pedantic"]

const fixture = async (name) => JSON.parse(await readFile(join(FIXTURES, `${name}.ir.json`), "utf8"))

/* Тулчейн ищется один раз: без компилятора тесты обязаны пропускаться, а не
   притворяться пройденными. */
const compiler = (() => {
  const probe = spawnSync("gcc", ["--version"], { encoding: "utf8" })
  return probe.status === 0 ? "gcc" : null
})()

/**
 * Пишет вывод бэкенда во временный каталог, собирает штатными флагами и
 * запускает получившуюся программу. `replace` подменяет содержимое файла —
 * так контракт утилиты можно проверить своим main, а не только примерами.
 * Возвращает stdout собранной программы.
 */
async function build(program, { replace = {} } = {}) {
  const files = emit(program, { projectName: program.project }).map((file) =>
    Object.hasOwn(replace, file.path) ? { path: file.path, content: replace[file.path] } : file,
  )
  const directory = await mkdtemp(join(tmpdir(), "ftsc-c-"))
  try {
    for (const file of files) {
      await writeFile(join(directory, file.path), file.content, "utf8")
    }
    const sources = files.filter((file) => file.path.endsWith(".c")).map((file) => file.path)
    const compiled = spawnSync(compiler, [...FLAGS, "-o", "ftsc_tests", ...sources, "-lm"], {
      cwd: directory,
      encoding: "utf8",
    })
    assert.equal(compiled.status, 0, `${compiler} ${FLAGS.join(" ")}:\n${compiled.stderr}`)
    assert.equal(compiled.stderr, "", `компилятор не должен ничего сказать:\n${compiled.stderr}`)
    const executed = spawnSync(join(directory, "ftsc_tests"), [], { cwd: directory, encoding: "utf8" })
    assert.equal(executed.status, 0, `запуск провалился:\n${executed.stdout}${executed.stderr}`)
    return executed.stdout
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

test("бэкенд объявляет себя целью «c»", () => {
  assert.equal(target.id, "c")
  assert.equal(target.extension, ".c")
})

test("emit отрабатывает на всех фикстурах и даёт непустой список файлов", async () => {
  for (const name of NAMES) {
    const program = await fixture(name)
    const files = emit(program, { projectName: program.project })
    assert.ok(files.length > 0, `${name}: пустой список файлов`)
    for (const file of files) {
      assert.ok(file.path.length > 0, `${name}: файл без пути`)
      assert.ok(file.content.length > 0, `${name}: пустой файл ${file.path}`)
      assert.match(file.content, /Сгенерировано ftsc/u, `${name}: ${file.path} без шапки`)
      assert.match(file.content, /Не редактировать руками/u, `${name}: ${file.path} без запрета правок`)
    }
    assert.ok(
      files.some((file) => file.path === "ftsc_tests.c"),
      `${name}: нет файла с тестами примеров`,
    )
  }
})

test("вывод детерминирован: два вызова дают побайтово одинаковый результат", async () => {
  for (const name of NAMES) {
    const program = await fixture(name)
    const first = emit(program, { projectName: program.project })
    const second = emit(program, { projectName: program.project })
    assert.deepEqual(
      first.map((file) => file.path),
      second.map((file) => file.path),
      `${name}: разный состав файлов`,
    )
    for (const [index, file] of first.entries()) {
      assert.ok(
        Buffer.from(file.content, "utf8").equals(Buffer.from(second[index].content, "utf8")),
        `${name}: ${file.path} отличается между вызовами`,
      )
    }
  }
})

test("исходное имя FTS сохранено рядом с типом и функцией", async () => {
  const files = emit(await fixture("discount"), { projectName: "discount" })
  const header = files.find((file) => file.path === "prodazhi.h")
  assert.ok(header !== undefined, "нет заголовка модуля «Продажи»")
  assert.match(header.content, /объект «Покупка»/u)
  assert.match(header.content, /«постоянный клиент»/u)
  assert.match(header.content, /утилита «Рассчитать скидку»/u)
  assert.match(header.content, /ftsc_status rasschitat_skidku\(const Pokupka \*input/u)
})

test("для функтора печатается функция преобразования объекта", async () => {
  const files = emit(await fixture("shop"), { projectName: "shop" })
  const source = files.find((file) => file.path === "ftsc_functors.c")
  assert.ok(source !== undefined, "нет файла функторов")
  assert.match(source.content, /функтор «Заказ в счёт»: «Покупка» → «Счёт»/u)
  assert.match(source.content, /image->summa_bez_nds = input->summa;/u)
  assert.match(source.content, /image->loyalnyy = input->postoyannyy_klient;/u)
})

test("коллизия идентификаторов — ошибка сборки, а не переименование", () => {
  const program = {
    ir: 1,
    project: "collision",
    modules: [
      {
        name: "Проверка",
        category: "Проверка",
        source: "test/collision.fts",
        imports: [],
        exports: null,
        document: {
          category: "Проверка",
          structures: [
            { name: "Покупка", fields: [{ name: "сумма", type: "Деньги" }] },
            { name: "покупка", fields: [{ name: "сумма", type: "Деньги" }] },
          ],
          functors: [],
          proposition: null,
          ts_compat: {},
          utilities: [],
        },
      },
    ],
    functors: [],
    order: ["Проверка"],
  }
  assert.throws(() => emit(program, { projectName: "collision" }), /один идентификатор «Pokupka»/u)
})

test("discount: код собирается и примеры проходят", async (t) => {
  if (compiler === null) {
    missingToolchain(t, "c", "gcc не найден")
    return
  }
  const output = await build(await fixture("discount"))
  assert.match(output, /^3\/3 passed$/mu, output)
})

test("delivery: код собирается и примеры проходят", async (t) => {
  if (compiler === null) {
    missingToolchain(t, "c", "gcc не найден")
    return
  }
  const output = await build(await fixture("delivery"))
  assert.match(output, /^3\/3 passed$/mu, output)
})

test("shop: два модуля и функтор собираются вместе, примеры проходят", async (t) => {
  if (compiler === null) {
    missingToolchain(t, "c", "gcc не найден")
    return
  }
  const output = await build(await fixture("shop"))
  assert.match(output, /^4\/4 passed$/mu, output)
})

test("shipment: без утилит — валидный код без функций-утилит", async (t) => {
  const program = await fixture("shipment")
  const files = emit(program, { projectName: "shipment" })
  const header = files.find((file) => file.path === "ispolnenie_zakaza.h")
  assert.ok(header !== undefined, "нет заголовка модуля")
  /* Ни одной утилиты в модели — значит, ни одной функции с контрактом утилиты. */
  assert.equal(/ftsc_status\s+\w+\(/u.test(header.content), false, header.content)
  assert.ok(
    files.every((file) => !file.path.startsWith("ftsc_functors")),
    "у проекта нет функторов между категориями",
  )
  /* Типы и морфизмы напечатаны: пустым вывод быть не должен. */
  assert.match(header.content, /typedef struct \{/u)
  assert.match(header.content, /bool gotovyy_zakaz_mozhno_otgruzit\(bool /u)

  if (compiler === null) {
    missingToolchain(t, "c", "gcc не найден")
    return
  }
  const output = await build(program)
  assert.match(output, /^1\/1 passed$/mu, output)
})

test("нарушенное свойство прекращает вычисление кодом возврата, а не чинит результат", async (t) => {
  /* Утилита всегда возвращает 100, а свойство требует не больше 50: свойство
     обязано сработать при любом входе. */
  const program = {
    ir: 1,
    project: "property",
    modules: [
      {
        name: "Проверка",
        category: "Проверка",
        source: "test/property.fts",
        imports: [],
        exports: null,
        document: {
          category: "Проверка",
          structures: [{ name: "Вход", fields: [{ name: "значение", type: "Число" }] }],
          functors: [],
          proposition: null,
          ts_compat: {},
          utilities: [
            {
              name: "Проверить",
              input: "Вход",
              output: "Число",
              initial: 100,
              rules: [],
              properties: [{ name: "Не больше пятидесяти", operator: "lte", value: { kind: "value", value: 50 } }],
              examples: [],
            },
          ],
        },
      },
    ],
    functors: [],
    order: ["Проверка"],
  }
  if (compiler === null) {
    missingToolchain(t, "c", "gcc не найден")
    return
  }
  /* Свой main вместо сгенерированного: проверяется именно контракт функции —
     код возврата, имя нарушенного свойства и нетронутый результат. */
  const main = `#include <stdio.h>
#include "proverka.h"

int main(void) {
  const Vhod input = { .znachenie = 1.0 };
  double result = -1.0;
  const char *violation = NULL;
  const ftsc_status status = proverit(&input, &result, &violation);
  if (status != FTSC_UTILITY_PROPERTY) {
    printf("FAIL: статус %d\\n", (int) status);
    return 1;
  }
  if (violation == NULL || ftsc_text_neq(violation, "Не больше пятидесяти")) {
    printf("FAIL: имя свойства потеряно\\n");
    return 1;
  }
  if (!ftsc_number_eq(result, -1.0)) {
    printf("FAIL: результат подменён вместо ошибки\\n");
    return 1;
  }
  printf("1/1 passed\\n");
  return 0;
}
`
  const output = await build(program, { replace: { "ftsc_tests.c": main } })
  assert.match(output, /^1\/1 passed$/mu, output)
})

test("опциональное поле — пара has_x + значение, код собирается", async (t) => {
  /* Ни одна фикстура не содержит «иногда является», поэтому контракт
     опциональности проверяется на синтетическом IR. */
  const program = {
    ir: 1,
    project: "optional",
    modules: [
      {
        name: "Заявки",
        category: "Заявки",
        source: "test/optional.fts",
        imports: [],
        exports: null,
        document: {
          category: "Заявки",
          structures: [
            {
              name: "Заявка",
              fields: [
                { name: "сумма", type: "Деньги" },
                { name: "скидка", type: "Число | undefined" },
              ],
            },
          ],
          functors: [],
          proposition: null,
          ts_compat: {},
          utilities: [
            {
              name: "Итог",
              input: "Заявка",
              output: "Деньги",
              initial: 0,
              rules: [
                { name: "База", when: [], action: { kind: "set", value: { kind: "field", field: "сумма" } } },
                {
                  name: "Вычесть скидку",
                  when: [{ field: "скидка", operator: "gt", value: { kind: "value", value: 0 } }],
                  action: { kind: "add", value: { kind: "percent", percent: -100, field: "скидка" } },
                },
              ],
              properties: [{ name: "Итог неотрицателен", operator: "gte", value: { kind: "value", value: 0 } }],
              examples: [{ name: "Скидка задана", input: { сумма: 1000, скидка: 100 }, expected: 900 }],
            },
          ],
        },
      },
    ],
    functors: [],
    order: ["Заявки"],
  }
  const files = emit(program, { projectName: "optional" })
  const header = files.find((file) => file.path === "zayavki.h")
  assert.match(header.content, /bool has_skidka;/u)
  assert.match(header.content, /double skidka;/u)
  const source = files.find((file) => file.path === "zayavki.c")
  assert.match(source.content, /if \(!input->has_skidka\) \{\n\s+return FTSC_UTILITY_INPUT;/u)

  if (compiler === null) {
    missingToolchain(t, "c", "gcc не найден")
    return
  }
  const output = await build(program)
  assert.match(output, /^1\/1 passed$/mu, output)
})
