/**
 * Тесты бэкенда Java.
 *
 * Как и у соседних бэкендов (см. emit-c.test.mjs): сравнивать сгенерированный
 * Java построчно с эталоном бессмысленно — такой тест ломается от любого
 * пробела и ничего не говорит о правильности. Проверяется пригодность:
 * сгенерированный код обязан собираться `javac -Xlint:all -Werror` и —
 * там, где в модели есть утилиты с примерами — реально пройти их через
 * самостоятельный раннер (без JUnit и без сети).
 */
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import { emit, target } from "../src/emit/java.mjs"

const FIXTURES = fileURLToPath(new URL("./fixtures/", import.meta.url))
const NAMES = ["discount", "delivery", "shipment", "shop"]

const fixture = async (name) => JSON.parse(await readFile(join(FIXTURES, `${name}.ir.json`), "utf8"))

/* Тулчейн ищется один раз: без javac тесты компиляции обязаны пропускаться
   (t.skip), а не притворяться пройденными имитацией успеха. */
const javac = (() => {
  const probe = spawnSync("javac", ["--version"], { encoding: "utf8" })
  return probe.status === 0 ? "javac" : null
})()

/**
 * Пишет вывод бэкенда во временный каталог (mkdtemp в os.tmpdir()), собирает
 * `javac -Xlint:all -Werror` и, если у проекта есть раннер примеров
 * (`*ExampleRunner.java`), запускает его через `java`. Возвращает stdout
 * запуска или null, если раннера в выводе нет (например, для shipment —
 * там нет ни одной утилиты).
 */
async function build(program) {
  const files = emit(program, { projectName: program.project })
  const directory = await mkdtemp(join(tmpdir(), "ftsc-java-"))
  try {
    const sources = []
    for (const file of files) {
      const path = join(directory, file.path)
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, file.content, "utf8")
      if (file.path.endsWith(".java")) sources.push(file.path)
    }
    const outDir = join(directory, "out")
    await mkdir(outDir, { recursive: true })
    const compiled = spawnSync("javac", ["-Xlint:all", "-Werror", "-d", "out", ...sources], {
      cwd: directory,
      encoding: "utf8",
    })
    assert.equal(compiled.status, 0, `javac -Xlint:all -Werror:\n${compiled.stderr}`)
    assert.equal(compiled.stderr, "", `javac не должен ничего сказать:\n${compiled.stderr}`)

    const runnerFile = files.find((file) => /ExampleRunner\.java$/u.test(file.path))
    if (!runnerFile) return null
    const mainClass = `${runnerFile.path
      .replace(/\.java$/u, "")
      .split("/")
      .join(".")}`
    const executed = spawnSync("java", ["-cp", "out", mainClass], { cwd: directory, encoding: "utf8" })
    assert.equal(executed.status, 0, `запуск раннера провалился:\n${executed.stdout}${executed.stderr}`)
    return executed.stdout
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

test("бэкенд объявляет себя целью «java»", () => {
  assert.equal(target.id, "java")
  assert.equal(target.extension, ".java")
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

test("исходное имя FTS сохранено рядом с типом и методом", async () => {
  const files = emit(await fixture("discount"), { projectName: "discount" })
  const struct = files.find((file) => file.path === "discount/prodazhi/Pokupka.java")
  assert.ok(struct !== undefined, "нет структуры «Покупка»")
  assert.match(struct.content, /FTS-объект «Покупка»/u)
  assert.match(struct.content, /«постоянный клиент»/u)
  assert.match(struct.content, /public record Pokupka\(double summa, boolean postoyannyyKlient\)/u)

  const utility = files.find((file) => file.path === "discount/prodazhi/RasschitatSkidku.java")
  assert.ok(utility !== undefined, "нет утилиты «Рассчитать скидку»")
  assert.match(utility.content, /FTS-утилита «Рассчитать скидку»/u)
  assert.match(utility.content, /public static double apply\(Pokupka input\)/u)
})

test("для функтора печатается функция преобразования «Покупка → Счёт»", async () => {
  const files = emit(await fixture("shop"), { projectName: "shop" })
  const functor = files.find((file) => file.path === "shop/functors/ZakazVSchyot.java")
  assert.ok(functor !== undefined, "нет файла функтора")
  assert.match(functor.content, /Функтор «Заказ в счёт»: «Покупка» → «Счёт»/u)
  assert.match(functor.content, /public static shop\.billing\.Schyot convertPokupkaToSchyot\(shop\.prodazhi\.Pokupka source\)/u)
  assert.match(functor.content, /source\.summa\(\)/u)
  assert.match(functor.content, /source\.postoyannyyKlient\(\)/u)
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

test("опциональное поле — Optional<T>, отсутствие в правиле прерывает вычисление", async (t) => {
  /* Ни одна фикстура не содержит «иногда является», поэтому контракт
     опциональности проверяется на синтетическом IR (тот же приём, что и в
     emit-c.test.mjs). Отрицательный процент проверяет, что вычитание — это
     просто «add» с отрицательным процентом, как и предписывает IR.
     Ядро FTS прерывает вычисление утилиты, если правило обращается к
     отсутствующему опциональному полю (см. rust.mjs: «ядро при обращении к
     отсутствующему полю прекращает вычисление ошибкой FTS_UTILITY_INPUT») —
     это не «условие ложно», а отказ от выполнения; поэтому единственный
     пример здесь — со скидкой заданной, а отдельная проверка ниже
     удостоверяется, что чтение отсутствующего поля действительно прерывает
     вызов (`Optional.orElseThrow()` бросает `NoSuchElementException`). */
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
  const struct = files.find((file) => file.path === "optional/zayavki/Zayavka.java")
  assert.match(struct.content, /java\.util\.Optional<Double> skidka/u)
  const utility = files.find((file) => file.path === "optional/zayavki/Itog.java")
  assert.match(utility.content, /input\.skidka\(\)\.orElseThrow\(\)/u)

  if (javac === null) {
    t.skip("javac не найден")
    return
  }
  const output = await build(program)
  assert.match(output, /^1\/1 passed$/mu, output)

  /* Прямая проверка отказа: заявка без скидки, но правило, которое её читает. */
  const directory = await mkdtemp(join(tmpdir(), "ftsc-java-optional-"))
  try {
    const files = emit(program, { projectName: "optional" })
    for (const file of files) {
      const path = join(directory, file.path)
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, file.content, "utf8")
    }
    const probe = [
      "package optional;",
      "public final class Probe {",
      "    public static void main(String[] args) {",
      "        var input = new optional.zayavki.Zayavka(1000.0, java.util.Optional.empty());",
      "        try {",
      "            optional.zayavki.Itog.apply(input);",
      '            System.out.println("не бросило исключение");',
      "            System.exit(1);",
      "        } catch (java.util.NoSuchElementException e) {",
      '            System.out.println("ok");',
      "        }",
      "    }",
      "}",
      "",
    ].join("\n")
    await writeFile(join(directory, "optional", "Probe.java"), probe, "utf8")
    const outDir = join(directory, "out")
    await mkdir(outDir, { recursive: true })
    const sources = [...files.map((f) => f.path), "optional/Probe.java"]
    const compiled = spawnSync("javac", ["-Xlint:all", "-Werror", "-d", "out", ...sources], { cwd: directory, encoding: "utf8" })
    assert.equal(compiled.status, 0, compiled.stderr)
    const executed = spawnSync("java", ["-cp", "out", "optional.Probe"], { cwd: directory, encoding: "utf8" })
    assert.equal(executed.status, 0, `${executed.stdout}${executed.stderr}`)
    assert.match(executed.stdout, /^ok$/mu, executed.stdout)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("discount: код собирается и примеры проходят", async (t) => {
  if (javac === null) {
    t.skip("javac не найден")
    return
  }
  const output = await build(await fixture("discount"))
  assert.match(output, /^3\/3 passed$/mu, output)
})

test("delivery: код собирается и примеры проходят", async (t) => {
  if (javac === null) {
    t.skip("javac не найден")
    return
  }
  const output = await build(await fixture("delivery"))
  assert.match(output, /^3\/3 passed$/mu, output)
})

test("shop: два модуля и функтор собираются вместе, примеры проходят", async (t) => {
  if (javac === null) {
    t.skip("javac не найден")
    return
  }
  const output = await build(await fixture("shop"))
  assert.match(output, /^4\/4 passed$/mu, output)
})

test("shipment: без утилит — валидный компилируемый код, без раннера примеров", async (t) => {
  const program = await fixture("shipment")
  const files = emit(program, { projectName: "shipment" })
  const struct = files.find((file) => file.path === "shipment/ispolnenie_zakaza/Zakaz.java")
  assert.ok(struct !== undefined, "нет структуры «Заказ»")
  assert.match(struct.content, /public record Zakaz\(/u)
  /* Ни одной утилиты в модели — значит, ни одного класса-утилиты, раннера и общего исключения. */
  assert.ok(
    files.every((file) => !/ExampleRunner\.java$/u.test(file.path)),
    "у проекта без утилит не должно быть раннера примеров",
  )
  assert.ok(
    files.every((file) => !file.path.endsWith("FtsPropertyViolation.java")),
    "у проекта без утилит не нужно общее исключение",
  )
  assert.ok(
    files.every((file) => !file.path.startsWith("shipment/functors/")),
    "у проекта нет функторов между категориями",
  )

  if (javac === null) {
    t.skip("javac не найден")
    return
  }
  await build(program)
})
